import { a as __toESM } from "./rolldown-runtime-oLLnCvco.js";
import { Ln as ArrowRight, f as X, wn as Check } from "./react-vendor-ZF-Fgzq4.js";
import { c as require_react, s as require_jsx_runtime } from "./markdown-katex-uiIk3YnD.js";
import { a as GoogleSignInButton, rt as UserAccountStore } from "./index-DaFzEGR-.js";
//#region src/components/QuickOnboardingModal.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var QuickOnboardingModal = ({ isOpen, onClose, isDark, onComplete }) => {
	const [step, setStep] = (0, import_react.useState)(1);
	const currentProfile = UserAccountStore.getProfile();
	const [displayName, setDisplayName] = (0, import_react.useState)(currentProfile.displayName || "");
	const [username, setUsername] = (0, import_react.useState)(currentProfile.username || "");
	const [authMethod, setAuthMethod] = (0, import_react.useState)("guest");
	const [error, setError] = (0, import_react.useState)(null);
	const [notice, setNotice] = (0, import_react.useState)(null);
	if (!isOpen) return null;
	const handleFinish = () => {
		UserAccountStore.saveProfile({
			...UserAccountStore.getProfile(),
			displayName: displayName.trim() || "User",
			username: username.trim() || "user",
			signinProvider: authMethod
		});
		UserAccountStore.setOnboardingDone();
		if (onComplete) onComplete();
		onClose();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${isDark ? "bg-[#101014] border-white/10 text-white" : "bg-white border-black/10 text-[#09090b]"}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between pb-3 mb-4 border-b border-neutral-500/10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs font-bold uppercase tracking-wider text-neutral-400",
						children: [
							"Account Setup • Step ",
							step,
							" of 2"
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "p-1 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
					})]
				}),
				step === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-lg font-bold",
							children: "Welcome"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-neutral-400",
							children: "Continue as guest or sign in to save your history."
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2",
							children: error
						}),
						notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2",
							children: notice
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2.5 pt-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoogleSignInButton, {
								testId: "onboarding-google-signin-btn",
								isDark,
								beforeSignIn: () => {
									setError(null);
									setNotice(null);
									return true;
								},
								onError: (msg) => setError(msg),
								onNotice: (msg) => setNotice(msg),
								onSuccess: (outcome) => {
									if (outcome.user) {
										setAuthMethod("google");
										if (outcome.user.displayName) setDisplayName(outcome.user.displayName);
										setStep(2);
									}
								}
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => {
									setAuthMethod("guest");
									UserAccountStore.loginAsGuest();
								},
								className: `w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all cursor-pointer ${authMethod === "guest" ? isDark ? "border-white bg-white/10 text-white" : "border-black bg-black/5 text-black" : isDark ? "border-white/10 hover:bg-white/5 text-neutral-300" : "border-black/10 hover:bg-black/5 text-neutral-700"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Continue as Guest" }), authMethod === "guest" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 text-emerald-400" })]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								if (authMethod === "guest") UserAccountStore.loginAsGuest();
								setStep(2);
							},
							className: "mt-4 w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Next" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "w-4 h-4" })]
						})
					]
				}),
				step === 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-lg font-bold",
							children: "Your Profile"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-neutral-400",
							children: "Pick your display name and username."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3 pt-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-medium text-neutral-400 mb-1",
								children: "Display Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: displayName,
								onChange: (e) => setDisplayName(e.target.value),
								placeholder: "Your Name",
								className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-black/50 border-white/15 text-white" : "bg-neutral-50 border-black/15 text-black"}`
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-medium text-neutral-400 mb-1",
								children: "Username"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: username,
								onChange: (e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")),
								placeholder: "username",
								className: `w-full px-3 py-2 rounded-xl border text-xs outline-none ${isDark ? "bg-black/50 border-white/15 text-white" : "bg-neutral-50 border-black/15 text-black"}`
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2 pt-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setStep(1),
								className: "w-1/3 py-2.5 rounded-xl border border-neutral-500/30 text-xs font-semibold cursor-pointer",
								children: "Back"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleFinish,
								className: "w-2/3 py-2.5 rounded-xl bg-white text-black font-semibold text-xs cursor-pointer",
								children: "Complete"
							})]
						})
					]
				})
			]
		})
	});
};
//#endregion
export { QuickOnboardingModal };
