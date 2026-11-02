/**
 * Unified API Base for Zeno Web Client
 * Ensures that when deployed statically on Vercel (https://zeno0x.vercel.app),
 * all backend API calls are correctly routed to the InstaCloud zeno-api container.
 */

export const INSTACLOUD_ZENO_API_ORIGIN =
  'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

export function getBackendBaseUrl(): string {
  // 1. Explicit Vite env override
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return String(import.meta.env.VITE_BACKEND_URL).replace(/\/$/, '');
  }

  // 2. Running on Vercel production or preview domains
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('vercel.app')) {
      return INSTACLOUD_ZENO_API_ORIGIN;
    }
  }

  // 3. Local dev server / AI Studio proxy: relative paths use local proxy
  return '';
}

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getBackendBaseUrl();
  return base ? `${base}${cleanPath}` : cleanPath;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path);
  const options: RequestInit = {
    ...init,
    credentials: init?.credentials || 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  };
  return fetch(url, options);
}

// Safely intercept fetch to route /api/* calls through the backend origin on static hosts like Vercel.
// Wrapped in safe try/catch blocks that never throw even if window.fetch has only a getter.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  try {
    const originalFetch = window.fetch.bind(window);
    const patchedFetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        url = input.url;
      }

      if (url.startsWith('/api/') || url.startsWith('/api?')) {
        const base = getBackendBaseUrl();
        if (base) {
          const newUrl = `${base}${url}`;
          if (typeof input === 'string') {
            return originalFetch(newUrl, init);
          } else if (input instanceof URL) {
            return originalFetch(new URL(newUrl), init);
          } else if (typeof Request !== 'undefined' && input instanceof Request) {
            return originalFetch(new Request(newUrl, input), init);
          }
        }
      }
      return originalFetch(input, init);
    };

    try {
      Object.defineProperty(window, 'fetch', {
        value: patchedFetch,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      try {
        (window as any).fetch = patchedFetch;
      } catch {
        // window.fetch is getter-only and non-configurable in this environment;
        // apiFetch() will explicitly route calls without mutating window.fetch
      }
    }
  } catch (err) {
    console.warn('[apiBase] Could not patch window.fetch:', err);
  }
}


if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else if (input instanceof Request) url = input.url;

    if (url.startsWith('/api/') || url.startsWith('/api?')) {
      const base = getBackendBaseUrl();
      if (base) {
        const newUrl = `${base}${url}`;
        if (typeof input === 'string') return originalFetch(newUrl, init);
        if (input instanceof URL) return originalFetch(new URL(newUrl), init);
        if (input instanceof Request) return originalFetch(new Request(newUrl, input), init);
      }
    }
    return originalFetch(input, init);
  };
}
