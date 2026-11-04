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

const STORAGE_KEY = 'kinich_pending_ref_code';
const SHARED_CLIENT_ID_KEY = 'kinich_growth_client_id';
const LEGACY_CLIENT_ID_KEY = 'kinich_client_id';
const COOKIE_NAME = 'kinich_ref_code';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export function getOrCreateSharedClientId(): string {
  if (typeof window === 'undefined') return 'zcid_session_fallback';
  try {
    const primary = localStorage.getItem(SHARED_CLIENT_ID_KEY);
    if (primary && /^[a-zA-Z0-9_-]{6,64}$/.test(primary)) {
      localStorage.setItem(LEGACY_CLIENT_ID_KEY, primary);
      return primary;
    }
    const legacy = localStorage.getItem(LEGACY_CLIENT_ID_KEY);
    if (legacy && /^[a-zA-Z0-9_-]{6,64}$/.test(legacy) && legacy !== 'guest') {
      localStorage.setItem(SHARED_CLIENT_ID_KEY, legacy);
      return legacy;
    }
    const generated = `zcid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SHARED_CLIENT_ID_KEY, generated);
    localStorage.setItem(LEGACY_CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return 'zcid_session_fallback';
  }
}

export function computeCanonicalReferralCode(userId?: string): string {
  const effectiveId =
    (userId && userId !== 'guest' ? userId : '') ||
    auth.currentUser?.uid ||
    getOrCreateSharedClientId();
  const clean = String(effectiveId || 'guest').trim() || 'guest';
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const seed = `kinich_ref_${clean}`;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(4, '0').slice(-4);
  const hex2 = (h2 >>> 0).toString(16).padStart(4, '0').slice(-4);
  return `zp_${hex1}${hex2}`.toLowerCase();
}

export function isSelfReferralCode(candidateCode?: string | null): boolean {
  if (!candidateCode) return false;
  const normalized = candidateCode.trim().toLowerCase();
  if (!normalized) return false;

  const clientCode = computeCanonicalReferralCode(getOrCreateSharedClientId()).toLowerCase();
  if (normalized === clientCode) return true;

  if (auth.currentUser?.uid) {
    const authCode = computeCanonicalReferralCode(auth.currentUser.uid).toLowerCase();
    if (normalized === authCode) return true;
  }

  try {
    const cachedRaw = localStorage.getItem('kinich_referral_status_v1');
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      const cachedCode = String(parsed?.referralCode || parsed?.code || '').trim().toLowerCase();
      if (cachedCode && normalized === cachedCode) return true;
    }
  } catch {}

  return false;
}

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
 * Strictly ignores and clears self-referral links.
 */
export async function captureInboundReferral(): Promise<PendingReferralInfo | null> {
  const code = extractReferralCodeFromUrl();
  if (code) {
    // Block self-referrals immediately when opening one's own link
    if (isSelfReferralCode(code)) {
      clearPendingReferral();
      return null;
    }

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
  if (existing?.code && isSelfReferralCode(existing.code)) {
    clearPendingReferral();
    return null;
  }

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

  // 1. Check localStorage ('kinich_pending_ref_code' or 'ref')
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.code) {
        if (isSelfReferralCode(parsed.code)) {
          clearPendingReferral();
          return null;
        }
        return parsed as PendingReferralInfo;
      }
    }
    const directRef = localStorage.getItem('ref');
    if (directRef && directRef.trim()) {
      if (isSelfReferralCode(directRef.trim())) {
        clearPendingReferral();
        return null;
      }
      return {
        code: directRef.trim(),
        capturedAt: Date.now(),
      };
    }
  } catch {}

  // 2. Check Cookie
  const cookieCode = getCookie(COOKIE_NAME);
  if (cookieCode) {
    if (isSelfReferralCode(cookieCode)) {
      clearPendingReferral();
      return null;
    }
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
    localStorage.removeItem('ref');
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

  if (isSelfReferralCode(pending.code) || pending.code.toLowerCase() === computeCanonicalReferralCode(userId).toLowerCase()) {
    clearPendingReferral();
    return { success: false, error: 'Self-referrals are not permitted' };
  }

  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const effectiveUid = userId || auth.currentUser?.uid || getOrCreateSharedClientId();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Kinich-Client-Id': effectiveUid,
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
    const uid = auth.currentUser?.uid || getOrCreateSharedClientId();
    const headers: Record<string, string> = {
      'X-Kinich-Client-Id': uid,
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
