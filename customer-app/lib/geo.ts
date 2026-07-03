// Customer ⇄ vendor distance. Vendor coordinates come pre-geocoded from the API
// (see backend GeocodingService); the customer's coordinates come from the
// browser Geolocation API and are cached in localStorage so we don't re-prompt
// on every page. Distance is computed here in the browser (Haversine) — the
// backend never does per-request distance math.

export type Coords = { lat: number; lng: number };

type StoredCoords = Coords & { at: number };

const COORDS_KEY = "epey.customerCoords";
// Re-use cached coordinates for an hour before bothering to refresh them.
const FRESH_MS = 60 * 60 * 1000;

/** Fired (same-tab) whenever the cached customer coordinates change. */
export const COORDS_EVENT = "epey-coords-changed";

export function readCustomerCoords(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredCoords;
    if (!v || typeof v.lat !== "number" || typeof v.lng !== "number") return null;
    return { lat: v.lat, lng: v.lng };
  } catch { return null; }
}

export function saveCustomerCoords(lat: number, lng: number) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const v: StoredCoords = { lat, lng, at: Date.now() };
  localStorage.setItem(COORDS_KEY, JSON.stringify(v));
  window.dispatchEvent(new Event(COORDS_EVENT));
}

function cachedFresh(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredCoords;
    if (typeof v.lat !== "number" || typeof v.lng !== "number") return null;
    return Date.now() - (v.at ?? 0) < FRESH_MS ? { lat: v.lat, lng: v.lng } : null;
  } catch { return null; }
}

/**
 * Best-effort read of the customer's location WITHOUT surprising them with a
 * permission prompt:
 *   - returns fresh cached coords immediately, else
 *   - refreshes silently only if permission was already granted, else
 *   - returns any stale cached coords (or null).
 * The explicit "Use current location" button in the location picker is what
 * seeds the cache the first time (and may prompt).
 */
export async function getCustomerCoordsQuiet(): Promise<Coords | null> {
  const fresh = cachedFresh();
  if (fresh) return fresh;

  if (typeof navigator !== "undefined" && navigator.geolocation && navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (status.state === "granted") {
        const pos = await getCurrentPositionAsync();
        if (pos) { saveCustomerCoords(pos.lat, pos.lng); return pos; }
      }
    } catch { /* permissions API unavailable — fall through */ }
  }
  return readCustomerCoords(); // may be stale, still better than nothing
}

// One-shot "asked already" flag so we never nag on repeat visits: if the user
// dismisses the browser prompt (leaving permission in the 'prompt' state), we
// still won't re-ask on the next load.
const ASKED_KEY = "epey.geoAsked";

/**
 * Get the customer's location for distances, prompting AT MOST ONCE (ever):
 *   - fresh cached coords          → return immediately (no prompt)
 *   - permission granted           → refresh silently
 *   - permission denied            → give up (no prompt)
 *   - permission 'prompt', 1st time → ask the browser once, remember we asked
 * Used on the home page so distances appear automatically the first time,
 * without pestering the customer on every visit.
 */
export async function requestCustomerLocationOnce(): Promise<Coords | null> {
  const fresh = cachedFresh();
  if (fresh) return fresh;
  if (typeof navigator === "undefined" || !navigator.geolocation) return readCustomerCoords();

  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (status.state === "denied") return readCustomerCoords();
      if (status.state === "granted") {
        const pos = await getCurrentPositionAsync();
        if (pos) { saveCustomerCoords(pos.lat, pos.lng); return pos; }
        return readCustomerCoords();
      }
      // status.state === 'prompt' → fall through to the one-shot ask
    }
  } catch { /* permissions API unavailable — fall through */ }

  // 'prompt' (or no permissions API): ask once, then never auto-ask again.
  if (typeof window !== "undefined") {
    if (localStorage.getItem(ASKED_KEY)) return readCustomerCoords();
    localStorage.setItem(ASKED_KEY, "1");
  }
  const pos = await getCurrentPositionAsync();
  if (pos) { saveCustomerCoords(pos.lat, pos.lng); return pos; }
  return readCustomerCoords();
}

/** Prompt-if-needed wrapper around getCurrentPosition. Resolves null on failure/deny. */
export function getCurrentPositionAsync(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371; // Earth radius, km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Human distance: "850 m", "1.2 km", "14 km". */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Distance from the customer to a vendor, or null if either coordinate is missing. */
export function distanceToVendor(
  me: Coords | null,
  vendor: { latitude?: number | null; longitude?: number | null },
): number | null {
  if (!me || vendor.latitude == null || vendor.longitude == null) return null;
  const d = haversineKm(me, { lat: vendor.latitude, lng: vendor.longitude });
  return Number.isFinite(d) ? d : null;
}
