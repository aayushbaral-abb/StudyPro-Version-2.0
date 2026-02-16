
import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm.tsx';
import { SignupForm } from './components/SignupForm.tsx';
import { ForgotPasswordForm } from './components/ForgotPasswordForm.tsx';
import { PolicyModal } from './components/PolicyModal.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { GraduationCap, Loader2, MailCheck, ExternalLink, ArrowRight, BarChart3, Users, Share2, Zap } from 'lucide-react';
import { supabase } from './services/supabaseClient.ts';

type AuthView = 'login' | 'signup' | 'forgot-password' | 'verification-sent' | 'dashboard';
type PolicyType = 'privacy' | 'terms' | null;

const App: React.FC = () => {
  const [view, setView] = useState<AuthView>('login');
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [activePolicy, setActivePolicy] = useState<PolicyType>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session) {
          setView('dashboard');
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      if (session) {
        setView('dashboard');
      } else {
        setView((current) => (current === 'dashboard' || event === 'SIGNED_OUT' ? 'login' : current));
        setIsPasswordRecovery(false);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const renderView = () => {
    switch (view) {
      case 'login':
        return (
          <LoginForm 
            onSwitchToSignup={() => setView('signup')} 
            onSwitchToForgot={() => setView('forgot-password')}
            onLoginSuccess={() => setView('dashboard')}
          />
        );
      case 'signup':
        return (
          <SignupForm 
            onSwitchToLogin={() => setView('login')} 
            onSignupSuccess={(email) => {
              setUserEmail(email);
              setView('verification-sent');
            }}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordForm 
            onBackToLogin={() => setView('login')} 
          />
        );
      case 'verification-sent':
        return (
          <div className="text-center w-full max-w-[400px] animate-in zoom-in-95 duration-700">
            <div className="bg-indigo-600 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-200">
              <MailCheck className="text-white w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Verify your email</h2>
            <p className="text-slate-500 font-medium leading-relaxed mb-10">
              We've sent a magic link to <span className="font-bold text-slate-800">{userEmail}</span>. 
              Open the email and click the button to verify your account.
            </p>
            <div className="space-y-4">
              <a 
                href="https://mail.google.com" 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-100 active:scale-[0.98]"
              >
                Go to Gmail <ExternalLink size={18} />
              </a>
              <button 
                onClick={() => setView('login')}
                className="w-full py-4 px-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-bold transition-all border border-slate-100 active:scale-[0.98]"
              >
                Back to Login
              </button>
            </div>
          </div>
        );
      case 'dashboard':
        return <Dashboard onSignOut={() => setView('login')} isPasswordRecovery={isPasswordRecovery} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fbff]">
        <div className="relative">
          <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-2xl shadow-indigo-200 animate-bounce">
            <GraduationCap size={48} />
          </div>
          <Loader2 className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-indigo-400 animate-spin" size={24} />
        </div>
        <p className="mt-16 text-slate-400 font-black tracking-[0.3em] text-xs">StudyPro</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white relative overflow-x-hidden">
      <PolicyModal type={activePolicy} onClose={() => setActivePolicy(null)} />

      {view !== 'dashboard' ? (
        <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-2">
          
          {/* Mobile Header Branding - Visible only on mobile */}
          <div className="lg:hidden w-full pt-10 pb-6 px-8 flex flex-col items-center text-center bg-[#f9fbff]">
            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg mb-6">
              <GraduationCap size={28} />
            </div>
            <span className="text-3xl font-bold text-slate-900 tracking-tight mb-2">StudyPro</span>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">
              Master your academic <span className="text-indigo-600">journey.</span>
            </h1>
            <p className="text-slate-500 text-sm mt-3 font-medium">
              Join a thriving community and track your journey to success.
            </p>
          </div>

          {/* Desktop Sidebar Branding - Visible only on desktop (Full Height) */}
          <div className="hidden lg:flex flex-col justify-between p-16 bg-[#4e46e5] text-white h-screen sticky top-0">
            <div>
              <div className="flex items-center gap-3 mb-16">
                <div className="bg-white p-2 rounded-xl">
                  <GraduationCap className="text-[#4e46e5]" size={32} />
                </div>
                <span className="text-3xl font-bold tracking-tight">StudyPro</span>
              </div>
              
              <h1 className="text-5xl font-black leading-tight mb-8">
                Master your academic <br /> journey.
              </h1>
              <p className="text-indigo-100 text-base mb-12 max-w-sm font-medium opacity-90 leading-relaxed">
                The professional-grade workspace for the modern student. Track, share, and grow with precision.
              </p>

              <div className="space-y-6">
                {[
                  "Track daily progress & milestones",
                  "Connect with a global community",
                  "Share notes between friends",
                  "Easy to access on all devices"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="bg-white/20 p-1.5 rounded-full">
                      <ArrowRight size={14} className="text-white" />
                    </div>
                    <span className="font-semibold text-indigo-50 text-base">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8 flex items-center justify-between text-indigo-200/60 text-[11px] font-bold tracking-widest">
              <span>© {new Date().getFullYear()} StudyPro Platforms Inc.</span>
              <div className="flex gap-4">
                <button onClick={() => setActivePolicy('privacy')} className="hover:text-white transition-colors uppercase">Privacy</button>
                <button onClick={() => setActivePolicy('terms')} className="hover:text-white transition-colors uppercase">Terms</button>
              </div>
            </div>
          </div>

          {/* Main Auth Form Container - Full Height */}
          <div className="flex flex-col bg-[#f9fbff] lg:bg-white min-h-screen">
            <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-12">
              <div className="w-full flex justify-center">
                {renderView()}
              </div>
            </div>

            {/* Mobile/Tablet "Why Choose Us" Footer Section */}
            <div className="lg:hidden w-full px-8 py-10 bg-[#f0f7ff] border-t border-slate-100 flex flex-col items-center">
              <div className="w-full max-w-[380px]">
                <h3 className="text-[12px] font-bold text-slate-400 tracking-[0.2em] mb-10 text-center">
                  Why choose us?
                </h3>
                <div className="grid grid-cols-2 gap-y-10 gap-x-6">
                  <div className="flex flex-col gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
                      <BarChart3 size={24} />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-slate-800">Track Progress</h4>
                      <p className="text-[10px] font-medium text-slate-500 leading-snug mt-1">Visualize daily growth and milestones.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
                      <Users size={24} />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-slate-800">Community</h4>
                      <p className="text-[10px] font-medium text-slate-500 leading-snug mt-1">Join a global network of peers.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
                      <Share2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-slate-800">Share Notes</h4>
                      <p className="text-[10px] font-medium text-slate-500 leading-snug mt-1">Collaborate easily with friends.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-slate-800">Easy Access</h4>
                      <p className="text-[10px] font-medium text-slate-500 leading-snug mt-1">Accessible anywhere on any device.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-14 pt-8 border-t border-slate-200 flex flex-col items-center gap-4">
                  <div className="flex gap-6 text-[11px] font-bold text-slate-400 tracking-widest">
                    <button onClick={() => setActivePolicy('privacy')} className="hover:text-indigo-600 transition-colors uppercase">Privacy</button>
                    <button onClick={() => setActivePolicy('terms')} className="hover:text-indigo-600 transition-colors uppercase">Terms</button>
                  </div>
                  <p className="text-[11px] text-slate-400 font-bold tracking-widest">
                    © {new Date().getFullYear()} StudyPro Platforms Inc.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        renderView()
      )}
    </div>
  );
};

export default App;
