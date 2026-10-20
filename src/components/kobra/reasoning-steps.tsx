import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export interface ReasoningStage {
  id?: string;
  title: string;
  detail?: string;
  sources?: { title: string; icon?: string; url?: string }[];
  status?: 'pending' | 'running' | 'done';
}

export interface ReasoningStepsProps {
  durationSec?: number;
  stages?: (string | ReasoningStage)[];
  thoughts?: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
  isDark?: boolean;
  className?: string;
}

// 6-dot matrix icon matching Screenshot_20261017_165014.jpg and Screenshot_20261017_165020.jpg
export const ReasoningDotIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 16 16"
    className={`${className} fill-current shrink-0`}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="5" cy="4" r="1.25" />
    <circle cx="11" cy="4" r="1.25" />
    <circle cx="5" cy="8" r="1.25" />
    <circle cx="11" cy="8" r="1.25" />
    <circle cx="5" cy="12" r="1.25" />
    <circle cx="11" cy="12" r="1.25" />
  </svg>
);

export const ReasoningSteps: React.FC<ReasoningStepsProps> = ({
  durationSec = 9,
  stages = [],
  thoughts,
  isStreaming = false,
  defaultExpanded = false,
  isDark = true,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || isStreaming);

  // Normalize stages into structured objects
  const normalizedStages: ReasoningStage[] = stages.map((s, idx) => {
    if (typeof s === 'string') {
      return { id: `stage-${idx}`, title: s, status: 'done' };
    }
    return s;
  });

  const activeStage =
    normalizedStages.find((s) => s.status === 'running') ||
    normalizedStages[normalizedStages.length - 1] || {
      title: 'Drafting response',
    };

  const allThoughts =
    thoughts ||
    normalizedStages
      .map((s) => s.detail)
      .filter(Boolean)
      .join('\n\n');

  const allSources = normalizedStages.flatMap((s) => s.sources || []);

  return (
    <div className={`my-2 select-text font-sans text-xs ${className}`}>
      {/* Header bar / Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`group flex items-center gap-1.5 py-1 text-[13px] font-normal transition-colors cursor-pointer ${
            isDark
              ? 'text-neutral-400 hover:text-white'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          {/* Collapsed state title: "Thought for 9s ∨" matching Screenshot_20261017_165017.jpg */}
          {!isExpanded ? (
            <span className="flex items-center gap-1">
              <span>{isStreaming ? 'Thinking...' : `Thought for ${durationSec}s`}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </span>
          ) : (
            <span className="flex items-center gap-2 font-medium">
              <ReasoningDotIcon className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 animate-pulse" />
              <span className={isDark ? 'text-neutral-200' : 'text-neutral-800'}>
                {activeStage.title}
              </span>
              <ChevronUp className="w-3.5 h-3.5 opacity-60 ml-0.5" />
            </span>
          )}
        </button>
      </div>

      {/* Expanded Reasoning View matching Screenshot_20261017_165014.jpg and Screenshot_20261017_165020.jpg */}
      {isExpanded && (
        <div className="mt-2.5 relative pl-0.5 animate-in fade-in duration-150">
          {/* Source / Artifact Pills Row (Screenshot_20261017_165014.jpg) */}
          {allSources.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {allSources.map((src, idx) => (
                <a
                  key={idx}
                  href={src.url || '#'}
                  target={src.url ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all ${
                    isDark
                      ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-neutral-200'
                      : 'bg-black/[0.03] hover:bg-black/[0.06] border-black/10 text-neutral-800'
                  }`}
                >
                  {src.icon && <span className="text-[13px]">{src.icon}</span>}
                  <span>{src.title}</span>
                  {src.url && <ExternalLink className="w-3 h-3 opacity-40 ml-0.5" />}
                </a>
              ))}
            </div>
          )}

          {/* Reasoning Thought Text Block with Subtle Right Progress Track (Screenshot_20261017_165020.jpg) */}
          {allThoughts && (
            <div className="relative pr-4">
              <div
                className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                  isDark ? 'text-neutral-400' : 'text-neutral-600'
                }`}
              >
                {allThoughts}
              </div>

              {/* Subtle Right-side Vertical Track (Screenshot_20261017_165020.jpg) */}
              <div
                className={`absolute top-0 right-0 bottom-0 w-[2px] rounded-full pointer-events-none ${
                  isDark
                    ? 'bg-gradient-to-b from-neutral-600 via-neutral-800 to-transparent'
                    : 'bg-gradient-to-b from-neutral-300 via-neutral-200 to-transparent'
                }`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReasoningSteps;
