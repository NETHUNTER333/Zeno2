import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { UserAccountStore, PLAN_LIMITS } from '../lib/userAccountStore';
import { UsageQuota } from '../types';
import { auth, getAuthHeaders } from '../lib/firebase';
import { DodoStatusModal } from './DodoStatusModal';
import { cancelUserSubscription, requestSubscriptionRefund } from '../lib/billing';
import { CustomSearchSelect } from './CustomSearchSelect';
import {
  PlanSwitchBillingToggle, PopSaveBadge, RollingDigitPrice,
  RollingBillingLine, ExtraFeatureRow, MorphUpgradeButton,
} from './motion/PlanSwitchMotion';

export interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHighlightPlan?: 'spark' | 'fire' | 'free';
  limitReason?: string | null;
  isDark?: boolean;
  embedded?: boolean;
}

const COUNTRY_TUPLES: [string, string, string, string, string][] = [
  ['US', 'United States', '🇺🇸', 'USD', '$'], ['IN', 'India', '🇮🇳', 'INR', '₹'], ['GB', 'United Kingdom', '🇬🇧', 'GBP', '£'],
  ['CA', 'Canada', '🇨🇦', 'CAD', 'CA$'], ['AU', 'Australia', '🇦🇺', 'AUD', 'A$'], ['DE', 'Germany', '🇩🇪', 'EUR', '€'],
  ['FR', 'France', '🇫🇷', 'EUR', '€'], ['NL', 'Netherlands', '🇳🇱', 'EUR', '€'], ['BE', 'Belgium', '🇧🇪', 'EUR', '€'],
  ['AT', 'Austria', '🇦🇹', 'EUR', '€'], ['IT', 'Italy', '🇮🇹', 'EUR', '€'], ['ES', 'Spain', '🇪🇸', 'EUR', '€'],
  ['PT', 'Portugal', '🇵🇹', 'EUR', '€'], ['IE', 'Ireland', '🇮🇪', 'EUR', '€'], ['FI', 'Finland', '🇫🇮', 'EUR', '€'],
  ['PL', 'Poland', '🇵🇱', 'PLN', 'zł'], ['SE', 'Sweden', '🇸🇪', 'SEK', 'kr'], ['NO', 'Norway', '🇳🇴', 'NOK', 'kr'],
  ['DK', 'Denmark', '🇩🇰', 'DKK', 'kr'], ['CH', 'Switzerland', '🇨🇭', 'CHF', 'CHF'], ['SG', 'Singapore', '🇸🇬', 'SGD', 'S$'],
  ['JP', 'Japan', '🇯🇵', 'JPY', '¥'], ['KR', 'South Korea', '🇰🇷', 'KRW', '₩'], ['BR', 'Brazil', '🇧🇷', 'BRL', 'R$'],
  ['MX', 'Mexico', '🇲🇽', 'MXN', 'MX$'], ['PH', 'Philippines', '🇵🇭', 'PHP', '₱'], ['MY', 'Malaysia', '🇲🇾', 'MYR', 'RM'],
  ['HK', 'Hong Kong', '🇭🇰', 'HKD', 'HK$'], ['AE', 'United Arab Emirates', '🇦🇪', 'AED', 'AED '], ['SA', 'Saudi Arabia', '🇸🇦', 'SAR', 'SAR '],
  ['ZA', 'South Africa', '🇿🇦', 'ZAR', 'R'], ['NZ', 'New Zealand', '🇳🇿', 'NZD', 'NZ$'], ['ID', 'Indonesia', '🇮🇩', 'IDR', 'Rp'],
  ['TH', 'Thailand', '🇹🇭', 'THB', '฿'], ['VN', 'Vietnam', '🇻🇳', 'VND', '₫'], ['TW', 'Taiwan', '🇹🇼', 'TWD', 'NT$'],
  ['IL', 'Israel', '🇮🇱', 'ILS', '₪'], ['TR', 'Turkey', '🇹🇷', 'TRY', '₺'], ['NG', 'Nigeria', '🇳🇬', 'NGN', '₦'],
  ['KE', 'Kenya', '🇰🇪', 'KES', 'KSh'], ['EG', 'Egypt', '🇪🇬', 'EGP', 'E£'], ['AR', 'Argentina', '🇦🇷', 'ARS', 'ARS '],
  ['CL', 'Chile', '🇨🇱', 'CLP', 'CLP$'], ['CO', 'Colombia', '🇨🇴', 'COP', 'COP$'], ['PE', 'Peru', '🇵🇪', 'PEN', 'S/'],
  ['CZ', 'Czechia', '🇨🇿', 'CZK', 'Kč'], ['HU', 'Hungary', '🇭🇺', 'HUF', 'Ft'], ['RO', 'Romania', '🇷🇴', 'RON', 'lei'],
  ['GR', 'Greece', '🇬🇷', 'EUR', '€'],
];
const FALLBACK_COUNTRIES = COUNTRY_TUPLES.map(([code, name, flag, currency, symbol]) => ({ code, name, flag, currency, symbol }));

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, initialHighlightPlan, limitReason, isDark = true, embedded = false }) => {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<'free' | 'spark' | 'fire'>(() => UserAccountStore.getNormalizedPlan());
  const [usage, setUsage] = useState<UsageQuota>(() => UserAccountStore.getUsage());
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(null);
  const [isSyncingQuota, setIsSyncingQuota] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [countries, setCountries] = useState(FALLBACK_COUNTRIES);
  const [selectedCountry, setSelectedCountry] = useState<string>(() => { try { return localStorage.getItem('kinich_billing_country') || 'IN'; } catch { return 'IN'; } });
  const [billingMe, setBillingMe] = useState<any | null>(null);
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<'spark' | 'fire' | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [guestSignInPromptPlan, setGuestSignInPromptPlan] = useState<'spark' | 'fire' | null>(null);
  const [refundDrawerOpen, setRefundDrawerOpen] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refundNote, setRefundNote] = useState('');
  const [refundCancelSub, setRefundCancelSub] = useState(true);
  const [refundBusy, setRefundBusy] = useState(false);

  const fetchPricePreviewForCountry = async (country: string) => {
    try { await fetch('/api/billing/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country }) }); } catch {}
  };

  const fetchBillingMeAndCountries = async () => {
    try {
      const [cRes, meRes] = await Promise.all([
        fetch('/api/billing/countries').catch(() => null),
        fetch('/api/billing/me', { headers: await getAuthHeaders() }).catch(() => null),
      ]);
      let resolved = selectedCountry;
      if (cRes?.ok) {
        const d = await cRes.json();
        if (d?.countries?.length) setCountries(d.countries);
        if (d?.defaultCountry && !localStorage.getItem('kinich_billing_country')) resolved = d.defaultCountry;
      }
      if (meRes?.ok) {
        const m = await meRes.json();
        setBillingMe(m);
        if (m?.billingCountry && !localStorage.getItem('kinich_billing_country')) resolved = m.billingCountry;
        if (m?.authenticated && ['spark', 'fire', 'free'].includes(m.effectivePlan) && (m.planStatus !== 'none' || m.refunds?.length > 0)) {
          if (UserAccountStore.getNormalizedPlan() !== m.effectivePlan) UserAccountStore.upgradePlan(m.effectivePlan, m.planInterval === 'yearly' ? 'yearly' : 'monthly');
          setCurrentPlan(m.effectivePlan); setUsage(UserAccountStore.getUsage());
        }
      }
      if (resolved !== selectedCountry) setSelectedCountry(resolved);
      await fetchPricePreviewForCountry(resolved);
    } catch {}
  };

  const handleSelectCountry = async (code: string) => {
    setSelectedCountry(code);
    try { localStorage.setItem('kinich_billing_country', code); } catch {}
    fetchPricePreviewForCountry(code);
    try { await fetch('/api/billing/country', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) }, body: JSON.stringify({ country: code }) }); } catch {}
  };

  useEffect(() => { if (isOpen || embedded) fetchBillingMeAndCountries(); }, [isOpen, embedded]);
  useEffect(() => {
    UserAccountStore.syncQuotaWithServerAndFirestore();
    const sync = () => { setCurrentPlan(UserAccountStore.getNormalizedPlan()); setUsage(UserAccountStore.getUsage()); };
    window.addEventListener('kinich-account-updated', sync);
    return () => window.removeEventListener('kinich-account-updated', sync);
  }, [initialHighlightPlan]);

  if (!isOpen && !embedded) return null;
  const isFirebaseSignedIn = Boolean(auth.currentUser && UserAccountStore.getProfile().signinProvider !== 'guest');

  const handleSelectPlan = async (target: 'free' | 'spark' | 'fire') => {
    const interval: 'monthly' | 'yearly' = billingCycle === 'annual' ? 'yearly' : 'monthly';
    if (target === 'free') {
      if (currentPlan !== 'free') {
        setRefundPaymentId(billingMe?.latestRefundablePayment?.dodo_payment_id || billingMe?.payments?.find((p: any) => p.status !== 'refunded')?.dodo_payment_id || '');
        setRefundCancelSub(true); setRefundDrawerOpen(true); return;
      }
      UserAccountStore.upgradePlan('free', interval); setCurrentPlan('free'); setUsage(UserAccountStore.getUsage());
      setUpgradeBanner('Active plan set to Free Tier.'); setTimeout(() => setUpgradeBanner(null), 5000); return;
    }
    if (!isFirebaseSignedIn) { setGuestSignInPromptPlan(target); return; }
    setGuestSignInPromptPlan(null); setCheckoutBusyPlan(target);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
      const profile = UserAccountStore.getProfile();
      if (billingMe?.dodoSubscriptionId && billingMe?.planStatus === 'active') {
        const cRes = await fetch('/api/billing/change-plan', { method: 'POST', headers, body: JSON.stringify({ plan: target, interval }) });
        const cData = await cRes.json();
        if (cRes.ok && cData?.success) {
          if (cData.payment_link) { window.location.href = cData.payment_link; return; }
          setUpgradeBanner(`Plan changed to ${target.toUpperCase()}.`); await fetchBillingMeAndCountries(); setCheckoutBusyPlan(null); return;
        }
      }
      const resp = await fetch('/api/billing/checkout', {
        method: 'POST', headers,
        body: JSON.stringify({ plan: target, interval, country: selectedCountry, email: profile?.email || auth.currentUser?.email || undefined, name: profile?.displayName || auth.currentUser?.displayName || undefined }),
      });
      const data = await resp.json();
      if (resp.ok && data?.checkout_url) { window.location.href = String(data.checkout_url); return; }
      setUpgradeBanner(data?.error || 'Could not initiate checkout session. Please try again.');
    } catch (err: any) {
      setUpgradeBanner(err?.message || 'Network error while creating checkout session.');
    } finally { setCheckoutBusyPlan(null); }
  };

  const handleCancelSubscription = async (atPeriodEnd = true, resume = false, immediate = false) => {
    setCancelBusy(true);
    try {
      const res = await cancelUserSubscription({ atPeriodEnd, resume, immediate });
      if (res.success) {
        const nextPlan = resume ? (res.plan && res.plan !== 'free' ? res.plan : 'spark') : (immediate || (!atPeriodEnd && !resume) ? 'free' : currentPlan);
        if (resume || immediate || (!atPeriodEnd && !resume)) {
          UserAccountStore.upgradePlan(nextPlan, resume && billingCycle === 'annual' ? 'yearly' : 'monthly');
          setCurrentPlan(nextPlan); setUsage(UserAccountStore.getUsage());
        }
        setUpgradeBanner(res.message || (resume ? 'Subscription restored.' : immediate ? 'Plan cancelled immediately.' : 'Auto-renewal cancelled.'));
        await fetchBillingMeAndCountries();
      } else setUpgradeBanner(res.error || 'Could not update subscription status.');
    } catch { setUpgradeBanner('Network error updating subscription.'); } finally { setCancelBusy(false); }
  };

  const handleRequestRefund = async (e?: React.FormEvent) => {
    e?.preventDefault(); setRefundBusy(true);
    try {
      const res = await requestSubscriptionRefund({ paymentId: refundPaymentId || undefined, reason: refundNote.trim() ? `${refundReason}: ${refundNote.trim()}` : refundReason, cancelSubscription: refundCancelSub });
      if (res.success) {
        if (refundCancelSub) { UserAccountStore.upgradePlan('free', 'monthly'); setCurrentPlan('free'); setUsage(UserAccountStore.getUsage()); }
        setUpgradeBanner(res.message || 'Refund processed via Dodo Payments.'); setRefundDrawerOpen(false); setRefundNote(''); await fetchBillingMeAndCountries();
      } else setUpgradeBanner(res.error || 'Could not process refund request.');
    } catch (err: any) { setUpgradeBanner(err?.message || 'Network error while requesting refund.'); } finally { setRefundBusy(false); }
  };

  const handleManualSyncQuota = async () => {
    setIsSyncingQuota(true);
    try { await UserAccountStore.syncQuotaWithServerAndFirestore(); setCurrentPlan(UserAccountStore.getNormalizedPlan()); setUsage(UserAccountStore.getUsage()); }
    finally { setTimeout(() => setIsSyncingQuota(false), 400); }
  };

  const lim = PLAN_LIMITS[currentPlan];
  const eff = (key: 'fileUploadLimit' | 'messageLimit' | 'searchLimit' | 'deepResearchLimit' | 'pdfStudyLimit') =>
    currentPlan === 'free' ? PLAN_LIMITS.free[key] : usage[key] || lim[key];

  const openDocsPage = () => {
    if (!embedded) onClose();
    if (typeof window !== 'undefined') { window.history.pushState({}, '', '/docs'); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo({ top: 0 }); }
  };

  const hasBillingControls = currentPlan !== 'free' || Boolean(billingMe && (billingMe.planStatus !== 'none' || billingMe.payments?.length > 0 || billingMe.refunds?.length > 0));
  const isIN = selectedCountry === 'IN';
  const curSym = isIN ? '₹' : '$';

  const paidPlans = [
    {
      id: 'spark' as const, title: 'Spark', badgeIdle: '10x Quotas',
      cardCls: currentPlan === 'spark' ? `border-[#FC4C01] ring-1 ring-[#FC4C01]/30 ${isDark ? 'bg-zinc-900' : 'bg-white shadow-sm'}` : isDark ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs',
      badgeCls: 'bg-[#FC4C01]/15 text-[#FC4C01]',
      amount: isIN ? (billingCycle === 'annual' ? 79 : 99) : (billingCycle === 'annual' ? 2 : 3),
      billingText: billingCycle === 'annual' ? (isIN ? 'Billed ₹949 yearly + GST' : 'Billed $29 yearly ($2.42/mo)') : 'Billed monthly, cancel anytime',
      idleLabel: currentPlan === 'fire' ? 'Switch to Spark' : 'Upgrade to Spark', doneLabel: "You're on Spark",
      feats: ['1,500 prompts / day', '250 file uploads / day', '750 web searches / day', '100 Deep Research runs / day', '200 Study sessions / day', 'Hitaishi Live 3D Voice Companion (300 turns/day)', 'Spark Reasoning & Vision Models'],
      featCls: isDark ? 'text-zinc-200' : 'text-zinc-800',
    },
    {
      id: 'fire' as const, title: 'Fire 🔥', badgeIdle: 'Unlimited',
      cardCls: currentPlan === 'fire' ? `border-[#FC4C01] ring-1 ring-[#FC4C01]/40 ${isDark ? 'bg-zinc-900' : 'bg-white shadow-sm'}` : isDark ? 'bg-zinc-900 border-[#FC4C01]/50' : 'bg-white border-[#FC4C01]/60 shadow-xs',
      badgeCls: 'bg-[#FC4C01] text-white',
      amount: isIN ? (billingCycle === 'annual' ? 200 : 249) : (billingCycle === 'annual' ? 7 : 9),
      billingText: billingCycle === 'annual' ? (isIN ? 'Billed ₹2,399 yearly + GST' : 'Billed $86 yearly ($7.17/mo)') : 'Billed monthly, cancel anytime',
      idleLabel: 'Upgrade to Fire', doneLabel: "You're on Fire 🔥",
      feats: ['Unlimited prompts & messages', 'Unlimited file & PDF uploads', 'Unlimited web searches & Deep Research', 'Unlimited Study sessions & Vault storage', 'Unlimited Hitaishi Live 3D Voice Companion', 'All Frontier & Vision Models', 'Personal Study Agents & Morning Brief'],
      featCls: isDark ? 'text-zinc-100 font-medium' : 'text-zinc-900 font-medium',
    },
  ];

  const innerContent = (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!embedded && (
            <button type="button" onClick={onClose} className={`size-9 rounded-xl flex items-center justify-center border transition-colors cursor-pointer ${isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white' : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-900'}`} title="Back" aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Plans</h1>
          <button type="button" onClick={openDocsPage} className={`text-xs font-medium underline underline-offset-4 cursor-pointer transition-colors ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'}`}>Docs &amp; Guide →</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomSearchSelect
            value={selectedCountry} onChange={handleSelectCountry} isDark={isDark} ariaLabel="Select billing country" align="left" searchPlaceholder="Search country or currency..."
            options={countries.map((c) => ({ value: c.code, label: c.name, flag: c.flag, badge: c.currency, searchKeywords: `${c.name} ${c.code} ${c.currency} ${c.symbol}` }))}
          />
          <PlanSwitchBillingToggle billingCycle={billingCycle} onChange={setBillingCycle} isDark={isDark} />
        </div>
      </div>

      {guestSignInPromptPlan && (
        <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${isDark ? 'bg-zinc-900 border-[#FC4C01]/40 text-white' : 'bg-orange-50/70 border-[#FC4C01]/30 text-zinc-900'}`}>
          <span className="font-semibold">Sign in with Google or Email to subscribe to {guestSignInPromptPlan === 'spark' ? 'Spark' : 'Fire'}.</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setGuestSignInPromptPlan(null); onClose(); window.dispatchEvent(new CustomEvent('kinich-open-auth', { detail: { reason: `Sign in to subscribe to ${guestSignInPromptPlan === 'spark' ? 'Spark' : 'Fire'}` } })); }} className="px-3.5 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white font-semibold cursor-pointer">Sign in</button>
            <button type="button" onClick={() => setGuestSignInPromptPlan(null)} className="px-2.5 py-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer">Dismiss</button>
          </div>
        </div>
      )}

      {limitReason && <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${isDark ? 'bg-zinc-900 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'}`}><span className="font-semibold">{limitReason}</span></div>}

      {upgradeBanner && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${isDark ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50 border-emerald-300 text-emerald-900'}`}>
          <span className="font-semibold">{upgradeBanner}</span>
          <button type="button" onClick={() => setUpgradeBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${currentPlan === 'free' ? (isDark ? 'bg-zinc-900/90 border-zinc-700' : 'bg-white border-zinc-300 shadow-xs') : (isDark ? 'bg-zinc-900/50 border-zinc-800/80' : 'bg-white border-zinc-200')}`}>
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold tracking-tight">Free</h2>
              {currentPlan === 'free' && <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>Current</span>}
            </div>
            <div className="flex items-baseline gap-1.5 mb-5">
              <span className="text-3xl font-bold tracking-tight">{isIN ? '₹0' : '$0'}</span>
              <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>/ forever</span>
            </div>
            <button type="button" onClick={() => handleSelectPlan('free')} disabled={currentPlan === 'free'} className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all mb-5 ${currentPlan === 'free' ? (isDark ? 'bg-zinc-800 text-zinc-400 cursor-default' : 'bg-zinc-100 text-zinc-500 cursor-default') : (isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 cursor-pointer')}`}>
              {currentPlan === 'free' ? 'Current Plan' : 'Switch to Free'}
            </button>
            <ul className="space-y-2.5 text-xs">
              {['5 prompts / day', '3 file uploads / day', '5 web searches / day', '3 Deep Research runs / day', '5 Study sessions / day', 'Hitaishi Live Voice & 3D Companion (Standard)'].map((feat) => (
                <li key={feat} className="flex items-center gap-2"><Check className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} /><span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>{feat}</span></li>
              ))}
            </ul>
          </div>
        </div>

        {paidPlans.map((p) => (
          <div key={p.id} className={`rounded-[24px] border p-5 flex flex-col justify-between transition-all ${p.cardCls}`}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-lg font-bold tracking-tight">{p.title}</h2>
                <div className="flex items-center gap-1.5">
                  <PopSaveBadge visible={billingCycle === 'annual'} label="Save 20%" />
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${p.badgeCls}`}>{currentPlan === p.id ? 'Current' : p.badgeIdle}</span>
                </div>
              </div>
              <div className="mb-4 space-y-1">
                <RollingDigitPrice prefix={curSym} amount={p.amount} suffix="/mo" />
                <RollingBillingLine text={p.billingText} isDark={isDark} />
              </div>
              <MorphUpgradeButton state={checkoutBusyPlan === p.id ? 'busy' : currentPlan === p.id ? 'done' : 'idle'} idleLabel={p.idleLabel} doneLabel={p.doneLabel} onClick={() => handleSelectPlan(p.id)} disabled={checkoutBusyPlan !== null && checkoutBusyPlan !== p.id} variant={p.id} isDark={isDark} />
              <ul className="space-y-2.5 text-xs">
                <ExtraFeatureRow visible={billingCycle === 'annual'} label="Two months free" isDark={isDark} />
                {p.feats.map((feat) => <li key={feat} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 shrink-0 text-[#FC4C01]" /><span className={p.featCls}>{feat}</span></li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-2xl border p-4 ${isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`text-xs font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>Daily Usage ({currentPlan === 'fire' ? 'FIRE · UNLIMITED' : currentPlan.toUpperCase()})</span>
          <button type="button" onClick={handleManualSyncQuota} className={`text-[11px] inline-flex items-center gap-1 cursor-pointer ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`} title="Sync usage">
            <RefreshCw className={`w-3 h-3 ${isSyncingQuota ? 'animate-spin' : ''}`} /><span>Sync</span>
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {([
            ['Prompts', usage.messagesUsed, eff('messageLimit')], ['Uploads', usage.filesUploaded, eff('fileUploadLimit')],
            ['Searches', usage.searchesUsed, eff('searchLimit')], ['Research', usage.deepResearchUsed, eff('deepResearchLimit')], ['Study', usage.pdfStudyUsed, eff('pdfStudyLimit')],
          ] as [string, number, number][]).map(([label, used, limit]) => {
            const unlim = currentPlan === 'fire' || limit >= 999999;
            const pct = Math.min(100, Math.round((used / (unlim ? 500 : Math.max(1, limit))) * 100));
            return (
              <div key={label} className={`p-2.5 rounded-xl border ${isDark ? 'bg-zinc-950/60 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200/80'}`}>
                <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                  <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>{label}</span>
                  <span className="font-mono font-semibold">{unlim ? `${used}/∞` : `${used}/${limit}`}</span>
                </div>
                <div className={`w-full h-1 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}><div className="h-full rounded-full bg-[#FC4C01] transition-all" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      {hasBillingControls && (
        <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">Subscription: {currentPlan.toUpperCase()}</span>
              {billingMe?.planStatus && billingMe.planStatus !== 'none' && <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>{billingMe.planStatus}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={refundBusy || cancelBusy} onClick={() => { setRefundPaymentId(billingMe?.latestRefundablePayment?.dodo_payment_id || billingMe?.payments?.find((p: any) => p.status !== 'refunded')?.dodo_payment_id || ''); setRefundDrawerOpen((p) => !p); }} className="px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors">Request Refund</button>
              {currentPlan !== 'free' && !billingMe?.cancelAtPeriodEnd && <button type="button" disabled={cancelBusy} onClick={() => handleCancelSubscription(true, false, false)} className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${isDark ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-200' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-800'}`}>Cancel Auto-Renewal</button>}
              {billingMe?.cancelAtPeriodEnd && <button type="button" disabled={cancelBusy} onClick={() => handleCancelSubscription(false, true, false)} className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-semibold cursor-pointer">Resume Plan</button>}
              {currentPlan !== 'free' && <button type="button" disabled={cancelBusy} onClick={() => handleCancelSubscription(false, false, true)} className="px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold cursor-pointer transition-colors">Cancel Plan</button>}
            </div>
          </div>

          {refundDrawerOpen && (
            <form onSubmit={handleRequestRefund} className={`p-3.5 rounded-xl border space-y-3 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Array.isArray(billingMe?.payments) && billingMe.payments.length > 0 && (
                  <CustomSearchSelect value={refundPaymentId} onChange={setRefundPaymentId} isDark={isDark} ariaLabel="Select payment to refund" align="left" options={billingMe.payments.filter((p: any) => p.status !== 'refunded').map((p: any) => ({ value: p.dodo_payment_id, label: p.dodo_payment_id, badge: `${((Number(p.amount) || 0) / 100).toFixed(2)} ${p.currency || 'INR'}` }))} />
                )}
                <CustomSearchSelect value={refundReason} onChange={setRefundReason} isDark={isDark} ariaLabel="Select refund reason" align="left" options={[{ value: 'requested_by_customer', label: '7-day money-back guarantee' }, { value: 'cancelled_want_refund', label: 'Cancelled subscription — refund payment' }, { value: 'duplicate', label: 'Accidental or duplicate charge' }]} />
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={refundBusy} className="px-3.5 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer">{refundBusy ? 'Processing...' : 'Confirm Refund'}</button>
                <button type="button" onClick={() => setRefundDrawerOpen(false)} className="px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100 cursor-pointer">Cancel</button>
              </div>
            </form>
          )}

          {Array.isArray(billingMe?.payments) && billingMe.payments.length > 0 && (
            <div className="pt-2 border-t border-current/10 space-y-1.5">
              <div className={`text-[11px] font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Recent Payments</div>
              <div className="space-y-1">
                {billingMe.payments.slice(0, 3).map((p: any) => {
                  const isRefunded = p.status === 'refunded';
                  return (
                    <div key={p.dodo_payment_id} className="flex items-center justify-between gap-2 text-xs py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent'}</span>
                        <span className="font-mono font-semibold">{((Number(p.amount) || 0) / 100).toFixed(2)} {p.currency || 'INR'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isRefunded ? 'bg-sky-500/15 text-sky-400' : p.status === 'succeeded' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-500/15 text-zinc-400'}`}>{p.status || 'paid'}</span>
                      </div>
                      {!isRefunded && <button type="button" disabled={refundBusy} onClick={() => { setRefundPaymentId(p.dodo_payment_id); setRefundDrawerOpen(true); }} className="text-[11px] font-semibold text-[#FC4C01] hover:underline cursor-pointer shrink-0">Refund</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <DodoStatusModal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} onContinueCheckout={checkoutBusyPlan ? () => handleSelectPlan(checkoutBusyPlan) : undefined} />
    </div>
  );

  if (embedded) return innerContent;
  return <div className={`fixed inset-0 z-50 w-full h-[100dvh] overflow-y-auto scrollbar-thin transition-colors ${isDark ? 'bg-[#09090b] text-white' : 'bg-[#fafafa] text-[#09090b]'}`}>{innerContent}</div>;
};
