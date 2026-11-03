"use client";

import React, {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
  type Transition,
  type Variants,
} from "motion/react";
import {
  Globe,
  ExternalLink,
  Loader2,
  MessageCircle,
  Repeat2,
  Heart,
  BarChart2,
  Bookmark,
  ChevronDown as LucideChevronDown,
  ChevronUp as LucideChevronUp,
} from "lucide-react";
import { SocialMeta } from "../../types";
import { formatSocialMetric } from "../../lib/socialEnricher";
import GitHubActivity, { extractGitHubUsername } from "./github-activity";

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export type WebSearchStatus = "searching" | "done" | "completed" | "idle";

export type WebSource = {
  id?: string;
  title: string;
  url: string;
  snippet?: string;
  favicon?: string;
  domain?: string;
  date?: string;
  position?: number;
  socialMeta?: SocialMeta;
};

export type WebSearchSource = WebSource;

const COLUMNS = 4;
// each result closes this share of the gap left, so the ring fills fast early and never hits the end on its own
const STEP = 0.3;
const START = 0.08;
const CREEP = 0.25;
const CREEP_SECONDS = 1.5;
const RING_HOLD = 0.05;
const STACK = 4;
// hover waits a beat before acting, so a pointer just passing through never triggers it
const SPREAD_DELAY = 120;
const PREVIEW_DELAY = 200;
const LEAVE_DELAY = 120;

const SWAP: Transition = { type: "spring", duration: 0.2, bounce: 0.05 };
const POP: Transition = { type: "spring", duration: 0.22, bounce: 0.2 };
const SPREAD: Transition = { type: "spring", duration: 0.2, bounce: 0 };
const OPEN: Transition = { type: "spring", duration: 0.22, bounce: 0.05 };
const CARD: Transition = { type: "spring", duration: 0.22, bounce: 0.05 };
const STAGGER = 0.015;
const RING: Transition = { type: "spring", duration: 0.22, bounce: 0 };
const INSTANT: Transition = { duration: 0 };

const swapVariants: Variants = {
  enter: { y: 6, opacity: 0, filter: "blur(3px)" },
  center: { y: 0, opacity: 1, filter: "blur(0px)" },
  exit: { y: -6, opacity: 0, filter: "blur(3px)" },
};

const cardVariants: Variants = {
  enter: { opacity: 0, y: 8, scale: 0.97, filter: "blur(6px)" },
  center: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.97, filter: "blur(4px)" },
};

// the highlight sits mid gradient and the size leaves room either side, so each sweep starts off screen
const SHIMMER =
  "linear-gradient(90deg, var(--web-search-ink) 40%, var(--web-search-shine) 50%, var(--web-search-ink) 60%)";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const RING_CIRCLE = { ...STROKE, cx: 14, cy: 14, r: 13, strokeWidth: 1.5 };

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// without an href an anchor keeps its look but goes nowhere, for previews that shouldn't send visitors away
const linkTo = (url: string, linked: boolean) =>
  linked ? { href: url, target: "_blank", rel: "noreferrer" } : {};

const SECOND_LEVEL_TLDS = new Set([
  "co",
  "com",
  "org",
  "net",
  "edu",
  "gov",
  "ac",
  "ind",
  "nic",
]);

const extractBrandFromHost = (rawHost: string) => {
  const host = rawHost.replace(/^www\./i, "").trim().toLowerCase();
  if (!host.includes(".")) return host || "web";
  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 3 && SECOND_LEVEL_TLDS.has(parts[parts.length - 2])) {
    return parts[parts.length - 3];
  }
  if (parts.length >= 3 && parts[parts.length - 2] === "indiatimes") {
    return parts[0];
  }
  return parts.length > 1 ? parts[parts.length - 2] : parts[0] || "web";
};

// developer.mozilla.org reads as "mozilla", the way people say it
const siteName = (url: string, explicitDomain?: string) => {
  if (explicitDomain) {
    if (!explicitDomain.includes(".")) return explicitDomain;
    const fromExplicit = extractBrandFromHost(explicitDomain);
    if (fromExplicit && fromExplicit !== "google" && fromExplicit !== "bing") {
      return fromExplicit;
    }
  }
  return extractBrandFromHost(hostOf(url));
};

export function getCleanDomain(url: string, explicitDomain?: string): string {
  if (explicitDomain && !explicitDomain.includes(".")) return explicitDomain;
  try {
    const raw = explicitDomain || new URL(url).hostname;
    return raw.replace(/^www\./, "");
  } catch {
    return explicitDomain || "web";
  }
}

export function getDomainIcon(domainName: string, _isDark?: boolean) {
  return <Favicon source={{ title: domainName, url: `https://${domainName}`, domain: domainName }} size={14} />;
}

export type WebSearchProps = Omit<ComponentProps<"div">, "children"> & {
  sources?: WebSource[];
  status?: WebSearchStatus;
  query?: string;
  searchQuery?: string;
  label?: string;
  progress?: number;
  linked?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isDark?: boolean;
  onSelectCitation?: (source: WebSearchSource) => void;
  messageId?: string;
};

function WebSearch({
  sources = [],
  status = "done",
  query,
  searchQuery,
  label,
  progress,
  linked = true,
  open,
  defaultOpen = true,
  onOpenChange,
  isDark = true,
  onSelectCitation,
  messageId,
  className,
  ...props
}: WebSearchProps) {
  const reduced = !!useReducedMotion();
  const [openState, setOpenState] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const [measureRef, labelWidth] = useSize<HTMLSpanElement>("width");

  const searching = status === "searching";
  const isOpen = open ?? openState;
  const count = sources.length;
  const activeQuery = query ?? searchQuery;

  const ring = Math.min(
    1,
    Math.max(0, progress ?? (count === 0 ? START : 1 - (1 - STEP) ** count)),
  );

  const text =
    label ??
    (searching
      ? activeQuery
        ? `Searching “${activeQuery}”`
        : "Searching the web"
      : `Searched ${count} ${count === 1 ? "site" : "sites"}`);

  // the last slot belongs to the more card from the fourth result on, so no card ever has to turn into it
  const overflow = !expanded && count >= COLUMNS;
  const shown = overflow ? sources.slice(0, COLUMNS - 1) : sources;
  const hidden = overflow ? sources.slice(COLUMNS - 1) : [];
  // empty slots keep the 2x2 grid full while results are still landing
  const skeletons = searching && !overflow ? Math.max(0, COLUMNS - count) : 0;

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  const swap = reduced ? INSTANT : SWAP;
  // after expanding, the stagger starts at the first card that was hidden
  const stagger = (i: number): Transition =>
    reduced
      ? INSTANT
      : {
          ...CARD,
          delay: Math.max(0, i - (expanded ? COLUMNS - 1 : 0)) * STAGGER,
        };

  const cell = (key: string, i: number, child: ReactNode) => (
    <motion.li
      key={key}
      className="group/card list-none"
      layout={!reduced}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={stagger(i)}
    >
      {child}
    </motion.li>
  );

  return (
    <div
      data-slot="web-search"
      data-status={searching ? "searching" : "done"}
      data-open={isOpen || undefined}
      className={cn(
        "my-3 flex w-full max-w-[620px] flex-col font-sans select-none text-[#18181b] dark:text-white",
        className,
      )}
      {...props}
    >
      <button
        type="button"
        data-slot="web-search-trigger"
        onClick={toggle}
        aria-expanded={isOpen}
        className="group flex h-11 w-fit max-w-full cursor-pointer items-center gap-3 rounded-full border border-black/[0.1] bg-white pl-2 pr-4 text-left outline-none transition-all shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:border-black/[0.2] dark:border-white/[0.14] dark:bg-[#141418] dark:hover:border-white/[0.25] dark:shadow-[0_6px_20px_rgba(0,0,0,0.45)]"
      >
        <GlobeTile searching={searching} progress={ring} reduced={reduced} />

        {/* the label springs between widths, so the icons beside it glide instead of jumping */}
        <motion.span
          aria-live="polite"
          className="relative grid min-w-0 overflow-x-clip"
          initial={false}
          animate={{ width: labelWidth ?? "auto" }}
          transition={swap}
        >
          <span
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-[13.5px] font-semibold"
          >
            {text}
          </span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={text}
              variants={swapVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={swap}
              className="truncate whitespace-nowrap text-[13.5px] font-semibold"
            >
              {searching ? <Shimmer reduced={reduced}>{text}</Shimmer> : text}
            </motion.span>
          </AnimatePresence>
        </motion.span>

        <FaviconStack sources={sources} reduced={reduced} />

        <motion.span
          className="-ml-0.5 shrink-0 text-[#71717a] transition-colors group-hover:text-black dark:group-hover:text-white"
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={reduced ? INSTANT : OPEN}
        >
          <Chevron />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (count > 0 || searching) && (
          <Collapse key="sources" reduced={reduced}>
            <ol
              data-slot="web-search-sources"
              className="relative grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 !pl-0 !my-0 list-none"
            >
              <AnimatePresence mode="popLayout">
                {shown.map((source, i) =>
                  cell(
                    source.id || `${source.url}-${i}`,
                    i,
                    <SourceCard
                      source={source}
                      index={source.position ?? i + 1}
                      linked={linked}
                      onSelect={onSelectCitation}
                      messageId={messageId}
                    />,
                  ),
                )}
                {Array.from({ length: skeletons }, (_, i) => (
                  <motion.li
                    key={`skeleton-${count + i}`}
                    aria-hidden
                    className="list-none"
                    layout={!reduced}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={stagger(count + i)}
                  >
                    <SkeletonCard reduced={reduced} delay={i * 0.12} />
                  </motion.li>
                ))}
                {hidden.length > 0 &&
                  cell(
                    "more",
                    COLUMNS - 1,
                    <MoreCard
                      sources={hidden}
                      onClick={() => setExpanded(true)}
                      reduced={reduced}
                    />,
                  )}
                {expanded &&
                  count >= COLUMNS &&
                  cell(
                    "less",
                    count,
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className={cn(
                        CARD_SHELL,
                        "group flex-row items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[#71717a] group-hover/card:translate-y-0 hover:text-black dark:hover:text-white",
                      )}
                    >
                      <Chevron className="-ml-0.5 rotate-180 transition-transform duration-200 group-hover:-translate-y-px" />
                      Show less
                    </button>,
                  )}
              </AnimatePresence>
            </ol>
          </Collapse>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={14}
      height={14}
      {...STROKE}
      strokeWidth={2.6}
      className={cn("block", className)}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Collapse({
  reduced,
  children,
}: {
  reduced: boolean;
  children: ReactNode;
}) {
  const [ref, height] = useSize<HTMLDivElement>("height");
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      // height auto only animates on mount, so the measured height carries every later change
      animate={{ height: height ?? "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={
        reduced ? INSTANT : { height: OPEN, opacity: { duration: 0.25 } }
      }
      className="-mx-1 overflow-hidden"
    >
      {/* the inset gives the hover lift and focus rings room before the clip */}
      <div ref={ref} className="px-1 pb-1">
        {children}
      </div>
    </motion.div>
  );
}

// the li takes the hover and the card inside lifts, so the lift can't slide the card out from under the pointer
// the hover shadow stays inside the 4px the collapse leaves around the cards, or its clip shows as a hard edge
const CARD_SHELL =
  "flex h-[88px] w-full cursor-pointer flex-col rounded-2xl border border-black/[0.09] bg-white p-3 text-left !no-underline outline-none transition-all duration-200 group-hover/card:-translate-y-0.5 hover:border-black/[0.22] shadow-[0_2px_10px_rgba(0,0,0,0.03)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71717a] dark:border-white/[0.12] dark:bg-[#141418] dark:hover:border-white/[0.25]";

function SourceCard({
  source,
  index,
  linked,
  onSelect,
  messageId,
}: {
  source: WebSource;
  index: number;
  linked: boolean;
  onSelect?: (source: WebSearchSource) => void;
  messageId?: string;
}) {
  const isGitHub = Boolean(extractGitHubUsername(source.url));
  const cardId = messageId ? `src-${messageId}-${index}` : `src-${index}`;
  return (
    <a
      id={cardId}
      data-slot="web-search-source"
      data-source-index={index}
      data-message-id={messageId}
      {...linkTo(source.url, linked && !(isGitHub && onSelect))}
      onClick={(e) => {
        if ((!linked || isGitHub) && onSelect) {
          e.preventDefault();
          onSelect({ ...source, position: index });
        }
      }}
      title={source.title}
      className={cn(
        CARD_SHELL,
        "group justify-between transition-all duration-200",
        !linked && !onSelect && "cursor-default",
      )}
    >
      <span className="line-clamp-2 text-[12px] sm:text-[12.5px] font-semibold leading-[16.5px] text-[#18181b] transition-colors group-hover:text-black dark:text-white/90 dark:group-hover:text-white">
        {source.title}
      </span>
      <span className="flex items-center gap-1.5">
        <Favicon source={source} size={15} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#71717a]">
          {siteName(source.url, source.domain)}
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-mono font-semibold tabular-nums transition-colors bg-[#f4f4f5] text-[#52525b] dark:bg-white/[0.08] dark:text-white/80"
        >
          {index}
        </span>
      </span>
    </a>
  );
}

function MoreCard({
  sources,
  onClick,
  reduced,
}: {
  sources: WebSource[];
  onClick: () => void;
  reduced: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${sources.length} more sources`}
      className={cn(CARD_SHELL, "group justify-between")}
    >
      <FaviconStack sources={sources} reduced={reduced} />
      <span className="flex items-center gap-1 whitespace-nowrap text-[12px] sm:text-[12.5px] font-semibold leading-[16.5px] text-[#18181b] transition-colors group-hover:text-black dark:text-white/90 dark:group-hover:text-white">
        <span className="relative inline-grid overflow-hidden tabular-nums">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={sources.length}
              initial={{ y: "100%", opacity: 0, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-100%", opacity: 0, filter: "blur(2px)" }}
              transition={reduced ? INSTANT : SWAP}
            >
              {sources.length}
            </motion.span>
          </AnimatePresence>
        </span>
        more {sources.length === 1 ? "source" : "sources"}
      </span>
    </button>
  );
}

function SkeletonCard({ reduced, delay }: { reduced: boolean; delay: number }) {
  const bar = "rounded-full bg-black/[0.08] dark:bg-white/[0.1]";
  return (
    <div className="relative flex h-[88px] flex-col justify-between overflow-hidden rounded-2xl border border-black/[0.09] bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:border-white/[0.12] dark:bg-[#141418]">
      <span className="flex flex-col gap-2 pt-0.5">
        <span className={cn(bar, "h-2.5 w-[88%]")} />
        <span className={cn(bar, "h-2.5 w-[62%]")} />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className={cn(bar, "size-3.5")} />
          <span className={cn(bar, "h-2 w-14")} />
        </span>
        <span className={cn(bar, "h-3.5 w-5")} />
      </span>
      {!reduced && (
        <motion.span
          className="absolute inset-0 bg-linear-to-r from-transparent via-black/[0.04] to-transparent dark:via-white/[0.06]"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 1.3,
            ease: "easeInOut",
            repeat: Infinity,
            delay,
          }}
        />
      )}
    </div>
  );
}

function useSize<T extends HTMLElement>(side: "width" | "height") {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    // offsetWidth rounds down, which is enough to tip the label into an ellipsis
    const observer = new ResizeObserver(() =>
      setSize(Math.ceil(node.getBoundingClientRect()[side])),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [side]);
  return [ref, size] as const;
}

function useHoverIntent(enterDelay: number) {
  const [active, setActive] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const set = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(next), delay);
  };
  // touch has no hover, so a tap never leaves anything stuck open
  const hover = {
    onPointerEnter: (event: ReactPointerEvent) =>
      event.pointerType === "mouse" && set(true, enterDelay),
    onPointerLeave: () => set(false, LEAVE_DELAY),
  };
  return { active, set, hover };
}

function FaviconStack({
  sources,
  reduced,
  size = 20,
}: {
  sources: WebSource[];
  reduced: boolean;
  size?: number;
}) {
  // only the icons themselves spread on hover, not the pill or card around them
  const { active: spread, hover } = useHoverIntent(SPREAD_DELAY);
  const shown = sources.slice(0, STACK);
  // the 2px plate around each icon counts in the layout, so the overlap makes room for it
  const overlap = Math.round(size * 0.3) + 4;
  // icons slide on transforms, which move in subpixels, and one padding change makes room for them
  const shift = spread ? overlap - 2 : 0;

  return (
    <motion.span
      data-slot="web-search-stack"
      {...hover}
      className="flex w-fit shrink-0 items-center"
      initial={false}
      animate={{ paddingRight: shift * Math.max(0, shown.length - 1) }}
      transition={reduced ? INSTANT : SPREAD}
    >
      <AnimatePresence initial={false}>
        {shown.map((source, i) => (
          <motion.span
            key={source.id || `${source.url}-${i}`}
            // the separator is a plate in the surface color, so the icon's soft edge blends into it instead of leaving a seam
            className="relative rounded-full bg-[#F4F4F9] p-[2px] transition-colors group-hover:bg-white dark:bg-[#1C1C1C] dark:group-hover:bg-[#232323]"
            style={{ zIndex: STACK - i, marginLeft: i === 0 ? 0 : -overlap }}
            initial={{ scale: 0, opacity: 0, x: shift * i }}
            animate={{ scale: 1, opacity: 1, x: shift * i }}
            exit={{ scale: 0, opacity: 0 }}
            transition={reduced ? INSTANT : { default: POP, x: SPREAD }}
          >
            <Favicon source={source} size={size} />
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.span>
  );
}

function Favicon({ source, size }: { source: WebSource; size: number }) {
  const [broken, setBroken] = useState(false);
  const name = siteName(source.url, source.domain);
  const rawHost =
    source.domain && source.domain.includes(".")
      ? source.domain.replace(/^www\./i, "")
      : hostOf(source.url);
  const hue = hash(name) % 360;
  const resolvedFavicon =
    source.favicon ||
    (rawHost && rawHost.includes(".") && rawHost !== "web"
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(rawHost)}&sz=64`
      : undefined);
  const image = resolvedFavicon && !broken;

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold uppercase leading-none text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: image
          ? undefined
          : `linear-gradient(135deg, oklch(0.72 0.15 ${hue}), oklch(0.58 0.17 ${(hue + 30) % 360}))`,
      }}
    >
      {image ? (
        <img
          src={resolvedFavicon}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}

function GlobeTile({
  searching,
  progress,
  reduced,
}: {
  searching: boolean;
  progress: number;
  reduced: boolean;
}) {
  const fill = useMotionValue(searching ? 0 : 1);

  useEffect(() => {
    const target = searching ? progress : 1;
    if (reduced) {
      fill.jump(target);
      return;
    }
    let creep: AnimationPlaybackControls | undefined;
    const settle = animate(fill, target, RING);
    // between results the ring keeps edging toward the next step, so it never looks stuck
    if (searching) {
      settle.then(() => {
        creep = animate(fill, target + (1 - target) * CREEP, {
          duration: CREEP_SECONDS,
          ease: "easeOut",
        });
      });
    }
    return () => {
      settle.stop();
      creep?.stop();
    };
  }, [searching, progress, reduced, fill]);

  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[#868593] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors group-hover:text-black dark:bg-[#2A2A2A] dark:group-hover:text-white">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={15}
        height={15}
        {...STROKE}
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
      <motion.svg
        aria-hidden
        viewBox="0 0 28 28"
        className="absolute inset-0 size-full -rotate-90 text-black dark:text-white"
        initial={false}
        animate={{ opacity: searching ? 1 : 0 }}
        // a finished search holds the full ring for a beat before it fades
        transition={
          reduced
            ? INSTANT
            : { duration: 0.3, delay: searching ? 0 : RING_HOLD }
        }
      >
        <circle {...RING_CIRCLE} className="opacity-[0.12]" />
        <motion.circle {...RING_CIRCLE} style={{ pathLength: fill }} />
      </motion.svg>
    </span>
  );
}

function Shimmer({
  reduced,
  children,
}: {
  reduced: boolean;
  children: ReactNode;
}) {
  if (reduced) return <span className="text-[#868593]">{children}</span>;
  return (
    <motion.span
      className="bg-clip-text text-transparent [--web-search-ink:#868593] [--web-search-shine:#000] dark:[--web-search-shine:#fff]"
      style={{ backgroundImage: SHIMMER, backgroundSize: "250% 100%" }}
      initial={{ backgroundPosition: "100% 0" }}
      animate={{ backgroundPosition: "0% 0" }}
      transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
}

export type WebSearchCitationProps = Omit<ComponentProps<"span">, "children"> & {
  source: WebSource;
  index?: number;
  linked?: boolean;
  isDark?: boolean;
  onOpenModal?: (source: WebSearchSource) => void;
  messageId?: string;
};

function WebSearchCitation({
  source,
  index,
  linked = true,
  isDark: _isDark,
  onOpenModal,
  messageId,
  className,
  ...props
}: WebSearchCitationProps) {
  const reduced = !!useReducedMotion();
  const { active: open, set, hover } = useHoverIntent(PREVIEW_DELAY);
  const ghUser = extractGitHubUsername(source.url);

  const handleChipClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep hover preview popover open
    set(true, 0);
    if (ghUser && onOpenModal) {
      onOpenModal(source);
    }
  };

  return (
    <span
      data-slot="web-search-citation"
      className={cn("relative inline-flex align-baseline mx-0.5 whitespace-nowrap", className)}
      onPointerEnter={(event) => {
        hover.onPointerEnter(event);
      }}
      onPointerLeave={() => {
        hover.onPointerLeave();
      }}
      {...props}
    >
      <button
        type="button"
        onClick={handleChipClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleChipClick(e);
          } else if (e.key === "Escape") {
            set(false, 0);
          }
        }}
        onFocus={() => {
          set(true, 0);
        }}
        onBlur={() => {
          set(false, 0);
        }}
        aria-label={index !== undefined ? `Source ${index}: ${source.title}` : `Source: ${source.title}`}
        className={cn(
          !linked ? "cursor-default" : "cursor-pointer",
          "citation-badge whitespace-nowrap inline-flex h-[19px] -translate-y-px items-center gap-1 rounded-full bg-[#F4F4F9] pl-[3px] pr-1.5 font-sans text-[11px] font-semibold leading-none text-[#868593] !no-underline outline-none transition-colors hover:bg-[#FC4C01]/10 hover:text-[#FC4C01] hover:ring-1 hover:ring-[#FC4C01]/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#FC4C01] dark:bg-[#1C1C1C] dark:hover:bg-[#FC4C01]/15 dark:hover:text-[#FC4C01]",
          open &&
            "bg-[#FC4C01]/10 text-[#FC4C01] ring-1 ring-[#FC4C01]/40 dark:bg-[#FC4C01]/15 dark:text-[#FC4C01]",
        )}
      >
        <Favicon source={source} size={14} />
        <span className="whitespace-nowrap">{siteName(source.url, source.domain)}</span>
        {index !== undefined && (
          <span className="tabular-nums opacity-75">{index}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            className={cn(
              "absolute bottom-full left-1/2 z-50 block whitespace-normal pb-2",
              ghUser ? "w-[min(320px,calc(100vw-2rem))]" : "w-[min(288px,calc(100vw-2rem))]",
            )}
            style={{ x: "-50%", originY: 1 }}
            initial={{ opacity: 0, y: 4, scale: 0.96, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 4, scale: 0.98, filter: "blur(2px)" }}
            transition={
              reduced
                ? INSTANT
                : { type: "spring", duration: 0.35, bounce: 0.15 }
            }
          >
            <a
              {...linkTo(source.url, linked)}
              tabIndex={-1}
              className="citation-badge block rounded-[16px] bg-white p-3 text-left font-sans !no-underline shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)] dark:bg-[#1C1C1C] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.07)]"
            >
              <span className="flex items-center gap-1.5">
                <Favicon source={source} size={18} />
                <span className="truncate text-[12px] font-medium text-[#868593]">
                  {ghUser ? `github.com/${ghUser}` : hostOf(source.url)}
                </span>
              </span>
              <span className="mt-1.5 line-clamp-2 block text-[13.5px] font-semibold leading-[18px] text-black dark:text-white">
                {source.title}
              </span>
              {source.snippet && (
                <span className="mt-1 line-clamp-3 block text-[12.5px] font-medium leading-[17px] text-[#868593]">
                  {source.snippet}
                </span>
              )}
            </a>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

const STREAM_SPEED = 80;
// past this many waiting characters, each tick writes more so a live stream never falls behind
const CATCH_UP = 120;
const SENTENCE_PAUSE = 180;
const CLAUSE_PAUSE = 70;

// fixed jitter, so the pace feels uneven but every replay types the same way
const jitter = (n: number) =>
  ((Math.imul(n + 1, 2654435761) >>> 0) % 1000) / 1000;

type Parent = ReactElement<{ children?: ReactNode }>;

// plain tags like p, li, and strong are typed into; components like citations land whole
const isTag = (node: ReactNode): node is Parent =>
  isValidElement(node) && typeof node.type === "string";

const plain = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isTag(node))
    return Children.toArray(node.props.children).map(plain).join("");
  return isValidElement(node) ? "\u0000" : "";
};

// a citation is wrapped with the word before it and the punctuation after it, so it never wraps onto a line alone
const glue = (nodes: ReactNode): ReactNode[] => {
  const list = Children.toArray(nodes);
  const out: ReactNode[] = [];
  list.forEach((node, i) => {
    if (isTag(node)) {
      out.push(cloneElement(node, undefined, glue(node.props.children)));
      return;
    }
    if (!isValidElement(node)) {
      out.push(node);
      return;
    }
    const prev = out.pop();
    const before =
      typeof prev === "string" ? /^([\s\S]*?)(\S+\s*)$/.exec(prev) : null;
    out.push(before ? before[1] : prev);
    const next = list[i + 1];
    const after =
      typeof next === "string" ? /^(\S*)([\s\S]*)$/.exec(next) : null;
    if (after) list[i + 1] = after[2];
    out.push(
      <span key={`glue-${i}`} className="whitespace-nowrap">
        {before?.[2]}
        {node}
        {after?.[1]}
      </span>,
    );
  });
  return out;
};

export type WebSearchAnswerProps = ComponentProps<"div"> & {
  play?: boolean;
  speed?: number;
  onComplete?: () => void;
};

function WebSearchAnswer({
  play = true,
  speed = STREAM_SPEED,
  onComplete,
  className,
  children,
  ...props
}: WebSearchAnswerProps) {
  const reduced = !!useReducedMotion();
  const content = useMemo(() => glue(children), [children]);
  const text = useMemo(() => content.map(plain).join(""), [content]);
  const [count, setCount] = useState(0);

  const written = reduced
    ? play
      ? text.length
      : 0
    : Math.min(count, text.length);
  const writing = play && written < text.length;

  useEffect(() => {
    if (!play || reduced || count >= text.length) return;
    const step = Math.max(
      1 + Math.floor(jitter(count) * 3),
      Math.ceil((text.length - count) / CATCH_UP),
    );
    const last = text[count + step - 1];
    const delay =
      (1000 / speed) * step * (0.4 + jitter(count + 7) * 1.2) +
      (/[.!?]/.test(last)
        ? SENTENCE_PAUSE
        : /[,;:]/.test(last)
          ? CLAUSE_PAUSE
          : 0);
    const id = window.setTimeout(() => setCount(count + step), delay);
    return () => window.clearTimeout(id);
  }, [play, reduced, count, text, speed]);

  const done = play && text.length > 0 && !writing;
  useEffect(() => {
    if (done) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // walks the content and cuts it off after the written characters, leaving the caret at the cut
  let left = written;
  let caret = writing;
  const write = (node: ReactNode): ReactNode => {
    if (left <= 0) return null;
    if (isTag(node)) {
      return cloneElement(
        node,
        undefined,
        Children.toArray(node.props.children).map(write),
      );
    }
    const isText = typeof node === "string" || typeof node === "number";
    const part = isText ? String(node).slice(0, left) : node;
    left -= isText ? (part as string).length : 1;
    if (left > 0 || !caret) return part;
    caret = false;
    return [part, <Caret key="caret" reduced={reduced} />];
  };

  return (
    <div
      data-slot="web-search-answer"
      data-writing={writing || undefined}
      aria-busy={writing}
      className={cn(
        "font-sans text-[15px] font-medium leading-7 text-black/80 dark:text-white/80",
        "[&_li]:pl-1 [&_li+li]:mt-1.5 [&_li::marker]:text-[#868593] [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-black [&_ul]:list-disc [&_ul]:pl-5 [&>*+*]:mt-3 dark:[&_strong]:text-white",
        className,
      )}
      {...props}
    >
      {written === 0 && writing ? (
        <Caret reduced={reduced} />
      ) : (
        content.map(write)
      )}
    </div>
  );
}

function Caret({ reduced }: { reduced: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="ml-0.5 inline-block size-[0.55em] rounded-full bg-current align-[-0.02em]"
      animate={reduced ? undefined : { opacity: [1, 0.4, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// Compact Citation Card with real social media post metrics & GitHub preview (used by inline-citations & CitationModal)
export const CompactCitationCard: React.FC<{
  source: WebSearchSource;
  onClose?: () => void;
  isDark?: boolean;
}> = ({ source, onClose, isDark = true }) => {
  const [showThread, setShowThread] = useState(false);
  const [liveSocial, setLiveSocial] = useState<SocialMeta | undefined>(source.socialMeta);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const dom = getCleanDomain(source.url, source.domain);
  const pos = source.position;

  useEffect(() => {
    setLiveSocial(source.socialMeta);
    if (!source.socialMeta && source.url && /(?:x\.com|twitter\.com)\/[^/]+/i.test(source.url)) {
      let cancelled = false;
      setLoadingSocial(true);
      fetch(`/api/social/resolve?url=${encodeURIComponent(source.url)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled && d.success && d.socialMeta) {
            setLiveSocial(d.socialMeta);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingSocial(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [source.url, source.socialMeta]);

  const social = liveSocial;
  const ghUser = extractGitHubUsername(source.url);

  return (
    <div
      className={`w-[min(350px,calc(100vw-2rem))] max-w-full p-3.5 rounded-2xl border shadow-xl select-none z-50 overflow-hidden box-border ${
        isDark
          ? "bg-[#1C1C1C] border-white/10 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)]"
          : "bg-white border-neutral-200/90 text-neutral-900 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)]"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 truncate">
          {loadingSocial ? (
            <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0" />
          ) : (
            <Favicon source={source} size={16} />
          )}
          <span className={`font-medium text-xs truncate ${isDark ? "text-[#868593]" : "text-[#868593]"}`}>
            {social
              ? `${social.platform.toUpperCase()} · @${social.authorUsername}`
              : ghUser
                ? `github.com · @${ghUser}`
                : dom}
          </span>
        </div>
        {pos !== undefined && (
          <span className="font-mono text-xs shrink-0 text-[#868593]">[{pos}]</span>
        )}
      </div>

      {social && (
        <div
          className={`p-2 rounded-xl mb-2 flex items-center justify-between border ${
            isDark ? "bg-white/5 border-white/10" : "bg-neutral-100 border-neutral-200"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {social.authorImage ? (
              <img
                src={social.authorImage}
                alt={social.authorName}
                className="w-7 h-7 rounded-full object-cover shrink-0 border border-black/10 dark:border-white/10"
              />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-sky-500/20 text-sky-400">
                {(social.authorName || social.authorUsername || "X").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1 truncate text-xs font-bold">
                <span className={`truncate ${isDark ? "text-white" : "text-neutral-900"}`}>
                  {social.authorName}
                </span>
              </div>
              <div className="text-[10px] truncate text-[#868593]">
                @{social.authorUsername}
              </div>
            </div>
          </div>
        </div>
      )}

      {!social ? (
        <>
          <div className={`font-semibold text-[13.5px] leading-[18px] line-clamp-2 mb-1.5 ${isDark ? "text-white" : "text-black"}`}>
            {source.title}
          </div>
          {source.snippet && (
            <p className="text-[12.5px] leading-[17px] line-clamp-3 mb-2.5 text-[#868593]">
              {source.snippet}
            </p>
          )}
        </>
      ) : (
        <p className={`text-[12px] leading-relaxed line-clamp-4 mb-2.5 whitespace-pre-wrap ${isDark ? "text-neutral-100" : "text-neutral-900"}`}>
          {social.text || source.snippet || source.title}
        </p>
      )}

      {social && (
        <div
          className={`grid grid-cols-5 gap-1 py-1.5 px-1 mb-2.5 rounded-xl border text-[10px] font-mono text-center ${
            isDark ? "bg-black/30 border-white/10 text-neutral-200" : "bg-neutral-50 border-neutral-200 text-neutral-800"
          }`}
        >
          <div className="flex flex-col items-center gap-0.5" title="Views">
            <BarChart2 className="w-3 h-3 text-sky-400" />
            <span>{formatSocialMetric(social.viewCount)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5" title="Likes">
            <Heart className="w-3 h-3 text-rose-500" />
            <span>{formatSocialMetric(social.likeCount)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5" title="Bookmarks">
            <Bookmark className="w-3 h-3 text-amber-400" />
            <span>{formatSocialMetric(social.bookmarkCount)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5" title="Reposts">
            <Repeat2 className="w-3 h-3 text-emerald-400" />
            <span>{formatSocialMetric(social.retweetCount)}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5" title="Replies">
            <MessageCircle className="w-3 h-3 text-cyan-400" />
            <span>{formatSocialMetric(social.replyCount)}</span>
          </div>
        </div>
      )}

      {social?.thread && social.thread.length > 0 && (
        <div className={`mb-2.5 border-t pt-2 ${isDark ? "border-white/10" : "border-neutral-200"}`}>
          <button
            type="button"
            onClick={() => setShowThread(!showThread)}
            className="w-full flex items-center justify-between text-[11px] font-semibold py-1 px-1.5 rounded text-sky-400 cursor-pointer"
          >
            <span>{showThread ? "Hide Replies" : `View Replies (${social.thread.length})`}</span>
            {showThread ? <LucideChevronUp className="w-3 h-3" /> : <LucideChevronDown className="w-3 h-3" />}
          </button>
          {showThread && (
            <div className="mt-1.5 pl-2.5 border-l-2 border-sky-500/50 space-y-1.5 text-[11px] max-h-36 overflow-y-auto">
              {social.thread.map((t, idx) => (
                <div key={t.id || idx} className="space-y-0.5">
                  <div className="flex items-center gap-1 font-bold">
                    <span className={isDark ? "text-white" : "text-neutral-900"}>{t.authorName}</span>
                    <span className="text-[10px] font-normal text-[#868593]">@{t.authorUsername}</span>
                  </div>
                  <p className={`text-[10.5px] line-clamp-2 ${isDark ? "text-neutral-300" : "text-neutral-800"}`}>
                    {t.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onClose?.()}
        className={`w-full py-2 px-3 rounded-xl flex items-center justify-between text-xs font-semibold transition-colors !no-underline cursor-pointer ${
          isDark
            ? "bg-white/10 hover:bg-white/15 text-white"
            : "bg-neutral-100 hover:bg-neutral-200/90 text-neutral-900"
        }`}
      >
        <span>
          {social
            ? `View on ${social.platform.toUpperCase()}`
            : ghUser
            ? `Open @${ghUser} on GitHub`
            : "Visit source"}
        </span>
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </a>
    </div>
  );
};

export const CitationModal: React.FC<{
  source: WebSearchSource | null;
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}> = ({ source, isOpen, onClose, isDark = true }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !source) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 dark:bg-black/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <CompactCitationCard source={source} onClose={onClose} isDark={isDark} />
    </div>
  );
};

export { WebSearch, WebSearchAnswer, WebSearchCitation };
export default WebSearch;
