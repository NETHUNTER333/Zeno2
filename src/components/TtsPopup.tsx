import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Loader2, Volume2, ChevronDown, Check } from 'lucide-react';
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
        className={`w-full max-w-sm p-4 rounded-xl border shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150 ${
          isDark
            ? 'bg-[#121215] border-white/10 text-white'
            : 'bg-white border-neutral-200 text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 opacity-80" />
            <span className="font-semibold text-xs">Read Aloud</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopSmallestSpeech();
              onClose();
            }}
            className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Gender & Language Selector */}
        <div className="grid grid-cols-2 gap-2">
          {/* Segmented Gender Control */}
          <div
            className={`grid grid-cols-2 gap-1 p-0.5 rounded-lg border ${
              isDark ? 'bg-black/30 border-white/10' : 'bg-neutral-100 border-neutral-200'
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
                  className={`py-1 rounded text-xs font-medium transition-colors cursor-pointer capitalize ${
                    active
                      ? isDark
                        ? 'bg-white text-black'
                        : 'bg-black text-white'
                      : isDark
                      ? 'text-neutral-400 hover:text-white'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>

          {/* Language Dropdown */}
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setIsLangMenuOpen((prev) => !prev)}
              aria-expanded={isLangMenuOpen}
              className={`w-full h-full flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/[0.04] border-white/10 text-white hover:bg-white/[0.08]'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-900 hover:bg-neutral-200'
              }`}
            >
              <span className="truncate">{selectedLanguageObj.label}</span>
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>

            {isLangMenuOpen && (
              <div
                role="listbox"
                className={`absolute right-0 top-full mt-1.5 w-48 max-h-56 overflow-y-auto p-1 rounded-lg border shadow-xl z-50 ${
                  isDark
                    ? 'bg-[#18181c] border-white/10 text-white'
                    : 'bg-white border-neutral-200 text-neutral-900'
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
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? isDark
                              ? 'bg-white/10 font-semibold'
                              : 'bg-neutral-200 font-semibold'
                            : isDark
                            ? 'hover:bg-white/5 text-neutral-300'
                            : 'hover:bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        <span className="truncate">{lang.label}</span>
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[11px] font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Speed
          </span>
          <div className="flex items-center gap-1">
            {TTS_PLAYBACK_SPEEDS.map((spd) => {
              const active = ttsSpeed === spd;
              return (
                <button
                  key={spd}
                  type="button"
                  onClick={() => handleSpeedChange(spd)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    active
                      ? isDark
                        ? 'bg-white text-black font-semibold'
                        : 'bg-black text-white font-semibold'
                      : isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                      : 'text-neutral-600 hover:text-black hover:bg-neutral-200'
                  }`}
                >
                  {spd}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Play Action Button */}
        <button
          type="button"
          onClick={handlePlayToggle}
          className={`w-full h-9 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            isDark
              ? 'bg-white text-black hover:bg-neutral-200'
              : 'bg-black text-white hover:bg-neutral-800'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading audio…</span>
            </>
          ) : isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>Play</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
