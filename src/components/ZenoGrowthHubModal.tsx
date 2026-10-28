import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Compass,
  Bookmark,
  BarChart3,
  Share2,
  Search,
  Plus,
  Pin,
  Trash2,
  Download,
  ExternalLink,
  GitFork,
  Check,
  Copy,
  Globe,
  Lock,
  FolderPlus,
  Bell,
  Award,
  UserCheck,
  Eye,
  FileText,
} from 'lucide-react';
import {
  DiscoverCategory,
  PublicArtifact,
  KnowledgeVaultItem,
  KnowledgeCollection,
  ZenoReferralStatus,
  CreatorPublicProfile,
  ZenoNotificationPreferences,
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
} from '../lib/growthStore';
import {
  renderWeeklyReportCardToCanvas,
  downloadWeeklyReportCardPng,
  ShareCardTheme,
} from '../lib/exportChat';
import { ChatThread } from './Sidebar';
import { auth } from '../lib/firebase';
import { UserAccountStore } from '../lib/userAccountStore';

export type GrowthHubTab = 'discover' | 'vault' | 'weekly' | 'passes';

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
  const [weeklyCardTheme, setWeeklyCardTheme] = useState<ShareCardTheme>('carbon');
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

  // Load Referral Status & Creator Profile when Passes tab opens
  useEffect(() => {
    if (!isOpen || activeTab !== 'passes') return;
    fetchMyReferralStatus().then((st) => {
      if (st) setReferralStatus(st);
    });
    const uid = auth.currentUser?.uid;
    if (uid) {
      fetchCreatorPublicProfile(uid).then((res) => {
        if (res?.profile) {
          setCreatorProfile(res.profile);
        }
      });
    }
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

  // Render Weekly Report Canvas when Weekly tab is active
  useEffect(() => {
    if (!isOpen || activeTab !== 'weekly') return;
    trackGrowthEvent('weekly_report_viewed');
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

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden animate-in fade-in duration-150 ${
        isDark
          ? 'bg-[#0b0c10] text-white'
          : 'bg-white text-slate-900'
      }`}
    >
      {/* Top Header */}
      <div
        className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-4 shrink-0 ${
          isDark ? 'border-[#1c2029] bg-[#0f1117]' : 'border-slate-200 bg-slate-50'
        }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <h2 className="text-sm sm:text-base font-semibold tracking-tight">
                Zeno Knowledge, Discovery & Growth Hub
              </h2>
              <p className="text-[11px] text-neutral-400 truncate">
                Curated Community Research · Personal Knowledge Vault · Weekly Intelligence Brief · Zeno Passes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border ${
                isDark
                  ? 'bg-white/[0.04] border-white/10 text-neutral-300'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <span>Tier {level.level}:</span>
              <strong className="font-semibold">{level.name}</strong>
              <span className="opacity-60">({level.xp} XP)</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'hover:bg-white/10 text-neutral-400 hover:text-white'
                  : 'hover:bg-slate-200 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`px-5 py-2 border-b flex items-center gap-1.5 overflow-x-auto scrollbar-none ${
            isDark ? 'bg-[#11131a] border-[#1c2029]' : 'bg-slate-100/70 border-slate-200'
          }`}
        >
          {(
            [
              { id: 'discover', label: 'Zeno Discover', icon: Compass },
              {
                id: 'vault',
                label: `Knowledge Vault (${vaultItems.length})`,
                icon: Bookmark,
              },
              { id: 'weekly', label: 'Weekly Brief & Missions', icon: BarChart3 },
              { id: 'passes', label: 'Zeno Passes & Creator Profile', icon: Share2 },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === t.id
                    ? isDark
                      ? 'bg-white text-black'
                      : 'bg-slate-900 text-white'
                    : isDark
                    ? 'text-neutral-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Viewport */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {/* =========================================================
              TAB 1: ZENO DISCOVER (PUBLIC COMMUNITY LIBRARY)
             ========================================================= */}
          {activeTab === 'discover' && (
            <div className="space-y-4">
              {/* Search & Sort Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={discoverQuery}
                    onChange={(e) => setDiscoverQuery(e.target.value)}
                    placeholder="Search study guides, research syntheses, workflows, and tags..."
                    className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none ${
                      isDark
                        ? 'bg-[#12151e] border-[#242938] text-white placeholder-neutral-500 focus:border-white/30'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-neutral-400">Sort:</span>
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
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer ${
                        discoverSort === s.id
                          ? isDark
                            ? 'bg-white text-black border-white'
                            : 'bg-slate-900 text-white border-slate-900'
                          : isDark
                          ? 'bg-[#12151e] border-[#242938] text-neutral-400 hover:text-white'
                          : 'bg-white border-slate-200 text-slate-600'
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
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      discoverCategory === cat
                        ? isDark
                          ? 'bg-white/15 border-white/40 text-white'
                          : 'bg-slate-900 text-white border-slate-900'
                        : isDark
                        ? 'bg-[#11131a] border-[#222634] text-neutral-400 hover:text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Results Grid */}
              {discoverLoading ? (
                <div className="py-12 text-center text-neutral-400">
                  Loading public Zeno library…
                </div>
              ) : discoverItems.length === 0 ? (
                <div
                  className={`p-8 rounded-xl border text-center space-y-2 ${
                    isDark ? 'bg-[#11131a] border-[#222634]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-sm font-semibold">No matching public resources found</div>
                  <p className="text-xs text-neutral-400">
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
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                          isDark
                            ? 'bg-[#101219] border-[#222634] hover:border-[#363d52]'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                                isDark
                                  ? 'bg-white/[0.06] text-neutral-300'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.category}
                            </span>

                            <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-400">
                              <span className="inline-flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {item.viewsCount || 1}
                              </span>
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
                                className={`inline-flex items-center gap-1 cursor-pointer ${
                                  isSaved
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-neutral-400 hover:text-white'
                                }`}
                                title="Save to private Knowledge Vault"
                              >
                                <Bookmark
                                  className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`}
                                />
                                <span>{isSaved ? 'Saved' : 'Save'}</span>
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

                          <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                            {item.summary}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-1 min-w-0">
                            {item.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-mono text-neutral-400 px-1.5 py-0.5 rounded bg-white/[0.03]"
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
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                                isDark
                                  ? 'border-[#2b3040] hover:bg-white/5 text-neutral-200'
                                  : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                              }`}
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
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                              }`}
                            >
                              <GitFork className="w-3 h-3" />
                              <span>Fork</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1">
                <span>Showing {discoverItems.length} of {discoverTotal} verified public resources</span>
                <span>Private conversations and notes never appear in Zeno Discover.</span>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: PERSONAL KNOWLEDGE VAULT
             ========================================================= */}
          {activeTab === 'vault' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 h-full">
              {/* Left Rail: Collections & Export */}
              <div className="md:col-span-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                    Collections
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewCollectionInput((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] text-neutral-300 hover:text-white cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>New</span>
                  </button>
                </div>

                {showNewCollectionInput && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Collection name…"
                      className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs outline-none ${
                        isDark
                          ? 'bg-[#14171f] border-[#282d3a] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAddCollection}
                      className="px-2.5 py-1.5 rounded-lg bg-white text-black text-xs font-semibold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCollectionId('all')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                      selectedCollectionId === 'all'
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-slate-900 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>All Saved Knowledge</span>
                    <span className="font-mono text-[11px]">{vaultItems.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCollectionId('pinned')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                      selectedCollectionId === 'pinned'
                        ? isDark
                          ? 'bg-white text-black'
                          : 'bg-slate-900 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span>Pinned Insights</span>
                    <span className="font-mono text-[11px]">
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
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                          selectedCollectionId === col.id
                            ? isDark
                              ? 'bg-white text-black'
                              : 'bg-slate-900 text-white'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{col.name}</span>
                        <span className="font-mono text-[11px]">{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                    Data Portability
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportVault('markdown')}
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                      isDark
                        ? 'border-[#282d3a] hover:bg-white/5 text-neutral-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Vault (.MD)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportVault('json')}
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                      isDark
                        ? 'border-[#282d3a] hover:bg-white/5 text-neutral-200'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export Vault (.JSON)</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Search, List & Reader/Editor */}
              <div className="md:col-span-9 space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      value={vaultSearch}
                      onChange={(e) => setVaultSearch(e.target.value)}
                      placeholder="Search your private saved answers, notes, tags, and citations..."
                      className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none ${
                        isDark
                          ? 'bg-[#12151e] border-[#242938] text-white placeholder-neutral-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNote(true);
                      setActiveVaultItem(null);
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer shrink-0 ${
                      isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Research Note</span>
                  </button>
                </div>

                {isCreatingNote ? (
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-[#11131a] border-[#242938]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="text-sm font-semibold">Create Private Research Note</div>
                    <input
                      type="text"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      placeholder="Note title..."
                      className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                        isDark
                          ? 'bg-[#0b0d12] border-[#282d3a] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <input
                      type="text"
                      value={newNoteTags}
                      onChange={(e) => setNewNoteTags(e.target.value)}
                      placeholder="Tags (comma-separated)..."
                      className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                        isDark
                          ? 'bg-[#0b0d12] border-[#282d3a] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <textarea
                      rows={6}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Write Markdown notes, formulas, or key takeaways..."
                      className={`w-full px-3 py-2 rounded-lg border font-mono text-xs outline-none ${
                        isDark
                          ? 'bg-[#0b0d12] border-[#282d3a] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingNote(false)}
                        className="px-3 py-1.5 rounded-lg text-neutral-400 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateCustomNote}
                        className="px-4 py-1.5 rounded-lg bg-white text-black font-semibold cursor-pointer"
                      >
                        Save to Vault
                      </button>
                    </div>
                  </div>
                ) : activeVaultItem ? (
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      isDark ? 'bg-[#11131a] border-[#242938]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveVaultItem(null)}
                        className="text-xs text-neutral-400 hover:text-white cursor-pointer"
                      >
                        ← Back to Vault list
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onContinueVaultItemInChat(activeVaultItem);
                            onClose();
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                          }`}
                        >
                          <GitFork className="w-3.5 h-3.5" />
                          <span>Continue Topic in Chat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            KnowledgeVaultStore.deleteItem(activeVaultItem.id);
                            setActiveVaultItem(null);
                          }}
                          className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-semibold">{activeVaultItem.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={activeVaultItem.collectionId}
                        onChange={(e) => {
                          const updated = KnowledgeVaultStore.updateItem(activeVaultItem.id, {
                            collectionId: e.target.value,
                          });
                          if (updated) setActiveVaultItem(updated);
                        }}
                        className={`px-2.5 py-1 rounded border text-xs outline-none ${
                          isDark
                            ? 'bg-[#0b0d12] border-[#282d3a] text-white'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        {collections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {activeVaultItem.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded bg-white/[0.06] font-mono text-[11px]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    <pre className="p-3.5 rounded-lg bg-black/40 border border-white/10 font-mono text-xs whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                      {activeVaultItem.content}
                    </pre>
                  </div>
                ) : filteredVaultItems.length === 0 ? (
                  <div
                    className={`p-8 rounded-xl border text-center space-y-2 ${
                      isDark ? 'bg-[#11131a] border-[#222634]' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="text-sm font-semibold">Your Knowledge Vault is empty</div>
                    <p className="text-xs text-neutral-400 max-w-md mx-auto">
                      Save any AI response in chat using the Save to Vault action, bookmark resources from Zeno Discover, or create a private note above.
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
                          className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                            isDark
                              ? 'bg-[#101219] border-[#222634] hover:border-[#363d52]'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono text-neutral-300">
                                {colName}
                              </span>
                              <span className="text-[11px] font-mono text-neutral-500">
                                {new Date(item.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold truncate">{item.title}</h4>
                            <p className="text-xs text-neutral-400 line-clamp-2">{item.summary}</p>
                          </div>

                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                KnowledgeVaultStore.updateItem(item.id, { pinned: !item.pinned });
                              }}
                              className={`p-1.5 rounded-lg cursor-pointer ${
                                item.pinned
                                  ? 'text-amber-400'
                                  : 'text-neutral-500 hover:text-white'
                              }`}
                              title="Pin in Vault"
                            >
                              <Pin className={`w-3.5 h-3.5 ${item.pinned ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onContinueVaultItemInChat(item);
                                onClose();
                              }}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
                              title="Continue in Zeno Chat"
                            >
                              <GitFork className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => KnowledgeVaultStore.deleteItem(item.id)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 cursor-pointer"
                              title="Delete from Vault"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#101219] border-[#222634]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                        7-Day Rolling Window · {weeklyReport.periodLabel}
                      </div>
                      <h3 className="text-sm font-semibold mt-0.5">
                        Your Weekly Zeno Intelligence Report
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-mono text-xs font-semibold">
                      {weeklyReport.activeDaysCount} Active Days
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <div className="p-3 rounded-lg bg-black/25 border border-white/5">
                      <div className="text-[10px] font-mono text-neutral-400">RESEARCH</div>
                      <div className="text-lg font-mono font-bold mt-0.5">
                        {weeklyReport.researchSessionsCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/25 border border-white/5">
                      <div className="text-[10px] font-mono text-neutral-400">VAULT SAVED</div>
                      <div className="text-lg font-mono font-bold mt-0.5">
                        {weeklyReport.savedVaultItemsCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/25 border border-white/5">
                      <div className="text-[10px] font-mono text-neutral-400">STUDY / PDF</div>
                      <div className="text-lg font-mono font-bold mt-0.5">
                        {weeklyReport.studyGuidesCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-black/25 border border-white/5">
                      <div className="text-[10px] font-mono text-neutral-400">PUBLISHED</div>
                      <div className="text-lg font-mono font-bold mt-0.5">
                        {weeklyReport.publishedArtifactsCount}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zeno Intelligence Level & Optional Missions */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#101219] border-[#222634]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="text-xs font-semibold">
                          Level {level.level}: {level.name}
                        </div>
                        <div className="text-[11px] text-neutral-400">{level.achievement}</div>
                      </div>
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
                      className="text-[11px] text-neutral-400 hover:text-white cursor-pointer"
                    >
                      {hideMissionsPanel ? 'Show Missions' : 'Hide Missions'}
                    </button>
                  </div>

                  {!hideMissionsPanel && (
                    <div className="space-y-2 pt-2">
                      {missions.map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                            m.completed
                              ? 'bg-emerald-500/5 border-emerald-500/25'
                              : 'bg-black/20 border-white/5'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium flex items-center gap-1.5">
                              {m.completed && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                              <span>{m.title}</span>
                            </div>
                            <div className="text-[11px] text-neutral-400">{m.description}</div>
                          </div>
                          <span className="font-mono text-[11px] text-neutral-300 shrink-0">
                            +{m.xp} XP
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Respectful Notification Preferences */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-[#101219] border-[#222634]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-400" />
                    <div className="text-xs font-semibold">
                      Respectful Reminder & Notification Preferences
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span>Enable in-workspace continuation reminders</span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.enabled}
                        onChange={(e) => handleUpdateNotifPref({ enabled: e.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span>Weekly Intelligence Brief summary ready indicator</span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.weeklyIntelligenceReport}
                        onChange={(e) =>
                          handleUpdateNotifPref({ weeklyIntelligenceReport: e.target.checked })
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span>Verified referral milestone notifications</span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.referralMilestones}
                        onChange={(e) =>
                          handleUpdateNotifPref({ referralMilestones: e.target.checked })
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Shareable Weekly Report Image Card */}
              <div
                className={`lg:col-span-6 p-4 rounded-xl border space-y-3 ${
                  isDark ? 'bg-[#08090d] border-[#1f232e]' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold">Shareable Weekly Brief Card</div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeTopicsOnWeeklyCard}
                        onChange={(e) => setIncludeTopicsOnWeeklyCard(e.target.checked)}
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
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Weekly Card</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-center">
                  <canvas
                    ref={weeklyCanvasRef}
                    className="w-full max-w-[440px] h-auto rounded-lg shadow-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 4: ZENO PASSES (REFERRALS) & CREATOR PROFILE
             ========================================================= */}
          {activeTab === 'passes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Zeno Passes Referral Loop */}
              <div
                className={`lg:col-span-6 p-4 rounded-xl border space-y-4 ${
                  isDark ? 'bg-[#101219] border-[#222634]' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                    Zeno Passes · Transparent Invitation System
                  </div>
                  <h3 className="text-sm font-semibold mt-0.5">
                    Invite Researchers & Friends to Zeno
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Share your personal Zeno Pass link. When a new visitor opens your link and completes their first research session within the 14-day attribution window, you unlock exclusive cosmetic Share Card themes. Core AI capabilities remain 100% free and unrestricted.
                  </p>
                </div>

                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 ${
                    isDark ? 'bg-[#090b10] border-[#242938]' : 'bg-white border-slate-200'
                  }`}
                >
                  <input
                    type="text"
                    readOnly
                    value={referralStatus?.referralUrl || 'Generating your unique Zeno Pass link…'}
                    className="flex-1 bg-transparent font-mono text-xs outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!referralStatus?.referralUrl) return;
                      navigator.clipboard.writeText(referralStatus.referralUrl);
                      setCopiedRefLink(true);
                      trackGrowthEvent('share_action_initiated', { surface: 'referral_link' });
                      setTimeout(() => setCopiedRefLink(false), 2000);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 ${
                      isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {copiedRefLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedRefLink ? 'Copied' : 'Copy Invite Link'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-black/25 border border-white/5">
                    <div className="text-[10px] font-mono text-neutral-400">INVITE CODE</div>
                    <div className="text-xs font-mono font-semibold mt-1 truncate">
                      {referralStatus?.code || '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/25 border border-white/5">
                    <div className="text-[10px] font-mono text-neutral-400">LINK VISITS</div>
                    <div className="text-lg font-mono font-bold mt-0.5">
                      {referralStatus?.visitsCount || 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/25 border border-white/5">
                    <div className="text-[10px] font-mono text-neutral-400">VERIFIED JOINS</div>
                    <div className="text-lg font-mono font-bold mt-0.5 text-emerald-400">
                      {referralStatus?.verifiedReferralsCount || 0}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                    Cosmetic Theme Unlocks
                  </div>
                  <div className="text-xs text-neutral-300">
                    Unlocked Share Card Themes:{' '}
                    <span className="font-mono">{unlockedThemes.join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Optional Public Creator Profile */}
              <div
                className={`lg:col-span-6 p-4 rounded-xl border space-y-4 ${
                  isDark ? 'bg-[#101219] border-[#222634]' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-semibold">Optional Public Creator Profile</h3>
                      <p className="text-[11px] text-neutral-400">
                        Control what appears when users click your name on a published Zeno Page.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCreatorProfile((p) => ({ ...p, isPublic: !p.isPublic }))
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${
                      creatorProfile.isPublic
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/15 text-neutral-400'
                    }`}
                  >
                    {creatorProfile.isPublic ? (
                      <>
                        <Globe className="w-3.5 h-3.5" />
                        <span>Public Profile On</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Private Profile</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Public Display Name
                    </label>
                    <input
                      type="text"
                      value={creatorProfile.displayName}
                      onChange={(e) =>
                        setCreatorProfile((p) => ({ ...p, displayName: e.target.value }))
                      }
                      maxLength={60}
                      className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                        isDark
                          ? 'bg-[#090b10] border-[#242938] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-neutral-400 mb-1">
                      Short Biography / Research Focus
                    </label>
                    <textarea
                      rows={3}
                      value={creatorProfile.bio || ''}
                      onChange={(e) =>
                        setCreatorProfile((p) => ({ ...p, bio: e.target.value }))
                      }
                      maxLength={280}
                      placeholder="e.g. Exploring ML systems, physics, and study workflows..."
                      className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                        isDark
                          ? 'bg-[#090b10] border-[#242938] text-white'
                          : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-500">
                      Email addresses and private notes are never exposed publicly.
                    </span>
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={handleSaveCreatorProfile}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                        isDark ? 'bg-white text-black' : 'bg-slate-900 text-white'
                      }`}
                    >
                      {savingProfile
                        ? 'Saving…'
                        : profileSavedToast
                        ? 'Saved Profile ✓'
                        : 'Save Profile Settings'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};
