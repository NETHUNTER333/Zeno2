import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { createSpring, tuneSpring, stepSpring, clampVal } from '../../lib/springMotion';

/**
 * 1. DesignBookmark "Plan Switch" Stretchy Billing Toggle:
 * Two-edge spring highlight (--spring-lead: 620 36, --spring-trail: 190 19).
 * The leading edge moves fast while the trailing edge lags, stretching the pill physically.
 */
export const PlanSwitchBillingToggle: React.FC<{
  billingCycle: 'monthly' | 'annual';
  onChange: (next: 'monthly' | 'annual') => void;
  isDark?: boolean;
}> = ({ billingCycle, onChange, isDark = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLSpanElement>(null);
  const monthBtnRef = useRef<HTMLButtonElement>(null);
  const yearBtnRef = useRef<HTMLButtonElement>(null);
  const firstMountRef = useRef(true);

  const springsRef = useRef({
    L: createSpring(0, 620, 36),
    R: createSpring(0, 190, 19),
  });

  useEffect(() => {
    const activeEl = billingCycle === 'annual' ? yearBtnRef.current : monthBtnRef.current;
    if (!activeEl) return;

    const l = activeEl.offsetLeft;
    const r = l + activeEl.offsetWidth;
    const s = springsRef.current;

    if (firstMountRef.current) {
      firstMountRef.current = false;
      s.L.x = s.L.t = l;
      s.R.x = s.R.t = r;
      if (hlRef.current) {
        hlRef.current.style.transform = `translateX(${l.toFixed(2)}px)`;
        hlRef.current.style.width = `${Math.max(36, r - l).toFixed(2)}px`;
      }
      return;
    }

    const movingRight = billingCycle === 'annual';
    // Moving right -> right edge leads (620, 36), left edge trails (190, 19)
    tuneSpring(s.L, movingRight ? 190 : 620, movingRight ? 19 : 36);
    tuneSpring(s.R, movingRight ? 620 : 190, movingRight ? 36 : 19);
    s.L.t = l;
    s.R.t = r;
  }, [billingCycle]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const s = springsRef.current;
      const sub = 4;
      for (let i = 0; i < sub; i++) {
        stepSpring(s.L, dt / sub);
        stepSpring(s.R, dt / sub);
      }
      if (hlRef.current) {
        hlRef.current.style.transform = `translateX(${s.L.x.toFixed(2)}px)`;
        hlRef.current.style.width = `${Math.max(36, s.R.x - s.L.x).toFixed(2)}px`;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Billing Cycle"
      className={`relative inline-flex items-center p-1 rounded-full select-none ${
        isDark ? 'bg-white/[0.06]' : 'bg-black/[0.05]'
      }`}
    >
      <span
        ref={hlRef}
        aria-hidden="true"
        className={`absolute left-0 top-1 h-8 rounded-full will-change-[transform,width] ${
          isDark ? 'bg-white/[0.16]' : 'bg-white shadow-xs'
        }`}
      />
      <button
        ref={monthBtnRef}
        type="button"
        role="radio"
        aria-checked={billingCycle === 'monthly'}
        onClick={() => onChange('monthly')}
        className={`relative z-10 h-8 px-4 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer ${
          billingCycle === 'monthly'
            ? isDark
              ? 'text-white font-semibold'
              : 'text-[#17181a] font-semibold'
            : isDark
            ? 'text-neutral-400 hover:text-neutral-200'
            : 'text-neutral-500 hover:text-neutral-900'
        }`}
      >
        Monthly
      </button>
      <button
        ref={yearBtnRef}
        type="button"
        role="radio"
        aria-checked={billingCycle === 'annual'}
        onClick={() => onChange('annual')}
        className={`relative z-10 h-8 px-4 rounded-full text-xs font-medium transition-colors duration-200 cursor-pointer ${
          billingCycle === 'annual'
            ? isDark
              ? 'text-white font-semibold'
              : 'text-[#17181a] font-semibold'
            : isDark
            ? 'text-neutral-400 hover:text-neutral-200'
            : 'text-neutral-500 hover:text-neutral-900'
        }`}
      >
        Yearly
      </button>
    </div>
  );
};

/**
 * 2. DesignBookmark "Save 20%" Pop Chip:
 * Scales cleanly from its right edge (--spring-pop: 520 16) when Annual is active.
 */
export const PopSaveBadge: React.FC<{
  visible: boolean;
  label?: string;
}> = ({ visible, label = 'Save 20%' }) => {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const springRef = useRef(createSpring(visible ? 1 : 0, 520, 16));
  const firstRef = useRef(true);

  useEffect(() => {
    const s = springRef.current;
    if (firstRef.current) {
      firstRef.current = false;
      s.x = s.t = visible ? 1 : 0;
      return;
    }
    s.t = visible ? 1 : 0;
    if (visible) s.x = Math.min(s.x, 0.3);
  }, [visible]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const s = springRef.current;
      stepSpring(s, dt);
      if (badgeRef.current) {
        const sv = Math.max(0, s.x);
        badgeRef.current.style.transform = `scale(${sv.toFixed(4)})`;
        badgeRef.current.style.opacity = clampVal(sv * 1.4, 0, 1).toFixed(3);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <span
      ref={badgeRef}
      style={{ transformOrigin: '100% 50%' }}
      className="inline-flex items-center h-6 px-2.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold leading-none will-change-[transform,opacity]"
    >
      {label}
    </span>
  );
};

/**
 * 3. DesignBookmark Rolling Digit Price Drum:
 * Each numeric digit rolls smoothly on a vertical 0..9 drum when the price changes.
 */
export const RollingDigitPrice: React.FC<{
  prefix?: string;
  amount: number;
  suffix?: string;
  className?: string;
}> = ({ prefix = '$', amount, suffix = '/mo', className = '' }) => {
  const digitStr = String(Math.max(0, Math.round(amount)));
  const digits = digitStr.split('');
  const drumRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const springsRef = useRef<ReturnType<typeof createSpring>[]>([]);
  const prevLenRef = useRef(digits.length);

  if (springsRef.current.length !== digits.length || prevLenRef.current !== digits.length) {
    prevLenRef.current = digits.length;
    springsRef.current = digits.map((d, i) => createSpring(Number(d) || 0, 260, 22 + i * 2));
  }

  useEffect(() => {
    digits.forEach((d, i) => {
      const target = Number(d) || 0;
      const s = springsRef.current[i];
      if (!s) return;
      const timer = setTimeout(() => {
        s.t = target;
      }, i * 45);
      return () => clearTimeout(timer);
    });
  }, [digitStr]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const rowHeight = 40;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      springsRef.current.forEach((s, i) => {
        stepSpring(s, dt);
        const el = drumRefs.current[i];
        if (el) {
          el.style.transform = `translateY(${(-s.x * rowHeight).toFixed(2)}px)`;
        }
      });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [digits.length]);

  return (
    <div className={`inline-flex items-start font-bold tracking-tight ${className}`}>
      {prefix && <span className="text-lg leading-7 mr-0.5">{prefix}</span>}
      <span
        className="inline-flex h-[40px] text-[34px] leading-[40px] tabular-nums"
        style={{
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 14%, #000 86%, transparent 100%)',
          maskImage: 'linear-gradient(180deg, transparent 0, #000 14%, #000 86%, transparent 100%)',
        }}
      >
        {digits.map((_, i) => (
          <span key={i} className="inline-block h-[40px] w-[0.62em] overflow-hidden">
            <span
              ref={(el) => {
                drumRefs.current[i] = el;
              }}
              className="block will-change-transform"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <i key={n} className="block h-[40px] leading-[40px] not-italic text-center">
                  {n}
                </i>
              ))}
            </span>
          </span>
        ))}
      </span>
      {suffix && (
        <span className="self-end mb-1.5 ml-1 text-xs font-medium opacity-60">{suffix}</span>
      )}
    </div>
  );
};

/**
 * 4. DesignBookmark Rolling Billing Line:
 * Rolls vertically between Monthly vs Yearly billing description.
 */
export const RollingBillingLine: React.FC<{
  text: string;
  isDark?: boolean;
}> = ({ text, isDark = true }) => {
  const [displayed, setDisplayed] = useState(text);
  const [prevText, setPrevText] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (text === displayed) return;
    setPrevText(displayed);
    setDisplayed(text);
    setAnimating(true);
    const t = setTimeout(() => {
      setPrevText(null);
      setAnimating(false);
    }, 320);
    return () => clearTimeout(t);
  }, [text, displayed]);

  return (
    <div
      className={`relative h-5 overflow-hidden text-xs ${
        isDark ? 'text-zinc-400' : 'text-zinc-500'
      }`}
    >
      {prevText && (
        <span
          className="absolute left-0 top-0 leading-5 whitespace-nowrap transition-all duration-300 ease-out"
          style={{
            transform: animating ? 'translateY(-18px)' : 'translateY(0px)',
            opacity: animating ? 0 : 1,
          }}
        >
          {prevText}
        </span>
      )}
      <span
        key={displayed}
        className="block leading-5 whitespace-nowrap transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2"
      >
        {displayed}
      </span>
    </div>
  );
};

/**
 * 5. DesignBookmark Spring Extra Feature Row ("Two months free"):
 * Smoothly grows open on spring (260, 24) with its green checkmark popping a beat later.
 */
export const ExtraFeatureRow: React.FC<{
  visible: boolean;
  label?: string;
  isDark?: boolean;
}> = ({ visible, label = 'Two months free', isDark = true }) => {
  const rowRef = useRef<HTMLLIElement>(null);
  const ckRef = useRef<HTMLSpanElement>(null);
  const exSpring = useRef(createSpring(visible ? 1 : 0, 260, 24));
  const ekSpring = useRef(createSpring(visible ? 1 : 0, 520, 16));
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      exSpring.current.x = exSpring.current.t = visible ? 1 : 0;
      ekSpring.current.x = ekSpring.current.t = visible ? 1 : 0;
      return;
    }
    exSpring.current.t = visible ? 1 : 0;
    if (visible) {
      ekSpring.current.x = 0.3;
      ekSpring.current.t = 0;
      const t = setTimeout(() => {
        ekSpring.current.t = 1;
      }, 150);
      return () => clearTimeout(t);
    } else {
      ekSpring.current.t = 0;
    }
  }, [visible]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      stepSpring(exSpring.current, dt);
      stepSpring(ekSpring.current, dt);
      if (rowRef.current) {
        const ex = clampVal(exSpring.current.x, 0, 1.08);
        rowRef.current.style.height = `${(28 * ex).toFixed(2)}px`;
        rowRef.current.style.opacity = clampVal(exSpring.current.x * 1.6 - 0.35, 0, 1).toFixed(3);
      }
      if (ckRef.current) {
        ckRef.current.style.transform = `scale(${Math.max(0, ekSpring.current.x).toFixed(4)})`;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <li
      ref={rowRef}
      className="flex items-center gap-2 overflow-hidden will-change-[height,opacity]"
      style={{ height: visible ? '28px' : '0px', opacity: visible ? 1 : 0 }}
    >
      <span
        ref={ckRef}
        className="w-4 h-4 rounded-full bg-emerald-500 text-[#04140a] grid place-items-center shrink-0 will-change-transform"
      >
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </span>
      <span className={`font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
        {label}
      </span>
    </li>
  );
};

/**
 * 6. DesignBookmark Morph Upgrade CTA Button:
 * Pill closes smoothly into a circular spinner while busy, and opens green with a checkmark when done/active.
 */
export const MorphUpgradeButton: React.FC<{
  state: 'idle' | 'busy' | 'done';
  idleLabel: string;
  doneLabel: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'spark' | 'fire';
  isDark?: boolean;
}> = ({
  state,
  idleLabel,
  doneLabel,
  onClick,
  disabled = false,
  variant = 'spark',
  isDark = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const widthSpring = useRef(createSpring(state === 'busy' ? 0 : 1, 260, 24));
  const popSpring = useRef(createSpring(1, 520, 16));

  useEffect(() => {
    widthSpring.current.t = state === 'busy' ? 0 : 1;
    if (state === 'done') {
      popSpring.current.x = 0.92;
      popSpring.current.t = 1;
    } else if (state === 'busy') {
      popSpring.current.x = 0.94;
      popSpring.current.t = 1;
    }
  }, [state]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      stepSpring(widthSpring.current, dt);
      stepSpring(popSpring.current, dt);

      if (btnRef.current && containerRef.current) {
        const full = containerRef.current.clientWidth || 240;
        const w = 42 + (full - 42) * clampVal(widthSpring.current.x, 0, 1.02);
        btnRef.current.style.width = `${w.toFixed(2)}px`;
        btnRef.current.style.transform = `scale(${popSpring.current.x.toFixed(4)})`;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const colorClass =
    state === 'done'
      ? 'bg-emerald-500 text-[#04140a] cursor-default'
      : variant === 'fire'
      ? 'bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer'
      : isDark
      ? 'bg-white hover:bg-zinc-200 text-black cursor-pointer'
      : 'bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer';

  return (
    <div ref={containerRef} className="w-full flex justify-center mb-5">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || state === 'busy' || state === 'done'}
        onClick={onClick}
        className={`relative h-[42px] rounded-full border-0 text-xs font-semibold flex items-center justify-center gap-2 overflow-hidden transition-colors duration-300 will-change-[width,transform] ${colorClass}`}
      >
        {state === 'busy' ? (
          <span
            className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-label="Upgrading..."
          />
        ) : state === 'done' ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3">
            <Check className="w-3.5 h-3.5 stroke-[2.8]" />
            <span>{doneLabel}</span>
          </span>
        ) : (
          <span className="whitespace-nowrap px-3">{idleLabel}</span>
        )}
      </button>
    </div>
  );
};
