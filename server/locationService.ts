export type LocationDetectionMethod = 'gps' | 'ip' | 'manual' | 'disabled' | 'none';
export type LocationPreferenceMode = 'precise' | 'approximate' | 'manual' | 'disabled';

export interface LocationContext {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  accuracy?: number;
  detectionMethod: LocationDetectionMethod;
  source?: 'gps' | 'manual' | 'ip' | 'disabled' | 'none';
  updatedAt?: number;
  isApproximate?: boolean;
  locationEnabled?: boolean;
  homeCity?: string;
}

export interface GeocodedPlace {
  name: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  population?: number;
  displayName: string;
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

export function sanitizeTextField(val: unknown, maxLen = 120): string | undefined {
  if (typeof val !== 'string') return undefined;
  const cleaned = val.replace(/[\r\n\t\u0000-\u001f]+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLen);
}

export function sanitizeLocationContext(input: any): LocationContext | null {
  if (!input || typeof input !== 'object') return null;

  const rawMethod = String(input.detectionMethod || input.source || '').toLowerCase();
  if (input.locationEnabled === false || rawMethod === 'disabled') {
    return {
      detectionMethod: 'disabled',
      source: 'disabled',
      locationEnabled: false,
      updatedAt: typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt) ? input.updatedAt : Date.now(),
    };
  }

  let detectionMethod: LocationDetectionMethod = 'none';
  if (rawMethod === 'gps' || rawMethod === 'manual' || rawMethod === 'ip') {
    detectionMethod = rawMethod;
  }

  const city = sanitizeTextField(input.city || input.homeCity, 120);
  const region = sanitizeTextField(input.region, 120);
  const country = sanitizeTextField(input.country, 120);
  const rawCountryCode = sanitizeTextField(input.countryCode, 8);
  const countryCode = rawCountryCode ? rawCountryCode.toUpperCase() : undefined;
  const timezone = sanitizeTextField(input.timezone, 80);
  const homeCity = sanitizeTextField(input.homeCity, 120);

  const rawLat = typeof input.latitude === 'number' ? input.latitude : typeof input.lat === 'number' ? input.lat : undefined;
  const rawLng = typeof input.longitude === 'number' ? input.longitude : typeof input.lng === 'number' ? input.lng : undefined;
  const hasValidCoords = isValidCoordinate(rawLat, rawLng);

  const accuracy =
    typeof input.accuracy === 'number' && Number.isFinite(input.accuracy) && input.accuracy >= 0
      ? Math.round(input.accuracy)
      : undefined;

  const updatedAt =
    typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt) && input.updatedAt > 0
      ? input.updatedAt
      : typeof input.timestamp === 'number' && Number.isFinite(input.timestamp) && input.timestamp > 0
      ? input.timestamp
      : undefined;

  if (!city && !region && !country && !hasValidCoords && !timezone) {
    return null;
  }

  if (detectionMethod === 'none') {
    detectionMethod = hasValidCoords && accuracy !== undefined ? 'gps' : city ? 'ip' : 'none';
  }

  return {
    city,
    region,
    country,
    countryCode,
    latitude: hasValidCoords ? Number(rawLat) : undefined,
    longitude: hasValidCoords ? Number(rawLng) : undefined,
    timezone,
    accuracy,
    detectionMethod,
    source: detectionMethod,
    updatedAt,
    isApproximate: detectionMethod === 'ip',
    locationEnabled: true,
    homeCity,
  };
}

interface GeocodeCacheEntry {
  results: GeocodedPlace[];
  fetchedAt: number;
}

const geocodeCache = new Map<string, GeocodeCacheEntry>();
const GEOCODE_CACHE_TTL_MS = 30 * 60 * 1000;

export async function searchCitiesGeocoding(
  query: string,
  count = 6,
  preferredCountryCode?: string
): Promise<GeocodedPlace[]> {
  const cleanedQuery = sanitizeTextField(query, 100);
  if (!cleanedQuery || cleanedQuery.length < 2) return [];

  const clampedCount = Math.max(1, Math.min(10, Math.floor(count)));
  // Open-Meteo geocoding works best on primary city token if user typed "City, Country"
  const parts = cleanedQuery.split(',').map((p) => p.trim()).filter(Boolean);
  const primaryName = parts[0] || cleanedQuery;
  const qualifier = parts.slice(1).join(' ').toLowerCase();

  const cacheKey = `${cleanedQuery.toLowerCase()}:${clampedCount}:${(preferredCountryCode || '').toUpperCase()}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < GEOCODE_CACHE_TTL_MS) {
    return cached.results;
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      primaryName
    )}&count=${Math.min(10, clampedCount * 2)}&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const json: any = await res.json();
    const rawResults: any[] = Array.isArray(json?.results) ? json.results : [];

    let mapped: GeocodedPlace[] = rawResults
      .filter((r) => isValidCoordinate(r?.latitude, r?.longitude) && r?.name)
      .map((r) => {
        const name = String(r.name).trim();
        const region = r.admin1 ? String(r.admin1).trim() : undefined;
        const country = r.country ? String(r.country).trim() : undefined;
        const countryCode = r.country_code ? String(r.country_code).trim().toUpperCase() : undefined;
        const timezone = r.timezone ? String(r.timezone).trim() : undefined;
        const displayName = [name, region && region !== name ? region : undefined, country]
          .filter(Boolean)
          .join(', ');
        return {
          name,
          region,
          country,
          countryCode,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          timezone,
          population: typeof r.population === 'number' ? r.population : undefined,
          displayName,
        };
      });

    if (qualifier) {
      const qualMatched = mapped.filter(
        (m) =>
          (m.region && m.region.toLowerCase().includes(qualifier)) ||
          (m.country && m.country.toLowerCase().includes(qualifier)) ||
          (m.countryCode && m.countryCode.toLowerCase() === qualifier)
      );
      if (qualMatched.length > 0) {
        mapped = qualMatched;
      }
    } else if (preferredCountryCode) {
      const cc = preferredCountryCode.toUpperCase();
      mapped.sort((a, b) => {
        const aMatch = a.countryCode === cc ? 1 : 0;
        const bMatch = b.countryCode === cc ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return (b.population || 0) - (a.population || 0);
      });
    }

    const finalResults = mapped.slice(0, clampedCount);
    geocodeCache.set(cacheKey, { results: finalResults, fetchedAt: Date.now() });
    if (geocodeCache.size > 500) {
      const firstKey = geocodeCache.keys().next().value;
      if (firstKey) geocodeCache.delete(firstKey);
    }
    return finalResults;
  } catch {
    return [];
  }
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  options?: { locationIqKey?: string; fallbackTimezone?: string }
): Promise<LocationContext> {
  if (!isValidCoordinate(lat, lng)) {
    throw new Error('Invalid latitude or longitude coordinates');
  }

  let city = '';
  let region = '';
  let country = '';
  let countryCode = '';
  let timezone = sanitizeTextField(options?.fallbackTimezone, 80) || '';

  const locationIqKey = options?.locationIqKey || process.env.LOCATIONIQ_KEY || '';
  if (locationIqKey) {
    try {
      const response = await fetch(
        `https://us1.locationiq.com/v1/reverse?key=${encodeURIComponent(
          locationIqKey
        )}&lat=${lat}&lon=${lng}&format=json`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (response.ok) {
        const data: any = await response.json();
        const addr = data?.address || {};
        city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.county ||
          addr.state_district ||
          addr.suburb ||
          '';
        region = addr.state || addr.region || '';
        country = addr.country || '';
        countryCode = (addr.country_code || '').toUpperCase();
      }
    } catch {
      // Fall through to Nominatim without logging raw coordinates
    }
  }

  if (!city) {
    try {
      // Round slightly for upstream privacy when using third-party OSM lookup
      const approxLat = Math.round(lat * 1000) / 1000;
      const approxLng = Math.round(lng * 1000) / 1000;
      const resNom = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${approxLat}&lon=${approxLng}&zoom=10`,
        {
          headers: { 'User-Agent': 'KinichApp/1.0 (https://kinich.app; location-service)' },
          signal: AbortSignal.timeout(4500),
        }
      );
      if (resNom.ok) {
        const data: any = await resNom.json();
        const addr = data?.address || {};
        city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.county ||
          addr.state_district ||
          addr.suburb ||
          '';
        region = addr.state || addr.region || '';
        country = addr.country || '';
        countryCode = (addr.country_code || '').toUpperCase();
      }
    } catch {
      // Ignore upstream reverse geocode failures gracefully
    }
  }

  // Enrich timezone from Open-Meteo lightweight call if missing
  if (!timezone && city) {
    try {
      const places = await searchCitiesGeocoding(city, 1, countryCode || undefined);
      if (places[0]?.timezone) {
        timezone = places[0].timezone;
      }
    } catch {}
  }

  return {
    city: city || 'Current Location',
    region: region || undefined,
    country: country || undefined,
    countryCode: countryCode || undefined,
    timezone: timezone || undefined,
    detectionMethod: 'gps',
    source: 'gps',
    updatedAt: Date.now(),
    isApproximate: false,
    locationEnabled: true,
  };
}
