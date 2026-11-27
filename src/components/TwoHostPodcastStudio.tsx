import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  FileText,
  Loader2,
  Mic2,
  Volume2,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../lib/apiBase';
import { getAuthHeaders } from '../lib/firebase';
import { UserAccountStore } from '../lib/userAccountStore';

export type PodcastStyle = 'deep_dive' | 'exam_cram' | 'debate' | 'story';
export type PodcastLength = 'short' | 'standard' | 'extended';

export interface PodcastTurn {
  index: number;
  speaker: 'Alex' | 'Maya';
  speakerDisplayName: string;
  text: string;
  cue?: string;
  startSec: number;
  endSec: number;
}

export interface PodcastChapter {
  title: string;
  turnIndex: number;
}

export interface GeneratedPodcastEpisode {
  episodeTitle: string;
  summary: string;
  style: PodcastStyle;
  length: PodcastLength;
  language: string;
  hosts: {
    Alex: { name: string; voice: string; role: string };
    Maya: { name: string; voice: string; role: string };
  };
  chapters: PodcastChapter[];
  turns: PodcastTurn[];
  durationSec: number;
  audioUrl: string | null;
  engine: string;
  audioError?: string | null;
}

export interface TwoHostPodcastStudioProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  sourceTitle?: string;
  sourceContent?: string;
  defaultLanguage?: string;
  onAskTutor?: (prompt: string) => void;
}

const STYLE_OPTIONS: Array<{ id: PodcastStyle; label: string; desc: string }> = [
  { id: 'deep_dive', label: 'Deep Dive', desc: 'Intuition & analogies' },
  { id: 'exam_cram', label: 'Exam Cram', desc: 'High-yield traps' },
  { id: 'debate', label: 'Debate', desc: 'Two perspectives' },
  { id: 'story', label: 'Story Mode', desc: 'Narrative flow' },
];

const LENGTH_OPTIONS: Array<{ id: PodcastLength; label: string }> = [
  { id: 'short', label: 'Quick · 1.5m' },
  { id: 'standard', label: 'Standard · 3m' },
  { id: 'extended', label: 'Extended · 4.5m' },
];

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function base64ToWavUrl(base64: string, mimeType = 'audio/wav'): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export const TwoHostPodcastStudio: React.FC<TwoHostPodcastStudioProps> = ({
  isOpen,
  onClose,
  isDark = false,
  sourceTitle = '',
  sourceContent = '',
  defaultLanguage,
  onAskTutor,
}) => {
  const [topicDraft, setTopicDraft] = useState(sourceTitle);
  const [notesDraft, setNotesDraft] = useState(sourceContent);
  const [style, setStyle] = useState<PodcastStyle>('deep_dive');
  const [length, setLength] = useState<PodcastLength>('standard');
  const [language, setLanguage] = useState<string>(
    () => defaultLanguage || UserAccountStore.getPreferredStudyLanguage() || 'English'
  );
  const [focusPrompt, setFocusPrompt] = useState('');

  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [episode, setEpisode] = useState<GeneratedPodcastEpisode | null>(null);

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Browser SpeechSynthesis dual-voice fallback state (only used when server TTS returns script-only)
  const [fallbackTurnIndex, setFallbackTurnIndex] = useState<number | null>(null);
  const fallbackCancelledRef = useRef(false);
  const activeTurnRef = useRef<HTMLButtonElement | null>(null);

  const hasPreloadedSource = Boolean(sourceContent && sourceContent.trim().length >= 30);

  // Sync source inputs whenever opened on a new study source
  useEffect(() => {
    if (isOpen) {
      setTopicDraft(sourceTitle || '');
      setNotesDraft(sourceContent || '');
      if (defaultLanguage) setLanguage(defaultLanguage);
    }
  }, [isOpen, sourceTitle, sourceContent, defaultLanguage]);

  // Cleanup audio & speech on unmount or close
  const stopAllPlayback = () => {
    fallbackCancelledRef.current = true;
    setFallbackTurnIndex(null);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // ignore
      }
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopAllPlayback();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopAllPlayback();
      if (episode?.audioUrl) {
        URL.revokeObjectURL(episode.audioUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, episode?.audioUrl]);

  const activeTurnIdx = useMemo(() => {
    if (!episode || episode.turns.length === 0) return -1;
    if (!episode.audioUrl && fallbackTurnIndex !== null) {
      return fallbackTurnIndex;
    }
    const found = episode.turns.findIndex(
      (t) => currentTime >= t.startSec && currentTime < t.endSec
    );
    if (found !== -1) return found;
    if (currentTime > 0 && currentTime >= (episode.turns[episode.turns.length - 1]?.startSec || 0)) {
      return episode.turns.length - 1;
    }
    return 0;
  }, [episode, currentTime, fallbackTurnIndex]);

  const activeSpeaker =
    activeTurnIdx >= 0 && episode?.turns[activeTurnIdx]
      ? episode.turns[activeTurnIdx].speaker
      : null;

  // Keep currently spoken line smoothly scrolled into view while playing
  useEffect(() => {
    if (isPlaying && activeTurnRef.current) {
      activeTurnRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeTurnIdx, isPlaying]);

  const playBrowserDualVoiceFrom = (ep: GeneratedPodcastEpisode, startIdx: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    fallbackCancelledRef.current = false;
    setIsPlaying(true);

    const voices = window.speechSynthesis.getVoices();
    const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const voiceA = enVoices[0] || voices[0] || null;
    const voiceB =
      enVoices.find((v) => v.name !== voiceA?.name && /female|samantha|victoria|google|aria|zira|kore/i.test(v.name)) ||
      enVoices[1] ||
      voices[1] ||
      voiceA;

    const speakStep = (idx: number) => {
      if (fallbackCancelledRef.current || idx >= ep.turns.length) {
        setIsPlaying(false);
        setFallbackTurnIndex(null);
        return;
      }
      const turn = ep.turns[idx];
      setFallbackTurnIndex(idx);
      setCurrentTime(turn.startSec);

      const utter = new SpeechSynthesisUtterance(turn.text);
      utter.rate = playbackRate;
      if (turn.speaker === 'Alex') {
        if (voiceA) utter.voice = voiceA;
        utter.pitch = 0.94;
      } else {
        if (voiceB) utter.voice = voiceB;
        utter.pitch = 1.08;
      }
      utter.onend = () => {
        if (!fallbackCancelledRef.current) {
          speakStep(idx + 1);
        }
      };
      utter.onerror = () => {
        if (!fallbackCancelledRef.current) {
          setIsPlaying(false);
        }
      };
      window.speechSynthesis.speak(utter);
    };

    speakStep(startIdx);
  };

  const handleGeneratePodcast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const resolvedTitle = (topicDraft || sourceTitle || 'Study Topic').trim();
    const resolvedContent = (notesDraft || sourceContent || topicDraft).trim();
    if (resolvedContent.length < 10) {
      setError('Enter a topic or paste at least a short summary to generate your 2-host podcast.');
      return;
    }

    stopAllPlayback();
    setGenerating(true);
    setError(null);
    setGenStage('Writing 2-host dialogue script (Alex & Maya)…');

    const stageTimer = setTimeout(() => {
      setGenStage('Recording multi-speaker studio audio…');
    }, 3500);

    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch('/api/study/podcast', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: resolvedTitle,
          content: resolvedContent,
          style,
          length,
          language,
          focusPrompt: focusPrompt.trim(),
        }),
      });
      clearTimeout(stageTimer);

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !Array.isArray(data?.turns)) {
        setError(data?.error || 'Could not generate the 2-host podcast. Please try again.');
        return;
      }

      // Release old blob URL
      if (episode?.audioUrl) {
        URL.revokeObjectURL(episode.audioUrl);
      }

      const audioUrl = data.audioBase64
        ? base64ToWavUrl(data.audioBase64, data.audioMimeType || 'audio/wav')
        : null;

      const built: GeneratedPodcastEpisode = {
        episodeTitle: data.episodeTitle || resolvedTitle,
        summary: data.summary || '',
        style: data.style || style,
        length: data.length || length,
        language: data.language || language,
        hosts: data.hosts || {
          Alex: { name: 'Alex', voice: 'Puck', role: 'Host' },
          Maya: { name: 'Maya', voice: 'Kore', role: 'Co-Host' },
        },
        chapters: Array.isArray(data.chapters) ? data.chapters : [],
        turns: data.turns,
        durationSec: Number(data.durationSec) || 60,
        audioUrl,
        engine: data.engine || 'gemini-3.8-flash-tts',
        audioError: data.audioError || null,
      };

      setEpisode(built);
      setCurrentTime(0);
      setDuration(built.durationSec);
    } catch (err: any) {
      clearTimeout(stageTimer);
      setError(err?.message || 'Network error while generating your 2-host podcast.');
    } finally {
      setGenerating(false);
      setGenStage('');
    }
  };

  const handleTogglePlay = async () => {
    if (!episode) return;

    if (episode.audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          audioRef.current.playbackRate = playbackRate;
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          setError('Playback was blocked by the browser. Tap Play again.');
        }
      }
      return;
    }

    // Fallback browser dual-voice mode
    if (isPlaying) {
      stopAllPlayback();
    } else {
      playBrowserDualVoiceFrom(episode, Math.max(0, activeTurnIdx));
    }
  };

  const handleSeek = (nextSec: number) => {
    if (!episode) return;
    const clamped = Math.max(0, Math.min(duration || episode.durationSec, nextSec));
    setCurrentTime(clamped);
    if (episode.audioUrl && audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  };

  const handleJumpToTurn = (turn: PodcastTurn) => {
    if (!episode) return;
    if (episode.audioUrl && audioRef.current) {
      audioRef.current.currentTime = turn.startSec;
      setCurrentTime(turn.startSec);
      if (!isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      playBrowserDualVoiceFrom(episode, turn.index);
    }
  };

  const handleDownloadAudio = () => {
    if (!episode?.audioUrl) return;
    const slug = episode.episodeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 56) || 'kinich-podcast';
    const a = document.createElement('a');
    a.href = episode.audioUrl;
    a.download = `${slug}-podcast.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadTranscript = () => {
    if (!episode) return;
    const lines = [
      `# ${episode.episodeTitle}`,
      '',
      episode.summary,
      '',
      ...episode.turns.map(
        (t) => `**[${formatClock(t.startSec)}] ${t.speakerDisplayName}:** ${t.text}`
      ),
    ];
    const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${episode.episodeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 56) || 'podcast'}-script.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!isOpen) return null;

  const surfaceBg = isDark ? 'bg-[#09090b] text-neutral-100' : 'bg-white text-neutral-950';
  const cardBg = isDark
    ? 'bg-[#121215] border-white/[0.09]'
    : 'bg-neutral-50 border-black/[0.08]';
  const borderLine = isDark ? 'border-white/[0.09]' : 'border-black/[0.08]';
  const mutedText = isDark ? 'text-neutral-400' : 'text-neutral-500';

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col md:items-center md:justify-center bg-black/70 backdrop-blur-sm md:p-6 lg:p-10"
      role="dialog"
      aria-modal="true"
      aria-label="2-Host AI Study Podcast Studio"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex flex-col w-full h-full md:h-[min(88dvh,820px)] md:max-w-3xl lg:max-w-4xl md:rounded-3xl md:border overflow-hidden shadow-2xl ${surfaceBg} ${borderLine}`}
      >
        {/* Top Studio Bar */}
        <header
          className={`shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-4 pb-3 border-b ${borderLine}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`size-9 rounded-xl border flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-white/[0.05] border-white/10 text-white'
                  : 'bg-black/[0.04] border-black/10 text-black'
              }`}
            >
              <Mic2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold tracking-tight truncate">
                2-Host Study Podcast
              </h2>
              <p className={`text-[11px] truncate ${mutedText}`}>
                Alex &amp; Maya · Dual-voice audio overview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {episode && (
              <button
                type="button"
                onClick={() => {
                  stopAllPlayback();
                  setEpisode(null);
                  setError(null);
                }}
                className={`h-9 px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isDark
                    ? 'border-white/12 bg-white/[0.04] hover:bg-white/[0.08] text-white'
                    : 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06] text-black'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Episode</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Podcast Studio"
              className={`size-9 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
                isDark
                  ? 'border-white/12 bg-white/[0.04] hover:bg-white/[0.08] text-white'
                  : 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06] text-black'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Hidden HTML5 Audio Element */}
        {episode?.audioUrl && (
          <audio
            ref={audioRef}
            src={episode.audioUrl}
            preload="auto"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />
        )}

        {/* ==================== VIEW A: EPISODE SETUP ==================== */}
        {!episode ? (
          <form
            onSubmit={handleGeneratePodcast}
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5"
          >
            {/* Source Topic / Material */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Episode Topic</label>
                <input
                  type="text"
                  value={topicDraft}
                  onChange={(e) => setTopicDraft(e.target.value)}
                  placeholder="e.g. Thermodynamics Laws, Cell Mitosis, French Revolution..."
                  className={`w-full h-11 px-3.5 rounded-xl border text-sm outline-none transition-colors ${
                    isDark
                      ? 'bg-[#121215] border-white/12 text-white placeholder:text-neutral-500 focus:border-white/30'
                      : 'bg-neutral-50 border-black/12 text-black placeholder:text-neutral-400 focus:border-black/30'
                  }`}
                />
              </div>

              {!hasPreloadedSource ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold">
                    Notes or Source Material
                  </label>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    placeholder="Paste lecture notes, textbook excerpts, or key points you want Alex and Maya to unpack..."
                    className={`w-full p-3.5 rounded-xl border text-sm leading-relaxed outline-none resize-none transition-colors ${
                      isDark
                        ? 'bg-[#121215] border-white/12 text-white placeholder:text-neutral-500 focus:border-white/30'
                        : 'bg-neutral-50 border-black/12 text-black placeholder:text-neutral-400 focus:border-black/30'
                    }`}
                  />
                </div>
              ) : (
                <div className={`rounded-xl border px-3.5 py-2.5 text-xs ${cardBg}`}>
                  <span className="font-semibold">Using active Study Space material</span>
                  <span className={`ml-1.5 ${mutedText}`}>
                    · {Math.round(sourceContent.trim().split(/\s+/).length)} words loaded
                  </span>
                </div>
              )}
            </div>

            {/* Format Style Selector */}
            <div className="space-y-2">
              <div className="text-xs font-semibold">Conversation Style</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STYLE_OPTIONS.map((opt) => {
                  const active = style === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStyle(opt.id)}
                      className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? isDark
                            ? 'bg-white text-black border-white'
                            : 'bg-black text-white border-black'
                          : isDark
                          ? 'bg-[#121215] border-white/[0.09] hover:border-white/25 text-neutral-200'
                          : 'bg-white border-black/[0.09] hover:border-black/25 text-neutral-800'
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className={`text-[11px] mt-0.5 ${active ? 'opacity-75' : mutedText}`}>
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Length + Language Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold">Episode Length</div>
                <div
                  className={`grid grid-cols-3 p-1 rounded-xl border ${
                    isDark ? 'bg-[#121215] border-white/[0.09]' : 'bg-neutral-100 border-black/[0.08]'
                  }`}
                >
                  {LENGTH_OPTIONS.map((opt) => {
                    const active = length === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLength(opt.id)}
                        className={`h-8 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          active
                            ? isDark
                              ? 'bg-white text-black'
                              : 'bg-white text-black shadow-xs'
                            : mutedText
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="podcast-lang-select" className="block text-xs font-semibold">
                  Spoken Language
                </label>
                <select
                  id="podcast-lang-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border text-xs font-medium outline-none cursor-pointer ${
                    isDark
                      ? 'bg-[#121215] border-white/12 text-white'
                      : 'bg-neutral-50 border-black/12 text-black'
                  }`}
                >
                  {['English', 'Hindi', 'Telugu', 'Tamil', 'Spanish', 'French', 'German', 'Portuguese'].map(
                    (lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* Optional Custom Focus */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">
                Custom Host Direction <span className={`font-normal ${mutedText}`}>(optional)</span>
              </label>
              <input
                type="text"
                value={focusPrompt}
                onChange={(e) => setFocusPrompt(e.target.value)}
                placeholder="e.g. Quiz each other on common mistakes, or explain like I'm preparing for a viva"
                className={`w-full h-10 px-3.5 rounded-xl border text-xs sm:text-sm outline-none transition-colors ${
                  isDark
                    ? 'bg-[#121215] border-white/12 text-white placeholder:text-neutral-500 focus:border-white/30'
                    : 'bg-neutral-50 border-black/12 text-black placeholder:text-neutral-400 focus:border-black/30'
                }`}
              />
            </div>

            {error && (
              <div
                role="alert"
                className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-start gap-2 ${
                  isDark
                    ? 'border-red-500/30 bg-red-500/10 text-red-300'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="submit"
                disabled={generating}
                className={`w-full h-12 rounded-2xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-black text-white hover:bg-neutral-800'
                }`}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{genStage || 'Generating 2-host podcast…'}</span>
                  </>
                ) : (
                  <>
                    <Mic2 className="w-4 h-4" />
                    <span>Generate 2-Host Podcast</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ==================== VIEW B: LIVE 2-HOST PLAYER + SYNCED TRANSCRIPT ==================== */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Dual Host Stage & Episode Header */}
            <div className={`shrink-0 px-4 sm:px-6 py-4 border-b space-y-4 ${borderLine}`}>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold tracking-tight leading-snug">
                  {episode.episodeTitle}
                </h3>
                {episode.summary && (
                  <p className={`text-xs leading-relaxed ${mutedText}`}>{episode.summary}</p>
                )}
              </div>

              {/* Dual Host Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {(['Alex', 'Maya'] as const).map((key) => {
                  const host = episode.hosts[key];
                  const speaking = isPlaying && activeSpeaker === key;
                  return (
                    <div
                      key={key}
                      className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-all ${
                        speaking
                          ? isDark
                            ? 'bg-white/[0.08] border-white/40'
                            : 'bg-black/[0.05] border-black/40'
                          : cardBg
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`size-9 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                            key === 'Alex'
                              ? isDark
                                ? 'bg-white text-black'
                                : 'bg-black text-white'
                              : isDark
                              ? 'bg-white/15 text-white'
                              : 'bg-black/10 text-black'
                          }`}
                        >
                          {host.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold truncate">
                            {host.name}
                          </div>
                          <div className={`text-[11px] truncate ${mutedText}`}>{host.role}</div>
                        </div>
                      </div>
                      {speaking && (
                        <Volume2 className="w-4 h-4 shrink-0 animate-pulse opacity-85" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Notice if using browser dual-voice fallback */}
              {episode.audioError && !episode.audioUrl && (
                <div
                  className={`rounded-xl border px-3 py-2 text-[11px] flex items-center gap-2 ${
                    isDark
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                      : 'border-amber-300 bg-amber-50 text-amber-900'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Studio WAV unavailable — playing with browser dual-voice synthesis.</span>
                </div>
              )}

              {/* Scrubber + Transport Controls */}
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, duration || episode.durationSec)}
                    step={0.5}
                    value={Math.min(currentTime, duration || episode.durationSec)}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    disabled={!episode.audioUrl}
                    aria-label="Podcast timeline"
                    className="w-full h-1.5 accent-current cursor-pointer disabled:opacity-50"
                  />
                  <div className={`flex items-center justify-between text-[11px] font-mono tabular-nums ${mutedText}`}>
                    <span>{formatClock(currentTime)}</span>
                    <span>{formatClock(duration || episode.durationSec)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {/* Speed Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      setPlaybackRate((prev) => {
                        const idx = SPEEDS.indexOf(prev);
                        return SPEEDS[(idx + 1) % SPEEDS.length];
                      })
                    }
                    className={`h-9 px-3 rounded-xl border text-xs font-mono font-semibold tabular-nums cursor-pointer ${
                      isDark
                        ? 'border-white/12 bg-white/[0.04] hover:bg-white/[0.08]'
                        : 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06]'
                    }`}
                    title="Playback speed"
                  >
                    {playbackRate}x
                  </button>

                  {/* Core Transport */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSeek(currentTime - 15)}
                      disabled={!episode.audioUrl}
                      className={`size-9 rounded-xl border flex items-center justify-center cursor-pointer disabled:opacity-40 ${
                        isDark
                          ? 'border-white/12 bg-white/[0.04] hover:bg-white/[0.08]'
                          : 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06]'
                      }`}
                      aria-label="Rewind 15 seconds"
                      title="Back 15s"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      aria-label={isPlaying ? 'Pause podcast' : 'Play podcast'}
                      className={`size-12 rounded-2xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer ${
                        isDark
                          ? 'bg-white text-black hover:bg-neutral-200'
                          : 'bg-black text-white hover:bg-neutral-800'
                      }`}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSeek(currentTime + 15)}
                      disabled={!episode.audioUrl}
                      className={`size-9 rounded-xl border flex items-center justify-center cursor-pointer disabled:opacity-40 ${
                        isDark
                          ? 'border-white/12 bg-white/[0.04] hover:bg-white/[0.08]'
                          : 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06]'
                      }`}
                      aria-label="Forward 15 seconds"
                      title="Forward 15s"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex items-center gap-1.5">
                    {episode.audioUrl && (
                      <button
                        type="button"
                        onClick={handleDownloadAudio}
                        className={`h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                          isDark
                            ? 'border-white/12 bg-white/[0.04] hover:bg-white/[0.08]'
                            : 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06]'
                        }`}
                        title="Download podcast audio (.wav)"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WAV</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadTranscript}
                      className={`h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                        isDark
                          ? 'border-white/12 bg-white/[0.04] hover:bg-white/[0.08]'
                          : 'border-black/10 bg-black/[0.03] hover:bg-black/[0.06]'
                      }`}
                      title="Download script (.md)"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Script</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Chapter Jump Bar */}
              {episode.chapters.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 slim-scrollbar">
                  {episode.chapters.map((ch, idx) => {
                    const targetTurn = episode.turns[ch.turnIndex];
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => targetTurn && handleJumpToTurn(targetTurn)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          isDark
                            ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300'
                            : 'border-black/10 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {String(idx + 1).padStart(2, '0')}. {ch.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Interactive Synced Transcript */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2.5 slim-scrollbar">
              {episode.turns.map((turn) => {
                const isCurrent = turn.index === activeTurnIdx;
                return (
                  <button
                    key={turn.index}
                    ref={isCurrent ? activeTurnRef : null}
                    type="button"
                    onClick={() => handleJumpToTurn(turn)}
                    className={`w-full text-left rounded-2xl border p-3.5 transition-all cursor-pointer ${
                      isCurrent
                        ? isDark
                          ? 'bg-white/[0.08] border-white/30 text-white'
                          : 'bg-black/[0.045] border-black/30 text-black'
                        : isDark
                        ? 'bg-transparent border-white/[0.07] hover:bg-white/[0.03] text-neutral-300'
                        : 'bg-transparent border-black/[0.07] hover:bg-black/[0.02] text-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold tracking-tight">
                        {turn.speakerDisplayName}
                      </span>
                      <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                        {formatClock(turn.startSec)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed">{turn.text}</p>
                  </button>
                );
              })}
            </div>

            {/* Footer Action Bar */}
            {onAskTutor && (
              <div
                className={`shrink-0 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3.5 border-t flex items-center justify-end ${borderLine}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    stopAllPlayback();
                    onAskTutor(
                      `Let's discuss this 2-host podcast episode "${episode.episodeTitle}": ${episode.summary}. Quiz me on the 3 most important takeaways.`
                    );
                  }}
                  className={`h-10 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-black text-white hover:bg-neutral-800'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Quiz Me on This Episode</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
