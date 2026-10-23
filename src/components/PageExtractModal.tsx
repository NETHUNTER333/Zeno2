import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  FileText,
  Globe,
  Loader2,
  ExternalLink,
  ArrowRight,
  MessageSquare,
  ListChecks,
  Code2,
  BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAuthHeaders } from '../lib/firebase';

export interface PageExtractModalProps {
  url: string | null;
  isOpen?: boolean;
  onClose: () => void;
  isDark?: boolean;
  selectedModelId?: string;
  onChatWithPage?: (url: string, title: string, extractedMarkdown: string, userQuestion?: string) => void;
}

const INSTACLOUD_API_BASE = 'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

async function callZenoEndpoint(path: string, init?: RequestInit): Promise<Response> {
  const isStaticHost =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('netlify.app'));
  if (isStaticHost) {
    return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
  }
  try {
    const localRes = await fetch(path, init);
    const ct = localRes.headers.get('content-type') || '';
    if (localRes.ok && ct.includes('application/json')) return localRes;
  } catch {}
  return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
}

export const PageExtractModal: React.FC<PageExtractModalProps> = ({
  url: initialUrl,
  isOpen = false,
  onClose,
  isDark = true,
  selectedModelId = 'deepseek-v4.1-flash:free',
  onChatWithPage,
}) => {
  const [urlInput, setUrlInput] = useState<string>(initialUrl || '');
  const [activeUrl, setActiveUrl] = useState<string>(initialUrl || '');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [duration, setDuration] = useState<number | null>(null);

  // AI Page Summarizer & Q&A state
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [activeSummaryLens, setActiveSummaryLens] = useState<string>('');
  const [customQuestion, setCustomQuestion] = useState<string>('');

  useEffect(() => {
    if (initialUrl) {
      setUrlInput(initialUrl);
      setActiveUrl(initialUrl);
      fetchUrlContent(initialUrl);
    }
  }, [initialUrl]);

  const fetchUrlContent = async (targetUrl: string) => {
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl) return;
    const normalizedUrl = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`;
    setActiveUrl(normalizedUrl);
    setLoading(true);
    setError(null);
    setContent('');
    setAiSummary('');
    setDuration(null);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await callZenoEndpoint('/api/treg/extract', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract content from URL');
      }

      const extractedMd = data.markdown || 'No readable text could be extracted from this URL.';
      setContent(extractedMd);
      setTitle(data.title || new URL(normalizedUrl).hostname);
      setDuration(data.durationMs || null);
    } catch (err: any) {
      setError(err.message || 'Could not scrape URL content.');
    } finally {
      setLoading(false);
    }
  };

  const runPageAiAnalysis = async (lens: 'summary' | 'takeaways' | 'technical' | 'custom', customPromptText?: string) => {
    if (!content || isSummarizing) return;
    setIsSummarizing(true);
    setActiveSummaryLens(lens);

    const promptInstruction =
      lens === 'summary'
        ? 'Provide a crisp, high-signal Executive Summary (core thesis, key arguments, and conclusions) of this page.'
        : lens === 'takeaways'
        ? 'Extract a bulleted list of the top 7 concrete facts, quantitative metrics, and actionable takeaways from this page.'
        : lens === 'technical'
        ? 'Analyze the technical architecture, code structure, API design, or methodology described on this page.'
        : customPromptText || customQuestion || 'Summarize this page.';

    try {
      const authHeaders = await getAuthHeaders();
      const res = await callZenoEndpoint('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Analyze the following scraped webpage (${activeUrl}):\n\nTitle: ${title}\n\nPage Content:\n${content.slice(
                0,
                14000
              )}\n\nTask: ${promptInstruction}`,
            },
          ],
          webSearch: false,
          searchMode: 'off',
          model: selectedModelId,
        }),
      });
      const data = await res.json();
      if (data?.success && data?.text) {
        setAiSummary(data.text);
      } else {
        throw new Error(data?.error || 'Failed to analyze page');
      }
    } catch (err: any) {
      setAiSummary(`Error generating analysis: ${err.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (!isOpen && !initialUrl) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiSummary || content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = content ? content.trim().split(/\s+/).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 220));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl max-h-[90vh] rounded-2xl border flex flex-col shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-[#0b0c10] border-[#22252e] text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between gap-4 ${
            isDark ? 'border-[#1d2029]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`size-9 rounded-xl border flex items-center justify-center shrink-0 ${
                isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
            >
              <Globe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className={isDark ? 'text-white font-semibold text-sm' : 'text-slate-900 font-semibold text-sm'}>
                  URL / Website Reader & Page Summarizer
                </span>
                {wordCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{wordCount.toLocaleString()} words</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{readTimeMin} min read</span>
                  </>
                )}
                {duration && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{duration}ms</span>
                  </>
                )}
              </div>
              {activeUrl && (
                <p className="text-xs text-neutral-500 truncate font-mono mt-0.5">
                  {activeUrl}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {content && (
              <div
                className={`flex items-center p-0.5 rounded-lg border text-xs ${
                  isDark ? 'bg-[#14171f] border-[#252934]' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('rendered')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    viewMode === 'rendered'
                      ? isDark
                        ? 'bg-white text-black font-medium'
                        : 'bg-slate-900 text-white font-medium'
                      : 'text-neutral-500 hover:text-current'
                  }`}
                >
                  Rendered
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    viewMode === 'raw'
                      ? isDark
                        ? 'bg-white text-black font-medium'
                        : 'bg-slate-900 text-white font-medium'
                      : 'text-neutral-500 hover:text-current'
                  }`}
                >
                  Raw MD
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!content || loading}
              className={`p-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${
                isDark
                  ? 'border-[#252934] hover:bg-white/5 text-neutral-300'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              title="Copy content"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'border-[#252934] hover:bg-white/5 text-neutral-300'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Open original webpage"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

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
        </div>

        {/* URL Input Bar */}
        <div
          className={`p-3.5 border-b flex flex-col sm:flex-row items-stretch sm:items-center gap-2 ${
            isDark ? 'bg-[#101218] border-[#1d2029]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchUrlContent(urlInput);
            }}
            placeholder="Paste any article, documentation link, or GitHub repo URL (e.g. https://github.com/facebook/react)..."
            className={`flex-1 px-3.5 py-2 rounded-xl border text-xs font-mono outline-none ${
              isDark
                ? 'bg-[#0b0c10] border-[#252934] text-white focus:border-white/40'
                : 'bg-white border-slate-300 text-slate-900 focus:border-slate-900'
            }`}
          />
          <button
            type="button"
            onClick={() => fetchUrlContent(urlInput)}
            disabled={loading || !urlInput.trim()}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
              isDark
                ? 'bg-white text-black hover:bg-neutral-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            <span>{loading ? 'Scraping...' : 'Read URL'}</span>
          </button>
        </div>

        {/* 1-Click AI Summarizer & Action Bar when content is loaded */}
        {content && !loading && (
          <div
            className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
              isDark ? 'bg-[#0e1016] border-[#1d2029]' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => runPageAiAnalysis('summary')}
                disabled={isSummarizing}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSummaryLens === 'summary'
                    ? isDark
                      ? 'bg-white text-black border-white'
                      : 'bg-slate-900 text-white border-slate-900'
                    : isDark
                    ? 'border-[#252934] hover:bg-white/5 text-neutral-300'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Executive Summary</span>
              </button>

              <button
                type="button"
                onClick={() => runPageAiAnalysis('takeaways')}
                disabled={isSummarizing}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSummaryLens === 'takeaways'
                    ? isDark
                      ? 'bg-white text-black border-white'
                      : 'bg-slate-900 text-white border-slate-900'
                    : isDark
                    ? 'border-[#252934] hover:bg-white/5 text-neutral-300'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>Key Takeaways</span>
              </button>

              <button
                type="button"
                onClick={() => runPageAiAnalysis('technical')}
                disabled={isSummarizing}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSummaryLens === 'technical'
                    ? isDark
                      ? 'bg-white text-black border-white'
                      : 'bg-slate-900 text-white border-slate-900'
                    : isDark
                    ? 'border-[#252934] hover:bg-white/5 text-neutral-300'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Technical Architecture</span>
              </button>
            </div>

            {onChatWithPage && (
              <button
                type="button"
                onClick={() => {
                  onChatWithPage(activeUrl, title, content);
                  onClose();
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Continue in Main Chat</span>
              </button>
            )}
          </div>
        )}

        {/* Main Content Split View */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800">
          {/* Left / Primary Extracted Page Content */}
          <div className={`p-5 overflow-y-auto ${aiSummary || isSummarizing ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            {loading && (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
                <Loader2 className="w-7 h-7 animate-spin" />
                <p className="text-xs font-medium">Scraping & cleaning webpage into structured Markdown...</p>
              </div>
            )}

            {error && !loading && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
                <p className="font-semibold mb-1">Extraction Error</p>
                <p>{error}</p>
              </div>
            )}

            {!loading && !error && !content && (
              <div className="py-12 text-center">
                <p className="text-xs text-neutral-500 mb-4">
                  Paste any URL above or try one of these live technical sources:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {[
                    'https://github.com/karpathy/nanoGPT',
                    'https://en.wikipedia.org/wiki/Quantum_computing',
                    'https://arxiv.org/abs/1706.03762',
                  ].map((sampleUrl) => (
                    <button
                      key={sampleUrl}
                      type="button"
                      onClick={() => {
                        setUrlInput(sampleUrl);
                        fetchUrlContent(sampleUrl);
                      }}
                      className={`px-3 py-1.5 rounded-lg border font-mono text-xs transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#12141c] border-[#252934] hover:border-white/30 text-neutral-300'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-400 text-slate-700'
                      }`}
                    >
                      {sampleUrl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && content && (
              viewMode === 'rendered' ? (
                <div className="prose-custom max-w-none text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>
              ) : (
                <pre
                  className={`font-mono text-xs p-4 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed ${
                    isDark ? 'bg-[#07080b] text-neutral-300' : 'bg-slate-50 text-slate-800'
                  }`}
                >
                  {content}
                </pre>
              )
            )}
          </div>

          {/* Right Pane: AI Page Summarizer & Q&A */}
          {(aiSummary || isSummarizing) && (
            <div className="lg:col-span-5 p-5 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
                  <span className="text-xs font-semibold">AI Page Synthesis</span>
                  {isSummarizing && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />}
                </div>
                {isSummarizing && !aiSummary ? (
                  <div className="py-12 text-xs text-neutral-500 text-center">
                    Synthesizing insights from scraped page...
                  </div>
                ) : (
                  <div className="prose-custom max-w-none text-xs leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {aiSummary}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Follow-up Question Input */}
              <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center gap-2">
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customQuestion.trim()) {
                      runPageAiAnalysis('custom', customQuestion);
                      setCustomQuestion('');
                    }
                  }}
                  placeholder="Ask a specific question about this page..."
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs outline-none ${
                    isDark
                      ? 'bg-[#0b0c10] border-[#252934] text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customQuestion.trim()) {
                      runPageAiAnalysis('custom', customQuestion);
                      setCustomQuestion('');
                    }
                  }}
                  disabled={isSummarizing || !customQuestion.trim()}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                    isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                  }`}
                >
                  Ask
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
