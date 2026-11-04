import * as Sentry from '@sentry/react';

// Generate or retrieve an anonymous guest visitor ID (no PII)
function getAnonymousVisitorId(): string {
  if (typeof window === 'undefined') return 'anon-server';
  let visitorId = localStorage.getItem('kinich_anon_visitor_id');
  if (!visitorId) {
    visitorId = 'visitor_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    try {
      localStorage.setItem('kinich_anon_visitor_id', visitorId);
    } catch {}
  }
  return visitorId;
}

// Sensitive keywords to scrub from breadcrumbs and error reports
const SENSITIVE_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // Email
  /\b(?:Bearer|Token)\s+[A-Za-z0-9._~+/-]+=*/gi, // Auth tokens
  /\b(?:sk_live|sk_test|key|secret|password|token|auth|cookie|authorization)=[^&\s]+/gi,
];

function sanitizeString(str: string): string {
  if (!str) return str;
  let sanitized = str;
  for (const pat of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pat, '[SCRUBBED]');
  }
  return sanitized;
}

function sanitizeObject(obj: any, depth = 0): any {
  if (!obj || depth > 4) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item, depth + 1));
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('prompt') ||
        lowerKey.includes('content') ||
        lowerKey.includes('message') ||
        lowerKey.includes('answer') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('cookie') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('email')
      ) {
        cleaned[key] = '[SCRUBBED_PRIVACY]';
      } else {
        cleaned[key] = sanitizeObject(val, depth + 1);
      }
    }
    return cleaned;
  }
  return obj;
}

export function initFrontendSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isProd = import.meta.env.MODE === 'production';
  const release = import.meta.env.VITE_GIT_SHA || 'dev';
  const environment = isProd ? 'production' : 'preview';

  if (!dsn) {
    console.warn('[Sentry] VITE_SENTRY_DSN not configured. Local fallback error boundary active.');
  }

  Sentry.init({
    dsn: dsn || undefined,
    environment,
    release,
    tracesSampleRate: 0.1,

    // Privacy requirements
    beforeSend(event) {
      if (event.user) {
        event.user = { id: getAnonymousVisitorId() };
      }
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
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => ({
          ...bc,
          message: bc.message ? sanitizeString(bc.message) : undefined,
          data: bc.data ? sanitizeObject(bc.data) : undefined,
        }));
      }
      if (event.extra) {
        event.extra = sanitizeObject(event.extra);
      }
      return event;
    },
  });

  // Set anonymous visitor context
  Sentry.setUser({ id: getAnonymousVisitorId() });

  // Attach window fetch interceptor for /api/* breadcrumbs and 5xx / 422 error tracking
  if (typeof window !== 'undefined' && window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const isApiCall = urlStr.includes('/api/');
      const startTime = Date.now();

      try {
        const response = await originalFetch.apply(this, [input, init]);
        const latencyMs = Date.now() - startTime;

        if (isApiCall) {
          let routeName = '/api/unknown';
          try {
            const parsed = new URL(urlStr, window.location.origin);
            routeName = parsed.pathname;
          } catch {}

          // Add Sentry breadcrumb for API call
          Sentry.addBreadcrumb({
            category: 'http.api',
            message: `${init?.method || 'GET'} ${routeName} [${response.status}] ${latencyMs}ms`,
            level: response.ok ? 'info' : response.status >= 500 ? 'error' : 'warning',
            data: {
              endpoint: routeName,
              status: response.status,
              latencyMs,
            },
          });

          // Report 5xx server errors to Sentry
          if (response.status >= 500) {
            Sentry.captureMessage(`API Error ${response.status} on ${routeName}`, {
              level: 'error',
              tags: {
                endpoint: routeName,
                status: String(response.status),
                route: routeName,
              },
              extra: {
                url: urlStr,
                status: response.status,
                latencyMs,
              },
            });
          }

          // Report 422 on /api/youtube/transcript specifically as requested
          if (response.status === 422 && routeName.includes('/youtube/transcript')) {
            Sentry.captureMessage(`YouTube Transcript Fetch Validation Error (422)`, {
              level: 'warning',
              tags: {
                endpoint: '/api/youtube/transcript',
                status: '422',
                route: '/api/youtube/transcript',
              },
              extra: {
                url: urlStr,
                status: 422,
                latencyMs,
              },
            });
          }
        }

        return response;
      } catch (err: any) {
        if (isApiCall) {
          Sentry.captureException(err, {
            tags: { endpoint: urlStr, route: urlStr },
          });
        }
        throw err;
      }
    };
  }
}

export { Sentry };
