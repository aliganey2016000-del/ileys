import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Type, Image, Video,
  HelpCircle, ChevronUp, ChevronDown, X, Eye, EyeOff, AlertCircle,
  CheckCircle, Play, FileText, Loader2, BookOpen, Layers,
  MoreVertical, Sparkles, Settings2, Paperclip, Eraser,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase, Level, ContentBlock } from '../lib/supabase';
import Navbar from '../components/Navbar';

const generateId = () => Math.random().toString(36).substring(2, 9);

const BLOCK_TYPES = [
  { type: 'text', label: 'Text', icon: Type, color: 'from-blue-500 to-cyan-500', description: 'Add written content' },
  { type: 'image', label: 'Image', icon: Image, color: 'from-emerald-500 to-teal-500', description: 'Add an image' },
  { type: 'video', label: 'Video', icon: Video, color: 'from-violet-500 to-purple-500', description: 'Embed a video' },
  { type: 'question', label: 'Question', icon: HelpCircle, color: 'from-amber-500 to-orange-500', description: 'Add a quiz question' },
] as const;

export default function LessonBuilderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lessonId } = useParams();

  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [levelId, setLevelId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [isPublished, setIsPublished] = useState(false);
  const [displayMode, setDisplayMode] = useState<'classic' | 'interactive'>('classic');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Context menu + panel visibility
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: lvlData } = await supabase.from('levels').select('*').order('sort_order');
      setLevels(lvlData ?? []);
      if (lvlData?.[0]) setLevelId(lvlData[0].id);

      if (lessonId) {
        const { data: lesson } = await supabase.from('lessons').select('*').eq('id', lessonId).maybeSingle();
        if (lesson) {
          setTitle(lesson.title);
          setDescription(lesson.description ?? '');
          setLevelId(lesson.level_id);
          setDurationMinutes(lesson.duration_minutes);
          setIsPublished(lesson.is_published);
          setDisplayMode(lesson.display_mode ?? 'classic');
          setBlocks(lesson.content ?? []);
          setFeaturedImageUrl(lesson.featured_image_url ?? '');
          setVideoUrl(lesson.video_url ?? '');
        }
      }
      setLoading(false);
    })();
  }, [lessonId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: generateId(),
      type,
      content: type === 'text' ? '' : undefined,
      imageUrl: type === 'image' ? '' : undefined,
      videoUrl: type === 'video' ? '' : undefined,
      question: type === 'question' ? '' : undefined,
      options: type === 'question' ? ['', '', '', ''] : undefined,
      correctAnswer: type === 'question' ? 0 : undefined,
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const idx = blocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]];
    setBlocks(newBlocks);
  };

  const generateLessonWithAI = async () => {
    setMenuOpen(false);
    if (!title.trim()) {
      setError('Enter a lesson title (Topic) first, then run AI Lesson Generator.');
      return;
    }
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const levelLabel = levels.find(l => l.id === levelId)?.label ?? 'intermediate';
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lesson`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ topic: title.trim(), level: levelLabel, description: description.trim() }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (!data.blocks || !Array.isArray(data.blocks)) {
        throw new Error('AI response did not contain content blocks.');
      }
      setBlocks(data.blocks as ContentBlock[]);
      if (data.description && !description.trim()) {
        setDescription(data.description);
      }
      setSuccess('AI generated lesson content successfully!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate lesson content.');
    } finally {
      setGenerating(false);
    }
  };

  const clearContent = () => {
    setBlocks([]);
    setDescription('');
    setFeaturedImageUrl('');
    setVideoUrl('');
    setShowClearConfirm(false);
    setSuccess('Content cleared.');
  };

  const saveLesson = async () => {
    if (!title.trim()) { setError('Lesson title is required'); return; }
    if (!levelId) { setError('Please select a level'); return; }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      level_id: levelId,
      duration_minutes: durationMinutes,
      is_published: isPublished,
      display_mode: displayMode,
      content: blocks.length > 0 ? blocks : null,
      featured_image_url: featuredImageUrl.trim() || null,
      video_url: videoUrl.trim() || null,
      teacher_id: user!.id,
    };

    let result;
    if (lessonId) {
      result = await supabase.from('lessons').update(payload).eq('id', lessonId);
    } else {
      result = await supabase.from('lessons').insert(payload).select().maybeSingle();
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      setSuccess('Lesson saved successfully!');
      if (!lessonId && result.data) {
        navigate(`/teacher/lesson/${result.data.id}`, { replace: true });
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/teacher')}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {lessonId ? 'Edit Lesson' : 'Create New Lesson'}
              </h1>
              <p className="text-sm text-slate-400">Build rich content with text, images, videos, and questions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPublished(!isPublished)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                isPublished
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
              {isPublished ? 'Published' : 'Draft'}
            </button>
            <button
              onClick={saveLesson}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-900/40 transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Lesson'}
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
            <AlertCircle size={20} className="shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400">
            <CheckCircle size={20} className="shrink-0" />
            <span className="text-sm">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto p-1 hover:bg-emerald-500/20 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Lesson Settings card with context menu */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-5 mb-6 relative">
          {/* Three-dot context menu — top-right, above the Name/Title field */}
          <div className="absolute top-4 right-4" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Lesson actions"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-fadeInUp">
                <button
                  onClick={generateLessonWithAI}
                  disabled={generating}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-700/70 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">AI Lesson Generator</p>
                    <p className="text-xs text-slate-400">Auto-generate content from the topic</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setDisplayMode(m => (m === 'classic' ? 'interactive' : 'classic'));
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-700/70 transition-colors text-left border-t border-slate-700/60"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                    <Settings2 size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Display Mode</p>
                    <p className="text-xs text-slate-400">Currently: {displayMode === 'classic' ? 'Classic' : 'Interactive'}</p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 mt-0.5">
                    {displayMode === 'classic' ? 'Classic' : 'Interactive'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowMediaPanel(v => !v);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-700/70 transition-colors text-left border-t border-slate-700/60"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
                    <Paperclip size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Media & Attachments</p>
                    <p className="text-xs text-slate-400">Featured image & video panels</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${showMediaPanel ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                    {showMediaPanel ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowClearConfirm(true);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-left border-t border-slate-700/60"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shrink-0">
                    <Eraser size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Clear Content</p>
                    <p className="text-xs text-slate-400">Reset the editor</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <h2 className="font-semibold text-white mb-4 flex items-center gap-2 pr-12">
            <FileText size={18} className="text-violet-400" />
            Lesson Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Name *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Present Simple Tense"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Level *</label>
              <select
                value={levelId}
                onChange={e => setLevelId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Duration (min)</label>
              <input
                type="number"
                min={5}
                max={120}
                value={durationMinutes}
                onChange={e => setDurationMinutes(parseInt(e.target.value) || 20)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="What will students learn in this lesson?"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>

            {/* Media & Attachments panel (toggled via context menu) */}
            {showMediaPanel && (
              <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 animate-fadeInUp">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                    <Image size={14} className="text-emerald-400" /> Featured Image URL
                  </label>
                  <input
                    value={featuredImageUrl}
                    onChange={e => setFeaturedImageUrl(e.target.value)}
                    placeholder="https://example.com/cover.jpg"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {featuredImageUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-slate-700 max-h-32">
                      <img
                        src={featuredImageUrl}
                        alt="Featured preview"
                        className="w-full h-32 object-cover"
                        onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-2">
                    <Video size={14} className="text-violet-400" /> Lesson Video URL
                  </label>
                  <input
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  {videoUrl && (
                    <div className="mt-2 p-3 bg-slate-900 rounded-lg flex items-center gap-3 border border-slate-700">
                      <div className="w-12 h-9 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                        <Play size={14} className="text-white ml-0.5" />
                      </div>
                      <p className="text-xs text-slate-400 truncate">{videoUrl}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Display Mode</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setDisplayMode('classic')}
                  className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    displayMode === 'classic'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    displayMode === 'classic' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'
                  }`}>
                    <BookOpen size={20} />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${displayMode === 'classic' ? 'text-blue-400' : 'text-slate-200'}`}>
                      Classic Mode
                    </p>
                    <p className="text-xs text-slate-400">Students read the full lesson without interruption</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('interactive')}
                  className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    displayMode === 'interactive'
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    displayMode === 'interactive' ? 'bg-violet-500 text-white' : 'bg-slate-700 text-slate-400'
                  }`}>
                    <Layers size={20} />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${displayMode === 'interactive' ? 'text-violet-400' : 'text-slate-200'}`}>
                      Interactive Mode
                    </p>
                    <p className="text-xs text-slate-400">Step-by-step blocks with quiz checkpoints</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Block Buttons */}
        <div className="mb-6">
          <h2 className="font-semibold text-white mb-3">Add Content Block</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BLOCK_TYPES.map(({ type, label, icon: Icon, color, description }) => (
              <button
                key={type}
                onClick={() => addBlock(type)}
                className="group bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-900/20 transition-all text-left"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                  <Icon size={18} className="text-white" />
                </div>
                <p className="font-semibold text-white text-sm">{label}</p>
                <p className="text-xs text-slate-400">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Content Blocks */}
        <div className="space-y-4">
          {blocks.length === 0 ? (
            <div className="bg-slate-900 rounded-2xl border-2 border-dashed border-slate-700 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 mx-auto mb-4 flex items-center justify-center">
                <FileText size={28} className="text-slate-500" />
              </div>
              <p className="text-slate-300 font-medium mb-1">No content blocks yet</p>
              <p className="text-sm text-slate-500">Click the buttons above to add content, or use the AI Lesson Generator in the menu (⋮).</p>
            </div>
          ) : (
            blocks.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                index={index}
                total={blocks.length}
                onUpdate={(updates) => updateBlock(block.id, updates)}
                onRemove={() => removeBlock(block.id)}
                onMove={(dir) => moveBlock(block.id, dir)}
              />
            ))
          )}
        </div>
      </div>

      {/* AI generating overlay */}
      {generating && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center animate-pulse">
              <Sparkles size={26} className="text-white" />
            </div>
            <p className="text-white font-semibold">Generating lesson content...</p>
            <p className="text-sm text-slate-400 text-center">The AI is building your lesson from the topic. This takes a few seconds.</p>
            <Loader2 size={20} className="text-violet-400 animate-spin" />
          </div>
        </div>
      )}

      {/* Clear content confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center mb-4">
              <Eraser size={22} className="text-rose-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Clear all content?</h3>
            <p className="text-sm text-slate-400 mb-6">This removes all content blocks, the description, featured image, and video URL. The lesson title and settings are kept. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clearContent}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
              >
                Clear Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  block: ContentBlock;
  index: number;
  total: number;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
}) {
  const typeConfig = BLOCK_TYPES.find(t => t.type === block.type);
  const Icon = typeConfig?.icon ?? FileText;

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-lg overflow-hidden animate-fadeInUp">
      {/* Block Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <GripVertical size={16} className="text-slate-500" />
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${typeConfig?.color} flex items-center justify-center`}>
            <Icon size={14} className="text-white" />
          </div>
          <span className="font-medium text-slate-200 text-sm capitalize">{block.type} Block</span>
          <span className="text-xs text-slate-500">#{index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-400"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            className="p-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-400"
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-rose-500/15 hover:text-rose-400 transition-colors text-slate-400 ml-2"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Block Content */}
      <div className="p-5">
        {block.type === 'text' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Content</label>
            <textarea
              value={block.content || ''}
              onChange={e => onUpdate({ content: e.target.value })}
              rows={5}
              placeholder="Write your lesson content here..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        )}

        {block.type === 'image' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Image URL</label>
              <input
                value={block.imageUrl || ''}
                onChange={e => onUpdate({ imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Alt Text (description)</label>
              <input
                value={block.imageAlt || ''}
                onChange={e => onUpdate({ imageAlt: e.target.value })}
                placeholder="Describe the image"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {block.imageUrl && (
              <div className="mt-3 rounded-xl overflow-hidden border border-slate-700">
                <img
                  src={block.imageUrl}
                  alt={block.imageAlt || 'Preview'}
                  className="w-full max-h-64 object-cover"
                  onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
              </div>
            )}
          </div>
        )}

        {block.type === 'video' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Video URL (YouTube, Vimeo, or direct link)</label>
              <input
                value={block.videoUrl || ''}
                onChange={e => onUpdate({ videoUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Video Title</label>
              <input
                value={block.videoTitle || ''}
                onChange={e => onUpdate({ videoTitle: e.target.value })}
                placeholder="e.g. Introduction to Grammar"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            {block.videoUrl && (
              <div className="mt-3 p-4 bg-slate-800 rounded-xl flex items-center gap-4 border border-slate-700">
                <div className="w-16 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Play size={20} className="text-white ml-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{block.videoTitle || 'Video Preview'}</p>
                  <p className="text-xs text-slate-400 truncate">{block.videoUrl}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {block.type === 'question' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Question</label>
              <input
                value={block.question || ''}
                onChange={e => onUpdate({ question: e.target.value })}
                placeholder="e.g. What is the past tense of 'go'?"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Answer Options</label>
              <div className="space-y-2">
                {(block.options || ['', '', '', '']).map((opt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <button
                      onClick={() => onUpdate({ correctAnswer: i })}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                        block.correctAnswer === i
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-600 hover:border-emerald-400'
                      }`}
                    >
                      {block.correctAnswer === i && <CheckCircle size={12} />}
                    </button>
                    <input
                      value={opt}
                      onChange={e => {
                        const newOpts = [...(block.options || ['', '', '', ''])];
                        newOpts[i] = e.target.value;
                        onUpdate({ options: newOpts });
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Click the circle to mark the correct answer</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
