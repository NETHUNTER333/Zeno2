import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  X,
  Zap,
  Flame,
  ShieldCheck,
  UploadCloud,
  MessageSquare,
  Globe,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { UserAccountStore, PLAN_LIMITS } from '../lib/userAccountStore';
import { UsageQuota } from '../types';

export interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHighlightPlan?: 'free' | 'spark' | 'fire';
  limitReason?: string | null;
  isDark?: boolean;
  embedded?: boolean;
}

interface PlanFeatureRow {
  text: string;
  included: boolean;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  initialHighlightPlan,
  limitReason,
  isDark = true,
  embedded = false,
}) => {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<'free' | 'spark' | 'fire'>(() =>
    UserAccountStore.getNormalizedPlan()
  );
  const [usage, setUsage] = useState<UsageQuota>(() => UserAccountStore.getUsage());
  const [activeCardIndex, setActiveCardIndex] = useState<number>(1);
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(null);

  useEffect(() => {
    if (initialHighlightPlan === 'free') setActiveCardIndex(0);
    else if (initialHighlightPlan === 'spark') setActiveCardIndex(1);
    else if (initialHighlightPlan === 'fire') setActiveCardIndex(2);
  }, [initialHighlightPlan]);

  useEffect(() => {
    UserAccountStore.syncQuotaWithServerAndFirestore();
    const sync = () => {
      setCurrentPlan(UserAccountStore.getNormalizedPlan());
      setUsage(UserAccountStore.getUsage());
    };
    window.addEventListener('zeno-account-updated', sync);
    return () => window.removeEventListener('zeno-account-updated', sync);
  }, []);

  if (!isOpen && !embedded) return null;

  const handleSelectPlan = (targetPlan: 'free' | 'spark' | 'fire') => {
    UserAccountStore.upgradePlan(
      targetPlan,
      billingCycle === 'annual' ? 'yearly' : 'monthly'
    );
    setCurrentPlan(targetPlan);
    setUsage(UserAccountStore.getUsage());
    const label =
      targetPlan === 'free'
        ? 'Core Basic ($0/mo)'
        : targetPlan === 'spark'
        ? 'Spark ($1/mo)'
        : 'Fire ($5/mo)';
    setUpgradeBanner(`Switched active plan to ${label}. Your limits and models are now updated.`);
    setTimeout(() => setUpgradeBanner(null), 4000);
  };

  const freeFeatures: PlanFeatureRow[] = [
    { text: '3 File Uploads limit (PDF, image & code)', included: true },
    { text: '15 Daily AI Prompts & 50K token quota', included: true },
    { text: '5 Real-Time Web Searches per day', included: true },
    { text: '1 Deep Research & 2 PDF Study runs/day', included: true },
    { text: 'Spark Models (Claude 4.6 Sonnet, GPT-6 Luna)', included: false },
    { text: 'Extended File Uploads (25/day on Spark)', included: false },
    { text: 'Fire Flagship Models (Opus 5.5, GPT-6.1 Sol)', included: false },
    { text: 'Unlimited Uploads, Prompts & Deep Search', included: false },
    { text: 'Priority Zero-Queue Inference & 2M Context', included: false },
  ];

  const sparkFeatures: PlanFeatureRow[] = [
    { text: '25 File Uploads / day (up to 10 per prompt)', included: true },
    { text: '150 Daily AI Prompts & 1M token quota', included: true },
    { text: '75 Real-Time Web & News Searches / day', included: true },
    { text: '10 Deep Research & 20 PDF Study runs/day', included: true },
    { text: 'Spark Models (Claude 4.6, GPT-6 Luna, Kimi K3)', included: true },
    { text: '100 Knowledge Vault Saves & Share Cards', included: true },
    { text: 'Fire Flagship Models (Opus 5.5, GPT-6.1 Sol)', included: false },
    { text: 'Unlimited Uploads, Prompts & Deep Search', included: false },
    { text: 'Priority Zero-Queue Inference & 2M Context', included: false },
  ];

  const fireFeatures: PlanFeatureRow[] = [
    { text: 'Unlimited File Uploads (all formats & sizes)', included: true },
    { text: 'Unlimited Daily Prompts & 25M+ token capacity', included: true },
    { text: 'Unlimited Real-Time Web, News & ArXiv Search', included: true },
    { text: 'Unlimited Deep Research & PDF Quiz Studio', included: true },
    { text: 'All Spark Models (Claude 4.6, GPT-6 Luna, Kimi K3)', included: true },
    { text: 'Unlimited Knowledge Vault & Cloud Sync', included: true },
    { text: 'Fire Flagship Models (Claude Opus 5.5, GPT-6.1 Sol)', included: true },
    { text: 'Gemini 4 Argon Pro, DeepSeek V4 Pro Max & 2.4T MoE', included: true },
    { text: 'Priority Zero-Queue Inference & 2M Code Context', included: true },
  ];

  const formatQuotaVal = (used: number, limit: number) => {
    if (limit >= 999999) return `${used} / Unlimited`;
    return `${used} / ${limit}`;
  };

  const innerContent = (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Top Bar: Back button on left, Annual / Monthly pill toggle on right */}
      <div className="flex items-center justify-between gap-4 mb-6">
        {!embedded ? (
          <button
            type="button"
            onClick={onClose}
            className={`size-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                : 'bg-white hover:bg-neutral-100 border-black/10 text-[#18181b] shadow-2xs'
            }`}
            title="Return to workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
              Subscription & Usage Quotas
            </span>
          </div>
        )}

        {/* Segmented Annual | Monthly Pill Toggle */}
        <div
          className={`inline-flex items-center p-1 rounded-full border ${
            isDark
              ? 'bg-[#18181b] border-white/15'
              : 'bg-white border-black/10 shadow-2xs'
          }`}
        >
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              billingCycle === 'annual'
                ? isDark
                  ? 'bg-white text-black shadow-xs'
                  : 'bg-[#18181b] text-white shadow-xs'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Annual
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              billingCycle === 'monthly'
                ? isDark
                  ? 'bg-white text-black shadow-xs'
                  : 'bg-[#18181b] text-white shadow-xs'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Pricing Title Row + Step Indicator Dashes */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Pricing</h1>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Unlock higher file upload limits, autonomous research, and frontier Spark ($1) & Fire ($5) models.
          </p>
        </div>

        {/* 3-Dash Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveCardIndex(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeCardIndex === idx
                  ? isDark
                    ? 'bg-white w-6'
                    : 'bg-[#18181b] w-6'
                  : isDark
                  ? 'bg-white/25 hover:bg-white/40 w-4'
                  : 'bg-[#18181b]/25 hover:bg-[#18181b]/50 w-4'
              }`}
              aria-label={`Highlight plan ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Limit Reached or Model Locked Alert Banner — Padded, Clean White/Monochrome, No Spark Icon or Yellow Text */}
      {limitReason && (
        <div
          className={`mb-6 p-5 sm:p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
            isDark
              ? 'bg-[#141418] border-white/15 text-white'
              : 'bg-white border-black/10 text-[#18181b]'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-semibold leading-relaxed">
              {limitReason}
            </div>
            <div className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Select Spark ($1) or Fire ($5) below to unlock immediately.
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Confirmation Banner */}
      {upgradeBanner && (
        <div
          className={`mb-6 p-5 rounded-3xl border flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm font-medium shadow-sm ${
            isDark
              ? 'bg-white text-black border-white'
              : 'bg-[#18181b] text-white border-[#18181b]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 shrink-0" />
            <span>{upgradeBanner}</span>
          </div>
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-1.5 rounded-full font-semibold text-xs cursor-pointer transition-opacity hover:opacity-90 ${
                isDark ? 'bg-black text-white' : 'bg-white text-black'
              }`}
            >
              Continue to Chat
            </button>
          )}
        </div>
      )}

      {/* Live Usage Limits Strip ("Chances Left") — Clean Padded White/Monochrome UI */}
      <div
        className={`mb-8 p-5 sm:p-6 rounded-3xl border shadow-sm ${
          isDark ? 'bg-[#141418] border-white/12 text-white' : 'bg-white border-black/10 text-[#18181b]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Active Plan & Daily Allowance
            </span>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                isDark
                  ? 'bg-white/10 text-white border-white/15'
                  : 'bg-[#f4f4f5] text-[#18181b] border-black/10'
              }`}
            >
              {PLAN_LIMITS[currentPlan].name} (
              {currentPlan === 'free' ? '$0/mo' : currentPlan === 'spark' ? '$1/mo' : '$5/mo'})
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full border ${
              isDark
                ? 'border-white/15 bg-white/[0.04] text-neutral-300'
                : 'border-black/10 bg-[#fafafa] text-neutral-700'
            }`}
            title="Enforced server-side & in Firestore per authenticated account"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Server-Verified · Resets 00:00 UTC</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            {
              label: 'File Uploads',
              used: usage.filesUploaded,
              limit: usage.fileUploadLimit,
            },
            {
              label: 'Daily Prompts',
              used: usage.messagesUsed,
              limit: usage.messageLimit,
            },
            {
              label: 'Web Searches',
              used: usage.searchesUsed,
              limit: usage.searchLimit,
            },
            {
              label: 'Deep Research',
              used: usage.deepResearchUsed,
              limit: usage.deepResearchLimit,
            },
            {
              label: 'PDF Studio',
              used: usage.pdfStudyUsed,
              limit: usage.pdfStudyLimit,
            },
          ].map((stat) => {
            const isUnlimited = stat.limit >= 999999;
            const pct = isUnlimited
              ? 12
              : Math.min(100, Math.round((stat.used / Math.max(1, stat.limit)) * 100));
            return (
              <div
                key={stat.label}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isDark
                    ? 'border-white/10 bg-white/[0.04]'
                    : 'border-black/10 bg-[#fafafa]'
                }`}
              >
                <div className={`text-[11px] font-medium mb-1.5 truncate ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {stat.label}
                </div>
                <div className="font-mono text-xs sm:text-sm font-semibold tabular-nums">
                  {formatQuotaVal(stat.used, stat.limit)}
                </div>
                <div
                  className={`w-full h-1.5 rounded-full mt-2.5 overflow-hidden ${
                    isDark ? 'bg-white/10' : 'bg-black/10'
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      isDark ? 'bg-white' : 'bg-[#18181b]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3 Clean Padded Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* ==================== CARD 1: CORE BASIC ($0) ==================== */}
        <div
          onClick={() => setActiveCardIndex(0)}
          className={`relative rounded-[28px] p-6 sm:p-7 flex flex-col justify-between transition-all border bg-white text-[#18181b] shadow-lg ${
            currentPlan === 'free'
              ? 'border-[#18181b] ring-2 ring-[#18181b]/15'
              : 'border-black/10'
          }`}
        >
          {/* Top-Right Status Pill */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#18181b]">Core Basic</h2>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4f4f5] border border-black/10 text-[11px] font-semibold text-[#18181b]">
              <span>{currentPlan === 'free' ? 'Active' : 'Starter'}</span>
              <span className="size-1.5 rounded-full bg-[#18181b]" />
            </div>
          </div>

          <div>
            {/* Price Block */}
            <div className="flex items-baseline gap-2.5 mt-1 mb-3">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-[#18181b]">
                $0
              </span>
              <div className="text-[11px] leading-tight text-[#52525b]">
                <div>/ month (USD)</div>
                <div>Free forever</div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#52525b] mb-5">
              Get started with essential AI tools, web search, and up to 3 file uploads per day for fundamental tasks.
            </p>

            {/* Dotted Separator */}
            <div className="border-b border-dashed border-black/15 mb-5" />

            {/* Feature Checklist */}
            <ul className="space-y-3 mb-7">
              {freeFeatures.map((feat, i) => (
                <li key={i} className="flex items-center gap-3 text-xs">
                  {feat.included ? (
                    <span className="size-5 rounded-full bg-[#18181b] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </span>
                  ) : (
                    <span className="size-5 flex items-center justify-center text-[#a1a1aa] shrink-0">
                      <X className="w-3.5 h-3.5 stroke-[2]" />
                    </span>
                  )}
                  <span
                    className={
                      feat.included
                        ? 'font-medium text-[#18181b]'
                        : 'text-[#71717a]'
                    }
                  >
                    {feat.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom Pill Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan('free');
              }}
              disabled={currentPlan === 'free'}
              className={`w-full max-w-[220px] py-3 px-6 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                currentPlan === 'free'
                  ? 'bg-[#f4f4f5] text-[#52525b] border border-black/10 cursor-default'
                  : 'bg-white hover:bg-[#18181b] text-[#18181b] hover:text-white border border-black/15'
              }`}
            >
              {currentPlan === 'free' ? 'Active Plan' : 'Switch to Basic'}
            </button>
          </div>
        </div>

        {/* ==================== CARD 2: SPARK PLAN ($1 USD) ==================== */}
        <div
          onClick={() => setActiveCardIndex(1)}
          className={`relative rounded-[28px] p-6 sm:p-7 flex flex-col justify-between transition-all border-[2px] bg-[#18181b] text-white shadow-2xl ${
            currentPlan === 'spark'
              ? 'border-white ring-4 ring-white/15'
              : 'border-white/20'
          }`}
        >
          {/* Top-Right Status Badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Spark</h2>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#18181b] text-[11px] font-bold">
              <span>{currentPlan === 'spark' ? 'Active' : 'Save 50%'}</span>
              <span className="size-1.5 rounded-full bg-[#18181b]" />
            </div>
          </div>

          <div>
            {/* Price Block */}
            <div className="flex items-baseline gap-2.5 mt-1 mb-3">
              <span className="text-3xl sm:text-4xl font-semibold text-neutral-500 line-through decoration-2 tabular-nums">
                $2
              </span>
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
                {billingCycle === 'annual' ? '$0.80' : '$1'}
              </span>
              <div className="text-[11px] leading-tight text-neutral-300">
                <div>/ month (USD)</div>
                <div>{billingCycle === 'annual' ? '$10 billed yearly' : '$12 billed yearly'}</div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-neutral-300 mb-5">
              A comprehensive solution for daily learners and researchers—unlocking 25 file uploads/day and Spark Pro AI models.
            </p>

            {/* Separator */}
            <div className="border-b border-dashed border-white/20 mb-5" />

            {/* Feature Checklist */}
            <ul className="space-y-3 mb-7">
              {sparkFeatures.map((feat, i) => (
                <li key={i} className="flex items-center gap-3 text-xs">
                  {feat.included ? (
                    <span className="size-5 rounded-full bg-white text-[#18181b] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </span>
                  ) : (
                    <span className="size-5 flex items-center justify-center text-neutral-500 shrink-0">
                      <X className="w-3.5 h-3.5 stroke-[2]" />
                    </span>
                  )}
                  <span
                    className={
                      feat.included
                        ? 'font-medium text-white'
                        : 'text-neutral-500'
                    }
                  >
                    {feat.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom White Pill CTA Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan('spark');
              }}
              disabled={currentPlan === 'spark'}
              className={`w-full max-w-[230px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer shadow-lg ${
                currentPlan === 'spark'
                  ? 'bg-white/20 text-white border border-white/20 cursor-default'
                  : 'bg-white hover:bg-neutral-200 text-[#18181b] active:scale-95'
              }`}
            >
              {currentPlan === 'spark' ? 'Active Spark Plan' : 'Start Spark — $1/mo'}
            </button>
          </div>
        </div>

        {/* ==================== CARD 3: FIRE PLAN ($5 USD) ==================== */}
        <div
          onClick={() => setActiveCardIndex(2)}
          className={`relative rounded-[28px] p-6 sm:p-7 flex flex-col justify-between transition-all border bg-white text-[#18181b] shadow-lg ${
            currentPlan === 'fire'
              ? 'border-[#18181b] ring-2 ring-[#18181b]/15'
              : 'border-black/10'
          }`}
        >
          {/* Top-Right Popular Badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#18181b]">Fire</h2>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4f4f5] border border-black/10 text-[11px] font-bold text-[#18181b]">
              <span>{currentPlan === 'fire' ? 'Active' : 'Popular'}</span>
              <span className="size-1.5 rounded-full bg-[#18181b]" />
            </div>
          </div>

          <div>
            {/* Price Block */}
            <div className="flex items-baseline gap-2.5 mt-1 mb-3">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-[#18181b]">
                {billingCycle === 'annual' ? '$4' : '$5'}
              </span>
              <div className="text-[11px] leading-tight text-[#52525b]">
                <div>/ month (USD)</div>
                <div>{billingCycle === 'annual' ? '$48 billed yearly' : '$60 billed yearly'}</div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#52525b] mb-5">
              Maximize research performance with unlimited file uploads, all flagship Opus & Astra models, and full customization.
            </p>

            {/* Separator */}
            <div className="border-b border-dashed border-black/15 mb-5" />

            {/* All 9 Feature Rows Checked */}
            <ul className="space-y-3 mb-7">
              {fireFeatures.map((feat, i) => (
                <li key={i} className="flex items-center gap-3 text-xs">
                  <span className="size-5 rounded-full bg-[#18181b] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </span>
                  <span className="font-medium text-[#18181b]">{feat.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom Pill CTA Button */}
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan('fire');
              }}
              disabled={currentPlan === 'fire'}
              className={`w-full max-w-[230px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${
                currentPlan === 'fire'
                  ? 'bg-[#18181b] text-white cursor-default'
                  : 'bg-[#18181b] hover:bg-neutral-800 text-white active:scale-95'
              }`}
            >
              {currentPlan === 'fire' ? 'Active Fire Plan' : 'Start Fire — $5/mo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return innerContent;
  }

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-[100dvh] overflow-y-auto scrollbar-thin transition-colors ${
        isDark ? 'bg-[#0b0b0e] text-white' : 'bg-[#e6e7eb] text-[#18181b]'
      }`}
    >
      {innerContent}
    </div>
  );
};
