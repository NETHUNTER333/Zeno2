import React, { useState, useRef, useEffect } from 'react';
import { BarChart2, ArrowDownRight, ArrowUpRight, Cpu, Pin } from 'lucide-react';
import { ChatMessage } from '../types';
import { resolveRealTokenMetrics } from './GrokTimingTooltip';
import { GROK_MODELS } from './GrokModelPicker';
import { UserAccountStore } from '../lib/userAccountStore';

interface HeaderTokenTrackerProps {
  messages: ChatMessage[];
  isDark?: boolean;
}

function getCleanModelName(rawModel?: string): string {
  if (!rawModel) return 'DeepSeek V4.1 Flash';
  const matched = GROK_MODELS.find(
    (m) => m.name === rawModel || m.id === rawModel || m.geminiModel === rawModel
  );
  if (matched) return matched.name;
  if (rawModel.includes('/')) {
    const tail = rawModel.split('/').pop() || rawModel;
    const byTail = GROK_MODELS.find((m) => m.id.includes(tail) || m.geminiModel.includes(tail));
    if (byTail) return byTail.name;
  }
  return rawModel;
}

export const HeaderTokenTracker: React.FC<HeaderTokenTrackerProps> = ({ messages, isDark = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pinnedCount, setPinnedCount] = useState<number>(() => UserAccountStore.getBookmarks().length);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const syncPins = () => setPinnedCount(UserAccountStore.getBookmarks().length);
    window.addEventListener('zeno-account-updated', syncPins);
    return () => window.removeEventListener('zeno-account-updated', syncPins);
  }, []);

  const assistantResponses = messages.filter((m) => m.role === 'assistant');

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalSessionTokens = 0;
  let speedSum = 0;

  const modelBreakdownMap = new Map<string, { turns: number; tokens: number }>();

  const chartData = assistantResponses.map((msg, idx) => {
    const {
      promptTok,
      completionTok,
      totalTok,
      speedTokPerSec,
    } = resolveRealTokenMetrics(msg.timing, msg.content || '');

    totalPromptTokens += promptTok;
    totalCompletionTokens += completionTok;
    totalSessionTokens += totalTok;
    speedSum += speedTokPerSec;

    const cleanModel = getCleanModelName(msg.modelUsed);
    const prev = modelBreakdownMap.get(cleanModel) || { turns: 0, tokens: 0 };
    modelBreakdownMap.set(cleanModel, {
      turns: prev.turns + 1,
      tokens: prev.tokens + totalTok,
    });

    return {
      index: idx + 1,
      promptTok,
      completionTok,
      totalTok,
      speed: speedTokPerSec,
      model: cleanModel,
    };
  });

  const modelBreakdown = Array.from(modelBreakdownMap.entries());
  const avgSpeed = chartData.length > 0 ? (speedSum / chartData.length).toFixed(1) : '0';

  const formatTokNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  const maxTotalInChart = Math.max(...chartData.map((d) => d.totalTok), 100);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 py-1 rounded-full border backdrop-blur-2xl transition-all cursor-pointer text-[10px] select-none font-medium shrink-0 ${
          isDark
            ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.14] text-white/85 hover:text-white'
            : 'bg-black/[0.04] hover:bg-black/[0.08] border-black/[0.1] text-black/80 hover:text-black'
        }`}
        title="Session Token Consumption & Multi-Model Context Tracker"
      >
        <BarChart2 className="w-2.5 h-2.5 opacity-75" />
        <span className="font-mono text-[9.5px] tracking-tight">{formatTokNumber(totalSessionTokens)} tok</span>
      </button>

      {isOpen && (
        <div
          className={`absolute top-full right-0 mt-2 w-76 max-w-[calc(100vw-2rem)] p-3.5 rounded-2xl border backdrop-blur-2xl shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-[#121212]/98 border-[#2e2e2e] text-[#e5e5e5] shadow-black/90'
              : 'bg-white/98 border-[#e0e0e0] text-[#0d0d0d] shadow-black/15'
          }`}
        >
          {/* Title Row */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <BarChart2 className="w-4 h-4 text-[#007aff]" />
              <span>Session Token & Context Tracker</span>
            </div>
            <span className="text-[10px] font-mono opacity-50">
              {assistantResponses.length} turns
            </span>
          </div>

          {/* Session Summary Cards */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div
              className={`p-2 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
              }`}
            >
              <div className="text-[10px] opacity-60 flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-[#007aff]" />
                <span>Prompt (In)</span>
              </div>
              <div className="font-mono text-sm font-semibold mt-0.5">
                {formatTokNumber(totalPromptTokens)}
              </div>
            </div>

            <div
              className={`p-2 rounded-xl border ${
                isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
              }`}
            >
              <div className="text-[10px] opacity-60 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                <span>Completion (Out)</span>
              </div>
              <div className="font-mono text-sm font-semibold mt-0.5">
                {formatTokNumber(totalCompletionTokens)}
              </div>
            </div>
          </div>

          {/* Speed & Active Context Row */}
          <div className="space-y-1.5 text-[11px] font-mono mb-3 px-1">
            <div className="flex items-center justify-between">
              <span className="opacity-60 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-emerald-400" />
                <span>Avg Speed:</span>
              </span>
              <span className="font-semibold text-emerald-400">{avgSpeed} tok/s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-60 flex items-center gap-1">
                <Pin className="w-3 h-3 text-[#FC4C01]" />
                <span>Pinned Context:</span>
              </span>
              <span className="font-semibold text-[#FC4C01]">{pinnedCount} pinned insights</span>
            </div>
          </div>

          {/* Multi-Model Breakdown */}
          {modelBreakdown.length > 0 && (
            <div className="pt-2 pb-2.5 border-t border-black/10 dark:border-white/10">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-1.5">
                <span>Models Used in Thread</span>
                <span>Usage</span>
              </div>
              <div className="space-y-1">
                {modelBreakdown.map(([modelName, stats]) => (
                  <div key={modelName} className="flex items-center justify-between text-[11px]">
                    <span className="font-medium truncate pr-2">{modelName}</span>
                    <span className="font-mono text-[10px] opacity-75 shrink-0">
                      {stats.turns} {stats.turns === 1 ? 'turn' : 'turns'} · {formatTokNumber(stats.tokens)} tok
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response Token Consumption Chart */}
          <div className="pt-2 border-t border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider opacity-50 mb-2">
              <span>Token Consumption per Response</span>
              <span>Tokens</span>
            </div>

            {chartData.length === 0 ? (
              <div className="text-center py-4 text-[11px] opacity-50">
                Send a message to view live token consumption charts.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {chartData.map((d) => {
                  const promptPct = (d.promptTok / maxTotalInChart) * 100;
                  const completionPct = (d.completionTok / maxTotalInChart) * 100;

                  return (
                    <div key={d.index} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="opacity-75 truncate pr-2">R{d.index} · {d.model}</span>
                        <span className="font-medium text-[#007aff] shrink-0">{d.totalTok} tok</span>
                      </div>

                      <div className="w-full h-2 rounded-full overflow-hidden flex bg-black/10 dark:bg-white/10">
                        <div
                          className="h-full bg-[#007aff] transition-all duration-300"
                          style={{ width: `${Math.max(4, promptPct)}%` }}
                          title={`Turn ${d.index} Prompt Tokens: ${d.promptTok}`}
                        />
                        <div
                          className="h-full bg-emerald-400 transition-all duration-300"
                          style={{ width: `${Math.max(4, completionPct)}%` }}
                          title={`Turn ${d.index} Completion Tokens: ${d.completionTok}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
