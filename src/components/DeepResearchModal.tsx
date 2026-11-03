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
import { openZenoReportModal } from './LegalAndInfoPages';
import { Flag } from 'lucide-react';

export { type AnswerSource };

const RESEARCH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'which', 'when',
  'where', 'who', 'whom', 'whose', 'why', 'how', 'are', 'was', 'were', 'been',
  'being', 'have', 'has', 'had', 'having', 'does', 'did', 'doing', 'can', 'could',
  'should', 'would', 'may', 'might', 'must', 'shall', 'will', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'best', 'top', 'new', 'latest', 'good', 'better',
  'review', 'guide', 'overview', 'comparison', 'compare', 'vs', 'versus',
]);

function isBiomedicalResearchQuery(query: string): boolean {
  const q = String(query || '').toLowerCase();
  return /\b(clinical|medical|medicine|patient|patients|disease|syndrome|therapy|therapeutic|treatment|drug|pharmacology|pharmacokinetic|dosage|dose|symptom|diagnosis|diagnostic|prognosis|pathology|oncology|cancer|tumor|tumour|cardiac|cardiovascular|neurology|neurological|brain|psychiatric|diabetes|insulin|metabolic|metabolism|immune|immunology|vaccine|infection|viral|bacteria|bacterial|surgery|surgical|hospital|physician|doctor|nursing|pediatric|prenatal|pregnancy|fetal|genetics|genomic|dna|rna|protein|peptide|enzyme|receptor|biomarker|cell|cellular|mortality|morbidity|epidemiology|cohort|randomized|placebo|trial|pubmed|medline|biomedical|anatomy|physiology|gut|microbiome|vitamin|supplement|longevity|aging|sleep|circadian)\b/i.test(
    q
  );
}

const OFF_TOPIC_ACADEMIC_PATTERNS = [
  /\bprenatal\s+diagnosis\b/i,
  /\bclinical[-\s]data\b/i,
  /\belectronic\s+health\s+record/i,
  /\bfinancial\s+time[-\s]series\b/i,
  /\btime[-\s]series\s+forecasting\b/i,
  /\btext2sparql\b/i,
  /\bsparql[-\s]?llm\b/i,
  /\bsemeval[-\s]?\d*\s*task\b/i,
  /\bnarrative\s+similarity\b/i,
  /\bpatient\s+outcomes?\b/i,
  /\brandomized\s+controlled\s+trial\b/i,
];

function extractMeaningfulTerms(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9.+_-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[._-]+|[._-]+$/g, ''))
    .filter((t) => t.length >= 2 && !RESEARCH_STOP_WORDS.has(t) && !/^(19|20)\d{2}$/.test(t));
}

function expandQueryConcepts(query: string): string[] {
  const q = query.toLowerCase();
  const extra: string[] = [];
  if (/\b(llm|llms|large language model|language models)\b/.test(q)) {
    extra.push('llm', 'llms', 'language model', 'llama', 'mistral', 'qwen', 'deepseek', 'gemma', 'phi', 'mixtral', 'open-weight', 'open-source', 'weights', 'benchmark', 'mmlu', 'humaneval', 'gsm8k');
  }
  if (/\b(open[-\s]?source|open[-\s]?weight|local)\b/.test(q)) {
    extra.push('open-source', 'open source', 'open-weight', 'open weights', 'apache', 'mit license', 'huggingface', 'ollama', 'vllm', 'llama', 'qwen', 'deepseek', 'mistral', 'gemma');
  }
  return extra;
}

function scoreResearchSourceRelevance(
  source: { title?: string; snippet?: string; url?: string; domain?: string },
  query: string
): number {
  const title = String(source.title || '').toLowerCase();
  const snippet = String(source.snippet || '').toLowerCase();
  const url = String(source.url || '').toLowerCase();
  const domain = String(source.domain || '').toLowerCase();
  const combined = `${title} ${snippet} ${url}`;

  const isBioQuery = isBiomedicalResearchQuery(query);

  // Immediately reject biomedical databases and off-topic clinical/SPARQL/time-series/SemEval papers for non-biomedical queries
  if (!isBioQuery) {
    if (
      domain.includes('europepmc.org') ||
      domain.includes('ncbi.nlm.nih.gov') ||
      domain.includes('pubmed') ||
      domain.includes('medline') ||
      url.includes('europepmc.org') ||
      url.includes('ncbi.nlm.nih.gov/pmc') ||
      url.includes('pubmed.ncbi.nlm.nih.gov')
    ) {
      return -10;
    }
    for (const pat of OFF_TOPIC_ACADEMIC_PATTERNS) {
      if (pat.test(combined) && !pat.test(query.toLowerCase())) {
        return -10;
      }
    }
    if (
      /\b(clinical|patient|patients|hospital|medical|prenatal|fetal|oncology|cardiology|pathology|surgery|disease|diagnosis|therapy)\b/i.test(
        title
      )
    ) {
      return -8;
    }
  }

  const coreTerms = extractMeaningfulTerms(query);
  if (coreTerms.length === 0) return 1;

  let score = 0;
  let matchedTerms = 0;

  for (const term of coreTerms) {
    const variants = [term];
    if (term.endsWith('s') && term.length > 3) variants.push(term.slice(0, -1));
    if (term === 'llm' || term === 'llms') variants.push('language model', 'large language model');
    if (term === 'open-source') variants.push('open source', 'open-weight', 'open weight');

    const inTitle = variants.some((v) => title.includes(v));
    const inSnippet = variants.some((v) => snippet.includes(v));
    const inUrl = variants.some((v) => url.includes(v));

    if (inTitle) {
      score += 3.0;
      matchedTerms++;
    } else if (inSnippet) {
      score += 1.5;
      matchedTerms++;
    } else if (inUrl) {
      score += 1.0;
      matchedTerms++;
    }
  }

  const expanded = expandQueryConcepts(query);
  let expandedMatches = 0;
  for (const concept of expanded) {
    if (title.includes(concept)) {
      score += 1.2;
      expandedMatches++;
    } else if (snippet.includes(concept)) {
      score += 0.6;
      expandedMatches++;
    }
  }

  // Require at least 2 core terms (or 1 core term + expanded domain concepts)
  const minRequired = coreTerms.length >= 2 ? 2 : 1;
  if (matchedTerms < minRequired && !(matchedTerms >= 1 && expandedMatches >= 2)) {
    return 0;
  }

  // Penalize narrow domain-specific academic papers when query is a general landscape/best-of query
  if (
    /\b(best|top|comparison|vs|versus|guide|benchmark|leaderboard)\b/i.test(query) &&
    (domain.includes('arxiv.org') || domain.includes('doi.org')) &&
    !/\b(survey|benchmark|leaderboard|overview|evaluation|comparison|llama|qwen|deepseek|mistral|open-source|open-weight)\b/i.test(
      title
    )
  ) {
    score -= 2.5;
  }

  return score;
}

function filterRelevantResearchSources(query: string, rawSources: SearchSource[]): SearchSource[] {
  const seenUrls = new Set<string>();
  const scored: Array<{ source: SearchSource; score: number }> = [];

  for (const s of rawSources) {
    if (!s || !s.url || isClientBoilerplateSource(s)) continue;
    const normUrl = s.url.trim().replace(/\/+$/, '');
    if (seenUrls.has(normUrl)) continue;
    seenUrls.add(normUrl);

    const score = scoreResearchSourceRelevance(s, query);
    if (score >= 2.2) {
      scored.push({ source: s, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  // Never pad up to 12 sources; return only genuinely relevant sources
  return scored.slice(0, 10).map((item) => item.source);
}

/**
 * Post-generation Citation Mapping & Verification Stage:
 * 1. Verifies that each inline citation [k] in a sentence is entailed/supported by source k's title/snippet/domain.
 * 2. Remaps mismatched citations to the highest-scoring supporting source in candidateSources, or removes unsupported citations.
 * 3. Drops any candidate sources that are never cited in the final report (Rule 4).
 * 4. Renumbers cited sources sequentially [1]..[M] in order of first appearance in the report text.
 */
function verifyAndCompactResearchCitations(
  rawMarkdown: string,
  candidateSources: AnswerSource[],
  query: string
): { verifiedText: string; finalSources: AnswerSource[] } {
  if (!rawMarkdown || candidateSources.length === 0) {
    return {
      verifiedText: rawMarkdown.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, ''),
      finalSources: [],
    };
  }

  const sourceById = new Map<number, AnswerSource>();
  for (const s of candidateSources) {
    sourceById.set(s.id, s);
  }

  const scoreSourceSupportForClaim = (source: AnswerSource, claimText: string): number => {
    const sText = `${source.title || ''} ${source.snippet || ''} ${source.name || ''} ${source.domain || ''}`.toLowerCase();
    const claimLower = claimText.toLowerCase();
    const claimTerms = extractMeaningfulTerms(claimText);
    if (claimTerms.length === 0) return 1;

    let score = 0;
    for (const term of claimTerms) {
      if (sText.includes(term)) {
        score += term.length >= 5 ? 2.0 : 1.0;
      }
    }

    // Specific model / benchmark entity checks so claims about Llama, Mistral, Qwen, DeepSeek, Gemma, MMLU, GSM8K, HumanEval match sources that discuss them or LLMs
    const specificEntities = [
      'llama', 'mistral', 'mixtral', 'qwen', 'deepseek', 'gemma', 'phi-3', 'phi-4', 'falcon', 'yi-',
      'mmlu', 'gsm8k', 'humaneval', 'swe-bench', 'math', 'gpqa', 'coding', 'ollama', 'vllm', 'huggingface',
    ];
    for (const ent of specificEntities) {
      if (claimLower.includes(ent)) {
        if (sText.includes(ent)) {
          score += 3.5;
        } else if (/\b(llm|llms|language model|open-source|open source|open-weight|benchmark|ai model|coding)\b/i.test(sText)) {
          score += 1.2;
        }
      }
    }

    // Also reward baseline relevance of the source to the user query
    const queryRel = scoreResearchSourceRelevance(source, query);
    if (queryRel > 0) {
      score += Math.min(2.0, queryRel * 0.25);
    } else {
      score -= 10;
    }

    return score;
  };

  // Process line by line to inspect sentences/rows containing [1] or [1, 2]
  const lines = rawMarkdown.split('\n');
  const verifiedLines = lines.map((line) => {
    if (!/\[\d+(?:,\s*\d+)*\]/.test(line)) return line;

    return line.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_fullMatch, idListStr: string, offset: number) => {
      // Extract local sentence/clause context around this citation
      const windowStart = Math.max(0, offset - 220);
      const windowEnd = Math.min(line.length, offset + 80);
      const claimContext = line.slice(windowStart, windowEnd).replace(/\[\d+(?:,\s*\d+)*\]/g, ' ');

      const rawIds = idListStr
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => !isNaN(n));

      const validatedIds: number[] = [];

      for (const id of rawIds) {
        const citedSource = sourceById.get(id);
        const currentSupport = citedSource ? scoreSourceSupportForClaim(citedSource, claimContext) : -10;

        if (citedSource && currentSupport >= 1.5) {
          if (!validatedIds.includes(id)) validatedIds.push(id);
        } else {
          // Find best supporting source across candidateSources
          let bestSource: AnswerSource | null = null;
          let bestScore = 1.5;
          for (const candidate of candidateSources) {
            const s = scoreSourceSupportForClaim(candidate, claimContext);
            if (s > bestScore) {
              bestScore = s;
              bestSource = candidate;
            }
          }
          if (bestSource && !validatedIds.includes(bestSource.id)) {
            validatedIds.push(bestSource.id);
          }
        }
      }

      if (validatedIds.length === 0) {
        return '';
      }
      return `[${validatedIds.join(',')}]`;
    });
  });

  let intermediateText = verifiedLines.join('\n').replace(/  +\./g, '.');

  // Collect cited source IDs in order of first appearance
  const oldIdToNewId = new Map<number, number>();
  const orderedSources: AnswerSource[] = [];

  const citationScanRegex = /\[(\d+(?:,\s*\d+)*)\]/g;
  let match: RegExpExecArray | null;
  while ((match = citationScanRegex.exec(intermediateText)) !== null) {
    const ids = match[1]
      .split(',')
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => !isNaN(n));
    for (const oldId of ids) {
      if (!oldIdToNewId.has(oldId)) {
        const src = sourceById.get(oldId);
        if (src) {
          const newId = orderedSources.length + 1;
          oldIdToNewId.set(oldId, newId);
          orderedSources.push({ ...src, id: newId });
        }
      }
    }
  }

  // If the model failed to output any inline citations despite having relevant sources,
  // attach verified citations to the first paragraphs that match a candidate source.
  if (orderedSources.length === 0 && candidateSources.length > 0) {
    const paraBlocks = intermediateText.split('\n\n');
    const usedIds = new Set<number>();
    const patchedBlocks = paraBlocks.map((block) => {
      const trimmed = block.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('```')) {
        return block;
      }
      let bestCandidate: AnswerSource | null = null;
      let bestScore = 1.5;
      for (const c of candidateSources) {
        if (usedIds.has(c.id)) continue;
        const sc = scoreSourceSupportForClaim(c, trimmed);
        if (sc > bestScore) {
          bestScore = sc;
          bestCandidate = c;
        }
      }
      if (bestCandidate) {
        usedIds.add(bestCandidate.id);
        const newId = orderedSources.length + 1;
        oldIdToNewId.set(bestCandidate.id, newId);
        orderedSources.push({ ...bestCandidate, id: newId });
        return `${block.replace(/([.!?])\s*$/, '')} [${newId}].`;
      }
      return block;
    });
    return {
      verifiedText: patchedBlocks.join('\n\n'),
      finalSources: orderedSources,
    };
  }

  // Rewrite all [oldId] occurrences to [newId] in order of first appearance
  const renumberedText = intermediateText.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_m, idListStr: string) => {
    const newIds: number[] = [];
    for (const part of idListStr.split(',')) {
      const oldId = parseInt(part.trim(), 10);
      const mapped = oldIdToNewId.get(oldId);
      if (mapped && !newIds.includes(mapped)) {
        newIds.push(mapped);
      }
    }
    return newIds.length > 0 ? `[${newIds.join(',')}]` : '';
  });

  return {
    verifiedText: renumberedText,
    finalSources: orderedSources,
  };
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
      // Rewrite follow-ups with conversation topic so retrieval stays on-topic
      const baseTopic = turns.length > 0 ? turns[0].question : '';
      const effectiveSearchQuery =
        isFollowUp && baseTopic && !cleanQ.toLowerCase().includes(baseTopic.toLowerCase().slice(0, 18))
          ? `${baseTopic} — ${cleanQ}`
          : cleanQ;

      const isBioQuery = isBiomedicalResearchQuery(effectiveSearchQuery);

      // Fetch organic web results + (if biomedical) scholarly results in parallel, then strictly filter by relevance
      const [organicRes, researchRes] = await Promise.all([
        callApi('/api/search/live', {
          method: 'POST',
          headers: authHeaders,
          signal: controller.signal,
          body: JSON.stringify({
            query: effectiveSearchQuery,
            searchMode: activeSearchMode === 'news' ? 'news' : 'organic',
            isResearchMode: false,
          }),
        })
          .then((r) => r.json())
          .catch(() => ({ sources: [] })),
        callApi('/api/search/live', {
          method: 'POST',
          headers: authHeaders,
          signal: controller.signal,
          body: JSON.stringify({
            query: effectiveSearchQuery,
            searchMode: activeSearchMode === 'news' ? 'news' : 'organic',
            isResearchMode: isBioQuery,
          }),
        })
          .then((r) => r.json())
          .catch(() => ({ sources: [] })),
      ]);

      const combinedCandidates: SearchSource[] = [
        ...(Array.isArray(organicRes?.sources) ? organicRes.sources : []),
        ...(Array.isArray(researchRes?.sources) ? researchRes.sources : []),
      ];

      // Filter retrieved sources by relevance BEFORE indexing (drop off-topic papers, never pad to 12)
      const rawSources: SearchSource[] = filterRelevantResearchSources(effectiveSearchQuery, combinedCandidates);

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

      // Lock citation IDs [1]..[N] to their extracted source passages
      const sourceContext = mappedSources
        .map(
          (s) =>
            `SOURCE [${s.id}]\nTitle: ${s.title}\nPublisher/Domain: ${s.name} (${s.domain})\nURL: ${s.url}\nExtracted Passage: ${s.snippet || s.title}`
        )
        .join('\n\n');

      // Build conversation messages for conversational research chat
      const priorMessages = turns.map((t) => [
        { role: 'user', content: t.question },
        { role: 'assistant', content: t.fullAnswer },
      ]).flat();

      const lockedGroundingBlock = sourceContext
        ? `\n<locked_grounding_sources>\n${sourceContext}\n</locked_grounding_sources>\n\nSTRICT CITATION LOCKING RULES:\n1. Each source above has a locked ID from [1] to [${mappedSources.length}].\n2. Cite ONLY a source ID [k] when SOURCE [k]'s Extracted Passage or Title directly supports the specific model, benchmark, metric, or claim in that sentence.\n3. NEVER cite an ID that does not discuss the claim in that sentence, and NEVER invent citation numbers outside [1]..[${mappedSources.length}].\n4. Place citations at the end of the supported clause or sentence like [1] or [1,2].`
        : `\nNo external web sources matched the relevance threshold. Answer accurately without inline [N] citation markers.`;

      const researchSystemPrompt = isFollowUp
        ? `You are an expert research investigator continuing an ongoing deep research investigation.
The user is asking a follow-up question to delve deeper: "${cleanQ}".

CORE DIRECTIVES:
- Answer the follow-up inquiry comprehensively with deep factual evidence, quantitative data, and architectural/mechanistic rigor.
- Seamlessly build upon the findings, mechanisms, and metrics previously established in this research thread.
- Ground factual statements, data points, and benchmarks using ONLY the locked inline citation IDs [1]..[${mappedSources.length}] whose passage directly supports that sentence.
- Format with clean Markdown headings (e.g. ## Key Findings, ## Comparative Benchmarks, ## Trade-offs & Recommendations), clear paragraphs, and markdown tables when comparing figures.
- DO NOT output fake boilerplate badges (NO "Peer-Reviewed Standard" or "Academic Research Paper · Systematic Review").
- NEVER echo prompt instructions or start with raw markdown hashtags in title text.
${lockedGroundingBlock}`
        : `You are an expert research investigator conducting a rigorous, exhaustive deep research synthesis on: "${cleanQ}".

CORE DIRECTIVES:
- Provide an in-depth, authoritative, comprehensive research report answering the inquiry with high factual depth.
- Ground factual findings, model comparisons, benchmarks, quantitative thresholds, and empirical outcomes using ONLY the locked inline citation IDs [1]..[${mappedSources.length}] whose passage directly supports that sentence.
- Organize logically with clean Markdown headings tailored specifically to the subject.
- Present key comparative metrics or benchmarks in clean Markdown tables.
- DO NOT output fake boilerplate badges or canned header cards (NO "Peer-Reviewed Standard", NO "Academic Research Paper · Systematic Review").
- DO NOT output bloated abstract boxes. Provide crisp, clear executive summaries and direct deep analysis.
- NEVER echo prompt instructions or leave raw markdown symbols.
${lockedGroundingBlock}`;

      const userTurnContent = sourceContext
        ? `${cleanQ}\n\nUse ONLY these locked sources for inline [1]..[${mappedSources.length}] citations (cite only IDs whose passage directly supports the sentence):\n\n${sourceContext}`
        : cleanQ;

      const chatResp = await callApi('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          systemPrompt: researchSystemPrompt,
          messages: [...priorMessages, { role: 'user', content: userTurnContent }],
          webSearch: false,
          searchMode: activeSearchMode === 'news' ? 'news' : 'organic',
          model: activeModel?.geminiModel || selectedModelId || 'zro/deepseek-v4.1-flash',
          isResearchMode: false,
          maxTokens: 4096,
        }),
      });

      const chatData = await chatResp.json();

      const rawReply = String(chatData?.text || '')
        .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
        .trim();

      const elapsed = Math.max(1, (performance.now() - startTime) / 1000);
      const roundedDuration = Number(elapsed.toFixed(1));
      setActiveDurationSec(roundedDuration);

      if (rawReply) {
        // Strip out any trailing ---FOLLOWUPS--- slop if present
        const [cleanAnswer] = rawReply.split(/---FOLLOWUPS---/i);
        const rawTrimmedAnswer = cleanAnswer.trim();

        // Stage 3/4 Post-Generation Verification & Citation Mapping:
        // Verify each cited passage supports the sentence, remap or strip unsupported citations,
        // drop uncited sources so uncited sources never get a number, and renumber sequentially [1]..[M].
        const { verifiedText: trimmedAnswer, finalSources: verifiedSources } =
          verifyAndCompactResearchCitations(rawTrimmedAnswer, mappedSources, effectiveSearchQuery);

        mappedSources = verifiedSources;
        setActiveSources(mappedSources);

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
    // Capture optional preceding non-whitespace word + citation [1] + optional trailing punctuation so chip never wraps alone
    const parts = lineText.split(
      /(\$\$[^\$\n]+\$\$|\*\*[^*]+\*\*|(?:\S+[ \t]+)?\[\d+(?:,\s*\d+)*\][.,;:]?)/g
    );

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

      // Citation segment (with optional attached preceding word and trailing punctuation)
      const citeMatch = part.match(/^(?:(\S+)[ \t]+)?\[(\d+(?:,\s*\d+)*)\]([.,;:]?)$/);
      if (citeMatch) {
        const leadingWord = citeMatch[1] || '';
        const trailingPunct = citeMatch[3] || '';
        const ids = citeMatch[2]
          .split(',')
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n));
        const primarySource = turnSources.find((s) => s.id === ids[0]) || turnSources[0];
        if (!primarySource) {
          return (
            <React.Fragment key={`${lineKey}-t-${idx}`}>
              {leadingWord}
              {trailingPunct}
            </React.Fragment>
          );
        }

        const extraCount = ids.length > 1 ? ` +${ids.length - 1}` : '';
        const numberBadge = `[${ids.join(',')}]`;
        const anchorKey = `${lineKey}-c-${idx}`;
        const isHighlighted = ids.some((id) => hoveredSourceIds.includes(id));
        const isPreviewOpen = activeChipPreview?.anchorKey === anchorKey;

        return (
          <span key={anchorKey} className="inline whitespace-nowrap align-baseline">
            {leadingWord ? `${leadingWord}\u00A0` : ''}
            <a
              href={primarySource.url}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={(e) => {
                setHoveredSourceIds(ids);
                const rect = e.currentTarget.getBoundingClientRect();
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
              }}
              onMouseLeave={() => {
                setHoveredSourceIds([]);
                setActiveChipPreview(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setHoveredSourceIds(ids);
                const cardEl = document.getElementById(`dr-source-card-${primarySource.id}`);
                if (cardEl) {
                  cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
              }}
              aria-label={`Source ${primarySource.id}: ${primarySource.title}`}
              className={`inline-flex whitespace-nowrap items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium leading-tight transition-all cursor-pointer !no-underline align-baseline ${
                isHighlighted || isPreviewOpen
                  ? 'bg-[#FC4C01] text-white font-semibold ring-1 ring-[#FC4C01]'
                  : isDark
                  ? 'bg-white/[0.08] text-neutral-300 hover:bg-[#FC4C01]/20 hover:text-[#FC4C01]'
                  : 'bg-black/[0.06] text-neutral-700 hover:bg-[#FC4C01]/15 hover:text-[#FC4C01]'
              }`}
            >
              <span className="font-mono font-bold text-[10px] opacity-85">{numberBadge}</span>
              <span className="whitespace-nowrap">{primarySource.name}{extraCount}</span>
            </a>
            {trailingPunct}
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
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
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

                      {!isCurrentTurnSearching && !isCurrentTurnStreaming && (turn.durationSec || activeDurationSec) ? (
                        <span
                          data-testid="deep-research-elapsed-badge"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono tabular-nums border ${
                            isDark
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>
                            Completed in {turn.durationSec || activeDurationSec}s · {turnSources.length}{' '}
                            {turnSources.length === 1 ? 'source' : 'sources'}
                          </span>
                        </span>
                      ) : null}
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
                                id={`dr-source-card-${src.id}`}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onMouseEnter={() => setHoveredSourceIds([src.id])}
                                onMouseLeave={() => setHoveredSourceIds([])}
                                style={{ animationDelay: `${idx * 30}ms` }}
                                className={`w-36 sm:w-40 shrink-0 rounded-xl border p-2.5 flex flex-col justify-between gap-1.5 transition-all duration-150 animate-in fade-in slide-in-from-bottom-1 ${
                                  isCardHighlighted
                                    ? 'border-[#FC4C01] ring-2 ring-[#FC4C01]/35 bg-[#FC4C01]/10'
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

                          <button
                            type="button"
                            onClick={() =>
                              openZenoReportModal({
                                targetType: 'ai_answer',
                                targetId: turn.id,
                                contentPreview: turn.fullAnswer.slice(0, 280),
                              })
                            }
                            title="Report AI output"
                            aria-label="Report AI output"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                              isDark
                                ? 'border-white/[0.1] bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                                : 'border-black/[0.08] bg-black/[0.03] text-neutral-600 hover:text-black hover:bg-black/[0.06]'
                            }`}
                          >
                            <Flag className="w-2.5 h-2.5" />
                            <span>Report</span>
                          </button>
                        </div>
                      </div>

                      {turn.durationSec || activeDurationSec ? (
                        <div className="text-[11px] font-mono tabular-nums opacity-75">
                          Completed in {turn.durationSec || activeDurationSec}s · {turnSources.length}{' '}
                          {turnSources.length === 1 ? 'source' : 'sources'}
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
            <div className="shrink-0 p-3.5 sm:p-4 border-b border-current/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                    isDark
                      ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white'
                      : 'bg-black/[0.04] hover:bg-black/[0.08] border-black/10 text-black'
                  }`}
                  aria-label="Back to research"
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-semibold">History</h2>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isDark ? 'bg-white/10 text-neutral-300' : 'bg-black/10 text-neutral-700'
                    }`}
                  >
                    {historyList.length}
                  </span>
                </div>
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
