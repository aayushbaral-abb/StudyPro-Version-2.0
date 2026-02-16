
import React, { useState } from 'react';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      
      if (authError) throw authError;

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Unable to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center w-full max-w-[380px] animate-in zoom-in-95 duration-500">
        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="text-green-600 w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Check your email</h2>
        <p className="text-slate-600 text-sm font-medium">
          We've sent password reset instructions to <b>{email}</b> if an account exists.
        </p>
        <button 
          onClick={onBackToLogin}
          className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg mt-8 active:scale-[0.98]"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[380px] animate-in fade-in duration-500 px-4 sm:px-0">
      <div className="flex justify-start mb-6">
        <button 
          onClick={onBackToLogin}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 group transition-all"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </button>
      </div>

      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Forgot Password?</h2>
        <p className="text-slate-500 text-sm font-medium mt-2">Enter your email, we'll send you reset password link.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold mb-6 animate-in zoom-in-95">
          <AlertCircle size={20} className="shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 ml-1">Email address</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Mail size={18} />
            </div>
            <input
              type="email"
              required
              className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:ring-4 focus:ring-indigo-50/50 focus:bg-white focus:border-indigo-400 transition-all outline-none text-sm font-medium text-slate-900 shadow-sm"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-3.5 bg-[#4e46e5] hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
};
