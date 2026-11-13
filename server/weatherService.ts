import {
  isValidCoordinate,
  reverseGeocodeCoordinates,
  searchCitiesGeocoding,
} from './locationService';

export interface WeatherHourlyPoint {
  timeIso: string;
  timeLabel: string;
  tempC: number;
  precipChancePct: number;
  precipMm: number;
  weatherCode: number;
  condition: string;
  uvIndex?: number;
}

export interface WeatherDailyPoint {
  date: string;
  dayName: string;
  tempMaxC: number;
  tempMinC: number;
  weatherCode: number;
  condition: string;
  rainChancePct: number;
  precipSumMm: number;
  sunrise?: string;
  sunset?: string;
  uvIndexMax?: number;
}

export interface AirQualityReport {
  usAqi?: number;
  europeanAqi?: number;
  category: string;
  pm2_5?: number;
  pm10?: number;
  ozone?: number;
  nitrogenDioxide?: number;
  carbonMonoxide?: number;
}

export interface WeatherReport {
  locationName: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    tempC: number;
    feelsLikeC: number;
    humidityPct: number;
    precipitationMm: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    windCompass: string;
    uvIndex?: number;
    isDay: boolean;
    weatherCode: number;
    condition: string;
  };
  today: {
    highC: number;
    lowC: number;
    rainChancePct: number;
    precipSumMm: number;
    sunrise?: string;
    sunset?: string;
    uvIndexMax?: number;
  };
  airQuality?: AirQualityReport;
  hourly: WeatherHourlyPoint[];
  daily: WeatherDailyPoint[];
  provider: 'Open-Meteo';
  fetchedAt: number;
  cached: boolean;
  cacheAgeSeconds: number;
}

export function weatherCodeToDescription(code: number): { label: string; emojiLabel: string } {
  if (code === 0) return { label: 'Clear sky', emojiLabel: '☀️ Clear Sky' };
  if (code === 1) return { label: 'Mainly clear', emojiLabel: '🌤️ Mainly Clear' };
  if (code === 2) return { label: 'Partly cloudy', emojiLabel: '⛅ Partly Cloudy' };
  if (code === 3) return { label: 'Overcast', emojiLabel: '☁️ Overcast' };
  if (code >= 45 && code <= 48) return { label: 'Foggy', emojiLabel: '🌫️ Foggy' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', emojiLabel: '🌦️ Drizzle' };
  if (code >= 61 && code <= 67) return { label: 'Rain', emojiLabel: '🌧️ Rain' };
  if (code >= 71 && code <= 77) return { label: 'Snow', emojiLabel: '❄️ Snow' };
  if (code >= 80 && code <= 82) return { label: 'Rain showers', emojiLabel: '🌦️ Showers' };
  if (code >= 85 && code <= 86) return { label: 'Snow showers', emojiLabel: '🌨️ Snow Showers' };
  if (code >= 95) return { label: 'Thunderstorm', emojiLabel: '⛈️ Thunderstorm' };
  return { label: 'Mild conditions', emojiLabel: '🌤️ Mild Sky' };
}

export function degreesToCompass(deg: number): string {
  if (!Number.isFinite(deg)) return 'N';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

export function classifyUsAqi(aqi?: number): string {
  if (aqi === undefined || !Number.isFinite(aqi)) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

interface WeatherCacheItem {
  report: Omit<WeatherReport, 'cached' | 'cacheAgeSeconds'>;
  fetchedAt: number;
}

const weatherCache = new Map<string, WeatherCacheItem>();
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes freshness window

function formatLocalHour(iso: string, timezone: string): string {
  try {
    // Open-Meteo returns local wall-clock ISO strings like "2026-11-12T14:00" when timezone is set
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (match) {
      const h = Number(match[1]);
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12} ${suffix}`;
    }
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
      timeZone: timezone || 'UTC',
    });
  } catch {
    return iso.slice(11, 16) || iso;
  }
}

function formatClockFromIso(iso?: string): string | undefined {
  if (!iso || typeof iso !== 'string') return undefined;
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return undefined;
  const h = Number(match[1]);
  const m = match[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

function currentLocalHourIndex(times: string[], timezone: string): number {
  if (!times.length) return 0;
  try {
    const nowStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).format(new Date());
    // sv-SE produces "YYYY-MM-DD HH" -> normalize to "YYYY-MM-DDTHH:00"
    const normalizedPrefix = nowStr.replace(' ', 'T').slice(0, 13);
    const idx = times.findIndex((t) => t.startsWith(normalizedPrefix));
    if (idx >= 0) return idx;
  } catch {}
  return 0;
}

export async function getLiveWeatherReport(params: {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  bypassCache?: boolean;
}): Promise<WeatherReport | null> {
  let lat = params.latitude;
  let lng = params.longitude;
  let locationName = params.city?.trim() || '';
  let region = params.region?.trim() || undefined;
  let country = params.country?.trim() || undefined;
  let countryCode = params.countryCode?.trim().toUpperCase() || undefined;
  let resolvedTz = params.timezone?.trim() || undefined;

  if (!isValidCoordinate(lat, lng)) {
    if (!locationName) return null;
    const matches = await searchCitiesGeocoding(locationName, 3, countryCode);
    const chosen = matches[0];
    if (!chosen) return null;
    lat = chosen.latitude;
    lng = chosen.longitude;
    locationName = chosen.name;
    region = region || chosen.region;
    country = country || chosen.country;
    countryCode = countryCode || chosen.countryCode;
    resolvedTz = resolvedTz || chosen.timezone;
  } else if (!locationName) {
    try {
      const rev = await reverseGeocodeCoordinates(lat!, lng!, { fallbackTimezone: resolvedTz });
      locationName = rev.city || 'Current Location';
      region = region || rev.region;
      country = country || rev.country;
      countryCode = countryCode || rev.countryCode;
      resolvedTz = resolvedTz || rev.timezone;
    } catch {
      locationName = 'Current Location';
    }
  }

  const roundedLat = Math.round(lat! * 100) / 100;
  const roundedLng = Math.round(lng! * 100) / 100;
  const cacheKey = `${roundedLat},${roundedLng}`;

  if (!params.bypassCache) {
    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS) {
      const ageSec = Math.max(0, Math.floor((Date.now() - cached.fetchedAt) / 1000));
      return {
        ...cached.report,
        locationName: locationName || cached.report.locationName,
        region: region || cached.report.region,
        country: country || cached.report.country,
        countryCode: countryCode || cached.report.countryCode,
        cached: true,
        cacheAgeSeconds: ageSec,
      };
    }
  }

  const tzParam = resolvedTz || 'auto';
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index,is_day` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max` +
    `&timezone=${encodeURIComponent(tzParam)}`;

  const aqiUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}` +
    `&current=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone` +
    `&timezone=${encodeURIComponent(tzParam)}`;

  const [wxRes, aqiRes] = await Promise.all([
    fetch(forecastUrl, { signal: AbortSignal.timeout(4500) }).catch(() => null),
    fetch(aqiUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null),
  ]);

  if (!wxRes || !wxRes.ok) return null;
  const wxJson: any = await wxRes.json().catch(() => null);
  if (!wxJson?.current) return null;

  let airQuality: AirQualityReport | undefined;
  if (aqiRes && aqiRes.ok) {
    try {
      const aqiJson: any = await aqiRes.json();
      const ac = aqiJson?.current;
      if (ac && (typeof ac.us_aqi === 'number' || typeof ac.pm2_5 === 'number')) {
        const usAqi = typeof ac.us_aqi === 'number' ? Math.round(ac.us_aqi) : undefined;
        airQuality = {
          usAqi,
          europeanAqi: typeof ac.european_aqi === 'number' ? Math.round(ac.european_aqi) : undefined,
          category: classifyUsAqi(usAqi),
          pm2_5: typeof ac.pm2_5 === 'number' ? Math.round(ac.pm2_5 * 10) / 10 : undefined,
          pm10: typeof ac.pm10 === 'number' ? Math.round(ac.pm10 * 10) / 10 : undefined,
          ozone: typeof ac.ozone === 'number' ? Math.round(ac.ozone * 10) / 10 : undefined,
          nitrogenDioxide:
            typeof ac.nitrogen_dioxide === 'number' ? Math.round(ac.nitrogen_dioxide * 10) / 10 : undefined,
          carbonMonoxide:
            typeof ac.carbon_monoxide === 'number' ? Math.round(ac.carbon_monoxide * 10) / 10 : undefined,
        };
      }
    } catch {}
  }

  const effectiveTimezone = String(wxJson.timezone || resolvedTz || 'UTC');
  const cur = wxJson.current;
  const curCode = Number(cur.weather_code ?? 0);
  const curDesc = weatherCodeToDescription(curCode);

  const hourlyTimes: string[] = Array.isArray(wxJson.hourly?.time) ? wxJson.hourly.time : [];
  const startIdx = currentLocalHourIndex(hourlyTimes, effectiveTimezone);
  const hourly: WeatherHourlyPoint[] = [];
  for (let i = startIdx; i < Math.min(hourlyTimes.length, startIdx + 24); i++) {
    const code = Number(wxJson.hourly?.weather_code?.[i] ?? curCode);
    hourly.push({
      timeIso: hourlyTimes[i],
      timeLabel: i === startIdx ? 'Now' : formatLocalHour(hourlyTimes[i], effectiveTimezone),
      tempC: Math.round(Number(wxJson.hourly?.temperature_2m?.[i] ?? cur.temperature_2m)),
      precipChancePct: Math.round(Number(wxJson.hourly?.precipitation_probability?.[i] ?? 0)),
      precipMm: Math.round(Number(wxJson.hourly?.precipitation?.[i] ?? 0) * 10) / 10,
      weatherCode: code,
      condition: weatherCodeToDescription(code).label,
      uvIndex:
        typeof wxJson.hourly?.uv_index?.[i] === 'number'
          ? Math.round(wxJson.hourly.uv_index[i] * 10) / 10
          : undefined,
    });
  }

  const dailyTimes: string[] = Array.isArray(wxJson.daily?.time) ? wxJson.daily.time : [];
  const daily: WeatherDailyPoint[] = dailyTimes.slice(0, 7).map((dateStr, idx) => {
    const code = Number(wxJson.daily?.weather_code?.[idx] ?? 0);
    const d = new Date(`${dateStr}T12:00:00Z`);
    const dayName =
      idx === 0
        ? 'Today'
        : idx === 1
        ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    return {
      date: dateStr,
      dayName,
      tempMaxC: Math.round(Number(wxJson.daily?.temperature_2m_max?.[idx] ?? cur.temperature_2m)),
      tempMinC: Math.round(Number(wxJson.daily?.temperature_2m_min?.[idx] ?? cur.temperature_2m)),
      weatherCode: code,
      condition: weatherCodeToDescription(code).label,
      rainChancePct: Math.round(Number(wxJson.daily?.precipitation_probability_max?.[idx] ?? 0)),
      precipSumMm: Math.round(Number(wxJson.daily?.precipitation_sum?.[idx] ?? 0) * 10) / 10,
      sunrise: formatClockFromIso(wxJson.daily?.sunrise?.[idx]),
      sunset: formatClockFromIso(wxJson.daily?.sunset?.[idx]),
      uvIndexMax:
        typeof wxJson.daily?.uv_index_max?.[idx] === 'number'
          ? Math.round(wxJson.daily.uv_index_max[idx] * 10) / 10
          : undefined,
    };
  });

  const windDeg = Number(cur.wind_direction_10m ?? 0);
  const fetchedAt = Date.now();

  const baseReport: Omit<WeatherReport, 'cached' | 'cacheAgeSeconds'> = {
    locationName: locationName || 'Location',
    region,
    country,
    countryCode,
    latitude: lat!,
    longitude: lng!,
    timezone: effectiveTimezone,
    current: {
      tempC: Math.round(Number(cur.temperature_2m)),
      feelsLikeC: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m)),
      humidityPct: Math.round(Number(cur.relative_humidity_2m ?? 0)),
      precipitationMm: Math.round(Number(cur.precipitation ?? 0) * 10) / 10,
      windSpeedKmh: Math.round(Number(cur.wind_speed_10m ?? 0)),
      windDirectionDeg: Math.round(windDeg),
      windCompass: degreesToCompass(windDeg),
      uvIndex: typeof cur.uv_index === 'number' ? Math.round(cur.uv_index * 10) / 10 : undefined,
      isDay: cur.is_day !== 0,
      weatherCode: curCode,
      condition: curDesc.emojiLabel,
    },
    today: {
      highC: daily[0]?.tempMaxC ?? Math.round(Number(cur.temperature_2m)),
      lowC: daily[0]?.tempMinC ?? Math.round(Number(cur.temperature_2m)),
      rainChancePct: daily[0]?.rainChancePct ?? 0,
      precipSumMm: daily[0]?.precipSumMm ?? 0,
      sunrise: daily[0]?.sunrise,
      sunset: daily[0]?.sunset,
      uvIndexMax: daily[0]?.uvIndexMax,
    },
    airQuality,
    hourly,
    daily,
    provider: 'Open-Meteo',
    fetchedAt,
  };

  weatherCache.set(cacheKey, { report: baseReport, fetchedAt });
  if (weatherCache.size > 300) {
    const oldestKey = weatherCache.keys().next().value;
    if (oldestKey) weatherCache.delete(oldestKey);
  }

  return {
    ...baseReport,
    cached: false,
    cacheAgeSeconds: 0,
  };
}

export function formatWeatherReportAsSearchSources(report: WeatherReport): any[] {
  const placeLabel = [report.locationName, report.region, report.country].filter(Boolean).join(', ');
  const aqiText = report.airQuality
    ? ` Air Quality: US AQI ${report.airQuality.usAqi ?? 'N/A'} (${report.airQuality.category}${
        report.airQuality.pm2_5 !== undefined ? `, PM2.5 ${report.airQuality.pm2_5} µg/m³` : ''
      }${report.airQuality.pm10 !== undefined ? `, PM10 ${report.airQuality.pm10} µg/m³` : ''}).`
    : '';
  const uvText =
    report.current.uvIndex !== undefined
      ? `, UV Index ${report.current.uvIndex}${
          report.today.uvIndexMax !== undefined ? ` (max ${report.today.uvIndexMax})` : ''
        }`
      : '';
  const sunText =
    report.today.sunrise && report.today.sunset
      ? ` Sunrise ${report.today.sunrise}, Sunset ${report.today.sunset} (${report.timezone}).`
      : '';
  const dailySummary = report.daily
    .slice(0, 5)
    .map(
      (d) =>
        `${d.dayName} (${d.date}): ${d.condition}, High ${d.tempMaxC}°C / Low ${d.tempMinC}°C (${d.rainChancePct}% rain)`
    )
    .join(' | ');
  const freshnessNote = report.cached
    ? `Cached ${report.cacheAgeSeconds}s ago from Open-Meteo.`
    : 'Live Open-Meteo reading.';

  const snippet =
    `${freshnessNote} ${placeLabel}: ${report.current.tempC}°C (feels like ${report.current.feelsLikeC}°C), ` +
    `${report.current.condition}. High ${report.today.highC}°C / Low ${report.today.lowC}°C, ` +
    `rain chance ${report.today.rainChancePct}% (precip ${report.current.precipitationMm} mm), ` +
    `humidity ${report.current.humidityPct}%, wind ${report.current.windSpeedKmh} km/h ${report.current.windCompass}${uvText}.` +
    `${sunText}${aqiText} Forecast: ${dailySummary}.`;

  return [
    {
      position: 1,
      title: `${placeLabel} Weather & Air Quality — ${report.current.tempC}°C, ${report.current.condition}`,
      url: `https://open-meteo.com/en/docs#latitude=${report.latitude}&longitude=${report.longitude}`,
      snippet,
      domain: 'open-meteo.com',
      source: 'Open-Meteo Weather & Air Quality',
      weatherReport: report,
    },
  ];
}
