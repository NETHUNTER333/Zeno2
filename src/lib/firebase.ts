import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, deleteUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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
export const googleProvider = new GoogleAuthProvider();

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

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    try {
      await ensureUserProfileInFirestore(user);
    } catch (e) {
      console.warn('Non-fatal profile sync error after Google login:', e);
    }
    return user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('Google sign in cancelled by user');
      return null;
    }
    console.error('Google sign in error:', error);
    throw error;
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

export async function logOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
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
  title: string;
  content: string;
  summary?: string;
  collectionId: string;
  sourceType: string;
  tags?: string[];
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
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
      title: String(item.title || 'Saved Insight').slice(0, 200),
      content: String(item.content || '').slice(0, 24000),
      summary: item.summary ? String(item.summary).slice(0, 500) : undefined,
      collectionId: safeCollectionId,
      sourceType: String(item.sourceType || 'ai_response').slice(0, 40),
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 10).map((t) => String(t).slice(0, 32)) : [],
      isPinned: Boolean(item.isPinned),
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Number(item.updatedAt) || Date.now(),
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
