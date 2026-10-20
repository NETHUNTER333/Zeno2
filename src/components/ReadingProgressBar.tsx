import React, { useState, useEffect } from 'react';

interface ReadingProgressBarProps {
  viewportRef: React.RefObject<HTMLElement | null>;
  isDark?: boolean;
}

export const ReadingProgressBar: React.FC<ReadingProgressBarProps> = ({ viewportRef, isDark = true }) => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const totalScrollable = scrollHeight - clientHeight;
      if (totalScrollable <= 0) {
        setScrollProgress(0);
        return;
      }
      const progress = (scrollTop / totalScrollable) * 100;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [viewportRef]);

  return (
    <div className="absolute top-0 left-0 right-0 h-[3px] z-40 pointer-events-none overflow-hidden">
      <div
        className="h-full bg-[#007aff] transition-all duration-75 ease-out shadow-[0_0_8px_rgba(0,122,255,0.6)]"
        style={{ width: `${scrollProgress}%` }}
      />
    </div>
  );
};
