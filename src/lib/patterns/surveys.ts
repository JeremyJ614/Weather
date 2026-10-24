import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";

/**
 * Tornadoes the Weather Service has surveyed (NWS Damage Assessment Toolkit), by convective
 * day. SPC's report files are preliminary: a tornado confirmed only by a later damage survey
 * never reaches them, so Weather Patterns counts whichever is higher and names the
 * strongest rating.
 */
const DAT =
  "https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/MapServer/1/query";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const PAGE = 2000;
const DAY = 86400_000;

export type Survey = {
  /** Surveyed tornadoes that day. */
  n: number;
  /** Strongest rating ("EF2"), and the town it was nearest. */
  top: string;
  where: string;
  states: Record<string, number>;
};

const RANK = ["EFU", "EF0", "EF1", "EF2", "EF3", "EF4", "EF5"];
/** "EF2", "ef2", "F2" → 3; anything unrated → 0. */
export const efRank = (ef: unknown) =>
  Math.max(
    0,
    RANK.indexOf(
      String(ef ?? "")
        .toUpperCase()
        .replace(/^F/, "EF"),
    ),
  );

/** The convective day (12 UTC to 12 UTC, SPC's) an instant falls in. */
export const convDay = (ms: number) =>
  new Date(ms - 12 * 3600_000).toISOString().slice(0, 10);

const stamp = (ms: number) =>
  `timestamp '${new Date(ms).toISOString().slice(0, 19).replace("T", " ")}'`;

let places: ReturnType<typeof parsePlaces> | null = null;

type Row = {
  attributes: { efscale?: string; starttime?: number };
  geometry?: { paths?: number[][][] };
};

/** Group survey rows by convective day. Exported for the tests. */
export function bySurveyDay(rows: Row[], from: string, to: string) {
  places ??= parsePlaces(PLACES);
  const out = new Map<string, Survey>();
  for (const r of rows) {
    const t = Number(r.attributes.starttime);
    if (!Number.isFinite(t)) continue;
    const day = convDay(t);
    if (day < from || day > to) continue;
    const [lon, lat] = r.geometry?.paths?.[0]?.[0] ?? [];
    const near =
      Number.isFinite(lat) && Number.isFinite(lon)
        ? nearestPlace(places, lat, lon, 500)
        : null;
    const st = near?.hit.st ?? "";
    const ef = RANK[efRank(r.attributes.efscale)];
    const s = out.get(day) ?? { n: 0, top: "EFU", where: "", states: {} };
    s.n++;
    if (st) s.states[st] = (s.states[st] ?? 0) + 1;
    const better = efRank(ef) > efRank(s.top);
    if (better) s.top = ef;
    if (near && (better || !s.where)) s.where = `${near.hit.name}, ${st}`;
    out.set(day, s);
  }
  return out;
}

/** Surveyed tornadoes for convective days `from`…`to` (YYYY-MM-DD), empty if DAT is down. */
export async function surveysBetween(
  from: string,
  to: string,
): Promise<Map<string, Survey>> {
  const t0 = Date.parse(`${from}T12:00:00Z`);
  const t1 = Date.parse(`${to}T12:00:00Z`) + DAY;
  // `stormdate` is the office's local date: pad a day each side, then keep by start time.
  const where = `stormdate >= ${stamp(t0 - DAY)} AND stormdate < ${stamp(t1 + DAY)}`;
  const rows: Row[] = [];
  try {
    for (let offset = 0; offset < 20 * PAGE; offset += PAGE) {
      const q = new URLSearchParams({
        where,
        outFields: "efscale,starttime",
        returnGeometry: "true",
        geometryPrecision: "3",
        outSR: "4326",
        resultOffset: String(offset),
        resultRecordCount: String(PAGE),
        f: "json",
      });
      const r = await fetch(`${DAT}?${q}`, {
        headers: UA,
        // Surveys keep arriving for a few weeks after a day; older days settle.
        next: { revalidate: Date.now() - t1 > 45 * DAY ? 2592000 : 21600 },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) break;
      const j = (await r.json()) as { features?: Row[]; error?: unknown };
      if (j.error || !j.features) break;
      rows.push(...j.features);
      if (j.features.length < PAGE) break;
    }
  } catch {
    // The survey service is optional: SPC's reports still stand on their own.
  }
  return bySurveyDay(rows, from, to);
}
