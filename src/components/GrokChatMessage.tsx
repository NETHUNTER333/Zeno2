import React, { useState, useEffect, useMemo } from 'react';
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
  Globe
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ChatMessage as ChatMessageType, YouTubeVideoInfo, FinanceQuote } from '../types';
import { PrismCodeBlock } from './PrismCodeBlock';
import { GrokTimingTooltip } from './GrokTimingTooltip';
import { GenerativeUiViewer } from './GenerativeUiViewer';
import { ArxivPaperCard } from './ArxivPaperCard';
import { GithubRepoCard } from './GithubRepoCard';
import { PersonaWikiCard } from './PersonaWikiCard';
import { InbuiltPdfViewer, PdfStudioTab } from './InbuiltPdfViewer';
import { FinanceTerminalCard } from './FinanceTerminalCard';
import {
  detectFinanceSymbolsInText,
  buildFallbackFinanceQuote,
  fetchLiveFinanceQuoteClient,
} from '../lib/financeMarket';
import { getAuthHeaders } from '../lib/firebase';
import { WebSearch, WebSearchCitation, CitationModal, WebSearchSource } from './ui/web-search';
import { LoadingBreadcrumb } from './ui/animated-loading-svg-text-shimmer';
import { XPostCard } from './XPostCard';
import { extractSocialMeta, sourceToXPost } from '../lib/socialEnricher';
import {
  StreamingText,
  InlineCitation,
  InlineCitationsList,
  PlanCard,
  QuestionCard
} from './kobra';
import { PeleDiagram } from './PeleDiagram';
import { TtsPopup } from './TtsPopup';
import { UserAccountStore } from '../lib/userAccountStore';
import { KnowledgeVaultStore } from '../lib/growthStore';
import { YouTubeTranscriptModal, extractYouTubeIdFromInput } from './YouTubeTranscriptModal';
import { ModelOption } from './GrokModelPicker';

interface GrokChatMessageProps {
  message: ChatMessageType;
  threadId?: string;
  threadTitle?: string;
  onRetry?: (modelOverride?: ModelOption) => void;
  onEdit?: (content: string) => void;
  onAskZeno?: (prompt: string) => void;
  onOpenShareStudio?: (
    message: ChatMessageType,
    tab?: 'share' | 'export' | 'quote' | 'publish'
  ) => void;
  theme?: 'dark' | 'light';
  nsfwMode?: boolean;
}

// Client-side helper to convert any video webpage URL into an embeddable player URL
function getUniversalClientEmbedUrl(url?: string, ytId?: string, existingEmbed?: string): string {
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
  if ((m = url.match(/redgifs\.com\/(?:watch|ifr)\/([a-zA-Z0-9_-]+)/i))) {
    return `https://www.redgifs.com/ifr/${m[1]}`;
  }
  if ((m = url.match(/pornhub\.com\/(?:view_video\.php\?viewkey=|embed\/)([a-zA-Z0-9_-]+)/i))) {
    return `https://www.pornhub.com/embed/${m[1]}`;
  }
  if ((m = url.match(/xvideos\.com\/(?:video\.?|embedframe\/)([a-zA-Z0-9]+)/i))) {
    return `https://www.xvideos.com/embedframe/${m[1]}`;
  }
  if ((m = url.match(/xnxx\.com\/(?:video-|embedframe\/)([a-zA-Z0-9]+)/i))) {
    return `https://www.xnxx.com/embedframe/${m[1]}`;
  }
  if ((m = url.match(/xhamster\.com\/(?:videos\/[^/]*?-|embed\/)([a-zA-Z0-9]+)(?:$|[/?#])/i))) {
    return `https://xhamster.com/embed/${m[1]}`;
  }
  if ((m = url.match(/spankbang\.com\/([a-zA-Z0-9]+)\/(?:video|embed)/i))) {
    return `https://spankbang.com/${m[1]}/embed/`;
  }
  if ((m = url.match(/eporner\.com\/(?:video-|hd-porn\/|embed\/)([a-zA-Z0-9]+)/i))) {
    return `https://www.eporner.com/embed/${m[1]}`;
  }
  if ((m = url.match(/youporn\.com\/(?:watch|embed)\/(\d+)/i))) {
    return `https://www.youporn.com/embed/${m[1]}`;
  }
  if ((m = url.match(/motherless\.com\/(?:embed\/)?([A-Z0-9]{6,10})/i))) {
    return `https://motherless.com/embed/${m[1]}`;
  }

  return existingEmbed || `/api/media/embed-proxy?url=${encodeURIComponent(url)}`;
}

const preprocessMessageContent = (content: string): string => {
  if (!content) return '';
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => {
      if (part.startsWith('```')) {
        return part;
      }
      let processed = part;
      // Close any unclosed <svg> tag at the end of the text
      const openSvgCount = (processed.match(/<svg\b/gi) || []).length;
      const closeSvgCount = (processed.match(/<\/svg>/gi) || []).length;
      if (openSvgCount > closeSvgCount) {
        processed += '</svg>';
      }
      // Convert raw <svg>...</svg> blocks into fenced svg-render blocks so CommonMark doesn't split them across <p> tags
      processed = processed.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svgMatch) => {
        return `\n\n\`\`\`svg-render\n${svgMatch.trim()}\n\`\`\`\n\n`;
      });
      // Normalize LaTeX block math \\[ ... \\] to $$ ... $$ and inline math \\( ... \\) to $ ... $
      processed = processed
        .replace(/\\\[([\s\S]*?)\\\]/g, '$$\n$1\n$$')
        .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

      // Prevent runaway markdown headings (#, ##, ###, ####) if a heading line exceeds 100 characters
      processed = processed.replace(/^(#{1,6})\s+(.+)$/gm, (fullMatch, hashes, headingText) => {
        const cleanHeading = headingText.trim();
        if (cleanHeading.length > 100) {
          // Split at the first em-dash, colon, or 75-char boundary so a full paragraph never becomes a giant bold heading
          const dashSplit = cleanHeading.match(/^(.{3,75}?)\s+(?:—|--|:)\s+(.+)$/);
          if (dashSplit) {
            return `${hashes} ${dashSplit[1].trim()}\n\n${dashSplit[2].trim()}`;
          }
          const shortTitle = cleanHeading.split(/\s+/).slice(0, 8).join(' ');
          return `${hashes} ${shortTitle}…\n\n${cleanHeading}`;
        }
        return fullMatch;
      });

      // Convert standalone citations [1], [2], [1, 2], [2][3] into markdown links so ReactMarkdown triggers interactive WebSearchCitation
      processed = processed.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\](?!\()/g, (_, nums) =>
        nums.split(',').map((n: string) => `[${n.trim()}](#cite-${n.trim()})`).join(' ')
      );
      processed = processed.replace(/\[(\d{1,2})\](?!\()/g, '[$1](#cite-$1)');
      return processed;
    })
    .join('');
};

const TerminalCodeBlock: React.FC<{
  language?: string;
  code: string;
  isDark?: boolean;
}> = ({ language = '', code, isDark = true }) => (
  <PrismCodeBlock language={language} code={code} isDark={isDark} />
);

export const GrokChatMessage: React.FC<GrokChatMessageProps> = ({
  message,
  threadId,
  threadTitle,
  onRetry,
  onEdit,
  onAskZeno,
  onOpenShareStudio,
  theme = 'dark',
}) => {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<'good' | 'bad' | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(() =>
    UserAccountStore.getBookmarks().some((b) => b.messageId === message.id)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const [isUserMsgExpanded, setIsUserMsgExpanded] = useState(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [videoPlayerMode, setVideoPlayerMode] = useState<'embed' | 'mp4'>('embed');
  const [resolvedVideos, setResolvedVideos] = useState<
    Record<number, { videoUrl?: string; embedUrl?: string; useProxyStream?: boolean }>
  >({});
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
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

  // Auto-detect stock & crypto tickers ($NVDA, $AAPL, BTC, SOL, etc.) in assistant messages
  useEffect(() => {
    if (isUser) return;
    if (message.financeQuotes && message.financeQuotes.length > 0) {
      setLiveFinanceQuotes(message.financeQuotes);
      return;
    }
    const combinedText = `${(message.searchQueries || []).join(' ')} ${(message.content || '').slice(0, 600)}`;
    const symbols = detectFinanceSymbolsInText(combinedText);
    if (symbols.length === 0) {
      setLiveFinanceQuotes([]);
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
  }, [isUser, message.financeQuotes, message.searchQueries, message.content]);

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
    window.addEventListener('zeno-account-updated', syncPinState);
    return () => window.removeEventListener('zeno-account-updated', syncPinState);
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

  const handleSaveToKnowledgeVault = () => {
    const cleanBody = (message.content || '')
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .trim();
    if (!cleanBody) return;
    KnowledgeVaultStore.saveItem({
      title: threadTitle || cleanBody.replace(/[#*`~>\n]+/g, ' ').trim().slice(0, 72) || 'Zeno Insight',
      summary: cleanBody.replace(/[#*`~>\n]+/g, ' ').trim().slice(0, 220),
      content: cleanBody,
      type: 'ai_response',
      collectionId: 'col_explanations',
      tags: ['chat-insight'],
      sourceThreadId: threadId,
      sourceMessageId: message.id,
      sources: message.sources || [],
    });
    setSavedToVault(true);
    setTimeout(() => setSavedToVault(false), 2200);
  };

  // Thinking tokens are disabled; strip any <think>...</think> blocks directly
  const cleanedContent = (message.content || '')
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .trim();

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

  const processedContent = React.useMemo(
    () => preprocessMessageContent(cleanedContent),
    [cleanedContent]
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
    <div id={`msg-${message.id}`} data-message-id={message.id} className="group/msg py-6 px-4 md:px-0 max-w-3xl mx-auto w-full min-w-0 overflow-hidden transition-all duration-300 rounded-2xl">
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
              className={`w-full max-w-full sm:max-w-2xl rounded-2xl border backdrop-blur-2xl p-3.5 space-y-2.5 transition-all ${
                isDark
                  ? 'bg-white/[0.06] border-white/[0.16] shadow-[0_12px_36px_rgba(0,0,0,0.55)]'
                  : 'bg-white/80 border-black/[0.12] shadow-[0_12px_36px_rgba(0,0,0,0.08)]'
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
                className={`w-full border rounded-xl p-3 text-xs sm:text-sm focus:outline-none font-sans resize-y ${
                  isDark
                    ? 'bg-black/40 border-white/[0.12] text-white focus:border-white/30'
                    : 'bg-white/90 border-black/[0.1] text-[#0d0d0d] focus:border-black/30'
                }`}
                rows={3}
              />
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] ${isDark ? 'text-white/45' : 'text-black/45'}`}>
                  Editing message will regenerate the reply below
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditDraft(message.content);
                    }}
                    className={`px-3 py-1.5 rounded-xl border backdrop-blur-md text-xs font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white/[0.04] border-white/[0.1] text-white/75 hover:text-white hover:bg-white/[0.08]'
                        : 'bg-black/[0.03] border-black/[0.08] text-[#525252] hover:text-black hover:bg-black/[0.06]'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white text-black hover:bg-[#e5e5e5]'
                        : 'bg-[#0d0d0d] text-white hover:bg-[#262626]'
                    }`}
                  >
                    Save & Resend
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end w-full max-w-[90%] sm:max-w-[78%] min-w-0">
              {(() => {
                const rawUserText = message.content || '';
                const lineCount = rawUserText.split('\n').length;
                const isLongUserMessage = rawUserText.length > 420 || lineCount > 10;
                const displayUserText =
                  isLongUserMessage && !isUserMsgExpanded
                    ? rawUserText.split('\n').slice(0, 8).join('\n').slice(0, 360).trim() + '…'
                    : rawUserText;
                return (
                  <div
                    className={`text-[13px] sm:text-[13.5px] leading-[1.55] font-normal px-3.5 py-2.5 rounded-2xl sm:rounded-3xl backdrop-blur-2xl border transition-all w-fit max-w-full min-w-0 overflow-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] ${
                      isDark
                        ? 'bg-white/[0.07] border-white/[0.14] text-white shadow-[0_8px_28px_rgba(0,0,0,0.45)]'
                        : 'bg-white/75 border-black/[0.08] text-[#000000] shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
                    }`}
                  >
                    <div>{displayUserText}</div>
                    {isLongUserMessage && (
                      <button
                        type="button"
                        onClick={() => setIsUserMsgExpanded((prev) => !prev)}
                        className={`mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-white/[0.08] hover:bg-white/[0.14] border-white/[0.14] text-sky-400'
                            : 'bg-black/[0.05] hover:bg-black/[0.09] border-black/[0.1] text-sky-600'
                        }`}
                      >
                        {isUserMsgExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            <span>Show less</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            <span>Show full message ({rawUserText.length.toLocaleString()} chars)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Copy and Edit Buttons Directly Under Sent User Message */}
              <div className="mt-1.5 flex items-center justify-end gap-1.5 px-1">
                <button
                  type="button"
                  onClick={copyText}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border backdrop-blur-xl text-[11px] font-medium transition-all cursor-pointer ${
                    isDark
                      ? 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.1] text-white/65 hover:text-white'
                      : 'bg-white/70 hover:bg-white/95 border-black/[0.08] text-[#525252] hover:text-black'
                  }`}
                  title="Copy message"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border backdrop-blur-xl text-[11px] font-medium transition-all cursor-pointer ${
                      isDark
                        ? 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.1] text-white/65 hover:text-white'
                        : 'bg-white/70 hover:bg-white/95 border-black/[0.08] text-[#525252] hover:text-black'
                    }`}
                    title="Edit message"
                  >
                    <Pencil className="w-3 h-3" />
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
          {((message.sources && message.sources.length > 0) ||
            (message.isStreaming && !cleanedContent && message.loadingMode === 'search')) && (
            <WebSearch
              sources={(message.sources || []).map((s, idx) => ({
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
                (!message.sources || message.sources.length === 0)
                  ? 'searching'
                  : 'done'
              }
              query={message.searchQueries?.[0]}
              isDark={isDark}
              onSelectCitation={(src) => setSelectedCitation(src)}
            />
          )}

          {/* Fast single-line loading indicator only while waiting for text when WebSearch spinner isn't already active */}
          {message.isStreaming &&
            !cleanedContent &&
            (message.loadingMode !== 'search' || (message.sources && message.sources.length > 0)) && (
              <div className="my-1.5">
                <LoadingBreadcrumb
                  text={
                    message.loadingMode === 'vision'
                      ? 'Analyzing image...'
                      : message.loadingMode === 'file'
                      ? 'Reading file...'
                      : 'Generating response...'
                  }
                />
              </div>
            )}

          {/* Persona Wiki Interactive Profile Card (Athletes, Celebrities, Politicians, Public Figures on any scale) */}
          {message.personaWiki && (
            <PersonaWikiCard
              persona={message.personaWiki}
              isDark={isDark}
              onAskZeno={onAskZeno}
            />
          )}

          <div className="prose-grok max-w-none text-[15px] leading-relaxed my-1">
              <StreamingText
                isStreaming={message.isStreaming}
                durationSec={message.timing?.totalSec}
                isDark={isDark}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={{
                  a: ({ node, href, children, ...props }) => {
                    const textStr = String(children || '').trim();
                    const citeMatch =
                      textStr.match(/^\[?(\d+)\]?$/) ||
                      (href ? href.match(/^#cite-(\d+)$/) : null);
                    if (citeMatch) {
                      const num = parseInt(citeMatch[1], 10);
                      if (message.sources && message.sources.length > 0) {
                        const src =
                          message.sources[num - 1] ||
                          message.sources.find((s) => s.url === href) ||
                          message.sources[(num - 1) % message.sources.length];
                        if (src) {
                          return (
                            <WebSearchCitation
                              source={src}
                              index={num}
                              isDark={isDark}
                              onOpenModal={(s) => setSelectedCitation(s)}
                            />
                          );
                        }
                      }
                      return <InlineCitation index={num} isDark={isDark} />;
                    }

                    // Check if href or cite link matches a known web search source
                    if (href && message.sources && message.sources.length > 0) {
                      const matchedIdx = message.sources.findIndex(
                        (s, idx) => s.url === href || href === `#cite-${s.position || idx + 1}`
                      );
                      if (matchedIdx !== -1) {
                        const matched = message.sources[matchedIdx];
                        return (
                          <WebSearchCitation
                            source={matched}
                            index={matched.position || matchedIdx + 1}
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
                          onSelectOption={onAskZeno}
                          isDark={isDark}
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
                      return <PeleDiagram code={childContent} isDark={isDark} />;
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

                    // Check for Generative UI tag or interactive HTML markup
                    const isGenUi =
                      className?.includes('generative-ui') ||
                      className?.includes('open-generative-ui') ||
                      className?.includes('a2ui') ||
                      (className?.includes('html') &&
                        (strContent.includes('<script') ||
                          strContent.includes('<button') ||
                          strContent.includes('<input') ||
                          strContent.includes('class=') ||
                          strContent.includes('className=')));

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
        {/* Interactive Multi-Image Generative UI Gallery */}
          {message.images && message.images.length > 0 && (
            <div className={`mt-4 pt-3 border-t ${isDark ? 'border-[#1f1f1f]' : 'border-[#e5e5e5]'}`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {message.images.map((img, idx) => (
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

                    {/* Direct Image Download Button */}
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

              {/* Lightbox Modal for Active Image */}
              {activeImageIndex !== null && message.images[activeImageIndex] && (
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
                          {message.images[activeImageIndex].title}
                        </div>
                        {message.images[activeImageIndex].link && (
                          <a
                            href={message.images[activeImageIndex].link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#a3a3a3] hover:text-white inline-flex items-center gap-1 hover:underline"
                          >
                            <span>{message.images[activeImageIndex].domain || 'View source'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            triggerMediaDownload(
                              message.images![activeImageIndex].imageUrl,
                              message.images![activeImageIndex].thumbnailUrl,
                              message.images![activeImageIndex].title,
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
                      {message.images.length > 1 && (
                        <button
                          onClick={() =>
                            setActiveImageIndex(
                              (activeImageIndex - 1 + message.images!.length) % message.images!.length
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
                          message.images[activeImageIndex].imageUrl ||
                          message.images[activeImageIndex].thumbnailUrl
                        }
                        alt={message.images[activeImageIndex].title}
                        onError={(e) => {
                          const target = e.currentTarget;
                          const fallback = message.images![activeImageIndex].thumbnailUrl;
                          if (fallback && target.src !== fallback) {
                            target.src = fallback;
                          }
                        }}
                        className="max-h-[75vh] max-w-full rounded-2xl object-contain border border-white/10"
                      />

                      {message.images.length > 1 && (
                        <button
                          onClick={() =>
                            setActiveImageIndex((activeImageIndex + 1) % message.images!.length)
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
                    onAskZeno={onAskZeno}
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
                    onAskZeno={onAskZeno}
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
                    onAskZeno={onAskZeno}
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



          {/* Assistant Action Bar & Timing Tooltip on Hover */}
          {!message.isStreaming && (
            <div className="mt-3 flex items-center justify-between pt-1">
              <div className={`flex items-center gap-1.5 ${isDark ? 'text-[#6b6b6b]' : 'text-[#9ca3af]'}`}>
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
                  <TtsPopup
                    text={message.content || ''}
                    onClose={() => setShowTtsPopup(false)}
                    isDark={isDark}
                  />
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
                    onClick={() => onRetry()}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      isDark ? 'hover:text-white' : 'hover:text-[#0d0d0d]'
                    }`}
                    title="Reload response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setReaction(reaction === 'good' ? null : 'good')}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    reaction === 'good'
                      ? isDark
                        ? 'text-white'
                        : 'text-[#0d0d0d]'
                      : isDark
                      ? 'hover:text-white'
                      : 'hover:text-[#0d0d0d]'
                  }`}
                  title="Good response"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setReaction(reaction === 'bad' ? null : 'bad')}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    reaction === 'bad'
                      ? isDark
                        ? 'text-white'
                        : 'text-[#0d0d0d]'
                      : isDark
                      ? 'hover:text-white'
                      : 'hover:text-[#0d0d0d]'
                  }`}
                  title="Bad response"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleTogglePin}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isPinned
                      ? 'text-[#FC4C01]'
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
                  onClick={handleSaveToKnowledgeVault}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    savedToVault
                      ? 'text-emerald-400'
                      : isDark
                      ? 'hover:text-white'
                      : 'hover:text-[#0d0d0d]'
                  }`}
                  title={savedToVault ? 'Saved to Knowledge Vault' : 'Save to Knowledge Vault'}
                  aria-label="Save to Knowledge Vault"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${savedToVault ? 'fill-current' : ''}`} />
                </button>

                {onOpenShareStudio && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenShareStudio(message, 'quote')}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isDark ? 'hover:text-white' : 'hover:text-[#0d0d0d]'
                      }`}
                      title="Create Zeno Share Card or Export"
                      aria-label="Create Zeno Share Card"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenShareStudio(message, 'publish')}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isDark ? 'hover:text-white' : 'hover:text-[#0d0d0d]'
                      }`}
                      title="Publish as a Public Zeno Page"
                      aria-label="Publish as a Public Zeno Page"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Timing Tooltip */}
              {message.timing && (
                <GrokTimingTooltip timing={message.timing} messageContent={message.content} isDark={isDark} />
              )}
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
        <InbuiltPdfViewer
          isOpen={pdfViewerData.isOpen}
          onClose={() => setPdfViewerData(null)}
          pdfUrl={pdfViewerData.pdfUrl}
          pdfName={pdfViewerData.pdfName}
          extractedText={pdfViewerData.extractedText}
          initialTab={pdfViewerData.initialTab}
          isDark={isDark}
          onAskZeno={onAskZeno}
        />
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
        <YouTubeTranscriptModal
          isOpen={Boolean(activeStudyVideo)}
          onClose={() => setActiveStudyVideo(null)}
          video={activeStudyVideo}
          isDark={isDark}
          onAskZeno={onAskZeno}
        />
      )}
    </div>
  );
};
