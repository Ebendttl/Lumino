import { Reader } from '@maxmind/geoip2-node';
import * as fs from 'fs';
import * as path from 'path';

let reader: Reader | null = null;

// Paths to search for GeoLite2-City.mmdb
const possiblePaths = [
  process.env.GEOLITE2_DB_PATH,
  path.join(__dirname, '../GeoLite2-City.mmdb'),
  path.join(__dirname, '../../GeoLite2-City.mmdb'),
  path.join(__dirname, '../data/GeoLite2-City.mmdb'),
  '/usr/share/GeoIP/GeoLite2-City.mmdb'
].filter((p): p is string => !!p);

/**
 * Initializes the MaxMind GeoIP2 Reader if the MMDB file exists.
 */
export async function initGeoReader(): Promise<void> {
  for (const dbPath of possiblePaths) {
    if (fs.existsSync(dbPath)) {
      try {
        console.log(`[GeoLookup] Loading MaxMind database from: ${dbPath}`);
        reader = await Reader.open(dbPath);
        return;
      } catch (err) {
        console.error(`[GeoLookup] Failed to open MaxMind database at ${dbPath}:`, err);
      }
    }
  }
  console.warn('[GeoLookup] No MaxMind GeoLite2-City.mmdb database found. Using mock resolver.');
}

/**
 * Performs country and city lookup for a given IP.
 * Falls back to a mock resolver for offline/local testing.
 */
export function lookupGeo(ip: string): { country: string | null; city: string | null } {
  if (reader) {
    try {
      const response = reader.city(ip);
      const country = response.country?.isoCode || null;
      const city = response.city?.names?.en || null;
      return { country, city };
    } catch (err) {
      // MaxMind throws an error if IP is not in database (e.g. local loopback, private ranges)
      // This is expected, return null.
      return { country: null, city: null };
    }
  }

  // --- MOCK RESOLVER FALLBACK ---
  // Returns deterministic dummy data for local development/testing based on the IP address.
  if (ip.startsWith('127.') || ip === '::1' || ip === '0.0.0.0' || ip === '::') {
    return { country: 'US', city: 'Localhost' };
  }

  const parts = ip.split('.');
  if (parts.length === 4) {
    const seed = parseInt(parts[0], 10) + parseInt(parts[1], 10) + parseInt(parts[2], 10);
    const mod = seed % 5;
    switch (mod) {
      case 0: return { country: 'US', city: 'New York' };
      case 1: return { country: 'DE', city: 'Berlin' };
      case 2: return { country: 'GB', city: 'London' };
      case 3: return { country: 'FR', city: 'Paris' };
      case 4: return { country: 'JP', city: 'Tokyo' };
    }
  }

  return { country: 'US', city: 'San Francisco' };
}
