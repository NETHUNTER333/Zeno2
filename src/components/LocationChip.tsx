import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X, RefreshCw } from 'lucide-react';
import {
  UserLocation,
  getStoredLocationPref,
  saveStoredLocationPref,
  clearStoredLocationPref,
  requestPreciseLocationOnTap,
  setSavedHomeCity,
} from '../lib/locationStore';

interface LocationChipProps {
  isDark?: boolean;
  onLocationChange?: (loc: UserLocation | null) => void;
  className?: string;
}

export const LocationChip: React.FC<LocationChipProps> = ({
  isDark = true,
  onLocationChange,
  className = '',
}) => {
  const [pref, setPref] = useState(() => getStoredLocationPref());
  const [isOpen, setIsOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPref(getStoredLocationPref());
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleRequestGps = async () => {
    setIsLoadingGps(true);
    setErrorMsg(null);
    try {
      const loc = await requestPreciseLocationOnTap();
      const nextPref = getStoredLocationPref();
      setPref(nextPref);
      onLocationChange?.(loc);
      setIsOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Location permission denied or timed out.');
    } finally {
      setIsLoadingGps(false);
    }
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setSavedHomeCity(manualInput.trim());
    const nextPref = getStoredLocationPref();
    setPref(nextPref);
    setManualInput('');
    setIsOpen(false);
  };

  const handleTurnOff = () => {
    clearStoredLocationPref();
    setPref(getStoredLocationPref());
    onLocationChange?.(null);
    setIsOpen(false);
  };

  const chipLabel =
    pref.usePreciseLocation && pref.preciseLocation
      ? pref.preciseLocation.city
      : pref.homeCity
      ? pref.homeCity
      : 'IP Approximate';

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all cursor-pointer select-none ${
          pref.usePreciseLocation || pref.homeCity
            ? 'bg-[#FC4C01]/10 border-[#FC4C01]/30 text-[#FC4C01] hover:bg-[#FC4C01]/20'
            : isDark
            ? 'bg-white/[0.05] border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
            : 'bg-black/[0.04] border-black/10 text-neutral-600 hover:text-black hover:bg-black/[0.08]'
        }`}
        title="Location settings"
      >
        <MapPin className="w-3 h-3 shrink-0" />
        <span className="truncate max-w-[120px]">{chipLabel}</span>
      </button>

      {isOpen && (
        <div
          className={`absolute bottom-full left-0 mb-2 w-72 p-3.5 rounded-2xl border shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-[#141418] border-white/15 text-white shadow-[0_16px_40px_rgba(0,0,0,0.85)]'
              : 'bg-white border-black/12 text-slate-900 shadow-[0_16px_40px_rgba(0,0,0,0.12)]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <Navigation className="w-3.5 h-3.5 text-[#FC4C01]" />
              <span>Location Settings</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 opacity-60 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed mb-3">
            IP location is used by default. Precise location is optional and off by default.
          </p>

          {errorMsg && (
            <div className="p-2 mb-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px]">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleRequestGps}
              disabled={isLoadingGps}
              className={`w-full py-2 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white text-black hover:bg-neutral-200 border-white'
                  : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900'
              }`}
            >
              {isLoadingGps ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              <span>{isLoadingGps ? 'Detecting GPS...' : 'Use Precise Location'}</span>
            </button>

            <div className="relative flex items-center justify-center text-[10px] text-neutral-500 my-1">
              <span className="bg-[#141418] px-2">or save home city</span>
            </div>

            <form onSubmit={handleSaveManual} className="flex gap-1.5">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. Hyderabad, India"
                className={`flex-1 px-2.5 py-1.5 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-[#1a1a20] border-white/15 text-white placeholder-neutral-500'
                    : 'bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-[#FC4C01] text-white font-semibold text-xs hover:bg-[#e04300] disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
            </form>

            {(pref.usePreciseLocation || pref.homeCity) && (
              <button
                type="button"
                onClick={handleTurnOff}
                className="w-full text-center text-[10px] text-neutral-400 hover:text-neutral-200 pt-1 cursor-pointer"
              >
                Clear location preferences
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
