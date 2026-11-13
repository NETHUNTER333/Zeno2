import { initializeApp } from 'firebase/app';
import { getAuth, deleteUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDocFromCache,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence internal @firebase/firestore WebChannel connection retry noise when operating in offline/sandbox mode
try {
  setLogLevel('silent');
} catch {
  // Ignore if setLogLevel is unavailable in test mocks
}

const app = initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as any).firestoreDatabaseId;

function initFirestoreInstance(): Firestore {
  try {
    if (typeof initializeFirestore === 'function') {
      return initializeFirestore(
        app,
        {
          localCache: typeof memoryLocalCache === 'function' ? memoryLocalCache() : undefined,
          experimentalAutoDetectLongPolling: true,
        },
        databaseId
      );
    }
  } catch {
    // Fallback if Firestore instance was already initialized
  }
  return getFirestore(app, databaseId);
}

export const db = initFirestoreInstance();
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isFirestoreOfflineError(error: unknown): boolean {
  if (!error) return false;
  const code = typeof (error as any)?.code === 'string' ? (error as any).code : '';
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'unavailable' ||
    code === 'failed-precondition' ||
    /client is offline/i.test(msg) ||
    /could not reach cloud firestore backend/i.test(msg) ||
    /operation could not be completed/i.test(msg) ||
    /failed to get document because the client is offline/i.test(msg) ||
    /network error/i.test(msg)
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (isFirestoreOfflineError(error)) {
    // Operate gracefully in offline mode using local storage fallback without noisy console errors
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function stripUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      cleaned[k] = stripUndefined(v);
    }
  }
  return cleaned;
}

export async function getAuthHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {
    // Proceed without token if unavailable
  }
  return headers;
}

export async function saveChatThreadToFirestore(thread: {
  id: string;
  title: string;
  createdAt: number;
  messages: any[];
  preview?: string;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const safeThreadId = String(thread.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/threads/${safeThreadId}`;
  try {
    // Strip base64 inline data from attachments and cap per-message heavy payloads so the document stays well below Firestore's 1MB limit
    let sanitizedMessages = (thread.messages || [])
      .filter((m) => !m.isStreaming)
      .slice(-150)
      .map((m) => {
        const msgCopy: any = { ...m };
        if (typeof msgCopy.content === 'string' && msgCopy.content.length > 24000) {
          msgCopy.content = msgCopy.content.slice(0, 24000);
        }
        if (Array.isArray(msgCopy.attachments)) {
          msgCopy.attachments = msgCopy.attachments.slice(0, 10).map((att: any) => ({
            name: String(att.name || 'file').slice(0, 200),
            type: String(att.type || 'application/octet-stream').slice(0, 100),
            size: Number(att.size) || 0,
          }));
        }
        if (Array.isArray(msgCopy.sources) && msgCopy.sources.length > 10) {
          msgCopy.sources = msgCopy.sources.slice(0, 10);
        }
        if (Array.isArray(msgCopy.images) && msgCopy.images.length > 8) {
          msgCopy.images = msgCopy.images.slice(0, 8);
        }
        if (Array.isArray(msgCopy.videos) && msgCopy.videos.length > 6) {
          msgCopy.videos = msgCopy.videos.slice(0, 6);
        }
        return stripUndefined(msgCopy);
      });

    // Enforce hard < 850KB JSON byte guard by trimming oldest messages if needed
    while (sanitizedMessages.length > 1 && JSON.stringify(sanitizedMessages).length > 820000) {
      sanitizedMessages = sanitizedMessages.slice(Math.ceil(sanitizedMessages.length * 0.25));
    }

    const payload = stripUndefined({
      id: safeThreadId,
      userId: user.uid,
      title: String(thread.title || 'New Chat').slice(0, 200),
      createdAt: Number(thread.createdAt) || Date.now(),
      updatedAt: Date.now(),
      messages: sanitizedMessages,
    });

    await setDoc(doc(db, 'users', user.uid, 'threads', safeThreadId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUserChatThreadsFromFirestore(): Promise<any[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = `users/${user.uid}/threads`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'threads'),
      where('userId', '==', user.uid)
    );
    const snap = await getDocs(q);
    const loaded = snap.docs.map((d) => d.data());
    loaded.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return loaded;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function deleteChatThreadFromFirestore(threadId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const safeThreadId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/threads/${safeThreadId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'threads', safeThreadId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllChatThreadsFromFirestore(threadIds: string[]) {
  const user = auth.currentUser;
  if (!user) return;
  for (const tid of threadIds) {
    await deleteChatThreadFromFirestore(tid);
  }
}

export async function saveBookmarkToFirestore(bookmark: {
  id: string;
  threadId: string;
  messageId: string;
  role: 'user' | 'assistant';
  snippet: string;
  threadTitle: string;
  savedAt: number;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const safeBookmarkId = String(bookmark.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/bookmarks/${safeBookmarkId}`;
  try {
    const payload = {
      id: safeBookmarkId,
      userId: user.uid,
      threadId: String(bookmark.threadId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
      messageId: String(bookmark.messageId || 'msg').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
      role: bookmark.role === 'user' ? 'user' : 'assistant',
      snippet: String(bookmark.snippet || '').slice(0, 2000),
      threadTitle: String(bookmark.threadTitle || 'Saved Chat').slice(0, 200),
      savedAt: Number(bookmark.savedAt) || Date.now(),
    };
    await setDoc(doc(db, 'users', user.uid, 'bookmarks', safeBookmarkId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBookmarkFromFirestore(bookmarkId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const safeBookmarkId = String(bookmarkId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/bookmarks/${safeBookmarkId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', safeBookmarkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadUserBookmarksFromFirestore(): Promise<any[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = `users/${user.uid}/bookmarks`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'bookmarks'),
      where('userId', '==', user.uid)
    );
    const snap = await getDocs(q);
    const loaded = snap.docs.map((d) => d.data());
    loaded.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    return loaded;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

const inflightProfileSyncs = new Map<string, Promise<Record<string, any> | null>>();

export async function ensureUserProfileInFirestore(
  user: FirebaseUser,
  fallbackDisplayName?: string
): Promise<Record<string, any> | null> {
  if (!user || !user.uid) return null;
  const existingInflight = inflightProfileSyncs.get(user.uid);
  if (existingInflight) {
    return existingInflight;
  }

  const syncPromise = (async () => {
    const fallbackDoc = {
      uid: user.uid,
      displayName: (
        user.displayName ||
        fallbackDisplayName ||
        (user.email ? user.email.split('@')[0] : 'User')
      ).slice(0, 100),
      email: (user.email || '').slice(0, 200),
      photoURL: (user.photoURL || '').slice(0, 500),
      createdAt: Date.now(),
    };
    const userRef = doc(db, 'users', user.uid);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return userSnap.data() as Record<string, any>;
      }
      await setDoc(userRef, fallbackDoc);
      return fallbackDoc;
    } catch (error) {
      if (isFirestoreOfflineError(error)) {
        try {
          if (typeof getDocFromCache === 'function') {
            const cachedSnap = await getDocFromCache(userRef);
            if (cachedSnap.exists()) {
              return cachedSnap.data() as Record<string, any>;
            }
          }
        } catch {
          // Ignore cache miss while offline
        }
        return fallbackDoc;
      }
      console.warn('Could not sync user profile to Firestore, using local fallback:', error);
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


export async function signUpWithEmail(email: string, pass: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;
    try {
      await ensureUserProfileInFirestore(user, email.split('@')[0]);
    } catch (e) {
      console.warn('Non-fatal profile sync error after sign up:', e);
    }
    return user;
  } catch (error: any) {
    if (error?.code === 'auth/email-already-in-use') {
      const loginCred = await signInWithEmailAndPassword(auth, email, pass);
      try {
        await ensureUserProfileInFirestore(loginCred.user, email.split('@')[0]);
      } catch (e) {
        console.warn('Non-fatal profile sync error after login:', e);
      }
      return loginCred.user;
    }
    throw error;
  }
}

export async function signInWithEmail(email: string, pass: string) {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  try {
    await ensureUserProfileInFirestore(cred.user, email.split('@')[0]);
  } catch (e) {
    console.warn('Non-fatal profile sync error after email login:', e);
  }
  return cred.user;
}

export async function sendPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}


export async function deleteUserAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  try {
    const userRef = doc(db, 'users', user.uid);
    try {
      await deleteDoc(userRef);
    } catch (e) {
      if (!isFirestoreOfflineError(e)) {
        console.error('Error deleting user firestore document:', e);
      }
    }
    await deleteUser(user);
  } catch (error) {
    console.error('Delete account error:', error);
    throw error;
  }
}

export interface UserStudySession {
  videoId: string;
  userId?: string;
  title: string;
  author?: string;
  thumbnail?: string;
  updatedAt: number;
  segmentsCount?: number;
  notes?: string;
  flashcardMastery?: Record<string, 'known' | 'review'>;
  quizScore?: { answered: number; total: number; correct: number };
}

export async function saveUserStudySessionToFirestore(session: UserStudySession) {
  const user = auth.currentUser;
  if (!user) return;
  const safeSessionId = String(session.videoId || 'session')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  const path = `users/${user.uid}/study_sessions/${safeSessionId}`;
  try {
    const payload: Record<string, any> = {
      videoId: String(session.videoId || safeSessionId).slice(0, 128),
      userId: user.uid,
      title: String(session.title || 'YouTube Study Session').slice(0, 300),
      author: String(session.author || '').slice(0, 150),
      thumbnail: String(session.thumbnail || '').slice(0, 500),
      updatedAt: Number(session.updatedAt) || Date.now(),
      segmentsCount: Number(session.segmentsCount || 0),
    };
    if (session.notes !== undefined) {
      payload.notes = String(session.notes).slice(0, 10000);
    }
    if (session.flashcardMastery && typeof session.flashcardMastery === 'object') {
      payload.flashcardMastery = session.flashcardMastery;
    }
    if (session.quizScore && typeof session.quizScore === 'object') {
      payload.quizScore = session.quizScore;
    }
    await setDoc(doc(db, 'users', user.uid, 'study_sessions', safeSessionId), payload, {
      merge: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUserStudySessionsFromFirestore(): Promise<UserStudySession[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = `users/${user.uid}/study_sessions`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'study_sessions'),
      where('userId', '==', user.uid)
    );
    const snap = await getDocs(q);
    const sessions = snap.docs.map((d) => d.data() as UserStudySession);
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sessions;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function deleteUserStudySessionFromFirestore(videoId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const safeSessionId = String(videoId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/study_sessions/${safeSessionId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'study_sessions', safeSessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface SharedThreadSnapshotDoc {
  id: string;
  ownerId: string;
  title: string;
  createdAt: number;
  messages: any[];
}

export async function publishSharedThreadToFirestore(thread: {
  id: string;
  title: string;
  createdAt: number;
  messages: any[];
}): Promise<string> {
  const rawShareId = `sh_${String(thread.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '')}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const shareId = rawShareId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);

  const sanitizedMessages = (thread.messages || [])
    .filter((m) => !m.isStreaming)
    .slice(0, 120)
    .map((m) =>
      stripUndefined({
        id: String(m.id || `msg-${Date.now()}`),
        role: m.role === 'user' ? 'user' : 'assistant',
        content: String(m.content || '').slice(0, 18000),
        timestamp: Number(m.timestamp) || Date.now(),
        modelUsed: m.modelUsed ? String(m.modelUsed).slice(0, 80) : undefined,
        sources: Array.isArray(m.sources) ? m.sources.slice(0, 8) : undefined,
        arxivPapers: Array.isArray(m.arxivPapers) ? m.arxivPapers.slice(0, 4) : undefined,
        githubRepos: Array.isArray(m.githubRepos) ? m.githubRepos.slice(0, 4) : undefined,
        financeQuotes: Array.isArray(m.financeQuotes) ? m.financeQuotes.slice(0, 4) : undefined,
      })
    );

  const snapshotPayload: SharedThreadSnapshotDoc = {
    id: shareId,
    ownerId: auth.currentUser?.uid || 'guest_owner',
    title: String(thread.title || 'Shared Kinich Thread').slice(0, 200),
    createdAt: Number(thread.createdAt) || Date.now(),
    messages: sanitizedMessages,
  };

  // Always cache locally so instant preview works even offline
  try {
    localStorage.setItem(`kinich_shared_${shareId}`, JSON.stringify(snapshotPayload));
  } catch {}

  // 1. Save to Firestore (works for both guests and authenticated users)
  try {
    await setDoc(doc(db, 'shared_threads', shareId), snapshotPayload);
  } catch {
    // 2. Fallback to server endpoint
    try {
      await fetch('/api/share/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshotPayload),
      });
    } catch {}
  }

  return shareId;
}

export async function loadSharedThreadFromFirestore(
  shareId: string
): Promise<SharedThreadSnapshotDoc | null> {
  const safeId = String(shareId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  if (!safeId) return null;

  try {
    const localRaw = localStorage.getItem(`kinich_shared_${safeId}`);
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (parsed && Array.isArray(parsed.messages)) {
        return parsed as SharedThreadSnapshotDoc;
      }
    }
  } catch {}

  // 1. Query Firestore
  try {
    const snap = await getDoc(doc(db, 'shared_threads', safeId));
    if (snap.exists()) {
      return snap.data() as SharedThreadSnapshotDoc;
    }
  } catch {}

  // 2. Query server endpoint
  try {
    const res = await fetch(`/api/share/snapshot/${encodeURIComponent(safeId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.snapshot && Array.isArray(json.snapshot.messages)) {
        return json.snapshot as SharedThreadSnapshotDoc;
      }
    }
  } catch {}

  return null;
}

export async function saveVaultItemToFirestore(item: {
  id: string;
  type?: string;
  title: string;
  subject?: string;
  chapter?: string;
  content: string;
  summary?: string;
  collectionId: string;
  sourceType: string;
  sourceUrl?: string;
  timestamps?: Array<string | { timeSec?: number; label?: string; time?: string }>;
  tags?: string[];
  relatedItemIds?: string[];
  sageNote?: string;
  organizedBySage?: boolean;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
  lastReviewedAt?: number;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const safeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const safeCollectionId = String(item.collectionId || 'col_general')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  const path = `users/${user.uid}/vault_items/${safeId}`;
  try {
    const payload = stripUndefined({
      id: safeId,
      userId: user.uid,
      type: String(item.type || item.sourceType || 'chat_answer').slice(0, 40),
      title: String(item.title || 'Saved Insight').slice(0, 200),
      subject: String(item.subject || 'General Studies').slice(0, 80),
      chapter: String(item.chapter || 'Core Concepts').slice(0, 120),
      content: String(item.content || '').slice(0, 24000),
      summary: item.summary ? String(item.summary).slice(0, 500) : undefined,
      collectionId: safeCollectionId,
      sourceType: String(item.sourceType || item.type || 'chat_answer').slice(0, 40),
      sourceUrl: item.sourceUrl ? String(item.sourceUrl).slice(0, 500) : '',
      timestamps: Array.isArray(item.timestamps)
        ? item.timestamps.slice(0, 50).map((t) =>
            typeof t === 'string'
              ? t.slice(0, 80)
              : `[${t.time || `${Math.floor((t.timeSec || 0) / 60)}:${String((t.timeSec || 0) % 60).padStart(2, '0')}`}] ${t.label || ''}`.slice(0, 80)
          )
        : [],
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 10).map((t) => String(t).slice(0, 32)) : [],
      relatedItemIds: Array.isArray(item.relatedItemIds)
        ? item.relatedItemIds.slice(0, 20).map((r) => String(r).slice(0, 128))
        : [],
      sageNote: item.sageNote ? String(item.sageNote).slice(0, 300) : '',
      organizedBySage: Boolean(item.organizedBySage),
      isPinned: Boolean(item.isPinned),
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Number(item.updatedAt) || Date.now(),
      lastReviewedAt: Number(item.lastReviewedAt || item.updatedAt || item.createdAt) || Date.now(),
    });
    await setDoc(doc(db, 'users', user.uid, 'vault_items', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteVaultItemFromFirestore(itemId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const safeId = String(itemId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/vault_items/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'vault_items', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadUserVaultItemsFromFirestore(): Promise<any[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = `users/${user.uid}/vault_items`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'vault_items'),
      where('userId', '==', user.uid)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => d.data());
    items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveVaultThreadToFirestore(thread: {
  id: string;
  type: string;
  title: string;
  sourceUrl?: string;
  thumbnail?: string;
  tldr: string;
  keyPoints?: any[];
  subject: string;
  chapter: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  score?: number;
  commentCount?: number;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const safeId = String(thread.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/vault_threads/${safeId}`;
  try {
    const payload = stripUndefined({
      id: safeId,
      userId: user.uid,
      type: String(thread.type || 'text').slice(0, 32),
      title: String(thread.title || 'Untitled Thread').slice(0, 300),
      sourceUrl: thread.sourceUrl ? String(thread.sourceUrl).slice(0, 2048) : '',
      thumbnail: thread.thumbnail ? String(thread.thumbnail).slice(0, 1000) : '',
      tldr: String(thread.tldr || '').slice(0, 600),
      keyPoints: Array.isArray(thread.keyPoints)
        ? thread.keyPoints.slice(0, 20).map((kp, idx) => ({
            id: String(kp.id || `kp_${idx}`).slice(0, 64),
            text: String(kp.text || '').slice(0, 300),
            timestamp: kp.timestamp ? String(kp.timestamp).slice(0, 20) : undefined,
            score: Number(kp.score) || 1,
          }))
        : [],
      subject: String(thread.subject || 'General Studies').slice(0, 120),
      chapter: String(thread.chapter || 'Core Concepts').slice(0, 160),
      tags: Array.isArray(thread.tags) ? thread.tags.slice(0, 15).map((t) => String(t).slice(0, 32)) : [],
      createdAt: Number(thread.createdAt) || Date.now(),
      updatedAt: Number(thread.updatedAt) || Date.now(),
      pinned: Boolean(thread.pinned),
      score: Number(thread.score) || 1,
      commentCount: Number(thread.commentCount) || 0,
    });
    await setDoc(doc(db, 'users', user.uid, 'vault_threads', safeId), payload);
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function loadVaultThreadsFromFirestore(): Promise<any[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = `users/${user.uid}/vault_threads`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'vault_threads'),
      where('userId', '==', user.uid)
    );
    const snap = await getDocs(q);
    const threads = snap.docs.map((d) => d.data());
    threads.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return threads;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return [];
  }
}

export async function deleteVaultThreadFromFirestore(threadId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const safeId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/vault_threads/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'vault_threads', safeId));
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export async function saveVaultCommentToFirestore(comment: {
  id: string;
  threadId: string;
  author: string;
  authorName?: string;
  text: string;
  createdAt: number;
  parentId?: string | null;
  score?: number;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const safeThreadId = String(comment.threadId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const safeCommentId = String(comment.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/vault_threads/${safeThreadId}/comments/${safeCommentId}`;
  try {
    const payload = stripUndefined({
      id: safeCommentId,
      threadId: safeThreadId,
      userId: user.uid,
      author: String(comment.author || 'user').slice(0, 64),
      authorName: String(comment.authorName || 'Student').slice(0, 100),
      text: String(comment.text || '').slice(0, 5000),
      createdAt: Number(comment.createdAt) || Date.now(),
      parentId: comment.parentId ? String(comment.parentId).slice(0, 128) : null,
      score: Number(comment.score) || 1,
    });
    await setDoc(doc(db, 'users', user.uid, 'vault_threads', safeThreadId, 'comments', safeCommentId), payload);
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function saveAgentMemoryToFirestore(agentId: string, facts: string[]) {
  const user = auth.currentUser;
  if (!user) return;
  const safeAgentId = String(agentId || 'sage').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const path = `users/${user.uid}/agent_memory/${safeAgentId}`;
  try {
    const cleanFacts = Array.from(
      new Set(
        (Array.isArray(facts) ? facts : [])
          .map((f) => String(f || '').trim().slice(0, 160))
          .filter(Boolean)
      )
    ).slice(0, 50);
    await setDoc(doc(db, 'users', user.uid, 'agent_memory', safeAgentId), {
      agentId: safeAgentId,
      userId: user.uid,
      facts: cleanFacts,
      updatedAt: Date.now(),
    });
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function loadAgentMemoryFromFirestore(agentId = 'sage'): Promise<string[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const safeAgentId = String(agentId || 'sage').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const path = `users/${user.uid}/agent_memory/${safeAgentId}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'agent_memory', safeAgentId));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data?.facts) ? data.facts.slice(0, 50) : [];
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return [];
  }
}

export async function recordAgentUsageToFirestore(input: {
  agentId: string;
  tokensUsed: number;
  callsCount?: number;
  usageDate?: string;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const safeAgentId = String(input.agentId || 'sage').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const usageDate = String(input.usageDate || getCurrentUtcDateString()).slice(0, 16);
  const usageId = `${usageDate}_${safeAgentId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);
  const path = `users/${user.uid}/agent_usage/${usageId}`;
  const docRef = doc(db, 'users', user.uid, 'agent_usage', usageId);
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
      updatedAt: Date.now(),
    });
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function savePublicArtifactToFirestore(artifact: {
  id: string;
  authorName: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  visibility: 'public' | 'private';
  outputType: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const safeId = String(artifact.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `public_artifacts/${safeId}`;
  try {
    const payload = stripUndefined({
      id: safeId,
      ownerId: user.uid,
      authorName: String(artifact.authorName || user.displayName || 'Kinich Researcher').slice(0, 100),
      title: String(artifact.title || 'Kinich Resource').slice(0, 200),
      summary: String(artifact.summary || '').slice(0, 500),
      content: String(artifact.content || '').slice(0, 32000),
      category: String(artifact.category || 'Research').slice(0, 50),
      visibility: artifact.visibility === 'private' ? 'private' : 'public',
      outputType: String(artifact.outputType || 'research_summary').slice(0, 50),
      tags: Array.isArray(artifact.tags) ? artifact.tags.slice(0, 10).map((t) => String(t).slice(0, 32)) : [],
      createdAt: Number(artifact.createdAt) || Date.now(),
      updatedAt: Number(artifact.updatedAt) || Date.now(),
    });
    await setDoc(doc(db, 'public_artifacts', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePublicArtifactFromFirestore(artifactId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const safeId = String(artifactId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `public_artifacts/${safeId}`;
  try {
    await deleteDoc(doc(db, 'public_artifacts', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface FirestoreDailyQuotaDoc {
  quotaDate: string;
  userId: string;
  plan: 'free' | 'spark' | 'fire';
  messagesUsed: number;
  filesUploaded: number;
  searchesUsed: number;
  deepResearchUsed: number;
  pdfStudyUsed: number;
  tokensUsed: number;
  updatedAt: number;
}

export function getCurrentUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadUserDailyQuotaFromFirestore(
  quotaDate = getCurrentUtcDateString()
): Promise<FirestoreDailyQuotaDoc | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const safeDate = String(quotaDate).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  const path = `users/${user.uid}/quotas/${safeDate}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'quotas', safeDate));
    if (!snap.exists()) return null;
    return snap.data() as FirestoreDailyQuotaDoc;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return null;
  }
}

export async function syncUserDailyQuotaToFirestore(input: {
  plan: 'free' | 'spark' | 'fire';
  messagesUsed: number;
  filesUploaded: number;
  searchesUsed: number;
  deepResearchUsed: number;
  pdfStudyUsed: number;
  tokensUsed: number;
  quotaDate?: string;
}): Promise<FirestoreDailyQuotaDoc | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const safeDate = String(input.quotaDate || getCurrentUtcDateString())
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32);
  const path = `users/${user.uid}/quotas/${safeDate}`;
  const docRef = doc(db, 'users', user.uid, 'quotas', safeDate);

  try {
    let existing: Partial<FirestoreDailyQuotaDoc> | null = null;
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        existing = snap.data() as Partial<FirestoreDailyQuotaDoc>;
      }
    } catch {
      // Proceed with incoming values if offline or not found
    }

    const validPlan: 'free' | 'spark' | 'fire' =
      input.plan === 'fire' || input.plan === 'spark' ? input.plan : 'free';

    const payload: FirestoreDailyQuotaDoc = {
      quotaDate: safeDate,
      userId: user.uid,
      plan: validPlan,
      messagesUsed: Math.max(Number(existing?.messagesUsed || 0), Math.max(0, Math.floor(Number(input.messagesUsed || 0)))),
      filesUploaded: Math.max(Number(existing?.filesUploaded || 0), Math.max(0, Math.floor(Number(input.filesUploaded || 0)))),
      searchesUsed: Math.max(Number(existing?.searchesUsed || 0), Math.max(0, Math.floor(Number(input.searchesUsed || 0)))),
      deepResearchUsed: Math.max(Number(existing?.deepResearchUsed || 0), Math.max(0, Math.floor(Number(input.deepResearchUsed || 0)))),
      pdfStudyUsed: Math.max(Number(existing?.pdfStudyUsed || 0), Math.max(0, Math.floor(Number(input.pdfStudyUsed || 0)))),
      tokensUsed: Math.max(Number(existing?.tokensUsed || 0), Math.max(0, Math.floor(Number(input.tokensUsed || 0)))),
      updatedAt: Date.now(),
    };

    await setDoc(docRef, payload);
    return payload;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    return null;
  }
}

export interface FirestoreExamPlanDay {
  dateIst: string; // YYYY-MM-DD in IST
  dayNumber: number;
  isFullRevision: boolean;
  chapters: string[];
  completed: boolean;
}

export interface FirestoreExamDoc {
  id: string;
  userId: string;
  name: string;
  examDate: string; // YYYY-MM-DD in IST
  subject?: string;
  chapters: string[];
  planDays: FirestoreExamPlanDay[];
  lastReplannedAt?: string;
  createdAt: number;
  updatedAt: number;
}

export async function saveExamToFirestore(exam: Omit<FirestoreExamDoc, 'userId'> & { userId?: string }) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const safeId = String(exam.id || `exam_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/exams/${safeId}`;
  try {
    const cleanChapters = (Array.isArray(exam.chapters) ? exam.chapters : [])
      .map((c) => String(c || '').trim().slice(0, 160))
      .filter(Boolean)
      .slice(0, 100);
    if (cleanChapters.length === 0) {
      cleanChapters.push('Core Syllabus');
    }
    const cleanPlanDays = (Array.isArray(exam.planDays) ? exam.planDays : [])
      .slice(0, 366)
      .map((pd, idx) => ({
        dateIst: String(pd?.dateIst || '').slice(0, 16),
        dayNumber: Number(pd?.dayNumber || idx + 1),
        isFullRevision: Boolean(pd?.isFullRevision),
        chapters: Array.isArray(pd?.chapters)
          ? pd.chapters.slice(0, 20).map((c) => String(c || '').slice(0, 160))
          : [],
        completed: Boolean(pd?.completed),
      }));

    const payload = stripUndefined({
      id: safeId,
      userId: user.uid,
      name: String(exam.name || 'Upcoming Exam').trim().slice(0, 160) || 'Upcoming Exam',
      examDate: String(exam.examDate || '').slice(0, 32) || getCurrentUtcDateString(),
      subject: exam.subject ? String(exam.subject).slice(0, 120) : 'General Studies',
      chapters: cleanChapters,
      planDays: cleanPlanDays,
      lastReplannedAt: exam.lastReplannedAt ? String(exam.lastReplannedAt).slice(0, 32) : '',
      createdAt: Number(exam.createdAt) > 0 ? Number(exam.createdAt) : Date.now(),
      updatedAt: Number(exam.updatedAt) > 0 ? Number(exam.updatedAt) : Date.now(),
    });
    await setDoc(doc(db, 'users', user.uid, 'exams', safeId), payload);
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function loadExamsFromFirestore(): Promise<FirestoreExamDoc[]> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return [];
  const path = `users/${user.uid}/exams`;
  try {
    const q = query(collection(db, 'users', user.uid, 'exams'), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    const exams = snap.docs.map((d) => d.data() as FirestoreExamDoc);
    exams.sort((a, b) => String(a.examDate || '').localeCompare(String(b.examDate || '')));
    return exams;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return [];
  }
}

export async function deleteExamFromFirestore(examId: string) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const safeId = String(examId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/exams/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'exams', safeId));
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export interface FirestoreRecallCardDoc {
  id: string;
  userId: string;
  type: 'flashcard' | 'quiz';
  front: string;
  back: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  subject: string;
  chapter: string;
  examId?: string;
  sourceId?: string;
  pageOrTimestamp?: string;
  ease: number;
  interval: number;
  repetitions: number;
  dueAt: number;
  lastGrade?: 'again' | 'hard' | 'good' | 'easy';
  lastReviewedAt?: number;
  wrongCount: number;
  correctCount: number;
  createdAt: number;
  updatedAt: number;
}

export async function saveRecallCardToFirestore(
  card: Omit<FirestoreRecallCardDoc, 'userId'> & { userId?: string }
) {
  const user = auth.currentUser;
  if (!user) return;
  const safeId = String(card.id || `card_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/cards/${safeId}`;
  try {
    const validGrade =
      card.lastGrade === 'again' ||
      card.lastGrade === 'hard' ||
      card.lastGrade === 'good' ||
      card.lastGrade === 'easy'
        ? card.lastGrade
        : undefined;
    const payload = stripUndefined({
      id: safeId,
      userId: user.uid,
      type: card.type === 'quiz' ? 'quiz' : 'flashcard',
      front: String(card.front || 'Question').trim().slice(0, 2000) || 'Question',
      back: String(card.back || 'Answer').trim().slice(0, 4000) || 'Answer',
      options: Array.isArray(card.options)
        ? card.options.slice(0, 6).map((o) => String(o || '').slice(0, 500))
        : undefined,
      correctIndex:
        typeof card.correctIndex === 'number' && card.correctIndex >= 0 && card.correctIndex <= 5
          ? Math.floor(card.correctIndex)
          : undefined,
      explanation: card.explanation ? String(card.explanation).slice(0, 2000) : undefined,
      subject: String(card.subject || 'General Studies').trim().slice(0, 120) || 'General Studies',
      chapter: String(card.chapter || 'Core Concepts').trim().slice(0, 160) || 'Core Concepts',
      examId: card.examId ? String(card.examId).slice(0, 128) : undefined,
      sourceId: card.sourceId ? String(card.sourceId).slice(0, 128) : undefined,
      pageOrTimestamp: card.pageOrTimestamp ? String(card.pageOrTimestamp).slice(0, 64) : undefined,
      ease: Math.max(1.3, Math.min(4.0, Number(card.ease) || 2.5)),
      interval: Math.max(0, Math.min(3650, Math.floor(Number(card.interval) || 0))),
      repetitions: Math.max(0, Math.min(10000, Math.floor(Number(card.repetitions) || 0))),
      dueAt: Number(card.dueAt) > 0 ? Number(card.dueAt) : Date.now(),
      lastGrade: validGrade,
      lastReviewedAt: Number(card.lastReviewedAt) > 0 ? Number(card.lastReviewedAt) : undefined,
      wrongCount: Math.max(0, Math.floor(Number(card.wrongCount) || 0)),
      correctCount: Math.max(0, Math.floor(Number(card.correctCount) || 0)),
      createdAt: Number(card.createdAt) > 0 ? Number(card.createdAt) : Date.now(),
      updatedAt: Number(card.updatedAt) > 0 ? Number(card.updatedAt) : Date.now(),
    });
    await setDoc(doc(db, 'users', user.uid, 'cards', safeId), payload);
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function loadRecallCardsFromFirestore(): Promise<FirestoreRecallCardDoc[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = `users/${user.uid}/cards`;
  try {
    const q = query(collection(db, 'users', user.uid, 'cards'), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    const cards = snap.docs.map((d) => d.data() as FirestoreRecallCardDoc);
    cards.sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
    return cards;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return [];
  }
}

export async function deleteRecallCardFromFirestore(cardId: string) {
  const user = auth.currentUser;
  if (!user) return;
  const safeId = String(cardId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/cards/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'cards', safeId));
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}

export interface FirestoreQuizBattleQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface FirestoreQuizBattleEntry {
  id: string;
  playerName: string;
  score: number;
  total: number;
  timeMs: number;
  submittedAt: number;
}

export interface FirestoreQuizBattleDoc {
  id: string;
  title: string;
  topic: string;
  creatorName: string;
  questions: FirestoreQuizBattleQuestion[];
  entries: FirestoreQuizBattleEntry[];
  createdAt: number;
  updatedAt: number;
}

export async function saveQuizBattleToFirestore(battle: FirestoreQuizBattleDoc): Promise<void> {
  const safeId = String(battle.id || `qb_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `quiz_battles/${safeId}`;
  try {
    const payload: FirestoreQuizBattleDoc = {
      id: safeId,
      title: String(battle.title || 'Kinich Quiz Battle').trim().slice(0, 200) || 'Kinich Quiz Battle',
      topic: String(battle.topic || 'General Studies').trim().slice(0, 160) || 'General Studies',
      creatorName: String(battle.creatorName || 'Kinich Challenger').trim().slice(0, 100) || 'Kinich Challenger',
      questions: Array.isArray(battle.questions) ? battle.questions.slice(0, 20) : [],
      entries: Array.isArray(battle.entries) ? battle.entries.slice(0, 100) : [],
      createdAt: Number(battle.createdAt) > 0 ? Number(battle.createdAt) : Date.now(),
      updatedAt: Number(battle.updatedAt) > 0 ? Number(battle.updatedAt) : Date.now(),
    };
    await setDoc(doc(db, 'quiz_battles', safeId), payload);
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      try {
        handleFirestoreError(error, OperationType.WRITE, path);
      } catch {}
    }
  }
}

export async function loadQuizBattleFromFirestore(battleId: string): Promise<FirestoreQuizBattleDoc | null> {
  const safeId = String(battleId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  if (!safeId) return null;
  const path = `quiz_battles/${safeId}`;
  try {
    const snap = await getDoc(doc(db, 'quiz_battles', safeId));
    if (!snap.exists()) return null;
    return snap.data() as FirestoreQuizBattleDoc;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {}
    }
    return null;
  }
}

export async function appendQuizBattleEntryToFirestore(
  battleId: string,
  entry: FirestoreQuizBattleEntry
): Promise<FirestoreQuizBattleDoc | null> {
  const safeId = String(battleId || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  if (!safeId) return null;
  const path = `quiz_battles/${safeId}`;
  try {
    const existing = await loadQuizBattleFromFirestore(safeId);
    if (!existing) return null;
    const nextEntries = [...(Array.isArray(existing.entries) ? existing.entries : []), entry]
      .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs)
      .slice(0, 100);
    const updated: FirestoreQuizBattleDoc = {
      ...existing,
      entries: nextEntries,
      updatedAt: Date.now(),
    };
    await setDoc(doc(db, 'quiz_battles', safeId), updated);
    return updated;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, path);
      } catch {}
    }
    return null;
  }
}

export interface FirestorePlaylistCourseDoc {
  id: string;
  userId: string;
  title: string;
  playlistUrl: string;
  modules: Array<{
    id: string;
    moduleNumber: number;
    title: string;
    durationLabel: string;
    videoId?: string;
    keyTakeaways: string[];
  }>;
  completedVideoIds: string[];
  finalTestQuestions: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  finalTestScore?: number;
  progressPercent: number;
  createdAt: number;
  updatedAt: number;
}

export async function savePlaylistCourseToFirestore(
  course: Omit<FirestorePlaylistCourseDoc, 'userId'> & { userId?: string }
): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const safeId = String(course.id || `course_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/playlist_courses/${safeId}`;
  try {
    const payload = stripUndefined({
      id: safeId,
      userId: user.uid,
      title: String(course.title || 'YouTube Playlist Course').trim().slice(0, 240) || 'YouTube Playlist Course',
      playlistUrl: String(course.playlistUrl || '').slice(0, 2048),
      modules: Array.isArray(course.modules) ? course.modules.slice(0, 100) : [],
      completedVideoIds: Array.isArray(course.completedVideoIds) ? course.completedVideoIds.slice(0, 200) : [],
      finalTestQuestions: Array.isArray(course.finalTestQuestions) ? course.finalTestQuestions.slice(0, 50) : [],
      finalTestScore: typeof course.finalTestScore === 'number' ? course.finalTestScore : undefined,
      progressPercent: Math.max(0, Math.min(100, Math.round(Number(course.progressPercent) || 0))),
      createdAt: Number(course.createdAt) > 0 ? Number(course.createdAt) : Date.now(),
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, 'users', user.uid, 'playlist_courses', safeId), payload);
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function loadPlaylistCoursesFromFirestore(): Promise<FirestorePlaylistCourseDoc[]> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return [];
  const path = `users/${user.uid}/playlist_courses`;
  try {
    const q = query(collection(db, 'users', user.uid, 'playlist_courses'), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as FirestorePlaylistCourseDoc)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    return [];
  }
}

export interface FirestoreAnswerEvaluationDoc {
  id: string;
  userId: string;
  question: string;
  maxMarks: 5 | 10;
  studentAnswer: string;
  marksAwarded: number;
  gradeLetter: string;
  rubricBreakdown: Array<{
    criterion: string;
    awarded: number;
    max: number;
    comment: string;
  }>;
  missingKeywords: string[];
  examinerFeedback: string;
  modelTopperAnswer: string;
  subject: string;
  createdAt: number;
}

export async function saveAnswerEvaluationToFirestore(
  evalDoc: Omit<FirestoreAnswerEvaluationDoc, 'userId'> & { userId?: string }
): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const safeId = String(evalDoc.id || `eval_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `users/${user.uid}/answer_evaluations/${safeId}`;
  try {
    const payload = stripUndefined({
      id: safeId,
      userId: user.uid,
      question: String(evalDoc.question || '').slice(0, 2000),
      maxMarks: evalDoc.maxMarks === 5 ? 5 : 10,
      studentAnswer: String(evalDoc.studentAnswer || '').slice(0, 15000),
      marksAwarded: Number(evalDoc.marksAwarded) || 0,
      gradeLetter: String(evalDoc.gradeLetter || 'B+').slice(0, 16),
      rubricBreakdown: Array.isArray(evalDoc.rubricBreakdown) ? evalDoc.rubricBreakdown.slice(0, 10) : [],
      missingKeywords: Array.isArray(evalDoc.missingKeywords) ? evalDoc.missingKeywords.slice(0, 25) : [],
      examinerFeedback: String(evalDoc.examinerFeedback || '').slice(0, 4000),
      modelTopperAnswer: String(evalDoc.modelTopperAnswer || '').slice(0, 8000),
      subject: String(evalDoc.subject || 'University Exam').slice(0, 120),
      createdAt: Number(evalDoc.createdAt) > 0 ? Number(evalDoc.createdAt) : Date.now(),
    });
    await setDoc(doc(db, 'users', user.uid, 'answer_evaluations', safeId), payload);
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export interface FirestoreLocationPreferenceDoc {
  id: 'location';
  userId: string;
  locationEnabled: boolean;
  mode: 'precise' | 'approximate' | 'manual' | 'disabled';
  preferredCity?: string;
  preferredRegion?: string;
  preferredCountry?: string;
  preferredCountryCode?: string;
  preferredTimezone?: string;
  preferredLatitude?: number;
  preferredLongitude?: number;
  persistPreciseLocation: boolean;
  updatedAt: number;
}

export async function saveUserLocationPrefToFirestore(
  pref: Omit<FirestoreLocationPreferenceDoc, 'id' | 'userId'>
): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const path = `users/${user.uid}/preferences/location`;
  try {
    const validMode =
      pref.mode === 'precise' || pref.mode === 'manual' || pref.mode === 'disabled'
        ? pref.mode
        : 'approximate';
    const allowCoords = validMode === 'manual' || Boolean(pref.persistPreciseLocation);
    const hasCoords =
      allowCoords &&
      typeof pref.preferredLatitude === 'number' &&
      Number.isFinite(pref.preferredLatitude) &&
      pref.preferredLatitude >= -90 &&
      pref.preferredLatitude <= 90 &&
      typeof pref.preferredLongitude === 'number' &&
      Number.isFinite(pref.preferredLongitude) &&
      pref.preferredLongitude >= -180 &&
      pref.preferredLongitude <= 180;

    const payload = stripUndefined({
      id: 'location' as const,
      userId: user.uid,
      locationEnabled: Boolean(pref.locationEnabled),
      mode: validMode,
      preferredCity: pref.preferredCity ? String(pref.preferredCity).trim().slice(0, 120) : undefined,
      preferredRegion: pref.preferredRegion ? String(pref.preferredRegion).trim().slice(0, 120) : undefined,
      preferredCountry: pref.preferredCountry ? String(pref.preferredCountry).trim().slice(0, 120) : undefined,
      preferredCountryCode: pref.preferredCountryCode
        ? String(pref.preferredCountryCode).trim().toUpperCase().slice(0, 8)
        : undefined,
      preferredTimezone: pref.preferredTimezone ? String(pref.preferredTimezone).trim().slice(0, 80) : undefined,
      preferredLatitude: hasCoords ? Number(pref.preferredLatitude) : undefined,
      preferredLongitude: hasCoords ? Number(pref.preferredLongitude) : undefined,
      persistPreciseLocation: Boolean(pref.persistPreciseLocation),
      updatedAt: Number(pref.updatedAt) > 0 ? Number(pref.updatedAt) : Date.now(),
    });

    await setDoc(doc(db, 'users', user.uid, 'preferences', 'location'), payload);
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

export async function loadUserLocationPrefFromFirestore(): Promise<FirestoreLocationPreferenceDoc | null> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  const path = `users/${user.uid}/preferences/location`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'preferences', 'location'));
    if (!snap.exists()) return null;
    return snap.data() as FirestoreLocationPreferenceDoc;
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.GET, path);
    }
    return null;
  }
}

export async function deleteUserLocationPrefFromFirestore(): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const path = `users/${user.uid}/preferences/location`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'preferences', 'location'));
  } catch (error) {
    if (!isFirestoreOfflineError(error)) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }
}


