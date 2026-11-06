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
  Send,
  Sparkles,
  Sliders,
  Type,
  RotateCcw,
  Bookmark,
  FolderOpen,
  MapPin,
} from 'lucide-react';
import { ViewOnMap } from './watermelon/view-on-map';
import { ThinkingOrb } from 'thinking-orbs';
import {
  YouTubeTranscriptSegment,
  YouTubeStudyBundle,
  YouTubeVideoInfo,
  AgentReplyCard,
} from '../types';
import {
  getAuthHeaders,
} from '../lib/firebase';
import {
  extractTextFromPdfFile,
} from '../lib/pdfStudyEngine';
import { speakTextWithSmallestAi, stopSmallestSpeech } from '../lib/smallestAi';
import { apiFetch } from '../lib/apiBase';
import { UserAccountStore } from '../lib/userAccountStore';
import { KnowledgeVaultStore } from '../lib/growthStore';
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
  onAskKinich?: (prompt: string) => void;
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
  | 'chat'
  | 'map';

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

export function splitSegmentIntoSentences(
  text: string
): { sentence: string; charOffset: number }[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9"'\n])/);
  let offset = 0;
  const results: { sentence: string; charOffset: number }[] = [];
  for (const p of parts) {
    const clean = p.trim();
    if (clean) {
      results.push({ sentence: clean, charOffset: offset });
      offset += p.length + 1;
    }
  }
  return results.length > 0 ? results : [{ sentence: trimmed, charOffset: 0 }];
}

export function consolidateTranscriptSegments(
  rawSegments: YouTubeTranscriptSegment[]
): YouTubeTranscriptSegment[] {
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) return [];

  const avgLen =
    rawSegments.reduce((acc, s) => acc + (s.text || '').length, 0) /
    Math.max(1, rawSegments.length);
  if (avgLen > 140) {
    return rawSegments.map((s, idx) => ({
      ...s,
      start_s: idx === 0 && (s.start_s || 0) <= 25 ? 0 : s.start_s,
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
        const effectiveStart =
          consolidated.length === 0 && currentStart <= 25 ? 0 : currentStart;
        consolidated.push({
          start_s: effectiveStart,
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

export function buildDetailedStatementBreakdown(
  chapters: Array<{ title: string; summary: string }>
): DetailedStatementItem[] {
  return (chapters || []).map((ch, idx) => ({
    index: idx + 1,
    heading: ch.title,
    claim: ch.summary,
    elaboration: ch.summary,
  }));
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
    { id: 'tab-quiz', type: 'quiz', title: 'Quiz' },
    { id: 'tab-flashcards', type: 'flashcards', title: 'Flashcards' },
    { id: 'tab-transcripts', type: 'transcripts', title: 'Transcript' },
    { id: 'tab-learn', type: 'learn', title: 'Study Tools' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-summary');

  // Study Data State
  const [segments, setSegments] = useState<YouTubeTranscriptSegment[]>(
    initialVideo?.transcript ? consolidateTranscriptSegments(initialVideo.transcript) : []
  );
  const [studyBundle, setStudyBundle] = useState<YouTubeStudyBundle | null>(null);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [transcriptProvider, setTranscriptProvider] = useState<string>('');
  const [pasteTranscriptVal, setPasteTranscriptVal] = useState<string>('');
  const [statementBreakdown, setStatementBreakdown] = useState<DetailedStatementItem[]>([]);
  const [aiExhaustiveSummary, setAiExhaustiveSummary] = useState<string>('');
  const [synthesizingDeepSummary, setSynthesizingDeepSummary] = useState<boolean>(false);
  const [loadingContent, setLoadingContent] = useState<boolean>(false);
  const [loadingElapsedSec, setLoadingElapsedSec] = useState<number>(0);
  const [loadingStageText, setLoadingStageText] = useState<string>('Extracting transcript & source metadata...');

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

  // Reading Mode State for Summary
  const [isReadingMode, setIsReadingMode] = useState<boolean>(false);
  const [readingFontSize, setReadingFontSize] = useState<'sm' | 'base' | 'lg' | 'xl' | '2xl'>('base');
  const [readingLineHeight, setReadingLineHeight] = useState<'compact' | 'normal' | 'relaxed' | 'spacious'>('relaxed');
  const [readingFontFamily, setReadingFontFamily] = useState<'sans' | 'serif' | 'mono'>('sans');

  // Summary Follow-Up Assistant State
  const [summaryFollowUpQuery, setSummaryFollowUpQuery] = useState<string>('');
  const [summaryFollowUpLoading, setSummaryFollowUpLoading] = useState<boolean>(false);
  const [summaryFollowUpTurns, setSummaryFollowUpTurns] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; text: string; timestamp: number }>
  >([]);
  const [summaryFollowUpError, setSummaryFollowUpError] = useState<string | null>(null);
  const [copiedFollowUpTurnId, setCopiedFollowUpTurnId] = useState<string | null>(null);

  // Map & Location State
  const [mapLocationQuery, setMapLocationQuery] = useState<string>('');

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
    Array<{
      id: string;
      front: string;
      back: string;
      category?: string;
      starred?: boolean;
      timestamp_s?: number;
      timestamp?: number;
      sourceQuote?: string;
    }>
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
  const [copiedSegmentIdx, setCopiedSegmentIdx] = useState<number | null>(null);
  const [activeJumpTimestamp, setActiveJumpTimestamp] = useState<number | null>(null);
  const [pastedTranscriptText, setPastedTranscriptText] = useState<string>('');
  const [subclipToast, setSubclipToast] = useState<string | null>(null);

  const handleCreateSubclip = (text: string, timestamp_s: number) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const newCard = {
      id: `subclip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      front: cleanText.length > 90 ? `${cleanText.slice(0, 87)}...` : cleanText,
      back: cleanText,
      category: resolvedTitle.slice(0, 22),
      timestamp_s,
      starred: true,
    };
    setCustomFlashcards((prev) => [newCard, ...prev]);
    setSubclipToast(`Saved subclip (${formatTime(timestamp_s)}) as flashcard!`);
    setTimeout(() => setSubclipToast(null), 3200);
  };

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
      const saved = localStorage.getItem('kinich_study_spaces_v2');
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
  const ytIframeRef = useRef<HTMLIFrameElement>(null);

  const userProfile = useMemo(() => UserAccountStore.getProfile(), []);
  const displayName = userProfile?.displayName?.split(' ')[0] || 'Wake';

  useEffect(() => {
    if (!loadingContent) {
      setLoadingElapsedSec(0);
      return;
    }
    setLoadingElapsedSec(0);
    const interval = setInterval(() => {
      setLoadingElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loadingContent]);

  useEffect(() => {
    try {
      localStorage.setItem('kinich_study_spaces_v2', JSON.stringify(spaces));
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
          timestamp_s: c.timestamp_s,
          timestamp: c.timestamp,
          sourceQuote: c.sourceQuote,
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
      return;
    }
    if (initialId) {
      loadYouTubeSource(initialId, initialVideo?.title, initialVideo?.author, initialVideo?.transcript);
      return;
    }
    if (initialVideo?.title) {
      loadTopicStudySpace(initialVideo.title);
      return;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlVid = params.get('v') || params.get('video') || params.get('url');
      const urlTopic = params.get('topic') || params.get('q');
      if (urlVid) {
        const extracted = extractYouTubeIdFromInput(urlVid.trim());
        if (extracted) {
          loadYouTubeSource(extracted);
          return;
        }
      }
      if (urlTopic && urlTopic.trim()) {
        loadTopicStudySpace(urlTopic.trim());
      }
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
      map: customTitle || 'Location Map',
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
      const res = await apiFetch('/api/study/youtube-search', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ query: q, limit: 12 }),
        signal: AbortSignal.timeout(20000),
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

      const res = await apiFetch('/api/study/ai-assistant', {
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
    setStudyError(null);
    setAiExhaustiveSummary('');
    setTopicVideos([]);
    setFocusedModuleView(null);
    setCurrentQuizIdx(0);
    setSelectedQuizOption(null);
    setCheckedQuizMap({});
    setRevealedDontKnowMap({});

    try {
      const authHeaders = await getAuthHeaders();
      const res = await apiFetch('/api/study/topic', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ query: cleanTopic }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || `Server responded with HTTP ${res.status}`);
      }

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
      }

      const sections: DetailedStatementItem[] = Array.isArray(data.sections) && data.sections.length > 0
        ? data.sections.map((s: any, idx: number) => ({
            index: idx + 1,
            heading: String(s.heading || s.title || `Concept ${idx + 1}`),
            claim: String(s.claim || ''),
            elaboration: String(s.elaboration || s.claim || ''),
          }))
        : [];

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
      setStudyError(null);

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
    } catch (err: any) {
      setStudyError(err?.message || 'Failed to generate topic study materials. Please retry.');
      setStudyBundle(null);
    } finally {
      setLoadingContent(false);
    }
  };

  // Load YouTube Video (Direct Link or Video ID: loads ONLY this exact video, autoplays, no related videos)
  const applyPastedTranscript = async (text: string) => {
    const t = text.trim();
    if (!t || !activeVideoId) return;
    setStudyError(null);
    setLoadingContent(true);
    try {
      const consolidated = consolidateTranscriptSegments([{ start_s: 0, duration_s: 0, text: t }]);
      setSegments(consolidated.length > 0 ? consolidated : [{ start_s: 0, duration_s: 0, text: t }]);
      const authHeaders = await getAuthHeaders();
      const aiRes = await apiFetch('/api/youtube/study', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          videoId: activeVideoId,
          videoTitle: resolvedTitle,
          videoAuthor: resolvedAuthor,
          segments: consolidated.length > 0 ? consolidated : [{ start_s: 0, duration_s: 0, text: t }],
        }),
        signal: AbortSignal.timeout(180000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (aiData?.study?.summary?.overview) {
          setStudyBundle(aiData.study);
          setStatementBreakdown(
            aiData.study.summary.chapters.map((ch: any, idx: number) => ({
              index: idx + 1,
              heading: ch.title,
              claim: ch.summary,
              elaboration: ch.summary,
            }))
          );
        }
      }
      setPasteTranscriptVal('');
    } catch {}
    setLoadingContent(false);
  };

  const loadYouTubeSource = async (
    targetVidId: string,
    hintTitle?: string,
    hintAuthor?: string,
    cachedTranscript?: YouTubeTranscriptSegment[]
  ) => {
    const normVidId = extractYouTubeIdFromInput(targetVidId) || targetVidId.trim();
    const cleanHint = (hintTitle || '')
      .replace(/^YouTube Video\s*\((.+?)\)(?:\s*by\s*YouTube)?$/i, '$1')
      .trim();

    setViewMode('workspace');
    setSourceType('youtube');
    setActiveVideoId(normVidId);
    setShowSourceViewer(true);
    setAutoPlayVideo(true);
    setTopicVideos([]);
    setOpenTabs((prev) => prev.filter((t) => t.type !== 'videos'));
    setLoadingContent(true);
    setStudyError(null);
    setAiExhaustiveSummary('');
    setFocusedModuleView(null);
    setCurrentQuizIdx(0);
    setSelectedQuizOption(null);
    setCheckedQuizMap({});
    setRevealedDontKnowMap({});

    let title =
      cleanHint && cleanHint !== normVidId
        ? cleanHint
        : 'YouTube Video';
    let author = hintAuthor || 'YouTube';

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${normVidId}`
        )}&format=json`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        if (oembed.title) title = oembed.title;
        if (oembed.author_name) author = oembed.author_name;
      }
    } catch {}

    setResolvedTitle(title);
    setResolvedAuthor(author);

    try {
      let rawLoadedSegments: YouTubeTranscriptSegment[] =
        cachedTranscript && cachedTranscript.length > 0 ? cachedTranscript : [];

      if (rawLoadedSegments.length === 0) {
        try {
          const reqBody = {
            url: `https://www.youtube.com/watch?v=${normVidId}`,
            videoId: normVidId,
          };
          console.log('[StudyWorkspace] Requesting transcript with body:', reqBody);
          const res = await apiFetch('/api/youtube/transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody),
            signal: AbortSignal.timeout(30000),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.title && (title === 'YouTube Video' || !cleanHint || cleanHint === targetVidId)) {
              title = data.title;
              setResolvedTitle(title);
            }
            if (data.author && (author === 'YouTube' || !hintAuthor)) {
              author = data.author;
              setResolvedAuthor(author);
            }
            if (data.success && Array.isArray(data.segments) && data.segments.length > 0) {
              rawLoadedSegments = data.segments;
              setTranscriptProvider(String(data.provider || 'youtube'));
            }
          }
        } catch {}
      }

      if (rawLoadedSegments.length === 0) {
        throw new Error("Couldn't fetch captions right now. The transcript server may be offline or YouTube blocked the request. Retry in a moment, or paste the transcript.");
      }

      const consolidated = consolidateTranscriptSegments(rawLoadedSegments);
      setSegments(consolidated);
      setLoadingStageText('Transcript ready — synthesizing chapters, quiz & flashcards...');

      const authHeaders = await getAuthHeaders();
      const aiRes = await apiFetch('/api/youtube/study', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          videoId: targetVidId,
          videoTitle: title,
          videoAuthor: author,
          segments: consolidated,
        }),
        signal: AbortSignal.timeout(180000),
      });

      if (!aiRes.ok) {
        const errJson = await aiRes.json().catch(() => ({}));
        throw new Error(errJson?.error || `Study generation failed with HTTP ${aiRes.status}`);
      }

      const aiData = await aiRes.json();
      if (!aiData?.study?.summary?.overview) {
        throw new Error('Study synthesis failed to return valid curriculum. Please retry.');
      }

      const finalStudy: YouTubeStudyBundle = aiData.study;
      setStudyBundle(finalStudy);
      setStatementBreakdown(
        finalStudy.summary.chapters.map((ch, idx) => ({
          index: idx + 1,
          heading: ch.title,
          claim: ch.summary,
          elaboration: ch.summary,
        }))
      );
      setStudyError(null);
      setShowSourceViewer(true);
      setAutoPlayVideo(true);

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
    } catch (err: any) {
      setStudyError(err?.message || 'Failed to generate study materials from video transcript. Please retry.');
      setStudyBundle(null);
    } finally {
      setLoadingContent(false);
      setTopicVideos([]);
    }
  };

  // Load PDF or Pasted Notes (or route short topic queries to loadTopicStudySpace)
  const loadTextOrPdfSource = async (
    title: string,
    text: string,
    type: 'pdf' | 'text' | 'topic',
    url = ''
  ) => {
    const cleanText = (text || '').trim();
    const ytId = extractYouTubeIdFromInput(title || cleanText);
    if (ytId) {
      await loadYouTubeSource(ytId);
      return;
    }
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
    setStudyError(null);
    setAiExhaustiveSummary('');
    setTopicVideos([]);
    setFocusedModuleView(null);
    setCurrentQuizIdx(0);
    setSelectedQuizOption(null);
    setCheckedQuizMap({});
    setRevealedDontKnowMap({});

    try {
      const authHeaders = await getAuthHeaders();
      const res = await apiFetch('/api/pdf/study', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          title,
          textContent: cleanText,
          difficulty: 'medium',
        }),
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || `Document synthesis failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      const aiStudy: YouTubeStudyBundle = data?.study;
      if (!aiStudy?.summary?.overview) {
        throw new Error('LLM failed to return structured document study guide. Please retry.');
      }

      const aiSections: DetailedStatementItem[] = (aiStudy.summary.chapters || []).map(
        (ch, idx: number) => ({
          index: idx + 1,
          heading: ch.title,
          claim: ch.summary,
          elaboration: ch.summary,
        })
      );

      setSegments([]);
      setStatementBreakdown(aiSections);
      setStudyBundle(aiStudy);
      setStudyError(null);

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
    } catch (err: any) {
      setStudyError(err?.message || 'Failed to synthesize document study materials. Please retry.');
      setStudyBundle(null);
    } finally {
      setLoadingContent(false);
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
    const targetSec = Math.max(0, Math.floor(sec));
    setSeekSeconds(targetSec);
    setAutoPlayVideo(true);
    setShowSourceViewer(true);

    // Seek in-place via YouTube IFrame Player API postMessage without reloading the iframe
    setTimeout(() => {
      try {
        const win = ytIframeRef.current?.contentWindow;
        if (win) {
          win.postMessage(
            JSON.stringify({
              event: 'command',
              func: 'seekTo',
              args: [targetSec, true],
            }),
            '*'
          );
          win.postMessage(
            JSON.stringify({
              event: 'command',
              func: 'playVideo',
              args: [],
            }),
            '*'
          );
        }
      } catch {}
    }, 50);
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
      const res = await apiFetch('/api/chat', {
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

  const handleCopyFormattedTranscript = async () => {
    if (!activeTranscriptList || activeTranscriptList.length === 0) return;
    const titleHeader = resolvedTitle ? `# ${resolvedTitle}\n` : '';
    const langHeader =
      selectedLang && selectedLang.code !== 'en'
        ? `Language: ${selectedLang.label}\n`
        : '';
    const header = titleHeader || langHeader ? `${titleHeader}${langHeader}\n` : '';
    const body = activeTranscriptList
      .map((s) => `[${formatTime(s.start_s)}] ${s.text.trim()}`)
      .join('\n\n');
    const fullText = `${header}${body}`.trim();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullText;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(ta);
    }

    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2200);
  };

  const handleCopySingleSegment = async (seg: YouTubeTranscriptSegment, idx: number) => {
    const formatted = `[${formatTime(seg.start_s)}] ${seg.text.trim()}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(formatted);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = formatted;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(ta);
    }
    setCopiedSegmentIdx(idx);
    setTimeout(() => setCopiedSegmentIdx(null), 1800);
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

  const [isGuestStudyUser, setIsGuestStudyUser] = useState(() => UserAccountStore.isGuestUser());
  const [savedStudyVaultId, setSavedStudyVaultId] = useState<string | null>(null);
  const savedStudyVaultIdRef = useRef<string | null>(null);
  const [sageStudyOrganizing, setSageStudyOrganizing] = useState(false);
  const [sageStudyCard, setSageStudyCard] = useState<AgentReplyCard | null>(null);
  const [sageStatusText, setSageStatusText] = useState<string | null>(null);
  const [showSageBanner, setShowSageBanner] = useState(false);
  const sageTimeoutRef = useRef<any>(null);
  const sageAutoHideTimerRef = useRef<any>(null);

  useEffect(() => {
    const syncGuest = () => setIsGuestStudyUser(UserAccountStore.isGuestUser());
    window.addEventListener('kinich-account-updated', syncGuest);
    return () => window.removeEventListener('kinich-account-updated', syncGuest);
  }, []);

  useEffect(() => {
    const onSageDone = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.item) return;
      const targetId = savedStudyVaultIdRef.current;
      if (targetId && detail.item.id === targetId) {
        clearTimeout(sageTimeoutRef.current);
        setSageStudyOrganizing(false);
        if (detail.agentReply) {
          setSageStudyCard(detail.agentReply as AgentReplyCard);
          setSageStatusText(`Filed under ${detail.agentReply.subject || 'Subject'} → ${detail.agentReply.chapter || 'Chapter'}`);
        } else {
          setSageStatusText(`Filed under ${detail.item.subject || 'Subject'} → ${detail.item.chapter || 'Chapter'}`);
        }
        clearTimeout(sageAutoHideTimerRef.current);
        sageAutoHideTimerRef.current = setTimeout(() => {
          setShowSageBanner(false);
        }, 4000);
      }
    };
    window.addEventListener('kinich-sage-organized', onSageDone as EventListener);
    return () => {
      window.removeEventListener('kinich-sage-organized', onSageDone as EventListener);
      clearTimeout(sageTimeoutRef.current);
      clearTimeout(sageAutoHideTimerRef.current);
    };
  }, []);

  const handleSaveStudyResultToVault = (
    saveType: 'lecture' | 'quiz' | 'flashcard_deck' = 'lecture'
  ) => {
    if (UserAccountStore.isGuestUser()) {
      window.dispatchEvent(new CustomEvent('kinich-open-auth', { detail: { message: 'Sign in to keep this in your Vault.' } }));
      return;
    }
    const check = KnowledgeVaultStore.canSaveToVault(savedStudyVaultId || undefined);
    if (!check.allowed) {
      window.dispatchEvent(
        new CustomEvent('kinich-open-pricing', {
          detail: { highlightPlan: 'spark', reason: check.message },
        })
      );
      return;
    }

    const chapterTimestamps = (studyBundle?.summary?.chapters || [])
      .slice(0, 20)
      .map((ch) => `[${formatTime(ch.timestamp)}] ${ch.title}`);
    const segmentTimestamps = segments
      .slice(0, 15)
      .map((s) => `[${formatTime(s.start_s)}] ${s.text.slice(0, 60)}`);
    const timestamps =
      chapterTimestamps.length > 0 ? chapterTimestamps : segmentTimestamps;

    const sourceUrl = activeVideoId
      ? `https://www.youtube.com/watch?v=${activeVideoId}`
      : pdfUrl || '';

    let md = `# ${resolvedTitle}\n\n`;
    if (sourceUrl) {
      md += `**Source**: ${sourceUrl}\n\n`;
    }
    if (studyBundle?.summary?.overview) {
      md += `## Overview\n${studyBundle.summary.overview}\n\n`;
    }
    if (aiExhaustiveSummary) {
      md += `## Detailed Synthesis\n${aiExhaustiveSummary}\n\n`;
    }
    if (studyBundle?.summary?.chapters && studyBundle.summary.chapters.length > 0) {
      md += `## Timestamped Chapters\n`;
      for (const ch of studyBundle.summary.chapters) {
        md += `- **[${formatTime(ch.timestamp)}] ${ch.title}**: ${ch.summary}\n`;
      }
      md += `\n`;
    }
    if (statementBreakdown.length > 0) {
      md += `## Core Concepts & Breakdown\n\n`;
      for (const st of statementBreakdown) {
        md += `### ${st.heading}\n${st.elaboration}\n\n`;
      }
    }
    if (studyBundle?.quiz && studyBundle.quiz.length > 0) {
      md += `## Active Recall Quiz (${studyBundle.quiz.length} Questions)\n`;
      studyBundle.quiz.forEach((q, idx) => {
        md += `${idx + 1}. **${q.question}**\n   - Answer: ${q.options[q.correctIndex]} — ${q.explanation}\n`;
      });
      md += `\n`;
    }
    if (customFlashcards.length > 0) {
      md += `## Flashcards (${customFlashcards.length})\n`;
      customFlashcards.forEach((fc, idx) => {
        md += `${idx + 1}. **${fc.front}** — ${fc.back}\n`;
      });
    }

    setShowSageBanner(true);
    setSageStudyOrganizing(true);
    setSageStatusText('Assigning Subject, Chapter, tags, and linking related Vault lectures…');
    clearTimeout(sageTimeoutRef.current);
    sageTimeoutRef.current = setTimeout(() => {
      setSageStudyOrganizing(false);
      setSageStatusText('Saved. Sage will finish organizing in the background');
      clearTimeout(sageAutoHideTimerRef.current);
      sageAutoHideTimerRef.current = setTimeout(() => {
        setShowSageBanner(false);
      }, 4000);
    }, 20000);

    const saved = KnowledgeVaultStore.saveItem({
      title:
        saveType === 'quiz'
          ? `Quiz: ${resolvedTitle}`
          : saveType === 'flashcard_deck'
          ? `Flashcards: ${resolvedTitle}`
          : resolvedTitle || 'YouTube Study Lecture',
      summary:
        studyBundle?.summary?.overview ||
        aiExhaustiveSummary.slice(0, 240) ||
        rawSourceText.slice(0, 240) ||
        resolvedTitle,
      content: md.trim() || rawSourceText || resolvedTitle,
      type: saveType,
      sourceType: saveType,
      sourceUrl,
      timestamps,
      collectionId: 'col_exam_prep',
      tags: [
        activeVideoId ? 'youtube-study' : 'study-space',
        saveType,
      ],
    });
    setSavedStudyVaultId(saved.id);
    savedStudyVaultIdRef.current = saved.id;
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
        ? `For the quiz question: "${currentQuoted}"\n\nUser request: ${displayPrompt}\n\nProvide a clear, simple, helpful explanation grounded in "${resolvedTitle}".`
        : displayPrompt;

      const res = await apiFetch('/api/study/ai-assistant', {
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

  // Summary reading stats and typography computed classes
  const summaryWordCount = useMemo(() => {
    if (!studyBundle) return 0;
    const allText = [
      studyBundle.summary.overview,
      aiExhaustiveSummary,
      ...statementBreakdown.map((s) => `${s.heading} ${s.elaboration}`),
      ...studyBundle.explanation.concepts.map((c) => `${c.term} ${c.definition}`),
    ]
      .filter(Boolean)
      .join(' ');
    return allText.trim().split(/\s+/).filter(Boolean).length;
  }, [studyBundle, aiExhaustiveSummary, statementBreakdown]);

  const summaryEstimatedReadingMinutes = useMemo(() => {
    return Math.max(1, Math.ceil(summaryWordCount / 200));
  }, [summaryWordCount]);

  const readingFontFamilyClass = useMemo(() => {
    switch (readingFontFamily) {
      case 'serif':
        return 'font-serif';
      case 'mono':
        return 'font-mono';
      case 'sans':
      default:
        return 'font-sans';
    }
  }, [readingFontFamily]);

  const readingSizeClass = useMemo(() => {
    switch (readingFontSize) {
      case 'sm':
        return 'text-sm';
      case 'lg':
        return 'text-lg';
      case 'xl':
        return 'text-xl';
      case '2xl':
        return 'text-2xl';
      case 'base':
      default:
        return 'text-base';
    }
  }, [readingFontSize]);

  const readingLhClass = useMemo(() => {
    switch (readingLineHeight) {
      case 'compact':
        return 'leading-normal';
      case 'normal':
        return 'leading-relaxed';
      case 'spacious':
        return 'leading-[2.25]';
      case 'relaxed':
      default:
        return 'leading-loose';
    }
  }, [readingLineHeight]);

  const handleSendSummaryFollowUp = async (overridePrompt?: string) => {
    const rawPrompt = overridePrompt || summaryFollowUpQuery;
    const cleanPrompt = rawPrompt.trim();
    if (!cleanPrompt || summaryFollowUpLoading) return;

    const userTurn = {
      id: `fu-u-${Date.now()}`,
      role: 'user' as const,
      text: cleanPrompt,
      timestamp: Date.now(),
    };

    setSummaryFollowUpTurns((prev) => [...prev, userTurn]);
    setSummaryFollowUpQuery('');
    setSummaryFollowUpLoading(true);
    setSummaryFollowUpError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const contextPieces = [
        `Title: ${resolvedTitle}`,
        studyBundle?.summary?.overview ? `Overview:\n${studyBundle.summary.overview}` : '',
        aiExhaustiveSummary ? `Deep Synthesis:\n${aiExhaustiveSummary}` : '',
        statementBreakdown.length > 0
          ? `Key Points Breakdown:\n${statementBreakdown.map((s) => `${s.heading}: ${s.elaboration}`).join('\n\n')}`
          : '',
        studyBundle?.explanation?.concepts && studyBundle.explanation.concepts.length > 0
          ? `Key Concepts:\n${studyBundle.explanation.concepts.map((c) => `${c.term}: ${c.definition}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 16000);

      const res = await apiFetch('/api/study/ai-assistant', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          prompt: cleanPrompt,
          topic: resolvedTitle,
          mode: 'chat',
          context: contextPieces,
          webSearch: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const reply =
        data?.text ||
        data?.reply ||
        'I reviewed the summary, but was not able to generate an expanded explanation. Please try asking in another way.';

      setSummaryFollowUpTurns((prev) => [
        ...prev,
        {
          id: `fu-a-${Date.now()}`,
          role: 'assistant',
          text: reply,
          timestamp: Date.now(),
        },
      ]);
    } catch (err: any) {
      console.error('Summary follow-up request failed:', err);
      setSummaryFollowUpError('Unable to generate answer. Please check your connection and try again.');
    } finally {
      setSummaryFollowUpLoading(false);
    }
  };

  const renderSummaryFollowUpSection = () => (
    <div
      className={`p-5 sm:p-7 rounded-3xl border transition-all space-y-5 ${borderSubtle} ${bgCard} shadow-sm`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold tracking-tight">
              Summary Follow-Up Assistant
            </h3>
            <p className={`text-xs ${textMuted}`}>
              Ask anything about this summary, explore analogies, or clarify tough points.
            </p>
          </div>
        </div>

        {summaryFollowUpTurns.length > 0 && (
          <button
            type="button"
            onClick={() => setSummaryFollowUpTurns([])}
            className={`text-xs px-2.5 py-1 rounded-xl border inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-colors ${borderSubtle} ${textMuted}`}
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>

      {/* Suggested prompt chips */}
      {summaryFollowUpTurns.length === 0 && (
        <div className="space-y-2 pt-1">
          <div className={`text-[11px] font-medium tracking-wide uppercase ${textMuted}`}>
            Suggested follow-up questions:
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Explain the core mechanism in simple words',
              'Give 2 real-world examples of this',
              'What could be tested on an exam from this?',
              'Summarize the 3 biggest takeaways',
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                disabled={summaryFollowUpLoading}
                onClick={() => handleSendSummaryFollowUp(chip)}
                className={`text-xs px-3 py-1.5 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
                  isDark
                    ? 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08]'
                    : 'bg-black/[0.02] hover:bg-black/[0.05] border-black/[0.08]'
                }`}
              >
                💡 {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Thread */}
      {summaryFollowUpTurns.length > 0 && (
        <div className="space-y-4 pt-2">
          {summaryFollowUpTurns.map((turn) => (
            <div
              key={turn.id}
              className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div className="flex items-center gap-2 px-1 text-[11px]">
                <span className={`font-medium ${turn.role === 'user' ? textMuted : 'text-amber-500'}`}>
                  {turn.role === 'user' ? 'You' : 'Kinich Study AI'}
                </span>
                <span className={textMuted}>
                  {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {turn.role === 'user' ? (
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium ${
                    isDark ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-900'
                  }`}
                >
                  {turn.text}
                </div>
              ) : (
                <div
                  className={`w-full p-4 sm:p-5 rounded-2xl border text-xs sm:text-sm leading-relaxed relative group ${
                    isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-neutral-50/80 border-neutral-200'
                  }`}
                >
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(turn.text);
                        setCopiedFollowUpTurnId(turn.id);
                        setTimeout(() => setCopiedFollowUpTurnId(null), 2000);
                      }}
                      className={`p-1.5 rounded-lg border text-xs inline-flex items-center gap-1 cursor-pointer ${borderSubtle} ${bgCard}`}
                      title="Copy response"
                    >
                      {copiedFollowUpTurnId === turn.id ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <MathMarkdown content={turn.text} isDark={isDark} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {summaryFollowUpLoading && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-xs ${borderSubtle} ${bgSubtle}`}
        >
          <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
          <span className={textMuted}>
            Analyzing summary context and synthesizing grounded answer...
          </span>
        </div>
      )}

      {/* Error state */}
      {summaryFollowUpError && (
        <div className="p-3 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-center justify-between">
          <span>{summaryFollowUpError}</span>
          <button
            type="button"
            onClick={() => handleSendSummaryFollowUp()}
            className="underline font-medium cursor-pointer ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendSummaryFollowUp();
        }}
        className={`relative flex flex-col gap-2 p-3 sm:p-3.5 rounded-2xl border transition-all focus-within:ring-1 focus-within:ring-amber-500/30 ${borderSubtle} ${
          isDark ? 'bg-neutral-900/40' : 'bg-neutral-50'
        }`}
      >
        <textarea
          rows={2}
          value={summaryFollowUpQuery}
          onChange={(e) => setSummaryFollowUpQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendSummaryFollowUp();
            }
          }}
          placeholder="Ask a follow-up about this summary (e.g. 'Can you explain this with a real-life analogy?')..."
          className="w-full bg-transparent border-0 text-xs sm:text-sm outline-none resize-none leading-relaxed placeholder:text-neutral-400"
        />

        <div className="flex items-center justify-between pt-1">
          <span className={`text-[11px] ${textMuted} flex items-center gap-1`}>
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 font-mono text-[10px]">
              Enter
            </kbd>
            <span>to ask</span>
          </span>

          <button
            type="submit"
            disabled={!summaryFollowUpQuery.trim() || summaryFollowUpLoading}
            className={`h-8 px-4 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
              isDark
                ? 'bg-white text-black hover:bg-neutral-200'
                : 'bg-black text-white hover:bg-neutral-800'
            }`}
          >
            {summaryFollowUpLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Ask</span>
          </button>
        </div>
      </form>
    </div>
  );

  const activeTranscriptList =
    selectedLang.code !== 'en' && translatedSegments[selectedLang.code]
      ? translatedSegments[selectedLang.code]
      : segments;

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
    <div className={`w-full h-full flex flex-col font-sans select-text ${bgMain}`}>
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
      {/* VIEW 1: STUDY SPACE HOME (Compact, Monochrome, Clean)                  */}
      {/* ===================================================================== */}
      {viewMode === 'home' ? (
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Header without translucent scrim, blur, or gradient */}
          <header
            className={`h-13 px-3 sm:px-5 border-b flex items-center justify-between gap-2 shrink-0 ${
              isDark ? 'bg-[#09090b] border-white/[0.08]' : 'bg-[#fafafa] border-black/[0.08]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onBackToChat}
                className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-95 ${
                  isDark
                    ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.12] text-neutral-200 hover:text-white'
                    : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.12] text-neutral-800 hover:text-black'
                }`}
                title="Back to Chat"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Back</span>
              </button>
              <span className="font-semibold text-sm tracking-tight">Study Space</span>
            </div>

            {(activeVideoId || studyBundle) && (
              <button
                type="button"
                onClick={() => setViewMode('workspace')}
                className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 ${
                  isDark
                    ? 'bg-white text-black border-white hover:bg-neutral-200'
                    : 'bg-black text-white border-black hover:bg-neutral-800'
                }`}
              >
                <span>Resume Workspace</span>
              </button>
            )}
          </header>

          <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-3 space-y-4">
            {/* 3-Column Compact Ingestion: Upload, Link, Paste (Pill-shaped, Clean) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`px-3.5 py-2 rounded-full border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.2] hover:bg-[#18181c]'
                    : 'bg-white border-black/[0.08] hover:border-black/[0.2] hover:bg-neutral-50 shadow-xs'
                }`}
              >
                <div
                  className={`size-7 rounded-full flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-white/[0.06] text-neutral-200' : 'bg-black/[0.05] text-neutral-800'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold truncate">Upload</div>
                  <div className={`text-[10px] truncate ${textMuted} hidden sm:block`}>PDF, Audio</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLinkModalOpen(true)}
                className={`px-3.5 py-2 rounded-full border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.2] hover:bg-[#18181c]'
                    : 'bg-white border-black/[0.08] hover:border-black/[0.2] hover:bg-neutral-50 shadow-xs'
                }`}
              >
                <div
                  className={`size-7 rounded-full flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-white/[0.06] text-neutral-200' : 'bg-black/[0.05] text-neutral-800'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold truncate">Link</div>
                  <div className={`text-[10px] truncate ${textMuted} hidden sm:block`}>YouTube, Web</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPasteModalOpen(true)}
                className={`px-3.5 py-2 rounded-full border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.2] hover:bg-[#18181c]'
                    : 'bg-white border-black/[0.08] hover:border-black/[0.2] hover:bg-neutral-50 shadow-xs'
                }`}
              >
                <div
                  className={`size-7 rounded-full flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-white/[0.06] text-neutral-200' : 'bg-black/[0.05] text-neutral-800'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold truncate">Paste</div>
                  <div className={`text-[10px] truncate ${textMuted} hidden sm:block`}>Text notes</div>
                </div>
              </button>
            </div>

            {/* Topic / Question / YouTube URL Input Bar (Compact) */}
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
              className={`flex items-center justify-between gap-2 p-1.5 pl-3.5 sm:p-2 sm:pl-4 rounded-full border transition-all ${
                isDark
                  ? 'bg-[#121215] border-white/[0.1] focus-within:border-white/[0.25]'
                  : 'bg-white border-black/[0.1] focus-within:border-black/[0.25]'
              }`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Search className="w-4 h-4 opacity-40 shrink-0" />
                <input
                  type="text"
                  value={homePromptDraft}
                  onChange={(e) => setHomePromptDraft(e.target.value)}
                  placeholder="Ask a question, enter a topic, or paste a YouTube link..."
                  className="w-full bg-transparent border-0 text-xs sm:text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <button
                type="submit"
                disabled={!homePromptDraft.trim()}
                className={`size-8 sm:size-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  !homePromptDraft.trim()
                    ? 'opacity-30 cursor-not-allowed bg-neutral-500/20 text-neutral-400'
                    : isDark
                    ? 'bg-white text-black hover:bg-neutral-200 active:scale-95'
                    : 'bg-black text-white hover:bg-neutral-800 active:scale-95'
                }`}
                title="Start learning"
              >
                <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </form>

            {/* Saved Spaces Section */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-semibold tracking-tight">Spaces</h2>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-500/10 text-muted-foreground">
                    {spaces.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSpacesSort((s) => (s === 'Newest' ? 'Oldest' : 'Newest'))}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium ${textMuted} hover:opacity-100 cursor-pointer`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{spacesSort}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </div>

              <div className="space-y-1.5">
                {[...spaces]
                  .sort((a, b) =>
                    spacesSort === 'Newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
                  )
                  .map((sp) => {
                    const isYt = sp.sourceType === 'youtube';
                    const isPdf = sp.sourceType === 'pdf';
                    return (
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
                        className={`group px-3 py-2.5 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                          isDark
                            ? 'bg-[#121215] border-white/[0.07] hover:border-white/[0.18] hover:bg-[#16161a]'
                            : 'bg-white border-black/[0.07] hover:border-black/[0.18] hover:bg-neutral-50 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`size-7 rounded-full flex items-center justify-center shrink-0 ${
                              isDark ? 'bg-white/[0.06] text-neutral-300' : 'bg-black/[0.05] text-neutral-700'
                            }`}
                          >
                            {isYt ? (
                              <Video className="w-3.5 h-3.5" />
                            ) : isPdf ? (
                              <FileText className="w-3.5 h-3.5" />
                            ) : (
                              <BookOpen className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {sp.name}
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border border-black/8 dark:border-white/8 shrink-0 ${textMuted}`}>
                            {isYt ? 'YouTube' : isPdf ? 'PDF' : 'Topic'}
                          </span>
                        </div>

                        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSpaceMenuId((prev) => (prev === sp.id ? null : sp.id))
                            }
                            className={`size-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                              isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-black/[0.06]'
                            }`}
                            title="Space options"
                          >
                            <MoreVertical className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
                          </button>

                          {openSpaceMenuId === sp.id && (
                            <div
                              className={`absolute right-0 top-full mt-1 w-32 rounded-xl border p-1 z-30 shadow-xl ${
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
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs text-left flex items-center gap-2 hover:bg-red-500/10 text-red-500 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                    aria-label="Close import modal"
                    title="Close import modal"
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
                    aria-label="Close paste notes modal"
                    title="Close paste notes modal"
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
          {/* Top Header — Clean, Consistent Pill Control Row without Crushed Title */}
          <header
            className={`h-13 px-3 sm:px-5 border-b flex items-center justify-between gap-2 shrink-0 ${
              isDark ? 'bg-[#09090b] border-white/[0.08]' : 'bg-[#fafafa] border-black/[0.08]'
            }`}
          >
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onBackToChat}
                className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-95 ${
                  isDark
                    ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.12] text-neutral-200 hover:text-white'
                    : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.12] text-neutral-800 hover:text-black'
                }`}
                title="Back to Chat"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Back</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(activeVideoId || pdfUrl || rawSourceText) && (
                <button
                  type="button"
                  onClick={() => setShowSourceViewer((prev) => !prev)}
                  aria-label={
                    showSourceViewer
                      ? activeVideoId
                        ? 'Hide Video'
                        : 'Hide Source'
                      : activeVideoId
                      ? 'Show Video Player'
                      : 'Show Source'
                  }
                  className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    showSourceViewer
                      ? isDark
                        ? 'bg-white text-black border-white'
                        : 'bg-black text-white border-black'
                      : isDark
                      ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.12] text-neutral-200'
                      : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.12] text-neutral-800'
                  }`}
                >
                  <Video className="w-3.5 h-3.5 shrink-0" />
                  <span className="inline">
                    {showSourceViewer
                      ? activeVideoId
                        ? 'Hide Video'
                        : 'Hide Source'
                      : activeVideoId
                      ? 'Show Video'
                      : 'Show Source'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setViewMode('home')}
                className={`h-9 min-h-[44px] sm:min-h-0 sm:h-8 px-3.5 rounded-full border text-xs font-medium hidden sm:inline-flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap ${
                  isDark
                    ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.12] text-neutral-200'
                    : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.12] text-neutral-800'
                }`}
              >
                New Topic
              </button>

              {/* Save to Vault Button (YouTube Study / Lecture / Quiz / Flashcards) */}
              <button
                type="button"
                onClick={() =>
                  handleSaveStudyResultToVault(
                    activeTabObj?.type === 'quiz'
                      ? 'quiz'
                      : activeTabObj?.type === 'flashcards'
                      ? 'flashcard_deck'
                      : 'lecture'
                  )
                }
                data-testid="study-save-to-vault-btn"
                className={`h-8 px-3.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  savedStudyVaultId
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : isGuestStudyUser
                    ? isDark
                      ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.15] text-neutral-300'
                      : 'bg-black/[0.04] hover:bg-black/[0.08] border-black/[0.15] text-neutral-800'
                    : 'bg-[#FC4C01] hover:bg-[#e04300] border-[#FC4C01] text-white shadow-[0_0_16px_rgba(252,76,1,0.3)]'
                }`}
                title={
                  isGuestStudyUser
                    ? 'Sign in to save this study output to your Vault'
                    : 'Save lecture, transcript, chapters, quiz & flashcards to your Vault'
                }
              >
                <Bookmark className={`w-3.5 h-3.5 shrink-0 ${savedStudyVaultId ? 'fill-current' : ''}`} />
                <span>
                  {isGuestStudyUser
                    ? 'Sign in to save'
                    : sageStudyOrganizing
                    ? 'Sage organizing…'
                    : savedStudyVaultId
                    ? 'Saved ✓'
                    : 'Save to Vault'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportStudyPack}
                className={`size-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:size-8 rounded-full border hidden sm:inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  isDark
                    ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.12] text-neutral-200'
                    : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.12] text-neutral-800'
                }`}
                title="Export Notes (.md)"
                aria-label="Export Notes"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTopMoreMenuOpen((p) => !p)}
                  aria-label="More study options"
                  title="More options"
                  className={`size-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:size-8 rounded-full border inline-flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    isDark
                      ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.12] text-neutral-200'
                      : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.12] text-neutral-800'
                  }`}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {topMoreMenuOpen && (
                  <div
                    className={`absolute right-0 top-full mt-1.5 w-48 rounded-xl border p-1.5 z-40 shadow-2xl ${
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
                      className="w-full sm:hidden px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-current/5 cursor-pointer"
                    >
                      <span>New Topic</span>
                      <Plus className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTopMoreMenuOpen(false);
                        setViewMode('home');
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-current/5 cursor-pointer"
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
                      className="w-full px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 hover:bg-current/5 cursor-pointer"
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
                      className="w-full px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 hover:bg-current/5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Notes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTopMoreMenuOpen(false);
                        window.dispatchEvent(
                          new CustomEvent('kinich-open-report', {
                            detail: {
                              targetType: 'study_set',
                              targetId: activeVideoId || resolvedTitle,
                              contentPreview: `${resolvedTitle} (${sourceType})`,
                            },
                          })
                        );
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 hover:bg-current/5 cursor-pointer text-neutral-500 dark:text-neutral-400"
                    >
                      <span>Report Issue</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Sage Agent Organization & Linked Lectures Banner */}
          {showSageBanner && (sageStudyOrganizing || sageStudyCard || sageStatusText) && (
            <div
              data-testid="study-sage-banner"
              className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs transition-all ${
                isDark
                  ? 'bg-[#121215] border-[#FC4C01]/20 text-neutral-200'
                  : 'bg-[#fffaf7] border-[#FC4C01]/20 text-neutral-900'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FC4C01]/10 text-[#FC4C01] font-semibold text-[11px] border border-[#FC4C01]/25">
                  <Sparkles className="w-3 h-3" />
                  Sage
                </span>
                {sageStudyOrganizing ? (
                  <span className="text-neutral-400">
                    {sageStatusText || 'Assigning Subject, Chapter, tags, and linking related Vault lectures…'}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#FC4C01]">
                      <FolderOpen className="w-3.5 h-3.5" />
                      {sageStatusText || (sageStudyCard ? `${sageStudyCard.subject} → ${sageStudyCard.chapter}` : 'Saved ✓')}
                    </span>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('kinich-open-vault'))}
                      className="text-[11px] text-[#FC4C01] hover:underline font-medium cursor-pointer"
                    >
                      View in Vault →
                    </button>
                    {sageStudyCard?.content && <span className="opacity-80 text-[11px] hidden md:inline">{sageStudyCard.content}</span>}
                  </div>
                )}
              </div>
              {sageStudyCard && Array.isArray(sageStudyCard.linkedItems) && sageStudyCard.linkedItems.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FC4C01]">
                    <Link2 className="w-3 h-3" />
                    Linked:
                  </span>
                  {sageStudyCard.linkedItems.map((li) => (
                    <span
                      key={li.id}
                      className={`px-2.5 py-0.5 rounded-full border text-[11px] ${
                        isDark
                          ? 'bg-white/[0.04] border-white/10 text-neutral-200'
                          : 'bg-black/[0.04] border-black/10 text-neutral-800'
                      }`}
                    >
                      {li.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

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
                      ref={ytIframeRef}
                      key={activeVideoId}
                      src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`}
                      onLoad={() => {
                        if (seekSeconds > 0) {
                          try {
                            ytIframeRef.current?.contentWindow?.postMessage(
                              JSON.stringify({
                                event: 'command',
                                func: 'seekTo',
                                args: [seekSeconds, true],
                              }),
                              '*'
                            );
                          } catch {}
                        }
                      }}
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

          {/* Workspace Navigation Tabs (Pill style) */}
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
                  className={`h-8 inline-flex items-center gap-2 px-3.5 rounded-full border text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? isDark
                        ? 'bg-white text-black border-white font-semibold shadow-xs'
                        : 'bg-black text-white border-black font-semibold shadow-xs'
                      : isDark
                      ? 'border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                      : 'border-black/10 text-neutral-600 hover:text-black hover:bg-black/[0.05]'
                  }`}
                >
                  <span className="max-w-[150px] truncate">{tab.title}</span>
                  {openTabs.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => closeTab(tab.id, e)}
                      aria-label={`Close ${tab.title} tab`}
                      title={`Close ${tab.title} tab`}
                      className="size-4 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/20 p-0.5 cursor-pointer"
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
                className={`h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full border border-black/10 dark:border-white/10 text-xs font-medium transition-colors cursor-pointer shrink-0 ${
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
              className={`size-8 inline-flex items-center justify-center rounded-full border text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.12] text-neutral-300'
                  : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.12] text-neutral-700'
              }`}
              title="Open Study Tools"
              aria-label="Open Study Tools"
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
                  aria-label="Close audio summary player"
                  title="Close audio summary player"
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
              <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div
                  className={`rounded-2xl border p-5 space-y-4 ${
                    isDark ? 'bg-[#121215] border-white/[0.1]' : 'bg-white border-black/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <ThinkingOrb state="searching" size={20} />
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>
                            {segments.length > 0
                              ? loadingStageText
                              : 'Fetching full transcript from YouTube...'}
                          </span>
                        </div>
                        <div className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          Deep knowledge processing and chapter decomposition in progress
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {formatTime(loadingElapsedSec)} elapsed
                    </span>
                  </div>

                  {/* Step Progress Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {[
                      { label: '1. Transcript', done: segments.length > 0, active: segments.length === 0 },
                      { label: '2. Summary & Sections', done: false, active: segments.length > 0 && loadingElapsedSec < 12 },
                      { label: '3. Grounded Quiz', done: false, active: segments.length > 0 && loadingElapsedSec >= 12 && loadingElapsedSec < 24 },
                      { label: '4. Flashcards', done: false, active: segments.length > 0 && loadingElapsedSec >= 24 },
                    ].map((st) => (
                      <div
                        key={st.label}
                        className={`px-3 py-2 rounded-xl border font-medium flex items-center gap-1.5 ${
                          st.done
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : st.active
                            ? isDark
                              ? 'border-white/25 bg-white/[0.07] text-white'
                              : 'border-black/25 bg-black/[0.06] text-black'
                            : isDark
                            ? 'border-white/[0.06] text-neutral-500'
                            : 'border-black/[0.06] text-neutral-400'
                        }`}
                      >
                        {st.done ? <Check className="w-3.5 h-3.5 shrink-0" /> : st.active ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : null}
                        <span className="truncate">{st.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stream in Transcript immediately while AI finishes generating chapters/quiz */}
                {segments.length > 0 ? (
                  <div
                    className={`rounded-2xl border p-5 space-y-3 ${
                      isDark ? 'bg-[#121215] border-white/[0.08]' : 'bg-white border-black/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                        Live Transcript Ready ({segments.length} sections) — Click any timestamp to seek video
                      </span>
                    </div>
                    <div className="space-y-2.5 overflow-visible">
                      {segments.slice(0, 6).map((seg, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-3 overflow-visible ${
                            isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-black/[0.02] border-black/[0.06]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleJumpToTimestamp(seg.start_s)}
                            className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 shrink-0 cursor-pointer"
                          >
                            {formatTime(seg.start_s)}
                          </button>
                          <p className={`flex-1 break-words ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className={`h-28 rounded-2xl animate-pulse ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />
                    <div className={`h-44 rounded-2xl animate-pulse ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'}`} />
                  </div>
                )}
              </div>
            ) : studyError ? (
              <div className="max-w-md mx-auto my-12 p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-center space-y-4">
                <div className="text-red-400 font-semibold text-sm">Failed to Generate Study Materials</div>
                <p className="text-xs text-neutral-400 leading-relaxed">{studyError}</p>
                <button
                  type="button"
                  onClick={() => {
                    const resolvedId =
                      extractYouTubeIdFromInput(activeVideoId || initialId || '') ||
                      (activeVideoId || initialId || '').trim();
                    if (sourceType === 'youtube' && resolvedId) {
                      console.log('[StudyWorkspace] Retry Generation for videoId:', resolvedId);
                      loadYouTubeSource(resolvedId, resolvedTitle, resolvedAuthor);
                    } else if (sourceType === 'topic') {
                      loadTopicStudySpace(resolvedTitle);
                    } else if (sourceType === 'pdf') {
                      loadTextOrPdfSource(resolvedTitle, rawSourceText, 'pdf', pdfUrl);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition cursor-pointer min-h-[44px]"
                >
                  Retry Generation
                </button>
                {sourceType === 'youtube' && activeVideoId && (
                  <div className="pt-4 border-t border-red-500/10 space-y-2 text-left">
                    <label className="text-xs font-medium text-neutral-400">Or paste the video transcript</label>
                    <textarea
                      rows={5}
                      value={pasteTranscriptVal}
                      onChange={(e) => setPasteTranscriptVal(e.target.value)}
                      placeholder="Paste the transcript here (timestamps optional)..."
                      className={`w-full p-3 rounded-xl border text-xs outline-none resize-y ${isDark ? 'bg-[#09090b] border-white/[0.12] text-white' : 'bg-[#f8f8f9] border-black/[0.12] text-black'}`}
                    />
                    <button
                      type="button"
                      onClick={() => applyPastedTranscript(pasteTranscriptVal)}
                      disabled={!pasteTranscriptVal.trim()}
                      className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Use pasted transcript
                    </button>
                  </div>
                )}
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
                    aria-label="Close lesson module view"
                    title="Close lesson module view"
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
                          {
                            id: 'transcripts',
                            label: 'Transcript',
                            sub: `${segments.length} paragraphs`,
                            icon: ListTree,
                            onClick: () => openOrFocusTab('transcripts', 'Transcript'),
                          },
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
                          {
                            id: 'map',
                            label: 'Location & Map',
                            sub: 'Campus, labs & sites',
                            icon: MapPin,
                            onClick: () => {
                              if (!mapLocationQuery) {
                                setMapLocationQuery(resolvedTitle || 'Boston Public Garden');
                              }
                              openOrFocusTab('map', 'Location Map');
                            },
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
                                className={`size-9 rounded-full flex items-center justify-center shrink-0 ${iconBoxClass}`}
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
                                  className={`flex-1 py-1.5 px-3 rounded-full border text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${borderSubtle}`}
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
                                    className={`flex-1 py-1.5 px-3 rounded-full text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer ${
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
                                    className={`size-9 rounded-full flex items-center justify-center shrink-0 ${iconBoxClass}`}
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
                                    className="p-1.5 rounded-full opacity-60 hover:opacity-100 cursor-pointer"
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
                        className={`max-w-2xl mx-auto pointer-events-auto flex items-center justify-between gap-2 pl-4 pr-2 py-2 rounded-full border shadow-lg ${
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
                          className={`size-9 rounded-full flex items-center justify-center cursor-pointer shrink-0 ${
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
                {activeTabObj?.type === 'summary' && studyBundle && isReadingMode && (
                  <div className="w-full pb-20">
                    {/* Floating / Sticky Reading Mode Controls Bar */}
                    <div
                      className={`sticky top-0 z-20 backdrop-blur-md border-b ${borderSubtle} py-3 px-4 sm:px-6 mb-8 ${
                        isDark ? 'bg-[#09090b]/90 shadow-lg shadow-black/20' : 'bg-[#fafafa]/90 shadow-sm'
                      }`}
                    >
                      <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
                        {/* Badge and Reading Stats */}
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Reading Mode</span>
                          </span>
                          <span className={`text-xs ${textMuted} hidden sm:inline`}>
                            {summaryEstimatedReadingMinutes} min read • {summaryWordCount} words
                          </span>
                        </div>

                        {/* Typography Tooling */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {/* Font Family Selector */}
                          <div
                            className={`flex items-center p-0.5 rounded-full border ${borderSubtle} ${bgCard}`}
                            title="Font Family"
                          >
                            {(['sans', 'serif', 'mono'] as const).map((ff) => (
                              <button
                                key={ff}
                                type="button"
                                onClick={() => setReadingFontFamily(ff)}
                                className={`px-2.5 py-0.5 rounded-full capitalize font-medium text-xs cursor-pointer transition-all ${
                                  readingFontFamily === ff
                                    ? isDark
                                      ? 'bg-neutral-800 text-white shadow-xs'
                                      : 'bg-neutral-200 text-black shadow-xs'
                                    : textMuted
                                }`}
                              >
                                {ff}
                              </button>
                            ))}
                          </div>

                          {/* Font Size Selector */}
                          <div
                            className={`flex items-center p-0.5 rounded-full border ${borderSubtle} ${bgCard}`}
                            title="Font Size"
                          >
                            <span className={`px-2 text-[11px] font-semibold ${textMuted}`}>Size</span>
                            {(['sm', 'base', 'lg', 'xl'] as const).map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => setReadingFontSize(sz)}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                  readingFontSize === sz
                                    ? isDark
                                      ? 'bg-neutral-800 text-white shadow-xs'
                                      : 'bg-neutral-200 text-black shadow-xs'
                                    : textMuted
                                }`}
                              >
                                {sz === 'sm' ? 'S' : sz === 'base' ? 'M' : sz === 'lg' ? 'L' : 'XL'}
                              </button>
                            ))}
                          </div>

                          {/* Line Height Selector */}
                          <div
                            className={`flex items-center p-0.5 rounded-full border ${borderSubtle} ${bgCard}`}
                            title="Line Spacing"
                          >
                            <span className={`px-2 text-[11px] font-semibold ${textMuted}`}>Line</span>
                            {(['compact', 'normal', 'relaxed', 'spacious'] as const).map((lh) => (
                              <button
                                key={lh}
                                type="button"
                                onClick={() => setReadingLineHeight(lh)}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-all ${
                                  readingLineHeight === lh
                                    ? isDark
                                      ? 'bg-neutral-800 text-white shadow-xs'
                                      : 'bg-neutral-200 text-black shadow-xs'
                                    : textMuted
                                }`}
                              >
                                {lh === 'compact' ? '1.5' : lh === 'normal' ? '1.75' : lh === 'relaxed' ? '2.0' : '2.3'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Exit Button */}
                        <button
                          type="button"
                          onClick={() => setIsReadingMode(false)}
                          className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-colors ${borderSubtle}`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Exit Reading</span>
                        </button>
                      </div>
                    </div>

                    {/* Distraction-Free Typography Layout */}
                    <div
                      className={`max-w-2xl sm:max-w-3xl mx-auto px-5 sm:px-8 space-y-10 transition-all ${readingFontFamilyClass}`}
                    >
                      {/* Document Header */}
                      <header className="space-y-3 pb-8 border-b border-dashed border-neutral-300 dark:border-neutral-800">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="uppercase tracking-wider font-semibold text-amber-500">
                            Study Guide & Synopsis
                          </span>
                          <span className={textMuted}>•</span>
                          <span className={textMuted}>{summaryEstimatedReadingMinutes} min read</span>
                          <span className={textMuted}>•</span>
                          <span className={textMuted}>{summaryWordCount} words</span>
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
                          {resolvedTitle}
                        </h1>
                      </header>

                      {/* Lead Overview */}
                      <section className="space-y-3">
                        <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                          Overview
                        </div>
                        <p
                          className={`${readingSizeClass} ${readingLhClass} first-letter:text-4xl first-letter:font-extrabold first-letter:mr-2 first-letter:float-left first-letter:leading-none text-neutral-900 dark:text-neutral-100`}
                        >
                          {studyBundle.summary.overview}
                        </p>
                      </section>

                      {/* In-Depth Guide if present */}
                      {aiExhaustiveSummary && (
                        <section className="space-y-4 pt-6 border-t border-neutral-200 dark:border-neutral-800/80">
                          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                            Comprehensive Synthesis
                          </div>
                          <div className={`${readingSizeClass} ${readingLhClass} space-y-4`}>
                            <MathMarkdown content={aiExhaustiveSummary} isDark={isDark} />
                          </div>
                        </section>
                      )}

                      {/* Statement Breakdown / Sections */}
                      {statementBreakdown.length > 0 && (
                        <section className="space-y-6 pt-6 border-t border-neutral-200 dark:border-neutral-800/80">
                          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                            Detailed Key Points
                          </div>
                          <div className="space-y-6">
                            {statementBreakdown.map((st, sIdx) => (
                              <article
                                key={st.index ?? sIdx}
                                className="space-y-2.5 pb-6 border-b border-neutral-200/60 dark:border-neutral-800/50 last:border-0"
                              >
                                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                                  {st.heading}
                                </h3>
                                {st.claim && st.claim !== st.elaboration && (
                                  <div
                                    className={`font-semibold ${readingSizeClass} text-neutral-800 dark:text-neutral-200`}
                                  >
                                    {st.claim}
                                  </div>
                                )}
                                <p className={`${readingSizeClass} ${readingLhClass} ${textMuted}`}>
                                  {st.elaboration}
                                </p>
                              </article>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Key Concepts / Terms */}
                      {studyBundle.explanation.concepts.length > 0 && (
                        <section className="space-y-4 pt-6 border-t border-neutral-200 dark:border-neutral-800/80">
                          <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                            Core Terminology & Concepts
                          </div>
                          <dl className="space-y-4">
                            {studyBundle.explanation.concepts.map((concept, cIdx) => (
                              <div
                                key={cIdx}
                                className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 space-y-1.5"
                              >
                                <dt className="font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-100">
                                  {concept.term}
                                </dt>
                                <dd className={`${readingSizeClass} ${readingLhClass} text-neutral-700 dark:text-neutral-300`}>
                                  {concept.definition}
                                </dd>
                                {concept.mechanism && concept.mechanism !== concept.definition && (
                                  <dd className={`text-xs italic ${textMuted} pt-1`}>
                                    Mechanism: {concept.mechanism}
                                  </dd>
                                )}
                              </div>
                            ))}
                          </dl>
                        </section>
                      )}

                      {/* Elite Follow-Up Assistant inside Reading Mode */}
                      <section className="pt-8 border-t border-neutral-300 dark:border-neutral-800">
                        {renderSummaryFollowUpSection()}
                      </section>

                      {/* Reading Mode Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-dashed border-neutral-300 dark:border-neutral-800">
                        <span className={`text-xs ${textMuted}`}>
                          Finished reading "{resolvedTitle}"
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsReadingMode(false)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${borderSubtle}`}
                          >
                            Exit Reading Mode
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsReadingMode(false);
                              openOrFocusTab('quiz', 'Quiz');
                            }}
                            className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                              isDark ? 'bg-white text-black' : 'bg-black text-white'
                            }`}
                          >
                            <span>Take Quiz</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTabObj?.type === 'summary' && studyBundle && !isReadingMode && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-4 space-y-5">
                    {/* Header & Actions */}
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 pb-4 border-b ${borderSubtle}`}
                    >
                      <h2 className="text-base sm:text-lg font-semibold tracking-tight">
                        {resolvedTitle}
                      </h2>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsReadingMode(true)}
                          className={`h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full border text-xs font-medium cursor-pointer transition-colors ${
                            isDark
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          }`}
                          title="Transform summary into clean, distraction-free reading typography"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Reading Mode</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleToggleListenSummary}
                          className={`h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
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
                          className={`h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>{isEditingSummary ? 'Done' : 'Edit'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleExportStudyPack}
                          className={`h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle}`}
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
                        className={`w-full p-4 rounded-xl border text-sm leading-relaxed outline-none ${bgCard}`}
                      />
                    ) : (
                      <div className="space-y-6">
                        {/* Overview */}
                        <section className="space-y-2.5">
                          <h3 className="text-sm font-semibold">Overview</h3>
                          <p className="text-sm sm:text-[15px] leading-relaxed">
                            {studyBundle.summary.overview}
                          </p>
                        </section>

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

                        {/* Elite Follow-Up Assistant inside Summary */}
                        {renderSummaryFollowUpSection()}

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

                    <div className="pt-1 flex items-start justify-between gap-3">
                      <h2 className="text-sm sm:text-base font-medium leading-relaxed flex-1">
                        {currentQuizItem.question}
                      </h2>
                      {(currentQuizItem.timestamp_s !== undefined || currentQuizItem.timestamp !== undefined) && (
                        <button
                          type="button"
                          onClick={() =>
                            handleJumpToTimestamp(
                              currentQuizItem.timestamp_s ?? currentQuizItem.timestamp ?? 0
                            )
                          }
                          className={`shrink-0 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium inline-flex items-center gap-1 cursor-pointer transition-colors ${
                            isDark
                              ? 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                              : 'bg-black/5 hover:bg-black/10 border-black/10 text-neutral-700'
                          }`}
                          title="Jump to video timestamp"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>
                            {formatTime(
                              currentQuizItem.timestamp_s ?? currentQuizItem.timestamp ?? 0
                            )}
                          </span>
                        </button>
                      )}
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
                        className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed space-y-2 ${bgCard}`}
                      >
                        <div className="font-semibold">
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
                        {currentQuizItem.sourceQuote && (
                          <div
                            className={`pt-2 border-t text-xs italic ${borderSubtle} ${textMuted}`}
                          >
                            <span className="font-semibold not-italic block mb-0.5 opacity-75">
                              Transcript Quote:
                            </span>
                            &ldquo;{currentQuizItem.sourceQuote}&rdquo;
                          </div>
                        )}
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
                        className={`h-9 px-4 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
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
                          className={`h-9 px-4 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${borderSubtle}`}
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
                          className={`h-9 px-4 rounded-full border text-xs font-medium transition-colors cursor-pointer ${borderSubtle}`}
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
                        className={`h-9 px-4 rounded-full border text-xs font-medium inline-flex items-center gap-1 disabled:opacity-35 cursor-pointer ${borderSubtle}`}
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
                        className={`h-9 px-4 rounded-full border text-xs font-medium inline-flex items-center gap-1 cursor-pointer ${borderSubtle}`}
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
                        className={`inline-flex items-center p-0.5 rounded-full border ${
                          isDark ? 'bg-[#121215] border-white/[0.08]' : 'bg-[#f4f4f5] border-black/[0.08]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setFlashcardMode('spaced')}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                            flashcardMode === 'spaced'
                              ? isDark
                                ? 'bg-white text-black font-semibold'
                                : 'bg-white text-black shadow-xs font-semibold'
                              : textMuted
                          }`}
                        >
                          Edit Cards
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlashcardMode('fast')}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                            flashcardMode === 'fast'
                              ? isDark
                                ? 'bg-white text-black font-semibold'
                                : 'bg-white text-black shadow-xs font-semibold'
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
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowCardHint((h) => !h)}
                                    className="p-2 rounded-lg opacity-65 hover:opacity-100 cursor-pointer"
                                    title="Show hint"
                                  >
                                    <Lightbulb className="w-4 h-4" />
                                  </button>
                                  {(customFlashcards[cardIndex].timestamp_s !== undefined ||
                                    customFlashcards[cardIndex].timestamp !== undefined) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleJumpToTimestamp(
                                          customFlashcards[cardIndex].timestamp_s ??
                                            customFlashcards[cardIndex].timestamp ??
                                            0
                                        )
                                      }
                                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-medium inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                        isDark
                                          ? 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                                          : 'bg-black/5 hover:bg-black/10 border-black/10 text-neutral-700'
                                      }`}
                                      title="Jump to video timestamp"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" />
                                      <span>
                                        {formatTime(
                                          customFlashcards[cardIndex].timestamp_s ??
                                            customFlashcards[cardIndex].timestamp ??
                                            0
                                        )}
                                      </span>
                                    </button>
                                  )}
                                </div>

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
                                className={`size-9 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer ${borderSubtle}`}
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
                                className={`size-9 rounded-full border flex items-center justify-center disabled:opacity-35 cursor-pointer ${borderSubtle}`}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-center justify-center gap-4 pt-1">
                              <button
                                type="button"
                                onClick={() => setFlashcardMode('spaced')}
                                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium cursor-pointer ${borderSubtle} ${textMuted} hover:opacity-100 transition-colors`}
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
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs ${textMuted}`}>
                                      Card {idx + 1}
                                    </span>
                                    {(fc.timestamp_s !== undefined || fc.timestamp !== undefined) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleJumpToTimestamp(
                                            fc.timestamp_s ?? fc.timestamp ?? 0
                                          )
                                        }
                                        className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium inline-flex items-center gap-1 cursor-pointer transition-colors ${
                                          isDark
                                            ? 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300'
                                            : 'bg-black/5 hover:bg-black/10 border-black/10 text-neutral-700'
                                        }`}
                                        title="Jump to video timestamp"
                                      >
                                        <Play className="w-2 h-2 fill-current" />
                                        <span>
                                          {formatTime(
                                            fc.timestamp_s ?? fc.timestamp ?? 0
                                          )}
                                        </span>
                                      </button>
                                    )}
                                  </div>
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
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-8">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-semibold">Transcript</h2>
                        {import.meta.env.DEV && transcriptProvider && (
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.05]'}`} title="Transcript provider">
                            {transcriptProvider === 'youtube-transcript-npm' ? 'phone' : transcriptProvider}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setLangDropdownOpen((o) => !o)}
                            className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-2 cursor-pointer transition-colors ${borderSubtle}`}
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
                          onClick={handleCopyFormattedTranscript}
                          disabled={activeTranscriptList.length === 0}
                          className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                            copiedTranscript
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-semibold'
                              : borderSubtle
                          }`}
                          title="Copy formatted transcript with timestamps to clipboard"
                          aria-label="Copy transcript"
                        >
                          {copiedTranscript ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedTranscript ? 'Transcript Copied!' : 'Copy Transcript'}</span>
                        </button>
                      </div>
                    </div>

                    {translatingLang ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className={`h-24 rounded-2xl animate-pulse ${bgSubtle}`}
                          />
                        ))}
                      </div>
                    ) : activeTranscriptList.length === 0 ? (
                      <div className={`p-6 sm:p-8 rounded-2xl border text-center space-y-4 ${bgCard}`}>
                        <div className="w-12 h-12 mx-auto rounded-full bg-neutral-500/10 text-neutral-400 flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm sm:text-base font-semibold">No Official Captions Available</h3>
                          <p className="text-xs text-neutral-400 max-w-md mx-auto">
                            YouTube has no public closed-caption tracks for this video. We do not invent synthetic timestamps or fake spoken words.
                          </p>
                        </div>
                        <div className="max-w-lg mx-auto pt-2 space-y-2">
                          <textarea
                            rows={4}
                            value={pastedTranscriptText}
                            onChange={(e) => setPastedTranscriptText(e.target.value)}
                            placeholder="Paste real transcript or lecture notes here to view with timecodes..."
                            className={`w-full p-3 rounded-xl border text-xs sm:text-sm outline-none resize-y ${bgSubtle}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!pastedTranscriptText.trim()) return;
                              const lines = pastedTranscriptText
                                .split(/\n+/)
                                .map((l) => l.trim())
                                .filter(Boolean);
                              const parsed: YouTubeTranscriptSegment[] = lines.map((line, idx) => {
                                const timeMatch = line.match(/^\[?(\d{1,2}):(\d{2})\]?\s*(.*)$/);
                                if (timeMatch) {
                                  const mins = parseInt(timeMatch[1], 10);
                                  const secs = parseInt(timeMatch[2], 10);
                                  return {
                                    start_s: mins * 60 + secs,
                                    duration_s: 15,
                                    text: timeMatch[3] || line,
                                  };
                                }
                                return {
                                  start_s: idx * 25,
                                  duration_s: 25,
                                  text: line,
                                };
                              });
                              setSegments(parsed);
                              setPastedTranscriptText('');
                            }}
                            disabled={!pastedTranscriptText.trim()}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium cursor-pointer transition-colors"
                          >
                            Load Transcript
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pb-4 overflow-visible">
                        {activeTranscriptList.map((seg, idx) => {
                          const nextSeg = activeTranscriptList[idx + 1];
                          const segDuration =
                            seg.duration_s && seg.duration_s > 0
                              ? seg.duration_s
                              : nextSeg
                              ? Math.max(3, nextSeg.start_s - seg.start_s)
                              : 8;
                          const sentenceItems = splitSegmentIntoSentences(seg.text);
                          const totalChars = Math.max(1, seg.text.length);

                          const triggerJump = (sec: number) => {
                            handleJumpToTimestamp(sec);
                            setActiveJumpTimestamp(sec);
                            setTimeout(() => setActiveJumpTimestamp(null), 2500);
                          };

                          return (
                            <div
                              key={idx}
                              onClick={() => triggerJump(seg.start_s)}
                              className={`p-4 rounded-2xl border flex items-start gap-3.5 overflow-visible group/seg transition-all duration-200 cursor-pointer ${bgCard} hover:border-[#FC4C01]/30 hover:shadow-xs`}
                              title="Click to jump YouTube player to this segment"
                            >
                              {activeVideoId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerJump(seg.start_s);
                                  }}
                                  className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] shrink-0 cursor-pointer flex items-center gap-1 transition-all ${
                                    activeJumpTimestamp !== null &&
                                    Math.abs(activeJumpTimestamp - seg.start_s) < 2
                                      ? 'bg-[#FC4C01] text-white shadow-xs'
                                      : `${bgSubtle} hover:bg-[#FC4C01]/10 hover:text-[#FC4C01]`
                                  }`}
                                  title="Jump to timestamp in video"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current opacity-70 group-hover/seg:opacity-100" />
                                  <span>{formatTime(seg.start_s)}</span>
                                </button>
                              )}
                              <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line flex-1 select-text">
                                {sentenceItems.map((item, sIdx) => {
                                  const sentenceTime =
                                    sentenceItems.length <= 1
                                      ? seg.start_s
                                      : Math.round(
                                          seg.start_s +
                                            (item.charOffset / totalChars) * segDuration
                                        );
                                  const isJumped =
                                    activeJumpTimestamp !== null &&
                                    Math.abs(activeJumpTimestamp - sentenceTime) < 2;

                                  return (
                                    <span
                                      key={sIdx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerJump(sentenceTime);
                                      }}
                                      className={`inline cursor-pointer rounded px-1 -mx-0.5 transition-all duration-150 ${
                                        isJumped
                                          ? 'bg-[#FC4C01]/25 text-[#FC4C01] font-semibold ring-1 ring-[#FC4C01]/40'
                                          : isDark
                                          ? 'hover:bg-white/[0.08] hover:text-white hover:underline hover:decoration-[#FC4C01]/40'
                                          : 'hover:bg-black/[0.06] hover:text-black hover:underline hover:decoration-[#FC4C01]/40'
                                      }`}
                                      title={`Click sentence to jump video to ${formatTime(sentenceTime)}`}
                                    >
                                      {item.sentence}{' '}
                                    </span>
                                  );
                                })}
                              </p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateSubclip(seg.text, seg.start_s);
                                  }}
                                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 opacity-60 group-hover/seg:opacity-100 hover:bg-[#FC4C01]/15 hover:text-[#FC4C01] hover:border-[#FC4C01]/30 transition-all text-neutral-400 cursor-pointer`}
                                  title="Create Subclip (Save as Flashcard)"
                                  aria-label="Create Subclip"
                                >
                                  <Layers className="w-3.5 h-3.5 text-[#FC4C01]" />
                                  <span className="hidden sm:inline">Subclip</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopySingleSegment(seg, idx);
                                  }}
                                  className={`p-1.5 rounded-lg opacity-40 group-hover/seg:opacity-100 hover:bg-neutral-500/15 transition-all text-neutral-400 hover:text-white cursor-pointer`}
                                  title="Copy this segment with timestamp"
                                  aria-label="Copy segment"
                                >
                                  {copiedSegmentIdx === idx ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {activeTranscriptList.length > 5 && (
                          <div className="pt-3 pb-2 flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-500/10">
                            <span>{activeTranscriptList.length} transcript paragraphs</span>
                            <button
                              type="button"
                              onClick={handleCopyFormattedTranscript}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                                copiedTranscript
                                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-semibold'
                                  : borderSubtle
                              }`}
                              title="Copy formatted transcript with timestamps to clipboard"
                            >
                              {copiedTranscript ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{copiedTranscript ? 'Transcript Copied!' : 'Copy Transcript'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Subclip Toast Banner */}
                {subclipToast && (
                  <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#18181b] border border-[#FC4C01]/40 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#FC4C01]" />
                    <span className="text-xs font-semibold">{subclipToast}</span>
                    <button
                      type="button"
                      onClick={() => openOrFocusTab('flashcards', 'Flashcards')}
                      className="px-2.5 py-1 rounded-xl bg-[#FC4C01] text-white text-[11px] font-semibold hover:opacity-90 cursor-pointer ml-1"
                    >
                      View Flashcards
                    </button>
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
                        className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${borderSubtle}`}
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
                        className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${borderSubtle}`}
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
                                className={`h-8 inline-flex items-center gap-1.5 px-3.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                                  isDark
                                    ? 'bg-[#121215] border-white/10 hover:border-white/25 hover:bg-white/[0.05]'
                                    : 'bg-white border-black/10 hover:border-black/25 hover:bg-black/[0.03]'
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
                          <div className="flex items-center justify-start my-1.5">
                            <div
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm ${
                                isDark
                                  ? 'bg-[#18181b]/95 border-neutral-800 text-neutral-300'
                                  : 'bg-neutral-100/90 border-neutral-200 text-neutral-700'
                              }`}
                            >
                              <ThinkingOrb state="searching" size={20} />
                              <span>Thinking....</span>
                            </div>
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
                                className={`size-8 rounded-full border flex items-center justify-center cursor-pointer ${borderSubtle}`}
                                title="Add @Mind Map or @Flow Chart"
                              >
                                <AtSign className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setStudyModeEnabled((s) => !s)}
                                className={`px-3 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
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
                                className="size-8 rounded-full flex items-center justify-center opacity-65 hover:opacity-100 cursor-pointer"
                                title="Attach PDF or file"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSendStudyChat()}
                              className={`size-9 rounded-full flex items-center justify-center cursor-pointer ${
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

                {/* =========================================================== */}
                {/* TAB 10: LOCATION & MAP                                      */}
                {/* =========================================================== */}
                {activeTabObj?.type === 'map' && (
                  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/[0.08] dark:border-white/[0.08]">
                      <div>
                        <h2 className="text-base sm:text-lg font-semibold tracking-tight">Location & Map</h2>
                        <p className={`text-xs ${textMuted}`}>
                          Interactive location explorer for campuses, research institutes, field studies, and geography.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMapLocationQuery(resolvedTitle || 'Boston Public Garden')}
                          className={`h-8 px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${borderSubtle}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Use Study Topic</span>
                        </button>
                      </div>
                    </div>

                    {/* Location Search Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-neutral-500">Search location, campus, or institute:</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={mapLocationQuery}
                          onChange={(e) => setMapLocationQuery(e.target.value)}
                          placeholder="e.g. CERN Geneva, Stanford University, MIT Cambridge MA, IISc Bangalore..."
                          className={`w-full pl-10 pr-4 py-2.5 rounded-full border text-xs outline-none transition-colors ${
                            isDark
                              ? 'bg-[#121215] border-white/15 text-white placeholder-neutral-500 focus:border-[#FC4C01]'
                              : 'bg-white border-black/15 text-black placeholder-neutral-400 focus:border-[#FC4C01]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Preset Research & Study Hubs */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Quick Research & Study Presets</div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'CERN, Geneva, Switzerland',
                          'MIT, Cambridge, MA',
                          'Stanford University, CA',
                          'Oxford University, UK',
                          'IISc, Bangalore, India',
                          'Max Planck Institute, Germany',
                          'NASA JPL, Pasadena, CA',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setMapLocationQuery(preset)}
                            className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                              mapLocationQuery === preset
                                ? 'bg-[#FC4C01] text-white border-[#FC4C01] shadow-xs'
                                : isDark
                                ? 'border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                                : 'border-black/10 text-neutral-600 hover:text-black hover:bg-black/[0.04]'
                            }`}
                          >
                            {preset.split(',')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ViewOnMap Component Instance */}
                    <div className={`p-8 sm:p-12 rounded-3xl border text-center flex flex-col items-center justify-center gap-4 transition-all ${bgCard}`}>
                      <div className="space-y-1 text-center">
                        <div className="text-sm font-semibold">{mapLocationQuery || resolvedTitle || 'Location'}</div>
                        <div className={`text-xs ${textMuted}`}>Click the pill button below to expand the interactive live map</div>
                      </div>

                      <ViewOnMap
                        address={mapLocationQuery || resolvedTitle || 'Boston Public Garden'}
                        locationName={mapLocationQuery || resolvedTitle || 'View on Map'}
                        isDark={isDark}
                      />
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
