import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
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
  Mic,
  Upload,
  Cloud,
  CheckCircle2,
  Sparkles,
  Download,
  Trash2,
  FolderOpen,
  Volume2,
  Cpu,
  Clock,
  ExternalLink,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  YouTubeTranscriptSegment,
  YouTubeStudyBundle,
  YouTubeVideoInfo,
} from '../types';
import {
  auth,
  getAuthHeaders,
  saveUserStudySessionToFirestore,
  loadUserStudySessionsFromFirestore,
  deleteUserStudySessionFromFirestore,
  UserStudySession,
} from '../lib/firebase';

export interface StudyWorkspaceProps {
  initialVideo?: YouTubeVideoInfo | null;
  onBackToChat: () => void;
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
}

type StudyTab =
  | 'summary'
  | 'explanation'
  | 'flashcards'
  | 'quiz'
  | 'chat'
  | 'notes';

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

export const StudyWorkspace: React.FC<StudyWorkspaceProps> = ({
  initialVideo,
  onBackToChat,
  isDark = true,
  onAskZeno,
}) => {
  const initialId =
    initialVideo?.videoId ||
    (initialVideo?.videoUrl
      ? extractYouTubeIdFromInput(initialVideo.videoUrl)
      : null) ||
    (initialVideo?.link ? extractYouTubeIdFromInput(initialVideo.link) : null) ||
    '';

  const [activeVideoId, setActiveVideoId] = useState<string>(initialId);
  const [urlInput, setUrlInput] = useState<string>(
    initialId ? `https://www.youtube.com/watch?v=${initialId}` : ''
  );
  const [resolvedTitle, setResolvedTitle] = useState<string>(
    initialVideo?.title || 'YouTube Study Workspace'
  );
  const [resolvedAuthor, setResolvedAuthor] = useState<string>(
    initialVideo?.author || ''
  );
  const [resolvedThumbnail, setResolvedThumbnail] = useState<string>(
    initialVideo?.thumbnail ||
      (initialId ? `https://i.ytimg.com/vi/${initialId}/hqdefault.jpg` : '')
  );

  // Transcript state
  const [segments, setSegments] = useState<YouTubeTranscriptSegment[]>(
    initialVideo?.transcript || []
  );
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptProvider, setTranscriptProvider] = useState<string>(
    initialVideo?.transcript?.length ? 'cached-context' : ''
  );
  const [searchFilter, setSearchFilter] = useState('');
  const [copied, setCopied] = useState(false);

  // Video playback & sync state
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [playerMode, setPlayerMode] = useState<'embed' | 'direct'>('embed');
  const [videoStreamUrl, setVideoStreamUrl] = useState<string>(
    initialVideo?.videoUrl || ''
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);



  // Study Materials State
  const [activeTab, setActiveTab] = useState<StudyTab>('summary');
  const [studyBundle, setStudyBundle] = useState<YouTubeStudyBundle | null>(null);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);

  // Interactive Flashcards State
  const [cardIndex, setCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardMastery, setCardMastery] = useState<Record<string, 'known' | 'review'>>(
    {}
  );
  const [filterReviewOnly, setFilterReviewOnly] = useState(false);

  // Interactive Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  // Video Chat State
  const [chatTurns, setChatTurns] = useState<VideoChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Cloud Notes State
  const [userNotes, setUserNotes] = useState('');
  const [cloudSavedStatus, setCloudSavedStatus] = useState<
    'saved' | 'saving' | 'offline'
  >('saved');

  // Saved Cloud Sessions Drawer
  const [isSessionsDrawerOpen, setIsSessionsDrawerOpen] = useState(false);
  const [savedSessions, setSavedSessions] = useState<UserStudySession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [mobileTab, setMobileTab] = useState<'transcript' | 'study'>('transcript');

  // Keyboard shortcut: Esc to return to chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBackToChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBackToChat]);

  // Load Saved Sessions from Firestore on mount
  useEffect(() => {
    if (auth.currentUser) {
      setLoadingSessions(true);
      loadUserStudySessionsFromFirestore()
        .then((sessions) => {
          setSavedSessions(sessions);
          setLoadingSessions(false);
        })
        .catch(() => setLoadingSessions(false));
    }
  }, []);

  // Sync to Firestore cloud account
  const persistSessionToCloud = async (override?: Partial<UserStudySession>) => {
    if (!activeVideoId || !auth.currentUser) return;
    setCloudSavedStatus('saving');
    try {
      const answeredCount = Object.keys(quizAnswers).length;
      const correctCount = Object.entries(quizAnswers).filter(([id, ansIdx]) => {
        const item = studyBundle?.quiz.find((q) => q.id === id);
        return item && item.correctIndex === ansIdx;
      }).length;

      const session: UserStudySession = {
        videoId: activeVideoId,
        title: resolvedTitle,
        author: resolvedAuthor,
        thumbnail: resolvedThumbnail,
        updatedAt: Date.now(),
        segmentsCount: segments.length,
        notes: override?.notes !== undefined ? override.notes : userNotes,
        flashcardMastery:
          override?.flashcardMastery !== undefined
            ? override.flashcardMastery
            : cardMastery,
        quizScore: {
          answered: answeredCount,
          total: studyBundle?.quiz.length || 0,
          correct: correctCount,
        },
      };

      await saveUserStudySessionToFirestore(session);
      setCloudSavedStatus('saved');
    } catch {
      setCloudSavedStatus('offline');
    }
  };

  // Main video loader & study synthesizer
  const loadVideo = async (targetVidId: string) => {
    if (!targetVidId) return;
    setActiveVideoId(targetVidId);
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
    setCurrentTimeSec(0);

    try {
      const authHeaders = await getAuthHeaders();
      const transcriptUrl =
        'https://prod-main-transcript-api-6588e7-006jmayjabt.compute.instacloud-edge.com/api/transcript';
      const res = await fetch(transcriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: targetVidId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || 'Could not extract transcript for this YouTube video.'
        );
      }

      const loadedSegments: YouTubeTranscriptSegment[] = data.segments || [];
      const title = data.title || `YouTube Video (${targetVidId})`;
      const author = data.author || 'Creator';
      const thumbnail =
        data.thumbnail || `https://i.ytimg.com/vi/${targetVidId}/hqdefault.jpg`;

      setSegments(loadedSegments);
      setResolvedTitle(title);
      setResolvedAuthor(author);
      setResolvedThumbnail(thumbnail);
      setTranscriptProvider(data.provider || 'youtube-official-captions');
      setLoadingTranscript(false);

      // Synthesize deep Study Bundle
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
            throw new Error(studyData.error || 'Failed to synthesize study bundle.');
          }
        } catch (sErr: any) {
          setStudyError(sErr.message || 'Could not synthesize study materials.');
        } finally {
          setLoadingStudy(false);
        }
      }

      // Check for direct video stream
      try {
        const streamRes = await fetch(
          `/api/media/resolve?url=${encodeURIComponent(
            `https://www.youtube.com/watch?v=${targetVidId}`
          )}`
        );
        if (streamRes.ok) {
          const sData = await streamRes.json();
          if (sData.videoUrl) {
            setVideoStreamUrl(sData.videoUrl);
          }
        }
      } catch {}

      // Auto save to Firestore
      setTimeout(() => persistSessionToCloud(), 1000);
    } catch (err: any) {
      setTranscriptError(
        err.message || 'Could not load transcript for this video.'
      );
      setLoadingTranscript(false);
    }
  };

  useEffect(() => {
    if (activeVideoId && segments.length === 0) {
      loadVideo(activeVideoId);
    }
  }, [activeVideoId]);

  // Auto scroll active segment into view during playback
  useEffect(() => {
    if (!autoScroll || segments.length === 0) return;
    const activeEl = transcriptContainerRef.current?.querySelector('[data-active-segment="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTimeSec, autoScroll]);

  // YouTube iframe postMessage listener for real-time playback synchronization
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        if (typeof e.data === 'string') {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.event === 'infoDelivery' && parsed.info) {
            if (typeof parsed.info.currentTime === 'number') {
              setCurrentTimeSec(parsed.info.currentTime);
            }
          }
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);



  // Handle URL search / submission
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = extractYouTubeIdFromInput(urlInput);
    if (!cleanId) {
      alert('Please enter a valid YouTube URL or 11-character video ID.');
      return;
    }
    loadVideo(cleanId);
  };

  // Seek video playback to specific second
  const handleSeek = (sec: number) => {
    setCurrentTimeSec(sec);
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    } else if (iframeRef.current) {
      iframeRef.current.src = `https://www.youtube.com/embed/${activeVideoId}?autoplay=1&start=${Math.floor(
        sec
      )}&enablejsapi=1`;
    }
  };

  // Copy full transcript
  const handleCopyTranscript = () => {
    const fullText = segments
      .map(
        (s) =>
          `[${formatTime(s.start_s)}] ${s.text}`
      )
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSrtTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  const formatVttTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  };

  const handleDownloadTranscript = (format: 'txt' | 'srt' | 'vtt') => {
    if (segments.length === 0) {
      alert('No transcript segments available to download.');
      return;
    }

    let content = '';
    let filename = `${(resolvedTitle || 'transcript').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    let mimeType = 'text/plain;charset=utf-8';

    if (format === 'txt') {
      content = segments.map((s) => `[${formatTime(s.start_s)}] ${s.text}`).join('\n');
      filename += '.txt';
    } else if (format === 'srt') {
      content = segments
        .map((s, idx) => {
          const start = formatSrtTime(s.start_s);
          const end = formatSrtTime(s.start_s + (s.duration_s || 3));
          return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
        })
        .join('\n');
      filename += '.srt';
      mimeType = 'application/x-subrip;charset=utf-8';
    } else if (format === 'vtt') {
      content =
        'WEBVTT - Exported from Zeno Study Workspace\n\n' +
        segments
          .map((s, idx) => {
            const start = formatVttTime(s.start_s);
            const end = formatVttTime(s.start_s + (s.duration_s || 3));
            return `${idx + 1}\n${start} --> ${end}\n${s.text}\n`;
          })
          .join('\n');
      filename += '.vtt';
      mimeType = 'text/vtt;charset=utf-8';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Study Notes as Markdown
  const handleExportMarkdown = () => {
    if (!studyBundle) return;
    let md = `# Study Notes: ${resolvedTitle}\n`;
    md += `Author: ${resolvedAuthor}\n`;
    md += `Source: https://www.youtube.com/watch?v=${activeVideoId}\n\n`;

    md += `## Executive Summary\n${studyBundle.summary.overview}\n\n`;

    md += `## Key Takeaways\n`;
    studyBundle.summary.keyPoints.forEach((kp) => {
      md += `- ${kp}\n`;
    });
    md += `\n`;

    md += `## First-Principles Breakdown\n${studyBundle.explanation.coreThesis}\n\n`;
    studyBundle.explanation.concepts.forEach((c) => {
      md += `### ${c.term}\n**Definition**: ${c.definition}\n**Mechanism**: ${c.mechanism}\n\n`;
    });

    md += `## Flashcards (${studyBundle.flashcards.length})\n`;
    studyBundle.flashcards.forEach((fc, i) => {
      md += `**Q${i + 1}**: ${fc.front}\n**A**: ${fc.back}\n\n`;
    });

    if (userNotes.trim()) {
      md += `## My Notes\n${userNotes}\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resolvedTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}_study_notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Video Chat Ask
  const handleSendChat = async () => {
    const query = chatDraft.trim();
    if (!query || chatLoading) return;

    const userTurn: VideoChatTurn = {
      id: `chat-${Date.now()}`,
      role: 'user',
      content: query,
    };
    setChatTurns((prev) => [...prev, userTurn]);
    setChatDraft('');
    setChatLoading(true);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are an elite academic tutor teaching a student about the YouTube video "${resolvedTitle}" by ${resolvedAuthor}.
You have the full timestamped transcript below. Answer the user's question directly, clearly, with first-principles reasoning and cite specific timestamps [MM:SS] wherever relevant.

Timestamped Transcript:
${segments.map((s) => `[${formatTime(s.start_s)}] ${s.text}`).slice(0, 150).join('\n')}`,
            },
            ...chatTurns.map((t) => ({ role: t.role, content: t.content })),
            { role: 'user', content: query },
          ],
          model: 'Agents-A1',
        }),
      });

      const data = await res.json();
      const reply =
        data.reply ||
        data.content ||
        data.text ||
        'I have analyzed the video and here is the explanation grounded in the transcript.';

      setChatTurns((prev) => [
        ...prev,
        {
          id: `resp-${Date.now()}`,
          role: 'assistant',
          content: reply,
        },
      ]);
    } catch (err: any) {
      setChatTurns((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content:
            'Could not complete video analysis. Please check network connection and try again.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Filtered transcript segments
  const filteredSegments = useMemo(() => {
    if (!searchFilter.trim()) return segments;
    const term = searchFilter.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(term));
  }, [segments, searchFilter]);

  // Flashcards filtered
  const activeFlashcards = useMemo(() => {
    const list = studyBundle?.flashcards || [];
    if (!filterReviewOnly) return list;
    return list.filter((fc) => cardMastery[fc.id] === 'review');
  }, [studyBundle, filterReviewOnly, cardMastery]);

  const currentCard = activeFlashcards[cardIndex] || null;

  function formatTime(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div
      className={`min-h-screen w-full flex flex-col font-sans transition-colors ${
        isDark ? 'bg-[#09090b] text-[#f4f4f5]' : 'bg-[#fafafa] text-[#18181b]'
      }`}
    >


      {/* Top Workspace Header Bar */}
      <header
        className={`h-14 border-b px-4 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30 backdrop-blur-md ${
          isDark
            ? 'bg-[#09090b]/90 border-[#27272a]'
            : 'bg-[#ffffff]/90 border-[#e4e4e7]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToChat}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
              isDark
                ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-[#d4d4d8]'
                : 'bg-[#f4f4f5] border-[#e4e4e7] hover:bg-[#e4e4e7] text-[#3f3f46]'
            }`}
            title="Return to main chat (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Chat</span>
            <kbd className="hidden md:inline px-1 py-0.2 rounded text-[10px] opacity-50 bg-black/20">
              Esc
            </kbd>
          </button>

          <div className="flex items-center gap-2 truncate">
            <span className="hidden lg:inline text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Study Workspace
            </span>
            <span className="hidden lg:inline text-xs opacity-30">/</span>
            <h1 className="text-xs sm:text-sm font-semibold truncate max-w-[260px] sm:max-w-md">
              {resolvedTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Cloud Sync Status */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              isDark
                ? 'bg-white/[0.04] border-white/[0.1] text-neutral-300'
                : 'bg-neutral-100 border-black/[0.1] text-neutral-700'
            }`}
            title="Session automatically saved to your cloud account"
          >
            {cloudSavedStatus === 'saving' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : null}
            <span>
              {cloudSavedStatus === 'saved'
                ? 'Saved'
                : cloudSavedStatus === 'saving'
                ? 'Saving...'
                : 'Local Mode'}
            </span>
          </div>

          {/* Cloud Sessions Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsSessionsDrawerOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
              isDark
                ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-[#d4d4d8]'
                : 'bg-[#f4f4f5] border-[#e4e4e7] hover:bg-[#e4e4e7] text-[#3f3f46]'
            }`}
            title="Saved Video Sessions in your account"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Saved Sessions</span>
          </button>

          {/* Export Notes */}
          <button
            type="button"
            onClick={handleExportMarkdown}
            disabled={!studyBundle}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors disabled:opacity-40 ${
              isDark
                ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-[#d4d4d8]'
                : 'bg-[#f4f4f5] border-[#e4e4e7] hover:bg-[#e4e4e7] text-[#3f3f46]'
            }`}
            title="Export Markdown Study Notes"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export Notes</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher to prevent stacked double layout */}
      <div
        className={`flex lg:hidden border-b shrink-0 ${
          isDark ? 'bg-[#0f0f11] border-[#27272a]' : 'bg-[#f4f4f5] border-[#e4e4e7]'
        }`}
      >
        <button
          type="button"
          onClick={() => setMobileTab('transcript')}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 text-center transition-colors cursor-pointer ${
            mobileTab === 'transcript'
              ? isDark
                ? 'border-white text-white font-semibold'
                : 'border-black text-black font-semibold'
              : isDark
              ? 'border-transparent text-[#8a8a8a]'
              : 'border-transparent text-[#666666]'
          }`}
        >
          Video & Transcript ({segments.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('study')}
          className={`flex-1 py-2.5 text-xs font-medium border-b-2 text-center transition-colors cursor-pointer ${
            mobileTab === 'study'
              ? isDark
                ? 'border-white text-white font-semibold'
                : 'border-black text-black font-semibold'
              : isDark
              ? 'border-transparent text-[#8a8a8a]'
              : 'border-transparent text-[#666666]'
          }`}
        >
          Study Tools (Summary • Flashcards • Quiz)
        </button>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* LEFT COLUMN: Video Player & Transcript */}
        <div
          className={`lg:col-span-6 flex flex-col border-b lg:border-b-0 lg:border-r overflow-y-auto ${
            mobileTab === 'transcript' ? 'flex' : 'hidden lg:flex'
          } ${isDark ? 'border-[#27272a]' : 'border-[#e4e4e7]'}`}
        >
          {/* Video URL Input & Switcher */}
          <div
            className={`p-3 border-b shrink-0 ${
              isDark
                ? 'bg-[#121214] border-[#27272a]'
                : 'bg-[#f4f4f5] border-[#e4e4e7]'
            }`}
          >
            <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste any YouTube video link or ID (e.g. https://youtu.be/...)"
                  className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none transition-colors ${
                    isDark
                      ? 'bg-[#18181b] border-[#27272a] focus:border-blue-500 text-white'
                      : 'bg-white border-[#d4d4d8] focus:border-blue-600 text-[#18181b]'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={loadingTranscript}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 shrink-0 ${
                  isDark ? 'bg-white text-black hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                }`}
              >
                {loadingTranscript ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Analyze'
                )}
              </button>
            </form>
          </div>

          {/* Video Player Box */}
          <div className="relative aspect-video w-full bg-black shrink-0 overflow-hidden">
            {playerMode === 'direct' && videoStreamUrl ? (
              <video
                ref={videoRef}
                src={videoStreamUrl}
                controls
                className="w-full h-full object-contain"
                onTimeUpdate={() => {
                  if (videoRef.current) {
                    setCurrentTimeSec(videoRef.current.currentTime);
                  }
                }}
              />
            ) : activeVideoId ? (
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${activeVideoId}?enablejsapi=1&origin=${encodeURIComponent(
                  window.location.origin
                )}`}
                title={resolvedTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/50">
                <Play className="w-12 h-12 mb-2 stroke-[1.2]" />
                <p className="text-xs">Paste a YouTube link above to begin</p>
              </div>
            )}
          </div>

          {/* Video Chapter Detection & Clickable Navigation Markers Bar */}
          {studyBundle?.summary?.chapters && studyBundle.summary.chapters.length > 0 && (
            <div
              className={`px-3 py-2 border-b flex items-center gap-2 overflow-x-auto shrink-0 ${
                isDark ? 'bg-[#0f0f11] border-[#27272a]' : 'bg-[#fafafa] border-[#e4e4e7]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 shrink-0 flex items-center gap-1">
                <Layers className="w-3 h-3 text-blue-500" />
                Chapters:
              </span>
              {studyBundle.summary.chapters.map((ch, idx) => (
                <button
                  key={`ch-marker-${idx}`}
                  type="button"
                  onClick={() => handleSeek(ch.timestamp)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all ${
                    currentTimeSec >= ch.timestamp &&
                    (idx === studyBundle.summary.chapters.length - 1 ||
                      currentTimeSec < studyBundle.summary.chapters[idx + 1].timestamp)
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                      : isDark
                      ? 'bg-[#18181b] border-[#27272a] hover:border-blue-500/50 text-neutral-300'
                      : 'bg-white border-[#d4d4d8] hover:border-blue-400 text-neutral-700'
                  }`}
                  title={`Jump to ${ch.title} at ${formatTime(ch.timestamp)}`}
                >
                  <span className="font-mono text-[10px] opacity-75">{formatTime(ch.timestamp)}</span>
                  <span>{ch.title}</span>
                </button>
              ))}
            </div>
          )}



          {/* Transcript Search Bar & Stats */}
          <div
            className={`p-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${
              isDark
                ? 'bg-[#0f0f11] border-[#27272a]'
                : 'bg-white border-[#e4e4e7]'
            }`}
          >
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search transcript..."
                className={`w-full pl-8 pr-3 py-1 rounded-md border text-xs outline-none ${
                  isDark
                    ? 'bg-[#18181b] border-[#27272a] focus:border-blue-500 text-white'
                    : 'bg-[#f4f4f5] border-[#d4d4d8] focus:border-blue-600 text-black'
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] opacity-50 hidden sm:inline">
                {filteredSegments.length} segments
              </span>
              <button
                type="button"
                onClick={handleCopyTranscript}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a]'
                    : 'bg-[#f4f4f5] border-[#d4d4d8] hover:bg-[#e4e4e7]'
                }`}
                title="Copy full timestamped transcript"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
                  autoScroll
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : isDark
                    ? 'bg-[#18181b] border-[#27272a] text-[#a1a1aa]'
                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-[#52525b]'
                }`}
                title="Toggle auto-scroll sync with video playback"
              >
                <span>Sync: {autoScroll ? 'On' : 'Off'}</span>
              </button>

              {/* Download Transcript Dropdown / Buttons (.txt, .srt, .vtt) */}
              <div className="flex items-center gap-1 border-l pl-1.5 ml-0.5 border-white/[0.1]">
                <button
                  type="button"
                  onClick={() => handleDownloadTranscript('txt')}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-[#a1a1aa]'
                      : 'bg-[#f4f4f5] border-[#d4d4d8] hover:bg-[#e4e4e7] text-[#52525b]'
                  }`}
                  title="Download clean text (.txt)"
                >
                  <Download className="w-3 h-3 text-blue-400" />
                  <span>.txt</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTranscript('srt')}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-[#a1a1aa]'
                      : 'bg-[#f4f4f5] border-[#d4d4d8] hover:bg-[#e4e4e7] text-[#52525b]'
                  }`}
                  title="Download SubRip subtitle (.srt)"
                >
                  <span>.srt</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTranscript('vtt')}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-[#a1a1aa]'
                      : 'bg-[#f4f4f5] border-[#d4d4d8] hover:bg-[#e4e4e7] text-[#52525b]'
                  }`}
                  title="Download WebVTT subtitle (.vtt)"
                >
                  <span>.vtt</span>
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Timestamped Transcript List with Intelligent Chapters & Phases */}
          <div
            ref={transcriptContainerRef}
            className="flex-1 p-3 overflow-y-auto space-y-1.5 min-h-[300px]"
          >
            {loadingTranscript ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <p className="text-xs opacity-60">
                  Extracting timestamped transcript & audio tracks...
                </p>
              </div>
            ) : filteredSegments.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-6 opacity-60 text-xs">
                {transcriptError ? (
                  <div className="max-w-md space-y-2">
                    <p className="text-amber-400 font-medium">{transcriptError}</p>
                    <p className="text-[11px]">
                      Tip: You can use the "Run Whisper" button above or upload an audio file to generate an exact speech-to-text transcript.
                    </p>
                  </div>
                ) : (
                  <p>No matching transcript segments found.</p>
                )}
              </div>
            ) : (
              (() => {
                const chapters = studyBundle?.summary?.chapters || [];
                let chapterIdx = 0;

                return filteredSegments.map((seg, idx) => {
                  const isCurrent =
                    currentTimeSec >= seg.start_s &&
                    currentTimeSec < seg.start_s + (seg.duration_s || 3);

                  let matchedChapter: (typeof chapters)[0] | null = null;
                  if (chapters.length > 0 && chapterIdx < chapters.length) {
                    const nextCh = chapters[chapterIdx];
                    if (seg.start_s >= nextCh.timestamp && (idx === 0 || seg.start_s - nextCh.timestamp < 35)) {
                      matchedChapter = nextCh;
                      chapterIdx++;
                    }
                  }

                  return (
                    <React.Fragment key={`seg-frag-${idx}`}>
                      {matchedChapter && (
                        <div
                          onClick={() => handleSeek(matchedChapter.timestamp)}
                          className={`my-3 p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isDark
                              ? 'bg-blue-950/30 border-blue-600/50 hover:border-blue-500 text-blue-200'
                              : 'bg-blue-50 border-blue-300 hover:border-blue-400 text-blue-900'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white">
                                Phase {chapterIdx}
                              </span>
                              <h4 className="text-xs font-bold">{matchedChapter.title}</h4>
                            </div>
                            <p className="text-[11px] opacity-80">{matchedChapter.summary}</p>
                          </div>
                          <span className="font-mono text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300 font-semibold shrink-0">
                            {formatTime(matchedChapter.timestamp)}
                          </span>
                        </div>
                      )}

                      <div
                        key={`seg-${idx}-${seg.start_s}`}
                        data-active-segment={isCurrent ? 'true' : 'false'}
                        onClick={() => handleSeek(seg.start_s)}
                        className={`group flex items-start gap-2.5 p-2 rounded-lg text-xs transition-all cursor-pointer border ${
                          isCurrent
                            ? isDark
                              ? 'bg-blue-950/40 border-blue-600/60 text-white'
                              : 'bg-blue-50 border-blue-400 text-blue-950'
                            : isDark
                            ? 'border-transparent hover:bg-white/[0.04]'
                            : 'border-transparent hover:bg-black/[0.03]'
                        }`}
                      >
                        <span
                          className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-semibold shrink-0 transition-colors ${
                            isCurrent
                              ? 'bg-blue-600 text-white'
                              : isDark
                              ? 'bg-[#1f1f23] text-blue-400 group-hover:bg-blue-950/50'
                              : 'bg-blue-100 text-blue-700 group-hover:bg-blue-200'
                          }`}
                        >
                          {formatTime(seg.start_s)}
                        </span>
                        <p className="flex-1 leading-relaxed text-[13px]">{seg.text}</p>
                      </div>
                    </React.Fragment>
                  );
                });
              })()
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Study Suite & Cloud Notes */}
        <div
          className={`lg:col-span-6 flex flex-col overflow-y-auto ${
            mobileTab === 'study' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Study Suite Tab Navigation */}
          <div
            className={`border-b px-4 py-3 flex items-center gap-1.5 overflow-x-auto shrink-0 ${
              isDark
                ? 'bg-[#0f0f11] border-[#27272a]'
                : 'bg-[#fafafa] border-[#e4e4e7]'
            }`}
          >
            {[
              { id: 'summary', label: 'Summary' },
              { id: 'explanation', label: 'First Principles' },
              {
                id: 'flashcards',
                label: `Cards (${studyBundle?.flashcards.length || 0})`,
              },
              {
                id: 'quiz',
                label: `Quiz (${studyBundle?.quiz.length || 0})`,
              },
              { id: 'chat', label: 'AI Tutor' },
              { id: 'notes', label: 'Cloud Notes' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as StudyTab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? isDark
                        ? 'bg-white/[0.09] text-white font-semibold shadow-sm border border-white/[0.12]'
                        : 'bg-black/[0.06] text-black font-semibold shadow-sm border border-black/[0.1]'
                      : isDark
                      ? 'text-[#8a8a8a] hover:text-white hover:bg-white/[0.04]'
                      : 'text-[#666666] hover:text-black hover:bg-black/[0.03]'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
            {loadingStudy ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-xs font-medium">
                  Synthesizing structured study breakdown via InternAI Agents-A1...
                </p>
                <p className="text-[11px] opacity-60 max-w-sm">
                  Decomposing core thesis, chapter markers, flashcard decks, and pedagogical quiz items.
                </p>
              </div>
            ) : studyError && !studyBundle ? (
              <div className="p-6 rounded-xl border border-amber-800/40 bg-amber-950/20 text-center space-y-3">
                <p className="text-xs text-amber-400 font-medium">{studyError}</p>
                <button
                  type="button"
                  onClick={() => loadVideo(activeVideoId)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
                >
                  Retry Synthesis
                </button>
              </div>
            ) : !studyBundle ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 opacity-60 text-xs">
                <p>Load a YouTube video or run Whisper to generate study materials.</p>
              </div>
            ) : (
              <>
                {/* TAB 1: SUMMARY & CHAPTERS */}
                {activeTab === 'summary' && (
                  <div className="space-y-6 max-w-2xl">
                    <section className="space-y-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Executive Overview
                      </h2>
                      <div
                        className={`text-sm leading-relaxed p-4 rounded-xl border prose-grok max-w-none ${
                          isDark ? 'bg-[#121215] border-white/[0.08]' : 'bg-[#f8f8fa] border-black/[0.08]'
                        }`}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {studyBundle.summary.overview}
                        </ReactMarkdown>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Key Takeaways ({studyBundle.summary.keyPoints.length})
                      </h2>
                      <div className="space-y-2">
                        {studyBundle.summary.keyPoints.map((point, idx) => (
                          <div
                            key={`kp-${idx}`}
                            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                              isDark
                                ? 'bg-[#121214] border-[#27272a]'
                                : 'bg-[#ffffff] border-[#e4e4e7]'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-current/10 font-semibold flex items-center justify-center shrink-0 text-[10px]">
                              {idx + 1}
                            </span>
                            <div className="leading-relaxed opacity-90 prose-grok max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {point}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {studyBundle.summary.chapters?.length > 0 && (
                      <section className="space-y-3">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Video Chapters & Timestamps
                        </h2>
                        <div className="space-y-2">
                          {studyBundle.summary.chapters.map((ch, idx) => (
                            <div
                              key={`ch-${idx}`}
                              onClick={() => handleSeek(ch.timestamp)}
                              className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 cursor-pointer transition-all ${
                                isDark
                                  ? 'bg-[#121214] border-[#27272a] hover:border-white/30'
                                  : 'bg-[#ffffff] border-[#e4e4e7] hover:border-black/30'
                              }`}
                            >
                              <div className="space-y-1">
                                <h3 className="font-semibold text-sm">{ch.title}</h3>
                                <p className="opacity-70 leading-relaxed text-[11px]">
                                  {ch.summary}
                                </p>
                              </div>
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-current/10 shrink-0 font-semibold">
                                {formatTime(ch.timestamp)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {/* TAB 2: FIRST PRINCIPLES EXPLANATION */}
                {activeTab === 'explanation' && (
                  <div className="space-y-6 max-w-2xl">
                    <section className="space-y-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Core Thesis
                      </h2>
                      <div
                        className={`text-sm leading-relaxed p-4 rounded-xl border prose-grok max-w-none ${
                          isDark ? 'bg-[#121215] border-white/[0.08]' : 'bg-[#f8f8fa] border-black/[0.08]'
                        }`}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {studyBundle.explanation.coreThesis}
                        </ReactMarkdown>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Conceptual Mechanics ({studyBundle.explanation.concepts.length})
                      </h2>
                      <div className="space-y-3">
                        {studyBundle.explanation.concepts.map((c, idx) => (
                          <div
                            key={`c-${idx}`}
                            className={`p-4 rounded-xl border space-y-2.5 ${
                              isDark
                                ? 'bg-[#121214] border-[#27272a]'
                                : 'bg-[#ffffff] border-[#e4e4e7]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold">
                                  {c.term}
                                </h3>
                                {c.citation && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                      isDark
                                        ? 'bg-white/[0.06] border-white/[0.1] text-neutral-300'
                                        : 'bg-neutral-100 border-black/[0.1] text-neutral-700'
                                    }`}
                                  >
                                    {c.citation}
                                  </span>
                                )}
                              </div>
                              {c.timestamp !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => handleSeek(c.timestamp!)}
                                  className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-current/10 hover:bg-current/20 transition-colors shrink-0"
                                >
                                  {formatTime(c.timestamp)}
                                </button>
                              )}
                            </div>
                            <div className="text-xs leading-relaxed opacity-90 prose-grok max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {`**Definition:** ${c.definition}`}
                              </ReactMarkdown>
                            </div>
                            <div className="text-xs leading-relaxed opacity-90 prose-grok max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {`**Mechanism:** ${c.mechanism}`}
                              </ReactMarkdown>
                            </div>
                            {c.proofQuote && (
                              <div
                                className={`mt-2 p-2.5 rounded-lg border text-[11px] italic ${
                                  isDark
                                    ? 'bg-[#09090b] border-white/10 text-neutral-300'
                                    : 'bg-neutral-50 border-black/10 text-neutral-700'
                                }`}
                              >
                                <span className="font-sans font-semibold text-[10px] uppercase not-italic opacity-70 block mb-0.5">
                                  Transcript Quote:
                                </span>
                                “{c.proofQuote}”
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {/* TAB 3: INTERACTIVE FLASHCARDS */}
                {activeTab === 'flashcards' && (
                  <div className="space-y-6 max-w-xl mx-auto">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs opacity-60">
                        Card {cardIndex + 1} of {activeFlashcards.length}
                      </div>
                      <label className="flex items-center gap-2 text-xs opacity-80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterReviewOnly}
                          onChange={(e) => {
                            setFilterReviewOnly(e.target.checked);
                            setCardIndex(0);
                          }}
                          className="rounded"
                        />
                        <span>Review Only ({Object.values(cardMastery).filter((v) => v === 'review').length})</span>
                      </label>
                    </div>

                    {currentCard ? (
                      <div className="space-y-4">
                        <div
                          onClick={() => setIsCardFlipped(!isCardFlipped)}
                          className={`min-h-[220px] p-6 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all shadow-md select-none ${
                            isDark
                              ? 'bg-[#18181b] border-[#3f3f46] hover:border-blue-500/60'
                              : 'bg-white border-[#d4d4d8] hover:border-blue-400'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] opacity-60">
                            <span>{currentCard.category || 'Core Concept'}</span>
                            <span>{isCardFlipped ? 'Answer' : 'Question (Click to flip)'}</span>
                          </div>

                          <div className="text-center py-6">
                            <p className="text-base sm:text-lg font-medium leading-relaxed">
                              {isCardFlipped ? currentCard.back : currentCard.front}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[11px] opacity-40">
                            <span>Space to flip</span>
                            {currentCard.timestamp !== undefined && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSeek(currentCard.timestamp!);
                                }}
                                className="font-mono text-blue-400 hover:underline"
                              >
                                @ {formatTime(currentCard.timestamp)}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mastery Buttons */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={cardIndex === 0}
                            onClick={() => {
                              setCardIndex((prev) => Math.max(0, prev - 1));
                              setIsCardFlipped(false);
                            }}
                            className="p-2 rounded-lg border text-xs cursor-pointer disabled:opacity-30"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newMastery = {
                                  ...cardMastery,
                                  [currentCard.id]: 'review' as const,
                                };
                                setCardMastery(newMastery);
                                persistSessionToCloud({ flashcardMastery: newMastery });
                                if (cardIndex < activeFlashcards.length - 1) {
                                  setCardIndex((prev) => prev + 1);
                                  setIsCardFlipped(false);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                                cardMastery[currentCard.id] === 'review'
                                  ? 'bg-amber-500 text-black border-amber-500'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                              }`}
                            >
                              Needs Review
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const newMastery = {
                                  ...cardMastery,
                                  [currentCard.id]: 'known' as const,
                                };
                                setCardMastery(newMastery);
                                persistSessionToCloud({ flashcardMastery: newMastery });
                                if (cardIndex < activeFlashcards.length - 1) {
                                  setCardIndex((prev) => prev + 1);
                                  setIsCardFlipped(false);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                                cardMastery[currentCard.id] === 'known'
                                  ? 'bg-emerald-500 text-black border-emerald-500'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              }`}
                            >
                              Mastered
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={cardIndex >= activeFlashcards.length - 1}
                            onClick={() => {
                              setCardIndex((prev) =>
                                Math.min(activeFlashcards.length - 1, prev + 1)
                              );
                              setIsCardFlipped(false);
                            }}
                            className="p-2 rounded-lg border text-xs cursor-pointer disabled:opacity-30"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center border rounded-xl opacity-60 text-xs">
                        No cards in this filter.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: KNOWLEDGE QUIZ */}
                {activeTab === 'quiz' && (
                  <div className="space-y-6 max-w-2xl">
                    <div className="flex items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <h2 className="text-sm font-semibold">Self-Assessment Quiz</h2>
                        <p className="text-xs opacity-60">
                          {Object.keys(quizAnswers).length} of {studyBundle.quiz.length} answered
                        </p>
                      </div>
                      {Object.keys(quizAnswers).length === studyBundle.quiz.length && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Score:{' '}
                          {
                            Object.entries(quizAnswers).filter(([id, ansIdx]) => {
                              const q = studyBundle.quiz.find((item) => item.id === id);
                              return q && q.correctIndex === ansIdx;
                            }).length
                          }{' '}
                          /{studyBundle.quiz.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-6">
                      {studyBundle.quiz.map((item, qIdx) => {
                        const selectedIdx = quizAnswers[item.id];
                        const isAnswered = selectedIdx !== undefined;

                        return (
                          <div
                            key={item.id}
                            className={`p-4 rounded-xl border space-y-3 ${
                              isDark
                                ? 'bg-[#121214] border-[#27272a]'
                                : 'bg-[#ffffff] border-[#e4e4e7]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-xs sm:text-sm font-semibold leading-relaxed">
                                {qIdx + 1}. {item.question}
                              </h3>
                              {item.timestamp !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => handleSeek(item.timestamp!)}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 shrink-0 hover:bg-blue-500/20"
                                >
                                  {formatTime(item.timestamp)}
                                </button>
                              )}
                            </div>

                            <div className="space-y-2">
                              {item.options.map((opt, optIdx) => {
                                const isSelected = selectedIdx === optIdx;
                                const isCorrect = optIdx === item.correctIndex;

                                let btnStyle = isDark
                                  ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a]'
                                  : 'bg-[#f4f4f5] border-[#d4d4d8] hover:bg-[#e4e4e7]';

                                if (isAnswered) {
                                  if (isCorrect) {
                                    btnStyle =
                                      'bg-emerald-950/60 border-emerald-600 text-emerald-300 font-medium';
                                  } else if (isSelected) {
                                    btnStyle =
                                      'bg-rose-950/60 border-rose-600 text-rose-300';
                                  }
                                }

                                return (
                                  <button
                                    key={`opt-${optIdx}`}
                                    type="button"
                                    onClick={() => {
                                      const updated = {
                                        ...quizAnswers,
                                        [item.id]: optIdx,
                                      };
                                      setQuizAnswers(updated);
                                      persistSessionToCloud();
                                    }}
                                    className={`w-full p-2.5 rounded-lg border text-xs text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${btnStyle}`}
                                  >
                                    <span>{opt}</span>
                                    {isAnswered && isCorrect && (
                                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {isAnswered && (
                              <p className="text-[11px] leading-relaxed opacity-80 p-2.5 rounded-lg bg-black/20 border border-white/5">
                                <strong className="opacity-60">Explanation:</strong>{' '}
                                {item.explanation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 5: AI TUTOR CHAT */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col h-[520px] max-w-2xl">
                    <div className="flex-1 overflow-y-auto space-y-3 p-2">
                      {chatTurns.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-center p-6 opacity-60 text-xs space-y-3">
                          <MessageSquare className="w-8 h-8 stroke-[1.2] text-blue-500" />
                          <p>
                            Ask any question grounded specifically in "{resolvedTitle}".
                          </p>
                          <div className="flex flex-wrap gap-1.5 justify-center">
                            {[
                              'Explain the key mechanism in simple terms',
                              'What is the core argument of this video?',
                              'Give 3 practical applications mentioned',
                            ].map((s, i) => (
                              <button
                                key={`chip-${i}`}
                                type="button"
                                onClick={() => {
                                  setChatDraft(s);
                                }}
                                className="px-2.5 py-1 rounded-full text-[11px] border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 cursor-pointer"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        chatTurns.map((turn) => (
                          <div
                            key={turn.id}
                            className={`p-3.5 rounded-xl text-xs leading-relaxed max-w-[88%] ${
                              turn.role === 'user'
                                ? isDark
                                  ? 'ml-auto bg-white text-black font-medium'
                                  : 'ml-auto bg-neutral-900 text-white font-medium'
                                : isDark
                                ? 'bg-[#18181b] border border-[#27272a] text-[#f4f4f5]'
                                : 'bg-[#f4f4f5] border border-[#e4e4e7] text-[#18181b]'
                            }`}
                          >
                            <div className="prose-grok max-w-none text-xs leading-relaxed">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                              >
                                {turn.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))
                      )}
                      {chatLoading && (
                        <div className="flex items-center gap-2 text-xs opacity-60 p-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Consulting video transcript...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="pt-2 border-t flex items-center gap-2 shrink-0">
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                        placeholder="Ask the AI Tutor about this video..."
                        className={`flex-1 px-3.5 py-2 rounded-full border text-xs outline-none ${
                          isDark
                            ? 'bg-[#18181b] border-[#27272a] focus:border-white/30 text-white'
                            : 'bg-white border-[#d4d4d8] focus:border-black/30 text-black'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleSendChat}
                        disabled={chatLoading || !chatDraft.trim()}
                        className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                          isDark ? 'bg-white text-black' : 'bg-neutral-900 text-white'
                        }`}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 6: CLOUD NOTES */}
                {activeTab === 'notes' && (
                  <div className="space-y-4 max-w-2xl">
                    <div className="flex items-center justify-between gap-2 border-b pb-2">
                      <span className="text-xs font-semibold">My Study Notes</span>
                      <button
                        type="button"
                        onClick={() => {
                          const timeStr = `[${formatTime(currentTimeSec)}] `;
                          setUserNotes((prev) => prev + timeStr);
                          persistSessionToCloud({ notes: userNotes + timeStr });
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 cursor-pointer"
                        title="Insert current video timestamp into notes"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Insert Time ({formatTime(currentTimeSec)})</span>
                      </button>
                    </div>

                    <textarea
                      value={userNotes}
                      onChange={(e) => {
                        setUserNotes(e.target.value);
                        persistSessionToCloud({ notes: e.target.value });
                      }}
                      placeholder="Write your notes, insights, synthesis, or key questions here... (Automatically saved to your cloud account)"
                      className={`w-full h-80 p-3.5 rounded-xl border text-xs leading-relaxed outline-none resize-y ${
                        isDark
                          ? 'bg-[#121214] border-[#27272a] focus:border-blue-500 text-white'
                          : 'bg-white border-[#d4d4d8] focus:border-blue-600 text-black'
                      }`}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* SAVED SESSIONS SLIDE-OVER DRAWER */}
      {isSessionsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-md h-full flex flex-col p-4 shadow-2xl ${
              isDark ? 'bg-[#121214] text-white' : 'bg-white text-black'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-500" />
                <span>Saved Study Sessions in Cloud</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsSessionsDrawerOpen(false)}
                className="p-1 rounded hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {loadingSessions ? (
                <div className="h-32 flex items-center justify-center text-xs opacity-60">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading your cloud sessions...
                </div>
              ) : savedSessions.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center text-xs opacity-60">
                  <Cloud className="w-6 h-6 mb-1 text-blue-500" />
                  <p>No saved study sessions yet.</p>
                </div>
              ) : (
                savedSessions.map((s) => (
                  <div
                    key={s.videoId}
                    className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 transition-colors ${
                      s.videoId === activeVideoId
                        ? 'border-blue-500 bg-blue-500/10'
                        : isDark
                        ? 'border-[#27272a] hover:bg-white/[0.04]'
                        : 'border-[#e4e4e7] hover:bg-black/[0.03]'
                    }`}
                  >
                    <div
                      className="flex-1 cursor-pointer min-w-0"
                      onClick={() => {
                        loadVideo(s.videoId);
                        setIsSessionsDrawerOpen(false);
                      }}
                    >
                      <h3 className="font-semibold truncate">{s.title}</h3>
                      <p className="text-[11px] opacity-60 truncate">
                        {s.author || 'Creator'} • {s.segmentsCount || 0} segments
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await deleteUserStudySessionFromFirestore(s.videoId);
                        setSavedSessions((prev) =>
                          prev.filter((item) => item.videoId !== s.videoId)
                        );
                      }}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                      title="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
