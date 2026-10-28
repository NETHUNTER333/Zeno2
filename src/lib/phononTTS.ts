import { PhononTTS } from 'phonon-tts';
import wasmUrl from 'phonon-tts/wasm/phonon_tts_bg.wasm?url';
import simdWasmUrl from 'phonon-tts/wasm/phonon_tts_simd_bg.wasm?url';
import threadsWasmUrl from 'phonon-tts/wasm-threads/phonon_tts_bg.wasm?url';
import threadsSimdWasmUrl from 'phonon-tts/wasm-threads/phonon_tts_simd_bg.wasm?url';

let ttsPromise: Promise<PhononTTS | null> | null = null;
let phononUnavailable = false;
let activeController: AbortController | null = null;
let activeContext: AudioContext | null = null;

export function isPhononSupported(): boolean {
  if (phononUnavailable) return false;
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof WebAssembly === 'object' &&
    !!(window.AudioContext || (window as any).webkitAudioContext)
  );
}

export async function loadPhonon(): Promise<PhononTTS | null> {
  if (!isPhononSupported()) return null;
  if (!ttsPromise) {
    ttsPromise = PhononTTS.load({
      model: 'hf://gradium/phonon-31m-en',
      lang: 'en',
      quant: 'q8',
      device: 'auto',
      wasmUrl,
      simdWasmUrl,
      threadsWasmUrl,
      threadsSimdWasmUrl,
    }).catch(() => {
      phononUnavailable = true;
      ttsPromise = null;
      return null;
    });
  }
  return ttsPromise;
}

export function stopPhononSpeech() {
  try {
    activeController?.abort();
  } catch {}
  activeController = null;
  try {
    activeContext?.close();
  } catch {}
  activeContext = null;
}

export interface PhononCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Speak text locally with the Phonon 31M model (no API key, runs on-device).
 * Resolves true if Phonon handled the request (even if stopped by the user).
 */
export async function speakWithPhonon(
  text: string,
  callbacks: PhononCallbacks = {}
): Promise<boolean> {
  if (!isPhononSupported()) return false;

  const instance = await loadPhonon();
  if (!instance) return false;

  stopPhononSpeech();

  const controller = new AbortController();
  activeController = controller;

  const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
  const sampleRate = instance.sampleRate || 24000;
  const ctx: AudioContext = new AudioCtxCtor({ sampleRate });
  activeContext = ctx;

  let started = false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    let nextStart = ctx.currentTime + 0.05;
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

    const remainingMs = Math.max(0, (nextStart - ctx.currentTime) * 1000);
    if (remainingMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingMs));
    }

    if (activeController === controller) {
      stopPhononSpeech();
      callbacks.onEnd?.();
    }
    return true;
  } catch (err: any) {
    if (activeController === controller) stopPhononSpeech();
    if (err?.name === 'AbortError') {
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
