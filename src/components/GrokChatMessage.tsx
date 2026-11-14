import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { motion } from 'motion/react';
import {
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  ExternalLink,
  Play,
  X,
  Youtube,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  Terminal,
  Volume2,
  VolumeX,
  Loader2,
  Code2,
  FileSpreadsheet,
  Music,
  Film,
  File,
  Pin,
  BookOpen,
  ListChecks,
  Share2,
  Bookmark,
  Highlighter,
  Globe,
  Flag,
  Sparkles,
  Bot,
  Link2,
  FolderOpen,
} from 'lucide-react';
import { openKinichReportModal } from './LegalAndInfoPages';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChatMessage as ChatMessageType, YouTubeVideoInfo, FinanceQuote, KnowledgeVaultItem, AgentReplyCard } from '../types';
import { normalizeMathDelimiters } from './MathMarkdown';
import { GrokTimingTooltip } from './GrokTimingTooltip';
import { GenerativeUiViewer } from './GenerativeUiViewer';
import { ArxivPaperCard } from './ArxivPaperCard';
import { GithubRepoCard } from './GithubRepoCard';
import { PersonaWikiCard } from './PersonaWikiCard';
import type { PdfStudioTab } from './InbuiltPdfViewer';
import { FinanceTerminalCard } from './FinanceTerminalCard';
import { CodeBlockSkeleton, ModalSkeleton } from './Skeleton';

const PrismCodeBlock = lazy(() =>
  import('./PrismCodeBlock').then((m) => ({ default: m.PrismCodeBlock }))
);
const InbuiltPdfViewer = lazy(() =>
  import('./InbuiltPdfViewer').then((m) => ({ default: m.InbuiltPdfViewer }))
);
const YouTubeTranscriptModal = lazy(() =>
  import('./YouTubeTranscriptModal').then((m) => ({ default: m.YouTubeTranscriptModal }))
);
const TtsPopup = lazy(() =>
  import('./TtsPopup').then((m) => ({ default: m.TtsPopup }))
);
import {
  detectFinanceSymbolsInText,
  buildFallbackFinanceQuote,
  fetchLiveFinanceQuoteClient,
} from '../lib/financeMarket';
import { getAuthHeaders } from '../lib/firebase';
import { WebSearch, WebSearchCitation, CitationModal, WebSearchSource } from './ui/web-search';
import { LoadingBreadcrumb } from './ui/animated-loading-svg-text-shimmer';
import { ThinkingOrb } from 'thinking-orbs';
import { XPostCard } from './XPostCard';
import { extractSocialMeta, sourceToXPost } from '../lib/socialEnricher';
import {
  StreamingText,
  ReasoningSteps,
  InlineCitation,
  InlineCitationsList,
  PlanCard,
  QuestionCard,
  AgentMap,
  extractAgentMapFromContext,
  ProductCards,
  extractProductsFromContext,
  ImageGenerationCard,
  detectImageGenerationIntent,
  WeatherCard,
  detectWeatherLocationInQuery,
} from './kobra';
const PeleDiagram = lazy(() =>
  import('./PeleDiagram').then((m) => ({ default: m.PeleDiagram }))
);
import { UserAccountStore } from '../lib/userAccountStore';
import { KnowledgeVaultStore } from '../lib/growthStore';
import { extractYouTubeIdFromInput } from '../lib/youtube';
import { ModelOption } from './GrokModelPicker';

interface GrokChatMessageProps {
  message: ChatMessageType;
  threadId?: string;
  threadTitle?: string;
  onRetry?: (modelOverride?: ModelOption) => void;
  onEdit?: (content: string) => void;
  onAskKinich?: (prompt: string) => void;
  onOpenShareStudio?: (
    message: ChatMessageType,
    tab?: 'share' | 'export' | 'quote' | 'publish'
  ) => void;
  onOpenKnowledgeVault?: () => void;
  theme?: 'dark' | 'light';
  nsfwMode?: boolean;
}

const MESSAGE_HEIGHT_TRANSITION = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

const isAdultUrl = (url?: string): boolean => {
  if (!url) return false;
  return (
    /\b(pornhub|xvideos|xnxx|xhamster|spankbang|eporner|youporn|motherless|redgifs|chaturbate|stripchat|cam4|onlyfans|fansly|beeg|tube8|tnaflix|drtuber|daftsex|xcafe|livejasmin|bongacams|brazzers|bangbros|naughtyamerica|realitykings|javlibrary|nhentai|hanime|fapelo|rule34)\b/i.test(
      url
    ) || /\.(xxx|porn|adult|sex|sexy)(\/|$)/i.test(url)
  );
};

// Client-side helper to convert any video webpage URL into an embeddable player URL
function getUniversalClientEmbedUrl(url?: string, ytId?: string, existingEmbed?: string): string {
  if (url && isAdultUrl(url)) {
    return '';
  }
  if (ytId) {
    return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }
  if (existingEmbed && !existingEmbed.startsWith('/api/media/embed-proxy')) {
    return existingEmbed;
  }
  if (!url) return existingEmbed || '';

  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }

  let m: RegExpMatchArray | null;
  if ((m = url.match(/vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/|video\/)?(\d+)/i))) {
    return `https://player.vimeo.com/video/${m[1]}?autoplay=1`;
  }
  if ((m = url.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/i))) {
    return `https://geo.dailymotion.com/player.html?video=${m[1]}&autoplay=1`;
  }
  if ((m = url.match(/tiktok\.com\/.*\/video\/(\d+)/i))) {
    return `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1`;
  }
  if ((m = url.match(/reddit\.com\/r\/([^/]+)\/comments\/([a-zA-Z0-9]+)(?:\/([^/?#]*))?/i))) {
    return `https://www.redditmedia.com/r/${m[1]}/comments/${m[2]}/${m[3] || ''}?ref_source=embed&ref=share&embed=true&theme=dark`;
  }
  if ((m = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i))) {
    return `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark`;
  }
  if ((m = url.match(/archive\.org\/(?:details|embed)\/([^/?#&]+)/i))) {
    return `https://archive.org/embed/${m[1]}?autoplay=1`;
  }
  if ((m = url.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/i))) {
    return `https://streamable.com/e/${m[1]}?autoplay=1`;
  }
  if ((m = url.match(/odysee\.com\/(@[^/]+\/[^/?#]+|[^/?#]+:[a-f0-9]+)/i))) {
    return `https://odysee.com/$/embed/${m[1]}`;
  }
  if ((m = url.match(/rumble\.com\/embed\/([a-zA-Z0-9]+)/i))) {
    return `https://rumble.com/embed/${m[1]}/?pub=4`;
  }
  if ((m = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i))) {
    return `https://player.bilibili.com/player.html?bvid=${m[1]}&autoplay=1&high_quality=1`;
  }
  if (/facebook\.com\/.*\/videos\/|fb\.watch\//i.test(url)) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
  }
  if ((m = url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i))) {
    return `https://www.instagram.com/p/${m[1]}/embed/`;
  }
  if ((m = url.match(/ted\.com\/talks\/([a-zA-Z0-9_-]+)/i))) {
    return `https://embed.ted.com/talks/${m[1]}`;
  }

  return existingEmbed || `/api/media/embed-proxy?url=${encodeURIComponent(url)}`;
}

import {
  renumberCitationsByFirstAppearance,
  preprocessMessageContent,
} from '../lib/citationParser';
export { renumberCitationsByFirstAppearance, preprocessMessageContent };

const TerminalCodeBlock: React.FC<{
  language?: string;
  code: string;
  isDark?: boolean;
}> = ({ language = '', code, isDark = true }) => (
  <Suspense fallback={<CodeBlockSkeleton isDark={isDark} />}>
    <PrismCodeBlock language={language} code={code} isDark={isDark} />
  </Suspense>
);

export const GrokChatMessage: React.FC<GrokChatMessageProps> = ({
  message,
  threadId,
  threadTitle,
  onRetry,
  onEdit,
  onAskKinich,
  onOpenShareStudio,
  onOpenKnowledgeVault,
  theme = 'dark',
  nsfwMode = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<'good' | 'bad' | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(() =>
    UserAccountStore.getBookmarks().some((b) => b.messageId === message.id)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const [isUserMsgExpanded, setIsUserMsgExpanded] = useState(false);
  const [isAssistantMsgExpanded, setIsAssistantMsgExpanded] = useState(true);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [videoPlayerMode, setVideoPlayerMode] = useState<'embed' | 'mp4'>('embed');
  const [resolvedVideos, setResolvedVideos] = useState<
    Record<number, { videoUrl?: string; embedUrl?: string; useProxyStream?: boolean }>
  >({});
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [isImageGalleryExpanded, setIsImageGalleryExpanded] = useState(true);
  const [displayedImages, setDisplayedImages] = useState<NonNullable<ChatMessageType['images']>>(
    () => (message.images ? message.images.slice(0, 4) : [])
  );
  const [isLoadingMoreImages, setIsLoadingMoreImages] = useState(false);
  const [hasMoreImages, setHasMoreImages] = useState(true);
  const [showTtsPopup, setShowTtsPopup] = useState(false);
  const [activeStudyVideo, setActiveStudyVideo] = useState<YouTubeVideoInfo | null>(null);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<{ url: string; name: string } | null>(null);
  const [pdfViewerData, setPdfViewerData] = useState<{
    isOpen: boolean;
    pdfUrl?: string;
    pdfName?: string;
    extractedText?: string;
    initialTab?: PdfStudioTab;
  } | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<WebSearchSource | null>(null);
  const [liveFinanceQuotes, setLiveFinanceQuotes] = useState<FinanceQuote[]>(
    message.financeQuotes || []
  );

  const videoCarouselRef = React.useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';
  const isUser = message.role === 'user';

  const searchQueriesKey = (message.searchQueries || []).join('|');

  useEffect(() => {
    if (!message.isStreaming && message.images && message.images.length > 0) {
      setDisplayedImages(message.images.slice(0, 4));
      setHasMoreImages(true);
    } else {
      setDisplayedImages([]);
      setActiveImageIndex(null);
      setHasMoreImages(false);
    }
  }, [message.id, message.images, message.isStreaming]);

  useEffect(() => {
    if (!message.videos || message.videos.length === 0) {
      setActiveVideoIndex(null);
      setResolvedVideos({});
    }
  }, [message.videos]);

  const handleLoadMoreImages = async () => {
    if (isLoadingMoreImages) return;
    const rawPreFetched = message.images || [];
    if (rawPreFetched.length > displayedImages.length) {
      const nextSlice = rawPreFetched.slice(0, displayedImages.length + 4);
      setDisplayedImages(nextSlice);
      return;
    }

    const queryForImages = (
      message.searchQueries?.[0] ||
      message.personaWiki?.name ||
      threadTitle ||
      ''
    ).trim();
    if (!queryForImages) {
      setHasMoreImages(false);
      return;
    }

    setIsLoadingMoreImages(true);
    try {
      const res = await fetch(
        `/api/media/more-images?q=${encodeURIComponent(queryForImages)}&offset=${
          displayedImages.length
        }&limit=4`
      );
      const data = await res.json();
      if (data && Array.isArray(data.images) && data.images.length > 0) {
        setDisplayedImages((prev) => {
          const existingUrls = new Set(prev.map((i) => i.imageUrl));
          const fresh = data.images.filter((i: any) => i.imageUrl && !existingUrls.has(i.imageUrl));
          if (fresh.length === 0) {
            setHasMoreImages(false);
            return prev;
          }
          return [...prev, ...fresh.slice(0, 4)];
        });
        if (!data.hasMore) {
          setHasMoreImages(false);
        }
      } else {
        setHasMoreImages(false);
      }
    } catch {
      setHasMoreImages(false);
    } finally {
      setIsLoadingMoreImages(false);
    }
  };

  // Auto-detect stock & crypto tickers ($NVDA, $AAPL, BTC, SOL, etc.) in assistant messages
  useEffect(() => {
    if (isUser) return;
    if (message.financeQuotes && message.financeQuotes.length > 0) {
      setLiveFinanceQuotes(message.financeQuotes);
      return;
    }
    const combinedText = `${searchQueriesKey} ${(message.content || '').slice(0, 600)}`;
    const symbols = detectFinanceSymbolsInText(combinedText);
    if (symbols.length === 0) {
      setLiveFinanceQuotes((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    setLiveFinanceQuotes(symbols.map((s) => buildFallbackFinanceQuote(s)));
    let cancelled = false;
    Promise.all(symbols.map((s) => fetchLiveFinanceQuoteClient(s)))
      .then((quotes) => {
        if (!cancelled && quotes.length > 0) {
          setLiveFinanceQuotes(quotes);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isUser, message.financeQuotes, searchQueriesKey, message.content]);

  // Extract detected YouTube ID from videos or message text for quick Study Workspace access
  const detectedYtId = useMemo(() => {
    if (message.videos && message.videos.length > 0) {
      for (const v of message.videos) {
        const id = extractYouTubeIdFromInput(v.videoId || v.videoUrl || v.link);
        if (id) return id;
      }
    }
    return extractYouTubeIdFromInput(message.content || '');
  }, [message.videos, message.content]);

  useEffect(() => {
    const syncPinState = () => {
      setIsPinned(UserAccountStore.getBookmarks().some((b) => b.messageId === message.id));
    };
    window.addEventListener('kinich-account-updated', syncPinState);
    return () => window.removeEventListener('kinich-account-updated', syncPinState);
  }, [message.id]);

  const handleTogglePin = () => {
    const rawSnippet = (message.content || '')
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .replace(/[#*`~>\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    const nextPinned = UserAccountStore.toggleBookmark({
      threadId: threadId || 'default',
      threadTitle: threadTitle || 'Conversation',
      messageId: message.id,
      role: 'assistant',
      snippet: rawSnippet || 'Pinned response',
    });
    setIsPinned(nextPinned);
  };

  const [savedToVault, setSavedToVault] = useState(false);
  const [showActionsOnTap, setShowActionsOnTap] = useState(false);

  // Highlight & Save Segment to Knowledge Vault state
  const messageContentRef = React.useRef<HTMLDivElement>(null);
  const collectionDropdownRef = React.useRef<HTMLDivElement>(null);
  const [selectedSegmentText, setSelectedSegmentText] = useState('');
  const [segmentSavedToast, setSegmentSavedToast] = useState(false);
  const [showSegmentPicker, setShowSegmentPicker] = useState(false);
  const [isCollectionMenuOpen, setIsCollectionMenuOpen] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('col_explanations');
  const [vaultCollections, setVaultCollections] = useState(() =>
    KnowledgeVaultStore.getCollections()
  );
  const [savedMessageHighlights, setSavedMessageHighlights] = useState<KnowledgeVaultItem[]>(() =>
    KnowledgeVaultStore.getItems().filter(
      (item) => item.sourceMessageId === message.id && item.tags?.includes('highlight')
    )
  );

  const selectedCollectionName = useMemo(() => {
    return (
      vaultCollections.find((c) => c.id === selectedCollectionId)?.name || 'Useful Explanations'
    );
  }, [vaultCollections, selectedCollectionId]);

  useEffect(() => {
    if (!isCollectionMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        collectionDropdownRef.current &&
        !collectionDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCollectionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCollectionMenuOpen]);

  useEffect(() => {
    const syncVaultHighlights = () => {
      setVaultCollections(KnowledgeVaultStore.getCollections());
      setSavedMessageHighlights(
        KnowledgeVaultStore.getItems().filter(
          (item) => item.sourceMessageId === message.id && item.tags?.includes('highlight')
        )
      );
    };
    window.addEventListener('kinich-vault-updated', syncVaultHighlights);
    return () => window.removeEventListener('kinich-vault-updated', syncVaultHighlights);
  }, [message.id]);

  const handleCaptureTextSelection = React.useCallback(() => {
    if (typeof window === 'undefined' || !messageContentRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!messageContentRef.current.contains(range.commonAncestorContainer)) {
      return;
    }
    const rawText = selection.toString().replace(/\s+/g, ' ').trim();
    if (rawText.length >= 4) {
      setSelectedSegmentText(rawText.slice(0, 2400));
    }
  }, []);

  useEffect(() => {
    if (isUser) return;
    const onSelectionChange = () => {
      if (!messageContentRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (messageContentRef.current.contains(range.commonAncestorContainer)) {
        const txt = sel.toString().replace(/\s+/g, ' ').trim();
        if (txt.length >= 4) {
          setSelectedSegmentText(txt.slice(0, 2400));
        }
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [isUser]);

  const handleSaveSegmentToVault = (rawSegment?: string, collectionOverride?: string) => {
    if (UserAccountStore.isGuest()) {
      window.dispatchEvent(
        new CustomEvent('kinich-open-auth', {
          detail: { reason: 'Sign in to keep this in your Vault' },
        })
      );
      return;
    }
    const targetText = (rawSegment ?? selectedSegmentText).trim();
    if (!targetText) return;
    const cleanTitleSnippet = targetText
      .replace(/[#*`~>\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 68);
    KnowledgeVaultStore.saveItem({
      title: cleanTitleSnippet
        ? `"${cleanTitleSnippet}${targetText.length > 68 ? '…' : ''}"`
        : threadTitle || 'Highlighted Insight',
      summary: targetText.slice(0, 220),
      content: targetText,
      type: 'ai_response',
      collectionId: collectionOverride || selectedCollectionId || 'col_explanations',
      tags: ['highlight', 'chat-segment'],
      sourceThreadId: threadId,
      sourceMessageId: message.id,
      sources: message.sources || [],
    });
    setSegmentSavedToast(true);
    setSelectedSegmentText('');
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
    setTimeout(() => setSegmentSavedToast(false), 2400);
  };

  const handleToggleParagraphHighlight = (segmentText: string) => {
    if (UserAccountStore.isGuest()) {
      window.dispatchEvent(
        new CustomEvent('kinich-open-auth', {
          detail: { reason: 'Sign in to keep this in your Vault' },
        })
      );
      return;
    }
    const cleanSeg = segmentText.trim();
    if (!cleanSeg) return;
    const existing = savedMessageHighlights.find(
      (h) => h.content.trim().toLowerCase() === cleanSeg.toLowerCase()
    );
    if (existing) {
      KnowledgeVaultStore.deleteItem(existing.id);
    } else {
      handleSaveSegmentToVault(cleanSeg);
    }
  };

  const [isGuestUser, setIsGuestUser] = useState(() => UserAccountStore.isGuest());
  const [liveAgentCards, setLiveAgentCards] = useState<AgentReplyCard[]>(() => {
    const list: AgentReplyCard[] = [];
    if (message.agentReply) list.push(message.agentReply);
    if (Array.isArray(message.agentReplies)) {
      for (const c of message.agentReplies) {
        if (c && !list.some((x) => x.id === c.id)) list.push(c);
      }
    }
    return list;
  });

  useEffect(() => {
    const syncAccount = () => setIsGuestUser(UserAccountStore.isGuest());
    window.addEventListener('kinich-account-updated', syncAccount);
    return () => window.removeEventListener('kinich-account-updated', syncAccount);
  }, []);

  useEffect(() => {
    let sageTimeout: any;
    const onSageOrganized = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.item) return;
      if (detail.item.sourceMessageId === message.id) {
        clearTimeout(sageTimeout);
        if (detail.agentReply) {
          setLiveAgentCards((prev) => {
            const filtered = prev.filter((c) => c.agentId !== 'sage');
            return [detail.agentReply as AgentReplyCard, ...filtered];
          });
        }
      }
    };
    window.addEventListener('kinich-sage-organized', onSageOrganized as EventListener);
    return () => {
      window.removeEventListener('kinich-sage-organized', onSageOrganized as EventListener);
      clearTimeout(sageTimeout);
    };
  }, [message.id]);

  const handleSaveToKnowledgeVault = () => {
    if (UserAccountStore.isGuest()) {
      window.dispatchEvent(
        new CustomEvent('kinich-open-auth', {
          detail: { reason: 'Sign in to keep this in your Vault' },
        })
      );
      return;
    }
    const check = KnowledgeVaultStore.canSaveToVault();
    if (!check.allowed) {
      window.dispatchEvent(
        new CustomEvent('kinich-open-pricing', {
          detail: { highlightPlan: 'spark', reason: check.message },
        })
      );
      return;
    }
    const cleanBody = (message.content || '')
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .trim();
    if (!cleanBody) return;
    KnowledgeVaultStore.saveItem({
      title: threadTitle || cleanBody.replace(/[#*`~>\n]+/g, ' ').trim().slice(0, 72) || 'Kinich Study Answer',
      summary: cleanBody.replace(/[#*`~>\n]+/g, ' ').trim().slice(0, 220),
      content: cleanBody,
      type: 'chat_answer',
      sourceType: 'chat_answer',
      collectionId: 'col_explanations',
      tags: ['chat-answer'],
      sourceThreadId: threadId,
      sourceMessageId: message.id,
      sources: message.sources || [],
    });
    setSavedToVault(true);
    window.dispatchEvent(
      new CustomEvent('kinich-toast', {
        detail: { message: 'Saved to Vault · View in feed' },
      })
    );
    setTimeout(() => setSavedToVault(false), 5000);
  };

  // Extract thinking/reasoning process when Thinking Mode is on
  const thoughtMatch = useMemo(() => (message.content || '').match(/<think>([\s\S]*?)(?:<\/think>|$)/i), [message.content]);
  const thoughtContent = useMemo(() => {
    if (thoughtMatch && thoughtMatch[1]) return thoughtMatch[1].trim();
    return (message as any).reasoningContent || '';
  }, [thoughtMatch, message]);

  const cleanedContent = useMemo(() => {
    return (message.content || '')
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .trim();
  }, [message.content]);

  const assistantLineCount = useMemo(
    () => (cleanedContent ? cleanedContent.split('\n').length : 0),
    [cleanedContent]
  );
  const assistantWordCount = useMemo(
    () => (cleanedContent ? cleanedContent.split(/\s+/).filter(Boolean).length : 0),
    [cleanedContent]
  );
  const isLongAssistantMessage = useMemo(
    () => !message.isStreaming && (cleanedContent.length > 680 || assistantLineCount > 12),
    [message.isStreaming, cleanedContent.length, assistantLineCount]
  );

  // Split cleanedContent into selectable paragraphs/segments for one-tap highlighting
  const highlightableSegments = useMemo(() => {
    if (!cleanedContent) return [];
    return cleanedContent
      .split(/\n{2,}/)
      .map((block) =>
        block
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/^\s*[-*+]\s+/gm, '• ')
          .trim()
      )
      .filter((block) => block.length >= 16 && !block.startsWith('```'));
  }, [cleanedContent]);

  const scrollVideoCarousel = (direction: 'left' | 'right') => {
    if (!videoCarouselRef.current) return;
    const scrollAmount = 380;
    videoCarouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handlePlayVideo = async (idx: number) => {
    if (!message.videos || !message.videos[idx]) return;
    const vid = message.videos[idx];
    setActiveVideoIndex(idx);

    const knownEmbed = getUniversalClientEmbedUrl(vid.link, vid.videoId, vid.embedUrl);
    const hasNativePlatformEmbed =
      Boolean(vid.videoId) ||
      (Boolean(knownEmbed) && !knownEmbed.startsWith('/api/media/embed-proxy'));

    // Default to embed player for YouTube & known embed platforms, or MP4 if direct stream is already present
    if (hasNativePlatformEmbed) {
      setVideoPlayerMode('embed');
    } else if (vid.videoUrl || resolvedVideos[idx]?.videoUrl) {
      setVideoPlayerMode('mp4');
    } else {
      setVideoPlayerMode('embed');
    }

    // Resolve direct MP4 stream and/or dedicated embed URL on the fly if not already resolved
    if (!vid.videoId && vid.link && !resolvedVideos[idx]) {
      try {
        const res = await fetch(
          `/api/media/resolve-video?url=${encodeURIComponent(vid.link)}&title=${encodeURIComponent(
            vid.title || ''
          )}`
        );
        const data = await res.json();
        if (data && data.success) {
          setResolvedVideos((prev) => ({
            ...prev,
            [idx]: {
              videoUrl: data.videoUrl || vid.videoUrl || '',
              embedUrl: data.embedUrl || knownEmbed,
            },
          }));
          if (data.videoUrl && !hasNativePlatformEmbed) {
            setVideoPlayerMode('mp4');
          }
        }
      } catch {}
    }
  };

  const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);

  const triggerMediaDownload = async (
    url: string | undefined,
    fallback: string | undefined,
    title: string,
    type: 'image' | 'video'
  ) => {
    if (isDownloadingMedia) return;
    setIsDownloadingMedia(true);
    try {
      const downloadHref = `/api/media/download?url=${encodeURIComponent(
        url || ''
      )}&fallback=${encodeURIComponent(fallback || '')}&title=${encodeURIComponent(
        title || type
      )}&type=${type}`;

      const safeTitle =
        (title || type)
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase()
          .slice(0, 48) || type;

      const res = await fetch(downloadHref, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error('Invalid media response type');
      }

      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength < 512) {
        throw new Error('Empty media payload');
      }

      const ext =
        type === 'video'
          ? contentType.includes('webm')
            ? 'webm'
            : 'mp4'
          : contentType.includes('png')
          ? 'png'
          : contentType.includes('webp')
          ? 'webp'
          : contentType.includes('gif')
          ? 'gif'
          : 'jpg';

      const mimeType =
        type === 'video'
          ? ext === 'webm'
            ? 'video/webm'
            : 'video/mp4'
          : contentType || 'image/jpeg';

      const blob = new Blob([arrayBuf], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${safeTitle}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    } catch (err) {
      console.error('Media download failed:', err);
    } finally {
      setIsDownloadingMedia(false);
    }
  };

  const { content: renumberedCleanedContent, sources: orderedMessageSources } = React.useMemo(
    () => renumberCitationsByFirstAppearance(cleanedContent, message.sources || []),
    [cleanedContent, message.sources]
  );

  const processedContent = React.useMemo(
    () => preprocessMessageContent(renumberedCleanedContent),
    [renumberedCleanedContent]
  );

  const copyText = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (editDraft.trim() && onEdit) {
      onEdit(editDraft.trim());
      setIsEditing(false);
    }
  };

  return (
    <div
      id={`msg-${message.id}`}
      data-message-id={message.id}
      className="group/msg py-1 px-2 sm:px-4 md:px-0 max-w-3xl mx-auto w-full min-w-0 overflow-hidden rounded-2xl"
    >
      {/* User Message Layout */}
      {isUser ? (
        <div className="flex flex-col items-end w-full min-w-0">
          {/* Attached Images & Files on Sent User Message */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2 mb-2 max-w-full sm:max-w-2xl">
              {message.attachments.map((att, idx) => {
                const isImg = att.type?.startsWith('image/') && Boolean(att.url);
                if (isImg && att.url) {
                  return (
                    <div
                      key={idx}
                      onClick={() =>
                        setPreviewAttachmentUrl({
                          url: att.url!,
                          name: att.name || 'Attached Image',
                        })
                      }
                      className={`group/att relative rounded-2xl overflow-hidden border backdrop-blur-xl cursor-pointer transition-transform hover:scale-[1.01] ${
                        isDark
                          ? 'border-white/[0.14] bg-white/[0.05] shadow-[0_8px_24px_rgba(0,0,0,0.45)]'
                          : 'border-black/[0.08] bg-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
                      }`}
                    >
                      <img
                        src={att.url}
                        alt={att.name}
                        className="max-h-56 max-w-xs sm:max-w-sm object-cover block"
                      />
                      <div className="px-2.5 py-1 text-[11px] truncate max-w-xs backdrop-blur-md bg-black/50 text-white/90">
                        {att.name}
                      </div>
                    </div>
                  );
                }
                const ext = (att.name || '').split('.').pop()?.toLowerCase() || '';
                const isPdf = att.type?.includes('pdf') || ext === 'pdf';
                const isAudio = att.type?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
                const isVideo = att.type?.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv'].includes(ext);
                const isCode = [
                  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs',
                  'php', 'rb', 'swift', 'kt', 'sql', 'html', 'css', 'scss', 'xml', 'yaml', 'yml',
                  'sh', 'bash', 'env', 'toml', 'ini'
                ].includes(ext);
                const isData = ['json', 'csv', 'tsv', 'xlsx', 'xls', 'parquet'].includes(ext) || att.type?.includes('csv') || att.type?.includes('json');

                const formattedSize = att.size
                  ? att.size < 1024 * 1024
                    ? `${(att.size / 1024).toFixed(1)} KB`
                    : `${(att.size / (1024 * 1024)).toFixed(2)} MB`
                  : '';

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (isPdf) {
                        setPdfViewerData({
                          isOpen: true,
                          pdfUrl: att.url,
                          pdfName: att.name || 'Document.pdf',
                          extractedText: att.textContent || '',
                          initialTab: 'quiz',
                        });
                      }
                    }}
                    className={`flex flex-col gap-2 px-3.5 py-2.5 rounded-2xl border backdrop-blur-xl text-xs transition-all group/file ${
                      isPdf ? 'cursor-pointer hover:border-red-500/50' : 'cursor-default'
                    } ${
                      isDark
                        ? 'bg-white/[0.06] border-white/[0.14] text-white'
                        : 'bg-white/75 border-black/[0.08] text-[#0d0d0d]'
                    }`}
                    title={isPdf ? 'Click to open PDF Quiz, Flashcards & Study Studio' : `${att.name} (${formattedSize})`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isPdf ? (
                        <FileText className="w-4 h-4 text-red-500 shrink-0 group-hover/file:scale-110 transition-transform" />
                      ) : isCode ? (
                        <Code2 className="w-4 h-4 text-cyan-500 shrink-0" />
                      ) : isData ? (
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : isAudio ? (
                        <Music className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : isVideo ? (
                        <Film className="w-4 h-4 text-purple-500 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 opacity-70 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[200px]">
                          {att.name}
                        </div>
                        <div className={`text-[10px] ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                          {formattedSize ? `${formattedSize} · ` : ''}
                          {isPdf ? 'PDF Study Studio' : isCode ? 'Source Code' : isData ? 'Data File' : isAudio ? 'Audio File' : isVideo ? 'Video File' : 'Attachment'}
                        </div>
                      </div>
                    </div>

                    {isPdf && (
                      <div
                        className="flex flex-wrap items-center gap-1 pt-1 border-t border-current/10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(
                          [
                            { tab: 'quiz', label: 'Quiz' },
                            { tab: 'flashcards', label: 'Flashcards' },
                            { tab: 'summary', label: 'Summary' },
                            { tab: 'cheatsheet', label: 'Cheatsheet' },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.tab}
                            type="button"
                            onClick={() =>
                              setPdfViewerData({
                                isOpen: true,
                                pdfUrl: att.url,
                                pdfName: att.name || 'Document.pdf',
                                extractedText: att.textContent || '',
                                initialTab: item.tab,
                              })
                            }
                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              item.tab === 'quiz'
                                ? isDark
                                  ? 'bg-white text-black border-white hover:bg-neutral-200'
                                  : 'bg-black text-white border-black hover:bg-neutral-800'
                                : isDark
                                ? 'bg-white/[0.06] border-white/[0.12] text-neutral-200 hover:bg-white/[0.14]'
                                : 'bg-black/[0.04] border-black/[0.1] text-neutral-800 hover:bg-black/[0.08]'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isEditing ? (
            <div
              className={`w-full max-w-full sm:max-w-xl rounded-3xl border px-5 py-4 transition-all ${
                isDark
                  ? 'bg-[#141418] border-white/[0.15] text-white shadow-[0_12px_36px_rgba(0,0,0,0.55)]'
                  : 'bg-white border-black/[0.12] text-[#18181b] shadow-[0_8px_28px_rgba(0,0,0,0.06)]'
              }`}
            >
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditDraft(message.content);
                  }
                }}
                autoFocus
                rows={Math.min(6, Math.max(2, editDraft.split('\n').length))}
                className={`w-full bg-transparent border-0 p-0 text-[14px] leading-relaxed focus:outline-none focus:ring-0 font-sans resize-none ${
                  isDark ? 'text-white placeholder-white/40' : 'text-[#18181b] placeholder-black/40'
                }`}
              />
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditDraft(message.content);
                  }}
                  className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isDark
                      ? 'bg-white/[0.06] border-white/[0.12] text-white/80 hover:text-white hover:bg-white/[0.12]'
                      : 'bg-[#f4f4f5] border-black/[0.08] text-[#52525b] hover:text-[#18181b] hover:bg-neutral-200/80'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isDark
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-[#18181b] text-white hover:bg-neutral-800'
                  }`}
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end w-full max-w-[90%] sm:max-w-[78%] min-w-0">
              {(() => {
                const rawUserText = message.content || '';
                const lineCount = rawUserText.split('\n').length;
                const isLongUserMessage = rawUserText.length > 360 || lineCount > 8;
                return (
                  <div
                    className={`text-[14.5px] sm:text-[15px] leading-[24px] tracking-normal [word-spacing:normal] font-normal px-4 py-2.5 rounded-[22px] backdrop-blur-2xl backdrop-saturate-150 border w-fit max-w-full min-w-0 overflow-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] ${
                      isDark
                        ? 'bg-neutral-900/55 border-white/[0.15] text-[#f9fafb] shadow-[0_8px_28px_rgba(0,0,0,0.45)]'
                        : 'bg-white/75 border-black/[0.08] text-[#0f1115] shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
                    }`}
                  >
                    <div
                      style={{
                        maxHeight: isLongUserMessage && !isUserMsgExpanded ? '132px' : 'none',
                        overflow: 'hidden',
                        transition: 'max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      className="relative"
                    >
                      <div>{rawUserText}</div>
                      {isLongUserMessage && !isUserMsgExpanded && (
                        <div
                          className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t ${
                            isDark ? 'from-neutral-900/90 to-transparent' : 'from-white/90 to-transparent'
                          }`}
                        />
                      )}
                    </div>
                    {isLongUserMessage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsUserMsgExpanded((prev) => !prev);
                        }}
                        data-testid="toggle-user-message-expand"
                        className={`mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full border transition-colors duration-200 cursor-pointer ${
                          isDark
                            ? 'bg-white/[0.07] hover:bg-white/[0.13] border-white/[0.14] text-neutral-200'
                            : 'bg-black/[0.04] hover:bg-black/[0.08] border-black/[0.1] text-neutral-700'
                        }`}
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
                            isUserMsgExpanded ? 'rotate-180' : 'rotate-0'
                          }`}
                        />
                        <span>
                          {isUserMsgExpanded
                            ? 'Show less'
                            : `Show full prompt (${rawUserText.length.toLocaleString()} chars)`}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Copy and Edit Buttons Directly Under Sent User Message (Hidden until hover or tap) */}
              <div
                className={`items-center justify-end gap-1 px-0.5 transition-opacity duration-150 ${
                  showActionsOnTap || copied
                    ? 'mt-1 flex opacity-100'
                    : 'hidden group-hover/msg:mt-1 group-hover/msg:flex group-hover/msg:opacity-100'
                }`}
              >
                <button
                  type="button"
                  onClick={copyText}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border backdrop-blur-2xl backdrop-saturate-150 text-[10.5px] font-medium transition-all cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900/50 hover:bg-neutral-800/70 border-white/[0.14] text-white/75 hover:text-white'
                      : 'bg-white/70 hover:bg-white/95 border-black/[0.08] text-[#525252] hover:text-black'
                  }`}
                  title="Copy message"
                >
                  {copied ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditDraft(message.content);
                      setIsEditing(true);
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border backdrop-blur-2xl backdrop-saturate-150 text-[10.5px] font-medium transition-all cursor-pointer ${
                      isDark
                        ? 'bg-neutral-900/50 hover:bg-neutral-800/70 border-white/[0.14] text-white/75 hover:text-white'
                        : 'bg-white/70 hover:bg-white/95 border-black/[0.08] text-[#525252] hover:text-black'
                    }`}
                    title="Edit message"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Assistant Message Layout */
        <div className="w-full">
          {/* Live Rare UI WebSearch Component showing actual sites being searched in real-time */}
          {((orderedMessageSources && orderedMessageSources.length > 0) ||
            (message.isStreaming && !cleanedContent && message.loadingMode === 'search')) && (
            <WebSearch
              messageId={message.id}
              sources={(orderedMessageSources || []).map((s, idx) => ({
                id: s.url || `source-${idx}`,
                title: s.title,
                url: s.url,
                snippet: s.snippet,
                domain: s.domain,
                position: s.position || idx + 1,
                date: s.date,
                socialMeta: s.socialMeta,
              }))}
              status={
                message.isStreaming &&
                !cleanedContent &&
                (!orderedMessageSources || orderedMessageSources.length === 0)
                  ? 'searching'
                  : 'done'
              }
              query={message.searchQueries?.[0]}
              isDark={isDark}
              onSelectCitation={(src) => setSelectedCitation(src)}
            />
          )}

          {/* @kobra/weather: Intelligently triggered when query asks for weather/temperature/forecast */}
          {(() => {
            const wxLoc = detectWeatherLocationInQuery(message.searchQueries?.[0] || '');
            if (!wxLoc) return null;
            return <WeatherCard locationQuery={wxLoc} isDark={isDark} />;
          })()}

          {/* @kobra/image-generation: Intelligently triggered when query requests image generation */}
          {!message.isStreaming &&
            (() => {
              const imgPrompt = detectImageGenerationIntent(message.searchQueries?.[0] || '');
              if (!imgPrompt) return null;
              return (
                <ImageGenerationCard
                  prompt={imgPrompt}
                  isDark={isDark}
                  fallbackImages={message.images}
                />
              );
            })()}

          {/* Compact ThinkingOrb Loading Pill on Left Side - only for general casual replies (no web search) */}
          {message.isStreaming &&
            !cleanedContent &&
            message.loadingMode !== 'search' &&
            (!orderedMessageSources || orderedMessageSources.length === 0) && (
              <div className="my-2.5 flex items-center justify-start">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm transition-all duration-200 ${
                    isDark
                      ? 'bg-[#18181b]/95 border-neutral-800 text-neutral-300'
                      : 'bg-neutral-100/90 border-neutral-200 text-neutral-700'
                  }`}
                >
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <ThinkingOrb
                      state={
                        message.loadingMode === 'vision'
                          ? 'solving'
                          : 'working'
                      }
                      size={20}
                    />
                  </div>
                  <span className="text-xs font-medium tracking-tight">
                    {message.loadingMode === 'vision'
                      ? 'Solving visual....'
                      : message.loadingMode === 'file'
                      ? 'Reading file....'
                      : 'Thinking....'}
                  </span>
                </div>
              </div>
            )}

          {/* Persona Wiki Interactive Profile Card (Athletes, Celebrities, Politicians, Public Figures on any scale) */}
          {!message.isStreaming && message.personaWiki && (
            <PersonaWikiCard
              persona={message.personaWiki}
              isDark={isDark}
              onAskKinich={onAskKinich}
            />
          )}

          {/* Collapsible Interactive Web Image Gallery (4 initial images + Load More) */}
          {!message.isStreaming && displayedImages.length > 0 && (
            <div className={`my-2.5 ${isImageGalleryExpanded ? `pb-3 border-b ${isDark ? 'border-[#1f1f1f]' : 'border-[#e5e5e5]'}` : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsImageGalleryExpanded((prev) => !prev)}
                  className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs transition-all cursor-pointer select-none ${
                    isDark
                      ? 'bg-[#111111] hover:bg-[#191919] border-[#242424] text-white'
                      : 'bg-[#f7f7f8] hover:bg-[#efefef] border-[#e2e2e5] text-black'
                  }`}
                >
                  {/* Stacked preview thumbnails */}
                  <div className="flex items-center -space-x-1.5">
                    {displayedImages.slice(0, 4).map((img, i) => (
                      <img
                        key={i}
                        src={img.thumbnailUrl || img.imageUrl}
                        alt=""
                        loading="lazy"
                        className={`w-4 h-4 rounded-full object-cover ring-1 ${
                          isDark ? 'ring-[#111111] bg-[#222222]' : 'ring-white bg-[#e5e5e5]'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold">
                    Images ({displayedImages.length})
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-[#8a8a8a]' : 'text-[#666666]'}`}>
                    {isImageGalleryExpanded ? 'Hide' : 'Show gallery'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isDark ? 'text-[#8a8a8a]' : 'text-[#666666]'
                    } ${isImageGalleryExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isImageGalleryExpanded && hasMoreImages && (
                  <button
                    type="button"
                    onClick={handleLoadMoreImages}
                    disabled={isLoadingMoreImages}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer disabled:opacity-60 ${
                      isDark
                        ? 'bg-[#111111] hover:bg-[#1b1b1b] border-[#262626] text-white/90 hover:text-white'
                        : 'bg-[#f7f7f8] hover:bg-[#ececef] border-[#e2e2e5] text-black/85 hover:text-black'
                    }`}
                  >
                    {isLoadingMoreImages ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <span>+ Load more</span>
                    )}
                  </button>
                )}
              </div>

              {isImageGalleryExpanded && (
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in duration-150">
                  {displayedImages.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`group/img relative aspect-square rounded-2xl overflow-hidden border cursor-pointer transition-all ${
                        isDark
                          ? 'bg-[#0a0a0a] border-[#1f1f1f] hover:border-[#444444]'
                          : 'bg-[#f5f5f5] border-[#e5e5e5] hover:border-[#999999]'
                      }`}
                    >
                      <img
                        src={img.imageUrl || img.thumbnailUrl}
                        alt={img.title}
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (img.thumbnailUrl && target.src !== img.thumbnailUrl) {
                            target.src = img.thumbnailUrl;
                          }
                        }}
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerMediaDownload(img.imageUrl, img.thumbnailUrl, img.title, 'image');
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/75 hover:bg-black text-white border border-white/15 transition-opacity opacity-90 sm:opacity-0 sm:group-hover/img:opacity-100 cursor-pointer"
                        title="Download image"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <div className="text-[11px] text-white font-medium truncate">
                          {img.title}
                        </div>
                        {img.domain && (
                          <div className="text-[10px] text-white/70 truncate">
                            {img.domain}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Floating Highlight & Save Selection Bar when text is selected inside AI response */}
          {(selectedSegmentText || segmentSavedToast) && !message.isStreaming && (
            <div
              className={`sticky top-2 z-30 mb-2 px-2.5 py-1.5 rounded-full border backdrop-blur-2xl backdrop-saturate-150 shadow-lg flex items-center justify-between gap-2 transition-all ${
                isDark
                  ? 'bg-neutral-900/80 border-white/[0.16] text-white'
                  : 'bg-white/85 border-black/[0.1] text-[#111111]'
              }`}
            >
              {segmentSavedToast && !selectedSegmentText ? (
                <div className="flex items-center justify-between w-full gap-2 px-1 text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Saved to {selectedCollectionName}</span>
                  </div>
                  {onOpenKnowledgeVault && (
                    <button
                      type="button"
                      onClick={onOpenKnowledgeVault}
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-white/10 hover:bg-white/15 text-white'
                          : 'bg-black/5 hover:bg-black/10 text-black'
                      }`}
                    >
                      Vault
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1 pl-1 text-[11px] truncate opacity-80">
                    “{selectedSegmentText}”
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSaveSegmentToVault(selectedSegmentText)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-white text-black hover:bg-neutral-200'
                          : 'bg-black text-white hover:bg-neutral-800'
                      }`}
                    >
                      <span>Save</span>
                    </button>
                    {onAskKinich && (
                      <button
                        type="button"
                        onClick={() => {
                          const snippet = selectedSegmentText;
                          setSelectedSegmentText('');
                          onAskKinich(`Explain this further: "${snippet.slice(0, 300)}"`);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-white/[0.08] hover:bg-white/[0.14] text-white/90'
                            : 'bg-black/[0.05] hover:bg-black/[0.1] text-black/85'
                        }`}
                      >
                        Ask
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSegmentText('');
                        try {
                          window.getSelection()?.removeAllRanges();
                        } catch {}
                      }}
                      className={`p-1 rounded-full transition-colors cursor-pointer ${
                        isDark ? 'text-white/50 hover:text-white' : 'text-black/45 hover:text-black'
                      }`}
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Clean Compact Segment Highlighter with Custom Popover Dropdown (No Native Select) */}
          {showSegmentPicker && !message.isStreaming && highlightableSegments.length > 0 && (
            <div
              className={`mb-2.5 p-2 rounded-2xl border backdrop-blur-2xl transition-all ${
                isDark
                  ? 'bg-neutral-900/55 border-white/[0.12] text-white'
                  : 'bg-white/75 border-black/[0.08] text-[#111111]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
                {/* Custom Model-Picker-Style Collection Dropdown */}
                <div className="relative" ref={collectionDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsCollectionMenuOpen((prev) => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full border backdrop-blur-2xl backdrop-saturate-150 transition-all cursor-pointer font-medium text-[11px] select-none ${
                      isDark
                        ? 'bg-neutral-900/75 hover:bg-neutral-800/80 border-white/[0.16] text-white'
                        : 'bg-white/85 hover:bg-white border-black/[0.1] text-black shadow-2xs'
                    }`}
                  >
                    <span className="truncate max-w-[150px]">{selectedCollectionName}</span>
                    <ChevronDown
                      className={`w-3 h-3 shrink-0 transition-transform duration-150 opacity-60 ${
                        isCollectionMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isCollectionMenuOpen && (
                    <div
                      className={`absolute top-full left-0 mt-1.5 w-48 rounded-xl border p-1 z-50 text-[11px] backdrop-blur-2xl backdrop-saturate-150 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
                        isDark
                          ? 'bg-neutral-900/95 border-white/[0.16] text-white shadow-[0_16px_48px_rgba(0,0,0,0.85)]'
                          : 'bg-white/95 border-black/[0.1] text-[#0d0d0d] shadow-[0_16px_48px_rgba(0,0,0,0.16)]'
                      }`}
                    >
                      {vaultCollections.map((col) => {
                        const isSelected = col.id === selectedCollectionId;
                        return (
                          <button
                            key={col.id}
                            type="button"
                            onClick={() => {
                              setSelectedCollectionId(col.id);
                              setIsCollectionMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected
                                ? isDark
                                  ? 'bg-white/10 text-white font-medium'
                                  : 'bg-black/5 text-black font-medium'
                                : isDark
                                ? 'hover:bg-white/[0.05] text-white/75'
                                : 'hover:bg-black/[0.04] text-black/75'
                            }`}
                          >
                            <span className="truncate">{col.name}</span>
                            {isSelected && <Check className="w-3 h-3 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {onOpenKnowledgeVault && savedMessageHighlights.length > 0 && (
                    <button
                      type="button"
                      onClick={onOpenKnowledgeVault}
                      className={`px-2.5 py-1 rounded-full text-[10.5px] font-medium transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-white/[0.07] hover:bg-white/[0.12] text-white/85'
                          : 'bg-black/[0.05] hover:bg-black/[0.09] text-black/80'
                      }`}
                    >
                      Vault ({savedMessageHighlights.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSegmentPicker(false);
                      setIsCollectionMenuOpen(false);
                    }}
                    className={`p-1 rounded-full transition-colors cursor-pointer ${
                      isDark ? 'text-white/50 hover:text-white' : 'text-black/45 hover:text-black'
                    }`}
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5 scrollbar-none">
                {highlightableSegments.map((seg, idx) => {
                  const isSaved = savedMessageHighlights.some(
                    (h) => h.content.trim().toLowerCase() === seg.toLowerCase()
                  );
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleToggleParagraphHighlight(seg)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl border text-[11.5px] leading-snug transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSaved
                          ? isDark
                            ? 'bg-white/[0.1] border-white/[0.22] text-white'
                            : 'bg-black/[0.07] border-black/[0.18] text-black'
                          : isDark
                          ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06] text-white/80'
                          : 'bg-black/[0.02] hover:bg-black/[0.05] border-black/[0.05] text-black/80'
                      }`}
                    >
                      <span className="line-clamp-2 flex-1">{seg}</span>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          isSaved
                            ? isDark
                              ? 'bg-white text-black'
                              : 'bg-black text-white'
                            : isDark
                            ? 'bg-white/[0.08] text-white/70'
                            : 'bg-black/[0.06] text-black/70'
                        }`}
                      >
                        {isSaved ? 'Saved' : '+ Save'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collapsible Reasoning Steps when Thinking Mode is on */}
          {thoughtContent && (
            <div className="mb-2.5">
              <ReasoningSteps
                thoughts={thoughtContent}
                durationSec={
                  message.timing?.totalSec
                    ? Math.max(1, Math.round(message.timing.totalSec * 0.6))
                    : 3
                }
                isDark={isDark}
                isStreaming={message.isStreaming}
                defaultExpanded={false}
              />
            </div>
          )}

          <div
            style={{
              maxHeight: isLongAssistantMessage && !isAssistantMsgExpanded ? '260px' : 'none',
              overflow: 'hidden',
              transition: 'max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="relative"
          >
            <div
              ref={messageContentRef}
              onMouseUp={handleCaptureTextSelection}
              onTouchEnd={() => setTimeout(handleCaptureTextSelection, 60)}
              className="prose-grok ds-markdown max-w-none my-0 text-[14.5px] sm:text-[15.5px] leading-[24px] sm:leading-[26px] tracking-normal [word-spacing:normal]"
            >
              <StreamingText
                isStreaming={message.isStreaming}
                durationSec={message.timing?.totalSec}
                isDark={isDark}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={{
                  p: ({ node, children, ...props }) => (
                    <p
                      className="ds-markdown-paragraph my-3 sm:my-3.5 first:mt-0 last:mb-0 leading-[24px] sm:leading-[26px] tracking-normal [word-spacing:normal]"
                      {...props}
                    >
                      {children}
                    </p>
                  ),
                  h1: ({ node, children, ...props }) => (
                    <h1
                      className="mt-6 first:mt-0 mb-3 text-[20px] sm:text-[22px] font-bold leading-[28px] sm:leading-[30px] tracking-normal"
                      {...props}
                    >
                      {children}
                    </h1>
                  ),
                  h2: ({ node, children, ...props }) => (
                    <h2
                      className="mt-5.5 first:mt-0 mb-2.5 text-[18px] sm:text-[19.5px] font-bold leading-[26px] sm:leading-[28px] tracking-normal"
                      {...props}
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ node, children, ...props }) => (
                    <h3
                      className="mt-5 first:mt-0 mb-2 text-[16.5px] sm:text-[17.5px] font-bold leading-[24px] sm:leading-[26px] tracking-normal"
                      {...props}
                    >
                      {children}
                    </h3>
                  ),
                  h4: ({ node, children, ...props }) => (
                    <h4
                      className="mt-3.5 first:mt-0 mb-2 text-[15px] sm:text-[15.5px] font-semibold leading-[24px] sm:leading-[26px] tracking-normal"
                      {...props}
                    >
                      {children}
                    </h4>
                  ),
                  ul: ({ node, children, ...props }) => (
                    <ul
                      className="my-3 first:mt-0 last:mb-0 pl-[18px] list-disc space-y-1.5 leading-[24px] sm:leading-[26px] tracking-normal"
                      {...props}
                    >
                      {children}
                    </ul>
                  ),
                  ol: ({ node, children, ...props }) => (
                    <ol
                      className="my-3 first:mt-0 last:mb-0 pl-[18px] list-decimal space-y-1.5 leading-[24px] sm:leading-[26px] tracking-normal"
                      {...props}
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ node, children, ...props }) => (
                    <li
                      className="pl-0 leading-[24px] sm:leading-[26px] tracking-normal [word-spacing:normal] [&>p]:my-1.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      {...props}
                    >
                      {children}
                    </li>
                  ),
                  blockquote: ({ node, children, ...props }) => (
                    <blockquote
                      className={`mt-3.5 mb-0 pl-[14px] border-l-2 leading-[24px] sm:leading-[26px] tracking-normal not-italic ${
                        isDark ? 'border-[#81858c] text-[#cfd3d6]' : 'border-[#adb2b8] text-[#61666b]'
                      }`}
                      {...props}
                    >
                      {children}
                    </blockquote>
                  ),
                  strong: ({ node, children, ...props }) => (
                    <strong
                      className={`font-semibold tracking-normal ${
                        isDark ? 'text-white' : 'text-[#0f1115]'
                      }`}
                      {...props}
                    >
                      {children}
                    </strong>
                  ),
                  hr: ({ node, ...props }) => (
                    <hr
                      className={`my-6 border-0 border-t ${
                        isDark ? 'border-white/[0.12]' : 'border-black/[0.1]'
                      }`}
                      {...props}
                    />
                  ),
                  table: ({ node, children, ...props }) => (
                    <div
                      className={`my-5 w-full max-w-full min-w-0 overflow-x-auto rounded-xl border [-webkit-overflow-scrolling:touch] ${
                        isDark
                          ? 'border-zinc-800 bg-zinc-950/50'
                          : 'border-zinc-200 bg-white'
                      }`}
                    >
                      <table
                        className="w-full min-w-max border-collapse text-left text-[0.84rem] leading-[1.6] tracking-[0.008em]"
                        {...props}
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  tbody: ({ node, children, ...props }) => (
                    <tbody className="[&>tr:last-child>td]:border-b-0" {...props}>
                      {children}
                    </tbody>
                  ),
                  th: ({ node, children, ...props }) => (
                    <th
                      className={`px-3.5 py-2.5 font-semibold whitespace-nowrap border-b ${
                        isDark
                          ? 'bg-zinc-900/80 text-white border-zinc-800'
                          : 'bg-zinc-50 text-zinc-950 border-zinc-200'
                      }`}
                      {...props}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ node, children, ...props }) => (
                    <td
                      className={`px-3.5 py-2.5 align-top border-b ${
                        isDark
                          ? 'text-zinc-200 border-zinc-800/80'
                          : 'text-zinc-800 border-zinc-200/80'
                      }`}
                      {...props}
                    >
                      {children}
                    </td>
                  ),
                  a: ({ node, href, children, ...props }) => {
                    const flatText = React.Children.toArray(children)
                      .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
                      .join('')
                      .trim();
                    const hrefCiteMatch = href ? href.match(/^#cite-(\d+)$/) : null;
                    const textCiteMatch = flatText.match(/^\[?(\d{1,2})\]?$/);
                    const citeMatch = hrefCiteMatch || textCiteMatch;

                    const allAvailableSources =
                      orderedMessageSources && orderedMessageSources.length > 0
                        ? orderedMessageSources
                        : (message.arxivPapers || []).map((p, idx) => ({
                            title: p.title,
                            url: p.pdfUrl || (p as any).absUrl || (p as any).link || '',
                            domain: 'arxiv.org',
                            snippet: p.summary,
                            position: idx + 1,
                          }));

                    if (citeMatch) {
                      const num = parseInt(citeMatch[1], 10);
                      if (allAvailableSources.length > 0) {
                        const src =
                          allAvailableSources.find((s, idx) => (s.position || idx + 1) === num) ||
                          allAvailableSources[num - 1] ||
                          allAvailableSources.find((s) => s.url === href) ||
                          allAvailableSources[(num - 1) % allAvailableSources.length];
                        if (src) {
                          return (
                            <WebSearchCitation
                              source={src}
                              index={num}
                              messageId={message.id}
                              isDark={isDark}
                              onOpenModal={(s) => setSelectedCitation(s)}
                            />
                          );
                        }
                      }
                      return <InlineCitation index={num} messageId={message.id} isDark={isDark} />;
                    }

                    // Check if href or cite link matches a known web search source
                    if (href && allAvailableSources.length > 0) {
                      const matchedIdx = allAvailableSources.findIndex(
                        (s, idx) => s.url === href || href === `#cite-${s.position || idx + 1}`
                      );
                      if (matchedIdx !== -1) {
                        const matched = allAvailableSources[matchedIdx];
                        return (
                          <WebSearchCitation
                            source={matched}
                            index={matched.position || matchedIdx + 1}
                            messageId={message.id}
                            isDark={isDark}
                            onOpenModal={(s) => setSelectedCitation(s)}
                          />
                        );
                      }
                    }

                    return (
                      <a
                        {...props}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4 font-normal hover:opacity-80"
                      >
                        {children}
                      </a>
                    );
                  },
                  img: ({ node, ...props }) => (
                    <img
                      {...props}
                      loading="lazy"
                      className={`rounded-2xl my-3 max-w-full max-h-[420px] object-cover border shadow-md ${
                        isDark ? 'border-[#1f1f1f]' : 'border-[#e5e5e5]'
                      }`}
                    />
                  ),
                  iframe: ({ node, ...props }) => (
                    <div
                      className={`aspect-video w-full max-w-2xl my-4 rounded-2xl overflow-hidden border shadow-xl ${
                        isDark ? 'border-[#1f1f1f] bg-[#0a0a0a]' : 'border-[#e5e5e5] bg-[#fafafa]'
                      }`}
                    >
                      <iframe
                        {...props}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ),
                  pre: ({ node, children, ...props }) => {
                    const child = React.Children.toArray(children)[0] as React.ReactElement<any>;
                    const childClassName = child?.props?.className || '';
                    const childContent = String(child?.props?.children || '').trim();

                    // @kobra/plan-card handler for plan/checklist/todo codeblocks
                    if (
                      childClassName.includes('language-plan') ||
                      childClassName.includes('language-checklist') ||
                      childClassName.includes('language-todo') ||
                      childClassName.includes('language-action-plan')
                    ) {
                      const lines = childContent.split('\n').filter(Boolean);
                      const titleLine = lines[0]?.replace(/^[#*-]\s*/, '') || 'Action Plan';
                      const taskLines = lines.slice(1);
                      const tasks = taskLines.map((line, i) => {
                        const isDone = /^\s*-\s*\[x\]/i.test(line);
                        const cleanText = line.replace(/^\s*-\s*\[[ x]\]\s*/i, '').replace(/^[*-]\s*/, '');
                        return { id: `task-${i}`, text: cleanText, done: isDone };
                      });
                      return (
                        <PlanCard
                          type="plan"
                          title={titleLine}
                          tasks={tasks.length > 0 ? tasks : [{ id: '1', text: titleLine, done: false }]}
                          isDark={isDark}
                        />
                      );
                    }

                    // @kobra/plan-card handler for poll codeblocks
                    if (childClassName.includes('language-poll')) {
                      const lines = childContent.split('\n').filter(Boolean);
                      const titleLine = lines[0]?.replace(/^[#*-]\s*/, '') || 'Live Poll';
                      const optLines = lines.slice(1).map((l) => l.replace(/^[0-9.*-]+\s*/, '').trim()).filter(Boolean);
                      const tasks = optLines.map((opt, i) => ({
                        id: `opt-${i}`,
                        text: opt,
                        done: false,
                        votes: Math.max(3, 30 - i * 7),
                      }));
                      return (
                        <PlanCard
                          type="poll"
                          title={titleLine}
                          badge="Live Poll"
                          tasks={
                            tasks.length > 0
                              ? tasks
                              : [
                                  { id: '1', text: 'Agree / Strongly in favor', done: false, votes: 24 },
                                  { id: '2', text: 'Neutral / Exploring options', done: false, votes: 14 },
                                  { id: '3', text: 'Disagree / Prefer alternative', done: false, votes: 6 },
                                ]
                          }
                          isDark={isDark}
                        />
                      );
                    }

                    // @kobra/question-card handler for question/faq/quiz codeblocks
                    if (
                      childClassName.includes('language-question') ||
                      childClassName.includes('language-faq') ||
                      childClassName.includes('language-quiz')
                    ) {
                      const lines = childContent.split('\n').filter(Boolean);
                      const qTitle = lines[0]?.replace(/^[#?*-]\s*/, '') || 'Related Questions';
                      const optLines = lines.slice(1).map((l) => l.replace(/^[0-9.*-]+\s*/, '').trim()).filter(Boolean);
                      return (
                        <QuestionCard
                          question={qTitle}
                          options={
                            optLines.length > 0
                              ? optLines
                              : [
                                  'Explain this in greater technical depth',
                                  'What are the primary real-world use cases?',
                                  'Show a complete working code example',
                                ]
                          }
                          onSelectOption={onAskKinich}
                          isDark={isDark}
                        />
                      );
                    }

                    // @kobra/weather codeblock handler
                    if (childClassName.includes('language-weather')) {
                      return (
                        <WeatherCard
                          locationQuery={childContent.split('\n')[0]?.trim() || 'New York'}
                          isDark={isDark}
                        />
                      );
                    }

                    // @kobra/image-generation codeblock handler
                    if (
                      childClassName.includes('language-image-gen') ||
                      childClassName.includes('language-image-generation')
                    ) {
                      return (
                        <ImageGenerationCard
                          prompt={childContent.split('\n')[0]?.trim() || 'Minimalist architectural space'}
                          isDark={isDark}
                          fallbackImages={message.images}
                        />
                      );
                    }

                    // Render Mermaid diagrams using Pele engine
                    if (
                      childClassName.includes('language-mermaid') ||
                      childClassName.includes('mermaid') ||
                      childContent.startsWith('graph ') ||
                      childContent.startsWith('graph TD') ||
                      childContent.startsWith('flowchart ') ||
                      childContent.startsWith('sequenceDiagram') ||
                      childContent.startsWith('classDiagram') ||
                      childContent.startsWith('stateDiagram') ||
                      childContent.startsWith('erDiagram') ||
                      childContent.startsWith('gantt')
                    ) {
                      return (
                        <Suspense fallback={<CodeBlockSkeleton isDark={isDark} />}>
                          <PeleDiagram code={childContent} isDark={isDark} />
                        </Suspense>
                      );
                    }

                    const isCustomBlock =
                      childClassName.includes('svg-render') ||
                      childClassName.includes('language-svg') ||
                      childClassName.includes('generative-ui') ||
                      childClassName.includes('open-generative-ui') ||
                      childClassName.includes('a2ui') ||
                      (childContent.startsWith('<svg') && childContent.endsWith('</svg>'));

                    if (isCustomBlock) {
                      return <>{children}</>;
                    }
                    const matchLang = /language-([\w+-]+)/.exec(childClassName || '');
                    const lang = matchLang ? matchLang[1] : '';
                    return (
                      <TerminalCodeBlock
                        language={lang}
                        code={childContent}
                        isDark={isDark}
                      />
                    );
                  },
                  code: ({ node, className, children, ...props }) => {
                    const strContent = String(children || '').replace(/\n$/, '');
                    const trimmed = strContent.trim();
                    const isInline = !className && typeof children === 'string' && !children.includes('\n');

                    if (isInline) {
                      return (
                        <code
                          className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                            isDark ? 'bg-[#111111] text-[#ededed]' : 'bg-[#f5f5f5] text-[#000000]'
                          }`}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }

                    // Render SVG diagrams natively via dangerouslySetInnerHTML
                    if (
                      className?.includes('svg-render') ||
                      className?.includes('language-svg') ||
                      (trimmed.startsWith('<svg') && trimmed.endsWith('</svg>'))
                    ) {
                      return (
                        <div
                          className={`my-4 p-4 rounded-2xl border overflow-x-auto ${
                            isDark ? 'bg-[#0a0a0a] border-[#1f1f1f]' : 'bg-[#ffffff] border-[#e5e5e5]'
                          }`}
                          dangerouslySetInnerHTML={{ __html: trimmed }}
                        />
                      );
                    }

                    // Only render GenerativeUiViewer when explicitly tagged as generative-ui
                    const isGenUi =
                      className?.includes('generative-ui') ||
                      className?.includes('open-generative-ui') ||
                      className?.includes('a2ui');

                    if (isGenUi) {
                      return <GenerativeUiViewer code={strContent} title="Interactive Component" />;
                    }

                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {processedContent}
              </ReactMarkdown>
            </StreamingText>
            </div>
            {isLongAssistantMessage && !isAssistantMsgExpanded && (
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t ${
                  isDark ? 'from-black via-black/70 to-transparent' : 'from-white via-white/75 to-transparent'
                }`}
              />
            )}
          </div>

          {/* Clean Expand / Collapse Control for Long AI Responses */}
          {isLongAssistantMessage && (
            <div className="mt-1.5 mb-1 flex items-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAssistantMsgExpanded((prev) => !prev);
                }}
                data-testid="toggle-assistant-message-expand"
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-medium transition-colors duration-200 cursor-pointer select-none ${
                  isDark
                    ? 'bg-neutral-900/75 hover:bg-neutral-800/90 border-white/[0.12] text-[#cfd3d6] hover:text-white'
                    : 'bg-neutral-100/85 hover:bg-neutral-200/85 border-black/[0.08] text-[#43454a] hover:text-black'
                }`}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
                    isAssistantMsgExpanded ? 'rotate-180' : 'rotate-0'
                  }`}
                />
                <span>
                  {isAssistantMsgExpanded
                    ? 'Collapse response'
                    : `Expand response (${assistantWordCount.toLocaleString()} words)`}
                </span>
              </button>
            </div>
          )}

          {/* @kobra/product-cards: Intelligently triggered on product/buying/comparison queries */}
          {!message.isStreaming &&
            cleanedContent.length > 120 &&
            (() => {
              const detectedProducts = extractProductsFromContext(
                message.searchQueries?.[0] || threadTitle || '',
                cleanedContent,
                (message.sources || []).map((s) => ({
                  title: s.title,
                  url: s.url,
                  domain: s.domain,
                }))
              );
              if (detectedProducts.length === 0) return null;
              return (
                <ProductCards
                  products={detectedProducts}
                  isDark={isDark}
                  onAskProduct={onAskKinich}
                />
              );
            })()}

          {/* @kobra/agent-map: Intelligently triggered on spatial/location/itinerary or multi-agent workflow queries */}
          {!message.isStreaming &&
            cleanedContent.length > 120 &&
            (() => {
              const mapData = extractAgentMapFromContext(
                message.searchQueries?.[0] || threadTitle || '',
                cleanedContent
              );
              if (!mapData) return null;
              return (
                <AgentMap
                  title={mapData.title}
                  subtitle={mapData.subtitle}
                  mode={mapData.mode}
                  nodes={mapData.nodes}
                  isDark={isDark}
                  onSelectNodePrompt={onAskKinich}
                />
              );
            })()}

        {/* Lightbox Modal for Active Image */}
          {displayedImages.length > 0 && activeImageIndex !== null && displayedImages[activeImageIndex] && (
            <div>
              {activeImageIndex !== null && displayedImages[activeImageIndex] && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
                  onClick={() => setActiveImageIndex(null)}
                >
                  <div
                    className="relative max-w-4xl w-full flex flex-col items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-full flex items-center justify-between mb-3 px-1">
                      <div className="min-w-0 pr-4">
                        <div className="text-sm font-medium text-white truncate">
                          {displayedImages[activeImageIndex].title}
                        </div>
                        {displayedImages[activeImageIndex].link && (
                          <a
                            href={displayedImages[activeImageIndex].link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#a3a3a3] hover:text-white inline-flex items-center gap-1 hover:underline"
                          >
                            <span>{displayedImages[activeImageIndex].domain || 'View source'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            triggerMediaDownload(
                              displayedImages[activeImageIndex].imageUrl,
                              displayedImages[activeImageIndex].thumbnailUrl,
                              displayedImages[activeImageIndex].title,
                              'image'
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black hover:bg-[#e5e5e5] text-xs font-medium cursor-pointer"
                          title="Download image"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveImageIndex(null)}
                          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                          title="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="relative w-full flex items-center justify-center">
                      {displayedImages.length > 1 && (
                        <button
                          onClick={() =>
                            setActiveImageIndex(
                              (activeImageIndex - 1 + displayedImages.length) % displayedImages.length
                            )
                          }
                          className="absolute left-2 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/15 cursor-pointer"
                          title="Previous image"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      )}

                      <img
                        src={
                          displayedImages[activeImageIndex].imageUrl ||
                          displayedImages[activeImageIndex].thumbnailUrl
                        }
                        alt={displayedImages[activeImageIndex].title}
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fallback = displayedImages[activeImageIndex].thumbnailUrl;
                          if (fallback && target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                        className="max-h-[75vh] max-w-full rounded-2xl object-contain border border-white/10"
                      />

                      {displayedImages.length > 1 && (
                        <button
                          onClick={() =>
                            setActiveImageIndex((activeImageIndex + 1) % displayedImages.length)
                          }
                          className="absolute right-2 z-10 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/15 cursor-pointer"
                          title="Next image"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Finance, Crypto & Stock Terminal Cards */}
          {liveFinanceQuotes.length > 0 && (
            <div className={`mt-4 pt-3 border-t ${isDark ? 'border-[#1f1f1f]' : 'border-[#e5e5e5]'}`}>
              <div className={`text-[11px] mb-1 ${isDark ? 'text-[#666666]' : 'text-[#8a8a8a]'}`}>
                Live Market Terminal
              </div>
              <div className="space-y-3">
                {liveFinanceQuotes.map((quote) => (
                  <FinanceTerminalCard
                    key={quote.symbol}
                    quote={quote}
                    isDark={isDark}
                    onAskKinich={onAskKinich}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ArXiv Papers Section */}
          {message.arxivPapers && message.arxivPapers.length > 0 && (
            <div className={`mt-4 pt-3 border-t ${isDark ? 'border-[#1f1f1f]' : 'border-[#e5e5e5]'}`}>
              <div className={`text-[11px] mb-1 ${isDark ? 'text-[#666666]' : 'text-[#8a8a8a]'}`}>
                Papers
              </div>
              <div>
                {message.arxivPapers.map((paper) => (
                  <ArxivPaperCard
                    key={paper.id}
                    paper={paper}
                    isDark={isDark}
                    onAskKinich={onAskKinich}
                  />
                ))}
              </div>
            </div>
          )}

          {/* GitHub Repositories Section */}
          {message.githubRepos && message.githubRepos.length > 0 && (
            <div className={`mt-4 pt-3 border-t ${isDark ? 'border-[#1f1f1f]' : 'border-[#e5e5e5]'}`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                  GitHub Repositories ({message.githubRepos.length})
                </span>
                <span className={`text-[10px] ${isDark ? 'text-[#666666]' : 'text-[#8a8a8a]'}`}>
                  Live Code & Downloads
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {message.githubRepos.map((repo, idx) => (
                  <GithubRepoCard
                    key={idx}
                    repo={repo}
                    isDark={isDark}
                    onAskKinich={onAskKinich}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Real Social Posts & Handles Component (X/Twitter, Reddit, etc.) */}
          {(() => {
            const rawPosts =
              message.xPosts && message.xPosts.length > 0
                ? message.xPosts
                : (message.sources || [])
                    .filter((s) => Boolean(s.socialMeta))
                    .map((s) => sourceToXPost(s))
                    .filter((post): post is NonNullable<typeof post> => post !== null);

            const seenKeys = new Set<string>();
            const uniquePosts = rawPosts.filter((post) => {
              const statusId = post.url?.match(/status\/(\d+)/i)?.[1] || post.id;
              const idKey = String(statusId || post.url || '').trim();
              const textKey = String(post.text || '')
                .replace(/https?:\/\/\S+/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
              if ((idKey && seenKeys.has(`id:${idKey}`)) || (textKey.length > 3 && seenKeys.has(`txt:${textKey}`))) {
                return false;
              }
              if (idKey) seenKeys.add(`id:${idKey}`);
              if (textKey.length > 3) seenKeys.add(`txt:${textKey}`);
              return true;
            });

            if (uniquePosts.length === 0) return null;

            return (
              <div className={`mt-3 pt-2.5 border-t ${isDark ? 'border-[#1f1f1f]' : 'border-[#e5e5e5]'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                    X / Social Posts ({uniquePosts.length})
                  </span>
                  <span className={`text-[10px] ${isDark ? 'text-[#666666]' : 'text-[#8a8a8a]'}`}>
                    Latest · Live Metrics
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {uniquePosts.map((post) => (
                    <XPostCard key={post.id || post.url} post={post} isDark={isDark} />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Compact Side-Scrollable Video Cards & Pop-Up Video Player Modal */}
          {message.videos && message.videos.length > 0 && (
            <div className={`mt-4 pt-3 border-t ${isDark ? 'border-[#1f1f1f]' : 'border-[#e5e5e5]'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                    Videos ({message.videos.length})
                  </span>
                  <span aria-hidden="true" className={isDark ? 'text-[#444444]' : 'text-[#cccccc]'}>
                    ·
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-[#8a8a8a]' : 'text-[#666666]'}`}>
                    Swipe or click to play
                  </span>
                </div>

                {message.videos.length > 2 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollVideoCarousel('left')}
                      className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                        isDark
                          ? 'border-[#222222] bg-[#0d0d0d] text-[#a3a3a3] hover:text-white hover:border-[#3a3a3a]'
                          : 'border-[#e5e5e5] bg-[#f8f8f8] text-[#666666] hover:text-black hover:border-[#cccccc]'
                      }`}
                      title="Scroll left"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollVideoCarousel('right')}
                      className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                        isDark
                          ? 'border-[#222222] bg-[#0d0d0d] text-[#a3a3a3] hover:text-white hover:border-[#3a3a3a]'
                          : 'border-[#e5e5e5] bg-[#f8f8f8] text-[#666666] hover:text-black hover:border-[#cccccc]'
                      }`}
                      title="Scroll right"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Single-Row Side-Scrollable / Swipeable Compact Video Cards */}
              <div
                ref={videoCarouselRef}
                className="flex items-stretch gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none -mx-1 px-1"
              >
                {message.videos.map((vid, idx) => {
                  const isPlaying = activeVideoIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => handlePlayVideo(idx)}
                      className={`group/vid w-[160px] sm:w-[180px] flex-shrink-0 snap-start rounded-xl border overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${
                        isPlaying
                          ? isDark
                            ? 'bg-[#161616] border-white'
                            : 'bg-[#f5f5f5] border-black'
                          : isDark
                          ? 'bg-[#0a0a0a] border-[#1f1f1f] hover:border-[#3a3a3a]'
                          : 'bg-[#ffffff] border-[#e5e5e5] hover:border-[#cccccc]'
                      }`}
                    >
                      <div className="relative aspect-video bg-black overflow-hidden">
                        {vid.thumbnail ? (
                          <img
                            src={vid.thumbnail}
                            alt={vid.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover/vid:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#111111]">
                            <Youtube className="w-6 h-6 text-white/30" />
                          </div>
                        )}

                        {/* Compact Play Button Overlay */}
                        <div className="absolute inset-0 bg-black/25 group-hover/vid:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-black/80 border border-white/25 flex items-center justify-center text-white transition-transform group-hover/vid:scale-110 shadow-md">
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* Top-left Source Badge */}
                        {vid.source && (
                          <span className="absolute top-1 left-1 bg-black/75 px-1.5 py-0.5 rounded text-[9px] text-white/90 truncate max-w-[95px]">
                            {vid.source}
                          </span>
                        )}

                        {/* Top-right Direct Action Buttons: Study & Download */}
                        <div className="absolute top-1 right-1 flex items-center gap-1 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveStudyVideo(vid);
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/80 hover:bg-black text-white text-[9px] font-medium border border-white/20 opacity-90 sm:opacity-0 sm:group-hover/vid:opacity-100 transition-opacity cursor-pointer shadow-sm"
                            title="Study Workspace (Transcript, Flashcards, Quiz)"
                          >
                            <BookOpen className="w-2.5 h-2.5" />
                            <span>Study</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerMediaDownload(
                                vid.videoUrl || vid.link,
                                vid.thumbnail,
                                vid.title,
                                'video'
                              );
                            }}
                            className="p-1 rounded-full bg-black/75 hover:bg-black text-white border border-white/15 opacity-90 sm:opacity-0 sm:group-hover/vid:opacity-100 transition-opacity cursor-pointer"
                            title="Download video"
                          >
                            <Download className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {vid.length && (
                          <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[9px] font-mono text-white leading-none">
                            {vid.length}
                          </span>
                        )}
                      </div>

                      <div className="p-2 flex flex-col justify-between flex-1">
                        <div
                          className={`font-medium line-clamp-2 text-[11px] leading-snug ${
                            isDark ? 'text-white' : 'text-[#000000]'
                          }`}
                          title={vid.title}
                        >
                          {vid.title}
                        </div>
                        <div
                          className={`text-[10px] mt-1 flex items-center justify-between gap-1 ${
                            isDark ? 'text-[#737373]' : 'text-[#8a8a8a]'
                          }`}
                        >
                          <span className="truncate">{vid.author || vid.source || 'Video'}</span>
                          {vid.views && <span className="flex-shrink-0">{vid.views}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pop-Up Modal Video Player */}
              {activeVideoIndex !== null && message.videos[activeVideoIndex] && (() => {
                const activeVid = message.videos![activeVideoIndex];
                const resolved = resolvedVideos[activeVideoIndex] || {};
                const rawMp4Url = resolved.videoUrl || activeVid.videoUrl || '';
                const effectiveMp4Url = rawMp4Url
                  ? resolved.useProxyStream
                    ? `/api/media/stream?url=${encodeURIComponent(rawMp4Url)}`
                    : rawMp4Url
                  : '';
                const effectiveEmbedUrl = getUniversalClientEmbedUrl(
                  activeVid.link,
                  activeVid.videoId,
                  resolved.embedUrl || activeVid.embedUrl
                );

                const canEmbed = Boolean(effectiveEmbedUrl);
                const canStreamMp4 = Boolean(effectiveMp4Url);
                const useMp4Player = canStreamMp4 && (videoPlayerMode === 'mp4' || !canEmbed);

                return (
                  <div
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
                    onClick={() => setActiveVideoIndex(null)}
                  >
                    <div
                      className={`relative w-full max-w-4xl rounded-2xl overflow-hidden border shadow-2xl flex flex-col ${
                        isDark ? 'bg-[#0a0a0a] border-[#262626]' : 'bg-[#ffffff] border-[#d4d4d4]'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Pop-Up Video Player Header Bar */}
                      <div
                        className={`flex items-center justify-between gap-2 px-4 py-3 border-b text-xs ${
                          isDark ? 'border-[#1f1f1f] text-white' : 'border-[#e5e5e5] text-[#000000]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate text-xs sm:text-sm">{activeVid.title}</div>
                          <div className={`text-[11px] truncate ${isDark ? 'text-[#8a8a8a]' : 'text-[#666666]'}`}>
                            {activeVid.author}
                            {activeVid.source && activeVid.source !== activeVid.author ? ` · ${activeVid.source}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Prev / Next Video Controls */}
                          {message.videos!.length > 1 && (
                            <div className="flex items-center gap-1 mr-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handlePlayVideo(
                                    (activeVideoIndex - 1 + message.videos!.length) % message.videos!.length
                                  )
                                }
                                className={`p-1.5 rounded-lg border cursor-pointer ${
                                  isDark
                                    ? 'border-[#262626] text-[#a3a3a3] hover:text-white hover:bg-[#141414]'
                                    : 'border-[#e5e5e5] text-[#666666] hover:text-black hover:bg-[#f0f0f0]'
                                }`}
                                title="Previous video"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handlePlayVideo((activeVideoIndex + 1) % message.videos!.length)
                                }
                                className={`p-1.5 rounded-lg border cursor-pointer ${
                                  isDark
                                    ? 'border-[#262626] text-[#a3a3a3] hover:text-white hover:bg-[#141414]'
                                    : 'border-[#e5e5e5] text-[#666666] hover:text-black hover:bg-[#f0f0f0]'
                                }`}
                                title="Next video"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {canEmbed && canStreamMp4 && (
                            <button
                              type="button"
                              onClick={() => setVideoPlayerMode(useMp4Player ? 'embed' : 'mp4')}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                                isDark
                                  ? 'bg-[#141414] border-[#2a2a2a] text-[#ededed] hover:bg-[#1f1f1f]'
                                  : 'bg-[#ffffff] border-[#e0e0e0] text-[#111111] hover:bg-[#f0f0f0]'
                              }`}
                              title="Switch between Embed Player and Direct Stream"
                            >
                              {useMp4Player ? 'Embed Player' : 'Direct Stream'}
                            </button>
                          )}

                          {/* Study Workspace Button (Transcript, Flashcards, Quiz, Video Q&A) */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStudyVideo(activeVid);
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                              isDark
                                ? 'bg-[#18181b] border-[#2e2e33] text-[#ededed] hover:bg-[#27272a]'
                                : 'bg-[#f4f4f5] border-[#d4d4d8] text-[#18181b] hover:bg-[#e4e4e7]'
                            }`}
                            title="Open YouTube Study Workspace (Transcript, Flashcards, Quiz)"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span className="hidden sm:inline">Study Workspace</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              triggerMediaDownload(
                                rawMp4Url || activeVid.link,
                                activeVid.thumbnail,
                                activeVid.title,
                                'video'
                              );
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
                              isDark
                                ? 'bg-white text-black hover:bg-[#e5e5e5]'
                                : 'bg-black text-white hover:bg-[#222222]'
                            }`}
                            title="Download video"
                          >
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Download</span>
                          </button>

                          {activeVid.link && (
                            <a
                              href={activeVid.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isDark
                                  ? 'border-[#262626] text-[#a3a3a3] hover:text-white hover:bg-[#141414]'
                                  : 'border-[#e5e5e5] text-[#666666] hover:text-black hover:bg-[#f0f0f0]'
                              }`}
                              title="Open source webpage"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => setActiveVideoIndex(null)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isDark
                                ? 'text-[#a3a3a3] hover:text-white hover:bg-[#141414]'
                                : 'text-[#666666] hover:text-black hover:bg-[#f0f0f0]'
                            }`}
                            title="Close video player"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Video Viewport */}
                      <div className="aspect-video w-full bg-black relative flex items-center justify-center">
                        {useMp4Player ? (
                          <video
                            key={`mp4-${effectiveMp4Url}`}
                            src={effectiveMp4Url}
                            poster={activeVid.thumbnail}
                            controls
                            autoPlay
                            playsInline
                            onError={() => {
                              if (!resolved.useProxyStream && rawMp4Url) {
                                setResolvedVideos((prev) => ({
                                  ...prev,
                                  [activeVideoIndex]: {
                                    ...prev[activeVideoIndex],
                                    videoUrl: rawMp4Url,
                                    useProxyStream: true,
                                  },
                                }));
                              } else if (canEmbed) {
                                setVideoPlayerMode('embed');
                              }
                            }}
                            className="w-full h-full object-contain bg-black"
                          />
                        ) : (
                          <iframe
                            key={`embed-${effectiveEmbedUrl}`}
                            src={effectiveEmbedUrl}
                            className="w-full h-full border-0 bg-black"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                            allowFullScreen
                          />
                        )}
                      </div>

                      {/* Mini Horizontal Playlist Strip inside Modal when multiple videos exist */}
                      {message.videos!.length > 1 && (
                        <div
                          className={`flex items-center gap-2 overflow-x-auto px-3.5 py-2.5 border-t scrollbar-none ${
                            isDark ? 'bg-[#080808] border-[#1f1f1f]' : 'bg-[#f7f7f7] border-[#e5e5e5]'
                          }`}
                        >
                          {message.videos!.map((v, i) => {
                            const selected = i === activeVideoIndex;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handlePlayVideo(i)}
                                className={`flex items-center gap-2 p-1.5 rounded-lg border flex-shrink-0 w-[180px] text-left transition-all cursor-pointer ${
                                  selected
                                    ? isDark
                                      ? 'bg-[#181818] border-white text-white'
                                      : 'bg-white border-black text-black'
                                    : isDark
                                    ? 'bg-[#0e0e0e] border-[#1f1f1f] text-[#a3a3a3] hover:border-[#333333]'
                                    : 'bg-white/70 border-[#e0e0e0] text-[#525252] hover:border-[#bbbbbb]'
                                }`}
                              >
                                <div className="relative w-12 aspect-video rounded overflow-hidden bg-black flex-shrink-0">
                                  {v.thumbnail && (
                                    <img
                                      src={v.thumbnail}
                                      alt={v.title}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] font-medium line-clamp-1">{v.title}</div>
                                  <div className="text-[9px] opacity-70 truncate">
                                    {v.author || v.source}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}



          {/* Saved Knowledge Vault Highlights Strip for this AI Response */}
          {savedMessageHighlights.length > 0 && !message.isStreaming && (
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              {onOpenKnowledgeVault && (
                <button
                  type="button"
                  onClick={onOpenKnowledgeVault}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-medium shrink-0 transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/[0.08] hover:bg-white/[0.14] text-white/90'
                      : 'bg-black/[0.06] hover:bg-black/[0.1] text-black/85'
                  }`}
                >
                  Vault ({savedMessageHighlights.length})
                </button>
              )}
              {savedMessageHighlights.map((hl) => (
                <div
                  key={hl.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] max-w-[240px] shrink-0 ${
                    isDark
                      ? 'bg-white/[0.04] border-white/[0.1] text-white/80'
                      : 'bg-black/[0.03] border-black/[0.08] text-black/80'
                  }`}
                >
                  <span className="truncate" title={hl.content}>
                    {hl.content}
                  </span>
                  <button
                    type="button"
                    onClick={() => KnowledgeVaultStore.deleteItem(hl.id)}
                    className="opacity-50 hover:opacity-100 cursor-pointer shrink-0"
                    title="Remove highlight"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Assistant Action Bar & Timing Tooltip (Hidden until hover or tap) */}
          {!message.isStreaming && (
            <div
              className={`items-center justify-between transition-opacity duration-150 ${
                showActionsOnTap ||
                showTtsPopup ||
                copied ||
                savedToVault ||
                showSegmentPicker ||
                segmentSavedToast
                  ? 'mt-1 flex opacity-100'
                  : 'hidden group-hover/msg:mt-1 group-hover/msg:flex group-hover/msg:opacity-100'
              }`}
            >
              <div className={`flex flex-wrap items-center gap-1.5 ${isDark ? 'text-[#6b6b6b]' : 'text-[#9ca3af]'}`}>
                {/* On-demand Read Aloud Icon + Popup */}
                <button
                  type="button"
                  onClick={() => setShowTtsPopup(true)}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isDark ? 'hover:text-white' : 'hover:text-[#0d0d0d]'
                  }`}
                  title="Read aloud"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>

                {showTtsPopup && (
                  <Suspense
                    fallback={
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-[#FC4C01]"
                        aria-busy="true"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </span>
                    }
                  >
                    <TtsPopup
                      text={message.content || ''}
                      onClose={() => setShowTtsPopup(false)}
                      isDark={isDark}
                    />
                  </Suspense>
                )}

                <button
                  onClick={copyText}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isDark ? 'hover:text-white' : 'hover:text-[#0d0d0d]'
                  }`}
                  title="Copy"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {onRetry && (
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayedImages([]);
                      setActiveImageIndex(null);
                      setHasMoreImages(false);
                      onRetry();
                    }}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      isDark ? 'hover:text-white' : 'hover:text-[#0d0d0d]'
                    }`}
                    title="Reload response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleTogglePin}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isPinned
                      ? isDark
                        ? 'text-white'
                        : 'text-neutral-900'
                      : isDark
                      ? 'hover:text-white'
                      : 'hover:text-[#0d0d0d]'
                  }`}
                  title={isPinned ? 'Unpin message' : 'Pin message'}
                  aria-label={isPinned ? 'Unpin message' : 'Pin message'}
                >
                  <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (UserAccountStore.isGuest()) {
                      window.dispatchEvent(
                        new CustomEvent('kinich-open-auth', {
                          detail: { reason: 'Sign in to keep this in your Vault' },
                        })
                      );
                      return;
                    }
                    setShowSegmentPicker((prev) => !prev);
                  }}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    showSegmentPicker || savedMessageHighlights.length > 0
                      ? isDark
                        ? 'text-white'
                        : 'text-neutral-900'
                      : isDark
                      ? 'hover:text-white'
                      : 'hover:text-[#0d0d0d]'
                  }`}
                  title="Highlight segments"
                  aria-label="Highlight segments"
                >
                  <Highlighter className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleSaveToKnowledgeVault}
                  data-testid="chat-save-to-vault-btn"
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    savedToVault
                      ? 'text-emerald-500'
                      : isDark
                      ? 'hover:text-white'
                      : 'hover:text-[#0d0d0d]'
                  }`}
                  title={
                    isGuestUser
                      ? 'Sign in to save'
                      : savedToVault
                      ? 'Saved to Vault'
                      : 'Save to Vault'
                  }
                  aria-label={savedToVault ? 'Saved to Vault' : 'Save to Vault'}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${savedToVault ? 'fill-current' : ''}`} />
                </button>

                {onOpenShareStudio && (
                  <button
                    type="button"
                    onClick={() => onOpenShareStudio(message, 'quote')}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      isDark ? 'hover:text-white' : 'hover:text-[#0d0d0d]'
                    }`}
                    title="Create Kinich Share Card or Export"
                    aria-label="Create Kinich Share Card"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    openKinichReportModal({
                      targetType: 'ai_answer',
                      targetId: message.id,
                      contentPreview: String(message.content || '').slice(0, 400),
                    })
                  }
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isDark ? 'hover:text-red-400' : 'hover:text-red-600'
                  }`}
                  title="Report AI output or safety issue"
                  aria-label="Report AI output"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Timing Tooltip */}
              {message.timing && (
                <GrokTimingTooltip timing={message.timing} messageContent={message.content} isDark={isDark} />
              )}
            </div>
          )}

          {/* Personal Study Agent Reply Cards in Thread (Sage, Doubt Buddy, Planner, Recall) */}
          {(liveAgentCards.length > 0 || (Array.isArray(message.agentReplies) && message.agentReplies.length > 0) || message.agentReply) && (
            <div className="mt-2.5 space-y-2">
              {(liveAgentCards.length > 0
                ? liveAgentCards
                : message.agentReplies || (message.agentReply ? [message.agentReply] : [])
              ).map((card) => (
                <div
                  key={card.id}
                  data-testid={`agent-reply-card-${card.agentId}`}
                  className={`rounded-lg border p-3 transition-colors ${
                    isDark
                      ? 'bg-white/[0.02] border-white/10 text-neutral-200'
                      : 'bg-black/[0.02] border-black/10 text-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${
                        isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black'
                      }`}>
                        {card.agentId === 'sage' ? (
                          <Sparkles className="w-3 h-3" />
                        ) : (
                          <Bot className="w-3 h-3" />
                        )}
                      </span>
                      <span className="text-xs font-medium">
                        {card.agentName}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-normal border ${
                          isDark
                            ? 'bg-white/[0.04] border-white/10 text-neutral-400'
                            : 'bg-black/[0.04] border-black/10 text-neutral-600'
                        }`}
                      >
                        {card.agentRole}
                      </span>
                    </div>
                    {card.subject && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-normal ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        <FolderOpen className="w-3 h-3" />
                        {card.subject}
                        {card.chapter ? ` → ${card.chapter}` : ''}
                      </span>
                    )}
                  </div>

                  <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    {card.content}
                  </p>

                  {Array.isArray(card.linkedItems) && card.linkedItems.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-current/10 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        <Link2 className="w-3 h-3" /> Linked in Vault:
                      </span>
                      {card.linkedItems.map((li) => (
                        <span
                          key={li.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            isDark
                              ? 'bg-white/[0.04] border-white/10 text-neutral-300'
                              : 'bg-black/[0.04] border-black/10 text-neutral-700'
                          }`}
                        >
                          {li.title} ({li.subject} → {li.chapter})
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(card.citations) && card.citations.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-current/10 flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-medium ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        Vault Citations:
                      </span>
                      {card.citations.map((cit, cIdx) => (
                        <span
                          key={`${cit.vaultItemId}_${cIdx}`}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                            isDark
                              ? 'bg-white/[0.04] border-white/10 text-neutral-300'
                              : 'bg-black/[0.04] border-black/10 text-neutral-700'
                          }`}
                        >
                          {cit.title}
                          {cit.timestamp ? ` @ ${cit.timestamp}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Glassmorphic Lightbox for User-Uploaded Image Attachments */}
      {previewAttachmentUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-in fade-in duration-150"
          onClick={() => setPreviewAttachmentUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/[0.18] bg-neutral-950/80 backdrop-blur-2xl shadow-2xl p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.1]">
              <span className="text-xs font-medium text-white truncate max-w-md">
                {previewAttachmentUrl.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewAttachmentUrl(null)}
                className="p-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewAttachmentUrl.url}
              alt={previewAttachmentUrl.name}
              className="max-h-[80vh] max-w-full object-contain mx-auto block rounded-2xl mt-2"
            />
          </div>
        </div>
      )}

      {/* Inbuilt Padded PDF Quiz, Flashcards & Study Studio Popup */}
      {pdfViewerData && (
        <Suspense fallback={<ModalSkeleton isDark={isDark} />}>
          <InbuiltPdfViewer
            isOpen={pdfViewerData.isOpen}
            onClose={() => setPdfViewerData(null)}
            pdfUrl={pdfViewerData.pdfUrl}
            pdfName={pdfViewerData.pdfName}
            extractedText={pdfViewerData.extractedText}
            initialTab={pdfViewerData.initialTab}
            isDark={isDark}
            onAskKinich={onAskKinich}
          />
        </Suspense>
      )}

      {/* Padded Rich Citation Pop-up Modal */}
      <CitationModal
        source={selectedCitation}
        isOpen={selectedCitation !== null}
        onClose={() => setSelectedCitation(null)}
        isDark={isDark}
      />

      {/* Full-Screen Dedicated YouTube Study & Transcript Workspace */}
      {activeStudyVideo && (
        <Suspense fallback={<ModalSkeleton isDark={isDark} />}>
          <YouTubeTranscriptModal
            isOpen={Boolean(activeStudyVideo)}
            onClose={() => setActiveStudyVideo(null)}
            video={activeStudyVideo}
            isDark={isDark}
            onAskKinich={onAskKinich}
          />
        </Suspense>
      )}
    </div>
  );
};
