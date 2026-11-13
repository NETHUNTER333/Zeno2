import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type express from 'express';

vi.mock('../src/lib/firebase', () => ({
  auth: { currentUser: null },
  saveUserLocationPrefToFirestore: vi.fn().mockResolvedValue(undefined),
  loadUserLocationPrefFromFirestore: vi.fn().mockResolvedValue(null),
  deleteUserLocationPrefFromFirestore: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearStoredLocationPref,
  getEffectiveLocationPayload,
  getStoredLocationPref,
  isLocationDependentPrompt,
  requestPreciseLocation,
  setLocationDisabled,
  setManualLocationPlace,
  setPersistPreciseLocation,
} from '../src/lib/locationStore';
import {
  resolveApproximateIpLocation,
  resolveRequestLocationContext,
} from '../server/geolocationService';
import { searchCitiesGeocoding } from '../server/locationService';
import {
  classifyUsAqi,
  degreesToCompass,
  formatWeatherReportAsSearchSources,
  getLiveWeatherReport,
  weatherCodeToDescription,
} from '../server/weatherService';
import {
  analyzeLocationIntent,
  buildLocationContextForChat,
  extractExplicitPlaceFromQuery,
} from '../server/locationContextService';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
}

function makeMockReq(headers: Record<string, string> = {}, body: any = {}, ip = ''): express.Request {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    normalized[k.toLowerCase()] = v;
  }
  return {
    headers: normalized,
    body,
    ip,
  } as unknown as express.Request;
}

describe('Kinich Advanced Location Awareness System', () => {
  const origWindow = (globalThis as any).window;
  const origNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const origLocalStorage = (globalThis as any).localStorage;
  const origFetch = globalThis.fetch;

  const setMockNavigator = (val: any) => {
    Object.defineProperty(globalThis, 'navigator', {
      value: val,
      configurable: true,
      writable: true,
    });
  };

  beforeEach(async () => {
    const ls = createMemoryStorage();
    (globalThis as any).localStorage = ls;
    (globalThis as any).window = {
      isSecureContext: true,
      location: { hostname: 'kinich.app', protocol: 'https:' },
      dispatchEvent: vi.fn(),
    };
    (globalThis as any).CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    setMockNavigator({});
    await clearStoredLocationPref({ deleteRemote: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = origWindow;
    if (origNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', origNavigatorDesc);
    }
    (globalThis as any).localStorage = origLocalStorage;
    globalThis.fetch = origFetch;
  });

  it('Scenario 1-3: Handles GPS permission grant, denial, timeout, unsupported, and insecure context', async () => {
    // 1. Insecure HTTP non-localhost context
    (globalThis as any).window.isSecureContext = false;
    (globalThis as any).window.location = { hostname: 'kinich.app', protocol: 'http:' };
    const insecureRes = await requestPreciseLocation({ allowIpFallback: false });
    expect(insecureRes.errorCode).toBe('insecure_context');
    expect(insecureRes.permissionState).toBe('insecure');

    // 2. Unsupported browser geolocation
    (globalThis as any).window.isSecureContext = true;
    setMockNavigator({});
    const unsupportedRes = await requestPreciseLocation({ allowIpFallback: false });
    expect(unsupportedRes.errorCode).toBe('unsupported');
    expect(unsupportedRes.permissionState).toBe('unsupported');

    // 3. Denied permission
    setMockNavigator({
      geolocation: {
        getCurrentPosition: (_ok: any, err: any) => err({ code: 1, message: 'User denied' }),
      },
    });
    const deniedRes = await requestPreciseLocation({ allowIpFallback: false });
    expect(deniedRes.errorCode).toBe('permission_denied');
    expect(deniedRes.permissionState).toBe('denied');
    expect(deniedRes.usedFallback).toBe(false);

    // 4. Timeout
    setMockNavigator({
      geolocation: {
        getCurrentPosition: (_ok: any, err: any) => err({ code: 3, message: 'Timed out' }),
      },
    });
    const timeoutRes = await requestPreciseLocation({ allowIpFallback: false });
    expect(timeoutRes.errorCode).toBe('timeout');

    // 5. Grant + Reverse Geocode + Session-only coordinate protection
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        location: {
          city: 'Hyderabad',
          region: 'Telangana',
          country: 'India',
          countryCode: 'IN',
          timezone: 'Asia/Kolkata',
        },
      }),
    }) as any;

    setMockNavigator({
      geolocation: {
        getCurrentPosition: (ok: any) =>
          ok({ coords: { latitude: 17.385, longitude: 78.4867, accuracy: 22 } }),
      },
    });

    const grantRes = await requestPreciseLocation({ allowIpFallback: false });
    expect(grantRes.permissionState).toBe('granted');
    expect(grantRes.usedFallback).toBe(false);
    expect(grantRes.location?.city).toBe('Hyderabad');
    expect(grantRes.location?.detectionMethod).toBe('gps');
    expect(grantRes.location?.accuracy).toBe(22);

    // Active payload has coordinates in-session
    const active = getEffectiveLocationPayload();
    expect(active?.detectionMethod).toBe('gps');
    expect(active?.latitude).toBeCloseTo(17.385, 3);

    // Persisted localStorage MUST NOT retain precise latitude/longitude unless opted in
    const rawSaved = JSON.parse((globalThis as any).localStorage.getItem('kinich_user_location_pref_v2'));
    expect(rawSaved.preciseLocation.latitude).toBeUndefined();
    expect(rawSaved.preciseLocation.longitude).toBeUndefined();

    // When user explicitly opts in, coordinates persist
    setPersistPreciseLocation(true);
    const rawAfterOptIn = JSON.parse((globalThis as any).localStorage.getItem('kinich_user_location_pref_v2'));
    expect(rawAfterOptIn.preciseLocation.latitude).toBeCloseTo(17.385, 3);
  });

  it('Scenario 4-6: Approximate IP resolution never fabricates cities and respects disabled mode', async () => {
    // 1. Edge headers yield IP approximate location
    const edgeReq = makeMockReq({
      'x-vercel-ip-city': 'Bengaluru',
      'x-vercel-ip-country-region': 'Karnataka',
      'x-vercel-ip-country': 'IN',
      'x-vercel-ip-timezone': 'Asia/Kolkata',
    });
    const ipLoc = await resolveApproximateIpLocation(edgeReq);
    expect(ipLoc.detectionMethod).toBe('ip');
    expect(ipLoc.isApproximate).toBe(true);
    expect(ipLoc.city).toBe('Bengaluru');

    // 2. Private IP + no edge headers -> returns 'none' without fabricating "Ramagundam"
    const localReq = makeMockReq({}, {}, '127.0.0.1');
    const noneLoc = await resolveApproximateIpLocation(localReq, 'Asia/Kolkata');
    expect(noneLoc.detectionMethod).toBe('none');
    expect(noneLoc.city).toBeUndefined();

    // 3. Disabled mode ignores edge headers completely
    const disabledResolved = resolveRequestLocationContext(edgeReq, {
      detectionMethod: 'disabled',
      locationEnabled: false,
    });
    expect(disabledResolved.detectionMethod).toBe('disabled');
    expect(disabledResolved.locationEnabled).toBe(false);
    expect(disabledResolved.city).toBeUndefined();

    // Client store disabled mode
    setLocationDisabled(true);
    const payload = getEffectiveLocationPayload();
    expect(payload?.detectionMethod).toBe('disabled');
    expect(payload?.locationEnabled).toBe(false);
    expect(payload?.city).toBeUndefined();
  });

  it('Scenario 7-8: Searchable manual cities & switching during travel', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            name: 'Tokyo',
            admin1: 'Tokyo',
            country: 'Japan',
            country_code: 'JP',
            latitude: 35.6895,
            longitude: 139.6917,
            timezone: 'Asia/Tokyo',
            population: 9733276,
          },
        ],
      }),
    }) as any;

    const results = await searchCitiesGeocoding('Tokyo', 5);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Tokyo');
    expect(results[0].countryCode).toBe('JP');
    expect(results[0].timezone).toBe('Asia/Tokyo');

    // Set manual location on client -> switches immediately
    setManualLocationPlace(results[0]);
    let effective = getEffectiveLocationPayload();
    expect(effective?.detectionMethod).toBe('manual');
    expect(effective?.city).toBe('Tokyo');
    expect(effective?.timezone).toBe('Asia/Tokyo');

    // Switch city to London while travelling
    setManualLocationPlace({
      name: 'London',
      region: 'England',
      country: 'United Kingdom',
      countryCode: 'GB',
      latitude: 51.5072,
      longitude: -0.1276,
      timezone: 'Europe/London',
      displayName: 'London, England, United Kingdom',
    });
    effective = getEffectiveLocationPayload();
    expect(effective?.city).toBe('London');
    expect(effective?.countryCode).toBe('GB');
    expect(effective?.timezone).toBe('Europe/London');

    const stored = getStoredLocationPref();
    expect(stored.mode).toBe('manual');
    expect(stored.locationEnabled).toBe(true);
  });

  it('Scenario 9-10: Real Open-Meteo weather + air quality integration and TTL cache metadata', async () => {
    expect(degreesToCompass(90)).toBe('E');
    expect(degreesToCompass(225)).toBe('SW');
    expect(classifyUsAqi(35)).toBe('Good');
    expect(classifyUsAqi(120)).toBe('Unhealthy for Sensitive Groups');
    expect(weatherCodeToDescription(63).label).toBe('Rain');

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.open-meteo.com/v1/forecast')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            timezone: 'Asia/Tokyo',
            current: {
              temperature_2m: 18.4,
              apparent_temperature: 17.6,
              relative_humidity_2m: 62,
              precipitation: 0,
              weather_code: 2,
              wind_speed_10m: 14.2,
              wind_direction_10m: 90,
              uv_index: 3.4,
              is_day: 1,
            },
            hourly: {
              time: ['2026-11-12T12:00', '2026-11-12T13:00'],
              temperature_2m: [18.4, 19.1],
              precipitation_probability: [10, 15],
              precipitation: [0, 0],
              weather_code: [2, 1],
              uv_index: [3.4, 3.0],
            },
            daily: {
              time: ['2026-11-12', '2026-11-13'],
              weather_code: [2, 61],
              temperature_2m_max: [20, 17],
              temperature_2m_min: [12, 11],
              precipitation_probability_max: [20, 75],
              precipitation_sum: [0, 4.2],
              sunrise: ['2026-11-12T06:14'],
              sunset: ['2026-11-12T16:36'],
              uv_index_max: [4.2, 2.1],
            },
          }),
        });
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            current: {
              us_aqi: 42,
              european_aqi: 24,
              pm2_5: 8.5,
              pm10: 14.2,
              ozone: 48,
            },
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    globalThis.fetch = fetchMock as any;

    const first = await getLiveWeatherReport({
      latitude: 35.69,
      longitude: 139.69,
      city: 'Tokyo',
      country: 'Japan',
      countryCode: 'JP',
      timezone: 'Asia/Tokyo',
    });

    expect(first).not.toBeNull();
    expect(first!.cached).toBe(false);
    expect(first!.current.tempC).toBe(18);
    expect(first!.current.windCompass).toBe('E');
    expect(first!.airQuality?.usAqi).toBe(42);
    expect(first!.airQuality?.category).toBe('Good');
    expect(first!.today.sunrise).toBe('6:14 AM');
    expect(first!.today.sunset).toBe('4:36 PM');

    const sources = formatWeatherReportAsSearchSources(first!);
    expect(sources[0].title).toContain('Tokyo');
    expect(sources[0].snippet).toContain('US AQI 42');

    // Second immediate call uses TTL cache
    const second = await getLiveWeatherReport({
      latitude: 35.69,
      longitude: 139.69,
      city: 'Tokyo',
      country: 'Japan',
      countryCode: 'JP',
      timezone: 'Asia/Tokyo',
    });
    expect(second?.cached).toBe(true);
    expect(typeof second?.cacheAgeSeconds).toBe('number');
    expect(fetchMock).toHaveBeenCalledTimes(2); // Forecast + AQI called once
  });

  it('Scenario 11-13: Conditional AI location injection, explicit city override, and disabled honesty', async () => {
    // 1. Non-location prompt -> NEVER injects location
    const nonLocCtx = await buildLocationContextForChat(
      'Explain how TypeScript generics work with an example',
      {
        city: 'Hyderabad',
        country: 'India',
        detectionMethod: 'gps',
        locationEnabled: true,
      }
    );
    expect(nonLocCtx.intent.isLocationDependent).toBe(false);
    expect(nonLocCtx.systemBlock).toBe('');

    // 2. Implicit prompts are detected
    expect(analyzeLocationIntent("What's the weather today?").usesImplicitCurrentLocation).toBe(true);
    expect(analyzeLocationIntent('Will it rain tomorrow?').intentType).toBe('weather');
    expect(analyzeLocationIntent('Find restaurants near me').intentType).toBe('nearby');
    expect(analyzeLocationIntent("What's the time?").intentType).toBe('time');
    expect(analyzeLocationIntent("What's happening around me?").intentType).toBe('nearby');
    expect(isLocationDependentPrompt('Find cafes near me')).toBe(true);
    expect(isLocationDependentPrompt('Sort an array in JavaScript')).toBe(false);

    // 3. Explicit foreign city overrides current location without country bias
    expect(extractExplicitPlaceFromQuery('weather in Tokyo')).toBe('Tokyo');
    expect(extractExplicitPlaceFromQuery("what's the time in London?")).toBe('London');

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('geocoding-api.open-meteo.com')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                name: 'London',
                admin1: 'England',
                country: 'United Kingdom',
                country_code: 'GB',
                latitude: 51.5072,
                longitude: -0.1276,
                timezone: 'Europe/London',
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    }) as any;

    const londonTimeCtx = await buildLocationContextForChat("what's the time in London?", {
      city: 'Hyderabad',
      country: 'India',
      countryCode: 'IN',
      timezone: 'Asia/Kolkata',
      detectionMethod: 'gps',
      locationEnabled: true,
    });
    expect(londonTimeCtx.intent.explicitPlace).toBe('London');
    expect(londonTimeCtx.systemBlock).toContain('[EXPLICIT PLACE CONTEXT]');
    expect(londonTimeCtx.systemBlock).toContain('Europe/London');

    // 4. Disabled location + implicit local query -> honest refusal to fabricate
    const disabledWeatherCtx = await buildLocationContextForChat("What's the weather today?", {
      detectionMethod: 'disabled',
      locationEnabled: false,
    });
    expect(disabledWeatherCtx.systemBlock).toContain('[LOCATION CONTEXT UNAVAILABLE]');
    expect(disabledWeatherCtx.systemBlock).toContain('Do NOT fabricate');
  });
});
