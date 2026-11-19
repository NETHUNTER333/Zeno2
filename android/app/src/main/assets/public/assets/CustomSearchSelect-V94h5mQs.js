import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { Cn as ChevronDown, Z as Search, wn as Check } from "./react-vendor-ZF-Fgzq4.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { h as SUPPORTED_STUDY_LANGUAGES } from "./index-DaFzEGR-.js";
//#region src/components/CustomSearchSelect.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var CustomSearchSelect = ({ value, onChange, options, isDark = true, disabled = false, placeholder = "Select...", searchPlaceholder = "Search...", testId, ariaLabel, align = "left", compact = false }) => {
	const [open, setOpen] = (0, import_react.useState)(false);
	const [query, setQuery] = (0, import_react.useState)("");
	const [effectiveAlign, setEffectiveAlign] = (0, import_react.useState)(align);
	const containerRef = (0, import_react.useRef)(null);
	const searchInputRef = (0, import_react.useRef)(null);
	const selectedOption = (0, import_react.useMemo)(() => options.find((o) => o.value.toLowerCase() === String(value || "").toLowerCase()) || options[0], [options, value]);
	const filteredOptions = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		if (!q) return options;
		return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || o.sublabel && o.sublabel.toLowerCase().includes(q) || o.badge && o.badge.toLowerCase().includes(q) || o.searchKeywords && o.searchKeywords.toLowerCase().includes(q));
	}, [options, query]);
	(0, import_react.useEffect)(() => {
		if (!open) {
			setQuery("");
			return;
		}
		if (containerRef.current && typeof window !== "undefined") {
			const rect = containerRef.current.getBoundingClientRect();
			const vw = window.innerWidth;
			const menuWidth = Math.min(280, vw - 24);
			if (align === "right" && rect.right - menuWidth < 12) setEffectiveAlign("left");
			else if (align === "left" && rect.left + menuWidth > vw - 12) setEffectiveAlign("right");
			else setEffectiveAlign(align);
		}
		const handlePointerDown = (e) => {
			if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
		};
		const handleKeyDown = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown, { passive: true });
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open, align]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: containerRef,
		className: "relative inline-block text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			"data-testid": testId,
			"aria-label": ariaLabel || placeholder,
			"aria-expanded": open,
			"aria-haspopup": "listbox",
			disabled,
			onClick: () => setOpen((prev) => !prev),
			className: `inline-flex items-center justify-between gap-2 border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${compact ? "h-8 px-3 rounded-full" : "h-9 px-3.5 rounded-xl"} ${isDark ? "bg-zinc-900 hover:bg-zinc-800/90 border-white/15 text-white" : "bg-white hover:bg-zinc-50 border-black/15 text-zinc-900 shadow-2xs"}`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex items-center gap-1.5 truncate max-w-[165px] sm:max-w-[210px]",
				children: [
					selectedOption?.flag && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shrink-0",
						children: selectedOption.flag
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						children: selectedOption ? selectedOption.label : placeholder
					}),
					selectedOption?.badge && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${isDark ? "bg-white/10 text-zinc-300" : "bg-zinc-100 text-zinc-600"}`,
						children: selectedOption.badge
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: `w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""} ${isDark ? "text-zinc-400" : "text-zinc-500"}` })]
		}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "listbox",
			className: `absolute ${effectiveAlign === "left" ? "left-0" : "right-0"} top-full mt-1.5 w-[calc(100vw-2rem)] max-w-[272px] sm:max-w-[290px] rounded-2xl border p-1.5 z-[100] shadow-2xl ${isDark ? "bg-[#141418] border-white/15 text-white shadow-black/80" : "bg-white border-zinc-200 text-zinc-900 shadow-zinc-950/15"}`,
			children: [options.length > 5 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `flex items-center gap-2 px-2.5 py-2 mb-1 border-b ${isDark ? "border-white/10" : "border-zinc-100"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: `w-3.5 h-3.5 shrink-0 ${isDark ? "text-zinc-500" : "text-zinc-400"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					ref: searchInputRef,
					type: "text",
					value: query,
					onChange: (e) => setQuery(e.target.value),
					placeholder: searchPlaceholder,
					className: "w-full bg-transparent border-0 text-xs outline-none placeholder:opacity-50"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "max-h-64 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin",
				children: filteredOptions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `px-3 py-4 text-center text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`,
					children: "No matches found"
				}) : filteredOptions.map((opt) => {
					const active = opt.value.toLowerCase() === String(selectedOption?.value || "").toLowerCase();
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						role: "option",
						"aria-selected": active,
						onClick: () => {
							onChange(opt.value);
							setOpen(false);
						},
						className: `w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${active ? isDark ? "bg-white/10 text-white font-semibold" : "bg-zinc-100 text-zinc-900 font-semibold" : isDark ? "text-zinc-300 hover:bg-white/[0.06] hover:text-white" : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 min-w-0",
							children: [opt.flag && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm shrink-0",
								children: opt.flag
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "truncate",
									children: opt.label
								}), opt.sublabel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: `text-[10px] truncate ${isDark ? "text-zinc-500" : "text-zinc-400"}`,
									children: opt.sublabel
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 shrink-0",
							children: [opt.badge && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isDark ? "bg-white/[0.07] text-zinc-400" : "bg-zinc-100 text-zinc-600"}`,
								children: opt.badge
							}), active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 text-[#FC4C01]" })]
						})]
					}, opt.value);
				})
			})]
		})]
	});
};
var StudyLanguageDropdown = ({ value, onChange, isDark = true, disabled = false, testId, compact = true, align = "right" }) => {
	const options = (0, import_react.useMemo)(() => SUPPORTED_STUDY_LANGUAGES.map((lang) => ({
		value: lang.id,
		label: lang.nativeLabel,
		sublabel: lang.countries,
		flag: lang.flag,
		badge: lang.code.toUpperCase(),
		searchKeywords: `${lang.label} ${lang.nativeLabel} ${lang.countries} ${lang.code}`
	})), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CustomSearchSelect, {
		value,
		onChange,
		options,
		isDark,
		disabled,
		testId,
		ariaLabel: "Select language",
		searchPlaceholder: "Search language or country...",
		compact,
		align
	});
};
//#endregion
export { StudyLanguageDropdown as n, CustomSearchSelect as t };
