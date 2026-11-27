import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown,
  Layers, MessageSquare, Mic, MicOff, Settings, ShieldAlert,
  Square, Upload, Volume2, VolumeX, X,
} from 'lucide-react';
import {
  HITAISHI_BACKGROUNDS, HITAISHI_CATALOG,
  createStageCharacterFromCatalog, type HitaishiCatalogCharacter, type HitaishiStageCharacter,
} from './hitaishiCatalog';
import { HitaishiAvatarCanvas, type HitaishiSpeechClipRequest } from './HitaishiAvatarCanvas';
import {
  buildHitaishiWorkspaceContextPayload, getSavedHitaishiHistory, getSavedHitaishiScope,
  saveHitaishiHistory, setSavedHitaishiScope, syncHitaishiTurnAcrossWorkspaces, type HitaishiWorkspaceScope,
} from '../../lib/hitaishiWorkspaceBridge';
import { getAuthHeaders } from '../../lib/firebase';

interface HitaishiStagePageProps {
  onBack: () => void;
  onOpenStudySpace?: () => void;
  onOpenSideChat?: () => void;
}
interface CompanionChatTurn { id: string; role: 'user' | 'assistant'; text: string; expression?: string | null; action?: string | null; }
interface HitaishiRateLimitClientState {
  limitPerMinute: number; remainingPerMinute: number; resetAtMs: number; retryAfterSec: number;
  dailyUsed: number; dailyLimit: number; dailyRemaining: number; plan: string;
}

const MALE_CHARACTER_IDS = new Set(['x402', 'k02', 'char07', 'd02', 'v04']);
const LIGHT_BG_IDS = new Set(['warm-ivory', 'crisp-white', 'pastel-sakura', 'sky-breeze', 'lavender-dream']);
const LANGUAGE_TO_BCP47: Record<string, string> = {
  english: 'en-US', hinglish: 'en-IN', telugu: 'te-IN', hindi: 'hi-IN', tamil: 'ta-IN', kannada: 'kn-IN',
  malayalam: 'ml-IN', bengali: 'bn-IN', marathi: 'mr-IN', gujarati: 'gu-IN', punjabi: 'pa-IN',
  spanish: 'es-ES', french: 'fr-FR', german: 'de-DE', arabic: 'ar-SA', japanese: 'ja-JP',
};
const VOICE_LANGUAGES: [string, string][] = [
  ['english', 'English (US/UK)'], ['hinglish', 'Hinglish (Hindi-English mix)'], ['telugu', 'Telugu (తెలుగు)'],
  ['hindi', 'Hindi (हिन्दी)'], ['tamil', 'Tamil (தமிழ்)'], ['kannada', 'Kannada (ಕನ್ನಡ)'],
  ['malayalam', 'Malayalam (മലയാളം)'], ['bengali', 'Bengali (বাংলা)'], ['marathi', 'Marathi (मराठी)'],
  ['gujarati', 'Gujarati (ગુજરાતી)'], ['punjabi', 'Punjabi (ਪੰਜਾਬੀ)'], ['spanish', 'Spanish (Español)'],
  ['french', 'French (Français)'], ['german', 'German (Deutsch)'], ['arabic', 'Arabic (العربية)'], ['japanese', 'Japanese (日本語)'],
];
const KEY_MAP: Record<string, Partial<HitaishiStageCharacter>> = {
  '1': { activeExpression: 'smile' }, '2': { activeExpression: 'shy' }, '3': { activeExpression: 'angry' },
  '4': { activeExpression: 'sad' }, '5': { activeExpression: 'playful' }, '0': { activeExpression: null },
};
function inferAutoEmotionFromText(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(haha|hehe|lol|lmao|teas|cheeky|wink|silly|joke|prank|gotcha|boop|playful|mischief|heheh)\b|[😜😝😛😉]/.test(t)) return 'playful';
  if (/\b(blush|shy|aww+|embarrass|flatter|crush|sweet of you|nervous|oops|umm|uhh)\b|[☺️😊😳🙈]/.test(t)) return 'shy';
  if (/\b(angry|furious|annoyed|frustrat|mad at|ugh|grr|seriously\?!|unfair|hate that)\b|[😠😡😤]/.test(t)) return 'angry';
  if (/\b(sorry|sad|miss you|unfortunately|tough|heartbreak|lonely|cry|hurts|apolog|sigh)\b|[🥺😢😭😔]/.test(t)) return 'sad';
  if (/\b(awesome|great|yay|love|happy|glad|excited|amazing|wonderful|nice|congrats|hey!|hello|hi!|welcome|fun|brilliant)\b|[😀😄😁✨]/.test(t)) return 'smile';
  return null;
}
const ACT_KEY_MAP: Record<string, 'nod' | 'shake' | 'tilt' | 'hop'> = { q: 'nod', w: 'shake', e: 'tilt', r: 'hop' };

function downsampleFloat32To16kInt16(input: Float32Array, sr: number): Int16Array {
  if (sr === 16000) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) { const s = Math.max(-1, Math.min(1, input[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
    return out;
  }
  const ratio = sr / 16000, len = Math.max(1, Math.round(input.length / ratio)), out = new Int16Array(len);
  for (let o = 0, buf = 0; o < len; o++) {
    const next = Math.min(input.length, Math.round((o + 1) * ratio));
    let sum = 0, cnt = 0;
    for (let i = buf; i < next; i++) { sum += input[i]; cnt++; }
    const s = Math.max(-1, Math.min(1, cnt > 0 ? sum / cnt : 0));
    out[o] = s < 0 ? s * 0x8000 : s * 0x7fff;
    buf = next;
  }
  return out;
}

const SwitchRow: React.FC<{ title: string; subtitle?: string; checked: boolean; onToggle: () => void }> = ({ title, subtitle, checked, onToggle }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={onToggle} className="w-full flex items-center justify-between gap-3 py-1 cursor-pointer">
    <div className="text-left">
      <div className="text-xs font-medium text-white">{title}</div>
      {subtitle && <div className="text-[11px] text-zinc-500">{subtitle}</div>}
    </div>
    <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-white' : 'bg-white/15'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${checked ? 'translate-x-[18px] bg-zinc-950' : 'translate-x-1 bg-white/75'}`} />
    </span>
  </button>
);

const MIC_SILENCE_AUTO_END_MS = 12_000;
const MIC_MAX_SESSION_MS = 180_000;
const MIC_PCM_HANGOVER_MS = 1_800;

export const HitaishiStagePage: React.FC<HitaishiStagePageProps> = ({ onBack, onOpenStudySpace, onOpenSideChat }) => {
  const [character, setCharacter] = useState<HitaishiStageCharacter>(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('hitaishi_active_char_id') : null;
    const cat = (savedId && HITAISHI_CATALOG.find((c) => c.id === savedId)) || HITAISHI_CATALOG.find((c) => c.id === 'n01') || HITAISHI_CATALOG[0];
    const ch = createStageCharacterFromCatalog(cat, 0.5, 1, 0);
    ch.isSpeaking = false; ch.activeExpression = null;
    ch.currentSubtitle = cat.greetingLines[0] || `Hi, I'm ${cat.name}. Tap the mic or type to talk with me!`;
    return ch;
  });

  const [chatHistory, setChatHistory] = useState<CompanionChatTurn[]>(() =>
    getSavedHitaishiHistory().map((m) => ({ id: m.id, role: m.role, text: m.text, expression: m.expression, action: m.action }))
  );
  const [workspaceScope, setWorkspaceScope] = useState<HitaishiWorkspaceScope>(() => getSavedHitaishiScope());
  const [syncToWorkspaces, setSyncToWorkspaces] = useState(true);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState(() => buildHitaishiWorkspaceContextPayload(getSavedHitaishiScope()));
  const [rateLimitInfo, setRateLimitInfo] = useState<HitaishiRateLimitClientState>({
    limitPerMinute: 15, remainingPerMinute: 15, resetAtMs: Date.now() + 60_000, retryAfterSec: 0,
    dailyUsed: 0, dailyLimit: 1500, dailyRemaining: 1500, plan: 'spark',
  });
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [speechClip, setSpeechClip] = useState<HitaishiSpeechClipRequest | null>(null);
  const updateCharacter = useCallback((patch: Partial<HitaishiStageCharacter>) => setCharacter((p) => ({ ...p, ...patch })), []);

  const [charDropdownOpen, setCharDropdownOpen] = useState(false);
  const [selectorCategory, setSelectorCategory] = useState<'all' | '2.5d-half' | '2.5d-full' | '3d-studio'>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<'workspaces' | 'voice' | 'stage'>('workspaces');

  const [backgroundId, setBackgroundId] = useState<string>(() => (character.catalogId === 'x402' ? 'obsidian' : 'cozy-twilight'));
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingTurn, setIsGeneratingTurn] = useState(false);
  const [liveDuplexActive, setLiveDuplexActive] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micStatusError, setMicStatusError] = useState<string | null>(null);
  const [micAutoEndCountdown, setMicAutoEndCountdown] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lipSyncTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const vadHasSpokenRef = useRef(false);
  const vadSilenceStartRef = useRef(0);
  const vadSpeechStartRef = useRef(0);
  const lastRecognitionResultAtRef = useRef(0);
  const interimDebounceTimerRef = useRef<number | null>(null);
  const micRafRef = useRef<number | null>(null);
  const liveDuplexActiveRef = useRef(false);
  const isGeneratingTurnRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const geminiLiveAudioReceivedRef = useRef(false);
  const liveWsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const voiceLanguageRef = useRef(character.voiceLanguage || 'english');
  const lastVoiceActivityAtRef = useRef(0);
  const lastMicSpeechAtRef = useRef(0);
  const micSessionHardCapTimerRef = useRef<number | null>(null);
  const micAutoEndNoticeTimerRef = useRef<number | null>(null);

  useEffect(() => { voiceLanguageRef.current = character.voiceLanguage || 'english'; }, [character.voiceLanguage]);
  useEffect(() => { liveDuplexActiveRef.current = liveDuplexActive; }, [liveDuplexActive]);
  useEffect(() => { isGeneratingTurnRef.current = isGeneratingTurn; }, [isGeneratingTurn]);
  useEffect(() => { isSpeakingRef.current = character.isSpeaking; }, [character.isSpeaking]);

  useEffect(() => {
    const refresh = () => setWorkspaceSnapshot(buildHitaishiWorkspaceContextPayload(workspaceScope));
    refresh();
    window.addEventListener('hitaishi-workspace-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('hitaishi-workspace-updated', refresh); window.removeEventListener('storage', refresh); };
  }, [workspaceScope]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/hitaishi/status', { headers: await getAuthHeaders() });
        if (res.ok && !cancelled) { const d = await res.json(); if (d?.rateLimit) setRateLimitInfo(d.rateLimit); }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = window.setInterval(() => setCooldownSeconds((p) => Math.max(0, p - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldownSeconds]);

  const activeBackground = useMemo(() => HITAISHI_BACKGROUNDS.find((b) => b.id === backgroundId) || HITAISHI_BACKGROUNDS[0], [backgroundId]);
  const isLightBackground = LIGHT_BG_IDS.has(activeBackground.id);

  const stopCurrentSpeech = useCallback(() => {
    if (lipSyncTimerRef.current) { window.clearInterval(lipSyncTimerRef.current); lipSyncTimerRef.current = null; }
    try { window.speechSynthesis?.cancel(); } catch {}
    setSpeechClip(null);
    setCharacter((p) => ({ ...p, isSpeaking: false, mouthOpen: 0 }));
    isSpeakingRef.current = false;
  }, []);

  const speakWithFallbackSynth = useCallback((lineText: string) => {
    if (lipSyncTimerRef.current) { window.clearInterval(lipSyncTimerRef.current); lipSyncTimerRef.current = null; }
    if (!audioMuted && !character.muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(lineText);
        u.lang = LANGUAGE_TO_BCP47[character.voiceLanguage || 'english'] || 'en-US';
        u.pitch = HITAISHI_CATALOG.find((c) => c.id === character.catalogId)?.voicePitch ?? 1.1;
        u.rate = character.voiceSpeed || 1.0;
        u.volume = Math.max(0, Math.min(1, character.voiceVolume));
        window.speechSynthesis.speak(u);
      } catch {}
    }
    const durationMs = Math.min(7000, Math.max(1800, lineText.length * 58)), startTime = performance.now();
    lipSyncTimerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        if (lipSyncTimerRef.current) { window.clearInterval(lipSyncTimerRef.current); lipSyncTimerRef.current = null; }
        setCharacter((p) => ({ ...p, isSpeaking: false, mouthOpen: 0 }));
        isSpeakingRef.current = false;
        return;
      }
      setCharacter((p) => ({ ...p, mouthOpen: Math.abs(Math.sin(elapsed * 0.022)) * 0.65 + Math.abs(Math.sin(elapsed * 0.049)) * 0.35 }));
    }, 45);
  }, [audioMuted, character.catalogId, character.muted, character.voiceLanguage, character.voiceSpeed, character.voiceVolume]);

  const speakLine = useCallback(async (lineText: string, expressionOverride?: string | null, actionOverride?: 'nod' | 'shake' | 'tilt' | 'hop' | 'shy' | null) => {
    if (lipSyncTimerRef.current) { window.clearInterval(lipSyncTimerRef.current); lipSyncTimerRef.current = null; }
    try { window.speechSynthesis?.cancel(); } catch {}
    const normalizedExpr = expressionOverride === undefined ? character.activeExpression : expressionOverride === 'neutral' ? null : expressionOverride;
    isSpeakingRef.current = true;
    setCharacter((p) => ({
      ...p, isSpeaking: true, currentSubtitle: lineText, activeExpression: normalizedExpr,
      activeAction: actionOverride ? { id: actionOverride, seq: Date.now() } : p.activeAction,
    }));
    if (audioMuted || character.muted || character.voiceVolume <= 0.01) { speakWithFallbackSynth(lineText); return; }
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lineText, gender: MALE_CHARACTER_IDS.has(character.catalogId) ? 'male' : 'female', language: character.voiceLanguage || 'english' }),
      });
      if (res.ok) {
        const audioBlob = await res.blob();
        if (audioBlob?.size > 100) {
          setSpeechClip({
            seq: Date.now(), audioBlob, volume: Math.max(0, Math.min(1, character.voiceVolume)),
            onEnd: () => { isSpeakingRef.current = false; setCharacter((p) => ({ ...p, isSpeaking: false, mouthOpen: 0 })); },
          });
          return;
        }
      }
    } catch {}
    speakWithFallbackSynth(lineText);
  }, [audioMuted, character.activeExpression, character.catalogId, character.muted, character.voiceLanguage, character.voiceVolume, speakWithFallbackSynth]);

  const triggerAiResponse = useCallback(async (userPromptText?: string, audioPayload?: { base64: string; mimeType: string }) => {
    if (isGeneratingTurnRef.current || cooldownSeconds > 0) return;
    setIsGeneratingTurn(true); isGeneratingTurnRef.current = true; setInterimTranscript('');
    if (userPromptText || audioPayload) stopCurrentSpeech();
    try {
      const liveWorkspaceContext = buildHitaishiWorkspaceContextPayload(workspaceScope);
      setWorkspaceSnapshot(liveWorkspaceContext);
      const res = await fetch('/api/hitaishi/companion', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userPromptText || '', audioBase64: audioPayload?.base64, audioMimeType: audioPayload?.mimeType,
          characterName: character.name, persona: character.persona, speakingStyle: character.speakingStyle,
          voiceLanguage: character.voiceLanguage || 'english', workspaceContext: liveWorkspaceContext,
          history: chatHistory.slice(-12).map((m) => ({ role: m.role, text: m.text, content: m.text })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.rateLimit) setRateLimitInfo(data.rateLimit);
      if (res.status === 429) {
        const waitSec = Number(data?.retryAfterSeconds || data?.rateLimit?.retryAfterSec || 10);
        setCooldownSeconds(waitSec);
        await speakLine(data?.reply || `Whoa, slow down a little! Give me ${waitSec} seconds to catch my breath!`, 'shy', 'shy');
        return;
      }
      if (res.ok && data) {
        const replyText = String(data.reply || '').trim();
        const apiExpr = data.expression === 'neutral' || data.expression === null ? null : ['smile', 'shy', 'playful', 'angry', 'sad'].includes(data.expression) ? data.expression : null;
        const expr = apiExpr ?? inferAutoEmotionFromText(replyText) ?? 'smile';
        const act = (['nod', 'shake', 'tilt', 'hop', 'shy'].includes(data.action) ? data.action : null) as any;
        const actualUserText = String(data.userTranscript || userPromptText || '').trim();
        if (actualUserText || replyText) {
          setChatHistory((prev) => {
            const next: CompanionChatTurn[] = [
              ...prev.slice(-22),
              ...(actualUserText ? [{ id: `u-${Date.now()}`, role: 'user' as const, text: actualUserText }] : []),
              ...(replyText ? [{ id: `a-${Date.now() + 1}`, role: 'assistant' as const, text: replyText, expression: expr, action: act }] : []),
            ];
            saveHitaishiHistory(next.map((t) => ({ ...t, timestamp: Date.now(), characterId: character.catalogId })));
            return next;
          });
          if (syncToWorkspaces && actualUserText && replyText) {
            syncHitaishiTurnAcrossWorkspaces({ characterName: character.name, userText: actualUserText, replyText, syncToMainChat: workspaceScope === 'all' || workspaceScope === 'chat', syncToStudyChat: workspaceScope === 'all' || workspaceScope === 'study' });
          }
        }
        if (replyText) { await speakLine(replyText, expr, act); return; }
      }
      await speakLine(HITAISHI_CATALOG.find((c) => c.id === character.catalogId)?.greetingLines[0] || `I'm listening—what's on your mind?`, 'smile', 'nod');
    } catch {
      await speakLine(HITAISHI_CATALOG.find((c) => c.id === character.catalogId)?.greetingLines[0] || `Hey! Ask me anything anytime.`, 'smile', 'tilt');
    } finally { setIsGeneratingTurn(false); isGeneratingTurnRef.current = false; }
  }, [character.catalogId, character.name, character.persona, character.speakingStyle, character.voiceLanguage, chatHistory, cooldownSeconds, speakLine, stopCurrentSpeech, syncToWorkspaces, workspaceScope]);

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('hitaishi_pending_prompt');
      if (pending?.trim()) { sessionStorage.removeItem('hitaishi_pending_prompt'); triggerAiResponse(pending.trim()); }
    } catch {}
  }, [triggerAiResponse]);

  const stopDuplexListening = useCallback((autoEndReason?: string) => {
    setLiveDuplexActive(false); liveDuplexActiveRef.current = false; setIsListeningMic(false);
    setMicVolumeLevel(0); setInterimTranscript(''); setMicAutoEndCountdown(null);
    if (micSessionHardCapTimerRef.current) { window.clearTimeout(micSessionHardCapTimerRef.current); micSessionHardCapTimerRef.current = null; }
    if (interimDebounceTimerRef.current) { window.clearTimeout(interimDebounceTimerRef.current); interimDebounceTimerRef.current = null; }
    if (micRafRef.current) { cancelAnimationFrame(micRafRef.current); micRafRef.current = null; }
    if (recognitionRef.current) { try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    if (mediaRecorderRef.current) { try { mediaRecorderRef.current.ondataavailable = null; mediaRecorderRef.current.onstop = null; if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch {} mediaRecorderRef.current = null; }
    try { processorRef.current?.disconnect(); } catch {} processorRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop()); micStreamRef.current = null;
    try { inputAudioCtxRef.current?.close(); } catch {} inputAudioCtxRef.current = null;
    try { outputAudioCtxRef.current?.close(); } catch {} outputAudioCtxRef.current = null;
    try { liveWsRef.current?.close(); } catch {} liveWsRef.current = null;
    if (autoEndReason) {
      setMicStatusError(autoEndReason);
      if (micAutoEndNoticeTimerRef.current) window.clearTimeout(micAutoEndNoticeTimerRef.current);
      micAutoEndNoticeTimerRef.current = window.setTimeout(() => setMicStatusError((c) => (c === autoEndReason ? null : c)), 4500);
    }
  }, []);

  useEffect(() => {
    const onVis = () => { if (document.hidden && liveDuplexActiveRef.current) stopDuplexListening('Mic auto-ended when app went to background.'); };
    const onHide = () => { if (liveDuplexActiveRef.current) stopDuplexListening(); };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onHide);
      if (micAutoEndNoticeTimerRef.current) window.clearTimeout(micAutoEndNoticeTimerRef.current);
      if (liveDuplexActiveRef.current) stopDuplexListening();
    };
  }, [stopDuplexListening]);

  const startDuplexListening = useCallback(async () => {
    setMicStatusError(null); setMicAutoEndCountdown(null); stopCurrentSpeech();
    geminiLiveAudioReceivedRef.current = false;
    const startedAt = Date.now();
    lastVoiceActivityAtRef.current = startedAt; lastMicSpeechAtRef.current = startedAt;
    if (micSessionHardCapTimerRef.current) window.clearTimeout(micSessionHardCapTimerRef.current);
    micSessionHardCapTimerRef.current = window.setTimeout(() => {
      if (liveDuplexActiveRef.current) stopDuplexListening('Mic auto-ended after 3m session limit to prevent billing.');
    }, MIC_MAX_SESSION_MS);

    const startSpeechRec = () => {
      if (typeof window === 'undefined') return false;
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) return false;
      try {
        const rec = new SpeechRec();
        rec.continuous = true; rec.interimResults = true; rec.lang = LANGUAGE_TO_BCP47[voiceLanguageRef.current] || 'en-US';
        rec.onresult = (ev: any) => {
          if (!liveDuplexActiveRef.current) return;
          let interimText = '', finalText = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const txt = String(ev.results[i][0]?.transcript || '');
            if (ev.results[i].isFinal) finalText += txt + ' '; else interimText += txt;
          }
          const nowMs = Date.now();
          if (interimText.trim()) {
            lastRecognitionResultAtRef.current = nowMs; lastVoiceActivityAtRef.current = nowMs; lastMicSpeechAtRef.current = nowMs;
            setMicAutoEndCountdown(null); setInterimTranscript(interimText.trim());
            if (isSpeakingRef.current) stopCurrentSpeech();
            if (interimDebounceTimerRef.current) window.clearTimeout(interimDebounceTimerRef.current);
            const cap = interimText.trim();
            interimDebounceTimerRef.current = window.setTimeout(() => {
              if (liveDuplexActiveRef.current && !isGeneratingTurnRef.current && !geminiLiveAudioReceivedRef.current && cap.length >= 2) {
                setInterimTranscript(''); triggerAiResponse(cap);
              }
            }, 1350);
          }
          if (finalText.trim()) {
            if (interimDebounceTimerRef.current) { window.clearTimeout(interimDebounceTimerRef.current); interimDebounceTimerRef.current = null; }
            lastRecognitionResultAtRef.current = nowMs; lastVoiceActivityAtRef.current = nowMs; lastMicSpeechAtRef.current = nowMs;
            setMicAutoEndCountdown(null); setInterimTranscript('');
            if (!geminiLiveAudioReceivedRef.current && !isGeneratingTurnRef.current) triggerAiResponse(finalText.trim());
          }
        };
        rec.onerror = (ev: any) => { if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') setMicStatusError('Microphone permission denied by browser.'); };
        rec.onend = () => {
          if (liveDuplexActiveRef.current && recognitionRef.current === rec) {
            setTimeout(() => { if (liveDuplexActiveRef.current && recognitionRef.current === rec) { try { rec.lang = LANGUAGE_TO_BCP47[voiceLanguageRef.current] || 'en-US'; rec.start(); } catch {} } }, 250);
          }
        };
        rec.start(); recognitionRef.current = rec; return true;
      } catch { return false; }
    };

    try {
      const isAndroidBrowser = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
      // On Android Chrome, opening getUserMedia simultaneously with SpeechRecognition locks the hardware mic
      // and triggers "Speech Recognition and Synthesis from Google cannot record now as Chrome is recording."
      if (!navigator.mediaDevices?.getUserMedia || isAndroidBrowser) {
        if (startSpeechRec()) {
          setIsListeningMic(true);
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone API is not available in this browser context.');
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      micStreamRef.current = stream; setIsListeningMic(true); startSpeechRec();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx: AudioContext = new AudioCtx(), outputCtx: AudioContext = new AudioCtx();
      if (inputCtx.state === 'suspended') try { await inputCtx.resume(); } catch {}
      if (outputCtx.state === 'suspended') try { await outputCtx.resume(); } catch {}
      inputAudioCtxRef.current = inputCtx; outputAudioCtxRef.current = outputCtx; nextPlayTimeRef.current = 0;
      const source = inputCtx.createMediaStreamSource(stream), analyser = inputCtx.createAnalyser();
      analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.55; source.connect(analyser);

      const setupSegmentRecorder = () => {
        if (!liveDuplexActiveRef.current || !micStreamRef.current) return;
        try {
          const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
            : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/mp4') ? 'audio/mp4' : '';
          const rec = mimeType ? new MediaRecorder(micStreamRef.current, { mimeType }) : new MediaRecorder(micStreamRef.current);
          recordedChunksRef.current = []; vadHasSpokenRef.current = false; vadSilenceStartRef.current = 0; vadSpeechStartRef.current = 0;
          rec.ondataavailable = (ev) => { if (ev.data?.size > 0) recordedChunksRef.current.push(ev.data); };
          rec.onstop = () => {
            const chunks = recordedChunksRef.current; recordedChunksRef.current = [];
            const hadSpeech = vadHasSpokenRef.current; vadHasSpokenRef.current = false;
            if (hadSpeech && chunks.length > 0 && Date.now() - lastRecognitionResultAtRef.current >= 2600 && !geminiLiveAudioReceivedRef.current && !isGeneratingTurnRef.current && liveDuplexActiveRef.current) {
              const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
              if (blob.size > 800) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const b64 = String(reader.result || '');
                  if (b64 && liveDuplexActiveRef.current && !isGeneratingTurnRef.current) triggerAiResponse('', { base64: b64, mimeType: blob.type || 'audio/webm' });
                };
                reader.readAsDataURL(blob);
              }
            }
            if (liveDuplexActiveRef.current && micStreamRef.current) setupSegmentRecorder();
          };
          rec.start(250); mediaRecorderRef.current = rec;
        } catch {}
      };
      setupSegmentRecorder();

      const buf = new Float32Array(analyser.fftSize);
      let lastCountdown: number | null = null;
      const pollMic = () => {
        if (!liveDuplexActiveRef.current) return;
        analyser.getFloatTimeDomainData(buf);
        let sq = 0; for (let i = 0; i < buf.length; i++) sq += buf[i] * buf[i];
        const rms = Math.sqrt(sq / buf.length);
        setMicVolumeLevel(Math.min(1, rms * 6.5));
        const now = performance.now(), wall = Date.now();
        if (rms > 0.016 || isSpeakingRef.current || isGeneratingTurnRef.current) {
          lastVoiceActivityAtRef.current = wall;
          if (rms > 0.016) lastMicSpeechAtRef.current = wall;
          if (lastCountdown !== null) { lastCountdown = null; setMicAutoEndCountdown(null); }
        } else {
          const idle = wall - lastVoiceActivityAtRef.current;
          if (idle >= MIC_SILENCE_AUTO_END_MS) { stopDuplexListening('Mic auto-ended after silence to save billing.'); return; }
          const rem = Math.ceil((MIC_SILENCE_AUTO_END_MS - idle) / 1000), nextCd = rem <= 5 ? rem : null;
          if (nextCd !== lastCountdown) { lastCountdown = nextCd; setMicAutoEndCountdown(nextCd); }
        }
        if (rms > 0.022 && !isSpeakingRef.current && !isGeneratingTurnRef.current) {
          if (!vadHasSpokenRef.current) { vadHasSpokenRef.current = true; vadSpeechStartRef.current = now; }
          vadSilenceStartRef.current = 0;
        } else if (vadHasSpokenRef.current) {
          if (vadSilenceStartRef.current === 0) vadSilenceStartRef.current = now;
          else if (now - vadSilenceStartRef.current > 1150 && now - vadSpeechStartRef.current > 450) {
            vadSilenceStartRef.current = 0;
            if (mediaRecorderRef.current?.state === 'recording') try { mediaRecorderRef.current.stop(); } catch {}
          }
        }
        micRafRef.current = requestAnimationFrame(pollMic);
      };
      micRafRef.current = requestAnimationFrame(pollMic);

      try {
        const wsSummary = [workspaceSnapshot.activeStudySpace?.title ? `Study Space: ${workspaceSnapshot.activeStudySpace.title}` : '', workspaceSnapshot.activeChatThread?.title ? `Chat: ${workspaceSnapshot.activeChatThread.title}` : ''].filter(Boolean).join(' | ');
        const params = new URLSearchParams({ charName: character.name, persona: character.persona.slice(0, 240), language: character.voiceLanguage || 'english', gender: MALE_CHARACTER_IDS.has(character.catalogId) ? 'male' : 'female', workspaceSummary: wsSummary });
        const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/live?${params}`);
        liveWsRef.current = ws;
        const proc = inputCtx.createScriptProcessor(4096, 1, 1); processorRef.current = proc;
        proc.onaudioprocess = (e) => {
          if (!liveWsRef.current || liveWsRef.current.readyState !== WebSocket.OPEN) return;
          const ch = e.inputBuffer.getChannelData(0);
          let sq = 0; for (let i = 0; i < ch.length; i++) sq += ch[i] * ch[i];
          const frameRms = Math.sqrt(sq / Math.max(1, ch.length)), nowMs = Date.now();
          if (frameRms > 0.014) { lastMicSpeechAtRef.current = nowMs; lastVoiceActivityAtRef.current = nowMs; }
          else if (nowMs - lastMicSpeechAtRef.current > MIC_PCM_HANGOVER_MS) return;
          const uint8 = new Uint8Array(downsampleFloat32To16kInt16(ch, inputCtx.sampleRate).buffer);
          let bin = ''; for (let i = 0; i < uint8.length; i++) bin += String.fromCharCode(uint8[i]);
          liveWsRef.current.send(JSON.stringify({ audio: btoa(bin) }));
        };
        source.connect(proc); proc.connect(inputCtx.destination);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.autoEnded) { stopDuplexListening(typeof msg.reason === 'string' && msg.reason.trim() ? msg.reason : 'Mic auto-ended to save billing.'); return; }
            if (msg.error && msg.retryAfterSec) { setCooldownSeconds(Number(msg.retryAfterSec) || 10); return; }
            if (msg.interrupted) { nextPlayTimeRef.current = 0; stopCurrentSpeech(); return; }
            if (msg.userTranscript) { lastVoiceActivityAtRef.current = Date.now(); setInterimTranscript(String(msg.userTranscript)); }
            if (msg.modelTranscript) {
              lastVoiceActivityAtRef.current = Date.now();
              const t = String(msg.modelTranscript).trim();
              if (t) {
                const autoExpr = inferAutoEmotionFromText(t);
                setCharacter((p) => ({ ...p, currentSubtitle: t, ...(autoExpr ? { activeExpression: autoExpr } : {}) }));
              }
            }
            if (msg.audio) {
              lastVoiceActivityAtRef.current = Date.now(); geminiLiveAudioReceivedRef.current = true; isSpeakingRef.current = true;
              const bin = atob(msg.audio), bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const int16 = new Int16Array(bytes.buffer), float32 = new Float32Array(int16.length);
              let sumAmp = 0;
              for (let i = 0; i < int16.length; i++) { const s = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff); float32[i] = s; sumAmp += Math.abs(s); }
              setCharacter((p) => ({ ...p, isSpeaking: true, mouthOpen: Math.min(1, Math.max(0.2, (sumAmp / Math.max(1, int16.length)) * 4.2)) }));
              const audioBuf = outputCtx.createBuffer(1, float32.length, 24000); audioBuf.copyToChannel(float32, 0);
              const src = outputCtx.createBufferSource(); src.buffer = audioBuf; src.connect(outputCtx.destination);
              const startTime = Math.max(outputCtx.currentTime, nextPlayTimeRef.current); src.start(startTime); nextPlayTimeRef.current = startTime + audioBuf.duration;
              src.onended = () => { if (outputCtx.currentTime >= nextPlayTimeRef.current - 0.05) { isSpeakingRef.current = false; setCharacter((p) => ({ ...p, isSpeaking: false, mouthOpen: 0 })); } };
            }
          } catch {}
        };
        ws.onerror = ws.onclose = () => { geminiLiveAudioReceivedRef.current = false; };
      } catch { geminiLiveAudioReceivedRef.current = false; }
    } catch (err: any) {
      setMicStatusError(err?.message || 'Microphone access blocked. Please allow microphone permission in your browser.');
      setLiveDuplexActive(false); liveDuplexActiveRef.current = false; setIsListeningMic(false);
    }
  }, [character.catalogId, character.name, character.persona, character.voiceLanguage, stopCurrentSpeech, stopDuplexListening, triggerAiResponse, workspaceSnapshot.activeChatThread?.title, workspaceSnapshot.activeStudySpace?.title]);

  const handleToggleLiveDuplex = useCallback(() => {
    if (liveDuplexActive) {
      const pending = interimTranscript.trim(); stopDuplexListening(); if (pending) triggerAiResponse(pending);
    } else {
      setLiveDuplexActive(true); liveDuplexActiveRef.current = true; startDuplexListening();
    }
  }, [interimTranscript, liveDuplexActive, startDuplexListening, stopDuplexListening, triggerAiResponse]);

  const handleSelectCatalogCharacter = useCallback((cat: HitaishiCatalogCharacter) => {
    stopCurrentSpeech();
    const nextChar = createStageCharacterFromCatalog(cat, 0.5, 1, 0);
    nextChar.activeExpression = null;
    nextChar.currentSubtitle = cat.greetingLines[0] || `Hi, I'm ${cat.name}. Ask me anything!`;
    setCharacter(nextChar);
    if (cat.id === 'x402' || cat.proceduralPreset === 'x402') setBackgroundId('obsidian');
    setCharDropdownOpen(false);
    try { localStorage.setItem('hitaishi_active_char_id', cat.id); window.dispatchEvent(new Event('hitaishi-char-changed')); } catch {}
  }, [stopCurrentSpeech]);

  useEffect(() => () => { stopCurrentSpeech(); stopDuplexListening(); }, [stopCurrentSpeech, stopDuplexListening]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (KEY_MAP[k]) updateCharacter(KEY_MAP[k]);
      else if (ACT_KEY_MAP[k]) updateCharacter({ activeAction: { id: ACT_KEY_MAP[k], seq: Date.now() } });
      else if (k === 't') updateCharacter({ activeExpression: 'shy', activeAction: { id: 'shy', seq: Date.now() } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [updateCharacter]);

  const handleCustomAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase(), baseName = file.name.replace(/\.[^.]+$/, ''), customMap = new Map<string, Blob>([[file.name, file]]);
    const format: HitaishiStageCharacter['format'] = lower.endsWith('.vrm') ? 'vrm' : lower.endsWith('.png') || lower.endsWith('.webp') ? 'png' : 'livliv';
    const blobUrl = URL.createObjectURL(file);
    const stageChar = createStageCharacterFromCatalog({
      id: `custom-${Date.now()}`, name: baseName.slice(0, 18) || 'Custom Avatar', tagline: `Imported ${format.toUpperCase()}`,
      category: format === 'vrm' ? '3d-studio' : '2.5d-half', format, fullBody: format === 'vrm',
      avatarUrl: format === 'png' ? blobUrl : '/hitaishi-assets/characters/n01/avatar.webp', modelUrl: blobUrl, accentColor: '#6366F1',
      voicePitch: 1.05, voiceRate: 1.0, persona: `${baseName} is a custom ${format.toUpperCase()} AI companion.`, style: 'Friendly, expressive, interactive.', greetingLines: [`Custom ${format.toUpperCase()} avatar loaded!`],
    }, 0.5, 1, 0);
    stageChar.activeExpression = null;
    if (format !== 'png') stageChar.customFiles = customMap;
    setCharacter(stageChar); setCharDropdownOpen(false); setSettingsOpen(false); e.target.value = '';
  };

  const handleSendMessage = (e?: React.FormEvent) => { e?.preventDefault(); const t = chatInput.trim(); if (!t) return; setChatInput(''); triggerAiResponse(t); };
  const handleChangeWorkspaceScope = (s: HitaishiWorkspaceScope) => { setWorkspaceScope(s); setSavedHitaishiScope(s); setWorkspaceSnapshot(buildHitaishiWorkspaceContextPayload(s)); };
  const filteredCatalog = useMemo(() => (selectorCategory === 'all' ? HITAISHI_CATALOG : HITAISHI_CATALOG.filter((c) => c.category === selectorCategory)), [selectorCategory]);
  const activeCatalogMeta = useMemo(() => HITAISHI_CATALOG.find((c) => c.id === character.catalogId), [character.catalogId]);

  const stageBg = activeBackground.type === 'solid' || activeBackground.type === 'gradient' || activeBackground.type === 'greenscreen' ? activeBackground.value
    : activeBackground.id === 'cozy-twilight' ? 'radial-gradient(circle at 50% 26%, #291D3F 0%, #151122 58%, #09080F 100%)'
    : activeBackground.type === 'transparent' ? 'repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 24px 24px'
    : 'linear-gradient(180deg, #1E1533 0%, #2A1C44 55%, #120E1E 100%)';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07060A] text-white select-none overflow-hidden font-sans">
      <input ref={fileInputRef} type="file" accept=".vrm,.png,.webp,.json,.livliv" onChange={handleCustomAvatarFileUpload} className="hidden" />

      <div className="relative w-full h-full sm:max-w-[490px] sm:aspect-[9/16] sm:max-h-[96dvh] sm:rounded-[36px] sm:border sm:border-white/12 sm:shadow-[0_30px_100px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col" style={{ background: stageBg }}>
        {(activeBackground.id === 'cozy-twilight' || activeBackground.id === 'cozy-night-room') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full blur-[110px] opacity-25 transition-colors duration-700" style={{ background: activeCatalogMeta?.accentColor || '#8B5CF6' }} />
            <div className="absolute right-[12%] top-[42%] w-28 h-28 rounded-full bg-amber-300/15 blur-3xl" />
            <div className="absolute left-[14%] top-[30%] w-24 h-24 rounded-full bg-purple-400/15 blur-3xl" />
          </div>
        )}

        <header className="relative z-30 h-16 px-5 pt-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onBack} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/18 backdrop-blur-2xl border border-white/15 text-white flex items-center justify-center transition-all shadow-sm cursor-pointer" title="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setCharDropdownOpen(false); setSettingsOpen(true); }} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/18 backdrop-blur-2xl border border-white/15 text-white flex items-center justify-center transition-all shadow-sm cursor-pointer" title="Companion & Workspace Settings">
              <Settings className="w-4 h-4" />
            </button>
          </div>

          <span className={`text-[18px] font-bold tracking-wider font-['Outfit'] ${isLightBackground ? 'text-zinc-900' : 'text-transparent bg-clip-text bg-gradient-to-r from-white via-white/95 to-white/70'}`}>
            hitaishi
          </span>

          <div className="flex items-center gap-2.5 relative">
            <button
              type="button"
              onClick={() => { const next = !audioMuted; setAudioMuted(next); if (next) stopCurrentSpeech(); }}
              className={`w-10 h-10 rounded-full backdrop-blur-2xl border flex items-center justify-center transition-all shadow-sm cursor-pointer ${audioMuted ? 'bg-rose-500/85 border-rose-300/50 text-white' : 'bg-white/10 hover:bg-white/18 border-white/15 text-white/90'}`}
              title={audioMuted ? 'Unmute Voice' : 'Mute Voice'}
            >
              {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => setCharDropdownOpen((o) => !o)} className="relative w-10 h-10 rounded-full ring-2 ring-white/30 hover:ring-white/75 overflow-hidden bg-zinc-900 shadow-md transition-all cursor-pointer" title={`Switch Companion (${character.name})`}>
              <img src={character.avatarUrl} alt={character.name} className="w-full h-full object-cover" />
            </button>

            <AnimatePresence>
              {charDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCharDropdownOpen(false)} />
                  <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.95 }} transition={{ type: 'spring', stiffness: 340, damping: 26 }} className="absolute right-0 top-12 z-50 w-76 sm:w-84 max-h-[70dvh] rounded-3xl bg-zinc-950/95 backdrop-blur-3xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden text-white">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wide text-white/80">Select Companion</span>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-300 hover:text-sky-200 cursor-pointer">
                        <Upload className="w-3 h-3" /><span>Import</span>
                      </button>
                    </div>
                    <div className="p-2.5 pb-1">
                      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-white/6 border border-white/10">
                        {([{ id: 'all', label: 'All' }, { id: '3d-studio', label: 'x402 / 3D' }, { id: '2.5d-half', label: 'Upper' }, { id: '2.5d-full', label: 'Full' }] as const).map((tab) => (
                          <button key={tab.id} type="button" onClick={() => setSelectorCategory(tab.id)} className={`py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${selectorCategory === tab.id ? 'bg-white text-zinc-950 font-semibold shadow-xs' : 'text-white/70 hover:text-white'}`}>
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 overflow-y-auto grid grid-cols-3 gap-2.5">
                      {filteredCatalog.map((item) => {
                        const selected = character.catalogId === item.id;
                        return (
                          <button key={item.id} type="button" onClick={() => handleSelectCatalogCharacter(item)} className={`group flex flex-col items-center p-2 rounded-2xl border transition-all cursor-pointer ${selected ? 'bg-white/15 border-white/50 shadow-md ring-1 ring-white/40' : 'bg-white/5 border-white/8 hover:bg-white/10'}`}>
                            <div className="relative w-14 h-14 rounded-full overflow-hidden mb-1.5 border border-white/15 shadow-inner bg-black">
                              <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              {selected && <span className="absolute inset-0 bg-black/35 flex items-center justify-center"><Check className="w-4 h-4 text-white" /></span>}
                            </div>
                            <span className="text-[11px] font-semibold text-white truncate max-w-full">{item.name}</span>
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

        <div className="absolute inset-0 z-10 pointer-events-none" onClick={() => setCharDropdownOpen(false)}>
          <HitaishiAvatarCanvas character={character} speechClip={speechClip} />
        </div>

        <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none z-20" />

        <div className="mt-auto relative z-30 px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-2 flex flex-col gap-3.5">
          {(cooldownSeconds > 0 || micStatusError) && (
            <div className="mx-auto px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-xl border border-white/15 text-xs text-amber-200 flex items-center gap-2 shadow-lg">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{cooldownSeconds > 0 ? `Rate limit cooldown: ${cooldownSeconds}s remaining` : micStatusError}</span>
              {micStatusError && <button type="button" onClick={() => setMicStatusError(null)} className="text-white/60 hover:text-white ml-1 cursor-pointer"><X className="w-3 h-3" /></button>}
            </div>
          )}

          <AnimatePresence mode="wait">
            {captionsEnabled && (interimTranscript || isGeneratingTurn || character.currentSubtitle || liveDuplexActive) && (
              <motion.div key={interimTranscript ? 'interim' : isGeneratingTurn ? 'thinking' : character.currentSubtitle} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="px-2 text-center pointer-events-none">
                {interimTranscript ? (
                  <p className="text-sm sm:text-[15px] font-medium text-emerald-300 italic leading-snug drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">“{interimTranscript}...”</p>
                ) : isGeneratingTurn ? (
                  <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-2xl border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
                    <span className="inline-flex items-center gap-[3px] h-3.5" aria-hidden="true">
                      {[0, 1, 2, 3].map((bar) => (
                        <motion.span
                          key={bar}
                          className="w-[3px] rounded-full bg-gradient-to-t from-sky-400 via-violet-400 to-fuchsia-300"
                          animate={{ height: ['5px', '14px', '6px', '12px', '5px'], opacity: [0.55, 1, 0.7, 1, 0.55] }}
                          transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut', delay: bar * 0.14 }}
                        />
                      ))}
                    </span>
                    <span className="text-xs sm:text-[13px] font-medium tracking-wide text-white/90">
                      {character.name} is thinking
                    </span>
                  </div>
                ) : (
                  <p className="text-[15px] sm:text-base font-medium text-white leading-snug tracking-[0.01em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] max-w-[95%] mx-auto">{character.currentSubtitle}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSendMessage} className="flex items-center gap-2.5 w-full">
            <div className="flex-1 h-13 rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 focus-within:border-white/45 focus-within:bg-white/15 pl-5 pr-2 flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all">
              <input
                type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={cooldownSeconds > 0}
                placeholder={cooldownSeconds > 0 ? `Rate limit cooldown (${cooldownSeconds}s)...` : liveDuplexActive ? isListeningMic ? micAutoEndCountdown !== null ? `Listening... auto-ends in ${micAutoEndCountdown}s` : `Listening to you... Speak or type` : `Starting microphone...` : `Type to ${character.name}...`}
                className="flex-1 bg-transparent text-sm font-medium text-white placeholder:text-white/50 focus:outline-none min-w-0"
              />
              {chatInput.trim() ? (
                <button type="submit" disabled={isGeneratingTurn || cooldownSeconds > 0} className="w-9 h-9 rounded-full bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-950 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shrink-0 shadow-sm" title="Send">
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              ) : character.isSpeaking ? (
                <button type="button" onClick={stopCurrentSpeech} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0" title="Stop speaking">
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : null}
            </div>

            <button
              type="button" onClick={handleToggleLiveDuplex}
              style={liveDuplexActive ? { boxShadow: `0 0 ${14 + Math.round(micVolumeLevel * 28)}px rgba(16, 185, 129, ${0.45 + micVolumeLevel * 0.45})` } : undefined}
              className={`relative w-13 h-13 rounded-full backdrop-blur-3xl border flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-[0_10px_32px_rgba(0,0,0,0.45)] ${liveDuplexActive ? 'bg-emerald-500/90 border-emerald-300/80 text-white ring-4 ring-emerald-400/30' : 'bg-white/10 hover:bg-white/18 border-white/20 text-white/90'}`}
              title={liveDuplexActive ? 'Tap to finish speaking or stop Live Mic' : 'Start Live Voice Conversation'}
              aria-label={liveDuplexActive ? 'Stop Live Microphone' : 'Start Live Microphone'}
            >
              {liveDuplexActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
          </form>
        </div>

        <AnimatePresence>
          {settingsOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSettingsOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs" />
              <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 340, damping: 32 }} className="fixed inset-y-0 left-0 z-50 w-[340px] max-w-[92vw] bg-[#0c0c0e]/96 backdrop-blur-2xl border-r border-white/[0.1] text-white flex flex-col overflow-hidden shadow-[24px_0_64px_rgba(0,0,0,0.75)]">
                <div className="px-5 pt-4 pb-3 border-b border-white/[0.08] space-y-3.5 shrink-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={character.avatarUrl} alt={character.name} className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0 bg-black" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold tracking-tight truncate">{character.name}</div>
                        <div className="text-[11px] text-zinc-400 truncate">Companion &amp; Workspaces</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close drawer" className="size-8 rounded-lg hover:bg-white/[0.08] text-zinc-400 hover:text-white inline-flex items-center justify-center cursor-pointer transition-colors shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.05] border border-white/[0.07]">
                    {(['workspaces', 'voice', 'stage'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setDrawerSection(t)} className={`min-h-[34px] rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${drawerSection === t ? 'bg-white text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'}`}>{t}</button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {drawerSection === 'workspaces' && (
                    <div className="space-y-5">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-zinc-400">Active Context</span>
                          <span className="text-[11px] text-zinc-500 tabular-nums">{syncToWorkspaces ? 'Synced' : 'Read-only'}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                          {([['all', 'All'], ['study', 'Study'], ['chat', 'Chats'], ['sidechat', 'Tasks']] as const).map(([id, label]) => (
                            <button key={id} type="button" onClick={() => handleChangeWorkspaceScope(id)} className={`min-h-[32px] rounded-lg text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${workspaceScope === id ? 'bg-white text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
                          ))}
                        </div>
                      </div>

                      {workspaceScope === 'all' && (
                        <div className="space-y-3">
                          <div className="divide-y divide-white/[0.07] rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                            {[
                              { Icon: BookOpen, sub: 'Study Space', val: workspaceSnapshot.activeStudySpace?.title || 'No active study space', actLabel: 'Open', onAct: onOpenStudySpace ? () => { setSettingsOpen(false); onOpenStudySpace(); } : undefined },
                              { Icon: MessageSquare, sub: 'Chat Threads', val: workspaceSnapshot.activeChatThread?.title || (workspaceSnapshot.recentThreads.length > 0 ? `${workspaceSnapshot.recentThreads.length} recent ${workspaceSnapshot.recentThreads.length === 1 ? 'thread' : 'threads'}` : 'No saved threads'), actLabel: workspaceSnapshot.recentThreads.length > 0 ? 'View' : undefined, onAct: () => handleChangeWorkspaceScope('chat') },
                              { Icon: Layers, sub: 'SideChat Tasks', val: workspaceSnapshot.sideChatTasks.length > 0 ? `${workspaceSnapshot.sideChatTasks.length} ${workspaceSnapshot.sideChatTasks.length === 1 ? 'task' : 'tasks'}` : 'No active tasks', actLabel: 'Open', onAct: onOpenSideChat ? () => { setSettingsOpen(false); onOpenSideChat(); } : undefined },
                            ].map(({ Icon, sub, val, actLabel, onAct }) => (
                              <div key={sub} className="px-3.5 py-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                                  <div className="min-w-0"><div className="text-[11px] text-zinc-500">{sub}</div><div className="text-xs font-medium text-white truncate tabular-nums">{val}</div></div>
                                </div>
                                {onAct && actLabel && <button type="button" onClick={onAct} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-300 hover:text-white shrink-0 cursor-pointer"><span>{actLabel}</span>{actLabel === 'Open' && <ArrowUpRight className="w-3 h-3" />}</button>}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              ['Quiz Study Space', 'Quiz me on one key question or flashcard from my active Study Space right now.'],
                              ['Summarize Notes', 'Give me a concise spoken summary of what I am studying in my active Study Space.'],
                              ['Recap Main Chat', 'Summarize what we have been discussing in my active Main Chat thread.'],
                              ['Check Tasks', 'Give me a brief status update on my parallel tasks in SideChat.'],
                            ] as const).map(([label, prompt]) => (
                              <button key={label} type="button" onClick={() => { setSettingsOpen(false); triggerAiResponse(prompt); }} className="min-h-[38px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] font-medium text-zinc-200 text-left transition-colors cursor-pointer">{label}</button>
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
                                  <div className="min-w-0"><div className="text-xs font-semibold text-white truncate">{workspaceSnapshot.activeStudySpace.title}</div><div className="text-[11px] text-zinc-400 capitalize mt-0.5">{workspaceSnapshot.activeStudySpace.sourceType} workspace</div></div>
                                  {onOpenStudySpace && <button type="button" onClick={() => { setSettingsOpen(false); onOpenStudySpace(); }} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-300 hover:text-white shrink-0 cursor-pointer"><span>Open</span><ArrowUpRight className="w-3 h-3" /></button>}
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.07] text-[11px] tabular-nums">
                                  <div><div className="text-zinc-500">Cards</div><div className="font-semibold text-white">{workspaceSnapshot.activeStudySpace.flashcards.length}</div></div>
                                  <div><div className="text-zinc-500">Quiz</div><div className="font-semibold text-white">{workspaceSnapshot.activeStudySpace.quizQuestions.length}</div></div>
                                  <div><div className="text-zinc-500">Notes</div><div className="font-semibold text-white">{workspaceSnapshot.activeStudySpace.userNotes.trim() ? 'Active' : 'Empty'}</div></div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => { setSettingsOpen(false); triggerAiResponse(`Quiz me verbally on "${workspaceSnapshot.activeStudySpace?.title}". Ask one sharp question at a time.`); }} className="min-h-[38px] px-3 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-[11px] font-semibold transition-colors cursor-pointer">Start Verbal Quiz</button>
                                <button type="button" onClick={() => { setSettingsOpen(false); triggerAiResponse(`Summarize the key takeaways and notes from my Study Space "${workspaceSnapshot.activeStudySpace?.title}".`); }} className="min-h-[38px] px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] font-medium text-zinc-200 transition-colors cursor-pointer">Summarize Notes</button>
                              </div>
                            </>
                          ) : (
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-2.5">
                              <div className="text-xs font-medium text-white">No Study Space opened yet</div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">Open a lesson, PDF, or topic in Study Space and it will appear here for live voice review and quizzes.</p>
                              {onOpenStudySpace && <button type="button" onClick={() => { setSettingsOpen(false); onOpenStudySpace(); }} className="min-h-[36px] px-3.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"><span>Open Study Space</span><ArrowUpRight className="w-3.5 h-3.5" /></button>}
                            </div>
                          )}
                        </div>
                      )}

                      {workspaceScope === 'chat' && (
                        <div className="space-y-2.5">
                          {workspaceSnapshot.recentThreads.length > 0 ? (
                            <div className="divide-y divide-white/[0.07] rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                              {workspaceSnapshot.recentThreads.slice(0, 5).map((th) => (
                                <button key={th.id} type="button" onClick={() => { setSettingsOpen(false); triggerAiResponse(`Recap and continue discussing my chat thread titled "${th.title}".`); }} className="w-full px-3.5 py-2.5 text-left hover:bg-white/[0.05] transition-colors cursor-pointer">
                                  <div className="text-xs font-medium text-white truncate">{th.title}</div>
                                  {th.lastMessagePreview && <div className="text-[11px] text-zinc-400 truncate mt-0.5">{th.lastMessagePreview}</div>}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-1.5"><div className="text-xs font-medium text-white">No recent chat threads</div><p className="text-[11px] text-zinc-400 leading-relaxed">Conversations from Main Chat automatically sync here once you start chatting.</p></div>
                          )}
                        </div>
                      )}

                      {workspaceScope === 'sidechat' && (
                        <div className="space-y-3">
                          {workspaceSnapshot.sideChatTasks.length > 0 ? (
                            <div className="divide-y divide-white/[0.07] rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
                              {workspaceSnapshot.sideChatTasks.slice(0, 5).map((task) => (
                                <button key={task.id} type="button" onClick={() => { setSettingsOpen(false); triggerAiResponse(`Give me a concise spoken briefing on my SideChat task "${task.title}".`); }} className="w-full px-3.5 py-2.5 text-left hover:bg-white/[0.05] transition-colors cursor-pointer flex items-center justify-between gap-2">
                                  <div className="min-w-0"><div className="text-xs font-medium text-white truncate">{task.title}</div><div className="text-[11px] text-zinc-500 capitalize">{task.status}</div></div>
                                  <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 space-y-2.5">
                              <div className="text-xs font-medium text-white">No parallel tasks active</div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">Run parallel research or background prompts in SideChat to monitor and discuss them here.</p>
                              {onOpenSideChat && <button type="button" onClick={() => { setSettingsOpen(false); onOpenSideChat(); }} className="min-h-[36px] px-3.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"><span>Open SideChat</span><ArrowUpRight className="w-3.5 h-3.5" /></button>}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="pt-4 border-t border-white/[0.08]"><SwitchRow title="Sync to Study & Chat" subtitle="Mirror companion replies across workspaces" checked={syncToWorkspaces} onToggle={() => setSyncToWorkspaces((v) => !v)} /></div>
                      <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-400 tabular-nums">
                        <span className="capitalize font-medium text-zinc-300">{rateLimitInfo.plan} plan</span>
                        <span>{rateLimitInfo.plan === 'fire' || rateLimitInfo.dailyLimit >= 999999 ? 'Unlimited daily · ' : `${rateLimitInfo.dailyRemaining} / ${rateLimitInfo.dailyLimit} today · `}{rateLimitInfo.remainingPerMinute}/{rateLimitInfo.limitPerMinute} rpm</span>
                      </div>
                    </div>
                  )}

                  {drawerSection === 'voice' && (
                    <div className="space-y-5">
                      <SwitchRow title="Bottom Captions" subtitle="Display live subtitles below companion" checked={captionsEnabled} onToggle={() => setCaptionsEnabled((v) => !v)} />
                      {([
                        ['Voice Volume', `${Math.round(character.voiceVolume * 100)}%`, 0, 1, 0.05, character.voiceVolume, (v: number) => updateCharacter({ voiceVolume: v })],
                        ['Voice Speed', `${character.voiceSpeed.toFixed(1)}x`, 0.7, 1.4, 0.1, character.voiceSpeed, (v: number) => updateCharacter({ voiceSpeed: v })],
                      ] as const).map(([label, display, min, max, step, val, onChg], idx) => (
                        <div key={label} className={`space-y-2 ${idx === 0 ? 'pt-3 border-t border-white/[0.08]' : ''}`}>
                          <div className="flex items-center justify-between text-xs"><span className="text-zinc-300 font-medium">{label}</span><span className="font-mono text-[11px] text-zinc-400 tabular-nums">{display}</span></div>
                          <input type="range" min={min} max={max} step={step} aria-label={label} value={val} onChange={(e) => onChg(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full accent-white bg-white/12 cursor-pointer" />
                        </div>
                      ))}
                      <div className="space-y-2 pt-3 border-t border-white/[0.08]">
                        <label htmlFor="hitaishi-voice-lang" className="block text-xs font-medium text-zinc-300">Voice &amp; Subtitle Language</label>
                        <div className="relative">
                          <select id="hitaishi-voice-lang" value={character.voiceLanguage || 'english'} onChange={(e) => updateCharacter({ voiceLanguage: e.target.value })} className="w-full h-10 pl-3.5 pr-9 rounded-xl bg-white/[0.05] border border-white/[0.1] text-xs font-medium text-white appearance-none focus:outline-none focus:border-white/35 cursor-pointer">
                            {VOICE_LANGUAGES.map(([v, label]) => <option key={v} value={v} className="bg-zinc-900 text-white">{label}</option>)}
                          </select>
                          <ChevronDown className="w-4 h-4 text-zinc-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>
                  )}

                  {drawerSection === 'stage' && (
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div className="text-[11px] font-medium text-zinc-400">Stage Framing</div>
                        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                          {([['frame', 'Close'], ['knee', 'Knee'], ['whole', 'Full']] as const).map(([id, label]) => (
                            <button key={id} type="button" onClick={() => updateCharacter({ fit: id, zoom: id === 'whole' ? 0.92 : 1.0, offsetY: id === 'whole' ? -0.04 : 0 })} className={`min-h-[34px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${character.fit === id ? 'bg-white text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-white'}`}>{label}</button>
                          ))}
                        </div>
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-xs"><span className="text-zinc-300 font-medium">Zoom</span><span className="font-mono text-[11px] text-zinc-400 tabular-nums">{Math.round(character.zoom * 100)}%</span></div>
                          <input type="range" min="0.7" max="1.8" step="0.05" aria-label="Stage Zoom" value={character.zoom} onChange={(e) => updateCharacter({ zoom: parseFloat(e.target.value) })} className="w-full h-1.5 rounded-full accent-white bg-white/12 cursor-pointer" />
                        </div>
                        <SwitchRow title="Mirror horizontally" checked={character.flipHorizontal} onToggle={() => updateCharacter({ flipHorizontal: !character.flipHorizontal })} />
                      </div>

                      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
                        <div className="text-[11px] font-medium text-zinc-400">Expressions</div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {([[null, 'Calm'], ['smile', 'Happy'], ['shy', 'Shy'], ['playful', 'Playful'], ['angry', 'Fiery'], ['sad', 'Sad']] as const).map(([id, label]) => (
                            <button key={id || 'neutral'} type="button" onClick={() => updateCharacter({ activeExpression: id })} className={`min-h-[36px] rounded-xl text-xs font-medium transition-colors cursor-pointer border ${character.activeExpression === id ? 'bg-white text-zinc-950 border-white font-semibold' : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-zinc-300'}`}>{label}</button>
                          ))}
                        </div>
                        <div className="text-[11px] font-medium text-zinc-400 pt-1">Gestures</div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {(['nod', 'shake', 'tilt', 'hop', 'shy'] as const).map((act) => (
                            <button key={act} type="button" onClick={() => updateCharacter({ activeExpression: act === 'shy' ? 'shy' : character.activeExpression, activeAction: { id: act, seq: Date.now() } })} className="min-h-[36px] rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] font-medium text-zinc-200 capitalize cursor-pointer transition-colors">{act}</button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-4 border-t border-white/[0.08]">
                        <div className="flex items-center justify-between text-[11px]"><span className="font-medium text-zinc-400">Scene</span><span className="text-zinc-200 font-medium">{activeBackground.label}</span></div>
                        <div className="grid grid-cols-6 gap-2.5">
                          {HITAISHI_BACKGROUNDS.map((bg) => (
                            <button key={bg.id} type="button" onClick={() => setBackgroundId(bg.id)} title={bg.label} aria-label={bg.label} style={{ background: bg.type === 'transparent' ? 'repeating-conic-gradient(#52525b 0% 25%, #27272a 0% 50%) 50% / 10px 10px' : bg.swatch }} className={`w-8 h-8 rounded-full border transition-transform cursor-pointer ${backgroundId === bg.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0c0c0e] scale-105 border-white' : 'border-white/20 hover:scale-105'}`} />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-4 border-t border-white/[0.08]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-zinc-400">Persona</span>
                          {chatHistory.length > 0 && <button type="button" onClick={() => { setChatHistory([]); saveHitaishiHistory([]); }} className="text-[11px] text-rose-400 hover:underline cursor-pointer">Clear Memory</button>}
                        </div>
                        <textarea rows={3} value={character.persona} onChange={(e) => updateCharacter({ persona: e.target.value })} className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] p-3 text-xs text-zinc-200 focus:outline-none focus:border-white/35 leading-relaxed resize-none" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full min-h-[40px] rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white flex items-center justify-center gap-2 cursor-pointer transition-colors">
                          <Upload className="w-3.5 h-3.5 text-zinc-300" /><span>Import Custom .VRM / .LIVLIV</span>
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
