import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  signInWithGoogleWithDeps,
  signOutWithDeps,
  mapGoogleAuthError,
  GoogleAuthError,
  UNMERGED_GUEST_NOTICE,
  type AuthRuntimeDeps,
} from '../src/lib/auth';

function makeMockDeps(overrides: Partial<AuthRuntimeDeps> = {}): AuthRuntimeDeps {
  return {
    isNativePlatform: () => false,
    nativeSignInWithGoogle: vi.fn().mockResolvedValue({
      credential: { idToken: 'mock-google-id-token' },
    }),
    nativeSignOut: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: () => null,
    linkWithCredential: vi.fn().mockResolvedValue({
      user: { uid: 'anon_upgraded_uid', email: 'student@gmail.com', isAnonymous: false } as any,
    }),
    signInWithCredential: vi.fn().mockResolvedValue({
      user: { uid: 'google_uid_123', email: 'student@gmail.com', isAnonymous: false } as any,
    }),
    linkWithPopup: vi.fn().mockResolvedValue({
      user: { uid: 'web_upgraded_uid', email: 'student@gmail.com', isAnonymous: false } as any,
    }),
    signInWithPopup: vi.fn().mockResolvedValue({
      user: { uid: 'web_uid_456', email: 'student@gmail.com', isAnonymous: false } as any,
    }),
    firebaseSignOut: vi.fn().mockResolvedValue(undefined),
    ensureProfile: vi.fn().mockResolvedValue({}),
    isDev: () => false,
    ...overrides,
  };
}

describe('Unified Google Auth Bridge (Native Credential Manager + Web Popup)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses native Credential Manager on Capacitor native and bridges ID token to Firebase JS SDK without signInWithPopup', async () => {
    const deps = makeMockDeps({ isNativePlatform: () => true });
    const outcome = await signInWithGoogleWithDeps(deps);

    expect(deps.nativeSignInWithGoogle).toHaveBeenCalledTimes(1);
    expect(deps.signInWithPopup).not.toHaveBeenCalled();
    expect(deps.signInWithCredential).toHaveBeenCalledTimes(1);
    expect(deps.ensureProfile).toHaveBeenCalledTimes(1);
    expect(outcome.cancelled).toBe(false);
    expect(outcome.user?.uid).toBe('google_uid_123');
    expect(outcome.guestUpgraded).toBe(false);
    expect(outcome.guestMergeSkipped).toBe(false);
  });

  it('keeps web flow using signInWithPopup when not on native platform', async () => {
    const deps = makeMockDeps({ isNativePlatform: () => false });
    const outcome = await signInWithGoogleWithDeps(deps);

    expect(deps.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(deps.nativeSignInWithGoogle).not.toHaveBeenCalled();
    expect(deps.ensureProfile).toHaveBeenCalledTimes(1);
    expect(outcome.cancelled).toBe(false);
    expect(outcome.user?.uid).toBe('web_uid_456');
  });

  it('upgrades an anonymous guest user via linkWithCredential on native', async () => {
    const anonUser = { uid: 'anon_1', isAnonymous: true } as any;
    const deps = makeMockDeps({
      isNativePlatform: () => true,
      getCurrentUser: () => anonUser,
    });

    const outcome = await signInWithGoogleWithDeps(deps);

    expect(deps.linkWithCredential).toHaveBeenCalledTimes(1);
    expect(deps.signInWithCredential).not.toHaveBeenCalled();
    expect(outcome.guestUpgraded).toBe(true);
    expect(outcome.guestMergeSkipped).toBe(false);
    expect(outcome.user?.uid).toBe('anon_upgraded_uid');
  });

  it('falls back to signInWithCredential when linkWithCredential hits auth/credential-already-in-use and notifies user', async () => {
    const anonUser = { uid: 'anon_2', isAnonymous: true } as any;
    const alreadyInUseErr = Object.assign(new Error('Credential already in use'), {
      code: 'auth/credential-already-in-use',
    });
    const deps = makeMockDeps({
      isNativePlatform: () => true,
      getCurrentUser: () => anonUser,
      linkWithCredential: vi.fn().mockRejectedValue(alreadyInUseErr),
    });

    const outcome = await signInWithGoogleWithDeps(deps);

    expect(deps.linkWithCredential).toHaveBeenCalledTimes(1);
    expect(deps.signInWithCredential).toHaveBeenCalledTimes(1);
    expect(outcome.guestUpgraded).toBe(false);
    expect(outcome.guestMergeSkipped).toBe(true);
    expect(outcome.notice).toBe(UNMERGED_GUEST_NOTICE);
    expect(outcome.user?.uid).toBe('google_uid_123');
  });

  it('throws clear error if native Credential Manager returns no ID token', async () => {
    const deps = makeMockDeps({
      isNativePlatform: () => true,
      nativeSignInWithGoogle: vi.fn().mockResolvedValue({ credential: {} }),
    });

    await expect(signInWithGoogleWithDeps(deps)).rejects.toThrow('Sign-in failed, try again');
    expect(deps.signInWithCredential).not.toHaveBeenCalled();
  });

  it('stays completely silent when user cancels native Credential Manager or web popup', async () => {
    const nativeCancelDeps = makeMockDeps({
      isNativePlatform: () => true,
      nativeSignInWithGoogle: vi
        .fn()
        .mockRejectedValue(new Error('androidx.credentials.exceptions.GetCredentialCancellationException: activity is cancelled by the user.')),
    });
    const nativeOutcome = await signInWithGoogleWithDeps(nativeCancelDeps);
    expect(nativeOutcome).toEqual({
      user: null,
      cancelled: true,
      guestUpgraded: false,
      guestMergeSkipped: false,
    });

    const webCancelDeps = makeMockDeps({
      isNativePlatform: () => false,
      signInWithPopup: vi.fn().mockRejectedValue(
        Object.assign(new Error('Popup closed by user'), { code: 'auth/popup-closed-by-user' })
      ),
    });
    const webOutcome = await signInWithGoogleWithDeps(webCancelDeps);
    expect(webOutcome.cancelled).toBe(true);
    expect(webOutcome.user).toBeNull();
  });

  it('maps NoCredentialException, offline network errors, and Play Services errors to clear user messages', () => {
    const noAccount = mapGoogleAuthError(
      new Error('androidx.credentials.exceptions.NoCredentialException: No credentials available')
    );
    expect(noAccount.kind).toBe('no-account');
    expect(noAccount.userMessage).toBe('Add a Google account to this phone, or continue as guest.');

    const network = mapGoogleAuthError(
      Object.assign(new Error('Network error'), { code: 'auth/network-request-failed' })
    );
    expect(network.kind).toBe('network');
    expect(network.userMessage).toContain('No internet connection');

    const playServices = mapGoogleAuthError(
      new Error('GooglePlayServicesRepairableException: SERVICE_VERSION_UPDATE_REQUIRED')
    );
    expect(playServices.kind).toBe('play-services');
    expect(playServices.userMessage).toContain('Google Play services');
  });

  it('logs DEVELOPER_ERROR / code 10 loudly in dev and shows generic message to user', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const devErr = new Error('com.google.android.gms.common.api.ApiException: 10: DEVELOPER_ERROR');

    const devDeps = makeMockDeps({
      isNativePlatform: () => true,
      isDev: () => true,
      nativeSignInWithGoogle: vi.fn().mockRejectedValue(devErr),
    });

    await expect(signInWithGoogleWithDeps(devDeps)).rejects.toThrow('Sign-in failed, try again');
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockClear();
    const prodDeps = makeMockDeps({
      isNativePlatform: () => true,
      isDev: () => false,
      nativeSignInWithGoogle: vi.fn().mockRejectedValue(devErr),
    });

    await expect(signInWithGoogleWithDeps(prodDeps)).rejects.toThrow('Sign-in failed, try again');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('clears native Credential Manager state and Firebase JS session on signOut', async () => {
    const deps = makeMockDeps({ isNativePlatform: () => true });
    await signOutWithDeps(deps);
    expect(deps.nativeSignOut).toHaveBeenCalledTimes(1);
    expect(deps.firebaseSignOut).toHaveBeenCalledTimes(1);

    const webDeps = makeMockDeps({ isNativePlatform: () => false });
    await signOutWithDeps(webDeps);
    expect(webDeps.nativeSignOut).not.toHaveBeenCalled();
    expect(webDeps.firebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('enforces NEVER rules across src/: no signInWithRedirect and no accounts.google.com OAuth in WebView', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
      }
    };
    walk(srcRoot);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/\bsignInWithRedirect\s*\(/);
      expect(content).not.toMatch(/https?:\/\/accounts\.google\.com/);
      expect(content).not.toMatch(/\bGoogleSignInClient\b/);
    }
  });
});
