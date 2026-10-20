/**
 * Snapping a leg of a drawn route to the roads (ported from the Log repo's chase builder).
 *
 * Two public routers answer from the browser (both send CORS headers), and the second is
 * tried when the first does not answer. When neither does, the leg is drawn straight and
 * marked so, never refused: the builder keeps working on bad motel Wi-Fi.
 */
import { haversine } from "@/features/replay/core/geo";

export type RouteLeg = {
  /** [lon, lat] vertices, first stop to second. */
  geometry: [number, number][];
  distanceM: number;
  snapped: "road" | "straight";
};
type At = { lat: number; lon: number };

const OSRM = "https://router.project-osrm.org/route/v1/driving";
const VALHALLA = "https://valhalla1.openstreetmap.de/route";
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
const cache = new Map<string, RouteLeg>();

async function withTimeout<T>(
  p: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await p(ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function osrm(a: At, b: At): Promise<RouteLeg | null> {
  const url = `${OSRM}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
  return withTimeout(async (signal) => {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      code: string;
      routes?: {
        geometry: { coordinates: [number, number][] };
        distance: number;
      }[];
    };
    const r = j.routes?.[0];
    if (j.code !== "Ok" || !r || r.geometry.coordinates.length < 2) return null;
    return {
      geometry: r.geometry.coordinates.map(
        ([x, y]) => [round6(x), round6(y)] as [number, number],
      ),
      distanceM: r.distance,
      snapped: "road",
    };
  }, 9000);
}

async function valhalla(a: At, b: At): Promise<RouteLeg | null> {
  const body = {
    locations: [
      { lat: a.lat, lon: a.lon },
      { lat: b.lat, lon: b.lon },
    ],
    costing: "auto",
  };
  const url = `${VALHALLA}?json=${encodeURIComponent(JSON.stringify(body))}`;
  return withTimeout(async (signal) => {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      trip?: { legs: { shape: string }[]; summary: { length: number } };
    };
    if (!j.trip?.legs?.length) return null;
    const geometry = j.trip.legs.flatMap((l) => decodePolyline(l.shape, 6));
    if (geometry.length < 2) return null;
    return {
      geometry,
      distanceM: j.trip.summary.length * 1000,
      snapped: "road",
    };
  }, 9000);
}

/** A straight leg between two stops. */
export const straightLeg = (a: At, b: At): RouteLeg => ({
  geometry: [
    [a.lon, a.lat],
    [b.lon, b.lat],
  ],
  distanceM: haversine(a.lat, a.lon, b.lat, b.lon),
  snapped: "straight",
});

/** The road between two stops, or a straight line when no router answers. */
export async function routeLeg(a: At, b: At): Promise<RouteLeg> {
  const key = `${a.lon.toFixed(5)},${a.lat.toFixed(5)};${b.lon.toFixed(5)},${b.lat.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  for (const router of [osrm, valhalla]) {
    try {
      const leg = await router(a, b);
      if (leg) {
        cache.set(key, leg);
        return leg;
      }
    } catch {
      // Try the next one.
    }
  }
  return straightLeg(a, b);
}

/** Google's encoded polyline format, at the given precision (Valhalla uses 6). */
export function decodePolyline(s: string, precision = 5): [number, number][] {
  const f = 10 ** precision;
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  while (i < s.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = s.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && i < s.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lon += delta;
    }
    out.push([round6(lon / f), round6(lat / f)]);
  }
  return out;
}
