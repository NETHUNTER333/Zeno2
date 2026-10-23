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
} from 'lucide-react';
import { ChatMessage } from '../types';
import {
  exportConversationAsMarkdown,
  exportConversationAsPdf,
  buildNotionReadyMarkdown,
  renderQuoteCardToCanvas,
  downloadQuoteCardPng,
  QuoteCardConfig,
} from '../lib/exportChat';
import { publishSharedThreadToFirestore } from '../lib/firebase';

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
  initialTab?: 'share' | 'export' | 'quote';
  isDark?: boolean;
  onOpenReadOnlyPreview?: (shareId: string, snapshot: any) => void;
}

export const ShareExportStudioModal: React.FC<ShareExportStudioModalProps> = ({
  isOpen,
  onClose,
  thread,
  initialMessageId = null,
  initialTab = 'share',
  isDark = true,
  onOpenReadOnlyPreview,
}) => {
  const [activeTab, setActiveTab] = useState<'share' | 'export' | 'quote'>(initialTab);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareId, setShareId] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedNotion, setCopiedNotion] = useState(false);

  // Quote Card state
  const assistantMessages = useMemo(() => {
    if (!thread) return [];
    return thread.messages.filter((m) => m.role === 'assistant' && m.content?.trim());
  }, [thread]);

  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');
  const [quoteTheme, setQuoteTheme] = useState<'carbon' | 'ivory' | 'slate'>('carbon');
  const [includePromptOnCard, setIncludePromptOnCard] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setShareUrl('');
      setShareId('');
      if (initialMessageId && assistantMessages.some((m) => m.id === initialMessageId)) {
        setSelectedAssistantId(initialMessageId);
      } else if (assistantMessages.length > 0) {
        setSelectedAssistantId(assistantMessages[assistantMessages.length - 1].id);
      }
    }
  }, [isOpen, initialTab, initialMessageId, assistantMessages]);

  // Auto-generate share link when Share tab is active
  useEffect(() => {
    if (!isOpen || !thread || thread.messages.length === 0 || shareUrl) return;
    let cancelled = false;
    setIsPublishing(true);
    publishSharedThreadToFirestore(thread)
      .then((id) => {
        if (cancelled) return;
        setShareId(id);
        const url = new URL(window.location.href);
        url.searchParams.set('share', id);
        setShareUrl(url.toString());
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackId = `sh_local_${Date.now()}`;
        setShareId(fallbackId);
        const url = new URL(window.location.href);
        url.searchParams.set('share', fallbackId);
        setShareUrl(url.toString());
      })
      .finally(() => {
        if (!cancelled) setIsPublishing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, thread, shareUrl]);

  const selectedExchange = useMemo(() => {
    if (!thread || !selectedAssistantId) return null;
    const idx = thread.messages.findIndex((m) => m.id === selectedAssistantId);
    if (idx === -1) return null;
    const assistantMsg = thread.messages[idx];
    const prevUserMsg =
      idx > 0 && thread.messages[idx - 1]?.role === 'user' ? thread.messages[idx - 1] : null;
    return {
      assistantMsg,
      promptText: prevUserMsg?.content || '',
    };
  }, [thread, selectedAssistantId]);

  const quoteConfig: QuoteCardConfig = useMemo(() => {
    return {
      title: thread?.title || 'Zeno Research Thread',
      promptText: includePromptOnCard ? selectedExchange?.promptText : undefined,
      answerText: selectedExchange?.assistantMsg?.content || 'Select a message to generate a quote card.',
      modelName: selectedExchange?.assistantMsg?.modelUsed || 'Zeno Synthesis',
      sourcesCount: selectedExchange?.assistantMsg?.sources?.length || 0,
      dateStr: new Date(selectedExchange?.assistantMsg?.timestamp || Date.now()).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric', year: 'numeric' }
      ),
      theme: quoteTheme,
    };
  }, [thread, selectedExchange, includePromptOnCard, quoteTheme]);

  useEffect(() => {
    if (activeTab === 'quote' && canvasRef.current && selectedExchange) {
      renderQuoteCardToCanvas(canvasRef.current, quoteConfig);
    }
  }, [activeTab, quoteConfig, selectedExchange]);

  const notionMarkdown = useMemo(() => {
    if (!thread) return '';
    return buildNotionReadyMarkdown(thread);
  }, [thread]);

  if (!isOpen || !thread) return null;

  const handleCopyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
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
    a.download = `${(thread.title || 'zeno-notion-export').toLowerCase().replace(/[^a-z0-9-_]+/g, '-')}-notion.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-3xl max-h-[88vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl ${
          isDark
            ? 'bg-[#0c0d10] border-[#22252e] text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-4 ${
            isDark ? 'border-[#1e212a]' : 'border-slate-200'
          }`}
        >
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Share & Export Studio
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-md">
              {thread.title} · {thread.messages.length} messages
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-neutral-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Control Tabs */}
        <div
          className={`px-5 py-2.5 border-b flex items-center gap-1.5 ${
            isDark ? 'bg-[#111318] border-[#1e212a]' : 'bg-slate-50 border-slate-200'
          }`}
        >
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
            <span>Public Share Link</span>
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
            <span>PNG Quote Card Studio</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {activeTab === 'share' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Read-Only Public Thread Link</h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  Anyone with this link can view a clean, read-only snapshot of this conversation—including cited web sources, ArXiv papers, and finance cards—and optionally fork it into their own Zeno workspace.
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
                  value={isPublishing ? 'Generating encrypted snapshot link...' : shareUrl}
                  className="flex-1 bg-transparent font-mono text-xs outline-none truncate"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    disabled={isPublishing || !shareUrl}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isDark
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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

              {/* Snapshot Summary Table */}
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
                  <div className="text-sm font-semibold mt-0.5">
                    Read-Only · Forkable
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    {copiedNotion ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
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

          {activeTab === 'quote' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Message Picker */}
                  {assistantMessages.length > 1 && (
                    <select
                      value={selectedAssistantId}
                      onChange={(e) => setSelectedAssistantId(e.target.value)}
                      className={`px-3 py-1.5 rounded-lg border text-xs outline-none ${
                        isDark
                          ? 'bg-[#14171f] border-[#282d3a] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      {assistantMessages.map((m, idx) => (
                        <option key={m.id} value={m.id}>
                          Response #{idx + 1}: {m.content.replace(/[#*`]/g, '').slice(0, 42)}…
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Theme Switcher */}
                  <div
                    className={`flex items-center gap-1 p-1 rounded-lg border ${
                      isDark ? 'bg-[#14171f] border-[#282d3a]' : 'bg-slate-100 border-slate-200'
                    }`}
                  >
                    {(
                      [
                        { id: 'carbon', label: 'Carbon' },
                        { id: 'ivory', label: 'Ivory' },
                        { id: 'slate', label: 'Slate' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setQuoteTheme(t.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          quoteTheme === t.id
                            ? isDark
                              ? 'bg-white text-black'
                              : 'bg-slate-900 text-white'
                            : 'text-neutral-500 hover:text-current'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none ml-1">
                    <input
                      type="checkbox"
                      checked={includePromptOnCard}
                      onChange={(e) => setIncludePromptOnCard(e.target.checked)}
                      className="rounded"
                    />
                    <span>Include prompt question</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => downloadQuoteCardPng(quoteConfig)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isDark
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download High-Res PNG (2x)</span>
                </button>
              </div>

              {/* Live Canvas Preview */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-center overflow-hidden ${
                  isDark ? 'bg-[#07080a] border-[#1f232d]' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full max-w-[640px] h-auto rounded-lg shadow-lg"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
