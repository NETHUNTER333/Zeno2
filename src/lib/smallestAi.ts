// Rumik AI Silk Read Out Loud Engine with Language & Male/Female Audio Preferences
import { getAuthHeaders } from './firebase';

export type TtsVoiceGender = 'female' | 'male';

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

const LANG_STORAGE_KEY = 'zeno_tts_lang';
const GENDER_STORAGE_KEY = 'zeno_tts_gender';

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
    window.dispatchEvent(new CustomEvent('zeno-tts-prefs-changed'));
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
    window.dispatchEvent(new CustomEvent('zeno-tts-prefs-changed'));
  } catch {}
}

let activeAudioElement: HTMLAudioElement | null = null;
let activeAbortController: AbortController | null = null;

export function stopSmallestSpeech() {
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
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speak text using Rumik AI Silk TTS (/api/tts) in the user's preferred language and Male/Female voice.
 */
export async function speakTextWithSmallestAi(
  text: string,
  selectedLangCode?: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void,
  selectedGender?: TtsVoiceGender,
  onAudioUrlReady?: (audioUrl: string) => void
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
  const gender = selectedGender || getSavedTtsGender();
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
      }),
    });

    if (controller.signal.aborted) return;

    if (response.ok) {
      const audioBlob = await response.blob();
      if (controller.signal.aborted) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      if (onAudioUrlReady) {
        onAudioUrlReady(audioUrl);
        return;
      }

      const audio = new Audio(audioUrl);
      activeAudioElement = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudioElement = null;
        onEnd?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudioElement = null;
        fallbackWebSpeech(cleanText, bcp47, gender, onStart, onEnd, onError);
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

  fallbackWebSpeech(cleanText, bcp47, gender, onStart, onEnd, onError);
}

function fallbackWebSpeech(
  text: string,
  bcp47: string,
  gender: TtsVoiceGender,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = bcp47;
    utterance.pitch = gender === 'male' ? 0.9 : 1.05;
    utterance.rate = 1.0;
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
