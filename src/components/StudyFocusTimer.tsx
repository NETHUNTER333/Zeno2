import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, Volume2, VolumeX } from 'lucide-react';

interface StudyFocusTimerProps {
  isDark: boolean;
}

type FocusPresetId = 'focus_25' | 'deep_50' | 'sprint_15' | 'break_5';

interface FocusPreset {
  id: FocusPresetId;
  label: string;
  minutes: number;
  isBreak?: boolean;
}

const FOCUS_PRESETS: FocusPreset[] = [
  { id: 'focus_25', label: '25m Focus', minutes: 25 },
  { id: 'deep_50', label: '50m Deep Work', minutes: 50 },
  { id: 'sprint_15', label: '15m Sprint', minutes: 15 },
  { id: 'break_5', label: '5m Break', minutes: 5, isBreak: true },
];

const STORAGE_KEY = 'kinich_study_focus_stats_v1';

interface DailyFocusStats {
  dateKey: string;
  minutes: number;
  sessions: number;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function loadDailyStats(): DailyFocusStats {
  const today = getTodayKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.dateKey === today) {
        return {
          dateKey: today,
          minutes: Number(parsed.minutes) || 0,
          sessions: Number(parsed.sessions) || 0,
        };
      }
    }
  } catch {}
  return { dateKey: today, minutes: 0, sessions: 0 };
}

function playGentleChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5 soft triad
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.14 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.8);
    });
  } catch {}
}

export const StudyFocusTimer: React.FC<StudyFocusTimerProps> = ({ isDark }) => {
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState<FocusPresetId>('focus_25');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stats, setStats] = useState<DailyFocusStats>(() => loadDailyStats());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activePreset = FOCUS_PRESETS.find((p) => p.id === presetId) || FOCUS_PRESETS[0];

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          if (soundEnabled) playGentleChime();
          if (!activePreset.isBreak) {
            setStats((curr) => {
              const today = getTodayKey();
              const base = curr.dateKey === today ? curr : { dateKey: today, minutes: 0, sessions: 0 };
              const next: DailyFocusStats = {
                dateKey: today,
                minutes: base.minutes + activePreset.minutes,
                sessions: base.sessions + 1,
              };
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
              } catch {}
              return next;
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, soundEnabled, activePreset]);

  const selectPreset = (next: FocusPreset) => {
    setRunning(false);
    setPresetId(next.id);
    setSecondsLeft(next.minutes * 60);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const totalSec = activePreset.minutes * 60;
  const pct = Math.min(100, Math.max(0, Math.round(((totalSec - secondsLeft) / Math.max(1, totalSec)) * 100)));

  const divider = isDark ? 'border-white/[0.08]' : 'border-black/[0.08]';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const primaryBtn = isDark
    ? 'bg-white text-black hover:bg-neutral-200'
    : 'bg-black text-white hover:bg-neutral-800';
  const ghostBtn = isDark
    ? 'border-white/[0.12] text-neutral-200 hover:bg-white/[0.06]'
    : 'border-black/[0.12] text-neutral-800 hover:bg-black/[0.05]';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-8 px-2.5 sm:px-3 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap active:scale-95 ${
          running
            ? isDark
              ? 'bg-white text-black border-white font-semibold'
              : 'bg-black text-white border-black font-semibold'
            : isDark
            ? 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.1] text-neutral-200'
            : 'bg-black/[0.03] hover:bg-black/[0.07] border-black/[0.1] text-neutral-800'
        }`}
        title="Study Focus Timer"
        aria-label="Study Focus Timer"
      >
        <Timer className="w-3 h-3 shrink-0" />
        <span className={running ? 'font-mono tabular-nums' : ''}>
          {running || secondsLeft !== totalSec ? formatted : 'Focus'}
        </span>
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-2 w-72 rounded-2xl border p-4 z-50 shadow-2xl space-y-4 ${
            isDark
              ? 'bg-[#141418] border-white/[0.12] text-neutral-100'
              : 'bg-white border-black/[0.12] text-neutral-900'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold tracking-tight">Focus Session</div>
              <div className={`text-xs ${muted}`}>
                Today: {stats.minutes}m · {stats.sessions} {stats.sessions === 1 ? 'session' : 'sessions'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              aria-label={soundEnabled ? 'Mute completion chime' : 'Enable completion chime'}
              className={`size-8 rounded-xl border inline-flex items-center justify-center cursor-pointer ${ghostBtn}`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Preset Selector */}
          <div className="grid grid-cols-2 gap-1.5">
            {FOCUS_PRESETS.map((p) => {
              const active = p.id === presetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className={`h-8 px-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? isDark
                        ? 'bg-white text-black font-semibold'
                        : 'bg-black text-white font-semibold'
                      : isDark
                      ? 'bg-white/[0.05] text-neutral-300 hover:bg-white/[0.1]'
                      : 'bg-black/[0.04] text-neutral-700 hover:bg-black/[0.08]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Large Tabular Countdown Display */}
          <div className={`py-4 rounded-xl border text-center space-y-2.5 ${divider}`}>
            <div className="text-4xl font-mono font-semibold tracking-tight tabular-nums">
              {formatted}
            </div>
            <div className="px-4">
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
                <div
                  className={`h-full transition-[width] duration-300 ${isDark ? 'bg-white' : 'bg-black'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (secondsLeft === 0) {
                  setSecondsLeft(activePreset.minutes * 60);
                  setRunning(true);
                } else {
                  setRunning((r) => !r);
                }
              }}
              className={`flex-1 h-9 rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${primaryBtn}`}
            >
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{running ? 'Pause' : secondsLeft === 0 ? 'Restart' : 'Start'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setSecondsLeft(activePreset.minutes * 60);
              }}
              aria-label="Reset timer"
              className={`size-9 rounded-xl border inline-flex items-center justify-center cursor-pointer ${ghostBtn}`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
