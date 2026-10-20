import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { GrokLogo } from './GrokLogo';
import { ChatMessage, SavedBookmark } from '../types';
import { BounceSidebar, BounceSidebarItem } from './ui/bounce-sidebar';
import { UserAccountStore } from '../lib/userAccountStore';


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
  onOpenAnalytics: () => void;
  onOpenAccountModal?: (tab?: string) => void;
  onOpenOnboarding?: () => void;
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(thread.title);

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
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((prev) => !prev);
        }}
        className={`p-1 rounded-lg transition-colors cursor-pointer ${
          isDark
            ? 'text-[#8a8a8a] hover:text-white hover:bg-[#2c2c2c]'
            : 'text-[#666666] hover:text-[#0d0d0d] hover:bg-[#e0e0e0]'
        }`}
        title="Chat options"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div
            className={`absolute right-0 top-7 z-40 w-44 rounded-2xl shadow-2xl border py-1.5 backdrop-blur-md ${
              isDark
                ? 'bg-[#1e1e1e]/95 border-[#2e2e2e] text-white'
                : 'bg-white/95 border-[#e0e0e0] text-[#0d0d0d]'
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
  onOpenAnalytics,
  onOpenAccountModal,
  onOpenOnboarding,
  onSelectPinnedMessage,
  theme,
  onToggleTheme,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [userProfile, setUserProfile] = useState(() => UserAccountStore.getProfile());
  const [userSub, setUserSub] = useState(() => UserAccountStore.getSubscription());
  const [pinnedMessages, setPinnedMessages] = useState<SavedBookmark[]>(() =>
    UserAccountStore.getBookmarks()
  );
  const isDark = theme === 'dark';

  useEffect(() => {
    const syncProfile = () => {
      setUserProfile(UserAccountStore.getProfile());
      setUserSub(UserAccountStore.getSubscription());
      setPinnedMessages(UserAccountStore.getBookmarks());
    };
    window.addEventListener('zeno-account-updated', syncProfile);
    return () => window.removeEventListener('zeno-account-updated', syncProfile);
  }, []);


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
    let currentActiveIdx = 1; // Default to "New Chat" when no thread is selected

    items.push({
      id: 'heading-workspace',
      label: 'Workspace',
      heading: true,
    });

    items.push({
      id: 'action-new-chat',
      label: 'New Conversation',
      onClick: () => {
        onNewChat();
        if (window.innerWidth < 768) onClose();
      },
    });

    if (filteredPinnedMessages.length > 0 || !normalizedQuery) {
      items.push({
        id: 'heading-pinned-messages',
        label:
          filteredPinnedMessages.length > 0
            ? `Pinned Messages (${filteredPinnedMessages.length})`
            : 'Pinned Messages',
        heading: true,
      });

      if (filteredPinnedMessages.length === 0) {
        items.push({
          id: 'pinned-empty-hint',
          label: 'No pinned responses yet',
          sublabel: 'Click the pin icon on any response',
        });
      } else {
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
    onNewChat,
    onClose,
    onSelectThread,
    onSelectPinnedMessage,
    onDeleteThread,
    onUpdateThreadTitle,
    onExportThread,
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
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <GrokLogo size="sm" isDark={isDark} />
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onClose();
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-[#8a8a8a] hover:text-white hover:bg-[#141414]'
                  : 'text-[#666666] hover:text-[#000000] hover:bg-[#f2f2f2]'
              }`}
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-[#8a8a8a] hover:text-white hover:bg-[#141414]'
                  : 'text-[#666666] hover:text-[#000000] hover:bg-[#f2f2f2]'
              }`}
              title="Close sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

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
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Rare UI BounceSidebar with motion arc dot animation */}
        <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
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

        {/* User Account & Settings Profile Row */}


        <div
          className={`p-3 border-t flex items-center justify-between text-xs ${
            isDark ? 'border-[#242424] text-[#8a8a8a]' : 'border-[#e5e5e5] text-[#6b6b6b]'
          }`}
        >
          <div className="flex items-center gap-1">

            <button
              onClick={onOpenSettings}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:text-white hover:bg-[#222222]' : 'hover:text-[#0d0d0d] hover:bg-[#eaeaea]'
              }`}
              title="Open settings"
            >
              <SettingsIcon className="w-4 h-4" />
              <span className="font-medium text-xs">Settings</span>
            </button>
          </div>

          <button
            onClick={onToggleTheme}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:text-white hover:bg-[#222222]' : 'hover:text-[#0d0d0d] hover:bg-[#eaeaea]'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#333333]" />}
          </button>
        </div>
      </aside>
    </>
  );
};
