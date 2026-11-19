import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Layers,
  MessageSquare,
  Mic,
  MicOff,
  Settings,
  ShieldAlert,
  Sparkles,
  Square,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  HITAISHI_BACKGROUNDS,
  HITAISHI_CATALOG,
  createStageCharacterFromCatalog,
  type HitaishiCatalogCharacter,
  type HitaishiStageCharacter,
} from './hitaishiCatalog';
import {
  HitaishiAvatarCanvas,
  type HitaishiSpeechClipRequest,
} from './HitaishiAvatarCanvas';
import {
  buildHitaishiWorkspaceContextPayload,
  getSavedHitaishiHistory,
  getSavedHitaishiScope,
  saveHitaishiHistory,
  setSavedHitaishiScope,
  syncHitaishiTurnAcrossWorkspaces,
  type HitaishiWorkspaceScope,
} from '../../lib/hitaishiWorkspaceBridge';
import { getAuthHeaders } from '../../lib/firebase';

interface HitaishiStagePageProps {
  onBack: () => void;
  onOpenStudySpace?: () => void;
  onOpenSideChat?: () => void;
}

interface CompanionChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  expression?: string | null;
  action?: string | null;
}

interface HitaishiRateLimitClientState {
  limitPerMinute: number;
  remainingPerMinute: number;
  resetAtMs: number;
  retryAfterSec: number;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  plan: string;
}

const MALE_CHARACTER_IDS = new Set(['k02', 'char07', 'd02', 'v04']);

const LANGUAGE_TO_BCP47: Record<string, string> = {
  english: 'en-US',
  hinglish: 'en-IN',
  telugu: 'te-IN',
  hindi: 'hi-IN',
  tamil: 'ta-IN',
  kannada: 'kn-IN',
  malayalam: 'ml-IN',
  bengali: 'bn-IN',
  marathi: 'mr-IN',
  gujarati: 'gu-IN',
  punjabi: 'pa-IN',
  spanish: 'es-ES',
  french: 'fr-FR',
  german: 'de-DE',
  arabic: 'ar-SA',
  japanese: 'ja-JP',
};

function downsampleFloat32To16kInt16(
  input: Float32Array,
  inputSampleRate: number
): Int16Array {
  if (inputSampleRate === 16000) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = inputSampleRate / 16000;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.min(
      input.length,
      Math.round((offsetResult + 1) * ratio)
    );
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
      accum += input[i];
      count++;
    }
    const avg = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, avg));
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export const HitaishiStagePage: React.FC<HitaishiStagePageProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenSideChat,
}) => {
  // Strictly 1 active anime companion on stage at a time
  const [character, setCharacter] = useState<HitaishiStageCharacter>(() => {
    const savedId =
      typeof window !== 'undefined'
        ? localStorage.getItem('hitaishi_active_char_id')
        : null;
    const initialCat =
      (savedId && HITAISHI_CATALOG.find((c) => c.id === savedId)) ||
      HITAISHI_CATALOG.find((c) => c.id === 'n01') ||
      HITAISHI_CATALOG[0];
    const ch = createStageCharacterFromCatalog(initialCat, 0.5, 1, 0);
    ch.isSpeaking = false;
    ch.activeExpression = null;
    ch.currentSubtitle =
      initialCat.greetingLines[0] ||
      `Hi, I'm ${initialCat.name}. Tap the mic or type to talk with me!`;
    return ch;
  });

  // Multi-turn conversation memory persisted across sessions
  const [chatHistory, setChatHistory] = useState<CompanionChatTurn[]>(() => {
    const saved = getSavedHitaishiHistory();
    return saved.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      expression: m.expression,
      action: m.action,
    }));
  });

  // Workspace integration state
  const [workspaceScope, setWorkspaceScope] = useState<HitaishiWorkspaceScope>(() =>
    getSavedHitaishiScope()
  );
  const [syncToWorkspaces, setSyncToWorkspaces] = useState<boolean>(true);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState(() =>
    buildHitaishiWorkspaceContextPayload(getSavedHitaishiScope())
  );

  // Rate limiter & quota state
  const [rateLimitInfo, setRateLimitInfo] = useState<HitaishiRateLimitClientState>({
    limitPerMinute: 15,
    remainingPerMinute: 15,
    resetAtMs: Date.now() + 60_000,
    retryAfterSec: 0,
    dailyUsed: 0,
    dailyLimit: 1500,
    dailyRemaining: 1500,
    plan: 'spark',
  });
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Neural TTS audio clip routed to @livliv-dev/player/voice createSpeech
  const [speechClip, setSpeechClip] = useState<HitaishiSpeechClipRequest | null>(null);

  const updateCharacter = useCallback((patch: Partial<HitaishiStageCharacter>) => {
    setCharacter((prev) => ({ ...prev, ...patch }));
  }, []);

  // Clean Overlays: Character Selector Dropdown & Settings Sheet
  const [charDropdownOpen, setCharDropdownOpen] = useState<boolean>(false);
  const [selectorCategory, setSelectorCategory] = useState<
    'all' | '2.5d-half' | '2.5d-full'
  >('all');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [drawerSection, setDrawerSection] = useState<'workspaces' | 'voice' | 'stage'>('workspaces');

  // Clean Stage Settings
  const [backgroundId, setBackgroundId] = useState<string>('cozy-twilight');
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(true);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);

  // Input & Generation State
  const [chatInput, setChatInput] = useState<string>('');
  const [isGeneratingTurn, setIsGeneratingTurn] = useState<boolean>(false);

  // Live Duplex Voice & Microphone State
  const [liveDuplexActive, setLiveDuplexActive] = useState<boolean>(false);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [micStatusError, setMicStatusError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lipSyncTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const vadHasSpokenRef = useRef<boolean>(false);
  const vadSilenceStartRef = useRef<number>(0);
  const vadSpeechStartRef = useRef<number>(0);
  const lastRecognitionResultAtRef = useRef<number>(0);
  const interimDebounceTimerRef = useRef<number | null>(null);
  const micRafRef = useRef<number | null>(null);

  const liveDuplexActiveRef = useRef<boolean>(false);
  const isGeneratingTurnRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const geminiLiveAudioReceivedRef = useRef<boolean>(false);
  const liveWsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const voiceLanguageRef = useRef<string>(character.voiceLanguage || 'english');

  useEffect(() => {
    voiceLanguageRef.current = character.voiceLanguage || 'english';
  }, [character.voiceLanguage]);

  useEffect(() => {
    liveDuplexActiveRef.current = liveDuplexActive;
  }, [liveDuplexActive]);

  useEffect(() => {
    isGeneratingTurnRef.current = isGeneratingTurn;
  }, [isGeneratingTurn]);

  useEffect(() => {
    isSpeakingRef.current = character.isSpeaking;
  }, [character.isSpeaking]);

  // Refresh workspace snapshot whenever workspaces change
  useEffect(() => {
    const refresh = () => {
      setWorkspaceSnapshot(buildHitaishiWorkspaceContextPayload(workspaceScope));
    };
    refresh();
    window.addEventListener('hitaishi-workspace-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('hitaishi-workspace-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [workspaceScope]);

  // Fetch initial Hitaishi rate limit status
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/hitaishi/status', { headers });
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data?.rateLimit) {
            setRateLimitInfo(data.rateLimit);
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cooldown countdown timer when rate-limited
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const activeBackground = useMemo(
    () =>
      HITAISHI_BACKGROUNDS.find((b) => b.id === backgroundId) || HITAISHI_BACKGROUNDS[0],
    [backgroundId]
  );

  const isLightBackground =
    activeBackground.id === 'warm-ivory' ||
    activeBackground.id === 'crisp-white' ||
    activeBackground.id === 'pastel-sakura' ||
    activeBackground.id === 'sky-breeze' ||
    activeBackground.id === 'lavender-dream';

  // Stop any current speech immediately
  const stopCurrentSpeech = useCallback(() => {
    if (lipSyncTimerRef.current) {
      window.clearInterval(lipSyncTimerRef.current);
      lipSyncTimerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setSpeechClip(null);
    setCharacter((prev) => ({ ...prev, isSpeaking: false, mouthOpen: 0 }));
    isSpeakingRef.current = false;
  }, []);

  // Fallback browser speechSynthesis + syllable mouth wave
  const speakWithFallbackSynth = useCallback(
    (lineText: string) => {
      if (lipSyncTimerRef.current) {
        window.clearInterval(lipSyncTimerRef.current);
        lipSyncTimerRef.current = null;
      }

      if (
        !audioMuted &&
        !character.muted &&
        typeof window !== 'undefined' &&
        'speechSynthesis' in window
      ) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(lineText);
          const langCode = character.voiceLanguage || 'english';
          utter.lang = LANGUAGE_TO_BCP47[langCode] || 'en-US';
          const catEntry = HITAISHI_CATALOG.find((c) => c.id === character.catalogId);
          utter.pitch = catEntry?.voicePitch ?? 1.1;
          utter.rate = character.voiceSpeed || 1.0;
          utter.volume = Math.max(0, Math.min(1, character.voiceVolume));
          window.speechSynthesis.speak(utter);
        } catch {
          // ignore
        }
      }

      const durationMs = Math.min(7000, Math.max(1800, lineText.length * 58));
      const startTime = performance.now();

      lipSyncTimerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - startTime;
        if (elapsed >= durationMs) {
          if (lipSyncTimerRef.current) {
            window.clearInterval(lipSyncTimerRef.current);
            lipSyncTimerRef.current = null;
          }
          setCharacter((prev) => ({ ...prev, isSpeaking: false, mouthOpen: 0 }));
          isSpeakingRef.current = false;
          return;
        }
        const wave =
          Math.abs(Math.sin(elapsed * 0.022)) * 0.65 +
          Math.abs(Math.sin(elapsed * 0.049)) * 0.35;
        setCharacter((prev) => ({ ...prev, mouthOpen: wave }));
      }, 45);
    },
    [
      audioMuted,
      character.catalogId,
      character.muted,
      character.voiceLanguage,
      character.voiceSpeed,
      character.voiceVolume,
    ]
  );

  // Speak a line using real neural TTS (`/api/tts`) routed into `@livliv-dev/player/voice` `createSpeech`
  const speakLine = useCallback(
    async (
      lineText: string,
      expressionOverride?: string | null,
      actionOverride?: 'nod' | 'shake' | 'tilt' | 'hop' | 'shy' | null
    ) => {
      if (lipSyncTimerRef.current) {
        window.clearInterval(lipSyncTimerRef.current);
        lipSyncTimerRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }

      const normalizedExpr =
        expressionOverride === undefined
          ? character.activeExpression
          : expressionOverride === 'neutral'
            ? null
            : expressionOverride;

      isSpeakingRef.current = true;
      setCharacter((prev) => ({
        ...prev,
        isSpeaking: true,
        currentSubtitle: lineText,
        activeExpression: normalizedExpr,
        activeAction: actionOverride
          ? { id: actionOverride, seq: Date.now() }
          : prev.activeAction,
      }));

      if (audioMuted || character.muted || character.voiceVolume <= 0.01) {
        speakWithFallbackSynth(lineText);
        return;
      }

      try {
        const gender = MALE_CHARACTER_IDS.has(character.catalogId) ? 'male' : 'female';
        const authHeaders = await getAuthHeaders();
        const ttsRes = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: lineText,
            gender,
            language: character.voiceLanguage || 'english',
          }),
        });

        if (ttsRes.ok) {
          const audioBlob = await ttsRes.blob();
          if (audioBlob && audioBlob.size > 100) {
            setSpeechClip({
              seq: Date.now(),
              audioBlob,
              volume: Math.max(0, Math.min(1, character.voiceVolume)),
              onEnd: () => {
                isSpeakingRef.current = false;
                setCharacter((prev) => ({
                  ...prev,
                  isSpeaking: false,
                  mouthOpen: 0,
                }));
              },
            });
            return;
          }
        }
      } catch {
        // Fall through
      }

      speakWithFallbackSynth(lineText);
    },
    [
      audioMuted,
      character.activeExpression,
      character.catalogId,
      character.muted,
      character.voiceLanguage,
      character.voiceVolume,
      speakWithFallbackSynth,
    ]
  );

  // Core AI Companion Brain: Calls `POST /api/hitaishi/companion` with full Workspace & Study Space context
  const triggerAiResponse = useCallback(
    async (
      userPromptText?: string,
      audioPayload?: { base64: string; mimeType: string }
    ) => {
      if (isGeneratingTurnRef.current) return;
      if (cooldownSeconds > 0) return;

      setIsGeneratingTurn(true);
      isGeneratingTurnRef.current = true;
      setInterimTranscript('');

      if (userPromptText || audioPayload) {
        stopCurrentSpeech();
      }

      try {
        const liveWorkspaceContext = buildHitaishiWorkspaceContextPayload(workspaceScope);
        setWorkspaceSnapshot(liveWorkspaceContext);

        const authHeaders = await getAuthHeaders();
        const res = await fetch('/api/hitaishi/companion', {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userMessage: userPromptText || '',
            audioBase64: audioPayload?.base64,
            audioMimeType: audioPayload?.mimeType,
            characterName: character.name,
            persona: character.persona,
            speakingStyle: character.speakingStyle,
            voiceLanguage: character.voiceLanguage || 'english',
            workspaceContext: liveWorkspaceContext,
            history: chatHistory.slice(-12).map((m) => ({
              role: m.role,
              text: m.text,
              content: m.text,
            })),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (data?.rateLimit) {
          setRateLimitInfo(data.rateLimit);
        }

        if (res.status === 429) {
          const waitSec = Number(data?.retryAfterSeconds || data?.rateLimit?.retryAfterSec || 10);
          setCooldownSeconds(waitSec);
          const rlReply =
            data?.reply ||
            `Whoa, slow down a little! Give me ${waitSec} seconds to catch my breath!`;
          await speakLine(rlReply, 'shy', 'shy');
          return;
        }

        if (res.ok && data) {
          const replyText = String(data.reply || '').trim();
          const expr: string | null =
            data.expression === 'neutral' || data.expression === null
              ? null
              : ['smile', 'shy', 'angry', 'sad'].includes(data.expression)
                ? data.expression
                : 'smile';
          const act: 'nod' | 'shake' | 'tilt' | 'hop' | 'shy' | null = [
            'nod',
            'shake',
            'tilt',
            'hop',
            'shy',
          ].includes(data.action)
            ? data.action
            : null;
          const actualUserText = String(
            data.userTranscript || userPromptText || ''
          ).trim();

          if (actualUserText || replyText) {
            setChatHistory((prev) => {
              const next: CompanionChatTurn[] = [
                ...prev.slice(-22),
                ...(actualUserText
                  ? [{ id: `u-${Date.now()}`, role: 'user' as const, text: actualUserText }]
                  : []),
                ...(replyText
                  ? [
                      {
                        id: `a-${Date.now() + 1}`,
                        role: 'assistant' as const,
                        text: replyText,
                        expression: expr,
                        action: act,
                      },
                    ]
                  : []),
              ];
              saveHitaishiHistory(
                next.map((t) => ({
                  ...t,
                  timestamp: Date.now(),
                  characterId: character.catalogId,
                }))
              );
              return next;
            });

            if (syncToWorkspaces && actualUserText && replyText) {
              syncHitaishiTurnAcrossWorkspaces({
                characterName: character.name,
                userText: actualUserText,
                replyText,
                syncToMainChat: workspaceScope === 'all' || workspaceScope === 'chat',
                syncToStudyChat: workspaceScope === 'all' || workspaceScope === 'study',
              });
            }
          }

          if (replyText) {
            await speakLine(replyText, expr, act);
            return;
          }
        }

        const catEntry = HITAISHI_CATALOG.find((c) => c.id === character.catalogId);
        const fallbackLine =
          catEntry?.greetingLines[0] || `I'm listening—what's on your mind?`;
        await speakLine(fallbackLine, 'smile', 'nod');
      } catch {
        const catEntry = HITAISHI_CATALOG.find((c) => c.id === character.catalogId);
        const fallbackLine =
          catEntry?.greetingLines[0] || `Hey! Ask me anything anytime.`;
        await speakLine(fallbackLine, 'smile', 'tilt');
      } finally {
        setIsGeneratingTurn(false);
        isGeneratingTurnRef.current = false;
      }
    },
    [
      character.catalogId,
      character.name,
      character.persona,
      character.speakingStyle,
      character.voiceLanguage,
      chatHistory,
      cooldownSeconds,
      speakLine,
      stopCurrentSpeech,
      syncToWorkspaces,
      workspaceScope,
    ]
  );

  // Check if another workspace launched Hitaishi with an initial prompt
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('hitaishi_pending_prompt');
      if (pending && pending.trim()) {
        sessionStorage.removeItem('hitaishi_pending_prompt');
        triggerAiResponse(pending.trim());
      }
    } catch {}
  }, [triggerAiResponse]);

  const stopDuplexListening = useCallback(() => {
    setLiveDuplexActive(false);
    liveDuplexActiveRef.current = false;
    setIsListeningMic(false);
    setMicVolumeLevel(0);
    setInterimTranscript('');

    if (interimDebounceTimerRef.current) {
      window.clearTimeout(interimDebounceTimerRef.current);
      interimDebounceTimerRef.current = null;
    }
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch {}
      outputAudioCtxRef.current = null;
    }
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch {}
      liveWsRef.current = null;
    }
  }, []);

  // Multi-Engine Live Duplex Voice & Microphone Pipeline:
  // 1. Native sample-rate AudioContext + AnalyserNode (visual mic meter + VAD silence detector)
  // 2. Web Speech API SpeechRecognition (instant live interim transcripts + auto turn submission)
  // 3. MediaRecorder VAD Audio Capture (sends base64 audio to /api/hitaishi/companion when browser SpeechRecognition is unavailable)
  // 4. Gemini Live API WebSocket (/ws/live) when available
  const startDuplexListening = useCallback(async () => {
    setMicStatusError(null);
    stopCurrentSpeech();
    geminiLiveAudioReceivedRef.current = false;

    const startBrowserSpeechRecognition = () => {
      if (typeof window === 'undefined') return false;
      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) return false;

      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = LANGUAGE_TO_BCP47[voiceLanguageRef.current] || 'en-US';

        rec.onresult = (event: any) => {
          if (!liveDuplexActiveRef.current) return;
          let interimText = '';
          let finalText = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPiece = String(event.results[i][0]?.transcript || '');
            if (event.results[i].isFinal) {
              finalText += transcriptPiece + ' ';
            } else {
              interimText += transcriptPiece;
            }
          }

          if (interimText.trim()) {
            lastRecognitionResultAtRef.current = Date.now();
            setInterimTranscript(interimText.trim());
            if (isSpeakingRef.current) {
              stopCurrentSpeech();
            }
            if (interimDebounceTimerRef.current) {
              window.clearTimeout(interimDebounceTimerRef.current);
            }
            const capturedInterim = interimText.trim();
            interimDebounceTimerRef.current = window.setTimeout(() => {
              if (
                liveDuplexActiveRef.current &&
                !isGeneratingTurnRef.current &&
                !geminiLiveAudioReceivedRef.current &&
                capturedInterim.length >= 2
              ) {
                setInterimTranscript('');
                triggerAiResponse(capturedInterim);
              }
            }, 1350);
          }

          if (finalText.trim()) {
            if (interimDebounceTimerRef.current) {
              window.clearTimeout(interimDebounceTimerRef.current);
              interimDebounceTimerRef.current = null;
            }
            lastRecognitionResultAtRef.current = Date.now();
            const cleanFinal = finalText.trim();
            setInterimTranscript('');
            if (!geminiLiveAudioReceivedRef.current && !isGeneratingTurnRef.current) {
              triggerAiResponse(cleanFinal);
            }
          }
        };

        rec.onerror = (ev: any) => {
          if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
            setMicStatusError('Microphone permission denied by browser.');
          }
        };

        rec.onend = () => {
          if (liveDuplexActiveRef.current && recognitionRef.current === rec) {
            setTimeout(() => {
              if (liveDuplexActiveRef.current && recognitionRef.current === rec) {
                try {
                  rec.lang = LANGUAGE_TO_BCP47[voiceLanguageRef.current] || 'en-US';
                  rec.start();
                } catch {}
              }
            }, 250);
          }
        };

        rec.start();
        recognitionRef.current = rec;
        return true;
      } catch {
        return false;
      }
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const startedRec = startBrowserSpeechRecognition();
        if (startedRec) {
          setIsListeningMic(true);
          return;
        }
        throw new Error('Microphone API is not available in this browser context.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;
      setIsListeningMic(true);

      // Start Browser SpeechRecognition in parallel for instant live captions & turn detection
      startBrowserSpeechRecognition();

      // Use NATIVE sample rate on inputCtx so createMediaStreamSource NEVER throws a sample-rate mismatch DOMException!
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx: AudioContext = new AudioCtx();
      if (inputCtx.state === 'suspended') {
        try {
          await inputCtx.resume();
        } catch {}
      }
      inputAudioCtxRef.current = inputCtx;

      const outputCtx: AudioContext = new AudioCtx();
      if (outputCtx.state === 'suspended') {
        try {
          await outputCtx.resume();
        } catch {}
      }
      outputAudioCtxRef.current = outputCtx;
      nextPlayTimeRef.current = 0;

      const source = inputCtx.createMediaStreamSource(stream);
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);

      // Start MediaRecorder for VAD audio fallback (works on Firefox, mobile WebViews, and all languages)
      const setupSegmentRecorder = () => {
        if (!liveDuplexActiveRef.current || !micStreamRef.current) return;
        try {
          const mimeType =
            typeof MediaRecorder !== 'undefined' &&
            MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : typeof MediaRecorder !== 'undefined' &&
                  MediaRecorder.isTypeSupported?.('audio/mp4')
                ? 'audio/mp4'
                : '';
          const recorder = mimeType
            ? new MediaRecorder(micStreamRef.current, { mimeType })
            : new MediaRecorder(micStreamRef.current);
          recordedChunksRef.current = [];
          vadHasSpokenRef.current = false;
          vadSilenceStartRef.current = 0;
          vadSpeechStartRef.current = 0;

          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              recordedChunksRef.current.push(ev.data);
            }
          };

          recorder.onstop = () => {
            const chunks = recordedChunksRef.current;
            recordedChunksRef.current = [];
            const hadSpeech = vadHasSpokenRef.current;
            vadHasSpokenRef.current = false;

            const recentSpeechRecHandled =
              Date.now() - lastRecognitionResultAtRef.current < 2600;

            if (
              hadSpeech &&
              chunks.length > 0 &&
              !recentSpeechRecHandled &&
              !geminiLiveAudioReceivedRef.current &&
              !isGeneratingTurnRef.current &&
              liveDuplexActiveRef.current
            ) {
              const blob = new Blob(chunks, {
                type: recorder.mimeType || 'audio/webm',
              });
              if (blob.size > 800) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64Str = String(reader.result || '');
                  if (base64Str && liveDuplexActiveRef.current && !isGeneratingTurnRef.current) {
                    triggerAiResponse('', {
                      base64: base64Str,
                      mimeType: blob.type || 'audio/webm',
                    });
                  }
                };
                reader.readAsDataURL(blob);
              }
            }

            if (liveDuplexActiveRef.current && micStreamRef.current) {
              setupSegmentRecorder();
            }
          };

          recorder.start(250);
          mediaRecorderRef.current = recorder;
        } catch {
          // MediaRecorder optional if SpeechRecognition is active
        }
      };

      setupSegmentRecorder();

      // Real-time microphone RMS volume loop + VAD turn trigger
      const timeDomainBuf = new Float32Array(analyser.fftSize);
      const pollMicLevel = () => {
        if (!liveDuplexActiveRef.current) return;
        analyser.getFloatTimeDomainData(timeDomainBuf);
        let sumSq = 0;
        for (let i = 0; i < timeDomainBuf.length; i++) {
          sumSq += timeDomainBuf[i] * timeDomainBuf[i];
        }
        const rms = Math.sqrt(sumSq / timeDomainBuf.length);
        const normalizedLevel = Math.min(1, rms * 6.5);
        setMicVolumeLevel(normalizedLevel);

        const now = performance.now();
        // Voice Activity Detection threshold
        if (rms > 0.022 && !isSpeakingRef.current && !isGeneratingTurnRef.current) {
          if (!vadHasSpokenRef.current) {
            vadHasSpokenRef.current = true;
            vadSpeechStartRef.current = now;
          }
          vadSilenceStartRef.current = 0;
        } else if (vadHasSpokenRef.current) {
          if (vadSilenceStartRef.current === 0) {
            vadSilenceStartRef.current = now;
          } else if (
            now - vadSilenceStartRef.current > 1150 &&
            now - vadSpeechStartRef.current > 450
          ) {
            // User finished speaking a phrase -> stop segment recorder to flush audio if SpeechRecognition didn't fire
            vadSilenceStartRef.current = 0;
            if (
              mediaRecorderRef.current &&
              mediaRecorderRef.current.state === 'recording'
            ) {
              try {
                mediaRecorderRef.current.stop();
              } catch {}
            }
          }
        }

        micRafRef.current = requestAnimationFrame(pollMicLevel);
      };
      micRafRef.current = requestAnimationFrame(pollMicLevel);

      // Connect to Gemini Live WebSocket (/ws/live) in parallel with workspace context
      try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const gender = MALE_CHARACTER_IDS.has(character.catalogId) ? 'male' : 'female';
        const studyTitle = workspaceSnapshot.activeStudySpace?.title || '';
        const chatTitle = workspaceSnapshot.activeChatThread?.title || '';
        const wsSummary = [
          studyTitle ? `Study Space: ${studyTitle}` : '',
          chatTitle ? `Chat: ${chatTitle}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const params = new URLSearchParams({
          charName: character.name,
          persona: character.persona.slice(0, 240),
          language: character.voiceLanguage || 'english',
          gender,
          workspaceSummary: wsSummary,
        });
        const wsUrl = `${proto}//${location.host}/ws/live?${params.toString()}`;
        const ws = new WebSocket(wsUrl);
        liveWsRef.current = ws;

        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!liveWsRef.current || liveWsRef.current.readyState !== WebSocket.OPEN) return;
          const channelData = e.inputBuffer.getChannelData(0);
          const int16 = downsampleFloat32To16kInt16(channelData, inputCtx.sampleRate);
          const uint8 = new Uint8Array(int16.buffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64 = btoa(binary);
          liveWsRef.current.send(JSON.stringify({ audio: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.error && msg.retryAfterSec) {
              setCooldownSeconds(Number(msg.retryAfterSec) || 10);
              return;
            }
            if (msg.interrupted) {
              nextPlayTimeRef.current = 0;
              stopCurrentSpeech();
              return;
            }
            if (msg.userTranscript) {
              setInterimTranscript(String(msg.userTranscript));
            }
            if (msg.modelTranscript) {
              const text = String(msg.modelTranscript).trim();
              if (text) {
                setCharacter((prev) => ({
                  ...prev,
                  currentSubtitle: text,
                }));
              }
            }
            if (msg.audio) {
              geminiLiveAudioReceivedRef.current = true;
              isSpeakingRef.current = true;
              const binary = atob(msg.audio);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const int16 = new Int16Array(bytes.buffer);
              const float32 = new Float32Array(int16.length);
              let sumAmp = 0;
              for (let i = 0; i < int16.length; i++) {
                const sample = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
                float32[i] = sample;
                sumAmp += Math.abs(sample);
              }
              const avgMouth = Math.min(1, Math.max(0.2, (sumAmp / Math.max(1, int16.length)) * 4.2));
              setCharacter((prev) => ({
                ...prev,
                isSpeaking: true,
                mouthOpen: avgMouth,
              }));

              const audioBuf = outputCtx.createBuffer(1, float32.length, 24000);
              audioBuf.copyToChannel(float32, 0);

              const src = outputCtx.createBufferSource();
              src.buffer = audioBuf;
              src.connect(outputCtx.destination);

              const now = outputCtx.currentTime;
              const startTime = Math.max(now, nextPlayTimeRef.current);
              src.start(startTime);
              nextPlayTimeRef.current = startTime + audioBuf.duration;

              src.onended = () => {
                if (outputCtx.currentTime >= nextPlayTimeRef.current - 0.05) {
                  isSpeakingRef.current = false;
                  setCharacter((prev) => ({
                    ...prev,
                    isSpeaking: false,
                    mouthOpen: 0,
                  }));
                }
              };
            }
          } catch {}
        };

        // Never kill SpeechRecognition / MediaRecorder VAD if /ws/live closes on static hosts
        ws.onerror = () => {
          geminiLiveAudioReceivedRef.current = false;
        };
        ws.onclose = () => {
          geminiLiveAudioReceivedRef.current = false;
        };
      } catch {
        geminiLiveAudioReceivedRef.current = false;
      }
    } catch (err: any) {
      console.warn('[Hitaishi Mic] Microphone error:', err);
      setMicStatusError(
        err?.message || 'Microphone access blocked. Please allow microphone permission in your browser.'
      );
      setLiveDuplexActive(false);
      liveDuplexActiveRef.current = false;
      setIsListeningMic(false);
    }
  }, [
    character.catalogId,
    character.name,
    character.persona,
    character.voiceLanguage,
    stopCurrentSpeech,
    triggerAiResponse,
    workspaceSnapshot.activeChatThread?.title,
    workspaceSnapshot.activeStudySpace?.title,
  ]);

  const handleToggleLiveDuplex = useCallback(() => {
    if (liveDuplexActive) {
      const pendingText = interimTranscript.trim();
      stopDuplexListening();
      if (pendingText) {
        triggerAiResponse(pendingText);
      }
    } else {
      setLiveDuplexActive(true);
      liveDuplexActiveRef.current = true;
      startDuplexListening();
    }
  }, [interimTranscript, liveDuplexActive, startDuplexListening, stopDuplexListening, triggerAiResponse]);

  // Switch active character
  const handleSelectCatalogCharacter = useCallback(
    (cat: HitaishiCatalogCharacter) => {
      stopCurrentSpeech();
      const nextChar = createStageCharacterFromCatalog(cat, 0.5, 1, 0);
      nextChar.activeExpression = null;
      nextChar.currentSubtitle =
        cat.greetingLines[0] || `Hi, I'm ${cat.name}. Ask me anything!`;
      setCharacter(nextChar);
      setCharDropdownOpen(false);
      try {
        localStorage.setItem('hitaishi_active_char_id', cat.id);
        window.dispatchEvent(new Event('hitaishi-char-changed'));
      } catch {
        // ignore
      }
    },
    [stopCurrentSpeech]
  );

  useEffect(() => {
    return () => {
      stopCurrentSpeech();
      stopDuplexListening();
    };
  }, [stopCurrentSpeech, stopDuplexListening]);

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key.toLowerCase();
      if (key === '1') updateCharacter({ activeExpression: 'smile' });
      else if (key === '2') updateCharacter({ activeExpression: 'shy' });
      else if (key === '3') updateCharacter({ activeExpression: 'angry' });
      else if (key === '4') updateCharacter({ activeExpression: 'sad' });
      else if (key === '0') updateCharacter({ activeExpression: null });
      else if (key === 'q')
        updateCharacter({ activeAction: { id: 'nod', seq: Date.now() } });
      else if (key === 'w')
        updateCharacter({ activeAction: { id: 'shake', seq: Date.now() } });
      else if (key === 'e')
        updateCharacter({ activeAction: { id: 'tilt', seq: Date.now() } });
      else if (key === 'r')
        updateCharacter({ activeAction: { id: 'hop', seq: Date.now() } });
      else if (key === 't')
        updateCharacter({
          activeExpression: 'shy',
          activeAction: { id: 'shy', seq: Date.now() },
        });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateCharacter]);

  // Custom model import
  const handleCustomAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const lower = file.name.toLowerCase();
    const baseName = file.name.replace(/\.[^.]+$/, '');

    const customMap = new Map<string, Blob>();
    customMap.set(file.name, file);

    let format: HitaishiStageCharacter['format'] = 'livliv';
    if (lower.endsWith('.vrm')) format = 'vrm';
    else if (lower.endsWith('.png') || lower.endsWith('.webp')) format = 'png';

    const blobUrl = URL.createObjectURL(file);
    const customCat: HitaishiCatalogCharacter = {
      id: `custom-${Date.now()}`,
      name: baseName.slice(0, 18) || 'Custom Avatar',
      tagline: `Imported ${format.toUpperCase()}`,
      category: format === 'vrm' ? '3d-studio' : '2.5d-half',
      format,
      fullBody: format === 'vrm',
      avatarUrl:
        format === 'png' ? blobUrl : '/hitaishi-assets/characters/n01/avatar.webp',
      modelUrl: blobUrl,
      accentColor: '#6366F1',
      voicePitch: 1.05,
      voiceRate: 1.0,
      persona: `${baseName} is a custom ${format.toUpperCase()} AI companion.`,
      style: 'Friendly, expressive, interactive.',
      greetingLines: [`Custom ${format.toUpperCase()} avatar loaded!`],
    };

    const stageChar = createStageCharacterFromCatalog(customCat, 0.5, 1, 0);
    stageChar.activeExpression = null;
    if (format !== 'png') stageChar.customFiles = customMap;

    setCharacter(stageChar);
    setCharDropdownOpen(false);
    setSettingsOpen(false);
    e.target.value = '';
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setChatInput('');
    triggerAiResponse(trimmed);
  };

  const handleChangeWorkspaceScope = (nextScope: HitaishiWorkspaceScope) => {
    setWorkspaceScope(nextScope);
    setSavedHitaishiScope(nextScope);
    setWorkspaceSnapshot(buildHitaishiWorkspaceContextPayload(nextScope));
  };

  const filteredCatalog = useMemo(() => {
    if (selectorCategory === 'all') return HITAISHI_CATALOG;
    return HITAISHI_CATALOG.filter((c) => c.category === selectorCategory);
  }, [selectorCategory]);

  const activeCatalogMeta = useMemo(
    () => HITAISHI_CATALOG.find((c) => c.id === character.catalogId),
    [character.catalogId]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07060A] text-white select-none overflow-hidden font-sans">
      {/* Hidden custom model uploader */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vrm,.png,.webp,.json,.livliv"
        onChange={handleCustomAvatarFileUpload}
        className="hidden"
      />

      {/* ================= FULL-BLEED 9:16 PREMIUM COMPANION STAGE ================= */}
      <div
        className="relative w-full h-full sm:max-w-[490px] sm:aspect-[9/16] sm:max-h-[96dvh] sm:rounded-[36px] sm:border sm:border-white/12 sm:shadow-[0_30px_100px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col"
        style={{
          background:
            activeBackground.type === 'solid' ||
            activeBackground.type === 'gradient' ||
            activeBackground.type === 'greenscreen'
              ? activeBackground.value
              : activeBackground.id === 'cozy-twilight'
                ? 'radial-gradient(circle at 50% 26%, #291D3F 0%, #151122 58%, #09080F 100%)'
                : activeBackground.type === 'transparent'
                  ? 'repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 24px 24px'
                  : 'linear-gradient(180deg, #1E1533 0%, #2A1C44 55%, #120E1E 100%)',
        }}
      >
        {/* Ambient Room Atmosphere */}
        {(activeBackground.id === 'cozy-twilight' ||
          activeBackground.id === 'cozy-night-room') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full blur-[110px] opacity-25 transition-colors duration-700"
              style={{
                background: activeCatalogMeta?.accentColor || '#8B5CF6',
              }}
            />
            <div className="absolute right-[12%] top-[42%] w-28 h-28 rounded-full bg-amber-300/15 blur-3xl" />
            <div className="absolute left-[14%] top-[30%] w-24 h-24 rounded-full bg-purple-400/15 blur-3xl" />
          </div>
        )}

        {/* ================= PREMIUM FLOATING TOP HEADER ================= */}
        <header className="relative z-30 h-16 px-5 pt-3 flex items-center justify-between shrink-0">
          {/* Left: Back + Settings Gear */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/18 backdrop-blur-2xl border border-white/15 text-white flex items-center justify-center transition-all shadow-sm cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCharDropdownOpen(false);
                setSettingsOpen(true);
              }}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/18 backdrop-blur-2xl border border-white/15 text-white flex items-center justify-center transition-all shadow-sm cursor-pointer"
              title="Companion & Workspace Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Minimal Elegant Brand */}
          <span
            className={`text-[18px] font-bold tracking-wider font-['Outfit'] ${
              isLightBackground
                ? 'text-zinc-900'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-white via-white/95 to-white/70'
            }`}
          >
            hitaishi
          </span>

          {/* Right: Mute + Circular Avatar Selector Dropdown Trigger */}
          <div className="flex items-center gap-2.5 relative">
            <button
              type="button"
              onClick={() => {
                const nextMuted = !audioMuted;
                setAudioMuted(nextMuted);
                if (nextMuted) stopCurrentSpeech();
              }}
              className={`w-10 h-10 rounded-full backdrop-blur-2xl border flex items-center justify-center transition-all shadow-sm cursor-pointer ${
                audioMuted
                  ? 'bg-rose-500/85 border-rose-300/50 text-white'
                  : 'bg-white/10 hover:bg-white/18 border-white/15 text-white/90'
              }`}
              title={audioMuted ? 'Unmute Voice' : 'Mute Voice'}
            >
              {audioMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setCharDropdownOpen((o) => !o)}
              className="relative w-10 h-10 rounded-full ring-2 ring-white/30 hover:ring-white/75 overflow-hidden bg-zinc-900 shadow-md transition-all cursor-pointer"
              title={`Switch Companion (${character.name})`}
            >
              <img
                src={character.avatarUrl}
                alt={character.name}
                className="w-full h-full object-cover"
              />
            </button>

            {/* ================= PREMIUM CHARACTER SELECTOR DROPDOWN ================= */}
            <AnimatePresence>
              {charDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCharDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                    className="absolute right-0 top-12 z-50 w-76 sm:w-84 max-h-[70dvh] rounded-3xl bg-zinc-950/95 backdrop-blur-3xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden text-white"
                  >
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wide text-white/80">
                        Select Companion
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-300 hover:text-sky-200 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Import</span>
                      </button>
                    </div>

                    <div className="p-2.5 pb-1">
                      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/6 border border-white/10">
                        {(
                          [
                            { id: 'all', label: 'All' },
                            { id: '2.5d-half', label: 'Upper' },
                            { id: '2.5d-full', label: 'Full' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSelectorCategory(tab.id)}
                            className={`py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                              selectorCategory === tab.id
                                ? 'bg-white text-zinc-950 font-semibold shadow-xs'
                                : 'text-white/70 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 overflow-y-auto grid grid-cols-3 gap-2.5">
                      {filteredCatalog.map((item) => {
                        const selected = character.catalogId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectCatalogCharacter(item)}
                            className={`group flex flex-col items-center p-2 rounded-2xl border transition-all cursor-pointer ${
                              selected
                                ? 'bg-white/15 border-white/50 shadow-md ring-1 ring-white/40'
                                : 'bg-white/5 border-white/8 hover:bg-white/10'
                            }`}
                          >
                            <div className="relative w-14 h-14 rounded-full overflow-hidden mb-1.5 border border-white/15 shadow-inner">
                              <img
                                src={item.avatarUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              {selected && (
                                <span className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white" />
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-white truncate max-w-full">
                              {item.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* ================= FIXED FULL-BLEED CHARACTER CANVAS ================= */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          onClick={() => setCharDropdownOpen(false)}
        >
          <HitaishiAvatarCanvas
            character={character}
            speechClip={speechClip}
          />
        </div>

        {/* ================= ELEGANT BOTTOM GRADIENT SCRIM ================= */}
        <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none z-20" />

        {/* ================= BOTTOM SUBTITLES & PREMIUM GLASS INPUT BAR ================= */}
        <div className="mt-auto relative z-30 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-2 flex flex-col gap-3.5">
          {/* Rate-Limit Cooldown or Mic Notice */}
          {(cooldownSeconds > 0 || micStatusError) && (
            <div className="mx-auto px-3.5 py-1.5 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/15 text-xs text-amber-200 flex items-center gap-2 shadow-lg">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {cooldownSeconds > 0
                  ? `Rate limit cooldown: ${cooldownSeconds}s remaining`
                  : micStatusError}
              </span>
              {micStatusError && (
                <button
                  type="button"
                  onClick={() => setMicStatusError(null)}
                  className="text-white/60 hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Bottom Subtitle Text */}
          <AnimatePresence mode="wait">
            {captionsEnabled &&
              (interimTranscript ||
                isGeneratingTurn ||
                character.currentSubtitle ||
                liveDuplexActive) && (
                <motion.div
                  key={
                    interimTranscript
                      ? 'interim'
                      : isGeneratingTurn
                        ? 'thinking'
                        : character.currentSubtitle
                  }
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="px-2 text-center pointer-events-none"
                >
                  {interimTranscript ? (
                    <p className="text-sm sm:text-[15px] font-medium text-emerald-300 italic leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
                      “{interimTranscript}...”
                    </p>
                  ) : isGeneratingTurn ? (
                    <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-sky-300" />
                      <span>{character.name} is thinking...</span>
                    </div>
                  ) : (
                    <p className="text-[15px] sm:text-base font-medium text-white leading-snug tracking-[0.01em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] max-w-[95%] mx-auto">
                      {character.currentSubtitle}
                    </p>
                  )}
                </motion.div>
              )}
          </AnimatePresence>

          {/* Premium Glassmorphic Bottom Prompt Input Bar (Video Icon Removed, Clean Input + Live Mic) */}
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2.5 w-full"
          >
            <div className="flex-1 h-13 rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 focus-within:border-white/45 focus-within:bg-white/15 pl-5 pr-2 flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={cooldownSeconds > 0}
                placeholder={
                  cooldownSeconds > 0
                    ? `Rate limit cooldown (${cooldownSeconds}s)...`
                    : liveDuplexActive
                      ? isListeningMic
                        ? `Listening to you... Speak or type`
                        : `Starting microphone...`
                      : `Type to ${character.name}...`
                }
                className="flex-1 bg-transparent text-sm font-medium text-white placeholder:text-white/50 focus:outline-none min-w-0"
              />

              {chatInput.trim() ? (
                <button
                  type="submit"
                  disabled={isGeneratingTurn || cooldownSeconds > 0}
                  className="w-9 h-9 rounded-full bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-950 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shrink-0 shadow-sm"
                  title="Send"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              ) : character.isSpeaking ? (
                <button
                  type="button"
                  onClick={stopCurrentSpeech}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Stop speaking"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : null}
            </div>

            {/* Circular Glass Live Duplex Microphone Button */}
            <button
              type="button"
              onClick={handleToggleLiveDuplex}
              style={
                liveDuplexActive
                  ? {
                      boxShadow: `0 0 ${14 + Math.round(micVolumeLevel * 28)}px rgba(16, 185, 129, ${
                        0.45 + micVolumeLevel * 0.45
                      })`,
                    }
                  : undefined
              }
              className={`relative w-13 h-13 rounded-full backdrop-blur-3xl border flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-[0_10px_32px_rgba(0,0,0,0.45)] ${
                liveDuplexActive
                  ? 'bg-emerald-500/90 border-emerald-300/80 text-white ring-4 ring-emerald-400/30'
                  : 'bg-white/10 hover:bg-white/18 border-white/20 text-white/90'
              }`}
              title={
                liveDuplexActive
                  ? 'Tap to finish speaking or stop Live Mic'
                  : 'Start Live Voice Conversation'
              }
              aria-label={
                liveDuplexActive ? 'Stop Live Microphone' : 'Start Live Microphone'
              }
            >
              {liveDuplexActive ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>

        {/* ================= PREMIUM REFINED SETTINGS & WORKSPACE DRAWER ================= */}
        <AnimatePresence>
          {settingsOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSettingsOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                className="fixed inset-y-0 left-0 z-50 w-[340px] max-w-[92vw] bg-[#0c0c0e]/96 backdrop-blur-2xl border-r border-white/[0.1] text-white flex flex-col overflow-hidden shadow-[24px_0_64px_rgba(0,0,0,0.75)]"
              >
                {/* Drawer Header */}
                <div className="px-5 pt-4 pb-3 border-b border-white/[0.08] space-y-3.5 shrink-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={character.avatarUrl}
                        alt={character.name}
                        className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold tracking-tight truncate">
                          {character.name}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">
                          Companion &amp; Workspaces
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(false)}
                      aria-label="Close drawer"
                      className="size-8 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white inline-flex items-center justify-center cursor-pointer transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Primary 3-Tab Segmented Navigation */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.07]">
                    {(
                      [
                        { id: 'workspaces', label: 'Workspaces' },
                        { id: 'voice', label: 'Voice' },
                        { id: 'stage', label: 'Stage' },
                      ] as const
                    ).map((tab) => {
                      const active = drawerSection === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDrawerSection(tab.id)}
                          className={`min-h-[34px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-white text-zinc-950 font-semibold'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* ================= TAB 1: WORKSPACES ================= */}
                  {drawerSection === 'workspaces' && (
                    <div className="space-y-5">
                      {/* Interactive Scope Filter */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-zinc-400">
                            Active Context
                          </span>
                          <span className="text-[11px] text-zinc-500 tabular-nums">
                            {syncToWorkspaces ? 'Synced' : 'Read-only'}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                          {(
                            [
                              { id: 'all', label: 'All' },
                              { id: 'study', label: 'Study' },
                              { id: 'chat', label: 'Chats' },
                              { id: 'sidechat', label: 'Tasks' },
                            ] as const
                          ).map((sc) => (
                            <button
                              key={sc.id}
                              type="button"
                              onClick={() => handleChangeWorkspaceScope(sc.id)}
                              className={`min-h-[32px] rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                workspaceScope === sc.id
                                  ? 'bg-white text-zinc-950 font-semibold'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              {sc.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Scope-Specific Live Workspace Content */}
                      {workspaceScope === 'all' && (
                        <div className="space-y-3">
                          <div className="divide-y divide-white/[0.07] rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                            <div className="px-3.5 py-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <BookOpen className="w-4 h-4 text-zinc-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-[11px] text-zinc-500">Study Space</div>
                                  <div className="text-xs font-medium text-white truncate">
                                    {workspaceSnapshot.activeStudySpace?.title || 'No active study space'}
                                  </div>
                                </div>
                              </div>
                              {onOpenStudySpace && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettingsOpen(false);
                                    onOpenStudySpace();
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-300 hover:text-white shrink-0 cursor-pointer"
                                >
                                  <span>Open</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className="px-3.5 py-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <MessageSquare className="w-4 h-4 text-zinc-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-[11px] text-zinc-500">Chat Threads</div>
                                  <div className="text-xs font-medium text-white truncate tabular-nums">
                                    {workspaceSnapshot.activeChatThread?.title ||
                                      (workspaceSnapshot.recentThreads.length > 0
                                        ? `${workspaceSnapshot.recentThreads.length} recent ${
                                            workspaceSnapshot.recentThreads.length === 1 ? 'thread' : 'threads'
                                          }`
                                        : 'No saved threads')}
                                  </div>
                                </div>
                              </div>
                              {workspaceSnapshot.recentThreads.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleChangeWorkspaceScope('chat')}
                                  className="text-[11px] font-medium text-zinc-400 hover:text-white shrink-0 cursor-pointer"
                                >
                                  View
                                </button>
                              )}
                            </div>

                            <div className="px-3.5 py-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Layers className="w-4 h-4 text-zinc-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-[11px] text-zinc-500">SideChat Tasks</div>
                                  <div className="text-xs font-medium text-white truncate tabular-nums">
                                    {workspaceSnapshot.sideChatTasks.length > 0
                                      ? `${workspaceSnapshot.sideChatTasks.length} ${
                                          workspaceSnapshot.sideChatTasks.length === 1 ? 'task' : 'tasks'
                                        }`
                                      : 'No active tasks'}
                                  </div>
                                </div>
                              </div>
                              {onOpenSideChat && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettingsOpen(false);
                                    onOpenSideChat();
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-300 hover:text-white shrink-0 cursor-pointer"
                                >
                                  <span>Open</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {[
                              {
                                label: 'Quiz Study Space',
                                prompt:
                                  'Quiz me on one key question or flashcard from my active Study Space right now.',
                              },
                              {
                                label: 'Summarize Notes',
                                prompt:
                                  'Give me a concise spoken summary of what I am studying in my active Study Space.',
                              },
                              {
                                label: 'Recap Main Chat',
                                prompt:
                                  'Summarize what we have been discussing in my active Main Chat thread.',
                              },
                              {
                                label: 'Check Tasks',
                                prompt:
                                  'Give me a brief status update on my parallel tasks in SideChat.',
                              },
                            ].map((action) => (
                              <button
                                key={action.label}
                                type="button"
                                onClick={() => {
                                  setSettingsOpen(false);
                                  triggerAiResponse(action.prompt);
                                }}
                                className="min-h-[38px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] font-medium text-zinc-200 text-left transition-colors cursor-pointer"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {workspaceScope === 'study' && (
                        <div className="space-y-3">
                          {workspaceSnapshot.activeStudySpace ? (
                            <>
                              <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3.5 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-white truncate">
                                      {workspaceSnapshot.activeStudySpace.title}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 capitalize mt-0.5">
                                      {workspaceSnapshot.activeStudySpace.sourceType} workspace
                                    </div>
                                  </div>
                                  {onOpenStudySpace && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSettingsOpen(false);
                                        onOpenStudySpace();
                                      }}
                                      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-300 hover:text-white shrink-0 cursor-pointer"
                                    >
                                      <span>Open</span>
                                      <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.07] text-[11px] tabular-nums">
                                  <div>
                                    <div className="text-zinc-500">Cards</div>
                                    <div className="font-semibold text-white">
                                      {workspaceSnapshot.activeStudySpace.flashcards.length}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-zinc-500">Quiz</div>
                                    <div className="font-semibold text-white">
                                      {workspaceSnapshot.activeStudySpace.quizQuestions.length}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-zinc-500">Notes</div>
                                    <div className="font-semibold text-white">
                                      {workspaceSnapshot.activeStudySpace.userNotes.trim() ? 'Active' : 'Empty'}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettingsOpen(false);
                                    triggerAiResponse(
                                      `Quiz me verbally on "${workspaceSnapshot.activeStudySpace?.title}". Ask one sharp question at a time.`
                                    );
                                  }}
                                  className="min-h-[38px] px-3 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-[11px] font-semibold transition-colors cursor-pointer"
                                >
                                  Start Verbal Quiz
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettingsOpen(false);
                                    triggerAiResponse(
                                      `Summarize the key takeaways and notes from my Study Space "${workspaceSnapshot.activeStudySpace?.title}".`
                                    );
                                  }}
                                  className="min-h-[38px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] font-medium text-zinc-200 transition-colors cursor-pointer"
                                >
                                  Summarize Notes
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-2.5">
                              <div className="text-xs font-medium text-white">
                                No Study Space opened yet
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Open a lesson, PDF, or topic in Study Space and it will appear here for live voice review and quizzes.
                              </p>
                              {onOpenStudySpace && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettingsOpen(false);
                                    onOpenStudySpace();
                                  }}
                                  className="min-h-[36px] px-3.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>Open Study Space</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {workspaceScope === 'chat' && (
                        <div className="space-y-2.5">
                          {workspaceSnapshot.recentThreads.length > 0 ? (
                            <div className="divide-y divide-white/[0.07] rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                              {workspaceSnapshot.recentThreads.slice(0, 5).map((thread) => (
                                <button
                                  key={thread.id}
                                  type="button"
                                  onClick={() => {
                                    setSettingsOpen(false);
                                    triggerAiResponse(
                                      `Recap and continue discussing my chat thread titled "${thread.title}".`
                                    );
                                  }}
                                  className="w-full px-3.5 py-2.5 text-left hover:bg-white/[0.05] transition-colors cursor-pointer"
                                >
                                  <div className="text-xs font-medium text-white truncate">
                                    {thread.title}
                                  </div>
                                  {thread.lastMessagePreview && (
                                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                      {thread.lastMessagePreview}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-1.5">
                              <div className="text-xs font-medium text-white">
                                No recent chat threads
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Conversations from Main Chat automatically sync here once you start chatting.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {workspaceScope === 'sidechat' && (
                        <div className="space-y-3">
                          {workspaceSnapshot.sideChatTasks.length > 0 ? (
                            <div className="divide-y divide-white/[0.07] rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                              {workspaceSnapshot.sideChatTasks.slice(0, 5).map((task) => (
                                <button
                                  key={task.id}
                                  type="button"
                                  onClick={() => {
                                    setSettingsOpen(false);
                                    triggerAiResponse(
                                      `Give me a concise spoken briefing on my SideChat task "${task.title}".`
                                    );
                                  }}
                                  className="w-full px-3.5 py-2.5 text-left hover:bg-white/[0.05] transition-colors cursor-pointer flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-white truncate">
                                      {task.title}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 capitalize">
                                      {task.status}
                                    </div>
                                  </div>
                                  <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-2.5">
                              <div className="text-xs font-medium text-white">
                                No parallel tasks active
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Run parallel research or background prompts in SideChat to monitor and discuss them here.
                              </p>
                              {onOpenSideChat && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettingsOpen(false);
                                    onOpenSideChat();
                                  }}
                                  className="min-h-[36px] px-3.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>Open SideChat</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sync Toggle Switch */}
                      <div className="pt-4 border-t border-white/[0.08]">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={syncToWorkspaces}
                          onClick={() => setSyncToWorkspaces((v) => !v)}
                          className="w-full flex items-center justify-between gap-3 py-1 cursor-pointer"
                        >
                          <div className="text-left">
                            <div className="text-xs font-medium text-white">
                              Sync to Study &amp; Chat
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              Mirror companion replies across workspaces
                            </div>
                          </div>
                          <span
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                              syncToWorkspaces ? 'bg-white' : 'bg-white/15'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                                syncToWorkspaces
                                  ? 'translate-x-[18px] bg-zinc-950'
                                  : 'translate-x-1 bg-white/75'
                              }`}
                            />
                          </span>
                        </button>
                      </div>

                      {/* Quiet Monochrome Plan Usage Line */}
                      <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-400 tabular-nums">
                        <span className="capitalize font-medium text-zinc-300">
                          {rateLimitInfo.plan} plan
                        </span>
                        <span>
                          {rateLimitInfo.plan === 'fire' || rateLimitInfo.dailyLimit >= 999999
                            ? 'Unlimited daily · '
                            : `${rateLimitInfo.dailyRemaining} / ${rateLimitInfo.dailyLimit} today · `}
                          {rateLimitInfo.remainingPerMinute}/{rateLimitInfo.limitPerMinute} rpm
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ================= TAB 2: VOICE & LANGUAGE ================= */}
                  {drawerSection === 'voice' && (
                    <div className="space-y-5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={captionsEnabled}
                        onClick={() => setCaptionsEnabled((v) => !v)}
                        className="w-full flex items-center justify-between gap-3 py-1 cursor-pointer"
                      >
                        <div className="text-left">
                          <div className="text-xs font-medium text-white">
                            Bottom Captions
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            Display live subtitles below companion
                          </div>
                        </div>
                        <span
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            captionsEnabled ? 'bg-white' : 'bg-white/15'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                              captionsEnabled
                                ? 'translate-x-[18px] bg-zinc-950'
                                : 'translate-x-1 bg-white/75'
                            }`}
                          />
                        </span>
                      </button>

                      <div className="space-y-2 pt-3 border-t border-white/[0.08]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300 font-medium">Voice Volume</span>
                          <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                            {Math.round(character.voiceVolume * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          aria-label="Voice Volume"
                          value={character.voiceVolume}
                          onChange={(e) =>
                            updateCharacter({ voiceVolume: parseFloat(e.target.value) })
                          }
                          className="w-full h-1.5 rounded-full accent-white bg-white/12 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300 font-medium">Voice Speed</span>
                          <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                            {character.voiceSpeed.toFixed(1)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.7"
                          max="1.4"
                          step="0.1"
                          aria-label="Voice Speed"
                          value={character.voiceSpeed}
                          onChange={(e) =>
                            updateCharacter({ voiceSpeed: parseFloat(e.target.value) })
                          }
                          className="w-full h-1.5 rounded-full accent-white bg-white/12 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-2 pt-3 border-t border-white/[0.08]">
                        <label
                          htmlFor="hitaishi-voice-lang"
                          className="block text-xs font-medium text-zinc-300"
                        >
                          Voice &amp; Subtitle Language
                        </label>
                        <div className="relative">
                          <select
                            id="hitaishi-voice-lang"
                            value={character.voiceLanguage || 'english'}
                            onChange={(e) => updateCharacter({ voiceLanguage: e.target.value })}
                            className="w-full h-10 pl-3.5 pr-9 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs font-medium text-white appearance-none focus:outline-none focus:border-white/35 cursor-pointer"
                          >
                            <option value="english" className="bg-zinc-900 text-white">English (US/UK)</option>
                            <option value="hinglish" className="bg-zinc-900 text-white">Hinglish (Hindi-English mix)</option>
                            <option value="telugu" className="bg-zinc-900 text-white">Telugu (తెలుగు)</option>
                            <option value="hindi" className="bg-zinc-900 text-white">Hindi (हिन्दी)</option>
                            <option value="tamil" className="bg-zinc-900 text-white">Tamil (தமிழ்)</option>
                            <option value="kannada" className="bg-zinc-900 text-white">Kannada (ಕನ್ನಡ)</option>
                            <option value="malayalam" className="bg-zinc-900 text-white">Malayalam (മലയാളം)</option>
                            <option value="bengali" className="bg-zinc-900 text-white">Bengali (বাংলা)</option>
                            <option value="marathi" className="bg-zinc-900 text-white">Marathi (मराठी)</option>
                            <option value="gujarati" className="bg-zinc-900 text-white">Gujarati (ગુજરાતી)</option>
                            <option value="punjabi" className="bg-zinc-900 text-white">Punjabi (ਪੰਜਾਬੀ)</option>
                            <option value="spanish" className="bg-zinc-900 text-white">Spanish (Español)</option>
                            <option value="french" className="bg-zinc-900 text-white">French (Français)</option>
                            <option value="german" className="bg-zinc-900 text-white">German (Deutsch)</option>
                            <option value="arabic" className="bg-zinc-900 text-white">Arabic (العربية)</option>
                            <option value="japanese" className="bg-zinc-900 text-white">Japanese (日本語)</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-zinc-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ================= TAB 3: STAGE, EXPRESSIONS & PERSONA ================= */}
                  {drawerSection === 'stage' && (
                    <div className="space-y-5">
                      {/* Camera Framing */}
                      <div className="space-y-3">
                        <div className="text-[11px] font-medium text-zinc-400">
                          Stage Framing
                        </div>
                        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                          {(
                            [
                              { id: 'frame', label: 'Close' },
                              { id: 'knee', label: 'Knee' },
                              { id: 'whole', label: 'Full' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                updateCharacter({
                                  fit: opt.id,
                                  zoom: opt.id === 'whole' ? 0.92 : 1.0,
                                  offsetY: opt.id === 'whole' ? -0.04 : 0,
                                })
                              }
                              className={`min-h-[34px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                character.fit === opt.id
                                  ? 'bg-white text-zinc-950 font-semibold'
                                  : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-300 font-medium">Zoom</span>
                            <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                              {Math.round(character.zoom * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.7"
                            max="1.8"
                            step="0.05"
                            aria-label="Stage Zoom"
                            value={character.zoom}
                            onChange={(e) =>
                              updateCharacter({ zoom: parseFloat(e.target.value) })
                            }
                            className="w-full h-1.5 rounded-full accent-white bg-white/12 cursor-pointer"
                          />
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={character.flipHorizontal}
                          onClick={() =>
                            updateCharacter({ flipHorizontal: !character.flipHorizontal })
                          }
                          className="w-full flex items-center justify-between py-1 cursor-pointer"
                        >
                          <span className="text-xs font-medium text-zinc-200">
                            Mirror horizontally
                          </span>
                          <span
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                              character.flipHorizontal ? 'bg-white' : 'bg-white/15'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${
                                character.flipHorizontal
                                  ? 'translate-x-[18px] bg-zinc-950'
                                  : 'translate-x-1 bg-white/75'
                              }`}
                            />
                          </span>
                        </button>
                      </div>

                      {/* Expressions & Gestures */}
                      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
                        <div className="text-[11px] font-medium text-zinc-400">
                          Expressions
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: null, label: 'Neutral' },
                            { id: 'smile', label: 'Happy' },
                            { id: 'shy', label: 'Shy' },
                            { id: 'angry', label: 'Angry' },
                            { id: 'sad', label: 'Sad' },
                          ].map((exp) => (
                            <button
                              key={exp.id || 'neutral'}
                              type="button"
                              onClick={() => updateCharacter({ activeExpression: exp.id })}
                              className={`min-h-[36px] rounded-xl text-xs font-medium transition-colors cursor-pointer border ${
                                character.activeExpression === exp.id
                                  ? 'bg-white text-zinc-950 border-white font-semibold'
                                  : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-300'
                              }`}
                            >
                              {exp.label}
                            </button>
                          ))}
                        </div>

                        <div className="text-[11px] font-medium text-zinc-400 pt-1">
                          Gestures
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {(['nod', 'shake', 'tilt', 'hop', 'shy'] as const).map((act) => (
                            <button
                              key={act}
                              type="button"
                              onClick={() =>
                                updateCharacter({
                                  activeExpression:
                                    act === 'shy' ? 'shy' : character.activeExpression,
                                  activeAction: { id: act, seq: Date.now() },
                                })
                              }
                              className="min-h-[36px] rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] font-medium text-zinc-200 capitalize cursor-pointer transition-colors"
                            >
                              {act}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Scene Ambience */}
                      <div className="space-y-2.5 pt-4 border-t border-white/[0.08]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-zinc-400">Scene</span>
                          <span className="text-zinc-200 font-medium">{activeBackground.label}</span>
                        </div>
                        <div className="grid grid-cols-6 gap-2.5">
                          {HITAISHI_BACKGROUNDS.map((bg) => (
                            <button
                              key={bg.id}
                              type="button"
                              onClick={() => setBackgroundId(bg.id)}
                              title={bg.label}
                              aria-label={bg.label}
                              style={{
                                background:
                                  bg.type === 'transparent'
                                    ? 'repeating-conic-gradient(#52525b 0% 25%, #27272a 0% 50%) 50% / 10px 10px'
                                    : bg.swatch,
                              }}
                              className={`w-8 h-8 rounded-full border transition-transform cursor-pointer ${
                                backgroundId === bg.id
                                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0c0c0e] scale-105 border-white'
                                  : 'border-white/20 hover:scale-105'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Persona & Custom Avatar Import */}
                      <div className="space-y-2.5 pt-4 border-t border-white/[0.08]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-zinc-400">
                            Persona
                          </span>
                          {chatHistory.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setChatHistory([]);
                                saveHitaishiHistory([]);
                              }}
                              className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                            >
                              Clear Memory
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={3}
                          value={character.persona}
                          onChange={(e) =>
                            updateCharacter({ persona: e.target.value })
                          }
                          className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] p-3 text-xs text-zinc-200 focus:outline-none focus:border-white/35 leading-relaxed resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full min-h-[40px] rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5 text-zinc-300" />
                          <span>Import Custom .VRM / .LIVLIV</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
