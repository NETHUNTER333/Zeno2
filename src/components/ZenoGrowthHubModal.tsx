import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  DiscoverCategory,
  PublicArtifact,
  KnowledgeVaultItem,
  KnowledgeCollection,
  ZenoReferralStatus,
  CreatorPublicProfile,
  ZenoNotificationPreferences,
  EliteReferrerLeaderboardEntry,
  TopContributorEntry,
  ZenoFeedbackCategory,
  ZenoFeedbackSubmission,
} from '../types';
import {
  DISCOVER_CATEGORIES,
  fetchDiscoverArtifacts,
  KnowledgeVaultStore,
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
  submitZenoFeedback,
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

export interface ZenoGrowthHubModalProps {
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
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n$$${inner.trim()}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
}

export const ZenoGrowthHubModal: React.FC<ZenoGrowthHubModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'discover',
  threads,
  onOpenArtifactPage,
  onForkArtifactIntoChat,
  onContinueVaultItemInChat,
  isDark = true,
}) => {
  const [activeTab, setActiveTab] = useState<GrowthHubTab>(initialTab);

  // --- TAB 1: DISCOVER STATE ---
  const [discoverItems, setDiscoverItems] = useState<PublicArtifact[]>([]);
  const [discoverTotal, setDiscoverTotal] = useState<number>(0);
  const [discoverLoading, setDiscoverLoading] = useState<boolean>(false);
  const [discoverCategory, setDiscoverCategory] = useState<DiscoverCategory | 'All'>('All');
  const [discoverQuery, setDiscoverQuery] = useState<string>('');
  const [discoverSort, setDiscoverSort] = useState<'recent' | 'saved' | 'views'>('recent');

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

  // --- TAB 3: WEEKLY BRIEF, MISSIONS & NOTIFICATIONS ---
  const [includeTopicsOnWeeklyCard, setIncludeTopicsOnWeeklyCard] = useState<boolean>(false);
  const [weeklyCardTheme] = useState<ShareCardTheme>('carbon');
  const weeklyCanvasRef = useRef<HTMLCanvasElement>(null);
  const [notifPrefs, setNotifPrefs] = useState<ZenoNotificationPreferences>(() =>
    getNotificationPreferences()
  );
  const [hideMissionsPanel, setHideMissionsPanel] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zeno_hide_missions_v1') === 'true';
    } catch {
      return false;
    }
  });

  // --- TAB 4: ZENO PASSES (REFERRALS) & CREATOR PROFILE ---
  const [referralStatus, setReferralStatus] = useState<ZenoReferralStatus | null>(null);
  const [dashboardData, setDashboardData] = useState<ReferralDashboardResponse | null>(null);
  const [copiedRefLink, setCopiedRefLink] = useState<boolean>(false);
  const [creatorProfile, setCreatorProfile] = useState<CreatorPublicProfile>(() => {
    const p = UserAccountStore.getProfile();
    return {
      uid: auth.currentUser?.uid || 'local',
      displayName: p.displayName || 'Zeno Researcher',
      username: p.username || 'zeno_researcher',
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
  const [feedbackCategory, setFeedbackCategory] = useState<ZenoFeedbackCategory>('feature');
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackSubject, setFeedbackSubject] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackIncludeDiag, setFeedbackIncludeDiag] = useState<boolean>(true);
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [myFeedbackHistory, setMyFeedbackHistory] = useState<ZenoFeedbackSubmission[]>([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setVaultItems(KnowledgeVaultStore.getItems());
      setCollections(KnowledgeVaultStore.getCollections());
      KnowledgeVaultStore.syncFromCloud().then((synced) => {
        setVaultItems(synced);
      });
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const syncVault = () => {
      setVaultItems(KnowledgeVaultStore.getItems());
      setCollections(KnowledgeVaultStore.getCollections());
    };
    window.addEventListener('zeno-vault-updated', syncVault);
    return () => window.removeEventListener('zeno-vault-updated', syncVault);
  }, []);

  // Load Discover items when Discover tab or filters change
  useEffect(() => {
    if (!isOpen || activeTab !== 'discover') return;
    let cancelled = false;
    setDiscoverLoading(true);
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
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, discoverCategory, discoverQuery, discoverSort]);

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
    const q = vaultSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.content.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [vaultItems, selectedCollectionId, vaultSearch]);

  if (!isOpen) return null;

  const handleCreateCustomNote = () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    const targetCol =
      selectedCollectionId !== 'all' && selectedCollectionId !== 'pinned'
        ? selectedCollectionId
        : 'col_explanations';
    const created = KnowledgeVaultStore.saveItem({
      title: newNoteTitle.trim(),
      summary: newNoteContent.trim().slice(0, 200),
      content: newNoteContent.trim(),
      type: 'personal_note',
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
    a.download = `zeno-knowledge-vault.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpdateNotifPref = (patch: Partial<ZenoNotificationPreferences>) => {
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
            Zeno Workspace Hub
          </h2>
          <p className="text-[11px] text-neutral-500 truncate hidden sm:block">
            Community Research · Knowledge Vault · Weekly Brief · Zeno Passes
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

      {/* Navigation Tabs — clean monochrome pills, zero icons */}
      <div
        className={`px-4 sm:px-6 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 ${
          isDark ? 'bg-[#09090b] border-white/[0.08]' : 'bg-white border-black/[0.08]'
        }`}
      >
        {(
          [
            { id: 'discover', label: 'Discover' },
            { id: 'vault', label: `Knowledge Vault (${vaultItems.length})` },
            { id: 'weekly', label: 'Weekly Brief' },
            { id: 'passes', label: 'Referrals (8x Rewards)' },
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
              TAB 1: ZENO DISCOVER (PUBLIC COMMUNITY LIBRARY)
             ========================================================= */}
          {activeTab === 'discover' && (
            <div className="space-y-4">
              {/* Search & Sort Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={discoverQuery}
                    onChange={(e) => setDiscoverQuery(e.target.value)}
                    placeholder="Search study guides, research syntheses, workflows, and tags..."
                    className={`w-full pl-9 pr-4 py-2 rounded-full border text-xs outline-none ${inputSurface}`}
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-neutral-500 mr-1">Sort:</span>
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
                      className={`px-3 py-1.5 rounded-full border text-[11px] font-medium cursor-pointer transition-colors ${
                        discoverSort === s.id
                          ? isDark
                            ? 'bg-white text-black border-white font-semibold'
                            : 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                          : secondaryBtn
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {(['All', ...DISCOVER_CATEGORIES] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDiscoverCategory(cat)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      discoverCategory === cat
                        ? isDark
                          ? 'bg-white/[0.14] border-white/40 text-white font-semibold'
                          : 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                        : secondaryBtn
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Results Grid */}
              {discoverLoading ? (
                <div className="py-12 text-center text-neutral-500">
                  Loading public Zeno library…
                </div>
              ) : discoverItems.length === 0 ? (
                <div className={`p-8 rounded-2xl border text-center space-y-1.5 ${cardSurface}`}>
                  <div className="text-sm font-semibold">No matching public resources found</div>
                  <p className="text-xs text-neutral-500">
                    Try clearing your search query or switching to another category.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {discoverItems.map((item) => {
                    const isSaved = KnowledgeVaultStore.isArtifactBookmarked(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between gap-3.5 transition-colors ${cardSurface}`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                                isDark
                                  ? 'bg-white/[0.06] text-neutral-300'
                                  : 'bg-neutral-200/70 text-neutral-700'
                              }`}
                            >
                              {item.category}
                            </span>

                            <div className="flex items-center gap-3 text-[11px] text-neutral-500">
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
                                className={`cursor-pointer font-medium transition-colors ${
                                  isSaved
                                    ? isDark
                                      ? 'text-white underline'
                                      : 'text-black underline'
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
                            className="text-sm font-semibold leading-snug hover:underline cursor-pointer"
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
                            isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'
                          }`}
                        >
                          <div className="flex flex-wrap gap-1 min-w-0">
                            {item.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className={`text-[10px] px-2 py-0.5 rounded-full ${
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
                                trackGrowthEvent('discover_resource_opened', {
                                  artifactId: item.id,
                                  category: item.category,
                                });
                                onOpenArtifactPage(item);
                              }}
                              className={`px-3 py-1.5 rounded-full border text-[11px] font-medium cursor-pointer ${secondaryBtn}`}
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
                              className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${primaryBtn}`}
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

              <div className="text-[11px] text-neutral-500 flex flex-wrap items-center justify-between gap-2 pt-1">
                <span>
                  Showing {discoverItems.length} of {discoverTotal} verified public resources
                </span>
                <span>Private conversations and notes never appear in Discover.</span>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: PERSONAL KNOWLEDGE VAULT
             ========================================================= */}
          {activeTab === 'vault' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Rail: Collections & Export */}
              <div className="md:col-span-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                    Collections
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewCollectionInput((v) => !v)}
                    className="text-[11px] text-neutral-500 hover:text-current cursor-pointer font-medium"
                  >
                    + New
                  </button>
                </div>

                {showNewCollectionInput && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Collection name…"
                      className={`flex-1 px-3 py-1.5 rounded-full border text-xs outline-none ${inputSurface}`}
                    />
                    <button
                      type="button"
                      onClick={handleAddCollection}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
                    >
                      Add
                    </button>
                  </div>
                )}

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCollectionId('all')}
                    className={`w-full text-left px-3.5 py-2 rounded-full text-xs font-medium flex items-center justify-between cursor-pointer ${
                      selectedCollectionId === 'all'
                        ? primaryBtn
                        : 'text-neutral-500 hover:text-current'
                    }`}
                  >
                    <span>All Saved Knowledge</span>
                    <span className="text-[11px]">{vaultItems.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCollectionId('pinned')}
                    className={`w-full text-left px-3.5 py-2 rounded-full text-xs font-medium flex items-center justify-between cursor-pointer ${
                      selectedCollectionId === 'pinned'
                        ? primaryBtn
                        : 'text-neutral-500 hover:text-current'
                    }`}
                  >
                    <span>Pinned Insights</span>
                    <span className="text-[11px]">
                      {vaultItems.filter((i) => i.pinned).length}
                    </span>
                  </button>

                  {collections.map((col) => {
                    const count = vaultItems.filter((i) => i.collectionId === col.id).length;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setSelectedCollectionId(col.id)}
                        className={`w-full text-left px-3.5 py-2 rounded-full text-xs font-medium flex items-center justify-between cursor-pointer ${
                          selectedCollectionId === col.id
                            ? primaryBtn
                            : 'text-neutral-500 hover:text-current'
                        }`}
                      >
                        <span className="truncate">{col.name}</span>
                        <span className="text-[11px]">{count}</span>
                      </button>
                    );
                  })}
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
                    className={`w-full px-3 py-2 rounded-full border text-xs font-medium cursor-pointer text-center ${secondaryBtn}`}
                  >
                    Export Vault (.MD)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportVault('json')}
                    className={`w-full px-3 py-2 rounded-full border text-xs font-medium cursor-pointer text-center ${secondaryBtn}`}
                  >
                    Export Vault (.JSON)
                  </button>
                </div>
              </div>

              {/* Right Column: Search, List & Reader/Editor */}
              <div className="md:col-span-9 space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={vaultSearch}
                      onChange={(e) => setVaultSearch(e.target.value)}
                      placeholder="Search your private saved answers, notes, tags, and citations..."
                      className={`w-full pl-9 pr-4 py-2 rounded-full border text-xs outline-none ${inputSurface}`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNote(true);
                      setActiveVaultItem(null);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer shrink-0 ${primaryBtn}`}
                  >
                    + New Research Note
                  </button>
                </div>

                {isCreatingNote ? (
                  <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${cardSurface}`}>
                    <div className="text-sm font-semibold">Create Private Research Note</div>
                    <input
                      type="text"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      placeholder="Note title..."
                      className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${inputSurface}`}
                    />
                    <input
                      type="text"
                      value={newNoteTags}
                      onChange={(e) => setNewNoteTags(e.target.value)}
                      placeholder="Tags (comma-separated)..."
                      className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${inputSurface}`}
                    />
                    <textarea
                      rows={6}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Write Markdown notes, LaTeX formulas ($...$), or key takeaways..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none ${inputSurface}`}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingNote(false)}
                        className="px-3.5 py-1.5 rounded-full text-neutral-500 hover:text-current cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateCustomNote}
                        className={`px-4 py-1.5 rounded-full font-semibold cursor-pointer ${primaryBtn}`}
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
                            onContinueVaultItemInChat(activeVaultItem);
                            onClose();
                          }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${primaryBtn}`}
                        >
                          Continue in Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            KnowledgeVaultStore.deleteItem(activeVaultItem.id);
                            setActiveVaultItem(null);
                          }}
                          className={`px-3 py-1.5 rounded-full border text-xs cursor-pointer ${secondaryBtn}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-semibold">{activeVaultItem.title}</h3>
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                      {collections.map((c) => {
                        const isSelected = activeVaultItem.collectionId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              const updated = KnowledgeVaultStore.updateItem(activeVaultItem.id, {
                                collectionId: c.id,
                              });
                              if (updated) setActiveVaultItem(updated);
                            }}
                            className={`px-2.5 py-1 rounded-full border text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                              isSelected ? primaryBtn : secondaryBtn
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                      {activeVaultItem.tags.map((t) => (
                        <span
                          key={t}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] shrink-0 ${
                            isDark
                              ? 'bg-white/[0.06] text-neutral-300'
                              : 'bg-black/[0.06] text-neutral-700'
                          }`}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div
                      className={`p-4 rounded-xl border prose-grok max-w-none text-xs sm:text-sm leading-relaxed overflow-x-auto ${subCardSurface}`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {normalizeLatexDelimiters(activeVaultItem.content)}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : filteredVaultItems.length === 0 ? (
                  <div className={`p-8 rounded-2xl border text-center space-y-1.5 ${cardSurface}`}>
                    <div className="text-sm font-semibold">Your Knowledge Vault is empty</div>
                    <p className="text-xs text-neutral-500 max-w-md mx-auto">
                      Save any response in chat, bookmark resources from Discover, or create a private note above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredVaultItems.map((item) => {
                      const colName =
                        collections.find((c) => c.id === item.collectionId)?.name || 'Saved';
                      return (
                        <div
                          key={item.id}
                          onClick={() => setActiveVaultItem(item)}
                          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 cursor-pointer transition-colors ${cardSurface}`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  isDark
                                    ? 'bg-white/[0.06] text-neutral-300'
                                    : 'bg-black/[0.06] text-neutral-700'
                                }`}
                              >
                                {colName}
                              </span>
                              <span className="text-[11px] text-neutral-500">
                                {new Date(item.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold truncate">{item.title}</h4>
                            <p
                              className={`text-xs line-clamp-2 ${
                                isDark ? 'text-neutral-400' : 'text-neutral-600'
                              }`}
                            >
                              {item.summary}
                            </p>
                          </div>

                          <div
                            className="flex items-center gap-1.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                KnowledgeVaultStore.updateItem(item.id, { pinned: !item.pinned });
                              }}
                              className={`px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${
                                item.pinned ? primaryBtn : secondaryBtn
                              }`}
                            >
                              {item.pinned ? 'Pinned' : 'Pin'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onContinueVaultItemInChat(item);
                                onClose();
                              }}
                              className={`px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${secondaryBtn}`}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => KnowledgeVaultStore.deleteItem(item.id)}
                              className="px-2 py-1 rounded-full text-[11px] text-neutral-500 hover:text-current cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
                        Your Weekly Zeno Intelligence Report
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

                {/* Zeno Intelligence Level & Optional Missions */}
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
                          localStorage.setItem('zeno_hide_missions_v1', String(next));
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
                            title: 'Join me on Zeno',
                            text: `Explore research, AI models, and YouTube study tools on Zeno with my invite code: ${code}`,
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
                    <span className="text-xs font-semibold">Have a friend's Zeno Pass code?</span>
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
                          const updated = addOneReferralProgress();
                          setEightRefState(updated);
                          if (res.ok) {
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
                    Help Shape Zeno Research & Learning
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
                    Dispatched securely via Zeno backend relay.
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
                        const res = await submitZenoFeedback({
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
