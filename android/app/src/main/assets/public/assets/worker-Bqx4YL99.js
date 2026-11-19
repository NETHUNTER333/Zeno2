//#region node_modules/phonon-tts/fetch.js
/** Bump to orphan everything cached by an older, incompatible version of this package. */
const CACHE_NAME = "phonon-tts-v1";
async function openCache() {
	if (typeof caches === "undefined") return null;
	try {
		return await caches.open(CACHE_NAME);
	} catch {
		return null;
	}
}
/**
* Fetch `url` as bytes, from the cache when it is there. With `write: false` the cache is
* still read, but a download is left out of it, for a caller that stores it elsewhere: the
* worker, whose own writes do not last in WebKit (see `storeBytes`).
*
* @param {string} url
* @param {{ cache?: boolean, write?: boolean, onProgress?: (p: { loaded: number, total: number | null, cached: boolean }) => void }} [options]
* @returns {Promise<Uint8Array>}
*/
async function fetchBytes(url, { cache = true, write = true, onProgress } = {}) {
	const store = cache ? await openCache() : null;
	if (store) {
		const hit = await store.match(url).catch(() => void 0);
		if (hit) {
			const bytes = new Uint8Array(await hit.arrayBuffer());
			onProgress?.({
				loaded: bytes.length,
				total: bytes.length,
				cached: true
			});
			return bytes;
		}
	}
	const response = await fetch(url);
	if (!response.ok) throw new Error(`failed to fetch ${url}: HTTP ${response.status}`);
	const stored = store && write ? store.put(url, response.clone()).catch((e) => {
		console.warn(`[phonon-tts] could not cache ${url}: ${e}`);
	}) : null;
	const length = Number(response.headers.get("content-length"));
	const total = Number.isFinite(length) && length > 0 ? length : null;
	const bytes = await readBody(response, total, (loaded) => onProgress?.({
		loaded,
		total,
		cached: false
	}));
	await stored;
	return bytes;
}
async function readBody(response, total, onChunk) {
	if (!response.body) return new Uint8Array(await response.arrayBuffer());
	const reader = response.body.getReader();
	let buffer = new Uint8Array(total ?? 1 << 20);
	let loaded = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (loaded + value.length > buffer.length) {
			const grown = new Uint8Array(Math.max(buffer.length * 2, loaded + value.length));
			grown.set(buffer.subarray(0, loaded));
			buffer = grown;
		}
		buffer.set(value, loaded);
		loaded += value.length;
		onChunk(loaded);
	}
	return loaded === buffer.length ? buffer : buffer.slice(0, loaded);
}
//#endregion
//#region node_modules/phonon-tts/device.js
/**
* @param {object} env
* @param {'auto' | 'webgpu' | 'cpu'} [env.requested] `LoadOptions.device`; the CPU when left out.
* @param {'q8' | 'f32'} env.quant
* @param {boolean} env.hasWebGpu Whether `navigator.gpu.requestAdapter()` returned one.
* @param {boolean} [env.fallbackAdapter] Whether that adapter is a software fallback, which
*   would run slower than the CPU path.
* @returns {{ device: 'webgpu' | 'cpu', reason: string }} The device to try first, and why.
*/
function chooseDevice({ requested, quant, hasWebGpu, fallbackAdapter = false }) {
	if (requested === void 0) return {
		device: "cpu",
		reason: "default"
	};
	if (requested === "cpu") return {
		device: "cpu",
		reason: "requested"
	};
	if (requested === "webgpu") return {
		device: "webgpu",
		reason: "requested"
	};
	if (quant !== "q8") return {
		device: "cpu",
		reason: "WebGPU needs q8 weights"
	};
	if (!hasWebGpu) return {
		device: "cpu",
		reason: "this browser offers no WebGPU adapter"
	};
	if (fallbackAdapter) return {
		device: "cpu",
		reason: "the browser's WebGPU adapter is a software fallback"
	};
	return {
		device: "webgpu",
		reason: "'auto', and the browser has a WebGPU adapter"
	};
}
/** Whether `bytes` is a GGUF file: the only weights WebGPU can load. */
function isGguf(bytes) {
	return bytes.length >= 4 && bytes[0] === 71 && bytes[1] === 71 && bytes[2] === 85 && bytes[3] === 70;
}
/**
* @param {object} env
* @param {number | 'auto'} [env.requested] `LoadOptions.threads`.
* @param {boolean} env.isolated Whether the page is cross-origin isolated, which wasm threads
*   need: without it there is no `SharedArrayBuffer`.
* @param {number} [env.hardwareConcurrency]
* @returns {{ threads: number, reason: string }} Threads in all, counting the one that owns
*   the model, and why that many.
*/
function chooseThreads({ requested = "auto", isolated, hardwareConcurrency }) {
	if (requested === 1) return {
		threads: 1,
		reason: "requested"
	};
	if (!isolated) return {
		threads: 1,
		reason: "the page is not cross-origin isolated"
	};
	if (!(hardwareConcurrency > 1)) return {
		threads: 1,
		reason: "the browser reports one core or none"
	};
	if (requested !== "auto") return {
		threads: Math.min(requested, hardwareConcurrency),
		reason: "requested"
	};
	return {
		threads: Math.min(3, hardwareConcurrency),
		reason: "default"
	};
}
//#endregion
//#region node_modules/phonon-tts/simd.js
/**
* A module using one Relaxed SIMD instruction. `WebAssembly.validate` rejects it where the
* instruction is missing, which is the only reliable way to ask: there is no feature list.
*/
const RELAXED_SIMD_PROBE = new Uint8Array([
	0,
	97,
	115,
	109,
	1,
	0,
	0,
	0,
	1,
	5,
	1,
	96,
	0,
	1,
	123,
	3,
	2,
	1,
	0,
	10,
	61,
	1,
	59,
	0,
	253,
	12,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	253,
	12,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	253,
	12,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	253,
	133,
	2,
	11
]);
/** Whether this browser can compile the Relaxed SIMD builds. */
function hasRelaxedSimd() {
	try {
		return WebAssembly.validate(RELAXED_SIMD_PROBE);
	} catch {
		return false;
	}
}
//#endregion
//#region node_modules/phonon-tts/worker.js
let model = null;
/** Samples per frame: a generation step returns a whole number of them. */
let frameSize = 0;
let settings = null;
/** Voice name -> index in `model`, or the pending load of that voice. */
const voices = /* @__PURE__ */ new Map();
/** Ids of generations asked to stop. */
const cancelled = /* @__PURE__ */ new Set();
const post = (message, transfer = []) => self.postMessage(message, transfer);
const channel = new MessageChannel();
const yieldQueue = [];
channel.port1.onmessage = () => yieldQueue.shift()?.();
const yieldToEventLoop = () => new Promise((resolve) => {
	yieldQueue.push(resolve);
	channel.port2.postMessage(null);
});
/**
* Each build comes as two modules with the same JS: one using WebAssembly Relaxed SIMD and
* one without, for browsers that lack it. This picks the one the browser can compile, and
* hands the JS its URL. The `new URL` calls name their file literally, so a bundler emits
* the module beside the JS as it does the default one.
*/
const RELAXED_SIMD = hasRelaxedSimd();
function moduleFor(relaxedUrl, simdUrl, simdDefault) {
	if (RELAXED_SIMD) return relaxedUrl ? { module_or_path: relaxedUrl } : void 0;
	return { module_or_path: simdUrl ?? simdDefault };
}
/**
* Load the wasm build to run on the CPU, and start its threads.
*
* There are two builds. `wasm-threads/` runs generation on several threads, but its memory
* is shared, which a page can only create when it is cross-origin isolated; `wasm/` runs on
* this thread alone and loads anywhere. The threaded one is tried when the page allows it
* and more than one thread is wanted, and the single-threaded one otherwise or if that
* fails, so a page that cannot have threads still speaks.
*
* Both `import()`s name their file literally, which is what lets a bundler find and emit
* both builds.
*/
async function loadWasm(options) {
	const choice = chooseThreads({
		requested: options.threads,
		isolated: self.crossOriginIsolated === true,
		hardwareConcurrency: navigator.hardwareConcurrency
	});
	let reason = choice.reason;
	if (choice.threads > 1) try {
		const wasm = await import("./phonon_tts-D6DWpXvB.js");
		await wasm.default(moduleFor(options.threadsWasmUrl, options.threadsSimdWasmUrl, new URL("/assets/phonon_tts_simd_bg-DmEJDVEC.wasm", "" + import.meta.url)));
		const workers = choice.threads - 1;
		await wasm.initThreadPool(workers);
		return {
			wasm,
			threads: wasm.start_cpu_pool(workers),
			reason
		};
	} catch (e) {
		reason = `threads failed to start: ${e instanceof Error ? e.message : e}`;
	}
	return {
		wasm: await loadSingleThreaded(options),
		threads: 1,
		reason
	};
}
/**
* The single-threaded build: the CPU build for pages that cannot have threads, and the one
* WebGPU runs in, since the GPU needs no CPU threads.
*/
async function loadSingleThreaded(options) {
	const wasm = await import("./phonon_tts-CCFYKSXc.js");
	try {
		await wasm.default(moduleFor(options.wasmUrl, options.simdWasmUrl, new URL("/assets/phonon_tts_simd_bg-DHcBY3f8.wasm", "" + import.meta.url)));
	} catch (e) {
		if (e instanceof WebAssembly.CompileError) throw new Error(`this browser cannot run phonon-tts: it needs WebAssembly SIMD (${e.message})`);
		throw e;
	}
	return wasm;
}
/** What WebGPU adapter the browser hands out, if any: the cheap check before loading weights. */
async function webGpuAdapter() {
	try {
		const adapter = await navigator.gpu?.requestAdapter();
		if (!adapter) return { hasWebGpu: false };
		return {
			hasWebGpu: true,
			fallbackAdapter: Boolean(adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter)
		};
	} catch {
		return { hasWebGpu: false };
	}
}
async function handleInit(id, options) {
	settings = options;
	const { model: spec, quant, cache } = options;
	const adapter = options.device === "webgpu" || options.device === "auto" ? await webGpuAdapter() : { hasWebGpu: false };
	const choice = chooseDevice({
		requested: options.device,
		quant,
		...adapter
	});
	if (choice.device === "webgpu" && !adapter.hasWebGpu) throw new Error("this browser offers no WebGPU adapter");
	let { wasm, threads, reason: threadsReason } = choice.device === "webgpu" ? {
		wasm: await loadSingleThreaded(options),
		threads: 1,
		reason: "generation runs on the GPU"
	} : await loadWasm(options);
	const weightsUrl = spec.weights[quant];
	if (!weightsUrl) throw new Error(`this model has no '${quant}' weights`);
	const progress = (file) => (p) => post({
		type: "progress",
		id,
		file,
		...p
	});
	const files = await Promise.all([
		download(weightsUrl, progress("weights")),
		download(spec.tokenizer, progress("tokenizer")),
		download(spec.config, progress("config"))
	]);
	const [weights, tokenizer, config] = files.map((f) => f.bytes);
	const load = (device) => wasm.Model.load(weights, tokenizer, config, quant, options.lang, options.rewrites, options.conditions, device);
	let deviceReason = choice.reason;
	if (choice.device === "webgpu") try {
		if (!isGguf(weights)) throw new Error("WebGPU needs q8 weights in a GGUF file");
		model = await load("webgpu");
	} catch (e) {
		if (options.device === "webgpu") throw e;
		deviceReason = `WebGPU failed to start: ${e instanceof Error ? e.message : e}`;
		threadsReason = "WebGPU failed, and the CPU stays on the single-threaded build already loaded";
	}
	model ??= await load("cpu");
	frameSize = model.frame_size();
	for (const file of files) file.keep();
	for (const name of options.preload) await voiceIndex(name, progress(`voice:${name}`));
	return {
		sampleRate: model.sample_rate(),
		features: wasm.cpu_features(),
		device: model.device(),
		languages: model.languages(),
		deviceReason,
		threads,
		threadsReason
	};
}
/**
* Downloads `url`, or reads it from the cache, without writing the cache: `keep()` then hands a
* download to the page, which caches it (see `storeBytes` in fetch.js for why the worker does
* not). Call it only once the bytes are no longer needed here: they are transferred, not
* copied, so they are gone from this side afterwards. wasm copies what it is given, so that is
* as soon as the model or the voice has been loaded from them.
*/
async function download(url, onProgress) {
	let cached = false;
	const bytes = await fetchBytes(url, {
		cache: settings.cache,
		write: false,
		onProgress: (p) => {
			cached = p.cached;
			onProgress?.(p);
		}
	});
	const keep = () => {
		if (!settings.cache || cached) return;
		const buffer = bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.slice().buffer;
		post({
			type: "store",
			url,
			bytes: buffer
		}, [buffer]);
	};
	return {
		bytes,
		keep
	};
}
/** The index of voice `name`, fetching and registering it on first use. */
function voiceIndex(name, onProgress) {
	let entry = voices.get(name);
	if (entry === void 0) {
		const url = settings.model.voices[name];
		if (!url) {
			const known = [.../* @__PURE__ */ new Set([...Object.keys(settings.model.voices), ...voices.keys()])];
			return Promise.reject(/* @__PURE__ */ new Error(`unknown voice '${name}'; known: ${known.join(", ")}`));
		}
		entry = download(url, onProgress).then(async ({ bytes, keep }) => {
			const index = await registerVoice(bytes);
			keep();
			return index;
		}).catch((e) => {
			voices.delete(name);
			throw e;
		});
		voices.set(name, entry);
	}
	return Promise.resolve(entry);
}
async function handleAddVoice(name, source) {
	const { bytes, keep } = typeof source === "string" ? await download(source) : {
		bytes: new Uint8Array(source),
		keep() {}
	};
	const index = registerVoice(bytes);
	voices.set(name, index);
	try {
		await index;
		keep();
	} catch (e) {
		voices.delete(name);
		throw e;
	}
}
/**
* Registers a voice and waits until the device has run its prompt. On WebGPU that is only
* recorded otherwise, and runs inside the next generation: after preloading several voices,
* the first one spoken would pay for all of them.
*/
async function registerVoice(bytes) {
	const index = model.add_voice(bytes);
	await model.flush();
	return index;
}
async function handleGenerate(id, { text, voice, temperature, seed }) {
	const index = await voiceIndex(voice);
	const t0 = performance.now();
	const stats = {
		chunks: model.start_generation(index, text, temperature, seed),
		tokens: 0,
		frames: 0,
		samples: 0,
		promptMs: 0,
		stepMs: {
			avg: 0,
			min: 0,
			max: 0
		},
		firstAudioMs: null,
		totalMs: 0,
		cancelled: false
	};
	let stepMsTotal = 0;
	let stepMsMin = Infinity;
	try {
		outer: for (;;) {
			if (cancelled.has(id)) {
				stats.cancelled = true;
				break;
			}
			const p0 = performance.now();
			const tokens = model.next_chunk();
			if (tokens === void 0) break;
			stats.tokens += tokens;
			stats.promptMs += performance.now() - p0;
			for (;;) {
				if (cancelled.has(id)) {
					stats.cancelled = true;
					break outer;
				}
				const s0 = performance.now();
				const pcm = await model.generation_step();
				if (pcm === void 0) break;
				const frames = Math.max(1, Math.round(pcm.length / frameSize));
				const dt = (performance.now() - s0) / frames;
				stepMsTotal += dt * frames;
				stepMsMin = Math.min(stepMsMin, dt);
				stats.stepMs.max = Math.max(stats.stepMs.max, dt);
				stats.frames += frames;
				stats.samples += pcm.length;
				stats.firstAudioMs ??= performance.now() - t0;
				post({
					type: "chunk",
					id,
					pcm
				}, [pcm.buffer]);
				await yieldToEventLoop();
			}
		}
	} finally {
		try {
			model.stop_generation();
		} catch {}
		cancelled.delete(id);
	}
	if (stats.frames > 0) {
		stats.stepMs.avg = stepMsTotal / stats.frames;
		stats.stepMs.min = stepMsMin;
	}
	stats.totalMs = performance.now() - t0;
	return stats;
}
self.onmessage = async ({ data }) => {
	const { type, id } = data;
	if (type === "cancel") {
		cancelled.add(id);
		return;
	}
	try {
		let value;
		if (type === "init") value = await handleInit(id, data.options);
		else if (type === "add_voice") value = await handleAddVoice(data.name, data.source);
		else if (type === "generate") value = await handleGenerate(id, data);
		else throw new Error(`unknown message type '${type}'`);
		post({
			type: "result",
			id,
			value
		});
	} catch (e) {
		post({
			type: "error",
			id,
			message: e instanceof Error ? e.message : String(e)
		});
	}
};
//#endregion
