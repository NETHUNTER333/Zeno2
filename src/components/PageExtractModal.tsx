import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { getAuthHeaders } from '../lib/firebase';
import { extractYouTubeIdFromInput } from './YouTubeTranscriptModal';
import { PrismCodeBlock } from './PrismCodeBlock';
import { PeleDiagram } from './PeleDiagram';

export interface PageExtractModalProps {
  url: string | null;
  isOpen?: boolean;
  onClose: () => void;
  isDark?: boolean;
  selectedModelId?: string;
  onChatWithPage?: (
    url: string,
    title: string,
    extractedMarkdown: string,
    userQuestion?: string
  ) => void;
}

const INSTACLOUD_API_BASE =
  'https://prod-main-kinich-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

async function callKinichEndpoint(path: string, init?: RequestInit): Promise<Response> {
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
    if (
      (localRes.ok ||
        localRes.status === 400 ||
        localRes.status === 401 ||
        localRes.status === 403 ||
        localRes.status === 429) &&
      ct.includes('application/json')
    ) {
      return localRes;
    }
  } catch {}
  return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
}

/**
 * Resolves relative image and anchor URLs inside extracted Markdown
 * (including GitHub repository relative paths like `assets/nanogpt.jpg`).
 */
function resolveExtractedAssetUrl(
  rawUrl: string | undefined,
  basePageUrl: string,
  isImage: boolean
): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#')
  ) {
    // If it's a GitHub blob URL used for an image, convert to raw.githubusercontent.com
    if (isImage && /^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\//i.test(trimmed)) {
      return trimmed
        .replace(/^https?:\/\/github\.com\//i, 'https://raw.githubusercontent.com/')
        .replace(/\/blob\//, '/');
    }
    return trimmed;
  }

  try {
    const parsedBase = new URL(basePageUrl);
    if (parsedBase.hostname === 'github.com' || parsedBase.hostname === 'www.github.com') {
      const parts = parsedBase.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/i, '');
        let branch = 'HEAD';
        let subDir = '';

        if ((parts[2] === 'blob' || parts[2] === 'tree') && parts[3]) {
          branch = parts[3];
          if (parts.length > 4) {
            const rest = parts.slice(4);
            if (parts[2] === 'blob') rest.pop();
            subDir = rest.length > 0 ? `${rest.join('/')}/` : '';
          }
        }

        const cleanRel = trimmed.replace(/^\.\//, '').replace(/^\//, '');
        if (isImage) {
          return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${subDir}${cleanRel}`;
        }
        return `https://github.com/${owner}/${repo}/blob/${branch}/${subDir}${cleanRel}`;
      }
    }

    return new URL(trimmed, basePageUrl).toString();
  } catch {
    return trimmed;
  }
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
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
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
    setActiveSummaryLens('');
    setDuration(null);

    const startTime = Date.now();

    try {
      const ytId = extractYouTubeIdFromInput(normalizedUrl);
      if (ytId) {
        try {
          const transcriptRes = await fetch(
            'https://prod-main-transcript-api-6588e7-006jmayjabt.compute.instacloud-edge.com/api/transcript',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoId: ytId }),
            }
          );
          const ytData = await transcriptRes.json();
          if (
            transcriptRes.ok &&
            ytData?.success &&
            Array.isArray(ytData.segments) &&
            ytData.segments.length > 0
          ) {
            const ytTitle = ytData.title || `YouTube Video (${ytId})`;
            const ytAuthor = ytData.author ? `Channel: ${ytData.author}\n\n` : '';
            const transcriptBody = ytData.segments
              .map((s: any) => s.text || '')
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            const formattedMd = `# ${ytTitle}\n\n${ytAuthor}${transcriptBody}`;
            setContent(formattedMd);
            setTitle(ytTitle);
            setDuration(Date.now() - startTime);
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to standard webpage extractor
        }
      }

      const authHeaders = await getAuthHeaders();
      const res = await callKinichEndpoint('/api/treg/extract', {
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
      setDuration(data.durationMs || Date.now() - startTime);
    } catch (err: any) {
      setError(err.message || 'Could not extract URL content.');
    } finally {
      setLoading(false);
    }
  };

  const runPageAiAnalysis = async (
    lens: 'summary' | 'takeaways' | 'technical' | 'custom',
    customPromptText?: string
  ) => {
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
      const res = await callKinichEndpoint('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Analyze the following extracted webpage (${activeUrl}):\n\nTitle: ${title}\n\nPage Content:\n${content.slice(
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
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySummaryToClipboard = () => {
    if (!aiSummary) return;
    navigator.clipboard.writeText(aiSummary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const wordCount = content ? content.trim().split(/\s+/).length : 0;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 220));

  const renderMarkdownComponents = {
    a: ({ node, href, children, ...props }: any) => {
      const resolvedHref = resolveExtractedAssetUrl(href, activeUrl, false);
      return (
        <a
          {...props}
          href={resolvedHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-3 transition-opacity hover:opacity-80 break-words"
        >
          {children}
        </a>
      );
    },
    img: ({ node, src, alt, ...props }: any) => {
      const resolvedSrc = resolveExtractedAssetUrl(src, activeUrl, true);
      if (!resolvedSrc) return null;
      return (
        <img
          {...props}
          src={resolvedSrc}
          alt={alt || ''}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="max-w-full h-auto rounded-xl my-3 border border-black/10 dark:border-white/10"
        />
      );
    },
    table: ({ node, children, ...props }: any) => (
      <div className="my-4 w-full max-w-full overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
        <table {...props} className="w-full border-collapse text-left text-xs sm:text-sm">
          {children}
        </table>
      </div>
    ),
    pre: ({ node, children }: any) => {
      const child = React.Children.toArray(children)[0] as React.ReactElement<any>;
      const childClassName = child?.props?.className || '';
      const childContent = String(child?.props?.children ?? children ?? '').replace(/\n$/, '');
      if (
        childClassName.includes('language-mermaid') ||
        childClassName.includes('mermaid') ||
        childContent.startsWith('graph ') ||
        childContent.startsWith('flowchart ') ||
        childContent.startsWith('sequenceDiagram')
      ) {
        return <PeleDiagram code={childContent} isDark={isDark} />;
      }
      const matchLang = /language-([\w+-]+)/.exec(childClassName || '');
      const lang = matchLang ? matchLang[1] : 'text';
      return <PrismCodeBlock language={lang} code={childContent} isDark={isDark} />;
    },
    code: ({ node, className, children, ...props }: any) => {
      const text = String(children ?? '');
      const isInline = !className && !text.includes('\n');
      if (isInline) {
        return (
          <code
            {...props}
            className={`font-mono text-[0.84em] px-1.5 py-0.5 rounded break-words ${
              isDark
                ? 'bg-white/[0.08] text-neutral-100'
                : 'bg-black/[0.06] text-neutral-900'
            }`}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  const lensLabel =
    activeSummaryLens === 'takeaways'
      ? 'Key Takeaways'
      : activeSummaryLens === 'technical'
      ? 'Technical Architecture'
      : activeSummaryLens === 'custom'
      ? 'Page Q&A'
      : 'Executive Summary';

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-[100dvh] overflow-y-auto overflow-x-hidden scrollbar-thin transition-colors ${
        isDark ? 'bg-[#09090b] text-[#fafafa]' : 'bg-white text-[#09090b]'
      }`}
    >
      {/* Sticky Minimal Header */}
      <header
        className={`sticky top-0 z-20 backdrop-blur-md border-b transition-colors ${
          isDark
            ? 'bg-[#09090b]/90 border-white/[0.08]'
            : 'bg-white/90 border-black/[0.08]'
        }`}
      >
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onClose}
              className={`size-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-[#121215] hover:bg-white/[0.08] border-white/[0.08] text-white'
                  : 'bg-[#f4f4f5] hover:bg-black/[0.06] border-black/[0.08] text-[#09090b]'
              }`}
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-sm font-semibold tracking-tight truncate">
                  {title || 'URL Reader'}
                </h1>
                {wordCount > 0 && (
                  <span
                    className={`hidden sm:inline-block text-[11px] font-mono tabular-nums shrink-0 ${
                      isDark ? 'text-neutral-500' : 'text-neutral-400'
                    }`}
                  >
                    · {wordCount.toLocaleString()} words · {readTimeMin}m read
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compact Rendered | Raw Switcher */}
            <div
              className={`inline-flex items-center p-0.5 rounded-lg border ${
                isDark
                  ? 'bg-[#121215] border-white/[0.08]'
                  : 'bg-[#f4f4f5] border-black/[0.08]'
              }`}
            >
              <button
                type="button"
                onClick={() => setViewMode('rendered')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'rendered'
                    ? isDark
                      ? 'bg-white text-black'
                      : 'bg-[#09090b] text-white'
                    : isDark
                    ? 'text-neutral-400 hover:text-white'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                Reader
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewMode === 'raw'
                    ? isDark
                      ? 'bg-white text-black'
                      : 'bg-[#09090b] text-white'
                    : isDark
                    ? 'text-neutral-400 hover:text-white'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                Raw
              </button>
            </div>

            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!content || loading}
              className={`size-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer disabled:opacity-40 ${
                isDark
                  ? 'bg-[#121215] hover:bg-white/[0.08] border-white/[0.08] text-white'
                  : 'bg-[#f4f4f5] hover:bg-black/[0.06] border-black/[0.08] text-[#09090b]'
              }`}
              title="Copy markdown"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`size-8 rounded-lg flex items-center justify-center border transition-colors ${
                  isDark
                    ? 'bg-[#121215] hover:bg-white/[0.08] border-white/[0.08] text-white'
                    : 'bg-[#f4f4f5] hover:bg-black/[0.06] border-black/[0.08] text-[#09090b]'
                }`}
                title="Open source URL"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Single-Column Editorial Container */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-7 min-w-0">
        {/* Compact Single-Row URL Input Bar (No Nested Wrapper Box) */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchUrlContent(urlInput);
            }}
            placeholder="https://github.com/karpathy/nanoGPT"
            className={`flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-mono outline-none transition-colors ${
              isDark
                ? 'bg-[#121215] border-white/[0.1] text-white placeholder-neutral-500 focus:border-white/[0.28]'
                : 'bg-[#f4f4f5] border-black/[0.1] text-[#09090b] placeholder-neutral-400 focus:border-black/[0.28]'
            }`}
          />
          <button
            type="button"
            onClick={() => fetchUrlContent(urlInput)}
            disabled={loading || !urlInput.trim()}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-40 ${
              isDark
                ? 'bg-white text-black hover:bg-neutral-200'
                : 'bg-[#09090b] text-white hover:bg-neutral-800'
            }`}
          >
            {loading ? 'Reading...' : 'Read'}
          </button>
        </div>

        {/* Clean Action Bar + Inline Page Q&A (Only when content is loaded, zero decorative icons) */}
        {content && !loading && (
          <div className="mb-6 space-y-2.5">
            <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none pb-0.5">
              <div className="flex items-center gap-1.5 shrink-0">
                {(
                  [
                    { id: 'summary', label: 'Executive Summary' },
                    { id: 'takeaways', label: 'Key Takeaways' },
                    { id: 'technical', label: 'Architecture' },
                  ] as const
                ).map((item) => {
                  const isActive =
                    activeSummaryLens === item.id && (Boolean(aiSummary) || isSummarizing);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => runPageAiAnalysis(item.id)}
                      disabled={isSummarizing}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? isDark
                            ? 'bg-white text-black border-white'
                            : 'bg-[#09090b] text-white border-[#09090b]'
                          : isDark
                          ? 'bg-[#121215] border-white/[0.08] text-neutral-300 hover:text-white hover:border-white/[0.18]'
                          : 'bg-[#f4f4f5] border-black/[0.08] text-neutral-700 hover:text-black hover:border-black/[0.18]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {onChatWithPage && (
                <button
                  type="button"
                  onClick={() => {
                    onChatWithPage(activeUrl, title, content);
                    onClose();
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isDark
                      ? 'bg-[#121215] border-white/[0.12] text-white hover:bg-white/[0.08]'
                      : 'bg-[#f4f4f5] border-black/[0.12] text-[#09090b] hover:bg-black/[0.06]'
                  }`}
                >
                  Continue in Chat
                </button>
              )}
            </div>

            {/* Compact Single-Line Page Question Input */}
            <div className="flex items-center gap-2">
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
                className={`flex-1 min-w-0 px-3.5 py-2 rounded-xl border text-xs outline-none transition-colors ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08] text-white placeholder-neutral-500 focus:border-white/[0.22]'
                    : 'bg-[#f4f4f5] border-black/[0.08] text-[#09090b] placeholder-neutral-400 focus:border-black/[0.22]'
                }`}
              />
              {customQuestion.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    runPageAiAnalysis('custom', customQuestion);
                    setCustomQuestion('');
                  }}
                  disabled={isSummarizing}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    isDark
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-[#09090b] text-white hover:bg-neutral-800'
                  }`}
                >
                  Ask
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active AI Synthesis Output (Shown ONLY when active, zero empty placeholder boxes) */}
        {(isSummarizing || aiSummary) && (
          <section
            className={`mb-6 p-4 sm:p-5 rounded-2xl border min-w-0 ${
              isDark
                ? 'bg-[#121215] border-white/[0.1]'
                : 'bg-[#f8f8fa] border-black/[0.1]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-black/[0.08] dark:border-white/[0.08]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold tracking-tight truncate">
                  {lensLabel}
                </span>
                {isSummarizing && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin opacity-70 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {aiSummary && !isSummarizing && (
                  <button
                    type="button"
                    onClick={copySummaryToClipboard}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                        : 'text-neutral-600 hover:text-black hover:bg-black/[0.05]'
                    }`}
                  >
                    {copiedSummary ? 'Copied' : 'Copy'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAiSummary('');
                    setActiveSummaryLens('');
                  }}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                      : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                  }`}
                  title="Dismiss synthesis"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isSummarizing && !aiSummary ? (
              <div className="py-6 flex items-center gap-2.5 text-xs opacity-75">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Synthesizing page content...</span>
              </div>
            ) : (
              <div className="prose-grok max-w-none min-w-0 text-xs sm:text-sm leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
                  rehypePlugins={[rehypeKatex]}
                  components={renderMarkdownComponents}
                >
                  {aiSummary}
                </ReactMarkdown>
              </div>
            )}
          </section>
        )}

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-2.5">
            <Loader2 className="w-5 h-5 animate-spin opacity-70" />
            <p
              className={`text-xs font-medium ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              Extracting readable page content...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div
            className={`p-4 rounded-xl border text-xs sm:text-sm space-y-1 ${
              isDark
                ? 'bg-[#121215] border-white/[0.1] text-white'
                : 'bg-[#f4f4f5] border-black/[0.1] text-[#09090b]'
            }`}
          >
            <p className="font-semibold">Unable to extract URL</p>
            <p className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>{error}</p>
          </div>
        )}

        {/* Empty State with Quick Samples */}
        {!loading && !error && !content && (
          <div className="py-12 text-center space-y-3">
            <p
              className={`text-xs ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              Paste any URL above or select a sample source:
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
                      ? 'bg-[#121215] border-white/[0.08] hover:border-white/[0.2] text-neutral-300 hover:text-white'
                      : 'bg-[#f4f4f5] border-black/[0.08] hover:border-black/[0.2] text-neutral-700 hover:text-black'
                  }`}
                >
                  {sampleUrl.replace(/^https?:\/\//, '')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Extracted Article Body (Single Clean Surface — No Box-Inside-a-Box) */}
        {!loading && !error && content && (
          <article className="min-w-0 max-w-full">
            {/* Compact Metadata Line on Mobile */}
            {(activeUrl || wordCount > 0) && (
              <div
                className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono pb-4 mb-5 border-b ${
                  isDark
                    ? 'text-neutral-500 border-white/[0.08]'
                    : 'text-neutral-500 border-black/[0.08]'
                }`}
              >
                {activeUrl && (
                  <span className="truncate max-w-[240px] sm:max-w-md">{activeUrl}</span>
                )}
                {wordCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="tabular-nums">{wordCount.toLocaleString()} words</span>
                    <span>·</span>
                    <span className="tabular-nums">{readTimeMin} min read</span>
                  </>
                )}
                {duration !== null && (
                  <>
                    <span>·</span>
                    <span className="tabular-nums">{duration}ms</span>
                  </>
                )}
              </div>
            )}

            {viewMode === 'rendered' ? (
              <div className="prose-grok max-w-none min-w-0">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
                  rehypePlugins={[rehypeKatex]}
                  components={renderMarkdownComponents}
                >
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <pre
                className={`font-mono text-xs p-4 rounded-xl border whitespace-pre-wrap break-words leading-relaxed min-w-0 max-w-full ${
                  isDark
                    ? 'bg-[#121215] border-white/[0.08] text-neutral-200'
                    : 'bg-[#f8f8fa] border-black/[0.08] text-[#09090b]'
                }`}
              >
                {content}
              </pre>
            )}
          </article>
        )}
      </main>
    </div>
  );
};
