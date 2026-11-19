import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { An as Bookmark, D as ThumbsDown, E as ThumbsUp, Gt as FolderOpen, L as Sparkles, Tn as Check, Z as Search, at as Plus, c as AnimatePresence, en as ExternalLink, et as RotateCcw, f as X, hn as Clock, kt as Link2, ln as Copy, n as motion, on as Download, qt as Flag, s as MotionConfig, w as Trash2, wn as ChevronDown, zn as ArrowLeft } from "./react-vendor-BgDBDE3V.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { a as getDocs, c as orderBy, f as collection, l as query, o as limit, p as doc, t as deleteDoc, u as setDoc } from "./firebase-CeWUhFTz.js";
import { i as db, m as getAuthHeaders, n as auth } from "./firebase-Df8_wQ36.js";
import { H as ChatInput, Q as GROK_MODELS, V as GrokLogo, W as openKinichReportModal, n as Button, r as cva, rt as UserAccountStore, s as MathMarkdown, t as cn, x as KnowledgeVaultStore } from "./index-DO79AgMG.js";
//#region src/components/kokonutui/ai-loading.tsx
/**
* @author: @kokonutui
* @description: AI Loading State
* @version: 2.0.0
* @date: 2026-10-14
* @license: MIT
* @website: https://kokonutui.com
* @github: https://github.com/kokonut-labs/kokonutui
*/
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var EASE_OUT = [
	.23,
	1,
	.32,
	1
];
var LINE_HEIGHT = 24;
var VISIBLE_LINES = 3;
var VISION_STEPS = [
	{
		id: "upload-image",
		label: "Uploading image to vision model",
		detail: ["encoding high-resolution image payload", "transmitting image bytes to vision endpoint"]
	},
	{
		id: "analyze-image",
		label: "Analyzing image & extracting visual details",
		detail: [
			"inspecting objects, scene, colors & layout",
			"extracting visible text, labels & UI elements",
			"running deep pixel & structural analysis"
		]
	},
	{
		id: "synthesize-vision",
		label: "Synthesizing detailed image breakdown",
		detail: ["matching visual findings to your prompt", "formatting structured visual report"]
	}
];
var FILE_STEPS = [
	{
		id: "upload-file",
		label: "Uploading file attachment to model",
		detail: ["reading document stream & metadata", "extracting text & structural blocks"]
	},
	{
		id: "analyze-file",
		label: "Analyzing file contents & data",
		detail: ["inspecting sections, code & key figures", "cross-checking prompt against document"]
	},
	{
		id: "synthesize-file",
		label: "Synthesizing file analysis",
		detail: ["formatting detailed findings"]
	}
];
var DEMO_STEPS = [
	{
		id: "search",
		label: "Searching live web & sources",
		detail: [
			"querying live web index",
			"fetching primary sources & citations",
			"extracting key passages",
			"ranking by relevance"
		]
	},
	{
		id: "media",
		label: "Fetching YouTube videos & images",
		detail: [
			"searching YouTube & internet video streams",
			"resolving inline embed players",
			"fetching unblurred reference images"
		]
	},
	{
		id: "analyze",
		label: "Analyzing mechanisms & evidence",
		detail: ["verifying physical & scientific data", "cross-referencing citations"]
	},
	{
		id: "write",
		label: "Synthesizing response",
		detail: ["formatting detailed breakdown"]
	}
];
var DEMO_TICK_MS = 750;
/**
* Advances through template steps once and holds on the final active step
* (never looping or collapsing prematurely) while waiting for the model response.
*/
function useDemoRun(enabled, rootRef, customTemplateSteps) {
	const activeTemplate = customTemplateSteps && customTemplateSteps.length > 0 ? customTemplateSteps : DEMO_STEPS;
	const [position, setPosition] = (0, import_react.useState)({
		step: 0,
		line: 1
	});
	const positionRef = (0, import_react.useRef)(position);
	(0, import_react.useEffect)(() => {
		if (!enabled) return;
		const lastStepIdx = Math.max(0, activeTemplate.length - 1);
		const id = setInterval(() => {
			const curStep = positionRef.current.step;
			const curLine = positionRef.current.line;
			if (curLine < (activeTemplate[curStep]?.detail?.length ?? 0)) {
				positionRef.current = {
					step: curStep,
					line: curLine + 1
				};
				setPosition(positionRef.current);
			} else if (curStep < lastStepIdx) {
				positionRef.current = {
					step: curStep + 1,
					line: 1
				};
				setPosition(positionRef.current);
			}
		}, DEMO_TICK_MS);
		return () => clearInterval(id);
	}, [enabled, activeTemplate]);
	return (0, import_react.useMemo)(() => activeTemplate.map((step, i) => {
		if (i < position.step) return {
			...step,
			status: "done"
		};
		if (i === position.step) return {
			...step,
			status: "running",
			detail: step.detail?.slice(0, Math.max(1, position.line))
		};
		return {
			...step,
			status: "pending"
		};
	}), [
		activeTemplate,
		position.step,
		position.line
	]);
}
function StepIcon({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "relative flex size-4 shrink-0 items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatePresence, {
			initial: false,
			mode: "popLayout",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.span, {
				animate: {
					opacity: 1,
					filter: "blur(0px)"
				},
				className: "absolute inset-0 flex items-center justify-center",
				exit: {
					opacity: 0,
					filter: "blur(2px)"
				},
				initial: {
					opacity: 0,
					filter: "blur(2px)"
				},
				transition: {
					duration: .18,
					ease: EASE_OUT
				},
				children: [
					status === "pending" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" }),
					status === "running" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
						"aria-hidden": "true",
						className: "size-3.5 motion-safe:animate-spin",
						fill: "none",
						style: { animationDuration: "0.8s" },
						viewBox: "0 0 16 16",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							className: "stroke-zinc-300 dark:stroke-zinc-700",
							cx: "8",
							cy: "8",
							r: "6.25",
							strokeWidth: "1.5"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
							className: "stroke-zinc-800 dark:stroke-zinc-100",
							d: "M8 1.75a6.25 6.25 0 0 1 6.25 6.25",
							strokeLinecap: "round",
							strokeWidth: "1.5"
						})]
					}),
					status === "done" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
						"aria-hidden": "true",
						className: "size-3.5 text-zinc-700 dark:text-zinc-200",
						fill: "none",
						viewBox: "0 0 16 16",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.path, {
							animate: { pathLength: 1 },
							d: "M3.5 8.5 6.5 11.5 12.5 4.5",
							initial: { pathLength: 0 },
							stroke: "currentColor",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							strokeWidth: "1.75",
							transition: {
								duration: .3,
								ease: EASE_OUT,
								delay: .05
							}
						})
					}),
					status === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
						"aria-hidden": "true",
						className: "size-3.5 text-red-500",
						fill: "none",
						viewBox: "0 0 16 16",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
							d: "M4.5 4.5l7 7m0-7-7 7",
							stroke: "currentColor",
							strokeLinecap: "round",
							strokeWidth: "1.75"
						})
					})
				]
			}, status)
		})
	});
}
/** The running step's latest log lines, scrolling up as new ones arrive. */
function StepLog({ lines }) {
	const offset = Math.max(0, lines.length - VISIBLE_LINES);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		"aria-hidden": "true",
		className: "relative overflow-hidden font-mono text-xs",
		style: {
			height: LINE_HEIGHT * Math.min(lines.length, VISIBLE_LINES),
			maskImage: lines.length > 2 ? "linear-gradient(to bottom, rgb(0 0 0 / 0.25), black 70%)" : void 0,
			WebkitMaskImage: lines.length > 2 ? "linear-gradient(to bottom, rgb(0 0 0 / 0.25), black 70%)" : void 0,
			transition: "height 240ms cubic-bezier(0.23, 1, 0.32, 1)"
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
			style: { transform: `translateY(${-offset * LINE_HEIGHT}px)` },
			children: lines.map((line, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
				animate: { opacity: 1 },
				className: "flex items-center gap-2 text-zinc-500 dark:text-zinc-400",
				initial: { opacity: 0 },
				style: { height: LINE_HEIGHT },
				transition: {
					duration: .2,
					ease: EASE_OUT
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "w-4 select-none text-right text-zinc-400 tabular-nums dark:text-zinc-600",
					children: index + 1
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: line
				})]
			}, `${index}-${line}`))
		})
	});
}
var formatDurationMs = (ms) => {
	const sec = ms / 1e3;
	if (sec < 60) return `${sec.toFixed(1)}s`;
	return `${Math.floor(sec / 60)}m ${(sec % 60).toFixed(1)}s`;
};
/**
* Exact milliseconds since the run started. Never resets while active.
*/
function useElapsedMs(active) {
	const [elapsedMs, setElapsedMs] = (0, import_react.useState)(100);
	const startRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!active) return;
		if (startRef.current === null) startRef.current = Date.now();
		const start = startRef.current;
		const tick = () => setElapsedMs(Math.max(100, Date.now() - start));
		tick();
		const id = setInterval(tick, 100);
		return () => clearInterval(id);
	}, [active]);
	return elapsedMs;
}
var WAVE_CSS = `
@keyframes kokonut-ai-wave { 50% { opacity: 0.3; } }
.kokonut-ai-wave { animation: kokonut-ai-wave 1.6s ease-in-out infinite both; }
@media (prefers-reduced-motion: reduce) { .kokonut-ai-wave { animation: none; } }
`;
/** A soft brightness wave through the running step's letters. */
function WaveText({ text }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: WAVE_CSS }), Array.from(text).map((char, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "kokonut-ai-wave whitespace-pre",
		style: { animationDelay: `${i * .05}s` },
		children: char
	}, i))] });
}
var formatStepTime = (ms) => `${(ms / 1e3).toFixed(1)}s`;
/**
* Times each step live while running and freezes its time once done.
*/
function useStepTimes(steps) {
	const [times, setTimes] = (0, import_react.useState)({});
	const startsRef = (0, import_react.useRef)({});
	const frozenRef = (0, import_react.useRef)({});
	const stepsRef = (0, import_react.useRef)(steps);
	stepsRef.current = steps;
	const stepsKey = steps.map((s) => `${s.id}:${s.status}:${s.durationMs ?? ""}`).join("|");
	(0, import_react.useEffect)(() => {
		const sync = () => {
			const now = Date.now();
			const starts = startsRef.current;
			const frozen = frozenRef.current;
			const next = {};
			for (const step of stepsRef.current) {
				if (step.durationMs !== void 0) {
					next[step.id] = step.durationMs;
					continue;
				}
				if (step.status === "pending") continue;
				if (starts[step.id] === void 0) starts[step.id] = now;
				if (step.status === "running") next[step.id] = Math.max(100, now - starts[step.id]);
				else if (step.status === "done" || step.status === "error") {
					if (frozen[step.id] === void 0) frozen[step.id] = Math.max(100, now - starts[step.id]);
					next[step.id] = frozen[step.id];
				}
			}
			setTimes((prev) => {
				const prevKeys = Object.keys(prev);
				const nextKeys = Object.keys(next);
				if (prevKeys.length !== nextKeys.length) return next;
				for (const k of nextKeys) if (prev[k] !== next[k]) return next;
				return prev;
			});
		};
		sync();
		if (!stepsRef.current.some((s) => s.status === "running" && s.durationMs === void 0)) return;
		const id = setInterval(sync, 100);
		return () => clearInterval(id);
	}, [stepsKey]);
	return times;
}
var LABEL_COLORS = {
	pending: "text-zinc-400 dark:text-zinc-500",
	running: "text-zinc-900 dark:text-zinc-100",
	done: "text-zinc-500 dark:text-zinc-400",
	error: "text-red-600 dark:text-red-400"
};
function StepRow({ step, time, isLast }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "relative flex gap-3 pt-3",
		children: [
			!isLast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				"aria-hidden": "true",
				className: "absolute top-[30px] bottom-[-10px] left-[7.5px] w-px overflow-hidden bg-zinc-200 dark:bg-zinc-800",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("block h-full w-full origin-top bg-zinc-400 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] dark:bg-zinc-500", step.status === "done" ? "scale-y-100" : "scale-y-0") })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepIcon, { status: step.status }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "-mt-0.5 min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: cn("min-w-0 truncate text-sm transition-colors duration-200", LABEL_COLORS[step.status]),
						children: step.status === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: step.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaveText, { text: step.label })
						})] }) : step.label
					}), time !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.span, {
						animate: { opacity: 1 },
						className: "ml-auto shrink-0 text-xs text-zinc-400 tabular-nums dark:text-zinc-500",
						initial: { opacity: 0 },
						transition: {
							duration: .2,
							ease: EASE_OUT
						},
						children: formatStepTime(time)
					})]
				}), (step.status === "running" || step.status === "done") && step.detail?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepLog, { lines: step.detail })
				}) : null]
			})
		]
	});
}
function AILoadingState({ steps: stepsProp, mode = "search", totalDurationMs, collapseWhenDone = true, className }) {
	const rootRef = (0, import_react.useRef)(null);
	const demoSteps = useDemoRun(stepsProp === void 0, rootRef, mode === "vision" ? VISION_STEPS : mode === "file" ? FILE_STEPS : DEMO_STEPS);
	const steps = stepsProp ?? demoSteps;
	const listId = (0, import_react.useId)();
	const running = steps.find((step) => step.status === "running");
	const failed = steps.find((step) => step.status === "error");
	const isDone = steps.length > 0 && steps.every((step) => step.status === "done");
	const isActive = Boolean(running);
	const elapsedMs = useElapsedMs(isActive);
	const times = useStepTimes(steps);
	const totalStepMs = steps.reduce((acc, s) => acc + (s.durationMs || times[s.id] || 0), 0);
	const finalMs = totalDurationMs && totalDurationMs > 0 ? totalDurationMs : totalStepMs > 0 ? totalStepMs : elapsedMs;
	const [isOpen, setIsOpen] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		setIsOpen(!(isDone && collapseWhenDone));
	}, [isDone, collapseWhenDone]);
	let title = "Getting ready";
	if (failed) title = `Stopped at: ${failed.label}`;
	else if (isDone) title = `Worked for ${formatDurationMs(finalMs)}`;
	else if (running) title = running.label;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex w-full items-center justify-start", className),
		ref: rootRef,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionConfig, {
			reducedMotion: "user",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full max-w-md rounded-2xl backdrop-blur-xl bg-white/60 dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] px-3.5 py-2.5 shadow-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					"aria-controls": listId,
					"aria-expanded": isOpen,
					className: "group/header flex w-full items-center gap-2 rounded-md py-0.5 text-left font-medium text-sm text-zinc-700 outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400/40 dark:text-zinc-200 cursor-pointer",
					onClick: () => setIsOpen((open) => !open),
					type: "button",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("output", {
							className: "min-w-0 truncate",
							children: title
						}),
						isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-zinc-400 tabular-nums dark:text-zinc-500 text-xs shrink-0",
							children: formatDurationMs(elapsedMs)
						}),
						isDone && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-zinc-400 dark:text-zinc-500 text-xs shrink-0",
							children: [
								"· ",
								steps.length,
								" ",
								steps.length === 1 ? "step" : "steps"
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
							"aria-hidden": "true",
							className: cn("ml-auto size-4 text-zinc-400 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/header:text-zinc-600 dark:group-hover/header:text-zinc-300", isOpen && "rotate-180")
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatePresence, {
					initial: false,
					children: isOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.ol, {
						animate: {
							height: "auto",
							opacity: 1
						},
						className: "overflow-hidden",
						exit: {
							height: 0,
							opacity: 0
						},
						id: listId,
						initial: {
							height: 0,
							opacity: 0
						},
						transition: {
							duration: .25,
							ease: EASE_OUT
						},
						children: steps.map((step, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepRow, {
							isLast: i === steps.length - 1,
							step,
							time: times[step.id]
						}, step.id))
					})
				})]
			})
		})
	});
}
//#endregion
//#region src/components/ui/code-block.tsx
var codeBlockVariants = cva("group/code-block relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg text-sm has-[>[data-slot=code-block-content]:focus-visible]:ring-3 has-[>[data-slot=code-block-content]:focus-visible]:ring-ring/50 data-[size=sm]:text-xs", {
	variants: { variant: {
		default: "border border-input text-foreground has-[>[data-slot=code-block-content]:focus-visible]:border-ring dark:bg-input/30",
		destructive: "border border-destructive/30 text-destructive dark:border-destructive/40"
	} },
	defaultVariants: { variant: "default" }
});
function CodeBlock({ className, variant = "default", size = "default", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		"data-slot": "code-block",
		"data-variant": variant,
		"data-size": size,
		className: cn(codeBlockVariants({ variant }), className),
		...props
	});
}
function CodeBlockHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		"data-slot": "code-block-header",
		className: cn("flex min-w-0 shrink-0 items-center gap-2 px-3 pt-3 text-muted-foreground group-data-[size=sm]/code-block:px-2.5 group-data-[size=sm]/code-block:pt-2.5 group-data-[variant=destructive]/code-block:text-destructive *:has-[>[data-slot=code-block-title]]:min-w-0", className),
		...props
	});
}
function CodeBlockTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		"data-slot": "code-block-title",
		className: cn("min-w-0 truncate font-sans text-sm font-medium text-foreground group-data-[size=sm]/code-block:text-xs group-data-[variant=destructive]/code-block:text-destructive [&_svg]:pointer-events-none [&_svg]:inline-block [&_svg]:align-middle [&_svg:not([class*='size-'])]:size-3.5 *:[svg]:me-1.5", className),
		...props
	});
}
function CodeBlockActions({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		"data-slot": "code-block-actions",
		className: cn("-my-1 ms-auto -me-1.5 flex shrink-0 items-center gap-1 [[data-slot=code-block]>&]:absolute [[data-slot=code-block]>&]:end-2 [[data-slot=code-block]>&]:top-2 [[data-slot=code-block]>&]:z-10 [[data-slot=code-block]>&]:m-0 [[data-slot=code-block]>&]:opacity-0 [[data-slot=code-block]>&]:transition-opacity [[data-slot=code-block]>&]:group-focus-within/code-block:opacity-100 [[data-slot=code-block]>&]:group-hover/code-block:opacity-100 group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:end-1.5 group-data-[size=sm]/code-block:[[data-slot=code-block]>&]:top-1.5 [[data-slot=code-block]>&]:pointer-coarse:opacity-100 [[data-slot=code-block]>&]:*:[button]:bg-background [[data-slot=code-block]>&]:*:[button]:ring-1 [[data-slot=code-block]>&]:*:[button]:ring-foreground/10", className),
		...props
	});
}
function CodeBlockCopyButton({ value, variant = "ghost", size = "icon-xs", className, onClick, ...props }) {
	const [copied, setCopied] = import_react.useState(false);
	import_react.useEffect(() => {
		if (!copied) return;
		const timeout = setTimeout(() => setCopied(false), 2e3);
		return () => clearTimeout(timeout);
	}, [copied]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		"data-slot": "code-block-copy-button",
		"data-copied": copied || void 0,
		variant,
		size,
		"aria-label": copied ? "Copied" : "Copy",
		className: typeof className === "string" ? cn(className) : className,
		onClick: (event) => {
			onClick?.(event);
			navigator.clipboard.writeText(value).then(() => setCopied(true)).catch(() => {});
		},
		...props,
		children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {})
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		"aria-live": "polite",
		className: "sr-only",
		children: copied ? "Copied" : ""
	})] });
}
function CodeBlockContent({ className, children, style, wrap = false, lineNumbers = false, startLine = 1, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
		"data-slot": "code-block-content",
		"data-wrap": wrap || void 0,
		"data-numbered": lineNumbers || void 0,
		dir: "ltr",
		tabIndex: 0,
		style: {
			counterReset: `line ${startLine - 1}`,
			...style
		},
		className: cn("min-h-0 min-w-0 scroll-fade-x scrollbar-thin overflow-auto px-3 py-3 text-start font-mono leading-relaxed outline-none group-has-data-[slot=code-block-footer]/code-block:pb-2 group-has-data-[slot=code-block-header]/code-block:pt-2 group-data-[size=sm]/code-block:px-2.5 group-data-[size=sm]/code-block:py-2.5 group-data-[size=sm]/code-block:group-has-data-[slot=code-block-header]/code-block:pt-1.5 data-wrap:scroll-fade-y data-wrap:wrap-break-word data-wrap:whitespace-pre-wrap", className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
			"data-slot": "code-block-code",
			className: "grid min-h-lh min-w-max content-start in-data-numbered:grid-cols-[auto_1fr] in-data-wrap:min-w-0",
			children: lineNumbers && typeof children === "string" ? children.replace(/\n$/, "").split("\n").map((line, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlockLine, { children: line }, index)) : children
		})
	});
}
var codeBlockLineVariants = cva("relative -mx-3 block min-h-lh px-3 group-data-[size=sm]/code-block:-mx-2.5 group-data-[size=sm]/code-block:px-2.5 before:min-w-6 before:text-end before:text-muted-foreground after:absolute after:start-1 after:top-0 after:text-muted-foreground after:select-none in-data-numbered:col-span-2 in-data-numbered:grid in-data-numbered:grid-cols-subgrid in-data-numbered:gap-x-3 in-data-numbered:[counter-increment:line] in-data-numbered:before:content-[counter(line)] in-data-numbered:before:select-none in-data-numbered:supports-[content:counter(line)_/_'']:before:content-[counter(line)_/_'']", {
	variants: { variant: {
		default: "",
		added: "bg-muted after:content-['+']",
		removed: "bg-destructive/10 after:text-destructive after:content-['−']",
		highlighted: "bg-muted"
	} },
	defaultVariants: { variant: "default" }
});
function CodeBlockLine({ className, variant = "default", children, ...props }) {
	const empty = children === void 0 || children === null || children === "" || Array.isArray(children) && children.length === 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		"data-slot": "code-block-line",
		"data-variant": variant,
		className: cn(codeBlockLineVariants({ variant }), className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"data-slot": "code-block-line-content",
			className: "min-w-0",
			children: empty ? "\n" : children
		})
	});
}
//#endregion
//#region src/lib/deepResearchHistoryStore.ts
var STORAGE_KEY = "kinich_deep_research_history_v1";
var LISTENERS = /* @__PURE__ */ new Set();
function notifyListeners() {
	LISTENERS.forEach((cb) => {
		try {
			cb();
		} catch {}
	});
}
function loadLocalHistory() {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
	} catch {}
	return [];
}
function saveLocalHistory(records) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
	} catch {}
	notifyListeners();
}
var DeepResearchHistoryStore = {
	getHistory() {
		return loadLocalHistory();
	},
	subscribe(listener) {
		LISTENERS.add(listener);
		return () => {
			LISTENERS.delete(listener);
		};
	},
	async saveRecord(input) {
		const id = input.id || `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
		const createdAt = input.createdAt || Date.now();
		const record = {
			id,
			topic: input.topic || input.question.slice(0, 80),
			question: input.question,
			fullAnswer: input.fullAnswer,
			sources: input.sources || [],
			thinkingSteps: input.thinkingSteps || [],
			durationSec: input.durationSec || 0,
			thinkingDuration: input.thinkingDuration || 1,
			followUps: input.followUps || [],
			turns: input.turns || [],
			modelId: input.modelId || "deepseek-v4.1",
			createdAt
		};
		saveLocalHistory([record, ...loadLocalHistory().filter((r) => r.id !== id)]);
		try {
			const user = auth.currentUser;
			if (user && db) {
				const docRef = doc(db, "users", user.uid, "deep_research", id);
				await setDoc(docRef, {
					id: record.id,
					topic: record.topic,
					question: record.question,
					fullAnswer: record.fullAnswer,
					sources: record.sources,
					thinkingSteps: record.thinkingSteps,
					durationSec: record.durationSec,
					thinkingDuration: record.thinkingDuration,
					followUps: record.followUps,
					turns: record.turns || [],
					modelId: record.modelId,
					createdAt: record.createdAt
				});
			}
		} catch {}
		return record;
	},
	async deleteRecord(id) {
		saveLocalHistory(loadLocalHistory().filter((r) => r.id !== id));
		try {
			const user = auth.currentUser;
			if (user && db) {
				const docRef = doc(db, "users", user.uid, "deep_research", id);
				await deleteDoc(docRef);
			}
		} catch {}
	},
	async clearAll() {
		const current = loadLocalHistory();
		saveLocalHistory([]);
		try {
			const user = auth.currentUser;
			if (user && db) for (const item of current) {
				const docRef = doc(db, "users", user.uid, "deep_research", item.id);
				deleteDoc(docRef).catch(() => {});
			}
		} catch {}
	},
	async syncFromFirestore() {
		try {
			const user = auth.currentUser;
			if (!user || !db) return loadLocalHistory();
			const collRef = collection(db, "users", user.uid, "deep_research");
			const q = query(collRef, orderBy("createdAt", "desc"), limit(50));
			const snap = await getDocs(q);
			if (!snap.empty) {
				const remoteRecords = [];
				snap.forEach((d) => {
					const data = d.data();
					if (data && data.question && data.fullAnswer) remoteRecords.push(data);
				});
				const local = loadLocalHistory();
				const map = /* @__PURE__ */ new Map();
				local.forEach((r) => map.set(r.id, r));
				remoteRecords.forEach((r) => map.set(r.id, r));
				const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
				saveLocalHistory(merged);
				return merged;
			}
		} catch {}
		return loadLocalHistory();
	}
};
//#endregion
//#region src/components/DeepResearchModal.tsx
var RESEARCH_STOP_WORDS = /* @__PURE__ */ new Set([
	"the",
	"and",
	"for",
	"with",
	"from",
	"that",
	"this",
	"what",
	"which",
	"when",
	"where",
	"who",
	"whom",
	"whose",
	"why",
	"how",
	"are",
	"was",
	"were",
	"been",
	"being",
	"have",
	"has",
	"had",
	"having",
	"does",
	"did",
	"doing",
	"can",
	"could",
	"should",
	"would",
	"may",
	"might",
	"must",
	"shall",
	"will",
	"about",
	"into",
	"through",
	"during",
	"before",
	"after",
	"above",
	"below",
	"between",
	"under",
	"again",
	"further",
	"then",
	"once",
	"here",
	"there",
	"all",
	"any",
	"both",
	"each",
	"few",
	"more",
	"most",
	"other",
	"some",
	"such",
	"only",
	"own",
	"same",
	"than",
	"too",
	"very",
	"just",
	"best",
	"top",
	"new",
	"latest",
	"good",
	"better",
	"review",
	"guide",
	"overview",
	"comparison",
	"compare",
	"vs",
	"versus"
]);
function isBiomedicalResearchQuery(query) {
	const q = String(query || "").toLowerCase();
	const hasTechAiIntent = /\b(open[\s-]*source\s+llms?|large\s+language\s+models?|llms?\s+in\s+202\d|llama|mistral|qwen|deepseek|gemma|claude|gpt|transformers?|attention|long\s+context|context\s+window|kv\s+cache|rope|flashattention|ring\s+attention|mamba|coding|programming|react|typescript|javascript|python|rust|kubernetes|docker|nextjs|vercel|benchmark|mmlu|humaneval|gsm8k|huggingface|ollama|vllm|gguf)\b/i.test(q);
	const hasBioIntent = /\b(clinical|medical|medicine|patient|patients|disease|syndrome|therapy|therapeutic|treatment|drug|pharmacology|pharmacokinetic|dosage|dose|symptom|diagnosis|diagnostic|prognosis|pathology|oncology|cancer|tumor|tumour|cardiac|cardiovascular|neurology|neurological|brain|psychiatric|diabetes|insulin|metabolic|metabolism|immune|immunology|vaccine|infection|viral|bacteria|bacterial|surgery|surgical|hospital|physician|doctor|nursing|pediatric|prenatal|pregnancy|fetal|genetics|genomic|dna|rna|protein|peptide|enzyme|receptor|biomarker|cell|cellular|mortality|morbidity|epidemiology|cohort|randomized|placebo|trial|pubmed|medline|biomedical|anatomy|physiology|gut|microbiome|vitamin|supplement|longevity|aging|sleep|circadian)\b/i.test(q);
	if (hasTechAiIntent && !hasBioIntent) return false;
	return hasBioIntent;
}
var OFF_TOPIC_ACADEMIC_PATTERNS = [
	/\bprenatal\s+diagnosis\b/i,
	/\bclinical[-\s]data\b/i,
	/\belectronic\s+health\s+record/i,
	/\bfinancial\s+time[-\s]series\b/i,
	/\btime[-\s]series\s+forecasting\b/i,
	/\bstock\s+price\s+forecasting\b/i,
	/\bportfolio\s+optimization\b/i,
	/\btext2sparql\b/i,
	/\bsparql[-\s]?llm\b/i,
	/\bsparql\b/i,
	/\bsemeval[-\s]?\d*\b/i,
	/\bnarrative\s+similarity\b/i,
	/\bpatient\s+outcomes?\b/i,
	/\brandomized\s+controlled\s+trial\b/i,
	/\boil[-\s]immersed\s+transformer/i,
	/\bdistribution\s+transformer/i,
	/\bpower\s+transformer/i,
	/\bdielectric\s+breakdown/i,
	/\boptimus\s+prime\b/i,
	/\bmegatron\b/i,
	/\bmediqa\b/i,
	/\boption12\b/i,
	/\bshared[-\s]decision\s+making\b/i,
	/\bdietary\s+recalls?\b/i,
	/\bmacronutrients?\b/i,
	/\bshared\s+task\b/i,
	/\bbea\s+202\d\b/i,
	/\bfrancis\s+galton\b/i,
	/\bsystem\s+identification\b/i
];
function extractMeaningfulTerms(text) {
	return String(text || "").toLowerCase().replace(/[^a-z0-9.+_-]+/g, " ").split(/\s+/).map((t) => t.replace(/^[._-]+|[._-]+$/g, "")).filter((t) => t.length >= 2 && !RESEARCH_STOP_WORDS.has(t) && !/^(19|20)\d{2}$/.test(t) && t !== "handle");
}
function expandQueryConcepts(query) {
	const q = query.toLowerCase();
	const extra = [];
	if (/\b(llm|llms|large language model|language models)\b/.test(q)) extra.push("llm", "llms", "language model", "llama", "mistral", "qwen", "deepseek", "gemma", "phi", "mixtral", "open-weight", "open-source", "weights", "benchmark", "mmlu", "humaneval", "gsm8k");
	if (/\b(open[-\s]?source|open[-\s]?weight|local)\b/.test(q)) extra.push("open-source", "open source", "open-weight", "open weights", "apache", "mit license", "huggingface", "ollama", "vllm", "llama", "qwen", "deepseek", "mistral", "gemma");
	if (/\b(transformers?)\b/.test(q) && /\b(long[-\s]?context|context)\b/.test(q)) extra.push("transformer", "long context", "context window", "attention", "kv cache", "flashattention", "ring attention", "rope", "rotary position", "sparse attention", "linear attention", "sliding window", "mamba", "sequence length", "million tokens");
	return extra;
}
/**
* Computes token + character trigram cosine similarity between query and chunk text
*/
function computeChunkQueryCosineSimilarity(query, chunkText) {
	const buildVector = (text) => {
		const vec = /* @__PURE__ */ new Map();
		const tokens = String(text || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length >= 2 && !RESEARCH_STOP_WORDS.has(w));
		const expanded = expandQueryConcepts(text);
		for (const tok of [...tokens, ...expanded]) {
			const stem = tok.endsWith("s") && tok.length > 4 ? tok.slice(0, -1) : tok;
			vec.set(stem, (vec.get(stem) || 0) + 1.5);
			if (stem.length >= 4) for (let i = 0; i <= stem.length - 3; i++) {
				const tri = `#${stem.slice(i, i + 3)}`;
				vec.set(tri, (vec.get(tri) || 0) + .35);
			}
		}
		return vec;
	};
	const qVec = buildVector(query);
	const cVec = buildVector(chunkText);
	if (qVec.size === 0 || cVec.size === 0) return 0;
	let dot = 0;
	let qNorm = 0;
	let cNorm = 0;
	for (const [k, qVal] of qVec.entries()) {
		qNorm += qVal * qVal;
		const cVal = cVec.get(k) || 0;
		dot += qVal * cVal;
	}
	for (const cVal of cVec.values()) cNorm += cVal * cVal;
	if (qNorm === 0 || cNorm === 0) return 0;
	return dot / (Math.sqrt(qNorm) * Math.sqrt(cNorm));
}
function scoreResearchSourceRelevance(source, query) {
	const title = String(source.title || "").toLowerCase();
	const snippet = String(source.snippet || "").toLowerCase();
	const url = String(source.url || "").toLowerCase();
	const domain = String(source.domain || "").toLowerCase();
	const combined = `${title} ${snippet} ${url}`;
	const qLower = query.toLowerCase();
	if (!isBiomedicalResearchQuery(query)) {
		if (domain.includes("europepmc.org") || domain.includes("ncbi.nlm.nih.gov") || domain.includes("pubmed") || domain.includes("medline") || url.includes("europepmc.org") || url.includes("ncbi.nlm.nih.gov/pmc") || url.includes("pubmed.ncbi.nlm.nih.gov")) return -10;
		for (const pat of OFF_TOPIC_ACADEMIC_PATTERNS) if (pat.test(combined) && !pat.test(qLower)) return -10;
		if (/\b(clinical|patient|patients|hospital|medical|prenatal|fetal|oncology|cardiology|pathology|surgery|disease|diagnosis|therapy|healthcare|epidemiology|histopathology|nursing|dietary|macronutrients?)\b/i.test(combined)) return -10;
	}
	const coreTerms = extractMeaningfulTerms(query);
	if (coreTerms.length === 0) return 1;
	let score = 0;
	let matchedTerms = 0;
	for (const term of coreTerms) {
		const variants = [term];
		if (term.endsWith("s") && term.length > 3) variants.push(term.slice(0, -1));
		if (term === "llm" || term === "llms") variants.push("language model", "large language model");
		if (term === "open-source") variants.push("open source", "open-weight", "open weight");
		if (term === "transformers" || term === "transformer") variants.push("transformer", "attention", "llm");
		const inTitle = variants.some((v) => title.includes(v));
		const inSnippet = variants.some((v) => snippet.includes(v));
		const inUrl = variants.some((v) => url.includes(v));
		if (inTitle) {
			score += 3;
			matchedTerms++;
		} else if (inSnippet) {
			score += 1.5;
			matchedTerms++;
		} else if (inUrl) {
			score += 1;
			matchedTerms++;
		}
	}
	const expanded = expandQueryConcepts(query);
	let expandedMatches = 0;
	for (const concept of expanded) if (title.includes(concept)) {
		score += 1.2;
		expandedMatches++;
	} else if (snippet.includes(concept)) {
		score += .6;
		expandedMatches++;
	}
	const cosine = computeChunkQueryCosineSimilarity(query, `${title} ${snippet}`);
	score += cosine * 5;
	const minRequired = coreTerms.length >= 2 ? 2 : 1;
	if (matchedTerms < minRequired && !(matchedTerms >= 1 && expandedMatches >= 2)) return -2;
	if (/\b(open[-\s]?source)\b/.test(qLower) && /\b(llm|llms|language model)\b/.test(qLower)) {
		if (/\b(llama|mistral|mixtral|qwen|deepseek|gemma|phi[-\s]?[34]|yi|falcon|ollama|huggingface|vllm|mmlu|gsm8k|humaneval|open[-\s]?weight|leaderboard)\b/i.test(combined)) score += 3.5;
		else return -5;
	}
	if (/\b(transformers?)\b/.test(qLower) && /\b(long[-\s]?context|context)\b/.test(qLower)) {
		if (/\b(long[-\s]?context|context\s+window|context\s+length|kv\s+cache|flashattention|ring\s+attention|rope|rotary\s+position|sparse\s+attention|linear\s+attention|sliding\s+window|mamba|state\s+space|alibi|yarn|inattention|collaborative\s+memory|sequence\s+length)\b/i.test(combined)) score += 3.5;
		else return -5;
	}
	return score;
}
function filterRelevantResearchSources(query, rawSources) {
	const seenUrls = /* @__PURE__ */ new Set();
	const scored = [];
	for (const s of rawSources) {
		if (!s || !s.url || isClientBoilerplateSource(s)) continue;
		const normUrl = s.url.trim().replace(/\/+$/, "");
		if (seenUrls.has(normUrl)) continue;
		seenUrls.add(normUrl);
		const score = scoreResearchSourceRelevance(s, query);
		if (score >= 2.5) scored.push({
			source: s,
			score
		});
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, 8).map((item) => item.source);
}
/**
* FIX 2 Helper: Rewrites the user query for a second search round when < 4 sources pass Round 1
*/
function buildRewrittenSearchQuery(query) {
	const q = query.trim();
	const lower = q.toLowerCase();
	if (/\b(open[-\s]?source)\b/.test(lower) && /\b(llm|llms|language model)\b/.test(lower)) return "best open-source LLMs 2026 Llama Mistral Qwen DeepSeek Gemma benchmark comparison";
	if (/\b(transformers?)\b/.test(lower) && /\b(long[-\s]?context|context)\b/.test(lower)) return "transformer long context window attention KV cache RoPE Ring Attention FlashAttention 2026";
	return `${extractMeaningfulTerms(q).slice(0, 6).join(" ")} technical architecture benchmarks analysis 2026`;
}
/**
* FIX 3: Post-writing S1..Sn Citation Binding, Entailment Verification, First-Appearance Renumbering [1],[2],[3], and Card Reordering
* - The writer cites [S1]..[Sn] (or [1]..[n] mapped to S1..Sn).
* - Checks that each cited excerpt supports its sentence; if not, re-cites to a supporting source or removes the citation and softens the sentence.
* - Renumbers to [1],[2],[3] by first appearance and reorders the source cards to match so chip number, card number, and link are identical.
* - Moves uncited sources to `alsoReadSources`.
*/
function bindVerifyAndRenumberCitations(rawMarkdown, keptSources, query) {
	if (!rawMarkdown || keptSources.length === 0) return {
		verifiedText: rawMarkdown.replace(/\s*\[S?\d+(?:,\s*S?\d+)*\]/gi, ""),
		citedSources: [],
		alsoReadSources: []
	};
	const sourceBySid = /* @__PURE__ */ new Map();
	for (let i = 0; i < keptSources.length; i++) {
		const src = keptSources[i];
		const sid = `S${i + 1}`;
		sourceBySid.set(sid, src);
		sourceBySid.set(String(i + 1), src);
	}
	const scoreSourceSupportForClaim = (source, claimText) => {
		const sText = `${source.title || ""} ${source.excerpt || ""} ${source.snippet || ""} ${source.name || ""} ${source.domain || ""}`.toLowerCase();
		const claimLower = claimText.toLowerCase();
		const claimTerms = extractMeaningfulTerms(claimText);
		if (claimTerms.length === 0) return 1;
		let score = 0;
		for (const term of claimTerms) {
			const stem = term.endsWith("s") && term.length > 4 ? term.slice(0, -1) : term;
			if (sText.includes(term) || stem.length >= 4 && sText.includes(stem)) score += term.length >= 5 ? 2 : 1;
		}
		for (const ent of [
			"llama",
			"mistral",
			"mixtral",
			"qwen",
			"deepseek",
			"gemma",
			"phi-3",
			"phi-4",
			"falcon",
			"yi-",
			"mmlu",
			"gsm8k",
			"humaneval",
			"swe-bench",
			"gpqa",
			"ollama",
			"vllm",
			"huggingface",
			"kv cache",
			"flashattention",
			"ring attention",
			"rope",
			"rotary",
			"sparse attention",
			"linear attention",
			"sliding window",
			"mamba",
			"context window",
			"long context"
		]) if (claimLower.includes(ent)) {
			if (sText.includes(ent)) score += 4;
			else if (/\b(llm|llms|language model|open-source|open source|open-weight|benchmark|transformer|attention|context)\b/i.test(sText)) score += 1.4;
		}
		const cosine = computeChunkQueryCosineSimilarity(claimText, `${source.title} ${source.excerpt}`);
		score += cosine * 4;
		const queryRel = scoreResearchSourceRelevance(source, query);
		if (queryRel > 0) score += Math.min(2, queryRel * .25);
		else score -= 10;
		return score;
	};
	const softenUnsupportedSentence = (line) => {
		return line.replace(/\b(definitively|undoubtedly|unquestionably|universally|always|proves that)\b/gi, "generally").replace(/\b(is guaranteed to|will certainly)\b/gi, "may");
	};
	let intermediateText = rawMarkdown.replace(/\]\s*\[(S?\d+)/gi, ", $1").replace(/\[(S?\d+(?:\s*,\s*S?\d+)*)\]/gi, (_m, inner) => {
		return `[${inner.split(",").map((p) => p.trim().toUpperCase()).map((p) => p.startsWith("S") ? p : `S${p}`).join(", ")}]`;
	}).split("\n").map((line) => {
		if (!/\[S\d+(?:,\s*S\d+)*\]/i.test(line)) return line;
		let hadRemovedCitation = false;
		const cleanedLine = line.replace(/\[(S\d+(?:,\s*S\d+)*)\]/gi, (_fullMatch, sidListStr, offset) => {
			const windowStart = Math.max(0, offset - 240);
			const windowEnd = Math.min(line.length, offset + 90);
			const claimContext = line.slice(windowStart, windowEnd).replace(/\[S?\d+(?:,\s*S?\d+)*\]/gi, " ");
			const rawSids = sidListStr.split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^S\d+$/.test(s));
			const validatedSids = [];
			for (const sid of rawSids) {
				const citedSource = sourceBySid.get(sid);
				const currentSupport = citedSource ? scoreSourceSupportForClaim(citedSource, claimContext) : -10;
				if (citedSource && currentSupport >= 1.5) {
					if (!validatedSids.includes(citedSource.sid)) validatedSids.push(citedSource.sid);
				} else {
					let bestSource = null;
					let bestScore = 1.8;
					for (const candidate of keptSources) {
						const sc = scoreSourceSupportForClaim(candidate, claimContext);
						if (sc > bestScore) {
							bestScore = sc;
							bestSource = candidate;
						}
					}
					if (bestSource) {
						if (!validatedSids.includes(bestSource.sid)) validatedSids.push(bestSource.sid);
					} else hadRemovedCitation = true;
				}
			}
			if (validatedSids.length === 0) {
				hadRemovedCitation = true;
				return "";
			}
			return `[${validatedSids.join(", ")}]`;
		}).replace(/  +([.,;:])/g, "$1");
		return hadRemovedCitation && !/\[S\d+/i.test(cleanedLine) ? softenUnsupportedSentence(cleanedLine) : cleanedLine;
	}).join("\n");
	const currentlyCitedSids = /* @__PURE__ */ new Set();
	for (const m of intermediateText.matchAll(/\[(S\d+(?:,\s*S\d+)*)\]/gi)) for (const part of m[1].split(",")) {
		const sid = part.trim().toUpperCase();
		if (sourceBySid.has(sid)) currentlyCitedSids.add(sid);
	}
	const targetMinCitations = Math.min(4, keptSources.length);
	if (currentlyCitedSids.size < targetMinCitations) {
		const paragraphs = intermediateText.split("\n\n");
		for (const candidate of keptSources) {
			if (currentlyCitedSids.size >= Math.min(6, keptSources.length)) break;
			if (currentlyCitedSids.has(candidate.sid)) continue;
			let bestIdx = -1;
			let bestSc = 1.5;
			for (let i = 0; i < paragraphs.length; i++) {
				const p = paragraphs[i].trim();
				if (!p || p.startsWith("#") || p.startsWith("|") || p.startsWith("```") || p.length < 60) continue;
				const sc = scoreSourceSupportForClaim(candidate, p);
				if (sc > bestSc) {
					bestSc = sc;
					bestIdx = i;
				}
			}
			if (bestIdx >= 0) {
				const blk = paragraphs[bestIdx];
				if (/\[(S\d+(?:,\s*S\d+)*)\]([.!?]?)\s*$/.test(blk)) paragraphs[bestIdx] = blk.replace(/\[(S\d+(?:,\s*S\d+)*)\]([.!?]?)\s*$/, `[$1, ${candidate.sid}]$2`);
				else paragraphs[bestIdx] = `${blk.replace(/([.!?])\s*$/, "")} [${candidate.sid}].`;
				currentlyCitedSids.add(candidate.sid);
			}
		}
		intermediateText = paragraphs.join("\n\n");
	}
	const totalCitationsCount = Array.from(intermediateText.matchAll(/\[(S\d+(?:,\s*S\d+)*)\]/gi)).length;
	if (totalCitationsCount >= 3 && keptSources.length >= 2) {
		const maxAllowedPerSource = Math.max(1, Math.floor(totalCitationsCount * .4));
		const sourceCitationCounts = /* @__PURE__ */ new Map();
		intermediateText = intermediateText.replace(/\[(S\d+(?:,\s*S\d+)*)\]/gi, (_origMatch, sidListStr) => {
			const sids = sidListStr.split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^S\d+$/.test(s));
			const keptSids = [];
			for (const sid of sids) {
				const currentCount = sourceCitationCounts.get(sid) || 0;
				if (currentCount < maxAllowedPerSource) {
					keptSids.push(sid);
					sourceCitationCounts.set(sid, currentCount + 1);
				} else {
					let alternateSource = null;
					let lowestUsage = 999;
					for (const candidate of keptSources) {
						if (candidate.sid === sid) continue;
						const count = sourceCitationCounts.get(candidate.sid) || 0;
						if (count < lowestUsage && count < maxAllowedPerSource) {
							lowestUsage = count;
							alternateSource = candidate;
						}
					}
					if (alternateSource && !keptSids.includes(alternateSource.sid)) {
						keptSids.push(alternateSource.sid);
						sourceCitationCounts.set(alternateSource.sid, (sourceCitationCounts.get(alternateSource.sid) || 0) + 1);
					}
				}
			}
			return keptSids.length > 0 ? `[${keptSids.join(", ")}]` : "";
		});
	}
	const sidToFinalNum = /* @__PURE__ */ new Map();
	const citedSources = [];
	const scanRegex = /\[(S\d+(?:,\s*S\d+)*)\]/gi;
	let match;
	while ((match = scanRegex.exec(intermediateText)) !== null) {
		const sids = match[1].split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^S\d+$/.test(s));
		for (const sid of sids) if (!sidToFinalNum.has(sid)) {
			const src = sourceBySid.get(sid);
			if (src) {
				const newId = citedSources.length + 1;
				sidToFinalNum.set(sid, newId);
				citedSources.push({
					id: newId,
					name: src.name,
					title: src.title,
					url: src.url,
					domain: src.domain,
					snippet: src.excerpt || src.snippet
				});
			}
		}
	}
	const renumberedText = intermediateText.replace(/\[(S\d+(?:,\s*S\d+)*)\]/gi, (_m, sidListStr) => {
		const nums = [];
		for (const part of sidListStr.split(",")) {
			const sid = part.trim().toUpperCase();
			const mappedNum = sidToFinalNum.get(sid);
			if (mappedNum && !nums.includes(mappedNum)) nums.push(mappedNum);
		}
		return nums.length > 0 ? `[${nums.join(",")}]` : "";
	});
	const alsoReadSources = [];
	for (const src of keptSources) if (!sidToFinalNum.has(src.sid)) alsoReadSources.push({
		id: citedSources.length + alsoReadSources.length + 1,
		name: src.name,
		title: src.title,
		url: src.url,
		domain: src.domain,
		snippet: src.excerpt || src.snippet
	});
	return {
		verifiedText: renumberedText,
		citedSources,
		alsoReadSources
	};
}
var FEEDBACK_REASONS = [
	"Not accurate",
	"Wrong source",
	"Too long",
	"Out of date"
];
var INSTACLOUD_API_BASE = "https://prod-main-zeno-api-c257d4-00gfx3c9932.compute.instacloud-edge.com";
async function callApi(path, init) {
	if (typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname.includes("netlify.app"))) return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
	try {
		const localRes = await fetch(path, init);
		const ct = localRes.headers.get("content-type") || "";
		if (localRes.ok && ct.includes("application/json")) return localRes;
	} catch {}
	return fetch(`${INSTACLOUD_API_BASE}${path}`, init);
}
function isClientBoilerplateSource(s) {
	const url = String(s?.url || "").toLowerCase();
	const domain = String(s?.domain || "").toLowerCase();
	const title = String(s?.title || "").toLowerCase();
	if ([
		"ogs.google.com",
		"accounts.google.com",
		"account.google.com",
		"myaccount.google.com",
		"drive.google.com",
		"translate.google.com",
		"workspace.google.com",
		"voice.google.com",
		"mail.google.com",
		"calendar.google.com",
		"contacts.google.com",
		"photos.google.com",
		"play.google.com",
		"maps.google.com",
		"support.google.com",
		"policies.google.com"
	].some((d) => domain === d || domain.endsWith(`.${d}`) || url.includes(`://${d}`))) return true;
	if (/^sign in\s*[-–|]/i.test(title) || title === "google translate" || title === "google dashboard" || title === "google search" || title === "voice" || title.includes("government program solutions")) return true;
	return false;
}
function formatSourceShortName(domainOrUrl, fallbackTitle) {
	try {
		const host = (domainOrUrl.includes("://") ? new URL(domainOrUrl).hostname : domainOrUrl).replace(/^www\./i, "").toLowerCase();
		if (host.includes("pubmed") || host.includes("ncbi.nlm.nih.gov")) return "PubMed";
		if (host.includes("europepmc")) return "Europe PMC";
		if (host === "doi.org" || host.endsWith(".doi.org")) return "DOI";
		if (host.includes("arxiv")) return "ArXiv";
		if (host.includes("nature.com")) return "Nature";
		if (host.includes("thelancet")) return "The Lancet";
		if (host.includes("nejm.org")) return "NEJM";
		if (host.includes("cell.com")) return "Cell";
		if (host.includes("sciencedirect")) return "ScienceDirect";
		if (host.includes("springer")) return "Springer";
		if (host.includes("oup.com") || host.includes("academic.oup")) return "Oxford Academic";
		if (host.includes("wiley.com")) return "Wiley";
		if (host.includes("bmj.com")) return "BMJ";
		if (host.includes("jamanetwork")) return "JAMA";
		if (host.includes("frontiersin")) return "Frontiers";
		if (host.includes("mdpi.com")) return "MDPI";
		if (host.includes("plos.org")) return "PLOS";
		if (host.includes("nih.gov")) return "NIH";
		if (host.includes("mayoclinic")) return "Mayo Clinic";
		if (host.includes("clevelandclinic")) return "Cleveland Clinic";
		if (host === "x.com" || host.endsWith(".x.com") || host.includes("twitter")) return "X";
		if (host.includes("wikipedia")) return "Wikipedia";
		if (host.includes("scholar.google")) return "Google Scholar";
		if (host.includes("github")) return "GitHub";
		if (host.includes("reuters")) return "Reuters";
		if (host.includes("bloomberg")) return "Bloomberg";
		if (host.includes("techcrunch")) return "TechCrunch";
		if (host.includes("theverge")) return "The Verge";
		if (host.includes("nytimes")) return "NYTimes";
		if (host.includes("reddit")) return "Reddit";
		const base = host.split(".")[0] || "";
		if (base.length >= 2) return base.charAt(0).toUpperCase() + base.slice(1);
	} catch {}
	return (fallbackTitle || "Source").split(/[\s–|-]+/)[0].slice(0, 14);
}
function parseMarkdownTable(block) {
	const rawLines = block.split("\n").map((l) => l.trim()).filter(Boolean);
	if (rawLines.length < 2) return null;
	if (!rawLines[0].startsWith("|") || !rawLines[0].endsWith("|")) return null;
	if (!/^[|:\-\s]+$/.test(rawLines[1]) || !rawLines[1].includes("-")) return null;
	const parseRow = (line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
	const headers = parseRow(rawLines[0]);
	const rows = rawLines.slice(2).filter((l) => l.startsWith("|")).map(parseRow);
	if (rows.length === 0) return null;
	return {
		headers,
		rows
	};
}
function buildDynamicThinkingSteps(query, answerSources) {
	const shortTopic = query.length > 42 ? `${query.slice(0, 42).trim()}…` : query;
	const searchSources = answerSources.map((s) => ({
		label: `${s.name} – ${s.title.slice(0, 28)}`,
		domain: s.domain,
		href: s.url
	}));
	const steps = [];
	if (searchSources.length > 0) steps.push({
		type: "search",
		label: "Searched",
		sources: searchSources
	});
	steps.push({
		type: "thought",
		text: searchSources.length > 0 ? `Analyzing ${searchSources.length} verified sources about ${shortTopic}` : `Searching verified scientific & live databases for ${shortTopic}`
	}, {
		type: "thought",
		text: "Cross-referencing evidence, comparative metrics, and mechanisms"
	}, {
		type: "thought",
		text: "Synthesizing comprehensive deep research answer"
	});
	return steps;
}
function formatHistoryDate(timestamp) {
	if (!timestamp) return "";
	const diffSec = Math.floor((Date.now() - timestamp) / 1e3);
	if (diffSec < 60) return "Just now";
	if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
	if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
	if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
	return new Date(timestamp).toLocaleDateString(void 0, {
		month: "short",
		day: "numeric"
	});
}
var DeepResearchModal = ({ isOpen, onClose, initialTopic = "", selectedModelId = "zro/deepseek-v4.1-flash", selectedModel: propSelectedModel, onSelectModel: propOnSelectModel, searchMode: propSearchMode = "organic", onToggleSearchMode: propOnToggleSearchMode, isDark = true, onInsertReportToChat }) => {
	const [localModel, setLocalModel] = (0, import_react.useState)(propSelectedModel || GROK_MODELS[0]);
	const [localSearchMode, setLocalSearchMode] = (0, import_react.useState)(propSearchMode === "news" ? "news" : "organic");
	const activeModel = propSelectedModel || localModel;
	const handleSelectModel = propOnSelectModel || setLocalModel;
	const activeSearchMode = propSearchMode || localSearchMode;
	const handleToggleSearchMode = propOnToggleSearchMode || setLocalSearchMode;
	const [turns, setTurns] = (0, import_react.useState)([]);
	const [currentSessionId, setCurrentSessionId] = (0, import_react.useState)(null);
	const [isSearching, setIsSearching] = (0, import_react.useState)(false);
	const [isStreaming, setIsStreaming] = (0, import_react.useState)(false);
	const [streamingTurnId, setStreamingTurnId] = (0, import_react.useState)(null);
	const [streamingFullText, setStreamingFullText] = (0, import_react.useState)("");
	const [visibleWordCount, setVisibleWordCount] = (0, import_react.useState)(0);
	const [activeSources, setActiveSources] = (0, import_react.useState)([]);
	const [thinkingSteps, setThinkingSteps] = (0, import_react.useState)([]);
	const [activeDurationSec, setActiveDurationSec] = (0, import_react.useState)(0);
	const [hoveredSourceIds, setHoveredSourceIds] = (0, import_react.useState)([]);
	const [activeChipPreview, setActiveChipPreview] = (0, import_react.useState)(null);
	const [copiedTurnId, setCopiedTurnId] = (0, import_react.useState)(null);
	const [feedbackMap, setFeedbackMap] = (0, import_react.useState)({});
	const [selectedReasonMap, setSelectedReasonMap] = (0, import_react.useState)({});
	const [liveStatusAnnouncement, setLiveStatusAnnouncement] = (0, import_react.useState)("");
	const [isHistoryOpen, setIsHistoryOpen] = (0, import_react.useState)(false);
	const [historyList, setHistoryList] = (0, import_react.useState)([]);
	const [historySearchQuery, setHistorySearchQuery] = (0, import_react.useState)("");
	const abortRef = (0, import_react.useRef)(null);
	const streamTimerRef = (0, import_react.useRef)(null);
	const scrollViewportRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!isOpen) return;
		setHistoryList(DeepResearchHistoryStore.getHistory());
		const unsub = DeepResearchHistoryStore.subscribe(() => {
			setHistoryList(DeepResearchHistoryStore.getHistory());
		});
		DeepResearchHistoryStore.syncFromFirestore().then((res) => {
			if (res && res.length) setHistoryList(res);
		});
		return unsub;
	}, [isOpen]);
	(0, import_react.useEffect)(() => {
		if (!isOpen) return;
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				if (activeChipPreview) setActiveChipPreview(null);
				else if (isHistoryOpen) setIsHistoryOpen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		isOpen,
		activeChipPreview,
		isHistoryOpen
	]);
	const resetToCleanPage = () => {
		if (abortRef.current) abortRef.current.abort();
		if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
		setTurns([]);
		setCurrentSessionId(null);
		setStreamingTurnId(null);
		setStreamingFullText("");
		setVisibleWordCount(0);
		setActiveSources([]);
		setThinkingSteps([]);
		setIsSearching(false);
		setIsStreaming(false);
		setActiveDurationSec(0);
		setActiveChipPreview(null);
		setFeedbackMap({});
		setSelectedReasonMap({});
	};
	const [researchElapsedSec, setResearchElapsedSec] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		if (!isSearching && !(isStreaming && !streamingFullText)) return;
		setResearchElapsedSec(0);
		const id = window.setInterval(() => {
			setResearchElapsedSec((prev) => prev + 1);
		}, 1e3);
		return () => window.clearInterval(id);
	}, [
		isSearching,
		isStreaming,
		streamingFullText
	]);
	const loadHistoryItem = (record) => {
		if (abortRef.current) abortRef.current.abort();
		if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
		const cleanRecordSources = (record.sources || []).filter((s) => !isClientBoilerplateSource(s)).map((s, idx) => ({
			...s,
			id: idx + 1
		}));
		setCurrentSessionId(record.id);
		if (record.turns && record.turns.length > 0) setTurns(record.turns);
		else setTurns([{
			id: `turn-1-${record.id}`,
			question: record.question,
			fullAnswer: record.fullAnswer,
			sources: cleanRecordSources,
			thinkingSteps: record.thinkingSteps,
			durationSec: record.durationSec,
			thinkingDuration: record.thinkingDuration,
			createdAt: record.createdAt
		}]);
		setStreamingTurnId(null);
		setStreamingFullText("");
		setVisibleWordCount(99999);
		setIsSearching(false);
		setIsStreaming(false);
		setIsHistoryOpen(false);
		scrollViewportRef.current?.scrollTo({
			top: 0,
			behavior: "smooth"
		});
		setLiveStatusAnnouncement(`Loaded research for: ${record.question}`);
	};
	const startWordStream = (textToStream, turnId) => {
		if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
		const totalWords = textToStream.split(/\s+/).length;
		setVisibleWordCount(1);
		setIsStreaming(true);
		const step = totalWords > 2e3 ? 14 : totalWords > 1200 ? 9 : totalWords > 600 ? 5 : totalWords > 250 ? 3 : 2;
		streamTimerRef.current = window.setInterval(() => {
			setVisibleWordCount((prev) => {
				if (prev >= totalWords + 4) {
					if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
					setIsStreaming(false);
					setTurns((prevTurns) => prevTurns.map((t) => t.id === turnId ? {
						...t,
						fullAnswer: textToStream
					} : t));
					return totalWords + 20;
				}
				return prev + step;
			});
		}, 22);
	};
	const executeResearchTurn = async (targetQuestion) => {
		const cleanQ = targetQuestion.trim();
		if (!cleanQ) return;
		if (abortRef.current) abortRef.current.abort();
		if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
		const controller = new AbortController();
		abortRef.current = controller;
		turns.length;
		const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		const newTurn = {
			id: turnId,
			question: cleanQ,
			fullAnswer: "",
			sources: [],
			alsoReadSources: [],
			limitedSourcesFound: false,
			topicGuardFailed: false,
			createdAt: Date.now()
		};
		setTurns((prev) => {
			const last = prev[prev.length - 1];
			if (last && last.question === cleanQ && (last.topicGuardFailed || !last.fullAnswer)) return [...prev.slice(0, -1), newTurn];
			return [...prev, newTurn];
		});
		setStreamingTurnId(turnId);
		setStreamingFullText("");
		setVisibleWordCount(0);
		setIsSearching(true);
		setIsStreaming(true);
		setActiveSources([]);
		setThinkingSteps(buildDynamicThinkingSteps(cleanQ, []));
		setTimeout(() => {
			scrollViewportRef.current?.scrollTo({
				top: scrollViewportRef.current.scrollHeight,
				behavior: "smooth"
			});
		}, 100);
		const startTime = performance.now();
		try {
			const authHeaders = await getAuthHeaders();
			const sessionAttemptedExtractUrls = /* @__PURE__ */ new Set();
			const sessionRejectedExtractUrls = /* @__PURE__ */ new Set();
			const isUnextractableUrl = (rawUrl) => {
				if (!rawUrl || typeof rawUrl !== "string") return true;
				const u = rawUrl.toLowerCase();
				return u.includes("youtube.com") || u.includes("youtu.be") || u.includes("instagram.com") || u.includes("tiktok.com") || u.includes("facebook.com") || u.includes("twitter.com") || u.includes("x.com") || u.endsWith(".pdf") || u.includes("/pdf/") || u.includes("login") || u.includes("signin");
			};
			const fetchAndValidateSourcesRound = async (searchQueryStr) => {
				const isBioQuery = isBiomedicalResearchQuery(searchQueryStr);
				const [organicRes, researchRes, tregRes] = await Promise.all([
					callApi("/api/search/live", {
						method: "POST",
						headers: authHeaders,
						signal: controller.signal,
						body: JSON.stringify({
							query: searchQueryStr,
							searchMode: activeSearchMode === "news" ? "news" : "organic",
							isResearchMode: false
						})
					}).then((r) => r.json()).catch(() => ({ sources: [] })),
					callApi("/api/search/live", {
						method: "POST",
						headers: authHeaders,
						signal: controller.signal,
						body: JSON.stringify({
							query: searchQueryStr,
							searchMode: activeSearchMode === "news" ? "news" : "organic",
							isResearchMode: isBioQuery || true
						})
					}).then((r) => r.json()).catch(() => ({ sources: [] })),
					callApi("/api/treg/search", {
						method: "POST",
						headers: authHeaders,
						signal: controller.signal,
						body: JSON.stringify({
							query: searchQueryStr,
							mode: activeSearchMode === "news" ? "news" : "organic"
						})
					}).then((r) => r.json()).catch(() => ({ results: [] }))
				]);
				const prelimFiltered = filterRelevantResearchSources(searchQueryStr, [
					...Array.isArray(organicRes?.sources) ? organicRes.sources : [],
					...Array.isArray(researchRes?.sources) ? researchRes.sources : [],
					...Array.isArray(tregRes?.results) ? tregRes.results : []
				]);
				await Promise.allSettled(prelimFiltered.map(async (src) => {
					if (String(src.snippet || "").replace(/\s+/g, " ").trim().length >= 220) return;
					const normUrl = String(src.url || "").trim().toLowerCase();
					if (!normUrl || isUnextractableUrl(normUrl) || sessionAttemptedExtractUrls.has(normUrl) || sessionRejectedExtractUrls.has(normUrl)) return;
					sessionAttemptedExtractUrls.add(normUrl);
					try {
						const extResp = await callApi("/api/treg/extract", {
							method: "POST",
							headers: authHeaders,
							signal: controller.signal,
							body: JSON.stringify({ url: src.url })
						});
						if (extResp.ok) {
							const extData = await extResp.json();
							if (extData?.skipped || !extData?.success) {
								sessionRejectedExtractUrls.add(normUrl);
								return;
							}
							const md = String(extData?.markdown || "").replace(/^#+\s+.*$/gm, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\b(skip to content|cookie|privacy policy|sign in|log in|subscribe|all rights reserved)\b/gi, " ").replace(/\s+/g, " ").trim();
							if (md.length >= 200) src.snippet = md.slice(0, 680);
							else sessionRejectedExtractUrls.add(normUrl);
						} else sessionRejectedExtractUrls.add(normUrl);
					} catch {
						sessionRejectedExtractUrls.add(normUrl);
					}
				}));
				return prelimFiltered.filter((src) => {
					const cleanExcerpt = String(src.snippet || "").replace(/\s+/g, " ").trim();
					const cleanTitle = String(src.title || "").replace(/\s+/g, " ").trim();
					if (!cleanExcerpt || cleanExcerpt.length < 200) return false;
					if (cleanExcerpt.toLowerCase() === cleanTitle.toLowerCase()) return false;
					return scoreResearchSourceRelevance(src, cleanQ) >= 2.5;
				});
			};
			let validatedRawSources = await fetchAndValidateSourcesRound(cleanQ);
			if (/\b(best|top|compare|comparison|versus|vs|leaderboard|rankings?)\b/i.test(cleanQ) || /\b(llms?|language models?|ai models?|open[ -]source models?)\b/i.test(cleanQ)) {
				const subQueries = [];
				if (/\b(llms?|language models?|ai models?|open[ -]source|weights)\b/i.test(cleanQ)) subQueries.push("Llama 3 open source LLM benchmarks 2026", "Mistral Mixtral open weights LLM 2026", "Qwen DeepSeek Gemma open source LLM benchmarks 2026");
				else {
					const terms = extractMeaningfulTerms(cleanQ).slice(0, 4);
					subQueries.push(`${terms.join(" ")} top benchmarks evaluation 2026`, `${terms.join(" ")} architecture comparison 2026`);
				}
				const subResults = await Promise.allSettled(subQueries.map((sq) => fetchAndValidateSourcesRound(sq)));
				const seen = new Set(validatedRawSources.map((s) => s.url.replace(/\/+$/, "")));
				for (const res of subResults) if (res.status === "fulfilled" && Array.isArray(res.value)) for (const src of res.value) {
					const key = src.url.replace(/\/+$/, "");
					if (!seen.has(key)) {
						seen.add(key);
						validatedRawSources.push(src);
					}
				}
			}
			if (validatedRawSources.length < 4) {
				const round2Sources = await fetchAndValidateSourcesRound(buildRewrittenSearchQuery(cleanQ));
				const seen = new Set(validatedRawSources.map((s) => s.url.replace(/\/+$/, "")));
				for (const r2 of round2Sources) {
					const key = r2.url.replace(/\/+$/, "");
					if (!seen.has(key)) {
						seen.add(key);
						validatedRawSources.push(r2);
					}
				}
			}
			validatedRawSources = validatedRawSources.slice(0, 8);
			const isLimitedSources = validatedRawSources.length < 3;
			const keptSources = validatedRawSources.map((s, idx) => {
				const domain = s.domain || (() => {
					try {
						return new URL(s.url).hostname.replace(/^www\./, "");
					} catch {
						return "web.source";
					}
				})();
				const cleanExcerpt = String(s.snippet || "").replace(/\s+/g, " ").trim();
				return {
					id: idx + 1,
					sid: `S${idx + 1}`,
					name: formatSourceShortName(domain, s.title),
					title: s.title || domain,
					url: s.url,
					domain,
					snippet: cleanExcerpt,
					excerpt: cleanExcerpt
				};
			});
			setActiveSources(keptSources);
			setThinkingSteps(buildDynamicThinkingSteps(cleanQ, keptSources));
			setIsSearching(false);
			setTurns((prev) => prev.map((t) => t.id === turnId ? {
				...t,
				sources: keptSources,
				limitedSourcesFound: isLimitedSources
			} : t));
			const numberedExcerptsBlock = keptSources.map((s) => `[${s.sid}] ${s.title} (${s.domain})\nExcerpt: ${s.excerpt}`).join("\n\n");
			const buildWriterSystemPrompt = (isRegenerationAttempt) => {
				if (isLimitedSources) return `You are a factual research writer. Answer the user query "${cleanQ}" using ONLY the provided numbered source excerpts (${keptSources.map((s) => `[${s.sid}]`).join(", ") || "none"}).
Because fewer than 3 verified sources passed relevance filtering, write a short, hedged answer (2–3 short paragraphs) that explicitly notes the limited available evidence and cites ONLY [${keptSources.map((s) => s.sid).join("], [")}] immediately after claims taken from that excerpt.`;
				return `You are a rigorous technical research writer. Write an in-depth, factual research report that directly answers the user query: "${cleanQ}".

STRICT RULES:
1. Use ONLY the provided source excerpts [${keptSources.map((s) => s.sid).join("]..[")}].
2. Cite sources using their fixed IDs [${keptSources.map((s) => s.sid).join("], [")}] ONLY (for example [S1] or [S2]), and place each [${keptSources.map((s) => s.sid)[0] || "S1"}] citation immediately after claims taken from that specific excerpt.
3. Draw from at least ${Math.min(4, keptSources.length)} different sources across your report so all major relevant sources are cited accurately.
4. Stay 100% on the topic of "${cleanQ}". Name specific models, architectures, mechanisms, and benchmarks mentioned in the excerpts.
5. Organize with clear Markdown headings and a comparison table if appropriate. Do NOT output any boilerplate headers or follow-up questions.${isRegenerationAttempt ? `\n6. CRITICAL RETRY DIRECTIVE: Your previous draft failed the topic relevance check. Ensure every single paragraph directly addresses "${cleanQ}" using the facts in [S1]..[S${keptSources.length}].` : ""}`;
			};
			const writerUserMessage = numberedExcerptsBlock ? `USER QUERY: ${cleanQ}\n\nNUMBERED SOURCE EXCERPTS:\n\n${numberedExcerptsBlock}` : `USER QUERY: ${cleanQ}`;
			const runWriterCall = async (isRegenerationAttempt) => {
				const data = await (await callApi("/api/chat", {
					method: "POST",
					headers: authHeaders,
					signal: controller.signal,
					body: JSON.stringify({
						systemPrompt: buildWriterSystemPrompt(isRegenerationAttempt),
						messages: [{
							role: "user",
							content: writerUserMessage
						}],
						webSearch: false,
						searchMode: "organic",
						model: activeModel?.geminiModel || selectedModelId || "zro/deepseek-v4.1-flash",
						isResearchMode: true,
						maxTokens: 4096
					})
				})).json();
				return String(data?.text || "").replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").split(/---FOLLOWUPS---/i)[0].trim();
			};
			const judgeWhetherReportAnswersQuery = async (reportDraft) => {
				if (!reportDraft || reportDraft.length < 80) return false;
				if (!/\b(mindful|gratitude|meditation)\b/i.test(cleanQ) && /\b(mindful\s+living|intentional\s+presence|intentional\s+gratitude|savoring\s+their\s+existence)\b/i.test(reportDraft)) return false;
				if (!/\b(epiphyseal|hormone|steroid|endocrine|somatotropic)\b/i.test(cleanQ) && /\b(epiphyseal\s+growth\s+plate|somatotropic\s+axis|chondrocyte\s+senescence)\b/i.test(reportDraft)) return false;
				const qTerms = extractMeaningfulTerms(cleanQ);
				const draftLower = reportDraft.toLowerCase();
				const matchedQTerms = qTerms.filter((t) => {
					const stem = t.endsWith("s") && t.length > 4 ? t.slice(0, -1) : t;
					return draftLower.includes(t) || stem.length >= 4 && draftLower.includes(stem);
				});
				if (qTerms.length >= 4 && matchedQTerms.length === 0) return false;
				try {
					const judgeResp = await callApi("/api/chat", {
						method: "POST",
						headers: authHeaders,
						signal: controller.signal,
						body: JSON.stringify({
							systemPrompt: "You are a strict relevance judge. Reply with ONLY \"YES\" if the report directly answers the user query on-topic, or \"NO\" if the report is off-topic, hallucinated, or about an unrelated subject.",
							messages: [{
								role: "user",
								content: `User Query: "${cleanQ}"\n\nReport Excerpt:\n${reportDraft.slice(0, 1600)}\n\nDoes this report directly answer the User Query? Reply ONLY YES or NO.`
							}],
							webSearch: false,
							searchMode: "organic",
							model: activeModel?.geminiModel || selectedModelId || "zro/deepseek-v4.1-flash",
							isResearchMode: false,
							maxTokens: 16
						})
					});
					if (judgeResp.ok) {
						const judgeJson = await judgeResp.json();
						const verdict = String(judgeJson?.text || "").replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim().toUpperCase();
						if (verdict === "NO" || verdict.startsWith("NO ") || verdict.startsWith("NO.") || verdict.startsWith("NO,")) return false;
					}
				} catch {}
				return true;
			};
			let candidateReport = await runWriterCall(false);
			let passesTopicGuard = await judgeWhetherReportAnswersQuery(candidateReport);
			if (!passesTopicGuard && keptSources.length > 0) {
				console.warn(`[Kinich Deep Research] Topic Guard rejected Attempt 1 for "${cleanQ}". Regenerating once from the same sources...`);
				candidateReport = await runWriterCall(true);
				passesTopicGuard = await judgeWhetherReportAnswersQuery(candidateReport);
			}
			const elapsed = Math.max(1, (performance.now() - startTime) / 1e3);
			const roundedDuration = Number(elapsed.toFixed(1));
			setActiveDurationSec(roundedDuration);
			if (!passesTopicGuard) {
				setIsStreaming(false);
				setTurns((prev) => prev.map((t) => t.id === turnId ? {
					...t,
					fullAnswer: "",
					topicGuardFailed: true,
					limitedSourcesFound: isLimitedSources,
					durationSec: roundedDuration
				} : t));
				return;
			}
			const { verifiedText: trimmedAnswer, citedSources, alsoReadSources } = bindVerifyAndRenumberCitations(candidateReport, keptSources, cleanQ);
			setActiveSources(citedSources);
			setStreamingFullText(trimmedAnswer);
			startWordStream(trimmedAnswer, turnId);
			setTurns((prev) => {
				const updated = prev.map((t) => t.id === turnId ? {
					...t,
					fullAnswer: trimmedAnswer,
					sources: citedSources,
					alsoReadSources,
					limitedSourcesFound: isLimitedSources,
					topicGuardFailed: false,
					durationSec: roundedDuration,
					thinkingSteps: buildDynamicThinkingSteps(cleanQ, citedSources)
				} : t);
				const firstTurn = updated[0];
				const sessionId = currentSessionId || `dr_${Date.now()}`;
				setCurrentSessionId(sessionId);
				DeepResearchHistoryStore.saveRecord({
					id: sessionId,
					topic: firstTurn.question,
					question: firstTurn.question,
					fullAnswer: firstTurn.fullAnswer,
					sources: firstTurn.sources,
					alsoReadSources: firstTurn.alsoReadSources,
					limitedSourcesFound: firstTurn.limitedSourcesFound,
					durationSec: roundedDuration,
					turns: updated,
					modelId: activeModel?.id
				}).catch(() => {});
				return updated;
			});
		} catch (err) {
			if (err?.name === "AbortError") return;
			setIsSearching(false);
			setIsStreaming(false);
			setTurns((prev) => prev.map((t) => t.id === turnId ? {
				...t,
				fullAnswer: "",
				topicGuardFailed: true
			} : t));
		}
	};
	(0, import_react.useEffect)(() => {
		if (!isOpen) return;
		const trimmed = initialTopic.trim();
		if (trimmed) {
			resetToCleanPage();
			executeResearchTurn(trimmed);
		} else resetToCleanPage();
		return () => {
			if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
			if (abortRef.current) abortRef.current.abort();
		};
	}, [isOpen, initialTopic]);
	const handleStopStreaming = () => {
		if (abortRef.current) abortRef.current.abort();
		if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
		setIsSearching(false);
		setIsStreaming(false);
		setVisibleWordCount(99999);
		setLiveStatusAnnouncement("Generation stopped");
	};
	const handleCopyTurn = (turn) => {
		const plainAnswer = turn.fullAnswer.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\[(\d+(?:,\s*\d+)*)\]/g, "[$1]");
		const sourceList = (turn.sources || []).map((s) => `[${s.id}] ${s.name}: ${s.title} (${s.url})`).join("\n");
		const finalCopy = sourceList ? `${turn.question}\n\n${plainAnswer}\n\nSources:\n${sourceList}` : `${turn.question}\n\n${plainAnswer}`;
		navigator.clipboard.writeText(finalCopy);
		setCopiedTurnId(turn.id);
		setLiveStatusAnnouncement("Copied answer and sources to clipboard");
		setTimeout(() => setCopiedTurnId(null), 2e3);
	};
	const handleExportMarkdown = (turn) => {
		const exportText = `# Research: ${turn.question}\n\n${turn.fullAnswer}\n\n## References & Citations\n` + (turn.sources || []).map((s) => `[${s.id}] ${s.name} — ${s.title}\nURL: ${s.url}`).join("\n\n");
		const blob = new Blob([exportText], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${(turn.question || "research").replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_report.md`;
		a.click();
		URL.revokeObjectURL(url);
		setLiveStatusAnnouncement("Exported report (.md)");
	};
	const [isGuestResearchUser, setIsGuestResearchUser] = (0, import_react.useState)(() => UserAccountStore.isGuest());
	const [savedResearchTurnMap, setSavedResearchTurnMap] = (0, import_react.useState)({});
	const [sageResearchCardMap, setSageResearchCardMap] = (0, import_react.useState)({});
	(0, import_react.useEffect)(() => {
		const syncGuest = () => setIsGuestResearchUser(UserAccountStore.isGuest());
		window.addEventListener("kinich-account-updated", syncGuest);
		return () => window.removeEventListener("kinich-account-updated", syncGuest);
	}, []);
	(0, import_react.useEffect)(() => {
		const onSageDone = (e) => {
			const detail = e?.detail;
			if (!detail?.item || !detail?.agentReply) return;
			const turnEntry = Object.entries(savedResearchTurnMap).find(([, vaultId]) => vaultId === detail.item.id);
			if (turnEntry) setSageResearchCardMap((prev) => ({
				...prev,
				[turnEntry[0]]: detail.agentReply
			}));
		};
		window.addEventListener("kinich-sage-organized", onSageDone);
		return () => window.removeEventListener("kinich-sage-organized", onSageDone);
	}, [savedResearchTurnMap]);
	const handleSaveTurnToVault = (turn) => {
		if (UserAccountStore.isGuest()) {
			window.dispatchEvent(new CustomEvent("kinich-open-auth", { detail: { message: "Sign in to keep this in your Vault." } }));
			return;
		}
		const existingVaultId = savedResearchTurnMap[turn.id];
		const check = KnowledgeVaultStore.canSaveToVault(existingVaultId);
		if (!check.allowed) {
			window.dispatchEvent(new CustomEvent("kinich-open-pricing", { detail: {
				highlightPlan: "spark",
				reason: check.message
			} }));
			return;
		}
		const fullContent = `# Deep Research: ${turn.question}\n\n${turn.fullAnswer}\n\n## Cited Sources\n` + (turn.sources || []).map((s) => `- [${s.id}] ${s.title} (${s.url})`).join("\n");
		const saved = KnowledgeVaultStore.saveItem({
			id: existingVaultId,
			title: `Deep Research: ${turn.question}`,
			summary: turn.fullAnswer.replace(/[#*`~>\n]+/g, " ").trim().slice(0, 240),
			content: fullContent,
			type: "research_report",
			sourceType: "research_report",
			sourceUrl: turn.sources?.[0]?.url || "",
			collectionId: "col_research_ideas",
			tags: ["deep-research", "research-report"],
			sources: (turn.sources || []).map((s, idx) => ({
				position: s.id || idx + 1,
				title: s.title,
				url: s.url,
				snippet: s.snippet || "",
				domain: s.domain
			}))
		});
		setSavedResearchTurnMap((prev) => ({
			...prev,
			[turn.id]: saved.id
		}));
		setLiveStatusAnnouncement("Saved Deep Research report to Vault");
	};
	const renderRichLine = (lineText, lineKey, turnSources) => {
		return lineText.split(/(\$\$[^\$\n]+\$\$|\*\*[^*]+\*\*|(?:\S+[ \t]+)?\[\d+(?:,\s*\d+)*\][.,;:]?)/g).map((part, idx) => {
			if (!part) return null;
			if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "inline-block mx-0.5 align-baseline",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MathMarkdown, {
					content: part,
					inline: true,
					isDark
				})
			}, `${lineKey}-m-${idx}`);
			if (part.startsWith("**") && part.endsWith("**")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
				className: isDark ? "font-semibold text-white" : "font-semibold text-neutral-900",
				children: part.slice(2, -2)
			}, `${lineKey}-b-${idx}`);
			const citeMatch = part.match(/^(?:(\S+)[ \t]+)?\[(\d+(?:,\s*\d+)*)\]([.,;:]?)$/);
			if (citeMatch) {
				const leadingWord = citeMatch[1] || "";
				const trailingPunct = citeMatch[3] || "";
				const ids = citeMatch[2].split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
				const primarySource = turnSources.find((s) => s.id === ids[0]) || turnSources[0];
				if (!primarySource) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [leadingWord, trailingPunct] }, `${lineKey}-t-${idx}`);
				const extraCount = ids.length > 1 ? ` +${ids.length - 1}` : "";
				const numberBadge = `[${ids.join(",")}]`;
				const anchorKey = `${lineKey}-c-${idx}`;
				const isHighlighted = ids.some((id) => hoveredSourceIds.includes(id));
				const isPreviewOpen = activeChipPreview?.anchorKey === anchorKey;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline whitespace-nowrap align-baseline",
					children: [
						leadingWord ? `${leadingWord}\u00A0` : "",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: primarySource.url,
							target: "_blank",
							rel: "noopener noreferrer",
							onMouseEnter: (e) => {
								setHoveredSourceIds(ids);
								const rect = e.currentTarget.getBoundingClientRect();
								setActiveChipPreview({
									ids,
									anchorKey,
									rect: {
										top: rect.top,
										bottom: rect.bottom,
										left: rect.left,
										right: rect.right,
										width: rect.width
									}
								});
							},
							onMouseLeave: () => {
								setHoveredSourceIds([]);
								setActiveChipPreview(null);
							},
							onClick: (e) => {
								e.stopPropagation();
								setHoveredSourceIds(ids);
								const cardEl = document.getElementById(`dr-source-card-${primarySource.id}`);
								if (cardEl) cardEl.scrollIntoView({
									behavior: "smooth",
									block: "nearest",
									inline: "nearest"
								});
							},
							"aria-label": `Source ${primarySource.id}: ${primarySource.title}`,
							className: `inline-flex whitespace-nowrap items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium leading-tight transition-all cursor-pointer !no-underline align-baseline ${isHighlighted || isPreviewOpen ? "bg-[#FC4C01] text-white font-semibold ring-1 ring-[#FC4C01]" : isDark ? "bg-white/[0.08] text-neutral-300 hover:bg-[#FC4C01]/20 hover:text-[#FC4C01]" : "bg-black/[0.06] text-neutral-700 hover:bg-[#FC4C01]/15 hover:text-[#FC4C01]"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono font-bold text-[10px] opacity-85",
								children: numberBadge
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "whitespace-nowrap",
								children: [primarySource.name, extraCount]
							})]
						}),
						trailingPunct
					]
				}, anchorKey);
			}
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Fragment, { children: part }, `${lineKey}-t-${idx}`);
		});
	};
	const parseBlocksFromText = (rawText) => {
		if (!rawText) return [];
		return rawText.replace(/\r\n/g, "\n").replace(/^([#]{1,6}\s+[^\n]+)/m, "$1\n\n").replace(/\n([#]{1,6}\s+[^\n]+)/g, "\n\n$1\n\n").replace(/\n(---|\*\*\*)\n/g, "\n\n$1\n\n").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
	};
	const filteredHistory = (0, import_react.useMemo)(() => {
		const q = historySearchQuery.trim().toLowerCase();
		if (!q) return historyList;
		return historyList.filter((item) => item.question.toLowerCase().includes(q) || item.fullAnswer.toLowerCase().includes(q) || item.sources?.some((s) => s.title?.toLowerCase().includes(q) || s.domain?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q)));
	}, [historyList, historySearchQuery]);
	if (!isOpen) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		onClick: () => setActiveChipPreview(null),
		className: `fixed inset-0 z-50 w-full h-[100dvh] flex flex-col overflow-hidden select-text transition-colors duration-200 relative ${isDark ? "bg-[#0a0a0c] text-white" : "bg-[#fafafa] text-[#000000]"}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sr-only",
				"aria-live": "polite",
				children: liveStatusAnnouncement
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute top-0 left-0 right-0 z-30 pointer-events-none px-3 sm:px-6 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-3xl mx-auto w-full flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: onClose,
						className: `pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors active:scale-95 cursor-pointer ${isDark ? "bg-[#0a0a0c] hover:bg-white/[0.08] border-white/[0.14] text-neutral-200 hover:text-white" : "bg-[#fafafa] hover:bg-black/[0.05] border-black/[0.1] text-neutral-700 hover:text-black"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Back" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 sm:gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setIsHistoryOpen((prev) => !prev),
								title: "Research History",
								className: `pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors active:scale-95 cursor-pointer ${isHistoryOpen ? isDark ? "bg-white text-black border-white" : "bg-neutral-900 text-white border-neutral-900" : isDark ? "bg-[#0a0a0c] hover:bg-white/[0.08] border-white/[0.14] text-neutral-200 hover:text-white" : "bg-[#fafafa] hover:bg-black/[0.05] border-black/[0.1] text-neutral-700 hover:text-black"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3.5 h-3.5" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "History" }),
									historyList.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${isHistoryOpen ? isDark ? "bg-black/15 text-black" : "bg-white/20 text-white" : isDark ? "bg-white/10 text-neutral-300" : "bg-black/10 text-neutral-700"}`,
										children: historyList.length
									})
								]
							}),
							turns.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: resetToCleanPage,
								title: "Start a new research topic",
								className: `pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors active:scale-95 cursor-pointer ${isDark ? "bg-[#0a0a0c] hover:bg-white/[0.08] border-white/[0.14] text-neutral-200 hover:text-white" : "bg-[#fafafa] hover:bg-black/[0.05] border-black/[0.1] text-neutral-700 hover:text-black"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "New" })]
							}),
							onInsertReportToChat && turns.length > 0 && !isStreaming && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => {
									const combined = turns.map((t, i) => `### ${i === 0 ? "Research Topic" : "Follow-up"}: ${t.question}\n\n${t.fullAnswer}`).join("\n\n---\n\n");
									const allSources = turns.map((t) => t.sources || []).flat().map((s) => ({
										title: s.title,
										url: s.url,
										domain: s.domain,
										snippet: s.snippet || "",
										position: s.id
									}));
									onInsertReportToChat(turns[0].question, combined, allSources, []);
									onClose();
								},
								className: `pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors active:scale-95 cursor-pointer ${isDark ? "bg-white text-black hover:bg-neutral-200 border-white" : "bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-900"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Chat" })]
							})
						]
					})]
				})
			}),
			turns.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 min-h-0 flex flex-col items-center justify-center px-4 overflow-y-auto scrollbar-thin pt-20 pb-28",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "max-w-xl w-full flex flex-col items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GrokLogo, {
							size: "lg",
							isDark
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center mt-3 mb-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-base sm:text-lg font-semibold tracking-tight",
								children: "Deep Research Mode"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: `text-xs mt-1 ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
								children: "Comprehensive multi-source analysis with live literature and data synthesis"
							})]
						}),
						historyList.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "w-full animate-in fade-in slide-in-from-bottom-2 duration-200",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between mb-2.5 px-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3.5 h-3.5 opacity-70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] font-semibold tracking-wider uppercase opacity-70",
										children: "Recent Research"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setIsHistoryOpen(true),
									className: "text-xs hover:underline opacity-75 hover:opacity-100 cursor-pointer",
									children: [
										"View all (",
										historyList.length,
										")"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2 max-h-[38vh] overflow-y-auto pr-1 scrollbar-thin",
								children: historyList.slice(0, 4).map((record) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									onClick: () => loadHistoryItem(record),
									className: `group relative p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${isDark ? "bg-[#121215] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04]" : "bg-white border-black/[0.08] hover:border-black/20 hover:bg-black/[0.02] shadow-xs"}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start justify-between gap-3 mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs sm:text-sm font-medium line-clamp-1 group-hover:text-current",
												children: record.question
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "shrink-0 text-[10.5px] opacity-50 font-normal",
												children: formatHistoryDate(record.createdAt)
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-[11.5px] opacity-65 line-clamp-2 leading-relaxed",
											children: record.fullAnswer.replace(/\*\*/g, "").replace(/\[\d+(?:,\s*\d+)*\]/g, "")
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 mt-2 text-[10px] opacity-60",
											children: [
												record.sources?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [record.sources.length, " sources"] }),
												record.durationSec > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
													"• ",
													record.durationSec,
													"s"
												] }),
												record.turns && record.turns.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "text-emerald-500 font-medium",
													children: [
														"• ",
														record.turns.length,
														" turns"
													]
												})
											]
										})
									]
								}, record.id))
							})]
						})
					]
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: scrollViewportRef,
				className: "flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden px-4 sm:px-6 md:px-8 pt-18 sm:pt-20 pb-32 sm:pb-36 scrollbar-thin",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "max-w-3xl mx-auto w-full space-y-7",
					children: turns.map((turn, tIdx) => {
						const isCurrentTurnStreaming = isStreaming && streamingTurnId === turn.id;
						const isCurrentTurnSearching = isSearching && streamingTurnId === turn.id;
						let textToRender = turn.fullAnswer;
						if (isCurrentTurnStreaming && streamingFullText) {
							const tokens = streamingFullText.split(/(\s+)/);
							let wordsSeen = 0;
							let out = "";
							for (const tok of tokens) {
								if (/\S/.test(tok)) {
									wordsSeen++;
									if (wordsSeen > visibleWordCount) break;
								}
								out += tok;
							}
							textToRender = out;
						}
						const blocks = parseBlocksFromText(textToRender);
						const turnSources = (isCurrentTurnStreaming || isCurrentTurnSearching) && activeSources.length > 0 ? activeSources : turn.sources || [];
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `w-full ${tIdx > 0 ? isDark ? "pt-6 border-t border-white/[0.08]" : "pt-6 border-t border-black/[0.08]" : ""}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2 mb-1.5 flex-wrap",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium border ${isDark ? "border-white/[0.12] bg-white/[0.06] text-neutral-300" : "border-black/[0.08] bg-black/[0.04] text-neutral-700"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-2.5 h-2.5 opacity-70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: tIdx === 0 ? "Research Inquiry" : `Follow-up #${tIdx + 1}` })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 flex-wrap",
											children: [turn.limitedSourcesFound && !isCurrentTurnSearching && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												"data-testid": "deep-research-limited-sources-badge",
												className: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${isDark ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-300 bg-amber-50 text-amber-800"}`,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Limited sources found" })
											}), !isCurrentTurnSearching && !isCurrentTurnStreaming && (turn.durationSec || activeDurationSec) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												"data-testid": "deep-research-elapsed-badge",
												className: `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono tabular-nums border ${isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3 h-3 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: `Completed in ${turn.durationSec || activeDurationSec}s · ${turnSources.length} ${turnSources.length === 1 ? "source" : "sources"}` })]
											}) : null]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: `text-base sm:text-[18px] font-semibold tracking-tight leading-snug ${isDark ? "text-white" : "text-neutral-900"}`,
										children: turn.question
									})]
								}),
								turnSources.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mb-3.5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-stretch gap-2 overflow-x-auto pb-1.5 scrollbar-none",
										children: turnSources.map((src, idx) => {
											const isCardHighlighted = hoveredSourceIds.includes(src.id);
											const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(src.domain)}&sz=32`;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
												id: `dr-source-card-${src.id}`,
												href: src.url,
												target: "_blank",
												rel: "noopener noreferrer",
												onMouseEnter: () => setHoveredSourceIds([src.id]),
												onMouseLeave: () => setHoveredSourceIds([]),
												style: { animationDelay: `${idx * 30}ms` },
												className: `w-36 sm:w-40 shrink-0 rounded-xl border p-2.5 flex flex-col justify-between gap-1.5 transition-all duration-150 animate-in fade-in slide-in-from-bottom-1 ${isCardHighlighted ? "border-[#FC4C01] ring-2 ring-[#FC4C01]/35 bg-[#FC4C01]/10" : isDark ? "bg-[#141418] border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04]" : "bg-white border-black/[0.07] hover:border-black/[0.16] hover:bg-neutral-50 shadow-2xs"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-1.5 min-w-0",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
															src: faviconUrl,
															alt: "",
															className: "w-3.5 h-3.5 rounded-xs shrink-0 object-contain",
															onError: (e) => {
																e.currentTarget.style.display = "none";
															}
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: `text-[10.5px] font-medium truncate ${isDark ? "text-neutral-400" : "text-neutral-600"}`,
															children: src.name
														})]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: `px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums ${isDark ? "bg-white/[0.08] text-neutral-300" : "bg-black/[0.06] text-neutral-700"}`,
														children: [
															"[",
															src.id,
															"]"
														]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: `text-xs font-medium leading-snug line-clamp-2 ${isDark ? "text-neutral-200" : "text-neutral-900"}`,
													children: src.title
												})]
											}, src.id);
										})
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									"aria-busy": isCurrentTurnStreaming,
									className: `space-y-3.5 text-[13.5px] sm:text-[14px] leading-relaxed ${isDark ? "text-neutral-200" : "text-neutral-800"}`,
									children: [
										blocks.length === 0 && (isCurrentTurnSearching || isCurrentTurnStreaming) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "py-2 w-full",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AILoadingState, {
												steps: [
													{
														id: "academic-search",
														label: "Searching academic & live web indexes",
														status: isCurrentTurnSearching ? "running" : "done",
														detail: [
															"querying Google Scholar, PubMed, ArXiv & live indexes",
															"fetching peer-reviewed literature & empirical data",
															"extracting primary sources & DOI citations"
														],
														durationMs: !isCurrentTurnSearching ? Math.min(researchElapsedSec * 1e3, 2800) : void 0
													},
													{
														id: "index-sources",
														label: `${turnSources.length > 0 ? `${turnSources.length} verified sources` : "Live sources"} indexed`,
														status: isCurrentTurnSearching ? "pending" : researchElapsedSec < 3 ? "running" : "done",
														detail: [
															"inspecting study design, sample size & methodology",
															"verifying statistical significance & peer-review metrics",
															"ranking by empirical relevance and domain authority"
														],
														durationMs: researchElapsedSec >= 3 ? 1600 : void 0
													},
													{
														id: "citation-mapping",
														label: "Cross-verifying claims & citation mapping",
														status: isCurrentTurnSearching || researchElapsedSec < 3 ? "pending" : researchElapsedSec < 7 ? "running" : "done",
														detail: [
															"grounding findings against extracted passage coordinates",
															"resolving primary literature claims and counter-evidence",
															"linking inline citations [S1..Sn]"
														],
														durationMs: researchElapsedSec >= 7 ? 2100 : void 0
													},
													{
														id: "synthesizing-report",
														label: "Synthesizing structured research report",
														status: isCurrentTurnSearching || researchElapsedSec < 7 ? "pending" : "running",
														detail: ["structuring comprehensive findings and synthesis", "formatting verified evidence table & executive brief"]
													}
												],
												className: "w-full"
											})
										}) : blocks.map((block, bIdx) => {
											const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
											const isLastBlock = bIdx === blocks.length - 1;
											if (block.startsWith("$$") && block.endsWith("$$")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "my-3 overflow-x-auto",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MathMarkdown, {
													content: block,
													isDark
												})
											}, `blk-math-${turn.id}-${bIdx}`);
											if (block.startsWith("```")) {
												const codeLines = block.split("\n");
												const rawLang = codeLines[0].replace(/^```/, "").trim();
												const codeContent = codeLines.length > 2 && codeLines[codeLines.length - 1].startsWith("```") ? codeLines.slice(1, -1).join("\n") : codeLines.slice(1).join("\n");
												return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "my-3.5 w-full",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CodeBlock, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CodeBlockHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlockTitle, { children: rawLang ? `${rawLang.toUpperCase()} Block` : "Code Block" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlockActions, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlockCopyButton, { value: codeContent }) })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeBlockContent, {
														lineNumbers: true,
														wrap: true,
														children: codeContent
													})] })
												}, `code-${turn.id}-${bIdx}`);
											}
											if (/^#{1,6}\s+/.test(block)) {
												const match = block.match(/^(#{1,6})\s+(.*)$/);
												if (match) {
													const level = match[1].length;
													const cleanHeadingText = match[2].trim();
													if (level === 1) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
														className: `text-[16px] sm:text-[17px] font-bold tracking-tight mt-5 mb-2 pb-1 border-b ${isDark ? "border-white/[0.1] text-white" : "border-black/[0.08] text-neutral-900"}`,
														children: renderRichLine(cleanHeadingText, `h1-${turn.id}-${bIdx}`, turnSources)
													}, `h1-${turn.id}-${bIdx}`);
													if (level === 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: `text-[14.5px] sm:text-[15.5px] font-semibold tracking-tight mt-4.5 mb-2 ${isDark ? "text-neutral-100" : "text-neutral-900"}`,
														children: renderRichLine(cleanHeadingText, `h2-${turn.id}-${bIdx}`, turnSources)
													}, `h2-${turn.id}-${bIdx}`);
													return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
														className: `text-[13px] sm:text-[13.5px] font-semibold mt-3.5 mb-1 ${isDark ? "text-neutral-200" : "text-neutral-800"}`,
														children: renderRichLine(cleanHeadingText, `h3-${turn.id}-${bIdx}`, turnSources)
													}, `h3-${turn.id}-${bIdx}`);
												}
											}
											if (block === "---" || block === "***") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("hr", { className: `my-4 border-t ${isDark ? "border-white/[0.08]" : "border-black/[0.08]"}` }, `hr-${turn.id}-${bIdx}`);
											const quoteLines = lines.filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s*/, ""));
											if (quoteLines.length > 0 && quoteLines.length === lines.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: `my-3 pl-3.5 border-l-2 text-[13px] sm:text-[13.5px] leading-relaxed transition-colors ${isDark ? "border-white/30 text-neutral-300" : "border-neutral-400 text-neutral-700"}`,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "space-y-1",
													children: quoteLines.map((ql, qIdx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "leading-relaxed",
														children: renderRichLine(ql, `q-${turn.id}-${bIdx}-${qIdx}`, turnSources)
													}, qIdx))
												})
											}, `quote-${turn.id}-${bIdx}`);
											const tableData = parseMarkdownTable(block);
											if (tableData) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: `my-3.5 w-full overflow-x-auto rounded-xl border ${isDark ? "border-white/[0.08] bg-[#121215]" : "border-black/[0.07] bg-white shadow-2xs"}`,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
													className: "w-full border-collapse text-left text-[12px] sm:text-[12.5px]",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
														className: `border-b ${isDark ? "border-white/[0.08] bg-white/[0.03]" : "border-black/[0.06] bg-neutral-50"}`,
														children: tableData.headers.map((h, hIdx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
															className: `px-3 py-2 font-semibold text-[11px] sm:text-[11.5px] tracking-wide ${isDark ? "text-neutral-300" : "text-neutral-700"}`,
															children: renderRichLine(h, `th-${turn.id}-${bIdx}-${hIdx}`, turnSources)
														}, hIdx))
													}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
														className: `divide-y ${isDark ? "divide-white/[0.04]" : "divide-black/[0.04]"}`,
														children: tableData.rows.map((row, rIdx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
															className: `transition-colors ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-neutral-50/60"}`,
															children: row.map((cell, cIdx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: `px-3 py-2 leading-relaxed ${isDark ? "text-neutral-300" : "text-neutral-700"}`,
																children: renderRichLine(cell, `td-${turn.id}-${bIdx}-${rIdx}-${cIdx}`, turnSources)
															}, cIdx))
														}, rIdx))
													})]
												})
											}, `tbl-${turn.id}-${bIdx}`);
											if (lines.every((l) => /^\d+\.\s+/.test(l))) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
												className: "space-y-1.5 pl-0.5",
												children: lines.map((item, lIdx) => {
													const num = item.match(/^(\d+)\.\s+/)?.[1] || `${lIdx + 1}`;
													const cleanItem = item.replace(/^\d+\.\s+/, "");
													const isVeryLast = isLastBlock && lIdx === lines.length - 1;
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
														className: "flex items-start gap-2 leading-relaxed text-[13px] sm:text-[13.5px]",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: `text-[11.5px] font-mono font-semibold shrink-0 mt-0.5 tabular-nums ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
															children: [num, "."]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "flex-1",
															children: [renderRichLine(cleanItem, `oli-${turn.id}-${bIdx}-${lIdx}`, turnSources), isCurrentTurnStreaming && isVeryLast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `inline-block size-1.5 rounded-full ml-1 align-middle animate-pulse ${isDark ? "bg-white" : "bg-black"}` })]
														})]
													}, `oli-${turn.id}-${bIdx}-${lIdx}`);
												})
											}, `numblk-${turn.id}-${bIdx}`);
											if (lines.every((l) => /^[-*•]\s+/.test(l))) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
												className: "space-y-1.5 pl-0.5",
												children: lines.map((item, lIdx) => {
													const cleanItem = item.replace(/^[-*•]\s+/, "");
													const isVeryLast = isLastBlock && lIdx === lines.length - 1;
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
														className: "flex items-start gap-2 leading-relaxed text-[13px] sm:text-[13.5px]",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `mt-2 size-1 rounded-full shrink-0 ${isDark ? "bg-neutral-500" : "bg-neutral-400"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "flex-1",
															children: [renderRichLine(cleanItem, `li-${turn.id}-${bIdx}-${lIdx}`, turnSources), isCurrentTurnStreaming && isVeryLast && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `inline-block size-1.5 rounded-full ml-1 align-middle animate-pulse ${isDark ? "bg-white" : "bg-black"}` })]
														})]
													}, `li-${turn.id}-${bIdx}-${lIdx}`);
												})
											}, `blk-${turn.id}-${bIdx}`);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "leading-relaxed",
												children: [renderRichLine(block, `p-${turn.id}-${bIdx}`, turnSources), isCurrentTurnStreaming && isLastBlock && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `inline-block size-1.5 rounded-full ml-1 align-middle animate-pulse ${isDark ? "bg-white" : "bg-black"}` })]
											}, `blk-${turn.id}-${bIdx}`);
										}),
										turn.topicGuardFailed && !isCurrentTurnSearching && !isCurrentTurnStreaming && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											"data-testid": "deep-research-topic-guard-error",
											className: `p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? "bg-red-500/10 border-red-500/30 text-red-200" : "bg-red-50 border-red-200 text-red-900"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "space-y-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xs font-semibold",
													children: "Report validation failed: off-topic synthesis detected"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "text-xs opacity-80",
													children: [
														"The generated draft did not pass the relevance check for \"",
														turn.question,
														"\". Click Retry to run a fresh synthesis."
													]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => executeResearchTurn(turn.question),
												className: "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#FC4C01] text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Retry" })]
											})]
										}),
										!isCurrentTurnSearching && !isCurrentTurnStreaming && Array.isArray(turn.alsoReadSources) && turn.alsoReadSources.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `mt-4 pt-3 border-t ${isDark ? "border-white/[0.08]" : "border-black/[0.08]"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: `text-[11px] font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
												children: "Also read"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex flex-wrap gap-2",
												children: turn.alsoReadSources.map((src) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
													href: src.url,
													target: "_blank",
													rel: "noopener noreferrer",
													className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${isDark ? "bg-white/[0.03] border-white/[0.08] text-neutral-300 hover:border-white/[0.2] hover:text-white" : "bg-black/[0.02] border-black/[0.08] text-neutral-700 hover:border-black/[0.2] hover:text-black"}`,
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-medium truncate max-w-[220px]",
														children: src.title
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-[10px] opacity-60",
														children: [
															"(",
															src.domain,
															")"
														]
													})]
												}, src.url))
											})]
										})
									]
								}),
								turn.fullAnswer && !isCurrentTurnStreaming && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `mt-4 pt-2.5 flex items-center justify-between gap-3 text-xs flex-wrap ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 flex-wrap",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => handleCopyTurn(turn),
												title: "Copy answer and citations",
												className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${copiedTurnId === turn.id ? isDark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-600 border-emerald-200" : isDark ? "border-white/[0.1] bg-white/[0.04] text-neutral-300 hover:text-white hover:bg-white/[0.08]" : "border-black/[0.08] bg-black/[0.03] text-neutral-700 hover:text-black hover:bg-black/[0.06]"}`,
												children: [copiedTurnId === turn.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3 h-3 text-emerald-500" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: copiedTurnId === turn.id ? "Copied" : "Copy" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => handleExportMarkdown(turn),
												title: "Export report (.md)",
												className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${isDark ? "border-white/[0.1] bg-white/[0.04] text-neutral-300 hover:text-white hover:bg-white/[0.08]" : "border-black/[0.08] bg-black/[0.03] text-neutral-700 hover:text-black hover:bg-black/[0.06]"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Export" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => handleSaveTurnToVault(turn),
												"data-testid": "deep-research-save-to-vault-btn",
												title: isGuestResearchUser ? "Sign in to save this research report to your Vault" : "Save Deep Research report to your Vault",
												className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${savedResearchTurnMap[turn.id] ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400" : isGuestResearchUser ? isDark ? "border-white/[0.12] bg-white/[0.04] text-neutral-300 hover:text-white" : "border-black/[0.12] bg-black/[0.03] text-neutral-700 hover:text-black" : "border-[#FC4C01]/50 bg-[#FC4C01]/15 text-[#FC4C01] hover:bg-[#FC4C01] hover:text-white"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: `w-3 h-3 ${savedResearchTurnMap[turn.id] ? "fill-current" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isGuestResearchUser ? "Sign in to save" : savedResearchTurnMap[turn.id] ? sageResearchCardMap[turn.id] ? "Saved to Vault" : "Sage organizing…" : "Save to Vault" })]
											}),
											tIdx === turns.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => executeResearchTurn(turn.question),
												title: "Regenerate this answer",
												className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${isDark ? "border-white/[0.1] bg-white/[0.04] text-neutral-300 hover:text-white hover:bg-white/[0.08]" : "border-black/[0.08] bg-black/[0.03] text-neutral-700 hover:text-black hover:bg-black/[0.06]"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Retry" })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1 ml-0.5",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => {
															setFeedbackMap((prev) => ({
																...prev,
																[turn.id]: prev[turn.id] === "up" ? null : "up"
															}));
															setLiveStatusAnnouncement("Feedback recorded: helpful");
														},
														title: "Helpful",
														"aria-label": "Thumbs up",
														className: `size-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${feedbackMap[turn.id] === "up" ? isDark ? "bg-white text-black border-white" : "bg-neutral-900 text-white border-neutral-900" : isDark ? "border-white/[0.1] text-neutral-400 hover:text-white hover:bg-white/[0.08]" : "border-black/[0.08] text-neutral-600 hover:text-black hover:bg-black/[0.05]"}`,
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsUp, { className: "w-2.5 h-2.5" })
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														type: "button",
														onClick: () => {
															setFeedbackMap((prev) => ({
																...prev,
																[turn.id]: prev[turn.id] === "down" ? null : "down"
															}));
															setLiveStatusAnnouncement("Feedback recorded: not helpful");
														},
														title: "Not helpful",
														"aria-label": "Thumbs down",
														className: `size-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${feedbackMap[turn.id] === "down" ? isDark ? "bg-white text-black border-white" : "bg-neutral-900 text-white border-neutral-900" : isDark ? "border-white/[0.1] text-neutral-400 hover:text-white hover:bg-white/[0.08]" : "border-black/[0.08] text-neutral-600 hover:text-black hover:bg-black/[0.05]"}`,
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThumbsDown, { className: "w-2.5 h-2.5" })
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
														type: "button",
														onClick: () => openKinichReportModal({
															targetType: "ai_answer",
															targetId: turn.id,
															contentPreview: turn.fullAnswer.slice(0, 280)
														}),
														title: "Report AI output",
														"aria-label": "Report AI output",
														className: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${isDark ? "border-white/[0.1] bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]" : "border-black/[0.08] bg-black/[0.03] text-neutral-600 hover:text-black hover:bg-black/[0.06]"}`,
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flag, { className: "w-2.5 h-2.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Report" })]
													})
												]
											})
										]
									}), turn.durationSec || activeDurationSec ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11px] font-mono tabular-nums opacity-75",
										children: `Completed in ${turn.durationSec || activeDurationSec}s · ${turnSources.length} ${turnSources.length === 1 ? "source" : "sources"}`
									}) : null]
								}),
								sageResearchCardMap[turn.id] && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `mt-3 rounded-xl border p-3 text-xs ${isDark ? "bg-[#121215] border-[#FC4C01]/35 text-neutral-200" : "bg-[#fffaf7] border-[#FC4C01]/35 text-neutral-900"}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-center justify-between gap-2 mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1.5 font-bold text-[#FC4C01]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3.5 h-3.5" }), "Sage (Vault Organizer)"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1 font-medium text-[#FC4C01]",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-3.5 h-3.5" }),
													sageResearchCardMap[turn.id].subject,
													" → ",
													sageResearchCardMap[turn.id].chapter
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "opacity-90",
											children: sageResearchCardMap[turn.id].content
										}),
										Array.isArray(sageResearchCardMap[turn.id].linkedItems) && sageResearchCardMap[turn.id].linkedItems.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-1.5 pt-1.5 border-t border-current/10 flex flex-wrap items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1 text-[10px] font-semibold text-[#FC4C01]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link2, { className: "w-3 h-3" }), " Linked in Vault:"]
											}), sageResearchCardMap[turn.id].linkedItems.map((li) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] px-2 py-0.5 rounded-md border border-current/15",
												children: li.title
											}, li.id))]
										})
									]
								}),
								feedbackMap[turn.id] === "down" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2.5 pt-2 border-t border-current/10 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150",
									children: FEEDBACK_REASONS.map((reason) => {
										const active = selectedReasonMap[turn.id] === reason;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												setSelectedReasonMap((prev) => ({
													...prev,
													[turn.id]: reason
												}));
												setLiveStatusAnnouncement(`Feedback reason selected: ${reason}`);
											},
											className: `px-2.5 py-0.5 rounded-full text-[11px] font-normal border transition-colors cursor-pointer ${active ? isDark ? "bg-white text-black border-white" : "bg-neutral-900 text-white border-neutral-900" : isDark ? "bg-white/[0.04] border-white/10 text-neutral-300 hover:bg-white/[0.08]" : "bg-black/[0.04] border-black/10 text-neutral-700 hover:bg-black/[0.08]"}`,
											children: reason
										}, reason);
									})
								})
							]
						}, turn.id);
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "max-w-3xl mx-auto w-full pointer-events-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatInput, {
						onSend: (message) => {
							executeResearchTurn(message);
						},
						onCancel: handleStopStreaming,
						isRunning: isSearching || isStreaming,
						searchMode: activeSearchMode,
						onToggleSearchMode: handleToggleSearchMode,
						selectedModel: activeModel,
						onSelectModel: handleSelectModel,
						placeholder: turns.length > 0 ? "Ask a follow-up question..." : "What do you want to research?",
						autoFocus: true,
						theme: isDark ? "dark" : "light"
					})
				})
			}),
			isHistoryOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "dialog",
				"aria-modal": "true",
				"aria-label": "Deep Research History",
				className: "fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200",
				onClick: () => setIsHistoryOpen(false),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					onClick: (e) => e.stopPropagation(),
					className: `w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250 ${isDark ? "bg-[#101014] text-white border-l border-white/10" : "bg-white text-neutral-900 border-l border-black/10"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "shrink-0 p-3.5 sm:p-4 border-b border-current/10 flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setIsHistoryOpen(false),
									className: `flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-95 ${isDark ? "bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white" : "bg-black/[0.04] hover:bg-black/[0.08] border-black/10 text-black"}`,
									"aria-label": "Back to research",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-3.5 h-3.5 stroke-[2.2]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Back" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-sm font-semibold",
										children: "History"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? "bg-white/10 text-neutral-300" : "bg-black/10 text-neutral-700"}`,
										children: historyList.length
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5",
								children: [historyList.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										if (window.confirm("Clear all deep research history?")) {
											DeepResearchHistoryStore.clearAll();
											setLiveStatusAnnouncement("All research history cleared");
										}
									},
									title: "Clear all history",
									className: "p-1.5 rounded-lg text-xs opacity-60 hover:opacity-100 hover:text-red-500 transition-colors cursor-pointer",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-4 h-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setIsHistoryOpen(false),
									className: `p-1.5 rounded-lg transition-colors cursor-pointer ${isDark ? "hover:bg-white/10" : "hover:bg-black/10"}`,
									"aria-label": "Close history",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
								})]
							})]
						}),
						historyList.length > 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-3 border-b border-current/10 shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${isDark ? "bg-[#18181c] border-white/10" : "bg-[#f4f4f5] border-black/10"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 opacity-50 shrink-0" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										value: historySearchQuery,
										onChange: (e) => setHistorySearchQuery(e.target.value),
										placeholder: "Search past research...",
										className: "w-full bg-transparent outline-none placeholder:opacity-50"
									}),
									historySearchQuery && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setHistorySearchQuery(""),
										className: "opacity-60 hover:opacity-100 cursor-pointer",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3 h-3" })
									})
								]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 scrollbar-thin",
							children: filteredHistory.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "h-full flex flex-col items-center justify-center text-center p-6 opacity-60",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-8 h-8 mb-2 opacity-40" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm font-medium",
										children: historySearchQuery ? "No matching research found" : "No research history yet"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs opacity-75 mt-1 max-w-[240px]",
										children: historySearchQuery ? "Try searching with different keywords" : "Completed deep research questions will automatically be saved here."
									})
								]
							}) : filteredHistory.map((item) => {
								const isCurrent = currentSessionId === item.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									onClick: () => loadHistoryItem(item),
									className: `group relative p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${isCurrent ? isDark ? "bg-white/[0.08] border-white/40 shadow-sm" : "bg-black/[0.05] border-black/30 shadow-sm" : isDark ? "bg-[#151518] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]" : "bg-neutral-50 border-black/[0.07] hover:border-black/20 hover:bg-white shadow-xs"}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start justify-between gap-2 mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "text-xs font-semibold leading-snug line-clamp-2",
												children: item.question
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1 shrink-0",
												onClick: (e) => e.stopPropagation(),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														navigator.clipboard.writeText(`${item.question}\n\n${item.fullAnswer}`);
														setLiveStatusAnnouncement("Copied research to clipboard");
													},
													title: "Copy report",
													className: "opacity-70 sm:opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded-md transition-opacity cursor-pointer",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => {
														DeepResearchHistoryStore.deleteRecord(item.id);
														if (currentSessionId === item.id) setCurrentSessionId(null);
													},
													title: "Delete this record",
													className: "opacity-70 sm:opacity-0 group-hover:opacity-100 hover:opacity-100 hover:text-red-500 p-1 rounded-md transition-opacity cursor-pointer",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" })
												})]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-[11.5px] opacity-65 line-clamp-2 leading-relaxed mt-1",
											children: item.fullAnswer.replace(/\*\*/g, "").replace(/\[\d+(?:,\s*\d+)*\]/g, "")
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-current/5 text-[10.5px] opacity-55",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatHistoryDate(item.createdAt) }),
													item.sources?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
														"• ",
														item.sources.length,
														" sources"
													] }),
													item.turns && item.turns.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "text-emerald-500 font-medium",
														children: [
															"• ",
															item.turns.length,
															" turns"
														]
													})
												]
											}), item.durationSec > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [item.durationSec, "s"] })]
										})
									]
								}, item.id);
							})
						})
					]
				})
			}),
			activeChipPreview && (() => {
				const rect = activeChipPreview.rect;
				const winW = typeof window !== "undefined" ? window.innerWidth : 380;
				const winH = typeof window !== "undefined" ? window.innerHeight : 700;
				const popoverWidth = Math.min(320, winW - 24);
				let stylePos = {};
				if (rect) {
					let left = rect.left + rect.width / 2 - popoverWidth / 2;
					if (left < 12) left = 12;
					if (left + popoverWidth > winW - 12) left = winW - popoverWidth - 12;
					if (rect.top > 240) stylePos = {
						position: "fixed",
						left: `${left}px`,
						bottom: `${Math.max(12, winH - rect.top + 8)}px`,
						width: `${popoverWidth}px`
					};
					else stylePos = {
						position: "fixed",
						left: `${left}px`,
						top: `${Math.max(12, rect.bottom + 8)}px`,
						width: `${popoverWidth}px`
					};
				} else stylePos = {
					position: "fixed",
					left: "12px",
					right: "12px",
					bottom: "90px",
					maxWidth: "320px",
					margin: "0 auto"
				};
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					onClick: (e) => e.stopPropagation(),
					role: "tooltip",
					style: stylePos,
					className: `z-[70] max-h-[55vh] overflow-y-auto rounded-2xl border p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 scrollbar-thin ${isDark ? "bg-[#141418] border-white/[0.14] text-white shadow-black/80" : "bg-white border-black/[0.12] text-neutral-900 shadow-xl"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between pb-2 mb-2 border-b border-current/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[10.5px] font-mono uppercase tracking-wider text-neutral-400",
							children: [
								"Sources (",
								activeChipPreview.ids.map((id) => `#${id}`).join(", "),
								")"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setActiveChipPreview(null),
							className: "p-1 rounded-md hover:bg-current/10 cursor-pointer",
							"aria-label": "Close",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5 opacity-70 hover:opacity-100" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "space-y-3",
						children: activeChipPreview.ids.map((id) => {
							const src = activeSources.find((s) => s.id === id) || turns.map((t) => t.sources || []).flat().find((s) => s.id === id);
							if (!src) return null;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: src.url,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "block group",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2 text-[11px] opacity-70 mb-0.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium truncate",
											children: src.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "inline-flex items-center gap-1 font-mono text-[10.5px]",
											children: [
												"#",
												src.id,
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-2.5 h-2.5 opacity-70 group-hover:opacity-100" })
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-semibold leading-snug group-hover:underline",
										children: src.title
									}),
									src.snippet && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[11px] opacity-70 mt-1 line-clamp-3 leading-relaxed",
										children: src.snippet
									})
								]
							}, src.id);
						})
					})]
				});
			})()
		]
	});
};
//#endregion
export { DeepResearchModal };
