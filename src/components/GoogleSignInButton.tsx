import React, { useState } from 'react';
import { UserAccountStore } from '../lib/userAccountStore';
import type { GoogleSignInOutcome } from '../lib/auth';

interface GoogleSignInButtonProps {
  label?: string;
  loadingLabel?: string;
  isDark?: boolean;
  disabled?: boolean;
  className?: string;
  testId?: string;
  beforeSignIn?: () => boolean;
  onSuccess?: (outcome: GoogleSignInOutcome) => void | Promise<void>;
  onError?: (message: string) => void;
  onNotice?: (message: string) => void;
}

const GoogleMark: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 shrink-0' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  label = 'Continue with Google',
  loadingLabel = 'Signing in…',
  isDark = true,
  disabled = false,
  className = '',
  testId = 'google-continue-btn',
  beforeSignIn,
  onSuccess,
  onError,
  onNotice,
}) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    if (beforeSignIn && !beforeSignIn()) {
      return;
    }

    setBusy(true);
    try {
      const outcome = await UserAccountStore.signInWithGoogleOutcome();
      if (outcome.cancelled || !outcome.user) {
        // User cancelled: stay silent with no toast or error.
        return;
      }
      if (outcome.guestMergeSkipped && outcome.notice) {
        onNotice?.(outcome.notice);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('kinich-auth-notice', { detail: { message: outcome.notice } })
          );
        }
      }
      await onSuccess?.(outcome);
    } catch (err: any) {
      onError?.(err?.message || 'Sign-in failed, try again');
    } finally {
      setBusy(false);
    }
  };

  const baseTone = isDark
    ? 'bg-[#131314] hover:bg-[#1f1f22] text-[#E3E3E3] border-[#8E918F]/40'
    : 'bg-white hover:bg-[#f8f9fa] text-[#1F1F1F] border-[#747775]/35 shadow-xs';

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={handleClick}
      disabled={busy || disabled}
      aria-busy={busy}
      className={`w-full h-10 px-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${baseTone} ${className}`}
    >
      {busy ? (
        <span
          aria-hidden="true"
          className={`size-4 rounded-full border-2 border-t-transparent animate-spin shrink-0 ${
            isDark ? 'border-white/80' : 'border-zinc-700'
          }`}
        />
      ) : (
        <GoogleMark />
      )}
      <span className="truncate">{busy ? loadingLabel : label}</span>
    </button>
  );
};
