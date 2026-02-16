import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Loader2, 
  MessageCircle, 
  Mic, 
  Image as ImageIcon, 
  SendHorizontal, 
  ChevronLeft, 
  GraduationCap, 
  Square, 
  RefreshCw,
  Info,
  User,
  Clock,
  CheckCheck,
  X,
  Upload,
  Trash2,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Video,
  Maximize2,
  Download,
  AlertTriangle,
  RefreshCcw,
  Globe,
  Camera
} from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';

interface UserProfile { 
  id: string; 
  full_name: string | null; 
  avatar_url: string | null; 
  coursename: string | null; 
  introduction: string | null; 
  latest_message_at?: string; 
  unread_count?: number; 
}

interface Message { 
  id: string; 
  sender_id: string; 
  receiver_id: string; 
  content: string; 
  media_url?: string; 
  media_type?: 'image' | 'video' | 'audio' | 'pdf' | 'word' | 'excel' | 'ppt'; 
  name?: string;
  created_at: string; 
  is_read: boolean; 
}

interface StagedMedia {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'word' | 'excel' | 'ppt';
  name: string;
}

interface ConnectionsSubTabProps {
  currentUserId: string | null;
  initialChatUserId?: string | null;
  onClearInitialChatUser?: () => void;
}

export const ConnectionsSubTab: React.FC<ConnectionsSubTabProps> = ({ 
  currentUserId, 
  initialChatUserId,
  onClearInitialChatUser 
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChatUser, setSelectedChatUser] = useState<UserProfile | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  
  const [stagedMedia, setStagedMedia] = useState<StagedMedia[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  
  const [cameraActive, setCameraActive] = useState<'photo' | 'video' | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  
  const [fullMediaPreview, setFullMediaPreview] = useState<{url: string, type: string} | null>(null);
  
  // Scroll Awareness for Mobile
  const [showSearch, setShowSearch] = useState(true);
  const [showChatHeader, setShowChatHeader] = useState(true);
  const lastScrollY = useRef(0);
  const lastChatScrollY = useRef(0);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);

  const BUCKET_NAME = 'chat-media';

  useEffect(() => {
    if (selectedChatUser) {
      localStorage.setItem('studypro_active_chat_user_id', selectedChatUser.id);
      setShowChatHeader(true); // Reset header visibility when opening new chat
    } else {
      localStorage.removeItem('studypro_active_chat_user_id');
      setShowSearch(true); // Reset search header when going back to list
    }
  }, [selectedChatUser]);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 768) {
      if (!showSearch) setShowSearch(true);
      return;
    }
    const currentScrollY = e.currentTarget.scrollTop;
    const { scrollHeight, clientHeight } = e.currentTarget;
    
    // Ignore negative scroll (bounce top)
    if (currentScrollY < 0) return;
    
    // Ignore bounce bottom (scrolling past content)
    if (currentScrollY + clientHeight > scrollHeight + 50) return;

    if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

    const isScrollingDown = currentScrollY > lastScrollY.current;
    const distFromBottom = scrollHeight - clientHeight - currentScrollY;

    // Hide header when scrolling down past 100px
    if (isScrollingDown && currentScrollY > 100) {
      setShowSearch(false);
    } 
    // Only show header if scrolling up AND not in the bottom bounce zone (>100px from bottom)
    else if (!isScrollingDown && distFromBottom > 100) {
      setShowSearch(true);
    }
    lastScrollY.current = currentScrollY;
  };

  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 768) {
      if (!showChatHeader) setShowChatHeader(true);
      return;
    }
    const currentScrollY = e.currentTarget.scrollTop;
    const { scrollHeight, clientHeight } = e.currentTarget;
    
    // Ignore negative scroll (bounce top)
    if (currentScrollY < 0) return;

    // Ignore bounce bottom
    if (currentScrollY + clientHeight > scrollHeight + 50) return;

    if (Math.abs(currentScrollY - lastChatScrollY.current) < 10) return;

    const isScrollingDown = currentScrollY > lastChatScrollY.current;
    const distFromBottom = scrollHeight - clientHeight - currentScrollY;

    // Hide header when scrolling down past 100px
    if (isScrollingDown && currentScrollY > 100) {
      setShowChatHeader(false);
    } 
    // Only show header if scrolling up AND not in the bottom bounce zone (>100px from bottom)
    else if (!isScrollingDown && distFromBottom > 100) {
      setShowChatHeader(true);
    }
    lastChatScrollY.current = currentScrollY;
  };

  const fetchUsers = async (isSilent = false) => {
    if (!currentUserId) return;
    if (refreshing) return;

    if (isSilent) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, coursename, introduction');
        
      const { data: msgs = [] } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, created_at, is_read')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);
      
      const processed = (profiles || []).map(p => {
        const convo = (msgs || []).filter(m => 
          (m.sender_id === currentUserId && m.receiver_id === p.id) || 
          (m.sender_id === p.id && m.receiver_id === currentUserId)
        );
        
        const latest = convo.length > 0 
          ? convo.reduce((prev, curr) => new Date(curr.created_at) > new Date(prev.created_at) ? curr : prev).created_at 
          : null;
        
        const unread = (msgs || []).filter(m => 
          m.sender_id === p.id && 
          m.receiver_id === currentUserId && 
          m.is_read === false
        ).length;
        
        return { ...p, latest_message_at: latest, unread_count: unread };
      });

      const sortedUsers = processed.sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        if (a.latest_message_at && b.latest_message_at) {
          return new Date(b.latest_message_at).getTime() - new Date(a.latest_message_at).getTime();
        }
        if (a.latest_message_at) return -1;
        if (b.latest_message_at) return 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });

      setUsers(sortedUsers);

      const savedChatId = localStorage.getItem('studypro_active_chat_user_id');
      if (savedChatId && !selectedChatUser && !initialChatUserId) {
        const savedUser = sortedUsers.find(u => u.id === savedChatId);
        if (savedUser) setSelectedChatUser(savedUser);
      }
    } catch (err) { console.error('Error fetching users:', err); } 
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { if (currentUserId) fetchUsers(false); }, [currentUserId]);

  useEffect(() => {
    if (initialChatUserId && users.length > 0) {
      const target = users.find(u => u.id === initialChatUserId);
      if (target && selectedChatUser?.id !== target.id) {
        setSelectedChatUser(target);
      }
    }
  }, [initialChatUserId, users]);

  const fetchMessages = async () => {
    if (!currentUserId || !selectedChatUser) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedChatUser.id}),and(sender_id.eq.${selectedChatUser.id},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });
      
      const uniqueMessages = (data || []);
      setMessages(uniqueMessages);
      
      if (selectedChatUser.id !== currentUserId) {
        const unreadMessages = uniqueMessages.filter(m => m.sender_id === selectedChatUser.id && !m.is_read);
        if (unreadMessages.length > 0) {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('sender_id', selectedChatUser.id)
            .eq('receiver_id', currentUserId)
            .eq('is_read', false);
          
          window.dispatchEvent(new CustomEvent('studypro:refresh_notifications'));
          setUsers(prev => prev.map(u => u.id === selectedChatUser.id ? { ...u, unread_count: 0 } : u));
        }
      }
      
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { 
    if (selectedChatUser && currentUserId) { 
      fetchMessages(); 
      
      const channel = supabase
        .channel(`chat_${currentUserId}_${selectedChatUser.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`
        }, (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.sender_id === selectedChatUser.id) {
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } 
  }, [selectedChatUser, currentUserId]);

  useEffect(() => { 
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages]);

  const handleClearChat = async () => {
    if (!currentUserId || !selectedChatUser || clearing) return;
    setClearing(true);
    try {
      const { data: mediaMessages } = await supabase
        .from('messages')
        .select('media_url')
        .eq('sender_id', currentUserId)
        .eq('receiver_id', selectedChatUser.id)
        .not('media_url', 'is', null);

      if (mediaMessages && mediaMessages.length > 0) {
        const pathsToDelete = mediaMessages
          .map(m => {
            const url = new URL(m.media_url!);
            const parts = url.pathname.split(`/${BUCKET_NAME}/`);
            return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
          })
          .filter((p): p is string => !!p);

        if (pathsToDelete.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(pathsToDelete);
        }
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', currentUserId)
        .eq('receiver_id', selectedChatUser.id);
      
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.sender_id !== currentUserId));
      setShowDeleteConfirm(false);
    } catch (err: any) {
      alert("Failed to delete sent messages: " + err.message);
    } finally {
      setClearing(false);
    }
  };

  const startCamera = async (mode: 'photo' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, 
        audio: mode === 'video' 
      });
      setCameraStream(stream);
      setCameraActive(mode);
    } catch (err: any) {
      alert('Could not access camera: ' + err.message);
    }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: newMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, 
        audio: cameraActive === 'video' 
      });
      setCameraStream(stream);
    } catch (err: any) {
      alert('Could not access camera: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(null);
    setIsRecordingVideo(false);
    setFacingMode('user');
  };

  const capturePhoto = () => {
    if (!videoPreviewRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoPreviewRef.current.videoWidth;
    canvas.height = videoPreviewRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Mirror if using front camera
    if (facingMode === 'user') {
      ctx?.translate(canvas.width, 0);
      ctx?.scale(-1, 1);
    }

    ctx?.drawImage(videoPreviewRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setStagedMedia(prev => [...prev, {
          file,
          name: file.name,
          type: 'image',
          preview: URL.createObjectURL(blob)
        }]);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const startVideoRecording = () => {
    if (!cameraStream) return;
    const recorder = new MediaRecorder(cameraStream, { mimeType: 'video/webm' });
    videoRecorderRef.current = recorder;
    videoChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      setStagedMedia(prev => [...prev, {
        file,
        name: file.name,
        type: 'video',
        preview: URL.createObjectURL(blob)
      }]);
      stopCamera();
    };
    recorder.start(1000); 
    setIsRecordingVideo(true);
  };

  const stopVideoRecording = () => {
    videoRecorderRef.current?.stop();
  };

  const handleDownload = async (url: string, filename: string = 'file') => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url, '_blank');
    }
  };

  useEffect(() => {
    if (cameraActive && cameraStream && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = cameraStream;
    }
  }, [cameraActive, cameraStream]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newStaged: StagedMedia[] = [];
    (Array.from(files) as File[]).forEach(file => {
      let type: StagedMedia['type'] = 'pdf';
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (ext === 'pdf') type = 'pdf';
      else if (['doc', 'docx'].includes(ext || '')) type = 'word';
      else if (['xls', 'xlsx', 'csv'].includes(ext || '')) type = 'excel';
      else if (['ppt', 'pptx'].includes(ext || '')) type = 'ppt';

      newStaged.push({
        file,
        name: file.name,
        type,
        preview: ['image', 'video'].includes(type) ? URL.createObjectURL(file) : ''
      });
    });
    setStagedMedia(prev => [...prev, ...newStaged]);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const removeStaged = (index: number) => {
    const item = stagedMedia[index];
    if (item.preview) URL.revokeObjectURL(item.preview);
    setStagedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && stagedMedia.length === 0) || !currentUserId || !selectedChatUser || sending) return;
    setSending(true);
    try {
      if (newMessage.trim()) {
        const { data: textMsg, error: textErr } = await supabase.from('messages').insert({
          sender_id: currentUserId,
          receiver_id: selectedChatUser.id,
          content: newMessage.trim(),
          is_read: selectedChatUser.id === currentUserId
        }).select().single();
        if (textErr) throw textErr;
        setMessages(prev => [...prev, textMsg]);
        setNewMessage('');
      }

      for (const item of stagedMedia) {
        const ext = item.name.split('.').pop();
        const path = `chat/${currentUserId}/${Date.now()}-${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, item.file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
        const { data: mediaMsg, error: mediaErr } = await supabase.from('messages').insert({
          sender_id: currentUserId,
          receiver_id: selectedChatUser.id,
          content: `Shared ${item.type}`,
          media_url: publicUrl,
          media_type: item.type,
          name: item.name,
          is_read: selectedChatUser.id === currentUserId
        }).select().single();
        if (mediaErr) throw mediaErr;
        setMessages(prev => [...prev, mediaMsg]);
      }
      setStagedMedia([]);
    } catch (err: any) {
      alert("Send failed: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setStagedMedia(prev => [...prev, {
          file,
          name: file.name,
          type: 'audio',
          preview: ''
        }]);
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = window.setInterval(() => setRecordTime(p => p + 1), 1000);
    } catch { alert("Microphone access denied."); }
  };

  const stopRecord = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const getDocStyles = (type: Message['media_type']) => {
    switch (type) {
      case 'word': return { icon: <FileText size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' };
      case 'excel': return { icon: <FileSpreadsheet size={18} />, color: 'text-green-600', bg: 'bg-green-50' };
      case 'ppt': return { icon: <Presentation size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' };
      case 'pdf': return { icon: <FileText size={18} />, color: 'text-red-600', bg: 'bg-red-50' };
      default: return { icon: <FileCode size={18} />, color: 'text-slate-600', bg: 'bg-slate-50' };
    }
  };

  const filtered = users.filter(u => (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.coursename?.toLowerCase().includes(searchQuery.toLowerCase())));
  const me = filtered.find(u => u.id === currentUserId);
  const others = filtered.filter(u => u.id !== currentUserId);

  const renderUserCard = (user: UserProfile, isMe: boolean) => (
    <div 
      key={user.id} 
      className={`p-3.5 rounded-[1.5rem] border shadow-sm flex items-center gap-4 group hover:shadow-lg transition-all duration-300 relative overflow-hidden ${
        isMe 
          ? 'bg-indigo-50 border-indigo-200' 
          : 'bg-white border-slate-100 border-l-4 border-l-indigo-400'
      }`}
    >
      <div className="relative shrink-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-indigo-600 overflow-hidden border ${isMe ? 'bg-white border-indigo-100' : 'bg-white border-slate-100'}`}>
          {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="S" /> : <User size={18} className="opacity-40" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <h3 className="text-[14px] font-bold truncate text-slate-900 leading-none">
            {user.full_name} {isMe && <span className="text-indigo-600 text-[10px] ml-1 font-bold">(You)</span>}
          </h3>
          {!isMe && (user.unread_count ?? 0) > 0 && (
            <span className="bg-indigo-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full animate-pulse">New Message</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[9px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full w-fit mb-0 shadow-sm">
          <GraduationCap size={10} />
          {user.coursename || 'No course joined'}
        </div>
      </div>
      <button 
        onClick={() => setSelectedChatUser(user)} 
        className="p-3 rounded-xl shadow-lg transition-all active:scale-95 shrink-0 bg-slate-900 text-white hover:bg-indigo-600"
        title={isMe ? "Open Workspace" : "Chat with Peer"}
      >
        <MessageCircle size={16} />
      </button>
    </div>
  );

  return (
    <div className="h-full relative flex flex-col animate-in fade-in duration-500 overflow-hidden">
      {fullMediaPreview && (
        <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setFullMediaPreview(null)}>
          <button className="absolute top-8 right-8 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all z-[1010]">
            <X size={28} />
          </button>
          <div className="max-w-5xl w-full h-full flex flex-col items-center justify-center relative" onClick={e => e.stopPropagation()}>
            {fullMediaPreview.type === 'image' && (
              <img src={fullMediaPreview.url} className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" alt="Large View" />
            )}
            {fullMediaPreview.type === 'video' && (
              <video src={fullMediaPreview.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl" />
            )}
            <div className="mt-8 flex gap-4">
              <button 
                onClick={() => handleDownload(fullMediaPreview.url, `studypro-media-${Date.now()}`)}
                className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-bold text-sm uppercase tracking-widest flex items-center gap-2 hover:bg-slate-100 transition-all"
              >
                <Download size={18} /> Download
              </button>
            </div>
          </div>
        </div>
      )}

      {showIntro && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setShowIntro(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="absolute top-6 right-6 z-10">
              <button onClick={() => setShowIntro(false)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-all active:scale-90">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 md:p-10 text-center">
              <Info size={48} strokeWidth={1.5} className="text-indigo-600 mb-6 mx-auto" />
              <h3 className="text-lg font-normal text-slate-900 mb-2">Introduction</h3>
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar">
                <p className="text-sm font-normal leading-relaxed text-slate-700">
                  {selectedChatUser?.introduction || "This peer has not shared an introduction yet."}
                </p>
              </div>
              <button onClick={() => setShowIntro(false)} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:bg-indigo-700 transition-all mt-4 active:scale-95">I Understand</button>
            </div>
          </div>
        </div>
      )}

      {cameraActive && (
        <div className="fixed inset-0 z-[1200] bg-black flex flex-col items-center justify-center overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <button type="button" onClick={stopCamera} className="absolute top-8 right-8 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-xl border border-white/10 active:scale-90 z-[1220]">
            <X size={28} />
          </button>
          <button type="button" onClick={switchCamera} className="absolute top-8 left-8 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-xl border border-white/10 active:scale-90 z-[1220]">
            <RefreshCcw size={28} />
          </button>
          <video ref={videoPreviewRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
          <div className="absolute bottom-16 flex flex-col items-center gap-8 z-[1220] w-full px-6">
            {cameraActive === 'video' && isRecordingVideo && (
              <div className="flex items-center gap-3 bg-red-600 text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] animate-pulse shadow-2xl">
                <div className="w-2 h-2 bg-white rounded-full" /> Recording Active
              </div>
            )}
            {cameraActive === 'photo' ? (
              <button type="button" onClick={capturePhoto} className="w-24 h-24 bg-red-600 rounded-full border-[6px] border-white active:scale-90 transition-all shadow-2xl" />
            ) : (
              <button type="button" onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording} className={`w-24 h-24 rounded-full border-[6px] border-white active:scale-90 transition-all shadow-2xl ${isRecordingVideo ? 'bg-white' : 'bg-red-600'}`}>
                {isRecordingVideo && <Square size={32} className="text-red-600 mx-auto" fill="currentColor" />}
              </button>
            )}
          </div>
        </div>
      )}

      {!selectedChatUser ? (
        <>
          <div className={`max-w-4xl mx-auto w-full px-2 md:px-0 bg-white transition-all duration-300 ease-in-out origin-top shrink-0 ${
            showSearch ? 'max-h-24 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0 overflow-hidden'
          }`}>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Search by peer name or course..." 
                  className="w-full pl-14 pr-4 py-3.5 bg-white border border-slate-200 rounded-full outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all text-sm font-medium text-slate-900 shadow-sm" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                />
              </div>
              <button onClick={() => fetchUsers(true)} className="p-3.5 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 shadow-sm transition-all shrink-0">
                <RefreshCw size={22} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          <div 
            onScroll={handleListScroll}
            className="flex-1 overflow-y-auto custom-scrollbar px-2 md:px-0 pb-12"
          >
            <div className="max-w-4xl mx-auto w-full space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  {me && <div className="space-y-3">{renderUserCard(me, true)}</div>}
                  <div className="space-y-3">
                    <h4 className="text-[14px] font-bold text-slate-700 px-1 flex items-center gap-2"><Globe size={14} /> Community Peers</h4>
                    {others.length > 0 ? others.map(u => renderUserCard(u, false)) : <div className="bg-sky-50/20 border border-slate-100 rounded-[2rem] py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No other peers found</div>}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col relative bg-white border border-slate-200 rounded-[2rem] shadow-sm animate-in slide-in-from-right duration-400 overflow-hidden my-2 md:my-0">
          {showDeleteConfirm && (
            <div className="absolute inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200 border border-slate-50 relative overflow-hidden">
                <AlertTriangle size={32} className="text-red-500 mx-auto mb-6" />
                <h3 className="text-xl font-black text-slate-900 mb-2">Delete History?</h3>
                <p className="text-slate-500 text-xs font-bold mb-8 leading-relaxed uppercase tracking-wider">All messages you have sent in this conversation will be permanently removed.</p>
                <div className="flex flex-col gap-3">
                  <button onClick={handleClearChat} disabled={clearing} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-3">
                    {clearing ? <Loader2 size={18} className="animate-spin" /> : <><Trash2 size={18} /> Clear My Messages</>}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)} disabled={clearing} className="w-full py-4 bg-slate-50 text-slate-500 font-black text-[11px] uppercase tracking-widest rounded-2xl">Cancel</button>
                </div>
              </div>
            </div>
          )}
          
          <div className={`border-b border-slate-100 flex items-center px-4 md:px-8 gap-3 md:gap-4 bg-white/95 backdrop-blur-sm z-10 shrink-0 transition-all duration-300 ease-in-out origin-top ${
            showChatHeader ? 'h-16 md:h-20 opacity-100' : 'h-0 opacity-0 overflow-hidden border-b-0'
          }`}>
            <button onClick={() => { setSelectedChatUser(null); onClearInitialChatUser?.(); fetchUsers(true); }} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><ChevronLeft size={24} /></button>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 overflow-hidden border border-white shadow-sm shrink-0">
              {selectedChatUser.avatar_url ? <img src={selectedChatUser.avatar_url} className="w-full h-full object-cover" alt="S" /> : <User size={20} className="opacity-40" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-bold truncate text-slate-900 leading-tight">{selectedChatUser.full_name} {selectedChatUser.id === currentUserId && '(Me)'}</h3>
              <p className="text-[10px] font-bold text-indigo-600 tracking-widest truncate">{selectedChatUser.coursename || 'No course joined'}</p>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
                <button onClick={() => setShowDeleteConfirm(true)} className="p-2.5 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Clear History"><Trash2 size={20} /></button>
                <button onClick={() => setShowIntro(true)} className="p-2.5 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"><Info size={20} /></button>
            </div>
          </div>
          
          <div 
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 custom-scrollbar bg-[#fbfcfe]"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-30 select-none">
                <MessageCircle size={64} strokeWidth={1} className="mb-4" />
                <p className="text-sm font-bold tracking-[0.2em]">No messages yet</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === currentUserId;
                const isAudio = m.media_type === 'audio';
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`shadow-sm relative ${isAudio ? 'overflow-visible' : 'overflow-hidden'} ${
                        isMe 
                          ? 'bg-indigo-600 text-white rounded-[1.5rem] rounded-br-none' 
                          : 'bg-white text-slate-700 border border-slate-100 rounded-[1.5rem] rounded-bl-none'
                      }`}>
                        {m.media_url && (
                          <div className="p-1 relative">
                            {m.media_type === 'image' && (
                              <div className="rounded-2xl overflow-hidden bg-slate-100 relative group/media max-h-48 md:h-48 w-full md:w-64">
                                  <img src={m.media_url} className="w-full h-full object-cover block" alt="Shared" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                    <button onClick={() => setFullMediaPreview({url: m.media_url!, type: 'image'})} className="p-2 bg-white text-slate-900 rounded-xl hover:scale-110 transition-transform"><Maximize2 size={16} /></button>
                                    <button onClick={() => handleDownload(m.media_url!, `image-${Date.now()}`)} className="p-2 bg-indigo-600 text-white rounded-xl hover:scale-110 transition-transform"><Download size={16} /></button>
                                  </div>
                              </div>
                            )}
                            {m.media_type === 'video' && (
                              <div className="rounded-2xl overflow-hidden bg-black relative group/media h-48 w-full md:w-64">
                                  <video src={m.media_url} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                    <button onClick={() => setFullMediaPreview({url: m.media_url!, type: 'video'})} className="p-2 bg-white text-slate-900 rounded-xl hover:scale-110 transition-transform"><Maximize2 size={16} /></button>
                                    <button onClick={() => handleDownload(m.media_url!, `video-${Date.now()}`)} className="p-2 bg-indigo-600 text-white rounded-xl hover:scale-110 transition-transform"><Download size={16} /></button>
                                  </div>
                              </div>
                            )}
                            {m.media_type === 'audio' && (
                              <div className={`p-4 rounded-2xl flex flex-col gap-2 min-w-[280px] md:min-w-[340px] ${isMe ? 'bg-indigo-500/50' : 'bg-slate-50'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Mic size={14} className={isMe ? 'text-indigo-100' : 'text-indigo-600'} />
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isMe ? 'text-indigo-100' : 'text-indigo-600'}`}>Voice Note</span>
                                  </div>
                                  <button onClick={() => handleDownload(m.media_url!, `voice-${Date.now()}`)} className="text-current opacity-60 hover:opacity-100"><Download size={14} /></button>
                                </div>
                                <audio src={m.media_url} controls className={`h-8 w-full ${isMe ? 'invert' : ''}`} />
                              </div>
                            )}
                            {['pdf', 'word', 'excel', 'ppt'].includes(m.media_type || '') && (
                                <div className={`p-4 rounded-2xl flex items-center gap-3 ${isMe ? 'bg-indigo-500/50' : 'bg-slate-50'}`}>
                                  <div className={`p-2.5 rounded-xl bg-white shadow-sm shrink-0 ${getDocStyles(m.media_type).color}`}>{getDocStyles(m.media_type).icon}</div>
                                  <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-bold truncate ${isMe ? 'text-white' : 'text-slate-900'}`}>{m.name || 'File'}</p>
                                  </div>
                                  <button onClick={() => handleDownload(m.media_url!, m.name || 'file')} className="text-current opacity-60 hover:opacity-100"><Download size={14} /></button>
                                </div>
                            )}
                          </div>
                        )}
                        {m.content && !m.content.startsWith('Shared ') && <p className="px-4 md:px-6 py-3 text-[13px] md:text-sm font-semibold leading-relaxed break-words">{m.content}</p>}
                      </div>
                      <div className={`flex items-center gap-2 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && m.is_read && <CheckCheck size={11} className="text-indigo-500" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          
          <div className="p-3 md:p-6 border-t border-slate-100 bg-white shrink-0">
            {stagedMedia.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-4 mb-2 custom-scrollbar">
                {stagedMedia.map((item, idx) => (
                  <div key={idx} className="relative w-14 h-14 md:w-16 md:h-16 rounded-xl bg-slate-50 border border-slate-100 shrink-0 overflow-hidden group shadow-sm">
                    {item.type === 'image' ? <img src={item.preview} className="w-full h-full object-cover" /> :
                      item.type === 'video' ? <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white/40"><Video size={18} /></div> :
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-indigo-600"><FileText size={18} /></div>
                    }
                    <button onClick={() => removeStaged(idx)} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg"><Trash2 size={8} /></button>
                  </div>
                ))}
              </div>
            )}
            {isRecording ? (
              <div className="flex items-center justify-between bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-[1.5rem] animate-pulse">
                <span className="font-bold text-[10px] uppercase tracking-[0.2em]">Voice Recording: {recordTime}s</span>
                <button onClick={stopRecord} className="p-3 bg-red-600 text-white rounded-2xl"><Square size={18} fill="currentColor" /></button>
              </div>
            ) : (
              <div className="flex gap-1.5 md:gap-4 items-center w-full">
                <div className="flex items-center gap-0 md:gap-1">
                  <button type="button" onClick={() => mediaInputRef.current?.click()} className="p-1.5 md:p-2.5 text-slate-400 hover:text-indigo-600 transition-all"><Upload size={18} /></button>
                  <button type="button" onClick={() => startCamera('photo')} className="p-1.5 md:p-2.5 text-slate-400 hover:text-indigo-600 transition-all"><Camera size={18} /></button>
                  <button type="button" onClick={() => startCamera('video')} className="p-1.5 md:p-2.5 text-slate-400 hover:text-indigo-600 transition-all"><Video size={18} /></button>
                  <button type="button" onClick={startRecord} className="p-1.5 md:p-2.5 text-slate-400 hover:text-red-500 transition-all"><Mic size={18} /></button>
                </div>
                <div className="flex-1 flex gap-2 items-center min-w-0">
                  <input type="text" className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-[1.5rem] px-4 py-2.5 md:py-4 outline-none focus:bg-white focus:border-indigo-400 transition-all text-sm font-bold text-slate-900" placeholder="Type message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} />
                  <button onClick={handleSend} disabled={sending || (!newMessage.trim() && stagedMedia.length === 0)} className="w-11 h-11 md:w-14 md:h-14 bg-indigo-600 text-white rounded-full md:rounded-[1.5rem] shadow-xl hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center shrink-0">
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
                  </button>
                  <input type="file" ref={mediaInputRef} hidden multiple accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv" onChange={handleFileSelect} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};