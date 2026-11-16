import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Mic,
  MicOff,
  Settings,
  Sparkles,
  Square,
  Upload,
  Video,
  VideoOff,
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

interface HitaishiStagePageProps {
  onBack: () => void;
}

interface CompanionChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  expression?: string | null;
  action?: string | null;
}

const MALE_CHARACTER_IDS = new Set(['k02', 'char07', 'd02', 'v04']);

export const HitaishiStagePage: React.FC<HitaishiStagePageProps> = ({ onBack }) => {
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
      initialCat.greetingLines[0] || `Hi, I'm ${initialCat.name}. Talk or type to chat with me.`;
    return ch;
  });

  // Multi-turn conversation memory
  const [chatHistory, setChatHistory] = useState<CompanionChatTurn[]>([]);

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

  // Clean Stage Settings
  const [backgroundId, setBackgroundId] = useState<string>('cozy-twilight');
  const [captionsEnabled, setCaptionsEnabled] = useState<boolean>(true);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);

  // Input & Generation State
  const [chatInput, setChatInput] = useState<string>('');
  const [isGeneratingTurn, setIsGeneratingTurn] = useState<boolean>(false);

  // Gemini Live Duplex Voice State
  const [liveDuplexActive, setLiveDuplexActive] = useState<boolean>(false);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lipSyncTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const liveDuplexActiveRef = useRef<boolean>(false);
  const isGeneratingTurnRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);

  useEffect(() => {
    liveDuplexActiveRef.current = liveDuplexActive;
  }, [liveDuplexActive]);

  useEffect(() => {
    isGeneratingTurnRef.current = isGeneratingTurn;
  }, [isGeneratingTurn]);

  useEffect(() => {
    isSpeakingRef.current = character.isSpeaking;
  }, [character.isSpeaking]);

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

  // Stop any current speech immediately (used by Stop button & Barge-In interruption)
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
          return;
        }
        const wave =
          Math.abs(Math.sin(elapsed * 0.022)) * 0.65 +
          Math.abs(Math.sin(elapsed * 0.049)) * 0.35;
        setCharacter((prev) => ({ ...prev, mouthOpen: wave }));
      }, 45);
    },
    [audioMuted, character.catalogId, character.muted, character.voiceSpeed, character.voiceVolume]
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
        const ttsRes = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: lineText,
            gender,
            language: 'english',
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
        // Fall through to browser speechSynthesis
      }

      speakWithFallbackSynth(lineText);
    },
    [
      audioMuted,
      character.activeExpression,
      character.catalogId,
      character.muted,
      character.voiceVolume,
      speakWithFallbackSynth,
    ]
  );

  // Switch active character
  const handleSelectCatalogCharacter = useCallback(
    (cat: HitaishiCatalogCharacter) => {
      stopCurrentSpeech();
      const nextChar = createStageCharacterFromCatalog(cat, 0.5, 1, 0);
      nextChar.activeExpression = null;
      nextChar.currentSubtitle =
        cat.greetingLines[0] || `Hi, I'm ${cat.name}. Ask me anything!`;
      setCharacter(nextChar);
      setChatHistory([]);
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
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [stopCurrentSpeech]);

  // Core AI Companion Brain: Calls `POST /api/hitaishi/companion`
  const triggerAiResponse = useCallback(
    async (
      userPromptText?: string,
      audioPayload?: { base64: string; mimeType: string }
    ) => {
      if (isGeneratingTurnRef.current) return;
      setIsGeneratingTurn(true);
      isGeneratingTurnRef.current = true;

      if (userPromptText || audioPayload) {
        stopCurrentSpeech();
      }

      try {
        const res = await fetch('/api/hitaishi/companion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: userPromptText || '',
            audioBase64: audioPayload?.base64,
            audioMimeType: audioPayload?.mimeType,
            characterName: character.name,
            persona: character.persona,
            speakingStyle: character.speakingStyle,
            history: chatHistory.slice(-10).map((m) => ({
              role: m.role,
              text: m.text,
            })),
          }),
        });

        if (res.ok) {
          const data = await res.json();
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
            setChatHistory((prev) => [
              ...prev.slice(-18),
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
            ]);
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
      chatHistory,
      speakLine,
      stopCurrentSpeech,
    ]
  );

  // ================= LIVE DUPLEX VOICE MODE =================
  const startDuplexListening = useCallback(async () => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (SpeechRecognitionAPI) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // ignore
          }
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setIsListeningMic(true);
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interim += transcript;
            }
          }

          // Barge-in interruption if user speaks while character is speaking
          if (
            (interim.trim().length > 2 || finalTranscript.trim().length > 0) &&
            isSpeakingRef.current
          ) {
            stopCurrentSpeech();
          }

          setInterimTranscript(interim);

          if (finalTranscript.trim()) {
            const cleanText = finalTranscript.trim();
            setInterimTranscript('');
            triggerAiResponse(cleanText);
          }
        };

        recognition.onerror = (event: any) => {
          if (event?.error === 'not-allowed') {
            setLiveDuplexActive(false);
            setIsListeningMic(false);
          }
        };

        recognition.onend = () => {
          setIsListeningMic(false);
          if (liveDuplexActiveRef.current) {
            setTimeout(() => {
              if (liveDuplexActiveRef.current) {
                try {
                  recognition.start();
                } catch {
                  // ignore
                }
              }
            }, 300);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch {
        // Fall through to MediaRecorder
      }
    }

    // MediaRecorder fallback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      setIsListeningMic(true);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsListeningMic(false);
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (audioBlob.size < 200) return;

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = String(reader.result || '').split(',')[1];
          if (base64Data) {
            triggerAiResponse(undefined, {
              base64: base64Data,
              mimeType: audioBlob.type || 'audio/webm',
            });
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start();
    } catch {
      setLiveDuplexActive(false);
      setIsListeningMic(false);
    }
  }, [stopCurrentSpeech, triggerAiResponse]);

  const stopDuplexListening = useCallback(() => {
    setLiveDuplexActive(false);
    liveDuplexActiveRef.current = false;
    setIsListeningMic(false);
    setInterimTranscript('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const handleToggleLiveDuplex = useCallback(() => {
    if (liveDuplexActive) {
      stopDuplexListening();
    } else {
      setLiveDuplexActive(true);
      liveDuplexActiveRef.current = true;
      startDuplexListening();
    }
  }, [liveDuplexActive, startDuplexListening, stopDuplexListening]);

  // Keyboard hotkeys for expressions (1-4, 0) & actions (Q-T) when not typing
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

  // Custom .vrm / .livliv / .png import from Settings
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

  const filteredCatalog = useMemo(() => {
    if (selectorCategory === 'all') return HITAISHI_CATALOG;
    return HITAISHI_CATALOG.filter((c) => c.category === selectorCategory);
  }, [selectorCategory]);

  const activeCatalogMeta = useMemo(
    () => HITAISHI_CATALOG.find((c) => c.id === character.catalogId),
    [character.catalogId]
  );

  const isFaceTracking =
    character.movementInput === 'face' || character.movementInput === 'face-replay';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09080E] text-white select-none overflow-hidden font-sans">
      {/* Hidden custom model uploader */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vrm,.png,.webp,.json,.livliv"
        onChange={handleCustomAvatarFileUpload}
        className="hidden"
      />

      {/* ================= FULL-BLEED 9:16 COMPANION STAGE ================= */}
      <div
        className="relative w-full h-full sm:max-w-[490px] sm:aspect-[9/16] sm:max-h-[96dvh] sm:rounded-[32px] sm:border sm:border-white/10 sm:shadow-[0_24px_90px_rgba(0,0,0,0.75)] overflow-hidden flex flex-col"
        style={{
          background:
            activeBackground.type === 'solid' ||
            activeBackground.type === 'gradient' ||
            activeBackground.type === 'greenscreen'
              ? activeBackground.value
              : activeBackground.id === 'cozy-twilight'
                ? 'radial-gradient(circle at 50% 28%, #2E2244 0%, #191526 54%, #0D0B14 100%)'
                : activeBackground.type === 'transparent'
                  ? 'repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 24px 24px'
                  : 'linear-gradient(180deg, #22173A 0%, #342152 55%, #191229 100%)',
        }}
      >
        {/* Cozy Twilight Ambient Room Atmosphere */}
        {(activeBackground.id === 'cozy-twilight' ||
          activeBackground.id === 'cozy-night-room') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Soft character-colored halo glow */}
            <div
              className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full blur-[95px] opacity-30 transition-colors duration-700"
              style={{
                background: activeCatalogMeta?.accentColor || '#8B5CF6',
              }}
            />
            {/* Warm bedside bokeh accents */}
            <div className="absolute right-[10%] top-[44%] w-24 h-24 rounded-full bg-amber-300/20 blur-2xl" />
            <div className="absolute left-[12%] top-[28%] w-20 h-20 rounded-full bg-indigo-400/15 blur-2xl" />
            <div className="absolute right-[16%] top-[48%] w-2 h-2 rounded-full bg-amber-200/70 shadow-[0_0_14px_#FDE68A]" />
            <div className="absolute right-[21%] top-[51%] w-1.5 h-1.5 rounded-full bg-amber-100/60 shadow-[0_0_10px_#FDE68A]" />
          </div>
        )}

        {/* ================= MINIMAL FLOATING TOP HEADER ================= */}
        <header className="relative z-30 h-14 px-4 pt-2 flex items-center justify-between shrink-0">
          {/* Left: Back + Settings Gear */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
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
              className="w-10 h-10 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-xl border border-white/15 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Companion & Stage Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Clean Minimal Brand */}
          <span
            className={`text-lg font-bold tracking-tight ${
              isLightBackground
                ? 'text-zinc-900'
                : 'text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]'
            }`}
          >
            hitaishi
          </span>

          {/* Right: Mute + Circular Avatar Character Selector Trigger */}
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => {
                const nextMuted = !audioMuted;
                setAudioMuted(nextMuted);
                if (nextMuted) stopCurrentSpeech();
              }}
              className={`w-9 h-9 rounded-full backdrop-blur-xl border flex items-center justify-center transition-colors cursor-pointer ${
                audioMuted
                  ? 'bg-rose-500/80 border-rose-300/40 text-white'
                  : 'bg-black/35 hover:bg-black/55 border-white/15 text-white/90'
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
              className="relative w-10 h-10 rounded-full ring-2 ring-white/40 hover:ring-white/80 overflow-hidden bg-zinc-900 shadow-lg transition-all cursor-pointer"
              title={`Switch Character (${character.name})`}
            >
              <img
                src={character.avatarUrl}
                alt={character.name}
                className="w-full h-full object-cover"
              />
            </button>

            {/* ================= SLEEK CHARACTER SELECTOR DROPDOWN ================= */}
            <AnimatePresence>
              {charDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setCharDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    className="absolute right-0 top-12 z-50 w-72 sm:w-80 max-h-[68dvh] rounded-2xl bg-zinc-950/90 backdrop-blur-2xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden text-white"
                  >
                    <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/90">
                        Select Character
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

                    {/* Category Tabs */}
                    <div className="p-2 pb-1">
                      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-white/8">
                        {(
                          [
                            { id: 'all', label: 'All' },
                            { id: '2.5d-half', label: 'Upper Body' },
                            { id: '2.5d-full', label: 'Full Body' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSelectorCategory(tab.id)}
                            className={`py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                              selectorCategory === tab.id
                                ? 'bg-white text-zinc-950 font-semibold'
                                : 'text-white/70 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Character List */}
                    <div className="p-2 overflow-y-auto grid grid-cols-3 gap-2">
                      {filteredCatalog.map((item) => {
                        const selected = character.catalogId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectCatalogCharacter(item)}
                            className={`group flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                              selected
                                ? 'bg-white/15 border-white/50'
                                : 'bg-white/5 border-transparent hover:bg-white/10'
                            }`}
                          >
                            <div className="relative w-14 h-14 rounded-full overflow-hidden mb-1 border border-white/15">
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
                            <span className="text-[11px] font-medium text-white truncate max-w-full">
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

        {/* ================= SEAMLESS BOTTOM GRADIENT SCRIM ================= */}
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none z-20" />

        {/* ================= BOTTOM SUBTITLES (PURE READABLE TEXT ON SCREEN) + GLASS PROMPT BAR ================= */}
        <div className="mt-auto relative z-30 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2 flex flex-col gap-3">
          {/* Pure Floating Subtitle Text at Bottom — Zero clunky card/box */}
          <AnimatePresence mode="wait">
            {captionsEnabled &&
              (interimTranscript || isGeneratingTurn || character.currentSubtitle) && (
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
                    <p className="text-[15px] sm:text-base font-medium text-white leading-snug tracking-[0.01em] drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] max-w-[95%] mx-auto">
                      {character.currentSubtitle}
                    </p>
                  )}
                </motion.div>
              )}
          </AnimatePresence>

          {/* Sleek Glassmorphic Bottom Prompt Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 w-full"
          >
            {/* Rounded Glassmorphic Input Pill */}
            <div className="flex-1 h-12 rounded-full bg-white/12 backdrop-blur-2xl border border-white/18 focus-within:border-white/40 focus-within:bg-white/16 pl-4 pr-2 flex items-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-all">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  liveDuplexActive
                    ? isListeningMic
                      ? `Listening to you...`
                      : `Voice active · Speak or type...`
                    : `Type to ${character.name}...`
                }
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none min-w-0"
              />

              {chatInput.trim() ? (
                <button
                  type="submit"
                  disabled={isGeneratingTurn}
                  className="w-8 h-8 rounded-full bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-950 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shrink-0"
                  title="Send"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              ) : character.isSpeaking ? (
                <button
                  type="button"
                  onClick={stopCurrentSpeech}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Stop speaking"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : null}
            </div>

            {/* Circular Glass Camera / Face Tracking Toggle Button */}
            <button
              type="button"
              onClick={() =>
                updateCharacter({
                  movementInput: isFaceTracking ? 'auto' : 'face',
                })
              }
              className={`w-12 h-12 rounded-full backdrop-blur-2xl border flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-[0_8px_28px_rgba(0,0,0,0.4)] ${
                isFaceTracking
                  ? 'bg-sky-500/80 border-sky-300/60 text-white'
                  : 'bg-white/12 hover:bg-white/20 border-white/18 text-white/85'
              }`}
              title={isFaceTracking ? 'Disable Camera Tracking' : 'Enable Camera Tracking'}
            >
              {isFaceTracking ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </button>

            {/* Circular Glass Live Duplex Microphone Button */}
            <button
              type="button"
              onClick={handleToggleLiveDuplex}
              className={`w-12 h-12 rounded-full backdrop-blur-2xl border flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-[0_8px_28px_rgba(0,0,0,0.4)] ${
                liveDuplexActive
                  ? 'bg-emerald-500/90 border-emerald-300/70 text-white ring-4 ring-emerald-400/25 animate-pulse'
                  : 'bg-white/12 hover:bg-white/20 border-white/18 text-white/90'
              }`}
              title={
                liveDuplexActive
                  ? 'Stop Live Duplex Voice'
                  : 'Start Live Duplex Voice Call'
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

        {/* ================= FROSTED GLASS SETTINGS DRAWER ================= */}
        <AnimatePresence>
          {settingsOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSettingsOpen(false)}
                className="fixed inset-0 z-40 bg-black/55 backdrop-blur-xs"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-50 w-80 max-w-[88vw] bg-zinc-950/92 backdrop-blur-2xl border-r border-white/12 text-white flex flex-col overflow-hidden shadow-2xl"
              >
                <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={character.avatarUrl}
                      alt={character.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {character.name}
                      </div>
                      <div className="text-[11px] text-white/50 truncate">
                        Companion Settings
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {/* Captions & Voice */}
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs font-medium text-white/85">
                        Show bottom captions
                      </span>
                      <input
                        type="checkbox"
                        checked={captionsEnabled}
                        onChange={(e) => setCaptionsEnabled(e.target.checked)}
                        className="accent-sky-400 w-4 h-4 cursor-pointer"
                      />
                    </label>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-white/65">
                        <span>Voice Volume</span>
                        <span>{Math.round(character.voiceVolume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={character.voiceVolume}
                        onChange={(e) =>
                          updateCharacter({ voiceVolume: parseFloat(e.target.value) })
                        }
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-white/65">
                        <span>Voice Speed</span>
                        <span>{character.voiceSpeed.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.7"
                        max="1.4"
                        step="0.1"
                        value={character.voiceSpeed}
                        onChange={(e) =>
                          updateCharacter({ voiceSpeed: parseFloat(e.target.value) })
                        }
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Camera Framing */}
                  <div className="space-y-2.5 pt-3 border-t border-white/10">
                    <div className="text-[11px] font-semibold text-white/55">
                      Camera Framing
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
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
                          className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            character.fit === opt.id
                              ? 'bg-white text-zinc-950 font-semibold'
                              : 'bg-white/8 text-white/75 hover:bg-white/15'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] text-white/65">
                        <span>Zoom</span>
                        <span>{Math.round(character.zoom * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.7"
                        max="1.8"
                        step="0.05"
                        value={character.zoom}
                        onChange={(e) =>
                          updateCharacter({ zoom: parseFloat(e.target.value) })
                        }
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>

                    <label className="flex items-center justify-between cursor-pointer pt-1">
                      <span className="text-xs text-white/80">Mirror horizontally</span>
                      <input
                        type="checkbox"
                        checked={character.flipHorizontal}
                        onChange={(e) =>
                          updateCharacter({ flipHorizontal: e.target.checked })
                        }
                        className="accent-sky-400 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Test Facial Expressions & Actions */}
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <div className="text-[11px] font-semibold text-white/55">
                      Expressions
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            character.activeExpression === exp.id
                              ? 'bg-white text-zinc-950 font-semibold'
                              : 'bg-white/8 text-white/75 hover:bg-white/15'
                          }`}
                        >
                          {exp.label}
                        </button>
                      ))}
                    </div>

                    <div className="text-[11px] font-semibold text-white/55 pt-1">
                      Gestures
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
                          className="px-2.5 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-medium text-white/80 capitalize cursor-pointer"
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Ambience */}
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-white/55">Scene</span>
                      <span className="text-white/75">{activeBackground.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {HITAISHI_BACKGROUNDS.map((bg) => (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => setBackgroundId(bg.id)}
                          title={bg.label}
                          style={{
                            background:
                              bg.type === 'transparent'
                                ? 'repeating-conic-gradient(#52525b 0% 25%, #27272a 0% 50%) 50% / 10px 10px'
                                : bg.swatch,
                          }}
                          className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                            backgroundId === bg.id
                              ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110 border-white'
                              : 'border-white/25 hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Persona & Custom Upload */}
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/55">
                        Persona
                      </span>
                      {chatHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setChatHistory([])}
                          className="text-[11px] text-rose-300 hover:underline cursor-pointer"
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
                      className="w-full rounded-xl bg-white/8 border border-white/12 p-2.5 text-xs text-white/90 focus:outline-none focus:border-white/35"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/12 text-xs font-medium text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import Custom .VRM / .LIVLIV</span>
                    </button>
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
