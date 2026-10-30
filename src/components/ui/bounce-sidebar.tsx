"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { motion, useAnimate } from "motion/react";
import { arc } from "motion";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type BounceSidebarItem =
  | string
  | {
      id?: string;
      label: string;
      href?: string;
      sublabel?: string;
      icon?: ReactNode;
      trailing?: ReactNode;
      onClick?: () => void;
    }
  | {
      id?: string;
      label: string;
      heading: true;
      trailing?: ReactNode;
      onClick?: () => void;
    };

export type BounceSidebarProps = Omit<ComponentProps<"ul">, "onChange"> & {
  items: BounceSidebarItem[];
  value?: number;
  defaultValue?: number;
  onChange?: (index: number) => void;
  dotColor?: string;
};

export function BounceSidebar({
  items,
  value,
  defaultValue = 0,
  onChange,
  dotColor = "#FC4C01",
  className,
  ...props
}: BounceSidebarProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeIndex = value ?? internalValue;
  const [dot, animate] = useAnimate<HTMLSpanElement>();
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const prevY = useRef<number | null>(null);
  const [dotSize, setDotSize] = useState(6);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    setDotSize(Math.round(6 * dpr) / dpr);
  }, []);

  useIsomorphicLayoutEffect(() => {
    let cancelled = false;
    const snap = () => {
      const el = itemRefs.current[activeIndex];
      if (cancelled || !el || !dot.current) return;
      const dpr = window.devicePixelRatio || 1;
      const size = Math.round(6 * dpr) / dpr;
      const toY =
        Math.round((el.offsetTop + el.offsetHeight / 2 - size / 2) * dpr) / dpr;
      animate(dot.current, { x: 0, y: toY }, { duration: 0 });
      prevY.current = toY;
      setReady((prev) => (prev ? prev : true));
    };
    snap();
    const raf = requestAnimationFrame(snap);
    document.fonts?.ready.then(snap);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [items.length]);

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (!el || !dot.current) return;
    const dpr = window.devicePixelRatio || 1;
    const toY =
      Math.round((el.offsetTop + el.offsetHeight / 2 - dotSize / 2) * dpr) /
      dpr;
    if (prevY.current === null) {
      animate(dot.current, { x: 0, y: toY }, { duration: 0 });
      prevY.current = toY;
      setReady((prev) => (prev ? prev : true));
      return;
    }
    const fromY = prevY.current;
    const delta = toY - fromY;
    prevY.current = toY;
    if (delta === 0) return;
    const distance = Math.abs(delta);
    const path = arc({
      strength: Math.min(0.8, 14 / distance),
      direction: delta > 0 ? "ccw" : "cw",
    });
    animate(
      dot.current,
      { x: 0, y: toY },
      { duration: 0.25, ease: "easeOut", path },
    );
  }, [activeIndex, dotSize, items.length]);

  const select = (index: number, item: BounceSidebarItem) => {
    if (value === undefined) setInternalValue(index);
    onChange?.(index);
    if (typeof item !== "string" && !("heading" in item) && item.onClick) {
      item.onClick();
    }
  };

  return (
    <ul
      data-slot="bounce-sidebar"
      className={cn("relative flex flex-col gap-1 pl-6 list-none", className)}
      {...props}
    >
      <span
        ref={dot}
        aria-hidden
        className="pointer-events-none absolute left-2 top-0 rounded-full transition-opacity duration-150"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: dotColor,
          opacity: ready && activeIndex >= 0 && itemRefs.current[activeIndex] ? 1 : 0,
        }}
      />
      {items.map((item, index) => {
        const label = typeof item === "string" ? item : item.label;
        const key = (typeof item !== "string" && item.id) || `${index}-${label}`;

        if (typeof item !== "string" && "heading" in item) {
          return (
            <li
              key={key}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              role={item.onClick ? "button" : "presentation"}
              tabIndex={item.onClick ? 0 : undefined}
              onClick={item.onClick}
              onKeyDown={
                item.onClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        item.onClick?.();
                      }
                    }
                  : undefined
              }
              data-slot="bounce-sidebar-heading"
              style={{ color: dotColor }}
              className={cn(
                "flex items-center justify-between px-1.5 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] first:pt-1 rounded-lg transition-colors",
                item.onClick && "cursor-pointer hover:bg-foreground/[0.05] py-1.5 first:pt-1.5 select-none"
              )}
            >
              <span>{label}</span>
              {item.trailing}
            </li>
          );
        }

        const href = typeof item === "string" ? undefined : item.href;
        const sublabel = typeof item === "string" ? undefined : item.sublabel;
        const icon = typeof item === "string" ? undefined : item.icon;
        const trailing = typeof item === "string" ? undefined : item.trailing;
        const isActive = index === activeIndex;
        const itemClassName = cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-200 hover:bg-foreground/[0.05]",
          isActive ? "text-foreground font-semibold" : "text-foreground/55 hover:text-foreground/90",
        );

        const content = (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {icon && <span className="shrink-0 opacity-75">{icon}</span>}
            <div className="min-w-0 flex-1">
              <div className="truncate">{label}</div>
              {sublabel && (
                <div className="mt-0.5 line-clamp-1 text-[10px] font-normal text-foreground/45">
                  {sublabel}
                </div>
              )}
            </div>
          </div>
        );

        return (
          <li
            key={key}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className="group/item relative flex items-center"
          >
            {href ? (
              <motion.a
                href={href}
                data-slot="bounce-sidebar-item"
                data-active={isActive}
                onClick={() => select(index, item)}
                className={itemClassName}
              >
                {content}
              </motion.a>
            ) : (
              <div
                role="button"
                tabIndex={0}
                data-slot="bounce-sidebar-item"
                data-active={isActive}
                onClick={() => select(index, item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(index, item);
                  }
                }}
                className={itemClassName}
              >
                {content}
                {trailing && (
                  <div
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {trailing}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default BounceSidebar;
