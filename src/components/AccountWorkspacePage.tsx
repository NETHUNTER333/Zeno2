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
  Lock,
} from 'lucide-react';
import { UserAccountStore } from '../lib/userAccountStore';
import { UserProfile } from '../types';
import { GROK_MODELS, ModelOption, getModelRequiredTier } from './GrokModelPicker';
import { ChatThread } from './Sidebar';
import { DeleteAccountButton } from './DeleteAccountButton';
import { PricingModal } from './PricingModal';

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
  nsfwMode: boolean;
  onToggleNsfwMode: (enabled: boolean) => void;
  onClearAllHistory: () => void;
  onSelectThread?: (threadId: string) => void;
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
  nsfwMode,
  onToggleNsfwMode,
  onClearAllHistory,
  onSelectThread,
}) => {
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [profile, setProfile] = useState<UserProfile>(() => UserAccountStore.getProfile());
  const [savedSuccessAlert, setSavedSuccessAlert] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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

  const navItems: { id: AccountTab; label: string; icon: React.ReactNode }[] = [
    { id: 'pricing', label: 'Plans & Pricing ($1 / $5)', icon: <Zap className="w-4 h-4 text-amber-400" /> },
    { id: 'profile', label: 'Identity & Account', icon: <User className="w-4 h-4" /> },
    { id: 'chats_projects', label: 'Chat History & Export', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'preferences', label: 'App Preferences', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'database', label: 'Firebase & Cloud Backend', icon: <Database className="w-4 h-4" /> },
  ];

  const handleSaveProfile = (updates: Partial<UserProfile>) => {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    UserAccountStore.saveProfile(updated);
    triggerSuccessAlert('Account updated');
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
    a.download = `zeno_chat_export_${new Date().toISOString().slice(0, 10)}.json`;
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
          className={`md:hidden flex items-center gap-1.5 p-3 border-b shrink-0 overflow-x-auto ${
            isDark ? 'border-white/10 bg-[#121215]' : 'border-black/10 bg-neutral-50'
          }`}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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
          className={`hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r p-4 justify-between overflow-y-auto ${
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

            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10 scrollbar-thin">
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

            {/* Tab: Identity & Account */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Identity & Account</h2>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                    Manage your display name and account details.
                  </p>
                </div>

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

                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">Firebase Authentication</div>
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
                    Theme appearance, reasoning model, and search grounding.
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

                {/* Default Model */}
                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Active Reasoning Model
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {GROK_MODELS.map((model) => {
                      const isSelected = selectedModel.id === model.id;
                      const reqTier = getModelRequiredTier(model);
                      const isLocked = !UserAccountStore.canUseModel(reqTier);
                      return (
                        <div
                          key={model.id}
                          onClick={() => {
                            if (isLocked) {
                              setActiveTab('pricing');
                              return;
                            }
                            onSelectModel(model);
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? isDark
                                ? 'border-white bg-white/[0.08] text-white font-semibold'
                                : 'border-black bg-black/5 text-black font-semibold'
                              : isDark
                              ? 'border-white/10 hover:bg-white/[0.03] text-neutral-300'
                              : 'border-black/10 hover:bg-neutral-50 text-neutral-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs flex items-center gap-1.5 flex-wrap">
                              <span>{model.name}</span>
                              {reqTier === 'spark' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30">
                                  Spark $1
                                </span>
                              )}
                              {reqTier === 'fire' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                  Fire $5
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-0.5 truncate">{model.description}</div>
                          </div>
                          {isLocked ? (
                            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : isSelected ? (
                            <Check className="w-4 h-4 text-blue-400 shrink-0" />
                          ) : null}
                        </div>
                      );
                    })}
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

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-xs font-semibold">Technical Research / Unrestricted Analysis</div>
                      <div className="text-[11px] text-neutral-400">
                        Allow deep technical analysis without excessive safety filters.
                      </div>
                    </div>
                    <button
                      onClick={() => onToggleNsfwMode(!nsfwMode)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        nsfwMode
                          ? isDark ? 'bg-white' : 'bg-black'
                          : isDark ? 'bg-neutral-700' : 'bg-neutral-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${
                          nsfwMode
                            ? isDark ? 'translate-x-5 bg-black' : 'translate-x-5 bg-white'
                            : 'bg-white'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Firebase & Cloud Backend */}
            {activeTab === 'database' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Firebase Cloud Backend</h2>
                  <p className="text-xs sm:text-sm text-neutral-400 mt-1">
                    Connect Firebase Firestore for cloud persistence, user auth, and cross-device sync.
                  </p>
                </div>

                <div
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Firebase Firestore & Authentication</div>
                      <div className="text-xs text-neutral-400">
                        Production cloud database for chat threads, user accounts, and real-time syncing.
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-neutral-500/20 bg-neutral-500/5 text-xs text-neutral-400 leading-relaxed">
                    Cloud database setup requires user confirmation in the AI Studio environment. Once accepted, your chat history and user profile persist securely to Firestore.
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
