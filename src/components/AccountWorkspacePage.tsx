import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  FolderOpen,
  SlidersHorizontal,
  Database,
  Check,
  ChevronRight,
  Download,
  AlertTriangle,
  Sun,
  Moon,
  CheckCircle2,
  MessageSquare,
  Trash2,
  Zap,
  Flame,
  Bell,
  Clock,
  RefreshCw,
  Award,
  Gift,
  Shield,
  MapPin,
  Navigation,
} from 'lucide-react';
import {
  getStoredLocationPref,
  saveStoredLocationPref,
  clearStoredLocationPref,
  setSavedHomeCity,
  requestPreciseLocationOnTap,
  UserLocation,
} from '../lib/locationStore';
import {
  UserAccountStore,
  DailyStreakData,
  EvaluatedBadge,
} from '../lib/userAccountStore';
import { UserProfile } from '../types';
import { ModelOption } from './GrokModelPicker';
import { ChatThread } from './Sidebar';
import { DeleteAccountButton } from './DeleteAccountButton';
import { PricingModal } from './PricingModal';
import { auth, getAuthHeaders } from '../lib/firebase';
import { SiteFooter } from './LegalAndInfoPages';
import {
  BackgroundGradientMode,
  getModelGradientTheme,
  EXACT_SUNSET_ORANGE_THEME,
  setStoredBackgroundGradientMode,
} from '../lib/modelGradients';

export type AccountTab = 'profile' | 'pricing' | 'chats_projects' | 'preferences' | 'database';

interface AccountWorkspacePageProps {
  onBackToChat: () => void;
  initialTab?: AccountTab;
  threads: ChatThread[];
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  selectedModel: ModelOption;
  onSelectModel: (model: ModelOption) => void;
  webSearchDefault: boolean;
  onToggleWebSearchDefault: (enabled: boolean) => void;
  nsfwMode?: boolean;
  onToggleNsfwMode?: (enabled: boolean) => void;
  onClearAllHistory: () => void;
  onSelectThread?: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  bgGradientMode?: BackgroundGradientMode;
  onSelectBgGradientMode?: (mode: BackgroundGradientMode) => void;
}

export const AccountWorkspacePage: React.FC<AccountWorkspacePageProps> = ({
  onBackToChat,
  initialTab = 'profile',
  threads,
  theme,
  onThemeChange,
  selectedModel,
  onSelectModel,
  webSearchDefault,
  onToggleWebSearchDefault,
  nsfwMode = false,
  onToggleNsfwMode,
  onClearAllHistory,
  onSelectThread,
  onDeleteThread,
  bgGradientMode = 'dynamic-model',
  onSelectBgGradientMode,
}) => {
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [profile, setProfile] = useState<UserProfile>(() => UserAccountStore.getProfile());
  const [streak, setStreak] = useState<DailyStreakData>(() =>
    UserAccountStore.getDailyStreak(threads)
  );
  const [badges, setBadges] = useState<EvaluatedBadge[]>(() =>
    UserAccountStore.getEvaluatedBadges(threads)
  );
  const [backendSyncedAt, setBackendSyncedAt] = useState<number | null>(null);
  const [syncingBackend, setSyncingBackend] = useState<boolean>(false);
  const [savedSuccessAlert, setSavedSuccessAlert] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const refreshFromStore = () => {
      setProfile(UserAccountStore.getProfile());
      setStreak(UserAccountStore.getDailyStreak(threads));
      setBadges(UserAccountStore.getEvaluatedBadges(threads));
    };
    window.addEventListener('kinich-account-updated', refreshFromStore);
    return () => window.removeEventListener('kinich-account-updated', refreshFromStore);
  }, [threads]);

  useEffect(() => {
    // Load & sync profile + active model + streak reminder settings with backend on mount
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/user/profile-backend', { headers });
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data?.syncedAt) setBackendSyncedAt(data.syncedAt);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBackToChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBackToChat]);

  const triggerSuccessAlert = (msg: string) => {
    setSavedSuccessAlert(msg);
    setTimeout(() => setSavedSuccessAlert(null), 3000);
  };

  const isDark = theme === 'dark';
  const [locPref, setLocPref] = useState(() => getStoredLocationPref());

  const isAuthenticatedUser = Boolean(auth.currentUser && profile.signinProvider !== 'guest');

  const navItems: { id: AccountTab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile & Account', icon: <User className="w-4 h-4" /> },
    { id: 'pricing', label: 'Plans & Pricing ($3 / $7)', icon: <Zap className="w-4 h-4 text-[#FC4C01]" /> },
    { id: 'preferences', label: 'App Preferences', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'chats_projects', label: 'Chat History & Export', icon: <FolderOpen className="w-4 h-4" /> },
  ];

  const syncWithProfileBackend = async (extra?: Record<string, any>) => {
    setSyncingBackend(true);
    const resp = await UserAccountStore.syncProfileAndSettingsWithBackend({
      preferences: {
        selectedModelId: selectedModel.id,
        selectedModelName: selectedModel.name,
        webSearchDefault,
        nsfwMode: false,
        theme,
      },
      ...(extra || {}),
    });
    if (resp?.syncedAt) {
      setBackendSyncedAt(resp.syncedAt);
    } else {
      setBackendSyncedAt(Date.now());
    }
    setSyncingBackend(false);
  };

  const handleSaveProfile = (updates: Partial<UserProfile>) => {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    UserAccountStore.saveProfile(updated);
    syncWithProfileBackend({ profile: updated });
    triggerSuccessAlert('Profile & backend synced');
  };

  const handleExportAll = () => {
    const exportData = {
      profile: {
        displayName: profile.displayName,
        username: profile.username,
        email: profile.email,
      },
      exportedAt: new Date().toISOString(),
      threadCount: threads.length,
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        createdAt: t.createdAt,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinich_chat_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerSuccessAlert('Exported all conversations');
  };

  const currentTabItem = navItems.find((n) => n.id === activeTab) || navItems[0];

  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden select-text transition-colors duration-200 ${
        isDark ? 'bg-[#09090b] text-[#f4f4f5]' : 'bg-[#fafafa] text-[#09090b]'
      }`}
    >
      {/* Top Header Navigation Bar */}
      <header
        className={`h-14 px-4 sm:px-6 border-b flex items-center justify-between shrink-0 z-20 backdrop-blur-md ${
          isDark
            ? 'bg-[#09090b]/90 border-white/10'
            : 'bg-white/90 border-black/10 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToChat}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isDark
                ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white'
                : 'bg-neutral-100 hover:bg-neutral-200 border-black/10 text-black'
            }`}
            title="Return to Chat (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Chat</span>
            <kbd
              className={`hidden sm:inline-block text-[10px] px-1 py-0.2 rounded border font-mono ${
                isDark ? 'bg-black/40 border-white/20 text-neutral-400' : 'bg-white border-black/20 text-neutral-600'
              }`}
            >
              Esc
            </kbd>
          </button>

          <div className="h-4 w-px bg-neutral-500/20 hidden sm:block" />

          {/* Breadcrumbs */}
          <nav className="hidden sm:flex items-center gap-2 text-xs font-medium text-neutral-400">
            <span>Settings</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
              {currentTabItem.label}
            </span>
          </nav>
        </div>

        {/* Right Header Status */}
        <div className="flex items-center gap-3">
          {savedSuccessAlert && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{savedSuccessAlert}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pl-2">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-white/20 shrink-0 bg-neutral-800 flex items-center justify-center font-bold text-xs text-white">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <span>{(profile.displayName || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="hidden sm:block text-xs font-semibold">{profile.displayName || 'User'}</div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Mobile Tab Switcher */}
        <div
          role="tablist"
          aria-label="Account and settings sections"
          className={`md:hidden flex items-center gap-1.5 p-3 border-b shrink-0 overflow-x-auto scrollbar-none ${
            isDark ? 'border-white/10 bg-[#121215]' : 'border-black/10 bg-neutral-50'
          }`}
        >
          {navItems.map((item, idx) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`account-mobile-tab-${item.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`account-tabpanel-${item.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = navItems[(idx + 1) % navItems.length];
                    setActiveTab(next.id);
                    document.getElementById(`account-mobile-tab-${next.id}`)?.focus();
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = navItems[(idx - 1 + navItems.length) % navItems.length];
                    setActiveTab(prev.id);
                    document.getElementById(`account-mobile-tab-${prev.id}`)?.focus();
                  } else if (e.key === 'Home') {
                    e.preventDefault();
                    setActiveTab(navItems[0].id);
                    document.getElementById(`account-mobile-tab-${navItems[0].id}`)?.focus();
                  } else if (e.key === 'End') {
                    e.preventDefault();
                    const last = navItems[navItems.length - 1];
                    setActiveTab(last.id);
                    document.getElementById(`account-mobile-tab-${last.id}`)?.focus();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? isDark
                      ? 'bg-white text-black font-semibold'
                      : 'bg-black text-white font-semibold'
                    : isDark
                    ? 'text-neutral-400 hover:text-white bg-white/5'
                    : 'text-neutral-600 hover:text-black bg-black/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Desktop Left Navigation Rail */}
        <aside
          className={`hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r p-4 justify-between overflow-y-auto slim-scrollbar ${
            isDark ? 'border-white/10 bg-[#0d0d10]' : 'border-black/10 bg-[#f7f7f9]'
          }`}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl border flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0 bg-neutral-800 flex items-center justify-center font-bold text-sm text-white">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span>{(profile.displayName || 'U').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold truncate">{profile.displayName || 'User'}</div>
                <div className="text-[11px] text-neutral-400 truncate">@{profile.username || 'user'}</div>
              </div>
            </div>

            <nav role="tablist" aria-label="Account and settings navigation" className="space-y-1">
              {navItems.map((item, idx) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`account-desktop-tab-${item.id}`}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`account-tabpanel-${item.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = navItems[(idx + 1) % navItems.length];
                        setActiveTab(next.id);
                        document.getElementById(`account-desktop-tab-${next.id}`)?.focus();
                      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = navItems[(idx - 1 + navItems.length) % navItems.length];
                        setActiveTab(prev.id);
                        document.getElementById(`account-desktop-tab-${prev.id}`)?.focus();
                      } else if (e.key === 'Home') {
                        e.preventDefault();
                        setActiveTab(navItems[0].id);
                        document.getElementById(`account-desktop-tab-${navItems[0].id}`)?.focus();
                      } else if (e.key === 'End') {
                        e.preventDefault();
                        const last = navItems[navItems.length - 1];
                        setActiveTab(last.id);
                        document.getElementById(`account-desktop-tab-${last.id}`)?.focus();
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? isDark
                          ? 'bg-white text-black font-semibold'
                          : 'bg-black text-white font-semibold'
                        : isDark
                        ? 'text-neutral-300 hover:bg-white/5 hover:text-white'
                        : 'text-neutral-600 hover:bg-black/5 hover:text-black'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-neutral-500/10">
            <button
              onClick={onBackToChat}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                isDark
                  ? 'border-white/10 hover:bg-white/10 text-neutral-300 hover:text-white'
                  : 'border-black/10 hover:bg-black/5 text-neutral-700 hover:text-black'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Back to Chat</span>
            </button>
          </div>
        </aside>

        {/* Right Main Content Canvas */}
        <main
          id={`account-tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`account-desktop-tab-${activeTab}`}
          className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10 slim-scrollbar"
        >
          <div className={`${activeTab === 'pricing' ? 'max-w-6xl' : 'max-w-3xl'} mx-auto space-y-6 pb-16`}>
            {/* Tab: Plans & Pricing ($1 Spark / $5 Fire) */}
            {activeTab === 'pricing' && (
              <PricingModal
                isOpen={true}
                onClose={onBackToChat}
                isDark={isDark}
                embedded={true}
              />
            )}

            {/* Tab: Profile, AI Model & Backend */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                      Profile & Backend
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                      Unified profile identity, daily streak reminders, and live backend sync.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      syncWithProfileBackend();
                      triggerSuccessAlert('Synced profile & AI settings to backend');
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/15 text-white'
                        : 'bg-white hover:bg-neutral-100 border-black/15 text-black'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingBackend ? 'animate-spin' : ''}`} />
                    <span>
                      {syncingBackend
                        ? 'Syncing Backend...'
                        : backendSyncedAt
                        ? `Backend Synced · ${new Date(backendSyncedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'Sync Backend Now'}
                    </span>
                  </button>
                </div>

                {/* Identity Card */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={profile.displayName}
                        onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                        onBlur={() => handleSaveProfile({ displayName: profile.displayName })}
                        className={`w-full px-3 py-2 rounded-xl border text-sm font-medium outline-none transition-all ${
                          isDark
                            ? 'bg-black/50 border-white/15 focus:border-white text-white'
                            : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                        }`}
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-1">
                        Username
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-neutral-500">@</span>
                        <input
                          type="text"
                          value={profile.username}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                            })
                          }
                          onBlur={() => handleSaveProfile({ username: profile.username })}
                          className={`w-full pl-7 pr-3 py-2 rounded-xl border text-sm font-medium outline-none transition-all ${
                            isDark
                              ? 'bg-black/50 border-white/15 focus:border-white text-white'
                              : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                          }`}
                          placeholder="username"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-400 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        onBlur={() => handleSaveProfile({ email: profile.email })}
                        className={`w-full px-3 py-2 rounded-xl border text-sm font-medium outline-none transition-all ${
                          isDark
                            ? 'bg-black/50 border-white/15 focus:border-white text-white'
                            : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Daily Streak & Reminder Notification Settings Card */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center shrink-0">
                        <Flame className="w-4 h-4 text-[#FC4C01] fill-[#FC4C01]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-2">
                          <span>Daily Streak & Reminder Notifications</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30">
                            {streak.currentStreak}d Streak
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          Reminds you via toast notification if you haven't completed your daily Kinich interaction by your scheduled time.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = UserAccountStore.updateStreakReminderSettings({
                          reminderEnabled: !streak.reminderEnabled,
                        });
                        setStreak(updated);
                        triggerSuccessAlert(
                          updated.reminderEnabled
                            ? `Daily reminder enabled (${updated.reminderTime})`
                            : 'Daily reminder paused'
                        );
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                        streak.reminderEnabled
                          ? 'bg-[#FC4C01]'
                          : isDark
                          ? 'bg-neutral-700'
                          : 'bg-neutral-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          streak.reminderEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-500/10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-neutral-400 inline-flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-[#FC4C01]" />
                        <span>Reminder Time:</span>
                      </span>
                      {['09:00', '12:00', '18:00', '20:00', '21:30'].map((t) => {
                        const isAct = (streak.reminderTime || '18:00') === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              const updated = UserAccountStore.updateStreakReminderSettings({
                                reminderEnabled: true,
                                reminderTime: t,
                              });
                              setStreak(updated);
                              triggerSuccessAlert(`Reminder scheduled for ${t}`);
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums cursor-pointer transition-colors ${
                              isAct
                                ? 'bg-[#FC4C01]/15 border-[#FC4C01] text-[#FC4C01] font-semibold'
                                : isDark
                                ? 'border-white/10 hover:border-white/25 text-neutral-300'
                                : 'border-black/10 hover:border-black/25 text-neutral-700'
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                      <input
                        type="time"
                        aria-label="Daily reminder time"
                        value={streak.reminderTime || '18:00'}
                        onChange={(e) => {
                          const updated = UserAccountStore.updateStreakReminderSettings({
                            reminderEnabled: true,
                            reminderTime: e.target.value,
                          });
                          setStreak(updated);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-mono outline-none ${
                          isDark
                            ? 'bg-black/50 border-white/15 text-white'
                            : 'bg-neutral-50 border-black/15 text-black'
                        }`}
                      />
                    </div>

                    <div className="text-[11px] text-neutral-400 font-mono">
                      Scheduled daily at {streak.reminderTime || '18:00'}
                    </div>
                  </div>
                </div>

                {/* Opt-in Location Awareness Settings Card */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-[#FC4C01]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-2">
                          <span>Location Awareness</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30">
                            {locPref.usePreciseLocation
                              ? `Precise: ${locPref.preciseLocation?.city || 'GPS'}`
                              : locPref.homeCity
                              ? `Saved: ${locPref.homeCity}`
                              : 'IP Approximate (Default)'}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          Kinich uses IP-based approximate location by default for local weather &amp; search. No permissions required.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (locPref.usePreciseLocation) {
                          saveStoredLocationPref({ usePreciseLocation: false, preciseLocation: null });
                          setLocPref(getStoredLocationPref());
                          triggerSuccessAlert('Precise location turned off');
                        } else {
                          try {
                            const loc = await requestPreciseLocationOnTap();
                            setLocPref(getStoredLocationPref());
                            triggerSuccessAlert(`Precise location set to ${loc.city}`);
                          } catch (err: any) {
                            triggerSuccessAlert(err?.message || 'Could not fetch precise location');
                          }
                        }
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                        locPref.usePreciseLocation ? 'bg-[#FC4C01]' : isDark ? 'bg-neutral-700' : 'bg-neutral-300'
                      }`}
                      title="Toggle precise location (off by default)"
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          locPref.usePreciseLocation ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Home City Memory Section (Priority: Precise > Home City > IP) */}
                  <div className="pt-3 border-t border-neutral-500/10 space-y-2">
                    <div className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                      <span>Saved Home City (Memory)</span>
                      {locPref.homeCity && (
                        <span className="text-[10px] text-[#FC4C01] font-mono">Active Memory</span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      If you use a VPN or travel, Kinich uses your saved home city when IP location looks inaccurate.
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        defaultValue={locPref.homeCity || ''}
                        placeholder="e.g. Hyderabad, India"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.currentTarget as HTMLInputElement).value.trim();
                            setSavedHomeCity(val);
                            setLocPref(getStoredLocationPref());
                            triggerSuccessAlert(val ? `Saved home city: ${val}` : 'Cleared home city');
                          }
                        }}
                        id="kinich-home-city-input"
                        className={`flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none transition ${
                          isDark
                            ? 'bg-[#141418] border-white/15 text-white focus:border-[#FC4C01]'
                            : 'bg-white border-black/15 text-neutral-900 focus:border-[#FC4C01]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById('kinich-home-city-input') as HTMLInputElement | null;
                          const val = el?.value.trim() || '';
                          setSavedHomeCity(val);
                          setLocPref(getStoredLocationPref());
                          triggerSuccessAlert(val ? `Saved home city: ${val}` : 'Cleared home city');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition shrink-0"
                      >
                        Save City
                      </button>
                      {locPref.homeCity && (
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('kinich-home-city-input') as HTMLInputElement | null;
                            if (el) el.value = '';
                            setSavedHomeCity('');
                            setLocPref(getStoredLocationPref());
                            triggerSuccessAlert('Home city cleared');
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-medium cursor-pointer transition shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Streaks & Achievement Badges Vault Card */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4 text-[#FC4C01]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-2">
                          <span>Streaks & Achievement Badges</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30">
                            {badges.filter((b) => b.isUnlocked).length}/{badges.length} Unlocked
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          Earn badges by maintaining streaks, exploring models, and running study sessions. Claim bonus messages & shields.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg border border-white/10 text-xs font-mono tabular-nums inline-flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-[#FC4C01]" />
                        <span>
                          {streak.streakFreezes}/{streak.maxStreakFreezes || 3} Shields
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onBackToChat();
                          setTimeout(() => {
                            window.dispatchEvent(
                              new CustomEvent('kinich-open-streak-modal', {
                                detail: { tab: 'badges' },
                              })
                            );
                          }, 60);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Open Streak & Badges Center
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {badges.map((b) => (
                      <div
                        key={b.id}
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                          b.isUnlocked
                            ? b.isFeatured
                              ? 'bg-[#FC4C01]/10 border-[#FC4C01]/50'
                              : isDark
                              ? 'bg-white/[0.03] border-white/15'
                              : 'bg-neutral-50 border-black/15'
                            : isDark
                            ? 'bg-black/30 border-white/[0.06] opacity-70'
                            : 'bg-neutral-50/60 border-black/[0.06] opacity-75'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-semibold truncate">{b.title}</span>
                            <span className="text-[10px] font-mono tabular-nums text-[#FC4C01]">
                              {Math.min(b.currentValue, b.targetValue)}/{b.targetValue}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                            {b.subtitle}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-neutral-500/10">
                          <span className="text-[10px] font-mono tabular-nums text-[#FC4C01]">
                            +{b.bonusMessages} Msgs · +{b.bonusUploads} Uploads
                          </span>
                          <div className="flex items-center gap-1">
                            {b.isUnlocked && !b.isFeatured && (
                              <button
                                type="button"
                                onClick={() => {
                                  UserAccountStore.setFeaturedBadge(b.id);
                                  setBadges(UserAccountStore.getEvaluatedBadges(threads));
                                  triggerSuccessAlert(`Equipped "${b.title}" badge`);
                                }}
                                className={`px-2 py-0.5 rounded border text-[10px] font-medium cursor-pointer ${
                                  isDark
                                    ? 'border-white/15 hover:bg-white/10 text-white'
                                    : 'border-black/15 hover:bg-black/5 text-black'
                                }`}
                              >
                                Equip
                              </button>
                            )}
                            {b.isFeatured && (
                              <span className="px-1.5 py-0.5 rounded bg-[#FC4C01]/20 text-[#FC4C01] text-[9.5px] font-mono font-semibold">
                                Equipped
                              </span>
                            )}
                            {b.isClaimed ? (
                              <span className="text-[10px] font-mono text-neutral-400 inline-flex items-center gap-0.5">
                                <Check className="w-3 h-3 text-[#FC4C01]" /> Claimed
                              </span>
                            ) : b.isUnlocked ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const res = UserAccountStore.claimBadgeReward(b.id);
                                  setBadges(UserAccountStore.getEvaluatedBadges(threads));
                                  setStreak(UserAccountStore.getDailyStreak(threads));
                                  if (res.rewarded) {
                                    triggerSuccessAlert(
                                      `Claimed ${b.title} (+${b.bonusMessages} msgs, +${b.bonusUploads} uploads)`
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Gift className="w-2.5 h-2.5" /> Claim
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-neutral-500">
                                {b.progressPct}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Export (JSON) — Available to all users */}
                <div
                  className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold">Export My Data (Data Portability)</div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      Download a complete JSON archive of your profile, settings, streaks, badges, and chat threads.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportAll}
                    className={`px-4 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all shrink-0 ${
                      isDark
                        ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
                        : 'border-black/15 bg-black/5 hover:bg-black/10 text-black'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export My Data</span>
                  </button>
                </div>

                {isAuthenticatedUser ? (
                  <>
                    <div
                      className={`p-5 rounded-2xl border space-y-4 ${
                        isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold">Account Session</div>
                          <div className="text-xs text-neutral-400 mt-0.5">
                            Signed in via {profile.signinProvider === 'email' ? 'Email & Password' : 'Google OAuth'} ({profile.email})
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            await UserAccountStore.signOutUser();
                            setProfile(UserAccountStore.getProfile());
                            triggerSuccessAlert('Signed out successfully');
                          }}
                          className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold cursor-pointer transition-all"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>

                    <DeleteAccountButton
                      isDark={isDark}
                      onDeleted={() => {
                        setProfile(UserAccountStore.getProfile());
                        triggerSuccessAlert('Account deleted successfully');
                      }}
                    />
                  </>
                ) : (
                  <div className="space-y-4">
                    <div
                      className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">Guest Workspace Session</div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          You are browsing as a guest. Sign in with Google or Email to sync your history across devices.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await UserAccountStore.signOutUser();
                          window.location.href = '/login';
                        }}
                        className="px-4 py-2 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold cursor-pointer transition-all shrink-0"
                      >
                        Sign In / Create Account
                      </button>
                    </div>

                    <div
                      className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isDark ? 'bg-red-950/10 border-red-500/20' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-red-500">Clear Guest Data</div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          Wipe all local guest chat history, study sets, and browser storage keys from this device.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClearAllHistory();
                          try {
                            localStorage.removeItem('kinich_threads_v3');
                            localStorage.removeItem('kinich_knowledge_vault_v1');
                            localStorage.removeItem('kinich_user_profile_v1');
                          } catch {}
                          triggerSuccessAlert('Guest data cleared from this browser');
                        }}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer transition-all shrink-0"
                      >
                        Clear Guest Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Chats & Projects */}
            {activeTab === 'chats_projects' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Chat History & Export</h2>
                    <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                      Manage and export your conversations.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportAll}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isDark ? 'border-white/10 hover:bg-white/10 text-white' : 'border-black/10 hover:bg-black/5 text-black'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" /> Export All (JSON)
                    </button>
                  </div>
                </div>

                <div
                  className={`rounded-2xl border overflow-hidden ${
                    isDark ? 'border-white/10 bg-white/[0.01]' : 'border-black/10 bg-white shadow-xs'
                  }`}
                >
                  <div
                    className={`p-3.5 border-b flex items-center justify-between ${
                      isDark ? 'border-white/10 bg-white/[0.02]' : 'border-black/10 bg-neutral-50'
                    }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Conversations ({threads.length})
                    </div>
                    {threads.length > 0 && (
                      <button
                        onClick={() => setConfirmClearHistory(true)}
                        className="text-[11px] font-semibold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Clear History
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-neutral-500/10">
                    {threads.map((t) => (
                      <div
                        key={t.id}
                        className={`p-3 sm:px-4 flex items-center justify-between gap-3 text-xs ${
                          isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                          <MessageSquare className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <div className="truncate font-medium">{t.title}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </span>
                          {onSelectThread && (
                            <button
                              onClick={() => {
                                onSelectThread(t.id);
                                onBackToChat();
                              }}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer ${
                                isDark
                                  ? 'border-white/10 hover:bg-white/10 text-white'
                                  : 'border-black/10 hover:bg-black/5 text-black'
                              }`}
                            >
                              Open
                            </button>
                          )}
                          {onDeleteThread && (
                            <button
                              type="button"
                              onClick={() => onDeleteThread(t.id)}
                              title="Delete thread"
                              aria-label="Delete thread"
                              className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {threads.length === 0 && (
                      <div className="p-8 text-center text-xs text-neutral-500">
                        No conversations yet.
                      </div>
                    )}
                  </div>
                </div>

                {confirmClearHistory && (
                  <div className="p-4 rounded-2xl border border-red-500/40 bg-red-500/10 flex items-center justify-between gap-4">
                    <div className="text-xs text-neutral-300">
                      Permanently delete all chat history?
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          onClearAllHistory();
                          setConfirmClearHistory(false);
                          triggerSuccessAlert('Chat history cleared');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setConfirmClearHistory(false)}
                        className="px-3 py-1.5 rounded-xl border border-neutral-500/30 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: App Preferences */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">App Preferences</h2>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                    Theme appearance and search grounding.
                  </p>
                </div>

                {/* Theme Switcher */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Theme
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => onThemeChange('dark')}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${
                        isDark
                          ? 'border-white bg-white/10 text-white font-bold'
                          : 'border-black/10 text-neutral-600 hover:bg-black/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4 text-amber-400" />
                        <span>Dark Mode</span>
                      </div>
                      {isDark && <Check className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => onThemeChange('light')}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${
                        !isDark
                          ? 'border-black bg-black/10 text-black font-bold'
                          : 'border-white/10 text-neutral-400 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-amber-500" />
                        <span>Light Mode</span>
                      </div>
                      {!isDark && <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Radiant Background & Model Signature Gradients */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                        Ambient Background Glow
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Top-centre warm amber (#FC4C01) background glow fading cleanly to near-black.
                      </p>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono ${
                        isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/[0.03]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#FC4C01]" />
                      <span className="font-semibold">{selectedModel.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Option 1: Warm Amber Glow (Default) */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBgGradientMode?.('dynamic-model');
                        setStoredBackgroundGradientMode('dynamic-model');
                        triggerSuccessAlert('Warm amber top-centre glow enabled');
                      }}
                      className={`p-3.5 rounded-xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${
                        bgGradientMode === 'dynamic-model' || bgGradientMode === 'exact-sunset'
                          ? 'border-[#FC4C01] ring-1 ring-[#FC4C01]/50 bg-[#FC4C01]/10'
                          : isDark
                          ? 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                          : 'border-black/10 hover:border-black/20 bg-neutral-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#FC4C01] shrink-0" />
                          <span className="text-xs font-bold">Warm Amber Glow</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Top-centre #FC4C01 ambient glow fading to near-black.
                        </p>
                      </div>
                      {(bgGradientMode === 'dynamic-model' || bgGradientMode === 'exact-sunset') && (
                        <Check className="w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" />
                      )}
                    </button>

                    {/* Option 2: Subtle Glow */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBgGradientMode?.('subtle');
                        setStoredBackgroundGradientMode('subtle');
                        triggerSuccessAlert('Subtle background glow enabled');
                      }}
                      className={`p-3.5 rounded-xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${
                        bgGradientMode === 'subtle'
                          ? 'border-[#FC4C01] ring-1 ring-[#FC4C01]/50 bg-[#FC4C01]/10'
                          : isDark
                          ? 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                          : 'border-black/10 hover:border-black/20 bg-neutral-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#FC4C01]/45 border border-[#FC4C01] shrink-0" />
                          <span className="text-xs font-bold">Subtle Glow</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Softer top-centre ambient lighting for minimal distraction.
                        </p>
                      </div>
                      {bgGradientMode === 'subtle' && (
                        <Check className="w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" />
                      )}
                    </button>

                    {/* Option 3: Solid Base (Off) */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBgGradientMode?.('off');
                        setStoredBackgroundGradientMode('off');
                        triggerSuccessAlert('Background glow disabled (solid base)');
                      }}
                      className={`p-3.5 rounded-xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer ${
                        bgGradientMode === 'off'
                          ? 'border-[#FC4C01] ring-1 ring-[#FC4C01]/50 bg-[#FC4C01]/10'
                          : isDark
                          ? 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                          : 'border-black/10 hover:border-black/20 bg-neutral-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border ${
                              isDark ? 'bg-black border-white/30' : 'bg-white border-black/30'
                            } shrink-0`}
                          />
                          <span className="text-xs font-bold">Solid Base (Off)</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Pure monochrome backdrop with zero ambient glow.
                        </p>
                      </div>
                      {bgGradientMode === 'off' && (
                        <Check className="w-4 h-4 text-[#FC4C01] shrink-0 mt-0.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Search & Mode Toggles - CONSISTENT STYLING */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Search Grounding
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-neutral-500/10">
                    <div>
                      <div className="text-xs font-semibold">Web Search Grounding</div>
                      <div className="text-[11px] text-neutral-400">
                        Enable real-time web search with Treg engine.
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={webSearchDefault}
                      aria-label="Web Search Grounding"
                      onClick={() => onToggleWebSearchDefault(!webSearchDefault)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        webSearchDefault
                          ? isDark ? 'bg-white' : 'bg-black'
                          : isDark ? 'bg-neutral-700' : 'bg-neutral-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${
                          webSearchDefault
                            ? isDark ? 'translate-x-5 bg-black' : 'translate-x-5 bg-white'
                            : 'bg-white'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-xs font-semibold flex items-center gap-2">
                        <span>SafeSearch & Adult Content Filter</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Strictly Enforced
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        Adult/NSFW questions, explicit image pulls, and adult video sites are permanently blocked.
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 px-2.5 py-1 rounded-md bg-neutral-800/60 border border-neutral-700/60">
                      Locked
                    </div>
                  </div>
                </div>

                {/* Legal, Trust & Compliance */}
                <div
                  className={`p-5 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Legal, Trust & Compliance
                    </div>
                    <span className="text-[10px] text-neutral-500 font-mono">DPDP Act 2023 · IT Act 2000</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {[
                      { title: 'Terms of Service', path: '/terms', desc: 'Acceptable use, subscriptions & accounts' },
                      { title: 'Privacy Policy', path: '/privacy', desc: 'Data handling, DPDP & subprocessors' },
                      { title: 'Refund Policy', path: '/refund', desc: '7-day refund guarantee' },
                      { title: 'Acceptable Use Policy', path: '/acceptable-use', desc: 'Safety rules & upload guidelines' },
                      { title: 'Cookie Notice', path: '/cookies', desc: 'Essential storage & preference cookies' },
                      { title: 'Contact & Grievance', path: '/contact', desc: 'Support & Grievance Officer SLA' },
                    ].map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('kinich-navigate-route', { detail: { path: item.path } }));
                        }}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between group cursor-pointer ${
                          isDark
                            ? 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20'
                            : 'border-black/10 bg-neutral-50/70 hover:bg-neutral-100/90 hover:border-black/20'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold group-hover:text-[#FC4C01] transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-neutral-400 truncate">
                            {item.desc}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 text-[11px] text-neutral-400 flex items-center justify-between">
                    <span>Contact: <strong className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>kinich.app@kinich.app</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('kinich-navigate-route', { detail: { path: '/legal' } }));
                      }}
                      className="text-[#FC4C01] hover:underline font-medium cursor-pointer"
                    >
                      Open Legal Hub →
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-8">
              <SiteFooter
                isDark={isDark}
                onNavigate={(path) => {
                  window.dispatchEvent(new CustomEvent('kinich-navigate-route', { detail: { path } }));
                }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
