import "server-only";
import TORNADO from "./tornado.json";
import HURRICANE from "./hurricane.json";
import { project } from "@/lib/map/usAlbers";

/**
 * Climatology queries over the records built by scripts/build-climo.py (SPC tornado
 * database, NHC HURDAT2) plus NASA's LIS lightning climatology read from GIBS tiles.
 */
const R = 3958.8;
const RAD = Math.PI / 180;

/** Miles from a point to a segment, on a local flat projection (fine at these scales). */
function segMiles(
  lat: number,
  lon: number,
  a: [number, number],
  b: [number, number],
) {
  const k = Math.cos(lat * RAD) * RAD * R;
  const ax = (a[1] - lon) * k;
  const ay = (a[0] - lat) * RAD * R;
  const bx = (b[1] - lon) * k;
  const by = (b[0] - lat) * RAD * R;
  const dx = bx - ax;
  const dy = by - ay;
  const t =
    dx || dy
      ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
      : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function tornadoSummary() {
  const { pts: _pts, ...rest } = TORNADO;
  void _pts;
  return rest;
}

type Twister = {
  s: [number, number];
  e: [number, number];
  ef: number;
  date: string;
  dead: number;
  hurt: number;
  st: string;
};
let twisters: Twister[] | null = null;

function allTwisters() {
  return (twisters ??= TORNADO.pts.split(";").map((p) => {
    const [a, b, c, d, ef, date, dead, hurt, st] = p.split(",");
    return {
      s: [+a / 100, +b / 100],
      e: [+c / 100, +d / 100],
      ef: +ef,
      date,
      dead: +dead,
      hurt: +hurt,
      st,
    };
  }));
}

/**
 * Every track rated `min` or stronger since `since`, projected onto the national map
 * (x1,y1,x2,y2,ef), weakest first so violent tracks draw on top.
 */
export function tornadoTracks(min: number, since: number) {
  return allTwisters()
    .filter((t) => t.ef >= min && +t.date.slice(0, 4) >= since)
    .sort((a, b) => a.ef - b.ef)
    .map((t) => {
      const a = project(t.s[1], t.s[0]);
      const b = project(t.e[1], t.e[0]);
      const r = (v: number) => Math.round(v * 10) / 10;
      return [r(a.x), r(a.y), r(b.x), r(b.y), t.ef];
    });
}

/** Every tornado track passing within `miles` of a place since 1950. */
export function tornadoNear(lat: number, lon: number, miles = 25) {
  const box = miles / 60;
  const hits = allTwisters().filter(
    (t) =>
      Math.abs(t.s[0] - lat) < box + 2 &&
      Math.abs(t.s[1] - lon) < box / Math.cos(lat * RAD) + 2 &&
      segMiles(lat, lon, t.s, t.e) <= miles,
  );
  const months = new Array(12).fill(0);
  const decades: Record<string, number> = {};
  for (const t of hits) {
    months[+t.date.slice(4, 6) - 1]++;
    const dec = `${t.date.slice(0, 3)}0s`;
    decades[dec] = (decades[dec] ?? 0) + 1;
  }
  const strongest = [...hits]
    .sort(
      (a, b) => b.ef - a.ef || b.dead - a.dead || b.date.localeCompare(a.date),
    )
    .slice(0, 5);
  return {
    miles,
    years: TORNADO.last - TORNADO.first + 1,
    count: hits.length,
    sig: hits.filter((t) => t.ef >= 2).length,
    violent: hits.filter((t) => t.ef >= 4).length,
    dead: hits.reduce((n, t) => n + t.dead, 0),
    hurt: hits.reduce((n, t) => n + t.hurt, 0),
    months,
    decades,
    recent: hits.reduce<Twister | null>(
      (m, t) => (!m || t.date > m.date ? t : m),
      null,
    ),
    strongest,
  };
}

export function hurricaneSummary() {
  const { tracks: _t, ...rest } = HURRICANE;
  void _t;
  return rest;
}

type Storm = {
  basin: string;
  name: string;
  year: number;
  pts: { lat: number; lon: number; kt: number; land: boolean; md: string }[];
};
let storms: Storm[] | null = null;

function allStorms() {
  return (storms ??= HURRICANE.tracks.split("\n").map((line) => {
    const [basin, name, year, pts] = line.split("|");
    return {
      basin,
      name,
      year: +year,
      pts: pts.split(";").map((p) => {
        const [a, b, kt, land, md] = p.split(",");
        return { lat: +a / 10, lon: +b / 10, kt: +kt, land: land === "1", md };
      }),
    };
  }));
}

/**
 * Every major hurricane's track (peak Cat 3+) as GeoJSON lines, split into runs of one
 * Saffir–Simpson tier so the map colors each stretch by its strength at the time.
 */
export function majorTracks() {
  const features = [];
  for (const st of allStorms()) {
    if (Math.max(...st.pts.map((p) => p.kt)) < 96) continue;
    const tier = (kt: number) =>
      kt < 34
        ? 0
        : kt < 64
          ? 1
          : kt < 83
            ? 2
            : kt < 96
              ? 3
              : kt < 113
                ? 4
                : kt < 137
                  ? 5
                  : 6;
    let run: [number, number][] = [];
    let t = -1;
    for (const p of st.pts) {
      const k = tier(p.kt);
      if (k !== t && run.length) {
        run.push([p.lon > 0 ? p.lon - 360 : p.lon, p.lat]);
        features.push(line(st, t, run));
        run = [];
      }
      t = k;
      // Keep the line continuous across 180° (Central Pacific storms) instead of wrapping.
      run.push([p.lon > 0 ? p.lon - 360 : p.lon, p.lat]);
    }
    if (run.length > 1) features.push(line(st, t, run));
  }
  return { type: "FeatureCollection", features };
}
const TIERS = ["TD", "TS", "C1", "C2", "C3", "C4", "C5"];
function line(st: Storm, t: number, coordinates: [number, number][]) {
  return {
    type: "Feature",
    properties: { tier: TIERS[t], name: st.name, year: st.year, t },
    geometry: { type: "LineString", coordinates },
  };
}

/** Every tropical storm or hurricane passing within `miles` of a place since 1950. */
export function hurricaneNear(lat: number, lon: number, miles = 60) {
  const storms = allStorms();
  type Pass = {
    name: string;
    year: number;
    basin: string;
    kt: number;
    md: string;
  };
  const passes: Pass[] = [];
  for (const s of storms) {
    let best: Pass | null = null;
    for (let i = 0; i < s.pts.length; i++) {
      const a = s.pts[i];
      const b = s.pts[Math.min(i + 1, s.pts.length - 1)];
      if (Math.abs(a.lat - lat) > 6 || Math.abs(a.lon - lon) > 8) continue;
      if (segMiles(lat, lon, [a.lat, a.lon], [b.lat, b.lon]) > miles) continue;
      const kt = Math.max(a.kt, i + 1 < s.pts.length ? b.kt : 0);
      if (!best || kt > best.kt)
        best = { name: s.name, year: s.year, basin: s.basin, kt, md: a.md };
    }
    if (best && best.kt >= 34) passes.push(best);
  }
  const months = new Array(12).fill(0);
  for (const p of passes) months[+p.md.slice(0, 2) - 1]++;
  return {
    miles,
    years: HURRICANE.last - HURRICANE.first + 1,
    count: passes.length,
    hurricanes: passes.filter((p) => p.kt >= 64).length,
    majors: passes.filter((p) => p.kt >= 96).length,
    months,
    recent: passes.reduce<Pass | null>(
      (m, p) =>
        !m || p.year > m.year || (p.year === m.year && p.md > m.md) ? p : m,
      null,
    ),
    strongest: [...passes]
      .sort((a, b) => b.kt - a.kt || b.year - a.year)
      .slice(0, 6),
  };
}
