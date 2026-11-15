import "server-only";
import { decodePng } from "@/lib/lightning/png";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { gridSize, locator } from "@/lib/models/grib2";
import { MODELS, REGIONS, latestCycle, record } from "@/lib/models/render";
import { compassPoint, sunPosition } from "@/lib/sky/astro";
import { latticeAreas, soften, type Areas } from "./areas";
import { OUTDOOR_BANDS } from "./colors";
import { dropFactor, openSky, rainbowChance } from "./outdoor";

/**
 * Rainbow Chance (Extras engine), a nowcast for now, +30 and +60 minutes. Radar (NOAA's
 * national base reflectivity mosaic, 15 dBZ or more: real rain, not clutter or drizzle) says
 * where the rain is; the HRRR's total cloud and GOES visible satellite say where the sky is
 * open toward the sun (the model alone with the sun under 15°, when visible imagery goes dark
 * whatever the sky); the sun's position says where it is low enough. Radar rain is carried
 * forward on each shower's own tracked motion (ProbSevere), or the HRRR's 700 mb wind away
 * from tracked storms, and heavier showers (bigger drops) count a little more. For each place: rain 5–20 km opposite the sun, open sky
 * toward the sun (out to 40 km when it is under 10°), the sun between 0° and 42° up.
 */
const WMS = "https://nowcoast.noaa.gov/geoserver/ows";

/** nowCOAST's reflectivity ramp from 6 dBZ (lighter returns are drawn 40% see-through). */
const RAMP = (
  "6:599494 8:3bb1b1 9:1dcece 10:00ecec 11:00d9ee 13:00c6f1 14:00b3f3 15:01a0f6 16:0078f6 " +
  "18:0050f6 19:0028f6 20:0000f6 21:003fb8 23:007f7b 24:00bf3d 25:00ff00 26:00f100 28:00e300 " +
  "29:00d500 30:00c800 31:00ba00 33:00ac00 34:009e00 35:009000 36:3fab00 38:7fc700 39:bfe300 " +
  "40:ffff00 41:f9ef00 43:f3df00 44:edcf00 45:e7c000 46:edb400 48:f3a800 49:f99c00 50:ff9000 " +
  "51:ff6c00 53:ff4800 54:ff2400 55:ff0000 56:f60000 58:ed0000 59:e40000 60:dc0000 61:d50000 " +
  "63:ce0000 64:c70000 65:c00000 66:cf003f 68:df007f 69:ef00bf 70:ff00ff 71:e515f1 73:cc2ae4 " +
  "74:b23fd6 75:9955c9 76:747bce 78:4fa1d4 79:2ac7da 80:05ede0"
)
  .split(" ")
  .map((e) => {
    const [q, c] = e.split(":");
    const n = parseInt(c, 16);
    return [Number(q), n >> 16, (n >> 8) & 255, n & 255];
  });
const dbzMemo = new Map<number, number>();

/** A radar pixel back to dBZ by the nearest color on the ramp (0 when see-through or empty). */
export function dbzOf(r: number, g: number, b: number, a: number) {
  if (a < 200) return 0;
  const key = (r << 16) | (g << 8) | b;
  let v = dbzMemo.get(key);
  if (v === undefined) {
    let best = Infinity;
    v = 0;
    for (const [q, R, G, B] of RAMP) {
      const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
      if (d < best) {
        best = d;
        v = q;
      }
    }
    dbzMemo.set(key, v);
  }
  return v;
}

const cycleMs = (c: string) =>
  Date.UTC(+c.slice(0, 4), +c.slice(4, 6) - 1, +c.slice(6, 8), +c.slice(8));

/** The HRRR's total cloud (0–1) for the next three hours of the newest run, kept per run. */
let cloud: {
  cycle: string;
  at: (lat: number, lon: number, t: number) => number;
} | null = null;
async function cloudiness() {
  const cycle = await latestCycle("hrrr");
  if (!cycle) return null;
  if (cloud?.cycle === cycle) return cloud.at;
  const recs = await Promise.all(
    [1, 2, 3].map((fh) =>
      record(
        MODELS.hrrr.url(cycle.slice(0, 8), cycle.slice(8), fh),
        ":TCDC:entire atmosphere:",
      ),
    ),
  );
  const c0 = cycleMs(cycle);
  const loc = locator(recs[0].grid);
  const [w, h] = gridSize(recs[0].grid);
  const at = (lat: number, lon: number, t: number) => {
    const fh = Math.min(3, Math.max(1, Math.round((t - c0) / 3600_000)));
    const [fi, fj] = loc(lat, lon);
    const x = Math.min(w - 1, Math.max(0, Math.round(fi)));
    const y = Math.min(h - 1, Math.max(0, Math.round(fj)));
    const v = recs[fh - 1].values[y * w + x];
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v / 100)) : 0;
  };
  cloud = { cycle, at };
  return at;
}
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

/**
 * Showers move with their own tracked motion (post-launch A6): every storm ProbSevere follows
 * carries its motion (m/s east and north) out to 80 km, weighted by inverse distance; beyond
 * every tracked storm the 700 mb wind is used.
 */
async function stormMotion(
  wind: (lat: number, lon: number) => [number, number],
) {
  const m = await import("./probsevere");
  const name = (await m.fileNames()).at(-1);
  const cells = name ? m.cells(await m.file(name)) : [];
  // Bucketed by whole degree so each lookup only scans nearby storms.
  const grid = new Map<string, typeof cells>();
  for (const c of cells) {
    const k = `${Math.floor(c.lat)},${Math.floor(c.lon)}`;
    grid.set(k, [...(grid.get(k) ?? []), c]);
  }
  return (lat: number, lon: number): [number, number] => {
    let we = 0;
    let e = 0;
    let n = 0;
    const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (const c of grid.get(
          `${Math.floor(lat) + a},${Math.floor(lon) + b}`,
        ) ?? []) {
          const d = Math.hypot((c.lat - lat) * 111.32, (c.lon - lon) * kx);
          if (d > 80) continue;
          const w = 1 / Math.max(5, d) ** 2;
          we += w;
          e += w * c.east;
          n += w * c.north;
        }
    return we ? [e / we, n / we] : wind(lat, lon);
  };
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
  const [radar, sat, steer700, cld] = await Promise.all([
    frame("weather_radar:conus_base_reflectivity_mosaic", 2360, 1080),
    frame("satellite:goes_visible_imagery", 1180, 540),
    steering().catch(() => () => [0, 0] as [number, number]),
    cloudiness().catch(() => null),
  ]);
  const wind = await stormMotion(steer700).catch(() => steer700);
  const px = (img: typeof radar, lat: number, lon: number) => {
    const x = Math.floor(((lon - W) / (E - W)) * img.w);
    const y = Math.floor(((N - lat) / (N - S)) * img.h);
    return x < 0 || y < 0 || x >= img.w || y >= img.h
      ? -1
      : (y * img.w + x) * 4;
  };
  const dbz = (lat: number, lon: number) => {
    const k = px(radar, lat, lon);
    const p = radar.rgba;
    return k >= 0 ? dbzOf(p[k], p[k + 1], p[k + 2], p[k + 3]) : 0;
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
        let peak = 0;
        for (const km of [5, 10, 15, 20]) {
          const [a, b] = move(lat, lon, anti, km);
          const [c, d] = back(a, b);
          const z = dbz(c, d);
          if (z >= 15) hits++;
          peak = Math.max(peak, z);
        }
        if (!hits) continue;
        // A low sun shines in under clouds farther away, so look farther toward it.
        const far = sun.altitude < 10 ? [0, 8, 20, 40] : [0, 5, 12];
        let open = 0;
        for (const km of far) {
          const [a, b] = move(lat, lon, sun.azimuth, km);
          const [c, d] = back(a, b);
          const vis = openSky(gray(c, d));
          // The model forecast is already for time t: no carrying needed.
          const model = cld ? 1 - cld(a, b, t.getTime()) : null;
          open +=
            model === null
              ? vis
              : sun.altitude < 15
                ? model
                : (vis + model) / 2;
        }
        g[j * LW + i] = Math.min(
          100,
          Math.round(
            rainbowChance(sun.altitude, hits, open / far.length) *
              dropFactor(peak),
          ),
        );
      }
    }
    grids.push(g);
    lowSun.push(any);
  }
  const levels = OUTDOOR_BANDS.rainbow.levels;
  places ??= parsePlaces(PLACES);
  const rows = places;
  // The list, the map and the alerts all read the same softened field, so a spot's chance
  // always lands in the band the map draws there (a raw 93% peak used to be averaged into
  // "Good" on the map while the list still said 93%).
  const soft = grids.map((g) => soften(g, LW, LH, 1));
  const spots = soft.map((g, n) => {
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
    // Small minimum area: a listed spot's peak is often only a cell or two across.
    maps: soft.map((g) => latticeAreas(g, LW, LH, W, N, STEP, levels, 0.25)),
    spots,
    lowSun,
    grids: soft,
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
