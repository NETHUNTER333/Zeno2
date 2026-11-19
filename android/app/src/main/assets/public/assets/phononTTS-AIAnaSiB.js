import { t as __vitePreload } from "./preload-helper-C-oUlkXR.js";
//#region src/lib/phononTTS.ts
var ttsPromise = null;
var phononUnavailable = false;
var activeController = null;
var activeContext = null;
function isPhononSupported() {
	if (phononUnavailable) return false;
	return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly === "object" && !!(window.AudioContext || window.webkitAudioContext);
}
async function loadPhonon() {
	if (!isPhononSupported()) return null;
	if (!ttsPromise) ttsPromise = (async () => {
		try {
			const [{ PhononTTS: PhononCtor }, { default: wasmUrl }, { default: simdWasmUrl }, { default: threadsWasmUrl }, { default: threadsSimdWasmUrl }] = await Promise.all([
				__vitePreload(() => import("./phonon-tts-Bq3P3kib.js"), []),
				__vitePreload(() => import("./phonon_tts_bg-Cfc_975S.js"), []),
				__vitePreload(() => import("./phonon_tts_simd_bg-hrskr-6k.js"), []),
				__vitePreload(() => import("./phonon_tts_bg-CmZbmmf0.js"), []),
				__vitePreload(() => import("./phonon_tts_simd_bg-DxpXeVSj.js"), [])
			]);
			return await PhononCtor.load({
				model: "hf://gradium/phonon-31m-en",
				lang: "en",
				quant: "q8",
				device: "auto",
				wasmUrl,
				simdWasmUrl,
				threadsWasmUrl,
				threadsSimdWasmUrl
			});
		} catch {
			phononUnavailable = true;
			ttsPromise = null;
			return null;
		}
	})();
	return ttsPromise;
}
function stopPhononSpeech() {
	try {
		activeController?.abort();
	} catch {}
	activeController = null;
	try {
		activeContext?.close();
	} catch {}
	activeContext = null;
}
/**
* Speak text locally with the Phonon 31M model (no API key, runs on-device).
* Resolves true if Phonon handled the request (even if stopped by the user).
*/
async function speakWithPhonon(text, callbacks = {}) {
	if (!isPhononSupported()) return false;
	const instance = await loadPhonon();
	if (!instance) return false;
	stopPhononSpeech();
	const controller = new AbortController();
	activeController = controller;
	const AudioCtxCtor = window.AudioContext || window.webkitAudioContext;
	const sampleRate = instance.sampleRate || 24e3;
	const ctx = new AudioCtxCtor({ sampleRate });
	activeContext = ctx;
	let started = false;
	try {
		if (ctx.state === "suspended") await ctx.resume().catch(() => {});
		let nextStart = ctx.currentTime + .05;
		const speech = instance.stream(text, { signal: controller.signal });
		for await (const pcm of speech) {
			if (controller.signal.aborted) break;
			const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
			buffer.getChannelData(0).set(pcm);
			const source = ctx.createBufferSource();
			source.buffer = buffer;
			source.connect(ctx.destination);
			nextStart = Math.max(nextStart, ctx.currentTime);
			source.start(nextStart);
			nextStart += buffer.duration;
			if (!started) {
				started = true;
				callbacks.onStart?.();
			}
		}
		if (controller.signal.aborted) {
			callbacks.onEnd?.();
			return true;
		}
		const remainingMs = Math.max(0, (nextStart - ctx.currentTime) * 1e3);
		if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
		if (activeController === controller) {
			stopPhononSpeech();
			callbacks.onEnd?.();
		}
		return true;
	} catch (err) {
		if (activeController === controller) stopPhononSpeech();
		if (err?.name === "AbortError") {
			callbacks.onEnd?.();
			return true;
		}
		if (!started) {
			phononUnavailable = true;
			ttsPromise = null;
			return false;
		}
		callbacks.onError?.(err);
		return true;
	}
}
//#endregion
export { isPhononSupported, loadPhonon, speakWithPhonon, stopPhononSpeech };
