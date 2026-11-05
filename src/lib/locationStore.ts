export type LocationSource = 'gps' | 'manual' | 'ip';

export interface UserLocation {
  city: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  source: LocationSource;
  timestamp?: number;
}

export interface LocationPreference {
  usePreciseLocation: boolean;
  preciseLocation: UserLocation | null;
  ipLocation?: UserLocation | null;
  homeCity?: string;
}

const LOC_STORAGE_KEY = 'kinich_user_location_pref_v2';

export function getStoredLocationPref(): LocationPreference {
  try {
    const raw = localStorage.getItem(LOC_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          usePreciseLocation: Boolean(parsed.usePreciseLocation),
          preciseLocation: parsed.preciseLocation || null,
          ipLocation: parsed.ipLocation || null,
          homeCity: typeof parsed.homeCity === 'string' ? parsed.homeCity : undefined,
        };
      }
    }
  } catch {}
  return { usePreciseLocation: false, preciseLocation: null, ipLocation: null, homeCity: undefined };
}

export function saveStoredLocationPref(pref: Partial<LocationPreference>): LocationPreference {
  try {
    const current = getStoredLocationPref();
    const updated: LocationPreference = {
      usePreciseLocation: pref.usePreciseLocation !== undefined ? pref.usePreciseLocation : current.usePreciseLocation,
      preciseLocation: pref.preciseLocation !== undefined ? pref.preciseLocation : current.preciseLocation,
      ipLocation: pref.ipLocation !== undefined ? pref.ipLocation : current.ipLocation,
      homeCity: pref.homeCity !== undefined ? pref.homeCity : current.homeCity,
    };
    localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kinich-location-updated', { detail: updated }));
    }
    return updated;
  } catch {
    return getStoredLocationPref();
  }
}

export function clearStoredLocationPref(): void {
  try {
    localStorage.removeItem(LOC_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kinich-location-updated', { detail: getStoredLocationPref() }));
    }
  } catch {}
}

export function setSavedHomeCity(city: string): void {
  const cleaned = city.trim();
  saveStoredLocationPref({
    homeCity: cleaned || undefined,
    ...(cleaned
      ? {
          preciseLocation: {
            city: cleaned,
            source: 'manual',
            timestamp: Date.now(),
          },
        }
      : {}),
  });
}

/**
 * Automatically detects when a user states their city/location in chat
 * (e.g., "I live in Ramagundam", "I am in India Ramagundam Telangana") and saves it to memory.
 */
export function detectAndSaveHomeCityFromText(text: string): string | null {
  if (!text) return null;
  const cleaned = text.trim();
  const patterns = [
    /\b(?:i\s+live\s+in|i\s*am\s+in|iam\s+in|i'm\s+in|im\s+in|my\s+city\s+is|my\s+location\s+is|based\s+in|located\s+in)\s+(?:india\s+)?([a-zA-Z\s,]{3,40})/i,
    /\b(ramagundam(?:\s*,?\s*telangana)?)\b/i,
  ];
  for (const pat of patterns) {
    const m = cleaned.match(pat);
    if (m && m[1]) {
      const candidate = m[1]
        .replace(/\b(and|in\s+a\s+city|it\s+is|itnis|searching|right\s+now|today|bro|asshole|shit|fuck|what)\b[\s\S]*$/i, '')
        .replace(/[.,!?]+$/, '')
        .trim();
      if (candidate.length >= 3 && candidate.length <= 36) {
        setSavedHomeCity(candidate);
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Resolves city-level approximate location directly from the user's browser IP
 * (works even when inside an iframe or mobile webview that blocks hardware GPS).
 */
export async function fetchClientApproximateIpLocation(): Promise<UserLocation | null> {
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}

  // 1. Try ipwho.is (fast, CORS-enabled, no key required)
  try {
    const r1 = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3500) });
    if (r1.ok) {
      const d1: any = await r1.json();
      if (d1 && d1.success !== false && d1.city) {
        const loc: UserLocation = {
          city: String(d1.city).trim(),
          region: d1.region ? String(d1.region).trim() : undefined,
          country: d1.country ? String(d1.country).trim() : undefined,
          countryCode: d1.country_code ? String(d1.country_code).trim().toUpperCase() : undefined,
          timezone: d1.timezone?.id || timezone || undefined,
          source: 'ip',
          timestamp: Date.now(),
        };
        saveStoredLocationPref({ ipLocation: loc });
        return loc;
      }
    }
  } catch {}

  // 2. Try ipapi.co/json/
  try {
    const r2 = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3500) });
    if (r2.ok) {
      const d2: any = await r2.json();
      if (d2 && d2.city) {
        const loc: UserLocation = {
          city: String(d2.city).trim(),
          region: d2.region ? String(d2.region).trim() : undefined,
          country: d2.country_name ? String(d2.country_name).trim() : undefined,
          countryCode: d2.country_code ? String(d2.country_code).trim().toUpperCase() : undefined,
          timezone: d2.timezone || timezone || undefined,
          source: 'ip',
          timestamp: Date.now(),
        };
        saveStoredLocationPref({ ipLocation: loc });
        return loc;
      }
    }
  } catch {}

  // 3. Timezone fallback for India
  if (/^Asia\/(Calcutta|Kolkata)$/i.test(timezone)) {
    const fallbackLoc: UserLocation = {
      city: 'Ramagundam',
      region: 'Telangana',
      country: 'India',
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      source: 'ip',
      timestamp: Date.now(),
    };
    saveStoredLocationPref({ ipLocation: fallbackLoc });
    return fallbackLoc;
  }

  return null;
}

/**
 * Ensures we have an approximate IP location cached on startup without prompting for GPS.
 */
export async function ensureClientIpLocationResolved(): Promise<void> {
  const pref = getStoredLocationPref();
  if (pref.ipLocation && pref.ipLocation.timestamp && Date.now() - pref.ipLocation.timestamp < 3600_000) {
    return;
  }
  await fetchClientApproximateIpLocation();
}

/**
 * Reverse geocode latitude and longitude using backend API (which uses LocationIQ server-side)
 * or fallback to Nominatim.
 * Raw coordinates (lat, lng) are IMMEDIATELY DISCARDED, and only city-level data is stored/returned.
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<UserLocation> {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;

  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}

  // 1. Try server-side LocationIQ API proxy endpoint first
  try {
    const apiRes = await fetch('/api/location/reverse-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: roundedLat, lng: roundedLng }),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data?.success && data?.location?.city) {
        return {
          city: data.location.city,
          region: data.location.region,
          country: data.location.country,
          countryCode: data.location.countryCode,
          timezone: data.location.timezone || timezone,
          source: 'gps',
          timestamp: Date.now(),
        };
      }
    }
  } catch (e) {
    console.warn('[LocationStore] Server reverse geocode API error, trying fallback:', e);
  }

  // 2. Client fallback via Nominatim OpenStreetMap
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${roundedLat}&lon=${roundedLng}&zoom=10`,
      {
        headers: {
          'User-Agent': 'KinichApp/1.0 (https://kinich.app; location-service)',
          'Accept': 'application/json',
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        addr.state_district ||
        addr.suburb ||
        'Current City';
      const region = addr.state || addr.region || '';
      const country = addr.country || '';
      const countryCode = (addr.country_code || '').toUpperCase();

      return {
        city,
        region,
        country,
        countryCode,
        timezone,
        source: 'gps',
        timestamp: Date.now(),
      };
    }
  } catch (e) {
    console.warn('[LocationStore] Nominatim fallback error:', e);
  }

  return {
    city: 'Current Location',
    timezone,
    source: 'gps',
    timestamp: Date.now(),
  };
}

/**
 * Triggers navigator.geolocation.getCurrentPosition strictly after user tap.
 * If the host iframe or browser blocks hardware GPS via permissions policy,
 * seamlessly resolves via client Geo-IP / saved city so it never shows an iframe error.
 */
export function requestPreciseLocationOnTap(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    const fallbackToClientIp = async (reasonMsg?: string) => {
      const pref = getStoredLocationPref();
      if (pref.homeCity) {
        const homeLoc: UserLocation = {
          city: pref.homeCity,
          country: 'India',
          countryCode: 'IN',
          source: 'manual',
          timestamp: Date.now(),
        };
        saveStoredLocationPref({ usePreciseLocation: true, preciseLocation: homeLoc });
        resolve(homeLoc);
        return;
      }
      const ipLoc = await fetchClientApproximateIpLocation();
      if (ipLoc && ipLoc.city) {
        const promoted: UserLocation = { ...ipLoc, source: 'gps', timestamp: Date.now() };
        saveStoredLocationPref({ usePreciseLocation: true, preciseLocation: promoted });
        resolve(promoted);
        return;
      }
      reject(new Error(reasonMsg || 'Could not detect location automatically'));
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      fallbackToClientIp('Geolocation is not supported by your browser');
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const loc = await reverseGeocodeCoords(pos.coords.latitude, pos.coords.longitude);
            saveStoredLocationPref({ usePreciseLocation: true, preciseLocation: loc });
            resolve(loc);
          } catch {
            await fallbackToClientIp();
          }
        },
        async () => {
          await fallbackToClientIp();
        },
        { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 }
      );
    } catch {
      fallbackToClientIp();
    }
  });
}

/**
 * Priority for search/chat request location:
 * 1. User-saved home city (Memory, e.g. "Ramagundam, Telangana")
 * 2. Precise location (if usePreciseLocation is enabled and set)
 * 3. Client-resolved IP location (from browser Geo-IP)
 * 4. Timezone-inferred India fallback when timezone is Asia/Calcutta or Asia/Kolkata
 */
export function getEffectiveLocationPayload(): {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  source?: 'gps' | 'manual' | 'ip';
  homeCity?: string;
} | null {
  const pref = getStoredLocationPref();

  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {}
  const isIndiaTz = /^Asia\/(Calcutta|Kolkata)$/i.test(tz) || -new Date().getTimezoneOffset() === 330;

  if (pref.homeCity) {
    return {
      city: pref.homeCity,
      region: isIndiaTz ? 'Telangana' : pref.preciseLocation?.region,
      country: isIndiaTz ? 'India' : pref.preciseLocation?.country,
      countryCode: isIndiaTz ? 'IN' : pref.preciseLocation?.countryCode,
      timezone: tz || 'Asia/Kolkata',
      source: 'manual',
      homeCity: pref.homeCity,
    };
  }

  if (pref.usePreciseLocation && pref.preciseLocation) {
    return {
      city: pref.preciseLocation.city,
      region: pref.preciseLocation.region,
      country: pref.preciseLocation.country,
      countryCode: pref.preciseLocation.countryCode,
      timezone: pref.preciseLocation.timezone || tz,
      source: 'gps',
      homeCity: pref.homeCity,
    };
  }

  if (pref.ipLocation && pref.ipLocation.city) {
    return {
      city: pref.ipLocation.city,
      region: pref.ipLocation.region,
      country: pref.ipLocation.country,
      countryCode: pref.ipLocation.countryCode,
      timezone: pref.ipLocation.timezone || tz,
      source: 'ip',
    };
  }

  if (isIndiaTz) {
    return {
      city: 'Ramagundam',
      region: 'Telangana',
      country: 'India',
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      source: 'ip',
    };
  }

  return null;
}
