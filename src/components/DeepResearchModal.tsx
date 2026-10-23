import React, { useState } from 'react';
import {
  X,
  Compass,
  Search,
  BookOpen,
  FileText,
  Download,
  Check,
  Loader2,
  ArrowRight,
  ExternalLink,
  Copy,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SearchSource, ArxivPaper, ChatMessage } from '../types';
import { getAuthHeaders } from '../lib/firebase';
import { exportConversationAsPdf, exportConversationAsMarkdown } from '../lib/exportChat';

export interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  selectedModelId?: string;
  isDark?: boolean;
  onInsertReportToChat?: (
    topic: string,
    reportMarkdown: string,
    sources: SearchSource[],
    arxivPapers: ArxivPaper[]
  ) => void;
}

interface ResearchStepState {
  id: number;
  title: string;
  detail: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  durationMs?: number;
  count?: number;
}

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

export const DeepResearchModal: React.FC<DeepResearchModalProps> = ({
  isOpen,
  onClose,
  initialTopic = '',
  selectedModelId = 'deepseek-v4.1-flash:free',
  isDark = true,
  onInsertReportToChat,
}) => {
  const [topic, setTopic] = useState(initialTopic);
  const [focusDepth, setFocusDepth] = useState<'executive' | 'technical' | 'market'>('executive');
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<ResearchStepState[]>([
    {
      id: 1,
      title: '01. Live Web & News Discovery',
      detail: 'Decomposing query across web indexes and breaking news feeds',
      status: 'idle',
    },
    {
      id: 2,
      title: '02. Academic ArXiv & Community Pulse',
      detail: 'Searching scientific preprints, technical repositories, and Reddit/X discussions',
      status: 'idle',
    },
    {
      id: 3,
      title: '03. Executive Report Synthesis',
      detail: 'Cross-verifying claims and compiling cited executive brief',
      status: 'idle',
    },
  ]);

  const [sources, setSources] = useState<SearchSource[]>([]);
  const [arxivPapers, setArxivPapers] = useState<ArxivPaper[]>([]);
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const updateStep = (id: number, patch: Partial<ResearchStepState>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const runDeepResearch = async (customTopic?: string) => {
    const targetTopic = (customTopic ?? topic).trim();
    if (!targetTopic || isRunning) return;

    setIsRunning(true);
    setErrorMsg(null);
    setReportMarkdown('');
    setSources([]);
    setArxivPapers([]);
    setSteps([
      {
        id: 1,
        title: '01. Live Web & News Discovery',
        detail: `Querying web & news indexes for "${targetTopic}"...`,
        status: 'running',
      },
      {
        id: 2,
        title: '02. Academic ArXiv & Community Pulse',
        detail: 'Waiting for primary discovery...',
        status: 'idle',
      },
      {
        id: 3,
        title: '03. Executive Report Synthesis',
        detail: 'Waiting for multi-source evidence...',
        status: 'idle',
      },
    ]);

    try {
      const authHeaders = await getAuthHeaders();

      // STEP 1: Live Web + News Search
      const step1Start = Date.now();
      const [webRes, newsRes] = await Promise.allSettled([
        callApi('/api/search/live', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            query: targetTopic,
            searchMode: 'organic',
            isResearchMode: true,
          }),
        }).then((r) => r.json()),
        callApi('/api/search/live', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            query: `${targetTopic} latest news analysis`,
            searchMode: 'news',
            isResearchMode: true,
          }),
        }).then((r) => r.json()),
      ]);

      const step1Sources: SearchSource[] = [];
      const seenUrls = new Set<string>();
      const addSourceList = (list: any[]) => {
        if (!Array.isArray(list)) return;
        for (const item of list) {
          if (item?.url && !seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            step1Sources.push({
              ...item,
              position: step1Sources.length + 1,
            });
          }
        }
      };

      if (webRes.status === 'fulfilled' && webRes.value?.sources) {
        addSourceList(webRes.value.sources);
      }
      if (newsRes.status === 'fulfilled' && newsRes.value?.sources) {
        addSourceList(newsRes.value.sources);
      }

      setSources([...step1Sources]);
      updateStep(1, {
        status: 'completed',
        durationMs: Date.now() - step1Start,
        count: step1Sources.length,
        detail: `Collected ${step1Sources.length} verified web & news sources`,
      });

      // STEP 2: Academic ArXiv + Reddit/X Community Search
      updateStep(2, {
        status: 'running',
        detail: `Searching ArXiv papers and Reddit/X discussions for "${targetTopic}"...`,
      });
      const step2Start = Date.now();

      const [arxivRes, communityRes] = await Promise.allSettled([
        callApi(`/api/arxiv/search?q=${encodeURIComponent(targetTopic)}&max_results=4`, {
          headers: authHeaders,
        }).then((r) => r.json()),
        callApi('/api/search/live', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            query: `${targetTopic} site:reddit.com OR site:x.com OR site:news.ycombinator.com`,
            searchMode: 'organic',
            isResearchMode: true,
          }),
        }).then((r) => r.json()),
      ]);

      let discoveredPapers: ArxivPaper[] = [];
      if (arxivRes.status === 'fulfilled' && Array.isArray(arxivRes.value?.papers)) {
        discoveredPapers = arxivRes.value.papers;
        setArxivPapers(discoveredPapers);
      }
      if (communityRes.status === 'fulfilled' && communityRes.value?.sources) {
        addSourceList(communityRes.value.sources);
      }

      const allSources = [...step1Sources];
      setSources(allSources);

      updateStep(2, {
        status: 'completed',
        durationMs: Date.now() - step2Start,
        count: discoveredPapers.length + Math.max(0, allSources.length - step1Sources.length),
        detail: `Indexed ${discoveredPapers.length} ArXiv papers & ${allSources.length} total sources`,
      });

      // STEP 3: Executive Report Synthesis
      updateStep(3, {
        status: 'running',
        detail: 'Synthesizing executive report with inline citations...',
      });
      const step3Start = Date.now();

      const sourcesDigest = allSources
        .slice(0, 10)
        .map(
          (s, idx) =>
            `[${idx + 1}] ${s.title} (${s.domain || s.url})\nURL: ${s.url}\nSnippet: ${s.snippet || ''}`
        )
        .join('\n\n');

      const arxivDigest = discoveredPapers
        .slice(0, 4)
        .map(
          (p, idx) =>
            `[ArXiv-${idx + 1}] arXiv:${p.id} — "${p.title}" by ${p.authors.slice(0, 3).join(', ')} (${p.published})\nAbstract: ${p.summary?.slice(0, 350)}`
        )
        .join('\n\n');

      const focusInstruction =
        focusDepth === 'technical'
          ? 'Emphasize architectural mechanisms, mathematical/empirical benchmarks, methodology, and engineering trade-offs.'
          : focusDepth === 'market'
          ? 'Emphasize market landscape, competitive dynamics, valuation/adoption metrics, catalysts, and strategic risks.'
          : 'Provide a balanced, high-signal executive briefing covering core thesis, empirical data, technical architecture, and strategic outlook.';

      const synthesisPrompt = `Conduct a comprehensive Deep Research Executive Report on: "${targetTopic}".
${focusInstruction}

Use the following live multi-source research dossier to ground your report and include inline numbered citations like [1], [2], [3] matching the sources below:

=== LIVE WEB, NEWS & COMMUNITY SOURCES ===
${sourcesDigest || 'Use domain knowledge and latest verified facts.'}

=== ACADEMIC ARXIV PREPRINTS ===
${arxivDigest || 'No specific arXiv preprints required unless relevant.'}

Structure your report with clear Markdown headings:
1. **Executive Summary** (Core thesis and high-level conclusions)
2. **Key Quantitative & Empirical Findings** (Structured breakdown or comparison table)
3. **Deep Technical / Domain Analysis** (First-principles mechanisms and architecture)
4. **Community, Industry & Academic Consensus** (Synthesizing ArXiv research and industry discourse)
5. **Strategic Risks, Bottlenecks & 12-Month Outlook**`;

      const chatResp = await callApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messages: [{ role: 'user', content: synthesisPrompt }],
          webSearch: false,
          searchMode: 'off',
          model: selectedModelId,
          isResearchMode: true,
        }),
      });

      const chatData = await chatResp.json();
      if (!chatResp.ok || !chatData?.success) {
        throw new Error(chatData?.error || 'Failed to synthesize research report');
      }

      const finalReport = chatData.text || '';
      setReportMarkdown(finalReport);

      updateStep(3, {
        status: 'completed',
        durationMs: Date.now() - step3Start,
        detail: `Compiled ${finalReport.split(/\s+/).length} words with inline citations`,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Deep research agent encountered an error.');
      setSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'error', detail: err.message } : s))
      );
    } finally {
      setIsRunning(false);
    }
  };

  const buildExportThread = () => ({
    id: `research-${Date.now()}`,
    title: `Deep Research: ${topic || 'Executive Report'}`,
    createdAt: Date.now(),
    messages: [
      {
        id: 'u-1',
        role: 'user' as const,
        content: `Deep Research Report: ${topic}`,
        timestamp: Date.now(),
      },
      {
        id: 'a-1',
        role: 'assistant' as const,
        content: reportMarkdown,
        timestamp: Date.now(),
        sources,
        arxivPapers,
        modelUsed: 'Zeno Deep Research Agent',
      },
    ] as ChatMessage[],
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl max-h-[90vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl ${
          isDark
            ? 'bg-[#0b0c10] border-[#22252e] text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-4 ${
            isDark ? 'border-[#1d2029]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`size-9 rounded-xl border flex items-center justify-center ${
                isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
            >
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Deep Research Report Generator
              </h2>
              <p className="text-xs text-neutral-500">
                3-Step Autonomous Agent · Web, News, ArXiv & Community Synthesis
              </p>
            </div>
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

        {/* Research Prompt & Lens Bar */}
        <div
          className={`p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 ${
            isDark ? 'bg-[#101218] border-[#1d2029]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runDeepResearch();
              }}
              placeholder="Enter any research topic (e.g., Solid-state lithium-metal batteries 2026, Speculative decoding in LLMs)..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs outline-none transition-colors ${
                isDark
                  ? 'bg-[#0b0c10] border-[#252934] text-white focus:border-white/40'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-slate-900'
              }`}
            />
          </div>

          {/* Research Focus Selector */}
          <div
            className={`flex items-center gap-1 p-1 rounded-xl border shrink-0 ${
              isDark ? 'bg-[#0b0c10] border-[#252934]' : 'bg-white border-slate-200'
            }`}
          >
            {(
              [
                { id: 'executive', label: 'Executive' },
                { id: 'technical', label: 'Technical' },
                { id: 'market', label: 'Market' },
              ] as const
            ).map((lens) => (
              <button
                key={lens.id}
                type="button"
                onClick={() => setFocusDepth(lens.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  focusDepth === lens.id
                    ? isDark
                      ? 'bg-white text-black'
                      : 'bg-slate-900 text-white'
                    : 'text-neutral-500 hover:text-current'
                }`}
              >
                {lens.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => runDeepResearch()}
            disabled={isRunning || !topic.trim()}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
              isDark
                ? 'bg-white text-black hover:bg-neutral-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Researching...</span>
              </>
            ) : (
              <>
                <span>Run Deep Research</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Main Workspace Split */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 3-Step Autonomous Progress Tracker */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`p-3.5 rounded-xl border transition-colors ${
                  step.status === 'running'
                    ? isDark
                      ? 'bg-[#141822] border-white/30'
                      : 'bg-slate-100 border-slate-900'
                    : isDark
                    ? 'bg-[#101218] border-[#1f232e]'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{step.title}</span>
                  <span className="font-mono text-[11px] tabular-nums text-neutral-500 flex items-center gap-1">
                    {step.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-sky-400" />}
                    {step.status === 'completed' && <Check className="w-3.5 h-3.5 text-[#16A34A]" />}
                    {step.durationMs ? `${(step.durationMs / 1000).toFixed(1)}s` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">{step.detail}</p>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Starter Topics when idle */}
          {!isRunning && !reportMarkdown && (
            <div className="py-6">
              <div className="text-xs font-medium text-neutral-500 mb-3">
                Suggested Deep Research Investigations
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  'Post-transformer architectures: State Space Models (Mamba-2) vs hybrid attention at 1M context',
                  'Global semiconductor supply chain, EUV lithography bottlenecks, and AI accelerator economics',
                  'CRISPR prime editing clinical trials, in-vivo lipid nanoparticle delivery, and off-target benchmarks',
                  'Next-generation nuclear fission (SMRs) and magnetic confinement fusion grid commercialization',
                ].map((sample, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setTopic(sample);
                      runDeepResearch(sample);
                    }}
                    className={`p-3.5 rounded-xl border text-left text-xs leading-relaxed transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#101218] border-[#1f232e] hover:border-white/30 text-neutral-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-400 text-slate-700'
                    }`}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Discovered Sources & ArXiv Strip */}
          {(sources.length > 0 || arxivPapers.length > 0) && (
            <div
              className={`p-3.5 rounded-xl border ${
                isDark ? 'bg-[#0f1117] border-[#1f232e]' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold">
                  Verified Research Dossier ({sources.length} Web/News · {arxivPapers.length} ArXiv Preprints)
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {sources.slice(0, 8).map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-2 rounded-lg border shrink-0 w-56 text-left transition-colors ${
                      isDark
                        ? 'bg-[#151821] border-[#252a38] hover:border-white/30'
                        : 'bg-white border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-neutral-500 truncate">
                      [{i + 1}] · {s.domain || 'web'}
                    </div>
                    <div className="text-xs font-medium truncate mt-0.5">{s.title}</div>
                  </a>
                ))}
                {arxivPapers.map((p) => (
                  <a
                    key={p.id}
                    href={p.absUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-2 rounded-lg border shrink-0 w-60 text-left transition-colors ${
                      isDark
                        ? 'bg-[#151821] border-[#252a38] hover:border-white/30'
                        : 'bg-white border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-sky-400 truncate">
                      arXiv:{p.id} · Preprint
                    </div>
                    <div className="text-xs font-medium truncate mt-0.5">{p.title}</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Compiled Executive Report */}
          {reportMarkdown && (
            <div
              className={`rounded-2xl border overflow-hidden ${
                isDark ? 'bg-[#0e1015] border-[#222632]' : 'bg-white border-slate-200'
              }`}
            >
              {/* Report Action Header */}
              <div
                className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                  isDark ? 'bg-[#13161f] border-[#222632]' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-medium">
                  <FileText className="w-4 h-4" />
                  <span>Executive Research Report</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-neutral-500">
                    {reportMarkdown.split(/\s+/).length} words
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onInsertReportToChat && (
                    <button
                      type="button"
                      onClick={() => {
                        onInsertReportToChat(topic, reportMarkdown, sources, arxivPapers);
                        onClose();
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isDark
                          ? 'bg-white text-black hover:bg-neutral-200'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <span>Insert into Chat Thread</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => exportConversationAsPdf(buildExportThread())}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isDark
                        ? 'border-[#2c3140] hover:bg-white/5 text-neutral-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportConversationAsMarkdown(buildExportThread())}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isDark
                        ? 'border-[#2c3140] hover:bg-white/5 text-neutral-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Markdown</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(reportMarkdown);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'border-[#2c3140] hover:bg-white/5 text-neutral-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-6 prose-custom max-w-none text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reportMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
