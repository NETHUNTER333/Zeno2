import React, { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { ArrowRight, UserCheck, Sparkles } from "lucide-react";

import { Button } from "./button";
import { Input } from "./input";
import { UserAccountStore } from "../../lib/userAccountStore";

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
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
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
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Incorrect email or password. You can also enter as Guest below.");
      } else if (code === "auth/user-not-found") {
        // If not found in login mode, auto-create account for them
        try {
          await UserAccountStore.signUp(cleanEmail, password);
          if (onSuccess) onSuccess();
          return;
        } catch {
          setError("No account found with this email. Switch to Sign up or enter as Guest.");
        }
      } else if (code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError(err?.message || "Authentication failed. You can continue as Guest below.");
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
    try {
      setLoading(true);
      setError(null);
      setResetSuccess(null);
      const user = await UserAccountStore.signIn();
      if (user && onSuccess) {
        onSuccess();
      } else if (!user) {
        // User cancelled popup or popup closed
        setError("Google sign-in was cancelled or closed. You can continue as Guest below.");
      }
    } catch (err: any) {
      const isPopupBlocked =
        err?.code === "auth/popup-blocked" ||
        /popup/i.test(err?.message || "") ||
        /cross-origin/i.test(err?.message || "");

      if (isPopupBlocked) {
        setError("Browser or preview iframe prevented opening the Google popup. Click 'Continue as Guest' below to enter immediately.");
      } else {
        setError(err?.message || "Google sign in failed. You can continue as Guest below.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = () => {
    UserAccountStore.loginAsGuest();
    if (onSuccess) onSuccess();
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

          {/* Quick Enter as Guest Banner / Button */}
          <div className="w-full">
            <button
              type="button"
              onClick={handleContinueAsGuest}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 transition-all text-xs font-semibold cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <div className="text-left">
                  <div className="text-foreground font-bold">Continue as Guest</div>
                  <div className="text-[11px] text-muted-foreground font-normal">
                    Instant access without signing in
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="relative w-full flex items-center justify-center">
            <div className="border-t border-border w-full absolute" />
            <span className="bg-background px-3 text-[11px] uppercase tracking-wider text-muted-foreground relative z-10">
              Or sign in with account
            </span>
          </div>

          <form onSubmit={handleEmailAuth} className="flex w-full flex-col gap-4">
            {error && (
              <div className="text-xs text-red-500 font-medium text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20 space-y-2">
                <div>{error}</div>
                <button
                  type="button"
                  onClick={handleContinueAsGuest}
                  className="inline-block text-[11px] underline font-bold text-red-400 hover:text-red-300 cursor-pointer"
                >
                  Enter Workspace as Guest now →
                </button>
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
            <div className="flex flex-col gap-2.5 pt-1">
              <Button
                type="submit"
                className="w-full cursor-pointer h-10 font-semibold"
                disabled={loading || resetLoading}
              >
                {loading
                  ? isLoginMode
                    ? "Signing in..."
                    : "Creating account..."
                  : isLoginMode
                  ? "Sign In"
                  : signupText}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer h-10"
                onClick={handleGoogleSignup}
                disabled={loading || resetLoading}
              >
                <FcGoogle className="mr-2 size-5 shrink-0" />
                <span className="text-xs sm:text-sm truncate">
                  {isLoginMode ? "Continue with Google" : googleText}
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
        </div>
      </div>
    </section>
  );
};

export { Signup1 };
