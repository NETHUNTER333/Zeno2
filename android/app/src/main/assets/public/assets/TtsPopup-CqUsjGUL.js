import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { Et as LoaderCircle, Tn as Check, f as X, h as Volume2, lt as Pause, ot as Play, wn as ChevronDown } from "./react-vendor-BgDBDE3V.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { a as getSavedTtsSpeed, c as setSavedTtsGender, d as speakTextWithSmallestAi, f as stopSmallestSpeech, i as getSavedTtsLanguage, l as setSavedTtsLanguage, n as TTS_PLAYBACK_SPEEDS, o as sanitizeTtsSpeechText, r as getSavedTtsGender, s as setActiveTtsPlaybackSpeed, t as TTS_LANGUAGES, u as setSavedTtsSpeed } from "./smallestAi-BjceVR4C.js";
import { i as tuneSpring, n as createSpring, r as stepSpring, t as clampVal } from "./springMotion-z9bpjJ2E.js";
//#region src/components/motion/ReadAlongText.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
/**
* DesignBookmark "Read Along" motion component:
* A pill slides from word to word behind the exact text/segment being read aloud.
* Leading edge is stiff (520, 40) and trailing edge is soft (210, 26),
* so it stretches physically as it moves and settles to the word's exact width.
* At a line break, it closes cleanly and opens on the next line without sliding across text.
*/
var ReadAlongText = ({ text, activeWordIndex, isPlaying, onWordClick, isDark = true, className = "" }) => {
	const containerRef = (0, import_react.useRef)(null);
	const pillRef = (0, import_react.useRef)(null);
	const wordRefs = (0, import_react.useRef)([]);
	const words = (0, import_react.useMemo)(() => {
		return String(text || "").trim().split(/\s+/).filter(Boolean);
	}, [text]);
	const springsRef = (0, import_react.useRef)({
		L: createSpring(0, 520, 40),
		R: createSpring(0, 520, 40),
		Y: createSpring(0, 600, 48),
		O: createSpring(0, 300, 30),
		lineTop: null
	});
	(0, import_react.useEffect)(() => {
		const s = springsRef.current;
		const container = containerRef.current;
		if (!container || activeWordIndex < 0 || activeWordIndex >= words.length) {
			s.O.t = 0;
			if (activeWordIndex < 0) s.lineTop = null;
			return;
		}
		const el = wordRefs.current[activeWordIndex];
		if (!el) return;
		const fontSize = parseFloat(getComputedStyle(container).fontSize) || 15;
		const pad = fontSize * .2;
		const pillHeight = fontSize * 1.38;
		const left = el.offsetLeft - pad;
		const right = el.offsetLeft + el.offsetWidth + pad;
		const top = el.offsetTop + (el.offsetHeight - pillHeight) / 2;
		s.O.t = 1;
		const forward = left >= s.L.t;
		if (s.lineTop === null || Math.abs(top - s.lineTop) > 4 || s.O.x < .05) {
			s.L.x = s.L.t = left;
			s.R.x = left;
			s.Y.x = s.Y.t = top;
		}
		s.lineTop = top;
		tuneSpring(forward ? s.R : s.L, 520, 40);
		tuneSpring(forward ? s.L : s.R, 210, 26);
		s.L.t = left;
		s.R.t = right;
		s.Y.t = top;
		try {
			el.scrollIntoView({
				behavior: "smooth",
				block: "nearest"
			});
		} catch {}
	}, [activeWordIndex, words]);
	(0, import_react.useEffect)(() => {
		let rafId = 0;
		let last = performance.now();
		const loop = (now) => {
			const dt = Math.min((now - last) / 1e3, 1 / 30);
			last = now;
			const s = springsRef.current;
			const sub = 4;
			for (let k = 0; k < sub; k++) {
				stepSpring(s.L, dt / sub);
				stepSpring(s.R, dt / sub);
				stepSpring(s.Y, dt / sub);
				stepSpring(s.O, dt / sub);
			}
			if (pillRef.current) {
				const w = Math.max(0, s.R.x - s.L.x);
				const op = clampVal(s.O.x, 0, 1);
				pillRef.current.style.transform = `translate3d(${s.L.x.toFixed(2)}px, ${s.Y.x.toFixed(2)}px, 0)`;
				pillRef.current.style.width = `${w.toFixed(2)}px`;
				pillRef.current.style.opacity = op.toFixed(3);
			}
			rafId = requestAnimationFrame(loop);
		};
		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, []);
	wordRefs.current = [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		ref: containerRef,
		className: `relative select-none font-medium tracking-[-0.015em] leading-[1.6] ${className}`,
		style: { fontFamily: "Inter, \"Helvetica Neue\", Helvetica, Arial, sans-serif" },
		"aria-label": text,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			ref: pillRef,
			"aria-hidden": "true",
			className: "pointer-events-none absolute left-0 top-0 rounded-[0.34em] will-change-[transform,width,opacity]",
			style: {
				height: "1.38em",
				backgroundColor: isDark ? "#ffffff" : "#0e0f11",
				opacity: 0
			}
		}), words.map((word, idx) => {
			const isPast = activeWordIndex >= 0 && idx < activeWordIndex;
			const isNow = activeWordIndex === idx;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				ref: (el) => {
					wordRefs.current[idx] = el;
				},
				onClick: () => onWordClick?.(idx),
				title: "Click to read aloud from this word",
				className: "relative z-10 inline-block cursor-pointer transition-colors duration-150",
				style: { color: isNow ? isDark ? "#000000" : "#f4f3f1" : isPast ? isDark ? "#ffffff" : "#17181a" : isDark ? isPlaying ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.65)" : isPlaying ? "rgba(23,24,26,0.38)" : "rgba(23,24,26,0.6)" },
				children: word
			}), idx < words.length - 1 ? " " : ""] }, `${idx}-${word}`);
		})]
	});
};
//#endregion
//#region src/components/TtsPopup.tsx
var TtsPopup = ({ text, onClose, isDark = true }) => {
	const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [activeWordIndex, setActiveWordIndex] = (0, import_react.useState)(-1);
	const [ttsLang, setTtsLang] = (0, import_react.useState)(() => getSavedTtsLanguage());
	const [ttsGender, setTtsGender] = (0, import_react.useState)(() => getSavedTtsGender());
	const [ttsSpeed, setTtsSpeed] = (0, import_react.useState)(() => getSavedTtsSpeed());
	const [isLangMenuOpen, setIsLangMenuOpen] = (0, import_react.useState)(false);
	const langMenuRef = (0, import_react.useRef)(null);
	const cleanSpokenText = (0, import_react.useMemo)(() => sanitizeTtsSpeechText(text), [text]);
	const wordsList = (0, import_react.useMemo)(() => cleanSpokenText.split(" ").filter(Boolean), [cleanSpokenText]);
	(0, import_react.useEffect)(() => {
		return () => {
			stopSmallestSpeech();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const handleOutsideClick = (e) => {
			if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setIsLangMenuOpen(false);
		};
		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				if (isLangMenuOpen) setIsLangMenuOpen(false);
				else {
					stopSmallestSpeech();
					onClose();
				}
			}
		};
		document.addEventListener("mousedown", handleOutsideClick);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleOutsideClick);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isLangMenuOpen, onClose]);
	const selectedLanguageObj = TTS_LANGUAGES.find((l) => l.code === ttsLang) || TTS_LANGUAGES[0];
	const startSpeech = (langOverride, genderOverride, speedOverride, startWordIdx = 0) => {
		stopSmallestSpeech();
		setIsPlaying(false);
		setLoading(true);
		setActiveWordIndex(startWordIdx);
		speakTextWithSmallestAi(text, langOverride ?? ttsLang, () => {
			setLoading(false);
			setIsPlaying(true);
		}, () => {
			setLoading(false);
			setIsPlaying(false);
			setActiveWordIndex(-1);
		}, () => {
			setLoading(false);
			setIsPlaying(false);
		}, genderOverride ?? ttsGender, void 0, speedOverride ?? ttsSpeed, (prog) => {
			setActiveWordIndex(prog.wordIndex);
		}, startWordIdx);
	};
	(0, import_react.useEffect)(() => {
		if (cleanSpokenText) startSpeech(ttsLang, ttsGender, ttsSpeed, 0);
	}, []);
	const handleSpeedChange = (newSpeed) => {
		setTtsSpeed(newSpeed);
		setSavedTtsSpeed(newSpeed);
		setActiveTtsPlaybackSpeed(newSpeed);
		if (isPlaying && typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking) startSpeech(ttsLang, ttsGender, newSpeed, Math.max(0, activeWordIndex));
	};
	const handlePlayToggle = () => {
		if (isPlaying || loading) {
			stopSmallestSpeech();
			setIsPlaying(false);
			setLoading(false);
			setActiveWordIndex(-1);
			return;
		}
		startSpeech(ttsLang, ttsGender, ttsSpeed, 0);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4",
		onClick: () => {
			stopSmallestSpeech();
			onClose();
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			onClick: (e) => e.stopPropagation(),
			className: `w-full max-w-md p-4 rounded-2xl border shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 ${isDark ? "bg-[#141418] border-white/10 text-white" : "bg-white border-neutral-200 text-neutral-900"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "w-4 h-4 opacity-80" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-xs",
								children: "Read Aloud · Live Segment"
							}),
							activeWordIndex >= 0 && wordsList.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: `text-[10px] font-mono px-2 py-0.5 rounded-full ${isDark ? "bg-white/10 text-neutral-300" : "bg-neutral-100 text-neutral-700"}`,
								children: [
									activeWordIndex + 1,
									"/",
									wordsList.length
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							stopSmallestSpeech();
							onClose();
						},
						className: "p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer",
						"aria-label": "Close",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `rounded-xl p-3.5 max-h-44 overflow-y-auto scrollbar-thin border ${isDark ? "bg-[#1c1c21] border-white/[0.07]" : "bg-[#f7f7f6] border-black/[0.06]"}`,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadAlongText, {
						text: cleanSpokenText || "No readable text in this message.",
						activeWordIndex,
						isPlaying,
						isDark,
						className: "text-[15px] sm:text-[16px]",
						onWordClick: (wordIdx) => {
							startSpeech(ttsLang, ttsGender, ttsSpeed, wordIdx);
						}
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `grid grid-cols-2 gap-1 p-0.5 rounded-lg border ${isDark ? "bg-black/30 border-white/10" : "bg-neutral-100 border-neutral-200"}`,
						children: ["female", "male"].map((g) => {
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setTtsGender(g);
									setSavedTtsGender(g);
									if (isPlaying || loading) startSpeech(ttsLang, g, ttsSpeed, Math.max(0, activeWordIndex));
								},
								className: `py-1 rounded text-xs font-medium transition-colors cursor-pointer capitalize ${ttsGender === g ? isDark ? "bg-white text-black" : "bg-black text-white" : isDark ? "text-neutral-400 hover:text-white" : "text-neutral-600 hover:text-black"}`,
								children: g
							}, g);
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						ref: langMenuRef,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setIsLangMenuOpen((prev) => !prev),
							"aria-expanded": isLangMenuOpen,
							className: `w-full h-full flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${isDark ? "bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.08]" : "bg-neutral-100 border-neutral-200 text-neutral-900 hover:bg-neutral-200"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate",
								children: selectedLanguageObj.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "w-3 h-3 opacity-60 shrink-0" })]
						}), isLangMenuOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							role: "listbox",
							className: `absolute right-0 top-full mt-1.5 w-48 max-h-56 overflow-y-auto p-1 rounded-lg border shadow-xl z-50 ${isDark ? "bg-[#18181c] border-white/10 text-white" : "bg-white border-neutral-200 text-neutral-900"}`,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-0.5",
								children: TTS_LANGUAGES.map((lang) => {
									const isSelected = lang.code === ttsLang;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										role: "option",
										"aria-selected": isSelected,
										onClick: () => {
											setTtsLang(lang.code);
											setSavedTtsLanguage(lang.code);
											setIsLangMenuOpen(false);
											if (isPlaying || loading) startSpeech(lang.code, ttsGender, ttsSpeed, Math.max(0, activeWordIndex));
										},
										className: `w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${isSelected ? isDark ? "bg-white/10 font-semibold" : "bg-neutral-200 font-semibold" : isDark ? "hover:bg-white/5 text-neutral-300" : "hover:bg-neutral-100 text-neutral-700"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate",
											children: lang.label
										}), isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3 h-3" })]
									}, lang.code);
								})
							})
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `text-[11px] font-medium ${isDark ? "text-neutral-400" : "text-neutral-500"}`,
						children: "Speed"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-1",
						children: TTS_PLAYBACK_SPEEDS.map((spd) => {
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => handleSpeedChange(spd),
								className: `px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${ttsSpeed === spd ? isDark ? "bg-white text-black font-semibold" : "bg-black text-white font-semibold" : isDark ? "text-neutral-400 hover:text-white hover:bg-white/10" : "text-neutral-600 hover:text-black hover:bg-neutral-200"}`,
								children: [spd, "x"]
							}, spd);
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: handlePlayToggle,
					className: `w-full h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${isDark ? "bg-white text-black hover:bg-neutral-200" : "bg-black text-white hover:bg-neutral-800"}`,
					children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-3.5 h-3.5 animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Loading audio…" })] }) : isPlaying ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "w-3.5 h-3.5 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Stop" })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "w-3.5 h-3.5 fill-current ml-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Read Aloud" })] })
				})
			]
		})
	});
};
//#endregion
export { TtsPopup };
