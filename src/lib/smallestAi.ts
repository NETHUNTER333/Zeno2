// Rumik AI Silk Read Out Loud Engine with Language & Male/Female Audio Preferences
import { getAuthHeaders } from './firebase';
import { isPhononSupported, speakWithPhonon, stopPhononSpeech } from './phononTTS';

export type TtsVoiceGender = 'female' | 'male';
export type TtsPlaybackSpeed = 0.5 | 1 | 1.5 | 2;

export const TTS_PLAYBACK_SPEEDS: TtsPlaybackSpeed[] = [0.5, 1, 1.5, 2];

export interface TtsLanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  bcp47: string;
}

export const TTS_LANGUAGES: TtsLanguageOption[] = [
  { code: 'english', label: 'English', nativeLabel: 'EN', bcp47: 'en-US' },
  { code: 'hinglish', label: 'Hinglish', nativeLabel: 'HI · EN', bcp47: 'hi-IN' },
  { code: 'hindi', label: 'Hindi', nativeLabel: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'telugu', label: 'Telugu', nativeLabel: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'tamil', label: 'Tamil', nativeLabel: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'kannada', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
  { code: 'malayalam', label: 'Malayalam', nativeLabel: 'മലയാളം', bcp47: 'ml-IN' },
  { code: 'bengali', label: 'Bengali', nativeLabel: 'বাংলা', bcp47: 'bn-IN' },
  { code: 'marathi', label: 'Marathi', nativeLabel: 'मराठी', bcp47: 'mr-IN' },
  { code: 'gujarati', label: 'Gujarati', nativeLabel: 'ગુજરાતી', bcp47: 'gu-IN' },
  { code: 'punjabi', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', bcp47: 'pa-IN' },
  { code: 'spanish', label: 'Spanish', nativeLabel: 'Español', bcp47: 'es-ES' },
  { code: 'french', label: 'French', nativeLabel: 'Français', bcp47: 'fr-FR' },
  { code: 'german', label: 'German', nativeLabel: 'Deutsch', bcp47: 'de-DE' },
  { code: 'arabic', label: 'Arabic', nativeLabel: 'العربية', bcp47: 'ar-SA' },
  { code: 'japanese', label: 'Japanese', nativeLabel: '日本語', bcp47: 'ja-JP' },
];

const LANG_STORAGE_KEY = 'kinich_tts_lang';
const GENDER_STORAGE_KEY = 'kinich_tts_gender';
const SPEED_STORAGE_KEY = 'kinich_tts_speed';

export function getSavedTtsLanguage(): string {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && TTS_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {}
  return 'english';
}

export function setSavedTtsLanguage(langCode: string) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, langCode);
    window.dispatchEvent(new CustomEvent('kinich-tts-prefs-changed'));
  } catch {}
}

export function getSavedTtsGender(): TtsVoiceGender {
  try {
    const saved = localStorage.getItem(GENDER_STORAGE_KEY);
    if (saved === 'male' || saved === 'female') return saved;
  } catch {}
  return 'female';
}

export function setSavedTtsGender(gender: TtsVoiceGender) {
  try {
    localStorage.setItem(GENDER_STORAGE_KEY, gender);
    window.dispatchEvent(new CustomEvent('kinich-tts-prefs-changed'));
  } catch {}
}

export function getSavedTtsSpeed(): TtsPlaybackSpeed {
  try {
    const raw = Number(localStorage.getItem(SPEED_STORAGE_KEY));
    if (raw === 0.5 || raw === 1 || raw === 1.5 || raw === 2) {
      return raw;
    }
  } catch {}
  return 1;
}

let activeAudioElement: HTMLAudioElement | null = null;
let activeAudioBaseRate = 1;
let activeAbortController: AbortController | null = null;

export function setSavedTtsSpeed(speed: TtsPlaybackSpeed) {
  try {
    localStorage.setItem(SPEED_STORAGE_KEY, String(speed));
    window.dispatchEvent(new CustomEvent('kinich-tts-prefs-changed'));
  } catch {}
  setActiveTtsPlaybackSpeed(speed);
}

export function setActiveTtsPlaybackSpeed(speed: TtsPlaybackSpeed) {
  if (activeAudioElement) {
    try {
      activeAudioElement.playbackRate = Number((activeAudioBaseRate * speed).toFixed(2));
    } catch {}
  }
}

export function stopSmallestSpeech() {
  stopPhononSpeech();
  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {}
    activeAbortController = null;
  }
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
    activeAudioElement = null;
  }
  activeAudioBaseRate = 1;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);
  const numSamples = channelData.length;
  const wavBuf = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(wavBuf);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([wavBuf], { type: 'audio/wav' });
}

async function shiftBlobToMaleVoiceIfNeeded(blob: Blob, shouldShift: boolean): Promise<Blob> {
  if (!shouldShift || typeof window === 'undefined') return blob;
  try {
    const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
    const OfflineCtxCtor = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!AudioCtxCtor || !OfflineCtxCtor) return blob;

    const arrayBuf = await blob.arrayBuffer();
    const decodeCtx = new AudioCtxCtor();
    const decoded = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
    try {
      await decodeCtx.close();
    } catch {}

    const rate = 0.81; // Shifts pitch & vocal tract formants down ~3.6 semitones into natural male baritone
    const outLength = Math.ceil(decoded.length / rate);
    const offlineCtx = new OfflineCtxCtor(1, outLength, decoded.sampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.playbackRate.value = rate;

    const lowShelf = offlineCtx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 160;
    lowShelf.gain.value = 4.5;

    source.connect(lowShelf);
    lowShelf.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    return audioBufferToWavBlob(rendered);
  } catch {
    return blob;
  }
}

/**
 * Speak text using Rumik AI Silk / Gemini / Neural TTS (/api/tts) in the user's preferred language and Male/Female voice.
 */
export async function speakTextWithSmallestAi(
  text: string,
  selectedLangCode?: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void,
  selectedGender?: TtsVoiceGender,
  onAudioUrlReady?: (audioUrl: string) => void,
  selectedSpeed?: TtsPlaybackSpeed
): Promise<void> {
  stopSmallestSpeech();

  const cleanText = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[\d+\]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[#*_~>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);

  if (!cleanText) return;

  const language =
    selectedLangCode && selectedLangCode !== 'auto'
      ? selectedLangCode
      : getSavedTtsLanguage();
  const gender: TtsVoiceGender = selectedGender === 'male' || (!selectedGender && getSavedTtsGender() === 'male') ? 'male' : 'female';
  const speed: TtsPlaybackSpeed = selectedSpeed || getSavedTtsSpeed();
  const bcp47 = TTS_LANGUAGES.find((l) => l.code === language)?.bcp47 || 'en-US';

  const controller = new AbortController();
  activeAbortController = controller;

  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: authHeaders,
      signal: controller.signal,
      body: JSON.stringify({
        text: cleanText,
        language,
        gender,
        speed,
      }),
    });

    if (controller.signal.aborted) return;

    if (response.ok) {
      const rawAudioBlob = await response.blob();
      if (controller.signal.aborted) return;

      const needsMaleShift = response.headers.get('X-Kinich-Tts-Pitch-Shift') === 'male';
      const audioBlob = await shiftBlobToMaleVoiceIfNeeded(rawAudioBlob, needsMaleShift);
      if (controller.signal.aborted) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      if (onAudioUrlReady) {
        onAudioUrlReady(audioUrl);
        return;
      }

      const audio = new Audio(audioUrl);
      let baseRate = 1;
      if (needsMaleShift && audioBlob === rawAudioBlob) {
        try {
          (audio as any).preservesPitch = false;
          (audio as any).mozPreservesPitch = false;
          (audio as any).webkitPreservesPitch = false;
          baseRate = 0.82;
        } catch {}
      }
      activeAudioBaseRate = baseRate;
      try {
        audio.playbackRate = Number((baseRate * speed).toFixed(2));
      } catch {}
      activeAudioElement = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudioElement = null;
        activeAudioBaseRate = 1;
        onEnd?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudioElement = null;
        activeAudioBaseRate = 1;
        fallbackWebSpeech(cleanText, bcp47, gender, onStart, onEnd, onError, speed);
      };

      onStart?.();
      await audio.play();
      return;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      onEnd?.();
      return;
    }
  }

  // Only use Phonon on-device fallback for Female English (Phonon 31M is a female-only model)
  const isEnglish = language === 'english' || language === 'en' || bcp47.startsWith('en');
  if (gender === 'female' && isEnglish && isPhononSupported()) {
    const handled = await speakWithPhonon(cleanText, { onStart, onEnd, onError });
    if (handled) return;
  }

  fallbackWebSpeech(cleanText, bcp47, gender, onStart, onEnd, onError, speed);
}

function fallbackWebSpeech(
  text: string,
  bcp47: string,
  gender: TtsVoiceGender,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void,
  speed: TtsPlaybackSpeed = 1
) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = bcp47;

    const voices = window.speechSynthesis.getVoices?.() || [];
    const langPrefix = bcp47.split('-')[0].toLowerCase();
    const matchingVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith(langPrefix));
    const voicePool = matchingVoices.length > 0 ? matchingVoices : voices;

    if (gender === 'male') {
      const maleVoice = voicePool.find((v) =>
        /\b(male|david|daniel|mark|guy|george|james|rishi|arjun|prabhat|madhur|mohan|sundar|karthik|thomas|nicolas|jorge|pablo|stefan|ichiro|naoki|iom|#male)\b/i.test(
          `${v.name} ${v.voiceURI}`
        )
      );
      if (maleVoice) utterance.voice = maleVoice;
      utterance.pitch = 0.68;
      utterance.rate = Math.max(0.45, Math.min(2.2, Number((0.96 * speed).toFixed(2))));
    } else {
      const femaleVoice = voicePool.find((v) =>
        /\b(female|zira|samantha|victoria|karen|moira|tessa|veena|swara|neerja|heera|kalpana|salli|joanna|amy| #female)\b/i.test(
          `${v.name} ${v.voiceURI}`
        )
      );
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.pitch = 1.08;
      utterance.rate = Math.max(0.5, Math.min(2.2, Number((1.0 * speed).toFixed(2))));
    }

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = (e) => {
      onEnd?.();
      onError?.(e);
    };
    window.speechSynthesis.speak(utterance);
  } else {
    onEnd?.();
  }
}
