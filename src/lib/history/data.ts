import "server-only";
import { geoPath, linePath, type Geometry } from "@/lib/map/geo";

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
  for (let offset = 0; offset < 40000; offset += 2000) {
    const r = await fetch(
      `${DAT}?where=${where}&outFields=efscale,stormdate,wfo,length,width,fatalities,injuries&returnGeometry=true&maxAllowableOffset=0.005&geometryPrecision=3&outSR=4326&orderByFields=stormdate&resultOffset=${offset}&resultRecordCount=2000&f=geojson`,
      { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(30000) },
    );
    if (!r.ok) throw new Error(`DAT ${r.status}`);
    const j = (await r.json()) as {
      features?: { geometry: Geometry; properties: Record<string, unknown> }[];
    };
    const f = j.features ?? [];
    for (const x of f) {
      const d = linePath(x.geometry);
      if (!d) continue;
      const p = x.properties;
      out.push({
        d,
        ef: ef(p.efscale),
        date: new Date(Number(p.stormdate)).toISOString().slice(0, 10),
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
  date: string;
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

/** Tornado, severe thunderstorm and flash flood warning polygons issued in a window. */
export async function warningHistory(
  startIso: string,
  endIso: string,
): Promise<WarnPoly[]> {
  const r = await fetch(`${IEM}?sts=${startIso}&ets=${endIso}`, {
    headers: UA,
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(45000),
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
    out.push({
      d,
      kind: kind as WarnPoly["kind"],
      tier: warnTier(p),
      date: String(p.issue ?? "").slice(0, 10),
    });
  }
  // Paint order: floods, then severe, then tornado; stronger tiers on top.
  const rank = { FF: 0, SV: 1, TO: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.tier - b.tier);
}
