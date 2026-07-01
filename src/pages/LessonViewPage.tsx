import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, CheckCircle, ChevronRight, ChevronLeft, AlertCircle,
  HelpCircle, Play, Image as ImageIcon, Video, Clock, Loader2, Layers
} from 'lucide-react';
import { supabase, Lesson, LessonBlockProgress, ContentBlock } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/usePresence';
import Navbar from '../components/Navbar';

const LEVEL_META: Record<string, { gradient: string; textColor: string; accentHex: string }> = {
  elementary:          { gradient: 'from-emerald-500 to-teal-600', textColor: 'text-emerald-700', accentHex: '#10b981' },
  'pre-intermediate':  { gradient: 'from-sky-500 to-blue-600', textColor: 'text-blue-700', accentHex: '#0ea5e9' },
  intermediate:        { gradient: 'from-violet-500 to-purple-700', textColor: 'text-violet-700', accentHex: '#8b5cf6' },
  'upper-intermediate':{ gradient: 'from-amber-500 to-orange-600', textColor: 'text-amber-700', accentHex: '#f59e0b' },
  advanced:            { gradient: 'from-rose-500 to-red-700', textColor: 'text-rose-700', accentHex: '#f43f5e' },
};

// Split text blocks on "---" lines for interactive step-by-step mode
function expandBlocksForInteractive(blocks: ContentBlock[]): ContentBlock[] {
  const result: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'text' && block.content) {
      const parts = block.content
        .split(/\n?-{3,}\n?/)
        .map(s => s.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        parts.forEach((part, i) =>
          result.push({ ...block, id: `${block.id}_${i}`, content: part })
        );
        continue;
      }
    }
    result.push(block);
  }
  return result;
}

export default function LessonViewPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [levelMeta, setLevelMeta] = useState(LEVEL_META['elementary']);
  const [blockProgress, setBlockProgress] = useState<LessonBlockProgress | null>(null);
  const [completed, setCompleted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lessonId || !user) return;
    (async () => {
      setLoading(true);

      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*, levels(*)')
        .eq('id', lessonId)
        .maybeSingle();

      if (lessonData) {
        setLesson(lessonData);
        const levelKey = (lessonData as any).levels?.key ?? 'elementary';
        setLevelMeta(LEVEL_META[levelKey] ?? LEVEL_META['elementary']);
        logActivity({
          action: 'lesson_open',
          description: `Opened lesson "${lessonData.title}"`,
          page: 'lesson',
          metadata: { lesson_id: lessonData.id, level: levelKey },
        });
      }

      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('student_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (progressData) {
        setCompleted(progressData.completed);
      }

      const { data: blockProgressData } = await supabase
        .from('lesson_block_progress')
        .select('*')
        .eq('student_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (blockProgressData) {
        setBlockProgress({
          ...blockProgressData,
          completed_blocks: blockProgressData.completed_blocks ?? [],
          block_answers: blockProgressData.block_answers ?? {},
        });
      }

      setLoading(false);
    })();
  }, [lessonId, user]);

  const rawBlocks = lesson?.content ?? [];
  const isInteractive = lesson?.display_mode === 'interactive';
  const blocks = isInteractive ? expandBlocksForInteractive(rawBlocks) : rawBlocks;
  const currentBlockIndex = blockProgress?.current_block_index ?? 0;
  const currentBlock = isInteractive ? blocks[currentBlockIndex] : null;

  const saveBlockProgress = useCallback(async (
    newIndex: number,
    completedBlocks: string[],
    answers: Record<string, any>
  ) => {
    if (!user || !lessonId) return;
    setSaving(true);

    const payload = {
      student_id: user.id,
      lesson_id: lessonId,
      current_block_index: newIndex,
      completed_blocks: completedBlocks,
      block_answers: answers,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('lesson_block_progress')
      .upsert(payload, { onConflict: 'student_id,lesson_id' });

    if (!error) {
      setBlockProgress(prev => ({
        id: prev?.id ?? '',
        student_id: user.id,
        lesson_id: lessonId,
        current_block_index: newIndex,
        completed_blocks: completedBlocks,
        block_answers: answers,
        completed: false,
        completed_at: null,
        updated_at: new Date().toISOString(),
      }));
    }
    setSaving(false);
  }, [user, lessonId, blocks, blockProgress?.id]);

  const handleProceed = async () => {
    if (currentBlockIndex >= blocks.length - 1) return;

    const currentCompleted = blockProgress?.completed_blocks ?? [];
    const newCompletedBlocks = [...currentCompleted];
    if (currentBlock && !newCompletedBlocks.includes(currentBlock.id)) {
      newCompletedBlocks.push(currentBlock.id);
    }

    const newIndex = currentBlockIndex + 1;
    await saveBlockProgress(newIndex, newCompletedBlocks, blockProgress?.block_answers ?? {});
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const handleAnswerSubmit = async () => {
    if (!currentBlock || selectedAnswer === null) return;

    const isCorrect = currentBlock.correctAnswer === selectedAnswer;
    const answers = {
      ...(blockProgress?.block_answers ?? {}),
      [currentBlock.id]: { answer: selectedAnswer, correct: isCorrect },
    };

    setShowResult(true);

    if (isCorrect) {
      const currentCompleted = blockProgress?.completed_blocks ?? [];
      const newCompletedBlocks = [...currentCompleted];
      if (!newCompletedBlocks.includes(currentBlock.id)) {
        newCompletedBlocks.push(currentBlock.id);
      }

      setTimeout(async () => {
        if (currentBlockIndex < blocks.length - 1) {
          await saveBlockProgress(currentBlockIndex + 1, newCompletedBlocks, answers);
          setSelectedAnswer(null);
          setShowResult(false);
        }
      }, 1500);
    }
  };

  const handleGoBack = async () => {
    if (currentBlockIndex <= 0) return;

    const newIndex = currentBlockIndex - 1;
    await saveBlockProgress(
      newIndex,
      blockProgress?.completed_blocks ?? [],
      blockProgress?.block_answers ?? {}
    );
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const completeLesson = async () => {
    if (!user || !lessonId) return;
    const now = new Date().toISOString();

    await supabase.from('lesson_progress').upsert({
      student_id: user.id,
      lesson_id: lessonId,
      score: 100,
      completed: true,
      completed_at: now,
    }, { onConflict: 'student_id,lesson_id' });

    if (isInteractive && blockProgress) {
      await supabase
        .from('lesson_block_progress')
        .update({
          completed: true,
          completed_at: now,
        })
        .eq('id', blockProgress.id);
    }

    setCompleted(true);
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Lesson not found</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-900 truncate">{lesson.title}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock size={12} />
              <span>{lesson.duration_minutes} min</span>
              {isInteractive && (
                <>
                  <Layers size={12} className="ml-2" />
                  <span>Interactive</span>
                </>
              )}
            </div>
          </div>
          {completed && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <CheckCircle size={12} /> Completed
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className={`px-6 py-5 bg-gradient-to-r ${levelMeta.gradient}`}>
            <div className="flex items-center gap-3">
              {isInteractive ? (
                <Layers size={24} className="text-white" />
              ) : (
                <BookOpen size={24} className="text-white" />
              )}
              <div>
                <h1 className="font-bold text-xl text-white">{lesson.title}</h1>
                <p className="text-white/80 text-sm mt-0.5">
                  {isInteractive ? 'Interactive Mode - Step by step learning' : 'Classic Mode - Read at your own pace'}
                </p>
              </div>
            </div>
          </div>

          {isInteractive ? (
            <InteractiveContent
              blocks={blocks}
              currentBlockIndex={currentBlockIndex}
              blockProgress={blockProgress}
              selectedAnswer={selectedAnswer}
              showResult={showResult}
              setSelectedAnswer={setSelectedAnswer}
              onProceed={handleProceed}
              onGoBack={handleGoBack}
              onSubmitAnswer={handleAnswerSubmit}
              onComplete={completeLesson}
              completed={completed}
            />
          ) : (
            <ClassicContent
              blocks={blocks}
              lesson={lesson}
              completed={completed}
              onComplete={completeLesson}
              levelMeta={levelMeta}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ClassicContent({
  blocks,
  lesson,
  completed,
  onComplete,
  levelMeta,
}: {
  blocks: ContentBlock[];
  lesson: Lesson;
  completed: boolean;
  onComplete: () => void;
  levelMeta: { gradient: string };
}) {
  return (
    <>
      <div className="divide-y divide-slate-100">
        {blocks.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No content available</p>
            <p className="text-sm text-slate-400 mt-1">The teacher is preparing this lesson.</p>
          </div>
        ) : (
          blocks.map((block, index) => (
            <div key={block.id} className="px-6 py-6">
              <BlockRenderer block={block} index={index + 1} />
            </div>
          ))
        )}
      </div>

      <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl text-sm hover:bg-slate-50 transition-colors"
        >
          Back to Course
        </button>
        {!completed ? (
          <button
            onClick={onComplete}
            className={`flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r ${levelMeta.gradient} text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-all`}
          >
            <CheckCircle size={16} /> Mark as Complete
          </button>
        ) : (
          <span className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
            <CheckCircle size={18} /> Lesson Completed
          </span>
        )}
      </div>
    </>
  );
}

function InteractiveContent({
  blocks,
  currentBlockIndex,
  blockProgress,
  selectedAnswer,
  showResult,
  setSelectedAnswer,
  onProceed,
  onGoBack,
  onSubmitAnswer,
  onComplete,
  completed,
}: {
  blocks: ContentBlock[];
  currentBlockIndex: number;
  blockProgress: LessonBlockProgress | null;
  selectedAnswer: number | null;
  showResult: boolean;
  setSelectedAnswer: (a: number | null) => void;
  onProceed: () => void;
  onGoBack: () => void;
  onSubmitAnswer: () => void;
  onComplete: () => void;
  completed: boolean;
}) {
  const totalBlocks = blocks.length;
  const currentBlock = blocks[currentBlockIndex];
  const completedBlockIds = blockProgress?.completed_blocks ?? [];
  const isLastBlock = currentBlockIndex >= totalBlocks - 1;
  const allBlocksCompleted = completedBlockIds.length >= totalBlocks;

  if (blocks.length === 0) {
    return (
      <div className="p-12 text-center">
        <BookOpen size={36} className="text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">No content available</p>
      </div>
    );
  }

  return (
    <div className="min-h-[400px] flex flex-col">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">
            Step {currentBlockIndex + 1} of {totalBlocks}
          </span>
          <div className="flex items-center gap-1">
            {blocks.map((block, idx) => {
              const isCompleted = completedBlockIds.includes(block.id);
              const isCurrent = idx === currentBlockIndex;
              return (
                <div
                  key={block.id}
                  className={`w-2 h-2 rounded-full transition-all ${
                    isCompleted ? 'bg-emerald-500' :
                    isCurrent ? 'bg-violet-500 ring-2 ring-violet-200' :
                    'bg-slate-300'
                  }`}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedBlockIds.length / totalBlocks) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 px-6 py-6">
        {currentBlock && (
          <BlockRenderer
            block={currentBlock}
            index={currentBlockIndex + 1}
            interactive={currentBlock.type === 'question'}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            onSelectAnswer={setSelectedAnswer}
          />
        )}
      </div>

      <div className="px-6 pb-6 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onGoBack}
            disabled={currentBlockIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <div className="flex items-center gap-3">
            {currentBlock?.type === 'question' ? (
              showResult ? (
                <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
                  <CheckCircle size={18} /> Correct! Proceeding...
                </div>
              ) : (
                <button
                  onClick={onSubmitAnswer}
                  disabled={selectedAnswer === null}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Answer
                </button>
              )
            ) : isLastBlock ? (
              <button
                onClick={onComplete}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm"
              >
                <CheckCircle size={16} /> Complete Lesson
              </button>
            ) : (
              <button
                onClick={onProceed}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-sm"
              >
                Next Step <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockRenderer({
  block,
  index,
  interactive = false,
  selectedAnswer,
  showResult,
  onSelectAnswer,
}: {
  block: ContentBlock;
  index: number;
  interactive?: boolean;
  selectedAnswer?: number | null;
  showResult?: boolean;
  onSelectAnswer?: (a: number | null) => void;
}) {
  const blockIcons = {
    text: BookOpen,
    image: ImageIcon,
    video: Video,
    question: HelpCircle,
  };
  const Icon = blockIcons[block.type] ?? BookOpen;
  const blockColors = {
    text: 'bg-blue-100 text-blue-600',
    image: 'bg-emerald-100 text-emerald-600',
    video: 'bg-violet-100 text-violet-600',
    question: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="space-y-4">
      {block.type === 'text' && (
        <div className="prose prose-slate max-w-none">
          <div className="leading-relaxed whitespace-pre-wrap text-slate-700">
            {block.content}
          </div>
        </div>
      )}

      {block.type === 'image' && (
        <div className="space-y-3">
          {block.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <img
                src={block.imageUrl}
                alt={block.imageAlt || 'Lesson image'}
                className="w-full max-h-96 object-cover"
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ImageIcon size={14} />
            <span>{block.imageAlt || 'Image'}</span>
          </div>
        </div>
      )}

      {block.type === 'video' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Video size={14} />
            <span>{block.videoTitle || 'Video'}</span>
          </div>
          {block.videoUrl && (
            <div className="aspect-video rounded-xl overflow-hidden bg-slate-900">
              <iframe
                src={block.videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={() => logActivity({
                  action: 'page_view',
                  description: `Watched video "${block.videoTitle || 'Video'}"`,
                  page: 'lesson',
                  metadata: { video_title: block.videoTitle, video_url: block.videoUrl },
                })}
              />
            </div>
          )}
        </div>
      )}

      {block.type === 'question' && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <HelpCircle size={16} className="text-amber-600" />
            </div>
            <p className="font-semibold text-slate-800 text-lg leading-snug">
              {block.question}
            </p>
          </div>

          <div className="space-y-2.5 ml-11">
            {(block.options ?? []).map((option, optIdx) => {
              const isSelected = selectedAnswer === optIdx;
              const isCorrect = block.correctAnswer === optIdx;
              const showCorrectness = showResult;

              return (
                <button
                  key={optIdx}
                  onClick={() => !showResult && onSelectAnswer?.(optIdx)}
                  disabled={showResult}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium',
                    showCorrectness && isCorrect
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : showCorrectness && isSelected && !isCorrect
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : isSelected
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/50',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-600 mr-2">
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>

          {showResult && block.correctAnswer !== undefined && (
            <div className="mt-4 ml-11 p-3 bg-emerald-100 rounded-lg text-sm text-emerald-800">
              The correct answer is: {block.options?.[block.correctAnswer]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
