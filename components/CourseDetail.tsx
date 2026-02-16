import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, 
  Search, 
  Calendar, 
  Maximize2,
  Trash2,
  FileText,
  Eye,
  ChevronRight,
  ChevronLeft,
  Clock,
  X,
  Edit3,
  Plus,
  BookOpen,
  Mic,
  Download,
  Video,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Share,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';
import { Course } from './Dashboard.tsx';
import { NoteModal } from './NoteModal.tsx';

interface NoteData {
  id?: string;
  subject_id: string;
  day_number: number;
  title: string;
  content: string;
}

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'file' | 'pdf' | 'word' | 'excel' | 'ppt';
  name: string;
}

interface CourseDetailProps {
  course: Course;
  onBack: () => void;
  profilePic: string | null;
  userName: string;
  onSignOut: () => void;
  onCourseUpdated: () => void;
  onCourseDeleted: () => void;
}

export const CourseDetail: React.FC<CourseDetailProps> = ({ 
  course, 
  onBack,
  onCourseUpdated,
  onCourseDeleted
}) => {
  const getInitialDayCount = () => {
    const joinDate = new Date(course.join_date);
    joinDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - joinDate.getTime();
    return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
  };

  const initialCount = getInitialDayCount();
  const [selectedDay, setSelectedDay] = useState<number>(initialCount);
  const [notes, setNotes] = useState<Record<string, NoteData>>({});
  const [searchResults, setSearchResults] = useState<NoteData[]>([]);
  const [media, setMedia] = useState<Record<string, MediaItem[]>>({});
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeModal, setActiveModal] = useState<'add' | 'edit' | null>(null);
  const [activeSubject, setActiveSubject] = useState<{id: string, name: string} | null>(null);
  const [viewingNote, setViewingNote] = useState<{subjectId: string, subjectName: string} | null>(null);
  const [fullPreview, setFullPreview] = useState<MediaItem | null>(null);
  const [postingNote, setPostingNote] = useState<{note: NoteData, subjectName: string} | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [deletingNote, setDeletingNote] = useState<{subjectId: string, subjectName: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const selectedDayRef = useRef<number>(selectedDay);
  const notesCache = useRef<Record<number, Record<string, NoteData>>>({});
  const mediaCache = useRef<Record<number, Record<string, MediaItem[]>>>({});
  const activeRequests = useRef<Record<number, boolean>>({});

  const BUCKET_NAME = 'course-multimedia';
  const DELIMITER = '||STUDYPRO_TITLE_END||';

  const academicLabel = course.academic_structure && course.current_value 
    ? `${course.academic_structure === 'semester_wise' ? 'SEMESTER' : 'YEAR'} ${course.current_value}`
    : '';

  const days = useMemo(() => {
    const joinDate = new Date(course.join_date);
    joinDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - joinDate.getTime();
    const count = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [course.join_date]);

  const dateInfo = useMemo(() => {
    const d = new Date(course.join_date);
    d.setDate(d.getDate() + (selectedDay - 1));
    return {
      day: d.toLocaleDateString(undefined, { weekday: 'long' }),
      date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    };
  }, [course.join_date, selectedDay]);

  useEffect(() => {
    selectedDayRef.current = selectedDay;
    scrollToDay(selectedDay);
    fetchWorkspaceData();
  }, [selectedDay]);

  const scrollToDay = (day: number) => {
    setTimeout(() => {
      const activeBtn = document.getElementById(`day-btn-${day}`);
      const container = timelineRef.current;
      if (activeBtn && container) {
        const offset = container.offsetWidth / 2 - activeBtn.offsetWidth / 2;
        container.scrollTo({ left: activeBtn.offsetLeft - offset, behavior: 'smooth' });
      }
    }, 100);
  };

  const fetchWorkspaceData = async (forceRefresh = false) => {
    const dayToFetch = selectedDay;
    if (searchQuery.trim() && !forceRefresh) return;

    if (!forceRefresh && notesCache.current[dayToFetch] && mediaCache.current[dayToFetch]) {
      setNotes(notesCache.current[dayToFetch]);
      setMedia(mediaCache.current[dayToFetch]);
      setLoadingWorkspace(false);
      return;
    }

    if (activeRequests.current[dayToFetch]) return;

    setLoadingWorkspace(true);
    activeRequests.current[dayToFetch] = true;

    try {
      const subjectIds = course.subjects?.map(s => s.id) || [];
      if (subjectIds.length === 0) {
        setLoadingWorkspace(false);
        return;
      }

      const [notesRes, mediaRes] = await Promise.all([
        supabase.from('notes').select('*').eq('day_number', dayToFetch).in('subject_id', subjectIds),
        supabase.from('course_media').select('*').eq('day_number', dayToFetch).in('subject_id', subjectIds)
      ]);

      const notesMap: Record<string, NoteData> = {};
      notesRes.data?.forEach((n: any) => {
        const parts = n.content.split(DELIMITER);
        notesMap[n.subject_id] = { id: n.id, subject_id: n.subject_id, day_number: n.day_number, title: parts[0] || '', content: parts[1] || '' };
      });

      const mediaMap: Record<string, MediaItem[]> = {};
      mediaRes.data?.forEach((m: any) => {
        if (!mediaMap[m.subject_id]) mediaMap[m.subject_id] = [];
        mediaMap[m.subject_id].push(m);
      });

      notesCache.current[dayToFetch] = notesMap;
      mediaCache.current[dayToFetch] = mediaMap;

      if (selectedDayRef.current === dayToFetch) {
        setNotes(notesMap);
        setMedia(mediaMap);
        setLoadingWorkspace(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      delete activeRequests.current[dayToFetch];
    }
  };

  const handleGlobalSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      fetchWorkspaceData();
      return;
    }
    setSearching(true);
    setLoadingWorkspace(true);
    try {
      const subjectIds = course.subjects?.map(s => s.id) || [];
      const { data } = await supabase.from('notes').select('*').in('subject_id', subjectIds).ilike('content', `%${query}%`);
      const results = (data || []).map((n: any) => {
        const parts = n.content.split(DELIMITER);
        return { id: n.id, subject_id: n.subject_id, day_number: n.day_number, title: parts[0] || 'Untitled', content: parts[1] || '' };
      }).filter(r => r.title.toLowerCase().includes(query.toLowerCase()));
      setSearchResults(results);
    } catch (err) { console.error(err); } 
    finally { setLoadingWorkspace(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => handleGlobalSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const initiatePost = (note: NoteData, subjectName: string) => {
    setPostingNote({ note, subjectName });
  };

  const initiateDelete = (subjectId: string, subjectName: string) => {
    setDeletingNote({ subjectId, subjectName });
  };

  const openNoteModal = (subject: {id: string, name: string}, mode: 'add' | 'edit') => {
    setActiveSubject(subject);
    setActiveModal(mode);
  };

  const handleDownload = async (item: MediaItem) => {
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name || `studypro-${item.type}-${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      window.open(item.url, '_blank');
    }
  };

  const handleExecuteDelete = async () => {
    if (!deletingNote) return;
    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthenticated");
      const currentMedia = media[deletingNote.subjectId] || [];
      const paths = currentMedia.map(m => {
        const url = new URL(m.url);
        const parts = url.pathname.split(`/${BUCKET_NAME}/`);
        return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
      }).filter((p): p is string => !!p);

      if (paths.length > 0) await supabase.storage.from(BUCKET_NAME).remove(paths);
      await supabase.from('notes').delete().eq('subject_id', deletingNote.subjectId).eq('day_number', selectedDay).eq('user_id', user.id);
      await supabase.from('course_media').delete().eq('subject_id', deletingNote.subjectId).eq('day_number', selectedDay).eq('user_id', user.id);

      delete notesCache.current[selectedDay][deletingNote.subjectId];
      delete mediaCache.current[selectedDay][deletingNote.subjectId];
      setNotes({ ...notesCache.current[selectedDay] });
      setMedia({ ...mediaCache.current[selectedDay] });
      setDeletingNote(null);
      setViewingNote(null);
    } catch (err) { alert("Delete failed"); } 
    finally { setIsDeleting(false); }
  };

  const handleExecutePost = async () => {
    if (!postingNote) return;
    setIsPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthenticated");
      const subjectMedia = media[postingNote.note.subject_id] || [];
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        title: postingNote.note.title || `Notes: ${postingNote.subjectName}`,
        content: postingNote.note.content,
        media: subjectMedia.map(m => ({ url: m.url, type: m.type, name: m.name }))
      });
      if (error) throw error;
      setPostSuccess(true);
      setTimeout(() => { setPostSuccess(false); setPostingNote(null); }, 1500);
    } catch (err) { alert("Posting failed"); } 
    finally { setIsPosting(false); }
  };

  const getDocStyles = (type: MediaItem['type']) => {
    switch (type) {
      case 'word': return { icon: <FileText size={20} />, color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'excel': return { icon: <FileSpreadsheet size={20} />, color: 'text-green-600', bg: 'bg-green-50' };
      case 'ppt': return { icon: <Presentation size={20} />, color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'pdf': return { icon: <FileText size={20} />, color: 'text-red-600', bg: 'bg-red-50' };
      default: return { icon: <FileCode size={20} />, color: 'text-slate-600', bg: 'bg-slate-50' };
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-500 w-full space-y-8 pb-20 no-scrollbar relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2 md:px-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all"><ArrowLeft size={20} /></button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight truncate lowercase">{course.name}</h2>
              <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full border border-indigo-100 tracking-widest uppercase">{course.degree}</span>
            </div>
            {academicLabel && <p className="text-slate-400 font-black text-[11px] tracking-[0.2em] mt-1 uppercase">{academicLabel}</p>}
          </div>
        </div>
        <div className="relative group flex-1 md:max-w-md">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
          <input type="text" placeholder="Search notes..." className="w-full pl-16 pr-8 py-4 bg-white border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-bold text-slate-900 shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center p-2 gap-3 md:gap-2 h-auto select-none">
        <div className="flex items-center justify-between md:justify-start gap-3 pl-4 pr-6 py-3 md:py-2 bg-slate-50 rounded-2xl border border-slate-100 shrink-0 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="text-indigo-600 p-1.5 bg-indigo-50 rounded-lg"><Calendar size={16} /></div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-900 leading-none">{dateInfo.day}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{dateInfo.date}</span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-1 min-w-0 relative w-full">
          <button onClick={() => timelineRef.current?.scrollBy({ left: -200, behavior: 'smooth' })} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors shrink-0"><ChevronLeft size={16} /></button>
          <div ref={timelineRef} className="flex-1 overflow-x-auto scroll-smooth flex items-center gap-3 no-scrollbar px-2 relative touch-pan-x">
            {days.map(day => (
              <button key={day} id={`day-btn-${day}`} onClick={() => setSelectedDay(day)} className={`flex items-center justify-center shrink-0 w-10 h-10 rounded-xl border transition-all active:scale-95 ${selectedDay === day ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}>
                <div className="flex flex-col items-center">
                  <span className={`text-[6px] font-black uppercase ${selectedDay === day ? 'text-indigo-100' : 'text-slate-300'}`}>Day</span>
                  <span className="text-sm font-black leading-none">{day}</span>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => timelineRef.current?.scrollBy({ left: 200, behavior: 'smooth' })} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors shrink-0"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-[50]">
        {loadingWorkspace ? (
           <div className="col-span-full py-32 flex flex-col items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div></div>
        ) : (
          (() => {
             const activeSubjects = (course.subjects || []);
             const isSearch = searchQuery.trim() !== '';
             const filteredSubjects = isSearch ? activeSubjects.filter(sub => searchResults.some(r => r.subject_id === sub.id)) : activeSubjects;

             if (isSearch && filteredSubjects.length === 0) {
               return <div className="col-span-full py-20 text-center bg-slate-50 border border-dashed border-slate-100 rounded-[2rem]"><Search size={32} className="mx-auto text-slate-200 mb-4" /><p className="font-bold text-slate-400">No matching notes</p></div>;
             }

             return filteredSubjects.map((subject) => {
               const currentDayNote = notes[subject.id];
               const subjectResults = searchResults.filter(r => r.subject_id === subject.id);
               return (
                 <div key={subject.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col group">
                   <div className="px-6 py-5 flex items-center gap-4 bg-white">
                     <div className="w-1.5 h-8 bg-indigo-600 rounded-full shadow-indigo-100 shadow-md"></div>
                     <h3 className="text-xl font-black text-slate-900 truncate capitalize">{subject.name}</h3>
                     {currentDayNote && !isSearch && <button onClick={() => initiatePost(currentDayNote, subject.name)} className="ml-auto p-2 text-slate-400 hover:text-indigo-600"><Share size={18} /></button>}
                   </div>
                   <div className="px-6 flex-1 flex flex-col gap-4">
                     {isSearch ? (
                       <div className="space-y-3 pb-6 max-h-[300px] overflow-y-auto custom-scrollbar">
                         {subjectResults.map((res, i) => (
                           <button key={i} onClick={() => { setSelectedDay(res.day_number); setViewingNote({ subjectId: res.subject_id, subjectName: subject.name }); setSearchQuery(''); }} className="w-full text-left bg-slate-50 hover:bg-indigo-50 p-4 rounded-2xl border border-slate-100 transition-all flex items-center justify-between group/res">
                             <div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Day {res.day_number}</p><h5 className="font-bold text-slate-900 truncate">{res.title}</h5></div>
                             <ChevronRight size={16} className="text-slate-300 group-hover/res:text-indigo-600" />
                           </button>
                         ))}
                       </div>
                     ) : (
                       currentDayNote ? (
                         <div className="flex flex-col gap-3">
                           <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50"><h5 className="font-bold text-slate-900 leading-tight">{currentDayNote.title}</h5></div>
                           <div className="bg-slate-50 p-4 rounded-2xl min-h-[100px] max-h-[200px] overflow-y-auto custom-scrollbar"><p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">{currentDayNote.content}</p></div>
                         </div>
                       ) : (
                         <div className="bg-slate-50/30 border-2 border-dashed border-slate-100 rounded-[2rem] h-[160px] flex items-center justify-center"><p className="text-[12px] font-black text-slate-300 tracking-widest">No Notes Yet</p></div>
                       )
                     )}
                   </div>
                   <div className="px-6 py-5 mt-4 border-t border-slate-50 flex items-center justify-between">
                      {isSearch ? <span className="text-[10px] font-bold text-indigo-400 mx-auto uppercase">Found {subjectResults.length}</span> :
                       currentDayNote ? (
                         <>
                           <button onClick={() => setViewingNote({subjectId: subject.id, subjectName: subject.name})} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-500 rounded-full font-bold text-xs"><Eye size={16} /> View</button>
                           <div className="flex gap-2">
                             <button onClick={() => initiateDelete(subject.id, subject.name)} className="p-2 text-red-400 hover:text-red-500"><Trash2 size={18} /></button>
                             <button onClick={() => openNoteModal(subject, 'edit')} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full font-bold text-xs"><Edit3 size={16} /> Edit</button>
                           </div>
                         </>
                       ) : <button onClick={() => openNoteModal(subject, 'add')} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-xs"><Plus size={16} className="inline mr-2" /> Add Note</button>
                      }
                   </div>
                 </div>
               );
             });
          })()
        )}
      </div>

      {deletingNote && createPortal(
        <div className="fixed inset-0 z-[9500] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center animate-in zoom-in-95 shadow-2xl">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-6" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Delete Note?</h3>
            <p className="text-slate-500 text-sm mb-8">This will permanently remove the note and all media.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleExecuteDelete} disabled={isDeleting} className="w-full py-3 bg-red-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2">{isDeleting ? <Loader2 className="animate-spin" size={16} /> : 'Delete'}</button>
              <button onClick={() => setDeletingNote(null)} className="w-full py-3 bg-slate-100 rounded-2xl font-bold text-slate-500">Cancel</button>
            </div>
          </div>
        </div>, document.body
      )}

      {postingNote && createPortal(
        <div className="fixed inset-0 z-[9000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 text-center animate-in zoom-in-95">
            {postSuccess ? <div className="flex flex-col items-center py-6"><CheckCircle2 size={32} className="text-green-500 mb-4" /><h3 className="text-xl font-black">Success!</h3></div> : (
              <><Share size={32} className="text-indigo-600 mx-auto mb-6" /><h3 className="text-xl font-black mb-2">Share to Feed?</h3>
              <p className="text-slate-500 text-sm mb-6">Post your note to the community feed.</p>
              <div className="flex gap-3"><button onClick={() => setPostingNote(null)} className="flex-1 py-3.5 bg-slate-50 rounded-2xl">Cancel</button>
              <button onClick={handleExecutePost} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold">{isPosting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Post Now'}</button></div></>
            )}
          </div>
        </div>, document.body
      )}

      {viewingNote && notes[viewingNote.subjectId] && createPortal(
        <div className="fixed inset-0 z-[7000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white"><div className="flex items-center gap-3"><div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl"><BookOpen size={24} /></div><h2 className="text-xl font-bold">{viewingNote.subjectName} • Day {selectedDay}</h2></div>
             <button onClick={() => setViewingNote(null)} className="p-3 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button></div>
             <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <h1 className="text-2xl font-black text-slate-900">{notes[viewingNote.subjectId].title}</h1>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-base">{notes[viewingNote.subjectId].content}</p>
                
                {media[viewingNote.subjectId] && media[viewingNote.subjectId].length > 0 && (
                  <div className="pt-8 border-t border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 tracking-widest mb-6">Multimedia Vault</h4>
                    
                    {/* Visual Media Grid (Images & Videos) */}
                    {media[viewingNote.subjectId].some(m => ['image', 'video'].includes(m.type)) && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                        {media[viewingNote.subjectId].filter(m => ['image', 'video'].includes(m.type)).map(item => (
                          <div key={item.id} className="relative group aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                            {item.type === 'image' ? (
                               <img src={item.url} className="w-full h-full object-cover" alt={item.name} />
                            ) : (
                               <div className="w-full h-full relative">
                                 <video src={item.url} className="w-full h-full object-cover" />
                                 <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                   <div className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white"><Video size={20} /></div>
                                 </div>
                               </div>
                            )}
                            
                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                               <button onClick={() => setFullPreview(item)} className="p-2.5 bg-white text-slate-900 rounded-xl hover:scale-110 transition-transform shadow-lg" title="View Large"><Maximize2 size={18} /></button>
                               <button onClick={() => handleDownload(item)} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:scale-110 transition-transform shadow-lg" title="Download"><Download size={18} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Audio Files */}
                    {media[viewingNote.subjectId].some(m => m.type === 'audio') && (
                      <div className="space-y-3 mb-6">
                        {media[viewingNote.subjectId].filter(m => m.type === 'audio').map(item => (
                          <div key={item.id} className="bg-slate-50 p-3 rounded-2xl border border-indigo-50 flex flex-col gap-2">
                             <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                   <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0"><Mic size={16} /></div>
                                   <p className="text-xs font-bold truncate text-slate-700">{item.name}</p>
                                </div>
                                <button onClick={() => handleDownload(item)} className="p-2 bg-white text-slate-400 hover:text-indigo-600 border border-slate-100 rounded-xl transition-all shrink-0"><Download size={16} /></button>
                             </div>
                             <audio controls src={item.url} className="w-full h-8 block" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Other Documents */}
                    {media[viewingNote.subjectId].some(m => !['image', 'video', 'audio'].includes(m.type)) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {media[viewingNote.subjectId].filter(m => !['image', 'video', 'audio'].includes(m.type)).map(item => {
                            const style = getDocStyles(item.type);
                            return (
                              <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-200 transition-all group/doc">
                                <div className={`p-2.5 rounded-xl ${style.bg} ${style.color} shrink-0`}>{style.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <span className="block text-xs font-bold truncate text-slate-700">{item.name}</span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{item.type}</span>
                                </div>
                                {item.type === 'pdf' && (
                                   <button onClick={() => window.open(item.url, '_blank')} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all" title="View"><Eye size={18} /></button>
                                )}
                                <button onClick={() => handleDownload(item)} className="p-2 text-slate-300 hover:text-indigo-600 group-hover/doc:scale-110 transition-all"><Download size={18} /></button>
                              </div>
                            );
                         })}
                      </div>
                    )}
                  </div>
                )}
             </div>
          </div>
        </div>, document.body
      )}

      {(activeModal === 'add' || activeModal === 'edit') && activeSubject && (
        <NoteModal subjectId={activeSubject.id} dayNumber={selectedDay} subjectName={activeSubject.name} onClose={() => setActiveModal(null)} onSuccess={() => { setActiveModal(null); fetchWorkspaceData(true); }} initialData={notes[activeSubject.id] ? { title: notes[activeSubject.id].title, content: notes[activeSubject.id].content, media: media[activeSubject.id] || [] } : undefined} />
      )}

      {fullPreview && createPortal(
        <div className="fixed inset-0 z-[8000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in" onClick={() => setFullPreview(null)}>
          <button className="absolute top-8 right-8 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all z-[8010]"><X size={24} /></button>
          
          <div className="w-full h-full max-w-6xl flex flex-col items-center justify-center relative" onClick={e => e.stopPropagation()}>
            {fullPreview.type === 'image' && (
              <img src={fullPreview.url} className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" alt={fullPreview.name} />
            )}
            
            {fullPreview.type === 'video' && (
              <video src={fullPreview.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-xl shadow-2xl outline-none bg-black" />
            )}
            
            <div className="mt-8 flex gap-4 animate-in slide-in-from-bottom-4">
               <button onClick={() => handleDownload(fullPreview)} className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-xl hover:scale-105 active:scale-95">
                 <Download size={18} /> Download Original
               </button>
            </div>
          </div>
        </div>, 
        document.body
      )}
    </div>
  );
};