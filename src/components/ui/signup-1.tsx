import React, { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { Gift, CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";

import { Button } from "./button";
import { Input } from "./input";
import { UserAccountStore } from "../../lib/userAccountStore";
import {
  getPendingReferral,
  captureInboundReferral,
  PendingReferralInfo,
} from "../../lib/referralClient";
import { apiFetch } from "../../lib/apiBase";
import { auth } from "../../lib/firebase";
import { recordUserLegalConsent, SiteFooter } from "../LegalAndInfoPages";
import { MIN_AGE } from "../../legal/config";

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
  onSuccess?: () => void;
}

const Signup1 = ({
  heading = "Welcome to Zeno",
  logo = {
    url: "#",
    src: "/zeno-icon.svg",
    alt: "Zeno logo",
    title: "Zeno",
  },
  googleText = "Sign in with Google",
  signupText = "Create an account",
  loginText = "Already have an account?",
  loginUrl = "#",
  onSuccess,
}: Signup1Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
            const rawRef = localStorage.getItem("ref") || localStorage.getItem("zeno_pending_ref_code");
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return;
    if (!consentAccepted) {
      setError(
        `Please confirm you are 18 or older and agree to the Terms, Privacy Policy, and Acceptable Use Policy.`
      );
      return;
    }
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

  const handleGoogleSignup = async () => {
    if (!consentAccepted) {
      setError(
        `Please check the box below to confirm you are 18 or older and agree to the Terms, Privacy Policy, and Acceptable Use Policy.`
      );
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setResetSuccess(null);
      const user = await UserAccountStore.signIn();
      if (user) {
        await recordUserLegalConsent(user.uid, "google_signin");
        if (onSuccess) onSuccess();
      } else {
        setError("Google sign-in was cancelled or closed.");
      }
    } catch (err: any) {
      const isPopupBlocked =
        err?.code === "auth/popup-blocked" ||
        /popup/i.test(err?.message || "") ||
        /cross-origin/i.test(err?.message || "");

      if (isPopupBlocked) {
        setError("Browser prevented opening the Google popup. Please sign in with email and password.");
      } else {
        setError(err?.message || "Google sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-muted h-screen w-full flex items-center justify-center p-4">
      <div className="flex h-full items-center justify-center w-full">
        <div className="border-muted bg-background flex w-full max-w-md flex-col items-center gap-y-6 rounded-2xl border px-6 sm:px-8 py-8 sm:py-10 shadow-xl">
          <div className="flex flex-col items-center gap-y-2 text-center">
            {/* Logo */}
            <div className="flex items-center justify-center mb-1">
              <a href={logo.url} className="flex items-center justify-center">
                <img
                  src={logo.src}
                  alt={logo.alt}
                  title={logo.title}
                  className="h-14 w-14 dark:invert drop-shadow-sm"
                />
              </a>
            </div>
            {heading && (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {isLoginMode ? "Welcome back to Zeno" : heading}
              </h1>
            )}
            <p className="text-xs text-muted-foreground max-w-xs">
              AI-powered web search, agent tools, and YouTube study workspace.
            </p>
          </div>

          {/* Promotional Referral Banner */}
          {pendingReferral?.code && (
            <div className="w-full rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.14] via-emerald-500/[0.06] to-teal-500/[0.10] p-4 text-left shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
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
                        <span className="text-[10px] text-emerald-400/70 animate-pulse">
                          (verifying...)
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-emerald-200 leading-tight mt-0.5">
                      {pendingReferral.referrerName ? (
                        <>
                          Invited by <span className="text-white font-bold">{pendingReferral.referrerName}</span>, you both get <span className="text-white font-bold">10 Pro searches + 7 days Pro access</span>!
                        </>
                      ) : (
                        <>
                          Invited via <span className="font-mono text-white font-bold">{pendingReferral.code}</span>, you both get <span className="text-white font-bold">10 Pro searches + 7 days Pro access</span>!
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/40">
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
                <div className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Rewards Unlocked Upon Registration:</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col justify-center rounded-xl bg-black/30 border border-emerald-500/20 p-2.5">
                    <div className="text-xs font-bold text-emerald-300">
                      +10 Pro Searches
                    </div>
                    <div className="text-[10px] text-neutral-400 leading-snug mt-0.5">
                      Multi-source synthesis, PubMed & arXiv
                    </div>
                  </div>

                  <div className="flex flex-col justify-center rounded-xl bg-black/30 border border-emerald-500/20 p-2.5">
                    <div className="text-xs font-bold text-emerald-300">
                      +7 Days Pro Access
                    </div>
                    <div className="text-[10px] text-neutral-400 leading-snug mt-0.5">
                      Full study workspace, quizzes & cards
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Note / Mode Switch Hint */}
              {isLoginMode ? (
                <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between gap-2 text-[11px] text-emerald-300/90">
                  <span>New to Zeno? Switch to Create Account to claim.</span>
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

          <form onSubmit={handleEmailAuth} className="flex w-full flex-col gap-4">
            {error && (
              <div className="text-xs text-red-500 font-medium text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                <div>{error}</div>
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
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-xs sm:text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Input
                type="password"
                placeholder="Password (6+ chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="text-xs sm:text-sm"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading || loading}
                  className="text-[11px] text-muted-foreground hover:text-primary hover:underline cursor-pointer transition-colors"
                >
                  {resetLoading ? "Sending reset link..." : "Forgot Password?"}
                </button>
              </div>
            </div>

            {/* Clean, Non-AI-Slop Terms & Policies Consent Checkbox */}
            <label
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left text-xs leading-snug cursor-pointer transition-all ${
                !consentAccepted
                  ? "border-border/80 bg-neutral-500/[0.03] hover:border-border"
                  : "border-primary/40 bg-primary/[0.03]"
              }`}
            >
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => {
                  setConsentAccepted(e.target.checked);
                  if (e.target.checked) {
                    setError(null);
                  }
                }}
                className="mt-0.5 h-4 w-4 accent-[#FC4C01] rounded cursor-pointer shrink-0"
              />
              <span className="text-muted-foreground select-none">
                By logging in or signing up, you confirm you are 18+ and accept our{" "}
                <a
                  href="/terms"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(
                      new CustomEvent("zeno-navigate-route", { detail: { path: "/terms" } })
                    );
                  }}
                  className="text-foreground font-semibold underline hover:text-primary transition-colors"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(
                      new CustomEvent("zeno-navigate-route", { detail: { path: "/privacy" } })
                    );
                  }}
                  className="text-foreground font-semibold underline hover:text-primary transition-colors"
                >
                  Policies
                </a>
                .
              </span>
            </label>

            <div className="flex flex-col gap-2.5 pt-1">
              <Button
                type="submit"
                className={`w-full h-10 font-semibold transition-all ${
                  !consentAccepted || loading || resetLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:opacity-90"
                }`}
                disabled={loading || resetLoading || !consentAccepted}
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
              <Button
                type="button"
                variant="outline"
                className={`w-full h-10 transition-all ${
                  !consentAccepted || loading || resetLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
                onClick={handleGoogleSignup}
                disabled={loading || resetLoading || !consentAccepted}
              >
                <FcGoogle className="mr-2 size-5 shrink-0" />
                <span className="text-xs sm:text-sm truncate">
                  {isLoginMode
                    ? "Continue with Google"
                    : pendingReferral?.code
                    ? "Claim Rewards with Google"
                    : googleText}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className={`w-full h-10 border-dashed transition-all ${
                  !consentAccepted || loading || resetLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
                onClick={async () => {
                  if (!consentAccepted) {
                    setError("Please tick the box above to accept the Terms and Policies before proceeding.");
                    return;
                  }
                  await recordUserLegalConsent(undefined, "guest_signin_card");
                  UserAccountStore.loginAsGuest();
                  if (onSuccess) onSuccess();
                }}
                disabled={loading || resetLoading || !consentAccepted}
              >
                <span className="text-xs sm:text-sm font-medium">
                  Continue as Guest
                </span>
              </Button>
            </div>
          </form>

          <div className="text-muted-foreground flex items-center justify-between w-full text-xs pt-1 border-t border-border">
            <span>{isLoginMode ? "Don't have an account?" : loginText}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setResetSuccess(null);
                setIsLoginMode(!isLoginMode);
              }}
              className="text-primary font-bold hover:underline cursor-pointer"
            >
              {isLoginMode ? "Create an account" : "Sign In"}
            </button>
          </div>

          <div className="w-full pt-2 border-t border-border/50 flex justify-center text-center">
            <SiteFooter
              compact
              isDark
              onNavigate={(path) =>
                window.dispatchEvent(new CustomEvent("zeno-navigate-route", { detail: { path } }))
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export { Signup1 };
