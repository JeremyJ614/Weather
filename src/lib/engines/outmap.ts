import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { locator, type Field } from "@/lib/models/grib2";
import { exists, record } from "@/lib/models/render";
import { project } from "@/lib/map/usAlbers";
import nation from "@/lib/map/data/usNationAlbers.json";
import { sunTimes } from "@/lib/sky/astro";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { latticeAreas, soften, type Areas } from "./areas";
import { OUTMAP } from "./colors";
import { tuned } from "./fields";
import {
  SPECIES,
  deerScore,
  fishScore,
  rutBoost,
  type SpeciesId,
  type Weights,
} from "./outdoor";
import { deerConfig, solunar } from "./places";

/**
 * Deer Activity and Fishing Bite as SPC-style outlooks of the lower 48 (review round, owner
 * 2026-10-26): Day 1, 2 and 3 maps of nested categories. Each place is scored at its own
 * dawn and dusk (when deer move and fish bite) from the GFS's 3-hourly forecast, so the map
 * shows what the weather does to those hours: temperature against the two days before,
 * the pressure trend, wind, rain, cloud, the rut and the moon. One computation per GFS run
 * covers both engines and every species; each map is stored in `engine_maps` and
 * overwritten by the next run, so storage stays flat.
 */

/** The lattice: 0.5° over the lower 48, on the GFS's own grid points. */
export const LAT = { W: -125, E: -66.5, S: 24.5, N: 49.5, step: 0.5 };
const NW = Math.round((LAT.E - LAT.W) / LAT.step) + 1;
const NH = Math.round((LAT.N - LAT.S) / LAT.step) + 1;
const H3 = 3 * 3600_000;
const DAY = 86400_000;

export type OutSpot = {
  lat: number;
  lon: number;
  value: number;
  place: string;
  /** When its better window is, ms, and which one (by the spot's own sun). */
  at: number;
  window: "dawn" | "dusk";
};
export type OutDay = {
  /** The Central-time date, YYYY-MM-DD. */
  date: string;
  areas: Areas;
  spots: OutSpot[];
  /** The middle score across the map that day. */
  typical: number;
};
export type OutMap = {
  kind: "deer" | "fish";
  species?: SpeciesId;
  /** The GFS run, YYYYMMDDHH. */
  cycle: string;
  at: string;
  levels: number[];
  days: OutDay[];
};

const gfsUrl = (c: string, fh: number) =>
  `https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.${c.slice(0, 8)}/${c.slice(8)}/atmos/gfs.t${c.slice(8)}z.pgrb2full.0p50.f${String(fh).padStart(3, "0")}`;
const cycleId = (t: number) =>
  new Date(t).toISOString().slice(0, 13).replace(/[-T]/g, "");

/** Today's Central date, or tomorrow's once today's dusk has passed (after 8 p.m.). */
export function firstDay(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const d = Date.UTC(get("year"), get("month") - 1, get("day"));
  return get("hour") >= 20 ? d + DAY : d;
}

/** Lattice points inside the lower 48 (the outline as drawn in Albers USA). */
let mask: Uint8Array | null = null;
function usMask() {
  if (mask) return mask;
  const rings: [number, number][][] = [];
  for (const part of (nation as { nation: string }).nation.split("Z")) {
    const pts = [...part.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as [number, number],
    );
    // Skip the Alaska and Hawaii insets: Mexico projects onto their spot on the canvas.
    if (pts.length > 2 && !pts.every(([x, y]) => x < 340 && y > 450))
      rings.push(pts);
  }
  const inside = (x: number, y: number) => {
    let c = false;
    for (const r of rings)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
          c = !c;
      }
    return c;
  };
  mask = new Uint8Array(NW * NH);
  for (let j = 0; j < NH; j++)
    for (let i = 0; i < NW; i++) {
      const lat = LAT.N - j * LAT.step;
      const lon = LAT.W + i * LAT.step;
      // A cell counts if any of its corners is in the country, so the coast keeps its cells.
      let hit = false;
      for (const [dy, dx] of [
        [0, 0],
        [0.2, 0.2],
        [-0.2, 0.2],
        [0.2, -0.2],
        [-0.2, -0.2],
      ]) {
        const p = project(lon + dx, lat + dy);
        if (inside(p.x, p.y)) hit = true;
      }
      mask[j * NW + i] = hit ? 1 : 0;
    }
  return mask;
}

/** Whether a lattice point is part of the maps. */
export const inLower48 = (lat: number, lon: number) =>
  usMask()[
    Math.round((LAT.N - lat) / LAT.step) * NW +
      Math.round((lon - LAT.W) / LAT.step)
  ] === 1;

/** A field sampled onto the lattice (the lattice sits on the GFS 0.5° points). */
function sample(f: Field) {
  const loc = locator(f.grid);
  const ni = f.grid.kind === "latlon" ? f.grid.ni : 0;
  const out = new Float32Array(NW * NH);
  for (let j = 0; j < NH; j++)
    for (let i = 0; i < NW; i++) {
      const [gi, gj] = loc(LAT.N - j * LAT.step, LAT.W + i * LAT.step);
      out[j * NW + i] = f.values[Math.round(gj) * ni + Math.round(gi)];
    }
  return out;
}

/** Runs `jobs` with at most `n` at a time. */
async function pool<T>(jobs: (() => Promise<T>)[], n: number) {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, jobs.length) }, async () => {
      while (next < jobs.length) {
        const k = next++;
        out[k] = await jobs[k]();
      }
    }),
  );
  return out;
}

const FIELDS = {
  t: ":TMP:2 m above ground:",
  p: ":PRMSL:mean sea level:",
  u: ":UGRD:10 m above ground:",
  v: ":VGRD:10 m above ground:",
  r: ":PRATE:surface:",
  c: ":TCDC:entire atmosphere:",
} as const;
type Key = keyof typeof FIELDS;

/** The newest run at or before `atMost` whose forecast reaches `until`. */
async function runFor(atMost: number, until: number) {
  let c = Math.floor(atMost / (6 * 3600_000)) * 6 * 3600_000;
  for (let k = 0; k < 8; k++, c -= 6 * 3600_000) {
    const fh = Math.round((until - c) / 3600_000);
    if (fh > 240) continue;
    if (await exists(gfsUrl(cycleId(c), fh - (fh % 3)))) return c;
  }
  return null;
}

/** Linear interpolation of a 3-hourly series at time t for one cell. */
const at = (s: Float32Array[], t0: number, t: number, i: number) => {
  const x = (t - t0) / H3;
  const k = Math.max(0, Math.min(s.length - 2, Math.floor(x)));
  const f = Math.max(0, Math.min(1, x - k));
  return s[k][i] * (1 - f) + s[k + 1][i] * f;
};
const K2F = (k: number) => ((k - 273.15) * 9) / 5 + 32;

/** The category a score falls in, -1 below the first. */
export const categoryOf = (v: number, levels: number[]) =>
  levels.findLastIndex((l) => v >= l);

/** A day's map values (NaN outside the country) as softened SPC-style areas. */
export function outlookAreas(vals: Float32Array, levels: number[]): Areas {
  const a = latticeAreas(
    soften(vals, NW, NH, 2),
    NW,
    NH,
    LAT.W,
    LAT.N,
    LAT.step,
    levels,
    3,
  );
  // Hundredths of a degree (about half a mile) is finer than a 0.5° lattice can draw.
  const r = (x: number) => Math.round(x * 100) / 100;
  for (const f of a.features)
    f.geometry.coordinates = f.geometry.coordinates.map((p) =>
      p.map((ring) => ring.map(([x, y]) => [r(x), r(y)])),
    );
  return a;
}

let places: ReturnType<typeof parsePlaces> | null = null;
function topSpots(vals: Float32Array, when: Float64Array, first: number) {
  places ??= parsePlaces(PLACES);
  const order = [...vals.keys()]
    .filter((k) => !Number.isNaN(vals[k]))
    .sort((a, b) => vals[b] - vals[a]);
  const spots: OutSpot[] = [];
  for (const k of order) {
    if (spots.length >= 6 || vals[k] < first) break;
    const lat = LAT.N - Math.floor(k / NW) * LAT.step;
    const lon = LAT.W + (k % NW) * LAT.step;
    if (spots.some((s) => Math.hypot(s.lat - lat, s.lon - lon) < 2.5)) continue;
    const near = nearestPlace(places, lat, lon, 1500);
    if (!near || near.miles > 40) continue;
    spots.push({
      lat,
      lon,
      value: Math.round(vals[k]),
      place: `${near.miles < 5 ? "" : `${Math.round(near.miles)} mi from `}${near.hit.name}, ${near.hit.st}`,
      at: when[k],
      window:
        (((when[k] / 3600_000 + lon / 15) % 24) + 24) % 24 < 12
          ? "dawn"
          : "dusk",
    });
  }
  return spots;
}

const median = (v: Float32Array) => {
  const a = [...v].filter((x) => !Number.isNaN(x)).sort((x, y) => x - y);
  return a.length ? Math.round(a[a.length >> 1]) : 0;
};

/** Computes every Deer and Fishing map from the newest usable GFS run. */
export async function computeOutdoorMaps(now = Date.now()): Promise<OutMap[]> {
  const d0 = firstDay(now);
  // Steps: 06Z on day 1 to 03Z after day 3 (each place's dawn and dusk fall inside).
  const start = d0 + 6 * 3600_000;
  const end = d0 + 3 * DAY + 3 * 3600_000;
  const steps = Array.from(
    { length: Math.round((end - start) / H3) + 1 },
    (_, k) => start + k * H3,
  );
  // The newest run reaching the end; steps it starts too late for come from an older one.
  const newest = await runFor(Math.min(now, end), end);
  if (newest === null) throw new Error("No GFS run reaches day 3 yet");
  const older =
    newest > start - H3 ? ((await runFor(start - H3, end)) ?? newest) : newest;
  const runOf = (t: number) => (t - newest >= H3 ? newest : older);
  // Two days before for "colder than the days before", from a run two days older.
  const hist = Array.from({ length: 16 }, (_, k) => start - 2 * DAY + k * H3);
  const histRun = (await runFor(hist[0] - H3, hist[hist.length - 1])) ?? older;

  const jobs: (() => Promise<{ k: Key | "h"; s: number; v: Float32Array }>)[] =
    [];
  steps.forEach((t, s) => {
    const run = runOf(t);
    const fh = Math.round((t - run) / 3600_000);
    for (const k of Object.keys(FIELDS) as Key[])
      jobs.push(async () => ({
        k,
        s,
        v: sample(await record(gfsUrl(cycleId(run), fh), FIELDS[k])),
      }));
  });
  hist.forEach((t, s) => {
    const fh = Math.round((t - histRun) / 3600_000);
    jobs.push(async () => ({
      k: "h",
      s,
      v: sample(await record(gfsUrl(cycleId(histRun), fh), FIELDS.t)),
    }));
  });
  const got = await pool(jobs, 14);
  const series: Record<Key | "h", Float32Array[]> = {
    t: [],
    p: [],
    u: [],
    v: [],
    r: [],
    c: [],
    h: [],
  };
  for (const g of got) series[g.k][g.s] = g.v;
  // Temperatures from two days before through day 3, for "colder than before" and water.
  const allT = [...series.h, ...series.t];
  const t0All = hist[0];

  const [deerW, fishW, cfg] = await Promise.all([
    tuned("deer").catch(() => ({}) as Weights),
    tuned("fish").catch(() => ({}) as Weights),
    deerConfig(),
  ]);
  const m = usMask();
  // The moon's major and minor periods for each column of the lattice (they shift about four
  // minutes a degree of longitude; coarser steps leave north-south stripes on the map).
  const moon = Array.from({ length: NW }, (_, i) =>
    solunar(38, LAT.W + i * LAT.step, new Date(d0)),
  );

  const n = NW * NH;
  const deer = Array.from({ length: 3 }, () => new Float32Array(n).fill(NaN));
  const deerWhen = Array.from({ length: 3 }, () => new Float64Array(n));
  const fish = SPECIES.map(() =>
    Array.from({ length: 3 }, () => new Float32Array(n).fill(NaN)),
  );
  const fishWhen = SPECIES.map(() =>
    Array.from({ length: 3 }, () => new Float64Array(n)),
  );

  for (let idx = 0; idx < n; idx++) {
    if (!m[idx]) continue;
    const lat = LAT.N - Math.floor(idx / NW) * LAT.step;
    const lon = LAT.W + (idx % NW) * LAT.step;
    // Water runs near the mean air temperature of the five days around (°F).
    let water = 0;
    for (const f of allT) water += K2F(f[idx]);
    water /= allT.length;
    const mo = moon[idx % NW];
    for (let d = 0; d < 3; d++) {
      const noon = d0 + d * DAY + 12 * 3600_000 - (lon / 15) * 3600_000;
      const sun = sunTimes(new Date(noon), lat, lon);
      if (!sun.sunrise || !sun.sunset) continue;
      const rut = rutBoost(new Date(d0 + d * DAY), cfg.rut);
      for (const [t, rise] of [
        [sun.sunrise.getTime() + 30 * 60_000, true],
        [sun.sunset.getTime() - 30 * 60_000, false],
      ] as const) {
        if (t < start || t > end) continue;
        const T = K2F(at(series.t, start, t, idx));
        const before =
          (K2F(at(allT, t0All, t - DAY, idx)) +
            K2F(at(allT, t0All, t - 2 * DAY, idx))) /
          2;
        const dp3 =
          (at(series.p, start, t, idx) -
            at(series.p, start, Math.max(start, t - H3), idx)) /
          100;
        const wind =
          Math.hypot(at(series.u, start, t, idx), at(series.v, start, t, idx)) *
          2.236936;
        const rain = Math.max(0, at(series.r, start, t, idx) * 3600);
        const cloud = Math.max(0, Math.min(100, at(series.c, start, t, idx)));
        const fromRise = rise ? 0.5 : 12;
        const fromSet = rise ? 12 : -0.5;
        const dv = deerScore(
          {
            fromRise,
            fromSet,
            colder: before - T,
            dp3,
            windMph: wind,
            rainMm: rain,
          },
          rut,
          deerW,
        );
        if (!(dv <= deer[d][idx])) {
          deer[d][idx] = dv;
          deerWhen[d][idx] = t;
        }
        const major = mo.near(mo.majors, t);
        const minor = mo.near(mo.minors, t);
        SPECIES.forEach((sp, si) => {
          const fv = fishScore(
            {
              fromRise,
              fromSet,
              major,
              minor,
              dp3,
              windMph: wind,
              cloud,
              water,
            },
            sp,
            fishW,
          );
          if (!(fv <= fish[si][d][idx])) {
            fish[si][d][idx] = fv;
            fishWhen[si][d][idx] = t;
          }
        });
      }
    }
  }

  const iso = new Date(now).toISOString();
  const day = (d: number) => new Date(d0 + d * DAY).toISOString().slice(0, 10);
  const build = (
    vals: Float32Array[],
    when: Float64Array[],
    levels: number[],
  ): OutDay[] =>
    vals.map((v, d) => ({
      date: day(d),
      areas: outlookAreas(v, levels),
      spots: topSpots(v, when[d], levels[1]),
      typical: median(v),
    }));
  const cycle = cycleId(newest);
  return [
    {
      kind: "deer",
      cycle,
      at: iso,
      levels: OUTMAP.deer,
      days: build(deer, deerWhen, OUTMAP.deer),
    },
    ...SPECIES.map((sp, si): OutMap => ({
      kind: "fish",
      species: sp.id,
      cycle,
      at: iso,
      levels: OUTMAP.fish,
      days: build(fish[si], fishWhen[si], OUTMAP.fish),
    })),
  ];
}

const rowId = (kind: "deer" | "fish", sp?: SpeciesId) =>
  kind === "deer" ? "outmap:deer" : `outmap:fish:${sp ?? "bass"}`;
/** The row that carries the refresh claim for all six maps. */
const LEAD = "outmap:deer";

type Row = { cycle: string; data: OutMap; checked_at: string };

/** Checked against the newest GFS run at most this often. */
const RECHECK_MS = 20 * 60_000;
/** A refresh claim older than this has died and can be taken over. */
const CLAIM_MS = 3 * 60_000;
/** A warm server trusts its own copy this long before looking at the table again. */
const MEMO_MS = 5 * 60_000;
const memo = new Map<string, { data: OutMap; at: number }>();

const today = () => new Date(firstDay()).toISOString().slice(0, 10);

/** The newest GFS run that reaches the end of Day 3. */
async function newestRun() {
  const end = firstDay() + 3 * DAY + 3 * 3600_000;
  const c = await runFor(Math.min(Date.now(), end), end);
  return c === null ? null : cycleId(c);
}

/** Computes and stores every map; returns them. */
export async function refreshOutdoorMaps() {
  const maps = await computeOutdoorMaps();
  const now = new Date().toISOString();
  for (const m of maps)
    memo.set(rowId(m.kind, m.species), { data: m, at: Date.now() });
  // A storage failure costs the next visitor a recompute, never this visitor their map.
  try {
    const { error } = await supabaseAdmin()
      .from("engine_maps")
      .upsert(
        maps.map((m) => ({
          id: rowId(m.kind, m.species),
          cycle: m.cycle,
          data: m,
          computed_at: now,
          checked_at: now,
          wanted_at: now,
          refreshing_at: null,
        })),
      );
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("engine_maps outdoor upsert", e);
  }
  return maps;
}

async function claim() {
  const stale = new Date(Date.now() - CLAIM_MS).toISOString();
  const { data } = await supabaseAdmin()
    .from("engine_maps")
    .update({ refreshing_at: new Date().toISOString() })
    .eq("id", LEAD)
    .or(`refreshing_at.is.null,refreshing_at.lt.${stale}`)
    .select("id");
  return Boolean(data?.length);
}

/**
 * One stored map for a visitor, and `later`: the refresh to run after the response when a
 * newer GFS run is out. With nothing stored yet the visitor waits for the computation; once
 * Day 1 has moved on, the stored days that have passed are dropped until the refresh lands.
 */
export async function storedOutdoor(
  kind: "deer" | "fish",
  sp?: SpeciesId,
): Promise<{ map: OutMap; later: (() => Promise<unknown>) | null }> {
  const id = rowId(kind, sp);
  const first = today();
  const fresh = (m: OutMap) => ({
    ...m,
    days: m.days.filter((d) => d.date >= first),
  });
  const mine = memo.get(id);
  if (
    mine &&
    Date.now() - mine.at < MEMO_MS &&
    mine.data.days[0]?.date === first
  )
    return { map: mine.data, later: null };
  const { data } = await supabaseAdmin()
    .from("engine_maps")
    .select("cycle, data, checked_at")
    .eq("id", id)
    .maybeSingle();
  const row = data as Row | null;
  if (!row || !row.data.days.some((d) => d.date >= first)) {
    const maps = await refreshOutdoorMaps();
    return {
      map: maps.find((m) => rowId(m.kind, m.species) === id)!,
      later: null,
    };
  }
  memo.set(id, { data: row.data, at: Date.now() });
  const behind =
    row.data.days[0].date < first ||
    (Date.now() - Date.parse(row.checked_at) > RECHECK_MS &&
      ((await newestRun().catch(() => null)) ?? "") > row.cycle);
  if (!behind) return { map: row.data, later: null };
  return {
    map: fresh(row.data),
    later: async () => {
      if (await claim()) await refreshOutdoorMaps();
    },
  };
}

/** The scheduled refresh (hourly): recomputes once a newer run is out or Day 1 moves on. */
export async function refreshOutdoorIfStale() {
  const { data } = await supabaseAdmin()
    .from("engine_maps")
    .select("cycle, data->days->0->>date")
    .eq("id", LEAD)
    .maybeSingle();
  const row = data as { cycle: string; date: string } | null;
  const newest = await newestRun();
  const now = new Date().toISOString();
  if (row && row.date === today() && (!newest || newest <= row.cycle)) {
    await supabaseAdmin()
      .from("engine_maps")
      .update({ checked_at: now })
      .like("id", "outmap:%");
    return { refreshed: false, cycle: row.cycle };
  }
  if (row && !(await claim())) return { refreshed: false, busy: true };
  const maps = await refreshOutdoorMaps();
  return { refreshed: true, cycle: maps[0].cycle };
}
