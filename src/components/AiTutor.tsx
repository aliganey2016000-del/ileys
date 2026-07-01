import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Bot, Send, Mic, MicOff, Volume2, VolumeX,
  Loader2, Sparkles, ArrowLeft, Trash2,
  Radio, AlertCircle,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
}

interface AiTutorPageProps {
  lessonTitle: string;
  lessonContent?: string;
  onClose: () => void;
}

// Speech Recognition type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const QUICK_PROMPTS = [
  'Explain this lesson simply',
  'Give me an example',
  'What are the key points?',
  'Quiz me on this topic',
];

export function AiTutorPage({ lessonTitle, lessonContent, onClose }: AiTutorPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const pendingContinuousModeRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const shouldRestartRef = useRef(false);
  const sendingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Check microphone permission on mount
  useEffect(() => {
    checkMicPermission();
  }, []);

  const checkMicPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      // Never set 'denied' from the Permissions API — it can be stale or wrong.
      // Always allow the user to try; SpeechRecognition will show its own prompt.
      setMicPermission(result.state === 'granted' ? 'granted' : 'prompt');

      result.onchange = () => {
        setMicPermission(result.state === 'granted' ? 'granted' : 'prompt');
      };
    } catch {
      setMicPermission('prompt');
    }
  };

  // Request microphone access — try getUserMedia first, but don't block on it.
  // SpeechRecognition has its own permission system and may work even if getUserMedia fails.
  const requestMicAccess = async (): Promise<boolean> => {
    try {
      // Stop any existing stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }

      // Try getUserMedia to trigger the permission prompt.
      // If this succeeds, great. If it fails, we still try SpeechRecognition
      // because some browsers allow SpeechRecognition even without getUserMedia.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      } catch (getUserMediaError) {
        console.warn('getUserMedia failed, but SpeechRecognition may still work:', getUserMediaError);
        // Don't set denied here — let SpeechRecognition try on its own
      }

      setMicPermission('granted');
      return true;
    } catch (e) {
      console.error('Microphone access error:', e);
      // Still return true — let SpeechRecognition try; it has its own permission flow
      setMicPermission('granted');
      return true;
    }
  };

  // Preload voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        v.name.includes('Google') && v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en-')) || voices[0];
      if (preferred) bestVoiceRef.current = preferred;
    };
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  useEffect(() => { loadSession(); }, []);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, liveTranscript]);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      recognitionRef.current?.abort();
      speechSynthesis.cancel();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const loadSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMessages([getWelcomeMessage()]); setLoadingHistory(false); return; }

      const { data: sessions } = await supabase
        .from('ai_tutor_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('lesson_title', lessonTitle)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (sessions?.[0]) {
        setSessionId(sessions[0].id);
        const { data: msgs } = await supabase
          .from('ai_tutor_messages')
          .select('id, role, content, created_at')
          .eq('session_id', sessions[0].id)
          .order('created_at', { ascending: true });

        if (msgs?.length) {
          setMessages(msgs.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            ts: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })));
        }
      }
    } catch {
      // ignore
    }
    setMessages(prev => prev.length ? prev : [getWelcomeMessage()]);
    setLoadingHistory(false);
  };

  const getWelcomeMessage = (): Message => ({
    id: 'welcome',
    role: 'assistant',
    content: `Hi! I'm your AI tutor for **"${lessonTitle}"**. Ask me anything about this lesson. I'll explain, quiz you, or help you practice!`,
    ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const speakText = useCallback((text: string, msgId?: string, onDone?: () => void) => {
    if (!voiceEnabled) { onDone?.(); return; }

    speechSynthesis.cancel();
    const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').replace(/\n+/g, ' ').trim();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 0.9;
    if (bestVoiceRef.current) utt.voice = bestVoiceRef.current;

    utt.onstart = () => { setSpeaking(true); if (msgId) setSpeakingMsgId(msgId); };
    utt.onend = () => {
      setSpeaking(false);
      setSpeakingMsgId(null);
      onDone?.();
    };
    utt.onerror = () => {
      setSpeaking(false);
      setSpeakingMsgId(null);
      onDone?.();
    };
    speechSynthesis.speak(utt);
  }, [voiceEnabled]);

  const stopSpeaking = useCallback(() => {
    speechSynthesis.cancel();
    setSpeaking(false);
    setSpeakingMsgId(null);
  }, []);

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('ai_tutor_sessions')
        .insert({ user_id: user.id, lesson_title: lessonTitle, lesson_content: lessonContent })
        .select('id')
        .single();
      if (error) throw error;
      setSessionId(data.id);
      return data.id;
    } catch { return null; }
  };

  const sendMessageAndSpeak = useCallback(async (text: string) => {
    if (!text.trim() || sendingRef.current) return;

    sendingRef.current = true;
    stopSpeaking();
    setError(null);
    setLiveTranscript('');

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text.trim(), ts: now };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const sess = await ensureSession();
    if (sess) {
      await supabase.from('ai_tutor_messages').insert({ session_id: sess, role: 'user', content: text.trim() });
    }

    const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg]
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('ai-tutor', {
        body: { messages: apiMessages, lessonTitle, lessonContent },
      });

      if (fnErr || !data?.reply) throw new Error(fnErr?.message || 'No response');

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      if (sess) {
        await supabase.from('ai_tutor_messages').insert({ session_id: sess, role: 'assistant', content: data.reply });
        await supabase.from('ai_tutor_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sess);
      }

      setMessages(prev => [...prev, aiMsg]);

      // Speak response, then restart listening if in continuous mode
      speakText(data.reply, aiMsg.id, () => {
        if (shouldRestartRef.current) {
          setTimeout(() => startSpeechRecognition(), 300);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      sendingRef.current = false;
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }, [messages, sessionId, lessonTitle, lessonContent, speakText, stopSpeaking]);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      setError('Voice input requires Chrome or Edge browser.');
      return;
    }

    stopSpeaking();
    setLiveTranscript('');
    setError(null);

    // Stop any existing recognition before starting a new one
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.continuous = pendingContinuousModeRef.current || continuousMode;
    rec.interimResults = true;

    let lastTranscript = '';

    rec.onstart = () => {
      setListening(true);
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      if (transcript !== lastTranscript) {
        lastTranscript = transcript;
        setLiveTranscript(transcript);
      }
    };

    rec.onerror = (e: Event) => {
      const errorEvent = e as unknown as { error?: string };
      console.error('Speech error:', errorEvent);
      if (errorEvent.error === 'not-allowed' || errorEvent.error === 'service-not-allowed') {
        // Don't permanently mark as denied — getUserMedia already confirmed permission.
        // This error often occurs due to timing or browser quirks, not actual denial.
        // Only set denied if getUserMedia hasn't confirmed permission.
        if (micPermission !== 'granted') {
          setMicPermission('denied');
        }
        setError('Voice input could not start. Please try again.');
        setListening(false);
      } else if (errorEvent.error === 'audio-capture') {
        setError('No microphone found. Please connect a microphone and try again.');
        setListening(false);
      } else if (errorEvent.error === 'network') {
        setError('Network error during voice recognition. Please check your connection.');
        setListening(false);
      } else if (errorEvent.error !== 'no-speech') {
        setError(`Voice error: ${errorEvent.error || 'Unknown'}`);
        setListening(false);
      }
    };

    rec.onend = () => {
      setListening(false);

      // Send the transcript if we have one
      if (lastTranscript.trim()) {
        sendMessageAndSpeak(lastTranscript);
      }

      // Auto restart if in continuous mode (whether or not a message was sent)
      if (shouldRestartRef.current && !sendingRef.current) {
        setTimeout(() => {
          if (shouldRestartRef.current && !sendingRef.current) {
            startSpeechRecognition();
          }
        }, 1000);
      }
    };

    recognitionRef.current = rec;

    try {
      rec.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setError('Could not start microphone. Please check browser permissions.');
    }
  }, [sendMessageAndSpeak, stopSpeaking, continuousMode]);

  const requestAndStartVoice = async (continuous: boolean = false) => {
    setError(null);

    // Check if Speech Recognition is supported
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Voice input requires Chrome or Edge browser. Safari and Firefox do not support this feature.');
      return;
    }

    // If permission already granted, start immediately
    if (micPermission === 'granted') {
      shouldRestartRef.current = continuous;
      setContinuousMode(continuous);
      startSpeechRecognition();
      return;
    }

    // Store the intended mode before showing modal
    pendingContinuousModeRef.current = continuous;
    setShowPermissionModal(true);
  };

  const handlePermissionAllow = async () => {
    setShowPermissionModal(false);
    const continuous = pendingContinuousModeRef.current;
    shouldRestartRef.current = continuous;
    setContinuousMode(continuous);

    const granted = await requestMicAccess();
    if (granted) {
      // Small delay to ensure the getUserMedia stream is fully released
      // before SpeechRecognition tries to access the microphone
      setTimeout(() => {
        startSpeechRecognition();
      }, 300);
    }
  };

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setLiveTranscript('');
    setContinuousMode(false);
  }, []);

  const toggleLiveMode = async () => {
    if (continuousMode || listening) {
      stopListening();
    } else {
      setContinuousMode(true);
      await requestAndStartVoice(true);
    }
  };

  const startSingleVoice = async () => {
    setContinuousMode(false);
    await requestAndStartVoice(false);
  };

  const clearChat = async () => {
    stopSpeaking();
    stopListening();
    if (sessionId) {
      try { await supabase.from('ai_tutor_sessions').delete().eq('id', sessionId); } catch {}
      setSessionId(null);
    }
    setMessages([getWelcomeMessage()]);
    setError(null);
  };

  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-slate-100 to-slate-50">
      {/* Permission Modal */}
      {showPermissionModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mx-auto mb-4">
              <Mic size={32} className="text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-800 mb-2">Allow Microphone Access</h3>
            <p className="text-sm text-center text-slate-600 mb-4">
              To use voice input, please allow microphone access. Your browser will show a permission dialog.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPermissionModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePermissionAllow}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                Allow Microphone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 shadow-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800">
        <button onClick={() => { stopSpeaking(); stopListening(); onClose(); }} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
          <ArrowLeft size={18} className="text-white" />
        </button>

        <div className="relative">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md ${speaking ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-800' : ''}`}>
            <Bot size={22} className="text-white" />
          </div>
          {speaking ? (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-800 animate-pulse" />
          ) : (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-400 border-2 border-slate-800">
              <Sparkles size={6} className="text-white m-0.5" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-blue-300 text-[10px] uppercase tracking-wide font-medium">AI Tutor</p>
          <h2 className="font-semibold text-white text-sm truncate">{lessonTitle}</h2>
        </div>

        <button onClick={() => setVoiceEnabled(v => !v)} className={`w-9 h-9 rounded-full flex items-center justify-center ${voiceEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
          {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        <button onClick={clearChat} className="w-9 h-9 rounded-full bg-rose-500/20 hover:bg-rose-500/30 flex items-center justify-center">
          <Trash2 size={16} className="text-rose-300" />
        </button>
      </div>

      {/* Live mode banner */}
      {(continuousMode || listening) && !showPermissionModal && (
        <div className="shrink-0 px-4 py-2 bg-emerald-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span className="text-white text-xs font-semibold uppercase tracking-wide">
              {listening ? 'LISTENING - SPEAK NOW' : continuousMode ? 'LIVE MODE' : 'MIC ON'}
            </span>
          </div>
          <button onClick={stopListening} className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium">
            Stop
          </button>
        </div>
      )}

      {/* Quick prompts */}
      <div className="shrink-0 px-4 py-2 flex gap-2 overflow-x-auto bg-white/70 border-b">
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => sendMessageAndSpeak(p)} disabled={loading} className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all disabled:opacity-50">
            {p}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="text-blue-500 animate-spin" />
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div className={`max-w-[82%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-gradient-to-br from-slate-700 to-slate-800 text-white rounded-br-sm' : 'bg-white border text-slate-800 rounded-bl-sm shadow-sm'}`}>
                  {renderContent(msg.content)}
                </div>
                {msg.role === 'assistant' && voiceEnabled && (
                  <button onClick={() => speakingMsgId === msg.id ? stopSpeaking() : speakText(msg.content, msg.id)} className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${speakingMsgId === msg.id ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                    {speakingMsgId === msg.id ? (
                      <><span className="flex gap-0.5"><span className="w-0.5 h-2 bg-emerald-500 rounded-full animate-pulse" /><span className="w-0.5 h-3 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} /><span className="w-0.5 h-2 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} /></span> Stop</>
                    ) : <><Volume2 size={13} /> Listen</>}
                  </button>
                )}
                {msg.ts && <span className="text-[10px] text-slate-400 mt-1">{msg.ts}</span>}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-white text-xs font-bold">Me</span>
                </div>
              )}
            </div>
          ))
        )}

        {/* Live transcript */}
        {listening && liveTranscript && (
          <div className="flex gap-2.5 justify-end">
            <div className="max-w-[82%] px-4 py-3 rounded-2xl bg-emerald-100 text-emerald-800 rounded-br-sm animate-pulse">
              {liveTranscript}
            </div>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0 mt-1">
              <span className="text-white text-xs font-bold">Me</span>
            </div>
          </div>
        )}

        {/* Typing */}
        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white border px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
              {[0, 150, 300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-2xl flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Mic permission denied helper */}
        {micPermission === 'denied' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-2xl">
            <p className="font-medium mb-1">Microphone Blocked</p>
            <p className="mb-2">Click the lock/microphone icon in your browser's address bar to allow microphone access, then refresh the page.</p>
            <button
              onClick={async () => {
                setError(null);
                const granted = await requestMicAccess();
                if (granted) {
                  setMicPermission('granted');
                }
              }}
              className="text-xs font-medium text-amber-900 underline hover:text-amber-700"
            >
              Try again
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 bg-white border-t px-4 pt-3 pb-4 shadow-lg">
        {speaking && !continuousMode && (
          <button onClick={stopSpeaking} className="w-full flex items-center justify-center gap-2 mb-2 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <span className="flex gap-0.5"><span className="w-1 h-3 bg-emerald-500 rounded-full animate-bounce" /><span className="w-1 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '80ms' }} /><span className="w-1 h-4 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '160ms' }} /></span>
            Speaking... tap to stop
          </button>
        )}

        <div className="flex items-end gap-2 bg-slate-100 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-blue-400 focus-within:bg-white transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageAndSpeak(input); }}}
            placeholder="Type or use voice below..."
            disabled={loading || listening}
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            {/* Live mode button */}
            <button
              onClick={toggleLiveMode}
              disabled={loading}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${continuousMode || listening ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
              title="Start live conversation (hands-free)"
            >
              <Radio size={20} />
            </button>

            {/* Single mic button */}
            <button
              onClick={listening ? stopListening : startSingleVoice}
              disabled={loading || continuousMode}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${continuousMode ? 'text-slate-300' : listening ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
              title="Single voice input"
            >
              {listening && !continuousMode ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Send button */}
            <button
              onClick={() => sendMessageAndSpeak(input)}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md disabled:opacity-40 hover:shadow-lg transition-all"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-2">
          Works best in Chrome or Edge. AI can make mistakes.
        </p>
      </div>
    </div>
  );
}

interface AiTutorButtonProps {
  onClick: () => void;
}

export function AiTutorButton({ onClick }: AiTutorButtonProps) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:brightness-110 transition-all">
      <Bot size={18} />
      Ask AI Tutor
      <Sparkles size={14} className="text-amber-300" />
    </button>
  );
}
