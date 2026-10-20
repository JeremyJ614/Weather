/**
 * Storms outside NHC's basins, from the Joint Typhoon Warning Center: its RSS feed names
 * every warning in force, and each warning's JMV 3.0 file (.tcw) carries the position,
 * winds, forecast track, past track and the warning text. NHC stays the source for the
 * Atlantic and the Eastern and Central Pacific, so JTWC's copies of those are left out.
 */
import { mph } from "./style";

export const JTWC = "https://www.metoc.navy.mil/jtwc";
export const WORLD_BASINS = {
  wp: "West Pacific",
  io: "North Indian Ocean",
  sh: "Southern Hemisphere",
} as const;
export type WorldBasin = keyof typeof WORLD_BASINS;

export type WorldPoint = { tau: number; lat: number; lon: number; kt: number };
export type WorldStorm = {
  /** JTWC product code, e.g. "wp2926". */
  code: string;
  basin: WorldBasin;
  /** JTWC's number, e.g. "29W". */
  num: string;
  name: string;
  /** "Super Typhoon Champi". */
  title: string;
  kt: number;
  mph: number;
  gustKt: number | null;
  pressure: number | null;
  lat: number;
  lon: number;
  dir: number | null;
  speedMph: number | null;
  warning: number | null;
  /** When the warning position is valid (ISO). */
  valid: string | null;
  forecast: WorldPoint[];
  /** Past positions, oldest first. */
  past: { lat: number; lon: number; kt: number }[];
  remarks: string;
  text: string;
  links: { text: string; graphic: string; prog: string };
};

/**
 * The warning codes (".tcw" files) in JTWC's RSS feed, outside NHC's basins. Invests
 * (numbers 90 to 99) carry formation alerts, not warnings, and are left out.
 */
export function warningCodes(rss: string): string[] {
  const codes = new Set<string>();
  for (const m of rss.matchAll(/products\/((?:wp|io|sh)(\d{2})\d{2})\.tcw/g))
    if (Number(m[2]) < 90) codes.add(m[1]);
  return [...codes].sort();
}

/** "154N" → 15.4, "1367E" → 136.7, "95W" → -9.5. */
const deg = (v: string, h: string) => {
  const x = Number(v) / 10;
  return h === "S" || h === "W" ? -x : x;
};
const title = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
const dtgIso = (d: string) =>
  /^\d{10}$/.test(d)
    ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(8, 10)}:00:00Z`
    : null;

/** One JMV 3.0 warning file; null when it isn't one. */
export function parseTcw(raw: string, code: string): WorldStorm | null {
  const text = raw.replace(/\r/g, "");
  const lines = text.split("\n");
  const head = lines
    .map((l) =>
      /^(\d{10})\s+(\d{2}[A-Z])\s+(\S+)\s+(\d{3})\s+\d+\s+(\d{3})\s+(\d{2,3})/.exec(
        l,
      ),
    )
    .find(Boolean);
  const forecast: WorldPoint[] = [];
  for (const l of lines) {
    const m = /^T(\d{3}) (\d+)([NS]) (\d+)([EW]) (\d{3})/.exec(l);
    if (m)
      forecast.push({
        tau: Number(m[1]),
        lat: deg(m[2], m[3]),
        lon: deg(m[4], m[5]),
        kt: Number(m[6]),
      });
  }
  if (!head || !forecast.length) return null;
  const subj = /SUBJ:\s+(.+?)\s+\d{2}[A-Z]\s+\(([^)]+)\)/.exec(text);
  const kind = subj ? title(subj[1]) : "Tropical Cyclone";
  const name = subj ? title(subj[2]) : title(head[3]);
  const past: WorldStorm["past"] = [];
  for (const l of lines) {
    const m = /^\d{4}\d{6}\s+(\d+)([NS])(\d+)([EW])\s+(\d+)\s*$/.exec(l);
    if (m)
      past.push({
        lat: deg(m[1], m[2]),
        lon: deg(m[3], m[4]),
        kt: Number(m[5]),
      });
  }
  const amp = text.indexOf("\nAMP");
  const body = (amp >= 0 ? text.slice(amp + 4) : text)
    .split("\n")
    .filter((l) => !/^\d{4}\d{6}\s+\d+[NS]\d+[EW]\s+\d+\s*$/.test(l))
    .join("\n")
    .trim();
  const remarks = /REMARKS:\s*([\s\S]*?)\/\//.exec(text)?.[1] ?? "";
  const gust = /MAX SUSTAINED WINDS - \d+ KT, GUSTS (\d+) KT/.exec(text);
  const mb = /MINIMUM CENTRAL PRESSURE AT \d+Z IS (\d+) MB/.exec(text);
  const now = forecast[0];
  const speedKt = Number(head[6]);
  return {
    code,
    basin: code.slice(0, 2) as WorldBasin,
    num: head[2],
    name,
    title: `${kind} ${name}`,
    kt: now.kt,
    mph: mph(now.kt),
    gustKt: gust ? Number(gust[1]) : null,
    pressure: mb ? Number(mb[1]) : null,
    lat: now.lat,
    lon: now.lon,
    dir: Number(head[5]),
    speedMph: Number.isFinite(speedKt) ? mph(speedKt) : null,
    warning: Number(head[4]) || null,
    valid: dtgIso(head[1]),
    forecast,
    past,
    remarks: remarks.replace(/\s+/g, " ").trim(),
    text: body,
    links: {
      text: `${JTWC}/products/${code}web.txt`,
      graphic: `${JTWC}/products/${code}.gif`,
      prog: `${JTWC}/products/${code}prog.txt`,
    },
  };
}

/**
 * Longitudes made continuous along a track, so one crossing the date line is drawn across
 * it rather than all the way round the world.
 */
export function unwrap(lons: number[]): number[] {
  const out: number[] = [];
  for (const x of lons) {
    if (!out.length) {
      out.push(x);
      continue;
    }
    let v = x;
    const prev = out[out.length - 1];
    while (v - prev > 180) v -= 360;
    while (prev - v > 180) v += 360;
    out.push(v);
  }
  return out;
}
