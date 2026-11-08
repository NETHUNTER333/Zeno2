import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  isDark?: boolean;
  onRefresh?: () => Promise<void> | void;
}

const PULL_THRESHOLD = 68;
const MAX_PULL = 128;

function isInteractiveInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
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
  const winScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  return winScroll > 4;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ isDark = true, onRefresh }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const activePullRef = useRef<boolean>(false);
  const pullDistanceRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);

  useEffect(() => {
    const triggerReload = async () => {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      pullDistanceRef.current = PULL_THRESHOLD;
      setPullDistance(PULL_THRESHOLD);

      try {
        if (onRefresh) {
          await onRefresh();
        }
      } catch {}

      setTimeout(() => {
        window.location.reload();
      }, 260);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || e.touches.length !== 1) return;
      if (isInteractiveInput(e.target)) return;
      if (isScrollableAncestorScrolled(e.target)) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      activePullRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshingRef.current || startYRef.current === null || e.touches.length !== 1) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - startYRef.current;
      const deltaX = currentX - (startXRef.current ?? currentX);

      if (!activePullRef.current) {
        if (deltaY < 8) return;
        if (Math.abs(deltaX) > Math.abs(deltaY) * 0.85) {
          startYRef.current = null;
          return;
        }
        if (isScrollableAncestorScrolled(e.target)) {
          startYRef.current = null;
          return;
        }
        activePullRef.current = true;
      }

      if (deltaY > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const damped = Math.min(MAX_PULL, Math.pow(deltaY, 0.85) * 0.85);
        pullDistanceRef.current = damped;
        setPullDistance(damped);
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

      if (dist >= PULL_THRESHOLD) {
        triggerReload();
      } else if (dist > 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    // Optional mouse drag from top area for desktop / preview testing
    const handleMouseDown = (e: MouseEvent) => {
      if (isRefreshingRef.current || e.button !== 0) return;
      if (e.clientY > 100) return;
      if (isInteractiveInput(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest('button, a, select, input, textarea, [role="button"]')) {
        return;
      }
      if (isScrollableAncestorScrolled(e.target)) return;
      startYRef.current = e.clientY;
      startXRef.current = e.clientX;
      activePullRef.current = false;
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
      }

      if (deltaY > 0) {
        const damped = Math.min(MAX_PULL, Math.pow(deltaY, 0.85) * 0.85);
        pullDistanceRef.current = damped;
        setPullDistance(damped);
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
  const isVisible = pullDistance > 6 || isRefreshing;
  const translateY = isRefreshing ? 6 : Math.min(18, Math.max(0, pullDistance - 28));

  if (!isVisible) return null;

  return (
    <div
      data-testid="pull-to-refresh-indicator"
      style={{
        transform: `translate3d(-50%, ${translateY}px, 0)`,
        opacity: Math.min(1, Math.max(0, (pullDistance - 10) / (PULL_THRESHOLD - 10))),
      }}
      className={`fixed top-1 left-1/2 z-[150] pointer-events-none flex items-center justify-center w-6 h-6 rounded-full border transition-all duration-75 select-none ${
        isDark
          ? 'bg-neutral-900/80 border-white/10 text-white backdrop-blur-md'
          : 'bg-white/90 border-black/10 text-zinc-900 backdrop-blur-md'
      }`}
    >
      <RefreshCw
        style={{
          transform: isRefreshing ? undefined : `rotate(${Math.round(progress * 360)}deg)`,
        }}
        className={`w-3 h-3 shrink-0 transition-transform ${
          ready ? 'text-[#FC4C01]' : isDark ? 'text-zinc-400' : 'text-zinc-500'
        } ${isRefreshing ? 'animate-spin text-[#FC4C01]' : ''}`}
      />
    </div>
  );
};
