import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { F as Star, Gt as FolderOpen, J as Share2, Tt as Lock, Vt as GitBranch, Xt as FileText, Z as Search, en as ExternalLink, f as X, jn as BookOpen, nt as RefreshCw, ot as Play, v as Upload, w as Trash2, yt as MessageSquare } from "./react-vendor-BgDBDE3V.js";
import { a as remarkGfm, c as require_react, n as rehypeKatex, o as Markdown, r as remarkMath, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { n as auth } from "./firebase-Df8_wQ36.js";
import { A as fetchMyReferralStatus, B as fetchUserReferralDashboard, C as VaultThreadStore, E as claimReferralCodeManual, F as recordArtifactInteraction, L as submitKinichFeedback, N as formatToIstDate, P as getEightReferralTrackerState, R as trackGrowthEvent, S as REFERRAL_8_REWARD_TIERS, T as claimEightReferralTier, j as fetchMySubmittedFeedback, k as fetchDiscoverArtifacts, rt as UserAccountStore, w as addOneReferralProgress, x as KnowledgeVaultStore } from "./index-DO79AgMG.js";
//#region src/components/KinichGrowthHubModal.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function normalizeLatexDelimiters(raw) {
	if (!raw) return "";
	return raw.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n$$\n${inner.trim()}\n$$\n`).replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$$${inner.trim()}$$`);
}
function extractYouTubeVideoId(url) {
	if (!url) return null;
	const match = url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
	return match ? match[1] : null;
}
function parseTimestampToSeconds(ts) {
	if (!ts) return 0;
	const parts = ts.replace(/[[\]]/g, "").trim().split(":").map((p) => parseInt(p, 10));
	if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
	if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	return 0;
}
var DEFAULT_ARXIV_DOMAINS = [
	{
		id: "ai_llm",
		label: "AI & Language Models",
		badge: "cs.CL · cs.AI",
		count: 10
	},
	{
		id: "ml_dl",
		label: "Machine Learning & Deep Learning",
		badge: "cs.LG · stat.ML",
		count: 10
	},
	{
		id: "cv_multimodal",
		label: "Computer Vision & Multimodal",
		badge: "cs.CV",
		count: 10
	},
	{
		id: "robotics",
		label: "Robotics & Autonomous Systems",
		badge: "cs.RO · eess.SY",
		count: 10
	},
	{
		id: "quantum",
		label: "Quantum Physics & Computing",
		badge: "quant-ph",
		count: 10
	},
	{
		id: "astrophysics",
		label: "Astrophysics & Cosmology",
		badge: "astro-ph",
		count: 10
	},
	{
		id: "systems_sec",
		label: "Systems, Distributed & Security",
		badge: "cs.DC · cs.CR",
		count: 10
	},
	{
		id: "math_theory",
		label: "Mathematics, Optimization & Theory",
		badge: "math.OC · cs.DS",
		count: 10
	}
];
var KinichGrowthHubModal = ({ isOpen, onClose, initialTab = "discover", initialThreadId = null, threads, onOpenArtifactPage, onForkArtifactIntoChat, onContinueVaultItemInChat, isDark = true }) => {
	const [activeTab, setActiveTab] = (0, import_react.useState)(initialTab === "passes" ? "passes" : "discover");
	const [discoverItems, setDiscoverItems] = (0, import_react.useState)([]);
	const [discoverLoading, setDiscoverLoading] = (0, import_react.useState)(false);
	const [discoverCategory] = (0, import_react.useState)("All");
	const [discoverQuery, setDiscoverQuery] = (0, import_react.useState)("");
	const [discoverSourceFilter, setDiscoverSourceFilter] = (0, import_react.useState)("all");
	const [selectedArxivDomain, setSelectedArxivDomain] = (0, import_react.useState)("all");
	const [liveArxivDomains, setLiveArxivDomains] = (0, import_react.useState)(DEFAULT_ARXIV_DOMAINS);
	const [liveArxivPapers, setLiveArxivPapers] = (0, import_react.useState)([]);
	const [liveRefreshBatch, setLiveRefreshBatch] = (0, import_react.useState)(1);
	const [liveGithubRepos, setLiveGithubRepos] = (0, import_react.useState)([
		{
			id: 1001,
			name: "vllm-project/vllm",
			fullName: "vllm-project/vllm",
			owner: "vllm-project",
			url: "https://github.com/vllm-project/vllm",
			description: "High-throughput and memory-efficient inference and serving engine for LLMs with PagedAttention.",
			stars: 42800,
			forks: 6400,
			language: "Python",
			topics: [
				"llm",
				"inference",
				"paged-attention"
			]
		},
		{
			id: 1002,
			name: "deepseek-ai/DeepSeek-V3",
			fullName: "deepseek-ai/DeepSeek-V3",
			owner: "deepseek-ai",
			url: "https://github.com/deepseek-ai/DeepSeek-V3",
			description: "DeepSeek-V3 & R1 mixture-of-experts architecture with Multi-head Latent Attention (MLA) and FP8 training.",
			stars: 68400,
			forks: 9200,
			language: "Python",
			topics: [
				"deepseek",
				"moe",
				"llm",
				"reasoning"
			]
		},
		{
			id: 1003,
			name: "open-spaced-repetition/ts-fsrs",
			fullName: "open-spaced-repetition/ts-fsrs",
			owner: "open-spaced-repetition",
			url: "https://github.com/open-spaced-repetition/ts-fsrs",
			description: "TypeScript implementation of Free Spaced Repetition Scheduler (FSRS) and SM-2 memory scheduling algorithms.",
			stars: 1450,
			forks: 140,
			language: "TypeScript",
			topics: [
				"spaced-repetition",
				"fsrs",
				"sm2"
			]
		},
		{
			id: 1004,
			name: "run-llama/llama_index",
			fullName: "run-llama/llama_index",
			owner: "run-llama",
			url: "https://github.com/run-llama/llama_index",
			description: "Data framework for LLM applications to ingest, structure, and access private or domain-specific data (RAG).",
			stars: 39500,
			forks: 5600,
			language: "Python",
			topics: [
				"rag",
				"agents",
				"vector-search"
			]
		}
	]);
	const [liveFeedLoading, setLiveFeedLoading] = (0, import_react.useState)(false);
	const [liveRefreshTick, setLiveRefreshTick] = (0, import_react.useState)(0);
	const [savedLiveIds, setSavedLiveIds] = (0, import_react.useState)({});
	const [arxivInfinitePage, setArxivInfinitePage] = (0, import_react.useState)(0);
	const [isLoadingMoreArxiv, setIsLoadingMoreArxiv] = (0, import_react.useState)(false);
	const [hasMoreArxiv, setHasMoreArxiv] = (0, import_react.useState)(true);
	const discoverScrollContainerRef = (0, import_react.useRef)(null);
	const arxivSentinelRef = (0, import_react.useRef)(null);
	const isFetchingMoreRef = (0, import_react.useRef)(false);
	const [vaultItems, setVaultItems] = (0, import_react.useState)(() => KnowledgeVaultStore.getItems());
	const [selectedSubject, setSelectedSubject] = (0, import_react.useState)("all");
	const [vaultSearch, setVaultSearch] = (0, import_react.useState)("");
	const [activeVaultItem, setActiveVaultItem] = (0, import_react.useState)(null);
	const [isCreatingNote, setIsCreatingNote] = (0, import_react.useState)(false);
	const [newNoteTitle, setNewNoteTitle] = (0, import_react.useState)("");
	const [newNoteContent, setNewNoteContent] = (0, import_react.useState)("");
	const [newNoteTags, setNewNoteTags] = (0, import_react.useState)("notes, study");
	const [vaultThreads, setVaultThreads] = (0, import_react.useState)(() => VaultThreadStore.getThreads());
	const [activeThread, setActiveThread] = (0, import_react.useState)(null);
	const [vaultViewMode, setVaultViewMode] = (0, import_react.useState)("threads");
	const [threadCommentInput, setThreadCommentInput] = (0, import_react.useState)("");
	const [copiedShareNotice, setCopiedShareNotice] = (0, import_react.useState)(null);
	const [activeVideoTimeSec, setActiveVideoTimeSec] = (0, import_react.useState)(0);
	const [isGuestVault, setIsGuestVault] = (0, import_react.useState)(() => UserAccountStore.isGuest());
	const [referralStatus, setReferralStatus] = (0, import_react.useState)(null);
	const [dashboardData, setDashboardData] = (0, import_react.useState)(null);
	const [copiedRefLink, setCopiedRefLink] = (0, import_react.useState)(false);
	const [claimPassInput, setClaimPassInput] = (0, import_react.useState)("");
	const [claimingPass, setClaimingPass] = (0, import_react.useState)(false);
	const [claimPassFeedback, setClaimPassFeedback] = (0, import_react.useState)(null);
	const [bonusClaimNotice, setBonusClaimNotice] = (0, import_react.useState)(null);
	const [eightRefState, setEightRefState] = (0, import_react.useState)(() => getEightReferralTrackerState());
	const [feedbackCategory, setFeedbackCategory] = (0, import_react.useState)("feature");
	const [feedbackRating, setFeedbackRating] = (0, import_react.useState)(5);
	const [feedbackSubject, setFeedbackSubject] = (0, import_react.useState)("");
	const [feedbackMessage, setFeedbackMessage] = (0, import_react.useState)("");
	const [submittingFeedback, setSubmittingFeedback] = (0, import_react.useState)(false);
	const [feedbackToast, setFeedbackToast] = (0, import_react.useState)(null);
	const [feedbackError, setFeedbackError] = (0, import_react.useState)(null);
	const [myFeedbackHistory, setMyFeedbackHistory] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		if (isOpen) {
			setActiveTab(initialTab === "passes" ? "passes" : "discover");
			const localItems = KnowledgeVaultStore.getItems();
			const localThreads = VaultThreadStore.getThreads();
			setVaultItems(localItems);
			setVaultThreads(localThreads);
			if (initialThreadId) {
				const match = localThreads.find((t) => t.id === initialThreadId);
				if (match) {
					setVaultViewMode("threads");
					setActiveThread(match);
				}
			}
			setIsGuestVault(UserAccountStore.isGuest());
			if (!UserAccountStore.isGuest()) {
				KnowledgeVaultStore.syncFromCloud().then((synced) => {
					setVaultItems(synced);
				});
				VaultThreadStore.syncWithFirestore().then((synced) => {
					if (Array.isArray(synced)) {
						setVaultThreads(synced);
						if (initialThreadId) {
							const cloudMatch = synced.find((t) => t.id === initialThreadId);
							if (cloudMatch) {
								setVaultViewMode("threads");
								setActiveThread(cloudMatch);
							}
						}
					}
				});
			}
		}
	}, [
		isOpen,
		initialTab,
		initialThreadId
	]);
	(0, import_react.useEffect)(() => {
		const syncVault = () => {
			setVaultItems(KnowledgeVaultStore.getItems());
			setVaultThreads(VaultThreadStore.getThreads());
			setIsGuestVault(UserAccountStore.isGuest());
		};
		window.addEventListener("kinich-vault-updated", syncVault);
		window.addEventListener("kinich-account-updated", syncVault);
		return () => {
			window.removeEventListener("kinich-vault-updated", syncVault);
			window.removeEventListener("kinich-account-updated", syncVault);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!isOpen || activeTab !== "discover") return;
		let cancelled = false;
		setDiscoverLoading(true);
		setLiveFeedLoading(true);
		setArxivInfinitePage(0);
		setHasMoreArxiv(true);
		isFetchingMoreRef.current = false;
		fetchDiscoverArtifacts({
			category: discoverCategory,
			q: discoverQuery,
			sort: "recent",
			limit: 24
		}).then((res) => {
			if (cancelled) return;
			setDiscoverItems(res.items);
		}).finally(() => {
			if (!cancelled) setDiscoverLoading(false);
		});
		fetch(`/api/discover/live?category=${encodeURIComponent(discoverCategory)}&q=${encodeURIComponent(discoverQuery)}&refresh=${liveRefreshTick}&t=${Date.now()}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => {
			if (cancelled || !data) return;
			if (Array.isArray(data.arxivDomains) && data.arxivDomains.length > 0) setLiveArxivDomains(data.arxivDomains);
			if (Array.isArray(data.arxivPapers) && data.arxivPapers.length > 0) setLiveArxivPapers(data.arxivPapers);
			if (typeof data.hasMore === "boolean") setHasMoreArxiv(data.hasMore);
			if (typeof data.refreshBatch === "number") setLiveRefreshBatch(data.refreshBatch);
			else setLiveRefreshBatch(liveRefreshTick % 30 + 1);
			if (Array.isArray(data.githubRepos) && data.githubRepos.length > 0) setLiveGithubRepos(data.githubRepos);
		}).catch(() => {}).finally(() => {
			if (!cancelled) setLiveFeedLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [
		isOpen,
		activeTab,
		discoverCategory,
		discoverQuery,
		liveRefreshTick
	]);
	const loadMoreArxivPapers = (0, import_react.useCallback)(() => {
		if (!isOpen || activeTab !== "discover" || discoverSourceFilter !== "all" && discoverSourceFilter !== "arxiv" || liveFeedLoading || isFetchingMoreRef.current || !hasMoreArxiv || liveArxivPapers.length === 0) return;
		isFetchingMoreRef.current = true;
		setIsLoadingMoreArxiv(true);
		const nextPage = arxivInfinitePage + 1;
		const nextCursor = liveRefreshTick + nextPage;
		fetch(`/api/discover/live?category=${encodeURIComponent(discoverCategory)}&q=${encodeURIComponent(discoverQuery)}&domain=${encodeURIComponent(selectedArxivDomain)}&refresh=${nextCursor}&t=${Date.now()}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => {
			if (!data || !Array.isArray(data.arxivPapers) || data.arxivPapers.length === 0) {
				setHasMoreArxiv(false);
				return;
			}
			const incoming = data.arxivPapers;
			setLiveArxivPapers((prev) => {
				const seen = new Set(prev.map((p) => `${p.domainId || "ai_llm"}::${p.arxivId || p.id}`));
				const uniqueIncoming = [];
				for (const p of incoming) {
					const key = `${p.domainId || "ai_llm"}::${p.arxivId || p.id}`;
					if (!seen.has(key)) {
						seen.add(key);
						uniqueIncoming.push({
							...p,
							id: `${p.id}_p${nextPage}`
						});
					}
				}
				if (uniqueIncoming.length === 0) return prev;
				return [...prev, ...uniqueIncoming];
			});
			setArxivInfinitePage(nextPage);
			if (nextPage >= 28 || data.hasMore === false) setHasMoreArxiv(false);
		}).catch(() => {}).finally(() => {
			isFetchingMoreRef.current = false;
			setIsLoadingMoreArxiv(false);
		});
	}, [
		isOpen,
		activeTab,
		discoverSourceFilter,
		liveFeedLoading,
		hasMoreArxiv,
		liveArxivPapers.length,
		arxivInfinitePage,
		liveRefreshTick,
		discoverCategory,
		discoverQuery,
		selectedArxivDomain
	]);
	(0, import_react.useEffect)(() => {
		if (!isOpen || activeTab !== "discover" || discoverSourceFilter !== "all" && discoverSourceFilter !== "arxiv") return;
		const sentinelEl = arxivSentinelRef.current;
		const rootEl = discoverScrollContainerRef.current;
		if (!sentinelEl || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver((entries) => {
			const first = entries[0];
			if (first && first.isIntersecting) loadMoreArxivPapers();
		}, {
			root: rootEl,
			rootMargin: "0px 0px 360px 0px",
			threshold: .01
		});
		observer.observe(sentinelEl);
		return () => {
			observer.disconnect();
		};
	}, [
		isOpen,
		activeTab,
		discoverSourceFilter,
		selectedArxivDomain,
		liveArxivPapers.length,
		loadMoreArxivPapers
	]);
	(0, import_react.useEffect)(() => {
		if (!isOpen || activeTab !== "passes") return;
		setEightRefState(getEightReferralTrackerState());
		fetchMyReferralStatus().then((st) => {
			if (st) {
				setReferralStatus(st);
				setEightRefState(getEightReferralTrackerState());
			}
		});
		fetchUserReferralDashboard().then((dash) => {
			if (dash && dash.success) setDashboardData(dash);
		}).catch(() => {});
	}, [isOpen, activeTab]);
	(0, import_react.useEffect)(() => {
		if (!isOpen || activeTab !== "feedback") return;
		fetchMySubmittedFeedback().then((items) => {
			setMyFeedbackHistory(items);
		});
	}, [isOpen, activeTab]);
	const filteredVaultItems = (0, import_react.useMemo)(() => {
		let list = vaultItems;
		if (selectedSubject !== "all") list = list.filter((i) => (i.subject || "General Studies").toLowerCase() === selectedSubject.toLowerCase());
		const q = vaultSearch.trim().toLowerCase();
		if (q) list = list.filter((i) => i.title.toLowerCase().includes(q) || (i.subject || "").toLowerCase().includes(q) || (i.chapter || "").toLowerCase().includes(q) || i.summary.toLowerCase().includes(q) || i.content.toLowerCase().includes(q));
		return list;
	}, [
		vaultItems,
		selectedSubject,
		vaultSearch
	]);
	const groupedVaultBySubjectAndChapter = (0, import_react.useMemo)(() => KnowledgeVaultStore.getGroupedBySubjectAndChapter(filteredVaultItems), [filteredVaultItems]);
	const allSubjectsWithCounts = (0, import_react.useMemo)(() => KnowledgeVaultStore.getGroupedBySubjectAndChapter(vaultItems), [vaultItems]);
	const filteredVaultThreads = (0, import_react.useMemo)(() => {
		let list = [...vaultThreads];
		if (selectedSubject !== "all") list = list.filter((t) => (t.subject || "General Studies").toLowerCase() === selectedSubject.toLowerCase());
		const q = vaultSearch.trim().toLowerCase();
		if (q) list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.tldr || "").toLowerCase().includes(q) || (t.subject || "").toLowerCase().includes(q) || (t.chapter || "").toLowerCase().includes(q));
		list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
		return list;
	}, [
		vaultThreads,
		selectedSubject,
		vaultSearch
	]);
	const handleAddThreadComment = () => {
		if (!activeThread) return;
		const text = threadCommentInput.trim();
		if (!text) return;
		VaultThreadStore.addComment(activeThread.id, {
			author: "user",
			text
		});
		setThreadCommentInput("");
		const refreshed = VaultThreadStore.getThread(activeThread.id);
		if (refreshed) {
			setActiveThread(refreshed);
			setVaultThreads(VaultThreadStore.getThreads());
		}
	};
	const handleForgetThread = (threadId) => {
		VaultThreadStore.forgetThread(threadId);
		setVaultThreads(VaultThreadStore.getThreads());
		if (activeThread && activeThread.id === threadId) setActiveThread(null);
	};
	const handleQuizMeOnThread = (thread) => {
		onContinueVaultItemInChat({
			id: `quiz-${thread.id}`,
			userId: auth.currentUser?.uid || "user",
			title: `Quiz: ${thread.title}`,
			summary: thread.tldr || "",
			content: `Conduct an active recall quiz on this study thread:\n\nTitle: ${thread.title}\nTL;DR: ${thread.tldr}\nKey Points:\n${thread.keyPoints.map((k) => `- ${k.text} ${k.timestamp || ""}`).join("\n")}`,
			type: "quiz",
			sourceType: "quiz",
			collectionId: "col_quizzes",
			subject: thread.subject,
			chapter: thread.chapter,
			tags: thread.tags,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			lastReviewedAt: Date.now(),
			isPinned: thread.pinned
		});
		onClose();
	};
	const handleFlashcardsOnThread = (thread) => {
		onContinueVaultItemInChat({
			id: `flashcard-${thread.id}`,
			userId: auth.currentUser?.uid || "user",
			title: `Flashcards: ${thread.title}`,
			summary: thread.tldr || "",
			content: `Generate spaced-repetition flashcards for:\n\nTitle: ${thread.title}\nTL;DR: ${thread.tldr}\nKey Points:\n${thread.keyPoints.map((k) => `- ${k.text} ${k.timestamp || ""}`).join("\n")}`,
			type: "flashcard_deck",
			sourceType: "flashcard_deck",
			collectionId: "col_flashcards",
			subject: thread.subject,
			chapter: thread.chapter,
			tags: thread.tags,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			lastReviewedAt: Date.now(),
			isPinned: thread.pinned
		});
		onClose();
	};
	const handleShareThread = (thread) => {
		const text = `${thread.title}\n${thread.subject} → ${thread.chapter}\n${thread.tldr}\n\n${thread.keyPoints.map((kp, idx) => `${idx + 1}. ${kp.text}`).join("\n")}`;
		if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(text);
		setCopiedShareNotice("Copied to clipboard");
		setTimeout(() => setCopiedShareNotice(null), 2500);
	};
	if (!isOpen) return null;
	const handleCreateCustomNote = () => {
		if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
		if (UserAccountStore.isGuest()) {
			window.dispatchEvent(new CustomEvent("kinich-open-auth"));
			return;
		}
		const check = KnowledgeVaultStore.canSaveToVault();
		if (!check.allowed) {
			window.dispatchEvent(new CustomEvent("kinich-open-pricing", { detail: {
				highlightPlan: "spark",
				reason: check.message
			} }));
			return;
		}
		const created = KnowledgeVaultStore.saveItem({
			title: newNoteTitle.trim(),
			summary: newNoteContent.trim().slice(0, 200),
			content: newNoteContent.trim(),
			type: "note",
			sourceType: "note",
			collectionId: "col_explanations",
			tags: newNoteTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
		});
		setActiveVaultItem(created);
		setIsCreatingNote(false);
		setNewNoteTitle("");
		setNewNoteContent("");
	};
	const cardSurface = isDark ? "bg-zinc-900/70 border-zinc-800/90" : "bg-white border-zinc-200/90 shadow-2xs";
	const subCardSurface = isDark ? "bg-zinc-950/60 border-zinc-800/80" : "bg-zinc-50 border-zinc-200/80";
	const inputSurface = isDark ? "bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-zinc-600" : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-zinc-400";
	const primaryBtn = isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800";
	const secondaryBtn = isDark ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200" : "border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden ${isDark ? "bg-[#09090b] text-white" : "bg-[#fafafa] text-[#09090b]"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "px-4 sm:px-6 py-3 bg-transparent flex items-center justify-between gap-3 shrink-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-center gap-1.5 overflow-x-auto scrollbar-none",
				children: [{
					id: "discover",
					label: "Discover"
				}, {
					id: "passes",
					label: "Referrals"
				}].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setActiveTab(t.id),
					className: `px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeTab === t.id ? isDark ? "bg-white text-black font-semibold" : "bg-zinc-900 text-white font-semibold" : isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-900" : "text-zinc-600 hover:text-black hover:bg-zinc-100"}`,
					children: t.label
				}, t.id))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onClose,
				className: `size-8 rounded-xl flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${isDark ? "border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white" : "border-zinc-200 hover:bg-zinc-100 text-zinc-500 hover:text-black"}`,
				"aria-label": "Close",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: discoverScrollContainerRef,
			onScroll: (e) => {
				if (activeTab === "discover" && (discoverSourceFilter === "all" || discoverSourceFilter === "arxiv")) {
					const el = e.currentTarget;
					if (el.scrollHeight - el.scrollTop - el.clientHeight < 360) loadMoreArxivPapers();
				}
			},
			className: "flex-1 overflow-y-auto slim-scrollbar p-4 sm:p-6 text-xs",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "max-w-4xl mx-auto",
				children: [
					activeTab === "discover" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										value: discoverQuery,
										onChange: (e) => setDiscoverQuery(e.target.value),
										placeholder: "Search papers, repos, or study guides...",
										className: `w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none transition-colors ${inputSurface}`
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between sm:justify-end gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `inline-flex items-center p-0.5 rounded-xl border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-100 border-zinc-200"}`,
										children: [
											{
												id: "all",
												label: "All"
											},
											{
												id: "arxiv",
												label: "Papers"
											},
											{
												id: "github",
												label: "Code"
											},
											{
												id: "community",
												label: "Guides"
											}
										].map((src) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => setDiscoverSourceFilter(src.id),
											className: `px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${discoverSourceFilter === src.id ? isDark ? "bg-white text-black font-semibold" : "bg-zinc-900 text-white font-semibold" : isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-black"}`,
											children: src.label
										}, src.id))
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setLiveRefreshTick((t) => t + 1),
										disabled: liveFeedLoading,
										title: "Refresh to load the next batch of 10 latest papers per domain",
										className: `px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors shrink-0 ${secondaryBtn}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 text-[#FC4C01] ${liveFeedLoading ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: liveFeedLoading ? "Refreshing..." : "Refresh Latest" })]
									})]
								})]
							}),
							(discoverSourceFilter === "all" || discoverSourceFilter === "arxiv") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center justify-between gap-2 text-[11px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "font-semibold text-[#FC4C01]",
												children: [liveArxivDomains.length, " Research Domains"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-zinc-500",
												children: "·"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: isDark ? "text-zinc-300" : "text-zinc-700",
												children: [
													"10 Latest Papers per Domain (",
													liveArxivPapers.length,
													" total)"
												]
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: `px-2 py-0.5 rounded-md border font-mono text-[10px] ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-zinc-100 border-zinc-200 text-zinc-600"}`,
										children: ["Recent Batch #", liveRefreshBatch]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setSelectedArxivDomain("all"),
										className: `px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${selectedArxivDomain === "all" ? "bg-[#FC4C01] border-[#FC4C01] text-white font-semibold" : isDark ? "bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white" : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-black"}`,
										children: [
											"All ",
											liveArxivDomains.length,
											" Domains (",
											liveArxivPapers.length,
											")"
										]
									}), liveArxivDomains.map((dom) => {
										const count = liveArxivPapers.filter((p) => p.domainId === dom.id).length || dom.count;
										const isActive = selectedArxivDomain === dom.id;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => setSelectedArxivDomain(dom.id),
											className: `px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${isActive ? "bg-[#FC4C01] border-[#FC4C01] text-white font-semibold" : isDark ? "bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white" : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-black"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: dom.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `px-1.5 py-0.2 rounded-md text-[10px] font-mono ${isActive ? "bg-black/25 text-white" : isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"}`,
												children: count
											})]
										}, dom.id);
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-6",
								children: [
									(discoverSourceFilter === "all" || discoverSourceFilter === "arxiv") && liveArxivDomains.filter((dom) => selectedArxivDomain === "all" || dom.id === selectedArxivDomain).map((domain) => {
										const domainPapers = liveArxivPapers.filter((p) => (p.domainId || "ai_llm") === domain.id);
										if (domainPapers.length === 0) return null;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "space-y-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `flex flex-wrap items-center justify-between gap-2 pb-2 border-b ${isDark ? "border-zinc-800/90" : "border-zinc-200"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "text-sm font-bold tracking-tight",
														children: domain.label
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: `px-2 py-0.5 rounded-md text-[10px] font-mono border ${isDark ? "bg-zinc-900 border-zinc-800 text-[#FC4C01]" : "bg-orange-50 border-orange-200 text-[#FC4C01]"}`,
														children: domain.badge
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-[11px] font-medium text-zinc-400",
													children: [domainPapers.length, " latest papers"]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "space-y-3",
												children: domainPapers.map((paper, paperIdx) => {
													const connectedRepo = paper.connectedRepos?.[0] || null;
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: `p-4 rounded-2xl border space-y-2.5 transition-colors ${cardSurface}`,
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-center justify-between gap-2 text-[11px] text-zinc-400",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex items-center gap-2",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																		className: "font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FC4C01]/15 text-[#FC4C01] font-semibold",
																		children: ["#", paperIdx + 1]
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																		className: "font-medium text-[#FC4C01]",
																		children: [
																			paper.domainLabel || domain.label,
																			" ·",
																			" ",
																			paper.primaryCategory || "CS.AI"
																		]
																	})]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: paper.published ? new Date(paper.published).toLocaleDateString("en-US", {
																	month: "short",
																	day: "numeric",
																	year: "numeric"
																}) : "Recent" })]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
																href: paper.absUrl,
																target: "_blank",
																rel: "noopener noreferrer",
																className: "block text-sm font-semibold leading-snug hover:text-[#FC4C01] transition-colors",
																children: paper.title
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: `text-xs line-clamp-2 leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`,
																children: paper.summary
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "pt-2 flex flex-wrap items-center justify-between gap-2",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex flex-wrap items-center gap-2 text-xs",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
																		href: paper.pdfUrl,
																		target: "_blank",
																		rel: "noopener noreferrer",
																		className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors ${isDark ? "bg-zinc-800/90 hover:bg-zinc-700 border-zinc-600/80 text-white" : "bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900"}`,
																		title: "Open Paper PDF",
																		children: [
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "w-4 h-4 text-[#FC4C01] shrink-0" }),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "PDF" }),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5 opacity-85 shrink-0" })
																		]
																	}), connectedRepo && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
																		href: connectedRepo.url,
																		target: "_blank",
																		rel: "noopener noreferrer",
																		className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors ${isDark ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300" : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/35 text-emerald-700"}`,
																		title: `Open GitHub repository: ${connectedRepo.name}`,
																		children: [
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitBranch, { className: "w-4 h-4 shrink-0" }),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: connectedRepo.name }),
																			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5 opacity-85 shrink-0" })
																		]
																	})]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "flex items-center gap-2",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																		type: "button",
																		onClick: () => {
																			onForkArtifactIntoChat({
																				id: `arxiv_${paper.id}`,
																				ownerId: "arxiv",
																				showAuthorAttribution: true,
																				title: paper.title,
																				summary: paper.summary,
																				content: `Analyze this research paper (${paper.absUrl}):\n\n**Title:** ${paper.title}\n**Abstract:** ${paper.summary}`,
																				category: "Research",
																				outputType: "research_summary",
																				tags: ["arxiv"],
																				authorName: paper.authors[0] || "arXiv",
																				authorUsername: "arxiv",
																				visibility: "public",
																				viewsCount: 1,
																				savesCount: 0,
																				forksCount: 0,
																				createdAt: Date.now(),
																				updatedAt: Date.now()
																			});
																			onClose();
																		},
																		className: "px-3 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors",
																		children: "Ask Kinich"
																	})
																})]
															})
														]
													}, paper.id);
												})
											})]
										}, domain.id);
									}),
									(discoverSourceFilter === "all" || discoverSourceFilter === "arxiv") && liveArxivPapers.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										ref: arxivSentinelRef,
										"data-testid": "arxiv-infinite-scroll-sentinel",
										className: `p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${cardSurface}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex items-center gap-2.5",
											children: isLoadingMoreArxiv ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "w-4 h-4 text-[#FC4C01] animate-spin shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-medium",
												children: "Automatically fetching more recent arXiv papers..."
											})] }) : hasMoreArxiv ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-[#FC4C01] animate-pulse shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: isDark ? "text-zinc-300" : "text-zinc-700",
												children: [
													"Showing ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: liveArxivPapers.length }),
													" papers across",
													" ",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: liveArxivDomains.length }),
													" domains · Scroll down to auto-load more"
												]
											})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-zinc-400",
												children: [
													"All recent arXiv batches loaded (",
													liveArxivPapers.length,
													" papers)."
												]
											})
										}), hasMoreArxiv && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: loadMoreArxivPapers,
											disabled: isLoadingMoreArxiv,
											className: `px-3.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors shrink-0 flex items-center gap-1.5 ${secondaryBtn}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 text-[#FC4C01] ${isLoadingMoreArxiv ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isLoadingMoreArxiv ? "Loading..." : "Load More Papers" })]
										})]
									}),
									(discoverSourceFilter === "all" || discoverSourceFilter === "github") && liveGithubRepos.map((repo) => {
										Boolean(savedLiveIds[`gh_${repo.id}`]);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `p-4 rounded-2xl border space-y-2.5 transition-colors ${cardSurface}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between gap-2 text-[11px] text-zinc-400",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "font-medium text-emerald-500",
														children: ["Code · ", repo.language || "Open Source"]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "inline-flex items-center gap-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "w-3 h-3 text-amber-400 fill-amber-400" }), repo.stars.toLocaleString()]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
													href: repo.url,
													target: "_blank",
													rel: "noopener noreferrer",
													className: "block text-sm font-semibold hover:text-[#FC4C01] transition-colors truncate",
													children: repo.fullName
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: `text-xs line-clamp-2 leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`,
													children: repo.description
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "pt-2 flex items-center justify-between gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
														href: repo.url,
														target: "_blank",
														rel: "noopener noreferrer",
														className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${isDark ? "bg-zinc-800/90 hover:bg-zinc-700 border-zinc-600/80 text-white" : "bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900"}`,
														title: `Open ${repo.fullName} on GitHub`,
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitBranch, { className: "w-4 h-4 text-emerald-400 shrink-0" }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "GitHub" }),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5 opacity-85 shrink-0" })
														]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "flex items-center gap-2",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => {
																onForkArtifactIntoChat({
																	id: `gh_${repo.id}`,
																	ownerId: "github",
																	showAuthorAttribution: true,
																	title: repo.fullName,
																	summary: repo.description,
																	content: `Explain the architecture and key patterns of **${repo.fullName}** (${repo.url}):\n\n${repo.description}`,
																	category: "Programming",
																	outputType: "structured_notes",
																	tags: ["github"],
																	authorName: repo.owner,
																	authorUsername: repo.owner,
																	visibility: "public",
																	viewsCount: 1,
																	savesCount: 0,
																	forksCount: 0,
																	createdAt: Date.now(),
																	updatedAt: Date.now()
																});
																onClose();
															},
															className: `px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${primaryBtn}`,
															children: "Inspect"
														})
													})]
												})
											]
										}, repo.id);
									}),
									(discoverSourceFilter === "all" || discoverSourceFilter === "community" || discoverSourceFilter === "github") && discoverItems.filter((item) => discoverSourceFilter === "github" ? item.category === "Programming" || item.tags?.some((t) => /code|rust|python|typescript|compiler/i.test(t)) : true).map((item) => {
										KnowledgeVaultStore.isArtifactBookmarked(item.id);
										return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `p-4 rounded-2xl border space-y-2.5 transition-colors ${cardSurface}`,
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "flex items-center justify-between gap-2 text-[11px] text-zinc-400",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-medium",
														children: item.category
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													onClick: () => {
														trackGrowthEvent("discover_resource_opened", {
															artifactId: item.id,
															category: item.category
														});
														onOpenArtifactPage(item);
													},
													className: "text-sm font-semibold leading-snug hover:text-[#FC4C01] transition-colors cursor-pointer",
													children: item.title
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: `text-xs line-clamp-2 leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`,
													children: item.summary
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "pt-2 flex items-center justify-between gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => {
															window.dispatchEvent(new CustomEvent("kinich-open-report", { detail: {
																targetType: "discover_item",
																targetId: item.id,
																contentPreview: `${item.title}: ${item.summary}`
															} }));
														},
														className: "text-[11px] text-zinc-400 hover:text-current cursor-pointer",
														children: "Report"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => {
																trackGrowthEvent("discover_resource_opened", {
																	artifactId: item.id,
																	category: item.category
																});
																onOpenArtifactPage(item);
															},
															className: `px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${secondaryBtn}`,
															children: "Read"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => {
																recordArtifactInteraction(item.id, "cta");
																onForkArtifactIntoChat(item);
																onClose();
															},
															className: `px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${primaryBtn}`,
															children: "Open in Chat"
														})]
													})]
												})
											]
										}, item.id);
									}),
									!discoverLoading && !liveFeedLoading && liveArxivPapers.length === 0 && liveGithubRepos.length === 0 && discoverItems.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `p-8 rounded-2xl border text-center ${cardSurface}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs text-zinc-400",
											children: "No matching items found."
										})
									})
								]
							})
						]
					}),
					activeTab === "vault" && (isGuestVault ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						"data-testid": "vault-guest-signin-prompt",
						className: `p-8 sm:p-10 rounded-2xl border text-center max-w-md mx-auto my-6 space-y-4 ${cardSurface}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-10 h-10 rounded-xl bg-[#FC4C01]/15 text-[#FC4C01] flex items-center justify-center mx-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-4 h-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-base font-bold tracking-tight",
									children: "Sign in to keep this in your Vault"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: `text-xs ${isDark ? "text-zinc-400" : "text-zinc-600"}`,
									children: "Save lectures, notes, quizzes, and study threads across your devices."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									window.dispatchEvent(new CustomEvent("kinich-open-auth", { detail: { reason: "Sign in to keep this in your Vault" } }));
								},
								className: "px-5 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white font-semibold text-xs cursor-pointer transition-colors",
								children: "Sign in"
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "relative flex-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										value: vaultSearch,
										onChange: (e) => setVaultSearch(e.target.value),
										placeholder: "Search your saved notes and study threads...",
										className: `w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none ${inputSurface}`
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between sm:justify-end gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `inline-flex items-center p-0.5 rounded-xl border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-100 border-zinc-200"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => {
												setVaultViewMode("threads");
												setActiveVaultItem(null);
											},
											className: `px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${vaultViewMode === "threads" ? isDark ? "bg-white text-black font-semibold" : "bg-zinc-900 text-white font-semibold" : isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-black"}`,
											children: [
												"Feed (",
												vaultThreads.length,
												")"
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => {
												setVaultViewMode("tree");
												setActiveThread(null);
											},
											className: `px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${vaultViewMode === "tree" ? isDark ? "bg-white text-black font-semibold" : "bg-zinc-900 text-white font-semibold" : isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-black"}`,
											children: [
												"Subjects (",
												vaultItems.length,
												")"
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => {
											setVaultViewMode("tree");
											setIsCreatingNote(true);
											setActiveVaultItem(null);
										},
										className: "px-3.5 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer shrink-0 transition-colors",
										children: "+ Note"
									})]
								})]
							}),
							copiedShareNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-[#FC4C01] font-medium",
								children: copiedShareNotice
							}),
							vaultViewMode === "threads" ? activeThread ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-4 sm:p-5 rounded-2xl border space-y-4 ${cardSurface}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-current/10",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												setActiveThread(null);
												setActiveVideoTimeSec(0);
											},
											className: "text-xs text-zinc-400 hover:text-current font-medium cursor-pointer",
											children: "← Back"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center gap-1.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => handleQuizMeOnThread(activeThread),
													className: "px-3 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer",
													children: "Quiz me"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => handleFlashcardsOnThread(activeThread),
													className: `px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer ${secondaryBtn}`,
													children: "Flashcards"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => handleShareThread(activeThread),
													className: `px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${secondaryBtn}`,
													children: "Share"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => handleForgetThread(activeThread.id),
													className: "px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 cursor-pointer",
													children: "Delete"
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[11px] text-zinc-400",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[#FC4C01] font-medium",
													children: activeThread.subject || "General Studies"
												}),
												" ",
												"→ ",
												activeThread.chapter || "Core Concepts",
												" ·",
												" ",
												formatToIstDate(activeThread.createdAt)
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
											className: "text-base sm:text-lg font-bold tracking-tight",
											children: activeThread.title
										})]
									}),
									activeThread.type === "youtube" && extractYouTubeVideoId(activeThread.sourceUrl) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-full aspect-video rounded-xl overflow-hidden border border-current/10 bg-black",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("iframe", {
											id: "vault-youtube-player",
											src: `https://www.youtube.com/embed/${extractYouTubeVideoId(activeThread.sourceUrl)}?start=${activeVideoTimeSec}&autoplay=${activeVideoTimeSec > 0 ? 1 : 0}`,
											title: activeThread.title,
											allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
											allowFullScreen: true,
											className: "w-full h-full border-0"
										})
									}),
									activeThread.tldr && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: `text-xs sm:text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-700"}`,
										children: activeThread.tldr
									}),
									Array.isArray(activeThread.keyPoints) && activeThread.keyPoints.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "space-y-2 pt-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-semibold text-zinc-400",
											children: "Key Points"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "space-y-1.5",
											children: activeThread.keyPoints.map((kp, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `p-3 rounded-xl border flex items-start gap-2.5 ${subCardSurface}`,
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-xs font-mono font-semibold text-[#FC4C01] shrink-0",
														children: [idx + 1, "."]
													}),
													kp.timestamp && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														type: "button",
														onClick: () => setActiveVideoTimeSec(parseTimestampToSeconds(kp.timestamp)),
														className: "inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FC4C01]/15 text-[#FC4C01] text-[11px] font-mono cursor-pointer shrink-0",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "w-2.5 h-2.5 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: kp.timestamp })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-xs leading-relaxed",
														children: kp.text
													})
												]
											}, kp.id || idx))
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "pt-4 border-t border-current/10 space-y-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: threadCommentInput,
												onChange: (e) => setThreadCommentInput(e.target.value),
												placeholder: "Add a note...",
												className: `flex-1 px-3 py-2 rounded-xl border text-xs outline-none ${inputSurface}`
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: handleAddThreadComment,
												className: "px-3.5 py-2 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold cursor-pointer",
												children: "Add"
											})]
										}), Array.isArray(activeThread.comments) && activeThread.comments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "space-y-2",
											children: activeThread.comments.map((comment) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `p-3 rounded-xl border text-xs space-y-1 ${subCardSurface}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between text-[11px] text-zinc-400",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-medium capitalize",
														children: comment.author === "user" ? "You" : comment.author
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatToIstDate(comment.createdAt) })]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "leading-relaxed whitespace-pre-wrap",
													children: comment.text
												})]
											}, comment.id))
										})]
									})
								]
							}) : filteredVaultThreads.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-8 text-center rounded-2xl border space-y-1 ${cardSurface}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-semibold",
									children: "No saved study threads yet"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-zinc-400",
									children: "Save any lecture, chat synthesis, or study guide to access it here."
								})]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2.5",
								children: filteredVaultThreads.map((thread) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									onClick: () => {
										setActiveThread(thread);
										setActiveVideoTimeSec(0);
									},
									className: `p-4 rounded-2xl border flex items-start justify-between gap-3 cursor-pointer transition-colors hover:border-[#FC4C01]/50 ${cardSurface}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "min-w-0 flex-1 space-y-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[#FC4C01] font-medium",
														children: thread.subject || "General Studies"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "→" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: thread.chapter || "Core Concepts" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatToIstDate(thread.createdAt) })
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-sm font-semibold leading-snug truncate",
												children: thread.title
											}),
											thread.tldr && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: `text-xs line-clamp-2 leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`,
												children: thread.tldr
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1 shrink-0",
										onClick: (e) => e.stopPropagation(),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => handleShareThread(thread),
											className: "size-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-current cursor-pointer",
											title: "Share",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-3.5 h-3.5" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => handleForgetThread(thread.id),
											className: "size-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 cursor-pointer",
											title: "Delete",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" })
										})]
									})]
								}, thread.id))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4",
								children: [allSubjectsWithCounts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setSelectedSubject("all"),
										className: `px-3 py-1 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer ${selectedSubject === "all" ? primaryBtn : secondaryBtn}`,
										children: [
											"All (",
											vaultItems.length,
											")"
										]
									}), allSubjectsWithCounts.map((grp) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setSelectedSubject(grp.subject),
										className: `px-3 py-1 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer ${selectedSubject === grp.subject ? primaryBtn : secondaryBtn}`,
										children: [
											grp.subject,
											" (",
											grp.totalItems,
											")"
										]
									}, grp.subject))]
								}), isCreatingNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `p-4 sm:p-5 rounded-2xl border space-y-3 ${cardSurface}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-sm font-semibold",
											children: "New Study Note"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: newNoteTitle,
											onChange: (e) => setNewNoteTitle(e.target.value),
											placeholder: "Note title...",
											className: `w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${inputSurface}`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: newNoteTags,
											onChange: (e) => setNewNoteTags(e.target.value),
											placeholder: "Tags (comma-separated)...",
											className: `w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${inputSurface}`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
											rows: 6,
											value: newNoteContent,
											onChange: (e) => setNewNoteContent(e.target.value),
											placeholder: "Write Markdown notes or formulas...",
											className: `w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none ${inputSurface}`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex justify-end gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setIsCreatingNote(false),
												className: "px-3.5 py-1.5 rounded-xl text-zinc-400 hover:text-current cursor-pointer",
												children: "Cancel"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: handleCreateCustomNote,
												className: "px-4 py-1.5 rounded-xl bg-[#FC4C01] text-white font-semibold cursor-pointer",
												children: "Save Note"
											})]
										})
									]
								}) : activeVaultItem ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `p-4 sm:p-5 rounded-2xl border space-y-4 ${cardSurface}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center justify-between gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setActiveVaultItem(null),
												className: "text-xs text-zinc-400 hover:text-current cursor-pointer font-medium",
												children: "← Back"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														KnowledgeVaultStore.markReviewed(activeVaultItem.id);
														onContinueVaultItemInChat(activeVaultItem);
														onClose();
													},
													className: "px-3.5 py-1.5 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold cursor-pointer",
													children: "Open in Chat"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														KnowledgeVaultStore.deleteItem(activeVaultItem.id);
														setActiveVaultItem(null);
													},
													className: `px-3 py-1.5 rounded-xl border text-xs cursor-pointer ${secondaryBtn}`,
													children: "Delete"
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "space-y-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[11px] text-zinc-400",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[#FC4C01] font-medium",
														children: activeVaultItem.subject || "General Studies"
													}),
													" ",
													"→ ",
													activeVaultItem.chapter || "Core Concepts"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-base font-bold",
												children: activeVaultItem.title
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: `p-4 rounded-xl border prose-grok max-w-none text-xs sm:text-sm leading-relaxed overflow-x-auto ${subCardSurface}`,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Markdown, {
												remarkPlugins: [remarkGfm, [remarkMath, { singleDollarTextMath: false }]],
												rehypePlugins: [rehypeKatex],
												children: normalizeLatexDelimiters(activeVaultItem.content)
											})
										})
									]
								}) : groupedVaultBySubjectAndChapter.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `p-8 rounded-2xl border text-center space-y-1 ${cardSurface}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-semibold",
										children: "Your Vault is empty"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-zinc-400",
										children: "Click “Save to Vault” on any lecture, report, or chat response."
									})]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-4",
									"data-testid": "vault-subject-chapter-groups",
									children: groupedVaultBySubjectAndChapter.map((subjectGroup) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-4 rounded-2xl border space-y-3 ${cardSurface}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-2 pb-2 border-b border-current/10",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-4 h-4 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "text-sm font-bold",
													children: subjectGroup.subject
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[11px] text-zinc-400",
												children: [subjectGroup.totalItems, " items"]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "space-y-3",
											children: subjectGroup.chapters.map((chapterGroup) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "space-y-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-xs font-semibold text-[#FC4C01]",
													children: [
														chapterGroup.chapter,
														" (",
														chapterGroup.items.length,
														")"
													]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "space-y-2",
													children: chapterGroup.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														"data-testid": `vault-item-card-${item.id}`,
														onClick: () => {
															KnowledgeVaultStore.markReviewed(item.id);
															setActiveVaultItem(item);
														},
														className: `p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors hover:border-[#FC4C01]/50 ${subCardSurface}`,
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "min-w-0 flex-1 space-y-0.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h5", {
																className: "text-xs sm:text-sm font-semibold truncate",
																children: item.title
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																className: `text-xs line-clamp-1 ${isDark ? "text-zinc-400" : "text-zinc-600"}`,
																children: item.summary
															})]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-1.5 shrink-0",
															onClick: (e) => e.stopPropagation(),
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																type: "button",
																onClick: () => {
																	KnowledgeVaultStore.markReviewed(item.id);
																	onContinueVaultItemInChat(item);
																	onClose();
																},
																className: `px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer ${secondaryBtn}`,
																children: "Study"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																type: "button",
																onClick: () => KnowledgeVaultStore.deleteItem(item.id),
																className: "p-1 text-zinc-400 hover:text-red-400 cursor-pointer",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" })
															})]
														})]
													}, item.id))
												})]
											}, chapterGroup.chapter))
										})]
									}, subjectGroup.subject))
								})]
							})
						]
					})),
					activeTab === "passes" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-2xl mx-auto space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-5 rounded-2xl border space-y-4 ${cardSurface}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-base font-bold tracking-tight",
											children: "Invite Friends"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-sm font-mono font-bold text-[#FC4C01]",
											children: [Math.min(eightRefState.count, 8), " / 8"]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `w-full h-1.5 rounded-full overflow-hidden ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-full rounded-full bg-[#FC4C01] transition-all",
											style: { width: `${Math.min(100, Math.round(eightRefState.count / 8 * 100))}%` }
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-2 rounded-xl border flex items-center gap-2 ${subCardSurface}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												readOnly: true,
												value: dashboardData?.link || referralStatus?.referralUrl || eightRefState.inviteUrl,
												className: "flex-1 bg-transparent font-mono text-xs outline-none truncate px-2"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => {
													const url = dashboardData?.link || referralStatus?.referralUrl || eightRefState.inviteUrl;
													navigator.clipboard.writeText(url);
													setCopiedRefLink(true);
													trackGrowthEvent("share_action_initiated", { surface: "referral_link" });
													setTimeout(() => setCopiedRefLink(false), 2e3);
												},
												className: `px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 ${primaryBtn}`,
												children: copiedRefLink ? "Copied" : "Copy Link"
											}),
											typeof navigator !== "undefined" && "share" in navigator && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => {
													const url = dashboardData?.link || referralStatus?.referralUrl || eightRefState.inviteUrl;
													const code = dashboardData?.code || referralStatus?.code || eightRefState.code;
													navigator.share({
														title: "Join me on Kinich",
														text: `Join me on Kinich with code: ${code}`,
														url
													}).catch(() => {});
												},
												className: `px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer shrink-0 ${secondaryBtn}`,
												children: "Share"
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "grid grid-cols-3 gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `p-2.5 rounded-xl border text-center ${subCardSurface}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-base font-bold font-mono",
													children: dashboardData?.stats?.invited ?? referralStatus?.validatedSignupsCount ?? 0
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-zinc-400",
													children: "Invited"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `p-2.5 rounded-xl border text-center ${subCardSurface}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-base font-bold font-mono",
													children: dashboardData?.stats?.qualified ?? referralStatus?.qualifiedActionsCount ?? 0
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-zinc-400",
													children: "Qualified"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `p-2.5 rounded-xl border text-center ${subCardSurface}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-base font-bold font-mono",
													children: dashboardData?.stats?.rewarded ?? (dashboardData?.rewards?.length || 0)
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-[11px] text-zinc-400",
													children: "Rewards"
												})]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "pt-2 border-t border-current/10 flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: claimPassInput,
											onChange: (e) => setClaimPassInput(e.target.value),
											placeholder: "Have a friend's code? Enter here...",
											className: `flex-1 px-3 py-1.5 rounded-xl border font-mono text-xs outline-none ${inputSurface}`
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: claimingPass || !claimPassInput.trim(),
											onClick: async () => {
												setClaimingPass(true);
												setClaimPassFeedback(null);
												try {
													const res = await claimReferralCodeManual(claimPassInput);
													setClaimPassFeedback(res);
													if (res.ok) {
														const updated = addOneReferralProgress();
														setEightRefState(updated);
														setClaimPassInput("");
													}
												} finally {
													setClaimingPass(false);
												}
											},
											className: `px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 ${primaryBtn}`,
											children: claimingPass ? "..." : "Redeem"
										})]
									}),
									claimPassFeedback && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11px] font-medium text-[#FC4C01]",
										children: claimPassFeedback.message
									})
								]
							}),
							bonusClaimNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "px-4 py-2.5 rounded-xl border border-[#FC4C01]/40 bg-[#FC4C01]/10 text-xs font-medium flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: bonusClaimNotice }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setBonusClaimNotice(null),
									className: "text-[11px] opacity-75 hover:opacity-100 cursor-pointer",
									children: "Dismiss"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-1 sm:grid-cols-2 gap-3",
								children: REFERRAL_8_REWARD_TIERS.map((tier) => {
									const isClaimed = eightRefState.claimedTiers.includes(tier.targetReferrals);
									const isUnlocked = eightRefState.count >= tier.targetReferrals;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-4 rounded-2xl border flex items-center justify-between gap-3 ${isUnlocked && !isClaimed ? "border-[#FC4C01]/50 bg-[#FC4C01]/[0.05]" : cardSurface}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "space-y-0.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-xs font-bold",
												children: [
													tier.targetReferrals,
													" ",
													tier.targetReferrals === 1 ? "Referral" : "Referrals"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2 pt-0.5 text-[11px] font-mono tabular-nums text-zinc-300",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "inline-flex items-center gap-1",
														title: `+${tier.bonusMessages} Prompts`,
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5 text-[#FC4C01] shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", tier.bonusMessages] })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "opacity-30",
														children: "|"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "inline-flex items-center gap-1",
														title: `+${tier.bonusUploads} Uploads`,
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "w-3.5 h-3.5 text-[#FC4C01] shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", tier.bonusUploads] })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "opacity-30",
														children: "|"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "inline-flex items-center gap-1",
														title: `+${tier.bonusQuizzes} Quizzes`,
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "w-3.5 h-3.5 text-[#FC4C01] shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", tier.bonusQuizzes] })]
													})
												]
											})]
										}), isClaimed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-semibold text-emerald-500 shrink-0",
											children: "Claimed ✓"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												const res = claimEightReferralTier(tier.targetReferrals);
												setEightRefState(res.state);
												setBonusClaimNotice(res.message);
												setTimeout(() => setBonusClaimNotice(null), 4e3);
											},
											className: `px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 ${isUnlocked ? "bg-[#FC4C01] hover:bg-[#e04300] text-white" : secondaryBtn}`,
											children: "Claim"
										})]
									}, tier.targetReferrals);
								})
							})
						]
					}),
					activeTab === "feedback" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-xl mx-auto space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-5 rounded-2xl border space-y-4 ${cardSurface}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-base font-bold tracking-tight",
									children: "Send Feedback"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap gap-1.5",
									children: [
										{
											id: "feature",
											label: "Feature"
										},
										{
											id: "bug",
											label: "Bug"
										},
										{
											id: "model_quality",
											label: "Models"
										},
										{
											id: "research_tools",
											label: "Study Tools"
										},
										{
											id: "ui_ux",
											label: "Design"
										}
									].map((cat) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setFeedbackCategory(cat.id),
										className: `px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${feedbackCategory === cat.id ? primaryBtn : secondaryBtn}`,
										children: cat.label
									}, cat.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-zinc-400 mr-1",
										children: "Rating:"
									}), [
										1,
										2,
										3,
										4,
										5
									].map((score) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setFeedbackRating(score),
										className: `w-8 h-8 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${feedbackRating === score ? primaryBtn : secondaryBtn}`,
										children: score
									}, score))]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: feedbackSubject,
									onChange: (e) => setFeedbackSubject(e.target.value),
									maxLength: 140,
									placeholder: "Subject (optional)...",
									className: `w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${inputSurface}`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									rows: 4,
									value: feedbackMessage,
									onChange: (e) => setFeedbackMessage(e.target.value),
									maxLength: 2400,
									placeholder: "What can we improve?",
									className: `w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none leading-relaxed ${inputSurface}`
								}),
								feedbackError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-red-400",
									children: feedbackError
								}),
								feedbackToast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-emerald-400 font-medium",
									children: feedbackToast
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex justify-end",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: submittingFeedback || feedbackMessage.trim().length < 4,
										onClick: async () => {
											setSubmittingFeedback(true);
											setFeedbackError(null);
											setFeedbackToast(null);
											try {
												const sub = UserAccountStore.getSubscription();
												const res = await submitKinichFeedback({
													category: feedbackCategory,
													rating: feedbackRating,
													subject: feedbackSubject,
													message: feedbackMessage,
													includeDiagnostics: true,
													diagnosticsSummary: `Plan: ${sub.plan} | Threads: ${threads.length}`
												});
												if (!res.ok) setFeedbackError(res.error || "Could not submit feedback.");
												else {
													setFeedbackSubject("");
													setFeedbackMessage("");
													setFeedbackToast("Feedback sent. Thank you!");
													const updatedHistory = await fetchMySubmittedFeedback();
													setMyFeedbackHistory(updatedHistory);
												}
											} finally {
												setSubmittingFeedback(false);
											}
										},
										className: `px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 ${primaryBtn}`,
										children: submittingFeedback ? "Sending…" : "Send Feedback"
									})
								})
							]
						}), myFeedbackHistory.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-4 rounded-2xl border space-y-2.5 ${cardSurface}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs font-semibold text-zinc-400",
								children: "Recent Feedback"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2",
								children: myFeedbackHistory.slice(0, 5).map((fb) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `p-3 rounded-xl border space-y-1 ${subCardSurface}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between text-[11px] text-zinc-400",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "capitalize",
												children: fb.category.replace("_", " ")
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: new Date(fb.createdAt).toLocaleDateString() })]
										}),
										fb.subject && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-semibold",
											children: fb.subject
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs leading-relaxed opacity-85",
											children: fb.message
										})
									]
								}, fb.id))
							})]
						})]
					})
				]
			})
		})]
	});
};
//#endregion
export { KinichGrowthHubModal };
