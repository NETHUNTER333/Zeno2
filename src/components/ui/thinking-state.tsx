import React, { useState, useEffect, useId } from 'react';
import { ChevronDown, Check, Globe } from 'lucide-react';

/**
 * Kokonut UI — ShimmerText Component
 * Smooth metallic gradient sweep across active status labels and thinking steps.
 */
export interface ShimmerTextProps {
  text: string;
  className?: string;
  isDark?: boolean;
  as?: 'span' | 'div' | 'p';
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  text,
  className = '',
  isDark = true,
  as: Component = 'span',
}) => {
  return (
    <Component
      className={`inline-block bg-clip-text text-transparent animate-kokonut-shimmer select-none ${
        isDark
          ? 'bg-[linear-gradient(110deg,#71717a_0%,#a1a1aa_35%,#ffffff_50%,#a1a1aa_65%,#71717a_100%)]'
          : 'bg-[linear-gradient(110deg,#71717a_0%,#52525b_35%,#09090b_50%,#52525b_65%,#71717a_100%)]'
      } ${className}`}
    >
      {text}
    </Component>
  );
};

/**
 * affectUI — ThinkingState Types & Component
 * AI working panel with a live timer, twinkling 3x3 pixel matrix, searched sources with domain tooltips,
 * and sequential thinking steps that appear one by one.
 */
export interface ThinkingSource {
  label: string;
  href?: string;
  domain?: string;
  icon?: React.ReactNode;
}

export type ThinkingStep =
  | {
      type: 'search';
      label?: string;
      sources: ThinkingSource[];
    }
  | {
      type: 'thought';
      text: string;
    };

export interface ThinkingStateProps {
  steps: ThinkingStep[];
  status?: 'thinking' | 'done';
  duration?: number;
  stepInterval?: number;
  maxVisibleSources?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete?: () => void;
  className?: string;
  isDark?: boolean;
}

function extractDomainLabel(href?: string, fallbackDomain?: string): string {
  if (fallbackDomain) return fallbackDomain;
  if (!href) return '';
  try {
    const url = new URL(href);
    const path = url.pathname && url.pathname !== '/' ? url.pathname : '';
    return `${url.hostname}${path}`.slice(0, 42);
  } catch {
    return href;
  }
}

function extractHostname(href?: string, fallbackDomain?: string): string {
  if (fallbackDomain) {
    return fallbackDomain.split('/')[0].replace(/^www\./, '');
  }
  if (!href) return '';
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * 3x3 Blue Pixel Matrix Indicator (affectUI signature header icon)
 */
const PixelGridIndicator: React.FC<{ isThinking: boolean }> = ({ isThinking }) => {
  // Delays in ms for organic twinkling while thinking
  const delays = [0, 220, 480, 140, 360, 600, 300, 80, 520];
  // Static opacity pattern when finished thinking (matching affectUI screenshot)
  const staticOpacities = [1, 0.85, 0.45, 0.9, 1, 0.85, 1, 0.55, 0.3];

  return (
    <div
      className="grid grid-cols-3 gap-[2.5px] w-[14px] h-[14px] shrink-0"
      aria-hidden="true"
    >
      {delays.map((delay, idx) => (
        <span
          key={idx}
          style={
            isThinking
              ? {
                  animation: `affect-pixel-twinkle 1.35s ease-in-out ${delay}ms infinite`,
                }
              : {
                  opacity: staticOpacities[idx],
                }
          }
          className="w-[3px] h-[3px] rounded-[0.75px] bg-[#3b82f6] transition-opacity duration-300"
        />
      ))}
    </div>
  );
};

export const ThinkingState: React.FC<ThinkingStateProps> = ({
  steps,
  status: controlledStatus,
  duration,
  stepInterval = 800,
  maxVisibleSources = 4,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  onComplete,
  className = '',
  isDark = true,
}) => {
  const panelId = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const handleToggleOpen = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const [revealedCount, setRevealedCount] = useState<number>(
    controlledStatus === 'done' ? steps.length : Math.min(1, steps.length)
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(
    duration !== undefined ? Math.max(1, Math.round(duration)) : 1
  );
  const [expandedSearchIndices, setExpandedSearchIndices] = useState<Record<number, boolean>>({});
  const [hoveredSourceKey, setHoveredSourceKey] = useState<string | null>(null);

  // Sync when steps or status changes
  useEffect(() => {
    if (controlledStatus === 'done') {
      setRevealedCount(steps.length);
      if (duration !== undefined) {
        setElapsedSeconds(Math.max(1, Math.round(duration)));
      }
      return;
    }

    setRevealedCount(Math.min(1, steps.length));
    if (stepInterval <= 0) {
      setRevealedCount(steps.length);
      return;
    }

    const interval = window.setInterval(() => {
      setRevealedCount((prev) => {
        if (prev >= steps.length) {
          window.clearInterval(interval);
          onComplete?.();
          return prev;
        }
        const next = prev + 1;
        if (next >= steps.length) {
          onComplete?.();
        }
        return next;
      });
    }, stepInterval);

    return () => window.clearInterval(interval);
  }, [steps, controlledStatus, stepInterval, duration, onComplete]);

  const isAutoDone =
    controlledStatus === undefined && revealedCount >= steps.length && steps.length > 0;
  const effectiveStatus: 'thinking' | 'done' =
    controlledStatus !== undefined ? controlledStatus : isAutoDone ? 'done' : 'thinking';

  // Live 1s timer while thinking
  useEffect(() => {
    if (effectiveStatus === 'done') {
      if (duration !== undefined) {
        setElapsedSeconds(Math.max(1, Math.round(duration)));
      }
      return;
    }

    setElapsedSeconds(1);
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [effectiveStatus, duration]);

  const visibleSteps =
    effectiveStatus === 'done' ? steps : steps.slice(0, Math.max(1, revealedCount));

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        isDark
          ? 'bg-[#121215] border-white/[0.08] text-neutral-200 shadow-[0_14px_34px_rgba(0,0,0,0.45)]'
          : 'bg-white border-black/[0.08] text-neutral-800 shadow-[0_10px_28px_rgba(0,0,0,0.05)]'
      } ${className}`}
    >
      {/* Collapsible Header Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer rounded-2xl ${
          isOpen
            ? isDark
              ? 'border-b border-white/[0.06]'
              : 'border-b border-black/[0.06]'
            : ''
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <PixelGridIndicator isThinking={effectiveStatus === 'thinking'} />

          <div className="flex items-center gap-2 text-[14px] leading-none">
            {effectiveStatus === 'thinking' ? (
              <>
                <ShimmerText
                  text="Thinking"
                  isDark={isDark}
                  className="font-medium tracking-tight"
                />
                <span
                  className={`font-normal tabular-nums ${
                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                  }`}
                >
                  {elapsedSeconds}s
                </span>
              </>
            ) : (
              <span
                className={`font-medium tracking-tight ${
                  isDark ? 'text-neutral-100' : 'text-neutral-900'
                }`}
              >
                Worked for {duration !== undefined ? Math.max(1, Math.round(duration)) : elapsedSeconds}s
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-0' : '-rotate-90'
          } ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}
        />
      </button>

      {/* Collapsible Timeline Body */}
      {isOpen && (
        <div
          id={panelId}
          aria-live="polite"
          className="px-4 py-4 space-y-0"
        >
          {visibleSteps.map((step, idx) => {
            const isLastVisible = idx === visibleSteps.length - 1;
            const isCurrentlyActive =
              effectiveStatus === 'thinking' && isLastVisible;
            const showLineBelow =
              idx < visibleSteps.length - 1 || effectiveStatus === 'done';

            if (step.type === 'search') {
              const isExpanded = !!expandedSearchIndices[idx];
              const displayedSources = isExpanded
                ? step.sources
                : step.sources.slice(0, maxVisibleSources);
              const hiddenCount = Math.max(0, step.sources.length - maxVisibleSources);

              return (
                <div key={`step-search-${idx}`} className="flex items-stretch gap-3">
                  {/* Left Timeline Column */}
                  <div className="w-5 flex flex-col items-center shrink-0">
                    <div
                      className={`w-5 h-5 flex items-center justify-center shrink-0 ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      <Globe className="w-4 h-4 stroke-[1.75]" />
                    </div>
                    {showLineBelow && (
                      <div
                        className={`w-px flex-1 my-1 ${
                          isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'
                        }`}
                      />
                    )}
                  </div>

                  {/* Right Content Column */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div
                      className={`text-[13.5px] leading-5 mb-2.5 ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      {step.label || 'Searched'}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {displayedSources.map((src, sIdx) => {
                        const chipKey = `${idx}-src-${sIdx}`;
                        const host = extractHostname(src.href, src.domain);
                        const domainTooltip = extractDomainLabel(src.href, src.domain);
                        const faviconUrl = host
                          ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                              host
                            )}&sz=32`
                          : '';
                        const isHovered = hoveredSourceKey === chipKey;

                        const ChipTag = src.href ? 'a' : 'div';
                        const linkProps = src.href
                          ? {
                              href: src.href,
                              target: '_blank',
                              rel: 'noopener noreferrer',
                            }
                          : {};

                        return (
                          <div key={chipKey} className="relative inline-flex">
                            <ChipTag
                              {...linkProps}
                              onMouseEnter={() => setHoveredSourceKey(chipKey)}
                              onMouseLeave={() => setHoveredSourceKey(null)}
                              onFocus={() => setHoveredSourceKey(chipKey)}
                              onBlur={() => setHoveredSourceKey(null)}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[13px] font-normal leading-tight transition-all ${
                                src.href ? 'cursor-pointer' : ''
                              } ${
                                isDark
                                  ? 'bg-[#17171b] border-white/[0.08] text-neutral-200 hover:border-white/[0.18] hover:bg-white/[0.05]'
                                  : 'bg-[#f8f8fa] border-black/[0.08] text-neutral-800 hover:border-black/[0.18] hover:bg-neutral-100'
                              }`}
                            >
                              {src.icon ? (
                                <span className="w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 overflow-hidden">
                                  {src.icon}
                                </span>
                              ) : faviconUrl ? (
                                <img
                                  src={faviconUrl}
                                  alt=""
                                  className="w-4 h-4 rounded-[3px] shrink-0 object-contain bg-white/90 p-[1px]"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : null}
                              <span className="truncate max-w-[210px]">{src.label}</span>
                            </ChipTag>

                            {/* Hover/Focus Domain Tooltip */}
                            {isHovered && domainTooltip && (
                              <div
                                role="tooltip"
                                className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono whitespace-nowrap z-30 pointer-events-none shadow-lg animate-in fade-in duration-100 ${
                                  isDark
                                    ? 'bg-[#1f1f24] border-white/15 text-neutral-300'
                                    : 'bg-neutral-900 border-black/15 text-white'
                                }`}
                              >
                                {domainTooltip}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {!isExpanded && hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSearchIndices((prev) => ({
                              ...prev,
                              [idx]: true,
                            }))
                          }
                          className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-[13px] font-normal leading-tight transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-[#17171b] border-white/[0.08] text-neutral-400 hover:text-neutral-200 hover:border-white/[0.16]'
                              : 'bg-[#f8f8fa] border-black/[0.08] text-neutral-500 hover:text-neutral-800 hover:border-black/[0.16]'
                          }`}
                        >
                          +{hiddenCount} more
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Thought step
            return (
              <div key={`step-thought-${idx}`} className="flex items-stretch gap-3">
                {/* Left Timeline Column */}
                <div className="w-5 flex flex-col items-center shrink-0">
                  <div className="h-5 flex items-center justify-center shrink-0">
                    {isCurrentlyActive ? (
                      <span className="w-2 h-2 rounded-[2px] bg-[#3b82f6] animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isDark ? 'bg-neutral-500' : 'bg-neutral-400'
                        }`}
                      />
                    )}
                  </div>
                  {showLineBelow && (
                    <div
                      className={`w-px flex-1 my-1 min-h-[10px] ${
                        isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'
                      }`}
                    />
                  )}
                </div>

                {/* Right Content Column */}
                <div className="flex-1 min-w-0 pb-3.5 flex items-center">
                  {isCurrentlyActive ? (
                    <ShimmerText
                      text={step.text}
                      isDark={isDark}
                      className="text-[14px] leading-5 font-normal"
                    />
                  ) : (
                    <span
                      className={`text-[14px] leading-5 ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      {step.text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Final Completed Node: "Finished thinking" */}
          {effectiveStatus === 'done' && (
            <div className="flex items-center gap-3 pt-0.5">
              <div className="w-5 flex items-center justify-center shrink-0">
                <span className="w-4 h-4 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.45)]">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              </div>
              <span
                className={`text-[14px] font-medium leading-5 ${
                  isDark ? 'text-neutral-100' : 'text-neutral-900'
                }`}
              >
                Finished thinking
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
