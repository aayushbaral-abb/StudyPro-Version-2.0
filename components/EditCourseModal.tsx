import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, GraduationCap, Banknote, Loader2, Edit3, Lock } from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';
import { Course } from './Dashboard.tsx';

interface EditCourseModalProps {
  course: Course;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditCourseModal: React.FC<EditCourseModalProps> = ({ course, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [courseName, setCourseName] = useState(course.name);
  
  // Keep these for display only
  const degree = course.degree;
  const structure = course.academic_structure || '';
  const currentValue = course.current_value || '';
  const joinDate = course.join_date;

  const needsStructure = degree === 'Bachelor' || degree === 'Master';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Only Update Course Name
      const { error: courseError } = await supabase
        .from('courses')
        .update({
          name: courseName
        })
        .eq('id', course.id);

      if (courseError) throw courseError;

      // 2. Update Profile with new course list
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
        }
      }

      onSuccess();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
              <Edit3 size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Edit Course Name</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-6">
            {/* Editable Course Name */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Course Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <GraduationCap size={18} />
                </div>
                <input
                  required
                  autoFocus
                  className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-indigo-100 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-slate-900 font-bold"
                  placeholder="e.g. Computer Science"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white text-xs font-medium text-slate-400 tracking-widest">Other Details</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale-[0.5] select-none pointer-events-none">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 ml-1 flex items-center gap-1"><Lock size={10}/> Degree Level</label>
                <div className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 font-medium">
                  {degree || 'N/A'}
                </div>
              </div>

              {needsStructure && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 ml-1 flex items-center gap-1"><Lock size={10}/> Academic Structure</label>
                    <div className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 font-medium capitalize">
                       {structure.replace('_', ' ') || 'N/A'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 ml-1 flex items-center gap-1"><Lock size={10}/> Current Value</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <Banknote size={18} />
                      </div>
                      <div className="w-full pl-11 pr-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 font-medium">
                        {currentValue}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 ml-1 flex items-center gap-1"><Lock size={10}/> Join Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Calendar size={18} />
                  </div>
                  <div className="w-full pl-11 pr-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 font-medium">
                    {joinDate}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 px-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Update Name
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};