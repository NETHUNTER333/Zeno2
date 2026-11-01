import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Copy,
  Check,
  FileText,
  Loader2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Link2,
  BookOpen,
  Layers,
  MessageSquare,
  ListTree,
  Upload,
  Download,
  Trash2,
  Volume2,
  VolumeX,
  Plus,
  X,
  MoreVertical,
  Share2,
  Star,
  Pencil,
  Lightbulb,
  Shuffle,
  AtSign,
  Paperclip,
  GitBranch,
  Network,
  Radio,
  Video,
  ClipboardPaste,
  Box,
  Clock,
  Filter,
  ArrowUp,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  YouTubeTranscriptSegment,
  YouTubeStudyBundle,
  YouTubeVideoInfo,
} from '../types';
import {
  getAuthHeaders,
} from '../lib/firebase';
import {
  extractTextFromPdfFile,
  buildDeterministicDocumentStudyBundle,
} from '../lib/pdfStudyEngine';
import { speakTextWithSmallestAi, stopSmallestSpeech } from '../lib/smallestAi';
import { UserAccountStore } from '../lib/userAccountStore';
import { MathMarkdown } from './MathMarkdown';

export interface StudyWorkspaceProps {
  initialVideo?: YouTubeVideoInfo | null;
  initialPdf?: {
    pdfUrl?: string;
    pdfName?: string;
    extractedText?: string;
  } | null;
  onBackToChat: () => void;
  isDark?: boolean;
  onAskZeno?: (prompt: string) => void;
}

export type WorkspaceTabType =
  | 'learn'
  | 'summary'
  | 'videos'
  | 'lesson_plan'
  | 'flashcards'
  | 'quiz'
  | 'chapters'
  | 'transcripts'
  | 'notes'
  | 'chat';

export interface OpenWorkspaceTab {
  id: string;
  type: WorkspaceTabType;
  title: string;
  moduleIndex?: number;
}

interface VideoChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  quotedQuestion?: string;
  includeMindMap?: boolean;
  includeFlowChart?: boolean;
}

interface StudySpaceItem {
  id: string;
  name: string;
  createdAt: number;
  contentCount: number;
  videoId?: string;
  sourceType?: 'youtube' | 'pdf' | 'text' | 'topic';
  rawText?: string;
}

interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export interface DetailedStatementItem {
  index: number;
  heading: string;
  claim: string;
  elaboration: string;
}

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati', flag: '🇮🇳' },
  { code: 'AF', label: 'Afrikaans', flag: '🇿🇦' },
  { code: 'ar', label: 'Arabic', flag: '🇦🇪' },
  { code: 'bn', label: 'Bengali', flag: '🇧🇩' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
];

export function extractYouTubeIdFromInput(input?: string | null): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  // 1. YouTube URLs (watch?v=, shorts/, embed/, live/, v/, youtu.be/)
  const urlMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (urlMatch) return urlMatch[1];

  // 2. Direct 11-character video ID (YouTube IDs are exactly 11 chars: base64url charset)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function cleanCaptionText(raw: string): string {
  return (raw || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\[(?:music|applause|laughter)\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function consolidateTranscriptSegments(
  rawSegments: YouTubeTranscriptSegment[]
): YouTubeTranscriptSegment[] {
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) return [];

  const avgLen =
    rawSegments.reduce((acc, s) => acc + (s.text || '').length, 0) /
    Math.max(1, rawSegments.length);
  if (avgLen > 140) {
    return rawSegments.map((s) => ({
      ...s,
      text: cleanCaptionText(s.text),
    }));
  }

  const consolidated: YouTubeTranscriptSegment[] = [];
  let currentStart = rawSegments[0]?.start_s || 0;
  let currentDuration = 0;
  let buffer: string[] = [];
  let charCount = 0;

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    const text = cleanCaptionText(seg.text);
    if (!text) continue;

    if (buffer.length === 0) {
      currentStart = seg.start_s || 0;
      currentDuration = seg.duration_s || 4;
    } else {
      currentDuration = Math.max(
        currentDuration + (seg.duration_s || 3),
        (seg.start_s || currentStart) - currentStart + (seg.duration_s || 3)
      );
    }

    buffer.push(text);
    charCount += text.length;

    const endsWithPunctuation = /[.!?]["']?$/.test(text);
    const isLast = i === rawSegments.length - 1;

    if ((charCount >= 220 && endsWithPunctuation) || charCount >= 380 || isLast) {
      let combined = buffer.join(' ').replace(/\s+/g, ' ').trim();
      if (combined.length > 0) {
        combined = combined.charAt(0).toUpperCase() + combined.slice(1);
        if (!/[.!?]$/.test(combined)) combined += '.';
        consolidated.push({
          start_s: currentStart,
          duration_s: Math.max(10, Math.round(currentDuration)),
          text: combined,
        });
      }
      buffer = [];
      charCount = 0;
      currentDuration = 0;
    }
  }

  return consolidated.length > 0 ? consolidated : rawSegments;
}

function deriveStatementHeading(text: string, index: number, fallbackTitle: string): string {
  const cleaned = cleanCaptionText(text)
    .replace(/^(so|and|but|because|well|now|okay|ok|like|yeah|right|actually|basically|literally)[,\s]+/i, '')
    .trim();

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  const words = firstSentence
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(the|and|for|that|this|with|from|have|are|was|were|what|when|where|how|why|you|your|they|their|into|about|just|like|very|really)$/i.test(w));

  if (words.length >= 3) {
    return words
      .slice(0, 5)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return `${fallbackTitle} — Part ${index + 1}`;
}

export function buildDetailedStatementBreakdown(
  consolidatedSegments: YouTubeTranscriptSegment[],
  title: string
): DetailedStatementItem[] {
  if (!consolidatedSegments || consolidatedSegments.length === 0) return [];

  return consolidatedSegments.map((seg, idx) => {
    const fullText = cleanCaptionText(seg.text);
    const sentences = fullText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const primaryClaim =
      sentences[0] && sentences[0].length > 25
        ? sentences[0]
        : fullText.slice(0, 180) + (fullText.length > 180 ? '.' : '');

    const heading = deriveStatementHeading(fullText, idx, title);

    return {
      index: idx + 1,
      heading,
      claim: primaryClaim,
      elaboration: fullText,
    };
  });
}

function buildFallbackStudyData(
  videoId: string,
  rawTitle: string,
  rawAuthor: string,
  customText?: string,
  rawSegmentsInput?: YouTubeTranscriptSegment[]
): {
  segments: YouTubeTranscriptSegment[];
  bundle: YouTubeStudyBundle;
  statements: DetailedStatementItem[];
} {
  let consolidatedSegments: YouTubeTranscriptSegment[] = [];
  if (rawSegmentsInput && rawSegmentsInput.length > 0) {
    consolidatedSegments = consolidateTranscriptSegments(rawSegmentsInput);
  }

  const fullSourceText =
    customText ||
    (consolidatedSegments.length > 0
      ? consolidatedSegments.map((s) => s.text).join('\n\n')
      : `${rawTitle} by ${rawAuthor || 'Creator'}.`);

  const docBundle = buildDeterministicDocumentStudyBundle(
    rawTitle || 'Study Session',
    fullSourceText,
    Math.max(12, Math.min(24, consolidatedSegments.length || 12)),
    'medium'
  );

  if (consolidatedSegments.length === 0) {
    const rawParagraphs = fullSourceText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 20);

    consolidatedSegments = (rawParagraphs.length > 0
      ? rawParagraphs
      : docBundle.summary.keyPoints
    ).map((text, idx) => ({
      start_s: idx * 35,
      duration_s: 35,
      text,
    }));
  }

  const statements = buildDetailedStatementBreakdown(
    consolidatedSegments,
    rawTitle || 'Study Material'
  );

  const groupSize = Math.max(1, Math.ceil(consolidatedSegments.length / 20));
  const chapters: Array<{ timestamp: number; title: string; summary: string }> = [];
  for (let i = 0; i < consolidatedSegments.length; i += groupSize) {
    const slice = consolidatedSegments.slice(i, i + groupSize);
    const combinedText = slice.map((s) => s.text).join(' ');
    const sectionNum = Math.floor(i / groupSize) + 1;
    const heading = deriveStatementHeading(combinedText, sectionNum - 1, rawTitle || 'Section');
    chapters.push({
      timestamp: slice[0]?.start_s || i * 35,
      title: heading,
      summary: combinedText,
    });
  }

  const comprehensiveOverview =
    consolidatedSegments.length > 1
      ? consolidatedSegments
          .slice(0, Math.min(3, consolidatedSegments.length))
          .map((s) => s.text)
          .join(' ')
      : docBundle.summary.overview;

  const exhaustiveKeyPoints = statements.map(
    (st) => `${st.heading}: ${st.elaboration}`
  );

  const bundle: YouTubeStudyBundle = {
    videoId,
    title: rawTitle || 'Study Material',
    summary: {
      overview: comprehensiveOverview,
      keyPoints:
        exhaustiveKeyPoints.length >= 20
          ? exhaustiveKeyPoints.slice(0, 26)
          : [...exhaustiveKeyPoints, ...docBundle.summary.keyPoints].slice(0, 26),
      chapters:
        chapters.length >= 16
          ? chapters.slice(0, 24)
          : [
              ...chapters,
              ...docBundle.summary.sections.map((s, idx) => ({
                timestamp: (chapters.length + idx) * 45,
                title: s.title,
                summary: s.summary,
              })),
            ].slice(0, 24),
    },
    explanation: {
      coreThesis: docBundle.explanation.coreThesis,
      concepts: docBundle.explanation.concepts.map((c, idx) => ({
        term: c.term,
        definition: c.definition,
        mechanism: c.mechanism,
        timestamp: idx * 60,
      })),
    },
    flashcards: docBundle.flashcards.map((f, idx) => ({
      id: f.id || `fc-${idx}`,
      front: f.front,
      back: f.back,
      category: f.category || 'Key Concept',
      timestamp: idx * 45,
    })),
    quiz: docBundle.quiz.map((q, idx) => ({
      id: q.id || `q-${idx}`,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      timestamp: idx * 45,
    })),
  };

  return { segments: consolidatedSegments, bundle, statements };
}

export const StudyWorkspace: React.FC<StudyWorkspaceProps> = ({
  initialVideo,
  initialPdf,
  onBackToChat,
  isDark = true,
}) => {
  const initialId =
    initialVideo?.videoId ||
    (initialVideo?.videoUrl ? extractYouTubeIdFromInput(initialVideo.videoUrl) : null) ||
    (initialVideo?.link ? extractYouTubeIdFromInput(initialVideo.link) : null) ||
    '';

  const hasInitialContent = Boolean(
    initialId || initialPdf?.pdfName || initialPdf?.extractedText || initialVideo?.title
  );

  const [viewMode, setViewMode] = useState<'home' | 'workspace'>(
    hasInitialContent ? 'workspace' : 'home'
  );

  const [activeVideoId, setActiveVideoId] = useState<string>(initialId);
  const [sourceType, setSourceType] = useState<'youtube' | 'pdf' | 'text' | 'topic'>(
    initialPdf?.pdfName ? 'pdf' : initialId ? 'youtube' : 'topic'
  );
  const [pdfUrl, setPdfUrl] = useState<string>(initialPdf?.pdfUrl || '');
  const [rawSourceText, setRawSourceText] = useState<string>(initialPdf?.extractedText || '');

  const [resolvedTitle, setResolvedTitle] = useState<string>(
    initialPdf?.pdfName || initialVideo?.title || (initialId ? 'Loading...' : 'Study Space')
  );
  const [resolvedAuthor, setResolvedAuthor] = useState<string>(
    initialVideo?.author || 'Study Source'
  );

  // Related YouTube Videos fetched when the user asks a question or enters a topic
  const [topicVideos, setTopicVideos] = useState<YouTubeVideoInfo[]>([]);
  const [ytWebSearchQuery, setYtWebSearchQuery] = useState<string>('');
  const [ytWebSearching, setYtWebSearching] = useState<boolean>(false);

  // Collapsible Video / Source Drawer
  const [showSourceViewer, setShowSourceViewer] = useState<boolean>(false);
  const [seekSeconds, setSeekSeconds] = useState<number>(0);
  const [autoPlayVideo, setAutoPlayVideo] = useState<boolean>(false);

  // Open Workspace Tabs
  const [openTabs, setOpenTabs] = useState<OpenWorkspaceTab[]>([
    { id: 'tab-summary', type: 'summary', title: 'Summary' },
    { id: 'tab-learn', type: 'learn', title: 'Study Tools' },
    { id: 'tab-quiz', type: 'quiz', title: 'Quiz' },
    { id: 'tab-flashcards', type: 'flashcards', title: 'Flashcards' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-summary');

  // Study Data State
  const [segments, setSegments] = useState<YouTubeTranscriptSegment[]>(
    initialVideo?.transcript ? consolidateTranscriptSegments(initialVideo.transcript) : []
  );
  const [studyBundle, setStudyBundle] = useState<YouTubeStudyBundle | null>(null);
  const [statementBreakdown, setStatementBreakdown] = useState<DetailedStatementItem[]>([]);
  const [aiExhaustiveSummary, setAiExhaustiveSummary] = useState<string>('');
  const [synthesizingDeepSummary, setSynthesizingDeepSummary] = useState<boolean>(false);
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [transcriptState, setTranscriptState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    initialVideo?.transcript && initialVideo.transcript.length > 0 ? 'ready' : 'idle'
  );
  const [transcriptError, setTranscriptError] = useState<string>('');
  const [transcriptProvider, setTranscriptProvider] = useState<string>(
    initialVideo?.transcript && initialVideo.transcript.length > 0 ? 'provided' : ''
  );
  const [pasteTranscriptVal, setPasteTranscriptVal] = useState<string>('');

  // My Sets Filter & Menu
  const [mySetsFilter, setMySetsFilter] = useState<'all' | 'summary' | 'flashcards' | 'quiz' | 'podcast'>('all');
  const [openSetMenuId, setOpenSetMenuId] = useState<string | null>(null);
  const [topMoreMenuOpen, setTopMoreMenuOpen] = useState<boolean>(false);

  // Audio Player State
  const [podcastOpen, setPodcastOpen] = useState<boolean>(false);
  const [podcastPlaying, setPodcastPlaying] = useState<boolean>(false);
  const [podcastSec, setPodcastSec] = useState<number>(16);
  const [podcastDuration] = useState<number>(121);
  const [podcastSpeed, setPodcastSpeed] = useState<number>(1);

  // Summary TTS & Edit State
  const [isListeningSummary, setIsListeningSummary] = useState<boolean>(false);
  const [isEditingSummary, setIsEditingSummary] = useState<boolean>(false);
  const [editableSummaryText, setEditableSummaryText] = useState<string>('');
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Lesson Plan State
  const [completedModules, setCompletedModules] = useState<Record<string, boolean>>({});
  const [focusedModuleView, setFocusedModuleView] = useState<{
    moduleIndex: number;
    mode: 'summary' | 'quiz';
  } | null>(null);

  // Quiz State
  const [currentQuizIdx, setCurrentQuizIdx] = useState<number>(0);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [checkedQuizMap, setCheckedQuizMap] = useState<Record<string, number>>({});
  const [revealedDontKnowMap, setRevealedDontKnowMap] = useState<Record<string, boolean>>({});

  // Flashcards State
  const [flashcardMode, setFlashcardMode] = useState<'spaced' | 'fast'>('fast');
  const [customFlashcards, setCustomFlashcards] = useState<
    Array<{ id: string; front: string; back: string; category?: string; starred?: boolean }>
  >([]);
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);
  const [showCardHint, setShowCardHint] = useState<boolean>(false);
  const [cardMastery, setCardMastery] = useState<Record<string, 'known' | 'review'>>({});

  // Transcripts Language Selector State
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [langDropdownOpen, setLangDropdownOpen] = useState<boolean>(false);
  const [langSearch, setLangSearch] = useState<string>('');
  const [translatedSegments, setTranslatedSegments] = useState<Record<string, YouTubeTranscriptSegment[]>>({});
  const [translatingLang, setTranslatingLang] = useState<boolean>(false);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);

  // Notes State
  const [userNotes, setUserNotes] = useState<string>('');

  // Chat / Tutor State
  const [chatTurns, setChatTurns] = useState<VideoChatTurn[]>([]);
  const [chatDraft, setChatDraft] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [quotedQuizQuestion, setQuotedQuizQuestion] = useState<string | null>(null);
  const [activeChatTags, setActiveChatTags] = useState<string[]>([]);
  const [studyModeEnabled, setStudyModeEnabled] = useState<boolean>(true);
  const [showAtMenu, setShowAtMenu] = useState<boolean>(false);
  const [expandedMindMapNodes, setExpandedMindMapNodes] = useState<Record<string, boolean>>({
    'node-0': true,
    'node-1': true,
  });

  // Home View Modals & Inputs
  const [linkModalOpen, setLinkModalOpen] = useState<boolean>(false);
  const [linkInputVal, setLinkInputVal] = useState<string>('');
  const [pasteModalOpen, setPasteModalOpen] = useState<boolean>(false);
  const [pasteTitleVal, setPasteTitleVal] = useState<string>('');
  const [pasteTextVal, setPasteTextVal] = useState<string>('');
  const [homePromptDraft, setHomePromptDraft] = useState<string>('');
  const [spacesSort, setSpacesSort] = useState<'Newest' | 'Oldest'>('Newest');
  const [openSpaceMenuId, setOpenSpaceMenuId] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<StudySpaceItem[]>(() => {
    try {
      const saved = localStorage.getItem('zeno_study_spaces_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed
            .filter((s: any) => s && s.name && !/^recorded lecture/i.test(String(s.name)))
            .map((s: any) => {
              const rawName = String(s.name || '').trim();
              const wrappedMatch = rawName.match(/^YouTube Video\s*\((.+?)\)$/i);
              if (wrappedMatch) {
                const fixedTopic = wrappedMatch[1].trim();
                return {
                  ...s,
                  name: fixedTopic,
                  videoId: undefined,
                  sourceType: 'topic' as const,
                };
              }
              return s;
            });
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {}
    return [
      {
        id: 'space-kimchi',
        name: 'Who Is Kimchi',
        createdAt: Date.now() - 3600_000,
        contentCount: 10,
        videoId: 'Y9by14g7Cbs',
        sourceType: 'youtube',
      },
    ];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const userProfile = useMemo(() => UserAccountStore.getProfile(), []);
  const displayName = userProfile?.displayName?.split(' ')[0] || 'Wake';

  useEffect(() => {
    try {
      localStorage.setItem('zeno_study_spaces_v2', JSON.stringify(spaces));
    } catch {}
  }, [spaces]);

  useEffect(() => {
    if (!podcastPlaying) return;
    const timer = setInterval(() => {
      setPodcastSec((prev) => {
        if (prev >= podcastDuration) {
          setPodcastPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, Math.round(1000 / podcastSpeed));
    return () => clearInterval(timer);
  }, [podcastPlaying, podcastDuration, podcastSpeed]);

  useEffect(() => {
    if (studyBundle?.flashcards) {
      setCustomFlashcards(
        studyBundle.flashcards.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          category: c.category || resolvedTitle.slice(0, 22),
          starred: false,
        }))
      );
      setEditableSummaryText(
        [
          studyBundle.summary.overview,
          ...statementBreakdown.map(
            (st) => `\n### ${st.heading}\n${st.elaboration}`
          ),
        ].join('\n')
      );
    }
  }, [studyBundle, resolvedTitle, statementBreakdown]);

  useEffect(() => {
    if (initialPdf?.pdfName || initialPdf?.extractedText) {
      loadTextOrPdfSource(
        initialPdf.pdfName || 'Uploaded Document',
        initialPdf.extractedText || '',
        'pdf',
        initialPdf.pdfUrl
      );
    } else if (initialId) {
      loadYouTubeSource(initialId, initialVideo?.title, initialVideo?.author, initialVideo?.transcript);
    } else if (initialVideo?.title) {
      loadTopicStudySpace(initialVideo.title);
    }
  }, [initialId, initialPdf?.pdfName, initialPdf?.extractedText]);

  const openOrFocusTab = (type: WorkspaceTabType, customTitle?: string, moduleIndex?: number) => {
    const existing = openTabs.find(
      (t) => t.type === type && (moduleIndex === undefined || t.moduleIndex === moduleIndex)
    );
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const defaultTitles: Record<WorkspaceTabType, string> = {
      learn: 'Study Tools',
      summary: 'Summary',
      videos: 'Videos',
      lesson_plan: 'Lesson Plan',
      flashcards: customTitle || 'Flashcards',
      quiz: customTitle || 'Quiz',
      chapters: 'Sections',
      transcripts: 'Transcript',
      notes: 'Notes',
      chat: customTitle || 'Tutor',
    };
    const newTab: OpenWorkspaceTab = {
      id: `tab-${type}-${Date.now()}`,
      type,
      title: customTitle || defaultTitles[type],
      moduleIndex,
    };
    setOpenTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openTabs.length <= 1) return;
    const nextTabs = openTabs.filter((t) => t.id !== tabId);
    setOpenTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  const activeTabObj = useMemo(
    () => openTabs.find((t) => t.id === activeTabId) || openTabs[0],
    [openTabs, activeTabId]
  );

  const handleSearchYouTubeWeb = async (overrideQuery?: string, switchTab = false) => {
    const q = (overrideQuery ?? ytWebSearchQuery ?? resolvedTitle).trim();
    if (!q) return;
    setYtWebSearching(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/study/youtube-search', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ query: q, limit: 12 }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.videos) && data.videos.length > 0) {
          setTopicVideos(data.videos);
          if (switchTab) {
            openOrFocusTab('videos', `Videos (${data.videos.length})`);
          }
        }
      }
    } catch {}
    setYtWebSearching(false);
  };

  const synthesizeDeepStatementSummary = async (
    title: string,
    consolidatedSegs: YouTubeTranscriptSegment[]
  ) => {
    if (!consolidatedSegs || consolidatedSegs.length === 0) return;
    setSynthesizingDeepSummary(true);
    try {
      const authHeaders = await getAuthHeaders();
      const fullTranscriptText = consolidatedSegs
        .map((s, idx) => `[Section ${idx + 1}] ${s.text}`)
        .join('\n\n')
        .slice(0, 28000);

      const prompt = `Write a clear, well-structured, comprehensive study guide for "${title}" based on the source text below.
Write in simple, natural educational English. Do NOT use pretentious jargon, military labels, or computer-science boilerplate.
Break down every key concept, explanation, example, and takeaway clearly:

${fullTranscriptText}`;

      const res = await fetch('/api/study/ai-assistant', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          prompt,
          topic: title,
          mode: 'summary',
          context: fullTranscriptText,
          webSearch: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reply = String(data?.text || data?.reply || '').trim();
        if (reply && reply.length > 150) {
          setAiExhaustiveSummary(reply);
        }
      }
    } catch {}
    setSynthesizingDeepSummary(false);
  };

  /**
   * When the user enters a question or topic in Study Space (e.g., "Chloroplast"),
   * fetches real YouTube videos matching that topic via the Web Search Backend AND generates
   * a real, accurate educational answer, key points, flashcards, and quiz via /api/study/topic.
   */
  const loadTopicStudySpace = async (topicQuery: string) => {
    const cleanTopic = topicQuery
      .replace(/^YouTube Video\s*\((.+?)\)(?:\s*by\s*YouTube)?$/i, '$1')
      .trim();
    if (!cleanTopic) return;

    UserAccountStore.recordDailyInteraction(true);

    setViewMode('workspace');
    setSourceType('topic');
    setActiveVideoId('');
    setShowSourceViewer(false);
    setPdfUrl('');
    setRawSourceText('');
    setResolvedTitle(cleanTopic);
    setResolvedAuthor('Topic Study');
    setYtWebSearchQuery(cleanTopic);
    setLoadingContent(true);
    setAiExhaustiveSummary('');
    setTopicVideos([]);
    setFocusedModuleView(null);
    setCurrentQuizIdx(0);
    setSelectedQuizOption(null);
    setCheckedQuizMap({});
    setRevealedDontKnowMap({});

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/study/topic', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ query: cleanTopic }),
        signal: AbortSignal.timeout(16000),
      });

      if (res.ok) {
        const data = await res.json();
        const fetchedVideos: YouTubeVideoInfo[] = Array.isArray(data.videos) ? data.videos : [];
        setTopicVideos(fetchedVideos);

        if (fetchedVideos.length > 0) {
          setOpenTabs((prev) => {
            if (prev.some((t) => t.type === 'videos')) return prev;
            return [
              prev[0] || { id: 'tab-summary', type: 'summary', title: 'Summary' },
              { id: 'tab-videos', type: 'videos', title: `Videos (${fetchedVideos.length})` },
              ...prev.slice(1),
            ];
          });
        } else {
          // Trigger dedicated YouTube web search backend in background if initial list was empty
          handleSearchYouTubeWeb(cleanTopic, false);
        }

        const sections: DetailedStatementItem[] = Array.isArray(data.sections) && data.sections.length > 0
          ? data.sections.map((s: any, idx: number) => ({
              index: idx + 1,
              heading: String(s.heading || s.title || `${cleanTopic} — Part ${idx + 1}`),
              claim: String(s.claim || ''),
              elaboration: String(s.elaboration || s.claim || ''),
            }))
          : [];

        if (sections.length > 0) {
          const synthSegments: YouTubeTranscriptSegment[] = sections.map((s, idx) => ({
            start_s: idx * 30,
            duration_s: 30,
            text: `${s.heading}: ${s.elaboration}`,
          }));

          const bundle: YouTubeStudyBundle = {
            videoId: '',
            title: cleanTopic,
            summary: {
              overview: String(data.overview || sections[0]?.elaboration || ''),
              keyPoints: sections.map((s) => `${s.heading}: ${s.elaboration}`),
              chapters: sections.map((s, idx) => ({
                timestamp: idx * 45,
                title: s.heading,
                summary: s.elaboration,
              })),
            },
            explanation: {
              coreThesis: String(data.overview || sections[0]?.elaboration || ''),
              concepts: Array.isArray(data.concepts)
                ? data.concepts.map((c: any, idx: number) => ({
                    term: String(c.term || `Concept ${idx + 1}`),
                    definition: String(c.definition || ''),
                    mechanism: String(c.mechanism || ''),
                    timestamp: idx * 45,
                  }))
                : [],
            },
            flashcards: Array.isArray(data.flashcards)
              ? data.flashcards.map((f: any, idx: number) => ({
                  id: f.id || `fc-${idx + 1}`,
                  front: String(f.front || ''),
                  back: String(f.back || ''),
                  category: String(f.category || cleanTopic.slice(0, 20)),
                  timestamp: idx * 30,
                }))
              : [],
            quiz: Array.isArray(data.quiz)
              ? data.quiz.map((q: any, idx: number) => ({
                  id: q.id || `q-${idx + 1}`,
                  question: String(q.question || ''),
                  options: Array.isArray(q.options) ? q.options.map(String) : [],
                  correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
                  explanation: String(q.explanation || ''),
                  timestamp: idx * 30,
                }))
              : [],
          };

          setSegments(synthSegments);
          setStatementBreakdown(sections);
          setStudyBundle(bundle);
          setLoadingContent(false);

          setSpaces((prev) => {
            const exists = prev.some((s) => s.name.toLowerCase() === cleanTopic.toLowerCase());
            if (exists) return prev;
            return [
              {
                id: `space-${Date.now()}`,
                name: cleanTopic,
                createdAt: Date.now(),
                contentCount: sections.length + fetchedVideos.length,
                sourceType: 'topic',
              },
              ...prev,
            ];
          });
          return;
        }
      }
    } catch {}

    // Bulletproof fallback so Study Space NEVER stays blank or stuck on loading
    const fallbackSeed = `${cleanTopic} is a major educational topic encompassing core structures, primary mechanisms, functional pathways, regulatory variables, and real-world applications. Understanding ${cleanTopic} involves analyzing how its primary components are organized, how energy or signals flow through its pathways, and how external conditions influence its overall efficiency.`;
    const fb = buildFallbackStudyData('', cleanTopic, 'Topic Study', fallbackSeed);
    setSegments(fb.segments);
    setStatementBreakdown(fb.statements);
    setStudyBundle(fb.bundle);
    setLoadingContent(false);
    handleSearchYouTubeWeb(cleanTopic, false);
    synthesizeDeepStatementSummary(cleanTopic, fb.segments);
  };

  // Load YouTube Video (Direct Link or Video ID: loads ONLY this exact video, autoplays, no related videos)
  const loadYouTubeSource = async (
    targetVidId: string,
    hintTitle?: string,
    hintAuthor?: string,
    cachedTranscript?: YouTubeTranscriptSegment[]
  ) => {
    const cleanHint = (hintTitle || '')
      .replace(/^YouTube Video\s*\((.+?)\)(?:\s*by\s*YouTube)?$/i, '$1')
      .trim();

    setViewMode('workspace');
    setSourceType('youtube');
    setActiveVideoId(targetVidId);
    setShowSourceViewer(true);
    setAutoPlayVideo(true);
    setTopicVideos([]); // STRICT REQUIREMENT: Only give this video, no multiple/related videos!
    setOpenTabs((prev) => prev.filter((t) => t.type !== 'videos')); // Suppress videos tab
    setLoadingContent(true);
    setAiExhaustiveSummary('');
    setFocusedModuleView(null);
    setCurrentQuizIdx(0);
    setSelectedQuizOption(null);
    setCheckedQuizMap({});
    setRevealedDontKnowMap({});
    setTranscriptState('loading');
    setTranscriptError('');
    setTranscriptProvider(cachedTranscript && cachedTranscript.length > 0 ? 'provided' : '');

    let title =
      cleanHint && cleanHint !== targetVidId ? cleanHint : 'YouTube Video';
    let author = hintAuthor || 'YouTube';

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${targetVidId}`
        )}&format=json`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        if (oembed.title) title = oembed.title;
        if (oembed.author_name) author = oembed.author_name;
      } else {
        const noembedRes = await fetch(
          `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${targetVidId}`,
          { signal: AbortSignal.timeout(2000) }
        );
        if (noembedRes.ok) {
          const noembed = await noembedRes.json();
          if (noembed.title) title = noembed.title;
          if (noembed.author_name) author = noembed.author_name;
        }
      }
    } catch {}

    setResolvedTitle(title);
    setResolvedAuthor(author);

    try {
      let rawLoadedSegments: YouTubeTranscriptSegment[] =
        cachedTranscript && cachedTranscript.length > 0 ? cachedTranscript : [];

      let transcriptFetchError = '';
      if (rawLoadedSegments.length === 0) {
        try {
          const res = await fetch('/api/youtube/transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId: targetVidId }),
            signal: AbortSignal.timeout(20000),
          });
          let data: any = null;
          try {
            data = await res.json();
          } catch {}
          if (data?.title && (title === 'YouTube Video' || !cleanHint || cleanHint === targetVidId)) {
            title = data.title;
            setResolvedTitle(title);
          }
          if (data?.author && (author === 'YouTube' || !hintAuthor)) {
            author = data.author;
            setResolvedAuthor(author);
          }
          if (res.ok && data?.success && Array.isArray(data.segments) && data.segments.length > 0) {
            rawLoadedSegments = data.segments;
            setTranscriptProvider(String(data.provider || 'youtube'));
          } else {
            transcriptFetchError =
              String(data?.error || '').trim() || `Transcript request failed (HTTP ${res.status}).`;
          }
        } catch (e: any) {
          transcriptFetchError =
            e?.name === 'TimeoutError' || e?.name === 'AbortError'
              ? 'Transcript request timed out.'
              : `Transcript request failed: ${String(e?.message || e)}`;
        }
      }

      if (rawLoadedSegments.length === 0) {
        setSegments([]);
        setStudyBundle(null);
        setStatementBreakdown([]);
        setAiExhaustiveSummary('');
        setTranscriptState('error');
        setTranscriptError(
          transcriptFetchError || "Couldn't fetch captions right now (transcript server offline)."
        );
        setResolvedTitle(title);
        setResolvedAuthor(author);
        setLoadingContent(false);
        setShowSourceViewer(true);
        setAutoPlayVideo(false);
        return;
      }

      setTranscriptState('ready');
      setTranscriptError('');

      const synthesized = buildFallbackStudyData(
        targetVidId,
        title,
        author,
        undefined,
        rawLoadedSegments
      );

      setSegments(synthesized.segments);
      setStudyBundle(synthesized.bundle);
      setStatementBreakdown(synthesized.statements);
      setResolvedTitle(title);
      setResolvedAuthor(author);
      setLoadingContent(false);
      setShowSourceViewer(true);
      setAutoPlayVideo(true);

      // Upgrade flashcards, quiz, and concepts via AI /api/youtube/study when real segments are present
      if (rawLoadedSegments.length > 0) {
        try {
          const authHeaders = await getAuthHeaders();
          const aiRes = await fetch('/api/youtube/study', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              videoId: targetVidId,
              videoTitle: title,
              videoAuthor: author,
              segments: synthesized.segments,
            }),
            signal: AbortSignal.timeout(14000),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            if (aiData?.study?.summary?.overview) {
              setStudyBundle(aiData.study);
            }
          }
        } catch {}
      }

      synthesizeDeepStatementSummary(title, synthesized.segments);
    } finally {
      setLoadingContent(false);
      setTopicVideos([]); // Guarantee no related videos appear
      setSpaces((prev) => {
        const exists = prev.some((s) => s.videoId === targetVidId || s.name === title);
        if (exists) return prev;
        return [
          {
            id: `space-${Date.now()}`,
            name: title,
            createdAt: Date.now(),
            contentCount: 8,
            videoId: targetVidId,
            sourceType: 'youtube',
          },
          ...prev,
        ];
      });
    }
  };

  const applyPastedTranscript = () => {
    const text = pasteTranscriptVal.trim();
    if (!text || !activeVideoId) return;
    const data = buildFallbackStudyData(activeVideoId, resolvedTitle, resolvedAuthor, text);
    setSegments(data.segments);
    setStudyBundle(data.bundle);
    setStatementBreakdown(data.statements);
    setTranscriptState('ready');
    setTranscriptError('');
    setTranscriptProvider('pasted');
    setPasteTranscriptVal('');
    setLoadingContent(false);
    synthesizeDeepStatementSummary(resolvedTitle, data.segments);
    void (async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const aiRes = await fetch('/api/youtube/study', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            videoId: activeVideoId,
            videoTitle: resolvedTitle,
            videoAuthor: resolvedAuthor,
            segments: data.segments,
          }),
          signal: AbortSignal.timeout(14000),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData?.study?.summary?.overview) setStudyBundle(aiData.study);
        }
      } catch {}
    })();
  };

  // Load PDF or Pasted Notes (or route short topic queries to loadTopicStudySpace)
  const loadTextOrPdfSource = async (
    title: string,
    text: string,
    type: 'pdf' | 'text' | 'topic',
    url = ''
  ) => {
    const cleanText = (text || '').trim();
    // If it's a YouTube link or video ID, load directly as YouTube video
    const ytId = extractYouTubeIdFromInput(title || cleanText);
    if (ytId) {
      await loadYouTubeSource(ytId);
      return;
    }
    // If it's a short topic/question rather than a full pasted document/PDF, fetch real YouTube videos + topic study guide!
    if (type !== 'pdf' && cleanText.length < 240) {
      await loadTopicStudySpace(title || cleanText);
      return;
    }

    setViewMode('workspace');
    setSourceType(type);
    setActiveVideoId('');
    setPdfUrl(url);
    setRawSourceText(cleanText);
    setResolvedTitle(title);
    setResolvedAuthor(type === 'pdf' ? 'Document' : 'Study Notes');
    setLoadingContent(true);
    setAiExhaustiveSummary('');
    setTopicVideos([]);
    setFocusedModuleView(null);
    setCurrentQuizIdx(0);
    setSelectedQuizOption(null);
    setCheckedQuizMap({});
    setRevealedDontKnowMap({});

    try {
      // Also fetch real AI study synthesis from /api/pdf/study if available
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/pdf/study', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title,
          textContent: cleanText,
          difficulty: 'medium',
        }),
      });

      const fallback = buildFallbackStudyData('', title, 'Document', cleanText);

      if (res.ok) {
        const data = await res.json();
        const aiStudy = data?.study;
        if (aiStudy?.summary?.overview) {
          const mergedKeyPoints = Array.isArray(aiStudy.summary.keyPoints)
            ? [
                ...aiStudy.summary.keyPoints,
                ...fallback.bundle.summary.keyPoints.filter(
                  (kp) => !aiStudy.summary.keyPoints.includes(kp)
                ),
              ].slice(0, 26)
            : fallback.bundle.summary.keyPoints;

          const aiSections: DetailedStatementItem[] = mergedKeyPoints.map(
            (kp: string, idx: number) => ({
              index: idx + 1,
              heading:
                aiStudy.summary.sections?.[idx]?.title ||
                fallback.statements[idx]?.heading ||
                `Key Point ${idx + 1}`,
              claim: kp,
              elaboration:
                aiStudy.summary.sections?.[idx]?.summary ||
                fallback.statements[idx]?.elaboration ||
                kp,
            })
          );

          const remoteFlashcards = Array.isArray(aiStudy.flashcards) ? aiStudy.flashcards : [];
          const mergedFlashcards = [
            ...remoteFlashcards,
            ...fallback.bundle.flashcards.filter(
              (fb) =>
                !remoteFlashcards.some(
                  (rf: any) => String(rf.front || '').toLowerCase() === fb.front.toLowerCase()
                )
            ),
          ].slice(0, 30);

          const remoteQuiz = Array.isArray(aiStudy.quiz) ? aiStudy.quiz : [];
          const mergedQuiz = [
            ...remoteQuiz,
            ...fallback.bundle.quiz.filter(
              (fq) =>
                !remoteQuiz.some(
                  (rq: any) => String(rq.question || '').toLowerCase() === fq.question.toLowerCase()
                )
            ),
          ].slice(0, 28);

          const remoteConcepts = Array.isArray(aiStudy.explanation?.concepts)
            ? aiStudy.explanation.concepts
            : [];
          const mergedConcepts = [
            ...remoteConcepts,
            ...fallback.bundle.explanation.concepts.filter(
              (fc) => !remoteConcepts.some((rc: any) => rc.term === fc.term)
            ),
          ].slice(0, 24);

          setSegments(fallback.segments);
          setStatementBreakdown(aiSections);
          setStudyBundle({
            videoId: '',
            title,
            summary: {
              overview: aiStudy.summary.overview,
              keyPoints: mergedKeyPoints,
              chapters: aiSections.map((s, idx) => ({
                timestamp: idx * 45,
                title: s.heading,
                summary: s.elaboration,
              })),
            },
            explanation: {
              coreThesis: aiStudy.explanation?.coreThesis || aiStudy.summary.overview,
              concepts: mergedConcepts,
            },
            flashcards: mergedFlashcards,
            quiz: mergedQuiz,
          });
          setLoadingContent(false);
          return;
        }
      }

      setSegments(fallback.segments);
      setStudyBundle(fallback.bundle);
      setStatementBreakdown(fallback.statements);
      setLoadingContent(false);
      synthesizeDeepStatementSummary(title, fallback.segments);
    } catch {
      const fallback = buildFallbackStudyData('', title, 'Document', cleanText);
      setSegments(fallback.segments);
      setStudyBundle(fallback.bundle);
      setStatementBreakdown(fallback.statements);
      setLoadingContent(false);
    } finally {
      setSpaces((prev) => {
        const exists = prev.some((s) => s.name === title);
        if (exists) return prev;
        return [
          {
            id: `space-${Date.now()}`,
            name: title,
            createdAt: Date.now(),
            contentCount: 6,
            sourceType: type,
            rawText: cleanText,
          },
          ...prev,
        ];
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    setViewMode('workspace');
    setLoadingContent(true);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setResolvedTitle(cleanName);

    try {
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        const blobUrl = URL.createObjectURL(file);
        const extracted = await extractTextFromPdfFile(file);
        loadTextOrPdfSource(cleanName, extracted.text, 'pdf', blobUrl);
      } else {
        const text = await file.text();
        loadTextOrPdfSource(cleanName, text, 'text');
      }
    } catch {
      loadTopicStudySpace(cleanName);
    }
  };

  const handleJumpToTimestamp = (sec: number) => {
    setSeekSeconds(Math.max(0, Math.floor(sec)));
    setAutoPlayVideo(true);
    setShowSourceViewer(true);
  };

  const formatTime = (totalSeconds: number): string => {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectLanguage = async (lang: (typeof LANGUAGES)[0]) => {
    setSelectedLang(lang);
    setLangDropdownOpen(false);
    if (lang.code === 'en' || segments.length === 0) return;
    if (translatedSegments[lang.code]) return;

    setTranslatingLang(true);
    try {
      const authHeaders = await getAuthHeaders();
      const sampleText = segments
        .slice(0, 15)
        .map((s) => `[${formatTime(s.start_s)}] ${s.text}`)
        .join('\n');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Translate the following timestamped transcript paragraphs into ${lang.label}. Keep each [MM:SS] prefix intact on its own line:\n\n${sampleText}`,
            },
          ],
          webSearch: true,
          searchMode: 'organic',
          model: 'zro/deepseek-v4.1-flash',
        }),
      });
      const data = await res.json();
      const reply = String(data?.text || data?.reply || '').trim();
      if (reply) {
        const lines = reply.split('\n').filter(Boolean);
        const mapped: YouTubeTranscriptSegment[] = segments.map((seg, idx) => {
          const line = lines[idx]?.replace(/^\[?\d{1,2}:\d{2}\]?\s*/, '').trim();
          return {
            ...seg,
            text: line ? `${line}\n\n${seg.text}` : seg.text,
          };
        });
        setTranslatedSegments((prev) => ({ ...prev, [lang.code]: mapped }));
      }
    } catch {}
    setTranslatingLang(false);
  };

  const handleToggleListenSummary = () => {
    if (isListeningSummary) {
      stopSmallestSpeech();
      setIsListeningSummary(false);
      return;
    }
    const text =
      (aiExhaustiveSummary || studyBundle?.summary.overview || '') +
      ' ' +
      statementBreakdown.map((s) => s.elaboration).join(' ');
    speakTextWithSmallestAi(
      text.slice(0, 2400),
      'auto',
      () => setIsListeningSummary(true),
      () => setIsListeningSummary(false),
      () => setIsListeningSummary(false)
    );
  };

  const handleTogglePodcast = () => {
    if (!podcastOpen) {
      setPodcastOpen(true);
      setPodcastPlaying(true);
      return;
    }
    setPodcastPlaying((p) => !p);
  };

  const handleExportStudyPack = () => {
    if (!studyBundle) return;
    let md = `# ${resolvedTitle}\n\n`;
    md += `## Overview\n${studyBundle.summary.overview}\n\n`;
    if (aiExhaustiveSummary) {
      md += `## Detailed Guide\n${aiExhaustiveSummary}\n\n`;
    }
    md += `## Key Points\n\n`;
    statementBreakdown.forEach((st) => {
      md += `### ${st.heading}\n${st.elaboration}\n\n`;
    });
    if (topicVideos.length > 0) {
      md += `## Related YouTube Videos\n`;
      topicVideos.forEach((v) => {
        md += `- [${v.title}](https://www.youtube.com/watch?v=${v.videoId}) (${v.author})\n`;
      });
      md += `\n`;
    }
    md += `## Flashcards (${customFlashcards.length})\n`;
    customFlashcards.forEach((fc, idx) => {
      md += `${idx + 1}. **${fc.front}** — ${fc.back}\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resolvedTitle.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}_study_notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendStudyChat = async (overridePrompt?: string) => {
    const raw = (overridePrompt ?? chatDraft).trim();
    if (!raw && activeChatTags.length === 0) return;
    if (chatLoading) return;

    const wantMindMap =
      activeChatTags.includes('@Mind Map') || /mind\s*map/i.test(raw);
    const wantFlowChart =
      activeChatTags.includes('@Flow Chart') || /flow\s*chart/i.test(raw);

    const displayPrompt = [
      ...activeChatTags,
      raw || (wantMindMap ? `Create a mind map for ${resolvedTitle}` : `Explain ${resolvedTitle}`),
    ].join(' ');

    const userTurn: VideoChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: displayPrompt,
      quotedQuestion: quotedQuizQuestion || undefined,
    };

    setChatTurns((prev) => [...prev, userTurn]);
    setChatDraft('');
    setActiveChatTags([]);
    const currentQuoted = quotedQuizQuestion;
    setQuotedQuizQuestion(null);
    setChatLoading(true);

    try {
      const authHeaders = await getAuthHeaders();
      const contextStr =
        statementBreakdown.length > 0
          ? statementBreakdown
              .map((s) => `${s.heading}: ${s.elaboration}`)
              .join('\n\n')
              .slice(0, 18000)
          : studyBundle
          ? `Overview: ${studyBundle.summary.overview}\nKey Points:\n${studyBundle.summary.keyPoints.join('\n')}`
          : segments.map((s) => s.text).join('\n');

      const fullPrompt = currentQuoted
        ? `Regarding the quiz question: "${currentQuoted}"\n\nUser request: ${displayPrompt}\n\nProvide a clear, simple, helpful explanation grounded in "${resolvedTitle}".`
        : displayPrompt;

      const res = await fetch('/api/study/ai-assistant', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          prompt: fullPrompt,
          topic: resolvedTitle,
          mode: 'chat',
          context: contextStr,
          webSearch: true,
        }),
      });
      const data = await res.json();
      const reply =
        data?.text ||
        data?.reply ||
        (studyBundle?.explanation.coreThesis ?? 'Here is the explanation based on your study material.');

      setChatTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply,
          includeMindMap: wantMindMap,
          includeFlowChart: wantFlowChart,
        },
      ]);
    } catch {
      setChatTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content:
            studyBundle?.summary.overview ||
            'Here is a breakdown from your study notes.',
          includeMindMap: wantMindMap,
          includeFlowChart: wantFlowChart,
        },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const mindMapBranches: MindMapNode[] = useMemo(() => {
    if (studyBundle?.explanation.concepts && studyBundle.explanation.concepts.length > 0) {
      return studyBundle.explanation.concepts.map((c, idx) => ({
        id: `node-${idx}`,
        label: c.term,
        children: [
          { id: `node-${idx}-def`, label: c.definition },
          { id: `node-${idx}-mech`, label: c.mechanism },
        ],
      }));
    }
    return [
      {
        id: 'node-0',
        label: 'Overview',
        children: [
          { id: 'node-0-1', label: 'Core concepts and definitions' },
          { id: 'node-0-2', label: 'Examples from the material' },
        ],
      },
      {
        id: 'node-1',
        label: 'Key Takeaways',
        children: [
          { id: 'node-1-1', label: 'Main factors and relationships' },
          { id: 'node-1-2', label: 'Practical applications' },
        ],
      },
    ];
  }, [studyBundle]);

  // Clean monochrome surface tokens
  const bgMain = isDark ? 'bg-[#09090b] text-[#f4f4f5]' : 'bg-[#fafafa] text-[#111113]';
  const bgCard = isDark
    ? 'bg-[#121215] border-white/[0.08] text-[#f4f4f5]'
    : 'bg-[#ffffff] border-black/[0.08] text-[#111113]';
  const bgSubtle = isDark ? 'bg-white/[0.04]' : 'bg-black/[0.035]';
  const borderSubtle = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const textMuted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const iconBoxClass = isDark
    ? 'bg-white/[0.05] border border-white/[0.08] text-neutral-200'
    : 'bg-black/[0.035] border border-black/[0.07] text-neutral-800';

  const activeTranscriptList =
    selectedLang.code !== 'en' && translatedSegments[selectedLang.code]
      ? translatedSegments[selectedLang.code]
      : segments;

  const transcriptRequiredTabs = ['summary', 'quiz', 'flashcards', 'lesson_plan', 'transcripts', 'podcast'];
  const transcriptProviderLabel = (() => {
    const p = transcriptProvider;
    if (!p) return '';
    if (p === 'youtube-transcript-npm') return 'phone';
    if (p === 'provided') return 'provided';
    if (p === 'pasted') return 'pasted';
    if (p.startsWith('whisper')) return 'whisper';
    if (p.includes('caption')) return 'direct';
    if (p.toLowerCase().includes('yt-dlp')) return 'yt-dlp';
    return p;
  })();

  const filteredLanguages = LANGUAGES.filter((l) =>
    l.label.toLowerCase().includes(langSearch.trim().toLowerCase())
  );

  const quizList = studyBundle?.quiz || [];
  const safeQuizIdx = quizList.length > 0 ? Math.min(currentQuizIdx, quizList.length - 1) : 0;
  const currentQuizItem = quizList[safeQuizIdx] || null;

  const lessonModules = useMemo(() => {
    const chs = studyBundle?.summary.chapters || [];
    if (chs.length > 0) return chs;
    return [
      { timestamp: 0, title: 'Overview', summary: studyBundle?.summary.overview || '' },
      { timestamp: 60, title: 'Key Concepts', summary: studyBundle?.explanation.coreThesis || '' },
    ];
  }, [studyBundle]);

  const totalLessonSteps = lessonModules.length * 2;
  const completedLessonSteps = Object.values(completedModules).filter(Boolean).length;

  return (
    <div className={`w-full h-full min-h-screen flex flex-col font-sans select-text ${bgMain}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.json,.mp3,.wav,.mp4,application/pdf,text/*,audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload(f);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      {/* ===================================================================== */}
      {/* VIEW 1: STUDY SPACE HOME                                              */}
      {/* ===================================================================== */}
      {viewMode === 'home' ? (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <header
            className={`h-14 px-4 sm:px-6 border-b flex items-center justify-between shrink-0 sticky top-0 z-20 backdrop-blur-md ${
              isDark ? 'bg-[#09090b]/90 border-white/[0.08]' : 'bg-white/90 border-black/[0.08]'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBackToChat}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-white'
                    : 'bg-black/[0.03] border-black/[0.08] hover:bg-black/[0.06] text-black'
                }`}
                title="Back to Chat"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-sm tracking-tight">Study Space</span>
            </div>

            {(activeVideoId || studyBundle) && (
              <button
                type="button"
                onClick={() => setViewMode('workspace')}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white text-black border-white hover:bg-neutral-200'
                    : 'bg-black text-white border-black hover:bg-neutral-800'
                }`}
              >
                Resume: {resolvedTitle.slice(0, 24)}
              </button>
            )}
          </header>

          <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                What would you like to learn, {displayName}?
              </h1>
              <p className={`text-xs sm:text-sm ${textMuted}`}>
                Ask any question or topic to fetch YouTube videos, study notes, flashcards, and quizzes.
              </p>
            </div>

            {/* 3-Column Ingestion Grid: Upload, Link, Paste */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.22]'
                    : 'bg-white border-black/[0.08] hover:border-black/[0.22]'
                }`}
              >
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}>
                  <Upload className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">Upload</div>
                  <div className={`text-xs truncate ${textMuted}`}>PDF, Document, Audio</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLinkModalOpen(true)}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.22]'
                    : 'bg-white border-black/[0.08] hover:border-black/[0.22]'
                }`}
              >
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}>
                  <Link2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">Link</div>
                  <div className={`text-xs truncate ${textMuted}`}>YouTube, Website</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPasteModalOpen(true)}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.22]'
                    : 'bg-white border-black/[0.08] hover:border-black/[0.22]'
                }`}
              >
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}>
                  <ClipboardPaste className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">Paste</div>
                  <div className={`text-xs truncate ${textMuted}`}>Notes or Text</div>
                </div>
              </button>
            </div>

            {/* Topic / Question / YouTube URL Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = homePromptDraft.trim();
                if (!q) return;
                const ytId = extractYouTubeIdFromInput(q);
                setHomePromptDraft('');
                if (ytId) {
                  loadYouTubeSource(ytId);
                } else {
                  loadTopicStudySpace(q);
                }
              }}
              className={`flex items-center justify-between gap-2 pl-4 pr-2 py-2.5 rounded-2xl border transition-all ${
                isDark
                  ? 'bg-[#121215] border-white/[0.1] focus-within:border-white/[0.25]'
                  : 'bg-white border-black/[0.1] focus-within:border-black/[0.25]'
              }`}
            >
              <input
                type="text"
                value={homePromptDraft}
                onChange={(e) => setHomePromptDraft(e.target.value)}
                placeholder="Ask a question, enter a topic, or paste a YouTube link..."
                className="flex-1 bg-transparent border-0 text-sm outline-none"
              />
              <button
                type="submit"
                className={`size-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-black text-white hover:bg-neutral-800'
                }`}
                title="Start learning"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </form>

            {/* Saved Spaces Section */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold tracking-tight">Spaces</h2>
                  <button
                    type="button"
                    onClick={() => setSpacesSort((s) => (s === 'Newest' ? 'Oldest' : 'Newest'))}
                    className={`inline-flex items-center gap-1 text-xs ${textMuted} hover:opacity-100 cursor-pointer`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{spacesSort}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...spaces]
                  .sort((a, b) =>
                    spacesSort === 'Newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
                  )
                  .map((sp) => (
                    <div
                      key={sp.id}
                      onClick={() => {
                        if (sp.videoId) {
                          loadYouTubeSource(sp.videoId, sp.name);
                        } else if (sp.rawText && sp.rawText.length >= 240) {
                          loadTextOrPdfSource(
                            sp.name,
                            sp.rawText,
                            sp.sourceType === 'pdf' ? 'pdf' : 'text'
                          );
                        } else {
                          loadTopicStudySpace(sp.name);
                        }
                      }}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer relative ${
                        isDark
                          ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.22]'
                          : 'bg-white border-black/[0.08] hover:border-black/[0.22]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}
                        >
                          <Box className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{sp.name}</div>
                          <div className={`text-xs ${textMuted}`}>
                            {sp.sourceType === 'youtube'
                              ? 'YouTube Video'
                              : sp.sourceType === 'pdf'
                              ? 'PDF Document'
                              : 'Topic Study'}
                          </div>
                        </div>
                      </div>

                      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSpaceMenuId((prev) => (prev === sp.id ? null : sp.id))
                          }
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.06]'
                          }`}
                        >
                          <MoreVertical className="w-4 h-4 opacity-60" />
                        </button>

                        {openSpaceMenuId === sp.id && (
                          <div
                            className={`absolute right-0 top-full mt-1 w-36 rounded-xl border p-1 z-30 shadow-xl ${
                              isDark
                                ? 'bg-[#18181b] border-white/[0.12] text-white'
                                : 'bg-white border-black/[0.1] text-black'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSpaces((prev) => prev.filter((item) => item.id !== sp.id));
                                setOpenSpaceMenuId(null);
                              }}
                              className="w-full px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 hover:bg-current/5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Link Input Modal */}
          {linkModalOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setLinkModalOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`max-w-md w-full rounded-2xl border p-5 space-y-4 ${
                  isDark ? 'bg-[#121215] border-white/[0.12]' : 'bg-white border-black/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Import YouTube Link or Topic</h3>
                  <button
                    type="button"
                    onClick={() => setLinkModalOpen(false)}
                    className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={linkInputVal}
                  onChange={(e) => setLinkInputVal(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none ${
                    isDark
                      ? 'bg-[#09090b] border-white/[0.12] text-white'
                      : 'bg-[#f8f8f9] border-black/[0.12] text-black'
                  }`}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLinkModalOpen(false)}
                    className={`px-4 py-2 rounded-xl border text-xs font-medium cursor-pointer ${borderSubtle}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const val = linkInputVal.trim();
                      if (!val) return;
                      setLinkModalOpen(false);
                      setLinkInputVal('');
                      const ytId = extractYouTubeIdFromInput(val);
                      if (ytId) {
                        loadYouTubeSource(ytId);
                      } else {
                        loadTopicStudySpace(val);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      isDark ? 'bg-white text-black' : 'bg-black text-white'
                    }`}
                  >
                    Load
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Paste Text Modal */}
          {pasteModalOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setPasteModalOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`max-w-lg w-full rounded-2xl border p-5 space-y-3.5 ${
                  isDark ? 'bg-[#121215] border-white/[0.12]' : 'bg-white border-black/[0.1]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Paste Notes or Text</h3>
                  <button
                    type="button"
                    onClick={() => setPasteModalOpen(false)}
                    className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={pasteTitleVal}
                  onChange={(e) => setPasteTitleVal(e.target.value)}
                  placeholder="Title (optional)"
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                    isDark
                      ? 'bg-[#09090b] border-white/[0.12] text-white'
                      : 'bg-[#f8f8f9] border-black/[0.12] text-black'
                  }`}
                />
                <textarea
                  rows={6}
                  value={pasteTextVal}
                  onChange={(e) => setPasteTextVal(e.target.value)}
                  placeholder="Paste lecture transcript, article, or notes here..."
                  className={`w-full p-3.5 rounded-xl border text-xs outline-none resize-y ${
                    isDark
                      ? 'bg-[#09090b] border-white/[0.12] text-white'
                      : 'bg-[#f8f8f9] border-black/[0.12] text-black'
                  }`}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPasteModalOpen(false)}
                    className={`px-4 py-2 rounded-xl border text-xs font-medium cursor-pointer ${borderSubtle}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!pasteTextVal.trim()) return;
                      const t = pasteTitleVal.trim() || pasteTextVal.trim().slice(0, 36);
                      setPasteModalOpen(false);
                      loadTextOrPdfSource(t, pasteTextVal.trim(), 'text');
                      setPasteTitleVal('');
                      setPasteTextVal('');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      isDark ? 'bg-white text-black' : 'bg-black text-white'
                    }`}
                  >
                    Start Studying
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================== */
        /* VIEW 2: ACTIVE STUDY WORKSPACE                                        */
        /* ===================================================================== */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* Top Header */}
          <header
            className={`px-3 sm:px-5 py-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${
              isDark ? 'bg-[#09090b] border-white/[0.08]' : 'bg-white border-black/[0.08]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={onBackToChat}
                className={`p-1.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                  isDark
                    ? 'border-white/[0.08] hover:bg-white/[0.06]'
                    : 'border-black/[0.08] hover:bg-black/[0.05]'
                }`}
                title="Back to Chat"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">
                  {resolvedTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(activeVideoId || pdfUrl || rawSourceText) && (
                <button
                  type="button"
                  onClick={() => setShowSourceViewer((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    showSourceViewer
                      ? isDark
                        ? 'bg-white text-black border-white'
                        : 'bg-black text-white border-black'
                      : isDark
                      ? 'border-white/[0.12] hover:bg-white/[0.06] text-neutral-200'
                      : 'border-black/[0.12] hover:bg-black/[0.05] text-neutral-800'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">
                    {showSourceViewer
                      ? activeVideoId
                        ? 'Hide Video'
                        : 'Hide Source'
                      : activeVideoId
                      ? 'Player'
                      : 'Source'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewMode('home')}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/[0.12] hover:bg-white/[0.06] text-neutral-200'
                    : 'border-black/[0.12] hover:bg-black/[0.05] text-neutral-800'
                }`}
              >
                New Topic
              </button>

              <button
                type="button"
                onClick={handleExportStudyPack}
                className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/[0.08] hover:bg-white/[0.08]'
                    : 'border-black/[0.08] hover:bg-black/[0.05]'
                }`}
                title="Export Notes (.md)"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTopMoreMenuOpen((p) => !p)}
                  className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                    isDark
                      ? 'border-white/[0.08] hover:bg-white/[0.08]'
                      : 'border-black/[0.08] hover:bg-black/[0.05]'
                  }`}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {topMoreMenuOpen && (
                  <div
                    className={`absolute right-0 top-full mt-1.5 w-48 rounded-2xl border p-1.5 z-40 shadow-2xl ${
                      isDark
                        ? 'bg-[#18181b] border-white/[0.12] text-white'
                        : 'bg-white border-black/[0.1] text-black'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setTopMoreMenuOpen(false);
                        setViewMode('home');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-current/5 cursor-pointer"
                    >
                      <span>All Study Spaces</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTopMoreMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 hover:bg-current/5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload PDF / File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTopMoreMenuOpen(false);
                        handleExportStudyPack();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 hover:bg-current/5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Notes</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Collapsible Source Video / PDF Drawer */}
          {showSourceViewer && (
            <div className={`px-3 sm:px-5 py-2.5 border-b shrink-0 ${borderSubtle}`}>
              <div
                className={`max-w-3xl mx-auto rounded-2xl border overflow-hidden ${
                  isDark ? 'bg-[#121215] border-white/[0.1]' : 'bg-[#f8f8f9] border-black/[0.1]'
                }`}
              >
                {activeVideoId ? (
                  <div className="aspect-video w-full max-h-[360px] bg-black">
                    <iframe
                      key={`${activeVideoId}-${seekSeconds}`}
                      src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1${
                        seekSeconds > 0 ? `&start=${seekSeconds}` : ''
                      }`}
                      title={resolvedTitle}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : pdfUrl ? (
                  <div className="h-[300px] w-full bg-black">
                    <iframe
                      src={pdfUrl}
                      title={resolvedTitle}
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : (
                  <div className="p-4 max-h-52 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap">
                    {rawSourceText || studyBundle?.summary.overview}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workspace Navigation Tabs */}
          <div
            className={`px-3 sm:px-5 py-1.5 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 ${
              isDark ? 'bg-[#0c0c0e] border-white/[0.08]' : 'bg-[#f4f4f6] border-black/[0.08]'
            }`}
          >
            {openTabs.map((tab) => {
              const isActive = tab.id === activeTabObj?.id;
              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    setFocusedModuleView(null);
                    setActiveTabId(tab.id);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? isDark
                        ? 'bg-white text-black font-semibold shadow-2xs'
                        : 'bg-black text-white font-semibold shadow-2xs'
                      : isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                      : 'text-neutral-600 hover:text-black hover:bg-black/[0.05]'
                  }`}
                >
                  <span className="max-w-[150px] truncate">{tab.title}</span>
                  {openTabs.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => closeTab(tab.id, e)}
                      className="opacity-60 hover:opacity-100 p-0.5 rounded-md cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {sourceType === 'topic' && topicVideos.length > 0 && !openTabs.some((t) => t.type === 'videos') && (
              <button
                type="button"
                onClick={() => openOrFocusTab('videos', `Videos (${topicVideos.length})`)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                    : 'text-neutral-600 hover:text-black hover:bg-black/[0.05]'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Videos ({topicVideos.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openOrFocusTab('learn', 'Study Tools')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] text-neutral-300'
                  : 'bg-black/[0.05] hover:bg-black/[0.1] text-neutral-700'
              }`}
              title="Open Study Tools"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Audio Player Popover */}
          {podcastOpen && (
            <div
              className={`absolute top-24 left-1/2 -translate-x-1/2 z-40 w-[300px] sm:w-[330px] rounded-2xl border p-4 shadow-2xl ${
                isDark
                  ? 'bg-[#18181b] border-white/[0.14] text-white'
                  : 'bg-white border-black/[0.12] text-black'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">Audio Summary</span>
                <button
                  type="button"
                  onClick={() => setPodcastOpen(false)}
                  className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className={`text-[11px] font-mono tabular-nums mb-3 ${textMuted}`}>
                {formatTime(podcastSec)} / {formatTime(podcastDuration)}
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleExportStudyPack}
                  className={`size-9 rounded-xl flex items-center justify-center cursor-pointer ${bgSubtle}`}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPodcastSec((s) => Math.max(0, s - 15))}
                  className="text-xs font-mono px-2 py-1 rounded-lg hover:bg-current/5 cursor-pointer"
                >
                  -15s
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPodcastPlaying((p) => !p);
                    handleToggleListenSummary();
                  }}
                  className={`size-11 rounded-xl flex items-center justify-center cursor-pointer ${
                    isDark ? 'bg-white text-black' : 'bg-black text-white'
                  }`}
                >
                  {podcastPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPodcastSec((s) => Math.min(podcastDuration, s + 15))}
                  className="text-xs font-mono px-2 py-1 rounded-lg hover:bg-current/5 cursor-pointer"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPodcastSpeed((sp) => (sp === 1 ? 1.25 : sp === 1.25 ? 1.5 : sp === 1.5 ? 2 : 1))
                  }
                  className={`size-9 rounded-xl text-xs font-mono font-semibold flex items-center justify-center cursor-pointer ${bgSubtle}`}
                >
                  {podcastSpeed}x
                </button>
              </div>
            </div>
          )}

          {/* Main Tab Content Viewport */}
          <div className="flex-1 overflow-y-auto">
            {loadingContent ? (
              <div className="h-72 flex flex-col items-center justify-center gap-3 text-center px-4">
                <Loader2 className="w-6 h-6 animate-spin opacity-60" />
                <p className={`text-sm font-medium ${textMuted}`}>
                  Preparing study notes, YouTube videos, flashcards, and quiz...
                </p>
              </div>
            ) : transcriptState === 'error' &&
              activeVideoId &&
              transcriptRequiredTabs.includes(activeTabObj?.type || '') ? (
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                <div className={`p-5 rounded-2xl border space-y-4 ${bgCard}`}>
                  <div className="flex items-start gap-3">
                    <div
                      className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h2 className="text-sm sm:text-base font-semibold">
                        Couldn't fetch captions right now (transcript server offline).
                      </h2>
                      <p className={`text-xs sm:text-sm leading-relaxed ${textMuted}`}>
                        Study tools only use real captions — nothing here was generated. Retry, or
                        paste a transcript below.
                      </p>
                      {transcriptError && (
                        <p className={`text-[11px] font-mono break-words ${textMuted}`}>
                          {transcriptError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => loadYouTubeSource(activeVideoId, resolvedTitle, resolvedAuthor)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>

                  <div className={`pt-4 border-t space-y-2 ${borderSubtle}`}>
                    <label className="text-xs font-medium">Or paste the video transcript</label>
                    <textarea
                      rows={6}
                      value={pasteTranscriptVal}
                      onChange={(e) => setPasteTranscriptVal(e.target.value)}
                      placeholder="Paste the transcript here (timestamps optional)..."
                      className={`w-full p-3.5 rounded-xl border text-xs outline-none resize-y ${
                        isDark
                          ? 'bg-[#09090b] border-white/[0.12] text-white'
                          : 'bg-[#f8f8f9] border-black/[0.12] text-black'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={applyPastedTranscript}
                      disabled={!pasteTranscriptVal.trim()}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isDark ? 'bg-white text-black' : 'bg-black text-white'
                      }`}
                    >
                      Use pasted transcript
                    </button>
                  </div>
                </div>
              </div>
            ) : focusedModuleView ? (
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">
                <div
                  className={`flex items-center justify-between pb-3 border-b ${borderSubtle}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold truncate">
                      {lessonModules[focusedModuleView.moduleIndex]?.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFocusedModuleView(null)}
                    className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {focusedModuleView.mode === 'summary' ? (
                  <div className="space-y-4">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                      {lessonModules[focusedModuleView.moduleIndex]?.title}
                    </h2>
                    <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line">
                      {lessonModules[focusedModuleView.moduleIndex]?.summary}
                    </p>
                    <div className="flex items-center justify-between pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            lessonModules[focusedModuleView.moduleIndex]?.summary || ''
                          )
                        }
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedModules((prev) => ({
                            ...prev,
                            [`${focusedModuleView.moduleIndex}-summary`]: true,
                          }));
                          setFocusedModuleView({
                            moduleIndex: focusedModuleView.moduleIndex,
                            mode: 'quiz',
                          });
                        }}
                        className={`px-4 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                      >
                        <span>Take Quiz</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs opacity-60">
                      {lessonModules[focusedModuleView.moduleIndex]?.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCompletedModules((prev) => ({
                          ...prev,
                          [`${focusedModuleView.moduleIndex}-quiz`]: true,
                        }));
                        setFocusedModuleView(null);
                        openOrFocusTab('quiz', 'Quiz');
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                        isDark ? 'bg-white text-black' : 'bg-black text-white'
                      }`}
                    >
                      Start Quiz
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* =========================================================== */}
                {/* TAB 1: STUDY TOOLS HUB                                      */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'learn' && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-7 pb-24">
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold">Study Tools</h2>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {[
                          {
                            id: 'summary',
                            label: 'Summary',
                            sub: `${statementBreakdown.length} key points`,
                            icon: FileText,
                            onClick: () => openOrFocusTab('summary', 'Summary'),
                          },
                          {
                            id: 'quiz',
                            label: 'Quiz',
                            sub: `${quizList.length} questions`,
                            icon: BookOpen,
                            onClick: () => openOrFocusTab('quiz', 'Quiz'),
                          },
                          {
                            id: 'flashcards',
                            label: 'Flashcards',
                            sub: `${customFlashcards.length} cards`,
                            icon: Layers,
                            onClick: () => openOrFocusTab('flashcards', 'Flashcards'),
                          },
                          ...(sourceType === 'topic' && topicVideos.length > 0
                            ? [
                                {
                                  id: 'videos',
                                  label: 'YouTube Videos',
                                  sub: `${topicVideos.length} videos`,
                                  icon: Video,
                                  onClick: () => openOrFocusTab('videos', `Videos (${topicVideos.length})`),
                                },
                              ]
                            : []),
                          {
                            id: 'lesson_plan',
                            label: 'Lesson Plan',
                            sub: `${lessonModules.length} lessons`,
                            icon: GitBranch,
                            onClick: () => openOrFocusTab('lesson_plan', 'Lesson Plan'),
                          },
                          ...(sourceType !== 'topic'
                            ? [
                                {
                                  id: 'transcripts',
                                  label: 'Transcript',
                                  sub: `${segments.length} paragraphs`,
                                  icon: ListTree,
                                  onClick: () => openOrFocusTab('transcripts', 'Transcript'),
                                },
                              ]
                            : []),
                          {
                            id: 'podcast',
                            label: 'Audio Summary',
                            sub: 'Listen & review',
                            icon: Radio,
                            onClick: () => handleTogglePodcast(),
                          },
                          {
                            id: 'notes',
                            label: 'Notes',
                            sub: 'Your notes',
                            icon: Pencil,
                            onClick: () => openOrFocusTab('notes', 'Notes'),
                          },
                          {
                            id: 'chat',
                            label: 'Tutor Chat',
                            sub: 'Ask questions',
                            icon: MessageSquare,
                            onClick: () => openOrFocusTab('chat', 'Tutor'),
                          },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={item.onClick}
                              className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                                isDark
                                  ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.22]'
                                  : 'bg-white border-black/[0.08] hover:border-black/[0.22]'
                              }`}
                            >
                              <div
                                className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs sm:text-sm font-medium truncate">
                                  {item.label}
                                </div>
                                <div className={`text-[11px] truncate ${textMuted}`}>
                                  {item.sub}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Related YouTube Videos in Study Tools Hub — ONLY for general topic queries */}
                    {sourceType === 'topic' && topicVideos.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h2 className="text-sm font-semibold">Related YouTube Videos</h2>
                          <span className={`text-xs ${textMuted}`}>{topicVideos.length} videos</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {topicVideos.slice(0, 6).map((vid) => (
                            <div
                              key={vid.videoId || vid.link}
                              className={`p-3 rounded-2xl border flex flex-col justify-between gap-3 ${bgCard}`}
                            >
                              <div className="flex gap-3">
                                {vid.thumbnail && (
                                  <div className="relative w-28 h-16 rounded-xl overflow-hidden bg-black shrink-0">
                                    <img
                                      src={vid.thumbnail}
                                      alt={vid.title}
                                      className="w-full h-full object-cover"
                                    />
                                    {vid.length && (
                                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
                                        {vid.length}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs sm:text-sm font-medium line-clamp-2 leading-snug">
                                    {vid.title}
                                  </div>
                                  <div className={`text-[11px] mt-1 truncate ${textMuted}`}>
                                    {vid.author}
                                    {vid.views ? ` · ${vid.views}` : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (vid.videoId) {
                                      setActiveVideoId(vid.videoId);
                                      setShowSourceViewer(true);
                                      setAutoPlayVideo(true);
                                    }
                                  }}
                                  className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${borderSubtle}`}
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Watch</span>
                                </button>
                                {vid.videoId && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      loadYouTubeSource(vid.videoId!, vid.title, vid.author)
                                    }
                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                                      isDark
                                        ? 'bg-white text-black hover:bg-neutral-200'
                                        : 'bg-black text-white hover:bg-neutral-800'
                                    }`}
                                  >
                                    <BookOpen className="w-3 h-3" />
                                    <span>Study Video</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Study Sets */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Study Sets</h2>
                        <button
                          type="button"
                          onClick={() =>
                            setMySetsFilter((f) =>
                              f === 'all' ? 'summary' : f === 'summary' ? 'flashcards' : 'all'
                            )
                          }
                          className={`inline-flex items-center gap-1.5 text-xs ${textMuted} cursor-pointer`}
                        >
                          <Filter className="w-3.5 h-3.5" />
                          <span>{mySetsFilter === 'all' ? 'All' : mySetsFilter}</span>
                        </button>
                      </div>

                      <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
                        {[
                          {
                            id: 'set-summary',
                            type: 'summary' as const,
                            title: `${resolvedTitle.slice(0, 36)} — Summary`,
                            subtitle: `${statementBreakdown.length} key points`,
                            icon: FileText,
                            onClick: () => openOrFocusTab('summary', 'Summary'),
                          },
                          {
                            id: 'set-flashcards',
                            type: 'flashcards' as const,
                            title: `${resolvedTitle.slice(0, 36)} — Flashcards`,
                            subtitle: `${customFlashcards.length} cards`,
                            icon: Layers,
                            onClick: () => openOrFocusTab('flashcards', 'Flashcards'),
                          },
                          {
                            id: 'set-quiz',
                            type: 'quiz' as const,
                            title: `${resolvedTitle.slice(0, 36)} — Quiz`,
                            subtitle: `${quizList.length} multiple-choice questions`,
                            icon: BookOpen,
                            onClick: () => openOrFocusTab('quiz', 'Quiz'),
                          },
                        ]
                          .filter((s) => mySetsFilter === 'all' || s.type === mySetsFilter)
                          .map((setItem) => {
                            const Icon = setItem.icon;
                            return (
                              <div
                                key={setItem.id}
                                onClick={setItem.onClick}
                                className={`p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                  isDark
                                    ? 'bg-[#121215] hover:bg-white/[0.03]'
                                    : 'bg-white hover:bg-black/[0.02]'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs sm:text-sm font-medium truncate">
                                      {setItem.title}
                                    </div>
                                    <div className={`text-xs truncate ${textMuted}`}>
                                      {setItem.subtitle}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className="relative"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenSetMenuId((prev) =>
                                        prev === setItem.id ? null : setItem.id
                                      )
                                    }
                                    className="p-1.5 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {openSetMenuId === setItem.id && (
                                    <div
                                      className={`absolute right-0 top-full mt-1 w-40 rounded-xl border p-1 z-30 shadow-xl ${
                                        isDark
                                          ? 'bg-[#18181b] border-white/[0.12] text-white'
                                          : 'bg-white border-black/[0.1] text-black'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenSetMenuId(null);
                                          setItem.onClick();
                                        }}
                                        className="w-full px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 hover:bg-current/5 cursor-pointer"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                        <span>Open</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenSetMenuId(null);
                                          handleExportStudyPack();
                                        }}
                                        className="w-full px-3 py-2 rounded-lg text-xs text-left flex items-center gap-2 hover:bg-current/5 cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Export</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Bottom Ask Bar */}
                    <div className="fixed bottom-4 inset-x-0 px-4 pointer-events-none z-20">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!chatDraft.trim()) {
                            openOrFocusTab('chat', 'Tutor');
                            return;
                          }
                          openOrFocusTab('chat', 'Tutor');
                          handleSendStudyChat();
                        }}
                        className={`max-w-2xl mx-auto pointer-events-auto flex items-center justify-between gap-2 pl-4 pr-2 py-2 rounded-2xl border shadow-lg ${
                          isDark
                            ? 'bg-[#121215]/95 border-white/[0.12] text-white'
                            : 'bg-white/95 border-black/[0.12] text-black'
                        }`}
                      >
                        <input
                          type="text"
                          value={chatDraft}
                          onChange={(e) => setChatDraft(e.target.value)}
                          placeholder="Ask a question about this topic..."
                          className="flex-1 bg-transparent border-0 text-xs sm:text-sm outline-none"
                        />
                        <button
                          type="submit"
                          className={`size-9 rounded-xl flex items-center justify-center cursor-pointer shrink-0 ${
                            isDark ? 'bg-white text-black' : 'bg-black text-white'
                          }`}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB 2: SUMMARY (Clean, Simple, Usable + Fetched Videos)     */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'summary' && studyBundle && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-7 pb-24">
                    {/* Header & Actions */}
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 pb-4 border-b ${borderSubtle}`}
                    >
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                        {resolvedTitle}
                      </h2>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleListenSummary}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${borderSubtle}`}
                        >
                          {isListeningSummary ? (
                            <VolumeX className="w-3.5 h-3.5" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                          <span>{isListeningSummary ? 'Stop' : 'Listen'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsEditingSummary((e) => !e)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${borderSubtle}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>{isEditingSummary ? 'Done' : 'Edit'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleExportStudyPack}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${borderSubtle}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export</span>
                        </button>
                      </div>
                    </div>

                    {isEditingSummary ? (
                      <textarea
                        rows={18}
                        value={editableSummaryText}
                        onChange={(e) => setEditableSummaryText(e.target.value)}
                        className={`w-full p-4 rounded-2xl border text-sm leading-relaxed outline-none ${bgCard}`}
                      />
                    ) : (
                      <div className="space-y-7">
                        {/* Overview */}
                        <section className="space-y-2.5">
                          <h3 className="text-sm font-semibold">Overview</h3>
                          <p className="text-sm sm:text-[15px] leading-relaxed">
                            {studyBundle.summary.overview}
                          </p>
                        </section>

                        {/* When studying a direct YouTube link/ID: Show player prompt if drawer is closed, NEVER show 10+ random related videos */}
                        {sourceType === 'youtube' && activeVideoId && !showSourceViewer && (
                          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${bgCard}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-9 rounded-xl flex items-center justify-center shrink-0 bg-red-600 text-white">
                                <Video className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-medium truncate">{resolvedTitle}</div>
                                <div className={`text-[11px] truncate ${textMuted}`}>{resolvedAuthor || 'YouTube Video'}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowSourceViewer(true);
                                setAutoPlayVideo(true);
                              }}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                                isDark ? 'bg-white text-black' : 'bg-black text-white'
                              }`}
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Watch Video</span>
                            </button>
                          </div>
                        )}

                        {/* Related YouTube Videos + Live Web Search Backend — ONLY for general topic queries */}
                        {sourceType === 'topic' && (
                          <section className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="text-sm font-semibold">
                                YouTube Videos ({topicVideos.length})
                              </h3>
                              <div className="flex items-center gap-2">
                                {topicVideos.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openOrFocusTab('videos', `Videos (${topicVideos.length})`)
                                    }
                                    className={`text-xs ${textMuted} hover:opacity-100 cursor-pointer`}
                                  >
                                    View all ({topicVideos.length})
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* YouTube Web Search Bar */}
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSearchYouTubeWeb(ytWebSearchQuery || resolvedTitle, false);
                              }}
                              className={`flex items-center gap-2 p-2 rounded-2xl border ${bgCard}`}
                            >
                              <Search className={`w-4 h-4 ml-2 shrink-0 ${textMuted}`} />
                              <input
                                type="text"
                                value={ytWebSearchQuery}
                                onChange={(e) => setYtWebSearchQuery(e.target.value)}
                                placeholder={`Search YouTube videos via Web Search (e.g., ${resolvedTitle} lecture)...`}
                                className="flex-1 bg-transparent border-0 text-xs sm:text-sm outline-none"
                              />
                              <button
                                type="submit"
                                disabled={ytWebSearching}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                                  isDark
                                    ? 'bg-white text-black hover:bg-neutral-200'
                                    : 'bg-black text-white hover:bg-neutral-800'
                                }`}
                              >
                                {ytWebSearching ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Searching...</span>
                                  </>
                                ) : (
                                  <span>Search YouTube</span>
                                )}
                              </button>
                            </form>

                            {topicVideos.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {topicVideos.slice(0, 4).map((vid) => (
                                  <div
                                    key={vid.videoId || vid.link}
                                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-2.5 ${bgCard}`}
                                  >
                                    <div className="flex gap-3">
                                      {vid.thumbnail && (
                                        <div
                                          onClick={() => {
                                            if (vid.videoId) {
                                              setActiveVideoId(vid.videoId);
                                              setShowSourceViewer(true);
                                              setAutoPlayVideo(true);
                                            }
                                          }}
                                          className="relative w-28 h-16 rounded-xl overflow-hidden bg-black shrink-0 cursor-pointer group"
                                        >
                                          <img
                                            src={vid.thumbnail}
                                            alt={vid.title}
                                            className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                                          />
                                          {vid.length && (
                                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
                                              {vid.length}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs sm:text-sm font-medium line-clamp-2 leading-snug">
                                          {vid.title}
                                        </div>
                                        <div className={`text-[11px] mt-1 truncate ${textMuted}`}>
                                          {vid.author}
                                          {vid.views ? ` · ${vid.views}` : ''}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (vid.videoId) {
                                            setActiveVideoId(vid.videoId);
                                            setShowSourceViewer(true);
                                            setAutoPlayVideo(true);
                                          }
                                        }}
                                        className={`flex-1 py-1.5 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${borderSubtle}`}
                                      >
                                        <Play className="w-3 h-3" />
                                        <span>Watch</span>
                                      </button>
                                      {vid.videoId && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            loadYouTubeSource(vid.videoId!, vid.title, vid.author)
                                          }
                                          className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                                            isDark
                                              ? 'bg-white text-black hover:bg-neutral-200'
                                              : 'bg-black text-white hover:bg-neutral-800'
                                          }`}
                                        >
                                          <BookOpen className="w-3 h-3" />
                                          <span>Study Video</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={`p-4 rounded-2xl border text-xs ${bgCard} ${textMuted}`}>
                                {ytWebSearching
                                  ? `Searching YouTube & Web for "${ytWebSearchQuery || resolvedTitle}"...`
                                  : `Click "Search YouTube" above to fetch educational videos for "${resolvedTitle}".`}
                              </div>
                            )}
                          </section>
                        )}

                        {/* Detailed Notes (When expanded) */}
                        {aiExhaustiveSummary && (
                          <section className={`p-5 rounded-2xl border space-y-3 ${bgCard}`}>
                            <h3 className="text-sm font-semibold">Detailed Guide</h3>
                            <div className="text-sm sm:text-[15px] leading-relaxed">
                              <MathMarkdown content={aiExhaustiveSummary} isDark={isDark} />
                            </div>
                          </section>
                        )}

                        {/* Key Points Breakdown */}
                        <section className="space-y-3.5">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Key Points</h3>
                            {synthesizingDeepSummary && (
                              <span className={`inline-flex items-center gap-1.5 text-xs ${textMuted}`}>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Expanding notes...</span>
                              </span>
                            )}
                          </div>

                          <div className="space-y-3">
                            {statementBreakdown.map((st) => (
                              <div
                                key={st.index}
                                className={`p-4 sm:p-5 rounded-2xl border space-y-2 ${bgCard}`}
                              >
                                <h4 className="text-sm sm:text-base font-semibold tracking-tight">
                                  {st.heading}
                                </h4>
                                {st.claim && st.claim !== st.elaboration && (
                                  <div
                                    className={`text-xs sm:text-sm font-medium ${
                                      isDark ? 'text-neutral-200' : 'text-neutral-800'
                                    }`}
                                  >
                                    {st.claim}
                                  </div>
                                )}
                                <p className={`text-sm sm:text-[15px] leading-relaxed ${textMuted}`}>
                                  {st.elaboration}
                                </p>
                              </div>
                            ))}
                          </div>
                        </section>

                        {/* Key Terms & Concepts */}
                        {studyBundle.explanation.concepts.length > 0 && (
                          <section className="space-y-3">
                            <h3 className="text-sm font-semibold">Key Terms</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {studyBundle.explanation.concepts.map((concept, cIdx) => (
                                <div
                                  key={cIdx}
                                  className={`p-4 rounded-2xl border space-y-1.5 ${bgCard}`}
                                >
                                  <div className="text-sm font-semibold">{concept.term}</div>
                                  <p className="text-xs leading-relaxed">{concept.definition}</p>
                                  {concept.mechanism && concept.mechanism !== concept.definition && (
                                    <p className={`text-xs leading-relaxed ${textMuted}`}>
                                      {concept.mechanism}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </section>
                        )}

                        {/* Bottom Actions Row */}
                        <div className={`flex items-center justify-between pt-4 border-t ${borderSubtle}`}>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const fullCopy = [
                                  `# ${resolvedTitle}`,
                                  studyBundle.summary.overview,
                                  aiExhaustiveSummary,
                                  ...statementBreakdown.map(
                                    (s) => `${s.heading}\n${s.elaboration}`
                                  ),
                                ]
                                  .filter(Boolean)
                                  .join('\n\n');
                                navigator.clipboard.writeText(fullCopy);
                                setCopiedSummary(true);
                                setTimeout(() => setCopiedSummary(false), 2000);
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                            >
                              {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const fullNotes = statementBreakdown
                                  .map((s) => `${s.heading}: ${s.elaboration}`)
                                  .join('\n\n');
                                setUserNotes((n) => (n ? `${n}\n\n${fullNotes}` : fullNotes));
                                openOrFocusTab('notes', 'Notes');
                              }}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Save to Notes</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => openOrFocusTab('quiz', 'Quiz')}
                            className={`px-4 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                          >
                            <span>Practice Quiz</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB: VIDEOS (Full list of YouTube videos for the topic)     */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'videos' && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-20">
                    <div className="flex flex-col gap-3">
                      <div>
                        <h2 className="text-base sm:text-lg font-semibold">
                          YouTube Video Search — "{resolvedTitle}"
                        </h2>
                        <p className={`text-xs ${textMuted}`}>
                          Powered by Web Search + YouTube Backend. Watch inline or click "Study Video" to generate flashcards and quizzes from any video.
                        </p>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSearchYouTubeWeb(ytWebSearchQuery || resolvedTitle, false);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-2xl border ${bgCard}`}
                      >
                        <Search className={`w-4 h-4 ml-2 shrink-0 ${textMuted}`} />
                        <input
                          type="text"
                          value={ytWebSearchQuery}
                          onChange={(e) => setYtWebSearchQuery(e.target.value)}
                          placeholder="Search any topic or lecture on YouTube..."
                          className="flex-1 bg-transparent border-0 text-xs sm:text-sm outline-none"
                        />
                        <button
                          type="submit"
                          disabled={ytWebSearching}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                            isDark
                              ? 'bg-white text-black hover:bg-neutral-200'
                              : 'bg-black text-white hover:bg-neutral-800'
                          }`}
                        >
                          {ytWebSearching ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Searching...</span>
                            </>
                          ) : (
                            <span>Search YouTube</span>
                          )}
                        </button>
                      </form>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {topicVideos.map((vid) => (
                        <div
                          key={vid.videoId || vid.link}
                          className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 ${bgCard}`}
                        >
                          <div className="space-y-2.5">
                            {vid.thumbnail && (
                              <div
                                onClick={() => {
                                  if (vid.videoId) {
                                    setActiveVideoId(vid.videoId);
                                    setShowSourceViewer(true);
                                    setAutoPlayVideo(true);
                                  }
                                }}
                                className="relative aspect-video w-full rounded-xl overflow-hidden bg-black cursor-pointer group"
                              >
                                <img
                                  src={vid.thumbnail}
                                  alt={vid.title}
                                  className="w-full h-full object-cover group-hover:opacity-85 transition-opacity"
                                />
                                {vid.length && (
                                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-mono">
                                    {vid.length}
                                  </span>
                                )}
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-semibold line-clamp-2 leading-snug">
                                {vid.title}
                              </div>
                              <div className={`text-xs mt-1 ${textMuted}`}>
                                {vid.author}
                                {vid.views ? ` · ${vid.views}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (vid.videoId) {
                                  setActiveVideoId(vid.videoId);
                                  setShowSourceViewer(true);
                                  setAutoPlayVideo(true);
                                }
                              }}
                              className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${borderSubtle}`}
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Watch Inline</span>
                            </button>
                            {vid.videoId && (
                              <button
                                type="button"
                                onClick={() =>
                                  loadYouTubeSource(vid.videoId!, vid.title, vid.author)
                                }
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                                  isDark
                                    ? 'bg-white text-black hover:bg-neutral-200'
                                    : 'bg-black text-white hover:bg-neutral-800'
                                }`}
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Study Video</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB 3: LESSON PLAN                                          */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'lesson_plan' && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-16">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base sm:text-lg font-semibold">Lesson Plan</h2>

                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono ${borderSubtle}`}
                      >
                        <span>
                          {completedLessonSteps} / {totalLessonSteps} Completed
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {lessonModules.map((mod, mIdx) => {
                        const sumDone = completedModules[`${mIdx}-summary`];
                        const quizDone = completedModules[`${mIdx}-quiz`];

                        return (
                          <div key={mIdx} className={`p-4 rounded-2xl border space-y-3 ${bgCard}`}>
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">
                                {mIdx + 1}. {mod.title}
                              </div>
                            </div>

                            <p className={`text-xs sm:text-sm leading-relaxed ${textMuted}`}>
                              {mod.summary}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setFocusedModuleView({ moduleIndex: mIdx, mode: 'summary' })
                                }
                                className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-colors cursor-pointer ${borderSubtle} ${
                                  isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]'
                                }`}
                              >
                                <div
                                  className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${iconBoxClass}`}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium">Read Notes</div>
                                  <div className={`text-[11px] truncate ${textMuted}`}>
                                    {sumDone ? 'Completed' : 'View breakdown'}
                                  </div>
                                </div>
                                {sumDone && <Check className="w-4 h-4 opacity-70" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setCompletedModules((prev) => ({
                                    ...prev,
                                    [`${mIdx}-quiz`]: true,
                                  }));
                                  openOrFocusTab('quiz', 'Quiz');
                                }}
                                className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-colors cursor-pointer ${borderSubtle} ${
                                  isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]'
                                }`}
                              >
                                <div
                                  className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${iconBoxClass}`}
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium">Practice Quiz</div>
                                  <div className={`text-[11px] truncate ${textMuted}`}>
                                    {quizDone ? 'Completed' : 'Test understanding'}
                                  </div>
                                </div>
                                {quizDone && <Check className="w-4 h-4 opacity-70" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB 4: QUIZ                                                 */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'quiz' && currentQuizItem && (
                  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-6 pb-20">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-xs font-mono tabular-nums ${textMuted}`}>
                          Question {safeQuizIdx + 1} of {quizList.length}
                        </span>
                        <span className={`text-xs font-mono tabular-nums ${textMuted}`}>
                          {Object.keys(checkedQuizMap).length} answered
                        </span>
                      </div>
                      <div
                        className={`w-full h-1.5 rounded-full overflow-hidden ${
                          isDark ? 'bg-white/[0.08]' : 'bg-black/[0.07]'
                        }`}
                      >
                        <div
                          className={`h-full transition-all duration-300 ${
                            isDark ? 'bg-white' : 'bg-black'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(((safeQuizIdx + 1) / Math.max(1, quizList.length)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-1">
                      <h2 className="text-sm sm:text-base font-medium leading-relaxed">
                        {currentQuizItem.question}
                      </h2>
                    </div>

                    <div className="space-y-2.5">
                      {currentQuizItem.options.map((opt, oIdx) => {
                        const checkedChoice = checkedQuizMap[currentQuizItem.id];
                        const isDontKnow = revealedDontKnowMap[currentQuizItem.id];
                        const isResolved = checkedChoice !== undefined || isDontKnow;
                        const isSelected =
                          (checkedChoice !== undefined ? checkedChoice : selectedQuizOption) ===
                          oIdx;
                        const isCorrect = currentQuizItem.correctIndex === oIdx;

                        let borderAndBg = isDark
                          ? 'bg-[#121215] border-white/[0.1] hover:border-white/[0.25]'
                          : 'bg-white border-black/[0.1] hover:border-black/[0.25]';

                        if (!isResolved && isSelected) {
                          borderAndBg = isDark
                            ? 'bg-white/[0.1] border-white text-white'
                            : 'bg-black/[0.06] border-black text-black';
                        } else if (isResolved) {
                          if (isCorrect) {
                            borderAndBg = isDark
                              ? 'bg-white/[0.14] border-white text-white font-medium'
                              : 'bg-black/[0.08] border-black text-black font-medium';
                          } else if (isSelected && !isCorrect) {
                            borderAndBg = isDark
                              ? 'bg-white/[0.02] border-white/[0.15] text-neutral-500 line-through'
                              : 'bg-black/[0.02] border-black/[0.15] text-neutral-400 line-through';
                          } else {
                            borderAndBg = isDark
                              ? 'bg-[#101012] border-white/[0.05] text-neutral-500'
                              : 'bg-[#fafafa] border-black/[0.05] text-neutral-400';
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => {
                              if (!isResolved) setSelectedQuizOption(oIdx);
                            }}
                            className={`w-full px-4 py-3.5 rounded-2xl border text-left text-xs sm:text-sm flex items-start gap-3 transition-all cursor-pointer ${borderAndBg}`}
                          >
                            <span className={`font-mono font-semibold shrink-0 ${textMuted}`}>
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <span className="flex-1 leading-relaxed">{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {(checkedQuizMap[currentQuizItem.id] !== undefined ||
                      revealedDontKnowMap[currentQuizItem.id]) && (
                      <div
                        className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed ${bgCard}`}
                      >
                        <div className="font-semibold mb-1">
                          {revealedDontKnowMap[currentQuizItem.id]
                            ? `Correct Answer: ${String.fromCharCode(
                                65 + currentQuizItem.correctIndex
                              )}`
                            : checkedQuizMap[currentQuizItem.id] ===
                              currentQuizItem.correctIndex
                            ? 'Correct'
                            : `Incorrect — Answer is ${String.fromCharCode(
                                65 + currentQuizItem.correctIndex
                              )}`}
                        </div>
                        <p className={textMuted}>{currentQuizItem.explanation}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedQuizOption === null) return;
                          setCheckedQuizMap((prev) => ({
                            ...prev,
                            [currentQuizItem.id]: selectedQuizOption,
                          }));
                        }}
                        className={`px-4 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          selectedQuizOption !== null
                            ? isDark
                              ? 'bg-white text-black border-white font-semibold'
                              : 'bg-black text-white border-black font-semibold'
                            : borderSubtle
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Check Answer</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setQuotedQuizQuestion(currentQuizItem.question);
                            openOrFocusTab('chat', 'Tutor');
                          }}
                          className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${borderSubtle}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Ask Tutor</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setRevealedDontKnowMap((prev) => ({
                              ...prev,
                              [currentQuizItem.id]: true,
                            }))
                          }
                          className={`px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${borderSubtle}`}
                        >
                          Show Answer
                        </button>
                      </div>
                    </div>

                    <div
                      className={`pt-4 border-t flex items-center justify-between ${borderSubtle}`}
                    >
                      <button
                        type="button"
                        disabled={safeQuizIdx === 0}
                        onClick={() => {
                          setSelectedQuizOption(null);
                          setCurrentQuizIdx((i) => Math.max(0, i - 1));
                        }}
                        className={`px-4 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer ${borderSubtle}`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuizOption(null);
                          if (safeQuizIdx < quizList.length - 1) {
                            setCurrentQuizIdx(safeQuizIdx + 1);
                          } else {
                            setCurrentQuizIdx(0);
                          }
                        }}
                        className={`px-4 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1 cursor-pointer ${borderSubtle}`}
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB 5: FLASHCARDS                                           */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'flashcards' && (
                  <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-6 pb-20">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-semibold">Flashcards</h2>

                      <div
                        className={`inline-flex items-center p-1 rounded-xl border ${
                          isDark ? 'bg-[#121215] border-white/[0.08]' : 'bg-[#f4f4f5] border-black/[0.08]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setFlashcardMode('spaced')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            flashcardMode === 'spaced'
                              ? isDark
                                ? 'bg-white text-black font-semibold'
                                : 'bg-white text-black shadow-2xs font-semibold'
                              : textMuted
                          }`}
                        >
                          Edit Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlashcardMode('fast')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            flashcardMode === 'fast'
                              ? isDark
                                ? 'bg-white text-black font-semibold'
                                : 'bg-white text-black shadow-2xs font-semibold'
                              : textMuted
                          }`}
                        >
                          Study Mode
                        </button>
                      </div>
                    </div>

                    {flashcardMode === 'fast' ? (
                      <div className="space-y-6">
                        {customFlashcards[cardIndex] ? (
                          <>
                            <div
                              onClick={() => setIsCardFlipped((f) => !f)}
                              className={`min-h-[280px] sm:min-h-[310px] p-6 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer select-none ${bgCard}`}
                            >
                              <div
                                className="flex items-center justify-between"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => setShowCardHint((h) => !h)}
                                  className="p-2 rounded-lg opacity-65 hover:opacity-100 cursor-pointer"
                                  title="Show hint"
                                >
                                  <Lightbulb className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCustomFlashcards((prev) =>
                                        prev.map((c, idx) =>
                                          idx === cardIndex ? { ...c, starred: !c.starred } : c
                                        )
                                      )
                                    }
                                    className="p-2 rounded-lg opacity-65 hover:opacity-100 cursor-pointer"
                                  >
                                    <Star
                                      className={`w-4 h-4 ${
                                        customFlashcards[cardIndex].starred ? 'fill-current opacity-100' : ''
                                      }`}
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFlashcardMode('spaced')}
                                    className="p-2 rounded-lg opacity-65 hover:opacity-100 cursor-pointer"
                                    title="Edit card"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="my-auto py-8 text-center px-3 space-y-3">
                                <p className="text-base sm:text-lg font-medium leading-relaxed">
                                  {isCardFlipped
                                    ? customFlashcards[cardIndex].back
                                    : customFlashcards[cardIndex].front}
                                </p>
                                {showCardHint && !isCardFlipped && (
                                  <p className={`text-xs ${textMuted}`}>
                                    Hint: {customFlashcards[cardIndex].back.slice(0, 32)}...
                                  </p>
                                )}
                              </div>

                              <div className={`text-center text-xs ${textMuted}`}>
                                {isCardFlipped ? 'Answer · Tap to flip' : 'Question · Tap to flip'}
                              </div>
                            </div>

                            <div className="flex items-center justify-between px-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCardFlipped(false);
                                  setShowCardHint(false);
                                  setCardIndex((i) => Math.max(0, i - 1));
                                }}
                                disabled={cardIndex === 0}
                                className={`size-10 rounded-xl border flex items-center justify-center disabled:opacity-35 cursor-pointer ${borderSubtle}`}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>

                              <span className={`text-xs font-mono tabular-nums ${textMuted}`}>
                                {cardIndex + 1} / {customFlashcards.length}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  setIsCardFlipped(false);
                                  setShowCardHint(false);
                                  setCardIndex((i) =>
                                    Math.min(customFlashcards.length - 1, i + 1)
                                  );
                                }}
                                disabled={cardIndex >= customFlashcards.length - 1}
                                className={`size-10 rounded-xl border flex items-center justify-center disabled:opacity-35 cursor-pointer ${borderSubtle}`}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-center justify-center gap-4 pt-1">
                              <button
                                type="button"
                                onClick={() => setFlashcardMode('spaced')}
                                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium cursor-pointer ${textMuted} hover:opacity-100`}
                              >
                                <Layers className="w-4 h-4" />
                                <span>Manage Cards</span>
                              </button>

                              <div className={`h-4 w-px ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />

                              <button
                                type="button"
                                onClick={() => {
                                  const shuffled = [...customFlashcards].sort(
                                    () => Math.random() - 0.5
                                  );
                                  setCustomFlashcards(shuffled);
                                  setCardIndex(0);
                                  setIsCardFlipped(false);
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer ${textMuted} hover:opacity-100`}
                                title="Shuffle Cards"
                              >
                                <Shuffle className="w-4 h-4" />
                                <span>Shuffle</span>
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">
                              All Cards{' '}
                              <span className={textMuted}>({customFlashcards.length})</span>
                            </h3>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomFlashcards((prev) => [
                                  {
                                    id: `fc-custom-${Date.now()}`,
                                    front: 'New Question',
                                    back: 'Answer',
                                    category: resolvedTitle.slice(0, 18),
                                  },
                                  ...prev,
                                ])
                              }
                              className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Card</span>
                            </button>
                          </div>

                          <div className="space-y-3">
                            {customFlashcards.map((fc, idx) => (
                              <div
                                key={fc.id}
                                className={`p-4 rounded-2xl border space-y-3 ${bgCard}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs ${textMuted}`}>
                                    Card {idx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCustomFlashcards((prev) =>
                                        prev.filter((_, i) => i !== idx)
                                      )
                                    }
                                    className="p-1 opacity-55 hover:opacity-100 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Question</label>
                                  <textarea
                                    rows={2}
                                    value={fc.front}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCustomFlashcards((prev) =>
                                        prev.map((c, i) => (i === idx ? { ...c, front: val } : c))
                                      );
                                    }}
                                    className={`w-full p-3 rounded-xl border text-xs leading-relaxed outline-none resize-y ${
                                      isDark
                                        ? 'bg-[#09090b] border-white/[0.08]'
                                        : 'bg-[#f8f8f9] border-black/[0.08]'
                                    }`}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium">Answer</label>
                                  <textarea
                                    rows={2}
                                    value={fc.back}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCustomFlashcards((prev) =>
                                        prev.map((c, i) => (i === idx ? { ...c, back: val } : c))
                                      );
                                    }}
                                    className={`w-full p-3 rounded-xl border text-xs leading-relaxed outline-none resize-y ${
                                      isDark
                                        ? 'bg-[#09090b] border-white/[0.08]'
                                        : 'bg-[#f8f8f9] border-black/[0.08]'
                                    }`}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB 6: SECTIONS                                             */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'chapters' && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4 pb-16">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base sm:text-lg font-semibold">Sections</h2>
                      <span className={`text-xs ${textMuted}`}>
                        {lessonModules.length} sections
                      </span>
                    </div>

                    <div className="space-y-3">
                      {lessonModules.map((ch, idx) => (
                        <div
                          key={idx}
                          className={`p-4 sm:p-5 rounded-2xl border space-y-2 ${bgCard}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm sm:text-base font-semibold">{ch.title}</h3>
                            {activeVideoId && (
                              <button
                                type="button"
                                onClick={() => handleJumpToTimestamp(ch.timestamp)}
                                className={`px-2.5 py-0.5 rounded-lg font-mono text-[11px] cursor-pointer ${bgSubtle}`}
                              >
                                {formatTime(ch.timestamp)}
                              </button>
                            )}
                          </div>
                          <p className={`text-xs sm:text-sm leading-relaxed ${textMuted}`}>
                            {ch.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB 7: TRANSCRIPTS                                          */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'transcripts' && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-20">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-base sm:text-lg font-semibold">Transcript</h2>
                        {import.meta.env.DEV && transcriptProvider && (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono ${bgSubtle}`}
                            title="Transcript provider"
                          >
                            {transcriptProviderLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setLangDropdownOpen((o) => !o)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${borderSubtle}`}
                          >
                            <span>{selectedLang.flag}</span>
                            <span>{selectedLang.label}</span>
                            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                          </button>

                          {langDropdownOpen && (
                            <div
                              className={`absolute right-0 top-full mt-2 w-60 rounded-2xl border p-2 z-40 shadow-2xl ${
                                isDark
                                  ? 'bg-[#18181b] border-white/[0.12] text-white'
                                  : 'bg-white border-black/[0.1] text-black'
                              }`}
                            >
                              <div
                                className={`flex items-center gap-2 px-3 py-2 border-b mb-1 ${borderSubtle}`}
                              >
                                <Search className="w-3.5 h-3.5 opacity-50" />
                                <input
                                  type="text"
                                  value={langSearch}
                                  onChange={(e) => setLangSearch(e.target.value)}
                                  placeholder="Search languages..."
                                  className="w-full bg-transparent border-0 text-xs outline-none"
                                />
                              </div>
                              <div className="max-h-56 overflow-y-auto space-y-0.5">
                                {filteredLanguages.map((lang) => (
                                  <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => handleSelectLanguage(lang)}
                                    className={`w-full px-3 py-2 rounded-xl text-xs text-left flex items-center gap-2.5 cursor-pointer ${
                                      selectedLang.code === lang.code
                                        ? bgSubtle
                                        : 'hover:bg-current/5'
                                    }`}
                                  >
                                    <span>{lang.flag}</span>
                                    <span>{lang.label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const txt = activeTranscriptList
                              .map((s) => `[${formatTime(s.start_s)}] ${s.text}`)
                              .join('\n\n');
                            navigator.clipboard.writeText(txt);
                            setCopiedTranscript(true);
                            setTimeout(() => setCopiedTranscript(false), 2000);
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                        >
                          {copiedTranscript ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {activeTranscriptList.length === 0 && !translatingLang ? (
                      <div className={`p-5 rounded-2xl border text-xs sm:text-sm ${bgCard} ${textMuted}`}>
                        No transcript is attached to this source. Transcripts are only shown when they
                        come from the video's real captions, a pasted transcript, or uploaded text.
                      </div>
                    ) : translatingLang ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className={`h-24 rounded-2xl animate-pulse ${bgSubtle}`}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeTranscriptList.map((seg, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${bgCard}`}
                          >
                            {activeVideoId && (
                              <button
                                type="button"
                                onClick={() => handleJumpToTimestamp(seg.start_s)}
                                className={`px-2 py-1 rounded-lg font-mono text-xs shrink-0 cursor-pointer ${bgSubtle}`}
                                title="Jump to timestamp in video"
                              >
                                {formatTime(seg.start_s)}
                              </button>
                            )}
                            <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line flex-1">
                              {seg.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB 8: NOTES                                                */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'notes' && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4 pb-16">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base sm:text-lg font-semibold">Notes</h2>
                      <button
                        type="button"
                        onClick={handleExportStudyPack}
                        className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Notes</span>
                      </button>
                    </div>
                    <textarea
                      rows={16}
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="Write your study notes here..."
                      className={`w-full p-4 rounded-2xl border text-sm leading-relaxed outline-none resize-y ${bgCard}`}
                    />
                  </div>
                )}

                {/* =========================================================== */}
                {/* TAB 9: TUTOR CHAT                                           */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'chat' && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex flex-col min-h-[72vh] pb-28">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold">Study Tutor</h2>

                      <button
                        type="button"
                        onClick={() => {
                          setChatTurns([]);
                          setQuotedQuizQuestion(null);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${borderSubtle}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Clear Chat</span>
                      </button>
                    </div>

                    {chatTurns.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8 space-y-6">
                        <div className="space-y-1.5">
                          <div className="text-lg font-semibold">Ask anything about {resolvedTitle}</div>
                          <p className={`text-xs max-w-sm ${textMuted}`}>
                            Ask follow-up questions, create mind maps, or review quiz questions step by step.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 max-w-md">
                          {[
                            {
                              label: 'Summary',
                              icon: FileText,
                              onClick: () => openOrFocusTab('summary', 'Summary'),
                            },
                            {
                              label: 'Mind Map',
                              icon: Network,
                              onClick: () => {
                                setActiveChatTags(['@Mind Map']);
                                handleSendStudyChat(`@Mind Map ${resolvedTitle}`);
                              },
                            },
                            {
                              label: 'Flow Chart',
                              icon: GitBranch,
                              onClick: () => {
                                setActiveChatTags(['@Flow Chart']);
                                handleSendStudyChat(`@Flow Chart ${resolvedTitle}`);
                              },
                            },
                            {
                              label: 'Quiz Me',
                              icon: BookOpen,
                              onClick: () => openOrFocusTab('quiz', 'Quiz'),
                            },
                            {
                              label: 'Flashcards',
                              icon: Layers,
                              onClick: () => openOrFocusTab('flashcards', 'Flashcards'),
                            },
                          ].map((pill) => {
                            const Icon = pill.icon;
                            return (
                              <button
                                key={pill.label}
                                type="button"
                                onClick={pill.onClick}
                                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                                  isDark
                                    ? 'bg-[#121215] border-white/[0.1] hover:border-white/[0.25]'
                                    : 'bg-white border-black/[0.1] hover:border-black/[0.25]'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5 opacity-70" />
                                <span>{pill.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 space-y-5">
                        {chatTurns.map((turn) => (
                          <div key={turn.id} className="space-y-3">
                            {turn.role === 'user' ? (
                              <div
                                className={`ml-auto max-w-xl p-4 rounded-2xl border text-xs sm:text-sm ${
                                  isDark
                                    ? 'bg-[#18181b] border-white/[0.1]'
                                    : 'bg-[#f4f4f5] border-black/[0.08]'
                                }`}
                              >
                                {turn.quotedQuestion && (
                                  <div
                                    className={`mb-2 pb-2 border-b text-xs ${borderSubtle} ${textMuted}`}
                                  >
                                    "{turn.quotedQuestion}"
                                  </div>
                                )}
                                <div>{turn.content}</div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {turn.includeMindMap && (
                                  <div className={`rounded-2xl border overflow-hidden ${bgCard}`}>
                                    <div
                                      className={`px-4 py-3 border-b flex items-center justify-between ${borderSubtle}`}
                                    >
                                      <span className="text-xs font-semibold">
                                        Mind Map · {resolvedTitle}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={handleExportStudyPack}
                                        className="p-1 opacity-60 hover:opacity-100 cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="p-4 sm:p-5 overflow-x-auto">
                                      <div className="flex items-center gap-6 min-w-[480px]">
                                        <div
                                          className={`px-4 py-2.5 rounded-xl border text-xs font-semibold shrink-0 ${
                                            isDark
                                              ? 'bg-white text-black border-white'
                                              : 'bg-black text-white border-black'
                                          }`}
                                        >
                                          {resolvedTitle.slice(0, 28)}
                                        </div>

                                        <div className="space-y-3 flex-1">
                                          {mindMapBranches.map((branch) => {
                                            const isExp = expandedMindMapNodes[branch.id] ?? true;
                                            return (
                                              <div
                                                key={branch.id}
                                                className="flex items-center gap-4"
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setExpandedMindMapNodes((prev) => ({
                                                      ...prev,
                                                      [branch.id]: !isExp,
                                                    }))
                                                  }
                                                  className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-2 shrink-0 cursor-pointer ${
                                                    isDark
                                                      ? 'bg-white/[0.08] border-white/[0.15]'
                                                      : 'bg-black/[0.06] border-black/[0.12]'
                                                  }`}
                                                >
                                                  <span>{branch.label}</span>
                                                  {isExp ? (
                                                    <ChevronLeft className="w-3 h-3" />
                                                  ) : (
                                                    <ChevronRight className="w-3 h-3" />
                                                  )}
                                                </button>

                                                {isExp && branch.children && (
                                                  <div className="space-y-1.5 flex-1">
                                                    {branch.children.map((ch) => (
                                                      <div
                                                        key={ch.id}
                                                        className={`px-3 py-2 rounded-xl border text-[11px] leading-snug ${borderSubtle} ${bgSubtle}`}
                                                      >
                                                        {ch.label}
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {turn.includeFlowChart && (
                                  <div className={`rounded-2xl border overflow-hidden ${bgCard}`}>
                                    <div
                                      className={`px-4 py-3 border-b flex items-center justify-between ${borderSubtle}`}
                                    >
                                      <span className="text-xs font-semibold">
                                        Flowchart · {resolvedTitle}
                                      </span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                      {lessonModules.map((m, idx) => (
                                        <div key={idx} className="flex flex-col items-center">
                                          <div
                                            className={`w-full max-w-md p-3 rounded-xl border text-center ${borderSubtle} ${bgSubtle}`}
                                          >
                                            <div className="text-xs font-semibold">{m.title}</div>
                                            <div className={`text-[11px] mt-0.5 ${textMuted}`}>
                                              {m.summary}
                                            </div>
                                          </div>
                                          {idx < lessonModules.length - 1 && (
                                            <div
                                              className={`h-4 w-px ${
                                                isDark ? 'bg-white/20' : 'bg-black/20'
                                              }`}
                                            />
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="text-xs sm:text-sm leading-relaxed">
                                  <MathMarkdown content={turn.content} isDark={isDark} />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {chatLoading && (
                          <div className={`text-xs flex items-center gap-2 ${textMuted}`}>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Thinking...</span>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}

                    {/* Bottom Chat Composer */}
                    <div className="fixed bottom-3 inset-x-0 px-3 sm:px-5 z-30 pointer-events-none">
                      <div className="max-w-2xl mx-auto pointer-events-auto space-y-2">
                        {quotedQuizQuestion && (
                          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                            {['Give me a hint', 'Walk me through it', 'Explain simply'].map(
                              (chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => handleSendStudyChat(chip)}
                                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap cursor-pointer ${
                                    isDark
                                      ? 'bg-[#18181b] border-white/[0.12] text-white'
                                      : 'bg-white border-black/[0.12] text-black shadow-2xs'
                                  }`}
                                >
                                  {chip}
                                </button>
                              )
                            )}
                          </div>
                        )}

                        {showAtMenu && (
                          <div
                            className={`w-56 rounded-2xl border p-1.5 shadow-2xl ${
                              isDark
                                ? 'bg-[#18181b] border-white/[0.12] text-white'
                                : 'bg-white border-black/[0.1] text-black'
                            }`}
                          >
                            <div className={`px-3 py-1 text-[10px] font-mono uppercase ${textMuted}`}>
                              Visuals
                            </div>
                            {['@Mind Map', '@Flow Chart'].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  if (!activeChatTags.includes(tag)) {
                                    setActiveChatTags((prev) => [...prev, tag]);
                                  }
                                  setShowAtMenu(false);
                                }}
                                className="w-full px-3 py-2 rounded-xl text-xs text-left hover:bg-current/5 cursor-pointer"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}

                        <div
                          className={`rounded-2xl border p-3 shadow-xl ${
                            isDark
                              ? 'bg-[#121215] border-white/[0.12]'
                              : 'bg-white border-black/[0.12]'
                          }`}
                        >
                          {quotedQuizQuestion && (
                            <div
                              className={`mb-2 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs ${bgSubtle}`}
                            >
                              <span className="truncate">"{quotedQuizQuestion}"</span>
                              <button
                                type="button"
                                onClick={() => setQuotedQuizQuestion(null)}
                                className="p-0.5 opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {activeChatTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {activeChatTags.map((t) => (
                                <span
                                  key={t}
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium ${bgSubtle}`}
                                >
                                  <span>{t}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveChatTags((prev) => prev.filter((x) => x !== t))
                                    }
                                    className="cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          <input
                            type="text"
                            value={chatDraft}
                            onChange={(e) => setChatDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendStudyChat();
                            }}
                            placeholder="Ask a question..."
                            className="w-full bg-transparent border-0 text-xs sm:text-sm outline-none mb-2.5"
                          />

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setShowAtMenu((s) => !s)}
                                className={`size-8 rounded-xl border flex items-center justify-center cursor-pointer ${borderSubtle}`}
                                title="Add @Mind Map or @Flow Chart"
                              >
                                <AtSign className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setStudyModeEnabled((s) => !s)}
                                className={`px-3 py-1 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                                  studyModeEnabled
                                    ? isDark
                                      ? 'bg-white/[0.12] border-white/30 text-white'
                                      : 'bg-black/[0.08] border-black/30 text-black'
                                    : `${borderSubtle} ${textMuted}`
                                }`}
                              >
                                <span>Study Mode</span>
                                {studyModeEnabled && <X className="w-3 h-3 opacity-60" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="size-8 rounded-xl flex items-center justify-center opacity-65 hover:opacity-100 cursor-pointer"
                                title="Attach PDF or file"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSendStudyChat()}
                              className={`size-9 rounded-xl flex items-center justify-center cursor-pointer ${
                                isDark ? 'bg-white text-black' : 'bg-black text-white'
                              }`}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
