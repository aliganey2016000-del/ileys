import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, Quiz, QuizQuestion, QuizOption, QuizAttempt } from '../lib/supabase';
import { logActivity } from '../lib/usePresence';
import {
  CheckCircle, XCircle, Clock, Zap, Award, RotateCcw, ChevronRight,
  Lightbulb, Trophy, Target, Star, Volume2, VolumeX, Play, Pause, RefreshCw,
  AlertCircle, BookOpen, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Sound Engine ───────────────────────────────────────────────────────────────
function playTone(freq: number, type: OscillatorType, duration: number, gain = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close(), (duration + 0.1) * 1000);
  } catch {}
}

function playCorrect() {
  playTone(523, 'sine', 0.12);
  setTimeout(() => playTone(659, 'sine', 0.12), 100);
  setTimeout(() => playTone(784, 'sine', 0.25), 200);
}

function playWrong() {
  playTone(300, 'sawtooth', 0.08, 0.18);
  setTimeout(() => playTone(250, 'sawtooth', 0.15, 0.18), 80);
}

function playExcellent() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.18, 0.25), i * 90));
}

// ── Encouragement Messages ─────────────────────────────────────────────────────
const CORRECT_MESSAGES = [
  { label: 'Excellent!', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  { label: 'Great Job!', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { label: 'Well Done!', color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' },
  { label: 'Perfect!', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  { label: 'Awesome!', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  { label: 'Keep It Up!', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
];
const WRONG_MESSAGES = [
  { label: 'Almost! Try Again', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
  { label: "Don't Give Up!", color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { label: 'Keep Practicing!', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  { label: 'You Can Do It!', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
];

const CONFETTI_COLORS = [
  '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6',
  '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1',
  '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa',
];

function playCelebrationSound(percentage: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const bufSize = Math.floor(ctx.sampleRate * 3);
    const buf = ctx.createBuffer(2, bufSize, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    const noiseGain = ctx.createGain();
    const vol = percentage >= 70 ? 0.12 : 0.06;
    noiseGain.gain.setValueAtTime(0, ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.5);
    noiseGain.gain.setValueAtTime(vol, ctx.currentTime + 2.0);
    noiseGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 0.6;
    noiseSrc.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSrc.start();
    if (percentage === 100) {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
        setTimeout(() => playTone(f, 'sine', 0.4, 0.35), i * 130)
      );
    } else if (percentage >= 70) {
      [523, 659, 784].forEach((f, i) =>
        setTimeout(() => playTone(f, 'sine', 0.3, 0.28), i * 150)
      );
    }
    setTimeout(() => ctx.close(), 4000);
  } catch {}
}

function getEncouragement(correct: boolean, streak = 0) {
  if (correct && streak >= 3) {
    playExcellent();
    return { label: `${streak} in a row!`, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
  }
  if (correct) {
    playCorrect();
    const msgs = CORRECT_MESSAGES;
    return msgs[Math.floor(Math.random() * msgs.length)];
  }
  playWrong();
  const msgs = WRONG_MESSAGES;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ── Encouragement Bubble ───────────────────────────────────────────────────────
function EncouragementBubble({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border text-sm font-bold animate-bounce-once ${color} ${bg}`}>
      <Star size={14} className="fill-current" />
      {label}
    </div>
  );
}

// ── Multiple Choice ────────────────────────────────────────────────────────────
interface MultipleChoiceProps {
  question: QuizQuestion;
  options: QuizOption[];
  onAnswer: (optionId: string, isCorrect: boolean) => void;
  showResult?: boolean;
  selectedId?: string | null;
  disabled?: boolean;
  encouragement?: { label: string; color: string; bg: string } | null;
  onPreselect?: (optionId: string) => void;
}

export function MultipleChoiceQuestion({
  question, options, onAnswer, showResult = false, selectedId = null, disabled = false, encouragement, onPreselect
}: MultipleChoiceProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(selectedId);
  const selected = onPreselect ? selectedId : internalSelected;
  const [showHint, setShowHint] = useState(false);

  const handleSelect = (optionId: string) => {
    if (disabled || showResult) return;
    if (onPreselect) {
      onPreselect(optionId);
      return;
    }
    setInternalSelected(optionId);
    const opt = options.find(o => o.id === optionId);
    onAnswer(optionId, opt?.is_correct || false);
  };

  const getOptionClass = (option: QuizOption) => {
    if (showResult && option.is_correct) {
      return 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200';
    }
    if (showResult && selected === option.id && !option.is_correct) {
      return 'border-red-400 bg-red-50';
    }
    if (!showResult && selected === option.id) {
      return 'border-blue-500 bg-blue-50 ring-2 ring-blue-200';
    }
    if (showResult) return 'border-slate-100 bg-slate-50 text-slate-400';
    return 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98]';
  };

  return (
    <div className="space-y-4">
      <p className="text-base sm:text-lg font-semibold text-slate-800 leading-relaxed">
        {question.question_text}
      </p>

      {question.hint && !showResult && (
        <button
          onClick={() => setShowHint(!showHint)}
          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
        >
          <Lightbulb size={12} /> {showHint ? 'Hide Hint' : 'Show Hint'}
        </button>
      )}
      {showHint && question.hint && (
        <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
          {question.hint}
        </p>
      )}

      <div className="grid gap-2 sm:gap-3">
        {options.map((option, idx) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            disabled={disabled || showResult}
            className={`w-full text-left px-4 py-3 sm:px-5 sm:py-4 rounded-2xl border-2 transition-all duration-200 ${getOptionClass(option)}`}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="font-medium text-sm sm:text-base">{option.option_text}</span>
              {showResult && option.is_correct && (
                <CheckCircle size={18} className="text-emerald-500 ml-auto shrink-0" />
              )}
              {showResult && selected === option.id && !option.is_correct && (
                <XCircle size={18} className="text-red-500 ml-auto shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {showResult && encouragement && (
        <div className="flex justify-center pt-1">
          <EncouragementBubble {...encouragement} />
        </div>
      )}

      {showResult && question.explanation && (
        <div className={`p-3 sm:p-4 rounded-xl text-sm ${selected && options.find(o => o.id === selected)?.is_correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <p className="font-semibold mb-1">
            {selected && options.find(o => o.id === selected)?.is_correct ? 'Correct!' : 'Explanation:'}
          </p>
          <p className="text-slate-700">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ── Fill in the Blank ──────────────────────────────────────────────────────────
interface FillBlankProps {
  question: QuizQuestion;
  correctAnswers: QuizOption[];
  onAnswer: (answer: string, isCorrect: boolean) => void;
  showResult?: boolean;
  userAnswer?: string | null;
  disabled?: boolean;
  encouragement?: { label: string; color: string; bg: string } | null;
}

export function FillBlankQuestion({
  question, correctAnswers, onAnswer, showResult = false, userAnswer = null, disabled = false, encouragement
}: FillBlankProps) {
  const [answer, setAnswer] = useState(userAnswer || '');
  const [submitted, setSubmitted] = useState(showResult);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showResult && inputRef.current) inputRef.current.focus();
  }, [showResult]);

  const handleSubmit = () => {
    if (disabled || submitted || !answer.trim()) return;
    const isCorrect = correctAnswers.some(
      ca => ca.option_text.toLowerCase().trim() === answer.toLowerCase().trim()
    );
    setSubmitted(true);
    onAnswer(answer, isCorrect);
  };

  const isCorrect = correctAnswers.some(
    ca => ca.option_text.toLowerCase().trim() === answer.toLowerCase().trim()
  );

  return (
    <div className="space-y-4">
      <p className="text-base sm:text-lg font-semibold text-slate-800">{question.question_text}</p>

      <div className="flex gap-2 sm:gap-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            disabled={submitted || disabled}
            placeholder="Type your answer..."
            className={`w-full px-4 py-3 sm:px-5 sm:py-4 rounded-2xl border-2 font-medium transition-all focus:outline-none text-sm sm:text-base ${
              submitted
                ? isCorrect
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                  : 'border-red-400 bg-red-50'
                : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
            }`}
          />
          {submitted && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isCorrect
                ? <CheckCircle size={20} className="text-emerald-500" />
                : <XCircle size={20} className="text-red-500" />}
            </div>
          )}
        </div>
        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || disabled}
            className="px-4 sm:px-6 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap"
          >
            Check
          </button>
        )}
      </div>

      {submitted && encouragement && (
        <div className="flex justify-center">
          <EncouragementBubble {...encouragement} />
        </div>
      )}

      {submitted && !isCorrect && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
          <p className="font-semibold text-amber-800 mb-1">Correct answer:</p>
          <p className="text-amber-700">{correctAnswers.map(ca => ca.option_text).join(', ')}</p>
          {question.explanation && <p className="text-amber-600 mt-2">{question.explanation}</p>}
        </div>
      )}
    </div>
  );
}

// ── Matching Exercise (tap-to-match, fully responsive) ─────────────────────────
interface MatchingExerciseProps {
  question: QuizQuestion;
  options: QuizOption[];
  onAnswer: (matches: Record<string, string>, isCorrect: boolean) => void;
  showResult?: boolean;
  disabled?: boolean;
  encouragement?: { label: string; color: string; bg: string } | null;
}

export function MatchingExercise({ question, options, onAnswer, showResult = false, disabled = false, encouragement }: MatchingExerciseProps) {
  const leftItems = options.filter(o => o.sort_order <= 4).sort((a, b) => a.sort_order - b.sort_order);
  const rightItems = options.filter(o => o.sort_order > 4).sort((a, b) => a.sort_order - b.sort_order);

  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [shuffledRight] = useState<QuizOption[]>(() => [...rightItems].sort(() => Math.random() - 0.5));
  const [submitted, setSubmitted] = useState(false);

  const handleLeftTap = (id: string) => {
    if (disabled || showResult || submitted) return;
    setSelectedLeft(prev => (prev === id ? null : id));
  };

  const handleRightTap = (rightId: string) => {
    if (disabled || showResult || submitted) return;
    if (!selectedLeft) return;
    const newMatches = { ...matches, [selectedLeft]: rightId };
    setMatches(newMatches);
    setSelectedLeft(null);
    if (Object.keys(newMatches).length === leftItems.length) {
      const allCorrect = leftItems.every(left => {
        const matched = options.find(o => o.id === newMatches[left.id]);
        return matched?.match_key === left.match_key;
      });
      setSubmitted(true);
      onAnswer(newMatches, allCorrect);
    }
  };

  const clearMatch = (leftId: string) => {
    if (disabled || showResult || submitted) return;
    setMatches(prev => {
      const next = { ...prev };
      delete next[leftId];
      return next;
    });
  };

  const getMatchStatus = (leftId: string) => {
    const leftItem = leftItems.find(l => l.id === leftId);
    const matched = options.find(o => o.id === matches[leftId]);
    return matched?.match_key === leftItem?.match_key;
  };

  const isRightUsed = (rightId: string) => Object.values(matches).includes(rightId);

  return (
    <div className="space-y-4">
      <p className="text-base sm:text-lg font-semibold text-slate-800">{question.question_text}</p>
      <p className="text-xs text-slate-500">Tap a word, then tap its matching definition.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Left column */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Words</p>
          {leftItems.map((left) => {
            const matchedRight = options.find(o => o.id === matches[left.id]);
            const isSelected = selectedLeft === left.id;
            const isMatched = !!matches[left.id];
            const status = (showResult || submitted) ? getMatchStatus(left.id) : null;

            return (
              <button
                key={left.id}
                onClick={() => isMatched ? clearMatch(left.id) : handleLeftTap(left.id)}
                disabled={disabled || (showResult || submitted)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${
                  status === true
                    ? 'border-emerald-500 bg-emerald-50'
                    : status === false
                    ? 'border-red-400 bg-red-50'
                    : isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 scale-[1.02]'
                    : isMatched
                    ? 'border-teal-400 bg-teal-50'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98]'
                }`}
              >
                <span className="text-slate-700">{left.option_text}</span>
                {isMatched && matchedRight && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-teal-600">
                    <ChevronRight size={12} />
                    <span className="truncate">{matchedRight.option_text}</span>
                    {!showResult && !submitted && (
                      <span className="ml-auto text-slate-400 text-[10px]">tap to clear</span>
                    )}
                    {(showResult || submitted) && status === true && <CheckCircle size={14} className="text-emerald-500 ml-auto shrink-0" />}
                    {(showResult || submitted) && status === false && <XCircle size={14} className="text-red-500 ml-auto shrink-0" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Definitions</p>
          {shuffledRight.map((right) => {
            const used = isRightUsed(right.id);
            return (
              <button
                key={right.id}
                onClick={() => handleRightTap(right.id)}
                disabled={disabled || used || showResult || submitted || !selectedLeft}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 text-sm ${
                  used
                    ? 'border-slate-100 bg-slate-100 text-slate-400 opacity-60 cursor-default'
                    : selectedLeft
                    ? 'border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 cursor-pointer active:scale-[0.98]'
                    : 'border-slate-200 bg-white text-slate-600 cursor-default'
                }`}
              >
                {right.option_text}
              </button>
            );
          })}
        </div>
      </div>

      {selectedLeft && !submitted && (
        <p className="text-xs text-blue-600 text-center animate-pulse">
          Now tap the matching definition on the right
        </p>
      )}

      {(showResult || submitted) && encouragement && (
        <div className="flex justify-center pt-1">
          <EncouragementBubble {...encouragement} />
        </div>
      )}
    </div>
  );
}

// ── Listening Question Component ───────────────────────────────────────────────────
interface ListeningQuestionProps {
  question: QuizQuestion;
  options: QuizOption[];
  onAnswer: (optionId: string, isCorrect: boolean) => void;
  showResult?: boolean;
  selectedId?: string | null;
  disabled?: boolean;
  encouragement?: { label: string; color: string; bg: string } | null;
  onPreselect?: (optionId: string) => void;
}

export function ListeningQuestion({
  question, options, onAnswer, showResult = false, selectedId = null, disabled = false, encouragement, onPreselect
}: ListeningQuestionProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(selectedId);
  const selected = onPreselect ? selectedId : internalSelected;
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const rawAudioUrl = question.question_audio_url;
  const isTTS = rawAudioUrl?.startsWith('tts:');
  const ttsText = isTTS ? rawAudioUrl!.slice(4) : '';
  const audioUrl = isTTS ? null : rawAudioUrl;

  const handlePlay = () => {
    if (isTTS) {
      if (isPlaying) {
        speechSynthesis.cancel();
        setIsPlaying(false);
        return;
      }
      const utt = new SpeechSynthesisUtterance(ttsText);
      utt.rate = 0.85;
      utt.onend = () => setIsPlaying(false);
      utt.onerror = () => setIsPlaying(false);
      speechSynthesis.speak(utt);
      setIsPlaying(true);
      setPlayCount(prev => prev + 1);
      setHasPlayed(true);
      return;
    }
    if (!audioUrl || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      setPlayCount(prev => prev + 1);
      setHasPlayed(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleSelect = (optionId: string) => {
    if (disabled || showResult) return;
    if (onPreselect) {
      onPreselect(optionId);
      return;
    }
    setInternalSelected(optionId);
    const opt = options.find(o => o.id === optionId);
    onAnswer(optionId, opt?.is_correct || false);
  };

  const getOptionClass = (option: QuizOption) => {
    if (showResult && option.is_correct) {
      return 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200';
    }
    if (showResult && selected === option.id && !option.is_correct) {
      return 'border-red-400 bg-red-50';
    }
    if (!showResult && selected === option.id) {
      return 'border-blue-500 bg-blue-50 ring-2 ring-blue-200';
    }
    if (showResult) return 'border-slate-100 bg-slate-50 text-slate-400';
    if (!hasPlayed) return 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed';
    return 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98]';
  };

  if (!rawAudioUrl) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
        <AlertCircle size={18} className="inline mr-2" />
        Audio not available for this question
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-base sm:text-lg font-semibold text-slate-800 leading-relaxed">
        {question.question_text || 'Listen and choose the correct answer'}
      </p>

      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-4 sm:p-5 border border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlay}
            disabled={disabled}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-105'
            }`}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Volume2 size={16} className="text-blue-600" />
              <span className="font-semibold text-slate-700">
                {isPlaying ? 'Playing audio...' : 'Click to play'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <RefreshCw size={12} /> {playCount} plays
              </span>
              {!hasPlayed && (
                <span className="text-amber-600 font-medium">Listen first to unlock answers</span>
              )}
            </div>
          </div>
        </div>

        {!isTTS && audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={handleAudioEnded}
            onError={() => setIsPlaying(false)}
          />
        )}
        {isTTS && (
          <p className="text-xs text-slate-400 mt-2 italic">Browser voice synthesis</p>
        )}

        {question.hint && (
          <div className="mt-3 pt-3 border-t border-slate-200 text-sm text-slate-600">
            <Lightbulb size={14} className="inline mr-1 text-amber-500" />
            {question.hint}
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:gap-3">
        {options.map((option, idx) => (
          <button
            key={option.id}
            onClick={() => hasPlayed && handleSelect(option.id)}
            disabled={disabled || showResult || !hasPlayed}
            className={`w-full text-left px-4 py-3 sm:px-5 sm:py-4 rounded-2xl border-2 transition-all duration-200 ${getOptionClass(option)}`}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="font-medium text-sm sm:text-base">{option.option_text}</span>
              {showResult && option.is_correct && (
                <CheckCircle size={18} className="text-emerald-500 ml-auto shrink-0" />
              )}
              {showResult && selected === option.id && !option.is_correct && (
                <XCircle size={18} className="text-red-500 ml-auto shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {showResult && encouragement && (
        <div className="flex justify-center pt-1">
          <EncouragementBubble {...encouragement} />
        </div>
      )}

      {showResult && question.explanation && (
        <div className={`p-3 sm:p-4 rounded-xl text-sm ${selected && options.find(o => o.id === selected)?.is_correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <p className="font-semibold mb-1">
            {selected && options.find(o => o.id === selected)?.is_correct ? 'Correct!' : 'Explanation:'}
          </p>
          <p className="text-slate-700">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ── Listen and Write Question ──────────────────────────────────────────────────
interface ListenWriteProps {
  question: QuizQuestion;
  correctAnswers: QuizOption[];
  onAnswer: (answer: string, isCorrect: boolean) => void;
  showResult?: boolean;
  userAnswer?: string | null;
  disabled?: boolean;
  encouragement?: { label: string; color: string; bg: string } | null;
}

export function ListenWriteQuestion({
  question, correctAnswers, onAnswer, showResult = false, userAnswer = null, disabled = false, encouragement
}: ListenWriteProps) {
  const [answer, setAnswer] = useState(userAnswer || '');
  const [submitted, setSubmitted] = useState(showResult);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawAudioUrl = question.question_audio_url;
  const isTTS = rawAudioUrl?.startsWith('tts:');
  const ttsText = isTTS ? rawAudioUrl!.slice(4) : '';
  const audioUrl = isTTS ? null : rawAudioUrl;

  useEffect(() => {
    if (hasPlayed && !showResult && inputRef.current) inputRef.current.focus();
  }, [hasPlayed, showResult]);

  const handlePlay = () => {
    if (isTTS) {
      if (isPlaying) { speechSynthesis.cancel(); setIsPlaying(false); return; }
      const utt = new SpeechSynthesisUtterance(ttsText);
      utt.rate = 0.8;
      utt.onend = () => setIsPlaying(false);
      speechSynthesis.speak(utt);
      setIsPlaying(true);
      setPlayCount(prev => prev + 1);
      setHasPlayed(true);
      return;
    }
    if (!audioUrl || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      setPlayCount(prev => prev + 1);
      setHasPlayed(true);
    }
  };

  const handleSubmit = () => {
    if (disabled || submitted || !answer.trim()) return;
    const isCorrect = correctAnswers.some(
      ca => ca.option_text.toLowerCase().trim() === answer.toLowerCase().trim()
    );
    setSubmitted(true);
    onAnswer(answer, isCorrect);
  };

  const isCorrect = correctAnswers.some(
    ca => ca.option_text.toLowerCase().trim() === answer.toLowerCase().trim()
  );

  return (
    <div className="space-y-4">
      <p className="text-base sm:text-lg font-semibold text-slate-800">
        {question.question_text || 'Listen and write what you hear'}
      </p>

      {/* Audio Player */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlay}
            disabled={disabled}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200 hover:scale-105'
            }`}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {isPlaying ? 'Playing...' : playCount === 0 ? 'Listen to the audio' : `Played ${playCount}x — listen again?`}
            </p>
            {isTTS && <p className="text-xs text-slate-400 italic">Browser voice synthesis</p>}
            {!hasPlayed && <p className="text-xs text-amber-600 font-medium mt-0.5">Listen first, then type</p>}
          </div>
        </div>
        {!isTTS && audioUrl && (
          <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} onError={() => setIsPlaying(false)} />
        )}
      </div>

      {/* Text input */}
      <div className="flex gap-2 sm:gap-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            disabled={submitted || disabled || !hasPlayed}
            placeholder={hasPlayed ? 'Type what you heard...' : 'Listen to the audio first'}
            className={`w-full px-4 py-3 rounded-2xl border-2 font-medium transition-all focus:outline-none text-sm sm:text-base ${
              !hasPlayed
                ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                : submitted
                  ? isCorrect
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-red-400 bg-red-50'
                  : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
            }`}
          />
          {submitted && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isCorrect
                ? <CheckCircle size={20} className="text-emerald-500" />
                : <XCircle size={20} className="text-red-500" />}
            </div>
          )}
        </div>
        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || disabled || !hasPlayed}
            className="px-4 sm:px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
          >
            Check
          </button>
        )}
      </div>

      {submitted && encouragement && (
        <div className="flex justify-center">
          <EncouragementBubble {...encouragement} />
        </div>
      )}

      {submitted && (
        <div className={`p-3 rounded-xl text-sm ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          {!isCorrect && (
            <>
              <p className="font-semibold text-amber-800 mb-1">Correct answer:</p>
              <p className="text-amber-700">{correctAnswers.map(ca => ca.option_text).join(', ')}</p>
            </>
          )}
          {question.explanation && (
            <p className={`${!isCorrect ? 'mt-2 ' : ''}text-slate-600`}>{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Flash Card Question ────────────────────────────────────────────────────────
interface FlashCardQuestionProps {
  question: QuizQuestion;
  correctAnswers: QuizOption[];
  onAnswer: (answer: string, isCorrect: boolean) => void;
  showResult?: boolean;
  userAnswer?: string | null;
  disabled?: boolean;
  encouragement?: { label: string; color: string; bg: string } | null;
}

export function FlashCardQuestion({
  question, correctAnswers, onAnswer, showResult = false, userAnswer = null, disabled = false, encouragement
}: FlashCardQuestionProps) {
  const [flipped, setFlipped] = useState(showResult);
  const [submitted, setSubmitted] = useState(showResult);
  const [answer, setAnswer] = useState(userAnswer || '');

  const correctText = correctAnswers[0]?.option_text?.trim() ?? '';
  const isCorrect = answer.trim().toLowerCase() === correctText.toLowerCase();

  const handleSubmit = () => {
    if (disabled || submitted || !answer.trim()) return;
    setSubmitted(true);
    onAnswer(answer, isCorrect);
  };

  return (
    <div className="space-y-5">
      <p className="text-base sm:text-lg font-semibold text-slate-800">{question.question_text}</p>

      {/* Flash Card */}
      <div
        className="relative w-full max-w-md mx-auto aspect-[4/3] cursor-pointer"
        onClick={() => !submitted && setFlipped(!flipped)}
      >
        <div
          className={`absolute inset-0 rounded-2xl border-2 border-slate-200 bg-white shadow-lg transition-all duration-500 ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
          style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold mb-3">
              F
            </div>
            <p className="text-xl font-semibold text-slate-800 text-center leading-relaxed">{question.question_text}</p>
            <p className="mt-4 text-xs text-slate-400">Click to flip</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold mb-3">
              B
            </div>
            <p className="text-xl font-semibold text-slate-800 text-center leading-relaxed">{correctText}</p>
            <p className="mt-4 text-xs text-slate-400">Click to flip back</p>
          </div>
        </div>
      </div>

      {/* Answer input */}
      {!submitted && (
        <div className="flex gap-2 sm:gap-3 max-w-md mx-auto">
          <div className="relative flex-1">
            <input
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Type your answer before flipping..."
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white font-medium transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || disabled}
            className="px-4 sm:px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
          >
            Check
          </button>
        </div>
      )}

      {submitted && (
        <div className={`p-4 rounded-2xl text-sm max-w-md mx-auto ${isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {isCorrect ? <CheckCircle size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-red-500" />}
            <span className={`font-semibold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
              {isCorrect ? 'Correct!' : 'Not quite'}
            </span>
          </div>
          {!isCorrect && (
            <p className="text-amber-700">
              <span className="font-semibold">Correct answer: </span>{correctText}
            </p>
          )}
          {question.explanation && (
            <p className={`mt-2 ${isCorrect ? 'text-emerald-600' : 'text-amber-600'}`}>{question.explanation}</p>
          )}
        </div>
      )}

      {submitted && encouragement && (
        <div className="flex justify-center">
          <EncouragementBubble {...encouragement} />
        </div>
      )}
    </div>
  );
}

// ── Timer Component ────────────────────────────────────────────────────────────
export function QuizTimer({ seconds, onTimeUp, isPaused = false, warningThreshold = 30 }: {
  seconds: number; onTimeUp: () => void; isPaused?: boolean; warningThreshold?: number;
}) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (isPaused || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); onTimeUp(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, onTimeUp]);

  const isWarning = timeLeft <= warningThreshold;
  const isCritical = timeLeft <= 10;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className={`flex items-center gap-2 sm:gap-3 px-3 py-2 rounded-xl transition-colors ${
      isCritical ? 'bg-red-100 text-red-600 animate-pulse' :
      isWarning ? 'bg-red-50 text-red-600' :
      'bg-slate-100 text-slate-700'
    }`}>
      <Clock size={16} className={isWarning ? 'animate-pulse' : ''} />
      <span className="font-mono font-bold text-base sm:text-lg">{mins}:{secs.toString().padStart(2, '0')}</span>
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all rounded-full ${
            isCritical ? 'bg-red-500' :
            isWarning ? 'bg-orange-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${((seconds - timeLeft) / seconds) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Section configuration ──────────────────────────────────────────────────────
const TYPE_ORDER_LIST = ['multiple_choice', 'fill_blank', 'matching_pair', 'listening', 'listen_write', 'flash_card'];
const TYPE_CFG: Record<string, { title: string; emoji: string; gradA: string; gradB: string }> = {
  multiple_choice: { title: 'Multiple Choice',   emoji: '❓', gradA: '#3b82f6', gradB: '#6366f1' },
  fill_blank:      { title: 'Fill in the Blank', emoji: '✏️',  gradA: '#10b981', gradB: '#0d9488' },
  matching_pair:   { title: 'Matching Pairs',    emoji: '🔗', gradA: '#8b5cf6', gradB: '#7c3aed' },
  listening:       { title: 'Listening',          emoji: '🎧', gradA: '#0ea5e9', gradB: '#0284c7' },
  listen_write:    { title: 'Listen & Write',    emoji: '🎤', gradA: '#f59e0b', gradB: '#d97706' },
  flash_card:      { title: 'Flash Cards',        emoji: '🃏', gradA: '#ef4444', gradB: '#dc2626' },
};
const NEEDS_CONTAINER_CHECK = new Set(['multiple_choice', 'listening']);

// ── Petal animation ────────────────────────────────────────────────────────────
function PetalBurst() {
  const petals = useMemo(() => [...Array(20)].map((_, i) => ({
    id: i,
    left: `${(i / 20) * 100 + (Math.random() - 0.5) * 6}%`,
    delay: `${Math.random() * 0.5}s`,
    dur: `${0.9 + Math.random() * 0.7}s`,
    emoji: ['🌸', '🌺', '🌼', '✨', '🌸', '💫', '🌸', '⭐'][Math.floor(Math.random() * 8)],
    size: `${14 + Math.floor(Math.random() * 14)}px`,
  })), []);
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {petals.map(p => (
        <div key={p.id} className="absolute top-0 select-none animate-petal-fall"
          style={{ left: p.left, fontSize: p.size, animationDelay: p.delay, animationDuration: p.dur }}>
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

// ── Quiz Container ─────────────────────────────────────────────────────────────
interface QuizContainerProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  options: QuizOption[];
  userId: string;
  onComplete: (score: number, maxScore: number, xpEarned: number) => void;
  onBack?: () => void;
  timeLimit?: number;
}

type QuizPhase = 'section_intro' | 'question' | 'section_done' | 'finished';

export function QuizContainer({ quiz, questions, options, userId, onComplete, onBack, timeLimit }: QuizContainerProps) {
  // Group questions by type maintaining TYPE_ORDER_LIST order
  const sections = useMemo(() => {
    const grouped = new Map<string, QuizQuestion[]>();
    for (const q of questions) {
      if (!grouped.has(q.question_type)) grouped.set(q.question_type, []);
      grouped.get(q.question_type)!.push(q);
    }
    return TYPE_ORDER_LIST.filter(t => grouped.has(t)).map(t => ({
      type: t,
      cfg: TYPE_CFG[t] || { title: t, emoji: '❓', gradA: '#3b82f6', gradB: '#6366f1' },
      questions: grouped.get(t)!,
    }));
  }, [questions]);

  const isSectioned = sections.length > 1;

  const [phase, setPhase] = useState<QuizPhase>(isSectioned ? 'section_intro' : 'question');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [qIdxInSection, setQIdxInSection] = useState(0);
  const [allAnswers, setAllAnswers] = useState<Record<string, { isCorrect: boolean; optionId?: string; text?: string }>>({});
  const [currentAnswered, setCurrentAnswered] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [encouragement, setEncouragement] = useState<{ label: string; color: string; bg: string } | null>(null);
  const [showPetals, setShowPetals] = useState(false);
  const [streak, setStreak] = useState(0);
  const [startTime] = useState(Date.now());
  const [quizAttempt, setQuizAttempt] = useState<QuizAttempt | null>(null);
  const [completionData, setCompletionData] = useState<{ finalScore: number; maxScore: number; percentage: number; passed: boolean; timeTaken: number; xpEarned: number } | null>(null);

  useEffect(() => {
    if (quiz?.id) {
      logActivity({
        action: 'quiz_start',
        description: `Started quiz "${quiz.title}"`,
        page: 'quiz',
        metadata: { quiz_id: quiz.id, quiz_type: quiz.quiz_type },
      });
    }
  }, [quiz?.id]);

  const currentSection = sections[sectionIdx];
  const currentQuestion = currentSection?.questions[qIdxInSection];
  const currentOptions = options.filter(o => o.question_id === currentQuestion?.id);
  const overallTotal = questions.length;
  const overallDone = Object.keys(allAnswers).length;
  const overallProgress = overallTotal > 0 ? (overallDone / overallTotal) * 100 : 0;
  const correctCount = Object.values(allAnswers).filter(a => a.isCorrect).length;
  const isLastQInSection = currentSection ? qIdxInSection === currentSection.questions.length - 1 : false;
  const isLastSection = sectionIdx === sections.length - 1;

  const triggerPetals = () => {
    setShowPetals(true);
    setTimeout(() => setShowPetals(false), 1800);
  };

  const handleAnswer = useCallback((qId: string, optionId: string | undefined, text: string | undefined, isCorrect: boolean) => {
    const newStreak = isCorrect ? streak + 1 : 0;
    setStreak(newStreak);
    setEncouragement(getEncouragement(isCorrect, newStreak));
    setAllAnswers(prev => ({ ...prev, [qId]: { isCorrect, optionId, text } }));
    setCurrentAnswered(true);
    if (isCorrect) triggerPetals();
  }, [streak]);

  const handleContainerCheck = () => {
    if (!currentQuestion || !pendingSelection || currentAnswered) return;
    const opt = currentOptions.find(o => o.id === pendingSelection);
    handleAnswer(currentQuestion.id, pendingSelection, undefined, opt?.is_correct || false);
  };

  const advanceQuestion = () => {
    setQIdxInSection(prev => prev + 1);
    setPendingSelection(null);
    setCurrentAnswered(false);
    setEncouragement(null);
  };

  const handleNext = () => {
    if (!currentSection) return;
    if (isLastQInSection) {
      if (isLastSection) {
        doFinish();
      } else {
        setPhase('section_done');
      }
    } else {
      advanceQuestion();
    }
  };

  const handleNextSection = () => {
    setSectionIdx(prev => prev + 1);
    setQIdxInSection(0);
    setPendingSelection(null);
    setCurrentAnswered(false);
    setEncouragement(null);
    setPhase('section_intro');
  };

  const doFinish = async () => {
    if (completionData) return;
    const finalScore = Object.values(allAnswers).reduce((acc, a) => acc + (a.isCorrect ? 10 : 0), 0);
    const maxScore = questions.length * 10;
    const percentage = maxScore > 0 ? Math.round((finalScore / maxScore) * 100) : 0;
    const passed = percentage >= quiz.passing_score;
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const isPerfect = percentage === 100;
    const xpEarned = isPerfect
      ? quiz.xp_reward + quiz.bonus_xp_perfect
      : passed ? quiz.xp_reward : Math.floor(quiz.xp_reward * (percentage / 100));

    if (isPerfect) playExcellent();
    else if (passed) playCorrect();

    const data = { finalScore, maxScore, percentage, passed, timeTaken, xpEarned };
    setCompletionData(data);
    setPhase('finished');
    onComplete(finalScore, maxScore, xpEarned);

    const { data: existingAttempts } = await supabase
      .from('quiz_attempts').select('attempt_number')
      .eq('quiz_id', quiz.id).eq('student_id', userId)
      .order('attempt_number', { ascending: false }).limit(1);

    const nextAttemptNumber = existingAttempts?.length ? (existingAttempts[0].attempt_number || 0) + 1 : 1;
    const { data: attempt } = await supabase.from('quiz_attempts').insert({
      quiz_id: quiz.id, student_id: userId,
      score: finalScore, max_score: maxScore, percentage, passed,
      time_taken_seconds: timeTaken, attempt_number: nextAttemptNumber,
      completed_at: new Date().toISOString(),
    }).select().single();

    if (attempt) {
      setQuizAttempt(attempt as QuizAttempt);
      for (const [qId, ans] of Object.entries(allAnswers)) {
        await supabase.from('quiz_answers').insert({
          attempt_id: attempt.id, question_id: qId,
          selected_option_id: ans.optionId || null,
          text_answer: ans.text || null,
          is_correct: ans.isCorrect,
          points_earned: ans.isCorrect ? 10 : 0,
        });
      }
      logActivity({
        action: 'quiz_submit',
        description: `Quiz "${quiz.title}" — ${percentage}% (${passed ? 'passed' : 'failed'})`,
        page: 'quiz',
        metadata: { quiz_id: quiz.id, attempt_id: attempt.id, score: finalScore, max_score: maxScore, percentage, passed },
      });
    }
  };

  const resetQuiz = () => {
    setSectionIdx(0); setQIdxInSection(0);
    setAllAnswers({}); setCurrentAnswered(false);
    setPendingSelection(null); setEncouragement(null);
    setShowPetals(false); setStreak(0);
    setQuizAttempt(null); setCompletionData(null);
    setPhase(isSectioned ? 'section_intro' : 'question');
  };

  // ── Phase: Finished ──────────────────────────────────────────────────────────
  if (phase === 'finished' && completionData) {
    const syntheticAttempt = quizAttempt ?? {
      id: 'pending', quiz_id: quiz.id, student_id: userId,
      score: completionData.finalScore, max_score: completionData.maxScore,
      percentage: completionData.percentage, passed: completionData.passed,
      time_taken_seconds: completionData.timeTaken, attempt_number: 1,
      completed_at: new Date().toISOString(),
    } as QuizAttempt;
    return (
      <QuizResultsScreen
        quiz={quiz} attempt={syntheticAttempt} questions={questions} options={options}
        answers={allAnswers} totalQuestions={questions.length} correctAnswers={correctCount}
        onRetry={resetQuiz} onBack={onBack}
      />
    );
  }

  // ── Phase: Section Intro ─────────────────────────────────────────────────────
  if (phase === 'section_intro' && currentSection) {
    const { cfg } = currentSection;
    const nextQCount = sections[sectionIdx + 1]?.questions.length;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: `linear-gradient(150deg, #0f172a 0%, #0f172a 60%, ${cfg.gradA}44 100%)` }}>
        <div className="w-full max-w-sm animate-bounce-in">
          {/* Section dots */}
          {isSectioned && (
            <div className="flex justify-center gap-2 mb-8">
              {sections.map((s, i) => (
                <div key={i} className={`rounded-full transition-all duration-400 ${i === sectionIdx ? 'w-10 h-2.5' : i < sectionIdx ? 'w-5 h-2.5 opacity-50' : 'w-5 h-2.5 opacity-20'}`}
                  style={{ background: i <= sectionIdx ? s.cfg.gradA : '#ffffff' }} />
              ))}
            </div>
          )}

          {/* Floating emoji */}
          <div className="text-center mb-6">
            <span className="text-6xl sm:text-7xl select-none animate-float block mb-3">{cfg.emoji}</span>
            {isSectioned && (
              <div className="text-white/40 text-xs font-semibold uppercase tracking-widest">
                Section {sectionIdx + 1} of {sections.length}
              </div>
            )}
          </div>

          {/* Card */}
          <div className="rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: `linear-gradient(135deg, ${cfg.gradA}, ${cfg.gradB})` }}>
            <div className="p-6 text-white text-center">
              <h2 className="text-2xl sm:text-3xl font-black mb-2">{cfg.title}</h2>
              <div className="flex items-center justify-center gap-4 text-white/70 text-sm mb-6">
                <span>{currentSection.questions.length} question{currentSection.questions.length !== 1 ? 's' : ''}</span>
                {isSectioned && sectionIdx > 0 && (
                  <span>• Overall {Math.round(overallProgress)}% done</span>
                )}
              </div>
              <button
                onClick={() => setPhase('question')}
                className="w-full py-4 bg-white font-black text-base rounded-2xl transition-all hover:opacity-90 active:scale-[0.98] shadow-xl"
                style={{ color: cfg.gradA }}
              >
                Start Section ›
              </button>
            </div>
          </div>

          {nextQCount && !isSectioned && (
            <p className="text-center text-white/30 text-xs mt-4">
              Next: {sections[sectionIdx + 1]?.cfg.title}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: Section Done ──────────────────────────────────────────────────────
  if (phase === 'section_done' && currentSection) {
    const sCorr = currentSection.questions.filter(q => allAnswers[q.id]?.isCorrect).length;
    const sTot = currentSection.questions.length;
    const sPct = Math.round((sCorr / sTot) * 100);
    const { cfg } = currentSection;
    const nextSection = sections[sectionIdx + 1];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: `linear-gradient(150deg, #0f172a 0%, #0f172a 60%, ${cfg.gradA}44 100%)` }}>
        <div className="w-full max-w-sm animate-bounce-in">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 text-center text-white"
              style={{ background: `linear-gradient(135deg, ${cfg.gradA}, ${cfg.gradB})` }}>
              <div className="text-4xl mb-2 select-none">{sPct === 100 ? '🏆' : sPct >= 70 ? '⭐' : '💪'}</div>
              <div className="text-3xl font-black">{sPct}%</div>
              <div className="text-white/70 text-sm mt-1">{cfg.title} — Complete!</div>
            </div>
            <div className="p-5 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-3 text-center bg-emerald-50 border border-emerald-200">
                  <div className="text-2xl font-black text-emerald-600">{sCorr}</div>
                  <div className="text-[10px] font-bold text-emerald-600">Correct</div>
                </div>
                <div className="rounded-2xl p-3 text-center bg-red-50 border border-red-200">
                  <div className="text-2xl font-black text-red-500">{sTot - sCorr}</div>
                  <div className="text-[10px] font-bold text-red-500">Wrong</div>
                </div>
              </div>
              <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${sPct}%` }} />
              </div>

              {/* Next action */}
              {nextSection && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-2xl">{nextSection.cfg.emoji}</span>
                  <div>
                    <div className="text-xs text-slate-400 font-semibold">Up Next</div>
                    <div className="text-sm font-bold text-slate-700">{nextSection.cfg.title}</div>
                    <div className="text-[10px] text-slate-400">{nextSection.questions.length} questions</div>
                  </div>
                </div>
              )}

              <button
                onClick={handleNextSection}
                className="w-full py-4 font-black text-white text-base rounded-2xl transition-all active:scale-[0.98] shadow-lg"
                style={{ background: nextSection ? `linear-gradient(135deg, ${nextSection.cfg.gradA}, ${nextSection.cfg.gradB})` : `linear-gradient(135deg, ${cfg.gradA}, ${cfg.gradB})` }}
              >
                {nextSection ? `Next: ${nextSection.cfg.title} →` : 'See Results →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Question ──────────────────────────────────────────────────────────
  if (!currentQuestion || !currentSection) return null;

  const { cfg } = currentSection;
  const needsContainerCheck = NEEDS_CONTAINER_CHECK.has(currentSection.type);
  const canShowCheck = needsContainerCheck && !!pendingSelection && !currentAnswered;
  const ans = allAnswers[currentQuestion.id];

  const renderCurrentQuestion = () => {
    const showResult = currentAnswered;
    const enc = currentAnswered ? encouragement : null;

    switch (currentQuestion.question_type) {
      case 'multiple_choice':
        return (
          <MultipleChoiceQuestion
            key={currentQuestion.id}
            question={currentQuestion} options={currentOptions}
            onAnswer={(optId, isCorrect) => handleAnswer(currentQuestion.id, optId, undefined, isCorrect)}
            onPreselect={setPendingSelection}
            showResult={showResult}
            selectedId={showResult ? (ans?.optionId ?? pendingSelection) : pendingSelection}
            encouragement={enc}
          />
        );
      case 'listening':
        return (
          <ListeningQuestion
            key={currentQuestion.id}
            question={currentQuestion} options={currentOptions}
            onAnswer={(optId, isCorrect) => handleAnswer(currentQuestion.id, optId, undefined, isCorrect)}
            onPreselect={setPendingSelection}
            showResult={showResult}
            selectedId={showResult ? (ans?.optionId ?? pendingSelection) : pendingSelection}
            encouragement={enc}
          />
        );
      case 'matching_pair':
        return (
          <MatchingExercise
            key={currentQuestion.id}
            question={currentQuestion} options={currentOptions}
            onAnswer={(matches, isCorrect) => handleAnswer(currentQuestion.id, undefined, JSON.stringify(matches), isCorrect)}
            showResult={showResult} encouragement={enc}
          />
        );
      case 'fill_blank':
        return (
          <FillBlankQuestion
            key={currentQuestion.id}
            question={currentQuestion} correctAnswers={currentOptions}
            onAnswer={(text, isCorrect) => handleAnswer(currentQuestion.id, undefined, text, isCorrect)}
            showResult={showResult} userAnswer={ans?.text} encouragement={enc}
          />
        );
      case 'listen_write':
        return (
          <ListenWriteQuestion
            key={currentQuestion.id}
            question={currentQuestion} correctAnswers={currentOptions}
            onAnswer={(text, isCorrect) => handleAnswer(currentQuestion.id, undefined, text, isCorrect)}
            showResult={showResult} userAnswer={ans?.text} encouragement={enc}
          />
        );
      case 'flash_card':
        return (
          <FlashCardQuestion
            key={currentQuestion.id}
            question={currentQuestion} correctAnswers={currentOptions}
            onAnswer={(text, isCorrect) => handleAnswer(currentQuestion.id, undefined, text, isCorrect)}
            showResult={showResult} userAnswer={ans?.text} encouragement={enc}
          />
        );
      default:
        return (
          <MultipleChoiceQuestion
            key={currentQuestion.id}
            question={currentQuestion} options={currentOptions}
            onAnswer={(optId, isCorrect) => handleAnswer(currentQuestion.id, optId, undefined, isCorrect)}
            onPreselect={setPendingSelection}
            showResult={showResult}
            selectedId={showResult ? (ans?.optionId ?? pendingSelection) : pendingSelection}
            encouragement={enc}
          />
        );
    }
  };

  return (
    <div className="min-h-full flex flex-col" style={{ background: 'linear-gradient(160deg, #f0f9ff 0%, #f8fafc 60%, #eff6ff 100%)' }}>
      {/* Sticky header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm shrink-0">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl select-none">{cfg.emoji}</span>
              <div className="min-w-0">
                <div className="font-bold text-slate-800 text-sm leading-tight truncate">{cfg.title}</div>
                <div className="text-[10px] text-slate-500">
                  Q {qIdxInSection + 1} / {currentSection.questions.length}
                  {isSectioned && <span className="ml-1 opacity-60">· Section {sectionIdx + 1}/{sections.length}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {streak >= 2 && (
                <span className="px-2 py-1 rounded-xl bg-orange-100 text-orange-600 text-xs font-bold">🔥 {streak}</span>
              )}
              <span className="px-2 py-1.5 rounded-xl bg-amber-100 text-amber-700 text-xs font-bold flex items-center gap-1">
                <Zap size={11} /> {correctCount * 10}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%`, background: `linear-gradient(90deg, ${cfg.gradA}, ${cfg.gradB})` }} />
          </div>
        </div>
      </div>

      {/* Question + action buttons */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 flex flex-col gap-3">
        {/* Question card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6">
          {renderCurrentQuestion()}
        </div>

        {/* Container-level Check button: for Multiple Choice & Listening */}
        {canShowCheck && (
          <button
            onClick={handleContainerCheck}
            className="w-full py-4 font-black text-white text-base rounded-2xl transition-all active:scale-[0.98] animate-slide-up-fade shadow-lg"
            style={{ background: `linear-gradient(135deg, ${cfg.gradA}, ${cfg.gradB})` }}
          >
            Check Answer ✓
          </button>
        )}

        {/* Next button: appears after question is answered */}
        {currentAnswered && (
          <button
            onClick={handleNext}
            className="w-full py-4 font-black text-white text-base rounded-2xl transition-all active:scale-[0.98] animate-slide-up-fade shadow-lg"
            style={{
              background: isLastQInSection && isLastSection
                ? 'linear-gradient(135deg, #10b981, #0d9488)'
                : `linear-gradient(135deg, ${cfg.gradA}, ${cfg.gradB})`
            }}
          >
            {isLastQInSection && isLastSection
              ? 'Finish Quiz →'
              : isLastQInSection
              ? `Next Section →`
              : 'Next Question →'}
          </button>
        )}
      </div>

      {/* Petal burst on correct answer */}
      {showPetals && <PetalBurst />}
    </div>
  );
}

// ── Results Screen ─────────────────────────────────────────────────────────────
export function QuizResultsScreen({ quiz, attempt, questions, options, answers, totalQuestions, correctAnswers, onRetry, onBack }: {
  quiz: Quiz;
  attempt: QuizAttempt;
  questions: QuizQuestion[];
  options: QuizOption[];
  answers: Record<string, { optionId?: string; text?: string; isCorrect: boolean }>;
  totalQuestions: number;
  correctAnswers: number;
  onRetry: () => void;
  onBack?: () => void;
}) {
  const [animPct, setAnimPct] = useState(0);
  const [starsShown, setStarsShown] = useState(0);
  const [showReview, setShowReview] = useState(false);

  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const wrongCount = totalQuestions - correctAnswers;
  const isPerfect = percentage === 100;
  const passed = percentage >= quiz.passing_score;
  const xpEarned = isPerfect
    ? quiz.xp_reward + (quiz.bonus_xp_perfect || 0)
    : passed ? quiz.xp_reward : Math.floor(quiz.xp_reward * (percentage / 100));
  const starCount = percentage >= 90 ? 5 : percentage >= 70 ? 4 : percentage >= 50 ? 3 : percentage >= 30 ? 2 : 1;
  const timeSecs = attempt.time_taken_seconds || 0;
  const wrongAnswers = questions.filter(q => answers[q.id] && !answers[q.id].isCorrect);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (animPct / 100) * circumference;

  const result =
    percentage === 100 ? { title: 'Perfect Score!', sub: 'Absolutely flawless!',  grad: 'from-amber-400 via-yellow-400 to-orange-400' } :
    percentage >= 90  ? { title: 'Excellent!',       sub: 'Outstanding work!',     grad: 'from-emerald-400 via-teal-400 to-cyan-500' } :
    percentage >= 80  ? { title: 'Great Job!',        sub: 'Well done!',            grad: 'from-blue-500 via-indigo-500 to-violet-500' } :
    percentage >= 70  ? { title: 'Passed!',           sub: 'Good effort!',          grad: 'from-sky-400 via-blue-500 to-indigo-500' } :
    percentage >= 50  ? { title: 'Keep Going!',       sub: 'You can do better!',    grad: 'from-amber-400 via-orange-500 to-red-400' } :
                        { title: 'Try Again!',         sub: 'Practice makes perfect!', grad: 'from-rose-500 via-red-500 to-pink-500' };

  const confetti = useMemo(() => [...Array(70)].map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    w: `${5 + Math.random() * 9}px`,
    h: `${8 + Math.random() * 14}px`,
    delay: `${Math.random() * 3.5}s`,
    dur: `${2.2 + Math.random() * 2.5}s`,
    round: Math.random() > 0.45,
    rotate: Math.random() * 360,
  })), []);

  useEffect(() => {
    playCelebrationSound(percentage);
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimPct(Math.floor(ease * percentage));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    for (let i = 0; i < starCount; i++) {
      setTimeout(() => setStarsShown(i + 1), 600 + i * 180);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #0c4a6e 100%)' }}>

      {/* Confetti layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
        {confetti.map(p => (
          <div key={p.id} className="absolute top-0 animate-confetti"
            style={{
              left: p.left, width: p.w, height: p.h,
              backgroundColor: p.color,
              borderRadius: p.round ? '50%' : '3px',
              transform: `rotate(${p.rotate}deg)`,
              animationDelay: p.delay, animationDuration: p.dur,
            }} />
        ))}
      </div>

      {/* Main content — flex column, no scroll */}
      <div className="relative z-20 flex flex-col flex-1 min-h-0 items-center justify-center px-4 py-3 sm:py-6">
        <div className="w-full max-w-md flex flex-col gap-3">

          {/* Score card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-bounce-in">

            {/* Compact gradient header: ring + title + stars in a row */}
            <div className={`bg-gradient-to-br ${result.grad} px-4 py-4 text-white relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 50%)' }} />
              <div className="relative flex items-center gap-4">
                {/* Compact SVG ring */}
                <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
                  <svg className="w-full h-full" style={{ transform: 'rotate(-90deg)' }} viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
                    <circle cx="44" cy="44" r={radius} fill="none" stroke="white" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeOffset}
                      style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(0.22, 1, 0.36, 1)' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black leading-none">{animPct}%</span>
                    <span className="text-[9px] opacity-75 font-semibold uppercase tracking-wide">score</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-black drop-shadow-sm leading-tight">{result.title}</h1>
                  <p className="opacity-80 text-xs mt-0.5">{result.sub}</p>
                  {isPerfect && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-lg text-xs font-bold">
                      <Trophy size={12} /> +{quiz.bonus_xp_perfect} XP Bonus
                    </div>
                  )}
                  {/* Stars */}
                  <div className="flex gap-1 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}
                        className={`text-base ${i < starsShown ? 'animate-star-pop' : 'opacity-20'}`}
                        style={{ animationDelay: `${i * 0.18}s`, display: 'inline-block' }}>
                        ⭐
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 space-y-3">

              {/* Stats grid: 6 cells */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-2.5 text-center bg-slate-50 border border-slate-100">
                  <div className="text-xl font-black text-slate-800">{totalQuestions}</div>
                  <div className="text-[10px] text-slate-500 font-semibold">Total</div>
                </div>
                <div className="rounded-xl p-2.5 text-center bg-emerald-50 border border-emerald-200">
                  <div className="text-xl font-black text-emerald-600">{correctAnswers}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Correct</div>
                </div>
                <div className="rounded-xl p-2.5 text-center bg-red-50 border border-red-200">
                  <div className="text-xl font-black text-red-500">{wrongCount}</div>
                  <div className="text-[10px] text-red-500 font-semibold">Wrong</div>
                </div>
                <div className="rounded-xl p-2 text-center bg-slate-50 border border-slate-100 flex flex-col items-center gap-0.5">
                  <Clock size={13} className="text-slate-400" />
                  <div className="font-bold text-slate-700 text-xs leading-none">
                    {Math.floor(timeSecs / 60)}:{(timeSecs % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-[9px] text-slate-400">Time</div>
                </div>
                <div className="rounded-xl p-2 text-center bg-amber-50 border border-amber-100 flex flex-col items-center gap-0.5">
                  <Zap size={13} className="text-amber-500" />
                  <div className="font-black text-amber-600 text-xs leading-none">+{xpEarned}</div>
                  <div className="text-[9px] text-amber-500">XP</div>
                </div>
                <div className="rounded-xl p-2 text-center bg-blue-50 border border-blue-100 flex flex-col items-center gap-0.5">
                  <Target size={13} className="text-blue-500" />
                  <div className="font-bold text-blue-600 text-xs leading-none">{quiz.passing_score}%</div>
                  <div className="text-[9px] text-blue-400">Pass Mark</div>
                </div>
              </div>

              {/* Accuracy bar */}
              <div>
                <div className="flex justify-between text-[10px] font-semibold mb-1">
                  <span className="text-emerald-600">{correctAnswers} correct ({percentage}%)</span>
                  <span className="text-red-500">{wrongCount} wrong</span>
                </div>
                <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-1500 ease-out"
                    style={{ width: `${animPct}%` }} />
                </div>
              </div>

              {/* Question breakdown */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Question Breakdown</p>
                <div className="flex flex-wrap gap-1">
                  {questions.map((q, idx) => {
                    const ans = answers[q.id];
                    const correct = ans?.isCorrect;
                    const skipped = !ans;
                    return (
                      <div key={q.id}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all ${
                          skipped ? 'bg-slate-100 border-slate-200 text-slate-400'
                          : correct ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : 'bg-red-100 border-red-300 text-red-600'
                        }`}
                        title={`Q${idx + 1}: ${skipped ? 'Skipped' : correct ? 'Correct' : 'Wrong'}`}
                      >
                        {skipped ? '—' : correct ? '✓' : '✗'}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={onRetry}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-sm"
                >
                  <RotateCcw size={15} /> Try Again
                </button>
                <button
                  onClick={onBack}
                  className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-1.5 text-sm"
                >
                  <CheckCircle size={15} /> Finish
                </button>
              </div>

              {/* Review toggle */}
              {wrongAnswers.length > 0 && (
                <button
                  onClick={() => setShowReview(!showReview)}
                  className="w-full py-2.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <BookOpen size={15} /> Review Mistakes ({wrongAnswers.length})
                  {showReview ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wrong answer review — slides up as bottom sheet */}
      {showReview && wrongAnswers.length > 0 && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end" onClick={() => setShowReview(false)}>
          <div
            className="bg-white rounded-t-3xl shadow-2xl max-h-[70vh] flex flex-col animate-slide-up-fade"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-t-3xl border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <AlertCircle size={16} /> Questions to Review
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Study the ones you missed</p>
              </div>
              <button onClick={() => setShowReview(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-200 text-slate-400">
                <XCircle size={18} />
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
              {wrongAnswers.map((q, idx) => {
                const qOptions = options.filter(o => o.question_id === q.id);
                const userAnswer = answers[q.id];
                const correctOption = qOptions.find(o => o.is_correct);
                const userSelectedOption = userAnswer?.optionId ? qOptions.find(o => o.id === userAnswer.optionId) : null;
                return (
                  <div key={q.id} className="p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-bold text-red-600 shrink-0 mt-0.5">{idx + 1}</div>
                      <p className="font-semibold text-slate-800 text-sm leading-snug">{q.question_text}</p>
                    </div>
                    <div className="ml-9 space-y-1.5">
                      {userSelectedOption && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                          <XCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                          <span className="text-xs text-red-700"><span className="font-semibold">Your answer: </span>{userSelectedOption.option_text}</span>
                        </div>
                      )}
                      {userAnswer?.text && (q.question_type === 'fill_blank' || q.question_type === 'listen_write' || q.question_type === 'flash_card') && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                          <XCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                          <span className="text-xs text-red-700"><span className="font-semibold">You wrote: </span>{userAnswer.text}</span>
                        </div>
                      )}
                      {correctOption && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-xs text-emerald-700"><span className="font-semibold">Correct: </span>{correctOption.option_text}</span>
                        </div>
                      )}
                      {(q.question_type === 'fill_blank' || q.question_type === 'listen_write' || q.question_type === 'flash_card') && qOptions.length > 0 && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                          <CheckCircle size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-xs text-emerald-700"><span className="font-semibold">Correct: </span>{qOptions.map(o => o.option_text).join(', ')}</span>
                        </div>
                      )}
                      {q.explanation && (
                        <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                          <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">Explanation</p>
                          <p className="text-xs text-blue-800">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quiz List Card ─────────────────────────────────────────────────────────────
export function QuizListCard({ quiz, onStart, bestScore = null, attempts = 0 }: {
  quiz: Quiz; onComplete: () => void; onStart: () => void; bestScore?: number | null; attempts?: number;
}) {
  const typeIcons: Record<string, string> = {
    multiple_choice: '❓', matching: '🔗', fill_blank: '✏️', listening: '🎧', mixed: '🎯',
  };
  const typeLabels: Record<string, string> = {
    multiple_choice: 'Multiple Choice', matching: 'Matching', fill_blank: 'Fill Blanks',
    listening: 'Listening', mixed: 'Mixed',
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group"
      onClick={onStart}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-xl sm:text-2xl shrink-0">
          {typeIcons[quiz.quiz_type] || '❓'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors text-sm sm:text-base">
            {quiz.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 mb-2 sm:mb-3">
            {quiz.description || `Test your knowledge with ${typeLabels[quiz.quiz_type]}`}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Target size={12} /> {quiz.passing_score}% to pass</span>
            <span className="flex items-center gap-1 text-amber-500"><Zap size={12} /> {quiz.xp_reward} XP</span>
          </div>
        </div>
        {bestScore !== null && (
          <div className="text-right shrink-0">
            <div className={`text-base sm:text-lg font-black ${bestScore >= quiz.passing_score ? 'text-emerald-600' : 'text-amber-600'}`}>
              {bestScore}%
            </div>
            <div className="text-[10px] text-slate-400">{attempts} attempts</div>
          </div>
        )}
      </div>
    </div>
  );
}
