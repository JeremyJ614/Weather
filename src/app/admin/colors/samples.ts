import { geoPath, linePath, type Geometry } from "@/lib/map/geo";
import { project } from "@/lib/map/usAlbers";
import { PROB_STEPS } from "@/lib/colors/spc";
import { hazardKind } from "@/lib/hazards/style";
import { tierOf } from "@/lib/tropical/style";
import {
  FIELD_BANDS,
  OUTDOOR_BANDS,
  OUTMAP_BANDS,
  type FieldId,
} from "@/lib/engines/colors";

/**
 * Fixed example maps for the color editor (Fix-It List #17): real archived days, each
 * chosen so every color in its group shows at once. The files in /public/samples were cut
 * down from public NOAA and Drought Monitor archives; see docs/04-DECISIONS.md.
 */
export type Shape = {
  k: string;
  d: string;
  /** Fill opacity; a line has none. */
  o?: number;
  /** Line width in screen pixels; set for lines. */
  w?: number;
};
export type Dot = { k: string; x: number; y: number; r: number };
export type Sample = {
  title: string;
  view?: { x: number; y: number; w: number };
  /** Drawn clipped to the US (land products). */
  under: Shape[];
  /** Drawn over the states, unclipped (oceans, tracks). */
  over: Shape[];
  dots: Dot[];
};

const CAT = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];
/** Which categorical contour is each palette's first level. */
const FROM: Record<string, number> = {
  cat: 0,
  tornadoLikelihood: 1,
  hailLikelihood: 1,
  windLikelihood: 1,
  prob: 1,
  tornadoIntensity: 2,
  windIntensity: 2,
  hailIntensity: 3,
};
const SPC_VIEW = { x: 220, y: 95, w: 720 };

const json = <T>(url: string) =>
  fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject()));

async function spc(kind: string): Promise<Sample> {
  const j = await json<{ features: { label: string; geometry: Geometry }[] }>(
    "/samples/spc-20240506.json",
  );
  const from = FROM[kind];
  const under = j.features.flatMap((f) => {
    const i = CAT.indexOf(f.label) - from;
    if (i < 0) return [];
    const d = geoPath(f.geometry, 0.6);
    const k = kind === "prob" ? `prob:${i + 1}` : `spc:${kind}:${i}`;
    // Each level filled, then outlined, like SPC's own map.
    return d
      ? [
          { k, d, o: kind === "prob" ? PROB_STEPS[i].opacity : 0.88 },
          { k, d, w: 1.2 },
        ]
      : [];
  });
  return {
    title:
      "SPC Day 1, 6 May 2024 (the High Risk you sent), every level in these colors",
    view: SPC_VIEW,
    under,
    over: [],
    dots: [],
  };
}

/**
 * An engine's bands drawn the way the Engines map now draws them (nested, filled and
 * outlined), shaped by SPC's 6 May 2024 contours so every band shows.
 */
async function engineAreas(id: string, n: number): Promise<Sample> {
  const j = await json<{ features: { label: string; geometry: Geometry }[] }>(
    "/samples/spc-20240506.json",
  );
  const from = CAT.length - n;
  return {
    title: `Example areas in SPC's 6 May 2024 shapes, every band in these colors`,
    view: SPC_VIEW,
    under: j.features.flatMap((f) => {
      const i = CAT.indexOf(f.label) - from;
      const d = i >= 0 ? geoPath(f.geometry, 0.6) : "";
      const k = `engine:${id}:${i}`;
      return d
        ? [
            { k, d, o: 0.45 },
            { k, d, w: 1.6 },
          ]
        : [];
    }),
    over: [],
    dots: [],
  };
}

async function tornadoes(): Promise<Sample> {
  const j = await json<{ tracks: { ef: string; c: number[][] }[] }>(
    "/samples/tornadoes-20110427.json",
  );
  const n = (ef: string) => (ef === "EFU" ? -1 : Number(ef[2]));
  return {
    title: "Every surveyed tornado track of the 27 April 2011 Super Outbreak",
    view: { x: 548, y: 330, w: 240 },
    under: [],
    over: j.tracks
      .sort((a, b) => n(a.ef) - n(b.ef))
      .map((t) => ({
        k: `ef:${t.ef}`,
        d: linePath({ type: "LineString", coordinates: t.c }, 0.05),
        w: 1.6 + Math.max(0, n(t.ef)) * 0.7,
      }))
      .filter((s) => s.d),
    dots: [],
  };
}

async function drought(): Promise<Sample> {
  const j = await json<{ features: { dm: number; geometry: Geometry }[] }>(
    "/samples/usdm-20220816.json",
  );
  return {
    title: "U.S. Drought Monitor, 16 August 2022: D0 through D4",
    under: j.features
      .map((f) => ({ k: `usdm:${f.dm}`, d: geoPath(f.geometry, 0.6), o: 0.9 }))
      .filter((s) => s.d),
    over: [],
    dots: [],
  };
}

async function fire(): Promise<Sample> {
  const [j, live] = await Promise.all([
    json<{ features: { key: string; geometry: Geometry }[] }>(
      "/samples/fire.json",
    ),
    json<{
      features: {
        geometry: { coordinates: number[] };
        properties: { contain?: string; r?: number };
      }[];
    }>("/api/fire/map?layer=fires").catch(() => ({ features: [] })),
  ]);
  const order = ["ELEV", "CRIT", "EXTM", "IsoDryT", "SctDryT"];
  return {
    title:
      "SPC fire outlooks (wind and humidity 7 Apr 2022, dry thunderstorms 17 Aug 2020) with today's fires by containment",
    under: j.features
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      .map((f) => ({
        k: `fire:${f.key}`,
        d: geoPath(f.geometry, 0.6),
        o: f.key.endsWith("DryT") ? 0.6 : 0.85,
      }))
      .filter((s) => s.d),
    over: [],
    dots: live.features
      .filter((f) => f.properties.contain)
      .map((f) => ({
        k: `fire:contain:${f.properties.contain}`,
        ...project(f.geometry.coordinates[0], f.geometry.coordinates[1]),
        r: Math.min(6, (f.properties.r ?? 4) * 0.45),
      })),
  };
}

async function hazards(): Promise<Sample> {
  const j = await json<{
    features: { geometry: Geometry; properties: { label?: string } }[];
  }>("/api/hazards/map?layer=cpc");
  return {
    title: "CPC's hazards outlook now (only the kinds in today's outlook show)",
    under: j.features
      .map((f) => ({
        k: `haz:${hazardKind(String(f.properties.label ?? ""))}`,
        d: geoPath(f.geometry, 0.6),
        o: 0.55,
      }))
      .filter((s) => s.d),
    over: [],
    dots: [],
  };
}

/** Canvas points of a circle `nm` nautical miles around a spot. */
const circle = (lat: number, lon: number, nm: number) =>
  Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * 2 * Math.PI;
    return project(
      lon + ((nm / 60) * Math.cos(a)) / Math.cos((lat * Math.PI) / 180),
      lat + (nm / 60) * Math.sin(a),
    );
  });

/** Convex hull (monotone chain), counter-clockwise on screen. */
function hull(p: { x: number; y: number }[]) {
  const s = [...p].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (
    o: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (pts: typeof s) => {
    const h: typeof s = [];
    for (const q of pts) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0)
        h.pop();
      h.push(q);
    }
    return h.slice(0, -1);
  };
  return [...half(s), ...half([...s].reverse())];
}

const pathOf = (pts: { x: number; y: number }[], close = true) =>
  pts
    .map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`)
    .join("") + (close ? "Z" : "");

const ring = (lat: number, lon: number, rx: number, ry: number) =>
  pathOf(
    Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * 2 * Math.PI;
      return project(lon + rx * Math.cos(a), lat + ry * Math.sin(a));
    }),
  );

/** Florida and Georgia coast, south to north, for the example watches and warnings. */
const WEST = [
  [25.14, -80.92],
  [25.86, -81.39],
  [26.14, -81.8],
  [26.33, -81.85],
  [26.7, -82.25],
  [27.1, -82.46],
  [27.6, -82.75],
  [28.15, -82.8],
  [28.95, -82.75],
  [29.14, -83.04],
  [29.33, -83.16],
  [29.7, -83.45],
  [30.06, -83.98],
  [29.92, -84.37],
  [29.73, -84.88],
  [29.67, -85.22],
];
const EAST = [
  [25.25, -80.4],
  [25.77, -80.13],
  [26.12, -80.1],
  [26.7, -80.03],
  [27.2, -80.17],
  [27.47, -80.3],
  [27.86, -80.45],
  [28.4, -80.6],
  [29.23, -81.01],
  [29.65, -81.2],
  [30.24, -81.38],
  [30.71, -81.44],
  [31.31, -81.3],
  [32.03, -80.85],
  [32.5, -80.3],
];
const coast = (pts: number[][], a: number, b: number) =>
  pathOf(
    pts.slice(a, b + 1).map(([lat, lon]) => project(lon, lat)),
    false,
  );

async function tropical(): Promise<Sample> {
  const j = await json<{
    points: { t: string; lat: number; lon: number; kt: number }[];
  }>("/samples/milton-2024.json");
  const pts = j.points;
  const over: Shape[] = [];
  // Outlook areas first, so the storm sits on top.
  over.push(
    { k: "trop:risk:low", d: ring(25.4, -87.4, 1.6, 1.0), o: 0.3 },
    { k: "trop:risk:medium", d: ring(32.2, -74.2, 1.9, 1.2), o: 0.3 },
    { k: "trop:risk:high", d: ring(24.3, -93.4, 2.0, 1.3), o: 0.3 },
  );
  for (const k of ["low", "medium", "high"])
    over.push({
      k: `trop:risk:${k}`,
      d: over.find((s) => s.k === `trop:risk:${k}`)!.d,
      w: 1.5,
    });
  // A cone the way NHC sizes one: circles that grow with lead time (2024 Atlantic sizes)
  // around the track from the morning Milton peaked, wrapped in one outline.
  const start = pts.findIndex((p) => p.t === "2024100812");
  const nm = [10, 26, 39, 53, 67, 81, 99];
  const cone = pathOf(
    hull(
      nm.flatMap((r, i) => {
        const p = pts[start + i * 2];
        return p ? circle(p.lat, p.lon, r) : [];
      }),
    ),
  );
  over.push(
    { k: "trop:cone", d: cone, o: 0.3 },
    { k: "trop:cone", d: cone, w: 1 },
  );
  over.push(
    { k: "trop:ww:TWR", d: coast(WEST, 0, 3), w: 4 },
    { k: "trop:ww:HWR", d: coast(WEST, 3, 10), w: 4 },
    { k: "trop:ww:HWA", d: coast(WEST, 10, 15), w: 4 },
    { k: "trop:ww:TWR", d: coast(EAST, 0, 4), w: 4 },
    { k: "trop:ww:HWR", d: coast(EAST, 4, 10), w: 4 },
    { k: "trop:ww:TWR", d: coast(EAST, 10, 12), w: 4 },
    { k: "trop:ww:TWA", d: coast(EAST, 12, 14), w: 4 },
  );
  const xy = pts.map((p) => project(p.lon, p.lat));
  for (let i = 1; i < pts.length; i++)
    over.push({
      k: `trop:${tierOf(pts[i - 1].kt).key}`,
      d: pathOf([xy[i - 1], xy[i]], false),
      w: 2.5,
    });
  return {
    title:
      "Example: Milton's 2024 track by strength, with a cone, coastal watches and warnings and outlook areas drawn in",
    view: { x: 450, y: 330, w: 530 },
    under: [],
    over,
    dots: pts.map((p, i) => ({
      k: `trop:${tierOf(p.kt).key}`,
      ...xy[i],
      r: 2.6,
    })),
  };
}

/** The example map for a group, or null when it has none. */
export function sampleFor(id: string): (() => Promise<Sample>) | null {
  const field = id.slice(7) as FieldId;
  if (id.startsWith("engine-") && field in FIELD_BANDS)
    return () => engineAreas(field, FIELD_BANDS[field].levels.length);
  if (id.startsWith("engine-") && field in OUTDOOR_BANDS)
    return () =>
      engineAreas(
        field,
        OUTDOOR_BANDS[field as keyof typeof OUTDOOR_BANDS].levels.length,
      );
  if (id === "engine-outmap")
    return () => engineAreas("outmap", OUTMAP_BANDS.labels.length);
  if (id.startsWith("spc-")) {
    const k = id.slice(4);
    return k in FROM ? () => spc(k) : null;
  }
  switch (id) {
    case "prob":
      return () => spc("prob");
    case "ef":
      return tornadoes;
    case "usdm":
      return drought;
    case "fire":
      return fire;
    case "hazards":
      return hazards;
    case "tropical":
      return tropical;
    case "engine-tor":
      return () => engineAreas(id.slice(7), 4);
    case "engine-surge":
    case "engine-firstT":
      return () => engineAreas(id.slice(7), 3);
    case "engine-analog":
    case "engine-boundpt":
      return () => engineAreas(id.slice(7), 4);
    default:
      return null;
  }
}
