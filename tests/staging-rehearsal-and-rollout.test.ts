import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../server';
import {
  getFirebaseProjectId,
  getStagingConfigSummary,
  sanitizeErrorMessage,
} from '../server/config';
import { firebaseAuthMiddleware, setTestPublicKeysForAuth } from '../server/auth';
import {
  DEFAULT_TIER_POLICIES,
  InMemorySlidingWindowStore,
  RedisSlidingWindowStore,
  rateLimitMiddleware,
  resetAllRateLimiters,
  setPrimaryRateLimitStore,
  setRateLimitFailMode,
  setRateLimitPolicies,
  type RedisEvalClient,
} from '../server/rateLimiter';

const PROJECT_ID = getFirebaseProjectId();
const KID = 'rehearsal-kid-2026';

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
    sub: 'rehearsal_user_1',
    user_id: 'rehearsal_user_1',
    email: 'rehearsal@example.com',
    email_verified: true,
    iat: nowSec - 30,
    exp: nowSec + 3600,
    ...overrides,
  };
}

class ClusterRedisBackend implements RedisEvalClient {
  private readonly zsets = new Map<string, Array<{ score: number; member: string }>>();
  public simulateOutage = false;

  async eval(
    _script: string,
    _numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown> {
    if (this.simulateOutage) {
      throw new Error('ECONNREFUSED redis://:super_secret_redis_pass@10.0.0.50:6379');
    }
    const key = String(args[0]);
    const nowMs = Number(args[1]);
    const windowMs = Number(args[2]);
    const maxRequests = Number(args[3]);
    const member = String(args[4]);
    const windowStart = nowMs - windowMs;

    const current = (this.zsets.get(key) || []).filter((e) => e.score > windowStart);
    current.sort((a, b) => a.score - b.score);

    if (current.length >= maxRequests) {
      this.zsets.set(key, current);
      const oldestTs = current[0]?.score ?? nowMs;
      return [0, 0, oldestTs + windowMs];
    }

    current.push({ score: nowMs, member });
    current.sort((a, b) => a.score - b.score);
    this.zsets.set(key, current);
    const oldestTs = current[0]?.score ?? nowMs;
    const remaining = Math.max(0, maxRequests - current.length);
    return [1, remaining, oldestTs + windowMs];
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const k of keys) {
      if (this.zsets.delete(k)) deleted += 1;
    }
    return deleted;
  }
}

describe('Release Gates 1–4 & Staging Deployment Rehearsal with Automated Rollback', () => {
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

  it('Gate 1: verifies health and status endpoints expose zero sensitive credentials, tokens, Redis URIs, or internal org names', async () => {
    process.env.REQUIRE_AUTH_FOR_CHAT = 'true';
    process.env.K_SERVICE = 'zeno-staging-asia-east1';
    process.env.TRUST_PROXY = '1';
    process.env.REDIS_URL = 'rediss://default:StagingRedisSecretPass99@10.128.0.14:6379';
    process.env.TREG_TOKEN = 'treg_live_secret_token_987654321';
    process.env.TREG_ORG = 'internal_private_org_name';
    process.env.GEMINI_API_KEY = 'AIzaSyStagingSecretKeyValueDoNotLeak123456';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: 'service_account',
      project_id: PROJECT_ID,
      client_email: `firebase-adminsdk@${PROJECT_ID}.iam.gserviceaccount.com`,
      private_key: trustedPrivateKeyPem,
    });
    process.env.FIREBASE_CHECK_REVOKED = 'true';

    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    const healthRaw = JSON.stringify(healthRes.body);

    // Confirm boolean staging indicators are accurate
    expect(healthRes.body.staging).toEqual({
      firebaseProjectId: PROJECT_ID,
      firebaseCredentialsConfigured: true,
      firebaseCheckRevoked: true,
      strictAuthRequired: true,
      trustProxy: 1,
      cloudRunService: 'zeno-staging-asia-east1',
      tregConfigured: true,
      geminiConfigured: true,
      redisConfigured: true,
      rateLimitFailMode: 'fallback',
    });

    // Confirm zero sensitive values are exposed in /api/health
    expect(healthRaw).not.toContain('StagingRedisSecretPass99');
    expect(healthRaw).not.toContain('10.128.0.14');
    expect(healthRaw).not.toContain('treg_live_secret_token_987654321');
    expect(healthRaw).not.toContain('internal_private_org_name');
    expect(healthRaw).not.toContain('AIzaSyStagingSecretKeyValueDoNotLeak123456');
    expect(healthRaw).not.toContain('BEGIN RSA PRIVATE KEY');
    expect(healthRaw).not.toContain('firebase-adminsdk@');

    // Confirm /api/treg/status also exposes only boolean flags and never raw org or tokens
    const statusRes = await request(app).get('/api/treg/status');
    expect(statusRes.status).toBe(200);
    const statusRaw = JSON.stringify(statusRes.body);
    expect(statusRes.body.orgConfigured).toBe(true);
    expect(statusRes.body.tokenConfigured).toBe(true);
    expect(statusRes.body.org).toBeUndefined();
    expect(statusRes.body.userTeam).toBeUndefined();
    expect(statusRaw).not.toContain('internal_private_org_name');
    expect(statusRaw).not.toContain('treg_live_secret_token_987654321');

    // Verify error sanitization redacts Redis URIs, private keys, and provider tokens
    const scrubbed = sanitizeErrorMessage(
      new Error(
        `Connection failed to rediss://default:StagingRedisSecretPass99@10.128.0.14:6379 with token treg_live_secret_token_987654321 and key ${trustedPrivateKeyPem}`
      )
    );
    expect(scrubbed).toContain('redis://[REDACTED_REDIS_URI]');
    expect(scrubbed).toContain('[REDACTED_TOKEN]');
    expect(scrubbed).toContain('[REDACTED_PRIVATE_KEY]');
    expect(scrubbed).not.toContain('StagingRedisSecretPass99');
    expect(scrubbed).not.toContain('treg_live_secret_token_987654321');
  });

  it('Gate 2: validates multi-instance HTTP cluster (3 live HTTP servers), global Redis quota, p95/p99 latency, and Redis failover/recovery', async () => {
    process.env.REQUIRE_AUTH_FOR_CHAT = 'true';
    process.env.K_SERVICE = 'zeno-staging-cluster';

    const sharedRedis = new ClusterRedisBackend();
    setPrimaryRateLimitStore(new RedisSlidingWindowStore(sharedRedis, 'zeno:cluster:'));
    setRateLimitPolicies({
      ai_generation: {
        windowMs: 60_000,
        unauthenticatedMax: 3,
        authenticatedMax: 15,
      },
    });

    // Spin up 3 separate live HTTP server instances representing 3 Cloud Run container instances
    const createInstanceServer = (instanceId: string) => {
      const instanceApp = express();
      instanceApp.set('trust proxy', 1);
      instanceApp.use(express.json());
      instanceApp.use('/api', firebaseAuthMiddleware, rateLimitMiddleware);
      instanceApp.post('/api/chat', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('X-Cloud-Run-Instance', instanceId);
        res.flushHeaders();
        res.write(`data: ${JSON.stringify({ type: 'token', text: `ack:${instanceId}`, uid: req.firebaseUid })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });
      return http.createServer(instanceApp);
    };

    const servers = [
      createInstanceServer('instance-1'),
      createInstanceServer('instance-2'),
      createInstanceServer('instance-3'),
    ];
    const ports: number[] = [];

    for (const srv of servers) {
      await new Promise<void>((resolve) => {
        srv.listen(0, '127.0.0.1', () => {
          ports.push((srv.address() as { port: number }).port);
          resolve();
        });
      });
    }

    try {
      const validToken = signJwt(
        { alg: 'RS256', typ: 'JWT', kid: KID },
        buildValidClaims({ sub: 'cluster_load_user', user_id: 'cluster_load_user' }),
        trustedPrivateKeyPem
      );

      const dispatchToInstance = (idx: number, token?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; latencyMs: number }> => {
        const port = ports[idx % ports.length];
        const t0 = performance.now();
        return new Promise((resolve, reject) => {
          const req = http.request(
            {
              hostname: '127.0.0.1',
              port,
              path: '/api/chat',
              method: 'POST',
              agent: false,
              headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': '203.0.113.88',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            },
            (res) => {
              res.on('data', () => {});
              res.on('end', () => {
                resolve({
                  status: res.statusCode || 0,
                  headers: res.headers,
                  latencyMs: performance.now() - t0,
                });
              });
            }
          );
          req.on('error', reject);
          req.write(JSON.stringify({ messages: [{ role: 'user', content: 'cluster test' }] }));
          req.end();
        });
      };

      // Send 20 requests round-robin across the 3 HTTP server instances for the same authenticated user (global limit = 15)
      const responses = [];
      for (let i = 0; i < 20; i++) {
        responses.push(await dispatchToInstance(i, validToken));
      }

      const allowed = responses.filter((r) => r.status === 200);
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(allowed.length).toBe(15);
      expect(rateLimited.length).toBe(5);

      // Verify all 3 instances served traffic and enforced the shared Redis counter
      const servedByInstances = new Set(allowed.map((r) => r.headers['x-cloud-run-instance']));
      expect(servedByInstances.size).toBe(3);

      // Compute latency percentiles across multi-instance round-robin calls
      const sortedLatencies = responses.map((r) => r.latencyMs).sort((a, b) => a - b);
      const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
      const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];
      expect(p95).toBeLessThan(500);
      expect(p99).toBeLessThan(1000);

      // Simulate Redis cluster outage during active multi-instance traffic in 'closed' fail-safe mode
      sharedRedis.simulateOutage = true;
      setRateLimitFailMode('closed');
      const outageClosedRes = await dispatchToInstance(0, validToken);
      expect(outageClosedRes.status).toBe(503);

      // Simulate Redis recovery -> traffic immediately resumes without restart
      sharedRedis.simulateOutage = false;
      const freshUserToken = signJwt(
        { alg: 'RS256', typ: 'JWT', kid: KID },
        buildValidClaims({ sub: 'recovered_user', user_id: 'recovered_user' }),
        trustedPrivateKeyPem
      );
      const recoveredRes = await dispatchToInstance(1, freshUserToken);
      expect(recoveredRes.status).toBe(200);
    } finally {
      for (const srv of servers) {
        await new Promise<void>((resolve) => srv.close(() => resolve()));
      }
    }
  });

  it('Gate 4: scans repository source files for hardcoded secrets and rehearses staging canary deployment with automated rollback', async () => {
    // 1. Secret scanning across tracked backend/frontend source files
    const filesToScan = [
      'server.ts',
      'server/auth.ts',
      'server/config.ts',
      'server/rateLimiter.ts',
      'src/App.tsx',
      'src/lib/firebase.ts',
      'src/lib/userAccountStore.ts',
      '.env.example',
    ];
    const forbiddenSecretPatterns = [
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
      /AIzaSy[0-9A-Za-z\-_]{33}/,
      /rediss?:\/\/[^/\s]+:[^@\s]+@/,
      /treg_live_[0-9A-Za-z_]+/,
    ];

    for (const relPath of filesToScan) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of forbiddenSecretPatterns) {
        expect(pattern.test(content), `Forbidden secret pattern ${pattern} found in ${relPath}`).toBe(
          false
        );
      }
    }

    // 2. Staging Deployment Rehearsal with Automated Rollback Simulation
    interface RevisionDeploymentState {
      stableRevision: string;
      candidateRevision: string;
      trafficSplit: Record<string, number>;
      rolledBack: boolean;
      rollbackReason?: string;
    }

    async function runStagingCanaryGate(): Promise<{ passed: boolean; reason?: string }> {
      // Check 1: Health endpoint reachable & strict auth enabled
      const health = await request(app).get('/api/health');
      if (health.status !== 200 || !health.body?.staging?.strictAuthRequired) {
        return { passed: false, reason: `Health or strictAuth check failed (status=${health.status})` };
      }
      // Check 2: Unauthenticated /api/chat rejected with 401
      const unauthChat = await request(app)
        .post('/api/chat')
        .send({ messages: [{ role: 'user', content: 'canary probe' }] });
      if (unauthChat.status !== 401) {
        return { passed: false, reason: `Strict auth gate failed: expected 401, got ${unauthChat.status}` };
      }
      // Check 3: Authenticated /api/user/quota succeeds with 200
      const canaryToken = signJwt(
        { alg: 'RS256', typ: 'JWT', kid: KID },
        buildValidClaims({ sub: 'canary_probe_uid', user_id: 'canary_probe_uid' }),
        trustedPrivateKeyPem
      );
      const authedProbe = await request(app)
        .get('/api/user/quota')
        .set('Authorization', `Bearer ${canaryToken}`);
      if (authedProbe.status !== 200 || authedProbe.body?.uid !== 'canary_probe_uid') {
        return { passed: false, reason: `Authenticated quota probe failed (status=${authedProbe.status})` };
      }
      return { passed: true };
    }

    async function rehearseCanaryRollout(
      stableRev: string,
      candidateRev: string
    ): Promise<RevisionDeploymentState> {
      const state: RevisionDeploymentState = {
        stableRevision: stableRev,
        candidateRevision: candidateRev,
        trafficSplit: { [stableRev]: 90, [candidateRev]: 10 },
        rolledBack: false,
      };

      const gate = await runStagingCanaryGate();
      if (!gate.passed) {
        // Automatic rollback: restore 100% traffic to stableRevision
        state.trafficSplit = { [stableRev]: 100, [candidateRev]: 0 };
        state.rolledBack = true;
        state.rollbackReason = gate.reason;
        return state;
      }

      // Canary passed: promote candidateRevision to 100%
      state.trafficSplit = { [stableRev]: 0, [candidateRev]: 100 };
      return state;
    }

    // Rehearsal A: Healthy candidate revision with REQUIRE_AUTH_FOR_CHAT=true promotes to 100%
    process.env.REQUIRE_AUTH_FOR_CHAT = 'true';
    const healthyRollout = await rehearseCanaryRollout('zeno-00041-stable', 'zeno-00042-candidate');
    expect(healthyRollout.rolledBack).toBe(false);
    expect(healthyRollout.trafficSplit['zeno-00042-candidate']).toBe(100);

    // Rehearsal B: Faulty candidate revision (misconfigured strict auth or Redis outage in closed mode) rolls back to 100% stable
    process.env.REQUIRE_AUTH_FOR_CHAT = 'false';
    const rollbackRollout = await rehearseCanaryRollout('zeno-00042-candidate', 'zeno-00043-bad');
    expect(rollbackRollout.rolledBack).toBe(true);
    expect(rollbackRollout.trafficSplit['zeno-00042-candidate']).toBe(100);
    expect(rollbackRollout.trafficSplit['zeno-00043-bad']).toBe(0);
    expect(rollbackRollout.rollbackReason).toContain('Health or strictAuth check failed');
  });
});
