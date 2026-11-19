import { g as StudyLoopStore, x as KnowledgeVaultStore } from "./index-DO79AgMG.js";
//#region src/lib/hitaishiWorkspaceBridge.ts
var STUDY_SNAPSHOT_KEY = "kinich_hitaishi_study_snapshot_v1";
var SIDECHAT_SNAPSHOT_KEY = "kinich_sidechat_tasks_v1";
var HITAISHI_HISTORY_KEY = "kinich_hitaishi_chat_history_v1";
var HITAISHI_SCOPE_KEY = "kinich_hitaishi_workspace_scope_v1";
function getSavedHitaishiScope() {
	if (typeof window === "undefined") return "all";
	try {
		const val = localStorage.getItem(HITAISHI_SCOPE_KEY);
		if (val === "all" || val === "chat" || val === "study" || val === "sidechat" || val === "vault") return val;
	} catch {}
	return "all";
}
function setSavedHitaishiScope(scope) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(HITAISHI_SCOPE_KEY, scope);
		window.dispatchEvent(new CustomEvent("hitaishi-workspace-updated"));
	} catch {}
}
function saveStudyWorkspaceToHitaishiBridge(snapshot) {
	if (typeof window === "undefined") return;
	try {
		const existing = getStudyWorkspaceFromHitaishiBridge();
		const merged = {
			spaceId: snapshot.spaceId ?? existing?.spaceId ?? "default-study-space",
			title: snapshot.title || existing?.title || "Study Space",
			sourceType: snapshot.sourceType || existing?.sourceType || "topic",
			videoId: snapshot.videoId ?? existing?.videoId,
			summary: (snapshot.summary ?? existing?.summary ?? "").slice(0, 2800),
			keyTakeaways: (snapshot.keyTakeaways ?? existing?.keyTakeaways ?? []).slice(0, 12),
			flashcards: (snapshot.flashcards ?? existing?.flashcards ?? []).slice(0, 20),
			quizQuestions: (snapshot.quizQuestions ?? existing?.quizQuestions ?? []).slice(0, 15),
			userNotes: (snapshot.userNotes ?? existing?.userNotes ?? "").slice(0, 2e3),
			studyChatTurns: (snapshot.studyChatTurns ?? existing?.studyChatTurns ?? []).slice(-12),
			spacesList: (snapshot.spacesList ?? existing?.spacesList ?? []).slice(0, 15),
			updatedAt: Date.now()
		};
		localStorage.setItem(STUDY_SNAPSHOT_KEY, JSON.stringify(merged));
		window.dispatchEvent(new CustomEvent("hitaishi-workspace-updated"));
	} catch {}
}
function getStudyWorkspaceFromHitaishiBridge() {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(STUDY_SNAPSHOT_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === "object") return parsed;
		}
		const spacesRaw = localStorage.getItem("kinich_study_spaces_v2");
		if (spacesRaw) {
			const spaces = JSON.parse(spacesRaw);
			if (Array.isArray(spaces) && spaces.length > 0) {
				const first = spaces[0];
				return {
					spaceId: first.id,
					title: first.name || "Study Space",
					sourceType: first.sourceType || "topic",
					videoId: first.videoId,
					summary: first.rawText ? String(first.rawText).slice(0, 1800) : `Active Study Space: ${first.name}`,
					keyTakeaways: [],
					flashcards: [],
					quizQuestions: [],
					userNotes: "",
					studyChatTurns: [],
					spacesList: spaces.slice(0, 12).map((s) => ({
						id: String(s.id || ""),
						name: String(s.name || ""),
						sourceType: s.sourceType
					})),
					updatedAt: Date.now()
				};
			}
		}
	} catch {}
	return null;
}
function saveSideChatTasksToHitaishiBridge(tasks) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(SIDECHAT_SNAPSHOT_KEY, JSON.stringify(tasks.slice(0, 15)));
		window.dispatchEvent(new CustomEvent("hitaishi-workspace-updated"));
	} catch {}
}
function getSideChatTasksFromHitaishiBridge() {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(SIDECHAT_SNAPSHOT_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) return parsed;
		}
	} catch {}
	return [];
}
function getChatThreadsFromHitaishiBridge() {
	if (typeof window === "undefined") return {
		activeThread: null,
		recentThreads: []
	};
	try {
		const rawThreads = localStorage.getItem("kinich_threads_v2") || localStorage.getItem("kinich_threads");
		const activeId = localStorage.getItem("kinich_active_thread");
		if (!rawThreads) return {
			activeThread: null,
			recentThreads: []
		};
		const threads = JSON.parse(rawThreads);
		if (!Array.isArray(threads) || threads.length === 0) return {
			activeThread: null,
			recentThreads: []
		};
		const targetThread = activeId && threads.find((t) => t && t.id === activeId) || threads[0];
		let activeSnapshot = null;
		if (targetThread && Array.isArray(targetThread.messages)) {
			const msgs = targetThread.messages.slice(-12).map((m) => ({
				role: m.role === "assistant" ? "assistant" : "user",
				content: String(m.content || m.text || "").slice(0, 600)
			})).filter((m) => Boolean(m.content.trim()));
			activeSnapshot = {
				id: String(targetThread.id || "default"),
				title: String(targetThread.title || "Active Chat"),
				updatedAt: Number(targetThread.updatedAt || Date.now()),
				messages: msgs
			};
		}
		const recentThreads = threads.slice(0, 8).map((t) => {
			const msgs = Array.isArray(t?.messages) ? t.messages : [];
			const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
			return {
				id: String(t?.id || ""),
				title: String(t?.title || "Untitled Chat").slice(0, 80),
				lastMessagePreview: String(lastMsg?.content || lastMsg?.text || "").slice(0, 140)
			};
		});
		return {
			activeThread: activeSnapshot,
			recentThreads
		};
	} catch {
		return {
			activeThread: null,
			recentThreads: []
		};
	}
}
function buildHitaishiWorkspaceContextPayload(overrideScope) {
	const scope = overrideScope || getSavedHitaishiScope();
	const { activeThread, recentThreads } = getChatThreadsFromHitaishiBridge();
	const activeStudySpace = getStudyWorkspaceFromHitaishiBridge();
	const sideChatTasks = getSideChatTasksFromHitaishiBridge();
	let vaultHighlights = [];
	try {
		vaultHighlights = (KnowledgeVaultStore.getItems?.() || []).slice(0, 8).map((it) => ({
			title: String(it.title || "Saved Item").slice(0, 80),
			type: String(it.type || "note"),
			summary: String(it.content || it.summary || "").slice(0, 220)
		}));
	} catch {}
	let studyLoopDueCount = 0;
	try {
		const cards = StudyLoopStore.getCards?.() || [];
		const now = Date.now();
		studyLoopDueCount = Array.isArray(cards) ? cards.filter((c) => (c?.dueAt || 0) <= now).length : 0;
	} catch {}
	return {
		scope,
		activeChatThread: activeThread,
		recentThreads,
		activeStudySpace,
		sideChatTasks,
		vaultHighlights,
		studyLoopDueCount
	};
}
function getSavedHitaishiHistory(characterId) {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(HITAISHI_HISTORY_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		if (characterId) return parsed.filter((m) => !m.characterId || m.characterId === characterId).slice(-24);
		return parsed.slice(-24);
	} catch {
		return [];
	}
}
function saveHitaishiHistory(turns) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(HITAISHI_HISTORY_KEY, JSON.stringify(turns.slice(-40)));
	} catch {}
}
/**
* Syncs a Hitaishi voice/text exchange back to the user's Main Chat threads and/or Study Space tutor chat
* so all workspaces stay unified in real time.
*/
function syncHitaishiTurnAcrossWorkspaces(params) {
	if (typeof window === "undefined") return;
	const { characterName, userText, replyText, syncToMainChat, syncToStudyChat } = params;
	if (!userText.trim() && !replyText.trim()) return;
	if (syncToStudyChat) try {
		const currentStudy = getStudyWorkspaceFromHitaishiBridge();
		if (currentStudy) {
			const nextTurns = [
				...(currentStudy.studyChatTurns || []).slice(-14),
				...userText.trim() ? [{
					role: "user",
					content: userText.trim()
				}] : [],
				...replyText.trim() ? [{
					role: "assistant",
					content: `[${characterName}]: ${replyText.trim()}`
				}] : []
			];
			saveStudyWorkspaceToHitaishiBridge({
				...currentStudy,
				studyChatTurns: nextTurns
			});
		}
	} catch {}
	if (syncToMainChat) try {
		const rawThreads = localStorage.getItem("kinich_threads_v2") || localStorage.getItem("kinich_threads");
		const threads = rawThreads ? JSON.parse(rawThreads) : [];
		if (Array.isArray(threads)) {
			const now = Date.now();
			const userMsg = {
				id: `hitaishi-u-${now}`,
				role: "user",
				content: userText.trim(),
				timestamp: new Date(now).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit"
				})
			};
			const aiMsg = {
				id: `hitaishi-a-${now + 1}`,
				role: "assistant",
				content: `**${characterName} (Hitaishi Stage):** ${replyText.trim()}`,
				timestamp: new Date(now + 1).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit"
				})
			};
			const activeId = localStorage.getItem("kinich_active_thread");
			const idx = threads.findIndex((t) => t && t.id === activeId);
			if (idx >= 0) threads[idx] = {
				...threads[idx],
				updatedAt: now,
				messages: [
					...Array.isArray(threads[idx].messages) ? threads[idx].messages : [],
					userMsg,
					aiMsg
				]
			};
			else {
				const newThreadId = `thread-hitaishi-${now}`;
				threads.unshift({
					id: newThreadId,
					title: `${characterName}: ${userText.trim().slice(0, 36)}`,
					updatedAt: now,
					messages: [userMsg, aiMsg]
				});
				localStorage.setItem("kinich_active_thread", newThreadId);
			}
			const serialized = JSON.stringify(threads.slice(0, 50));
			localStorage.setItem("kinich_threads_v2", serialized);
			localStorage.setItem("kinich_threads", serialized);
			window.dispatchEvent(new CustomEvent("hitaishi-threads-synced"));
		}
	} catch {}
}
function openHitaishiWithWorkspaceScope(scope, initialPrompt) {
	if (typeof window === "undefined") return;
	setSavedHitaishiScope(scope);
	if (initialPrompt) try {
		sessionStorage.setItem("hitaishi_pending_prompt", initialPrompt);
	} catch {}
	window.dispatchEvent(new CustomEvent("kinich-open-hitaishi", { detail: {
		scope,
		initialPrompt
	} }));
}
//#endregion
export { saveHitaishiHistory as a, setSavedHitaishiScope as c, openHitaishiWithWorkspaceScope as i, syncHitaishiTurnAcrossWorkspaces as l, getSavedHitaishiHistory as n, saveSideChatTasksToHitaishiBridge as o, getSavedHitaishiScope as r, saveStudyWorkspaceToHitaishiBridge as s, buildHitaishiWorkspaceContextPayload as t };
