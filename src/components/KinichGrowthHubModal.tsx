import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  RefreshCw,
  ExternalLink,
  GitBranch,
  Star,
  BookOpen,
  FileText,
  Sparkles,
  Bookmark,
  Check,
  Code2,
  FolderOpen,
  Link2,
  Clock,
  Bot,
  Lock,
  MessageSquare,
  Share2,
  Trash2,
  Play,
  ArrowBigUp,
  ArrowBigDown,
  ChevronDown,
  ChevronUp,
  Layers,
  Compass,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  DiscoverCategory,
  PublicArtifact,
  KnowledgeVaultItem,
  KnowledgeCollection,
  KinichReferralStatus,
  CreatorPublicProfile,
  KinichNotificationPreferences,
  EliteReferrerLeaderboardEntry,
  TopContributorEntry,
  KinichFeedbackCategory,
  KinichFeedbackSubmission,
  VaultThread,
  VaultThreadComment,
  VaultKeyPoint,
} from '../types';
import {
  DISCOVER_CATEGORIES,
  fetchDiscoverArtifacts,
  KnowledgeVaultStore,
  VaultThreadStore,
  formatToIstDate,
  AgentMemoryStore,
  VAULT_FREE_ITEM_LIMIT,
  computeWeeklyIntelligenceReport,
  evaluateMissionsAndLevel,
  fetchMyReferralStatus,
  fetchCreatorPublicProfile,
  saveCreatorPublicProfile,
  getNotificationPreferences,
  saveNotificationPreferences,
  trackGrowthEvent,
  recordArtifactInteraction,
  getUnlockedCosmeticThemes,
  fetchGrowthLeaderboards,
  claimReferralCodeManual,
  submitKinichFeedback,
  fetchMySubmittedFeedback,
  getLocalReferralTracker,
  getClaimedReferrerBonuses,
  claimTopReferrerBonus,
  incrementLocalReferralCountForUser,
  LocalUserReferralRecord,
  REFERRAL_8_REWARD_TIERS,
  getEightReferralTrackerState,
  addOneReferralProgress,
  claimEightReferralTier,
  EightReferralTrackerState,
} from '../lib/growthStore';
import {
  renderWeeklyReportCardToCanvas,
  downloadWeeklyReportCardPng,
  ShareCardTheme,
} from '../lib/exportChat';
import { ChatThread } from './Sidebar';
import { auth } from '../lib/firebase';
import { UserAccountStore } from '../lib/userAccountStore';
import { fetchUserReferralDashboard, ReferralDashboardResponse } from '../lib/referralClient';

export type GrowthHubTab = 'discover' | 'vault' | 'weekly' | 'passes' | 'feedback';

export interface KinichGrowthHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: GrowthHubTab;
  threads: ChatThread[];
  onOpenArtifactPage: (artifact: PublicArtifact) => void;
  onForkArtifactIntoChat: (artifact: PublicArtifact) => void;
  onContinueVaultItemInChat: (item: KnowledgeVaultItem) => void;
  isDark?: boolean;
}

function normalizeLatexDelimiters(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n$$\n${inner.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$$${inner.trim()}$$`);
}

function extractYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

function parseTimestampToSeconds(ts?: string): number {
  if (!ts) return 0;
  const cleaned = ts.replace(/[[\]]/g, '').trim();
  const parts = cleaned.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

interface LiveDiscoverConnectedRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  ownerAvatar?: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  topics?: string[];
  updatedAt?: string;
  license?: string | null;
}

interface LiveDiscoverArxivPaper {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated?: string;
  pdfUrl: string;
  absUrl: string;
  primaryCategory: string;
  categories?: string[];
  connectedRepos?: LiveDiscoverConnectedRepo[];
}

export const KinichGrowthHubModal: React.FC<KinichGrowthHubModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'discover',
  threads,
  onOpenArtifactPage,
  onForkArtifactIntoChat,
  onContinueVaultItemInChat,
  isDark = true,
}) => {
  const [activeTab, setActiveTab] = useState<GrowthHubTab>(
    initialTab === 'weekly' ? 'discover' : initialTab
  );

  // --- TAB 1: DISCOVER STATE ---
  const [discoverItems, setDiscoverItems] = useState<PublicArtifact[]>([]);
  const [discoverTotal, setDiscoverTotal] = useState<number>(0);
  const [discoverLoading, setDiscoverLoading] = useState<boolean>(false);
  const [discoverCategory, setDiscoverCategory] = useState<DiscoverCategory | 'All'>('All');
  const [discoverQuery, setDiscoverQuery] = useState<string>('');
  const [discoverSort, setDiscoverSort] = useState<'recent' | 'saved' | 'views'>('recent');
  const [discoverSourceFilter, setDiscoverSourceFilter] = useState<
    'all' | 'arxiv' | 'github' | 'community'
  >('all');
  const [liveArxivPapers, setLiveArxivPapers] = useState<LiveDiscoverArxivPaper[]>([]);
  const [liveGithubRepos, setLiveGithubRepos] = useState<LiveDiscoverConnectedRepo[]>([]);
  const [liveFeedLoading, setLiveFeedLoading] = useState<boolean>(false);
  const [liveRefreshTick, setLiveRefreshTick] = useState<number>(0);
  const [savedLiveIds, setSavedLiveIds] = useState<Record<string, boolean>>({});

  // --- TAB 2: KNOWLEDGE VAULT STATE ---
  const [vaultItems, setVaultItems] = useState<KnowledgeVaultItem[]>(() =>
    KnowledgeVaultStore.getItems()
  );
  const [collections, setCollections] = useState<KnowledgeCollection[]>(() =>
    KnowledgeVaultStore.getCollections()
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [vaultSearch, setVaultSearch] = useState<string>('');
  const [activeVaultItem, setActiveVaultItem] = useState<KnowledgeVaultItem | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newNoteTags, setNewNoteTags] = useState<string>('notes, study');
  const [newCollectionName, setNewCollectionName] = useState<string>('');
  const [showNewCollectionInput, setShowNewCollectionInput] = useState<boolean>(false);

  // --- REDDIT-STYLE VAULT THREADS STATE ---
  const [vaultThreads, setVaultThreads] = useState<VaultThread[]>(() =>
    VaultThreadStore.getThreads()
  );
  const [activeThread, setActiveThread] = useState<VaultThread | null>(null);
  const [vaultViewMode, setVaultViewMode] = useState<'threads' | 'tree'>('threads');
  const [threadSort, setThreadSort] = useState<'new' | 'top' | 'due'>('new');
  const [threadTypeFilter, setThreadTypeFilter] = useState<
    'all' | 'youtube' | 'web_link' | 'pdf' | 'image' | 'text'
  >('all');
  const [threadCommentInput, setThreadCommentInput] = useState<string>('');
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [replyTextInput, setReplyTextInput] = useState<string>('');
  const [collapsedComments, setCollapsedComments] = useState<Record<string, boolean>>({});
  const [copiedShareNotice, setCopiedShareNotice] = useState<string | null>(null);
  const [activeVideoTimeSec, setActiveVideoTimeSec] = useState<number>(0);

  // --- TAB 3: WEEKLY BRIEF, MISSIONS & NOTIFICATIONS ---
  const [includeTopicsOnWeeklyCard, setIncludeTopicsOnWeeklyCard] = useState<boolean>(false);
  const [weeklyCardTheme] = useState<ShareCardTheme>('carbon');
  const weeklyCanvasRef = useRef<HTMLCanvasElement>(null);
  const [notifPrefs, setNotifPrefs] = useState<KinichNotificationPreferences>(() =>
    getNotificationPreferences()
  );
  const [hideMissionsPanel, setHideMissionsPanel] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kinich_hide_missions_v1') === 'true';
    } catch {
      return false;
    }
  });

  // --- TAB 4: ZENO PASSES (REFERRALS) & CREATOR PROFILE ---
  const [referralStatus, setReferralStatus] = useState<KinichReferralStatus | null>(null);
  const [dashboardData, setDashboardData] = useState<ReferralDashboardResponse | null>(null);
  const [copiedRefLink, setCopiedRefLink] = useState<boolean>(false);
  const [creatorProfile, setCreatorProfile] = useState<CreatorPublicProfile>(() => {
    const p = UserAccountStore.getProfile();
    return {
      uid: auth.currentUser?.uid || 'local',
      displayName: p.displayName || 'Kinich Researcher',
      username: p.username || 'kinich_researcher',
      bio: p.bio || '',
      avatarUrl: p.avatar || '',
      isPublic: false,
      featuredArtifactIds: [],
      specialtyTags: ['research', 'ai'],
      publishedCount: 0,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    };
  });
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileSavedToast, setProfileSavedToast] = useState<boolean>(false);

  // --- ELITE REFERRER LEADERBOARD & TOP CONTRIBUTORS STATE ---
  const [eliteReferrers, setEliteReferrers] = useState<EliteReferrerLeaderboardEntry[]>([]);
  const [topContributors, setTopContributors] = useState<TopContributorEntry[]>([]);
  const [myReferralRank, setMyReferralRank] = useState<EliteReferrerLeaderboardEntry | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState<boolean>(false);
  const [claimPassInput, setClaimPassInput] = useState<string>('');
  const [claimingPass, setClaimingPass] = useState<boolean>(false);
  const [claimPassFeedback, setClaimPassFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [localReferralTracker, setLocalReferralTracker] = useState<
    Record<string, LocalUserReferralRecord>
  >(() => getLocalReferralTracker());
  const [claimedBonusesMap, setClaimedBonusesMap] = useState<
    Record<string, { claimedAt: number; rewardLabel: string; referredCountAtClaim: number }>
  >(() => getClaimedReferrerBonuses());
  const [bonusClaimNotice, setBonusClaimNotice] = useState<string | null>(null);
  const [eightRefState, setEightRefState] = useState<EightReferralTrackerState>(() =>
    getEightReferralTrackerState()
  );

  // --- TAB 5: FEEDBACK & SUGGESTIONS STATE ---
  const [feedbackCategory, setFeedbackCategory] = useState<KinichFeedbackCategory>('feature');
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackSubject, setFeedbackSubject] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackIncludeDiag, setFeedbackIncludeDiag] = useState<boolean>(true);
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [myFeedbackHistory, setMyFeedbackHistory] = useState<KinichFeedbackSubmission[]>([]);

  const [vaultTypeFilter, setVaultTypeFilter] = useState<
    'all' | 'lecture' | 'note' | 'quiz' | 'flashcard_deck' | 'research_report' | 'chat_answer'
  >('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [sageMemoryFacts, setSageMemoryFacts] = useState<string[]>(() =>
    AgentMemoryStore.getFacts('sage')
  );
  const [newMemoryFactInput, setNewMemoryFactInput] = useState<string>('');
  const [isGuestVault, setIsGuestVault] = useState<boolean>(() => UserAccountStore.isGuest());
  const [currentUserTier, setCurrentUserTier] = useState<'free' | 'spark' | 'fire'>(() =>
    UserAccountStore.getCurrentPlan()
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab === 'weekly' ? 'discover' : initialTab);
      setVaultItems(KnowledgeVaultStore.getItems());
      setVaultThreads(VaultThreadStore.getThreads());
      setCollections(KnowledgeVaultStore.getCollections());
      setSageMemoryFacts(AgentMemoryStore.getFacts('sage'));
      setIsGuestVault(UserAccountStore.isGuest());
      setCurrentUserTier(UserAccountStore.getCurrentPlan());
      if (!UserAccountStore.isGuest()) {
        KnowledgeVaultStore.syncFromCloud().then((synced) => {
          setVaultItems(synced);
        });
        VaultThreadStore.syncWithFirestore().then((synced) => {
          if (Array.isArray(synced)) setVaultThreads(synced);
        });
        AgentMemoryStore.syncFromFirestore('sage').then((facts) => {
          setSageMemoryFacts(facts);
        });
      }
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const syncVault = () => {
      setVaultItems(KnowledgeVaultStore.getItems());
      setVaultThreads(VaultThreadStore.getThreads());
      setCollections(KnowledgeVaultStore.getCollections());
      setSageMemoryFacts(AgentMemoryStore.getFacts('sage'));
      setIsGuestVault(UserAccountStore.isGuest());
      setCurrentUserTier(UserAccountStore.getCurrentPlan());
    };
    window.addEventListener('kinich-vault-updated', syncVault);
    window.addEventListener('kinich-account-updated', syncVault);
    return () => {
      window.removeEventListener('kinich-vault-updated', syncVault);
      window.removeEventListener('kinich-account-updated', syncVault);
    };
  }, []);

  // Load Discover items + Live arXiv & Connected GitHub feed when Discover tab or filters change
  useEffect(() => {
    if (!isOpen || activeTab !== 'discover') return;
    let cancelled = false;
    setDiscoverLoading(true);
    setLiveFeedLoading(true);

    fetchDiscoverArtifacts({
      category: discoverCategory,
      q: discoverQuery,
      sort: discoverSort,
      limit: 24,
    })
      .then((res) => {
        if (cancelled) return;
        setDiscoverItems(res.items);
        setDiscoverTotal(res.total);
      })
      .finally(() => {
        if (!cancelled) setDiscoverLoading(false);
      });

    fetch(
      `/api/discover/live?category=${encodeURIComponent(discoverCategory)}&q=${encodeURIComponent(
        discoverQuery
      )}&refresh=${liveRefreshTick}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.arxivPapers)) {
          setLiveArxivPapers(data.arxivPapers);
        }
        if (Array.isArray(data.githubRepos)) {
          setLiveGithubRepos(data.githubRepos);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLiveFeedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, discoverCategory, discoverQuery, discoverSort, liveRefreshTick]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'passes') return;
    setEightRefState(getEightReferralTrackerState());
    fetchMyReferralStatus().then((st) => {
      if (st) {
        setReferralStatus(st);
        setEightRefState(getEightReferralTrackerState());
      }
    });
    fetchUserReferralDashboard().then((dash) => {
      if (dash && dash.success) {
        setDashboardData(dash);
      }
    }).catch(() => {});
  }, [isOpen, activeTab]);

  const handleClaimReferrerBonus = (entry: EliteReferrerLeaderboardEntry) => {
    const trackedCount =
      localReferralTracker[entry.uid]?.referredCount ?? entry.claimedReferrals;
    const res = claimTopReferrerBonus({
      uid: entry.uid,
      displayName: entry.displayName,
      username: entry.username,
      referralCode: entry.referralCode,
      claimedReferrals: trackedCount,
      rank: entry.rank,
      tier: entry.tier,
    });
    setLocalReferralTracker(getLocalReferralTracker());
    setClaimedBonusesMap(getClaimedReferrerBonuses());
    setBonusClaimNotice(res.message);
    fetchMyReferralStatus().then((st) => {
      if (st) setReferralStatus(st);
    });
    setTimeout(() => setBonusClaimNotice(null), 5000);
  };

  const handleIncrementLocalReferral = (entry?: EliteReferrerLeaderboardEntry | null) => {
    const targetUid = entry?.uid || myReferralRank?.uid || referralStatus?.referrerUid;
    const targetCode = entry?.referralCode || myReferralRank?.referralCode || referralStatus?.code;
    const targetName =
      entry?.displayName || myReferralRank?.displayName || creatorProfile.displayName;
    const targetUser = entry?.username || myReferralRank?.username || creatorProfile.username;

    incrementLocalReferralCountForUser({
      uid: targetUid,
      referralCode: targetCode,
      displayName: targetName,
      username: targetUser,
      delta: 1,
    });
    fetchGrowthLeaderboards().then((lb) => {
      setEliteReferrers(lb.eliteReferrers);
      setTopContributors(lb.topContributors);
      setMyReferralRank(lb.myRank);
      setLocalReferralTracker(getLocalReferralTracker());
    });
    fetchMyReferralStatus().then((st) => {
      if (st) setReferralStatus(st);
    });
  };

  // Load Feedback History when Feedback tab opens
  useEffect(() => {
    if (!isOpen || activeTab !== 'feedback') return;
    fetchMySubmittedFeedback().then((items) => {
      setMyFeedbackHistory(items);
    });
  }, [isOpen, activeTab]);

  const weeklyReport = useMemo(
    () => computeWeeklyIntelligenceReport(threads, vaultItems),
    [threads, vaultItems]
  );

  const { missions, level } = useMemo(
    () => evaluateMissionsAndLevel(threads, vaultItems),
    [threads, vaultItems]
  );

  const unlockedThemes = useMemo(() => getUnlockedCosmeticThemes(), [referralStatus, isOpen]);

  // Track Weekly Report view only when tab opens
  useEffect(() => {
    if (!isOpen || activeTab !== 'weekly') return;
    trackGrowthEvent('weekly_report_viewed');
  }, [isOpen, activeTab]);

  // Render Weekly Report Canvas when Weekly tab is active
  useEffect(() => {
    if (!isOpen || activeTab !== 'weekly') return;
    if (weeklyCanvasRef.current) {
      renderWeeklyReportCardToCanvas(weeklyCanvasRef.current, {
        periodLabel: weeklyReport.periodLabel,
        conversationsCount: weeklyReport.conversationsCount,
        researchSessionsCount: weeklyReport.researchSessionsCount,
        savedVaultItemsCount: weeklyReport.savedVaultItemsCount,
        studyGuidesCount: weeklyReport.studyGuidesCount,
        publishedArtifactsCount: weeklyReport.publishedArtifactsCount,
        activeDaysCount: weeklyReport.activeDaysCount,
        levelName: level.name,
        topTopics: weeklyReport.topTopics,
        includeTopics: includeTopicsOnWeeklyCard,
        theme: weeklyCardTheme,
      });
    }
  }, [isOpen, activeTab, weeklyReport, level.name, includeTopicsOnWeeklyCard, weeklyCardTheme]);

  const filteredVaultItems = useMemo(() => {
    let list = vaultItems;
    if (selectedCollectionId === 'pinned') {
      list = list.filter((i) => i.pinned);
    } else if (selectedCollectionId !== 'all') {
      list = list.filter((i) => i.collectionId === selectedCollectionId);
    }
    if (selectedSubject !== 'all') {
      list = list.filter(
        (i) => (i.subject || 'General Studies').toLowerCase() === selectedSubject.toLowerCase()
      );
    }
    if (vaultTypeFilter !== 'all') {
      list = list.filter((i) => {
        const t = i.type || i.sourceType || 'chat_answer';
        if (vaultTypeFilter === 'note') return t === 'note' || t === 'personal_note' || t === 'discover_resource';
        if (vaultTypeFilter === 'chat_answer') return t === 'chat_answer' || t === 'ai_response' || t === 'study_guide';
        return t === vaultTypeFilter;
      });
    }
    const q = vaultSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.subject || '').toLowerCase().includes(q) ||
          (i.chapter || '').toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.content.toLowerCase().includes(q) ||
          (i.sageNote || '').toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [vaultItems, selectedCollectionId, selectedSubject, vaultTypeFilter, vaultSearch]);

  const groupedVaultBySubjectAndChapter = useMemo(
    () => KnowledgeVaultStore.getGroupedBySubjectAndChapter(filteredVaultItems),
    [filteredVaultItems]
  );

  const allSubjectsWithCounts = useMemo(
    () => KnowledgeVaultStore.getGroupedBySubjectAndChapter(vaultItems),
    [vaultItems]
  );

  const filteredVaultThreads = useMemo(() => {
    let list = [...vaultThreads];
    if (threadTypeFilter !== 'all') {
      list = list.filter((t) => t.type === threadTypeFilter);
    }
    if (selectedSubject !== 'all') {
      list = list.filter(
        (t) => (t.subject || 'General Studies').toLowerCase() === selectedSubject.toLowerCase()
      );
    }
    const q = vaultSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.tldr || '').toLowerCase().includes(q) ||
          (t.subject || '').toLowerCase().includes(q) ||
          (t.chapter || '').toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
          (t.keyPoints || []).some((kp) => kp.text.toLowerCase().includes(q))
      );
    }
    if (threadSort === 'top') {
      list.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
    } else if (threadSort === 'due') {
      list.sort((a, b) => (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt));
    } else {
      list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
    }
    return list;
  }, [vaultThreads, threadTypeFilter, selectedSubject, vaultSearch, threadSort]);

  const handleVoteThread = (threadId: string, delta: 1 | -1) => {
    const updated = VaultThreadStore.voteThread(threadId, delta);
    if (updated) {
      setVaultThreads(VaultThreadStore.getThreads());
      if (activeThread && activeThread.id === threadId) {
        setActiveThread(updated);
      }
    }
  };

  const handleVoteComment = (threadId: string, commentId: string, delta: 1 | -1) => {
    const updated = VaultThreadStore.voteComment(threadId, commentId, delta);
    if (updated) {
      setVaultThreads(VaultThreadStore.getThreads());
      if (activeThread && activeThread.id === threadId) {
        const refreshed = VaultThreadStore.getThread(threadId);
        if (refreshed) setActiveThread(refreshed);
      }
    }
  };

  const handleVoteKeyPoint = (threadId: string, keyPointId: string, delta: 1 | -1) => {
    const thread = VaultThreadStore.getThread(threadId);
    if (!thread) return;
    const nextKp = (thread.keyPoints || []).map((kp) =>
      kp.id === keyPointId ? { ...kp, score: (kp.score || 0) + delta } : kp
    );
    const updated = VaultThreadStore.saveThread({ ...thread, keyPoints: nextKp });
    setVaultThreads(VaultThreadStore.getThreads());
    if (activeThread && activeThread.id === threadId) {
      setActiveThread(updated);
    }
  };

  const handleAddThreadComment = (parentId?: string) => {
    if (!activeThread) return;
    const text = (parentId ? replyTextInput : threadCommentInput).trim();
    if (!text) return;
    VaultThreadStore.addComment(activeThread.id, {
      author: 'user',
      text,
      parentId,
    });
    if (parentId) {
      setReplyingCommentId(null);
      setReplyTextInput('');
    } else {
      setThreadCommentInput('');
    }
    const refreshed = VaultThreadStore.getThread(activeThread.id);
    if (refreshed) {
      setActiveThread(refreshed);
      setVaultThreads(VaultThreadStore.getThreads());
    }
  };

  const handleForgetThread = (threadId: string) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Forget this study thread? It will be permanently removed from your Vault and wiped from agent memory.'
      )
    ) {
      return;
    }
    VaultThreadStore.forgetThread(threadId);
    setVaultThreads(VaultThreadStore.getThreads());
    if (activeThread && activeThread.id === threadId) {
      setActiveThread(null);
    }
  };

  const handleQuizMeOnThread = (thread: VaultThread) => {
    onContinueVaultItemInChat({
      id: `quiz-${thread.id}`,
      userId: auth.currentUser?.uid || 'user',
      title: `Quiz: ${thread.title}`,
      summary: thread.tldr || '',
      content: `Conduct an active recall quiz on this study thread:\n\nTitle: ${thread.title}\nTL;DR: ${thread.tldr}\nKey Points:\n${thread.keyPoints.map((k) => `- ${k.text} ${k.timestamp || ''}`).join('\n')}`,
      type: 'quiz',
      sourceType: 'quiz',
      collectionId: 'col_quizzes',
      subject: thread.subject,
      chapter: thread.chapter,
      tags: thread.tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastReviewedAt: Date.now(),
      isPinned: thread.pinned,
    });
    onClose();
  };

  const handleFlashcardsOnThread = (thread: VaultThread) => {
    onContinueVaultItemInChat({
      id: `flashcard-${thread.id}`,
      userId: auth.currentUser?.uid || 'user',
      title: `Flashcards: ${thread.title}`,
      summary: thread.tldr || '',
      content: `Generate spaced-repetition flashcards for:\n\nTitle: ${thread.title}\nTL;DR: ${thread.tldr}\nKey Points:\n${thread.keyPoints.map((k) => `- ${k.text} ${k.timestamp || ''}`).join('\n')}`,
      type: 'flashcard_deck',
      sourceType: 'flashcard_deck',
      collectionId: 'col_flashcards',
      subject: thread.subject,
      chapter: thread.chapter,
      tags: thread.tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastReviewedAt: Date.now(),
      isPinned: thread.pinned,
    });
    onClose();
  };

  const handleDeepResearchOnThread = (thread: VaultThread) => {
    onContinueVaultItemInChat({
      id: `research-${thread.id}`,
      userId: auth.currentUser?.uid || 'user',
      title: `Deep Research: ${thread.title}`,
      summary: thread.tldr || '',
      content: `Perform a Deep Research comprehensive synthesis on:\n\nTopic: ${thread.title}\nSource: ${thread.sourceUrl || ''}\nKey takeaways to build on:\n${thread.keyPoints.map((k) => `- ${k.text}`).join('\n')}`,
      type: 'research_report',
      sourceType: 'research_report',
      collectionId: 'col_research',
      subject: thread.subject,
      chapter: thread.chapter,
      tags: thread.tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastReviewedAt: Date.now(),
      isPinned: thread.pinned,
    });
    onClose();
  };

  const handleShareThread = (thread: VaultThread) => {
    const text = `📚 Kinich Study Thread: ${thread.title}\n` +
      `Subject: ${thread.subject} → ${thread.chapter}\n` +
      `TL;DR: ${thread.tldr}\n\n` +
      `Key Points:\n${thread.keyPoints.map((kp, idx) => `${idx + 1}. ${kp.text} ${kp.timestamp ? '(' + kp.timestamp + ')' : ''}`).join('\n')}\n\n` +
      `Saved: ${formatToIstDate(thread.createdAt)} (IST)\nkinich.app`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedShareNotice('Copied thread snapshot to clipboard!');
    setTimeout(() => setCopiedShareNotice(null), 3000);
  };

  if (!isOpen) return null;

  const handleCreateCustomNote = () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    if (UserAccountStore.isGuest()) {
      window.dispatchEvent(new CustomEvent('kinich-open-auth'));
      return;
    }
    const check = KnowledgeVaultStore.canSaveToVault();
    if (!check.allowed) {
      window.dispatchEvent(
        new CustomEvent('kinich-open-pricing', {
          detail: { highlightPlan: 'spark', reason: check.message },
        })
      );
      return;
    }
    const targetCol =
      selectedCollectionId !== 'all' && selectedCollectionId !== 'pinned'
        ? selectedCollectionId
        : 'col_explanations';
    const created = KnowledgeVaultStore.saveItem({
      title: newNoteTitle.trim(),
      summary: newNoteContent.trim().slice(0, 200),
      content: newNoteContent.trim(),
      type: 'note',
      sourceType: 'note',
      collectionId: targetCol,
      tags: newNoteTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    });
    setActiveVaultItem(created);
    setIsCreatingNote(false);
    setNewNoteTitle('');
    setNewNoteContent('');
  };

  const handleAddCollection = () => {
    if (!newCollectionName.trim()) return;
    const col = KnowledgeVaultStore.createCollection(newCollectionName.trim());
    setCollections(KnowledgeVaultStore.getCollections());
    setSelectedCollectionId(col.id);
    setNewCollectionName('');
    setShowNewCollectionInput(false);
  };

  const handleExportVault = (format: 'markdown' | 'json') => {
    const content =
      format === 'markdown'
        ? KnowledgeVaultStore.exportVaultAsMarkdown()
        : KnowledgeVaultStore.exportVaultAsJson();
    const mime = format === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json';
    const ext = format === 'markdown' ? 'md' : 'json';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinich-knowledge-vault.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpdateNotifPref = (patch: Partial<KinichNotificationPreferences>) => {
    const next = saveNotificationPreferences(patch);
    setNotifPrefs(next);
  };

  const handleSaveCreatorProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await saveCreatorPublicProfile({
        displayName: creatorProfile.displayName,
        bio: creatorProfile.bio,
        isPublic: creatorProfile.isPublic,
        specialtyTags: creatorProfile.specialtyTags,
      });
      if (updated) setCreatorProfile(updated);
      setProfileSavedToast(true);
      setTimeout(() => setProfileSavedToast(false), 2200);
    } finally {
      setSavingProfile(false);
    }
  };

  const cardSurface = isDark
    ? 'bg-[#121215] border-white/[0.08]'
    : 'bg-[#f8f8fa] border-black/[0.08]';

  const subCardSurface = isDark
    ? 'bg-[#18181c] border-white/[0.07]'
    : 'bg-white border-black/[0.08]';

  const inputSurface = isDark
    ? 'bg-[#09090b] border-white/[0.12] text-white placeholder-neutral-500 focus:border-white/30'
    : 'bg-white border-black/[0.12] text-neutral-900 placeholder-neutral-400 focus:border-black/30';

  const primaryBtn = isDark
    ? 'bg-white text-black hover:bg-neutral-200'
    : 'bg-neutral-900 text-white hover:bg-neutral-800';

  const secondaryBtn = isDark
    ? 'border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200'
    : 'border-black/[0.12] bg-white hover:bg-black/[0.04] text-neutral-800';

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden animate-in fade-in duration-150 ${
        isDark ? 'bg-[#09090b] text-white' : 'bg-white text-[#09090b]'
      }`}
    >
      {/* Top Header — clean single-row monochrome layout without overlapping buttons */}
      <div
        className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-white/[0.08] bg-[#09090b]' : 'border-black/[0.08] bg-white'
        }`}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold tracking-tight truncate">
            Kinich Workspace Hub
          </h2>
          <p className="text-[11px] text-neutral-500 truncate hidden sm:block">
            Live arXiv + Connected GitHub · Knowledge Vault · Kinich Passes
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border ${
              isDark
                ? 'bg-white/[0.04] border-white/[0.08] text-neutral-300'
                : 'bg-neutral-100 border-black/[0.08] text-neutral-700'
            }`}
          >
            <span>Level {level.level}</span>
            <span>·</span>
            <strong className="font-semibold">{level.name}</strong>
          </span>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-white/[0.08] text-neutral-400 hover:text-white'
                : 'hover:bg-black/[0.06] text-neutral-500 hover:text-black'
            }`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs — clean monochrome pills */}
      <div
        className={`px-4 sm:px-6 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 ${
          isDark ? 'bg-[#09090b] border-white/[0.08]' : 'bg-white border-black/[0.08]'
        }`}
      >
        {(
          [
            { id: 'discover', label: 'Discover' },
            { id: 'vault', label: `Vault (${vaultThreads.length || vaultItems.length})` },
            { id: 'passes', label: 'Referrals' },
            { id: 'feedback', label: 'Feedback' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === t.id
                ? isDark
                  ? 'bg-white text-black font-semibold'
                  : 'bg-neutral-900 text-white font-semibold'
                : isDark
                ? 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                : 'text-neutral-600 hover:text-black hover:bg-black/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-y-auto slim-scrollbar p-4 sm:p-6 text-xs">
        <div className="max-w-6xl mx-auto">
          {/* =========================================================
              TAB 1: ZENO DISCOVER (LIVE ARXIV + CONNECTED GITHUB + COMMUNITY)
             ========================================================= */}
          {activeTab === 'discover' && (
            <div className="space-y-5">
              {/* Clean, Premium Header Bar + Refresh Action */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-[#101014] border-white/10'
                    : 'bg-white border-black/10 shadow-2xs'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold tracking-tight">Discover Research & Code</span>
                    <span className="text-[11px] text-neutral-400">
                      · {liveArxivPapers.length} arXiv papers · {liveGithubRepos.length} repos · {discoverItems.length} blueprints
                    </span>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Frontier preprints linked to open-source code and community study workflows.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setLiveRefreshTick((t) => t + 1)}
                    disabled={liveFeedLoading}
                    className="h-8 px-3.5 rounded-full bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${liveFeedLoading ? 'animate-spin' : ''}`}
                    />
                    <span>{liveFeedLoading ? 'Syncing…' : 'Refresh'}</span>
                  </button>
                </div>
              </div>

              {/* Search & Source Filter Bar */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={discoverQuery}
                    onChange={(e) => setDiscoverQuery(e.target.value)}
                    placeholder="Search papers, code, or study blueprints..."
                    className={`w-full pl-9 pr-4 py-2 rounded-full border text-xs outline-none transition-colors ${
                      isDark
                        ? 'bg-[#09090b] border-white/15 text-white placeholder-neutral-500 focus:border-[#FC4C01]'
                        : 'bg-white border-black/15 text-black placeholder-neutral-400 focus:border-[#FC4C01]'
                    }`}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {(
                    [
                      { id: 'all', label: 'All Sources' },
                      { id: 'arxiv', label: 'arXiv + GitHub' },
                      { id: 'github', label: 'GitHub Repos' },
                      { id: 'community', label: 'Study Blueprints' },
                    ] as const
                  ).map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setDiscoverSourceFilter(src.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                        discoverSourceFilter === src.id
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold shadow-xs'
                          : isDark
                          ? 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                          : 'text-neutral-600 hover:text-black hover:bg-black/[0.04]'
                      }`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter Bar (Pills) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(['All', ...DISCOVER_CATEGORIES] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDiscoverCategory(cat)}
                    className={`px-3 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      discoverCategory === cat
                        ? isDark
                          ? 'bg-white text-black border-white font-semibold'
                          : 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                        : isDark
                        ? 'border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                        : 'border-black/10 text-neutral-600 hover:text-black hover:bg-black/[0.04]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* SECTION A: LIVE ARXIV PAPERS WITH CONNECTED GITHUB REPOSITORIES */}
              {(discoverSourceFilter === 'all' || discoverSourceFilter === 'arxiv') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#FC4C01]" />
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-mono">
                        arXiv Preprints + Connected GitHub Implementations
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {liveFeedLoading ? 'Fetching live arXiv API…' : `${liveArxivPapers.length} papers`}
                    </span>
                  </div>

                  {liveFeedLoading && liveArxivPapers.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map((n) => (
                        <div
                          key={n}
                          className={`p-5 rounded-2xl border-2 animate-pulse space-y-3 ${
                            isDark ? 'bg-[#121215] border-white/15' : 'bg-neutral-100 border-black/15'
                          }`}
                        >
                          <div className="h-4 w-1/3 rounded bg-neutral-500/20" />
                          <div className="h-5 w-4/5 rounded bg-neutral-500/20" />
                          <div className="h-14 w-full rounded bg-neutral-500/15" />
                        </div>
                      ))}
                    </div>
                  ) : liveArxivPapers.length === 0 ? (
                    <div className={`p-6 rounded-2xl border-2 text-center ${cardSurface}`}>
                      <div className="text-xs font-mono text-neutral-400">
                        No arXiv papers matched this filter. Click "Refresh Feed" or try another topic.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {liveArxivPapers.map((paper) => {
                        const connectedRepo = paper.connectedRepos?.[0] || null;
                        const isSaved = Boolean(savedLiveIds[`arxiv_${paper.id}`]);
                        return (
                          <div
                            key={paper.id}
                            className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col justify-between gap-4 transition-all ${
                              isDark
                                ? 'bg-[#111115] border-white/20 hover:border-[#FC4C01]/70 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)]'
                                : 'bg-white border-black hover:border-[#FC4C01] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)]'
                            }`}
                          >
                            <div className="space-y-2.5">
                              {/* Top Brutalist Meta Strip */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded bg-[#FC4C01]/15 border border-[#FC4C01]/40 text-[#FC4C01] font-mono text-[10px] font-bold uppercase">
                                    ARXIV // {paper.primaryCategory || 'CS.AI'}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                                      isDark
                                        ? 'bg-white/5 border-white/10 text-neutral-300'
                                        : 'bg-neutral-100 border-black/15 text-neutral-700'
                                    }`}
                                  >
                                    {paper.id}
                                  </span>
                                </div>
                                <span className="font-mono text-[10px] text-neutral-500">
                                  {paper.published
                                    ? new Date(paper.published).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })
                                    : 'Recent'}
                                </span>
                              </div>

                              {/* Paper Title */}
                              <a
                                href={paper.absUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm sm:text-[15px] font-bold leading-snug hover:text-[#FC4C01] transition-colors"
                              >
                                {paper.title}
                              </a>

                              {/* Authors */}
                              {paper.authors?.length > 0 && (
                                <div className="text-[11px] font-mono text-neutral-400 truncate">
                                  {paper.authors.slice(0, 4).join(', ')}
                                  {paper.authors.length > 4 ? ` +${paper.authors.length - 4} et al.` : ''}
                                </div>
                              )}

                              {/* Abstract Summary */}
                              <p
                                className={`text-xs line-clamp-3 leading-relaxed ${
                                  isDark ? 'text-neutral-300' : 'text-neutral-700'
                                }`}
                              >
                                {paper.summary}
                              </p>

                              {/* Connected GitHub Repository Brutalist Sub-Card */}
                              {connectedRepo ? (
                                <div
                                  className={`mt-2 p-3 rounded-xl border-2 space-y-1.5 ${
                                    isDark
                                      ? 'bg-[#09090b] border-emerald-500/40'
                                      : 'bg-emerald-50/60 border-emerald-700/50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <GitBranch className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                                        Connected GitHub Code
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
                                      {connectedRepo.language && (
                                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">
                                          {connectedRepo.language}
                                        </span>
                                      )}
                                      <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                                        <Star className="w-3 h-3 fill-amber-400" />
                                        {connectedRepo.stars.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2">
                                    <a
                                      href={connectedRepo.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-xs font-bold hover:underline truncate text-emerald-300"
                                    >
                                      {connectedRepo.fullName}
                                    </a>
                                    <a
                                      href={connectedRepo.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold inline-flex items-center gap-1 shrink-0"
                                    >
                                      <span>Repo</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  </div>
                                  {connectedRepo.description && (
                                    <p className="text-[11px] text-neutral-400 line-clamp-1">
                                      {connectedRepo.description}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className={`mt-2 px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${
                                    isDark
                                      ? 'bg-white/[0.02] border-white/10'
                                      : 'bg-neutral-50 border-black/10'
                                  }`}
                                >
                                  <span className="text-[11px] font-mono text-neutral-400 inline-flex items-center gap-1.5">
                                    <Code2 className="w-3.5 h-3.5 text-[#FC4C01]" />
                                    <span>Code & Benchmarks Search</span>
                                  </span>
                                  <a
                                    href={`https://github.com/search?q=${encodeURIComponent(
                                      paper.title.split(/\s+/).slice(0, 5).join(' ')
                                    )}&type=repositories`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-[10.5px] font-bold text-[#FC4C01] hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>Find on GitHub</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Action Bar: arXiv Article Link, PDF Link, Save, Synthesize */}
                            <div
                              className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2 ${
                                isDark ? 'border-white/10' : 'border-black/10'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <a
                                  href={paper.absUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`px-2.5 py-1.5 rounded-lg border font-mono text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${secondaryBtn}`}
                                >
                                  <span>arXiv Article</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                <a
                                  href={paper.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`px-2.5 py-1.5 rounded-lg border font-mono text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${secondaryBtn}`}
                                >
                                  <FileText className="w-3 h-3 text-[#FC4C01]" />
                                  <span>PDF</span>
                                </a>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    KnowledgeVaultStore.saveItem({
                                      title: `[arXiv:${paper.id}] ${paper.title}`,
                                      summary: paper.summary.slice(0, 240),
                                      content: `### ${paper.title}\n\n- **arXiv ID:** \`${paper.id}\`\n- **Authors:** ${paper.authors.join(', ')}\n- **arXiv Abstract:** ${paper.absUrl}\n- **Direct PDF:** ${paper.pdfUrl}${
                                        connectedRepo
                                          ? `\n- **Connected GitHub Repo:** [${connectedRepo.fullName}](${connectedRepo.url}) (★ ${connectedRepo.stars})`
                                          : ''
                                      }\n\n#### Abstract\n${paper.summary}`,
                                      type: 'research_summary',
                                      collectionId: 'col_research_ideas',
                                      tags: [
                                        'arxiv',
                                        (paper.primaryCategory || 'research').toLowerCase(),
                                        ...(connectedRepo ? ['github'] : []),
                                      ],
                                    });
                                    setSavedLiveIds((prev) => ({
                                      ...prev,
                                      [`arxiv_${paper.id}`]: true,
                                    }));
                                    setVaultItems(KnowledgeVaultStore.getItems());
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg border font-mono text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${secondaryBtn}`}
                                >
                                  {isSaved ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span>Saved</span>
                                    </>
                                  ) : (
                                    <>
                                      <Bookmark className="w-3 h-3" />
                                      <span>Save</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const synthArtifact: PublicArtifact = {
                                      id: `arxiv_${paper.id}`,
                                      ownerId: 'arxiv',
                                      showAuthorAttribution: true,
                                      title: paper.title,
                                      summary: paper.summary,
                                      content: `Analyze this arXiv research paper (${paper.absUrl})${
                                        connectedRepo
                                          ? ` and its connected GitHub implementation (${connectedRepo.url})`
                                          : ''
                                      }:\n\n**Title:** ${paper.title}\n**Authors:** ${paper.authors.join(
                                        ', '
                                      )}\n**Abstract:** ${paper.summary}`,
                                      category: 'Research',
                                      outputType: 'research_summary',
                                      tags: ['arxiv', paper.primaryCategory || 'research'],
                                      authorName: paper.authors[0] || 'arXiv Author',
                                      authorUsername: 'arxiv',
                                      visibility: 'public',
                                      viewsCount: 1,
                                      savesCount: 0,
                                      forksCount: 0,
                                      createdAt: Date.now(),
                                      updatedAt: Date.now(),
                                    };
                                    onForkArtifactIntoChat(synthArtifact);
                                    onClose();
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white font-mono text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Ask Kinich</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION B: LIVE GITHUB OPEN-SOURCE REPOSITORIES */}
              {(discoverSourceFilter === 'all' || discoverSourceFilter === 'github') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-mono">
                        Trending GitHub Repositories & Engineering Tools
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-500">
                      {liveGithubRepos.length} repositories
                    </span>
                  </div>

                  {liveGithubRepos.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {liveGithubRepos.map((repo) => {
                        const isSaved = Boolean(savedLiveIds[`gh_${repo.id}`]);
                        return (
                          <div
                            key={repo.id}
                            className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col justify-between gap-3.5 transition-all ${
                              isDark
                                ? 'bg-[#111115] border-white/20 hover:border-emerald-400/70 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.08)]'
                                : 'bg-white border-black hover:border-emerald-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.85)]'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                                  GITHUB // {repo.language || 'OPEN SOURCE'}
                                </span>
                                <div className="flex items-center gap-3 font-mono text-[11px]">
                                  <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                                    {repo.stars.toLocaleString()}
                                  </span>
                                  <span className="text-neutral-400">
                                    ⑂ {repo.forks.toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block font-mono text-sm sm:text-[15px] font-bold hover:text-emerald-400 transition-colors truncate"
                              >
                                {repo.fullName}
                              </a>

                              <p
                                className={`text-xs line-clamp-2 leading-relaxed ${
                                  isDark ? 'text-neutral-300' : 'text-neutral-700'
                                }`}
                              >
                                {repo.description}
                              </p>

                              {repo.topics && repo.topics.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {repo.topics.slice(0, 4).map((topic) => (
                                    <span
                                      key={topic}
                                      className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                                        isDark
                                          ? 'bg-white/[0.04] border-white/10 text-neutral-400'
                                          : 'bg-neutral-100 border-black/10 text-neutral-700'
                                      }`}
                                    >
                                      #{topic}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div
                              className={`pt-3 border-t flex items-center justify-between gap-2 ${
                                isDark ? 'border-white/10' : 'border-black/10'
                              }`}
                            >
                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`px-3 py-1.5 rounded-lg border font-mono text-[11px] font-semibold inline-flex items-center gap-1.5 ${secondaryBtn}`}
                              >
                                <span>Open GitHub</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    KnowledgeVaultStore.saveItem({
                                      title: `[GitHub] ${repo.fullName}`,
                                      summary: repo.description,
                                      content: `### ${repo.fullName}\n\n- **Repository:** ${repo.url}\n- **Language:** ${repo.language}\n- **Stars:** ★ ${repo.stars.toLocaleString()}\n\n${repo.description}`,
                                      type: 'discover_resource',
                                      collectionId: 'col_programming',
                                      tags: ['github', (repo.language || 'code').toLowerCase()],
                                    });
                                    setSavedLiveIds((prev) => ({
                                      ...prev,
                                      [`gh_${repo.id}`]: true,
                                    }));
                                    setVaultItems(KnowledgeVaultStore.getItems());
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg border font-mono text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${secondaryBtn}`}
                                >
                                  {isSaved ? 'Saved ✓' : 'Save'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const ghArtifact: PublicArtifact = {
                                      id: `gh_${repo.id}`,
                                      ownerId: 'github',
                                      showAuthorAttribution: true,
                                      title: repo.fullName,
                                      summary: repo.description,
                                      content: `Explain the architecture, key patterns, and use cases of the GitHub repository **${repo.fullName}** (${repo.url}):\n\n${repo.description}`,
                                      category: 'Programming',
                                      outputType: 'structured_notes',
                                      tags: ['github', repo.language || 'code'],
                                      authorName: repo.owner,
                                      authorUsername: repo.owner,
                                      visibility: 'public',
                                      viewsCount: 1,
                                      savesCount: 0,
                                      forksCount: 0,
                                      createdAt: Date.now(),
                                      updatedAt: Date.now(),
                                    };
                                    onForkArtifactIntoChat(ghArtifact);
                                    onClose();
                                  }}
                                  className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold cursor-pointer ${primaryBtn}`}
                                >
                                  Inspect in Kinich
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION C: ZENO COMMUNITY BLUEPRINTS & STUDY GUIDES */}
              {(discoverSourceFilter === 'all' || discoverSourceFilter === 'community') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#FC4C01]" />
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider font-mono">
                        Kinich Community Study Guides & Research Blueprints
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          { id: 'recent', label: 'Recent' },
                          { id: 'saved', label: 'Most Saved' },
                          { id: 'views', label: 'Most Viewed' },
                        ] as const
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setDiscoverSort(s.id)}
                          className={`px-2.5 py-1 rounded-lg border font-mono text-[10.5px] cursor-pointer transition-colors ${
                            discoverSort === s.id
                              ? isDark
                                ? 'bg-white text-black border-white font-bold'
                                : 'bg-neutral-900 text-white border-neutral-900 font-bold'
                              : secondaryBtn
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {discoverLoading ? (
                    <div className="py-12 text-center text-neutral-500">
                      Loading public Kinich library…
                    </div>
                  ) : discoverItems.length === 0 ? (
                    <div className={`p-8 rounded-2xl border-2 text-center space-y-1.5 ${cardSurface}`}>
                      <div className="text-sm font-semibold">No matching public resources found</div>
                      <p className="text-xs text-neutral-500">
                        Try clearing your search query or switching to another category.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {discoverItems.map((item) => {
                        const isSaved = KnowledgeVaultStore.isArtifactBookmarked(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col justify-between gap-3.5 transition-all ${
                              isDark
                                ? 'bg-[#121215] border-white/15 hover:border-white/35 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.06)]'
                                : 'bg-white border-black/80 hover:border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.75)]'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider border ${
                                    isDark
                                      ? 'bg-white/[0.06] border-white/10 text-neutral-200'
                                      : 'bg-neutral-100 border-black/15 text-neutral-800'
                                  }`}
                                >
                                  {item.category}
                                </span>

                                <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-500">
                                  <span>{item.viewsCount || 1} views</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nowSaved =
                                        KnowledgeVaultStore.toggleBookmarkFromArtifact(item);
                                      if (nowSaved) {
                                        recordArtifactInteraction(item.id, 'save');
                                      }
                                      setVaultItems(KnowledgeVaultStore.getItems());
                                    }}
                                    className={`cursor-pointer font-semibold transition-colors ${
                                      isSaved
                                        ? 'text-[#FC4C01] underline'
                                        : 'text-neutral-500 hover:text-current'
                                    }`}
                                  >
                                    {isSaved ? 'Saved' : 'Save'}
                                  </button>
                                </div>
                              </div>

                              <h3
                                onClick={() => {
                                  trackGrowthEvent('discover_resource_opened', {
                                    artifactId: item.id,
                                    category: item.category,
                                  });
                                  onOpenArtifactPage(item);
                                }}
                                className="text-sm font-bold leading-snug hover:text-[#FC4C01] transition-colors cursor-pointer"
                              >
                                {item.title}
                              </h3>

                              <p
                                className={`text-xs line-clamp-2 leading-relaxed ${
                                  isDark ? 'text-neutral-400' : 'text-neutral-600'
                                }`}
                              >
                                {item.summary}
                              </p>
                            </div>

                            <div
                              className={`pt-3 border-t flex items-center justify-between gap-2 ${
                                isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                              }`}
                            >
                              <div className="flex flex-wrap gap-1 min-w-0">
                                {item.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                                      isDark
                                        ? 'bg-white/[0.04] text-neutral-400'
                                        : 'bg-black/[0.04] text-neutral-600'
                                    }`}
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    window.dispatchEvent(
                                      new CustomEvent('kinich-open-report', {
                                        detail: {
                                          targetType: 'discover_item',
                                          targetId: item.id,
                                          contentPreview: `${item.title}: ${item.summary}`,
                                        },
                                      })
                                    );
                                  }}
                                  className={`px-2 py-1.5 rounded-lg border font-mono text-[10.5px] cursor-pointer ${secondaryBtn}`}
                                  title="Report this shared resource"
                                >
                                  Report
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    trackGrowthEvent('discover_resource_opened', {
                                      artifactId: item.id,
                                      category: item.category,
                                    });
                                    onOpenArtifactPage(item);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg border font-mono text-[11px] font-semibold cursor-pointer ${secondaryBtn}`}
                                >
                                  Read Page
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    recordArtifactInteraction(item.id, 'cta');
                                    onForkArtifactIntoChat(item);
                                    onClose();
                                  }}
                                  className={`px-3.5 py-1.5 rounded-lg font-mono text-[11px] font-bold cursor-pointer ${primaryBtn}`}
                                >
                                  Fork
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="text-[11px] text-neutral-500 font-mono flex flex-wrap items-center justify-between gap-2 pt-1">
                <span>
                  Live Feed: {liveArxivPapers.length} arXiv papers · {liveGithubRepos.length} GitHub repos · {discoverItems.length} community blueprints
                </span>
                <span>Private conversations and notes never appear in Discover.</span>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: THE VAULT (Subject -> Chapter + Sage + Type Filters)
             ========================================================= */}
          {activeTab === 'vault' && (
            isGuestVault ? (
              <div
                data-testid="vault-guest-signin-prompt"
                className={`p-8 sm:p-12 rounded-2xl border text-center max-w-lg mx-auto my-6 space-y-4 ${cardSurface}`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#FC4C01]/15 border border-[#FC4C01]/35 text-[#FC4C01] flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold tracking-tight">
                    Sign in to your Vault
                  </h3>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    Save lectures, notes, quizzes, and study threads across your devices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('kinich-open-auth'));
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white font-semibold text-xs cursor-pointer transition-colors"
                >
                  Sign in to save
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Vault View Mode Toggle Bar (Study Feed / Subject Tree) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.08] dark:border-white/[0.08]">
                  <div className="flex items-center gap-1 p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.05] border border-black/10 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setVaultViewMode('threads');
                        setActiveVaultItem(null);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        vaultViewMode === 'threads'
                          ? 'bg-[#FC4C01] text-white shadow-xs'
                          : 'text-neutral-500 hover:text-current'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Study Feed</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 dark:bg-white/20 font-medium tabular-nums">
                        {vaultThreads.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVaultViewMode('tree');
                        setActiveThread(null);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        vaultViewMode === 'tree'
                          ? 'bg-[#FC4C01] text-white shadow-xs'
                          : 'text-neutral-500 hover:text-current'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Subject Tree</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 dark:bg-white/20 font-medium tabular-nums">
                        {vaultItems.length}
                      </span>
                    </button>
                  </div>

                  {copiedShareNotice && (
                    <span className="text-xs text-[#FC4C01] font-medium bg-[#FC4C01]/10 px-3 py-1 rounded-full">
                      {copiedShareNotice}
                    </span>
                  )}
                </div>

                {vaultViewMode === 'threads' ? (
                  activeThread ? (
                    <div className={`p-4 sm:p-6 rounded-2xl border space-y-5 ${cardSurface}`}>
                      {/* Top Bar: Back button, Badges & Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.08] dark:border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveThread(null);
                            setActiveVideoTimeSec(0);
                          }}
                          className="h-8 px-3.5 rounded-full border border-black/10 dark:border-white/10 text-xs text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white font-medium inline-flex items-center gap-1 cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          ← Back to Feed
                        </button>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuizMeOnThread(activeThread)}
                            className="h-8 px-3.5 rounded-full bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                          >
                            Quiz me
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFlashcardsOnThread(activeThread)}
                            className={`h-8 px-3.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                              isDark
                                ? 'border-white/10 hover:border-white/25 text-neutral-200'
                                : 'border-black/10 hover:border-black/25 text-neutral-800'
                            }`}
                          >
                            Flashcards
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeepResearchOnThread(activeThread)}
                            className={`h-8 px-3.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                              isDark
                                ? 'border-white/10 hover:border-white/25 text-neutral-200'
                                : 'border-black/10 hover:border-black/25 text-neutral-800'
                            }`}
                          >
                            Deep Research this
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareThread(activeThread)}
                            className={`h-8 px-3.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                              isDark
                                ? 'border-white/10 hover:border-white/25 text-neutral-200'
                                : 'border-black/10 hover:border-black/25 text-neutral-800'
                            }`}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleForgetThread(activeThread.id)}
                            className="h-8 px-3.5 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="Remove from Vault and wipe agent memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Forget this</span>
                          </button>
                        </div>
                      </div>

                      {/* Main Post Card with Left Reddit Upvote Column */}
                      <div className="flex items-start gap-4">
                        {/* Vote Pillar */}
                        <div className="flex flex-col items-center justify-center py-1.5 px-1 rounded-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleVoteThread(activeThread.id, 1)}
                            className="size-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-neutral-500 hover:text-[#FC4C01] cursor-pointer transition-colors"
                            title="Upvote thread"
                          >
                            <ArrowBigUp className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-bold font-mono my-0.5 tabular-nums text-neutral-800 dark:text-neutral-200">{activeThread.score || 0}</span>
                          <button
                            type="button"
                            onClick={() => handleVoteThread(activeThread.id, -1)}
                            className="size-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-neutral-500 hover:text-blue-500 cursor-pointer transition-colors"
                            title="Downvote thread"
                          >
                            <ArrowBigDown className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Post Content */}
                        <div className="flex-1 space-y-4 min-w-0">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-md bg-[#FC4C01]/15 border border-[#FC4C01]/35 text-[#FC4C01] font-semibold text-[11px]">
                                {activeThread.subject || 'General Studies'} → {activeThread.chapter || 'Core Concepts'}
                              </span>
                              <span className="px-2 py-0.5 rounded-md border border-black/10 dark:border-white/10 text-[10px] font-mono uppercase opacity-80">
                                {activeThread.type}
                              </span>
                              <span className="text-[11px] text-neutral-400">
                                {formatToIstDate(activeThread.createdAt)}
                              </span>
                              {activeThread.sourceUrl && (
                                <a
                                  href={activeThread.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-[#FC4C01] hover:underline"
                                >
                                  <span>Source Link</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight">{activeThread.title}</h2>
                          </div>

                          {/* Source Player / Preview */}
                          {activeThread.type === 'youtube' && extractYouTubeVideoId(activeThread.sourceUrl) && (
                            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-black shadow-md">
                              <iframe
                                id="vault-youtube-player"
                                src={`https://www.youtube.com/embed/${extractYouTubeVideoId(activeThread.sourceUrl)}?start=${activeVideoTimeSec}&autoplay=${activeVideoTimeSec > 0 ? 1 : 0}`}
                                title={activeThread.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full border-0"
                              />
                            </div>
                          )}

                          {activeThread.type === 'web_link' && activeThread.sourceUrl && (
                            <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${secondaryBtn}`}>
                              <div className="truncate">
                                <div className="text-xs font-semibold truncate">{activeThread.title}</div>
                                <div className="text-[11px] text-neutral-400 truncate">{activeThread.sourceUrl}</div>
                              </div>
                              <a
                                href={activeThread.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-[#FC4C01] text-white text-xs font-medium shrink-0 flex items-center gap-1"
                              >
                                <span>Visit</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {/* TL;DR Box with Warm Amber Glow */}
                          <div
                            className={`p-3.5 sm:p-4 rounded-xl border space-y-1 ${
                              isDark
                                ? 'bg-[#181310] border-[#FC4C01]/40 text-neutral-200'
                                : 'bg-[#fff8f4] border-[#FC4C01]/35 text-neutral-800'
                            }`}
                          >
                            <div className="text-[11px] uppercase tracking-wider font-bold text-[#FC4C01] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>TL;DR Takeaway</span>
                            </div>
                            <p className="text-xs sm:text-[13px] leading-relaxed">
                              {activeThread.tldr || 'Key study takeaways summarized by Sage.'}
                            </p>
                          </div>

                          {/* Key Points with Tap-to-Seek Timestamps */}
                          <div className="space-y-2 pt-2">
                            <div className="text-xs uppercase tracking-wider font-bold text-neutral-400 flex items-center justify-between">
                              <span>Key Points ({activeThread.keyPoints?.length || 0})</span>
                              {activeThread.type === 'youtube' && (
                                <span className="text-[10px] text-[#FC4C01] font-normal">
                                  Tap any timestamp to jump the video
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {(activeThread.keyPoints || []).map((kp, idx) => (
                                <div
                                  key={kp.id || idx}
                                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
                                    isDark
                                      ? 'bg-white/[0.02] border-white/10 hover:border-white/20'
                                      : 'bg-black/[0.02] border-black/10 hover:border-black/20'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    <span className="text-xs font-mono font-bold text-[#FC4C01] shrink-0 mt-0.5">
                                      {idx + 1}.
                                    </span>
                                    {kp.timestamp && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const sec = parseTimestampToSeconds(kp.timestamp);
                                          setActiveVideoTimeSec(sec);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FC4C01]/15 text-[#FC4C01] hover:bg-[#FC4C01]/25 text-[11px] font-mono font-semibold cursor-pointer shrink-0 transition-colors"
                                        title="Click to jump video to this moment"
                                      >
                                        <Play className="w-2.5 h-2.5 fill-current" />
                                        <span>{kp.timestamp}</span>
                                      </button>
                                    )}
                                    <span className="text-xs sm:text-[13px] leading-relaxed break-words">
                                      {kp.text}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleVoteKeyPoint(activeThread.id, kp.id, 1)}
                                      className="p-1 hover:text-[#FC4C01] cursor-pointer text-neutral-400"
                                      title="Upvote key point"
                                    >
                                      <ArrowBigUp className="w-4 h-4" />
                                    </button>
                                    <span className="text-[11px] font-mono font-semibold text-neutral-400 min-w-4 text-center">
                                      {kp.score || 0}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleVoteKeyPoint(activeThread.id, kp.id, -1)}
                                      className="p-1 hover:text-blue-500 cursor-pointer text-neutral-400"
                                      title="Downvote key point"
                                    >
                                      <ArrowBigDown className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Comments Section (Reddit-Style with Agent Comments) */}
                      <div className="pt-6 border-t border-black/[0.08] dark:border-white/[0.08] space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-[#FC4C01]" />
                            <span>Discussion & Agent Responses ({activeThread.comments?.length || 0})</span>
                          </h3>
                        </div>

                        {/* Top-level Comment Composer */}
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={threadCommentInput}
                            onChange={(e) => setThreadCommentInput(e.target.value)}
                            placeholder="Add a study note, question, or reflection on this thread..."
                            className={`w-full p-3 rounded-xl border text-xs outline-none resize-none ${inputSurface}`}
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleAddThreadComment()}
                              className="px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Comment
                            </button>
                          </div>
                        </div>

                        {/* Comment List */}
                        <div className="space-y-3 pt-2">
                          {(activeThread.comments || [])
                            .filter((c) => !c.parentId)
                            .map((comment) => {
                              const isCollapsed = Boolean(collapsedComments[comment.id]);
                              const replies = (activeThread.comments || []).filter(
                                (r) => r.parentId === comment.id
                              );
                              const isAgent = comment.author !== 'user';

                              return (
                                <div
                                  key={comment.id}
                                  className={`p-3.5 rounded-xl border space-y-2.5 ${
                                    isAgent
                                      ? isDark
                                        ? 'bg-[#151318] border-[#FC4C01]/30'
                                        : 'bg-[#fffaf7] border-[#FC4C01]/30'
                                      : cardSurface
                                  }`}
                                >
                                  {/* Comment Header */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      {isAgent ? (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#FC4C01]/15 border border-[#FC4C01]/30 text-[#FC4C01] text-[11px] font-bold">
                                          <Sparkles className="w-3 h-3" />
                                          <span className="capitalize">{comment.author} (Agent)</span>
                                        </div>
                                      ) : (
                                        <div className="px-2 py-0.5 rounded-md bg-neutral-500/15 text-neutral-400 text-[11px] font-semibold">
                                          You (Student)
                                        </div>
                                      )}
                                      <span className="text-[11px] text-neutral-400">
                                        {formatToIstDate(comment.createdAt)}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCollapsedComments((prev) => ({
                                          ...prev,
                                          [comment.id]: !prev[comment.id],
                                        }))
                                      }
                                      className="text-[11px] font-mono text-neutral-400 hover:text-current cursor-pointer"
                                    >
                                      {isCollapsed ? '[+] Expand' : '[-] Collapse'}
                                    </button>
                                  </div>

                                  {!isCollapsed && (
                                    <>
                                      <div className="text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                                        {comment.text}
                                      </div>

                                      <div className="flex items-center gap-3 pt-1 text-xs text-neutral-400">
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleVoteComment(activeThread.id, comment.id, 1)
                                            }
                                            className="hover:text-[#FC4C01] cursor-pointer"
                                          >
                                            <ArrowBigUp className="w-4 h-4" />
                                          </button>
                                          <span className="font-mono font-semibold">{comment.score || 0}</span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleVoteComment(activeThread.id, comment.id, -1)
                                            }
                                            className="hover:text-blue-500 cursor-pointer"
                                          >
                                            <ArrowBigDown className="w-4 h-4" />
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setReplyingCommentId(
                                              replyingCommentId === comment.id ? null : comment.id
                                            )
                                          }
                                          className="hover:text-current font-medium cursor-pointer"
                                        >
                                          Reply
                                        </button>
                                      </div>

                                      {/* Inline Reply Input */}
                                      {replyingCommentId === comment.id && (
                                        <div className="pt-2 pl-3 border-l-2 border-[#FC4C01]/40 space-y-2">
                                          <input
                                            type="text"
                                            value={replyTextInput}
                                            onChange={(e) => setReplyTextInput(e.target.value)}
                                            placeholder="Write a reply..."
                                            className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${inputSurface}`}
                                          />
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setReplyingCommentId(null);
                                                setReplyTextInput('');
                                              }}
                                              className="px-2.5 py-1 text-xs text-neutral-400 hover:text-current cursor-pointer"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleAddThreadComment(comment.id)}
                                              className="px-3 py-1 bg-[#FC4C01] text-white text-xs font-semibold rounded-lg cursor-pointer"
                                            >
                                              Send Reply
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Nested Replies */}
                                      {replies.length > 0 && (
                                        <div className="pl-3 sm:pl-4 border-l-2 border-neutral-700/25 space-y-2 pt-2">
                                          {replies.map((reply) => (
                                            <div
                                              key={reply.id}
                                              className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${cardSurface}`}
                                            >
                                              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                                                <span className="font-semibold text-current">
                                                  {reply.author === 'user'
                                                    ? 'You (Student)'
                                                    : `${reply.author} (Agent)`}
                                                </span>
                                                <span>{formatToIstDate(reply.createdAt)}</span>
                                              </div>
                                              <p className="leading-relaxed whitespace-pre-wrap">{reply.text}</p>
                                              <div className="flex items-center gap-1 text-[11px] text-neutral-400 pt-0.5">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleVoteComment(activeThread.id, reply.id, 1)
                                                  }
                                                  className="hover:text-[#FC4C01] cursor-pointer"
                                                >
                                                  <ArrowBigUp className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="font-mono">{reply.score || 0}</span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleVoteComment(activeThread.id, reply.id, -1)
                                                  }
                                                  className="hover:text-blue-500 cursor-pointer"
                                                >
                                                  <ArrowBigDown className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Reddit Feed */
                    <div className="space-y-4">
                      {/* Search & Sort / Filter Toolbar */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                          <input
                            type="text"
                            value={vaultSearch}
                            onChange={(e) => setVaultSearch(e.target.value)}
                            placeholder="Search study threads, topics, notes..."
                            className={`w-full pl-9 pr-4 py-2 rounded-full border text-xs outline-none transition-colors ${
                              isDark
                                ? 'bg-[#09090b] border-white/15 text-white placeholder-neutral-500 focus:border-[#FC4C01]'
                                : 'bg-white border-black/15 text-black placeholder-neutral-400 focus:border-[#FC4C01]'
                            }`}
                          />
                        </div>

                        {/* Sort Tabs (New | Top | Revision) */}
                        <div className="flex items-center gap-1 p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 shrink-0">
                          <button
                            type="button"
                            onClick={() => setThreadSort('new')}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                              threadSort === 'new'
                                ? 'bg-[#FC4C01] text-white shadow-xs'
                                : 'text-neutral-500 hover:text-current'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>New</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setThreadSort('top')}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                              threadSort === 'top'
                                ? 'bg-[#FC4C01] text-white shadow-xs'
                                : 'text-neutral-500 hover:text-current'
                            }`}
                          >
                            <ArrowBigUp className="w-3.5 h-3.5" />
                            <span>Top</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setThreadSort('due')}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                              threadSort === 'due'
                                ? 'bg-[#FC4C01] text-white shadow-xs'
                                : 'text-neutral-500 hover:text-current'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>Revision</span>
                          </button>
                        </div>
                      </div>

                      {/* Type Filter Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                        {(
                          [
                            { id: 'all', label: 'All Sources' },
                            { id: 'youtube', label: 'YouTube Lectures' },
                            { id: 'web_link', label: 'Web Links' },
                            { id: 'pdf', label: 'PDF Documents' },
                            { id: 'image', label: 'Diagrams & Images' },
                            { id: 'text', label: 'Questions & Notes' },
                          ] as const
                        ).map((tf) => (
                          <button
                            key={tf.id}
                            type="button"
                            onClick={() => setThreadTypeFilter(tf.id)}
                            className={`px-3.5 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                              threadTypeFilter === tf.id
                                ? 'bg-[#FC4C01] text-white border-[#FC4C01] font-semibold shadow-xs'
                                : isDark
                                ? 'border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                                : 'border-black/10 text-neutral-600 hover:text-black hover:bg-black/[0.04]'
                            }`}
                          >
                            {tf.label}
                          </button>
                        ))}
                      </div>

                      {/* Study Feed Cards */}
                      {filteredVaultThreads.length === 0 ? (
                        <div className={`p-8 text-center rounded-2xl border space-y-2 ${cardSurface}`}>
                          <div className="text-sm font-semibold">No study threads yet</div>
                          <p className="text-xs text-neutral-400 max-w-md mx-auto">
                            Paste a lecture link, article, or question in chat to build your study threads.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredVaultThreads.map((thread) => (
                            <div
                              key={thread.id}
                              onClick={() => {
                                setActiveThread(thread);
                                setActiveVideoTimeSec(0);
                              }}
                              className={`p-4 rounded-2xl border flex items-start gap-3.5 cursor-pointer transition-all hover:border-[#FC4C01]/50 ${cardSurface}`}
                            >
                              {/* Left Reddit Vote Column (Pill-shaped) */}
                              <div
                                className="flex flex-col items-center justify-center py-1.5 px-1 rounded-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleVoteThread(thread.id, 1)}
                                  className="size-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-neutral-500 hover:text-[#FC4C01] cursor-pointer transition-colors"
                                  title="Upvote"
                                >
                                  <ArrowBigUp className="w-4 h-4" />
                                </button>
                                <span className="text-xs font-bold font-mono my-0.5 tabular-nums text-neutral-800 dark:text-neutral-200">{thread.score || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => handleVoteThread(thread.id, -1)}
                                  className="size-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-neutral-500 hover:text-blue-500 cursor-pointer transition-colors"
                                  title="Downvote"
                                >
                                  <ArrowBigDown className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Card Body */}
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded-full bg-[#FC4C01]/10 text-[#FC4C01] font-semibold text-[11px]">
                                    {thread.subject || 'General Studies'}
                                  </span>
                                  <span className="text-[11px] text-neutral-400 font-mono">
                                    → {thread.chapter || 'Core Concepts'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 text-[10px] font-mono uppercase opacity-75">
                                    {thread.type}
                                  </span>
                                  <span className="text-[11px] text-neutral-400">
                                    · {formatToIstDate(thread.createdAt)}
                                  </span>
                                  {thread.pinned && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-semibold">
                                      Pinned
                                    </span>
                                  )}
                                </div>

                                <h3 className="text-sm sm:text-base font-bold leading-snug hover:text-[#FC4C01] transition-colors truncate">
                                  {thread.title}
                                </h3>

                                <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                                  {thread.tldr || (thread.keyPoints?.[0]?.text ? `• ${thread.keyPoints[0].text}` : 'Study thread captured by Sage.')}
                                </p>

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-neutral-400">
                                  <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 text-[11px]">
                                      <MessageSquare className="w-3 h-3 text-[#FC4C01]" />
                                      <span>{thread.comments?.length || 0} comments</span>
                                    </span>

                                    <span className="text-[11px] font-mono text-neutral-400">
                                      {thread.keyPoints?.length || 0} key points
                                    </span>
                                  </div>

                                  <div
                                    className="flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleShareThread(thread)}
                                      className="size-7 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-current cursor-pointer transition-colors"
                                      title="Share thread"
                                    >
                                      <Share2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleForgetThread(thread.id)}
                                      className="size-7 rounded-full flex items-center justify-center hover:bg-red-500/10 text-neutral-400 hover:text-red-500 cursor-pointer transition-colors"
                                      title="Forget this thread"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Left Rail: Subjects, Collections, Sage Memory & Export */}
                <div className="md:col-span-3 space-y-4">
                  {/* Sage Status Card */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      isDark
                        ? 'bg-[#121215] border-[#FC4C01]/30'
                        : 'bg-[#fffaf7] border-[#FC4C01]/30'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FC4C01]">
                      <Sparkles className="w-3.5 h-3.5" />
                      Sage Organizer
                    </span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#FC4C01]/15 text-[#FC4C01] font-semibold">
                      {vaultItems.length} items
                    </span>
                  </div>

                  {/* Subjects Navigation */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
                      Subjects
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubject('all');
                        setSelectedCollectionId('all');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between cursor-pointer ${
                        selectedSubject === 'all' && selectedCollectionId === 'all'
                          ? 'bg-[#FC4C01] text-white font-semibold'
                          : 'text-neutral-400 hover:text-current'
                      }`}
                    >
                      <span>All Subjects</span>
                      <span className="text-[11px]">{vaultItems.length}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubject('all');
                        setSelectedCollectionId('pinned');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between cursor-pointer ${
                        selectedCollectionId === 'pinned'
                          ? 'bg-[#FC4C01] text-white font-semibold'
                          : 'text-neutral-400 hover:text-current'
                      }`}
                    >
                      <span>Pinned Items</span>
                      <span className="text-[11px]">
                        {vaultItems.filter((i) => i.pinned).length}
                      </span>
                    </button>

                    {allSubjectsWithCounts.map((grp) => (
                      <button
                        key={grp.subject}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(grp.subject);
                          setSelectedCollectionId('all');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between cursor-pointer ${
                          selectedSubject === grp.subject
                            ? 'bg-[#FC4C01] text-white font-semibold'
                            : 'text-neutral-400 hover:text-current'
                        }`}
                      >
                        <span className="truncate">{grp.subject}</span>
                        <span className="text-[11px]">{grp.totalItems}</span>
                      </button>
                    ))}
                  </div>

                  {/* Agent Memory (per user per agent, capped at 50 entries) */}
                  <div
                    className={`pt-3 border-t space-y-2 ${
                      isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
                        Agent Memory ({sageMemoryFacts.length}/50)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newMemoryFactInput}
                        onChange={(e) => setNewMemoryFactInput(e.target.value)}
                        placeholder='e.g. "Exam on Dec 12"'
                        className={`flex-1 px-2.5 py-1.5 rounded-lg border text-[11px] outline-none ${inputSurface}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newMemoryFactInput.trim()) return;
                          const updated = AgentMemoryStore.addFact('sage', newMemoryFactInput.trim());
                          setSageMemoryFacts(updated);
                          setNewMemoryFactInput('');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#FC4C01] text-white text-[11px] font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    {sageMemoryFacts.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {sageMemoryFacts.slice(0, 12).map((fact, idx) => (
                          <div
                            key={`${fact}_${idx}`}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center justify-between gap-1.5 ${
                              isDark
                                ? 'bg-white/[0.03] border-white/10 text-neutral-300'
                                : 'bg-black/[0.03] border-black/10 text-neutral-700'
                            }`}
                          >
                            <span className="truncate">{fact}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = sageMemoryFacts.filter((_, i) => i !== idx);
                                setSageMemoryFacts(AgentMemoryStore.setFacts('sage', next));
                              }}
                              className="opacity-50 hover:opacity-100 cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className={`pt-3 border-t space-y-2 ${
                      isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                      Data Portability
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExportVault('markdown')}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer text-center ${secondaryBtn}`}
                    >
                      Export Vault (.MD)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportVault('json')}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer text-center ${secondaryBtn}`}
                    >
                      Export Vault (.JSON)
                    </button>
                  </div>
                </div>

                {/* Right Column: Search, Type Filters, Subject -> Chapter Tree & Reader */}
                <div className="md:col-span-9 space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="text"
                        value={vaultSearch}
                        onChange={(e) => setVaultSearch(e.target.value)}
                        placeholder="Search by subject, chapter, lecture title, tags, or timestamps..."
                        className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none ${inputSurface}`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNote(true);
                        setActiveVaultItem(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                    >
                      + New Study Note
                    </button>
                  </div>

                  {/* Filter by Vault Item Type */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                    {(
                      [
                        { id: 'all', label: 'All Types' },
                        { id: 'lecture', label: 'Lectures (YouTube)' },
                        { id: 'note', label: 'Notes' },
                        { id: 'quiz', label: 'Quizzes' },
                        { id: 'flashcard_deck', label: 'Flashcard Decks' },
                        { id: 'research_report', label: 'Research Reports' },
                        { id: 'chat_answer', label: 'Chat Answers' },
                      ] as const
                    ).map((tf) => (
                      <button
                        key={tf.id}
                        type="button"
                        onClick={() => setVaultTypeFilter(tf.id)}
                        className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                          vaultTypeFilter === tf.id
                            ? 'bg-[#FC4C01] text-white border-[#FC4C01] font-semibold'
                            : secondaryBtn
                        }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>

                  {isCreatingNote ? (
                    <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${cardSurface}`}>
                      <div className="text-sm font-semibold">Create Study Note (Sage Auto-Organizes)</div>
                      <input
                        type="text"
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                        placeholder="Note title (e.g. Second Law of Thermodynamics & Entropy)..."
                        className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${inputSurface}`}
                      />
                      <input
                        type="text"
                        value={newNoteTags}
                        onChange={(e) => setNewNoteTags(e.target.value)}
                        placeholder="Tags (comma-separated, optional — Sage will also tag)..."
                        className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${inputSurface}`}
                      />
                      <textarea
                        rows={6}
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Write Markdown notes, formulas ($$...$$), or lecture takeaways..."
                        className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none ${inputSurface}`}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCreatingNote(false)}
                          className="px-3.5 py-1.5 rounded-xl text-neutral-500 hover:text-current cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCustomNote}
                          className="px-4 py-1.5 rounded-xl bg-[#FC4C01] text-white font-semibold cursor-pointer"
                        >
                          Save to Vault
                        </button>
                      </div>
                    </div>
                  ) : activeVaultItem ? (
                    <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${cardSurface}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveVaultItem(null)}
                          className="text-xs text-neutral-500 hover:text-current cursor-pointer font-medium"
                        >
                          ← Back to Vault
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              KnowledgeVaultStore.markReviewed(activeVaultItem.id);
                              onContinueVaultItemInChat(activeVaultItem);
                              onClose();
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold cursor-pointer"
                          >
                            Ask Doubt Buddy in Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              KnowledgeVaultStore.deleteItem(activeVaultItem.id);
                              setActiveVaultItem(null);
                            }}
                            className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer ${secondaryBtn}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-[#FC4C01]/15 border border-[#FC4C01]/35 text-[#FC4C01] font-semibold text-[11px]">
                            {activeVaultItem.subject || 'General Studies'} → {activeVaultItem.chapter || 'Core Concepts'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase opacity-75">
                            {activeVaultItem.type || activeVaultItem.sourceType}
                          </span>
                          {activeVaultItem.sourceUrl && (
                            <a
                              href={activeVaultItem.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[#FC4C01] hover:underline"
                            >
                              <span>Source Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <h3 className="text-base font-bold">{activeVaultItem.title}</h3>
                      </div>

                      {activeVaultItem.sageNote && (
                        <div
                          className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                            isDark
                              ? 'bg-[#141418] border-[#FC4C01]/35 text-neutral-200'
                              : 'bg-[#fffaf7] border-[#FC4C01]/35 text-neutral-800'
                          }`}
                        >
                          <Sparkles className="w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-[#FC4C01] mr-1.5">Sage:</span>
                            <span>{activeVaultItem.sageNote}</span>
                          </div>
                        </div>
                      )}

                      {Array.isArray(activeVaultItem.relatedItemIds) &&
                        activeVaultItem.relatedItemIds.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FC4C01]">
                              <Link2 className="w-3.5 h-3.5" /> Related in your Vault:
                            </span>
                            {activeVaultItem.relatedItemIds.map((rid) => {
                              const linked = vaultItems.find((v) => v.id === rid);
                              if (!linked) return null;
                              return (
                                <button
                                  key={rid}
                                  type="button"
                                  onClick={() => setActiveVaultItem(linked)}
                                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                                    isDark
                                      ? 'bg-white/[0.04] border-white/15 hover:border-[#FC4C01]'
                                      : 'bg-black/[0.03] border-black/15 hover:border-[#FC4C01]'
                                  }`}
                                >
                                  {linked.title} ({linked.subject} → {linked.chapter})
                                </button>
                              );
                            })}
                          </div>
                        )}

                      {Array.isArray(activeVaultItem.timestamps) &&
                        activeVaultItem.timestamps.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-400">
                              <Clock className="w-3 h-3" /> Timestamps:
                            </span>
                            {activeVaultItem.timestamps.slice(0, 10).map((ts, idx) => (
                              <span
                                key={idx}
                                className={`px-2 py-0.5 rounded-md font-mono text-[10px] border ${
                                  isDark
                                    ? 'bg-white/[0.04] border-white/10 text-neutral-300'
                                    : 'bg-black/[0.04] border-black/10 text-neutral-700'
                                }`}
                              >
                                {typeof ts === 'string'
                                  ? ts
                                  : `[${Math.floor((ts.timeSec || 0) / 60)}:${String((ts.timeSec || 0) % 60).padStart(2, '0')}] ${ts.label}`}
                              </span>
                            ))}
                          </div>
                        )}

                      <div
                        className={`p-4 rounded-xl border prose-grok max-w-none text-xs sm:text-sm leading-relaxed overflow-x-auto ${subCardSurface}`}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {normalizeLatexDelimiters(activeVaultItem.content)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ) : groupedVaultBySubjectAndChapter.length === 0 ? (
                    <div className={`p-8 rounded-2xl border text-center space-y-1.5 ${cardSurface}`}>
                      <div className="text-sm font-semibold">Your Vault is empty</div>
                      <p className="text-xs text-neutral-500 max-w-md mx-auto">
                        Click "Save to Vault" on any YouTube Study lecture, Deep Research report, or chat answer — Sage will automatically file it under Subject → Chapter and link related lectures.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5" data-testid="vault-subject-chapter-groups">
                      {groupedVaultBySubjectAndChapter.map((subjectGroup) => (
                        <div
                          key={subjectGroup.subject}
                          className={`p-4 rounded-2xl border space-y-3.5 ${cardSurface}`}
                        >
                          {/* Subject Header */}
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-current/10">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="w-4 h-4 text-[#FC4C01]" />
                              <h3 className="text-sm sm:text-base font-bold tracking-tight">
                                {subjectGroup.subject}
                              </h3>
                            </div>
                            <span className="text-[11px] font-mono text-neutral-500">
                              {subjectGroup.totalItems}{' '}
                              {subjectGroup.totalItems === 1 ? 'item' : 'items'} ·{' '}
                              {subjectGroup.chapters.length}{' '}
                              {subjectGroup.chapters.length === 1 ? 'chapter' : 'chapters'}
                            </span>
                          </div>

                          {/* Chapters inside Subject */}
                          <div className="space-y-4">
                            {subjectGroup.chapters.map((chapterGroup) => (
                              <div key={chapterGroup.chapter} className="space-y-2">
                                <div className="flex items-center gap-2 px-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#FC4C01]" />
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FC4C01]">
                                    {chapterGroup.chapter}
                                  </h4>
                                  <span className="text-[10px] font-mono text-neutral-500">
                                    ({chapterGroup.items.length})
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {chapterGroup.items.map((item) => {
                                    const linkedItems = (item.relatedItemIds || [])
                                      .map((rid) => vaultItems.find((v) => v.id === rid))
                                      .filter(Boolean) as KnowledgeVaultItem[];

                                    const typeLabelMap: Record<string, string> = {
                                      lecture: 'Lecture',
                                      note: 'Note',
                                      personal_note: 'Note',
                                      quiz: 'Quiz',
                                      flashcard_deck: 'Flashcard Deck',
                                      research_report: 'Research Report',
                                      chat_answer: 'Chat Answer',
                                      ai_response: 'Chat Answer',
                                    };
                                    const typeBadge =
                                      typeLabelMap[item.type || item.sourceType] || 'Study Item';

                                    return (
                                      <div
                                        key={item.id}
                                        data-testid={`vault-item-card-${item.id}`}
                                        onClick={() => {
                                          KnowledgeVaultStore.markReviewed(item.id);
                                          setActiveVaultItem(item);
                                        }}
                                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 cursor-pointer transition-all ${
                                          isDark
                                            ? 'bg-[#0e0e11] border-white/[0.08] hover:border-[#FC4C01]/50'
                                            : 'bg-neutral-50/70 border-black/[0.08] hover:border-[#FC4C01]/50'
                                        }`}
                                      >
                                        <div className="space-y-1.5 min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="px-2 py-0.5 rounded bg-[#FC4C01]/15 text-[#FC4C01] font-mono text-[10px] font-bold">
                                              {typeBadge}
                                            </span>
                                            {item.organizingStatus === 'organizing' ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium animate-pulse">
                                                <Sparkles className="w-2.5 h-2.5" />
                                                Sage organizing…
                                              </span>
                                            ) : item.organizedBySage ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#FC4C01]/30 text-[#FC4C01] text-[10px] font-medium">
                                                <Sparkles className="w-2.5 h-2.5" />
                                                Sage organized
                                              </span>
                                            ) : null}
                                            <span className="text-[10.5px] text-neutral-500">
                                              {new Date(item.createdAt).toLocaleDateString()}
                                            </span>
                                          </div>

                                          <h5 className="text-xs sm:text-sm font-semibold truncate">
                                            {item.title}
                                          </h5>

                                          <p
                                            className={`text-xs line-clamp-2 ${
                                              isDark ? 'text-neutral-400' : 'text-neutral-600'
                                            }`}
                                          >
                                            {item.summary}
                                          </p>

                                          {/* Tags & Timestamps */}
                                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                            {(item.tags || []).slice(0, 5).map((tag) => (
                                              <span
                                                key={tag}
                                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                                  isDark
                                                    ? 'bg-white/[0.04] text-neutral-400'
                                                    : 'bg-black/[0.04] text-neutral-600'
                                                }`}
                                              >
                                                #{tag}
                                              </span>
                                            ))}
                                            {Array.isArray(item.timestamps) &&
                                              item.timestamps.length > 0 && (
                                                <span className="text-[10px] font-mono text-[#FC4C01]">
                                                  · {item.timestamps.length} timestamps
                                                </span>
                                              )}
                                          </div>

                                          {/* Linked Related Lectures (Sage) */}
                                          {(linkedItems.length > 0 || item.sageNote) && (
                                            <div
                                              className="pt-1 flex flex-wrap items-center gap-1.5"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {linkedItems.map((li) => (
                                                <button
                                                  key={li.id}
                                                  type="button"
                                                  onClick={() => setActiveVaultItem(li)}
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FC4C01]/10 border border-[#FC4C01]/30 text-[#FC4C01] text-[10.5px] font-medium hover:bg-[#FC4C01]/20 cursor-pointer"
                                                >
                                                  <Link2 className="w-2.5 h-2.5" />
                                                  <span>
                                                    Related to your earlier{' '}
                                                    {li.type === 'lecture' ? 'lecture' : 'item'} on "
                                                    {li.title}"
                                                  </span>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        <div
                                          className="flex items-center gap-1.5 shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              KnowledgeVaultStore.updateItem(item.id, {
                                                pinned: !item.pinned,
                                              });
                                            }}
                                            className={`px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer ${
                                              item.pinned ? primaryBtn : secondaryBtn
                                            }`}
                                          >
                                            {item.pinned ? 'Pinned' : 'Pin'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              KnowledgeVaultStore.markReviewed(item.id);
                                              onContinueVaultItemInChat(item);
                                              onClose();
                                            }}
                                            className={`px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer ${secondaryBtn}`}
                                          >
                                            Study in Chat
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => KnowledgeVaultStore.deleteItem(item.id)}
                                            className="px-2 py-1 rounded-lg text-[11px] text-neutral-500 hover:text-current cursor-pointer"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
                )}
              </div>
            )
          )}

          {/* =========================================================
              TAB 3: WEEKLY INTELLIGENCE BRIEF, MISSIONS & NOTIFICATIONS
             ========================================================= */}
          {activeTab === 'weekly' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Real Weekly Metrics, Level & Optional Missions */}
              <div className="lg:col-span-6 space-y-5">
                <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${cardSurface}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                        7-Day Rolling Window · {weeklyReport.periodLabel}
                      </div>
                      <h3 className="text-sm font-semibold mt-0.5">
                        Your Weekly Kinich Intelligence Report
                      </h3>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        isDark
                          ? 'bg-white/[0.06] border-white/[0.1] text-white'
                          : 'bg-white border-black/[0.1] text-neutral-900'
                      }`}
                    >
                      {weeklyReport.activeDaysCount} Active Days
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className={`p-3.5 rounded-xl border ${subCardSurface}`}>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                        Research
                      </div>
                      <div className="text-lg font-bold mt-0.5 tabular-nums">
                        {weeklyReport.researchSessionsCount}
                      </div>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${subCardSurface}`}>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                        Vault Saved
                      </div>
                      <div className="text-lg font-bold mt-0.5 tabular-nums">
                        {weeklyReport.savedVaultItemsCount}
                      </div>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${subCardSurface}`}>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                        Study / PDF
                      </div>
                      <div className="text-lg font-bold mt-0.5 tabular-nums">
                        {weeklyReport.studyGuidesCount}
                      </div>
                    </div>
                    <div className={`p-3.5 rounded-xl border ${subCardSurface}`}>
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                        Published
                      </div>
                      <div className="text-lg font-bold mt-0.5 tabular-nums">
                        {weeklyReport.publishedArtifactsCount}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kinich Intelligence Level & Optional Missions */}
                <div className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 ${cardSurface}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold">
                        Level {level.level}: {level.name}
                      </div>
                      <div className="text-[11px] text-neutral-500">{level.achievement}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !hideMissionsPanel;
                        setHideMissionsPanel(next);
                        try {
                          localStorage.setItem('kinich_hide_missions_v1', String(next));
                        } catch {}
                      }}
                      className="text-[11px] text-neutral-500 hover:text-current cursor-pointer font-medium"
                    >
                      {hideMissionsPanel ? 'Show Missions' : 'Hide Missions'}
                    </button>
                  </div>

                  {!hideMissionsPanel && (
                    <div className="space-y-2 pt-1">
                      {missions.map((m) => (
                        <div
                          key={m.id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                            m.completed
                              ? isDark
                                ? 'bg-white/[0.07] border-white/[0.18]'
                                : 'bg-white border-black/[0.18]'
                              : subCardSurface
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold flex items-center gap-1.5">
                              <span>{m.completed ? `✓ ${m.title}` : m.title}</span>
                            </div>
                            <div
                              className={`text-[11px] mt-0.5 ${
                                isDark ? 'text-neutral-400' : 'text-neutral-600'
                              }`}
                            >
                              {m.description}
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-semibold tabular-nums shrink-0 px-2.5 py-1 rounded-full ${
                              isDark
                                ? 'bg-white/[0.06] text-neutral-200'
                                : 'bg-neutral-100 text-neutral-800'
                            }`}
                          >
                            +{m.xp} XP
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notification Preferences */}
                <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${cardSurface}`}>
                  <div className="text-xs font-semibold">
                    Reminder & Notification Preferences
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
                        Enable in-workspace continuation reminders
                      </span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.enabled}
                        onChange={(e) => handleUpdateNotifPref({ enabled: e.target.checked })}
                        className="accent-current"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
                        Weekly Intelligence Brief summary ready indicator
                      </span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.weeklyIntelligenceReport}
                        onChange={(e) =>
                          handleUpdateNotifPref({ weeklyIntelligenceReport: e.target.checked })
                        }
                        className="accent-current"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
                        Verified referral milestone notifications
                      </span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.referralMilestones}
                        onChange={(e) =>
                          handleUpdateNotifPref({ referralMilestones: e.target.checked })
                        }
                        className="accent-current"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Shareable Weekly Report Image Card */}
              <div className={`lg:col-span-6 p-4 sm:p-5 rounded-2xl border space-y-3.5 ${cardSurface}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold">Shareable Weekly Brief Card</div>
                  <div className="flex items-center gap-2.5">
                    <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeTopicsOnWeeklyCard}
                        onChange={(e) => setIncludeTopicsOnWeeklyCard(e.target.checked)}
                        className="accent-current"
                      />
                      <span>Include domain keywords</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        downloadWeeklyReportCardPng({
                          periodLabel: weeklyReport.periodLabel,
                          conversationsCount: weeklyReport.conversationsCount,
                          researchSessionsCount: weeklyReport.researchSessionsCount,
                          savedVaultItemsCount: weeklyReport.savedVaultItemsCount,
                          studyGuidesCount: weeklyReport.studyGuidesCount,
                          publishedArtifactsCount: weeklyReport.publishedArtifactsCount,
                          activeDaysCount: weeklyReport.activeDaysCount,
                          levelName: level.name,
                          topTopics: weeklyReport.topTopics,
                          includeTopics: includeTopicsOnWeeklyCard,
                          theme: weeklyCardTheme,
                        });
                        trackGrowthEvent('share_card_created', { type: 'weekly_report' });
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
                    >
                      Download Card
                    </button>
                  </div>
                </div>

                <div className="flex justify-center">
                  <canvas
                    ref={weeklyCanvasRef}
                    className="w-full max-w-[440px] h-auto rounded-xl border border-white/10"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 4: 8-REFERRAL TRACKER & REWARD CLAIMER (ZERO SLOP)
             ========================================================= */}
          {activeTab === 'passes' && (
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Main 8-Referral Tracker & Link Card */}
              <div className={`p-5 rounded-2xl border space-y-4 ${cardSurface}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                      8-Referral Reward Tracker
                    </div>
                    <h3 className="text-base font-semibold mt-0.5">
                      Invite 8 Friends · Unlock Free Messages, Uploads & Study Quizzes
                    </h3>
                    <p
                      className={`text-xs mt-1 leading-relaxed ${
                        isDark ? 'text-neutral-400' : 'text-neutral-600'
                      }`}
                    >
                      Every friend you invite unlocks free AI messages, file/PDF uploads, Study Space quizzes, and Deep Research runs.
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold font-mono tabular-nums text-[#FC4C01]">
                      {Math.min(eightRefState.count, 8)} / 8
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
                      Referrals Completed
                    </div>
                  </div>
                </div>

                {/* 8-Step Segmented Progress Bar */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-8 gap-1.5">
                    {Array.from({ length: 8 }).map((_, idx) => {
                      const stepNum = idx + 1;
                      const isDone = eightRefState.count >= stepNum;
                      return (
                        <div
                          key={stepNum}
                          className={`h-2.5 rounded-full transition-all ${
                            isDone
                              ? 'bg-[#FC4C01]'
                              : isDark
                              ? 'bg-white/[0.08]'
                              : 'bg-black/[0.08]'
                          }`}
                          title={`Referral ${stepNum} of 8`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                    <span>0 Referrals</span>
                    <span>
                      {eightRefState.count >= 8
                        ? 'All 8 Referrals Reached!'
                        : `${Math.max(0, 8 - eightRefState.count)} more for Jackpot Drop`}
                    </span>
                    <span>8 Referrals</span>
                  </div>
                </div>

                {/* Invite Link Copy & Share Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div
                    className={`flex-1 p-2.5 rounded-xl border flex items-center gap-2 ${subCardSurface}`}
                  >
                    <input
                      type="text"
                      readOnly
                      value={dashboardData?.link || referralStatus?.referralUrl || eightRefState.inviteUrl}
                      className="flex-1 bg-transparent font-mono text-xs outline-none truncate px-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = dashboardData?.link || referralStatus?.referralUrl || eightRefState.inviteUrl;
                        navigator.clipboard.writeText(url);
                        setCopiedRefLink(true);
                        trackGrowthEvent('share_action_initiated', { surface: 'referral_link' });
                        setTimeout(() => setCopiedRefLink(false), 2000);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 ${primaryBtn}`}
                    >
                      {copiedRefLink ? 'Copied ✓' : 'Copy Invite Link'}
                    </button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = dashboardData?.link || referralStatus?.referralUrl || eightRefState.inviteUrl;
                          const code = dashboardData?.code || referralStatus?.code || eightRefState.code;
                          navigator.share({
                            title: 'Join me on Kinich',
                            text: `Explore research, AI models, and YouTube study tools on Kinich with my invite code: ${code}`,
                            url,
                          }).catch(() => {});
                        }}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-300 transition-colors"
                      >
                        Share ↗
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Real Referral Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-3 rounded-xl border text-center ${subCardSurface}`}>
                    <div className="text-lg font-bold font-mono text-[#FC4C01] tabular-nums">
                      {dashboardData?.stats?.invited ?? referralStatus?.validatedSignupsCount ?? 0}
                    </div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium mt-0.5">
                      Invited
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl border text-center ${subCardSurface}`}>
                    <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                      {dashboardData?.stats?.qualified ?? referralStatus?.qualifiedActionsCount ?? 0}
                    </div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium mt-0.5">
                      Qualified
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl border text-center ${subCardSurface}`}>
                    <div className="text-lg font-bold font-mono text-cyan-400 tabular-nums">
                      {dashboardData?.stats?.rewarded ?? (dashboardData?.rewards?.length || 0)}
                    </div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium mt-0.5">
                      Rewards
                    </div>
                  </div>
                </div>

                {/* Rewards Ledger History (if any recorded in DB) */}
                {dashboardData?.rewards && dashboardData.rewards.length > 0 && (
                  <div className={`p-3 rounded-xl border space-y-2 ${subCardSurface}`}>
                    <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider text-[10px]">
                      Earned Rewards Ledger
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {dashboardData.rewards.map((rw) => (
                        <div
                          key={rw.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-neutral-500/5 border border-neutral-500/10 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-semibold font-mono">
                              +{rw.amount} Searches
                            </span>
                            {rw.days > 0 && (
                              <span className="text-cyan-400 font-mono text-[11px]">
                                · +{rw.days}d Pro
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {new Date(rw.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Redeem Friend Pass Code */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${subCardSurface}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">Have a friend's Kinich Pass code?</span>
                    <span className="text-[11px] font-mono text-neutral-500">
                      Your Code: {referralStatus?.code || eightRefState.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={claimPassInput}
                      onChange={(e) => setClaimPassInput(e.target.value)}
                      placeholder="Enter pass code (e.g. zp_98124)"
                      className={`flex-1 px-3 py-1.5 rounded-lg border font-mono text-xs outline-none ${inputSurface}`}
                    />
                    <button
                      type="button"
                      disabled={claimingPass || !claimPassInput.trim()}
                      onClick={async () => {
                        setClaimingPass(true);
                        setClaimPassFeedback(null);
                        try {
                          const res = await claimReferralCodeManual(claimPassInput);
                          setClaimPassFeedback(res);
                          if (res.ok) {
                            const updated = addOneReferralProgress();
                            setEightRefState(updated);
                            setClaimPassInput('');
                          }
                        } finally {
                          setClaimingPass(false);
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 ${primaryBtn}`}
                    >
                      {claimingPass ? 'Verifying…' : 'Redeem Code'}
                    </button>
                  </div>
                  {claimPassFeedback && (
                    <div className="text-[11px] font-medium text-[#FC4C01]">
                      {claimPassFeedback.message}
                    </div>
                  )}
                </div>
              </div>

              {bonusClaimNotice && (
                <div className="px-4 py-3 rounded-xl border border-[#FC4C01]/40 bg-[#FC4C01]/10 text-xs font-medium flex items-center justify-between gap-2">
                  <span>{bonusClaimNotice}</span>
                  <button
                    type="button"
                    onClick={() => setBonusClaimNotice(null)}
                    className="text-[11px] opacity-75 hover:opacity-100 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* 4 Milestone Reward Tiers up to 8 Referrals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {REFERRAL_8_REWARD_TIERS.map((tier) => {
                  const isClaimed = eightRefState.claimedTiers.includes(tier.targetReferrals);
                  const isUnlocked = eightRefState.count >= tier.targetReferrals;

                  return (
                    <div
                      key={tier.targetReferrals}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-colors ${
                        isClaimed
                          ? subCardSurface
                          : isUnlocked
                          ? 'border-[#FC4C01]/50 bg-[#FC4C01]/[0.06]'
                          : cardSurface
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{tier.title}</span>
                          <span className="text-[11px] font-mono tabular-nums text-[#FC4C01] font-semibold">
                            {Math.min(eightRefState.count, tier.targetReferrals)}/{tier.targetReferrals} Refs
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500">{tier.subtitle}</div>
                        <div className="pt-1 text-[11px] font-mono text-[#FC4C01] space-x-2">
                          <span>+{tier.bonusMessages} Msgs</span>
                          <span>·</span>
                          <span>+{tier.bonusUploads} Uploads</span>
                          <span>·</span>
                          <span>+{tier.bonusQuizzes} Quizzes</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-500/10 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-neutral-500">
                          +{tier.bonusDeepResearch} Deep Research
                        </span>

                        {isClaimed ? (
                          <span className="text-xs font-mono font-semibold text-emerald-500">
                            Claimed ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const res = claimEightReferralTier(tier.targetReferrals);
                              setEightRefState(res.state);
                              setBonusClaimNotice(res.message);
                              setTimeout(() => setBonusClaimNotice(null), 4500);
                            }}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                              isUnlocked
                                ? 'bg-[#FC4C01] hover:bg-[#e04300] text-white'
                                : primaryBtn
                            }`}
                          >
                            {isUnlocked ? 'Claim Reward' : `Claim (+${tier.bonusMessages} Msgs)`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 5: FEEDBACK & SUGGESTIONS STUDIO (CLEAN MONOCHROME)
             ========================================================= */}
          {activeTab === 'feedback' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Submit Feedback Form */}
              <div className={`lg:col-span-7 p-4 sm:p-6 rounded-2xl border space-y-5 ${cardSurface}`}>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                    Product Feedback
                  </div>
                  <h3 className="text-base font-semibold mt-0.5">
                    Help Shape Kinich Research & Learning
                  </h3>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      isDark ? 'text-neutral-400' : 'text-neutral-600'
                    }`}
                  >
                    Report bugs, request models, or suggest improvements to Study Studio and Deep Research.
                  </p>
                </div>

                {/* Category Selector — clean text pills without emojis */}
                <div className="space-y-2">
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                    1. Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'feature', label: 'Feature Request' },
                        { id: 'bug', label: 'Bug / Issue' },
                        { id: 'model_quality', label: 'Model Quality' },
                        { id: 'research_tools', label: 'Study & PDF Tools' },
                        { id: 'ui_ux', label: 'UI & Design' },
                        { id: 'praise', label: 'General Praise' },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFeedbackCategory(cat.id)}
                        className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium text-left transition-colors cursor-pointer ${
                          feedbackCategory === cat.id
                            ? isDark
                              ? 'bg-white text-black border-white font-semibold'
                              : 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                            : subCardSurface
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Experience Rating — clean monochrome numbered pills */}
                <div className="space-y-2">
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                    2. Experience Rating
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setFeedbackRating(score)}
                        className={`w-10 h-9 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          feedbackRating === score
                            ? isDark
                              ? 'bg-white text-black border-white'
                              : 'bg-neutral-900 text-white border-neutral-900'
                            : subCardSurface
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                    <span className="text-xs text-neutral-500 ml-1">
                      {feedbackRating === 5
                        ? 'Exceptional'
                        : feedbackRating === 4
                        ? 'Very Good'
                        : feedbackRating === 3
                        ? 'Solid'
                        : feedbackRating === 2
                        ? 'Needs Polish'
                        : 'Critical Issue'}
                    </span>
                  </div>
                </div>

                {/* Subject & Detailed Message */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1.5">
                      Subject (Optional)
                    </label>
                    <input
                      type="text"
                      value={feedbackSubject}
                      onChange={(e) => setFeedbackSubject(e.target.value)}
                      maxLength={140}
                      placeholder="Short summary..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none ${inputSurface}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-500 mb-1.5">
                      Detailed Feedback
                    </label>
                    <textarea
                      rows={5}
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      maxLength={2400}
                      placeholder="Share what worked well, what felt slow or confusing, or what you'd like to see next..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none leading-relaxed ${inputSurface}`}
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 pt-1 cursor-pointer">
                  <span className={`text-xs ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                    Include anonymous workspace context
                  </span>
                  <input
                    type="checkbox"
                    checked={feedbackIncludeDiag}
                    onChange={(e) => setFeedbackIncludeDiag(e.target.checked)}
                    className="accent-current"
                  />
                </label>

                {feedbackError && (
                  <div className={`p-3 rounded-xl border text-xs ${subCardSurface}`}>
                    {feedbackError}
                  </div>
                )}

                {feedbackToast && (
                  <div className={`p-3 rounded-xl border text-xs font-medium ${subCardSurface}`}>
                    {feedbackToast}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-neutral-500">
                    Dispatched securely via Kinich backend relay.
                  </span>
                  <button
                    type="button"
                    disabled={submittingFeedback || feedbackMessage.trim().length < 4}
                    onClick={async () => {
                      setSubmittingFeedback(true);
                      setFeedbackError(null);
                      setFeedbackToast(null);
                      try {
                        const sub = UserAccountStore.getSubscription();
                        const diag = feedbackIncludeDiag
                          ? `Plan: ${sub.plan} | Level: ${level.level} (${level.name}) | Threads: ${threads.length}`
                          : undefined;
                        const res = await submitKinichFeedback({
                          category: feedbackCategory,
                          rating: feedbackRating,
                          subject: feedbackSubject,
                          message: feedbackMessage,
                          includeDiagnostics: feedbackIncludeDiag,
                          diagnosticsSummary: diag,
                        });
                        if (!res.ok) {
                          setFeedbackError(res.error || 'Could not submit feedback.');
                        } else {
                          setFeedbackSubject('');
                          setFeedbackMessage('');
                          setFeedbackToast('Thank you. Your feedback has been received.');
                          const updatedHistory = await fetchMySubmittedFeedback();
                          setMyFeedbackHistory(updatedHistory);
                        }
                      } finally {
                        setSubmittingFeedback(false);
                      }
                    }}
                    className={`px-5 py-2.5 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-40 text-center shrink-0 ${primaryBtn}`}
                  >
                    {submittingFeedback ? 'Sending…' : 'Submit Feedback'}
                  </button>
                </div>
              </div>

              {/* Right 5 Cols: Submitted Feedback Log */}
              <div className={`lg:col-span-5 p-4 sm:p-6 rounded-2xl border space-y-4 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
                      Submission Log
                    </div>
                    <h3 className="text-sm font-semibold mt-0.5">Your Recent Feedback</h3>
                  </div>
                  <span className="text-xs text-neutral-500 tabular-nums">
                    {myFeedbackHistory.length} sent
                  </span>
                </div>

                {myFeedbackHistory.length === 0 ? (
                  <div className={`p-6 rounded-xl border text-center space-y-1 ${subCardSurface}`}>
                    <div className="text-xs font-semibold">No feedback submitted yet</div>
                    <p className="text-[11px] text-neutral-500">
                      Share your first feature idea or bug report using the form.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {myFeedbackHistory.map((fb) => (
                      <div key={fb.id} className={`p-3.5 rounded-xl border space-y-1.5 ${subCardSurface}`}>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-500 uppercase">
                          <span>
                            {fb.category.replace('_', ' ')} · Rating {fb.rating}/5
                          </span>
                          <span>Received</span>
                        </div>
                        {fb.subject && <div className="text-xs font-semibold">{fb.subject}</div>}
                        <p
                          className={`text-xs whitespace-pre-wrap leading-relaxed ${
                            isDark ? 'text-neutral-300' : 'text-neutral-700'
                          }`}
                        >
                          {fb.message}
                        </p>
                        <div className="text-[10px] text-neutral-500 pt-1">
                          {new Date(fb.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
