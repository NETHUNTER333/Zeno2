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
