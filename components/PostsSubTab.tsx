import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Loader2, 
  Plus, 
  RefreshCw, 
  Search, 
  MessageSquarePlus, 
  User, 
  Trash2, 
  Edit3, 
  Maximize2, 
  Video,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Presentation, 
  FileCode,
  Download,
  FileText,
  Mic,
  AlertTriangle,
  X
} from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';
import { CreatePostModal } from './CreatePostModal.tsx';

interface MediaItem { 
  url: string; 
  type: 'image' | 'video' | 'audio' | 'pdf' | 'word' | 'excel' | 'ppt'; 
  name?: string; 
}

interface Comment { 
  id?: string;
  user_id: string; 
  user_name: string; 
  text: string; 
  created_at: string; 
  avatar_url?: string; 
}

interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  media: MediaItem[] | null;
  likes: string[];
  comments: Comment[];
  created_at: string;
  profiles: { 
    full_name: string | null; 
    avatar_url: string | null; 
    coursename: string | null;
  } | null;
}

interface PostsSubTabProps {
  currentUserId: string | null;
  onOpenChat: (userId: string) => void;
}

export const PostsSubTab: React.FC<PostsSubTabProps> = ({ currentUserId: propUserId, onOpenChat }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});
  
  // Expand/Collapse States
  const [expandedComments, setExpandedComments] = useState<{ [postId: string]: boolean }>({});
  const [expandedMedia, setExpandedMedia] = useState<{ [postId: string]: boolean }>({});
  const [expandedContent, setExpandedContent] = useState<{ [postId: string]: boolean }>({});
  
  const [internalUserId, setInternalUserId] = useState<string | null>(propUserId);
  
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);
  const [fullMediaPreview, setFullMediaPreview] = useState<MediaItem | null>(null);

  // Scroll Aware Header State
  const [showHeader, setShowHeader] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!internalUserId) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) setInternalUserId(data.user.id);
      });
    }
  }, [propUserId]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    // Only enable auto-hide on mobile/tablet
    if (window.innerWidth >= 768) {
      if (!showHeader) setShowHeader(true);
      return;
    }

    const currentScrollY = scrollContainerRef.current.scrollTop;
    const { scrollHeight, clientHeight } = scrollContainerRef.current;
    
    // Ignore invalid scroll values (bounce effects)
    if (currentScrollY < 0) return;
    // Prevent bounce-related toggling at the bottom
    if (currentScrollY + clientHeight > scrollHeight + 20) return;
    
    // Threshold to prevent jitter
    if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

    if (currentScrollY > lastScrollY.current && currentScrollY > 150) {
      // Scrolling down & past top
      setShowHeader(false);
    } else if (currentScrollY < lastScrollY.current) {
      // Scrolling up
      // Check if we are near bottom to avoid bounce-back triggering header show
      const isNearBottom = currentScrollY + clientHeight >= scrollHeight - 50; 
      if (!isNearBottom) {
        setShowHeader(true);
      }
    }
    lastScrollY.current = currentScrollY;
  };

  const fetchPosts = useCallback(async (isSilent = false) => {
    if (refreshing) return;
    if (!isSilent) setLoading(true); 
    else {
      setRefreshing(true);
      setExpandedMedia({});
      setExpandedComments({});
      setExpandedContent({});
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(full_name, avatar_url, coursename)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const postsWithIds = (data || []).map(p => ({ 
        ...p, 
        likes: Array.isArray(p.likes) ? p.likes : [], 
        comments: (Array.isArray(p.comments) ? p.comments : []).map((c: any, index: number) => ({
          ...c,
          id: c.id || `${p.id}-c-${index}`
        }))
      }));

      setPosts(postsWithIds);
    } catch (err: any) { 
      console.error('Fetch Posts Error:', err.message); 
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  }, [refreshing]);

  useEffect(() => { 
    fetchPosts(); 
  }, []); 

  const handleLike = async (post: Post) => {
    const userId = internalUserId || propUserId;
    if (!userId) return;

    const isLiked = post.likes.includes(userId);
    const newLikes = isLiked ? post.likes.filter(id => id !== userId) : [...post.likes, userId];
    
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));

    try {
      await supabase.from('posts').update({ likes: newLikes }).eq('id', post.id);
    } catch (err: any) { console.error('Like Catch Error:', err.message); }
  };

  const handleAddComment = async (postId: string) => {
    const text = newComment[postId];
    const userId = internalUserId || propUserId;
    if (!text?.trim() || !userId) return;

    try {
      const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single();
      const newCommentObj: Comment = { 
        id: `${postId}-${Date.now()}`,
        user_id: userId, 
        user_name: profile?.full_name || 'Anonymous', 
        avatar_url: profile?.avatar_url || '',
        text, 
        created_at: new Date().toISOString() 
      };
      
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      
      const updatedComments = [...post.comments, newCommentObj];
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: updatedComments } : p));
      setNewComment(prev => ({ ...prev, [postId]: '' }));

      await supabase.from('posts').update({ comments: updatedComments }).eq('id', postId);
    } catch (err: any) { console.error('Comment Catch Error:', err.message); }
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
      console.error('Error downloading file:', error);
      window.open(item.url, '_blank');
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleMedia = (postId: string) => {
    setExpandedMedia(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const toggleContent = (postId: string) => {
    setExpandedContent(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const getDocStyles = (type: MediaItem['type']) => {
    switch (type) {
      case 'word': return { icon: <FileText size={16} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', label: 'Doc' };
      case 'excel': return { icon: <FileSpreadsheet size={16} />, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', label: 'Excel' };
      case 'ppt': return { icon: <Presentation size={16} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', label: 'PPT' };
      case 'pdf': return { icon: <FileText size={16} />, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', label: 'PDF' };
      default: return { icon: <FileCode size={16} />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', label: 'File' };
    }
  };

  const sortMediaByPriority = (media: MediaItem[]) => {
    const priorityMap = { image: 1, video: 1, audio: 2, pdf: 3, word: 3, excel: 3, ppt: 3 };
    return [...media].sort((a, b) => (priorityMap[a.type] || 4) - (priorityMap[b.type] || 4));
  };

  const filteredPosts = posts.filter(post => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      post.title?.toLowerCase().includes(q) ||
      post.profiles?.full_name?.toLowerCase().includes(q) ||
      post.profiles?.coursename?.toLowerCase().includes(q)
    );
  });

  const performDelete = async () => {
    const userId = internalUserId || propUserId;
    if (!userId || !confirmingDeleteId) return;

    setDeletingInProgress(true);
    try {
      // 1. Get the post to check for media
      const postToDelete = posts.find(p => p.id === confirmingDeleteId);
      
      // 2. Delete media from storage if exists
      if (postToDelete && postToDelete.media && postToDelete.media.length > 0) {
        const BUCKET_NAME = 'posts-media';
        const pathsToDelete: string[] = [];

        postToDelete.media.forEach(mediaItem => {
          try {
            const url = new URL(mediaItem.url);
            // Expected format: .../public/posts-media/user_id/filename
            const searchString = `/public/${BUCKET_NAME}/`;
            const index = url.pathname.indexOf(searchString);
            if (index !== -1) {
              const relativePath = url.pathname.substring(index + searchString.length);
              pathsToDelete.push(decodeURIComponent(relativePath));
            }
          } catch (e) {
            console.warn('Could not extract path for media deletion:', mediaItem.url);
          }
        });

        if (pathsToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove(pathsToDelete);
          
          if (storageError) {
             console.error('Failed to delete media from storage:', storageError);
          }
        }
      }

      // 3. Delete post from DB
      const { error: dbError } = await supabase.from('posts').delete().eq('id', confirmingDeleteId).eq('user_id', userId);
      if (dbError) throw dbError;
      
      setPosts(prev => prev.filter(p => p.id !== confirmingDeleteId));
      setConfirmingDeleteId(null);
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    } finally { setDeletingInProgress(false); }
  };

  const handleUpdateComment = async (postId: string, commentId: string) => {
    if (!editCommentText.trim()) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const updatedComments = post.comments.map(c => c.id === commentId ? { ...c, text: editCommentText } : c);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: updatedComments } : p));
    setEditingCommentId(null);
    setEditCommentText('');
    try {
      await supabase.from('posts').update({ comments: updatedComments }).eq('id', postId);
    } catch (err: any) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: post.comments } : p));
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const updatedComments = post.comments.filter(c => c.id !== commentId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: updatedComments } : p));
    try {
      await supabase.from('posts').update({ comments: updatedComments }).eq('id', postId);
    } catch (err: any) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: post.comments } : p));
    }
  };

  const ViewMoreButton = ({ onClick, expanded, text, collapsedText }: { onClick: () => void, expanded: boolean, text: string, collapsedText: string }) => (
    <button 
      onClick={onClick} 
      className="w-full py-2 text-[11px] font-semibold text-indigo-600 bg-indigo-50/50 rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100/30 flex items-center justify-center gap-1.5"
    >
      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      {expanded ? collapsedText : text}
    </button>
  );

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 relative overflow-hidden bg-white">
      <style>{`
        @keyframes spin-fast {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-fast {
          animation: spin-fast 0.5s linear infinite;
        }
      `}</style>

      {fullMediaPreview && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in" onClick={() => setFullMediaPreview(null)}>
          <button className="absolute top-8 right-8 p-4 bg-white/10 text-white rounded-full"><X size={28} /></button>
          <div className="max-w-4xl w-full h-auto max-h-[85vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {fullMediaPreview.type === 'image' && <img src={fullMediaPreview.url} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" alt="Preview" />}
            {fullMediaPreview.type === 'video' && <video src={fullMediaPreview.url} controls autoPlay className="max-w-full max-h-full rounded-2xl shadow-2xl" />}
          </div>
        </div>
      )}

      {confirmingDeleteId && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md transition-all">
          <div className="bg-white w-full max-w-[320px] rounded-[2rem] shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 border border-slate-50">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100/50">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Delete Post?</h3>
            <p className="text-slate-500 text-[11px] font-medium mb-6 leading-relaxed">Permanently remove this from the feed.</p>
            <div className="flex flex-col gap-2">
              <button disabled={deletingInProgress} onClick={performDelete} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-100 hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">{deletingInProgress ? <Loader2 size={16} className="animate-spin" /> : 'Delete Post'}</button>
              <button disabled={deletingInProgress} onClick={() => setConfirmingDeleteId(null)} className="w-full py-3 bg-slate-50 text-slate-500 font-bold text-xs rounded-xl hover:bg-slate-100 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Header with Mobile Auto-Hide */}
      {/* Increased max-height to 48 (12rem) to accommodate mobile stacked layout */}
      <div className={`w-full z-[100] px-2 md:px-0 bg-white transition-all duration-300 ease-in-out origin-top ${
        showHeader ? 'max-h-48 opacity-100 py-2' : 'max-h-0 opacity-0 overflow-hidden py-0'
      } shrink-0`}>
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4 p-1">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Search by peer name,title or course..." 
                  className="w-full pl-14 pr-4 py-3.5 bg-white border border-slate-200 rounded-full outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all text-sm font-medium text-slate-900 shadow-sm" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                />
              </div>
              <button 
                type="button" 
                onClick={() => fetchPosts(true)} 
                className="p-3.5 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:scale-95 shrink-0 flex items-center justify-center" 
                title="Refresh Feed" 
                disabled={refreshing}
              >
                <RefreshCw size={22} className={refreshing ? 'animate-spin-fast text-indigo-600' : ''} />
              </button>
            </div>
            <button 
              onClick={() => { setEditingPost(null); setShowCreateModal(true); }} 
              className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 text-white font-bold rounded-full shadow-xl hover:bg-indigo-700 transition-all active:scale-95 text-sm whitespace-nowrap"
            >
              <Plus size={18} />
              <span>Create Post</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar px-2 md:px-0 pb-6"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="max-w-4xl mx-auto space-y-6 pb-20 pt-6"> {/* Added pt-6 for gap */}
            {filteredPosts.map((post) => {
              const sortedMedia = post.media ? sortMediaByPriority(post.media) : [];
              const isMediaExpanded = expandedMedia[post.id] || false;
              const itemsToShow = isMediaExpanded ? sortedMedia : sortedMedia.slice(0, 4);
              const visualMedia = itemsToShow.filter(m => m.type === 'image' || m.type === 'video');
              const audioMedia = itemsToShow.filter(m => m.type === 'audio');
              const fileMedia = itemsToShow.filter(m => ['pdf', 'word', 'excel', 'ppt'].includes(m.type));
              const isCommentsExpanded = expandedComments[post.id] || false;
              const displayComments = isCommentsExpanded ? post.comments : post.comments.slice(-2);
              
              const isContentExpanded = expandedContent[post.id] || false;
              const CONTENT_LIMIT = 300;
              const isLongContent = post.content.length > CONTENT_LIMIT;
              const displayContent = isLongContent && !isContentExpanded
                ? post.content.slice(0, CONTENT_LIMIT) + '...'
                : post.content;

              return (
                <div key={post.id} className="bg-indigo-50/30 rounded-[2rem] border border-indigo-100 shadow-sm overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px]">
                  <div className="px-5 py-3 flex items-center justify-between bg-white/80 border-b border-indigo-100/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-indigo-600 font-bold overflow-hidden shadow-sm border border-slate-100 shrink-0">
                        {post.profiles?.avatar_url ? <img src={post.profiles.avatar_url} className="w-full h-full object-cover" alt="S" /> : <User size={16} className="opacity-40" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate leading-none">{post.profiles?.full_name || 'User'}</h4>
                          {post.profiles?.coursename && (
                            <div className="flex items-center gap-1 text-[9px] font-semibold bg-indigo-600 text-white px-2 py-0.5 rounded-full shrink-0 shadow-sm">
                              {post.profiles.coursename.split(',')[0]}
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">{new Date(post.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {(internalUserId || propUserId) === post.user_id ? (
                        <>
                          <button onClick={() => { setEditingPost(post); setShowCreateModal(true); }} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-all" title="Edit"><Edit3 size={14} /></button>
                          <button onClick={() => setConfirmingDeleteId(post.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-all" title="Delete"><Trash2 size={14} /></button>
                        </>
                      ) : (
                        <button onClick={() => onOpenChat(post.user_id)} className="p-2 bg-slate-900 text-white hover:bg-indigo-600 rounded-lg shadow-lg transition-all active:scale-90" title="Message"><MessageSquarePlus size={14} /></button>
                      )}
                    </div>
                  </div>
                  
                  <div className="px-6 py-4 bg-white/40">
                    <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight">{post.title}</h3>
                    <p className="text-slate-700 leading-relaxed font-normal text-base mb-4 whitespace-pre-wrap">{displayContent}</p>
                    
                    {isLongContent && (
                      <div className="mb-6">
                        <ViewMoreButton 
                          onClick={() => toggleContent(post.id)} 
                          expanded={isContentExpanded} 
                          text="Read more" 
                          collapsedText="Read less" 
                        />
                      </div>
                    )}
                    
                    <div className={`space-y-4 ${isMediaExpanded ? 'max-h-[500px] overflow-y-auto custom-scrollbar pr-1 mb-4' : ''}`}>
                      {visualMedia.length > 0 && (
                        <div className={`grid gap-3 ${visualMedia.length > 1 && !isMediaExpanded ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {visualMedia.map((item, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-2xl overflow-hidden relative group/media border border-indigo-50 shadow-sm">
                              <div className={`w-full relative ${isMediaExpanded ? 'h-96' : 'h-48 sm:h-64'}`}>
                                {item.type === 'image' ? <img src={item.url} className="w-full h-full object-cover" alt="V" /> : <div className="w-full h-full bg-black flex items-center justify-center"><Video size={32} className="text-white opacity-40" /></div>}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                  <button onClick={() => setFullMediaPreview(item)} className="p-3 bg-white text-slate-900 rounded-xl shadow-xl hover:scale-110 transition-transform"><Maximize2 size={18} /></button>
                                  <button onClick={() => handleDownload(item)} className="p-3 bg-indigo-600 text-white rounded-xl shadow-xl hover:scale-110 transition-transform"><Download size={18} /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {audioMedia.length > 0 && (
                        <div className="space-y-2">
                          {audioMedia.map((item, idx) => (
                            <div key={idx} className="p-2 sm:p-3 bg-slate-50 rounded-2xl border border-indigo-50 flex items-center gap-2 sm:gap-4 shadow-sm group/audio overflow-hidden">
                              <Mic size={16} className="text-indigo-600 shrink-0" />
                              <audio src={item.url} controls className="flex-1 min-w-0 h-8" />
                              <button 
                                onClick={() => handleDownload(item)} 
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shrink-0" 
                                title="Download Audio"
                              >
                                <Download size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {fileMedia.length > 0 && (
                        <div className={`grid gap-3 ${visualMedia.length === 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                          {fileMedia.map((item, idx) => {
                            const styles = getDocStyles(item.type);
                            return (
                              <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl border bg-white border-indigo-50 hover:border-indigo-200 transition-all group/file shadow-sm">
                                <div className={`p-2 rounded-xl bg-indigo-50/50 shadow-sm border border-indigo-100 ${styles.color}`}>{styles.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate">{item.name || styles.label}</p>
                                </div>
                                <button onClick={() => handleDownload(item)} className="p-2 text-slate-400 hover:text-indigo-600 group-hover/file:scale-110 transition-transform" title="Download"><Download size={16} /></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {sortedMedia.length > 4 && (
                      <div className="mt-3">
                        <ViewMoreButton 
                          onClick={() => toggleMedia(post.id)} 
                          expanded={isMediaExpanded} 
                          text={`Show ${sortedMedia.length - 4} more files`} 
                          collapsedText="Show less" 
                        />
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-3 border-t border-indigo-100/50 flex items-center gap-8 bg-white/60">
                    <button onClick={() => handleLike(post)} className={`flex items-center gap-2 text-xs font-semibold transition-all active:scale-125 ${post.likes.includes(internalUserId || propUserId || '') ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}>
                      <Heart size={18} fill={post.likes.includes(internalUserId || propUserId || '') ? 'currentColor' : 'none'} /> 
                      <span>{post.likes.length} Likes</span>
                    </button>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                      <MessageCircle size={18} /> 
                      <span>{post.comments.length} Comments</span>
                    </div>
                  </div>

                  <div className="px-5 py-2.5 border-t border-indigo-100/50 space-y-1 bg-white/80">
                    <div className={`space-y-1 ${isCommentsExpanded ? 'max-h-[300px] overflow-y-auto custom-scrollbar pr-1' : ''}`}>
                      {displayComments.map((c, i) => (
                        <div key={c.id || i} className="flex gap-2.5 items-start group/comment animate-in slide-in-from-left-2">
                          <button onClick={() => onOpenChat(c.user_id)} className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-indigo-600 font-bold text-[10px] shrink-0 overflow-hidden shadow-sm mt-0.5">
                            {c.avatar_url ? <img src={c.avatar_url} className="w-full h-full object-cover" alt="S" /> : c.user_name.charAt(0).toUpperCase()}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="bg-indigo-50/50 px-3 py-1.5 rounded-[1rem] rounded-tl-none border border-indigo-100/50 shadow-sm group-hover:border-indigo-300 transition-colors">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-bold text-slate-900 truncate leading-none text-[12px]">{c.user_name}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight shrink-0">{new Date(c.created_at).toLocaleDateString()}</span>
                              </div>
                              {editingCommentId === c.id ? (
                                <div className="space-y-1.5 mt-1.5">
                                  <textarea 
                                    className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-300 text-slate-900 font-medium" 
                                    value={editCommentText} 
                                    rows={2} 
                                    onChange={e => setEditCommentText(e.target.value)} 
                                    autoFocus 
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={() => handleUpdateComment(post.id, c.id!)} className="text-[9px] font-bold text-white bg-indigo-600 px-2.5 py-1 rounded-md shadow-sm">Update</button>
                                    <button onClick={() => setEditingCommentId(null)} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-slate-600 leading-snug break-words font-normal text-xs mt-0.5">{c.text}</p>
                              )}
                            </div>
                            {c.user_id === (internalUserId || propUserId) && editingCommentId !== c.id && (
                              <div className="flex gap-3 mt-0.5 ml-1">
                                <button onClick={() => { setEditingCommentId(c.id!); setEditCommentText(c.text); }} className="text-[9px] font-bold text-amber-600 hover:text-amber-700">Edit</button>
                                <button onClick={() => handleDeleteComment(post.id, c.id!)} className="text-[9px] font-bold text-red-500 hover:text-red-600">Delete</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {post.comments.length > 2 && (
                      <div className="pt-0.5">
                        <ViewMoreButton 
                          onClick={() => toggleComments(post.id)} 
                          expanded={isCommentsExpanded} 
                          text={`View all ${post.comments.length} comments`} 
                          collapsedText="Show less" 
                        />
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-1">
                      <input 
                        type="text" 
                        placeholder="Write a comment..." 
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 text-slate-900 shadow-sm placeholder:text-slate-400 transition-all" 
                        value={newComment[post.id] || ''} 
                        onChange={(e) => setNewComment({ ...newComment, [post.id]: e.target.value })} 
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)} 
                      />
                      <button onClick={() => handleAddComment(post.id)} disabled={!newComment[post.id]?.trim()} className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-indigo-700 disabled:bg-slate-200 disabled:shadow-none transition-all active:scale-90 flex items-center justify-center shrink-0"><Send size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="bg-slate-200/50 p-10 rounded-[3rem] mb-6 animate-pulse"><Search size={48} className="text-slate-300" /></div>
            <h3 className="text-xl font-bold text-slate-900">No matching posts found</h3>
            <p className="text-slate-400 text-sm font-medium mt-2">Broaden your search or check back later.</p>
          </div>
        )}
      </div>

      {showCreateModal && <CreatePostModal onClose={() => { setShowCreateModal(false); setEditingPost(null); }} onSuccess={() => { setShowCreateModal(false); setEditingPost(null); fetchPosts(); }} initialData={editingPost} />}
    </div>
  );
};