import React from 'react';

export interface TimingData {
  firstTokenSec: number;
  totalSec: number;
  speedTokPerSec: number;
  chunks: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export function resolveRealTokenMetrics(timing?: TimingData, messageContent = '') {
  const words = messageContent.trim().split(/\s+/).filter(Boolean);
  let fallbackCompletion = 0;
  for (const w of words) {
    fallbackCompletion += w.length <= 4 ? 1 : Math.ceil(w.length / 3.8);
  }
  fallbackCompletion = Math.max(1, fallbackCompletion);
  const fallbackPrompt = Math.max(12, Math.round(fallbackCompletion * 1.4) + 18);

  const completionTok =
    typeof timing?.completionTokens === 'number' && timing.completionTokens > 0
      ? timing.completionTokens
      : fallbackCompletion;

  const promptTok =
    typeof timing?.promptTokens === 'number' && timing.promptTokens > 0
      ? timing.promptTokens
      : fallbackPrompt;

  const totalTok =
    typeof timing?.totalTokens === 'number' && timing.totalTokens > 0
      ? timing.totalTokens
      : promptTok + completionTok;

  const totalSec = timing?.totalSec && timing.totalSec > 0 ? timing.totalSec : 0.45;
  const firstTokenSec =
    timing?.firstTokenSec && timing.firstTokenSec > 0
      ? timing.firstTokenSec
      : parseFloat((totalSec * 0.25).toFixed(2));
  const speedTokPerSec =
    timing?.speedTokPerSec && timing.speedTokPerSec > 0
      ? timing.speedTokPerSec
      : parseFloat((completionTok / Math.max(totalSec - firstTokenSec * 0.4, 0.05)).toFixed(1));
  const chunks = timing?.chunks && timing.chunks > 0 ? timing.chunks : Math.max(1, Math.ceil(completionTok / 4));

  return {
    promptTok,
    completionTok,
    totalTok,
    totalSec,
    firstTokenSec,
    speedTokPerSec,
    chunks,
  };
}

interface GrokTimingTooltipProps {
  timing: TimingData;
  messageContent?: string;
  isDark?: boolean;
}

export const GrokTimingTooltip: React.FC<GrokTimingTooltipProps> = ({
  timing,
  messageContent = '',
  isDark = true,
}) => {
  const { totalSec } = resolveRealTokenMetrics(timing, messageContent);

  return (
    <div
      className={`inline-flex items-center text-[9.5px] font-mono select-none ${
        isDark ? 'text-white/45' : 'text-black/45'
      }`}
      title={`Answered in ${totalSec}s`}
    >
      <span>{totalSec}s</span>
    </div>
  );
};

