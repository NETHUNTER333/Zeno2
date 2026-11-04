import React, { useState, useEffect } from 'react';
import { Flame, Bell, Check, X, ArrowRight, Clock } from 'lucide-react';
import { UserAccountStore, DailyStreakData } from '../lib/userAccountStore';

interface StreakReminderToastProps {
  isDark: boolean;
  onQuickAction?: (promptText?: string) => void;
  onOpenStreakSettings?: () => void;
}

export const StreakReminderToast: React.FC<StreakReminderToastProps> = ({
  isDark,
  onQuickAction,
  onOpenStreakSettings,
}) => {
  const [streak, setStreak] = useState<DailyStreakData>(() => UserAccountStore.getDailyStreak());
  const [visible, setVisible] = useState<boolean>(false);
  const [achievementToastActive, setAchievementToastActive] = useState<boolean>(false);
  const [completedAck, setCompletedAck] = useState<boolean>(false);
  const [snoozedUntilTs, setSnoozedUntilTs] = useState<number>(0);

  useEffect(() => {
    const syncStreak = () => {
      const latest = UserAccountStore.getDailyStreak();
      setStreak(latest);
      if (
        (latest.todayRealInteractions || 0) >= 1 &&
        latest.todayInteractions >= (latest.dailyGoal || 3) &&
        !completedAck
      ) {
        setVisible(false);
      }
    };

    const handleAchievementToastState = (e: Event) => {
      const active = Boolean((e as CustomEvent<{ active?: boolean }>).detail?.active);
      setAchievementToastActive(active);
      if (active) {
        setVisible(false);
      }
    };

    const handleTriggerManual = () => {
      const latest = UserAccountStore.getDailyStreak();
      setStreak(latest);
      setCompletedAck(false);
      setVisible(true);

      if (
        latest.browserNotificationsEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(`Kinich · ${latest.currentStreak}d Daily Streak Reminder`, {
            body: `Complete your daily Kinich interaction (${latest.todayInteractions}/${latest.dailyGoal}) to keep your ${latest.currentStreak}-day streak alive.`,
          });
        } catch {}
      }
    };

    window.addEventListener('kinich-account-updated', syncStreak);
    window.addEventListener('kinich-trigger-streak-reminder', handleTriggerManual);
    window.addEventListener('kinich-achievement-toast-active', handleAchievementToastState);

    const checkSchedule = () => {
      if (Date.now() < snoozedUntilTs || achievementToastActive) return;
      const shouldShow = UserAccountStore.shouldShowStreakReminder(new Date());
      if (shouldShow) {
        const latest = UserAccountStore.getDailyStreak();
        setStreak(latest);
        setVisible(true);
      }
    };

    const interval = setInterval(checkSchedule, 60000);

    return () => {
      window.removeEventListener('kinich-account-updated', syncStreak);
      window.removeEventListener('kinich-trigger-streak-reminder', handleTriggerManual);
      window.removeEventListener('kinich-achievement-toast-active', handleAchievementToastState);
      clearInterval(interval);
    };
  }, [snoozedUntilTs, completedAck, achievementToastActive]);

  if (!visible || achievementToastActive) return null;

  const handleCompleteDailyCheckIn = () => {
    const updated = UserAccountStore.recordDailyInteraction(true);
    UserAccountStore.dismissStreakReminderForToday();
    setStreak(updated);
    setCompletedAck(true);

    if (onQuickAction) {
      onQuickAction('Give me a 60-second daily synthesis of a high-impact scientific or engineering concept.');
    }

    setTimeout(() => {
      setVisible(false);
      setCompletedAck(false);
    }, 2200);
  };

  const handleSnooze = () => {
    // Snooze for 30 minutes
    setSnoozedUntilTs(Date.now() + 30 * 60 * 1000);
    setVisible(false);
  };

  const handleDismissToday = () => {
    UserAccountStore.dismissStreakReminderForToday();
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div
        className={`rounded-2xl border p-4 shadow-2xl transition-colors ${
          isDark
            ? 'bg-[#0a0a0a]/95 border-white/15 text-white backdrop-blur-md'
            : 'bg-white/95 border-black/15 text-neutral-900 backdrop-blur-md'
        }`}
      >
        {completedAck ? (
          <div className="flex items-center gap-3 py-1">
            <div className="w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-[#FC4C01]" />
            </div>
            <div>
              <div className="text-xs font-semibold">
                Daily Streak Maintained ({streak.currentStreak}d)
              </div>
              <div className={`text-[11px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Today's progress: {streak.todayInteractions}/{streak.dailyGoal} interactions recorded.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/40 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-[#FC4C01] fill-[#FC4C01]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">Daily Kinich Streak Reminder</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/30">
                      {streak.currentStreak}d
                    </span>
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 flex items-center gap-1 font-mono tabular-nums ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    <Bell className="w-3 h-3 text-[#FC4C01]" />
                    <span>Scheduled for {streak.reminderTime || '18:00'}</span>
                    <span>·</span>
                    <span>
                      {streak.todayInteractions}/{streak.dailyGoal} goal
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismissToday}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                    : 'text-neutral-500 hover:text-black hover:bg-black/5'
                }`}
                title="Dismiss for today"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p
              className={`text-xs leading-relaxed mt-2.5 ${
                isDark ? 'text-neutral-300' : 'text-neutral-600'
              }`}
            >
              Complete your daily Kinich interaction now to keep your{' '}
              <span className="font-semibold text-[#FC4C01]">{streak.currentStreak}-day streak</span>{' '}
              active and progress toward your next milestone reward.
            </p>

            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCompleteDailyCheckIn}
                className="flex-1 py-2 px-3 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Complete Daily Check-in</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleSnooze}
                className={`py-2 px-2.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/15 hover:bg-white/[0.06] text-neutral-300'
                    : 'border-black/15 hover:bg-black/[0.04] text-neutral-700'
                }`}
                title="Snooze for 30 minutes"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Later</span>
              </button>

              {onOpenStreakSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setVisible(false);
                    onOpenStreakSettings();
                  }}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'border-white/15 hover:bg-white/[0.06] text-neutral-300'
                      : 'border-black/15 hover:bg-black/[0.04] text-neutral-700'
                  }`}
                >
                  Time
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
