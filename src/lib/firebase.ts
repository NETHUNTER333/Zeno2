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

