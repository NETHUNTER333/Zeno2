import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { $t as ExternalLink, K as ShieldCheck, et as RotateCcw, gn as CircleX, it as Receipt, mn as Clock, nt as RefreshCw, vn as CircleCheck, x as TriangleAlert } from "./react-vendor-ZF-Fgzq4.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { m as getAuthHeaders } from "./firebase-Df8_wQ36.js";
import { rt as UserAccountStore } from "./index-DaFzEGR-.js";
import { i as requestSubscriptionRefund, n as fetchLast10Invoices, r as fetchUserRefunds, t as cancelUserSubscription } from "./billing-CwLdeIHw.js";
//#region src/components/BillingHistorySection.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var REFUND_REASONS = [
	"Within 7-day money-back guarantee",
	"Accidental or unintended purchase",
	"Not satisfied with features or performance",
	"Switching to a different billing plan or interval",
	"Duplicate or unexpected billing charge"
];
var BillingHistorySection = ({ isDark }) => {
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [payments, setPayments] = (0, import_react.useState)([]);
	const [refunds, setRefunds] = (0, import_react.useState)([]);
	const [billingMe, setBillingMe] = (0, import_react.useState)(null);
	const [currentPlan, setCurrentPlan] = (0, import_react.useState)(() => UserAccountStore.getNormalizedPlan());
	const [error, setError] = (0, import_react.useState)(null);
	const [statusMessage, setStatusMessage] = (0, import_react.useState)(null);
	const [cancelBusy, setCancelBusy] = (0, import_react.useState)(false);
	const [portalBusy, setPortalBusy] = (0, import_react.useState)(false);
	const [refundModalOpen, setRefundModalOpen] = (0, import_react.useState)(false);
	const [selectedRefundPaymentId, setSelectedRefundPaymentId] = (0, import_react.useState)("");
	const [refundReason, setRefundReason] = (0, import_react.useState)(REFUND_REASONS[0]);
	const [customRefundNote, setCustomRefundNote] = (0, import_react.useState)("");
	const [cancelSubOnRefund, setCancelSubOnRefund] = (0, import_react.useState)(true);
	const [refundBusy, setRefundBusy] = (0, import_react.useState)(false);
	const fetchBillingHistory = async () => {
		if (UserAccountStore.isGuest()) {
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
				getAuthHeaders().catch(() => ({}))
			]);
			setPayments(invoices);
			setRefunds(userRefunds);
			const res = await fetch("/api/billing/me", { headers });
			if (res.ok) {
				const data = await res.json();
				setBillingMe(data);
				if (Array.isArray(data?.refunds) && data.refunds.length > 0 && userRefunds.length === 0) setRefunds(data.refunds);
				if (data?.authenticated && (data.effectivePlan === "spark" || data.effectivePlan === "fire" || data.effectivePlan === "free") && data.planStatus !== "none") setCurrentPlan(data.effectivePlan);
				else setCurrentPlan(UserAccountStore.getNormalizedPlan());
			}
		} catch (err) {
			console.error("Failed to fetch billing history:", err);
			setError("Unable to load past invoices. Please check your connection.");
		} finally {
			setLoading(false);
		}
	};
	(0, import_react.useEffect)(() => {
		fetchBillingHistory();
		const onAccountSync = () => {
			setCurrentPlan(UserAccountStore.getNormalizedPlan());
		};
		window.addEventListener("kinich-account-updated", onAccountSync);
		return () => window.removeEventListener("kinich-account-updated", onAccountSync);
	}, []);
	const handleCancelOrResume = async (options) => {
		setCancelBusy(true);
		setStatusMessage(null);
		try {
			const res = await cancelUserSubscription(options);
			if (res.success) {
				if (options.resume) {
					const restoredPlan = res.plan && res.plan !== "free" ? res.plan : "spark";
					UserAccountStore.upgradePlan(restoredPlan, "monthly");
					setCurrentPlan(restoredPlan);
					setStatusMessage({
						type: "success",
						text: res.message || `Your ${restoredPlan.toUpperCase()} plan has been restored and auto-renewal is active.`
					});
				} else if (options.immediate) {
					UserAccountStore.upgradePlan("free", "monthly");
					setCurrentPlan("free");
					setStatusMessage({
						type: "success",
						text: res.message || "Your subscription has been cancelled immediately and switched to the Free Tier. Click \"Get Money Back / Request Refund\" to refund your payment."
					});
				} else setStatusMessage({
					type: "success",
					text: res.message || "Auto-renewal cancelled. You keep full Spark/Fire access until the end of your current billing period."
				});
				await fetchBillingHistory();
			} else if (options.resume) {
				UserAccountStore.upgradePlan("spark", "monthly");
				setCurrentPlan("spark");
				setStatusMessage({
					type: "success",
					text: "Your Spark plan has been restored."
				});
			} else if (options.immediate || options.atPeriodEnd) {
				UserAccountStore.upgradePlan("free", "monthly");
				setCurrentPlan("free");
				setStatusMessage({
					type: "success",
					text: "Your plan has been cancelled and reverted to the Free Tier. Click \"Get Money Back / Request Refund\" to refund your charge."
				});
			} else setStatusMessage({
				type: "error",
				text: res.error || "Could not update subscription cancellation status."
			});
		} finally {
			setCancelBusy(false);
		}
	};
	const handleOpenPortal = async () => {
		setPortalBusy(true);
		setStatusMessage(null);
		try {
			const headers = await getAuthHeaders();
			const res = await fetch("/api/billing/portal", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...headers
				}
			});
			const data = await res.json();
			if (res.ok && data?.url) {
				window.location.href = String(data.url);
				return;
			}
			setStatusMessage({
				type: "error",
				text: data?.error || "Customer portal is available after your first subscription checkout."
			});
		} catch {
			setStatusMessage({
				type: "error",
				text: "Unable to open Dodo Customer Portal right now."
			});
		} finally {
			setPortalBusy(false);
		}
	};
	const openRefundDialogForPayment = (paymentId) => {
		const defaultId = paymentId || payments.find((p) => p.status === "succeeded" || p.status === "active")?.dodo_payment_id || payments[0]?.dodo_payment_id || "";
		setSelectedRefundPaymentId(defaultId);
		setRefundModalOpen(true);
		setStatusMessage(null);
	};
	const handleSubmitRefund = async (e) => {
		e.preventDefault();
		setRefundBusy(true);
		setStatusMessage(null);
		const combinedReason = customRefundNote.trim() ? `${refundReason} — ${customRefundNote.trim()}` : refundReason;
		try {
			const result = await requestSubscriptionRefund({
				paymentId: selectedRefundPaymentId || void 0,
				reason: combinedReason,
				cancelSubscription: cancelSubOnRefund
			});
			if (result.success) {
				if (cancelSubOnRefund) {
					UserAccountStore.upgradePlan("free", "monthly");
					setCurrentPlan("free");
				}
				setRefundModalOpen(false);
				setCustomRefundNote("");
				setStatusMessage({
					type: "success",
					text: `Refund processed (${result.refund?.refund_id || "confirmed"})${cancelSubOnRefund ? " and subscription cancelled." : "."} Funds are returned to your original payment method via Dodo Payments.`
				});
				await fetchBillingHistory();
			} else setStatusMessage({
				type: "error",
				text: result.error || "Could not process refund request."
			});
		} finally {
			setRefundBusy(false);
		}
	};
	const effectivePlan = billingMe?.effectivePlan && billingMe.effectivePlan !== "free" ? billingMe.effectivePlan : currentPlan;
	const planStatus = billingMe?.planStatus || (effectivePlan !== "free" ? "active" : "none");
	const cancelAtPeriodEnd = Boolean(billingMe?.cancelAtPeriodEnd || billingMe?.cancelAtNextBillingDate);
	const periodEnd = billingMe?.planPeriodEnd || billingMe?.currentPeriodEnd || null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `p-5 sm:p-6 rounded-2xl border space-y-5 transition-all ${isDark ? "bg-white/[0.02] border-white/10 text-white" : "bg-white border-black/15 text-[#18181b] shadow-xs"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-500/10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-[#FC4C01]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Receipt, { className: "w-4 h-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm sm:text-base font-bold tracking-tight",
						children: "Subscription Management, Refunds & Invoices"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
						children: "Manage your plan, cancel anytime, request a 7-day refund, or download tax invoices."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => openRefundDialogForPayment(),
						className: "h-8 px-3 rounded-xl border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Request Refund" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: fetchBillingHistory,
						disabled: loading,
						className: `h-8 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${isDark ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/15 text-neutral-200" : "bg-neutral-100 hover:bg-neutral-200 border-black/15 text-neutral-800"}`,
						title: "Refresh Invoices",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Refresh" })]
					})]
				})]
			}),
			statusMessage && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${statusMessage.type === "success" ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-red-500/35 bg-red-500/10 text-red-300"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [statusMessage.type === "success" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-4 h-4 text-emerald-400 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-4 h-4 text-red-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: statusMessage.text })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setStatusMessage(null),
					className: "text-[11px] opacity-75 hover:opacity-100 cursor-pointer font-semibold",
					children: "Dismiss"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? "bg-black/40 border-white/10" : "bg-neutral-50 border-black/10"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: `w-4 h-4 shrink-0 ${effectivePlan !== "free" ? "text-emerald-500" : "text-neutral-400"}` }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-bold text-xs sm:text-sm uppercase tracking-tight",
								children: ["Current Plan: ", effectivePlan.toUpperCase()]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `font-mono text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${cancelAtPeriodEnd ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : effectivePlan !== "free" ? "bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30" : isDark ? "bg-white/10 text-neutral-300" : "bg-black/10 text-neutral-700"}`,
								children: cancelAtPeriodEnd ? "Cancels at Period End" : planStatus === "none" ? "Free Tier" : planStatus
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
						children: periodEnd ? cancelAtPeriodEnd ? `Access remains active until ${new Date(periodEnd).toLocaleDateString()} — auto-renewal is off.` : `Next billing / renewal date: ${new Date(periodEnd).toLocaleDateString()}.` : effectivePlan !== "free" ? "Active paid subscription. Cancelling stops future charges; click \"Get Money Back / Request Refund\" to refund your payment." : "Cancelled your Spark plan? Cancelling stops future renewals — click \"Get Money Back / Request Refund\" to get your payment refunded, or \"Restore My Spark Plan\" to restore access."
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2 shrink-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => openRefundDialogForPayment(),
							className: "px-3.5 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Get Money Back / Request Refund" })]
						}),
						effectivePlan === "free" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => handleCancelOrResume({ resume: true }),
							disabled: cancelBusy,
							className: "px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold cursor-pointer transition-colors",
							children: cancelBusy ? "Restoring..." : "Restore My Spark Plan"
						}),
						billingMe?.dodoCustomerId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: handleOpenPortal,
							disabled: portalBusy,
							className: `px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 border-white/15 text-white" : "bg-white hover:bg-neutral-100 border-black/15 text-black"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: portalBusy ? "Opening..." : "Dodo Portal" })]
						}),
						cancelAtPeriodEnd && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => handleCancelOrResume({ resume: true }),
							disabled: cancelBusy,
							className: "px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer transition-colors",
							children: cancelBusy ? "Updating..." : "Resume Auto-Renewal"
						}),
						(effectivePlan !== "free" || billingMe?.dodoSubscriptionId) && !cancelAtPeriodEnd && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => handleCancelOrResume({ atPeriodEnd: true }),
							disabled: cancelBusy,
							className: "px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold cursor-pointer transition-colors",
							children: cancelBusy ? "Cancelling..." : "Cancel Auto-Renewal (Keep Spark)"
						}),
						(effectivePlan !== "free" || billingMe?.dodoSubscriptionId) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => handleCancelOrResume({ immediate: true }),
							disabled: cancelBusy,
							className: "px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: cancelBusy ? "Cancelling..." : "Cancel Immediately" })]
						})
					]
				})]
			}),
			refundModalOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: handleSubmitRefund,
				className: `p-4 sm:p-5 rounded-2xl border space-y-4 ${isDark ? "bg-[#141418] border-[#FC4C01]/50 text-white" : "bg-orange-50/40 border-[#FC4C01]/40 text-[#18181b]"}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-4 h-4 text-[#FC4C01] shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "text-xs sm:text-sm font-bold",
								children: "Request Subscription Refund (7-Day Guarantee)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-600"}`,
								children: "Refunds are issued directly through Dodo Payments back to your original payment method (UPI, Card, or Wallet)."
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setRefundModalOpen(false),
							className: "text-xs opacity-70 hover:opacity-100 cursor-pointer font-semibold",
							children: "Close"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-[11px] font-semibold uppercase tracking-wider opacity-75 mb-1",
								children: "Payment / Invoice to Refund"
							}), payments.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: selectedRefundPaymentId,
								onChange: (e) => setSelectedRefundPaymentId(e.target.value),
								className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-black/60 border-white/15 text-white" : "bg-white border-black/15 text-black"}`,
								children: payments.map((p) => {
									const pid = p.dodo_payment_id || p.id || "";
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
										value: pid,
										children: [
											pid,
											" — ",
											((Number(p.amount) || 0) / 100).toFixed(2),
											" ",
											p.currency || "USD",
											" (",
											p.status,
											")"
										]
									}, pid);
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: selectedRefundPaymentId,
								onChange: (e) => setSelectedRefundPaymentId(e.target.value),
								placeholder: "Latest active subscription payment (auto-detected)",
								className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-black/60 border-white/15 text-white" : "bg-white border-black/15 text-black"}`
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-[11px] font-semibold uppercase tracking-wider opacity-75 mb-1",
								children: "Reason for Refund"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: refundReason,
								onChange: (e) => setRefundReason(e.target.value),
								className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-black/60 border-white/15 text-white" : "bg-white border-black/15 text-black"}`,
								children: REFUND_REASONS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: r,
									children: r
								}, r))
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "sm:col-span-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-[11px] font-semibold uppercase tracking-wider opacity-75 mb-1",
									children: "Additional Details (Optional)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: customRefundNote,
									onChange: (e) => setCustomRefundNote(e.target.value),
									placeholder: "Tell us anything else about your refund request...",
									className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-black/60 border-white/15 text-white" : "bg-white border-black/15 text-black"}`
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3 pt-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "inline-flex items-center gap-2 text-xs cursor-pointer select-none",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: cancelSubOnRefund,
								onChange: (e) => setCancelSubOnRefund(e.target.checked),
								className: "rounded accent-[#FC4C01]"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Also cancel active subscription & stop future renewals" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setRefundModalOpen(false),
								className: `px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${isDark ? "border-white/15 hover:bg-white/10 text-neutral-300" : "border-black/15 hover:bg-black/5 text-neutral-700"}`,
								children: "Keep Plan"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								disabled: refundBusy,
								className: "px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-bold cursor-pointer transition-all",
								children: refundBusy ? "Processing Refund..." : "Confirm Refund Request"
							})]
						})]
					})
				]
			}),
			loading && payments.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto animate-pulse",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: `border-b ${isDark ? "border-white/10 text-neutral-400" : "border-black/10 text-neutral-500"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 pr-3 font-semibold",
								children: "Invoice Date"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 px-3 font-semibold",
								children: "Payment ID"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 px-3 font-semibold",
								children: "Amount"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 px-3 font-semibold",
								children: "Method"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 px-3 font-semibold",
								children: "Status"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 pl-3 font-semibold text-right",
								children: "Receipt & Refund"
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						className: `divide-y ${isDark ? "divide-white/6" : "divide-black/6"}`,
						children: [
							1,
							2,
							3
						].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3 pr-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `h-3.5 w-24 rounded ${isDark ? "bg-white/10" : "bg-black/10"}` })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3 px-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `h-3.5 w-32 rounded ${isDark ? "bg-white/10" : "bg-black/10"}` })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3 px-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `h-3.5 w-16 rounded ${isDark ? "bg-white/10" : "bg-black/10"}` })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3 px-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `h-3.5 w-14 rounded ${isDark ? "bg-white/10" : "bg-black/10"}` })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3 px-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `h-5 w-20 rounded-full ${isDark ? "bg-white/10" : "bg-black/10"}` })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3 pl-3 text-right",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `h-3.5 w-16 rounded ml-auto ${isDark ? "bg-white/10" : "bg-black/10"}` })
							})
						] }, n))
					})]
				})
			}) : error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-xs flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: error }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: fetchBillingHistory,
					className: "underline font-semibold cursor-pointer",
					children: "Retry"
				})]
			}) : payments.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "py-10 text-center space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-12 h-12 rounded-full mx-auto bg-neutral-500/10 flex items-center justify-center text-neutral-400",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-6 h-6" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-xs font-medium ${isDark ? "text-neutral-300" : "text-neutral-700"}`,
						children: "No past invoices found"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-[11px] max-w-sm mx-auto ${isDark ? "text-neutral-500" : "text-neutral-400"}`,
						children: "When you subscribe to Kinich Spark or Fire, your tax invoices, receipts, and instant refund controls will appear here automatically."
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: `border-b ${isDark ? "border-white/10 text-neutral-400" : "border-black/10 text-neutral-500"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 pr-3 font-semibold",
								children: "Invoice Date"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 px-3 font-semibold",
								children: "Payment ID"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 px-3 font-semibold",
								children: "Amount"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 px-3 font-semibold",
								children: "Method"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 px-3 font-semibold",
								children: "Status"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2.5 pl-3 font-semibold text-right",
								children: "Receipt & Refund"
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
						className: `divide-y ${isDark ? "divide-white/6" : "divide-black/6"}`,
						children: payments.map((p) => {
							const pid = p.dodo_payment_id || p.id || "";
							const isRefunded = p.status === "refunded";
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: `transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-black/[0.02]"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 pr-3 font-mono text-[11px]",
										children: p.created_at ? new Date(p.created_at).toLocaleDateString([], {
											year: "numeric",
											month: "short",
											day: "numeric"
										}) : "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 px-3 font-mono text-[11px] text-neutral-400",
										children: pid || "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "py-3 px-3 font-mono font-bold",
										children: [
											((Number(p.amount) || 0) / 100).toFixed(2),
											" ",
											p.currency || "USD"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 px-3 capitalize",
										children: p.payment_method || "card"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 px-3",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${p.status === "succeeded" || p.status === "active" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : isRefunded ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-neutral-500/15 text-neutral-400 border border-neutral-500/30"}`,
											children: p.status || "completed"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-3 pl-3 text-right",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "inline-flex items-center justify-end gap-2",
											children: [p.invoice_url ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
												href: p.invoice_url,
												target: "_blank",
												rel: "noopener noreferrer",
												className: "inline-flex items-center gap-1 text-[#FC4C01] hover:underline font-semibold",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "PDF" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3 h-3" })]
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `text-[11px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`,
												children: "Receipt"
											}), !isRefunded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => openRefundDialogForPayment(pid),
												className: "px-2 py-1 rounded-lg border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-semibold cursor-pointer transition-colors",
												children: "Refund"
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] font-mono text-amber-400",
												children: "Refunded"
											})]
										})
									})
								]
							}, pid);
						})
					})]
				})
			}),
			refunds.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pt-3 border-t border-neutral-500/10 space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-xs font-bold flex items-center gap-1.5 text-amber-400",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"Processed Refunds (",
						refunds.length,
						")"
					] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-1.5",
					children: refunds.map((r) => {
						const rid = r.dodo_refund_id || r.refund_id || "";
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-neutral-50 border-black/10"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-0.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-mono font-semibold text-[11px]",
									children: [
										"Refund ",
										rid,
										" · Payment ",
										r.dodo_payment_id || r.payment_id || "—"
									]
								}), r.reason && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
									children: ["Reason: ", r.reason]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono font-bold",
									children: [
										((Number(r.amount) || 0) / 100).toFixed(2),
										" ",
										r.currency || "USD"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
									children: r.status || "succeeded"
								})]
							})]
						}, rid);
					})
				})]
			})
		]
	});
};
//#endregion
export { BillingHistorySection };
