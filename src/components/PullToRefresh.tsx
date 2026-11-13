import React, { useEffect, useRef, useState } from 'react';

interface PullToRefreshProps {
  isDark?: boolean;
  onRefresh?: () => Promise<void> | void;
}

const PULL_THRESHOLD = 76;
const MAX_PULL = 136;
const RING_RADIUS = 13;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function isInteractiveOrIgnoredTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'canvas' || tag === 'video') {
    return true;
  }
  if (el.isContentEditable) return true;
  if (el.closest('[data-no-pull-refresh]')) return true;
  return false;
}

function isScrollableAncestorScrolled(target: EventTarget | null): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScrollY =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 2;
    if (canScrollY && node.scrollTop > 4) {
      return true;
    }
    node = node.parentElement;
  }
  const winScroll =
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  return winScroll > 4;
}

function applyRubberBand(deltaY: number): number {
  if (deltaY <= 0) return 0;
  return Math.min(MAX_PULL, MAX_PULL * (1 - Math.exp(-deltaY / 190)));
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ isDark = true, onRefresh }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const activePullRef = useRef<boolean>(false);
  const pullDistanceRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);
  const hapticFiredRef = useRef<boolean>(false);

  useEffect(() => {
    const triggerReload = async () => {
      isRefreshingRef.current = true;
      setIsDragging(false);
      setIsRefreshing(true);
      pullDistanceRef.current = PULL_THRESHOLD;
      setPullDistance(PULL_THRESHOLD);

      try {
        if (onRefresh) {
          await onRefresh();
        }
      } catch {
        // Proceed to refresh cleanly even if pre-refresh hook fails
      }

      window.setTimeout(() => {
        window.location.reload();
      }, 320);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || e.touches.length !== 1) return;
      if (isInteractiveOrIgnoredTarget(e.target)) return;
      if (isScrollableAncestorScrolled(e.target)) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      activePullRef.current = false;
      hapticFiredRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshingRef.current || startYRef.current === null || e.touches.length !== 1) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - startYRef.current;
      const deltaX = currentX - (startXRef.current ?? currentX);

      if (!activePullRef.current) {
        if (deltaY < 10) return;
        if (Math.abs(deltaX) > Math.abs(deltaY) * 0.85) {
          startYRef.current = null;
          return;
        }
        if (isScrollableAncestorScrolled(e.target)) {
          startYRef.current = null;
          return;
        }
        activePullRef.current = true;
        setIsDragging(true);
      }

      if (deltaY > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const damped = applyRubberBand(deltaY);
        pullDistanceRef.current = damped;
        setPullDistance(damped);

        if (damped >= PULL_THRESHOLD && !hapticFiredRef.current) {
          hapticFiredRef.current = true;
          try {
            navigator.vibrate?.(10);
          } catch {}
        } else if (damped < PULL_THRESHOLD * 0.9) {
          hapticFiredRef.current = false;
        }
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (isRefreshingRef.current) return;
      const dist = pullDistanceRef.current;
      startYRef.current = null;
      startXRef.current = null;
      activePullRef.current = false;
      hapticFiredRef.current = false;
      setIsDragging(false);

      if (dist >= PULL_THRESHOLD) {
        triggerReload();
      } else if (dist > 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    // Mouse drag from top bar area for desktop / preview testing
    const handleMouseDown = (e: MouseEvent) => {
      if (isRefreshingRef.current || e.button !== 0) return;
      if (e.clientY > 100) return;
      if (isInteractiveOrIgnoredTarget(e.target)) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('button, a, select, input, textarea, [role="button"]')
      ) {
        return;
      }
      if (isScrollableAncestorScrolled(e.target)) return;
      startYRef.current = e.clientY;
      startXRef.current = e.clientX;
      activePullRef.current = false;
      hapticFiredRef.current = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isRefreshingRef.current || startYRef.current === null) return;
      const deltaY = e.clientY - startYRef.current;
      const deltaX = e.clientX - (startXRef.current ?? e.clientX);

      if (!activePullRef.current) {
        if (deltaY < 10) return;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          startYRef.current = null;
          return;
        }
        activePullRef.current = true;
        setIsDragging(true);
      }

      if (deltaY > 0) {
        const damped = applyRubberBand(deltaY);
        pullDistanceRef.current = damped;
        setPullDistance(damped);
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const handleMouseUp = () => {
      if (startYRef.current !== null) {
        handleTouchEnd();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onRefresh]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const ready = pullDistance >= PULL_THRESHOLD || isRefreshing;
  const isVisible = pullDistance > 4 || isRefreshing;

  const translateY = isRefreshing ? 14 : Math.max(-24, pullDistance * 0.56 - 24);
  const opacity = isRefreshing ? 1 : Math.min(1, Math.max(0, (pullDistance - 8) / 30));
  const scale = isRefreshing ? 1 : 0.78 + progress * 0.22;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - (isRefreshing ? 0.72 : progress * 0.92));

  return (
    <div
      data-testid="pull-to-refresh-indicator"
      role="status"
      aria-live="polite"
      aria-hidden={!isVisible}
      aria-label={isRefreshing ? 'Refreshing page' : ready ? 'Release to refresh' : 'Pull to refresh'}
      style={{
        transform: `translate3d(-50%, ${translateY}px, 0) scale(${scale})`,
        opacity: isVisible ? opacity : 0,
        transition: isDragging
          ? 'none'
          : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease',
      }}
      className={`fixed top-[calc(env(safe-area-inset-top,0px)+10px)] left-1/2 z-[150] pointer-events-none select-none flex items-center justify-center w-10 h-10 rounded-full border backdrop-blur-xl motion-reduce:transition-none ${
        isDark
          ? 'bg-zinc-900/90 border-white/15 text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)]'
          : 'bg-white/95 border-zinc-200/90 text-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.10)]'
      }`}
    >
      <div className="relative flex items-center justify-center w-8 h-8">
        {/* Radial progress track & arc */}
        <svg
          viewBox="0 0 32 32"
          className={`w-8 h-8 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${-90 + progress * 120}deg)`,
            transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <circle
            cx="16"
            cy="16"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeOpacity={isDark ? 0.14 : 0.1}
            strokeWidth="2"
          />
          <circle
            cx="16"
            cy="16"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            className={ready ? 'opacity-100' : 'opacity-70'}
          />
        </svg>

        {/* Center arrow morphs cleanly as threshold is reached; hides during spin */}
        {!isRefreshing && (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="absolute w-3.5 h-3.5"
            style={{
              transform: `rotate(${ready ? 180 : 0}deg)`,
              transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <path
              d="M8 3.25v9.5M4.5 9.25L8 12.75l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={ready ? 'opacity-100' : 'opacity-65'}
            />
          </svg>
        )}
      </div>
    </div>
  );
};
