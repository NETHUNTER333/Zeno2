import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, ensureUserProfileInFirestore } from './firebase';

export type GoogleAuthErrorKind =
  | 'cancelled'
  | 'no-account'
  | 'network'
  | 'play-services'
  | 'developer-error'
  | 'popup-blocked'
  | 'unknown';

export interface MappedGoogleAuthError {
  kind: GoogleAuthErrorKind;
  userMessage: string;
  shouldLogLoudlyInDev: boolean;
}

export interface GoogleSignInOutcome {
  user: FirebaseUser | null;
  cancelled: boolean;
  guestUpgraded: boolean;
  guestMergeSkipped: boolean;
  notice?: string;
}

export class GoogleAuthError extends Error {
  readonly kind: GoogleAuthErrorKind;
  readonly code?: string;
  readonly originalError: unknown;

  constructor(
    message: string,
    kind: GoogleAuthErrorKind,
    code?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'GoogleAuthError';
    this.kind = kind;
    this.code = code;
    this.originalError = originalError;
  }
}

export interface AuthRuntimeDeps {
  isNativePlatform: () => boolean;
  nativeSignInWithGoogle: () => Promise<{ credential?: { idToken?: string | null } | null }>;
  nativeSignOut: () => Promise<void>;
  getCurrentUser: () => FirebaseUser | null;
  linkWithCredential: (
    user: FirebaseUser,
    credential: ReturnType<typeof GoogleAuthProvider.credential>
  ) => Promise<{ user: FirebaseUser }>;
  signInWithCredential: (
    credential: ReturnType<typeof GoogleAuthProvider.credential>
  ) => Promise<{ user: FirebaseUser }>;
  linkWithPopup: (
    user: FirebaseUser,
    provider: GoogleAuthProvider
  ) => Promise<{ user: FirebaseUser }>;
  signInWithPopup: (provider: GoogleAuthProvider) => Promise<{ user: FirebaseUser }>;
  firebaseSignOut: () => Promise<void>;
  ensureProfile: (user: FirebaseUser) => Promise<unknown>;
  isDev: () => boolean;
}

const defaultDeps: AuthRuntimeDeps = {
  isNativePlatform: () => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  },
  nativeSignInWithGoogle: () =>
    FirebaseAuthentication.signInWithGoogle({
      useCredentialManager: true,
    }),
  nativeSignOut: () => FirebaseAuthentication.signOut(),
  getCurrentUser: () => auth.currentUser,
  linkWithCredential: (user, credential) => linkWithCredential(user, credential),
  signInWithCredential: (credential) => signInWithCredential(auth, credential),
  linkWithPopup: (user, provider) => linkWithPopup(user, provider),
  signInWithPopup: (provider) => signInWithPopup(auth, provider),
  firebaseSignOut: () => firebaseSignOut(auth),
  ensureProfile: (user) => ensureUserProfileInFirestore(user),
  isDev: () => {
    try {
      return Boolean((import.meta as any)?.env?.DEV);
    } catch {
      return false;
    }
  },
};

function extractErrorDetails(error: unknown): { code: string; message: string; combined: string } {
  const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, any>;
  const code = String(errObj.code || errObj.errorCode || '').trim();
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : String(errObj.message || errObj.errorMessage || '');
  const combined = `${code} ${message}`.trim();
  return { code, message, combined };
}

export function mapGoogleAuthError(error: unknown): MappedGoogleAuthError {
  const { code, message, combined } = extractErrorDetails(error);
  const lower = combined.toLowerCase();

  // 1. User cancelled (Android Credential Manager or Web popup)
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled' ||
    code === 'ERR_CANCELED' ||
    /getcredentialcancellationexception/i.test(combined) ||
    /type_user_canceled/i.test(combined) ||
    /\bcancel(l)?ed\b/i.test(message) ||
    /user closed/i.test(message) ||
    /activity is cancelled/i.test(lower)
  ) {
    return {
      kind: 'cancelled',
      userMessage: '',
      shouldLogLoudlyInDev: false,
    };
  }

  // 2. No Google account / no credentials available on device
  if (
    /nocredentialexception/i.test(combined) ||
    /type_no_credential/i.test(combined) ||
    /no credentials? available/i.test(lower) ||
    /no google account/i.test(lower) ||
    /cannot find a matching credential/i.test(lower)
  ) {
    return {
      kind: 'no-account',
      userMessage: 'Add a Google account to this phone, or continue as guest.',
      shouldLogLoudlyInDev: false,
    };
  }

  // 3. DEVELOPER_ERROR / code 10 / SHA or client ID mismatch
  if (
    /developer_error/i.test(combined) ||
    /getcredentialproviderconfigurationexception/i.test(combined) ||
    /apiexception:\s*10\b/i.test(combined) ||
    /\bstatus\s*(?:code)?\s*[:=]\s*10\b/i.test(combined) ||
    /\b12500\b/.test(combined) ||
    /\b28444\b/.test(combined) ||
    /developer console is not set up correctly/i.test(lower) ||
    /default_web_client_id/i.test(lower) ||
    /provider configuration/i.test(lower) ||
    /sha-?1|sha-?256|client id mismatch/i.test(lower)
  ) {
    return {
      kind: 'developer-error',
      userMessage: 'Sign-in failed, try again',
      shouldLogLoudlyInDev: true,
    };
  }

  // 4. Google Play Services missing / outdated
  if (
    /google\s*play\s*services/i.test(combined) ||
    /service_version_update_required/i.test(combined) ||
    /service_missing/i.test(combined) ||
    /service_disabled/i.test(combined) ||
    /api_not_connected/i.test(combined) ||
    /playservicesnotavailable/i.test(combined)
  ) {
    return {
      kind: 'play-services',
      userMessage: 'Update Google Play services on this device and try again.',
      shouldLogLoudlyInDev: false,
    };
  }

  // 5. Network / offline
  if (
    code === 'auth/network-request-failed' ||
    code === 'ERR_NETWORK' ||
    /\bnetwork[_\s-]*(error|failed|unavailable|timeout)\b/i.test(combined) ||
    /unable to resolve host/i.test(lower) ||
    /failed to connect/i.test(lower) ||
    /internet connection/i.test(lower) ||
    /\boffline\b/i.test(lower) ||
    /timed?\s*out/i.test(lower)
  ) {
    return {
      kind: 'network',
      userMessage: 'No internet connection. Check your network and try again.',
      shouldLogLoudlyInDev: false,
    };
  }

  // 6. Web popup blocked
  if (code === 'auth/popup-blocked' || /popup/i.test(lower) || /cross-origin/i.test(lower)) {
    return {
      kind: 'popup-blocked',
      userMessage: 'Browser blocked the sign-in window. Allow popups or sign in with email.',
      shouldLogLoudlyInDev: false,
    };
  }

  return {
    kind: 'unknown',
    userMessage: 'Sign-in failed, try again',
    shouldLogLoudlyInDev: false,
  };
}

export const UNMERGED_GUEST_NOTICE =
  'Signed in to your existing Google account. Previous guest progress on this device could not be merged automatically.';

export async function signInWithGoogleWithDeps(
  deps: AuthRuntimeDeps = defaultDeps
): Promise<GoogleSignInOutcome> {
  const isNative = deps.isNativePlatform();
  let user: FirebaseUser | null = null;
  let guestUpgraded = false;
  let guestMergeSkipped = false;
  let notice: string | undefined;

  try {
    const existingUser = deps.getCurrentUser();

    if (isNative) {
      // Native Android/iOS: use Jetpack Credential Manager via @capacitor-firebase/authentication.
      const nativeResult = await deps.nativeSignInWithGoogle();
      const idToken = nativeResult?.credential?.idToken;
      if (!idToken) {
        throw new GoogleAuthError(
          'Sign-in failed, try again',
          'unknown',
          'auth/missing-id-token',
          new Error('Credential Manager returned no Google ID token')
        );
      }

      const cred = GoogleAuthProvider.credential(idToken);

      if (existingUser?.isAnonymous) {
        try {
          const linked = await deps.linkWithCredential(existingUser, cred);
          user = linked.user;
          guestUpgraded = true;
        } catch (linkErr: any) {
          if (linkErr?.code === 'auth/credential-already-in-use') {
            const signed = await deps.signInWithCredential(cred);
            user = signed.user;
            guestMergeSkipped = true;
            notice = UNMERGED_GUEST_NOTICE;
          } else {
            throw linkErr;
          }
        }
      } else {
        const signed = await deps.signInWithCredential(cred);
        user = signed.user;
      }
    } else {
      // Web browser: preserve Firebase JS SDK popup sign-in.
      const provider = new GoogleAuthProvider();

      if (existingUser?.isAnonymous) {
        try {
          const linked = await deps.linkWithPopup(existingUser, provider);
          user = linked.user;
          guestUpgraded = true;
        } catch (linkErr: any) {
          if (linkErr?.code === 'auth/credential-already-in-use') {
            const pendingCred = GoogleAuthProvider.credentialFromError(linkErr);
            const signed = pendingCred
              ? await deps.signInWithCredential(pendingCred)
              : await deps.signInWithPopup(provider);
            user = signed.user;
            guestMergeSkipped = true;
            notice = UNMERGED_GUEST_NOTICE;
          } else {
            throw linkErr;
          }
        }
      } else {
        const signed = await deps.signInWithPopup(provider);
        user = signed.user;
      }
    }

    if (user) {
      try {
        await deps.ensureProfile(user);
      } catch (profileErr) {
        console.warn('Non-fatal profile sync error after Google login:', profileErr);
      }
    }

    return {
      user,
      cancelled: false,
      guestUpgraded,
      guestMergeSkipped,
      notice,
    };
  } catch (error: any) {
    if (error instanceof GoogleAuthError) {
      if (error.kind === 'cancelled') {
        return {
          user: null,
          cancelled: true,
          guestUpgraded: false,
          guestMergeSkipped: false,
        };
      }
      throw error;
    }

    const mapped = mapGoogleAuthError(error);
    if (mapped.kind === 'cancelled') {
      return {
        user: null,
        cancelled: true,
        guestUpgraded: false,
        guestMergeSkipped: false,
      };
    }

    if (mapped.shouldLogLoudlyInDev && deps.isDev()) {
      console.error(
        '[Auth] Google Sign-In DEVELOPER_ERROR: verify SHA-1/SHA-256 fingerprints, packageId app.kinich.android, and Web OAuth Client ID / default_web_client_id.',
        error
      );
    } else if (deps.isDev()) {
      console.warn('[Auth] Google Sign-In failed:', error);
    }

    const code =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
    throw new GoogleAuthError(mapped.userMessage, mapped.kind, code, error);
  }
}

export async function signInWithGoogle(): Promise<GoogleSignInOutcome> {
  return signInWithGoogleWithDeps(defaultDeps);
}

export async function signOutWithDeps(deps: AuthRuntimeDeps = defaultDeps): Promise<void> {
  if (deps.isNativePlatform()) {
    try {
      await deps.nativeSignOut();
    } catch (nativeErr) {
      if (deps.isDev()) {
        console.warn('[Auth] Native Credential Manager signOut warning:', nativeErr);
      }
    }
  }
  await deps.firebaseSignOut();
}

export async function signOut(): Promise<void> {
  return signOutWithDeps(defaultDeps);
}
