import { getAuthHeaders } from './firebase';

export interface InvoiceItem {
  id?: string;
  dodo_payment_id?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  created_at: string;
  invoice_url?: string;
}

export interface RefundItem {
  dodo_refund_id?: string;
  refund_id?: string;
  dodo_payment_id?: string;
  payment_id?: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
  created_at: string;
}

/**
 * Fetch the last 10 invoices / payments from Dodo Payments backend API.
 */
export async function fetchLast10Invoices(): Promise<InvoiceItem[]> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/billing/invoices', {
      headers: authHeaders,
    });
    if (!res.ok) {
      // Fallback to /api/billing/me
      const meRes = await fetch('/api/billing/me', { headers: authHeaders });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (Array.isArray(meData?.payments)) {
          return meData.payments;
        }
      }
      return [];
    }
    const data = await res.json();
    return Array.isArray(data?.invoices) ? data.invoices : [];
  } catch (err) {
    console.error('Failed to fetch last 10 invoices:', err);
    return [];
  }
}

/**
 * Request a refund for a payment (under the 7-day money-back guarantee) and optionally cancel the subscription.
 */
export async function requestSubscriptionRefund(params: {
  paymentId?: string;
  reason?: string;
  cancelSubscription?: boolean;
}): Promise<{
  success: boolean;
  refund?: RefundItem;
  plan?: 'free' | 'spark' | 'fire';
  planStatus?: string;
  message?: string;
  error?: string;
}> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/billing/refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        payment_id: params.paymentId,
        reason: params.reason || 'Customer requested 7-day refund',
        cancel_subscription: params.cancelSubscription !== false,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || 'Could not process refund request.',
      };
    }
    return {
      success: true,
      refund: data.refund,
      plan: data.plan,
      planStatus: data.planStatus,
      message: data.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while requesting refund.',
    };
  }
}

/**
 * Cancel subscription at period end, cancel immediately, or resume auto-renewal.
 */
export async function cancelUserSubscription(params: {
  atPeriodEnd?: boolean;
  immediate?: boolean;
  resume?: boolean;
  reason?: string;
}): Promise<{
  success: boolean;
  plan?: 'free' | 'spark' | 'fire';
  planStatus?: string;
  cancelAtPeriodEnd?: boolean;
  planPeriodEnd?: string | null;
  message?: string;
  error?: string;
}> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/billing/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        atPeriodEnd: params.immediate ? false : params.atPeriodEnd !== false,
        immediate: Boolean(params.immediate),
        resume: Boolean(params.resume),
        reason: params.reason || 'cancelled_by_customer',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || 'Could not update subscription cancellation status.',
      };
    }
    return {
      success: true,
      plan: data.plan,
      planStatus: data.planStatus,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      planPeriodEnd: data.planPeriodEnd,
      message: data.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error updating subscription.',
    };
  }
}

/**
 * Fetch refund history for the current user.
 */
export async function fetchUserRefunds(): Promise<RefundItem[]> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/billing/refunds', {
      headers: authHeaders,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.refunds) ? data.refunds : [];
  } catch {
    return [];
  }
}

