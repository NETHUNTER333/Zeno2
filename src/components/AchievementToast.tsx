import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Trophy,
  Award,
  Shield,
  Zap,
  Compass,
  BookOpen,
  Layers,
  Bookmark,
  Gift,
  Check,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  UserAccountStore,
  AchievementUnlockPayload,
} from '../lib/userAccountStore';

interface AchievementToastProps {
  isDark: boolean;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({ isDark }) => {
  const [queue, setQueue] = useState<AchievementUnlockPayload[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(() => new Set());
  const [equippedBadgeId, setEquippedBadgeId] = useState<string>(() => {
    return UserAccountStore.getDailyStreak().featuredBadgeId || 'first-spark';
  });
  const [isGuest, setIsGuest] = useState<boolean>(() => UserAccountStore.isGuestUser());
  const [feedbackText, setFeedbackText] = useState<string | null>(null);

  const activeToast = queue[0] || null;

  const syncAccountState = useCallback(() => {
    const latest = UserAccountStore.getDailyStreak();
    setEquippedBadgeId(latest.featuredBadgeId || 'first-spark');
    setIsGuest(UserAccountStore.isGuestUser());
  }, []);

  useEffect(() => {
    const handleUnlockEvent = (e: Event) => {
      const custom = e as CustomEvent<AchievementUnlockPayload>;
      const detail = custom.detail;
      if (!detail || !detail.id) return;

      setFeedbackText(null);
      setQueue((prev) => {
        // If previewing a specific milestone/badge, put it at the front of the queue immediately
        if (detail.isPreview) {
          const filtered = prev.filter((item) => item.id !== detail.id);
          return [detail, ...filtered];
        }
        // Avoid duplicate IDs in active queue
        if (prev.some((item) => item.id === detail.id)) {
          return prev;
        }
        return [...prev, detail];
      });

      // Optional browser notification if user enabled notifications
      const streak = UserAccountStore.getDailyStreak();
      if (
        streak.browserNotificationsEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(`Achievement Unlocked · ${detail.title}`, {
            body: `${detail.subtitle} (+${detail.bonusMessages} Msgs, +${detail.bonusUploads} Uploads)`,
          });
        } catch {}
      }
    };

    window.addEventListener('kinich-achievement-unlocked', handleUnlockEvent as EventListener);
    window.addEventListener('kinich-account-updated', syncAccountState);

    return () => {
      window.removeEventListener('kinich-achievement-unlocked', handleUnlockEvent as EventListener);
      window.removeEventListener('kinich-account-updated', syncAccountState);
    };
  }, [syncAccountState]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('kinich-achievement-toast-active', {
        detail: { active: Boolean(activeToast) },
      })
    );
  }, [activeToast]);

  // Auto-advance / dismiss after 9 seconds when not hovered
  useEffect(() => {
    if (!activeToast || isPaused) return;
    const timer = setTimeout(() => {
      setFeedbackText(null);
      setQueue((prev) => prev.slice(1));
    }, 9000);
    return () => clearTimeout(timer);
  }, [activeToast, isPaused]);

  if (!activeToast) return null;

  const isAlreadyClaimed =
    activeToast.isClaimed || claimedIds.has(activeToast.id);

  const isEquipped =
    Boolean(activeToast.badgeId) && equippedBadgeId === activeToast.badgeId;

  const handleDismissCurrent = () => {
    setFeedbackText(null);
    setQueue((prev) => prev.slice(1));
  };

  const handleClaim = () => {
    if (isAlreadyClaimed) return;
    if (UserAccountStore.isGuestUser()) {
      window.dispatchEvent(
        new CustomEvent('kinich-open-auth', {
          detail: { reason: 'Sign in to claim your streak bonus' },
        })
      );
      return;
    }

    if (activeToast.kind === 'milestone' && typeof activeToast.days === 'number') {
      const res = UserAccountStore.claimStreakMilestone(
        activeToast.days,
        Boolean(activeToast.isPreview)
      );
      if (res.rewarded) {
        setClaimedIds((prev) => new Set(prev).add(activeToast.id));
        setFeedbackText(
          `+${activeToast.bonusMessages} messages & +${activeToast.bonusUploads} uploads added to your quota`
        );
      }
    } else if (activeToast.badgeId) {
      const res = UserAccountStore.claimBadgeReward(
        activeToast.badgeId,
        Boolean(activeToast.isPreview)
      );
      if (res.rewarded) {
        setClaimedIds((prev) => new Set(prev).add(activeToast.id));
        setFeedbackText(
          `+${activeToast.bonusMessages} messages & +${activeToast.bonusUploads} uploads added to your quota`
        );
      }
    }
  };

  const handleEquipBadge = () => {
    if (!activeToast.badgeId) return;
    UserAccountStore.setFeaturedBadge(activeToast.badgeId);
    setEquippedBadgeId(activeToast.badgeId);
    setFeedbackText(`Equipped "${activeToast.title}" on your sidebar & profile`);
  };

  const handleOpenVault = () => {
    const targetTab = activeToast.kind === 'milestone' ? 'milestones' : 'badges';
    window.dispatchEvent(
      new CustomEvent('kinich-open-streak-modal', {
        detail: { tab: targetTab },
      })
    );
    handleDismissCurrent();
  };

  const renderIcon = () => {
    const cls = 'w-5 h-5 text-[#FC4C01]';
    switch (activeToast.iconName) {
      case 'flame':
        return <Flame className={`${cls} fill-[#FC4C01]/25`} />;
      case 'trophy':
        return <Trophy className={cls} />;
      case 'award':
        return <Award className={cls} />;
      case 'shield':
        return <Shield className={cls} />;
      case 'zap':
        return <Zap className={cls} />;
      case 'compass':
        return <Compass className={cls} />;
      case 'book':
        return <BookOpen className={cls} />;
      case 'layers':
        return <Layers className={cls} />;
      case 'bookmark':
        return <Bookmark className={cls} />;
      default:
        return <Trophy className={cls} />;
    }
  };

  const tierAccentLabel =
    activeToast.tier === 'obsidian'
      ? 'OBSIDIAN TIER'
      : activeToast.tier === 'gold'
      ? 'GOLD TIER'
      : activeToast.tier === 'silver'
      ? 'SILVER TIER'
      : 'BRONZE TIER';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="fixed top-14 right-3 sm:top-auto sm:bottom-5 sm:right-5 z-[115] max-w-sm sm:max-w-md w-[calc(100vw-1.5rem)] animate-in fade-in slide-in-from-top-3 sm:slide-in-from-bottom-4 duration-200"
      role="status"
      aria-live="polite"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border shadow-2xl transition-colors ${
          isDark
            ? 'bg-[#0a0a0a] border-[#FC4C01]/45 text-white'
            : 'bg-white border-[#FC4C01]/40 text-neutral-900'
        }`}
      >
        {/* Top Accent Line */}
        <div className="h-1 w-full bg-[#FC4C01]" />

        <div className="p-4">
          {/* Header Row: Kicker + Queue Counter + Close (No truncation on ACHIEVEMENT UNLOCKED) */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="inline-block w-2 h-2 rounded-full bg-[#FC4C01] shrink-0" />
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#FC4C01] whitespace-nowrap">
                ACHIEVEMENT UNLOCKED
              </span>
              {activeToast.kickerLabel && (
                <span
                  className={`text-[9.5px] font-mono uppercase px-1.5 py-0.5 rounded whitespace-nowrap ${
                    isDark ? 'bg-white/[0.06] text-neutral-300' : 'bg-black/[0.06] text-neutral-700'
                  }`}
                >
                  {activeToast.kickerLabel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {queue.length > 1 && (
                <span
                  className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded border whitespace-nowrap ${
                    isDark
                      ? 'bg-white/[0.04] border-white/10 text-neutral-300'
                      : 'bg-neutral-100 border-black/10 text-neutral-600'
                  }`}
                >
                  1 of {queue.length}
                </span>
              )}
              <button
                type="button"
                onClick={handleDismissCurrent}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                    : 'text-neutral-500 hover:text-black hover:bg-black/5'
                }`}
                title="Dismiss notification"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Emblem + Title & Subtitle */}
          <div className="flex items-start gap-3.5">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-[#FC4C01]/15 border border-[#FC4C01]/45 flex flex-col items-center justify-center shadow-inner">
                {renderIcon()}
                {typeof activeToast.days === 'number' && (
                  <span className="text-[9px] font-mono tabular-nums font-bold text-[#FC4C01] mt-0.5 leading-none">
                    {activeToast.days}D
                  </span>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold tracking-tight leading-snug">
                  {activeToast.title}
                </h3>
                <span
                  className={`text-[9.5px] font-mono uppercase tracking-wider ${
                    isDark ? 'text-neutral-400' : 'text-neutral-500'
                  }`}
                >
                  {tierAccentLabel}
                </span>
              </div>

              <p
                className={`text-xs mt-0.5 leading-relaxed ${
                  isDark ? 'text-neutral-300' : 'text-neutral-600'
                }`}
              >
                {activeToast.subtitle}
              </p>

              {/* Unboxed Tabular-Nums Reward Readout */}
              <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] font-mono tabular-nums text-[#FC4C01] font-medium">
                <span>+{activeToast.bonusMessages.toLocaleString()} Messages</span>
                <span>·</span>
                <span>+{activeToast.bonusUploads.toLocaleString()} Uploads</span>
                {activeToast.bonusShields > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      +{activeToast.bonusShields} Streak{' '}
                      {activeToast.bonusShields === 1 ? 'Shield' : 'Shields'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Feedback Confirmation Banner if Claimed/Equipped */}
          {feedbackText && (
            <div
              className={`mt-3 px-3 py-1.5 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 ${
                isDark
                  ? 'bg-[#FC4C01]/10 border-[#FC4C01]/35 text-white'
                  : 'bg-[#FC4C01]/10 border-[#FC4C01]/30 text-neutral-900'
              }`}
            >
              <Check className="w-3.5 h-3.5 text-[#FC4C01] shrink-0" />
              <span className="truncate">{feedbackText}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="mt-3.5 pt-3 border-t border-neutral-500/15 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isAlreadyClaimed ? (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono ${
                    isDark
                      ? 'bg-white/[0.04] border-white/15 text-neutral-300'
                      : 'bg-neutral-100 border-black/15 text-neutral-700'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 text-[#FC4C01]" />
                  <span>Reward Claimed</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleClaim}
                  data-testid="achievement-claim-bonus-btn"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>{isGuest ? 'Sign in to claim' : 'Claim Bonus'}</span>
                </button>
              )}

              {activeToast.badgeId && (
                <button
                  type="button"
                  onClick={handleEquipBadge}
                  disabled={isEquipped}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                    isEquipped
                      ? isDark
                        ? 'border-[#FC4C01]/40 bg-[#FC4C01]/10 text-[#FC4C01] cursor-default'
                        : 'border-[#FC4C01]/40 bg-[#FC4C01]/10 text-[#FC4C01] cursor-default'
                      : isDark
                      ? 'border-white/15 hover:bg-white/[0.06] text-neutral-200 cursor-pointer'
                      : 'border-black/15 hover:bg-black/[0.05] text-neutral-800 cursor-pointer'
                  }`}
                >
                  {isEquipped ? 'Badge Equipped' : 'Equip Badge'}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenVault}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'text-neutral-300 hover:text-white hover:bg-white/[0.06]'
                  : 'text-neutral-600 hover:text-black hover:bg-black/[0.05]'
              }`}
            >
              <span>Open Vault</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
