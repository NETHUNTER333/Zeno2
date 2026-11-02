import React, { useState, useEffect } from 'react';
import { Gift, Copy, Check, X, Plus, Sparkles } from 'lucide-react';
import {
  getEightReferralTrackerState,
  getMyReferralStatus,
  setHomeReferralPopupDismissed,
  claimEightReferralTier,
  REFERRAL_8_REWARD_TIERS,
} from '../lib/growthStore';

interface HomeReferralPopupProps {
  theme?: 'dark' | 'light';
}

export const HomeReferralPopup: React.FC<HomeReferralPopupProps> = ({ theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const [tracker, setTracker] = useState(() => getEightReferralTrackerState());
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const refresh = () => {
    setTracker(getEightReferralTrackerState());
  };

  useEffect(() => {
    refresh();
    getMyReferralStatus()
      .then(() => refresh())
      .catch(() => {});
    window.addEventListener('zeno-growth-updated', refresh);
    window.addEventListener('zeno-account-updated', refresh);
    return () => {
      window.removeEventListener('zeno-growth-updated', refresh);
      window.removeEventListener('zeno-account-updated', refresh);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(tracker.inviteUrl);
      setCopied(true);
      showToast('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleClaimTier = (targetReferrals: number) => {
    const res = claimEightReferralTier(targetReferrals);
    setTracker(res.state);
    if (res.ok && res.tier) {
      showToast(
        `Claimed +${res.tier.bonusMessages} Msgs, +${res.tier.bonusUploads} Uploads & +${res.tier.bonusQuizzes} Quizzes!`
      );
    }
  };

  const handleDismiss = () => {
    setHomeReferralPopupDismissed(true);
    refresh();
  };

  const handleRestore = () => {
    setHomeReferralPopupDismissed(false);
    refresh();
  };

  // Find any ready-to-claim tier, or the next upcoming tier
  const claimableTiers = REFERRAL_8_REWARD_TIERS.filter(
    (t) => tracker.count >= t.targetReferrals && !tracker.claimedTiers.includes(t.targetReferrals)
  );
  const nextTier =
    REFERRAL_8_REWARD_TIERS.find((t) => tracker.count < t.targetReferrals) ||
    REFERRAL_8_REWARD_TIERS[REFERRAL_8_REWARD_TIERS.length - 1];

  if (tracker.dismissedOnHome) {
    return (
      <div className="w-full max-w-xl mx-auto mb-2.5 flex justify-center">
        <button
          type="button"
          onClick={handleRestore}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium transition-all cursor-pointer ${
            isDark
              ? 'bg-neutral-900/70 hover:bg-neutral-800 border-white/10 text-neutral-300'
              : 'bg-white/80 hover:bg-neutral-100 border-black/10 text-neutral-700 shadow-2xs'
          }`}
        >
          <Gift className="w-3 h-3 text-[#FC4C01]" />
          <span>8-Referral Rewards</span>
          <span className="font-mono tabular-nums text-[#FC4C01] font-semibold">
            {Math.min(8, tracker.count)}/8
          </span>
          {claimableTiers.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#FC4C01] text-white text-[9.5px] font-semibold">
              Claim ({claimableTiers.length})
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto mb-3">
      <div
        className={`relative rounded-2xl border px-3.5 py-3 transition-all ${
          isDark
            ? 'bg-[#121212]/90 border-white/12 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)]'
            : 'bg-white/95 border-black/10 text-neutral-900 shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
        }`}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-[#FC4C01]/15 border border-[#FC4C01]/35 flex items-center justify-center shrink-0">
              <Gift className="w-3.5 h-3.5 text-[#FC4C01]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold tracking-tight">
                  8-Referral Reward Tracker
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-[#FC4C01]/15 text-[#FC4C01] font-mono tabular-nums text-[10px] font-semibold">
                  {Math.min(8, tracker.count)} / 8 Referrals
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                Invite friends to unlock free messages, file uploads, study quizzes & deep research.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            title="Remove notification popup"
            aria-label="Remove notification popup"
            className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                : 'text-neutral-400 hover:text-black hover:bg-black/5'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 8-Step Segmented Progress Bar */}
        <div className="grid grid-cols-8 gap-1 mt-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => {
            const filled = tracker.count >= step;
            const isTierStep = step === 1 || step === 3 || step === 5 || step === 8;
            return (
              <div key={step} className="flex flex-col items-center gap-0.5">
                <div
                  className={`w-full h-1.5 rounded-full transition-all ${
                    filled
                      ? 'bg-[#FC4C01]'
                      : isDark
                      ? 'bg-white/10'
                      : 'bg-black/10'
                  }`}
                />
                <span
                  className={`text-[9px] font-mono tabular-nums ${
                    filled
                      ? 'text-[#FC4C01] font-bold'
                      : isTierStep
                      ? 'text-neutral-400 font-medium'
                      : 'text-neutral-500/60'
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        {/* Claimable Reward Banner OR Next Tier Preview + Actions */}
        <div className="mt-2.5 pt-2 border-t border-neutral-500/15 flex flex-wrap items-center justify-between gap-2">
          {claimableTiers.length > 0 ? (
            <div className="flex items-center justify-between w-full gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#FC4C01]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {claimableTiers[0].title} Unlocked: +{claimableTiers[0].bonusMessages} Msgs, +
                  {claimableTiers[0].bonusUploads} Uploads, +{claimableTiers[0].bonusQuizzes} Quizzes
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleClaimTier(claimableTiers[0].targetReferrals)}
                className="px-3 py-1 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <Gift className="w-3 h-3" />
                Claim Free Rewards
              </button>
            </div>
          ) : (
            <>
              <div className="text-[10.5px] text-neutral-400 font-mono tabular-nums">
                {tracker.count >= 8 ? (
                  <span className="text-emerald-400 font-semibold">
                    ✓ All 8/8 Referral Rewards Claimed!
                  </span>
                ) : (
                  <span>
                    Next ({nextTier.targetReferrals} ref):{' '}
                    <strong className={isDark ? 'text-white' : 'text-black'}>
                      +{nextTier.bonusMessages} Msgs · +{nextTier.bonusUploads} Uploads · +
                      {nextTier.bonusQuizzes} Quizzes
                    </strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <span
                  className={`px-2 py-1 rounded-md font-mono text-[10px] border ${
                    isDark
                      ? 'bg-white/5 border-white/10 text-neutral-300'
                      : 'bg-black/5 border-black/10 text-neutral-700'
                  }`}
                  title="Your personal referral code"
                >
                  {tracker.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-3 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied ({tracker.code})
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Invite Link
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Inline Feedback Toast */}
        {toastMsg && (
          <div className="mt-2 px-2.5 py-1 rounded-lg bg-[#FC4C01]/15 border border-[#FC4C01]/35 text-[#FC4C01] text-[10.5px] font-medium flex items-center justify-between">
            <span>{toastMsg}</span>
            <Check className="w-3 h-3 shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
};
