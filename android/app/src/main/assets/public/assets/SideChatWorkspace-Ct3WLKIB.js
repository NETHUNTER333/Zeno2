import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { At as Layers, In as ArrowUpRight, L as Sparkles, at as Plus, f as X, mn as Clock, vn as CircleCheck, yt as MessageSquare } from "./react-vendor-ZF-Fgzq4.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { i as openHitaishiWithWorkspaceScope, o as saveSideChatTasksToHitaishiBridge } from "./hitaishiWorkspaceBridge-D7J3Nlf7.js";
//#region src/components/SideChatWorkspace.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var SideChatWorkspace = ({ isOpen, onClose, isDark, onAskKinich }) => {
	const [tasks, setTasks] = (0, import_react.useState)([{
		id: "task-1",
		title: "Build CRM pipeline stages",
		status: "completed",
		prompt: "Please break down the sales pipeline stages for enterprise SaaS CRM.",
		response: "1. Lead Qualified\n2. Demo / Discovery\n3. Technical Evaluation\n4. Proposal & Pricing\n5. Closed Won",
		timestamp: "12m ago"
	}, {
		id: "task-2",
		title: "Q4 Product Launch checklist",
		status: "running",
		prompt: "Propose a launch checklist for Q4 product roadmap rollout.",
		response: "Synthesizing action items across marketing, engineering QA, and docs...",
		timestamp: "Just now"
	}]);
	const [activeTaskId, setActiveTaskId] = (0, import_react.useState)("task-2");
	const [newSubTaskPrompt, setNewSubTaskPrompt] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		saveSideChatTasksToHitaishiBridge(tasks);
	}, [tasks]);
	if (!isOpen) return null;
	const activeTask = tasks.find((t) => t.id === activeTaskId) || tasks[0];
	const handleCreateSubtask = (e) => {
		e.preventDefault();
		if (!newSubTaskPrompt.trim()) return;
		const newId = `task-${Date.now()}`;
		const newTask = {
			id: newId,
			title: newSubTaskPrompt.trim().slice(0, 28) + "…",
			status: "running",
			prompt: newSubTaskPrompt.trim(),
			response: "Analyzing and executing side task in parallel...",
			timestamp: "Just now"
		};
		setTasks((prev) => [newTask, ...prev]);
		setActiveTaskId(newId);
		setNewSubTaskPrompt("");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `relative w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden border shadow-2xl flex flex-col ${isDark ? "bg-[#0f0f11] border-white/[0.15] text-white" : "bg-white border-black/10 text-[#0d0d0d]"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `flex items-center justify-between px-4 py-3 border-b text-xs ${isDark ? "border-white/[0.08]" : "border-black/[0.08]"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FC4C01] to-amber-500 flex items-center justify-center text-white shadow-md",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "w-4 h-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-semibold text-sm",
							children: "Side Chat & Parallel Subtasks"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
							children: "Run several tasks at once without interrupting your main conversation."
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => {
								onClose();
								openHitaishiWithWorkspaceScope("sidechat", activeTask ? `Help me review my SideChat subtask "${activeTask.title}".` : void 0);
							},
							className: `h-8 px-3 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${isDark ? "bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white" : "bg-black/[0.04] hover:bg-black/[0.08] border-black/12 text-black"}`,
							title: "Discuss SideChat tasks with Hitaishi Companion",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: "/hitaishi-assets/characters/n01/avatar.webp",
								alt: "Hitaishi",
								className: "w-4 h-4 rounded-full object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hitaishi" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onClose,
							className: `p-1.5 rounded-full transition-colors cursor-pointer ${isDark ? "hover:bg-white/10 text-neutral-300" : "hover:bg-black/5 text-neutral-700"}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `flex items-center gap-1.5 px-4 py-2 border-b overflow-x-auto scrollbar-none ${isDark ? "bg-neutral-900/40 border-white/[0.06]" : "bg-neutral-50 border-black/[0.06]"}`,
					children: [tasks.map((task) => {
						const isActive = task.id === activeTaskId;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setActiveTaskId(task.id),
							className: `flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shrink-0 cursor-pointer ${isActive ? isDark ? "bg-white text-black border-white shadow-sm" : "bg-black text-white border-black shadow-sm" : isDark ? "bg-white/[0.03] border-white/10 text-neutral-300 hover:border-white/20" : "bg-white border-black/10 text-neutral-700 hover:border-black/20"}`,
							children: [
								task.status === "completed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-3.5 h-3.5 text-emerald-500 shrink-0" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate max-w-[160px]",
									children: task.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									onClick: (e) => {
										e.stopPropagation();
										setTasks((prev) => prev.filter((t) => t.id !== task.id));
										if (activeTaskId === task.id && tasks.length > 1) {
											const rem = tasks.filter((t) => t.id !== task.id);
											setActiveTaskId(rem[0].id);
										}
									},
									className: "opacity-60 hover:opacity-100 ml-1",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3 h-3" })
								})
							]
						}, task.id);
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: handleCreateSubtask,
						className: "flex items-center gap-1 ml-auto",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							value: newSubTaskPrompt,
							onChange: (e) => setNewSubTaskPrompt(e.target.value),
							placeholder: "New side question...",
							className: `text-xs px-3 py-1.5 rounded-xl border outline-none w-44 sm:w-56 ${isDark ? "bg-neutral-900 border-white/15 text-white placeholder-neutral-500" : "bg-white border-black/15 text-black placeholder-neutral-400"}`
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							className: `p-1.5 rounded-xl border flex items-center justify-center cursor-pointer ${isDark ? "bg-white/10 hover:bg-white/20 border-white/15 text-white" : "bg-black/5 hover:bg-black/10 border-black/15 text-black"}`,
							title: "Spawn side task",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-3.5 h-3.5" })
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4",
					children: activeTask ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-2xl mx-auto space-y-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-4 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/10" : "bg-neutral-50 border-black/10"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[11px] font-medium opacity-60 mb-1",
									children: "Side Prompt"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-semibold",
									children: activeTask.prompt
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-[10px] opacity-50 mt-2 flex items-center gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3 h-3" }),
										" ",
										activeTask.timestamp
									]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-4 rounded-2xl border ${isDark ? "bg-[#141416] border-white/10 text-neutral-200" : "bg-white border-black/10 text-neutral-800"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between mb-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 text-xs font-semibold",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3.5 h-3.5 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "AI Synthesis" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => {
										onAskKinich(activeTask.prompt);
										onClose();
									},
									className: `px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1 cursor-pointer ${isDark ? "bg-white/10 hover:bg-white/15 border-white/20 text-white" : "bg-black/5 hover:bg-black/10 border-black/20 text-black"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Bring to Main Chat" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "w-3 h-3" })]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs sm:text-sm whitespace-pre-wrap leading-relaxed",
								children: activeTask.response
							})]
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col items-center justify-center h-full text-center opacity-60 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-8 h-8 mb-2" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "No side tasks active. Type above to spin off a parallel question." })]
					})
				})
			]
		})
	});
};
//#endregion
export { SideChatWorkspace, SideChatWorkspace as default };
