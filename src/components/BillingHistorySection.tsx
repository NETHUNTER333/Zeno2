import React, { useState, useEffect } from 'react';
import { Receipt, ExternalLink, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { getAuthHeaders } from '../lib/firebase';

interface BillingHistorySectionProps {
  isDark: boolean;
}

export const BillingHistorySection: React.FC<BillingHistorySectionProps> = ({ isDark }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [payments, setPayments] = useState<Array<any>>([]);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/billing/me', { headers });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data?.payments)) {
        setPayments(data.payments);
      }
      if (data?.subscription) {
        setSubscription(data.subscription);
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
  }, []);

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl border space-y-4 transition-all ${
        isDark ? 'bg-white/[0.02] border-white/10 text-white' : 'bg-white border-black/15 text-[#18181b] shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-500/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-[#FC4C01]">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold tracking-tight">
              Billing History &amp; Invoices
            </h3>
            <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Powered by Dodo Payments Merchant of Record. Tax invoices &amp; receipt records.
            </p>
          </div>
        </div>

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

      {subscription && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
            isDark ? 'bg-black/40 border-white/10' : 'bg-neutral-50 border-black/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <span className="font-semibold capitalize">Active Subscription: {subscription.plan || 'Spark/Fire'}</span>
              <span className={`block text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Status: {subscription.status || 'Active'} {subscription.next_billing_date ? `· Renews ${new Date(subscription.next_billing_date).toLocaleDateString()}` : ''}
              </span>
            </div>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-orange-500/15 text-[#FC4C01] border border-orange-500/30">
            {subscription.currency || 'USD'}
          </span>
        </div>
      )}

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
                <th className="py-2.5 pl-3 font-semibold text-right">Receipt / PDF</th>
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
        <div className="py-12 text-center space-y-2">
          <div className="w-12 h-12 rounded-full mx-auto bg-neutral-500/10 flex items-center justify-center text-neutral-400">
            <Clock className="w-6 h-6" />
          </div>
          <p className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
            No past invoices found
          </p>
          <p className={`text-[11px] max-w-sm mx-auto ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            When you subscribe to Kinich Spark or Fire, your tax invoices and receipts from Dodo Payments will appear here automatically.
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
                <th className="py-2.5 pl-3 font-semibold text-right">Receipt / PDF</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-white/6' : 'divide-black/6'}`}>
              {payments.map((p: any) => (
                <tr
                  key={p.dodo_payment_id || p.id}
                  className={`transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'}`}
                >
                  <td className="py-3 pr-3 font-mono text-[11px]">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-neutral-400">
                    {p.dodo_payment_id || p.id || '—'}
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
                          : p.status === 'refunded'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-neutral-500/15 text-neutral-400 border border-neutral-500/30'
                      }`}
                    >
                      {p.status || 'completed'}
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {p.invoice_url ? (
                      <a
                        href={p.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#FC4C01] hover:underline font-semibold"
                      >
                        <span>Download</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className={`text-[11px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        Digital Receipt
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
