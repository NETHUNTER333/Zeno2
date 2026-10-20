import http from 'http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../server';
import { firebaseAuthMiddleware } from '../server/auth';
import {
  attachRequestAbortController,
  DEFAULT_TIER_POLICIES,
  InMemorySlidingWindowStore,
  rateLimitMiddleware,
  resetAllRateLimiters,
  setPrimaryRateLimitStore,
  setRateLimitPolicies,
} from '../server/rateLimiter';
import { sendNormalizedError } from '../server/config';

function computePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sortedValues.length) - 1)
  );
  return sortedValues[idx];
}

describe('Controlled Load Tests — Concurrent SSE Sessions, Latency (p95/p99), Memory, Aborts & Quota Backpressure', () => {
  let loadServer: http.Server;
  let loadPort = 0;
  let activeSseStreams = 0;
  let totalAbortedCleanups = 0;
  let simulatedUpstreamQuotaRemaining = 100;
  let upstreamModelCalls = 0;
  const loadAgent = new http.Agent({ keepAlive: false, maxSockets: 120 });

  beforeAll(async () => {
    const harness = express();
    harness.use(express.json());
    harness.use('/api', firebaseAuthMiddleware, rateLimitMiddleware);

    harness.post('/api/chat/sse-load-probe', async (req, res) => {
      const abortController = attachRequestAbortController(req, res);
      const chunks = Number(req.body?.chunks ?? 4);
      const chunkDelayMs = Number(req.body?.chunkDelayMs ?? 6);

      upstreamModelCalls += 1;
      if (simulatedUpstreamQuotaRemaining <= 0) {
        return sendNormalizedError(
          res,
          429,
          'upstream/model_quota_exhausted',
          'Upstream model quota exhausted; backpressure active without retry amplification'
        );
      }
      simulatedUpstreamQuotaRemaining -= 1;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      activeSseStreams += 1;
      let cleanedUp = false;
      const cleanup = () => {
        if (!cleanedUp) {
          cleanedUp = true;
          activeSseStreams = Math.max(0, activeSseStreams - 1);
        }
      };

      abortController.signal.addEventListener('abort', () => {
        totalAbortedCleanups += 1;
        cleanup();
      });

      try {
        for (let i = 0; i < chunks; i++) {
          if (abortController.signal.aborted) {
            break;
          }
          res.write(`data: ${JSON.stringify({ chunk: i + 1, text: `token_${i + 1}` })}\n\n`);
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, chunkDelayMs);
            abortController.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true }
            );
          });
        }
        if (!abortController.signal.aborted && !res.writableEnded) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } finally {
        cleanup();
      }
    });

    await new Promise<void>((resolve) => {
      loadServer = harness.listen(0, '127.0.0.1', () => {
        const addr = loadServer.address() as { port: number };
        loadPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    loadAgent.destroy();
    await new Promise<void>((resolve) => loadServer.close(() => resolve()));
  });

  beforeEach(async () => {
    setPrimaryRateLimitStore(new InMemorySlidingWindowStore());
    setRateLimitPolicies({
      ...DEFAULT_TIER_POLICIES,
      general_api: {
        windowMs: 60_000,
        unauthenticatedMax: 500,
        authenticatedMax: 1000,
      },
    });
    await resetAllRateLimiters();
    activeSseStreams = 0;
    totalAbortedCleanups = 0;
    simulatedUpstreamQuotaRemaining = 200;
    upstreamModelCalls = 0;
  });

  it('handles 50 concurrent SSE streaming sessions with bounded p95/p99 latency and stable heap memory', async () => {
    const CONCURRENCY = 50;
    const heapBeforeBytes = process.memoryUsage().heapUsed;
    const latenciesMs: number[] = [];

    const streamSession = (sessionId: number) =>
      new Promise<void>((resolve, reject) => {
        const start = performance.now();
        const payload = JSON.stringify({ sessionId, chunks: 4, chunkDelayMs: 5 });
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: loadPort,
            path: '/api/chat/sse-load-probe',
            method: 'POST',
            agent: loadAgent,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            expect(res.statusCode).toBe(200);
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => {
              try {
                expect(body).toContain('data: [DONE]');
                latenciesMs.push(performance.now() - start);
                resolve();
              } catch (err) {
                reject(err);
              }
            });
          }
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

    await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => streamSession(i)));

    latenciesMs.sort((a, b) => a - b);
    const p50 = computePercentile(latenciesMs, 50);
    const p95 = computePercentile(latenciesMs, 95);
    const p99 = computePercentile(latenciesMs, 99);
    const heapAfterBytes = process.memoryUsage().heapUsed;
    const heapDeltaMb = (heapAfterBytes - heapBeforeBytes) / (1024 * 1024);

    expect(latenciesMs).toHaveLength(CONCURRENCY);
    expect(activeSseStreams).toBe(0);
    expect(p50).toBeLessThan(800);
    expect(p95).toBeLessThan(1200);
    expect(p99).toBeLessThan(1600);
    expect(heapDeltaMb).toBeLessThan(35);
  });

  it('cleans up resources immediately across 30 concurrent mid-stream client aborts without leaked handles', async () => {
    const ABORT_CONCURRENCY = 30;

    const abortingClient = (idx: number) =>
      new Promise<void>((resolve) => {
        const payload = JSON.stringify({ idx, chunks: 40, chunkDelayMs: 30 });
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: loadPort,
            path: '/api/chat/sse-load-probe',
            method: 'POST',
            agent: loadAgent,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            // Once the first SSE chunk arrives (confirming stream is active on the server), abort the socket
            res.once('data', () => {
              req.destroy();
              resolve();
            });
          }
        );
        req.on('error', () => resolve());
        req.write(payload);
        req.end();
      });

    await Promise.all(Array.from({ length: ABORT_CONCURRENCY }, (_, i) => abortingClient(i)));

    // Wait briefly for server socket close events to propagate
    for (let attempt = 0; attempt < 20 && activeSseStreams > 0; attempt++) {
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(activeSseStreams).toBe(0);
    expect(totalAbortedCleanups).toBe(ABORT_CONCURRENCY);
  });

  it('enforces upstream model quota backpressure and rate-limit ceilings under burst load without retry amplification', async () => {
    simulatedUpstreamQuotaRemaining = 10;

    const BURST_SIZE = 25;
    const sendBurstReq = () =>
      new Promise<number>((resolve, reject) => {
        const payload = JSON.stringify({ chunks: 1, chunkDelayMs: 2 });
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: loadPort,
            path: '/api/chat/sse-load-probe',
            method: 'POST',
            agent: loadAgent,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode || 0));
          }
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

    const statuses = await Promise.all(Array.from({ length: BURST_SIZE }, () => sendBurstReq()));
    const count200 = statuses.filter((s) => s === 200).length;
    const count429 = statuses.filter((s) => s === 429).length;

    expect(count200).toBe(10);
    expect(count429).toBe(15);
    expect(upstreamModelCalls).toBe(BURST_SIZE);
    expect(activeSseStreams).toBe(0);
  });

  it('validates production app /api/health endpoint under concurrent burst load', async () => {
    let prodServer!: http.Server;
    let prodPort = 0;
    await new Promise<void>((resolve) => {
      prodServer = app.listen(0, '127.0.0.1', () => {
        const addr = prodServer.address() as { port: number };
        prodPort = addr.port;
        resolve();
      });
    });

    try {
      const results = await Promise.all(
        Array.from({ length: 25 }, () =>
          fetch(`http://127.0.0.1:${prodPort}/api/health`).then((r) => r.status)
        )
      );
      expect(results.every((s) => s === 200)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => prodServer.close(() => resolve()));
    }
  });
});
