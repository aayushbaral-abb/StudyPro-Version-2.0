
import React, { useState } from 'react';
import { Mail, Lock, User, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';

interface SignupFormProps {
  onSwitchToLogin: () => void;
  onSignupSuccess: (email: string) => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({ 
  onSwitchToLogin, 
  onSignupSuccess 
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();

    // Gmail restriction check
    if (!trimmedEmail.endsWith('@gmail.com')) {
      setError('Registration is restricted to @gmail.com only.');
      return;
    }

    if (password.length < 6) {
      setError('Password should be 6+ characters.');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { 
            full_name: name.trim() 
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) throw authError;

      if (data.user) {
        onSignupSuccess(trimmedEmail);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[380px] animate-in fade-in slide-in-from-right-4 duration-700 px-4 sm:px-0">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Create account</h2>
        <p className="text-slate-500 text-lg font-medium mt-2">Start your professional learning journey.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold mb-6 animate-in zoom-in-95">
          <AlertCircle size={20} className="shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 ml-1">Full name</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <User size={18} />
            </div>
            <input
              type="text"
              required
              className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-4 focus:ring-indigo-50/50 focus:bg-white focus:border-indigo-400 transition-all outline-none text-sm font-medium text-slate-900"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 ml-1">Gmail address</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Mail size={18} />
            </div>
            <input
              type="email"
              required
              className={`block w-full pl-11 pr-4 py-3.5 border ${error?.includes('@gmail.com') ? 'border-red-300' : 'border-slate-200'} rounded-xl bg-slate-50/50 focus:ring-4 focus:ring-indigo-50/50 focus:bg-white focus:border-indigo-400 transition-all outline-none text-sm font-medium text-slate-900`}
              placeholder="you@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="text-[10px] font-bold text-slate-400 mt-1 ml-1 flex items-center gap-1 tracking-tight">
            <CheckCircle2 size={12} className="text-green-500" /> Must be a @gmail.com address
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 ml-1">Password</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Lock size={18} />
            </div>
            <input
              type="password"
              required
              className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-4 focus:ring-indigo-50/50 focus:bg-white focus:border-indigo-400 transition-all outline-none text-sm font-medium text-slate-900"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3.5 bg-[#4e46e5] hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create account'}
        </button>
      </form>

      <div className="mt-10">
        <p className="text-center text-sm text-slate-500 font-medium">
          Already a member?{' '}
          <button 
            onClick={onSwitchToLogin}
            className="font-bold text-indigo-600 hover:text-indigo-700 transition-all"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
