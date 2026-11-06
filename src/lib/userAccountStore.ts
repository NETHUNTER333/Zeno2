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
  getAuthHeaders,
  loadUserDailyQuotaFromFirestore,
  syncUserDailyQuotaToFirestore,
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    if (firebaseUser.isAnonymous) {
      const current = UserAccountStore.getProfile();
      UserAccountStore.saveProfile({
        ...current,
        id: firebaseUser.uid || current.id || 'guest_' + Date.now().toString(36),
        displayName: current.signinProvider === 'guest' ? current.displayName || 'Guest Explorer' : 'Guest Explorer',
        email: 'guest@kinich.app',
        signinProvider: 'guest',
      });
      return;
    }
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

      // Sync authoritative daily usage quota & tier from Firestore + Server Ledger
      await UserAccountStore.syncQuotaWithServerAndFirestore();
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
  PROFILE: 'kinich_user_profile',
  PERSONALIZATION: 'kinich_user_personalization',
  FOLDERS: 'kinich_project_folders',
  FILES: 'kinich_workspace_files',
  CITATIONS: 'kinich_saved_citations',
  BOOKMARKS: 'kinich_saved_bookmarks',
  SESSIONS: 'kinich_active_sessions',
  SUBSCRIPTION: 'kinich_user_subscription_v2',
  USAGE: 'kinich_usage_quota_v2',
  PRIVACY: 'kinich_privacy_settings',
  ONBOARDING_DONE: 'kinich_onboarding_completed',
  DAILY_STREAK: 'kinich_daily_streak_v1',
};

export interface StreakMilestone {
  days: number;
  title: string;
  subtitle: string;
  bonusMessages: number;
  bonusUploads: number;
  bonusShields: number;
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    days: 1,
    title: 'First Spark',
    subtitle: 'Initiate your daily research & study habit',
    bonusMessages: 3,
    bonusUploads: 1,
    bonusShields: 0,
  },
  {
    days: 3,
    title: '3-Day Momentum',
    subtitle: 'Three consecutive days of active inquiry',
    bonusMessages: 5,
    bonusUploads: 1,
    bonusShields: 1,
  },
  {
    days: 7,
    title: '7-Day Weekly Habit',
    subtitle: 'Full week of unbroken intellectual momentum',
    bonusMessages: 8,
    bonusUploads: 2,
    bonusShields: 1,
  },
  {
    days: 14,
    title: '14-Day Deep Thinker',
    subtitle: 'Two weeks of sustained synthesis & analysis',
    bonusMessages: 10,
    bonusUploads: 2,
    bonusShields: 1,
  },
  {
    days: 30,
    title: '30-Day Sovereign',
    subtitle: 'Monthly mastery across research & study workflows',
    bonusMessages: 12,
    bonusUploads: 3,
    bonusShields: 1,
  },
  {
    days: 60,
    title: '60-Day Vanguard',
    subtitle: 'Two months of relentless daily execution',
    bonusMessages: 15,
    bonusUploads: 3,
    bonusShields: 1,
  },
  {
    days: 100,
    title: '100-Day Apex',
    subtitle: 'Centurion status in the Kinich workspace',
    bonusMessages: 15,
    bonusUploads: 5,
    bonusShields: 1,
  },
];

export interface AchievementBadge {
  id: string;
  title: string;
  subtitle: string;
  category: 'streak' | 'mastery' | 'exploration' | 'curation';
  tier: 'bronze' | 'silver' | 'gold' | 'obsidian';
  iconName: 'flame' | 'trophy' | 'zap' | 'compass' | 'book' | 'shield' | 'layers' | 'award' | 'bookmark';
  targetValue: number;
  unitLabel: string;
  bonusMessages: number;
  bonusUploads: number;
  bonusShields: number;
}

export interface EvaluatedBadge extends AchievementBadge {
  currentValue: number;
  progressPct: number;
  isUnlocked: boolean;
  isClaimed: boolean;
  isFeatured: boolean;
}

export const ACHIEVEMENT_BADGES: AchievementBadge[] = [];

export interface DailyStreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD in local time
  activeDates: string[]; // Sorted unique YYYY-MM-DD local dates
  todayInteractions: number;
  todayRealInteractions: number; // Explicit user-triggered interactions today
  dailyCounts: Record<string, number>; // YYYY-MM-DD -> interaction count
  dailyGoal: number; // Target interactions per day (1, 3, 5, 10)
  streakFreezes: number; // Available Streak Shields (0 - 3)
  maxStreakFreezes: number; // Max capacity (3)
  frozenDates: string[]; // Dates protected by a Streak Shield
  claimedMilestones: number[]; // Milestone day counts already claimed
  claimedBadges?: string[]; // Achievement Badge IDs already claimed
  notifiedMilestones?: number[]; // Milestone day counts already shown in Achievement Unlocked toast
  notifiedBadges?: string[]; // Badge IDs already shown in Achievement Unlocked toast
  exploredModels?: string[]; // Unique model IDs explored by the user
  featuredBadgeId?: string; // Currently equipped badge ID
  totalActiveDays: number;
  lastFreezeEarnedDate?: string;
  reminderEnabled: boolean; // Daily streak reminder toast enabled
  reminderTime: string; // HH:MM in 24h format (e.g., "18:00")
  browserNotificationsEnabled?: boolean;
  lastReminderDismissedDate?: string; // YYYY-MM-DD
}

export interface AchievementUnlockPayload {
  id: string;
  kind: 'milestone' | 'badge';
  days?: number;
  badgeId?: string;
  title: string;
  subtitle: string;
  kickerLabel: string;
  tier: 'bronze' | 'silver' | 'gold' | 'obsidian';
  iconName: AchievementBadge['iconName'];
  bonusMessages: number;
  bonusUploads: number;
  bonusShields: number;
  isClaimed: boolean;
  isUnlocked: boolean;
  isPreview?: boolean;
  unlockedAt: number;
}

export function toLocalDateKey(ts = Date.now()): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - 1);
  return toLocalDateKey(dt.getTime());
}

function computeStreakFromDates(
  activeDates: string[],
  previousLongest = 1,
  availableFreezes = 1,
  existingFrozenDates: string[] = []
): {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  streakFreezes: number;
  frozenDates: string[];
} {
  const uniqueSorted = Array.from(new Set(activeDates.filter(Boolean))).sort();
  const todayKey = toLocalDateKey();
  const frozenSet = new Set<string>(existingFrozenDates.filter(Boolean));
  let freezesLeft = Math.max(0, Math.min(3, availableFreezes));

  if (uniqueSorted.length === 0) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(1, previousLongest),
      lastActiveDate: todayKey,
      streakFreezes: freezesLeft,
      frozenDates: Array.from(frozenSet).sort(),
    };
  }

  const dateSet = new Set(uniqueSorted);
  const yesterdayKey = getPreviousDateKey(todayKey);

  // Determine anchor date for current streak
  let cursor = dateSet.has(todayKey)
    ? todayKey
    : dateSet.has(yesterdayKey)
    ? yesterdayKey
    : uniqueSorted[uniqueSorted.length - 1];

  let currentStreak = 0;
  if (cursor === todayKey || cursor === yesterdayKey) {
    while (true) {
      if (dateSet.has(cursor)) {
        currentStreak += 1;
        cursor = getPreviousDateKey(cursor);
      } else if (frozenSet.has(cursor)) {
        // Already protected by a freeze on this date
        cursor = getPreviousDateKey(cursor);
      } else {
        // Check if there is an active day immediately before this single missed day
        const prevBeforeGap = getPreviousDateKey(cursor);
        if (dateSet.has(prevBeforeGap) && freezesLeft > 0) {
          frozenSet.add(cursor);
          freezesLeft -= 1;
          cursor = prevBeforeGap;
        } else {
          break;
        }
      }
    }
  } else {
    currentStreak = 1;
  }

  // Compute longest streak across all recorded dates (accounting for frozen bridge dates)
  let longest = Math.max(currentStreak, previousLongest, 1);
  const combinedDates = Array.from(new Set([...uniqueSorted, ...Array.from(frozenSet)])).sort();
  let run = 0;
  let prevKey: string | null = null;
  for (const key of combinedDates) {
    const isCounted = dateSet.has(key);
    if (prevKey && getPreviousDateKey(key) === prevKey) {
      if (isCounted) run += 1;
    } else {
      run = isCounted ? 1 : 0;
    }
    if (run > longest) longest = run;
    prevKey = key;
  }

  return {
    currentStreak: Math.max(1, currentStreak),
    longestStreak: longest,
    lastActiveDate: uniqueSorted[uniqueSorted.length - 1] || todayKey,
    streakFreezes: freezesLeft,
    frozenDates: Array.from(frozenSet).sort().slice(-90),
  };
}

export const DEFAULT_PROFILE: UserProfile = {
  id: 'kinich_usr_98124',
  displayName: 'doom',
  username: 'doomsh7',
  email: 'user@kinich.app',
  phoneNumber: '',
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

export const DEFAULT_PROJECT_FOLDERS: ProjectFolder[] = [];

export const DEFAULT_WORKSPACE_FILES: WorkspaceFile[] = [];

export const DEFAULT_CITATIONS: SavedCitation[] = [];

export const DEFAULT_SESSIONS: ActiveSession[] = [
  {
    id: 'sess-current',
    device: 'Current Browser Session',
    browser:
      typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 64) : 'Web Browser',
    ip: 'Active Session',
    location: 'Authenticated Workspace',
    isCurrent: true,
    lastActive: Date.now(),
  },
];

export const PLAN_LIMITS: Record<
  'free' | 'spark' | 'fire',
  {
    name: string;
    priceMonthlyUsd: number;
    priceYearlyUsd: number;
    fileUploadLimit: number;
    maxFilesPerMessage: number;
    messageLimit: number;
    searchLimit: number;
    deepResearchLimit: number;
    pdfStudyLimit: number;
    tokenLimit: number;
    toolLimit: number;
    storageBytesLimit: number;
  }
> = {
  free: {
    name: 'Free',
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    fileUploadLimit: 3, // 3 daily free file uploads
    maxFilesPerMessage: 2,
    messageLimit: 5, // 5 daily free AI messages
    searchLimit: 5, // 5 daily free web searches
    deepResearchLimit: 3, // 3 daily free autonomous deep research runs
    pdfStudyLimit: 5, // 5 daily free study sessions
    tokenLimit: 250000,
    toolLimit: 15,
    storageBytesLimit: 104857600, // 100 MB
  },
  spark: {
    name: 'Spark',
    priceMonthlyUsd: 3,
    priceYearlyUsd: 29,
    fileUploadLimit: 250, // 10x limit boost
    maxFilesPerMessage: 25,
    messageLimit: 1500, // 10x limit boost
    searchLimit: 750, // 10x limit boost
    deepResearchLimit: 100, // 10x limit boost
    pdfStudyLimit: 200, // 10x limit boost
    tokenLimit: 10000000, // 10x limit boost (10M tokens)
    toolLimit: 2000, // 10x limit boost
    storageBytesLimit: 10737418240, // 10 GB
  },
  fire: {
    name: 'Fire',
    priceMonthlyUsd: 7,
    priceYearlyUsd: 67,
    fileUploadLimit: 1000, // 1,000 daily file uploads
    maxFilesPerMessage: 50,
    messageLimit: 5000, // 5,000 daily AI messages
    searchLimit: 2500, // 2,500 daily web searches
    deepResearchLimit: 300, // 300 daily autonomous deep research runs
    pdfStudyLimit: 500, // 500 daily study sessions
    tokenLimit: 25000000, // 25M daily tokens
    toolLimit: 10000, // 10,000 daily agent & tool calls
    storageBytesLimit: 32212254720, // 30 GB
  },
};

export const DEFAULT_SUBSCRIPTION: UserSubscription = {
  plan: 'free',
  status: 'active',
  renewalDate: 'Daily Reset (00:00 UTC)',
  billingCycle: 'monthly',
  paymentMethod: 'Free Tier ($0 USD)',
};

export const DEFAULT_USAGE: UsageQuota = {
  messagesUsed: 0,
  messageLimit: PLAN_LIMITS.free.messageLimit,
  filesUploaded: 0,
  fileUploadLimit: PLAN_LIMITS.free.fileUploadLimit,
  maxFilesPerMessage: PLAN_LIMITS.free.maxFilesPerMessage,
  tokensUsed: 0,
  tokenLimit: PLAN_LIMITS.free.tokenLimit,
  searchesUsed: 0,
  searchLimit: PLAN_LIMITS.free.searchLimit,
  deepResearchUsed: 0,
  deepResearchLimit: PLAN_LIMITS.free.deepResearchLimit,
  pdfStudyUsed: 0,
  pdfStudyLimit: PLAN_LIMITS.free.pdfStudyLimit,
  toolsUsed: 0,
  toolLimit: PLAN_LIMITS.free.toolLimit,
  storageBytesUsed: 0,
  storageBytesLimit: PLAN_LIMITS.free.storageBytesLimit,
  resetDate: 'Resets 00:00 UTC',
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
      if (localStorage.getItem('kinich_explicit_signout') === 'true') {
        return false;
      }
      if (localStorage.getItem('kinich_auth_session') === 'true') {
        return true;
      }
      const rawProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile);
        if (parsed && (parsed.id || parsed.email)) return true;
      }
    } catch {}
    // Require explicit sign-in to enter the workspace
    return false;
  },
  isGuest(): boolean {
    if (!this.isUserSignedIn()) return true;
    if (auth.currentUser?.isAnonymous) return true;
    const profile = this.getProfile();
    if (
      profile.signinProvider === 'guest' ||
      profile.email === 'guest@kinich.app' ||
      String(profile.id || '').startsWith('guest_')
    ) {
      return !(auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.email);
    }
    return false;
  },
  isGuestUser(): boolean {
    try {
      const profile = this.getProfile();
      return profile?.signinProvider === 'guest';
    } catch {}
    return false;
  },
  getCurrentPlan(): 'free' | 'spark' | 'fire' {
    return this.getNormalizedPlan();
  },
  async signIn() {
    const user = await signInWithGoogle();
    if (user) {
      try {
        localStorage.setItem('kinich_auth_session', 'true');
        localStorage.removeItem('kinich_explicit_signout');
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
          localStorage.setItem('kinich_auth_session', 'true');
          localStorage.removeItem('kinich_explicit_signout');
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
          localStorage.setItem('kinich_auth_session', 'true');
          localStorage.removeItem('kinich_explicit_signout');
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
          localStorage.setItem('kinich_auth_session', 'true');
          localStorage.removeItem('kinich_explicit_signout');
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
          localStorage.setItem('kinich_auth_session', 'true');
          localStorage.removeItem('kinich_explicit_signout');
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
  loginAsGuest(displayName = 'Guest Explorer', email = 'guest@kinich.app') {
    const current = this.getProfile();
    const guestProfile: UserProfile = {
      ...current,
      id: current.id || 'guest_' + Date.now().toString(36),
      displayName: displayName || current.displayName || 'Guest Explorer',
      email: email || current.email || 'guest@kinich.app',
      signinProvider: 'guest',
      accountStatus: 'verified',
    };
    this.saveProfile(guestProfile);
    try {
      localStorage.setItem('kinich_auth_session', 'true');
      localStorage.removeItem('kinich_explicit_signout');
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
      localStorage.removeItem('kinich_auth_session');
      localStorage.setItem('kinich_explicit_signout', 'true');
    } catch {}
    this.emitChange();
  },
  async deleteAccount() {
    try {
      await deleteUserAccount();
    } catch {}
    try {
      localStorage.clear();
      localStorage.setItem('kinich_explicit_signout', 'true');
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

  getNormalizedPlan(plan?: string): 'free' | 'spark' | 'fire' {
    const raw = plan || this.getSubscription().plan;
    if (raw === 'fire' || raw === 'enterprise') return 'fire';
    if (raw === 'spark' || raw === 'pro') return 'spark';
    return 'free';
  },
  getPlanLimits(plan?: string) {
    const norm = this.getNormalizedPlan(plan);
    return PLAN_LIMITS[norm];
  },
  canUseModel(requiredTier: 'free' | 'spark' | 'fire' = 'spark'): boolean {
    if (requiredTier === 'free') return true;
    const current = this.getNormalizedPlan();
    if (current === 'fire') return true;
    if (current === 'spark' && requiredTier === 'spark') return true;
    return false;
  },
  getSubscription(): UserSubscription {
    return loadFromStorage<UserSubscription>(STORAGE_KEYS.SUBSCRIPTION, DEFAULT_SUBSCRIPTION);
  },
  saveSubscription(sub: UserSubscription): void {
    saveToStorage(STORAGE_KEYS.SUBSCRIPTION, sub);
    const limits = this.getPlanLimits(sub.plan);
    const rawUsage = loadFromStorage<UsageQuota>(STORAGE_KEYS.USAGE, DEFAULT_USAGE);
    const syncedUsage: UsageQuota = {
      ...DEFAULT_USAGE,
      ...rawUsage,
      messageLimit: limits.messageLimit,
      fileUploadLimit: limits.fileUploadLimit,
      maxFilesPerMessage: limits.maxFilesPerMessage,
      tokenLimit: limits.tokenLimit,
      searchLimit: limits.searchLimit,
      deepResearchLimit: limits.deepResearchLimit,
      pdfStudyLimit: limits.pdfStudyLimit,
      toolLimit: limits.toolLimit,
      storageBytesLimit: limits.storageBytesLimit,
    };
    saveToStorage(STORAGE_KEYS.USAGE, syncedUsage);
    this.emitChange();
  },
  upgradePlan(
    plan: 'free' | 'spark' | 'fire',
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): UserSubscription {
    const nextMonth = new Date(Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 86400000);
    const renewalDate = nextMonth.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const sub: UserSubscription = {
      plan,
      status: 'active',
      renewalDate,
      billingCycle,
      paymentMethod:
        plan === 'free'
          ? 'Free Tier'
          : plan === 'spark'
          ? 'Spark ($3 USD)'
          : 'Fire ($7 USD)',
    };
    this.saveSubscription(sub);

    // Sync upgraded tier to Firestore and backend usage counters
    const currentUsage = this.getUsage();
    syncUserDailyQuotaToFirestore({
      plan,
      messagesUsed: currentUsage.messagesUsed,
      filesUploaded: currentUsage.filesUploaded,
      searchesUsed: currentUsage.searchesUsed,
      deepResearchUsed: currentUsage.deepResearchUsed,
      pdfStudyUsed: currentUsage.pdfStudyUsed,
      tokensUsed: currentUsage.tokensUsed,
    }).catch(() => {});

    getAuthHeaders()
      .then((headers) =>
        fetch('/api/quota/upgrade', {
          method: 'POST',
          headers,
          body: JSON.stringify({ plan }),
        })
      )
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.quota) {
          this.applyServerQuotaSnapshot(res.quota, false);
        }
      })
      .catch(() => {});

    return sub;
  },

  getUsage(): UsageQuota {
    const currentPlan = this.getNormalizedPlan();
    const limits = this.getPlanLimits(currentPlan);
    const raw = loadFromStorage<
      UsageQuota & {
        bonusMessagesGranted?: number;
        bonusUploadsGranted?: number;
        bonusQuizzesGranted?: number;
        bonusDeepResearchGranted?: number;
      }
    >(STORAGE_KEYS.USAGE, DEFAULT_USAGE);

    // On Free Tier, strictly enforce the starter daily limits (5 prompts, 3 uploads, 5 searches, 3 deep research, 5 PDF study)
    // so legacy localStorage bonuses or Math.max(999999) bugs never show Unlimited or 625/133 on Free Tier.
    const isFree = currentPlan === 'free';
    const isFire = currentPlan === 'fire';
    const bonusMsgs = isFree ? 0 : Number(raw.bonusMessagesGranted || 0);
    const bonusUploads = isFree ? 0 : Number(raw.bonusUploadsGranted || 0);
    const bonusQuizzes = isFree ? 0 : Number(raw.bonusQuizzesGranted || 0);
    const bonusResearch = isFree ? 0 : Number(raw.bonusDeepResearchGranted || 0);

    return {
      ...DEFAULT_USAGE,
      ...raw,
      messagesUsed: Number(raw.messagesUsed || 0),
      filesUploaded: Number(raw.filesUploaded || 0),
      searchesUsed: Number(raw.searchesUsed || 0),
      deepResearchUsed: Number(raw.deepResearchUsed || 0),
      pdfStudyUsed: Number(raw.pdfStudyUsed || 0),
      tokensUsed: Number(raw.tokensUsed || 0),
      toolsUsed: Number(raw.toolsUsed || 0),
      messageLimit: limits.messageLimit + bonusMsgs,
      fileUploadLimit: limits.fileUploadLimit + bonusUploads,
      maxFilesPerMessage: isFree
        ? limits.maxFilesPerMessage
        : Math.max(limits.maxFilesPerMessage, bonusUploads > 0 ? 10 : 0),
      tokenLimit: limits.tokenLimit,
      searchLimit: limits.searchLimit + bonusResearch,
      deepResearchLimit: limits.deepResearchLimit + bonusResearch,
      pdfStudyLimit: limits.pdfStudyLimit + bonusQuizzes,
      toolLimit: limits.toolLimit,
      storageBytesLimit: limits.storageBytesLimit,
    };
  },

  applyServerQuotaSnapshot(snapshot: any, pushToFirestore = true): void {
    if (!snapshot || typeof snapshot !== 'object') return;
    const currentSub = this.getSubscription();
    const localPlan = this.getNormalizedPlan(currentSub.plan);
    const hasExplicitLocalSub = Boolean(localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION));
    const serverPlan: 'free' | 'spark' | 'fire' =
      snapshot.plan === 'fire' || snapshot.plan === 'spark' || snapshot.plan === 'free'
        ? snapshot.plan
        : localPlan;

    // If the server has an authoritative billing record (e.g. refund.succeeded revoked Spark -> Free, or active Dodo sub),
    // honor the server's plan so stale localStorage never keeps Spark active after a refund.
    const isAuthoritativeServerPlan = Boolean(
      snapshot.authoritativePlan ||
        (snapshot.billingStatus && snapshot.billingStatus !== 'none')
    );
    const effectivePlan: 'free' | 'spark' | 'fire' = isAuthoritativeServerPlan
      ? serverPlan
      : hasExplicitLocalSub
      ? localPlan
      : serverPlan;

    if (effectivePlan !== currentSub.plan) {
      saveToStorage(STORAGE_KEYS.SUBSCRIPTION, {
        ...currentSub,
        plan: effectivePlan,
        status:
          snapshot.billingStatus === 'cancelled'
            ? 'canceled'
            : effectivePlan === 'free'
            ? 'active'
            : currentSub.status,
      });
    }

    const limits = this.getPlanLimits(effectivePlan);
    const local = loadFromStorage<UsageQuota>(STORAGE_KEYS.USAGE, DEFAULT_USAGE);
    const merged: UsageQuota = {
      ...DEFAULT_USAGE,
      ...local,
      messagesUsed: Math.max(Number(local.messagesUsed || 0), Number(snapshot.messagesUsed || 0)),
      filesUploaded: Math.max(Number(local.filesUploaded || 0), Number(snapshot.filesUploaded || 0)),
      searchesUsed: Math.max(Number(local.searchesUsed || 0), Number(snapshot.searchesUsed || 0)),
      deepResearchUsed: Math.max(
        Number(local.deepResearchUsed || 0),
        Number(snapshot.deepResearchUsed || 0)
      ),
      pdfStudyUsed: Math.max(Number(local.pdfStudyUsed || 0), Number(snapshot.pdfStudyUsed || 0)),
      tokensUsed: Math.max(Number(local.tokensUsed || 0), Number(snapshot.tokensUsed || 0)),
      toolsUsed: Math.max(Number(local.toolsUsed || 0), Number(snapshot.toolsUsed || 0)),
      messageLimit: limits.messageLimit,
      fileUploadLimit: limits.fileUploadLimit,
      maxFilesPerMessage: limits.maxFilesPerMessage,
      tokenLimit: limits.tokenLimit,
      searchLimit: limits.searchLimit,
      deepResearchLimit: limits.deepResearchLimit,
      pdfStudyLimit: limits.pdfStudyLimit,
      toolLimit: limits.toolLimit,
      storageBytesLimit: limits.storageBytesLimit,
      resetDate: snapshot.resetAtUtc ? 'Resets 00:00 UTC' : local.resetDate || 'Resets 00:00 UTC',
    };

    saveToStorage(STORAGE_KEYS.USAGE, merged);
    this.emitChange();

    if (pushToFirestore && auth.currentUser) {
      syncUserDailyQuotaToFirestore({
        plan: effectivePlan,
        messagesUsed: merged.messagesUsed,
        filesUploaded: merged.filesUploaded,
        searchesUsed: merged.searchesUsed,
        deepResearchUsed: merged.deepResearchUsed,
        pdfStudyUsed: merged.pdfStudyUsed,
        tokensUsed: merged.tokensUsed,
      }).catch(() => {});
    }
  },

  async syncQuotaWithServerAndFirestore(): Promise<void> {
    try {
      const localUsage = this.getUsage();
      const localPlan = this.getNormalizedPlan();

      // 1. Pull authoritative Firestore daily quota document if signed in
      const firestoreQuota = await loadUserDailyQuotaFromFirestore();
      if (firestoreQuota) {
        this.applyServerQuotaSnapshot(firestoreQuota, false);
      }

      // 2. Sync monotonic counters with backend server usage counters (/api/quota/sync)
      const latestUsage = this.getUsage();
      const latestPlan = this.getNormalizedPlan();
      const headers = await getAuthHeaders();
      const res = await fetch('/api/quota/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plan: firestoreQuota?.plan || latestPlan || localPlan,
          messagesUsed: Math.max(localUsage.messagesUsed, latestUsage.messagesUsed),
          filesUploaded: Math.max(localUsage.filesUploaded, latestUsage.filesUploaded),
          searchesUsed: Math.max(localUsage.searchesUsed, latestUsage.searchesUsed),
          deepResearchUsed: Math.max(localUsage.deepResearchUsed, latestUsage.deepResearchUsed),
          pdfStudyUsed: Math.max(localUsage.pdfStudyUsed, latestUsage.pdfStudyUsed),
          tokensUsed: Math.max(localUsage.tokensUsed, latestUsage.tokensUsed),
          toolsUsed: Math.max(localUsage.toolsUsed, latestUsage.toolsUsed),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.quota) {
          this.applyServerQuotaSnapshot(data.quota, true);
        }
      }
    } catch {
      // Offline or static fallback — keep local + Firestore state
    }
  },

  pushUsageToServerAndFirestore(usage: UsageQuota): void {
    const plan = this.getNormalizedPlan();
    syncUserDailyQuotaToFirestore({
      plan,
      messagesUsed: usage.messagesUsed,
      filesUploaded: usage.filesUploaded,
      searchesUsed: usage.searchesUsed,
      deepResearchUsed: usage.deepResearchUsed,
      pdfStudyUsed: usage.pdfStudyUsed,
      tokensUsed: usage.tokensUsed,
    }).catch(() => {});

    getAuthHeaders()
      .then((headers) =>
        fetch('/api/quota/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            plan,
            messagesUsed: usage.messagesUsed,
            filesUploaded: usage.filesUploaded,
            searchesUsed: usage.searchesUsed,
            deepResearchUsed: usage.deepResearchUsed,
            pdfStudyUsed: usage.pdfStudyUsed,
            tokensUsed: usage.tokensUsed,
            toolsUsed: usage.toolsUsed,
          }),
        })
      )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.quota) {
          this.applyServerQuotaSnapshot(data.quota, false);
        }
      })
      .catch(() => {});
  },

  recordUsage(tokens: number, searches = 0, tools = 0, messages = 1, files = 0): void {
    const usage = this.getUsage();
    usage.tokensUsed += tokens;
    usage.searchesUsed += searches;
    usage.toolsUsed += tools;
    usage.messagesUsed += messages;
    usage.filesUploaded += files;
    saveToStorage(STORAGE_KEYS.USAGE, usage);
    this.recordDailyInteraction(false);
    this.emitChange();
    this.pushUsageToServerAndFirestore(usage);
  },
  recordFileUploads(count: number, bytes = 0): void {
    const usage = this.getUsage();
    usage.filesUploaded += count;
    usage.storageBytesUsed += bytes;
    saveToStorage(STORAGE_KEYS.USAGE, usage);
    this.recordDailyInteraction(false);
    this.emitChange();
    this.pushUsageToServerAndFirestore(usage);
  },
  recordDeepResearchRun(): void {
    const usage = this.getUsage();
    usage.deepResearchUsed += 1;
    saveToStorage(STORAGE_KEYS.USAGE, usage);
    this.emitChange();
    this.pushUsageToServerAndFirestore(usage);
  },
  recordPdfStudySession(): void {
    const usage = this.getUsage();
    usage.pdfStudyUsed += 1;
    saveToStorage(STORAGE_KEYS.USAGE, usage);
    this.recordDailyInteraction(false);
    this.emitChange();
    this.pushUsageToServerAndFirestore(usage);
  },
  resetUsageQuota(): void {
    // Client-side manual reset is disabled for anti-abuse enforcement; re-syncs from server/Firestore instead
    this.syncQuotaWithServerAndFirestore();
  },
  grantReferrerBonusQuota(
    bonusUploads = 25,
    bonusMessages = 100,
    bonusQuizzes = 10,
    bonusDeepResearch = 10
  ): void {
    const raw = loadFromStorage<UsageQuota & {
      bonusMessagesGranted?: number;
      bonusUploadsGranted?: number;
      bonusQuizzesGranted?: number;
      bonusDeepResearchGranted?: number;
    }>(STORAGE_KEYS.USAGE, DEFAULT_USAGE);
    const prevBonusMsgs = Number(raw.bonusMessagesGranted || 0);
    const prevBonusUploads = Number(raw.bonusUploadsGranted || 0);
    const prevBonusQuizzes = Number(raw.bonusQuizzesGranted || 0);
    const prevBonusResearch = Number(raw.bonusDeepResearchGranted || 0);

    const updated = {
      ...raw,
      filesUploaded: Math.max(0, Number(raw.filesUploaded || 0) - bonusUploads),
      messagesUsed: Math.max(0, Number(raw.messagesUsed || 0) - bonusMessages),
      pdfStudyUsed: Math.max(0, Number(raw.pdfStudyUsed || 0) - bonusQuizzes),
      deepResearchUsed: Math.max(0, Number(raw.deepResearchUsed || 0) - bonusDeepResearch),
      bonusMessagesGranted: prevBonusMsgs + bonusMessages,
      bonusUploadsGranted: prevBonusUploads + bonusUploads,
      bonusQuizzesGranted: prevBonusQuizzes + bonusQuizzes,
      bonusDeepResearchGranted: prevBonusResearch + bonusDeepResearch,
      messageLimit: Number(raw.messageLimit || DEFAULT_USAGE.messageLimit) + bonusMessages,
      fileUploadLimit: Number(raw.fileUploadLimit || DEFAULT_USAGE.fileUploadLimit) + bonusUploads,
      pdfStudyLimit: Number(raw.pdfStudyLimit || DEFAULT_USAGE.pdfStudyLimit) + bonusQuizzes,
      deepResearchLimit:
        Number(raw.deepResearchLimit || DEFAULT_USAGE.deepResearchLimit) + bonusDeepResearch,
    };
    saveToStorage(STORAGE_KEYS.USAGE, updated);
    this.emitChange();
  },

  getStoredThreadsFallback(): Array<{
    createdAt?: number;
    messages?: Array<{ timestamp?: number; modelUsed?: string }>;
  }> {
    try {
      const raw = localStorage.getItem('kinich_threads');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  getDailyStreak(
    threads?: Array<{ createdAt?: number; messages?: Array<{ timestamp?: number }> }>
  ): DailyStreakData {
    const effectiveThreads =
      Array.isArray(threads) && threads.length > 0 ? threads : this.getStoredThreadsFallback();
    const todayKey = toLocalDateKey();
    const raw = loadFromStorage<Partial<DailyStreakData>>(STORAGE_KEYS.DAILY_STREAK, {});
    const dateSet = new Set<string>(Array.isArray(raw.activeDates) ? raw.activeDates : []);
    const dailyCounts: Record<string, number> =
      raw.dailyCounts && typeof raw.dailyCounts === 'object' ? { ...raw.dailyCounts } : {};

    if (raw.lastActiveDate) {
      dateSet.add(raw.lastActiveDate);
    }

    // Backfill active dates & interaction counts ONLY from user messages in conversation threads
    // (Never count empty threads or page reloads so opening a referral link never awards a badge)
    if (Array.isArray(effectiveThreads)) {
      const threadCounts: Record<string, number> = {};
      for (const t of effectiveThreads) {
        if (Array.isArray(t.messages) && t.messages.length > 0) {
          for (const m of t.messages as Array<{ role?: string; timestamp?: number }>) {
            if (m?.role && m.role !== 'user') continue;
            if (typeof m?.timestamp === 'number' && m.timestamp > 0) {
              const k = toLocalDateKey(m.timestamp);
              dateSet.add(k);
              threadCounts[k] = (threadCounts[k] || 0) + 1;
            }
          }
        }
      }
      for (const [k, count] of Object.entries(threadCounts)) {
        dailyCounts[k] = Math.max(dailyCounts[k] || 0, count);
      }
    }

    // Mark today active since the user is actively in a session
    dateSet.add(todayKey);
    for (const d of dateSet) {
      if (!dailyCounts[d] || dailyCounts[d] < 1) {
        dailyCounts[d] = 1;
      }
    }

    const sortedDates = Array.from(dateSet).sort().slice(-120);
    const availableFreezes =
      typeof raw.streakFreezes === 'number' ? Math.max(0, Math.min(3, raw.streakFreezes)) : 1;
    const existingFrozen = Array.isArray(raw.frozenDates) ? raw.frozenDates : [];

    const computed = computeStreakFromDates(
      sortedDates,
      Number(raw.longestStreak || 1),
      availableFreezes,
      existingFrozen
    );

    const todayInteractions = Math.max(
      1,
      raw.lastActiveDate === todayKey ? Number(raw.todayInteractions || 1) : 1,
      Number(dailyCounts[todayKey] || 1)
    );
    dailyCounts[todayKey] = todayInteractions;

    const dailyGoal =
      typeof raw.dailyGoal === 'number' && [1, 3, 5, 10].includes(raw.dailyGoal)
        ? raw.dailyGoal
        : 3;

    const claimedMilestones = Array.isArray(raw.claimedMilestones)
      ? Array.from(new Set(raw.claimedMilestones.map(Number).filter((n) => n > 0))).sort(
          (a, b) => a - b
        )
      : [];

    const todayRealInteractions =
      raw.lastActiveDate === todayKey ? Math.max(0, Number(raw.todayRealInteractions || 0)) : 0;

    const reminderEnabled = typeof raw.reminderEnabled === 'boolean' ? raw.reminderEnabled : true;
    const reminderTime =
      typeof raw.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(raw.reminderTime)
        ? raw.reminderTime
        : '18:00';
    const claimedBadges = Array.isArray(raw.claimedBadges)
      ? Array.from(new Set(raw.claimedBadges.map(String).filter(Boolean)))
      : [];
    const notifiedMilestones = Array.isArray(raw.notifiedMilestones)
      ? Array.from(new Set(raw.notifiedMilestones.map(Number).filter((n) => n > 0))).sort(
          (a, b) => a - b
        )
      : [];
    const notifiedBadges = Array.isArray(raw.notifiedBadges)
      ? Array.from(new Set(raw.notifiedBadges.map(String).filter(Boolean)))
      : [];
    const exploredModels = Array.isArray(raw.exploredModels)
      ? Array.from(new Set(raw.exploredModels.map(String).filter(Boolean)))
      : ['deepseek-v4.1-flash-free'];
    const featuredBadgeId =
      typeof raw.featuredBadgeId === 'string' && raw.featuredBadgeId
        ? raw.featuredBadgeId
        : 'first-spark';

    const result: DailyStreakData = {
      currentStreak: computed.currentStreak,
      longestStreak: computed.longestStreak,
      lastActiveDate: computed.lastActiveDate,
      activeDates: sortedDates,
      todayInteractions,
      todayRealInteractions,
      dailyCounts,
      dailyGoal,
      streakFreezes: computed.streakFreezes,
      maxStreakFreezes: 3,
      frozenDates: computed.frozenDates,
      claimedMilestones,
      claimedBadges,
      notifiedMilestones,
      notifiedBadges,
      exploredModels,
      featuredBadgeId,
      totalActiveDays: sortedDates.length,
      lastFreezeEarnedDate: raw.lastFreezeEarnedDate,
      reminderEnabled,
      reminderTime,
      browserNotificationsEnabled: Boolean(raw.browserNotificationsEnabled),
      lastReminderDismissedDate: raw.lastReminderDismissedDate,
    };

    if (
      raw.currentStreak !== result.currentStreak ||
      raw.longestStreak !== result.longestStreak ||
      raw.lastActiveDate !== result.lastActiveDate ||
      (raw.activeDates?.length || 0) !== result.activeDates.length ||
      raw.streakFreezes !== result.streakFreezes ||
      raw.reminderTime !== result.reminderTime
    ) {
      saveToStorage(STORAGE_KEYS.DAILY_STREAK, result);
    }

    return result;
  },

  recordDailyInteraction(emit = true): DailyStreakData {
    const todayKey = toLocalDateKey();
    const raw = loadFromStorage<Partial<DailyStreakData>>(STORAGE_KEYS.DAILY_STREAK, {});
    const dateSet = new Set<string>(Array.isArray(raw.activeDates) ? raw.activeDates : []);
    const dailyCounts: Record<string, number> =
      raw.dailyCounts && typeof raw.dailyCounts === 'object' ? { ...raw.dailyCounts } : {};

    if (raw.lastActiveDate) {
      dateSet.add(raw.lastActiveDate);
    }
    dateSet.add(todayKey);

    const sortedDates = Array.from(dateSet).sort().slice(-120);
    const availableFreezes =
      typeof raw.streakFreezes === 'number' ? Math.max(0, Math.min(3, raw.streakFreezes)) : 1;
    const existingFrozen = Array.isArray(raw.frozenDates) ? raw.frozenDates : [];

    const computed = computeStreakFromDates(
      sortedDates,
      Number(raw.longestStreak || 1),
      availableFreezes,
      existingFrozen
    );

    const prevTodayCount =
      raw.lastActiveDate === todayKey
        ? Math.max(Number(raw.todayInteractions || 0), Number(dailyCounts[todayKey] || 0))
        : 0;
    const todayInteractions = Math.max(1, prevTodayCount + 1);
    dailyCounts[todayKey] = todayInteractions;

    const prevRealCount =
      raw.lastActiveDate === todayKey ? Math.max(0, Number(raw.todayRealInteractions || 0)) : 0;
    const todayRealInteractions = prevRealCount + 1;

    const dailyGoal =
      typeof raw.dailyGoal === 'number' && [1, 3, 5, 10].includes(raw.dailyGoal)
        ? raw.dailyGoal
        : 3;

    const claimedMilestones = Array.isArray(raw.claimedMilestones)
      ? Array.from(new Set(raw.claimedMilestones.map(Number).filter((n) => n > 0))).sort(
          (a, b) => a - b
        )
      : [];
    const claimedBadges = Array.isArray(raw.claimedBadges)
      ? Array.from(new Set(raw.claimedBadges.map(String).filter(Boolean)))
      : [];
    const notifiedMilestonesSet = new Set<number>(
      Array.isArray(raw.notifiedMilestones)
        ? raw.notifiedMilestones.map(Number).filter((n) => n > 0)
        : []
    );
    const notifiedBadgesSet = new Set<string>(
      Array.isArray(raw.notifiedBadges) ? raw.notifiedBadges.map(String).filter(Boolean) : []
    );
    const exploredModels = Array.isArray(raw.exploredModels)
      ? Array.from(new Set(raw.exploredModels.map(String).filter(Boolean)))
      : ['deepseek-v4.1-flash-free'];
    const featuredBadgeId =
      typeof raw.featuredBadgeId === 'string' && raw.featuredBadgeId
        ? raw.featuredBadgeId
        : 'first-spark';

    const reminderEnabled = typeof raw.reminderEnabled === 'boolean' ? raw.reminderEnabled : true;
    const reminderTime =
      typeof raw.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(raw.reminderTime)
        ? raw.reminderTime
        : '18:00';

    const updated: DailyStreakData = {
      currentStreak: computed.currentStreak,
      longestStreak: computed.longestStreak,
      lastActiveDate: todayKey,
      activeDates: sortedDates,
      todayInteractions,
      todayRealInteractions,
      dailyCounts,
      dailyGoal,
      streakFreezes: computed.streakFreezes,
      maxStreakFreezes: 3,
      frozenDates: computed.frozenDates,
      claimedMilestones,
      claimedBadges,
      notifiedMilestones: Array.from(notifiedMilestonesSet).sort((a, b) => a - b),
      notifiedBadges: Array.from(notifiedBadgesSet),
      exploredModels,
      featuredBadgeId,
      totalActiveDays: sortedDates.length,
      lastFreezeEarnedDate: raw.lastFreezeEarnedDate,
      reminderEnabled,
      reminderTime,
      browserNotificationsEnabled: Boolean(raw.browserNotificationsEnabled),
      lastReminderDismissedDate: raw.lastReminderDismissedDate,
    };

    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);

    // Check if any streak milestones or badges were newly unlocked during this interaction
    this.checkAndDispatchNewAchievements(updated);

    if (emit) {
      this.emitChange();
    }
    return updated;
  },

  recordModelExplored(modelId: string): DailyStreakData {
    if (!modelId) return this.getDailyStreak();
    const current = this.getDailyStreak();
    const existing = Array.isArray(current.exploredModels) ? current.exploredModels : [];
    if (existing.includes(modelId)) return current;
    const updated: DailyStreakData = {
      ...current,
      exploredModels: [...existing, modelId],
    };
    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);
    this.checkAndDispatchNewAchievements(updated);
    this.emitChange();
    return updated;
  },

  getEvaluatedBadges(
    threads?: Array<{ createdAt?: number; messages?: Array<{ timestamp?: number; modelUsed?: string }> }>
  ): EvaluatedBadge[] {
    const effectiveThreads =
      Array.isArray(threads) && threads.length > 0 ? threads : this.getStoredThreadsFallback();
    const streak = this.getDailyStreak(effectiveThreads);
    const usage = this.getUsage();
    const bookmarks = this.getBookmarks();
    const citations = this.getCitations();
    const maxStreakReached = Math.max(streak.currentStreak, streak.longestStreak, 1);

    const totalDailyInteractions = Object.values(streak.dailyCounts || {}).reduce(
      (sum, c) => sum + Math.max(0, Number(c || 0)),
      0
    );
    const maxSingleDayInteractions = Math.max(
      streak.todayInteractions || 1,
      ...Object.values(streak.dailyCounts || {}).map((c) => Number(c || 0)),
      1
    );
    const totalInteractions = Math.max(
      totalDailyInteractions,
      Number(usage.messagesUsed || 0),
      streak.todayInteractions || 1
    );

    const modelSet = new Set<string>(streak.exploredModels || ['deepseek-v4.1-flash-free']);
    if (Array.isArray(effectiveThreads)) {
      for (const t of effectiveThreads) {
        if (Array.isArray(t.messages)) {
          for (const m of t.messages) {
            if (m?.modelUsed) modelSet.add(String(m.modelUsed));
          }
        }
      }
    }
    const uniqueModelsCount = Math.max(1, modelSet.size);
    const researchRunsCount =
      Math.max(0, Number(usage.searchesUsed || 0)) +
      Math.max(0, Number(usage.deepResearchUsed || 0));
    const studySessionsCount = Math.max(0, Number(usage.pdfStudyUsed || 0));
    const curationAndShieldScore = Math.max(
      Number(streak.streakFreezes || 0),
      bookmarks.length + citations.length
    );

    const claimedSet = new Set<string>(streak.claimedBadges || []);
    const featuredId = streak.featuredBadgeId || 'first-spark';

    return ACHIEVEMENT_BADGES.map((b) => {
      let currentValue = 0;
      switch (b.id) {
        case 'first-spark':
          currentValue = Math.max(1, streak.totalActiveDays);
          break;
        case 'streak-3':
        case 'streak-7':
        case 'streak-14':
        case 'streak-30':
        case 'streak-100':
          currentValue = maxStreakReached;
          break;
        case 'daily-goal-crusher':
          currentValue = maxSingleDayInteractions;
          break;
        case 'prompt-initiate':
        case 'prompt-centurion':
          currentValue = totalInteractions;
          break;
        case 'model-polymath':
          currentValue = uniqueModelsCount;
          break;
        case 'deep-investigator':
          currentValue = researchRunsCount;
          break;
        case 'study-architect':
          currentValue = studySessionsCount;
          break;
        case 'shield-guardian':
          currentValue = curationAndShieldScore;
          break;
        default:
          currentValue = 1;
      }

      const isClaimed = claimedSet.has(b.id);
      const isUnlocked = isClaimed || currentValue >= b.targetValue;
      const progressPct = isUnlocked
        ? 100
        : Math.min(100, Math.round((currentValue / b.targetValue) * 100));

      return {
        ...b,
        currentValue: isUnlocked
          ? Math.max(currentValue, b.targetValue)
          : Math.min(currentValue, b.targetValue * 10),
        progressPct,
        isUnlocked,
        isClaimed,
        isFeatured: featuredId === b.id,
      };
    });
  },

  claimBadgeReward(
    badgeId: string,
    _allowPreviewGrant = true
  ): {
    streak: DailyStreakData;
    rewarded: boolean;
    badge?: AchievementBadge;
  } {
    const raw = loadFromStorage<Partial<DailyStreakData>>(STORAGE_KEYS.DAILY_STREAK, {});
    const current = this.getDailyStreak();
    const target = ACHIEVEMENT_BADGES.find((b) => b.id === badgeId);
    if (this.isGuest()) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kinich-open-auth', {
            detail: { reason: 'Sign in to claim your streak bonus' },
          })
        );
      }
      return { streak: current, rewarded: false, badge: target };
    }
    const alreadyClaimed =
      (Array.isArray(raw.claimedBadges) && raw.claimedBadges.includes(badgeId)) ||
      (Array.isArray(current.claimedBadges) && current.claimedBadges.includes(badgeId));

    if (!target || alreadyClaimed) {
      return { streak: current, rewarded: false, badge: target };
    }

    const updatedClaimed = Array.from(
      new Set([...(current.claimedBadges || []), badgeId])
    );
    const updatedFreezes = Math.min(
      current.maxStreakFreezes,
      current.streakFreezes + (target.bonusShields || 0)
    );
    const updated: DailyStreakData = {
      ...current,
      claimedBadges: updatedClaimed,
      streakFreezes: updatedFreezes,
      featuredBadgeId: current.featuredBadgeId || badgeId,
    };

    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);
    this.grantReferrerBonusQuota(target.bonusUploads, target.bonusMessages, 5, 5);
    this.emitChange();
    this.syncProfileAndSettingsWithBackend({ streak: updated }).catch(() => {});
    return { streak: updated, rewarded: true, badge: target };
  },

  setFeaturedBadge(badgeId: string): DailyStreakData {
    const current = this.getDailyStreak();
    const updated: DailyStreakData = {
      ...current,
      featuredBadgeId: badgeId,
    };
    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);
    this.emitChange();
    this.syncProfileAndSettingsWithBackend({ streak: updated }).catch(() => {});
    return updated;
  },

  setDailyStreakGoal(goal: number): DailyStreakData {
    const validGoal = [1, 3, 5, 10].includes(goal) ? goal : 3;
    const current = this.getDailyStreak();
    const updated: DailyStreakData = {
      ...current,
      dailyGoal: validGoal,
    };
    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);
    this.emitChange();
    return updated;
  },

  updateStreakReminderSettings(settings: {
    reminderEnabled?: boolean;
    reminderTime?: string;
    browserNotificationsEnabled?: boolean;
  }): DailyStreakData {
    const current = this.getDailyStreak();
    const updated: DailyStreakData = {
      ...current,
      reminderEnabled:
        typeof settings.reminderEnabled === 'boolean'
          ? settings.reminderEnabled
          : current.reminderEnabled,
      reminderTime:
        typeof settings.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(settings.reminderTime)
          ? settings.reminderTime
          : current.reminderTime || '18:00',
      browserNotificationsEnabled:
        typeof settings.browserNotificationsEnabled === 'boolean'
          ? settings.browserNotificationsEnabled
          : Boolean(current.browserNotificationsEnabled),
    };
    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);
    this.emitChange();
    this.syncProfileAndSettingsWithBackend({ streakReminder: updated }).catch(() => {});
    return updated;
  },

  dismissStreakReminderForToday(): DailyStreakData {
    const todayKey = toLocalDateKey();
    const current = this.getDailyStreak();
    const updated: DailyStreakData = {
      ...current,
      lastReminderDismissedDate: todayKey,
    };
    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);
    this.emitChange();
    return updated;
  },

  shouldShowStreakReminder(now = new Date()): boolean {
    const streak = this.getDailyStreak();
    if (!streak.reminderEnabled) return false;
    const todayKey = toLocalDateKey(now.getTime());
    if (streak.lastReminderDismissedDate === todayKey) return false;

    // If user has already completed their daily interaction today (either explicit interaction or met daily goal), no reminder needed
    if ((streak.todayRealInteractions || 0) >= 1 && streak.todayInteractions >= streak.dailyGoal) {
      return false;
    }

    const [targetHour, targetMin] = (streak.reminderTime || '18:00')
      .split(':')
      .map((n) => parseInt(n, 10) || 0);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = targetHour * 60 + targetMin;

    return currentMinutes >= targetMinutes;
  },

  async syncProfileAndSettingsWithBackend(extraPayload?: Record<string, any>): Promise<any> {
    if (this.isGuest()) return null;
    try {
      const headers = await getAuthHeaders();
      const profile = this.getProfile();
      const streak = this.getDailyStreak();
      const personalization = this.getPersonalization();
      const privacy = this.getPrivacy();
      const res = await fetch('/api/user/profile-backend', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          profile,
          streak: {
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            dailyGoal: streak.dailyGoal,
            reminderEnabled: streak.reminderEnabled,
            reminderTime: streak.reminderTime,
            browserNotificationsEnabled: streak.browserNotificationsEnabled,
          },
          personalization,
          privacy,
          ...(extraPayload || {}),
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  },

  buildMilestoneAchievementPayload(
    days: number,
    isPreview = false
  ): AchievementUnlockPayload | null {
    const milestone = STREAK_MILESTONES.find((m) => m.days === days);
    if (!milestone) return null;
    const streak = this.getDailyStreak();
    const maxReached = Math.max(streak.currentStreak, streak.longestStreak, 1);
    const isClaimed = streak.claimedMilestones.includes(milestone.days);
    const isUnlocked = maxReached >= milestone.days;

    const tier: AchievementUnlockPayload['tier'] =
      milestone.days >= 30
        ? 'obsidian'
        : milestone.days >= 7
        ? 'gold'
        : milestone.days >= 3
        ? 'silver'
        : 'bronze';

    const iconName: AchievementBadge['iconName'] =
      milestone.days >= 30 ? 'trophy' : milestone.days >= 7 ? 'flame' : 'zap';

    const correspondingBadge = ACHIEVEMENT_BADGES.find(
      (b) => b.category === 'streak' && b.targetValue === milestone.days && b.unitLabel === 'days'
    );

    return {
      id: `milestone-${milestone.days}`,
      kind: 'milestone',
      days: milestone.days,
      badgeId: correspondingBadge?.id,
      title: milestone.title,
      subtitle: milestone.subtitle,
      kickerLabel: `${milestone.days}-DAY STREAK MILESTONE`,
      tier,
      iconName,
      bonusMessages: milestone.bonusMessages,
      bonusUploads: milestone.bonusUploads,
      bonusShields: milestone.bonusShields,
      isClaimed,
      isUnlocked,
      isPreview,
      unlockedAt: Date.now(),
    };
  },

  buildBadgeAchievementPayload(
    badgeId: string,
    isPreview = false
  ): AchievementUnlockPayload | null {
    const evaluated = this.getEvaluatedBadges();
    const badge = evaluated.find((b) => b.id === badgeId);
    if (!badge) return null;
    return {
      id: `badge-${badge.id}`,
      kind: 'badge',
      badgeId: badge.id,
      days: badge.category === 'streak' && badge.unitLabel === 'days' ? badge.targetValue : undefined,
      title: badge.title,
      subtitle: badge.subtitle,
      kickerLabel:
        badge.category === 'streak' && badge.unitLabel === 'days'
          ? `${badge.targetValue}-DAY STREAK BADGE`
          : `${badge.tier.toUpperCase()} BADGE UNLOCKED`,
      tier: badge.tier,
      iconName: badge.iconName,
      bonusMessages: badge.bonusMessages,
      bonusUploads: badge.bonusUploads,
      bonusShields: badge.bonusShields,
      isClaimed: badge.isClaimed,
      isUnlocked: badge.isUnlocked,
      isPreview,
      unlockedAt: Date.now(),
    };
  },

  triggerMilestoneToastPreview(days: number): AchievementUnlockPayload | null {
    const payload = this.buildMilestoneAchievementPayload(days, true);
    if (payload && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kinich-achievement-unlocked', { detail: payload }));
    }
    return payload;
  },

  triggerBadgeToastPreview(badgeId: string): AchievementUnlockPayload | null {
    const payload = this.buildBadgeAchievementPayload(badgeId, true);
    if (payload && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kinich-achievement-unlocked', { detail: payload }));
    }
    return payload;
  },

  checkAndDispatchNewAchievements(streakSnapshot?: DailyStreakData): void {
    if (typeof window === 'undefined') return;
    const current = streakSnapshot || this.getDailyStreak();
    const maxReached = Math.max(current.currentStreak, current.longestStreak, 1);
    const notifiedMilestones = new Set<number>(current.notifiedMilestones || []);
    const notifiedBadges = new Set<string>(current.notifiedBadges || []);
    let mutated = false;
    const payloadsToEmit: AchievementUnlockPayload[] = [];

    // 1. Check Streak Milestones (1d, 3d, 7d, 14d, 30d, 60d, 100d)
    for (const m of STREAK_MILESTONES) {
      if (maxReached >= m.days && !notifiedMilestones.has(m.days)) {
        notifiedMilestones.add(m.days);
        mutated = true;
        // Also mark corresponding streak day badge as notified so we don't double-toast the exact same day milestone
        const matchingStreakBadge = ACHIEVEMENT_BADGES.find(
          (b) => b.category === 'streak' && b.targetValue === m.days && b.unitLabel === 'days'
        );
        if (matchingStreakBadge) {
          notifiedBadges.add(matchingStreakBadge.id);
        }
        const p = this.buildMilestoneAchievementPayload(m.days, false);
        if (p) payloadsToEmit.push(p);
      }
    }

    // 2. Check non-day-duplicate Achievement Badges (Daily Goal Crusher, Mastery, Exploration, Curation)
    const evaluated = this.getEvaluatedBadges();
    for (const b of evaluated) {
      if (b.isUnlocked && !notifiedBadges.has(b.id)) {
        notifiedBadges.add(b.id);
        mutated = true;
        const p = this.buildBadgeAchievementPayload(b.id, false);
        if (p) payloadsToEmit.push(p);
      }
    }

    if (mutated) {
      const nextState: DailyStreakData = {
        ...current,
        notifiedMilestones: Array.from(notifiedMilestones).sort((a, b) => a - b),
        notifiedBadges: Array.from(notifiedBadges),
      };
      saveToStorage(STORAGE_KEYS.DAILY_STREAK, nextState);
    }

    for (const payload of payloadsToEmit) {
      window.dispatchEvent(new CustomEvent('kinich-achievement-unlocked', { detail: payload }));
    }
  },

  claimStreakMilestone(
    milestoneDays: number,
    _allowPreviewGrant = true
  ): {
    streak: DailyStreakData;
    rewarded: boolean;
    milestone?: StreakMilestone;
  } {
    const raw = loadFromStorage<Partial<DailyStreakData>>(STORAGE_KEYS.DAILY_STREAK, {});
    const current = this.getDailyStreak();
    const milestone = STREAK_MILESTONES.find((m) => m.days === milestoneDays);
    if (this.isGuest()) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('kinich-open-auth', {
            detail: { reason: 'Sign in to claim your streak bonus' },
          })
        );
      }
      return { streak: current, rewarded: false, milestone };
    }
    const alreadyClaimed =
      (Array.isArray(raw.claimedMilestones) && raw.claimedMilestones.includes(milestoneDays)) ||
      current.claimedMilestones.includes(milestoneDays);

    if (!milestone || alreadyClaimed) {
      return { streak: current, rewarded: false, milestone };
    }

    const updatedClaimed = Array.from(
      new Set([...current.claimedMilestones, milestone.days])
    ).sort((a, b) => a - b);

    const updatedFreezes = Math.min(
      current.maxStreakFreezes,
      current.streakFreezes + (milestone.bonusShields || 0)
    );

    const matchingBadge = ACHIEVEMENT_BADGES.find(
      (b) => b.category === 'streak' && b.targetValue === milestone.days && b.unitLabel === 'days'
    );
    const updatedClaimedBadges = matchingBadge
      ? Array.from(new Set([...(current.claimedBadges || []), matchingBadge.id]))
      : current.claimedBadges || [];

    const updated: DailyStreakData = {
      ...current,
      claimedMilestones: updatedClaimed,
      claimedBadges: updatedClaimedBadges,
      streakFreezes: updatedFreezes,
      featuredBadgeId: matchingBadge ? matchingBadge.id : current.featuredBadgeId,
    };

    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);
    this.grantReferrerBonusQuota(milestone.bonusUploads, milestone.bonusMessages, 10, 5);
    this.emitChange();
    return { streak: updated, rewarded: true, milestone };
  },

  refillStreakFreeze(): { streak: DailyStreakData; refilled: boolean } {
    const todayKey = toLocalDateKey();
    const current = this.getDailyStreak();
    if (
      current.streakFreezes >= current.maxStreakFreezes ||
      current.todayInteractions < current.dailyGoal ||
      current.lastFreezeEarnedDate === todayKey
    ) {
      return { streak: current, refilled: false };
    }

    const updated: DailyStreakData = {
      ...current,
      streakFreezes: Math.min(current.maxStreakFreezes, current.streakFreezes + 1),
      lastFreezeEarnedDate: todayKey,
    };
    saveToStorage(STORAGE_KEYS.DAILY_STREAK, updated);
    this.emitChange();
    return { streak: updated, refilled: true };
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
      dailyStreak: this.getDailyStreak(),
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
      window.dispatchEvent(new Event('kinich-account-updated'));
    }
  },
};
