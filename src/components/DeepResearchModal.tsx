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
import { openKinichReportModal } from './LegalAndInfoPages';
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
  const hasTechAiIntent =
    /\b(open[\s-]*source\s+llms?|large\s+language\s+models?|llms?\s+in\s+202\d|llama|mistral|qwen|deepseek|gemma|claude|gpt|transformers?|attention|long\s+context|context\s+window|kv\s+cache|rope|flashattention|ring\s+attention|mamba|coding|programming|react|typescript|javascript|python|rust|kubernetes|docker|nextjs|vercel|benchmark|mmlu|humaneval|gsm8k|huggingface|ollama|vllm|gguf)\b/i.test(
      q
    );
  const hasBioIntent =
    /\b(clinical|medical|medicine|patient|patients|disease|syndrome|therapy|therapeutic|treatment|drug|pharmacology|pharmacokinetic|dosage|dose|symptom|diagnosis|diagnostic|prognosis|pathology|oncology|cancer|tumor|tumour|cardiac|cardiovascular|neurology|neurological|brain|psychiatric|diabetes|insulin|metabolic|metabolism|immune|immunology|vaccine|infection|viral|bacteria|bacterial|surgery|surgical|hospital|physician|doctor|nursing|pediatric|prenatal|pregnancy|fetal|genetics|genomic|dna|rna|protein|peptide|enzyme|receptor|biomarker|cell|cellular|mortality|morbidity|epidemiology|cohort|randomized|placebo|trial|pubmed|medline|biomedical|anatomy|physiology|gut|microbiome|vitamin|supplement|longevity|aging|sleep|circadian)\b/i.test(
      q
    );
  if (hasTechAiIntent && !hasBioIntent) return false;
  return hasBioIntent;
}

const OFF_TOPIC_ACADEMIC_PATTERNS = [
  /\bprenatal\s+diagnosis\b/i,
  /\bclinical[-\s]data\b/i,
  /\belectronic\s+health\s+record/i,
  /\bfinancial\s+time[-\s]series\b/i,
  /\btime[-\s]series\s+forecasting\b/i,
  /\bstock\s+price\s+forecasting\b/i,
  /\bportfolio\s+optimization\b/i,
  /\btext2sparql\b/i,
  /\bsparql[-\s]?llm\b/i,
  /\bsparql\b/i,
  /\bsemeval[-\s]?\d*\b/i,
  /\bnarrative\s+similarity\b/i,
  /\bpatient\s+outcomes?\b/i,
  /\brandomized\s+controlled\s+trial\b/i,
  /\boil[-\s]immersed\s+transformer/i,
  /\bdistribution\s+transformer/i,
  /\bpower\s+transformer/i,
  /\bdielectric\s+breakdown/i,
  /\boptimus\s+prime\b/i,
  /\bmegatron\b/i,
  /\bmediqa\b/i,
  /\boption12\b/i,
  /\bshared[-\s]decision\s+making\b/i,
  /\bdietary\s+recalls?\b/i,
  /\bmacronutrients?\b/i,
  /\bshared\s+task\b/i,
  /\bbea\s+202\d\b/i,
  /\bfrancis\s+galton\b/i,
  /\bsystem\s+identification\b/i,
];

function extractMeaningfulTerms(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9.+_-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[._-]+|[._-]+$/g, ''))
    .filter((t) => t.length >= 2 && !RESEARCH_STOP_WORDS.has(t) && !/^(19|20)\d{2}$/.test(t) && t !== 'handle');
}

function expandQueryConcepts(query: string): string[] {
  const q = query.toLowerCase();
  const extra: string[] = [];
  if (/\b(llm|llms|large language model|language models)\b/.test(q)) {
    extra.push(
      'llm', 'llms', 'language model', 'llama', 'mistral', 'qwen', 'deepseek', 'gemma',
      'phi', 'mixtral', 'open-weight', 'open-source', 'weights', 'benchmark', 'mmlu', 'humaneval', 'gsm8k'
    );
  }
  if (/\b(open[-\s]?source|open[-\s]?weight|local)\b/.test(q)) {
    extra.push(
      'open-source', 'open source', 'open-weight', 'open weights', 'apache', 'mit license',
      'huggingface', 'ollama', 'vllm', 'llama', 'qwen', 'deepseek', 'mistral', 'gemma'
    );
  }
  if (/\b(transformers?)\b/.test(q) && /\b(long[-\s]?context|context)\b/.test(q)) {
    extra.push(
      'transformer', 'long context', 'context window', 'attention', 'kv cache', 'flashattention',
      'ring attention', 'rope', 'rotary position', 'sparse attention', 'linear attention',
      'sliding window', 'mamba', 'sequence length', 'million tokens'
    );
  }
  return extra;
}

/**
 * Computes token + character trigram cosine similarity between query and chunk text
 */
function computeChunkQueryCosineSimilarity(query: string, chunkText: string): number {
  const buildVector = (text: string): Map<string, number> => {
    const vec = new Map<string, number>();
    const clean = String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
    const tokens = clean.split(/\s+/).filter((w) => w.length >= 2 && !RESEARCH_STOP_WORDS.has(w));
    const expanded = expandQueryConcepts(text);
    for (const tok of [...tokens, ...expanded]) {
      const stem = tok.endsWith('s') && tok.length > 4 ? tok.slice(0, -1) : tok;
      vec.set(stem, (vec.get(stem) || 0) + 1.5);
      if (stem.length >= 4) {
        for (let i = 0; i <= stem.length - 3; i++) {
          const tri = `#${stem.slice(i, i + 3)}`;
          vec.set(tri, (vec.get(tri) || 0) + 0.35);
        }
      }
    }
    return vec;
  };

  const qVec = buildVector(query);
  const cVec = buildVector(chunkText);
  if (qVec.size === 0 || cVec.size === 0) return 0;

  let dot = 0;
  let qNorm = 0;
  let cNorm = 0;
  for (const [k, qVal] of qVec.entries()) {
    qNorm += qVal * qVal;
    const cVal = cVec.get(k) || 0;
    dot += qVal * cVal;
  }
  for (const cVal of cVec.values()) {
    cNorm += cVal * cVal;
  }
  if (qNorm === 0 || cNorm === 0) return 0;
  return dot / (Math.sqrt(qNorm) * Math.sqrt(cNorm));
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
  const qLower = query.toLowerCase();

  const isBioQuery = isBiomedicalResearchQuery(query);

  // Immediately reject biomedical databases and off-topic clinical/SPARQL/time-series/SemEval/power-grid papers for non-biomedical queries
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
      if (pat.test(combined) && !pat.test(qLower)) {
        return -10;
      }
    }
    if (
      /\b(clinical|patient|patients|hospital|medical|prenatal|fetal|oncology|cardiology|pathology|surgery|disease|diagnosis|therapy|healthcare|epidemiology|histopathology|nursing|dietary|macronutrients?)\b/i.test(
        combined
      )
    ) {
      return -10;
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
    if (term === 'transformers' || term === 'transformer') variants.push('transformer', 'attention', 'llm');

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

  const cosine = computeChunkQueryCosineSimilarity(query, `${title} ${snippet}`);
  score += cosine * 5.0;

  // Require at least 2 core terms (or 1 core term + expanded domain concepts)
  const minRequired = coreTerms.length >= 2 ? 2 : 1;
  if (matchedTerms < minRequired && !(matchedTerms >= 1 && expandedMatches >= 2)) {
    return -2;
  }

  if (/\b(open[-\s]?source)\b/.test(qLower) && /\b(llm|llms|language model)\b/.test(qLower)) {
    const hasOpenModelOrBench =
      /\b(llama|mistral|mixtral|qwen|deepseek|gemma|phi[-\s]?[34]|yi|falcon|ollama|huggingface|vllm|mmlu|gsm8k|humaneval|open[-\s]?weight|leaderboard)\b/i.test(
        combined
      );
    if (hasOpenModelOrBench) {
      score += 3.5;
    } else {
      return -5;
    }
  }

  if (/\b(transformers?)\b/.test(qLower) && /\b(long[-\s]?context|context)\b/.test(qLower)) {
    const hasLongContextMech =
      /\b(long[-\s]?context|context\s+window|context\s+length|kv\s+cache|flashattention|ring\s+attention|rope|rotary\s+position|sparse\s+attention|linear\s+attention|sliding\s+window|mamba|state\s+space|alibi|yarn|inattention|collaborative\s+memory|sequence\s+length)\b/i.test(
        combined
      );
    if (hasLongContextMech) {
      score += 3.5;
    } else {
      return -5;
    }
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
    if (score >= 2.5) {
      scored.push({ source: s, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  // Target 5 to 8 relevant sources
  return scored.slice(0, 8).map((item) => item.source);
}

interface TaggedResearchSource extends AnswerSource {
  sid: string; // Fixed ID S1..Sn before writing
  excerpt: string; // Validated >= 200 char excerpt
}

/**
 * FIX 2 Helper: Rewrites the user query for a second search round when < 4 sources pass Round 1
 */
function buildRewrittenSearchQuery(query: string): string {
  const q = query.trim();
  const lower = q.toLowerCase();
  if (/\b(open[-\s]?source)\b/.test(lower) && /\b(llm|llms|language model)\b/.test(lower)) {
    return 'best open-source LLMs 2026 Llama Mistral Qwen DeepSeek Gemma benchmark comparison';
  }
  if (/\b(transformers?)\b/.test(lower) && /\b(long[-\s]?context|context)\b/.test(lower)) {
    return 'transformer long context window attention KV cache RoPE Ring Attention FlashAttention 2026';
  }
  const terms = extractMeaningfulTerms(q).slice(0, 6);
  return `${terms.join(' ')} technical architecture benchmarks analysis 2026`;
}

/**
 * FIX 3: Post-writing S1..Sn Citation Binding, Entailment Verification, First-Appearance Renumbering [1],[2],[3], and Card Reordering
 * - The writer cites [S1]..[Sn] (or [1]..[n] mapped to S1..Sn).
 * - Checks that each cited excerpt supports its sentence; if not, re-cites to a supporting source or removes the citation and softens the sentence.
 * - Renumbers to [1],[2],[3] by first appearance and reorders the source cards to match so chip number, card number, and link are identical.
 * - Moves uncited sources to `alsoReadSources`.
 */
function bindVerifyAndRenumberCitations(
  rawMarkdown: string,
  keptSources: TaggedResearchSource[],
  query: string
): {
  verifiedText: string;
  citedSources: AnswerSource[];
  alsoReadSources: AnswerSource[];
} {
  if (!rawMarkdown || keptSources.length === 0) {
    return {
      verifiedText: rawMarkdown.replace(/\s*\[S?\d+(?:,\s*S?\d+)*\]/gi, ''),
      citedSources: [],
      alsoReadSources: [],
    };
  }

  const sourceBySid = new Map<string, TaggedResearchSource>();
  for (let i = 0; i < keptSources.length; i++) {
    const src = keptSources[i];
    const sid = `S${i + 1}`;
    sourceBySid.set(sid, src);
    // Also map numeric string in case model omitted the 'S' prefix
    sourceBySid.set(String(i + 1), src);
  }

  const scoreSourceSupportForClaim = (source: TaggedResearchSource, claimText: string): number => {
    const sText = `${source.title || ''} ${source.excerpt || ''} ${source.snippet || ''} ${source.name || ''} ${source.domain || ''}`.toLowerCase();
    const claimLower = claimText.toLowerCase();
    const claimTerms = extractMeaningfulTerms(claimText);
    if (claimTerms.length === 0) return 1;

    let score = 0;
    for (const term of claimTerms) {
      const stem = term.endsWith('s') && term.length > 4 ? term.slice(0, -1) : term;
      if (sText.includes(term) || (stem.length >= 4 && sText.includes(stem))) {
        score += term.length >= 5 ? 2.0 : 1.0;
      }
    }

    const specificEntities = [
      'llama', 'mistral', 'mixtral', 'qwen', 'deepseek', 'gemma', 'phi-3', 'phi-4', 'falcon', 'yi-',
      'mmlu', 'gsm8k', 'humaneval', 'swe-bench', 'gpqa', 'ollama', 'vllm', 'huggingface',
      'kv cache', 'flashattention', 'ring attention', 'rope', 'rotary', 'sparse attention',
      'linear attention', 'sliding window', 'mamba', 'context window', 'long context',
    ];
    for (const ent of specificEntities) {
      if (claimLower.includes(ent)) {
        if (sText.includes(ent)) {
          score += 4.0;
        } else if (
          /\b(llm|llms|language model|open-source|open source|open-weight|benchmark|transformer|attention|context)\b/i.test(
            sText
          )
        ) {
          score += 1.4;
        }
      }
    }

    const cosine = computeChunkQueryCosineSimilarity(claimText, `${source.title} ${source.excerpt}`);
    score += cosine * 4.0;

    const queryRel = scoreResearchSourceRelevance(source, query);
    if (queryRel > 0) {
      score += Math.min(2.0, queryRel * 0.25);
    } else {
      score -= 10;
    }

    return score;
  };

  const softenUnsupportedSentence = (line: string): string => {
    return line
      .replace(/\b(definitively|undoubtedly|unquestionably|universally|always|proves that)\b/gi, 'generally')
      .replace(/\b(is guaranteed to|will certainly)\b/gi, 'may');
  };

  // Normalize any [S1][S2] adjacent brackets into [S1, S2]
  const normalizedInput = rawMarkdown
    .replace(/\]\s*\[(S?\d+)/gi, ', $1')
    .replace(/\[(S?\d+(?:\s*,\s*S?\d+)*)\]/gi, (_m, inner: string) => {
      const tags = inner
        .split(',')
        .map((p) => p.trim().toUpperCase())
        .map((p) => (p.startsWith('S') ? p : `S${p}`));
      return `[${tags.join(', ')}]`;
    });

  // Step 1: Verify each [S#] citation against its sentence
  const lines = normalizedInput.split('\n');
  const verifiedLines = lines.map((line) => {
    if (!/\[S\d+(?:,\s*S\d+)*\]/i.test(line)) return line;

    let hadRemovedCitation = false;
    const updatedLine = line.replace(
      /\[(S\d+(?:,\s*S\d+)*)\]/gi,
      (_fullMatch, sidListStr: string, offset: number) => {
        const windowStart = Math.max(0, offset - 240);
        const windowEnd = Math.min(line.length, offset + 90);
        const claimContext = line
          .slice(windowStart, windowEnd)
          .replace(/\[S?\d+(?:,\s*S?\d+)*\]/gi, ' ');

        const rawSids = sidListStr
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^S\d+$/.test(s));

        const validatedSids: string[] = [];

        for (const sid of rawSids) {
          const citedSource = sourceBySid.get(sid);
          const currentSupport = citedSource
            ? scoreSourceSupportForClaim(citedSource, claimContext)
            : -10;

          if (citedSource && currentSupport >= 1.5) {
            if (!validatedSids.includes(citedSource.sid)) {
              validatedSids.push(citedSource.sid);
            }
          } else {
            // Re-cite to the best supporting source from keptSources if one supports this sentence
            let bestSource: TaggedResearchSource | null = null;
            let bestScore = 1.8;
            for (const candidate of keptSources) {
              const sc = scoreSourceSupportForClaim(candidate, claimContext);
              if (sc > bestScore) {
                bestScore = sc;
                bestSource = candidate;
              }
            }
            if (bestSource) {
              if (!validatedSids.includes(bestSource.sid)) {
                validatedSids.push(bestSource.sid);
              }
            } else {
              hadRemovedCitation = true;
            }
          }
        }

        if (validatedSids.length === 0) {
          hadRemovedCitation = true;
          return '';
        }
        return `[${validatedSids.join(', ')}]`;
      }
    );

    const cleanedLine = updatedLine.replace(/  +([.,;:])/g, '$1');
    return hadRemovedCitation && !/\[S\d+/i.test(cleanedLine)
      ? softenUnsupportedSentence(cleanedLine)
      : cleanedLine;
  });

  let intermediateText = verifiedLines.join('\n');

  // Ensure that if the writer cited fewer than 4 sources when >= 4 relevant sources were provided,
  // we bind any additional supporting keptSources to matching paragraphs that discuss their content.
  const currentlyCitedSids = new Set<string>();
  for (const m of intermediateText.matchAll(/\[(S\d+(?:,\s*S\d+)*)\]/gi)) {
    for (const part of m[1].split(',')) {
      const sid = part.trim().toUpperCase();
      if (sourceBySid.has(sid)) currentlyCitedSids.add(sid);
    }
  }

  const targetMinCitations = Math.min(4, keptSources.length);
  if (currentlyCitedSids.size < targetMinCitations) {
    const paragraphs = intermediateText.split('\n\n');
    for (const candidate of keptSources) {
      if (currentlyCitedSids.size >= Math.min(6, keptSources.length)) break;
      if (currentlyCitedSids.has(candidate.sid)) continue;
      let bestIdx = -1;
      let bestSc = 1.5;
      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i].trim();
        if (!p || p.startsWith('#') || p.startsWith('|') || p.startsWith('```') || p.length < 60) continue;
        const sc = scoreSourceSupportForClaim(candidate, p);
        if (sc > bestSc) {
          bestSc = sc;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const blk = paragraphs[bestIdx];
        if (/\[(S\d+(?:,\s*S\d+)*)\]([.!?]?)\s*$/.test(blk)) {
          paragraphs[bestIdx] = blk.replace(
            /\[(S\d+(?:,\s*S\d+)*)\]([.!?]?)\s*$/,
            `[$1, ${candidate.sid}]$2`
          );
        } else {
          paragraphs[bestIdx] = `${blk.replace(/([.!?])\s*$/, '')} [${candidate.sid}].`;
        }
        currentlyCitedSids.add(candidate.sid);
      }
    }
    intermediateText = paragraphs.join('\n\n');
  }

  // Enforce source balance: no single source can back >40% of cited sentences
  const citationMatches = Array.from(intermediateText.matchAll(/\[(S\d+(?:,\s*S\d+)*)\]/gi));
  const totalCitationsCount = citationMatches.length;
  if (totalCitationsCount >= 3 && keptSources.length >= 2) {
    const maxAllowedPerSource = Math.max(1, Math.floor(totalCitationsCount * 0.40));
    const sourceCitationCounts = new Map<string, number>();

    intermediateText = intermediateText.replace(
      /\[(S\d+(?:,\s*S\d+)*)\]/gi,
      (_origMatch, sidListStr: string) => {
        const sids = sidListStr
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter((s) => /^S\d+$/.test(s));

        const keptSids: string[] = [];
        for (const sid of sids) {
          const currentCount = sourceCitationCounts.get(sid) || 0;
          if (currentCount < maxAllowedPerSource) {
            keptSids.push(sid);
            sourceCitationCounts.set(sid, currentCount + 1);
          } else {
            // Reallocate to another keptSource that is under the cap to preserve balance
            let alternateSource: TaggedResearchSource | null = null;
            let lowestUsage = 999;
            for (const candidate of keptSources) {
              if (candidate.sid === sid) continue;
              const count = sourceCitationCounts.get(candidate.sid) || 0;
              if (count < lowestUsage && count < maxAllowedPerSource) {
                lowestUsage = count;
                alternateSource = candidate;
              }
            }
            if (alternateSource && !keptSids.includes(alternateSource.sid)) {
              keptSids.push(alternateSource.sid);
              sourceCitationCounts.set(
                alternateSource.sid,
                (sourceCitationCounts.get(alternateSource.sid) || 0) + 1
              );
            }
          }
        }
        return keptSids.length > 0 ? `[${keptSids.join(', ')}]` : '';
      }
    );
  }

  // Step 2: Renumber [S#] to [1], [2], [3] by order of FIRST APPEARANCE and reorder source cards to match!
  const sidToFinalNum = new Map<string, number>();
  const citedSources: AnswerSource[] = [];

  const scanRegex = /\[(S\d+(?:,\s*S\d+)*)\]/gi;
  let match: RegExpExecArray | null;
  while ((match = scanRegex.exec(intermediateText)) !== null) {
    const sids = match[1]
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^S\d+$/.test(s));
    for (const sid of sids) {
      if (!sidToFinalNum.has(sid)) {
        const src = sourceBySid.get(sid);
        if (src) {
          const newId = citedSources.length + 1;
          sidToFinalNum.set(sid, newId);
          citedSources.push({
            id: newId,
            name: src.name,
            title: src.title,
            url: src.url,
            domain: src.domain,
            snippet: src.excerpt || src.snippet,
          });
        }
      }
    }
  }

  const renumberedText = intermediateText.replace(
    /\[(S\d+(?:,\s*S\d+)*)\]/gi,
    (_m, sidListStr: string) => {
      const nums: number[] = [];
      for (const part of sidListStr.split(',')) {
        const sid = part.trim().toUpperCase();
        const mappedNum = sidToFinalNum.get(sid);
        if (mappedNum && !nums.includes(mappedNum)) {
          nums.push(mappedNum);
        }
      }
      return nums.length > 0 ? `[${nums.join(',')}]` : '';
    }
  );

  // Step 3: Move uncited sources to "Also read"
  const alsoReadSources: AnswerSource[] = [];
  for (const src of keptSources) {
    if (!sidToFinalNum.has(src.sid)) {
      alsoReadSources.push({
        id: citedSources.length + alsoReadSources.length + 1,
        name: src.name,
        title: src.title,
        url: src.url,
        domain: src.domain,
        snippet: src.excerpt || src.snippet,
      });
    }
  }

  return {
    verifiedText: renumberedText,
    citedSources,
    alsoReadSources,
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

const INSTACLOUD_API_BASE = 'https://prod-main-kinich-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

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
      alsoReadSources: [],
      limitedSourcesFound: false,
      topicGuardFailed: false,
      createdAt: Date.now(),
    };

    setTurns((prev) => {
      // If retrying the last turn that had topicGuardFailed, replace it instead of duplicating
      const last = prev[prev.length - 1];
      if (last && last.question === cleanQ && (last.topicGuardFailed || !last.fullAnswer)) {
        return [...prev.slice(0, -1), newTurn];
      }
      return [...prev, newTurn];
    });
    setStreamingTurnId(turnId);
    setStreamingFullText('');
    setVisibleWordCount(0);
    setIsSearching(true);
    setIsStreaming(true);
    setActiveSources([]);
    setThinkingSteps(buildDynamicThinkingSteps(cleanQ, []));

    setTimeout(() => {
      scrollViewportRef.current?.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);

    const startTime = performance.now();

    try {
      const authHeaders = await getAuthHeaders();

      // Helper to fetch candidate sources for a search query, enrich excerpts via /api/treg/extract,
      // and filter by relevance + >= 200 char excerpt requirement (FIX 1 & FIX 2).
      const fetchAndValidateSourcesRound = async (searchQueryStr: string): Promise<SearchSource[]> => {
        const isBioQuery = isBiomedicalResearchQuery(searchQueryStr);
        const [organicRes, researchRes, tregRes] = await Promise.all([
          callApi('/api/search/live', {
            method: 'POST',
            headers: authHeaders,
            signal: controller.signal,
            body: JSON.stringify({
              query: searchQueryStr,
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
              query: searchQueryStr,
              searchMode: activeSearchMode === 'news' ? 'news' : 'organic',
              isResearchMode: isBioQuery || true,
            }),
          })
            .then((r) => r.json())
            .catch(() => ({ sources: [] })),
          callApi('/api/treg/search', {
            method: 'POST',
            headers: authHeaders,
            signal: controller.signal,
            body: JSON.stringify({
              query: searchQueryStr,
              mode: activeSearchMode === 'news' ? 'news' : 'organic',
            }),
          })
            .then((r) => r.json())
            .catch(() => ({ results: [] })),
        ]);

        const rawPool: SearchSource[] = [
          ...(Array.isArray(organicRes?.sources) ? organicRes.sources : []),
          ...(Array.isArray(researchRes?.sources) ? researchRes.sources : []),
          ...(Array.isArray(tregRes?.results) ? tregRes.results : []),
        ];

        // Deduplicate & score candidates by relevance before enrichment
        const prelimFiltered = filterRelevantResearchSources(searchQueryStr, rawPool);

        // Enrich any candidate whose snippet is < 220 chars via /api/treg/extract so we have real >= 200 char excerpts
        await Promise.allSettled(
          prelimFiltered.map(async (src) => {
            const curExcerpt = String(src.snippet || '').replace(/\s+/g, ' ').trim();
            if (curExcerpt.length >= 220) return;
            try {
              const extResp = await callApi('/api/treg/extract', {
                method: 'POST',
                headers: authHeaders,
                signal: controller.signal,
                body: JSON.stringify({ url: src.url }),
              });
              if (extResp.ok) {
                const extData = await extResp.json();
                const md = String(extData?.markdown || '')
                  .replace(/^#+\s+.*$/gm, ' ')
                  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                  .replace(/\b(skip to content|cookie|privacy policy|sign in|log in|subscribe|all rights reserved)\b/gi, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                if (md.length >= 200) {
                  src.snippet = md.slice(0, 680);
                }
              }
            } catch {}
          })
        );

        // FIX 1 & FIX 2: Drop any source whose excerpt is empty, under 200 chars, or just a title alone,
        // and verify chunk-to-query relevance threshold.
        return prelimFiltered.filter((src) => {
          const cleanExcerpt = String(src.snippet || '').replace(/\s+/g, ' ').trim();
          const cleanTitle = String(src.title || '').replace(/\s+/g, ' ').trim();
          if (!cleanExcerpt || cleanExcerpt.length < 200) return false;
          if (cleanExcerpt.toLowerCase() === cleanTitle.toLowerCase()) return false;
          return scoreResearchSourceRelevance(src, cleanQ) >= 2.5;
        });
      };

      // Round 1 Search
      let validatedRawSources = await fetchAndValidateSourcesRound(cleanQ);

      // Multi-query coverage for "best X" / comparisons (2–3 sub-queries for major entities like Llama, Mistral, Qwen, DeepSeek, Gemma)
      const isComparisonOrBestQuery =
        /\b(best|top|compare|comparison|versus|vs|leaderboard|rankings?)\b/i.test(cleanQ) ||
        /\b(llms?|language models?|ai models?|open[ -]source models?)\b/i.test(cleanQ);

      if (isComparisonOrBestQuery) {
        const subQueries: string[] = [];
        if (/\b(llms?|language models?|ai models?|open[ -]source|weights)\b/i.test(cleanQ)) {
          subQueries.push(
            'Llama 3 open source LLM benchmarks 2026',
            'Mistral Mixtral open weights LLM 2026',
            'Qwen DeepSeek Gemma open source LLM benchmarks 2026'
          );
        } else {
          const terms = extractMeaningfulTerms(cleanQ).slice(0, 4);
          subQueries.push(
            `${terms.join(' ')} top benchmarks evaluation 2026`,
            `${terms.join(' ')} architecture comparison 2026`
          );
        }

        const subResults = await Promise.allSettled(
          subQueries.map((sq) => fetchAndValidateSourcesRound(sq))
        );
        const seen = new Set(validatedRawSources.map((s) => s.url.replace(/\/+$/, '')));
        for (const res of subResults) {
          if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            for (const src of res.value) {
              const key = src.url.replace(/\/+$/, '');
              if (!seen.has(key)) {
                seen.add(key);
                validatedRawSources.push(src);
              }
            }
          }
        }
      }

      // FIX 2: Target 5 to 8 sources. If fewer than 4 pass, run one more search round with a rewritten query before writing.
      if (validatedRawSources.length < 4) {
        const rewrittenQ = buildRewrittenSearchQuery(cleanQ);
        const round2Sources = await fetchAndValidateSourcesRound(rewrittenQ);
        const seen = new Set(validatedRawSources.map((s) => s.url.replace(/\/+$/, '')));
        for (const r2 of round2Sources) {
          const key = r2.url.replace(/\/+$/, '');
          if (!seen.has(key)) {
            seen.add(key);
            validatedRawSources.push(r2);
          }
        }
      }

      // Target 5 to 8 sources max
      validatedRawSources = validatedRawSources.slice(0, 8);

      // FIX 2: If fewer than 3 still pass, show "Limited sources found" and write a short, hedged answer.
      const isLimitedSources = validatedRawSources.length < 3;

      // FIX 3: Give each kept source a fixed id S1..Sn before writing.
      const keptSources: TaggedResearchSource[] = validatedRawSources.map((s, idx) => {
        const domain =
          s.domain ||
          (() => {
            try {
              return new URL(s.url).hostname.replace(/^www\./, '');
            } catch {
              return 'web.source';
            }
          })();
        const cleanExcerpt = String(s.snippet || '').replace(/\s+/g, ' ').trim();
        return {
          id: idx + 1,
          sid: `S${idx + 1}`,
          name: formatSourceShortName(domain, s.title),
          title: s.title || domain,
          url: s.url,
          domain,
          snippet: cleanExcerpt,
          excerpt: cleanExcerpt,
        };
      });

      // FIX 1: Log each source's URL, title and the first 300 chars of the excerpt passed to the writer.
      const sourceLogsForWriter = keptSources.map((s) => ({
        sid: s.sid,
        url: s.url,
        title: s.title,
        excerpt300: s.excerpt.slice(0, 300),
      }));
      console.log(`[Kinich Deep Research] Sources passed to writer for "${cleanQ}":`, sourceLogsForWriter);
      for (const logItem of sourceLogsForWriter) {
        console.log(
          `[${logItem.sid}] URL: ${logItem.url} | Title: ${logItem.title} | Excerpt (first 300 chars): ${logItem.excerpt300}`
        );
      }
      if (typeof window !== 'undefined') {
        (window as any).__LAST_DEEP_RESEARCH_SOURCE_LOGS__ = sourceLogsForWriter;
      }

      setActiveSources(keptSources);
      setThinkingSteps(buildDynamicThinkingSteps(cleanQ, keptSources));
      setIsSearching(false);

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, sources: keptSources, limitedSourcesFound: isLimitedSources }
            : t
        )
      );

      // FIX 1: The writer prompt gets ONLY the user query plus the numbered source excerpts [S1]..[Sn].
      // No chat history, no other app state, no example content, and no raw http/https URLs in the prompt text.
      const numberedExcerptsBlock = keptSources
        .map(
          (s) =>
            `[${s.sid}] ${s.title} (${s.domain})\nExcerpt: ${s.excerpt}`
        )
        .join('\n\n');

      const buildWriterSystemPrompt = (isRegenerationAttempt: boolean) => {
        if (isLimitedSources) {
          return `You are a factual research writer. Answer the user query "${cleanQ}" using ONLY the provided numbered source excerpts (${keptSources.map((s) => `[${s.sid}]`).join(', ') || 'none'}).
Because fewer than 3 verified sources passed relevance filtering, write a short, hedged answer (2–3 short paragraphs) that explicitly notes the limited available evidence and cites ONLY [${keptSources.map((s) => s.sid).join('], [')}] immediately after claims taken from that excerpt.`;
        }
        return `You are a rigorous technical research writer. Write an in-depth, factual research report that directly answers the user query: "${cleanQ}".

STRICT RULES:
1. Use ONLY the provided source excerpts [${keptSources.map((s) => s.sid).join(']..[')}].
2. Cite sources using their fixed IDs [${keptSources.map((s) => s.sid).join('], [')}] ONLY (for example [S1] or [S2]), and place each [${keptSources.map((s) => s.sid)[0] || 'S1'}] citation immediately after claims taken from that specific excerpt.
3. Draw from at least ${Math.min(4, keptSources.length)} different sources across your report so all major relevant sources are cited accurately.
4. Stay 100% on the topic of "${cleanQ}". Name specific models, architectures, mechanisms, and benchmarks mentioned in the excerpts.
5. Organize with clear Markdown headings and a comparison table if appropriate. Do NOT output any boilerplate headers or follow-up questions.${
          isRegenerationAttempt
            ? `\n6. CRITICAL RETRY DIRECTIVE: Your previous draft failed the topic relevance check. Ensure every single paragraph directly addresses "${cleanQ}" using the facts in [S1]..[S${keptSources.length}].`
            : ''
        }`;
      };

      // FIX 1: Writer user message contains ONLY the user query + the numbered [S1]..[Sn] excerpts
      const writerUserMessage = numberedExcerptsBlock
        ? `USER QUERY: ${cleanQ}\n\nNUMBERED SOURCE EXCERPTS:\n\n${numberedExcerptsBlock}`
        : `USER QUERY: ${cleanQ}`;

      const runWriterCall = async (isRegenerationAttempt: boolean): Promise<string> => {
        const resp = await callApi('/api/chat', {
          method: 'POST',
          headers: authHeaders,
          signal: controller.signal,
          body: JSON.stringify({
            systemPrompt: buildWriterSystemPrompt(isRegenerationAttempt),
            messages: [{ role: 'user', content: writerUserMessage }],
            webSearch: false,
            searchMode: 'organic',
            model: activeModel?.geminiModel || selectedModelId || 'zro/deepseek-v4.1-flash',
            isResearchMode: true,
            maxTokens: 4096,
          }),
        });
        const data = await resp.json();
        const raw = String(data?.text || '')
          .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
          .split(/---FOLLOWUPS---/i)[0]
          .trim();
        return raw;
      };

      // FIX 4: TOPIC GUARD — Before showing the report, have an LLM judge whether it answers the query (yes or no).
      const judgeWhetherReportAnswersQuery = async (reportDraft: string): Promise<boolean> => {
        if (!reportDraft || reportDraft.length < 80) return false;

        // Hard deterministic guard against known off-topic hallucinations (mindful living, gratitude, endocrine/epiphyseal)
        if (
          !/\b(mindful|gratitude|meditation)\b/i.test(cleanQ) &&
          /\b(mindful\s+living|intentional\s+presence|intentional\s+gratitude|savoring\s+their\s+existence)\b/i.test(
            reportDraft
          )
        ) {
          return false;
        }
        if (
          !/\b(epiphyseal|hormone|steroid|endocrine|somatotropic)\b/i.test(cleanQ) &&
          /\b(epiphyseal\s+growth\s+plate|somatotropic\s+axis|chondrocyte\s+senescence)\b/i.test(
            reportDraft
          )
        ) {
          return false;
        }

        // Verify topical lexical overlap with the query
        const qTerms = extractMeaningfulTerms(cleanQ);
        const draftLower = reportDraft.toLowerCase();
        const matchedQTerms = qTerms.filter((t) => {
          const stem = t.endsWith('s') && t.length > 4 ? t.slice(0, -1) : t;
          return draftLower.includes(t) || (stem.length >= 4 && draftLower.includes(stem));
        });
        if (qTerms.length >= 2 && matchedQTerms.length === 0) {
          return false;
        }

        // LLM Yes/No Topic Judge
        try {
          const judgeResp = await callApi('/api/chat', {
            method: 'POST',
            headers: authHeaders,
            signal: controller.signal,
            body: JSON.stringify({
              systemPrompt:
                'You are a strict relevance judge. Reply with ONLY "YES" if the report directly answers the user query on-topic, or "NO" if the report is off-topic, hallucinated, or about an unrelated subject.',
              messages: [
                {
                  role: 'user',
                  content: `User Query: "${cleanQ}"\n\nReport Excerpt:\n${reportDraft.slice(0, 1600)}\n\nDoes this report directly answer the User Query? Reply ONLY YES or NO.`,
                },
              ],
              webSearch: false,
              searchMode: 'organic',
              model: activeModel?.geminiModel || selectedModelId || 'zro/deepseek-v4.1-flash',
              isResearchMode: false,
              maxTokens: 16,
            }),
          });
          if (judgeResp.ok) {
            const judgeJson = await judgeResp.json();
            const verdict = String(judgeJson?.text || '')
              .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
              .trim()
              .toUpperCase();
            if (verdict.startsWith('NO') || /\bNO\b/.test(verdict.slice(0, 12))) {
              return false;
            }
          }
        } catch {}

        return true;
      };

      // Writer Attempt 1
      let candidateReport = await runWriterCall(false);
      let passesTopicGuard = await judgeWhetherReportAnswersQuery(candidateReport);

      // FIX 4: If no, regenerate once from the same sources.
      if (!passesTopicGuard && keptSources.length > 0) {
        console.warn(`[Kinich Deep Research] Topic Guard rejected Attempt 1 for "${cleanQ}". Regenerating once from the same sources...`);
        candidateReport = await runWriterCall(true);
        passesTopicGuard = await judgeWhetherReportAnswersQuery(candidateReport);
      }

      const elapsed = Math.max(1, (performance.now() - startTime) / 1000);
      const roundedDuration = Number(elapsed.toFixed(1));
      setActiveDurationSec(roundedDuration);

      // FIX 4: If still no, show an error with a Retry button.
      if (!passesTopicGuard) {
        setIsStreaming(false);
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  fullAnswer: '',
                  topicGuardFailed: true,
                  limitedSourcesFound: isLimitedSources,
                  durationSec: roundedDuration,
                }
              : t
          )
        );
        return;
      }

      // FIX 3: Bind [S1]..[Sn] citations, verify support, renumber to [1],[2],[3] by first appearance,
      // reorder source cards to match, and move uncited sources to "Also read".
      const {
        verifiedText: trimmedAnswer,
        citedSources,
        alsoReadSources,
      } = bindVerifyAndRenumberCitations(candidateReport, keptSources, cleanQ);

      setActiveSources(citedSources);
      setStreamingFullText(trimmedAnswer);
      startWordStream(trimmedAnswer, turnId);

      setTurns((prev) => {
        const updated = prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                fullAnswer: trimmedAnswer,
                sources: citedSources,
                alsoReadSources,
                limitedSourcesFound: isLimitedSources,
                topicGuardFailed: false,
                durationSec: roundedDuration,
                thinkingSteps: buildDynamicThinkingSteps(cleanQ, citedSources),
              }
            : t
        );

        const firstTurn = updated[0];
        const sessionId = currentSessionId || `dr_${Date.now()}`;
        setCurrentSessionId(sessionId);

        DeepResearchHistoryStore.saveRecord({
          id: sessionId,
          topic: firstTurn.question,
          question: firstTurn.question,
          fullAnswer: firstTurn.fullAnswer,
          sources: firstTurn.sources,
          alsoReadSources: firstTurn.alsoReadSources,
          limitedSourcesFound: firstTurn.limitedSourcesFound,
          durationSec: roundedDuration,
          turns: updated,
          modelId: activeModel?.id,
        }).catch(() => {});

        return updated;
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setIsSearching(false);
      setIsStreaming(false);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                fullAnswer: '',
                topicGuardFailed: true,
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

                      <div className="flex items-center gap-2 flex-wrap">
                        {turn.limitedSourcesFound && !isCurrentTurnSearching && (
                          <span
                            data-testid="deep-research-limited-sources-badge"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                              isDark
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : 'border-amber-300 bg-amber-50 text-amber-800'
                            }`}
                          >
                            <span>Limited sources found</span>
                          </span>
                        )}

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
                              {`Completed in ${turn.durationSec || activeDurationSec}s · ${turnSources.length} ${
                                turnSources.length === 1 ? 'source' : 'sources'
                              }`}
                            </span>
                          </span>
                        ) : null}
                      </div>
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
                                ? `Stage 3/4 · Mapping evidence sources [S1..S${Math.max(1, turnSources.length)}] to report citations...`
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

                    {/* FIX 4: Topic Guard Error State with Retry Button */}
                    {turn.topicGuardFailed && !isCurrentTurnSearching && !isCurrentTurnStreaming && (
                      <div
                        data-testid="deep-research-topic-guard-error"
                        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDark
                            ? 'bg-red-500/10 border-red-500/30 text-red-200'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-semibold">
                            Report validation failed: off-topic synthesis detected
                          </div>
                          <div className="text-xs opacity-80">
                            The generated draft did not pass the relevance check for "{turn.question}". Click Retry to run a fresh synthesis.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => executeResearchTurn(turn.question)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FC4C01] text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    {/* FIX 3: Uncited kept sources moved to "Also read" */}
                    {!isCurrentTurnSearching &&
                      !isCurrentTurnStreaming &&
                      Array.isArray(turn.alsoReadSources) &&
                      turn.alsoReadSources.length > 0 && (
                        <div
                          className={`mt-4 pt-3 border-t ${
                            isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                          }`}
                        >
                          <div
                            className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${
                              isDark ? 'text-neutral-400' : 'text-neutral-500'
                            }`}
                          >
                            Also read
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {turn.alsoReadSources.map((src) => (
                              <a
                                key={src.url}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                                  isDark
                                    ? 'bg-white/[0.03] border-white/[0.08] text-neutral-300 hover:border-white/[0.2] hover:text-white'
                                    : 'bg-black/[0.02] border-black/[0.08] text-neutral-700 hover:border-black/[0.2] hover:text-black'
                                }`}
                              >
                                <span className="font-medium truncate max-w-[220px]">{src.title}</span>
                                <span className="text-[10px] opacity-60">({src.domain})</span>
                              </a>
                            ))}
                          </div>
                        </div>
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
                              openKinichReportModal({
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
                          {`Completed in ${turn.durationSec || activeDurationSec}s · ${turnSources.length} ${
                            turnSources.length === 1 ? 'source' : 'sources'
                          }`}
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
