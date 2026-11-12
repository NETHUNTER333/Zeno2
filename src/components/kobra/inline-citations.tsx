import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SearchSource } from '../../types';
import { CompactCitationCard, WebSearchSource } from '../ui/web-search';

interface InlineCitationProps {
  index: number;
  source?: SearchSource;
  isDark?: boolean;
  messageId?: string;
}

export const InlineCitation: React.FC<InlineCitationProps> = ({
  index,
  source,
  isDark = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const instanceId = useMemo(() => `inline-cit-${Math.random().toString(36).slice(2, 9)}`, []);
  const [coords, setCoords] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
  } | null>(null);

  const updatePosition = () => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(300, vw - 24);
    const idealLeft = rect.left + rect.width / 2 - width / 2;
    const clampedLeft = Math.max(12, Math.min(idealLeft, vw - width - 12));
    const placeBelow = rect.top < 190;
    setCoords({
      left: Math.round(clampedLeft),
      top: placeBelow ? Math.round(rect.bottom + 8) : undefined,
      bottom: !placeBelow ? Math.round(vh - rect.top + 8) : undefined,
      width: Math.round(width),
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.dispatchEvent(new CustomEvent('kinich-citation-open', { detail: instanceId }));

    const handleOtherOpen = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail && custom.detail !== instanceId) {
        setIsOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !containerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => setIsOpen(false);

    window.addEventListener('kinich-citation-open', handleOtherOpen);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('kinich-citation-open', handleOtherOpen);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, instanceId]);

  if (!source) {
    return (
      <button
        type="button"
        aria-label={`Source ${index}`}
        className="inline-flex whitespace-nowrap items-center justify-center h-4.5 min-w-[18px] px-1.5 rounded-full text-[10px] font-mono font-bold align-super mx-0.5 cursor-default transition-colors bg-black/[0.06] text-[#71717a] dark:bg-white/[0.08] dark:text-white/75"
      >
        [{index}]
      </button>
    );
  }

  const webSource: WebSearchSource = {
    position: index,
    title: source.title,
    url: source.url,
    snippet: source.snippet,
    domain: source.domain,
    date: source.date,
    socialMeta: source.socialMeta,
  };

  return (
    <span
      ref={containerRef}
      onMouseEnter={() => {
        updatePosition();
        setIsOpen(true);
      }}
      onMouseLeave={() => setIsOpen(false)}
      className="relative inline-block whitespace-nowrap align-super mx-0.5 select-none"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isOpen) updatePosition();
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex whitespace-nowrap items-center justify-center h-4.5 min-w-[18px] px-1.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer border align-super !no-underline ${
          isDark
            ? 'bg-[#1e1e24] border-white/15 text-neutral-200 hover:bg-white/15 hover:text-white'
            : 'bg-neutral-100 border-neutral-300 text-neutral-800 hover:bg-neutral-200 hover:text-black'
        }`}
        title={source?.title ? `Source ${index}: ${source.title}` : `Source ${index}`}
        aria-label={source?.title ? `Source ${index}: ${source.title}` : `Source ${index}`}
      >
        {index}
      </button>

      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              left: coords.left,
              top: coords.top,
              bottom: coords.bottom,
              width: coords.width,
            }}
            className="z-[9999]"
          >
            <CompactCitationCard
              source={webSource}
              onClose={() => setIsOpen(false)}
              isDark={isDark}
            />
          </div>,
          document.body
        )}
    </span>
  );
};

export const InlineCitationsList: React.FC<{
  sources: SearchSource[];
  isDark?: boolean;
}> = ({ sources, isDark = true }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 my-2">
      <span className={`text-[11px] font-semibold ${isDark ? 'text-white/60' : 'text-neutral-900'}`}>
        Sources:
      </span>
      {sources.slice(0, 6).map((src, idx) => (
        <InlineCitation key={idx} index={idx + 1} source={src} isDark={isDark} />
      ))}
    </div>
  );
};
