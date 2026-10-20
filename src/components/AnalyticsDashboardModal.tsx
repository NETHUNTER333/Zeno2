import React, { useMemo } from 'react';
import {
  X,
  BarChart2,
  TrendingUp,
  Clock,
  Zap,
  Globe,
  Code,
  BookOpen,
  Sparkles,
  Layers
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
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ChatThread } from './Sidebar';

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
  // Aggregate topic and frequency analytics from historical chat threads
  const analyticsData = useMemo(() => {
    let totalMessages = 0;
    let totalTokensEstimate = 0;
    const categoryCounts: Record<string, number> = {
      'Science & ArXiv': 0,
      'Code & Dev': 0,
      'Web Search': 0,
      'General Q&A': 0,
    };

    const dateFrequency: Record<string, number> = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateFrequency[key] = 0;
    }

    threads.forEach((t) => {
      const threadDateKey = new Date(t.createdAt || Date.now()).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (dateFrequency[threadDateKey] !== undefined) {
        dateFrequency[threadDateKey] += 1;
      } else {
        dateFrequency[threadDateKey] = 1;
      }

      if (t.messages && Array.isArray(t.messages)) {
        totalMessages += t.messages.length;
        t.messages.forEach((m) => {
          totalTokensEstimate += Math.round((m.content || '').length / 3.5);

          const text = (m.content || '').toLowerCase();
          if (/arxiv|physics|quantum|black\s*hole|protein|genome|study/i.test(text) || (m.arxivPapers && m.arxivPapers.length > 0)) {
            categoryCounts['Science & ArXiv'] += 1;
          } else if (/code|python|react|github|script|function|sql|bug/i.test(text) || (m.githubRepos && m.githubRepos.length > 0)) {
            categoryCounts['Code & Dev'] += 1;
          } else if (m.sources && m.sources.length > 0) {
            categoryCounts['Web Search'] += 1;
          } else {
            categoryCounts['General Q&A'] += 1;
          }
        });
      }
    });

    const activityTrend = Object.entries(dateFrequency).map(([date, count]) => ({
      date,
      chats: count,
      queries: count * 3 + Math.floor(Math.random() * 4),
    }));

    const topicDistribution = Object.entries(categoryCounts).map(([name, value]) => ({
      name,
      value: Math.max(1, value),
    }));

    return {
      totalThreads: threads.length,
      totalMessages,
      totalTokensEstimate,
      activityTrend,
      topicDistribution,
    };
  }, [threads]);

  if (!isOpen) return null;

  const COLORS = ['#007aff', '#38bdf8', '#10b981', '#f59e0b'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark
            ? 'bg-[#121214] border-[#26262a] text-white'
            : 'bg-white border-[#e0e0e0] text-[#0d0d0d]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-2xl bg-[#007aff]/15 text-[#007aff] flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Chat Analytics & Topic Trends</h3>
              <p className="text-[11px] opacity-60 font-mono">
                Historical search frequency and category breakdown (Recharts powered)
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs opacity-60">Total Conversations</span>
                <Layers className="w-4 h-4 text-[#007aff]" />
              </div>
              <div className="font-mono text-2xl font-bold">{analyticsData.totalThreads}</div>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
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
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs opacity-60">Processed Tokens</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="font-mono text-2xl font-bold">
                {analyticsData.totalTokensEstimate >= 1000
                  ? `${(analyticsData.totalTokensEstimate / 1000).toFixed(1)}k`
                  : analyticsData.totalTokensEstimate}
              </div>
            </div>
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
                  <span>Activity & Search Frequency (Last 7 Days)</span>
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
                      name="Chats Created"
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
                    <XAxis type="number" stroke={isDark ? '#737373' : '#8a8a8a'} fontSize={11} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" stroke={isDark ? '#737373' : '#8a8a8a'} fontSize={11} width={100} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                        borderColor: isDark ? '#27272a' : '#e4e4e7',
                        borderRadius: '12px',
                        color: isDark ? '#fff' : '#000',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" name="Mentions" fill="#007aff" radius={[0, 8, 8, 0]}>
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
