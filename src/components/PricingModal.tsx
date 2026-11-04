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
  FileText,
  RefreshCw,
  Clock,
  Lock,
  Cpu,
  HardDrive,
  ChevronDown,
} from 'lucide-react';
import { UserAccountStore, PLAN_LIMITS } from '../lib/userAccountStore';
import { UsageQuota } from '../types';
import { LEGAL_CONFIG } from '../legal/config';

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

function getUtcResetCountdown(): string {
  const now = new Date();
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0
  );
  const diffMs = Math.max(0, nextUtcMidnight - now.getTime());
  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
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
  const [activeCardIndex, setActiveCardIndex] = useState<number>(() => {
    const plan = UserAccountStore.getNormalizedPlan();
    return plan === 'fire' ? 2 : plan === 'spark' ? 1 : 0;
  });
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(null);
  const [matrixTab, setMatrixTab] = useState<'all' | 'models' | 'quotas'>('all');
  const [mobileExpandedPlan, setMobileExpandedPlan] = useState<'spark' | 'fire' | 'free' | null>('spark');
  const [resetCountdown, setResetCountdown] = useState<string>(() => getUtcResetCountdown());
  const [isSyncingQuota, setIsSyncingQuota] = useState(false);

  useEffect(() => {
    if (initialHighlightPlan === 'fire') {
      setActiveCardIndex(2);
    } else if (initialHighlightPlan === 'spark') {
      setActiveCardIndex(1);
    } else if (initialHighlightPlan === 'free') {
      setActiveCardIndex(0);
    } else {
      const plan = UserAccountStore.getNormalizedPlan();
      setActiveCardIndex(plan === 'fire' ? 2 : plan === 'spark' ? 1 : 0);
    }
  }, [initialHighlightPlan, isOpen]);

  useEffect(() => {
    UserAccountStore.syncQuotaWithServerAndFirestore();
    const sync = () => {
      const nextPlan = UserAccountStore.getNormalizedPlan();
      setCurrentPlan(nextPlan);
      setUsage(UserAccountStore.getUsage());
      if (!initialHighlightPlan) {
        setActiveCardIndex(nextPlan === 'fire' ? 2 : nextPlan === 'spark' ? 1 : 0);
      }
    };
    window.addEventListener('kinich-account-updated', sync);
    const timer = window.setInterval(() => {
      setResetCountdown(getUtcResetCountdown());
    }, 30_000);
    return () => {
      window.removeEventListener('kinich-account-updated', sync);
      window.clearInterval(timer);
    };
  }, [initialHighlightPlan]);

  if (!isOpen && !embedded) return null;

  const handleSelectPlan = (targetPlan: 'free' | 'spark' | 'fire') => {
    UserAccountStore.upgradePlan(
      targetPlan,
      billingCycle === 'annual' ? 'yearly' : 'monthly'
    );
    setCurrentPlan(targetPlan);
    setUsage(UserAccountStore.getUsage());
    setActiveCardIndex(targetPlan === 'fire' ? 2 : targetPlan === 'spark' ? 1 : 0);
    const label =
      targetPlan === 'free'
        ? 'Free Tier (5 daily chats, 3 file uploads, 5 web searches, 3 deep research, 5 PDF study)'
        : targetPlan === 'spark'
        ? 'Spark ($3/mo · 10x Daily Limits)'
        : 'Fire ($7/mo · Unlimited Frontier Access)';
    setUpgradeBanner(`Active plan updated to ${label}. Your daily allowances and model locks are now synced.`);
    setTimeout(() => setUpgradeBanner(null), 4500);
  };

  const handleManualSyncQuota = async () => {
    setIsSyncingQuota(true);
    try {
      await UserAccountStore.syncQuotaWithServerAndFirestore();
      setCurrentPlan(UserAccountStore.getNormalizedPlan());
      setUsage(UserAccountStore.getUsage());
    } finally {
      setTimeout(() => setIsSyncingQuota(false), 400);
    }
  };

  // Authoritative plan limits guarantee Free Tier NEVER shows Unlimited or inflated numbers
  const planLimits = PLAN_LIMITS[currentPlan];
  const isUnlimitedPlan = currentPlan === 'fire';

  const effectiveFileLimit = isUnlimitedPlan
    ? 999999
    : currentPlan === 'free'
    ? PLAN_LIMITS.free.fileUploadLimit
    : Math.min(999998, usage.fileUploadLimit || planLimits.fileUploadLimit);

  const effectivePromptLimit = isUnlimitedPlan
    ? 999999
    : currentPlan === 'free'
    ? PLAN_LIMITS.free.messageLimit
    : Math.min(999998, usage.messageLimit || planLimits.messageLimit);

  const effectiveSearchLimit = isUnlimitedPlan
    ? 999999
    : currentPlan === 'free'
    ? PLAN_LIMITS.free.searchLimit
    : Math.min(999998, usage.searchLimit || planLimits.searchLimit);

  const effectiveDeepResearchLimit = isUnlimitedPlan
    ? 999999
    : currentPlan === 'free'
    ? PLAN_LIMITS.free.deepResearchLimit
    : Math.min(999998, usage.deepResearchLimit || planLimits.deepResearchLimit);

  const effectivePdfStudyLimit = isUnlimitedPlan
    ? 999999
    : currentPlan === 'free'
    ? PLAN_LIMITS.free.pdfStudyLimit
    : Math.min(999998, usage.pdfStudyLimit || planLimits.pdfStudyLimit);

  const formatQuotaVal = (used: number, limit: number) => {
    if (isUnlimitedPlan && limit >= 999999) return `${used} / Unlimited`;
    return `${used} / ${limit}`;
  };

  const neutralBadgeClass = isDark
    ? 'bg-white/[0.08] text-zinc-300 border border-white/10'
    : 'bg-zinc-100 text-zinc-700 border border-zinc-200';
  const activeBadgeClass = 'bg-[#FC4C01] text-white border border-[#FC4C01]';

  const freeFeatures: PlanFeatureRow[] = [
    { text: '3 File Uploads / day (up to 2 files/msg)', included: true },
    { text: '5 Daily AI Prompts (Chats)', included: true },
    { text: 'Free Default (DeepSeek V4.1 Flash) & MoonMath Vision', included: true },
    { text: '5 Daily Web Searches & 5 PDF Study sessions', included: true },
    { text: '3 Daily Autonomous Deep Research runs', included: true },
    { text: 'Spark ($3) & Fire ($7) Flagship Models', included: false },
    { text: '10x Quota Boost & Unlimited Inference', included: false },
  ];

  const sparkFeatures: PlanFeatureRow[] = [
    { text: '250 File Uploads / day (10x boost — up to 25/msg)', included: true },
    { text: '1,500 Daily AI Prompts (10x limit boost)', included: true },
    { text: '750 Real-Time Web & News Searches / day (10x boost)', included: true },
    { text: '100 Autonomous Deep Research runs / day (10x boost)', included: true },
    { text: '200 PDF Study & YouTube Transcript runs / day (10x boost)', included: true },
    { text: '10M Token daily capacity & 2,000 tool executions / day', included: true },
    { text: 'Spark Models (Claude 4.6, GPT-6 Luna, DeepSeek V4.1, Qwen 3.8, Kimi K3)', included: true },
    { text: '50 GB Cloud Storage & Knowledge Vault saves', included: true },
    { text: 'Fire Flagship Models (Opus 5.5, GPT-6.1 Sol, GPT-6 Astra)', included: false },
    { text: 'Unlimited Uploads, Prompts & Zero-Queue Priority', included: false },
  ];

  const fireFeatures: PlanFeatureRow[] = [
    { text: 'Unlimited File Uploads (all formats & sizes, up to 50/msg)', included: true },
    { text: 'Unlimited Daily Prompts & Autonomous Deep Research runs', included: true },
    { text: 'Unlimited Real-Time Web, News & ArXiv Search', included: true },
    { text: 'Unlimited PDF Studio, Quiz Studio & Document Intelligence', included: true },
    { text: 'All Spark Models (Claude 4.6, GPT-6 Luna, DeepSeek V4.1, Qwen 3.8, Kimi K3)', included: true },
    { text: 'Fire Flagship Models (Claude Opus 5.5, GPT-6.1 Sol, GPT-6 Astra)', included: true },
    { text: 'Gemini 4 Argon Pro, DeepSeek V4 Pro Max & 2.4T MoE', included: true },
    { text: 'Priority Zero-Queue Inference & 25M Daily Token Capacity', included: true },
    { text: '100 GB Cloud Storage & Vault Sync', included: true },
    { text: 'Dedicated Multi-Agent Compute Cluster', included: true },
  ];

  const allowanceCards = [
    {
      label: 'File Uploads',
      used: usage.filesUploaded,
      limit: effectiveFileLimit,
      icon: UploadCloud,
      sublabel: `Max ${planLimits.maxFilesPerMessage}/msg`,
    },
    {
      label: 'Daily Prompts',
      used: usage.messagesUsed,
      limit: effectivePromptLimit,
      icon: MessageSquare,
      sublabel: currentPlan === 'free' ? '5 daily chats' : currentPlan === 'spark' ? '10x boost' : 'No cap',
    },
    {
      label: 'Web Searches',
      used: usage.searchesUsed,
      limit: effectiveSearchLimit,
      icon: Globe,
      sublabel: 'Live web + images',
    },
    {
      label: 'Deep Research',
      used: usage.deepResearchUsed,
      limit: effectiveDeepResearchLimit,
      icon: Layers,
      sublabel: currentPlan === 'free' ? '3 daily runs' : currentPlan === 'spark' ? '100 runs/day' : 'Unlimited runs',
    },
    {
      label: 'PDF Studio',
      used: usage.pdfStudyUsed,
      limit: effectivePdfStudyLimit,
      icon: FileText,
      sublabel: currentPlan === 'free' ? '5 study runs' : currentPlan === 'spark' ? '200 runs/day' : 'Unlimited study',
    },
  ];

  const anyFreeLimitReached =
    currentPlan === 'free' &&
    allowanceCards.some((c) => !isUnlimitedPlan && c.used >= c.limit);

  const comparisonRows = [
    {
      category: 'models' as const,
      feature: 'Default Fast Chat (DeepSeek V4.1 Flash)',
      free: 'Included (Free)',
      spark: 'Included (10x Speed)',
      fire: 'Unlimited Priority',
    },
    {
      category: 'models' as const,
      feature: 'MoonMath Vision & Multimodal (GLM-5.3 Flash)',
      free: 'Included (Free)',
      spark: 'Included (High-Res)',
      fire: 'Unlimited High-Res',
    },
    {
      category: 'models' as const,
      feature: 'Spark Reasoning Models (Claude 4.6, GPT-6 Luna, Kimi K3, Qwen 3.8)',
      free: 'Locked ($3 Spark)',
      spark: 'Unlocked (1,500/day)',
      fire: 'Unlocked (Unlimited)',
    },
    {
      category: 'models' as const,
      feature: 'Fire Frontier Flagships (Claude Opus 5.5, GPT-6.1 Sol, GPT-6 Astra, Grok 4.7)',
      free: 'Locked ($7 Fire)',
      spark: 'Locked ($7 Fire)',
      fire: 'Unlocked (Unlimited)',
    },
    {
      category: 'quotas' as const,
      feature: 'Daily AI Prompts (Messages)',
      free: '5 / day',
      spark: '1,500 / day (10x)',
      fire: 'Unlimited',
    },
    {
      category: 'quotas' as const,
      feature: 'Daily File & Vision Uploads',
      free: '3 / day (2/msg)',
      spark: '250 / day (25/msg)',
      fire: 'Unlimited (50/msg)',
    },
    {
      category: 'quotas' as const,
      feature: 'Live Web, Image & YouTube Search',
      free: '5 / day',
      spark: '750 / day (10x)',
      fire: 'Unlimited',
    },
    {
      category: 'quotas' as const,
      feature: 'Autonomous Deep Research Runs',
      free: '3 / day',
      spark: '100 / day (10x)',
      fire: 'Unlimited',
    },
    {
      category: 'quotas' as const,
      feature: 'PDF Studio, Flashcards & Exam Quizzes',
      free: '5 / day',
      spark: '200 / day (10x)',
      fire: 'Unlimited',
    },
    {
      category: 'quotas' as const,
      feature: 'Daily Token Allowance & Cloud Vault',
      free: '250K tokens · 100 MB',
      spark: '10M tokens · 50 GB',
      fire: '25M tokens · 100 GB',
    },
  ];

  const visibleComparisonRows =
    matrixTab === 'all'
      ? comparisonRows
      : comparisonRows.filter((r) => r.category === matrixTab);

  const tokenUsedPct = Math.min(
    100,
    Math.round(((usage.tokensUsed || 0) / Math.max(1, planLimits.tokenLimit)) * 100)
  );
  const storageUsedMb = ((usage.storageBytesUsed || 4_200_000) / (1024 * 1024)).toFixed(1);
  const storageLimitLabel =
    currentPlan === 'fire' ? '100 GB' : currentPlan === 'spark' ? '50 GB' : '100 MB';

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
            aria-label="Return to workspace"
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

      {/* Pricing Title Row + 3-Step Indicator */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Plans & Access</h1>
            {currentPlan === 'free' ? (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${neutralBadgeClass}`}>
                Free Tier · 5 Chats & 3 Uploads
              </span>
            ) : currentPlan === 'spark' ? (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${activeBadgeClass}`}>
                10x Limits Active · Spark
              </span>
            ) : (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${activeBadgeClass}`}>
                Unlimited Frontier Active · Fire
              </span>
            )}
          </div>
          <p className={`text-xs sm:text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Start on the Free Tier ($0), upgrade to Spark ($3/mo) for 10x daily limits, or unlock Fire ($7/mo) for unlimited frontier models.
          </p>
        </div>

        {/* 3-Dash Indicator (Free, Spark, Fire) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {[
            { idx: 0, label: 'Free Tier' },
            { idx: 1, label: 'Spark ($3)' },
            { idx: 2, label: 'Fire ($7)' },
          ].map((item) => (
            <button
              key={item.idx}
              type="button"
              onClick={() => setActiveCardIndex(item.idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeCardIndex === item.idx
                  ? 'bg-[#FC4C01] w-6'
                  : isDark
                  ? 'bg-white/25 hover:bg-white/40 w-3.5'
                  : 'bg-[#18181b]/25 hover:bg-[#18181b]/50 w-3.5'
              }`}
              aria-label={`Highlight plan ${item.label}`}
              title={item.label}
            />
          ))}
        </div>
      </div>

      {/* Limit Reached or Model Locked Alert Banner */}
      {limitReason && (
        <div
          className={`mb-6 p-5 sm:p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
            isDark
              ? 'bg-[#141418] border-amber-500/30 text-white'
              : 'bg-white border-amber-500/40 text-[#18181b]'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-semibold leading-relaxed">
              {limitReason}
            </div>
            <div className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Select Spark ($3) for 10x daily limits or Fire ($7) for unlimited access below.
            </div>
          </div>
          {currentPlan === 'free' && (
            <button
              type="button"
              onClick={() => handleSelectPlan('spark')}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#FC4C01] hover:bg-[#e04300] text-white shrink-0 cursor-pointer transition-all"
            >
              Unlock Spark ($3/mo)
            </button>
          )}
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

      {/* Live Usage Limits Strip */}
      <div
        className={`mb-8 p-5 sm:p-6 rounded-3xl border shadow-sm ${
          isDark ? 'bg-[#141418] border-white/12 text-white' : 'bg-white border-black/10 text-[#18181b]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Active Plan & Daily Allowance
            </span>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                currentPlan === 'fire' || currentPlan === 'spark'
                  ? activeBadgeClass
                  : neutralBadgeClass
              }`}
            >
              {currentPlan === 'fire'
                ? 'Fire ($7/mo · Unlimited Frontier)'
                : currentPlan === 'spark'
                ? 'Spark ($3/mo · 10x Daily Limits)'
                : 'Free Tier (5 daily chats · 3 uploads · Default & Vision free)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full border ${
                isDark
                  ? 'border-white/15 bg-white/[0.04] text-neutral-300'
                  : 'border-black/10 bg-[#fafafa] text-neutral-700'
              }`}
              title="Enforced server-side & in Firestore per authenticated account"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Server-Verified · Resets in {resetCountdown} (00:00 UTC)</span>
            </div>
            <button
              type="button"
              onClick={handleManualSyncQuota}
              className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                isDark
                  ? 'border-white/15 bg-white/[0.04] hover:bg-white/10 text-neutral-300'
                  : 'border-black/10 bg-[#fafafa] hover:bg-neutral-200 text-neutral-700'
              }`}
              title="Refresh usage"
              aria-label="Refresh usage"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingQuota ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 5 Daily Allowance Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {allowanceCards.map((stat) => {
            const Icon = stat.icon;
            const isUnlimited = isUnlimitedPlan && stat.limit >= 999999;
            const rawPct = isUnlimited
              ? 10
              : Math.min(100, Math.round((stat.used / Math.max(1, stat.limit)) * 100));
            const isExhausted = !isUnlimited && stat.used >= stat.limit;
            const isWarning = !isUnlimited && !isExhausted && rawPct >= 75;
            const remaining = isUnlimited ? null : Math.max(0, stat.limit - stat.used);

            return (
              <div
                key={stat.label}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isExhausted
                    ? isDark
                      ? 'border-red-500/35 bg-red-500/[0.06]'
                      : 'border-red-500/30 bg-red-50/60'
                    : isDark
                    ? 'border-white/10 bg-white/[0.04]'
                    : 'border-black/10 bg-[#fafafa]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className={`flex items-center gap-1.5 text-[11px] font-medium truncate ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    <Icon className="w-3.5 h-3.5 opacity-75 shrink-0" />
                    <span className="truncate">{stat.label}</span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-1">
                  <div className="font-mono text-xs sm:text-sm font-semibold tabular-nums">
                    {formatQuotaVal(stat.used, stat.limit)}
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                      isUnlimited
                        ? 'bg-orange-500/15 text-orange-400'
                        : isExhausted
                        ? 'bg-red-500/20 text-red-400'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-400'
                        : isDark
                        ? 'bg-white/10 text-neutral-400'
                        : 'bg-black/5 text-neutral-600'
                    }`}
                  >
                    {isUnlimited
                      ? 'No Cap'
                      : isExhausted
                      ? 'Limit Hit'
                      : `${remaining} left`}
                  </span>
                </div>

                <div
                  className={`w-full h-1.5 rounded-full mt-2.5 overflow-hidden ${
                    isDark ? 'bg-white/10' : 'bg-black/10'
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      isUnlimited
                        ? 'bg-orange-400'
                        : isExhausted
                        ? 'bg-red-500'
                        : isWarning
                        ? 'bg-amber-400'
                        : isDark
                        ? 'bg-white'
                        : 'bg-[#18181b]'
                    }`}
                    style={{ width: `${rawPct}%` }}
                  />
                </div>

                <div className={`mt-2 text-[10px] truncate ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  {stat.sublabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* Secondary Resource Telemetry Strip: Tokens, Vault Storage & Active Model Tier */}
        <div
          className={`mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs ${
            isDark ? 'border-white/10 text-neutral-400' : 'border-black/10 text-neutral-600'
          }`}
        >
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 opacity-75" />
              Daily Tokens:
            </span>
            <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
              {(usage.tokensUsed || 0).toLocaleString()} / {(planLimits.tokenLimit / 1000).toLocaleString()}K ({tokenUsedPct}%)
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <HardDrive className="w-3.5 h-3.5 opacity-75" />
              Vault Storage:
            </span>
            <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
              {storageUsedMb} MB / {storageLimitLabel}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 opacity-75" />
              Unlocked Models:
            </span>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
              {currentPlan === 'fire'
                ? 'All 45+ Frontier Models'
                : currentPlan === 'spark'
                ? 'Free + Spark ($3) Models'
                : 'Default + MoonMath Vision'}
            </span>
          </div>
        </div>

        {/* Inline Quick-Upgrade Bar when Free Tier user hits a daily limit */}
        {anyFreeLimitReached && (
          <div
            className={`mt-4 p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
              isDark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-amber-50 border-amber-500/30 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              <Clock className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                You’ve reached one or more Free Tier daily limits. Wait {resetCountdown} for the 00:00 UTC reset or upgrade now for instant 10x capacity.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectPlan('spark')}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-black hover:bg-neutral-200 cursor-pointer transition-all"
              >
                Upgrade to Spark ($3)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPlan('fire')}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FC4C01] text-white hover:bg-[#e04300] cursor-pointer transition-all"
              >
                Go Unlimited ($7)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3 Pricing Cards: Free ($0), Spark ($3), Fire ($7) — Uniform 2-badge system & flex-1 aligned layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto gap-6 items-stretch mb-10">
        {/* ==================== CARD 0: FREE PLAN ($0) ==================== */}
        <div
          onClick={() => setActiveCardIndex(0)}
          className={`relative rounded-[28px] p-6 sm:p-7 flex flex-col transition-all border-[2px] shadow-xl ${
            isDark ? 'bg-[#141418] text-white' : 'bg-white text-[#18181b]'
          } ${
            currentPlan === 'free'
              ? 'border-[#FC4C01] ring-4 ring-[#FC4C01]/20'
              : isDark
              ? 'border-white/15 hover:border-white/25'
              : 'border-black/10 hover:border-black/20'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Free Tier</h2>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${neutralBadgeClass}`}>
                Starter
              </span>
            </div>
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${
                currentPlan === 'free' ? activeBadgeClass : neutralBadgeClass
              }`}
            >
              <span>{currentPlan === 'free' ? 'Active Plan' : 'Free'}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2.5 mt-1 mb-3 min-h-[48px]">
            <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
              $0
            </span>
            <span className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              forever free · no credit card
            </span>
          </div>

          <p
            className={`text-xs leading-relaxed mb-5 min-h-[38px] ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            Get started with <strong>5 daily chats</strong>, <strong>3 file uploads</strong>,{' '}
            <strong>3 deep research runs</strong>, and <strong>5 PDF study sessions</strong> on
            our free default and MoonMath vision models.
          </p>

          <div
            className={`border-b border-dashed mb-5 ${
              isDark ? 'border-white/15' : 'border-black/15'
            }`}
          />

          <ul className="space-y-3 mb-7 flex-1">
            {freeFeatures.map((feat, i) => (
              <li key={i} className="flex items-center gap-3 text-xs">
                {feat.included ? (
                  <span
                    className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                      isDark
                        ? 'bg-white/20 text-white'
                        : 'bg-neutral-900 text-white'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </span>
                ) : (
                  <span
                    className={`size-5 flex items-center justify-center shrink-0 ${
                      isDark ? 'text-neutral-600' : 'text-neutral-400'
                    }`}
                  >
                    <X className="w-3.5 h-3.5 stroke-[2]" />
                  </span>
                )}
                <span
                  className={
                    feat.included
                      ? 'font-medium'
                      : isDark
                      ? 'text-neutral-500'
                      : 'text-neutral-500'
                  }
                >
                  {feat.text}
                </span>
              </li>
            ))}
          </ul>

          <div className="pt-2 mt-auto flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan('free');
              }}
              disabled={currentPlan === 'free'}
              className={`w-full max-w-[260px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer ${
                currentPlan === 'free'
                  ? 'bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/35 cursor-default'
                  : isDark
                  ? 'bg-white/10 hover:bg-white/20 text-white active:scale-95'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-[#18181b] border border-black/10 active:scale-95'
              }`}
            >
              {currentPlan === 'free' ? 'Active Free Tier' : 'Switch to Free Tier ($0)'}
            </button>
          </div>
        </div>

        {/* ==================== CARD 1: SPARK PLAN ($3 USD) ==================== */}
        <div
          onClick={() => setActiveCardIndex(1)}
          className={`relative rounded-[28px] p-6 sm:p-7 flex flex-col transition-all border-[2px] shadow-xl ${
            isDark ? 'bg-[#18181b] text-white' : 'bg-white text-[#18181b]'
          } ${
            currentPlan === 'spark'
              ? 'border-[#FC4C01] ring-4 ring-[#FC4C01]/20'
              : isDark
              ? 'border-white/25 hover:border-white/35'
              : 'border-black/15 hover:border-black/25'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Spark</h2>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${neutralBadgeClass}`}>
                10x Limits
              </span>
            </div>
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${
                currentPlan === 'spark' ? activeBadgeClass : neutralBadgeClass
              }`}
            >
              <span>{currentPlan === 'spark' ? 'Active Plan' : 'Most Popular'}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2.5 mt-1 mb-3 min-h-[48px]">
            <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
              {billingCycle === 'annual' ? `$${LEGAL_CONFIG.SPARK_YEARLY_PRICE_USD}/yr` : '$3/mo'}
            </span>
            <span className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
              {billingCycle === 'annual'
                ? `(≈$${LEGAL_CONFIG.SPARK_YEARLY_MONTHLY_EQUIV_USD}/mo)`
                : '· billed monthly'}
            </span>
          </div>

          <p
            className={`text-xs leading-relaxed mb-5 min-h-[38px] ${
              isDark ? 'text-neutral-300' : 'text-neutral-600'
            }`}
          >
            The high-volume daily research plan with <strong>10x increased quotas</strong> across
            file uploads, prompts, and autonomous research.
          </p>

          <div
            className={`border-b border-dashed mb-5 ${
              isDark ? 'border-white/20' : 'border-black/15'
            }`}
          />

          <ul className="space-y-3 mb-7 flex-1">
            {sparkFeatures.map((feat, i) => (
              <li key={i} className="flex items-center gap-3 text-xs">
                {feat.included ? (
                  <span
                    className={`size-5 rounded-full flex items-center justify-center shrink-0 ${
                      isDark
                        ? 'bg-white text-[#18181b]'
                        : 'bg-[#18181b] text-white'
                    }`}
                  >
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </span>
                ) : (
                  <span
                    className={`size-5 flex items-center justify-center shrink-0 ${
                      isDark ? 'text-neutral-500' : 'text-neutral-400'
                    }`}
                  >
                    <X className="w-3.5 h-3.5 stroke-[2]" />
                  </span>
                )}
                <span
                  className={
                    feat.included
                      ? 'font-medium'
                      : isDark
                      ? 'text-neutral-500'
                      : 'text-neutral-500'
                  }
                >
                  {feat.text}
                </span>
              </li>
            ))}
          </ul>

          <div className="pt-2 mt-auto flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan('spark');
              }}
              disabled={currentPlan === 'spark'}
              className={`w-full max-w-[260px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${
                currentPlan === 'spark'
                  ? 'bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/35 cursor-default'
                  : isDark
                  ? 'bg-white hover:bg-neutral-200 text-[#18181b] active:scale-95'
                  : 'bg-[#18181b] hover:bg-neutral-800 text-white active:scale-95'
              }`}
            >
              {currentPlan === 'spark' ? 'Active Spark Plan' : 'Start Spark — $3/mo (10x Limits)'}
            </button>
          </div>
        </div>

        {/* ==================== CARD 2: FIRE PLAN ($7 USD) ==================== */}
        <div
          onClick={() => setActiveCardIndex(2)}
          className={`relative rounded-[28px] p-6 sm:p-7 flex flex-col transition-all border-[2px] shadow-xl ${
            isDark ? 'bg-[#18181b] text-white' : 'bg-white text-[#18181b]'
          } ${
            currentPlan === 'fire'
              ? 'border-[#FC4C01] ring-4 ring-[#FC4C01]/20'
              : isDark
              ? 'border-white/25 hover:border-white/35'
              : 'border-black/15 hover:border-black/25'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Fire</h2>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${neutralBadgeClass}`}>
                Unlimited
              </span>
            </div>
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${
                currentPlan === 'fire' ? activeBadgeClass : neutralBadgeClass
              }`}
            >
              <span>{currentPlan === 'fire' ? 'Active Plan' : 'Flagship'}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2.5 mt-1 mb-3 min-h-[48px]">
            <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
              {billingCycle === 'annual' ? `$${LEGAL_CONFIG.FIRE_YEARLY_PRICE_USD}/yr` : '$7/mo'}
            </span>
            <span className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
              {billingCycle === 'annual'
                ? `(≈$${LEGAL_CONFIG.FIRE_YEARLY_MONTHLY_EQUIV_USD}/mo)`
                : '· billed monthly'}
            </span>
          </div>

          <p
            className={`text-xs leading-relaxed mb-5 min-h-[38px] ${
              isDark ? 'text-neutral-300' : 'text-neutral-600'
            }`}
          >
            Maximize research performance with unlimited file uploads, all flagship Opus 5.5,
            GPT-6.1 Sol &amp; Astra models, and dedicated multi-agent compute.
          </p>

          <div
            className={`border-b border-dashed mb-5 ${
              isDark ? 'border-white/20' : 'border-black/15'
            }`}
          />

          <ul className="space-y-3 mb-7 flex-1">
            {fireFeatures.map((feat, i) => (
              <li key={i} className="flex items-center gap-3 text-xs">
                <span className="size-5 rounded-full bg-[#FC4C01] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </span>
                <span className="font-medium">{feat.text}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2 mt-auto flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan('fire');
              }}
              disabled={currentPlan === 'fire'}
              className={`w-full max-w-[260px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${
                currentPlan === 'fire'
                  ? 'bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/35 cursor-default'
                  : 'bg-[#FC4C01] hover:bg-[#e04300] text-white active:scale-95'
              }`}
            >
              {currentPlan === 'fire' ? 'Active Fire Plan' : 'Start Fire — $7/mo (Unlimited)'}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Plan & Model Access Comparison Matrix */}
      <div
        className={`rounded-3xl border p-5 sm:p-7 shadow-sm ${
          isDark ? 'bg-[#141418] border-white/12 text-white' : 'bg-white border-black/10 text-[#18181b]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">
              Plan Quotas & Model Access Matrix
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Compare exact daily limits and AI model unlocks across Free ($0), Spark ($3/mo), and Fire ($7/mo).
            </p>
          </div>

          {/* Filter Tabs */}
          <div
            className={`inline-flex items-center p-1 rounded-full border self-start ${
              isDark ? 'bg-[#18181b] border-white/10' : 'bg-neutral-100 border-black/10'
            }`}
          >
            {[
              { id: 'all' as const, label: 'All Specs' },
              { id: 'models' as const, label: 'AI Models' },
              { id: 'quotas' as const, label: 'Daily Quotas' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMatrixTab(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  matrixTab === tab.id
                    ? isDark
                      ? 'bg-white text-black'
                      : 'bg-[#18181b] text-white'
                    : isDark
                    ? 'text-neutral-400 hover:text-white'
                    : 'text-neutral-600 hover:text-black'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Accordion View per Plan (<md) */}
        <div className="md:hidden space-y-2.5">
          {(['free', 'spark', 'fire'] as const).map((planKey) => {
            const isExpanded = mobileExpandedPlan === planKey;
            const planTitle = planKey === 'fire' ? 'Fire ($7/mo · Unlimited)' : planKey === 'spark' ? 'Spark ($3/mo · 10x)' : 'Free Tier ($0)';
            const accentColor = planKey === 'fire' ? 'text-orange-400' : planKey === 'spark' ? 'text-amber-400' : '';
            return (
              <div
                key={planKey}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  isDark ? 'bg-[#18181b] border-white/10' : 'bg-neutral-50 border-black/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setMobileExpandedPlan(isExpanded ? null : planKey)}
                  className="w-full p-3.5 flex items-center justify-between text-xs font-bold cursor-pointer"
                >
                  <span className={accentColor}>{planTitle}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className={`px-3.5 pb-3.5 pt-1 space-y-2.5 border-t text-xs ${isDark ? 'border-white/10 text-neutral-300' : 'border-black/10 text-neutral-700'}`}>
                    {visibleComparisonRows.map((row, rIdx) => {
                      const val = planKey === 'free' ? row.free : planKey === 'spark' ? row.spark : row.fire;
                      return (
                        <div key={rIdx} className="flex items-center justify-between gap-2 py-1 border-b border-current/5 last:border-0">
                          <span className="font-medium opacity-80">{row.feature}</span>
                          <span className="font-mono font-semibold text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Comparison Table (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b ${
                  isDark ? 'border-white/10 text-neutral-400' : 'border-black/10 text-neutral-500'
                }`}
              >
                <th className="py-3 pr-4 font-semibold">Feature / Capability</th>
                <th className="py-3 px-3 font-semibold">Free Tier ($0)</th>
                <th className="py-3 px-3 font-semibold text-amber-400">Spark ($3/mo)</th>
                <th className="py-3 pl-3 font-semibold text-orange-400">Fire ($7/mo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visibleComparisonRows.map((row, idx) => {
                const isFreeLocked = row.free.startsWith('Locked');
                const isSparkLocked = row.spark.startsWith('Locked');
                return (
                  <tr
                    key={idx}
                    className={
                      isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'
                    }
                  >
                    <td className="py-3 pr-4 font-medium">{row.feature}</td>
                    <td className="py-3 px-3 font-mono">
                      {isFreeLocked ? (
                        <span className="inline-flex items-center gap-1 text-neutral-500">
                          <Lock className="w-3 h-3" />
                          {row.free}
                        </span>
                      ) : (
                        <span>{row.free}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {isSparkLocked ? (
                        <span className="inline-flex items-center gap-1 text-neutral-500">
                          <Lock className="w-3 h-3" />
                          {row.spark}
                        </span>
                      ) : (
                        <span className={isDark ? 'text-white font-semibold' : 'text-black font-semibold'}>
                          {row.spark}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 font-mono font-semibold text-orange-400">
                      {row.fire}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

