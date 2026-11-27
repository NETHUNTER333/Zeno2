import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Flame, Calendar as CalendarIcon, Trophy, Shield, ChevronLeft, ChevronRight,
  Check, Target, Activity, Gift, Bell, Clock, Zap, MessageSquare, Upload,
} from 'lucide-react';
import { UserAccountStore, DailyStreakData, STREAK_MILESTONES, toLocalDateKey } from '../lib/userAccountStore';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streak: DailyStreakData;
  isDark: boolean;
  initialTab?: 'calendar' | 'badges' | 'milestones' | 'protection';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAILY_GOAL_OPTIONS: Array<[number, string, string]> = [
  [1, '1x / day', 'Casual maintenance'],
  [3, '3x / day', 'Regular momentum'],
  [5, '5x / day', 'Deep researcher'],
  [10, '10x / day', 'Intense workflow'],
];

const RewardRow: React.FC<{ msgs: number; uploads: number; shields: number; isDark: boolean; className?: string }> = ({
  msgs, uploads, shields, isDark, className = '',
}) => (
  <div className={`inline-flex items-center gap-2 text-[11px] font-mono tabular-nums font-medium text-[#FC4C01] ${className}`}>
    <span className="inline-flex items-center gap-1" title={`+${msgs} Bonus Messages`}><MessageSquare className="w-3.5 h-3.5 shrink-0" /><span>+{msgs}</span></span>
    <span className={isDark ? 'text-white/25' : 'text-black/25'}>|</span>
    <span className="inline-flex items-center gap-1" title={`+${uploads} Bonus Uploads`}><Upload className="w-3.5 h-3.5 shrink-0" /><span>+{uploads}</span></span>
    {shields > 0 && (
      <>
        <span className={isDark ? 'text-white/25' : 'text-black/25'}>|</span>
        <span className="inline-flex items-center gap-1" title={`+${shields} Streak Shield`}><Shield className="w-3.5 h-3.5 shrink-0" /><span>+{shields}</span></span>
      </>
    )}
  </div>
);

export const StreakModal: React.FC<StreakModalProps> = ({ isOpen, onClose, streak, isDark, initialTab = 'calendar' }) => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'badges' | 'milestones' | 'protection'>(initialTab);
  const todayKey = useMemo(() => toLocalDateKey(), []);
  const [viewMonthDate, setViewMonthDate] = useState<Date>(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => { if (isOpen) setActiveTab(initialTab); }, [isOpen, initialTab]);

  const activeSet = useMemo(() => new Set(streak.activeDates || []), [streak.activeDates]);
  const frozenSet = useMemo(() => new Set(streak.frozenDates || []), [streak.frozenDates]);
  const claimedSet = useMemo(() => new Set(streak.claimedMilestones || []), [streak.claimedMilestones]);

  const consistency30d = useMemo(() => {
    const now = new Date();
    let active30 = 0;
    for (let i = 0; i < 30; i++) {
      const k = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime());
      if (activeSet.has(k) || frozenSet.has(k)) active30++;
    }
    const [ey, em, ed] = (streak.activeDates?.[0] || todayKey).split('-').map(Number);
    const spanDays = Math.max(1, Math.min(30, Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(ey, (em || 1) - 1, ed || 1).getTime()) / 86400000) + 1));
    return Math.min(100, Math.round((active30 / spanDays) * 100));
  }, [activeSet, frozenSet, streak.activeDates, todayKey]);

  const calendarDays = useMemo(() => {
    const y = viewMonthDate.getFullYear(), m = viewMonthDate.getMonth();
    const firstDow = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
    const cells: Array<{ key: string | null; dayNum: number | null; isActive: boolean; isFrozen: boolean; isToday: boolean; isFuture: boolean; count: number; goalMet: boolean }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ key: null, dayNum: null, isActive: false, isFrozen: false, isToday: false, isFuture: false, count: 0, goalMet: false });
    for (let day = 1; day <= dim; day++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isActive = activeSet.has(key), isFrozen = frozenSet.has(key);
      const count = Number(streak.dailyCounts?.[key] || (isActive ? 1 : 0));
      cells.push({ key, dayNum: day, isActive, isFrozen, isToday: key === todayKey, isFuture: key > todayKey, count, goalMet: isActive && count >= (streak.dailyGoal || 3) });
    }
    return cells;
  }, [viewMonthDate, activeSet, frozenSet, streak.dailyCounts, streak.dailyGoal, todayKey]);

  const monthStats = useMemo(() => {
    let active = 0, interactions = 0, goalMet = 0;
    for (const c of calendarDays) if (c.key) { if (c.isActive) { active++; interactions += c.count; } if (c.goalMet) goalMet++; }
    return { active, interactions, goalMet };
  }, [calendarDays]);

  const nextMilestone = useMemo(() => STREAK_MILESTONES.find((m) => m.days > streak.currentStreak) || STREAK_MILESTONES[STREAK_MILESTONES.length - 1], [streak.currentStreak]);
  const maxReached = Math.max(streak.currentStreak, streak.longestStreak);
  const unclaimedCount = useMemo(() => STREAK_MILESTONES.filter((m) => maxReached >= m.days && !claimedSet.has(m.days)).length, [maxReached, claimedSet]);

  if (!isOpen) return null;

  const flash = (msg: string, ms = 3200) => { setStatusBanner(msg); setTimeout(() => setStatusBanner(null), ms); };
  const isGuest = UserAccountStore.isGuest();
  const isAct = activeSet.has(selectedDateKey), isFrz = frozenSet.has(selectedDateKey);
  const selCnt = Number(streak.dailyCounts?.[selectedDateKey] || (isAct ? 1 : 0));
  const selGoalMet = isAct && selCnt >= (streak.dailyGoal || 3);

  const handleClaimMilestone = (days: number) => {
    if (UserAccountStore.isGuest()) {
      onClose();
      window.dispatchEvent(new CustomEvent('kinich-open-auth', { detail: { reason: 'Sign in to claim your streak bonus' } }));
      return;
    }
    const res = UserAccountStore.claimStreakMilestone(days);
    if (res.rewarded && res.milestone) {
      flash(`Claimed ${res.milestone.title}: +${res.milestone.bonusMessages} messages, +${res.milestone.bonusUploads} uploads${res.milestone.bonusShields ? `, +${res.milestone.bonusShields} Streak Shield` : ''}`, 4500);
    }
  };

  const handleSelectDailyGoal = (goal: number) => { UserAccountStore.setDailyStreakGoal(goal); flash(`Daily interaction target updated to ${goal}x per day.`, 3000); };
  const handleForgeShield = () => { if (UserAccountStore.refillStreakFreeze().refilled) flash('Streak Shield forged and equipped (+1 Shield).', 3500); };
  const handleToggleReminder = () => {
    const next = !streak.reminderEnabled;
    UserAccountStore.updateStreakReminderSettings({ reminderEnabled: next });
    flash(next ? `Daily streak reminder enabled for ${streak.reminderTime || '18:00'}.` : 'Daily streak reminder paused.', 3000);
  };
  const handleChangeReminderTime = (t: string) => {
    if (!/^\d{2}:\d{2}$/.test(t)) return;
    UserAccountStore.updateStreakReminderSettings({ reminderEnabled: true, reminderTime: t });
    flash(`Daily streak reminder time set to ${t}.`, 3000);
  };

  const dailyGoalTarget = Math.max(1, streak.dailyGoal || 3);
  const todayGoalProgress = Math.min(100, Math.max(0, Math.round((streak.todayInteractions / dailyGoalTarget) * 100)));
  const isDailyGoalExceeded = streak.todayInteractions > dailyGoalTarget;
  const isDailyGoalReached = streak.todayInteractions >= dailyGoalTarget;
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const cardCls = isDark ? 'bg-[#0f0f0f] border-white/10' : 'bg-neutral-50 border-black/10';
  const bdr = isDark ? 'border-white/10' : 'border-black/10';
  const canForge = streak.streakFreezes < (streak.maxStreakFreezes || 3) && streak.todayInteractions >= streak.dailyGoal && streak.lastFreezeEarnedDate !== todayKey;

  const tabs = [
    { id: 'calendar' as const, icon: <CalendarIcon className="w-3.5 h-3.5" />, label: 'Streak Calendar', badge: 0 },
    { id: 'milestones' as const, icon: <Trophy className="w-3.5 h-3.5" />, label: 'Milestones', badge: unclaimedCount },
    { id: 'protection' as const, icon: <Shield className="w-3.5 h-3.5" />, label: 'Shield & Goals', badge: 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] ${isDark ? 'bg-[#0a0a0a] border-white/15 text-white' : 'bg-white border-black/10 text-neutral-900'}`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between ${isDark ? 'border-white/10 bg-white/[0.01]' : 'border-black/10 bg-neutral-50/60'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center bg-[#FC4C01]/10 ${isDark ? 'border-[#FC4C01]/30' : 'border-[#FC4C01]/25'}`}>
              <Flame className="w-4 h-4 text-[#FC4C01] fill-[#FC4C01]/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Streaks, Milestones & Consistency</h2>
                <span className="text-xs font-mono tabular-nums font-semibold text-[#FC4C01]">{streak.currentStreak} {streak.currentStreak === 1 ? 'Day' : 'Days'}</span>
              </div>
              <p className={`text-[11px] ${muted}`}>Calendar heatmap, milestone message rewards & streak shield protection</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isDark ? 'text-neutral-400 hover:text-white hover:bg-white/10' : 'text-neutral-500 hover:text-black hover:bg-black/5'}`} aria-label="Close modal">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`grid grid-cols-3 border-b ${isDark ? 'border-white/10 bg-[#0d0d0d]' : 'border-black/10 bg-neutral-50/40'}`}>
          <div className={`px-4 py-3 border-r ${bdr}`}>
            <div className={`text-[10px] uppercase tracking-wider ${muted}`}>Current</div>
            <div className="text-base font-semibold font-mono tabular-nums mt-0.5 flex items-center gap-1">
              <span>{streak.currentStreak}d</span><Flame className="w-3.5 h-3.5 text-[#FC4C01] fill-[#FC4C01]/20" />
            </div>
          </div>
          <div className={`px-4 py-3 border-r ${bdr}`}>
            <div className={`text-[10px] uppercase tracking-wider ${muted}`}>Best Streak</div>
            <div className="text-base font-semibold font-mono tabular-nums mt-0.5">{streak.longestStreak}d</div>
          </div>
          <div className="px-4 py-3">
            <div className={`text-[10px] uppercase tracking-wider ${muted}`}>Consistency</div>
            <div className="text-base font-semibold font-mono tabular-nums mt-0.5">{consistency30d}%</div>
          </div>
        </div>

        <div role="tablist" aria-label="Streak and rewards sections" className={`px-4 sm:px-5 pt-3 border-b flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none text-xs ${bdr}`}>
          {tabs.map((t, idx) => {
            const sel = activeTab === t.id;
            const focusTab = (id: typeof t.id) => { setActiveTab(id); document.getElementById(`streak-tab-${id}`)?.focus(); };
            return (
              <button key={t.id} id={`streak-tab-${t.id}`} type="button" role="tab" aria-selected={sel} aria-controls={`streak-tabpanel-${t.id}`} tabIndex={sel ? 0 : -1} onClick={() => setActiveTab(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusTab(tabs[(idx + 1) % tabs.length].id); }
                  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusTab(tabs[(idx - 1 + tabs.length) % tabs.length].id); }
                  else if (e.key === 'Home') { e.preventDefault(); focusTab(tabs[0].id); }
                  else if (e.key === 'End') { e.preventDefault(); focusTab(tabs[tabs.length - 1].id); }
                }}
                className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${sel ? 'border-[#FC4C01] text-[#FC4C01]' : isDark ? 'border-transparent text-neutral-400 hover:text-white' : 'border-transparent text-neutral-500 hover:text-black'}`}>
                {t.icon}<span>{t.label}</span>
                {t.badge > 0 && <span className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-[#FC4C01] text-white">{t.badge}</span>}
              </button>
            );
          })}
        </div>

        {statusBanner && (
          <div className={`mx-5 mt-3 px-3.5 py-2 rounded-xl border text-xs flex items-center justify-between bg-[#FC4C01]/10 border-[#FC4C01]/30 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            <span className="font-medium">{statusBanner}</span>
            <button type="button" onClick={() => setStatusBanner(null)} aria-label="Dismiss status message" title="Dismiss status message" className="opacity-70 hover:opacity-100 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div id={`streak-tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`streak-tab-${activeTab}`} className="p-4 sm:p-5 overflow-y-auto slim-scrollbar flex-1 space-y-4">
          {activeTab === 'calendar' && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{viewMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                  <div className={`text-[11px] font-mono tabular-nums ${muted}`}>
                    {monthStats.active} active {monthStats.active === 1 ? 'day' : 'days'} · {monthStats.interactions} interactions · {monthStats.goalMet} full-goal {monthStats.goalMet === 1 ? 'day' : 'days'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => { const n = new Date(); setViewMonthDate(new Date(n.getFullYear(), n.getMonth(), 1)); setSelectedDateKey(todayKey); }} className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${isDark ? 'border-white/10 hover:bg-white/[0.06] text-neutral-300' : 'border-black/10 hover:bg-black/[0.04] text-neutral-700'}`}>Today</button>
                  <button type="button" onClick={() => setViewMonthDate((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))} className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${isDark ? 'border-white/10 hover:bg-white/[0.06] text-neutral-300' : 'border-black/10 hover:bg-black/[0.04] text-neutral-700'}`} title="Previous month" aria-label="Previous month"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => setViewMonthDate((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))} className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${isDark ? 'border-white/10 hover:bg-white/[0.06] text-neutral-300' : 'border-black/10 hover:bg-black/[0.04] text-neutral-700'}`} title="Next month" aria-label="Next month"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#0f0f0f] border-white/10' : 'bg-neutral-50/70 border-black/10'}`}>
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  {WEEKDAYS.map((d) => <div key={d} className={`text-center text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((cell, idx) => !cell.key || cell.dayNum === null ? <div key={`empty-${idx}`} className="h-10 rounded-lg" /> : (
                    <button key={cell.key} type="button" onClick={() => setSelectedDateKey(cell.key!)}
                      className={`h-10 rounded-lg border flex flex-col items-center justify-center relative font-mono tabular-nums transition-all cursor-pointer ${cell.goalMet ? 'bg-[#FC4C01] border-[#FC4C01] text-white font-semibold' : cell.isActive ? 'bg-[#FC4C01]/15 border-[#FC4C01]/50 text-[#FC4C01] font-semibold' : cell.isFrozen ? (isDark ? 'bg-white/[0.06] border-white/25 text-neutral-200' : 'bg-neutral-200/70 border-black/25 text-neutral-800') : cell.isFuture ? (isDark ? 'bg-transparent border-white/[0.03] text-neutral-700' : 'bg-transparent border-black/[0.03] text-neutral-300') : isDark ? 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:border-white/20' : 'bg-white border-black/[0.06] text-neutral-500 hover:border-black/20'} ${cell.key === selectedDateKey ? (isDark ? 'ring-2 ring-white/70' : 'ring-2 ring-black/70') : ''}`}
                      title={`${cell.key}: ${cell.isActive ? `${cell.count} interaction${cell.count === 1 ? '' : 's'}` : cell.isFrozen ? 'Protected by Streak Shield' : 'No recorded activity'}`}>
                      <span className="text-xs leading-none">{cell.dayNum}</span>
                      <span className="text-[9px] leading-none mt-1 opacity-85">{cell.goalMet ? '★' : cell.isActive ? `${cell.count}x` : cell.isFrozen ? '🛡' : cell.isToday ? '•' : ''}</span>
                    </button>
                  ))}
                </div>
                <div className={`mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${bdr} ${muted}`}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#FC4C01] inline-block" /><span>Daily Goal Met ({streak.dailyGoal}x+)</span></span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#FC4C01]/25 border border-[#FC4C01]/60 inline-block" /><span>Active (1x+)</span></span>
                    <span className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-xs border inline-block ${isDark ? 'bg-white/10 border-white/30' : 'bg-neutral-200 border-black/30'}`} /><span>Shielded</span></span>
                  </div>
                  <span>Total: {streak.totalActiveDays} active days</span>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10'}`}>
                <div>
                  <div className="text-xs font-semibold font-mono tabular-nums">{selectedDateKey === todayKey ? `Today (${selectedDateKey})` : selectedDateKey}</div>
                  <div className={`text-[11px] mt-0.5 ${muted}`}>
                    {selGoalMet ? `Daily goal achieved (${selCnt}/${streak.dailyGoal} interactions)` : isAct ? `Streak recorded (${selCnt}/${streak.dailyGoal} toward daily goal)` : isFrz ? 'Protected by Streak Shield — streak preserved' : 'No interactions recorded on this date'}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${selGoalMet ? 'bg-[#FC4C01]/15 border-[#FC4C01]/40 text-[#FC4C01]' : isAct ? (isDark ? 'bg-white/[0.05] border-white/15 text-white' : 'bg-neutral-100 border-black/15 text-neutral-900') : isDark ? 'bg-white/[0.02] border-white/10 text-neutral-500' : 'bg-neutral-50 border-black/10 text-neutral-400'}`}>
                    {selCnt} {selCnt === 1 ? 'action' : 'actions'}
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'milestones' && (
            <>
              <div className={`p-4 rounded-xl border ${cardCls}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-[#FC4C01]" /><span className="text-xs font-semibold">Next Milestone: {nextMilestone.title}</span></div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#FC4C01]">{Math.min(streak.currentStreak, nextMilestone.days)} / {nextMilestone.days}d</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <p className={`text-[11px] ${muted}`}>{nextMilestone.subtitle}</p>
                  <RewardRow msgs={nextMilestone.bonusMessages} uploads={nextMilestone.bonusUploads} shields={nextMilestone.bonusShields} isDark={isDark} />
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                  <div className="h-full bg-[#FC4C01] transition-all duration-300" style={{ width: `${Math.min(100, Math.round((streak.currentStreak / nextMilestone.days) * 100))}%` }} />
                </div>
              </div>

              <div className="space-y-2.5">
                {STREAK_MILESTONES.map((m) => {
                  const isUnlocked = maxReached >= m.days, isClaimed = claimedSet.has(m.days);
                  const pct = Math.min(100, Math.round((maxReached / m.days) * 100));
                  return (
                    <div key={m.days} className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${isClaimed ? (isDark ? 'bg-white/[0.02] border-white/10' : 'bg-neutral-50/70 border-black/10') : isUnlocked ? 'bg-[#FC4C01]/[0.07] border-[#FC4C01]/40' : isDark ? 'bg-[#0d0d0d] border-white/[0.07]' : 'bg-white border-black/[0.08]'}`}>
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-mono tabular-nums text-xs font-semibold shrink-0 ${isUnlocked ? 'bg-[#FC4C01]/15 border-[#FC4C01]/40 text-[#FC4C01]' : isDark ? 'bg-white/[0.03] border-white/10 text-neutral-400' : 'bg-neutral-100 border-black/10 text-neutral-500'}`}>{m.days}d</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2"><span className="text-xs font-semibold">{m.title}</span><span className={`text-[10px] font-mono tabular-nums ${muted}`}>{pct}%</span></div>
                          <div className={`text-[11px] truncate ${muted}`}>{m.subtitle}</div>
                          <RewardRow msgs={m.bonusMessages} uploads={m.bonusUploads} shields={m.bonusShields} isDark={isDark} className="mt-1.5 gap-2.5" />
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {isClaimed ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${isDark ? 'bg-white/[0.04] border-white/10 text-neutral-400' : 'bg-neutral-100 border-black/10 text-neutral-500'}`}><Check className="w-3 h-3 text-[#FC4C01]" /><span>Claimed</span></span>
                        ) : isUnlocked ? (
                          <button type="button" onClick={() => handleClaimMilestone(m.days)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition-colors cursor-pointer"><Gift className="w-3.5 h-3.5" /><span>{isGuest ? 'Sign in to claim' : 'Claim Bonus'}</span></button>
                        ) : (
                          <span className={`text-[11px] font-mono tabular-nums ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>{Math.max(0, m.days - maxReached)}d left</span>
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
              <div className={`p-4 rounded-xl border ${cardCls}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg border border-[#FC4C01]/30 bg-[#FC4C01]/10 flex items-center justify-center"><Shield className="w-4 h-4 text-[#FC4C01]" /></div>
                    <div>
                      <div className="text-xs font-semibold">Streak Shield (Automatic Freeze)</div>
                      <div className={`text-[11px] ${muted}`}>Automatically bridges a missed 24-hour window so your streak stays intact</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold">{streak.streakFreezes} / {streak.maxStreakFreezes || 3} Equipped</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  {[0, 1, 2].map((i) => {
                    const filled = i < streak.streakFreezes;
                    return (
                      <div key={i} className={`p-2.5 rounded-lg border flex items-center gap-2 font-mono text-xs ${filled ? 'bg-[#FC4C01]/10 border-[#FC4C01]/40 text-[#FC4C01] font-semibold' : isDark ? 'bg-white/[0.02] border-white/10 text-neutral-500' : 'bg-white border-black/10 text-neutral-400'}`}>
                        <Shield className="w-3.5 h-3.5 shrink-0" /><span>{filled ? 'Shield Active' : 'Empty Slot'}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <span className={`text-[11px] ${muted}`}>
                    {streak.streakFreezes >= (streak.maxStreakFreezes || 3) ? 'Maximum Streak Shields equipped (3/3).' : streak.lastFreezeEarnedDate === todayKey ? 'You already forged a Streak Shield today.' : streak.todayInteractions >= streak.dailyGoal ? 'Daily goal reached! Forge +1 free Streak Shield now.' : `Complete today's daily goal (${streak.todayInteractions}/${streak.dailyGoal}) to forge a Shield.`}
                  </span>
                  <button type="button" disabled={!canForge} onClick={handleForgeShield} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${canForge ? 'bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer' : isDark ? 'bg-white/[0.05] text-neutral-500 cursor-not-allowed' : 'bg-black/[0.05] text-neutral-400 cursor-not-allowed'}`}>Forge +1 Shield</button>
                </div>
              </div>

              <div className={`p-4 rounded-xl border transition-all ${isDailyGoalExceeded ? (isDark ? 'bg-[#0f0f0f] border-[#FC4C01]/65 ring-1 ring-[#FC4C01]/30 shadow-[0_0_24px_-4px_rgba(252,76,1,0.38)]' : 'bg-[#FC4C01]/[0.03] border-[#FC4C01]/60 ring-1 ring-[#FC4C01]/25 shadow-[0_0_20px_-4px_rgba(252,76,1,0.28)]') : cardCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#FC4C01]" /><span className="text-xs font-semibold">Daily Interaction Goal</span>
                    {isDailyGoalExceeded && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/40 shadow-[0_0_10px_rgba(252,76,1,0.25)]"><Zap className="w-2.5 h-2.5 fill-current" /><span>Level Up</span></span>}
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#FC4C01]">Today: {streak.todayInteractions} / {dailyGoalTarget} ({todayGoalProgress}%{isDailyGoalExceeded ? ` · +${streak.todayInteractions - dailyGoalTarget} bonus` : ''})</span>
                </div>
                <div className={`w-full h-2.5 rounded-full overflow-hidden mb-3.5 ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                  <div className={`h-full transition-all duration-300 ${isDailyGoalExceeded ? 'bg-gradient-to-r from-[#FC4C01] via-amber-500 to-emerald-400 shadow-[0_0_12px_rgba(252,76,1,0.6)]' : isDailyGoalReached ? 'bg-[#FC4C01] shadow-[0_0_8px_rgba(252,76,1,0.4)]' : 'bg-[#FC4C01]'}`} style={{ width: `${todayGoalProgress}%` }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DAILY_GOAL_OPTIONS.map(([val, label, desc]) => {
                    const sel = (streak.dailyGoal || 3) === val;
                    return (
                      <button key={val} type="button" onClick={() => handleSelectDailyGoal(val)} className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${sel ? 'bg-[#FC4C01]/15 border-[#FC4C01] text-[#FC4C01]' : isDark ? 'bg-white/[0.02] border-white/10 hover:border-white/25 text-neutral-300' : 'bg-white border-black/10 hover:border-black/25 text-neutral-700'}`}>
                        <div className="text-xs font-semibold font-mono tabular-nums">{label}</div>
                        <div className={`text-[10px] mt-0.5 ${sel ? 'text-[#FC4C01]/90' : isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>{desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`p-4 rounded-xl border space-y-3.5 ${cardCls}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg border border-[#FC4C01]/30 bg-[#FC4C01]/10 flex items-center justify-center shrink-0"><Bell className="w-4 h-4 text-[#FC4C01]" /></div>
                    <div>
                      <div className="text-xs font-semibold">Daily Streak Reminder Notification</div>
                      <div className={`text-[11px] ${muted}`}>Reminds you via toast banner if you haven't completed your daily Kinich interaction by your scheduled time</div>
                    </div>
                  </div>
                  <button type="button" onClick={handleToggleReminder} className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${streak.reminderEnabled ? 'bg-[#FC4C01]' : isDark ? 'bg-neutral-700' : 'bg-neutral-300'}`} title="Toggle daily streak reminder">
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${streak.reminderEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] inline-flex items-center gap-1 font-mono ${muted}`}><Clock className="w-3.5 h-3.5 text-[#FC4C01]" /><span>Reminder Time:</span></span>
                    {['09:00', '12:00', '18:00', '20:00', '21:30'].map((p) => (
                      <button key={p} type="button" onClick={() => handleChangeReminderTime(p)} className={`px-2 py-1 rounded-lg border text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${(streak.reminderTime || '18:00') === p ? 'bg-[#FC4C01]/15 border-[#FC4C01] text-[#FC4C01] font-semibold' : isDark ? 'bg-white/[0.03] border-white/10 text-neutral-300 hover:border-white/25' : 'bg-white border-black/10 text-neutral-700 hover:border-black/25'}`}>{p}</button>
                    ))}
                    <input type="time" value={streak.reminderTime || '18:00'} onChange={(e) => handleChangeReminderTime(e.target.value)} className={`px-2 py-1 rounded-lg border text-[11px] font-mono outline-none ${isDark ? 'bg-black/60 border-white/15 text-white' : 'bg-white border-black/15 text-black'}`} />
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono">Scheduled daily at {streak.reminderTime || '18:00'}</div>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/10'}`}>
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-[#FC4C01]" />
                  <div>
                    <div className="text-xs font-semibold">How Daily Streaks Work</div>
                    <div className={`text-[11px] ${muted}`}>Every chat prompt, deep research run, file upload, or study session counts toward your daily goal.</div>
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
