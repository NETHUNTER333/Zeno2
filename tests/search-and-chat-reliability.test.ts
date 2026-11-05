import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../server';
import { resetAllRateLimiters } from '../server/rateLimiter';
import { searchWebReliable } from '../server/searchProviders';

describe('Phase 5 & 6 — Search Provider Reliability, SSRF Protection, and Chat Regression', () => {
  const originalTregToken = process.env.TREG_TOKEN;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await resetAllRateLimiters();
  });

  afterEach(() => {
    process.env.TREG_TOKEN = originalTregToken;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('operates without TREG_TOKEN using public fallback and never claims results came from Treg', async () => {
    delete process.env.TREG_TOKEN;

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes('html.duckduckgo.com')) {
        return new Response(
          `<div class="result__body"><a class="result__a" href="https://example.org/quantum">Quantum Article</a><a class="result__snippet">Detailed snippet</a></div>`,
          { status: 200 }
        );
      }
      if (urlStr.includes('en.wikipedia.org/w/api.php')) {
        return new Response(
          JSON.stringify({
            query: {
              search: [{ title: 'Quantum computing', snippet: 'Wikipedia summary' }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not found', { status: 404 });
    }) as any;

    const outcome = await searchWebReliable('quantum computing', 'organic');
    expect(outcome.tregConfigured).toBe(false);
    expect(outcome.providerUsed).toBe('public_fallback');
    expect(outcome.fallbackUsed).toBe(true);
    expect(outcome.providerStatus).toBe('degraded_fallback');
    expect(outcome.toolLabel).toBe('public.web.search.fallback');
    expect(outcome.results.length).toBeGreaterThanOrEqual(2);
    expect(outcome.results.some((r) => r.provider === 'duckduckgo')).toBe(true);
  });

  it('uses Treg when TREG_TOKEN is configured, retries transient 503 once, and attributes results to treg', async () => {
    process.env.TREG_TOKEN = 'test_server_treg_token';
    let tregCalls = 0;

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes('treg.to/call/treg.google.serp.organic')) {
        tregCalls += 1;
        if (tregCalls === 1) {
          return new Response('Service Unavailable', { status: 503 });
        }
        return new Response(
          JSON.stringify({
            output: {
              results: [
                {
                  position: 1,
                  title: 'Treg Primary Result',
                  url: 'https://treg-verified.example.com/doc',
                  snippet: 'Verified primary search result',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Unexpected call', { status: 500 });
    }) as any;

    const outcome = await searchWebReliable('distributed systems', 'organic');
    expect(tregCalls).toBe(2);
    expect(outcome.tregConfigured).toBe(true);
    expect(outcome.providerUsed).toBe('treg');
    expect(outcome.fallbackUsed).toBe(false);
    expect(outcome.providerStatus).toBe('ok');
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0].provider).toBe('treg');
  });

  it('distinguishes genuinely empty search results from total provider unavailability', async () => {
    process.env.TREG_TOKEN = 'test_server_treg_token';

    // Case 1: Treg returns 200 OK with empty results array
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ output: { results: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const emptyOutcome = await searchWebReliable('xyznonexistentquery999999', 'organic');
    expect(emptyOutcome.providerStatus).toBe('empty_results');
    expect(emptyOutcome.providerUsed).toBe('treg');
    expect(emptyOutcome.results).toEqual([]);

    // Case 2: Both Treg and public fallback providers fail with HTTP 500
    global.fetch = vi.fn(async () => {
      return new Response('Upstream Down', { status: 500 });
    }) as any;

    const unavailableOutcome = await searchWebReliable('test query', 'organic');
    expect(unavailableOutcome.providerStatus).toBe('unavailable');
    expect(unavailableOutcome.providerUsed).toBe('none');
    expect(unavailableOutcome.tregError).toContain('Treg API error (500)');
  });

  it('blocks SSRF targets (localhost, 127.0.0.1, cloud metadata 169.254.169.254, RFC1918) on /api/treg/extract', async () => {
    const ssrfUrls = [
      'http://127.0.0.1:3000/api/health',
      'http://localhost:8080/admin',
      'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
      'http://10.0.0.12/internal',
      'file:///etc/passwd',
    ];

    for (const badUrl of ssrfUrls) {
      const res = await request(app).post('/api/treg/extract').send({ url: badUrl });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('validation/unsafe-url');
    }
  });

  it('validates /api/chat payload structure and rejects oversized or invalid attachments', async () => {
    const emptyRes = await request(app).post('/api/chat').send({ messages: [] });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.code).toBe('validation/invalid-messages');

    const badAttachmentRes = await request(app)
      .post('/api/chat')
      .send({
        messages: [
          {
            role: 'user',
            content: 'Analyze this binary',
            attachments: [
              {
                name: 'malware.exe',
                type: 'application/x-msdownload',
                size: 1024,
              },
            ],
          },
        ],
      });
    expect(badAttachmentRes.status).toBe(400);
    expect(badAttachmentRes.body.code).toBe('validation/invalid-messages');
  });
});
