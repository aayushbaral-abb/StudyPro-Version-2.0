import React, { useState, useEffect, useRef } from 'react';
import { Bell, MessageSquare, Clock } from 'lucide-react';
import { supabase } from '../services/supabaseClient.ts';

interface NotificationItem {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  created_at: string;
}

interface NotificationBellProps {
  userId: string;
  onNotificationClick: (senderId: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ userId, onNotificationClick }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const { data, error, count } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(full_name, avatar_url)', { count: 'exact' })
        .eq('receiver_id', userId)
        .neq('sender_id', userId) 
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTotalUnread(count || 0);
      const mapped = (data || []).map((msg: any) => ({
        id: msg.id,
        sender_id: msg.sender_id,
        sender_name: msg.profiles?.full_name || 'Anonymous peer',
        sender_avatar: msg.profiles?.avatar_url || null,
        content: msg.content,
        created_at: msg.created_at,
      }));
      setNotifications(mapped);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleManualRefresh = () => fetchNotifications();
    window.addEventListener('studypro:refresh_notifications', handleManualRefresh);

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      window.removeEventListener('studypro:refresh_notifications', handleManualRefresh);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (senderId: string) => {
    onNotificationClick(senderId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all ${
          isOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <Bell size={22} />
        {totalUnread > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse shadow-sm" />
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile Backdrop to help close on click outside if layout is tricky */}
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-[1px] z-[1900] md:hidden" onClick={() => setIsOpen(false)} />
          
          <div className="fixed inset-x-4 top-[5.5rem] md:absolute md:inset-x-auto md:top-full md:right-0 md:mt-3 w-auto md:w-96 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-4 zoom-in-95 duration-200 z-[2000]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="text-sm font-black text-slate-900 tracking-widest">Notifications</h3>
              {totalUnread > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {totalUnread} new
                  </span>
                  <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full shadow-sm"></div>
                </div>
              )}
            </div>
            
            <div className="max-h-[60vh] md:max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/30">
              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleItemClick(notif.sender_id)}
                      className="w-full p-4 flex gap-4 bg-white/50 hover:bg-white transition-all text-left group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 shrink-0 border border-white shadow-sm overflow-hidden flex items-center justify-center font-bold text-indigo-600">
                        {notif.sender_avatar ? (
                          <img src={notif.sender_avatar} alt="S" className="w-full h-full object-cover" />
                        ) : (
                          notif.sender_name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[13px] font-black text-slate-900 truncate">
                            {notif.sender_name}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 shrink-0 uppercase">
                            <Clock size={10} /> {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1 italic font-medium">
                          {notif.content}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="text-slate-300" size={24} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">All caught up!</h4>
                  <p className="text-xs text-slate-400 font-medium">No new messages at the moment.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};