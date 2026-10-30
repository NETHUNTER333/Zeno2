import React, { useEffect, useState } from 'react';

export interface WeatherForecastDay {
  date: string;
  dayName: string;
  tempMaxC: number;
  tempMinC: number;
  code: number;
}

export interface WeatherData {
  locationName: string;
  country?: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  condition: string;
  code: number;
  daily: WeatherForecastDay[];
}

export interface WeatherCardProps {
  locationQuery: string;
  isDark?: boolean;
}

export function detectWeatherLocationInQuery(query: string): string | null {
  if (!query) return null;
  const q = query.trim();
  const m1 = q.match(
    /\b(?:weather|temperature|forecast|climate|rain|humidity|wind)\s+(?:in|for|at|of)\s+([a-zA-Z\s,.-]{2,40})/i
  );
  if (m1 && m1[1]) {
    return m1[1].replace(/[?.,!]+$/, '').trim();
  }
  const m2 = q.match(
    /^([a-zA-Z\s]{2,30})\s+(?:weather|temperature|forecast|5-day forecast)\b/i
  );
  if (m2 && m2[1] && !/^(what|how|is|the|current|today|tomorrow)$/i.test(m2[1].trim())) {
    return m2[1].trim();
  }
  return null;
}

function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Fog';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Storm';
  return 'Mild';
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  locationQuery,
  isDark = true,
}) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<'C' | 'F'>('C');

  const fetchWeather = async () => {
    if (!locationQuery) return;
    setLoading(true);
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          locationQuery
        )}&count=1&language=en&format=json`
      );
      const geoJson = await geoRes.json();
      const place = geoJson?.results?.[0];
      if (!place) {
        setLoading(false);
        return;
      }

      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      const wxJson = await wxRes.json();
      if (!wxJson?.current) {
        setLoading(false);
        return;
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
          };
        });

      setData({
        locationName: place.name,
        country: place.country,
        tempC: Math.round(wxJson.current.temperature_2m),
        feelsLikeC: Math.round(wxJson.current.apparent_temperature),
        humidity: Math.round(wxJson.current.relative_humidity_2m),
        windKmh: Math.round(wxJson.current.wind_speed_10m),
        condition: weatherCodeToLabel(wxJson.current.weather_code),
        code: wxJson.current.weather_code,
        daily: days,
      });
    } catch {
      // Ignore network errors silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationQuery]);

  const formatTemp = (c: number) =>
    unit === 'C' ? `${c}°` : `${Math.round((c * 9) / 5 + 32)}°`;

  if (loading) {
    return (
      <div
        data-slot="kobra-weather"
        className={`my-2.5 rounded-full border px-3.5 py-2 inline-flex items-center gap-2 text-[11px] font-normal ${
          isDark
            ? 'bg-[#141418] border-white/[0.1] text-white/80'
            : 'bg-white border-black/[0.08] text-[#18181b]/80'
        }`}
      >
        <span>Loading weather for {locationQuery}...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      data-slot="kobra-weather"
      className={`my-2.5 rounded-3xl border px-3.5 py-2.5 transition-all text-[11px] font-normal ${
        isDark
          ? 'bg-[#141418] border-white/[0.1] text-white/90 shadow-xs'
          : 'bg-white border-black/[0.08] text-[#18181b] shadow-xs'
      }`}
    >
      {/* Top Compact Pill Row: Location + Condition + Unit Toggle (No icons, no heavy text) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-normal truncate">
            {data.locationName}
            {data.country ? `, ${data.country}` : ''}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-normal border shrink-0 ${
              isDark
                ? 'bg-white/[0.04] border-white/10 text-white/65'
                : 'bg-[#f4f4f5] border-black/[0.06] text-black/65'
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
              className={`px-2 py-0.5 rounded-full text-[10px] font-normal transition-colors cursor-pointer ${
                unit === u
                  ? isDark
                    ? 'bg-white text-black'
                    : 'bg-[#18181b] text-white'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Pill Metrics Strip */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <div
          className={`px-3 py-1 rounded-full border text-[11px] font-normal ${
            isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#fafafa] border-black/[0.06]'
          }`}
        >
          Now {formatTemp(data.tempC)} · Feels {formatTemp(data.feelsLikeC)}
        </div>
        <div
          className={`px-3 py-1 rounded-full border text-[11px] font-normal ${
            isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#fafafa] border-black/[0.06]'
          }`}
        >
          Humidity {data.humidity}%
        </div>
        <div
          className={`px-3 py-1 rounded-full border text-[11px] font-normal ${
            isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-[#fafafa] border-black/[0.06]'
          }`}
        >
          Wind {data.windKmh} km/h
        </div>
      </div>

      {/* 5-Day Pill Forecast Row (No divider line, no icons) */}
      {data.daily.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5">
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
              <span className="text-[10.5px] font-normal">
                {formatTemp(day.tempMaxC)}{' '}
                <span className="opacity-45">{formatTemp(day.tempMinC)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WeatherCard;
