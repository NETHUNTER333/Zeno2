import { $ as signInWithEmailAndPassword, A as createUserWithEmailAndPassword, P as getAuth, a as getDocs, d as where, f as collection, g as setLogLevel, h as initializeFirestore, i as getDocFromServer, j as deleteUser, l as query, m as getFirestore, n as getDoc, p as doc, q as sendPasswordResetEmail, r as getDocFromCache, s as memoryLocalCache, t as deleteDoc, u as setDoc, ut as initializeApp } from "./firebase-CeWUhFTz.js";
var firebase_applet_config_default = {
	projectId: "sustained-chiller-36tp2",
	appId: "1:129041528700:web:8b89a45cd55dbf4df4d6f9",
	apiKey: "AIzaSyAfdclolCt9sym2WumBtk1qGFAnFifyu5k",
	authDomain: "sustained-chiller-36tp2.firebaseapp.com",
	firestoreDatabaseId: "ai-studio-zeno-07b7e642-7c47-4acb-833f-ea0fb4f2013b",
	storageBucket: "sustained-chiller-36tp2.firebasestorage.app",
	messagingSenderId: "129041528700",
	measurementId: "",
	oAuthClientId: "129041528700-0ud5ba14sirc78qgktuausb7svra8tql.apps.googleusercontent.com",
	recaptchaSiteKey: ""
};
//#endregion
//#region src/lib/firebase.ts
try {
	setLogLevel("silent");
} catch {}
var app = initializeApp(firebase_applet_config_default);
var databaseId = firebase_applet_config_default.firestoreDatabaseId;
function initFirestoreInstance() {
	try {
		if (typeof initializeFirestore === "function") return initializeFirestore(app, {
			localCache: typeof memoryLocalCache === "function" ? memoryLocalCache() : void 0,
			experimentalAutoDetectLongPolling: true
		}, databaseId);
	} catch {}
	return getFirestore(app, databaseId);
}
var db = initFirestoreInstance();
var auth = getAuth(app);
async function validateFirestoreConnection() {
	if (typeof window === "undefined" || typeof getDocFromServer !== "function") return;
	try {
		await getDocFromServer(doc(db, "test", "connection"));
	} catch (error) {
		if (error instanceof Error && error.message.includes("the client is offline")) console.warn("Please check your Firebase configuration (Firestore client is offline).");
	}
}
validateFirestoreConnection();
function isFirestoreOfflineError(error) {
	if (!error) return false;
	const code = typeof error?.code === "string" ? error.code : "";
	const msg = error instanceof Error ? error.message : String(error);
	return code === "unavailable" || code === "failed-precondition" || /client is offline/i.test(msg) || /could not reach cloud firestore backend/i.test(msg) || /operation could not be completed/i.test(msg) || /failed to get document because the client is offline/i.test(msg) || /network error/i.test(msg);
}
function handleFirestoreError(error, operationType, path) {
	if (isFirestoreOfflineError(error)) return;
	const errInfo = {
		error: error instanceof Error ? error.message : String(error),
		authInfo: {
			userId: auth.currentUser?.uid,
			email: auth.currentUser?.email,
			emailVerified: auth.currentUser?.emailVerified,
			isAnonymous: auth.currentUser?.isAnonymous,
			tenantId: auth.currentUser?.tenantId,
			providerInfo: auth.currentUser?.providerData?.map((provider) => ({
				providerId: provider.providerId,
				email: provider.email
			})) || []
		},
		operationType,
		path
	};
	console.error("Firestore Error: ", JSON.stringify(errInfo));
	throw new Error(JSON.stringify(errInfo));
}
function stripUndefined(obj) {
	if (obj === null || typeof obj !== "object") return obj;
	if (Array.isArray(obj)) return obj.map(stripUndefined);
	const cleaned = {};
	for (const [k, v] of Object.entries(obj)) if (v !== void 0) cleaned[k] = stripUndefined(v);
	return cleaned;
}
async function getAuthHeaders(extraHeaders = {}) {
	const headers = {
		"Content-Type": "application/json",
		...extraHeaders
	};
	try {
		const user = auth.currentUser;
		if (user) {
			const token = await user.getIdToken();
			if (token) headers["Authorization"] = `Bearer ${token}`;
		}
	} catch {}
	return headers;
}
async function saveChatThreadToFirestore(thread) {
	const user = auth.currentUser;
	if (!user) return;
	const safeThreadId = String(thread.id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/threads/${safeThreadId}`;
	try {
		let sanitizedMessages = (thread.messages || []).filter((m) => !m.isStreaming).slice(-150).map((m) => {
			const msgCopy = { ...m };
			if (typeof msgCopy.content === "string" && msgCopy.content.length > 24e3) msgCopy.content = msgCopy.content.slice(0, 24e3);
			if (Array.isArray(msgCopy.attachments)) msgCopy.attachments = msgCopy.attachments.slice(0, 10).map((att) => ({
				name: String(att.name || "file").slice(0, 200),
				type: String(att.type || "application/octet-stream").slice(0, 100),
				size: Number(att.size) || 0
			}));
			if (Array.isArray(msgCopy.sources) && msgCopy.sources.length > 10) msgCopy.sources = msgCopy.sources.slice(0, 10);
			if (Array.isArray(msgCopy.images) && msgCopy.images.length > 8) msgCopy.images = msgCopy.images.slice(0, 8);
			if (Array.isArray(msgCopy.videos) && msgCopy.videos.length > 6) msgCopy.videos = msgCopy.videos.slice(0, 6);
			return stripUndefined(msgCopy);
		});
		while (sanitizedMessages.length > 1 && JSON.stringify(sanitizedMessages).length > 82e4) sanitizedMessages = sanitizedMessages.slice(Math.ceil(sanitizedMessages.length * .25));
		const payload = stripUndefined({
			id: safeThreadId,
			userId: user.uid,
			title: String(thread.title || "New Chat").slice(0, 200),
			createdAt: Number(thread.createdAt) || Date.now(),
			updatedAt: Date.now(),
			messages: sanitizedMessages
		});
		await setDoc(doc(db, "users", user.uid, "threads", safeThreadId), payload);
	} catch (error) {
		handleFirestoreError(error, "write", path);
	}
}
async function loadUserChatThreadsFromFirestore() {
	const user = auth.currentUser;
	if (!user) return [];
	const path = `users/${user.uid}/threads`;
	try {
		const q = query(collection(db, "users", user.uid, "threads"), where("userId", "==", user.uid));
		const loaded = (await getDocs(q)).docs.map((d) => d.data());
		loaded.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
		return loaded;
	} catch (error) {
		handleFirestoreError(error, "list", path);
		return [];
	}
}
async function deleteChatThreadFromFirestore(threadId) {
	const user = auth.currentUser;
	if (!user) return;
	const safeThreadId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/threads/${safeThreadId}`;
	try {
		await deleteDoc(doc(db, "users", user.uid, "threads", safeThreadId));
	} catch (error) {
		handleFirestoreError(error, "delete", path);
	}
}
async function clearAllChatThreadsFromFirestore(threadIds) {
	if (!auth.currentUser) return;
	for (const tid of threadIds) await deleteChatThreadFromFirestore(tid);
}
async function saveBookmarkToFirestore(bookmark) {
	const user = auth.currentUser;
	if (!user) return;
	const safeBookmarkId = String(bookmark.id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/bookmarks/${safeBookmarkId}`;
	try {
		const payload = {
			id: safeBookmarkId,
			userId: user.uid,
			threadId: String(bookmark.threadId || "default").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128),
			messageId: String(bookmark.messageId || "msg").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128),
			role: bookmark.role === "user" ? "user" : "assistant",
			snippet: String(bookmark.snippet || "").slice(0, 2e3),
			threadTitle: String(bookmark.threadTitle || "Saved Chat").slice(0, 200),
			savedAt: Number(bookmark.savedAt) || Date.now()
		};
		await setDoc(doc(db, "users", user.uid, "bookmarks", safeBookmarkId), payload);
	} catch (error) {
		handleFirestoreError(error, "write", path);
	}
}
async function deleteBookmarkFromFirestore(bookmarkId) {
	const user = auth.currentUser;
	if (!user) return;
	const safeBookmarkId = String(bookmarkId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/bookmarks/${safeBookmarkId}`;
	try {
		await deleteDoc(doc(db, "users", user.uid, "bookmarks", safeBookmarkId));
	} catch (error) {
		handleFirestoreError(error, "delete", path);
	}
}
async function loadUserBookmarksFromFirestore() {
	const user = auth.currentUser;
	if (!user) return [];
	const path = `users/${user.uid}/bookmarks`;
	try {
		const q = query(collection(db, "users", user.uid, "bookmarks"), where("userId", "==", user.uid));
		const loaded = (await getDocs(q)).docs.map((d) => d.data());
		loaded.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
		return loaded;
	} catch (error) {
		handleFirestoreError(error, "list", path);
		return [];
	}
}
var inflightProfileSyncs = /* @__PURE__ */ new Map();
async function ensureUserProfileInFirestore(user, fallbackDisplayName) {
	if (!user || !user.uid) return null;
	const existingInflight = inflightProfileSyncs.get(user.uid);
	if (existingInflight) return existingInflight;
	const syncPromise = (async () => {
		const fallbackDoc = {
			uid: user.uid,
			displayName: (user.displayName || fallbackDisplayName || (user.email ? user.email.split("@")[0] : "User")).slice(0, 100),
			email: (user.email || "").slice(0, 200),
			photoURL: (user.photoURL || "").slice(0, 500),
			createdAt: Date.now()
		};
		const userRef = doc(db, "users", user.uid);
		try {
			const userSnap = await getDoc(userRef);
			if (userSnap.exists()) return userSnap.data();
			await setDoc(userRef, fallbackDoc);
			return fallbackDoc;
		} catch (error) {
			if (isFirestoreOfflineError(error)) {
				try {
					if (typeof getDocFromCache === "function") {
						const cachedSnap = await getDocFromCache(userRef);
						if (cachedSnap.exists()) return cachedSnap.data();
					}
				} catch {}
				return fallbackDoc;
			}
			console.warn("Could not sync user profile to Firestore, using local fallback:", error);
			return fallbackDoc;
		}
	})();
	inflightProfileSyncs.set(user.uid, syncPromise);
	try {
		return await syncPromise;
	} finally {
		inflightProfileSyncs.delete(user.uid);
	}
}
async function signUpWithEmail(email, pass) {
	try {
		const user = (await createUserWithEmailAndPassword(auth, email, pass)).user;
		try {
			await ensureUserProfileInFirestore(user, email.split("@")[0]);
		} catch (e) {
			console.warn("Non-fatal profile sync error after sign up:", e);
		}
		return user;
	} catch (error) {
		if (error?.code === "auth/email-already-in-use") {
			const loginCred = await signInWithEmailAndPassword(auth, email, pass);
			try {
				await ensureUserProfileInFirestore(loginCred.user, email.split("@")[0]);
			} catch (e) {
				console.warn("Non-fatal profile sync error after login:", e);
			}
			return loginCred.user;
		}
		throw error;
	}
}
async function signInWithEmail(email, pass) {
	const cred = await signInWithEmailAndPassword(auth, email, pass);
	try {
		await ensureUserProfileInFirestore(cred.user, email.split("@")[0]);
	} catch (e) {
		console.warn("Non-fatal profile sync error after email login:", e);
	}
	return cred.user;
}
async function sendPasswordReset(email) {
	await sendPasswordResetEmail(auth, email);
}
async function deleteUserAccount() {
	const user = auth.currentUser;
	if (!user) throw new Error("No authenticated user");
	try {
		const userRef = doc(db, "users", user.uid);
		try {
			await deleteDoc(userRef);
		} catch (e) {
			if (!isFirestoreOfflineError(e)) console.error("Error deleting user firestore document:", e);
		}
		await deleteUser(user);
	} catch (error) {
		console.error("Delete account error:", error);
		throw error;
	}
}
async function publishSharedThreadToFirestore(thread) {
	const shareId = `sh_${String(thread.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "")}_${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
	const sanitizedMessages = (thread.messages || []).filter((m) => !m.isStreaming).slice(0, 120).map((m) => stripUndefined({
		id: String(m.id || `msg-${Date.now()}`),
		role: m.role === "user" ? "user" : "assistant",
		content: String(m.content || "").slice(0, 18e3),
		timestamp: Number(m.timestamp) || Date.now(),
		modelUsed: m.modelUsed ? String(m.modelUsed).slice(0, 80) : void 0,
		sources: Array.isArray(m.sources) ? m.sources.slice(0, 8) : void 0,
		arxivPapers: Array.isArray(m.arxivPapers) ? m.arxivPapers.slice(0, 4) : void 0,
		githubRepos: Array.isArray(m.githubRepos) ? m.githubRepos.slice(0, 4) : void 0,
		financeQuotes: Array.isArray(m.financeQuotes) ? m.financeQuotes.slice(0, 4) : void 0
	}));
	const snapshotPayload = {
		id: shareId,
		ownerId: auth.currentUser?.uid || "guest_owner",
		title: String(thread.title || "Shared Kinich Thread").slice(0, 200),
		createdAt: Number(thread.createdAt) || Date.now(),
		messages: sanitizedMessages
	};
	try {
		localStorage.setItem(`kinich_shared_${shareId}`, JSON.stringify(snapshotPayload));
	} catch {}
	try {
		await setDoc(doc(db, "shared_threads", shareId), snapshotPayload);
	} catch {
		try {
			await fetch("/api/share/snapshot", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(snapshotPayload)
			});
		} catch {}
	}
	return shareId;
}
async function loadSharedThreadFromFirestore(shareId) {
	const safeId = String(shareId || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	if (!safeId) return null;
	try {
		const localRaw = localStorage.getItem(`kinich_shared_${safeId}`);
		if (localRaw) {
			const parsed = JSON.parse(localRaw);
			if (parsed && Array.isArray(parsed.messages)) return parsed;
		}
	} catch {}
	try {
		const snap = await getDoc(doc(db, "shared_threads", safeId));
		if (snap.exists()) return snap.data();
	} catch {}
	try {
		const res = await fetch(`/api/share/snapshot/${encodeURIComponent(safeId)}`);
		if (res.ok) {
			const json = await res.json();
			if (json && json.snapshot && Array.isArray(json.snapshot.messages)) return json.snapshot;
		}
	} catch {}
	return null;
}
async function saveVaultItemToFirestore(item) {
	const user = auth.currentUser;
	if (!user) return;
	const safeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const safeCollectionId = String(item.collectionId || "col_general").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/vault_items/${safeId}`;
	try {
		const payload = stripUndefined({
			id: safeId,
			userId: user.uid,
			type: String(item.type || item.sourceType || "chat_answer").slice(0, 40),
			title: String(item.title || "Saved Insight").slice(0, 200),
			subject: String(item.subject || "General Studies").slice(0, 80),
			chapter: String(item.chapter || "Core Concepts").slice(0, 120),
			content: String(item.content || "").slice(0, 24e3),
			summary: item.summary ? String(item.summary).slice(0, 500) : void 0,
			collectionId: safeCollectionId,
			sourceType: String(item.sourceType || item.type || "chat_answer").slice(0, 40),
			sourceUrl: item.sourceUrl ? String(item.sourceUrl).slice(0, 500) : "",
			timestamps: Array.isArray(item.timestamps) ? item.timestamps.slice(0, 50).map((t) => typeof t === "string" ? t.slice(0, 80) : `[${t.time || `${Math.floor((t.timeSec || 0) / 60)}:${String((t.timeSec || 0) % 60).padStart(2, "0")}`}] ${t.label || ""}`.slice(0, 80)) : [],
			tags: Array.isArray(item.tags) ? item.tags.slice(0, 10).map((t) => String(t).slice(0, 32)) : [],
			relatedItemIds: Array.isArray(item.relatedItemIds) ? item.relatedItemIds.slice(0, 20).map((r) => String(r).slice(0, 128)) : [],
			sageNote: item.sageNote ? String(item.sageNote).slice(0, 300) : "",
			organizedBySage: Boolean(item.organizedBySage),
			isPinned: Boolean(item.isPinned),
			createdAt: Number(item.createdAt) || Date.now(),
			updatedAt: Number(item.updatedAt) || Date.now(),
			lastReviewedAt: Number(item.lastReviewedAt || item.updatedAt || item.createdAt) || Date.now()
		});
		await setDoc(doc(db, "users", user.uid, "vault_items", safeId), payload);
	} catch (error) {
		handleFirestoreError(error, "write", path);
	}
}
async function deleteVaultItemFromFirestore(itemId) {
	const user = auth.currentUser;
	if (!user) return;
	const safeId = String(itemId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/vault_items/${safeId}`;
	try {
		await deleteDoc(doc(db, "users", user.uid, "vault_items", safeId));
	} catch (error) {
		handleFirestoreError(error, "delete", path);
	}
}
async function loadUserVaultItemsFromFirestore() {
	const user = auth.currentUser;
	if (!user) return [];
	const path = `users/${user.uid}/vault_items`;
	try {
		const q = query(collection(db, "users", user.uid, "vault_items"), where("userId", "==", user.uid));
		const items = (await getDocs(q)).docs.map((d) => d.data());
		items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
		return items;
	} catch (error) {
		handleFirestoreError(error, "list", path);
		return [];
	}
}
async function saveVaultThreadToFirestore(thread) {
	const user = auth.currentUser;
	if (!user) return;
	const safeId = String(thread.id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/vault_threads/${safeId}`;
	try {
		const payload = stripUndefined({
			id: safeId,
			userId: user.uid,
			type: String(thread.type || "text").slice(0, 32),
			title: String(thread.title || "Untitled Thread").slice(0, 300),
			sourceUrl: thread.sourceUrl ? String(thread.sourceUrl).slice(0, 2048) : "",
			thumbnail: thread.thumbnail ? String(thread.thumbnail).slice(0, 1e3) : "",
			tldr: String(thread.tldr || "").slice(0, 600),
			keyPoints: Array.isArray(thread.keyPoints) ? thread.keyPoints.slice(0, 20).map((kp, idx) => ({
				id: String(kp.id || `kp_${idx}`).slice(0, 64),
				text: String(kp.text || "").slice(0, 300),
				timestamp: kp.timestamp ? String(kp.timestamp).slice(0, 20) : void 0,
				score: Number(kp.score) || 1
			})) : [],
			subject: String(thread.subject || "General Studies").slice(0, 120),
			chapter: String(thread.chapter || "Core Concepts").slice(0, 160),
			tags: Array.isArray(thread.tags) ? thread.tags.slice(0, 15).map((t) => String(t).slice(0, 32)) : [],
			createdAt: Number(thread.createdAt) || Date.now(),
			updatedAt: Number(thread.updatedAt) || Date.now(),
			pinned: Boolean(thread.pinned),
			score: Number(thread.score) || 1,
			commentCount: Number(thread.commentCount) || 0
		});
		await setDoc(doc(db, "users", user.uid, "vault_threads", safeId), payload);
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function loadVaultThreadsFromFirestore() {
	const user = auth.currentUser;
	if (!user) return [];
	const path = `users/${user.uid}/vault_threads`;
	try {
		const q = query(collection(db, "users", user.uid, "vault_threads"), where("userId", "==", user.uid));
		const threads = (await getDocs(q)).docs.map((d) => d.data());
		threads.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
		return threads;
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "list", path);
		return [];
	}
}
async function deleteVaultThreadFromFirestore(threadId) {
	const user = auth.currentUser;
	if (!user) return;
	const safeId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/vault_threads/${safeId}`;
	try {
		await deleteDoc(doc(db, "users", user.uid, "vault_threads", safeId));
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "delete", path);
	}
}
async function saveVaultCommentToFirestore(comment) {
	const user = auth.currentUser;
	if (!user) return;
	const safeThreadId = String(comment.threadId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const safeCommentId = String(comment.id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/vault_threads/${safeThreadId}/comments/${safeCommentId}`;
	try {
		const payload = stripUndefined({
			id: safeCommentId,
			threadId: safeThreadId,
			userId: user.uid,
			author: String(comment.author || "user").slice(0, 64),
			authorName: String(comment.authorName || "Student").slice(0, 100),
			text: String(comment.text || "").slice(0, 5e3),
			createdAt: Number(comment.createdAt) || Date.now(),
			parentId: comment.parentId ? String(comment.parentId).slice(0, 128) : null,
			score: Number(comment.score) || 1
		});
		await setDoc(doc(db, "users", user.uid, "vault_threads", safeThreadId, "comments", safeCommentId), payload);
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function saveAgentMemoryToFirestore(agentId, facts) {
	const user = auth.currentUser;
	if (!user) return;
	const safeAgentId = String(agentId || "sage").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
	const path = `users/${user.uid}/agent_memory/${safeAgentId}`;
	try {
		const cleanFacts = Array.from(new Set((Array.isArray(facts) ? facts : []).map((f) => String(f || "").trim().slice(0, 160)).filter(Boolean))).slice(0, 50);
		await setDoc(doc(db, "users", user.uid, "agent_memory", safeAgentId), {
			agentId: safeAgentId,
			userId: user.uid,
			facts: cleanFacts,
			updatedAt: Date.now()
		});
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function loadAgentMemoryFromFirestore(agentId = "sage") {
	const user = auth.currentUser;
	if (!user) return [];
	const safeAgentId = String(agentId || "sage").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
	const path = `users/${user.uid}/agent_memory/${safeAgentId}`;
	try {
		const snap = await getDoc(doc(db, "users", user.uid, "agent_memory", safeAgentId));
		if (!snap.exists()) return [];
		const data = snap.data();
		return Array.isArray(data?.facts) ? data.facts.slice(0, 50) : [];
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "get", path);
		return [];
	}
}
async function recordAgentUsageToFirestore(input) {
	const user = auth.currentUser;
	if (!user) return;
	const safeAgentId = String(input.agentId || "sage").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
	const usageDate = String(input.usageDate || getCurrentUtcDateString()).slice(0, 16);
	const usageId = `${usageDate}_${safeAgentId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
	const path = `users/${user.uid}/agent_usage/${usageId}`;
	const docRef = doc(db, "users", user.uid, "agent_usage", usageId);
	try {
		let existingTokens = 0;
		let existingCalls = 0;
		try {
			const snap = await getDoc(docRef);
			if (snap.exists()) {
				const d = snap.data();
				existingTokens = Number(d?.tokensUsed || 0);
				existingCalls = Number(d?.callsCount || 0);
			}
		} catch {}
		await setDoc(docRef, {
			usageId,
			userId: user.uid,
			agentId: safeAgentId,
			usageDate,
			tokensUsed: Math.max(0, existingTokens + Math.max(0, Math.floor(Number(input.tokensUsed || 0)))),
			callsCount: Math.max(0, existingCalls + Math.max(1, Math.floor(Number(input.callsCount || 1)))),
			updatedAt: Date.now()
		});
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function savePublicArtifactToFirestore(artifact) {
	const user = auth.currentUser;
	if (!user) return;
	const safeId = String(artifact.id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `public_artifacts/${safeId}`;
	try {
		const payload = stripUndefined({
			id: safeId,
			ownerId: user.uid,
			authorName: String(artifact.authorName || user.displayName || "Kinich Researcher").slice(0, 100),
			title: String(artifact.title || "Kinich Resource").slice(0, 200),
			summary: String(artifact.summary || "").slice(0, 500),
			content: String(artifact.content || "").slice(0, 32e3),
			category: String(artifact.category || "Research").slice(0, 50),
			visibility: artifact.visibility === "private" ? "private" : "public",
			outputType: String(artifact.outputType || "research_summary").slice(0, 50),
			tags: Array.isArray(artifact.tags) ? artifact.tags.slice(0, 10).map((t) => String(t).slice(0, 32)) : [],
			createdAt: Number(artifact.createdAt) || Date.now(),
			updatedAt: Number(artifact.updatedAt) || Date.now()
		});
		await setDoc(doc(db, "public_artifacts", safeId), payload);
	} catch (error) {
		handleFirestoreError(error, "write", path);
	}
}
async function deletePublicArtifactFromFirestore(artifactId) {
	if (!auth.currentUser) return;
	const safeId = String(artifactId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `public_artifacts/${safeId}`;
	try {
		await deleteDoc(doc(db, "public_artifacts", safeId));
	} catch (error) {
		handleFirestoreError(error, "delete", path);
	}
}
function getCurrentUtcDateString() {
	return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
async function loadUserDailyQuotaFromFirestore(quotaDate = getCurrentUtcDateString()) {
	const user = auth.currentUser;
	if (!user) return null;
	const safeDate = String(quotaDate).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
	const path = `users/${user.uid}/quotas/${safeDate}`;
	try {
		const snap = await getDoc(doc(db, "users", user.uid, "quotas", safeDate));
		if (!snap.exists()) return null;
		return snap.data();
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "get", path);
		return null;
	}
}
async function syncUserDailyQuotaToFirestore(input) {
	const user = auth.currentUser;
	if (!user) return null;
	const safeDate = String(input.quotaDate || getCurrentUtcDateString()).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
	const path = `users/${user.uid}/quotas/${safeDate}`;
	const docRef = doc(db, "users", user.uid, "quotas", safeDate);
	try {
		let existing = null;
		try {
			const snap = await getDoc(docRef);
			if (snap.exists()) existing = snap.data();
		} catch {}
		const validPlan = input.plan === "fire" || input.plan === "spark" ? input.plan : "free";
		const payload = {
			quotaDate: safeDate,
			userId: user.uid,
			plan: validPlan,
			messagesUsed: Math.max(Number(existing?.messagesUsed || 0), Math.max(0, Math.floor(Number(input.messagesUsed || 0)))),
			filesUploaded: Math.max(Number(existing?.filesUploaded || 0), Math.max(0, Math.floor(Number(input.filesUploaded || 0)))),
			searchesUsed: Math.max(Number(existing?.searchesUsed || 0), Math.max(0, Math.floor(Number(input.searchesUsed || 0)))),
			deepResearchUsed: Math.max(Number(existing?.deepResearchUsed || 0), Math.max(0, Math.floor(Number(input.deepResearchUsed || 0)))),
			pdfStudyUsed: Math.max(Number(existing?.pdfStudyUsed || 0), Math.max(0, Math.floor(Number(input.pdfStudyUsed || 0)))),
			tokensUsed: Math.max(Number(existing?.tokensUsed || 0), Math.max(0, Math.floor(Number(input.tokensUsed || 0)))),
			updatedAt: Date.now()
		};
		await setDoc(docRef, payload);
		return payload;
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
		return null;
	}
}
async function saveExamToFirestore(exam) {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return;
	const safeId = String(exam.id || `exam_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/exams/${safeId}`;
	try {
		const cleanChapters = (Array.isArray(exam.chapters) ? exam.chapters : []).map((c) => String(c || "").trim().slice(0, 160)).filter(Boolean).slice(0, 100);
		if (cleanChapters.length === 0) cleanChapters.push("Core Syllabus");
		const cleanPlanDays = (Array.isArray(exam.planDays) ? exam.planDays : []).slice(0, 366).map((pd, idx) => ({
			dateIst: String(pd?.dateIst || "").slice(0, 16),
			dayNumber: Number(pd?.dayNumber || idx + 1),
			isFullRevision: Boolean(pd?.isFullRevision),
			chapters: Array.isArray(pd?.chapters) ? pd.chapters.slice(0, 20).map((c) => String(c || "").slice(0, 160)) : [],
			completed: Boolean(pd?.completed)
		}));
		const payload = stripUndefined({
			id: safeId,
			userId: user.uid,
			name: String(exam.name || "Upcoming Exam").trim().slice(0, 160) || "Upcoming Exam",
			examDate: String(exam.examDate || "").slice(0, 32) || getCurrentUtcDateString(),
			subject: exam.subject ? String(exam.subject).slice(0, 120) : "General Studies",
			chapters: cleanChapters,
			planDays: cleanPlanDays,
			lastReplannedAt: exam.lastReplannedAt ? String(exam.lastReplannedAt).slice(0, 32) : "",
			createdAt: Number(exam.createdAt) > 0 ? Number(exam.createdAt) : Date.now(),
			updatedAt: Number(exam.updatedAt) > 0 ? Number(exam.updatedAt) : Date.now()
		});
		await setDoc(doc(db, "users", user.uid, "exams", safeId), payload);
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function loadExamsFromFirestore() {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return [];
	const path = `users/${user.uid}/exams`;
	try {
		const q = query(collection(db, "users", user.uid, "exams"), where("userId", "==", user.uid));
		const exams = (await getDocs(q)).docs.map((d) => d.data());
		exams.sort((a, b) => String(a.examDate || "").localeCompare(String(b.examDate || "")));
		return exams;
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "list", path);
		return [];
	}
}
async function deleteExamFromFirestore(examId) {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return;
	const safeId = String(examId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/exams/${safeId}`;
	try {
		await deleteDoc(doc(db, "users", user.uid, "exams", safeId));
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "delete", path);
	}
}
async function saveRecallCardToFirestore(card) {
	const user = auth.currentUser;
	if (!user) return;
	const safeId = String(card.id || `card_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/cards/${safeId}`;
	try {
		const validGrade = card.lastGrade === "again" || card.lastGrade === "hard" || card.lastGrade === "good" || card.lastGrade === "easy" ? card.lastGrade : void 0;
		const payload = stripUndefined({
			id: safeId,
			userId: user.uid,
			type: card.type === "quiz" ? "quiz" : "flashcard",
			front: String(card.front || "Question").trim().slice(0, 2e3) || "Question",
			back: String(card.back || "Answer").trim().slice(0, 4e3) || "Answer",
			options: Array.isArray(card.options) ? card.options.slice(0, 6).map((o) => String(o || "").slice(0, 500)) : void 0,
			correctIndex: typeof card.correctIndex === "number" && card.correctIndex >= 0 && card.correctIndex <= 5 ? Math.floor(card.correctIndex) : void 0,
			explanation: card.explanation ? String(card.explanation).slice(0, 2e3) : void 0,
			subject: String(card.subject || "General Studies").trim().slice(0, 120) || "General Studies",
			chapter: String(card.chapter || "Core Concepts").trim().slice(0, 160) || "Core Concepts",
			examId: card.examId ? String(card.examId).slice(0, 128) : void 0,
			sourceId: card.sourceId ? String(card.sourceId).slice(0, 128) : void 0,
			pageOrTimestamp: card.pageOrTimestamp ? String(card.pageOrTimestamp).slice(0, 64) : void 0,
			ease: Math.max(1.3, Math.min(4, Number(card.ease) || 2.5)),
			interval: Math.max(0, Math.min(3650, Math.floor(Number(card.interval) || 0))),
			repetitions: Math.max(0, Math.min(1e4, Math.floor(Number(card.repetitions) || 0))),
			dueAt: Number(card.dueAt) > 0 ? Number(card.dueAt) : Date.now(),
			lastGrade: validGrade,
			lastReviewedAt: Number(card.lastReviewedAt) > 0 ? Number(card.lastReviewedAt) : void 0,
			wrongCount: Math.max(0, Math.floor(Number(card.wrongCount) || 0)),
			correctCount: Math.max(0, Math.floor(Number(card.correctCount) || 0)),
			createdAt: Number(card.createdAt) > 0 ? Number(card.createdAt) : Date.now(),
			updatedAt: Number(card.updatedAt) > 0 ? Number(card.updatedAt) : Date.now()
		});
		await setDoc(doc(db, "users", user.uid, "cards", safeId), payload);
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function loadRecallCardsFromFirestore() {
	const user = auth.currentUser;
	if (!user) return [];
	const path = `users/${user.uid}/cards`;
	try {
		const q = query(collection(db, "users", user.uid, "cards"), where("userId", "==", user.uid));
		const cards = (await getDocs(q)).docs.map((d) => d.data());
		cards.sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
		return cards;
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "list", path);
		return [];
	}
}
async function saveQuizBattleToFirestore(battle) {
	const safeId = String(battle.id || `qb_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `quiz_battles/${safeId}`;
	try {
		const payload = {
			id: safeId,
			title: String(battle.title || "Kinich Quiz Battle").trim().slice(0, 200) || "Kinich Quiz Battle",
			topic: String(battle.topic || "General Studies").trim().slice(0, 160) || "General Studies",
			creatorName: String(battle.creatorName || "Kinich Challenger").trim().slice(0, 100) || "Kinich Challenger",
			questions: Array.isArray(battle.questions) ? battle.questions.slice(0, 20) : [],
			entries: Array.isArray(battle.entries) ? battle.entries.slice(0, 100) : [],
			createdAt: Number(battle.createdAt) > 0 ? Number(battle.createdAt) : Date.now(),
			updatedAt: Number(battle.updatedAt) > 0 ? Number(battle.updatedAt) : Date.now()
		};
		await setDoc(doc(db, "quiz_battles", safeId), payload);
	} catch (error) {
		if (!isFirestoreOfflineError(error)) try {
			handleFirestoreError(error, "write", path);
		} catch {}
	}
}
async function loadQuizBattleFromFirestore(battleId) {
	const safeId = String(battleId || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	if (!safeId) return null;
	const path = `quiz_battles/${safeId}`;
	try {
		const snap = await getDoc(doc(db, "quiz_battles", safeId));
		if (!snap.exists()) return null;
		return snap.data();
	} catch (error) {
		if (!isFirestoreOfflineError(error)) try {
			handleFirestoreError(error, "get", path);
		} catch {}
		return null;
	}
}
async function appendQuizBattleEntryToFirestore(battleId, entry) {
	const safeId = String(battleId || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	if (!safeId) return null;
	const path = `quiz_battles/${safeId}`;
	try {
		const existing = await loadQuizBattleFromFirestore(safeId);
		if (!existing) return null;
		const nextEntries = [...Array.isArray(existing.entries) ? existing.entries : [], entry].sort((a, b) => b.score - a.score || a.timeMs - b.timeMs).slice(0, 100);
		const updated = {
			...existing,
			entries: nextEntries,
			updatedAt: Date.now()
		};
		await setDoc(doc(db, "quiz_battles", safeId), updated);
		return updated;
	} catch (error) {
		if (!isFirestoreOfflineError(error)) try {
			handleFirestoreError(error, "update", path);
		} catch {}
		return null;
	}
}
async function savePlaylistCourseToFirestore(course) {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return;
	const safeId = String(course.id || `course_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/playlist_courses/${safeId}`;
	try {
		const payload = stripUndefined({
			id: safeId,
			userId: user.uid,
			title: String(course.title || "YouTube Playlist Course").trim().slice(0, 240) || "YouTube Playlist Course",
			playlistUrl: String(course.playlistUrl || "").slice(0, 2048),
			modules: Array.isArray(course.modules) ? course.modules.slice(0, 100) : [],
			completedVideoIds: Array.isArray(course.completedVideoIds) ? course.completedVideoIds.slice(0, 200) : [],
			finalTestQuestions: Array.isArray(course.finalTestQuestions) ? course.finalTestQuestions.slice(0, 50) : [],
			finalTestScore: typeof course.finalTestScore === "number" ? course.finalTestScore : void 0,
			progressPercent: Math.max(0, Math.min(100, Math.round(Number(course.progressPercent) || 0))),
			createdAt: Number(course.createdAt) > 0 ? Number(course.createdAt) : Date.now(),
			updatedAt: Date.now()
		});
		await setDoc(doc(db, "users", user.uid, "playlist_courses", safeId), payload);
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function loadPlaylistCoursesFromFirestore() {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return [];
	const path = `users/${user.uid}/playlist_courses`;
	try {
		const q = query(collection(db, "users", user.uid, "playlist_courses"), where("userId", "==", user.uid));
		return (await getDocs(q)).docs.map((d) => d.data()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "list", path);
		return [];
	}
}
async function saveAnswerEvaluationToFirestore(evalDoc) {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return;
	const safeId = String(evalDoc.id || `eval_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
	const path = `users/${user.uid}/answer_evaluations/${safeId}`;
	try {
		const payload = stripUndefined({
			id: safeId,
			userId: user.uid,
			question: String(evalDoc.question || "").slice(0, 2e3),
			maxMarks: evalDoc.maxMarks === 5 ? 5 : 10,
			studentAnswer: String(evalDoc.studentAnswer || "").slice(0, 15e3),
			marksAwarded: Number(evalDoc.marksAwarded) || 0,
			gradeLetter: String(evalDoc.gradeLetter || "B+").slice(0, 16),
			rubricBreakdown: Array.isArray(evalDoc.rubricBreakdown) ? evalDoc.rubricBreakdown.slice(0, 10) : [],
			missingKeywords: Array.isArray(evalDoc.missingKeywords) ? evalDoc.missingKeywords.slice(0, 25) : [],
			examinerFeedback: String(evalDoc.examinerFeedback || "").slice(0, 4e3),
			modelTopperAnswer: String(evalDoc.modelTopperAnswer || "").slice(0, 8e3),
			subject: String(evalDoc.subject || "University Exam").slice(0, 120),
			createdAt: Number(evalDoc.createdAt) > 0 ? Number(evalDoc.createdAt) : Date.now()
		});
		await setDoc(doc(db, "users", user.uid, "answer_evaluations", safeId), payload);
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function saveUserLocationPrefToFirestore(pref) {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return;
	const path = `users/${user.uid}/preferences/location`;
	try {
		const validMode = pref.mode === "precise" || pref.mode === "manual" || pref.mode === "disabled" ? pref.mode : "approximate";
		const hasCoords = (validMode === "manual" || Boolean(pref.persistPreciseLocation)) && typeof pref.preferredLatitude === "number" && Number.isFinite(pref.preferredLatitude) && pref.preferredLatitude >= -90 && pref.preferredLatitude <= 90 && typeof pref.preferredLongitude === "number" && Number.isFinite(pref.preferredLongitude) && pref.preferredLongitude >= -180 && pref.preferredLongitude <= 180;
		const payload = stripUndefined({
			id: "location",
			userId: user.uid,
			locationEnabled: Boolean(pref.locationEnabled),
			mode: validMode,
			preferredCity: pref.preferredCity ? String(pref.preferredCity).trim().slice(0, 120) : void 0,
			preferredRegion: pref.preferredRegion ? String(pref.preferredRegion).trim().slice(0, 120) : void 0,
			preferredCountry: pref.preferredCountry ? String(pref.preferredCountry).trim().slice(0, 120) : void 0,
			preferredCountryCode: pref.preferredCountryCode ? String(pref.preferredCountryCode).trim().toUpperCase().slice(0, 8) : void 0,
			preferredTimezone: pref.preferredTimezone ? String(pref.preferredTimezone).trim().slice(0, 80) : void 0,
			preferredLatitude: hasCoords ? Number(pref.preferredLatitude) : void 0,
			preferredLongitude: hasCoords ? Number(pref.preferredLongitude) : void 0,
			persistPreciseLocation: Boolean(pref.persistPreciseLocation),
			updatedAt: Number(pref.updatedAt) > 0 ? Number(pref.updatedAt) : Date.now()
		});
		await setDoc(doc(db, "users", user.uid, "preferences", "location"), payload);
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "write", path);
	}
}
async function loadUserLocationPrefFromFirestore() {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return null;
	const path = `users/${user.uid}/preferences/location`;
	try {
		const snap = await getDoc(doc(db, "users", user.uid, "preferences", "location"));
		if (!snap.exists()) return null;
		return snap.data();
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "get", path);
		return null;
	}
}
async function deleteUserLocationPrefFromFirestore() {
	const user = auth.currentUser;
	if (!user || user.isAnonymous) return;
	const path = `users/${user.uid}/preferences/location`;
	try {
		await deleteDoc(doc(db, "users", user.uid, "preferences", "location"));
	} catch (error) {
		if (!isFirestoreOfflineError(error)) handleFirestoreError(error, "delete", path);
	}
}
//#endregion
export { saveAgentMemoryToFirestore as A, saveVaultCommentToFirestore as B, loadUserChatThreadsFromFirestore as C, loadVaultThreadsFromFirestore as D, loadUserVaultItemsFromFirestore as E, savePlaylistCourseToFirestore as F, signUpWithEmail as G, saveVaultThreadToFirestore as H, savePublicArtifactToFirestore as I, syncUserDailyQuotaToFirestore as K, saveQuizBattleToFirestore as L, saveBookmarkToFirestore as M, saveChatThreadToFirestore as N, publishSharedThreadToFirestore as O, saveExamToFirestore as P, saveRecallCardToFirestore as R, loadUserBookmarksFromFirestore as S, loadUserLocationPrefFromFirestore as T, sendPasswordReset as U, saveVaultItemToFirestore as V, signInWithEmail as W, loadExamsFromFirestore as _, deleteBookmarkFromFirestore as a, loadRecallCardsFromFirestore as b, deletePublicArtifactFromFirestore as c, deleteVaultItemFromFirestore as d, deleteVaultThreadFromFirestore as f, loadAgentMemoryFromFirestore as g, isFirestoreOfflineError as h, db as i, saveAnswerEvaluationToFirestore as j, recordAgentUsageToFirestore as k, deleteUserAccount as l, getAuthHeaders as m, auth as n, deleteChatThreadFromFirestore as o, ensureUserProfileInFirestore as p, clearAllChatThreadsFromFirestore as r, deleteExamFromFirestore as s, appendQuizBattleEntryToFirestore as t, deleteUserLocationPrefFromFirestore as u, loadPlaylistCoursesFromFirestore as v, loadUserDailyQuotaFromFirestore as w, loadSharedThreadFromFirestore as x, loadQuizBattleFromFirestore as y, saveUserLocationPrefToFirestore as z };
