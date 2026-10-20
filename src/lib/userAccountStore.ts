import {
  UserProfile,
  UserPersonalization,
  ProjectFolder,
  WorkspaceFile,
  SavedCitation,
  SavedBookmark,
  ActiveSession,
  UserSubscription,
  UsageQuota,
  PrivacySettings,
} from '../types';
import {
  auth,
  db,
  signInWithGoogle,
  logOutUser,
  deleteUserAccount,
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
  saveBookmarkToFirestore,
  deleteBookmarkFromFirestore,
  loadUserBookmarksFromFirestore,
  ensureUserProfileInFirestore,
  isFirestoreOfflineError,
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    const isGoogle = firebaseUser.providerData?.some((p) => p.providerId === 'google.com');
    const providerType = isGoogle ? 'google' : 'email';
    const current = UserAccountStore.getProfile();
    try {
      const data = await ensureUserProfileInFirestore(firebaseUser, current.displayName);
      UserAccountStore.saveProfile({
        ...current,
        ...(data || {}),
        id: firebaseUser.uid,
        displayName: firebaseUser.displayName || data?.displayName || current.displayName,
        email: firebaseUser.email || data?.email || current.email,
        avatar: firebaseUser.photoURL || data?.photoURL || data?.avatar || current.avatar,
        createdAt: typeof data?.createdAt === 'number' ? data.createdAt : current.createdAt,
        signinProvider: providerType,
      });

      // Sync Pinned Messages (Bookmarks) from Firestore and merge with local bookmarks
      const remoteBookmarks = await loadUserBookmarksFromFirestore();
      const localBookmarks = UserAccountStore.getBookmarks();
      const mergedMap = new Map<string, SavedBookmark>();
      for (const lb of localBookmarks) {
        if (lb && lb.id) mergedMap.set(lb.id, lb);
      }
      for (const rb of remoteBookmarks) {
        if (rb && rb.id) {
          mergedMap.set(rb.id, {
            id: rb.id,
            threadId: rb.threadId,
            messageId: rb.messageId,
            role: rb.role === 'user' ? 'user' : 'assistant',
            snippet: rb.snippet,
            threadTitle: rb.threadTitle,
            savedAt: rb.savedAt || Date.now(),
          });
        }
      }
      const mergedBookmarks = Array.from(mergedMap.values()).sort((a, b) => b.savedAt - a.savedAt);
      UserAccountStore.saveBookmarks(mergedBookmarks);
      // Push any local-only bookmarks up to Firestore
      for (const lb of localBookmarks) {
        if (lb && lb.id && !remoteBookmarks.some((rb: any) => rb.id === lb.id)) {
          saveBookmarkToFirestore(lb).catch(() => {});
        }
      }
    } catch (err) {
      // Ensure local profile still reflects authenticated Firebase user even if Firestore sync fails
      UserAccountStore.saveProfile({
        ...current,
        id: firebaseUser.uid,
        displayName: firebaseUser.displayName || current.displayName,
        email: firebaseUser.email || current.email,
        avatar: firebaseUser.photoURL || current.avatar,
        signinProvider: providerType,
      });
      if (!isFirestoreOfflineError(err)) {
        console.error('Error syncing auth state with Firestore:', err);
      }
    }
  }
});


const STORAGE_KEYS = {
  PROFILE: 'zeno_user_profile',
  PERSONALIZATION: 'zeno_user_personalization',
  FOLDERS: 'zeno_project_folders',
  FILES: 'zeno_workspace_files',
  CITATIONS: 'zeno_saved_citations',
  BOOKMARKS: 'zeno_saved_bookmarks',
  SESSIONS: 'zeno_active_sessions',
  SUBSCRIPTION: 'zeno_user_subscription',
  USAGE: 'zeno_usage_quota',
  PRIVACY: 'zeno_privacy_settings',
  ONBOARDING_DONE: 'zeno_onboarding_completed',
};

export const DEFAULT_PROFILE: UserProfile = {
  id: 'zeno_usr_98124',
  displayName: 'doom',
  username: 'doomsh7',
  email: 'wakefullfinding62@gmail.com',
  phoneNumber: '+917981726766',
  emailVerified: true,
  avatar: '',
  avatarType: 'initials',
  signinProvider: 'google',
  createdAt: Date.now() - 42 * 24 * 3600 * 1000,
  accountStatus: 'verified',
  bio: '',
  nickname: 'doom',
  occupation: 'Engineer',
  age: '18 or older',
};

export const DEFAULT_PERSONALIZATION: UserPersonalization = {
  preferredName: 'doom',
  preferredLanguage: 'English',
  responseLength: 'balanced',
  responseStyle: 'technical',
  customInstructionsAbout: '',
  customInstructionsResponse: '',
  customInstructionsEnabled: true,
  voicePersona: 'Puck',
  voiceSpeed: 1.0,
  defaultModelId: 'deepseek-v4.1-flash-free',
};

export const DEFAULT_PROJECT_FOLDERS: ProjectFolder[] = [
  {
    id: 'folder-ai',
    name: 'Frontier AI & Agents',
    color: '#3b82f6',
    icon: 'Sparkles',
    description: 'LLM reasoning benchmarks, agent tool calling, and multi-modal models',
    createdAt: Date.now() - 20 * 24 * 3600 * 1000,
  },
  {
    id: 'folder-code',
    name: 'Code & Architecture',
    color: '#10b981',
    icon: 'Code',
    description: 'Systems programming, TypeScript, Redis rate limiters, and WebSockets',
    createdAt: Date.now() - 15 * 24 * 3600 * 1000,
  },
  {
    id: 'folder-physics',
    name: 'Physics & Quantum',
    color: '#8b5cf6',
    icon: 'Atom',
    description: 'General relativity, Tokamaks, and quantum error mitigation',
    createdAt: Date.now() - 8 * 24 * 3600 * 1000,
  },
  {
    id: 'folder-research',
    name: 'Literature & Papers',
    color: '#f59e0b',
    icon: 'BookOpen',
    description: 'arXiv papers, citation bookmarks, and synthesized reading notes',
    createdAt: Date.now() - 4 * 24 * 3600 * 1000,
  },
];

export const DEFAULT_WORKSPACE_FILES: WorkspaceFile[] = [
  {
    id: 'file-1',
    name: 'Quantum_Surface_Codes_Overview.pdf',
    size: 2480000,
    type: 'application/pdf',
    uploadedAt: Date.now() - 8 * 24 * 3600 * 1000,
    threadTitle: 'Explain quantum error correction',
    category: 'pdf',
  },
  {
    id: 'file-2',
    name: 'webrtc_signaling_architecture.png',
    size: 1140000,
    type: 'image/png',
    uploadedAt: Date.now() - 5 * 24 * 3600 * 1000,
    threadTitle: 'Production WebRTC Server',
    category: 'image',
  },
  {
    id: 'file-3',
    name: 'rate_limiter_token_bucket.ts',
    size: 14200,
    type: 'text/typescript',
    uploadedAt: Date.now() - 2 * 24 * 3600 * 1000,
    threadTitle: 'Distributed rate limiter in Node.js',
    category: 'code',
  },
  {
    id: 'file-4',
    name: 'zeno_research_synthesis_2026.md',
    size: 48900,
    type: 'text/markdown',
    uploadedAt: Date.now() - 1 * 24 * 3600 * 1000,
    threadTitle: 'AI Breakthroughs this week',
    category: 'export',
  },
];

export const DEFAULT_CITATIONS: SavedCitation[] = [
  {
    id: 'cit-1',
    title: 'Attention Is All You Need — Transformer Architecture Foundations',
    url: 'https://arxiv.org/abs/1706.03762',
    domain: 'arxiv.org',
    dateAdded: Date.now() - 12 * 24 * 3600 * 1000,
    note: 'Essential reference for multi-head self-attention formulas',
  },
  {
    id: 'cit-2',
    title: 'High-Rate Fault-Tolerant Quantum Computation with LDPC Codes',
    url: 'https://arxiv.org/abs/2308.07915',
    domain: 'arxiv.org',
    dateAdded: Date.now() - 6 * 24 * 3600 * 1000,
    note: 'Key paper comparing surface codes with 3D color codes',
  },
  {
    id: 'cit-3',
    title: 'RFC 8829 — JavaScript Session Establishment Protocol (JSEP) for WebRTC',
    url: 'https://datatracker.ietf.org/doc/html/rfc8829',
    domain: 'datatracker.ietf.org',
    dateAdded: Date.now() - 3 * 24 * 3600 * 1000,
    note: 'Signaling flow and ICE candidate gathering specifications',
  },
];

export const DEFAULT_SESSIONS: ActiveSession[] = [
  {
    id: 'sess-current',
    device: 'Apple Mac (Chrome 130)',
    browser: 'Chrome 130.0 / macOS Sonoma',
    ip: '198.51.100.24',
    location: 'San Francisco, CA, United States',
    isCurrent: true,
    lastActive: Date.now(),
  },
  {
    id: 'sess-mobile',
    device: 'iPhone 16 Pro (Safari)',
    browser: 'Safari 18.1 / iOS 18',
    ip: '198.51.100.89',
    location: 'San Francisco, CA, United States',
    isCurrent: false,
    lastActive: Date.now() - 3600000 * 3,
  },
  {
    id: 'sess-linux',
    device: 'Ubuntu Workstation (Brave)',
    browser: 'Brave 1.70 / Linux x86_64',
    ip: '203.0.113.15',
    location: 'San Jose, CA, United States',
    isCurrent: false,
    lastActive: Date.now() - 86400000 * 2,
  },
];

export const DEFAULT_SUBSCRIPTION: UserSubscription = {
  plan: 'pro',
  status: 'active',
  renewalDate: 'Nov 18, 2026',
  billingCycle: 'monthly',
  paymentMethod: 'Mastercard •••• 4288',
};

export const DEFAULT_USAGE: UsageQuota = {
  tokensUsed: 168400,
  tokenLimit: 1000000,
  searchesUsed: 62,
  searchLimit: 500,
  toolsUsed: 28,
  toolLimit: 200,
  storageBytesUsed: 38400000, // ~38.4 MB
  storageBytesLimit: 5368709120, // 5 GB
  resetDate: 'Nov 18, 2026',
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  historyRetention: 'indefinite',
  allowAiTraining: false,
  twoFactorEnabled: true,
};

// Safe JSON loader
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to save to ${key}:`, err);
  }
}

// User Account Storage API
export const UserAccountStore = {
  getProfile(): UserProfile {
    return loadFromStorage<UserProfile>(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE);
  },
  saveProfile(profile: UserProfile): void {
    saveToStorage(STORAGE_KEYS.PROFILE, profile);
    this.emitChange();
  },
  isUserSignedIn(): boolean {
    if (auth.currentUser) return true;
    try {
      if (localStorage.getItem('zeno_explicit_signout') === 'true') {
        return false;
      }
      if (localStorage.getItem('zeno_auth_session') === 'true') {
        return true;
      }
      const rawProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile);
        if (parsed && (parsed.id || parsed.email)) return true;
      }
    } catch {}
    // By default, if the user hasn't explicitly signed out, allow entering the workspace
    return true;
  },
  async signIn() {
    const user = await signInWithGoogle();
    if (user) {
      try {
        localStorage.setItem('zeno_auth_session', 'true');
        localStorage.removeItem('zeno_explicit_signout');
      } catch {}
      this.emitChange();
    }
    return user;
  },
  async signUp(email: string, pass: string) {
    try {
      const user = await signUpWithEmail(email, pass);
      if (user) {
        try {
          localStorage.setItem('zeno_auth_session', 'true');
          localStorage.removeItem('zeno_explicit_signout');
        } catch {}
        this.emitChange();
      }
      return user;
    } catch (err: any) {
      // If Firebase Auth does not have email/password enabled in project or has network/sandbox restrictions
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/network-request-failed' ||
        err?.code === 'auth/configuration-not-found'
      ) {
        const username = email.split('@')[0] || 'user';
        const current = this.getProfile();
        const fallbackProfile: UserProfile = {
          ...current,
          id: 'usr_' + Date.now().toString(36),
          displayName: username,
          email,
          username,
          signinProvider: 'email',
          accountStatus: 'verified',
        };
        this.saveProfile(fallbackProfile);
        try {
          localStorage.setItem('zeno_auth_session', 'true');
          localStorage.removeItem('zeno_explicit_signout');
        } catch {}
        this.emitChange();
        return {
          uid: fallbackProfile.id,
          email: fallbackProfile.email,
          displayName: fallbackProfile.displayName,
          photoURL: '',
        } as any;
      }
      throw err;
    }
  },
  async loginWithEmail(email: string, pass: string) {
    try {
      const user = await signInWithEmail(email, pass);
      if (user) {
        try {
          localStorage.setItem('zeno_auth_session', 'true');
          localStorage.removeItem('zeno_explicit_signout');
        } catch {}
        this.emitChange();
      }
      return user;
    } catch (err: any) {
      if (
        err?.code === 'auth/operation-not-allowed' ||
        err?.code === 'auth/network-request-failed' ||
        err?.code === 'auth/configuration-not-found'
      ) {
        const username = email.split('@')[0] || 'user';
        const current = this.getProfile();
        const fallbackProfile: UserProfile = {
          ...current,
          id: current.id || 'usr_' + Date.now().toString(36),
          displayName: current.displayName || username,
          email,
          signinProvider: 'email',
          accountStatus: 'verified',
        };
        this.saveProfile(fallbackProfile);
        try {
          localStorage.setItem('zeno_auth_session', 'true');
          localStorage.removeItem('zeno_explicit_signout');
        } catch {}
        this.emitChange();
        return {
          uid: fallbackProfile.id,
          email: fallbackProfile.email,
          displayName: fallbackProfile.displayName,
          photoURL: '',
        } as any;
      }
      throw err;
    }
  },
  loginAsGuest(displayName = 'Guest Explorer', email = 'guest@zeno.ai') {
    const current = this.getProfile();
    const guestProfile: UserProfile = {
      ...current,
      id: current.id || 'guest_' + Date.now().toString(36),
      displayName: displayName || current.displayName || 'Guest Explorer',
      email: email || current.email || 'guest@zeno.ai',
      signinProvider: 'guest',
      accountStatus: 'verified',
    };
    this.saveProfile(guestProfile);
    try {
      localStorage.setItem('zeno_auth_session', 'true');
      localStorage.removeItem('zeno_explicit_signout');
    } catch {}
    this.emitChange();
    return guestProfile;
  },
  async resetPassword(email: string) {
    return await sendPasswordReset(email);
  },
  async signOutUser() {
    try {
      await logOutUser();
    } catch {}
    try {
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      localStorage.removeItem('zeno_auth_session');
      localStorage.setItem('zeno_explicit_signout', 'true');
    } catch {}
    this.emitChange();
  },
  async deleteAccount() {
    try {
      await deleteUserAccount();
    } catch {}
    try {
      localStorage.clear();
      localStorage.setItem('zeno_explicit_signout', 'true');
    } catch {}
    this.emitChange();
  },

  getPersonalization(): UserPersonalization {
    return loadFromStorage<UserPersonalization>(STORAGE_KEYS.PERSONALIZATION, DEFAULT_PERSONALIZATION);
  },
  savePersonalization(p: UserPersonalization): void {
    saveToStorage(STORAGE_KEYS.PERSONALIZATION, p);
    this.emitChange();
  },



  getFolders(): ProjectFolder[] {
    return loadFromStorage<ProjectFolder[]>(STORAGE_KEYS.FOLDERS, DEFAULT_PROJECT_FOLDERS);
  },
  saveFolders(folders: ProjectFolder[]): void {
    saveToStorage(STORAGE_KEYS.FOLDERS, folders);
    this.emitChange();
  },
  addFolder(name: string, color = '#3b82f6', icon = 'Folder'): ProjectFolder {
    const folders = this.getFolders();
    const newFolder: ProjectFolder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      color,
      icon,
      createdAt: Date.now(),
    };
    folders.push(newFolder);
    this.saveFolders(folders);
    return newFolder;
  },
  deleteFolder(id: string): void {
    const folders = this.getFolders().filter((f) => f.id !== id);
    this.saveFolders(folders);
  },

  getFiles(): WorkspaceFile[] {
    return loadFromStorage<WorkspaceFile[]>(STORAGE_KEYS.FILES, DEFAULT_WORKSPACE_FILES);
  },
  saveFiles(files: WorkspaceFile[]): void {
    saveToStorage(STORAGE_KEYS.FILES, files);
    this.emitChange();
  },
  deleteFile(id: string): void {
    const files = this.getFiles().filter((f) => f.id !== id);
    this.saveFiles(files);
  },

  getCitations(): SavedCitation[] {
    return loadFromStorage<SavedCitation[]>(STORAGE_KEYS.CITATIONS, DEFAULT_CITATIONS);
  },
  saveCitations(citations: SavedCitation[]): void {
    saveToStorage(STORAGE_KEYS.CITATIONS, citations);
    this.emitChange();
  },
  addCitation(citation: Omit<SavedCitation, 'id' | 'dateAdded'>): SavedCitation {
    const citations = this.getCitations();
    const item: SavedCitation = {
      ...citation,
      id: `cit-${Date.now()}`,
      dateAdded: Date.now(),
    };
    citations.unshift(item);
    this.saveCitations(citations);
    return item;
  },
  deleteCitation(id: string): void {
    const citations = this.getCitations().filter((c) => c.id !== id);
    this.saveCitations(citations);
  },

  getBookmarks(): SavedBookmark[] {
    return loadFromStorage<SavedBookmark[]>(STORAGE_KEYS.BOOKMARKS, []);
  },
  saveBookmarks(bookmarks: SavedBookmark[]): void {
    saveToStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
    this.emitChange();
  },
  toggleBookmark(item: Omit<SavedBookmark, 'id' | 'savedAt'>): boolean {
    const bookmarks = this.getBookmarks();
    const exists = bookmarks.find(
      (b) => b.threadId === item.threadId && b.messageId === item.messageId
    );
    if (exists) {
      this.saveBookmarks(bookmarks.filter((b) => b.id !== exists.id));
      deleteBookmarkFromFirestore(exists.id).catch((err) =>
        console.error('Failed to delete bookmark from Firestore:', err)
      );
      return false;
    } else {
      const newBookmark: SavedBookmark = {
        ...item,
        id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        savedAt: Date.now(),
      };
      bookmarks.unshift(newBookmark);
      this.saveBookmarks(bookmarks);
      saveBookmarkToFirestore(newBookmark).catch((err) =>
        console.error('Failed to save bookmark to Firestore:', err)
      );
      return true;
    }
  },

  getSessions(): ActiveSession[] {
    return loadFromStorage<ActiveSession[]>(STORAGE_KEYS.SESSIONS, DEFAULT_SESSIONS);
  },
  saveSessions(sessions: ActiveSession[]): void {
    saveToStorage(STORAGE_KEYS.SESSIONS, sessions);
    this.emitChange();
  },
  revokeSession(id: string): void {
    const sessions = this.getSessions().filter((s) => s.id !== id);
    this.saveSessions(sessions);
  },
  revokeOtherSessions(): void {
    const sessions = this.getSessions().filter((s) => s.isCurrent);
    this.saveSessions(sessions);
  },

  getSubscription(): UserSubscription {
    return loadFromStorage<UserSubscription>(STORAGE_KEYS.SUBSCRIPTION, DEFAULT_SUBSCRIPTION);
  },
  saveSubscription(sub: UserSubscription): void {
    saveToStorage(STORAGE_KEYS.SUBSCRIPTION, sub);
    this.emitChange();
  },

  getUsage(): UsageQuota {
    return loadFromStorage<UsageQuota>(STORAGE_KEYS.USAGE, DEFAULT_USAGE);
  },
  recordUsage(tokens: number, searches = 0, tools = 0): void {
    const usage = this.getUsage();
    usage.tokensUsed += tokens;
    usage.searchesUsed += searches;
    usage.toolsUsed += tools;
    saveToStorage(STORAGE_KEYS.USAGE, usage);
    this.emitChange();
  },

  getPrivacy(): PrivacySettings {
    return loadFromStorage<PrivacySettings>(STORAGE_KEYS.PRIVACY, DEFAULT_PRIVACY);
  },
  savePrivacy(privacy: PrivacySettings): void {
    saveToStorage(STORAGE_KEYS.PRIVACY, privacy);
    this.emitChange();
  },

  isOnboardingDone(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.ONBOARDING_DONE) === 'true';
    } catch {
      return false;
    }
  },
  setOnboardingDone(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_DONE, 'true');
    } catch {}
    this.emitChange();
  },

  // Export all user data as structured JSON
  exportAllUserData(): string {
    const exportData = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      profile: this.getProfile(),
      personalization: this.getPersonalization(),
      projectFolders: this.getFolders(),
      workspaceFiles: this.getFiles(),
      savedCitations: this.getCitations(),
      savedBookmarks: this.getBookmarks(),
      subscription: this.getSubscription(),
      usage: this.getUsage(),
      privacy: this.getPrivacy(),
      sessions: this.getSessions(),
    };
    return JSON.stringify(exportData, null, 2);
  },

  // Delete all user account data
  purgeAllAccountData(): void {
    Object.values(STORAGE_KEYS).forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
    this.emitChange();
  },

  // Event dispatcher for reactive updates across components
  emitChange(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('zeno-account-updated'));
    }
  },
};
