import React, { useState } from 'react';
import { X, Mail, Chrome } from 'lucide-react';
import { UserAccountStore } from '../lib/userAccountStore';

interface SignInModalProps {
  isOpen: boolean;
  message?: string;
  onClose: () => void;
  isDark: boolean;
  onComplete?: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  message = 'Sign in to continue',
  onClose,
  isDark,
  onComplete,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await UserAccountStore.signIn();
      if (onComplete) onComplete();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await UserAccountStore.signUp(email.trim(), password);
      } else {
        await UserAccountStore.signInWithEmail(email.trim(), password);
      }
      if (onComplete) onComplete();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Email sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl transition-all ${
          isDark ? 'bg-[#101014] border-white/10 text-white' : 'bg-white border-black/10 text-[#09090b]'
        }`}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-500/10">
          <h3 className="text-sm font-bold">{message}</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className={`w-full mb-3 p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
            isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' : 'border-black/10 bg-black/5 hover:bg-black/10 text-black'
          }`}
        >
          <Chrome className="w-4 h-4" />
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
          <span className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>or</span>
          <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={`w-full mb-2 px-3 py-2 rounded-xl border text-xs outline-none ${
            isDark ? 'bg-[#09090b] border-white/[0.12] text-white' : 'bg-[#f8f8f9] border-black/[0.12] text-black'
          }`}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={`w-full mb-3 px-3 py-2 rounded-xl border text-xs outline-none ${
            isDark ? 'bg-[#09090b] border-white/[0.12] text-white' : 'bg-[#f8f8f9] border-black/[0.12] text-black'
          }`}
        />

        <button
          type="button"
          onClick={handleEmail}
          disabled={loading || !email.trim()}
          className="w-full py-2.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Signing in...' : mode === 'signup' ? 'Create Account' : 'Sign in with Email'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className={`w-full mt-2 text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'} hover:underline cursor-pointer`}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
};
