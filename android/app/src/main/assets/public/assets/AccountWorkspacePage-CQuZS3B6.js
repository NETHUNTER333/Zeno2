const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/PricingModal-LzRm7ROj.js","assets/rolldown-runtime-oLLnCvco.js","assets/react-vendor-ZF-Fgzq4.js","assets/markdown-katex-uiIk3YnD.js","assets/markdown-katex-BCcB3TC_.css","assets/firebase-Df8_wQ36.js","assets/firebase-CeWUhFTz.js","assets/index-DaFzEGR-.js","assets/definitions-Dp8cO91-.js","assets/preload-helper-C-oUlkXR.js","assets/index-B0ZCVDlW.css","assets/CustomSearchSelect-V94h5mQs.js","assets/billing-CwLdeIHw.js","assets/springMotion-z9bpjJ2E.js","assets/BillingHistorySection-BGPqg392.js"])))=>i.map(i=>d[i]);
import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { $ as Save, $t as ExternalLink, B as SlidersVertical, G as Shield, Gt as Flame, K as ShieldCheck, Lt as Globe, Mn as Award, P as Sun, Rn as ArrowLeft, St as MapPin, Vt as Gift, Wt as FolderOpen, Z as Search, Zt as Eye, _ as User, an as Download, et as RotateCcw, f as X, ft as Navigation, gn as CircleX, ht as Moon, it as Receipt, mn as Clock, nt as RefreshCw, sn as Cpu, u as Zap, v as Upload, vn as CircleCheck, w as Trash2, wn as Check, wt as Lock, x as TriangleAlert, xn as ChevronRight, yt as MessageSquare, z as SlidersHorizontal } from "./react-vendor-ZF-Fgzq4.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { m as getAuthHeaders, n as auth } from "./firebase-Df8_wQ36.js";
import { t as __vitePreload } from "./preload-helper-C-oUlkXR.js";
import { $ as getModelRequiredTier, A as fetchMyReferralStatus, B as fetchUserReferralDashboard, K as ModalSkeleton, P as getEightReferralTrackerState, Q as GROK_MODELS, S as REFERRAL_8_REWARD_TIERS, T as claimEightReferralTier, U as SiteFooter, ct as getEffectiveLocationPayload, dt as searchCities, et as setStoredBackgroundGradientMode, ft as setLocationDisabled, h as SUPPORTED_STUDY_LANGUAGES, ht as setPersistPreciseLocation, lt as getStoredLocationPref, mt as setManualLocationPlace, ot as clearStoredLocationPref, pt as setLocationMode, q as Skeleton, rt as UserAccountStore, st as fetchClientApproximateIpLocation, ut as requestPreciseLocation } from "./index-DaFzEGR-.js";
import { n as StudyLanguageDropdown } from "./CustomSearchSelect-V94h5mQs.js";
import { i as requestSubscriptionRefund, t as cancelUserSubscription } from "./billing-CwLdeIHw.js";
//#region src/lib/modelPromptDefaults.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var DEFAULT_REGULAR_MODEL_PROMPT = "You are Kinich, a sharp, natural, and reliable AI assistant. Always identify strictly as Kinich—never disclose, claim, or attribute yourself to any upstream provider, company, or model name (including Sapiens AI, Mistral, DeepSeek, Qwen, OpenAI, Anthropic, Google, xAI, Meta, or Crow). If asked who you are or who made you, state plainly that you are Kinich.";
var DEFAULT_MODEL_TEMPERATURE = .5;
var DEFAULT_REASONING_EFFORT = "medium";
//#endregion
//#region src/components/ModelSettingsPanel.tsx
var import_jsx_runtime = require_jsx_runtime();
var ModelSettingsPanel = ({ isDark, selectedModel, onSelectModel, webSearchDefault, onToggleWebSearchDefault, onOpenPricing, onSaved }) => {
	const [personalization, setPersonalization] = (0, import_react.useState)(() => UserAccountStore.getPersonalization());
	const [modelSearch, setModelSearch] = (0, import_react.useState)("");
	const [tierFilter, setTierFilter] = (0, import_react.useState)("all");
	const [regularPromptDraft, setRegularPromptDraft] = (0, import_react.useState)(() => UserAccountStore.getPersonalization().regularSystemPrompt?.trim() || "You are Kinich, a sharp, natural, and reliable AI assistant. Always identify strictly as Kinich—never disclose, claim, or attribute yourself to any upstream provider, company, or model name (including Sapiens AI, Mistral, DeepSeek, Qwen, OpenAI, Anthropic, Google, xAI, Meta, or Crow). If asked who you are or who made you, state plainly that you are Kinich.");
	const currentPlan = UserAccountStore.getNormalizedPlan();
	const visionModels = (0, import_react.useMemo)(() => GROK_MODELS.filter((m) => m.supportsVision), []);
	const filteredModels = (0, import_react.useMemo)(() => {
		const q = modelSearch.trim().toLowerCase();
		return GROK_MODELS.filter((m) => {
			const tier = getModelRequiredTier(m);
			if ((tierFilter === "free" || tierFilter === "spark" || tierFilter === "fire") && tier !== tierFilter) return false;
			if (!q) return true;
			return m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
		});
	}, [modelSearch, tierFilter]);
	const cardClass = isDark ? "bg-[#121215] border-white/10 text-[#f4f4f5]" : "bg-white border-black/10 text-[#09090b] shadow-xs";
	const inputClass = isDark ? "bg-[#09090b] border-white/12 text-white placeholder-neutral-500 focus:border-[#FC4C01]" : "bg-[#f8f8f9] border-black/12 text-black placeholder-neutral-400 focus:border-[#FC4C01]";
	const mutedText = isDark ? "text-neutral-400" : "text-neutral-500";
	const persistUpdate = (patch, alertMessage) => {
		const next = {
			...personalization,
			...patch
		};
		setPersonalization(next);
		UserAccountStore.savePersonalization(next);
		UserAccountStore.syncProfileAndSettingsWithBackend({ preferences: {
			selectedModelId: next.defaultModelId,
			defaultVisionModelId: next.defaultVisionModelId,
			temperature: next.temperature,
			reasoningEffort: next.reasoningEffort,
			responseStyle: next.responseStyle,
			responseLength: next.responseLength,
			maskProviderIdentity: next.maskProviderIdentity !== false,
			webSearchDefault
		} }).catch(() => {});
		if (alertMessage) onSaved?.(alertMessage);
	};
	const temperatureVal = typeof personalization.temperature === "number" ? personalization.temperature : DEFAULT_MODEL_TEMPERATURE;
	const reasoningEffortVal = personalization.reasoningEffort || "medium";
	const maskIdentityVal = personalization.maskProviderIdentity !== false;
	const handleSelectDefaultChatModel = (model) => {
		const reqTier = getModelRequiredTier(model);
		if (!UserAccountStore.canUseModel(reqTier)) {
			if (onOpenPricing) onOpenPricing(reqTier === "fire" ? "fire" : "spark", `${model.name} requires the ${reqTier === "fire" ? "Fire" : "Spark"} plan.`);
			else window.dispatchEvent(new CustomEvent("kinich-navigate-route", { detail: { path: "/pricing" } }));
			return;
		}
		onSelectModel(model);
		persistUpdate({ defaultModelId: model.id }, `Default chat model set to ${model.name}`);
	};
	const handleSelectDefaultVisionModel = (modelId) => {
		const found = visionModels.find((m) => m.id === modelId);
		if (!found) return;
		const reqTier = getModelRequiredTier(found);
		if (!UserAccountStore.canUseModel(reqTier)) {
			onOpenPricing?.(reqTier === "fire" ? "fire" : "spark", `${found.name} requires the ${reqTier === "fire" ? "Fire" : "Spark"} plan.`);
			return;
		}
		persistUpdate({ defaultVisionModelId: found.id }, `Default vision model set to ${found.name}`);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xl sm:text-2xl font-bold tracking-tight",
					children: "Model Settings"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: `text-xs sm:text-sm mt-1 ${mutedText}`,
					children: "Configure default models, reasoning depth, temperature, and your default system prompt."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `text-xs font-mono tabular-nums ${mutedText}`,
					children: [
						"Plan: ",
						currentPlan.toUpperCase(),
						" · Active: ",
						selectedModel.name
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-5 rounded-2xl border space-y-5 ${cardClass}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersVertical, { className: "w-4 h-4 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
								children: "Inference & Behavior"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => persistUpdate({
								temperature: DEFAULT_MODEL_TEMPERATURE,
								reasoningEffort: DEFAULT_REASONING_EFFORT,
								responseLength: "balanced",
								responseStyle: "technical"
							}, "Inference parameters reset to balanced defaults"),
							className: `inline-flex items-center gap-1 text-xs font-medium hover:text-[#FC4C01] transition-colors cursor-pointer ${mutedText}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reset tuning" })]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-semibold",
									children: "Temperature (Creativity vs. Precision)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `text-[11px] ${mutedText}`,
									children: "Lower values favor deterministic code & facts; higher values enrich creative prose."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono font-semibold text-sm tabular-nums text-[#FC4C01]",
									children: temperatureVal.toFixed(2)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: 0,
								max: 1.2,
								step: .05,
								value: temperatureVal,
								"aria-label": "Model Temperature",
								onChange: (e) => persistUpdate({ temperature: parseFloat(e.target.value) }),
								className: "w-full accent-[#FC4C01] cursor-pointer"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center justify-between gap-2",
								children: [
									{
										label: "Exact · 0.2",
										value: .2
									},
									{
										label: "Balanced · 0.5",
										value: .5
									},
									{
										label: "Expressive · 0.8",
										value: .8
									},
									{
										label: "Unfiltered · 1.0",
										value: 1
									}
								].map((preset) => {
									const active = Math.abs(temperatureVal - preset.value) < .04;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => persistUpdate({ temperature: preset.value }, `Temperature set to ${preset.value.toFixed(2)}`),
										className: `flex-1 py-1.5 px-2 rounded-lg border text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${active ? isDark ? "bg-white text-black border-white font-semibold" : "bg-black text-white border-black font-semibold" : isDark ? "border-white/10 text-neutral-400 hover:text-white" : "border-black/10 text-neutral-600 hover:text-black"}`,
										children: preset.label
									}, preset.label);
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-500/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold",
								children: "Reasoning Depth"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `grid grid-cols-3 p-1 rounded-xl border ${isDark ? "bg-[#09090b] border-white/10" : "bg-neutral-100 border-black/10"}`,
								children: [
									{
										id: "low",
										label: "Fast"
									},
									{
										id: "medium",
										label: "Balanced"
									},
									{
										id: "high",
										label: "Deep"
									}
								].map((opt) => {
									const active = reasoningEffortVal === opt.id;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => persistUpdate({ reasoningEffort: opt.id }, `Reasoning depth set to ${opt.label}`),
										className: `py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${active ? isDark ? "bg-white text-black font-semibold" : "bg-black text-white font-semibold" : mutedText}`,
										children: opt.label
									}, opt.id);
								})
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold",
								children: "Response Length"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `grid grid-cols-3 p-1 rounded-xl border ${isDark ? "bg-[#09090b] border-white/10" : "bg-neutral-100 border-black/10"}`,
								children: [
									{
										id: "concise",
										label: "Concise"
									},
									{
										id: "balanced",
										label: "Balanced"
									},
									{
										id: "detailed",
										label: "Detailed"
									}
								].map((opt) => {
									const active = personalization.responseLength === opt.id;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => persistUpdate({ responseLength: opt.id }, `Response length set to ${opt.label}`),
										className: `py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${active ? isDark ? "bg-white text-black font-semibold" : "bg-black text-white font-semibold" : mutedText}`,
										children: opt.label
									}, opt.id);
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2 pt-2 border-t border-neutral-500/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-semibold",
							children: "Response Tone"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-2 sm:grid-cols-4 gap-2",
							children: [
								{
									id: "technical",
									label: "Technical"
								},
								{
									id: "professional",
									label: "Professional"
								},
								{
									id: "casual",
									label: "Conversational"
								},
								{
									id: "creative",
									label: "Creative"
								}
							].map((opt) => {
								const active = personalization.responseStyle === opt.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => persistUpdate({ responseStyle: opt.id }, `Response tone set to ${opt.label}`),
									className: `py-2 px-3 rounded-xl border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${active ? "border-[#FC4C01] bg-[#FC4C01]/10 text-[#FC4C01] font-semibold" : isDark ? "border-white/10 text-neutral-300 hover:border-white/25" : "border-black/10 text-neutral-700 hover:border-black/25"}`,
									children: opt.label
								}, opt.id);
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3 pt-2 border-t border-neutral-500/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs font-semibold flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-3.5 h-3.5 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Strict Kinich Identity Lock" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `text-[11px] mt-0.5 ${mutedText}`,
								children: "Prevents upstream model gateways from leaking third-party vendor names (e.g. Sapiens AI, Mistral, DeepSeek)."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								role: "switch",
								"aria-checked": maskIdentityVal,
								"aria-label": "Strict Kinich Identity Lock",
								onClick: () => persistUpdate({ maskProviderIdentity: !maskIdentityVal }, !maskIdentityVal ? "Kinich identity lock enabled" : "Kinich identity lock disabled"),
								className: `w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${maskIdentityVal ? isDark ? "bg-white" : "bg-black" : isDark ? "bg-neutral-700" : "bg-neutral-300"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${maskIdentityVal ? isDark ? "translate-x-5 bg-black" : "translate-x-5 bg-white" : "bg-white"}` })
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs font-semibold",
								children: "Default Web Search Grounding"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `text-[11px] mt-0.5 ${mutedText}`,
								children: "Automatically ground regular chat turns with live citations and real-time sources."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								role: "switch",
								"aria-checked": webSearchDefault,
								"aria-label": "Default Web Search Grounding",
								onClick: () => onToggleWebSearchDefault(!webSearchDefault),
								className: `w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${webSearchDefault ? isDark ? "bg-white" : "bg-black" : isDark ? "bg-neutral-700" : "bg-neutral-300"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${webSearchDefault ? isDark ? "translate-x-5 bg-black" : "translate-x-5 bg-white" : "bg-white"}` })
							})]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-5 rounded-2xl border flex flex-col justify-between gap-3 ${cardClass}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
							children: "System Prompt"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `text-[11px] mt-0.5 ${mutedText}`,
							children: "Applies across reasoning, coding, search, vision, and study models."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setRegularPromptDraft(DEFAULT_REGULAR_MODEL_PROMPT);
								persistUpdate({ regularSystemPrompt: "" }, "System prompt reset to Kinich default");
							},
							className: `inline-flex items-center gap-1 text-[11px] font-medium hover:text-[#FC4C01] cursor-pointer ${mutedText}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Default" })]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						rows: 5,
						value: regularPromptDraft,
						onChange: (e) => setRegularPromptDraft(e.target.value),
						"aria-label": "System Prompt",
						className: `w-full p-3 rounded-xl border text-xs leading-relaxed outline-none resize-y ${inputClass}`
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between pt-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: `text-[11px] font-mono tabular-nums ${mutedText}`,
						children: [regularPromptDraft.length, " chars"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => persistUpdate({ regularSystemPrompt: regularPromptDraft.trim() === "You are Kinich, a sharp, natural, and reliable AI assistant. Always identify strictly as Kinich—never disclose, claim, or attribute yourself to any upstream provider, company, or model name (including Sapiens AI, Mistral, DeepSeek, Qwen, OpenAI, Anthropic, Google, xAI, Meta, or Crow). If asked who you are or who made you, state plainly that you are Kinich." ? "" : regularPromptDraft.trim() }, "System prompt saved"),
						className: `px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Save Prompt" })]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `p-5 rounded-2xl border space-y-4 ${cardClass}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "w-4 h-4 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
							children: "Default Vision Routing Model"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `text-[11px] ${mutedText}`,
							children: "Used automatically when you attach screenshots or diagrams while a text-only model is active."
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						value: personalization.defaultVisionModelId || "zro-glm-5.3-flash",
						onChange: (e) => handleSelectDefaultVisionModel(e.target.value),
						"aria-label": "Default Vision Model",
						className: `px-3 py-2 rounded-xl border text-xs font-medium outline-none cursor-pointer ${inputClass}`,
						children: visionModels.map((vm) => {
							const tier = getModelRequiredTier(vm);
							const unlocked = UserAccountStore.canUseModel(tier);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: vm.id,
								children: [
									vm.name,
									" (",
									vm.contextLength || "1M",
									" · ",
									tier.toUpperCase(),
									")",
									!unlocked ? " — Upgrade required" : ""
								]
							}, vm.id);
						})
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-5 rounded-2xl border space-y-4 ${cardClass}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "w-4 h-4 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
								children: "Model Catalog & Active Default"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `text-[11px] ${mutedText}`,
								children: "Pick the active model for new chats. Locked models show their required plan tier."
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative w-full sm:w-56",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: modelSearch,
								onChange: (e) => setModelSearch(e.target.value),
								placeholder: "Filter models...",
								className: `w-full pl-8 pr-3 py-1.5 rounded-xl border text-xs outline-none ${inputClass}`
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1",
						children: [
							{
								id: "all",
								label: "All Models"
							},
							{
								id: "free",
								label: "Free Tier"
							},
							{
								id: "spark",
								label: "Spark ($3)"
							},
							{
								id: "fire",
								label: "Fire ($9)"
							}
						].map((tab) => {
							const active = tierFilter === tab.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setTierFilter(tab.id),
								className: `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${active ? isDark ? "bg-white text-black font-semibold" : "bg-black text-white font-semibold" : isDark ? "bg-white/5 text-neutral-400 hover:text-white" : "bg-black/5 text-neutral-600 hover:text-black"}`,
								children: tab.label
							}, tab.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `rounded-xl border divide-y max-h-[340px] overflow-y-auto slim-scrollbar ${isDark ? "border-white/10 divide-white/[0.06]" : "border-black/10 divide-black/[0.06]"}`,
						children: filteredModels.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-6 text-center text-xs ${mutedText}`,
							children: [
								"No models match \"",
								modelSearch,
								"\"."
							]
						}) : filteredModels.slice(0, 40).map((m) => {
							const tier = getModelRequiredTier(m);
							const unlocked = UserAccountStore.canUseModel(tier);
							const isSelected = selectedModel.id === m.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => handleSelectDefaultChatModel(m),
								className: `w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${isSelected ? isDark ? "bg-white/[0.08]" : "bg-black/[0.05]" : isDark ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.03]"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-semibold truncate",
										children: m.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `text-[11px] truncate ${mutedText}`,
										children: m.description
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3 shrink-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: `text-[11px] font-mono tabular-nums ${mutedText}`,
										children: [
											m.contextLength || "128K",
											" · ",
											m.supportsVision ? "Vision · " : "",
											tier === "free" ? "Free" : tier === "spark" ? "Spark" : "Fire"
										]
									}), isSelected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 text-[#FC4C01]" }) : !unlocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-3.5 h-3.5 text-neutral-500" }) : null]
								})]
							}, m.id);
						})
					})
				]
			})
		]
	});
};
//#endregion
//#region src/components/DeleteAccountButton.tsx
var DeleteAccountButton = ({ isDark = true, onDeleted }) => {
	const [showConfirm, setShowConfirm] = (0, import_react.useState)(false);
	const [confirmText, setConfirmText] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const handleDelete = async () => {
		if (confirmText.trim() !== "DELETE") {
			setError("Please type DELETE in uppercase to confirm permanent account deletion.");
			return;
		}
		try {
			setLoading(true);
			setError(null);
			const currentUid = auth.currentUser?.uid;
			try {
				const headers = await getAuthHeaders();
				await fetch("/api/account/delete", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...headers
					},
					body: JSON.stringify({
						confirmation: "DELETE",
						uid: currentUid
					})
				});
			} catch {}
			await UserAccountStore.deleteAccount();
			setShowConfirm(false);
			setConfirmText("");
			if (onDeleted) onDeleted();
		} catch (err) {
			console.error("Delete account failed:", err);
			setError(err?.message || "Failed to delete account. Please re-authenticate and try again.");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `p-5 rounded-2xl border ${isDark ? "bg-red-950/10 border-red-500/20" : "bg-red-50 border-red-200"} space-y-3`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm font-bold text-red-500",
				children: "Delete My Account (DPDP & GDPR Right to Erasure)"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-neutral-400 mt-0.5",
				children: "Permanently delete your account, chat history, study sets, and associated personal data (completed immediately and purged from backups within 30 days)."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => {
					setConfirmText("");
					setError(null);
					setShowConfirm(true);
				},
				className: "px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-all shrink-0",
				children: "Delete My Account"
			})]
		}), error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-xs text-red-400 font-medium",
			children: error
		})]
	}), showConfirm && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `w-full max-w-md p-6 rounded-2xl border space-y-4 shadow-2xl ${isDark ? "bg-neutral-900 border-white/10 text-white" : "bg-white border-black/10 text-neutral-900"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-lg font-bold text-red-500",
					children: "Confirm Permanent Account Deletion"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs sm:text-sm text-neutral-400 leading-relaxed",
					children: "This action is irreversible. Your profile, chat history, YouTube/PDF study sets, and referral records will be deleted immediately and fully purged within 30 days."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-xs font-semibold",
						children: [
							"Type ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
								className: "px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-mono",
								children: "DELETE"
							}),
							" to confirm:"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "text",
						value: confirmText,
						onChange: (e) => setConfirmText(e.target.value),
						placeholder: "Type DELETE",
						className: `w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none ${isDark ? "bg-black/40 border-white/15 text-white focus:border-red-500" : "bg-neutral-50 border-black/15 text-black focus:border-red-500"}`
					})]
				}),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-red-400 font-medium",
					children: error
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-end gap-3 pt-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setShowConfirm(false),
						disabled: loading,
						className: `px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${isDark ? "border-white/10 hover:bg-white/10" : "border-black/10 hover:bg-black/5"}`,
						children: "Cancel"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: handleDelete,
						disabled: loading || confirmText.trim() !== "DELETE",
						className: "px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed",
						children: loading ? "Deleting..." : "Delete My Account"
					})]
				})
			]
		})
	})] });
};
//#endregion
//#region src/components/AccountWorkspacePage.tsx
var PricingModal = (0, import_react.lazy)(() => __vitePreload(() => import("./PricingModal-LzRm7ROj.js").then((m) => ({ default: m.PricingModal })), __vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13])));
var BillingHistorySection = (0, import_react.lazy)(() => __vitePreload(() => import("./BillingHistorySection-BGPqg392.js").then((m) => ({ default: m.BillingHistorySection })), __vite__mapDeps([14,1,2,3,4,5,6,7,8,9,10,12])));
var CANCELLATION_SURVEY_REASONS = [
	{
		id: "too_expensive",
		label: "Too expensive / pricing doesn't fit my current budget"
	},
	{
		id: "not_using_enough",
		label: "Not using Kinich frequently enough to justify a monthly plan"
	},
	{
		id: "missing_features",
		label: "Missing specific features, integrations, or workflows I need"
	},
	{
		id: "found_alternative",
		label: "Switched to a different AI research or chat platform"
	},
	{
		id: "technical_issues",
		label: "Experienced technical, latency, or billing issues"
	},
	{
		id: "project_completed",
		label: "Completed my project / only needed temporary access"
	}
];
var CancelSubscriptionSection = ({ isDark, onSubscriptionUpdated }) => {
	const [currentPlan, setCurrentPlan] = (0, import_react.useState)(() => UserAccountStore.getNormalizedPlan());
	const [billingMe, setBillingMe] = (0, import_react.useState)(null);
	const [isCancelModalOpen, setIsCancelModalOpen] = (0, import_react.useState)(false);
	const [selectedSurveyReason, setSelectedSurveyReason] = (0, import_react.useState)(CANCELLATION_SURVEY_REASONS[0].id);
	const [surveyComments, setSurveyComments] = (0, import_react.useState)("");
	const [terminationMode, setTerminationMode] = (0, import_react.useState)("period_end");
	const [isSubmittingCancel, setIsSubmittingCancel] = (0, import_react.useState)(false);
	const [portalBusy, setPortalBusy] = (0, import_react.useState)(false);
	const [feedbackBanner, setFeedbackBanner] = (0, import_react.useState)(null);
	const loadSubscriptionState = async () => {
		if (UserAccountStore.isGuest()) {
			setCurrentPlan("free");
			return;
		}
		try {
			const headers = await getAuthHeaders();
			const res = await fetch("/api/billing/me", { headers });
			if (res.ok) {
				const data = await res.json();
				setBillingMe(data);
				if (data?.authenticated && (data.effectivePlan === "spark" || data.effectivePlan === "fire" || data.effectivePlan === "free") && (data.planStatus !== "none" || Array.isArray(data.refunds) && data.refunds.length > 0)) {
					if (UserAccountStore.getNormalizedPlan() !== data.effectivePlan) UserAccountStore.upgradePlan(data.effectivePlan, data.planInterval === "yearly" ? "yearly" : "monthly");
					setCurrentPlan(data.effectivePlan);
				} else setCurrentPlan(UserAccountStore.getNormalizedPlan());
			}
		} catch {
			setCurrentPlan(UserAccountStore.getNormalizedPlan());
		}
	};
	(0, import_react.useEffect)(() => {
		loadSubscriptionState();
		const syncLocal = () => setCurrentPlan(UserAccountStore.getNormalizedPlan());
		window.addEventListener("kinich-account-updated", syncLocal);
		return () => window.removeEventListener("kinich-account-updated", syncLocal);
	}, []);
	const handleConfirmCancelSubscription = async (e) => {
		e.preventDefault();
		setIsSubmittingCancel(true);
		setFeedbackBanner(null);
		const reasonObj = CANCELLATION_SURVEY_REASONS.find((r) => r.id === selectedSurveyReason);
		const fullReason = surveyComments.trim() ? `${reasonObj?.label || selectedSurveyReason} — ${surveyComments.trim()}` : reasonObj?.label || selectedSurveyReason;
		try {
			const isImmediate = terminationMode === "immediate";
			const result = await cancelUserSubscription({
				atPeriodEnd: !isImmediate,
				immediate: isImmediate,
				resume: false,
				reason: fullReason
			});
			if (result.success || isImmediate) {
				if (isImmediate) {
					UserAccountStore.upgradePlan("free", "monthly");
					setCurrentPlan("free");
				}
				setIsCancelModalOpen(false);
				setSurveyComments("");
				setFeedbackBanner({
					type: "success",
					text: result.message || (isImmediate ? "Your subscription has been terminated via Dodo Payments and your account state is now Free Tier." : "Your subscription cancellation is scheduled for the end of your current billing cycle.")
				});
				await loadSubscriptionState();
				onSubscriptionUpdated?.();
			} else setFeedbackBanner({
				type: "error",
				text: result.error || "Unable to terminate subscription. Please try again."
			});
		} catch (err) {
			setFeedbackBanner({
				type: "error",
				text: err?.message || "Network error while terminating subscription."
			});
		} finally {
			setIsSubmittingCancel(false);
		}
	};
	const handleRestoreSubscription = async () => {
		setIsSubmittingCancel(true);
		setFeedbackBanner(null);
		try {
			const result = await cancelUserSubscription({ resume: true });
			const restored = result.plan && result.plan !== "free" ? result.plan : "spark";
			UserAccountStore.upgradePlan(restored, "monthly");
			setCurrentPlan(restored);
			setFeedbackBanner({
				type: "success",
				text: result.message || `Your ${restored.toUpperCase()} subscription has been restored.`
			});
			await loadSubscriptionState();
			onSubscriptionUpdated?.();
		} finally {
			setIsSubmittingCancel(false);
		}
	};
	const handleOpenDodoPortal = async () => {
		setPortalBusy(true);
		setFeedbackBanner(null);
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
			setFeedbackBanner({
				type: "error",
				text: data?.error || "Dodo Customer Portal is available after your first live subscription checkout."
			});
		} catch {
			setFeedbackBanner({
				type: "error",
				text: "Could not open Dodo Customer Portal right now."
			});
		} finally {
			setPortalBusy(false);
		}
	};
	const effectivePlan = billingMe?.effectivePlan && billingMe.effectivePlan !== "free" ? billingMe.effectivePlan : currentPlan;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `p-5 sm:p-6 rounded-2xl border space-y-4 transition-all ${isDark ? "bg-white/[0.02] border-white/10 text-white" : "bg-white border-black/15 text-[#18181b] shadow-xs"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "w-4 h-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-sm sm:text-base font-bold tracking-tight",
						children: "Cancel Subscription & Plan Termination"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
						children: "Terminate your active Dodo Payments subscription at period end or immediately, or manage via the Dodo Portal."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						effectivePlan === "free" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: handleRestoreSubscription,
							disabled: isSubmittingCancel,
							className: "px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold cursor-pointer transition-colors",
							children: isSubmittingCancel ? "Restoring..." : "Restore Spark Subscription"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: handleOpenDodoPortal,
							disabled: portalBusy,
							className: `px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 border-white/15 text-neutral-200" : "bg-neutral-100 hover:bg-neutral-200 border-black/15 text-neutral-800"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: portalBusy ? "Opening Portal..." : "Dodo Billing Portal" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								setFeedbackBanner(null);
								setIsCancelModalOpen(true);
							},
							className: "px-4 py-2 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Cancel Subscription" })]
						})
					]
				})]
			}),
			feedbackBanner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${feedbackBanner.type === "success" ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-red-500/35 bg-red-500/10 text-red-300"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [feedbackBanner.type === "success" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-4 h-4 text-emerald-400 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-4 h-4 text-red-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: feedbackBanner.text })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setFeedbackBanner(null),
					className: "text-[11px] font-semibold opacity-75 hover:opacity-100 cursor-pointer",
					children: "Dismiss"
				})]
			}),
			isCancelModalOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "dialog",
				"aria-modal": "true",
				"aria-labelledby": "cancel-subscription-modal-title",
				className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `w-full max-w-lg rounded-2xl border p-6 space-y-5 shadow-2xl ${isDark ? "bg-[#121216] border-white/15 text-white" : "bg-white border-black/15 text-[#18181b]"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-4 h-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								id: "cancel-subscription-modal-title",
								className: "text-base font-bold",
								children: "Confirm Subscription Cancellation"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: `text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
								children: ["Current Active Plan: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: effectivePlan.toUpperCase() })]
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setIsCancelModalOpen(false),
							className: "p-1.5 rounded-lg opacity-60 hover:opacity-100 cursor-pointer",
							"aria-label": "Close modal",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: handleConfirmCancelSubscription,
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold uppercase tracking-wider opacity-80",
									children: "Reason for Cancellation Survey"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-1.5 max-h-48 overflow-y-auto pr-1",
									children: CANCELLATION_SURVEY_REASONS.map((reason) => {
										const checked = selectedSurveyReason === reason.id;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: `flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${checked ? "border-[#FC4C01] bg-[#FC4C01]/10 font-semibold" : isDark ? "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]" : "border-black/10 bg-neutral-50 hover:bg-neutral-100"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "radio",
												name: "cancellation_survey_reason",
												value: reason.id,
												checked,
												onChange: () => setSelectedSurveyReason(reason.id),
												className: "accent-[#FC4C01]"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: reason.label })]
										}, reason.id);
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-semibold mb-1 opacity-80",
								children: "Additional Feedback (Optional)"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								rows: 2,
								value: surveyComments,
								onChange: (e) => setSurveyComments(e.target.value),
								placeholder: "Tell us how we can improve Kinich...",
								className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-black/40 border-white/15 text-white placeholder:text-neutral-500" : "bg-neutral-50 border-black/15 text-black placeholder:text-neutral-400"}`
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2 pt-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-bold uppercase tracking-wider opacity-80",
									children: "When should cancellation take effect?"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-1 sm:grid-cols-2 gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setTerminationMode("period_end"),
										className: `p-3 rounded-xl border text-left text-xs cursor-pointer transition-all ${terminationMode === "period_end" ? "border-[#FC4C01] bg-[#FC4C01]/10" : isDark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-neutral-50"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "font-bold",
											children: "At End of Billing Period"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[11px] opacity-70 mt-0.5",
											children: [
												"Keep ",
												effectivePlan.toUpperCase(),
												" features until your current cycle ends."
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setTerminationMode("immediate"),
										className: `p-3 rounded-xl border text-left text-xs cursor-pointer transition-all ${terminationMode === "immediate" ? "border-red-500 bg-red-500/10" : isDark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-neutral-50"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "font-bold text-red-400",
											children: "Terminate Immediately"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] opacity-70 mt-0.5",
											children: "End subscription right now and switch to Free Tier."
										})]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-end gap-2 pt-3 border-t border-neutral-500/15",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setIsCancelModalOpen(false),
									className: `px-4 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${isDark ? "border-white/15 text-neutral-300" : "border-black/15 text-neutral-700"}`,
									children: "Keep My Subscription"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									disabled: isSubmittingCancel,
									className: "px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50",
									children: isSubmittingCancel ? "Terminating via Dodo API..." : "Confirm & Terminate Subscription"
								})]
							})
						]
					})]
				})
			})
		]
	});
};
var RefundPolicySection = ({ isDark, onRefundProcessed }) => {
	const [billingMe, setBillingMe] = (0, import_react.useState)(null);
	const [currentPlan, setCurrentPlan] = (0, import_react.useState)(() => UserAccountStore.getNormalizedPlan());
	const [refundReason, setRefundReason] = (0, import_react.useState)("7-Day Money-Back Guarantee — Customer requested full refund");
	const [selectedPaymentId, setSelectedPaymentId] = (0, import_react.useState)("");
	const [refundBusy, setRefundBusy] = (0, import_react.useState)(false);
	const [refundBanner, setRefundBanner] = (0, import_react.useState)(null);
	const loadRefundEligibility = async () => {
		if (UserAccountStore.isGuest()) {
			setCurrentPlan("free");
			return;
		}
		try {
			const headers = await getAuthHeaders();
			const res = await fetch("/api/billing/me", { headers });
			if (res.ok) {
				const data = await res.json();
				setBillingMe(data);
				if (data?.authenticated && (data.effectivePlan === "spark" || data.effectivePlan === "fire" || data.effectivePlan === "free") && (data.planStatus !== "none" || Array.isArray(data.refunds) && data.refunds.length > 0)) {
					if (UserAccountStore.getNormalizedPlan() !== data.effectivePlan) UserAccountStore.upgradePlan(data.effectivePlan, data.planInterval === "yearly" ? "yearly" : "monthly");
					setCurrentPlan(data.effectivePlan);
				}
				const defaultPay = data?.latestRefundablePayment?.dodo_payment_id || data?.payments?.find((p) => p.status !== "refunded")?.dodo_payment_id || "";
				if (defaultPay) setSelectedPaymentId(defaultPay);
			}
		} catch {}
		setCurrentPlan(UserAccountStore.getNormalizedPlan());
	};
	(0, import_react.useEffect)(() => {
		loadRefundEligibility();
		const syncLocal = () => setCurrentPlan(UserAccountStore.getNormalizedPlan());
		window.addEventListener("kinich-account-updated", syncLocal);
		return () => window.removeEventListener("kinich-account-updated", syncLocal);
	}, []);
	const handleTriggerRefundRequest = async () => {
		setRefundBusy(true);
		setRefundBanner(null);
		try {
			const res = await requestSubscriptionRefund({
				paymentId: selectedPaymentId || void 0,
				reason: refundReason,
				cancelSubscription: true
			});
			if (res.success) {
				UserAccountStore.upgradePlan("free", "monthly");
				setCurrentPlan("free");
				setRefundBanner({
					type: "success",
					text: res.message || `Refund processed (${res.refund?.refund_id || "confirmed"}) via Dodo Payments API! Funds are being returned to your original payment method.`
				});
				await loadRefundEligibility();
				onRefundProcessed?.();
			} else setRefundBanner({
				type: "error",
				text: res.error || "Could not process refund request."
			});
		} catch (err) {
			setRefundBanner({
				type: "error",
				text: err?.message || "Network error while calling Dodo Payments Refund API."
			});
		} finally {
			setRefundBusy(false);
		}
	};
	const latestRefunded = Array.isArray(billingMe?.refunds) && billingMe.refunds.length > 0 ? billingMe.refunds[0] : null;
	const refundablePayments = Array.isArray(billingMe?.payments) ? billingMe.payments.filter((p) => p.status !== "refunded") : [];
	const isEligible = Boolean(billingMe?.refundEligible !== false || refundablePayments.length > 0 || currentPlan !== "free");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `p-5 sm:p-6 rounded-2xl border space-y-4 transition-all ${isDark ? "bg-white/[0.02] border-white/10 text-white" : "bg-white border-black/15 text-[#18181b] shadow-xs"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/35 flex items-center justify-center text-[#FC4C01]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-4 h-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 flex-wrap",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm sm:text-base font-bold tracking-tight",
							children: "Refund Policy & 7-Day Money-Back Guarantee"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${latestRefunded && refundablePayments.length === 0 && currentPlan === "free" ? "bg-sky-500/15 text-sky-400 border border-sky-500/30" : isEligible ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-neutral-500/15 text-neutral-400 border border-neutral-500/30"}`,
							children: latestRefunded && refundablePayments.length === 0 && currentPlan === "free" ? `Refund Processed (${latestRefunded.dodo_refund_id})` : "Eligible for 7-Day Full Refund"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-xs mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
						children: "Transparent refund eligibility and one-click Dodo Payments API refund processing."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: handleTriggerRefundRequest,
					disabled: refundBusy,
					className: "px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs disabled:opacity-50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: `w-3.5 h-3.5 ${refundBusy ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: refundBusy ? "Processing Refund..." : "Request Refund" })]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-3.5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs ${isDark ? "bg-black/40 border-white/10" : "bg-neutral-50 border-black/10"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1",
					children: "Subscription Charge / Invoice"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
					value: selectedPaymentId,
					onChange: (e) => setSelectedPaymentId(e.target.value),
					className: `w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${isDark ? "bg-[#18181b] border-white/15 text-white" : "bg-white border-black/15 text-black"}`,
					children: refundablePayments.length > 0 ? refundablePayments.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
						value: p.dodo_payment_id,
						children: [
							p.dodo_payment_id,
							" — ",
							((Number(p.amount) || 0) / 100).toFixed(2),
							" ",
							p.currency || "USD"
						]
					}, p.dodo_payment_id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
						value: "",
						children: [
							"Most Recent Subscription Charge (",
							currentPlan.toUpperCase(),
							")"
						]
					})
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					className: "block text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1",
					children: "Refund Reason"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: refundReason,
					onChange: (e) => setRefundReason(e.target.value),
					className: `w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${isDark ? "bg-[#18181b] border-white/15 text-white" : "bg-white border-black/15 text-black"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "7-Day Money-Back Guarantee — Customer requested full refund",
							children: "7-Day Money-Back Guarantee (Full Refund)"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "Cancelled subscription and requesting money back",
							children: "Cancelled subscription and requesting money back"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "Accidental purchase or wrong billing interval",
							children: "Accidental purchase or wrong billing interval"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "Duplicate subscription charge",
							children: "Duplicate subscription charge"
						})
					]
				})] })]
			}),
			refundBanner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${refundBanner.type === "success" ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-red-500/35 bg-red-500/10 text-red-300"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [refundBanner.type === "success" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-4 h-4 text-emerald-400 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-4 h-4 text-red-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: refundBanner.text })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setRefundBanner(null),
					className: "text-[11px] font-semibold opacity-75 hover:opacity-100 cursor-pointer",
					children: "Dismiss"
				})]
			})
		]
	});
};
var ReferralsAndRewardsSection = ({ isDark }) => {
	const [dashboardData, setDashboardData] = (0, import_react.useState)(null);
	const [referralStatus, setReferralStatus] = (0, import_react.useState)(null);
	const [eightRefState, setEightRefState] = (0, import_react.useState)(() => getEightReferralTrackerState());
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [copiedLink, setCopiedLink] = (0, import_react.useState)(false);
	const [claimNotice, setClaimNotice] = (0, import_react.useState)(null);
	const loadReferralsAndRewards = async () => {
		setLoading(true);
		try {
			const [dash, status] = await Promise.all([fetchUserReferralDashboard().catch(() => null), fetchMyReferralStatus().catch(() => null)]);
			if (dash) setDashboardData(dash);
			if (status) setReferralStatus(status);
			setEightRefState(getEightReferralTrackerState());
		} finally {
			setLoading(false);
		}
	};
	(0, import_react.useEffect)(() => {
		loadReferralsAndRewards();
		const handleSync = () => {
			setEightRefState(getEightReferralTrackerState());
			loadReferralsAndRewards();
		};
		window.addEventListener("kinich-growth-updated", handleSync);
		window.addEventListener("kinich-account-updated", handleSync);
		return () => {
			window.removeEventListener("kinich-growth-updated", handleSync);
			window.removeEventListener("kinich-account-updated", handleSync);
		};
	}, []);
	const referralList = Array.isArray(dashboardData?.referrals) ? dashboardData.referrals : [];
	const serverRewards = Array.isArray(dashboardData?.rewards) ? dashboardData.rewards : [];
	const successfulReferralsCount = Math.max(Number(dashboardData?.stats?.qualified ?? 0), Number(referralStatus?.qualifiedActionsCount ?? 0), Number(referralStatus?.validatedSignupsCount ?? 0), eightRefState.count, referralList.filter((r) => r.status === "qualified" || r.status === "rewarded").length);
	const totalInvitedCount = Math.max(Number(dashboardData?.stats?.invited ?? 0), successfulReferralsCount, referralList.length);
	const pendingReferralsCount = Math.max(0, totalInvitedCount - successfulReferralsCount, referralList.filter((r) => r.status !== "qualified" && r.status !== "rewarded").length);
	const pendingMilestoneTiers = REFERRAL_8_REWARD_TIERS.filter((tier) => !eightRefState.claimedTiers.includes(tier.targetReferrals));
	const readyToClaimCount = pendingMilestoneTiers.filter((tier) => successfulReferralsCount >= tier.targetReferrals).length;
	const inviteUrl = dashboardData?.link || referralStatus?.referralUrl || eightRefState.inviteUrl;
	const referralCode = dashboardData?.code || referralStatus?.referralCode || eightRefState.code;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-testid": "account-referrals-rewards-section",
		className: `p-5 sm:p-6 rounded-2xl border space-y-5 transition-all ${isDark ? "bg-white/[0.02] border-white/10 text-white" : "bg-white border-black/15 text-[#18181b] shadow-xs"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/35 flex items-center justify-center text-[#FC4C01]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gift, { className: "w-4 h-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 flex-wrap",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm sm:text-base font-bold tracking-tight",
							children: "Successful Referrals & Pending Rewards"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30",
							children: ["Code: ", referralCode]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `text-xs mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
						children: "View your referred signups, qualification status, and pending milestone rewards."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							navigator.clipboard.writeText(inviteUrl).catch(() => {});
							setCopiedLink(true);
							setTimeout(() => setCopiedLink(false), 2e3);
						},
						className: "px-3.5 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors",
						children: [copiedLink ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gift, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: copiedLink ? "Copied Invite Link" : "Copy Invite Link" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void loadReferralsAndRewards(),
						disabled: loading,
						className: `p-2 rounded-xl border transition-colors cursor-pointer ${isDark ? "border-white/15 hover:bg-white/10 text-neutral-300" : "border-black/15 hover:bg-neutral-100 text-neutral-700"}`,
						title: "Refresh referrals & rewards",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 ${loading ? "animate-spin" : ""}` })
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 sm:grid-cols-3 gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `p-3.5 rounded-xl border ${isDark ? "bg-black/40 border-white/10" : "bg-neutral-50 border-black/10"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[11px] font-medium text-neutral-400",
								children: "Successful Referrals"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-lg font-bold font-mono text-emerald-400 mt-0.5",
								children: successfulReferralsCount
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] text-neutral-500 mt-0.5",
								children: "Verified & qualified signups"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `p-3.5 rounded-xl border ${isDark ? "bg-black/40 border-white/10" : "bg-neutral-50 border-black/10"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[11px] font-medium text-neutral-400",
								children: "Pending Referrals"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-lg font-bold font-mono text-amber-400 mt-0.5",
								children: pendingReferralsCount
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[10px] text-neutral-500 mt-0.5",
								children: "Awaiting first core action"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `p-3.5 rounded-xl border ${isDark ? "bg-black/40 border-white/10" : "bg-neutral-50 border-black/10"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[11px] font-medium text-neutral-400",
								children: "Pending Rewards"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-lg font-bold font-mono text-[#FC4C01] mt-0.5",
								children: [pendingMilestoneTiers.length, readyToClaimCount > 0 ? ` (${readyToClaimCount} Claimable)` : ""]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[10px] text-neutral-500 mt-0.5",
								children: [
									eightRefState.claimedTiers.length,
									" of ",
									REFERRAL_8_REWARD_TIERS.length,
									" tiers claimed"
								]
							})
						]
					})
				]
			}),
			claimNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-3 rounded-xl border border-[#FC4C01]/40 bg-[#FC4C01]/10 text-xs font-medium flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: claimNotice }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setClaimNotice(null),
					className: "text-[11px] opacity-75 hover:opacity-100 cursor-pointer",
					children: "Dismiss"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-2 gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `p-4 rounded-xl border space-y-3 ${isDark ? "bg-black/30 border-white/10" : "bg-neutral-50/70 border-black/10"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
							className: "text-xs font-bold uppercase tracking-wider opacity-80",
							children: [
								"Referral Signups (",
								referralList.length || successfulReferralsCount,
								")"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] text-neutral-400",
							children: [successfulReferralsCount, " qualified"]
						})]
					}), referralList.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2 max-h-60 overflow-y-auto slim-scrollbar pr-1",
						children: referralList.map((ref) => {
							const isQualified = ref.status === "qualified" || ref.status === "rewarded" || Boolean(ref.qualifiedAt);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-mono font-semibold truncate",
										children: ["User ", ref.referredUserId ? ref.referredUserId.slice(0, 12) : ref.id.slice(0, 10)]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11px] text-neutral-400 mt-0.5",
										children: [
											"Joined",
											" ",
											ref.createdAt ? new Date(ref.createdAt).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
												year: "numeric"
											}) : "Recently"
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${isQualified ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border border-amber-500/30"}`,
									children: isQualified ? "Successful" : "Pending"
								})]
							}, ref.id);
						})
					}) : successfulReferralsCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-2",
						children: Array.from({ length: Math.min(successfulReferralsCount, 8) }).map((_, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "font-semibold",
								children: ["Referred Friend #", idx + 1]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[11px] text-neutral-400",
								children: ["Verified invite via code ", referralCode]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
								children: "Successful"
							})]
						}, idx))
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `p-5 rounded-xl border text-center space-y-1.5 ${isDark ? "bg-white/[0.01] border-white/5" : "bg-white border-black/5"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs font-semibold",
							children: "No referrals recorded yet"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-neutral-400",
							children: "Share your invite link above to earn bonus prompts, uploads, and study sessions."
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `p-4 rounded-xl border space-y-3 ${isDark ? "bg-black/30 border-white/10" : "bg-neutral-50/70 border-black/10"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "text-xs font-bold uppercase tracking-wider opacity-80",
							children: "Pending & Claimed Rewards"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] text-neutral-400",
							children: [pendingMilestoneTiers.length, " pending"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-2",
						children: [REFERRAL_8_REWARD_TIERS.map((tier) => {
							const isClaimed = eightRefState.claimedTiers.includes(tier.targetReferrals);
							const isUnlocked = successfulReferralsCount >= tier.targetReferrals;
							const remaining = Math.max(0, tier.targetReferrals - successfulReferralsCount);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${isUnlocked && !isClaimed ? "border-[#FC4C01]/50 bg-[#FC4C01]/[0.06]" : isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-0.5 min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-bold",
											children: [
												tier.targetReferrals,
												" ",
												tier.targetReferrals === 1 ? "Referral" : "Referrals"
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `px-2 py-0.5 rounded-full text-[10px] font-semibold ${isClaimed ? "bg-emerald-500/15 text-emerald-400" : isUnlocked ? "bg-[#FC4C01]/20 text-[#FC4C01]" : "bg-amber-500/15 text-amber-400"}`,
											children: isClaimed ? "Claimed" : isUnlocked ? "Pending Claim" : `Pending (${remaining} more)`
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11px] text-neutral-400 truncate",
										children: [
											"+",
											tier.bonusMessages,
											" Prompts · +",
											tier.bonusUploads,
											" Uploads · +",
											tier.bonusQuizzes,
											" Quizzes"
										]
									})]
								}), isClaimed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-semibold text-emerald-400 shrink-0",
									children: "Claimed ✓"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										const res = claimEightReferralTier(tier.targetReferrals);
										setEightRefState(res.state);
										setClaimNotice(res.message);
										setTimeout(() => setClaimNotice(null), 4e3);
									},
									className: `px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${isUnlocked ? "bg-[#FC4C01] hover:bg-[#e04300] text-white" : isDark ? "border border-white/15 bg-white/5 hover:bg-white/10 text-neutral-300" : "border border-black/15 bg-neutral-100 hover:bg-neutral-200 text-neutral-700"}`,
									children: "Claim"
								})]
							}, tier.targetReferrals);
						}), serverRewards.map((rw) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-bold truncate",
									children: rw.reason || "Referral Bonus Credit"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[11px] text-neutral-400",
									children: [
										"+",
										rw.days || 7,
										" days bonus access"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0",
								children: "Credited"
							})]
						}, rw.id))]
					})]
				})]
			})
		]
	});
};
var AccountWorkspacePage = ({ onBackToChat, initialTab = "profile", threads, theme, onThemeChange, selectedModel, onSelectModel, webSearchDefault, onToggleWebSearchDefault, nsfwMode = false, onToggleNsfwMode, onClearAllHistory, onSelectThread, onDeleteThread, bgGradientMode = "dynamic-model", onSelectBgGradientMode, onOpenPricing }) => {
	const [activeTab, setActiveTab] = (0, import_react.useState)(initialTab);
	const [profile, setProfile] = (0, import_react.useState)(() => UserAccountStore.getProfile());
	const [streak, setStreak] = (0, import_react.useState)(() => UserAccountStore.getDailyStreak(threads));
	const [badges, setBadges] = (0, import_react.useState)(() => UserAccountStore.getEvaluatedBadges(threads));
	const [backendSyncedAt, setBackendSyncedAt] = (0, import_react.useState)(null);
	const [syncingBackend, setSyncingBackend] = (0, import_react.useState)(false);
	const [savedSuccessAlert, setSavedSuccessAlert] = (0, import_react.useState)(null);
	const [confirmClearHistory, setConfirmClearHistory] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setActiveTab(initialTab);
	}, [initialTab]);
	(0, import_react.useEffect)(() => {
		const refreshFromStore = () => {
			setProfile(UserAccountStore.getProfile());
			setStreak(UserAccountStore.getDailyStreak(threads));
			setBadges(UserAccountStore.getEvaluatedBadges(threads));
		};
		window.addEventListener("kinich-account-updated", refreshFromStore);
		return () => window.removeEventListener("kinich-account-updated", refreshFromStore);
	}, [threads]);
	(0, import_react.useEffect)(() => {
		if (UserAccountStore.isGuest()) return;
		let cancelled = false;
		(async () => {
			try {
				const headers = await getAuthHeaders();
				const res = await fetch("/api/user/profile-backend", { headers });
				if (res.ok && !cancelled) {
					const data = await res.json();
					if (data?.syncedAt) setBackendSyncedAt(data.syncedAt);
				}
			} catch {}
		})();
		return () => {
			cancelled = true;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape") onBackToChat();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onBackToChat]);
	const triggerSuccessAlert = (msg) => {
		setSavedSuccessAlert(msg);
		setTimeout(() => setSavedSuccessAlert(null), 3e3);
	};
	const isDark = theme === "dark";
	const [locPref, setLocPref] = (0, import_react.useState)(() => getStoredLocationPref());
	const [citySearchQuery, setCitySearchQuery] = (0, import_react.useState)("");
	const [citySearchResults, setCitySearchResults] = (0, import_react.useState)([]);
	const [isSearchingCities, setIsSearchingCities] = (0, import_react.useState)(false);
	const [isDetectingLoc, setIsDetectingLoc] = (0, import_react.useState)(false);
	const [locStatusMessage, setLocStatusMessage] = (0, import_react.useState)(null);
	const [studyLanguage, setStudyLanguage] = (0, import_react.useState)(() => UserAccountStore.getPreferredStudyLanguage());
	(0, import_react.useEffect)(() => {
		const syncLoc = () => setLocPref(getStoredLocationPref());
		window.addEventListener("kinich-location-updated", syncLoc);
		return () => window.removeEventListener("kinich-location-updated", syncLoc);
	}, []);
	(0, import_react.useEffect)(() => {
		const trimmed = citySearchQuery.trim();
		if (trimmed.length < 2) {
			setCitySearchResults([]);
			setIsSearchingCities(false);
			return;
		}
		let cancelled = false;
		setIsSearchingCities(true);
		const timer = setTimeout(() => {
			searchCities(trimmed, 6).then((results) => {
				if (!cancelled) {
					setCitySearchResults(results);
					setIsSearchingCities(false);
				}
			}).catch(() => {
				if (!cancelled) {
					setCitySearchResults([]);
					setIsSearchingCities(false);
				}
			});
		}, 260);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [citySearchQuery]);
	const handleSelectStudyLanguage = (lang) => {
		UserAccountStore.setPreferredStudyLanguage(lang);
		setStudyLanguage(lang);
		const matched = SUPPORTED_STUDY_LANGUAGES.find((l) => l.id === lang);
		triggerSuccessAlert(`Study & explanation language set to ${matched ? matched.nativeLabel : lang}`);
	};
	const isAuthenticatedUser = Boolean(!UserAccountStore.isGuest());
	const navItems = [
		{
			id: "profile",
			label: "Profile & Account",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "w-4 h-4" })
		},
		{
			id: "models",
			label: "Model Settings",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "w-4 h-4 text-[#FC4C01]" })
		},
		{
			id: "billing",
			label: "Billing & Refunds",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Receipt, { className: "w-4 h-4 text-[#FC4C01]" })
		},
		{
			id: "pricing",
			label: "Plans & Pricing ($3 / $9)",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "w-4 h-4 text-[#FC4C01]" })
		},
		{
			id: "preferences",
			label: "App Preferences",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "w-4 h-4" })
		},
		{
			id: "chats_projects",
			label: "Chat History & Export",
			icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-4 h-4" })
		}
	];
	const syncWithProfileBackend = async (extra) => {
		setSyncingBackend(true);
		const resp = await UserAccountStore.syncProfileAndSettingsWithBackend({
			preferences: {
				selectedModelId: selectedModel.id,
				selectedModelName: selectedModel.name,
				webSearchDefault,
				nsfwMode: false,
				theme
			},
			...extra || {}
		});
		if (resp?.syncedAt) setBackendSyncedAt(resp.syncedAt);
		else setBackendSyncedAt(Date.now());
		setSyncingBackend(false);
	};
	const handleSaveProfile = (updates) => {
		const updated = {
			...profile,
			...updates
		};
		setProfile(updated);
		UserAccountStore.saveProfile(updated);
		syncWithProfileBackend({ profile: updated });
		triggerSuccessAlert("Profile & backend synced");
	};
	const handleExportAll = () => {
		const exportData = {
			profile: {
				displayName: profile.displayName,
				username: profile.username,
				email: profile.email
			},
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			threadCount: threads.length,
			threads: threads.map((t) => ({
				id: t.id,
				title: t.title,
				createdAt: t.createdAt
			}))
		};
		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `kinich_chat_export_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		triggerSuccessAlert("Exported all conversations");
	};
	const currentTabItem = navItems.find((n) => n.id === activeTab) || navItems[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `h-screen w-full flex flex-col overflow-hidden select-text transition-colors duration-200 ${isDark ? "bg-[#09090b] text-[#f4f4f5]" : "bg-[#fafafa] text-[#09090b]"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "h-14 px-4 sm:px-6 bg-transparent flex items-center justify-between shrink-0 z-20",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: onBackToChat,
						className: `flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${isDark ? "bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white" : "bg-neutral-100 hover:bg-neutral-200 border-black/10 text-black"}`,
						title: "Return to Chat (Esc)",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-3.5 h-3.5" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Back to Chat" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
								className: `hidden sm:inline-block text-[10px] px-1 py-0.2 rounded border font-mono ${isDark ? "bg-black/40 border-white/20 text-neutral-400" : "bg-white border-black/20 text-neutral-600"}`,
								children: "Esc"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-px bg-neutral-500/20 hidden sm:block" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "hidden sm:flex items-center gap-2 text-xs font-medium text-neutral-400",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Settings" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "w-3.5 h-3.5" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `font-semibold ${isDark ? "text-white" : "text-black"}`,
								children: currentTabItem.label
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [savedSuccessAlert && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: savedSuccessAlert })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 pl-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-7 h-7 rounded-full overflow-hidden border border-white/20 shrink-0 bg-neutral-800 flex items-center justify-center font-bold text-xs text-white",
						children: profile.avatar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: profile.avatar,
							alt: profile.displayName,
							className: "w-full h-full object-cover",
							onError: (e) => {
								e.target.style.display = "none";
							}
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: (profile.displayName || "U").charAt(0).toUpperCase() })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "hidden sm:block text-xs font-semibold",
						children: profile.displayName || "User"
					})]
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 flex flex-col md:flex-row overflow-hidden relative",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "tablist",
					"aria-label": "Account and settings sections",
					className: "md:hidden flex items-center gap-1.5 p-3 bg-transparent shrink-0 overflow-x-auto scrollbar-none",
					children: navItems.map((item, idx) => {
						const isActive = activeTab === item.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							id: `account-mobile-tab-${item.id}`,
							role: "tab",
							"aria-selected": isActive,
							"aria-controls": `account-tabpanel-${item.id}`,
							tabIndex: isActive ? 0 : -1,
							onClick: () => setActiveTab(item.id),
							onKeyDown: (e) => {
								if (e.key === "ArrowRight" || e.key === "ArrowDown") {
									e.preventDefault();
									const next = navItems[(idx + 1) % navItems.length];
									setActiveTab(next.id);
									document.getElementById(`account-mobile-tab-${next.id}`)?.focus();
								} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
									e.preventDefault();
									const prev = navItems[(idx - 1 + navItems.length) % navItems.length];
									setActiveTab(prev.id);
									document.getElementById(`account-mobile-tab-${prev.id}`)?.focus();
								} else if (e.key === "Home") {
									e.preventDefault();
									setActiveTab(navItems[0].id);
									document.getElementById(`account-mobile-tab-${navItems[0].id}`)?.focus();
								} else if (e.key === "End") {
									e.preventDefault();
									const last = navItems[navItems.length - 1];
									setActiveTab(last.id);
									document.getElementById(`account-mobile-tab-${last.id}`)?.focus();
								}
							},
							className: `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${isActive ? isDark ? "bg-white text-black font-semibold" : "bg-black text-white font-semibold" : isDark ? "text-neutral-400 hover:text-white bg-white/5" : "text-neutral-600 hover:text-black bg-black/5"}`,
							children: [item.icon, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
						}, item.id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: `hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r p-4 justify-between overflow-y-auto slim-scrollbar ${isDark ? "border-white/10 bg-[#0d0d10]" : "border-black/10 bg-[#f7f7f9]"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3 rounded-xl border flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0 bg-neutral-800 flex items-center justify-center font-bold text-sm text-white",
								children: profile.avatar ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: profile.avatar,
									alt: profile.displayName,
									className: "w-full h-full object-cover",
									onError: (e) => {
										e.target.style.display = "none";
									}
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: (profile.displayName || "U").charAt(0).toUpperCase() })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "overflow-hidden",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs font-bold truncate",
									children: profile.displayName || "User"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[11px] text-neutral-400 truncate",
									children: ["@", profile.username || "user"]
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
							role: "tablist",
							"aria-label": "Account and settings navigation",
							className: "space-y-1",
							children: navItems.map((item, idx) => {
								const isActive = activeTab === item.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									id: `account-desktop-tab-${item.id}`,
									role: "tab",
									"aria-selected": isActive,
									"aria-controls": `account-tabpanel-${item.id}`,
									tabIndex: isActive ? 0 : -1,
									onClick: () => setActiveTab(item.id),
									onKeyDown: (e) => {
										if (e.key === "ArrowRight" || e.key === "ArrowDown") {
											e.preventDefault();
											const next = navItems[(idx + 1) % navItems.length];
											setActiveTab(next.id);
											document.getElementById(`account-desktop-tab-${next.id}`)?.focus();
										} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
											e.preventDefault();
											const prev = navItems[(idx - 1 + navItems.length) % navItems.length];
											setActiveTab(prev.id);
											document.getElementById(`account-desktop-tab-${prev.id}`)?.focus();
										} else if (e.key === "Home") {
											e.preventDefault();
											setActiveTab(navItems[0].id);
											document.getElementById(`account-desktop-tab-${navItems[0].id}`)?.focus();
										} else if (e.key === "End") {
											e.preventDefault();
											const last = navItems[navItems.length - 1];
											setActiveTab(last.id);
											document.getElementById(`account-desktop-tab-${last.id}`)?.focus();
										}
									},
									className: `w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${isActive ? isDark ? "bg-white text-black font-semibold" : "bg-black text-white font-semibold" : isDark ? "text-neutral-300 hover:bg-white/5 hover:text-white" : "text-neutral-600 hover:bg-black/5 hover:text-black"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.icon }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label })]
								}, item.id);
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "pt-4 border-t border-neutral-500/10",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: onBackToChat,
							className: `w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${isDark ? "border-white/10 hover:bg-white/10 text-neutral-300 hover:text-white" : "border-black/10 hover:bg-black/5 text-neutral-700 hover:text-black"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Back to Chat" })]
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					id: `account-tabpanel-${activeTab}`,
					role: "tabpanel",
					"aria-labelledby": `account-desktop-tab-${activeTab}`,
					className: "flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10 slim-scrollbar",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `${activeTab === "pricing" ? "max-w-6xl" : "max-w-3xl"} mx-auto space-y-6 pb-16`,
						children: [
							activeTab === "models" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelSettingsPanel, {
								isDark,
								selectedModel,
								onSelectModel,
								webSearchDefault,
								onToggleWebSearchDefault,
								onOpenPricing,
								onSaved: triggerSuccessAlert
							}),
							activeTab === "pricing" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
								fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModalSkeleton, { isDark }),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PricingModal, {
									isOpen: true,
									onClose: onBackToChat,
									isDark,
									embedded: true
								})
							}),
							activeTab === "billing" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-6",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-xl sm:text-2xl font-bold tracking-tight",
									children: "Billing, Refunds & Subscription Cancellation"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs sm:text-sm text-neutral-400 mt-1",
									children: "Manage your Dodo Payments subscription, request a 7-day refund, cancel your plan, or download past invoices."
								})] }), isAuthenticatedUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferralsAndRewardsSection, { isDark }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefundPolicySection, { isDark }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CancelSubscriptionSection, { isDark }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
										fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "space-y-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
												isDark,
												className: "h-12 w-full rounded-2xl"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
												isDark,
												className: "h-32 w-full rounded-2xl"
											})]
										}),
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BillingHistorySection, { isDark })
									})
								] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferralsAndRewardsSection, { isDark }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-6 rounded-2xl border text-center space-y-3 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-sm font-semibold",
												children: "Sign in to manage billing & subscriptions"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-neutral-400 max-w-md mx-auto",
												children: "You are browsing as a Guest. Sign in with Google or Email to subscribe to Spark or Fire, view invoices, or request refunds."
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => window.dispatchEvent(new CustomEvent("kinich-open-auth", { detail: { reason: "Sign in to manage your account and billing" } })),
												className: "px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors",
												children: "Sign in with Google or Email"
											})
										]
									})]
								})]
							}),
							activeTab === "profile" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-6",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "text-xl sm:text-2xl font-bold tracking-tight",
											children: "Profile & Backend"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs sm:text-sm text-neutral-400 mt-1",
											children: "Unified profile identity, daily streak reminders, and live backend sync."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => {
												syncWithProfileBackend();
												triggerSuccessAlert("Synced profile & AI settings to backend");
											},
											className: `px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${isDark ? "bg-white/[0.05] hover:bg-white/[0.1] border-white/15 text-white" : "bg-white hover:bg-neutral-100 border-black/15 text-black"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 ${syncingBackend ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: syncingBackend ? "Syncing Backend..." : backendSyncedAt ? `Backend Synced · ${new Date(backendSyncedAt).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit"
											})}` : "Sync Backend Now" })]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-xs font-medium text-neutral-400 mb-1",
													children: "Display Name"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													value: profile.displayName,
													onChange: (e) => setProfile({
														...profile,
														displayName: e.target.value
													}),
													onBlur: () => handleSaveProfile({ displayName: profile.displayName }),
													className: `w-full px-3 py-2 rounded-xl border text-sm font-medium outline-none transition-all ${isDark ? "bg-black/50 border-white/15 focus:border-white text-white" : "bg-neutral-50 border-black/15 focus:border-black text-black"}`,
													placeholder: "Your name"
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-xs font-medium text-neutral-400 mb-1",
													children: "Username"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "relative",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "absolute left-3 top-2.5 text-xs text-neutral-500",
														children: "@"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "text",
														value: profile.username,
														onChange: (e) => setProfile({
															...profile,
															username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
														}),
														onBlur: () => handleSaveProfile({ username: profile.username }),
														className: `w-full pl-7 pr-3 py-2 rounded-xl border text-sm font-medium outline-none transition-all ${isDark ? "bg-black/50 border-white/15 focus:border-white text-white" : "bg-neutral-50 border-black/15 focus:border-black text-black"}`,
														placeholder: "username"
													})]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "sm:col-span-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "block text-xs font-medium text-neutral-400 mb-1",
														children: "Email Address"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "email",
														value: profile.email,
														onChange: (e) => setProfile({
															...profile,
															email: e.target.value
														}),
														onBlur: () => handleSaveProfile({ email: profile.email }),
														className: `w-full px-3 py-2 rounded-xl border text-sm font-medium outline-none transition-all ${isDark ? "bg-black/50 border-white/15 focus:border-white text-white" : "bg-neutral-50 border-black/15 focus:border-black text-black"}`
													})]
												})
											]
										})
									}),
									isAuthenticatedUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-semibold",
											children: "Subscription, invoices & refunds"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setActiveTab("pricing"),
												className: `px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${isDark ? "border-white/15 hover:bg-white/5 text-white" : "border-black/15 hover:bg-black/5 text-black"}`,
												children: "Plans"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setActiveTab("billing"),
												className: "px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer",
												children: "Billing & Refunds"
											})]
										})]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm font-bold",
											children: "Sign in to sync your Vault & account"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-neutral-400 mt-0.5",
											children: "Create a free account with Google or Email to save to the Vault, claim streak bonuses, and manage subscriptions."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => window.dispatchEvent(new CustomEvent("kinich-open-auth", { detail: { reason: "Sign in to keep this in your Vault" } })),
											className: "px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors",
											children: "Sign in"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReferralsAndRewardsSection, { isDark }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center shrink-0",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "w-4 h-4 text-[#FC4C01] fill-[#FC4C01]" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-sm font-bold flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Daily Streak & Reminder Notifications" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30",
														children: [streak.currentStreak, "d Streak"]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xs text-neutral-400 mt-0.5",
													children: "Reminds you via toast notification if you haven't completed your daily Kinich interaction by your scheduled time."
												})] })]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => {
													const updated = UserAccountStore.updateStreakReminderSettings({ reminderEnabled: !streak.reminderEnabled });
													setStreak(updated);
													triggerSuccessAlert(updated.reminderEnabled ? `Daily reminder enabled (${updated.reminderTime})` : "Daily reminder paused");
												},
												className: `w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${streak.reminderEnabled ? "bg-[#FC4C01]" : isDark ? "bg-neutral-700" : "bg-neutral-300"}`,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${streak.reminderEnabled ? "translate-x-5" : ""}` })
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-500/10",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 flex-wrap",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-xs text-neutral-400 inline-flex items-center gap-1 font-mono",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3.5 h-3.5 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reminder Time (IST):" })]
													}),
													[
														"09:00",
														"12:00",
														"18:00",
														"19:00",
														"21:00"
													].map((t) => {
														const isAct = (streak.reminderTime || "19:00") === t;
														return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => {
																const updated = UserAccountStore.updateStreakReminderSettings({
																	reminderEnabled: true,
																	reminderTime: t
																});
																setStreak(updated);
																triggerSuccessAlert(`Reminder scheduled for ${t} IST`);
															},
															className: `px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums cursor-pointer transition-colors ${isAct ? "bg-[#FC4C01]/15 border-[#FC4C01] text-[#FC4C01] font-semibold" : isDark ? "border-white/10 hover:border-white/25 text-neutral-300" : "border-black/10 hover:border-black/25 text-neutral-700"}`,
															children: t === "19:00" ? "19:00 (7 PM)" : t
														}, t);
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "time",
														"aria-label": "Daily reminder time",
														value: streak.reminderTime || "19:00",
														onChange: (e) => {
															const updated = UserAccountStore.updateStreakReminderSettings({
																reminderEnabled: true,
																reminderTime: e.target.value
															});
															setStreak(updated);
														},
														className: `px-2.5 py-1 rounded-lg border text-xs font-mono outline-none ${isDark ? "bg-black/50 border-white/15 text-white" : "bg-neutral-50 border-black/15 text-black"}`
													})
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[11px] text-neutral-400 font-mono",
												children: [
													"Scheduled daily at ",
													streak.reminderTime || "19:00",
													" IST (Asia/Kolkata)"
												]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `p-5 rounded-2xl border space-y-3 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										"data-testid": "settings-language-card",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-sm font-semibold",
												children: "Explanation & Study Language"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs text-neutral-400 mt-0.5",
												children: "Preferred language for Study summaries, explanations, and Snap & Solve."
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudyLanguageDropdown, {
												value: studyLanguage,
												isDark,
												compact: false,
												onChange: (lang) => handleSelectStudyLanguage(lang)
											})]
										})
									}),
									(() => {
										const effectiveLoc = getEffectiveLocationPayload();
										const isDisabled = !locPref.locationEnabled || locPref.mode === "disabled";
										const activeCityLabel = isDisabled ? "Location Disabled" : effectiveLoc?.city ? [
											effectiveLoc.city,
											effectiveLoc.region,
											effectiveLoc.country
										].filter(Boolean).join(", ") : "Not resolved yet";
										const methodBadge = locPref.mode === "disabled" || !locPref.locationEnabled ? "Disabled" : effectiveLoc?.detectionMethod === "gps" ? "Precise GPS" : effectiveLoc?.detectionMethod === "manual" ? "Manual City" : effectiveLoc?.detectionMethod === "ip" ? "Approximate IP" : locPref.mode === "precise" ? "GPS Ready" : "IP Mode";
										const handleSwitchMode = async (mode) => {
											setLocStatusMessage(null);
											if (mode === "disabled") {
												setLocationDisabled(true);
												setLocPref(getStoredLocationPref());
												triggerSuccessAlert("Location awareness disabled");
												return;
											}
											if (mode === "precise") {
												setIsDetectingLoc(true);
												const result = await requestPreciseLocation({ allowIpFallback: true });
												setIsDetectingLoc(false);
												setLocPref(getStoredLocationPref());
												if (result.location && !result.usedFallback) {
													setLocStatusMessage(`GPS updated to ${result.location.city}`);
													triggerSuccessAlert(`Precise location set to ${result.location.city}`);
												} else if (result.errorMessage) setLocStatusMessage(result.errorMessage);
												return;
											}
											if (mode === "approximate") {
												setLocationMode("approximate");
												setIsDetectingLoc(true);
												const ipLoc = await fetchClientApproximateIpLocation();
												setIsDetectingLoc(false);
												setLocPref(getStoredLocationPref());
												if (ipLoc?.city) {
													setLocStatusMessage(`Approximate IP city: ${ipLoc.city}`);
													triggerSuccessAlert(`Approximate location updated (${ipLoc.city})`);
												} else setLocStatusMessage("Approximate IP city unavailable. You can pick a city manually below.");
												return;
											}
											setLocationMode("manual");
											setLocPref(getStoredLocationPref());
											if (!locPref.manualLocation?.city) setLocStatusMessage("Search and select a city below to activate Manual mode.");
										};
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
											"data-testid": "settings-location-card",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-start justify-between gap-3",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-start gap-2.5",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center shrink-0 mt-0.5",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4 text-[#FC4C01]" })
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-sm font-bold flex flex-wrap items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Location Awareness & Privacy" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: `px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${isDisabled ? "bg-neutral-500/15 text-neutral-400 border-neutral-500/30" : "bg-[#FC4C01]/15 text-[#FC4C01] border-[#FC4C01]/30"}`,
																children: methodBadge
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-xs text-neutral-400 mt-0.5",
															children: "Used only when you ask location-dependent questions (weather, local time, nearby places). Never injected unnecessarily."
														})] })]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => handleSwitchMode(isDisabled ? "approximate" : "disabled"),
														className: `w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${!isDisabled ? "bg-[#FC4C01]" : isDark ? "bg-neutral-700" : "bg-neutral-300"}`,
														"aria-label": isDisabled ? "Enable location awareness" : "Disable location awareness",
														title: isDisabled ? "Enable location awareness" : "Disable location awareness",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${!isDisabled ? "translate-x-5" : ""}` })
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: `p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${isDark ? "bg-black/30 border-white/10" : "bg-neutral-50 border-black/10"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-0.5 min-w-0",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "font-semibold truncate flex items-center gap-1.5",
															children: [effectiveLoc?.detectionMethod === "gps" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3.5 h-3.5 text-emerald-500 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5 text-[#FC4C01] shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "truncate",
																children: activeCityLabel
															})]
														}), !isDisabled && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-[11px] text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-0.5",
															children: [
																effectiveLoc?.timezone && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["TZ: ", effectiveLoc.timezone] }),
																typeof effectiveLoc?.accuracy === "number" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
																	"Accuracy: ~",
																	Math.round(effectiveLoc.accuracy),
																	"m"
																] }),
																effectiveLoc?.updatedAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
																	"Updated:",
																	" ",
																	new Date(effectiveLoc.updatedAt).toLocaleTimeString([], {
																		hour: "2-digit",
																		minute: "2-digit"
																	})
																] }) : null
															]
														})]
													}), !isDisabled && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														type: "button",
														disabled: isDetectingLoc,
														onClick: () => handleSwitchMode(locPref.mode === "precise" ? "precise" : "approximate"),
														className: `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition disabled:opacity-50 ${isDark ? "border-white/15 hover:bg-white/10 text-neutral-200" : "border-black/15 hover:bg-black/5 text-neutral-800"}`,
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3 h-3 ${isDetectingLoc ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isDetectingLoc ? "Updating..." : "Refresh" })]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "space-y-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "text-[11px] font-semibold uppercase tracking-wider text-neutral-400",
														children: "Detection Mode"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "grid grid-cols-2 sm:grid-cols-4 gap-2",
														children: [
															{
																id: "precise",
																label: "Precise GPS",
																desc: "Device permission"
															},
															{
																id: "approximate",
																label: "Approximate IP",
																desc: "City-level fallback"
															},
															{
																id: "manual",
																label: "Manual City",
																desc: "Travel & override"
															},
															{
																id: "disabled",
																label: "Off",
																desc: "Never use location"
															}
														].map((opt) => {
															const selected = opt.id === "disabled" ? isDisabled : !isDisabled && locPref.mode === opt.id;
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
																type: "button",
																disabled: isDetectingLoc,
																onClick: () => handleSwitchMode(opt.id),
																className: `p-2.5 rounded-xl border text-left transition cursor-pointer disabled:opacity-50 ${selected ? "border-[#FC4C01] bg-[#FC4C01]/10" : isDark ? "border-white/10 hover:border-white/25 bg-white/[0.01]" : "border-black/10 hover:border-black/25 bg-white"}`,
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "text-xs font-semibold flex items-center justify-between",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: opt.label }), selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 text-[#FC4C01]" })]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "text-[10px] text-neutral-400 mt-0.5",
																	children: opt.desc
																})]
															}, opt.id);
														})
													})]
												}),
												(locStatusMessage || locPref.lastError || locPref.permissionState === "denied" || locPref.permissionState === "insecure") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: `p-3 rounded-xl border text-xs flex items-start gap-2 ${locPref.permissionState === "denied" || locPref.lastError ? isDark ? "bg-amber-500/10 border-amber-500/30 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-900" : isDark ? "bg-white/5 border-white/10 text-neutral-300" : "bg-neutral-50 border-black/10 text-neutral-700"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-4 h-4 shrink-0 mt-0.5 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex-1 space-y-1",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: locStatusMessage || locPref.lastError || (locPref.permissionState === "denied" ? "Browser location permission is blocked. Enable location in site settings or select a city manually below." : "Precise location requires an HTTPS connection.") })
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "pt-3 border-t border-neutral-500/10 space-y-2",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-xs font-semibold flex items-center justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Search & Set City (Travel / Override)" }), locPref.mode === "manual" && locPref.manualLocation?.city && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-[10px] text-[#FC4C01] font-mono",
																children: ["Active: ", locPref.manualLocation.city]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[11px] text-neutral-400",
															children: "Search any city worldwide when travelling or on VPN. Selecting a city switches immediately and aligns weather and time lookups."
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "relative",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "flex items-center gap-2",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "relative flex-1",
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" }),
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																			type: "text",
																			value: citySearchQuery,
																			onChange: (e) => setCitySearchQuery(e.target.value),
																			placeholder: "Search city (e.g. Tokyo, London, Hyderabad)...",
																			id: "kinich-home-city-input",
																			className: `w-full pl-8 pr-8 py-2 rounded-xl border text-xs outline-none transition ${isDark ? "bg-[#141418] border-white/15 text-white focus:border-[#FC4C01]" : "bg-white border-black/15 text-neutral-900 focus:border-[#FC4C01]"}`
																		}),
																		citySearchQuery && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																			type: "button",
																			onClick: () => {
																				setCitySearchQuery("");
																				setCitySearchResults([]);
																			},
																			className: "absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 cursor-pointer",
																			"aria-label": "Clear city search",
																			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
																		})
																	]
																})
															}), (isSearchingCities || citySearchResults.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: `mt-1.5 rounded-xl border overflow-hidden divide-y ${isDark ? "bg-[#141418] border-white/15 divide-white/5" : "bg-white border-black/10 divide-black/5 shadow-md"}`,
																children: isSearchingCities && citySearchResults.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "px-3 py-2 text-xs text-neutral-400",
																	children: "Searching cities..."
																}) : citySearchResults.map((place, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
																	type: "button",
																	onClick: () => {
																		setManualLocationPlace(place);
																		setLocPref(getStoredLocationPref());
																		setCitySearchQuery("");
																		setCitySearchResults([]);
																		setLocStatusMessage(`Active city set to ${place.displayName}`);
																		triggerSuccessAlert(`Location set to ${place.displayName}`);
																	},
																	className: `w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition ${isDark ? "hover:bg-white/5" : "hover:bg-neutral-50"}`,
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																		className: "truncate font-medium",
																		children: place.displayName
																	}), place.timezone && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																		className: "text-[10px] font-mono text-neutral-400 shrink-0",
																		children: place.timezone
																	})]
																}, `${place.name}-${place.latitude}-${place.longitude}-${idx}`))
															})]
														})
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "pt-3 border-t border-neutral-500/10 space-y-3",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
														className: "flex items-start gap-2.5 cursor-pointer select-none",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: Boolean(locPref.persistPreciseLocation),
															onChange: (e) => {
																setPersistPreciseLocation(e.target.checked);
																setLocPref(getStoredLocationPref());
																triggerSuccessAlert(e.target.checked ? "Precise coordinates will persist across sessions" : "Precise coordinates restricted to current session only");
															},
															className: "mt-0.5 rounded border-neutral-500 accent-[#FC4C01] cursor-pointer"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "text-xs space-y-0.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "font-semibold flex items-center gap-1.5",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-3.5 h-3.5 text-emerald-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Save precise GPS coordinates across sessions" })]
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "text-[11px] text-neutral-400",
																children: "Off by default for privacy: precise GPS coordinates stay in memory for this session only, and raw IP addresses are never stored. Enable only if you want your signed-in account to remember exact GPS coordinates across devices."
															})]
														})]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex flex-wrap items-center justify-between gap-2 pt-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[11px] text-neutral-400",
															children: "Remove local and synced location data from your account at any time."
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															type: "button",
															onClick: async () => {
																await clearStoredLocationPref({ deleteRemote: true });
																setLocPref(getStoredLocationPref());
																setCitySearchQuery("");
																setCitySearchResults([]);
																setLocStatusMessage("All saved location data cleared.");
																triggerSuccessAlert("Saved location data deleted");
															},
															className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-medium cursor-pointer transition shrink-0",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Clear Saved Location Data" })]
														})]
													})]
												})
											]
										});
									})(),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center shrink-0",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Award, { className: "w-4 h-4 text-[#FC4C01]" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-sm font-bold flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Streaks & Achievement Badges" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30",
														children: [
															badges.filter((b) => b.isUnlocked).length,
															"/",
															badges.length,
															" Unlocked"
														]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xs text-neutral-400 mt-0.5",
													children: "Earn badges by maintaining streaks, exploring models, and running study sessions. Claim bonus messages & shields."
												})] })]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 flex-wrap",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "px-2.5 py-1 rounded-lg border border-white/10 text-xs font-mono tabular-nums inline-flex items-center gap-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-3.5 h-3.5 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
														streak.streakFreezes,
														"/",
														streak.maxStreakFreezes || 3,
														" Shields"
													] })]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														onBackToChat();
														setTimeout(() => {
															window.dispatchEvent(new CustomEvent("kinich-open-streak-modal", { detail: { tab: "badges" } }));
														}, 60);
													},
													className: "px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors",
													children: "Open Streak & Badges Center"
												})]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1",
											children: badges.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `p-3 rounded-xl border flex flex-col justify-between gap-2 ${b.isUnlocked ? b.isFeatured ? "bg-[#FC4C01]/10 border-[#FC4C01]/50" : isDark ? "bg-white/[0.03] border-white/15" : "bg-neutral-50 border-black/15" : isDark ? "bg-black/30 border-white/[0.06] opacity-70" : "bg-neutral-50/60 border-black/[0.06] opacity-75"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-xs font-semibold truncate",
														children: b.title
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[10px] font-mono tabular-nums text-[#FC4C01]",
														children: [
															Math.min(b.currentValue, b.targetValue),
															"/",
															b.targetValue
														]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-neutral-400 mt-0.5 line-clamp-2",
													children: b.subtitle
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between gap-1.5 pt-1.5 border-t border-neutral-500/10",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "inline-flex items-center gap-2 text-[10.5px] font-mono tabular-nums font-medium text-[#FC4C01]",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "inline-flex items-center gap-1",
																title: `+${b.bonusMessages} Messages`,
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3 h-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", b.bonusMessages] })]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "opacity-30",
																children: "|"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "inline-flex items-center gap-1",
																title: `+${b.bonusUploads} Uploads`,
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "w-3 h-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", b.bonusUploads] })]
															}),
															b.bonusShields ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "opacity-30",
																children: "|"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "inline-flex items-center gap-1",
																title: `+${b.bonusShields} Shield`,
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-3 h-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", b.bonusShields] })]
															})] }) : null
														]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-1",
														children: [
															b.isUnlocked && !b.isFeatured && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																type: "button",
																onClick: () => {
																	UserAccountStore.setFeaturedBadge(b.id);
																	setBadges(UserAccountStore.getEvaluatedBadges(threads));
																	triggerSuccessAlert(`Equipped "${b.title}" badge`);
																},
																className: `px-2 py-0.5 rounded border text-[10px] font-medium cursor-pointer ${isDark ? "border-white/15 hover:bg-white/10 text-white" : "border-black/15 hover:bg-black/5 text-black"}`,
																children: "Equip"
															}),
															b.isFeatured && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "px-1.5 py-0.5 rounded bg-[#FC4C01]/20 text-[#FC4C01] text-[9.5px] font-mono font-semibold",
																children: "Equipped"
															}),
															b.isClaimed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-[10px] font-mono text-neutral-400 inline-flex items-center gap-0.5",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3 h-3 text-[#FC4C01]" }), " Claimed"]
															}) : b.isUnlocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
																type: "button",
																onClick: () => {
																	const res = UserAccountStore.claimBadgeReward(b.id);
																	setBadges(UserAccountStore.getEvaluatedBadges(threads));
																	setStreak(UserAccountStore.getDailyStreak(threads));
																	if (res.rewarded) triggerSuccessAlert(`Claimed ${b.title} (+${b.bonusMessages} msgs, +${b.bonusUploads} uploads)`);
																},
																className: "px-2.5 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gift, { className: "w-2.5 h-2.5" }), " Claim"]
															}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																className: "text-[10px] font-mono text-neutral-500",
																children: [b.progressPct, "%"]
															})
														]
													})]
												})]
											}, b.id))
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm font-bold",
											children: "Export My Data (Data Portability)"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-neutral-400 mt-0.5",
											children: "Download a complete JSON archive of your profile, settings, streaks, badges, and chat threads."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: handleExportAll,
											className: `px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${isDark ? "border-white/15 bg-white/5 hover:bg-white/10 text-white" : "border-black/15 bg-black/5 hover:bg-black/10 text-black"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Export My Data" })]
										})]
									}),
									isAuthenticatedUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-sm font-bold",
												children: "Account Session"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-xs text-neutral-400 mt-0.5",
												children: [
													"Signed in via ",
													profile.signinProvider === "email" ? "Email & Password" : "Google OAuth",
													" (",
													profile.email,
													")"
												]
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: async () => {
													await UserAccountStore.signOutUser();
													setProfile(UserAccountStore.getProfile());
													triggerSuccessAlert("Signed out successfully");
												},
												className: "px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold cursor-pointer transition-all",
												children: "Sign Out"
											})]
										})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeleteAccountButton, {
										isDark,
										onDeleted: () => {
											setProfile(UserAccountStore.getProfile());
											triggerSuccessAlert("Account deleted successfully");
										}
									})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-sm font-bold",
												children: "Guest Workspace Session"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs text-neutral-400 mt-0.5",
												children: "You are browsing as a guest. Sign in with Google or Email to sync your history across devices."
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: async () => {
													await UserAccountStore.signOutUser();
													window.location.href = "/login";
												},
												className: "px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-all shrink-0",
												children: "Sign In / Create Account"
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isDark ? "bg-red-950/10 border-red-500/20" : "bg-red-50 border-red-200"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-sm font-bold text-red-500",
												children: "Clear Guest Data"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs text-neutral-400 mt-0.5",
												children: "Wipe all local guest chat history, study sets, and browser storage keys from this device."
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => {
													onClearAllHistory();
													try {
														localStorage.removeItem("kinich_threads_v3");
														localStorage.removeItem("kinich_knowledge_vault_v1");
														localStorage.removeItem("kinich_user_profile_v1");
													} catch {}
													triggerSuccessAlert("Guest data cleared from this browser");
												},
												className: "px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-all shrink-0",
												children: "Clear Guest Data"
											})]
										})]
									})
								]
							}),
							activeTab === "chats_projects" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-6",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col sm:flex-row sm:items-center justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "text-xl sm:text-2xl font-bold tracking-tight",
											children: "Chat History & Export"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs sm:text-sm text-neutral-400 mt-1",
											children: "Manage and export your conversations."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex items-center gap-2",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: handleExportAll,
												className: `px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${isDark ? "border-white/10 hover:bg-white/10 text-white" : "border-black/10 hover:bg-black/5 text-black"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-3.5 h-3.5" }), " Export All (JSON)"]
											})
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `rounded-2xl border overflow-hidden ${isDark ? "border-white/10 bg-white/[0.01]" : "border-black/10 bg-white shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `p-3.5 border-b flex items-center justify-between ${isDark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-neutral-50"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
												children: [
													"Conversations (",
													threads.length,
													")"
												]
											}), threads.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => setConfirmClearHistory(true),
												className: "text-[11px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3 h-3" }), " Clear History"]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "divide-y divide-neutral-500/10",
											children: [threads.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `p-3 sm:px-4 flex items-center justify-between gap-3 text-xs ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-neutral-50"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2.5 overflow-hidden flex-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5 text-neutral-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "truncate font-medium",
														children: t.title
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 shrink-0",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-neutral-500 font-mono hidden sm:inline",
															children: new Date(t.createdAt).toLocaleDateString()
														}),
														onSelectThread && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => {
																onSelectThread(t.id);
																onBackToChat();
															},
															className: `px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer ${isDark ? "border-white/10 hover:bg-white/10 text-white" : "border-black/10 hover:bg-black/5 text-black"}`,
															children: "Open"
														}),
														onDeleteThread && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => onDeleteThread(t.id),
															title: "Delete thread",
															"aria-label": "Delete thread",
															className: "p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3 h-3" })
														})
													]
												})]
											}, t.id)), threads.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "p-8 text-center text-xs text-neutral-500",
												children: "No conversations yet."
											})]
										})]
									}),
									confirmClearHistory && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-4 rounded-2xl border border-red-500/40 bg-red-500/10 flex items-center justify-between gap-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-neutral-300",
											children: "Permanently delete all chat history?"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 shrink-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => {
													onClearAllHistory();
													setConfirmClearHistory(false);
													triggerSuccessAlert("Chat history cleared");
												},
												className: "px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer",
												children: "Confirm Delete"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => setConfirmClearHistory(false),
												className: "px-3 py-1.5 rounded-xl border border-neutral-500/30 text-xs font-semibold cursor-pointer",
												children: "Cancel"
											})]
										})]
									})
								]
							}),
							activeTab === "preferences" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-6",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-xl sm:text-2xl font-bold tracking-tight",
										children: "App Preferences"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs sm:text-sm text-neutral-400 mt-1",
										children: "Theme appearance and search grounding."
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm font-semibold",
											children: "AI Model & System Prompts"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-neutral-400 mt-0.5",
											children: "Configure system prompts, temperature, reasoning effort, and default AI models."
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => setActiveTab("models"),
											className: "px-3.5 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Open Model Settings" })]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
											children: "Theme"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-2 gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => onThemeChange("dark"),
												className: `p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${isDark ? "border-white bg-white/10 text-white font-bold" : "border-black/10 text-neutral-600 hover:bg-black/5"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "w-4 h-4 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Dark Mode" })]
												}), isDark && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4" })]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => onThemeChange("light"),
												className: `p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${!isDark ? "border-black bg-black/10 text-black font-bold" : "border-white/10 text-neutral-400 hover:bg-white/5"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "w-4 h-4 text-amber-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Light Mode" })]
												}), !isDark && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4" })]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `p-5 rounded-2xl border space-y-3 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center justify-between gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
												children: "Language"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[11px] text-neutral-400 mt-0.5",
												children: "Default language for explanations, Study summaries, and Snap & Solve."
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudyLanguageDropdown, {
												value: studyLanguage,
												isDark,
												compact: false,
												onChange: (lang) => handleSelectStudyLanguage(lang)
											})]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
												children: "Ambient Background Glow"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[11px] text-neutral-400 mt-0.5",
												children: "Top-centre warm amber (#FC4C01) background glow fading cleanly to near-black."
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono ${isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/[0.03]"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold",
													children: selectedModel.name
												})]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "grid grid-cols-1 sm:grid-cols-3 gap-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: () => {
														onSelectBgGradientMode?.("dynamic-model");
														setStoredBackgroundGradientMode("dynamic-model");
														triggerSuccessAlert("Warm amber top-centre glow enabled");
													},
													className: `p-3.5 rounded-xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${bgGradientMode === "dynamic-model" || bgGradientMode === "exact-sunset" ? "border-[#FC4C01] ring-1 ring-[#FC4C01]/50 bg-[#FC4C01]/10" : isDark ? "border-white/10 hover:border-white/20 bg-white/[0.02]" : "border-black/10 hover:border-black/20 bg-neutral-50"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-3.5 h-3.5 rounded-full bg-[#FC4C01] shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-xs font-bold",
																children: "Warm Amber Glow"
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "text-[11px] text-neutral-400",
															children: "Top-centre #FC4C01 ambient glow fading to near-black."
														})]
													}), (bgGradientMode === "dynamic-model" || bgGradientMode === "exact-sunset") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: () => {
														onSelectBgGradientMode?.("subtle");
														setStoredBackgroundGradientMode("subtle");
														triggerSuccessAlert("Subtle background glow enabled");
													},
													className: `p-3.5 rounded-xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${bgGradientMode === "subtle" ? "border-[#FC4C01] ring-1 ring-[#FC4C01]/50 bg-[#FC4C01]/10" : isDark ? "border-white/10 hover:border-white/20 bg-white/[0.02]" : "border-black/10 hover:border-black/20 bg-neutral-50"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-3.5 h-3.5 rounded-full bg-[#FC4C01]/45 border border-[#FC4C01] shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-xs font-bold",
																children: "Subtle Glow"
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "text-[11px] text-neutral-400",
															children: "Softer top-centre ambient lighting for minimal distraction."
														})]
													}), bgGradientMode === "subtle" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: () => {
														onSelectBgGradientMode?.("off");
														setStoredBackgroundGradientMode("off");
														triggerSuccessAlert("Background glow disabled (solid base)");
													},
													className: `p-3.5 rounded-xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${bgGradientMode === "off" ? "border-[#FC4C01] ring-1 ring-[#FC4C01]/50 bg-[#FC4C01]/10" : isDark ? "border-white/10 hover:border-white/20 bg-white/[0.02]" : "border-black/10 hover:border-black/20 bg-neutral-50"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "space-y-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `w-3.5 h-3.5 rounded-full border ${isDark ? "bg-black border-white/30" : "bg-white border-black/30"} shrink-0` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-xs font-bold",
																children: "Solid Base (Off)"
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
															className: "text-[11px] text-neutral-400",
															children: "Pure monochrome backdrop with zero ambient glow."
														})]
													}), bgGradientMode === "off" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" })]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
												children: "Search Grounding"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between py-2 border-b border-neutral-500/10",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xs font-semibold",
													children: "Web Search Grounding"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-neutral-400",
													children: "Enable real-time web search with Treg engine."
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													role: "switch",
													"aria-checked": webSearchDefault,
													"aria-label": "Web Search Grounding",
													onClick: () => onToggleWebSearchDefault(!webSearchDefault),
													className: `w-11 h-6 rounded-full transition-colors relative cursor-pointer ${webSearchDefault ? isDark ? "bg-white" : "bg-black" : isDark ? "bg-neutral-700" : "bg-neutral-300"}`,
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${webSearchDefault ? isDark ? "translate-x-5 bg-black" : "translate-x-5 bg-white" : "bg-white"}` })
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between py-2.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-xs font-semibold flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Media SafeSearch & Upload Guard" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
														children: "Active"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-neutral-400 mt-0.5",
													children: "Explicit image/video pulls and prohibited uploads are automatically filtered across all models."
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[10px] font-mono text-neutral-400 px-2.5 py-1 rounded-md bg-neutral-800/60 border border-neutral-700/60",
													children: "Protected"
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-5 rounded-2xl border space-y-3 ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10 shadow-xs"}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
													children: "Legal, Trust & Compliance"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-neutral-500 font-mono",
													children: "DPDP Act 2023 · IT Act 2000"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1",
												children: [
													{
														title: "Terms of Service",
														path: "/terms",
														desc: "Acceptable use, subscriptions & accounts"
													},
													{
														title: "Privacy Policy",
														path: "/privacy",
														desc: "Data handling, DPDP & subprocessors"
													},
													{
														title: "Refund Policy",
														path: "/refund",
														desc: "7-day refund guarantee"
													},
													{
														title: "Acceptable Use Policy",
														path: "/acceptable-use",
														desc: "Safety rules & upload guidelines"
													},
													{
														title: "Cookie Notice",
														path: "/cookies",
														desc: "Essential storage & preference cookies"
													},
													{
														title: "Contact & Grievance",
														path: "/contact",
														desc: "Support & Grievance Officer SLA"
													}
												].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													type: "button",
													onClick: () => {
														window.dispatchEvent(new CustomEvent("kinich-navigate-route", { detail: { path: item.path } }));
													},
													className: `p-3 rounded-xl border text-left transition-all flex items-center justify-between group cursor-pointer ${isDark ? "border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20" : "border-black/10 bg-neutral-50/70 hover:bg-neutral-100/90 hover:border-black/20"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "min-w-0 pr-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-xs font-semibold group-hover:text-[#FC4C01] transition-colors",
															children: item.title
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "text-[10px] text-neutral-400 truncate",
															children: item.desc
														})]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform shrink-0" })]
												}, item.path))
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "pt-2 text-[11px] text-neutral-400 flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Contact: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: isDark ? "text-neutral-300" : "text-neutral-700",
													children: "kinich.app@kinich.app"
												})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														window.dispatchEvent(new CustomEvent("kinich-navigate-route", { detail: { path: "/legal" } }));
													},
													className: "text-[#FC4C01] hover:underline font-medium cursor-pointer",
													children: "Open Legal Hub →"
												})]
											})
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "pt-8",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {
									isDark,
									onNavigate: (path) => {
										window.dispatchEvent(new CustomEvent("kinich-navigate-route", { detail: { path } }));
									}
								})
							})
						]
					})
				})
			]
		})]
	});
};
//#endregion
export { AccountWorkspacePage };
