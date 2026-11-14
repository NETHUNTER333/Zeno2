/**
 * Unified API Base for Kinich Web Client
 * Ensures that when deployed statically on Vercel (https://kinich.app),
 * all backend API calls are correctly routed to the InstaCloud kinich-api container.
 */

export const INSTACLOUD_ZENO_API_ORIGIN =
  'https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com';

export const PRODUCTION_PUBLIC_ORIGIN = 'https://kinich.app';

export function isCapacitorOrMobileApp(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.protocol;
  const h = window.location.hostname.toLowerCase();
  const port = window.location.port;
  const cap = (window as any).Capacitor;
  const isNativeCapacitor = Boolean(
    cap &&
      (typeof cap.isNativePlatform === 'function'
        ? cap.isNativePlatform()
        : typeof cap.getPlatform === 'function'
        ? cap.getPlatform() !== 'web'
        : false)
  );
  return (
    p === 'capacitor:' ||
    p === 'ionic:' ||
    p === 'file:' ||
    isNativeCapacitor ||
    ((h === 'localhost' || h === '127.0.0.1') && !port)
  );
}

export function getBackendBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    return String(import.meta.env.VITE_BACKEND_URL).replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    if (isCapacitorOrMobileApp()) {
      return PRODUCTION_PUBLIC_ORIGIN;
    }

    const host = window.location.hostname.toLowerCase();
    if (host.includes('vercel.app') || host.includes('netlify.app')) {
      return INSTACLOUD_ZENO_API_ORIGIN;
    }
  }

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

// Patch window.fetch to route /api/* calls through the backend origin and fall back to zeno-api on static hosts or Capacitor if /api/* returns 404 or network error.
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  try {
    const originalFetch = window.fetch.bind(window);
    const patchedFetch = async function (input: any, init?: RequestInit): Promise<Response> {
      let url = '';
      if (typeof input === 'string') url = input;
      else if (input instanceof URL) url = input.toString();
      else if (input instanceof Request) url = input.url;

      // Detect and normalize Capacitor / local host URLs like capacitor://localhost/api/... or http://localhost/api/...
      if (
        isCapacitorOrMobileApp() &&
        (url.startsWith('capacitor://') ||
          url.startsWith('ionic://') ||
          url.startsWith('file://') ||
          /^https?:\/\/localhost(?::80|:443)?\/api/i.test(url))
      ) {
        const pathPart = url.replace(/^(capacitor|ionic|file|https?):\/\/[^/]+/i, '');
        const targetUrl = `${PRODUCTION_PUBLIC_ORIGIN}${pathPart.startsWith('/') ? pathPart : `/${pathPart}`}`;
        try {
          return await originalFetch(targetUrl, init);
        } catch {
          return await originalFetch(`${INSTACLOUD_ZENO_API_ORIGIN}${pathPart.startsWith('/') ? pathPart : `/${pathPart}`}`, init);
        }
      }

      if (url.startsWith('/api/') || url.startsWith('/api?')) {
        const base = getBackendBaseUrl();
        if (base) {
          const newUrl = base + url;
          try {
            const res =
              typeof input === 'string'
                ? await originalFetch(newUrl, init)
                : input instanceof URL
                ? await originalFetch(new URL(newUrl), init)
                : await originalFetch(new Request(newUrl, input), init);
            if (res.status === 404) {
              return await originalFetch(`${INSTACLOUD_ZENO_API_ORIGIN}${url}`, init);
            }
            return res;
          } catch {
            return await originalFetch(`${INSTACLOUD_ZENO_API_ORIGIN}${url}`, init);
          }
        }
        try {
          const res = await originalFetch(input, init);
          if (res.status === 404 && typeof input === 'string') {
            return await originalFetch(`${INSTACLOUD_ZENO_API_ORIGIN}${url}`, init);
          }
          return res;
        } catch (err) {
          if (typeof input === 'string') {
            return await originalFetch(`${INSTACLOUD_ZENO_API_ORIGIN}${url}`, init);
          }
          throw err;
        }
      }
      return originalFetch(input, init);
    };

    try {
      Object.defineProperty(window, 'fetch', {
        value: patchedFetch,
        writable: true,
        configurable: true,
      });
    } catch {
      (window as any).fetch = patchedFetch;
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
