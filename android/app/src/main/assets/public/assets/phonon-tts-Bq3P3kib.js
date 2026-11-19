//#region node_modules/phonon-tts/fetch.js
/** Bump to orphan everything cached by an older, incompatible version of this package. */
var CACHE_NAME = "phonon-tts-v1";
async function openCache() {
	if (typeof caches === "undefined") return null;
	try {
		return await caches.open(CACHE_NAME);
	} catch {
		return null;
	}
}
/**
* Keep `bytes` in the cache as the response for `url`.
*
* This is how the worker's downloads are cached: it hands them to the page, which stores them
* here. WebKit (Safari, and so every browser on iOS) drops the Cache API writes of a worker
* once the worker is terminated, which this package's is on `dispose()` and whenever the page
* goes, so a checkpoint the worker cached for itself was downloaded again on every load there.
* The page's writes last in every browser. A whole buffer rather than a stream, so the write
* never waits on the page's main thread.
*
* @param {string} url
* @param {ArrayBuffer | Uint8Array} bytes
* @returns {Promise<boolean>} whether it was stored.
*/
async function storeBytes(url, bytes) {
	const store = await openCache();
	if (!store) return false;
	try {
		await store.put(url, new Response(bytes, { headers: { "content-length": String(bytes.byteLength) } }));
		return true;
	} catch (e) {
		console.warn(`[phonon-tts] could not cache ${url}: ${e}`);
		return false;
	}
}
/**
* Delete every file this package has cached.
*
* @returns {Promise<boolean>} whether there was anything to delete.
*/
async function clearCache() {
	if (typeof caches === "undefined") return false;
	return caches.delete(CACHE_NAME);
}
//#endregion
//#region node_modules/phonon-tts/hub.js
var HUB = "https://huggingface.co";
/**
* The model `PhononTTS.load` uses when none is given, pinned to a commit. A copy of
* `DEFAULT_MODEL` in `ptts/src/checkpoint.rs`; the tests hold the two together.
*/
var DEFAULT_MODEL = "hf://gradium/phonon-31m-en@8c64b55ec301728e2d1695bfea87a08a267d0c2d";
/** Weights per quant, in the order the native `weight_candidates` tries them. */
var WEIGHTS = {
	q8: ["model.q8.gguf", "model.safetensors"],
	f32: ["model.safetensors", "model.q8.gguf"]
};
/** As `VOICE_DIRS` in the native loader: a name in both keeps the one in `voices/`. */
var VOICE_DIRS = ["voices", "embeddings"];
/** A checkpoint's own voice, registered as `default` unless the voice directories have one. */
var DEFAULT_VOICE_FILE = "default-voice.safetensors";
/**
* The repo and revision `source` names. Anything but `hf://owner/name[@revision]` is an error.
*
* @param {string} source
* @returns {{ repo: string, revision: string }}
*/
function parseHubModel(source) {
	const match = /^hf:\/\/([\w.-]+\/[\w.-]+)(?:@(\S+))?$/.exec(source);
	if (!match) throw new TypeError(`model must be a ModelSpec or a Hugging Face repo, 'hf://owner/name' or 'hf://owner/name@revision'; got ${JSON.stringify(source)}. A browser cannot list a folder URL, so a model served elsewhere needs a ModelSpec.`);
	return {
		repo: match[1],
		revision: match[2] ?? "main"
	};
}
/**
* The ModelSpec of a public Hugging Face repo, with every URL pinned to the commit the
* revision points at, so a cached download is never served after the repo changes.
*
* With `cache`, the Hub's answer is kept beside the downloads, and used when the Hub cannot be
* reached or fails (a 5xx or 429), so a model whose files are cached still loads offline. A
* branch then means the commit it pointed at when it was last looked up.
*
* @param {string} source `hf://owner/name` or `hf://owner/name@revision`
* @param {{ cache?: boolean }} [options]
* @returns {Promise<import('./index.js').ModelSpec>}
*/
async function resolveHubModel(source, { cache = true } = {}) {
	const { repo, revision } = parseHubModel(source);
	const api = `${HUB}/api/models/${repo}/revision/${encodeURIComponent(revision)}`;
	const store = cache ? await openCache() : null;
	let response;
	try {
		response = await fetch(api);
	} catch (e) {
		response = await store?.match(api).catch(() => void 0);
		if (!response) throw new Error(`cannot reach the Hugging Face Hub to look up ${source}: ${e.message}`);
	}
	if (response.status >= 500 || response.status === 429) response = await store?.match(api).catch(() => void 0) ?? response;
	if (response.status === 404 && response.headers.get("x-error-code") === "RevisionNotFound") throw new Error(`${repo} has no revision '${revision}'`);
	const info = response.ok ? await response.json().catch(() => {
		throw new Error(`cannot look up ${source}: the Hub's answer is not JSON`);
	}) : null;
	if ([
		401,
		403,
		404
	].includes(response.status) || info?.gated) throw new Error(`cannot load ${source}: the repo is missing, private or gated, and the browser can only load public repos`);
	if (!response.ok) throw new Error(`cannot look up ${source}: HTTP ${response.status}`);
	const files = new Set((info.siblings ?? []).map((s) => s.rfilename));
	const url = (file) => `${HUB}/${repo}/resolve/${info.sha}/${file.split("/").map(encodeURIComponent).join("/")}`;
	const weights = {};
	for (const [quant, names] of Object.entries(WEIGHTS)) {
		const found = names.find((name) => files.has(name));
		if (found) weights[quant] = url(found);
	}
	const missing = ["config.json", "tokenizer.json"].filter((name) => !files.has(name));
	if (!weights.q8) missing.push(`weights (${WEIGHTS.q8.join(" or ")})`);
	if (missing.length > 0) throw new Error(`${source} at ${info.sha} has no ${missing.join(", ")}`);
	const voiceFiles = /* @__PURE__ */ new Map();
	for (const dir of VOICE_DIRS) for (const file of files) {
		if (!file.startsWith(`${dir}/`) || !file.endsWith(".safetensors")) continue;
		const name = file.slice(dir.length + 1, -12);
		if (name && !name.includes("/") && !voiceFiles.has(name)) voiceFiles.set(name, file);
	}
	if (!voiceFiles.has("default") && files.has(DEFAULT_VOICE_FILE)) voiceFiles.set("default", DEFAULT_VOICE_FILE);
	await store?.put(api, new Response(JSON.stringify(info))).catch(() => {});
	const names = [...voiceFiles.keys()].sort();
	const defaultVoice = voiceFiles.has("default") ? "default" : names[0];
	return {
		weights,
		tokenizer: url("tokenizer.json"),
		config: url("config.json"),
		voices: Object.fromEntries(names.map((name) => [name, url(voiceFiles.get(name))])),
		...defaultVoice ? { defaultVoice } : {}
	};
}
//#endregion
//#region node_modules/phonon-tts/wav.js
/**
* Encode mono float PCM as a 16-bit WAV file.
*
* @param {Float32Array} pcm samples in [-1, 1]; anything outside is clipped.
* @param {number} sampleRate
* @returns {Blob}
*/
function encodeWav(pcm, sampleRate) {
	const dataSize = pcm.length * 2;
	const view = new DataView(new ArrayBuffer(44 + dataSize));
	const ascii = (offset, s) => {
		for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
	};
	ascii(0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	ascii(8, "WAVE");
	ascii(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	ascii(36, "data");
	view.setUint32(40, dataSize, true);
	for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
	return new Blob([view.buffer], { type: "audio/wav" });
}
/**
* Join PCM chunks into one buffer.
*
* @param {Float32Array[]} chunks
* @returns {Float32Array}
*/
function concatPcm(chunks) {
	const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.length;
	}
	return out;
}
//#endregion
//#region node_modules/phonon-tts/index.js
var LANGS = [
	"en",
	"fr",
	"de",
	"es",
	"pt",
	"none"
];
/** Rewrite rules the Rust side knows, beyond the whole-string values below. */
var RULES = [
	"numbers",
	"currency",
	"dashed-digits",
	"emails",
	"urls",
	"phones",
	"times",
	"dates"
];
/** Values `Rules`'s `FromStr` accepts only as the entire string, never inside a list. */
var WHOLE_RULES = [
	"default",
	"all",
	"none",
	"off"
];
/** The seed Rust and Python use when none is given, so the same request gives the same audio. */
var DEFAULT_SEED = 4242424242424242n;
var PhononTTS = class PhononTTS {
	#worker;
	#nextId = 0;
	/** Request id -> handlers for its replies. */
	#pending = /* @__PURE__ */ new Map();
	/** Tail of the generation queue: the worker runs one generation at a time. */
	#queue = Promise.resolve();
	#voices;
	#defaultVoice;
	#disposed = false;
	/** Why the instance stopped, when it was not `dispose()`: the worker's crash. */
	#failure = null;
	/** Samples per second of the audio this model produces (24000 for Phonon). */
	sampleRate;
	/** SIMD features the wasm module was built with, e.g. `{ simd128: true }`. */
	features;
	/** Where generation runs: `'webgpu'` or `'cpu'`. */
	device;
	/** Why `device` is what it is, e.g. `'default'` or `'requested'`. */
	deviceReason;
	/** CPU threads generation runs on, counting the worker that owns the model. */
	threads;
	/** Why `threads` is what it is, e.g. `'default'` or `'the page is not cross-origin isolated'`. */
	threadsReason;
	/** The languages the model was trained for, as listed in its config. */
	languages;
	/**
	* Download (or read from cache) a checkpoint and start it in a worker.
	*
	* @param {import('./index.js').LoadOptions} options
	* @returns {Promise<PhononTTS>}
	*/
	static async load(options) {
		const { lang, rewrites, conditions, quant = "q8", model = DEFAULT_MODEL, voices, cache = true, onProgress, workerUrl, wasmUrl, threadsWasmUrl, simdWasmUrl, threadsSimdWasmUrl, threads = "auto", device } = options ?? {};
		if (!LANGS.includes(lang)) throw new TypeError(`lang is required: one of ${LANGS.map((l) => `'${l}'`).join(", ")}`);
		if (quant !== "f32" && quant !== "q8") throw new TypeError(`quant must be 'f32' or 'q8', got '${quant}'`);
		if (device !== void 0 && device !== "auto" && device !== "webgpu" && device !== "cpu") throw new TypeError(`device must be 'auto', 'webgpu' or 'cpu', got ${JSON.stringify(device)}`);
		if (device === "webgpu" && quant !== "q8") throw new TypeError("device 'webgpu' needs quant 'q8': f32 weights cannot be quantized on the GPU");
		if (threads !== "auto" && !(Number.isInteger(threads) && threads >= 1)) throw new TypeError(`threads must be 'auto' or a positive integer, got ${JSON.stringify(threads)}`);
		if (rewrites !== void 0) {
			if (typeof rewrites !== "string") throw new TypeError("rewrites must be a string");
			const value = rewrites.trim().toLowerCase();
			const unknown = WHOLE_RULES.includes(value) ? [] : value.split(",").map((r) => r.trim()).filter((r) => !RULES.includes(r));
			if (unknown.length > 0) throw new TypeError(`unknown rewrite rule(s) ${unknown.map((r) => `'${r}'`).join(", ")}: expected ${WHOLE_RULES.map((r) => `'${r}'`).join(", ")}, or ${RULES.map((r) => `'${r}'`).join(", ")}`);
		}
		if (conditions !== void 0 && !(typeof conditions === "object" && conditions !== null && !Array.isArray(conditions))) throw new TypeError("conditions must be an object of name to value, e.g. { duration_delta: 0.5 }");
		const conditionList = Object.entries(conditions ?? {}).map(([name, value]) => {
			if (typeof value !== "string" && !Number.isFinite(value)) throw new TypeError(`condition '${name}' must be a string or a finite number`);
			return `${name}=${value}`;
		});
		const spec = typeof model === "string" ? await resolveHubModel(model, { cache }) : model;
		if (typeof spec !== "object" || spec === null || Array.isArray(spec)) throw new TypeError("model must say where the checkpoint's files are, e.g. { weights: { q8: '/model/model.q8.gguf' }, tokenizer: '/model/tokenizer.json', config: '/model/config.json', voices: { Freya: '/model/voices/Freya.safetensors' } }, or name a Hugging Face repo, 'hf://owner/name'. Leave it out for the default model.");
		if (!isUrl(spec.tokenizer)) throw new TypeError("model.tokenizer is required: the URL of the checkpoint's tokenizer.json");
		if (!isUrl(spec.config) || String(spec.config).length === 0) throw new TypeError("model.config is required: the URL of the checkpoint's config.json");
		if (!isUrl(spec.weights?.[quant])) throw new TypeError(`model has no '${quant}' weights: set model.weights.${quant}, or pick another quant`);
		const defaultVoice = spec.defaultVoice ?? Object.keys(spec.voices ?? {})[0];
		const preload = voices ?? (defaultVoice ? [defaultVoice] : []);
		const worker = workerUrl ? new Worker(workerUrl, { type: "module" }) : new Worker(new URL(
			/* @vite-ignore */
			"/assets/worker-Bqx4YL99.js",
			"" + import.meta.url
		), { type: "module" });
		const tts = new PhononTTS(worker, spec, defaultVoice);
		try {
			const reply = await tts.#request({
				type: "init",
				options: {
					lang,
					rewrites,
					conditions: conditionList,
					quant,
					model: resolveModel(spec),
					preload,
					cache,
					wasmUrl: wasmUrl ? resolveUrl(wasmUrl) : void 0,
					threadsWasmUrl: threadsWasmUrl ? resolveUrl(threadsWasmUrl) : void 0,
					simdWasmUrl: simdWasmUrl ? resolveUrl(simdWasmUrl) : void 0,
					threadsSimdWasmUrl: threadsSimdWasmUrl ? resolveUrl(threadsSimdWasmUrl) : void 0,
					threads,
					device
				}
			}, { onProgress });
			tts.sampleRate = reply.sampleRate;
			tts.features = reply.features;
			tts.device = reply.device;
			tts.languages = reply.languages;
			if (lang !== "none" && tts.languages.length && !tts.languages.includes(lang)) console.warn(`[phonon-tts] text is normalized as ${lang}, but the model was trained for ${tts.languages.join(", ")}`);
			tts.deviceReason = reply.deviceReason;
			tts.threads = reply.threads;
			tts.threadsReason = reply.threadsReason;
			return tts;
		} catch (e) {
			tts.dispose();
			throw e;
		}
	}
	/** @private Use `PhononTTS.load`. */
	constructor(worker, model, defaultVoice) {
		this.#worker = worker;
		this.#voices = new Set(Object.keys(model.voices ?? {}));
		this.#defaultVoice = defaultVoice;
		worker.onmessage = ({ data }) => {
			if (data.type === "store") return void storeBytes(data.url, data.bytes);
			this.#pending.get(data.id)?.[data.type]?.(data);
		};
		worker.onerror = (e) => {
			e.preventDefault?.();
			const error = /* @__PURE__ */ new Error(`phonon-tts worker failed: ${e.message || "could not start"}`);
			this.#disposed = true;
			this.#failure = error;
			worker.terminate();
			this.#failAll(error);
		};
	}
	/** Names of the voices this model can speak with: bundled ones and any added. */
	get voices() {
		return [...this.#voices];
	}
	/**
	* Register a voice under `name`, from a URL or from the bytes of a voice `.safetensors`
	* file: a precomputed embedding (`emb`) or the KV-cache format of `embeddings_v2/`.
	*
	* @param {string} name
	* @param {string | URL | ArrayBuffer | Uint8Array | Blob} source
	*/
	addVoice(name, source) {
		const added = this.#queue.then(() => this.#addVoiceNow(name, source));
		this.#queue = added.catch(() => {});
		return added;
	}
	async #addVoiceNow(name, source) {
		let payload;
		const transfer = [];
		if (typeof source === "string" || source instanceof URL) payload = resolveUrl(source);
		else {
			const bytes = source instanceof Blob ? await source.arrayBuffer() : source;
			payload = bytes instanceof ArrayBuffer ? bytes.slice(0) : bytes.slice().buffer;
			transfer.push(payload);
		}
		await this.#request({
			type: "add_voice",
			name,
			source: payload
		}, { transfer });
		this.#voices.add(name);
	}
	/**
	* Speak `text`, yielding audio as it is generated: mono `Float32Array`s at `sampleRate`,
	* 80 ms each. Long text is split at sentence boundaries and spoken chunk by chunk.
	*
	* @param {string} text
	* @param {import('./index.js').SpeechOptions} [options]
	* @returns {import('./index.js').SpeechStream}
	*/
	stream(text, options = {}) {
		const { voice = this.#defaultVoice, temperature = .3, signal } = options;
		const seed = toSeed(options.seed ?? DEFAULT_SEED);
		const id = this.#nextId++;
		const buffered = [];
		let waiting = null;
		let finished = false;
		let failure = null;
		let started = false;
		let cancelled = false;
		let resolveDone, rejectDone;
		const done = new Promise((res, rej) => (resolveDone = res, rejectDone = rej));
		done.catch(() => {});
		const wake = () => {
			const w = waiting;
			waiting = null;
			w?.();
		};
		const finish = (err, stats) => {
			if (finished) return;
			finished = true;
			failure = err;
			signal?.removeEventListener("abort", cancel);
			err ? rejectDone(err) : resolveDone(stats);
			wake();
		};
		const cancel = () => {
			buffered.length = 0;
			if (finished || cancelled) return;
			cancelled = true;
			if (started) this.#worker.postMessage({
				type: "cancel",
				id
			});
			else finish(null, { cancelled: true });
		};
		if (signal?.aborted) cancel();
		else signal?.addEventListener("abort", cancel, { once: true });
		const handlers = {
			chunk: ({ pcm }) => {
				if (cancelled) return;
				buffered.push(pcm);
				wake();
			},
			result: ({ value }) => {
				this.#pending.delete(id);
				finish(null, value);
			},
			error: ({ message }) => {
				this.#pending.delete(id);
				finish(new Error(message));
			}
		};
		const run = () => new Promise((settled) => {
			done.then(settled, settled);
			if (finished || this.#disposed) return finish(this.#disposed ? this.#endError() : null, { cancelled: true });
			started = true;
			this.#pending.set(id, handlers);
			this.#worker.postMessage({
				type: "generate",
				id,
				text,
				voice,
				temperature,
				seed
			});
		});
		this.#queue = this.#queue.then(run, run);
		return {
			sampleRate: this.sampleRate,
			done,
			cancel,
			async *[Symbol.asyncIterator]() {
				try {
					for (;;) if (buffered.length) yield buffered.shift();
					else if (finished) break;
					else await new Promise((w) => waiting = w);
					if (failure) throw failure;
				} finally {
					cancel();
				}
			}
		};
	}
	/**
	* Speak `text` and return the whole waveform once it is done.
	*
	* @param {string} text
	* @param {import('./index.js').SpeechOptions} [options]
	* @returns {Promise<Float32Array>}
	*/
	async synth(text, options) {
		const chunks = [];
		for await (const pcm of this.stream(text, options)) chunks.push(pcm);
		return concatPcm(chunks);
	}
	/**
	* Speak `text` and return it as a 16-bit mono WAV file.
	*
	* @param {string} text
	* @param {import('./index.js').SpeechOptions} [options]
	* @returns {Promise<Blob>}
	*/
	async synthWav(text, options) {
		return encodeWav(await this.synth(text, options), this.sampleRate);
	}
	/** Stop the worker and free the model. Every pending request fails. */
	dispose() {
		if (this.#disposed) return;
		this.#disposed = true;
		this.#worker.terminate();
		this.#failAll(disposedError());
	}
	#endError() {
		return this.#failure ?? disposedError();
	}
	#failAll(error) {
		for (const handlers of this.#pending.values()) handlers.error({ message: error.message });
		this.#pending.clear();
	}
	#request(message, { onProgress, transfer = [] } = {}) {
		if (this.#disposed) return Promise.reject(this.#endError());
		const id = this.#nextId++;
		return new Promise((resolve, reject) => {
			this.#pending.set(id, {
				progress: ({ file, loaded, total, cached }) => onProgress?.({
					file,
					loaded,
					total,
					cached
				}),
				result: ({ value }) => {
					this.#pending.delete(id);
					resolve(value);
				},
				error: ({ message }) => {
					this.#pending.delete(id);
					reject(new Error(message));
				}
			});
			this.#worker.postMessage({
				...message,
				id
			}, transfer);
		});
	}
};
/** A seed as the model takes it: a `u64`, carried as a `bigint`. */
function toSeed(seed) {
	const value = typeof seed === "bigint" ? seed : Number.isSafeInteger(seed) ? BigInt(seed) : null;
	if (value === null || value < 0n || value >= 1n << 64n) {
		const got = `${String(seed)} (${typeof seed})`;
		throw new RangeError(`seed must be a whole number from 0 to 2^64 - 1, as a number up to ${Number.MAX_SAFE_INTEGER} or a bigint; got ${got}`);
	}
	return value;
}
/** What `resolveUrl` takes: a URL string, relative to the page or absolute, or a `URL`. */
function isUrl(url) {
	return typeof url === "string" || url instanceof URL;
}
/**
* An absolute URL for `url`. The worker resolves relative URLs against its own script, which
* lives inside the package, so anything relative has to be made absolute against the page.
*/
function resolveUrl(url) {
	return globalThis.location ? new URL(url, globalThis.location.href).href : String(url);
}
function resolveModel({ weights, tokenizer, config, voices }) {
	const map = (o) => Object.fromEntries(Object.entries(o).map(([k, u]) => [k, resolveUrl(u)]));
	return {
		weights: map(weights),
		tokenizer: resolveUrl(tokenizer),
		config: resolveUrl(config),
		voices: map(voices ?? {})
	};
}
function disposedError() {
	return /* @__PURE__ */ new Error("this PhononTTS has been disposed");
}
//#endregion
export { DEFAULT_MODEL, PhononTTS, clearCache, concatPcm, encodeWav };
