import React, { useState, useEffect } from 'react';
import { Flame, Check } from 'lucide-react';
import { UserAccountStore, DailyStreakData } from '../lib/userAccountStore';

interface StreakReminderToastProps {
  isDark: boolean;
  onQuickAction?: (promptText?: string) => void;
  onOpenStreakSettings?: () => void;
}

export const StreakReminderToast: React.FC<StreakReminderToastProps> = ({
  isDark,
  onQuickAction,
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

  // Auto-dismiss after 6 seconds if not interacted
  useEffect(() => {
    if (!visible || completedAck) return;
    const timer = setTimeout(() => {
      setVisible(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [visible, completedAck]);

  if (!visible || achievementToastActive) return null;

  const handleTap = () => {
    if (completedAck) {
      setVisible(false);
      return;
    }

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
    }, 1800);
  };

  return (
    <div
      onClick={handleTap}
      className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] cursor-pointer select-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-3"
      role="status"
      aria-live="polite"
      title="Click to complete daily streak or dismiss"
    >
      <div
        className={`rounded-xl border p-3 shadow-lg transition-all ${
          isDark
            ? 'bg-[#121215] border-white/10 text-white hover:border-white/20'
            : 'bg-white border-neutral-200 text-neutral-900 hover:border-neutral-300 shadow-md'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-neutral-900'
            }`}
          >
            {completedAck ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Flame className="w-4 h-4 text-neutral-200 dark:text-white" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold truncate">
                {completedAck ? 'Daily Check-in Complete' : 'Daily Streak Reminder'}
              </span>
              <span
                className={`text-[10px] font-mono tabular-nums shrink-0 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                {streak.currentStreak}d streak
              </span>
            </div>

            <p
              className={`text-[11px] truncate mt-0.5 ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              {completedAck
                ? `Maintained ${streak.currentStreak}d streak`
                : `${streak.todayInteractions}/${streak.dailyGoal} interactions · Tap to check in`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
