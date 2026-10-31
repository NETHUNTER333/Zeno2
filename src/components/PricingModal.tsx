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
  Sparkles,
} from 'lucide-react';
import { UserAccountStore, PLAN_LIMITS } from '../lib/userAccountStore';
import { UsageQuota } from '../types';

export interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHighlightPlan?: 'spark' | 'fire' | 'free';
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
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(null);

  useEffect(() => {
    if (initialHighlightPlan === 'fire') {
      setActiveCardIndex(1);
    } else {
      setActiveCardIndex(0);
    }
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

  const handleSelectPlan = (targetPlan: 'spark' | 'fire') => {
    UserAccountStore.upgradePlan(
      targetPlan,
      billingCycle === 'annual' ? 'yearly' : 'monthly'
    );
    setCurrentPlan(targetPlan);
    setUsage(UserAccountStore.getUsage());
    const label = targetPlan === 'spark' ? 'Spark ($3/mo)' : 'Fire ($7/mo)';
    setUpgradeBanner(`Switched active plan to ${label}. Your 10x limits and models are now updated.`);
    setTimeout(() => setUpgradeBanner(null), 4000);
  };

  const sparkFeatures: PlanFeatureRow[] = [
    { text: '250 File Uploads / day (10x limit boost — up to 25/msg)', included: true },
    { text: '1,500 Daily AI Prompts (10x limit boost)', included: true },
    { text: '750 Real-Time Web & News Searches / day (10x boost)', included: true },
    { text: '100 Autonomous Deep Research runs / day (10x boost)', included: true },
    { text: '200 PDF Study & Exam Quiz runs / day (10x boost)', included: true },
    { text: '10M Token daily capacity & 2,000 tool executions / day', included: true },
    { text: 'Spark Models (Claude 4.6, GPT-6 Luna, DeepSeek V4.1, Qwen 3.8, Kimi K3)', included: true },
    { text: '50 GB Cloud Storage & Knowledge Vault saves', included: true },
    { text: 'Fire Flagship Models (Opus 5.5, GPT-6.1 Sol, GPT-6 Astra)', included: false },
    { text: 'Unlimited Uploads, Prompts & Zero-Queue Priority', included: false },
  ];

  const fireFeatures: PlanFeatureRow[] = [
    { text: 'Unlimited File Uploads (all formats & sizes)', included: true },
    { text: 'Unlimited Daily Prompts & Deep Research runs', included: true },
    { text: 'Unlimited Real-Time Web, News & ArXiv Search', included: true },
    { text: 'Unlimited PDF Studio, Quiz Studio & Document Intelligence', included: true },
    { text: 'All Spark Models (Claude 4.6, GPT-6 Luna, DeepSeek V4.1, Qwen 3.8, Kimi K3)', included: true },
    { text: 'Fire Flagship Models (Claude Opus 5.5, GPT-6.1 Sol, GPT-6 Astra)', included: true },
    { text: 'Gemini 4 Argon Pro, DeepSeek V4 Pro Max & 2.4T MoE', included: true },
    { text: 'Priority Zero-Queue Inference & 2M Code Context', included: true },
    { text: '100 GB Cloud Storage & Vault Sync', included: true },
    { text: 'Dedicated Multi-Agent Compute Cluster', included: true },
  ];

  const formatQuotaVal = (used: number, limit: number) => {
    if (limit >= 999999) return `${used} / Unlimited`;
    return `${used} / ${limit}`;
  };

  const innerContent = (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
            Annual (Save 20%)
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

      {/* Pricing Title Row + 2-Step Indicator */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Plans & Access</h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              10x Limits Active
            </span>
          </div>
          <p className={`text-xs sm:text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Choose between our 2 plans: Spark ($3/mo) with 10x increased daily limits or Fire ($7/mo) for unlimited frontier power.
          </p>
        </div>

        {/* 2-Dash Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          {[0, 1].map((idx) => (
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
              aria-label={`Highlight plan ${idx === 0 ? 'Spark' : 'Fire'}`}
            />
          ))}
        </div>
      </div>

      {/* Limit Reached or Model Locked Alert Banner */}
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
              Select Spark ($3) or Fire ($7) below to unlock immediately.
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
              Continue to Workspace
            </button>
          )}
        </div>
      )}

      {/* Live Usage Limits Strip with 10x Limits */}
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
              {currentPlan === 'fire'
                ? 'Fire ($7/mo)'
                : currentPlan === 'spark'
                ? 'Spark ($3/mo · 10x limits)'
                : 'Select a Plan ($3 or $7)'}
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

      {/* Strictly 2 Clean Padded Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6 items-stretch">
        {/* ==================== CARD 1: SPARK PLAN ($3 USD) ==================== */}
        <div
          onClick={() => setActiveCardIndex(0)}
          className={`relative rounded-[28px] p-6 sm:p-7 flex flex-col justify-between transition-all border-[2px] bg-[#18181b] text-white shadow-2xl ${
            currentPlan === 'spark'
              ? 'border-white ring-4 ring-white/15'
              : 'border-white/20'
          }`}
        >
          {/* Top-Right Status Badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Spark</h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                  10x Limits
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#18181b] text-[11px] font-bold">
              <span>{currentPlan === 'spark' ? 'Active Plan' : 'Most Popular'}</span>
              <span className="size-1.5 rounded-full bg-[#18181b]" />
            </div>
          </div>

          <div>
            {/* Price Block */}
            <div className="flex items-baseline gap-2.5 mt-1 mb-3">
              <span className="text-3xl sm:text-4xl font-semibold text-neutral-500 line-through decoration-2 tabular-nums">
                $7
              </span>
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums">
                {billingCycle === 'annual' ? '$2.40' : '$3'}
              </span>
              <div className="text-[11px] leading-tight text-neutral-300">
                <div>/ month (USD)</div>
                <div>{billingCycle === 'annual' ? '$29 billed yearly' : '$36 billed monthly'}</div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-neutral-300 mb-5">
              The high-volume daily research plan with <strong>10x increased quotas</strong> across file uploads, messages, and autonomous research.
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
              className={`w-full max-w-[260px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer shadow-lg ${
                currentPlan === 'spark'
                  ? 'bg-white/20 text-white border border-white/20 cursor-default'
                  : 'bg-white hover:bg-neutral-200 text-[#18181b] active:scale-95'
              }`}
            >
              {currentPlan === 'spark' ? 'Active Spark Plan' : 'Start Spark — $3/mo (10x Limits)'}
            </button>
          </div>
        </div>

        {/* ==================== CARD 2: FIRE PLAN ($7 USD) ==================== */}
        <div
          onClick={() => setActiveCardIndex(1)}
          className={`relative rounded-[28px] p-6 sm:p-7 flex flex-col justify-between transition-all border bg-white text-[#18181b] shadow-2xl ${
            currentPlan === 'fire'
              ? 'border-[#18181b] ring-4 ring-[#18181b]/15'
              : 'border-black/10'
          }`}
        >
          {/* Top-Right Pro Badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-[#18181b]">Fire</h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 border border-orange-500/30 uppercase tracking-wider">
                  Unlimited
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4f4f5] border border-black/10 text-[11px] font-bold text-[#18181b]">
              <span>{currentPlan === 'fire' ? 'Active Plan' : 'Flagship'}</span>
              <span className="size-1.5 rounded-full bg-[#18181b]" />
            </div>
          </div>

          <div>
            {/* Price Block */}
            <div className="flex items-baseline gap-2.5 mt-1 mb-3">
              <span className="text-3xl sm:text-4xl font-semibold text-neutral-400 line-through decoration-2 tabular-nums">
                $12
              </span>
              <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-[#18181b]">
                {billingCycle === 'annual' ? '$5.60' : '$7'}
              </span>
              <div className="text-[11px] leading-tight text-[#52525b]">
                <div>/ month (USD)</div>
                <div>{billingCycle === 'annual' ? '$67 billed yearly' : '$84 billed monthly'}</div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[#52525b] mb-5">
              Maximize research performance with unlimited file uploads, all flagship Opus 5.5, GPT-6.1 Sol & Astra models, and dedicated multi-agent compute.
            </p>

            {/* Separator */}
            <div className="border-b border-dashed border-black/15 mb-5" />

            {/* Feature Checklist */}
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
              className={`w-full max-w-[260px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${
                currentPlan === 'fire'
                  ? 'bg-[#18181b] text-white cursor-default'
                  : 'bg-[#18181b] hover:bg-neutral-800 text-white active:scale-95'
              }`}
            >
              {currentPlan === 'fire' ? 'Active Fire Plan' : 'Start Fire — $7/mo (Unlimited)'}
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
