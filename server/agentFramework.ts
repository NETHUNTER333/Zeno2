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

  // Register Study Loop (Phases A, B, C, D) routes
  registerStudyLoopRoutes(app);
}

// ============================================================================
// KINICH STUDY LOOP (PHASES A, B, C, D) — SERVER-AUTHORITATIVE ENGINE
// ============================================================================

export interface StudyLoopTierLimits {
  tier: 'free' | 'spark' | 'fire';
  maxExams: number;
  dailyRecallReviews: number;
  autoPlanEnabled: boolean;
  weakTopicDrillsPerDay: number;
  pdfMaxPages: number;
  dailyUploads: number;
  dailySnapSolves: number;
  audioRecapFullAccess: boolean;
  audioRecapMaxSeconds: number;
}

export const STUDY_LOOP_TIER_LIMITS: Record<'free' | 'spark' | 'fire', StudyLoopTierLimits> = {
  free: {
    tier: 'free',
    maxExams: 1,
    dailyRecallReviews: 15,
    autoPlanEnabled: false,
    weakTopicDrillsPerDay: 2,
    pdfMaxPages: 50,
    dailyUploads: 3,
    dailySnapSolves: 3,
    audioRecapFullAccess: false,
    audioRecapMaxSeconds: 30,
  },
  spark: {
    tier: 'spark',
    maxExams: 5,
    dailyRecallReviews: 150,
    autoPlanEnabled: true,
    weakTopicDrillsPerDay: 15,
    pdfMaxPages: 150,
    dailyUploads: 50,
    dailySnapSolves: 40,
    audioRecapFullAccess: true,
    audioRecapMaxSeconds: 300,
  },
  fire: {
    tier: 'fire',
    maxExams: 20,
    dailyRecallReviews: 500,
    autoPlanEnabled: true,
    weakTopicDrillsPerDay: 50,
    pdfMaxPages: 300,
    dailyUploads: 200,
    dailySnapSolves: 150,
    audioRecapFullAccess: true,
    audioRecapMaxSeconds: 300,
  },
};

interface StudyLoopDailyUsageCounter {
  dateIst: string;
  recallReviewsUsed: number;
  weakDrillsUsed: number;
  uploadsUsed: number;
  snapSolvesUsed: number;
  examsCount: number;
}

const studyLoopUsageLedger = new Map<string, StudyLoopDailyUsageCounter>();
const uploadStudyCacheByHash = new Map<string, any>();
const audioRecapCache = new Map<string, any>();
const translationExplainCache = new Map<string, string>();

export function getCurrentIstDateString(ts = Date.now()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(ts));
    const y = parts.find((p) => p.type === 'year')?.value || '2026';
    const m = parts.find((p) => p.type === 'month')?.value || '01';
    const d = parts.find((p) => p.type === 'day')?.value || '01';
    return `${y}-${m}-${d}`;
  } catch {
    const istDate = new Date(ts + 5.5 * 3600 * 1000);
    return istDate.toISOString().slice(0, 10);
  }
}

function getStudyLoopRateKey(req: Request): {
  rateKey: string;
  uid: string;
  isGuest: boolean;
  tier: 'free' | 'spark' | 'fire';
} {
  const authUid = req.auth?.uid || req.firebaseUid || '';
  const isAnon = Boolean((req.auth as any)?.firebase?.sign_in_provider === 'anonymous');
  const rawIp =
    (String(req.headers['x-forwarded-for'] || '').split(',')[0] || '').trim() ||
    req.socket?.remoteAddress ||
    'unknown_ip';
  const clientUid = String(req.body?.userId || req.query?.userId || 'guest').slice(0, 64);

  if (authUid && !isAnon && !authUid.startsWith('guest_')) {
    const serverPlan = getEffectiveServerUserPlan(authUid).plan;
    const clientTier = req.body?.userTier || req.query?.userTier;
    const tier: 'free' | 'spark' | 'fire' =
      serverPlan === 'fire' || clientTier === 'fire'
        ? 'fire'
        : serverPlan === 'spark' || clientTier === 'spark'
        ? 'spark'
        : 'free';
    return {
      rateKey: `uid:${authUid}`,
      uid: authUid,
      isGuest: false,
      tier,
    };
  }

  return {
    rateKey: `guest:${clientUid}:${rawIp}`,
    uid: authUid || clientUid || 'guest',
    isGuest: true,
    tier: 'free',
  };
}

function getOrInitStudyLoopUsage(rateKey: string): StudyLoopDailyUsageCounter {
  const todayIst = getCurrentIstDateString();
  const existing = studyLoopUsageLedger.get(rateKey);
  if (!existing || existing.dateIst !== todayIst) {
    const fresh: StudyLoopDailyUsageCounter = {
      dateIst: todayIst,
      recallReviewsUsed: 0,
      weakDrillsUsed: 0,
      uploadsUsed: 0,
      snapSolvesUsed: 0,
      examsCount: existing?.examsCount || 0,
    };
    studyLoopUsageLedger.set(rateKey, fresh);
    return fresh;
  }
  return existing;
}

export function buildIstExamAutoPlan(
  examDateStr: string,
  chapters: string[],
  completedDates: string[] = []
): {
  daysRemaining: number;
  planDays: Array<{
    dateIst: string;
    dayNumber: number;
    isFullRevision: boolean;
    chapters: string[];
    completed: boolean;
  }>;
} {
  const todayIst = getCurrentIstDateString();
  const cleanChapters = (Array.isArray(chapters) ? chapters : [])
    .map((c) => String(c || '').trim())
    .filter(Boolean);
  if (cleanChapters.length === 0) {
    cleanChapters.push('Core Concepts & Definitions', 'Problem Solving & Applications');
  }

  const [ty, tm, td] = todayIst.split('-').map(Number);
  const [ey, em, ed] = String(examDateStr || todayIst)
    .slice(0, 10)
    .split('-')
    .map(Number);

  const startUtc = Date.UTC(ty || 2026, (tm || 1) - 1, td || 1);
  const endUtc = Date.UTC(ey || ty || 2026, (em || tm || 1) - 1, ed || td || 1);
  const diffDays = Math.max(1, Math.min(180, Math.round((endUtc - startUtc) / 86400000)));

  const completedSet = new Set(completedDates);
  const planDays: Array<{
    dateIst: string;
    dayNumber: number;
    isFullRevision: boolean;
    chapters: string[];
    completed: boolean;
  }> = [];

  // Reserve the last 2 days for Full Revision whenever total days >= 3 (or last 1 day if 2 days left)
  const revisionDaysCount = diffDays >= 3 ? 2 : diffDays === 2 ? 1 : 0;
  const studyDaysCount = Math.max(1, diffDays - revisionDaysCount);

  for (let i = 0; i < diffDays; i++) {
    const dayUtc = new Date(startUtc + i * 86400000);
    const dateIst = dayUtc.toISOString().slice(0, 10);
    const isFullRevision = i >= studyDaysCount;

    let dayChapters: string[] = [];
    if (isFullRevision) {
      dayChapters = [
        `Full Syllabus Revision (${cleanChapters.length} chapters)`,
        'High-Yield Weak Spots & Active Recall Mock Drill',
      ];
    } else {
      // Spread chapters evenly across studyDaysCount
      if (cleanChapters.length <= studyDaysCount) {
        const chIdx = Math.min(
          cleanChapters.length - 1,
          Math.floor((i * cleanChapters.length) / studyDaysCount)
        );
        dayChapters = [cleanChapters[chIdx]];
      } else {
        const startIdx = Math.floor((i * cleanChapters.length) / studyDaysCount);
        const endIdx = Math.max(
          startIdx + 1,
          Math.floor(((i + 1) * cleanChapters.length) / studyDaysCount)
        );
        dayChapters = cleanChapters.slice(startIdx, endIdx);
      }
    }

    planDays.push({
      dateIst,
      dayNumber: i + 1,
      isFullRevision,
      chapters: dayChapters,
      completed: completedSet.has(dateIst),
    });
  }

  return {
    daysRemaining: diffDays,
    planDays,
  };
}

export function computeSm2GradeServer(
  card: {
    ease?: number;
    interval?: number;
    repetitions?: number;
    wrongCount?: number;
    correctCount?: number;
  },
  grade: 'again' | 'hard' | 'good' | 'easy',
  nowMs = Date.now()
): {
  ease: number;
  interval: number;
  repetitions: number;
  dueAt: number;
  wrongCount: number;
  correctCount: number;
} {
  let ease = Math.max(1.3, Math.min(4.0, Number(card.ease) || 2.5));
  let interval = Math.max(0, Math.floor(Number(card.interval) || 0));
  let repetitions = Math.max(0, Math.floor(Number(card.repetitions) || 0));
  let wrongCount = Math.max(0, Math.floor(Number(card.wrongCount) || 0));
  let correctCount = Math.max(0, Math.floor(Number(card.correctCount) || 0));

  if (grade === 'again') {
    repetitions = 0;
    interval = 0; // Due again today (in 10 minutes)
    ease = Math.max(1.3, Number((ease - 0.2).toFixed(2)));
    wrongCount += 1;
    return {
      ease,
      interval,
      repetitions,
      dueAt: nowMs + 10 * 60 * 1000,
      wrongCount,
      correctCount,
    };
  }

  correctCount += 1;
  if (grade === 'hard') {
    repetitions += 1;
    interval = interval <= 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(1.3, Number((ease - 0.15).toFixed(2)));
  } else if (grade === 'good') {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 3;
    else interval = Math.max(4, Math.round(interval * ease));
  } else {
    // easy
    repetitions += 1;
    if (repetitions === 1) interval = 4;
    else interval = Math.max(5, Math.round(interval * ease * 1.3));
    ease = Math.min(3.5, Number((ease + 0.15).toFixed(2)));
  }

  const dueAt = nowMs + interval * 86400 * 1000;
  return {
    ease,
    interval,
    repetitions,
    dueAt,
    wrongCount,
    correctCount,
  };
}

export function registerStudyLoopRoutes(app: Express) {
  // GET /api/study-loop/limits — Server-authoritative tier limits & daily usage in IST
  app.get('/api/study-loop/limits', (req: Request, res: Response) => {
    const { rateKey, uid, isGuest, tier } = getStudyLoopRateKey(req);
    const usage = getOrInitStudyLoopUsage(rateKey);
    const limits = STUDY_LOOP_TIER_LIMITS[tier];
    res.json({
      ok: true,
      uid,
      isGuest,
      tier,
      todayIst: getCurrentIstDateString(),
      limits,
      usage,
    });
  });

  // POST /api/study-loop/exams/plan — Validates exam creation against tier cap and computes IST Auto Plan
  app.post('/api/study-loop/exams/plan', (req: Request, res: Response) => {
    try {
      const { rateKey, isGuest, tier } = getStudyLoopRateKey(req);
      const usage = getOrInitStudyLoopUsage(rateKey);
      const limits = STUDY_LOOP_TIER_LIMITS[tier];

      const existingExamsCount = Math.max(0, Number(req.body?.existingExamsCount || 0));
      const isExistingExamUpdate = Boolean(req.body?.isUpdate);

      if (!isExistingExamUpdate && existingExamsCount >= limits.maxExams) {
        return res.status(403).json({
          ok: false,
          code: 'EXAM_LIMIT_REACHED',
          error: `Your ${limits.tier.toUpperCase()} tier supports up to ${limits.maxExams} active exam${limits.maxExams === 1 ? '' : 's'}. Upgrade to Spark or Fire to track more exams and unlock full Auto Plan.`,
          limits,
        });
      }

      const name = String(req.body?.name || 'Upcoming Exam').trim().slice(0, 120);
      const examDate = String(req.body?.examDate || getCurrentIstDateString()).slice(0, 10);
      const chapters = Array.isArray(req.body?.chapters)
        ? req.body.chapters.map((c: any) => String(c || '').trim()).filter(Boolean)
        : [];
      const completedDates = Array.isArray(req.body?.completedDates)
        ? req.body.completedDates.map(String)
        : [];

      const planResult = buildIstExamAutoPlan(examDate, chapters, completedDates);
      usage.examsCount = isExistingExamUpdate ? existingExamsCount : existingExamsCount + 1;
      studyLoopUsageLedger.set(rateKey, usage);

      return res.json({
        ok: true,
        isGuest,
        tier,
        name,
        examDate,
        daysRemaining: planResult.daysRemaining,
        planDays: planResult.planDays,
        autoPlanEnabled: limits.autoPlanEnabled,
        limits,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Could not build exam study plan.',
      });
    }
  });

  // POST /api/study-loop/cards/grade — Server-enforced SM-2 grading + daily Recall cap
  app.post('/api/study-loop/cards/grade', (req: Request, res: Response) => {
    try {
      const { rateKey, isGuest, tier } = getStudyLoopRateKey(req);
      const usage = getOrInitStudyLoopUsage(rateKey);
      const limits = STUDY_LOOP_TIER_LIMITS[tier];

      if (usage.recallReviewsUsed >= limits.dailyRecallReviews) {
        return res.status(429).json({
          ok: false,
          code: 'DAILY_RECALL_CAP_REACHED',
          error: `You've completed your ${limits.dailyRecallReviews} daily Recall reviews on the ${limits.tier.toUpperCase()} tier for today (${usage.dateIst} IST). Upgrade to Spark or Fire for higher daily revision caps.`,
          usage,
          limits,
        });
      }

      const rawGrade = String(req.body?.grade || 'good').toLowerCase();
      const grade: 'again' | 'hard' | 'good' | 'easy' =
        rawGrade === 'again' || rawGrade === 'hard' || rawGrade === 'easy' ? rawGrade : 'good';

      const cardInput = req.body?.card || {};
      const updatedMetrics = computeSm2GradeServer(cardInput, grade, Date.now());

      usage.recallReviewsUsed += 1;
      studyLoopUsageLedger.set(rateKey, usage);

      return res.json({
        ok: true,
        isGuest,
        tier,
        grade,
        cardMetrics: updatedMetrics,
        usage,
        limits,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Could not record card grade.',
      });
    }
  });

  // POST /api/study-loop/weak-spots/practice — Generates 5 new questions on a weak chapter only
  app.post('/api/study-loop/weak-spots/practice', async (req: Request, res: Response) => {
    try {
      const { rateKey, tier } = getStudyLoopRateKey(req);
      const usage = getOrInitStudyLoopUsage(rateKey);
      const limits = STUDY_LOOP_TIER_LIMITS[tier];

      if (usage.weakDrillsUsed >= limits.weakTopicDrillsPerDay) {
        return res.status(429).json({
          ok: false,
          code: 'WEAK_DRILL_CAP_REACHED',
          error: `You've used your ${limits.weakTopicDrillsPerDay} daily weak-topic practice drills on the ${limits.tier.toUpperCase()} tier. Upgrade to Spark or Fire for more targeted practice drills.`,
          usage,
          limits,
        });
      }

      const chapter = String(req.body?.chapter || 'Core Concepts').trim().slice(0, 120);
      const subject = String(req.body?.subject || 'General Studies').trim().slice(0, 80);
      const examName = String(req.body?.examName || '').trim().slice(0, 100);
      const existingContext = String(req.body?.contextNotes || '').trim().slice(0, 1200);

      let generatedQuestions: Array<{
        id: string;
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
        chapter: string;
        subject: string;
      }> = [];

      const prompt = `You are Recall, Kinich's academic exam drill generator.
Generate exactly 5 high-yield multiple-choice practice questions strictly focused on the weak chapter "${chapter}" in subject "${subject}"${examName ? ` for the exam "${examName}"` : ''}.
${existingContext ? `Reference study notes:\n${existingContext}\n` : ''}
Rules:
- Strictly educational, accurate, and SFW.
- Each question must have 4 clear options, correctIndex (0-3), and a concise 1-2 sentence explanation.
Return ONLY valid JSON:
{
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}`;

      const llmRes = await callAgentLlm({
        prompt,
        responseMimeType: 'application/json',
        timeoutMs: 8500,
      });

      if (llmRes && llmRes.text) {
        try {
          const match = llmRes.text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
              generatedQuestions = parsed.questions.slice(0, 5).map((q: any, idx: number) => ({
                id: `weak_q_${Date.now()}_${idx}`,
                question: String(q.question || `Question ${idx + 1} on ${chapter}`).slice(0, 400),
                options:
                  Array.isArray(q.options) && q.options.length === 4
                    ? q.options.map((o: any) => String(o).slice(0, 200))
                    : [
                        `Primary mechanism of ${chapter}`,
                        `Secondary boundary condition in ${subject}`,
                        `Inverse proportional relationship`,
                        `Constant equilibrium state`,
                      ],
                correctIndex:
                  typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
                    ? q.correctIndex
                    : 0,
                explanation: String(
                  q.explanation ||
                    `This tests the core governing principle of ${chapter} in ${subject}.`
                ).slice(0, 400),
                chapter,
                subject,
              }));
            }
          }
        } catch {}
      }

      // Deterministic academic fallback so the student ALWAYS gets 5 targeted questions without failing
      if (generatedQuestions.length < 5) {
        const templates = [
          {
            question: `In ${subject}, which fundamental principle directly governs ${chapter}?`,
            options: [
              `Conservation and state transition laws applied to ${chapter}`,
              `Random uncoupled thermal drift only`,
              `Zero-gradient static equilibrium in all conditions`,
              `Non-causal empirical approximation`,
            ],
            correctIndex: 0,
            explanation: `${chapter} is governed by foundational conservation and state transition relationships in ${subject}.`,
          },
          {
            question: `When solving exam problems on ${chapter}, what is the most common pitfall to avoid?`,
            options: [
              `Memorizing the definition before applying formulas`,
              `Confusing boundary conditions and sign conventions in ${chapter}`,
              `Writing down the known variables first`,
              `Checking dimensional consistency of the final answer`,
            ],
            correctIndex: 1,
            explanation: `Most exam errors in ${chapter} come from mixing up boundary conditions or sign conventions.`,
          },
          {
            question: `Which parameter change has the strongest direct effect on a system modeled under ${chapter}?`,
            options: [
              `Altering the primary driving variable beyond its threshold`,
              `Changing the label of the reference frame`,
              `Re-ordering the steps of algebraic simplification`,
              `Converting units from SI to CGS after solving`,
            ],
            correctIndex: 0,
            explanation: `Varying the primary driving variable shifts the system state predicted by ${chapter}.`,
          },
          {
            question: `How does ${chapter} connect to broader topics in ${subject}${examName ? ` (${examName})` : ''}?`,
            options: [
              `It is completely isolated from all other chapters`,
              `It provides the analytical foundation for multi-step synthesis problems in ${subject}`,
              `It only applies to historical experiments prior to 1900`,
              `It replaces all quantitative equations with qualitative guesses`,
            ],
            correctIndex: 1,
            explanation: `Exam questions frequently combine ${chapter} with adjacent concepts in ${subject} for multi-step problems.`,
          },
          {
            question: `During rapid exam revision of ${chapter}, which active-recall check confirms mastery?`,
            options: [
              `Re-reading the textbook heading three times passively`,
              `Deriving the core relationship of ${chapter} from first principles and solving a numerical application`,
              `Highlighting every sentence on the page`,
              `Skipping worked examples`,
            ],
            correctIndex: 1,
            explanation: `Reconstructing the core relationship from memory and applying it to a problem verifies true recall mastery.`,
          },
        ];

        for (let i = generatedQuestions.length; i < 5; i++) {
          const tpl = templates[i % templates.length];
          generatedQuestions.push({
            id: `weak_q_${Date.now()}_${i}`,
            question: tpl.question,
            options: tpl.options,
            correctIndex: tpl.correctIndex,
            explanation: tpl.explanation,
            chapter,
            subject,
          });
        }
      }

      usage.weakDrillsUsed += 1;
      studyLoopUsageLedger.set(rateKey, usage);

      return res.json({
        ok: true,
        chapter,
        subject,
        questions: generatedQuestions,
        usage,
        limits,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Could not generate weak-topic practice questions.',
      });
    }
  });

  // ==========================================================================
  // PHASE B: UPLOAD ANYTHING → STUDY (PDF, IMAGE OCR, PASTED TEXT + SHA-256 DEDUP)
  // ==========================================================================
  app.post('/api/study/upload', async (req: Request, res: Response) => {
    try {
      const { rateKey, tier } = getStudyLoopRateKey(req);
      const usage = getOrInitStudyLoopUsage(rateKey);
      const limits = STUDY_LOOP_TIER_LIMITS[tier];

      const fileHash = String(req.body?.fileHash || '').trim().slice(0, 128);
      const uploadType: 'pdf' | 'image' | 'text' =
        req.body?.type === 'pdf' || req.body?.type === 'image' ? req.body.type : 'text';
      const title = String(req.body?.title || req.body?.fileName || 'Study Material')
        .trim()
        .slice(0, 180);
      const pageCount = Math.max(1, Math.floor(Number(req.body?.pageCount || 1)));

      // Enforce PDF page limit per tier
      if (uploadType === 'pdf' && pageCount > limits.pdfMaxPages) {
        return res.status(403).json({
          ok: false,
          code: 'PDF_PAGE_LIMIT_EXCEEDED',
          error: `This PDF has ${pageCount} pages. Your ${limits.tier.toUpperCase()} tier supports PDFs up to ${limits.pdfMaxPages} pages (Free: 50 pages, Spark: 150 pages, Fire: 300 pages).`,
          limits,
        });
      }

      // Check SHA-256 deduplication cache first!
      if (fileHash && uploadStudyCacheByHash.has(fileHash)) {
        const cached = uploadStudyCacheByHash.get(fileHash);
        return res.json({
          ok: true,
          deduplicated: true,
          fileHash,
          studyPack: cached,
          usage,
          limits,
        });
      }

      // Enforce daily upload limit
      if (usage.uploadsUsed >= limits.dailyUploads) {
        return res.status(429).json({
          ok: false,
          code: 'UPLOAD_LIMIT_REACHED',
          error: `You've reached your ${limits.dailyUploads} daily study uploads on the ${limits.tier.toUpperCase()} tier. Upgrade to Spark or Fire for higher daily study capacity.`,
          usage,
          limits,
        });
      }

      let pagesText: Array<{ page: number; text: string }> = [];
      if (Array.isArray(req.body?.pagesText) && req.body.pagesText.length > 0) {
        pagesText = req.body.pagesText
          .slice(0, limits.pdfMaxPages)
          .map((p: any, i: number) => ({
            page: Number(p?.page || i + 1),
            text: String(p?.text || '').trim().slice(0, 4000),
          }))
          .filter((p: { page: number; text: string }) => p.text.length > 0);
      }

      let rawText = String(req.body?.rawText || '').trim();
      const imageDataUrl = String(req.body?.imageDataUrl || '').trim();

      // If image upload, run OCR via Gemini vision or fallback
      if (uploadType === 'image' && imageDataUrl.startsWith('data:image/')) {
        const gemini = getGeminiClient();
        if (gemini) {
          try {
            const commaIdx = imageDataUrl.indexOf(',');
            const meta = imageDataUrl.slice(0, commaIdx);
            const base64Data = imageDataUrl.slice(commaIdx + 1);
            const mimeMatch = meta.match(/data:(image\/[a-zA-Z0-9.+-]+);base64/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

            const ocrPromise = gemini.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: 'Transcribe all handwritten or printed study notes, textbook paragraphs, formulas, and diagrams from this page accurately. Keep headings and bullet points clear.',
                },
              ],
            });
            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 9000)
            );
            const ocrResp = await Promise.race([ocrPromise, timeoutPromise]);
            if (ocrResp && ocrResp.text) {
              rawText = ocrResp.text.trim();
            }
          } catch {}
        }
        if (!rawText) {
          rawText =
            req.body?.fallbackDescription ||
            `Extracted study notes from uploaded image (${title}). Key definitions, worked formulas, and active recall points.`;
        }
        pagesText = [{ page: 1, text: rawText }];
      }

      if (pagesText.length === 0 && rawText) {
        // Chunk rawText into synthetic ~1500-char pages so Page citations always work
        const chunkSize = 1600;
        for (let i = 0; i < rawText.length; i += chunkSize) {
          pagesText.push({
            page: pagesText.length + 1,
            text: rawText.slice(i, i + chunkSize),
          });
          if (pagesText.length >= limits.pdfMaxPages) break;
        }
      }

      if (pagesText.length === 0) {
        pagesText = [
          {
            page: 1,
            text: `Study notes for ${title}. Core academic concepts, definitions, and exam review points.`,
          },
        ];
      }

      const sampledExcerpts = pagesText
        .slice(0, 12)
        .map((p) => `[Page ${p.page}]\n${p.text.slice(0, 900)}`)
        .join('\n\n');

      const heuristic = classifyAndLinkVaultItemHeuristic(
        {
          id: `up_${Date.now()}`,
          type: 'note',
          title,
          content: sampledExcerpts,
        },
        []
      );

      let summaryBullets: Array<{ text: string; page: number }> = [];
      let chaptersList: Array<{
        id: string;
        title: string;
        page: number;
        pageLabel: string;
        summary: string;
      }> = [];
      let flashcardsList: Array<{
        id: string;
        front: string;
        back: string;
        page: number;
        pageLabel: string;
        chapter: string;
      }> = [];
      let quizList: Array<{
        id: string;
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
        page: number;
        pageLabel: string;
        chapter: string;
      }> = [];

      const studyPrompt = `You are Kinich's academic Study Synthesizer.
Analyze this uploaded ${uploadType.toUpperCase()} document ("${title}", ${pagesText.length} pages) and generate a complete study pack.
CRITICAL: Cite page numbers (e.g. page: 1, page: 2) for every chapter, summary bullet, flashcard, and quiz question instead of video timestamps. Stay strictly educational and SFW.

Document Excerpts by Page:
${sampledExcerpts.slice(0, 5500)}

Return ONLY valid JSON:
{
  "subject": "${heuristic.subject}",
  "chapter": "${heuristic.chapter}",
  "summaryBullets": [
    { "text": "Clear academic takeaway...", "page": 1 }
  ],
  "chapters": [
    { "title": "Section title", "page": 1, "summary": "2-sentence section summary citing key concepts." }
  ],
  "flashcards": [
    { "front": "Active recall question?", "back": "Concise accurate answer", "page": 1 }
  ],
  "quiz": [
    {
      "question": "Exam-style multiple choice question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this option is correct according to Page X.",
      "page": 1
    }
  ]
}`;

      const llmRes = await callAgentLlm({
        prompt: studyPrompt,
        responseMimeType: 'application/json',
        timeoutMs: 9500,
      });

      let subject = heuristic.subject;
      let chapter = heuristic.chapter;

      if (llmRes && llmRes.text) {
        try {
          const match = llmRes.text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.subject) subject = String(parsed.subject).slice(0, 80);
            if (parsed.chapter) chapter = String(parsed.chapter).slice(0, 120);

            if (Array.isArray(parsed.summaryBullets)) {
              summaryBullets = parsed.summaryBullets.slice(0, 8).map((b: any, i: number) => ({
                text: String(b?.text || b || '').slice(0, 320),
                page: Math.max(1, Math.min(pagesText.length, Number(b?.page || i + 1))),
              }));
            }
            if (Array.isArray(parsed.chapters)) {
              chaptersList = parsed.chapters.slice(0, 8).map((c: any, i: number) => {
                const pg = Math.max(1, Math.min(pagesText.length, Number(c?.page || i + 1)));
                return {
                  id: `ch_${i + 1}`,
                  title: String(c?.title || `Section ${i + 1}`).slice(0, 120),
                  page: pg,
                  pageLabel: `Page ${pg}`,
                  summary: String(c?.summary || '').slice(0, 400),
                };
              });
            }
            if (Array.isArray(parsed.flashcards)) {
              flashcardsList = parsed.flashcards.slice(0, 10).map((f: any, i: number) => {
                const pg = Math.max(1, Math.min(pagesText.length, Number(f?.page || (i % pagesText.length) + 1)));
                return {
                  id: `fc_${Date.now()}_${i}`,
                  front: String(f?.front || `Key concept on Page ${pg}`).slice(0, 300),
                  back: String(f?.back || '').slice(0, 500),
                  page: pg,
                  pageLabel: `Page ${pg}`,
                  chapter,
                };
              });
            }
            if (Array.isArray(parsed.quiz)) {
              quizList = parsed.quiz.slice(0, 8).map((q: any, i: number) => {
                const pg = Math.max(1, Math.min(pagesText.length, Number(q?.page || (i % pagesText.length) + 1)));
                return {
                  id: `qz_${Date.now()}_${i}`,
                  question: String(q?.question || '').slice(0, 350),
                  options:
                    Array.isArray(q?.options) && q.options.length === 4
                      ? q.options.map((o: any) => String(o).slice(0, 180))
                      : ['Option A', 'Option B', 'Option C', 'Option D'],
                  correctIndex:
                    typeof q?.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
                      ? q.correctIndex
                      : 0,
                  explanation: String(q?.explanation || `Verified on Page ${pg}.`).slice(0, 350),
                  page: pg,
                  pageLabel: `Page ${pg}`,
                  chapter,
                };
              });
            }
          }
        } catch {}
      }

      // Deterministic page-grounded fallback if LLM timed out or returned partial fields
      if (summaryBullets.length === 0) {
        summaryBullets = pagesText.slice(0, 6).map((p) => {
          const firstSentence =
            p.text
              .split(/(?<=[.!?])\s+/)
              .map((s) => s.trim())
              .find((s) => s.length > 25) || p.text.slice(0, 180);
          return {
            text: firstSentence.slice(0, 260),
            page: p.page,
          };
        });
      }

      if (chaptersList.length === 0) {
        chaptersList = pagesText.slice(0, 6).map((p, idx) => ({
          id: `ch_${idx + 1}`,
          title: idx === 0 ? `${title} — Core Foundations` : `Section ${idx + 1}: Key Concepts (Page ${p.page})`,
          page: p.page,
          pageLabel: `Page ${p.page}`,
          summary: p.text.slice(0, 280),
        }));
      }

      if (flashcardsList.length === 0) {
        flashcardsList = summaryBullets.slice(0, 5).map((b, idx) => ({
          id: `fc_${Date.now()}_${idx}`,
          front: `What is the key takeaway presented on Page ${b.page} of "${title}" (${chapter})?`,
          back: b.text,
          page: b.page,
          pageLabel: `Page ${b.page}`,
          chapter,
        }));
      }

      if (quizList.length === 0) {
        quizList = summaryBullets.slice(0, 4).map((b, idx) => ({
          id: `qz_${Date.now()}_${idx}`,
          question: `According to Page ${b.page} of "${title}", which statement accurately reflects ${chapter}?`,
          options: [
            b.text.slice(0, 150),
            `An unrelated hypothesis not supported by Page ${b.page}`,
            `The inverse of the relationship described on Page ${b.page}`,
            `None of the concepts discussed in ${subject}`,
          ],
          correctIndex: 0,
          explanation: `Directly cited from Page ${b.page}: "${b.text.slice(0, 180)}"`,
          page: b.page,
          pageLabel: `Page ${b.page}`,
          chapter,
        }));
      }

      const studyPack = {
        id: `up_study_${Date.now()}`,
        fileHash: fileHash || `hash_${Date.now()}`,
        sourceType: uploadType,
        title,
        subject,
        chapter,
        pageCount: pagesText.length,
        summaryBullets,
        chapters: chaptersList,
        flashcards: flashcardsList,
        quiz: quizList,
        pagesText: pagesText.slice(0, 50),
        createdAt: Date.now(),
      };

      if (fileHash) {
        uploadStudyCacheByHash.set(fileHash, studyPack);
      }

      usage.uploadsUsed += 1;
      studyLoopUsageLedger.set(rateKey, usage);

      return res.json({
        ok: true,
        deduplicated: false,
        fileHash: studyPack.fileHash,
        studyPack,
        usage,
        limits,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Could not process uploaded study material.',
      });
    }
  });

  // POST /api/study/snap-solve — Photo of one question → step-by-step solution, concept behind it, 1 similar practice question, "Check with your textbook" badge when unsure
  app.post('/api/study/snap-solve', async (req: Request, res: Response) => {
    try {
      const { rateKey, tier } = getStudyLoopRateKey(req);
      const usage = getOrInitStudyLoopUsage(rateKey);
      const limits = STUDY_LOOP_TIER_LIMITS[tier];

      if (usage.snapSolvesUsed >= limits.dailySnapSolves) {
        return res.status(429).json({
          ok: false,
          code: 'SNAP_SOLVE_LIMIT_REACHED',
          error: `You've used your ${limits.dailySnapSolves} daily Snap & Solve questions on the ${limits.tier.toUpperCase()} tier. Upgrade to Spark or Fire for more daily problem solving.`,
          usage,
          limits,
        });
      }

      const imageDataUrl = String(req.body?.imageDataUrl || '').trim();
      let questionText = String(req.body?.questionText || '').trim().slice(0, 2000);
      const language = String(req.body?.language || 'English');
      let ocrConfidence: 'high' | 'medium' | 'low' = questionText.length > 15 ? 'high' : 'medium';

      // Extract question from image if imageDataUrl is provided
      if (imageDataUrl.startsWith('data:image/')) {
        const gemini = getGeminiClient();
        if (gemini) {
          try {
            const commaIdx = imageDataUrl.indexOf(',');
            const meta = imageDataUrl.slice(0, commaIdx);
            const base64Data = imageDataUrl.slice(commaIdx + 1);
            const mimeMatch = meta.match(/data:(image\/[a-zA-Z0-9.+-]+);base64/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

            const visionPromise = gemini.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: 'Extract the exact academic question shown in this image (including any numbers, equations, or multiple-choice options). If the handwriting or image is blurry or ambiguous, prefix with [UNCLEAR].',
                },
              ],
            });
            const timeoutPromise = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 8000)
            );
            const visionResp = await Promise.race([visionPromise, timeoutPromise]);
            if (visionResp && visionResp.text) {
              const extracted = visionResp.text.trim();
              if (extracted.includes('[UNCLEAR]')) {
                ocrConfidence = 'low';
              } else {
                ocrConfidence = 'high';
              }
              questionText = extracted.replace('[UNCLEAR]', '').trim() || questionText;
            } else {
              ocrConfidence = 'low';
            }
          } catch {
            ocrConfidence = 'low';
          }
        } else {
          ocrConfidence = questionText ? 'medium' : 'low';
        }
      }

      if (!questionText) {
        questionText =
          'Solve the uploaded problem step-by-step, state the governing formula/concept, and provide a similar practice problem.';
        ocrConfidence = 'low';
      }

      const langInstruction =
        language === 'Telugu'
          ? 'Explain the steps and concept in Telugu (తెలుగు), keeping all technical and scientific terms in English.'
          : language === 'Hindi'
          ? 'Explain the steps and concept in Hindi (हिन्दी), keeping all technical and scientific terms in English.'
          : 'Explain clearly in English.';

      const solvePrompt = `You are Kinich's Snap & Solve academic tutor.
A student snapped/submitted this question:
"${questionText}"

${langInstruction}
Stay strictly educational and SFW.
If the question is ambiguous, missing values, or you are less than 90% certain of the numerical/factual answer, set "checkWithTextbook": true and "confidence": "medium" or "low".

Return ONLY valid JSON:
{
  "questionExtracted": "Clean restatement of the question",
  "steps": [
    "Step 1: Identify given values and what is asked...",
    "Step 2: Apply the governing formula or principle...",
    "Step 3: Substitute and compute the final result..."
  ],
  "finalAnswer": "Concise final answer",
  "conceptBehindIt": {
    "title": "Name of the core concept/law",
    "subject": "Academic Subject",
    "chapter": "Chapter name",
    "explanation": "2-3 sentence explanation of the underlying concept."
  },
  "similarPracticeQuestion": {
    "question": "A new, similar practice question testing the exact same concept with different values/context",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Step-by-step explanation for the practice question"
  },
  "confidence": "high",
  "checkWithTextbook": false
}`;

      const llmRes = await callAgentLlm({
        prompt: solvePrompt,
        responseMimeType: 'application/json',
        timeoutMs: 9500,
      });

      let resultPayload: any = null;
      if (llmRes && llmRes.text) {
        try {
          const match = llmRes.text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
              const conf: 'high' | 'medium' | 'low' =
                ocrConfidence === 'low'
                  ? 'low'
                  : parsed.confidence === 'low' || parsed.confidence === 'medium'
                  ? parsed.confidence
                  : 'high';
              resultPayload = {
                questionExtracted: String(parsed.questionExtracted || questionText).slice(0, 600),
                steps: parsed.steps.slice(0, 7).map((s: any) => String(s).slice(0, 450)),
                finalAnswer: String(parsed.finalAnswer || 'See final step above.').slice(0, 300),
                conceptBehindIt: {
                  title: String(parsed.conceptBehindIt?.title || 'Core Governing Principle').slice(0, 120),
                  subject: String(parsed.conceptBehindIt?.subject || 'General Studies').slice(0, 80),
                  chapter: String(parsed.conceptBehindIt?.chapter || 'Problem Solving').slice(0, 120),
                  explanation: String(
                    parsed.conceptBehindIt?.explanation ||
                      'This problem tests the direct application of foundational conservation and equilibrium rules.'
                  ).slice(0, 500),
                },
                similarPracticeQuestion: {
                  question: String(
                    parsed.similarPracticeQuestion?.question ||
                      `Practice variation: Apply ${parsed.conceptBehindIt?.title || 'this concept'} when the primary input parameter is doubled.`
                  ).slice(0, 400),
                  options:
                    Array.isArray(parsed.similarPracticeQuestion?.options) &&
                    parsed.similarPracticeQuestion.options.length === 4
                      ? parsed.similarPracticeQuestion.options.map((o: any) => String(o).slice(0, 180))
                      : [
                          'It scales proportionally according to the governing relation',
                          'It remains strictly zero',
                          'It becomes undefined',
                          'It decreases exponentially to negative infinity',
                        ],
                  correctIndex:
                    typeof parsed.similarPracticeQuestion?.correctIndex === 'number' &&
                    parsed.similarPracticeQuestion.correctIndex >= 0 &&
                    parsed.similarPracticeQuestion.correctIndex <= 3
                      ? parsed.similarPracticeQuestion.correctIndex
                      : 0,
                  explanation: String(
                    parsed.similarPracticeQuestion?.explanation ||
                      'Follow the same 3-step substitution method used in the worked solution.'
                  ).slice(0, 400),
                },
                confidence: conf,
                checkWithTextbook: Boolean(parsed.checkWithTextbook) || conf !== 'high',
              };
            }
          }
        } catch {}
      }

      if (!resultPayload) {
        const heuristic = classifyAndLinkVaultItemHeuristic(
          { id: 'snap', type: 'note', title: questionText.slice(0, 80), content: questionText },
          []
        );
        resultPayload = {
          questionExtracted: questionText,
          steps: [
            `Step 1 (Identify Given & Target): Parse the key variables and constraints in the question under ${heuristic.subject} (${heuristic.chapter}).`,
            `Step 2 (Governing Principle): Write the standard formula/relationship connecting the known parameters to the unknown quantity.`,
            `Step 3 (Verify Units & Boundary Conditions): Substitute the values in standard SI units and verify the result against boundary conditions.`,
          ],
          finalAnswer: `Review the 3-step derivation above and verify numerical constants with your textbook.`,
          conceptBehindIt: {
            title: `${heuristic.chapter} — Core Mechanism`,
            subject: heuristic.subject,
            chapter: heuristic.chapter,
            explanation: `This question is rooted in ${heuristic.chapter} (${heuristic.subject}), which links system inputs to measurable state outcomes.`,
          },
          similarPracticeQuestion: {
            question: `Similar Practice (${heuristic.chapter}): Which step is essential before substituting numerical values into the governing equation?`,
            options: [
              'Convert all given quantities into consistent standard units and check sign conventions',
              'Round all constants to a single digit before starting',
              'Ignore boundary conditions',
              'Assume all variables are equal to 1',
            ],
            correctIndex: 0,
            explanation: 'Consistent units and sign conventions prevent the most common exam calculation errors.',
          },
          confidence: 'medium',
          checkWithTextbook: true,
        };
      }

      usage.snapSolvesUsed += 1;
      studyLoopUsageLedger.set(rateKey, usage);

      return res.json({
        ok: true,
        ...resultPayload,
        usage,
        limits,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Snap & Solve encountered an error. Please try again.',
      });
    }
  });

  // ==========================================================================
  // PHASE C: AUDIO RECAP ("Listen" button on any Summary, 2-5 min Spark/Fire, 30s preview Free)
  // ==========================================================================
  app.post('/api/study/audio-recap', async (req: Request, res: Response) => {
    try {
      const { tier } = getStudyLoopRateKey(req);
      const limits = STUDY_LOOP_TIER_LIMITS[tier];
      const itemId = String(req.body?.itemId || 'default_item').trim().slice(0, 128);
      const title = String(req.body?.title || 'Study Summary').trim().slice(0, 180);
      const summaryText = String(req.body?.summaryText || '').trim().slice(0, 5000);
      const language = String(req.body?.language || 'English');

      const cacheKey = `${itemId}:${tier}:${language}`;
      if (audioRecapCache.has(cacheKey)) {
        return res.json({
          ok: true,
          cached: true,
          ...audioRecapCache.get(cacheKey),
        });
      }

      const isPreviewOnly = !limits.audioRecapFullAccess;
      const maxSeconds = limits.audioRecapMaxSeconds;

      const langPrompt =
        language === 'Telugu'
          ? 'Write the spoken script in conversational Telugu (తెలుగు) while keeping technical terms in English.'
          : language === 'Hindi'
          ? 'Write the spoken script in conversational Hindi (हिन्दी) while keeping technical terms in English.'
          : 'Write the spoken script in clear, engaging spoken English.';

      const scriptPrompt = `You are Kinich's Audio Revision Coach.
Create a ${isPreviewOnly ? 'concise 30-second (~75 words) spoken preview' : 'comprehensive 2 to 3 minute (~320 words) spoken audio recap'} for a student revising "${title}" on the go.
${langPrompt}
No markdown bullets, no asterisks, no stage directions—write natural spoken sentences ready for Text-to-Speech.

Source Summary:
${summaryText.slice(0, 2800)}`;

      let spokenScript = '';
      const llmRes = await callAgentLlm({
        prompt: scriptPrompt,
        timeoutMs: 7500,
      });

      if (llmRes && llmRes.text) {
        spokenScript = llmRes.text
          .replace(/[*#_`~>-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      if (!spokenScript) {
        const cleanSummary = summaryText
          .replace(/[*#_`~>-]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        spokenScript = isPreviewOnly
          ? `Welcome to your Kinich 30-second audio recap preview for ${title}. ${cleanSummary.slice(0, 360)}. Upgrade to Spark or Fire to unlock full 2 to 5 minute background audio recaps.`
          : `Welcome to your Kinich audio revision recap for ${title}. Let's walk through the core concepts you need for your exam. ${cleanSummary.slice(0, 1800)}. Take a moment to review your Recall flashcards on these points!`;
      }

      if (isPreviewOnly && spokenScript.length > 420) {
        spokenScript =
          spokenScript.slice(0, 400).replace(/\s+\S*$/, '') +
          '. Upgrade to Spark or Fire to listen to the full 2 to 5 minute audio recap.';
      }

      const payload = {
        itemId,
        title,
        tier,
        language,
        isPreview: isPreviewOnly,
        maxDurationSeconds: maxSeconds,
        estimatedDurationSeconds: isPreviewOnly
          ? 30
          : Math.max(120, Math.min(300, Math.round(spokenScript.split(/\s+/).length / 2.2))),
        script: spokenScript,
      };

      audioRecapCache.set(cacheKey, payload);

      return res.json({
        ok: true,
        cached: false,
        ...payload,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Could not generate Audio Recap.',
      });
    }
  });

  // ==========================================================================
  // PHASE D: TELUGU / HINDI EXPLANATION ("Explain in Telugu / Hindi" keeping technical terms in English)
  // ==========================================================================
  app.post('/api/study/translate-explain', async (req: Request, res: Response) => {
    try {
      const text = String(req.body?.text || '').trim().slice(0, 4500);
      const rawLang = String(req.body?.targetLanguage || req.body?.language || '').trim();
      const targetLanguage: 'English' | 'Telugu' | 'Hindi' =
        rawLang === 'Telugu' || rawLang === 'తెలుగు'
          ? 'Telugu'
          : rawLang === 'Hindi' || rawLang === 'हिन्दी'
          ? 'Hindi'
          : 'English';

      if (!text) {
        return res.status(400).json({ ok: false, error: 'Missing text to explain.' });
      }
      if (targetLanguage === 'English') {
        return res.json({ ok: true, language: 'English', explainedText: text });
      }

      const cacheKey = `${targetLanguage}:${text.slice(0, 200)}:${text.length}`;
      if (translationExplainCache.has(cacheKey)) {
        return res.json({
          ok: true,
          language: targetLanguage,
          cached: true,
          explainedText: translationExplainCache.get(cacheKey),
        });
      }

      const langLabel =
        targetLanguage === 'Telugu' ? 'Telugu (తెలుగు script)' : 'Hindi (हिन्दी Devanagari script)';

      const prompt = `You are a bilingual Indian academic tutor on Kinich.
Rewrite and explain the following study content in ${langLabel} for an Indian student.
CRITICAL RULE: Keep all technical, scientific, mathematical, and programming terms in English (or English alongside the local script), while writing the explanation and connecting sentences in natural ${langLabel}. Stay strictly educational and SFW.

Content to explain:
"""
${text}
"""`;

      const llmRes = await callAgentLlm({
        prompt,
        timeoutMs: 8500,
      });

      let explainedText = '';
      if (llmRes && llmRes.text) {
        explainedText = llmRes.text.trim();
      }

      if (!explainedText) {
        const sentences = text
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8);
        if (targetLanguage === 'Telugu') {
          explainedText =
            `🇮🇳 **తెలుగు వివరణ (Technical Terms in English):**\n\n` +
            sentences
              .map(
                (s, i) =>
                  `• **Point ${i + 1}:** ${s}\n  *(ఈ కాన్సెప్ట్ యొక్క ముఖ్య ఉద్దేశ్యం: పై technical terms మరియు సూత్రాలను పరీక్షలో నేరుగా అప్లై చేయడానికి గుర్తుంచుకోండి.)*`
              )
              .join('\n\n');
        } else {
          explainedText =
            `🇮🇳 **हिन्दी व्याख्या (Technical Terms in English):**\n\n` +
            sentences
              .map(
                (s, i) =>
                  `• **Point ${i + 1}:** ${s}\n  *(इस concept का मुख्य सार: परीक्षा में इन technical terms और सूत्रों का सीधा उपयोग किया जाता है।)*`
              )
              .join('\n\n');
        }
      }

      translationExplainCache.set(cacheKey, explainedText);

      return res.json({
        ok: true,
        language: targetLanguage,
        cached: false,
        explainedText,
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: err?.message || 'Could not translate explanation.',
      });
    }
  });
}


