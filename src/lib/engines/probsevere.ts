import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { pathAreas, type Segment } from "./areas";
import { TOR_BINS } from "./colors";
import { ahead, cone, motion, torOutlook, type Cell } from "./project";

/**
 * Reads NOAA/CIMSS ProbSevere v3 (MRMS, new every 2 minutes) and turns it into the ProbTor
 * layers. The newest file is compared with one about 10 minutes older to get
 * each storm's rotation trend and lightning jump (storm IDs carry across files).
 */
const BASE = "https://mrms.ncep.noaa.gov/ProbSevere/PROBSEVERE/";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
let rows: ReturnType<typeof parsePlaces> | null = null;

export type Raw = {
  validTime?: string;
  features: {
    geometry: { type: string; coordinates: number[][][] };
    properties: Record<string, string>;
  }[];
};

const num = (v: string | undefined) => Number(v) || 0;

export function cells(raw: Raw): Cell[] {
  return raw.features
    .filter((f) => f.geometry?.type === "Polygon")
    .map((f) => {
      const p = f.properties;
      const ring = f.geometry.coordinates[0] as [number, number][];
      return {
        id: p.ID,
        lat: num(p.MLAT) || ring[0][1],
        lon: num(p.MLON) || ring[0][0],
        ring,
        tor: num(p.ProbTor),
        wind: num(p.ProbWind),
        severe: num(p.ProbSevere),
        az: num(p.MAXLLAZ),
        flash: num(p.FLASH_RATE),
        jump: num(p.LJA) > 0,
        east: num(p.MOTION_EAST),
        north: -num(p.MOTION_SOUTH),
      };
    });
}

export const stamp = (f: string) => {
  const m = /(\d{8})_(\d{6})/.exec(f);
  return m
    ? Date.parse(
        `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:${m[2].slice(4)}Z`,
      )
    : 0;
};

export async function file(name: string): Promise<Raw> {
  // Each file name is a fixed time, so a fetched file never changes.
  const r = await fetch(BASE + name, {
    headers: UA,
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 3600 },
  });
  if (!r.ok) throw new Error(`ProbSevere ${r.status}`);
  return r.json();
}

export type EngineStorm = {
  id: string;
  place: string;
  lat: number;
  lon: number;
  tor: number;
  p20: number;
  p40: number;
  p60: number;
  trend: string;
  jump: boolean;
  wind: number;
  mph: number;
  toward: string;
};

/** Every ProbSevere file on the server (about the last 25 hours), oldest first. */
export async function fileNames() {
  const list = await fetch(BASE, {
    headers: UA,
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 60 },
  }).then((r) => (r.ok ? r.text() : ""));
  return [...list.matchAll(/MRMS_PROBSEVERE_\d{8}_\d{6}\.json/g)]
    .map((m) => m[0])
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();
}

/** The place line for a storm: "12 mi from Town, ST". */
export function placeOf(lat: number, lon: number) {
  rows ??= parsePlaces(PLACES);
  const near = nearestPlace(rows, lat, lon, 1000);
  return near
    ? `${near.miles < 3 ? "" : `${Math.round(near.miles)} mi from `}${near.hit.name}, ${near.hit.st}`
    : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

export async function probSevere() {
  const names = await fileNames();
  const latest = names.at(-1);
  if (!latest) throw new Error("ProbSevere has no files");
  const t = stamp(latest);
  const older = [...names].reverse().find((n) => stamp(n) <= t - 9 * 60_000);
  const [now, then] = await Promise.all([
    file(latest),
    older ? file(older).catch(() => null) : null,
  ]);
  const prev = new Map(
    (then ? cells(then) : []).map((c) => [c.id, c] as const),
  );
  const tor: GeoJSON.Feature[] = [];
  const torPaths: Segment[] = [];
  const storms: EngineStorm[] = [];
  for (const c of cells(now)) {
    const o = torOutlook(c, prev.get(c.id));
    if (o.p20 < 3) continue;
    const m = motion(c);
    storms.push({
      id: c.id,
      place: placeOf(c.lat, c.lon),
      lat: c.lat,
      lon: c.lon,
      tor: o.now,
      p20: o.p20,
      p40: o.p40,
      p60: o.p60,
      trend: o.trend,
      jump: o.jump,
      wind: Math.round(c.wind),
      mph: m.mph,
      toward: m.toward,
    });
    for (const [from, to, p, step] of [
      [40, 60, o.p60, 2],
      [20, 40, o.p40, 1],
      [0, 20, o.p20, 0],
    ] as const) {
      tor.push({
        type: "Feature",
        properties: { id: c.id, p, step },
        geometry: { type: "Polygon", coordinates: [cone(c, from, to)] },
      });
      torPaths.push({ a: ahead(c, from), b: ahead(c, to), value: p });
    }
  }
  storms.sort((a, b) => b.p20 - a.p20 || b.tor - a.tor);
  return {
    at: new Date(t).toISOString(),
    total: now.features.length,
    storms: storms.slice(0, 40),
    tor: {
      type: "FeatureCollection",
      features: tor,
    } as GeoJSON.FeatureCollection,
    // SPC-style areas: the threat around each storm's next hour, nested by level.
    torAreas: pathAreas(
      torPaths,
      TOR_BINS.map((b) => b.min),
    ),
  };
}
