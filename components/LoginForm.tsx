
import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, Loader2, Info } from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onSwitchToForgot: () => void;
  onLoginSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ 
  onSwitchToSignup, 
  onSwitchToForgot,
  onLoginSuccess
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUnconfirmed(false);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (authError) {
        const isUnconfirmedError = 
          authError.message.toLowerCase().includes('confirm') || 
          authError.message.toLowerCase().includes('verify');

        if (isUnconfirmedError) {
          await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
              emailRedirectTo: window.location.origin
            }
          });
          setUnconfirmed(true);
          setError('Email verification required.');
          return;
        }
        
        throw authError;
      }
      
      if (data.user) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid login credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 sm:px-0">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome Back</h2>
        <p className="text-slate-500 text-sm font-medium mt-2">Log in to continue your learning journey.</p>
      </div>

      {error && (
        <div className={`p-4 rounded-2xl border flex flex-col gap-2 mb-6 animate-in zoom-in-95 ${
          unconfirmed ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          <div className="flex items-center gap-2 text-sm font-bold">
            {unconfirmed ? <Info size={18} /> : <AlertCircle size={18} />}
            {error}
          </div>
          {unconfirmed && (
            <p className="text-[11px] font-medium leading-relaxed opacity-80 pl-6">
              A fresh verification link has been sent to your inbox.
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 ml-1">Email</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Mail size={18} />
            </div>
            <input
              type="email"
              required
              className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-4 focus:ring-indigo-50/50 focus:bg-white focus:border-indigo-400 transition-all outline-none text-sm font-medium text-slate-900"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex justify-end px-1">
            <button 
              type="button" 
              onClick={onSwitchToForgot}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3.5 bg-[#4e46e5] hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
        </button>
      </form>

      <div className="mt-10">
        <div className="relative flex items-center justify-center mb-8">
          <div className="flex-1 border-t border-slate-100"></div>
          <span className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white z-10">OR CONTINUE WITH</span>
          <div className="flex-1 border-t border-slate-100"></div>
        </div>

        <p className="text-center text-sm text-slate-500 font-medium">
          Don't have an account?{' '}
          <button 
            onClick={onSwitchToSignup}
            className="font-bold text-indigo-600 hover:text-indigo-700 transition-all"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};
