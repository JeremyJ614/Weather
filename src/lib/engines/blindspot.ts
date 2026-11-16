/**
 * Radar Blind Spot data (built by scripts/build-blindspot.mjs): a Web Mercator grid with, at
 * every pixel, the lowest beam that gets through (feet above the ground, 250 ft steps, after
 * terrain blocking) and its radar, plus the runner-up, so a radar that is down right now can
 * be taken out and the next one shown. Client and server safe.
 */
export type BlindRadar = {
  id: string;
  kind: "NEXRAD" | "TDWR" | "CA";
  lat: number;
  lon: number;
  elev: number;
  /** The lowest tilt it really scans (degrees). */
  low: number;
  maxKm: number;
};
export type BlindMeta = {
  bounds: [number, number, number, number];
  width: number;
  height: number;
  stepFt: number;
  bandsFt: number[];
  radars: BlindRadar[];
};
export type Blind = BlindMeta & {
  h1: Uint8Array;
  r1: Uint8Array;
  h2: Uint8Array;
  r2: Uint8Array;
};
export const NONE = 255;

export async function loadBlind(base = ""): Promise<Blind> {
  const [meta, bin] = await Promise.all([
    fetch(`${base}/extras/blindspot.json`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<BlindMeta>;
    }),
    fetch(`${base}/extras/blindspot.bin`).then((r) => {
      if (!r.ok || !r.body) throw new Error(String(r.status));
      return new Response(
        r.body.pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer();
    }),
  ]);
  const n = meta.width * meta.height;
  const all = new Uint8Array(bin);
  const undelta = (a: Uint8Array) => {
    const out = new Uint8Array(a.length);
    let v = 0;
    for (let k = 0; k < a.length; k++) out[k] = v = (v + a[k]) & 255;
    return out;
  };
  return {
    ...meta,
    h1: undelta(all.subarray(0, n)),
    r1: all.slice(n, 2 * n),
    h2: undelta(all.subarray(2 * n, 3 * n)),
    r2: all.slice(3 * n, 4 * n),
  };
}

/** The band (0 = out of range, 1–5 by height) for a stored height step. */
export const bandOf = (b: BlindMeta, step: number) =>
  step === NONE ? 0 : 1 + b.bandsFt.filter((f) => step * b.stepFt >= f).length;

const merc = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
/** The grid pixel at a spot, or -1 outside the grid. */
export function pixelAt(b: BlindMeta, lat: number, lon: number) {
  const [W, S, E, N] = b.bounds;
  if (lat <= S || lat >= N || lon <= W || lon >= E) return -1;
  const x = Math.floor(((lon - W) / (E - W)) * b.width);
  const y = Math.floor(
    ((merc(N) - merc(lat)) / (merc(N) - merc(S))) * b.height,
  );
  return y * b.width + x;
}

/** The beam at pixel k with some radars down: the best one still working, and whether it changed. */
export function beamAtPixel(b: Blind, k: number, down: Set<number>) {
  if (k < 0) return null;
  const first = b.r1[k];
  if (first !== NONE && !down.has(first))
    return { step: b.h1[k], radar: first, lost: false };
  const second = b.r2[k];
  if (first !== NONE && second !== NONE && !down.has(second))
    return { step: b.h2[k], radar: second, lost: true };
  return first === NONE ? null : { step: NONE, radar: NONE, lost: true };
}

/** Distance in miles from a radar to a spot. */
export function milesTo(r: BlindRadar, lat: number, lon: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((r.lat - lat) * rad) / 2) ** 2 +
    Math.cos(lat * rad) *
      Math.cos(r.lat * rad) *
      Math.sin(((r.lon - lon) * rad) / 2) ** 2;
  return 7918 * Math.asin(Math.sqrt(a));
}

type Station = {
  properties: {
    id: string;
    rda?: {
      properties?: { status?: string; operabilityStatus?: string };
    } | null;
    latency?: { levelTwoLastReceivedTime?: string } | null;
  };
};
/**
 * Radars down right now, from the NWS radar status feed: not operating, off line, or no data
 * for 30 minutes. Canadian radars aren't in the feed and count as up.
 */
export async function radarsDown(b: BlindMeta): Promise<Set<number>> {
  const r = await fetch(
    "https://api.weather.gov/radar/stations?stationType=WSR-88D,TDWR",
    { headers: { Accept: "application/geo+json" } },
  );
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as { features: Station[] };
  const idx = new Map(b.radars.map((x, i) => [x.id, i]));
  const down = new Set<number>();
  for (const f of d.features) {
    const p = f.properties;
    const i = idx.get(p.id);
    if (i === undefined) continue;
    const st = p.rda?.properties;
    const last = Date.parse(p.latency?.levelTwoLastReceivedTime ?? "");
    const off =
      (st?.status && st.status !== "Operate") ||
      (st?.operabilityStatus && !/on-?line/i.test(st.operabilityStatus)) ||
      (Number.isFinite(last) && Date.now() - last > 30 * 60_000);
    if (off) down.add(i);
  }
  return down;
}
