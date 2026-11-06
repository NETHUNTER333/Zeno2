import crypto from 'crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../server';
import {
  getFirebaseProjectId,
  getStagingConfigSummary,
  getTrustProxySetting,
  resolveTrustedClientIp,
  sanitizeErrorMessage,
} from '../server/config';
import { setTestPublicKeysForAuth } from '../server/auth';
import {
  DEFAULT_TIER_POLICIES,
  InMemorySlidingWindowStore,
  RedisSlidingWindowStore,
  resetAllRateLimiters,
  setPrimaryRateLimitStore,
  setRateLimitFailMode,
  setRateLimitPolicies,
  type RedisEvalClient,
} from '../server/rateLimiter';

const PROJECT_ID = getFirebaseProjectId();
const KID = 'staging-firebase-kid-2026';

let trustedPrivateKeyPem = '';
let trustedPublicKeyPem = '';

function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyPem: string
): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), privateKeyPem)
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

function buildValidClaims(overrides: Record<string, unknown> = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: 'staging_verified_user',
    user_id: 'staging_verified_user',
    email: 'staging@example.com',
    email_verified: true,
    iat: nowSec - 60,
    exp: nowSec + 3600,
    ...overrides,
  };
}

/**
 * Shared atomic sorted-set engine that executes the exact semantics of
 * `SLIDING_WINDOW_LUA_SCRIPT` (`ZREMRANGEBYSCORE`, `ZCARD`, `ZRANGE WITHSCORES`, `ZADD`, `PEXPIRE`)
 * across multiple simulated Cloud Run container instances.
 */
class SharedAtomicRedisBackend implements RedisEvalClient {
  private readonly zsets = new Map<string, Array<{ score: number; member: string }>>();
  public evalCallCount = 0;
  public simulateDown = false;

  async eval(
    _script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown> {
    if (this.simulateDown) {
      throw new Error('READONLY / Redis cluster connection lost');
    }
    this.evalCallCount += 1;
    expect(numKeys).toBe(1);
    const key = String(args[0]);
    const nowMs = Number(args[1]);
    const windowMs = Number(args[2]);
    const maxRequests = Number(args[3]);
    const member = String(args[4]);
    const windowStart = nowMs - windowMs;

    const current = (this.zsets.get(key) || []).filter((entry) => entry.score > windowStart);
    current.sort((a, b) => a.score - b.score);

    if (current.length >= maxRequests) {
      this.zsets.set(key, current);
      const oldestTs = current[0]?.score ?? nowMs;
      const resetAtMs = oldestTs + windowMs;
      return [0, 0, resetAtMs];
    }

    current.push({ score: nowMs, member });
    current.sort((a, b) => a.score - b.score);
    this.zsets.set(key, current);
    const oldestTs = current[0]?.score ?? nowMs;
    const resetAtMs = oldestTs + windowMs;
    const remaining = Math.max(0, maxRequests - current.length);
    return [1, remaining, resetAtMs];
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const k of keys) {
      if (this.zsets.delete(k)) removed += 1;
    }
    return removed;
  }
}

describe('Staging Configuration Verification & Multi-Instance Cloud Run Distributed Rate Limiting', () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    trustedPrivateKeyPem = pair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    trustedPublicKeyPem = pair.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    setTestPublicKeysForAuth({ [KID]: trustedPublicKeyPem });
  });

  afterAll(() => {
    setTestPublicKeysForAuth(null);
  });

  beforeEach(async () => {
    process.env = { ...originalEnv };
    setPrimaryRateLimitStore(new InMemorySlidingWindowStore());
    setRateLimitFailMode('fallback');
    setRateLimitPolicies(DEFAULT_TIER_POLICIES);
    await resetAllRateLimiters();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('verifies staging strict authentication mode (REQUIRE_AUTH_FOR_CHAT=true) across AI, search, and TTS routes', async () => {
    process.env.REQUIRE_AUTH_FOR_CHAT = 'true';

    // Health check returns clean status and /api/health/details reflects staging strict auth flag
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toEqual({ status: 'ok', version: '1.0.0' });

    const detailsRes = await request(app).get('/api/health/details');
    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.staging.strictAuthRequired).toBe(true);

    // Unauthenticated calls to optional-auth routes must now be rejected with 401
    const unauthChat = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'Hello' }] });
    expect(unauthChat.status).toBe(401);
    expect(unauthChat.body.code).toBe('auth/missing-token');

    const unauthSummarize = await request(app)
      .post('/api/summarize')
      .send({ content: 'Long text to summarize' });
    expect(unauthSummarize.status).toBe(401);
    expect(unauthSummarize.body.code).toBe('auth/missing-token');

    const unauthSearch = await request(app).get('/api/search/live?q=test');
    expect(unauthSearch.status).toBe(401);
    expect(unauthSearch.body.code).toBe('auth/missing-token');

    // Cryptographically valid token passes strict auth gate
    const validToken = signJwt(
      { alg: 'RS256', typ: 'JWT', kid: KID },
      buildValidClaims({ sub: 'staging_user_42', user_id: 'staging_user_42' }),
      trustedPrivateKeyPem
    );
    const authedQuota = await request(app)
      .get('/api/user/quota')
      .set('Authorization', `Bearer ${validToken}`);
    expect(authedQuota.status).toBe(200);
    expect(authedQuota.body.uid).toBe('staging_user_42');
  });

  it('verifies trusted proxy settings for Cloud Run (K_SERVICE) and prevents X-Forwarded-For spoofing when untrusted', () => {
    // Default local/direct mode: trust proxy is false, spoofed X-Forwarded-For is ignored
    delete process.env.TRUST_PROXY;
    delete process.env.K_SERVICE;
    expect(getTrustProxySetting()).toBe(false);

    const mockReqUntrusted: any = {
      headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.77' },
      socket: { remoteAddress: '::ffff:127.0.0.1' },
      ip: '127.0.0.1',
    };
    expect(resolveTrustedClientIp(mockReqUntrusted)).toBe('127.0.0.1');

    // Cloud Run staging/production mode: K_SERVICE is set -> trust proxy = 1 hop
    // If attacker sends "X-Forwarded-For: 1.2.3.4" and Cloud Run LB appends real client IP "198.51.100.77",
    // single-hop extraction selects "198.51.100.77" and ignores the spoofed "1.2.3.4" prefix!
    process.env.K_SERVICE = 'zeno-prod-service';
    expect(getTrustProxySetting()).toBe(1);
    expect(resolveTrustedClientIp(mockReqUntrusted)).toBe('198.51.100.77');
  });

  it('verifies provider credential reporting and redacts Bearer tokens and API keys from error messages', () => {
    process.env.TREG_TOKEN = 'secret_treg_token_value';
    process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForTestingRedaction1234567890';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.RATE_LIMIT_FAIL_MODE = 'closed';

    const summary = getStagingConfigSummary();
    expect(summary.tregConfigured).toBe(true);
    expect(summary.geminiConfigured).toBe(true);
    expect(summary.redisConfigured).toBe(true);
    expect(summary.rateLimitFailMode).toBe('closed');
    // Ensure raw secrets never appear in summary
    expect(JSON.stringify(summary)).not.toContain('secret_treg_token_value');
    expect(JSON.stringify(summary)).not.toContain('AIzaSyFakeKey');

    // Verify error message sanitization redacts both Bearer tokens and Google API keys
    const leakedError = new Error(
      'Upstream failed with header Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig and key AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
    );
    const sanitized = sanitizeErrorMessage(leakedError);
    expect(sanitized).toContain('Bearer [REDACTED]');
    expect(sanitized).toContain('[REDACTED_API_KEY]');
    expect(sanitized).not.toContain('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(sanitized).not.toContain('AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz0123456789');
  });

  it('enforces a global quota across 3 simulated Cloud Run instances using RedisSlidingWindowStore', async () => {
    const sharedRedis = new SharedAtomicRedisBackend();

    // Simulate 3 separate Cloud Run container instances each holding their own RedisSlidingWindowStore
    const instanceAStore = new RedisSlidingWindowStore(sharedRedis, 'zeno:rl:');
    const instanceBStore = new RedisSlidingWindowStore(sharedRedis, 'zeno:rl:');
    const instanceCStore = new RedisSlidingWindowStore(sharedRedis, 'zeno:rl:');

    const windowMs = 60_000;
    const globalLimit = 5;
    const bucketKey = 'uid:multi_instance_user:ai_generation';
    const baseNow = 1_750_000_000_000;

    // Route 2 requests to Instance A, 2 requests to Instance B, 1 request to Instance C (total = 5 = globalLimit)
    const r1 = await instanceAStore.incrementAndCheck(bucketKey, windowMs, globalLimit, baseNow + 10);
    const r2 = await instanceBStore.incrementAndCheck(bucketKey, windowMs, globalLimit, baseNow + 20);
    const r3 = await instanceCStore.incrementAndCheck(bucketKey, windowMs, globalLimit, baseNow + 30);
    const r4 = await instanceAStore.incrementAndCheck(bucketKey, windowMs, globalLimit, baseNow + 40);
    const r5 = await instanceBStore.incrementAndCheck(bucketKey, windowMs, globalLimit, baseNow + 50);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(true);
    expect(r5.allowed).toBe(true);
    expect(r5.remaining).toBe(0);

    // 6th request routed to Instance C MUST be rejected with 429 (proving quota is global, not N * limit)
    const r6BlockedOnC = await instanceCStore.incrementAndCheck(bucketKey, windowMs, globalLimit, baseNow + 60);
    expect(r6BlockedOnC.allowed).toBe(false);
    expect(r6BlockedOnC.remaining).toBe(0);
    expect(r6BlockedOnC.retryAfterSec).toBeGreaterThanOrEqual(59);

    // After sliding window advances past the first two timestamps (+60_025ms), 2 slots free up globally
    const r7AfterWindow = await instanceAStore.incrementAndCheck(
      bucketKey,
      windowMs,
      globalLimit,
      baseNow + 60_025
    );
    expect(r7AfterWindow.allowed).toBe(true);
    expect(r7AfterWindow.remaining).toBe(1);
  });

  it('integrates RedisSlidingWindowStore with Express middleware and fails safely if Redis disconnects mid-traffic', async () => {
    const sharedRedis = new SharedAtomicRedisBackend();
    const redisStore = new RedisSlidingWindowStore(sharedRedis, 'zeno:rl:');
    setPrimaryRateLimitStore(redisStore);
    setRateLimitPolicies({
      general_api: {
        windowMs: 60_000,
        unauthenticatedMax: 3,
        authenticatedMax: 6,
      },
    });

    // 3 requests succeed via shared Redis store
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
    }
    // 4th request blocked by shared Redis store
    const fourth = await request(app).get('/api/health');
    expect(fourth.status).toBe(429);

    // Now simulate Redis outage: verify fail-safe fallback never allows unlimited traffic
    sharedRedis.simulateDown = true;
    setRateLimitFailMode('fallback');
    const degradedRes = await request(app).get('/api/health');
    expect(degradedRes.status).toBe(200);
    expect(degradedRes.headers['x-ratelimit-degraded']).toBe('true');

    // Emergency fallback limit is floor(3 * 0.5) = 1, so next request during outage is rejected with 429
    const degradedBlocked = await request(app).get('/api/health');
    expect(degradedBlocked.status).toBe(429);
  });
});
