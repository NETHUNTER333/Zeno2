import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Copy,
  Check,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Send,
  Link2,
  BookOpen,
  Layers,
  HelpCircle,
  MessageSquare,
  ListTree,
  Download,
} from 'lucide-react';
import {
  YouTubeTranscriptSegment,
  YouTubeStudyBundle,
} from '../types';
import { getAuthHeaders } from '../lib/firebase';

interface YouTubeTranscriptModalProps {
  videoId?: string | null;
  videoTitle?: string;
  videoAuthor?: string;
  isOpen?: boolean;
  onClose: () => void;
  onSummarize?: (transcript: string) => void;
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
  video?: {
    videoId?: string;
    title?: string;
    author?: string;
    videoUrl?: string;
    thumbnail?: string;
    link?: string;
    transcript?: YouTubeTranscriptSegment[];
  } | null;
}

type StudyTab = 'summary' | 'explanation' | 'flashcards' | 'quiz' | 'chat';

interface VideoChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function extractYouTubeIdFromInput(input?: string | null): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

export const YouTubeTranscriptModal: React.FC<YouTubeTranscriptModalProps> = ({
  videoId: initialVideoId,
  videoTitle: initialVideoTitle = 'YouTube Video',
  videoAuthor: initialVideoAuthor = '',
  isOpen = true,
  onClose,
  onSummarize,
  isDark = true,
  onAskZeno,
  video,
}) => {
  const derivedVideoId =
    initialVideoId ||
    video?.videoId ||
    (video?.videoUrl ? extractYouTubeIdFromInput(video.videoUrl) : null) ||
    (video?.link ? extractYouTubeIdFromInput(video.link) : null) ||
    '';
  const derivedTitle = video?.title || initialVideoTitle || 'YouTube Video';
  const derivedAuthor = video?.author || initialVideoAuthor || '';

  const [activeVideoId, setActiveVideoId] = useState<string>(derivedVideoId);
  const [urlInput, setUrlInput] = useState<string>(
    derivedVideoId ? `https://www.youtube.com/watch?v=${derivedVideoId}` : ''
  );
  const [resolvedTitle, setResolvedTitle] = useState<string>(derivedTitle);
  const [resolvedAuthor, setResolvedAuthor] = useState<string>(derivedAuthor);
  const [segments, setSegments] = useState<YouTubeTranscriptSegment[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [seekSeconds, setSeekSeconds] = useState<number>(0);
  const [autoPlayVideo, setAutoPlayVideo] = useState<boolean>(false);

  // Study Workspace State
  const [activeTab, setActiveTab] = useState<StudyTab>('summary');
  const [mobilePane, setMobilePane] = useState<'transcript' | 'study'>('study');
  const [studyBundle, setStudyBundle] = useState<YouTubeStudyBundle | null>(null);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);

  // Flashcards Interactive State
  const [cardIndex, setCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardMastery, setCardMastery] = useState<Record<string, 'known' | 'review'>>({});
  const [filterReviewOnly, setFilterReviewOnly] = useState(false);

  // Quiz Interactive State
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  // Video Chat State
  const [chatTurns, setChatTurns] = useState<VideoChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vidId =
      initialVideoId ||
      video?.videoId ||
      (video?.videoUrl ? extractYouTubeIdFromInput(video.videoUrl) : null) ||
      (video?.link ? extractYouTubeIdFromInput(video.link) : null);

    if (vidId) {
      setActiveVideoId(vidId);
      setUrlInput(`https://www.youtube.com/watch?v=${vidId}`);
    }
    const t = video?.title || initialVideoTitle;
    if (t) setResolvedTitle(t);
    const a = video?.author || initialVideoAuthor;
    if (a) setResolvedAuthor(a);

    if (video?.transcript && Array.isArray(video.transcript) && video.transcript.length > 0) {
      setSegments(video.transcript);
    }
  }, [initialVideoId, initialVideoTitle, initialVideoAuthor, video]);

  const loadVideoAndStudy = async (targetVidId: string) => {
    if (!targetVidId) return;
    setLoadingTranscript(true);
    setTranscriptError(null);
    setSegments([]);
    setStudyBundle(null);
    setStudyError(null);
    setCardIndex(0);
    setIsCardFlipped(false);
    setCardMastery({});
    setQuizAnswers({});
    setChatTurns([]);
    setSeekSeconds(0);
    setAutoPlayVideo(false);

    try {
      const transcriptUrl =
        'https://prod-main-transcript-api-6588e7-006jmayjabt.compute.instacloud-edge.com/api/transcript';
      const res = await fetch(transcriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: targetVidId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not extract transcript for this YouTube video.');
      }

      const loadedSegments: YouTubeTranscriptSegment[] = data.segments || [];
      const title = data.title || initialVideoTitle || `YouTube Video (${targetVidId})`;
      const author = data.author || initialVideoAuthor || 'YouTube';

      setSegments(loadedSegments);
      setResolvedTitle(title);
      setResolvedAuthor(author);
      setLoadingTranscript(false);

      // Immediately synthesize Study Bundle (Summary, Explanation, Flashcards, Quiz)
      if (loadedSegments.length > 0) {
        setLoadingStudy(true);
        try {
          const backendUrl = 'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';
          const studyRes = await fetch(`${backendUrl}/api/youtube/study`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoId: targetVidId,
              videoTitle: title,
              videoAuthor: author,
              segments: loadedSegments,
            }),
          });
          const studyData = await studyRes.json();
          if (studyRes.ok && studyData.success && studyData.study) {
            setStudyBundle(studyData.study);
          } else {
            throw new Error(studyData.error || 'Failed to generate study bundle.');
          }
        } catch (sErr: any) {
          setStudyError(sErr.message || 'Could not synthesize study materials.');
        } finally {
          setLoadingStudy(false);
        }
      }
    } catch (err: any) {
      setTranscriptError(err.message || 'Could not load transcript for this video.');
      setLoadingTranscript(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeVideoId) {
      loadVideoAndStudy(activeVideoId);
    }
  }, [activeVideoId, isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatTurns, chatLoading]);

  // Keyboard navigation for flashcards when on Flashcards tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'flashcards') return;
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsCardFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsCardFlipped(false);
        setCardIndex((prev) => prev + 1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsCardFlipped(false);
        setCardIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const formatSeconds = (sec: number) => {
    const safe = Math.max(0, Math.floor(sec || 0));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJumpToTimestamp = (seconds: number) => {
    setSeekSeconds(Math.max(0, Math.floor(seconds)));
    setAutoPlayVideo(true);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedId = extractYouTubeIdFromInput(urlInput);
    if (!parsedId) {
      setTranscriptError('Enter a valid YouTube link (e.g. https://www.youtube.com/watch?v=...)');
      return;
    }
    if (parsedId === activeVideoId && segments.length > 0) return;
    setActiveVideoId(parsedId);
  };

  const filteredSegments = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, searchFilter]);

  const fullText = useMemo(() => segments.map((s) => s.text).join(' '), [segments]);

  const handleCopyTranscript = () => {
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    if (segments.length === 0) return;
    const formatted = segments
      .map((s) => `[${formatSeconds(s.start_s || 0)}] ${s.text}`)
      .join('\n');
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(resolvedTitle || 'youtube_transcript').replace(/[^a-zA-Z0-9_-]/g, '_')}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const allFlashcards = studyBundle?.flashcards || [];
  const deckCards = filterReviewOnly
    ? allFlashcards.filter((c) => cardMastery[c.id] !== 'known')
    : allFlashcards;
  const safeCardIndex = deckCards.length > 0 ? Math.min(cardIndex, deckCards.length - 1) : 0;
  const currentCard = deckCards[safeCardIndex] || null;
  const knownCount = allFlashcards.filter((c) => cardMastery[c.id] === 'known').length;
  const reviewCount = allFlashcards.filter((c) => cardMastery[c.id] === 'review').length;

  const quizItems = studyBundle?.quiz || [];
  const answeredQuizCount = Object.keys(quizAnswers).length;
  const correctQuizCount = quizItems.filter(
    (q) => quizAnswers[q.id] !== undefined && quizAnswers[q.id] === q.correctIndex
  ).length;

  const handleSendVideoChat = async (customPrompt?: string) => {
    const questionText = (customPrompt ?? chatDraft).trim();
    if (!questionText || chatLoading || segments.length === 0) return;

    const userTurn: VideoChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: questionText,
    };
    const nextHistory = [...chatTurns, userTurn];
    setChatTurns(nextHistory);
    if (!customPrompt) setChatDraft('');
    setChatLoading(true);

    try {
      const authHeaders = await getAuthHeaders();
      const backendUrl = 'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';
      const res = await fetch(`${backendUrl}/api/youtube/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: activeVideoId,
          videoTitle: resolvedTitle,
          videoAuthor: resolvedAuthor,
          segments,
          question: questionText,
          history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply =
        res.ok && data.success && data.answer
          ? data.answer
          : data.error || 'Could not generate an answer from the transcript.';
      setChatTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply,
        },
      ]);
    } catch {
      setChatTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: 'Connection error while querying the video transcript.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Render text with clickable [MM:SS] timestamps
  const renderTextWithClickableTimestamps = (text: string) => {
    const parts = text.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]$/);
      if (match) {
        const hrs = match[1] ? parseInt(match[1], 10) : 0;
        const mins = parseInt(match[2], 10);
        const secs = parseInt(match[3], 10);
        const totalSec = hrs * 3600 + mins * 60 + secs;
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleJumpToTimestamp(totalSec)}
            className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded font-mono text-[11px] tabular-nums transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
                : 'bg-black/[0.07] hover:bg-black/[0.14] text-black'
            }`}
            title="Jump video to this timestamp"
          >
            {part.slice(1, -1)}
          </button>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-full flex flex-col overflow-hidden ${
        isDark ? 'bg-[#09090b] text-white' : 'bg-[#fafafa] text-[#0d0d0d]'
      }`}
    >
        {/* Top Workspace Bar: Video Metadata + Direct YouTube URL Input + Actions */}
        <div
          className={`px-4 py-3.5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
            isDark ? 'border-white/[0.08] bg-[#121216]' : 'border-black/[0.08] bg-[#f8f8f9]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`size-9 rounded-xl border flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-[#18181d] border-white/[0.08] text-white'
                  : 'bg-white border-black/[0.08] text-black'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-sm truncate">
                {activeVideoId ? resolvedTitle : 'YouTube Study & Transcript Workspace'}
              </h2>
              <div
                className={`text-[11px] font-mono tabular-nums truncate flex items-center gap-1.5 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                {activeVideoId ? (
                  <>
                    <span>{resolvedAuthor || 'YouTube'}</span>
                    <span>·</span>
                    <span>{segments.length} timed segments</span>
                    <span>·</span>
                    <span>ID: {activeVideoId}</span>
                  </>
                ) : (
                  <span>Paste any YouTube URL to extract transcript, summary, explanation, flashcards & quiz</span>
                )}
              </div>
            </div>
          </div>

          {/* Direct YouTube Link Input Form */}
          <form
            onSubmit={handleUrlSubmit}
            className="flex items-center gap-2 w-full lg:w-auto lg:min-w-[380px]"
          >
            <div
              className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                isDark
                  ? 'bg-[#18181d] border-white/[0.08] focus-within:border-white/[0.22]'
                  : 'bg-white border-black/[0.1] focus-within:border-black/[0.25]'
              }`}
            >
              <Link2
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste YouTube URL or video ID..."
                className={`w-full bg-transparent border-0 text-xs focus:outline-none ${
                  isDark
                    ? 'text-white placeholder-neutral-500'
                    : 'text-[#0d0d0d] placeholder-neutral-400'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={loadingTranscript}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50 ${
                isDark
                  ? 'bg-white text-black hover:bg-neutral-200'
                  : 'bg-[#0d0d0d] text-white hover:bg-neutral-800'
              }`}
            >
              {loadingTranscript ? 'Extracting...' : 'Load Video'}
            </button>
          </form>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyTranscript}
              disabled={loadingTranscript || segments.length === 0}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                isDark
                  ? 'bg-[#18181d] border-white/[0.08] text-neutral-300 hover:text-white hover:bg-white/[0.06]'
                  : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black hover:bg-black/[0.04]'
              }`}
              title="Copy full transcript"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy Transcript</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadTranscript}
              disabled={loadingTranscript || segments.length === 0}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                isDark
                  ? 'bg-[#18181d] border-white/[0.08] text-neutral-300 hover:text-white hover:bg-white/[0.06]'
                  : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black hover:bg-black/[0.04]'
              }`}
              title="Download transcript as text file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {onSummarize && segments.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onSummarize(
                    `Analyze this YouTube video transcript ("${resolvedTitle}"):\n\n${fullText.slice(0, 8000)}`
                  );
                  onClose();
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#18181d] border-white/[0.08] text-neutral-200 hover:bg-white/[0.08]'
                    : 'bg-white border-black/[0.08] text-neutral-800 hover:bg-black/[0.04]'
                }`}
              >
                Send to Chat
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isDark
                  ? 'hover:bg-white/[0.08] text-neutral-400 hover:text-white'
                  : 'hover:bg-black/[0.06] text-neutral-500 hover:text-black'
              }`}
              aria-label="Close workspace"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile View Switcher (Transcript vs Study Tools) */}
        <div
          className={`flex lg:hidden border-b p-1.5 gap-1 ${
            isDark ? 'border-white/[0.08] bg-[#121216]' : 'border-black/[0.08] bg-[#f4f4f5]'
          }`}
        >
          <button
            type="button"
            onClick={() => setMobilePane('transcript')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mobilePane === 'transcript'
                ? isDark
                  ? 'bg-white text-black'
                  : 'bg-[#0d0d0d] text-white'
                : isDark
                ? 'text-neutral-400'
                : 'text-neutral-600'
            }`}
          >
            Video & Transcript ({segments.length})
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('study')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mobilePane === 'study'
                ? isDark
                  ? 'bg-white text-black'
                  : 'bg-[#0d0d0d] text-white'
                : isDark
                ? 'text-neutral-400'
                : 'text-neutral-600'
            }`}
          >
            Study Tools (Summary · Flashcards · Quiz)
          </button>
        </div>

        {/* Main 2-Column Workspace Body */}
        {!activeVideoId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div
              className={`max-w-md w-full p-6 rounded-2xl border ${
                isDark ? 'bg-[#121216] border-white/[0.08]' : 'bg-[#f8f8f9] border-black/[0.08]'
              }`}
            >
              <FileText
                className={`w-8 h-8 mx-auto mb-3 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              />
              <h3 className="text-sm font-semibold mb-1">Enter a YouTube Link Above</h3>
              <p
                className={`text-xs leading-relaxed mb-4 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                Paste any YouTube watch URL, Shorts link, or `youtu.be` link to extract timed captions via Subclip and generate interactive summaries, first-principles explanations, flashcards, and quizzes.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { label: 'Attention Is All You Need', id: 'iDulhoQ2pro' },
                  { label: 'How Large Language Models Work', id: 'zjkBMFhNj_g' },
                ].map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => {
                      setUrlInput(`https://www.youtube.com/watch?v=${sample.id}`);
                      setActiveVideoId(sample.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#18181d] border-white/[0.08] text-neutral-300 hover:text-white hover:border-white/[0.2]'
                        : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black hover:border-black/[0.2]'
                    }`}
                  >
                    Try: {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
            {/* Left Column (5 cols on Desktop): Video Player + Timed Searchable Transcript */}
            <div
              className={`lg:col-span-5 flex flex-col min-h-0 border-r ${
                isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
              } ${mobilePane === 'study' ? 'hidden lg:flex' : 'flex'}`}
            >
              {/* Embedded YouTube Player */}
              <div className="aspect-video w-full bg-black shrink-0 border-b border-white/[0.08]">
                <iframe
                  key={`${activeVideoId}-${seekSeconds}-${autoPlayVideo ? 1 : 0}`}
                  src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?start=${seekSeconds}${
                    autoPlayVideo ? '&autoplay=1' : ''
                  }&rel=0&modestbranding=1`}
                  title={resolvedTitle}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              {/* Search Bar for Timed Transcript */}
              <div
                className={`px-3.5 py-2.5 border-b flex items-center gap-2.5 shrink-0 ${
                  isDark ? 'border-white/[0.08] bg-[#121216]' : 'border-black/[0.08] bg-[#f8f8f9]'
                }`}
              >
                <Search
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                  }`}
                />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter transcript segments..."
                  className={`w-full bg-transparent border-0 text-xs focus:outline-none ${
                    isDark
                      ? 'text-white placeholder-neutral-500'
                      : 'text-[#0d0d0d] placeholder-neutral-400'
                  }`}
                />
                {segments.length > 0 && (
                  <span
                    className={`text-[11px] font-mono tabular-nums whitespace-nowrap ${
                      isDark ? 'text-neutral-500' : 'text-neutral-400'
                    }`}
                  >
                    {filteredSegments.length} lines
                  </span>
                )}
              </div>

              {/* Timed Transcript Scroll Area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
                {loadingTranscript && (
                  <div className="py-16 flex flex-col items-center justify-center gap-2.5">
                    <Loader2
                      className={`w-5 h-5 animate-spin ${
                        isDark ? 'text-white' : 'text-black'
                      }`}
                    />
                    <p
                      className={`text-xs font-medium ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      Extracting timed transcript via Subclip...
                    </p>
                  </div>
                )}

                {transcriptError && !loadingTranscript && (
                  <div
                    className={`p-4 rounded-xl border text-xs ${
                      isDark
                        ? 'bg-red-500/10 border-red-500/20 text-red-300'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    <p className="font-semibold mb-1">Transcript Extraction Notice</p>
                    <p>{transcriptError}</p>
                  </div>
                )}

                {!loadingTranscript && !transcriptError && filteredSegments.length === 0 && (
                  <div
                    className={`py-12 text-center text-xs ${
                      isDark ? 'text-neutral-500' : 'text-neutral-400'
                    }`}
                  >
                    No matching transcript segments found.
                  </div>
                )}

                {!loadingTranscript &&
                  !transcriptError &&
                  filteredSegments.map((seg, idx) => {
                    const isCurrent =
                      Math.abs(seg.start_s - seekSeconds) < 3 && seekSeconds > 0;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleJumpToTimestamp(seg.start_s)}
                        className={`p-2.5 rounded-xl flex items-start gap-3 transition-colors cursor-pointer group ${
                          isCurrent
                            ? isDark
                              ? 'bg-white/[0.08]'
                              : 'bg-black/[0.06]'
                            : isDark
                            ? 'hover:bg-white/[0.04]'
                            : 'hover:bg-black/[0.03]'
                        }`}
                      >
                        <button
                          type="button"
                          className={`font-mono text-[11px] tabular-nums px-1.5 py-0.5 rounded shrink-0 transition-colors ${
                            isDark
                              ? 'bg-[#18181d] text-neutral-300 group-hover:bg-white group-hover:text-black'
                              : 'bg-[#f1f1f3] text-neutral-700 group-hover:bg-black group-hover:text-white'
                          }`}
                          title="Seek video to this timestamp"
                        >
                          {formatSeconds(seg.start_s)}
                        </button>
                        <p
                          className={`text-xs leading-relaxed flex-1 ${
                            isDark ? 'text-neutral-200' : 'text-neutral-800'
                          }`}
                        >
                          {seg.text}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Right Column (7 cols on Desktop): Study Synthesis Tabs (Summary, Explanation, Flashcards, Quiz, Chat) */}
            <div
              className={`lg:col-span-7 flex flex-col min-h-0 ${
                mobilePane === 'transcript' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Segmented Study Mode Navigation Bar */}
              <div
                className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 overflow-x-auto scrollbar-none shrink-0 ${
                  isDark ? 'border-white/[0.08] bg-[#121216]' : 'border-black/[0.08] bg-[#f8f8f9]'
                }`}
              >
                <div
                  className={`inline-flex items-center gap-1 p-1 rounded-xl border ${
                    isDark ? 'bg-[#18181d] border-white/[0.08]' : 'bg-[#ededf0] border-black/[0.06]'
                  }`}
                >
                  {(
                    [
                      { id: 'summary', label: 'Summary', icon: ListTree },
                      { id: 'explanation', label: 'Explanation', icon: BookOpen },
                      {
                        id: 'flashcards',
                        label: `Flashcards${allFlashcards.length ? ` (${allFlashcards.length})` : ''}`,
                        icon: Layers,
                      },
                      {
                        id: 'quiz',
                        label: `Quiz${quizItems.length ? ` (${quizItems.length})` : ''}`,
                        icon: HelpCircle,
                      },
                      { id: 'chat', label: 'Video Q&A', icon: MessageSquare },
                    ] as const
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                          active
                            ? isDark
                              ? 'bg-white text-black shadow-xs'
                              : 'bg-[#0d0d0d] text-white shadow-xs'
                            : isDark
                            ? 'text-neutral-400 hover:text-white'
                            : 'text-neutral-600 hover:text-black'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Study Tab Viewport */}
              <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                {loadingStudy ? (
                  <div className="py-24 flex flex-col items-center justify-center gap-3">
                    <Loader2
                      className={`w-6 h-6 animate-spin ${
                        isDark ? 'text-white' : 'text-black'
                      }`}
                    />
                    <div className="text-center">
                      <p className="text-xs font-semibold">
                        Synthesizing structured study material...
                      </p>
                      <p
                        className={`text-[11px] mt-1 ${
                          isDark ? 'text-neutral-400' : 'text-neutral-500'
                        }`}
                      >
                        Building chapter summary, conceptual explanations, flashcards, and assessment quiz
                      </p>
                    </div>
                  </div>
                ) : studyError ? (
                  <div
                    className={`p-4 rounded-xl border text-xs ${
                      isDark
                        ? 'bg-red-500/10 border-red-500/20 text-red-300'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    <p className="font-semibold mb-1">Study Synthesis Notice</p>
                    <p>{studyError}</p>
                  </div>
                ) : !studyBundle ? (
                  <div
                    className={`py-20 text-center text-xs ${
                      isDark ? 'text-neutral-500' : 'text-neutral-400'
                    }`}
                  >
                    Load a YouTube video to generate study materials.
                  </div>
                ) : (
                  <>
                    {/* TAB 1: SUMMARY */}
                    {activeTab === 'summary' && (
                      <div className="space-y-5">
                        {/* Executive Overview */}
                        <div
                          className={`p-4 rounded-xl border ${
                            isDark
                              ? 'bg-[#141418] border-white/[0.08]'
                              : 'bg-[#f8f8f9] border-black/[0.08]'
                          }`}
                        >
                          <div
                            className={`text-[11px] font-mono uppercase tracking-wider mb-2 ${
                              isDark ? 'text-neutral-400' : 'text-neutral-500'
                            }`}
                          >
                            Executive Overview
                          </div>
                          <p
                            className={`text-sm leading-relaxed ${
                              isDark ? 'text-neutral-100' : 'text-neutral-900'
                            }`}
                          >
                            {studyBundle.summary.overview}
                          </p>
                        </div>

                        {/* Key Takeaways */}
                        <div>
                          <div
                            className={`text-xs font-semibold mb-2.5 ${
                              isDark ? 'text-white' : 'text-black'
                            }`}
                          >
                            Key Takeaways ({studyBundle.summary.keyPoints.length})
                          </div>
                          <div className="space-y-2">
                            {studyBundle.summary.keyPoints.map((point, idx) => (
                              <div
                                key={idx}
                                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                                  isDark
                                    ? 'bg-[#121216] border-white/[0.07]'
                                    : 'bg-white border-black/[0.08]'
                                }`}
                              >
                                <span
                                  className={`font-mono text-[11px] tabular-nums pt-0.5 shrink-0 ${
                                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                                  }`}
                                >
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <p
                                  className={`text-xs leading-relaxed ${
                                    isDark ? 'text-neutral-200' : 'text-neutral-800'
                                  }`}
                                >
                                  {point}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Timestamped Chapters */}
                        {studyBundle.summary.chapters.length > 0 && (
                          <div>
                            <div
                              className={`text-xs font-semibold mb-2.5 ${
                                isDark ? 'text-white' : 'text-black'
                              }`}
                            >
                              Timestamped Breakdown
                            </div>
                            <div className="space-y-2">
                              {studyBundle.summary.chapters.map((ch, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => handleJumpToTimestamp(ch.timestamp)}
                                  className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                                    isDark
                                      ? 'bg-[#121216] border-white/[0.07] hover:border-white/[0.2]'
                                      : 'bg-white border-black/[0.08] hover:border-black/[0.25]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs font-semibold">{ch.title}</span>
                                    <span
                                      className={`font-mono text-[11px] tabular-nums px-2 py-0.5 rounded ${
                                        isDark
                                          ? 'bg-white/[0.08] text-white'
                                          : 'bg-black/[0.06] text-black'
                                      }`}
                                    >
                                      {formatSeconds(ch.timestamp)}
                                    </span>
                                  </div>
                                  <p
                                    className={`text-xs leading-relaxed ${
                                      isDark ? 'text-neutral-400' : 'text-neutral-600'
                                    }`}
                                  >
                                    {ch.summary}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: EXPLANATION */}
                    {activeTab === 'explanation' && (
                      <div className="space-y-5">
                        <div
                          className={`p-4 rounded-xl border ${
                            isDark
                              ? 'bg-[#141418] border-white/[0.08]'
                              : 'bg-[#f8f8f9] border-black/[0.08]'
                          }`}
                        >
                          <div
                            className={`text-[11px] font-mono uppercase tracking-wider mb-2 ${
                              isDark ? 'text-neutral-400' : 'text-neutral-500'
                            }`}
                          >
                            First-Principles Synthesis
                          </div>
                          <p
                            className={`text-sm leading-relaxed ${
                              isDark ? 'text-neutral-100' : 'text-neutral-900'
                            }`}
                          >
                            {studyBundle.explanation.coreThesis}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {studyBundle.explanation.concepts.map((concept, idx) => (
                            <div
                              key={idx}
                              className={`p-4 rounded-xl border ${
                                isDark
                                  ? 'bg-[#121216] border-white/[0.08]'
                                  : 'bg-white border-black/[0.08]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-mono text-[11px] tabular-nums ${
                                      isDark ? 'text-neutral-500' : 'text-neutral-400'
                                    }`}
                                  >
                                    0{idx + 1}
                                  </span>
                                  <h4 className="text-sm font-semibold">{concept.term}</h4>
                                </div>
                                {typeof concept.timestamp === 'number' && (
                                  <button
                                    type="button"
                                    onClick={() => handleJumpToTimestamp(concept.timestamp!)}
                                    className={`font-mono text-[11px] tabular-nums px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                      isDark
                                        ? 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
                                        : 'bg-black/[0.06] hover:bg-black/[0.12] text-black'
                                    }`}
                                  >
                                    {formatSeconds(concept.timestamp)}
                                  </button>
                                )}
                              </div>

                              <div className="space-y-2 text-xs leading-relaxed">
                                <div>
                                  <span
                                    className={`font-semibold ${
                                      isDark ? 'text-neutral-300' : 'text-neutral-700'
                                    }`}
                                  >
                                    Definition:{' '}
                                  </span>
                                  <span
                                    className={
                                      isDark ? 'text-neutral-400' : 'text-neutral-600'
                                    }
                                  >
                                    {concept.definition}
                                  </span>
                                </div>
                                <div>
                                  <span
                                    className={`font-semibold ${
                                      isDark ? 'text-neutral-300' : 'text-neutral-700'
                                    }`}
                                  >
                                    Mechanism:{' '}
                                  </span>
                                  <span
                                    className={
                                      isDark ? 'text-neutral-400' : 'text-neutral-600'
                                    }
                                  >
                                    {concept.mechanism}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TAB 3: FLASHCARDS */}
                    {activeTab === 'flashcards' && (
                      <div className="space-y-4">
                        {/* Flashcard Deck Status Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div
                            className={`text-xs font-mono tabular-nums ${
                              isDark ? 'text-neutral-400' : 'text-neutral-600'
                            }`}
                          >
                            {deckCards.length > 0
                              ? `Card ${safeCardIndex + 1} of ${deckCards.length}`
                              : '0 cards'}{' '}
                            · Known: {knownCount} · Review: {reviewCount}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFilterReviewOnly((prev) => !prev);
                                setCardIndex(0);
                                setIsCardFlipped(false);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                                filterReviewOnly
                                  ? isDark
                                    ? 'bg-white text-black border-white'
                                    : 'bg-black text-white border-black'
                                  : isDark
                                  ? 'bg-[#18181d] border-white/[0.08] text-neutral-300'
                                  : 'bg-[#f4f4f5] border-black/[0.08] text-neutral-700'
                              }`}
                            >
                              {filterReviewOnly ? 'Showing Review Only' : 'Filter Unmastered'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setCardMastery({});
                                setFilterReviewOnly(false);
                                setCardIndex(0);
                                setIsCardFlipped(false);
                              }}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isDark
                                  ? 'bg-[#18181d] border-white/[0.08] text-neutral-400 hover:text-white'
                                  : 'bg-[#f4f4f5] border-black/[0.08] text-neutral-600 hover:text-black'
                              }`}
                              title="Reset flashcard progress"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {currentCard ? (
                          <>
                            {/* Interactive Flippable Card */}
                            <div
                              onClick={() => setIsCardFlipped((prev) => !prev)}
                              className={`min-h-[260px] p-6 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer select-none ${
                                isDark
                                  ? 'bg-[#141418] border-white/[0.1] hover:border-white/[0.22]'
                                  : 'bg-[#f8f8fa] border-black/[0.1] hover:border-black/[0.25]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                                <span
                                  className={
                                    isDark ? 'text-neutral-400' : 'text-neutral-500'
                                  }
                                >
                                  {isCardFlipped ? 'ANSWER' : 'PROMPT'} · {currentCard.category}
                                </span>
                                {typeof currentCard.timestamp === 'number' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJumpToTimestamp(currentCard.timestamp!);
                                    }}
                                    className={`px-2 py-0.5 rounded tabular-nums ${
                                      isDark
                                        ? 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
                                        : 'bg-black/[0.06] hover:bg-black/[0.12] text-black'
                                    }`}
                                  >
                                    {formatSeconds(currentCard.timestamp)}
                                  </button>
                                )}
                              </div>

                              <div className="my-auto py-6 text-center px-2">
                                <p
                                  className={`text-base sm:text-lg font-medium leading-relaxed ${
                                    isDark ? 'text-white' : 'text-[#0d0d0d]'
                                  }`}
                                >
                                  {isCardFlipped ? currentCard.back : currentCard.front}
                                </p>
                              </div>

                              <div className="flex items-center justify-between text-[11px]">
                                <span
                                  className={
                                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                                  }
                                >
                                  Click card or press Space to flip
                                </span>
                                {cardMastery[currentCard.id] && (
                                  <span
                                    className={`font-mono uppercase ${
                                      cardMastery[currentCard.id] === 'known'
                                        ? 'text-emerald-500'
                                        : 'text-amber-500'
                                    }`}
                                  >
                                    {cardMastery[currentCard.id]}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Navigation & Mastery Controls */}
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                disabled={safeCardIndex === 0}
                                onClick={() => {
                                  setIsCardFlipped(false);
                                  setCardIndex(Math.max(0, safeCardIndex - 1));
                                }}
                                className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                                  isDark
                                    ? 'bg-[#18181d] border-white/[0.08] text-white hover:bg-white/[0.06]'
                                    : 'bg-white border-black/[0.08] text-black hover:bg-black/[0.04]'
                                }`}
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Previous</span>
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCardMastery((prev) => ({
                                      ...prev,
                                      [currentCard.id]: 'review',
                                    }));
                                    setIsCardFlipped(false);
                                    if (safeCardIndex < deckCards.length - 1) {
                                      setCardIndex(safeCardIndex + 1);
                                    }
                                  }}
                                  className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                                    cardMastery[currentCard.id] === 'review'
                                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                      : isDark
                                      ? 'bg-[#18181d] border-white/[0.08] text-neutral-300 hover:text-white'
                                      : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black'
                                  }`}
                                >
                                  Review Again
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setCardMastery((prev) => ({
                                      ...prev,
                                      [currentCard.id]: 'known',
                                    }));
                                    setIsCardFlipped(false);
                                    if (safeCardIndex < deckCards.length - 1) {
                                      setCardIndex(safeCardIndex + 1);
                                    }
                                  }}
                                  className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                                    cardMastery[currentCard.id] === 'known'
                                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                      : isDark
                                      ? 'bg-white text-black border-white hover:bg-neutral-200'
                                      : 'bg-[#0d0d0d] text-white border-black hover:bg-neutral-800'
                                  }`}
                                >
                                  Mark Known
                                </button>
                              </div>

                              <button
                                type="button"
                                disabled={safeCardIndex >= deckCards.length - 1}
                                onClick={() => {
                                  setIsCardFlipped(false);
                                  setCardIndex(Math.min(deckCards.length - 1, safeCardIndex + 1));
                                }}
                                className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                                  isDark
                                    ? 'bg-[#18181d] border-white/[0.08] text-white hover:bg-white/[0.06]'
                                    : 'bg-white border-black/[0.08] text-black hover:bg-black/[0.04]'
                                }`}
                              >
                                <span>Next</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <div
                            className={`p-8 rounded-2xl border text-center text-xs ${
                              isDark
                                ? 'bg-[#141418] border-white/[0.08] text-neutral-400'
                                : 'bg-[#f8f8f9] border-black/[0.08] text-neutral-600'
                            }`}
                          >
                            All flashcards have been marked as known. Click "Filter Unmastered" or reset to review again.
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 4: QUIZ */}
                    {activeTab === 'quiz' && (
                      <div className="space-y-4">
                        <div
                          className={`p-3.5 rounded-xl border flex items-center justify-between ${
                            isDark
                              ? 'bg-[#141418] border-white/[0.08]'
                              : 'bg-[#f8f8f9] border-black/[0.08]'
                          }`}
                        >
                          <div className="text-xs font-mono tabular-nums">
                            Score: <span className="font-semibold">{correctQuizCount}</span> /{' '}
                            {quizItems.length} ({answeredQuizCount} answered)
                          </div>
                          {answeredQuizCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setQuizAnswers({})}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                isDark
                                  ? 'bg-[#18181d] border-white/[0.08] text-neutral-300 hover:text-white'
                                  : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black'
                              }`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset Quiz</span>
                            </button>
                          )}
                        </div>

                        <div className="space-y-4">
                          {quizItems.map((q, qIdx) => {
                            const selectedOpt = quizAnswers[q.id];
                            const hasAnswered = selectedOpt !== undefined;

                            return (
                              <div
                                key={q.id}
                                className={`p-4 rounded-xl border ${
                                  isDark
                                    ? 'bg-[#121216] border-white/[0.08]'
                                    : 'bg-white border-black/[0.08]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="text-xs sm:text-sm font-semibold leading-snug">
                                    <span
                                      className={`font-mono mr-2 ${
                                        isDark ? 'text-neutral-500' : 'text-neutral-400'
                                      }`}
                                    >
                                      Q{qIdx + 1}.
                                    </span>
                                    {q.question}
                                  </div>
                                  {typeof q.timestamp === 'number' && (
                                    <button
                                      type="button"
                                      onClick={() => handleJumpToTimestamp(q.timestamp!)}
                                      className={`font-mono text-[11px] tabular-nums px-2 py-0.5 rounded shrink-0 transition-colors cursor-pointer ${
                                        isDark
                                          ? 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
                                          : 'bg-black/[0.06] hover:bg-black/[0.12] text-black'
                                      }`}
                                    >
                                      {formatSeconds(q.timestamp)}
                                    </button>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  {q.options.map((opt, oIdx) => {
                                    const isSelected = selectedOpt === oIdx;
                                    const isCorrect = q.correctIndex === oIdx;

                                    let optionStyle = isDark
                                      ? 'bg-[#18181d] border-white/[0.08] text-neutral-200 hover:border-white/[0.22]'
                                      : 'bg-[#f8f8f9] border-black/[0.08] text-neutral-800 hover:border-black/[0.25]';

                                    if (hasAnswered) {
                                      if (isCorrect) {
                                        optionStyle =
                                          'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-medium';
                                      } else if (isSelected && !isCorrect) {
                                        optionStyle =
                                          'bg-red-500/15 border-red-500/40 text-red-400';
                                      }
                                    }

                                    return (
                                      <button
                                        key={oIdx}
                                        type="button"
                                        disabled={hasAnswered}
                                        onClick={() =>
                                          setQuizAnswers((prev) => ({
                                            ...prev,
                                            [q.id]: oIdx,
                                          }))
                                        }
                                        className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5 cursor-pointer disabled:cursor-default ${optionStyle}`}
                                      >
                                        <span className="font-mono text-[11px] opacity-70 shrink-0">
                                          {String.fromCharCode(65 + oIdx)}.
                                        </span>
                                        <span className="flex-1 leading-relaxed">{opt}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {hasAnswered && q.explanation && (
                                  <div
                                    className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${
                                      isDark
                                        ? 'bg-white/[0.03] border-white/[0.08] text-neutral-300'
                                        : 'bg-black/[0.03] border-black/[0.08] text-neutral-700'
                                    }`}
                                  >
                                    <span className="font-semibold">Explanation: </span>
                                    {q.explanation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* TAB 5: CONTEXTUAL VIDEO Q&A CHAT */}
                    {activeTab === 'chat' && (
                      <div className="flex flex-col h-[58vh]">
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                          {chatTurns.length === 0 ? (
                            <div
                              className={`p-5 rounded-xl border ${
                                isDark
                                  ? 'bg-[#141418] border-white/[0.08]'
                                  : 'bg-[#f8f8f9] border-black/[0.08]'
                              }`}
                            >
                              <div className="text-xs font-semibold mb-1">
                                Ask anything about "{resolvedTitle}"
                              </div>
                              <p
                                className={`text-xs leading-relaxed mb-3 ${
                                  isDark ? 'text-neutral-400' : 'text-neutral-600'
                                }`}
                              >
                                Answers are grounded strictly in the extracted video transcript and include clickable timestamps to jump the video player.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  'What are the core arguments and evidence in this video?',
                                  'List every technical term or formula mentioned with timestamps',
                                  'Summarize the conclusion and practical takeaways',
                                ].map((promptText, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSendVideoChat(promptText)}
                                    className={`px-3 py-1.5 rounded-xl border text-xs text-left transition-colors cursor-pointer ${
                                      isDark
                                        ? 'bg-[#18181d] border-white/[0.08] text-neutral-300 hover:text-white hover:border-white/[0.2]'
                                        : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black hover:border-black/[0.2]'
                                    }`}
                                  >
                                    {promptText}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            chatTurns.map((turn) => (
                              <div
                                key={turn.id}
                                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                                  turn.role === 'user'
                                    ? isDark
                                      ? 'bg-white/[0.07] border-white/[0.12] ml-8'
                                      : 'bg-black/[0.05] border-black/[0.1] ml-8'
                                    : isDark
                                    ? 'bg-[#141418] border-white/[0.08] mr-4'
                                    : 'bg-white border-black/[0.08] mr-4'
                                }`}
                              >
                                <div
                                  className={`text-[10px] font-mono uppercase mb-1 ${
                                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                                  }`}
                                >
                                  {turn.role === 'user' ? 'You' : 'Transcript Assistant'}
                                </div>
                                <div className="whitespace-pre-wrap">
                                  {renderTextWithClickableTimestamps(turn.content)}
                                </div>
                              </div>
                            ))
                          )}

                          {chatLoading && (
                            <div
                              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                                isDark
                                  ? 'bg-[#141418] border-white/[0.08] text-neutral-400'
                                  : 'bg-white border-black/[0.08] text-neutral-600'
                              }`}
                            >
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Checking video transcript...</span>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSendVideoChat();
                          }}
                          className="mt-3 pt-3 border-t border-white/[0.08] flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={chatDraft}
                            onChange={(e) => setChatDraft(e.target.value)}
                            placeholder="Ask a question about this video..."
                            className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none ${
                              isDark
                                ? 'bg-[#18181d] border-white/[0.1] text-white placeholder-neutral-500 focus:border-white/[0.25]'
                                : 'bg-[#f8f8f9] border-black/[0.1] text-black placeholder-neutral-400 focus:border-black/[0.25]'
                            }`}
                          />
                          <button
                            type="submit"
                            disabled={!chatDraft.trim() || chatLoading}
                            className={`px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                              isDark
                                ? 'bg-white text-black hover:bg-neutral-200'
                                : 'bg-[#0d0d0d] text-white hover:bg-neutral-800'
                            }`}
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Ask</span>
                          </button>
                        </form>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
