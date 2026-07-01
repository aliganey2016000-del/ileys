import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare, Send, Trash2, Edit2, Check, X, Users, ArrowLeft } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase, Profile } from '../lib/supabase';

interface ForumMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  parent_id: string | null;
}

interface ForumMessageWithProfile extends ForumMessage {
  profile: Profile;
}

interface ForumPageProps {
  onBack: () => void;
}

export default function ForumPage({ onBack }: ForumPageProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ForumMessageWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        // Fetch messages
        const { data: messagesData, error: msgError } = await supabase
          .from('forum_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(100);

        if (msgError) {
          console.error('Error fetching messages:', msgError);
          setLoading(false);
          return;
        }

        if (!messagesData || messagesData.length === 0) {
          setMessages([]);
          setLoading(false);
          return;
        }

        // Get unique user IDs
        const userIds = [...new Set(messagesData.map(m => m.user_id))];

        // Fetch profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        const profilesMap: Record<string, Profile> = {};
        profilesData?.forEach(p => {
          profilesMap[p.id] = p;
        });

        // Combine
        const combined = messagesData.map(msg => ({
          ...msg,
          profile: profilesMap[msg.user_id] || {
            id: msg.user_id,
            full_name: 'Unknown',
            role: 'student' as const,
            avatar_url: null,
            bio: null,
            created_at: '',
            category_id: null
          }
        }));

        setMessages(combined);
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel('forum-messages-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'forum_messages' },
        async (payload) => {
          const newMsg = payload.new as ForumMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;

            // Find existing profile
            const existingProfile = prev.find(m => m.user_id === newMsg.user_id)?.profile;

            if (existingProfile) {
              return [...prev, { ...newMsg, profile: existingProfile }];
            }

            // Fetch profile
            supabase
              .from('profiles')
              .select('*')
              .eq('id', newMsg.user_id)
              .single()
              .then(({ data: p }) => {
                if (p) {
                  setMessages(prev => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, { ...newMsg, profile: p }];
                  });
                }
              });

            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'forum_messages' },
        (payload) => {
          const updated = payload.new as ForumMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'forum_messages' },
        (payload) => {
          const deleted = payload.old as ForumMessage;
          setMessages(prev => prev.filter(m => m.id !== deleted.id));
        }
      )
      .subscribe();

    // Presence
    const presenceChannel = supabase
      .channel('forum-presence-rt')
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUsers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !user) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('forum_messages').insert({
        user_id: user.id,
        content
      });

      if (error) {
        console.error('Send error:', error);
        setNewMessage(content);
      }
    } catch (err) {
      console.error('Error:', err);
      setNewMessage(content);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    await supabase.from('forum_messages').delete().eq('id', id);
  };

  const startEdit = (msg: ForumMessageWithProfile) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const saveEdit = async () => {
    if (!editContent.trim()) return;
    await supabase
      .from('forum_messages')
      .update({ content: editContent.trim() })
      .eq('id', editingId!);
    setEditingId(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-rose-500';
      case 'teacher': return 'bg-violet-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <MessageSquare size={22} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-slate-900 text-lg leading-tight">Community Chat</h1>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>{onlineUsers > 0 ? `${onlineUsers} online` : 'Connect with everyone'}</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
          <Users size={14} className="text-slate-500" />
          <span className="text-xs font-medium text-slate-600">All Users</span>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-4">
              <MessageSquare size={36} className="text-emerald-600" />
            </div>
            <p className="text-slate-900 font-semibold text-lg mb-1">Start the conversation</p>
            <p className="text-slate-500 text-sm">Send a message to connect with everyone on the platform</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 self-end">
                  <div className={`w-9 h-9 rounded-full ${getRoleColor(msg.profile?.role || 'student')} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                    {msg.profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className={`text-xs font-semibold ${isOwn ? 'text-blue-600' : 'text-slate-700'}`}>
                      {isOwn ? 'You' : (msg.profile?.full_name || 'Unknown')}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white ${getRoleColor(msg.profile?.role || 'student')}`}>
                      {msg.profile?.role || 'student'}
                    </span>
                  </div>

                  <div
                    className={`relative group rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 rounded-bl-sm shadow-sm border border-slate-100'
                    }`}
                  >
                    {editingId === msg.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full min-w-[200px] px-2 py-1 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-800"
                          rows={2}
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                          >
                            <X size={14} />
                          </button>
                          <button
                            onClick={saveEdit}
                            className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        {isOwn && (
                          <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button
                              onClick={() => startEdit(msg)}
                              className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors shadow-sm"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <span className={`text-[10px] text-slate-400 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.created_at)}
                    {msg.updated_at && <span className="ml-1">(edited)</span>}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="bg-white border-t border-slate-200 p-3 flex-shrink-0">
        <div className="flex items-end gap-3 bg-slate-50 rounded-2xl p-1.5 border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (newMessage.trim()) {
                  sendMessage(e);
                }
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none min-h-[36px] max-h-[120px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-95"
          >
            {sending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={18} strokeWidth={2.5} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}
