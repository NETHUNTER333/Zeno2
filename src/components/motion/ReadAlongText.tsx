import React, { useEffect, useMemo, useRef } from 'react';
import { createSpring, tuneSpring, stepSpring, clampVal } from '../../lib/springMotion';

export interface ReadAlongTextProps {
  text: string;
  activeWordIndex: number; // -1 when idle/not yet started
  isPlaying: boolean;
  onWordClick?: (wordIndex: number) => void;
  isDark?: boolean;
  className?: string;
}

/**
 * DesignBookmark "Read Along" motion component:
 * A pill slides from word to word behind the exact text/segment being read aloud.
 * Leading edge is stiff (520, 40) and trailing edge is soft (210, 26),
 * so it stretches physically as it moves and settles to the word's exact width.
 * At a line break, it closes cleanly and opens on the next line without sliding across text.
 */
export const ReadAlongText: React.FC<ReadAlongTextProps> = ({
  text,
  activeWordIndex,
  isPlaying,
  onWordClick,
  isDark = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLParagraphElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const words = useMemo(() => {
    return String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }, [text]);

  const springsRef = useRef({
    L: createSpring(0, 520, 40),
    R: createSpring(0, 520, 40),
    Y: createSpring(0, 600, 48),
    O: createSpring(0, 300, 30),
    lineTop: null as number | null,
  });

  // Update spring targets whenever activeWordIndex changes
  useEffect(() => {
    const s = springsRef.current;
    const container = containerRef.current;
    if (!container || activeWordIndex < 0 || activeWordIndex >= words.length) {
      s.O.t = 0;
      if (activeWordIndex < 0) {
        s.lineTop = null;
      }
      return;
    }

    const el = wordRefs.current[activeWordIndex];
    if (!el) return;

    const fontSize = parseFloat(getComputedStyle(container).fontSize) || 15;
    const pad = fontSize * 0.2;
    const pillHeight = fontSize * 1.38;

    const left = el.offsetLeft - pad;
    const right = el.offsetLeft + el.offsetWidth + pad;
    const top = el.offsetTop + (el.offsetHeight - pillHeight) / 2;

    s.O.t = 1;
    const forward = left >= s.L.t;
    if (s.lineTop === null || Math.abs(top - s.lineTop) > 4 || s.O.x < 0.05) {
      // New line (or first word): open up from the word's left edge, no diagonal slide
      s.L.x = s.L.t = left;
      s.R.x = left;
      s.Y.x = s.Y.t = top;
    }
    s.lineTop = top;
    tuneSpring(forward ? s.R : s.L, 520, 40);
    tuneSpring(forward ? s.L : s.R, 210, 26);
    s.L.t = left;
    s.R.t = right;
    s.Y.t = top;

    // Keep the active word smoothly scrolled inside the scrollable segment box
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch {}
  }, [activeWordIndex, words]);

  // Physics rAF loop for stretchy pill
  useEffect(() => {
    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const s = springsRef.current;
      const sub = 4;
      for (let k = 0; k < sub; k++) {
        stepSpring(s.L, dt / sub);
        stepSpring(s.R, dt / sub);
        stepSpring(s.Y, dt / sub);
        stepSpring(s.O, dt / sub);
      }

      if (pillRef.current) {
        const w = Math.max(0, s.R.x - s.L.x);
        const op = clampVal(s.O.x, 0, 1);
        pillRef.current.style.transform = `translate3d(${s.L.x.toFixed(2)}px, ${s.Y.x.toFixed(2)}px, 0)`;
        pillRef.current.style.width = `${w.toFixed(2)}px`;
        pillRef.current.style.opacity = op.toFixed(3);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  wordRefs.current = [];

  return (
    <p
      ref={containerRef}
      className={`relative select-none font-medium tracking-[-0.015em] leading-[1.6] ${className}`}
      style={{
        fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
      aria-label={text}
    >
      <span
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 rounded-[0.34em] will-change-[transform,width,opacity]"
        style={{
          height: '1.38em',
          backgroundColor: isDark ? '#ffffff' : '#0e0f11',
          opacity: 0,
        }}
      />
      {words.map((word, idx) => {
        const isPast = activeWordIndex >= 0 && idx < activeWordIndex;
        const isNow = activeWordIndex === idx;
        return (
          <React.Fragment key={`${idx}-${word}`}>
            <span
              ref={(el) => {
                wordRefs.current[idx] = el;
              }}
              onClick={() => onWordClick?.(idx)}
              title="Click to read aloud from this word"
              className="relative z-10 inline-block cursor-pointer transition-colors duration-150"
              style={{
                color: isNow
                  ? isDark
                    ? '#000000'
                    : '#f4f3f1'
                  : isPast
                  ? isDark
                    ? '#ffffff'
                    : '#17181a'
                  : isDark
                  ? isPlaying
                    ? 'rgba(255,255,255,0.42)'
                    : 'rgba(255,255,255,0.65)'
                  : isPlaying
                  ? 'rgba(23,24,26,0.38)'
                  : 'rgba(23,24,26,0.6)',
              }}
            >
              {word}
            </span>
            {idx < words.length - 1 ? ' ' : ''}
          </React.Fragment>
        );
      })}
    </p>
  );
};
