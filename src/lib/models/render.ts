import "server-only";
import { deflateSync } from "node:zlib";
import { pick, type Colors } from "@/lib/colors/pick";
import {
  fill,
  hex,
  loadFieldFrom,
  paintIndex,
  pngFile,
  pngRows,
  readRecord,
  type Get,
} from "./core";
import type { Field } from "./grib2";
import { GFS, HRRR, REFS, SCALES, type Param } from "./params";

export { cityValues, sampleAt } from "./core";

/**
 * Model runs on the server: which runs exist, and REFS frames (NOAA serves REFS only from
 * NOMADS, which a browser can't read). HRRR and GFS frames are drawn in the viewer's own
 * worker straight from NOAA's open data on AWS (lib/models/core.ts, owner 2026-11-02), so they
 * cost the server nothing. The engines read their fields through `record` here as well.
 */
export type ModelId = "hrrr" | "gfs" | "refs";
type Def = {
  label: string;
  res: string;
  params: Param[];
  cycles: number[];
  hours: number[];
  /** The file for a forecast hour (`file`: an ensemble's product file, see Param.file). */
  url: (ymd: string, hh: string, fh: number, file?: string) => string;
  /**
   * The file's address as a template ({d} date, {h} cycle hour, {f2}/{f3} forecast hour), for
   * models a browser can read itself (NOAA's open data on AWS allows it); those frames are
   * drawn in the viewer, never on the server.
   */
  tpl?: string;
  /** Where to look when `url` has nothing (REFS: NOAA's parallel feed, before it goes live). */
  alt?: (ymd: string, hh: string, fh: number, file?: string) => string;
};
const REFS_URL =
  (env: string) =>
  (d: string, h: string, f: number, file = "prob") =>
    `https://nomads.ncep.noaa.gov/pub/data/nccf/com/refs/${env}/refs.${d}/${h}/ensprod/refs.t${h}z.${file}.f${String(f).padStart(2, "0")}.conus.grib2`;

export const MODELS: Record<ModelId, Def> = {
  hrrr: {
    label: "HRRR",
    res: "3 km · hourly",
    params: HRRR,
    cycles: Array.from({ length: 24 }, (_, i) => i),
    hours: Array.from({ length: 19 }, (_, i) => i),
    tpl: "https://noaa-hrrr-bdp-pds.s3.amazonaws.com/hrrr.{d}/conus/hrrr.t{h}z.wrfsfcf{f2}.grib2",
    url: (d, h, f) => fill(MODELS.hrrr.tpl!, d, h, f),
  },
  gfs: {
    label: "GFS",
    res: "25 km · 6-hourly",
    params: GFS,
    cycles: [0, 6, 12, 18],
    hours: Array.from({ length: 21 }, (_, i) => i * 6),
    tpl: "https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{d}/{h}/atmos/gfs.t{h}z.pgrb2.0p25.f{f3}",
    url: (d, h, f) => fill(MODELS.gfs.tpl!, d, h, f),
  },
  // HREF retires when REFS goes operational (NWS SCN 26-47/26-48, Fix list 2026-10-30 #8).
  refs: {
    label: "REFS Ensemble",
    res: "3 km · 14 members",
    params: REFS,
    cycles: [0, 6, 12, 18],
    hours: Array.from({ length: 24 }, (_, i) => i * 2 + 1),
    url: REFS_URL("prod"),
    alt: REFS_URL("para"),
  },
};

/** Map regions (west, south, east, north), VIP's set. */
export const REGIONS: Record<string, { label: string; b: number[] }> = {
  conus: { label: "CONUS", b: [-125, 23, -66, 50] },
  west: { label: "West", b: [-125, 31, -102, 49.5] },
  nplains: { label: "N. Plains", b: [-108, 39, -89, 49.5] },
  splains: { label: "S. Plains", b: [-107, 25.5, -89, 40.5] },
  midwest: { label: "Midwest", b: [-98, 36, -80, 49] },
  northeast: { label: "Northeast", b: [-84, 37, -66.5, 47.8] },
  southeast: { label: "Southeast", b: [-95, 24, -75, 37.5] },
};

/**
 * The box a region's frames are painted over. HRRR and REFS fill their own domain; GFS is
 * global, so its frames reach well past the view and no rectangle edge shows.
 */
export function frameOf(model: ModelId, b: number[]) {
  if (model !== "gfs") return b;
  return [
    Math.max(-180, b[0] - 14),
    Math.max(-70, b[1] - 10),
    Math.min(180, b[2] + 14),
    Math.min(72, b[3] + 8),
  ];
}

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
/** The server's fetch for GRIB reads: its user agent, and an .idx kept an hour. */
const serverGet: Get = (url, init) =>
  fetch(url, {
    ...init,
    headers: { ...UA, ...(init?.headers as Record<string, string>) },
    ...(url.endsWith(".idx") ? { next: { revalidate: 3600 } } : {}),
  });
/** One GRIB record, found by its .idx line and fetched by byte range. */
export const record = (url: string, match: string, also?: string) =>
  readRecord(serverGet, url, match, also);
const pad = (n: number) => String(n).padStart(2, "0");
const ymdh = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`;

export async function exists(url: string) {
  try {
    const r = await fetch(`${url}.idx`, {
      method: "HEAD",
      headers: UA,
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Is this cycle's last forecast hour out (on the main feed or the fallback)? */
async function complete(model: ModelId, id: string) {
  const m = MODELS[model];
  const last = m.hours[m.hours.length - 1];
  const [d, h] = [id.slice(0, 8), id.slice(8)];
  return (
    (await exists(m.url(d, h, last))) ||
    (!!m.alt && (await exists(m.alt(d, h, last))))
  );
}

/** The model's cycle ids within 36 hours before `from`, newest first. */
function candidates(model: ModelId, from: number) {
  const m = MODELS[model];
  const t = new Date(from);
  t.setUTCMinutes(0, 0, 0);
  const out: string[] = [];
  for (let back = 0; back < 36; back++) {
    const c = new Date(t.getTime() - back * 3600_000);
    if (m.cycles.includes(c.getUTCHours())) out.push(ymdh(c));
  }
  return out;
}

/** The newest cycle whose last forecast hour has been published ("YYYYMMDDHH"). */
export async function latestCycle(model: ModelId, from = Date.now()) {
  for (const id of candidates(model, from))
    if (await complete(model, id)) return id;
  return null;
}

/**
 * Newest few complete cycles, newest first (the run list). Cycles are checked four at a time
 * rather than one by one, so the list comes back in a couple of round trips to NOAA.
 */
export async function recentCycles(model: ModelId, n = 4) {
  const out: string[] = [];
  const list = candidates(model, Date.now());
  for (let k = 0; k < list.length && out.length < n; k += 4) {
    const batch = list.slice(k, k + 4);
    const ok = await Promise.all(batch.map((id) => complete(model, id)));
    batch.forEach((id, j) => ok[j] && out.length < n && out.push(id));
  }
  return out;
}

/**
 * The last few fields read, by model, run, hour and parameter: a frame, its city values and a
 * zoomed-in render arrive together, and one download from NOAA serves them all. Runs never
 * change once published, so there is nothing to go stale.
 */
const recent = new Map<string, Promise<Field>>();

/** The field a parameter plots, converted to its display unit. */
export function fieldFor(
  model: ModelId,
  cycle: string,
  fh: number,
  p: Param,
): Promise<Field> {
  const k = `${model}|${cycle}|${fh}|${p.key}`;
  let f = recent.get(k);
  if (!f) {
    const m = MODELS[model];
    const at = [cycle.slice(0, 8), cycle.slice(8), fh, p.file] as const;
    f = loadFieldFrom(
      serverGet,
      [m.url(...at), ...(m.alt ? [m.alt(...at)] : [])],
      p,
    );
    recent.set(k, f);
    f.catch(() => recent.delete(k));
    while (recent.size > 6) recent.delete(recent.keys().next().value!);
  }
  return f;
}

/** One color per contour level: the scale's stops spread across the field's levels (the
 * shading glides between them). Listed scales (radar) keep their colors in order. */
export function rampColors(p: Param, colors: Colors) {
  const stops = (SCALES[p.cmap] ?? SCALES.prob).map((c, i) =>
    pick(colors, `model:${p.cmap}:${i}`, c),
  );
  const n = p.levels.length;
  const listed = p.cmap === "refl";
  return Array.from({ length: n }, (_, b) => {
    const f = n > 1 ? b / (n - 1) : 0;
    if (listed) return stops[Math.round(f * (stops.length - 1))];
    const x = f * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(x));
    const [r1, g1, b1] = hex(stops[k]);
    const [r2, g2, b2] = hex(stops[k + 1]);
    const t = x - k;
    const m = (a: number, c: number) => Math.round(a + (c - a) * t);
    return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  });
}

/** Paint a field over a region as a transparent Web-Mercator PNG (`width` px across). */
export function paint(...args: Parameters<typeof paintIndex>) {
  const { idx, pal, w, h } = paintIndex(...args);
  const png = pngFile(w, h, pal, deflateSync(pngRows(w, h, idx), { level: 6 }));
  return { png, w, h };
}

export const paramOf = (model: ModelId, key: string) =>
  MODELS[model].params.find((p) => p.key === key);
