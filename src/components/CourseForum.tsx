import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare, Send, Trash2, Edit2, Check, X, Users, ArrowLeft, Phone, Bell, BellOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase, Profile } from '../lib/supabase';
import { smsDirectBlast } from '../lib/sms';

// ── Admin SMS Blast Panel ─────────────────────────────────────────────────────
export function AdminSMSPanel() {
  const [message, setMessage] = useState('');
  const [targetMode, setTargetMode] = useState<'all' | 'students' | 'custom'>('all');
  const [customPhones, setCustomPhones] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [phoneStats, setPhoneStats] = useState<{ total: number; withPhone: number; smsEnabled: number } | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('phone_number, sms_notifications_enabled, role')
      .then(({ data }) => {
        if (!data) return;
        const total = data.length;
        const withPhone = data.filter(p => p.phone_number).length;
        const smsEnabled = data.filter(p => p.phone_number && p.sms_notifications_enabled).length;
        setPhoneStats({ total, withPhone, smsEnabled });
      });
  }, []);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      let phones: string[] = [];
      if (targetMode === 'custom') {
        phones = customPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);
      } else {
        const query = supabase
          .from('profiles')
          .select('phone_number')
          .eq('sms_notifications_enabled', true)
          .not('phone_number', 'is', null);
        if (targetMode === 'students') query.eq('role', 'student');
        const { data } = await query;
        phones = (data ?? []).map((r: any) => r.phone_number).filter(Boolean);
      }
      if (phones.length === 0) {
        setResult({ ok: false, text: 'No opted-in phone numbers found for the selected audience.' });
        setSending(false);
        return;
      }
      await smsDirectBlast(phones, message.trim());
      setResult({ ok: true, text: `SMS sent to ${phones.length} recipient(s).` });
      setMessage('');
    } catch (e: any) {
      setResult({ ok: false, text: e.message ?? 'Unknown error' });
    }
    setSending(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
          <Phone size={18} className="text-green-600" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">SMS Blast</p>
          <p className="text-xs text-slate-500">Send automated SMS to students</p>
        </div>
        {phoneStats && (
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-700">{phoneStats.smsEnabled} opted-in</p>
              <p className="text-[10px] text-slate-400">{phoneStats.withPhone}/{phoneStats.total} have numbers</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Audience */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Audience</label>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'students', 'custom'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setTargetMode(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  targetMode === mode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {mode === 'all' ? 'All Users' : mode === 'students' ? 'Students Only' : 'Custom Numbers'}
              </button>
            ))}
          </div>
        </div>

        {targetMode === 'custom' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Numbers</label>
            <textarea
              value={customPhones}
              onChange={e => setCustomPhones(e.target.value)}
              placeholder="+252611234567&#10;+252612345678"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">One per line or comma-separated, E.164 format</p>
          </div>
        )}

        {/* Message */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Message <span className="text-slate-400 font-normal">({message.length}/160 chars)</span>
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message here... (will be prefixed with 'EduApp: ')"
            rows={4}
            maxLength={300}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>

        {/* Send */}
        <button
          onClick={send}
          disabled={!message.trim() || sending}
          className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Phone size={15} />
          )}
          {sending ? 'Sending...' : 'Send SMS'}
        </button>

        {/* Result */}
        {result && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            result.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            {result.text}
          </div>
        )}
      </div>

      {/* Automation info */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <Bell size={12} /> Automated SMS Triggers
        </p>
        <div className="space-y-1">
          {[
            'New course added (enrolled students)',
            'New lesson published (course students)',
            'New quiz published (course students)',
            'Live Arena starts (enrolled students)',
            'Streak at risk — no activity today',
            'Streak broken after consecutive days',
          ].map(t => (
            <div key={t} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
              {t}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-2.5">
          Requires AT_USERNAME &amp; AT_API_KEY secrets configured for Africa&apos;s Talking.
        </p>
      </div>
    </div>
  );
}

// ── Course Forum (per-course scoped chat) ─────────────────────────────────────
interface CourseForumMessage {
  id: string;
  course_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  parent_id: string | null;
}

interface CourseForumMessageWithProfile extends CourseForumMessage {
  profile: Profile;
}

interface CourseForumProps {
  courseId: string;
  courseTitle: string;
  onBack: () => void;
}

export default function CourseForum({ courseId, courseTitle, onBack }: CourseForumProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CourseForumMessageWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [memberCount, setMemberCount] = useState<number>(0);
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
        const { data: messagesData, error: msgError } = await supabase
          .from('course_forum_messages')
          .select('*')
          .eq('course_id', courseId)
          .order('created_at', { ascending: true })
          .limit(200);

        if (msgError) {
          console.error('Error fetching course forum messages:', msgError);
          setLoading(false);
          return;
        }

        if (!messagesData || messagesData.length === 0) {
          setMessages([]);
          setLoading(false);
          return;
        }

        const userIds = [...new Set(messagesData.map(m => m.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        const profilesMap: Record<string, Profile> = {};
        profilesData?.forEach(p => { profilesMap[p.id] = p; });

        const combined = messagesData.map(msg => ({
          ...msg,
          profile: profilesMap[msg.user_id] || {
            id: msg.user_id,
            full_name: 'Unknown',
            role: 'student' as const,
            avatar_url: null,
            bio: null,
            created_at: '',
            category_id: null,
          },
        }));

        setMessages(combined);
      } catch (err) {
        console.error('Error:', err);
      }
      setLoading(false);
    };

    const fetchMemberCount = async () => {
      const { count } = await supabase
        .from('course_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId);
      setMemberCount(count ?? 0);
    };

    fetchMessages();
    fetchMemberCount();

    const channel = supabase
      .channel(`course-forum-${courseId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'course_forum_messages', filter: `course_id=eq.${courseId}` },
        async (payload) => {
          const newMsg = payload.new as CourseForumMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            const existingProfile = prev.find(m => m.user_id === newMsg.user_id)?.profile;
            if (existingProfile) return [...prev, { ...newMsg, profile: existingProfile }];
            supabase.from('profiles').select('*').eq('id', newMsg.user_id).single()
              .then(({ data: p }) => {
                if (p) setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, { ...newMsg, profile: p }];
                });
              });
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'course_forum_messages', filter: `course_id=eq.${courseId}` },
        (payload) => {
          const updated = payload.new as CourseForumMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'course_forum_messages', filter: `course_id=eq.${courseId}` },
        (payload) => {
          const deleted = payload.old as CourseForumMessage;
          setMessages(prev => prev.filter(m => m.id !== deleted.id));
        }
      )
      .subscribe();

    const presenceChannel = supabase
      .channel(`course-forum-presence-${courseId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUsers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, courseId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !user) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    try {
      const { error } = await supabase.from('course_forum_messages').insert({
        course_id: courseId,
        user_id: user.id,
        content,
      });
      if (error) { console.error('Send error:', error); setNewMessage(content); }
    } catch (err) {
      console.error('Error:', err);
      setNewMessage(content);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    await supabase.from('course_forum_messages').delete().eq('id', id);
  };

  const startEdit = (msg: CourseForumMessageWithProfile) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const saveEdit = async () => {
    if (!editContent.trim()) return;
    await supabase.from('course_forum_messages').update({ content: editContent.trim() }).eq('id', editingId!);
    setEditingId(null);
    setEditContent('');
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-rose-500';
      case 'teacher': return 'bg-emerald-500';
      default: return 'bg-blue-500';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-rose-100 text-rose-700';
      case 'teacher': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600">
          <ArrowLeft size={22} />
        </button>
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <MessageSquare size={22} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight truncate">{courseTitle}</h1>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="truncate">{onlineUsers > 0 ? `${onlineUsers} online` : 'Course discussion'}</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
          <Users size={14} className="text-slate-500" />
          <span className="text-xs font-medium text-slate-600">{memberCount} enrolled</span>
        </div>
      </header>

      <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700 font-medium truncate">Only enrolled students, the course teacher, and admins can see this chat.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
              <MessageSquare size={36} className="text-blue-600" />
            </div>
            <p className="text-slate-900 font-semibold text-lg mb-1">Start the discussion</p>
            <p className="text-slate-500 text-sm max-w-xs">
              Ask questions, share insights, and discuss <span className="font-medium text-slate-700">{courseTitle}</span> with your course community.
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.user_id === user?.id;
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="flex-shrink-0 self-end">
                  <div className={`w-9 h-9 rounded-full ${getRoleColor(msg.profile?.role || 'student')} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                    {msg.profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                </div>
                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className={`text-xs font-semibold ${isOwn ? 'text-blue-600' : 'text-slate-700'}`}>
                      {isOwn ? 'You' : (msg.profile?.full_name || 'Unknown')}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getRoleBadge(msg.profile?.role || 'student')}`}>
                      {msg.profile?.role || 'student'}
                    </span>
                  </div>
                  <div className={`relative group rounded-2xl px-4 py-2.5 ${isOwn ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm' : 'bg-white text-slate-800 rounded-bl-sm shadow-sm border border-slate-100'}`}>
                    {editingId === msg.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="w-full min-w-[200px] px-2 py-1 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-800"
                          rows={2}
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => { setEditingId(null); setEditContent(''); }} className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"><X size={14} /></button>
                          <button onClick={saveEdit} className="p-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"><Check size={14} /></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        {isOwn && (
                          <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button onClick={() => startEdit(msg)} className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors shadow-sm"><Edit2 size={12} /></button>
                            <button onClick={() => deleteMessage(msg.id)} className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors shadow-sm"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <span className={`text-[10px] text-slate-400 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                    {formatTime(msg.created_at)}{msg.updated_at && <span className="ml-1">(edited)</span>}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="bg-white border-t border-slate-200 p-3 flex-shrink-0">
        <div className="flex items-end gap-3 bg-slate-50 rounded-2xl p-1.5 border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (newMessage.trim()) sendMessage(e);
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none min-h-[36px] max-h-[120px]"
            style={{ height: 'auto' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            {sending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">Press Enter to send, Shift+Enter for new line</p>
      </form>
    </div>
  );
}
