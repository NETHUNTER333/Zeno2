import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
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
} from 'lucide-react';
import { SearchSource, ArxivPaper, SearchMode, ChatAttachment } from '../types';
import { getAuthHeaders } from '../lib/firebase';
import { ShimmerText, ThinkingStep } from './ui/thinking-state';
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockContent,
} from './ui/code-block';
import { ChatInput } from './kobra/chat-input';
import { ModelOption, GROK_MODELS } from './GrokModelPicker';
import { GrokLogo } from './GrokLogo';
import {
  DeepResearchHistoryStore,
  DeepResearchRecord,
  DeepResearchTurn,
  AnswerSource,
} from '../lib/deepResearchHistoryStore';
import { MathMarkdown } from './MathMarkdown';

export { type AnswerSource };

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
    if (host.includes('wikipedia')) return 'Wikipedia';
    if (host.includes('scholar.google')) return 'Google Scholar';
    if (host.includes('github')) return 'GitHub';
    if (host.includes('reuters')) return 'Reuters';
    if (host.includes('bloomberg')) return 'Bloomberg';
    if (host.includes('techcrunch')) return 'TechCrunch';
    if (host.includes('theverge')) return 'The Verge';
    if (host.includes('nytimes')) return 'NYTimes';
    if (host.includes('reddit')) return 'Reddit';
    const base = host.split('.')[0] || '';
    if (base.length >= 2) {
      return base.charAt(0).toUpperCase() + base.slice(1);
    }
  } catch {}
  return (fallbackTitle || 'Source').split(/[\s–|-]+/)[0].slice(0, 14);
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

function buildDynamicThinkingSteps(query: string, answerSources: AnswerSource[]): ThinkingStep[] {
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
          ? `Analyzing ${searchSources.length} verified sources about ${shortTopic}`
          : `Searching verified scientific & live databases for ${shortTopic}`,
    },
    {
      type: 'thought',
      text: 'Cross-referencing evidence, comparative metrics, and mechanisms',
    },
    {
      type: 'thought',
      text: 'Synthesizing comprehensive deep research answer',
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

  // Multi-Turn Research Conversation State
  const [turns, setTurns] = useState<DeepResearchTurn[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Active streaming state
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const [streamingFullText, setStreamingFullText] = useState<string>('');
  const [visibleWordCount, setVisibleWordCount] = useState<number>(0);
  const [activeSources, setActiveSources] = useState<AnswerSource[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [activeDurationSec, setActiveDurationSec] = useState<number>(0);

  // Citation hover & popover
  const [hoveredSourceIds, setHoveredSourceIds] = useState<number[]>([]);
  const [activeChipPreview, setActiveChipPreview] = useState<{
    ids: number[];
    anchorKey: string;
    rect?: { top: number; bottom: number; left: number; right: number; width: number };
  } | null>(null);

  // Feedback & Copy state
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down' | null>>({});
  const [selectedReasonMap, setSelectedReasonMap] = useState<Record<string, string | null>>({});
  const [liveStatusAnnouncement, setLiveStatusAnnouncement] = useState<string>('');

  // History State
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<DeepResearchRecord[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  const abortRef = useRef<AbortController | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to history
  useEffect(() => {
    if (!isOpen) return;
    setHistoryList(DeepResearchHistoryStore.getHistory());
    const unsub = DeepResearchHistoryStore.subscribe(() => {
      setHistoryList(DeepResearchHistoryStore.getHistory());
    });
    DeepResearchHistoryStore.syncFromFirestore().then((res) => {
      if (res && res.length) setHistoryList(res);
    });
    return unsub;
  }, [isOpen]);

  // Handle escape key
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
    setTurns([]);
    setCurrentSessionId(null);
    setStreamingTurnId(null);
    setStreamingFullText('');
    setVisibleWordCount(0);
    setActiveSources([]);
    setThinkingSteps([]);
    setIsSearching(false);
    setIsStreaming(false);
    setActiveDurationSec(0);
    setActiveChipPreview(null);
    setFeedbackMap({});
    setSelectedReasonMap({});
  };

  const [researchElapsedSec, setResearchElapsedSec] = useState(0);

  useEffect(() => {
    if (!isSearching && !(isStreaming && !streamingFullText)) {
      return;
    }
    setResearchElapsedSec(0);
    const id = window.setInterval(() => {
      setResearchElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isSearching, isStreaming, streamingFullText]);

  const loadHistoryItem = (record: DeepResearchRecord) => {
    if (abortRef.current) abortRef.current.abort();
    if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);

    const cleanRecordSources = (record.sources || [])
      .filter((s) => !isClientBoilerplateSource(s))
      .map((s, idx) => ({ ...s, id: idx + 1 }));

    setCurrentSessionId(record.id);

    if (record.turns && record.turns.length > 0) {
      setTurns(record.turns);
    } else {
      setTurns([
        {
          id: `turn-1-${record.id}`,
          question: record.question,
          fullAnswer: record.fullAnswer,
          sources: cleanRecordSources,
          thinkingSteps: record.thinkingSteps,
          durationSec: record.durationSec,
          thinkingDuration: record.thinkingDuration,
          createdAt: record.createdAt,
        },
      ]);
    }

    setStreamingTurnId(null);
    setStreamingFullText('');
    setVisibleWordCount(99999);
    setIsSearching(false);
    setIsStreaming(false);
    setIsHistoryOpen(false);
    scrollViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setLiveStatusAnnouncement(`Loaded research for: ${record.question}`);
  };

  const startWordStream = (textToStream: string, turnId: string) => {
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
          // Mark streaming completed in turns array
          setTurns((prevTurns) =>
            prevTurns.map((t) =>
              t.id === turnId ? { ...t, fullAnswer: textToStream } : t
            )
          );
          return totalWords + 20;
        }
        return prev + step;
      });
    }, 22);
  };

  const executeResearchTurn = async (targetQuestion: string) => {
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

    const isFollowUp = turns.length > 0;
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTurn: DeepResearchTurn = {
      id: turnId,
      question: cleanQ,
      fullAnswer: '',
      sources: [],
      createdAt: Date.now(),
    };

    setTurns((prev) => [...prev, newTurn]);
    setStreamingTurnId(turnId);
    setStreamingFullText('');
    setVisibleWordCount(0);
    setIsSearching(true);
    setIsStreaming(true);
    setActiveSources([]);
    setThinkingSteps(buildDynamicThinkingSteps(cleanQ, []));

    // Scroll smoothly to bottom so new turn is visible
    setTimeout(() => {
      scrollViewportRef.current?.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);

    const startTime = performance.now();

    try {
      const authHeaders = await getAuthHeaders();

      // 1. Live Web & Scholarly Search specifically for this question
      const searchRes = await callApi('/api/search/live', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          query: cleanQ,
          searchMode: activeSearchMode === 'news' ? 'news' : 'organic',
          isResearchMode: true,
        }),
      }).then((r) => r.json());

      const rawSources: SearchSource[] = (Array.isArray(searchRes?.sources) ? searchRes.sources : [])
        .filter((s: SearchSource) => !isClientBoilerplateSource(s))
        .slice(0, 18);

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

      setActiveSources(mappedSources);
      setThinkingSteps(buildDynamicThinkingSteps(cleanQ, mappedSources));
      setIsSearching(false);

      // Update sources on the active turn
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, sources: mappedSources } : t))
      );

      const sourceContext = mappedSources
        .map((s) => `[${s.id}] ${s.name} (${s.domain}) — ${s.title}\n${s.snippet ? `Summary: ${s.snippet}` : ''}`)
        .join('\n\n');

      // Build conversation messages for conversational research chat
      const priorMessages = turns.map((t) => [
        { role: 'user', content: t.question },
        { role: 'assistant', content: t.fullAnswer },
      ]).flat();

      const researchSystemPrompt = isFollowUp
        ? `You are an expert research investigator continuing an ongoing deep research investigation.
The user is asking a follow-up question to delve deeper: "${cleanQ}".

CORE DIRECTIVES:
- Answer the follow-up inquiry comprehensively with deep factual evidence, quantitative data, and biological/mechanistic or architectural rigor.
- Seamlessly build upon the findings, mechanisms, and metrics previously established in this research thread.
- Ground key factual statements, dosages, data points, and mechanisms using inline citations like [1], [2], or [1,3] matching the Grounding Sources provided.
- Format with clean Markdown headings (e.g. ## Mechanism Details, ## Comparative Evidence, ## Thresholds & Limitations), clear paragraphs, and markdown tables when comparing figures.
- DO NOT output fake boilerplate badges (NO "Peer-Reviewed Standard" or "Academic Research Paper · Systematic Review").
- NEVER echo prompt instructions or start with raw markdown hashtags in title text.

${sourceContext ? `Grounding Sources for this follow-up inquiry:\n${sourceContext}\n` : ''}`
        : `You are an expert research investigator conducting a rigorous, exhaustive deep research synthesis on: "${cleanQ}".

CORE DIRECTIVES:
- Provide an in-depth, authoritative, comprehensive research report answering the inquiry with high factual depth.
- Ground factual findings, quantitative thresholds, mechanisms, and empirical outcomes with inline citations like [1], [2], or [1,3] matching the Grounding Sources.
- Organize logically with clean Markdown headings tailored specifically to the subject (e.g. ## Core Mechanisms & Biochemical Pathways, ## Clinical & Empirical Evidence, ## Quantitative Thresholds & Cohorts, ## Practical Recommendations & Safety Limits).
- Present key comparative metrics or benchmarks in clean Markdown tables.
- DO NOT output fake boilerplate badges or canned header cards (NO "Peer-Reviewed Standard", NO "Academic Research Paper · Systematic Review").
- DO NOT output bloated abstract boxes. Provide crisp, clear executive summaries and direct deep analysis.
- NEVER echo prompt instructions or leave raw markdown symbols.

${sourceContext ? `Grounding Sources:\n${sourceContext}\n` : ''}`;

      const chatResp = await callApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          systemPrompt: researchSystemPrompt,
          messages: [...priorMessages, { role: 'user', content: cleanQ }],
          webSearch: true,
          searchMode: activeSearchMode === 'news' ? 'news' : 'organic',
          model: activeModel?.geminiModel || selectedModelId || 'zro/deepseek-v4.1-flash',
          isResearchMode: true,
          maxTokens: 4096,
        }),
      });

      const chatData = await chatResp.json();

      // Merge additional verified sources if initial list was small
      if (Array.isArray(chatData?.sources) && chatData.sources.length > 0 && mappedSources.length < 4) {
        const extraClean = (chatData.sources as SearchSource[])
          .filter((s) => !isClientBoilerplateSource(s) && !mappedSources.some((m) => m.url === s.url));
        if (extraClean.length > 0) {
          const merged = [...rawSources, ...extraClean].slice(0, 18);
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
          setActiveSources(mappedSources);
          setTurns((prev) =>
            prev.map((t) => (t.id === turnId ? { ...t, sources: mappedSources } : t))
          );
        }
      }

      const rawReply = String(chatData?.text || '')
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .trim();

      const elapsed = Math.max(1, (performance.now() - startTime) / 1000);
      const roundedDuration = Number(elapsed.toFixed(1));
      setActiveDurationSec(roundedDuration);

      if (rawReply) {
        // Strip out any trailing ---FOLLOWUPS--- slop if present
        const [cleanAnswer] = rawReply.split(/---FOLLOWUPS---/i);
        const trimmedAnswer = cleanAnswer.trim();

        setStreamingFullText(trimmedAnswer);
        startWordStream(trimmedAnswer, turnId);

        // Update turn in turns state
        setTurns((prev) => {
          const updated = prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  fullAnswer: trimmedAnswer,
                  sources: mappedSources,
                  durationSec: roundedDuration,
                  thinkingSteps: buildDynamicThinkingSteps(cleanQ, mappedSources),
                }
              : t
          );

          // Save session to history store
          const firstTurn = updated[0];
          const sessionId = currentSessionId || `dr_${Date.now()}`;
          setCurrentSessionId(sessionId);

          DeepResearchHistoryStore.saveRecord({
            id: sessionId,
            topic: firstTurn.question,
            question: firstTurn.question,
            fullAnswer: firstTurn.fullAnswer,
            sources: firstTurn.sources,
            durationSec: roundedDuration,
            turns: updated,
            modelId: activeModel?.id,
          }).catch(() => {});

          return updated;
        });
      } else {
        setIsStreaming(false);
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  fullAnswer: 'Unable to complete research synthesis for this question. Please try again.',
                }
              : t
          )
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setIsSearching(false);
      setIsStreaming(false);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                fullAnswer: 'Connection interrupted while researching. Please try again.',
              }
            : t
        )
      );
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = initialTopic.trim();
    if (trimmed) {
      resetToCleanPage();
      executeResearchTurn(trimmed);
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
    setVisibleWordCount(99999);
    setLiveStatusAnnouncement('Generation stopped');
  };

  const handleCopyTurn = (turn: DeepResearchTurn) => {
    const plainAnswer = turn.fullAnswer
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\[(\d+(?:,\s*\d+)*)\]/g, '[$1]');
    const sourceList = (turn.sources || [])
      .map((s) => `[${s.id}] ${s.name}: ${s.title} (${s.url})`)
      .join('\n');
    const finalCopy = sourceList
      ? `${turn.question}\n\n${plainAnswer}\n\nSources:\n${sourceList}`
      : `${turn.question}\n\n${plainAnswer}`;
    navigator.clipboard.writeText(finalCopy);
    setCopiedTurnId(turn.id);
    setLiveStatusAnnouncement('Copied answer and sources to clipboard');
    setTimeout(() => setCopiedTurnId(null), 2000);
  };

  const handleExportMarkdown = (turn: DeepResearchTurn) => {
    const exportText = `# Research: ${turn.question}\n\n${turn.fullAnswer}\n\n## References & Citations\n` +
      (turn.sources || []).map((s) => `[${s.id}] ${s.name} — ${s.title}\nURL: ${s.url}`).join('\n\n');
    const blob = new Blob([exportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(turn.question || 'research').replace(/[^a-z0-9]/gi, '_').slice(0, 40)}_report.md`;
    a.click();
    URL.revokeObjectURL(url);
    setLiveStatusAnnouncement('Exported report (.md)');
  };

  // Render inline text with KaTeX math ($$...$$ only, never single-$ currency), **bold**, and [1] or [1,3] numbered citation chips
  const renderRichLine = (lineText: string, lineKey: string, turnSources: AnswerSource[]) => {
    const parts = lineText.split(/(\$\$[^\$\n]+\$\$|\*\*[^*]+\*\*|\[\d+(?:,\s*\d+)*\])/g);

    return parts.map((part, idx) => {
      if (!part) return null;

      // Inline LaTeX math $$...$$ (single-$ disabled so currency like $20 is never mangled)
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
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
        const primarySource = turnSources.find((s) => s.id === ids[0]) || turnSources[0];
        if (!primarySource) return null;

        const extraCount = ids.length > 1 ? ` +${ids.length - 1}` : '';
        const numberBadge = `[${ids.join(',')}]`;
        const chipLabel = `${numberBadge} ${primarySource.name}${extraCount}`;
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
              aria-label={`Source ${chipLabel}`}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium leading-tight transition-all cursor-pointer ${
                isHighlighted || isPreviewOpen
                  ? isDark
                    ? 'bg-white text-black font-semibold'
                    : 'bg-neutral-900 text-white font-semibold'
                  : isDark
                  ? 'bg-white/[0.08] text-neutral-300 hover:bg-white/[0.15] hover:text-white'
                  : 'bg-black/[0.06] text-neutral-700 hover:bg-black/[0.12] hover:text-black'
              }`}
            >
              <span className="font-mono font-bold text-[10px] opacity-85">{numberBadge}</span>
              <span>{primarySource.name}{extraCount}</span>
            </button>
          </span>
        );
      }

      return <React.Fragment key={`${lineKey}-t-${idx}`}>{part}</React.Fragment>;
    });
  };

  const parseBlocksFromText = (rawText: string) => {
    if (!rawText) return [];
    // Normalize markdown and ensure headers and separators have empty lines around them
    const normalized = rawText
      .replace(/\r\n/g, '\n')
      .replace(/^([#]{1,6}\s+[^\n]+)/m, '$1\n\n')
      .replace(/\n([#]{1,6}\s+[^\n]+)/g, '\n\n$1\n\n')
      .replace(/\n(---|\*\*\*)\n/g, '\n\n$1\n\n');
    return normalized
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
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

  if (!isOpen) return null;

  return (
    <div
      onClick={() => setActiveChipPreview(null)}
      className={`fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden select-text transition-colors duration-200 relative ${
        isDark ? 'bg-[#0a0a0c] text-white' : 'bg-[#fafafa] text-[#000000]'
      }`}
    >
      {/* Screen-reader polite live region */}
      <div className="sr-only" aria-live="polite">
        {liveStatusAnnouncement}
      </div>

      {/* Floating Top Pill Controls (Zero Scrim / Zero Border / Clean Glass Pills) */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none px-3 sm:px-6 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2">
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-2">
          {/* Back Pill Button */}
          <button
            type="button"
            onClick={onClose}
            className={`pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-2xl transition-all active:scale-95 cursor-pointer shadow-xs ${
              isDark
                ? 'bg-neutral-900/75 hover:bg-neutral-800/85 border-white/[0.14] text-neutral-200 hover:text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
                : 'bg-white/85 hover:bg-white border-black/[0.1] text-neutral-700 hover:text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {/* Right Action Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              title="Research History"
              className={`pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-2xl whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-xs ${
                isHistoryOpen
                  ? isDark
                    ? 'bg-white text-black border-white'
                    : 'bg-neutral-900 text-white border-neutral-900'
                  : isDark
                  ? 'bg-neutral-900/75 hover:bg-neutral-800/85 border-white/[0.14] text-neutral-200 hover:text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
                  : 'bg-white/85 hover:bg-white border-black/[0.1] text-neutral-700 hover:text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
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

            {turns.length > 0 && (
              <button
                type="button"
                onClick={resetToCleanPage}
                title="Start a new research topic"
                className={`pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-2xl whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-xs ${
                  isDark
                    ? 'bg-neutral-900/75 hover:bg-neutral-800/85 border-white/[0.14] text-neutral-200 hover:text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
                    : 'bg-white/85 hover:bg-white border-black/[0.1] text-neutral-700 hover:text-black shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            )}

            {onInsertReportToChat && turns.length > 0 && !isStreaming && (
              <button
                type="button"
                onClick={() => {
                  const combined = turns
                    .map((t, i) => `### ${i === 0 ? 'Research Topic' : 'Follow-up'}: ${t.question}\n\n${t.fullAnswer}`)
                    .join('\n\n---\n\n');
                  const allSources: SearchSource[] = turns
                    .map((t) => t.sources || [])
                    .flat()
                    .map((s) => ({
                      title: s.title,
                      url: s.url,
                      domain: s.domain,
                      snippet: s.snippet || '',
                      position: s.id,
                    }));
                  onInsertReportToChat(turns[0].question, combined, allSources, []);
                  onClose();
                }}
                className={`pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border backdrop-blur-2xl whitespace-nowrap transition-all active:scale-95 cursor-pointer shadow-xs ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200 border-white'
                    : 'bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-900 shadow-[0_4px_16px_rgba(0,0,0,0.12)]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {turns.length === 0 ? (
        /* Empty State: Center Grok Logo and Recent Research */
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 overflow-y-auto scrollbar-thin pt-20 pb-28">
          <div className="max-w-xl w-full flex flex-col items-center">
            <GrokLogo size="lg" isDark={isDark} />

            <div className="text-center mt-3 mb-6">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight">Deep Research Mode</h2>
              <p className={`text-xs mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Comprehensive multi-source analysis with live literature and data synthesis
              </p>
            </div>

            {historyList.length > 0 && (
              <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                        {record.turns && record.turns.length > 1 && (
                          <span className="text-emerald-500 font-medium">• {record.turns.length} turns</span>
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
        /* Multi-Turn Research Chat View */
        <div
          ref={scrollViewportRef}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden px-4 sm:px-6 md:px-8 pt-18 sm:pt-20 pb-32 sm:pb-36 scrollbar-thin"
        >
          <div className="max-w-3xl mx-auto w-full space-y-7">
            {turns.map((turn, tIdx) => {
              const isCurrentTurnStreaming = isStreaming && streamingTurnId === turn.id;
              const isCurrentTurnSearching = isSearching && streamingTurnId === turn.id;

              // Render text: if currently streaming, slice by visible word count
              let textToRender = turn.fullAnswer;
              if (isCurrentTurnStreaming && streamingFullText) {
                const tokens = streamingFullText.split(/(\s+)/);
                let wordsSeen = 0;
                let out = '';
                for (const tok of tokens) {
                  if (/\S/.test(tok)) {
                    wordsSeen++;
                    if (wordsSeen > visibleWordCount) break;
                  }
                  out += tok;
                }
                textToRender = out;
              }

              const blocks = parseBlocksFromText(textToRender);
              const turnSources = (isCurrentTurnStreaming || isCurrentTurnSearching) && activeSources.length > 0
                ? activeSources
                : turn.sources || [];

              return (
                <div
                  key={turn.id}
                  className={`w-full ${
                    tIdx > 0
                      ? isDark
                        ? 'pt-6 border-t border-white/[0.08]'
                        : 'pt-6 border-t border-black/[0.08]'
                      : ''
                  }`}
                >
                  {/* Modern Sleek User Inquiry Header (No Big Ass Number Circle) */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium border backdrop-blur-md ${
                          isDark
                            ? 'border-white/[0.12] bg-white/[0.06] text-neutral-300'
                            : 'border-black/[0.08] bg-black/[0.04] text-neutral-700'
                        }`}
                      >
                        <Search className="w-2.5 h-2.5 opacity-70" />
                        <span>{tIdx === 0 ? 'Research Inquiry' : `Follow-up #${tIdx + 1}`}</span>
                      </span>
                    </div>
                    <h2
                      className={`text-base sm:text-[18px] font-semibold tracking-tight leading-snug ${
                        isDark ? 'text-white' : 'text-neutral-900'
                      }`}
                    >
                      {turn.question}
                    </h2>
                  </div>

                  {/* Sources Carousel for this turn */}
                  {(turnSources.length > 0 || isCurrentTurnSearching) && (
                    <div className="mb-3.5">
                      {isCurrentTurnSearching && turnSources.length === 0 && (
                        <div className="mb-2">
                          <ShimmerText
                            text="Searching verified sources..."
                            isDark={isDark}
                            className="text-xs font-medium"
                          />
                        </div>
                      )}

                      {turnSources.length > 0 && (
                        <div className="flex items-stretch gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                          {turnSources.map((src, idx) => {
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
                                style={{ animationDelay: `${idx * 30}ms` }}
                                className={`w-36 sm:w-40 shrink-0 rounded-xl border p-2.5 flex flex-col justify-between gap-1.5 transition-all duration-150 animate-in fade-in slide-in-from-bottom-1 ${
                                  isCardHighlighted
                                    ? isDark
                                      ? 'bg-white/10 border-white/30'
                                      : 'bg-black/10 border-black/30'
                                    : isDark
                                    ? 'bg-[#141418] border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04]'
                                    : 'bg-white border-black/[0.07] hover:border-black/[0.16] hover:bg-neutral-50 shadow-2xs'
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
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums ${
                                      isDark
                                        ? 'bg-white/[0.08] text-neutral-300'
                                        : 'bg-black/[0.06] text-neutral-700'
                                    }`}
                                  >
                                    [{src.id}]
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

                  {/* Clean Content Body - High-signal, anti-slop typography */}
                  <div
                    aria-busy={isCurrentTurnStreaming}
                    className={`space-y-3.5 text-[13.5px] sm:text-[14px] leading-relaxed ${
                      isDark ? 'text-neutral-200' : 'text-neutral-800'
                    }`}
                  >
                    {blocks.length === 0 && (isCurrentTurnSearching || isCurrentTurnStreaming) ? (
                      <div
                        className={`p-4 rounded-xl border space-y-3 ${
                          isDark
                            ? 'bg-white/[0.02] border-white/[0.08]'
                            : 'bg-black/[0.02] border-black/[0.08]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <ShimmerText
                            text={
                              isCurrentTurnSearching
                                ? 'Stage 1/4 · Searching academic & live web indexes...'
                                : researchElapsedSec < 4
                                ? `Stage 2/4 · Cross-verifying ${turnSources.length || 'live'} sources & extracting passages...`
                                : researchElapsedSec < 9
                                ? `Stage 3/4 · Mapping inline citations [1–${Math.max(1, turnSources.length)}] & evidence tables...`
                                : 'Stage 4/4 · Synthesizing structured research report...'
                            }
                            isDark={isDark}
                            className="text-xs font-medium"
                          />
                          <span
                            className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded border shrink-0 ${
                              isDark
                                ? 'bg-white/[0.05] border-white/[0.1] text-neutral-300'
                                : 'bg-black/[0.04] border-black/[0.1] text-neutral-700'
                            }`}
                          >
                            {String(Math.floor(researchElapsedSec / 60)).padStart(2, '0')}:
                            {String(researchElapsedSec % 60).padStart(2, '0')}s
                          </span>
                        </div>
                        <div
                          className={`w-full h-1.5 rounded-full overflow-hidden ${
                            isDark ? 'bg-white/[0.07]' : 'bg-black/[0.07]'
                          }`}
                        >
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              isDark ? 'bg-white' : 'bg-neutral-900'
                            }`}
                            style={{
                              width: `${Math.min(
                                94,
                                isCurrentTurnSearching
                                  ? 26
                                  : 38 + Math.min(56, researchElapsedSec * 5)
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5 text-[11px]">
                          {[
                            { label: '1. Literature Search', done: !isCurrentTurnSearching },
                            {
                              label: `2. ${turnSources.length || 'Live'} Sources Indexed`,
                              done: !isCurrentTurnSearching && researchElapsedSec >= 2,
                            },
                            {
                              label: '3. Citation Mapping',
                              done: !isCurrentTurnSearching && researchElapsedSec >= 5,
                            },
                            {
                              label: '4. Final Report',
                              done: false,
                            },
                          ].map((st, sIdx) => (
                            <div
                              key={sIdx}
                              className={`px-2 py-1 rounded border truncate font-mono text-[10px] ${
                                st.done
                                  ? isDark
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : isDark
                                  ? 'bg-white/[0.02] border-white/[0.06] text-neutral-400'
                                  : 'bg-white border-black/[0.06] text-neutral-500'
                              }`}
                            >
                              {st.done ? '✓ ' : '⋯ '}
                              {st.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      blocks.map((block, bIdx) => {
                        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
                        const isLastBlock = bIdx === blocks.length - 1;

                        // 1. Block Math ($$...$$)
                        if (block.startsWith('$$') && block.endsWith('$$')) {
                          return (
                            <div key={`blk-math-${turn.id}-${bIdx}`} className="my-3 overflow-x-auto">
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
                            <div key={`code-${turn.id}-${bIdx}`} className="my-3.5 w-full">
                              <CodeBlock>
                                <CodeBlockHeader>
                                  <CodeBlockTitle>
                                    {rawLang ? `${rawLang.toUpperCase()} Block` : 'Code Block'}
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

                        // 2. Clean Headings (#, ##, ###, ####) - Strip raw `# ` symbols
                        if (/^#{1,6}\s+/.test(block)) {
                          const match = block.match(/^(#{1,6})\s+(.*)$/);
                          if (match) {
                            const level = match[1].length;
                            const cleanHeadingText = match[2].trim();
                            if (level === 1) {
                              return (
                                <h2
                                  key={`h1-${turn.id}-${bIdx}`}
                                  className={`text-[16px] sm:text-[17px] font-bold tracking-tight mt-5 mb-2 pb-1 border-b ${
                                    isDark
                                      ? 'border-white/[0.1] text-white'
                                      : 'border-black/[0.08] text-neutral-900'
                                  }`}
                                >
                                  {renderRichLine(cleanHeadingText, `h1-${turn.id}-${bIdx}`, turnSources)}
                                </h2>
                              );
                            }
                            if (level === 2) {
                              return (
                                <h3
                                  key={`h2-${turn.id}-${bIdx}`}
                                  className={`text-[14.5px] sm:text-[15.5px] font-semibold tracking-tight mt-4.5 mb-2 ${
                                    isDark ? 'text-neutral-100' : 'text-neutral-900'
                                  }`}
                                >
                                  {renderRichLine(cleanHeadingText, `h2-${turn.id}-${bIdx}`, turnSources)}
                                </h3>
                              );
                            }
                            return (
                              <h4
                                key={`h3-${turn.id}-${bIdx}`}
                                className={`text-[13px] sm:text-[13.5px] font-semibold mt-3.5 mb-1 ${
                                  isDark ? 'text-neutral-200' : 'text-neutral-800'
                                }`}
                              >
                                {renderRichLine(cleanHeadingText, `h3-${turn.id}-${bIdx}`, turnSources)}
                              </h4>
                            );
                          }
                        }

                        // 3. Horizontal Separator (--- or ***)
                        if (block === '---' || block === '***') {
                          return (
                            <hr
                              key={`hr-${turn.id}-${bIdx}`}
                              className={`my-4 border-t ${
                                isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                              }`}
                            />
                          );
                        }

                        // 4. Subtle Executive Summary / Blockquote (> ...) - NO bloated grey box!
                        const quoteLines = lines
                          .filter((l) => l.startsWith('>'))
                          .map((l) => l.replace(/^>\s*/, ''));
                        if (quoteLines.length > 0 && quoteLines.length === lines.length) {
                          return (
                            <div
                              key={`quote-${turn.id}-${bIdx}`}
                              className={`my-3 pl-3.5 border-l-2 text-[13px] sm:text-[13.5px] leading-relaxed transition-colors ${
                                isDark
                                  ? 'border-white/30 text-neutral-300'
                                  : 'border-neutral-400 text-neutral-700'
                              }`}
                            >
                              <div className="space-y-1">
                                {quoteLines.map((ql, qIdx) => (
                                  <div key={qIdx} className="leading-relaxed">
                                    {renderRichLine(ql, `q-${turn.id}-${bIdx}-${qIdx}`, turnSources)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        // 5. Clean Responsive Table (| col | col |)
                        const tableData = parseMarkdownTable(block);
                        if (tableData) {
                          return (
                            <div
                              key={`tbl-${turn.id}-${bIdx}`}
                              className={`my-3.5 w-full overflow-x-auto rounded-xl border ${
                                isDark
                                  ? 'border-white/[0.08] bg-[#121215]'
                                  : 'border-black/[0.07] bg-white shadow-2xs'
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
                                        className={`px-3 py-2 font-semibold text-[11px] sm:text-[11.5px] tracking-wide ${
                                          isDark ? 'text-neutral-300' : 'text-neutral-700'
                                        }`}
                                      >
                                        {renderRichLine(h, `th-${turn.id}-${bIdx}-${hIdx}`, turnSources)}
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
                                          {renderRichLine(cell, `td-${turn.id}-${bIdx}-${rIdx}-${cIdx}`, turnSources)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        }

                        // 6. Numbered List (1. ... 2. ...)
                        const isNumberedList = lines.every((l) => /^\d+\.\s+/.test(l));
                        if (isNumberedList) {
                          return (
                            <ol key={`numblk-${turn.id}-${bIdx}`} className="space-y-1.5 pl-0.5">
                              {lines.map((item, lIdx) => {
                                const num = item.match(/^(\d+)\.\s+/)?.[1] || `${lIdx + 1}`;
                                const cleanItem = item.replace(/^\d+\.\s+/, '');
                                const isVeryLast = isLastBlock && lIdx === lines.length - 1;
                                return (
                                  <li
                                    key={`oli-${turn.id}-${bIdx}-${lIdx}`}
                                    className="flex items-start gap-2 leading-relaxed text-[13px] sm:text-[13.5px]"
                                  >
                                    <span
                                      className={`text-[11.5px] font-mono font-semibold shrink-0 mt-0.5 tabular-nums ${
                                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                                      }`}
                                    >
                                      {num}.
                                    </span>
                                    <span className="flex-1">
                                      {renderRichLine(cleanItem, `oli-${turn.id}-${bIdx}-${lIdx}`, turnSources)}
                                      {isCurrentTurnStreaming && isVeryLast && (
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

                        // 7. Bullet List (- ... * ... • ...)
                        const isBulletList = lines.every((l) => /^[-*•]\s+/.test(l));
                        if (isBulletList) {
                          return (
                            <ul key={`blk-${turn.id}-${bIdx}`} className="space-y-1.5 pl-0.5">
                              {lines.map((item, lIdx) => {
                                const cleanItem = item.replace(/^[-*•]\s+/, '');
                                const isVeryLast = isLastBlock && lIdx === lines.length - 1;
                                return (
                                  <li
                                    key={`li-${turn.id}-${bIdx}-${lIdx}`}
                                    className="flex items-start gap-2 leading-relaxed text-[13px] sm:text-[13.5px]"
                                  >
                                    <span
                                      className={`mt-2 size-1 rounded-full shrink-0 ${
                                        isDark ? 'bg-neutral-500' : 'bg-neutral-400'
                                      }`}
                                    />
                                    <span className="flex-1">
                                      {renderRichLine(cleanItem, `li-${turn.id}-${bIdx}-${lIdx}`, turnSources)}
                                      {isCurrentTurnStreaming && isVeryLast && (
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

                        // 8. Standard Paragraph
                        return (
                          <p key={`blk-${turn.id}-${bIdx}`} className="leading-relaxed">
                            {renderRichLine(block, `p-${turn.id}-${bIdx}`, turnSources)}
                            {isCurrentTurnStreaming && isLastBlock && (
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

                  {/* Modern Pill-Shaped Action Buttons with Crisp Small Icons */}
                  {turn.fullAnswer && !isCurrentTurnStreaming && (
                    <div
                      className={`mt-4 pt-2.5 flex items-center justify-between gap-3 text-xs flex-wrap ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Copy Pill */}
                        <button
                          type="button"
                          onClick={() => handleCopyTurn(turn)}
                          title="Copy answer and citations"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                            copiedTurnId === turn.id
                              ? isDark
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : isDark
                              ? 'border-white/[0.1] bg-white/[0.04] text-neutral-300 hover:text-white hover:bg-white/[0.08]'
                              : 'border-black/[0.08] bg-black/[0.03] text-neutral-700 hover:text-black hover:bg-black/[0.06]'
                          }`}
                        >
                          {copiedTurnId === turn.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedTurnId === turn.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        {/* Export Pill */}
                        <button
                          type="button"
                          onClick={() => handleExportMarkdown(turn)}
                          title="Export report (.md)"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                            isDark
                              ? 'border-white/[0.1] bg-white/[0.04] text-neutral-300 hover:text-white hover:bg-white/[0.08]'
                              : 'border-black/[0.08] bg-black/[0.03] text-neutral-700 hover:text-black hover:bg-black/[0.06]'
                          }`}
                        >
                          <Download className="w-3 h-3" />
                          <span>Export</span>
                        </button>

                        {/* Regenerate / Retry Pill */}
                        {tIdx === turns.length - 1 && (
                          <button
                            type="button"
                            onClick={() => executeResearchTurn(turn.question)}
                            title="Regenerate this answer"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                              isDark
                                ? 'border-white/[0.1] bg-white/[0.04] text-neutral-300 hover:text-white hover:bg-white/[0.08]'
                                : 'border-black/[0.08] bg-black/[0.03] text-neutral-700 hover:text-black hover:bg-black/[0.06]'
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}

                        {/* Small Pill Thumbs Up/Down */}
                        <div className="flex items-center gap-1 ml-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setFeedbackMap((prev) => ({
                                ...prev,
                                [turn.id]: prev[turn.id] === 'up' ? null : 'up',
                              }));
                              setLiveStatusAnnouncement('Feedback recorded: helpful');
                            }}
                            title="Helpful"
                            aria-label="Thumbs up"
                            className={`size-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                              feedbackMap[turn.id] === 'up'
                                ? isDark
                                  ? 'bg-white text-black border-white'
                                  : 'bg-neutral-900 text-white border-neutral-900'
                                : isDark
                                ? 'border-white/[0.1] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                                : 'border-black/[0.08] text-neutral-600 hover:text-black hover:bg-black/[0.05]'
                            }`}
                          >
                            <ThumbsUp className="w-2.5 h-2.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setFeedbackMap((prev) => ({
                                ...prev,
                                [turn.id]: prev[turn.id] === 'down' ? null : 'down',
                              }));
                              setLiveStatusAnnouncement('Feedback recorded: not helpful');
                            }}
                            title="Not helpful"
                            aria-label="Thumbs down"
                            className={`size-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                              feedbackMap[turn.id] === 'down'
                                ? isDark
                                  ? 'bg-white text-black border-white'
                                  : 'bg-neutral-900 text-white border-neutral-900'
                                : isDark
                                ? 'border-white/[0.1] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                                : 'border-black/[0.08] text-neutral-600 hover:text-black hover:bg-black/[0.05]'
                            }`}
                          >
                            <ThumbsDown className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      {turn.durationSec ? (
                        <div className="text-[11px] tabular-nums opacity-60">
                          Answered in {turn.durationSec}s
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Feedback options for thumbs down */}
                  {feedbackMap[turn.id] === 'down' && (
                    <div className="mt-2.5 pt-2 border-t border-current/10 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
                      {FEEDBACK_REASONS.map((reason) => {
                        const active = selectedReasonMap[turn.id] === reason;
                        return (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => {
                              setSelectedReasonMap((prev) => ({ ...prev, [turn.id]: reason }));
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
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Bottom Prompt Input Bar (Zero Scrim / Zero Border / Floating Dock) */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto">
          <ChatInput
            onSend={(message: string) => {
              executeResearchTurn(message);
            }}
            onCancel={handleStopStreaming}
            isRunning={isSearching || isStreaming}
            searchMode={activeSearchMode}
            onToggleSearchMode={handleToggleSearchMode}
            selectedModel={activeModel}
            onSelectModel={handleSelectModel}
            placeholder={turns.length > 0 ? 'Ask a follow-up question...' : 'What do you want to research?'}
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
                  const isCurrent = currentSessionId === item.id;
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
                              navigator.clipboard.writeText(
                                `${item.question}\n\n${item.fullAnswer}`
                              );
                              setLiveStatusAnnouncement('Copied research to clipboard');
                            }}
                            title="Copy report"
                            className="opacity-70 sm:opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded-md transition-opacity cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              DeepResearchHistoryStore.deleteRecord(item.id);
                              if (currentSessionId === item.id) {
                                setCurrentSessionId(null);
                              }
                            }}
                            title="Delete this record"
                            className="opacity-70 sm:opacity-0 group-hover:opacity-100 hover:opacity-100 hover:text-red-500 p-1 rounded-md transition-opacity cursor-pointer"
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
                          {item.turns && item.turns.length > 1 && (
                            <span className="text-emerald-500 font-medium">• {item.turns.length} turns</span>
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

      {/* Viewport-Clamped Collision-Free Citation Popover */}
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
                const src = activeSources.find((s) => s.id === id) ||
                  turns.map((t) => t.sources || []).flat().find((s) => s.id === id);
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
