import { spawn } from 'child_process';
import { pipeline, env } from '@xenova/transformers';

// Configure transformers to not look for local models directory unless present
env.allowLocalModels = false;
env.useBrowserCache = false;

export interface WhisperSegment {
  start_s: number;
  duration_s: number;
  text: string;
}

export interface WhisperTranscriptionResult {
  text: string;
  segments: WhisperSegment[];
  modelUsed: string;
  language?: string;
  durationSec?: number;
}

// In-memory cache for pipelines to avoid re-initializing models
const pipelineCache: Map<string, any> = new Map();

/**
 * Returns a cached or newly initialized automatic-speech-recognition pipeline.
 */
export async function getWhisperPipeline(modelName = 'Xenova/whisper-tiny.en') {
  if (pipelineCache.has(modelName)) {
    return pipelineCache.get(modelName);
  }

  const transcriber = await pipeline('automatic-speech-recognition', modelName, {
    quantized: true,
  });
  pipelineCache.set(modelName, transcriber);
  return transcriber;
}

/**
 * Converts any audio/video input (file buffer, URL, or local path)
 * into a 16kHz mono Float32Array using system ffmpeg.
 */
export async function convertAudioTo16kHzFloat32(
  inputSource: Buffer | string
): Promise<{ audio: Float32Array; durationSec: number }> {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(inputSource);
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      ...(isBuffer ? ['-i', 'pipe:0'] : ['-i', inputSource]),
      '-ar',
      '16000',
      '-ac',
      '1',
      '-f',
      'f32le',
      'pipe:1',
    ];

    const ffmpegProc = spawn('ffmpeg', args);
    const chunks: Buffer[] = [];
    let errOutput = '';

    ffmpegProc.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpegProc.stderr.on('data', (data) => (errOutput += data.toString()));

    ffmpegProc.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(`FFmpeg failed with code ${code}: ${errOutput.slice(0, 300)}`)
        );
      }

      const totalBuffer = Buffer.concat(chunks);
      // Each 32-bit float sample takes 4 bytes
      const sampleCount = Math.floor(totalBuffer.length / 4);
      const float32Array = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        float32Array[i] = totalBuffer.readFloatLE(i * 4);
      }

      const durationSec = Number((sampleCount / 16000).toFixed(2));
      resolve({ audio: float32Array, durationSec });
    });

    ffmpegProc.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });

    if (isBuffer) {
      ffmpegProc.stdin.write(inputSource);
      ffmpegProc.stdin.end();
    }
  });
}

/**
 * Transcribes an audio Float32Array using Whisper ONNX pipeline with chunking and timestamps.
 */
export async function runWhisperASR(
  audio: Float32Array,
  modelName = 'Xenova/whisper-tiny.en',
  options: { language?: string; task?: 'transcribe' | 'translate' } = {}
): Promise<WhisperTranscriptionResult> {
  const transcriber = await getWhisperPipeline(modelName);

  const inferenceOpts: any = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  };

  if (options.language && options.language !== 'auto') {
    inferenceOpts.language = options.language;
  }
  if (options.task) {
    inferenceOpts.task = options.task;
  }

  const rawResult: any = await transcriber(audio, inferenceOpts);
  const text = (rawResult?.text || '').trim();
  const rawChunks: any[] = Array.isArray(rawResult?.chunks) ? rawResult.chunks : [];

  const segments: WhisperSegment[] = [];

  for (const c of rawChunks) {
    const chunkText = String(c?.text || '').trim();
    if (!chunkText) continue;

    let start_s = 0;
    let end_s = 2.5;

    if (Array.isArray(c?.timestamp)) {
      start_s = Number(c.timestamp[0] ?? 0);
      end_s = Number(c.timestamp[1] ?? start_s + 2.5);
    }

    const duration_s = Math.max(0.5, Number((end_s - start_s).toFixed(2)));

    segments.push({
      start_s: Number(start_s.toFixed(2)),
      duration_s,
      text: chunkText,
    });
  }

  // Fallback if chunks were empty but main text was generated
  if (segments.length === 0 && text) {
    const lines = text.split(/(?<=[.?!])\s+/).filter(Boolean);
    let curTime = 0;
    for (const l of lines) {
      segments.push({
        start_s: Number(curTime.toFixed(2)),
        duration_s: 3.5,
        text: l.trim(),
      });
      curTime += 3.5;
    }
  }

  return {
    text,
    segments,
    modelUsed: modelName,
    language: options.language || 'en',
    durationSec: Number((audio.length / 16000).toFixed(2)),
  };
}
