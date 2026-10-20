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
      <span className="inline-flex text-[10px] font-mono text-muted-foreground align-super px-0.5">
        [{index}]
      </span>
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
    <span ref={containerRef} className="relative inline-block align-super mx-0.5 select-none">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center justify-center h-4.5 min-w-[18px] px-1.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer border align-super hover:scale-105 shadow-2xs ${
          isDark
            ? 'bg-[#1e1e24] border-white/20 text-neutral-100 hover:text-white hover:border-white/40'
            : 'bg-neutral-100 border-neutral-300 text-neutral-950 hover:bg-neutral-200 hover:border-neutral-400'
        }`}
        title={`Citation [${index}]: ${source.title}`}
        aria-label={`Citation ${index}: ${source.title}`}
      >
        {index}
      </button>

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
