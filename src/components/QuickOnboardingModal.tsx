import React, { useState } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import { UserAccountStore } from '../lib/userAccountStore';
import { GoogleSignInButton } from './GoogleSignInButton';

interface QuickOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onComplete?: () => void;
}

export const QuickOnboardingModal: React.FC<QuickOnboardingModalProps> = ({
  isOpen,
  onClose,
  isDark,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const currentProfile = UserAccountStore.getProfile();

  const [displayName, setDisplayName] = useState(currentProfile.displayName || '');
  const [username, setUsername] = useState(currentProfile.username || '');
  const [authMethod, setAuthMethod] = useState<'google' | 'email' | 'guest'>('guest');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFinish = () => {
    UserAccountStore.saveProfile({
      ...UserAccountStore.getProfile(),
      displayName: displayName.trim() || 'User',
      username: username.trim() || 'user',
      signinProvider: authMethod,
    });

    UserAccountStore.setOnboardingDone();
    if (onComplete) onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark
            ? 'bg-[#101014] border-white/10 text-white'
            : 'bg-white border-black/10 text-[#09090b]'
        }`}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-500/10">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Account Setup • Step {step} of 2
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Welcome</h3>
            <p className="text-xs text-neutral-400">
              Continue as guest or sign in to save your history.
            </p>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                {error}
              </div>
            )}
            {notice && (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                {notice}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <GoogleSignInButton
                testId="onboarding-google-signin-btn"
                isDark={isDark}
                beforeSignIn={() => {
                  setError(null);
                  setNotice(null);
                  return true;
                }}
                onError={(msg) => setError(msg)}
                onNotice={(msg) => setNotice(msg)}
                onSuccess={(outcome) => {
                  if (outcome.user) {
                    setAuthMethod('google');
                    if (outcome.user.displayName) setDisplayName(outcome.user.displayName);
                    setStep(2);
                  }
                }}
              />

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('guest');
                  UserAccountStore.loginAsGuest();
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${
                  authMethod === 'guest'
                    ? isDark ? 'border-white bg-white/10 text-white' : 'border-black bg-black/5 text-black'
                    : isDark ? 'border-white/10 hover:bg-white/5 text-neutral-300' : 'border-black/10 hover:bg-black/5 text-neutral-700'
                }`}
              >
                <span>Continue as Guest</span>
                {authMethod === 'guest' && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>

            <button
              onClick={() => {
                if (authMethod === 'guest') {
                  UserAccountStore.loginAsGuest();
                }
                setStep(2);
              }}
              className="mt-4 w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Your Profile</h3>
            <p className="text-xs text-neutral-400">
              Pick your display name and username.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                    isDark ? 'bg-black/50 border-white/15 text-white' : 'bg-neutral-50 border-black/15 text-black'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="username"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                    isDark ? 'bg-black/50 border-white/15 text-white' : 'bg-neutral-50 border-black/15 text-black'
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-2.5 rounded-xl border border-neutral-500/30 text-xs font-semibold cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                className="w-2/3 py-2.5 rounded-xl bg-white text-black font-semibold text-xs cursor-pointer"
              >
                Complete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
