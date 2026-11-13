import React, { useEffect, useState } from 'react';
import { Compass, MapPin, RefreshCw, Wind, Droplets, Sun, Sunrise, Sunset } from 'lucide-react';
import {
  requestPreciseLocation,
  setManualLocationPlace,
  setSavedHomeCity,
  searchCities,
  getEffectiveLocationPayload,
  type GeocodedCityPlace,
} from '../../lib/locationStore';

export interface WeatherHourlyItem {
  timeLabel: string;
  tempC: number;
  code: number;
  precipChancePct?: number;
}

export interface WeatherForecastDay {
  date: string;
  dayName: string;
  tempMaxC: number;
  tempMinC: number;
  code: number;
  rainChancePct: number;
}

export interface WeatherData {
  locationName: string;
  admin1?: string;
  country?: string;
  timezone?: string;
  tempC: number;
  feelsLikeC: number;
  highC: number;
  lowC: number;
  rainChancePct: number;
  humidity: number;
  windKmh: number;
  windCompass?: string;
  uvIndex?: number;
  sunrise?: string;
  sunset?: string;
  airQuality?: {
    usAqi?: number;
    category: string;
    pm2_5?: number;
  };
  condition: string;
  code: number;
  hourly: WeatherHourlyItem[];
  daily: WeatherForecastDay[];
  cached?: boolean;
  cacheAgeSeconds?: number;
  fetchedAt?: number;
}

export interface WeatherCardProps {
  locationQuery: string;
  isDark?: boolean;
}

export const LOCATION_UNSET_SENTINEL = '__LOCATION_UNSET__';

export function detectWeatherLocationInQuery(query: string, fallbackCity = ''): string | null {
  if (!query || !query.trim()) return null;
  const q = query.trim();

  // Explicit city in query ("weather in Tokyo", "rain in London tomorrow")
  const m1 = q.match(
    /\b(?:weather|temperature|forecast|climate|rain|humidity|wind|aqi|air\s+quality)\s+(?:in|for|at|of|around|near)\s+([a-zA-Z\u00C0-\u024F\s,.-]{2,45})/i
  );
  if (m1 && m1[1]) {
    const candidate = m1[1]
      .replace(/\b(today|tomorrow|tonight|now|right\s+now|this\s+week|please)\b[\s\S]*$/i, '')
      .replace(/[?.,!]+$/, '')
      .trim();
    if (
      candidate.length >= 2 &&
      !/^(me|here|my\s+city|my\s+location|my\s+area|outside)$/i.test(candidate)
    ) {
      return candidate;
    }
  }

  const m2 = q.match(
    /^([a-zA-Z\u00C0-\u024F\s,.-]{2,35})\s+(?:weather|temperature|forecast|5-day\s+forecast|aqi)\b/i
  );
  if (
    m2 &&
    m2[1] &&
    !/^(what|what's|how|is|the|current|today|today's|tomorrow|local|live|check)$/i.test(m2[1].trim())
  ) {
    return m2[1].trim();
  }

  if (/\b(weather|temperature|forecast|climate|rain|raining|humidity|aqi|air\s+quality|today'?s?\s+weather)\b/i.test(q)) {
    if (fallbackCity) return fallbackCity;
    const effectiveLoc = getEffectiveLocationPayload();
    if (effectiveLoc && effectiveLoc.locationEnabled !== false && effectiveLoc.city) {
      return effectiveLoc.city;
    }
    return LOCATION_UNSET_SENTINEL;
  }
  return null;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  locationQuery,
  isDark = true,
}) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [isUpdatingGPS, setIsUpdatingGPS] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showManualCityInput, setShowManualCityInput] = useState(false);
  const [manualCityText, setManualCityText] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<GeocodedCityPlace[]>([]);

  const fetchWeather = async (targetLoc?: string, opts?: { refresh?: boolean; useCoords?: { lat: number; lng: number } }) => {
    let loc = targetLoc ?? locationQuery;
    if (!loc || loc === LOCATION_UNSET_SENTINEL) {
      const effective = getEffectiveLocationPayload();
      if (!effective || !effective.locationEnabled || (!effective.city && effective.latitude === undefined)) {
        setNeedsLocation(true);
        setLoading(false);
        setData(null);
        return;
      }
      loc = effective.city || 'Current Location';
    }

    setNeedsLocation(false);
    setLoading(true);
    try {
      const effective = getEffectiveLocationPayload();
      const useActiveCoords =
        opts?.useCoords ||
        (effective &&
        effective.locationEnabled &&
        typeof effective.latitude === 'number' &&
        typeof effective.longitude === 'number' &&
        (!loc ||
          loc.toLowerCase() === (effective.city || '').toLowerCase() ||
          loc === 'Current Location')
          ? { lat: effective.latitude, lng: effective.longitude }
          : undefined);

      const params = new URLSearchParams();
      if (useActiveCoords) {
        params.set('lat', String(useActiveCoords.lat));
        params.set('lng', String(useActiveCoords.lng));
      }
      if (loc && loc !== 'Current Location') {
        params.set('city', loc);
      }
      if (effective?.timezone && useActiveCoords) {
        params.set('timezone', effective.timezone);
      }
      if (opts?.refresh) {
        params.set('refresh', '1');
      }

      const res = await fetch(`/api/weather?${params.toString()}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const json = await res.json();
      const w = json?.weather;
      if (!w || !w.current) {
        setLoading(false);
        return;
      }

      setData({
        locationName: w.locationName,
        admin1: w.region,
        country: w.country,
        timezone: w.timezone,
        tempC: w.current.tempC,
        feelsLikeC: w.current.feelsLikeC,
        highC: w.today?.highC ?? w.current.tempC,
        lowC: w.today?.lowC ?? w.current.tempC,
        rainChancePct: w.today?.rainChancePct ?? 0,
        humidity: w.current.humidityPct,
        windKmh: w.current.windSpeedKmh,
        windCompass: w.current.windCompass,
        uvIndex: w.current.uvIndex,
        sunrise: w.today?.sunrise,
        sunset: w.today?.sunset,
        airQuality: w.airQuality,
        condition: w.current.condition,
        code: w.current.weatherCode,
        hourly: (w.hourly || []).slice(0, 6),
        daily: (w.daily || []).slice(0, 5),
        cached: Boolean(w.cached),
        cacheAgeSeconds: w.cacheAgeSeconds,
        fetchedAt: w.fetchedAt,
      });
    } catch {
      // Ignore transient network errors gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWeather(locationQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationQuery]);

  useEffect(() => {
    const onLocUpdated = () => {
      if (locationQuery === LOCATION_UNSET_SENTINEL) {
        const eff = getEffectiveLocationPayload();
        if (eff?.locationEnabled && (eff.city || eff.latitude !== undefined)) {
          void fetchWeather(eff.city || 'Current Location');
        }
      }
    };
    window.addEventListener('kinich-location-updated', onLocUpdated);
    return () => window.removeEventListener('kinich-location-updated', onLocUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationQuery]);

  useEffect(() => {
    const q = manualCityText.trim();
    if (!showManualCityInput || q.length < 2) {
      setCitySuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const places = await searchCities(q, 5);
      if (!cancelled) setCitySuggestions(places);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [manualCityText, showManualCityInput]);

  const handleUsePreciseLocationTap = async () => {
    setIsUpdatingGPS(true);
    setStatusMessage(null);
    try {
      const result = await requestPreciseLocation({ allowIpFallback: true });
      if (result.location) {
        const coords =
          typeof result.location.latitude === 'number' && typeof result.location.longitude === 'number'
            ? { lat: result.location.latitude, lng: result.location.longitude }
            : undefined;
        await fetchWeather(result.location.city, { refresh: true, useCoords: coords });
        setStatusMessage(
          result.usedFallback
            ? `Approximate: ${result.location.city}`
            : `Updated to ${result.location.city}${result.location.region ? `, ${result.location.region}` : ''}`
        );
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        setStatusMessage(result.errorMessage || 'Permission denied');
        setShowManualCityInput(true);
      }
    } catch {
      setShowManualCityInput(true);
    } finally {
      setIsUpdatingGPS(false);
    }
  };

  const handlePickSuggestedCity = async (place: GeocodedCityPlace) => {
    setManualLocationPlace(place);
    setShowManualCityInput(false);
    setManualCityText('');
    setCitySuggestions([]);
    setStatusMessage(`Set to ${place.displayName}`);
    setTimeout(() => setStatusMessage(null), 3500);
    await fetchWeather(place.name, {
      refresh: true,
      useCoords: { lat: place.latitude, lng: place.longitude },
    });
  };

  const handleManualCitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualCityText.trim();
    if (!cleaned) return;
    if (citySuggestions.length > 0) {
      await handlePickSuggestedCity(citySuggestions[0]);
      return;
    }
    setSavedHomeCity(cleaned);
    setShowManualCityInput(false);
    setManualCityText('');
    setStatusMessage(`City set: ${cleaned}`);
    setTimeout(() => setStatusMessage(null), 3500);
    await fetchWeather(cleaned, { refresh: true });
  };

  const formatTemp = (c: number) =>
    unit === 'C' ? `${c}°` : `${Math.round((c * 9) / 5 + 32)}°`;

  if (loading) {
    return (
      <div
        data-slot="kobra-weather"
        className={`my-2.5 rounded-2xl border px-3.5 py-2 inline-flex items-center gap-2 text-[11px] font-normal ${
          isDark
            ? 'bg-[#141418] border-white/[0.1] text-white/80'
            : 'bg-white border-black/[0.08] text-[#18181b]/80'
        }`}
      >
        <span className="size-2 rounded-full bg-[#FC4C01] animate-ping" />
        <span>Fetching live weather from Open-Meteo...</span>
      </div>
    );
  }

  if (needsLocation) {
    return (
      <div
        data-slot="kobra-weather"
        className={`my-2.5 rounded-2xl border p-3.5 space-y-2.5 text-xs ${
          isDark
            ? 'bg-[#141418] border-white/[0.12] text-white/90'
            : 'bg-white border-black/[0.08] text-[#18181b]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">Choose a city or enable location for local weather</div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUsePreciseLocationTap}
              disabled={isUpdatingGPS}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FC4C01] text-white text-[10.5px] font-medium cursor-pointer"
            >
              <Compass className={`w-3 h-3 ${isUpdatingGPS ? 'animate-spin' : ''}`} />
              <span>{isUpdatingGPS ? 'Detecting...' : 'Use location'}</span>
            </button>
          </div>
        </div>
        <form onSubmit={handleManualCitySubmit} className="flex items-center gap-1.5">
          <input
            type="text"
            value={manualCityText}
            onChange={(e) => {
              setManualCityText(e.target.value);
              setShowManualCityInput(true);
            }}
            placeholder="Enter city (e.g. Hyderabad, London, Tokyo)..."
            className={`flex-1 px-2.5 py-1.5 rounded-lg border text-[11px] outline-none focus:border-[#FC4C01] ${
              isDark
                ? 'bg-black/30 border-white/15 text-white placeholder:text-neutral-500'
                : 'bg-[#f4f4f5] border-black/15 text-[#18181b] placeholder:text-neutral-500'
            }`}
          />
          <button
            type="submit"
            disabled={!manualCityText.trim()}
            className="px-2.5 py-1.5 rounded-lg border border-white/15 text-[11px] font-medium hover:bg-white/10 disabled:opacity-40 cursor-pointer"
          >
            Check
          </button>
        </form>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      data-slot="kobra-weather"
      className={`my-2.5 rounded-3xl border p-4 transition-all text-xs font-normal ${
        isDark
          ? 'bg-[#141418] border-white/[0.12] text-white/90 shadow-lg'
          : 'bg-white border-black/[0.08] text-[#18181b] shadow-sm'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-[#18181b]'}`}>
            {data.locationName}
            {data.admin1 && data.admin1 !== data.locationName ? `, ${data.admin1}` : ''}
            {data.country ? `, ${data.country}` : ''}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium border shrink-0 select-none ${
              isDark
                ? 'bg-white/[0.06] border-white/10 text-neutral-200'
                : 'bg-[#f4f4f5] border-black/[0.08] text-[#27272a]'
            }`}
          >
            {data.condition}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void fetchWeather(data.locationName, { refresh: true })}
            className="p-1 rounded-md opacity-60 hover:opacity-100 cursor-pointer"
            title="Refresh live weather"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <div
            className={`inline-flex p-0.5 rounded-full border shrink-0 ${
              isDark ? 'bg-[#0b0b0e] border-white/10' : 'bg-[#f4f4f5] border-black/[0.08]'
            }`}
          >
            {(['C', 'F'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                  unit === u ? 'bg-[#FC4C01] text-white' : 'opacity-60 hover:opacity-100'
                }`}
              >
                °{u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Temp & Metrics */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2.5">
        <div className="text-3xl font-bold tracking-tight text-[#FC4C01]">
          {formatTemp(data.tempC)}
        </div>
        <div className={`text-xs flex items-center gap-2 font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
          <span>High {formatTemp(data.highC)}</span>
          <span>·</span>
          <span>Low {formatTemp(data.lowC)}</span>
          <span>·</span>
          <span>Feels {formatTemp(data.feelsLikeC)}</span>
        </div>
        {data.rainChancePct > 0 && (
          <div className="text-xs font-medium text-sky-500">
            {data.rainChancePct}% rain chance
          </div>
        )}
      </div>

      {/* Environmental Telemetry Strip: Humidity, Wind, UV, Sunrise/Sunset, AQI */}
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] mb-3 px-2.5 py-2 rounded-xl border ${
          isDark ? 'bg-white/[0.02] border-white/[0.07] text-neutral-300' : 'bg-[#fafafa] border-black/[0.06] text-neutral-700'
        }`}
      >
        <span className="inline-flex items-center gap-1">
          <Droplets className="w-3 h-3 text-sky-400" />
          <span>{data.humidity}% humidity</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Wind className="w-3 h-3 text-neutral-400" />
          <span>
            {data.windKmh} km/h {data.windCompass || ''}
          </span>
        </span>
        {data.uvIndex !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-400" />
            <span>UV {data.uvIndex}</span>
          </span>
        )}
        {data.sunrise && (
          <span className="inline-flex items-center gap-1">
            <Sunrise className="w-3 h-3 text-amber-300" />
            <span>{data.sunrise}</span>
          </span>
        )}
        {data.sunset && (
          <span className="inline-flex items-center gap-1">
            <Sunset className="w-3 h-3 text-orange-400" />
            <span>{data.sunset}</span>
          </span>
        )}
        {data.airQuality && (
          <span className="inline-flex items-center gap-1 font-medium">
            <span>
              AQI {data.airQuality.usAqi ?? 'N/A'} ({data.airQuality.category})
              {data.airQuality.pm2_5 !== undefined ? ` · PM2.5 ${data.airQuality.pm2_5}` : ''}
            </span>
          </span>
        )}
      </div>

      {/* Hourly Forecast Strip */}
      {data.hourly.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase font-mono tracking-wider opacity-50 mb-1.5">
            Next Hours {data.timezone ? `(${data.timezone})` : ''}
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {data.hourly.map((h, i) => (
              <div
                key={i}
                className={`px-1.5 py-1.5 rounded-xl border text-center flex flex-col items-center gap-0.5 ${
                  isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#f4f4f5] border-black/[0.06]'
                }`}
              >
                <span className="text-[9.5px] opacity-65">{h.timeLabel}</span>
                <span className="text-[11px] font-semibold">{formatTemp(h.tempC)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5-Day Forecast Row */}
      {data.daily.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {data.daily.map((day) => (
            <div
              key={day.date}
              className={`px-2 py-1.5 rounded-2xl border text-center flex flex-col items-center gap-0.5 ${
                isDark ? 'bg-white/[0.02] border-white/[0.07]' : 'bg-[#fafafa] border-black/[0.06]'
              }`}
            >
              <span className="text-[10px] opacity-65">{day.dayName}</span>
              <span className="text-[10.5px] font-medium">
                {formatTemp(day.tempMaxC)} <span className="opacity-45">{formatTemp(day.tempMinC)}</span>
              </span>
              {day.rainChancePct > 10 && (
                <span className="text-[9px] text-sky-500 font-mono">{day.rainChancePct}%</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={`flex flex-col gap-2 pt-2 border-t text-[10.5px] ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`font-sans ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {data.cached && typeof data.cacheAgeSeconds === 'number'
              ? `Cached ${data.cacheAgeSeconds}s ago · `
              : 'Live · '}
            <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="underline hover:opacity-80">
              Open-Meteo
            </a>
            {statusMessage && <span className="ml-2 text-[#FC4C01] font-medium">· {statusMessage}</span>}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowManualCityInput((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition text-[10.5px] font-medium cursor-pointer ${
                isDark ? 'border-white/15 text-neutral-300 hover:bg-white/5' : 'border-black/15 text-neutral-700 hover:bg-black/5'
              }`}
            >
              <MapPin className="w-3 h-3 text-[#FC4C01]" />
              <span>Change city</span>
            </button>

            <button
              type="button"
              onClick={handleUsePreciseLocationTap}
              disabled={isUpdatingGPS}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#FC4C01]/35 text-[#FC4C01] hover:bg-[#FC4C01]/10 transition text-[10.5px] font-medium cursor-pointer"
            >
              <Compass className={`w-3 h-3 ${isUpdatingGPS ? 'animate-spin' : ''}`} />
              <span>{isUpdatingGPS ? 'Locating...' : 'Use precise location'}</span>
            </button>
          </div>
        </div>

        {showManualCityInput && (
          <div className="space-y-1 pt-1">
            <form onSubmit={handleManualCitySubmit} className="flex flex-wrap items-center justify-end gap-1.5">
              <input
                type="text"
                value={manualCityText}
                onChange={(e) => setManualCityText(e.target.value)}
                placeholder="Search city (e.g. Hyderabad, Tokyo, London)..."
                className={`flex-1 min-w-[180px] px-2.5 py-1 rounded-lg border text-[11px] focus:outline-none focus:border-[#FC4C01] ${
                  isDark
                    ? 'bg-black/30 border-white/15 text-white placeholder:text-neutral-500'
                    : 'bg-[#f4f4f5] border-black/15 text-[#18181b] placeholder:text-neutral-500'
                }`}
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded-lg bg-[#FC4C01] text-white text-[10.5px] font-medium hover:opacity-90 transition cursor-pointer"
              >
                Save City
              </button>
            </form>
            {citySuggestions.length > 0 && (
              <div
                className={`rounded-xl border divide-y ${
                  isDark ? 'bg-[#0e0e12] border-white/10 divide-white/5' : 'bg-white border-black/10 divide-black/5'
                }`}
              >
                {citySuggestions.map((p, i) => (
                  <button
                    key={`${p.name}-${i}`}
                    type="button"
                    onClick={() => void handlePickSuggestedCity(p)}
                    className={`w-full text-left px-2.5 py-1 text-[10.5px] cursor-pointer ${
                      isDark ? 'hover:bg-white/5' : 'hover:bg-neutral-100'
                    }`}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherCard;
