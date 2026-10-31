const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;

const rawBase =
  env.VITE_BACKEND_URL ||
  env.VITE_INSTACLOUD_BACKEND_URL ||
  '';

export const API_BASE = rawBase.trim().replace(/\/+$/, '');

if (API_BASE && typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(`${API_BASE}${input}`, init);
    }
    if (input instanceof URL && input.origin === window.location.origin && input.pathname.startsWith('/api/')) {
      return originalFetch(`${API_BASE}${input.pathname}${input.search}`, init);
    }
    return originalFetch(input, init);
  };
}
