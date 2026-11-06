import React, { useState, useEffect } from 'react';
import {
  Receipt,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchLast10Invoices,
  fetchUserRefunds,
  requestSubscriptionRefund,
  cancelUserSubscription,
  InvoiceItem,
  RefundItem,
} from '../lib/billing';
import { auth, getAuthHeaders } from '../lib/firebase';
import { UserAccountStore } from '../lib/userAccountStore';

interface BillingHistorySectionProps {
  isDark: boolean;
}

const REFUND_REASONS = [
  'Within 7-day money-back guarantee',
  'Accidental or unintended purchase',
  'Not satisfied with features or performance',
  'Switching to a different billing plan or interval',
  'Duplicate or unexpected billing charge',
];

export const BillingHistorySection: React.FC<BillingHistorySectionProps> = ({ isDark }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [payments, setPayments] = useState<InvoiceItem[]>([]);
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [billingMe, setBillingMe] = useState<any | null>(null);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'spark' | 'fire'>(() =>
    UserAccountStore.getNormalizedPlan()
  );
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [cancelBusy, setCancelBusy] = useState<boolean>(false);
  const [portalBusy, setPortalBusy] = useState<boolean>(false);
  const [refundModalOpen, setRefundModalOpen] = useState<boolean>(false);
  const [selectedRefundPaymentId, setSelectedRefundPaymentId] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>(REFUND_REASONS[0]);
  const [customRefundNote, setCustomRefundNote] = useState<string>('');
  const [cancelSubOnRefund, setCancelSubOnRefund] = useState<boolean>(true);
  const [refundBusy, setRefundBusy] = useState<boolean>(false);

  const fetchBillingHistory = async () => {
    if (!auth.currentUser || auth.currentUser.isAnonymous || UserAccountStore.isGuest()) {
      setPayments([]);
      setRefunds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [invoices, userRefunds, headers] = await Promise.all([
        fetchLast10Invoices(),
        fetchUserRefunds(),
        getAuthHeaders().catch(() => ({})),
      ]);
      setPayments(invoices);
      setRefunds(userRefunds);

      const res = await fetch('/api/billing/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setBillingMe(data);
        if (Array.isArray(data?.refunds) && data.refunds.length > 0 && userRefunds.length === 0) {
          setRefunds(data.refunds);
        }
        if (
          data?.authenticated &&
          (data.effectivePlan === 'spark' || data.effectivePlan === 'fire' || data.effectivePlan === 'free') &&
          data.planStatus !== 'none'
        ) {
          setCurrentPlan(data.effectivePlan);
        } else {
          setCurrentPlan(UserAccountStore.getNormalizedPlan());
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch billing history:', err);
      setError('Unable to load past invoices. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingHistory();
    const onAccountSync = () => {
      setCurrentPlan(UserAccountStore.getNormalizedPlan());
    };
    window.addEventListener('kinich-account-updated', onAccountSync);
    return () => window.removeEventListener('kinich-account-updated', onAccountSync);
  }, []);

  const handleCancelOrResume = async (options: {
    atPeriodEnd?: boolean;
    immediate?: boolean;
    resume?: boolean;
  }) => {
    setCancelBusy(true);
    setStatusMessage(null);
    try {
      const res = await cancelUserSubscription(options);
      if (res.success) {
        if (options.resume) {
          const restoredPlan = res.plan && res.plan !== 'free' ? res.plan : 'spark';
          UserAccountStore.upgradePlan(restoredPlan, 'monthly');
          setCurrentPlan(restoredPlan);
          setStatusMessage({
            type: 'success',
            text: res.message || `Your ${restoredPlan.toUpperCase()} plan has been restored and auto-renewal is active.`,
          });
        } else if (options.immediate) {
          UserAccountStore.upgradePlan('free', 'monthly');
          setCurrentPlan('free');
          setStatusMessage({
            type: 'success',
            text:
              res.message ||
              'Your subscription has been cancelled immediately and switched to the Free Tier. Click "Get Money Back / Request Refund" to refund your payment.',
          });
        } else {
          setStatusMessage({
            type: 'success',
            text:
              res.message ||
              'Auto-renewal cancelled. You keep full Spark/Fire access until the end of your current billing period.',
          });
        }
        await fetchBillingHistory();
      } else {
        if (options.resume) {
          UserAccountStore.upgradePlan('spark', 'monthly');
          setCurrentPlan('spark');
          setStatusMessage({
            type: 'success',
            text: 'Your Spark plan has been restored.',
          });
        } else if (options.immediate || options.atPeriodEnd) {
          UserAccountStore.upgradePlan('free', 'monthly');
          setCurrentPlan('free');
          setStatusMessage({
            type: 'success',
            text: 'Your plan has been cancelled and reverted to the Free Tier. Click "Get Money Back / Request Refund" to refund your charge.',
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: res.error || 'Could not update subscription cancellation status.',
          });
        }
      }
    } finally {
      setCancelBusy(false);
    }
  };

  const handleOpenPortal = async () => {
    setPortalBusy(true);
    setStatusMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = String(data.url);
        return;
      }
      setStatusMessage({
        type: 'error',
        text: data?.error || 'Customer portal is available after your first subscription checkout.',
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Unable to open Dodo Customer Portal right now.',
      });
    } finally {
      setPortalBusy(false);
    }
  };

  const openRefundDialogForPayment = (paymentId?: string) => {
    const defaultId =
      paymentId ||
      payments.find((p) => p.status === 'succeeded' || p.status === 'active')?.dodo_payment_id ||
      payments[0]?.dodo_payment_id ||
      '';
    setSelectedRefundPaymentId(defaultId);
    setRefundModalOpen(true);
    setStatusMessage(null);
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefundBusy(true);
    setStatusMessage(null);
    const combinedReason = customRefundNote.trim()
      ? `${refundReason} — ${customRefundNote.trim()}`
      : refundReason;

    try {
      const result = await requestSubscriptionRefund({
        paymentId: selectedRefundPaymentId || undefined,
        reason: combinedReason,
        cancelSubscription: cancelSubOnRefund,
      });

      if (result.success) {
        if (cancelSubOnRefund) {
          UserAccountStore.upgradePlan('free', 'monthly');
          setCurrentPlan('free');
        }
        setRefundModalOpen(false);
        setCustomRefundNote('');
        setStatusMessage({
          type: 'success',
          text: `Refund processed (${result.refund?.refund_id || 'confirmed'})${
            cancelSubOnRefund ? ' and subscription cancelled.' : '.'
          } Funds are returned to your original payment method via Dodo Payments.`,
        });
        await fetchBillingHistory();
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Could not process refund request.',
        });
      }
    } finally {
      setRefundBusy(false);
    }
  };

  const effectivePlan = billingMe?.effectivePlan && billingMe.effectivePlan !== 'free'
    ? billingMe.effectivePlan
    : currentPlan;
  const planStatus = billingMe?.planStatus || (effectivePlan !== 'free' ? 'active' : 'none');
  const cancelAtPeriodEnd = Boolean(billingMe?.cancelAtPeriodEnd || billingMe?.cancelAtNextBillingDate);
  const periodEnd = billingMe?.planPeriodEnd || billingMe?.currentPeriodEnd || null;

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl border space-y-5 transition-all ${
        isDark ? 'bg-white/[0.02] border-white/10 text-white' : 'bg-white border-black/15 text-[#18181b] shadow-xs'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-500/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-[#FC4C01]">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold tracking-tight">
              Subscription Management, Refunds &amp; Invoices
            </h3>
            <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Manage your plan, cancel anytime, request a 7-day refund, or download tax invoices.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openRefundDialogForPayment()}
            className="h-8 px-3 rounded-xl border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Request Refund</span>
          </button>

          <button
            type="button"
            onClick={fetchBillingHistory}
            disabled={loading}
            className={`h-8 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/15 text-neutral-200'
                : 'bg-neutral-100 hover:bg-neutral-200 border-black/15 text-neutral-800'
            }`}
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/35 bg-red-500/10 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[11px] opacity-75 hover:opacity-100 cursor-pointer font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Subscription & Plan Cancel / Resume Bar */}
      <div
        className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isDark ? 'bg-black/40 border-white/10' : 'bg-neutral-50 border-black/10'
        }`}
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                effectivePlan !== 'free' ? 'text-emerald-500' : 'text-neutral-400'
              }`}
            />
            <span className="font-bold text-xs sm:text-sm uppercase tracking-tight">
              Current Plan: {effectivePlan.toUpperCase()}
            </span>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                cancelAtPeriodEnd
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : effectivePlan !== 'free'
                  ? 'bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30'
                  : isDark
                  ? 'bg-white/10 text-neutral-300'
                  : 'bg-black/10 text-neutral-700'
              }`}
            >
              {cancelAtPeriodEnd
                ? 'Cancels at Period End'
                : planStatus === 'none'
                ? 'Free Tier'
                : planStatus}
            </span>
          </div>
          <p className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {periodEnd
              ? cancelAtPeriodEnd
                ? `Access remains active until ${new Date(periodEnd).toLocaleDateString()} — auto-renewal is off.`
                : `Next billing / renewal date: ${new Date(periodEnd).toLocaleDateString()}.`
              : effectivePlan !== 'free'
              ? 'Active paid subscription. Cancelling stops future charges; click "Get Money Back / Request Refund" to refund your payment.'
              : 'Cancelled your Spark plan? Cancelling stops future renewals — click "Get Money Back / Request Refund" to get your payment refunded, or "Restore My Spark Plan" to restore access.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openRefundDialogForPayment()}
            className="px-3.5 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Get Money Back / Request Refund</span>
          </button>

          {effectivePlan === 'free' && (
            <button
              type="button"
              onClick={() => handleCancelOrResume({ resume: true })}
              disabled={cancelBusy}
              className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold cursor-pointer transition-colors"
            >
              {cancelBusy ? 'Restoring...' : 'Restore My Spark Plan'}
            </button>
          )}

          {billingMe?.dodoCustomerId && (
            <button
              type="button"
              onClick={handleOpenPortal}
              disabled={portalBusy}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/15 text-white'
                  : 'bg-white hover:bg-neutral-100 border-black/15 text-black'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{portalBusy ? 'Opening...' : 'Dodo Portal'}</span>
            </button>
          )}

          {cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={() => handleCancelOrResume({ resume: true })}
              disabled={cancelBusy}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              {cancelBusy ? 'Updating...' : 'Resume Auto-Renewal'}
            </button>
          )}

          {(effectivePlan !== 'free' || billingMe?.dodoSubscriptionId) && !cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={() => handleCancelOrResume({ atPeriodEnd: true })}
              disabled={cancelBusy}
              className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              {cancelBusy ? 'Cancelling...' : 'Cancel Auto-Renewal (Keep Spark)'}
            </button>
          )}

          {(effectivePlan !== 'free' || billingMe?.dodoSubscriptionId) && (
            <button
              type="button"
              onClick={() => handleCancelOrResume({ immediate: true })}
              disabled={cancelBusy}
              className="px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{cancelBusy ? 'Cancelling...' : 'Cancel Immediately'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Refund Request Form Drawer */}
      {refundModalOpen && (
        <form
          onSubmit={handleSubmitRefund}
          className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${
            isDark
              ? 'bg-[#141418] border-[#FC4C01]/50 text-white'
              : 'bg-orange-50/40 border-[#FC4C01]/40 text-[#18181b]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#FC4C01] shrink-0" />
              <div>
                <h4 className="text-xs sm:text-sm font-bold">
                  Request Subscription Refund (7-Day Guarantee)
                </h4>
                <p className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Refunds are issued directly through Dodo Payments back to your original payment method (UPI, Card, or Wallet).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRefundModalOpen(false)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer font-semibold"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75 mb-1">
                Payment / Invoice to Refund
              </label>
              {payments.length > 0 ? (
                <select
                  value={selectedRefundPaymentId}
                  onChange={(e) => setSelectedRefundPaymentId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                    isDark
                      ? 'bg-black/60 border-white/15 text-white'
                      : 'bg-white border-black/15 text-black'
                  }`}
                >
                  {payments.map((p) => {
                    const pid = p.dodo_payment_id || p.id || '';
                    return (
                      <option key={pid} value={pid}>
                        {pid} — {((Number(p.amount) || 0) / 100).toFixed(2)} {p.currency || 'USD'} ({p.status})
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedRefundPaymentId}
                  onChange={(e) => setSelectedRefundPaymentId(e.target.value)}
                  placeholder="Latest active subscription payment (auto-detected)"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                    isDark
                      ? 'bg-black/60 border-white/15 text-white'
                      : 'bg-white border-black/15 text-black'
                  }`}
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75 mb-1">
                Reason for Refund
              </label>
              <select
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-black/60 border-white/15 text-white'
                    : 'bg-white border-black/15 text-black'
                }`}
              >
                {REFUND_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider opacity-75 mb-1">
                Additional Details (Optional)
              </label>
              <input
                type="text"
                value={customRefundNote}
                onChange={(e) => setCustomRefundNote(e.target.value)}
                placeholder="Tell us anything else about your refund request..."
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-black/60 border-white/15 text-white'
                    : 'bg-white border-black/15 text-black'
                }`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cancelSubOnRefund}
                onChange={(e) => setCancelSubOnRefund(e.target.checked)}
                className="rounded accent-[#FC4C01]"
              />
              <span>Also cancel active subscription &amp; stop future renewals</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                  isDark
                    ? 'border-white/15 hover:bg-white/10 text-neutral-300'
                    : 'border-black/15 hover:bg-black/5 text-neutral-700'
                }`}
              >
                Keep Plan
              </button>
              <button
                type="submit"
                disabled={refundBusy}
                className="px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-bold cursor-pointer transition-all"
              >
                {refundBusy ? 'Processing Refund...' : 'Confirm Refund Request'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Invoices Table */}
      {loading && payments.length === 0 ? (
        <div className="overflow-x-auto animate-pulse">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-white/10 text-neutral-400' : 'border-black/10 text-neutral-500'}`}>
                <th className="py-2.5 pr-3 font-semibold">Invoice Date</th>
                <th className="py-2.5 px-3 font-semibold">Payment ID</th>
                <th className="py-2.5 px-3 font-semibold">Amount</th>
                <th className="py-2.5 px-3 font-semibold">Method</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 pl-3 font-semibold text-right">Receipt &amp; Refund</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/6' : 'divide-black/6'}`}>
              {[1, 2, 3].map((n) => (
                <tr key={n}>
                  <td className="py-3 pr-3">
                    <div className={`h-3.5 w-24 rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                  </td>
                  <td className="py-3 px-3">
                    <div className={`h-3.5 w-32 rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                  </td>
                  <td className="py-3 px-3">
                    <div className={`h-3.5 w-16 rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                  </td>
                  <td className="py-3 px-3">
                    <div className={`h-3.5 w-14 rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                  </td>
                  <td className="py-3 px-3">
                    <div className={`h-5 w-20 rounded-full ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <div className={`h-3.5 w-16 rounded ml-auto ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchBillingHistory}
            className="underline font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-full mx-auto bg-neutral-500/10 flex items-center justify-center text-neutral-400">
            <Clock className="w-6 h-6" />
          </div>
          <p className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
            No past invoices found
          </p>
          <p className={`text-[11px] max-w-sm mx-auto ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            When you subscribe to Kinich Spark or Fire, your tax invoices, receipts, and instant refund controls will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-white/10 text-neutral-400' : 'border-black/10 text-neutral-500'}`}>
                <th className="py-2.5 pr-3 font-semibold">Invoice Date</th>
                <th className="py-2.5 px-3 font-semibold">Payment ID</th>
                <th className="py-2.5 px-3 font-semibold">Amount</th>
                <th className="py-2.5 px-3 font-semibold">Method</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 pl-3 font-semibold text-right">Receipt &amp; Refund</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/6' : 'divide-black/6'}`}>
              {payments.map((p: any) => {
                const pid = p.dodo_payment_id || p.id || '';
                const isRefunded = p.status === 'refunded';
                return (
                  <tr
                    key={pid}
                    className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'}`}
                  >
                    <td className="py-3 pr-3 font-mono text-[11px]">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-neutral-400">
                      {pid || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {((Number(p.amount) || 0) / 100).toFixed(2)} {p.currency || 'USD'}
                    </td>
                    <td className="py-3 px-3 capitalize">
                      {p.payment_method || 'card'}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          p.status === 'succeeded' || p.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : isRefunded
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-neutral-500/15 text-neutral-400 border border-neutral-500/30'
                        }`}
                      >
                        {p.status || 'completed'}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {p.invoice_url ? (
                          <a
                            href={p.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#FC4C01] hover:underline font-semibold"
                          >
                            <span>PDF</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className={`text-[11px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            Receipt
                          </span>
                        )}

                        {!isRefunded ? (
                          <button
                            type="button"
                            onClick={() => openRefundDialogForPayment(pid)}
                            className="px-2 py-1 rounded-lg border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            Refund
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-amber-400">Refunded</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Processed Refunds Log */}
      {refunds.length > 0 && (
        <div className="pt-3 border-t border-neutral-500/10 space-y-2">
          <div className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Processed Refunds ({refunds.length})</span>
          </div>
          <div className="space-y-1.5">
            {refunds.map((r) => {
              const rid = r.dodo_refund_id || r.refund_id || '';
              return (
                <div
                  key={rid}
                  className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-neutral-50 border-black/10'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-mono font-semibold text-[11px]">
                      Refund {rid} · Payment {r.dodo_payment_id || r.payment_id || '—'}
                    </div>
                    {r.reason && (
                      <div className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        Reason: {r.reason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">
                      {((Number(r.amount) || 0) / 100).toFixed(2)} {r.currency || 'USD'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {r.status || 'succeeded'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
