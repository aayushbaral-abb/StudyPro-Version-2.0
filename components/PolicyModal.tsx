
import React from 'react';
import { X, Shield, FileText } from 'lucide-react';

interface PolicyModalProps {
  type: 'privacy' | 'terms' | null;
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const content = {
    privacy: {
      title: 'Privacy Policy',
      icon: <Shield className="text-indigo-600" size={32} />,
      text: "Your data belongs to you. We’re just here to help you use it. To give you the best experience, we only collect what’s necessary: your basic profile and how you use our tools. We promise to keep your info under lock and key, and we never sell your personal details to third parties. You can view, edit, or delete your data whenever you like. We’ve built this space to be secure so you can focus on your goals without worrying about the digital noise."
    },
    terms: {
      title: 'Terms of Service',
      icon: <FileText className="text-indigo-600" size={32} />,
      text: "Think of this as our mutual agreement to keep this space helpful and safe. We’ve kept it simple: we provide the tools to help you succeed, and you agree to use them with integrity. By stepping inside, you’re joining a community built on respect and shared growth. No fine print, just a solid foundation for your journey."
    }
  };

  const active = content[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="absolute top-4 right-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex flex-col items-center">
            <div className="bg-indigo-50 p-4 rounded-2xl mb-6">
              {active.icon}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 text-center">{active.title}</h2>
            <div className="w-12 h-1 bg-indigo-100 rounded-full mb-8" />
            
            <p className="text-slate-600 leading-relaxed text-lg text-justify">
              {active.text}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
