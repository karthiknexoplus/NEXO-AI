const STORAGE_KEY = "nexo-user-location-v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface UserLocation {
  lat: number;
  lon: number;
  place: string;
  updatedAt: number;
}

function loadCached(): UserLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserLocation;
    if (!parsed || typeof parsed.lat !== "number" || typeof parsed.lon !== "number") return null;
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCached(loc: UserLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

export function isLocationQuery(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /\b(near(?:by| me)?|around me|my location|current location|restaurants? (?:near|in)|cafes? (?:near|in)|hotels? (?:near|in)|places (?:near|around))\b/i.test(t);
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json`,
      {
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const data = (await res.json()) as {
      address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
      display_name?: string;
    };
    const a = data.address || {};
    const place = a.city || a.town || a.village || a.state || data.display_name || `${lat}, ${lon}`;
    const country = a.country ? `, ${a.country}` : "";
    return `${place}${country}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

export async function resolveUserLocation(): Promise<UserLocation> {
  const cached = loadCached();
  if (cached) return cached;

  if (!("geolocation" in navigator)) throw new Error("Geolocation is not supported in this browser.");

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const place = await reverseGeocode(lat, lon);
  const loc: UserLocation = { lat, lon, place, updatedAt: Date.now() };
  saveCached(loc);
  return loc;
}

export function clearUserLocation(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}