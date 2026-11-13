import {
  auth,
  deleteUserLocationPrefFromFirestore,
  loadUserLocationPrefFromFirestore,
  saveUserLocationPrefToFirestore,
  type FirestoreLocationPreferenceDoc,
} from './firebase';

export type LocationSource = 'gps' | 'manual' | 'ip' | 'disabled' | 'none';
export type LocationPreferenceMode = 'precise' | 'approximate' | 'manual' | 'disabled';
export type LocationPermissionState =
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'insecure'
  | 'unknown';

export interface UserLocation {
  city: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  accuracy?: number;
  source: LocationSource;
  detectionMethod?: LocationSource;
  timestamp?: number;
  updatedAt?: number;
  isApproximate?: boolean;
}

export interface GeocodedCityPlace {
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

export interface LocationPreference {
  locationEnabled: boolean;
  mode: LocationPreferenceMode;
  usePreciseLocation: boolean;
  persistPreciseLocation: boolean;
  preciseLocation: UserLocation | null;
  ipLocation?: UserLocation | null;
  manualLocation?: UserLocation | null;
  homeCity?: string;
  permissionState: LocationPermissionState;
  lastError?: string | null;
  updatedAt: number;
}

export interface PreciseLocationResult {
  location: UserLocation | null;
  permissionState: LocationPermissionState;
  usedFallback: boolean;
  errorCode?: 'permission_denied' | 'timeout' | 'position_unavailable' | 'unsupported' | 'insecure_context';
  errorMessage?: string;
}

const LOC_STORAGE_KEY = 'kinich_user_location_pref_v2';

// Ephemeral in-memory storage for precise GPS coordinates when persistPreciseLocation is false
let sessionPreciseLocation: UserLocation | null = null;

function isValidCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function getDefaultLocationPref(): LocationPreference {
  return {
    locationEnabled: true,
    mode: 'approximate',
    usePreciseLocation: false,
    persistPreciseLocation: false,
    preciseLocation: null,
    ipLocation: null,
    manualLocation: null,
    homeCity: undefined,
    permissionState: 'unknown',
    lastError: null,
    updatedAt: 0,
  };
}

function emitLocationUpdated(pref: LocationPreference) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kinich-location-updated', { detail: pref }));
  }
}

export function getStoredLocationPref(): LocationPreference {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOC_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const locationEnabled = parsed.locationEnabled !== false && parsed.mode !== 'disabled';
        let mode: LocationPreferenceMode = 'approximate';
        if (!locationEnabled || parsed.mode === 'disabled') {
          mode = 'disabled';
        } else if (parsed.mode === 'precise' || parsed.usePreciseLocation) {
          mode = 'precise';
        } else if (parsed.mode === 'manual' || parsed.manualLocation?.city || parsed.homeCity) {
          mode = 'manual';
        }

        const storedPrecise = parsed.preciseLocation || null;
        const activePrecise = sessionPreciseLocation || storedPrecise;

        return {
          locationEnabled,
          mode,
          usePreciseLocation: mode === 'precise' && Boolean(parsed.usePreciseLocation),
          persistPreciseLocation: Boolean(parsed.persistPreciseLocation),
          preciseLocation: activePrecise,
          ipLocation: parsed.ipLocation || null,
          manualLocation: parsed.manualLocation || (parsed.homeCity ? { city: parsed.homeCity, source: 'manual' } : null),
          homeCity: typeof parsed.homeCity === 'string' ? parsed.homeCity : parsed.manualLocation?.city,
          permissionState: parsed.permissionState || 'unknown',
          lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        };
      }
    }
  } catch {}
  return {
    ...getDefaultLocationPref(),
    preciseLocation: sessionPreciseLocation,
  };
}

function persistLocalPref(updated: LocationPreference): void {
  try {
    const toPersist: LocationPreference = {
      ...updated,
      // Keep raw precise GPS coordinates out of persistent storage unless user explicitly opted in
      preciseLocation: updated.persistPreciseLocation
        ? updated.preciseLocation
        : updated.preciseLocation
        ? {
            city: updated.preciseLocation.city,
            region: updated.preciseLocation.region,
            country: updated.preciseLocation.country,
            countryCode: updated.preciseLocation.countryCode,
            timezone: updated.preciseLocation.timezone,
            source: updated.preciseLocation.source,
            detectionMethod: updated.preciseLocation.detectionMethod,
            timestamp: updated.preciseLocation.timestamp,
            updatedAt: updated.preciseLocation.updatedAt,
          }
        : null,
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOC_STORAGE_KEY, JSON.stringify(toPersist));
    }
  } catch {}
}

export function pushLocationPrefToFirestore(pref: LocationPreference): void {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const activeCitySource =
    pref.mode === 'manual'
      ? pref.manualLocation
      : pref.mode === 'precise' && pref.persistPreciseLocation
      ? pref.preciseLocation
      : undefined;

  const allowCoords =
    pref.mode === 'manual' || (pref.mode === 'precise' && pref.persistPreciseLocation);

  const coordsSource =
    pref.mode === 'manual'
      ? pref.manualLocation
      : pref.persistPreciseLocation
      ? pref.preciseLocation
      : undefined;

  saveUserLocationPrefToFirestore({
    locationEnabled: pref.locationEnabled,
    mode: pref.mode,
    preferredCity: activeCitySource?.city || pref.homeCity,
    preferredRegion: activeCitySource?.region,
    preferredCountry: activeCitySource?.country,
    preferredCountryCode: activeCitySource?.countryCode,
    preferredTimezone: activeCitySource?.timezone,
    preferredLatitude:
      allowCoords && isValidCoords(coordsSource?.latitude, coordsSource?.longitude)
        ? coordsSource?.latitude
        : undefined,
    preferredLongitude:
      allowCoords && isValidCoords(coordsSource?.latitude, coordsSource?.longitude)
        ? coordsSource?.longitude
        : undefined,
    persistPreciseLocation: Boolean(pref.persistPreciseLocation),
    updatedAt: pref.updatedAt || Date.now(),
  }).catch(() => {});
}

export function saveStoredLocationPref(
  pref: Partial<LocationPreference>,
  options?: { syncFirestore?: boolean }
): LocationPreference {
  const current = getStoredLocationPref();
  const nextLocationEnabled =
    pref.locationEnabled !== undefined
      ? pref.locationEnabled
      : pref.mode === 'disabled'
      ? false
      : pref.mode !== undefined
      ? true
      : current.locationEnabled;

  let nextMode: LocationPreferenceMode = pref.mode ?? current.mode;
  if (!nextLocationEnabled) {
    nextMode = 'disabled';
  } else if (pref.mode === undefined && !current.locationEnabled) {
    nextMode = pref.usePreciseLocation ? 'precise' : pref.manualLocation || pref.homeCity ? 'manual' : 'approximate';
  }

  if (pref.preciseLocation !== undefined) {
    sessionPreciseLocation = pref.preciseLocation;
  }

  const updated: LocationPreference = {
    locationEnabled: nextLocationEnabled,
    mode: nextMode,
    usePreciseLocation:
      pref.usePreciseLocation !== undefined
        ? pref.usePreciseLocation
        : nextMode === 'precise',
    persistPreciseLocation:
      pref.persistPreciseLocation !== undefined
        ? pref.persistPreciseLocation
        : current.persistPreciseLocation,
    preciseLocation:
      pref.preciseLocation !== undefined ? pref.preciseLocation : current.preciseLocation,
    ipLocation: pref.ipLocation !== undefined ? pref.ipLocation : current.ipLocation,
    manualLocation: pref.manualLocation !== undefined ? pref.manualLocation : current.manualLocation,
    homeCity: pref.homeCity !== undefined ? pref.homeCity : current.homeCity,
    permissionState: pref.permissionState !== undefined ? pref.permissionState : current.permissionState,
    lastError: pref.lastError !== undefined ? pref.lastError : current.lastError,
    updatedAt: pref.updatedAt ?? Date.now(),
  };

  persistLocalPref(updated);
  emitLocationUpdated(updated);

  if (options?.syncFirestore !== false) {
    pushLocationPrefToFirestore(updated);
  }
  return updated;
}

export async function clearStoredLocationPref(options?: { deleteRemote?: boolean }): Promise<void> {
  sessionPreciseLocation = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOC_STORAGE_KEY);
    }
  } catch {}
  if (options?.deleteRemote !== false) {
    await deleteUserLocationPrefFromFirestore().catch(() => {});
  }
  emitLocationUpdated(getStoredLocationPref());
}

export async function syncLocationPrefFromFirestore(): Promise<LocationPreference> {
  const local = getStoredLocationPref();
  const remote: FirestoreLocationPreferenceDoc | null = await loadUserLocationPrefFromFirestore().catch(
    () => null
  );
  if (!remote) return local;

  // Merge newest preference state without wiping local transient IP or session GPS if remote is older
  if (remote.updatedAt && local.updatedAt && local.updatedAt > remote.updatedAt) {
    pushLocationPrefToFirestore(local);
    return local;
  }

  const manualLoc: UserLocation | null =
    remote.mode === 'manual' && remote.preferredCity
      ? {
          city: remote.preferredCity,
          region: remote.preferredRegion,
          country: remote.preferredCountry,
          countryCode: remote.preferredCountryCode,
          timezone: remote.preferredTimezone,
          latitude: isValidCoords(remote.preferredLatitude, remote.preferredLongitude)
            ? remote.preferredLatitude
            : undefined,
          longitude: isValidCoords(remote.preferredLatitude, remote.preferredLongitude)
            ? remote.preferredLongitude
            : undefined,
          source: 'manual',
          detectionMethod: 'manual',
          updatedAt: remote.updatedAt,
          timestamp: remote.updatedAt,
        }
      : null;

  const preciseLoc: UserLocation | null =
    remote.mode === 'precise' && remote.persistPreciseLocation && remote.preferredCity
      ? {
          city: remote.preferredCity,
          region: remote.preferredRegion,
          country: remote.preferredCountry,
          countryCode: remote.preferredCountryCode,
          timezone: remote.preferredTimezone,
          latitude: isValidCoords(remote.preferredLatitude, remote.preferredLongitude)
            ? remote.preferredLatitude
            : undefined,
          longitude: isValidCoords(remote.preferredLatitude, remote.preferredLongitude)
            ? remote.preferredLongitude
            : undefined,
          source: 'gps',
          detectionMethod: 'gps',
          updatedAt: remote.updatedAt,
          timestamp: remote.updatedAt,
        }
      : local.preciseLocation;

  const merged = saveStoredLocationPref(
    {
      locationEnabled: remote.locationEnabled,
      mode: remote.mode,
      usePreciseLocation: remote.mode === 'precise',
      persistPreciseLocation: Boolean(remote.persistPreciseLocation),
      manualLocation: manualLoc,
      homeCity: manualLoc?.city,
      preciseLocation: remote.locationEnabled ? preciseLoc : null,
      updatedAt: remote.updatedAt || Date.now(),
    },
    { syncFirestore: false }
  );
  return merged;
}

export function setLocationDisabled(disabled: boolean): LocationPreference {
  if (disabled) {
    sessionPreciseLocation = null;
    return saveStoredLocationPref({
      locationEnabled: false,
      mode: 'disabled',
      usePreciseLocation: false,
      preciseLocation: null,
      lastError: null,
    });
  }
  const current = getStoredLocationPref();
  const nextMode: LocationPreferenceMode =
    current.manualLocation?.city || current.homeCity ? 'manual' : 'approximate';
  return saveStoredLocationPref({
    locationEnabled: true,
    mode: nextMode,
    usePreciseLocation: false,
    lastError: null,
  });
}

export function setLocationMode(mode: LocationPreferenceMode): LocationPreference {
  if (mode === 'disabled') {
    return setLocationDisabled(true);
  }
  return saveStoredLocationPref({
    locationEnabled: true,
    mode,
    usePreciseLocation: mode === 'precise',
    lastError: null,
  });
}

export function setPersistPreciseLocation(persist: boolean): LocationPreference {
  const current = getStoredLocationPref();
  return saveStoredLocationPref({
    persistPreciseLocation: persist,
    preciseLocation: current.preciseLocation,
  });
}

export function setManualLocationPlace(place: GeocodedCityPlace): LocationPreference {
  const now = Date.now();
  const manualLoc: UserLocation = {
    city: place.name.trim(),
    region: place.region?.trim() || undefined,
    country: place.country?.trim() || undefined,
    countryCode: place.countryCode?.trim().toUpperCase() || undefined,
    latitude: isValidCoords(place.latitude, place.longitude) ? place.latitude : undefined,
    longitude: isValidCoords(place.latitude, place.longitude) ? place.longitude : undefined,
    timezone: place.timezone?.trim() || undefined,
    source: 'manual',
    detectionMethod: 'manual',
    timestamp: now,
    updatedAt: now,
    isApproximate: false,
  };

  return saveStoredLocationPref({
    locationEnabled: true,
    mode: 'manual',
    usePreciseLocation: false,
    manualLocation: manualLoc,
    homeCity: manualLoc.city,
    lastError: null,
  });
}

export function setSavedHomeCity(city: string): void {
  const cleaned = city.trim();
  if (!cleaned) {
    const cur = getStoredLocationPref();
    saveStoredLocationPref({
      homeCity: undefined,
      manualLocation: null,
      mode: cur.locationEnabled ? (cur.usePreciseLocation ? 'precise' : 'approximate') : 'disabled',
    });
    return;
  }

  const now = Date.now();
  const manualLoc: UserLocation = {
    city: cleaned,
    source: 'manual',
    detectionMethod: 'manual',
    timestamp: now,
    updatedAt: now,
    isApproximate: false,
  };

  saveStoredLocationPref({
    locationEnabled: true,
    mode: 'manual',
    usePreciseLocation: false,
    homeCity: cleaned,
    manualLocation: manualLoc,
    lastError: null,
  });

  // Enrich coordinates, country, and timezone via real geocoding in background
  void searchCities(cleaned, 1).then((places) => {
    if (places.length > 0) {
      const latest = getStoredLocationPref();
      if (latest.mode === 'manual' && latest.homeCity === cleaned) {
        setManualLocationPlace(places[0]);
      }
    }
  });
}

/**
 * Searches real cities & regions worldwide using backend Open-Meteo geocoding proxy (with direct fallback).
 */
export async function searchCities(query: string, count = 6): Promise<GeocodedCityPlace[]> {
  const cleaned = query.trim();
  if (cleaned.length < 2) return [];

  try {
    const res = await fetch(
      `/api/location/search?q=${encodeURIComponent(cleaned)}&count=${count}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.results)) {
        return data.results;
      }
    }
  } catch {}

  try {
    const primary = cleaned.split(',')[0].trim();
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        primary
      )}&count=${count}&language=en&format=json`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data: any = await res.json();
      const raw: any[] = Array.isArray(data?.results) ? data.results : [];
      return raw
        .filter((r) => isValidCoords(r?.latitude, r?.longitude) && r?.name)
        .map((r) => ({
          name: String(r.name).trim(),
          region: r.admin1 ? String(r.admin1).trim() : undefined,
          country: r.country ? String(r.country).trim() : undefined,
          countryCode: r.country_code ? String(r.country_code).trim().toUpperCase() : undefined,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          timezone: r.timezone ? String(r.timezone).trim() : undefined,
          population: typeof r.population === 'number' ? r.population : undefined,
          displayName: [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : undefined, r.country]
            .filter(Boolean)
            .join(', '),
        }));
    }
  } catch {}

  return [];
}

/**
 * Detects when a user explicitly states their city/location in chat
 * (e.g., "I live in Hyderabad", "I am in Tokyo", "I'm based in London").
 * Respects disabled mode and verifies candidate against real geocoding.
 */
export function detectAndSaveHomeCityFromText(text: string): string | null {
  if (!text) return null;
  const pref = getStoredLocationPref();
  if (!pref.locationEnabled || pref.mode === 'disabled') return null;

  const cleaned = text.trim();
  const patterns = [
    /\b(?:i\s+live\s+in|i\s*am\s+in|i'm\s+in|my\s+city\s+is|my\s+location\s+is|i\s+moved\s+to|i'm\s+based\s+in|based\s+in|located\s+in)\s+([a-zA-Z\u00C0-\u024F\s,]{2,45})/i,
  ];
  for (const pat of patterns) {
    const m = cleaned.match(pat);
    if (m && m[1]) {
      const candidate = m[1]
        .replace(
          /\b(and|right\s+now|today|currently|this\s+week|for\s+work|what|how|where|is|are|please|too|now)\b[\s\S]*$/i,
          ''
        )
        .replace(/[.,!?]+$/, '')
        .trim();
      if (
        candidate.length >= 2 &&
        candidate.length <= 40 &&
        !/^(the|a|an|my|here|there|home|bed|school|college|office|class|trouble|love|pain)$/i.test(
          candidate
        )
      ) {
        void searchCities(candidate, 1).then((places) => {
          if (places.length > 0) {
            setManualLocationPlace(places[0]);
          }
        });
        return candidate;
      }
    }
  }
  return null;
}

export function isSecureLocationContext(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.isSecureContext) return true;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

export async function checkGeolocationPermission(): Promise<LocationPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'unsupported';
  }
  if (!isSecureLocationContext()) {
    return 'insecure';
  }
  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
        return status.state;
      }
    }
  } catch {}
  return 'unknown';
}

/**
 * Resolves city-level approximate location from server edge headers or reputable IP provider.
 * Never treats IP as precise GPS and never fabricates a specific city solely from timezone.
 */
export async function fetchClientApproximateIpLocation(): Promise<UserLocation | null> {
  const pref = getStoredLocationPref();
  if (!pref.locationEnabled || pref.mode === 'disabled') {
    return null;
  }

  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}

  // 1. Try Kinich backend edge/IP proxy first (keeps raw IP server-transient & never logs it)
  try {
    const r0 = await fetch(`/api/location/ip${timezone ? `?tz=${encodeURIComponent(timezone)}` : ''}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (r0.ok) {
      const d0: any = await r0.json();
      const loc0 = d0?.location;
      if (loc0 && (loc0.city || loc0.country || loc0.countryCode)) {
        const loc: UserLocation = {
          city: loc0.city ? String(loc0.city).trim() : '',
          region: loc0.region ? String(loc0.region).trim() : undefined,
          country: loc0.country ? String(loc0.country).trim() : undefined,
          countryCode: loc0.countryCode ? String(loc0.countryCode).trim().toUpperCase() : undefined,
          latitude: isValidCoords(loc0.latitude, loc0.longitude) ? Number(loc0.latitude) : undefined,
          longitude: isValidCoords(loc0.latitude, loc0.longitude) ? Number(loc0.longitude) : undefined,
          timezone: loc0.timezone || timezone || undefined,
          source: 'ip',
          detectionMethod: 'ip',
          timestamp: Date.now(),
          updatedAt: Date.now(),
          isApproximate: true,
        };
        if (loc.city) {
          saveStoredLocationPref({ ipLocation: loc }, { syncFirestore: false });
          return loc;
        }
      }
    }
  } catch {}

  // 2. Client fallback via ipwho.is (CORS-enabled, no key required)
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
          latitude: isValidCoords(d1.latitude, d1.longitude) ? Number(d1.latitude) : undefined,
          longitude: isValidCoords(d1.latitude, d1.longitude) ? Number(d1.longitude) : undefined,
          timezone: d1.timezone?.id || timezone || undefined,
          source: 'ip',
          detectionMethod: 'ip',
          timestamp: Date.now(),
          updatedAt: Date.now(),
          isApproximate: true,
        };
        saveStoredLocationPref({ ipLocation: loc }, { syncFirestore: false });
        return loc;
      }
    }
  } catch {}

  // 3. Secondary IP fallback via ipapi.co/json/
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
          latitude: isValidCoords(d2.latitude, d2.longitude) ? Number(d2.latitude) : undefined,
          longitude: isValidCoords(d2.latitude, d2.longitude) ? Number(d2.longitude) : undefined,
          timezone: d2.timezone || timezone || undefined,
          source: 'ip',
          detectionMethod: 'ip',
          timestamp: Date.now(),
          updatedAt: Date.now(),
          isApproximate: true,
        };
        saveStoredLocationPref({ ipLocation: loc }, { syncFirestore: false });
        return loc;
      }
    }
  } catch {}

  return null;
}

/**
 * Resolves approximate IP location on startup ONLY when location is enabled (not disabled)
 * and never triggers browser geolocation permission prompts.
 */
export async function ensureClientIpLocationResolved(): Promise<void> {
  const pref = getStoredLocationPref();
  if (!pref.locationEnabled || pref.mode === 'disabled') {
    return;
  }
  if (pref.ipLocation && pref.ipLocation.timestamp && Date.now() - pref.ipLocation.timestamp < 3600_000) {
    return;
  }
  await fetchClientApproximateIpLocation();
}

export async function reverseGeocodeCoords(
  lat: number,
  lng: number,
  accuracy?: number
): Promise<UserLocation> {
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}

  const now = Date.now();

  // 1. Server-side reverse geocode proxy
  try {
    const apiRes = await fetch('/api/location/reverse-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, timezone }),
      signal: AbortSignal.timeout(5000),
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data?.success && data?.location?.city) {
        return {
          city: data.location.city,
          region: data.location.region,
          country: data.location.country,
          countryCode: data.location.countryCode,
          latitude: lat,
          longitude: lng,
          accuracy: typeof accuracy === 'number' ? Math.round(accuracy) : undefined,
          timezone: data.location.timezone || timezone || undefined,
          source: 'gps',
          detectionMethod: 'gps',
          timestamp: now,
          updatedAt: now,
          isApproximate: false,
        };
      }
    }
  } catch {}

  // 2. Client fallback via Nominatim OpenStreetMap
  try {
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLng = Math.round(lng * 1000) / 1000;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${roundedLat}&lon=${roundedLng}&zoom=10`,
      {
        headers: {
          'User-Agent': 'KinichApp/1.0 (https://kinich.app; location-service)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
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
        'Current Location';
      return {
        city,
        region: addr.state || addr.region || undefined,
        country: addr.country || undefined,
        countryCode: addr.country_code ? String(addr.country_code).toUpperCase() : undefined,
        latitude: lat,
        longitude: lng,
        accuracy: typeof accuracy === 'number' ? Math.round(accuracy) : undefined,
        timezone: timezone || undefined,
        source: 'gps',
        detectionMethod: 'gps',
        timestamp: now,
        updatedAt: now,
        isApproximate: false,
      };
    }
  } catch {}

  return {
    city: 'Current Location',
    latitude: lat,
    longitude: lng,
    accuracy: typeof accuracy === 'number' ? Math.round(accuracy) : undefined,
    timezone: timezone || undefined,
    source: 'gps',
    detectionMethod: 'gps',
    timestamp: now,
    updatedAt: now,
    isApproximate: false,
  };
}

/**
 * Full multi-layer GPS detection with explicit permission, timeout, HTTPS, and unavailable handling.
 * Never falsely labels IP fallback as GPS.
 */
export async function requestPreciseLocation(options?: {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  allowIpFallback?: boolean;
}): Promise<PreciseLocationResult> {
  const enableHighAccuracy = options?.enableHighAccuracy !== false;
  const timeoutMs = options?.timeoutMs ?? 10000;
  const allowIpFallback = options?.allowIpFallback !== false;

  if (!isSecureLocationContext()) {
    const errorMessage = 'Precise location requires an HTTPS connection.';
    saveStoredLocationPref({ permissionState: 'insecure', lastError: errorMessage }, { syncFirestore: false });
    const ipLoc = allowIpFallback ? await fetchClientApproximateIpLocation() : null;
    return {
      location: ipLoc,
      permissionState: 'insecure',
      usedFallback: Boolean(ipLoc),
      errorCode: 'insecure_context',
      errorMessage,
    };
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const errorMessage = 'Geolocation is not supported by this browser.';
    saveStoredLocationPref({ permissionState: 'unsupported', lastError: errorMessage }, { syncFirestore: false });
    const ipLoc = allowIpFallback ? await fetchClientApproximateIpLocation() : null;
    return {
      location: ipLoc,
      permissionState: 'unsupported',
      usedFallback: Boolean(ipLoc),
      errorCode: 'unsupported',
      errorMessage,
    };
  }

  return new Promise<PreciseLocationResult>((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const loc = await reverseGeocodeCoords(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy
            );
            sessionPreciseLocation = loc;
            saveStoredLocationPref({
              locationEnabled: true,
              mode: 'precise',
              usePreciseLocation: true,
              preciseLocation: loc,
              permissionState: 'granted',
              lastError: null,
            });
            resolve({
              location: loc,
              permissionState: 'granted',
              usedFallback: false,
            });
          } catch {
            const now = Date.now();
            const coordsOnly: UserLocation = {
              city: 'Current Location',
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : undefined,
              source: 'gps',
              detectionMethod: 'gps',
              timestamp: now,
              updatedAt: now,
              isApproximate: false,
            };
            sessionPreciseLocation = coordsOnly;
            saveStoredLocationPref({
              locationEnabled: true,
              mode: 'precise',
              usePreciseLocation: true,
              preciseLocation: coordsOnly,
              permissionState: 'granted',
              lastError: null,
            });
            resolve({
              location: coordsOnly,
              permissionState: 'granted',
              usedFallback: false,
            });
          }
        },
        async (err) => {
          const code = err?.code;
          let errorCode: PreciseLocationResult['errorCode'] = 'position_unavailable';
          let permissionState: LocationPermissionState = 'unknown';
          let errorMessage = 'Could not determine your location automatically.';

          if (code === 1) {
            errorCode = 'permission_denied';
            permissionState = 'denied';
            errorMessage = 'Location permission was denied or blocked by your browser.';
          } else if (code === 3) {
            errorCode = 'timeout';
            errorMessage = 'Location request timed out. Using approximate or manual location instead.';
          } else {
            errorCode = 'position_unavailable';
            errorMessage = 'Device location is currently unavailable.';
          }

          const current = getStoredLocationPref();
          const nextMode: LocationPreferenceMode =
            current.manualLocation?.city || current.homeCity ? 'manual' : 'approximate';

          saveStoredLocationPref(
            {
              usePreciseLocation: false,
              mode: current.locationEnabled ? nextMode : 'disabled',
              permissionState,
              lastError: errorMessage,
            },
            { syncFirestore: false }
          );

          const fallbackLoc = allowIpFallback
            ? current.manualLocation || (await fetchClientApproximateIpLocation())
            : null;

          resolve({
            location: fallbackLoc,
            permissionState,
            usedFallback: Boolean(fallbackLoc),
            errorCode,
            errorMessage,
          });
        },
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: 60000,
        }
      );
    } catch {
      const errorMessage = 'Unable to access browser geolocation.';
      saveStoredLocationPref({ permissionState: 'denied', lastError: errorMessage }, { syncFirestore: false });
      void (async () => {
        const ipLoc = allowIpFallback ? await fetchClientApproximateIpLocation() : null;
        resolve({
          location: ipLoc,
          permissionState: 'denied',
          usedFallback: Boolean(ipLoc),
          errorCode: 'permission_denied',
          errorMessage,
        });
      })();
    }
  });
}

/**
 * Legacy helper maintained for compatibility; throws clear error if precise GPS failed AND no fallback exists.
 */
export async function requestPreciseLocationOnTap(): Promise<UserLocation> {
  const result = await requestPreciseLocation({ allowIpFallback: true });
  if (result.location && !result.usedFallback) {
    return result.location;
  }
  if (result.location && result.usedFallback) {
    return result.location;
  }
  throw new Error(result.errorMessage || 'Could not detect location automatically');
}

export function isLocationDependentPrompt(query: string): boolean {
  if (!query || !query.trim()) return false;
  return /\b(weather|forecast|temperature|rain|raining|humidity|wind\s+speed|uv\s+index|air\s+quality|aqi|near\s+me|around\s+me|nearby|nearest|in\s+my\s+city|my\s+current\s+location|where\s+am\s+i|local\s+news|what(?:'s|\s+is)\s+the\s+time)\b/i.test(
    query
  );
}

/**
 * Priority for search/chat request location:
 * 0. Disabled -> returns { detectionMethod: 'disabled', locationEnabled: false, source: 'disabled' }
 * 1. Manual selected city/travel city (explicitly chosen by user)
 * 2. Precise GPS location (if mode === 'precise' and user granted permission)
 * 3. Client-resolved approximate IP location (never treated as precise GPS)
 */
export function getEffectiveLocationPayload(): {
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  accuracy?: number;
  detectionMethod: LocationSource;
  source: LocationSource;
  updatedAt?: number;
  isApproximate?: boolean;
  locationEnabled: boolean;
  homeCity?: string;
} | null {
  const pref = getStoredLocationPref();

  if (!pref.locationEnabled || pref.mode === 'disabled') {
    return {
      detectionMethod: 'disabled',
      source: 'disabled',
      locationEnabled: false,
      updatedAt: pref.updatedAt,
    };
  }

  let browserTz = '';
  try {
    browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {}

  if (pref.mode === 'manual' && (pref.manualLocation?.city || pref.homeCity)) {
    const man = pref.manualLocation;
    const city = man?.city || pref.homeCity || '';
    return {
      city,
      region: man?.region,
      country: man?.country,
      countryCode: man?.countryCode,
      latitude: isValidCoords(man?.latitude, man?.longitude) ? man?.latitude : undefined,
      longitude: isValidCoords(man?.latitude, man?.longitude) ? man?.longitude : undefined,
      timezone: man?.timezone || browserTz || undefined,
      detectionMethod: 'manual',
      source: 'manual',
      updatedAt: man?.updatedAt || pref.updatedAt,
      isApproximate: false,
      locationEnabled: true,
      homeCity: city,
    };
  }

  if (pref.mode === 'precise' && pref.preciseLocation) {
    const gps = pref.preciseLocation;
    return {
      city: gps.city,
      region: gps.region,
      country: gps.country,
      countryCode: gps.countryCode,
      latitude: isValidCoords(gps.latitude, gps.longitude) ? gps.latitude : undefined,
      longitude: isValidCoords(gps.latitude, gps.longitude) ? gps.longitude : undefined,
      timezone: gps.timezone || browserTz || undefined,
      accuracy: gps.accuracy,
      detectionMethod: 'gps',
      source: 'gps',
      updatedAt: gps.updatedAt || gps.timestamp || pref.updatedAt,
      isApproximate: false,
      locationEnabled: true,
    };
  }

  if (pref.ipLocation && pref.ipLocation.city) {
    return {
      city: pref.ipLocation.city,
      region: pref.ipLocation.region,
      country: pref.ipLocation.country,
      countryCode: pref.ipLocation.countryCode,
      latitude: isValidCoords(pref.ipLocation.latitude, pref.ipLocation.longitude)
        ? pref.ipLocation.latitude
        : undefined,
      longitude: isValidCoords(pref.ipLocation.latitude, pref.ipLocation.longitude)
        ? pref.ipLocation.longitude
        : undefined,
      timezone: pref.ipLocation.timezone || browserTz || undefined,
      detectionMethod: 'ip',
      source: 'ip',
      updatedAt: pref.ipLocation.updatedAt || pref.ipLocation.timestamp,
      isApproximate: true,
      locationEnabled: true,
    };
  }

  // Fallback if user has a manual city saved even while in another mode
  if (pref.homeCity) {
    return {
      city: pref.homeCity,
      region: pref.manualLocation?.region,
      country: pref.manualLocation?.country,
      countryCode: pref.manualLocation?.countryCode,
      latitude: isValidCoords(pref.manualLocation?.latitude, pref.manualLocation?.longitude)
        ? pref.manualLocation?.latitude
        : undefined,
      longitude: isValidCoords(pref.manualLocation?.latitude, pref.manualLocation?.longitude)
        ? pref.manualLocation?.longitude
        : undefined,
      timezone: pref.manualLocation?.timezone || browserTz || undefined,
      detectionMethod: 'manual',
      source: 'manual',
      updatedAt: pref.updatedAt,
      isApproximate: false,
      locationEnabled: true,
      homeCity: pref.homeCity,
    };
  }

  return null;
}
