import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../server';
import {
  getAllowedOrigins,
  getDataDir,
  getFirestoreDatabaseId,
  getInfrastructureReadinessSummary,
  isCorsOriginAllowed,
  isStrictAuthRequired,
} from '../server/config';
import {
  ensureBillingUserHydrated,
  getEffectiveServerUserPlan,
  getOrCreateBillingUser,
  hydrateBillingWebhookContextFromFirestore,
  processVerifiedDodoWebhookEvent,
  resetBillingDbForTests,
  syncBillingStateToFirestoreAfterMutation,
} from '../server/billingEngine';
import {
  InMemoryServerFirestoreAdapter,
  setFirestoreAdapterForTests,
} from '../server/firestorePersistence';
import {
  FirestoreSlidingWindowStore,
  resetAllRateLimiters,
  setPrimaryRateLimitStore,
  setRateLimitFailMode,
} from '../server/rateLimiter';
import { ReferralDatabase } from '../server/referralEngine';

describe('Infrastructure, Shared Firestore Persistence, Env Defaults & Strict CORS', () => {
  const savedEnv = { ...process.env };
  let sharedFirestore: InMemoryServerFirestoreAdapter;
  let tempDir: string;

  beforeEach(async () => {
    process.env = { ...savedEnv };
    sharedFirestore = new InMemoryServerFirestoreAdapter();
    setFirestoreAdapterForTests(sharedFirestore);
    resetBillingDbForTests();
    setRateLimitFailMode('fallback');
    await resetAllRateLimiters();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kinich-infra-test-'));
  });

  afterEach(async () => {
    setFirestoreAdapterForTests(null);
    resetBillingDbForTests();
    setRateLimitFailMode('fallback');
    await resetAllRateLimiters();
    process.env = { ...savedEnv };
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Strict CORS Allowlist & Header Security', () => {
    it('allows exact Kinich, Zeno Vercel, Capacitor/Ionic, and custom ALLOWED_ORIGINS', () => {
      process.env.ALLOWED_ORIGINS = 'https://studio.example.org, https://mobile.kinich.app/';
      const allowlist = getAllowedOrigins();
      expect(allowlist.has('https://studio.example.org')).toBe(true);
      expect(allowlist.has('https://mobile.kinich.app')).toBe(true);

      expect(isCorsOriginAllowed('https://kinich.app')).toBe(true);
      expect(isCorsOriginAllowed('https://www.kinich.app')).toBe(true);
      expect(isCorsOriginAllowed('https://zeno0x.vercel.app')).toBe(true);
      expect(isCorsOriginAllowed('https://zeno0x-git-feature.vercel.app')).toBe(true);
      expect(isCorsOriginAllowed('capacitor://localhost')).toBe(true);
      expect(isCorsOriginAllowed('ionic://localhost')).toBe(true);
      expect(isCorsOriginAllowed('https://localhost')).toBe(true);
      expect(isCorsOriginAllowed('https://studio.example.org')).toBe(true);
    });

    it('rejects arbitrary vercel.app, run.app, lookalike localhost, unknown domains, and null origins', () => {
      expect(isCorsOriginAllowed('https://evil.com')).toBe(false);
      expect(isCorsOriginAllowed('https://attacker-clone.vercel.app')).toBe(false);
      expect(isCorsOriginAllowed('https://rogue-service-123.run.app')).toBe(false);
      expect(isCorsOriginAllowed('https://localhost.attacker.com')).toBe(false);
      expect(isCorsOriginAllowed('null')).toBe(false);
      expect(isCorsOriginAllowed(undefined)).toBe(false);
    });

    it('enforces strict CORS at HTTP layer and rejects disallowed preflights and API requests with 403', async () => {
      const allowedPreflight = await request(app)
        .options('/api/health')
        .set('Origin', 'https://kinich.app');
      expect(allowedPreflight.status).toBe(204);
      expect(allowedPreflight.headers['access-control-allow-origin']).toBe('https://kinich.app');
      expect(allowedPreflight.headers['access-control-allow-credentials']).toBe('true');
      expect(allowedPreflight.headers['vary']).toContain('Origin');

      const disallowedPreflight = await request(app)
        .options('/api/health')
        .set('Origin', 'https://evil-attacker.vercel.app');
      expect(disallowedPreflight.status).toBe(403);
      expect(disallowedPreflight.headers['access-control-allow-origin']).toBeUndefined();
      expect(disallowedPreflight.headers['access-control-allow-credentials']).toBeUndefined();

      const disallowedGet = await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil.com');
      expect(disallowedGet.status).toBe(403);
      expect(disallowedGet.body?.code).toBe('cors/origin-not-allowed');
      expect(disallowedGet.headers['access-control-allow-origin']).toBeUndefined();

      const mediaValidation = await request(app)
        .get('/api/media/stream')
        .set('Origin', 'https://kinich.app');
      expect(mediaValidation.status).toBe(400);
      expect(mediaValidation.headers['access-control-allow-origin']).toBe('https://kinich.app');
      expect(mediaValidation.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  describe('2. Production Env Defaults, Data Volume Config & .env.example', () => {
    it('defaults strict auth to true in non-test production mode while honoring explicit overrides', () => {
      delete process.env.REQUIRE_AUTH_FOR_CHAT;
      process.env.NODE_ENV = 'production';
      delete process.env.VITEST;
      expect(isStrictAuthRequired()).toBe(true);

      process.env.REQUIRE_AUTH_FOR_CHAT = 'false';
      expect(isStrictAuthRequired()).toBe(false);

      process.env.REQUIRE_AUTH_FOR_CHAT = 'true';
      expect(isStrictAuthRequired()).toBe(true);
    });

    it('resolves configured DATA_DIR, named Firestore database ID, and readiness summary without secrets', () => {
      process.env.DATA_DIR = tempDir;
      expect(getDataDir()).toBe(path.resolve(tempDir));
      expect(getFirestoreDatabaseId()).toBe('ai-studio-zeno-07b7e642-7c47-4acb-833f-ea0fb4f2013b');

      const readiness = getInfrastructureReadinessSummary();
      expect(readiness.dataDir).toBe(path.resolve(tempDir));
      expect(readiness.firestoreDatabaseId).toBe(
        'ai-studio-zeno-07b7e642-7c47-4acb-833f-ea0fb4f2013b'
      );
      expect(typeof readiness.corsAllowlistCount).toBe('number');
    });

    it('verifies .env.example defines hardened production defaults', () => {
      const envExample = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8');
      expect(envExample).toContain('REQUIRE_AUTH_FOR_CHAT="true"');
      expect(envExample).toContain('DODO_PAYMENTS_ENVIRONMENT="live_mode"');
      expect(envExample).toContain('DATA_DIR="/app/data"');
      expect(envExample).toContain(
        'FIRESTORE_DATABASE_ID="ai-studio-zeno-07b7e642-7c47-4acb-833f-ea0fb4f2013b"'
      );
      expect(envExample).toContain('ALLOWED_ORIGINS=');
      expect(envExample).toContain('SENTRY_DSN=');
      expect(envExample).toContain('REDIS_URL=');
    });
  });

  describe('3. Cross-Instance Shared Firestore Persistence (Billing, Referrals & Rate Limits)', () => {
    it('hydrates billing entitlements and deduplicates webhooks across SQLite resets (new container instances)', async () => {
      const uid = 'uid_cross_instance_billing';
      getOrCreateBillingUser(uid, { email: 'scale@kinich.app', country: 'US' });

      const webhookPayload = {
        type: 'subscription.active',
        timestamp: '2026-11-16T08:00:00.000Z',
        data: {
          payload_type: 'Subscription',
          subscription_id: 'sub_shared_fire_1',
          product_id: 'pdt_kinich_fire_monthly',
          status: 'active',
          recurring_pre_tax_amount: 700,
          currency: 'USD',
          customer: {
            customer_id: 'cust_shared_1',
            email: 'scale@kinich.app',
          },
          metadata: {
            firebase_uid: uid,
            plan: 'fire',
            interval: 'monthly',
          },
          next_billing_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        },
      };

      const firstResult = processVerifiedDodoWebhookEvent('wh_cross_instance_1', webhookPayload);
      expect(firstResult.duplicate).toBe(false);
      expect(firstResult.outOfOrder).toBe(false);
      expect(firstResult.processedType).toBe('subscription.active');
      await syncBillingStateToFirestoreAfterMutation({
        webhookId: 'wh_cross_instance_1',
        uid: firstResult.uid,
        subscriptionId: webhookPayload.data.subscription_id,
      });

      // Wipe local SQLite state to simulate a fresh stateless container cold start
      resetBillingDbForTests();
      expect(getEffectiveServerUserPlan(uid).plan).toBe('free');

      // Instance #2 hydrates user entitlement & webhook ledger from shared Firestore
      await ensureBillingUserHydrated(uid);
      const hydratedPlan = getEffectiveServerUserPlan(uid);
      expect(hydratedPlan.plan).toBe('fire');
      expect(hydratedPlan.status).toBe('active');
      expect(hydratedPlan.hasBillingRecord).toBe(true);

      await hydrateBillingWebhookContextFromFirestore('wh_cross_instance_1', webhookPayload.data);
      const duplicateOnInstance2 = processVerifiedDodoWebhookEvent(
        'wh_cross_instance_1',
        webhookPayload
      );
      expect(duplicateOnInstance2.duplicate).toBe(true);
    });

    it('synchronizes referral codes, atomic claims, and single qualification across two separate ReferralDatabase instances', async () => {
      const dbPath1 = path.join(tempDir, 'instance1_referrals.db');
      const dbPath2 = path.join(tempDir, 'instance2_referrals.db');
      const instance1 = new ReferralDatabase(dbPath1);
      const instance2 = new ReferralDatabase(dbPath2);

      try {
        const referrerCode = await instance1.getOrCreateReferralCodeAsync('uid_referrer_alpha');
        expect(referrerCode).toBeTruthy();

        // Instance #2 does not have referrer in local SQLite, resolves from Firestore
        const resolved = await instance2.findByCodeAsync(referrerCode);
        expect(resolved?.user_id).toBe('uid_referrer_alpha');

        const claimResult = await instance2.claimReferralAsync({
          claimantUserId: 'uid_referee_beta',
          code: referrerCode,
          ip: '203.0.113.10',
        });
        expect(claimResult.success).toBe(true);
        expect(claimResult.claimed).toBe(true);

        // Idempotent duplicate claim of same referrer code on Instance #1
        const idempotentClaim = await instance1.claimReferralAsync({
          claimantUserId: 'uid_referee_beta',
          code: referrerCode,
          ip: '203.0.113.11',
        });
        expect(idempotentClaim.alreadyClaimed).toBe(true);

        // Claiming a different referrer's code on Instance #1 must be rejected cleanly (409 conflict)
        const otherReferrerCode = await instance1.getOrCreateReferralCodeAsync('uid_referrer_gamma');
        const conflictingClaim = await instance1.claimReferralAsync({
          claimantUserId: 'uid_referee_beta',
          code: otherReferrerCode,
          ip: '203.0.113.12',
        });
        expect(conflictingClaim.claimed).toBe(false);
        expect(conflictingClaim.errorCode).toBe('already_referred_by_another');

        // Qualify on Instance #1, verify re-qualify on Instance #2 is idempotent (no double reward)
        const qualify1 = await instance1.qualifyReferralAsync('uid_referee_beta');
        expect(qualify1.qualified).toBe(true);
        const qualify2 = await instance2.qualifyReferralAsync('uid_referee_beta');
        expect(qualify2.qualified).toBe(false);

        const referrerDashboard = await instance2.getDashboardAsync('uid_referrer_alpha');
        expect(referrerDashboard.stats.invited).toBe(1);
        expect(referrerDashboard.stats.rewarded).toBe(1);
        expect(referrerDashboard.rewards.length).toBe(1);
        expect(referrerDashboard.rewards[0].days).toBe(7);
      } finally {
        instance1.close();
        instance2.close();
      }
    });

    it('enforces shared sliding-window rate limits across two FirestoreSlidingWindowStore instances and honors failMode', async () => {
      const storeA = new FirestoreSlidingWindowStore();
      const storeB = new FirestoreSlidingWindowStore();
      const bucketKey = 'tier:ai_generation:uid:uid_rl_shared';
      const now = Date.now();

      const r1 = await storeA.incrementAndCheck(bucketKey, 60_000, 2, now);
      const r2 = await storeB.incrementAndCheck(bucketKey, 60_000, 2, now + 10);
      const r3 = await storeA.incrementAndCheck(bucketKey, 60_000, 2, now + 20);

      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(1);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(0);
      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);

      // Verify middleware fail-safe behavior under Firestore outage
      setPrimaryRateLimitStore(storeA);
      sharedFirestore.simulateOutage = true;

      setRateLimitFailMode('fallback');
      const fallbackRes = await request(app).get('/api/health');
      expect(fallbackRes.status).toBe(200);
      expect(fallbackRes.headers['x-ratelimit-degraded']).toBe('true');

      setRateLimitFailMode('closed');
      const closedRes = await request(app).get('/api/health');
      expect(closedRes.status).toBe(503);
      expect(closedRes.body?.code).toBe('rate_limit/store_unavailable');
    });
  });

  describe('4. Spark ($3/mo) Vision Model & Firebase Web Config', () => {
    it('permanently excludes uncensored models from the UI catalog and classifies Spark vision models accurately', async () => {
      const { classifyServerModelTier, canPlanUseModelTier } = await import('../server/rateLimiter');
      expect(classifyServerModelTier('fgw/qwen-3.8-max:free')).toBe('fire');
      expect(canPlanUseModelTier('free', 'spark')).toBe(false);
      expect(canPlanUseModelTier('spark', 'spark')).toBe(true);
      expect(canPlanUseModelTier('fire', 'spark')).toBe(true);

      const pickerSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/GrokModelPicker.tsx'),
        'utf8'
      );
      expect(pickerSource).not.toMatch(/uncensored|limitless/i);
      expect(pickerSource).toMatch(/id:\s*'fgw-qwen-3\.8-vl-72b-vision'[\s\S]*?requiredTier:\s*'spark'/);
    });

    it('keeps firebase-applet-config.json aligned with the sustained-chiller-36tp2 web app and named Firestore DB', () => {
      const cfg = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8')
      );
      expect(cfg.projectId).toBe('sustained-chiller-36tp2');
      expect(cfg.appId).toBe('1:129041528700:web:8b89a45cd55dbf4df4d6f9');
      expect(cfg.authDomain).toBe('sustained-chiller-36tp2.firebaseapp.com');
      expect(cfg.storageBucket).toBe('sustained-chiller-36tp2.firebasestorage.app');
      expect(cfg.messagingSenderId).toBe('129041528700');
      expect(cfg.firestoreDatabaseId).toBe('ai-studio-zeno-07b7e642-7c47-4acb-833f-ea0fb4f2013b');
    });
  });
});
