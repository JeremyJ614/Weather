import "server-only";
import { DAT_TORNADOES } from "@/lib/dat/tornado";
import { inside, type CountyData, type Tor } from "./db";

/**
 * Real paths for the Tornado Database (owner's fix, 2026-11-26): NOAA's yearly record keeps only
 * touchdown and lift-off, so a county page reads the NWS Damage Assessment Toolkit's surveyed
 * tracks for the county and gives each recorded tornado its true, curving path. Surveys after
 * the record's last year are added as preliminary tornadoes, so a page runs to this week.
 */
const DAT =
  "https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/FeatureServer/1/query";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };

type Survey = {
  start: number;
  mag: number;
  miles: number;
  yards: number;
  hurt: number;
  deaths: number;
  parts: number[][];
};

const OFFSET: Record<string, number> = {
  EST: -5,
  EDT: -4,
  CST: -6,
  CDT: -5,
  MST: -7,
  MDT: -6,
  PST: -8,
  PDT: -7,
  AKST: -9,
  AKDT: -8,
  HST: -10,
  AST: -4,
};
const ZONE: Record<string, string> = {
  E: "America/New_York",
  C: "America/Chicago",
  M: "America/Denver",
  P: "America/Los_Angeles",
  AK: "America/Anchorage",
  H: "Pacific/Honolulu",
  A: "America/Puerto_Rico",
};
// Each state's main zone, for a county with no timed tornado to learn it from.
const STATE_ZONE: Record<string, string> = Object.fromEntries(
  [
    ["E", "ME NH VT MA RI CT NY NJ PA DE MD DC VA WV NC SC GA FL OH MI IN KY"],
    ["C", "AL MS TN LA AR MO IA MN WI IL OK KS NE SD ND TX"],
    ["M", "MT ID WY CO NM UT AZ"],
    ["P", "WA OR CA NV"],
    ["AK", "AK"],
    ["H", "HI"],
    ["A", "PR VI"],
  ].flatMap(([z, sts]) => sts.split(" ").map((st) => [st, z])),
);

/** A recorded tornado's touchdown in UTC milliseconds (noon local when no time was kept). */
function utcOf(t: Tor) {
  const [y, m, d] = t.when.slice(0, 10).split("-").map(Number);
  const [hh, mm] =
    t.when.length > 10 ? t.when.slice(11, 16).split(":").map(Number) : [12, 0];
  return Date.UTC(y, m - 1, d, hh, mm) - (OFFSET[t.zone] ?? -6) * 3600000;
}

/** Kilometres between two lon,lat points (flat Earth at this scale). */
function km(ax: number, ay: number, bx: number, by: number) {
  const k = Math.cos((((ay + by) / 2) * Math.PI) / 180);
  return Math.hypot((ax - bx) * k, ay - by) * 111.2;
}
/** Kilometres from a point to a segment. */
function toSeg(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const k = Math.cos((py * Math.PI) / 180);
  const [ux, uy, vx, vy] = [(bx - ax) * k, by - ay, (px - ax) * k, py - ay];
  const l = ux * ux + uy * uy;
  const f = l ? Math.max(0, Math.min(1, (vx * ux + vy * uy) / l)) : 0;
  return Math.hypot(vx - f * ux, vy - f * uy) * 111.2;
}
function toLine(px: number, py: number, parts: number[][]) {
  let best = Infinity;
  for (const p of parts)
    for (let i = 0; i + 3 < p.length; i += 2)
      best = Math.min(best, toSeg(px, py, p[i], p[i + 1], p[i + 2], p[i + 3]));
  if (best === Infinity && parts[0]?.length >= 2)
    best = km(px, py, parts[0][0], parts[0][1]);
  return best;
}

/** Every surveyed tornado track crossing a box (lon/lat), oldest first. */
async function surveysIn(box: number[]): Promise<Survey[]> {
  const out: Survey[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < 10000; offset += 2000) {
    const q = new URLSearchParams({
      where: DAT_TORNADOES,
      geometry: box.map((v) => v.toFixed(4)).join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields:
        "efscale,efnum,starttime,stormdate,length,width,injuries,fatalities",
      returnGeometry: "true",
      // About 30 m of detail: true at the zoom of the strongest tornado's map.
      maxAllowableOffset: "0.0003",
      geometryPrecision: "4",
      outSR: "4326",
      orderByFields: "starttime",
      resultOffset: String(offset),
      resultRecordCount: "2000",
      f: "geojson",
    });
    const r = await fetch(`${DAT}?${q}`, {
      headers: UA,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`DAT ${r.status}`);
    const j = (await r.json()) as {
      features?: {
        geometry: { type: string; coordinates: unknown } | null;
        properties: Record<string, unknown>;
      }[];
    };
    const f = j.features ?? [];
    for (const x of f) {
      const g = x.geometry;
      if (!g) continue;
      const lines = (
        g.type === "LineString"
          ? [g.coordinates]
          : g.type === "MultiLineString"
            ? g.coordinates
            : []
      ) as number[][][];
      const parts = lines
        .map((l) => l.flatMap(([lon, lat]) => [lon, lat]))
        .filter((p) => p.length >= 2);
      if (!parts.length) continue;
      const key = parts.map((p) => p.join(",")).join(";");
      if (seen.has(key)) continue;
      seen.add(key);
      const p = x.properties;
      const start = Number(p.starttime) || Number(p.stormdate);
      if (!start) continue;
      const n = Number(p.efnum);
      const digit = String(p.efscale ?? "").match(/\d/)?.[0];
      out.push({
        start,
        mag:
          Number.isInteger(n) && n >= 0 && n <= 5
            ? n
            : digit
              ? Number(digit)
              : -1,
        miles: Math.max(0, Number(p.length) || 0),
        // DAT writes -99 for an unknown width.
        yards: Math.max(0, Math.round(Number(p.width) || 0)),
        hurt: Math.max(0, Number(p.injuries) || 0),
        deaths: Math.max(0, Number(p.fatalities) || 0),
        parts,
      });
    }
    if (f.length < 2000) break;
  }
  return out;
}

/** Miles of a path inside the county outline (each step checked at its middle). */
function milesInside(parts: number[][], rings: number[][]) {
  let mi = 0;
  for (const p of parts)
    for (let i = 0; i + 3 < p.length; i += 2) {
      const [ax, ay, bx, by] = [p[i], p[i + 1], p[i + 2], p[i + 3]];
      const len = km(ax, ay, bx, by) / 1.609;
      const steps = Math.max(1, Math.ceil(len / 0.05));
      for (let s = 0; s < steps; s++) {
        const f = (s + 0.5) / steps;
        if (inside(rings, ax + (bx - ax) * f, ay + (by - ay) * f))
          mi += len / steps;
      }
    }
  return mi;
}

/** Local wall time and zone abbreviation, as the record writes them. */
function local(ms: number, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return {
    when: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
    zone: /^[A-Z]{3,4}$/.test(parts.timeZoneName) ? parts.timeZoneName : "",
  };
}

/** The county page's tornadoes with surveyed paths, plus surveys newer than the record. */
export async function withSurveys(d: CountyData): Promise<CountyData> {
  const [x0, y0, x1, y1] = d.box;
  const px = (x1 - x0) * 0.1,
    py = (y1 - y0) * 0.1;
  let all: Survey[];
  try {
    all = await surveysIn([x0 - px, y0 - py, x1 + px, y1 + py]);
  } catch {
    return { ...d, surveys: { live: false } };
  }
  const used = new Set<number>();
  const tors = d.tors.map((t) => ({ ...t }));
  // Pair each recorded tornado with the survey (or surveys, when one office's survey ends at
  // its border and the next picks up) that starts on its line within hours of it.
  const pairs: { t: number; s: number; near: number; score: number }[] = [];
  tors.forEach((t, ti) => {
    if (t.when < "2004") return;
    const at = utcOf(t);
    const [ay, ax] = t.a,
      [by, bx] = t.b;
    all.forEach((s, si) => {
      let dt = (s.start - at) / 3600000;
      if (dt < -27 || dt > 30) return;
      const [sx, sy] = s.parts[0];
      const near = Math.min(
        toSeg(sx, sy, ax, ay, bx, by),
        toLine(ax, ay, s.parts),
      );
      if (near > 5) return;
      // A survey dated a day off the record (one of them is wrong) still counts when it starts
      // on the very spot at the same clock time.
      if (near < 1.5 && Math.abs(Math.abs(dt) - 24) <= 1.5) dt = 1;
      if (dt < -3 || dt > 6) return;
      pairs.push({ t: ti, s: si, near, score: near + Math.abs(dt) });
    });
  });
  pairs.sort((a, b) => a.score - b.score);
  const parts = new Map<number, number[][]>();
  for (const { t, s, near } of pairs) {
    if (used.has(s)) continue;
    // A second survey joins a tornado only when it starts right on its line (an office border).
    if (parts.has(t) && near > 2) continue;
    used.add(s);
    parts.set(t, [...(parts.get(t) ?? []), ...all[s].parts]);
  }
  for (const [ti, p] of parts) tors[ti].path = p;
  // Surveys after the record's last year: new tornadoes, marked preliminary.
  const after = Date.UTC(Number(d.through) + 1, 0, 1);
  const count = new Map<string, number>();
  for (const t of tors)
    if (t.zone) count.set(t.zone, (count.get(t.zone) ?? 0) + 1);
  const abbr = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const tz =
    d.county.st === "AZ"
      ? "America/Phoenix"
      : (ZONE[abbr.replace(/[SD]T$/, "")] ??
        ZONE[STATE_ZONE[d.county.st] ?? "C"]);
  all.forEach((s, si) => {
    if (used.has(si) || s.start < after - 12 * 3600000) return;
    const inn = milesInside(s.parts, d.outline);
    const [sx, sy] = s.parts[0];
    if (inn <= 0 && !inside(d.outline, sx, sy)) return;
    const last = s.parts[s.parts.length - 1];
    const { when, zone } = local(s.start, tz);
    if (when.slice(0, 4) <= d.through) return;
    const miles = Math.round(Math.max(s.miles, inn) * 100) / 100;
    const inc: Record<string, number> = {
      [d.county.fips]: Math.round(inn * 100) / 100,
    };
    // The rest of the path lies outside the county (its neighbours aren't named in a survey).
    if (miles - inn > 0.05) inc.out = Math.round((miles - inn) * 100) / 100;
    tors.push({
      when,
      zone,
      mag: s.mag,
      ef: true,
      miles,
      yards: s.yards,
      hurt: s.hurt,
      deaths: s.deaths,
      a: [sy, sx],
      b: [last[last.length - 1], last[last.length - 2]],
      inc,
      path: s.parts,
      prelim: true,
    });
  });
  tors.sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0));
  return {
    ...d,
    tors,
    surveys: { live: true },
  };
}
