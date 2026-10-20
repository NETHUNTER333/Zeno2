"use client";

/**
 * @author: @kokonutui
 * @description: AI Loading State
 * @version: 2.0.0
 * @date: 2026-10-14
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { ChevronDown } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export type AgentStepStatus = "pending" | "running" | "done" | "error";

export interface AgentStep {
  id: string;
  label: string;
  status: AgentStepStatus;
  /** Log lines for the step. The running step shows the latest ones. */
  detail?: string[];
  /** Optional explicit duration in ms when already completed */
  durationMs?: number;
}

interface AILoadingStateProps {
  /**
   * The agent's steps, in order. Update them as work progresses. When
   * omitted, steps progress once and stay on the final step until completion.
   */
  steps?: AgentStep[];
  /** Optional loading mode so image/file uploads show dedicated analysis steps */
  mode?: "vision" | "file" | "search";
  /** Optional exact total duration in ms when completed */
  totalDurationMs?: number;
  /** Collapse the list once every step is done. Defaults to true. */
  collapseWhenDone?: boolean;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LINE_HEIGHT = 24;
const VISIBLE_LINES = 3;

const VISION_STEPS: Omit<AgentStep, "status">[] = [
  {
    id: "upload-image",
    label: "Uploading image to vision model",
    detail: [
      "encoding high-resolution image payload",
      "transmitting image bytes to vision endpoint",
    ],
  },
  {
    id: "analyze-image",
    label: "Analyzing image & extracting visual details",
    detail: [
      "inspecting objects, scene, colors & layout",
      "extracting visible text, labels & UI elements",
      "running deep pixel & structural analysis",
    ],
  },
  {
    id: "synthesize-vision",
    label: "Synthesizing detailed image breakdown",
    detail: [
      "matching visual findings to your prompt",
      "formatting structured visual report",
    ],
  },
];

const FILE_STEPS: Omit<AgentStep, "status">[] = [
  {
    id: "upload-file",
    label: "Uploading file attachment to model",
    detail: [
      "reading document stream & metadata",
      "extracting text & structural blocks",
    ],
  },
  {
    id: "analyze-file",
    label: "Analyzing file contents & data",
    detail: [
      "inspecting sections, code & key figures",
      "cross-checking prompt against document",
    ],
  },
  {
    id: "synthesize-file",
    label: "Synthesizing file analysis",
    detail: ["formatting detailed findings"],
  },
];

const DEMO_STEPS: Omit<AgentStep, "status">[] = [
  {
    id: "search",
    label: "Searching live web & sources",
    detail: [
      "querying live web index",
      "fetching primary sources & citations",
      "extracting key passages",
      "ranking by relevance",
    ],
  },
  {
    id: "media",
    label: "Fetching YouTube videos & images",
    detail: [
      "searching YouTube & internet video streams",
      "resolving inline embed players",
      "fetching unblurred reference images",
    ],
  },
  {
    id: "analyze",
    label: "Analyzing mechanisms & evidence",
    detail: [
      "verifying physical & scientific data",
      "cross-referencing citations",
    ],
  },
  {
    id: "write",
    label: "Synthesizing response",
    detail: ["formatting detailed breakdown"],
  },
];

const DEMO_TICK_MS = 750;

interface DemoPosition {
  step: number;
  line: number;
}

/**
 * Advances through template steps once and holds on the final active step
 * (never looping or collapsing prematurely) while waiting for the model response.
 */
function useDemoRun(
  enabled: boolean,
  rootRef: React.RefObject<HTMLElement | null>,
  customTemplateSteps?: Omit<AgentStep, "status">[]
) {
  const activeTemplate =
    customTemplateSteps && customTemplateSteps.length > 0
      ? customTemplateSteps
      : DEMO_STEPS;
  const [position, setPosition] = useState<DemoPosition>({
    step: 0,
    line: 1,
  });

  const positionRef = useRef(position);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const lastStepIdx = Math.max(0, activeTemplate.length - 1);
    const id = setInterval(() => {
      const curStep = positionRef.current.step;
      const curLine = positionRef.current.line;
      const lc = activeTemplate[curStep]?.detail?.length ?? 0;

      if (curLine < lc) {
        positionRef.current = { step: curStep, line: curLine + 1 };
        setPosition(positionRef.current);
      } else if (curStep < lastStepIdx) {
        positionRef.current = { step: curStep + 1, line: 1 };
        setPosition(positionRef.current);
      }
      // Once at { step: lastStepIdx, line: lc }, stay in "running" state on the last step
      // until the real backend response arrives — never reset or retrigger!
    }, DEMO_TICK_MS);

    return () => clearInterval(id);
  }, [enabled, activeTemplate]);

  return useMemo(
    () =>
      activeTemplate.map((step, i): AgentStep => {
        if (i < position.step) {
          return { ...step, status: "done" };
        }
        if (i === position.step) {
          return {
            ...step,
            status: "running",
            detail: step.detail?.slice(0, Math.max(1, position.line)),
          };
        }
        return { ...step, status: "pending" };
      }),
    [activeTemplate, position.step, position.line]
  );
}

function StepIcon({ status }: { status: AgentStepStatus }) {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, filter: "blur(0px)" }}
          className="absolute inset-0 flex items-center justify-center"
          exit={{ opacity: 0, filter: "blur(2px)" }}
          initial={{ opacity: 0, filter: "blur(2px)" }}
          key={status}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {status === "pending" && (
            <span className="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
          )}
          {status === "running" && (
            <svg
              aria-hidden="true"
              className="size-3.5 motion-safe:animate-spin"
              fill="none"
              style={{ animationDuration: "0.8s" }}
              viewBox="0 0 16 16"
            >
              <circle
                className="stroke-zinc-300 dark:stroke-zinc-700"
                cx="8"
                cy="8"
                r="6.25"
                strokeWidth="1.5"
              />
              <path
                className="stroke-zinc-800 dark:stroke-zinc-100"
                d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          )}
          {status === "done" && (
            <svg
              aria-hidden="true"
              className="size-3.5 text-zinc-700 dark:text-zinc-200"
              fill="none"
              viewBox="0 0 16 16"
            >
              <motion.path
                animate={{ pathLength: 1 }}
                d="M3.5 8.5 6.5 11.5 12.5 4.5"
                initial={{ pathLength: 0 }}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.05 }}
              />
            </svg>
          )}
          {status === "error" && (
            <svg
              aria-hidden="true"
              className="size-3.5 text-red-500"
              fill="none"
              viewBox="0 0 16 16"
            >
              <path
                d="M4.5 4.5l7 7m0-7-7 7"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.75"
              />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The running step's latest log lines, scrolling up as new ones arrive. */
function StepLog({ lines }: { lines: string[] }) {
  const offset = Math.max(0, lines.length - VISIBLE_LINES);
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden font-mono text-xs"
      style={{
        height: LINE_HEIGHT * Math.min(lines.length, VISIBLE_LINES),
        maskImage:
          lines.length > VISIBLE_LINES - 1
            ? "linear-gradient(to bottom, rgb(0 0 0 / 0.25), black 70%)"
            : undefined,
        WebkitMaskImage:
          lines.length > VISIBLE_LINES - 1
            ? "linear-gradient(to bottom, rgb(0 0 0 / 0.25), black 70%)"
            : undefined,
        transition: "height 240ms cubic-bezier(0.23, 1, 0.32, 1)",
      }}
    >
      <div
        className="transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(${-offset * LINE_HEIGHT}px)` }}
      >
        {lines.map((line, index) => (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"
            initial={{ opacity: 0 }}
            key={`${index}-${line}`}
            style={{ height: LINE_HEIGHT }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <span className="w-4 select-none text-right text-zinc-400 tabular-nums dark:text-zinc-600">
              {index + 1}
            </span>
            <span className="truncate">{line}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const formatDurationMs = (ms: number) => {
  const sec = ms / 1000;
  if (sec < 60) {
    return `${sec.toFixed(1)}s`;
  }
  const mins = Math.floor(sec / 60);
  const remSec = (sec % 60).toFixed(1);
  return `${mins}m ${remSec}s`;
};

/**
 * Exact milliseconds since the run started. Never resets while active.
 */
function useElapsedMs(active: boolean) {
  const [elapsedMs, setElapsedMs] = useState(100);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (startRef.current === null) {
      startRef.current = Date.now();
    }
    const start = startRef.current;
    const tick = () => setElapsedMs(Math.max(100, Date.now() - start));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [active]);

  return elapsedMs;
}

const WAVE_CSS = `
@keyframes kokonut-ai-wave { 50% { opacity: 0.3; } }
.kokonut-ai-wave { animation: kokonut-ai-wave 1.6s ease-in-out infinite both; }
@media (prefers-reduced-motion: reduce) { .kokonut-ai-wave { animation: none; } }
`;

/** A soft brightness wave through the running step's letters. */
function WaveText({ text }: { text: string }) {
  return (
    <>
      <style>{WAVE_CSS}</style>
      {Array.from(text).map((char, i) => (
        <span
          className="kokonut-ai-wave whitespace-pre"
          key={i}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {char}
        </span>
      ))}
    </>
  );
}

const formatStepTime = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/**
 * Times each step live while running and freezes its time once done.
 */
function useStepTimes(steps: AgentStep[]) {
  const [times, setTimes] = useState<Record<string, number>>({});
  const startsRef = useRef<Record<string, number>>({});
  const frozenRef = useRef<Record<string, number>>({});
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const stepsKey = steps
    .map((s) => `${s.id}:${s.status}:${s.durationMs ?? ""}`)
    .join("|");

  useEffect(() => {
    const sync = () => {
      const now = Date.now();
      const starts = startsRef.current;
      const frozen = frozenRef.current;
      const next: Record<string, number> = {};

      for (const step of stepsRef.current) {
        if (step.durationMs !== undefined) {
          next[step.id] = step.durationMs;
          continue;
        }
        if (step.status === "pending") {
          continue;
        }
        if (starts[step.id] === undefined) {
          starts[step.id] = now;
        }
        if (step.status === "running") {
          next[step.id] = Math.max(100, now - starts[step.id]);
        } else if (step.status === "done" || step.status === "error") {
          if (frozen[step.id] === undefined) {
            frozen[step.id] = Math.max(100, now - starts[step.id]);
          }
          next[step.id] = frozen[step.id];
        }
      }

      setTimes((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length !== nextKeys.length) return next;
        for (const k of nextKeys) {
          if (prev[k] !== next[k]) return next;
        }
        return prev;
      });
    };

    sync();
    const hasRunning = stepsRef.current.some(
      (s) => s.status === "running" && s.durationMs === undefined
    );
    if (!hasRunning) return;
    const id = setInterval(sync, 100);
    return () => clearInterval(id);
  }, [stepsKey]);

  return times;
}

const LABEL_COLORS: Record<AgentStepStatus, string> = {
  pending: "text-zinc-400 dark:text-zinc-500",
  running: "text-zinc-900 dark:text-zinc-100",
  done: "text-zinc-500 dark:text-zinc-400",
  error: "text-red-600 dark:text-red-400",
};

function StepRow({
  step,
  time,
  isLast,
}: {
  step: AgentStep;
  time: number | undefined;
  isLast: boolean;
}) {
  return (
    <li className="relative flex gap-3 pt-3">
      {/* The rail between icons fills in as each step completes. */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute top-[30px] bottom-[-10px] left-[7.5px] w-px overflow-hidden bg-zinc-200 dark:bg-zinc-800"
        >
          <span
            className={cn(
              "block h-full w-full origin-top bg-zinc-400 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] dark:bg-zinc-500",
              step.status === "done" ? "scale-y-100" : "scale-y-0"
            )}
          />
        </span>
      )}
      <StepIcon status={step.status} />
      <div className="-mt-0.5 min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              "min-w-0 truncate text-sm transition-colors duration-200",
              LABEL_COLORS[step.status]
            )}
          >
            {step.status === "running" ? (
              <>
                <span className="sr-only">{step.label}</span>
                <span aria-hidden="true">
                  <WaveText text={step.label} />
                </span>
              </>
            ) : (
              step.label
            )}
          </p>
          {time !== undefined && (
            <motion.span
              animate={{ opacity: 1 }}
              className="ml-auto shrink-0 text-xs text-zinc-400 tabular-nums dark:text-zinc-500"
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {formatStepTime(time)}
            </motion.span>
          )}
        </div>
        {(step.status === "running" || step.status === "done") && step.detail?.length ? (
          <div className="mt-1">
            <StepLog lines={step.detail} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function AILoadingState({
  steps: stepsProp,
  mode = "search",
  totalDurationMs,
  collapseWhenDone = true,
  className,
}: AILoadingStateProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const templateSteps =
    mode === "vision" ? VISION_STEPS : mode === "file" ? FILE_STEPS : DEMO_STEPS;
  const demoSteps = useDemoRun(stepsProp === undefined, rootRef, templateSteps);
  const steps = stepsProp ?? demoSteps;
  const listId = useId();

  const running = steps.find((step) => step.status === "running");
  const failed = steps.find((step) => step.status === "error");
  const isDone =
    steps.length > 0 && steps.every((step) => step.status === "done");
  const isActive = Boolean(running);
  const elapsedMs = useElapsedMs(isActive);
  const times = useStepTimes(steps);

  const totalStepMs = steps.reduce((acc, s) => acc + (s.durationMs || times[s.id] || 0), 0);
  const finalMs =
    totalDurationMs && totalDurationMs > 0
      ? totalDurationMs
      : totalStepMs > 0
      ? totalStepMs
      : elapsedMs;

  // Open while working; folds away once everything is done, until the user
  // opens it again.
  const [isOpen, setIsOpen] = useState(true);
  useEffect(() => {
    setIsOpen(!(isDone && collapseWhenDone));
  }, [isDone, collapseWhenDone]);

  let title = "Getting ready";
  if (failed) {
    title = `Stopped at: ${failed.label}`;
  } else if (isDone) {
    title = `Worked for ${formatDurationMs(finalMs)}`;
  } else if (running) {
    title = running.label;
  }

  return (
    <div
      className={cn("flex w-full items-center justify-start", className)}
      ref={rootRef}
    >
      <MotionConfig reducedMotion="user">
        <div className="w-full max-w-md rounded-2xl backdrop-blur-xl bg-white/60 dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] px-3.5 py-2.5 shadow-sm">
          <button
            aria-controls={listId}
            aria-expanded={isOpen}
            className="group/header flex w-full items-center gap-2 rounded-md py-0.5 text-left font-medium text-sm text-zinc-700 outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/40 dark:text-zinc-200 cursor-pointer"
            onClick={() => setIsOpen((open) => !open)}
            type="button"
          >
            <output className="min-w-0 truncate">{title}</output>
            {isActive && (
              <span className="text-zinc-400 tabular-nums dark:text-zinc-500 text-xs shrink-0">
                {formatDurationMs(elapsedMs)}
              </span>
            )}
            {isDone && (
              <span className="text-zinc-400 dark:text-zinc-500 text-xs shrink-0">
                · {steps.length} {steps.length === 1 ? "step" : "steps"}
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "ml-auto size-4 text-zinc-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/header:text-zinc-600 dark:group-hover/header:text-zinc-300",
                isOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.ol
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                id={listId}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {steps.map((step, i) => (
                  <StepRow
                    isLast={i === steps.length - 1}
                    key={step.id}
                    step={step}
                    time={times[step.id]}
                  />
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </div>
  );
}
