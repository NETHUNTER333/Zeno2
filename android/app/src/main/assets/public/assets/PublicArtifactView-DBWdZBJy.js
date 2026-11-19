import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { $t as ExternalLink, f as X } from "./react-vendor-ZF-Fgzq4.js";
import { a as remarkGfm, c as require_react, n as rehypeKatex, o as Markdown, r as remarkMath, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { n as auth } from "./firebase-Df8_wQ36.js";
import { D as deletePublicArtifact, F as recordArtifactInteraction, I as reportPublicArtifact, M as fetchPublicArtifactById, O as fetchCreatorPublicProfile, R as trackGrowthEvent, x as KnowledgeVaultStore, z as updatePublicArtifact } from "./index-DaFzEGR-.js";
import { downloadQuoteCardPng } from "./exportChat-BvquFsMZ.js";
//#region src/components/PublicArtifactView.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function normalizeLatexDelimiters(raw) {
	if (!raw) return "";
	return raw.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n$$${inner.trim()}$$\n`).replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
}
var PublicArtifactView = ({ artifactId, initialArtifact = null, isOpen, onClose, onForkIntoChat, isDark = true }) => {
	const [artifact, setArtifact] = (0, import_react.useState)(initialArtifact);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [copiedUrl, setCopiedUrl] = (0, import_react.useState)(false);
	const [isBookmarked, setIsBookmarked] = (0, import_react.useState)(false);
	const [isEditing, setIsEditing] = (0, import_react.useState)(false);
	const [editTitle, setEditTitle] = (0, import_react.useState)("");
	const [editSummary, setEditSummary] = (0, import_react.useState)("");
	const [editContent, setEditContent] = (0, import_react.useState)("");
	const [savingEdit, setSavingEdit] = (0, import_react.useState)(false);
	const [showReportForm, setShowReportForm] = (0, import_react.useState)(false);
	const [reportReason, setReportReason] = (0, import_react.useState)("Inaccurate or misleading content");
	const [reportDetails, setReportDetails] = (0, import_react.useState)("");
	const [reportSubmitted, setReportSubmitted] = (0, import_react.useState)(false);
	const [creatorProfile, setCreatorProfile] = (0, import_react.useState)(null);
	const [loadingCreator, setLoadingCreator] = (0, import_react.useState)(false);
	const currentUid = auth.currentUser?.uid || "";
	const isOwner = Boolean(artifact && currentUid && artifact.ownerId === currentUid);
	(0, import_react.useEffect)(() => {
		if (!isOpen) return;
		setCreatorProfile(null);
		setShowReportForm(false);
		setReportSubmitted(false);
		setIsEditing(false);
		const targetId = artifactId || initialArtifact?.id;
		if (!targetId) {
			setError("Invalid resource identifier.");
			return;
		}
		if (initialArtifact && initialArtifact.id === targetId) {
			setArtifact(initialArtifact);
			setIsBookmarked(KnowledgeVaultStore.isArtifactBookmarked(initialArtifact.id));
			setError(null);
			recordArtifactInteraction(targetId, "view");
			trackGrowthEvent("public_artifact_opened", { artifactId: targetId });
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		fetchPublicArtifactById(targetId).then((loaded) => {
			if (cancelled) return;
			if (!loaded) {
				setArtifact(null);
				setError("This Kinich page is unavailable, has been set to private by its creator, or does not exist.");
			} else {
				setArtifact(loaded);
				setIsBookmarked(KnowledgeVaultStore.isArtifactBookmarked(loaded.id));
				recordArtifactInteraction(loaded.id, "view");
				trackGrowthEvent("public_artifact_opened", { artifactId: loaded.id });
			}
		}).catch(() => {
			if (!cancelled) setError("Could not load this Kinich page.");
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [
		isOpen,
		artifactId,
		initialArtifact
	]);
	const formattedMarkdown = (0, import_react.useMemo)(() => normalizeLatexDelimiters(artifact?.content || ""), [artifact?.content]);
	if (!isOpen) return null;
	const pageUrl = (() => {
		const u = new URL(window.location.origin + window.location.pathname);
		if (artifact?.id) u.searchParams.set("artifact", artifact.id);
		return u.toString();
	})();
	const handleCopyLink = () => {
		navigator.clipboard.writeText(pageUrl);
		setCopiedUrl(true);
		if (artifact) {
			recordArtifactInteraction(artifact.id, "share");
			trackGrowthEvent("share_action_initiated", {
				surface: "public_artifact_page",
				artifactId: artifact.id
			});
		}
		setTimeout(() => setCopiedUrl(false), 2e3);
	};
	const handleToggleBookmark = () => {
		if (!artifact) return;
		const saved = KnowledgeVaultStore.toggleBookmarkFromArtifact(artifact);
		setIsBookmarked(saved);
		if (saved) recordArtifactInteraction(artifact.id, "save");
	};
	const handleFork = () => {
		if (!artifact) return;
		recordArtifactInteraction(artifact.id, "cta");
		onForkIntoChat(artifact);
		onClose();
	};
	const handleToggleVisibility = async () => {
		if (!artifact || !isOwner) return;
		const nextVis = artifact.visibility === "public" ? "private" : "public";
		const updated = await updatePublicArtifact(artifact.id, { visibility: nextVis });
		if (updated) setArtifact(updated);
	};
	const handleStartEdit = () => {
		if (!artifact) return;
		setEditTitle(artifact.title);
		setEditSummary(artifact.summary);
		setEditContent(artifact.content);
		setIsEditing(true);
	};
	const handleSaveEdit = async () => {
		if (!artifact || !editTitle.trim() || !editContent.trim()) return;
		setSavingEdit(true);
		try {
			const updated = await updatePublicArtifact(artifact.id, {
				title: editTitle.trim(),
				summary: editSummary.trim(),
				content: editContent.trim()
			});
			if (updated) {
				setArtifact(updated);
				setIsEditing(false);
			}
		} finally {
			setSavingEdit(false);
		}
	};
	const handleDelete = async () => {
		if (!artifact || !isOwner) return;
		if (await deletePublicArtifact(artifact.id)) onClose();
	};
	const handleSubmitReport = async () => {
		if (!artifact) return;
		if (await reportPublicArtifact(artifact.id, reportReason, reportDetails)) {
			setReportSubmitted(true);
			setTimeout(() => {
				setShowReportForm(false);
				setReportSubmitted(false);
				setReportDetails("");
			}, 1800);
		}
	};
	const handleOpenCreatorProfile = async () => {
		if (!artifact || !artifact.ownerId || artifact.ownerId === "system_kinich") return;
		setLoadingCreator(true);
		try {
			const data = await fetchCreatorPublicProfile(artifact.ownerId);
			setCreatorProfile(data);
		} finally {
			setLoadingCreator(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden animate-in fade-in duration-150 ${isDark ? "bg-[#09090b] text-white" : "bg-white text-[#09090b]"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "px-4 sm:px-6 py-3 bg-transparent flex flex-wrap items-center justify-between gap-2.5 shrink-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						className: `px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer shrink-0 ${isDark ? "border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200" : "border-black/[0.12] bg-black/[0.03] hover:bg-black/[0.06] text-neutral-800"}`,
						children: "Back"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `px-2.5 py-1 rounded-full text-[11px] font-medium truncate ${isDark ? "bg-white/[0.06] text-neutral-300 border border-white/[0.08]" : "bg-neutral-100 text-neutral-700 border border-black/[0.08]"}`,
						children: artifact?.category || "Kinich Page"
					}),
					artifact && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `hidden sm:inline-block text-[11px] ${isDark ? "text-neutral-500" : "text-neutral-500"}`,
						children: artifact.visibility === "public" ? "Public Page" : "Private Page"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5 shrink-0",
				children: [artifact && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: handleToggleBookmark,
						className: `px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${isBookmarked ? isDark ? "bg-white text-black border-white font-semibold" : "bg-neutral-900 text-white border-neutral-900 font-semibold" : isDark ? "border-white/[0.12] hover:bg-white/[0.06] text-neutral-300" : "border-black/[0.12] hover:bg-black/[0.04] text-neutral-700"}`,
						children: isBookmarked ? "Saved" : "Save"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: handleCopyLink,
						className: `px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${isDark ? "border-white/[0.12] hover:bg-white/[0.06] text-neutral-300" : "border-black/[0.12] hover:bg-black/[0.04] text-neutral-700"}`,
						children: copiedUrl ? "Copied" : "Share"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: handleFork,
						className: `px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-neutral-900 text-white hover:bg-neutral-800"}`,
						children: "Fork in Kinich"
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					className: `p-1.5 rounded-full transition-colors cursor-pointer ${isDark ? "hover:bg-white/[0.08] text-neutral-400 hover:text-white" : "hover:bg-black/[0.06] text-neutral-500 hover:text-black"}`,
					"aria-label": "Close",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "max-w-3xl mx-auto space-y-6",
				children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "py-16 text-center text-sm text-neutral-500",
					children: "Loading page…"
				}) : error || !artifact ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "py-16 max-w-md mx-auto text-center space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "text-base font-semibold",
						children: "Page Unavailable"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-neutral-500 leading-relaxed",
						children: error || "This resource does not exist or is currently private."
					})]
				}) : isEditing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-sm font-semibold",
							children: "Edit Kinich Page"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs text-neutral-500 mb-1",
							children: "Title"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: editTitle,
							onChange: (e) => setEditTitle(e.target.value),
							className: `w-full px-3.5 py-2 rounded-xl border text-sm outline-none ${isDark ? "bg-[#121215] border-white/[0.1] text-white" : "bg-[#f8f8fa] border-black/[0.1] text-neutral-900"}`
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs text-neutral-500 mb-1",
							children: "Summary"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: editSummary,
							onChange: (e) => setEditSummary(e.target.value),
							className: `w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-[#121215] border-white/[0.1] text-white" : "bg-[#f8f8fa] border-black/[0.1] text-neutral-900"}`
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs text-neutral-500 mb-1",
							children: "Content (Markdown & LaTeX)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							rows: 14,
							value: editContent,
							onChange: (e) => setEditContent(e.target.value),
							className: `w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none ${isDark ? "bg-[#121215] border-white/[0.1] text-neutral-200" : "bg-[#f8f8fa] border-black/[0.1] text-neutral-900"}`
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-end gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setIsEditing(false),
								className: "px-3.5 py-1.5 rounded-full text-xs text-neutral-500 hover:text-current cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: savingEdit,
								onClick: handleSaveEdit,
								className: `px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${isDark ? "bg-white text-black" : "bg-neutral-900 text-white"}`,
								children: savingEdit ? "Saving…" : "Save Changes"
							})]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `space-y-3 border-b pb-5 ${isDark ? "border-white/[0.08]" : "border-black/[0.08]"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-xl sm:text-2xl font-bold tracking-tight leading-snug",
								children: artifact.title
							}),
							artifact.summary && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: `text-sm leading-relaxed ${isDark ? "text-neutral-400" : "text-neutral-600"}`,
								children: artifact.summary
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-neutral-500",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2.5",
									children: [
										artifact.showAuthorAttribution && artifact.authorName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleOpenCreatorProfile,
											className: "hover:underline transition-colors cursor-pointer font-medium",
											children: artifact.authorName
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" })] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: new Date(artifact.createdAt).toLocaleDateString("en-US", {
											month: "short",
											day: "numeric",
											year: "numeric"
										}) }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [artifact.viewsCount || 1, " views"] })
									]
								}), isOwner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleToggleVisibility,
											className: `px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${isDark ? "border-white/[0.12] hover:bg-white/[0.05]" : "border-black/[0.12] hover:bg-black/[0.04]"}`,
											children: artifact.visibility === "public" ? "Make Private" : "Make Public"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleStartEdit,
											className: `px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${isDark ? "border-white/[0.12] hover:bg-white/[0.05]" : "border-black/[0.12] hover:bg-black/[0.04]"}`,
											children: "Edit"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleDelete,
											className: `px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${isDark ? "border-white/[0.12] text-neutral-400 hover:text-white" : "border-black/[0.12] text-neutral-600 hover:text-black"}`,
											children: "Delete"
										})
									]
								})]
							}),
							artifact.tags && artifact.tags.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1.5 pt-1",
								children: artifact.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: `px-2.5 py-0.5 rounded-full text-[11px] ${isDark ? "bg-white/[0.05] text-neutral-300 border border-white/[0.08]" : "bg-neutral-100 text-neutral-700 border border-black/[0.08]"}`,
									children: ["#", tag]
								}, tag))
							})
						]
					}),
					loadingCreator && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-neutral-500",
						children: "Loading creator profile…"
					}),
					creatorProfile && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `p-4 rounded-2xl border space-y-1.5 ${isDark ? "bg-[#121215] border-white/[0.08]" : "bg-[#f8f8fa] border-black/[0.08]"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs font-semibold",
									children: creatorProfile.profile.displayName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setCreatorProfile(null),
									className: "text-[11px] text-neutral-500 hover:text-current cursor-pointer",
									children: "Close"
								})]
							}),
							creatorProfile.profile.bio && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-neutral-500",
								children: creatorProfile.profile.bio
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[11px] text-neutral-500",
								children: ["Published public resources: ", creatorProfile.artifacts.length]
							})
						]
					}),
					artifact.promptText && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `p-4 rounded-2xl border ${isDark ? "bg-[#121215] border-white/[0.08]" : "bg-[#f8f8fa] border-black/[0.08]"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] uppercase tracking-wider text-neutral-500 mb-1",
							children: "Research Question"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-medium",
							children: artifact.promptText
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "prose-grok max-w-none text-sm sm:text-[15px] leading-relaxed",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, {
							remarkPlugins: [remarkGfm, [remarkMath, { singleDollarTextMath: false }]],
							rehypePlugins: [rehypeKatex],
							components: {
								table: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `w-full overflow-x-auto my-4 rounded-xl border ${isDark ? "border-white/[0.1]" : "border-black/[0.1]"}`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
										className: "!m-0 !display-table w-full min-w-[540px] border-collapse text-xs sm:text-sm",
										children
									})
								}),
								th: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: `px-3.5 py-2.5 text-left font-semibold whitespace-nowrap border-b ${isDark ? "bg-[#141418] text-white border-white/[0.1]" : "bg-[#f4f4f6] text-neutral-900 border-black/[0.1]"}`,
									children
								}),
								td: ({ children }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: `px-3.5 py-2.5 align-top border-b ${isDark ? "border-white/[0.06] text-neutral-200" : "border-black/[0.06] text-neutral-800"}`,
									children
								})
							},
							children: formattedMarkdown
						})
					}),
					artifact.sources && artifact.sources.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `pt-5 border-t space-y-2.5 ${isDark ? "border-white/[0.08]" : "border-black/[0.08]"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
							className: "text-xs uppercase tracking-wider text-neutral-500 font-medium",
							children: [
								"Cited References (",
								artifact.sources.length,
								")"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-1 sm:grid-cols-2 gap-2",
							children: artifact.sources.map((src, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: src.url,
								target: "_blank",
								rel: "noopener noreferrer",
								className: `p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${isDark ? "bg-[#121215] border-white/[0.08] hover:border-white/[0.22]" : "bg-[#f8f8fa] border-black/[0.08] hover:border-black/[0.22]"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "truncate font-medium",
									children: [
										"[",
										idx + 1,
										"] ",
										src.title || src.domain || src.url
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5 shrink-0 opacity-50" })]
							}, idx))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isDark ? "bg-[#121215] border-white/[0.08]" : "bg-[#f8f8fa] border-black/[0.08]"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-semibold",
							children: "Continue researching this topic in Kinich"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-neutral-500 mt-0.5",
							children: "Fork this page into an interactive session, run deep verification, or generate study cards."
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => downloadQuoteCardPng({
									title: artifact.title,
									promptText: artifact.promptText,
									answerText: artifact.summary || artifact.content,
									modelName: artifact.modelUsed || "Kinich Synthesis",
									sourcesCount: artifact.sources?.length || 0,
									authorName: artifact.showAuthorAttribution ? artifact.authorName : void 0,
									theme: "carbon"
								}),
								className: `px-3.5 py-2 rounded-full border text-xs font-medium cursor-pointer ${isDark ? "border-white/[0.12] hover:bg-white/[0.06] text-neutral-200" : "border-black/[0.12] hover:bg-black/[0.04] text-neutral-800"}`,
								children: "Share Card PNG"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handleFork,
								className: `px-4 py-2 rounded-full text-xs font-semibold cursor-pointer ${isDark ? "bg-white text-black" : "bg-neutral-900 text-white"}`,
								children: "Open in Kinich"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between text-[11px] text-neutral-500 pt-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Published via Kinich" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setShowReportForm((v) => !v),
							className: "hover:underline cursor-pointer",
							children: "Report content"
						})]
					}),
					showReportForm && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `p-4 rounded-2xl border space-y-3 text-xs ${isDark ? "bg-[#121215] border-white/[0.08]" : "bg-[#f8f8fa] border-black/[0.08]"}`,
						children: reportSubmitted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-medium",
							children: "Thank you. Your report has been recorded for moderation review."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-semibold",
								children: "Report Public Resource"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: reportReason,
								onChange: (e) => setReportReason(e.target.value),
								className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-[#09090b] border-white/[0.12] text-white" : "bg-white border-black/[0.12] text-neutral-900"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Inaccurate or misleading content",
										children: "Inaccurate or misleading content"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Spam or promotional abuse",
										children: "Spam or promotional abuse"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Exposes private or personal information",
										children: "Exposes private or personal information"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "Harmful or inappropriate material",
										children: "Harmful or inappropriate material"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: reportDetails,
								onChange: (e) => setReportDetails(e.target.value),
								placeholder: "Optional additional context…",
								className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-[#09090b] border-white/[0.12] text-white" : "bg-white border-black/[0.12] text-neutral-900"}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-end gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setShowReportForm(false),
									className: "px-3 py-1.5 rounded-full text-neutral-500 cursor-pointer",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: handleSubmitReport,
									className: `px-4 py-1.5 rounded-full font-semibold cursor-pointer ${isDark ? "bg-white text-black" : "bg-neutral-900 text-white"}`,
									children: "Submit Report"
								})]
							})
						] })
					})
				] })
			})
		})]
	});
};
//#endregion
export { PublicArtifactView };
