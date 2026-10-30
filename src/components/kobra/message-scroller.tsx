import React, { useState, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';

interface MessageScrollerProps {
  viewportRef: React.RefObject<HTMLElement | null>;
  onScrollToBottom: () => void;
  newMessagesCount?: number;
  isDark?: boolean;
}

export const MessageScroller: React.FC<MessageScrollerProps> = ({
  viewportRef,
  onScrollToBottom,
  newMessagesCount = 0,
  isDark = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      setIsVisible(distanceFromBottom > 160);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [viewportRef]);

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-20 right-6 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
      <button
        type="button"
        onClick={onScrollToBottom}
        className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full border backdrop-blur-2xl backdrop-saturate-150 text-xs font-medium transition-all active:scale-95 cursor-pointer ${
          isDark
            ? 'bg-neutral-900/55 hover:bg-neutral-800/70 border-white/[0.16] text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
            : 'bg-white/65 hover:bg-white/85 border-black/[0.1] text-black shadow-[0_8px_32px_rgba(0,0,0,0.12)]'
        }`}
        title="Scroll to latest messages"
        aria-label="Scroll to bottom"
      >
        <ArrowDown className="w-3.5 h-3.5 stroke-[2]" />
        {newMessagesCount > 0 ? (
          <span className="flex items-center gap-1">
            <span>New messages</span>
            <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[10px] font-bold">
              {newMessagesCount}
            </span>
          </span>
        ) : (
          <span className="text-[11px]">Latest</span>
        )}
      </button>
    </div>
  );
};
