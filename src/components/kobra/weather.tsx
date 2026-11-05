import React, { useEffect, useState } from 'react';
import { Compass, MapPin } from 'lucide-react';
import {
  requestPreciseLocationOnTap,
  setSavedHomeCity,
  getEffectiveLocationPayload,
} from '../../lib/locationStore';

export interface WeatherHourlyItem {
  timeLabel: string;
  tempC: number;
  code: number;
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
  tempC: number;
  feelsLikeC: number;
  highC: number;
  lowC: number;
  rainChancePct: number;
  humidity: number;
  windKmh: number;
  condition: string;
  code: number;
  hourly: WeatherHourlyItem[];
  daily: WeatherForecastDay[];
}

export interface WeatherCardProps {
  locationQuery: string;
  isDark?: boolean;
}

export function detectWeatherLocationInQuery(query: string, fallbackCity = ''): string | null {
  if (!query || !query.trim()) return null;
  const effectiveLoc = getEffectiveLocationPayload();
  const preferredFallback = fallbackCity || effectiveLoc?.city || 'Ramagundam';
  const q = query.trim();
  const m1 = q.match(
    /\b(?:weather|temperature|forecast|climate|rain|humidity|wind)\s+(?:in|for|at|of)\s+([a-zA-Z\s,.-]{2,40})/i
  );
  if (m1 && m1[1]) {
    const candidate = m1[1].replace(/\b(today|tomorrow|now|right now|this week)\b/gi, '').replace(/[?.,!]+$/, '').trim();
    if (candidate.length >= 2) return candidate;
  }
  const m2 = q.match(
    /^([a-zA-Z\s]{2,30})\s+(?:weather|temperature|forecast|5-day forecast)\b/i
  );
  if (m2 && m2[1] && !/^(what|how|is|the|current|today|tomorrow|local|live)$/i.test(m2[1].trim())) {
    return m2[1].trim();
  }
  if (/\b(weather|temperature|forecast|climate|rain|today'?s?\s+weather)\b/i.test(q)) {
    return preferredFallback;
  }
  return null;
}

function weatherCodeToLabel(code: number): string {
  if (code === 0) return '☀️ Clear Sky';
  if (code === 1 || code === 2) return '⛅ Partly Cloudy';
  if (code === 3) return '☁️ Overcast';
  if (code >= 45 && code <= 48) return '🌫️ Foggy';
  if (code >= 51 && code <= 67) return '🌧️ Rain';
  if (code >= 71 && code <= 77) return '❄️ Snow';
  if (code >= 80 && code <= 82) return '🌦️ Showers';
  if (code >= 95) return '⛈️ Thunderstorm';
  return '🌤️ Mild Sky';
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  locationQuery,
  isDark = true,
}) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [isUpdatingGPS, setIsUpdatingGPS] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showManualCityInput, setShowManualCityInput] = useState(false);
  const [manualCityText, setManualCityText] = useState('');

  const fetchWeather = async (targetLoc = locationQuery) => {
    if (!targetLoc) return;
    setLoading(true);
    try {
      const searchName = targetLoc.split(',')[0].trim() || targetLoc.trim();
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          searchName
        )}&count=5&language=en&format=json`
      );
      const geoJson = await geoRes.json();
      const results: any[] = Array.isArray(geoJson?.results) ? geoJson.results : [];
      // Prefer Indian match when user timezone or query indicates India/Telangana
      const preferredPlace =
        results.find((r) => /india/i.test(r.country || '') || r.country_code === 'IN') ||
        results[0];

      if (!preferredPlace) {
        setLoading(false);
        return;
      }

      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${preferredPlace.latitude}&longitude=${preferredPlace.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`
      );
      const wxJson = await wxRes.json();
      if (!wxJson?.current) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const currentHour = now.getHours();

      const hourly: WeatherHourlyItem[] = [];
      const times = wxJson.hourly?.time || [];
      const temps = wxJson.hourly?.temperature_2m || [];
      const codes = wxJson.hourly?.weather_code || [];

      for (let i = currentHour; i < Math.min(times.length, currentHour + 7); i++) {
        const hTime = new Date(times[i]);
        const hFormat = hTime.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        hourly.push({
          timeLabel: i === currentHour ? 'Now' : hFormat,
          tempC: Math.round(temps[i] ?? wxJson.current.temperature_2m),
          code: codes[i] ?? wxJson.current.weather_code,
        });
      }

      const days: WeatherForecastDay[] = (wxJson.daily?.time || [])
        .slice(0, 5)
        .map((dateStr: string, idx: number) => {
          const d = new Date(`${dateStr}T12:00:00`);
          const dayName =
            idx === 0
              ? 'Today'
              : d.toLocaleDateString('en-US', { weekday: 'short' });
          return {
            date: dateStr,
            dayName,
            tempMaxC: Math.round(wxJson.daily.temperature_2m_max?.[idx] ?? 20),
            tempMinC: Math.round(wxJson.daily.temperature_2m_min?.[idx] ?? 12),
            code: wxJson.daily.weather_code?.[idx] ?? 0,
            rainChancePct: Math.round(wxJson.daily.precipitation_probability_max?.[idx] ?? 0),
          };
        });

      const todayMax = Math.round(wxJson.daily?.temperature_2m_max?.[0] ?? wxJson.current.temperature_2m);
      const todayMin = Math.round(wxJson.daily?.temperature_2m_min?.[0] ?? wxJson.current.temperature_2m);
      const todayRainChance = Math.round(wxJson.daily?.precipitation_probability_max?.[0] ?? 0);

      setData({
        locationName: preferredPlace.name,
        admin1: preferredPlace.admin1,
        country: preferredPlace.country,
        tempC: Math.round(wxJson.current.temperature_2m),
        feelsLikeC: Math.round(wxJson.current.apparent_temperature),
        highC: todayMax,
        lowC: todayMin,
        rainChancePct: todayRainChance,
        humidity: Math.round(wxJson.current.relative_humidity_2m),
        windKmh: Math.round(wxJson.current.wind_speed_10m),
        condition: weatherCodeToLabel(wxJson.current.weather_code),
        code: wxJson.current.weather_code,
        hourly,
        daily: days,
      });
    } catch {
      // Ignore network errors silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const effective = getEffectiveLocationPayload();
    const initialCity =
      locationQuery && !/^(hyderabad|ramagundam)$/i.test(locationQuery)
        ? locationQuery
        : effective?.city || locationQuery || 'Ramagundam';
    fetchWeather(initialCity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationQuery]);

  useEffect(() => {
    const onLocUpdated = (e: any) => {
      const detail = e?.detail;
      const updatedCity = detail?.homeCity || detail?.preciseLocation?.city;
      if (updatedCity) {
        fetchWeather(updatedCity);
      }
    };
    window.addEventListener('kinich-location-updated', onLocUpdated);
    return () => window.removeEventListener('kinich-location-updated', onLocUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUsePreciseLocationTap = async () => {
    setIsUpdatingGPS(true);
    setStatusMessage(null);
    try {
      const loc = await requestPreciseLocationOnTap();
      if (loc?.city) {
        await fetchWeather(loc.city);
        setStatusMessage(`Updated to ${loc.city}${loc.region ? `, ${loc.region}` : ''}`);
        setTimeout(() => setStatusMessage(null), 3500);
      }
    } catch {
      setShowManualCityInput(true);
    } finally {
      setIsUpdatingGPS(false);
    }
  };

  const handleManualCitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualCityText.trim();
    if (!cleaned) return;
    setSavedHomeCity(cleaned);
    setShowManualCityInput(false);
    setManualCityText('');
    setStatusMessage(`Saved city: ${cleaned}`);
    setTimeout(() => setStatusMessage(null), 3500);
    await fetchWeather(cleaned);
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
      {/* Top Header Row: City Name (High Contrast in Light & Dark Mode), Sky Condition Badge, C/F Toggle */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span
            className={`text-sm font-semibold truncate ${
              isDark ? 'text-white' : 'text-[#18181b]'
            }`}
          >
            {data.locationName}
            {data.admin1 && data.admin1 !== data.locationName ? `, ${data.admin1}` : ''}
            {data.country ? `, ${data.country}` : ''}
          </span>
          <span
            title="Current sky weather condition"
            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-medium border shrink-0 select-none ${
              isDark
                ? 'bg-white/[0.06] border-white/10 text-neutral-200'
                : 'bg-[#f4f4f5] border-black/[0.08] text-[#27272a]'
            }`}
          >
            {data.condition}
          </span>
        </div>

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
                unit === u
                  ? 'bg-[#FC4C01] text-white'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
      </div>

      {/* Main Now & Key Metrics Banner */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
        <div className="text-3xl font-bold tracking-tight text-[#FC4C01]">
          {formatTemp(data.tempC)}
        </div>
        <div
          className={`text-xs flex items-center gap-2 font-mono ${
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          }`}
        >
          <span>High {formatTemp(data.highC)}</span>
          <span>·</span>
          <span>Low {formatTemp(data.lowC)}</span>
          <span>·</span>
          <span>Feels {formatTemp(data.feelsLikeC)}</span>
        </div>
        {data.rainChancePct > 0 && (
          <div className="text-xs font-medium text-sky-500">
            {data.rainChancePct}% chance of rain
          </div>
        )}
      </div>

      {/* Hourly Forecast Strip (Next 6 Hours) */}
      {data.hourly.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase font-mono tracking-wider opacity-50 mb-1.5">
            Next Hours
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {data.hourly.map((h, i) => (
              <div
                key={i}
                className={`px-1.5 py-1.5 rounded-xl border text-center flex flex-col items-center gap-0.5 ${
                  isDark
                    ? 'bg-white/[0.03] border-white/[0.08]'
                    : 'bg-[#f4f4f5] border-black/[0.06]'
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
                isDark
                  ? 'bg-white/[0.02] border-white/[0.07]'
                  : 'bg-[#fafafa] border-black/[0.06]'
              }`}
            >
              <span className="text-[10px] opacity-65">{day.dayName}</span>
              <span className="text-[10.5px] font-medium">
                {formatTemp(day.tempMaxC)}{' '}
                <span className="opacity-45">{formatTemp(day.tempMinC)}</span>
              </span>
              {day.rainChancePct > 10 && (
                <span className="text-[9px] text-sky-500 font-mono">
                  {day.rainChancePct}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer: Open-Meteo Citation + Both GPS & Manual City Selector */}
      <div
        className={`flex flex-col gap-2 pt-2 border-t text-[10.5px] ${
          isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`font-sans ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Data provided by{' '}
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noreferrer"
              className="underline hover:opacity-80"
            >
              Open-Meteo
            </a>
            {statusMessage && (
              <span className="ml-2 text-[#FC4C01] font-medium">· {statusMessage}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowManualCityInput((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition text-[10.5px] font-medium cursor-pointer ${
                isDark
                  ? 'border-white/15 text-neutral-300 hover:bg-white/5'
                  : 'border-black/15 text-neutral-700 hover:bg-black/5'
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
          <form
            onSubmit={handleManualCitySubmit}
            className="flex flex-wrap items-center justify-end gap-1.5 pt-1"
          >
            <input
              type="text"
              value={manualCityText}
              onChange={(e) => setManualCityText(e.target.value)}
              placeholder="Enter city (e.g. Ramagundam, Telangana)"
              className={`px-2.5 py-1 rounded-lg border text-[11px] focus:outline-none focus:border-[#FC4C01] ${
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
        )}
      </div>
    </div>
  );
};

export default WeatherCard;
