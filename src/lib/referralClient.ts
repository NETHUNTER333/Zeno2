import { apiFetch } from './apiBase';
import { auth } from './firebase';

export interface PendingReferralInfo {
  code: string;
  referrerName?: string;
  capturedAt: number;
}

export interface ReferralDashboardResponse {
  success: boolean;
  code: string;
  link: string;
  stats: {
    invited: number;
    qualified: number;
    rewarded: number;
  };
  referrals: Array<{
    id: string;
    referredUserId: string;
    status: string;
    createdAt: number;
    qualifiedAt: number | null;
  }>;
  rewards: Array<{
    id: string;
    amount: number;
    days: number;
    reason: string;
    referralId: string;
    createdAt: number;
  }>;
  error?: string;
}

const STORAGE_KEY = 'zeno_pending_ref_code';
const COOKIE_NAME = 'zeno_ref_code';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function setCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
  } catch {}
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  } catch {}
}

/**
 * Extracts referral code from URL search parameters (?ref=CODE) or path (/r/CODE).
 */
export function extractReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Check query parameter ?ref=CODE
    const url = new URL(window.location.href);
    const queryCode = url.searchParams.get('ref')?.trim();
    if (queryCode && queryCode.length >= 3) {
      return queryCode;
    }

    // 2. Check deep link pathname /r/CODE
    const pathname = url.pathname;
    const rMatch = pathname.match(/^\/r\/([a-zA-Z0-9_-]+)/i);
    if (rMatch && rMatch[1]) {
      return rMatch[1].trim();
    }
  } catch {}
  return null;
}

/**
 * Captures and validates an inbound referral code from the URL on landing.
 * Saves to both localStorage and a 30-day cookie to survive OAuth redirects.
 */
export async function captureInboundReferral(): Promise<PendingReferralInfo | null> {
  const code = extractReferralCodeFromUrl();
  if (code) {
    const pending: PendingReferralInfo = {
      code,
      capturedAt: Date.now(),
    };

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } catch {}

    // Save to 30-day cookie
    setCookie(COOKIE_NAME, code, COOKIE_MAX_AGE);

    // Validate with backend to get referrer's display name for banner
    try {
      const res = await apiFetch(`/api/referral/validate/${encodeURIComponent(code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.referrerName) {
          pending.referrerName = data.referrerName;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
          } catch {}
        }
      }
    } catch {}

    return pending;
  }

  const existing = getPendingReferral();
  if (existing?.code && !existing.referrerName) {
    try {
      const res = await apiFetch(`/api/referral/validate/${encodeURIComponent(existing.code)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.referrerName) {
          existing.referrerName = data.referrerName;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
          } catch {}
        }
      }
    } catch {}
  }

  return existing;
}

/**
 * Retrieves the currently pending referral code from localStorage or cookie.
 */
export function getPendingReferral(): PendingReferralInfo | null {
  if (typeof window === 'undefined') return null;

  // 1. Check localStorage ('zeno_pending_ref_code' or 'ref')
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.code) {
        return parsed as PendingReferralInfo;
      }
    }
    const directRef = localStorage.getItem('ref');
    if (directRef && directRef.trim()) {
      return {
        code: directRef.trim(),
        capturedAt: Date.now(),
      };
    }
  } catch {}

  // 2. Check Cookie
  const cookieCode = getCookie(COOKIE_NAME);
  if (cookieCode) {
    return {
      code: cookieCode,
      capturedAt: Date.now(),
    };
  }

  return null;
}

/**
 * Clears pending referral data once attributed or rejected.
 */
export function clearPendingReferral(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  clearCookie(COOKIE_NAME);
}

/**
 * Claims a pending referral code for the newly authenticated user.
 * Idempotent: safe to call on every auth state change.
 */
export async function claimPendingReferralAfterAuth(
  userId: string,
  _email?: string
): Promise<{ success: boolean; error?: string; alreadyClaimed?: boolean }> {
  const pending = getPendingReferral();
  if (!pending || !pending.code) {
    return { success: false, error: 'No pending referral code found' };
  }

  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Zeno-Client-Id': userId,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const creationTime = auth.currentUser?.metadata?.creationTime;
    const accountCreatedAtMs = creationTime ? new Date(creationTime).getTime() : Date.now();

    const res = await apiFetch('/api/referral/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: pending.code,
        accountCreatedAtMs,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      clearPendingReferral();
      return { success: true, alreadyClaimed: Boolean(data.alreadyClaimed) };
    }

    // If already claimed or invalid code, clear to avoid repeating
    if (res.status === 400 || res.status === 409) {
      clearPendingReferral();
    }

    return {
      success: false,
      error: data.error || data.message || `Referral claim failed with status ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while claiming referral' };
  }
}

/**
 * Fetches the user's live referral dashboard from the backend.
 */
export async function fetchUserReferralDashboard(): Promise<ReferralDashboardResponse | null> {
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const uid = auth.currentUser?.uid || localStorage.getItem('zeno_client_id') || 'guest';
    const headers: Record<string, string> = {
      'X-Zeno-Client-Id': uid,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await apiFetch('/api/referral/me', {
      headers,
    });

    if (res.ok) {
      return (await res.json()) as ReferralDashboardResponse;
    }
  } catch {}
  return null;
}
