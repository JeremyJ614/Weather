import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { STATES, nearestPlace, parsePlaces } from "@/lib/geo/search";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { groupSurveys, type AutoDay, type Survey } from "./group";

/**
 * The Tornado Archive's automatic days: every tornado the NWS surveys in the Damage
 * Assessment Toolkit, grouped into events and stored as small index rows. Surveys are often
 * published or revised weeks after the storm, so each run rebuilds the last 60 days.
 */
const DAT =
  "https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/FeatureServer/1/query";
const PAGE = 2000;
/** The backfill walks back to here, a month per call. */
export const BACKFILL_FROM = "2023-01";

let rows: ReturnType<typeof parsePlaces> | null = null;
const EF = (v: unknown) => {
  const s = String(v ?? "")
    .toUpperCase()
    .replace(/^F/, "EF")
    .trim();
  return /^EF[0-5]$/.test(s) ? s : "EFU";
};
const stamp = (d: Date) =>
  `timestamp '${d.toISOString().slice(0, 19).replace("T", " ")}'`;

/** Every surveyed track that starts in [from, to). */
export async function fetchSurveys(from: Date, to: Date): Promise<Survey[]> {
  const out: Survey[] = [];
  // stormdate is the storm's date; a day either side catches storms across UTC midnight.
  const where = `stormdate >= ${stamp(new Date(from.getTime() - 864e5))} AND stormdate < ${stamp(new Date(to.getTime() + 864e5))}`;
  for (let offset = 0; offset < 40_000; offset += PAGE) {
    const qs = new URLSearchParams({
      where,
      outFields:
        "objectid,wfo,efscale,starttime,endtime,length,fatalities,injuries",
      returnGeometry: "true",
      maxAllowableOffset: "0.01",
      geometryPrecision: "3",
      outSR: "4326",
      orderByFields: "objectid",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: "json",
    });
    const r = await fetch(`${DAT}?${qs}`, {
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`DAT ${r.status}`);
    const j = (await r.json()) as {
      error?: unknown;
      features?: {
        attributes: Record<string, unknown>;
        geometry?: { paths?: [number, number][][] };
      }[];
    };
    if (j.error) throw new Error("DAT error");
    const page = j.features ?? [];
    for (const f of page) {
      const a = f.attributes;
      const start = Math.round(Number(a.starttime) / 1000);
      if (!Number.isFinite(start)) continue;
      if (start < from.getTime() / 1000 || start >= to.getTime() / 1000)
        continue;
      const all = (f.geometry?.paths ?? []).flat();
      if (!all.length) continue;
      // Thin to ~24 points: enough for the grouping and the event's bounds.
      const step = Math.max(1, Math.ceil(all.length / 24));
      const path = all.filter((_, i) => i % step === 0 || i === all.length - 1);
      // Some surveys carry an end time days out; no tornado lasts four hours.
      const raw = Math.round(Number(a.endtime) / 1000);
      const end = raw > start && raw - start <= 4 * 3600 ? raw : NaN;
      out.push({
        start,
        end: Number.isFinite(end)
          ? end
          : start +
            Math.round(Math.max(60, ((Number(a.length) || 0) / 30) * 3600)),
        ef: EF(a.efscale),
        wfo: String(a.wfo ?? "").toUpperCase(),
        fat: Math.max(0, Number(a.fatalities) || 0),
        inj: Math.max(0, Number(a.injuries) || 0),
        lengthMi: Math.max(0, Number(a.length) || 0),
        path,
      });
    }
    if (page.length < PAGE) break;
  }
  return out;
}

export function groupDays(
  list: Survey[],
  members?: (day: AutoDay, tracks: Survey[]) => void,
): AutoDay[] {
  rows ??= parsePlaces(PLACES);
  const places = rows;
  return groupSurveys(
    list,
    (lat, lon) => {
      const n = nearestPlace(places, lat, lon, 1000);
      return n ? { place: n.hit.name, st: n.hit.st } : null;
    },
    (st) => STATES[st] ?? st,
    members,
  );
}

/** Rebuilds every automatic day that starts in [from, to). */
export async function refresh(from: Date, to: Date) {
  // Half a day either side, so a storm after local midnight lands on its own local day.
  const pad = 12 * 3600_000;
  const days = groupDays(
    await fetchSurveys(
      new Date(from.getTime() - pad),
      new Date(to.getTime() + pad),
    ),
  );
  const db = supabaseAdmin();
  const lo = from.toISOString().slice(0, 10);
  const hi = to.toISOString().slice(0, 10);
  const del = await db
    .from("archive_auto")
    .delete()
    .gte("day", lo)
    .lt("day", hi);
  if (del.error) throw new Error(del.error.message);
  const keep = days.filter((d) => d.day >= lo && d.day < hi);
  if (keep.length) {
    const ins = await db
      .from("archive_auto")
      .upsert(
        keep.map((d) => ({ ...d, updated_at: new Date().toISOString() })),
      );
    if (ins.error) throw new Error(ins.error.message);
  }
  return { from: lo, to: hi, days: keep.length };
}

/** One month further back per call, until BACKFILL_FROM. */
export async function backfillMonth() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("app_config")
    .select("value")
    .eq("key", "archive_backfill")
    .maybeSingle();
  const now = new Date();
  const first = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1),
  );
  const next =
    (data?.value as { next?: string } | null)?.next ??
    first.toISOString().slice(0, 7);
  if (next < BACKFILL_FROM) return { done: true };
  const [y, m] = next.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const res = await refresh(from, to);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  await db
    .from("app_config")
    .upsert({ key: "archive_backfill", value: { next: prev } });
  return { ...res, next: prev };
}
