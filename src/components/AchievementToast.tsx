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
  Check,
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
  const [isGuest, setIsGuest] = useState<boolean>(() => UserAccountStore.isGuest());

  const activeToast = queue[0] || null;

  const syncAccountState = useCallback(() => {
    setIsGuest(UserAccountStore.isGuest());
  }, []);

  useEffect(() => {
    const handleUnlockEvent = (e: Event) => {
      const custom = e as CustomEvent<AchievementUnlockPayload>;
      const detail = custom.detail;
      if (!detail || !detail.id) return;

      setQueue((prev) => {
        if (detail.isPreview) {
          const filtered = prev.filter((item) => item.id !== detail.id);
          return [detail, ...filtered];
        }
        if (prev.some((item) => item.id === detail.id)) {
          return prev;
        }
        return [...prev, detail];
      });
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

  // Auto-dismisses after 4.5 seconds so it disappears smoothly without requiring manual close
  useEffect(() => {
    if (!activeToast || isPaused) return;
    const timer = setTimeout(() => {
      setQueue((prev) => prev.slice(1));
    }, 4500);
    return () => clearTimeout(timer);
  }, [activeToast, isPaused]);

  if (!activeToast) return null;

  const isAlreadyClaimed = activeToast.isClaimed || claimedIds.has(activeToast.id);

  const handleDismissCurrent = () => {
    setQueue((prev) => prev.slice(1));
  };

  const handleTap = () => {
    if (isGuest) {
      window.dispatchEvent(
        new CustomEvent('kinich-open-auth', {
          detail: { reason: 'Sign in to claim your streak bonus' },
        })
      );
      handleDismissCurrent();
      return;
    }

    if (!isAlreadyClaimed) {
      if (activeToast.kind === 'milestone' && typeof activeToast.days === 'number') {
        UserAccountStore.claimStreakMilestone(activeToast.days, Boolean(activeToast.isPreview));
      } else if (activeToast.badgeId) {
        UserAccountStore.claimBadgeReward(activeToast.badgeId, Boolean(activeToast.isPreview));
      }
      setClaimedIds((prev) => new Set(prev).add(activeToast.id));
    }

    handleDismissCurrent();
  };

  const renderIcon = () => {
    const cls = 'w-4 h-4';
    switch (activeToast.iconName) {
      case 'flame':
        return <Flame className={cls} />;
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

  return (
    <div
      onClick={handleTap}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="fixed bottom-4 right-4 z-[115] max-w-sm w-[calc(100vw-2rem)] cursor-pointer select-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-3"
      role="status"
      aria-live="polite"
      title="Click to dismiss or claim"
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
            {renderIcon()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold truncate">
                {activeToast.title}
              </span>
              <span
                className={`text-[10px] font-mono tabular-nums shrink-0 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                +{activeToast.bonusMessages} msgs · +{activeToast.bonusUploads} uploads
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span
                className={`text-[11px] truncate flex items-center gap-1 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                {isAlreadyClaimed ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Reward claimed</span>
                  </>
                ) : isGuest ? (
                  <span>Sign in to claim</span>
                ) : (
                  <span>Tap to claim</span>
                )}
              </span>

              {typeof activeToast.days === 'number' && (
                <span
                  className={`text-[10px] font-mono ${
                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                  }`}
                >
                  {activeToast.days}d streak
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
