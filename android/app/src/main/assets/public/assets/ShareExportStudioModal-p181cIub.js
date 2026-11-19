import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { $t as EyeOff, Et as LoaderCircle, L as Sparkles, Rt as Globe, Sn as ChevronRight, Tn as Check, Tt as Lock, en as ExternalLink, f as X, kt as Link2, ln as Copy } from "./react-vendor-BgDBDE3V.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { O as publishSharedThreadToFirestore } from "./firebase-Df8_wQ36.js";
import { R as trackGrowthEvent } from "./index-DO79AgMG.js";
//#region src/components/ShareExportStudioModal.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function cleanMarkdownPreview(raw) {
	return (raw || "").replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").replace(/```[\s\S]*?```/g, "").replace(/^#{1,6}\s+/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\[(\d+)\]/g, "").replace(/\s+/g, " ").trim();
}
var ShareExportStudioModal = ({ isOpen, onClose, thread, initialMessageId = null, initialQuoteMessage = null, initialTab = "quote", isDark = true, onOpenReadOnlyPreview }) => {
	const [shareScope, setShareScope] = (0, import_react.useState)("response");
	const [expiry, setExpiry] = (0, import_react.useState)("2 Days");
	const [shareUrl, setShareUrl] = (0, import_react.useState)("");
	const [shareId, setShareId] = (0, import_react.useState)("");
	const [isCreatingLink, setIsCreatingLink] = (0, import_react.useState)(false);
	const [copiedLink, setCopiedLink] = (0, import_react.useState)(false);
	const assistantMessages = (0, import_react.useMemo)(() => {
		if (!thread) return [];
		return thread.messages.filter((m) => m.role === "assistant" && m.content?.trim());
	}, [thread]);
	const targetInitialMsgId = initialQuoteMessage?.id || initialMessageId || "";
	const lastAssistantMsgId = assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1].id : "";
	const [selectedAssistantId, setSelectedAssistantId] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (isOpen) {
			const defaultScope = initialTab === "share" && !initialQuoteMessage && !initialMessageId ? "chat" : "response";
			setShareScope(defaultScope);
			setExpiry(defaultScope === "response" ? "2 Days" : "7 Days");
			setShareUrl("");
			setShareId("");
			setCopiedLink(false);
			if (targetInitialMsgId && assistantMessages.some((m) => m.id === targetInitialMsgId)) setSelectedAssistantId(targetInitialMsgId);
			else if (lastAssistantMsgId) setSelectedAssistantId(lastAssistantMsgId);
		}
	}, [
		isOpen,
		initialTab,
		targetInitialMsgId,
		lastAssistantMsgId,
		initialQuoteMessage,
		initialMessageId,
		assistantMessages
	]);
	const selectedExchange = (0, import_react.useMemo)(() => {
		if (!thread) return null;
		if (selectedAssistantId) {
			const idx = thread.messages.findIndex((m) => m.id === selectedAssistantId);
			if (idx !== -1) {
				const assistantMsg = thread.messages[idx];
				const prevUserMsg = idx > 0 && thread.messages[idx - 1]?.role === "user" ? thread.messages[idx - 1] : null;
				return {
					userMsg: prevUserMsg,
					assistantMsg,
					promptText: prevUserMsg?.content || thread.title || ""
				};
			}
		}
		if (initialQuoteMessage) {
			const idx = thread.messages.findIndex((m) => m.id === initialQuoteMessage.id);
			const prevUserMsg = idx > 0 && thread.messages[idx - 1]?.role === "user" ? thread.messages[idx - 1] : null;
			return {
				userMsg: prevUserMsg,
				assistantMsg: initialQuoteMessage,
				promptText: prevUserMsg?.content || thread.title || ""
			};
		}
		if (assistantMessages.length > 0) {
			const lastA = assistantMessages[assistantMessages.length - 1];
			const idx = thread.messages.findIndex((m) => m.id === lastA.id);
			const prevUserMsg = idx > 0 && thread.messages[idx - 1]?.role === "user" ? thread.messages[idx - 1] : null;
			return {
				userMsg: prevUserMsg,
				assistantMsg: lastA,
				promptText: prevUserMsg?.content || thread.title || ""
			};
		}
		return null;
	}, [
		thread,
		selectedAssistantId,
		initialQuoteMessage,
		assistantMessages
	]);
	const handleCreateShareLink = (0, import_react.useCallback)(async () => {
		if (!thread || thread.messages.length === 0 || isCreatingLink) return;
		setIsCreatingLink(true);
		const payloadThread = shareScope === "response" && selectedExchange ? {
			...thread,
			title: selectedExchange.promptText.slice(0, 80) || thread.title,
			messages: [...selectedExchange.userMsg ? [selectedExchange.userMsg] : [], selectedExchange.assistantMsg]
		} : thread;
		try {
			const publishPromise = publishSharedThreadToFirestore(payloadThread);
			const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(/* @__PURE__ */ new Error("Share timeout")), 6500));
			const id = await Promise.race([publishPromise, timeoutPromise]);
			const finalUrl = `${window.location.origin}/?share=${encodeURIComponent(id)}`;
			setShareId(id);
			setShareUrl(finalUrl);
			await navigator.clipboard.writeText(finalUrl).catch(() => {});
			setCopiedLink(true);
			trackGrowthEvent("share_action_initiated", {
				scope: shareScope,
				expiry
			});
			setTimeout(() => setCopiedLink(false), 3e3);
		} catch {
			const fallbackId = `sh_${Date.now().toString(36)}`;
			const finalUrl = `${window.location.origin}/?share=${fallbackId}`;
			setShareId(fallbackId);
			setShareUrl(finalUrl);
			await navigator.clipboard.writeText(finalUrl).catch(() => {});
			setCopiedLink(true);
			setTimeout(() => setCopiedLink(false), 3e3);
		} finally {
			setIsCreatingLink(false);
		}
	}, [
		thread,
		shareScope,
		selectedExchange,
		expiry,
		isCreatingLink
	]);
	if (!isOpen || !thread) return null;
	const responseAnswerText = cleanMarkdownPreview(selectedExchange?.assistantMsg?.content || "");
	const responseSources = selectedExchange?.assistantMsg?.sources || [];
	const responseModelName = selectedExchange?.assistantMsg?.modelUsed || "DeepSeek V4.1 Flash";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-150",
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			onClick: (e) => e.stopPropagation(),
			className: `w-full sm:max-w-[430px] rounded-t-[28px] sm:rounded-[28px] border p-5 sm:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.85)] max-h-[92dvh] overflow-y-auto no-scrollbar ${isDark ? "bg-[#141416] border-white/[0.08] text-[#f5f5f7]" : "bg-white border-black/[0.08] text-[#111827]"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between mb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-[20px] font-semibold tracking-tight",
						children: "Share"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						"aria-label": "Close share modal",
						className: `size-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${isDark ? "text-neutral-400 hover:text-white hover:bg-white/10" : "text-neutral-500 hover:text-black hover:bg-black/5"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-5 h-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `grid grid-cols-2 gap-1 p-1 rounded-full border mb-4 ${isDark ? "bg-[#252529] border-white/[0.06]" : "bg-neutral-100 border-black/[0.06]"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							setShareScope("response");
							setExpiry("2 Days");
							setShareUrl("");
						},
						className: `flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-full text-[14px] font-semibold transition-all cursor-pointer ${shareScope === "response" ? isDark ? "bg-[#141416] text-white border border-white/[0.12] shadow-sm" : "bg-white text-black border border-black/[0.08] shadow-sm" : isDark ? "text-neutral-300 hover:text-white border border-transparent" : "text-neutral-600 hover:text-black border border-transparent"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
							width: "26",
							height: "22",
							viewBox: "0 0 28 24",
							fill: "none",
							className: "shrink-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
									cx: "17.5",
									cy: "9.5",
									rx: "7.5",
									ry: "6",
									fill: isDark ? "#f4f4f6" : "#d4d4d8"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
									d: "M22 13.5L24.5 16L20 14.8Z",
									fill: isDark ? "#f4f4f6" : "#d4d4d8"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
									cx: "11.5",
									cy: "14",
									rx: "7.5",
									ry: "6",
									fill: "#1d9bf0"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
									d: "M6.5 17.5L4 20.5L9 19Z",
									fill: "#1d9bf0"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
									x: "8",
									y: "12.2",
									width: "7",
									height: "1.3",
									rx: "0.65",
									fill: "#0b2545",
									opacity: "0.55"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
									x: "8",
									y: "14.5",
									width: "5",
									height: "1.3",
									rx: "0.65",
									fill: "#0b2545",
									opacity: "0.55"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Response" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							setShareScope("chat");
							setExpiry("7 Days");
							setShareUrl("");
						},
						className: `flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-full text-[14px] font-semibold transition-all cursor-pointer ${shareScope === "chat" ? isDark ? "bg-[#141416] text-white border border-white/[0.12] shadow-sm" : "bg-white text-black border border-black/[0.08] shadow-sm" : isDark ? "text-neutral-300 hover:text-white border border-transparent" : "text-neutral-600 hover:text-black border border-transparent"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
							width: "26",
							height: "22",
							viewBox: "0 0 28 24",
							fill: "none",
							className: "shrink-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
									cx: "17.5",
									cy: "9.5",
									rx: "7.5",
									ry: "6",
									fill: "#1d9bf0"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
									d: "M22 13.5L24.5 16L20 14.8Z",
									fill: "#1d9bf0"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
									x: "14",
									y: "7.8",
									width: "7",
									height: "1.3",
									rx: "0.65",
									fill: "#0b2545",
									opacity: "0.55"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
									x: "14",
									y: "10.1",
									width: "5",
									height: "1.3",
									rx: "0.65",
									fill: "#0b2545",
									opacity: "0.55"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", {
									cx: "11.5",
									cy: "14.5",
									rx: "7.5",
									ry: "6",
									fill: "#38bdf8"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
									d: "M6.5 18L4 21L9 19.5Z",
									fill: "#38bdf8"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
									x: "8",
									y: "12.8",
									width: "7",
									height: "1.3",
									rx: "0.65",
									fill: "#0b2545",
									opacity: "0.55"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
									x: "8",
									y: "15.1",
									width: "5",
									height: "1.3",
									rx: "0.65",
									fill: "#0b2545",
									opacity: "0.55"
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Entire Chat" })]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `relative rounded-[22px] border p-4 mb-3.5 overflow-hidden ${isDark ? "bg-[#1b1b1f] border-white/[0.1]" : "bg-neutral-50 border-black/[0.08]"}`,
					children: [shareScope === "response" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3",
						children: [
							selectedExchange?.promptText && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `rounded-[18px] rounded-tr-[4px] px-4 py-2.5 text-[14px] leading-snug line-clamp-2 ${isDark ? "bg-[#2b2b30] text-white/95" : "bg-neutral-200/80 text-neutral-900"}`,
								children: selectedExchange.promptText
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 pt-0.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `size-5 rounded-full flex items-center justify-center border ${isDark ? "border-white/15 bg-white/5 text-white/85" : "border-black/15 bg-black/5 text-black/80"}`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3 h-3" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[13px] font-semibold opacity-90",
									children: responseModelName
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[14px] leading-[21px] opacity-95 line-clamp-3",
								children: responseAnswerText || "No response content."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `text-[13px] font-medium ${isDark ? "text-neutral-300" : "text-neutral-600"}`,
								children: "Read More"
							}),
							responseSources.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pr-12",
								children: responseSources.slice(0, 3).map((src, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `flex items-center gap-2.5 rounded-2xl border px-3 py-2 min-w-[195px] max-w-[220px] shrink-0 ${isDark ? "bg-[#232328] border-white/[0.07]" : "bg-white border-black/[0.08]"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `size-5 rounded-full flex items-center justify-center shrink-0 ${isDark ? "bg-white/15 text-white/80" : "bg-black/10 text-black/75"}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "w-3 h-3" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[12.5px] font-medium truncate",
											children: src.title || src.domain
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] opacity-55 truncate",
											children: src.domain
										})]
									})]
								}, idx))
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-h-[210px] overflow-hidden relative space-y-3 pr-2",
						children: [thread.messages.slice(0, 4).map((m) => m.role === "user" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `rounded-[18px] rounded-tr-[4px] px-4 py-2.5 text-[14px] leading-snug line-clamp-2 ${isDark ? "bg-[#2b2b30] text-white/95" : "bg-neutral-200/80 text-neutral-900"}`,
							children: m.content
						}, m.id) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-1.5 py-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `size-5 rounded-full flex items-center justify-center border ${isDark ? "border-white/15 bg-white/5 text-white/85" : "border-black/15 bg-black/5 text-black/80"}`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3 h-3" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[13px] font-semibold opacity-90",
									children: m.modelUsed || "DeepSeek V4.1 Flash"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[14px] leading-[21px] opacity-90 line-clamp-2",
								children: cleanMarkdownPreview(m.content)
							})]
						}, m.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t ${isDark ? "from-[#1b1b1f] via-[#1b1b1f]/75 to-transparent" : "from-neutral-50 via-neutral-50/75 to-transparent"}` })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute bottom-3 right-3 z-10 size-11 rounded-full bg-gradient-to-br from-[#ff7b00] to-[#ee3500] ring-2 ring-white shadow-lg flex items-center justify-center select-none pointer-events-none",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[20px] leading-none drop-shadow",
							children: "🔥"
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `rounded-[20px] p-4 mb-4 space-y-3 text-[13.5px] leading-[19px] ${isDark ? "bg-[#1b1b1f] text-neutral-200" : "bg-neutral-100 text-neutral-700"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-4 h-4 shrink-0 mt-0.5 opacity-80" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Creates a copy of the chat that can be viewed and saved by anyone who opens the link." })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-4 h-4 shrink-0 mt-0.5 opacity-80" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Encrypted. Not even Kinich can read your chat." })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "w-4 h-4 shrink-0 mt-0.5 opacity-80" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Follow-ups remain private." })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `text-[13.5px] font-medium mb-2.5 ${isDark ? "text-neutral-200" : "text-neutral-700"}`,
						children: "Link expires in"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2 flex-wrap",
						children: [
							"1 Day",
							"2 Days",
							"7 Days",
							"30 Days"
						].map((opt) => {
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setExpiry(opt),
								className: `px-4 py-1.5 rounded-full text-[13.5px] font-semibold border transition-all cursor-pointer ${expiry === opt ? isDark ? "border-[#5ea1ff] bg-[#5ea1ff]/15 text-white" : "border-[#2563eb] bg-[#2563eb]/10 text-[#1d4ed8]" : isDark ? "border-white/10 bg-[#252529] text-neutral-200 hover:bg-[#2f2f34]" : "border-black/10 bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`,
								children: opt
							}, opt);
						})
					})]
				}),
				shareUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `mb-3.5 flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs ${isDark ? "bg-[#1b1b1f] border-white/10 text-neutral-200" : "bg-neutral-100 border-black/10 text-neutral-800"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate flex-1 font-mono",
							children: shareUrl
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: async () => {
								await navigator.clipboard.writeText(shareUrl).catch(() => {});
								setCopiedLink(true);
								setTimeout(() => setCopiedLink(false), 2e3);
							},
							className: "p-1.5 rounded-lg hover:bg-white/10 cursor-pointer shrink-0",
							title: "Copy link",
							children: copiedLink ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 text-emerald-400" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" })
						}),
						onOpenReadOnlyPreview && shareId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onOpenReadOnlyPreview(shareId, thread),
							className: "p-1.5 rounded-lg hover:bg-white/10 cursor-pointer shrink-0",
							title: "Open shared preview",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5" })
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: handleCreateShareLink,
					disabled: isCreatingLink,
					className: "w-full rounded-full bg-[#5ea1ff] hover:bg-[#4d95ff] active:scale-[0.99] text-[#090d16] font-semibold text-[15px] py-3.5 px-5 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 shadow-lg",
					children: isCreatingLink ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-4 h-4 animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Creating Share Link..." })] }) : copiedLink ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 stroke-[2.4]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Share Link Copied!" })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link2, { className: "w-4 h-4 stroke-[2.2]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Create Share Link" })] })
				})
			]
		})
	});
};
//#endregion
export { ShareExportStudioModal, ShareExportStudioModal as default };
