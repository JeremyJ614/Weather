import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { geoPath, linePath, type Geometry } from "@/lib/map/geo";
import { project } from "@/lib/map/usAlbers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { stateAt } from "./states";
import type { WarnTag } from "@/lib/warnings/style";

export { linePath };

/**
 * Severe Weather History, built for speed: the server reads the NWS Damage Assessment
 * Toolkit (tornado tracks) and IEM's storm-based warning archive once, projects every shape
 * onto the national map, and returns small ready-to-draw paths. Finished years never
 * change, so they are cached for a week; the current window refreshes hourly.
 */
const DAT =
  "https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/FeatureServer/1/query";
const IEM = "https://mesonet.agron.iastate.edu/geojson/sbw.geojson";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };

export const EF_ORDER = ["EFU", "EF0", "EF1", "EF2", "EF3", "EF4", "EF5"];

export type Track = {
  d: string;
  ef: string;
  date: string;
  /** The state it touched down in (two letters; "" offshore). */
  st: string;
  miles: number;
  yards: number;
  deaths: number;
  hurt: number;
  wfo: string;
};

const ef = (v: unknown) => {
  const s = String(v ?? "")
    .toUpperCase()
    .replace(/\s/g, "");
  return EF_ORDER.includes(s)
    ? s
    : s.startsWith("EF") && /\d/.test(s)
      ? `EF${s.match(/\d/)![0]}`
      : "EFU";
};

/** Every surveyed tornado track between two dates (UTC, end exclusive), oldest first. */
export async function tornadoTracks(
  start: string,
  end: string,
  revalidate: number,
): Promise<Track[]> {
  const where = encodeURIComponent(
    `stormdate >= date '${start}' AND stormdate < date '${end}'`,
  );
  const out: Track[] = [];
  // DAT sometimes lists one track twice (an edit saved as a new feature): keep one.
  const seen = new Set<string>();
  for (let offset = 0; offset < 40000; offset += 2000) {
    const r = await fetch(
      // About 90 m of detail, so tracks stay true when the map is zoomed far in (2026-10-30 #7).
      `${DAT}?where=${where}&outFields=efscale,stormdate,wfo,length,width,fatalities,injuries,startlat,startlon&returnGeometry=true&maxAllowableOffset=0.0008&geometryPrecision=4&outSR=4326&orderByFields=stormdate&resultOffset=${offset}&resultRecordCount=2000&f=geojson`,
      { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(30000) },
    );
    if (!r.ok) throw new Error(`DAT ${r.status}`);
    const j = (await r.json()) as {
      features?: { geometry: Geometry; properties: Record<string, unknown> }[];
    };
    const f = j.features ?? [];
    for (const x of f) {
      const d = linePath(x.geometry, 0.03, 2);
      if (!d || seen.has(d)) continue;
      seen.add(d);
      const p = x.properties;
      // The first vertex, for tracks whose start point wasn't filled in.
      const first = String(
        (x.geometry as { coordinates?: unknown }).coordinates ?? "",
      )
        .split(",")
        .map(Number);
      const lon = Number(p.startlon) || first?.[0];
      const lat = Number(p.startlat) || first?.[1];
      const at = lon && lat ? project(lon, lat) : null;
      out.push({
        d,
        ef: ef(p.efscale),
        date: new Date(Number(p.stormdate)).toISOString().slice(0, 10),
        st: at ? stateAt(at.x, at.y) : "",
        miles: Math.max(0, Math.round((Number(p.length) || 0) * 10) / 10),
        // DAT writes -99 for an unknown width.
        yards: Math.max(0, Math.round(Number(p.width) || 0)),
        deaths: Math.max(0, Number(p.fatalities) || 0),
        hurt: Math.max(0, Number(p.injuries) || 0),
        wfo: String(p.wfo ?? "")
          .split(",")
          .filter(Boolean)
          .join(", "),
      });
    }
    if (f.length < 2000) break;
  }
  return out;
}

export type WarnPoly = {
  d: string;
  kind: "TO" | "SV" | "FF";
  tier: number;
  tag?: WarnTag;
  date: string;
  /** The state its polygon sits in (two letters), for the state filter. */
  st?: string;
};

/**
 * Tier 0 = base warning; 1 = considerable / observed tornado; 2 = destructive or PDS;
 * 3 = tornado or flash flood emergency.
 */
export function warnTier(p: Record<string, unknown>): number {
  if (p.is_emergency || p.max_is_emergency) return 3;
  const tag = String(
    p.max_damagetag ?? p.damagetag ?? p.floodtag_damage ?? "",
  ).toUpperCase();
  if (
    p.is_pds ||
    p.max_is_pds ||
    tag === "DESTRUCTIVE" ||
    tag === "CATASTROPHIC"
  )
    return 2;
  if (
    tag === "CONSIDERABLE" ||
    String(p.tornadotag ?? "").toUpperCase() === "OBSERVED"
  )
    return 1;
  return 0;
}

/** Which tag a warning carries, strongest first; none for a plain warning. */
export function warnTag(p: Record<string, unknown>): WarnTag | undefined {
  if (p.is_emergency || p.max_is_emergency) return "emergency";
  if (p.is_pds || p.max_is_pds) return "pds";
  const tag = String(
    p.max_damagetag ??
      p.damagetag ??
      p.max_floodtag_damage ??
      p.floodtag_damage ??
      "",
  ).toUpperCase();
  if (tag === "DESTRUCTIVE" || tag === "CATASTROPHIC") return "destructive";
  if (tag === "CONSIDERABLE") return "considerable";
  if (String(p.tornadotag ?? "").toUpperCase() === "OBSERVED")
    return "observed";
  return undefined;
}

/** Tornado, severe thunderstorm and flash flood warning polygons issued in a window. */
export async function warningHistory(
  startIso: string,
  endIso: string,
  /** No shared cache: a whole month can be far bigger than the data cache keeps. */
  fresh = false,
): Promise<WarnPoly[]> {
  const r = await fetch(`${IEM}?sts=${startIso}&ets=${endIso}`, {
    headers: UA,
    ...(fresh
      ? { cache: "no-store" as const }
      : { next: { revalidate: 1800 } }),
    signal: AbortSignal.timeout(55000),
  });
  if (!r.ok) throw new Error(`IEM ${r.status}`);
  const j = (await r.json()) as {
    features?: { geometry: Geometry; properties: Record<string, unknown> }[];
  };
  const out: WarnPoly[] = [];
  for (const f of j.features ?? []) {
    const p = f.properties;
    const kind = String(p.phenomena);
    if (p.significance !== "W" || !["TO", "SV", "FF"].includes(kind)) continue;
    const d = geoPath(f.geometry, 0.8);
    if (!d) continue;
    const tag = warnTag(p);
    // The state under the polygon's middle (its first ring's average point).
    const ring = String(
      (f.geometry as { coordinates?: unknown }).coordinates ?? "",
    )
      .split(",")
      .map(Number);
    let sx = 0;
    let sy = 0;
    let k = 0;
    for (let i = 0; i + 1 < ring.length && k < 64; i += 2, k++) {
      sx += ring[i];
      sy += ring[i + 1];
    }
    const mid = k ? project(sx / k, sy / k) : null;
    const st = mid ? stateAt(mid.x, mid.y) : "";
    out.push({
      d,
      kind: kind as WarnPoly["kind"],
      tier: warnTier(p),
      ...(tag ? { tag } : {}),
      ...(st ? { st } : {}),
      date: String(p.issue ?? "").slice(0, 10),
    });
  }
  // Paint order: floods, then severe, then tornado; stronger tiers on top.
  const rank = { FF: 0, SV: 1, TO: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.tier - b.tier);
}

const BUCKET = "history";
/** A month counts as finished (and is filed for good) two days after it ends. */
const SETTLE_MS = 2 * 86400_000;

/** Whether a month (YYYY-MM) is over and settled, so its warnings never change. */
export const monthDone = (key: string) => {
  const s = new Date(`${key}-01T00:00:00Z`);
  return (
    Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1) + SETTLE_MS <
    Date.now()
  );
};

/**
 * One calendar month of warnings (Fix list 2026-10-30 #7: the archive goes back past 30 days;
 * a page asks for each month of a long window and joins them). A finished month is filed once
 * in the private `history` bucket and read from there after; the running month comes from IEM.
 */
export async function warningMonth(key: string): Promise<WarnPoly[]> {
  const start = new Date(`${key}-01T00:00:00Z`);
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
  );
  const iso = (d: Date) => d.toISOString().slice(0, 16) + "Z";
  const done = monthDone(key);
  // v2: each warning carries its state.
  const path = `warnings/v2/${key}.json.gz`;
  // No storage (a preview without database keys): every month comes from IEM.
  let store: ReturnType<
    ReturnType<typeof supabaseAdmin>["storage"]["from"]
  > | null = null;
  try {
    store = supabaseAdmin().storage.from(BUCKET);
  } catch {}
  if (done && store) {
    const got = await store.download(path).catch(() => null);
    if (got?.data)
      return JSON.parse(
        gunzipSync(Buffer.from(await got.data.arrayBuffer())).toString(),
      );
  }
  const polys = await warningHistory(iso(start), iso(end), true);
  if (done && store)
    // A failed write costs the next visitor one more fetch, never this one their map.
    await store
      .upload(path, gzipSync(JSON.stringify(polys)), {
        upsert: true,
        contentType: "application/gzip",
      })
      .catch(() => undefined);
  return polys;
}
