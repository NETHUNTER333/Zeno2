import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  ExternalLink,
  Square,
  Plus,
} from 'lucide-react';
import { SearchSource, ArxivPaper, SearchMode, ChatAttachment } from '../types';
import { getAuthHeaders } from '../lib/firebase';
import { ThinkingState, ThinkingStep, ShimmerText } from './ui/thinking-state';
import { ChatInput } from './kobra/chat-input';
import { ModelOption, GROK_MODELS } from './GrokModelPicker';
import { GrokLogo } from './GrokLogo';

export interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  selectedModelId?: string;
  selectedModel?: ModelOption;
  onSelectModel?: (model: ModelOption) => void;
  searchMode?: SearchMode;
  onToggleSearchMode?: (mode: SearchMode) => void;
  isDark?: boolean;
  onInsertReportToChat?: (
    topic: string,
    reportMarkdown: string,
    sources: SearchSource[],
    arxivPapers: ArxivPaper[]
  ) => void;
}

export interface AnswerSource {
  id: number;
  name: string;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

const FEEDBACK_REASONS = ['Not accurate', 'Wrong source', 'Too long', 'Out of date'];

const INSTACLOUD_API_BASE = 'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

async function callApi(path: string, init?: RequestInit): Promise<Response> {
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

function formatSourceShortName(domainOrUrl: string, fallbackTitle?: string): string {
  try {
    const raw = domainOrUrl.includes('://') ? new URL(domainOrUrl).hostname : domainOrUrl;
    const host = raw.replace(/^www\./i, '').toLowerCase();
    if (host.includes('notion')) return 'Notion';
    if (host.includes('slack')) return 'Slack';
    if (host.includes('wikipedia')) return 'Wikipedia';
    if (host.includes('airbnb')) return 'Airbnb';
    if (host.includes('booking')) return 'Booking.com';
    if (host.includes('google')) return 'Google';
    if (host.includes('github')) return 'GitHub';
    if (host.includes('arxiv')) return 'ArXiv';
    if (host.includes('reuters')) return 'Reuters';
    if (host.includes('bloomberg')) return 'Bloomberg';
    if (host.includes('techcrunch')) return 'TechCrunch';
    if (host.includes('theverge')) return 'The Verge';
    if (host.includes('nytimes')) return 'NYTimes';
    if (host.includes('reddit')) return 'Reddit';
    if (host.includes('ycombinator')) return 'Hacker News';
    const base = host.split('.')[0] || '';
    if (base.length >= 2) {
      return base.charAt(0).toUpperCase() + base.slice(1);
    }
  } catch {}
  return (fallbackTitle || 'Source').split(/[\s–|-]+/)[0].slice(0, 14);
}

function buildDynamicThinkingSteps(
  query: string,
  answerSources: AnswerSource[]
): ThinkingStep[] {
  const shortTopic = query.length > 42 ? `${query.slice(0, 42).trim()}…` : query;
  const searchSources = answerSources.map((s) => ({
    label: `${s.name} – ${s.title.slice(0, 28)}`,
    domain: s.domain,
    href: s.url,
  }));

  const steps: ThinkingStep[] = [];

  if (searchSources.length > 0) {
    steps.push({
      type: 'search',
      label: 'Searched',
      sources: searchSources,
    });
  }

  steps.push(
    {
      type: 'thought',
      text:
        searchSources.length > 0
          ? `Reading ${searchSources.length} sources about ${shortTopic}`
          : `Searching live sources for ${shortTopic}`,
    },
    {
      type: 'thought',
      text: 'Cross-referencing primary facts and claims',
    },
    {
      type: 'thought',
      text: 'Verifying dates, numbers, and source citations',
    },
    {
      type: 'thought',
      text: 'Drafting cited answer',
    }
  );

  return steps;
}

export const DeepResearchModal: React.FC<DeepResearchModalProps> = ({
  isOpen,
  onClose,
  initialTopic = '',
  selectedModelId = 'deepseek-v4.1-flash:free',
  selectedModel: propSelectedModel,
  onSelectModel: propOnSelectModel,
  searchMode: propSearchMode = 'organic',
  onToggleSearchMode: propOnToggleSearchMode,
  isDark = true,
  onInsertReportToChat,
}) => {
  const [localModel, setLocalModel] = useState<ModelOption>(
    propSelectedModel || GROK_MODELS[0]
  );
  const [localSearchMode, setLocalSearchMode] = useState<SearchMode>(propSearchMode);

  const activeModel = propSelectedModel || localModel;
  const handleSelectModel = propOnSelectModel || setLocalModel;
  const activeSearchMode = propSearchMode || localSearchMode;
  const handleToggleSearchMode = propOnToggleSearchMode || setLocalSearchMode;

  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>('');
  const [sources, setSources] = useState<AnswerSource[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [thinkingStatus, setThinkingStatus] = useState<'thinking' | 'done'>('thinking');
  const [thinkingDuration, setThinkingDuration] = useState<number>(1);

  const [fullAnswer, setFullAnswer] = useState<string>('');
  const [visibleWordCount, setVisibleWordCount] = useState<number>(0);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);

  const [hoveredSourceIds, setHoveredSourceIds] = useState<number[]>([]);
  const [activeChipPreview, setActiveChipPreview] = useState<{
    ids: number[];
    anchorKey: string;
  } | null>(null);

  const [copied, setCopied] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [liveStatusAnnouncement, setLiveStatusAnnouncement] = useState<string>('');

  const abortRef = useRef<AbortController | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  // Close chip preview on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeChipPreview) {
          setActiveChipPreview(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeChipPreview]);

  const resetToCleanPage = () => {
    if (abortRef.current) abortRef.current.abort();
    if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    setHasStarted(false);
    setQuestion('');
    setSources([]);
    setThinkingSteps([]);
    setThinkingStatus('thinking');
    setThinkingDuration(1);
    setFullAnswer('');
    setVisibleWordCount(0);
    setFollowUps([]);
    setIsSearching(false);
    setIsStreaming(false);
    setDurationSec(0);
    setFeedback(null);
    setSelectedReason(null);
    setActiveChipPreview(null);
  };

  const startWordStream = (textToStream: string) => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
    }
    const totalWords = textToStream.split(/\s+/).length;
    setVisibleWordCount(1);
    setIsStreaming(true);

    streamTimerRef.current = window.setInterval(() => {
      setVisibleWordCount((prev) => {
        if (prev >= totalWords + 4) {
          if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
          setIsStreaming(false);
          return totalWords + 10;
        }
        return prev + 2;
      });
    }, 45);
  };

  const executeLiveAnswer = async (targetQuestion: string) => {
    const cleanQ = targetQuestion.trim();
    if (!cleanQ) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setHasStarted(true);
    setQuestion(cleanQ);
    setFeedback(null);
    setSelectedReason(null);
    setActiveChipPreview(null);
    setIsSearching(true);
    setIsStreaming(true);
    setThinkingStatus('thinking');
    setThinkingSteps(buildDynamicThinkingSteps(cleanQ, []));
    setSources([]);
    setFullAnswer('');
    setVisibleWordCount(0);
    setFollowUps([]);

    scrollViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    const startTime = performance.now();

    try {
      const authHeaders = await getAuthHeaders();

      // 1. Live Web Search
      const searchRes = await callApi('/api/search/live', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          query: cleanQ,
          searchMode: 'organic',
          isResearchMode: true,
        }),
      }).then((r) => r.json());

      const rawSources: SearchSource[] = Array.isArray(searchRes?.sources)
        ? searchRes.sources.slice(0, 8)
        : [];

      const mappedSources: AnswerSource[] = rawSources.map((s, idx) => {
        const domain =
          s.domain ||
          (() => {
            try {
              return new URL(s.url).hostname.replace(/^www\./, '');
            } catch {
              return 'web.source';
            }
          })();
        return {
          id: idx + 1,
          name: formatSourceShortName(domain, s.title),
          title: s.title || domain,
          url: s.url,
          domain,
          snippet: s.snippet,
        };
      });

      setSources(mappedSources.slice(0, 6));
      setThinkingSteps(buildDynamicThinkingSteps(cleanQ, mappedSources));
      setIsSearching(false);

      const sourceContext = mappedSources
        .slice(0, 6)
        .map(
          (s) =>
            `[${s.id}] ${s.name} (${s.domain}) — ${s.title}\nSnippet: ${s.snippet || ''}`
        )
        .join('\n\n');

      const prompt = `Answer the following question concisely in the exact style of an executive cited brief:
Question: "${cleanQ}"

${sourceContext ? `Sources:\n${sourceContext}\n` : ''}
Formatting rules (CRITICAL):
- Start with a 1-2 sentence direct synthesis paragraph with **bold** key entity/recommendation${sourceContext ? ' and an inline citation like [1] or [1,3]' : ''}.
- Follow with 3 concise bullet points starting with "- **Label:** details${sourceContext ? ' [2]' : ''}."${sourceContext ? ' citing the relevant 1-based source numbers in brackets like [1], [2,4].' : ''}
- End with a short 1-sentence actionable takeaway${sourceContext ? ' with a citation like [3]' : ''}.
- After the answer, add a line "---FOLLOWUPS---" followed by 2 or 3 short, natural follow-up questions (one per line, no bullets or numbers).
- Do NOT include any markdown headings (#) or preamble.`;

      const chatResp = await callApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          webSearch: false,
          searchMode: 'off',
          model: activeModel?.geminiModel || selectedModelId,
          isResearchMode: false,
        }),
      });

      const chatData = await chatResp.json();
      const rawReply = String(chatData?.text || '')
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .trim();

      const elapsed = Math.max(1, (performance.now() - startTime) / 1000);
      setThinkingDuration(Math.max(1, Math.round(elapsed)));
      setThinkingStatus('done');
      setDurationSec(Number(elapsed.toFixed(1)));

      if (rawReply) {
        const [answerPart, followUpPart] = rawReply.split(/---FOLLOWUPS---/i);
        const cleanAnswer = (answerPart || rawReply).trim();
        const parsedFollowUps = (followUpPart || '')
          .split('\n')
          .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
          .filter((l) => l.length > 8 && l.length < 95)
          .slice(0, 3);

        setFullAnswer(cleanAnswer);
        if (parsedFollowUps.length > 0) {
          setFollowUps(parsedFollowUps);
        } else {
          setFollowUps([
            `Compare the key options for ${cleanQ.slice(0, 36)}`,
            `What are the main trade-offs and considerations?`,
          ]);
        }
        startWordStream(cleanAnswer);
      } else {
        setIsStreaming(false);
        setFullAnswer('Unable to generate an answer right now. Please try asking again.');
        setVisibleWordCount(999);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const elapsed = Math.max(1, (performance.now() - startTime) / 1000);
      setIsSearching(false);
      setIsStreaming(false);
      setThinkingDuration(Math.max(1, Math.round(elapsed)));
      setThinkingStatus('done');
      setDurationSec(Number(elapsed.toFixed(1)));
      setFullAnswer('Connection interrupted while researching. Please try again.');
      setVisibleWordCount(999);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = initialTopic.trim();
    if (trimmed) {
      executeLiveAnswer(trimmed);
    } else {
      resetToCleanPage();
    }
    return () => {
      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTopic]);

  const handleStopStreaming = () => {
    if (abortRef.current) abortRef.current.abort();
    if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    setIsSearching(false);
    setIsStreaming(false);
    setThinkingStatus('done');
    setVisibleWordCount(9999);
    setLiveStatusAnnouncement('Generation stopped');
  };

  const handleRegenerate = () => {
    if (question.trim()) {
      executeLiveAnswer(question);
      setLiveStatusAnnouncement('Regenerating answer');
    }
  };

  const handleCopy = () => {
    const plainAnswer = fullAnswer
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\[(\d+(?:,\s*\d+)*)\]/g, '[$1]');
    const sourceList = sources
      .map((s) => `[${s.id}] ${s.name}: ${s.title} (${s.url})`)
      .join('\n');
    const finalCopy = sourceList
      ? `${question}\n\n${plainAnswer}\n\nSources:\n${sourceList}`
      : `${question}\n\n${plainAnswer}`;
    navigator.clipboard.writeText(finalCopy);
    setCopied(true);
    setLiveStatusAnnouncement('Copied answer and sources to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Slice answer by visibleWordCount while preserving paragraphs and citations
  const displayedAnswer = useMemo(() => {
    if (!fullAnswer) return '';
    const tokens = fullAnswer.split(/(\s+)/);
    let wordsSeen = 0;
    let out = '';
    for (const tok of tokens) {
      if (/\S/.test(tok)) {
        wordsSeen++;
        if (wordsSeen > visibleWordCount) break;
      }
      out += tok;
    }
    return out;
  }, [fullAnswer, visibleWordCount]);

  // Render inline text with **bold** and [1] or [1,3] citation chips
  const renderRichLine = (lineText: string, lineKey: string) => {
    const parts = lineText.split(/(\[\d+(?:,\s*\d+)*\]|\*\*[^*]+\*\*)/g);

    return parts.map((part, idx) => {
      if (!part) return null;

      // Bold segment
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong
            key={`${lineKey}-b-${idx}`}
            className={isDark ? 'font-semibold text-white' : 'font-semibold text-neutral-900'}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Citation segment e.g. [1] or [1,3]
      const citeMatch = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
      if (citeMatch) {
        const ids = citeMatch[1]
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n));
        const primarySource = sources.find((s) => s.id === ids[0]) || sources[0];
        if (!primarySource) return null;

        const extraCount = ids.length > 1 ? ` +${ids.length - 1}` : '';
        const chipLabel = `${primarySource.name}${extraCount}`;
        const anchorKey = `${lineKey}-c-${idx}`;
        const isHighlighted = ids.some((id) => hoveredSourceIds.includes(id));
        const isPreviewOpen = activeChipPreview?.anchorKey === anchorKey;

        return (
          <span key={anchorKey} className="relative inline-block align-baseline mx-0.5">
            <button
              type="button"
              onMouseEnter={() => setHoveredSourceIds(ids)}
              onMouseLeave={() => setHoveredSourceIds([])}
              onClick={(e) => {
                e.stopPropagation();
                setActiveChipPreview(
                  isPreviewOpen ? null : { ids, anchorKey }
                );
              }}
              aria-label={`Source: ${chipLabel}`}
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium leading-tight transition-all cursor-pointer ${
                isHighlighted || isPreviewOpen
                  ? isDark
                    ? 'bg-white text-black'
                    : 'bg-neutral-900 text-white'
                  : isDark
                  ? 'bg-white/[0.08] text-neutral-300 hover:bg-white/[0.15] hover:text-white'
                  : 'bg-black/[0.06] text-neutral-700 hover:bg-black/[0.12] hover:text-black'
              }`}
            >
              {chipLabel}
            </button>

            {/* Citation Source Preview Tooltip / Popover */}
            {isPreviewOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                role="tooltip"
                className={`absolute left-0 bottom-full mb-2 w-64 sm:w-72 rounded-2xl border p-3 z-50 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
                  isDark
                    ? 'bg-[#18181c] border-white/[0.14] text-white'
                    : 'bg-white border-black/[0.1] text-neutral-900'
                }`}
              >
                <div className="space-y-2.5">
                  {ids.map((id) => {
                    const src = sources.find((s) => s.id === id);
                    if (!src) return null;
                    return (
                      <a
                        key={src.id}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] opacity-65 mb-0.5">
                          <span className="font-medium truncate">{src.name}</span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            #{src.id}
                            <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
                          </span>
                        </div>
                        <div className="text-xs font-medium leading-snug group-hover:underline">
                          {src.title}
                        </div>
                        {src.snippet && (
                          <p className="text-[11px] opacity-65 mt-1 line-clamp-2 leading-relaxed">
                            {src.snippet}
                          </p>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </span>
        );
      }

      return <React.Fragment key={`${lineKey}-t-${idx}`}>{part}</React.Fragment>;
    });
  };

  if (!isOpen) return null;

  const blocks = displayedAnswer
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div
      onClick={() => setActiveChipPreview(null)}
      className={`fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden select-text transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-white' : 'bg-[#ffffff] text-[#000000]'
      }`}
    >
      {/* Screen-reader polite live region */}
      <div className="sr-only" aria-live="polite">
        {liveStatusAnnouncement}
      </div>

      {/* Top Navigation Bar */}
      <div className="shrink-0 max-w-3xl mx-auto w-full px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            isDark
              ? 'bg-[#141418] border-white/[0.1] text-neutral-300 hover:text-white hover:bg-white/[0.06]'
              : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black hover:bg-neutral-100'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          {hasStarted && (
            <button
              type="button"
              onClick={resetToCleanPage}
              title="New Research"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#141418] border-white/[0.1] text-neutral-300 hover:text-white hover:bg-white/[0.06]'
                  : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black hover:bg-neutral-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}

          {onInsertReportToChat && hasStarted && fullAnswer && !isStreaming && (
            <button
              type="button"
              onClick={() => {
                onInsertReportToChat(
                  question,
                  fullAnswer,
                  sources.map((s) => ({
                    title: s.title,
                    url: s.url,
                    domain: s.domain,
                    snippet: s.snippet || '',
                    position: s.id,
                  })),
                  []
                );
                onClose();
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white text-black hover:bg-neutral-200'
                  : 'bg-[#18181b] text-white hover:bg-neutral-800'
              }`}
            >
              Open in Chat
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Clean Empty Page before query, or Live Thinking + AI Answer after query */}
      {!hasStarted ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 select-none">
          <GrokLogo size="lg" isDark={isDark} />
        </div>
      ) : (
        <div
          ref={scrollViewportRef}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-3 sm:py-5 scrollbar-thin"
        >
          <div className="max-w-[640px] mx-auto w-full space-y-4 pb-6">
            {/* affectUI Thinking State Card (Only rendered for active/completed real user query) */}
            <ThinkingState
              steps={thinkingSteps}
              status={thinkingStatus}
              duration={thinkingDuration}
              stepInterval={700}
              maxVisibleSources={4}
              defaultOpen={true}
              isDark={isDark}
            />

            {/* affectUI AI Answer Card */}
            <div
              className={`rounded-3xl border p-5 sm:p-7 transition-all duration-200 ${
                isDark
                  ? 'bg-[#121215] border-white/[0.09] shadow-[0_24px_60px_rgba(0,0,0,0.65)]'
                  : 'bg-white border-black/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.06)]'
              }`}
            >
              {/* Question Title */}
              <h1 className="text-[19px] sm:text-[21px] font-semibold tracking-tight leading-snug mb-5">
                {question}
              </h1>

              {/* Horizontal Scrollable Source Cards */}
              {(sources.length > 0 || isSearching) && (
                <div className="mb-6">
                  {isSearching && sources.length === 0 && (
                    <div className="mb-2.5">
                      <ShimmerText
                        text="Searching web sources..."
                        isDark={isDark}
                        className="text-xs font-medium"
                      />
                    </div>
                  )}

                  {sources.length > 0 && (
                    <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1 scrollbar-none">
                      {sources.map((src, idx) => {
                        const isCardHighlighted = hoveredSourceIds.includes(src.id);
                        const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                          src.domain
                        )}&sz=32`;

                        return (
                          <a
                            key={src.id}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseEnter={() => setHoveredSourceIds([src.id])}
                            onMouseLeave={() => setHoveredSourceIds([])}
                            style={{ animationDelay: `${idx * 55}ms` }}
                            className={`w-44 sm:w-48 shrink-0 rounded-2xl border p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-150 animate-in fade-in slide-in-from-bottom-1 ${
                              isCardHighlighted
                                ? isDark
                                  ? 'bg-white/[0.09] border-white/30'
                                  : 'bg-neutral-100 border-black/30'
                                : isDark
                                ? 'bg-[#18181c] border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.05]'
                                : 'bg-[#f8f8f9] border-black/[0.07] hover:border-black/[0.16] hover:bg-neutral-100/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={faviconUrl}
                                  alt=""
                                  className="w-4 h-4 rounded-sm shrink-0 object-contain"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <span
                                  className={`text-xs font-medium truncate ${
                                    isDark ? 'text-neutral-300' : 'text-neutral-600'
                                  }`}
                                >
                                  {src.name}
                                </span>
                              </div>
                              <span
                                className={`text-xs font-mono tabular-nums ${
                                  isDark ? 'text-neutral-500' : 'text-neutral-400'
                                }`}
                              >
                                {src.id}
                              </span>
                            </div>

                            <div
                              className={`text-[13.5px] font-medium leading-snug line-clamp-2 ${
                                isDark ? 'text-neutral-100' : 'text-neutral-900'
                              }`}
                            >
                              {src.title}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Answer Section Header */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-xs font-medium ${
                    isDark ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  Answer
                </span>
              </div>

              {/* Streamed Answer Body */}
              <div
                aria-busy={isStreaming}
                className={`space-y-4 text-[15px] leading-[1.65] ${
                  isDark ? 'text-neutral-200' : 'text-neutral-800'
                }`}
              >
                {blocks.length === 0 && (isSearching || isStreaming) ? (
                  <div className="py-1">
                    <ShimmerText
                      text="Synthesizing answer..."
                      isDark={isDark}
                      className="text-sm"
                    />
                  </div>
                ) : (
                  blocks.map((block, bIdx) => {
                    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
                    const isBulletList = lines.every((l) => /^[-*•]\s+/.test(l));
                    const isLastBlock = bIdx === blocks.length - 1;

                    if (isBulletList) {
                      return (
                        <ul key={`blk-${bIdx}`} className="space-y-2.5 pl-1">
                          {lines.map((item, lIdx) => {
                            const cleanItem = item.replace(/^[-*•]\s+/, '');
                            const isVeryLast = isLastBlock && lIdx === lines.length - 1;
                            return (
                              <li
                                key={`li-${bIdx}-${lIdx}`}
                                className="flex items-start gap-2.5 leading-[1.6]"
                              >
                                <span
                                  className={`mt-2 size-1.5 rounded-full shrink-0 ${
                                    isDark ? 'bg-neutral-500' : 'bg-neutral-400'
                                  }`}
                                />
                                <span className="flex-1">
                                  {renderRichLine(cleanItem, `li-${bIdx}-${lIdx}`)}
                                  {isStreaming && isVeryLast && (
                                    <span
                                      className={`inline-block size-2 rounded-full ml-1.5 align-middle animate-pulse ${
                                        isDark ? 'bg-white' : 'bg-black'
                                      }`}
                                    />
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      );
                    }

                    return (
                      <p key={`blk-${bIdx}`} className="leading-[1.65]">
                        {renderRichLine(block, `p-${bIdx}`)}
                        {isStreaming && isLastBlock && (
                          <span
                            className={`inline-block size-2 rounded-full ml-1.5 align-middle animate-pulse ${
                              isDark ? 'bg-white' : 'bg-black'
                            }`}
                          />
                        )}
                      </p>
                    );
                  })
                )}
              </div>

              {/* Related Follow-Ups */}
              {!isStreaming && followUps.length > 0 && (
                <div className="mt-7 pt-2">
                  <div
                    className={`text-[11px] font-medium tracking-wider uppercase mb-2 ${
                      isDark ? 'text-neutral-500' : 'text-neutral-400'
                    }`}
                  >
                    Related
                  </div>
                  <div
                    className={`divide-y border-t ${
                      isDark
                        ? 'divide-white/[0.07] border-white/[0.07]'
                        : 'divide-black/[0.07] border-black/[0.07]'
                    }`}
                  >
                    {followUps.map((fUp, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => executeLiveAnswer(fUp)}
                        className={`w-full py-3.5 flex items-center justify-between gap-3 text-left text-[14.5px] font-normal transition-colors cursor-pointer group ${
                          isDark
                            ? 'text-neutral-200 hover:text-white'
                            : 'text-neutral-800 hover:text-black'
                        }`}
                      >
                        <span className="truncate">{fUp}</span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                            isDark ? 'text-neutral-500' : 'text-neutral-400'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Actions & Answered Timing Footer */}
              <div
                className={`mt-5 pt-4 border-t flex items-center justify-between gap-3 ${
                  isDark ? 'border-white/[0.07]' : 'border-black/[0.07]'
                }`}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy answer and sources"
                    aria-label="Copy answer"
                    className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                        : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {isStreaming || isSearching ? (
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      title="Stop generating"
                      aria-label="Stop generating"
                      className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        isDark
                          ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                          : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                      }`}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      title="Regenerate answer"
                      aria-label="Regenerate answer"
                      className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        isDark
                          ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                          : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(feedback === 'up' ? null : 'up');
                      setSelectedReason(null);
                      setLiveStatusAnnouncement('Feedback recorded: helpful');
                    }}
                    title="Helpful"
                    aria-label="Thumbs up"
                    className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      feedback === 'up'
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-neutral-900 text-white'
                        : isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                        : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(feedback === 'down' ? null : 'down');
                      setLiveStatusAnnouncement('Feedback recorded: not helpful');
                    }}
                    title="Not helpful"
                    aria-label="Thumbs down"
                    className={`size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      feedback === 'down'
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-neutral-900 text-white'
                        : isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                        : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={`text-xs font-normal tabular-nums ${
                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                  }`}
                >
                  {isSearching || isStreaming ? (
                    <ShimmerText text="Answering..." isDark={isDark} className="text-xs" />
                  ) : (
                    `Answered in ${durationSec}s`
                  )}
                </div>
              </div>

              {/* Feedback Reasons Row when Thumbs Down is selected */}
              {feedback === 'down' && (
                <div className="mt-3 pt-3 border-t border-current/10 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
                  {FEEDBACK_REASONS.map((reason) => {
                    const active = selectedReason === reason;
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          setSelectedReason(reason);
                          setLiveStatusAnnouncement(`Feedback reason selected: ${reason}`);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-normal border transition-colors cursor-pointer ${
                          active
                            ? isDark
                              ? 'bg-white text-black border-white'
                              : 'bg-neutral-900 text-white border-neutral-900'
                            : isDark
                            ? 'bg-white/[0.04] border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                            : 'bg-black/[0.04] border-black/10 text-neutral-700 hover:bg-black/[0.08]'
                        }`}
                      >
                        {reason}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Docked Bottom Prompt Input Bar (No overlap with scrollable cards above) */}
      <div className="shrink-0 w-full px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm: pb-6">
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput
            onSend={(message: string, _mode: SearchMode, _attachments?: ChatAttachment[]) => {
              executeLiveAnswer(message);
            }}
            onCancel={handleStopStreaming}
            isRunning={isSearching || isStreaming}
            searchMode={activeSearchMode}
            onToggleSearchMode={handleToggleSearchMode}
            selectedModel={activeModel}
            onSelectModel={handleSelectModel}
            placeholder="What do you want to research?"
            autoFocus
            theme={isDark ? 'dark' : 'light'}
          />
        </div>
      </div>
    </div>
  );
};
