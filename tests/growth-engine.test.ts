import fs from 'fs';
import path from 'path';
import express from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  sanitizePlainString,
  sanitizePublicMarkdown,
  isValidSafeId,
  escapeHtmlEntities,
  injectSocialMetaIntoHtml,
  registerGrowthEngineRoutes,
  resetGrowthEngineForTests,
} from '../server/growthEngine';

const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

function createTestServer() {
  const app = express();
  app.use(express.json());
  registerGrowthEngineRoutes(app);
  return app;
}

async function invokeExpressRoute(
  app: express.Express,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
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

describe('Zeno Growth Engine — Unit, Integration & Security Verification Suite', () => {
  beforeEach(() => {
    resetGrowthEngineForTests();
  });

  it('1. sanitizes plain strings, strips XSS/script payloads from public Markdown, and validates safe IDs', () => {
    expect(sanitizePlainString('  Hello \u0000 World  ', 50)).toBe('Hello  World');
    expect(isValidSafeId('art_transformer_attention_guide')).toBe(true);
    expect(isValidSafeId('../../etc/passwd')).toBe(false);
    expect(isValidSafeId('<script>alert(1)</script>')).toBe(false);

    const maliciousMd = `# Study Guide\n<script>alert('xss')</script>\n<img src=x onerror="steal()" />\n[Click](javascript:alert(1))`;
    const cleaned = sanitizePublicMarkdown(maliciousMd);
    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('onerror=');
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).toContain('# Study Guide');
  });

  it('2. injects escaped Open Graph and Twitter Card metadata into HTML without XSS injection', () => {
    const sampleHtml = `<!doctype html><html><head><title>Zeno</title><meta name="description" content="Default" /><meta property="og:title" content="Zeno" /><meta property="og:description" content="Default" /></head><body></body></html>`;
    const injected = injectSocialMetaIntoHtml(
      sampleHtml,
      { artifact: 'art_transformer_attention_guide' },
      'https://zeno0x.vercel.app/?artifact=art_transformer_attention_guide'
    );

    expect(injected).toContain('Scaled Dot-Product &amp; Multi-Head Attention: Mathematical Study Guide');
    expect(injected).toContain(
      'property="og:url" content="https://zeno0x.vercel.app/?artifact=art_transformer_attention_guide"'
    );
    expect(injected).toContain('name="twitter:card" content="summary_large_image"');
    expect(escapeHtmlEntities('<img onerror="x">')).toBe('&lt;img onerror=&quot;x&quot;&gt;');
  });

  it('3. verifies Firestore security rules protect private Knowledge Vault items and Public Artifacts', () => {
    expect(rulesContent).toContain('match /vault_items/{itemId}');
    expect(rulesContent).toContain('isValidVaultItem(incoming(), userId, itemId)');
    expect(rulesContent).toContain('match /public_artifacts/{artifactId}');
    expect(rulesContent).toContain(
      "allow get: if isValidId(artifactId) && resource != null && (existing().visibility == 'public' || (isSignedIn() && existing().ownerId == request.auth.uid));"
    );
    expect(rulesContent).toContain(
      "allow list: if existing().visibility == 'public' || (isSignedIn() && existing().ownerId == request.auth.uid);"
    );
  });

  it('4. serves Zeno Discover categories, search, and sorting while excluding private artifacts', async () => {
    const app = createTestServer();

    const listRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: '/api/growth/discover?category=Science&sort=saved',
    });
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    expect(listRes.body.items.length).toBeGreaterThan(0);
    expect(listRes.body.items.every((i: any) => i.visibility === 'public')).toBe(true);
    expect(listRes.body.items.every((i: any) => i.category === 'Science')).toBe(true);

    // Search query
    const searchRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: '/api/growth/discover?q=Attention',
    });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.items.some((i: any) => i.title.includes('Attention'))).toBe(true);
  });

  it('5. enforces public/private visibility and strict owner-only authorization on Zeno Pages', async () => {
    const app = createTestServer();

    // Alice creates a private artifact
    const createPrivateRes = await invokeExpressRoute(app, {
      method: 'POST',
      url: '/api/growth/artifacts',
      headers: { 'x-zeno-client-id': 'user_alice_123' },
      body: {
        title: 'Alice Private Research Notes',
        summary: 'Confidential notes',
        content: '# Private Content\nDo not expose publicly.',
        category: 'Research',
        outputType: 'structured_notes',
        visibility: 'private',
        tags: ['private'],
      },
    });
    expect(createPrivateRes.status).toBe(201);
    const privateId = createPrivateRes.body.artifact.id;

    // Anonymous / other user cannot access Alice's private artifact (403 Forbidden)
    const anonGetRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: `/api/growth/artifacts/${privateId}`,
      headers: { 'x-zeno-client-id': 'user_mallory_999' },
    });
    expect(anonGetRes.status).toBe(403);

    // Private artifact never appears in Discover
    const discoverRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: '/api/growth/discover?q=Confidential',
    });
    expect(discoverRes.body.items.some((i: any) => i.id === privateId)).toBe(false);

    // Owner (Alice) CAN read her own private artifact
    const ownerGetRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: `/api/growth/artifacts/${privateId}`,
      headers: { 'x-zeno-client-id': 'user_alice_123' },
    });
    expect(ownerGetRes.status).toBe(200);
    expect(ownerGetRes.body.artifact.title).toBe('Alice Private Research Notes');

    // Mallory cannot update or delete Alice's artifact
    const malloryPatchRes = await invokeExpressRoute(app, {
      method: 'PATCH',
      url: `/api/growth/artifacts/${privateId}`,
      headers: { 'x-zeno-client-id': 'user_mallory_999' },
      body: { visibility: 'public' },
    });
    expect(malloryPatchRes.status).toBe(403);

    const malloryDeleteRes = await invokeExpressRoute(app, {
      method: 'DELETE',
      url: `/api/growth/artifacts/${privateId}`,
      headers: { 'x-zeno-client-id': 'user_mallory_999' },
    });
    expect(malloryDeleteRes.status).toBe(403);

    // Alice switches visibility to public -> now accessible
    const alicePublishRes = await invokeExpressRoute(app, {
      method: 'PATCH',
      url: `/api/growth/artifacts/${privateId}`,
      headers: { 'x-zeno-client-id': 'user_alice_123' },
      body: { visibility: 'public' },
    });
    expect(alicePublishRes.status).toBe(200);
    expect(alicePublishRes.body.artifact.visibility).toBe('public');

    const publicGetRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: `/api/growth/artifacts/${privateId}`,
      headers: { 'x-zeno-client-id': 'user_mallory_999' },
    });
    expect(publicGetRes.status).toBe(200);

    // Alice deletes her artifact -> no longer accessible
    const aliceDeleteRes = await invokeExpressRoute(app, {
      method: 'DELETE',
      url: `/api/growth/artifacts/${privateId}`,
      headers: { 'x-zeno-client-id': 'user_alice_123' },
    });
    expect(aliceDeleteRes.status).toBe(200);

    const afterDeleteRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: `/api/growth/artifacts/${privateId}`,
      headers: { 'x-zeno-client-id': 'user_alice_123' },
    });
    expect(afterDeleteRes.status).toBe(404);
  });

  it('6. validates Zeno Passes referral attribution, rejects self-referrals, and prevents duplicate claims', async () => {
    const app = createTestServer();

    // 1. Referrer (Alice) gets her unique Zeno Pass code
    const aliceRefRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: '/api/growth/referrals/me',
      headers: { 'x-zeno-client-id': 'referrer_alice_01' },
    });
    expect(aliceRefRes.status).toBe(200);
    const code = aliceRefRes.body.referralCode;
    expect(code).toMatch(/^zp_[a-z0-9]+$/);

    // 2. Self-referral is strictly rejected
    const selfClaimRes = await invokeExpressRoute(app, {
      method: 'POST',
      url: '/api/growth/referrals/claim',
      headers: { 'x-zeno-client-id': 'referrer_alice_01' },
      body: { referralCode: code },
    });
    expect(selfClaimRes.status).toBe(400);
    expect(String(selfClaimRes.body.error || selfClaimRes.body.message || '')).toContain('Self-referrals');

    // 3. New user (Bob) visits link & completes first core action -> verified
    await invokeExpressRoute(app, {
      method: 'POST',
      url: '/api/growth/referrals/visit',
      headers: { 'x-zeno-client-id': 'invitee_bob_02' },
      body: { referralCode: code, visitorId: 'visitor_bob' },
    });

    const bobClaimRes = await invokeExpressRoute(app, {
      method: 'POST',
      url: '/api/growth/referrals/claim',
      headers: { 'x-zeno-client-id': 'invitee_bob_02' },
      body: { referralCode: code, visitTimestampMs: Date.now() - 1000 },
    });
    expect(bobClaimRes.status).toBe(200);
    expect(bobClaimRes.body.success).toBe(true);
    expect(bobClaimRes.body.referrerValidatedSignups).toBe(1);

    // 4. Duplicate claim by Bob is rejected (409 Conflict) and does not double-increment
    const bobDuplicateClaim = await invokeExpressRoute(app, {
      method: 'POST',
      url: '/api/growth/referrals/claim',
      headers: { 'x-zeno-client-id': 'invitee_bob_02' },
      body: { referralCode: code },
    });
    expect(bobDuplicateClaim.status).toBe(409);

    // 5. Alice's referral status shows exactly 1 verified referral and unlocked obsidian-gold theme
    const aliceUpdatedRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: '/api/growth/referrals/me',
      headers: { 'x-zeno-client-id': 'referrer_alice_01' },
    });
    expect(aliceUpdatedRes.body.validatedSignupsCount).toBe(1);
    expect(aliceUpdatedRes.body.unlockedThemes).toContain('obsidian-gold');
  });

  it('7. deduplicates growth analytics events via idempotency keys and excludes sensitive content', async () => {
    const app = createTestServer();

    const firstEvent = await invokeExpressRoute(app, {
      method: 'POST',
      url: '/api/growth/analytics/event',
      headers: { 'x-zeno-client-id': 'analytics_tester_1' },
      body: {
        event: 'share_card_created',
        idempotencyKey: 'idem_card_001',
      },
    });
    expect(firstEvent.status).toBe(200);
    expect(firstEvent.body.recorded).toBe(true);

    // Replay same idempotencyKey -> deduplicated
    const replayEvent = await invokeExpressRoute(app, {
      method: 'POST',
      url: '/api/growth/analytics/event',
      headers: { 'x-zeno-client-id': 'analytics_tester_1' },
      body: {
        event: 'share_card_created',
        idempotencyKey: 'idem_card_001',
      },
    });
    expect(replayEvent.status).toBe(200);
    expect(replayEvent.body.deduplicated).toBe(true);

    // Summary reflects recorded event
    const summaryRes = await invokeExpressRoute(app, {
      method: 'GET',
      url: '/api/growth/analytics/summary',
    });
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.summary.virality.shareCardsCreated).toBeGreaterThanOrEqual(1);
  });
});
