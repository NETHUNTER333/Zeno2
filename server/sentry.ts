import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';

const isProd = process.env.NODE_ENV === 'production';
const dsn = process.env.SENTRY_DSN;
const release = process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
const environment = isProd ? 'production' : 'preview';

// Sensitive keys scrubbed from error payloads
const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api_key',
  'apikey',
  'password',
  'token',
  'secret',
  'prompt',
  'contents',
  'messages',
  'body',
  'payload',
]);

function sanitizeBackendObject(obj: any, depth = 0): any {
  if (!obj || depth > 4) return obj;
  if (typeof obj === 'string') {
    return obj
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[SCRUBBED_EMAIL]')
      .replace(/\b(?:Bearer|Token)\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [SCRUBBED_TOKEN]');
  }
  if (Array.isArray(obj)) return obj.map((i) => sanitizeBackendObject(i, depth + 1));
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        cleaned[key] = '[SCRUBBED_PRIVACY]';
      } else {
        cleaned[key] = sanitizeBackendObject(val, depth + 1);
      }
    }
    return cleaned;
  }
  return obj;
}

export function initBackendSentry() {
  if (!dsn) {
    console.warn('[Sentry Backend] SENTRY_DSN not configured in environment variables.');
  }

  Sentry.init({
    dsn: dsn || undefined,
    environment,
    release,
    tracesSampleRate: 0.1,
    beforeSend(event: any) {
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['set-cookie'];
        }
        if (event.request.data) {
          event.request.data = '[SCRUBBED_PRIVACY_BODY]';
        }
      }
      if (event.user) {
        event.user = { id: event.user.id ? String(event.user.id) : 'anon-backend' };
      }
      if (event.extra) {
        event.extra = sanitizeBackendObject(event.extra);
      }
      return event;
    },
  });
}

/**
 * Reports upstream provider failures (search providers, YouTube transcript sources, LLM providers)
 * to catch silent fallbacks and upstream degradation.
 */
export function reportUpstreamProviderFailure(
  providerName: string,
  route: string,
  status: number | string,
  latencyMs: number,
  details?: string
) {
  Sentry.captureMessage(`Upstream Provider Failure: ${providerName} (${status})`, {
    level: 'warning',
    tags: {
      provider: providerName,
      status: String(status),
      route,
    },
    extra: {
      providerName,
      route,
      status,
      latencyMs,
      details: details ? sanitizeBackendObject(details) : undefined,
    },
  });
}

/**
 * Express middleware to attach route context and report 5xx errors to Sentry
 */
export function sentryBackendMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const route = req.path || req.originalUrl || '/api/unknown';

  res.on('finish', () => {
    const latencyMs = Date.now() - startTime;
    if (res.statusCode >= 500) {
      Sentry.captureMessage(`Backend HTTP ${res.statusCode} on ${route}`, {
        level: 'error',
        tags: {
          route,
          status: String(res.statusCode),
          method: req.method,
        },
        extra: {
          route,
          status: res.statusCode,
          method: req.method,
          latencyMs,
          query: sanitizeBackendObject(req.query),
        },
      });
    }
  });

  next();
}

/**
 * Express error handler middleware
 */
export function sentryErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const route = req.path || req.originalUrl || '/api/unknown';
  Sentry.captureException(err, {
    tags: {
      route,
      method: req.method,
      status: '500',
    },
    extra: {
      route,
      method: req.method,
    },
  });

  if (!res.headersSent) {
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
      requestId: req.headers['x-request-id'] || 'req_' + Date.now().toString(36),
    });
  }
}

export { Sentry };
