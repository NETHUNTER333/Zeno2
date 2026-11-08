import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Search,
  ChevronLeft,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Check,
  Pencil,
  MoreHorizontal,
  Download,
  FileText,
  X,
  BarChart2,
  User,
  Brain,
  FolderOpen,
  Sparkles,
  ChevronRight,
  Pin,
  BookOpen,
  Compass,
  Bookmark,
  Share2,
  Zap,
  Flame,
  Trophy,
  MessageSquarePlus,
  Calendar as CalendarIcon,
  Shield,
  Gift,
  Award,
} from 'lucide-react';
import { GrokLogo } from './GrokLogo';
import { ChatMessage, SavedBookmark, KnowledgeVaultItem } from '../types';
import { BounceSidebar, BounceSidebarItem } from './ui/bounce-sidebar';
import {
  UserAccountStore,
  DailyStreakData,
  STREAK_MILESTONES,
  EvaluatedBadge,
} from '../lib/userAccountStore';
import { KnowledgeVaultStore } from '../lib/growthStore';
import { StreakModal } from './StreakModal';
import { auth } from '../lib/firebase';


export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  preview?: string;
  messages?: ChatMessage[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  onDeleteThread: (threadId: string) => void;
  onUpdateThreadTitle: (threadId: string, newTitle: string) => void;
  onExportThread?: (threadId: string, format: 'markdown' | 'pdf') => void;
  onOpenSettings: () => void;
  onOpenAccountModal?: (tab?: string) => void;
  onOpenOnboarding?: () => void;
  onOpenGrowthHub?: (tab: 'discover' | 'vault' | 'weekly' | 'passes' | 'feedback') => void;
  onOpenPricing?: (highlightPlan?: 'free' | 'spark' | 'fire') => void;
  onSelectPinnedMessage?: (threadId: string, messageId: string, snippet: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}


function getMatchingSnippet(thread: ChatThread, rawQuery: string): string | undefined {
  const q = rawQuery.trim().toLowerCase();
  if (!q || !thread.messages || thread.messages.length === 0) return undefined;

  for (const msg of thread.messages) {
    const content = (msg.content || '').replace(/\s+/g, ' ').trim();
    const idx = content.toLowerCase().indexOf(q);
    if (idx !== -1) {
      const start = Math.max(0, idx - 24);
      const end = Math.min(content.length, idx + q.length + 46);
      const prefix = start > 0 ? '…' : '';
      const suffix = end < content.length ? '…' : '';
      return `${prefix}${content.slice(start, end)}${suffix}`;
    }

    if (msg.attachments) {
      const attMatch = msg.attachments.find((a) => (a.name || '').toLowerCase().includes(q));
      if (attMatch) return `Attachment: ${attMatch.name}`;
    }
  }
  return undefined;
}

const ThreadTrailingMenu: React.FC<{
  thread: ChatThread;
  isDark: boolean;
  onDeleteThread: (id: string) => void;
  onUpdateThreadTitle: (id: string, title: string) => void;
  onExportThread?: (id: string, format: 'markdown' | 'pdf') => void;
}> = ({ thread, isDark, onDeleteThread, onUpdateThreadTitle, onExportThread }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(thread.title);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If within 230px of bottom, open upside above the item
      setOpenUpward(spaceBelow < 230);
    }
    setShowMenu((prev) => !prev);
  };

  const handleSaveTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (titleDraft.trim()) {
      onUpdateThreadTitle(thread.id, titleDraft.trim());
    }
    setIsEditingTitle(false);
    setShowMenu(false);
  };

  return (
    <div className="relative flex items-center">
      {isEditingTitle && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs`}
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingTitle(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-72 p-3.5 rounded-2xl border shadow-2xl ${
              isDark ? 'bg-[#18181b] border-white/15 text-white' : 'bg-white border-black/10 text-black'
            }`}
          >
            <div className="text-xs font-semibold mb-2">Rename conversation</div>
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (titleDraft.trim()) onUpdateThreadTitle(thread.id, titleDraft.trim());
                  setIsEditingTitle(false);
                } else if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                }
              }}
              className={`w-full rounded-xl border px-2.5 py-1.5 text-xs mb-2.5 outline-none ${
                isDark ? 'bg-black/40 border-white/15 text-white' : 'bg-neutral-50 border-black/15 text-black'
              }`}
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditingTitle(false)}
                className="px-2.5 py-1 rounded-lg text-xs opacity-70 hover:opacity-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTitle}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#FC4C01] text-white cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className={`p-1 rounded-lg transition-colors cursor-pointer ${
          isDark
            ? 'text-[#8a8a8a] hover:text-white hover:bg-[#2c2c2c]'
            : 'text-[#666666] hover:text-[#0d0d0d] hover:bg-[#e0e0e0]'
        }`}
        title="Chat options"
        aria-label="Chat options"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div
            className={`absolute right-0 z-50 w-44 rounded-2xl shadow-2xl border py-1.5 backdrop-blur-md ${
              openUpward ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-7 origin-top-right'
            } ${
              isDark
                ? 'bg-[#1e1e1e]/95 border-[#2e2e2e] text-white shadow-[0_-8px_30px_rgba(0,0,0,0.6)]'
                : 'bg-white/95 border-[#e0e0e0] text-[#0d0d0d] shadow-[0_-8px_30px_rgba(0,0,0,0.15)]'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTitleDraft(thread.title);
                setShowMenu(false);
                setIsEditingTitle(true);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f0f0f0]'
              }`}
            >
              <Pencil className="w-3.5 h-3.5 opacity-80" />
              <span>Rename</span>
            </button>

            {onExportThread && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onExportThread(thread.id, 'markdown');
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f0f0f0]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 opacity-80" />
                  <span>Export Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onExportThread(thread.id, 'pdf');
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f0f0f0]'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 opacity-80" />
                  <span>Export PDF</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDeleteThread(thread.id);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 transition-colors text-red-500 cursor-pointer ${
                isDark ? 'hover:bg-[#2a2a2a]' : 'hover:bg-[#f0f0f0]'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onUpdateThreadTitle,
  onExportThread,
  onOpenSettings,
  onOpenAccountModal,
  onOpenOnboarding,
  onOpenGrowthHub,
  onOpenPricing,
  onSelectPinnedMessage,
  theme,
  onToggleTheme,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kinich_sidebar_workspace_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [userProfile, setUserProfile] = useState(() => UserAccountStore.getProfile());
  const [userSub, setUserSub] = useState(() => UserAccountStore.getSubscription());
  const [usageQuota, setUsageQuota] = useState(() => UserAccountStore.getUsage());
  const [pinnedMessages, setPinnedMessages] = useState<SavedBookmark[]>(() =>
    UserAccountStore.getBookmarks()
  );
  const [vaultItems, setVaultItems] = useState<KnowledgeVaultItem[]>(() =>
    KnowledgeVaultStore.getAll()
  );
  const [dailyStreak, setDailyStreak] = useState<DailyStreakData>(() =>
    UserAccountStore.getDailyStreak(threads)
  );
  const [evaluatedBadges, setEvaluatedBadges] = useState<EvaluatedBadge[]>(() =>
    UserAccountStore.getEvaluatedBadges(threads)
  );
  const [showStreakPanel, setShowStreakPanel] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [streakModalTab, setStreakModalTab] = useState<
    'calendar' | 'badges' | 'milestones' | 'protection'
  >('calendar');
  const [isPlanPromoDismissed, setIsPlanPromoDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('kinich_plan_promo_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const isDark = theme === 'dark';

  const openStreakCenter = (
    tab: 'calendar' | 'badges' | 'milestones' | 'protection' = 'calendar'
  ) => {
    setStreakModalTab(tab);
    setShowStreakModal(true);
  };

  useEffect(() => {
    const handleOpenStreakEvent = (e: Event) => {
      const custom = e as CustomEvent<{
        tab?: 'calendar' | 'badges' | 'milestones' | 'protection';
      }>;
      openStreakCenter(custom.detail?.tab || 'calendar');
    };
    window.addEventListener('kinich-open-streak-modal', handleOpenStreakEvent);
    return () => window.removeEventListener('kinich-open-streak-modal', handleOpenStreakEvent);
  }, []);

  const toggleWorkspaceCollapsed = () => {
    setIsWorkspaceCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kinich_sidebar_workspace_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    setDailyStreak(UserAccountStore.getDailyStreak(threads));
    setEvaluatedBadges(UserAccountStore.getEvaluatedBadges(threads));
  }, [threads]);

  useEffect(() => {
    const syncProfile = () => {
      setUserProfile(UserAccountStore.getProfile());
      setUserSub(UserAccountStore.getSubscription());
      setUsageQuota(UserAccountStore.getUsage());
      setPinnedMessages(UserAccountStore.getBookmarks());
      setVaultItems(KnowledgeVaultStore.getAll());
      setDailyStreak(UserAccountStore.getDailyStreak(threads));
      setEvaluatedBadges(UserAccountStore.getEvaluatedBadges(threads));
    };
    window.addEventListener('kinich-account-updated', syncProfile);
    window.addEventListener('kinich-growth-updated', syncProfile);
    window.addEventListener('kinich-sage-organized', syncProfile);
    return () => {
      window.removeEventListener('kinich-account-updated', syncProfile);
      window.removeEventListener('kinich-growth-updated', syncProfile);
      window.removeEventListener('kinich-sage-organized', syncProfile);
    };
  }, [threads]);

  const unlockedBadgesCount = useMemo(
    () => evaluatedBadges.filter((b) => b.isUnlocked).length,
    [evaluatedBadges]
  );

  const featuredBadge = useMemo(
    () =>
      evaluatedBadges.find((b) => b.isFeatured && b.isUnlocked) ||
      evaluatedBadges.find((b) => b.isUnlocked) ||
      evaluatedBadges[0],
    [evaluatedBadges]
  );

  const last7DaysStrip = useMemo(() => {
    const activeSet = new Set(dailyStreak.activeDates || []);
    const frozenSet = new Set(dailyStreak.frozenDates || []);
    const days: Array<{
      key: string;
      label: string;
      isActive: boolean;
      isFrozen: boolean;
      goalMet: boolean;
      isToday: boolean;
    }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${dayNum}`;
      const label = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      const isActive = activeSet.has(key);
      const count = Number(dailyStreak.dailyCounts?.[key] || (isActive ? 1 : 0));
      days.push({
        key,
        label,
        isActive,
        isFrozen: frozenSet.has(key),
        goalMet: isActive && count >= (dailyStreak.dailyGoal || 3),
        isToday: i === 0,
      });
    }
    return days;
  }, [dailyStreak]);

  const nextStreakMilestone = useMemo(() => {
    const claimedSet = new Set(dailyStreak.claimedMilestones || []);
    const maxReached = Math.max(dailyStreak.currentStreak, dailyStreak.longestStreak);
    const unclaimedReady = STREAK_MILESTONES.find(
      (m) => maxReached >= m.days && !claimedSet.has(m.days)
    );
    if (unclaimedReady) return { milestone: unclaimedReady, canClaim: true };
    const upcoming =
      STREAK_MILESTONES.find((m) => m.days > dailyStreak.currentStreak) ||
      STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
    return { milestone: upcoming, canClaim: false };
  }, [dailyStreak]);


  const normalizedQuery = searchTerm.trim().toLowerCase();

  const filteredThreads = useMemo(() => {
    if (!normalizedQuery) return threads;

    return threads.filter((t) => {
      if ((t.title || '').toLowerCase().includes(normalizedQuery)) return true;
      if ((t.preview || '').toLowerCase().includes(normalizedQuery)) return true;

      if (Array.isArray(t.messages)) {
        for (const m of t.messages) {
          if ((m.content || '').toLowerCase().includes(normalizedQuery)) return true;
          if (
            Array.isArray(m.attachments) &&
            m.attachments.some((a) => (a.name || '').toLowerCase().includes(normalizedQuery))
          ) {
            return true;
          }
          if (
            Array.isArray(m.sources) &&
            m.sources.some(
              (s) =>
                (s.title || '').toLowerCase().includes(normalizedQuery) ||
                (s.snippet || '').toLowerCase().includes(normalizedQuery)
            )
          ) {
            return true;
          }
          if (
            Array.isArray(m.videos) &&
            m.videos.some((v) => (v.title || '').toLowerCase().includes(normalizedQuery))
          ) {
            return true;
          }
          if (
            Array.isArray(m.arxivPapers) &&
            m.arxivPapers.some((p) => (p.title || '').toLowerCase().includes(normalizedQuery))
          ) {
            return true;
          }
          if (
            Array.isArray(m.githubRepos) &&
            m.githubRepos.some((r) => (r.name || r.description || '').toLowerCase().includes(normalizedQuery))
          ) {
            return true;
          }
        }
      }
      return false;
    });
  }, [threads, normalizedQuery]);

  const filteredPinnedMessages = useMemo(() => {
    if (!normalizedQuery) return pinnedMessages;
    return pinnedMessages.filter(
      (bm) =>
        (bm.snippet || '').toLowerCase().includes(normalizedQuery) ||
        (bm.threadTitle || '').toLowerCase().includes(normalizedQuery)
    );
  }, [pinnedMessages, normalizedQuery]);

  // Build Rare UI BounceSidebar items from workspace actions, pinned messages & categorized threads
  const { bounceItems, activeBounceIndex } = useMemo(() => {
    const items: BounceSidebarItem[] = [];
    let currentActiveIdx = isWorkspaceCollapsed ? -1 : 1; // Default to "New Conversation" when expanded and no thread is selected

    items.push({
      id: 'heading-workspace',
      label: 'Workspace',
      heading: true,
      onClick: toggleWorkspaceCollapsed,
      trailing: (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-normal normal-case opacity-80">
          <span className="text-[10px]">{isWorkspaceCollapsed ? 'Show' : 'Hide'}</span>
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isWorkspaceCollapsed ? '' : 'rotate-90'
            }`}
          />
        </span>
      ),
    });

    if (!isWorkspaceCollapsed) {
      items.push({
        id: 'action-new-chat',
        label: 'New Conversation',
        icon: <Plus className="w-3.5 h-3.5 text-current" />,
        onClick: () => {
          onNewChat();
          if (window.innerWidth < 768) onClose();
        },
      });

      items.push({
        id: 'action-streaks-badges',
        label: 'Streaks & Badges',
        sublabel: `${dailyStreak.currentStreak}d streak · ${unlockedBadgesCount}/${evaluatedBadges.length} badges`,
        icon: <Award className="w-3.5 h-3.5 text-current" />,
        onClick: () => {
          openStreakCenter('badges');
        },
      });

      items.push({
        id: 'action-pricing',
        label: 'Plans & Pricing',
        sublabel: (() => {
          const c = localStorage.getItem('kinich_billing_country') || 'US';
          return c === 'IN' ? 'Spark (₹99/mo) · Fire (₹249/mo)' : 'Spark ($3/mo) · Fire ($7/mo)';
        })(),
        icon: <Zap className="w-3.5 h-3.5 text-current" />,
        onClick: () => {
          if (onOpenPricing) {
            onOpenPricing(undefined);
          } else if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kinich-open-pricing', { detail: {} })
            );
          }
          if (window.innerWidth < 768) onClose();
        },
      });

      if (onOpenGrowthHub) {
        items.push({
          id: 'action-discover',
          label: 'Kinich Discover',
          sublabel: 'Live arXiv papers & connected GitHub repos',
          icon: <Compass className="w-3.5 h-3.5 text-current" />,
          onClick: () => {
            onOpenGrowthHub('discover');
            if (window.innerWidth < 768) onClose();
          },
        });
        items.push({
          id: 'action-vault',
          label: 'The Vault',
          sublabel: UserAccountStore.isGuestUser()
            ? 'Sign in to save'
            : `${vaultItems.length} saved`,
          icon: <Bookmark className="w-3.5 h-3.5 text-[#FC4C01]" />,
          onClick: () => {
            if (UserAccountStore.isGuestUser()) {
              window.dispatchEvent(
                new CustomEvent('kinich-open-auth', {
                  detail: { reason: 'Sign in to keep this in your Vault' },
                })
              );
            } else {
              onOpenGrowthHub('vault');
            }
            if (window.innerWidth < 768) onClose();
          },
        });
        items.push({
          id: 'action-passes',
          label: 'Kinich Passes & Leaderboard',
          sublabel: 'Elite Referrer ranks & Top Contributors',
          icon: <Trophy className="w-3.5 h-3.5 text-current" />,
          onClick: () => {
            onOpenGrowthHub('passes');
            if (window.innerWidth < 768) onClose();
          },
        });
        items.push({
          id: 'action-feedback',
          label: 'Send Feedback',
          sublabel: 'Feature requests & bug reports',
          icon: <MessageSquarePlus className="w-3.5 h-3.5 text-current" />,
          onClick: () => {
            onOpenGrowthHub('feedback');
            if (window.innerWidth < 768) onClose();
          },
        });
      }
    }

    if (filteredPinnedMessages.length > 0) {
      items.push({
        id: 'heading-pinned-messages',
        label: `Pinned Messages (${filteredPinnedMessages.length})`,
        heading: true,
      });

      filteredPinnedMessages.forEach((bm) => {
        items.push({
          id: `pin-${bm.id}`,
          label: bm.snippet,
          sublabel: bm.threadTitle,
          icon: <Pin className="w-3 h-3 text-[#FC4C01] fill-current" />,
          onClick: () => {
            if (onSelectPinnedMessage) {
              onSelectPinnedMessage(bm.threadId, bm.messageId, bm.snippet);
            } else {
              onSelectThread(bm.threadId);
            }
            if (window.innerWidth < 768) onClose();
          },
          trailing: (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                UserAccountStore.toggleBookmark(bm);
              }}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-[#8a8a8a] hover:text-white hover:bg-[#2c2c2c]'
                  : 'text-[#666666] hover:text-[#0d0d0d] hover:bg-[#e0e0e0]'
              }`}
              title="Unpin message"
              aria-label="Unpin message"
            >
              <X className="w-3 h-3" />
            </button>
          ),
        });
      });
    }

    if (filteredThreads.length > 0) {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
      const yesterdayStart = todayStart - oneDayMs;
      const lastWeekStart = todayStart - 7 * oneDayMs;

      const groups: Record<string, ChatThread[]> = {
        Today: [],
        Yesterday: [],
        'Last Week': [],
        Older: [],
      };

      filteredThreads.forEach((t) => {
        const ts = t.createdAt || now;
        if (ts >= todayStart) {
          groups['Today'].push(t);
        } else if (ts >= yesterdayStart) {
          groups['Yesterday'].push(t);
        } else if (ts >= lastWeekStart) {
          groups['Last Week'].push(t);
        } else {
          groups['Older'].push(t);
        }
      });

      Object.entries(groups).forEach(([category, groupThreads]) => {
        if (groupThreads.length === 0) return;
        items.push({
          id: `heading-${category}`,
          label: normalizedQuery ? `${category} (${groupThreads.length})` : category,
          heading: true,
        });

        groupThreads.forEach((thread) => {
          const idx = items.length;
          if (thread.id === activeThreadId) {
            currentActiveIdx = idx;
          }
          items.push({
            id: `thread-${thread.id}`,
            label: thread.title,
            sublabel: normalizedQuery ? getMatchingSnippet(thread, normalizedQuery) : undefined,
            onClick: () => onSelectThread(thread.id),
            trailing: (
              <ThreadTrailingMenu
                thread={thread}
                isDark={isDark}
                onDeleteThread={onDeleteThread}
                onUpdateThreadTitle={onUpdateThreadTitle}
                onExportThread={onExportThread}
              />
            ),
          });
        });
      });
    }

    return { bounceItems: items, activeBounceIndex: currentActiveIdx };
  }, [
    filteredThreads,
    filteredPinnedMessages,
    activeThreadId,
    normalizedQuery,
    isDark,
    isWorkspaceCollapsed,
    onNewChat,
    onClose,
    onSelectThread,
    onSelectPinnedMessage,
    onOpenGrowthHub,
    onOpenPricing,
    onDeleteThread,
    onUpdateThreadTitle,
    onExportThread,
    dailyStreak.currentStreak,
    unlockedBadgesCount,
    evaluatedBadges.length,
    vaultItems,
    onOpenAccountModal,
  ]);

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 border-r backdrop-blur-2xl flex flex-col transition-all duration-200 ease-in-out select-none ${
          isDark
            ? 'bg-neutral-950/85 border-white/[0.1] text-white'
            : 'bg-white/85 border-black/[0.08] text-[#000000]'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full md:-ml-72'}`}
      >
        <div
          className={`p-3.5 border-b flex items-center justify-between ${
            isDark ? 'border-[#1a1a1a]' : 'border-[#e5e5e5]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onClose();
              }}
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
            >
              <GrokLogo size="sm" isDark={isDark} />
            </button>

            {/* Daily Streak & Badges Counter in Sidebar Header */}
            <button
              type="button"
              onClick={() => setShowStreakPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold font-mono tabular-nums transition-colors cursor-pointer ${
                isDark
                  ? showStreakPanel
                    ? 'bg-white/[0.08] border-white/20 text-white'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 text-neutral-200'
                  : showStreakPanel
                  ? 'bg-neutral-100 border-black/20 text-black'
                  : 'bg-neutral-50 hover:bg-neutral-100 border-black/10 text-neutral-800'
              }`}
              title={`Daily Streak: ${dailyStreak.currentStreak}d · ${unlockedBadgesCount}/${evaluatedBadges.length} Badges Unlocked`}
            >
              <Flame className="w-3.5 h-3.5 text-[#FC4C01] fill-[#FC4C01]/20 shrink-0" />
              <span>{dailyStreak.currentStreak}d</span>
              <span className="opacity-40">·</span>
              <Award className="w-3 h-3 text-[#FC4C01] shrink-0" />
              <span>{unlockedBadgesCount}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onClose();
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-[#a1a1aa] hover:text-white hover:bg-white/[0.06]'
                  : 'text-[#52525b] hover:text-[#000000] hover:bg-black/[0.05]'
              }`}
              title="New conversation"
              aria-label="New conversation"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.85"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-[#a1a1aa] hover:text-white hover:bg-white/[0.06]'
                  : 'text-[#52525b] hover:text-[#000000] hover:bg-black/[0.05]'
              }`}
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.85"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <rect x="3" y="3" width="18" height="18" rx="4.5" />
                <path d="M9.5 3v18" />
                <path d="M6 8h1.5" />
                <path d="M6 11.5h1.5" />
                <path d="M15.5 9.5 13 12l2.5 2.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expandable Daily Streak Breakdown Panel */}
        {showStreakPanel && (
          <div
            className={`mx-3 mt-2.5 p-3 rounded-xl border text-xs transition-all ${
              isDark
                ? 'bg-[#0d0d0d] border-white/10 text-neutral-200'
                : 'bg-neutral-50 border-black/10 text-neutral-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#FC4C01] fill-[#FC4C01]/20" />
                <span className="font-semibold tracking-tight">Daily Streak</span>
              </div>
              <div className="flex items-center gap-2 font-mono tabular-nums text-[10px]">
                <span className={isDark ? 'text-neutral-400' : 'text-neutral-500'}>
                  Best: {dailyStreak.longestStreak}d
                </span>
                <span className={isDark ? 'text-neutral-400' : 'text-neutral-500'}>·</span>
                <span className="inline-flex items-center gap-0.5 text-[#FC4C01]">
                  <Shield className="w-3 h-3" />
                  <span>
                    {dailyStreak.streakFreezes}/{dailyStreak.maxStreakFreezes || 3}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div
                className={`p-2 rounded-lg border ${
                  isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-black/[0.06]'
                }`}
              >
                <div
                  className={`text-[10px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}
                >
                  Current Streak
                </div>
                <div className="text-sm font-semibold font-mono tabular-nums mt-0.5">
                  {dailyStreak.currentStreak} {dailyStreak.currentStreak === 1 ? 'Day' : 'Days'}
                </div>
              </div>
              <div
                className={`p-2 rounded-lg border ${
                  isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-black/[0.06]'
                }`}
              >
                <div
                  className={`text-[10px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}
                >
                  Daily Goal
                </div>
                <div className="text-sm font-semibold font-mono tabular-nums mt-0.5">
                  {dailyStreak.todayInteractions} / {dailyStreak.dailyGoal || 3}x
                </div>
              </div>
            </div>

            {/* 7-Day Activity Strip */}
            <div className="flex items-center justify-between gap-1 pt-0.5 mb-2.5">
              {last7DaysStrip.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => openStreakCenter('calendar')}
                  className="flex flex-col items-center gap-1 flex-1 cursor-pointer group"
                  title={`${day.key} — Click to view full Streak Calendar`}
                >
                  <span
                    className={`text-[9px] font-mono ${
                      day.isToday
                        ? 'text-[#FC4C01] font-semibold'
                        : isDark
                        ? 'text-neutral-500'
                        : 'text-neutral-400'
                    }`}
                  >
                    {day.label}
                  </span>
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono tabular-nums border transition-colors ${
                      day.goalMet
                        ? 'bg-[#FC4C01] border-[#FC4C01] text-white font-semibold'
                        : day.isActive
                        ? 'bg-[#FC4C01]/15 border-[#FC4C01]/50 text-[#FC4C01]'
                        : day.isFrozen
                        ? isDark
                          ? 'bg-white/[0.06] border-white/25 text-neutral-300'
                          : 'bg-neutral-200 border-black/25 text-neutral-700'
                        : isDark
                        ? 'bg-white/[0.02] border-white/[0.06] text-neutral-600 group-hover:border-white/20'
                        : 'bg-white border-black/[0.06] text-neutral-300 group-hover:border-black/20'
                    }`}
                  >
                    {day.goalMet ? '★' : day.isActive ? '✓' : day.isFrozen ? '🛡' : '·'}
                  </span>
                </button>
              ))}
            </div>

            {/* Milestone Progress / Claim Strip */}
            <div
              className={`p-2 rounded-lg border mb-2.5 ${
                nextStreakMilestone.canClaim
                  ? 'bg-[#FC4C01]/10 border-[#FC4C01]/40'
                  : isDark
                  ? 'bg-white/[0.02] border-white/[0.06]'
                  : 'bg-white border-black/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10.5px] font-semibold truncate">
                    {nextStreakMilestone.milestone.title} ({nextStreakMilestone.milestone.days}d)
                  </div>
                  <div
                    className={`text-[9.5px] font-mono tabular-nums ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    +{nextStreakMilestone.milestone.bonusMessages} msgs · +
                    {nextStreakMilestone.milestone.bonusUploads} uploads
                  </div>
                </div>
                {nextStreakMilestone.canClaim ? (
                  <button
                    type="button"
                    onClick={() =>
                      UserAccountStore.claimStreakMilestone(nextStreakMilestone.milestone.days)
                    }
                    className="px-2 py-1 rounded-md bg-[#FC4C01] hover:bg-[#e04300] text-white text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Gift className="w-3 h-3" />
                    <span>Claim</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-mono tabular-nums text-[#FC4C01] font-semibold shrink-0">
                    {dailyStreak.currentStreak}/{nextStreakMilestone.milestone.days}d
                  </span>
                )}
              </div>
            </div>

            {/* Equipped Badge Row */}
            {featuredBadge && (
              <button
                type="button"
                onClick={() => openStreakCenter('badges')}
                className={`w-full p-2 rounded-lg border mb-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.08]'
                    : 'bg-white hover:bg-neutral-100 border-black/[0.08]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Award className="w-3.5 h-3.5 text-[#FC4C01] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-semibold truncate">
                      Badge: {featuredBadge.title}
                    </div>
                    <div
                      className={`text-[9.5px] font-mono tabular-nums ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      {unlockedBadgesCount}/{evaluatedBadges.length} unlocked · Click to view vault
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
              </button>
            )}

            {/* Quick Open Tabs for Calendar, Badges, Milestones, Shield */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => openStreakCenter('calendar')}
                className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/10 hover:bg-white/[0.06] text-neutral-200'
                    : 'border-black/10 hover:bg-black/[0.04] text-neutral-800'
                }`}
              >
                <CalendarIcon className="w-3 h-3 text-[#FC4C01] shrink-0" />
                <span className="truncate">Cal</span>
              </button>
              <button
                type="button"
                onClick={() => openStreakCenter('badges')}
                className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/10 hover:bg-white/[0.06] text-neutral-200'
                    : 'border-black/10 hover:bg-black/[0.04] text-neutral-800'
                }`}
              >
                <Award className="w-3 h-3 text-[#FC4C01] shrink-0" />
                <span className="truncate">Badges</span>
              </button>
              <button
                type="button"
                onClick={() => openStreakCenter('milestones')}
                className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/10 hover:bg-white/[0.06] text-neutral-200'
                    : 'border-black/10 hover:bg-black/[0.04] text-neutral-800'
                }`}
              >
                <Trophy className="w-3 h-3 text-[#FC4C01] shrink-0" />
                <span className="truncate">Goals</span>
              </button>
              <button
                type="button"
                onClick={() => openStreakCenter('protection')}
                className={`py-1.5 px-1.5 rounded-lg border text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/10 hover:bg-white/[0.06] text-neutral-200'
                    : 'border-black/10 hover:bg-black/[0.04] text-neutral-800'
                }`}
              >
                <Shield className="w-3 h-3 text-[#FC4C01] shrink-0" />
                <span className="truncate">Shield</span>
              </button>
            </div>
          </div>
        )}

        {/* Always-visible Search Bar filtering threads by title & full message content */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search
              className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                isDark ? 'text-[#666666]' : 'text-[#8a8a8a]'
              }`}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search messages & chats..."
              className={`w-full border rounded-xl pl-8 pr-7 py-2 text-xs focus:outline-none transition-colors ${
                isDark
                  ? 'bg-[#0a0a0a] border-[#1f1f1f] text-white placeholder-[#666666] focus:border-[#3a3a3a]'
                  : 'bg-[#ffffff] border-[#e5e5e5] text-[#000000] placeholder-[#8a8a8a] focus:border-[#999999]'
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors cursor-pointer ${
                  isDark
                    ? 'text-[#737373] hover:text-white hover:bg-[#1f1f1f]'
                    : 'text-[#8a8a8a] hover:text-black hover:bg-[#efefef]'
                }`}
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Rare UI BounceSidebar with motion arc dot animation */}
        <div className="flex-1 overflow-y-auto px-2 pt-1 pb-48 scrollbar-thin">
          <BounceSidebar
            items={bounceItems}
            value={activeBounceIndex}
            dotColor="#FC4C01"
          />

          {filteredThreads.length === 0 && (
            <div
              className={`px-3 py-6 text-center text-xs ${
                isDark ? 'text-[#666666]' : 'text-[#a3a3a3]'
              }`}
            >
              {threads.length === 0
                ? 'No conversations yet'
                : `No conversations matching "${searchTerm.trim()}"`}
            </div>
          )}
        </div>

        {/* Permanent Pricing & Quota Pill in Sidebar */}
        <div className="px-3 pb-2.5">
          {(() => {
            const planCheck: any = UserAccountStore.getNormalizedPlan(userSub.plan);
            return (
              <button
                type="button"
                onClick={() => {
                  if (onOpenPricing) {
                    onOpenPricing(undefined);
                  } else if (typeof window !== 'undefined') {
                    window.dispatchEvent(
                      new CustomEvent('kinich-open-pricing', {
                        detail: {},
                      })
                    );
                  }
                  if (window.innerWidth < 768) onClose();
                }}
                className={`relative w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  isDark
                    ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/15 text-white'
                    : 'bg-white hover:bg-neutral-50 border-black/10 text-[#18181b] shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-semibold text-xs tracking-tight flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#FC4C01] fill-[#FC4C01]/20 shrink-0" />
                    <span>
                      {planCheck === 'fire'
                        ? 'Fire Plan ($7)'
                        : planCheck === 'spark'
                        ? 'Spark Plan ($3 · 10x)'
                        : 'Plans & Pricing ($3 / $7)'}
                    </span>
                  </span>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold shrink-0 ${
                      isDark
                        ? 'bg-white text-[#18181b]'
                        : 'bg-[#18181b] text-white'
                    }`}
                  >
                    {planCheck === 'fire'
                      ? 'Active'
                      : planCheck === 'spark'
                      ? 'Upgrade $7'
                      : 'Start $3'}
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between text-[10.5px] font-mono ${
                    isDark ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  <span>
                    Uploads: {usageQuota.filesUploaded}/{usageQuota.fileUploadLimit}
                  </span>
                  <span>
                    Msgs: {usageQuota.messagesUsed}/{usageQuota.messageLimit}
                  </span>
                </div>
              </button>
            );
          })()}
        </div>

        {/* User Account, Streak Status & Unified Profile Backend Row */}
        <div
          className={`p-3 border-t flex items-center justify-between gap-2 text-xs ${
            isDark ? 'border-[#242424] text-[#8a8a8a]' : 'border-[#e5e5e5] text-[#6b6b6b]'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (onOpenAccountModal) {
                onOpenAccountModal('profile');
              } else {
                onOpenSettings();
              }
              if (window.innerWidth < 768) onClose();
            }}
            className={`flex items-center gap-2.5 min-w-0 flex-1 px-2 py-1.5 rounded-lg transition-colors cursor-pointer text-left ${
              isDark ? 'hover:text-white hover:bg-[#181818]' : 'hover:text-[#0d0d0d] hover:bg-[#f2f2f2]'
            }`}
            title="Open Profile, AI Model Backend & Settings"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 border ${
                isDark
                  ? 'bg-white/[0.06] border-white/15 text-white'
                  : 'bg-neutral-100 border-black/15 text-neutral-900'
              }`}
            >
              {(userProfile.displayName || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`truncate font-medium text-xs ${
                  isDark ? 'text-neutral-200' : 'text-neutral-900'
                }`}
              >
                {userProfile.displayName || 'User'}
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  openStreakCenter('badges');
                }}
                className="flex items-center gap-1 text-[10px] font-mono tabular-nums opacity-85 hover:opacity-100 hover:text-[#FC4C01] transition-colors"
                title="Open Streak Calendar, Achievement Badges & Reminder Settings"
              >
                <Flame className="w-2.5 h-2.5 text-[#FC4C01] fill-[#FC4C01]/20 shrink-0" />
                <span>
                  {dailyStreak.currentStreak}d · {unlockedBadgesCount} badges
                  {featuredBadge ? ` · ${featuredBadge.title}` : ''}
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggleTheme}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:text-white hover:bg-[#222222]' : 'hover:text-[#0d0d0d] hover:bg-[#eaeaea]'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      <StreakModal
        isOpen={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        streak={dailyStreak}
        isDark={isDark}
        initialTab={streakModalTab}
      />
    </>
  );
};
