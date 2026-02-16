import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Video, 
  Mic, 
  Plus, 
  Loader2, 
  Trash2, 
  Square, 
  AlertCircle,
  FileText,
  Edit3,
  Camera,
  Upload,
  FileSpreadsheet,
  Presentation,
  RefreshCcw
} from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';

interface NoteModalProps {
  onClose: () => void;
  onSuccess: () => void;
  subjectId: string;
  dayNumber: number;
  subjectName: string;
  initialData?: {
    title: string;
    content: string;
    media: any[];
  };
}

interface SelectedMedia {
  file?: File;
  url?: string;
  type: 'image' | 'video' | 'audio' | 'pdf' | 'word' | 'excel' | 'ppt';
  preview: string;
  name?: string;
}

export const NoteModal: React.FC<NoteModalProps> = ({ 
  onClose, 
  onSuccess, 
  subjectId, 
  dayNumber, 
  subjectName, 
  initialData 
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaList, setMediaList] = useState<SelectedMedia[]>([]);
  const [removedMediaUrls, setRemovedMediaUrls] = useState<string[]>([]);

  // Camera & Recording States
  const [cameraActive, setCameraActive] = useState<'photo' | 'video' | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 50 * 1024 * 1024; 
  const BUCKET_NAME = 'course-multimedia';
  const DELIMITER = '||STUDYPRO_TITLE_END||';

  useEffect(() => {
    if (initialData?.media) {
      const existingMedia = initialData.media.map((item: any) => ({
        url: item.url,
        type: item.type,
        preview: item.url,
        name: item.name
      }));
      setMediaList(existingMedia);
    }
    return () => stopCamera();
  }, [initialData]);

  useEffect(() => {
    if (cameraActive && cameraStream && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = cameraStream;
    }
  }, [cameraActive, cameraStream]);

  // Camera Logic
  const startCamera = async (mode: 'photo' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, 
        audio: mode === 'video' 
      });
      setCameraStream(stream);
      setCameraActive(mode);
    } catch (err: any) {
      setError('Could not access camera: ' + err.message);
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
      setError('Could not access camera: ' + err.message);
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
        setMediaList(prev => [...prev, {
          file,
          type: 'image',
          preview: URL.createObjectURL(blob),
          name: file.name
        }]);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const startVideoRecording = () => {
    if (!cameraStream) return;
    const recorder = new MediaRecorder(cameraStream, { mimeType: 'video/webm;codecs=vp8,opus' });
    videoRecorderRef.current = recorder;
    videoChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      setMediaList(prev => [...prev, {
        file,
        type: 'video',
        preview: URL.createObjectURL(blob),
        name: file.name
      }]);
      stopCamera();
    };
    recorder.start(1000); 
    setIsRecordingVideo(true);
  };

  const stopVideoRecording = () => {
    videoRecorderRef.current?.stop();
  };

  // Audio Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setMediaList(prev => [...prev, {
          file,
          type: 'audio',
          preview: URL.createObjectURL(audioBlob),
          name: file.name
        }]);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (err: any) {
      setError('Could not access microphone: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // File Handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newMediaItems: SelectedMedia[] = [];
    (Array.from(files) as File[]).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} exceeds 50MB limit.`);
        return;
      }

      let type: SelectedMedia['type'] = 'image';
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (ext === 'pdf') type = 'pdf';
      else if (['doc', 'docx'].includes(ext || '')) type = 'word';
      else if (['xls', 'xlsx', 'csv'].includes(ext || '')) type = 'excel';
      else if (['ppt', 'pptx'].includes(ext || '')) type = 'ppt';
      else {
        setError(`${file.name}: Unsupported file type.`);
        return;
      }

      newMediaItems.push({
        file,
        type,
        preview: ['image', 'video'].includes(type) ? URL.createObjectURL(file) : '',
        name: file.name
      });
    });

    setMediaList(prev => [...prev, ...newMediaItems]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeMedia = (index: number) => {
    const item = mediaList[index];
    if (item.url) {
      setRemovedMediaUrls(prev => [...prev, item.url!]);
    } else if (item.preview) {
      URL.revokeObjectURL(item.preview);
    }
    setMediaList(prev => prev.filter((_, i) => i !== index));
  };

  const extractPathFromUrl = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      // Split by bucket name to isolate the path relative to the bucket
      const parts = url.pathname.split(`/${BUCKET_NAME}/`);
      if (parts.length < 2) return null;
      // The path is everything after the bucket name segment
      // Decode URI component to handle spaces/special chars converted to %20 etc
      return decodeURIComponent(parts[1]);
    } catch (e) {
      console.error('Error extracting path from URL:', e);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // 1. Save Note Text
      const combinedContent = `${title}${DELIMITER}${content}`;
      const payload = {
        user_id: userData.user.id,
        subject_id: subjectId,
        day_number: dayNumber,
        content: combinedContent
      };
      
      const { error: noteError } = await supabase
        .from('notes')
        .upsert(payload, { onConflict: 'user_id,subject_id,day_number' });

      if (noteError) throw noteError;

      // 2. Upload New Media
      for (const item of mediaList) {
        if (!item.url && item.file) {
          const originalName = item.file.name;
          const fileExt = originalName.split('.').pop() || '';
          // Use workspace folder structure to match existing
          const path = `workspace/${userData.user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, item.file);
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
          
          await supabase.from('course_media').insert({
            user_id: userData.user.id,
            subject_id: subjectId,
            day_number: dayNumber,
            url: publicUrl,
            type: item.type,
            name: originalName
          });
        }
      }

      // 3. Remove Deleted Media
      if (removedMediaUrls.length > 0) {
        // Delete from Storage first
        const pathsToDelete = removedMediaUrls
          .map(url => extractPathFromUrl(url))
          .filter((path): path is string => !!path);

        if (pathsToDelete.length > 0) {
          const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove(pathsToDelete);
          if (storageError) console.error('Error deleting from storage:', storageError);
        }

        // Delete from DB
        await supabase.from('course_media').delete().in('url', removedMediaUrls);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <>
      <style>{`
        .modal-scrollbar::-webkit-scrollbar { width: 6px; }
        .modal-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .modal-scrollbar::-webkit-scrollbar-thumb { background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; }
        .modal-scrollbar { scrollbar-width: thin; scrollbar-color: white transparent; }
      `}</style>

      {cameraActive && (
        <div className="fixed inset-0 z-[6200] bg-black flex flex-col items-center justify-center overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <button type="button" onClick={stopCamera} className="absolute top-8 right-8 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-xl border border-white/10 active:scale-90 z-[6220]">
            <X size={28} />
          </button>
          <button type="button" onClick={switchCamera} className="absolute top-8 left-8 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all backdrop-blur-xl border border-white/10 active:scale-90 z-[6220]">
            <RefreshCcw size={28} />
          </button>
          <div className="w-full h-full flex items-center justify-center">
            <video ref={videoPreviewRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
          </div>
          <div className="absolute bottom-16 flex flex-col items-center gap-8 z-[6220] w-full px-6">
            {cameraActive === 'video' && isRecordingVideo && (
              <div className="flex items-center gap-3 bg-red-600 text-white px-6 py-2 rounded-full text-xs font-bold animate-pulse shadow-2xl">
                <div className="w-2 h-2 bg-white rounded-full" /> Recording Active
              </div>
            )}
            <div className="flex items-center justify-center w-full">
              {cameraActive === 'photo' ? (
                <button type="button" onClick={capturePhoto} className="w-24 h-24 bg-red-600 rounded-full border-[6px] border-white active:scale-90 transition-all shadow-2xl" />
              ) : (
                <button type="button" onClick={isRecordingVideo ? stopVideoRecording : startVideoRecording} className={`w-24 h-24 rounded-full border-[6px] border-white active:scale-90 transition-all shadow-2xl ${isRecordingVideo ? 'bg-white' : 'bg-red-600'}`}>
                  {isRecordingVideo && <Square size={36} className="text-red-600 mx-auto" fill="currentColor" />}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 relative">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600">
                {initialData ? <Edit3 size={24} /> : <Plus size={24} />}
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{initialData ? 'Edit Note' : 'Create Note'}</h2>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subjectName} • Day {dayNumber}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 modal-scrollbar">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-5 rounded-[1.5rem] flex items-center gap-3 text-sm font-semibold animate-in zoom-in-95">
                <AlertCircle size={20} /> {error}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 ml-1">Title</label>
              <input required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-50 focus:bg-white outline-none transition-all font-bold text-slate-900 shadow-sm" placeholder="Session title..." value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 ml-1">Note Content</label>
              <textarea required rows={8} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-50 focus:bg-white outline-none transition-all text-base font-normal resize-none leading-relaxed text-slate-900 shadow-sm" placeholder="Write your notes here..." value={content} onChange={e => setContent(e.target.value)} />
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-bold text-slate-500">Multimedia Vault</label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{mediaList.length} Items</span>
              </div>
              
              {mediaList.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {mediaList.map((item, idx) => (
                    <div key={idx} className="group relative aspect-square rounded-[1.5rem] overflow-hidden border border-slate-200 bg-slate-50 animate-in zoom-in-95 shadow-sm transition-transform hover:scale-[1.02]">
                      {item.type === 'image' && <img src={item.preview} className="w-full h-full object-cover" alt="Preview" />}
                      {item.type === 'video' && (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-900 text-white">
                          <Video size={28} className="mb-2 opacity-50" />
                          <span className="text-[10px] font-semibold truncate w-full text-center">{item.name}</span>
                        </div>
                      )}
                      {['pdf', 'word', 'excel', 'ppt'].includes(item.type) && (
                        <div className={`w-full h-full flex flex-col items-center justify-center p-4 ${item.type === 'word' ? 'bg-blue-50 text-blue-700' : item.type === 'excel' ? 'bg-green-50 text-green-700' : item.type === 'ppt' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                          {item.type === 'word' ? <FileText size={28} /> : item.type === 'excel' ? <FileSpreadsheet size={28} /> : item.type === 'ppt' ? <Presentation size={28} /> : <FileText size={28} />}
                          <span className="text-[10px] font-semibold truncate w-full text-center mt-2 px-2">{item.name}</span>
                        </div>
                      )}
                      {item.type === 'audio' && (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-indigo-600 text-white">
                          <Mic size={28} className="mb-2 opacity-50" />
                          <span className="text-[10px] font-semibold">{item.name}</span>
                        </div>
                      )}
                      <button type="button" onClick={() => removeMedia(idx)} className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => startCamera('photo')} className="w-full h-14 flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all font-bold text-xs active:scale-95 shadow-sm">
                  <Camera size={18} className="text-indigo-500" /> Photo
                </button>
                
                {isRecording ? (
                  <button type="button" onClick={stopRecording} className="w-full h-14 flex items-center justify-center gap-3 bg-red-50 border border-red-100 text-red-600 rounded-2xl animate-pulse font-bold text-xs shadow-sm">
                    <Square size={18} /> Stop ({formatDuration(recordingDuration)})
                  </button>
                ) : (
                  <button type="button" onClick={startRecording} className="w-full h-14 flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all font-bold text-xs active:scale-95 shadow-sm">
                    <Mic size={18} className="text-red-500" /> Voice Note
                  </button>
                )}

                <button type="button" onClick={() => startCamera('video')} className="w-full h-14 flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all font-bold text-xs active:scale-95 shadow-sm">
                  <Video size={18} className="text-indigo-500" /> Video
                </button>

                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-14 flex items-center justify-center gap-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold text-xs shadow-lg active:scale-95">
                  <Upload size={18} /> Upload Files
                </button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv" onChange={handleFileChange} />
            </div>

            <div className="pt-8 flex gap-4 sticky bottom-0 bg-white/80 backdrop-blur-sm pb-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 bg-slate-50 text-slate-500 font-bold rounded-[1.5rem] hover:bg-slate-100 transition-all">Discard</button>
              <button type="submit" disabled={loading || (!title && !content)} className="flex-[2.5] py-4 bg-indigo-600 text-white font-bold rounded-[1.5rem] shadow-2xl hover:bg-indigo-700 transition-all active:scale-[0.98]">
                {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Save Note'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
};