import "server-only";
import { decodePng } from "@/lib/lightning/png";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { gridSize, locator } from "@/lib/models/grib2";
import { MODELS, REGIONS, latestCycle, record } from "@/lib/models/render";
import { compassPoint, sunPosition } from "@/lib/sky/astro";
import { latticeAreas, soften, type Areas } from "./areas";
import { OUTDOOR_BANDS } from "./colors";
import { openSky, rainbowChance } from "./outdoor";

/**
 * Rainbow Chance (Extras engine), a nowcast for now, +30 and +60 minutes. Radar (NOAA's
 * national base reflectivity mosaic) says where the rain is; GOES visible satellite says
 * where the sky is open; the sun's position says where it is low enough. Rain and cloud are
 * carried forward on the HRRR's 700 mb wind. For each place: rain 5–20 km opposite the sun,
 * open sky toward the sun, the sun between 0° and 42° up.
 */
const WMS = "https://nowcoast.noaa.gov/geoserver/ows";
const [W, S, E, N] = REGIONS.conus.b;
const STEP = 0.1;
const LW = Math.round((E - W) / STEP) + 1;
const LH = Math.round((N - S) / STEP) + 1;
let places: ReturnType<typeof parsePlaces> | null = null;

async function frame(layer: string, w: number, h: number) {
  const q = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: layer,
    styles: "",
    crs: "EPSG:4326",
    bbox: `${S},${W},${N},${E}`,
    width: String(w),
    height: String(h),
    format: "image/png",
    transparent: "true",
  });
  const r = await fetch(`${WMS}?${q}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`nowCOAST ${r.status}`);
  return decodePng(Buffer.from(await r.arrayBuffer()));
}

/** The 700 mb wind (m/s, east and north) from the newest HRRR run, kept per run. */
let steer: {
  cycle: string;
  at: (lat: number, lon: number) => [number, number];
} | null = null;
async function steering() {
  const cycle = await latestCycle("hrrr");
  if (!cycle) return () => [0, 0] as [number, number];
  if (steer?.cycle === cycle) return steer.at;
  const url = MODELS.hrrr.url(cycle.slice(0, 8), cycle.slice(8), 1);
  const [u, v] = await Promise.all([
    record(url, ":UGRD:700 mb:"),
    record(url, ":VGRD:700 mb:"),
  ]);
  const loc = locator(u.grid);
  const [w, h] = gridSize(u.grid);
  // HRRR winds are grid-relative; at these lead times the rotation matters little.
  const at = (lat: number, lon: number): [number, number] => {
    const [fi, fj] = loc(lat, lon);
    const x = Math.min(w - 1, Math.max(0, Math.round(fi)));
    const y = Math.min(h - 1, Math.max(0, Math.round(fj)));
    return [u.values[y * w + x], v.values[y * w + x]];
  };
  steer = { cycle, at };
  return at;
}

const move = (lat: number, lon: number, az: number, km: number) => {
  const r = (az * Math.PI) / 180;
  return [
    lat + (km * Math.cos(r)) / 111.32,
    lon + (km * Math.sin(r)) / (111.32 * Math.cos((lat * Math.PI) / 180)),
  ];
};

export type RainbowSpot = {
  lat: number;
  lon: number;
  value: number;
  place: string;
  look: string;
  /** How high the top of the bow stands (degrees). */
  top: number;
};
export type RainbowMap = {
  at: string;
  /** The map for now, +30 and +60 minutes. */
  maps: Areas[];
  spots: RainbowSpot[][];
  /** Whether the sun is anywhere low enough at each time. */
  lowSun: boolean[];
};

let memo: {
  at: number;
  v: Promise<RainbowMap & { grids: Float32Array[] }>;
} | null = null;

async function build(): Promise<RainbowMap & { grids: Float32Array[] }> {
  const [radar, sat, wind] = await Promise.all([
    frame("weather_radar:conus_base_reflectivity_mosaic", 2360, 1080),
    frame("satellite:goes_visible_imagery", 1180, 540),
    steering().catch(() => () => [0, 0] as [number, number]),
  ]);
  const px = (img: typeof radar, lat: number, lon: number) => {
    const x = Math.floor(((lon - W) / (E - W)) * img.w);
    const y = Math.floor(((N - lat) / (N - S)) * img.h);
    return x < 0 || y < 0 || x >= img.w || y >= img.h
      ? -1
      : (y * img.w + x) * 4;
  };
  const wet = (lat: number, lon: number) => {
    const k = px(radar, lat, lon);
    return k >= 0 && radar.rgba[k + 3] > 0;
  };
  const gray = (lat: number, lon: number) => {
    const k = px(sat, lat, lon);
    return k < 0 || sat.rgba[k + 3] === 0
      ? 255
      : (sat.rgba[k] + sat.rgba[k + 1] + sat.rgba[k + 2]) / 3;
  };
  const now = Date.now();
  const grids: Float32Array[] = [];
  const lowSun: boolean[] = [];
  for (const min of [0, 30, 60]) {
    const t = new Date(now + min * 60_000);
    const g = new Float32Array(LW * LH);
    let any = false;
    for (let j = 0; j < LH; j++) {
      const lat = N - j * STEP;
      for (let i = 0; i < LW; i++) {
        const lon = W + i * STEP;
        const sun = sunPosition(t, lat, lon);
        if (sun.altitude <= 0 || sun.altitude >= 42) continue;
        any = true;
        // Where the rain and cloud seen now will be in `min` minutes: look back upwind.
        const [ue, vn] = min ? wind(lat, lon) : [0, 0];
        const back = (la: number, lo: number) => [
          la - (vn * min * 60) / 111_320,
          lo - (ue * min * 60) / (111_320 * Math.cos((la * Math.PI) / 180)),
        ];
        const anti = (sun.azimuth + 180) % 360;
        let hits = 0;
        for (const km of [5, 10, 15, 20]) {
          const [a, b] = move(lat, lon, anti, km);
          const [c, d] = back(a, b);
          if (wet(c, d)) hits++;
        }
        if (!hits) continue;
        let open = 0;
        for (const km of [0, 5, 12]) {
          const [a, b] = move(lat, lon, sun.azimuth, km);
          const [c, d] = back(a, b);
          open += openSky(gray(c, d));
        }
        g[j * LW + i] = rainbowChance(sun.altitude, hits, open / 3);
      }
    }
    grids.push(g);
    lowSun.push(any);
  }
  const levels = OUTDOOR_BANDS.rainbow.levels;
  places ??= parsePlaces(PLACES);
  const rows = places;
  const spots = grids.map((g, n) => {
    const t = new Date(now + n * 30 * 60_000);
    const all: { lat: number; lon: number; value: number }[] = [];
    for (let j = 0; j < LH; j += 2)
      for (let i = 0; i < LW; i += 2) {
        const v = g[j * LW + i];
        if (v >= levels[1])
          all.push({ lat: N - j * STEP, lon: W + i * STEP, value: v });
      }
    all.sort((a, b) => b.value - a.value);
    const out: RainbowSpot[] = [];
    for (const s of all) {
      if (out.some((p) => Math.hypot(p.lat - s.lat, p.lon - s.lon) < 1))
        continue;
      // West of the Great Lakes the border is the 49th parallel.
      if (s.lat > 49.05 && s.lon < -95) continue;
      const near = nearestPlace(rows, s.lat, s.lon, 500);
      if (!near || near.miles > 30) continue;
      const sun = sunPosition(t, s.lat, s.lon);
      out.push({
        ...s,
        place: `${near.miles < 5 ? "" : `${Math.round(near.miles)} mi from `}${near.hit.name}, ${near.hit.st}`,
        look: compassPoint((sun.azimuth + 180) % 360),
        top: Math.round(42 - sun.altitude),
      });
      if (out.length >= 8) break;
    }
    return out;
  });
  return {
    at: new Date(now).toISOString(),
    maps: grids.map((g) =>
      latticeAreas(soften(g, LW, LH, 1), LW, LH, W, N, STEP, levels),
    ),
    spots,
    lowSun,
    grids,
  };
}

/** The nowcast, rebuilt at most every 5 minutes per server. */
export function rainbowNow() {
  if (!memo || Date.now() - memo.at > 5 * 60_000) {
    const v = build();
    memo = { at: Date.now(), v };
    v.catch(() => {
      if (memo?.v === v) memo = null;
    });
  }
  return memo.v;
}

/** The chance at one place now (0–100), and which way to look. */
export async function rainbowAt(lat: number, lon: number) {
  const d = await rainbowNow();
  const i = Math.round((lon - W) / STEP);
  const j = Math.round((N - lat) / STEP);
  if (i < 0 || j < 0 || i >= LW || j >= LH) return null;
  const sun = sunPosition(new Date(), lat, lon);
  return {
    chance: d.grids[0][j * LW + i],
    look: compassPoint((sun.azimuth + 180) % 360),
    top: Math.round(42 - sun.altitude),
  };
}
