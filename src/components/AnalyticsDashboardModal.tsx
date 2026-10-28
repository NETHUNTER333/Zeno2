import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  BarChart2,
  TrendingUp,
  Zap,
  Globe,
  Sparkles,
  Layers,
  Share2,
  Bookmark,
  Users,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChatThread } from './Sidebar';
import { GrowthFunnelSummary } from '../types';
import { fetchGrowthFunnelSummary, KnowledgeVaultStore } from '../lib/growthStore';

interface AnalyticsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  threads: ChatThread[];
  isDark?: boolean;
}

export const AnalyticsDashboardModal: React.FC<AnalyticsDashboardModalProps> = ({
  isOpen,
  onClose,
  threads,
  isDark = true,
}) => {
  const [growthSummary, setGrowthSummary] = useState<GrowthFunnelSummary | null>(null);
  const [loadingFunnel, setLoadingFunnel] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingFunnel(true);
    fetchGrowthFunnelSummary()
      .then((res) => {
        if (!cancelled && res) setGrowthSummary(res);
      })
      .finally(() => {
        if (!cancelled) setLoadingFunnel(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Aggregate deterministic topic and frequency analytics from real historical chat threads (zero Math.random())
  const analyticsData = useMemo(() => {
    let totalMessages = 0;
    let totalTokensEstimate = 0;
    const categoryCounts: Record<string, number> = {
      'Science & ArXiv': 0,
      'Code & Dev': 0,
      'Web Search': 0,
      'General Q&A': 0,
    };

    const dateChats: Record<string, number> = {};
    const dateQueries: Record<string, number> = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateChats[key] = 0;
      dateQueries[key] = 0;
    }

    threads.forEach((t) => {
      const threadDateKey = new Date(t.createdAt || Date.now()).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (dateChats[threadDateKey] !== undefined) {
        dateChats[threadDateKey] += 1;
      }

      if (t.messages && Array.isArray(t.messages)) {
        totalMessages += t.messages.length;
        const userMsgCount = t.messages.filter((m) => m.role === 'user').length;
        if (dateQueries[threadDateKey] !== undefined) {
          dateQueries[threadDateKey] += userMsgCount;
        }

        t.messages.forEach((m) => {
          totalTokensEstimate += Math.round((m.content || '').length / 3.5);

          const text = (m.content || '').toLowerCase();
          if (
            /arxiv|physics|quantum|black\s*hole|protein|genome|study/i.test(text) ||
            (m.arxivPapers && m.arxivPapers.length > 0)
          ) {
            categoryCounts['Science & ArXiv'] += 1;
          } else if (
            /code|python|react|github|script|function|sql|bug/i.test(text) ||
            (m.githubRepos && m.githubRepos.length > 0)
          ) {
            categoryCounts['Code & Dev'] += 1;
          } else if (m.sources && m.sources.length > 0) {
            categoryCounts['Web Search'] += 1;
          } else {
            categoryCounts['General Q&A'] += 1;
          }
        });
      }
    });

    const activityTrend = Object.keys(dateChats).map((date) => ({
      date,
      chats: dateChats[date] || 0,
      queries: dateQueries[date] || 0,
    }));

    const topicDistribution = Object.entries(categoryCounts).map(([name, value]) => ({
      name,
      value,
    }));

    const vaultItemsCount = KnowledgeVaultStore.getItems().length;

    return {
      totalThreads: threads.length,
      totalMessages,
      totalTokensEstimate,
      vaultItemsCount,
      activityTrend,
      topicDistribution,
    };
  }, [threads, isOpen]);

  if (!isOpen) return null;

  const COLORS = ['#007aff', '#38bdf8', '#10b981', '#f59e0b'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark
            ? 'bg-[#121214] border-[#26262a] text-white'
            : 'bg-white border-[#e0e0e0] text-[#0d0d0d]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-2xl bg-[#007aff]/15 text-[#007aff] flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                Workspace Telemetry & Growth Funnel Analytics
              </h3>
              <p className="text-[11px] opacity-60 font-mono">
                Observed research activity, Knowledge Vault retention, and verified referral funnel
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs opacity-60">Conversations</span>
                <Layers className="w-4 h-4 text-[#007aff]" />
              </div>
              <div className="font-mono text-2xl font-bold">{analyticsData.totalThreads}</div>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs opacity-60">Total Messages</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="font-mono text-2xl font-bold">{analyticsData.totalMessages}</div>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs opacity-60">Vault Insights</span>
                <Bookmark className="w-4 h-4 text-sky-400" />
              </div>
              <div className="font-mono text-2xl font-bold">{analyticsData.vaultItemsCount}</div>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs opacity-60">Est. Tokens</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="font-mono text-2xl font-bold">
                {analyticsData.totalTokensEstimate >= 1000
                  ? `${(analyticsData.totalTokensEstimate / 1000).toFixed(1)}k`
                  : analyticsData.totalTokensEstimate}
              </div>
            </div>
          </div>

          {/* Verified Growth Funnel Table */}
          <div
            className={`p-5 rounded-2xl border space-y-4 ${
              isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-400" />
                <h4 className="font-semibold text-xs">
                  Growth Engine Funnel (Deduplicated Server & Client Events)
                </h4>
              </div>
              <span className="text-[11px] font-mono opacity-60">
                {loadingFunnel
                  ? 'Refreshing…'
                  : `${growthSummary?.totalRecordedEvents || 0} recorded events`}
              </span>
            </div>

            {growthSummary ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                    1. Acquisition
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Public Page Opens</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.acquisition.publicArtifactVisits}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Discover Opens</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.acquisition.discoverResourceOpens}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Referral Link Visits</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.acquisition.referralVisits}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                    2. Activation
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">First Core Actions</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.activation.firstCoreActions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Vault Items Saved</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.activation.knowledgeItemsSaved}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Signups Completed</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.activation.signupsCompleted}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    3. Retention
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Returning Sessions</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.retention.returningSessions}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Weekly Brief Views</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.retention.weeklyReportsViewed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Observed Days</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.retention.activeDaysObserved}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400">
                    4. Virality
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Share Cards Created</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.virality.shareCardsCreated}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Public Pages Created</span>
                    <span className="font-mono font-semibold">
                      {growthSummary.virality.publicArtifactsCreated}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-70">Verified Referrals</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {growthSummary.virality.validatedReferrals}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs opacity-60">
                No growth funnel events recorded in this session yet.
              </div>
            )}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Activity & Search Frequency Trend */}
            <div
              className={`p-5 rounded-2xl border ${
                isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-xs flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#007aff]" />
                  <span>Conversation Activity (Last 7 Days)</span>
                </h4>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.activityTrend}>
                    <defs>
                      <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007aff" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#007aff" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      stroke={isDark ? '#737373' : '#8a8a8a'}
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={isDark ? '#737373' : '#8a8a8a'}
                      fontSize={11}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        borderColor: isDark ? '#27272a' : '#e4e4e7',
                        borderRadius: '12px',
                        color: isDark ? '#fff' : '#000',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="chats"
                      name="Threads Created"
                      stroke="#007aff"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorChats)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Topic Category Distribution */}
            <div
              className={`p-5 rounded-2xl border ${
                isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-xs flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>Topic & Domain Distribution</span>
                </h4>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.topicDistribution} layout="vertical">
                    <XAxis
                      type="number"
                      stroke={isDark ? '#737373' : '#8a8a8a'}
                      fontSize={11}
                      allowDecimals={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke={isDark ? '#737373' : '#8a8a8a'}
                      fontSize={11}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        borderColor: isDark ? '#27272a' : '#e4e4e7',
                        borderRadius: '12px',
                        color: isDark ? '#fff' : '#000',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" name="Messages" fill="#007aff" radius={[0, 8, 8, 0]}>
                      {analyticsData.topicDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
