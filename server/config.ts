import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import firebaseAppletConfig from '../firebase-applet-config.json';

export const SERVER_LIMITS = {
  JSON_BODY_LIMIT: '15mb',
  MAX_CHAT_MESSAGES: 100,
  MAX_MESSAGE_CHARS: 32_000,
  MAX_SUMMARIZE_CHARS: 24_000,
  MAX_TTS_CHARS: 5_000,
  MAX_ATTACHMENTS_PER_MESSAGE: 5,
  MAX_ATTACHMENT_BYTES: 10 * 1024 * 1024, // 10 MB
  DEFAULT_UPSTREAM_TIMEOUT_MS: 6_000,
  LLM_UPSTREAM_TIMEOUT_MS: 25_000,
} as const;

export function getFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    (firebaseAppletConfig as { projectId?: string }).projectId ||
    'sustained-chiller-36tp2'
  );
}

const DEFAULT_TREG_ORG = 'syntrofoi';

let cachedRouterKeys: Record<string, any> | null = null;
function loadLocalRouterKeys(): Record<string, any> {
  if (cachedRouterKeys) return cachedRouterKeys;
  const candidates = [
    path.resolve(process.cwd(), 'keys/keysAndRouters.json'),
    path.resolve(process.cwd(), 'keysAndRouters.json'),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        cachedRouterKeys = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return cachedRouterKeys || {};
      }
    } catch {}
  }
  cachedRouterKeys = {};
  return cachedRouterKeys;
}

export function getTregToken(): string {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return (process.env.TREG_TOKEN || '').trim();
  }
  const envVal = (process.env.TREG_TOKEN || '').trim();
  if (envVal) return envVal;
  const localKeys = loadLocalRouterKeys();
  return String(localKeys?.treg?.token || localKeys?.TREG_TOKEN || '').trim();
}

export function getTregOrg(): string {
  return (process.env.TREG_ORG || DEFAULT_TREG_ORG).trim();
}

export function getTregBaseUrl(): string {
  return (process.env.TREG_BASE_URL || 'https://treg.to').replace(/\/+$/, '');
}

export function getTinyfishApiKey(): string {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return (process.env.TINYFISH_API_KEY || '').trim();
  }
  const envVal = (process.env.TINYFISH_API_KEY || '').trim();
  if (envVal) return envVal;
  const localKeys = loadLocalRouterKeys();
  return String(localKeys?.tinyfish?.apiKey || localKeys?.TINYFISH_API_KEY || '').trim();
}

export function getTinyfishBaseUrl(): string {
  return (process.env.TINYFISH_BASE_URL || 'https://api.search.tinyfish.ai').replace(/\/+$/, '');
}

export function isStrictAuthRequired(): boolean {
  return process.env.REQUIRE_AUTH_FOR_CHAT === 'true';
}

export function getRedisUrl(): string {
  return (process.env.REDIS_URL || '').trim();
}

export function getTrustProxySetting(): boolean | number | string {
  const raw = process.env.TRUST_PROXY;
  if (raw !== undefined && raw !== '') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    const num = Number(raw);
    if (!Number.isNaN(num) && num >= 0) return num;
    return raw;
  }
  // In Google Cloud Run, K_SERVICE is set and the load balancer appends 1 trusted hop
  if (process.env.K_SERVICE) {
    return 1;
  }
  return false;
}

export function isFirebaseServiceAccountConfigured(): boolean {
  return Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
  );
}

export function isFirebaseCheckRevokedEnabled(): boolean {
  return process.env.FIREBASE_CHECK_REVOKED === 'true';
}

export interface StagingConfigSummary {
  firebaseProjectId: string;
  firebaseCredentialsConfigured: boolean;
  firebaseCheckRevoked: boolean;
  strictAuthRequired: boolean;
  trustProxy: boolean | number | string;
  cloudRunService: string | null;
  tregConfigured: boolean;
  geminiConfigured: boolean;
  redisConfigured: boolean;
  rateLimitFailMode: 'fallback' | 'closed';
}

export function getStagingConfigSummary(): StagingConfigSummary {
  return {
    firebaseProjectId: getFirebaseProjectId(),
    firebaseCredentialsConfigured: isFirebaseServiceAccountConfigured(),
    firebaseCheckRevoked: isFirebaseCheckRevokedEnabled(),
    strictAuthRequired: isStrictAuthRequired(),
    trustProxy: getTrustProxySetting(),
    cloudRunService: process.env.K_SERVICE || null,
    tregConfigured: Boolean(getTregToken()),
    geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()),
    redisConfigured: Boolean(getRedisUrl()),
    rateLimitFailMode: process.env.RATE_LIMIT_FAIL_MODE === 'closed' ? 'closed' : 'fallback',
  };
}

/**
 * Validates that a URL is a safe public HTTP/HTTPS URL and blocks SSRF targets
 * (localhost, loopback, link-local metadata 169.254.169.254, RFC1918 private IPs).
 */
export function validateSafePublicUrl(rawUrl: string): { valid: boolean; url?: URL; reason?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'URL must be a non-empty string' };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: 'Invalid URL syntax' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only http: and https: protocols are allowed' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return { valid: false, reason: 'Loopback and internal hosts are not allowed' };
  }

  // Check IPv4 private/reserved blocks
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return { valid: false, reason: 'Private or link-local IP addresses are not allowed' };
    }
  }

  // Check IPv6 loopback/unique-local/link-local
  if (host.includes(':')) {
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('::ffff:127.')) {
      return { valid: false, reason: 'Private IPv6 addresses are not allowed' };
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Redacts any potential Bearer tokens, API keys, Redis connection URIs, private keys,
 * or authorization strings from error messages.
 */
export function sanitizeErrorMessage(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw || 'Internal server error');
  return msg
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z\-_]{30,}/g, '[REDACTED_API_KEY]')
    .replace(/rediss?:\/\/[^\s"'<>]+/gi, 'redis://[REDACTED_REDIS_URI]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\b(sk|gsk|treg)_[A-Za-z0-9\-_]{12,}/g, '[REDACTED_TOKEN]')
    .slice(0, 500);
}

export function sendNormalizedError(
  res: Response,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>
) {
  return res.status(status).json({
    success: false,
    error: sanitizeErrorMessage(message),
    code,
    ...(extra || {}),
  });
}

export function resolveTrustedClientIp(req: Request): string {
  const trustProxy = getTrustProxySetting();
  const remote = (req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');

  if (trustProxy === false || trustProxy === 0) {
    return remote;
  }

  const xffHeader = req.headers?.['x-forwarded-for'];
  const rawXff = Array.isArray(xffHeader) ? xffHeader.join(',') : xffHeader;
  if (typeof rawXff === 'string' && rawXff.trim().length > 0) {
    const hops = rawXff
      .split(',')
      .map((ip) => ip.trim().replace(/^::ffff:/, ''))
      .filter(Boolean);
    if (hops.length > 0) {
      if (typeof trustProxy === 'number' && trustProxy > 0) {
        // With N trusted proxies (e.g., 1 on Cloud Run load balancer), client IP is hops[length - N]
        const idx = Math.max(0, hops.length - trustProxy);
        return hops[idx];
      }
      return hops[0];
    }
  }

  if (req.ip && typeof req.ip === 'string') {
    return req.ip.replace(/^::ffff:/, '');
  }
  return remote;
}

