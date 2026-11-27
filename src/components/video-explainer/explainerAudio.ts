// Procedural Web Audio background score synthesizer, TTS+Score export mixer & MediaRecorder canvas exporter

export class ExplainerMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private timerId: number | null = null;
  private stepIdx = 0;
  private running = false;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  private ownsCtx = true;

  start(
    mood: 'ambient' | 'upbeat' | 'editorial' | 'cinematic' = 'editorial',
    volume = 0.16,
    sharedCtx?: AudioContext,
    sharedDestination?: AudioNode
  ): MediaStream | null {
    this.stop();
    if (typeof window === 'undefined') return null;

    let ctx: AudioContext;
    if (sharedCtx) {
      ctx = sharedCtx;
      this.ownsCtx = false;
    } else {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      this.ownsCtx = true;
    }

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.01, volume), ctx.currentTime + 0.5);

    let dest: MediaStreamAudioDestinationNode | null = null;
    if (sharedDestination) {
      master.connect(sharedDestination);
    } else {
      dest = ctx.createMediaStreamDestination();
      master.connect(ctx.destination);
      master.connect(dest);
    }

    this.ctx = ctx;
    this.masterGain = master;
    this.destNode = dest;
    this.running = true;
    this.stepIdx = 0;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const chordMap: Record<string, number[][]> = {
      editorial: [
        [220.0, 261.63, 329.63, 392.0],
        [174.61, 220.0, 261.63, 329.63],
        [130.81, 196.0, 246.94, 329.63],
        [196.0, 246.94, 293.66, 392.0],
      ],
      upbeat: [
        [261.63, 329.63, 392.0, 493.88],
        [293.66, 369.99, 440.0, 523.25],
        [220.0, 261.63, 329.63, 440.0],
        [196.0, 246.94, 293.66, 392.0],
      ],
      ambient: [
        [196.0, 293.66, 329.63, 440.0],
        [164.81, 246.94, 293.66, 392.0],
        [146.83, 220.0, 261.63, 329.63],
        [130.81, 196.0, 246.94, 329.63],
      ],
      cinematic: [
        [146.83, 220.0, 261.63, 349.23],
        [116.54, 174.61, 220.0, 293.66],
        [130.81, 196.0, 261.63, 329.63],
        [110.0, 164.81, 220.0, 261.63],
      ],
    };

    const chords = chordMap[mood] || chordMap.editorial;
    const tempoMs = mood === 'upbeat' ? 420 : mood === 'ambient' ? 780 : 560;

    const triggerPulse = () => {
      if (!this.running || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const chord = chords[Math.floor(this.stepIdx / 4) % chords.length];
      const beatInBar = this.stepIdx % 4;

      if (beatInBar === 0) {
        chord.forEach((freq, i) => {
          if (!this.ctx || !this.masterGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          osc.type = i === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq * (i === 0 ? 0.5 : 1), now);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1100, now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(i === 0 ? 0.22 : 0.11, now + 0.25);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (tempoMs * 4) / 1000);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + (tempoMs * 4.2) / 1000);
        });
      }

      const arpFreq = chord[(this.stepIdx + beatInBar) % chord.length] * 2;
      const pluck = this.ctx.createOscillator();
      const pluckGain = this.ctx.createGain();
      pluck.type = 'sine';
      pluck.frequency.setValueAtTime(arpFreq, now);
      pluckGain.gain.setValueAtTime(0.0001, now);
      pluckGain.gain.linearRampToValueAtTime(0.08, now + 0.015);
      pluckGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      pluck.connect(pluckGain);
      pluckGain.connect(this.masterGain);
      pluck.start(now);
      pluck.stop(now + 0.32);

      this.stepIdx += 1;
    };

    triggerPulse();
    this.timerId = window.setInterval(triggerPulse, tempoMs);
    return dest?.stream || null;
  }

  playTransitionChime(): void {
    if (!this.running || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {}
  }

  getStream(): MediaStream | null {
    return this.destNode?.stream || null;
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    try {
      this.masterGain?.disconnect();
    } catch {}
    if (this.ownsCtx) {
      try {
        this.ctx?.close();
      } catch {}
    }
    this.ctx = null;
    this.masterGain = null;
    this.destNode = null;
  }
}

/**
 * Combined Web Audio export mixer that blends decoded TTS voiceover clips + optional background music
 * directly into a single MediaStreamAudioDestinationNode so MP4 & MP3 exports contain full synced audio.
 */
export class ExplainerExportMixer {
  readonly ctx: AudioContext;
  readonly destination: MediaStreamAudioDestinationNode;
  readonly masterGain: GainNode;
  private activeVoiceSource: AudioBufferSourceNode | null = null;
  private musicEngine: ExplainerMusicEngine | null = null;

  constructor() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.destination = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.destination);
    // Keep silent monitor off speakers during export so it stays clean
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  startMusic(mood: 'ambient' | 'upbeat' | 'editorial' | 'cinematic', volume: number): void {
    this.musicEngine = new ExplainerMusicEngine();
    this.musicEngine.start(mood, volume, this.ctx, this.masterGain);
  }

  async decodeAudioUrl(url: string): Promise<AudioBuffer | null> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const arr = await resp.arrayBuffer();
      return await this.ctx.decodeAudioData(arr.slice(0));
    } catch {
      return null;
    }
  }

  playVoiceBuffer(buffer: AudioBuffer, onEnded?: () => void): void {
    this.stopCurrentVoice();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 1.0;
    src.connect(gain);
    gain.connect(this.masterGain);
    src.onended = () => {
      if (this.activeVoiceSource === src) this.activeVoiceSource = null;
      onEnded?.();
    };
    this.activeVoiceSource = src;
    src.start(0);
  }

  stopCurrentVoice(): void {
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.onended = null;
        this.activeVoiceSource.stop();
      } catch {}
      this.activeVoiceSource = null;
    }
  }

  getStream(): MediaStream {
    return this.destination.stream;
  }

  close(): void {
    this.stopCurrentVoice();
    this.musicEngine?.stop();
    this.musicEngine = null;
    try {
      this.ctx.close();
    } catch {}
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function createCanvasVideoRecorder(
  canvas: HTMLCanvasElement,
  audioStream?: MediaStream | null
): {
  start: () => void;
  stopAndGetBlob: () => Promise<Blob>;
  stopAndDownload: (filename: string) => Promise<void>;
} {
  const videoStream = canvas.captureStream(30);
  const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
  if (audioStream) {
    audioStream.getAudioTracks().forEach((t) => tracks.push(t));
  }
  const combined = new MediaStream(tracks);
  const mimeType =
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: 4_500_000,
    audioBitsPerSecond: 192_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopAndGetBlob = () =>
    new Promise<Blob>((resolve) => {
      if (recorder.state === 'inactive') {
        resolve(new Blob(chunks, { type: mimeType }));
        return;
      }
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
      recorder.stop();
    });

  return {
    start: () => {
      chunks.length = 0;
      recorder.start(250);
    },
    stopAndGetBlob,
    stopAndDownload: async (filename: string) => {
      const blob = await stopAndGetBlob();
      downloadBlob(blob, filename.endsWith('.webm') ? filename : `${filename}.webm`);
    },
  };
}
