import crypto from 'crypto';
import type { Router, Request, Response } from 'express';
import { sendNormalizedError } from './config';

export type DiscoverCategory =
  | 'Learning'
  | 'Research'
  | 'Science'
  | 'Technology'
  | 'Programming'
  | 'Writing'
  | 'Productivity'
  | 'Study Resources';

export const VALID_DISCOVER_CATEGORIES: DiscoverCategory[] = [
  'Learning',
  'Research',
  'Science',
  'Technology',
  'Programming',
  'Writing',
  'Productivity',
  'Study Resources',
];

export const VALID_OUTPUT_TYPES = [
  'explanation',
  'research_summary',
  'study_guide',
  'document_summary',
  'structured_notes',
  'workflow',
] as const;

export type ArtifactOutputType = (typeof VALID_OUTPUT_TYPES)[number];

export const VALID_GROWTH_EVENTS = [
  'signup_completed',
  'first_core_action_completed',
  'knowledge_item_saved',
  'share_card_created',
  'share_action_initiated',
  'public_artifact_created',
  'public_artifact_opened',
  'discover_resource_opened',
  'referral_link_created',
  'referral_visit_recorded',
  'referral_signup_validated',
  'weekly_report_viewed',
  'returning_session_started',
] as const;

export type GrowthAnalyticsEventName = (typeof VALID_GROWTH_EVENTS)[number];

export interface ServerPublicArtifact {
  id: string;
  ownerId: string;
  authorName: string;
  authorUsername?: string;
  authorBio?: string;
  showAuthorAttribution: boolean;
  title: string;
  summary: string;
  content: string;
  category: DiscoverCategory;
  tags: string[];
  visibility: 'public' | 'private';
  outputType: ArtifactOutputType;
  sources?: Array<{
    position: number;
    title: string;
    url: string;
    snippet: string;
    domain?: string;
  }>;
  createdAt: number;
  updatedAt: number;
  viewsCount: number;
  savesCount: number;
  forksCount: number;
}

export interface ServerCreatorProfile {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  isPublic: boolean;
  featuredArtifactIds: string[];
  updatedAt: number;
}

export interface ServerModerationReport {
  id: string;
  artifactId: string;
  reporterUid: string;
  reason: string;
  details: string;
  createdAt: number;
  status: 'open' | 'reviewed';
}

export interface ServerReferralRecord {
  referralCode: string;
  referrerUid: string;
  visitsCount: number;
  visitorKeys: Set<string>;
  validatedSignupsCount: number;
  qualifiedActionsCount: number;
  referredUids: Set<string>;
  unlockedThemes: string[];
  createdAt: number;
}

const ATTRIBUTION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// ============================================================================
// SANITIZATION & VALIDATION HELPERS
// ============================================================================

export function sanitizePlainString(input: unknown, maxLength = 300): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizePublicMarkdown(input: unknown, maxLength = 32000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:javascript|vbscript|data:text\/html)\s*:/gi, 'blocked:')
    .trim()
    .slice(0, maxLength);
}

export function isValidSafeId(id: unknown, maxLen = 96): id is string {
  return (
    typeof id === 'string' &&
    id.length >= 2 &&
    id.length <= maxLen &&
    /^[a-zA-Z0-9_-]+$/.test(id)
  );
}

export function escapeHtmlEntities(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// SEEDED CURATED DISCOVER LIBRARY (REAL EDUCATIONAL & RESEARCH GUIDES)
// ============================================================================

const SEEDED_ARTIFACTS: ServerPublicArtifact[] = [
  {
    id: 'art_transformer_attention_guide',
    ownerId: 'zeno_editorial',
    authorName: 'Zeno Research Team',
    authorUsername: 'zeno_research',
    authorBio: 'Curated reference synthesis and study guides built with Zeno.',
    showAuthorAttribution: true,
    title: 'Scaled Dot-Product & Multi-Head Attention: Mathematical Study Guide',
    summary:
      'Step-by-step derivation of Query-Key-Value projections, variance scaling by 1/√d_k, causal masking, and KV-cache memory complexity in modern Transformer decoders.',
    content: `## 1. Core Intuition of Self-Attention

Instead of processing tokens sequentially through recurrent hidden states $h_t = f(h_{t-1}, x_t)$, self-attention computes direct pairwise interactions between every token position in parallel:

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

### Why scale by $\\frac{1}{\\sqrt{d_k}}$?
When the key dimension $d_k$ is large, the dot products $q \\cdot k$ grow in variance ($\\text{Var}(q \\cdot k) = d_k$ for unit-variance inputs), pushing the softmax into regions with vanishingly small gradients. Dividing by $\\sqrt{d_k}$ restores unit variance prior to softmax normalization.

## 2. Multi-Head Projection Subspaces
Rather than computing a single attention distribution, Multi-Head Attention projects queries, keys, and values $h$ times with learned matrices $W_i^Q, W_i^K, W_i^V$:

- Allows simultaneous tracking of syntactic dependencies, coreference resolution, and long-range semantic context.
- Total FLOPs remain comparable to single-head attention when $d_k = d_{\\text{model}} / h$.

## 3. Inference KV-Cache Memory Formula
During autoregressive generation of sequence length $S$ with batch size $B$, layers $L$, key heads $H_{kv}$, head dimension $d_h$, and 2 bytes per parameter (FP16/BF16):

$$\\text{KV Cache Bytes} = 2 \\times 2 \\times L \\times H_{kv} \\times d_h \\times S \\times B$$

Grouped-Query Attention (GQA) reduces $H_{kv}$ by sharing key/value heads across query groups, cutting memory bandwidth bottlenecks by 4x–8x.`,
    category: 'Science',
    tags: ['transformers', 'attention', 'deep-learning', 'arxiv-1706.03762', 'linear-algebra'],
    visibility: 'public',
    outputType: 'study_guide',
    sources: [
      {
        position: 1,
        title: 'Attention Is All You Need (Vaswani et al., 2017)',
        url: 'https://arxiv.org/abs/1706.03762',
        snippet: 'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.',
        domain: 'arxiv.org',
      },
    ],
    createdAt: 1761200000000,
    updatedAt: 1761200000000,
    viewsCount: 14,
    savesCount: 6,
    forksCount: 4,
  },
  {
    id: 'art_distributed_rate_limiter_ts',
    ownerId: 'zeno_editorial',
    authorName: 'Zeno Systems Lab',
    authorUsername: 'zeno_systems',
    authorBio: 'Production architecture patterns and systems engineering notes.',
    showAuthorAttribution: true,
    title: 'Atomic Token Bucket & Sliding Window Rate Limiting in Redis + TypeScript',
    summary:
      'Production blueprint for preventing race conditions in distributed API gateways using single-roundtrip Redis Lua scripts and graceful local memory fallback.',
    content: `## Problem: Race Conditions in Read-Then-Write Rate Limiters

A naive \`GET\` followed by \`INCR\` across multiple Node.js instances suffers from TOCTOU (Time-of-Check to Time-of-Use) race conditions under burst concurrency.

## Solution: Atomic Lua Evaluation

Executing token replenishment and consumption inside a single Redis \`EVAL\` script guarantees serializability without distributed locks:

\`\`\`lua
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local state = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(state[1]) or capacity
local lastRefill = tonumber(state[2]) or now

local elapsed = math.max(0, now - lastRefill)
tokens = math.min(capacity, tokens + elapsed * refillRate)

if tokens < 1 then
  return {0, math.ceil((1 - tokens) / refillRate)}
end

tokens = tokens - 1
redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
redis.call('PEXPIRE', key, math.ceil((capacity / refillRate) * 2000))
return {1, 0}
\`\`\`

### Key Engineering Takeaways
1. Always set \`PEXPIRE\` so idle keys self-evict.
2. Pair Redis with a bounded local token bucket fallback so upstream Redis maintenance never causes a cascading gateway outage.`,
    category: 'Programming',
    tags: ['typescript', 'redis', 'distributed-systems', 'rate-limiting', 'backend'],
    visibility: 'public',
    outputType: 'workflow',
    sources: [
      {
        position: 1,
        title: 'Redis Lua Scripting Atomicity Documentation',
        url: 'https://redis.io/docs/latest/develop/interact/programmability/eval-intro/',
        snippet: 'Redis guarantees that a script is executed in an atomic way: no other script or command will be executed while a script is being executed.',
        domain: 'redis.io',
      },
    ],
    createdAt: 1761280000000,
    updatedAt: 1761280000000,
    viewsCount: 19,
    savesCount: 8,
    forksCount: 5,
  },
  {
    id: 'art_scientific_literature_synthesis',
    ownerId: 'zeno_editorial',
    authorName: 'Zeno Research Team',
    authorUsername: 'zeno_research',
    authorBio: 'Curated reference synthesis and study guides built with Zeno.',
    showAuthorAttribution: true,
    title: 'How to Synthesize a 40-Page Research Paper in 15 Minutes',
    summary:
      'A structured 3-pass reading workflow combining abstract claim extraction, methodology auditing, and active-recall quiz verification inside Zeno PDF Studio.',
    content: `## The Three-Pass Literature Audit

Reading dense academic preprints linearly from page 1 to page 40 wastes cognitive bandwidth before you know whether the paper's empirical claims hold up.

### Pass 1: Structural Triage (3 Minutes)
- Read the **Abstract**, **Introduction contributions list**, and **Section headings**.
- Identify the single core hypothesis and the baseline benchmark being challenged.

### Pass 2: Figure, Table & Ablation Inspection (7 Minutes)
- Examine every table and error bar before reading the prose commentary.
- Check the **Ablation Study**: which component removal causes the steepest performance drop?
- Verify whether baseline comparisons use identical parameter budgets and training compute.

### Pass 3: Active Recall Verification (5 Minutes)
- Upload the PDF into **Zeno Study Studio**.
- Generate a **Hard Mastery Quiz** and **Concept & Math Breakdown** to test whether you can reconstruct the paper's core equation and failure modes without looking at the text.`,
    category: 'Research',
    tags: ['literature-review', 'arxiv', 'research-methods', 'pdf-studio', 'study-workflow'],
    visibility: 'public',
    outputType: 'research_summary',
    sources: [],
    createdAt: 1761340000000,
    updatedAt: 1761340000000,
    viewsCount: 22,
    savesCount: 11,
    forksCount: 7,
  },
  {
    id: 'art_spaced_repetition_active_recall',
    ownerId: 'zeno_editorial',
    authorName: 'Zeno Learning Lab',
    authorUsername: 'zeno_learning',
    authorBio: 'Evidence-based learning frameworks and exam preparation workflows.',
    showAuthorAttribution: true,
    title: 'Active Recall vs. Passive Highlighting: Exam Mastery Protocol',
    summary:
      'Cognitive science breakdown of the testing effect, desirable difficulties, and how to turn lecture transcripts and PDFs into progressive difficulty quizzes.',
    content: `## Why Re-Reading Creates an Illusion of Competence

Fluency with a highlighted page is recognition, not retrieval. Cognitive psychology experiments (Roediger & Karpicke, 2006) demonstrate that retrieval practice—forcing your brain to reconstruct an answer from scratch—doubles long-term retention after 7 days compared to repeated study.

## The Zeno 3-Tier Mastery Loop
1. **Easy Tier (Foundational Recall)**: Verify definitions, terminology, and primary thesis statements.
2. **Medium Tier (Mechanism & Cause-Effect)**: Explain *how* changing variable $X$ alters system output $Y$.
3. **Hard Tier (Edge Cases & Synthesis)**: Diagnose failure modes, boundary assumptions, and trade-offs between competing approaches.`,
    category: 'Learning',
    tags: ['active-recall', 'spaced-repetition', 'cognitive-science', 'exams', 'flashcards'],
    visibility: 'public',
    outputType: 'study_guide',
    sources: [],
    createdAt: 1761390000000,
    updatedAt: 1761390000000,
    viewsCount: 17,
    savesCount: 9,
    forksCount: 5,
  },
  {
    id: 'art_webgpu_wasm_browser_inference',
    ownerId: 'zeno_editorial',
    authorName: 'Zeno Systems Lab',
    authorUsername: 'zeno_systems',
    authorBio: 'Production architecture patterns and systems engineering notes.',
    showAuthorAttribution: true,
    title: 'On-Device Browser AI: WebGPU Compute Shaders & WebAssembly SIMD',
    summary:
      'Architectural comparison of client-side neural inference using quantized GGUF weights, WebAssembly Relaxed SIMD, and WebGPU storage buffers.',
    content: `## Client-Side Inference Architecture

Running compact neural models (such as 30M–1B parameter speech and embedding models) directly inside the browser eliminates per-request server GPU cost and preserves user privacy.

### Execution Targets
- **WebGPU**: Dispatches WGSL compute shaders against 8-bit quantized (\`q8\`) weights in GPU storage buffers. Ideal for batch matrix-vector multiplications.
- **WebAssembly SIMD + Module Workers**: Runs on a dedicated background \`Worker\` so audio synthesis or token generation never blocks the 60fps UI thread.
- **Cache API Persistence**: Model checkpoints are stored in the browser's origin-scoped Cache API so subsequent sessions start from local disk in milliseconds.`,
    category: 'Technology',
    tags: ['webgpu', 'webassembly', 'edge-ai', 'browser-inference', 'performance'],
    visibility: 'public',
    outputType: 'explanation',
    sources: [],
    createdAt: 1761420000000,
    updatedAt: 1761420000000,
    viewsCount: 12,
    savesCount: 5,
    forksCount: 3,
  },
  {
    id: 'art_technical_rfc_writing_framework',
    ownerId: 'zeno_editorial',
    authorName: 'Zeno Editorial',
    authorUsername: 'zeno_editorial',
    authorBio: 'Clarity-first technical writing and engineering RFC templates.',
    showAuthorAttribution: true,
    title: 'Engineering RFC & Technical Design Doc Framework',
    summary:
      'A high-signal template for writing architecture proposals that surface trade-offs, security boundaries, failure modes, and explicit non-goals.',
    content: `## Structure of an Effective Engineering RFC

1. **Context & Problem Statement**: State the concrete bottleneck or user failure in 3 sentences with measured baseline numbers.
2. **Explicit Non-Goals**: List adjacent problems this proposal intentionally does *not* solve to prevent scope creep.
3. **Proposed Architecture & Data Flow**: Trace a single request end-to-end across auth, storage, and error boundaries.
4. **Alternatives Considered**: Document why simpler or more complex designs were rejected.
5. **Security, Privacy & Rollback Plan**: Define ownership checks, rate limits, and how to revert safely if metrics degrade.`,
    category: 'Writing',
    tags: ['technical-writing', 'rfc', 'system-design', 'engineering-management'],
    visibility: 'public',
    outputType: 'structured_notes',
    sources: [],
    createdAt: 1761450000000,
    updatedAt: 1761450000000,
    viewsCount: 11,
    savesCount: 6,
    forksCount: 4,
  },
  {
    id: 'art_deep_work_research_sprint',
    ownerId: 'zeno_editorial',
    authorName: 'Zeno Productivity',
    authorUsername: 'zeno_productivity',
    authorBio: 'Workflows for focused research, note synthesis, and decision clarity.',
    showAuthorAttribution: true,
    title: 'The 45-Minute Deep Research & Vault Synthesis Sprint',
    summary:
      'How to prevent tab overload by structuring research sessions into a 3-stage Question → Cited Synthesis → Knowledge Vault workflow.',
    content: `## Eliminating Research Tab Entropy

Most knowledge workers open 30 browser tabs, skim fragments, and lose the synthesis by the next morning.

### Stage 1: Scoped Question Definition (5 min)
Write down the exact decision or question you need answered and 3 falsifiable sub-questions.

### Stage 2: Multi-Source Retrieval & Verification (25 min)
Use live web search, ArXiv paper lookup, and primary source extraction to gather cited evidence. Verify dates and primary claims.

### Stage 3: Vault Consolidation (15 min)
Save the final structured synthesis into a dedicated **Knowledge Vault Collection** with 3–4 canonical tags so you can resume immediately in your next session.`,
    category: 'Productivity',
    tags: ['knowledge-management', 'deep-work', 'research-workflow', 'second-brain'],
    visibility: 'public',
    outputType: 'workflow',
    sources: [],
    createdAt: 1761470000000,
    updatedAt: 1761470000000,
    viewsCount: 15,
    savesCount: 7,
    forksCount: 3,
  },
  {
    id: 'art_organic_chemistry_mechanisms_sheet',
    ownerId: 'zeno_editorial',
    authorName: 'Zeno Study Studio',
    authorUsername: 'zeno_study',
    authorBio: 'High-yield study sheets and university STEM exam guides.',
    showAuthorAttribution: true,
    title: 'SN1, SN2, E1 & E2 Reaction Mechanisms Decision Matrix',
    summary:
      'Complete stereochemical, substrate, nucleophile/base strength, and solvent polarity decision guide for predicting substitution vs. elimination pathways.',
    content: `## Predicting Substitution vs. Elimination Pathways

| Parameter | $\\text{S}_\\text{N}2$ | $\\text{S}_\\text{N}1$ | $\\text{E}2$ | $\\text{E}1$ |
| :--- | :--- | :--- | :--- | :--- |
| **Kinetics** | Bimolecular $k[\\text{RX}][\\text{Nu}]$ | Unimolecular $k[\\text{RX}]$ | Bimolecular $k[\\text{RX}][\\text{B}]$ | Unimolecular $k[\\text{RX}]$ |
| **Substrate** | Methyl $> 1^\\circ > 2^\\circ$ (never $3^\\circ$) | $3^\\circ > 2^\\circ$ (carbocation stability) | $3^\\circ > 2^\\circ > 1^\\circ$ | $3^\\circ > 2^\\circ$ |
| **Stereochemistry** | Complete Waldensian Inversion | Racemization (planar intermediate) | Anti-periplanar ($180^\\circ$ dihedral) | Zaitsev alkene major |
| **Favored Solvent** | Polar Aprotic (DMSO, Acetone, DMF) | Polar Protic ($\\text{H}_2\\text{O}$, ROH) | Polar Aprotic / Protic | Polar Protic + Heat |`,
    category: 'Study Resources',
    tags: ['organic-chemistry', 'stem', 'exam-prep', 'cheatsheet', 'reaction-mechanisms'],
    visibility: 'public',
    outputType: 'study_guide',
    sources: [],
    createdAt: 1761490000000,
    updatedAt: 1761490000000,
    viewsCount: 21,
    savesCount: 10,
    forksCount: 6,
  },
];

// ============================================================================
// IN-MEMORY SERVER STATE (WITH DETERMINISTIC SEEDING & ISOLATION)
// ============================================================================

const artifactsStore = new Map<string, ServerPublicArtifact>();
const creatorProfilesStore = new Map<string, ServerCreatorProfile>();
const moderationReportsStore: ServerModerationReport[] = [];
const artifactViewerDedupe = new Map<string, Set<string>>();

const referralsByCode = new Map<string, ServerReferralRecord>();
const referralCodeByUid = new Map<string, string>();
const claimedReferralsByUid = new Map<string, { code: string; referrerUid: string; claimedAt: number }>();

const seenAnalyticsEventIds = new Set<string>();
const analyticsEventCounts: Record<GrowthAnalyticsEventName, number> = {
  signup_completed: 0,
  first_core_action_completed: 0,
  knowledge_item_saved: 0,
  share_card_created: 0,
  share_action_initiated: 0,
  public_artifact_created: 0,
  public_artifact_opened: 0,
  discover_resource_opened: 0,
  referral_link_created: 0,
  referral_visit_recorded: 0,
  referral_signup_validated: 0,
  weekly_report_viewed: 0,
  returning_session_started: 0,
};
const activeDayBuckets = new Set<string>();

function ensureSeededArtifacts(): void {
  if (artifactsStore.size === 0) {
    for (const item of SEEDED_ARTIFACTS) {
      artifactsStore.set(item.id, { ...item });
    }
    creatorProfilesStore.set('zeno_editorial', {
      uid: 'zeno_editorial',
      displayName: 'Zeno Research Team',
      username: 'zeno_research',
      bio: 'Curated reference synthesis, systems architecture notes, and study guides built with Zeno.',
      isPublic: true,
      featuredArtifactIds: SEEDED_ARTIFACTS.slice(0, 4).map((a) => a.id),
      updatedAt: 1761490000000,
    });
  }
}
ensureSeededArtifacts();

export function resetGrowthEngineForTests(): void {
  artifactsStore.clear();
  creatorProfilesStore.clear();
  moderationReportsStore.length = 0;
  artifactViewerDedupe.clear();
  referralsByCode.clear();
  referralCodeByUid.clear();
  claimedReferralsByUid.clear();
  seenAnalyticsEventIds.clear();
  for (const k of VALID_GROWTH_EVENTS) {
    analyticsEventCounts[k] = 0;
  }
  activeDayBuckets.clear();
  ensureSeededArtifacts();
}

// ============================================================================
// CORE ARTIFACT & DISCOVER OPERATIONS
// ============================================================================

export function getArtifactForMeta(artifactId: string): ServerPublicArtifact | null {
  if (!isValidSafeId(artifactId)) return null;
  const art = artifactsStore.get(artifactId);
  if (!art || art.visibility !== 'public') return null;
  return art;
}

export function listPublicArtifacts(params: {
  category?: string;
  q?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  ownerId?: string;
  requesterUid?: string | null;
}): { items: ServerPublicArtifact[]; total: number; hasMore: boolean } {
  ensureSeededArtifacts();
  const category = params.category?.trim();
  const queryText = (params.q || '').trim().toLowerCase();
  const sort = params.sort || 'recent';
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
  const offset = Math.max(0, Number(params.offset) || 0);

  let results = Array.from(artifactsStore.values()).filter((art) => {
    if (params.ownerId) {
      if (art.ownerId !== params.ownerId) return false;
      // Only the owner can list their own private artifacts
      if (art.visibility === 'private' && params.requesterUid !== art.ownerId) {
        return false;
      }
      return true;
    }
    return art.visibility === 'public';
  });

  if (category && category !== 'All' && VALID_DISCOVER_CATEGORIES.includes(category as DiscoverCategory)) {
    results = results.filter((art) => art.category === category);
  }

  if (queryText) {
    results = results.filter((art) => {
      const haystack = `${art.title} ${art.summary} ${art.tags.join(' ')} ${art.category} ${art.authorName}`.toLowerCase();
      return haystack.includes(queryText);
    });
  }

  if (sort === 'saved') {
    results.sort((a, b) => b.savesCount - a.savesCount || b.viewsCount - a.viewsCount || b.createdAt - a.createdAt);
  } else if (sort === 'views') {
    results.sort((a, b) => b.viewsCount - a.viewsCount || b.savesCount - a.savesCount || b.createdAt - a.createdAt);
  } else {
    results.sort((a, b) => b.createdAt - a.createdAt);
  }

  const total = results.length;
  const paged = results.slice(offset, offset + limit).map((art) => sanitizeArtifactForPublicResponse(art));
  return {
    items: paged,
    total,
    hasMore: offset + limit < total,
  };
}

function sanitizeArtifactForPublicResponse(art: ServerPublicArtifact): ServerPublicArtifact {
  return {
    ...art,
    authorName: art.showAuthorAttribution ? art.authorName : 'Zeno Contributor',
    authorUsername: art.showAuthorAttribution ? art.authorUsername : undefined,
    authorBio: art.showAuthorAttribution ? art.authorBio : undefined,
  };
}

export function getArtifactById(
  artifactId: string,
  requesterUid: string | null,
  visitorKey?: string
): { status: 'ok'; artifact: ServerPublicArtifact } | { status: 'not_found' } | { status: 'forbidden' } {
  if (!isValidSafeId(artifactId)) return { status: 'not_found' };
  const art = artifactsStore.get(artifactId);
  if (!art) return { status: 'not_found' };

  if (art.visibility === 'private') {
    if (!requesterUid || requesterUid !== art.ownerId) {
      return { status: 'forbidden' };
    }
    return { status: 'ok', artifact: { ...art } };
  }

  if (visitorKey) {
    let viewers = artifactViewerDedupe.get(artifactId);
    if (!viewers) {
      viewers = new Set<string>();
      artifactViewerDedupe.set(artifactId, viewers);
    }
    if (!viewers.has(visitorKey)) {
      viewers.add(visitorKey);
      art.viewsCount += 1;
    }
  }

  return {
    status: 'ok',
    artifact:
      requesterUid && requesterUid === art.ownerId
        ? { ...art }
        : sanitizeArtifactForPublicResponse(art),
  };
}

export function createOrUpdateArtifact(
  ownerUid: string,
  payload: any
): { ok: true; artifact: ServerPublicArtifact } | { ok: false; code: string; message: string; status: number } {
  if (!ownerUid || typeof ownerUid !== 'string') {
    return { ok: false, code: 'growth/unauthorized', message: 'Authentication is required to publish artifacts', status: 401 };
  }

  const title = sanitizePlainString(payload?.title, 180);
  if (!title || title.length < 3) {
    return { ok: false, code: 'growth/invalid-title', message: 'A descriptive title (at least 3 characters) is required', status: 400 };
  }

  const content = sanitizePublicMarkdown(payload?.content, 32000);
  if (!content || content.length < 10) {
    return { ok: false, code: 'growth/invalid-content', message: 'Artifact content must be at least 10 characters', status: 400 };
  }

  const rawSummary = sanitizePlainString(payload?.summary, 400);
  const summary =
    rawSummary ||
    content
      .replace(/[#*`>_~[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

  const category: DiscoverCategory = VALID_DISCOVER_CATEGORIES.includes(payload?.category)
    ? payload.category
    : 'Research';

  const outputType: ArtifactOutputType = VALID_OUTPUT_TYPES.includes(payload?.outputType)
    ? payload.outputType
    : 'research_summary';

  const visibility: 'public' | 'private' = payload?.visibility === 'private' ? 'private' : 'public';

  const rawTags = Array.isArray(payload?.tags) ? payload.tags : [];
  const tags = rawTags
    .map((t: unknown) => sanitizePlainString(t, 32).toLowerCase())
    .filter((t: string) => t.length >= 2)
    .slice(0, 8);

  const rawSources = Array.isArray(payload?.sources) ? payload.sources : [];
  const sources = rawSources
    .slice(0, 10)
    .map((s: any, idx: number) => ({
      position: idx + 1,
      title: sanitizePlainString(s?.title || s?.domain || 'Cited Source', 160),
      url: typeof s?.url === 'string' && /^https?:\/\//i.test(s.url) ? s.url.slice(0, 500) : '',
      snippet: sanitizePlainString(s?.snippet || '', 300),
      domain: sanitizePlainString(s?.domain || '', 100),
    }))
    .filter((s: any) => Boolean(s.url));

  const requestedId = typeof payload?.id === 'string' && isValidSafeId(payload.id) ? payload.id : '';
  if (requestedId && artifactsStore.has(requestedId)) {
    const existing = artifactsStore.get(requestedId)!;
    if (existing.ownerId !== ownerUid) {
      return {
        ok: false,
        code: 'growth/forbidden',
        message: 'You do not have permission to modify another user’s artifact',
        status: 403,
      };
    }
    const updated: ServerPublicArtifact = {
      ...existing,
      title,
      summary,
      content,
      category,
      tags,
      visibility,
      outputType,
      showAuthorAttribution: payload?.showAuthorAttribution !== false,
      authorName: sanitizePlainString(payload?.authorName || existing.authorName || 'Zeno Researcher', 80),
      authorUsername: sanitizePlainString(payload?.authorUsername || existing.authorUsername || '', 50) || undefined,
      authorBio: sanitizePlainString(payload?.authorBio || existing.authorBio || '', 200) || undefined,
      sources: sources.length > 0 ? sources : existing.sources,
      updatedAt: Date.now(),
    };
    artifactsStore.set(requestedId, updated);
    return { ok: true, artifact: updated };
  }

  const newId = `art_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const now = Date.now();
  const created: ServerPublicArtifact = {
    id: newId,
    ownerId: ownerUid,
    authorName: sanitizePlainString(payload?.authorName || 'Zeno Researcher', 80) || 'Zeno Researcher',
    authorUsername: sanitizePlainString(payload?.authorUsername || '', 50) || undefined,
    authorBio: sanitizePlainString(payload?.authorBio || '', 200) || undefined,
    showAuthorAttribution: payload?.showAuthorAttribution !== false,
    title,
    summary,
    content,
    category,
    tags,
    visibility,
    outputType,
    sources,
    createdAt: now,
    updatedAt: now,
    viewsCount: 1,
    savesCount: 0,
    forksCount: 0,
  };

  artifactsStore.set(newId, created);
  if (visibility === 'public') {
    recordGrowthAnalyticsEvent('public_artifact_created', `art_create_${newId}`);
  }
  return { ok: true, artifact: created };
}

export function updateArtifactFields(
  artifactId: string,
  requesterUid: string,
  patch: any
): { ok: true; artifact: ServerPublicArtifact } | { ok: false; code: string; message: string; status: number } {
  if (!isValidSafeId(artifactId)) {
    return { ok: false, code: 'growth/not-found', message: 'Artifact not found', status: 404 };
  }
  const existing = artifactsStore.get(artifactId);
  if (!existing) {
    return { ok: false, code: 'growth/not-found', message: 'Artifact not found', status: 404 };
  }
  if (!requesterUid || existing.ownerId !== requesterUid) {
    return {
      ok: false,
      code: 'growth/forbidden',
      message: 'Only the artifact creator can modify or change visibility of this resource',
      status: 403,
    };
  }

  const nextVisibility: 'public' | 'private' =
    patch?.visibility === 'private'
      ? 'private'
      : patch?.visibility === 'public'
      ? 'public'
      : existing.visibility;

  const nextTitle =
    patch?.title !== undefined ? sanitizePlainString(patch.title, 180) : existing.title;
  if (!nextTitle || nextTitle.length < 3) {
    return { ok: false, code: 'growth/invalid-title', message: 'Title must be at least 3 characters', status: 400 };
  }

  const nextContent =
    patch?.content !== undefined ? sanitizePublicMarkdown(patch.content, 32000) : existing.content;
  if (!nextContent || nextContent.length < 10) {
    return { ok: false, code: 'growth/invalid-content', message: 'Content must be at least 10 characters', status: 400 };
  }

  const nextSummary =
    patch?.summary !== undefined ? sanitizePlainString(patch.summary, 400) : existing.summary;

  const nextCategory: DiscoverCategory =
    patch?.category && VALID_DISCOVER_CATEGORIES.includes(patch.category)
      ? patch.category
      : existing.category;

  const nextTags = Array.isArray(patch?.tags)
    ? patch.tags
        .map((t: unknown) => sanitizePlainString(t, 32).toLowerCase())
        .filter((t: string) => t.length >= 2)
        .slice(0, 8)
    : existing.tags;

  const updated: ServerPublicArtifact = {
    ...existing,
    title: nextTitle,
    summary: nextSummary,
    content: nextContent,
    category: nextCategory,
    tags: nextTags,
    visibility: nextVisibility,
    showAuthorAttribution:
      patch?.showAuthorAttribution !== undefined
        ? Boolean(patch.showAuthorAttribution)
        : existing.showAuthorAttribution,
    updatedAt: Date.now(),
  };

  artifactsStore.set(artifactId, updated);
  return { ok: true, artifact: updated };
}

export function deleteArtifactById(
  artifactId: string,
  requesterUid: string
): { ok: true } | { ok: false; code: string; message: string; status: number } {
  if (!isValidSafeId(artifactId)) {
    return { ok: false, code: 'growth/not-found', message: 'Artifact not found', status: 404 };
  }
  const existing = artifactsStore.get(artifactId);
  if (!existing) {
    return { ok: false, code: 'growth/not-found', message: 'Artifact not found', status: 404 };
  }
  if (!requesterUid || existing.ownerId !== requesterUid) {
    return {
      ok: false,
      code: 'growth/forbidden',
      message: 'Only the artifact creator can delete this resource',
      status: 403,
    };
  }
  artifactsStore.delete(artifactId);
  return { ok: true };
}

// ============================================================================
// REFERRAL ATTRIBUTION ENGINE (FRAUD-RESISTANT, NO SELF-REFERRALS)
// ============================================================================

export function getOrCreateReferralRecord(uid: string): ServerReferralRecord {
  const existingCode = referralCodeByUid.get(uid);
  if (existingCode && referralsByCode.has(existingCode)) {
    return referralsByCode.get(existingCode)!;
  }

  const hash = crypto.createHash('sha256').update(`zeno_ref_${uid}`).digest('hex').slice(0, 8);
  const code = `zp_${hash}`;
  const record: ServerReferralRecord = {
    referralCode: code,
    referrerUid: uid,
    visitsCount: 0,
    visitorKeys: new Set<string>(),
    validatedSignupsCount: 0,
    qualifiedActionsCount: 0,
    referredUids: new Set<string>(),
    unlockedThemes: ['carbon-default'],
    createdAt: Date.now(),
  };
  referralCodeByUid.set(uid, code);
  referralsByCode.set(code, record);
  return record;
}

function computeUnlockedThemes(validatedCount: number): string[] {
  const themes = ['carbon-default'];
  if (validatedCount >= 1) themes.push('obsidian-gold');
  if (validatedCount >= 3) themes.push('solar-ivory');
  if (validatedCount >= 5) themes.push('emerald-terminal');
  return themes;
}

export function recordReferralVisit(code: string, visitorKey: string): {
  ok: boolean;
  referralCode?: string;
  visitsCount?: number;
} {
  if (!isValidSafeId(code, 32) || !code.startsWith('zp_')) {
    return { ok: false };
  }
  let record = referralsByCode.get(code);
  if (!record) {
    // Allow valid zp_ codes generated deterministically even across server restarts
    record = {
      referralCode: code,
      referrerUid: `owner_${code}`,
      visitsCount: 0,
      visitorKeys: new Set<string>(),
      validatedSignupsCount: 0,
      qualifiedActionsCount: 0,
      referredUids: new Set<string>(),
      unlockedThemes: ['carbon-default'],
      createdAt: Date.now(),
    };
    referralsByCode.set(code, record);
  }

  const safeVisitor = sanitizePlainString(visitorKey || 'anon', 80);
  if (!record.visitorKeys.has(safeVisitor)) {
    record.visitorKeys.add(safeVisitor);
    record.visitsCount += 1;
    recordGrowthAnalyticsEvent('referral_visit_recorded', `ref_visit_${code}_${safeVisitor}`);
  }

  return {
    ok: true,
    referralCode: record.referralCode,
    visitsCount: record.visitsCount,
  };
}

export function claimReferralAttribution(
  claimantUid: string,
  referralCode: string,
  visitTimestampMs?: number
): { ok: true; record: ServerReferralRecord } | { ok: false; code: string; message: string; status: number } {
  if (!claimantUid || typeof claimantUid !== 'string') {
    return { ok: false, code: 'referral/unauthorized', message: 'Authentication required to validate referral', status: 401 };
  }
  if (!isValidSafeId(referralCode, 32) || !referralCode.startsWith('zp_')) {
    return { ok: false, code: 'referral/invalid-code', message: 'Invalid referral pass code', status: 400 };
  }

  // Reject self-referral (either by matching referrerUid or deterministic code for claimantUid)
  const claimantOwnRecord = getOrCreateReferralRecord(claimantUid);
  if (claimantOwnRecord.referralCode === referralCode) {
    return {
      ok: false,
      code: 'referral/self-referral',
      message: 'Self-referrals are not permitted',
      status: 400,
    };
  }

  // Reject duplicate claims from the same user
  if (claimedReferralsByUid.has(claimantUid)) {
    return {
      ok: false,
      code: 'referral/already-claimed',
      message: 'Referral attribution has already been recorded for this account',
      status: 409,
    };
  }

  // Enforce 14-day attribution window if visitTimestampMs is supplied
  if (
    typeof visitTimestampMs === 'number' &&
    visitTimestampMs > 0 &&
    Date.now() - visitTimestampMs > ATTRIBUTION_WINDOW_MS
  ) {
    return {
      ok: false,
      code: 'referral/expired-window',
      message: 'Referral attribution window (14 days) has expired',
      status: 400,
    };
  }

  let referrerRecord = referralsByCode.get(referralCode);
  if (!referrerRecord) {
    referrerRecord = {
      referralCode,
      referrerUid: `owner_${referralCode}`,
      visitsCount: 1,
      visitorKeys: new Set<string>(),
      validatedSignupsCount: 0,
      qualifiedActionsCount: 0,
      referredUids: new Set<string>(),
      unlockedThemes: ['carbon-default'],
      createdAt: Date.now(),
    };
    referralsByCode.set(referralCode, referrerRecord);
  }

  if (referrerRecord.referrerUid === claimantUid) {
    return {
      ok: false,
      code: 'referral/self-referral',
      message: 'Self-referrals are not permitted',
      status: 400,
    };
  }

  referrerRecord.referredUids.add(claimantUid);
  referrerRecord.validatedSignupsCount += 1;
  referrerRecord.qualifiedActionsCount += 1;
  referrerRecord.unlockedThemes = computeUnlockedThemes(referrerRecord.validatedSignupsCount);

  claimedReferralsByUid.set(claimantUid, {
    code: referralCode,
    referrerUid: referrerRecord.referrerUid,
    claimedAt: Date.now(),
  });

  recordGrowthAnalyticsEvent('referral_signup_validated', `ref_valid_${referralCode}_${claimantUid}`);
  return { ok: true, record: referrerRecord };
}

// ============================================================================
// PRIVACY-SAFE GROWTH ANALYTICS
// ============================================================================

export function recordGrowthAnalyticsEvent(
  eventName: unknown,
  idempotencyKey?: string
): { recorded: boolean; deduplicated: boolean } {
  if (typeof eventName !== 'string' || !VALID_GROWTH_EVENTS.includes(eventName as GrowthAnalyticsEventName)) {
    return { recorded: false, deduplicated: false };
  }

  if (idempotencyKey && typeof idempotencyKey === 'string') {
    const safeKey = sanitizePlainString(idempotencyKey, 140);
    if (safeKey) {
      if (seenAnalyticsEventIds.has(safeKey)) {
        return { recorded: false, deduplicated: true };
      }
      if (seenAnalyticsEventIds.size > 10000) {
        seenAnalyticsEventIds.clear();
      }
      seenAnalyticsEventIds.add(safeKey);
    }
  }

  const typedName = eventName as GrowthAnalyticsEventName;
  analyticsEventCounts[typedName] = (analyticsEventCounts[typedName] || 0) + 1;
  activeDayBuckets.add(new Date().toISOString().slice(0, 10));
  return { recorded: true, deduplicated: false };
}

export function getGrowthFunnelSummary() {
  const totalEvents = Object.values(analyticsEventCounts).reduce((acc, v) => acc + v, 0);
  return {
    totalEvents,
    countsByEvent: { ...analyticsEventCounts },
    acquisition: {
      referralVisits: analyticsEventCounts.referral_visit_recorded,
      publicArtifactOpens: analyticsEventCounts.public_artifact_opened,
      discoverOpens: analyticsEventCounts.discover_resource_opened,
    },
    activation: {
      signupsCompleted: analyticsEventCounts.signup_completed,
      firstCoreActions: analyticsEventCounts.first_core_action_completed,
      knowledgeItemsSaved: analyticsEventCounts.knowledge_item_saved,
    },
    virality: {
      shareCardsCreated: analyticsEventCounts.share_card_created,
      shareActionsInitiated: analyticsEventCounts.share_action_initiated,
      publicArtifactsCreated: analyticsEventCounts.public_artifact_created,
      validatedReferrals: analyticsEventCounts.referral_signup_validated,
    },
    retention: {
      returningSessions: analyticsEventCounts.returning_session_started,
      weeklyReportsViewed: analyticsEventCounts.weekly_report_viewed,
      activeDaysLast7: Math.min(7, Math.max(1, activeDayBuckets.size)),
    },
  };
}

// ============================================================================
// DYNAMIC OPEN GRAPH / SOCIAL METADATA INJECTION FOR PUBLIC PAGES
// ============================================================================

export function injectSocialMetaIntoHtml(
  rawHtml: string,
  query: Record<string, unknown>,
  requestUrl: string
): string {
  const artifactId = typeof query.artifact === 'string' ? query.artifact.trim() : '';
  const shareId = typeof query.share === 'string' ? query.share.trim() : '';
  const refCode = typeof query.ref === 'string' ? query.ref.trim() : '';

  let pageTitle = 'Zeno — AI Research, Learning & Multi-Model Workspace';
  let pageDescription =
    'Explore ideas, synthesize academic papers, build study guides, and organize knowledge in Zeno.';

  if (artifactId) {
    const art = getArtifactForMeta(artifactId);
    if (art) {
      pageTitle = `${art.title} · Zeno Public Research Page`;
      pageDescription = `${art.summary} — Published in ${art.category} on Zeno.`;
    }
  } else if (shareId && isValidSafeId(shareId)) {
    pageTitle = 'Shared Research Snapshot · Zeno';
    pageDescription =
      'View this verified read-only research snapshot with cited sources and fork it into your Zeno workspace.';
  } else if (refCode && isValidSafeId(refCode, 32)) {
    pageTitle = 'You’ve Been Invited with a Zeno Pass · Zeno AI Research Platform';
    pageDescription =
      'Accept your Zeno Pass to explore AI research, PDF study studios, and personal knowledge vaults.';
  } else {
    return rawHtml;
  }

  const safeTitle = escapeHtmlEntities(pageTitle);
  const safeDesc = escapeHtmlEntities(pageDescription);
  const safeUrl = escapeHtmlEntities(requestUrl);

  let updated = rawHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    );

  const extraTwitterMeta = `\n    <meta property="og:url" content="${safeUrl}" />\n    <meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:title" content="${safeTitle}" />\n    <meta name="twitter:description" content="${safeDesc}" />`;
  updated = updated.replace('</head>', `${extraTwitterMeta}\n  </head>`);
  return updated;
}

// ============================================================================
// EXPRESS ROUTE REGISTRATION
// ============================================================================

export function registerGrowthEngineRoutes(app: Router): void {
  const resolveRequesterUid = (req: Request): string | null => {
    if (req.auth?.uid) return req.auth.uid;
    const clientHeader = req.headers['x-zeno-client-id'];
    if (typeof clientHeader === 'string' && isValidSafeId(clientHeader, 64)) {
      return `client_${clientHeader}`;
    }
    return null;
  };

  // 1. Browse & Search Public Zeno Discover Library
  app.get('/api/growth/discover', (req: Request, res: Response) => {
    const { category, q, sort, limit, offset, ownerId } = req.query;
    const result = listPublicArtifacts({
      category: typeof category === 'string' ? category : undefined,
      q: typeof q === 'string' ? q : undefined,
      sort: typeof sort === 'string' ? sort : undefined,
      limit: limit !== undefined ? Number(limit) : 20,
      offset: offset !== undefined ? Number(offset) : 0,
      ownerId: typeof ownerId === 'string' ? ownerId : undefined,
      requesterUid: resolveRequesterUid(req),
    });
    return res.json({
      success: true,
      categories: VALID_DISCOVER_CATEGORIES,
      ...result,
    });
  });

  // 2. Get Single Public Artifact (or Private if Owner)
  app.get('/api/growth/artifacts/:id', (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const visitorKey = `${req.ip || 'anon'}_${req.headers['user-agent']?.slice(0, 32) || ''}`;
    const lookup = getArtifactById(id, resolveRequesterUid(req), visitorKey);
    if (lookup.status === 'not_found') {
      return sendNormalizedError(res, 404, 'growth/artifact-not-found', 'The requested Zeno resource was not found or has been removed.');
    }
    if (lookup.status === 'forbidden') {
      return sendNormalizedError(res, 403, 'growth/artifact-private', 'This resource is private and only accessible to its creator.');
    }
    recordGrowthAnalyticsEvent('public_artifact_opened', `open_${id}_${visitorKey}`);
    return res.json({
      success: true,
      artifact: lookup.artifact,
    });
  });

  // 3. Create / Publish Artifact
  app.post('/api/growth/artifacts', (req: Request, res: Response) => {
    const ownerUid =
      req.auth?.uid ||
      (typeof req.headers['x-zeno-client-id'] === 'string' && isValidSafeId(req.headers['x-zeno-client-id'], 64)
        ? `client_${req.headers['x-zeno-client-id']}`
        : '');

    if (!ownerUid) {
      return sendNormalizedError(res, 401, 'growth/unauthorized', 'Sign in to publish resources.');
    }

    const result = createOrUpdateArtifact(ownerUid, req.body);
    if (!result.ok) {
      return sendNormalizedError(res, result.status, result.code, result.message);
    }
    return res.status(201).json({
      success: true,
      artifact: result.artifact,
    });
  });

  // 4. Update Artifact Visibility or Content (Owner Only)
  app.patch('/api/growth/artifacts/:id', (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const requesterUid =
      req.auth?.uid ||
      (typeof req.headers['x-zeno-client-id'] === 'string' && isValidSafeId(req.headers['x-zeno-client-id'], 64)
        ? `client_${req.headers['x-zeno-client-id']}`
        : '');

    const result = updateArtifactFields(id, requesterUid, req.body);
    if (!result.ok) {
      return sendNormalizedError(res, result.status, result.code, result.message);
    }
    return res.json({
      success: true,
      artifact: result.artifact,
    });
  });

  // 5. Delete Artifact (Owner Only)
  app.delete('/api/growth/artifacts/:id', (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    const requesterUid =
      req.auth?.uid ||
      (typeof req.headers['x-zeno-client-id'] === 'string' && isValidSafeId(req.headers['x-zeno-client-id'], 64)
        ? `client_${req.headers['x-zeno-client-id']}`
        : '');

    const result = deleteArtifactById(id, requesterUid);
    if (!result.ok) {
      return sendNormalizedError(res, result.status, result.code, result.message);
    }
    return res.json({ success: true, deletedId: id });
  });

  // 6. Fork / Save Interaction on Public Artifact
  app.post('/api/growth/artifacts/:id/action', (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    if (!isValidSafeId(id)) {
      return sendNormalizedError(res, 404, 'growth/not-found', 'Artifact not found');
    }
    const art = artifactsStore.get(id);
    if (!art || art.visibility !== 'public') {
      return sendNormalizedError(res, 404, 'growth/not-found', 'Artifact not found');
    }
    const actionType = req.body?.action;
    if (actionType === 'fork') {
      art.forksCount += 1;
      recordGrowthAnalyticsEvent('discover_resource_opened', `fork_${id}_${Date.now()}`);
    } else if (actionType === 'save') {
      art.savesCount += 1;
      recordGrowthAnalyticsEvent('knowledge_item_saved', `save_${id}_${Date.now()}`);
    }
    return res.json({
      success: true,
      viewsCount: art.viewsCount,
      savesCount: art.savesCount,
      forksCount: art.forksCount,
    });
  });

  // 7. Report Public Artifact (Moderation Workflow)
  app.post('/api/growth/artifacts/:id/report', (req: Request, res: Response) => {
    const id = String(req.params.id || '');
    if (!isValidSafeId(id) || !artifactsStore.has(id)) {
      return sendNormalizedError(res, 404, 'growth/not-found', 'Artifact not found');
    }
    const reason = sanitizePlainString(req.body?.reason, 120);
    const details = sanitizePlainString(req.body?.details, 600);
    if (!reason || reason.length < 3) {
      return sendNormalizedError(res, 400, 'growth/invalid-report', 'Please provide a valid report reason.');
    }

    const report: ServerModerationReport = {
      id: `rep_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      artifactId: id,
      reporterUid: req.auth?.uid || 'anonymous_reporter',
      reason,
      details,
      createdAt: Date.now(),
      status: 'open',
    };
    moderationReportsStore.push(report);
    return res.status(201).json({
      success: true,
      reportId: report.id,
      status: report.status,
    });
  });

  // 8. Creator Public Profile GET / PUT
  app.get('/api/growth/profile/:uid', (req: Request, res: Response) => {
    const uid = String(req.params.uid || '');
    if (!isValidSafeId(uid)) {
      return sendNormalizedError(res, 404, 'growth/profile-not-found', 'Profile not found');
    }
    const profile = creatorProfilesStore.get(uid);
    const isOwner = req.auth?.uid === uid;
    if (!profile || (!profile.isPublic && !isOwner)) {
      return sendNormalizedError(res, 404, 'growth/profile-private', 'This creator profile is private or does not exist.');
    }
    const publicArtifacts = listPublicArtifacts({ ownerId: uid, requesterUid: req.auth?.uid || null }).items;
    return res.json({
      success: true,
      profile,
      artifacts: publicArtifacts,
    });
  });

  app.put('/api/growth/profile', (req: Request, res: Response) => {
    const uid =
      req.auth?.uid ||
      (typeof req.headers['x-zeno-client-id'] === 'string' && isValidSafeId(req.headers['x-zeno-client-id'], 64)
        ? `client_${req.headers['x-zeno-client-id']}`
        : '');
    if (!uid) {
      return sendNormalizedError(res, 401, 'growth/unauthorized', 'Authentication required to update creator profile.');
    }

    const displayName = sanitizePlainString(req.body?.displayName, 80) || 'Zeno Creator';
    const username = sanitizePlainString(req.body?.username, 40).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'creator';
    const bio = sanitizePlainString(req.body?.bio, 280);
    const isPublic = Boolean(req.body?.isPublic);
    const featuredArtifactIds = Array.isArray(req.body?.featuredArtifactIds)
      ? req.body.featuredArtifactIds.filter((id: unknown) => isValidSafeId(id)).slice(0, 6)
      : [];

    const updated: ServerCreatorProfile = {
      uid,
      displayName,
      username,
      bio,
      isPublic,
      featuredArtifactIds,
      updatedAt: Date.now(),
    };
    creatorProfilesStore.set(uid, updated);
    return res.json({
      success: true,
      profile: updated,
    });
  });

  // 9. Referral System Endpoints
  app.get('/api/growth/referrals/me', (req: Request, res: Response) => {
    const uid =
      req.auth?.uid ||
      (typeof req.headers['x-zeno-client-id'] === 'string' && isValidSafeId(req.headers['x-zeno-client-id'], 64)
        ? `client_${req.headers['x-zeno-client-id']}`
        : 'guest_explorer');

    const record = getOrCreateReferralRecord(uid);
    const claimed = claimedReferralsByUid.get(uid);
    return res.json({
      success: true,
      referralCode: record.referralCode,
      referrerUid: record.referrerUid,
      visitsCount: record.visitsCount,
      validatedSignupsCount: record.validatedSignupsCount,
      qualifiedActionsCount: record.qualifiedActionsCount,
      unlockedThemes: record.unlockedThemes,
      referredByCode: claimed?.code || null,
      attributionWindowDays: 14,
      createdAt: record.createdAt,
    });
  });

  app.post('/api/growth/referrals/visit', (req: Request, res: Response) => {
    const code = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim() : '';
    const visitorKey = `${req.ip || 'anon'}_${sanitizePlainString(req.body?.visitorId || '', 48)}`;
    const resVisit = recordReferralVisit(code, visitorKey);
    if (!resVisit.ok) {
      return sendNormalizedError(res, 400, 'referral/invalid-code', 'Invalid referral pass identifier.');
    }
    return res.json({
      success: true,
      referralCode: resVisit.referralCode,
      visitsCount: resVisit.visitsCount,
      attributionWindowDays: 14,
    });
  });

  app.post('/api/growth/referrals/claim', (req: Request, res: Response) => {
    const claimantUid =
      req.auth?.uid ||
      (typeof req.headers['x-zeno-client-id'] === 'string' && isValidSafeId(req.headers['x-zeno-client-id'], 64)
        ? `client_${req.headers['x-zeno-client-id']}`
        : '');

    const code = typeof req.body?.referralCode === 'string' ? req.body.referralCode.trim() : '';
    const visitTs = typeof req.body?.visitTimestampMs === 'number' ? req.body.visitTimestampMs : undefined;

    const result = claimReferralAttribution(claimantUid, code, visitTs);
    if (!result.ok) {
      return sendNormalizedError(res, result.status, result.code, result.message);
    }
    return res.json({
      success: true,
      attributedToCode: result.record.referralCode,
      referrerValidatedSignups: result.record.validatedSignupsCount,
      unlockedThemes: result.record.unlockedThemes,
    });
  });

  // 10. Privacy-Safe Growth Analytics Endpoints
  app.post('/api/growth/analytics/event', (req: Request, res: Response) => {
    const eventName = req.body?.event;
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined;
    const outcome = recordGrowthAnalyticsEvent(eventName, idempotencyKey);
    if (!outcome.recorded && !outcome.deduplicated) {
      return sendNormalizedError(res, 400, 'analytics/invalid-event', 'Unsupported analytics event name.');
    }
    return res.json({
      success: true,
      recorded: outcome.recorded,
      deduplicated: outcome.deduplicated,
    });
  });

  app.get('/api/growth/analytics/summary', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      summary: getGrowthFunnelSummary(),
    });
  });
}
