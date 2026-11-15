import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { decodePng } from "./png";
import { classOf } from "./style";

/**
 * Lightning from NOAA nowCOAST's strike-density product (NLDN and GLD360 ground networks,
 * 15-minute frames, 8 km; a derived product cleared for public distribution). We read the
 * frames pixel by pixel to measure lightning around a place and find national hotspots.
 */
export const WMS = "https://nowcoast.noaa.gov/geoserver/ows";
export const LAYER = "lightning_detection:ldn_lightning_strike_density";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };

/** Frame times available now, oldest first (ISO). */
export async function frameTimes(): Promise<string[]> {
  const r = await fetch(
    "https://nowcoast.noaa.gov/geoserver/lightning_detection/ldn_lightning_strike_density/ows?service=WMS&version=1.3.0&request=GetCapabilities",
    {
      headers: UA,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok) throw new Error(`nowCOAST ${r.status}`);
  const m = (await r.text()).match(
    /<Dimension name="time"[^>]*>([^<]+)<\/Dimension>/,
  );
  return m
    ? m[1]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
}

type Box = [number, number, number, number]; // west, south, east, north

/** One frame over a lon/lat box as class indexes (−1 none), row 0 = north. */
export async function frame(time: string, box: Box, w: number, h: number) {
  const q = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: LAYER,
    styles: "",
    format: "image/png",
    transparent: "true",
    crs: "CRS:84",
    bbox: box.join(","),
    width: String(w),
    height: String(h),
    time,
  });
  const r = await fetch(`${WMS}?${q}`, {
    headers: UA,
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok || !r.headers.get("content-type")?.includes("png"))
    throw new Error(`frame ${r.status}`);
  const { rgba } = decodePng(Buffer.from(await r.arrayBuffer()));
  const cls = new Int8Array(w * h);
  for (let i = 0; i < w * h; i++)
    cls[i] = classOf(
      rgba[i * 4],
      rgba[i * 4 + 1],
      rgba[i * 4 + 2],
      rgba[i * 4 + 3],
    );
  return cls;
}

const R = 3958.8;
const toRad = Math.PI / 180;

export type NearFrame = {
  t: string;
  in10: number;
  in30: number;
  in60: number;
  nearest: { miles: number; bearing: number } | null;
  peak: number;
};

/** Lightning within ~120 miles of a place over the last hour, plus the latest frame's points. */
export async function near(lat: number, lon: number) {
  const times = (await frameTimes()).slice(-4);
  if (!times.length) return null;
  const dLat = 1.8;
  const dLon = 1.8 / Math.cos(lat * toRad);
  const box: Box = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
  const W = 144;
  const H = 144;
  const frames = await Promise.all(
    times.map((t) => frame(t, box, W, H).catch(() => null)),
  );
  const out: NearFrame[] = [];
  let points: [number, number, number][] = [];
  frames.forEach((cls, k) => {
    if (!cls) return;
    const f: NearFrame = {
      t: times[k],
      in10: 0,
      in30: 0,
      in60: 0,
      nearest: null,
      peak: -1,
    };
    const pts: [number, number, number][] = [];
    for (let y = 0; y < H; y++) {
      const plat = box[3] - ((y + 0.5) / H) * (box[3] - box[1]);
      for (let x = 0; x < W; x++) {
        const c = cls[y * W + x];
        if (c < 0) continue;
        const plon = box[0] + ((x + 0.5) / W) * (box[2] - box[0]);
        const dx = (plon - lon) * toRad * Math.cos(lat * toRad) * R;
        const dy = (plat - lat) * toRad * R;
        const mi = Math.hypot(dx, dy);
        if (mi <= 10) f.in10++;
        if (mi <= 30) f.in30++;
        if (mi <= 60) f.in60++;
        if (mi <= 60) f.peak = Math.max(f.peak, c);
        if (!f.nearest || mi < f.nearest.miles)
          f.nearest = {
            miles: Math.round(mi),
            bearing: Math.round(
              ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360,
            ),
          };
        if (mi <= 120 && (x + y) % 2 === 0)
          pts.push([Math.round(dx * 10) / 10, Math.round(dy * 10) / 10, c]);
      }
    }
    out.push(f);
    if (k === frames.length - 1) points = pts;
  });
  // Pixel counts → square miles (each pixel is a 2.5×2.5 mile patch at this zoom).
  const cell =
    ((box[3] - box[1]) / H) *
    69.1 *
    (((box[2] - box[0]) / W) * 69.1 * Math.cos(lat * toRad));
  return { cellSqMi: Math.round(cell * 10) / 10, frames: out, points };
}

let rows: ReturnType<typeof parsePlaces> | null = null;
const CONUS: Box = [-125, 24, -66, 50];

/** National picture: lightning area now and an hour ago, and the strongest hotspots by town. */
export async function national() {
  const times = await frameTimes();
  const now = times[times.length - 1];
  const before = times[times.length - 5];
  if (!now) return null;
  const W = 590;
  const H = 260;
  const [a, b] = await Promise.all([
    frame(now, CONUS, W, H),
    before ? frame(before, CONUS, W, H).catch(() => null) : null,
  ]);
  const lit = (c: Int8Array | null) =>
    c ? c.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0) : null;
  // Score 1° cells by lit pixels weighted by class, then pick hotspots 2.5° apart.
  const cells = new Map<
    string,
    { lat: number; lon: number; score: number; peak: number }
  >();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = a[y * W + x];
      if (c < 0) continue;
      const plat = 50 - (y + 0.5) * 0.1;
      const plon = -125 + (x + 0.5) * 0.1;
      const key = `${Math.floor(plat)},${Math.floor(plon)}`;
      const cell = cells.get(key) ?? { lat: 0, lon: 0, score: 0, peak: -1 };
      const wgt = 1 + c;
      cell.lat += plat * wgt;
      cell.lon += plon * wgt;
      cell.score += wgt;
      cell.peak = Math.max(cell.peak, c);
      cells.set(key, cell);
    }
  rows ??= parsePlaces(PLACES);
  const picks: {
    lat: number;
    lon: number;
    peak: number;
    score: number;
    place: string;
  }[] = [];
  for (const c of [...cells.values()].sort((p, q) => q.score - p.score)) {
    const lat = c.lat / c.score;
    const lon = c.lon / c.score;
    if (
      picks.some(
        (p) =>
          Math.hypot(p.lat - lat, (p.lon - lon) * Math.cos(lat * toRad)) < 2.5,
      )
    )
      continue;
    const town = nearestPlace(rows, lat, lon, 20000);
    const dir = town
      ? compass(
          lat - town.hit.lat,
          (lon - town.hit.lon) * Math.cos(lat * toRad),
        )
      : "";
    picks.push({
      lat: Math.round(lat * 100) / 100,
      lon: Math.round(lon * 100) / 100,
      peak: c.peak,
      score: Math.round(c.score),
      place: !town
        ? region(lat, lon)
        : town.miles < 8
          ? `${town.hit.name}, ${town.hit.st}`
          : town.miles > 100
            ? `${region(lat, lon)}, ${Math.round(town.miles)} mi ${dir} of ${town.hit.name}, ${town.hit.st}`
            : `${Math.round(town.miles)} mi ${dir} of ${town.hit.name}, ${town.hit.st}`,
    });
    if (picks.length >= 8) break;
  }
  return {
    t: now,
    before: before ?? null,
    lit: lit(a),
    litBefore: lit(b),
    hotspots: picks,
  };
}

/** A rough name for lightning far from any US town. */
function region(lat: number, lon: number) {
  if (lon < -117 && lat < 33) return "Off Baja California";
  if (lon < -97 && lat < 31.8) return "Northern Mexico";
  if (lon >= -97.5 && lon < -81 && lat < 29.5) return "Gulf of Mexico";
  if (lon >= -81 && lat < 32) return "Off the Southeast coast";
  if (lon > -76) return "Over the Atlantic";
  if (lon < -124) return "Over the Pacific";
  return "Near the border";
}

function compass(dLat: number, dLonScaled: number) {
  const d = ((Math.atan2(dLonScaled, dLat) * 180) / Math.PI + 360) % 360;
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(d / 45) % 8];
}

/**
 * Lightning over the whole lower 48 in the last half hour (the two newest 15-minute frames),
 * as strike-density classes on a `w`×`h` lon/lat grid over `box`, row 0 north (−1 none).
 * For the Lightning Threat engine's first hour (post-launch A6).
 */
export async function nationalStrikes(box: Box, w: number, h: number) {
  const times = (await frameTimes()).slice(-2);
  if (!times.length) return null;
  const frames = await Promise.all(
    times.map((t) => frame(t, box, w, h).catch(() => null)),
  );
  const out = new Int8Array(w * h).fill(-1);
  let any = false;
  for (const f of frames) {
    if (!f) continue;
    any = true;
    for (let i = 0; i < out.length; i++) if (f[i] > out[i]) out[i] = f[i];
  }
  return any ? out : null;
}
