import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient.ts';
import { PostsSubTab } from './PostsSubTab.tsx';
import { ConnectionsSubTab } from './ConnectionsSubTab.tsx';

type SubTab = 'posts' | 'connections';

interface CommunityTabProps {
  forceChatUserId?: string | null;
}

export const CommunityTab: React.FC<CommunityTabProps> = ({ forceChatUserId }) => {
  // Restore active sub-tab from localStorage on initialization
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(() => {
    const saved = localStorage.getItem('studypro_active_subtab');
    return (saved as SubTab) || 'posts';
  });
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [targetChatUserId, setTargetChatUserId] = useState<string | null>(null);

  // Persist active sub-tab whenever it changes
  useEffect(() => {
    localStorage.setItem('studypro_active_subtab', activeSubTab);
  }, [activeSubTab]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (forceChatUserId) {
      setTargetChatUserId(forceChatUserId);
      setActiveSubTab('connections');
    }
  }, [forceChatUserId]);

  const handleOpenChatWithUser = (userId: string) => {
    setTargetChatUserId(userId);
    setActiveSubTab('connections');
  };

  const clearTargetChatUser = () => {
    setTargetChatUserId(null);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Tab Switcher */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm self-start shrink-0">
        <button
          onClick={() => {
            setActiveSubTab('posts');
            setTargetChatUserId(null);
          }}
          className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeSubTab === 'posts' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          Post Feed
        </button>
        <button
          onClick={() => setActiveSubTab('connections')}
          className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeSubTab === 'connections' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          Connections
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeSubTab === 'posts' ? (
          <PostsSubTab 
            currentUserId={currentUserId} 
            onOpenChat={handleOpenChatWithUser}
          />
        ) : (
          <ConnectionsSubTab 
            currentUserId={currentUserId} 
            initialChatUserId={targetChatUserId}
            onClearInitialChatUser={clearTargetChatUser}
          />
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};