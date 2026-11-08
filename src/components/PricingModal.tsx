import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  RefreshCw,
} from 'lucide-react';
import { UserAccountStore, PLAN_LIMITS } from '../lib/userAccountStore';
import { UsageQuota } from '../types';
import { auth, getAuthHeaders } from '../lib/firebase';
import { DodoStatusModal } from './DodoStatusModal';
import { cancelUserSubscription, requestSubscriptionRefund } from '../lib/billing';

export interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHighlightPlan?: 'spark' | 'fire' | 'free';
  limitReason?: string | null;
  isDark?: boolean;
  embedded?: boolean;
}

const FALLBACK_COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', symbol: '$' },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR', symbol: '₹' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', symbol: '£' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD', symbol: 'CA$' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD', symbol: 'A$' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR', symbol: '€' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR', symbol: '€' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', currency: 'JPY', symbol: '¥' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', currency: 'SGD', symbol: 'S$' },
];

const PRICE_TABLE: Record<
  string,
  {
    spark: { monthly: string; yearly: string; monthlyEquiv: string };
    fire: { monthly: string; yearly: string; monthlyEquiv: string };
  }
> = {
  USD: {
    spark: { monthly: '$3/mo', yearly: '$29/yr', monthlyEquiv: '$2.42/mo' },
    fire: { monthly: '$7/mo', yearly: '$67/yr', monthlyEquiv: '$5.58/mo' },
  },
  INR: {
    spark: { monthly: '₹99/mo + GST', yearly: '₹949/yr + GST', monthlyEquiv: '₹79/mo' },
    fire: { monthly: '₹249/mo + GST', yearly: '₹2,399/yr + GST', monthlyEquiv: '₹200/mo' },
  },
};

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
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(null);
  const [isSyncingQuota, setIsSyncingQuota] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const [countries, setCountries] = useState<
    Array<{ code: string; name: string; flag: string; currency: string; symbol: string }>
  >(FALLBACK_COUNTRIES);
  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    try {
      return localStorage.getItem('kinich_billing_country') || 'IN';
    } catch {
      return 'IN';
    }
  });

  const getPriceTable = () => {
    const c = countries.find((x) => x.code === selectedCountry);
    const cur = c?.currency || 'USD';
    return PRICE_TABLE[cur] || PRICE_TABLE.USD;
  };
  const pt = getPriceTable();

  const [billingMe, setBillingMe] = useState<any | null>(null);
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<'spark' | 'fire' | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [guestSignInPromptPlan, setGuestSignInPromptPlan] = useState<'spark' | 'fire' | null>(null);
  const [refundDrawerOpen, setRefundDrawerOpen] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('requested_by_customer');
  const [refundNote, setRefundNote] = useState<string>('');
  const [refundCancelSub, setRefundCancelSub] = useState<boolean>(true);
  const [refundBusy, setRefundBusy] = useState<boolean>(false);

  const fetchPricePreviewForCountry = async (countryCode: string) => {
    try {
      await fetch('/api/billing/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryCode }),
      });
    } catch {}
  };

  const fetchBillingMeAndCountries = async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const [countriesRes, meRes] = await Promise.all([
        fetch('/api/billing/countries').catch(() => null),
        fetch('/api/billing/me', { headers: authHeaders }).catch(() => null),
      ]);
      let resolvedCountry = selectedCountry;
      if (countriesRes && countriesRes.ok) {
        const cData = await countriesRes.json();
        if (Array.isArray(cData?.countries) && cData.countries.length > 0) {
          setCountries(cData.countries);
        }
        if (cData?.defaultCountry && !localStorage.getItem('kinich_billing_country')) {
          resolvedCountry = cData.defaultCountry;
        }
      }
      if (meRes && meRes.ok) {
        const meData = await meRes.json();
        setBillingMe(meData);
        if (meData?.billingCountry && !localStorage.getItem('kinich_billing_country')) {
          resolvedCountry = meData.billingCountry;
        }
        if (
          meData?.authenticated &&
          (meData.effectivePlan === 'spark' ||
            meData.effectivePlan === 'fire' ||
            meData.effectivePlan === 'free') &&
          (meData.planStatus !== 'none' ||
            (Array.isArray(meData.refunds) && meData.refunds.length > 0))
        ) {
          if (UserAccountStore.getNormalizedPlan() !== meData.effectivePlan) {
            UserAccountStore.upgradePlan(
              meData.effectivePlan,
              meData.planInterval === 'yearly' ? 'yearly' : 'monthly'
            );
          }
          setCurrentPlan(meData.effectivePlan);
          setUsage(UserAccountStore.getUsage());
        }
      }
      if (resolvedCountry !== selectedCountry) {
        setSelectedCountry(resolvedCountry);
      }
      await fetchPricePreviewForCountry(resolvedCountry);
    } catch {}
  };

  const handleSelectCountry = async (code: string) => {
    setSelectedCountry(code);
    try {
      localStorage.setItem('kinich_billing_country', code);
    } catch {}
    fetchPricePreviewForCountry(code);
    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/billing/country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ country: code }),
      });
    } catch {}
  };

  useEffect(() => {
    if (isOpen || embedded) {
      fetchBillingMeAndCountries();
    }
  }, [isOpen, embedded]);

  useEffect(() => {
    UserAccountStore.syncQuotaWithServerAndFirestore();
    const sync = () => {
      const nextPlan = UserAccountStore.getNormalizedPlan();
      setCurrentPlan(nextPlan);
      setUsage(UserAccountStore.getUsage());
    };
    window.addEventListener('kinich-account-updated', sync);
    return () => {
      window.removeEventListener('kinich-account-updated', sync);
    };
  }, [initialHighlightPlan]);

  if (!isOpen && !embedded) return null;

  const isFirebaseSignedIn = Boolean(
    auth.currentUser && UserAccountStore.getProfile().signinProvider !== 'guest'
  );

  const handleSelectPlan = async (targetPlan: 'free' | 'spark' | 'fire') => {
    const interval: 'monthly' | 'yearly' = billingCycle === 'annual' ? 'yearly' : 'monthly';

    if (targetPlan === 'free') {
      if (currentPlan !== 'free') {
        const defaultPayId =
          billingMe?.latestRefundablePayment?.dodo_payment_id ||
          billingMe?.payments?.find((p: any) => p.status !== 'refunded')?.dodo_payment_id ||
          '';
        setRefundPaymentId(defaultPayId);
        setRefundCancelSub(true);
        setRefundDrawerOpen(true);
        return;
      }
      UserAccountStore.upgradePlan('free', interval);
      setCurrentPlan('free');
      setUsage(UserAccountStore.getUsage());
      setUpgradeBanner('Active plan set to Free Tier.');
      setTimeout(() => setUpgradeBanner(null), 5000);
      return;
    }

    if (!isFirebaseSignedIn) {
      setGuestSignInPromptPlan(targetPlan);
      return;
    }

    setGuestSignInPromptPlan(null);
    setCheckoutBusyPlan(targetPlan);

    try {
      const authHeaders = await getAuthHeaders();
      const profile = UserAccountStore.getProfile();

      if (billingMe?.dodoSubscriptionId && billingMe?.planStatus === 'active') {
        const changeRes = await fetch('/api/billing/change-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ plan: targetPlan, interval }),
        });
        const changeData = await changeRes.json();
        if (changeRes.ok && changeData?.success) {
          if (changeData.payment_link) {
            window.location.href = changeData.payment_link;
            return;
          }
          setUpgradeBanner(`Plan changed to ${targetPlan.toUpperCase()}.`);
          await fetchBillingMeAndCountries();
          setCheckoutBusyPlan(null);
          return;
        }
      }

      const resp = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          plan: targetPlan,
          interval,
          country: selectedCountry,
          email: profile?.email || auth.currentUser?.email || undefined,
          name: profile?.displayName || auth.currentUser?.displayName || undefined,
        }),
      });

      const data = await resp.json();
      if (resp.ok && data?.checkout_url) {
        window.location.href = String(data.checkout_url);
        return;
      } else {
        setUpgradeBanner(
          data?.error || 'Could not initiate checkout session. Please try again.'
        );
      }
    } catch (err: any) {
      setUpgradeBanner(err?.message || 'Network error while creating checkout session.');
    } finally {
      setCheckoutBusyPlan(null);
    }
  };

  const handleCancelSubscription = async (atPeriodEnd = true, resume = false, immediate = false) => {
    setCancelBusy(true);
    try {
      const result = await cancelUserSubscription({ atPeriodEnd, resume, immediate });
      if (result.success) {
        if (resume) {
          const restoredPlan = result.plan && result.plan !== 'free' ? result.plan : 'spark';
          UserAccountStore.upgradePlan(
            restoredPlan,
            billingCycle === 'annual' ? 'yearly' : 'monthly'
          );
          setCurrentPlan(restoredPlan);
          setUsage(UserAccountStore.getUsage());
        } else if (immediate || (!atPeriodEnd && !resume)) {
          UserAccountStore.upgradePlan('free', 'monthly');
          setCurrentPlan('free');
          setUsage(UserAccountStore.getUsage());
        }
        setUpgradeBanner(
          result.message ||
            (resume
              ? 'Subscription restored.'
              : immediate
              ? 'Plan cancelled immediately.'
              : 'Auto-renewal cancelled.')
        );
        await fetchBillingMeAndCountries();
      } else {
        setUpgradeBanner(result.error || 'Could not update subscription status.');
      }
    } catch {
      setUpgradeBanner('Network error updating subscription.');
    } finally {
      setCancelBusy(false);
    }
  };

  const handleRequestRefund = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRefundBusy(true);
    try {
      const finalReason = refundNote.trim()
        ? `${refundReason}: ${refundNote.trim()}`
        : refundReason;
      const result = await requestSubscriptionRefund({
        paymentId: refundPaymentId || undefined,
        reason: finalReason,
        cancelSubscription: refundCancelSub,
      });
      if (result.success) {
        if (refundCancelSub) {
          UserAccountStore.upgradePlan('free', 'monthly');
          setCurrentPlan('free');
          setUsage(UserAccountStore.getUsage());
        }
        setUpgradeBanner(result.message || 'Refund processed via Dodo Payments.');
        setRefundDrawerOpen(false);
        setRefundNote('');
        await fetchBillingMeAndCountries();
      } else {
        setUpgradeBanner(result.error || 'Could not process refund request.');
      }
    } catch (err: any) {
      setUpgradeBanner(err?.message || 'Network error while requesting refund.');
    } finally {
      setRefundBusy(false);
    }
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

  const planLimits = PLAN_LIMITS[currentPlan];

  const effectiveFileLimit =
    currentPlan === 'free'
      ? PLAN_LIMITS.free.fileUploadLimit
      : usage.fileUploadLimit || planLimits.fileUploadLimit;

  const effectivePromptLimit =
    currentPlan === 'free'
      ? PLAN_LIMITS.free.messageLimit
      : usage.messageLimit || planLimits.messageLimit;

  const effectiveSearchLimit =
    currentPlan === 'free'
      ? PLAN_LIMITS.free.searchLimit
      : usage.searchLimit || planLimits.searchLimit;

  const effectiveDeepResearchLimit =
    currentPlan === 'free'
      ? PLAN_LIMITS.free.deepResearchLimit
      : usage.deepResearchLimit || planLimits.deepResearchLimit;

  const effectivePdfStudyLimit =
    currentPlan === 'free'
      ? PLAN_LIMITS.free.pdfStudyLimit
      : usage.pdfStudyLimit || planLimits.pdfStudyLimit;

  const openDocsPage = () => {
    if (!embedded) onClose();
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/docs');
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo({ top: 0 });
    }
  };

  const hasBillingControls =
    currentPlan !== 'free' ||
    (billingMe &&
      (billingMe.planStatus !== 'none' ||
        (Array.isArray(billingMe.payments) && billingMe.payments.length > 0) ||
        (Array.isArray(billingMe.refunds) && billingMe.refunds.length > 0)));

  const innerContent = (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Clean Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className={`size-9 rounded-xl flex items-center justify-center border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white'
                  : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-900'
              }`}
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Plans</h1>
          <button
            type="button"
            onClick={openDocsPage}
            className={`text-xs font-medium underline underline-offset-4 cursor-pointer transition-colors ${
              isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Docs &amp; Guide →
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Compact Country Selector */}
          <select
            aria-label="Select billing country"
            value={selectedCountry}
            onChange={(e) => handleSelectCountry(e.target.value)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold outline-none cursor-pointer transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-700'
                : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-300'
            }`}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.currency})
              </option>
            ))}
          </select>

          {/* Compact Annual / Monthly Toggle */}
          <div
            className={`inline-flex items-center p-0.5 rounded-xl border ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                billingCycle === 'annual'
                  ? isDark
                    ? 'bg-white text-black'
                    : 'bg-zinc-900 text-white'
                  : isDark
                  ? 'text-zinc-400 hover:text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Annual -20%
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? isDark
                    ? 'bg-white text-black'
                    : 'bg-zinc-900 text-white'
                  : isDark
                  ? 'text-zinc-400 hover:text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {/* Contextual Alert Bars (Only when triggered) */}
      {guestSignInPromptPlan && (
        <div
          className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
            isDark
              ? 'bg-zinc-900 border-[#FC4C01]/40 text-white'
              : 'bg-orange-50/70 border-[#FC4C01]/30 text-zinc-900'
          }`}
        >
          <span className="font-semibold">
            Sign in with Google or Email to subscribe to{' '}
            {guestSignInPromptPlan === 'spark' ? 'Spark' : 'Fire'}.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGuestSignInPromptPlan(null);
                onClose();
                window.dispatchEvent(
                  new CustomEvent('kinich-open-auth', {
                    detail: {
                      reason: `Sign in to subscribe to ${
                        guestSignInPromptPlan === 'spark' ? 'Spark' : 'Fire'
                      }`,
                    },
                  })
                );
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white font-semibold cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setGuestSignInPromptPlan(null)}
              className="px-2.5 py-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {limitReason && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            isDark
              ? 'bg-zinc-900 border-amber-500/30 text-amber-200'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <span className="font-semibold">{limitReason}</span>
        </div>
      )}

      {upgradeBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            isDark
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <span className="font-semibold">{upgradeBanner}</span>
          <button
            type="button"
            onClick={() => setUpgradeBanner(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3 Simple Plan Cards First */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Card 1: Free */}
        <div
          className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
            currentPlan === 'free'
              ? isDark
                ? 'bg-zinc-900/90 border-zinc-700'
                : 'bg-white border-zinc-300 shadow-xs'
              : isDark
              ? 'bg-zinc-900/50 border-zinc-800/80'
              : 'bg-white border-zinc-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold tracking-tight">Free</h2>
              {currentPlan === 'free' && (
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  Current
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-1.5 mb-5">
              <span className="text-3xl font-bold tracking-tight">
                {selectedCountry === 'IN' ? '₹0' : '$0'}
              </span>
              <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                / forever
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleSelectPlan('free')}
              disabled={currentPlan === 'free'}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all mb-5 ${
                currentPlan === 'free'
                  ? isDark
                    ? 'bg-zinc-800 text-zinc-400 cursor-default'
                    : 'bg-zinc-100 text-zinc-500 cursor-default'
                  : isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 cursor-pointer'
              }`}
            >
              {currentPlan === 'free' ? 'Current Plan' : 'Switch to Free'}
            </button>

            <ul className="space-y-2.5 text-xs">
              {[
                '5 prompts / day',
                '3 file uploads / day',
                '5 web searches / day',
                '3 Deep Research runs / day',
                '5 Study sessions / day',
                '20 Vault items (100 MB)',
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-2">
                  <Check
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  />
                  <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Card 2: Spark */}
        <div
          className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
            currentPlan === 'spark'
              ? 'border-[#FC4C01] ring-1 ring-[#FC4C01]/30 ' +
                (isDark ? 'bg-zinc-900' : 'bg-white shadow-sm')
              : isDark
              ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
              : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold tracking-tight">Spark</h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FC4C01]/15 text-[#FC4C01]">
                {currentPlan === 'spark' ? 'Current' : '10x Quotas'}
              </span>
            </div>

            <div className="mb-5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight">
                  {billingCycle === 'annual' ? pt.spark.yearly : pt.spark.monthly}
                </span>
                {billingCycle === 'annual' && (
                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    ({pt.spark.monthlyEquiv})
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSelectPlan('spark')}
              disabled={checkoutBusyPlan !== null || currentPlan === 'spark'}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all mb-5 ${
                currentPlan === 'spark'
                  ? 'bg-[#FC4C01]/20 text-[#FC4C01] cursor-default'
                  : isDark
                  ? 'bg-white hover:bg-zinc-200 text-black cursor-pointer'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer'
              }`}
            >
              {checkoutBusyPlan === 'spark'
                ? 'Opening Checkout...'
                : currentPlan === 'spark'
                ? 'Current Plan'
                : currentPlan === 'fire'
                ? 'Switch to Spark'
                : 'Upgrade to Spark'}
            </button>

            <ul className="space-y-2.5 text-xs">
              {[
                '1,500 prompts / day',
                '250 file uploads / day',
                '750 web searches / day',
                '100 Deep Research runs / day',
                '200 Study sessions / day',
                'GLM 4.7 Flash, Kimi K2.5 & Qwen3 30B',
                '10 GB Cloud Vault',
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0 text-[#FC4C01]" />
                  <span className={isDark ? 'text-zinc-200' : 'text-zinc-800'}>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Card 3: Fire */}
        <div
          className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
            currentPlan === 'fire'
              ? 'border-[#FC4C01] ring-1 ring-[#FC4C01]/40 ' +
                (isDark ? 'bg-zinc-900' : 'bg-white shadow-sm')
              : isDark
              ? 'bg-zinc-900 border-[#FC4C01]/50'
              : 'bg-white border-[#FC4C01]/60 shadow-xs'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold tracking-tight">Fire</h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FC4C01] text-white">
                {currentPlan === 'fire' ? 'Current' : 'All Models'}
              </span>
            </div>

            <div className="mb-5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight">
                  {billingCycle === 'annual' ? pt.fire.yearly : pt.fire.monthly}
                </span>
                {billingCycle === 'annual' && (
                  <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    ({pt.fire.monthlyEquiv})
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSelectPlan('fire')}
              disabled={checkoutBusyPlan !== null || currentPlan === 'fire'}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all mb-5 ${
                currentPlan === 'fire'
                  ? 'bg-[#FC4C01]/20 text-[#FC4C01] cursor-default'
                  : 'bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer'
              }`}
            >
              {checkoutBusyPlan === 'fire'
                ? 'Opening Checkout...'
                : currentPlan === 'fire'
                ? 'Current Plan'
                : 'Upgrade to Fire'}
            </button>

            <ul className="space-y-2.5 text-xs">
              {[
                '5,000 prompts / day',
                '1,000 file uploads / day',
                '2,500 web searches / day',
                '300 Deep Research reports / day',
                '500 Study sessions / day',
                'All Frontier Models (GPT-6 Astra, DeepSeek R1)',
                'Personal Study Agents & Morning Brief',
                '30 GB Cloud Vault',
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0 text-[#FC4C01]" />
                  <span
                    className={
                      isDark ? 'text-zinc-100 font-medium' : 'text-zinc-900 font-medium'
                    }
                  >
                    {feat}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Compact Daily Usage Row */}
      <div
        className={`rounded-2xl border p-4 ${
          isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`text-xs font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
            Daily Usage ({currentPlan.toUpperCase()})
          </span>
          <button
            type="button"
            onClick={handleManualSyncQuota}
            className={`text-[11px] inline-flex items-center gap-1 cursor-pointer ${
              isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
            }`}
            title="Sync usage"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingQuota ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            {
              label: 'Prompts',
              used: usage.messagesUsed,
              limit: effectivePromptLimit,
            },
            {
              label: 'Uploads',
              used: usage.filesUploaded,
              limit: effectiveFileLimit,
            },
            {
              label: 'Searches',
              used: usage.searchesUsed,
              limit: effectiveSearchLimit,
            },
            {
              label: 'Research',
              used: usage.deepResearchUsed,
              limit: effectiveDeepResearchLimit,
            },
            {
              label: 'Study',
              used: usage.pdfStudyUsed,
              limit: effectivePdfStudyLimit,
            },
          ].map((stat) => {
            const pct = Math.min(100, Math.round((stat.used / Math.max(1, stat.limit)) * 100));
            return (
              <div
                key={stat.label}
                className={`p-2.5 rounded-xl border ${
                  isDark ? 'bg-zinc-950/60 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                  <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>{stat.label}</span>
                  <span className="font-mono font-semibold">
                    {stat.used}/{stat.limit}
                  </span>
                </div>
                <div
                  className={`w-full h-1 rounded-full overflow-hidden ${
                    isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                  }`}
                >
                  <div
                    className="h-full rounded-full bg-[#FC4C01] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact Subscription & Refunds Bar (Only when user has active plan or billing records) */}
      {hasBillingControls && (
        <div
          className={`rounded-2xl border p-4 space-y-3 ${
            isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">
                Subscription: {currentPlan.toUpperCase()}
              </span>
              {billingMe?.planStatus && billingMe.planStatus !== 'none' && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {billingMe.planStatus}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={refundBusy || cancelBusy}
                onClick={() => {
                  const defaultPay =
                    billingMe?.latestRefundablePayment?.dodo_payment_id ||
                    billingMe?.payments?.find((p: any) => p.status !== 'refunded')?.dodo_payment_id ||
                    '';
                  setRefundPaymentId(defaultPay);
                  setRefundDrawerOpen((prev) => !prev);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Request Refund
              </button>

              {currentPlan !== 'free' && !billingMe?.cancelAtPeriodEnd && (
                <button
                  type="button"
                  disabled={cancelBusy}
                  onClick={() => handleCancelSubscription(true, false, false)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    isDark
                      ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-200'
                      : 'border-zinc-300 hover:bg-zinc-100 text-zinc-800'
                  }`}
                >
                  Cancel Auto-Renewal
                </button>
              )}

              {billingMe?.cancelAtPeriodEnd && (
                <button
                  type="button"
                  disabled={cancelBusy}
                  onClick={() => handleCancelSubscription(false, true, false)}
                  className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-semibold cursor-pointer"
                >
                  Resume Plan
                </button>
              )}

              {currentPlan !== 'free' && (
                <button
                  type="button"
                  disabled={cancelBusy}
                  onClick={() => handleCancelSubscription(false, false, true)}
                  className="px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel Plan
                </button>
              )}
            </div>
          </div>

          {/* Inline Refund Form when toggled */}
          {refundDrawerOpen && (
            <form
              onSubmit={handleRequestRefund}
              className={`p-3.5 rounded-xl border space-y-3 ${
                isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Array.isArray(billingMe?.payments) && billingMe.payments.length > 0 && (
                  <select
                    aria-label="Select payment to refund"
                    value={refundPaymentId}
                    onChange={(e) => setRefundPaymentId(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs outline-none ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-700 text-white'
                        : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                  >
                    {billingMe.payments
                      .filter((p: any) => p.status !== 'refunded')
                      .map((p: any) => (
                        <option key={p.dodo_payment_id} value={p.dodo_payment_id}>
                          {p.dodo_payment_id} ({((Number(p.amount) || 0) / 100).toFixed(2)}{' '}
                          {p.currency || 'INR'})
                        </option>
                      ))}
                  </select>
                )}

                <select
                  aria-label="Select refund reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs outline-none ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-white border-zinc-300 text-zinc-900'
                  }`}
                >
                  <option value="requested_by_customer">7-day money-back guarantee</option>
                  <option value="cancelled_want_refund">Cancelled subscription — refund payment</option>
                  <option value="duplicate">Accidental or duplicate charge</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={refundBusy}
                  className="px-3.5 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer"
                >
                  {refundBusy ? 'Processing...' : 'Confirm Refund'}
                </button>
                <button
                  type="button"
                  onClick={() => setRefundDrawerOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Compact Invoices List */}
          {Array.isArray(billingMe?.payments) && billingMe.payments.length > 0 && (
            <div className="pt-2 border-t border-current/10 space-y-1.5">
              <div
                className={`text-[11px] font-semibold ${
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                Recent Payments
              </div>
              <div className="space-y-1">
                {billingMe.payments.slice(0, 3).map((p: any) => {
                  const isRefunded = p.status === 'refunded';
                  return (
                    <div
                      key={p.dodo_payment_id}
                      className="flex items-center justify-between gap-2 text-xs py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                        <span className="font-mono font-semibold">
                          {((Number(p.amount) || 0) / 100).toFixed(2)} {p.currency || 'INR'}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            isRefunded
                              ? 'bg-sky-500/15 text-sky-400'
                              : p.status === 'succeeded'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-zinc-500/15 text-zinc-400'
                          }`}
                        >
                          {p.status || 'paid'}
                        </span>
                      </div>
                      {!isRefunded && (
                        <button
                          type="button"
                          disabled={refundBusy}
                          onClick={() => {
                            setRefundPaymentId(p.dodo_payment_id);
                            setRefundDrawerOpen(true);
                          }}
                          className="text-[11px] font-semibold text-[#FC4C01] hover:underline cursor-pointer shrink-0"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <DodoStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onContinueCheckout={
          checkoutBusyPlan ? () => handleSelectPlan(checkoutBusyPlan) : undefined
        }
      />
    </div>
  );

  if (embedded) {
    return innerContent;
  }

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-[100dvh] overflow-y-auto scrollbar-thin transition-colors ${
        isDark ? 'bg-[#09090b] text-white' : 'bg-[#fafafa] text-[#09090b]'
      }`}
    >
      {innerContent}
    </div>
  );
};
