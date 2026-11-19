import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { A as Target, Bn as Activity, Dn as Calendar, G as Shield, Gt as Flame, Sn as ChevronLeft, Vt as Gift, b as Trophy, f as X, jn as Bell, mn as Clock, u as Zap, v as Upload, wn as Check, xn as ChevronRight, yt as MessageSquare } from "./react-vendor-ZF-Fgzq4.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { at as toLocalDateKey, nt as STREAK_MILESTONES, rt as UserAccountStore } from "./index-DaFzEGR-.js";
//#region src/components/StreakModal.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var WEEKDAYS = [
	"Sun",
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat"
];
var DAILY_GOAL_OPTIONS = [
	{
		value: 1,
		label: "1x / day",
		desc: "Casual maintenance"
	},
	{
		value: 3,
		label: "3x / day",
		desc: "Regular momentum"
	},
	{
		value: 5,
		label: "5x / day",
		desc: "Deep researcher"
	},
	{
		value: 10,
		label: "10x / day",
		desc: "Intense workflow"
	}
];
var StreakModal = ({ isOpen, onClose, streak, isDark, initialTab = "calendar" }) => {
	const [activeTab, setActiveTab] = (0, import_react.useState)(initialTab);
	const [badgeCategory, setBadgeCategory] = (0, import_react.useState)("all");
	const [badges, setBadges] = (0, import_react.useState)(() => UserAccountStore.getEvaluatedBadges());
	(0, import_react.useEffect)(() => {
		if (isOpen) {
			setActiveTab(initialTab);
			setBadges(UserAccountStore.getEvaluatedBadges());
		}
	}, [
		isOpen,
		initialTab,
		streak
	]);
	const todayKey = (0, import_react.useMemo)(() => toLocalDateKey(), []);
	const [viewMonthDate, setViewMonthDate] = (0, import_react.useState)(() => {
		const now = /* @__PURE__ */ new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1);
	});
	const [selectedDateKey, setSelectedDateKey] = (0, import_react.useState)(todayKey);
	const [statusBanner, setStatusBanner] = (0, import_react.useState)(null);
	const activeSet = (0, import_react.useMemo)(() => new Set(streak.activeDates || []), [streak.activeDates]);
	const frozenSet = (0, import_react.useMemo)(() => new Set(streak.frozenDates || []), [streak.frozenDates]);
	const claimedSet = (0, import_react.useMemo)(() => new Set(streak.claimedMilestones || []), [streak.claimedMilestones]);
	const consistency30d = (0, import_react.useMemo)(() => {
		const now = /* @__PURE__ */ new Date();
		let activeInLast30 = 0;
		for (let i = 0; i < 30; i++) {
			const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
			const key = toLocalDateKey(d.getTime());
			if (activeSet.has(key) || frozenSet.has(key)) activeInLast30 += 1;
		}
		const [ey, em, ed] = (streak.activeDates?.[0] || todayKey).split("-").map(Number);
		const earliestTs = new Date(ey, (em || 1) - 1, ed || 1).getTime();
		const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const spanDays = Math.max(1, Math.min(30, Math.round((todayTs - earliestTs) / 864e5) + 1));
		return Math.min(100, Math.round(activeInLast30 / spanDays * 100));
	}, [
		activeSet,
		frozenSet,
		streak.activeDates,
		todayKey
	]);
	const calendarDays = (0, import_react.useMemo)(() => {
		const year = viewMonthDate.getFullYear();
		const month = viewMonthDate.getMonth();
		const firstDayOfWeek = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const cells = [];
		for (let i = 0; i < firstDayOfWeek; i++) cells.push({
			key: null,
			dayNum: null,
			isActive: false,
			isFrozen: false,
			isToday: false,
			isFuture: false,
			count: 0,
			goalMet: false
		});
		for (let day = 1; day <= daysInMonth; day++) {
			const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			const isActive = activeSet.has(key);
			const isFrozen = frozenSet.has(key);
			const count = Number(streak.dailyCounts?.[key] || (isActive ? 1 : 0));
			const isToday = key === todayKey;
			const isFuture = key > todayKey;
			const goalMet = isActive && count >= (streak.dailyGoal || 3);
			cells.push({
				key,
				dayNum: day,
				isActive,
				isFrozen,
				isToday,
				isFuture,
				count,
				goalMet
			});
		}
		return cells;
	}, [
		viewMonthDate,
		activeSet,
		frozenSet,
		streak.dailyCounts,
		streak.dailyGoal,
		todayKey
	]);
	const monthStats = (0, import_react.useMemo)(() => {
		let activeDaysInMonth = 0;
		let totalInteractionsInMonth = 0;
		let goalMetDaysInMonth = 0;
		for (const c of calendarDays) {
			if (!c.key) continue;
			if (c.isActive) {
				activeDaysInMonth += 1;
				totalInteractionsInMonth += c.count;
			}
			if (c.goalMet) goalMetDaysInMonth += 1;
		}
		return {
			activeDaysInMonth,
			totalInteractionsInMonth,
			goalMetDaysInMonth
		};
	}, [calendarDays]);
	const nextMilestone = (0, import_react.useMemo)(() => {
		return STREAK_MILESTONES.find((m) => m.days > streak.currentStreak) || STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
	}, [streak.currentStreak]);
	const unclaimedCount = (0, import_react.useMemo)(() => {
		const maxReached = Math.max(streak.currentStreak, streak.longestStreak);
		return STREAK_MILESTONES.filter((m) => maxReached >= m.days && !claimedSet.has(m.days)).length;
	}, [
		streak.currentStreak,
		streak.longestStreak,
		claimedSet
	]);
	(0, import_react.useMemo)(() => badges.filter((b) => b.isUnlocked).length, [badges]);
	(0, import_react.useMemo)(() => badges.filter((b) => b.isUnlocked && !b.isClaimed).length, [badges]);
	(0, import_react.useMemo)(() => {
		if (badgeCategory === "all") return badges;
		return badges.filter((b) => b.category === badgeCategory);
	}, [badges, badgeCategory]);
	if (!isOpen) return null;
	const selectedDayInfo = (() => {
		const isAct = activeSet.has(selectedDateKey);
		const isFrz = frozenSet.has(selectedDateKey);
		const cnt = Number(streak.dailyCounts?.[selectedDateKey] || (isAct ? 1 : 0));
		return {
			isAct,
			isFrz,
			cnt,
			goalMet: isAct && cnt >= (streak.dailyGoal || 3)
		};
	})();
	const handlePrevMonth = () => {
		setViewMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
	};
	const handleNextMonth = () => {
		setViewMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
	};
	const handleJumpToday = () => {
		const now = /* @__PURE__ */ new Date();
		setViewMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
		setSelectedDateKey(todayKey);
	};
	const isGuest = UserAccountStore.isGuest();
	const handleClaimMilestone = (days) => {
		if (UserAccountStore.isGuest()) {
			onClose();
			window.dispatchEvent(new CustomEvent("kinich-open-auth", { detail: { reason: "Sign in to claim your streak bonus" } }));
			return;
		}
		const res = UserAccountStore.claimStreakMilestone(days);
		if (res.rewarded && res.milestone) {
			setStatusBanner(`Claimed ${res.milestone.title}: +${res.milestone.bonusMessages} messages, +${res.milestone.bonusUploads} uploads${res.milestone.bonusShields ? `, +${res.milestone.bonusShields} Streak Shield` : ""}`);
			setTimeout(() => setStatusBanner(null), 4500);
		}
	};
	const handleSelectDailyGoal = (goal) => {
		UserAccountStore.setDailyStreakGoal(goal);
		setStatusBanner(`Daily interaction target updated to ${goal}x per day.`);
		setTimeout(() => setStatusBanner(null), 3e3);
	};
	const handleForgeShield = () => {
		if (UserAccountStore.refillStreakFreeze().refilled) {
			setStatusBanner("Streak Shield forged and equipped (+1 Shield).");
			setTimeout(() => setStatusBanner(null), 3500);
		}
	};
	const handleToggleReminder = () => {
		const nextEnabled = !streak.reminderEnabled;
		UserAccountStore.updateStreakReminderSettings({ reminderEnabled: nextEnabled });
		setStatusBanner(nextEnabled ? `Daily streak reminder enabled for ${streak.reminderTime || "18:00"}.` : "Daily streak reminder paused.");
		setTimeout(() => setStatusBanner(null), 3e3);
	};
	const handleChangeReminderTime = (newTime) => {
		if (!/^\d{2}:\d{2}$/.test(newTime)) return;
		UserAccountStore.updateStreakReminderSettings({
			reminderEnabled: true,
			reminderTime: newTime
		});
		setStatusBanner(`Daily streak reminder time set to ${newTime}.`);
		setTimeout(() => setStatusBanner(null), 3e3);
	};
	const dailyGoalTarget = Math.max(1, streak.dailyGoal || 3);
	const todayGoalProgress = Math.min(100, Math.max(0, Math.round(streak.todayInteractions / dailyGoalTarget * 100)));
	const isDailyGoalExceeded = streak.todayInteractions > dailyGoalTarget;
	const isDailyGoalReached = streak.todayInteractions >= dailyGoalTarget;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs",
		onClick: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			onClick: (e) => e.stopPropagation(),
			className: `w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] ${isDark ? "bg-[#0a0a0a] border-white/15 text-white" : "bg-white border-black/10 text-neutral-900"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `px-5 py-4 border-b flex items-center justify-between ${isDark ? "border-white/10 bg-white/[0.01]" : "border-black/10 bg-neutral-50/60"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `w-9 h-9 rounded-xl border flex items-center justify-center ${isDark ? "bg-[#FC4C01]/10 border-[#FC4C01]/30" : "bg-[#FC4C01]/10 border-[#FC4C01]/25"}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "w-4 h-4 text-[#FC4C01] fill-[#FC4C01]/20" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-semibold tracking-tight",
								children: "Streaks, Milestones & Consistency"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs font-mono tabular-nums font-semibold text-[#FC4C01]",
								children: [
									streak.currentStreak,
									" ",
									streak.currentStreak === 1 ? "Day" : "Days"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
							children: "Calendar heatmap, milestone message rewards & streak shield protection"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onClose,
						className: `p-1.5 rounded-lg transition-colors cursor-pointer ${isDark ? "text-neutral-400 hover:text-white hover:bg-white/10" : "text-neutral-500 hover:text-black hover:bg-black/5"}`,
						"aria-label": "Close modal",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `grid grid-cols-3 border-b ${isDark ? "border-white/10 bg-[#0d0d0d]" : "border-black/10 bg-neutral-50/40"}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `px-4 py-3 border-r ${isDark ? "border-white/10" : "border-black/10"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `text-[10px] uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
								children: "Current"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-base font-semibold font-mono tabular-nums mt-0.5 flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [streak.currentStreak, "d"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flame, { className: "w-3.5 h-3.5 text-[#FC4C01] fill-[#FC4C01]/20" })]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `px-4 py-3 border-r ${isDark ? "border-white/10" : "border-black/10"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `text-[10px] uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
								children: "Best Streak"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-base font-semibold font-mono tabular-nums mt-0.5",
								children: [streak.longestStreak, "d"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `text-[10px] uppercase tracking-wider ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
								children: "Consistency"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-base font-semibold font-mono tabular-nums mt-0.5",
								children: [consistency30d, "%"]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "tablist",
					"aria-label": "Streak and rewards sections",
					className: `px-4 sm:px-5 pt-3 border-b flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none text-xs ${isDark ? "border-white/10" : "border-black/10"}`,
					children: [
						{
							id: "calendar",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "w-3.5 h-3.5" }),
							label: "Streak Calendar",
							badgeCount: 0
						},
						{
							id: "milestones",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, { className: "w-3.5 h-3.5" }),
							label: "Milestones",
							badgeCount: unclaimedCount
						},
						{
							id: "protection",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-3.5 h-3.5" }),
							label: "Shield & Goals",
							badgeCount: 0
						}
					].map((tItem, idx, arr) => {
						const isSelected = activeTab === tItem.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							id: `streak-tab-${tItem.id}`,
							type: "button",
							role: "tab",
							"aria-selected": isSelected,
							"aria-controls": `streak-tabpanel-${tItem.id}`,
							tabIndex: isSelected ? 0 : -1,
							onClick: () => setActiveTab(tItem.id),
							onKeyDown: (e) => {
								if (e.key === "ArrowRight" || e.key === "ArrowDown") {
									e.preventDefault();
									const next = arr[(idx + 1) % arr.length];
									setActiveTab(next.id);
									document.getElementById(`streak-tab-${next.id}`)?.focus();
								} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
									e.preventDefault();
									const prev = arr[(idx - 1 + arr.length) % arr.length];
									setActiveTab(prev.id);
									document.getElementById(`streak-tab-${prev.id}`)?.focus();
								} else if (e.key === "Home") {
									e.preventDefault();
									setActiveTab(arr[0].id);
									document.getElementById(`streak-tab-${arr[0].id}`)?.focus();
								} else if (e.key === "End") {
									e.preventDefault();
									const last = arr[arr.length - 1];
									setActiveTab(last.id);
									document.getElementById(`streak-tab-${last.id}`)?.focus();
								}
							},
							className: `pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${isSelected ? "border-[#FC4C01] text-[#FC4C01]" : isDark ? "border-transparent text-neutral-400 hover:text-white" : "border-transparent text-neutral-500 hover:text-black"}`,
							children: [
								tItem.icon,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: tItem.label }),
								tItem.badgeCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-[#FC4C01] text-white",
									children: tItem.badgeCount
								})
							]
						}, tItem.id);
					})
				}),
				statusBanner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `mx-5 mt-3 px-3.5 py-2 rounded-xl border text-xs flex items-center justify-between ${isDark ? "bg-[#FC4C01]/10 border-[#FC4C01]/30 text-white" : "bg-[#FC4C01]/10 border-[#FC4C01]/30 text-neutral-900"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium",
						children: statusBanner
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setStatusBanner(null),
						"aria-label": "Dismiss status message",
						title: "Dismiss status message",
						className: "opacity-70 hover:opacity-100 cursor-pointer",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					id: `streak-tabpanel-${activeTab}`,
					role: "tabpanel",
					"aria-labelledby": `streak-tab-${activeTab}`,
					className: "p-4 sm:p-5 overflow-y-auto slim-scrollbar flex-1 space-y-4",
					children: [
						activeTab === "calendar" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm font-semibold",
									children: viewMonthDate.toLocaleDateString("en-US", {
										month: "long",
										year: "numeric"
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `text-[11px] font-mono tabular-nums ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
									children: [
										monthStats.activeDaysInMonth,
										" active",
										" ",
										monthStats.activeDaysInMonth === 1 ? "day" : "days",
										" ·",
										" ",
										monthStats.totalInteractionsInMonth,
										" interactions ·",
										" ",
										monthStats.goalMetDaysInMonth,
										" full-goal",
										" ",
										monthStats.goalMetDaysInMonth === 1 ? "day" : "days"
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleJumpToday,
											className: `px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${isDark ? "border-white/10 hover:bg-white/[0.06] text-neutral-300" : "border-black/10 hover:bg-black/[0.04] text-neutral-700"}`,
											children: "Today"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handlePrevMonth,
											className: `p-1.5 rounded-lg border transition-colors cursor-pointer ${isDark ? "border-white/10 hover:bg-white/[0.06] text-neutral-300" : "border-black/10 hover:bg-black/[0.04] text-neutral-700"}`,
											title: "Previous month",
											"aria-label": "Previous month",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "w-3.5 h-3.5" })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: handleNextMonth,
											className: `p-1.5 rounded-lg border transition-colors cursor-pointer ${isDark ? "border-white/10 hover:bg-white/[0.06] text-neutral-300" : "border-black/10 hover:bg-black/[0.04] text-neutral-700"}`,
											title: "Next month",
											"aria-label": "Next month",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "w-3.5 h-3.5" })
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-3.5 rounded-xl border ${isDark ? "bg-[#0f0f0f] border-white/10" : "bg-neutral-50/70 border-black/10"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid grid-cols-7 gap-1.5 mb-2",
										children: WEEKDAYS.map((dayName) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: `text-center text-[10px] font-mono uppercase tracking-wider ${isDark ? "text-neutral-500" : "text-neutral-400"}`,
											children: dayName
										}, dayName))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid grid-cols-7 gap-1.5",
										children: calendarDays.map((cell, idx) => {
											if (!cell.key || cell.dayNum === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-10 rounded-lg" }, `empty-${idx}`);
											const isSelected = cell.key === selectedDateKey;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => setSelectedDateKey(cell.key),
												className: `h-10 rounded-lg border flex flex-col items-center justify-center relative font-mono tabular-nums transition-all cursor-pointer ${cell.goalMet ? "bg-[#FC4C01] border-[#FC4C01] text-white font-semibold" : cell.isActive ? isDark ? "bg-[#FC4C01]/15 border-[#FC4C01]/50 text-[#FC4C01] font-semibold" : "bg-[#FC4C01]/15 border-[#FC4C01]/50 text-[#FC4C01] font-semibold" : cell.isFrozen ? isDark ? "bg-white/[0.06] border-white/25 text-neutral-200" : "bg-neutral-200/70 border-black/25 text-neutral-800" : cell.isFuture ? isDark ? "bg-transparent border-white/[0.03] text-neutral-700" : "bg-transparent border-black/[0.03] text-neutral-300" : isDark ? "bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:border-white/20" : "bg-white border-black/[0.06] text-neutral-500 hover:border-black/20"} ${isSelected ? isDark ? "ring-2 ring-white/70" : "ring-2 ring-black/70" : ""}`,
												title: `${cell.key}: ${cell.isActive ? `${cell.count} interaction${cell.count === 1 ? "" : "s"}` : cell.isFrozen ? "Protected by Streak Shield" : "No recorded activity"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-xs leading-none",
													children: cell.dayNum
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9px] leading-none mt-1 opacity-85",
													children: cell.goalMet ? "★" : cell.isActive ? `${cell.count}x` : cell.isFrozen ? "🛡" : cell.isToday ? "•" : ""
												})]
											}, cell.key);
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${isDark ? "border-white/10 text-neutral-400" : "border-black/10 text-neutral-500"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "inline-flex items-center gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2.5 h-2.5 rounded-xs bg-[#FC4C01] inline-block" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
														"Daily Goal Met (",
														streak.dailyGoal,
														"x+)"
													] })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "inline-flex items-center gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2.5 h-2.5 rounded-xs bg-[#FC4C01]/25 border border-[#FC4C01]/60 inline-block" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Active (1x+)" })]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "inline-flex items-center gap-1.5",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `w-2.5 h-2.5 rounded-xs border inline-block ${isDark ? "bg-white/10 border-white/30" : "bg-neutral-200 border-black/30"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Shielded" })]
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
											"Total: ",
											streak.totalActiveDays,
											" active days"
										] })]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-3.5 rounded-xl border flex items-center justify-between ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs font-semibold font-mono tabular-nums",
									children: selectedDateKey === todayKey ? `Today (${selectedDateKey})` : selectedDateKey
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `text-[11px] mt-0.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
									children: selectedDayInfo.goalMet ? `Daily goal achieved (${selectedDayInfo.cnt}/${streak.dailyGoal} interactions)` : selectedDayInfo.isAct ? `Streak recorded (${selectedDayInfo.cnt}/${streak.dailyGoal} toward daily goal)` : selectedDayInfo.isFrz ? "Protected by Streak Shield — streak preserved" : "No interactions recorded on this date"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-right font-mono tabular-nums",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: `text-xs font-semibold px-2.5 py-1 rounded-lg border ${selectedDayInfo.goalMet ? "bg-[#FC4C01]/15 border-[#FC4C01]/40 text-[#FC4C01]" : selectedDayInfo.isAct ? isDark ? "bg-white/[0.05] border-white/15 text-white" : "bg-neutral-100 border-black/15 text-neutral-900" : isDark ? "bg-white/[0.02] border-white/10 text-neutral-500" : "bg-neutral-50 border-black/10 text-neutral-400"}`,
										children: [
											selectedDayInfo.cnt,
											" ",
											selectedDayInfo.cnt === 1 ? "action" : "actions"
										]
									})
								})]
							})
						] }),
						activeTab === "milestones" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `p-4 rounded-xl border ${isDark ? "bg-[#0f0f0f] border-white/10" : "bg-neutral-50 border-black/10"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between mb-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trophy, { className: "w-4 h-4 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs font-semibold",
											children: ["Next Milestone: ", nextMilestone.title]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs font-mono tabular-nums font-semibold text-[#FC4C01]",
										children: [
											Math.min(streak.currentStreak, nextMilestone.days),
											" / ",
											nextMilestone.days,
											"d"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center justify-between gap-2 mb-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
										children: nextMilestone.subtitle
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "inline-flex items-center gap-2 text-[11px] font-mono tabular-nums font-medium text-[#FC4C01]",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1",
												title: `+${nextMilestone.bonusMessages} Bonus Messages`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", nextMilestone.bonusMessages] })]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: isDark ? "text-white/25" : "text-black/25",
												children: "|"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1",
												title: `+${nextMilestone.bonusUploads} Bonus Uploads`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "w-3.5 h-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", nextMilestone.bonusUploads] })]
											}),
											nextMilestone.bonusShields > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: isDark ? "text-white/25" : "text-black/25",
												children: "|"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1",
												title: `+${nextMilestone.bonusShields} Streak Shield`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-3.5 h-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", nextMilestone.bonusShields] })]
											})] })
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `w-full h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-black/10"}`,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "h-full bg-[#FC4C01] transition-all duration-300",
										style: { width: `${Math.min(100, Math.round(streak.currentStreak / nextMilestone.days * 100))}%` }
									})
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-2.5",
							children: STREAK_MILESTONES.map((m) => {
								const maxReached = Math.max(streak.currentStreak, streak.longestStreak);
								const isUnlocked = maxReached >= m.days;
								const isClaimed = claimedSet.has(m.days);
								const progressPct = Math.min(100, Math.round(maxReached / m.days * 100));
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${isClaimed ? isDark ? "bg-white/[0.02] border-white/10" : "bg-neutral-50/70 border-black/10" : isUnlocked ? "bg-[#FC4C01]/[0.07] border-[#FC4C01]/40" : isDark ? "bg-[#0d0d0d] border-white/[0.07]" : "bg-white border-black/[0.08]"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start gap-3 min-w-0 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: `w-9 h-9 rounded-xl border flex items-center justify-center font-mono tabular-nums text-xs font-semibold shrink-0 ${isUnlocked ? "bg-[#FC4C01]/15 border-[#FC4C01]/40 text-[#FC4C01]" : isDark ? "bg-white/[0.03] border-white/10 text-neutral-400" : "bg-neutral-100 border-black/10 text-neutral-500"}`,
											children: [m.days, "d"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 flex-1",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-xs font-semibold",
														children: m.title
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: `text-[10px] font-mono tabular-nums ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
														children: [progressPct, "%"]
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: `text-[11px] truncate ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
													children: m.subtitle
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2.5 mt-1.5 text-[11px] font-mono tabular-nums font-medium text-[#FC4C01]",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center gap-1",
															title: `+${m.bonusMessages} Bonus Messages`,
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", m.bonusMessages] })]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: isDark ? "text-white/25" : "text-black/25",
															children: "|"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center gap-1",
															title: `+${m.bonusUploads} Bonus Uploads`,
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "w-3.5 h-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", m.bonusUploads] })]
														}),
														m.bonusShields > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: isDark ? "text-white/25" : "text-black/25",
															children: "|"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center gap-1",
															title: `+${m.bonusShields} Streak Shield`,
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-3.5 h-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["+", m.bonusShields] })]
														})] })
													]
												})
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "shrink-0 flex items-center gap-1.5",
										children: isClaimed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: `inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono ${isDark ? "bg-white/[0.04] border-white/10 text-neutral-400" : "bg-neutral-100 border-black/10 text-neutral-500"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3 h-3 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Claimed" })]
										}) : isUnlocked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											type: "button",
											onClick: () => handleClaimMilestone(m.days),
											className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FC4C01] hover:bg-[#e04300] text-white text-xs font-semibold transition-colors cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Gift, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isGuest ? "Sign in to claim" : "Claim Bonus" })]
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: `text-[11px] font-mono tabular-nums ${isDark ? "text-neutral-500" : "text-neutral-400"}`,
											children: [Math.max(0, m.days - maxReached), "d left"]
										})
									})]
								}, m.days);
							})
						})] }),
						activeTab === "protection" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-4 rounded-xl border ${isDark ? "bg-[#0f0f0f] border-white/10" : "bg-neutral-50 border-black/10"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-3 mb-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "w-8 h-8 rounded-lg border border-[#FC4C01]/30 bg-[#FC4C01]/10 flex items-center justify-center",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-4 h-4 text-[#FC4C01]" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "text-xs font-semibold",
												children: "Streak Shield (Automatic Freeze)"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
												children: "Automatically bridges a missed 24-hour window so your streak stays intact"
											})] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs font-mono tabular-nums font-semibold",
											children: [
												streak.streakFreezes,
												" / ",
												streak.maxStreakFreezes || 3,
												" Equipped"
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid grid-cols-3 gap-2.5 mb-3",
										children: [
											0,
											1,
											2
										].map((slotIdx) => {
											const isFilled = slotIdx < streak.streakFreezes;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: `p-2.5 rounded-lg border flex items-center gap-2 font-mono text-xs ${isFilled ? "bg-[#FC4C01]/10 border-[#FC4C01]/40 text-[#FC4C01] font-semibold" : isDark ? "bg-white/[0.02] border-white/10 text-neutral-500" : "bg-white border-black/10 text-neutral-400"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-3.5 h-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isFilled ? "Shield Active" : "Empty Slot" })]
											}, slotIdx);
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2 pt-2 border-t border-white/10",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
											children: streak.streakFreezes >= (streak.maxStreakFreezes || 3) ? "Maximum Streak Shields equipped (3/3)." : streak.lastFreezeEarnedDate === todayKey ? "You already forged a Streak Shield today." : streak.todayInteractions >= streak.dailyGoal ? "Daily goal reached! Forge +1 free Streak Shield now." : `Complete today's daily goal (${streak.todayInteractions}/${streak.dailyGoal}) to forge a Shield.`
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: streak.streakFreezes >= (streak.maxStreakFreezes || 3) || streak.todayInteractions < streak.dailyGoal || streak.lastFreezeEarnedDate === todayKey,
											onClick: handleForgeShield,
											className: `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${streak.streakFreezes < (streak.maxStreakFreezes || 3) && streak.todayInteractions >= streak.dailyGoal && streak.lastFreezeEarnedDate !== todayKey ? "bg-[#FC4C01] hover:bg-[#e04300] text-white cursor-pointer" : isDark ? "bg-white/[0.05] text-neutral-500 cursor-not-allowed" : "bg-black/[0.05] text-neutral-400 cursor-not-allowed"}`,
											children: "Forge +1 Shield"
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-4 rounded-xl border transition-all ${isDailyGoalExceeded ? isDark ? "bg-[#0f0f0f] border-[#FC4C01]/65 ring-1 ring-[#FC4C01]/30 shadow-[0_0_24px_-4px_rgba(252,76,1,0.38)]" : "bg-[#FC4C01]/[0.03] border-[#FC4C01]/60 ring-1 ring-[#FC4C01]/25 shadow-[0_0_20px_-4px_rgba(252,76,1,0.28)]" : isDark ? "bg-[#0f0f0f] border-white/10" : "bg-neutral-50 border-black/10"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap items-center justify-between gap-2 mb-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Target, { className: "w-4 h-4 text-[#FC4C01]" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-xs font-semibold",
													children: "Daily Interaction Goal"
												}),
												isDailyGoalExceeded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FC4C01]/15 text-[#FC4C01] border border-[#FC4C01]/40 shadow-[0_0_10px_rgba(252,76,1,0.25)]",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "w-2.5 h-2.5 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Level Up" })]
												})
											]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs font-mono tabular-nums font-semibold text-[#FC4C01]",
											children: [
												"Today: ",
												streak.todayInteractions,
												" / ",
												dailyGoalTarget,
												" (",
												todayGoalProgress,
												"%",
												isDailyGoalExceeded ? ` · +${streak.todayInteractions - dailyGoalTarget} bonus` : "",
												")"
											]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `w-full h-2.5 rounded-full overflow-hidden mb-3.5 ${isDark ? "bg-white/10" : "bg-black/10"}`,
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: `h-full transition-all duration-300 ${isDailyGoalExceeded ? "bg-gradient-to-r from-[#FC4C01] via-amber-500 to-emerald-400 shadow-[0_0_12px_rgba(252,76,1,0.6)]" : isDailyGoalReached ? "bg-[#FC4C01] shadow-[0_0_8px_rgba(252,76,1,0.4)]" : "bg-[#FC4C01]"}`,
											style: { width: `${todayGoalProgress}%` }
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid grid-cols-2 sm:grid-cols-4 gap-2",
										children: DAILY_GOAL_OPTIONS.map((opt) => {
											const isSelected = (streak.dailyGoal || 3) === opt.value;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												type: "button",
												onClick: () => handleSelectDailyGoal(opt.value),
												className: `p-2.5 rounded-lg border text-left transition-all cursor-pointer ${isSelected ? "bg-[#FC4C01]/15 border-[#FC4C01] text-[#FC4C01]" : isDark ? "bg-white/[0.02] border-white/10 hover:border-white/25 text-neutral-300" : "bg-white border-black/10 hover:border-black/25 text-neutral-700"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: "text-xs font-semibold font-mono tabular-nums",
													children: opt.label
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
													className: `text-[10px] mt-0.5 ${isSelected ? "text-[#FC4C01]/90" : isDark ? "text-neutral-500" : "text-neutral-400"}`,
													children: opt.desc
												})]
											}, opt.value);
										})
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `p-4 rounded-xl border space-y-3.5 ${isDark ? "bg-[#0f0f0f] border-white/10" : "bg-neutral-50 border-black/10"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-8 h-8 rounded-lg border border-[#FC4C01]/30 bg-[#FC4C01]/10 flex items-center justify-center shrink-0",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-4 h-4 text-[#FC4C01]" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xs font-semibold",
											children: "Daily Streak Reminder Notification"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
											children: "Reminds you via toast banner if you haven't completed your daily Kinich interaction by your scheduled time"
										})] })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: handleToggleReminder,
										className: `w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${streak.reminderEnabled ? "bg-[#FC4C01]" : isDark ? "bg-neutral-700" : "bg-neutral-300"}`,
										title: "Toggle daily streak reminder",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${streak.reminderEnabled ? "translate-x-5" : ""}` })
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 flex-wrap",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: `text-[11px] inline-flex items-center gap-1 font-mono ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3.5 h-3.5 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reminder Time:" })]
											}),
											[
												"09:00",
												"12:00",
												"18:00",
												"20:00",
												"21:30"
											].map((preset) => {
												const active = (streak.reminderTime || "18:00") === preset;
												return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => handleChangeReminderTime(preset),
													className: `px-2 py-1 rounded-lg border text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${active ? "bg-[#FC4C01]/15 border-[#FC4C01] text-[#FC4C01] font-semibold" : isDark ? "bg-white/[0.03] border-white/10 text-neutral-300 hover:border-white/25" : "bg-white border-black/10 text-neutral-700 hover:border-black/25"}`,
													children: preset
												}, preset);
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "time",
												value: streak.reminderTime || "18:00",
												onChange: (e) => handleChangeReminderTime(e.target.value),
												className: `px-2 py-1 rounded-lg border text-[11px] font-mono outline-none ${isDark ? "bg-black/60 border-white/15 text-white" : "bg-white border-black/15 text-black"}`
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-[11px] text-neutral-400 font-mono",
										children: ["Scheduled daily at ", streak.reminderTime || "18:00"]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: `p-3.5 rounded-xl border flex items-center justify-between ${isDark ? "bg-white/[0.02] border-white/10" : "bg-white border-black/10"}`,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "w-4 h-4 text-[#FC4C01]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs font-semibold",
										children: "How Daily Streaks Work"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `text-[11px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
										children: "Every chat prompt, deep research run, file upload, or study session counts toward your daily goal."
									})] })]
								})
							})
						] })
					]
				})
			]
		})
	});
};
//#endregion
export { StreakModal };
