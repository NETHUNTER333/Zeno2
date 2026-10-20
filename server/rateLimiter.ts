import type { Request, Response, NextFunction } from 'express';
import { resolveTrustedClientIp, sendNormalizedError } from './config';

/**
 * DEPLOYMENT NOTE — Process-Local vs. Horizontally Scaled Rate Limiting:
 * - By default, Zeno uses `InMemorySlidingWindowStore` in single-instance deployments.
 * - Limitation: Process-local memory is not shared across multiple container instances. In horizontally
 *   scaled deployments (e.g., Cloud Run with max-instances > 1), an attacker or heavy caller routed across
 *   N instances could achieve up to N * limit requests per window.
 * - Solution: Implement and inject a Redis-backed `RateLimitStore` via `setPrimaryRateLimitStore()` when
 *   scaling horizontally. `FailSafeRateLimiter` guarantees that if the shared store becomes unavailable,
 *   requests NEVER fail open to unlimited access—they either fall back to a strict process-local emergency
 *   sliding window (`failMode: 'fallback'`) or reject with 503 (`failMode: 'closed'`).
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
 * True sliding-window timestamp log store with bounded memory.
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
  if (routePath === '/chat' || routePath === '/summarize') {
    return 'ai_generation';
  }
  if (routePath === '/tts' || routePath.startsWith('/smallest/')) {
    return 'audio_generation';
  }
  if (
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
 *
 * KEYS[1] = rate limit bucket key (e.g. "zeno:rl:uid:alice:ai_generation")
 * ARGV[1] = nowMs
 * ARGV[2] = windowMs
 * ARGV[3] = maxRequests
 * ARGV[4] = unique request member ID
 *
 * Returns { allowed (1|0), remaining, resetAtMs }
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
  ): Promise< unknown >;
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
}

/**
 * Express middleware enforcing per-verified-UID (if authenticated) or per-trusted-IP (if unauthenticated)
 * sliding-window rate limits with safe failure handling.
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
  } catch (err) {
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

  res.setHeader('X-RateLimit-Tier', tier);
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAtMs / 1000)));
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
