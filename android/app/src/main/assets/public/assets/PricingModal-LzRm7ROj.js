import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { K as ShieldCheck, Ln as ArrowRight, R as Smartphone, Rn as ArrowLeft, f as X, jt as Landmark, mn as Clock, nt as RefreshCw, on as CreditCard, rn as Earth, vn as CircleCheck, wn as Check, wt as Lock } from "./react-vendor-ZF-Fgzq4.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { m as getAuthHeaders, n as auth } from "./firebase-Df8_wQ36.js";
import { rt as UserAccountStore, tt as PLAN_LIMITS } from "./index-DaFzEGR-.js";
import { t as CustomSearchSelect } from "./CustomSearchSelect-V94h5mQs.js";
import { i as requestSubscriptionRefund, t as cancelUserSubscription } from "./billing-CwLdeIHw.js";
import { i as tuneSpring, n as createSpring, r as stepSpring, t as clampVal } from "./springMotion-z9bpjJ2E.js";
//#region src/components/DodoStatusModal.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var DEFAULT_FALLBACK_STATUS = {
	success: true,
	gateway: "Dodo Payments",
	status: "operational",
	latencyMs: 120,
	environment: "live_mode",
	mode: "Live Production",
	lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
	rails: [
		{
			id: "cards",
			name: "Credit & Debit Cards",
			status: "operational",
			subtext: "Visa, Mastercard, American Express, RuPay, Discover, JCB"
		},
		{
			id: "wallets",
			name: "Mobile Wallets",
			status: "operational",
			subtext: "Apple Pay, Google Pay"
		},
		{
			id: "upi",
			name: "UPI AutoPay & NetBanking",
			status: "operational",
			subtext: "Instant UPI mandates & recurring bank debits (India/RBI)"
		},
		{
			id: "sepa",
			name: "European Instant Rails",
			status: "operational",
			subtext: "iDEAL, Bancontact, SEPA, EPS, Multibanco"
		}
	],
	advisories: [
		"Dodo Payments operates as the legal Merchant of Record with automated tax remittance and PCI-DSS Level 1 compliance.",
		"If 3D-Secure SMS/OTP approval from your issuing bank takes longer than usual, your session remains active for 15 minutes without double billing.",
		"Cryptographic idempotency keys prevent duplicate deductions even if the checkout button is pressed multiple times."
	],
	supportContact: "kinich.app@kinich.app"
};
var DodoStatusModal = ({ isOpen, onClose, onContinueCheckout }) => {
	const [statusData, setStatusData] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	const fetchStatus = (0, import_react.useCallback)(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/billing/status", { headers: { "Cache-Control": "no-cache" } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			if (data?.success) setStatusData(data);
			else setStatusData(DEFAULT_FALLBACK_STATUS);
		} catch (err) {
			console.warn("[DodoStatus] Failed to fetch gateway status, using cached state:", err);
			setStatusData(DEFAULT_FALLBACK_STATUS);
		} finally {
			setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		if (isOpen) fetchStatus();
	}, [isOpen, fetchStatus]);
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape" && isOpen) onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);
	if (!isOpen) return null;
	const data = statusData || DEFAULT_FALLBACK_STATUS;
	const isOperational = data.status === "operational";
	const getRailIcon = (id) => {
		switch (id) {
			case "cards": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreditCard, { className: "w-4 h-4 text-emerald-400" });
			case "wallets": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "w-4 h-4 text-emerald-400" });
			case "upi": return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { className: "w-4 h-4 text-emerald-400" });
			default: return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Earth, { className: "w-4 h-4 text-emerald-400" });
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "dodo-status-title",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "absolute inset-0",
			onClick: onClose,
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl text-neutral-100 p-6 md:p-7 flex flex-col gap-6 z-10 transition-all",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-4 border-b border-neutral-800 pb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-5 h-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								id: "dodo-status-title",
								className: "text-lg font-semibold text-white tracking-tight",
								children: "Dodo Payments Gateway Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700",
								children: data.mode
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-neutral-400 mt-0.5",
							children: "Real-time health, latency check & reassurance for checkout"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition",
						"aria-label": "Close status modal",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-5 h-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl bg-neutral-950/70 border border-neutral-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative flex items-center justify-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `w-3.5 h-3.5 rounded-full ${isOperational ? "bg-emerald-500" : "bg-amber-500"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute w-6 h-6 rounded-full animate-ping opacity-75 ${isOperational ? "bg-emerald-500" : "bg-amber-500"}` })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center gap-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm font-semibold text-white",
								children: isOperational ? "All Payment Systems Operational" : "Gateway Performance Degraded"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-xs text-neutral-400 mt-0.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Latency:" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-emerald-400 font-medium",
									children: data.latencyMs > 0 ? `${data.latencyMs} ms` : "< 150 ms"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "•" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "256-bit TLS Encrypted" })
							]
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: fetchStatus,
						disabled: loading,
						className: "self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 transition disabled:opacity-50",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: loading ? "Pinging..." : "Re-check Now" })]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
					className: "text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5",
					children: "Active Payment Rails & Methods"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 gap-2.5",
					children: data.rails.map((rail) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-3 rounded-xl bg-neutral-950/50 border border-neutral-800/80 flex items-start gap-3 hover:border-neutral-700 transition",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-2 rounded-lg bg-neutral-800/60 border border-neutral-700/60 shrink-0 mt-0.5",
							children: getRailIcon(rail.id)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-medium text-white truncate",
									children: rail.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-3.5 h-3.5 text-emerald-400 shrink-0" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-neutral-400 mt-0.5 line-clamp-1",
								children: rail.subtext
							})]
						})]
					}, rail.id))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-neutral-300 flex flex-col gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 font-medium text-amber-400",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-4 h-4 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Encountering a delay during checkout?" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "space-y-1.5 text-neutral-300 list-disc list-inside text-[11.5px] leading-relaxed",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Bank 3D-Secure 2FA / OTP delivery:" }), " Issuing banks (especially with UPI, RuPay, or EU 3DS) may take 30 to 60 seconds to deliver SMS verification codes. Your session will remain valid."] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Zero Double-Charge Guarantee:" }), " Dodo Payments enforces strict cryptographic idempotency tokens. Clicking checkout again or refreshing will never create duplicate charges."] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Merchant of Record Protection:" }), " Your invoice, receipts, and localized taxes (VAT/GST) are issued with full legal buyer protection."] })
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3 pt-2 border-t border-neutral-800",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1 text-[11px] text-neutral-400",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-3.5 h-3.5 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Powered by Dodo Payments MoR" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onClose,
							className: "px-3.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition",
							children: "Close"
						}), onContinueCheckout && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								onClose();
								onContinueCheckout();
							},
							className: "inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold transition",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Continue to Checkout" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "w-3.5 h-3.5" })]
						})]
					})]
				})
			]
		})]
	});
};
//#endregion
//#region src/components/motion/PlanSwitchMotion.tsx
/**
* 1. DesignBookmark "Plan Switch" Stretchy Billing Toggle:
* Two-edge spring highlight (--spring-lead: 620 36, --spring-trail: 190 19).
* The leading edge moves fast while the trailing edge lags, stretching the pill physically.
*/
var PlanSwitchBillingToggle = ({ billingCycle, onChange, isDark = true }) => {
	const containerRef = (0, import_react.useRef)(null);
	const hlRef = (0, import_react.useRef)(null);
	const monthBtnRef = (0, import_react.useRef)(null);
	const yearBtnRef = (0, import_react.useRef)(null);
	const firstMountRef = (0, import_react.useRef)(true);
	const springsRef = (0, import_react.useRef)({
		L: createSpring(0, 620, 36),
		R: createSpring(0, 190, 19)
	});
	(0, import_react.useEffect)(() => {
		const activeEl = billingCycle === "annual" ? yearBtnRef.current : monthBtnRef.current;
		if (!activeEl) return;
		const l = activeEl.offsetLeft;
		const r = l + activeEl.offsetWidth;
		const s = springsRef.current;
		if (firstMountRef.current) {
			firstMountRef.current = false;
			s.L.x = s.L.t = l;
			s.R.x = s.R.t = r;
			if (hlRef.current) {
				hlRef.current.style.transform = `translateX(${l.toFixed(2)}px)`;
				hlRef.current.style.width = `${Math.max(36, r - l).toFixed(2)}px`;
			}
			return;
		}
		const movingRight = billingCycle === "annual";
		tuneSpring(s.L, movingRight ? 190 : 620, movingRight ? 19 : 36);
		tuneSpring(s.R, movingRight ? 620 : 190, movingRight ? 36 : 19);
		s.L.t = l;
		s.R.t = r;
	}, [billingCycle]);
	(0, import_react.useEffect)(() => {
		let rafId = 0;
		let last = performance.now();
		const loop = (now) => {
			const dt = Math.min((now - last) / 1e3, 1 / 30);
			last = now;
			const s = springsRef.current;
			const sub = 4;
			for (let i = 0; i < sub; i++) {
				stepSpring(s.L, dt / sub);
				stepSpring(s.R, dt / sub);
			}
			if (hlRef.current) {
				hlRef.current.style.transform = `translateX(${s.L.x.toFixed(2)}px)`;
				hlRef.current.style.width = `${Math.max(36, s.R.x - s.L.x).toFixed(2)}px`;
			}
			rafId = requestAnimationFrame(loop);
		};
		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: containerRef,
		role: "radiogroup",
		"aria-label": "Billing Cycle",
		className: `relative inline-flex items-center p-1 rounded-full select-none ${isDark ? "bg-white/[0.06]" : "bg-black/[0.05]"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				ref: hlRef,
				"aria-hidden": "true",
				className: `absolute left-0 top-1 h-8 rounded-full will-change-[transform,width] ${isDark ? "bg-white/[0.16]" : "bg-white shadow-xs"}`
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				ref: monthBtnRef,
				type: "button",
				role: "radio",
				"aria-checked": billingCycle === "monthly",
				onClick: () => onChange("monthly"),
				className: `relative z-10 h-8 px-4 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer ${billingCycle === "monthly" ? isDark ? "text-white font-semibold" : "text-[#17181a] font-semibold" : isDark ? "text-neutral-400 hover:text-neutral-200" : "text-neutral-500 hover:text-neutral-900"}`,
				children: "Monthly"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				ref: yearBtnRef,
				type: "button",
				role: "radio",
				"aria-checked": billingCycle === "annual",
				onClick: () => onChange("annual"),
				className: `relative z-10 h-8 px-4 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer ${billingCycle === "annual" ? isDark ? "text-white font-semibold" : "text-[#17181a] font-semibold" : isDark ? "text-neutral-400 hover:text-neutral-200" : "text-neutral-500 hover:text-neutral-900"}`,
				children: "Yearly"
			})
		]
	});
};
/**
* 2. DesignBookmark "Save 20%" Pop Chip:
* Scales cleanly from its right edge (--spring-pop: 520 16) when Annual is active.
*/
var PopSaveBadge = ({ visible, label = "Save 20%" }) => {
	const badgeRef = (0, import_react.useRef)(null);
	const springRef = (0, import_react.useRef)(createSpring(visible ? 1 : 0, 520, 16));
	const firstRef = (0, import_react.useRef)(true);
	(0, import_react.useEffect)(() => {
		const s = springRef.current;
		if (firstRef.current) {
			firstRef.current = false;
			s.x = s.t = visible ? 1 : 0;
			return;
		}
		s.t = visible ? 1 : 0;
		if (visible) s.x = Math.min(s.x, .3);
	}, [visible]);
	(0, import_react.useEffect)(() => {
		let rafId = 0;
		let last = performance.now();
		const loop = (now) => {
			const dt = Math.min((now - last) / 1e3, 1 / 30);
			last = now;
			const s = springRef.current;
			stepSpring(s, dt);
			if (badgeRef.current) {
				const sv = Math.max(0, s.x);
				badgeRef.current.style.transform = `scale(${sv.toFixed(4)})`;
				badgeRef.current.style.opacity = clampVal(sv * 1.4, 0, 1).toFixed(3);
			}
			rafId = requestAnimationFrame(loop);
		};
		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		ref: badgeRef,
		style: { transformOrigin: "100% 50%" },
		className: "inline-flex items-center h-6 px-2.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold leading-none will-change-[transform,opacity]",
		children: label
	});
};
/**
* 3. DesignBookmark Rolling Digit Price Drum:
* Each numeric digit rolls smoothly on a vertical 0..9 drum when the price changes.
*/
var RollingDigitPrice = ({ prefix = "$", amount, suffix = "/mo", className = "" }) => {
	const digitStr = String(Math.max(0, Math.round(amount)));
	const digits = digitStr.split("");
	const drumRefs = (0, import_react.useRef)([]);
	const springsRef = (0, import_react.useRef)([]);
	const prevLenRef = (0, import_react.useRef)(digits.length);
	if (springsRef.current.length !== digits.length || prevLenRef.current !== digits.length) {
		prevLenRef.current = digits.length;
		springsRef.current = digits.map((d, i) => createSpring(Number(d) || 0, 260, 22 + i * 2));
	}
	(0, import_react.useEffect)(() => {
		digits.forEach((d, i) => {
			const target = Number(d) || 0;
			const s = springsRef.current[i];
			if (!s) return;
			const timer = setTimeout(() => {
				s.t = target;
			}, i * 45);
			return () => clearTimeout(timer);
		});
	}, [digitStr]);
	(0, import_react.useEffect)(() => {
		let rafId = 0;
		let last = performance.now();
		const rowHeight = 40;
		const loop = (now) => {
			const dt = Math.min((now - last) / 1e3, 1 / 30);
			last = now;
			springsRef.current.forEach((s, i) => {
				stepSpring(s, dt);
				const el = drumRefs.current[i];
				if (el) el.style.transform = `translateY(${(-s.x * rowHeight).toFixed(2)}px)`;
			});
			rafId = requestAnimationFrame(loop);
		};
		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, [digits.length]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `inline-flex items-start font-bold tracking-tight ${className}`,
		children: [
			prefix && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-lg leading-7 mr-0.5",
				children: prefix
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "inline-flex h-[40px] text-[34px] leading-[40px] tabular-nums",
				style: {
					WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 14%, #000 86%, transparent 100%)",
					maskImage: "linear-gradient(180deg, transparent 0, #000 14%, #000 86%, transparent 100%)"
				},
				children: digits.map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "inline-block h-[40px] w-[0.62em] overflow-hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						ref: (el) => {
							drumRefs.current[i] = el;
						},
						className: "block will-change-transform",
						children: [
							0,
							1,
							2,
							3,
							4,
							5,
							6,
							7,
							8,
							9
						].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
							className: "block h-[40px] leading-[40px] not-italic text-center",
							children: n
						}, n))
					})
				}, i))
			}),
			suffix && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "self-end mb-1.5 ml-1 text-xs font-medium opacity-60",
				children: suffix
			})
		]
	});
};
/**
* 4. DesignBookmark Rolling Billing Line:
* Rolls vertically between Monthly vs Yearly billing description.
*/
var RollingBillingLine = ({ text, isDark = true }) => {
	const [displayed, setDisplayed] = (0, import_react.useState)(text);
	const [prevText, setPrevText] = (0, import_react.useState)(null);
	const [animating, setAnimating] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (text === displayed) return;
		setPrevText(displayed);
		setDisplayed(text);
		setAnimating(true);
		const t = setTimeout(() => {
			setPrevText(null);
			setAnimating(false);
		}, 320);
		return () => clearTimeout(t);
	}, [text, displayed]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `relative h-5 overflow-hidden text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`,
		children: [prevText && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "absolute left-0 top-0 leading-5 whitespace-nowrap transition-all duration-300 ease-out",
			style: {
				transform: animating ? "translateY(-18px)" : "translateY(0px)",
				opacity: animating ? 0 : 1
			},
			children: prevText
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block leading-5 whitespace-nowrap transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2",
			children: displayed
		}, displayed)]
	});
};
/**
* 5. DesignBookmark Spring Extra Feature Row ("Two months free"):
* Smoothly grows open on spring (260, 24) with its green checkmark popping a beat later.
*/
var ExtraFeatureRow = ({ visible, label = "Two months free", isDark = true }) => {
	const rowRef = (0, import_react.useRef)(null);
	const ckRef = (0, import_react.useRef)(null);
	const exSpring = (0, import_react.useRef)(createSpring(visible ? 1 : 0, 260, 24));
	const ekSpring = (0, import_react.useRef)(createSpring(visible ? 1 : 0, 520, 16));
	const firstRef = (0, import_react.useRef)(true);
	(0, import_react.useEffect)(() => {
		if (firstRef.current) {
			firstRef.current = false;
			exSpring.current.x = exSpring.current.t = visible ? 1 : 0;
			ekSpring.current.x = ekSpring.current.t = visible ? 1 : 0;
			return;
		}
		exSpring.current.t = visible ? 1 : 0;
		if (visible) {
			ekSpring.current.x = .3;
			ekSpring.current.t = 0;
			const t = setTimeout(() => {
				ekSpring.current.t = 1;
			}, 150);
			return () => clearTimeout(t);
		} else ekSpring.current.t = 0;
	}, [visible]);
	(0, import_react.useEffect)(() => {
		let rafId = 0;
		let last = performance.now();
		const loop = (now) => {
			const dt = Math.min((now - last) / 1e3, 1 / 30);
			last = now;
			stepSpring(exSpring.current, dt);
			stepSpring(ekSpring.current, dt);
			if (rowRef.current) {
				const ex = clampVal(exSpring.current.x, 0, 1.08);
				rowRef.current.style.height = `${(28 * ex).toFixed(2)}px`;
				rowRef.current.style.opacity = clampVal(exSpring.current.x * 1.6 - .35, 0, 1).toFixed(3);
			}
			if (ckRef.current) ckRef.current.style.transform = `scale(${Math.max(0, ekSpring.current.x).toFixed(4)})`;
			rafId = requestAnimationFrame(loop);
		};
		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		ref: rowRef,
		className: "flex items-center gap-2 overflow-hidden will-change-[height,opacity]",
		style: {
			height: visible ? "28px" : "0px",
			opacity: visible ? 1 : 0
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			ref: ckRef,
			className: "w-4 h-4 rounded-full bg-emerald-500 text-[#04140a] grid place-items-center shrink-0 will-change-transform",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-2.5 h-2.5 stroke-[3]" })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `font-medium ${isDark ? "text-emerald-300" : "text-emerald-700"}`,
			children: label
		})]
	});
};
/**
* 6. DesignBookmark Morph Upgrade CTA Button:
* Pill closes smoothly into a circular spinner while busy, and opens green with a checkmark when done/active.
*/
var MorphUpgradeButton = ({ state, idleLabel, doneLabel, onClick, disabled = false, variant = "spark", isDark = true }) => {
	const containerRef = (0, import_react.useRef)(null);
	const btnRef = (0, import_react.useRef)(null);
	const widthSpring = (0, import_react.useRef)(createSpring(state === "busy" ? 0 : 1, 260, 24));
	const popSpring = (0, import_react.useRef)(createSpring(1, 520, 16));
	(0, import_react.useEffect)(() => {
		widthSpring.current.t = state === "busy" ? 0 : 1;
		if (state === "done") {
			popSpring.current.x = .92;
			popSpring.current.t = 1;
		} else if (state === "busy") {
			popSpring.current.x = .94;
			popSpring.current.t = 1;
		}
	}, [state]);
	(0, import_react.useEffect)(() => {
		let rafId = 0;
		let last = performance.now();
		const loop = (now) => {
			const dt = Math.min((now - last) / 1e3, 1 / 30);
			last = now;
			stepSpring(widthSpring.current, dt);
			stepSpring(popSpring.current, dt);
			if (btnRef.current && containerRef.current) {
				const w = 42 + ((containerRef.current.clientWidth || 240) - 42) * clampVal(widthSpring.current.x, 0, 1.02);
				btnRef.current.style.width = `${w.toFixed(2)}px`;
				btnRef.current.style.transform = `scale(${popSpring.current.x.toFixed(4)})`;
			}
			rafId = requestAnimationFrame(loop);
		};
		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: containerRef,
		className: "w-full flex justify-center mb-5",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			ref: btnRef,
			type: "button",
			disabled: disabled || state === "busy" || state === "done",
			onClick,
			className: `relative h-[42px] rounded-full border-0 text-xs font-semibold flex items-center justify-center gap-2 overflow-hidden transition-colors duration-300 will-change-[width,transform] ${state === "done" ? "bg-emerald-500 text-[#04140a] cursor-default" : variant === "fire" ? "bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer" : isDark ? "bg-white hover:bg-zinc-200 text-black cursor-pointer" : "bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer"}`,
			children: state === "busy" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin",
				"aria-label": "Upgrading..."
			}) : state === "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex items-center gap-1.5 whitespace-nowrap px-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 stroke-[2.8]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: doneLabel })]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "whitespace-nowrap px-3",
				children: idleLabel
			})
		})
	});
};
//#endregion
//#region src/components/PricingModal.tsx
var FALLBACK_COUNTRIES = [
	{
		code: "US",
		name: "United States",
		flag: "🇺🇸",
		currency: "USD",
		symbol: "$"
	},
	{
		code: "IN",
		name: "India",
		flag: "🇮🇳",
		currency: "INR",
		symbol: "₹"
	},
	{
		code: "GB",
		name: "United Kingdom",
		flag: "🇬🇧",
		currency: "GBP",
		symbol: "£"
	},
	{
		code: "CA",
		name: "Canada",
		flag: "🇨🇦",
		currency: "CAD",
		symbol: "CA$"
	},
	{
		code: "AU",
		name: "Australia",
		flag: "🇦🇺",
		currency: "AUD",
		symbol: "A$"
	},
	{
		code: "DE",
		name: "Germany",
		flag: "🇩🇪",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "FR",
		name: "France",
		flag: "🇫🇷",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "NL",
		name: "Netherlands",
		flag: "🇳🇱",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "BE",
		name: "Belgium",
		flag: "🇧🇪",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "AT",
		name: "Austria",
		flag: "🇦🇹",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "IT",
		name: "Italy",
		flag: "🇮🇹",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "ES",
		name: "Spain",
		flag: "🇪🇸",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "PT",
		name: "Portugal",
		flag: "🇵🇹",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "IE",
		name: "Ireland",
		flag: "🇮🇪",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "FI",
		name: "Finland",
		flag: "🇫🇮",
		currency: "EUR",
		symbol: "€"
	},
	{
		code: "PL",
		name: "Poland",
		flag: "🇵🇱",
		currency: "PLN",
		symbol: "zł"
	},
	{
		code: "SE",
		name: "Sweden",
		flag: "🇸🇪",
		currency: "SEK",
		symbol: "kr"
	},
	{
		code: "NO",
		name: "Norway",
		flag: "🇳🇴",
		currency: "NOK",
		symbol: "kr"
	},
	{
		code: "DK",
		name: "Denmark",
		flag: "🇩🇰",
		currency: "DKK",
		symbol: "kr"
	},
	{
		code: "CH",
		name: "Switzerland",
		flag: "🇨🇭",
		currency: "CHF",
		symbol: "CHF"
	},
	{
		code: "SG",
		name: "Singapore",
		flag: "🇸🇬",
		currency: "SGD",
		symbol: "S$"
	},
	{
		code: "JP",
		name: "Japan",
		flag: "🇯🇵",
		currency: "JPY",
		symbol: "¥"
	},
	{
		code: "KR",
		name: "South Korea",
		flag: "🇰🇷",
		currency: "KRW",
		symbol: "₩"
	},
	{
		code: "BR",
		name: "Brazil",
		flag: "🇧🇷",
		currency: "BRL",
		symbol: "R$"
	},
	{
		code: "MX",
		name: "Mexico",
		flag: "🇲🇽",
		currency: "MXN",
		symbol: "MX$"
	},
	{
		code: "PH",
		name: "Philippines",
		flag: "🇵🇭",
		currency: "PHP",
		symbol: "₱"
	},
	{
		code: "MY",
		name: "Malaysia",
		flag: "🇲🇾",
		currency: "MYR",
		symbol: "RM"
	},
	{
		code: "HK",
		name: "Hong Kong",
		flag: "🇭🇰",
		currency: "HKD",
		symbol: "HK$"
	},
	{
		code: "AE",
		name: "United Arab Emirates",
		flag: "🇦🇪",
		currency: "AED",
		symbol: "AED "
	},
	{
		code: "SA",
		name: "Saudi Arabia",
		flag: "🇸🇦",
		currency: "SAR",
		symbol: "SAR "
	},
	{
		code: "ZA",
		name: "South Africa",
		flag: "🇿🇦",
		currency: "ZAR",
		symbol: "R"
	},
	{
		code: "NZ",
		name: "New Zealand",
		flag: "🇳🇿",
		currency: "NZD",
		symbol: "NZ$"
	},
	{
		code: "ID",
		name: "Indonesia",
		flag: "🇮🇩",
		currency: "IDR",
		symbol: "Rp"
	},
	{
		code: "TH",
		name: "Thailand",
		flag: "🇹🇭",
		currency: "THB",
		symbol: "฿"
	},
	{
		code: "VN",
		name: "Vietnam",
		flag: "🇻🇳",
		currency: "VND",
		symbol: "₫"
	},
	{
		code: "TW",
		name: "Taiwan",
		flag: "🇹🇼",
		currency: "TWD",
		symbol: "NT$"
	},
	{
		code: "IL",
		name: "Israel",
		flag: "🇮🇱",
		currency: "ILS",
		symbol: "₪"
	},
	{
		code: "TR",
		name: "Turkey",
		flag: "🇹🇷",
		currency: "TRY",
		symbol: "₺"
	},
	{
		code: "NG",
		name: "Nigeria",
		flag: "🇳🇬",
		currency: "NGN",
		symbol: "₦"
	},
	{
		code: "KE",
		name: "Kenya",
		flag: "🇰🇪",
		currency: "KES",
		symbol: "KSh"
	},
	{
		code: "EG",
		name: "Egypt",
		flag: "🇪🇬",
		currency: "EGP",
		symbol: "E£"
	},
	{
		code: "AR",
		name: "Argentina",
		flag: "🇦🇷",
		currency: "ARS",
		symbol: "ARS "
	},
	{
		code: "CL",
		name: "Chile",
		flag: "🇨🇱",
		currency: "CLP",
		symbol: "CLP$"
	},
	{
		code: "CO",
		name: "Colombia",
		flag: "🇨🇴",
		currency: "COP",
		symbol: "COP$"
	},
	{
		code: "PE",
		name: "Peru",
		flag: "🇵🇪",
		currency: "PEN",
		symbol: "S/"
	},
	{
		code: "CZ",
		name: "Czechia",
		flag: "🇨🇿",
		currency: "CZK",
		symbol: "Kč"
	},
	{
		code: "HU",
		name: "Hungary",
		flag: "🇭🇺",
		currency: "HUF",
		symbol: "Ft"
	},
	{
		code: "RO",
		name: "Romania",
		flag: "🇷🇴",
		currency: "RON",
		symbol: "lei"
	},
	{
		code: "GR",
		name: "Greece",
		flag: "🇬🇷",
		currency: "EUR",
		symbol: "€"
	}
];
var PricingModal = ({ isOpen, onClose, initialHighlightPlan, limitReason, isDark = true, embedded = false }) => {
	const [billingCycle, setBillingCycle] = (0, import_react.useState)("monthly");
	const [currentPlan, setCurrentPlan] = (0, import_react.useState)(() => UserAccountStore.getNormalizedPlan());
	const [usage, setUsage] = (0, import_react.useState)(() => UserAccountStore.getUsage());
	const [upgradeBanner, setUpgradeBanner] = (0, import_react.useState)(null);
	const [isSyncingQuota, setIsSyncingQuota] = (0, import_react.useState)(false);
	const [isStatusModalOpen, setIsStatusModalOpen] = (0, import_react.useState)(false);
	const [countries, setCountries] = (0, import_react.useState)(FALLBACK_COUNTRIES);
	const [selectedCountry, setSelectedCountry] = (0, import_react.useState)(() => {
		try {
			return localStorage.getItem("kinich_billing_country") || "IN";
		} catch {
			return "IN";
		}
	});
	const [billingMe, setBillingMe] = (0, import_react.useState)(null);
	const [checkoutBusyPlan, setCheckoutBusyPlan] = (0, import_react.useState)(null);
	const [cancelBusy, setCancelBusy] = (0, import_react.useState)(false);
	const [guestSignInPromptPlan, setGuestSignInPromptPlan] = (0, import_react.useState)(null);
	const [refundDrawerOpen, setRefundDrawerOpen] = (0, import_react.useState)(false);
	const [refundPaymentId, setRefundPaymentId] = (0, import_react.useState)("");
	const [refundReason, setRefundReason] = (0, import_react.useState)("requested_by_customer");
	const [refundNote, setRefundNote] = (0, import_react.useState)("");
	const [refundCancelSub, setRefundCancelSub] = (0, import_react.useState)(true);
	const [refundBusy, setRefundBusy] = (0, import_react.useState)(false);
	const fetchPricePreviewForCountry = async (countryCode) => {
		try {
			await fetch("/api/billing/preview", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ country: countryCode })
			});
		} catch {}
	};
	const fetchBillingMeAndCountries = async () => {
		try {
			const authHeaders = await getAuthHeaders();
			const [countriesRes, meRes] = await Promise.all([fetch("/api/billing/countries").catch(() => null), fetch("/api/billing/me", { headers: authHeaders }).catch(() => null)]);
			let resolvedCountry = selectedCountry;
			if (countriesRes && countriesRes.ok) {
				const cData = await countriesRes.json();
				if (Array.isArray(cData?.countries) && cData.countries.length > 0) setCountries(cData.countries);
				if (cData?.defaultCountry && !localStorage.getItem("kinich_billing_country")) resolvedCountry = cData.defaultCountry;
			}
			if (meRes && meRes.ok) {
				const meData = await meRes.json();
				setBillingMe(meData);
				if (meData?.billingCountry && !localStorage.getItem("kinich_billing_country")) resolvedCountry = meData.billingCountry;
				if (meData?.authenticated && (meData.effectivePlan === "spark" || meData.effectivePlan === "fire" || meData.effectivePlan === "free") && (meData.planStatus !== "none" || Array.isArray(meData.refunds) && meData.refunds.length > 0)) {
					if (UserAccountStore.getNormalizedPlan() !== meData.effectivePlan) UserAccountStore.upgradePlan(meData.effectivePlan, meData.planInterval === "yearly" ? "yearly" : "monthly");
					setCurrentPlan(meData.effectivePlan);
					setUsage(UserAccountStore.getUsage());
				}
			}
			if (resolvedCountry !== selectedCountry) setSelectedCountry(resolvedCountry);
			await fetchPricePreviewForCountry(resolvedCountry);
		} catch {}
	};
	const handleSelectCountry = async (code) => {
		setSelectedCountry(code);
		try {
			localStorage.setItem("kinich_billing_country", code);
		} catch {}
		fetchPricePreviewForCountry(code);
		try {
			const authHeaders = await getAuthHeaders();
			await fetch("/api/billing/country", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...authHeaders
				},
				body: JSON.stringify({ country: code })
			});
		} catch {}
	};
	(0, import_react.useEffect)(() => {
		if (isOpen || embedded) fetchBillingMeAndCountries();
	}, [isOpen, embedded]);
	(0, import_react.useEffect)(() => {
		UserAccountStore.syncQuotaWithServerAndFirestore();
		const sync = () => {
			const nextPlan = UserAccountStore.getNormalizedPlan();
			setCurrentPlan(nextPlan);
			setUsage(UserAccountStore.getUsage());
		};
		window.addEventListener("kinich-account-updated", sync);
		return () => {
			window.removeEventListener("kinich-account-updated", sync);
		};
	}, [initialHighlightPlan]);
	if (!isOpen && !embedded) return null;
	const isFirebaseSignedIn = Boolean(auth.currentUser && UserAccountStore.getProfile().signinProvider !== "guest");
	const handleSelectPlan = async (targetPlan) => {
		const interval = billingCycle === "annual" ? "yearly" : "monthly";
		if (targetPlan === "free") {
			if (currentPlan !== "free") {
				const defaultPayId = billingMe?.latestRefundablePayment?.dodo_payment_id || billingMe?.payments?.find((p) => p.status !== "refunded")?.dodo_payment_id || "";
				setRefundPaymentId(defaultPayId);
				setRefundCancelSub(true);
				setRefundDrawerOpen(true);
				return;
			}
			UserAccountStore.upgradePlan("free", interval);
			setCurrentPlan("free");
			setUsage(UserAccountStore.getUsage());
			setUpgradeBanner("Active plan set to Free Tier.");
			setTimeout(() => setUpgradeBanner(null), 5e3);
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
			if (billingMe?.dodoSubscriptionId && billingMe?.planStatus === "active") {
				const changeRes = await fetch("/api/billing/change-plan", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...authHeaders
					},
					body: JSON.stringify({
						plan: targetPlan,
						interval
					})
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
			const resp = await fetch("/api/billing/checkout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...authHeaders
				},
				body: JSON.stringify({
					plan: targetPlan,
					interval,
					country: selectedCountry,
					email: profile?.email || auth.currentUser?.email || void 0,
					name: profile?.displayName || auth.currentUser?.displayName || void 0
				})
			});
			const data = await resp.json();
			if (resp.ok && data?.checkout_url) {
				window.location.href = String(data.checkout_url);
				return;
			} else setUpgradeBanner(data?.error || "Could not initiate checkout session. Please try again.");
		} catch (err) {
			setUpgradeBanner(err?.message || "Network error while creating checkout session.");
		} finally {
			setCheckoutBusyPlan(null);
		}
	};
	const handleCancelSubscription = async (atPeriodEnd = true, resume = false, immediate = false) => {
		setCancelBusy(true);
		try {
			const result = await cancelUserSubscription({
				atPeriodEnd,
				resume,
				immediate
			});
			if (result.success) {
				if (resume) {
					const restoredPlan = result.plan && result.plan !== "free" ? result.plan : "spark";
					UserAccountStore.upgradePlan(restoredPlan, billingCycle === "annual" ? "yearly" : "monthly");
					setCurrentPlan(restoredPlan);
					setUsage(UserAccountStore.getUsage());
				} else if (immediate || !atPeriodEnd && !resume) {
					UserAccountStore.upgradePlan("free", "monthly");
					setCurrentPlan("free");
					setUsage(UserAccountStore.getUsage());
				}
				setUpgradeBanner(result.message || (resume ? "Subscription restored." : immediate ? "Plan cancelled immediately." : "Auto-renewal cancelled."));
				await fetchBillingMeAndCountries();
			} else setUpgradeBanner(result.error || "Could not update subscription status.");
		} catch {
			setUpgradeBanner("Network error updating subscription.");
		} finally {
			setCancelBusy(false);
		}
	};
	const handleRequestRefund = async (e) => {
		if (e) e.preventDefault();
		setRefundBusy(true);
		try {
			const finalReason = refundNote.trim() ? `${refundReason}: ${refundNote.trim()}` : refundReason;
			const result = await requestSubscriptionRefund({
				paymentId: refundPaymentId || void 0,
				reason: finalReason,
				cancelSubscription: refundCancelSub
			});
			if (result.success) {
				if (refundCancelSub) {
					UserAccountStore.upgradePlan("free", "monthly");
					setCurrentPlan("free");
					setUsage(UserAccountStore.getUsage());
				}
				setUpgradeBanner(result.message || "Refund processed via Dodo Payments.");
				setRefundDrawerOpen(false);
				setRefundNote("");
				await fetchBillingMeAndCountries();
			} else setUpgradeBanner(result.error || "Could not process refund request.");
		} catch (err) {
			setUpgradeBanner(err?.message || "Network error while requesting refund.");
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
	const effectiveFileLimit = currentPlan === "free" ? PLAN_LIMITS.free.fileUploadLimit : usage.fileUploadLimit || planLimits.fileUploadLimit;
	const effectivePromptLimit = currentPlan === "free" ? PLAN_LIMITS.free.messageLimit : usage.messageLimit || planLimits.messageLimit;
	const effectiveSearchLimit = currentPlan === "free" ? PLAN_LIMITS.free.searchLimit : usage.searchLimit || planLimits.searchLimit;
	const effectiveDeepResearchLimit = currentPlan === "free" ? PLAN_LIMITS.free.deepResearchLimit : usage.deepResearchLimit || planLimits.deepResearchLimit;
	const effectivePdfStudyLimit = currentPlan === "free" ? PLAN_LIMITS.free.pdfStudyLimit : usage.pdfStudyLimit || planLimits.pdfStudyLimit;
	const openDocsPage = () => {
		if (!embedded) onClose();
		if (typeof window !== "undefined") {
			window.history.pushState({}, "", "/docs");
			window.dispatchEvent(new PopStateEvent("popstate"));
			window.scrollTo({ top: 0 });
		}
	};
	const hasBillingControls = currentPlan !== "free" || billingMe && (billingMe.planStatus !== "none" || Array.isArray(billingMe.payments) && billingMe.payments.length > 0 || Array.isArray(billingMe.refunds) && billingMe.refunds.length > 0);
	const innerContent = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [
						!embedded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onClose,
							className: `size-9 rounded-xl flex items-center justify-center border transition-colors cursor-pointer ${isDark ? "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white" : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-900"}`,
							title: "Back",
							"aria-label": "Back",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-4 h-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-xl sm:text-2xl font-bold tracking-tight",
							children: "Plans"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: openDocsPage,
							className: `text-xs font-medium underline underline-offset-4 cursor-pointer transition-colors ${isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"}`,
							children: "Docs & Guide →"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomSearchSelect, {
						value: selectedCountry,
						onChange: (val) => handleSelectCountry(val),
						isDark,
						ariaLabel: "Select billing country",
						align: "left",
						searchPlaceholder: "Search country or currency...",
						options: countries.map((c) => ({
							value: c.code,
							label: c.name,
							flag: c.flag,
							badge: c.currency,
							searchKeywords: `${c.name} ${c.code} ${c.currency} ${c.symbol}`
						}))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanSwitchBillingToggle, {
						billingCycle,
						onChange: (next) => setBillingCycle(next),
						isDark
					})]
				})]
			}),
			guestSignInPromptPlan && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${isDark ? "bg-zinc-900 border-[#FC4C01]/40 text-white" : "bg-orange-50/70 border-[#FC4C01]/30 text-zinc-900"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-semibold",
					children: [
						"Sign in with Google or Email to subscribe to",
						" ",
						guestSignInPromptPlan === "spark" ? "Spark" : "Fire",
						"."
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							setGuestSignInPromptPlan(null);
							onClose();
							window.dispatchEvent(new CustomEvent("kinich-open-auth", { detail: { reason: `Sign in to subscribe to ${guestSignInPromptPlan === "spark" ? "Spark" : "Fire"}` } }));
						},
						className: "px-3.5 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white font-semibold cursor-pointer",
						children: "Sign in"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setGuestSignInPromptPlan(null),
						className: "px-2.5 py-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer",
						children: "Dismiss"
					})]
				})]
			}),
			limitReason && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${isDark ? "bg-zinc-900 border-amber-500/30 text-amber-200" : "bg-amber-50 border-amber-300 text-amber-900"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-semibold",
					children: limitReason
				})
			}),
			upgradeBanner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${isDark ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-200" : "bg-emerald-50 border-emerald-300 text-emerald-900"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-semibold",
					children: upgradeBanner
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setUpgradeBanner(null),
					className: "opacity-70 hover:opacity-100 cursor-pointer",
					children: "Dismiss"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `rounded-2xl border p-5 flex flex-col justify-between transition-all ${currentPlan === "free" ? isDark ? "bg-zinc-900/90 border-zinc-700" : "bg-white border-zinc-300 shadow-xs" : isDark ? "bg-zinc-900/50 border-zinc-800/80" : "bg-white border-zinc-200"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2 mb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-lg font-bold tracking-tight",
									children: "Free"
								}), currentPlan === "free" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700"}`,
									children: "Current"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline gap-1.5 mb-5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-3xl font-bold tracking-tight",
									children: selectedCountry === "IN" ? "₹0" : "$0"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`,
									children: "/ forever"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => handleSelectPlan("free"),
								disabled: currentPlan === "free",
								className: `w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all mb-5 ${currentPlan === "free" ? isDark ? "bg-zinc-800 text-zinc-400 cursor-default" : "bg-zinc-100 text-zinc-500 cursor-default" : isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 cursor-pointer"}`,
								children: currentPlan === "free" ? "Current Plan" : "Switch to Free"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-2.5 text-xs",
								children: [
									"5 prompts / day",
									"3 file uploads / day",
									"5 web searches / day",
									"3 Deep Research runs / day",
									"5 Study sessions / day",
									"Hitaishi Live Voice & 3D Companion (Standard)"
								].map((feat) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: `w-3.5 h-3.5 shrink-0 ${isDark ? "text-zinc-400" : "text-zinc-600"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: isDark ? "text-zinc-300" : "text-zinc-700",
										children: feat
									})]
								}, feat))
							})
						] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `rounded-[24px] border p-5 flex flex-col justify-between transition-all ${currentPlan === "spark" ? "border-[#FC4C01] ring-1 ring-[#FC4C01]/30 " + (isDark ? "bg-zinc-900" : "bg-white shadow-sm") : isDark ? "bg-zinc-900/80 border-zinc-800 hover:border-zinc-700" : "bg-white border-zinc-200 hover:border-zinc-300 shadow-2xs"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2 mb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-lg font-bold tracking-tight",
									children: "Spark"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopSaveBadge, {
										visible: billingCycle === "annual",
										label: "Save 20%"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FC4C01]/15 text-[#FC4C01]",
										children: currentPlan === "spark" ? "Current" : "10x Quotas"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-4 space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RollingDigitPrice, {
									prefix: selectedCountry === "IN" ? "₹" : "$",
									amount: selectedCountry === "IN" ? billingCycle === "annual" ? 79 : 99 : billingCycle === "annual" ? 2 : 3,
									suffix: "/mo"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RollingBillingLine, {
									text: billingCycle === "annual" ? selectedCountry === "IN" ? "Billed ₹949 yearly + GST" : "Billed $29 yearly ($2.42/mo)" : "Billed monthly, cancel anytime",
									isDark
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MorphUpgradeButton, {
								state: checkoutBusyPlan === "spark" ? "busy" : currentPlan === "spark" ? "done" : "idle",
								idleLabel: currentPlan === "fire" ? "Switch to Spark" : "Upgrade to Spark",
								doneLabel: "You're on Spark",
								onClick: () => handleSelectPlan("spark"),
								disabled: checkoutBusyPlan !== null && checkoutBusyPlan !== "spark",
								variant: "spark",
								isDark
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "space-y-2.5 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExtraFeatureRow, {
									visible: billingCycle === "annual",
									label: "Two months free",
									isDark
								}), [
									"1,500 prompts / day",
									"250 file uploads / day",
									"750 web searches / day",
									"100 Deep Research runs / day",
									"200 Study sessions / day",
									"Hitaishi Live 3D Voice Companion (300 turns/day)",
									"Spark Reasoning & Vision Models"
								].map((feat) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 shrink-0 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: isDark ? "text-zinc-200" : "text-zinc-800",
										children: feat
									})]
								}, feat))]
							})
						] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `rounded-[24px] border p-5 flex flex-col justify-between transition-all ${currentPlan === "fire" ? "border-[#FC4C01] ring-1 ring-[#FC4C01]/40 " + (isDark ? "bg-zinc-900" : "bg-white shadow-sm") : isDark ? "bg-zinc-900 border-[#FC4C01]/50" : "bg-white border-[#FC4C01]/60 shadow-xs"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2 mb-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-lg font-bold tracking-tight",
									children: "Fire 🔥"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopSaveBadge, {
										visible: billingCycle === "annual",
										label: "Save 20%"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#FC4C01] text-white",
										children: currentPlan === "fire" ? "Current" : "Unlimited"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-4 space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RollingDigitPrice, {
									prefix: selectedCountry === "IN" ? "₹" : "$",
									amount: selectedCountry === "IN" ? billingCycle === "annual" ? 200 : 249 : billingCycle === "annual" ? 7 : 9,
									suffix: "/mo"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RollingBillingLine, {
									text: billingCycle === "annual" ? selectedCountry === "IN" ? "Billed ₹2,399 yearly + GST" : "Billed $86 yearly ($7.17/mo)" : "Billed monthly, cancel anytime",
									isDark
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MorphUpgradeButton, {
								state: checkoutBusyPlan === "fire" ? "busy" : currentPlan === "fire" ? "done" : "idle",
								idleLabel: "Upgrade to Fire",
								doneLabel: "You're on Fire 🔥",
								onClick: () => handleSelectPlan("fire"),
								disabled: checkoutBusyPlan !== null && checkoutBusyPlan !== "fire",
								variant: "fire",
								isDark
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "space-y-2.5 text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExtraFeatureRow, {
									visible: billingCycle === "annual",
									label: "Two months free",
									isDark
								}), [
									"Unlimited prompts & messages",
									"Unlimited file & PDF uploads",
									"Unlimited web searches & Deep Research",
									"Unlimited Study sessions & Vault storage",
									"Unlimited Hitaishi Live 3D Voice Companion",
									"All Frontier & Vision Models",
									"Personal Study Agents & Morning Brief"
								].map((feat) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 shrink-0 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: isDark ? "text-zinc-100 font-medium" : "text-zinc-900 font-medium",
										children: feat
									})]
								}, feat))]
							})
						] })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `rounded-2xl border p-4 ${isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2 mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: `text-xs font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`,
						children: [
							"Daily Usage (",
							currentPlan === "fire" ? "FIRE · UNLIMITED" : currentPlan.toUpperCase(),
							")"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: handleManualSyncQuota,
						className: `text-[11px] inline-flex items-center gap-1 cursor-pointer ${isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`,
						title: "Sync usage",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3 h-3 ${isSyncingQuota ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sync" })]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-2 sm:grid-cols-5 gap-2.5",
					children: [
						{
							label: "Prompts",
							used: usage.messagesUsed,
							limit: effectivePromptLimit
						},
						{
							label: "Uploads",
							used: usage.filesUploaded,
							limit: effectiveFileLimit
						},
						{
							label: "Searches",
							used: usage.searchesUsed,
							limit: effectiveSearchLimit
						},
						{
							label: "Research",
							used: usage.deepResearchUsed,
							limit: effectiveDeepResearchLimit
						},
						{
							label: "Study",
							used: usage.pdfStudyUsed,
							limit: effectivePdfStudyLimit
						}
					].map((stat) => {
						const isUnlimited = currentPlan === "fire" || stat.limit >= 999999;
						const pct = isUnlimited ? Math.min(100, Math.round(stat.used / 500 * 100)) : Math.min(100, Math.round(stat.used / Math.max(1, stat.limit) * 100));
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-2.5 rounded-xl border ${isDark ? "bg-zinc-950/60 border-zinc-800/80" : "bg-zinc-50 border-zinc-200/80"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-1 text-[11px] mb-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: isDark ? "text-zinc-400" : "text-zinc-500",
									children: stat.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono font-semibold",
									children: isUnlimited ? `${stat.used}/∞` : `${stat.used}/${stat.limit}`
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `w-full h-1 rounded-full overflow-hidden ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full rounded-full bg-[#FC4C01] transition-all",
									style: { width: `${pct}%` }
								})
							})]
						}, stat.label);
					})
				})]
			}),
			hasBillingControls && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `rounded-2xl border p-4 space-y-3 ${isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs font-bold",
								children: ["Subscription: ", currentPlan.toUpperCase()]
							}), billingMe?.planStatus && billingMe.planStatus !== "none" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `text-[10px] font-mono px-2 py-0.5 rounded-md ${isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700"}`,
								children: billingMe.planStatus
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: refundBusy || cancelBusy,
									onClick: () => {
										const defaultPay = billingMe?.latestRefundablePayment?.dodo_payment_id || billingMe?.payments?.find((p) => p.status !== "refunded")?.dodo_payment_id || "";
										setRefundPaymentId(defaultPay);
										setRefundDrawerOpen((prev) => !prev);
									},
									className: "px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors",
									children: "Request Refund"
								}),
								currentPlan !== "free" && !billingMe?.cancelAtPeriodEnd && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: cancelBusy,
									onClick: () => handleCancelSubscription(true, false, false),
									className: `px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${isDark ? "border-zinc-700 hover:bg-zinc-800 text-zinc-200" : "border-zinc-300 hover:bg-zinc-100 text-zinc-800"}`,
									children: "Cancel Auto-Renewal"
								}),
								billingMe?.cancelAtPeriodEnd && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: cancelBusy,
									onClick: () => handleCancelSubscription(false, true, false),
									className: "px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-semibold cursor-pointer",
									children: "Resume Plan"
								}),
								currentPlan !== "free" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: cancelBusy,
									onClick: () => handleCancelSubscription(false, false, true),
									className: "px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold cursor-pointer transition-colors",
									children: "Cancel Plan"
								})
							]
						})]
					}),
					refundDrawerOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: handleRequestRefund,
						className: `p-3.5 rounded-xl border space-y-3 ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-1 sm:grid-cols-2 gap-2.5",
							children: [Array.isArray(billingMe?.payments) && billingMe.payments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomSearchSelect, {
								value: refundPaymentId,
								onChange: (val) => setRefundPaymentId(val),
								isDark,
								ariaLabel: "Select payment to refund",
								align: "left",
								options: billingMe.payments.filter((p) => p.status !== "refunded").map((p) => ({
									value: p.dodo_payment_id,
									label: p.dodo_payment_id,
									badge: `${((Number(p.amount) || 0) / 100).toFixed(2)} ${p.currency || "INR"}`
								}))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomSearchSelect, {
								value: refundReason,
								onChange: (val) => setRefundReason(val),
								isDark,
								ariaLabel: "Select refund reason",
								align: "left",
								options: [
									{
										value: "requested_by_customer",
										label: "7-day money-back guarantee"
									},
									{
										value: "cancelled_want_refund",
										label: "Cancelled subscription — refund payment"
									},
									{
										value: "duplicate",
										label: "Accidental or duplicate charge"
									}
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								disabled: refundBusy,
								className: "px-3.5 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer",
								children: refundBusy ? "Processing..." : "Confirm Refund"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setRefundDrawerOpen(false),
								className: "px-3 py-1.5 rounded-lg text-xs opacity-70 hover:opacity-100 cursor-pointer",
								children: "Cancel"
							})]
						})]
					}),
					Array.isArray(billingMe?.payments) && billingMe.payments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "pt-2 border-t border-current/10 space-y-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `text-[11px] font-semibold ${isDark ? "text-zinc-400" : "text-zinc-500"}`,
							children: "Recent Payments"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-1",
							children: billingMe.payments.slice(0, 3).map((p) => {
								const isRefunded = p.status === "refunded";
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between gap-2 text-xs py-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 min-w-0",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: isDark ? "text-zinc-400" : "text-zinc-500",
												children: p.created_at ? new Date(p.created_at).toLocaleDateString() : "Recent"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-mono font-semibold",
												children: [
													((Number(p.amount) || 0) / 100).toFixed(2),
													" ",
													p.currency || "INR"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `text-[10px] px-1.5 py-0.5 rounded font-mono ${isRefunded ? "bg-sky-500/15 text-sky-400" : p.status === "succeeded" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`,
												children: p.status || "paid"
											})
										]
									}), !isRefunded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: refundBusy,
										onClick: () => {
											setRefundPaymentId(p.dodo_payment_id);
											setRefundDrawerOpen(true);
										},
										className: "text-[11px] font-semibold text-[#FC4C01] hover:underline cursor-pointer shrink-0",
										children: "Refund"
									})]
								}, p.dodo_payment_id);
							})
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DodoStatusModal, {
				isOpen: isStatusModalOpen,
				onClose: () => setIsStatusModalOpen(false),
				onContinueCheckout: checkoutBusyPlan ? () => handleSelectPlan(checkoutBusyPlan) : void 0
			})
		]
	});
	if (embedded) return innerContent;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `fixed inset-0 z-50 w-full h-[100dvh] overflow-y-auto scrollbar-thin transition-colors ${isDark ? "bg-[#09090b] text-white" : "bg-[#fafafa] text-[#09090b]"}`,
		children: innerContent
	});
};
//#endregion
export { PricingModal };
