import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Music,
  Subtitles,
  MessageSquarePlus,
  Send,
  Loader2,
  Check,
  Trash2,
  Globe,
  ExternalLink,
  AlertCircle,
  Link2,
  Clock,
} from 'lucide-react';
import { apiFetch, INSTACLOUD_ZENO_API_ORIGIN } from '../../lib/apiBase';
import { getAuthHeaders } from '../../lib/firebase';
import { speakTextWithSmallestAi, stopSmallestSpeech } from '../../lib/smallestAi';
import { ExplainerCanvas } from './ExplainerCanvas';
import {
  ExplainerExportMixer,
  ExplainerMusicEngine,
  createCanvasVideoRecorder,
  downloadBlob,
} from './explainerAudio';
import {
  STARTER_EXPLAINER_PROJECT,
  type ExplainerProject,
  type ExplainerScene,
  type ExplainerStyle,
  type ReviewComment,
} from './types';

export type ExportFormat = 'both' | 'mp4' | 'mp3';

interface VideoExplainerStudioProps {
  isDark?: boolean;
  initialPrompt?: string;
  exportRequest?: { seq: number; format: ExportFormat };
  onExportStateChange?: (exporting: boolean) => void;
}

const STORAGE_PROJECTS_KEY = 'kinich_explainer_projects_v1';

const STYLES: ReadonlyArray<{ id: ExplainerStyle; label: string }> = [
  { id: 'motion', label: 'Motion' },
  { id: 'illustrated', label: 'Illustrated' },
  { id: '3d', label: '3D' },
];

const DURATION_PRESETS: ReadonlyArray<{ sec: number; label: string }> = [
  { sec: 60, label: '1m' },
  { sec: 180, label: '3m' },
  { sec: 300, label: '5m' },
  { sec: 600, label: '10m' },
];

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const VideoExplainerStudio: React.FC<VideoExplainerStudioProps> = ({
  isDark = true,
  initialPrompt = '',
  exportRequest,
  onExportStateChange,
}) => {
  const [topic, setTopic] = useState(initialPrompt || '');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [showSourcesDrawer, setShowSourcesDrawer] = useState(false);
  const [style, setStyle] = useState<ExplainerStyle>('motion');
  const [targetDurationSec, setTargetDurationSec] = useState<number>(600);
  const [webGrounded, setWebGrounded] = useState(true);
  const [railTab, setRailTab] = useState<'scenes' | 'notes'>('scenes');

  const [project, setProject] = useState<ExplainerProject>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_PROJECTS_KEY) || 'null');
      if (saved?.scenes?.length) return saved;
    } catch {}
    return STARTER_EXPLAINER_PROJECT;
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Playback & synced audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);

  // Frame-pinned review comments
  const [pinMode, setPinMode] = useState(false);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [pendingPin, setPendingPin] = useState<{
    sceneId: string;
    sceneTitle: string;
    timeSec: number;
    xPct: number;
    yPct: number;
  } | null>(null);
  const [draftCommentText, setDraftCommentText] = useState('');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const musicRef = useRef<ExplainerMusicEngine | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsBlobCacheRef = useRef<Map<string, string>>(new Map());
  const ttsInflightRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const voicePlayingSceneRef = useRef<string | null>(null);
  const voiceDoneSceneRef = useRef<string | null>(null);
  const voiceBusyRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const lastExportSeqRef = useRef<number>(exportRequest?.seq ?? 0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    onExportStateChange?.(isExporting);
  }, [isExporting, onExportStateChange]);

  const totalDuration = useMemo(
    () => Math.max(1, project.scenes.reduce((acc, s) => acc + Math.max(1, s.durationSec), 0)),
    [project.scenes]
  );

  const sceneOffsets = useMemo(() => {
    let acc = 0;
    return project.scenes.map((s) => {
      const start = acc;
      const dur = Math.max(1, s.durationSec);
      acc += dur;
      return { scene: s, start, end: acc, duration: dur };
    });
  }, [project.scenes]);

  const activeSceneEntry = useMemo(
    () => sceneOffsets.find((o) => currentTime < o.end) || sceneOffsets[sceneOffsets.length - 1],
    [sceneOffsets, currentTime]
  );

  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    return (project.sources || [])
      .filter((s) => {
        if (!s?.domain || seen.has(s.domain)) return false;
        seen.add(s.domain);
        return true;
      })
      .slice(0, 3);
  }, [project.sources]);

  useEffect(() => {
    if (initialPrompt) setTopic(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(project));
    } catch {}
  }, [project]);

  const prefetchSceneAudio = useCallback(async (scene: ExplainerScene): Promise<string | null> => {
    const text = String(scene.narration || '').trim();
    if (!text) return null;
    const cacheKey = `${scene.id}:${text}`;
    const existing = ttsBlobCacheRef.current.get(cacheKey);
    if (existing) return existing;
    const pending = ttsInflightRef.current.get(cacheKey);
    if (pending) return pending;

    const job = (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ text, language: 'english', gender: 'female', speed: 1 }),
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob || blob.size < 200) return null;
        const url = URL.createObjectURL(blob);
        ttsBlobCacheRef.current.set(cacheKey, url);
        return url;
      } catch {
        return null;
      } finally {
        ttsInflightRef.current.delete(cacheKey);
      }
    })();

    ttsInflightRef.current.set(cacheKey, job);
    return job;
  }, []);

  const stopAllAudio = useCallback(() => {
    voiceBusyRef.current = false;
    voicePlayingSceneRef.current = null;
    voiceDoneSceneRef.current = null;
    setActiveWordIndex(-1);
    if (ttsAudioRef.current) {
      try {
        ttsAudioRef.current.onended = null;
        ttsAudioRef.current.onerror = null;
        ttsAudioRef.current.ontimeupdate = null;
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      } catch {}
    }
    stopSmallestSpeech();
    musicRef.current?.stop();
  }, []);

  useEffect(() => {
    if (project.scenes[0]) void prefetchSceneAudio(project.scenes[0]);
    if (project.scenes[1]) void prefetchSceneAudio(project.scenes[1]);
  }, [project, prefetchSceneAudio]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopAllAudio();
      ttsBlobCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      ttsBlobCacheRef.current.clear();
    };
  }, [stopAllAudio]);

  const playSceneVoiceover = useCallback(
    async (scene: ExplainerScene, nextScene?: ExplainerScene) => {
      const text = String(scene.narration || '').trim();
      if (!text || !voiceEnabled || !isPlayingRef.current) return;

      voicePlayingSceneRef.current = scene.id;
      voiceDoneSceneRef.current = null;
      voiceBusyRef.current = true;
      setActiveWordIndex(0);

      if (nextScene) void prefetchSceneAudio(nextScene);

      const words = text.split(/\s+/).filter(Boolean);
      const audioUrl = await prefetchSceneAudio(scene);

      if (!isPlayingRef.current || voicePlayingSceneRef.current !== scene.id) {
        voiceBusyRef.current = false;
        return;
      }

      if (audioUrl) {
        try {
          if (!ttsAudioRef.current) ttsAudioRef.current = new Audio();
          const audio = ttsAudioRef.current;
          audio.pause();
          audio.src = audioUrl;
          audio.currentTime = 0;
          audio.ontimeupdate = () => {
            if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
            const ratio = Math.min(0.999, audio.currentTime / audio.duration);
            setActiveWordIndex(Math.floor(ratio * words.length));
          };
          audio.onended = () => {
            voiceBusyRef.current = false;
            voiceDoneSceneRef.current = scene.id;
          };
          audio.onerror = () => {
            voiceBusyRef.current = false;
            voiceDoneSceneRef.current = scene.id;
          };
          await audio.play();
          return;
        } catch {
          // Fall through cleanly
        }
      }

      if (!isPlayingRef.current || voicePlayingSceneRef.current !== scene.id) {
        voiceBusyRef.current = false;
        return;
      }

      void speakTextWithSmallestAi(
        text,
        'english',
        () => {
          voiceBusyRef.current = true;
        },
        () => {
          voiceBusyRef.current = false;
          voiceDoneSceneRef.current = scene.id;
        },
        () => {
          voiceBusyRef.current = false;
          voiceDoneSceneRef.current = scene.id;
        },
        'female',
        undefined,
        1,
        (prog) => setActiveWordIndex(prog.wordIndex)
      );
    },
    [prefetchSceneAudio, voiceEnabled]
  );

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      stopAllAudio();
      return;
    }

    if (musicEnabled) {
      if (!musicRef.current) musicRef.current = new ExplainerMusicEngine();
      musicRef.current.start(project.musicMood || 'editorial', voiceEnabled ? 0.09 : 0.2);
    }

    lastTickRef.current = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      setCurrentTime((prev) => {
        const entry = sceneOffsets.find((o) => prev < o.end) || sceneOffsets[sceneOffsets.length - 1];
        if (!entry) return prev;
        const next = prev + dt;

        if (voiceEnabled && voiceBusyRef.current && voicePlayingSceneRef.current === entry.scene.id) {
          const holdPoint = entry.end - 0.06;
          if (next >= holdPoint) return holdPoint;
          return next;
        }

        if (
          voiceEnabled &&
          voiceDoneSceneRef.current === entry.scene.id &&
          prev - entry.start >= entry.duration * 0.72 &&
          next < entry.end
        ) {
          const fastNext = prev + dt * 2.2;
          if (fastNext >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return fastNext;
        }

        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying, musicEnabled, voiceEnabled, project.musicMood, sceneOffsets, totalDuration, stopAllAudio]);

  useEffect(() => {
    if (!isPlaying || !activeSceneEntry) return;
    const sid = activeSceneEntry.scene.id;
    if (voicePlayingSceneRef.current === sid) return;

    if (musicEnabled) musicRef.current?.playTransitionChime();
    if (voiceEnabled) {
      const idx = sceneOffsets.findIndex((o) => o.scene.id === sid);
      const nextScene = idx >= 0 ? sceneOffsets[idx + 1]?.scene : undefined;
      void playSceneVoiceover(activeSceneEntry.scene, nextScene);
    } else {
      voicePlayingSceneRef.current = sid;
      setActiveWordIndex(-1);
    }
  }, [isPlaying, activeSceneEntry, voiceEnabled, musicEnabled, sceneOffsets, playSceneVoiceover]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    try {
      if (!ttsAudioRef.current) ttsAudioRef.current = new Audio();
      ttsAudioRef.current.muted = false;
      ttsAudioRef.current.play().catch(() => {});
      ttsAudioRef.current.pause();
    } catch {}

    setPinMode(false);
    setPendingPin(null);
    if (currentTime >= totalDuration - 0.15) {
      setCurrentTime(0);
    }
    setIsPlaying(true);
  }, [isPlaying, currentTime, totalDuration]);

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanTopic = topic.trim();
    if (!cleanTopic && !sourceUrl.trim() && !sourceText.trim()) return;

    setIsPlaying(false);
    setIsGenerating(true);
    setError(null);
    setStatusNotice(null);

    const payload = JSON.stringify({
      topic: cleanTopic,
      sourceUrl: sourceUrl.trim(),
      sourceText: sourceText.trim(),
      style,
      webGrounded,
      targetDurationSec,
    });

    try {
      let resp = await apiFetch('/api/video/explainer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (resp.status === 404) {
        resp = await fetch(`${INSTACLOUD_ZENO_API_ORIGIN}/api/video/explainer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: payload,
        });
      }
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success || !data?.project?.scenes?.length) {
        throw new Error(data?.error || `Could not create explainer (${resp.status})`);
      }
      ttsBlobCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      ttsBlobCacheRef.current.clear();
      setProject(data.project);
      setStyle(data.project.style);
      setComments([]);
      setPendingPin(null);
      setCurrentTime(0);
      const durSum = data.project.scenes.reduce((a: number, s: ExplainerScene) => a + (s.durationSec || 8), 0);
      setStatusNotice(`Ready · ${data.project.scenes.length} scenes · ${formatTime(durSum)}`);
    } catch (err: any) {
      setError(err?.message || 'Unable to generate explainer video right now.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddPinnedComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPin || !draftCommentText.trim()) return;
    const item: ReviewComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      ...pendingPin,
      text: draftCommentText.trim(),
      resolved: false,
      createdAt: Date.now(),
    };
    setComments((prev) => [...prev, item]);
    setSelectedCommentId(item.id);
    setPendingPin(null);
    setDraftCommentText('');
    setPinMode(false);
    setRailTab('notes');
  };

  const handleApplyRevisions = async () => {
    const open = comments.filter((c) => !c.resolved);
    if (open.length === 0 || isRevising) return;
    setIsPlaying(false);
    setIsRevising(true);
    setError(null);
    setStatusNotice(null);

    try {
      const payload = JSON.stringify({ project, comments: open });
      let resp = await apiFetch('/api/video/explainer/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (resp.status === 404) {
        resp = await fetch(`${INSTACLOUD_ZENO_API_ORIGIN}/api/video/explainer/revise`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: payload,
        });
      }
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success || !data?.project?.scenes?.length) {
        throw new Error(data?.error || `Revision failed (${resp.status})`);
      }
      ttsBlobCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      ttsBlobCacheRef.current.clear();
      setProject(data.project);
      setComments((prev) => prev.map((c) => ({ ...c, resolved: true })));
      setStatusNotice(`Applied ${open.length} ${open.length === 1 ? 'note' : 'notes'}`);
    } catch (err: any) {
      setError(err?.message || 'Could not apply review comments right now.');
    } finally {
      setIsRevising(false);
    }
  };

  // Full combined render & export: bakes Canvas HD video + live TTS voiceover + optional music into MP4 and/or MP3
  const handleExportVideo = useCallback(
    async (format: ExportFormat = 'both') => {
      if (!canvasRef.current || isExporting) return;
      setIsPlaying(false);
      stopAllAudio();
      setIsExporting(true);
      setError(null);
      setStatusNotice('Preparing voiceover audio…');

      const mixer = new ExplainerExportMixer();
      try {
        // 1. Pre-fetch & decode all scene TTS voiceovers into Web Audio buffers
        const decodedBuffers = new Map<string, AudioBuffer>();
        if (voiceEnabled) {
          for (let i = 0; i < project.scenes.length; i++) {
            const sc = project.scenes[i];
            setStatusNotice(`Preparing audio (${i + 1}/${project.scenes.length})…`);
            const url = await prefetchSceneAudio(sc);
            if (url) {
              const buf = await mixer.decodeAudioUrl(url);
              if (buf) decodedBuffers.set(sc.id, buf);
            }
          }
        }

        // 2. Start optional background score mixed into the same destination
        if (musicEnabled) {
          mixer.startMusic(project.musicMood || 'editorial', voiceEnabled ? 0.1 : 0.22);
        }

        const recorder = createCanvasVideoRecorder(canvasRef.current, mixer.getStream());
        setCurrentTime(0);
        setActiveWordIndex(-1);
        recorder.start();

        // 3. Render every scene in sequence, playing its decoded voiceover into the mixed stream & syncing captions
        for (let i = 0; i < sceneOffsets.length; i++) {
          const entry = sceneOffsets[i];
          const voiceBuf = decodedBuffers.get(entry.scene.id);
          const renderDuration = voiceBuf
            ? Math.max(entry.duration, voiceBuf.duration + 0.35)
            : entry.duration;
          const words = String(entry.scene.narration || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

          setStatusNotice(`Recording scene ${i + 1}/${sceneOffsets.length}…`);
          if (voiceBuf) mixer.playVoiceBuffer(voiceBuf);

          const sceneStartMs = performance.now();
          await new Promise<void>((resolve) => {
            const step = (now: number) => {
              const localSec = (now - sceneStartMs) / 1000;
              if (localSec >= renderDuration) {
                setCurrentTime(entry.end - 0.01);
                resolve();
                return;
              }
              const clampedProgress = Math.min(0.995, localSec / renderDuration);
              setCurrentTime(entry.start + clampedProgress * entry.duration);
              if (voiceBuf && words.length > 0) {
                const wRatio = Math.min(0.999, localSec / Math.max(0.2, voiceBuf.duration));
                setActiveWordIndex(Math.floor(wRatio * words.length));
              }
              requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          });
        }

        setCurrentTime(totalDuration);
        setActiveWordIndex(-1);
        const recordedWebm = await recorder.stopAndGetBlob();
        mixer.close();

        const safeName =
          project.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'explainer-video';

        const transcodeAndDownload = async (target: 'mp4' | 'mp3') => {
          setStatusNotice(`Encoding ${target.toUpperCase()}…`);
          const res = await fetch(`/api/video/transcode?format=${target}`, {
            method: 'POST',
            headers: { 'Content-Type': recordedWebm.type || 'video/webm' },
            body: recordedWebm,
          });
          if (!res.ok) throw new Error(`Transcode to ${target.toUpperCase()} failed`);
          const outBlob = await res.blob();
          downloadBlob(outBlob, `${safeName}.${target}`);
        };

        let exportedList: string[] = [];
        try {
          if (format === 'mp4' || format === 'both') {
            await transcodeAndDownload('mp4');
            exportedList.push('.mp4');
          }
          if (format === 'mp3' || format === 'both') {
            await transcodeAndDownload('mp3');
            exportedList.push('.mp3');
          }
          setStatusNotice(`Exported ${safeName} (${exportedList.join(' + ')})`);
        } catch {
          // Clean fallback to combined WebM if server transcode is unavailable
          downloadBlob(recordedWebm, `${safeName}.webm`);
          setStatusNotice(`Exported ${safeName}.webm (combined video + audio)`);
        }
      } catch (err: any) {
        mixer.close();
        setError(err?.message || 'Video export is not supported in this browser.');
      } finally {
        setIsExporting(false);
      }
    },
    [
      isExporting,
      musicEnabled,
      prefetchSceneAudio,
      project.musicMood,
      project.scenes,
      project.title,
      sceneOffsets,
      stopAllAudio,
      totalDuration,
      voiceEnabled,
    ]
  );

  useEffect(() => {
    const reqSeq = exportRequest?.seq ?? 0;
    if (reqSeq !== lastExportSeqRef.current) {
      lastExportSeqRef.current = reqSeq;
      void handleExportVideo(exportRequest?.format || 'both');
    }
  }, [exportRequest, handleExportVideo]);

  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const bdr = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const subtleBg = isDark ? 'bg-white/[0.03]' : 'bg-black/[0.025]';
  const primaryBtn = isDark
    ? 'bg-white text-black hover:bg-neutral-200'
    : 'bg-neutral-950 text-white hover:bg-neutral-800';
  const pillIdle = isDark
    ? 'border border-white/10 bg-white/[0.04] text-neutral-300 hover:text-white hover:bg-white/[0.1]'
    : 'border border-black/10 bg-black/[0.03] text-neutral-600 hover:text-black hover:bg-black/[0.07]';
  const pillActive = isDark
    ? 'border border-white/25 bg-white text-black font-semibold'
    : 'border border-black/20 bg-neutral-950 text-white font-semibold';

  const openCommentsCount = comments.filter((c) => !c.resolved).length;

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* Main Full-Page Stage Column */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-y-auto slim-scrollbar">
        <div className="w-full max-w-[960px] mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">
          {/* 16:9 HD Stage */}
          <ExplainerCanvas
            project={project}
            currentTime={currentTime}
            isPlaying={isPlaying || isExporting}
            showCaptions={showCaptions}
            activeWordIndex={voiceEnabled && (isPlaying || isExporting) ? activeWordIndex : undefined}
            comments={comments}
            pinMode={pinMode}
            selectedCommentId={selectedCommentId}
            canvasRef={canvasRef}
            onTogglePlay={handleTogglePlay}
            onCanvasPin={(pin) => {
              setIsPlaying(false);
              setPendingPin(pin);
              setRailTab('notes');
            }}
            onSelectComment={(id) => {
              setSelectedCommentId(id);
              setRailTab('notes');
              const found = comments.find((c) => c.id === id);
              if (found) setCurrentTime(found.timeSec);
            }}
          />

          {/* Pill-Shaped Single-Row Transport + Media Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={isExporting}
                className={`h-9 px-4 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors disabled:opacity-45 ${primaryBtn}`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
                aria-label="Restart"
                title="Restart"
                className={`size-9 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer ${pillIdle}`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <span className={`text-xs font-mono tabular-nums pl-1 ${muted}`}>
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVoiceEnabled((v) => !v)}
                aria-label="Toggle voiceover"
                title={voiceEnabled ? 'Voiceover on' : 'Voiceover muted'}
                className={`h-8 px-3 rounded-full text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  voiceEnabled ? pillActive : pillIdle
                }`}
              >
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Voice</span>
              </button>
              <button
                type="button"
                onClick={() => setMusicEnabled((v) => !v)}
                aria-label="Toggle background music"
                title={musicEnabled ? 'Score on' : 'Score off'}
                className={`h-8 px-3 rounded-full text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  musicEnabled ? pillActive : pillIdle
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Score</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCaptions((v) => !v)}
                aria-label="Toggle captions"
                title={showCaptions ? 'Captions on' : 'Captions off'}
                className={`h-8 px-3 rounded-full text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showCaptions ? pillActive : pillIdle
                }`}
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Captions</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setPinMode((v) => !v);
                }}
                aria-label="Pin frame comment"
                title="Pin a review comment on this frame"
                className={`h-8 px-3 rounded-full text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  pinMode ? 'bg-sky-400 text-slate-950 font-semibold border border-sky-300' : pillIdle
                }`}
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>{pinMode ? 'Cancel' : 'Pin'}</span>
              </button>
            </div>
          </div>

          {/* Sleek Segmented Scene Scrub Timeline */}
          <div className="flex gap-1 h-8 overflow-x-auto no-scrollbar">
            {sceneOffsets.map((o, idx) => {
              const isCurrent = activeSceneEntry?.scene.id === o.scene.id;
              const pct = (o.duration / totalDuration) * 100;
              const localPct = isCurrent
                ? Math.max(0, Math.min(100, ((currentTime - o.start) / o.duration) * 100))
                : currentTime >= o.end
                ? 100
                : 0;
              const pinCount = comments.filter((c) => c.sceneId === o.scene.id).length;

              return (
                <button
                  key={o.scene.id}
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    voicePlayingSceneRef.current = null;
                    setCurrentTime(o.start + ratio * o.duration);
                  }}
                  style={{ width: `${Math.max(pct, 6)}%`, minWidth: sceneOffsets.length > 10 ? '42px' : undefined }}
                  title={`${o.scene.title} (${o.duration}s)`}
                  className={`relative rounded-full border overflow-hidden px-2.5 flex items-center justify-between text-[10.5px] font-mono tabular-nums transition-colors cursor-pointer shrink-0 ${
                    isCurrent
                      ? isDark
                        ? 'border-white/40 bg-white/12 text-white'
                        : 'border-black/40 bg-black/10 text-black'
                      : isDark
                      ? 'border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.07]'
                      : 'border-black/10 bg-black/[0.025] text-neutral-600 hover:bg-black/[0.06]'
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 opacity-20 pointer-events-none"
                    style={{ width: `${localPct}%`, backgroundColor: o.scene.accentColor }}
                  />
                  <span className="relative truncate">{String(idx + 1).padStart(2, '0')}</span>
                  {pinCount > 0 && <span className="relative text-amber-400 font-bold">{pinCount}</span>}
                </button>
              );
            })}
          </div>

          {/* Clean Pill-Framed Director Composer */}
          <form onSubmit={(e) => void handleGenerate(e)} className={`pt-3 border-t space-y-2.5 ${bdr}`}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Describe any topic, product, or paper to direct a video (up to 10 min)…"
                className={`flex-1 h-10 rounded-full border px-4 text-sm outline-none transition-colors ${
                  isDark
                    ? 'bg-white/[0.04] border-white/14 text-white placeholder:text-neutral-500 focus:border-white/35'
                    : 'bg-white border-black/14 text-neutral-950 placeholder:text-neutral-400 focus:border-black/35'
                }`}
              />
              <button
                type="submit"
                disabled={isGenerating || isExporting || (!topic.trim() && !sourceUrl.trim() && !sourceText.trim())}
                className={`h-10 px-5 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 transition-colors ${primaryBtn}`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating…</span>
                  </>
                ) : (
                  <span>Create</span>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {STYLES.map((st) => {
                  const active = style === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setStyle(st.id);
                        setProject((p) => ({ ...p, style: st.id }));
                      }}
                      className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        active ? pillActive : pillIdle
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}

                <span className={`mx-0.5 ${muted}`} aria-hidden="true">·</span>

                <span className={`inline-flex items-center gap-1 text-[11px] ${muted}`}>
                  <Clock className="w-3 h-3" />
                </span>
                {DURATION_PRESETS.map((d) => {
                  const active = targetDurationSec === d.sec;
                  return (
                    <button
                      key={d.sec}
                      type="button"
                      onClick={() => setTargetDurationSec(d.sec)}
                      className={`h-7 px-2.5 rounded-full text-[11px] font-mono tabular-nums whitespace-nowrap transition-colors cursor-pointer ${
                        active ? pillActive : pillIdle
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}

                <span className={`mx-0.5 ${muted}`} aria-hidden="true">·</span>

                <button
                  type="button"
                  onClick={() => setWebGrounded((v) => !v)}
                  className={`h-7 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                    webGrounded
                      ? isDark
                        ? 'border border-sky-400/35 text-sky-300 bg-sky-500/15'
                        : 'border border-sky-500/35 text-sky-700 bg-sky-500/10'
                      : pillIdle
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>Web</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSourcesDrawer((v) => !v)}
                  className={`h-7 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                    showSourcesDrawer ? pillActive : pillIdle
                  }`}
                >
                  <Link2 className="w-3 h-3" />
                  <span>URL / Notes</span>
                </button>
              </div>

              {statusNotice && !error && (
                <span className={`text-[11px] font-mono tabular-nums ${muted}`}>{statusNotice}</span>
              )}
            </div>

            {showSourcesDrawer && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="Source URL (docs, article, repo)…"
                  className={`h-9 rounded-full border px-3.5 text-xs outline-none ${
                    isDark ? 'bg-white/[0.04] border-white/12 text-white placeholder:text-neutral-500' : 'bg-white border-black/12 text-black'
                  }`}
                />
                <input
                  type="text"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Optional pasted notes or outline…"
                  className={`h-9 rounded-full border px-3.5 text-xs outline-none ${
                    isDark ? 'bg-white/[0.04] border-white/12 text-white placeholder:text-neutral-500' : 'bg-white border-black/12 text-black'
                  }`}
                />
              </div>
            )}
          </form>

          {error && (
            <div className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {uniqueSources.length > 0 && (
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${muted}`}>
              <span>Sources:</span>
              {uniqueSources.map((src) => (
                <a
                  key={src.domain}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <span>{src.domain}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Full-Height Editorial Rail: Scenes & Pinned Review Notes */}
      <aside className={`w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l flex flex-col min-h-0 ${bdr} ${subtleBg}`}>
        <div className={`px-4 h-12 border-b flex items-center justify-between shrink-0 ${bdr}`}>
          <div className="flex items-center gap-1.5">
            {([
              ['scenes', `Scenes (${project.scenes.length})`],
              ['notes', `Notes (${openCommentsCount})`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRailTab(id)}
                className={`h-7 px-3 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  railTab === id ? pillActive : pillIdle
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={`text-[11px] font-mono tabular-nums ${muted}`}>{formatTime(totalDuration)}</span>
        </div>

        <div className="flex-1 overflow-y-auto slim-scrollbar p-4 space-y-3">
          {pendingPin && (
            <form onSubmit={handleAddPinnedComment} className={`p-3 rounded-2xl border space-y-2 ${isDark ? 'bg-sky-500/10 border-sky-400/35' : 'bg-sky-50 border-sky-300'}`}>
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                <span className="font-semibold truncate">{pendingPin.sceneTitle}</span>
                <span>@{formatTime(pendingPin.timeSec)}</span>
              </div>
              <textarea
                rows={2}
                autoFocus
                value={draftCommentText}
                onChange={(e) => setDraftCommentText(e.target.value)}
                placeholder="What should change on this frame?"
                className={`w-full rounded-xl border px-3 py-2 text-xs outline-none resize-none ${
                  isDark ? 'bg-[#09090b] border-white/15 text-white' : 'bg-white border-black/15 text-black'
                }`}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPendingPin(null);
                    setDraftCommentText('');
                  }}
                  className={`h-7 px-3 rounded-full text-[11px] cursor-pointer ${pillIdle}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!draftCommentText.trim()}
                  className={`h-7 px-3.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 ${primaryBtn}`}
                >
                  <Send className="w-3 h-3" />
                  <span>Pin</span>
                </button>
              </div>
            </form>
          )}

          {railTab === 'scenes' ? (
            <div className={`divide-y ${isDark ? 'divide-white/[0.06]' : 'divide-black/[0.06]'}`}>
              {sceneOffsets.map((o, idx) => {
                const isCurrent = activeSceneEntry?.scene.id === o.scene.id;
                return (
                  <button
                    key={o.scene.id}
                    type="button"
                    onClick={() => {
                      voicePlayingSceneRef.current = null;
                      setCurrentTime(o.start);
                    }}
                    className={`w-full text-left py-3 first:pt-0 transition-opacity cursor-pointer ${
                      isCurrent ? 'opacity-100' : 'opacity-65 hover:opacity-95'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums mb-1">
                      <span style={{ color: isCurrent ? o.scene.accentColor : undefined }} className="font-semibold">
                        {String(idx + 1).padStart(2, '0')} · {formatTime(o.start)}
                      </span>
                      <span className={muted}>{o.duration}s</span>
                    </div>
                    <div className="text-xs font-semibold leading-snug">{o.scene.title}</div>
                    <p className={`text-[11.5px] leading-relaxed mt-1 ${muted}`}>{o.scene.narration}</p>
                  </button>
                );
              })}
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-2.5">
              {comments.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCommentId(c.id);
                    setCurrentTime(c.timeSec);
                  }}
                  className={`p-3 rounded-2xl border transition-colors cursor-pointer ${
                    c.id === selectedCommentId
                      ? isDark
                        ? 'bg-white/[0.08] border-white/25'
                        : 'bg-black/[0.06] border-black/25'
                      : isDark
                      ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05]'
                      : 'bg-white border-black/10 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10.5px] font-mono tabular-nums">
                    <span className="font-semibold">
                      #{idx + 1} · {formatTime(c.timeSec)} · {c.resolved ? 'Applied' : 'Open'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setComments((prev) => prev.filter((item) => item.id !== c.id));
                      }}
                      aria-label="Delete note"
                      className={`${muted} hover:text-red-400 cursor-pointer`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs mt-1 leading-snug">{c.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className={`py-8 text-center text-xs ${muted}`}>
              Tap <strong>Pin</strong> above the timeline to leave frame-specific feedback.
            </div>
          )}
        </div>

        {comments.length > 0 && (
          <div className={`p-3 border-t shrink-0 ${bdr}`}>
            <button
              type="button"
              disabled={openCommentsCount === 0 || isRevising}
              onClick={() => void handleApplyRevisions()}
              className={`w-full h-9 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors ${primaryBtn}`}
            >
              {isRevising ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying edits…</span>
                </>
              ) : openCommentsCount === 0 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>All notes applied</span>
                </>
              ) : (
                <span>Apply {openCommentsCount} {openCommentsCount === 1 ? 'Note' : 'Notes'}</span>
              )}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
