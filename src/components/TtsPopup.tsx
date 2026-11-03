import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Loader2, Volume2, ChevronDown, Check, Gauge } from 'lucide-react';
import {
  speakTextWithSmallestAi,
  stopSmallestSpeech,
  TTS_LANGUAGES,
  TTS_PLAYBACK_SPEEDS,
  TtsVoiceGender,
  TtsPlaybackSpeed,
  getSavedTtsLanguage,
  setSavedTtsLanguage,
  getSavedTtsGender,
  setSavedTtsGender,
  getSavedTtsSpeed,
  setSavedTtsSpeed,
  setActiveTtsPlaybackSpeed,
} from '../lib/smallestAi';

interface TtsPopupProps {
  text: string;
  onClose: () => void;
  isDark?: boolean;
}

export const TtsPopup: React.FC<TtsPopupProps> = ({ text, onClose, isDark = true }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ttsLang, setTtsLang] = useState<string>(() => getSavedTtsLanguage());
  const [ttsGender, setTtsGender] = useState<TtsVoiceGender>(() => getSavedTtsGender());
  const [ttsSpeed, setTtsSpeed] = useState<TtsPlaybackSpeed>(() => getSavedTtsSpeed());
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      stopSmallestSpeech();
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLangMenuOpen) {
          setIsLangMenuOpen(false);
        } else {
          stopSmallestSpeech();
          onClose();
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLangMenuOpen, onClose]);

  const selectedLanguageObj =
    TTS_LANGUAGES.find((l) => l.code === ttsLang) || TTS_LANGUAGES[0];

  const startSpeech = (
    langOverride?: string,
    genderOverride?: TtsVoiceGender,
    speedOverride?: TtsPlaybackSpeed
  ) => {
    stopSmallestSpeech();
    setIsPlaying(false);
    setLoading(true);
    speakTextWithSmallestAi(
      text,
      langOverride ?? ttsLang,
      () => {
        setLoading(false);
        setIsPlaying(true);
      },
      () => {
        setLoading(false);
        setIsPlaying(false);
      },
      () => {
        setLoading(false);
        setIsPlaying(false);
      },
      genderOverride ?? ttsGender,
      undefined,
      speedOverride ?? ttsSpeed
    );
  };

  const handleSpeedChange = (newSpeed: TtsPlaybackSpeed) => {
    setTtsSpeed(newSpeed);
    setSavedTtsSpeed(newSpeed);
    setActiveTtsPlaybackSpeed(newSpeed);
    // If browser speechSynthesis fallback is currently speaking, restart at the new speed
    if (
      isPlaying &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      window.speechSynthesis.speaking
    ) {
      startSpeech(ttsLang, ttsGender, newSpeed);
    }
  };

  const handlePlayToggle = () => {
    if (isPlaying || loading) {
      stopSmallestSpeech();
      setIsPlaying(false);
      setLoading(false);
      return;
    }
    startSpeech(ttsLang, ttsGender, ttsSpeed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm p-5 rounded-2xl border shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
          isDark
            ? 'bg-[#121215] border-white/[0.12] text-white'
            : 'bg-white border-black/[0.1] text-[#0d0d0d]'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`size-7 rounded-lg flex items-center justify-center border ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.08] text-white'
                  : 'bg-black/[0.04] border-black/[0.08] text-black'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Read Aloud</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopSmallestSpeech();
              onClose();
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-white/[0.08] text-neutral-400 hover:text-white'
                : 'hover:bg-black/[0.06] text-neutral-500 hover:text-black'
            }`}
            aria-label="Close Read Aloud"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Voice Gender & Padded Custom Language Selector */}
        <div className="grid grid-cols-2 gap-2.5 mb-3.5">
          {/* Segmented Gender Control */}
          <div
            className={`grid grid-cols-2 gap-1 p-1 rounded-xl border ${
              isDark ? 'bg-[#18181c] border-white/[0.08]' : 'bg-[#f4f4f5] border-black/[0.08]'
            }`}
          >
            {(['female', 'male'] as TtsVoiceGender[]).map((g) => {
              const active = ttsGender === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setTtsGender(g);
                    setSavedTtsGender(g);
                    if (isPlaying || loading) {
                      startSpeech(ttsLang, g, ttsSpeed);
                    }
                  }}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? isDark
                        ? 'bg-white text-black shadow-xs'
                        : 'bg-[#0d0d0d] text-white shadow-xs'
                      : isDark
                      ? 'text-neutral-400 hover:text-white'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  {g === 'female' ? 'Female' : 'Male'}
                </button>
              );
            })}
          </div>

          {/* Custom Padded Language Dropdown (Replaces Native Browser <select>) */}
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setIsLangMenuOpen((prev) => !prev)}
              aria-expanded={isLangMenuOpen}
              aria-haspopup="listbox"
              className={`w-full h-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#18181c] hover:bg-[#1f1f24] border-white/[0.08] text-white'
                  : 'bg-[#f4f4f5] hover:bg-[#eaeaea] border-black/[0.08] text-[#0d0d0d]'
              }`}
            >
              <span className="truncate">{selectedLanguageObj.label}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                  isLangMenuOpen ? 'rotate-180' : ''
                } ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}
              />
            </button>

            {isLangMenuOpen && (
              <div
                role="listbox"
                className={`absolute right-0 top-full mt-2 w-56 max-h-64 overflow-y-auto p-1.5 rounded-xl border shadow-2xl z-50 scrollbar-thin animate-in fade-in zoom-in-95 duration-100 ${
                  isDark
                    ? 'bg-[#16161a] border-white/[0.12] text-white shadow-[0_16px_40px_rgba(0,0,0,0.85)]'
                    : 'bg-white border-black/[0.1] text-[#0d0d0d] shadow-[0_16px_40px_rgba(0,0,0,0.14)]'
                }`}
              >
                <div className="space-y-0.5">
                  {TTS_LANGUAGES.map((lang) => {
                    const isSelected = lang.code === ttsLang;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setTtsLang(lang.code);
                          setSavedTtsLanguage(lang.code);
                          setIsLangMenuOpen(false);
                          if (isPlaying || loading) {
                            startSpeech(lang.code, ttsGender, ttsSpeed);
                          }
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? isDark
                              ? 'bg-white/[0.1] text-white font-semibold'
                              : 'bg-black/[0.07] text-black font-semibold'
                            : isDark
                            ? 'text-neutral-300 hover:bg-white/[0.05] hover:text-white'
                            : 'text-neutral-700 hover:bg-black/[0.04] hover:text-black'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{lang.label}</span>
                          <span
                            className={`text-[10px] font-mono truncate ${
                              isDark ? 'text-neutral-500' : 'text-neutral-400'
                            }`}
                          >
                            {lang.nativeLabel}
                          </span>
                        </div>
                        {isSelected && (
                          <Check
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isDark ? 'text-white' : 'text-black'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Playback Speed Control Slider (0.5x, 1x, 1.5x, 2x) */}
        <div
          className={`p-3 rounded-xl border mb-3.5 ${
            isDark ? 'bg-[#18181c] border-white/[0.08]' : 'bg-[#f8f8f9] border-black/[0.08]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Gauge
                className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}
              />
              <span
                className={`text-xs font-medium ${
                  isDark ? 'text-neutral-300' : 'text-neutral-700'
                }`}
              >
                Playback Speed
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-[#FC4C01]">{ttsSpeed}x</span>
          </div>

          <input
            type="range"
            min={0.5}
            max={2}
            step={0.5}
            value={ttsSpeed}
            aria-label="Playback speed"
            onChange={(e) => {
              const val = Number(e.target.value);
              const snapped: TtsPlaybackSpeed =
                val <= 0.6 ? 0.5 : val <= 1.2 ? 1 : val <= 1.7 ? 1.5 : 2;
              handleSpeedChange(snapped);
            }}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#FC4C01] bg-neutral-700/40 mb-2.5"
          />

          <div className="grid grid-cols-4 gap-1.5">
            {TTS_PLAYBACK_SPEEDS.map((spd) => {
              const active = ttsSpeed === spd;
              return (
                <button
                  key={spd}
                  type="button"
                  onClick={() => handleSpeedChange(spd)}
                  className={`py-1 rounded-lg text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                    active
                      ? isDark
                        ? 'bg-white text-black shadow-xs'
                        : 'bg-[#0d0d0d] text-white shadow-xs'
                      : isDark
                      ? 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                      : 'bg-black/[0.04] text-neutral-600 hover:text-black hover:bg-black/[0.08]'
                  }`}
                >
                  {spd}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Play / Load Action Row */}
        <div
          className={`flex items-center gap-3.5 p-3.5 rounded-xl border ${
            isDark ? 'bg-[#18181c] border-white/[0.08]' : 'bg-[#f8f8f9] border-black/[0.08]'
          }`}
        >
          <button
            type="button"
            onClick={handlePlayToggle}
            className={`size-10 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              isDark
                ? 'bg-white text-black hover:bg-neutral-200'
                : 'bg-[#0d0d0d] text-white hover:bg-neutral-800'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold truncate">
                {loading
                  ? 'Synthesizing speech...'
                  : isPlaying
                  ? 'Playing audio'
                  : 'Ready to read aloud'}
              </span>
              <span
                className={`text-[10px] font-mono uppercase ${
                  isDark ? 'text-neutral-500' : 'text-neutral-400'
                }`}
              >
                {selectedLanguageObj.label} · {ttsGender} · {ttsSpeed}x
              </span>
            </div>
            <span
              className={`text-[11px] truncate mt-0.5 ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              {loading
                ? `Preparing ${selectedLanguageObj.label} voice output`
                : isPlaying
                ? 'Click pause to stop playback'
                : 'Click play to listen in selected voice'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
