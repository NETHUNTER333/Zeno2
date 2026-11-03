import React, { useState, useRef, useEffect } from 'react';
import { SearchSource } from '../../types';
import { CompactCitationCard, WebSearchSource } from '../ui/web-search';

interface InlineCitationProps {
  index: number;
  source?: SearchSource;
  isDark?: boolean;
}

export const InlineCitation: React.FC<InlineCitationProps> = ({
  index,
  source,
  isDark = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!source) {
    return (
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent('zeno-highlight-source', {
              detail: { index, active: true, scroll: true },
            })
          );
          const cardEl = document.getElementById(`source-card-${index}`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }}
        onMouseEnter={() => {
          window.dispatchEvent(
            new CustomEvent('zeno-highlight-source', {
              detail: { index, active: true },
            })
          );
        }}
        onMouseLeave={() => {
          window.dispatchEvent(
            new CustomEvent('zeno-highlight-source', {
              detail: { index, active: false },
            })
          );
        }}
        aria-label={`Source ${index}`}
        className="inline-flex whitespace-nowrap items-center justify-center h-4.5 min-w-[18px] px-1.5 rounded-full text-[10px] font-mono font-bold align-super mx-0.5 cursor-pointer transition-colors bg-[#FC4C01]/10 text-[#FC4C01] border border-[#FC4C01]/30 hover:bg-[#FC4C01] hover:text-white"
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
        setIsOpen(true);
        window.dispatchEvent(
          new CustomEvent('zeno-highlight-source', {
            detail: { url: source.url, index, active: true },
          })
        );
      }}
      onMouseLeave={() => {
        setIsOpen(false);
        window.dispatchEvent(
          new CustomEvent('zeno-highlight-source', {
            detail: { url: source.url, index, active: false },
          })
        );
      }}
      className="relative inline-block whitespace-nowrap align-super mx-0.5 select-none"
    >
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent('zeno-highlight-source', {
              detail: { url: source.url, index, active: true, scroll: true },
            })
          );
        }}
        className={`inline-flex whitespace-nowrap items-center justify-center h-4.5 min-w-[18px] px-1.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer border align-super hover:scale-105 !no-underline shadow-2xs ${
          isDark
            ? 'bg-[#1e1e24] border-white/20 text-neutral-100 hover:bg-[#FC4C01]/20 hover:text-[#FC4C01] hover:border-[#FC4C01]/50'
            : 'bg-neutral-100 border-neutral-300 text-neutral-950 hover:bg-[#FC4C01]/15 hover:text-[#FC4C01] hover:border-[#FC4C01]/50'
        }`}
        title={`Source ${index}: ${source.title}`}
        aria-label={`Source ${index}: ${source.title}`}
      >
        {index}
      </a>

      {/* Small floating popover card anchored directly to the citation badge */}
      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
          <CompactCitationCard
            source={webSource}
            onClose={() => setIsOpen(false)}
            isDark={isDark}
          />
        </div>
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
