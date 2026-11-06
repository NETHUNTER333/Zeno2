import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import {
  getApps,
  initializeApp,
  cert,
  applicationDefault,
  type App as FirebaseAdminApp,
  type AppOptions,
} from 'firebase-admin/app';
import { getAuth as getAdminAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
  getFirebaseProjectId,
  isFirebaseCheckRevokedEnabled,
  isStrictAuthRequired,
  sendNormalizedError,
} from './config';

export { getAdminFirestore };

export interface VerifiedAuthContext {
  uid: string;
  email?: string;
  emailVerified: boolean;
  projectId: string;
  issuedAt: number;
  expiresAt: number;
}

declare global {
  namespace Express {
    interface Request {
      auth?: VerifiedAuthContext | null;
      firebaseUid?: string | null;
    }
  }
}

/**
 * Explicit route classification for Zeno API endpoints:
 * - PROTECTED_API_ROUTES: Require a cryptographically verified Firebase ID token (401 if missing or invalid).
 * - OPTIONAL_AUTH_API_ROUTES: Allow unauthenticated requests under strict per-IP rate limits,
 *   but if an Authorization header IS provided, it MUST be cryptographically valid (401 if malformed/forged/expired/wrong-project).
 *   When REQUIRE_AUTH_FOR_CHAT=true, these routes also require authentication.
 * - PUBLIC_API_ROUTES: Read-only status, catalog, social metadata, and media proxy routes (still reject invalid Authorization headers if supplied).
 */
export const PROTECTED_API_ROUTES = [
  '/auth/verify',
  '/user/quota',
  '/treg/call',
  '/billing/checkout',
  '/billing/portal',
  '/billing/change-plan',
  '/billing/update-payment-method',
  '/billing/cancel',
] as const;

export const OPTIONAL_AUTH_API_ROUTES = [
  '/chat',
  '/summarize',
  '/tts',
  '/smallest/stt',
  '/smallest/tts',
  '/search',
  '/search/live',
  '/treg/search',
  '/treg/extract',
  '/arxiv/search',
  '/pdf/study',
  '/study/youtube',
  '/study/topic',
  '/study/synthesize',
  '/quota/status',
  '/quota/sync',
  '/quota/upgrade',
  '/billing/me',
  '/billing/country',
  '/billing/invoices',
  '/payments/checkout',
  '/dodo/checkout-session',
  '/payments/customer',
  '/payments/usage',
  '/referral/me',
  '/referral/claim',
  '/growth/referrals/me',
  '/growth/referrals/claim',
  '/contact',
  '/report',
  '/moderation/upload',
  '/moderation/check',
  '/consent',
  '/account/delete',
  '/agents/status',
  '/agents/on-save',
  '/agents/on-message',
  '/agents/memory',
] as const;

export const PUBLIC_API_ROUTES = [
  '/health',
  '/admin/health',
  '/webhooks/dodo',
  '/billing/preview',
  '/billing/countries',
  '/payments/status',
  '/payments/webhook',
  '/dodo/webhook',
  '/share/snapshot',
  '/tokenharbor/models',
  '/treg/status',
  '/treg/catalog',
  '/social/resolve',
  '/social/post-comments',
  '/media/resolve-video',
  '/media/more-images',
  '/media/stream',
  '/media/embed-proxy',
  '/media/download',
  '/finance/quote',
  '/referral/validate',
  '/growth/referrals/visit',
  '/growth/referrals/leaderboard',
  '/legal/audit',
] as const;

let cachedAdminApp: FirebaseAdminApp | null = null;
let cachedAdminProjectId: string | null = null;

// Optional test-only public keys (kid -> PEM public key / certificate) for offline cryptographic verification tests
let testPublicKeys: Record<string, string> | null = null;

export function setTestPublicKeysForAuth(keys: Record<string, string> | null): void {
  testPublicKeys = keys;
}

function buildFirebaseAdminOptions(projectId: string): AppOptions {
  const rawServiceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawServiceAccount) {
    try {
      const jsonStr = rawServiceAccount.startsWith('{')
        ? rawServiceAccount
        : Buffer.from(rawServiceAccount, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonStr);
      return {
        credential: cert(parsed),
        projectId: parsed.project_id || parsed.projectId || projectId,
      };
    } catch {
      // Fall back to default project initialization if malformed
    }
  }
  if ((process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()) {
    try {
      return {
        credential: applicationDefault(),
        projectId,
      };
    } catch {
      // Fall back to projectId-only public certificate verification
    }
  }
  return { projectId };
}

export function getOrInitFirebaseAdmin(projectId = getFirebaseProjectId()): FirebaseAdminApp {
  if (cachedAdminApp && cachedAdminProjectId === projectId) {
    return cachedAdminApp;
  }
  const existing = getApps().find((a) => a.options.projectId === projectId);
  if (existing) {
    cachedAdminApp = existing;
    cachedAdminProjectId = projectId;
    return existing;
  }
  const appName = getApps().length === 0 ? '[DEFAULT]' : `zeno-admin-${projectId}`;
  const existingNamed = getApps().find((a) => a.name === appName);
  if (existingNamed) {
    cachedAdminApp = existingNamed;
    cachedAdminProjectId = projectId;
    return existingNamed;
  }
  cachedAdminApp = initializeApp(buildFirebaseAdminOptions(projectId), appName);
  cachedAdminProjectId = projectId;
  return cachedAdminApp;
}

export class AuthVerificationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(code: string, message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthVerificationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function decodeBase64UrlJson(segment: string): any {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    throw new AuthVerificationError('auth/malformed-token', 'Malformed JWT segment encoding');
  }
}

/**
 * Cryptographically verifies a Firebase ID token:
 * 1. Validates compact JWS 3-part structure and RS256 header (`alg === 'RS256'`, non-empty `kid`).
 * 2. Validates required Firebase ID token claims (`aud`, `iss`, `sub`, `exp`, `iat`) against the expected project.
 * 3. Cryptographically verifies the RS256 signature using `firebase-admin` `verifyIdToken()` (or registered RSA test public keys in unit tests).
 */
export async function verifyFirebaseIdToken(
  rawToken: string,
  expectedProjectId = getFirebaseProjectId()
): Promise<VerifiedAuthContext> {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new AuthVerificationError('auth/missing-token', 'Authentication token is required');
  }

  const token = rawToken.trim();
  if (!token || token.length > 16384) {
    throw new AuthVerificationError('auth/malformed-token', 'Malformed authentication token');
  }

  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new AuthVerificationError('auth/malformed-token', 'JWT must contain header, payload, and signature');
  }

  const header = decodeBase64UrlJson(parts[0]);
  const payload = decodeBase64UrlJson(parts[1]);

  if (!header || typeof header !== 'object' || header.alg !== 'RS256') {
    throw new AuthVerificationError(
      'auth/invalid-algorithm',
      'Invalid JWT algorithm; RS256 is required'
    );
  }

  if (!header.kid || typeof header.kid !== 'string') {
    throw new AuthVerificationError('auth/malformed-token', 'Missing key ID (kid) in JWT header');
  }

  if (!payload || typeof payload !== 'object') {
    throw new AuthVerificationError('auth/malformed-token', 'Invalid JWT payload');
  }

  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.aud !== expectedProjectId || payload.iss !== expectedIssuer) {
    throw new AuthVerificationError(
      'auth/wrong-project',
      'Token audience or issuer does not match expected Firebase project'
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new AuthVerificationError('auth/token-expired', 'Firebase ID token has expired');
  }

  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new AuthVerificationError('auth/invalid-claims', 'Token issued-at (iat) claim is invalid');
  }

  const subjectUid =
    typeof payload.sub === 'string' && payload.sub.trim()
      ? payload.sub.trim()
      : typeof payload.user_id === 'string' && payload.user_id.trim()
      ? payload.user_id.trim()
      : '';

  if (!subjectUid || subjectUid.length > 128) {
    throw new AuthVerificationError('auth/invalid-claims', 'Token subject (sub/uid) claim is missing or invalid');
  }

  // If test RSA public keys are configured (for deterministic unit/integration testing), verify signature with Node crypto
  if (testPublicKeys) {
    const pubKeyPem = testPublicKeys[header.kid];
    if (!pubKeyPem) {
      throw new AuthVerificationError('auth/invalid-signature', 'Unknown signing key ID (kid)');
    }
    const signingInput = `${parts[0]}.${parts[1]}`;
    let signatureBytes: Buffer;
    try {
      signatureBytes = Buffer.from(parts[2], 'base64url');
    } catch {
      throw new AuthVerificationError('auth/invalid-signature', 'Invalid signature encoding');
    }
    const isVerified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(signingInput, 'utf8'),
      pubKeyPem,
      signatureBytes
    );
    if (!isVerified) {
      throw new AuthVerificationError('auth/invalid-signature', 'Cryptographic JWT signature verification failed');
    }

    return {
      uid: subjectUid,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      emailVerified: Boolean(payload.email_verified),
      projectId: expectedProjectId,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  }

  // Production path: Official firebase-admin SDK cryptographic verification
  try {
    const adminApp = getOrInitFirebaseAdmin(expectedProjectId);
    const decoded: DecodedIdToken = await getAdminAuth(adminApp).verifyIdToken(
      token,
      isFirebaseCheckRevokedEnabled()
    );

    if (!decoded || !decoded.uid || decoded.aud !== expectedProjectId || decoded.iss !== expectedIssuer) {
      throw new AuthVerificationError(
        'auth/wrong-project',
        'Verified token claims do not match expected project'
      );
    }

    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: Boolean(decoded.email_verified),
      projectId: expectedProjectId,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
    };
  } catch (err: any) {
    if (err instanceof AuthVerificationError) {
      throw err;
    }
    const errCode = String(err?.code || err?.errorInfo?.code || '');
    if (errCode.includes('id-token-expired')) {
      throw new AuthVerificationError('auth/token-expired', 'Firebase ID token has expired');
    }
    if (errCode.includes('id-token-revoked')) {
      throw new AuthVerificationError('auth/token-revoked', 'Firebase ID token has been revoked');
    }
    throw new AuthVerificationError(
      'auth/invalid-signature',
      'Cryptographic Firebase ID token verification failed'
    );
  }
}

/**
 * Strips any client-supplied identity fields from headers, query, or body
 * so downstream handlers never trust an unverified client UID.
 */
export function sanitizeClientSuppliedIdentity(req: Request): void {
  delete req.headers['x-user-id'];
  delete req.headers['x-firebase-uid'];
  delete req.headers['x-authenticated-uid'];

  if (req.query && typeof req.query === 'object') {
    delete (req.query as Record<string, unknown>).uid;
    delete (req.query as Record<string, unknown>).userId;
  }

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    delete (req.body as Record<string, unknown>).uid;
    delete (req.body as Record<string, unknown>).userId;
    delete (req.body as Record<string, unknown>).firebaseUid;
  }
}

/**
 * Shared authentication middleware applied to `/api`.
 * - Always strips client-supplied UIDs.
 * - If an `Authorization` header is present, cryptographically verifies the Bearer token.
 *   Any malformed, expired, forged, invalid-signature, or wrong-project token is immediately rejected with 401.
 * - If no `Authorization` header is present, sets `req.auth = null` and `req.firebaseUid = null`;
 *   if the target route is in `PROTECTED_API_ROUTES` (or `REQUIRE_AUTH_FOR_CHAT=true` on AI routes), rejects with 401.
 */
export async function firebaseAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  sanitizeClientSuppliedIdentity(req);
  req.auth = null;
  req.firebaseUid = null;

  const authHeader = req.headers.authorization;
  const routePath = req.path || '/';
  const isProtectedRoute =
    PROTECTED_API_ROUTES.some((p) => routePath === p || routePath.startsWith(`${p}/`)) ||
    (isStrictAuthRequired() &&
      OPTIONAL_AUTH_API_ROUTES.some((p) => routePath === p || routePath.startsWith(`${p}/`)));

  if (authHeader !== undefined) {
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return sendNormalizedError(
        res,
        401,
        'auth/malformed-header',
        'Authorization header must use the Bearer scheme'
      );
    }
    const rawToken = authHeader.slice(7).trim();
    if (!rawToken) {
      return sendNormalizedError(res, 401, 'auth/missing-token', 'Bearer token cannot be empty');
    }

    try {
      const verified = await verifyFirebaseIdToken(rawToken);
      req.auth = verified;
      req.firebaseUid = verified.uid;
      return next();
    } catch (err) {
      if (err instanceof AuthVerificationError) {
        return sendNormalizedError(res, err.statusCode, err.code, err.message);
      }
      return sendNormalizedError(
        res,
        401,
        'auth/invalid-token',
        'Invalid or unverifiable authentication token'
      );
    }
  }

  if (isProtectedRoute) {
    return sendNormalizedError(
      res,
      401,
      'auth/missing-token',
      'Authentication required: provide a valid Firebase Bearer token'
    );
  }

  return next();
}

/**
 * Route-level middleware that strictly requires an authenticated Firebase user.
 */
export function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !req.auth.uid) {
    return sendNormalizedError(
      res,
      401,
      'auth/missing-token',
      'Authentication required: provide a valid Firebase Bearer token'
    );
  }
  return next();
}
