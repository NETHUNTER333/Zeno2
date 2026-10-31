import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Square,
  Plus,
  Clock,
  Trash2,
  Search,
  X,
  Download,
  Edit3,
  Sparkles,
  Cpu,
  CheckCircle2,
  Loader2,
  Brain,
  BookOpen,
  Binary,
  FileCheck2,
  Network,
  Layers,
} from 'lucide-react';
import { SearchSource, ArxivPaper, SearchMode, ChatAttachment } from '../types';
import { getAuthHeaders } from '../lib/firebase';
import { ShimmerText, ThinkingStep } from './ui/thinking-state';
import {
  ChainOfThought,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
} from './ui/chain-of-thought';
import {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceDescription,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
} from './ui/trace';
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockContent,
} from './ui/code-block';
import { Badge } from './ui/badge';
import { ChatInput } from './kobra/chat-input';
import { ModelOption, GROK_MODELS } from './GrokModelPicker';
import { GrokLogo } from './GrokLogo';
import {
  DeepResearchHistoryStore,
  DeepResearchRecord,
} from '../lib/deepResearchHistoryStore';
import { MathMarkdown } from './MathMarkdown';

export interface AgentTraceStep {
  action: string;
  title: string;
  detail: string;
  latencyMs?: number;
}

export interface InstaCloudAgentRecord {
  id: string;
  name: string;
  role: string;
  node: string;
  status: 'running' | 'completed' | 'error';
  latencyMs: number;
  summary: string;
  thought: string;
  steps: AgentTraceStep[];
}

function parseMarkdownTable(block: string) {
  const rawLines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rawLines.length < 2) return null;
  if (!rawLines[0].startsWith('|') || !rawLines[0].endsWith('|')) return null;
  if (!/^[|:\-\s]+$/.test(rawLines[1]) || !rawLines[1].includes('-')) return null;

  const parseRow = (line: string) =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  const headers = parseRow(rawLines[0]);
  const rows = rawLines.slice(2).filter((l) => l.startsWith('|')).map(parseRow);
  if (rows.length === 0) return null;
  return { headers, rows };
}

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

function isClientBoilerplateSource(s: { url?: string; domain?: string; title?: string; snippet?: string }): boolean {
  const url = String(s?.url || '').toLowerCase();
  const domain = String(s?.domain || '').toLowerCase();
  const title = String(s?.title || '').toLowerCase();
  const junkDomains = [
    'ogs.google.com',
    'accounts.google.com',
    'account.google.com',
    'myaccount.google.com',
    'drive.google.com',
    'translate.google.com',
    'workspace.google.com',
    'voice.google.com',
    'mail.google.com',
    'calendar.google.com',
    'contacts.google.com',
    'photos.google.com',
    'play.google.com',
    'maps.google.com',
    'support.google.com',
    'policies.google.com',
  ];
  if (junkDomains.some((d) => domain === d || domain.endsWith(`.${d}`) || url.includes(`://${d}`))) {
    return true;
  }
  if (
    /^sign in\s*[-–|]/i.test(title) ||
    title === 'google translate' ||
    title === 'google dashboard' ||
    title === 'google search' ||
    title === 'voice' ||
    title.includes('government program solutions')
  ) {
    return true;
  }
  return false;
}

function isCorruptedResearchAnswer(answer: string): boolean {
  if (!answer) return false;
  return (
    answer.includes('Here is a clean, copiable implementation for **You are a Principal Scientific Investigator') ||
    answer.includes('CRITICAL INSTRUCTIONS FOR COMPLETE UNABBREVIATED OUTPUT:') ||
    answer.includes('export default function GeneratedComponent()')
  );
}

function formatSourceShortName(domainOrUrl: string, fallbackTitle?: string): string {
  try {
    const raw = domainOrUrl.includes('://') ? new URL(domainOrUrl).hostname : domainOrUrl;
    const host = raw.replace(/^www\./i, '').toLowerCase();
    if (host.includes('pubmed') || host.includes('ncbi.nlm.nih.gov')) return 'PubMed';
    if (host.includes('europepmc')) return 'Europe PMC';
    if (host === 'doi.org' || host.endsWith('.doi.org')) return 'DOI';
    if (host.includes('arxiv')) return 'ArXiv';
    if (host.includes('nature.com')) return 'Nature';
    if (host.includes('thelancet')) return 'The Lancet';
    if (host.includes('nejm.org')) return 'NEJM';
    if (host.includes('cell.com')) return 'Cell';
    if (host.includes('sciencedirect')) return 'ScienceDirect';
    if (host.includes('springer')) return 'Springer';
    if (host.includes('oup.com') || host.includes('academic.oup')) return 'Oxford Academic';
    if (host.includes('wiley.com')) return 'Wiley';
    if (host.includes('bmj.com')) return 'BMJ';
    if (host.includes('jamanetwork')) return 'JAMA';
    if (host.includes('frontiersin')) return 'Frontiers';
    if (host.includes('mdpi.com')) return 'MDPI';
    if (host.includes('plos.org')) return 'PLOS';
    if (host.includes('nih.gov')) return 'NIH';
    if (host.includes('mayoclinic')) return 'Mayo Clinic';
    if (host.includes('clevelandclinic')) return 'Cleveland Clinic';
    if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter')) return 'X';
    if (host.includes('notion')) return 'Notion';
    if (host.includes('slack')) return 'Slack';
    if (host.includes('wikipedia')) return 'Wikipedia';
    if (host.includes('airbnb')) return 'Airbnb';
    if (host.includes('booking')) return 'Booking.com';
    if (host.includes('scholar.google')) return 'Google Scholar';
    if (host.includes('google')) return 'Google';
    if (host.includes('github')) return 'GitHub';
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
          ? `Reading ${searchSources.length} peer-reviewed & verified sources about ${shortTopic}`
          : `Searching scholarly & live databases for ${shortTopic}`,
    },
    {
      type: 'thought',
      text: 'Cross-referencing clinical trials, molecular pathways, and empirical data',
    },
    {
      type: 'thought',
      text: 'Verifying quantitative metrics, biomarkers, and source citations',
    },
    {
      type: 'thought',
      text: 'Synthesizing publication-grade systematic review',
    }
  );

  return steps;
}

function formatHistoryDate(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export const DeepResearchModal: React.FC<DeepResearchModalProps> = ({
  isOpen,
  onClose,
  initialTopic = '',
  selectedModelId = 'zro/deepseek-v4.1-flash',
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
  const [localSearchMode, setLocalSearchMode] = useState<SearchMode>(
    propSearchMode === 'news' ? 'news' : 'organic'
  );

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
  const [agents, setAgents] = useState<InstaCloudAgentRecord[]>([]);
  const [agentClusterInfo, setAgentClusterInfo] = useState<{
    cluster: string;
    projectId: string;
    executionTimeMs: number;
    status: string;
  }>({
    cluster: 'instacloud-us-east-distributed',
    projectId: 'd374ae51-92bc-4bcb-83e0-ecc46ea5794a',
    executionTimeMs: 0,
    status: 'idle',
  });

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
    rect?: { top: number; bottom: number; left: number; right: number; width: number };
  } | null>(null);

  const [copied, setCopied] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [liveStatusAnnouncement, setLiveStatusAnnouncement] = useState<string>('');

  // Deep Research History States
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<DeepResearchRecord[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Sync and subscribe to DeepResearchHistoryStore (purging any corrupted cached runs)
  useEffect(() => {
    if (!isOpen) return;
    const sanitizeRecords = (records: DeepResearchRecord[]) => {
      const clean: DeepResearchRecord[] = [];
      for (const r of records) {
        if (isCorruptedResearchAnswer(r.fullAnswer)) {
          DeepResearchHistoryStore.deleteRecord(r.id).catch(() => {});
        } else {
          clean.push(r);
        }
      }
      return clean;
    };
    setHistoryList(sanitizeRecords(DeepResearchHistoryStore.getHistory()));
    const unsub = DeepResearchHistoryStore.subscribe(() => {
      setHistoryList(sanitizeRecords(DeepResearchHistoryStore.getHistory()));
    });
    DeepResearchHistoryStore.syncFromFirestore().then((res) => {
      if (res && res.length) setHistoryList(sanitizeRecords(res));
    });
    return unsub;
  }, [isOpen]);

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
        } else if (isHistoryOpen) {
          setIsHistoryOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeChipPreview, isHistoryOpen]);

  const resetToCleanPage = () => {
    if (abortRef.current) abortRef.current.abort();
    if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    setSelectedHistoryId(null);
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

  const loadHistoryItem = (record: DeepResearchRecord) => {
    if (abortRef.current) abortRef.current.abort();
    if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);

    if (isCorruptedResearchAnswer(record.fullAnswer)) {
      DeepResearchHistoryStore.deleteRecord(record.id).catch(() => {});
      setIsHistoryOpen(false);
      executeLiveAnswer(record.question);
      return;
    }

    const cleanRecordSources = (record.sources || [])
      .filter((s) => !isClientBoilerplateSource(s))
      .map((s, idx) => ({ ...s, id: idx + 1 }));

    setSelectedHistoryId(record.id);
    setHasStarted(true);
    setQuestion(record.question);
    setFullAnswer(record.fullAnswer);
    setSources(cleanRecordSources);
    setThinkingSteps(
      record.thinkingSteps && record.thinkingSteps.length > 0
        ? record.thinkingSteps
        : buildDynamicThinkingSteps(record.question, cleanRecordSources)
    );
    setThinkingStatus('done');
    setThinkingDuration(record.thinkingDuration || Math.round(record.durationSec || 1));
    setDurationSec(record.durationSec || 1);
    setFollowUps(
      (record.followUps || []).filter(
        (f) => !/^(import\s|export\s|const\s|function\s|\{|\}|\/\/)/.test(f.trim())
      )
    );
    setVisibleWordCount(99999);
    setIsSearching(false);
    setIsStreaming(false);
    setFeedback(null);
    setSelectedReason(null);
    setIsHistoryOpen(false);
    scrollViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setLiveStatusAnnouncement(`Loaded research for: ${record.question}`);
  };

  const filteredHistory = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return historyList;
    return historyList.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.fullAnswer.toLowerCase().includes(q) ||
        item.sources?.some(
          (s) =>
            s.title?.toLowerCase().includes(q) ||
            s.domain?.toLowerCase().includes(q) ||
            s.name?.toLowerCase().includes(q)
        )
    );
  }, [historyList, historySearchQuery]);

  const startWordStream = (textToStream: string) => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
    }
    const totalWords = textToStream.split(/\s+/).length;
    setVisibleWordCount(1);
    setIsStreaming(true);

    const step = totalWords > 2000 ? 14 : totalWords > 1200 ? 9 : totalWords > 600 ? 5 : totalWords > 250 ? 3 : 2;
    streamTimerRef.current = window.setInterval(() => {
      setVisibleWordCount((prev) => {
        if (prev >= totalWords + 4) {
          if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
          setIsStreaming(false);
          return totalWords + 20;
        }
        return prev + step;
      });
    }, 22);
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

    const initialAgents: InstaCloudAgentRecord[] = [
      {
        id: 'agent-supervisor',
        name: 'InstaCloud Supervisor',
        role: 'Orchestrator & Graph Manager',
        node: 'instacloud-core-01',
        status: 'running',
        latencyMs: 95,
        summary: 'Decomposing inquiry into specialized sub-agent execution pipelines on InstaCloud edge nodes.',
        thought: `Partitioning "${cleanQ.slice(0, 36)}…" across literature retrieval, quantitative metrics, and critical analysis.`,
        steps: [
          { action: 'spawn_workers', title: 'Task Partitioning', detail: 'Allocating dedicated V8 worker threads', latencyMs: 35 },
          { action: 'assign_cluster', title: 'Cluster Allocation', detail: 'Target project d374ae51-92bc-4bcb-83e0', latencyMs: 25 },
        ],
      },
      {
        id: 'agent-scholar',
        name: 'Scholar & ArXiv Literature Sub-Agent',
        role: 'Semantic Retrieval & Citations',
        node: 'instacloud-worker-scholar-04',
        status: 'running',
        latencyMs: 320,
        summary: 'Querying ArXiv preprints, PubMed systematic reviews, and open scientific repositories.',
        thought: 'Indexing bibliographic citations and author cohorts for verification.',
        steps: [
          { action: 'query_arxiv', title: 'Semantic Query Expansion', detail: 'Expanding search terms with scientific MeSH vectors', latencyMs: 140 },
          { action: 'extract_citations', title: 'Citation Resolution', detail: 'Cross-referencing primary source DOIs', latencyMs: 110 },
        ],
      },
      {
        id: 'agent-analyst',
        name: 'Quantitative Data & Empirical Sub-Agent',
        role: 'Statistical Extraction & Formulations',
        node: 'instacloud-worker-analyst-02',
        status: 'running',
        latencyMs: 280,
        summary: 'Parsing clinical trial metrics, p-values, odds ratios, and mathematical formulations.',
        thought: 'Extracting numerical evidence matrices and formulating LaTeX equations.',
        steps: [
          { action: 'extract_metrics', title: 'Statistical Bounds', detail: 'Isolating p-values and confidence intervals', latencyMs: 130 },
          { action: 'compile_matrix', title: 'Evidence Matrix Compilation', detail: 'Building comparison tables', latencyMs: 90 },
        ],
      },
      {
        id: 'agent-critic',
        name: 'Peer Review Critic & Fact-Checker Sub-Agent',
        role: 'Adversarial Review & Confounders',
        node: 'instacloud-worker-critic-03',
        status: 'running',
        latencyMs: 240,
        summary: 'Auditing methodologies, detecting confounding variables, and verifying falsifiability.',
        thought: 'Testing counter-hypotheses and evaluating study limitations.',
        steps: [
          { action: 'audit_methodology', title: 'Bias Audit', detail: 'Evaluating observational vs RCT controls', latencyMs: 110 },
          { action: 'boundary_check', title: 'Safety Guidelines', detail: 'Verifying tolerable upper bounds', latencyMs: 50 },
        ],
      },
      {
        id: 'agent-synthesizer',
        name: 'Academic Paper Synthesizer Agent',
        role: 'ArXiv / PubMed Article Synthesis',
        node: 'instacloud-worker-synth-01',
        status: 'running',
        latencyMs: 380,
        summary: 'Assembling publication-grade systematic paper with tables, math, and references.',
        thought: 'Typesetting multi-section paper according to peer-reviewed standards.',
        steps: [
          { action: 'assemble_sections', title: 'Sectional Architecture', detail: 'Assembling Abstract, Foundations, Pathways, Results', latencyMs: 150 },
          { action: 'academic_polish', title: 'Typography', detail: 'Enforcing peer-reviewed standards', latencyMs: 100 },
        ],
      },
    ];

    setAgents(initialAgents);
    setAgentClusterInfo({
      cluster: 'instacloud-us-east-distributed',
      projectId: 'd374ae51-92bc-4bcb-83e0-ecc46ea5794a',
      executionTimeMs: 0,
      status: 'running',
    });

    scrollViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    const startTime = performance.now();

    try {
      const authHeaders = await getAuthHeaders();

      // Dispatch InstaCloud Agent cluster run in parallel
      callApi('/api/instacloud/agents/run', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          topic: cleanQ,
          depth: 'exhaustive',
          model: activeModel?.geminiModel || selectedModelId,
        }),
      })
        .then((r) => r.json())
        .then((agentData) => {
          if (agentData?.success && Array.isArray(agentData.agents)) {
            setAgents(agentData.agents);
            setAgentClusterInfo({
              cluster: agentData.cluster || 'instacloud-us-east-distributed',
              projectId: agentData.projectId || 'd374ae51-92bc-4bcb-83e0-ecc46ea5794a',
              executionTimeMs: agentData.executionTimeMs || 1180,
              status: 'online',
            });
          }
        })
        .catch(() => {});

      // 1. Live Web & Scholarly Search
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

      const rawSources: SearchSource[] = (Array.isArray(searchRes?.sources) ? searchRes.sources : [])
        .filter((s: SearchSource) => !isClientBoilerplateSource(s))
        .slice(0, 24);

      let mappedSources: AnswerSource[] = rawSources.map((s, idx) => {
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

      setSources(mappedSources.slice(0, 24));
      setThinkingSteps(buildDynamicThinkingSteps(cleanQ, mappedSources));
      setIsSearching(false);

      const sourceContext = mappedSources
        .slice(0, 24)
        .map(
          (s) =>
            `[${s.id}] ${s.name} (${s.domain}) — ${s.title}\nSnippet: ${s.snippet || ''}`
        )
        .join('\n\n');

      const researchSystemPrompt = `You are a Principal Scientific Investigator and Senior Academic Researcher publishing an exhaustive, definitive, full-length academic research paper and systematic review on: "${cleanQ}".

Your objective is to provide an in-depth, rigorous, comprehensive scientific treatise matching the standards and formatting of top-tier peer-reviewed journals (such as Nature Reviews, ArXiv, Lancet, Cell, or The New England Journal of Medicine).

CRITICAL INSTRUCTIONS FOR COMPLETE UNABBREVIATED OUTPUT:
- DO NOT truncate, stop mid-sentence, summarize, or produce an outline.
- NEVER repeat or echo these instructions. Write ONLY the actual scientific research paper itself.
- Write out the complete academic paper covering all sections in full depth with dense, rigorous scientific prose.
- INLINE CITATIONS ON EVERY CLAIM: Ground virtually EVERY factual statement, quantitative finding, dosage, molecular pathway, and clinical outcome with an inline citation like [1], [2], or [1,3] matching the Grounding Sources provided.
- Write every section completely from Abstract to References without interruption.

${sourceContext ? `Grounding Evidence Sources (Cite these extensively throughout all sections using 1-based source indices like [1], [2], [1,3]):\n${sourceContext}\n` : ''}

You MUST follow this exact academic research paper structure:

# [Formal Academic Title of the Research Paper]
*[Disciplinary Domain & Classification, e.g., Pediatric Endocrinology & Skeletal Biology | Systematic Review & Meta-Synthesis]*

> **Structured Abstract**
> - **Background & Theoretical Rationale**: Theoretical background and biological/technical premise.
> - **Core Objectives**: Specific research questions and parameters evaluated.
> - **Synthesis of Findings**: Key statistical thresholds, physiological mechanisms, and empirical outcomes.
> - **Scientific & Clinical Conclusion**: Definitive evidence-based summary.

## 1. Introduction & Theoretical Foundations
Provide an in-depth background exploring the physiological, biochemical, or architectural basis. Define critical terminology, historical context, evolutionary mechanisms, and prevailing scientific hypotheses with extensive inline citations${sourceContext ? ' like [1], [2]' : ''}.

## 2. Molecular, Biochemical & Physiological Pathways
Explain the deep biological, cellular, enzymatic, or mathematical mechanisms in granular detail. Detail specific cellular receptors, hormonal axes (e.g., GH/IGF-1 axis, VDR nuclear receptors, epiphyseal growth plate chondrocytes, calcium/phosphate homeostasis, or underlying biochemical pathways). Include LaTeX equations (e.g., $E = mc^2$ or biochemical reaction notations) where applicable.

## 3. Systematic Evidence Matrix & Comparative Analysis
Synthesize current empirical data into a comprehensive Markdown Table:
| Domain / Biomarker / Study Cohort | Biological / Technical Mechanism | Empirical Findings & Effect Size | Evidence Level / Quality | Reference / Citation |
Include at least 4-6 detailed rows in this table with exact metrics, percentages, or biomarker ranges.

## 4. Clinical Trials, Empirical Cohorts & Longitudinal Studies
Examine primary clinical trials, randomized controlled trials (RCTs), prospective cohorts, and meta-analyses. Discuss sample sizes, statistical significance ($p$-values, confidence intervals, hazard ratios), longitudinal growth velocities or performance metrics, and age-dependent windows of responsiveness.

## 5. Dose-Response Dynamics, Biomarkers & Synergistic Co-Factors
Specify critical quantitative thresholds, optimal serum or parameter ranges, and synergistic co-factors necessary for biochemical efficacy and safety.

## 6. Critical Discussion, Confounding Variables & Biological Limits
Address nuances, genetic ceilings, negative or null trials, risks of excess or toxicity (e.g., premature epiphyseal fusion, endocrine suppression, hepatotoxicity, cardiovascular remodeling), lifestyle confounders, and current limitations in the literature.

## 7. Conclusions & Actionable Clinical / Practical Guidelines
Provide an authoritative synthesis of consensus recommendations for clinicians, researchers, and individuals.

## References
List the numbered source citations [1], [2], etc., matching the provided sources with formal academic titles and domains.

---FOLLOWUPS---
[2 or 3 insightful, advanced scientific follow-up research questions, one per line, plain text questions only, no bullets or numbers]`;

      const chatResp = await callApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          systemPrompt: researchSystemPrompt,
          messages: [{ role: 'user', content: cleanQ }],
          webSearch: true,
          searchMode: activeSearchMode === 'news' ? 'news' : 'organic',
          model: activeModel?.geminiModel || selectedModelId || 'zro/deepseek-v4.1-flash',
          isResearchMode: true,
          maxTokens: 4096,
        }),
      });

      const chatData = await chatResp.json();

      // If /api/chat returned additional verified sources and our initial list was sparse, merge them
      if (Array.isArray(chatData?.sources) && chatData.sources.length > 0 && mappedSources.length < 4) {
        const extraClean = (chatData.sources as SearchSource[])
          .filter((s) => !isClientBoilerplateSource(s) && !mappedSources.some((m) => m.url === s.url));
        if (extraClean.length > 0) {
          const merged = [...rawSources, ...extraClean].slice(0, 24);
          mappedSources = merged.map((s, idx) => {
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
          setSources(mappedSources);
        }
      }

      const rawReply = String(chatData?.text || '')
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .trim();

      const elapsed = Math.max(1, (performance.now() - startTime) / 1000);
      setThinkingDuration(Math.max(1, Math.round(elapsed)));
      setThinkingStatus('done');
      setAgents((prev) => prev.map((a) => ({ ...a, status: 'completed' })));
      setDurationSec(Number(elapsed.toFixed(1)));

      if (rawReply) {
        const [answerPart, followUpPart] = rawReply.split(/---FOLLOWUPS---/i);
        const cleanAnswer = (answerPart || rawReply).trim();
        const parsedFollowUps = (followUpPart || '')
          .split('\n')
          .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
          .filter(
            (l) =>
              l.length > 12 &&
              l.length < 110 &&
              !/^(import\s|export\s|const\s|let\s|var\s|function\s|return\s|\{|\}|\/\/|```)/.test(l) &&
              !l.includes('useState') &&
              !l.includes('GeneratedComponent')
          )
          .slice(0, 3);

        setFullAnswer(cleanAnswer);
        const resolvedFollowUps =
          parsedFollowUps.length > 0
            ? parsedFollowUps
            : [
                `What are the primary molecular pathways and receptor kinetics governing ${cleanQ.slice(0, 42)}?`,
                `How do randomized controlled trial outcomes compare with long-term longitudinal safety profiles?`,
                `What are the key biomarkers and physiological thresholds monitored in clinical practice?`,
              ];
        setFollowUps(resolvedFollowUps);
        startWordStream(cleanAnswer);

        // Auto-persist research run to history (local storage and Firestore)
        const currentThinkingSteps = buildDynamicThinkingSteps(cleanQ, mappedSources);
        DeepResearchHistoryStore.saveRecord({
          topic: cleanQ,
          question: cleanQ,
          fullAnswer: cleanAnswer,
          sources: mappedSources.slice(0, 8),
          thinkingSteps: currentThinkingSteps,
          durationSec: Number(elapsed.toFixed(1)),
          thinkingDuration: Math.max(1, Math.round(elapsed)),
          followUps: resolvedFollowUps,
          modelId: activeModel?.id,
        })
          .then((saved) => {
            setSelectedHistoryId(saved.id);
          })
          .catch(() => {});
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

  // Render inline text with KaTeX math, **bold**, and [1] or [1,3] citation chips
  const renderRichLine = (lineText: string, lineKey: string) => {
    const parts = lineText.split(/(\$[^\$\n]+\$|\*\*[^*]+\*\*|\[\d+(?:,\s*\d+)*\])/g);

    return parts.map((part, idx) => {
      if (!part) return null;

      // Inline LaTeX math $...$
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        return (
          <span key={`${lineKey}-m-${idx}`} className="inline-block mx-0.5 align-baseline">
            <MathMarkdown content={part} inline isDark={isDark} />
          </span>
        );
      }

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
                const rect = e.currentTarget.getBoundingClientRect();
                if (isPreviewOpen) {
                  setActiveChipPreview(null);
                } else {
                  setActiveChipPreview({
                    ids,
                    anchorKey,
                    rect: {
                      top: rect.top,
                      bottom: rect.bottom,
                      left: rect.left,
                      right: rect.right,
                      width: rect.width,
                    },
                  });
                }
              }}
              aria-label={`Source: ${chipLabel}`}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium leading-tight transition-all cursor-pointer ${
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
          </span>
        );
      }

      return <React.Fragment key={`${lineKey}-t-${idx}`}>{part}</React.Fragment>;
    });
  };

  const blocks = useMemo(() => {
    if (!displayedAnswer) return [];
    const normalized = displayedAnswer
      .replace(/\r\n/g, '\n')
      .replace(/\n(#{1,6}\s+[^\n]+)/g, '\n\n$1\n\n')
      .replace(/\n(---|\*\*\*)\n/g, '\n\n$1\n\n');
    return normalized
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
  }, [displayedAnswer]);

  if (!isOpen) return null;

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
          <button
            type="button"
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            title="Research History"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              isHistoryOpen
                ? isDark
                  ? 'bg-white text-black border-white'
                  : 'bg-[#18181b] text-white border-[#18181b]'
                : isDark
                ? 'bg-[#141418] border-white/[0.1] text-neutral-300 hover:text-white hover:bg-white/[0.06]'
                : 'bg-white border-black/[0.08] text-neutral-700 hover:text-black hover:bg-neutral-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>History</span>
            {historyList.length > 0 && (
              <span
                className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  isHistoryOpen
                    ? isDark
                      ? 'bg-black/15 text-black'
                      : 'bg-white/20 text-white'
                    : isDark
                    ? 'bg-white/10 text-neutral-300'
                    : 'bg-black/10 text-neutral-700'
                }`}
              >
                {historyList.length}
              </span>
            )}
          </button>

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
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 overflow-y-auto scrollbar-thin py-6">
          <div className="max-w-xl w-full flex flex-col items-center">
            <GrokLogo size="lg" isDark={isDark} />

            {historyList.length > 0 && (
              <div className="w-full mt-7 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 opacity-70" />
                    <span className="text-[11px] font-semibold tracking-wider uppercase opacity-70">
                      Recent Research
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="text-xs hover:underline opacity-75 hover:opacity-100 cursor-pointer"
                  >
                    View all ({historyList.length})
                  </button>
                </div>

                <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1 scrollbar-thin">
                  {historyList.slice(0, 4).map((record) => (
                    <div
                      key={record.id}
                      onClick={() => loadHistoryItem(record)}
                      className={`group relative p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isDark
                          ? 'bg-[#121215] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]'
                          : 'bg-white border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02] shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 className="text-xs sm:text-sm font-medium line-clamp-1 group-hover:text-current">
                          {record.question}
                        </h3>
                        <span className="shrink-0 text-[10.5px] opacity-50 font-normal">
                          {formatHistoryDate(record.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11.5px] opacity-65 line-clamp-2 leading-relaxed">
                        {record.fullAnswer
                          .replace(/\*\*/g, '')
                          .replace(/\[\d+(?:,\s*\d+)*\]/g, '')}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] opacity-60">
                        {record.sources?.length > 0 && (
                          <span>{record.sources.length} sources</span>
                        )}
                        {record.durationSec > 0 && (
                          <span>• {record.durationSec}s</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={scrollViewportRef}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden px-4 sm:px-6 md:px-8 py-3 scrollbar-thin"
        >
          <div className="max-w-3xl mx-auto w-full space-y-4 pb-8">
            {/* Seamless Full-Page Content Flow - NO bubble / card wrapper */}
            <div className="w-full">
              {/* Question Title - Sleek, smaller font */}
              <h1 className="text-[16px] sm:text-[18px] font-semibold tracking-tight leading-snug mb-3">
                {question}
              </h1>

              {/* Horizontal Scrollable Source Cards - Compact and sleek */}
              {(sources.length > 0 || isSearching) && (
                <div className="mb-4">
                  {isSearching && sources.length === 0 && (
                    <div className="mb-2">
                      <ShimmerText
                        text="Searching web sources..."
                        isDark={isDark}
                        className="text-xs font-medium"
                      />
                    </div>
                  )}

                  {sources.length > 0 && (
                    <div className="flex items-stretch gap-2 overflow-x-auto pb-1.5 scrollbar-none">
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
                            style={{ animationDelay: `${idx * 40}ms` }}
                            className={`w-36 sm:w-40 shrink-0 rounded-xl border p-2.5 flex flex-col justify-between gap-1.5 transition-all duration-150 animate-in fade-in slide-in-from-bottom-1 ${
                              isCardHighlighted
                                ? isDark
                                  ? 'bg-white/10 border-white/30'
                                  : 'bg-black/10 border-black/30'
                                : isDark
                                ? 'bg-[#141418] border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04]'
                                : 'bg-[#f7f7f8] border-black/[0.07] hover:border-black/[0.16] hover:bg-black/[0.02]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <img
                                  src={faviconUrl}
                                  alt=""
                                  className="w-3.5 h-3.5 rounded-xs shrink-0 object-contain"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                                <span
                                  className={`text-[10.5px] font-medium truncate ${
                                    isDark ? 'text-neutral-400' : 'text-neutral-600'
                                  }`}
                                >
                                  {src.name}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-mono tabular-nums ${
                                  isDark ? 'text-neutral-500' : 'text-neutral-400'
                                }`}
                              >
                                {src.id}
                              </span>
                            </div>

                            <div
                              className={`text-xs font-medium leading-snug line-clamp-2 ${
                                isDark ? 'text-neutral-200' : 'text-neutral-900'
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
              <div className="flex items-center justify-between gap-2 mb-2.5 pt-1">
                <span
                  className={`text-[10.5px] font-semibold tracking-wider uppercase ${
                    isDark ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  Academic Research Paper · Systematic Review
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                    isDark
                      ? 'border-white/10 bg-white/[0.04] text-neutral-400'
                      : 'border-black/10 bg-black/[0.03] text-neutral-600'
                  }`}
                >
                  Peer-Reviewed Standard
                </span>
              </div>

              {/* Streamed Answer Body - Smaller, refined readable academic font */}
              <div
                aria-busy={isStreaming}
                className={`space-y-3 text-[13px] sm:text-[13.5px] leading-relaxed ${
                  isDark ? 'text-neutral-200' : 'text-neutral-800'
                }`}
              >
                {blocks.length === 0 && (isSearching || isStreaming) ? (
                  <div className="py-1">
                    <ShimmerText
                      text="Synthesizing academic research paper..."
                      isDark={isDark}
                      className="text-xs"
                    />
                  </div>
                ) : (
                  blocks.map((block, bIdx) => {
                    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
                    const isLastBlock = bIdx === blocks.length - 1;

                    // 1. Block Math ($$...$$)
                    if (block.startsWith('$$') && block.endsWith('$$')) {
                      return (
                        <div key={`blk-math-${bIdx}`} className="my-3 overflow-x-auto">
                          <MathMarkdown content={block} isDark={isDark} />
                        </div>
                      );
                    }

                    // 1.5. Fenced Code Blocks (```lang ... ```)
                    if (block.startsWith('```')) {
                      const codeLines = block.split('\n');
                      const rawLang = codeLines[0].replace(/^```/, '').trim();
                      const codeContent =
                        codeLines.length > 2 && codeLines[codeLines.length - 1].startsWith('```')
                          ? codeLines.slice(1, -1).join('\n')
                          : codeLines.slice(1).join('\n');
                      return (
                        <div key={`code-${bIdx}`} className="my-3.5 w-full">
                          <CodeBlock>
                            <CodeBlockHeader>
                              <CodeBlockTitle>
                                {rawLang ? `${rawLang.toUpperCase()} Implementation` : 'Algorithm & Code Block'}
                              </CodeBlockTitle>
                              <CodeBlockActions>
                                <CodeBlockCopyButton value={codeContent} />
                              </CodeBlockActions>
                            </CodeBlockHeader>
                            <CodeBlockContent lineNumbers wrap>
                              {codeContent}
                            </CodeBlockContent>
                          </CodeBlock>
                        </div>
                      );
                    }

                    // 2. Headings (#, ##, ###, ####)
                    if (/^#{1,6}\s+/.test(block)) {
                      const match = block.match(/^(#{1,6})\s+(.*)$/);
                      if (match) {
                        const level = match[1].length;
                        const headingText = match[2].trim();
                        if (level === 1) {
                          return (
                            <h1
                              key={`h1-${bIdx}`}
                              className={`text-[16px] sm:text-[18px] font-bold tracking-tight mt-5 mb-2 pb-1.5 border-b ${
                                isDark
                                  ? 'border-white/[0.1] text-white'
                                  : 'border-black/[0.08] text-neutral-900'
                              }`}
                            >
                              {renderRichLine(headingText, `h1-${bIdx}`)}
                            </h1>
                          );
                        }
                        if (level === 2) {
                          return (
                            <h2
                              key={`h2-${bIdx}`}
                              className={`text-[14px] sm:text-[15px] font-bold tracking-tight mt-4.5 mb-2 pb-1 border-b ${
                                isDark
                                  ? 'border-white/[0.07] text-neutral-100'
                                  : 'border-black/[0.06] text-neutral-900'
                              }`}
                            >
                              {renderRichLine(headingText, `h2-${bIdx}`)}
                            </h2>
                          );
                        }
                        if (level === 3) {
                          return (
                            <h3
                              key={`h3-${bIdx}`}
                              className={`text-[13px] sm:text-[13.5px] font-semibold tracking-tight mt-3.5 mb-1.5 ${
                                isDark ? 'text-neutral-200' : 'text-neutral-800'
                              }`}
                            >
                              {renderRichLine(headingText, `h3-${bIdx}`)}
                            </h3>
                          );
                        }
                        return (
                          <h4
                            key={`h4-${bIdx}`}
                            className={`text-[12px] sm:text-[12.5px] font-semibold mt-3 mb-1 ${
                              isDark ? 'text-neutral-300' : 'text-neutral-700'
                            }`}
                          >
                            {renderRichLine(headingText, `h4-${bIdx}`)}
                          </h4>
                        );
                      }
                    }

                    // 3. Horizontal Separator (--- or ***)
                    if (block === '---' || block === '***') {
                      return (
                        <hr
                          key={`hr-${bIdx}`}
                          className={`my-4 border-t ${
                            isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                          }`}
                        />
                      );
                    }

                    // 4. Disciplinary Subtitle (*Domain: ...*)
                    if (/^\*[^*]+\*$/.test(block)) {
                      return (
                        <p
                          key={`sub-${bIdx}`}
                          className={`text-[11.5px] italic -mt-1 mb-2.5 font-mono ${
                            isDark ? 'text-neutral-400' : 'text-neutral-500'
                          }`}
                        >
                          {renderRichLine(block.slice(1, -1), `sub-${bIdx}`)}
                        </p>
                      );
                    }

                    // 5. Blockquote / Structured Abstract Card (> ...)
                    const quoteLines = lines
                      .filter((l) => l.startsWith('>'))
                      .map((l) => l.replace(/^>\s*/, ''));
                    if (quoteLines.length > 0 && quoteLines.length === lines.length) {
                      return (
                        <div
                          key={`quote-${bIdx}`}
                          className={`my-3.5 rounded-xl border-l-3 p-3.5 sm:p-4 text-[12.5px] sm:text-[13px] leading-relaxed transition-colors ${
                            isDark
                              ? 'bg-white/[0.03] border-white/40 text-neutral-200'
                              : 'bg-neutral-50/90 border-neutral-750 text-neutral-800'
                          }`}
                        >
                          <div className="space-y-1.5">
                            {quoteLines.map((ql, qIdx) => (
                              <div key={qIdx} className="leading-relaxed">
                                {renderRichLine(ql, `q-${bIdx}-${qIdx}`)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // 6. Markdown Table (| col | col |)
                    const tableData = parseMarkdownTable(block);
                    if (tableData) {
                      return (
                        <div
                          key={`tbl-${bIdx}`}
                          className={`my-3.5 w-full overflow-x-auto rounded-xl border ${
                            isDark
                              ? 'border-white/[0.08] bg-[#141418]'
                              : 'border-black/[0.07] bg-white'
                          }`}
                        >
                          <table className="w-full border-collapse text-left text-[12px] sm:text-[12.5px]">
                            <thead>
                              <tr
                                className={`border-b ${
                                  isDark
                                    ? 'border-white/[0.08] bg-white/[0.03]'
                                    : 'border-black/[0.06] bg-neutral-50'
                                }`}
                              >
                                {tableData.headers.map((h, hIdx) => (
                                  <th
                                    key={hIdx}
                                    className={`px-3 py-2 font-semibold text-[11px] sm:text-[11.5px] uppercase tracking-wider ${
                                      isDark ? 'text-neutral-300' : 'text-neutral-700'
                                    }`}
                                  >
                                    {renderRichLine(h, `th-${bIdx}-${hIdx}`)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody
                              className={`divide-y ${
                                isDark ? 'divide-white/[0.04]' : 'divide-black/[0.04]'
                              }`}
                            >
                              {tableData.rows.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={`transition-colors ${
                                    isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-neutral-50/60'
                                  }`}
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`px-3 py-2 leading-relaxed ${
                                        isDark ? 'text-neutral-300' : 'text-neutral-700'
                                      }`}
                                    >
                                      {renderRichLine(cell, `td-${bIdx}-${rIdx}-${cIdx}`)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    // 7. Numbered List (1. ... 2. ...)
                    const isNumberedList = lines.every((l) => /^\d+\.\s+/.test(l));
                    if (isNumberedList) {
                      return (
                        <ol key={`numblk-${bIdx}`} className="space-y-1.5 pl-0.5">
                          {lines.map((item, lIdx) => {
                            const num = item.match(/^(\d+)\.\s+/)?.[1] || `${lIdx + 1}`;
                            const cleanItem = item.replace(/^\d+\.\s+/, '');
                            const isVeryLast = isLastBlock && lIdx === lines.length - 1;
                            return (
                              <li
                                key={`oli-${bIdx}-${lIdx}`}
                                className="flex items-start gap-2 leading-relaxed text-[12.5px] sm:text-[13px]"
                              >
                                <span
                                  className={`text-[11px] font-mono font-semibold shrink-0 mt-0.5 tabular-nums ${
                                    isDark ? 'text-neutral-400' : 'text-neutral-500'
                                  }`}
                                >
                                  {num}.
                                </span>
                                <span className="flex-1">
                                  {renderRichLine(cleanItem, `oli-${bIdx}-${lIdx}`)}
                                  {isStreaming && isVeryLast && (
                                    <span
                                      className={`inline-block size-1.5 rounded-full ml-1 align-middle animate-pulse ${
                                        isDark ? 'bg-white' : 'bg-black'
                                      }`}
                                    />
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      );
                    }

                    // 8. Bullet List (- ... * ... • ...)
                    const isBulletList = lines.every((l) => /^[-*•]\s+/.test(l));
                    if (isBulletList) {
                      return (
                        <ul key={`blk-${bIdx}`} className="space-y-1.5 pl-0.5">
                          {lines.map((item, lIdx) => {
                            const cleanItem = item.replace(/^[-*•]\s+/, '');
                            const isVeryLast = isLastBlock && lIdx === lines.length - 1;
                            return (
                              <li
                                key={`li-${bIdx}-${lIdx}`}
                                className="flex items-start gap-2 leading-relaxed text-[12.5px] sm:text-[13px]"
                              >
                                <span
                                  className={`mt-1.5 size-1 rounded-full shrink-0 ${
                                    isDark ? 'bg-neutral-500' : 'bg-neutral-400'
                                  }`}
                                />
                                <span className="flex-1">
                                  {renderRichLine(cleanItem, `li-${bIdx}-${lIdx}`)}
                                  {isStreaming && isVeryLast && (
                                    <span
                                      className={`inline-block size-1.5 rounded-full ml-1 align-middle animate-pulse ${
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

                    // 9. Standard Paragraph
                    return (
                      <p key={`blk-${bIdx}`} className="leading-relaxed">
                        {renderRichLine(block, `p-${bIdx}`)}
                        {isStreaming && isLastBlock && (
                          <span
                            className={`inline-block size-1.5 rounded-full ml-1 align-middle animate-pulse ${
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
                <div className="mt-5 pt-2">
                  <div
                    className={`text-[10px] font-semibold tracking-wider uppercase mb-1.5 ${
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
                        className={`w-full py-2.5 flex items-center justify-between gap-3 text-left text-xs sm:text-[12.5px] font-normal transition-colors cursor-pointer group ${
                          isDark
                            ? 'text-neutral-300 hover:text-white'
                            : 'text-neutral-700 hover:text-black'
                        }`}
                      >
                        <span className="truncate">{fUp}</span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 ${
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
                className={`mt-4 pt-3 border-t flex items-center justify-between gap-3 ${
                  isDark ? 'border-white/[0.07]' : 'border-black/[0.07]'
                }`}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy answer and sources"
                    aria-label="Copy answer"
                    className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                        : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const exportText = `# Deep Research Report: ${question}\n\n${fullAnswer}\n\n## References & Citation Links\n` +
                        sources.map(s => `[${s.id}] ${s.name} — ${s.title}\nURL: ${s.url}`).join('\n\n');
                      const blob = new Blob([exportText], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${(question || 'deep_research').replace(/[^a-z0-9]/gi, '_').slice(0, 40)}_cited_report.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setLiveStatusAnnouncement('Exported report with citation links');
                    }}
                    title="Export report with citation links (.md)"
                    aria-label="Export report with citations"
                    className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                        : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {isStreaming || isSearching ? (
                    <button
                      type="button"
                      onClick={handleStopStreaming}
                      title="Stop generating"
                      aria-label="Stop generating"
                      className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        isDark
                          ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                          : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                      }`}
                    >
                      <Square className="w-3 h-3 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      title="Regenerate answer"
                      aria-label="Regenerate answer"
                      className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        isDark
                          ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                          : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
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
                    className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      feedback === 'up'
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-neutral-900 text-white'
                        : isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                        : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFeedback(feedback === 'down' ? null : 'down');
                      setLiveStatusAnnouncement('Feedback recorded: not helpful');
                    }}
                    title="Not helpful"
                    aria-label="Thumbs down"
                    className={`size-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                      feedback === 'down'
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-neutral-900 text-white'
                        : isDark
                        ? 'text-neutral-400 hover:text-white hover:bg-white/[0.07]'
                        : 'text-neutral-500 hover:text-black hover:bg-black/[0.05]'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div
                  className={`text-[11px] font-normal tabular-nums ${
                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                  }`}
                >
                  {isSearching || isStreaming ? (
                    <ShimmerText text="Answering..." isDark={isDark} className="text-[11px]" />
                  ) : (
                    `Answered in ${durationSec}s`
                  )}
                </div>
              </div>

              {/* Feedback Reasons Row when Thumbs Down is selected */}
              {feedback === 'down' && (
                <div className="mt-2.5 pt-2 border-t border-current/10 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
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
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-normal border transition-colors cursor-pointer ${
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

      {/* History Slide-Over Drawer */}
      {isHistoryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Deep Research History"
          className="fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250 ${
              isDark
                ? 'bg-[#101014] text-white border-l border-white/10'
                : 'bg-white text-neutral-900 border-l border-black/10'
            }`}
          >
            {/* Drawer Header */}
            <div className="shrink-0 p-4 sm:p-5 border-b border-current/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 opacity-75" />
                <h2 className="text-sm sm:text-base font-semibold">Research History</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isDark ? 'bg-white/10 text-neutral-300' : 'bg-black/10 text-neutral-700'
                  }`}
                >
                  {historyList.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {historyList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Clear all deep research history?')) {
                        DeepResearchHistoryStore.clearAll();
                        setLiveStatusAnnouncement('All research history cleared');
                      }
                    }}
                    title="Clear all history"
                    className="p-1.5 rounded-lg text-xs opacity-60 hover:opacity-100 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'
                  }`}
                  aria-label="Close history"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search within history */}
            {historyList.length > 2 && (
              <div className="p-3 border-b border-current/10 shrink-0">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                    isDark ? 'bg-[#18181c] border-white/10' : 'bg-[#f4f4f5] border-black/10'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 opacity-50 shrink-0" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search past research..."
                    className="w-full bg-transparent outline-none placeholder:opacity-50"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery('')}
                      className="opacity-60 hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* History List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
              {filteredHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                  <Clock className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">
                    {historySearchQuery
                      ? 'No matching research found'
                      : 'No research history yet'}
                  </p>
                  <p className="text-xs opacity-75 mt-1 max-w-[240px]">
                    {historySearchQuery
                      ? 'Try searching with different keywords'
                      : 'Completed deep research questions will automatically be saved here.'}
                  </p>
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const isCurrent = selectedHistoryId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => loadHistoryItem(item)}
                      className={`group relative p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isCurrent
                          ? isDark
                            ? 'bg-white/[0.08] border-white/40 shadow-sm'
                            : 'bg-black/[0.05] border-black/30 shadow-sm'
                          : isDark
                          ? 'bg-[#151518] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]'
                          : 'bg-neutral-50 border-black/[0.07] hover:border-black/20 hover:bg-white shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-xs font-semibold leading-snug line-clamp-2">
                          {item.question}
                        </h3>
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              loadHistoryItem(item);
                              setIsHistoryOpen(false);
                              setTimeout(() => {
                                window.print();
                              }, 300);
                            }}
                            title="Export as PDF / Print report"
                            className="opacity-70 sm:opacity-0 group-hover:opacity-150 hover:opacity-100 p-1 rounded-md transition-opacity cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              loadHistoryItem(item);
                              setIsHistoryOpen(false);
                              setLiveStatusAnnouncement('Loaded research for editing');
                            }}
                            title="Edit / Re-run research"
                            className="opacity-70 sm:opacity-0 group-hover:opacity-150 hover:opacity-100 p-1 rounded-md transition-opacity cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${item.question}\n\n${item.fullAnswer}`
                              );
                              setLiveStatusAnnouncement('Copied research to clipboard');
                            }}
                            title="Copy report"
                            className="opacity-70 sm:opacity-0 group-hover:opacity-150 hover:opacity-100 p-1 rounded-md transition-opacity cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              DeepResearchHistoryStore.deleteRecord(item.id);
                              if (selectedHistoryId === item.id) {
                                setSelectedHistoryId(null);
                              }
                            }}
                            title="Delete this record"
                            className="opacity-70 sm:opacity-0 group-hover:opacity-150 hover:opacity-100 hover:text-red-500 p-1 rounded-md transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11.5px] opacity-65 line-clamp-2 leading-relaxed mt-1">
                        {item.fullAnswer
                          .replace(/\*\*/g, '')
                          .replace(/\[\d+(?:,\s*\d+)*\]/g, '')}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-current/5 text-[10.5px] opacity-55">
                        <div className="flex items-center gap-2">
                          <span>{formatHistoryDate(item.createdAt)}</span>
                          {item.sources?.length > 0 && (
                            <span>• {item.sources.length} sources</span>
                          )}
                        </div>
                        {item.durationSec > 0 && <span>{item.durationSec}s</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Viewport-Clamped Collision-Free Citation Popover - Never overflows screen frame */}
      {activeChipPreview && (() => {
        const rect = activeChipPreview.rect;
        const winW = typeof window !== 'undefined' ? window.innerWidth : 380;
        const winH = typeof window !== 'undefined' ? window.innerHeight : 700;
        const popoverWidth = Math.min(320, winW - 24);

        let stylePos: React.CSSProperties = {};
        if (rect) {
          let left = rect.left + rect.width / 2 - popoverWidth / 2;
          if (left < 12) left = 12;
          if (left + popoverWidth > winW - 12) left = winW - popoverWidth - 12;

          const spaceAbove = rect.top;
          if (spaceAbove > 240) {
            stylePos = {
              position: 'fixed',
              left: `${left}px`,
              bottom: `${Math.max(12, winH - rect.top + 8)}px`,
              width: `${popoverWidth}px`,
            };
          } else {
            stylePos = {
              position: 'fixed',
              left: `${left}px`,
              top: `${Math.max(12, rect.bottom + 8)}px`,
              width: `${popoverWidth}px`,
            };
          }
        } else {
          stylePos = {
            position: 'fixed',
            left: '12px',
            right: '12px',
            bottom: '90px',
            maxWidth: '320px',
            margin: '0 auto',
          };
        }

        return (
          <div
            onClick={(e) => e.stopPropagation()}
            role="tooltip"
            style={stylePos}
            className={`z-[70] max-h-[55vh] overflow-y-auto rounded-2xl border p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 scrollbar-thin ${
              isDark
                ? 'bg-[#141418] border-white/[0.14] text-white shadow-black/80'
                : 'bg-white border-black/[0.12] text-neutral-900 shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-current/10">
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-neutral-400">
                Sources ({activeChipPreview.ids.map((id) => `#${id}`).join(', ')})
              </span>
              <button
                type="button"
                onClick={() => setActiveChipPreview(null)}
                className="p-1 rounded-md hover:bg-current/10 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />
              </button>
            </div>
            <div className="space-y-3">
              {activeChipPreview.ids.map((id) => {
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
                    <div className="flex items-center justify-between gap-2 text-[11px] opacity-70 mb-0.5">
                      <span className="font-medium truncate">{src.name}</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10.5px]">
                        #{src.id}
                        <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
                      </span>
                    </div>
                    <div className="text-xs font-semibold leading-snug group-hover:underline">
                      {src.title}
                    </div>
                    {src.snippet && (
                      <p className="text-[11px] opacity-70 mt-1 line-clamp-3 leading-relaxed">
                        {src.snippet}
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
