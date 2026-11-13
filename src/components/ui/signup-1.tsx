import React, { useState, useEffect, useRef } from "react";
import { Gift, CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";

import { Button } from "./button";
import { Input } from "./input";
import { GoogleSignInButton } from "../GoogleSignInButton";
import { UserAccountStore } from "../../lib/userAccountStore";
import {
  getPendingReferral,
  captureInboundReferral,
  PendingReferralInfo,
} from "../../lib/referralClient";
import { apiFetch } from "../../lib/apiBase";
import { auth } from "../../lib/firebase";
import { recordUserLegalConsent, SiteFooter } from "../LegalAndInfoPages";

interface Signup1Props {
  heading?: string;
  logo?: {
    url: string;
    src: string;
    alt: string;
    title?: string;
  };
  signupText?: string;
  googleText?: string;
  loginText?: string;
  loginUrl?: string;
  isDark?: boolean;
  onSuccess?: () => void;
}

const Signup1 = ({
  heading = "Welcome to Kinich",
  logo = {
    url: "#",
    src: "/assets/aistudio/kinich-icon-1024_544040c6.png",
    alt: "Kinich logo",
    title: "Kinich",
  },
  googleText = "Sign in with Google",
  signupText = "Create an account",
  loginText = "Already have an account?",
  loginUrl = "#",
  isDark = true,
  onSuccess,
}: Signup1Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const consentAcceptedRef = useRef(false);
  const checkboxRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Stored referral detection and validation upon landing
  const [pendingReferral, setPendingReferral] = useState<PendingReferralInfo | null>(() => getPendingReferral());
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detectAndVerifyReferral() {
      try {
        setIsValidatingReferral(true);

        // 1. Check for 'ref' query parameter from URL search params or localStorage upon mount
        let targetCode = "";
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const qRef = urlParams.get("ref");
          if (qRef && qRef.trim()) {
            targetCode = qRef.trim();
          } else {
            const rawRef = localStorage.getItem("ref") || localStorage.getItem("kinich_pending_ref_code");
            if (rawRef) {
              try {
                const parsed = JSON.parse(rawRef);
                targetCode = parsed?.code || rawRef;
              } catch {
                targetCode = rawRef;
              }
            }
          }
        }

        // Also run captureInboundReferral() to ensure cookie and sync
        const captured = await captureInboundReferral();
        const codeToValidate = targetCode || captured?.code;

        if (cancelled) return;

        if (codeToValidate) {
          setIsLoginMode(false);
          // 2. Fetch GET /api/referral/validate/:code from backend
          const res = await apiFetch(`/api/referral/validate/${encodeURIComponent(codeToValidate)}`);
          if (res.ok && !cancelled) {
            const data = await res.json();
            if (data.valid) {
              setPendingReferral({
                code: data.code || codeToValidate,
                referrerName: data.referrerName,
                capturedAt: Date.now(),
              });
            }
          }
        }
      } catch (err) {
        console.warn("[Referral] Failed to verify stored referral code on landing:", err);
      } finally {
        if (!cancelled) setIsValidatingReferral(false);
      }
    }

    detectAndVerifyReferral();
    return () => {
      cancelled = true;
    };
  }, []);

  const isConsentChecked = () =>
    consentAccepted || consentAcceptedRef.current || Boolean(checkboxRef.current?.checked);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!isConsentChecked()) {
      setError("Please confirm you're 18+ and accept the Terms to continue.");
      return;
    }
    if (!cleanEmail || !password) return;
    try {
      setLoading(true);
      setError(null);
      setResetSuccess(null);
      if (isLoginMode) {
        await UserAccountStore.loginWithEmail(cleanEmail, password);
      } else {
        await UserAccountStore.signUp(cleanEmail, password);
      }
      await recordUserLegalConsent(auth.currentUser?.uid, isLoginMode ? "email_login" : "email_signup");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Incorrect email or password.");
      } else if (code === "auth/user-not-found") {
        // If not found in login mode, auto-create account for them
        try {
          await UserAccountStore.signUp(cleanEmail, password);
          await recordUserLegalConsent(auth.currentUser?.uid, "email_signup");
          if (onSuccess) onSuccess();
          return;
        } catch {
          setError("No account found with this email. Switch to Create an account.");
        }
      } else if (code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError(err?.message || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setResetSuccess(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address first to reset your password.");
      return;
    }
    try {
      setResetLoading(true);
      await UserAccountStore.resetPassword(trimmedEmail);
      setResetSuccess(`Password reset link sent to ${trimmedEmail}. Check your inbox.`);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found") {
        setError("No account found with this email address.");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(err?.message || "Failed to send password reset email.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  const checkConsentBeforeGoogle = () => {
    if (!isConsentChecked()) {
      setError("Please confirm you're 18+ and accept the Terms to continue.");
      return false;
    }
    setError(null);
    setNotice(null);
    setResetSuccess(null);
    return true;
  };

  return (
    <section
      className={`min-h-screen w-full flex items-center justify-center p-4 pb-28 sm:pb-8 relative z-40 overflow-y-auto ${
        isDark ? "text-zinc-100" : "text-zinc-900"
      }`}
    >
      <div className="flex items-center justify-center w-full my-auto py-4">
        <div
          className={`flex w-full max-w-md flex-col items-center gap-y-5 rounded-2xl border px-6 sm:px-8 py-7 sm:py-9 shadow-xl opacity-100 ${
            isDark
              ? "bg-[#09090b] border-zinc-800 text-zinc-100"
              : "bg-white border-zinc-200 text-zinc-900"
          }`}
        >
          <div className="flex flex-col items-center gap-y-2 text-center opacity-100">
            {/* Logo */}
            <div className="flex items-center justify-center mb-1">
              <a href={logo.url} className="flex items-center justify-center">
                <img
                  src={logo.src}
                  alt={logo.alt}
                  title={logo.title}
                  className="h-14 w-14 rounded-2xl drop-shadow-sm object-cover"
                />
              </a>
            </div>
            {heading && (
              <h1
                className={`text-2xl sm:text-3xl font-bold tracking-tight opacity-100 ${
                  isDark ? "text-white" : "text-zinc-900"
                }`}
              >
                {isLoginMode ? "Welcome back to Kinich" : heading}
              </h1>
            )}
            <p
              className={`text-xs max-w-xs opacity-100 ${
                isDark ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              AI-powered web search, agent tools, and YouTube study workspace.
            </p>
          </div>

          {/* Promotional Referral Banner */}
          {pendingReferral?.code && (
            <div className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 text-left shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shrink-0">
                    <Gift className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Promotional Pass Active
                      </span>
                      {isValidatingReferral && (
                        <span className="text-[10px] text-emerald-400/70">
                          (verifying...)
                        </span>
                      )}
                    </div>
                    <div className={`text-xs sm:text-sm font-semibold leading-tight mt-0.5 ${isDark ? "text-emerald-200" : "text-emerald-900"}`}>
                      {pendingReferral.referrerName ? (
                        <>
                          Invited by <span className="font-bold">{pendingReferral.referrerName}</span>, you both get <span className="font-bold">10 Pro searches + 7 days Pro access</span>!
                        </>
                      ) : (
                        <>
                          Invited via <span className="font-mono font-bold">{pendingReferral.code}</span>, you both get <span className="font-bold">10 Pro searches + 7 days Pro access</span>!
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400/80">
                    {pendingReferral.code}
                  </span>
                </div>
              </div>

              {/* Potential Rewards Breakdown */}
              <div className="mt-3.5 pt-3 border-t border-emerald-500/20 space-y-2">
                <div className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Rewards Unlocked Upon Registration:</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col justify-center rounded-xl bg-black/25 border border-emerald-500/20 p-2.5">
                    <div className="text-xs font-bold text-emerald-300">
                      +10 Pro Searches
                    </div>
                    <div className="text-[10px] text-zinc-300 leading-snug mt-0.5">
                      Multi-source synthesis, PubMed & arXiv
                    </div>
                  </div>

                  <div className="flex flex-col justify-center rounded-xl bg-black/25 border border-emerald-500/20 p-2.5">
                    <div className="text-xs font-bold text-emerald-300">
                      +7 Days Pro Access
                    </div>
                    <div className="text-[10px] text-zinc-300 leading-snug mt-0.5">
                      Full study workspace, quizzes & cards
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Note / Mode Switch Hint */}
              {isLoginMode ? (
                <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between gap-2 text-[11px] text-emerald-300/90">
                  <span>New to Kinich? Switch to Create Account to claim.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setResetSuccess(null);
                      setIsLoginMode(false);
                    }}
                    className="font-bold underline text-white hover:text-emerald-200 cursor-pointer shrink-0"
                  >
                    Switch to Create Account →
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-emerald-300/80">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Both you and your referrer receive the full reward package upon signing up!</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="flex w-full flex-col gap-4 opacity-100">
            {error && (
              <div className="text-xs text-red-500 font-medium text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                <div>{error}</div>
              </div>
            )}
            {notice && (
              <div className="text-xs text-amber-400 font-medium text-center bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                <div>{notice}</div>
              </div>
            )}
            {resetSuccess && (
              <div className="text-xs text-emerald-500 font-medium text-center bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                {resetSuccess}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Input
                type="email"
                aria-label="Email address"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`text-xs sm:text-sm ${
                  isDark
                    ? "bg-zinc-900/90 border-zinc-700 text-white placeholder:text-zinc-400"
                    : "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-500"
                }`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Input
                type="password"
                aria-label="Password"
                placeholder="Password (6+ chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className={`text-xs sm:text-sm ${
                  isDark
                    ? "bg-zinc-900/90 border-zinc-700 text-white placeholder:text-zinc-400"
                    : "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-500"
                }`}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading || loading}
                  className={`text-[11px] hover:underline cursor-pointer transition-colors ${
                    isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {resetLoading ? "Sending reset link..." : "Forgot Password?"}
                </button>
              </div>
            </div>

            {/* Unified 18+ Terms, Privacy & Acceptable Use Consent Checkbox */}
            <label
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left text-xs leading-snug cursor-pointer transition-colors ${
                !consentAccepted
                  ? isDark
                    ? "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                    : "border-zinc-300 bg-zinc-50 hover:border-zinc-400"
                  : "border-[#FC4C01]/50 bg-[#FC4C01]/[0.05]"
              }`}
            >
              <input
                ref={checkboxRef}
                data-testid="guest-age-checkbox"
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => {
                  const next = e.target.checked;
                  consentAcceptedRef.current = next;
                  setConsentAccepted(next);
                  if (next) {
                    setError(null);
                  }
                }}
                className="mt-0.5 h-4 w-4 accent-[#FC4C01] rounded cursor-pointer shrink-0"
              />
              <span className={`select-none ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                I confirm I am at least 18 years old and agree to the{" "}
                <a
                  href="/terms"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(
                      new CustomEvent("kinich-navigate-route", { detail: { path: "/terms" } })
                    );
                  }}
                  className={`font-semibold underline transition-colors ${
                    isDark ? "text-white hover:text-[#FC4C01]" : "text-zinc-900 hover:text-[#FC4C01]"
                  }`}
                >
                  Terms of Service
                </a>
                ,{" "}
                <a
                  href="/privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(
                      new CustomEvent("kinich-navigate-route", { detail: { path: "/privacy" } })
                    );
                  }}
                  className={`font-semibold underline transition-colors ${
                    isDark ? "text-white hover:text-[#FC4C01]" : "text-zinc-900 hover:text-[#FC4C01]"
                  }`}
                >
                  Privacy Policy
                </a>
                , and{" "}
                <a
                  href="/acceptable-use"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(
                      new CustomEvent("kinich-navigate-route", { detail: { path: "/acceptable-use" } })
                    );
                  }}
                  className={`font-semibold underline transition-colors ${
                    isDark ? "text-white hover:text-[#FC4C01]" : "text-zinc-900 hover:text-[#FC4C01]"
                  }`}
                >
                  Acceptable Use Policy
                </a>
                .
              </span>
            </label>

            <div className="flex flex-col gap-2.5 pt-1">
              <Button
                type="submit"
                className={`w-full h-10 font-semibold transition-all ${
                  isDark
                    ? "bg-white text-zinc-950 hover:bg-zinc-200"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                } ${
                  !consentAccepted || loading || resetLoading
                    ? "opacity-50"
                    : "cursor-pointer"
                }`}
                disabled={loading || resetLoading}
              >
                {loading
                  ? isLoginMode
                    ? "Signing in..."
                    : "Creating account..."
                  : isLoginMode
                  ? "Sign In"
                  : pendingReferral?.code
                  ? "Claim Rewards & Create Account"
                  : signupText}
              </Button>
              <GoogleSignInButton
                testId="google-continue-btn"
                isDark={isDark}
                disabled={loading || resetLoading}
                className={!consentAccepted ? "opacity-50" : ""}
                label={
                  isLoginMode
                    ? "Continue with Google"
                    : pendingReferral?.code
                    ? "Claim Rewards with Google"
                    : googleText
                }
                beforeSignIn={checkConsentBeforeGoogle}
                onNotice={(msg) => setNotice(msg)}
                onError={(msg) => setError(msg)}
                onSuccess={async (outcome) => {
                  if (outcome.user) {
                    await recordUserLegalConsent(outcome.user.uid, "google_signin");
                    if (onSuccess) onSuccess();
                  }
                }}
              />
              <Button
                data-testid="guest-continue-btn"
                type="button"
                variant="outline"
                className={`w-full h-10 border-dashed transition-all ${
                  isDark
                    ? "border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800/60"
                    : "border-zinc-300 bg-transparent text-zinc-800 hover:bg-zinc-100"
                } ${
                  !consentAccepted || loading || resetLoading || guestLoading
                    ? "opacity-50"
                    : "cursor-pointer"
                }`}
                onClick={() => {
                  if (!isConsentChecked()) {
                    setError("Please confirm you're 18+ and accept the Terms to continue.");
                    return;
                  }
                  setGuestLoading(true);
                  setError(null);
                  UserAccountStore.loginAsGuest();
                  if (onSuccess) onSuccess();
                  void recordUserLegalConsent("guest", "guest_signin_card").catch(() => {});
                  setGuestLoading(false);
                }}
                disabled={loading || resetLoading || guestLoading || !consentAccepted}
              >
                <span className="text-xs sm:text-sm font-medium flex items-center justify-center gap-2">
                  {guestLoading && (
                    <span className="size-3.5 border-2 border-[#FC4C01] border-t-transparent rounded-full animate-spin shrink-0" />
                  )}
                  <span>{guestLoading ? "Entering as guest..." : "Continue as Guest"}</span>
                </span>
              </Button>
              {!consentAccepted && (
                <p
                  data-testid="tick-box-hint"
                  className={`text-[11px] text-center pt-0.5 ${
                    isDark ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  Tick the box above to continue
                </p>
              )}
            </div>
          </form>

          <div
            className={`flex items-center justify-between w-full text-xs pt-2 border-t ${
              isDark ? "border-zinc-800 text-zinc-400" : "border-zinc-200 text-zinc-600"
            }`}
          >
            <span>{isLoginMode ? "Don't have an account?" : loginText}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setResetSuccess(null);
                setIsLoginMode(!isLoginMode);
              }}
              className={`font-bold hover:underline cursor-pointer ${
                isDark ? "text-white" : "text-zinc-900"
              }`}
            >
              {isLoginMode ? "Create an account" : "Sign In"}
            </button>
          </div>

          <div
            className={`w-full pt-2 border-t flex justify-center text-center ${
              isDark ? "border-zinc-800/70" : "border-zinc-200"
            }`}
          >
            <SiteFooter
              compact
              isDark={isDark}
              onNavigate={(path) =>
                window.dispatchEvent(new CustomEvent("kinich-navigate-route", { detail: { path } }))
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export { Signup1 };
