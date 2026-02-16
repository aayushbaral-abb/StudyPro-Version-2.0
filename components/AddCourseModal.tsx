import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, BookOpen, GraduationCap, Banknote } from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';

interface AddCourseModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCourseModal: React.FC<AddCourseModalProps> = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [degree, setDegree] = useState('');
  const [structure, setStructure] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [subjects, setSubjects] = useState<string[]>(['']);

  const needsStructure = degree === 'Bachelor' || degree === 'Master';

  const addSubject = () => setSubjects([...subjects, '']);
  const removeSubject = (index: number) => {
    if (subjects.length > 1) {
      setSubjects(subjects.filter((_, i) => i !== index));
    }
  };

  const updateSubject = (index: number, value: string) => {
    const newSubjects = [...subjects];
    newSubjects[index] = value;
    setSubjects(newSubjects);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert({
          user_id: userData.user.id,
          name: courseName,
          degree,
          academic_structure: needsStructure ? structure : null,
          current_value: needsStructure ? currentValue : null,
          join_date: joinDate
        })
        .select()
        .single();

      if (courseError) throw courseError;

      const validSubjects = subjects.filter(s => s.trim() !== '').map(s => ({
        course_id: course.id,
        name: s
      }));

      if (validSubjects.length > 0) {
        const { error: subjectError } = await supabase
          .from('subjects')
          .insert(validSubjects);
        if (subjectError) throw subjectError;
      }

      const { data: allUserCourses, error: fetchError } = await supabase
        .from('courses')
        .select('name')
        .eq('user_id', userData.user.id);

      if (!fetchError && allUserCourses) {
        const combinedCourseNames = allUserCourses.map(c => c.name).join(', ');
        
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ coursename: combinedCourseNames })
          .eq('id', userData.user.id);

        if (profileError) {
          console.error("Profile update failed:", profileError.message);
        }
      }

      onSuccess();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
              <Plus size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Add New Course</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Course Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <GraduationCap size={18} />
                </div>
                <input
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 text-slate-900"
                  placeholder="e.g. Course name"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Degree Level</label>
              <select
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900 appearance-none cursor-pointer"
                value={degree}
                onChange={e => {
                  setDegree(e.target.value);
                  setStructure('');
                  setCurrentValue('');
                }}
              >
                <option value="">Select Degree</option>
                <option value="SEE">SEE</option>
                <option value="+2">+2</option>
                <option value="Bachelor">Bachelor</option>
                <option value="Master">Master</option>
                <option value="Others">Others</option>
              </select>
            </div>

            {needsStructure && (
              <>
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Academic Structure</label>
                  <select
                    required
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900 appearance-none cursor-pointer"
                    value={structure}
                    onChange={e => setStructure(e.target.value)}
                  >
                    <option value="">Select Structure</option>
                    <option value="semester_wise">Semester Wise</option>
                    <option value="yearly_wise">Yearly Wise</option>
                  </select>
                </div>

                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Current Value</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Banknote size={18} />
                    </div>
                    <input
                      required
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 text-slate-900"
                      placeholder="e.g. 1,2,3,4"
                      value={currentValue}
                      onChange={e => setCurrentValue(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 ml-1">Join Date</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Calendar size={18} />
                </div>
                <input
                  required
                  type="date"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-900 cursor-pointer"
                  value={joinDate}
                  onChange={e => setJoinDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen size={18} className="text-indigo-500" /> Subjects
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Add all major subjects for this course</span>
              </div>
              <button
                type="button"
                onClick={addSubject}
                className="text-xs font-bold text-indigo-600 hover:text-white flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-600 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <Plus size={16} /> Add Subject
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map((sub, idx) => (
                <div key={idx} className="group relative flex items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="absolute left-4 z-10 text-slate-300 group-focus-within:text-indigo-400 transition-colors">
                    <span className="text-[10px] font-bold">{idx + 1}</span>
                  </div>
                  <input
                    required
                    className="w-full pl-10 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-300 text-sm font-medium text-slate-900"
                    placeholder={`e.g. ${idx === 0 ? 'Mathematics' : idx === 1 ? 'Physics' : 'New Subject'}`}
                    value={sub}
                    onChange={e => updateSubject(idx, e.target.value)}
                  />
                  {subjects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSubject(idx)}
                      className="absolute right-3 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98]"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 px-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating Course...
                </>
              ) : (
                'Save Course Details'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};