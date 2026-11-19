const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/PeleDiagram-D3kJocGD.js","assets/rolldown-runtime-oLLnCvco.js","assets/react-vendor-BgDBDE3V.js","assets/markdown-katex-uiIk3YnD.js","assets/markdown-katex-BCcB3TC_.css","assets/PrismCodeBlock-DAy3LVm4.js"])))=>i.map(i=>d[i]);
import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { Et as LoaderCircle, Tn as Check, en as ExternalLink, f as X, ln as Copy, zn as ArrowLeft } from "./react-vendor-BgDBDE3V.js";
import { a as remarkGfm, c as require_react, n as rehypeKatex, o as Markdown, r as remarkMath, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { m as getAuthHeaders } from "./firebase-Df8_wQ36.js";
import { t as __vitePreload } from "./preload-helper-C-oUlkXR.js";
import { G as CodeBlockSkeleton, p as extractYouTubeIdFromInput } from "./index-DO79AgMG.js";
//#region src/components/PageExtractModal.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var PeleDiagram = (0, import_react.lazy)(() => __vitePreload(() => import("./PeleDiagram-D3kJocGD.js").then((m) => ({ default: m.PeleDiagram })), __vite__mapDeps([0,1,2,3,4])));
var PrismCodeBlock = (0, import_react.lazy)(() => __vitePreload(() => import("./PrismCodeBlock-DAy3LVm4.js").then((m) => ({ default: m.PrismCodeBlock })), __vite__mapDeps([5,1,2,3,4])));
var INSTACLOUD_API_BASE = "https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com";
async function callKinichEndpoint(path, init) {
	if (typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname.includes("netlify.app"))) return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
	try {
		const localRes = await fetch(path, init);
		const ct = localRes.headers.get("content-type") || "";
		if ((localRes.ok || localRes.status === 400 || localRes.status === 401 || localRes.status === 403 || localRes.status === 429) && ct.includes("application/json")) return localRes;
	} catch {}
	return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
}
/**
* Resolves relative image and anchor URLs inside extracted Markdown
* (including GitHub repository relative paths like `assets/nanogpt.jpg`).
*/
function resolveExtractedAssetUrl(rawUrl, basePageUrl, isImage) {
	if (!rawUrl) return "";
	const trimmed = rawUrl.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:") || trimmed.startsWith("mailto:") || trimmed.startsWith("#")) {
		if (isImage && /^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\//i.test(trimmed)) return trimmed.replace(/^https?:\/\/github\.com\//i, "https://raw.githubusercontent.com/").replace(/\/blob\//, "/");
		return trimmed;
	}
	try {
		const parsedBase = new URL(basePageUrl);
		if (parsedBase.hostname === "github.com" || parsedBase.hostname === "www.github.com") {
			const parts = parsedBase.pathname.split("/").filter(Boolean);
			if (parts.length >= 2) {
				const owner = parts[0];
				const repo = parts[1].replace(/\.git$/i, "");
				let branch = "HEAD";
				let subDir = "";
				if ((parts[2] === "blob" || parts[2] === "tree") && parts[3]) {
					branch = parts[3];
					if (parts.length > 4) {
						const rest = parts.slice(4);
						if (parts[2] === "blob") rest.pop();
						subDir = rest.length > 0 ? `${rest.join("/")}/` : "";
					}
				}
				const cleanRel = trimmed.replace(/^\.\//, "").replace(/^\//, "");
				if (isImage) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${subDir}${cleanRel}`;
				return `https://github.com/${owner}/${repo}/blob/${branch}/${subDir}${cleanRel}`;
			}
		}
		return new URL(trimmed, basePageUrl).toString();
	} catch {
		return trimmed;
	}
}
var PageExtractModal = ({ url: initialUrl, isOpen = false, onClose, isDark = true, selectedModelId = "deepseek-v4.1-flash:free", onChatWithPage }) => {
	const [urlInput, setUrlInput] = (0, import_react.useState)(initialUrl || "");
	const [activeUrl, setActiveUrl] = (0, import_react.useState)(initialUrl || "");
	const [title, setTitle] = (0, import_react.useState)("");
	const [content, setContent] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [copiedSummary, setCopiedSummary] = (0, import_react.useState)(false);
	const [viewMode, setViewMode] = (0, import_react.useState)("rendered");
	const [duration, setDuration] = (0, import_react.useState)(null);
	const [aiSummary, setAiSummary] = (0, import_react.useState)("");
	const [isSummarizing, setIsSummarizing] = (0, import_react.useState)(false);
	const [activeSummaryLens, setActiveSummaryLens] = (0, import_react.useState)("");
	const [customQuestion, setCustomQuestion] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		if (initialUrl) {
			setUrlInput(initialUrl);
			setActiveUrl(initialUrl);
			fetchUrlContent(initialUrl);
		}
	}, [initialUrl]);
	const fetchUrlContent = async (targetUrl) => {
		const cleanUrl = targetUrl.trim();
		if (!cleanUrl) return;
		const normalizedUrl = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`;
		setActiveUrl(normalizedUrl);
		setLoading(true);
		setError(null);
		setContent("");
		setAiSummary("");
		setActiveSummaryLens("");
		setDuration(null);
		const startTime = Date.now();
		try {
			const ytId = extractYouTubeIdFromInput(normalizedUrl);
			if (ytId) try {
				const transcriptRes = await fetch("https://prod-main-transcript-api-6588e7-006jmayjabt.compute.instacloud-edge.com/api/transcript", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ videoId: ytId })
				});
				const ytData = await transcriptRes.json();
				if (transcriptRes.ok && ytData?.success && Array.isArray(ytData.segments) && ytData.segments.length > 0) {
					const ytTitle = ytData.title || `YouTube Video (${ytId})`;
					const formattedMd = `# ${ytTitle}\n\n${ytData.author ? `Channel: ${ytData.author}\n\n` : ""}${ytData.segments.map((s) => s.text || "").join(" ").replace(/\s+/g, " ").trim()}`;
					setContent(formattedMd);
					setTitle(ytTitle);
					setDuration(Date.now() - startTime);
					setLoading(false);
					return;
				}
			} catch {}
			const res = await callKinichEndpoint("/api/treg/extract", {
				method: "POST",
				headers: await getAuthHeaders(),
				body: JSON.stringify({ url: normalizedUrl })
			});
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.error || "Failed to extract content from URL");
			const extractedMd = data.markdown || "No readable text could be extracted from this URL.";
			setContent(extractedMd);
			setTitle(data.title || new URL(normalizedUrl).hostname);
			setDuration(data.durationMs || Date.now() - startTime);
		} catch (err) {
			setError(err.message || "Could not extract URL content.");
		} finally {
			setLoading(false);
		}
	};
	const runPageAiAnalysis = async (lens, customPromptText) => {
		if (!content || isSummarizing) return;
		setIsSummarizing(true);
		setActiveSummaryLens(lens);
		const promptInstruction = lens === "summary" ? "Provide a crisp, high-signal Executive Summary (core thesis, key arguments, and conclusions) of this page." : lens === "takeaways" ? "Extract a bulleted list of the top 7 concrete facts, quantitative metrics, and actionable takeaways from this page." : lens === "technical" ? "Analyze the technical architecture, code structure, API design, or methodology described on this page." : customPromptText || customQuestion || "Summarize this page.";
		try {
			const data = await (await callKinichEndpoint("/api/chat", {
				method: "POST",
				headers: await getAuthHeaders(),
				body: JSON.stringify({
					messages: [{
						role: "user",
						content: `Analyze the following extracted webpage (${activeUrl}):\n\nTitle: ${title}\n\nPage Content:\n${content.slice(0, 14e3)}\n\nTask: ${promptInstruction}`
					}],
					webSearch: false,
					searchMode: "off",
					model: selectedModelId
				})
			})).json();
			if (data?.success && data?.text) setAiSummary(data.text);
			else throw new Error(data?.error || "Failed to analyze page");
		} catch (err) {
			setAiSummary(`Error generating analysis: ${err.message}`);
		} finally {
			setIsSummarizing(false);
		}
	};
	if (!isOpen && !initialUrl) return null;
	const copyToClipboard = () => {
		navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2e3);
	};
	const copySummaryToClipboard = () => {
		if (!aiSummary) return;
		navigator.clipboard.writeText(aiSummary);
		setCopiedSummary(true);
		setTimeout(() => setCopiedSummary(false), 2e3);
	};
	const wordCount = content ? content.trim().split(/\s+/).length : 0;
	const readTimeMin = Math.max(1, Math.ceil(wordCount / 220));
	const renderMarkdownComponents = {
		a: ({ node, href, children, ...props }) => {
			const resolvedHref = resolveExtractedAssetUrl(href, activeUrl, false);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				...props,
				href: resolvedHref,
				target: "_blank",
				rel: "noopener noreferrer",
				className: "underline underline-offset-3 transition-opacity hover:opacity-80 break-words",
				children
			});
		},
		img: ({ node, src, alt, ...props }) => {
			const resolvedSrc = resolveExtractedAssetUrl(src, activeUrl, true);
			if (!resolvedSrc) return null;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				...props,
				src: resolvedSrc,
				alt: alt || "",
				loading: "lazy",
				onError: (e) => {
					e.currentTarget.style.display = "none";
				},
				className: "max-w-full h-auto rounded-xl my-3 border border-black/10 dark:border-white/10"
			});
		},
		table: ({ node, children, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "my-4 w-full max-w-full overflow-x-auto rounded-xl border border-black/10 dark:border-white/10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
				...props,
				className: "w-full border-collapse text-left text-xs sm:text-sm",
				children
			})
		}),
		pre: ({ node, children }) => {
			const child = import_react.Children.toArray(children)[0];
			const childClassName = child?.props?.className || "";
			const childContent = String(child?.props?.children ?? children ?? "").replace(/\n$/, "");
			if (childClassName.includes("language-mermaid") || childClassName.includes("mermaid") || childContent.startsWith("graph ") || childContent.startsWith("flowchart ") || childContent.startsWith("sequenceDiagram")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
				fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlockSkeleton, { isDark }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PeleDiagram, {
					code: childContent,
					isDark
				})
			});
			const matchLang = /language-([\w+-]+)/.exec(childClassName || "");
			const lang = matchLang ? matchLang[1] : "text";
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
				fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlockSkeleton, { isDark }),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrismCodeBlock, {
					language: lang,
					code: childContent,
					isDark
				})
			});
		},
		code: ({ node, className, children, ...props }) => {
			if (!className && !String(children ?? "").includes("\n")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
				...props,
				className: `font-mono text-[0.84em] px-1.5 py-0.5 rounded break-words ${isDark ? "bg-white/[0.08] text-neutral-100" : "bg-black/[0.06] text-neutral-900"}`,
				children
			});
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
				className,
				...props,
				children
			});
		}
	};
	const lensLabel = activeSummaryLens === "takeaways" ? "Key Takeaways" : activeSummaryLens === "technical" ? "Technical Architecture" : activeSummaryLens === "custom" ? "Page Q&A" : "Executive Summary";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden transition-colors ${isDark ? "bg-[#09090b] text-[#fafafa]" : "bg-white text-[#09090b]"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "shrink-0 z-20 bg-transparent transition-colors",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3 min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						className: `size-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${isDark ? "bg-[#121215] hover:bg-white/[0.08] border-white/[0.08] text-white" : "bg-[#f4f4f5] hover:bg-black/[0.06] border-black/[0.08] text-[#09090b]"}`,
						title: "Back",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-4 h-4" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-w-0 flex-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-sm font-semibold tracking-tight truncate",
								children: title || "URL Reader"
							}), wordCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: `hidden sm:inline-block text-[11px] font-mono tabular-nums shrink-0 ${isDark ? "text-neutral-500" : "text-neutral-400"}`,
								children: [
									"· ",
									wordCount.toLocaleString(),
									" words · ",
									readTimeMin,
									"m read"
								]
							})]
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1.5 shrink-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `inline-flex items-center p-0.5 rounded-lg border ${isDark ? "bg-[#121215] border-white/[0.08]" : "bg-[#f4f4f5] border-black/[0.08]"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setViewMode("rendered"),
								className: `px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${viewMode === "rendered" ? isDark ? "bg-white text-black" : "bg-[#09090b] text-white" : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black"}`,
								children: "Reader"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setViewMode("raw"),
								className: `px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${viewMode === "raw" ? isDark ? "bg-white text-black" : "bg-[#09090b] text-white" : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black"}`,
								children: "Raw"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: copyToClipboard,
							disabled: !content || loading,
							className: `size-8 rounded-lg flex items-center justify-center border transition-colors cursor-pointer disabled:opacity-40 ${isDark ? "bg-[#121215] hover:bg-white/[0.08] border-white/[0.08] text-white" : "bg-[#f4f4f5] hover:bg-black/[0.06] border-black/[0.08] text-[#09090b]"}`,
							title: "Copy markdown",
							children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" })
						}),
						activeUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: activeUrl,
							target: "_blank",
							rel: "noopener noreferrer",
							className: `size-8 rounded-lg flex items-center justify-center border transition-colors ${isDark ? "bg-[#121215] hover:bg-white/[0.08] border-white/[0.08] text-white" : "bg-[#f4f4f5] hover:bg-black/[0.06] border-black/[0.08] text-[#09090b]"}`,
							title: "Open source URL",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5" })
						})
					]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "w-full max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-7 min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 mb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "url",
							value: urlInput,
							onChange: (e) => setUrlInput(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") fetchUrlContent(urlInput);
							},
							placeholder: "https://github.com/karpathy/nanoGPT",
							className: `flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-mono outline-none transition-colors ${isDark ? "bg-[#121215] border-white/[0.1] text-white placeholder-neutral-500 focus:border-white/[0.28]" : "bg-[#f4f4f5] border-black/[0.1] text-[#09090b] placeholder-neutral-400 focus:border-black/[0.28]"}`
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => fetchUrlContent(urlInput),
							disabled: loading || !urlInput.trim(),
							className: `px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-40 ${isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-[#09090b] text-white hover:bg-neutral-800"}`,
							children: loading ? "Reading..." : "Read"
						})]
					}),
					content && !loading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-6 space-y-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2 overflow-x-auto scrollbar-none pb-0.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-1.5 shrink-0",
								children: [
									{
										id: "summary",
										label: "Executive Summary"
									},
									{
										id: "takeaways",
										label: "Key Takeaways"
									},
									{
										id: "technical",
										label: "Architecture"
									}
								].map((item) => {
									const isActive = activeSummaryLens === item.id && (Boolean(aiSummary) || isSummarizing);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => runPageAiAnalysis(item.id),
										disabled: isSummarizing,
										className: `px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${isActive ? isDark ? "bg-white text-black border-white" : "bg-[#09090b] text-white border-[#09090b]" : isDark ? "bg-[#121215] border-white/[0.08] text-neutral-300 hover:text-white hover:border-white/[0.18]" : "bg-[#f4f4f5] border-black/[0.08] text-neutral-700 hover:text-black hover:border-black/[0.18]"}`,
										children: item.label
									}, item.id);
								})
							}), onChatWithPage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									onChatWithPage(activeUrl, title, content);
									onClose();
								},
								className: `px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${isDark ? "bg-[#121215] border-white/[0.12] text-white hover:bg-white/[0.08]" : "bg-[#f4f4f5] border-black/[0.12] text-[#09090b] hover:bg-black/[0.06]"}`,
								children: "Continue in Chat"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: customQuestion,
								onChange: (e) => setCustomQuestion(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter" && customQuestion.trim()) {
										runPageAiAnalysis("custom", customQuestion);
										setCustomQuestion("");
									}
								},
								placeholder: "Ask a specific question about this page...",
								className: `flex-1 min-w-0 px-3.5 py-2 rounded-xl border text-xs outline-none transition-colors ${isDark ? "bg-[#121215] border-white/[0.08] text-white placeholder-neutral-500 focus:border-white/[0.22]" : "bg-[#f4f4f5] border-black/[0.08] text-[#09090b] placeholder-neutral-400 focus:border-black/[0.22]"}`
							}), customQuestion.trim() && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									runPageAiAnalysis("custom", customQuestion);
									setCustomQuestion("");
								},
								disabled: isSummarizing,
								className: `px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-[#09090b] text-white hover:bg-neutral-800"}`,
								children: "Ask"
							})]
						})]
					}),
					(isSummarizing || aiSummary) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: `mb-6 p-4 sm:p-5 rounded-2xl border min-w-0 ${isDark ? "bg-[#121215] border-white/[0.1]" : "bg-[#f8f8fa] border-black/[0.1]"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2 pb-3 mb-3 border-b border-black/[0.08] dark:border-white/[0.08]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-semibold tracking-tight truncate",
									children: lensLabel
								}), isSummarizing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-3.5 h-3.5 animate-spin opacity-70 shrink-0" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1 shrink-0",
								children: [aiSummary && !isSummarizing && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: copySummaryToClipboard,
									className: `px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${isDark ? "text-neutral-400 hover:text-white hover:bg-white/[0.06]" : "text-neutral-600 hover:text-black hover:bg-black/[0.05]"}`,
									children: copiedSummary ? "Copied" : "Copy"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										setAiSummary("");
										setActiveSummaryLens("");
									},
									className: `p-1 rounded-md transition-colors cursor-pointer ${isDark ? "text-neutral-400 hover:text-white hover:bg-white/[0.06]" : "text-neutral-500 hover:text-black hover:bg-black/[0.05]"}`,
									title: "Dismiss synthesis",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
								})]
							})]
						}), isSummarizing && !aiSummary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "py-6 flex items-center gap-2.5 text-xs opacity-75",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-4 h-4 animate-spin shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Synthesizing page content..." })]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "prose-grok max-w-none min-w-0 text-xs sm:text-sm leading-relaxed",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, {
								remarkPlugins: [remarkGfm, [remarkMath, { singleDollarTextMath: false }]],
								rehypePlugins: [rehypeKatex],
								components: renderMarkdownComponents,
								children: aiSummary
							})
						})]
					}),
					loading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "py-20 flex flex-col items-center justify-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-5 h-5 animate-spin opacity-70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: `text-xs font-medium ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
							children: "Extracting readable page content..."
						})]
					}),
					error && !loading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `p-4 rounded-xl border text-xs sm:text-sm space-y-1 ${isDark ? "bg-[#121215] border-white/[0.1] text-white" : "bg-[#f4f4f5] border-black/[0.1] text-[#09090b]"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-semibold",
							children: "Unable to extract URL"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: isDark ? "text-neutral-400" : "text-neutral-600",
							children: error
						})]
					}),
					!loading && !error && !content && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "py-12 text-center space-y-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: `text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
							children: "Paste any URL above or select a sample source:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap items-center justify-center gap-2",
							children: [
								"https://github.com/karpathy/nanoGPT",
								"https://en.wikipedia.org/wiki/Quantum_computing",
								"https://arxiv.org/abs/1706.03762"
							].map((sampleUrl) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setUrlInput(sampleUrl);
									fetchUrlContent(sampleUrl);
								},
								className: `px-3 py-1.5 rounded-lg border font-mono text-xs transition-colors cursor-pointer ${isDark ? "bg-[#121215] border-white/[0.08] hover:border-white/[0.2] text-neutral-300 hover:text-white" : "bg-[#f4f4f5] border-black/[0.08] hover:border-black/[0.2] text-neutral-700 hover:text-black"}`,
								children: sampleUrl.replace(/^https?:\/\//, "")
							}, sampleUrl))
						})]
					}),
					!loading && !error && content && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "min-w-0 max-w-full",
						children: [(activeUrl || wordCount > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono pb-4 mb-5 border-b ${isDark ? "text-neutral-500 border-white/[0.08]" : "text-neutral-500 border-black/[0.08]"}`,
							children: [
								activeUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate max-w-[240px] sm:max-w-md",
									children: activeUrl
								}),
								wordCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "tabular-nums",
										children: [wordCount.toLocaleString(), " words"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "tabular-nums",
										children: [readTimeMin, " min read"]
									})
								] }),
								duration !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "tabular-nums",
									children: [duration, "ms"]
								})] })
							]
						}), viewMode === "rendered" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "prose-grok max-w-none min-w-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, {
								remarkPlugins: [remarkGfm, [remarkMath, { singleDollarTextMath: false }]],
								rehypePlugins: [rehypeKatex],
								components: renderMarkdownComponents,
								children: content
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
							className: `font-mono text-xs p-4 rounded-xl border whitespace-pre-wrap break-words leading-relaxed min-w-0 max-w-full ${isDark ? "bg-[#121215] border-white/[0.08] text-neutral-200" : "bg-[#f8f8fa] border-black/[0.08] text-[#09090b]"}`,
							children: content
						})]
					})
				]
			})
		})]
	});
};
//#endregion
export { PageExtractModal };
