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
        className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full border shadow-lg backdrop-blur-xl text-xs font-medium transition-all active:scale-95 cursor-pointer ${
          isDark
            ? 'bg-[#181818]/90 hover:bg-[#222222] border-[#333333] text-white shadow-black/60'
            : 'bg-white/95 hover:bg-[#f7f7f7] border-[#d8d8d8] text-black shadow-black/10'
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
