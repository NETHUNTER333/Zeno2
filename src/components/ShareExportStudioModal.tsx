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
  Bookmark,
  ChevronDown,
} from 'lucide-react';
import {
  ChatMessage,
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
}) => {
  const resolvedInitialTab: 'quote' | 'share' | 'export' =
    initialTab === 'publish' ? 'quote' : initialTab;
  const [activeTab, setActiveTab] = useState<'quote' | 'share' | 'export'>(resolvedInitialTab);
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
  const [isResponsePickerOpen, setIsResponsePickerOpen] = useState(false);
  const [quoteTheme, setQuoteTheme] = useState<ShareCardTheme>('carbon');
  const [aspectRatio, setAspectRatio] = useState<ShareCardAspectRatio>('landscape');
  const [includePromptOnCard, setIncludePromptOnCard] = useState(true);
  const [includeAuthorOnCard, setIncludeAuthorOnCard] = useState(false);

  // Editable Share Card text fields so user controls exactly what is exported
  const [customCardTitle, setCustomCardTitle] = useState<string>('');
  const [customPromptText, setCustomPromptText] = useState<string>('');
  const [customAnswerExcerpt, setCustomAnswerExcerpt] = useState<string>('');
  const [rawSelectedContent, setRawSelectedContent] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unlockedThemes = useMemo(() => getUnlockedCosmeticThemes(), [isOpen]);
  const userProfile = useMemo(() => UserAccountStore.getProfile(), [isOpen]);

  const targetInitialMsgId = initialQuoteMessage?.id || initialMessageId || '';
  const lastAssistantMsgId =
    assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].id : '';

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab === 'publish' ? 'quote' : initialTab);
      setShareUrl('');
      setShareId('');
      setShareFeedback(null);
      setIsResponsePickerOpen(false);

      if (targetInitialMsgId && assistantMessages.some((m) => m.id === targetInitialMsgId)) {
        setSelectedAssistantId(targetInitialMsgId);
      } else if (lastAssistantMsgId) {
        setSelectedAssistantId(lastAssistantMsgId);
      }
    }
  }, [isOpen, initialTab, targetInitialMsgId, lastAssistantMsgId]);

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

  const selectedExchangeKey = `${thread?.id || ''}:${selectedExchange?.assistantMsg?.id || ''}:${
    selectedExchange?.assistantMsg?.content?.length || 0
  }`;

  // Populate editable fields when selected message changes
  useEffect(() => {
    if (!thread) return;
    const rawAnswer = (selectedExchange?.assistantMsg?.content || '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
    const defaultTitle = (thread.title || 'Kinich Research Synthesis').slice(0, 90);
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
    setCustomAnswerExcerpt(cleanExcerpt || 'Select a response to generate a Kinich Share Card.');
    setRawSelectedContent(rawAnswer || '');
  }, [selectedExchangeKey]);

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
      title: customCardTitle || thread?.title || 'Kinich Research Synthesis',
      promptText: includePromptOnCard && customPromptText.trim() ? customPromptText.trim() : undefined,
      answerText: customAnswerExcerpt || 'Select a message to generate a share card.',
      modelName: selectedExchange?.assistantMsg?.modelUsed || 'Kinich Synthesis',
      sourcesCount: selectedExchange?.assistantMsg?.sources?.length || 0,
      dateStr: new Date(selectedExchange?.assistantMsg?.timestamp || Date.now()).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' }
      ),
      authorName: includeAuthorOnCard ? userProfile.displayName || 'Kinich Researcher' : undefined,
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
          const file = new File([blob], 'kinich-insight-card.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: quoteConfig.title,
              text: `${quoteConfig.title} — Explore with Kinich`,
              files: [file],
            });
            setShareFeedback('Opened device share sheet.');
            setTimeout(() => setShareFeedback(null), 2500);
            return;
          }
        }
        await navigator.share({
          title: quoteConfig.title,
          text: `${quoteConfig.title}\n\n${quoteConfig.answerText.slice(0, 200)}…\n\nExplore with Kinich:`,
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
    const contentToSave = rawSelectedContent || customAnswerExcerpt;
    if (!contentToSave.trim()) return;
    KnowledgeVaultStore.saveItem({
      title: customCardTitle || thread.title || 'Saved Kinich Insight',
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
    a.download = `${(thread.title || 'kinich-notion-export')
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl max-h-[86vh] rounded-3xl border flex flex-col overflow-hidden shadow-2xl ${
          isDark
            ? 'bg-[#0c0d10]/95 border-white/[0.14] text-white backdrop-blur-2xl'
            : 'bg-white/95 border-slate-200 text-slate-900 backdrop-blur-2xl'
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
              Kinich Share Studio
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-lg">
              {thread.title} · Transform insights into Share Cards, Thread Snapshots, or Knowledge Vault notes
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
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* TAB 1: ZENO SHARE CARD STUDIO */}
          {activeTab === 'quote' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Customization & Privacy Controls */}
              <div className="lg:col-span-5 space-y-4">
                {assistantMessages.length > 1 && (
                  <div className="relative">
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
                      Source Response
                    </label>
                    {(() => {
                      const selectedIdx = Math.max(
                        0,
                        assistantMessages.findIndex((m) => m.id === selectedAssistantId)
                      );
                      const currentMsg = assistantMessages[selectedIdx] || assistantMessages[0];
                      const cleanPreview = (currentMsg?.content || '')
                        .replace(/<think>[\s\S]*?<\/think>/gi, '')
                        .replace(/[#*`]/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsResponsePickerOpen((prev) => !prev)}
                            className={`w-full px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2.5 text-left transition-all cursor-pointer ${
                              isDark
                                ? 'bg-[#14171f] hover:bg-[#191d27] border-[#282d3a] text-white'
                                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          >
                            <span className="truncate font-medium">
                              Response #{selectedIdx + 1}: {cleanPreview.slice(0, 52)}
                              {cleanPreview.length > 52 ? '…' : ''}
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 opacity-60 transition-transform duration-200 ${
                                isResponsePickerOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {isResponsePickerOpen && (
                            <div
                              className={`mt-2 p-2 rounded-2xl border backdrop-blur-2xl backdrop-saturate-150 shadow-2xl max-h-60 overflow-y-auto space-y-1.5 z-30 ${
                                isDark
                                  ? 'bg-neutral-900/95 border-white/[0.14] text-white'
                                  : 'bg-white/95 border-slate-200 text-slate-900'
                              }`}
                            >
                              {assistantMessages.map((m, idx) => {
                                const isSelected = m.id === selectedAssistantId;
                                const snippet = (m.content || '')
                                  .replace(/<think>[\s\S]*?<\/think>/gi, '')
                                  .replace(/[#*`]/g, '')
                                  .replace(/\s+/g, ' ')
                                  .trim();
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssistantId(m.id);
                                      setIsResponsePickerOpen(false);
                                    }}
                                    className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                                      isSelected
                                        ? isDark
                                          ? 'bg-white/[0.12] border border-white/[0.18] text-white'
                                          : 'bg-slate-900 text-white'
                                        : isDark
                                        ? 'hover:bg-white/[0.06] text-neutral-300 border border-transparent'
                                        : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[11px] font-semibold opacity-75 mb-0.5">
                                        Response #{idx + 1}
                                      </div>
                                      <div className="text-xs leading-snug line-clamp-2 break-words">
                                        {snippet.slice(0, 90)}
                                        {snippet.length > 90 ? '…' : ''}
                                      </div>
                                    </div>
                                    <div
                                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                        isSelected
                                          ? isDark
                                            ? 'border-white bg-white text-black'
                                            : 'border-white bg-white text-slate-900'
                                          : isDark
                                          ? 'border-white/30'
                                          : 'border-slate-400'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
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
                    <span>Attribute my display name ({userProfile.displayName || 'Kinich User'})</span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleNativeShareCard}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      isDark
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Share Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCard}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isDark
                        ? 'border-[#282d3a] hover:bg-white/5 text-white'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-900'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>Download PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCardImage}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isDark
                        ? 'border-[#282d3a] hover:bg-white/5 text-neutral-300'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {copiedCardImage ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 shrink-0" />
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

          {/* TAB 3: THREAD SNAPSHOT LINK */}
          {activeTab === 'share' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Read-Only Thread Snapshot Link</h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  Anyone with this unindexed link can view a read-only snapshot of this conversation—including cited web sources and ArXiv papers—and fork it into their own Kinich workspace.
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
