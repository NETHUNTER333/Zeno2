import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Flame,
  Calendar as CalendarIcon,
  Trophy,
  Shield,
  ChevronLeft,
  ChevronRight,
  Check,
  Target,
  Activity,
  Gift,
  Bell,
  Clock,
  Award,
  Zap,
  Compass,
  BookOpen,
  Layers,
  Bookmark,
} from 'lucide-react';
import {
  UserAccountStore,
  DailyStreakData,
  STREAK_MILESTONES,
  EvaluatedBadge,
  toLocalDateKey,
} from '../lib/userAccountStore';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: DailyStreakData;
  isDark: boolean;
  initialTab?: 'calendar' | 'badges' | 'milestones' | 'protection';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DAILY_GOAL_OPTIONS: Array<{ value: number; label: string; desc: string }> = [
  { value: 1, label: '1x / day', desc: 'Casual maintenance' },
  { value: 3, label: '3x / day', desc: 'Regular momentum' },
  { value: 5, label: '5x / day', desc: 'Deep researcher' },
  { value: 10, label: '10x / day', desc: 'Intense workflow' },
];

export const StreakModal: React.FC<StreakModalProps> = ({
  isOpen,
  onClose,
  streak,
  isDark,
  initialTab = 'calendar',
}) => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'badges' | 'milestones' | 'protection'>(
    initialTab
  );
  const [badgeCategory, setBadgeCategory] = useState<
    'all' | 'streak' | 'mastery' | 'exploration' | 'curation'
  >('all');
  const [badges, setBadges] = useState<EvaluatedBadge[]>(() =>
    UserAccountStore.getEvaluatedBadges()
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setBadges(UserAccountStore.getEvaluatedBadges());
    }
  }, [isOpen, initialTab, streak]);
  const todayKey = useMemo(() => toLocalDateKey(), []);

  const [viewMonthDate, setViewMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const activeSet = useMemo(() => new Set(streak.activeDates || []), [streak.activeDates]);
  const frozenSet = useMemo(() => new Set(streak.frozenDates || []), [streak.frozenDates]);
  const claimedSet = useMemo(
    () => new Set(streak.claimedMilestones || []),
    [streak.claimedMilestones]
  );

  // Compute 30-day consistency percentage
  const consistency30d = useMemo(() => {
    const now = new Date();
    let activeInLast30 = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = toLocalDateKey(d.getTime());
      if (activeSet.has(key) || frozenSet.has(key)) {
        activeInLast30 += 1;
      }
    }
    // Scale relative to account span if fewer than 30 days since earliest active date
    const earliestKey = streak.activeDates?.[0] || todayKey;
    const [ey, em, ed] = earliestKey.split('-').map(Number);
    const earliestTs = new Date(ey, (em || 1) - 1, ed || 1).getTime();
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const spanDays = Math.max(1, Math.min(30, Math.round((todayTs - earliestTs) / 86400000) + 1));
    return Math.min(100, Math.round((activeInLast30 / spanDays) * 100));
  }, [activeSet, frozenSet, streak.activeDates, todayKey]);

  // Build calendar grid for viewMonthDate
  const calendarDays = useMemo(() => {
    const year = viewMonthDate.getFullYear();
    const month = viewMonthDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{
      key: string | null;
      dayNum: number | null;
      isActive: boolean;
      isFrozen: boolean;
      isToday: boolean;
      isFuture: boolean;
      count: number;
      goalMet: boolean;
    }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        key: null,
        dayNum: null,
        isActive: false,
        isFrozen: false,
        isToday: false,
        isFuture: false,
        count: 0,
        goalMet: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const key = `${year}-${mStr}-${dStr}`;
      const isActive = activeSet.has(key);
      const isFrozen = frozenSet.has(key);
      const count = Number(streak.dailyCounts?.[key] || (isActive ? 1 : 0));
      const isToday = key === todayKey;
      const isFuture = key > todayKey;
      const goalMet = isActive && count >= (streak.dailyGoal || 3);

      cells.push({
        key,
        dayNum: day,
        isActive,
        isFrozen,
        isToday,
        isFuture,
        count,
        goalMet,
      });
    }

    return cells;
  }, [viewMonthDate, activeSet, frozenSet, streak.dailyCounts, streak.dailyGoal, todayKey]);

  const monthStats = useMemo(() => {
    let activeDaysInMonth = 0;
    let totalInteractionsInMonth = 0;
    let goalMetDaysInMonth = 0;
    for (const c of calendarDays) {
      if (!c.key) continue;
      if (c.isActive) {
        activeDaysInMonth += 1;
        totalInteractionsInMonth += c.count;
      }
      if (c.goalMet) {
        goalMetDaysInMonth += 1;
      }
    }
    return { activeDaysInMonth, totalInteractionsInMonth, goalMetDaysInMonth };
  }, [calendarDays]);

  const nextMilestone = useMemo(() => {
    return (
      STREAK_MILESTONES.find((m) => m.days > streak.currentStreak) ||
      STREAK_MILESTONES[STREAK_MILESTONES.length - 1]
    );
  }, [streak.currentStreak]);

  const unclaimedCount = useMemo(() => {
    const maxReached = Math.max(streak.currentStreak, streak.longestStreak);
    return STREAK_MILESTONES.filter(
      (m) => maxReached >= m.days && !claimedSet.has(m.days)
    ).length;
  }, [streak.currentStreak, streak.longestStreak, claimedSet]);

  const unlockedBadgesCount = useMemo(
    () => badges.filter((b) => b.isUnlocked).length,
    [badges]
  );

  const unclaimedBadgesCount = useMemo(
    () => badges.filter((b) => b.isUnlocked && !b.isClaimed).length,
    [badges]
  );

  const filteredBadges = useMemo(() => {
    if (badgeCategory === 'all') return badges;
    return badges.filter((b) => b.category === badgeCategory);
  }, [badges, badgeCategory]);

  if (!isOpen) return null;

  const selectedDayInfo = (() => {
    const isAct = activeSet.has(selectedDateKey);
    const isFrz = frozenSet.has(selectedDateKey);
    const cnt = Number(streak.dailyCounts?.[selectedDateKey] || (isAct ? 1 : 0));
    const goalMet = isAct && cnt >= (streak.dailyGoal || 3);
    return { isAct, isFrz, cnt, goalMet };
  })();

  const handlePrevMonth = () => {
    setViewMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToday = () => {
    const now = new Date();
    setViewMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(todayKey);
  };

  const handleClaimMilestone = (days: number) => {
    const res = UserAccountStore.claimStreakMilestone(days);
    if (res.rewarded && res.milestone) {
      setStatusBanner(
        `Claimed ${res.milestone.title}: +${res.milestone.bonusMessages} messages, +${res.milestone.bonusUploads} uploads${
          res.milestone.bonusShields ? `, +${res.milestone.bonusShields} Streak Shield` : ''
        }`
      );
      setTimeout(() => setStatusBanner(null), 4500);
    }
  };

  const handleClaimBadge = (badgeId: string) => {
    const res = UserAccountStore.claimBadgeReward(badgeId);
    if (res.rewarded && res.badge) {
      setBadges(UserAccountStore.getEvaluatedBadges());
      setStatusBanner(
        `Badge Reward Claimed (${res.badge.title}): +${res.badge.bonusMessages} messages, +${res.badge.bonusUploads} uploads${
          res.badge.bonusShields ? `, +${res.badge.bonusShields} Streak Shield` : ''
        }`
      );
      setTimeout(() => setStatusBanner(null), 4500);
    }
  };

  const handleEquipBadge = (badgeId: string, badgeTitle: string) => {
    UserAccountStore.setFeaturedBadge(badgeId);
    setBadges(UserAccountStore.getEvaluatedBadges());
    setStatusBanner(`Equipped "${badgeTitle}" as your featured profile badge.`);
    setTimeout(() => setStatusBanner(null), 3200);
  };

  const renderBadgeIcon = (iconName: EvaluatedBadge['iconName']) => {
    switch (iconName) {
      case 'flame':
        return <Flame className="w-4 h-4 text-[#FC4C01] fill-[#FC4C01]/20" />;
      case 'trophy':
        return <Trophy className="w-4 h-4 text-[#FC4C01]" />;
      case 'zap':
        return <Zap className="w-4 h-4 text-[#FC4C01]" />;
      case 'compass':
        return <Compass className="w-4 h-4 text-[#FC4C01]" />;
      case 'book':
        return <BookOpen className="w-4 h-4 text-[#FC4C01]" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-[#FC4C01]" />;
      case 'layers':
        return <Layers className="w-4 h-4 text-[#FC4C01]" />;
      case 'award':
        return <Award className="w-4 h-4 text-[#FC4C01]" />;
      case 'bookmark':
        return <Bookmark className="w-4 h-4 text-[#FC4C01]" />;
      default:
        return <Award className="w-4 h-4 text-[#FC4C01]" />;
    }
  };

  const handleSelectDailyGoal = (goal: number) => {
    UserAccountStore.setDailyStreakGoal(goal);
    setStatusBanner(`Daily interaction target updated to ${goal}x per day.`);
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleForgeShield = () => {
    const res = UserAccountStore.refillStreakFreeze();
    if (res.refilled) {
      setStatusBanner('Streak Shield forged and equipped (+1 Shield).');
      setTimeout(() => setStatusBanner(null), 3500);
    }
  };

  const handleToggleReminder = () => {
    const nextEnabled = !streak.reminderEnabled;
    UserAccountStore.updateStreakReminderSettings({ reminderEnabled: nextEnabled });
    setStatusBanner(
      nextEnabled
        ? `Daily streak reminder enabled for ${streak.reminderTime || '18:00'}.`
        : 'Daily streak reminder paused.'
    );
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleChangeReminderTime = (newTime: string) => {
    if (!/^\d{2}:\d{2}$/.test(newTime)) return;
    UserAccountStore.updateStreakReminderSettings({
      reminderEnabled: true,
      reminderTime: newTime,
    });
    setStatusBanner(`Daily streak reminder time set to ${newTime}.`);
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleTestReminderToast = () => {
    window.dispatchEvent(new Event('zeno-trigger-streak-reminder'));
    setStatusBanner('Triggered daily streak reminder toast preview.');
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleTriggerMilestoneToast = (days: number) => {
    const p = UserAccountStore.triggerMilestoneToastPreview(days);
    if (p) {
      setStatusBanner(`Achievement Unlocked toast triggered: ${p.title} (${days}-Day Streak).`);
      setTimeout(() => setStatusBanner(null), 3500);
    }
  };

  const handleTriggerBadgeToast = (badgeId: string) => {
    const p = UserAccountStore.triggerBadgeToastPreview(badgeId);
    if (p) {
      setStatusBanner(`Achievement Unlocked toast triggered: ${p.title}.`);
      setTimeout(() => setStatusBanner(null), 3500);
    }
  };

  const todayGoalProgress = Math.min(
    100,
    Math.round((streak.todayInteractions / Math.max(1, streak.dailyGoal || 3)) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] ${
          isDark
            ? 'bg-[#0a0a0a] border-white/15 text-white'
            : 'bg-white border-black/10 text-neutral-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${
            isDark ? 'border-white/10 bg-white/[0.01]' : 'border-black/10 bg-neutral-50/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isDark
                  ? 'bg-[#FC4C01]/10 border-[#FC4C01]/30'
                  : 'bg-[#FC4C01]/10 border-[#FC4C01]/25'
              }`}
            >
              <Flame className="w-4 h-4 text-[#FC4C01] fill-[#FC4C01]/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Streaks, Badges & Consistency
                </h2>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#FC4C01]">
                  {streak.currentStreak} {streak.currentStreak === 1 ? 'Day' : 'Days'} ·{' '}
                  {unlockedBadgesCount}/{badges.length} Badges
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Calendar heatmap, achievement badges, milestone rewards & streak shield protection
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                : 'text-neutral-500 hover:text-black hover:bg-black/5'
            }`}
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top KPI Strip */}
        <div
          className={`grid grid-cols-4 border-b ${
            isDark ? 'border-white/10 bg-[#0d0d0d]' : 'border-black/10 bg-neutral-50/40'
          }`}
        >
          <div
            className={`px-4 py-3 border-r ${
              isDark ? 'border-white/10' : 'border-black/10'
            }`}
          >
            <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Current
            </div>
            <div className="text-base font-semibold font-mono tabular-nums mt-0.5 flex items-center gap-1">
              <span>{streak.currentStreak}d</span>
              <Flame className="w-3.5 h-3.5 text-[#FC4C01] fill-[#FC4C01]/20" />
            </div>
          </div>

          <div
            className={`px-4 py-3 border-r ${
              isDark ? 'border-white/10' : 'border-black/10'
            }`}
          >
            <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Best Streak
            </div>
            <div className="text-base font-semibold font-mono tabular-nums mt-0.5">
              {streak.longestStreak}d
            </div>
          </div>

          <div
            className={`px-4 py-3 border-r ${
              isDark ? 'border-white/10' : 'border-black/10'
            }`}
          >
            <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Badges Earned
            </div>
            <div className="text-base font-semibold font-mono tabular-nums mt-0.5 flex items-center gap-1">
              <span>
                {unlockedBadgesCount}/{badges.length}
              </span>
              <Award className="w-3.5 h-3.5 text-[#FC4C01]" />
            </div>
          </div>

          <div className="px-4 py-3">
            <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Consistency
            </div>
            <div className="text-base font-semibold font-mono tabular-nums mt-0.5">
              {consistency30d}%
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`px-4 sm:px-5 pt-3 border-b flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none text-xs ${
            isDark ? 'border-white/10' : 'border-black/10'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'calendar'
                ? 'border-[#FC4C01] text-[#FC4C01]'
                : isDark
                ? 'border-transparent text-neutral-400 hover:text-white'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Streak Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('badges')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'badges'
                ? 'border-[#FC4C01] text-[#FC4C01]'
                : isDark
                ? 'border-transparent text-neutral-400 hover:text-white'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Badges ({unlockedBadgesCount}/{badges.length})</span>
            {unclaimedBadgesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-[#FC4C01] text-white">
                {unclaimedBadgesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('milestones')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'milestones'
                ? 'border-[#FC4C01] text-[#FC4C01]'
                : isDark
                ? 'border-transparent text-neutral-400 hover:text-white'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Milestones</span>
            {unclaimedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-[#FC4C01] text-white">
                {unclaimedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('protection')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'protection'
                ? 'border-[#FC4C01] text-[#FC4C01]'
                : isDark
                ? 'border-transparent text-neutral-400 hover:text-white'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Shield & Goals</span>
          </button>
        </div>

        {/* Status Toast Banner */}
        {statusBanner && (
          <div
            className={`mx-5 mt-3 px-3.5 py-2 rounded-xl border text-xs flex items-center justify-between ${
              isDark
                ? 'bg-[#FC4C01]/10 border-[#FC4C01]/30 text-white'
                : 'bg-[#FC4C01]/10 border-[#FC4C01]/30 text-neutral-900'
            }`}
          >
            <span className="font-medium">{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto slim-scrollbar flex-1 space-y-4">
          {activeTab === 'calendar' && (
            <>
              {/* Month Navigation Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {viewMonthDate.toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                  <div
                    className={`text-[11px] font-mono tabular-nums ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {monthStats.activeDaysInMonth} active{' '}
                    {monthStats.activeDaysInMonth === 1 ? 'day' : 'days'} ·{' '}
                    {monthStats.totalInteractionsInMonth} interactions ·{' '}
                    {monthStats.goalMetDaysInMonth} full-goal{' '}
                    {monthStats.goalMetDaysInMonth === 1 ? 'day' : 'days'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleJumpToday}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                      isDark
                        ? 'border-white/10 hover:bg-white/[0.06] text-neutral-300'
                        : 'border-black/10 hover:bg-black/[0.04] text-neutral-700'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isDark
                        ? 'border-white/10 hover:bg-white/[0.06] text-neutral-300'
                        : 'border-black/10 hover:bg-black/[0.04] text-neutral-700'
                    }`}
                    title="Previous month"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isDark
                        ? 'border-white/10 hover:bg-white/[0.06] text-neutral-300'
                        : 'border-black/10 hover:bg-black/[0.04] text-neutral-700'
                    }`}
                    title="Next month"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 7-Column Calendar Grid */}
              <div
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-[#0f0f0f] border-white/10' : 'bg-neutral-50/70 border-black/10'
                }`}
              >
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {WEEKDAYS.map((dayName) => (
                    <div
                      key={dayName}
                      className={`text-center text-[10px] font-mono uppercase tracking-wider ${
                        isDark ? 'text-neutral-500' : 'text-neutral-400'
                      }`}
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((cell, idx) => {
                    if (!cell.key || cell.dayNum === null) {
                      return <div key={`empty-${idx}`} className="h-10 rounded-lg" />;
                    }

                    const isSelected = cell.key === selectedDateKey;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setSelectedDateKey(cell.key!)}
                        className={`h-10 rounded-lg border flex flex-col items-center justify-center relative font-mono tabular-nums transition-all cursor-pointer ${
                          cell.goalMet
                            ? 'bg-[#FC4C01] border-[#FC4C01] text-white font-semibold'
                            : cell.isActive
                            ? isDark
                              ? 'bg-[#FC4C01]/15 border-[#FC4C01]/50 text-[#FC4C01] font-semibold'
                              : 'bg-[#FC4C01]/15 border-[#FC4C01]/50 text-[#FC4C01] font-semibold'
                            : cell.isFrozen
                            ? isDark
                              ? 'bg-white/[0.06] border-white/25 text-neutral-200'
                              : 'bg-neutral-200/70 border-black/25 text-neutral-800'
                            : cell.isFuture
                            ? isDark
                              ? 'bg-transparent border-white/[0.03] text-neutral-700'
                              : 'bg-transparent border-black/[0.03] text-neutral-300'
                            : isDark
                            ? 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:border-white/20'
                            : 'bg-white border-black/[0.06] text-neutral-500 hover:border-black/20'
                        } ${
                          isSelected
                            ? isDark
                              ? 'ring-2 ring-white/70'
                              : 'ring-2 ring-black/70'
                            : ''
                        }`}
                        title={`${cell.key}: ${
                          cell.isActive
                            ? `${cell.count} interaction${cell.count === 1 ? '' : 's'}`
                            : cell.isFrozen
                            ? 'Protected by Streak Shield'
                            : 'No recorded activity'
                        }`}
                      >
                        <span className="text-xs leading-none">{cell.dayNum}</span>
                        <span className="text-[9px] leading-none mt-1 opacity-85">
                          {cell.goalMet
                            ? '★'
                            : cell.isActive
                            ? `${cell.count}x`
                            : cell.isFrozen
                            ? '🛡'
                            : cell.isToday
                            ? '•'
                            : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div
                  className={`mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${
                    isDark
                      ? 'border-white/10 text-neutral-400'
                      : 'border-black/10 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#FC4C01] inline-block" />
                      <span>Daily Goal Met ({streak.dailyGoal}x+)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#FC4C01]/25 border border-[#FC4C01]/60 inline-block" />
                      <span>Active (1x+)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-xs border inline-block ${
                          isDark ? 'bg-white/10 border-white/30' : 'bg-neutral-200 border-black/30'
                        }`}
                      />
                      <span>Shielded</span>
                    </span>
                  </div>
                  <span>Total: {streak.totalActiveDays} active days</span>
                </div>
              </div>

              {/* Selected Date Inspector */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10'
                }`}
              >
                <div>
                  <div className="text-xs font-semibold font-mono tabular-nums">
                    {selectedDateKey === todayKey ? `Today (${selectedDateKey})` : selectedDateKey}
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {selectedDayInfo.goalMet
                      ? `Daily goal achieved (${selectedDayInfo.cnt}/${streak.dailyGoal} interactions)`
                      : selectedDayInfo.isAct
                      ? `Streak recorded (${selectedDayInfo.cnt}/${streak.dailyGoal} toward daily goal)`
                      : selectedDayInfo.isFrz
                      ? 'Protected by Streak Shield — streak preserved'
                      : 'No interactions recorded on this date'}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                      selectedDayInfo.goalMet
                        ? 'bg-[#FC4C01]/15 border-[#FC4C01]/40 text-[#FC4C01]'
                        : selectedDayInfo.isAct
                        ? isDark
                          ? 'bg-white/[0.05] border-white/15 text-white'
                          : 'bg-neutral-100 border-black/15 text-neutral-900'
                        : isDark
                        ? 'bg-white/[0.02] border-white/10 text-neutral-500'
                        : 'bg-neutral-50 border-black/10 text-neutral-400'
                    }`}
                  >
                    {selectedDayInfo.cnt} {selectedDayInfo.cnt === 1 ? 'action' : 'actions'}
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'badges' && (
            <>
              {/* Badges Overview & Category Filter */}
              <div
                className={`p-3.5 rounded-xl border space-y-3 ${
                  isDark ? 'bg-[#0f0f0f] border-white/10' : 'bg-neutral-50 border-black/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#FC4C01]" />
                      <span>Achievement Badges Vault</span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      Unlock badges across streaks, AI exploration, and study sessions to claim bonus quota & shields.
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <span className="text-xs font-semibold text-[#FC4C01]">
                      {unlockedBadgesCount} / {badges.length}
                    </span>
                    <div
                      className={`text-[10px] ${
                        isDark ? 'text-neutral-500' : 'text-neutral-400'
                      }`}
                    >
                      Unlocked
                    </div>
                  </div>
                </div>

                {/* Category Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {(
                    [
                      { id: 'all', label: 'All Badges' },
                      { id: 'streak', label: 'Streaks' },
                      { id: 'mastery', label: 'Mastery' },
                      { id: 'exploration', label: 'Exploration' },
                      { id: 'curation', label: 'Shields & Pins' },
                    ] as const
                  ).map((cat) => {
                    const isAct = badgeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setBadgeCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                          isAct
                            ? 'bg-[#FC4C01] border-[#FC4C01] text-white'
                            : isDark
                            ? 'bg-white/[0.03] border-white/10 text-neutral-300 hover:border-white/25'
                            : 'bg-white border-black/10 text-neutral-700 hover:border-black/25'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Badges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredBadges.map((b) => {
                  const tierLabel =
                    b.tier === 'obsidian'
                      ? 'OBSIDIAN'
                      : b.tier === 'gold'
                      ? 'GOLD'
                      : b.tier === 'silver'
                      ? 'SILVER'
                      : 'BRONZE';

                  return (
                    <div
                      key={b.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                        b.isUnlocked
                          ? b.isFeatured
                            ? 'bg-[#FC4C01]/[0.09] border-[#FC4C01]/60'
                            : isDark
                            ? 'bg-white/[0.03] border-white/15'
                            : 'bg-white border-black/15'
                          : isDark
                          ? 'bg-[#0c0c0c] border-white/[0.06] opacity-75'
                          : 'bg-neutral-50/70 border-black/[0.07] opacity-80'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                                b.isUnlocked
                                  ? 'bg-[#FC4C01]/15 border-[#FC4C01]/40'
                                  : isDark
                                  ? 'bg-white/[0.03] border-white/10 opacity-60'
                                  : 'bg-neutral-100 border-black/10 opacity-60'
                              }`}
                            >
                              {renderBadgeIcon(b.iconName)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold truncate">{b.title}</span>
                                {b.isFeatured && (
                                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-[#FC4C01] text-white shrink-0">
                                    Equipped
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono uppercase tracking-wider text-[#FC4C01]/90">
                                {tierLabel} · {b.category}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-mono tabular-nums shrink-0 ${
                              b.isUnlocked
                                ? 'text-[#FC4C01] font-semibold'
                                : isDark
                                ? 'text-neutral-500'
                                : 'text-neutral-400'
                            }`}
                          >
                            {Math.min(b.currentValue, b.targetValue)}/{b.targetValue}
                          </span>
                        </div>

                        <p
                          className={`text-[11px] leading-snug ${
                            isDark ? 'text-neutral-400' : 'text-neutral-500'
                          }`}
                        >
                          {b.subtitle}
                        </p>

                        {/* Progress Bar */}
                        <div
                          className={`w-full h-1.5 rounded-full overflow-hidden ${
                            isDark ? 'bg-white/10' : 'bg-black/10'
                          }`}
                        >
                          <div
                            className="h-full bg-[#FC4C01] transition-all duration-300"
                            style={{ width: `${b.progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                        <div className="text-[10px] font-mono tabular-nums text-[#FC4C01]">
                          +{b.bonusMessages} Msgs · +{b.bonusUploads} Uploads
                          {b.bonusShields > 0 ? ` · +${b.bonusShields} Shield` : ''}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleTriggerBadgeToast(b.id)}
                            className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-colors cursor-pointer ${
                              isDark
                                ? 'border-white/15 hover:bg-white/10 text-neutral-300'
                                : 'border-black/15 hover:bg-black/5 text-neutral-700'
                            }`}
                            title="Preview Achievement Unlocked Toast"
                          >
                            Toast
                          </button>

                          {b.isUnlocked && !b.isFeatured && (
                            <button
                              type="button"
                              onClick={() => handleEquipBadge(b.id, b.title)}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer ${
                                isDark
                                  ? 'border-white/15 hover:bg-white/10 text-neutral-200'
                                  : 'border-black/15 hover:bg-black/5 text-neutral-800'
                              }`}
                            >
                              Equip
                            </button>
                          )}

                          {b.isClaimed ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono ${
                                isDark
                                  ? 'bg-white/[0.04] border-white/10 text-neutral-400'
                                  : 'bg-neutral-100 border-black/10 text-neutral-500'
                              }`}
                            >
                              <Check className="w-3 h-3 text-[#FC4C01]" />
                              <span>Claimed</span>
                            </span>
                          ) : b.isUnlocked ? (
                            <button
                              type="button"
                              onClick={() => handleClaimBadge(b.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-[10.5px] font-semibold transition-colors cursor-pointer"
                            >
                              <Gift className="w-3 h-3" />
                              <span>Claim</span>
                            </button>
                          ) : (
                            <span
                              className={`text-[10px] font-mono tabular-nums ${
                                isDark ? 'text-neutral-500' : 'text-neutral-400'
                              }`}
                            >
                              Locked ({b.progressPct}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'milestones' && (
            <>
              {/* Next Milestone Progress Card */}
              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0f0f0f] border-white/10' : 'bg-neutral-50 border-black/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#FC4C01]" />
                    <span className="text-xs font-semibold">
                      Next Milestone: {nextMilestone.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#FC4C01]">
                    {Math.min(streak.currentStreak, nextMilestone.days)} / {nextMilestone.days}d
                  </span>
                </div>
                <p className={`text-[11px] mb-2.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {nextMilestone.subtitle} · Reward: +{nextMilestone.bonusMessages} msgs, +
                  {nextMilestone.bonusUploads} uploads
                </p>
                <div
                  className={`w-full h-2 rounded-full overflow-hidden ${
                    isDark ? 'bg-white/10' : 'bg-black/10'
                  }`}
                >
                  <div
                    className="h-full bg-[#FC4C01] transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((streak.currentStreak / nextMilestone.days) * 100)
                      )}%`,
                    }}
                  />
                </div>

                {/* Achievement Unlocked Toast Preview Bar (7d / 30d / 100d) */}
                <div
                  className={`mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 ${
                    isDark ? 'border-white/10' : 'border-black/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[#FC4C01]" />
                    <span className="text-[11px] font-medium">
                      Achievement Unlocked Toast Notifications
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[7, 30, 100].map((mDays) => (
                      <button
                        key={mDays}
                        type="button"
                        onClick={() => handleTriggerMilestoneToast(mDays)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono tabular-nums font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#FC4C01]/10 hover:bg-[#FC4C01]/20 border-[#FC4C01]/35 text-[#FC4C01]'
                            : 'bg-[#FC4C01]/10 hover:bg-[#FC4C01]/20 border-[#FC4C01]/35 text-[#FC4C01]'
                        }`}
                      >
                        Trigger {mDays}-Day Toast
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Milestone Ladder */}
              <div className="space-y-2.5">
                {STREAK_MILESTONES.map((m) => {
                  const maxReached = Math.max(streak.currentStreak, streak.longestStreak);
                  const isUnlocked = maxReached >= m.days;
                  const isClaimed = claimedSet.has(m.days);
                  const progressPct = Math.min(100, Math.round((maxReached / m.days) * 100));

                  return (
                    <div
                      key={m.days}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isClaimed
                          ? isDark
                            ? 'bg-white/[0.02] border-white/10'
                            : 'bg-neutral-50/70 border-black/10'
                          : isUnlocked
                          ? 'bg-[#FC4C01]/[0.07] border-[#FC4C01]/40'
                          : isDark
                          ? 'bg-[#0d0d0d] border-white/[0.07]'
                          : 'bg-white border-black/[0.08]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center font-mono tabular-nums text-xs font-semibold shrink-0 ${
                            isUnlocked
                              ? 'bg-[#FC4C01]/15 border-[#FC4C01]/40 text-[#FC4C01]'
                              : isDark
                              ? 'bg-white/[0.03] border-white/10 text-neutral-400'
                              : 'bg-neutral-100 border-black/10 text-neutral-500'
                          }`}
                        >
                          {m.days}d
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{m.title}</span>
                            <span
                              className={`text-[10px] font-mono tabular-nums ${
                                isDark ? 'text-neutral-400' : 'text-neutral-500'
                              }`}
                            >
                              {progressPct}%
                            </span>
                          </div>
                          <div
                            className={`text-[11px] truncate ${
                              isDark ? 'text-neutral-400' : 'text-neutral-500'
                            }`}
                          >
                            {m.subtitle}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-mono tabular-nums text-[#FC4C01]">
                            <span>+{m.bonusMessages} Msgs</span>
                            <span>·</span>
                            <span>+{m.bonusUploads} Uploads</span>
                            {m.bonusShields > 0 && (
                              <>
                                <span>·</span>
                                <span>+{m.bonusShields} Shield</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTriggerMilestoneToast(m.days)}
                          className={`px-2 py-1 rounded-lg border text-[10.5px] font-mono transition-colors cursor-pointer ${
                            isDark
                              ? 'border-white/15 hover:bg-white/10 text-neutral-300'
                              : 'border-black/15 hover:bg-black/5 text-neutral-700'
                          }`}
                          title={`Preview ${m.days}-Day Achievement Unlocked toast`}
                        >
                          Toast
                        </button>
                        {isClaimed ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${
                              isDark
                                ? 'bg-white/[0.04] border-white/10 text-neutral-400'
                                : 'bg-neutral-100 border-black/10 text-neutral-500'
                            }`}
                          >
                            <Check className="w-3 h-3 text-[#FC4C01]" />
                            <span>Claimed</span>
                          </span>
                        ) : isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => handleClaimMilestone(m.days)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span>Claim Bonus</span>
                          </button>
                        ) : (
                          <span
                            className={`text-[11px] font-mono tabular-nums ${
                              isDark ? 'text-neutral-500' : 'text-neutral-400'
                            }`}
                          >
                            {Math.max(0, m.days - maxReached)}d left
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'protection' && (
            <>
              {/* Streak Shield / Freeze Card */}
              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0f0f0f] border-white/10' : 'bg-neutral-50 border-black/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg border border-[#FC4C01]/30 bg-[#FC4C01]/10 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-[#FC4C01]" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">
                        Streak Shield (Automatic Freeze)
                      </div>
                      <div
                        className={`text-[11px] ${
                          isDark ? 'text-neutral-400' : 'text-neutral-500'
                        }`}
                      >
                        Automatically bridges a missed 24-hour window so your streak stays intact
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold">
                    {streak.streakFreezes} / {streak.maxStreakFreezes || 3} Equipped
                  </span>
                </div>

                {/* Shield Slots */}
                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  {[0, 1, 2].map((slotIdx) => {
                    const isFilled = slotIdx < streak.streakFreezes;
                    return (
                      <div
                        key={slotIdx}
                        className={`p-2.5 rounded-lg border flex items-center gap-2 font-mono text-xs ${
                          isFilled
                            ? 'bg-[#FC4C01]/10 border-[#FC4C01]/40 text-[#FC4C01] font-semibold'
                            : isDark
                            ? 'bg-white/[0.02] border-white/10 text-neutral-500'
                            : 'bg-white border-black/10 text-neutral-400'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        <span>{isFilled ? 'Shield Active' : 'Empty Slot'}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <span
                    className={`text-[11px] ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {streak.streakFreezes >= (streak.maxStreakFreezes || 3)
                      ? 'Maximum Streak Shields equipped (3/3).'
                      : streak.lastFreezeEarnedDate === todayKey
                      ? 'You already forged a Streak Shield today.'
                      : streak.todayInteractions >= streak.dailyGoal
                      ? 'Daily goal reached! Forge +1 free Streak Shield now.'
                      : `Complete today's daily goal (${streak.todayInteractions}/${streak.dailyGoal}) to forge a Shield.`}
                  </span>

                  <button
                    type="button"
                    disabled={
                      streak.streakFreezes >= (streak.maxStreakFreezes || 3) ||
                      streak.todayInteractions < streak.dailyGoal ||
                      streak.lastFreezeEarnedDate === todayKey
                    }
                    onClick={handleForgeShield}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                      streak.streakFreezes < (streak.maxStreakFreezes || 3) &&
                      streak.todayInteractions >= streak.dailyGoal &&
                      streak.lastFreezeEarnedDate !== todayKey
                        ? 'bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer'
                        : isDark
                        ? 'bg-white/[0.05] text-neutral-500 cursor-not-allowed'
                        : 'bg-black/[0.05] text-neutral-400 cursor-not-allowed'
                    }`}
                  >
                    Forge +1 Shield
                  </button>
                </div>
              </div>

              {/* Daily Interaction Goal Selector */}
              <div
                className={`p-4 rounded-xl border ${
                  isDark ? 'bg-[#0f0f0f] border-white/10' : 'bg-neutral-50 border-black/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#FC4C01]" />
                    <span className="text-xs font-semibold">Daily Interaction Goal</span>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#FC4C01]">
                    Today: {streak.todayInteractions} / {streak.dailyGoal} ({todayGoalProgress}%)
                  </span>
                </div>

                <div
                  className={`w-full h-2 rounded-full overflow-hidden mb-3.5 ${
                    isDark ? 'bg-white/10' : 'bg-black/10'
                  }`}
                >
                  <div
                    className="h-full bg-[#FC4C01] transition-all duration-300"
                    style={{ width: `${todayGoalProgress}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DAILY_GOAL_OPTIONS.map((opt) => {
                    const isSelected = (streak.dailyGoal || 3) === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelectDailyGoal(opt.value)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#FC4C01]/15 border-[#FC4C01] text-[#FC4C01]'
                            : isDark
                            ? 'bg-white/[0.02] border-white/10 hover:border-white/25 text-neutral-300'
                            : 'bg-white border-black/10 hover:border-black/25 text-neutral-700'
                        }`}
                      >
                        <div className="text-xs font-semibold font-mono tabular-nums">
                          {opt.label}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            isSelected
                              ? 'text-[#FC4C01]/90'
                              : isDark
                              ? 'text-neutral-500'
                              : 'text-neutral-400'
                          }`}
                        >
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Daily Streak Reminder Notification Settings */}
              <div
                className={`p-4 rounded-xl border space-y-3.5 ${
                  isDark ? 'bg-[#0f0f0f] border-white/10' : 'bg-neutral-50 border-black/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg border border-[#FC4C01]/30 bg-[#FC4C01]/10 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-[#FC4C01]" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">
                        Daily Streak Reminder Notification
                      </div>
                      <div
                        className={`text-[11px] ${
                          isDark ? 'text-neutral-400' : 'text-neutral-500'
                        }`}
                      >
                        Reminds you via toast banner if you haven't completed your daily Zeno interaction by your scheduled time
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleReminder}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                      streak.reminderEnabled
                        ? 'bg-[#FC4C01]'
                        : isDark
                        ? 'bg-neutral-700'
                        : 'bg-neutral-300'
                    }`}
                    title="Toggle daily streak reminder"
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        streak.reminderEnabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[11px] inline-flex items-center gap-1 font-mono ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-[#FC4C01]" />
                      <span>Reminder Time:</span>
                    </span>
                    {['09:00', '12:00', '18:00', '20:00', '21:30'].map((preset) => {
                      const active = (streak.reminderTime || '18:00') === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleChangeReminderTime(preset)}
                          className={`px-2 py-1 rounded-lg border text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#FC4C01]/15 border-[#FC4C01] text-[#FC4C01] font-semibold'
                              : isDark
                              ? 'bg-white/[0.03] border-white/10 text-neutral-300 hover:border-white/25'
                              : 'bg-white border-black/10 text-neutral-700 hover:border-black/25'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    <input
                      type="time"
                      value={streak.reminderTime || '18:00'}
                      onChange={(e) => handleChangeReminderTime(e.target.value)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-mono outline-none ${
                        isDark
                          ? 'bg-black/60 border-white/15 text-white'
                          : 'bg-white border-black/15 text-black'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTestReminderToast}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white'
                        : 'bg-white hover:bg-neutral-100 border-black/15 text-neutral-900'
                    }`}
                  >
                    Test Reminder Toast
                  </button>
                </div>
              </div>

              {/* Activity Breakdown Summary */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-[#FC4C01]" />
                  <div>
                    <div className="text-xs font-semibold">How Daily Streaks Work</div>
                    <div
                      className={`text-[11px] ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      Every chat prompt, deep research run, file upload, or study session counts toward your daily goal.
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
