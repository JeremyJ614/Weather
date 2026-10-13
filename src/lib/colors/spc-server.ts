import "server-only";
import { geoPath } from "@/lib/map/geo";
import type { Geometry } from "@/lib/map/geo";
import { pick, type Colors } from "./registry";
import {
  KIND_TITLE,
  PROB_STEPS,
  SPC_PALETTES,
  kindFor,
  levelIndex,
  probStep,
  type Hazard,
} from "./spc";

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
type Feat = {
  properties: { LABEL?: string; VALID?: string; EXPIRE?: string };
  geometry: Geometry;
};

/** Which SPC file draws a day and hazard (VIP's buildProduct). */
export function productFor(day: number, hazard: Hazard) {
  if (day >= 4) return `exper/day4-8/day${day}prob`;
  if (day === 3)
    return hazard === "cat" ? "outlook/day3otlk_cat" : "outlook/day3otlk_prob";
  return `outlook/day${day}otlk_${hazard}`;
}

export async function spcFeatures(path: string): Promise<Feat[]> {
  const r = await fetch(
    `https://www.spc.noaa.gov/products/${path}.nolyr.geojson`,
    {
      headers: UA,
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw new Error(`SPC ${r.status}`);
  return ((await r.json()) as { features?: Feat[] }).features ?? [];
}

const spcTime = (v?: string) =>
  v && /^\d{12}$/.test(v)
    ? `${new Date(`${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} ${v.slice(8, 10)}Z`
    : null;
const validOf = (f: Feat[]) => {
  const p = f[0]?.properties;
  return p?.VALID ? `${spcTime(p.VALID)} – ${spcTime(p.EXPIRE)}` : null;
};

/**
 * One SPC outlook map in VIP's palette (with admin overrides). Hazards and
 * intensity exist for Days 1–2; Day 3 is categorical; Days 4–8 are
 * probabilistic, drawn on the categorical ramp at SPC's own cut points.
 */
export async function outlookLayer(
  day: number,
  hazard: Hazard,
  intensity: boolean,
  colors: Colors,
) {
  const hz: Hazard = day <= 2 ? hazard : "cat";
  const intense = intensity && day <= 2 && hz !== "cat";
  const feats = await spcFeatures(productFor(day, hz));
  const kind = kindFor(hz, intense);
  const pal = SPC_PALETTES[kind].map((l, i) => ({
    ...l,
    color: pick(colors, `spc:${kind}:${i}`, l.color),
  }));
  let top = -1;
  const polys: { c: string; d: string; sig: boolean; i: number }[] = [];
  for (const f of feats) {
    const label = String(f.properties.LABEL ?? "");
    const step = day >= 4 ? probStep(label, true) : null;
    const idx =
      day >= 4
        ? step === null
          ? null
          : step - 1
        : levelIndex(hz, intense, label);
    if (idx === null) continue;
    const d = geoPath(f.geometry);
    if (!d) continue;
    top = Math.max(top, idx);
    polys.push({
      c: pal[idx]?.color ?? "#888888",
      d,
      sig: intense && idx >= 1,
      i: idx,
    });
  }
  polys.sort((a, b) => a.i - b.i);
  return {
    title: `${KIND_TITLE[kind]} · Day ${day}`,
    valid: validOf(feats),
    polys: polys.map(({ c, d, sig }) => ({ c, d, sig })),
    legend: pal.map((l) => ({ label: l.label, color: l.color })),
    top: top >= 0 ? pal[top].label : null,
  };
}

/** VIP's severe probability map for a day: Days 1–3 categorical, 4–8 probabilistic. */
export async function probabilityLayer(day: number, colors: Colors) {
  const prob = day >= 4;
  const feats = await spcFeatures(
    prob ? `exper/day4-8/day${day}prob` : `outlook/day${day}otlk_cat`,
  );
  const steps = PROB_STEPS.map((s) => ({
    ...s,
    color: pick(colors, `prob:${s.level}`, s.color),
  }));
  let top = 0;
  const polys: { c: string; d: string; o: number; s: number }[] = [];
  for (const f of feats) {
    const s = probStep(String(f.properties.LABEL ?? ""), prob);
    if (s === null) continue;
    const d = geoPath(f.geometry);
    if (!d) continue;
    top = Math.max(top, s);
    polys.push({ c: steps[s - 1].color, d, o: steps[s - 1].opacity, s });
  }
  polys.sort((a, b) => a.s - b.s);
  return {
    valid: validOf(feats),
    polys: polys.map(({ c, d, o }) => ({ c, d, o })),
    steps,
    top,
  };
}

/** Is a lon/lat point inside a (Multi)Polygon? Ray casting on each ring, holes respected. */
export function inside(g: Geometry, lon: number, lat: number): boolean {
  const polys: number[][][][] =
    g.type === "Polygon"
      ? [(g as { coordinates: number[][][] }).coordinates]
      : g.type === "MultiPolygon"
        ? (g as { coordinates: number[][][][] }).coordinates
        : [];
  const inRing = (ring: number[][]) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      )
        c = !c;
    }
    return c;
  };
  return polys.some((p) => inRing(p[0]) && !p.slice(1).some(inRing));
}

/** The probability-scale step (0–5) at one place for each of Days 1–8. */
export async function stepsAt(lat: number, lon: number) {
  return Promise.all(
    [1, 2, 3, 4, 5, 6, 7, 8].map(async (day) => {
      try {
        const prob = day >= 4;
        const feats = await spcFeatures(
          prob ? `exper/day4-8/day${day}prob` : `outlook/day${day}otlk_cat`,
        );
        let s = 0;
        for (const f of feats) {
          const v = probStep(String(f.properties.LABEL ?? ""), prob);
          if (v !== null && v > s && inside(f.geometry, lon, lat)) s = v;
        }
        return { day, step: s };
      } catch {
        return { day, step: null };
      }
    }),
  );
}
