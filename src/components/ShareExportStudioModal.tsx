import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  BookOpen,
  Link2,
  Globe,
  Lock,
  Bookmark,
  Send,
} from 'lucide-react';
import {
  ChatMessage,
  DiscoverCategory,
  PublicArtifactType,
  PublicArtifact,
} from '../types';
import {
  exportConversationAsPdf,
  buildNotionReadyMarkdown,
  renderQuoteCardToCanvas,
  downloadQuoteCardPng,
  canvasToBlob,
  QuoteCardConfig,
  ShareCardTheme,
  ShareCardAspectRatio,
} from '../lib/exportChat';
import { publishSharedThreadToFirestore } from '../lib/firebase';
import {
  DISCOVER_CATEGORIES,
  publishPublicArtifact,
  KnowledgeVaultStore,
  trackGrowthEvent,
  getUnlockedCosmeticThemes,
} from '../lib/growthStore';
import { UserAccountStore } from '../lib/userAccountStore';

export interface ShareExportStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  thread: {
    id: string;
    title: string;
    createdAt: number;
    messages: ChatMessage[];
  } | null;
  initialMessageId?: string | null;
  initialQuoteMessage?: ChatMessage | null;
  initialTab?: 'share' | 'export' | 'quote' | 'publish';
  isDark?: boolean;
  onOpenReadOnlyPreview?: (shareId: string, snapshot: any) => void;
  onArtifactPublished?: (artifact: PublicArtifact) => void;
}

export const ShareExportStudioModal: React.FC<ShareExportStudioModalProps> = ({
  isOpen,
  onClose,
  thread,
  initialMessageId = null,
  initialQuoteMessage = null,
  initialTab = 'quote',
  isDark = true,
  onOpenReadOnlyPreview,
  onArtifactPublished,
}) => {
  const [activeTab, setActiveTab] = useState<'quote' | 'publish' | 'share' | 'export'>(initialTab);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareId, setShareId] = useState<string>('');
  const [isPublishingThread, setIsPublishingThread] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedNotion, setCopiedNotion] = useState(false);
  const [copiedCardImage, setCopiedCardImage] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [vaultSavedFeedback, setVaultSavedFeedback] = useState(false);

  const assistantMessages = useMemo(() => {
    if (!thread) return [];
    return thread.messages.filter((m) => m.role === 'assistant' && m.content?.trim());
  }, [thread]);

  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');
  const [quoteTheme, setQuoteTheme] = useState<ShareCardTheme>('carbon');
  const [aspectRatio, setAspectRatio] = useState<ShareCardAspectRatio>('landscape');
  const [includePromptOnCard, setIncludePromptOnCard] = useState(true);
  const [includeAuthorOnCard, setIncludeAuthorOnCard] = useState(false);

  // Editable Share Card text fields so user controls exactly what is exported
  const [customCardTitle, setCustomCardTitle] = useState<string>('');
  const [customPromptText, setCustomPromptText] = useState<string>('');
  const [customAnswerExcerpt, setCustomAnswerExcerpt] = useState<string>('');

  // Public Zeno Page Publishing state (requires explicit user confirmation)
  const [pubTitle, setPubTitle] = useState<string>('');
  const [pubSummary, setPubSummary] = useState<string>('');
  const [pubContent, setPubContent] = useState<string>('');
  const [pubCategory, setPubCategory] = useState<DiscoverCategory>('Research');
  const [pubType, setPubType] = useState<PublicArtifactType>('research_summary');
  const [pubTagsInput, setPubTagsInput] = useState<string>('research, synthesis, zeno');
  const [pubVisibility, setPubVisibility] = useState<'public' | 'private'>('public');
  const [pubShowAuthor, setPubShowAuthor] = useState<boolean>(true);
  const [pubConfirmedConsent, setPubConfirmedConsent] = useState<boolean>(false);
  const [isPublishingArtifact, setIsPublishingArtifact] = useState<boolean>(false);
  const [publishedArtifact, setPublishedArtifact] = useState<PublicArtifact | null>(null);
  const [copiedArtifactUrl, setCopiedArtifactUrl] = useState<boolean>(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unlockedThemes = useMemo(() => getUnlockedCosmeticThemes(), [isOpen]);
  const userProfile = useMemo(() => UserAccountStore.getProfile(), [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setShareUrl('');
      setShareId('');
      setPublishedArtifact(null);
      setPublishError(null);
      setPubConfirmedConsent(false);
      setShareFeedback(null);

      const targetId = initialQuoteMessage?.id || initialMessageId;
      if (targetId && assistantMessages.some((m) => m.id === targetId)) {
        setSelectedAssistantId(targetId);
      } else if (assistantMessages.length > 0) {
        setSelectedAssistantId(assistantMessages[assistantMessages.length - 1].id);
      }
    }
  }, [isOpen, initialTab, initialMessageId, initialQuoteMessage, assistantMessages]);

  const selectedExchange = useMemo(() => {
    if (!thread) return null;
    if (selectedAssistantId) {
      const idx = thread.messages.findIndex((m) => m.id === selectedAssistantId);
      if (idx !== -1) {
        const assistantMsg = thread.messages[idx];
        const prevUserMsg =
          idx > 0 && thread.messages[idx - 1]?.role === 'user' ? thread.messages[idx - 1] : null;
        return {
          assistantMsg,
          promptText: prevUserMsg?.content || '',
        };
      }
    }
    if (initialQuoteMessage) {
      return {
        assistantMsg: initialQuoteMessage,
        promptText: '',
      };
    }
    return null;
  }, [thread, selectedAssistantId, initialQuoteMessage]);

  // Populate editable fields when selected message changes
  useEffect(() => {
    if (!thread) return;
    const rawAnswer = (selectedExchange?.assistantMsg?.content || '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
    const defaultTitle = (thread.title || 'Zeno Research Synthesis').slice(0, 90);
    const defaultPrompt = (selectedExchange?.promptText || '').slice(0, 220);
    const cleanExcerpt = rawAnswer
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 560);

    setCustomCardTitle(defaultTitle);
    setCustomPromptText(defaultPrompt);
    setCustomAnswerExcerpt(cleanExcerpt || 'Select a response to generate a Zeno Share Card.');

    setPubTitle(defaultTitle);
    setPubSummary(cleanExcerpt.slice(0, 220));
    setPubContent(rawAnswer || '');
  }, [thread, selectedExchange]);

  // Generate read-only thread link only when the user opens the 'share' tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'share' || !thread || thread.messages.length === 0 || shareUrl) {
      return;
    }
    let cancelled = false;
    setIsPublishingThread(true);
    publishSharedThreadToFirestore(thread)
      .then((id) => {
        if (cancelled) return;
        setShareId(id);
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('share', id);
        setShareUrl(url.toString());
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackId = `sh_local_${Date.now()}`;
        setShareId(fallbackId);
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('share', fallbackId);
        setShareUrl(url.toString());
      })
      .finally(() => {
        if (!cancelled) setIsPublishingThread(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, thread, shareUrl]);

  const quoteConfig: QuoteCardConfig = useMemo(() => {
    return {
      title: customCardTitle || thread?.title || 'Zeno Research Synthesis',
      promptText: includePromptOnCard && customPromptText.trim() ? customPromptText.trim() : undefined,
      answerText: customAnswerExcerpt || 'Select a message to generate a share card.',
      modelName: selectedExchange?.assistantMsg?.modelUsed || 'Zeno Synthesis',
      sourcesCount: selectedExchange?.assistantMsg?.sources?.length || 0,
      dateStr: new Date(selectedExchange?.assistantMsg?.timestamp || Date.now()).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' }
      ),
      authorName: includeAuthorOnCard ? userProfile.displayName || 'Zeno Researcher' : undefined,
      aspectRatio,
      theme: quoteTheme,
    };
  }, [
    customCardTitle,
    thread,
    includePromptOnCard,
    customPromptText,
    customAnswerExcerpt,
    selectedExchange,
    includeAuthorOnCard,
    userProfile.displayName,
    aspectRatio,
    quoteTheme,
  ]);

  useEffect(() => {
    if (activeTab === 'quote' && canvasRef.current) {
      renderQuoteCardToCanvas(canvasRef.current, quoteConfig);
    }
  }, [activeTab, quoteConfig]);

  const notionMarkdown = useMemo(() => {
    if (!thread) return '';
    return buildNotionReadyMarkdown(thread);
  }, [thread]);

  if (!isOpen || !thread) return null;

  const handleDownloadCard = () => {
    downloadQuoteCardPng(quoteConfig);
    trackGrowthEvent('share_card_created', { aspectRatio, theme: quoteTheme });
  };

  const handleCopyCardImage = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await canvasToBlob(canvasRef.current);
      if (blob && navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedCardImage(true);
        trackGrowthEvent('share_card_created', { method: 'clipboard', aspectRatio });
        setTimeout(() => setCopiedCardImage(false), 2200);
        return;
      }
    } catch {}
    handleDownloadCard();
  };

  const handleNativeShareCard = async () => {
    trackGrowthEvent('share_action_initiated', { surface: 'quote_card', aspectRatio });
    if (canvasRef.current && typeof navigator !== 'undefined' && navigator.share) {
      try {
        const blob = await canvasToBlob(canvasRef.current);
        if (blob) {
          const file = new File([blob], 'zeno-insight-card.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: quoteConfig.title,
              text: `${quoteConfig.title} — Explore with Zeno`,
              files: [file],
            });
            setShareFeedback('Opened device share sheet.');
            setTimeout(() => setShareFeedback(null), 2500);
            return;
          }
        }
        await navigator.share({
          title: quoteConfig.title,
          text: `${quoteConfig.title}\n\n${quoteConfig.answerText.slice(0, 200)}…\n\nExplore with Zeno:`,
          url: window.location.origin,
        });
        setShareFeedback('Opened device share sheet.');
        setTimeout(() => setShareFeedback(null), 2500);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    handleDownloadCard();
    setShareFeedback('Downloaded PNG card for sharing.');
    setTimeout(() => setShareFeedback(null), 2500);
  };

  const handleSaveCurrentToVault = () => {
    const contentToSave = pubContent || customAnswerExcerpt;
    if (!contentToSave.trim()) return;
    KnowledgeVaultStore.saveItem({
      title: customCardTitle || thread.title || 'Saved Zeno Insight',
      summary: customAnswerExcerpt.slice(0, 240),
      content: contentToSave,
      type: 'ai_response',
      collectionId: 'col_explanations',
      tags: ['saved-from-chat'],
      sourceThreadId: thread.id,
      sourceMessageId: selectedExchange?.assistantMsg?.id,
      sources: selectedExchange?.assistantMsg?.sources || [],
    });
    setVaultSavedFeedback(true);
    setTimeout(() => setVaultSavedFeedback(false), 2200);
  };

  const handlePublishPublicArtifact = async () => {
    setPublishError(null);
    if (!pubTitle.trim() || !pubContent.trim()) {
      setPublishError('Please provide both a title and content before publishing.');
      return;
    }
    if (pubVisibility === 'public' && !pubConfirmedConsent) {
      setPublishError('Please confirm that this page contains no private data before publishing publicly.');
      return;
    }
    setIsPublishingArtifact(true);
    try {
      const tags = pubTagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);

      const created = await publishPublicArtifact({
        title: pubTitle.trim(),
        summary: pubSummary.trim() || pubContent.trim().slice(0, 220),
        content: pubContent.trim(),
        promptText: includePromptOnCard ? customPromptText.trim() : undefined,
        category: pubCategory,
        type: pubType,
        tags: tags.length > 0 ? tags : [pubCategory.toLowerCase()],
        visibility: pubVisibility,
        showAuthorAttribution: pubShowAuthor,
        authorName: pubShowAuthor ? userProfile.displayName || 'Zeno Researcher' : 'Zeno Researcher',
        authorAvatar: pubShowAuthor ? userProfile.avatar : undefined,
        modelUsed: selectedExchange?.assistantMsg?.modelUsed || 'Zeno Synthesis',
        sources: selectedExchange?.assistantMsg?.sources || [],
      });

      if (created) {
        setPublishedArtifact(created);
        onArtifactPublished?.(created);
      } else {
        setPublishError('Could not publish page right now. Please try again.');
      }
    } catch (e: any) {
      setPublishError(e?.message || 'Failed to publish artifact.');
    } finally {
      setIsPublishingArtifact(false);
    }
  };

  const publishedArtifactUrl = useMemo(() => {
    if (!publishedArtifact) return '';
    const u = new URL(window.location.origin + window.location.pathname);
    u.searchParams.set('artifact', publishedArtifact.id);
    return u.toString();
  }, [publishedArtifact]);

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    trackGrowthEvent('share_action_initiated', { surface: 'thread_snapshot_link' });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyNotionMarkdown = () => {
    navigator.clipboard.writeText(notionMarkdown);
    setCopiedNotion(true);
    setTimeout(() => setCopiedNotion(false), 2000);
  };

  const handleDownloadNotionMd = () => {
    const blob = new Blob([notionMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(thread.title || 'zeno-notion-export')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')}-notion.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const availableThemes: { id: ShareCardTheme; label: string }[] = [
    { id: 'carbon', label: 'Carbon' },
    { id: 'ivory', label: 'Ivory' },
    { id: 'slate', label: 'Slate' },
    ...(unlockedThemes.includes('obsidian-gold')
      ? [{ id: 'obsidian-gold' as const, label: 'Obsidian Gold' }]
      : []),
    ...(unlockedThemes.includes('emerald-terminal')
      ? [{ id: 'emerald-terminal' as const, label: 'Emerald' }]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl max-h-[90vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl ${
          isDark
            ? 'bg-[#0c0d10] border-[#22252e] text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-4 ${
            isDark ? 'border-[#1e212a]' : 'border-slate-200'
          }`}
        >
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold tracking-tight">
              Zeno Share & Publish Studio
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-lg">
              {thread.title} · Transform insights into Share Cards, Public Zeno Pages, or Knowledge Vault notes
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveCurrentToVault}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'border-[#282d3a] hover:bg-white/5 text-neutral-200'
                  : 'border-slate-300 hover:bg-slate-100 text-slate-800'
              }`}
              title="Save selected response to your private Knowledge Vault"
            >
              {vaultSavedFeedback ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
              <span>{vaultSavedFeedback ? 'Saved to Vault' : 'Save to Vault'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'hover:bg-white/10 text-neutral-400 hover:text-white'
                  : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        <div
          className={`px-5 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none ${
            isDark ? 'bg-[#111318] border-[#1e212a]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('quote')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'quote'
                ? isDark
                  ? 'bg-white text-black'
                  : 'bg-slate-900 text-white'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Share Card Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('publish')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'publish'
                ? isDark
                  ? 'bg-white text-black'
                  : 'bg-slate-900 text-white'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publish Public Zeno Page</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'share'
                ? isDark
                  ? 'bg-white text-black'
                  : 'bg-slate-900 text-white'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Thread Snapshot Link</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'export'
                ? isDark
                  ? 'bg-white text-black'
                  : 'bg-slate-900 text-white'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF & Notion Markdown</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* TAB 1: ZENO SHARE CARD STUDIO */}
          {activeTab === 'quote' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Customization & Privacy Controls */}
              <div className="lg:col-span-5 space-y-3.5">
                {assistantMessages.length > 1 && (
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Source Response
                    </label>
                    <select
                      value={selectedAssistantId}
                      onChange={(e) => setSelectedAssistantId(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                        isDark
                          ? 'bg-[#14171f] border-[#282d3a] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {assistantMessages.map((m, idx) => (
                        <option key={m.id} value={m.id}>
                          Response #{idx + 1}: {m.content.replace(/[#*`]/g, '').slice(0, 48)}…
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Card Headline
                  </label>
                  <input
                    type="text"
                    value={customCardTitle}
                    onChange={(e) => setCustomCardTitle(e.target.value)}
                    maxLength={110}
                    placeholder="Headline for your share card"
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                      isDark
                        ? 'bg-[#14171f] border-[#282d3a] text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Key Insight Excerpt (Editable before export)
                  </label>
                  <textarea
                    rows={4}
                    value={customAnswerExcerpt}
                    onChange={(e) => setCustomAnswerExcerpt(e.target.value)}
                    maxLength={650}
                    className={`w-full px-3 py-2 rounded-lg border text-xs outline-none leading-relaxed resize-y ${
                      isDark
                        ? 'bg-[#14171f] border-[#282d3a] text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* Format / Aspect Ratio */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Export Dimensions
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'landscape', label: 'X / LinkedIn (16:10)' },
                        { id: 'square', label: 'Square (1:1)' },
                        { id: 'story', label: 'Story / WA (9:16)' },
                      ] as const
                    ).map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setAspectRatio(fmt.id)}
                        className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          aspectRatio === fmt.id
                            ? isDark
                              ? 'bg-white text-black border-white'
                              : 'bg-slate-900 text-white border-slate-900'
                            : isDark
                            ? 'bg-[#14171f] border-[#282d3a] text-neutral-400 hover:text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme Picker */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Card Theme
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableThemes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setQuoteTheme(t.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          quoteTheme === t.id
                            ? isDark
                              ? 'bg-white text-black border-white'
                              : 'bg-slate-900 text-white border-slate-900'
                            : isDark
                            ? 'bg-[#14171f] border-[#282d3a] text-neutral-400 hover:text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="flex flex-col gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includePromptOnCard}
                      onChange={(e) => setIncludePromptOnCard(e.target.checked)}
                      className="rounded"
                    />
                    <span>Include prompt question on card</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeAuthorOnCard}
                      onChange={(e) => setIncludeAuthorOnCard(e.target.checked)}
                      className="rounded"
                    />
                    <span>Attribute my display name ({userProfile.displayName || 'Zeno User'})</span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleNativeShareCard}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCard}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'border-[#282d3a] hover:bg-white/5 text-white'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-900'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCardImage}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'border-[#282d3a] hover:bg-white/5 text-neutral-300'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {copiedCardImage ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCardImage ? 'Copied' : 'Copy Image'}</span>
                  </button>
                </div>

                {shareFeedback && (
                  <p className="text-[11px] text-emerald-400 font-medium">{shareFeedback}</p>
                )}
              </div>

              {/* Right Column: Live Canvas Preview */}
              <div
                className={`lg:col-span-7 p-4 rounded-xl border flex flex-col items-center justify-center overflow-hidden ${
                  isDark ? 'bg-[#07080a] border-[#1f232d]' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <canvas
                  ref={canvasRef}
                  className={`h-auto rounded-lg shadow-xl ${
                    aspectRatio === 'story' ? 'max-h-[440px] w-auto' : 'w-full max-w-[540px]'
                  }`}
                />
                <div className="mt-2.5 text-[11px] text-neutral-500 text-center">
                  Private account details and full chat history are excluded by default.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PUBLISH PUBLIC ZENO PAGE */}
          {activeTab === 'publish' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    Publish as an Independently Accessible Zeno Page
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                    Create a clean web page with a permanent URL and social preview metadata. You can keep it Private or make it Public in Zeno Discover.
                  </p>
                </div>
              </div>

              {publishedArtifact ? (
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#11151c] border-emerald-500/30' : 'bg-emerald-50/60 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Check className="w-4 h-4" />
                      <span>
                        {publishedArtifact.visibility === 'public'
                          ? 'Published to Public Zeno Page & Zeno Discover'
                          : 'Saved as Private Zeno Page'}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">
                      ID: {publishedArtifact.id}
                    </span>
                  </div>

                  <div
                    className={`p-3 rounded-lg border flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
                      isDark ? 'bg-[#0b0d12] border-[#222634]' : 'bg-white border-slate-200'
                    }`}
                  >
                    <input
                      type="text"
                      readOnly
                      value={publishedArtifactUrl}
                      className="flex-1 bg-transparent font-mono text-xs outline-none truncate"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(publishedArtifactUrl);
                          setCopiedArtifactUrl(true);
                          trackGrowthEvent('share_action_initiated', {
                            surface: 'public_artifact_url',
                            artifactId: publishedArtifact.id,
                          });
                          setTimeout(() => setCopiedArtifactUrl(false), 2000);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                        }`}
                      >
                        {copiedArtifactUrl ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedArtifactUrl ? 'Copied URL' : 'Copy Page Link'}</span>
                      </button>

                      <a
                        href={publishedArtifactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                          isDark
                            ? 'border-[#2d3240] hover:bg-white/5 text-neutral-200'
                            : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Page</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                        Page Title
                      </label>
                      <input
                        type="text"
                        value={pubTitle}
                        onChange={(e) => setPubTitle(e.target.value)}
                        maxLength={140}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark
                            ? 'bg-[#14171f] border-[#282d3a] text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                        Discover Category
                      </label>
                      <select
                        value={pubCategory}
                        onChange={(e) => setPubCategory(e.target.value as DiscoverCategory)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark
                            ? 'bg-[#14171f] border-[#282d3a] text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        {DISCOVER_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                        Resource Format
                      </label>
                      <select
                        value={pubType}
                        onChange={(e) => setPubType(e.target.value as PublicArtifactType)}
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark
                            ? 'bg-[#14171f] border-[#282d3a] text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="research_summary">Research Summary</option>
                        <option value="study_guide">Study Guide</option>
                        <option value="explanation">Technical Explanation</option>
                        <option value="structured_notes">Structured Notes</option>
                        <option value="workflow">Reusable Workflow</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={pubTagsInput}
                        onChange={(e) => setPubTagsInput(e.target.value)}
                        placeholder="physics, transformers, study-guide"
                        className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                          isDark
                            ? 'bg-[#14171f] border-[#282d3a] text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                        Visibility Control
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPubVisibility('public')}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                            pubVisibility === 'public'
                              ? isDark
                                ? 'bg-white text-black border-white'
                                : 'bg-slate-900 text-white border-slate-900'
                              : isDark
                              ? 'bg-[#14171f] border-[#282d3a] text-neutral-400'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Public</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPubVisibility('private')}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                            pubVisibility === 'private'
                              ? isDark
                                ? 'bg-white text-black border-white'
                                : 'bg-slate-900 text-white border-slate-900'
                              : isDark
                              ? 'bg-[#14171f] border-[#282d3a] text-neutral-400'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Private</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Short Preview Summary (Used for Open Graph social card & Discover preview)
                    </label>
                    <input
                      type="text"
                      value={pubSummary}
                      onChange={(e) => setPubSummary(e.target.value)}
                      maxLength={260}
                      className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                        isDark
                          ? 'bg-[#14171f] border-[#282d3a] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Published Page Content (Markdown — Review & edit before publishing)
                    </label>
                    <textarea
                      rows={7}
                      value={pubContent}
                      onChange={(e) => setPubContent(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border font-mono text-xs outline-none leading-relaxed resize-y ${
                        isDark
                          ? 'bg-[#090b0f] border-[#282d3a] text-neutral-200'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="space-y-1.5">
                      <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={pubShowAuthor}
                          onChange={(e) => setPubShowAuthor(e.target.checked)}
                          className="rounded"
                        />
                        <span>Display my name ({userProfile.displayName || 'Zeno Researcher'}) as creator</span>
                      </label>

                      {pubVisibility === 'public' && (
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-amber-400/90">
                          <input
                            type="checkbox"
                            checked={pubConfirmedConsent}
                            onChange={(e) => setPubConfirmedConsent(e.target.checked)}
                            className="rounded"
                          />
                          <span>
                            I confirm this page excludes private information and may be viewed via its public link & Zeno Discover.
                          </span>
                        </label>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isPublishingArtifact}
                      onClick={handlePublishPublicArtifact}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isDark
                          ? 'bg-white text-black hover:bg-neutral-200 disabled:opacity-50'
                          : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {isPublishingArtifact
                          ? 'Publishing Page…'
                          : pubVisibility === 'public'
                          ? 'Confirm & Publish Public Page'
                          : 'Save Private Page'}
                      </span>
                    </button>
                  </div>

                  {publishError && (
                    <div className="text-xs text-red-400 font-medium">{publishError}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: THREAD SNAPSHOT LINK */}
          {activeTab === 'share' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Read-Only Thread Snapshot Link</h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  Anyone with this unindexed link can view a read-only snapshot of this conversation—including cited web sources and ArXiv papers—and fork it into their own Zeno workspace.
                </p>
              </div>

              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 ${
                  isDark ? 'bg-[#13151b] border-[#252934]' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <input
                  type="text"
                  readOnly
                  value={isPublishingThread ? 'Generating snapshot link...' : shareUrl}
                  className="flex-1 bg-transparent font-mono text-xs outline-none truncate"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    disabled={isPublishingThread || !shareUrl}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isDark
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLink ? 'Copied Link' : 'Copy Share Link'}</span>
                  </button>

                  {onOpenReadOnlyPreview && shareId && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenReadOnlyPreview(shareId, {
                          id: shareId,
                          ownerId: 'preview',
                          title: thread.title,
                          createdAt: thread.createdAt,
                          messages: thread.messages,
                        });
                        onClose();
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isDark
                          ? 'border-[#2d3240] hover:bg-white/5 text-neutral-200'
                          : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Preview Read-Only View</span>
                    </button>
                  )}
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border grid grid-cols-3 gap-4 ${
                  isDark ? 'bg-[#111318] border-[#1f232d]' : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <div className="text-[11px] text-neutral-500">Messages Included</div>
                  <div className="text-sm font-mono tabular-nums font-semibold mt-0.5">
                    {thread.messages.filter((m) => !m.isStreaming).length}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Web Citations</div>
                  <div className="text-sm font-mono tabular-nums font-semibold mt-0.5">
                    {thread.messages.reduce((acc, m) => acc + (m.sources?.length || 0), 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Access Mode</div>
                  <div className="text-sm font-semibold mt-0.5">Unlisted · Forkable</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PDF & NOTION MARKDOWN */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Formatted Document & Notion Export</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Export as a multi-page typeset PDF or copy Notion-ready Markdown with callouts and citations.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportConversationAsPdf(thread)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isDark
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Formatted PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyNotionMarkdown}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isDark
                        ? 'border-[#2d3240] hover:bg-white/5 text-neutral-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    {copiedNotion ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedNotion ? 'Copied for Notion' : 'Copy Notion Markdown'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadNotionMd}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isDark
                        ? 'border-[#2d3240] hover:bg-white/5 text-neutral-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Download .MD</span>
                  </button>
                </div>
              </div>

              <div
                className={`rounded-xl border overflow-hidden ${
                  isDark ? 'bg-[#08090c] border-[#1f232d]' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div
                  className={`px-3.5 py-2 border-b text-[11px] font-mono text-neutral-500 flex items-center justify-between ${
                    isDark ? 'border-[#1f232d]' : 'border-slate-200'
                  }`}
                >
                  <span>Notion-Ready Markdown Preview</span>
                  <span>{notionMarkdown.length.toLocaleString()} chars</span>
                </div>
                <pre className="p-4 max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {notionMarkdown}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
