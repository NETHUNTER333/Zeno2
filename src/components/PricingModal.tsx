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
  Search,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { UserAccountStore, PLAN_LIMITS } from '../lib/userAccountStore';
import { UsageQuota } from '../types';
import { LEGAL_CONFIG } from '../legal/config';
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
  const [dodoCheckoutUrl, setDodoCheckoutUrl] = useState<string | null>(null);
  const [dodoSessionId, setDodoSessionId] = useState<string | null>(null);
  const [matrixTab, setMatrixTab] = useState<'all' | 'models' | 'quotas'>('all');
  const [mobileMatrixPlan, setMobileMatrixPlan] = useState<'spark' | 'fire' | 'free' | 'compare'>('spark');
  const [mobileExpandedPlan, setMobileExpandedPlan] = useState<'spark' | 'fire' | 'free' | null>('spark');
  const [resetCountdown, setResetCountdown] = useState<string>(() => getUtcResetCountdown());
  const [isSyncingQuota, setIsSyncingQuota] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

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

  const [countries, setCountries] = useState<
    Array<{ code: string; name: string; flag: string; currency: string; symbol: string }>
  >(FALLBACK_COUNTRIES);
  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    try {
      return localStorage.getItem('kinich_billing_country') || 'US';
    } catch {
      return 'US';
    }
  });
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');

  const PRICE_TABLE: Record<string, { spark: { monthly: string; yearly: string; monthlyEquiv: string }; fire: { monthly: string; yearly: string; monthlyEquiv: string } }> = {
    USD: { spark: { monthly: '$3/mo', yearly: '$29/yr', monthlyEquiv: '2.42' }, fire: { monthly: '$7/mo', yearly: '$67/yr', monthlyEquiv: '5.58' } },
    INR: { spark: { monthly: '₹99/mo + GST', yearly: '₹949/yr + GST', monthlyEquiv: '₹79' }, fire: { monthly: '₹249/mo + GST', yearly: '₹2,399/yr + GST', monthlyEquiv: '₹200' } },
  };
  const getPriceTable = () => {
    const c = countries.find((x) => x.code === selectedCountry);
    const cur = c?.currency || 'USD';
    return PRICE_TABLE[cur] || PRICE_TABLE.USD;
  };
  const pt = getPriceTable();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pricePreviews, setPricePreviews] = useState<Record<string, any>>({});
  const [paymentMethodsInfo, setPaymentMethodsInfo] = useState<{
    subscriptionMethods: Array<{ id: string; label: string; prominent?: boolean; note?: string }>;
    oneTimeOnlyMethods: Array<{ id: string; label: string }>;
    mandateNote?: string;
  } | null>(null);
  const [billingMe, setBillingMe] = useState<any | null>(null);
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<'spark' | 'fire' | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [updateMethodBusy, setUpdateMethodBusy] = useState(false);
  const [guestSignInPromptPlan, setGuestSignInPromptPlan] = useState<'spark' | 'fire' | null>(null);
  const [refundDrawerOpen, setRefundDrawerOpen] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('requested_by_customer');
  const [refundNote, setRefundNote] = useState<string>('');
  const [refundCancelSub, setRefundCancelSub] = useState<boolean>(true);
  const [refundBusy, setRefundBusy] = useState<boolean>(false);

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
        if (
          cData?.defaultCountry &&
          !localStorage.getItem('kinich_billing_country')
        ) {
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
          (meData.effectivePlan === 'spark' || meData.effectivePlan === 'fire' || meData.effectivePlan === 'free') &&
          (meData.planStatus !== 'none' || (Array.isArray(meData.refunds) && meData.refunds.length > 0))
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

  const fetchPricePreviewForCountry = async (countryCode: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/billing/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryCode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.previews) {
          setPricePreviews(data.previews);
        }
        if (data?.paymentMethods) {
          setPaymentMethodsInfo(data.paymentMethods);
        }
      }
    } catch {}
    setPreviewLoading(false);
  };

  const handleSelectCountry = async (code: string) => {
    setSelectedCountry(code);
    setCountryDropdownOpen(false);
    setCountrySearchQuery('');
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

  const isFirebaseSignedIn = Boolean(
    auth.currentUser && UserAccountStore.getProfile().signinProvider !== 'guest'
  );

  const handleSelectPlan = async (targetPlan: 'free' | 'spark' | 'fire') => {
    const interval: 'monthly' | 'yearly' = billingCycle === 'annual' ? 'yearly' : 'monthly';
    setActiveCardIndex(targetPlan === 'fire' ? 2 : targetPlan === 'spark' ? 1 : 0);
    setDodoCheckoutUrl(null);
    setDodoSessionId(null);

    if (targetPlan === 'free') {
      if (currentPlan !== 'free') {
        const defaultPayId =
          billingMe?.latestRefundablePayment?.dodo_payment_id ||
          billingMe?.payments?.find((p: any) => p.status !== 'refunded')?.dodo_payment_id ||
          '';
        setRefundPaymentId(defaultPayId);
        setRefundCancelSub(true);
        setRefundDrawerOpen(true);
        setUpgradeBanner(
          'Choose how you want to cancel below: click "Confirm & Process Refund" to get your money back & cancel, or click "Cancel Auto-Renewal (Keep Spark)" to keep your plan until the billing period ends.'
        );
        return;
      }
      UserAccountStore.upgradePlan('free', interval);
      setCurrentPlan('free');
      setUsage(UserAccountStore.getUsage());
      setUpgradeBanner(
        'Active plan set to Free Tier (5 daily chats, 3 file uploads, 5 web searches, 3 deep research, 5 PDF study).'
      );
      setTimeout(() => setUpgradeBanner(null), 7000);
      return;
    }

    // Paid plans (Spark / Fire): Require a signed-in Firebase user before checkout
    if (!isFirebaseSignedIn) {
      setGuestSignInPromptPlan(targetPlan);
      setUpgradeBanner(
        `Please sign in with your Kinich account first to subscribe to ${
          targetPlan === 'fire' ? `Fire (${pt.fire.monthly})` : `Spark (${pt.spark.monthly})`
        }. Your selection will resume immediately after sign-in.`
      );
      return;
    }

    setGuestSignInPromptPlan(null);
    setCheckoutBusyPlan(targetPlan);

    try {
      const authHeaders = await getAuthHeaders();
      const profile = UserAccountStore.getProfile();

      // If user already has an active Dodo subscription, use change-plan endpoint
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
          setUpgradeBanner(
            `Plan change to ${targetPlan.toUpperCase()} (${interval}) submitted to Dodo Payments. Your entitlements will update as soon as confirmed.`
          );
          await fetchBillingMeAndCountries();
          setCheckoutBusyPlan(null);
          return;
        }
      }

      // Create new Dodo Checkout Session via /api/billing/checkout
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
        setDodoCheckoutUrl(String(data.checkout_url));
        if (data?.session_id) setDodoSessionId(String(data.session_id));
        setUpgradeBanner(
          `Redirecting to Dodo Payments secure checkout for Kinich ${
            targetPlan === 'fire' ? 'Fire' : 'Spark'
          } (${interval})...`
        );
        window.location.href = String(data.checkout_url);
        return;
      } else {
        setUpgradeBanner(
          data?.error || 'Could not initiate Dodo checkout session. Please try again.'
        );
      }
    } catch (err: any) {
      setUpgradeBanner(err?.message || 'Network error while creating checkout session.');
    } finally {
      setCheckoutBusyPlan(null);
    }
  };

  const handleOpenCustomerPortal = async () => {
    setPortalBusy(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = String(data.url);
        return;
      }
      setUpgradeBanner(data?.error || 'Customer portal is available after your first subscription checkout.');
    } catch {
      setUpgradeBanner('Unable to open Dodo Customer Portal right now.');
    } finally {
      setPortalBusy(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    setUpdateMethodBusy(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/billing/update-payment-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      });
      const data = await res.json();
      if (res.ok && data?.payment_link) {
        window.location.href = String(data.payment_link);
        return;
      }
      setUpgradeBanner(data?.error || 'Could not generate payment method update link.');
    } catch {
      setUpgradeBanner('Failed to request payment method update.');
    } finally {
      setUpdateMethodBusy(false);
    }
  };

  const handleCancelSubscription = async (atPeriodEnd = true, resume = false, immediate = false) => {
    setCancelBusy(true);
    try {
      const result = await cancelUserSubscription({ atPeriodEnd, resume, immediate });
      if (result.success) {
        if (resume) {
          const restoredPlan = result.plan && result.plan !== 'free' ? result.plan : 'spark';
          UserAccountStore.upgradePlan(restoredPlan, billingCycle === 'annual' ? 'yearly' : 'monthly');
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
              ? 'Your Spark plan has been restored and auto-renewal is active.'
              : immediate
              ? 'Your plan was cancelled immediately and switched to the Free Tier. Click "Get Money Back / Request Refund" below if you want your payment refunded.'
              : 'Auto-renewal cancelled. You keep full Spark/Fire access until the end of your billing period. Click "Get Money Back / Request Refund" if you want a refund instead.')
        );
        await fetchBillingMeAndCountries();
      } else {
        if (resume) {
          UserAccountStore.upgradePlan('spark', billingCycle === 'annual' ? 'yearly' : 'monthly');
          setCurrentPlan('spark');
          setUsage(UserAccountStore.getUsage());
          setUpgradeBanner('Your Spark plan access has been restored.');
        } else if (immediate) {
          UserAccountStore.upgradePlan('free', 'monthly');
          setCurrentPlan('free');
          setUsage(UserAccountStore.getUsage());
          setUpgradeBanner(
            'Subscription cancelled and switched to Free Tier. Click "Get Money Back / Request Refund" below to refund your payment.'
          );
        } else {
          setUpgradeBanner(result.error || 'Could not update subscription cancellation status.');
        }
      }
    } catch {
      if (resume) {
        UserAccountStore.upgradePlan('spark', billingCycle === 'annual' ? 'yearly' : 'monthly');
        setCurrentPlan('spark');
        setUsage(UserAccountStore.getUsage());
        setUpgradeBanner('Your Spark plan access has been restored.');
      } else if (immediate) {
        UserAccountStore.upgradePlan('free', 'monthly');
        setCurrentPlan('free');
        setUsage(UserAccountStore.getUsage());
        setUpgradeBanner(
          'Subscription cancelled and switched to Free Tier. Click "Get Money Back / Request Refund" below to refund your payment.'
        );
      } else {
        setUpgradeBanner('Network error updating subscription.');
      }
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
        setUpgradeBanner(
          result.message || 'Refund processed! Funds are being returned to your original payment method via Dodo Payments.'
        );
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

  // Authoritative plan limits guarantee each tier displays explicit daily caps
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

  const formatQuotaVal = (used: number, limit: number) => {
    return `${used} / ${limit.toLocaleString()}`;
  };

  const neutralBadgeClass = isDark
    ? 'bg-white/[0.08] text-zinc-300 border border-white/10'
    : 'bg-zinc-100 text-zinc-700 border border-zinc-200';
  const activeBadgeClass = 'bg-[#FC4C01] text-white border border-[#FC4C01]';

  const freeFeatures: PlanFeatureRow[] = [
    { text: '5 Daily AI Prompts (resets every midnight UTC)', included: true },
    { text: '3 File & Vision Uploads / day (up to 2 files/msg)', included: true },
    { text: 'Vault (up to 20 items) with manual Save', included: true },
    { text: '5 Live Web Searches & 5 Document Study runs / day', included: true },
    { text: '3 Autonomous Deep Research reports / day', included: true },
    { text: 'Personal Study Agents (Sage, Recall, Planner, Doubt Buddy)', included: false },
    { text: '10x Daily Limit Boost & Frontier Flagship Models', included: false },
  ];

  const sparkFeatures: PlanFeatureRow[] = [
    { text: '1,500 Daily Prompts (10x boost · 1M context)', included: true },
    { text: '250 File Uploads / day (up to 25 files/msg)', included: true },
    { text: 'Vault (unlimited items) + Sage & Recall Personal Agents', included: true },
    { text: '750 Real-Time Web & News Searches / day', included: true },
    { text: '100 Autonomous Deep Research reports / day', included: true },
    { text: '200 PDF Study & YouTube Studio sessions / day', included: true },
    { text: '10M Daily Token Capacity & 250K Daily Agent Tokens', included: true },
    { text: 'All Agents (Planner, Doubt Buddy) + Daily Morning Brief', included: false },
    { text: '5,000 Daily Messages & Zero-Queue Priority', included: false },
  ];

  const fireFeatures: PlanFeatureRow[] = [
    { text: '5,000 Daily Prompts & Messages (Max Frontier Cap)', included: true },
    { text: '1,000 File Uploads / day (all formats, up to 50/msg)', included: true },
    { text: 'All Personal Agents (Sage, Recall, Planner, Doubt Buddy) + Morning Brief', included: true },
    { text: '2,500 Real-Time Web, News & Academic Searches / day', included: true },
    { text: '300 Deep Research Reports & Synthesis / day', included: true },
    { text: '500 PDF Studio, Quiz Studio & YouTube Study sessions / day', included: true },
    { text: 'Frontier Flagships: Claude 3.7 Sonnet (Thinking), GPT-4.5, Grok 3', included: true },
    { text: 'Priority Zero-Queue Compute & Dedicated Ingestion', included: true },
    { text: '25M Daily Token Capacity (1M Agent Tokens/day) & 30 GB Vault Storage', included: true },
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
      sublabel: currentPlan === 'free' ? '5 daily chats' : currentPlan === 'spark' ? '1,500/day' : '5,000/day cap',
    },
    {
      label: 'Web Searches',
      used: usage.searchesUsed,
      limit: effectiveSearchLimit,
      icon: Globe,
      sublabel: currentPlan === 'free' ? '5 searches/day' : currentPlan === 'spark' ? '750/day' : '2,500/day cap',
    },
    {
      label: 'Deep Research',
      used: usage.deepResearchUsed,
      limit: effectiveDeepResearchLimit,
      icon: Layers,
      sublabel: currentPlan === 'free' ? '3 daily runs' : currentPlan === 'spark' ? '100 runs/day' : '300 runs/day',
    },
    {
      label: 'PDF Studio',
      used: usage.pdfStudyUsed,
      limit: effectivePdfStudyLimit,
      icon: FileText,
      sublabel: currentPlan === 'free' ? '5 study runs' : currentPlan === 'spark' ? '200 runs/day' : '500 runs/day',
    },
  ];

  const anyFreeLimitReached =
    currentPlan === 'free' &&
    allowanceCards.some((c) => c.used >= c.limit);

  const comparisonRows = [
    {
      id: 'personal-agents',
      category: 'models' as const,
      categoryLabel: 'AI Models & Personal Study Agents',
      feature: 'Personal Study Agents & The Vault',
      subtext: 'Auto-organization (Sage), SM-2 Recall, Exam Planner, Doubt Buddy & Morning Brief',
      free: 'Vault (20 items) · No agents',
      spark: 'Sage + Recall (250K tok/day)',
      fire: 'All Agents + Morning Brief (1M tok/day)',
      freeTag: { label: '20 Vault Items', variant: 'neutral' as const },
      sparkTag: { label: 'Sage + Recall', variant: 'unlocked' as const },
      fireTag: { label: 'All Agents + Brief', variant: 'highlight' as const },
    },
    {
      id: 'fast-chat',
      category: 'models' as const,
      categoryLabel: 'AI Models & Personal Study Agents',
      feature: 'Fast Reasoning & Chat',
      subtext: 'DeepSeek V3.2 Flash · 1M context',
      free: 'Standard Speed',
      spark: 'High-Priority 10x Speed',
      fire: 'Zero-Queue Priority',
      freeTag: { label: 'Included', variant: 'included' as const },
      sparkTag: { label: '10x Speed', variant: 'included' as const },
      fireTag: { label: 'Priority', variant: 'highlight' as const },
    },
    {
      id: 'multimodal-vision',
      category: 'models' as const,
      categoryLabel: 'AI Models & Personal Study Agents',
      feature: 'Multimodal & Vision Analysis',
      subtext: 'High-resolution image, chart & diagram OCR',
      free: 'Standard Res',
      spark: 'High Resolution',
      fire: 'Max Resolution',
      freeTag: { label: 'Included', variant: 'included' as const },
      sparkTag: { label: 'High-Res', variant: 'included' as const },
      fireTag: { label: 'Max-Res', variant: 'highlight' as const },
    },
    {
      id: 'advanced-reasoning',
      category: 'models' as const,
      categoryLabel: 'AI Models & Personal Study Agents',
      feature: 'Advanced Reasoning Models',
      subtext: 'DeepSeek R1, Claude 3.7 Sonnet, Qwen 2.5',
      free: `Locked (${pt.spark.monthly} Spark)`,
      spark: 'Unlocked (1,500/day)',
      fire: 'Unlocked (5,000/day)',
      freeTag: { label: `Locked (${pt.spark.monthly})`, variant: 'locked' as const },
      sparkTag: { label: 'Unlocked · 1,500/day', variant: 'unlocked' as const },
      fireTag: { label: '5,000 / day', variant: 'highlight' as const },
    },
    {
      id: 'frontier-flagship',
      category: 'models' as const,
      categoryLabel: 'AI Models & Personal Study Agents',
      feature: 'Frontier Flagships',
      subtext: 'Claude 3.7 Sonnet (Thinking), GPT-4.5, Grok 3',
      free: `Locked (${pt.fire.monthly} Fire)`,
      spark: `Locked (${pt.fire.monthly} Fire)`,
      fire: 'Unlocked (5,000/day)',
      freeTag: { label: `Locked (${pt.fire.monthly})`, variant: 'locked' as const },
      sparkTag: { label: `Locked (${pt.fire.monthly})`, variant: 'locked' as const },
      fireTag: { label: 'Unlocked', variant: 'highlight' as const },
    },
    {
      id: 'daily-prompts',
      category: 'quotas' as const,
      categoryLabel: 'Daily Quotas & Limits',
      feature: 'Daily Messages & Prompts',
      subtext: 'Resets daily at 00:00 UTC',
      free: '5 / day',
      spark: '1,500 / day',
      fire: '5,000 / day',
      freeTag: { label: '5 / day', variant: 'neutral' as const },
      sparkTag: { label: '1,500 / day', variant: 'unlocked' as const },
      fireTag: { label: '5,000 / day', variant: 'highlight' as const },
    },
    {
      id: 'file-uploads',
      category: 'quotas' as const,
      categoryLabel: 'Daily Quotas & Limits',
      feature: 'File & Document Uploads',
      subtext: 'PDFs, spreadsheets, code & images',
      free: '3 / day (2/msg)',
      spark: '250 / day (25/msg)',
      fire: '1,000 / day (50/msg)',
      freeTag: { label: '3 / day', variant: 'neutral' as const },
      sparkTag: { label: '250 / day', variant: 'unlocked' as const },
      fireTag: { label: '1,000 / day', variant: 'highlight' as const },
    },
    {
      id: 'web-search',
      category: 'quotas' as const,
      categoryLabel: 'Daily Quotas & Limits',
      feature: 'Live Web & News Search',
      subtext: 'Real-time verified source citations',
      free: '5 / day',
      spark: '750 / day',
      fire: '2,500 / day',
      freeTag: { label: '5 / day', variant: 'neutral' as const },
      sparkTag: { label: '750 / day', variant: 'unlocked' as const },
      fireTag: { label: '2,500 / day', variant: 'highlight' as const },
    },
    {
      id: 'deep-research',
      category: 'quotas' as const,
      categoryLabel: 'Daily Quotas & Limits',
      feature: 'Autonomous Deep Research',
      subtext: 'Multi-source synthesis reports',
      free: '3 / day',
      spark: '100 / day',
      fire: '300 / day',
      freeTag: { label: '3 / day', variant: 'neutral' as const },
      sparkTag: { label: '100 / day', variant: 'unlocked' as const },
      fireTag: { label: '300 / day', variant: 'highlight' as const },
    },
    {
      id: 'study-studio',
      category: 'quotas' as const,
      categoryLabel: 'Daily Quotas & Limits',
      feature: 'PDF Studio & Exam Quizzes',
      subtext: 'Interactive quizzes, flashcards & summaries',
      free: '5 / day',
      spark: '200 / day',
      fire: '500 / day',
      freeTag: { label: '5 / day', variant: 'neutral' as const },
      sparkTag: { label: '200 / day', variant: 'unlocked' as const },
      fireTag: { label: '500 / day', variant: 'highlight' as const },
    },
    {
      id: 'tokens-vault',
      category: 'quotas' as const,
      categoryLabel: 'Daily Quotas & Limits',
      feature: 'Daily Token Allowance & Cloud Vault',
      subtext: 'Workspace storage & document persistence',
      free: '250K tokens · 20 Vault items',
      spark: '10M tokens · 10 GB',
      fire: '25M tokens · 30 GB',
      freeTag: { label: '20 Vault Items', variant: 'neutral' as const },
      sparkTag: { label: '10 GB Vault', variant: 'unlocked' as const },
      fireTag: { label: '30 GB Vault', variant: 'highlight' as const },
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
    currentPlan === 'fire' ? '30 GB' : currentPlan === 'spark' ? '10 GB' : '100 MB';

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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
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
                Frontier Active · Fire
              </span>
            )}
          </div>
          <p className={`text-xs sm:text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
            Start on the Free Tier ({selectedCountry === 'IN' ? '₹0' : '$0'}), upgrade to Spark ({pt.spark.monthly}) for 10x daily limits + Sage &amp; Recall agents, or unlock Fire ({pt.fire.monthly}) for 5,000 daily prompts + all personal study agents.
          </p>
        </div>

        {/* 3-Dash Indicator (Free, Spark, Fire) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {[
            { idx: 0, label: 'Free Tier' },
            { idx: 1, label: `Spark (${pt.spark.monthly})` },
            { idx: 2, label: `Fire (${pt.fire.monthly})` },
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

      {/* Country Selector + Adaptive Currency & Local Payment Method Badges Bar */}
      <div
        className={`mb-6 p-4 sm:p-5 rounded-3xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm ${
          isDark ? 'bg-[#141418] border-white/12 text-white' : 'bg-white border-black/10 text-[#18181b]'
        }`}
      >
        {/* Searchable Country Dropdown */}
        <div className="relative shrink-0">
          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Billing Country & Local Currency
          </div>
          <button
            type="button"
            onClick={() => setCountryDropdownOpen((prev) => !prev)}
            className={`w-full sm:w-72 px-3.5 py-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs font-semibold transition-all cursor-pointer ${
              isDark
                ? 'bg-[#18181b] border-white/15 hover:border-white/30 text-white'
                : 'bg-[#fafafa] border-black/15 hover:border-black/30 text-[#18181b]'
            }`}
            data-testid="country-selector-button"
          >
            {(() => {
              const activeC = countries.find((c) => c.code === selectedCountry) || {
                code: selectedCountry,
                name: selectedCountry === 'IN' ? 'India' : selectedCountry === 'US' ? 'United States' : selectedCountry,
                flag: selectedCountry === 'IN' ? '🇮🇳' : '🌐',
                currency: selectedCountry === 'IN' ? 'INR' : 'USD',
              };
              return (
                <span className="flex items-center gap-2 truncate">
                  <span className="text-base leading-none">{activeC.flag}</span>
                  <span className="truncate">{activeC.name}</span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/10 text-neutral-300' : 'bg-black/5 text-neutral-600'}`}>
                    {activeC.code} · {activeC.currency}
                  </span>
                </span>
              );
            })()}
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {countryDropdownOpen && (
            <div
              className={`absolute left-0 mt-2 w-full sm:w-80 rounded-2xl border shadow-2xl z-40 p-2 ${
                isDark ? 'bg-[#18181b] border-white/15 text-white' : 'bg-white border-black/15 text-[#18181b]'
              }`}
            >
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-2 ${isDark ? 'bg-black/40 border-white/10' : 'bg-neutral-50 border-black/10'}`}>
                <Search className="w-3.5 h-3.5 opacity-60 shrink-0" />
                <input
                  type="text"
                  value={countrySearchQuery}
                  onChange={(e) => setCountrySearchQuery(e.target.value)}
                  placeholder="Search country or ISO code (e.g. India, IN)..."
                  className="w-full bg-transparent text-xs outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                {countries
                  .filter((c) => {
                    const q = countrySearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      c.name.toLowerCase().includes(q) ||
                      c.code.toLowerCase().includes(q) ||
                      c.currency.toLowerCase().includes(q)
                    );
                  })
                  .map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCountry(c.code)}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        c.code === selectedCountry
                          ? 'bg-[#FC4C01] text-white font-semibold'
                          : isDark
                          ? 'hover:bg-white/10 text-neutral-200'
                          : 'hover:bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{c.flag}</span>
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="font-mono text-[10px] opacity-80 shrink-0">
                        {c.code} ({c.currency})
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Supported Recurring Payment Method Badges for Selected Country */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Supported Subscription Methods ({selectedCountry})
            </span>
            {selectedCountry === 'IN' && (
              <span className="text-[11px] font-semibold text-[#FC4C01]">
                UPI AutoPay &amp; RuPay e-Mandates Supported
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="payment-method-badges">
            {(paymentMethodsInfo?.subscriptionMethods || [
              { id: 'credit_debit', label: 'Credit / Debit Cards', prominent: true },
              { id: 'apple_pay', label: 'Apple Pay' },
            ]).map((m) => (
              <span
                key={m.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  m.prominent
                    ? 'bg-[#FC4C01]/15 text-[#FC4C01] border-[#FC4C01]/35'
                    : isDark
                    ? 'bg-white/[0.05] text-neutral-200 border-white/10'
                    : 'bg-neutral-100 text-neutral-800 border-black/10'
                }`}
              >
                <CreditCard className="w-3 h-3 opacity-75 shrink-0" />
                <span>{m.label}</span>
              </span>
            ))}
          </div>
          {paymentMethodsInfo?.mandateNote && (
            <p className={`text-[11px] mt-1.5 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {paymentMethodsInfo.mandateNote}
            </p>
          )}
        </div>
      </div>

      {/* Guest Sign-In Required Prompt when guest clicks Upgrade */}
      {guestSignInPromptPlan && !isFirebaseSignedIn && (
        <div
          className={`mb-6 p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
            isDark ? 'bg-[#18181b] border-[#FC4C01]/50 text-white' : 'bg-white border-[#FC4C01]/50 text-[#18181b]'
          }`}
        >
          <div className="space-y-1">
            <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#FC4C01] shrink-0" />
              <span>
                Sign in required to subscribe to Kinich {guestSignInPromptPlan === 'fire' ? `Fire (${pt.fire.monthly})` : `Spark (${pt.spark.monthly})`}
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              Subscriptions and entitlements are bound to your verified Firebase account so your plan syncs across devices.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('kinich-navigate-route', { detail: { path: '/account' } }));
              }}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer transition-all"
            >
              Sign In / Create Account →
            </button>
          </div>
        </div>
      )}

      {/* Always-Visible Subscription, Cancellation & Refund (Get Money Back) Panel */}
      <div
        className={`mb-6 p-5 sm:p-6 rounded-3xl border shadow-sm space-y-4 ${
          isDark ? 'bg-[#141418] border-white/15 text-white' : 'bg-white border-black/10 text-[#18181b]'
        }`}
      >
        {/* Status Warning Banner for past_due / on_hold / cancelled */}
        {(billingMe?.planStatus === 'past_due' || billingMe?.planStatus === 'on_hold') && (
          <div className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300">
                  {billingMe.planStatus === 'on_hold'
                    ? 'Subscription On Hold — Renewal Payment Failed'
                    : 'Payment Past Due — Retrying Renewal'}
                </div>
                <div className={isDark ? 'text-neutral-300 mt-0.5' : 'text-neutral-700 mt-0.5'}>
                  {billingMe.planStatus === 'on_hold'
                    ? 'Your subscription is paused until a valid payment method is confirmed. Update your payment method to restore paid access immediately.'
                    : 'Your most recent renewal charge did not succeed. Please update your payment method so your access continues uninterrupted.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUpdatePaymentMethod}
              disabled={updateMethodBusy}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#FC4C01] hover:bg-[#e04300] text-white shrink-0 cursor-pointer"
            >
              {updateMethodBusy ? 'Opening...' : 'Update Payment Method'}
            </button>
          </div>
        )}

        {Boolean(billingMe?.cancelAtPeriodEnd) && (
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-[#FC4C01]">Scheduled to Cancel: </span>
              <span>
                Your {String(billingMe?.plan || currentPlan).toUpperCase()} plan remains active
                {billingMe?.planPeriodEnd
                  ? ` until ${new Date(billingMe.planPeriodEnd).toLocaleDateString()}`
                  : ' until the end of your current period'}{' '}
                and will not auto-renew.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCancelSubscription(false, true, false)}
                disabled={cancelBusy}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 shrink-0 cursor-pointer"
              >
                {cancelBusy ? 'Updating...' : 'Resume Subscription'}
              </button>
              <button
                type="button"
                onClick={() => handleCancelSubscription(false, false, true)}
                disabled={cancelBusy}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 shrink-0 cursor-pointer"
              >
                Cancel Immediately
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70">
              Subscription, Cancellation &amp; Refund (Get Money Back)
            </div>
            <div className="text-sm font-bold mt-0.5 flex flex-wrap items-center gap-2">
              <span>
                Plan: {String(billingMe?.plan && billingMe.plan !== 'free' ? billingMe.plan : currentPlan).toUpperCase()} (
                {billingMe?.planInterval || (billingCycle === 'annual' ? 'yearly' : 'monthly')})
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30">
                Status: {billingMe?.planStatus && billingMe.planStatus !== 'none' ? billingMe.planStatus : currentPlan !== 'free' ? 'active' : 'free / cancelled'}
              </span>
              {billingMe?.planPeriodEnd && (
                <span className="text-xs font-normal opacity-75">
                  · Next billing / period end: {new Date(billingMe.planPeriodEnd).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              <strong>How Cancellation vs. Refunds work:</strong> Cancelling a plan stops future charges, it does <u>not</u> automatically refund your payment. To get your money back (even if you already cancelled), click <strong>Get Money Back / Request Refund</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Always-Visible Prominent Refund Button */}
            <button
              type="button"
              onClick={() => {
                const defaultPayId =
                  billingMe?.latestRefundablePayment?.dodo_payment_id ||
                  billingMe?.payments?.find((p: any) => p.status !== 'refunded')?.dodo_payment_id ||
                  '';
                setRefundPaymentId(defaultPayId);
                setRefundDrawerOpen((prev) => !prev);
              }}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#FC4C01] hover:bg-[#e04300] text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{refundDrawerOpen ? 'Close Refund Form' : 'Get Money Back / Request Refund'}</span>
            </button>

            {/* Restore Spark Plan Button if user cancelled immediately and lost Spark */}
            {currentPlan === 'free' && (
              <button
                type="button"
                onClick={() => handleCancelSubscription(false, true, false)}
                disabled={cancelBusy}
                className="px-3.5 py-2 rounded-full text-xs font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer transition-all"
              >
                {cancelBusy ? 'Restoring...' : 'Restore My Spark Plan'}
              </button>
            )}

            {/* Cancel Auto-Renewal (Keep Plan Until Period End) */}
            {(currentPlan !== 'free' || billingMe?.planStatus === 'active') && !billingMe?.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={() => handleCancelSubscription(true, false, false)}
                disabled={cancelBusy}
                className="px-3.5 py-2 rounded-full text-xs font-semibold border border-amber-500/35 text-amber-400 hover:bg-amber-500/10 cursor-pointer transition-all"
              >
                {cancelBusy ? 'Updating...' : 'Cancel Auto-Renewal (Keep Spark)'}
              </button>
            )}

            {/* Cancel Immediately (No Refund) */}
            {(currentPlan !== 'free' || billingMe?.planStatus === 'active') && (
              <button
                type="button"
                onClick={() => handleCancelSubscription(false, false, true)}
                disabled={cancelBusy}
                className="px-3.5 py-2 rounded-full text-xs font-semibold border border-red-500/35 text-red-400 hover:bg-red-500/10 cursor-pointer transition-all"
              >
                {cancelBusy ? 'Cancelling...' : 'Cancel Plan Immediately'}
              </button>
            )}

            {billingMe?.dodoCustomerId && (
              <button
                type="button"
                onClick={handleOpenCustomerPortal}
                disabled={portalBusy}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-all ${
                  isDark
                    ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                    : 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-[#18181b]'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{portalBusy ? 'Opening Portal...' : 'Customer Portal & Invoices'}</span>
              </button>
            )}

            {billingMe?.dodoSubscriptionId && (
              <button
                type="button"
                onClick={handleUpdatePaymentMethod}
                disabled={updateMethodBusy}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
                  isDark
                    ? 'bg-white/5 hover:bg-white/10 border-white/15 text-neutral-200'
                    : 'bg-white hover:bg-neutral-100 border-black/10 text-neutral-800'
                }`}
              >
                {updateMethodBusy ? 'Loading...' : 'Update Payment Method'}
              </button>
            )}
          </div>
        </div>

        {/* Inline Refund Request Drawer */}
        {refundDrawerOpen && (
          <form
            onSubmit={handleRequestRefund}
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark ? 'bg-black/40 border-[#FC4C01]/40' : 'bg-[#FC4C01]/[0.03] border-[#FC4C01]/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#FC4C01]" />
                <span className="text-xs font-bold">
                  Get Money Back — Request Full Subscription Refund (7-Day Guarantee)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRefundDrawerOpen(false)}
                className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
              >
                Close
              </button>
            </div>
            <p className="text-[11px] opacity-75 leading-relaxed">
              Submit a refund request via Dodo Payments. Once confirmed, the full amount ({pt.spark.monthly} or {pt.fire.monthly}) is refunded back to your original payment method (UPI, Card, NetBanking, or Wallet) and your subscription is cancelled.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
                  Payment / Charge to Refund
                </label>
                <select
                  value={refundPaymentId}
                  onChange={(e) => setRefundPaymentId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark
                      ? 'bg-[#18181b] border-white/15 text-white'
                      : 'bg-white border-black/15 text-[#18181b]'
                  }`}
                >
                  {Array.isArray(billingMe?.payments) &&
                  billingMe.payments.filter((p: any) => p.status !== 'refunded').length > 0 ? (
                    billingMe.payments
                      .filter((p: any) => p.status !== 'refunded')
                      .map((p: any) => (
                        <option key={p.dodo_payment_id} value={p.dodo_payment_id}>
                          {p.dodo_payment_id} — {((Number(p.amount) || 0) / 100).toFixed(2)} {p.currency || 'USD'} (
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent'})
                        </option>
                      ))
                  ) : (
                    <option value="">
                      Most Recent Spark / Fire Charge ({pt.spark.monthly})
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
                  Refund Reason
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    isDark
                      ? 'bg-[#18181b] border-white/15 text-white'
                      : 'bg-white border-black/15 text-[#18181b]'
                  }`}
                >
                  <option value="requested_by_customer">Requested by customer (7-day guarantee)</option>
                  <option value="cancelled_and_want_refund">Cancelled Spark plan and want my money back</option>
                  <option value="accidental_purchase">Accidental purchase or wrong billing cycle</option>
                  <option value="duplicate">Duplicate charge</option>
                  <option value="not_satisfied">Features did not meet expectations</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
                Additional Details (Optional)
              </label>
              <input
                type="text"
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
                placeholder="Optional note or Dodo payment ID (e.g. pay_...)..."
                className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                  isDark
                    ? 'bg-[#18181b] border-white/15 text-white placeholder:text-neutral-500'
                    : 'bg-white border-black/15 text-[#18181b] placeholder:text-neutral-400'
                }`}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={refundCancelSub}
                  onChange={(e) => setRefundCancelSub(e.target.checked)}
                  className="rounded accent-[#FC4C01]"
                />
                <span>Also cancel active subscription &amp; stop future renewals</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRefundDrawerOpen(false)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
                    isDark ? 'border-white/15 text-neutral-300' : 'border-black/15 text-neutral-700'
                  }`}
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={refundBusy}
                  className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer transition-all disabled:opacity-50"
                >
                  {refundBusy ? 'Processing Refund...' : 'Confirm & Process Refund Now'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Last 10 Payments History Table */}
        {Array.isArray(billingMe?.payments) && billingMe.payments.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5 opacity-80">
              <Receipt className="w-3.5 h-3.5" />
              <span>Recent Payments &amp; Tax Invoices</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="opacity-60 border-b border-current/10">
                    <th className="py-1.5 pr-3">Date</th>
                    <th className="py-1.5 px-3">Amount</th>
                    <th className="py-1.5 px-3">Method</th>
                    <th className="py-1.5 px-3">Status</th>
                    <th className="py-1.5 pl-3 text-right">Actions / Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-current/5">
                  {billingMe.payments.map((p: any) => {
                    const isRefunded = p.status === 'refunded';
                    return (
                      <tr key={p.dodo_payment_id}>
                        <td className="py-2 pr-3 font-mono">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold">
                          {((Number(p.amount) || 0) / 100).toFixed(2)} {p.currency || 'USD'}
                        </td>
                        <td className="py-2 px-3">{p.payment_method || 'card'}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isRefunded
                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                : 'bg-white/10'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 pl-3 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {!isRefunded && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefundPaymentId(p.dodo_payment_id);
                                  setRefundDrawerOpen(true);
                                }}
                                className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-[#FC4C01]/35 text-[#FC4C01] hover:bg-[#FC4C01]/10 cursor-pointer"
                              >
                                Refund
                              </button>
                            )}
                            {p.invoice_url ? (
                              <a
                                href={p.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#FC4C01] hover:underline font-semibold"
                              >
                                Receipt →
                              </a>
                            ) : (
                              <span className="opacity-50">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Processed Refunds Log */}
        {Array.isArray(billingMe?.refunds) && billingMe.refunds.length > 0 && (
          <div className="pt-3 border-t border-white/10">
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-sky-400">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Processed Refunds ({billingMe.refunds.length})</span>
            </div>
            <div className="space-y-1.5">
              {billingMe.refunds.map((r: any) => (
                <div
                  key={r.dodo_refund_id}
                  className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-neutral-50 border-black/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sky-400">{r.dodo_refund_id}</span>
                    <span className="opacity-70">· {r.reason || 'Customer refund request'}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    {r.amount ? (
                      <span className="font-bold">
                        {((Number(r.amount) || 0) / 100).toFixed(2)} {r.currency || 'USD'}
                      </span>
                    ) : null}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/15 text-sky-400">
                      {r.status || 'succeeded'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
              Select Spark ({pt.spark.monthly}) for 10x daily limits or Fire ({pt.fire.monthly}) for 5,000 daily prompts &amp; all personal agents below.
            </div>
          </div>
          {currentPlan === 'free' && (
            <button
              type="button"
              onClick={() => handleSelectPlan('spark')}
              className="px-4 py-2 rounded-full text-xs font-bold bg-[#FC4C01] hover:bg-[#e04300] text-white shrink-0 cursor-pointer transition-all"
            >
              Unlock Spark ({pt.spark.monthly})
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
          <div className="flex items-center gap-2.5 flex-wrap">
            <Check className="w-4 h-4 shrink-0" />
            <span>{upgradeBanner}</span>
            {dodoSessionId && (
              <span className="font-mono text-[11px] opacity-75">
                ({dodoSessionId})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(true)}
              className="px-3 py-1.5 rounded-full font-medium text-xs border border-current opacity-80 hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gateway Live Status</span>
            </button>
            {dodoCheckoutUrl && (
              <a
                href={dodoCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-full font-semibold text-xs bg-[#FC4C01] text-white hover:bg-[#e04300] transition-colors"
              >
                Open Dodo Checkout →
              </a>
            )}
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
                ? `Fire (${pt.fire.monthly} · 5,000 Daily Prompts)`
                : currentPlan === 'spark'
                ? `Spark (${pt.spark.monthly} · 10x Daily Limits)`
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
            const rawPct = Math.min(100, Math.round((stat.used / Math.max(1, stat.limit)) * 100));
            const isExhausted = stat.used >= stat.limit;
            const isWarning = !isExhausted && rawPct >= 75;
            const remaining = Math.max(0, stat.limit - stat.used);

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
                      isExhausted
                        ? 'bg-red-500/20 text-red-400'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-400'
                        : isDark
                        ? 'bg-white/10 text-neutral-400'
                        : 'bg-black/5 text-neutral-600'
                    }`}
                  >
                    {isExhausted ? 'Limit Hit' : `${remaining.toLocaleString()} left`}
                  </span>
                </div>

                <div
                  className={`w-full h-1.5 rounded-full mt-2.5 overflow-hidden ${
                    isDark ? 'bg-white/10' : 'bg-black/10'
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      isExhausted
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
                ? `Free + Spark (${pt.spark.monthly}) Models`
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
                Upgrade to Spark ({pt.spark.monthly})
              </button>
              <button
                type="button"
                onClick={() => handleSelectPlan('fire')}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#FC4C01] text-white hover:bg-[#e04300] cursor-pointer transition-all"
              >
                Unlock Fire ({pt.fire.monthly})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3 Pricing Cards: Free ($0), Spark ($3), Fire ($7) — Uniform 2-badge system & flex-1 aligned layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto gap-6 items-stretch mb-4">
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
              {selectedCountry === 'IN' ? '₹0' : '$0'}
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
            <strong>3 deep research runs</strong>, and <strong>5 PDF study sessions</strong> with
            fast multimodal reasoning.
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

          {(() => {
            const previewKey = billingCycle === 'annual' ? 'spark_yearly' : 'spark_monthly';
            const p = pricePreviews[previewKey];
            return (
              <div className="mt-1 mb-3 min-h-[58px]">
                {previewLoading ? (
                  <div className="h-10 w-44 rounded-xl bg-white/10 animate-pulse" />
                ) : (
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
                      {billingCycle === 'annual' ? pt.spark.yearly : pt.spark.monthly}
                    </span>
                    <span className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {billingCycle === 'annual'
                        ? `(≈${pt.spark.monthlyEquiv}/mo)`
                        : '· billed monthly'}
                    </span>
                  </div>
                )}
                {!previewLoading && p && selectedCountry !== 'IN' && (
                  <div className={`text-[11px] mt-1 font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Base ${p.usdReferencePrice} USD · Tax: {p.formattedTax || '$0.00'} ({p.currency})
                  </div>
                )}
              </div>
            );
          })()}

          <p
            className={`text-xs leading-relaxed mb-5 min-h-[38px] ${
              isDark ? 'text-neutral-300' : 'text-neutral-600'
            }`}
          >
            High-volume research plan with <strong>10x quotas</strong> across
            file uploads, daily prompts, real-time web search, and deep research.
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

          <div className="pt-2 mt-auto flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan('spark');
              }}
              disabled={currentPlan === 'spark' || checkoutBusyPlan === 'spark'}
              className={`w-full max-w-[260px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${
                currentPlan === 'spark'
                  ? 'bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/35 cursor-default'
                  : isDark
                  ? 'bg-white hover:bg-neutral-200 text-[#18181b] active:scale-95'
                  : 'bg-[#18181b] hover:bg-neutral-800 text-white active:scale-95'
              }`}
            >
              {checkoutBusyPlan === 'spark'
                ? 'Creating Dodo Checkout...'
                : currentPlan === 'spark'
                ? 'Active Spark Plan'
                : `Start Spark — ${
                    pricePreviews[billingCycle === 'annual' ? 'spark_yearly' : 'spark_monthly']?.formattedTotal ||
                    (billingCycle === 'annual' ? pt.spark.yearly : pt.spark.monthly)
                  }`}
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
                All Agents
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

          {(() => {
            const previewKey = billingCycle === 'annual' ? 'fire_yearly' : 'fire_monthly';
            const p = pricePreviews[previewKey];
            return (
              <div className="mt-1 mb-3 min-h-[58px]">
                {previewLoading ? (
                  <div className="h-10 w-44 rounded-xl bg-white/10 animate-pulse" />
                ) : (
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
                      {billingCycle === 'annual' ? pt.fire.yearly : pt.fire.monthly}
                    </span>
                    <span className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                      {billingCycle === 'annual'
                        ? `(≈${pt.fire.monthlyEquiv}/mo)`
                        : '· billed monthly'}
                    </span>
                  </div>
                )}
                {!previewLoading && p && selectedCountry !== 'IN' && (
                  <div className={`text-[11px] mt-1 font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Base ${p.usdReferencePrice} USD · Tax: {p.formattedTax || '$0.00'} ({p.currency})
                  </div>
                )}
              </div>
            );
          })()}

          <p
            className={`text-xs leading-relaxed mb-5 min-h-[38px] ${
              isDark ? 'text-neutral-300' : 'text-neutral-600'
            }`}
          >
            Maximize study &amp; research performance with 5,000 daily prompts, 1,000 daily file uploads,
            all personal study agents + Morning Brief, and zero-queue priority.
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

          <div className="pt-2 mt-auto flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan('fire');
              }}
              disabled={currentPlan === 'fire' || checkoutBusyPlan === 'fire'}
              className={`w-full max-w-[260px] py-3 px-6 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm ${
                currentPlan === 'fire'
                  ? 'bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/35 cursor-default'
                  : 'bg-[#FC4C01] hover:bg-[#e04300] text-white active:scale-95'
              }`}
            >
              {checkoutBusyPlan === 'fire'
                ? 'Creating Dodo Checkout...'
                : currentPlan === 'fire'
                ? 'Active Fire Plan'
                : `Start Fire — ${
                    pricePreviews[billingCycle === 'annual' ? 'fire_yearly' : 'fire_monthly']?.formattedTotal ||
                    (billingCycle === 'annual' ? pt.fire.yearly : pt.fire.monthly)
                  }`}
            </button>
          </div>
        </div>
      </div>

      {/* Merchant of Record Disclosure & Real-Time Gateway Status */}
      <div className={`text-center text-xs mb-10 flex flex-col sm:flex-row items-center justify-center gap-3 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
        <span>
          Payments processed securely by <strong>Dodo Payments</strong>, our Merchant of Record. Local taxes, VAT/GST, and currency conversion are calculated automatically at checkout.
        </span>
        <button
          type="button"
          onClick={() => setIsStatusModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800/80 hover:bg-neutral-700/80 border border-neutral-700/70 text-neutral-300 hover:text-white transition text-[11px] font-medium shrink-0 cursor-pointer shadow-sm"
          title="Check real-time payment gateway status and response latency"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Gateway Status: Operational</span>
        </button>
      </div>

      {/* Interactive Plan & Model Access Comparison Matrix */}
      <div
        className={`rounded-3xl border p-5 sm:p-7 shadow-sm transition-all ${
          isDark ? 'bg-[#141418] border-white/12 text-white' : 'bg-white border-black/10 text-[#18181b]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">
              Plan Quotas &amp; Model Access Matrix
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Compare daily limits, reasoning model tiers, and storage across plans.
            </p>
          </div>

          {/* Filter Category Tabs */}
          <div
            className={`inline-flex items-center p-1 rounded-xl border self-start ${
              isDark ? 'bg-black/40 border-white/10' : 'bg-neutral-100 border-black/10'
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  matrixTab === tab.id
                    ? isDark
                      ? 'bg-white text-black shadow-xs'
                      : 'bg-[#18181b] text-white shadow-xs'
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

        {/* Mobile View: High-fidelity Plan Switcher with No Cramped Wrapping */}
        <div className="md:hidden space-y-4">
          <div
            className={`p-1 rounded-2xl border flex items-center gap-1 ${
              isDark ? 'bg-black/50 border-white/10' : 'bg-neutral-100 border-black/10'
            }`}
          >
            {[
              { id: 'spark' as const, label: `Spark (${pt.spark.monthly})` },
              { id: 'fire' as const, label: `Fire (${pt.fire.monthly})` },
              { id: 'free' as const, label: 'Free ($0)' },
              { id: 'compare' as const, label: 'All Plans' },
            ].map((tab) => {
              const isSelected = mobileMatrixPlan === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMobileMatrixPlan(tab.id)}
                  className={`flex-1 py-2 px-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    isSelected
                      ? tab.id === 'spark'
                        ? 'bg-[#FC4C01] text-white shadow-xs'
                        : tab.id === 'fire'
                        ? isDark
                          ? 'bg-white text-black shadow-xs'
                          : 'bg-[#18181b] text-white shadow-xs'
                        : isDark
                        ? 'bg-white/20 text-white shadow-xs'
                        : 'bg-white text-neutral-900 shadow-xs'
                      : isDark
                      ? 'text-neutral-400 hover:text-white'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* When a specific plan is picked on mobile */}
          {mobileMatrixPlan !== 'compare' ? (
            <div className="space-y-2.5">
              {visibleComparisonRows.map((row) => {
                const val =
                  mobileMatrixPlan === 'free'
                    ? row.free
                    : mobileMatrixPlan === 'spark'
                    ? row.spark
                    : row.fire;
                const tag =
                  mobileMatrixPlan === 'free'
                    ? row.freeTag
                    : mobileMatrixPlan === 'spark'
                    ? row.sparkTag
                    : row.fireTag;
                const isLocked = tag?.variant === 'locked';

                return (
                  <div
                    key={row.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isDark ? 'bg-white/[0.03] border-white/8' : 'bg-neutral-50/90 border-black/8'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold tracking-tight text-foreground">
                          {row.feature}
                        </div>
                        {row.subtext && (
                          <div
                            className={`text-[11px] mt-0.5 leading-snug ${
                              isDark ? 'text-neutral-400' : 'text-neutral-500'
                            }`}
                          >
                            {row.subtext}
                          </div>
                        )}
                      </div>

                      <span
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-tight ${
                          tag?.variant === 'highlight'
                            ? 'bg-[#FC4C01] text-white shadow-2xs'
                            : tag?.variant === 'unlocked'
                            ? isDark
                              ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                            : tag?.variant === 'included'
                            ? isDark
                              ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : tag?.variant === 'locked'
                            ? isDark
                              ? 'bg-white/5 text-neutral-400 border border-white/10'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                            : isDark
                            ? 'bg-white/10 text-neutral-200 border border-white/10'
                            : 'bg-neutral-200 text-neutral-800'
                        }`}
                      >
                        {isLocked && <Lock className="w-3 h-3 shrink-0" />}
                        <span>{val}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Multi-Plan Accordion View when "All Plans" is selected on mobile */
            <div className="space-y-3">
              {(['spark', 'fire', 'free'] as const).map((planKey) => {
                const isExpanded = mobileExpandedPlan === planKey;
                const planTitle =
                  planKey === 'fire'
                    ? `Fire (${pt.fire.monthly} · Flagship + All Agents)`
                    : planKey === 'spark'
                    ? `Spark (${pt.spark.monthly} · 10x Limits)`
                    : 'Free Tier ($0 · Starter)';
                const accentColor =
                  planKey === 'fire'
                    ? 'text-orange-400'
                    : planKey === 'spark'
                    ? 'text-amber-400'
                    : '';

                return (
                  <div
                    key={planKey}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      isDark ? 'bg-white/[0.03] border-white/10' : 'bg-neutral-50 border-black/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setMobileExpandedPlan(isExpanded ? null : planKey)}
                      className="w-full p-4 flex items-center justify-between text-xs font-bold cursor-pointer"
                    >
                      <span className={accentColor}>{planTitle}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div
                        className={`px-3.5 pb-3.5 pt-1 space-y-2 border-t text-xs ${
                          isDark
                            ? 'border-white/10 text-neutral-300'
                            : 'border-black/10 text-neutral-700'
                        }`}
                      >
                        {visibleComparisonRows.map((row) => {
                          const val =
                            planKey === 'free'
                              ? row.free
                              : planKey === 'spark'
                              ? row.spark
                              : row.fire;
                          const tag =
                            planKey === 'free'
                              ? row.freeTag
                              : planKey === 'spark'
                              ? row.sparkTag
                              : row.fireTag;
                          const isLocked = tag?.variant === 'locked';

                          return (
                            <div
                              key={row.id}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                                isDark
                                  ? 'bg-black/30 border-white/6'
                                  : 'bg-white border-black/6'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-xs tracking-tight block truncate">
                                  {row.feature}
                                </span>
                                {row.subtext && (
                                  <span
                                    className={`text-[10.5px] block truncate ${
                                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                                    }`}
                                  >
                                    {row.subtext}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  tag?.variant === 'highlight'
                                    ? 'bg-[#FC4C01] text-white'
                                    : tag?.variant === 'unlocked'
                                    ? isDark
                                      ? 'text-amber-300 bg-amber-400/10'
                                      : 'text-amber-700 bg-amber-50'
                                    : tag?.variant === 'included'
                                    ? isDark
                                      ? 'text-emerald-300 bg-emerald-400/10'
                                      : 'text-emerald-700 bg-emerald-50'
                                    : tag?.variant === 'locked'
                                    ? 'text-neutral-500'
                                    : isDark
                                    ? 'text-neutral-200'
                                    : 'text-neutral-800'
                                }`}
                              >
                                {isLocked && <Lock className="w-3 h-3 shrink-0" />}
                                <span>{val}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                <th className="py-3.5 pr-4 font-semibold text-xs tracking-tight">Feature &amp; Capability</th>
                <th className="py-3.5 px-4 font-semibold text-xs tracking-tight">Free Tier ($0)</th>
                <th className="py-3.5 px-4 font-semibold text-xs tracking-tight text-amber-500 dark:text-amber-400">
                  Spark ({pt.spark.monthly} · Popular)
                </th>
                <th className="py-3.5 pl-4 font-semibold text-xs tracking-tight text-[#FC4C01]">
                  Fire ({pt.fire.monthly} · Flagship)
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/6' : 'divide-black/6'}`}>
              {visibleComparisonRows.map((row) => {
                const isFreeLocked = row.freeTag?.variant === 'locked';
                const isSparkLocked = row.sparkTag?.variant === 'locked';
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'
                    }`}
                  >
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-xs tracking-tight">{row.feature}</div>
                      {row.subtext && (
                        <div
                          className={`text-[11px] mt-0.5 ${
                            isDark ? 'text-neutral-400' : 'text-neutral-500'
                          }`}
                        >
                          {row.subtext}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {isFreeLocked ? (
                        <span className="inline-flex items-center gap-1.5 text-neutral-500">
                          <Lock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          <span>{row.free}</span>
                        </span>
                      ) : row.freeTag?.variant === 'included' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{row.free}</span>
                        </span>
                      ) : (
                        <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
                          {row.free}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {isSparkLocked ? (
                        <span className="inline-flex items-center gap-1.5 text-neutral-500">
                          <Lock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          <span>{row.spark}</span>
                        </span>
                      ) : row.sparkTag?.variant === 'included' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{row.spark}</span>
                        </span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            isDark ? 'text-amber-300' : 'text-amber-800'
                          }`}
                        >
                          {row.spark}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 pl-4 font-semibold text-[#FC4C01]">
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>{row.fire}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Dodo Payments Status & Reassurance Modal */}
      <DodoStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onContinueCheckout={checkoutBusyPlan ? () => handleSelectPlan(checkoutBusyPlan) : undefined}
      />
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

