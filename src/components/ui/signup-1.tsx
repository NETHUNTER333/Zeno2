import React, { useState, useEffect, useRef } from "react";
import { Gift, Eye, EyeOff, ArrowRight } from "lucide-react";

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

const DESKTOP_CAPABILITIES = [
  {
    index: "01",
    title: "Instant Camera Snap & Solve",
    description: "Capture or crop any math, physics, or chemistry problem for step-by-step KaTeX derivations.",
  },
  {
    index: "02",
    title: "Interactive Study Space",
    description: "Turn PDFs, YouTube lectures, and notes into summaries, flashcards, quizzes, and visual labs.",
  },
  {
    index: "03",
    title: "Deep Multi-Source Research",
    description: "Synthesize live web sources, arXiv preprints, and citations in one clean workspace.",
  },
  {
    index: "04",
    title: "Hitaishi Live Voice Companion",
    description: "Practice concepts aloud with real-time voice conversation and automatic mic protection.",
  },
];

const Signup1 = ({
  heading = "Create your Kinich account",
  logo = {
    url: "#",
    src: "/assets/aistudio/kinich-icon-1024_544040c6.png",
    alt: "Kinich logo",
    title: "Kinich",
  },
  googleText = "Continue with Google",
  signupText = "Create Account",
  loginText = "Already have an account?",
  isDark = true,
  onSuccess,
}: Signup1Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
  const [pendingReferral, setPendingReferral] = useState<PendingReferralInfo | null>(() =>
    getPendingReferral()
  );
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detectAndVerifyReferral() {
      try {
        setIsValidatingReferral(true);

        let targetCode = "";
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const qRef = urlParams.get("ref");
          if (qRef && qRef.trim()) {
            targetCode = qRef.trim();
          } else {
            const rawRef =
              localStorage.getItem("ref") || localStorage.getItem("kinich_pending_ref_code");
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

        const captured = await captureInboundReferral();
        const codeToValidate = targetCode || captured?.code;

        if (cancelled) return;

        if (codeToValidate) {
          setIsLoginMode(false);
          const res = await apiFetch(
            `/api/referral/validate/${encodeURIComponent(codeToValidate)}`
          );
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

  const switchMode = (nextLoginMode: boolean) => {
    setError(null);
    setResetSuccess(null);
    setNotice(null);
    setIsLoginMode(nextLoginMode);
  };

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
      await recordUserLegalConsent(
        auth.currentUser?.uid,
        isLoginMode ? "email_login" : "email_signup"
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Incorrect email or password.");
      } else if (code === "auth/user-not-found") {
        try {
          await UserAccountStore.signUp(cleanEmail, password);
          await recordUserLegalConsent(auth.currentUser?.uid, "email_signup");
          if (onSuccess) onSuccess();
          return;
        } catch {
          setError("No account found with this email. Switch to Create Account.");
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
      setError("Enter your email address above first to reset your password.");
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
      className={`min-h-[100dvh] w-full flex items-center justify-center p-4 pb-24 sm:p-6 lg:p-10 relative z-40 overflow-y-auto ${
        isDark ? "text-zinc-100" : "text-zinc-900"
      }`}
    >
      <div className="w-full max-w-md lg:max-w-5xl xl:max-w-[1120px] my-auto">
        <div
          className={`w-full rounded-2xl lg:rounded-3xl border overflow-hidden lg:grid lg:grid-cols-12 lg:items-stretch transition-colors ${
            isDark
              ? "bg-[#09090b] border-white/[0.1] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
              : "bg-white border-black/[0.09] shadow-[0_20px_60px_rgba(0,0,0,0.07)]"
          }`}
        >
          {/* Desktop Left Showcase Column (Hidden on mobile so mobile layout stays focused & fast) */}
          <div
            className={`hidden lg:flex lg:col-span-6 flex-col justify-between p-10 xl:p-12 border-r ${
              isDark
                ? "bg-[#0e0e11] border-white/[0.08]"
                : "bg-[#f8f8f9] border-black/[0.07]"
            }`}
          >
            <div className="space-y-8">
              {/* Brand lockup */}
              <a href={logo.url} className="inline-flex items-center gap-3 w-fit">
                <img
                  src={logo.src}
                  alt={logo.alt}
                  title={logo.title}
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-xl object-cover"
                />
                <span className="text-lg font-bold tracking-tight">Kinich</span>
              </a>

              {/* Editorial Display Headline */}
              <div className="space-y-3">
                <h2
                  className={`text-3xl xl:text-[38px] font-bold tracking-[-0.03em] leading-[1.12] [text-wrap:balance] ${
                    isDark ? "text-white" : "text-zinc-950"
                  }`}
                >
                  Research deeper, study faster, solve anything.
                </h2>
                <p
                  className={`text-sm leading-relaxed max-w-md ${
                    isDark ? "text-zinc-400" : "text-zinc-600"
                  }`}
                >
                  One workspace connecting multi-source web search, instant camera problem solving,
                  and interactive STEM study tools across desktop and mobile.
                </p>
              </div>

              {/* Numbered Feature Index separated by crisp hairlines */}
              <div
                className={`divide-y border-t border-b ${
                  isDark
                    ? "divide-white/[0.07] border-white/[0.07]"
                    : "divide-black/[0.07] border-black/[0.07]"
                }`}
              >
                {DESKTOP_CAPABILITIES.map((item) => (
                  <div key={item.index} className="py-3.5 flex items-start gap-4">
                    <span
                      className={`font-mono text-xs tabular-nums pt-0.5 shrink-0 ${
                        isDark ? "text-zinc-500" : "text-zinc-400"
                      }`}
                    >
                      {item.index}.
                    </span>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold tracking-tight ${
                          isDark ? "text-zinc-100" : "text-zinc-900"
                        }`}
                      >
                        {item.title}
                      </div>
                      <p
                        className={`text-xs leading-relaxed mt-0.5 ${
                          isDark ? "text-zinc-400" : "text-zinc-600"
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`pt-6 text-xs flex items-center gap-2 ${
                isDark ? "text-zinc-500" : "text-zinc-500"
              }`}
            >
              <span>Web</span>
              <span aria-hidden="true">·</span>
              <span>Android</span>
              <span aria-hidden="true">·</span>
              <span>iOS Synced History</span>
            </div>
          </div>

          {/* Auth Column (Full width on mobile/tablet, right 6 cols on desktop) */}
          <div className="w-full lg:col-span-6 flex flex-col justify-between px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10 xl:px-12">
            <div className="w-full max-w-md mx-auto flex flex-col gap-5">
              {/* Mobile Logo & Heading (Desktop keeps compact heading since left panel has brand) */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-2">
                <a
                  href={logo.url}
                  className="flex lg:hidden items-center justify-center mb-1"
                >
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    title={logo.title}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-2xl object-cover"
                  />
                </a>
                <h1
                  className={`text-2xl sm:text-[26px] font-bold tracking-[-0.025em] leading-tight [text-wrap:balance] ${
                    isDark ? "text-white" : "text-zinc-950"
                  }`}
                >
                  {isLoginMode ? "Welcome back" : heading}
                </h1>
                <p
                  className={`text-xs sm:text-[13px] leading-relaxed ${
                    isDark ? "text-zinc-400" : "text-zinc-600"
                  }`}
                >
                  {isLoginMode
                    ? "Sign in to sync your threads, study spaces, and snap solutions."
                    : "Start researching, solving problems, and building study packs."}
                </p>
              </div>

              {/* Clean Segmented Mode Switcher */}
              <div
                role="tablist"
                aria-label="Authentication mode"
                className={`grid grid-cols-2 p-1 rounded-xl border ${
                  isDark
                    ? "bg-zinc-900/70 border-white/[0.08]"
                    : "bg-zinc-100 border-black/[0.06]"
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isLoginMode}
                  onClick={() => switchMode(true)}
                  className={`h-9 rounded-lg text-xs sm:text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isLoginMode
                      ? isDark
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "bg-white text-zinc-950 shadow-xs"
                      : isDark
                      ? "text-zinc-400 hover:text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isLoginMode}
                  onClick={() => switchMode(false)}
                  className={`h-9 rounded-lg text-xs sm:text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    !isLoginMode
                      ? isDark
                        ? "bg-white text-zinc-950 shadow-xs"
                        : "bg-white text-zinc-950 shadow-xs"
                      : isDark
                      ? "text-zinc-400 hover:text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Promotional Referral Pass (Clean unboxed metadata, no pill clutter) */}
              {pendingReferral?.code && (
                <div
                  className={`w-full rounded-xl border p-3.5 text-left space-y-2.5 ${
                    isDark
                      ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                      : "border-emerald-600/25 bg-emerald-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Gift
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          isDark ? "text-emerald-400" : "text-emerald-700"
                        }`}
                      />
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-semibold leading-snug ${
                            isDark ? "text-emerald-200" : "text-emerald-950"
                          }`}
                        >
                          {pendingReferral.referrerName ? (
                            <>
                              Invited by <span className="font-bold">{pendingReferral.referrerName}</span>
                            </>
                          ) : (
                            <>
                              Invite code <span className="font-mono font-bold">{pendingReferral.code}</span>
                            </>
                          )}
                        </div>
                        <div
                          className={`text-[11px] mt-0.5 ${
                            isDark ? "text-emerald-300/80" : "text-emerald-800"
                          }`}
                        >
                          10 Pro searches · 7 days Pro access unlocked on signup
                          {isValidatingReferral ? " · verifying..." : ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isLoginMode && (
                    <button
                      type="button"
                      onClick={() => switchMode(false)}
                      className={`text-[11px] font-semibold inline-flex items-center gap-1 underline underline-offset-2 cursor-pointer ${
                        isDark
                          ? "text-emerald-200 hover:text-white"
                          : "text-emerald-900 hover:text-black"
                      }`}
                    >
                      <span>Switch to Create Account to claim</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Auth Form */}
              <form onSubmit={handleEmailAuth} className="flex w-full flex-col gap-3.5">
                {error && (
                  <div
                    role="alert"
                    className={`text-xs font-medium px-3.5 py-2.5 rounded-xl border ${
                      isDark
                        ? "text-red-300 bg-red-500/10 border-red-500/25"
                        : "text-red-700 bg-red-50 border-red-200"
                    }`}
                  >
                    {error}
                  </div>
                )}
                {notice && (
                  <div
                    role="status"
                    className={`text-xs font-medium px-3.5 py-2.5 rounded-xl border ${
                      isDark
                        ? "text-amber-300 bg-amber-500/10 border-amber-500/25"
                        : "text-amber-800 bg-amber-50 border-amber-200"
                    }`}
                  >
                    {notice}
                  </div>
                )}
                {resetSuccess && (
                  <div
                    role="status"
                    className={`text-xs font-medium px-3.5 py-2.5 rounded-xl border ${
                      isDark
                        ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25"
                        : "text-emerald-800 bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    {resetSuccess}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="kinich-auth-email"
                    className={`block text-xs font-medium ${
                      isDark ? "text-zinc-300" : "text-zinc-700"
                    }`}
                  >
                    Email address
                  </label>
                  <Input
                    id="kinich-auth-email"
                    type="email"
                    autoComplete="email"
                    aria-label="Email address"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={`h-11 rounded-xl text-sm ${
                      isDark
                        ? "bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-500 focus-visible:border-zinc-500"
                        : "bg-white border-zinc-300 text-zinc-950 placeholder:text-zinc-400 focus-visible:border-zinc-500"
                    }`}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="kinich-auth-password"
                      className={`block text-xs font-medium ${
                        isDark ? "text-zinc-300" : "text-zinc-700"
                      }`}
                    >
                      Password
                    </label>
                    {isLoginMode && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={resetLoading || loading}
                        className={`text-[11px] font-medium hover:underline cursor-pointer transition-colors ${
                          isDark
                            ? "text-zinc-400 hover:text-white"
                            : "text-zinc-600 hover:text-zinc-950"
                        }`}
                      >
                        {resetLoading ? "Sending reset link..." : "Forgot password?"}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="kinich-auth-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={isLoginMode ? "current-password" : "new-password"}
                      aria-label="Password"
                      placeholder="6+ characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                      className={`h-11 rounded-xl pr-11 text-sm ${
                        isDark
                          ? "bg-zinc-900/90 border-zinc-800 text-white placeholder:text-zinc-500 focus-visible:border-zinc-500"
                          : "bg-white border-zinc-300 text-zinc-950 placeholder:text-zinc-400 focus-visible:border-zinc-500"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className={`absolute right-1.5 top-1/2 -translate-y-1/2 size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        isDark
                          ? "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                          : "text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.05]"
                      }`}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Unified 18+ Terms, Privacy & Acceptable Use Consent Checkbox */}
                <label
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left text-xs leading-snug cursor-pointer transition-colors ${
                    !consentAccepted
                      ? isDark
                        ? "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                        : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
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
                      className={`font-semibold underline underline-offset-2 transition-colors ${
                        isDark
                          ? "text-white hover:text-[#FC4C01]"
                          : "text-zinc-950 hover:text-[#FC4C01]"
                      }`}
                    >
                      Terms
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
                      className={`font-semibold underline underline-offset-2 transition-colors ${
                        isDark
                          ? "text-white hover:text-[#FC4C01]"
                          : "text-zinc-950 hover:text-[#FC4C01]"
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
                          new CustomEvent("kinich-navigate-route", {
                            detail: { path: "/acceptable-use" },
                          })
                        );
                      }}
                      className={`font-semibold underline underline-offset-2 transition-colors ${
                        isDark
                          ? "text-white hover:text-[#FC4C01]"
                          : "text-zinc-950 hover:text-[#FC4C01]"
                      }`}
                    >
                      Acceptable Use
                    </a>
                    .
                  </span>
                </label>

                <Button
                  type="submit"
                  className={`w-full h-11 rounded-xl font-semibold text-sm transition-all ${
                    isDark
                      ? "bg-white text-zinc-950 hover:bg-zinc-200"
                      : "bg-zinc-950 text-white hover:bg-zinc-800"
                  } ${
                    !consentAccepted || loading || resetLoading
                      ? "opacity-55"
                      : "cursor-pointer active:scale-[0.99]"
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

                {/* Clean Hairline Divider */}
                <div className="flex items-center gap-3 py-0.5">
                  <div
                    className={`h-px flex-1 ${
                      isDark ? "bg-white/[0.08]" : "bg-black/[0.08]"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium ${
                      isDark ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    or
                  </span>
                  <div
                    className={`h-px flex-1 ${
                      isDark ? "bg-white/[0.08]" : "bg-black/[0.08]"
                    }`}
                  />
                </div>

                {/* Secondary Providers */}
                <div className="flex flex-col gap-2.5">
                  <GoogleSignInButton
                    testId="google-continue-btn"
                    isDark={isDark}
                    disabled={loading || resetLoading}
                    className={`h-11 rounded-xl ${!consentAccepted ? "opacity-55" : ""}`}
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
                    className={`w-full h-11 rounded-xl transition-all ${
                      isDark
                        ? "border-zinc-800 bg-transparent text-zinc-200 hover:bg-white/[0.05] hover:border-zinc-700"
                        : "border-zinc-300 bg-transparent text-zinc-800 hover:bg-zinc-100"
                    } ${
                      !consentAccepted || loading || resetLoading || guestLoading
                        ? "opacity-55"
                        : "cursor-pointer active:scale-[0.99]"
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
                      className={`text-[11px] text-center ${
                        isDark ? "text-zinc-500" : "text-zinc-500"
                      }`}
                    >
                      Tick the 18+ agreement above to continue
                    </p>
                  )}
                </div>
              </form>

              <div
                className={`flex items-center justify-between w-full text-xs pt-3 border-t ${
                  isDark ? "border-white/[0.08] text-zinc-400" : "border-black/[0.07] text-zinc-600"
                }`}
              >
                <span>{isLoginMode ? "New to Kinich?" : loginText}</span>
                <button
                  type="button"
                  onClick={() => switchMode(!isLoginMode)}
                  className={`font-semibold hover:underline cursor-pointer ${
                    isDark ? "text-white" : "text-zinc-950"
                  }`}
                >
                  {isLoginMode ? "Create an account" : "Sign In"}
                </button>
              </div>
            </div>

            <div
              className={`w-full max-w-md mx-auto mt-5 pt-3 border-t flex justify-center text-center ${
                isDark ? "border-white/[0.06]" : "border-black/[0.06]"
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
      </div>
    </section>
  );
};

export { Signup1 };
