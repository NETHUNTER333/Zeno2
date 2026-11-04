import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  Bookmark,
  Compass,
  BarChart3,
  MessageSquare,
  X,
  Share2,
} from 'lucide-react';
import { ChatThread } from './Sidebar';
import { KnowledgeVaultItem } from '../types';
import { KnowledgeVaultStore, getNotificationPreferences } from '../lib/growthStore';
import { GrowthHubTab } from './KinichGrowthHubModal';

export interface SmartContinuationStripProps {
  threads: ChatThread[];
  onSelectThread: (threadId: string) => void;
  onContinueVaultItem: (item: KnowledgeVaultItem) => void;
  onOpenGrowthHub: (tab: GrowthHubTab) => void;
  isDark?: boolean;
}

export const SmartContinuationStrip: React.FC<SmartContinuationStripProps> = ({
  threads,
  onSelectThread,
  onContinueVaultItem,
  onOpenGrowthHub,
  isDark = true,
}) => {
  const [vaultItems, setVaultItems] = useState<KnowledgeVaultItem[]>(() =>
    KnowledgeVaultStore.getItems()
  );
  const [dismissedIds, setDismissedIds] = useState<string[]>(() =>
    KnowledgeVaultStore.getDismissedContinuationIds()
  );
  const [hideContinuationSection, setHideContinuationSection] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kinich_hide_continuation_strip_v1') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = () => {
      setVaultItems(KnowledgeVaultStore.getItems());
      setDismissedIds(KnowledgeVaultStore.getDismissedContinuationIds());
    };
    window.addEventListener('kinich-vault-updated', sync);
    return () => window.removeEventListener('kinich-vault-updated', sync);
  }, []);

  const notifPrefs = useMemo(() => getNotificationPreferences(), [vaultItems]);

  const recentContinuations = useMemo(() => {
    if (hideContinuationSection || !notifPrefs.unfinishedResearchReminders) return [];
    const items: Array<{
      key: string;
      kind: 'thread' | 'vault';
      title: string;
      subtitle: string;
      onOpen: () => void;
    }> = [];

    // Up to 2 recent non-empty threads
    const validThreads = threads
      .filter(
        (t) =>
          t.id &&
          t.title &&
          !dismissedIds.includes(`thread:${t.id}`) &&
          Array.isArray(t.messages) &&
          t.messages.length > 0
      )
      .slice(0, 2);

    validThreads.forEach((t) => {
      const msgCount = t.messages?.length || 0;
      items.push({
        key: `thread:${t.id}`,
        kind: 'thread',
        title: t.title,
        subtitle: `Continue research (${msgCount} ${msgCount === 1 ? 'message' : 'messages'})`,
        onOpen: () => onSelectThread(t.id),
      });
    });

    // Up to 1 recent saved Knowledge Vault item
    const recentVault = vaultItems.find((v) => !dismissedIds.includes(`vault:${v.id}`));
    if (recentVault && items.length < 3) {
      items.push({
        key: `vault:${recentVault.id}`,
        kind: 'vault',
        title: recentVault.title,
        subtitle: 'Saved in Knowledge Vault · Reopen & build upon this',
        onOpen: () => onContinueVaultItem(recentVault),
      });
    }

    return items;
  }, [
    threads,
    vaultItems,
    dismissedIds,
    hideContinuationSection,
    notifPrefs.unfinishedResearchReminders,
    onSelectThread,
    onContinueVaultItem,
  ]);

  const handleDismissItem = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    KnowledgeVaultStore.dismissContinuationItem(key);
    setDismissedIds(KnowledgeVaultStore.getDismissedContinuationIds());
  };

  return (
    <div className="w-full max-w-3xl mb-3 space-y-2.5">
      {/* Quick Discovery & Knowledge Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenGrowthHub('discover')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#111319]/90 border-white/10 text-neutral-300 hover:text-white hover:border-white/25'
                : 'bg-white/90 border-black/10 text-slate-700 hover:text-black hover:border-black/25'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Explore Public Research</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenGrowthHub('vault')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#111319]/90 border-white/10 text-neutral-300 hover:text-white hover:border-white/25'
                : 'bg-white/90 border-black/10 text-slate-700 hover:text-black hover:border-black/25'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            <span>Knowledge Vault ({vaultItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenGrowthHub('weekly')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#111319]/90 border-white/10 text-neutral-300 hover:text-white hover:border-white/25'
                : 'bg-white/90 border-black/10 text-slate-700 hover:text-black hover:border-black/25'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Weekly Brief</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenGrowthHub('passes')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#111319]/90 border-white/10 text-neutral-300 hover:text-white hover:border-white/25'
                : 'bg-white/90 border-black/10 text-slate-700 hover:text-black hover:border-black/25'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Kinich Passes</span>
          </button>
        </div>

        {recentContinuations.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setHideContinuationSection(true);
              try {
                localStorage.setItem('kinich_hide_continuation_strip_v1', 'true');
              } catch {}
            }}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 cursor-pointer"
          >
            Hide recent work
          </button>
        )}
      </div>

      {/* Continue Where You Left Off Cards */}
      {recentContinuations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {recentContinuations.map((item) => (
            <div
              key={item.key}
              onClick={item.onOpen}
              className={`group relative p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                isDark
                  ? 'bg-[#101218]/90 border-white/10 hover:border-white/25 text-white'
                  : 'bg-white/90 border-black/10 hover:border-black/25 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.kind === 'thread' ? (
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{item.title}</div>
                  <div className="text-[10px] text-neutral-500 truncate">{item.subtitle}</div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:translate-x-0.5 transition-transform" />
                <button
                  type="button"
                  onClick={(e) => handleDismissItem(item.key, e)}
                  className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white cursor-pointer"
                  title="Dismiss suggestion"
                  aria-label="Dismiss suggestion"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
