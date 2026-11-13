import type express from 'express';
import {
  LocationContext,
  isValidCoordinate,
  sanitizeLocationContext,
  sanitizeTextField,
} from './locationService';

function isPrivateOrLoopbackIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/i, '').trim();
  if (!clean) return true;
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
  if (/^(10\.|192\.168\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(clean)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(clean)) return true;
  if (/^(fc|fd|fe80):/i.test(clean)) return true;
  return false;
}

function extractTransientClientIp(req: express.Request): string {
  const xff = req.headers['x-forwarded-for'];
  const firstForwarded =
    typeof xff === 'string'
      ? xff.split(',')[0].trim()
      : Array.isArray(xff) && xff.length > 0
      ? String(xff[0]).split(',')[0].trim()
      : '';
  const raw =
    firstForwarded ||
    (typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'].trim() : '') ||
    (typeof req.ip === 'string' ? req.ip.trim() : '');
  return raw.replace(/^::ffff:/i, '');
}

function readEdgeIpHeaders(req: express.Request): Partial<LocationContext> {
  let city = '';
  try {
    const rawCity =
      typeof req.headers['x-vercel-ip-city'] === 'string' ? req.headers['x-vercel-ip-city'] : '';
    city = rawCity ? decodeURIComponent(rawCity).trim() : '';
  } catch {
    city = typeof req.headers['x-vercel-ip-city'] === 'string' ? req.headers['x-vercel-ip-city'].trim() : '';
  }

  let region = '';
  try {
    const rawRegion =
      typeof req.headers['x-vercel-ip-country-region'] === 'string'
        ? req.headers['x-vercel-ip-country-region']
        : '';
    region = rawRegion ? decodeURIComponent(rawRegion).trim() : '';
  } catch {
    region = '';
  }

  let countryCode = '';
  try {
    const rawCountry =
      typeof req.headers['x-vercel-ip-country'] === 'string'
        ? req.headers['x-vercel-ip-country']
        : '';
    countryCode = rawCountry ? decodeURIComponent(rawCountry).trim().toUpperCase() : '';
  } catch {
    countryCode = '';
  }

  let timezone = '';
  try {
    const rawTz =
      typeof req.headers['x-vercel-ip-timezone'] === 'string'
        ? req.headers['x-vercel-ip-timezone']
        : '';
    timezone = rawTz ? decodeURIComponent(rawTz).trim() : '';
  } catch {
    timezone = '';
  }

  const rawLat =
    typeof req.headers['x-vercel-ip-latitude'] === 'string'
      ? Number(req.headers['x-vercel-ip-latitude'])
      : undefined;
  const rawLng =
    typeof req.headers['x-vercel-ip-longitude'] === 'string'
      ? Number(req.headers['x-vercel-ip-longitude'])
      : undefined;

  return {
    city: sanitizeTextField(city, 120),
    region: sanitizeTextField(region, 120),
    countryCode: sanitizeTextField(countryCode, 8),
    timezone: sanitizeTextField(timezone, 80),
    latitude: isValidCoordinate(rawLat, rawLng) ? rawLat : undefined,
    longitude: isValidCoordinate(rawLat, rawLng) ? rawLng : undefined,
  };
}

/**
 * Resolves approximate IP-based location WITHOUT ever storing or logging raw IP addresses,
 * and NEVER treating IP resolution as precise GPS.
 */
export async function resolveApproximateIpLocation(
  req: express.Request,
  clientTimezone?: string
): Promise<LocationContext> {
  const edge = readEdgeIpHeaders(req);
  if (edge.city || edge.countryCode) {
    return {
      city: edge.city,
      region: edge.region,
      countryCode: edge.countryCode,
      timezone: edge.timezone || sanitizeTextField(clientTimezone, 80),
      latitude: edge.latitude,
      longitude: edge.longitude,
      detectionMethod: 'ip',
      source: 'ip',
      isApproximate: true,
      locationEnabled: true,
      updatedAt: Date.now(),
    };
  }

  // Transient in-memory lookup for public IP only; raw IP is discarded immediately and never logged/stored
  const transientIp = extractTransientClientIp(req);
  if (transientIp && !isPrivateOrLoopbackIp(transientIp)) {
    try {
      const res = await fetch(`https://ipwho.is/${encodeURIComponent(transientIp)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.success !== false && (data.city || data.country)) {
          return {
            city: sanitizeTextField(data.city, 120),
            region: sanitizeTextField(data.region, 120),
            country: sanitizeTextField(data.country, 120),
            countryCode: sanitizeTextField(data.country_code, 8)?.toUpperCase(),
            timezone: sanitizeTextField(data.timezone?.id || clientTimezone, 80),
            latitude: isValidCoordinate(data.latitude, data.longitude) ? Number(data.latitude) : undefined,
            longitude: isValidCoordinate(data.latitude, data.longitude) ? Number(data.longitude) : undefined,
            detectionMethod: 'ip',
            source: 'ip',
            isApproximate: true,
            locationEnabled: true,
            updatedAt: Date.now(),
          };
        }
      }
    } catch {
      // Ignore upstream IP lookup errors silently
    }
  }

  // Never fabricate a specific city solely from timezone. Only return timezone if known.
  const tz = sanitizeTextField(clientTimezone, 80);
  if (tz) {
    return {
      timezone: tz,
      detectionMethod: 'none',
      source: 'none',
      isApproximate: true,
      locationEnabled: true,
    };
  }

  return {
    detectionMethod: 'none',
    source: 'none',
    isApproximate: true,
    locationEnabled: true,
  };
}

/**
 * Resolves the active LocationContext for an incoming /api/chat or /api/search request.
 * Priority:
 * 1. Explicit disabled flag -> returns disabled context (never reads IP headers).
 * 2. Precise GPS location from client payload (if user granted permission).
 * 3. Manual user-selected city from client payload.
 * 4. Approximate IP location from client payload or edge headers.
 */
export function resolveRequestLocationContext(
  req: express.Request,
  payloadLocation?: any
): LocationContext {
  const sanitized = sanitizeLocationContext(payloadLocation);

  if (sanitized?.detectionMethod === 'disabled' || sanitized?.locationEnabled === false) {
    return {
      detectionMethod: 'disabled',
      source: 'disabled',
      locationEnabled: false,
      updatedAt: sanitized.updatedAt,
    };
  }

  const edge = readEdgeIpHeaders(req);
  const clientTz =
    sanitizeTextField((req.body as any)?.clientClock?.timezone, 80) ||
    sanitized?.timezone ||
    edge.timezone;

  if (sanitized && sanitized.detectionMethod === 'gps' && (sanitized.city || isValidCoordinate(sanitized.latitude, sanitized.longitude))) {
    return {
      ...sanitized,
      timezone: sanitized.timezone || clientTz,
      detectionMethod: 'gps',
      source: 'gps',
      isApproximate: false,
      locationEnabled: true,
    };
  }

  if (sanitized && sanitized.detectionMethod === 'manual' && (sanitized.city || sanitized.homeCity)) {
    return {
      ...sanitized,
      city: sanitized.city || sanitized.homeCity,
      timezone: sanitized.timezone || clientTz,
      detectionMethod: 'manual',
      source: 'manual',
      isApproximate: false,
      locationEnabled: true,
    };
  }

  if (sanitized && (sanitized.city || sanitized.country || sanitized.countryCode)) {
    return {
      ...sanitized,
      region: sanitized.region || edge.region,
      country: sanitized.country,
      countryCode: sanitized.countryCode || edge.countryCode,
      timezone: sanitized.timezone || clientTz,
      detectionMethod: sanitized.detectionMethod === 'none' ? 'ip' : sanitized.detectionMethod,
      source: sanitized.detectionMethod === 'none' ? 'ip' : (sanitized.detectionMethod as any),
      isApproximate: true,
      locationEnabled: true,
    };
  }

  if (edge.city || edge.countryCode) {
    return {
      city: edge.city,
      region: edge.region,
      countryCode: edge.countryCode,
      timezone: edge.timezone || clientTz,
      latitude: edge.latitude,
      longitude: edge.longitude,
      detectionMethod: 'ip',
      source: 'ip',
      isApproximate: true,
      locationEnabled: true,
    };
  }

  return {
    timezone: clientTz,
    detectionMethod: 'none',
    source: 'none',
    isApproximate: true,
    locationEnabled: true,
  };
}
