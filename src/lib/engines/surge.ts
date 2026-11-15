import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { surge, surgeBand, sigmaLevel, HOLD_MIN } from "./jump";
import { cells, file, fileNames, placeOf, stamp, type Raw } from "./probsevere";
import { motion } from "./project";
import { lineage } from "./lineage";

/**
 * Lightning Surge Detector (Extras engine): the last ~20 minutes of ProbSevere files (one
 * every 2 minutes), each storm's total flash rate followed by its ID, run through the 2σ
 * lightning-jump test (lib/engines/jump.ts). A jump the radar backs up (low-level rotation
 * tightening or the hail core growing over the same 10 minutes) is flagged as strong.
 */
const FILES = 11;

type Lite = {
  id: string;
  fr: number;
  az: number;
  mesh: number;
  lat: number;
  lon: number;
};
const lite = (raw: Raw): Lite[] =>
  raw.features.map((f) => ({
    id: f.properties.ID,
    fr: Number(f.properties.FLASH_RATE) || 0,
    az: Number(f.properties.MAXLLAZ) || 0,
    mesh: Number(f.properties.MESH) || 0,
    lat: Number(f.properties.MLAT) || f.geometry.coordinates[0][0][1],
    lon: Number(f.properties.MLON) || f.geometry.coordinates[0][0][0],
  }));
// Parsed older files, kept while this server is warm: each file name is a fixed time.
const memo = new Map<string, Map<string, Lite>>();

async function older(name: string) {
  const hit = memo.get(name);
  if (hit) return hit;
  const m = new Map(lite(await file(name)).map((c) => [c.id, c]));
  memo.set(name, m);
  if (memo.size > 24) memo.delete(memo.keys().next().value!);
  return m;
}

export type SurgeStorm = {
  id: string;
  place: string;
  lat: number;
  lon: number;
  band: number;
  /** Flashes a minute now, and over the last ~20 minutes (oldest first). */
  rate: number;
  rates: number[];
  sigma: number;
  peak: number;
  /** Jump size: 2, 3 or 4 (4σ and up), 0 with no jump. Bigger jumps verify better. */
  level: number;
  /** A merger or split happened in the window and was followed by overlap. */
  merged: boolean;
  since: number | null;
  rotation: boolean;
  hail: boolean;
  severe: number;
  mph: number;
  toward: string;
};

export async function surges() {
  const names = (await fileNames()).slice(-FILES);
  const latest = names.at(-1);
  if (!latest) throw new Error("ProbSevere has no files");
  const t = stamp(latest);
  const [now, ...past] = await Promise.all([
    file(latest),
    ...names.slice(0, -1).map((n) => older(n).catch(() => null)),
  ]);
  const hist = names
    .slice(0, -1)
    .map((n, i) => ({ t: stamp(n), m: past[i] }))
    .filter((h): h is { t: number; m: Map<string, Lite> } => h.m != null);
  // The file closest to 10 minutes back, for the radar's own trend.
  const back = [...hist].reverse().find((h) => h.t <= t - 9 * 60_000);
  const mesh = new Map(lite(now).map((x) => [x.id, x.mesh]));
  const storms: SurgeStorm[] = [];
  const polys: GeoJSON.Feature[] = [];
  const all = cells(now);
  // Storms followed by overlap, not ID alone (post-launch A6): a merger adds its parts' rates
  // together and a split shares the parent's, so neither reads as a jump.
  const lines = hist.map((h) => lineage(all, [...h.m.values()], t - h.t));
  for (const c of all) {
    let merged = false;
    const points = [
      ...hist.flatMap((h, i) => {
        const l = lines[i].get(c.id);
        if (!l) return [];
        if (l.merged || l.split) merged = true;
        return [{ t: h.t, fr: l.fr }];
      }),
      { t, fr: c.flash },
    ];
    const s = surge(points, t);
    const backId = back ? lines[hist.indexOf(back)].get(c.id)?.main : undefined;
    const was = backId ? back?.m.get(backId) : undefined;
    const rotation = Boolean(was && c.az - was.az > 0.002);
    const hail = Boolean(was && (mesh.get(c.id) ?? 0) - was.mesh >= 0.25);
    const band = surgeBand(s, rotation || hail);
    if (band < 0) continue;
    const m = motion(c);
    storms.push({
      id: c.id,
      place: placeOf(c.lat, c.lon),
      lat: c.lat,
      lon: c.lon,
      band,
      rate: Math.round(c.flash),
      rates: points.map((p) => Math.round(p.fr)),
      sigma: s.sigma,
      peak: s.peak,
      level: s.since != null && s.since <= HOLD_MIN ? sigmaLevel(s.peak) : 0,
      merged,
      since: s.since,
      rotation,
      hail,
      severe: Math.round(c.severe),
      mph: m.mph,
      toward: m.toward,
    });
    polys.push({
      type: "Feature",
      properties: { band },
      geometry: { type: "Polygon", coordinates: [c.ring] },
    });
  }
  storms.sort((a, b) => b.band - a.band || b.peak - a.peak || b.rate - a.rate);
  return {
    at: new Date(t).toISOString(),
    total: now.features.length,
    minutes: Math.round((t - (hist[0]?.t ?? t)) / 60_000),
    storms: storms.slice(0, 40),
    polys: {
      type: "FeatureCollection",
      features: polys,
    } as GeoJSON.FeatureCollection,
    jumps: storms
      .filter((x) => x.since != null && x.since <= HOLD_MIN)
      .map((x) => ({ ...x, at: t - x.since! * 60_000 })),
  };
}

/**
 * Every 10 minutes (pg_cron "engine-surge"): log each storm whose lightning jumped, once per
 * storm per half hour, for the hit rate and the "Lightning surges" alert.
 */
export async function logSurges() {
  const d = await surges();
  if (!d.jumps.length) return { logged: 0 };
  const db = supabaseAdmin();
  const { data: recent } = await db
    .from("engine_checks")
    .select("key")
    .eq("engine", "surge")
    .gt("at", new Date(Date.now() - 30 * 60_000).toISOString());
  const seen = new Set((recent ?? []).map((r) => r.key.split(":")[0]));
  const rows = d.jumps
    .filter((j) => !seen.has(j.id))
    .map((j) => ({
      engine: "surge",
      key: `${j.id}:${j.at}`,
      at: new Date(j.at).toISOString(),
      lat: j.lat,
      lon: j.lon,
      label:
        `${j.place} (${j.level}σ ${j.band === 2 ? "strong " : ""}jump, ${j.rate}/min)`.slice(
          0,
          120,
        ),
      window_min: 45,
      radius_km: 25,
    }));
  if (rows.length) {
    const { error } = await db
      .from("engine_checks")
      .upsert(rows, { onConflict: "engine,key", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return { logged: rows.length };
}
