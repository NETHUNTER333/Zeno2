import { LocationContext, searchCitiesGeocoding } from './locationService';
import { getLiveWeatherReport, WeatherReport } from './weatherService';

export type LocationIntentType = 'weather' | 'time' | 'nearby' | 'local_news' | 'none';

export interface LocationIntentAnalysis {
  isLocationDependent: boolean;
  intentType: LocationIntentType;
  explicitPlace?: string;
  usesImplicitCurrentLocation: boolean;
}

const WEATHER_KEYWORDS_RE =
  /\b(weather|forecast|temperature|rain|raining|umbrella|monsoon|humidity|wind\s+speed|uv\s+index|air\s+quality|aqi|pm2\.?5|pollution|climate|outside|cold\s+outside|hot\s+outside|sunrise|sunset)\b/i;

const TIME_KEYWORDS_RE =
  /\b(what(?:'s|\s+is)\s+the\s+(?:current\s+|local\s+)?time|current\s+time|local\s+time|what\s+time\s+is\s+it|time\s+right\s+now|timezone)\b/i;

const IMPLICIT_LOCAL_PHRASES_RE =
  /\b(near\s+me|around\s+me|nearby|closest\s+to\s+me|nearest|in\s+my\s+city|in\s+my\s+area|my\s+current\s+location|where\s+am\s+i|what(?:'s|\s+is)\s+happening\s+(?:around\s+me|here|nearby)|events?\s+(?:near\s+me|around\s+me|nearby|here)|restaurants?\s+(?:near\s+me|nearby)|hospitals?\s+(?:near\s+me|nearby)|airports?\s+(?:near\s+me|nearby)|cafes?\s+(?:near\s+me|nearby)|outside)\b/i;

const LOCAL_NEWS_RE =
  /\b(local\s+news|local\s+events?|city\s+news|news\s+(?:near\s+me|around\s+me|here|in\s+my\s+city))\b/i;

const PLACE_STOPWORDS_RE =
  /^(me|here|today|tomorrow|tonight|now|right\s+now|this\s+week|this\s+weekend|the\s+moment|outside|my\s+city|my\s+area|my\s+location|current\s+location)$/i;

export function extractExplicitPlaceFromQuery(query: string): string | undefined {
  if (!query) return undefined;
  const q = query.trim();

  // Pattern 1: "... in/for/at/around <Place>"
  const m1 = q.match(
    /\b(?:weather|forecast|temperature|rain|humidity|air\s+quality|aqi|time|sunrise|sunset|restaurants?|cafes?|hospitals?|hotels?|airports?|events?|happening|news)\s+(?:in|for|at|around|near)\s+([a-zA-Z\u00C0-\u024F\s,.-]{2,45})/i
  );
  if (m1 && m1[1]) {
    const candidate = m1[1]
      .replace(/\b(today|tomorrow|tonight|now|right\s+now|this\s+week|please|currently)\b[\s\S]*$/i, '')
      .replace(/[?!.,;:]+$/, '')
      .trim();
    if (candidate.length >= 2 && !PLACE_STOPWORDS_RE.test(candidate)) {
      return candidate;
    }
  }

  // Pattern 2: "<Place> weather / forecast / temperature / time"
  const m2 = q.match(
    /^([a-zA-Z\u00C0-\u024F\s,.-]{2,35})\s+(?:weather|temperature|forecast|5-day\s+forecast|aqi|air\s+quality|time)\b/i
  );
  if (m2 && m2[1]) {
    const candidate = m2[1].replace(/[?!.,;:]+$/, '').trim();
    if (
      candidate.length >= 2 &&
      !/^(what|how|is|the|current|today|tomorrow|local|live|check|tell\s+me|give\s+me|what's)$/i.test(
        candidate
      ) &&
      !PLACE_STOPWORDS_RE.test(candidate)
    ) {
      return candidate;
    }
  }

  return undefined;
}

export function analyzeLocationIntent(userQuery: string): LocationIntentAnalysis {
  const q = String(userQuery || '').trim();
  if (!q) {
    return {
      isLocationDependent: false,
      intentType: 'none',
      usesImplicitCurrentLocation: false,
    };
  }

  const explicitPlace = extractExplicitPlaceFromQuery(q);
  const isWeather = WEATHER_KEYWORDS_RE.test(q);
  const isTime = TIME_KEYWORDS_RE.test(q);
  const isLocalNews = LOCAL_NEWS_RE.test(q);
  const isImplicitLocal = IMPLICIT_LOCAL_PHRASES_RE.test(q);

  let intentType: LocationIntentType = 'none';
  if (isWeather) intentType = 'weather';
  else if (isTime) intentType = 'time';
  else if (isLocalNews) intentType = 'local_news';
  else if (isImplicitLocal) intentType = 'nearby';

  const isLocationDependent = intentType !== 'none';
  const usesImplicitCurrentLocation = isLocationDependent && !explicitPlace;

  return {
    isLocationDependent,
    intentType,
    explicitPlace,
    usesImplicitCurrentLocation,
  };
}

function formatCurrentTimeForZone(timezone?: string): string | null {
  if (!timezone) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(new Date());
  } catch {
    return null;
  }
}

export interface BuiltLocationPromptContext {
  intent: LocationIntentAnalysis;
  weatherReport?: WeatherReport | null;
  systemBlock: string;
  targetPlaceLabel?: string;
}

/**
 * Builds targeted location + environmental context for /api/chat ONLY when relevant.
 * Never injects user location into unrelated conversations.
 */
export async function buildLocationContextForChat(
  userQuery: string,
  userLocation: LocationContext
): Promise<BuiltLocationPromptContext> {
  const intent = analyzeLocationIntent(userQuery);

  if (!intent.isLocationDependent) {
    return {
      intent,
      weatherReport: null,
      systemBlock: '',
    };
  }

  // Case 1: User explicitly named another city/place -> prioritize that place over current location!
  if (intent.explicitPlace) {
    let weatherReport: WeatherReport | null = null;
    let resolvedTz: string | undefined;
    let resolvedLabel = intent.explicitPlace;

    if (intent.intentType === 'weather') {
      weatherReport = await getLiveWeatherReport({
        city: intent.explicitPlace,
        countryCode: undefined, // Do NOT bias explicit foreign city queries toward user's country
      });
      if (weatherReport) {
        resolvedTz = weatherReport.timezone;
        resolvedLabel = [weatherReport.locationName, weatherReport.region, weatherReport.country]
          .filter(Boolean)
          .join(', ');
      }
    } else if (intent.intentType === 'time') {
      const places = await searchCitiesGeocoding(intent.explicitPlace, 1);
      if (places[0]) {
        resolvedTz = places[0].timezone;
        resolvedLabel = places[0].displayName;
      }
    }

    const lines: string[] = [
      `[EXPLICIT PLACE CONTEXT]: User asked specifically about "${resolvedLabel}". Prioritize "${resolvedLabel}" over the user's current location.`,
    ];
    if (resolvedTz) {
      const formattedTime = formatCurrentTimeForZone(resolvedTz);
      if (formattedTime) {
        lines.push(`- Current local date & time in ${resolvedLabel}: ${formattedTime} (${resolvedTz}).`);
      }
    }
    if (weatherReport) {
      lines.push(formatWeatherSummaryBlock(weatherReport));
    }

    return {
      intent,
      weatherReport,
      targetPlaceLabel: resolvedLabel,
      systemBlock: `\n${lines.join('\n')}`,
    };
  }

  // Case 2: Implicit current-location query ("near me", "weather today", "what's the time", etc.)
  const isDisabled = userLocation.detectionMethod === 'disabled' || userLocation.locationEnabled === false;
  const hasLocationData = Boolean(
    userLocation.city || (userLocation.latitude !== undefined && userLocation.longitude !== undefined)
  );

  if (isDisabled || !hasLocationData) {
    const reason = isDisabled
      ? 'Location access is currently disabled by the user.'
      : 'The user’s city/coordinates could not be automatically determined.';
    return {
      intent,
      weatherReport: null,
      systemBlock:
        `\n[LOCATION CONTEXT UNAVAILABLE]: ${reason}\n` +
        `- STRICT RULE: Do NOT fabricate, guess, or invent a city, weather reading, or nearby businesses.\n` +
        `- Politely let the user know that you need their city name (or for them to enable location access in Kinich) to answer accurately, and ask which city they want to check.`,
    };
  }

  const placeLabel = [userLocation.city, userLocation.region, userLocation.country || userLocation.countryCode]
    .filter(Boolean)
    .join(', ');

  let weatherReport: WeatherReport | null = null;
  if (intent.intentType === 'weather') {
    weatherReport = await getLiveWeatherReport({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      city: userLocation.city,
      region: userLocation.region,
      country: userLocation.country,
      countryCode: userLocation.countryCode,
      timezone: userLocation.timezone,
    });
  }

  const effectiveTz = weatherReport?.timezone || userLocation.timezone;
  const formattedLocalTime = formatCurrentTimeForZone(effectiveTz);
  const precisionNote =
    userLocation.detectionMethod === 'gps'
      ? `Precise device geolocation${userLocation.accuracy ? ` (±${userLocation.accuracy}m)` : ''}`
      : userLocation.detectionMethod === 'manual'
      ? 'User-selected manual city'
      : 'Approximate IP-based city estimate (never claim to know the user’s exact street address)';

  const updatedIso = userLocation.updatedAt
    ? new Date(userLocation.updatedAt).toISOString()
    : 'recent';

  const lines: string[] = [
    `[USER LOCATION CONTEXT]:`,
    `- Active Location: ${placeLabel || 'Coordinates provided'}`,
    `- Detection Method: ${precisionNote} (Updated: ${updatedIso})`,
  ];
  if (effectiveTz) {
    lines.push(`- Local Timezone: ${effectiveTz}${formattedLocalTime ? ` | Local Time: ${formattedLocalTime}` : ''}`);
  }
  if (userLocation.detectionMethod === 'ip') {
    lines.push(
      `- Privacy & Accuracy Guidance: Since this location is approximate from IP, give city-level recommendations and briefly mention the city name used so the user can correct it if they are traveling or on a VPN. Never claim to know an exact street address.`
    );
  }
  if (weatherReport) {
    lines.push(formatWeatherSummaryBlock(weatherReport));
  }

  return {
    intent,
    weatherReport,
    targetPlaceLabel: placeLabel,
    systemBlock: `\n${lines.join('\n')}`,
  };
}

function formatWeatherSummaryBlock(report: WeatherReport): string {
  const freshness = report.cached
    ? `Cached ${report.cacheAgeSeconds}s ago (Open-Meteo)`
    : 'Live reading (Open-Meteo)';
  const aqiPart = report.airQuality
    ? ` | Air Quality: US AQI ${report.airQuality.usAqi ?? 'N/A'} (${report.airQuality.category}${
        report.airQuality.pm2_5 !== undefined ? `, PM2.5 ${report.airQuality.pm2_5} µg/m³` : ''
      })`
    : '';
  const uvPart =
    report.current.uvIndex !== undefined
      ? ` | UV Index: ${report.current.uvIndex}${
          report.today.uvIndexMax !== undefined ? ` (max ${report.today.uvIndexMax})` : ''
        }`
      : '';
  const sunPart =
    report.today.sunrise && report.today.sunset
      ? ` | Sunrise: ${report.today.sunrise}, Sunset: ${report.today.sunset}`
      : '';
  const nextDays = report.daily
    .slice(0, 5)
    .map(
      (d) =>
        `${d.dayName}: ${d.condition} ${d.tempMaxC}°C/${d.tempMinC}°C (${d.rainChancePct}% rain)`
    )
    .join('; ');

  return (
    `- Weather & Environment (${freshness}, ${report.timezone}): ` +
    `${report.current.tempC}°C (feels like ${report.current.feelsLikeC}°C), ${report.current.condition}. ` +
    `High ${report.today.highC}°C / Low ${report.today.lowC}°C, Rain chance ${report.today.rainChancePct}%, ` +
    `Humidity ${report.current.humidityPct}%, Wind ${report.current.windSpeedKmh} km/h ${report.current.windCompass}` +
    `${uvPart}${sunPart}${aqiPart}.\n` +
    `- 5-Day Outlook: ${nextDays}`
  );
}
