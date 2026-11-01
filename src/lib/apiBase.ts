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


// Monkey-patch window.fetch to route /api/* calls through the backend origin.
// This is a belt-and-suspenders backup for the Vercel rewrite rule.
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
        if (typeof input === 'string') {
          return originalFetch(newUrl, init);
        } else if (input instanceof URL) {
          return originalFetch(new URL(newUrl), init);
        } else if (input instanceof Request) {
          return originalFetch(new Request(newUrl, input), init);
        }
      }
    }
    return originalFetch(input, init);
  };
}
