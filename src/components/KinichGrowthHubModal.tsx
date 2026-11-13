import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  RefreshCw,
  ExternalLink,
  GitBranch,
  Star,
  Bookmark,
  Check,
  FolderOpen,
  Lock,
  Share2,
  Trash2,
  Play,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  DiscoverCategory,
  PublicArtifact,
  KnowledgeVaultItem,
  KinichReferralStatus,
  KinichFeedbackCategory,
  KinichFeedbackSubmission,
  VaultThread,
} from '../types';
import {
  fetchDiscoverArtifacts,
  KnowledgeVaultStore,
  VaultThreadStore,
  formatToIstDate,
  fetchMyReferralStatus,
  trackGrowthEvent,
  recordArtifactInteraction,
  claimReferralCodeManual,
  submitKinichFeedback,
  fetchMySubmittedFeedback,
  REFERRAL_8_REWARD_TIERS,
  getEightReferralTrackerState,
  addOneReferralProgress,
  claimEightReferralTier,
  EightReferralTrackerState,
} from '../lib/growthStore';
import { ChatThread } from './Sidebar';
import { auth } from '../lib/firebase';
import { UserAccountStore } from '../lib/userAccountStore';
import { fetchUserReferralDashboard, ReferralDashboardResponse } from '../lib/referralClient';

export type GrowthHubTab = 'discover' | 'vault' | 'weekly' | 'passes' | 'feedback';

export interface KinichGrowthHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: GrowthHubTab;
  initialThreadId?: string | null;
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
  initialThreadId = null,
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
  const [discoverLoading, setDiscoverLoading] = useState<boolean>(false);
  const [discoverCategory] = useState<DiscoverCategory | 'All'>('All');
  const [discoverQuery, setDiscoverQuery] = useState<string>('');
  const [discoverSourceFilter, setDiscoverSourceFilter] = useState<
    'all' | 'arxiv' | 'github' | 'community'
  >('all');
  const [liveArxivPapers, setLiveArxivPapers] = useState<LiveDiscoverArxivPaper[]>([]);
  const [liveGithubRepos, setLiveGithubRepos] = useState<LiveDiscoverConnectedRepo[]>([
    {
      id: 1001,
      name: 'vllm-project/vllm',
      fullName: 'vllm-project/vllm',
      owner: 'vllm-project',
      url: 'https://github.com/vllm-project/vllm',
      description:
        'High-throughput and memory-efficient inference and serving engine for LLMs with PagedAttention.',
      stars: 42800,
      forks: 6400,
      language: 'Python',
      topics: ['llm', 'inference', 'paged-attention'],
    },
    {
      id: 1002,
      name: 'deepseek-ai/DeepSeek-V3',
      fullName: 'deepseek-ai/DeepSeek-V3',
      owner: 'deepseek-ai',
      url: 'https://github.com/deepseek-ai/DeepSeek-V3',
      description:
        'DeepSeek-V3 & R1 mixture-of-experts architecture with Multi-head Latent Attention (MLA) and FP8 training.',
      stars: 68400,
      forks: 9200,
      language: 'Python',
      topics: ['deepseek', 'moe', 'llm', 'reasoning'],
    },
    {
      id: 1003,
      name: 'open-spaced-repetition/ts-fsrs',
      fullName: 'open-spaced-repetition/ts-fsrs',
      owner: 'open-spaced-repetition',
      url: 'https://github.com/open-spaced-repetition/ts-fsrs',
      description:
        'TypeScript implementation of Free Spaced Repetition Scheduler (FSRS) and SM-2 memory scheduling algorithms.',
      stars: 1450,
      forks: 140,
      language: 'TypeScript',
      topics: ['spaced-repetition', 'fsrs', 'sm2'],
    },
    {
      id: 1004,
      name: 'run-llama/llama_index',
      fullName: 'run-llama/llama_index',
      owner: 'run-llama',
      url: 'https://github.com/run-llama/llama_index',
      description:
        'Data framework for LLM applications to ingest, structure, and access private or domain-specific data (RAG).',
      stars: 39500,
      forks: 5600,
      language: 'Python',
      topics: ['rag', 'agents', 'vector-search'],
    },
  ]);
  const [liveFeedLoading, setLiveFeedLoading] = useState<boolean>(false);
  const [liveRefreshTick, setLiveRefreshTick] = useState<number>(0);
  const [savedLiveIds, setSavedLiveIds] = useState<Record<string, boolean>>({});

  // --- TAB 2: VAULT STATE ---
  const [vaultItems, setVaultItems] = useState<KnowledgeVaultItem[]>(() =>
    KnowledgeVaultStore.getItems()
  );
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [vaultSearch, setVaultSearch] = useState<string>('');
  const [activeVaultItem, setActiveVaultItem] = useState<KnowledgeVaultItem | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newNoteTags, setNewNoteTags] = useState<string>('notes, study');

  const [vaultThreads, setVaultThreads] = useState<VaultThread[]>(() =>
    VaultThreadStore.getThreads()
  );
  const [activeThread, setActiveThread] = useState<VaultThread | null>(null);
  const [vaultViewMode, setVaultViewMode] = useState<'threads' | 'tree'>('threads');
  const [threadCommentInput, setThreadCommentInput] = useState<string>('');
  const [copiedShareNotice, setCopiedShareNotice] = useState<string | null>(null);
  const [activeVideoTimeSec, setActiveVideoTimeSec] = useState<number>(0);
  const [isGuestVault, setIsGuestVault] = useState<boolean>(() => UserAccountStore.isGuest());

  // --- TAB 3: REFERRALS STATE ---
  const [referralStatus, setReferralStatus] = useState<KinichReferralStatus | null>(null);
  const [dashboardData, setDashboardData] = useState<ReferralDashboardResponse | null>(null);
  const [copiedRefLink, setCopiedRefLink] = useState<boolean>(false);
  const [claimPassInput, setClaimPassInput] = useState<string>('');
  const [claimingPass, setClaimingPass] = useState<boolean>(false);
  const [claimPassFeedback, setClaimPassFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [bonusClaimNotice, setBonusClaimNotice] = useState<string | null>(null);
  const [eightRefState, setEightRefState] = useState<EightReferralTrackerState>(() =>
    getEightReferralTrackerState()
  );

  // --- TAB 4: FEEDBACK STATE ---
  const [feedbackCategory, setFeedbackCategory] = useState<KinichFeedbackCategory>('feature');
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackSubject, setFeedbackSubject] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [myFeedbackHistory, setMyFeedbackHistory] = useState<KinichFeedbackSubmission[]>([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab === 'weekly' ? 'discover' : initialTab);
      const localItems = KnowledgeVaultStore.getItems();
      const localThreads = VaultThreadStore.getThreads();
      setVaultItems(localItems);
      setVaultThreads(localThreads);
      if (initialThreadId) {
        const match = localThreads.find((t) => t.id === initialThreadId);
        if (match) {
          setVaultViewMode('threads');
          setActiveThread(match);
        }
      }
      setIsGuestVault(UserAccountStore.isGuest());
      if (!UserAccountStore.isGuest()) {
        KnowledgeVaultStore.syncFromCloud().then((synced) => {
          setVaultItems(synced);
        });
        VaultThreadStore.syncWithFirestore().then((synced) => {
          if (Array.isArray(synced)) {
            setVaultThreads(synced);
            if (initialThreadId) {
              const cloudMatch = synced.find((t) => t.id === initialThreadId);
              if (cloudMatch) {
                setVaultViewMode('threads');
                setActiveThread(cloudMatch);
              }
            }
          }
        });
      }
    }
  }, [isOpen, initialTab, initialThreadId]);

  useEffect(() => {
    const syncVault = () => {
      setVaultItems(KnowledgeVaultStore.getItems());
      setVaultThreads(VaultThreadStore.getThreads());
      setIsGuestVault(UserAccountStore.isGuest());
    };
    window.addEventListener('kinich-vault-updated', syncVault);
    window.addEventListener('kinich-account-updated', syncVault);
    return () => {
      window.removeEventListener('kinich-vault-updated', syncVault);
      window.removeEventListener('kinich-account-updated', syncVault);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || activeTab !== 'discover') return;
    let cancelled = false;
    setDiscoverLoading(true);
    setLiveFeedLoading(true);

    fetchDiscoverArtifacts({
      category: discoverCategory,
      q: discoverQuery,
      sort: 'recent',
      limit: 24,
    })
      .then((res) => {
        if (cancelled) return;
        setDiscoverItems(res.items);
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
        if (Array.isArray(data.arxivPapers) && data.arxivPapers.length > 0) {
          setLiveArxivPapers(data.arxivPapers);
        }
        if (Array.isArray(data.githubRepos) && data.githubRepos.length > 0) {
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
  }, [isOpen, activeTab, discoverCategory, discoverQuery, liveRefreshTick]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'passes') return;
    setEightRefState(getEightReferralTrackerState());
    fetchMyReferralStatus().then((st) => {
      if (st) {
        setReferralStatus(st);
        setEightRefState(getEightReferralTrackerState());
      }
    });
    fetchUserReferralDashboard()
      .then((dash) => {
        if (dash && dash.success) {
          setDashboardData(dash);
        }
      })
      .catch(() => {});
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'feedback') return;
    fetchMySubmittedFeedback().then((items) => {
      setMyFeedbackHistory(items);
    });
  }, [isOpen, activeTab]);

  const filteredVaultItems = useMemo(() => {
    let list = vaultItems;
    if (selectedSubject !== 'all') {
      list = list.filter(
        (i) => (i.subject || 'General Studies').toLowerCase() === selectedSubject.toLowerCase()
      );
    }
    const q = vaultSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.subject || '').toLowerCase().includes(q) ||
          (i.chapter || '').toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.content.toLowerCase().includes(q)
      );
    }
    return list;
  }, [vaultItems, selectedSubject, vaultSearch]);

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
          (t.chapter || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
    return list;
  }, [vaultThreads, selectedSubject, vaultSearch]);

  const handleAddThreadComment = () => {
    if (!activeThread) return;
    const text = threadCommentInput.trim();
    if (!text) return;
    VaultThreadStore.addComment(activeThread.id, {
      author: 'user',
      text,
    });
    setThreadCommentInput('');
    const refreshed = VaultThreadStore.getThread(activeThread.id);
    if (refreshed) {
      setActiveThread(refreshed);
      setVaultThreads(VaultThreadStore.getThreads());
    }
  };

  const handleForgetThread = (threadId: string) => {
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

  const handleShareThread = (thread: VaultThread) => {
    const text =
      `${thread.title}\n` +
      `${thread.subject} → ${thread.chapter}\n` +
      `${thread.tldr}\n\n` +
      `${thread.keyPoints.map((kp, idx) => `${idx + 1}. ${kp.text}`).join('\n')}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedShareNotice('Copied to clipboard');
    setTimeout(() => setCopiedShareNotice(null), 2500);
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
    const created = KnowledgeVaultStore.saveItem({
      title: newNoteTitle.trim(),
      summary: newNoteContent.trim().slice(0, 200),
      content: newNoteContent.trim(),
      type: 'note',
      sourceType: 'note',
      collectionId: 'col_explanations',
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

  const cardSurface = isDark
    ? 'bg-zinc-900/70 border-zinc-800/90'
    : 'bg-white border-zinc-200/90 shadow-2xs';

  const subCardSurface = isDark
    ? 'bg-zinc-950/60 border-zinc-800/80'
    : 'bg-zinc-50 border-zinc-200/80';

  const inputSurface = isDark
    ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-zinc-600'
    : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-zinc-400';

  const primaryBtn = isDark
    ? 'bg-white text-black hover:bg-zinc-200'
    : 'bg-zinc-900 text-white hover:bg-zinc-800';

  const secondaryBtn = isDark
    ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200'
    : 'border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800';

  return (
    <div
      className={`fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden ${
        isDark ? 'bg-[#09090b] text-white' : 'bg-[#fafafa] text-[#09090b]'
      }`}
    >
      {/* Simple, Calm Top Bar with Tabs + Close Button */}
      <div
        className={`px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-zinc-800/80 bg-[#09090b]' : 'border-zinc-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === t.id
                  ? isDark
                    ? 'bg-white text-black font-semibold'
                    : 'bg-zinc-900 text-white font-semibold'
                  : isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`size-8 rounded-xl flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${
            isDark
              ? 'border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white'
              : 'border-zinc-200 hover:bg-zinc-100 text-zinc-500 hover:text-black'
          }`}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto slim-scrollbar p-4 sm:p-6 text-xs">
        <div className="max-w-4xl mx-auto">
          {/* =========================================================
              TAB 1: DISCOVER (CLEAN, CALM, MINIMAL)
             ========================================================= */}
          {activeTab === 'discover' && (
            <div className="space-y-5">
              {/* Single Clean Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={discoverQuery}
                    onChange={(e) => setDiscoverQuery(e.target.value)}
                    placeholder="Search papers, repos, or study guides..."
                    className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none transition-colors ${inputSurface}`}
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-1.5">
                  <div
                    className={`inline-flex items-center p-0.5 rounded-xl border ${
                      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                    }`}
                  >
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'arxiv', label: 'Papers' },
                        { id: 'github', label: 'Code' },
                        { id: 'community', label: 'Guides' },
                      ] as const
                    ).map((src) => (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => setDiscoverSourceFilter(src.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                          discoverSourceFilter === src.id
                            ? isDark
                              ? 'bg-white text-black font-semibold'
                              : 'bg-zinc-900 text-white font-semibold'
                            : isDark
                            ? 'text-zinc-400 hover:text-white'
                            : 'text-zinc-600 hover:text-black'
                        }`}
                      >
                        {src.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setLiveRefreshTick((t) => t + 1)}
                    disabled={liveFeedLoading}
                    title="Refresh"
                    className={`size-8 rounded-xl border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${secondaryBtn}`}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${liveFeedLoading ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Clean Feed List */}
              <div className="space-y-3">
                {/* Research Papers */}
                {(discoverSourceFilter === 'all' || discoverSourceFilter === 'arxiv') &&
                  liveArxivPapers.map((paper) => {
                    const connectedRepo = paper.connectedRepos?.[0] || null;
                    const isSaved = Boolean(savedLiveIds[`arxiv_${paper.id}`]);
                    return (
                      <div
                        key={paper.id}
                        className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${cardSurface}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                          <span className="font-medium text-[#FC4C01]">
                            Paper · {paper.primaryCategory || 'CS.AI'}
                          </span>
                          <span>
                            {paper.published
                              ? new Date(paper.published).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Recent'}
                          </span>
                        </div>

                        <a
                          href={paper.absUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-semibold leading-snug hover:text-[#FC4C01] transition-colors"
                        >
                          {paper.title}
                        </a>

                        <p
                          className={`text-xs line-clamp-2 leading-relaxed ${
                            isDark ? 'text-zinc-400' : 'text-zinc-600'
                          }`}
                        >
                          {paper.summary}
                        </p>

                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3 text-xs">
                            <a
                              href={paper.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 font-medium hover:underline ${
                                isDark ? 'text-zinc-300' : 'text-zinc-700'
                              }`}
                            >
                              <span>PDF</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {connectedRepo && (
                              <a
                                href={connectedRepo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-emerald-500 hover:underline"
                              >
                                <GitBranch className="w-3 h-3" />
                                <span>{connectedRepo.name}</span>
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                KnowledgeVaultStore.saveItem({
                                  title: paper.title,
                                  summary: paper.summary.slice(0, 240),
                                  content: `### ${paper.title}\n\n- **arXiv:** ${paper.absUrl}\n- **PDF:** ${paper.pdfUrl}\n\n${paper.summary}`,
                                  type: 'research_summary',
                                  collectionId: 'col_research_ideas',
                                  tags: ['arxiv'],
                                });
                                setSavedLiveIds((prev) => ({
                                  ...prev,
                                  [`arxiv_${paper.id}`]: true,
                                }));
                                setVaultItems(KnowledgeVaultStore.getItems());
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer inline-flex items-center gap-1 ${secondaryBtn}`}
                            >
                              {isSaved ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
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
                                  content: `Analyze this research paper (${paper.absUrl}):\n\n**Title:** ${paper.title}\n**Abstract:** ${paper.summary}`,
                                  category: 'Research',
                                  outputType: 'research_summary',
                                  tags: ['arxiv'],
                                  authorName: paper.authors[0] || 'arXiv',
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
                              className="px-3 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Ask Kinich
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* GitHub Repositories */}
                {(discoverSourceFilter === 'all' || discoverSourceFilter === 'github') &&
                  liveGithubRepos.map((repo) => {
                    const isSaved = Boolean(savedLiveIds[`gh_${repo.id}`]);
                    return (
                      <div
                        key={repo.id}
                        className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${cardSurface}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                          <span className="font-medium text-emerald-500">
                            Code · {repo.language || 'Open Source'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {repo.stars.toLocaleString()}
                          </span>
                        </div>

                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-semibold hover:text-[#FC4C01] transition-colors truncate"
                        >
                          {repo.fullName}
                        </a>

                        <p
                          className={`text-xs line-clamp-2 leading-relaxed ${
                            isDark ? 'text-zinc-400' : 'text-zinc-600'
                          }`}
                        >
                          {repo.description}
                        </p>

                        <div className="pt-2 flex items-center justify-between gap-2">
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${
                              isDark ? 'text-zinc-300' : 'text-zinc-700'
                            }`}
                          >
                            <span>GitHub</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                KnowledgeVaultStore.saveItem({
                                  title: repo.fullName,
                                  summary: repo.description,
                                  content: `### ${repo.fullName}\n\n- **GitHub:** ${repo.url}\n\n${repo.description}`,
                                  type: 'discover_resource',
                                  collectionId: 'col_programming',
                                  tags: ['github'],
                                });
                                setSavedLiveIds((prev) => ({
                                  ...prev,
                                  [`gh_${repo.id}`]: true,
                                }));
                                setVaultItems(KnowledgeVaultStore.getItems());
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${secondaryBtn}`}
                            >
                              {isSaved ? 'Saved' : 'Save'}
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
                                  content: `Explain the architecture and key patterns of **${repo.fullName}** (${repo.url}):\n\n${repo.description}`,
                                  category: 'Programming',
                                  outputType: 'structured_notes',
                                  tags: ['github'],
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
                              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${primaryBtn}`}
                            >
                              Inspect
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Study Guides & Blueprints */}
                {(discoverSourceFilter === 'all' ||
                  discoverSourceFilter === 'community' ||
                  discoverSourceFilter === 'github') &&
                  discoverItems
                    .filter((item) =>
                      discoverSourceFilter === 'github'
                        ? item.category === 'Programming' ||
                          item.tags?.some((t) => /code|rust|python|typescript|compiler/i.test(t))
                        : true
                    )
                    .map((item) => {
                      const isSaved = KnowledgeVaultStore.isArtifactBookmarked(item.id);
                      return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${cardSurface}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                          <span className="font-medium">{item.category}</span>
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
                            className={`cursor-pointer font-medium ${
                              isSaved ? 'text-[#FC4C01]' : 'hover:text-current'
                            }`}
                          >
                            {isSaved ? 'Saved' : 'Save'}
                          </button>
                        </div>

                        <h3
                          onClick={() => {
                            trackGrowthEvent('discover_resource_opened', {
                              artifactId: item.id,
                              category: item.category,
                            });
                            onOpenArtifactPage(item);
                          }}
                          className="text-sm font-semibold leading-snug hover:text-[#FC4C01] transition-colors cursor-pointer"
                        >
                          {item.title}
                        </h3>

                        <p
                          className={`text-xs line-clamp-2 leading-relaxed ${
                            isDark ? 'text-zinc-400' : 'text-zinc-600'
                          }`}
                        >
                          {item.summary}
                        </p>

                        <div className="pt-2 flex items-center justify-between gap-2">
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
                            className="text-[11px] text-zinc-400 hover:text-current cursor-pointer"
                          >
                            Report
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                trackGrowthEvent('discover_resource_opened', {
                                  artifactId: item.id,
                                  category: item.category,
                                });
                                onOpenArtifactPage(item);
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${secondaryBtn}`}
                            >
                              Read
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                recordArtifactInteraction(item.id, 'cta');
                                onForkArtifactIntoChat(item);
                                onClose();
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer ${primaryBtn}`}
                            >
                              Open in Chat
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {!discoverLoading &&
                  !liveFeedLoading &&
                  liveArxivPapers.length === 0 &&
                  liveGithubRepos.length === 0 &&
                  discoverItems.length === 0 && (
                    <div className={`p-8 rounded-2xl border text-center ${cardSurface}`}>
                      <div className="text-xs text-zinc-400">No matching items found.</div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: THE VAULT (CLEAN, PEACEFUL, NO REDDIT CLUTTER)
             ========================================================= */}
          {activeTab === 'vault' &&
            (isGuestVault ? (
              <div
                data-testid="vault-guest-signin-prompt"
                className={`p-8 sm:p-10 rounded-2xl border text-center max-w-md mx-auto my-6 space-y-4 ${cardSurface}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#FC4C01]/15 text-[#FC4C01] flex items-center justify-center mx-auto">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold tracking-tight">
                    Sign in to keep this in your Vault
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Save lectures, notes, quizzes, and study threads across your devices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('kinich-open-auth', {
                        detail: { reason: 'Sign in to keep this in your Vault' },
                      })
                    );
                  }}
                  className="px-5 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white font-semibold text-xs cursor-pointer transition-colors"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Single Clean Toolbar: Search + View Toggle + New Note */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={vaultSearch}
                      onChange={(e) => setVaultSearch(e.target.value)}
                      placeholder="Search your saved notes and study threads..."
                      className={`w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none ${inputSurface}`}
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <div
                      className={`inline-flex items-center p-0.5 rounded-xl border ${
                        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setVaultViewMode('threads');
                          setActiveVaultItem(null);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          vaultViewMode === 'threads'
                            ? isDark
                              ? 'bg-white text-black font-semibold'
                              : 'bg-zinc-900 text-white font-semibold'
                            : isDark
                            ? 'text-zinc-400 hover:text-white'
                            : 'text-zinc-600 hover:text-black'
                        }`}
                      >
                        Feed ({vaultThreads.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVaultViewMode('tree');
                          setActiveThread(null);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          vaultViewMode === 'tree'
                            ? isDark
                              ? 'bg-white text-black font-semibold'
                              : 'bg-zinc-900 text-white font-semibold'
                            : isDark
                            ? 'text-zinc-400 hover:text-white'
                            : 'text-zinc-600 hover:text-black'
                        }`}
                      >
                        Subjects ({vaultItems.length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setVaultViewMode('tree');
                        setIsCreatingNote(true);
                        setActiveVaultItem(null);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                    >
                      + Note
                    </button>
                  </div>
                </div>

                {copiedShareNotice && (
                  <div className="text-xs text-[#FC4C01] font-medium">{copiedShareNotice}</div>
                )}

                {vaultViewMode === 'threads' ? (
                  activeThread ? (
                    <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${cardSurface}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-current/10">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveThread(null);
                            setActiveVideoTimeSec(0);
                          }}
                          className="text-xs text-zinc-400 hover:text-current font-medium cursor-pointer"
                        >
                          ← Back
                        </button>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuizMeOnThread(activeThread)}
                            className="px-3 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer"
                          >
                            Quiz me
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFlashcardsOnThread(activeThread)}
                            className={`px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer ${secondaryBtn}`}
                          >
                            Flashcards
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareThread(activeThread)}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${secondaryBtn}`}
                          >
                            Share
                          </button>
                          <button
                            type="button"
                            onClick={() => handleForgetThread(activeThread.id)}
                            className="px-2.5 py-1 rounded-lg text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] text-zinc-400">
                          <span className="text-[#FC4C01] font-medium">
                            {activeThread.subject || 'General Studies'}
                          </span>{' '}
                          → {activeThread.chapter || 'Core Concepts'} ·{' '}
                          {formatToIstDate(activeThread.createdAt)}
                        </div>
                        <h2 className="text-base sm:text-lg font-bold tracking-tight">
                          {activeThread.title}
                        </h2>
                      </div>

                      {activeThread.type === 'youtube' &&
                        extractYouTubeVideoId(activeThread.sourceUrl) && (
                          <div className="w-full aspect-video rounded-xl overflow-hidden border border-current/10 bg-black">
                            <iframe
                              id="vault-youtube-player"
                              src={`https://www.youtube.com/embed/${extractYouTubeVideoId(
                                activeThread.sourceUrl
                              )}?start=${activeVideoTimeSec}&autoplay=${
                                activeVideoTimeSec > 0 ? 1 : 0
                              }`}
                              title={activeThread.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="w-full h-full border-0"
                            />
                          </div>
                        )}

                      {activeThread.tldr && (
                        <p
                          className={`text-xs sm:text-sm leading-relaxed ${
                            isDark ? 'text-zinc-300' : 'text-zinc-700'
                          }`}
                        >
                          {activeThread.tldr}
                        </p>
                      )}

                      {Array.isArray(activeThread.keyPoints) &&
                        activeThread.keyPoints.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <div className="text-xs font-semibold text-zinc-400">Key Points</div>
                            <div className="space-y-1.5">
                              {activeThread.keyPoints.map((kp, idx) => (
                                <div
                                  key={kp.id || idx}
                                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${subCardSurface}`}
                                >
                                  <span className="text-xs font-mono font-semibold text-[#FC4C01] shrink-0">
                                    {idx + 1}.
                                  </span>
                                  {kp.timestamp && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveVideoTimeSec(parseTimestampToSeconds(kp.timestamp))
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FC4C01]/15 text-[#FC4C01] text-[11px] font-mono cursor-pointer shrink-0"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" />
                                      <span>{kp.timestamp}</span>
                                    </button>
                                  )}
                                  <span className="text-xs leading-relaxed">{kp.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Simple Notes / Comments */}
                      <div className="pt-4 border-t border-current/10 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={threadCommentInput}
                            onChange={(e) => setThreadCommentInput(e.target.value)}
                            placeholder="Add a note..."
                            className={`flex-1 px-3 py-2 rounded-xl border text-xs outline-none ${inputSurface}`}
                          />
                          <button
                            type="button"
                            onClick={handleAddThreadComment}
                            className="px-3.5 py-2 rounded-xl bg-[#FC4C01] text-white text-xs font-semibold cursor-pointer"
                          >
                            Add
                          </button>
                        </div>

                        {Array.isArray(activeThread.comments) &&
                          activeThread.comments.length > 0 && (
                            <div className="space-y-2">
                              {activeThread.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className={`p-3 rounded-xl border text-xs space-y-1 ${subCardSurface}`}
                                >
                                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                    <span className="font-medium capitalize">
                                      {comment.author === 'user' ? 'You' : comment.author}
                                    </span>
                                    <span>{formatToIstDate(comment.createdAt)}</span>
                                  </div>
                                  <p className="leading-relaxed whitespace-pre-wrap">
                                    {comment.text}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  ) : filteredVaultThreads.length === 0 ? (
                    <div className={`p-8 text-center rounded-2xl border space-y-1 ${cardSurface}`}>
                      <div className="text-sm font-semibold">No saved study threads yet</div>
                      <p className="text-xs text-zinc-400">
                        Save any lecture, chat synthesis, or study guide to access it here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredVaultThreads.map((thread) => (
                        <div
                          key={thread.id}
                          onClick={() => {
                            setActiveThread(thread);
                            setActiveVideoTimeSec(0);
                          }}
                          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 cursor-pointer transition-colors hover:border-[#FC4C01]/50 ${cardSurface}`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                              <span className="text-[#FC4C01] font-medium">
                                {thread.subject || 'General Studies'}
                              </span>
                              <span>→</span>
                              <span>{thread.chapter || 'Core Concepts'}</span>
                              <span>·</span>
                              <span>{formatToIstDate(thread.createdAt)}</span>
                            </div>

                            <h3 className="text-sm font-semibold leading-snug truncate">
                              {thread.title}
                            </h3>

                            {thread.tldr && (
                              <p
                                className={`text-xs line-clamp-2 leading-relaxed ${
                                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                                }`}
                              >
                                {thread.tldr}
                              </p>
                            )}
                          </div>

                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleShareThread(thread)}
                              className="size-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-current cursor-pointer"
                              title="Share"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleForgetThread(thread.id)}
                              className="size-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* Subject Tree View */
                  <div className="space-y-4">
                    {/* Subject Filter Pills */}
                    {allSubjectsWithCounts.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                        <button
                          type="button"
                          onClick={() => setSelectedSubject('all')}
                          className={`px-3 py-1 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer ${
                            selectedSubject === 'all' ? primaryBtn : secondaryBtn
                          }`}
                        >
                          All ({vaultItems.length})
                        </button>
                        {allSubjectsWithCounts.map((grp) => (
                          <button
                            key={grp.subject}
                            type="button"
                            onClick={() => setSelectedSubject(grp.subject)}
                            className={`px-3 py-1 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer ${
                              selectedSubject === grp.subject ? primaryBtn : secondaryBtn
                            }`}
                          >
                            {grp.subject} ({grp.totalItems})
                          </button>
                        ))}
                      </div>
                    )}

                    {isCreatingNote ? (
                      <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${cardSurface}`}>
                        <div className="text-sm font-semibold">New Study Note</div>
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
                          placeholder="Write Markdown notes or formulas..."
                          className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-xs outline-none ${inputSurface}`}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsCreatingNote(false)}
                            className="px-3.5 py-1.5 rounded-xl text-zinc-400 hover:text-current cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateCustomNote}
                            className="px-4 py-1.5 rounded-xl bg-[#FC4C01] text-white font-semibold cursor-pointer"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : activeVaultItem ? (
                      <div className={`p-4 sm:p-5 rounded-2xl border space-y-4 ${cardSurface}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveVaultItem(null)}
                            className="text-xs text-zinc-400 hover:text-current cursor-pointer font-medium"
                          >
                            ← Back
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
                              Open in Chat
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

                        <div className="space-y-1">
                          <div className="text-[11px] text-zinc-400">
                            <span className="text-[#FC4C01] font-medium">
                              {activeVaultItem.subject || 'General Studies'}
                            </span>{' '}
                            → {activeVaultItem.chapter || 'Core Concepts'}
                          </div>
                          <h3 className="text-base font-bold">{activeVaultItem.title}</h3>
                        </div>

                        <div
                          className={`p-4 rounded-xl border prose-grok max-w-none text-xs sm:text-sm leading-relaxed overflow-x-auto ${subCardSurface}`}
                        >
                          <ReactMarkdown
                            remarkPlugins={[
                              remarkGfm,
                              [remarkMath, { singleDollarTextMath: false }],
                            ]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {normalizeLatexDelimiters(activeVaultItem.content)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : groupedVaultBySubjectAndChapter.length === 0 ? (
                      <div
                        className={`p-8 rounded-2xl border text-center space-y-1 ${cardSurface}`}
                      >
                        <div className="text-sm font-semibold">Your Vault is empty</div>
                        <p className="text-xs text-zinc-400">
                          Click &ldquo;Save to Vault&rdquo; on any lecture, report, or chat response.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4" data-testid="vault-subject-chapter-groups">
                        {groupedVaultBySubjectAndChapter.map((subjectGroup) => (
                          <div
                            key={subjectGroup.subject}
                            className={`p-4 rounded-2xl border space-y-3 ${cardSurface}`}
                          >
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-current/10">
                              <div className="flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-[#FC4C01]" />
                                <h3 className="text-sm font-bold">{subjectGroup.subject}</h3>
                              </div>
                              <span className="text-[11px] text-zinc-400">
                                {subjectGroup.totalItems} items
                              </span>
                            </div>

                            <div className="space-y-3">
                              {subjectGroup.chapters.map((chapterGroup) => (
                                <div key={chapterGroup.chapter} className="space-y-2">
                                  <div className="text-xs font-semibold text-[#FC4C01]">
                                    {chapterGroup.chapter} ({chapterGroup.items.length})
                                  </div>

                                  <div className="space-y-2">
                                    {chapterGroup.items.map((item) => (
                                      <div
                                        key={item.id}
                                        data-testid={`vault-item-card-${item.id}`}
                                        onClick={() => {
                                          KnowledgeVaultStore.markReviewed(item.id);
                                          setActiveVaultItem(item);
                                        }}
                                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors hover:border-[#FC4C01]/50 ${subCardSurface}`}
                                      >
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                          <h5 className="text-xs sm:text-sm font-semibold truncate">
                                            {item.title}
                                          </h5>
                                          <p
                                            className={`text-xs line-clamp-1 ${
                                              isDark ? 'text-zinc-400' : 'text-zinc-600'
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
                                              KnowledgeVaultStore.markReviewed(item.id);
                                              onContinueVaultItemInChat(item);
                                              onClose();
                                            }}
                                            className={`px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer ${secondaryBtn}`}
                                          >
                                            Study
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => KnowledgeVaultStore.deleteItem(item.id)}
                                            className="p-1 text-zinc-400 hover:text-red-400 cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

          {/* =========================================================
              TAB 3: REFERRALS (SIMPLE, CALM, COMPACT)
             ========================================================= */}
          {activeTab === 'passes' && (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Invite Link & Progress Card */}
              <div className={`p-5 rounded-2xl border space-y-4 ${cardSurface}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold tracking-tight">Invite Friends</h3>
                  <span className="text-sm font-mono font-bold text-[#FC4C01]">
                    {Math.min(eightRefState.count, 8)} / 8
                  </span>
                </div>

                {/* Clean Progress Bar */}
                <div
                  className={`w-full h-1.5 rounded-full overflow-hidden ${
                    isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                  }`}
                >
                  <div
                    className="h-full rounded-full bg-[#FC4C01] transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((eightRefState.count / 8) * 100))}%`,
                    }}
                  />
                </div>

                {/* Invite Link Copy & Share */}
                <div
                  className={`p-2 rounded-xl border flex items-center gap-2 ${subCardSurface}`}
                >
                  <input
                    type="text"
                    readOnly
                    value={
                      dashboardData?.link ||
                      referralStatus?.referralUrl ||
                      eightRefState.inviteUrl
                    }
                    className="flex-1 bg-transparent font-mono text-xs outline-none truncate px-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url =
                        dashboardData?.link ||
                        referralStatus?.referralUrl ||
                        eightRefState.inviteUrl;
                      navigator.clipboard.writeText(url);
                      setCopiedRefLink(true);
                      trackGrowthEvent('share_action_initiated', { surface: 'referral_link' });
                      setTimeout(() => setCopiedRefLink(false), 2000);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 ${primaryBtn}`}
                  >
                    {copiedRefLink ? 'Copied' : 'Copy Link'}
                  </button>
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      type="button"
                      onClick={() => {
                        const url =
                          dashboardData?.link ||
                          referralStatus?.referralUrl ||
                          eightRefState.inviteUrl;
                        const code =
                          dashboardData?.code || referralStatus?.code || eightRefState.code;
                        navigator
                          .share({
                            title: 'Join me on Kinich',
                            text: `Join me on Kinich with code: ${code}`,
                            url,
                          })
                          .catch(() => {});
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer shrink-0 ${secondaryBtn}`}
                    >
                      Share
                    </button>
                  )}
                </div>

                {/* Compact Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-2.5 rounded-xl border text-center ${subCardSurface}`}>
                    <div className="text-base font-bold font-mono">
                      {dashboardData?.stats?.invited ?? referralStatus?.validatedSignupsCount ?? 0}
                    </div>
                    <div className="text-[11px] text-zinc-400">Invited</div>
                  </div>
                  <div className={`p-2.5 rounded-xl border text-center ${subCardSurface}`}>
                    <div className="text-base font-bold font-mono">
                      {dashboardData?.stats?.qualified ??
                        referralStatus?.qualifiedActionsCount ??
                        0}
                    </div>
                    <div className="text-[11px] text-zinc-400">Qualified</div>
                  </div>
                  <div className={`p-2.5 rounded-xl border text-center ${subCardSurface}`}>
                    <div className="text-base font-bold font-mono">
                      {dashboardData?.stats?.rewarded ?? (dashboardData?.rewards?.length || 0)}
                    </div>
                    <div className="text-[11px] text-zinc-400">Rewards</div>
                  </div>
                </div>

                {/* Redeem Friend Code */}
                <div className="pt-2 border-t border-current/10 flex items-center gap-2">
                  <input
                    type="text"
                    value={claimPassInput}
                    onChange={(e) => setClaimPassInput(e.target.value)}
                    placeholder="Have a friend's code? Enter here..."
                    className={`flex-1 px-3 py-1.5 rounded-xl border font-mono text-xs outline-none ${inputSurface}`}
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
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 ${primaryBtn}`}
                  >
                    {claimingPass ? '...' : 'Redeem'}
                  </button>
                </div>
                {claimPassFeedback && (
                  <div className="text-[11px] font-medium text-[#FC4C01]">
                    {claimPassFeedback.message}
                  </div>
                )}
              </div>

              {bonusClaimNotice && (
                <div className="px-4 py-2.5 rounded-xl border border-[#FC4C01]/40 bg-[#FC4C01]/10 text-xs font-medium flex items-center justify-between gap-2">
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

              {/* Compact 4 Milestones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REFERRAL_8_REWARD_TIERS.map((tier) => {
                  const isClaimed = eightRefState.claimedTiers.includes(tier.targetReferrals);
                  const isUnlocked = eightRefState.count >= tier.targetReferrals;

                  return (
                    <div
                      key={tier.targetReferrals}
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                        isUnlocked && !isClaimed
                          ? 'border-[#FC4C01]/50 bg-[#FC4C01]/[0.05]'
                          : cardSurface
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold">
                          {tier.targetReferrals}{' '}
                          {tier.targetReferrals === 1 ? 'Referral' : 'Referrals'}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          +{tier.bonusMessages} Prompts · +{tier.bonusUploads} Uploads · +
                          {tier.bonusQuizzes} Quizzes
                        </div>
                      </div>

                      {isClaimed ? (
                        <span className="text-xs font-semibold text-emerald-500 shrink-0">
                          Claimed ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const res = claimEightReferralTier(tier.targetReferrals);
                            setEightRefState(res.state);
                            setBonusClaimNotice(res.message);
                            setTimeout(() => setBonusClaimNotice(null), 4000);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0 ${
                            isUnlocked
                              ? 'bg-[#FC4C01] hover:bg-[#e04300] text-white'
                              : secondaryBtn
                          }`}
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 4: FEEDBACK (CLEAN & SIMPLE)
             ========================================================= */}
          {activeTab === 'feedback' && (
            <div className="max-w-xl mx-auto space-y-4">
              <div className={`p-5 rounded-2xl border space-y-4 ${cardSurface}`}>
                <h3 className="text-base font-bold tracking-tight">Send Feedback</h3>

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'feature', label: 'Feature' },
                      { id: 'bug', label: 'Bug' },
                      { id: 'model_quality', label: 'Models' },
                      { id: 'research_tools', label: 'Study Tools' },
                      { id: 'ui_ux', label: 'Design' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFeedbackCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                        feedbackCategory === cat.id ? primaryBtn : secondaryBtn
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 mr-1">Rating:</span>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setFeedbackRating(score)}
                      className={`w-8 h-8 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                        feedbackRating === score ? primaryBtn : secondaryBtn
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={feedbackSubject}
                  onChange={(e) => setFeedbackSubject(e.target.value)}
                  maxLength={140}
                  placeholder="Subject (optional)..."
                  className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${inputSurface}`}
                />

                <textarea
                  rows={4}
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  maxLength={2400}
                  placeholder="What can we improve?"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none leading-relaxed ${inputSurface}`}
                />

                {feedbackError && (
                  <div className="text-xs text-red-400">{feedbackError}</div>
                )}

                {feedbackToast && (
                  <div className="text-xs text-emerald-400 font-medium">{feedbackToast}</div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submittingFeedback || feedbackMessage.trim().length < 4}
                    onClick={async () => {
                      setSubmittingFeedback(true);
                      setFeedbackError(null);
                      setFeedbackToast(null);
                      try {
                        const sub = UserAccountStore.getSubscription();
                        const res = await submitKinichFeedback({
                          category: feedbackCategory,
                          rating: feedbackRating,
                          subject: feedbackSubject,
                          message: feedbackMessage,
                          includeDiagnostics: true,
                          diagnosticsSummary: `Plan: ${sub.plan} | Threads: ${threads.length}`,
                        });
                        if (!res.ok) {
                          setFeedbackError(res.error || 'Could not submit feedback.');
                        } else {
                          setFeedbackSubject('');
                          setFeedbackMessage('');
                          setFeedbackToast('Feedback sent. Thank you!');
                          const updatedHistory = await fetchMySubmittedFeedback();
                          setMyFeedbackHistory(updatedHistory);
                        }
                      } finally {
                        setSubmittingFeedback(false);
                      }
                    }}
                    className={`px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 ${primaryBtn}`}
                  >
                    {submittingFeedback ? 'Sending…' : 'Send Feedback'}
                  </button>
                </div>
              </div>

              {myFeedbackHistory.length > 0 && (
                <div className={`p-4 rounded-2xl border space-y-2.5 ${cardSurface}`}>
                  <div className="text-xs font-semibold text-zinc-400">Recent Feedback</div>
                  <div className="space-y-2">
                    {myFeedbackHistory.slice(0, 5).map((fb) => (
                      <div
                        key={fb.id}
                        className={`p-3 rounded-xl border space-y-1 ${subCardSurface}`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span className="capitalize">{fb.category.replace('_', ' ')}</span>
                          <span>{new Date(fb.createdAt).toLocaleDateString()}</span>
                        </div>
                        {fb.subject && <div className="text-xs font-semibold">{fb.subject}</div>}
                        <p className="text-xs leading-relaxed opacity-85">{fb.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
