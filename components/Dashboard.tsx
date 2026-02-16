import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, 
  Users, 
  User, 
  LogOut, 
  GraduationCap, 
  Plus, 
  BookOpen, 
  Calendar, 
  Menu, 
  X, 
  Loader2,
  Edit3,
  Trash2,
  AlertTriangle 
} from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';
import { AddCourseModal } from './AddCourseModal.tsx';
import { EditCourseModal } from './EditCourseModal.tsx';
import { AccountSettings } from './AccountSettings.tsx';
import { CommunityTab } from './CommunityTab.tsx';
import { NotificationBell } from './NotificationBell.tsx';
import { CourseDetail } from './CourseDetail.tsx';

interface DashboardProps {
  onSignOut: () => void;
  isPasswordRecovery?: boolean;
}

type Tab = 'dashboard' | 'community' | 'account';

export interface Course {
  id: string;
  name: string;
  degree: string;
  academic_structure: string;
  current_value: string;
  join_date: string;
  subjects?: { id: string; name: string }[];
}

export const Dashboard: React.FC<DashboardProps> = ({ onSignOut, isPasswordRecovery }) => {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = localStorage.getItem('studypro_active_tab');
    return (saved as Tab) || 'dashboard';
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);

  // Edit/Delete States for Dashboard Cards
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  // State to handle navigation from notification to specific chat
  const [chatUserId, setChatUserId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('studypro_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (isPasswordRecovery) {
      setActiveTab('account');
      setIsSidebarOpen(false);
    }
  }, [isPasswordRecovery]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          subjects (id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
      
      // If a course is currently selected, update its data in view
      if (selectedCourse) {
        const updatedSelected = (data || []).find(c => c.id === selectedCourse.id);
        if (updatedSelected) {
          setSelectedCourse(updatedSelected);
        }
      }
    } catch (error: any) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from('profiles').select('avatar_url, full_name').eq('id', user.id).single();
      if (profile) {
        setProfilePic(profile.avatar_url || null);
        setUserName(profile.full_name || 'User');
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') fetchCourses();
    fetchUserData();
  }, [activeTab]);

  useEffect(() => {
    if (!loading && courses.length > 0 && !hasAttemptedRestore) {
      const savedCourseId = localStorage.getItem('studypro_active_course_id');
      if (savedCourseId) {
        const found = courses.find(c => c.id === savedCourseId);
        if (found) {
          setSelectedCourse(found);
        }
      }
      setHasAttemptedRestore(true);
    }
  }, [loading, courses, hasAttemptedRestore]);

  useEffect(() => {
    if (selectedCourse) {
      localStorage.setItem('studypro_active_course_id', selectedCourse.id);
    }
  }, [selectedCourse]);

  const handleBackToDashboard = () => {
    localStorage.removeItem('studypro_active_course_id');
    setSelectedCourse(null);
  };

  const handleSignOut = async () => {
    localStorage.removeItem('studypro_active_tab');
    localStorage.removeItem('studypro_active_course_id');
    await supabase.auth.signOut();
    onSignOut();
  };

  const extractPathFromUrl = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      const BUCKET_NAME = 'course-multimedia';
      const parts = url.pathname.split(`/${BUCKET_NAME}/`);
      if (parts.length < 2) return null;
      return decodeURIComponent(parts[1]);
    } catch (e) {
      console.error('Error extracting path from URL:', e);
      return null;
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeletingCourse(true);
    try {
       // 1. Cleanup Storage: Delete all media associated with this course's subjects
       const subjectIds = courseToDelete.subjects?.map(s => s.id) || [];
       
       if (subjectIds.length > 0) {
         // Fetch all media URLs for these subjects
         const { data: mediaFiles } = await supabase
           .from('course_media')
           .select('url')
           .in('subject_id', subjectIds);

         if (mediaFiles && mediaFiles.length > 0) {
           const pathsToDelete = mediaFiles
             .map(m => extractPathFromUrl(m.url))
             .filter((p): p is string => !!p);

           if (pathsToDelete.length > 0) {
             const { error: storageError } = await supabase.storage
               .from('course-multimedia')
               .remove(pathsToDelete);
             
             if (storageError) {
               console.error('Failed to delete files from storage:', storageError);
             }
           }
         }
       }

       // 2. Delete Course Record (Cascades to subjects, notes, course_media tables)
       const { error } = await supabase.from('courses').delete().eq('id', courseToDelete.id);
       if(error) throw error;
       
       // 3. Update Profile
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
         const { data: allCourses } = await supabase
           .from('courses')
           .select('name')
           .eq('user_id', user.id);
           
         if (allCourses) {
           const courseNames = allCourses.map(c => c.name).join(', ');
           await supabase
             .from('profiles')
             .update({ coursename: courseNames })
             .eq('id', user.id);
         } else {
            // If no courses left, clear coursename
            await supabase
             .from('profiles')
             .update({ coursename: null })
             .eq('id', user.id);
         }
       }

       setCourses(prev => prev.filter(c => c.id !== courseToDelete.id));
       setCourseToDelete(null);
    } catch (error: any) {
       alert('Error deleting course: ' + error.message);
    } finally {
       setIsDeletingCourse(false);
    }
  };

  const handleNotificationClick = (senderId: string) => {
    setChatUserId(senderId);
    setActiveTab('community');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'community', label: 'Community', icon: <Users size={20} /> },
    { id: 'account', label: 'Account', icon: <User size={20} /> },
  ];

  const subjectTagClass = 'bg-indigo-50 text-indigo-600 border border-indigo-100';

  return (
    <div className="flex h-screen bg-white overflow-hidden w-full fixed inset-0">
      {showAddModal && (
        <AddCourseModal 
          onClose={() => setShowAddModal(false)} 
          onSuccess={() => { setShowAddModal(false); fetchCourses(); }}
        />
      )}

      {courseToEdit && (
        <EditCourseModal 
          course={courseToEdit}
          onClose={() => setCourseToEdit(null)}
          onSuccess={() => {
            setCourseToEdit(null);
            fetchCourses();
          }}
        />
      )}

      {courseToDelete && createPortal(
        <div className="fixed inset-0 z-[9500] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 border border-slate-50 relative text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100/50">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Delete Course?</h3>
            <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8">
              Are you sure you want to delete <span className="font-bold text-slate-900">{courseToDelete.name}</span>?<br/>
              This action cannot be undone.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteCourse}
                disabled={isDeletingCourse}
                className="w-full py-3.5 bg-red-600 text-white font-bold rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isDeletingCourse ? <Loader2 className="animate-spin" size={20} /> : 'Yes, Delete Course'}
              </button>
              <button 
                onClick={() => setCourseToDelete(null)}
                disabled={isDeletingCourse}
                className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[900] lg:hidden transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-[1000] w-64 bg-gradient-to-b from-blue-500 via-blue-600 to-indigo-800 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col text-white
      `}>
        <div className="p-6 flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <GraduationCap size={24} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">StudyPro</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as Tab);
                setIsSidebarOpen(false);
                handleBackToDashboard();
                if (item.id === 'community') setChatUserId(null); // Clear forced chat on manual nav
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                ${activeTab === item.id 
                  ? 'bg-white/20 text-white' 
                  : 'text-blue-100/70 hover:bg-white/10 hover:text-white'}
              `}
            >
              <span className="opacity-80">{item.icon}</span>
              <span className="capitalize">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-500 hover:text-red-700 transition-all"
          >
            <LogOut size={20} />
            <span className="capitalize">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white relative">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 z-[200]">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-slate-500" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-bold text-slate-800 capitalize">
              {activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {currentUserId && <NotificationBell userId={currentUserId} onNotificationClick={handleNotificationClick} />}
            <div className="flex items-center gap-3 pl-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center overflow-hidden shadow-sm">
                {profilePic ? <img src={profilePic} className="w-full h-full object-cover" /> : <User className="text-indigo-400" size={20} />}
              </div>
              <span className="hidden sm:block text-sm font-bold text-slate-700 capitalize">{userName}</span>
            </div>
          </div>
        </header>

        <div className={`flex-1 ${activeTab === 'community' ? 'overflow-hidden flex flex-col p-2 md:p-10' : 'overflow-y-auto p-6 md:p-10'}`}>
          <div className={`max-w-[1400px] mx-auto w-full ${activeTab === 'community' ? 'h-full flex flex-col' : ''}`}>
            {activeTab === 'dashboard' && (
              <>
                {selectedCourse ? (
                  <CourseDetail 
                    course={selectedCourse} 
                    onBack={handleBackToDashboard} 
                    profilePic={profilePic}
                    userName={userName}
                    onSignOut={handleSignOut}
                    onCourseUpdated={fetchCourses}
                    onCourseDeleted={() => {
                      handleBackToDashboard();
                      fetchCourses();
                    }}
                  />
                ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight capitalize">Your courses</h2>
                        <p className="text-slate-500 mt-1 text-sm">Manage and track your academic progression.</p>
                      </div>
                      <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                      >
                        <Plus size={20} />
                        <span className="capitalize">Add course</span>
                      </button>
                    </div>

                    {loading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="text-blue-500 animate-spin" />
                      </div>
                    ) : courses.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {courses.map((course) => (
                          <div 
                            key={course.id} 
                            onClick={() => setSelectedCourse(course)}
                            className="bg-white rounded-[2rem] p-8 border border-blue-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col min-h-[300px] relative"
                          >
                            <div className="flex items-start justify-between mb-6">
                              <div className="bg-blue-50/50 p-4 rounded-2xl text-blue-500 border border-blue-100">
                                <GraduationCap size={32} />
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-lg uppercase tracking-wide">{course.degree}</span>
                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); setCourseToEdit(course); }}
                                     className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                     title="Edit Course Name"
                                   >
                                     <Edit3 size={16} />
                                   </button>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); setCourseToDelete(course); }}
                                     className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                     title="Delete Course"
                                   >
                                     <Trash2 size={16} />
                                   </button>
                                </div>
                              </div>
                            </div>
                            
                            <h3 className="text-2xl font-black text-slate-900 mb-2 truncate group-hover:text-blue-600 transition-colors">
                              {course.name}
                            </h3>
                            
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 tracking-widest mb-10">
                              <Calendar size={14} className="opacity-50" />
                              <span>Joined {new Date(course.join_date).toLocaleDateString()}</span>
                            </div>

                            <div className="mt-auto space-y-4">
                              <span className="text-[12px] font-black text-slate-400 tracking-[0.2em]">Core subjects</span>
                              <div className="flex flex-wrap gap-2">
                                {course.subjects?.map((s, i) => (
                                  <span key={i} className={`px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wider ${subjectTagClass}`}>
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white rounded-[3rem] p-20 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                        <BookOpen size={64} className="text-slate-200 mb-6" />
                        <h3 className="text-2xl font-black text-slate-900 capitalize">No courses added yet</h3>
                        <p className="text-slate-400 max-w-sm mt-2 mb-10 font-medium">Start your journey by adding your first academic course.</p>
                        <button onClick={() => setShowAddModal(true)} className="px-10 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl hover:bg-blue-700 transition-all">
                          <span className="capitalize">Add your first course</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {activeTab === 'community' && <CommunityTab forceChatUserId={chatUserId} />}
            {activeTab === 'account' && <AccountSettings isPasswordRecovery={isPasswordRecovery} />}
          </div>
        </div>
      </main>
    </div>
  );
};