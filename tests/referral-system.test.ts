import fs from 'fs';
import path from 'path';
import express from 'express';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { ReferralDatabase, getReferralDb } from '../server/referralEngine';
import { registerGrowthEngineRoutes } from '../server/growthEngine';

const TEST_DB_DIR = path.resolve(process.cwd(), 'data/test_referrals');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test_zeno_referrals.db');

function cleanupTestDb() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    }
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
      fs.unlinkSync(`${TEST_DB_PATH}-shm`);
    }
  } catch {}
}

function createTestApp(db: ReferralDatabase) {
  const app = express();
  app.use(express.json());
  registerGrowthEngineRoutes(app);
  return app;
}

async function invokeRoute(
  app: express.Express,
  options: {
    method: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const res = await fetch(`http://127.0.0.1:${port}${options.url}`, {
          method: options.method,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        server.close(() => resolve({ status: res.status, body: data }));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

describe('Zeno Referral System — End-to-End Persistence & Rules Test Suite', () => {
  let testDb: ReferralDatabase;

  beforeEach(() => {
    cleanupTestDb();
    testDb = new ReferralDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    testDb.close();
    cleanupTestDb();
  });

  describe('1. Code Generation & Validation', () => {
    it('generates a unique and deterministic code for user', () => {
      const code1 = testDb.getOrCreateReferralCode('user_alice_123');
      const code2 = testDb.getOrCreateReferralCode('user_alice_123');
      expect(code1).toBeDefined();
      expect(code1.length).toBeGreaterThanOrEqual(6);
      expect(code1).toBe(code2);
    });

    it('generates different codes for different users', () => {
      const codeA = testDb.getOrCreateReferralCode('user_alice_123');
      const codeB = testDb.getOrCreateReferralCode('user_bob_456');
      expect(codeA).not.toBe(codeB);
    });

    it('validates an existing code properly', () => {
      const code = testDb.getOrCreateReferralCode('user_carol_789');
      const validation = testDb.validateCode(code);
      expect(validation.valid).toBe(true);
      expect(validation.referrerUid).toBe('user_carol_789');

      const invalidValidation = testDb.validateCode('non_existent_code_999');
      expect(invalidValidation.valid).toBe(false);
    });
  });

  describe('2. Referral Claiming & Qualification Rules', () => {
    it('claims a valid referral successfully', () => {
      const aliceCode = testDb.getOrCreateReferralCode('user_alice_1');
      const res = testDb.claimReferral({
        code: aliceCode,
        claimantUid: 'user_bob_2',
        claimantEmail: 'bob@example.com',
        accountCreatedAt: Date.now() - 1000 * 60, // 1 min ago
        ipAddress: '127.0.0.1',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('claimed');
      expect(res.referrerUid).toBe('user_alice_1');

      // Verify dashboard for Alice
      const aliceDash = testDb.getDashboard('user_alice_1');
      expect(aliceDash.stats.invited).toBe(1);
      expect(aliceDash.stats.qualified).toBe(0);
      expect(aliceDash.referrals.length).toBe(1);
      expect(aliceDash.referrals[0].status).toBe('pending');
    });

    it('rejects self-referrals (same UID or own code)', () => {
      const aliceCode = testDb.getOrCreateReferralCode('user_alice_self');
      const res = testDb.claimReferral({
        code: aliceCode,
        claimantUid: 'user_alice_self',
        claimantEmail: 'alice@example.com',
        ip: '127.0.0.1',
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('self_referral_not_allowed');
    });

    it('handles idempotent duplicate claims with same code cleanly', () => {
      const aliceCode = testDb.getOrCreateReferralCode('user_alice_idem');
      const claim1 = testDb.claimReferral({
        code: aliceCode,
        claimantUid: 'user_bob_idem',
        claimantEmail: 'bob@example.com',
      });
      expect(claim1.success).toBe(true);

      const claim2 = testDb.claimReferral({
        code: aliceCode,
        claimantUid: 'user_bob_idem',
        claimantEmail: 'bob@example.com',
      });
      expect(claim2.success).toBe(true);
      expect(claim2.status).toBe('already_claimed');

      // Dashboard shows exactly 1 referral
      const dash = testDb.getDashboard('user_alice_idem');
      expect(dash.stats.invited).toBe(1);
    });

    it('rejects second referrer with 409 conflict (1 referrer per user ever)', () => {
      const aliceCode = testDb.getOrCreateReferralCode('user_alice_first');
      const charlieCode = testDb.getOrCreateReferralCode('user_charlie_second');

      // Bob claims Alice
      const claim1 = testDb.claimReferral({
        code: aliceCode,
        claimantUid: 'user_bob_locked',
      });
      expect(claim1.success).toBe(true);

      // Bob tries to claim Charlie
      const claim2 = testDb.claimReferral({
        code: charlieCode,
        claimantUid: 'user_bob_locked',
      });
      expect(claim2.success).toBe(false);
      expect(claim2.errorCode).toBe('already_referred_by_another');
    });

    it('rejects claim if account was created more than 7 days ago', () => {
      const aliceCode = testDb.getOrCreateReferralCode('user_alice_window');
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;

      const res = testDb.claimReferral({
        code: aliceCode,
        claimantUid: 'user_bob_old',
        accountCreatedAt: eightDaysAgo,
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('claim_window_expired');
    });

    it('qualifies referral and awards credits upon performing action', () => {
      const aliceCode = testDb.getOrCreateReferralCode('user_alice_qual');
      testDb.claimReferral({
        code: aliceCode,
        claimantUid: 'user_bob_qual',
      });

      // Bob performs first search or chat
      const qualRes = testDb.qualifyReferral('user_bob_qual');
      expect(qualRes.qualified).toBe(true);
      expect(qualRes.referrerUid).toBe('user_alice_qual');
      expect(qualRes.rewardCredited).toBe(true);

      // Verify dashboard stats and rewards ledger
      const aliceDash = testDb.getDashboard('user_alice_qual');
      expect(aliceDash.stats.invited).toBe(1);
      expect(aliceDash.stats.qualified).toBe(1);
      expect(aliceDash.stats.rewarded).toBe(1);
      expect(aliceDash.rewards.length).toBe(1);
      expect(aliceDash.rewards[0].amount).toBe(10);
      expect(aliceDash.rewards[0].days).toBe(7);

      // Second qualifying action is idempotent
      const qualRes2 = testDb.qualifyReferral('user_bob_qual');
      expect(qualRes2.qualified).toBe(false);
      expect(qualRes2.rewardCredited).toBe(false);

      // Rewards count unchanged
      const aliceDash2 = testDb.getDashboard('user_alice_qual');
      expect(aliceDash2.rewards.length).toBe(1);
    });
  });

  describe('3. Persistence Across Database Restarts', () => {
    it('persists referral codes, referrals, and rewards after database re-instantiation', () => {
      const code = testDb.getOrCreateReferralCode('persisted_user_1');
      testDb.claimReferral({
        code,
        claimantUid: 'persisted_user_2',
      });
      testDb.qualifyReferral('persisted_user_2');

      // Close database connection
      testDb.close();

      // Reopen new database connection to same file
      const reopenedDb = new ReferralDatabase(TEST_DB_PATH);
      try {
        const dash = reopenedDb.getDashboard('persisted_user_1');
        expect(dash.code).toBe(code);
        expect(dash.stats.invited).toBe(1);
        expect(dash.stats.qualified).toBe(1);
        expect(dash.stats.rewarded).toBe(1);
        expect(dash.rewards.length).toBe(1);
        expect(dash.rewards[0].amount).toBe(10);
      } finally {
        reopenedDb.close();
      }
    });
  });

  describe('4. Endpoints Verification', () => {
    it('GET /api/referral/validate/:code returns validity', async () => {
      const globalDb = getReferralDb();
      const code = globalDb.getOrCreateReferralCode('user_endpoint_test');

      const app = createTestApp(globalDb);
      const res = await invokeRoute(app, {
        method: 'GET',
        url: `/api/referral/validate/${code}`,
      });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.code).toBe(code);
    });

    it('POST /api/referral/claim claims code and rejects self-referral', async () => {
      const globalDb = getReferralDb();
      const code = globalDb.getOrCreateReferralCode('user_self_ref_endpoint');

      const app = createTestApp(globalDb);
      const res = await invokeRoute(app, {
        method: 'POST',
        url: '/api/referral/claim',
        body: {
          code,
          claimantUid: 'user_self_ref_endpoint',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('own referral code');
    });

    it('GET /api/referral/me returns code and link', async () => {
      const globalDb = getReferralDb();
      const app = createTestApp(globalDb);

      const res = await invokeRoute(app, {
        method: 'GET',
        url: '/api/referral/me',
        headers: {
          'X-Zeno-Client-Id': 'client_user_endpoint_me',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBeDefined();
      expect(res.body.link).toMatch(/\/(r\/\w+|\?ref=\w+)/);
      expect(res.body.stats).toBeDefined();
    });
  });
});
