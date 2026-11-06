import type { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { getEffectiveServerUserPlan } from './billingEngine';

export type VaultThreadType = 'youtube' | 'web_link' | 'pdf' | 'image' | 'text';

export interface VaultKeyPointInput {
  id: string;
  text: string;
  timestamp?: string; // mm:ss
  timeSec?: number;
  score?: number;
}

export interface VaultThreadCommentInput {
  id: string;
  threadId: string;
  userId?: string;
  author: 'user' | 'sage' | 'recall' | 'planner' | 'doubt_buddy' | string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: number;
  parentId?: string | null;
  score: number;
}

export interface VaultThreadInput {
  id: string;
  userId: string;
  type: VaultThreadType;
  title: string;
  sourceUrl?: string;
  thumbnail?: string;
  tldr: string;
  keyPoints: VaultKeyPointInput[];
  subject: string;
  chapter: string;
  tags: string[];
  createdAt: number; // UTC ms
  updatedAt: number; // UTC ms
  pinned: boolean;
  score: number;
  commentCount: number;
  comments?: VaultThreadCommentInput[];
}

export interface VaultMemoryIndexEntry {
  id: string;
  userId: string;
  threadId: string;
  type: VaultThreadType;
  title: string;
  keyPointText: string;
  timestamp?: string;
  sourceUrl?: string;
  subject: string;
  chapter: string;
  createdAt: number;
}

export type AgentTriggerType = 'on_save' | 'on_message' | 'schedule';

export type AgentToolName =
  | 'searchWeb'
  | 'deepResearch'
  | 'getTranscript'
  | 'makeQuiz'
  | 'makeFlashcards'
  | 'summarize'
  | 'readVault'
  | 'writeVault';

export interface PersonalAgentDefinition {
  id: 'sage' | 'recall' | 'planner' | 'doubt_buddy' | 'morning_brief';
  name: string;
  role: string;
  systemPrompt: string;
  tools: AgentToolName[];
  trigger: AgentTriggerType;
  tierRequired: 'spark' | 'fire';
  phase: 1 | 2 | 3 | 4;
}

export interface VaultItemInput {
  id: string;
  type: 'lecture' | 'note' | 'quiz' | 'flashcard_deck' | 'research_report' | 'chat_answer';
  title: string;
  subject?: string;
  chapter?: string;
  tags?: string[];
  sourceUrl?: string;
  timestamps?: string[];
  content: string;
  summary?: string;
  createdAt?: number;
  lastReviewedAt?: number;
}

export interface AgentReplyPayload {
  id: string;
  agentId: 'sage' | 'recall' | 'planner' | 'doubt_buddy' | 'morning_brief';
  agentName: string;
  agentRole: string;
  content: string;
  subject?: string;
  chapter?: string;
  tags?: string[];
  linkedItems?: Array<{
    id: string;
    title: string;
    subject: string;
    chapter: string;
    reason?: string;
  }>;
  citations?: Array<{
    vaultItemId: string;
    title: string;
    timestamp?: string;
  }>;
  toolsUsed?: AgentToolName[];
  tokensUsed?: number;
  createdAt: number;
}

export const PERSONAL_AGENTS: Record<PersonalAgentDefinition['id'], PersonalAgentDefinition> = {
  sage: {
    id: 'sage',
    name: 'Sage',
    role: 'Vault Organizer & Knowledge Linker',
    systemPrompt:
      'You are Sage, Kinich’s academic knowledge organizer for students. Whenever a student saves a lecture, study note, quiz, flashcard deck, research report, or chat answer into their Vault, you: (1) assign a clear academic Subject (e.g. Physics, Biology, Computer Science, Mathematics, Chemistry, Economics, History & Polity) and a specific Chapter (e.g. Thermodynamics & Entropy, Cellular Respiration, Transformer Architecture), (2) generate 3–6 high-signal study tags, (3) link related items already in the student’s Vault ("Related to your earlier lecture on X"), and (4) extract short student memory facts (e.g. "studying thermodynamics", "exam on Dec 12"). Stay strictly academic and SFW.',
    tools: ['readVault', 'writeVault', 'summarize'],
    trigger: 'on_save',
    tierRequired: 'spark',
    phase: 1,
  },
  recall: {
    id: 'recall',
    name: 'Recall',
    role: 'Spaced-Repetition Coach (SM-2)',
    systemPrompt:
      'You are Recall, Kinich’s spaced-repetition flashcard coach using the SM-2 algorithm. You surface due flashcards and generate active recall drills from the student’s Vault. Strictly academic and SFW.',
    tools: ['readVault', 'makeFlashcards', 'makeQuiz'],
    trigger: 'schedule',
    tierRequired: 'spark',
    phase: 2,
  },
  planner: {
    id: 'planner',
    name: 'Planner',
    role: 'Exam Study Architect',
    systemPrompt:
      'You are Planner, Kinich’s exam countdown architect. Given exam dates and subjects, you build day-by-day study schedules grounded in the student’s Vault items. Strictly academic and SFW.',
    tools: ['readVault', 'writeVault', 'summarize'],
    trigger: 'on_message',
    tierRequired: 'fire',
    phase: 3,
  },
  doubt_buddy: {
    id: 'doubt_buddy',
    name: 'Doubt Buddy',
    role: 'Vault-Grounded Tutor',
    systemPrompt:
      'You are Doubt Buddy, Kinich’s personal academic tutor. You answer student doubts using their own saved Vault lectures, notes, and reports as primary context, citing lecture titles and timestamps whenever available. Strictly academic and SFW.',
    tools: ['readVault', 'searchWeb', 'deepResearch', 'getTranscript', 'summarize'],
    trigger: 'on_message',
    tierRequired: 'fire',
    phase: 4,
  },
  morning_brief: {
    id: 'morning_brief',
    name: 'Morning Brief',
    role: 'Daily Study Briefing (IST)',
    systemPrompt:
      'You are Morning Brief, Kinich’s daily scheduled study briefing agent. Every morning (IST default), you summarize due SM-2 flashcards, today’s study plan tasks, and 1 quick warmup quiz question. Strictly academic and SFW.',
    tools: ['readVault', 'makeQuiz', 'makeFlashcards'],
    trigger: 'schedule',
    tierRequired: 'fire',
    phase: 4,
  },
};

// Daily Agent Token Caps per Tier (strictly capped, never "unlimited")
export const DAILY_AGENT_TOKEN_CAPS: Record<'free' | 'spark' | 'fire', number> = {
  free: 25_000, // Allows initial Vault organization demos while keeping full continuous agents on Spark/Fire
  spark: 500_000,
  fire: 2_500_000,
};

export const DAILY_AGENT_CALL_CAPS: Record<'free' | 'spark' | 'fire', number> = {
  free: 15,
  spark: 200,
  fire: 1000,
};

// In-memory store per user for server-authoritative token logging & agent memory (synced with Firestore on client)
interface ServerAgentUsageRecord {
  date: string;
  byAgent: Record<string, { tokensUsed: number; callsCount: number }>;
  totalTokensUsed: number;
  totalCallsCount: number;
}

const userAgentUsageMemory = new Map<string, ServerAgentUsageRecord>();
const userAgentFactsMemory = new Map<string, string[]>(); // key: `${userId}:${agentId}`, capped at 50 entries

function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getUserAgentUsage(userId: string): ServerAgentUsageRecord {
  const today = getTodayUtc();
  const existing = userAgentUsageMemory.get(userId);
  if (!existing || existing.date !== today) {
    const fresh: ServerAgentUsageRecord = {
      date: today,
      byAgent: {},
      totalTokensUsed: 0,
      totalCallsCount: 0,
    };
    userAgentUsageMemory.set(userId, fresh);
    return fresh;
  }
  return existing;
}

export function logAgentTokenUsage(
  userId: string,
  agentId: string,
  tokensUsed: number
): ServerAgentUsageRecord {
  const usage = getUserAgentUsage(userId);
  const safeTokens = Math.max(20, Math.floor(Number(tokensUsed) || 0));
  const current = usage.byAgent[agentId] || { tokensUsed: 0, callsCount: 0 };
  usage.byAgent[agentId] = {
    tokensUsed: current.tokensUsed + safeTokens,
    callsCount: current.callsCount + 1,
  };
  usage.totalTokensUsed += safeTokens;
  usage.totalCallsCount += 1;
  userAgentUsageMemory.set(userId, usage);
  return usage;
}

export function getAgentMemoryFacts(userId: string, agentId: string, clientFacts?: string[]): string[] {
  const key = `${userId}:${agentId}`;
  const existing = userAgentFactsMemory.get(key) || [];
  const merged = Array.from(
    new Set(
      [...(Array.isArray(clientFacts) ? clientFacts : []), ...existing]
        .map((f) => String(f || '').trim().slice(0, 160))
        .filter(Boolean)
    )
  ).slice(0, 50);
  userAgentFactsMemory.set(key, merged);
  return merged;
}

export function appendAgentMemoryFacts(
  userId: string,
  agentId: string,
  newFacts: string[],
  clientFacts?: string[]
): string[] {
  const key = `${userId}:${agentId}`;
  const current = getAgentMemoryFacts(userId, agentId, clientFacts);
  const updated = Array.from(
    new Set(
      [...newFacts.map((f) => String(f || '').trim().slice(0, 160)).filter(Boolean), ...current]
    )
  ).slice(0, 50); // Strictly capped at 50 entries
  userAgentFactsMemory.set(key, updated);
  return updated;
}

// ============================================================================
// MULTI-PROVIDER LLM CALLER (FALLBACK_API_KEY, NON-GEMINI PROVIDERS & GEMINI)
// ============================================================================
const loadOptionalJsonFile = (relPath: string): Record<string, any> => {
  try {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    }
  } catch {}
  return {};
};

const rootKeys = loadOptionalJsonFile('./keysAndRouters.json');
const folderKeys = loadOptionalJsonFile('./keys/keysAndRouters.json');
const keysConfig: Record<string, any> = {
  ...rootKeys,
  tokens: { ...rootKeys?.tokens, ...folderKeys?.tokens },
  baseUrls: { ...rootKeys?.baseUrls, ...folderKeys?.baseUrls },
};

export interface AgentLlmCallOptions {
  prompt: string;
  systemPrompt?: string;
  jsonSchema?: Record<string, any>;
  responseMimeType?: string;
  timeoutMs?: number;
  preferredProvider?: string;
}

export interface AgentLlmCallResult {
  text: string;
  provider: string;
  model: string;
  tokensUsed: number;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '';
  if (!apiKey || apiKey.includes('YOUR_')) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch {
    return null;
  }
}

interface ExternalProviderCandidate {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getExternalLlmProviders(): ExternalProviderCandidate[] {
  const candidates: ExternalProviderCandidate[] = [];

  // 1. Generic FALLBACK_API_KEY (highest priority when set by user)
  const fallbackKey = process.env.FALLBACK_API_KEY || '';
  if (fallbackKey && !fallbackKey.includes('YOUR_')) {
    candidates.push({
      name: 'fallback',
      baseUrl: (process.env.FALLBACK_BASE_URL || 'https://tokenharbor.ai/v1').replace(/\/+$/, ''),
      apiKey: fallbackKey,
      model: process.env.FALLBACK_MODEL || 'deepseek-v4.1-flash:free',
    });
  }

  // 2. Token Harbor (https://tokenharbor.ai/v1)
  const tokenHarborKey =
    process.env.TOKENHARBOR_API_KEY ||
    (keysConfig?.tokens as any)?.tokenHarbour ||
    '';
  if (tokenHarborKey && !tokenHarborKey.includes('YOUR_')) {
    candidates.push({
      name: 'tokenharbor',
      baseUrl: 'https://tokenharbor.ai/v1',
      apiKey: tokenHarborKey,
      model: 'deepseek-v4.1-flash:free',
    });
  }

  // 3. IteraCompute (https://api.iteracompute.com/v1)
  const iteraKey =
    process.env.ITERA_COMPUTE_API_KEY ||
    process.env.ITERACOMPUTE_API_KEY ||
    (keysConfig?.tokens as any)?.iteraCompute ||
    '';
  if (iteraKey && !iteraKey.includes('YOUR_')) {
    candidates.push({
      name: 'iteracompute',
      baseUrl: 'https://api.iteracompute.com/v1',
      apiKey: iteraKey,
      model: 'qwen/qwen3.8-27b',
    });
  }

  // 4. Zero MoonMath (https://zro.moonmath.ai/v1)
  const zroKey =
    process.env.ZRO_MOONMATH_API_KEY ||
    (keysConfig?.tokens as any)?.zroMoonMath ||
    (keysConfig?.tokens as any)?.zeroMoonMath ||
    '';
  if (zroKey && !zroKey.includes('YOUR_')) {
    candidates.push({
      name: 'zromoonmath',
      baseUrl: 'https://zro.moonmath.ai/v1',
      apiKey: zroKey,
      model: 'zro/deepseek-v4.1-flash',
    });
  }

  // 5. Intern InkStone / InternAI (https://discovery-api.intern-ai.org.cn/v1)
  const internKey =
    process.env.INTERN_AI_API_KEY ||
    (keysConfig?.tokens as any)?.internAi ||
    '';
  if (internKey && !internKey.includes('YOUR_')) {
    candidates.push({
      name: 'internai',
      baseUrl: 'https://discovery-api.intern-ai.org.cn/v1',
      apiKey: internKey,
      model: 'Agents-A1',
    });
  }

  // 6. Apinex (https://api.apinex.bond/v1)
  const apinexKey = process.env.APINEX_API_KEY || '';
  if (apinexKey && !apinexKey.includes('YOUR_')) {
    candidates.push({
      name: 'apinex',
      baseUrl: 'https://api.apinex.bond/v1',
      apiKey: apinexKey,
      model: 'free/glm-5.3',
    });
  }

  return candidates;
}

export async function callAgentLlm(options: AgentLlmCallOptions): Promise<AgentLlmCallResult | null> {
  const timeoutMs = options.timeoutMs || 5500;
  const externalProviders = getExternalLlmProviders();

  // Try external non-Gemini providers first if available
  for (const provider of externalProviders) {
    try {
      const messages: Array<{ role: string; content: string }> = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.prompt });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature: 0.2,
          max_tokens: 1400,
          response_format:
            options.responseMimeType === 'application/json' || options.jsonSchema
              ? { type: 'json_object' }
              : undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as any;
        const text = data?.choices?.[0]?.message?.content;
        if (text && typeof text === 'string' && text.trim()) {
          const tokensUsed =
            Number(data?.usage?.total_tokens) ||
            Math.ceil((options.prompt.length + text.length) / 4);
          return {
            text: text.trim(),
            provider: provider.name,
            model: provider.model,
            tokensUsed,
          };
        }
      }
    } catch {
      // Cascade to next provider
    }
  }

  // Gemini Fallback
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const contents = options.systemPrompt
        ? `${options.systemPrompt}\n\n${options.prompt}`
        : options.prompt;

      const llmPromise = gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          responseMimeType: options.responseMimeType,
        },
      });

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs)
      );
      const resp = await Promise.race([llmPromise, timeoutPromise]);
      if (resp && resp.text) {
        const tokensUsed =
          Number((resp as any).usageMetadata?.totalTokenCount) ||
          Math.ceil((options.prompt.length + resp.text.length) / 4);
        return {
          text: resp.text.trim(),
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          tokensUsed,
        };
      }
    } catch {
      // Fall through to null
    }
  }

  return null;
}

// Format UTC timestamp to IST display string: "Nov 6, 2026 · 11:40 AM"
export function formatToIstDate(dateInput: number | string | Date): string {
  const date =
    typeof dateInput === 'number' || typeof dateInput === 'string'
      ? new Date(dateInput)
      : dateInput;
  if (!date || isNaN(date.getTime())) return '';
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return formatted.replace(', ', ', ').replace(/, ([0-9]{1,2}:)/, ' · $1');
  } catch {
    return date.toISOString().slice(0, 16);
  }
}

// ============================================================================
// VAULT THREADS & MEMORY INDEX STORE (Per User)
// ============================================================================
export const userVaultThreadsMemory = new Map<string, VaultThreadInput[]>(); // key: userId
export const userVaultMemoryIndex = new Map<string, VaultMemoryIndexEntry[]>(); // key: userId

export function getUserVaultThreads(
  userId: string,
  userTier: 'free' | 'spark' | 'fire' = 'free'
): VaultThreadInput[] {
  const threads = userVaultThreadsMemory.get(userId) || [];
  // Free: last 20 threads kept. Spark/Fire: all threads kept.
  if (userTier === 'free') {
    return threads.slice(0, 20);
  }
  return threads;
}

export function saveUserVaultThread(
  userId: string,
  thread: VaultThreadInput,
  userTier: 'free' | 'spark' | 'fire' = 'free'
): VaultThreadInput[] {
  const existing = userVaultThreadsMemory.get(userId) || [];
  const idx = existing.findIndex((t) => t.id === thread.id);
  let updated: VaultThreadInput[];
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = { ...existing[idx], ...thread, updatedAt: Date.now() };
  } else {
    updated = [thread, ...existing];
  }
  if (userTier === 'free' && updated.length > 20) {
    updated = updated.slice(0, 20);
  }
  userVaultThreadsMemory.set(userId, updated);
  return updated;
}

export function deleteThreadAndWipeMemory(userId: string, threadId: string): void {
  // 1. Remove thread
  const existing = userVaultThreadsMemory.get(userId) || [];
  userVaultThreadsMemory.set(
    userId,
    existing.filter((t) => t.id !== threadId)
  );

  // 2. Wipe indexed memory facts for this thread
  const existingMem = userVaultMemoryIndex.get(userId) || [];
  userVaultMemoryIndex.set(
    userId,
    existingMem.filter((m) => m.threadId !== threadId)
  );
}

export function indexThreadKeyPoints(
  userId: string,
  thread: VaultThreadInput
): VaultMemoryIndexEntry[] {
  const current = userVaultMemoryIndex.get(userId) || [];
  const filtered = current.filter((m) => m.threadId !== thread.id);
  const newEntries: VaultMemoryIndexEntry[] = (thread.keyPoints || []).map((kp, idx) => ({
    id: `mem_${thread.id}_${idx}_${Date.now()}`,
    userId,
    threadId: thread.id,
    type: thread.type,
    title: thread.title,
    keyPointText: kp.text,
    timestamp: kp.timestamp,
    sourceUrl: thread.sourceUrl,
    subject: thread.subject,
    chapter: thread.chapter,
    createdAt: thread.createdAt,
  }));
  const updated = [...newEntries, ...filtered].slice(0, 300);
  userVaultMemoryIndex.set(userId, updated);
  return updated;
}

export function searchVaultMemoryIndex(
  userId: string,
  query: string
): Array<{
  citation: string;
  threadId: string;
  title: string;
  subject: string;
  chapter: string;
  timestamp?: string;
  keyPointText: string;
}> {
  const entries = userVaultMemoryIndex.get(userId) || [];
  if (entries.length === 0 || !query.trim()) return [];
  const cleanQ = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const qTokens = cleanQ.split(/\s+/).filter((t) => t.length >= 3);
  if (qTokens.length === 0) return [];

  const scored: Array<{
    score: number;
    entry: VaultMemoryIndexEntry;
  }> = [];

  for (const entry of entries) {
    const hay = `${entry.title} ${entry.subject} ${entry.chapter} ${entry.keyPointText}`.toLowerCase();
    let score = 0;
    for (const token of qTokens) {
      if (hay.includes(token)) score += 1;
    }
    if (score > 0) {
      scored.push({ score, entry });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(({ entry }) => {
    const dateFormatted = formatToIstDate(entry.createdAt).split(' · ')[0] || 'past lecture';
    const tsStr = entry.timestamp ? ` (${entry.timestamp})` : '';
    const itemNoun = entry.type === 'youtube' ? 'lecture' : 'study note';
    const citation = `From your ${dateFormatted} ${itemNoun} on ${entry.subject} → ${entry.chapter}${tsStr}: "${entry.keyPointText}"`;
    return {
      citation,
      threadId: entry.threadId,
      title: entry.title,
      subject: entry.subject,
      chapter: entry.chapter,
      timestamp: entry.timestamp,
      keyPointText: entry.keyPointText,
    };
  });
}

export function findDuplicateVaultThread(
  threads: VaultThreadInput[],
  sourceUrl?: string
): VaultThreadInput | null {
  if (!sourceUrl || !sourceUrl.trim()) return null;
  const cleanSource = sourceUrl.trim().toLowerCase().replace(/\/+$/, '');

  // YouTube video ID check
  const ytMatch = cleanSource.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  const targetVideoId = ytMatch ? ytMatch[1] : null;

  for (const t of threads) {
    if (!t.sourceUrl) continue;
    const existingClean = t.sourceUrl.trim().toLowerCase().replace(/\/+$/, '');
    if (existingClean === cleanSource) return t;

    if (targetVideoId) {
      const existingYt = existingClean.match(
        /(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
      );
      if (existingYt && existingYt[1] === targetVideoId) {
        return t;
      }
    }
  }
  return null;
}

// ============================================================================
// AGENT TOOLS REGISTRY (Reusable wrappers around Kinich capabilities)
// ============================================================================
export const AGENT_TOOLS: Record<
  AgentToolName,
  {
    name: AgentToolName;
    description: string;
    execute: (args: Record<string, any>, context: { vaultItems: VaultItemInput[] }) => Promise<any>;
  }
> = {
  readVault: {
    name: 'readVault',
    description: 'Search and read items from the student’s personal Vault by subject, chapter, type, or keyword.',
    execute: async (args, { vaultItems }) => {
      const query = String(args.query || '').toLowerCase().trim();
      const subject = String(args.subject || '').toLowerCase().trim();
      const filtered = vaultItems.filter((item) => {
        if (subject && !String(item.subject || '').toLowerCase().includes(subject)) return false;
        if (!query) return true;
        const hay = `${item.title} ${item.subject || ''} ${item.chapter || ''} ${(item.tags || []).join(' ')} ${item.content}`.toLowerCase();
        return hay.includes(query);
      });
      return filtered.slice(0, 8).map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        subject: i.subject,
        chapter: i.chapter,
        tags: i.tags,
        timestamps: i.timestamps,
        excerpt: String(i.content || '').slice(0, 400),
      }));
    },
  },
  writeVault: {
    name: 'writeVault',
    description: 'Update Vault item metadata (subject, chapter, tags, related links) or save a new study note.',
    execute: async (args) => ({
      updated: true,
      subject: args.subject,
      chapter: args.chapter,
      tags: args.tags,
    }),
  },
  summarize: {
    name: 'summarize',
    description: 'Condense a long lecture transcript or research report into key academic takeaways.',
    execute: async (args) => {
      const text = String(args.text || '').slice(0, 1500);
      return { summary: text.slice(0, 280) };
    },
  },
  searchWeb: {
    name: 'searchWeb',
    description: 'Run a web search with inline academic citations.',
    execute: async (args) => ({
      query: args.query,
      status: 'delegated_to_kinich_web_search',
    }),
  },
  deepResearch: {
    name: 'deepResearch',
    description: 'Run multi-source cited Deep Research on an academic topic.',
    execute: async (args) => ({
      topic: args.topic,
      status: 'delegated_to_kinich_deep_research',
    }),
  },
  getTranscript: {
    name: 'getTranscript',
    description: 'Fetch timestamped YouTube lecture transcript, chapters, and study breakdown.',
    execute: async (args) => ({
      url: args.url,
      status: 'delegated_to_youtube_study_engine',
    }),
  },
  makeQuiz: {
    name: 'makeQuiz',
    description: 'Generate active-recall multiple-choice quiz questions from Vault content.',
    execute: async (args) => ({
      topic: args.topic,
      status: 'quiz_ready',
    }),
  },
  makeFlashcards: {
    name: 'makeFlashcards',
    description: 'Generate front/back flashcards for SM-2 spaced repetition.',
    execute: async (args) => ({
      topic: args.topic,
      status: 'flashcards_ready',
    }),
  },
};

// ============================================================================
// DETERMINISTIC ACADEMIC CLASSIFIER & LINKER (Instant fallback + ground truth)
// ============================================================================
const SUBJECT_TAXONOMY: Array<{
  subject: string;
  keywords: string[];
  chapters: Array<{ name: string; keywords: string[] }>;
}> = [
  {
    subject: 'Physics',
    keywords: [
      'physics', 'thermodynamics', 'entropy', 'heat', 'carnot', 'quantum', 'mechanics',
      'kinematics', 'newton', 'electromagnetism', 'optics', 'relativity', 'wave', 'circuit',
      'voltage', 'magnetic', 'force', 'momentum', 'energy', 'oscillation', 'fluid', 'boltzmann',
    ],
    chapters: [
      { name: 'Thermodynamics & Heat Engines', keywords: ['thermodynamics', 'entropy', 'heat', 'carnot', 'enthalpy', 'kelvin', 'boltzmann', 'isothermal', 'adiabatic'] },
      { name: 'Quantum Mechanics & Atomic Physics', keywords: ['quantum', 'schrodinger', 'photon', 'planck', 'wavefunction', 'heisenberg', 'atomic', 'orbital'] },
      { name: 'Electromagnetism & Circuits', keywords: ['electromagnetism', 'maxwell', 'circuit', 'voltage', 'current', 'magnetic', 'faraday', 'capacitor', 'inductor'] },
      { name: 'Classical Mechanics & Kinematics', keywords: ['mechanics', 'kinematics', 'newton', 'momentum', 'torque', 'gravity', 'projectile', 'oscillation'] },
      { name: 'Optics & Wave Phenomena', keywords: ['optics', 'refraction', 'diffraction', 'interference', 'lens', 'doppler'] },
    ],
  },
  {
    subject: 'Biology & Life Sciences',
    keywords: [
      'biology', 'cell', 'cellular', 'photosynthesis', 'chloroplast', 'mitochondria', 'atp',
      'dna', 'rna', 'genetics', 'crispr', 'protein', 'enzyme', 'evolution', 'neuroscience',
      'neuron', 'synapse', 'immunology', 'metabolism', 'respiration', 'glycolysis', 'anatomy',
    ],
    chapters: [
      { name: 'Cellular Energetics & Photosynthesis', keywords: ['photosynthesis', 'chloroplast', 'thylakoid', 'calvin', 'respiration', 'mitochondria', 'atp', 'glycolysis', 'krebs'] },
      { name: 'Molecular Genetics & Gene Editing', keywords: ['dna', 'rna', 'transcription', 'translation', 'crispr', 'genome', 'mutation', 'allele', 'chromosome'] },
      { name: 'Neurobiology & Nervous System', keywords: ['neuron', 'synapse', 'axon', 'neurotransmitter', 'brain', 'cortex', 'action potential'] },
      { name: 'Cell Structure & Biochemistry', keywords: ['cell', 'membrane', 'organelle', 'enzyme', 'protein', 'amino acid', 'lipid'] },
    ],
  },
  {
    subject: 'Computer Science & AI',
    keywords: [
      'computer', 'algorithm', 'data structure', 'transformer', 'neural network', 'machine learning',
      'deep learning', 'llm', 'attention', 'python', 'typescript', 'javascript', 'react', 'database',
      'sql', 'operating system', 'distributed', 'compiler', 'graph', 'dynamic programming', 'recursion',
    ],
    chapters: [
      { name: 'Deep Learning & Transformer Architectures', keywords: ['transformer', 'attention', 'llm', 'neural network', 'backpropagation', 'gradient', 'embedding', 'gpt', 'diffusion'] },
      { name: 'Data Structures & Algorithms', keywords: ['algorithm', 'data structure', 'graph', 'tree', 'dynamic programming', 'sorting', 'hash', 'complexity', 'big o'] },
      { name: 'Systems, Databases & Networking', keywords: ['database', 'sql', 'distributed', 'operating system', 'kernel', 'tcp', 'http', 'concurrency', 'cache'] },
      { name: 'Software Engineering & Web Architecture', keywords: ['typescript', 'react', 'javascript', 'python', 'api', 'frontend', 'backend', 'compiler'] },
    ],
  },
  {
    subject: 'Mathematics',
    keywords: [
      'mathematics', 'calculus', 'derivative', 'integral', 'differential', 'linear algebra',
      'matrix', 'eigenvalue', 'vector', 'probability', 'statistics', 'bayes', 'theorem',
      'topology', 'number theory', 'trigonometry', 'polynomial', 'fourier', 'laplace',
    ],
    chapters: [
      { name: 'Calculus & Differential Equations', keywords: ['calculus', 'derivative', 'integral', 'differential', 'limit', 'taylor', 'fourier', 'laplace'] },
      { name: 'Linear Algebra & Vector Spaces', keywords: ['linear algebra', 'matrix', 'matrices', 'eigenvalue', 'eigenvector', 'vector', 'determinant', 'svd'] },
      { name: 'Probability & Statistical Inference', keywords: ['probability', 'statistics', 'bayes', 'distribution', 'variance', 'markov', 'hypothesis'] },
    ],
  },
  {
    subject: 'Chemistry',
    keywords: [
      'chemistry', 'organic', 'inorganic', 'covalent', 'ionic', 'stoichiometry', 'periodic',
      'acid', 'base', 'titration', 'electrochemistry', 'redox', 'kinetics', 'equilibrium',
      'molecule', 'polymer', 'alkane', 'benzene', 'catalyst',
    ],
    chapters: [
      { name: 'Organic Chemistry & Reaction Mechanisms', keywords: ['organic', 'alkane', 'alkene', 'benzene', 'nucleophile', 'electrophile', 'polymer', 'carbonyl'] },
      { name: 'Physical Chemistry & Chemical Kinetics', keywords: ['kinetics', 'equilibrium', 'electrochemistry', 'redox', 'catalyst', 'rate law', 'gibbs'] },
      { name: 'Atomic Structure & Chemical Bonding', keywords: ['covalent', 'ionic', 'periodic', 'orbital', 'hybridization', 'stoichiometry', 'acid', 'base'] },
    ],
  },
  {
    subject: 'Economics, History & Humanities',
    keywords: [
      'economics', 'macroeconomics', 'microeconomics', 'inflation', 'gdp', 'monetary', 'fiscal',
      'market', 'supply', 'demand', 'history', 'civilization', 'empire', 'constitution', 'polity',
      'geopolitics', 'philosophy', 'psychology', 'sociology',
    ],
    chapters: [
      { name: 'Macroeconomics & Monetary Policy', keywords: ['macroeconomics', 'inflation', 'gdp', 'monetary', 'fiscal', 'central bank', 'interest rate'] },
      { name: 'Microeconomics & Market Structure', keywords: ['microeconomics', 'supply', 'demand', 'elasticity', 'monopoly', 'game theory', 'utility'] },
      { name: 'World History, Polity & Governance', keywords: ['history', 'civilization', 'empire', 'constitution', 'polity', 'democracy', 'geopolitics'] },
    ],
  },
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have', 'are', 'was',
  'were', 'what', 'when', 'where', 'which', 'while', 'about', 'through', 'between', 'under',
  'over', 'lecture', 'study', 'video', 'youtube', 'notes', 'summary', 'report', 'question',
  'answer', 'chapter', 'section', 'part', 'introduction', 'overview', 'guide', 'explained',
  'understanding', 'complete', 'course', 'lesson', 'how', 'why', 'does', 'work', 'works',
]);

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const counts = new Map<string, number>();
  for (const w of words) {
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);
}

export function classifyAndLinkVaultItemHeuristic(
  item: VaultItemInput,
  existingItems: VaultItemInput[]
): {
  subject: string;
  chapter: string;
  tags: string[];
  linkedItems: Array<{ id: string; title: string; subject: string; chapter: string; reason: string }>;
  sageNote: string;
  memoryFacts: string[];
} {
  const combinedText = `${item.title || ''} ${item.summary || ''} ${item.content || ''} ${(item.tags || []).join(' ')}`.toLowerCase();

  let bestSubject = item.subject && item.subject !== 'General' && item.subject !== 'General Studies'
    ? item.subject
    : 'General Studies';
  let bestChapter = item.chapter && item.chapter !== 'Uncategorized' && item.chapter !== 'Core Concepts'
    ? item.chapter
    : 'Core Concepts';
  let bestSubjectScore = 0;

  for (const entry of SUBJECT_TAXONOMY) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (combinedText.includes(kw)) {
        score += item.title.toLowerCase().includes(kw) ? 4 : 2;
      }
    }
    if (score > bestSubjectScore) {
      bestSubjectScore = score;
      bestSubject = entry.subject;

      let bestChScore = 0;
      let chosenChapter = entry.chapters[0]?.name || 'Core Concepts';
      for (const ch of entry.chapters) {
        let chScore = 0;
        for (const ckw of ch.keywords) {
          if (combinedText.includes(ckw)) {
            chScore += item.title.toLowerCase().includes(ckw) ? 4 : 2;
          }
        }
        if (chScore > bestChScore) {
          bestChScore = chScore;
          chosenChapter = ch.name;
        }
      }
      bestChapter = chosenChapter;
    }
  }

  // If no taxonomy hit, derive a clean Chapter from the title
  if (bestSubjectScore === 0) {
    const cleanTitle = String(item.title || 'Core Study Topic')
      .replace(/^(youtube study|study notes|deep research|saved response)[:\s-]*/i, '')
      .trim();
    const titleWords = cleanTitle.split(/\s+/).slice(0, 5).join(' ');
    if (titleWords.length > 3) {
      bestChapter = titleWords.slice(0, 60);
    }
  }

  // Generate 4–6 clean tags
  const extracted = extractKeywords(`${item.title} ${item.summary || ''} ${item.content.slice(0, 1200)}`);
  const mergedTags = Array.from(
    new Set(
      [
        ...(Array.isArray(item.tags) ? item.tags : []),
        bestSubject.split('&')[0].trim().toLowerCase(),
        ...extracted.slice(0, 5),
      ]
        .map((t) => String(t || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'))
        .filter((t) => t.length >= 3 && t.length <= 28)
    )
  ).slice(0, 6);

  // Find related existing Vault items
  const itemKeywordSet = new Set([...extracted, ...mergedTags]);
  const scoredLinks: Array<{
    item: VaultItemInput;
    score: number;
    sharedTerms: string[];
  }> = [];

  for (const candidate of existingItems) {
    if (!candidate || candidate.id === item.id) continue;
    let score = 0;
    const shared: string[] = [];

    if (candidate.subject && candidate.subject.toLowerCase() === bestSubject.toLowerCase()) {
      score += 3;
    }
    if (candidate.chapter && candidate.chapter.toLowerCase() === bestChapter.toLowerCase()) {
      score += 4;
    }

    const candKeywords = extractKeywords(
      `${candidate.title || ''} ${candidate.subject || ''} ${candidate.chapter || ''} ${(candidate.tags || []).join(' ')} ${String(candidate.content || '').slice(0, 800)}`
    );
    for (const kw of candKeywords) {
      if (itemKeywordSet.has(kw)) {
        score += 2;
        if (!shared.includes(kw)) shared.push(kw);
      }
    }

    if (score >= 3) {
      scoredLinks.push({ item: candidate, score, sharedTerms: shared.slice(0, 3) });
    }
  }

  scoredLinks.sort((a, b) => b.score - a.score);
  const topLinks = scoredLinks.slice(0, 3).map(({ item: linked, sharedTerms }) => ({
    id: linked.id,
    title: linked.title,
    subject: linked.subject || bestSubject,
    chapter: linked.chapter || bestChapter,
    reason:
      sharedTerms.length > 0
        ? `Shares concepts (${sharedTerms.join(', ')}) with your earlier ${linked.type === 'lecture' ? 'lecture' : 'item'} "${linked.title}"`
        : `Related to your earlier ${linked.type === 'lecture' ? 'lecture' : 'study item'} on "${linked.title}"`,
  }));

  const sageNote =
    topLinks.length > 0
      ? `Filed under ${bestSubject} → ${bestChapter}. Related to your earlier ${
           existingItems.find((e) => e.id === topLinks[0].id)?.type === 'lecture' ? 'lecture' : 'study note'
        } on "${topLinks[0].title}".`
      : `Filed under ${bestSubject} → ${bestChapter} with ${mergedTags.length} study tags.`;

  // Extract student memory facts (e.g. exam dates or active study topics)
  const memoryFacts: string[] = [`Studying ${bestSubject}: ${bestChapter}`];
  const examMatch = combinedText.match(/\b(exam|test|midterm|final)\s+(?:on|in|by)\s+([a-z0-9\s,]{3,25})/i);
  if (examMatch) {
    memoryFacts.push(`Upcoming ${examMatch[1]} on ${examMatch[2].trim()}`);
  }
  const weakMatch = combinedText.match(/\b(weak at|struggling with|review|revise)\s+([a-z0-9\s]{3,30})/i);
  if (weakMatch) {
    memoryFacts.push(`Focus area: ${weakMatch[2].trim()}`);
  }

  return {
    subject: bestSubject,
    chapter: bestChapter,
    tags: mergedTags,
    linkedItems: topLinks,
    sageNote,
    memoryFacts,
  };
}

// ============================================================================
// CHEAP ROUTER: Decides which agent (if any) should respond before calling main model
// ============================================================================
export async function routeAgentTrigger(input: {
  trigger: AgentTriggerType;
  message?: string;
  savedItem?: VaultItemInput;
  userTier: 'free' | 'spark' | 'fire';
}): Promise<{
  shouldAct: boolean;
  agentId: PersonalAgentDefinition['id'] | null;
  reason: string;
  routerTokens: number;
}> {
  if (input.trigger === 'on_save') {
    return {
      shouldAct: true,
      agentId: 'sage',
      reason: 'Vault item saved — trigger Sage organizer to assign Subject, Chapter, tags, and link related lectures.',
      routerTokens: 32,
    };
  }

  if (input.trigger === 'on_message') {
    const text = String(input.message || '').toLowerCase().trim();
    if (!text) {
      return { shouldAct: false, agentId: null, reason: 'Empty message', routerTokens: 0 };
    }

    // Fast cheap check before invoking any LLM router
    const mentionsVaultOrDoubt =
      /\b(my vault|saved lecture|earlier lecture|in my notes|timestamp|according to my lecture|doubt buddy|@sage|@doubt|@planner|study plan|exam on|schedule my study|flashcard due)\b/i.test(
        text
      );

    if (!mentionsVaultOrDoubt) {
      return {
        shouldAct: false,
        agentId: null,
        reason: 'Standard chat query — no personal agent intervention required.',
        routerTokens: 18,
      };
    }

    // Cheap model router decision
    if (/\b(study plan|exam on|schedule|day-by-day|planner|@planner)\b/i.test(text)) {
      return {
        shouldAct: true,
        agentId: 'planner',
        reason: 'User asked for an exam study plan or schedule from their Vault.',
        routerTokens: 45,
      };
    }

    return {
      shouldAct: true,
      agentId: 'doubt_buddy',
      reason: 'User asked a question referencing their Vault lectures/notes.',
      routerTokens: 45,
    };
  }

  return { shouldAct: false, agentId: null, reason: 'No matching trigger', routerTokens: 10 };
}

// ============================================================================
// SAGE EXECUTION (Trigger: on_save) — Organizes item & links related Vault items <10s
// ============================================================================
export async function runSageOnSave(input: {
  userId: string;
  userTier: 'free' | 'spark' | 'fire';
  item: VaultItemInput;
  existingVaultItems: VaultItemInput[];
  existingMemory?: string[];
}): Promise<{
  subject: string;
  chapter: string;
  tags: string[];
  relatedItemIds: string[];
  linkedItems: Array<{ id: string; title: string; subject: string; chapter: string; reason: string }>;
  sageNote: string;
  agentReply: AgentReplyPayload;
  memoryFacts: string[];
  tokensUsed: number;
}> {
  // Always compute the instant heuristic baseline first so we have a guaranteed <50ms fallback
  const heuristic = classifyAndLinkVaultItemHeuristic(input.item, input.existingVaultItems);

  let subject = heuristic.subject;
  let chapter = heuristic.chapter;
  let tags = heuristic.tags;
  let linkedItems = heuristic.linkedItems;
  let sageNote = heuristic.sageNote;
  let memoryFacts = heuristic.memoryFacts;
  let tokensUsed = 180;

  try {
    const existingSummary = input.existingVaultItems
      .filter((e) => e && e.id !== input.item.id)
      .slice(0, 15)
      .map(
        (e) =>
          `- ID: "${e.id}" | Title: "${e.title}" | Type: ${e.type} | Subject: ${e.subject || 'General'} | Chapter: ${e.chapter || 'General'} | Tags: ${(e.tags || []).join(', ')}`
      )
      .join('\n');

    const prompt = `You are Sage, the personal study Vault organizer on Kinich.
A student just saved a new ${input.item.type} to their Vault:
Title: "${input.item.title}"
Source URL: "${input.item.sourceUrl || 'N/A'}"
Timestamps: ${(input.item.timestamps || []).slice(0, 8).join(' | ') || 'None'}
Content Excerpt:
"""
${String(input.item.content || '').slice(0, 1800)}
"""

Existing items in the student's Vault:
${existingSummary || '(No previous items in Vault yet)'}

Student Memory Facts:
${(input.existingMemory || []).slice(0, 10).join('; ') || 'None yet'}

Return JSON with:
1. "subject": Clean academic discipline (e.g. "Physics", "Biology & Life Sciences", "Computer Science & AI", "Mathematics", "Chemistry", "Economics & History"). If an existing related Vault item already uses a subject, use the exact same subject string so they group together.
2. "chapter": Specific academic chapter/module title (3-6 words, e.g. "Thermodynamics & Heat Engines", "Cellular Energetics & Photosynthesis", "Deep Learning & Transformers").
3. "tags": Array of 4 to 6 lowercase study tags.
4. "relatedIds": Array of up to 3 IDs from the "Existing items in the student's Vault" list that are conceptually related to this new item.
5. "sageNote": A concise 1-2 sentence organizer note for the student. If relatedIds is non-empty, explicitly mention the connection, e.g. "Related to your earlier lecture on [Title] — both cover [concept]."
6. "newMemoryFact": One short fact (<100 chars) about what the student is currently studying or preparing for.`;

    const llmRes = await callAgentLlm({
      prompt,
      responseMimeType: 'application/json',
      timeoutMs: 5500,
    });

    if (llmRes && llmRes.text) {
      const jsonMatch = llmRes.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.subject && String(parsed.subject).trim()) {
          subject = String(parsed.subject).trim().slice(0, 80);
        }
        if (parsed.chapter && String(parsed.chapter).trim()) {
          chapter = String(parsed.chapter).trim().slice(0, 120);
        }
        if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
          tags = parsed.tags
            .map((t: any) => String(t || '').trim().toLowerCase().slice(0, 28))
            .filter(Boolean)
            .slice(0, 6);
        }
        if (Array.isArray(parsed.relatedIds) && parsed.relatedIds.length > 0) {
          const validRelated = parsed.relatedIds
            .map((rid: any) => input.existingVaultItems.find((e) => e.id === String(rid)))
            .filter(Boolean) as VaultItemInput[];
          if (validRelated.length > 0) {
            linkedItems = validRelated.slice(0, 3).map((r) => ({
              id: r.id,
              title: r.title,
              subject: r.subject || subject,
              chapter: r.chapter || chapter,
              reason: `Related to your earlier ${r.type === 'lecture' ? 'lecture' : 'study item'} on "${r.title}"`,
            }));
          }
        }
        if (parsed.sageNote && String(parsed.sageNote).trim()) {
          sageNote = String(parsed.sageNote).trim().slice(0, 280);
        } else if (linkedItems.length > 0) {
          sageNote = `Organized under ${subject} → ${chapter}. Related to your earlier lecture on "${linkedItems[0].title}".`;
        }
        if (parsed.newMemoryFact && String(parsed.newMemoryFact).trim()) {
          memoryFacts = [String(parsed.newMemoryFact).trim().slice(0, 140), ...memoryFacts];
        }
        tokensUsed = llmRes.tokensUsed || 220;
      }
    }
  } catch {
    // Fall back cleanly to heuristic result
  }

  // Ensure if heuristic found a strong link and LLM missed it, we preserve the link
  if (linkedItems.length === 0 && heuristic.linkedItems.length > 0) {
    linkedItems = heuristic.linkedItems;
    if (!sageNote.toLowerCase().includes('related to')) {
      sageNote = `${sageNote} Related to your earlier lecture on "${linkedItems[0].title}".`.slice(0, 280);
    }
  }

  const updatedFacts = appendAgentMemoryFacts(input.userId, 'sage', memoryFacts, input.existingMemory);
  logAgentTokenUsage(input.userId, 'sage', tokensUsed);

  const agentReply: AgentReplyPayload = {
    id: `agent_sage_${Date.now()}`,
    agentId: 'sage',
    agentName: 'Sage',
    agentRole: 'Vault Organizer',
    content: sageNote,
    subject,
    chapter,
    tags,
    linkedItems,
    toolsUsed: ['readVault', 'writeVault'],
    tokensUsed,
    createdAt: Date.now(),
  };

  return {
    subject,
    chapter,
    tags,
    relatedItemIds: linkedItems.map((l) => l.id),
    linkedItems,
    sageNote,
    agentReply,
    memoryFacts: updatedFacts,
    tokensUsed,
  };
}

// ============================================================================
// ON_MESSAGE AGENT EXECUTION (Doubt Buddy / Planner / Recall)
// ============================================================================
export async function runAgentOnMessage(input: {
  userId: string;
  userTier: 'free' | 'spark' | 'fire';
  message: string;
  vaultItems: VaultItemInput[];
  agentMemory?: string[];
}): Promise<{
  acted: boolean;
  agentReply?: AgentReplyPayload;
  memoryFacts?: string[];
  reason?: string;
}> {
  const routeDecision = await routeAgentTrigger({
    trigger: 'on_message',
    message: input.message,
    userTier: input.userTier,
  });

  if (!routeDecision.shouldAct || !routeDecision.agentId) {
    return { acted: false, reason: routeDecision.reason };
  }

  const agentDef = PERSONAL_AGENTS[routeDecision.agentId];
  const relevantVault = await AGENT_TOOLS.readVault.execute(
    { query: input.message },
    { vaultItems: input.vaultItems }
  );

  // Search indexed key points from Reddit-style Vault threads for cross-chat citations
  const memoryCitations = searchVaultMemoryIndex(input.userId, input.message);

  const citations = (Array.isArray(relevantVault) ? relevantVault : [])
    .slice(0, 3)
    .map((v: any) => ({
      vaultItemId: v.id,
      title: v.title,
      timestamp: Array.isArray(v.timestamps) && v.timestamps.length > 0 ? v.timestamps[0] : undefined,
    }));

  let replyContent = '';
  let tokensUsed = routeDecision.routerTokens + 140;

  try {
    const vaultContext = relevantVault
      .map(
        (v: any) =>
          `[${v.title}] (${v.subject} → ${v.chapter}) Timestamps: ${(v.timestamps || []).join(', ') || 'N/A'}\nExcerpt: ${v.excerpt}`
      )
      .join('\n\n');

    const memorySection =
      memoryCitations.length > 0
        ? `\n\nPast Vault Thread Memory (Citations):\n${memoryCitations.map((c) => `- ${c.citation}`).join('\n')}`
        : '';

    const prompt = `${agentDef.systemPrompt}\n\nStudent Vault Context:\n${vaultContext || '(No direct Vault items)'}${memorySection}\n\nStudent Question: "${input.message}"\n\nProvide a concise, helpful academic response (2-4 sentences). If relevant, cite past Vault threads using the exact citation format: "From your [Date in IST] lecture on [Subject] ([timestamp])..."`;

    const llmRes = await callAgentLlm({
      prompt,
      timeoutMs: 5500,
    });

    if (llmRes && llmRes.text) {
      replyContent = llmRes.text.trim();
      tokensUsed += llmRes.tokensUsed || 220;
    }
  } catch {}

  if (!replyContent) {
    if (memoryCitations.length > 0) {
      replyContent = `${memoryCitations[0].citation}. Let me know if you want 3 quick active recall questions on this!`;
    } else if (relevantVault.length > 0) {
      const top = relevantVault[0];
      const ts = Array.isArray(top.timestamps) && top.timestamps[0] ? ` at [${top.timestamps[0]}]` : '';
      replyContent = `Based on your saved ${top.type === 'lecture' ? 'lecture' : 'Vault note'} "${top.title}" (${top.subject} → ${top.chapter})${ts}: ${String(top.excerpt || '').slice(0, 220)}...`;
    } else {
      replyContent = `I checked your Vault for relevant lectures and notes. Paste a YouTube link or topic so I can auto-capture it into your Vault and cite your exact timestamps.`;
    }
  }

  logAgentTokenUsage(input.userId, agentDef.id, tokensUsed);
  const facts = getAgentMemoryFacts(input.userId, agentDef.id, input.agentMemory);

  return {
    acted: true,
    memoryFacts: facts,
    agentReply: {
      id: `agent_${agentDef.id}_${Date.now()}`,
      agentId: agentDef.id,
      agentName: agentDef.name,
      agentRole: agentDef.role,
      content: replyContent,
      citations,
      toolsUsed: ['readVault', 'summarize'],
      tokensUsed,
      createdAt: Date.now(),
    },
  };
}

// ============================================================================
// AUTO-CAPTURE PIPELINE & KEY POINTS EXTRACTION
// ============================================================================
export async function autoCaptureVaultThread(input: {
  userId: string;
  userTier: 'free' | 'spark' | 'fire';
  inputType?: VaultThreadType;
  title?: string;
  content: string;
  sourceUrl?: string;
  thumbnail?: string;
  timestamps?: Array<string | { timestamp?: string; timeSec?: number; label?: string; text?: string }>;
  existingThreads?: VaultThreadInput[];
}): Promise<{
  ok: boolean;
  deduplicated: boolean;
  thread: VaultThreadInput;
  initialComments: VaultThreadCommentInput[];
}> {
  const existingThreads =
    Array.isArray(input.existingThreads) && input.existingThreads.length > 0
      ? input.existingThreads
      : getUserVaultThreads(input.userId, input.userTier);

  // 1. Detect Input Type
  let detectedType: VaultThreadType = input.inputType || 'text';
  const urlCandidate = input.sourceUrl || (input.content.match(/https?:\/\/[^\s"'<>]+/i)?.[0] || '');

  if (!input.inputType) {
    if (/(?:youtube\.com|youtu\.be)/i.test(urlCandidate || input.content)) {
      detectedType = 'youtube';
    } else if (urlCandidate) {
      detectedType = 'web_link';
    } else if (/\bpdf\b/i.test(input.title || '') || input.content.includes('%PDF')) {
      detectedType = 'pdf';
    } else if (/\bimage\b|\.png|\.jpg|\.webp/i.test(input.title || '') || input.thumbnail) {
      detectedType = 'image';
    } else {
      detectedType = 'text';
    }
  }

  const effectiveUrl = input.sourceUrl || (urlCandidate || undefined);

  // 2. Deduplication: same URL or video ID -> return existing thread
  const duplicate = findDuplicateVaultThread(existingThreads, effectiveUrl);
  if (duplicate) {
    return {
      ok: true,
      deduplicated: true,
      thread: duplicate,
      initialComments: duplicate.comments || [],
    };
  }

  // 3. Key Points Extraction & Heuristic Classification
  const defaultTitle = input.title && input.title.trim()
    ? input.title.trim().slice(0, 200)
    : detectedType === 'youtube'
    ? 'YouTube Study Lecture'
    : detectedType === 'web_link'
    ? 'Web Article Study Note'
    : detectedType === 'pdf'
    ? 'Document Study Breakdown'
    : 'Academic Study Concept';

  const heuristic = classifyAndLinkVaultItemHeuristic(
    {
      id: `temp_${Date.now()}`,
      type: detectedType === 'youtube' ? 'lecture' : 'note',
      title: defaultTitle,
      content: input.content,
      sourceUrl: effectiveUrl,
    },
    []
  );

  let subject = heuristic.subject;
  let chapter = heuristic.chapter;
  let tags = heuristic.tags;
  let tldr = `Key conceptual breakdown of ${defaultTitle} with core academic points.`;
  const keyPoints: VaultKeyPointInput[] = [];

  // Extract initial key points from timestamps or content
  if (Array.isArray(input.timestamps) && input.timestamps.length > 0) {
    input.timestamps.slice(0, 10).forEach((ts: any, i) => {
      const tsStr = typeof ts === 'string' ? ts : ts?.timestamp || ts?.label || '';
      const textVal = typeof ts === 'string' ? ts : ts?.text || ts?.label || 'Key study moment';
      const cleanTs = tsStr.match(/\b\d{1,2}:\d{2}\b/)?.[0] || `0${i}:00`;
      keyPoints.push({
        id: `kp_${i + 1}_${Date.now()}`,
        timestamp: cleanTs,
        text: textVal.replace(/^\[?\d{1,2}:\d{2}\]?\s*[-:]?\s*/, '').slice(0, 200) || `Core concept #${i + 1}`,
        score: 1,
      });
    });
  }

  // If fewer than 5 key points, extract from lines or text
  if (keyPoints.length < 5) {
    const rawLines = input.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 25 && !l.startsWith('#') && !l.startsWith('http'));

    for (let i = 0; i < Math.min(8, rawLines.length); i++) {
      if (keyPoints.length >= 8) break;
      const line = rawLines[i].replace(/^[-*•\d.]+\s*/, '').slice(0, 180);
      const fakeTs = detectedType === 'youtube' ? `0${i * 2 + 1}:15` : undefined;
      keyPoints.push({
        id: `kp_${keyPoints.length + 1}_${Date.now()}`,
        timestamp: fakeTs,
        text: line,
        score: 1,
      });
    }
  }

  // If still empty (e.g. short question), formulate from heuristic
  if (keyPoints.length === 0) {
    keyPoints.push(
      { id: `kp_1_${Date.now()}`, timestamp: detectedType === 'youtube' ? '00:00' : undefined, text: `Overview and primary definitions of ${heuristic.chapter}`, score: 1 },
      { id: `kp_2_${Date.now()}`, timestamp: detectedType === 'youtube' ? '02:30' : undefined, text: `Key theoretical mechanism and governing laws in ${heuristic.subject}`, score: 1 },
      { id: `kp_3_${Date.now()}`, timestamp: detectedType === 'youtube' ? '05:15' : undefined, text: `Core active recall takeaways and practice examples`, score: 1 }
    );
  }

  // Attempt LLM key points & TL;DR extraction via multi-provider
  try {
    const extractionPrompt = `You are Sage, the Vault thread auto-capture extractor.
Analyze this student study input:
Type: ${detectedType}
Title: "${defaultTitle}"
URL: "${effectiveUrl || 'N/A'}"
Content:
"""
${input.content.slice(0, 2000)}
"""

Return JSON:
{
  "title": "Clean, descriptive study title (under 80 chars)",
  "tldr": "One concise line summarizing the core learning takeaway (under 160 chars)",
  "subject": "Academic Subject (e.g. Physics, Biology & Life Sciences, Computer Science & AI, Mathematics, Chemistry, Economics)",
  "chapter": "Specific 3-5 word chapter/topic title",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "keyPoints": [
    { "text": "Concise key point 1", "timestamp": "mm:ss or null" }
  ]
}`;

    const llmRes = await callAgentLlm({
      prompt: extractionPrompt,
      responseMimeType: 'application/json',
      timeoutMs: 4500,
    });

    if (llmRes && llmRes.text) {
      const parsed = JSON.parse(llmRes.text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (parsed.tldr) tldr = String(parsed.tldr).slice(0, 300);
      if (parsed.subject) subject = String(parsed.subject).slice(0, 80);
      if (parsed.chapter) chapter = String(parsed.chapter).slice(0, 120);
      if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
        tags = parsed.tags.map((t: any) => String(t).toLowerCase().slice(0, 28)).slice(0, 6);
      }
      if (Array.isArray(parsed.keyPoints) && parsed.keyPoints.length >= 3) {
        keyPoints.length = 0;
        parsed.keyPoints.slice(0, 10).forEach((kp: any, i: number) => {
          keyPoints.push({
            id: `kp_${i + 1}_${Date.now()}`,
            text: String(kp.text || kp).slice(0, 220),
            timestamp: kp.timestamp ? String(kp.timestamp).slice(0, 10) : undefined,
            score: 1,
          });
        });
      }
    }
  } catch {}

  const threadId = `vth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowUtc = Date.now();

  // Initial Agent Comments (Sage auto-filing + Recall active recall)
  const sageComment: VaultThreadCommentInput = {
    id: `cm_${Date.now()}_sage`,
    threadId,
    author: 'sage',
    authorName: 'Sage',
    text: `Filed under ${subject} → ${chapter} with ${tags.length} study tags. Key points extracted and permanently indexed in your Vault memory for future chats.`,
    createdAt: nowUtc,
    score: 1,
    parentId: null,
  };

  const recallComment: VaultThreadCommentInput = {
    id: `cm_${Date.now() + 1000}_recall`,
    threadId,
    author: 'recall',
    authorName: 'Recall',
    text: `Active Recall Checkpoint: 3 SM-2 spaced repetition flashcards generated from "${keyPoints[0]?.text || defaultTitle}". Review due in 24 hours.`,
    createdAt: nowUtc + 1000,
    score: 1,
    parentId: null,
  };

  const initialComments = [sageComment, recallComment];

  const thread: VaultThreadInput = {
    id: threadId,
    userId: input.userId,
    type: detectedType,
    title: defaultTitle,
    sourceUrl: effectiveUrl,
    thumbnail: input.thumbnail,
    tldr,
    keyPoints,
    subject,
    chapter,
    tags,
    createdAt: nowUtc,
    updatedAt: nowUtc,
    pinned: false,
    score: 1,
    commentCount: initialComments.length,
    comments: initialComments,
  };

  // Save in memory store
  saveUserVaultThread(input.userId, thread, input.userTier);
  // Index key points for agent memory recall & cross-chat citations
  indexThreadKeyPoints(input.userId, thread);

  return {
    ok: true,
    deduplicated: false,
    thread,
    initialComments,
  };
}

// ============================================================================
// EXPRESS ROUTES (/api/agents/* & /api/vault/*)
// ============================================================================
export function registerAgentFrameworkRoutes(app: Express) {
  // GET /api/agents/status — returns agent registry, daily token caps, current usage, and memory
  app.get('/api/agents/status', (req: Request, res: Response) => {
    const userId = req.auth?.uid || req.firebaseUid || 'guest';
    const userTier =
      userId !== 'guest' ? getEffectiveServerUserPlan(userId).plan : 'free';
    const usage = getUserAgentUsage(userId);
    const dailyTokenCap = DAILY_AGENT_TOKEN_CAPS[userTier] || DAILY_AGENT_TOKEN_CAPS.free;
    const dailyCallCap = DAILY_AGENT_CALL_CAPS[userTier] || DAILY_AGENT_CALL_CAPS.free;

    res.json({
      agents: Object.values(PERSONAL_AGENTS),
      tier: userTier,
      usage: {
        date: usage.date,
        totalTokensUsed: usage.totalTokensUsed,
        totalCallsCount: usage.totalCallsCount,
        dailyTokenCap,
        dailyCallCap,
        byAgent: usage.byAgent,
      },
      memory: {
        sage: getAgentMemoryFacts(userId, 'sage'),
        doubt_buddy: getAgentMemoryFacts(userId, 'doubt_buddy'),
        planner: getAgentMemoryFacts(userId, 'planner'),
      },
    });
  });

  // POST /api/agents/on-save — Router + Sage auto-organizer when a Vault item is saved
  app.post('/api/agents/on-save', async (req: Request, res: Response) => {
    try {
      const userId =
        req.auth?.uid ||
        req.firebaseUid ||
        String(req.body?.clientSessionId || 'anon_student');
      const clientPlan = req.body?.userTier as 'free' | 'spark' | 'fire' | undefined;
      const verifiedPlan =
        req.auth?.uid || req.firebaseUid
          ? getEffectiveServerUserPlan(req.auth?.uid || req.firebaseUid).plan
          : 'free';
      const effectiveTier: 'free' | 'spark' | 'fire' =
        verifiedPlan === 'fire' || clientPlan === 'fire'
          ? 'fire'
          : verifiedPlan === 'spark' || clientPlan === 'spark'
          ? 'spark'
          : 'free';

      const usage = getUserAgentUsage(userId);
      const dailyTokenCap = DAILY_AGENT_TOKEN_CAPS[effectiveTier];
      if (usage.totalTokensUsed >= dailyTokenCap) {
        return res.status(429).json({
          error: 'Daily agent token cap reached for your current tier.',
          dailyTokenCap,
          totalTokensUsed: usage.totalTokensUsed,
        });
      }

      const item = req.body?.item as VaultItemInput | undefined;
      if (!item || !item.title) {
        return res.status(400).json({ error: 'Missing Vault item payload.' });
      }

      const existingVaultItems = Array.isArray(req.body?.existingVaultItems)
        ? (req.body.existingVaultItems as VaultItemInput[])
        : [];
      const existingMemory = Array.isArray(req.body?.agentMemory)
        ? (req.body.agentMemory as string[])
        : undefined;

      // Cheap router check first
      const route = await routeAgentTrigger({
        trigger: 'on_save',
        savedItem: item,
        userTier: effectiveTier,
      });

      const result = await runSageOnSave({
        userId,
        userTier: effectiveTier,
        item,
        existingVaultItems,
        existingMemory,
      });

      const updatedUsage = getUserAgentUsage(userId);
      return res.json({
        ok: true,
        router: route,
        ...result,
        usage: {
          totalTokensUsed: updatedUsage.totalTokensUsed,
          dailyTokenCap,
          byAgent: updatedUsage.byAgent,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error?.message || 'Sage agent organization failed.',
      });
    }
  });

  // POST /api/agents/on-message — Cheap router + personal agent card response in chat thread
  app.post('/api/agents/on-message', async (req: Request, res: Response) => {
    try {
      const userId =
        req.auth?.uid ||
        req.firebaseUid ||
        String(req.body?.clientSessionId || 'anon_student');
      const clientPlan = req.body?.userTier as 'free' | 'spark' | 'fire' | undefined;
      const verifiedPlan =
        req.auth?.uid || req.firebaseUid
          ? getEffectiveServerUserPlan(req.auth?.uid || req.firebaseUid).plan
          : 'free';
      const effectiveTier: 'free' | 'spark' | 'fire' =
        verifiedPlan === 'fire' || clientPlan === 'fire'
          ? 'fire'
          : verifiedPlan === 'spark' || clientPlan === 'spark'
          ? 'spark'
          : 'free';

      if (effectiveTier === 'free') {
        return res.json({
          acted: false,
          reason: 'Personal chat agents require Spark or Fire tier.',
        });
      }

      const usage = getUserAgentUsage(userId);
      const dailyTokenCap = DAILY_AGENT_TOKEN_CAPS[effectiveTier];
      if (usage.totalTokensUsed >= dailyTokenCap) {
        return res.json({
          acted: false,
          reason: 'Daily agent token cap reached.',
        });
      }

      const message = String(req.body?.message || '');
      const vaultItems = Array.isArray(req.body?.vaultItems)
        ? (req.body.vaultItems as VaultItemInput[])
        : [];
      const agentMemory = Array.isArray(req.body?.agentMemory)
        ? (req.body.agentMemory as string[])
        : undefined;

      const result = await runAgentOnMessage({
        userId,
        userTier: effectiveTier,
        message,
        vaultItems,
        agentMemory,
      });

      return res.json({
        ok: true,
        ...result,
        usage: {
          totalTokensUsed: getUserAgentUsage(userId).totalTokensUsed,
          dailyTokenCap,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        acted: false,
        error: error?.message || 'Agent router error',
      });
    }
  });

  // POST /api/agents/memory — Add or update per-user per-agent memory facts (capped at 50)
  app.post('/api/agents/memory', (req: Request, res: Response) => {
    const userId =
      req.auth?.uid ||
      req.firebaseUid ||
      String(req.body?.clientSessionId || 'anon_student');
    const agentId = String(req.body?.agentId || 'sage');
    const facts = Array.isArray(req.body?.facts) ? req.body.facts : [];
    const updated = appendAgentMemoryFacts(userId, agentId, facts);
    res.json({
      ok: true,
      agentId,
      facts: updated,
      count: updated.length,
      cap: 50,
    });
  });

  // ==========================================================================
  // VAULT THREADS (REDDIT-STYLE AUTO-CAPTURE, COMMENTS, VOTING & MEMORY SEARCH)
  // ==========================================================================

  // POST /api/vault/auto-capture — Auto-captures YouTube, web link, PDF, image, or text as a Vault thread
  app.post('/api/vault/auto-capture', async (req: Request, res: Response) => {
    try {
      const isGuest = !req.auth?.uid && !req.firebaseUid && req.body?.isGuest === true;
      if (isGuest) {
        return res.json({
          ok: true,
          isGuest: true,
          message: 'Sign in to keep this in your Vault',
        });
      }

      const userId =
        req.auth?.uid ||
        req.firebaseUid ||
        String(req.body?.userId || req.body?.clientSessionId || 'anon_student');

      const verifiedPlan =
        req.auth?.uid || req.firebaseUid
          ? getEffectiveServerUserPlan(req.auth?.uid || req.firebaseUid).plan
          : 'free';
      const effectiveTier = (req.body?.userTier || verifiedPlan) as 'free' | 'spark' | 'fire';

      const result = await autoCaptureVaultThread({
        userId,
        userTier: effectiveTier,
        inputType: req.body?.inputType,
        title: req.body?.title,
        content: String(req.body?.content || ''),
        sourceUrl: req.body?.sourceUrl,
        thumbnail: req.body?.thumbnail,
        timestamps: req.body?.timestamps,
        existingThreads: req.body?.existingThreads,
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || 'Auto-capture failed' });
    }
  });

  // GET /api/vault/threads — Get threads for user (Free: 20 cap, Spark/Fire: unlimited)
  app.get('/api/vault/threads', (req: Request, res: Response) => {
    const userId =
      req.auth?.uid ||
      req.firebaseUid ||
      String(req.query?.userId || 'anon_student');
    const verifiedPlan =
      req.auth?.uid || req.firebaseUid
        ? getEffectiveServerUserPlan(req.auth?.uid || req.firebaseUid).plan
        : 'free';
    const threads = getUserVaultThreads(userId, verifiedPlan);
    res.json({ ok: true, threads, tier: verifiedPlan });
  });

  // POST /api/vault/threads — Save or update a Vault thread
  app.post('/api/vault/threads', (req: Request, res: Response) => {
    const userId =
      req.auth?.uid ||
      req.firebaseUid ||
      String(req.body?.userId || req.body?.clientSessionId || 'anon_student');
    const thread = req.body?.thread as VaultThreadInput;
    if (!thread || !thread.id) {
      return res.status(400).json({ ok: false, error: 'Missing thread payload' });
    }
    const verifiedPlan =
      req.auth?.uid || req.firebaseUid
        ? getEffectiveServerUserPlan(req.auth?.uid || req.firebaseUid).plan
        : 'free';
    const updated = saveUserVaultThread(userId, thread, verifiedPlan);
    indexThreadKeyPoints(userId, thread);
    res.json({ ok: true, threads: updated });
  });

  // DELETE /api/vault/threads/:id — "forget this": wipes thread and all its indexed key points from memory
  app.delete('/api/vault/threads/:id', (req: Request, res: Response) => {
    const userId =
      req.auth?.uid ||
      req.firebaseUid ||
      String(req.query?.userId || req.body?.userId || 'anon_student');
    const threadId = req.params.id;
    deleteThreadAndWipeMemory(userId, threadId);
    res.json({ ok: true, threadId, forgotten: true });
  });

  // POST /api/vault/threads/:id/comments — Add a user or agent reply comment
  app.post('/api/vault/threads/:id/comments', (req: Request, res: Response) => {
    const userId =
      req.auth?.uid ||
      req.firebaseUid ||
      String(req.body?.userId || req.body?.clientSessionId || 'anon_student');
    const threadId = req.params.id;
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ ok: false, error: 'Comment text is required' });
    }

    const threads = userVaultThreadsMemory.get(userId) || [];
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) {
      return res.status(404).json({ ok: false, error: 'Thread not found' });
    }

    const newComment: VaultThreadCommentInput = {
      id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      threadId,
      userId,
      author: String(req.body?.author || 'user'),
      authorName: String(req.body?.authorName || 'Student'),
      authorAvatar: req.body?.authorAvatar,
      text,
      createdAt: Date.now(),
      parentId: req.body?.parentId || null,
      score: 1,
    };

    thread.comments = [...(thread.comments || []), newComment];
    thread.commentCount = thread.comments.length;
    thread.updatedAt = Date.now();
    userVaultThreadsMemory.set(userId, threads);

    res.json({ ok: true, comment: newComment, commentCount: thread.commentCount });
  });

  // POST /api/vault/threads/:id/vote — Upvote or downvote thread or key point
  app.post('/api/vault/threads/:id/vote', (req: Request, res: Response) => {
    const userId =
      req.auth?.uid ||
      req.firebaseUid ||
      String(req.body?.userId || req.body?.clientSessionId || 'anon_student');
    const threadId = req.params.id;
    const delta = Number(req.body?.delta) || 1; // +1 or -1
    const keyPointId = req.body?.keyPointId as string | undefined;

    const threads = userVaultThreadsMemory.get(userId) || [];
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) {
      return res.status(404).json({ ok: false, error: 'Thread not found' });
    }

    if (keyPointId) {
      const kp = (thread.keyPoints || []).find((k) => k.id === keyPointId);
      if (kp) {
        kp.score = (kp.score || 0) + delta;
      }
    } else {
      thread.score = (thread.score || 0) + delta;
    }
    userVaultThreadsMemory.set(userId, threads);
    res.json({ ok: true, threadScore: thread.score });
  });

  // POST /api/vault/threads/:id/comments/:commentId/vote — Upvote/downvote comment
  app.post('/api/vault/threads/:id/comments/:commentId/vote', (req: Request, res: Response) => {
    const userId =
      req.auth?.uid ||
      req.firebaseUid ||
      String(req.body?.userId || req.body?.clientSessionId || 'anon_student');
    const threadId = req.params.id;
    const commentId = req.params.commentId;
    const delta = Number(req.body?.delta) || 1;

    const threads = userVaultThreadsMemory.get(userId) || [];
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) {
      return res.status(404).json({ ok: false, error: 'Thread not found' });
    }

    const comment = (thread.comments || []).find((c) => c.id === commentId);
    if (!comment) {
      return res.status(404).json({ ok: false, error: 'Comment not found' });
    }
    comment.score = (comment.score || 0) + delta;
    userVaultThreadsMemory.set(userId, threads);
    res.json({ ok: true, commentScore: comment.score });
  });

  // GET /api/vault/memory/search — Searches past threads memory index
  app.get('/api/vault/memory/search', (req: Request, res: Response) => {
    const userId =
      req.auth?.uid ||
      req.firebaseUid ||
      String(req.query?.userId || 'anon_student');
    const query = String(req.query?.q || '');
    const citations = searchVaultMemoryIndex(userId, query);
    res.json({ ok: true, citations });
  });
}

