import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Camera, 
  Lock, 
  ShieldCheck, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Type,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';

interface AccountSettingsProps {
  isPasswordRecovery?: boolean;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ isPasswordRecovery = false }) => {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Profile States
  const [initialProfile, setInitialProfile] = useState({
    fullName: '',
    introduction: ''
  });
  const [profile, setProfile] = useState({
    fullName: '',
    introduction: '',
    avatarUrl: '',
    email: '',
    createdAt: ''
  });

  // Password States
  const [passwords, setPasswords] = useState({
    old: '',
    new: '',
    confirm: ''
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, introduction, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        const profileData = {
          fullName: data.full_name || '',
          introduction: data.introduction || '',
          avatarUrl: data.avatar_url || '',
          email: user.email || '',
          createdAt: user.created_at || ''
        };
        setProfile(profileData);
        setInitialProfile({
          fullName: profileData.fullName,
          introduction: profileData.introduction
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const isProfileDirty = 
    profile.fullName !== initialProfile.fullName || 
    profile.introduction !== initialProfile.introduction;

  // If in recovery mode, old password is not required
  const isPasswordReady = 
    (isPasswordRecovery || passwords.old.length > 0) && 
    passwords.new.length >= 6 && 
    passwords.confirm.length >= 6 &&
    passwords.new === passwords.confirm;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProfileDirty) return;
    
    setSavingProfile(true);
    setStatus(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.fullName,
          introduction: profile.introduction
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setInitialProfile({
        fullName: profile.fullName,
        introduction: profile.introduction
      });
      
      setStatus({ type: 'success', msg: 'Profile updated successfully!' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSavingProfile(true);
      setStatus(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatarUrl: publicUrl }));
      setStatus({ type: 'success', msg: 'Profile photo updated!' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordReady) return;

    setChangingPassword(true);
    setStatus(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('User email not found');

      // Only require old password verification if NOT in recovery mode
      if (!isPasswordRecovery) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: passwords.old
        });

        if (signInError) throw new Error('Verification failed: Incorrect current password.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (updateError) throw updateError;

      setStatus({ type: 'success', msg: 'Password changed successfully!' });
      setPasswords({ old: '', new: '', confirm: '' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <style>{`
        .white-scrollbar::-webkit-scrollbar { width: 6px; }
        .white-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .white-scrollbar::-webkit-scrollbar-thumb { background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; }
        .white-scrollbar { scrollbar-width: thin; scrollbar-color: white transparent; }
      `}</style>

      {/* Header Summary Card - Kept as bg-sky-50/50 */}
      <div className="bg-sky-50/50 rounded-3xl p-8 border border-sky-100 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8">
        {/* Avatar Section */}
        <div className="relative group shrink-0 mt-2">
          <div className="w-32 h-32 rounded-3xl bg-white border-4 border-white shadow-xl overflow-hidden flex items-center justify-center text-slate-300">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-sky-300" />
            )}
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 p-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-90 z-10"
          >
            <Camera size={18} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleAvatarUpload}
          />
        </div>
        
        {/* Profile Content Section */}
        <div className="flex-1 w-full flex flex-col space-y-5">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">
              {profile.fullName || 'New User'}
            </h2>
            <p className="text-slate-500 text-sm italic break-words whitespace-pre-wrap leading-relaxed">
              {profile.introduction || "Not yet added introduction"}
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/60 p-5 rounded-2xl border border-sky-50 w-full shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm shrink-0 border border-slate-50">
                <Mail size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Email Address</span>
                <span className="text-xs font-semibold text-slate-700 truncate">{profile.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm shrink-0 border border-slate-50">
                <Calendar size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Joined On</span>
                <span className="text-xs font-semibold text-slate-700">
                  {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {status && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in zoom-in-95 ${
          status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-semibold">{status.msg}</span>
        </div>
      )}

      {isPasswordRecovery && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3 text-amber-800 animate-in fade-in">
          <AlertTriangle size={20} />
          <span className="text-sm font-bold">You are in password recovery mode. Please set a new password below.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        
        {/* Profile Form - Changed to white background */}
        <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
              <User size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Personal Details</h3>
          </div>

          <form onSubmit={handleUpdateProfile} className="flex-1 flex flex-col">
            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User size={16} />
                  </div>
                  <input 
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-50 focus:bg-white outline-none transition-all text-sm text-slate-900 shadow-sm"
                    placeholder="Your Name"
                    value={profile.fullName}
                    onChange={e => setProfile({...profile, fullName: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bio / Introduction</label>
                <div className="relative">
                  <div className="absolute top-3 left-4 text-slate-400">
                    <Type size={16} />
                  </div>
                  <textarea 
                    rows={8}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-50 focus:bg-white outline-none transition-all text-sm resize-none text-slate-900 shadow-sm white-scrollbar"
                    placeholder="Share a short intro about you..."
                    value={profile.introduction}
                    onChange={e => setProfile({...profile, introduction: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={savingProfile || !isProfileDirty}
              className={`w-full py-3.5 mt-6 font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                isProfileDirty 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </button>
          </form>
        </section>

        {/* Security / Password Form - Changed to white background */}
        <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-50 rounded-xl text-red-600 border border-red-100">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Security</h3>
          </div>

          <form onSubmit={handleChangePassword} className="flex-1 flex flex-col">
            <div className="space-y-4 flex-1">
              {!isPasswordRecovery && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Current Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input 
                      required
                      type={showCurrentPass ? "text" : "password"}
                      className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:bg-white outline-none transition-all text-sm text-slate-900 shadow-sm"
                      placeholder="••••••••"
                      value={passwords.old}
                      onChange={e => setPasswords({...passwords, old: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-4 inset-y-0 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <KeyRound size={16} />
                  </div>
                  <input 
                    required
                    type={showNewPass ? "text" : "password"}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:bg-white outline-none transition-all text-sm text-slate-900 shadow-sm"
                    placeholder="Min. 6 chars"
                    value={passwords.new}
                    onChange={e => setPasswords({...passwords, new: e.target.value})}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-4 inset-y-0 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <KeyRound size={16} />
                  </div>
                  <input 
                    required
                    type={showNewPass ? "text" : "password"}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:bg-white outline-none transition-all text-sm text-slate-900 shadow-sm"
                    placeholder="••••••••"
                    value={passwords.confirm}
                    onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={changingPassword || !isPasswordReady}
              className={`w-full py-3.5 mt-6 font-bold rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                isPasswordReady 
                ? 'bg-red-600 text-white shadow-lg shadow-red-100 hover:bg-red-700' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};