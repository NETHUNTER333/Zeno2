import { m as getAuthHeaders } from "./firebase-Df8_wQ36.js";
import { rt as UserAccountStore } from "./index-DaFzEGR-.js";
//#region src/lib/billing.ts
/**
* Fetch the last 10 invoices / payments from Dodo Payments backend API.
*/
async function fetchLast10Invoices() {
	if (UserAccountStore.isGuest()) return [];
	try {
		const authHeaders = await getAuthHeaders();
		const res = await fetch("/api/billing/invoices", { headers: authHeaders });
		if (!res.ok) {
			const meRes = await fetch("/api/billing/me", { headers: authHeaders });
			if (meRes.ok) {
				const meData = await meRes.json();
				if (Array.isArray(meData?.payments)) return meData.payments;
			}
			return [];
		}
		const data = await res.json();
		return Array.isArray(data?.invoices) ? data.invoices : [];
	} catch (err) {
		console.error("Failed to fetch last 10 invoices:", err);
		return [];
	}
}
/**
* Request a refund for a payment (under the 7-day money-back guarantee) and optionally cancel the subscription.
*/
async function requestSubscriptionRefund(params) {
	try {
		const authHeaders = await getAuthHeaders();
		const res = await fetch("/api/billing/refund", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders
			},
			body: JSON.stringify({
				payment_id: params.paymentId,
				reason: params.reason || "Customer requested 7-day refund",
				cancel_subscription: params.cancelSubscription !== false
			})
		});
		const data = await res.json();
		if (!res.ok || !data?.success) return {
			success: false,
			error: data?.error || "Could not process refund request."
		};
		return {
			success: true,
			refund: data.refund,
			plan: data.plan,
			planStatus: data.planStatus,
			message: data.message
		};
	} catch (err) {
		return {
			success: false,
			error: err?.message || "Network error while requesting refund."
		};
	}
}
/**
* Cancel subscription at period end, cancel immediately, or resume auto-renewal.
*/
async function cancelUserSubscription(params) {
	try {
		const authHeaders = await getAuthHeaders();
		const res = await fetch("/api/billing/cancel", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders
			},
			body: JSON.stringify({
				atPeriodEnd: params.immediate ? false : params.atPeriodEnd !== false,
				immediate: Boolean(params.immediate),
				resume: Boolean(params.resume),
				reason: params.reason || "cancelled_by_customer"
			})
		});
		const data = await res.json();
		if (!res.ok || !data?.success) return {
			success: false,
			error: data?.error || "Could not update subscription cancellation status."
		};
		return {
			success: true,
			plan: data.plan,
			planStatus: data.planStatus,
			cancelAtPeriodEnd: data.cancelAtPeriodEnd,
			planPeriodEnd: data.planPeriodEnd,
			message: data.message
		};
	} catch (err) {
		return {
			success: false,
			error: err?.message || "Network error updating subscription."
		};
	}
}
/**
* Fetch refund history for the current user.
*/
async function fetchUserRefunds() {
	if (UserAccountStore.isGuest()) return [];
	try {
		const authHeaders = await getAuthHeaders();
		const res = await fetch("/api/billing/refunds", { headers: authHeaders });
		if (!res.ok) return [];
		const data = await res.json();
		return Array.isArray(data?.refunds) ? data.refunds : [];
	} catch {
		return [];
	}
}
//#endregion
export { requestSubscriptionRefund as i, fetchLast10Invoices as n, fetchUserRefunds as r, cancelUserSubscription as t };
