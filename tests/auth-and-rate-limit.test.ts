import crypto from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../server';
import { getFirebaseProjectId } from '../server/config';
import { setTestPublicKeysForAuth } from '../server/auth';
import {
  InMemorySlidingWindowStore,
  resetAllRateLimiters,
  setPrimaryRateLimitStore,
  setRateLimitFailMode,
  setRateLimitPolicies,
  DEFAULT_TIER_POLICIES,
  type RateLimitStore,
} from '../server/rateLimiter';

const PROJECT_ID = getFirebaseProjectId();
const KID = 'test-firebase-kid-2026';

let trustedPrivateKeyPem = '';
let trustedPublicKeyPem = '';
let attackerPrivateKeyPem = '';

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
    sub: 'verified_user_123',
    user_id: 'verified_user_123',
    email: 'alice@example.com',
    email_verified: true,
    iat: nowSec - 60,
    exp: nowSec + 3600,
    ...overrides,
  };
}

describe('Phase 2 & 3 — Cryptographic Firebase Token Verification & Rate Limiting', () => {
  beforeAll(() => {
    const trustedPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    trustedPrivateKeyPem = trustedPair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    trustedPublicKeyPem = trustedPair.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const attackerPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    attackerPrivateKeyPem = attackerPair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    setTestPublicKeysForAuth({ [KID]: trustedPublicKeyPem });
  });

  afterAll(() => {
    setTestPublicKeysForAuth(null);
  });

  beforeEach(async () => {
    setPrimaryRateLimitStore(new InMemorySlidingWindowStore());
    setRateLimitFailMode('fallback');
    setRateLimitPolicies(DEFAULT_TIER_POLICIES);
    await resetAllRateLimiters();
  });

  it('allows intentionally public /api/health route without a token', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.projectId).toBe(PROJECT_ID);
  });

  it('rejects missing Bearer token on protected routes (/api/auth/verify, /api/user/quota, /api/treg/call)', async () => {
    const verifyRes = await request(app).get('/api/auth/verify');
    expect(verifyRes.status).toBe(401);
    expect(verifyRes.body.code).toBe('auth/missing-token');

    const quotaRes = await request(app).get('/api/user/quota');
    expect(quotaRes.status).toBe(401);
    expect(quotaRes.body.code).toBe('auth/missing-token');

    const tregCallRes = await request(app)
      .post('/api/treg/call')
      .send({ endpointId: 'treg.google.serp.organic', data: { q: 'test' } });
    expect(tregCallRes.status).toBe(401);
    expect(tregCallRes.body.code).toBe('auth/missing-token');
  });

  it('rejects malformed Authorization headers with 401', async () => {
    const resBasic = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(resBasic.status).toBe(401);
    expect(resBasic.body.code).toBe('auth/malformed-header');

    const resMalformedJwt = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer not-a-three-part-jwt');
    expect(resMalformedJwt.status).toBe(401);
    expect(resMalformedJwt.body.code).toBe('auth/malformed-token');
  });

  it('rejects forged base64url JWT payloads that previously bypassed unverified decoding', async () => {
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'RS256', kid: KID })).toString('base64url');
    const forgedPayload = Buffer.from(
      JSON.stringify(buildValidClaims({ sub: 'spoofed_admin_uid', user_id: 'spoofed_admin_uid' }))
    ).toString('base64url');
    const fakeSig = Buffer.from('forged-signature-bytes').toString('base64url');
    const forgedToken = `${fakeHeader}.${forgedPayload}.${fakeSig}`;

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('auth/invalid-signature');

    // Also verify optional-auth routes (/api/chat) reject forged tokens instead of silently accepting them
    const chatRes = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${forgedToken}`)
      .send({ messages: [{ role: 'user', content: 'hi' }] });
    expect(chatRes.status).toBe(401);
    expect(chatRes.body.code).toBe('auth/invalid-signature');
  });

  it('rejects JWTs signed with an attacker RSA private key (invalid signature)', async () => {
    const attackerToken = signJwt(
      { alg: 'RS256', typ: 'JWT', kid: KID },
      buildValidClaims({ sub: 'attacker_uid' }),
      attackerPrivateKeyPem
    );

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('auth/invalid-signature');
  });

  it('rejects unsigned alg:none JWTs', async () => {
    const h = Buffer.from(JSON.stringify({ alg: 'none', kid: KID })).toString('base64url');
    const p = Buffer.from(JSON.stringify(buildValidClaims())).toString('base64url');
    const noneToken = `${h}.${p}.sig`;

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${noneToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('auth/invalid-algorithm');
  });

  it('rejects expired Firebase ID tokens', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredToken = signJwt(
      { alg: 'RS256', typ: 'JWT', kid: KID },
      buildValidClaims({ iat: nowSec - 7200, exp: nowSec - 60 }),
      trustedPrivateKeyPem
    );

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('auth/token-expired');
  });

  it('rejects wrong-project tokens (mismatched aud or iss)', async () => {
    const wrongAudToken = signJwt(
      { alg: 'RS256', typ: 'JWT', kid: KID },
      buildValidClaims({
        aud: 'other-firebase-project',
        iss: 'https://securetoken.google.com/other-firebase-project',
      }),
      trustedPrivateKeyPem
    );

    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${wrongAudToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('auth/wrong-project');
  });

  it('accepts cryptographically valid tokens and derives UID exclusively from verified token (ignoring client-supplied UID)', async () => {
    const validToken = signJwt(
      { alg: 'RS256', typ: 'JWT', kid: KID },
      buildValidClaims({ sub: 'real_token_uid_999', user_id: 'real_token_uid_999' }),
      trustedPrivateKeyPem
    );

    const res = await request(app)
      .post('/api/auth/verify?uid=spoofed_query_uid')
      .set('Authorization', `Bearer ${validToken}`)
      .set('X-User-Id', 'spoofed_header_uid')
      .send({ uid: 'spoofed_body_uid', userId: 'spoofed_body_uid' });

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.uid).toBe('real_token_uid_999');
    expect(res.body.projectId).toBe(PROJECT_ID);
  });

  it('enforces per-IP vs per-UID rate limits and returns 429 with Retry-After', async () => {
    setRateLimitPolicies({
      general_api: {
        windowMs: 60_000,
        unauthenticatedMax: 2,
        authenticatedMax: 4,
      },
    });

    // Unauthenticated IP hits limit at 2 requests
    const r1 = await request(app).get('/api/health');
    const r2 = await request(app).get('/api/health');
    const r3 = await request(app).get('/api/health');
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.body.code).toBe('rate_limit/exceeded');
    expect(Number(r3.headers['retry-after'])).toBeGreaterThanOrEqual(1);

    // Authenticated user has separate per-UID bucket and higher limit (4)
    const validToken = signJwt(
      { alg: 'RS256', typ: 'JWT', kid: KID },
      buildValidClaims({ sub: 'rate_test_uid' }),
      trustedPrivateKeyPem
    );
    for (let i = 0; i < 4; i++) {
      const authRes = await request(app)
        .get('/api/user/quota')
        .set('Authorization', `Bearer ${validToken}`);
      expect(authRes.status).toBe(200);
    }
    const authExceeded = await request(app)
      .get('/api/user/quota')
      .set('Authorization', `Bearer ${validToken}`);
    expect(authExceeded.status).toBe(429);
  });

  it('fails safely (never unlimited) when the primary shared RateLimitStore throws an error', async () => {
    const brokenStore: RateLimitStore = {
      async incrementAndCheck() {
        throw new Error('Redis connection refused');
      },
      async reset() {},
    };
    setPrimaryRateLimitStore(brokenStore);
    setRateLimitPolicies({
      general_api: {
        windowMs: 60_000,
        unauthenticatedMax: 4, // emergency fallback halves this to 2
        authenticatedMax: 10,
      },
    });

    // Mode 1: fallback mode enforces emergency local sliding window & sets X-RateLimit-Degraded
    setRateLimitFailMode('fallback');
    const ok1 = await request(app).get('/api/health');
    const ok2 = await request(app).get('/api/health');
    const blocked3 = await request(app).get('/api/health');
    expect(ok1.status).toBe(200);
    expect(ok1.headers['x-ratelimit-degraded']).toBe('true');
    expect(ok2.status).toBe(200);
    expect(blocked3.status).toBe(429);

    // Mode 2: closed mode returns 503 Service Unavailable immediately
    setRateLimitFailMode('closed');
    const closedRes = await request(app).get('/api/health');
    expect(closedRes.status).toBe(503);
    expect(closedRes.body.code).toBe('rate_limit/store_unavailable');
  });
});
