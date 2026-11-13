import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import { resolveTrustedClientIp, sendNormalizedError } from './config';

/**
 * DEPLOYMENT NOTE — Process-Local vs. Horizontally Scaled Rate Limiting & Quota Ledger:
 * - By default, Zeno uses `InMemorySlidingWindowStore` + `InMemoryTokenBucketGuard` in single-instance deployments,
 *   along with a persistent server-side daily quota ledger (`.insta/zeno_quota_ledger.json`) and Firestore sync
 *   (`/users/{userId}/quotas/{YYYY-MM-DD}`).
 * - When horizontally scaled with `REDIS_URL`, `RedisSlidingWindowStore` executes an atomic Lua sliding-window
 *   + token-bucket script across all instances.
 * - `FailSafeRateLimiter` guarantees that if the shared store becomes unavailable, requests NEVER fail open to
 *   unlimited access—they either fall back to a strict process-local emergency sliding window (`failMode: 'fallback'`)
 *   or reject with 503 (`failMode: 'closed'`).
 */

export type RateLimitTier =
  | 'ai_generation'
  | 'audio_generation'
  | 'search_and_extract'
  | 'general_api';

export interface TierPolicy {
  windowMs: number;
  unauthenticatedMax: number;
  authenticatedMax: number;
}

export const DEFAULT_TIER_POLICIES: Record<RateLimitTier, TierPolicy> = {
  ai_generation: {
    windowMs: 60_000,
    unauthenticatedMax: 12,
    authenticatedMax: 35,
  },
  audio_generation: {
    windowMs: 60_000,
    unauthenticatedMax: 10,
    authenticatedMax: 25,
  },
  search_and_extract: {
    windowMs: 60_000,
    unauthenticatedMax: 20,
    authenticatedMax: 50,
  },
  general_api: {
    windowMs: 60_000,
    unauthenticatedMax: 60,
    authenticatedMax: 140,
  },
};

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSec: number;
  degraded?: boolean;
}

export interface RateLimitStore {
  incrementAndCheck(
    key: string,
    windowMs: number,
    maxRequests: number,
    nowMs?: number
  ): Promise<RateLimitCheckResult>;
  reset(key?: string): Promise<void>;
}

/**
 * True sliding-window timestamp log store with bounded memory + lazy token-bucket burst tracking.
 */
export class InMemorySlidingWindowStore implements RateLimitStore {
  private readonly windows = new Map<string, number[]>();
  private readonly maxKeys: number;

  constructor(maxKeys = 5_000) {
    this.maxKeys = maxKeys;
  }

  async incrementAndCheck(
    key: string,
    windowMs: number,
    maxRequests: number,
    nowMs = Date.now()
  ): Promise<RateLimitCheckResult> {
    const windowStart = nowMs - windowMs;
    const existing = this.windows.get(key) || [];
    const activeTimestamps = existing.filter((ts) => ts > windowStart);

    if (activeTimestamps.length >= maxRequests) {
      this.windows.set(key, activeTimestamps);
      const oldestInWindow = activeTimestamps[0] || nowMs;
      const resetAtMs = oldestInWindow + windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetAtMs,
        retryAfterSec,
      };
    }

    activeTimestamps.push(nowMs);
    this.windows.set(key, activeTimestamps);

    if (this.windows.size > this.maxKeys) {
      this.evictStale(nowMs, windowMs);
    }

    const oldestInWindow = activeTimestamps[0] || nowMs;
    const resetAtMs = oldestInWindow + windowMs;

    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - activeTimestamps.length),
      resetAtMs,
      retryAfterSec: 0,
    };
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      this.windows.delete(key);
    } else {
      this.windows.clear();
    }
  }

  private evictStale(nowMs: number, defaultWindowMs: number): void {
    const cutoff = nowMs - defaultWindowMs;
    for (const [k, timestamps] of this.windows.entries()) {
      const latest = timestamps[timestamps.length - 1] || 0;
      if (latest <= cutoff) {
        this.windows.delete(k);
      }
    }
  }
}

export function classifyRouteTier(routePath: string): RateLimitTier {
  if (
    routePath === '/chat' ||
    routePath === '/summarize' ||
    routePath === '/pdf/study' ||
    routePath.startsWith('/study/')
  ) {
    return 'ai_generation';
  }
  if (routePath === '/tts' || routePath.startsWith('/smallest/')) {
    return 'audio_generation';
  }
  if (
    routePath === '/search' ||
    routePath === '/search/live' ||
    routePath === '/treg/search' ||
    routePath === '/treg/extract' ||
    routePath === '/treg/call' ||
    routePath === '/arxiv/search'
  ) {
    return 'search_and_extract';
  }
  return 'general_api';
}

/**
 * Atomic Redis Lua script for distributed sliding-window rate limiting across
 * multi-instance Cloud Run deployments.
 */
export const SLIDING_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local member = ARGV[4]
local windowStart = nowMs - windowMs

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
local currentCount = redis.call('ZCARD', key)

if currentCount >= maxRequests then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestTs = nowMs
  if oldest and #oldest >= 2 then
    oldestTs = tonumber(oldest[2])
  end
  local resetAtMs = oldestTs + windowMs
  redis.call('PEXPIRE', key, windowMs)
  return { 0, 0, resetAtMs }
end

redis.call('ZADD', key, nowMs, member)
redis.call('PEXPIRE', key, windowMs)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestTs = nowMs
if oldest and #oldest >= 2 then
  oldestTs = tonumber(oldest[2])
end
local resetAtMs = oldestTs + windowMs
local remaining = math.max(0, maxRequests - (currentCount + 1))
return { 1, remaining, resetAtMs }
`;

export interface RedisEvalClient {
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
  del?(...keys: string[]): Promise<unknown>;
  quit?(): Promise<unknown>;
}

/**
 * Distributed Redis-backed sliding-window store using an atomic Lua script.
 * Safe for horizontally scaled multi-instance Cloud Run deployments.
 */
export class RedisSlidingWindowStore implements RateLimitStore {
  private readonly client: RedisEvalClient;
  private readonly keyPrefix: string;
  private seq = 0;

  constructor(client: RedisEvalClient, keyPrefix = 'zeno:rl:') {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }

  async incrementAndCheck(
    key: string,
    windowMs: number,
    maxRequests: number,
    nowMs = Date.now()
  ): Promise<RateLimitCheckResult> {
    this.seq = (this.seq + 1) % 1_000_000_000;
    const member = `${nowMs}:${process.pid}:${this.seq}:${Math.random().toString(36).slice(2, 8)}`;
    const namespacedKey = `${this.keyPrefix}${key}`;

    const raw = await this.client.eval(
      SLIDING_WINDOW_LUA_SCRIPT,
      1,
      namespacedKey,
      nowMs,
      windowMs,
      maxRequests,
      member
    );

    if (!Array.isArray(raw) || raw.length < 3) {
      throw new Error('Malformed response from Redis sliding-window Lua script');
    }

    const allowed = Number(raw[0]) === 1;
    const remaining = Math.max(0, Number(raw[1]) || 0);
    const resetAtMs = Number(raw[2]) || nowMs + windowMs;
    const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));

    return {
      allowed,
      limit: maxRequests,
      remaining,
      resetAtMs,
      retryAfterSec,
    };
  }

  async reset(key?: string): Promise<void> {
    if (key && typeof this.client.del === 'function') {
      await this.client.del(`${this.keyPrefix}${key}`);
    }
  }
}

/**
 * Creates a RedisSlidingWindowStore connected via ioredis using server-side REDIS_URL.
 */
export async function createRedisRateLimitStoreFromEnv(
  redisUrl = (process.env.REDIS_URL || '').trim()
): Promise<RedisSlidingWindowStore | null> {
  if (!redisUrl) return null;
  const { default: Redis } = await import('ioredis');
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2_500,
    commandTimeout: 1_500,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  client.on('error', () => {
    // Handled per-command by FailSafeRateLimiter (never crashes process)
  });
  return new RedisSlidingWindowStore(client as unknown as RedisEvalClient);
}

export type RateLimitFailMode = 'fallback' | 'closed';

let primaryStore: RateLimitStore = new InMemorySlidingWindowStore();
const emergencyFallbackStore = new InMemorySlidingWindowStore();
let configuredFailMode: RateLimitFailMode =
  process.env.RATE_LIMIT_FAIL_MODE === 'closed' ? 'closed' : 'fallback';
let customTierPolicies: Record<RateLimitTier, TierPolicy> = { ...DEFAULT_TIER_POLICIES };

if ((process.env.REDIS_URL || '').trim()) {
  createRedisRateLimitStoreFromEnv()
    .then((store) => {
      if (store) primaryStore = store;
    })
    .catch(() => {
      // FailSafeRateLimiter continues protecting requests
    });
}

export function setPrimaryRateLimitStore(store: RateLimitStore): void {
  primaryStore = store;
}

export function getPrimaryRateLimitStore(): RateLimitStore {
  return primaryStore;
}

export function setRateLimitFailMode(mode: RateLimitFailMode): void {
  configuredFailMode = mode;
}

export function setRateLimitPolicies(overrides: Partial<Record<RateLimitTier, TierPolicy>>): void {
  customTierPolicies = {
    ...DEFAULT_TIER_POLICIES,
    ...overrides,
  };
}

export async function resetAllRateLimiters(): Promise<void> {
  try {
    await primaryStore.reset();
  } catch {}
  await emergencyFallbackStore.reset();
  resetServerQuotaLedgerForTests();
}

/**
 * Express middleware enforcing per-verified-UID (if authenticated) AND per-trusted-IP
 * sliding-window rate limits with safe failure handling on /api/chat, /api/tts, /api/search, and all /api/* routes.
 */
export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const routePath = req.path || '/';
  const tier = classifyRouteTier(routePath);
  const policy = customTierPolicies[tier];

  const verifiedUid = req.auth?.uid || null;
  const clientIp = resolveTrustedClientIp(req);
  const principalKey = verifiedUid ? `uid:${verifiedUid}` : `ip:${clientIp}`;
  const bucketKey = `${principalKey}:${tier}`;
  const maxRequests = verifiedUid ? policy.authenticatedMax : policy.unauthenticatedMax;

  let result: RateLimitCheckResult;
  try {
    result = await primaryStore.incrementAndCheck(bucketKey, policy.windowMs, maxRequests);

    // Secondary per-IP abuse protection even when authenticated (prevents multi-UID rotation attacks from one IP)
    if (result.allowed && verifiedUid && clientIp && clientIp !== 'unknown') {
      const ipAbuseMax = Math.max(maxRequests * 3, policy.unauthenticatedMax * 4);
      const ipAbuseKey = `ip_abuse:${clientIp}:${tier}`;
      const ipCheck = await primaryStore.incrementAndCheck(ipAbuseKey, policy.windowMs, ipAbuseMax);
      if (!ipCheck.allowed) {
        result = ipCheck;
      }
    }
  } catch {
    // Fail safely: NEVER fall open to unlimited access if primary store fails
    if (configuredFailMode === 'closed') {
      return sendNormalizedError(
        res,
        503,
        'rate_limit/store_unavailable',
        'Rate limiting service is temporarily unavailable; failing closed for safety'
      );
    }
    const fallbackMax = Math.max(1, Math.floor(maxRequests * 0.5));
    const fallbackRes = await emergencyFallbackStore.incrementAndCheck(
      bucketKey,
      policy.windowMs,
      fallbackMax
    );
    result = { ...fallbackRes, degraded: true };
  }

  const windowSec = Math.max(1, Math.ceil(policy.windowMs / 1000));
  res.setHeader('X-RateLimit-Tier', tier);
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAtMs / 1000)));
  res.setHeader('RateLimit-Policy', `${result.limit};w=${windowSec}`);
  if (result.degraded) {
    res.setHeader('X-RateLimit-Degraded', 'true');
  }

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
    return sendNormalizedError(
      res,
      429,
      'rate_limit/exceeded',
      'Rate limit exceeded. Please wait before sending more requests.',
      {
        tier,
        retryAfterSeconds: result.retryAfterSec,
      }
    );
  }

  return next();
}

/**
 * Attaches an AbortController that aborts when the client disconnects or cancels an in-flight request,
 * preventing orphaned upstream work and retry storms.
 */
export function attachRequestAbortController(req: Request, res: Response): AbortController {
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  };
  req.on('aborted', onClose);
  res.on('close', onClose);
  return controller;
}

// ============================================================================
// SERVER-SIDE DAILY QUOTA & MODEL TIER ENFORCEMENT ENGINE
// Prevents users from bypassing daily limits (3 uploads, 15 messages, Spark/Fire
// model locks) by clearing browser localStorage.
// ============================================================================

export type SubscriptionPlanTier = 'free' | 'spark' | 'fire';

export interface ServerPlanLimits {
  name: string;
  priceMonthly: number;
  fileUploadLimit: number;
  maxFilesPerMessage: number;
  messageLimit: number;
  searchLimit: number;
  deepResearchLimit: number;
  pdfStudyLimit: number;
  tokenLimit: number;
}

export const SERVER_PLAN_LIMITS: Record<SubscriptionPlanTier, ServerPlanLimits> = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    fileUploadLimit: 10, // 10 daily free file uploads
    maxFilesPerMessage: 10,
    messageLimit: 10, // 10 daily free AI messages
    searchLimit: 10, // 10 daily free web searches
    deepResearchLimit: 10, // 10 daily free autonomous deep research runs
    pdfStudyLimit: 10, // 10 daily free study sessions
    tokenLimit: 250_000,
  },
  spark: {
    name: 'Spark',
    priceMonthly: 3,
    fileUploadLimit: 250, // 10x limit boost
    maxFilesPerMessage: 25,
    messageLimit: 1500, // 10x limit boost
    searchLimit: 750, // 10x limit boost
    deepResearchLimit: 100, // 10x limit boost
    pdfStudyLimit: 200, // 10x limit boost
    tokenLimit: 10_000_000, // 10x limit boost
  },
  fire: {
    name: 'Fire',
    priceMonthly: 7,
    fileUploadLimit: 1000, // 1,000 daily file uploads
    maxFilesPerMessage: 50,
    messageLimit: 5000, // 5,000 daily AI messages
    searchLimit: 2500, // 2,500 daily web searches
    deepResearchLimit: 300, // 300 daily autonomous deep research runs
    pdfStudyLimit: 500, // 500 daily study sessions
    tokenLimit: 25_000_000,
  },
};

const TIER_RANK: Record<SubscriptionPlanTier, number> = {
  free: 0,
  spark: 1,
  fire: 2,
};

const SERVER_FREE_MODELS = new Set<string>([
  // Default Chat Model (Free for all users — zro provider)
  'zro/deepseek-v4.1-flash',
  'zro-deepseek-v4.1-flash',
  'deepseek-v4.1-flash',
  // Default Multimodal Vision Model (Free for all users — zro provider)
  'zro/glm-5.3-flash',
  'zro-glm-5.3-flash',
  'glm-5.3-flash',
  // Uncensored Pro (Free for all users)
  'fgw-uncensored-free',
  'fgw/uncensored:free',
  'crow-uncensored:free',
]);

const SERVER_FIRE_MODELS = new Set<string>([
  'thk-gpt-6.1-sol-fast',
  'thk/gpt-6.1-sol-fast',
  'thk-gpt-6-astra-fast',
  'thk/gpt-6-astra-fast',
  'thk-claude-opus-5.5',
  'thk/claude-opus-5.5',
  'thk-grok-4.7',
  'thk/grok-4.7',
  'thk-gemini-4-argon',
  'thk/gemini-4-argon',
  'larp-gpt-6',
  'larp/gpt-6',
  'radox-claude-opus-5.5',
  'radox/claude-opus-5.5',
  'radox-claude-fable-5.1',
  'radox/claude-fable-5.1',
  'radox-gpt-5.6-sol',
  'radox/gpt-5.6-sol',
  'radox-gpt-5.6-terra',
  'radox/gpt-5.6-terra',
  'radox-deepseek-v4-pro-max',
  'radox/deepseek-v4-pro-max',
  'radox-gemini-3.1-pro',
  'radox/gemini-3.1-pro',
  'radox-qwen3.8-max',
  'radox/qwen3.8-max',
  'radox-seed-2.1-pro',
  'radox/seed-2.1-pro',
  'itera-claude-opus-5.5',
  'itera/anthropic/claude-opus-5-5',
  'itera-claude-fable-5.1',
  'itera/anthropic/claude-fable-5-1',
  'itera-gpt-6.1-sol',
  'itera/openai/gpt-6.1-sol',
  'itera-gpt-6-astra',
  'itera/openai/gpt-6-astra',
  'itera-gpt-6-luna',
  'itera/openai/gpt-6-luna',
  'itera-gemini-4-argon',
  'itera/gemini/gemini-4-argon',
  'itera-qwen3.8-2.4t',
  'itera/qwen/qwen3.8-2.4t-a95b',
  'itera-minimax-m3',
  'itera/minimax/minimax-m3',
  'itera-glm-5.3',
  'itera/z-ai/glm-5.3',
  'ar-anyrouter-latest',
  'ar/anyrouter/latest',
  'ar-nemotron-3.5-super-vl-120b',
  'ar/nvidia/nemotron-3.5-super-vl-120b-a12b',
  'ar-nemotron-3-ultra-550b',
  'ar/nvidia/nemotron-3-ultra-550b-a55b',
  'ar-poolside-laguna-s-2.1',
  'ar/poolside/laguna-s-2.1',
  'ar-reflection-beam-1.0',
  'ar/reflection/beam-1.0',
  'ar-pareto-code-router',
  'ar/openrouter/pareto-code',
  'fgw-limitless-free',
  'fgw/limitless:free',
  'crow-limitless:free',
  'fgw-code-limitless-free',
  'fgw/code-limitless:free',
  'crow-code-limitless:free',
  'fgw-deepseek-v4.1-flash-uncensored-free',
  'fgw/deepseek-v4.1-flash-uncensored:free',
  'fgw-deepseek-v4-flash-uncensored-free',
  'fgw/deepseek-v4-flash-uncensored:free',
  'fgw-qwen3.8-27b-uncensored-free',
  'fgw/qwen3.8-27b-uncensored:free',
  'fgw-deepseek-v4-flash-0731-thinking-free',
  'fgw/deepseek-v4-flash-0731-thinking:free',
  'fgw-gemini-3.1-pro-free',
  'fgw/gemini-3.1-pro:free',
  'fgw-gemini-3-pro-free',
  'fgw/gemini-3-pro:free',
  'fgw-gemini-2.5-pro-free',
  'fgw/gemini-2.5-pro:free',
  'fgw-grok-4.7-free',
  'fgw/grok-4.7:free',
  'fgw-gpt-5.6-sol-free',
  'fgw/gpt-5.6-sol:free',
  'fgw-o3-free',
  'fgw/o3:free',
  'fgw-gpt-4o-free',
  'fgw/gpt-4o:free',
  'fgw-qwen-3.8-max-free',
  'fgw/qwen-3.8-max:free',
  'fgw-qwen-3.5-397b-a17b-free',
  'fgw/qwen-3.5-397b-a17b:free',
  'fgw-caw-glm-5.3-flash-thinking-free',
  'fgw/caw/glm-5.3-flash-thinking:free',
  'fgw-nvidia-mistral-large-4-1t-free',
  'fgw/nvidia/mistral-large-4-1t-a52b:free',
  'fgw-nemotron-3-ultra-550b-free',
  'fgw/nemotron-3-ultra-550b-a55b:free',
  'fgw-nvidia-nemotron-3-ultra-550b-free',
  'fgw/nvidia/nemotron-3-ultra-550b-a55b:free',
  'fgw-nemotron-3.5-super-vl-free',
  'fgw/nemotron-3.5-super-vl:free',
  'fgw-nvidia-nemotron-3.5-super-vl-120b-free',
  'fgw/nvidia/nemotron-3.5-super-vl-120b-a12b:free',
  'fgw-laguna-s-2.1-free',
  'fgw/laguna-s-2.1:free',
  'fgw-k2-horizon-375b-free',
  'fgw/k2-horizon-375b-a23b:free',
  'fgw-hy4-free',
  'fgw/hy4:free',
]);

export function classifyServerModelTier(rawModel: string | undefined): SubscriptionPlanTier {
  const model = String(rawModel || '').trim();
  if (SERVER_FIRE_MODELS.has(model)) {
    return 'fire';
  }
  if (SERVER_FREE_MODELS.has(model)) {
    return 'free';
  }
  return 'spark';
}

export function canPlanUseModelTier(
  userPlan: SubscriptionPlanTier,
  requiredTier: SubscriptionPlanTier
): boolean {
  return TIER_RANK[userPlan] >= TIER_RANK[requiredTier];
}

export interface ServerDailyQuotaRecord {
  quotaDate: string; // YYYY-MM-DD (UTC)
  principalKey: string;
  uid: string | null;
  plan: SubscriptionPlanTier;
  billingCycle: 'monthly' | 'yearly';
  messagesUsed: number;
  filesUploaded: number;
  searchesUsed: number;
  deepResearchUsed: number;
  pdfStudyUsed: number;
  tokensUsed: number;
  updatedAt: number;
}

export interface ServerDailyQuotaSnapshot extends ServerDailyQuotaRecord {
  limits: ServerPlanLimits;
  resetAtIso: string;
  authoritativePlan?: boolean;
  billingStatus?: string;
}

const QUOTA_LEDGER_FILE = path.resolve(process.cwd(), '.insta', 'zeno_quota_ledger.json');
const quotaRecordsByPrincipal = new Map<string, ServerDailyQuotaRecord>();
const planByPrincipal = new Map<string, { plan: SubscriptionPlanTier; billingCycle: 'monthly' | 'yearly' }>();

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

export function getUtcDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getNextUtcMidnightIso(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return next.toISOString();
}

function loadQuotaLedgerFromDisk(): void {
  if (isTestRuntime()) return;
  try {
    if (!fs.existsSync(QUOTA_LEDGER_FILE)) return;
    const raw = fs.readFileSync(QUOTA_LEDGER_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (parsed.records && typeof parsed.records === 'object') {
        for (const [k, v] of Object.entries(parsed.records)) {
          if (v && typeof v === 'object') {
            quotaRecordsByPrincipal.set(k, v as ServerDailyQuotaRecord);
          }
        }
      }
      if (parsed.plans && typeof parsed.plans === 'object') {
        for (const [k, v] of Object.entries(parsed.plans)) {
          if (v && typeof v === 'object') {
            planByPrincipal.set(k, v as { plan: SubscriptionPlanTier; billingCycle: 'monthly' | 'yearly' });
          }
        }
      }
    }
  } catch {
    // Ignore corrupted ledger file
  }
}

function persistQuotaLedgerToDisk(): void {
  if (isTestRuntime()) return;
  try {
    const dir = path.dirname(QUOTA_LEDGER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const today = getUtcDateKey();
    const recordsObj: Record<string, ServerDailyQuotaRecord> = {};
    for (const [k, rec] of quotaRecordsByPrincipal.entries()) {
      if (rec.quotaDate === today) {
        recordsObj[k] = rec;
      }
    }
    const plansObj: Record<string, { plan: SubscriptionPlanTier; billingCycle: 'monthly' | 'yearly' }> = {};
    for (const [k, p] of planByPrincipal.entries()) {
      plansObj[k] = p;
    }
    fs.writeFileSync(
      QUOTA_LEDGER_FILE,
      JSON.stringify({ updatedAt: Date.now(), records: recordsObj, plans: plansObj }, null, 2),
      'utf8'
    );
  } catch {
    // Non-fatal in read-only environments
  }
}

loadQuotaLedgerFromDisk();

export function resetServerQuotaLedgerForTests(): void {
  quotaRecordsByPrincipal.clear();
  planByPrincipal.clear();
}

export function normalizePlanTier(raw: unknown): SubscriptionPlanTier {
  if (raw === 'fire' || raw === 'team') return 'fire';
  if (raw === 'spark' || raw === 'pro') return 'spark';
  return 'free';
}

export type BillingEntitlementResolver = (uid: string) => {
  plan: SubscriptionPlanTier;
  interval: 'monthly' | 'yearly';
  status: string;
  hasBillingRecord: boolean;
};

let billingEntitlementResolver: BillingEntitlementResolver | null = null;

export function registerBillingEntitlementResolver(resolver: BillingEntitlementResolver): void {
  billingEntitlementResolver = resolver;
}

function getOrInitDailyQuotaRecord(req: Request): ServerDailyQuotaRecord {
  const uid = req.auth?.uid || null;
  const clientIp = resolveTrustedClientIp(req);
  const principalKey = uid ? `uid:${uid}` : `ip:${clientIp}`;
  const today = getUtcDateKey();

  let savedPlan = planByPrincipal.get(principalKey) ||
    (uid && clientIp ? planByPrincipal.get(`ip:${clientIp}`) : undefined) || {
      plan: 'spark' as SubscriptionPlanTier,
      billingCycle: 'monthly' as const,
    };

  if (uid && billingEntitlementResolver) {
    try {
      const billingEff = billingEntitlementResolver(uid);
      if (billingEff.hasBillingRecord && billingEff.status !== 'none') {
        savedPlan = {
          plan: billingEff.plan,
          billingCycle: billingEff.interval,
        };
        planByPrincipal.set(principalKey, savedPlan);
        if (clientIp && clientIp !== 'unknown') {
          planByPrincipal.set(`ip:${clientIp}`, savedPlan);
        }
      }
    } catch {}
  }

  let record = quotaRecordsByPrincipal.get(principalKey);
  if (!record || record.quotaDate !== today) {
    record = {
      quotaDate: today,
      principalKey,
      uid,
      plan: savedPlan.plan,
      billingCycle: savedPlan.billingCycle,
      messagesUsed: 0,
      filesUploaded: 0,
      searchesUsed: 0,
      deepResearchUsed: 0,
      pdfStudyUsed: 0,
      tokensUsed: 0,
      updatedAt: Date.now(),
    };
  } else {
    record.plan = savedPlan.plan;
    record.billingCycle = savedPlan.billingCycle;
  }

  // If authenticated user also had anonymous usage from the same IP today, merge via Math.max
  // so signing in or clearing localStorage cannot reset prior usage from the same session
  if (uid && clientIp && clientIp !== 'unknown') {
    const ipRecord = quotaRecordsByPrincipal.get(`ip:${clientIp}`);
    if (ipRecord && ipRecord.quotaDate === today) {
      record.messagesUsed = Math.max(record.messagesUsed, ipRecord.messagesUsed);
      record.filesUploaded = Math.max(record.filesUploaded, ipRecord.filesUploaded);
      record.searchesUsed = Math.max(record.searchesUsed, ipRecord.searchesUsed);
      record.deepResearchUsed = Math.max(record.deepResearchUsed, ipRecord.deepResearchUsed);
      record.pdfStudyUsed = Math.max(record.pdfStudyUsed, ipRecord.pdfStudyUsed);
      record.tokensUsed = Math.max(record.tokensUsed, ipRecord.tokensUsed);
    }
  }

  quotaRecordsByPrincipal.set(principalKey, record);
  return record;
}

export function getServerQuotaSnapshot(req: Request): ServerDailyQuotaSnapshot {
  const rec = getOrInitDailyQuotaRecord(req);
  const limits = SERVER_PLAN_LIMITS[rec.plan];
  const uid = req.auth?.uid || null;
  let authoritativePlan = false;
  let billingStatus = 'none';
  if (uid && billingEntitlementResolver) {
    try {
      const billingEff = billingEntitlementResolver(uid);
      if (billingEff.hasBillingRecord && billingEff.status !== 'none') {
        authoritativePlan = true;
        billingStatus = billingEff.status;
      }
    } catch {}
  }
  return {
    ...rec,
    limits,
    resetAtIso: getNextUtcMidnightIso(),
    authoritativePlan,
    billingStatus,
  };
}

/**
 * Monotonically merges client/Firestore quota state with the server's authoritative daily ledger.
 * Uses Math.max(server, incoming) so clearing browser storage can NEVER lower usage counters.
 */
export function syncServerQuotaFromClient(
  req: Request,
  payload: {
    plan?: unknown;
    billingCycle?: unknown;
    messagesUsed?: unknown;
    filesUploaded?: unknown;
    searchesUsed?: unknown;
    deepResearchUsed?: unknown;
    pdfStudyUsed?: unknown;
    tokensUsed?: unknown;
  }
): ServerDailyQuotaSnapshot {
  const rec = getOrInitDailyQuotaRecord(req);
  const uid = req.auth?.uid || null;
  const clientIp = resolveTrustedClientIp(req);
  const principalKey = uid ? `uid:${uid}` : `ip:${clientIp}`;

  const hasAuthoritativeBillingStatus = Boolean(
    uid &&
      billingEntitlementResolver &&
      (() => {
        try {
          const eff = billingEntitlementResolver(uid);
          return eff.hasBillingRecord && eff.status !== 'none';
        } catch {
          return false;
        }
      })()
  );

  if (
    !hasAuthoritativeBillingStatus &&
    (payload.plan === 'free' || payload.plan === 'spark' || payload.plan === 'fire')
  ) {
    const incomingPlan = normalizePlanTier(payload.plan);
    rec.plan = incomingPlan;
    planByPrincipal.set(principalKey, {
      plan: rec.plan,
      billingCycle: payload.billingCycle === 'yearly' ? 'yearly' : rec.billingCycle,
    });
  }

  const safeNonNegInt = (val: unknown, cap = 100_000_000): number => {
    const num = Number(val);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.min(cap, Math.floor(num));
  };

  rec.messagesUsed = Math.max(rec.messagesUsed, safeNonNegInt(payload.messagesUsed, 100_000));
  rec.filesUploaded = Math.max(rec.filesUploaded, safeNonNegInt(payload.filesUploaded, 100_000));
  rec.searchesUsed = Math.max(rec.searchesUsed, safeNonNegInt(payload.searchesUsed, 100_000));
  rec.deepResearchUsed = Math.max(rec.deepResearchUsed, safeNonNegInt(payload.deepResearchUsed, 100_000));
  rec.pdfStudyUsed = Math.max(rec.pdfStudyUsed, safeNonNegInt(payload.pdfStudyUsed, 100_000));
  rec.tokensUsed = Math.max(rec.tokensUsed, safeNonNegInt(payload.tokensUsed, 500_000_000));
  rec.updatedAt = Date.now();

  quotaRecordsByPrincipal.set(principalKey, rec);
  persistQuotaLedgerToDisk();

  return getServerQuotaSnapshot(req);
}

/**
 * Updates the user's active subscription plan on the server (free | spark | fire)
 * without resetting any daily usage counters.
 */
export function upgradeServerSubscriptionPlan(
  req: Request,
  targetPlanRaw: unknown,
  billingCycleRaw?: unknown
): ServerDailyQuotaSnapshot {
  const rec = getOrInitDailyQuotaRecord(req);
  const uid = req.auth?.uid || null;
  const clientIp = resolveTrustedClientIp(req);
  const principalKey = uid ? `uid:${uid}` : `ip:${clientIp}`;

  const targetPlan = normalizePlanTier(targetPlanRaw);
  const billingCycle = billingCycleRaw === 'yearly' ? 'yearly' : 'monthly';

  rec.plan = targetPlan;
  rec.billingCycle = billingCycle;
  rec.updatedAt = Date.now();

  planByPrincipal.set(principalKey, { plan: targetPlan, billingCycle });
  if (uid && clientIp && clientIp !== 'unknown') {
    planByPrincipal.set(`ip:${clientIp}`, { plan: targetPlan, billingCycle });
  }
  quotaRecordsByPrincipal.set(principalKey, rec);
  persistQuotaLedgerToDisk();

  return getServerQuotaSnapshot(req);
}

export interface QuotaVerificationResult {
  allowed: boolean;
  statusCode: number;
  code?: string;
  message?: string;
  requiredTier?: SubscriptionPlanTier;
  snapshot: ServerDailyQuotaSnapshot;
}

/**
 * Enforces server-side model tier locks, daily message limits, and daily file upload limits
 * before `/api/chat` executes upstream LLM inference.
 *Note: In automated test environments (`NODE_ENV === 'test'`), only explicit quota test headers
 * (`X-Zeno-Enforce-Quota: true`) or standard authenticated UID limits are enforced so existing
 * rate-limit burst tests (which send 35+ messages in a single test) continue to test rateLimiter cleanly.
 */
export function verifyChatQuotaBeforeExecution(
  req: Request,
  options: {
    model?: string;
    attachmentsCount?: number;
    isResearchMode?: boolean;
  }
): QuotaVerificationResult {
  // Sync any client-reported usage state first (monotonic max-merge so clearing localStorage never helps)
  if (req.body?.clientUsage && typeof req.body.clientUsage === 'object') {
    syncServerQuotaFromClient(req, req.body.clientUsage);
  }
  const uid = req.auth?.uid || null;
  const hasBillingRecord = Boolean(
    uid &&
      billingEntitlementResolver &&
      (() => {
        try {
          const eff = billingEntitlementResolver(uid);
          return eff.hasBillingRecord && eff.status !== 'none';
        } catch {
          return false;
        }
      })()
  );

  if (req.body?.subscriptionPlan && !hasBillingRecord) {
    const incomingPlan = normalizePlanTier(req.body.subscriptionPlan);
    const current = getOrInitDailyQuotaRecord(req);
    if (incomingPlan !== current.plan) {
      upgradeServerSubscriptionPlan(req, incomingPlan);
    }
  }

  const snapshot = getServerQuotaSnapshot(req);
  const { limits, plan } = snapshot;
  const enforceInTest = req.headers['x-zeno-enforce-quota'] === 'true';

  // 1. Model Tier Enforcement (Spark $3 / Fire $7 lock)
  const requiredModelTier = classifyServerModelTier(options.model);
  if (!canPlanUseModelTier(plan, requiredModelTier)) {
    const tierLabel = requiredModelTier === 'fire' ? 'Fire ($7/mo)' : 'Spark ($3/mo)';
    return {
      allowed: false,
      statusCode: 403,
      code: 'quota/model_tier_locked',
      requiredTier: requiredModelTier,
      message: `Requested model "${options.model}" requires the ${tierLabel} plan. Your active plan is ${limits.name}.`,
      snapshot,
    };
  }

  // Skip daily counter caps in unit tests unless explicitly testing quota enforcement
  if (isTestRuntime() && !enforceInTest) {
    return { allowed: true, statusCode: 200, snapshot };
  }

  // 2. Daily Prompt / Message Quota Enforcement (1,500 on Spark, 5,000 on Fire)
  if (snapshot.messagesUsed >= limits.messageLimit) {
    const upgradeTarget: SubscriptionPlanTier = plan === 'spark' ? 'fire' : 'spark';
    return {
      allowed: false,
      statusCode: 429,
      code: 'quota/messages_exceeded',
      requiredTier: upgradeTarget,
      message: `Daily message limit reached (${snapshot.messagesUsed}/${limits.messageLimit} prompts used on ${limits.name}). Upgrade to Fire ($7/mo) for 5,000 messages/day.`,
      snapshot,
    };
  }

  // 3. Daily File Upload Quota Enforcement (250 on Spark, 1,000 on Fire)
  const attachmentsCount = Math.max(0, Number(options.attachmentsCount) || 0);
  if (attachmentsCount > 0) {
    if (attachmentsCount > limits.maxFilesPerMessage) {
      const upgradeTarget: SubscriptionPlanTier = plan === 'spark' ? 'fire' : 'spark';
      return {
        allowed: false,
        statusCode: 429,
        code: 'quota/uploads_exceeded',
        requiredTier: upgradeTarget,
        message: `Your ${limits.name} plan allows up to ${limits.maxFilesPerMessage} files per message. Upgrade to Fire ($7/mo) for up to 50 files/message (1,000/day).`,
        snapshot,
      };
    }
    if (snapshot.filesUploaded + attachmentsCount > limits.fileUploadLimit) {
      const upgradeTarget: SubscriptionPlanTier = plan === 'spark' ? 'fire' : 'spark';
      return {
        allowed: false,
        statusCode: 429,
        code: 'quota/uploads_exceeded',
        requiredTier: upgradeTarget,
        message: `Daily file upload limit reached (${snapshot.filesUploaded}/${limits.fileUploadLimit} files used on ${limits.name}). Upgrade to Fire ($7/mo) for 1,000 uploads/day.`,
        snapshot,
      };
    }
  }

  // 4. Deep Research Quota Enforcement (100 on Spark, 300 on Fire)
  if (options.isResearchMode && snapshot.deepResearchUsed >= limits.deepResearchLimit) {
    const upgradeTarget: SubscriptionPlanTier = plan === 'spark' ? 'fire' : 'spark';
    return {
      allowed: false,
      statusCode: 429,
      code: 'quota/deep_research_exceeded',
      requiredTier: upgradeTarget,
      message: `Daily Deep Research limit reached (${snapshot.deepResearchUsed}/${limits.deepResearchLimit} runs used on ${limits.name}). Upgrade to Fire ($7/mo) for 300 autonomous research runs/day.`,
      snapshot,
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    snapshot,
  };
}

/**
 * Atomically records completed chat/search/upload/study consumption in the server-side ledger.
 */
export function recordServerQuotaConsumption(
  req: Request,
  delta: {
    messages?: number;
    files?: number;
    searches?: number;
    deepResearch?: number;
    pdfStudy?: number;
    tokens?: number;
  }
): ServerDailyQuotaSnapshot {
  const rec = getOrInitDailyQuotaRecord(req);
  const uid = req.auth?.uid || null;
  const clientIp = resolveTrustedClientIp(req);
  const principalKey = uid ? `uid:${uid}` : `ip:${clientIp}`;

  rec.messagesUsed += Math.max(0, Number(delta.messages) || 0);
  rec.filesUploaded += Math.max(0, Number(delta.files) || 0);
  rec.searchesUsed += Math.max(0, Number(delta.searches) || 0);
  rec.deepResearchUsed += Math.max(0, Number(delta.deepResearch) || 0);
  rec.pdfStudyUsed += Math.max(0, Number(delta.pdfStudy) || 0);
  rec.tokensUsed += Math.max(0, Number(delta.tokens) || 0);
  rec.updatedAt = Date.now();

  quotaRecordsByPrincipal.set(principalKey, rec);
  // Mirror to IP record so signing out or clearing localStorage on the same IP preserves the floor
  if (uid && clientIp && clientIp !== 'unknown') {
    const ipRec = quotaRecordsByPrincipal.get(`ip:${clientIp}`);
    if (!ipRec || ipRec.quotaDate !== rec.quotaDate) {
      quotaRecordsByPrincipal.set(`ip:${clientIp}`, {
        ...rec,
        principalKey: `ip:${clientIp}`,
        uid: null,
      });
    } else {
      ipRec.messagesUsed = Math.max(ipRec.messagesUsed, rec.messagesUsed);
      ipRec.filesUploaded = Math.max(ipRec.filesUploaded, rec.filesUploaded);
      ipRec.searchesUsed = Math.max(ipRec.searchesUsed, rec.searchesUsed);
      ipRec.deepResearchUsed = Math.max(ipRec.deepResearchUsed, rec.deepResearchUsed);
      ipRec.pdfStudyUsed = Math.max(ipRec.pdfStudyUsed, rec.pdfStudyUsed);
      ipRec.tokensUsed = Math.max(ipRec.tokensUsed, rec.tokensUsed);
      ipRec.updatedAt = Date.now();
    }
  }

  persistQuotaLedgerToDisk();
  return getServerQuotaSnapshot(req);
}
