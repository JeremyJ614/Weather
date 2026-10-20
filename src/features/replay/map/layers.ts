import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
} from "maplibre-gl";
// @types/geojson declares a module rather than a global namespace, so the
// types are imported rather than assumed to be ambient.
import type { Feature, FeatureCollection } from "geojson";
import type { PreparedTornado } from "@/features/replay/core/chase";
import {
  hailName,
  tornadoPositionAt,
  widthAt,
} from "@/features/replay/core/chase";
import { PAL, rgba } from "@/features/replay/palette";
import { EF_ORDER } from "@/features/replay/core/chase";
import { haversine } from "@/features/replay/core/geo";
import { proximityOf } from "./funnels/lifecycle";
import { lookAt } from "./warnings";
import { Reveal } from "./reveal";
import type { Replayable } from "./replayable";

/**
 * The data layers over the basemap.
 *
 * Three kinds of work, kept strictly apart because mixing them is what broke
 * the map (#22, #8):
 *
 *   `ensureLayers`  creates sources and layers that are missing. It never
 *                   touches the data in a source that already exists.
 *   `ReplayLayers.attach`  sets the data that belongs to a whole replay —
 *                   paths, swaths, contours, every damage point, every hail
 *                   report, every warning — once, when the replay opens or a
 *                   basemap swap has thrown the sources away.
 *   `ReplayLayers.frame`  runs per frame and moves only what moves: the
 *                   chaser, the funnels' ground marks, the trail. Things that
 *                   appear on the clock are revealed through feature state,
 *                   which re-tiles nothing.
 *
 * The old code did all three on every frame. Its "create or refresh" helper
 * set each dynamic source back to an empty collection and then refilled it,
 * so the worker spent every frame re-tiling a thousand damage points that
 * were then thrown away — on a phone they never appeared at all, and hail and
 * warnings blinked as each rebuild landed.
 */

export const SRC = {
  track: "chase-track",
  trackDone: "chase-track-done",
  paths: "tornado-paths",
  swaths: "tornado-swaths",
  live: "tornado-live",
  chaser: "chaser",
  proximity: "proximity-ring",
  trail: "chase-trail",
  warns: "warning-polygons",
  contours: "damage-contours",
  damage: "damage-points",
  hail: "hail-reports",
  photos: "chase-photos",
  fields: "wind-fields",
} as const;

const empty = () => ({ type: "FeatureCollection" as const, features: [] });

/** The screen's pixel density, capped at 2 — and 1 where there is no screen. */
const pixelRatio = () =>
  Math.min(
    2,
    (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1,
  );

/** Metres of one degree of longitude at a latitude — for drawing width to scale. */
const metresPerDegreeLon = (lat: number) =>
  111_320 * Math.cos((lat * Math.PI) / 180);
const METRES_PER_YARD = 0.9144;

/**
 * The damage swath as polygons, to scale.
 *
 * A tornado's width is survey data and belongs on the map at its real size —
 * a 1,760-yard wedge and a 50-yard rope are not the same object, and drawing
 * both as a line says they are. And it is not one width: where the research
 * gives the width vertex by vertex, the swath expands and contracts with it,
 * so El Reno balloons to 2.6 miles and back and Jarrell's path widens as it
 * slows. Where the survey rated the path in segments, each segment is its own
 * polygon in its own rating's colour — Jarrell's EF1 start is not its EF5 end.
 */
function swathFor(t: PreparedTornado): Feature[] {
  const n = t.coords.length;
  if (n < 2) return [];
  const widths = t.widths && t.widths.length === n ? t.widths : null;
  if (!widths && t.widthYd <= 0) return [];

  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < n; i += 1) {
    const [lon, lat] = t.coords[i]!;
    const halfM = ((widths ? widths[i]! : t.widthYd) * METRES_PER_YARD) / 2;
    // Perpendicular to the local heading, which is what a swath follows.
    const prev = t.coords[Math.max(0, i - 1)]!;
    const next = t.coords[Math.min(n - 1, i + 1)]!;
    const dx = (next[0] - prev[0]) * metresPerDegreeLon(lat);
    const dy = (next[1] - prev[1]) * 110_574;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const dLon = (nx * halfM) / metresPerDegreeLon(lat);
    const dLat = (ny * halfM) / 110_574;
    left.push([lon + dLon, lat + dLat]);
    right.push([lon - dLon, lat - dLat]);
  }

  // Runs of one rating. Without per-vertex ratings the whole path is one run.
  const ratings = t.ratings && t.ratings.length === n ? t.ratings : null;
  const runs: [number, number, string][] = [];
  let from = 0;
  for (let i = 1; i <= n; i += 1) {
    const here = ratings ? ratings[from]! : t.ef;
    if (i === n || (ratings && ratings[i] !== here)) {
      // Share the boundary vertex so neighbouring segments meet with no gap.
      runs.push([from, Math.min(i, n - 1), here]);
      from = i;
    }
  }

  const out: Feature[] = [];
  for (const [a, b, ef] of runs) {
    if (b <= a) continue;
    const l = left.slice(a, b + 1);
    const r = right.slice(a, b + 1).reverse();
    out.push({
      type: "Feature",
      properties: {
        ef,
        name: t.name,
        colour: PAL.ef[ef] ?? PAL.ef[t.ef] ?? PAL.ef.EFU,
        rank: EF_ORDER[ef] ?? -1,
      },
      geometry: { type: "Polygon", coordinates: [[...l, ...r, l[0]!]] },
    });
  }
  return out;
}

export function pathsGeoJson(r: Replayable): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: r.tornadoes.map((t) => ({
      type: "Feature" as const,
      properties: {
        ef: t.ef,
        name: t.name,
        index: t.index,
        colour: PAL.ef[t.ef] ?? PAL.ef.EFU,
        widthYd: t.widthYd,
        fatalities: t.fatalities,
      },
      geometry: { type: "LineString" as const, coordinates: t.coords },
    })),
  };
}

/**
 * The damage swath.
 *
 * Where the survey drew contours, those are the swath — the actual shape the
 * damage took, nested by rating, which is the finding. The computed rectangle
 * below it is only used for tornadoes with no surveyed contour, and it is a
 * summary that is wrong everywhere except at the widest point.
 */
export function swathsGeoJson(r: Replayable): FeatureCollection {
  const surveyed = new Set(r.contours.map((c) => c.t));
  return {
    type: "FeatureCollection",
    features: r.tornadoes
      .filter((t) => !surveyed.has(t.index))
      .flatMap(swathFor),
  };
}

/**
 * The surveyed EF contours.
 *
 * Drawn strongest last so the higher ratings sit on top of the envelopes that
 * contain them — a survey nests an EF3 core inside an EF2 inside an EF1, and
 * drawing them in payload order would bury the part that matters.
 */
export function contoursGeoJson(r: Replayable): FeatureCollection {
  const ordered = [...r.contours].sort(
    (a, b) => (EF_ORDER[a.ef] ?? -1) - (EF_ORDER[b.ef] ?? -1),
  );
  return {
    type: "FeatureCollection",
    features: ordered.map((c) => ({
      type: "Feature" as const,
      properties: {
        ef: c.ef,
        t: c.t,
        colour: PAL.ef[c.ef] ?? PAL.ef.EFU,
        rank: EF_ORDER[c.ef] ?? -1,
      },
      geometry: { type: "Polygon" as const, coordinates: [c.ring] },
    })),
  };
}

/**
 * When a tornado reached a point, in replay seconds.
 *
 * The point is projected onto the surveyed centreline and the distance along
 * it converted to time the same way the funnel is moved — by distance, at the
 * tornado's surveyed average speed — so a damage point appears exactly as the
 * funnel's centre passes abeam of it, not when the nearest vertex does. On an
 * archive track with a vertex every few miles, nearest-vertex was minutes out.
 */
export function reachedAt(
  t: PreparedTornado,
  lon: number,
  lat: number,
): number {
  const span = Math.max(1, t.end - t.start);
  if (t.coords.length < 2 || t.lengthM <= 0) return t.start;
  // Local equirectangular frame: exact enough over one tornado's length, and
  // the only thing it decides is which segment is nearest.
  const kx = Math.cos((lat * Math.PI) / 180);
  let bestD = Infinity;
  let bestAlong = 0;
  for (let i = 1; i < t.coords.length; i += 1) {
    const [ax, ay] = t.coords[i - 1]!;
    const [bx, by] = t.coords[i]!;
    const dx = (bx - ax) * kx;
    const dy = by - ay;
    const px = (lon - ax) * kx;
    const py = lat - ay;
    const len2 = dx * dx + dy * dy;
    const g =
      len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
    const ex = px - g * dx;
    const ey = py - g * dy;
    const d = ex * ex + ey * ey;
    if (d < bestD) {
      bestD = d;
      const segM = (t.cum[i] ?? 0) - (t.cum[i - 1] ?? 0);
      bestAlong = (t.cum[i - 1] ?? 0) + g * segM;
    }
  }
  return t.start + (bestAlong / t.lengthM) * span;
}

/**
 * Every damage point of the survey, each with the moment it appears.
 *
 * The whole survey goes into the source once. Which points are showing is
 * decided per frame by feature state (see `Reveal`), because re-tiling a
 * thousand points sixty times a second is what made them never appear.
 * The feature id is the index into `reveal`, which is what feature state keys on.
 */
export function damageCollection(r: Replayable): {
  fc: FeatureCollection;
  reveal: number[];
} {
  const features: Feature[] = [];
  const reveal: number[] = [];
  for (const [lat, lon, ef, wind, what, degree, ti] of r.damage) {
    const t = r.tornadoes[ti];
    const id = features.length;
    // With no tornado to tie it to, show it from the start: it is still a
    // surveyed point, and hiding it would say it is not.
    reveal.push(t ? reachedAt(t, lon, lat) : Number.NEGATIVE_INFINITY);
    features.push({
      type: "Feature",
      id,
      properties: {
        ef,
        wind,
        what,
        degree,
        t: ti,
        colour: PAL.ef[ef] ?? PAL.ef.EFU,
        // Surveyed wind carries the size, so an EF3 point reads louder than
        // an EF0 one at any zoom — the rating is the finding.
        rank: EF_ORDER[ef] ?? -1,
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }
  return { fc: { type: "FeatureCollection", features }, reveal };
}

/**
 * The damage points as they stand at one instant — the brute-force answer.
 *
 * Not used to draw: the map reveals the collection above through feature
 * state. Kept because it is the definition the reveal is tested against.
 */
export function damageGeoJson(r: Replayable, at: number): FeatureCollection {
  const { fc, reveal } = damageCollection(r);
  return {
    type: "FeatureCollection",
    features: fc.features.filter((_, i) => at >= reveal[i]!),
  };
}

/**
 * The ice ramp, and why it has no hue.
 *
 * Every hue is already spoken for. The EF scale runs cyan, green, yellow,
 * coral, red, violet and beige — that is the whole circle — so a blue hail dot
 * collides with EF0 and a violet one collides with EF5, measurably: the
 * closest cool ramp I could find still sat at ΔE 4.9 from EF0 under protanopia.
 *
 * So hail does not compete for a hue. It is the one thing on this map with no
 * chroma at all, which is the strongest separation available and the only one
 * colour blindness cannot erase — no form of CVD adds chroma to a grey. Its
 * identity comes from shape instead: a hollow ring, where damage points are
 * filled dots and nothing else on the map is a ring. Its magnitude comes from
 * radius, which for a hailstone is not a convention at all — it is the
 * measurement, drawn at size.
 *
 * Please do not "fix" this into a colour. It was a colour twice and both
 * versions failed the check.
 */

/**
 * Hail reports, arriving on the clock as they were called in.
 *
 * Laying the whole day's reports out at t=0 would say the hail fell all at
 * once, which is exactly backwards: the interesting thing about a hail plot on
 * a replay is watching the core lay a line of stones across the map at the
 * speed the storm moved. So each report appears at the minute it was logged.
 *
 * They do not expire. A hailstone that fell an hour ago is still on the ground
 * an hour later, and — more to the point — the accumulated line is the shape
 * of the storm's path, which is the thing worth seeing.
 *
 * Like the damage points, the whole day goes into the source once and the
 * clock reveals it through feature state.
 */
export function hailCollection(r: Replayable): {
  fc: FeatureCollection;
  reveal: number[];
} {
  const features: Feature[] = [];
  const reveal: number[] = [];
  for (const [t, lat, lon, inches, place, source, remark] of r.hail) {
    const id = features.length;
    reveal.push(t);
    features.push({
      type: "Feature",
      id,
      properties: {
        in: inches,
        name: hailName(inches),
        place,
        source,
        remark,
        at: t,
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }
  return { fc: { type: "FeatureCollection", features }, reveal };
}

/** The hail on the ground at one instant — the definition the reveal is tested against. */
export function hailGeoJson(r: Replayable, at: number): FeatureCollection {
  const { fc, reveal } = hailCollection(r);
  return {
    type: "FeatureCollection",
    features: fc.features.filter((_, i) => at >= reveal[i]!),
  };
}

export interface PhotoPin {
  id: string;
  at: number | null;
  lat: number | null;
  lon: number | null;
}

/**
 * Photo pins, where the reader has asked for them.
 *
 * A pin appears once the clock has reached the moment it was taken, like the
 * damage points, so the pictures accumulate along the route behind you rather
 * than being laid out in advance. An untimed photo has no moment to wait for
 * and is shown from the start.
 */
export function photosCollection(pins: readonly PhotoPin[]): {
  fc: FeatureCollection;
  reveal: number[];
} {
  const features: Feature[] = [];
  const reveal: number[] = [];
  for (const p of pins) {
    if (p.lat === null || p.lon === null) continue;
    const id = features.length;
    reveal.push(p.at ?? Number.NEGATIVE_INFINITY);
    features.push({
      type: "Feature",
      id,
      properties: { id: p.id },
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    });
  }
  return { fc: { type: "FeatureCollection", features }, reveal };
}

/** Seconds a photo pin takes to fade up. */
export const PHOTO_FADE = 20;

/** The pins showing at one instant, with their fade — the definition the reveal is tested against. */
export function photosGeoJson(
  pins: readonly PhotoPin[],
  at: number,
): FeatureCollection {
  const { fc, reveal } = photosCollection(pins);
  const features: Feature[] = [];
  fc.features.forEach((f, i) => {
    const t = reveal[i]!;
    if (Number.isFinite(t) && at < t) return;
    const age = Number.isFinite(t) ? Math.min(1, (at - t) / PHOTO_FADE) : 1;
    features.push({ ...f, properties: { ...f.properties, age } });
  });
  return { type: "FeatureCollection", features };
}

/** Where each tornado on the ground is right now. */
export function liveGeoJson(r: Replayable, at: number): FeatureCollection {
  const features: Feature[] = [];
  for (const t of r.tornadoes) {
    if (at < t.start || at > t.end) continue;
    const [lat, lon] = tornadoPositionAt(t, at);
    features.push({
      type: "Feature",
      properties: {
        ef: t.ef,
        name: t.name,
        index: t.index,
        colour: PAL.ef[t.ef] ?? PAL.ef.EFU,
        // Radius in metres, so the mark can be drawn to scale — at the width
        // the tornado was *here*, not the widest it ever got.
        radiusM: Math.max(60, (widthAt(t, at) * METRES_PER_YARD) / 2),
        age: (at - t.start) / Math.max(1, t.end - t.start),
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * The ring around the chaser, sized by how near the nearest tornado is.
 *
 * It pulses faster the closer that is, because a ring that always looks the
 * same is decoration. Nothing to show when there is no chaser, or when
 * everything is comfortably far away.
 */
export function proximityGeoJson(
  r: Replayable,
  at: number,
  clock = at,
): FeatureCollection {
  const here = r.track?.positionAt(at);
  if (!here) return empty();

  let nearest = Infinity;
  for (const t of r.tornadoes) {
    if (at < t.start || at > t.end) continue;
    const [lat, lon] = tornadoPositionAt(t, at);
    nearest = Math.min(nearest, haversine(here.lat, here.lon, lat, lon));
  }
  if (!Number.isFinite(nearest)) return empty();

  const level = proximityOf(nearest);
  if (level === "safe") return empty();

  // Faster and more insistent the closer it gets.
  const rate = level === "imminent" ? 2.6 : level === "close" ? 1.5 : 0.8;
  // Timed by `clock` — real time on the map — so it pulses at the same pace
  // at any replay speed instead of strobing at the fast ones (#8).
  const pulse = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(clock * rate));

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          radiusM: nearest,
          colour: PAL.prox[level] ?? PAL.prox.close,
          level,
          pulse,
        },
        geometry: { type: "Point", coordinates: [here.lon, here.lat] },
      },
    ],
  };
}

/**
 * Wind fields wider than the damage (Mulhall's 4.4 miles).
 *
 * Set once; whether one is showing is feature state, because it is shown only
 * while the tornado was at the strength the radar measured.
 */
export function fieldsCollection(r: Replayable): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (r.fields ?? []).map((f, id) => {
      const t = r.tornadoes[f.t];
      return {
        type: "Feature" as const,
        id,
        properties: {
          label: f.label,
          note: f.note,
          widthMi: f.widthMi,
          colour: t ? (PAL.ef[t.ef] ?? "#c9b8f0") : "#c9b8f0",
        },
        geometry: { type: "Polygon" as const, coordinates: [f.ring] },
      };
    }),
  };
}

/** Seconds a wind field takes to fade in and out at the ends of its window. */
export const FIELD_FADE = 90;

/** How strongly a wind field shows at an instant: 1 inside its window, easing at the edges. */
export function fieldStrength(
  f: { from: number; to: number },
  at: number,
): number {
  if (at < f.from - FIELD_FADE || at > f.to + FIELD_FADE) return 0;
  if (at < f.from) return (at - (f.from - FIELD_FADE)) / FIELD_FADE;
  if (at > f.to) return 1 - (at - f.to) / FIELD_FADE;
  return 1;
}

/**
 * Every warning polygon of the replay, in one collection set once.
 *
 * The breathing (Z3 #16) is per-frame, but it is a change of opacity, not of
 * shape — so it is written as feature state on the polygons that are live,
 * and the collection itself never moves. The colour is the kind's and never
 * changes, so it rides along as a property.
 */
export function warningsCollection(r: Replayable): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: r.warnings.map((w, id) => ({
      type: "Feature" as const,
      id,
      properties: {
        kind: w.kind,
        label: w.label,
        wfo: w.wfo,
        where: w.where ?? "",
        colour: lookAt(w.from, w).colour,
      },
      geometry: { type: "Polygon" as const, coordinates: [w.ring] },
    })),
  };
}

/**
 * The warning polygons as they look at one instant.
 *
 * Not used to draw — the map writes the same numbers as feature state — but
 * it is the definition of what each frame should show, and what the tests
 * pin down. Polygons that are pending or gone are left out.
 */
export function warningsGeoJson(r: Replayable, at: number): FeatureCollection {
  const features: Feature[] = [];
  for (const w of r.warnings) {
    const look = lookAt(at, w);
    if (look.state === "pending" || look.state === "gone") continue;
    features.push({
      type: "Feature",
      properties: {
        kind: w.kind,
        label: w.label,
        wfo: w.wfo,
        where: w.where ?? "",
        state: look.state,
        colour: look.colour,
        fill: look.fill,
        line: look.line,
        width: look.width,
      },
      geometry: { type: "Polygon", coordinates: [w.ring] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * The condensation trail behind the route (Z3 #12).
 *
 * The driven track is a flat line: correct, and silent about which way the
 * chaser was going. This is the last few miles of it, drawn as a gradient that
 * runs from transparent at the tail to full accent at the playhead, so motion
 * direction reads without an arrow, a label, or an animation.
 *
 * Measured in metres along the ground rather than in track points, because
 * points are sampled by the logger and bunch up wherever the chaser stopped —
 * a fixed number of them would make the trail long in traffic and short at
 * highway speed, which is exactly backwards.
 */
export const TRAIL_METRES = 4800; // about three miles
/** Below this there is no direction to read, so no trail is drawn. */
export const MIN_TRAIL_METRES = 25;

export function trailGeoJson(r: Replayable, at: number): FeatureCollection {
  const track = r.track;
  if (!track || track.n === 0) return empty();

  const head = track.positionAt(at);
  const coords: [number, number][] = [[head.lon, head.lat]];
  let run = 0;
  let prevLat = head.lat;
  let prevLon = head.lon;

  for (let i = track.indexAt(at); i >= 0; i -= 1) {
    const lat = track.lat[i]!;
    const lon = track.lon[i]!;
    const leg = haversine(prevLat, prevLon, lat, lon);
    // A logger parked at a gas station writes hundreds of fixes in the same
    // spot. Keeping them would put hundreds of coincident vertices in the line
    // for no length, which is work the GPU does for nothing.
    if (leg < 1) continue;
    run += leg;
    if (run > TRAIL_METRES) break;
    coords.push([lon, lat]);
    prevLat = lat;
    prevLon = lon;
  }

  /**
   * A trail needs length, not just two points.
   *
   * At the first instant of a replay — and any time the chaser has been
   * stopped longer than the trail is long — the head and the most recent fix
   * are the same place. That is a zero-length line, and `line-progress` on a
   * zero-length line is undefined: MapLibre has no distance to interpolate the
   * gradient along, so the result is a stray blob at the playhead. Below a
   * sane minimum there is simply nothing to say about direction, so say
   * nothing.
   */
  if (coords.length < 2 || run < MIN_TRAIL_METRES) return empty();

  // Tail first: `line-gradient` runs along line-progress 0..1, so the order of
  // the coordinates is what decides which end is bright. Reversed here rather
  // than inverting the gradient stops, because the stops also have to read
  // correctly to anyone editing them.
  coords.reverse();

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { metres: Math.min(run, TRAIL_METRES) },
        geometry: { type: "LineString", coordinates: coords },
      },
    ],
  };
}

/**
 * The whole route, for the current level of detail.
 *
 * Drawn once and left alone: it is the "not driven yet" line, and the driven
 * part is drawn over it. It only changes when the zoom crosses into a
 * different level of simplification — a route never moves, so rebuilding it
 * per frame (as the old split into driven/undriven halves did) was pure cost.
 */
export function trackFullGeoJson(
  r: Replayable,
  zoom: number,
): FeatureCollection {
  const track = r.track;
  if (!track || track.n < 2) return empty();
  const keep = track.forZoom(zoom, track.lat[0] ?? 0, pixelRatio());
  const coords: [number, number][] = [];
  for (let k = 0; k < keep.length; k += 1) {
    const i = keep[k]!;
    coords.push([track.lon[i]!, track.lat[i]!]);
  }
  return {
    type: "FeatureCollection",
    features:
      coords.length > 1
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: coords },
            },
          ]
        : [],
  };
}

/** The driven part of the route, ending exactly at the chaser. */
export function trackDoneGeoJson(
  r: Replayable,
  at: number,
  zoom: number,
): FeatureCollection {
  const track = r.track;
  if (!track || track.n === 0) return empty();
  const keep = track.forZoom(zoom, track.lat[0] ?? 0, pixelRatio());
  const cut = track.indexAt(at);
  const coords: [number, number][] = [];
  for (let k = 0; k < keep.length; k += 1) {
    const i = keep[k]!;
    if (i > cut) break;
    coords.push([track.lon[i]!, track.lat[i]!]);
  }
  // End on the interpolated position so there is no gap at the playhead.
  const here = track.positionAt(at);
  coords.push([here.lon, here.lat]);
  return {
    type: "FeatureCollection",
    features:
      coords.length > 1
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: coords },
            },
          ]
        : [],
  };
}

/** The chaser's dot. */
export function chaserGeoJson(r: Replayable, at: number): FeatureCollection {
  const track = r.track;
  if (!track || track.n === 0) return empty();
  const here = track.positionAt(at);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [here.lon, here.lat] },
      },
    ],
  };
}

/** Feature state, or a default when none has been written yet. */
const state = (key: string, fallback: number) => [
  "coalesce",
  ["feature-state", key],
  fallback,
];

/**
 * Create every source and layer that is missing.
 *
 * Order matters and is deliberate: swaths under paths under the track under
 * the live marks, so a tornado currently on the ground is never hidden behind
 * the ground it has already covered.
 *
 * This never touches the data of a source that exists. That is the whole fix
 * for #22: the old version "refreshed" every source here and was called every
 * frame, so each frame began by emptying the damage, hail and warning sources.
 */
export function ensureLayers(map: MapLibreMap): void {
  const add = (id: string, lineMetrics = false) => {
    if (map.getSource(id)) return;
    map.addSource(id, {
      type: "geojson",
      data: empty(),
      ...(lineMetrics ? { lineMetrics } : {}),
    });
  };

  // Warnings go in first so they land at the bottom of the stack. They are
  // the context the storm happened in, never the subject.
  add(SRC.warns);
  add(SRC.fields);
  add(SRC.swaths);
  add(SRC.contours);
  add(SRC.paths);
  add(SRC.trackDone);
  add(SRC.track);
  add(SRC.live);
  add(SRC.chaser);
  add(SRC.proximity);
  add(SRC.damage);
  add(SRC.hail);
  add(SRC.photos);
  // `lineMetrics` is what makes `line-gradient` possible at all: without it
  // MapLibre has no line-progress to interpolate along, and the gradient is
  // silently ignored.
  add(SRC.trail, true);

  /**
   * Warning polygons that breathe (Z3 #16).
   *
   * Both the fill and the outline read their opacity from feature state,
   * which `ReplayLayers.frame` writes from the replay clock — so a warning in
   * force pulses, and an expired one settles into a still outline that says
   * the danger was here and has passed. Only the live ones are written each
   * frame; the polygons themselves never move.
   */
  if (!map.getLayer("warn-fill")) {
    map.addLayer({
      id: "warn-fill",
      type: "fill",
      source: SRC.warns,
      paint: {
        "fill-color": ["get", "colour"],
        "fill-opacity": state("fill", 0) as never,
      },
    });
  }
  if (!map.getLayer("warn-line")) {
    map.addLayer({
      id: "warn-line",
      type: "line",
      source: SRC.warns,
      layout: { "line-join": "round" },
      paint: {
        "line-color": ["get", "colour"],
        "line-opacity": state("line", 0) as never,
        "line-width": state("width", 0) as never,
      },
    });
  }

  /*
   * The wind field, under the damage it is wider than.
   *
   * Fainter than the swath and outlined with a dash, because it is a
   * different kind of claim — radar-measured wind, not surveyed damage — and
   * the map should never let the two be confused.
   */
  if (!map.getLayer("field-fill")) {
    map.addLayer({
      id: "field-fill",
      type: "fill",
      source: SRC.fields,
      paint: {
        "fill-color": ["get", "colour"],
        "fill-opacity": ["*", 0.09, state("on", 0)] as never,
      },
    });
  }
  if (!map.getLayer("field-line")) {
    map.addLayer({
      id: "field-line",
      type: "line",
      source: SRC.fields,
      layout: { "line-join": "round" },
      paint: {
        "line-color": ["get", "colour"],
        "line-opacity": ["*", 0.7, state("on", 0)] as never,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 13, 2],
        "line-dasharray": [3, 2],
      },
    });
  }

  if (!map.getLayer("swath-fill")) {
    map.addLayer({
      id: "swath-fill",
      type: "fill",
      source: SRC.swaths,
      paint: {
        "fill-color": ["get", "colour"],
        // Low, because this is a large block and the data is the path.
        "fill-opacity": 0.14,
      },
    });
  }

  /*
   * The surveyed contours.
   *
   * Two layers: a fill for the area and a hairline for the boundary, because
   * nested contours at the same fill opacity lose their edges and read as one
   * blurry region. The edge is where the rating changes, which is the most
   * informative line on the map.
   */
  if (!map.getLayer("contour-fill")) {
    map.addLayer({
      id: "contour-fill",
      type: "fill",
      source: SRC.contours,
      paint: {
        "fill-color": ["get", "colour"],
        // Low, and lower for the big outer envelopes, so the strong cores
        // read through the weaker areas that surround them.
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["get", "rank"],
          -1,
          0.1,
          5,
          0.3,
        ],
      },
    });
  }
  if (!map.getLayer("contour-line")) {
    map.addLayer({
      id: "contour-line",
      type: "line",
      source: SRC.contours,
      layout: { "line-join": "round" },
      paint: {
        "line-color": ["get", "colour"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 13, 1.4],
        "line-opacity": 0.55,
      },
    });
  }

  if (!map.getLayer("path-line")) {
    map.addLayer({
      id: "path-line",
      type: "line",
      source: SRC.paths,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "colour"],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          1.5,
          9,
          3,
          14,
          5,
        ],
        "line-opacity": 0.9,
      },
    });
  }

  if (!map.getLayer("track-rest")) {
    map.addLayer({
      id: "track-rest",
      type: "line",
      source: SRC.track,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PAL.track.rest,
        "line-width": 2,
        "line-opacity": 0.55,
      },
    });
  }
  if (!map.getLayer("track-done")) {
    map.addLayer({
      id: "track-done",
      type: "line",
      source: SRC.trackDone,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": PAL.track.done,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2, 12, 3.5],
      },
    });
  }

  /**
   * The condensation trail (Z3 #12).
   *
   * Sits directly on top of the driven track: the track is the record of where
   * the chase went, this is the read of where it is going. Wider than the
   * track and rounded, so it looks like something trailing rather than a
   * second route.
   */
  if (!map.getLayer("track-trail")) {
    map.addLayer({
      id: "track-trail",
      type: "line",
      source: SRC.trail,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 3, 12, 7],
        "line-blur": 1.2,
        // The gradient is the whole feature. It cannot be data-driven — a
        // MapLibre restriction — so the colour is fixed and only the geometry
        // changes per frame.
        "line-gradient": [
          "interpolate",
          ["linear"],
          ["line-progress"],
          0,
          rgba(PAL.track.trail, 0),
          0.45,
          rgba(PAL.track.trail, 0.22),
          0.8,
          rgba(PAL.track.trail, 0.55),
          1,
          rgba(PAL.track.trail, 0.92),
        ],
      },
    });
  }

  if (!map.getLayer("tornado-now")) {
    // Drawn in metres so the mark is the tornado's real size, not a dot that
    // means the same thing whether it is a rope or a two-mile wedge.
    map.addLayer({
      id: "tornado-now",
      type: "circle",
      source: SRC.live,
      paint: {
        // The damage footprint at its real width — an outline, because the
        // funnel above it is what the eye should go to. A filled disc at
        // wedge width swallows the thing it is marking.
        "circle-color": ["get", "colour"],
        "circle-opacity": 0.14,
        "circle-stroke-color": ["get", "colour"],
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.85,
        "circle-radius": [
          "interpolate",
          ["exponential", 2],
          ["zoom"],
          6,
          ["max", 3, ["/", ["get", "radiusM"], 800]],
          14,
          ["max", 6, ["/", ["get", "radiusM"], 6]],
        ],
      },
    });
  }

  /**
   * The proximity ring (Z3 #14).
   *
   * Drawn at a real distance in metres around the chaser, and coloured by how
   * alarming that distance is — it reports, it does not decorate. The radius
   * is the distance to the nearest tornado, so the ring shrinking IS the
   * warning.
   */
  if (!map.getLayer("proximity-ring")) {
    map.addLayer({
      id: "proximity-ring",
      type: "circle",
      source: SRC.proximity,
      paint: {
        "circle-color": "transparent",
        "circle-stroke-color": ["get", "colour"],
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": ["get", "pulse"],
        "circle-radius": [
          "interpolate",
          ["exponential", 2],
          ["zoom"],
          6,
          ["max", 2, ["/", ["get", "radiusM"], 900]],
          14,
          ["max", 8, ["/", ["get", "radiusM"], 7]],
        ],
      },
    });
  }

  /*
   * The survey's damage points.
   *
   * Small and many — over a thousand on a good survey — so they are drawn as
   * plain circles with a dark ring rather than anything clever: at this count
   * the only thing that matters is that individual points stay separable where
   * they cluster, which is what the ring does.
   */
  if (!map.getLayer("damage-point")) {
    map.addLayer({
      id: "damage-point",
      type: "circle",
      source: SRC.damage,
      paint: {
        "circle-color": ["get", "colour"],
        "circle-opacity": ["*", 0.9, state("age", 0)] as never,
        "circle-stroke-color": "#0b0e13",
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9,
          0.4,
          14,
          1,
        ],
        "circle-stroke-opacity": ["*", 0.9, state("age", 0)] as never,
        // A stronger rating is a slightly bigger dot, so the EF3 core of a
        // town reads through the EF0 scatter around it at any zoom.
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          ["+", 1.4, ["*", 0.25, ["max", 0, ["get", "rank"]]]],
          11,
          ["+", 2.6, ["*", 0.4, ["max", 0, ["get", "rank"]]]],
          15,
          ["+", 5, ["*", 0.7, ["max", 0, ["get", "rank"]]]],
        ],
      },
    });
  }

  /**
   * Hail, drawn at the size of the stone.
   *
   * A ring rather than a dot, because nothing else on this map is a ring and
   * because hail is a thing you drive into rather than a thing that happened
   * to a building. The dark translucent core is not decoration: without it a
   * white ring vanishes on a light basemap, where it measures 1.03:1 against
   * the surface.
   *
   * Radius carries the diameter. A penny and a softball differ by a factor of
   * five in reality and by a factor of about four here, which is as close to
   * honest as a map symbol gets before the big ones start swallowing towns.
   */
  if (!map.getLayer("hail-point")) {
    map.addLayer({
      id: "hail-point",
      type: "circle",
      source: SRC.hail,
      paint: {
        "circle-color": "rgba(11,14,19,0.5)",
        "circle-opacity": ["*", 0.9, state("age", 0)] as never,
        "circle-stroke-color": [
          "interpolate",
          ["linear"],
          ["get", "in"],
          0.75,
          PAL.hail.small,
          2.0,
          PAL.hail.mid,
          4.0,
          PAL.hail.big,
        ],
        "circle-stroke-opacity": state("age", 0) as never,
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          1,
          11,
          1.6,
          15,
          2.4,
        ],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          ["interpolate", ["linear"], ["get", "in"], 0.75, 2, 4.5, 5],
          11,
          ["interpolate", ["linear"], ["get", "in"], 0.75, 3.5, 4.5, 11],
          15,
          ["interpolate", ["linear"], ["get", "in"], 0.75, 6, 4.5, 20],
        ],
      },
    });
  }

  /**
   * The pin's icon, drawn rather than shipped.
   *
   * A 24-pixel rounded square with a lighter frame and a dot in the middle:
   * a picture, at the size a map symbol actually gets looked at. Generating
   * it costs nothing, keeps it in step with the theme, and avoids an asset
   * that has to be found, cached and served.
   */
  if (!map.hasImage("photo-pin-icon")) {
    const S = 24;
    const px = new Uint8Array(S * S * 4);
    const put = (
      x: number,
      y: number,
      r: number,
      g: number,
      b: number,
      a: number,
    ) => {
      const o = (y * S + x) * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = b;
      px[o + 3] = a;
    };
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        // Rounded square: inside the box, outside the corner radius.
        const dx = Math.max(3 - x, x - (S - 4), 0);
        const dy = Math.max(3 - y, y - (S - 4), 0);
        const corner = Math.hypot(dx, dy);
        if (x < 2 || y < 2 || x > S - 3 || y > S - 3 || corner > 3) continue;
        const edge = x < 4 || y < 4 || x > S - 5 || y > S - 5;
        const mid = Math.hypot(x - (S - 1) / 2, y - (S - 1) / 2) < 3.2;
        if (edge) put(x, y, 0xe8, 0xe4, 0xdc, 255);
        else if (mid) put(x, y, 0xe8, 0xe4, 0xdc, 235);
        else put(x, y, 0x12, 0x16, 0x1c, 225);
      }
    }
    map.addImage(
      "photo-pin-icon",
      { width: S, height: S, data: px },
      { pixelRatio: 2 },
    );
  }

  /*
   * A photo pin is a square, deliberately.
   *
   * Everything else on this map is round or a line — the chaser, the damage,
   * the hail ring, the proximity ring. A photograph is the one thing on here
   * that a person made rather than the weather, and a different shape says
   * that at any size, including the sizes where colour stops working.
   */
  if (!map.getLayer("photo-pin")) {
    map.addLayer({
      id: "photo-pin",
      type: "symbol",
      source: SRC.photos,
      layout: {
        "icon-image": "photo-pin-icon",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 13, 0.9],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: { "icon-opacity": state("age", 0) as never },
    });
  }

  if (!map.getLayer("chaser-dot")) {
    map.addLayer({
      id: "chaser-dot",
      type: "circle",
      source: SRC.chaser,
      paint: {
        "circle-radius": 6,
        "circle-color": PAL.track.chaser,
        "circle-stroke-color": "#0d1116",
        "circle-stroke-width": 2,
      },
    });
  }
}

/** Warning opacity is written in hundredths; finer is invisible. */
const WARN_Q = 100;
/** Seconds a damage point takes to fade up. */
export const DAMAGE_FADE = 60;
/** Seconds a hail report takes to fade up. */
export const HAIL_FADE = 45;

const setSource = (map: MapLibreMap, id: string, data: FeatureCollection) => {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
};

/**
 * One replay's data on one map.
 *
 * Owns the split described at the top of this file: `attach` once per replay
 * (and again after a basemap swap), `frame` per frame. It remembers what it
 * last wrote so a frame that changes nothing costs nothing — a paused map
 * with the clock ticking at the same instant does no map work at all.
 */
export class ReplayLayers {
  private replay: Replayable | null = null;
  private damage: Reveal | null = null;
  private hail: Reveal | null = null;
  private photos: Reveal | null = null;
  private photosKey = "";
  /** Last fill/line/width written per warning, quantised. */
  private warnWritten: Int32Array = new Int32Array(0);
  /** Last wind-field strength written, in hundredths. */
  private fieldWritten: Int16Array = new Int16Array(0);
  private lastAt = Number.NaN;
  private lastZoom = Number.NaN;

  constructor(private readonly map: MapLibreMap) {}

  /** Whether the map still holds our sources — a style swap removes them. */
  present(): boolean {
    return Boolean(this.map.getSource(SRC.paths));
  }

  /**
   * Put a whole replay on the map.
   *
   * Everything that does not change with the clock is set here and only here.
   * Called when a replay opens and whenever a style swap has taken the sources
   * away; never per frame.
   */
  attach(r: Replayable, pins: readonly PhotoPin[] = []): void {
    const m = this.map;
    ensureLayers(m);
    this.replay = r;

    setSource(m, SRC.swaths, swathsGeoJson(r));
    setSource(m, SRC.contours, contoursGeoJson(r));
    setSource(m, SRC.paths, pathsGeoJson(r));
    setSource(m, SRC.warns, warningsCollection(r));
    setSource(m, SRC.fields, fieldsCollection(r));
    this.fieldWritten = new Int16Array((r.fields ?? []).length).fill(-1);

    const damage = damageCollection(r);
    setSource(m, SRC.damage, damage.fc);
    this.damage = new Reveal(damage.reveal, DAMAGE_FADE);

    const hail = hailCollection(r);
    setSource(m, SRC.hail, hail.fc);
    this.hail = new Reveal(hail.reveal, HAIL_FADE);

    // Feature state belongs to the ids of the last replay; clear it so a
    // point with the same index in this one does not inherit a stale value.
    for (const source of [
      SRC.warns,
      SRC.damage,
      SRC.hail,
      SRC.photos,
      SRC.fields,
    ]) {
      try {
        m.removeFeatureState({ source });
      } catch {
        /* source mid-swap */
      }
    }
    this.warnWritten = new Int32Array(r.warnings.length).fill(-1);

    this.photosKey = "";
    this.setPhotos(pins);

    // Everything per-frame has to be redone against the new data.
    this.lastAt = Number.NaN;
    this.lastZoom = Number.NaN;
  }

  private setPhotos(pins: readonly PhotoPin[]): void {
    const key = pins.map((p) => `${p.id}:${p.at}:${p.lat}:${p.lon}`).join("|");
    if (key === this.photosKey) return;
    this.photosKey = key;
    const photos = photosCollection(pins);
    setSource(this.map, SRC.photos, photos.fc);
    try {
      this.map.removeFeatureState({ source: SRC.photos });
    } catch {
      /* mid-swap */
    }
    this.photos = new Reveal(photos.reveal, PHOTO_FADE);
    this.lastAt = Number.NaN;
  }

  /** Move the replay to one instant. Cheap when little has changed. */
  frame(at: number, pins: readonly PhotoPin[] = []): void {
    const r = this.replay;
    if (!r) return;
    const m = this.map;
    this.setPhotos(pins);

    const zoom = m.getZoom();
    const zoomBucket = Math.round(zoom * 2) / 2;
    const moved = at !== this.lastAt;
    const zoomed = zoomBucket !== this.lastZoom;
    if (!moved && !zoomed) return;

    // The full route only changes with the level of detail.
    if (zoomed) setSource(m, SRC.track, trackFullGeoJson(r, zoomBucket));
    setSource(m, SRC.trackDone, trackDoneGeoJson(r, at, zoomBucket));

    if (moved) {
      setSource(m, SRC.chaser, chaserGeoJson(r, at));
      setSource(m, SRC.live, liveGeoJson(r, at));
      setSource(
        m,
        SRC.proximity,
        proximityGeoJson(r, at, performance.now() / 1000),
      );
      setSource(m, SRC.trail, trailGeoJson(r, at));

      const write = (source: string) => (id: number, age: number) => {
        m.setFeatureState({ source, id }, { age });
      };
      this.damage?.step(at, write(SRC.damage));
      this.hail?.step(at, write(SRC.hail));
      this.photos?.step(at, write(SRC.photos));
      this.stepWarnings(r, at);
      this.stepFields(r, at);
    }

    this.lastAt = at;
    this.lastZoom = zoomBucket;
  }

  /** Show each wind field only while its tornado was at the measured strength. */
  private stepFields(r: Replayable, at: number): void {
    const fields = r.fields ?? [];
    for (let id = 0; id < fields.length; id += 1) {
      const q = Math.round(fieldStrength(fields[id]!, at) * 100);
      if (this.fieldWritten[id] === q) continue;
      this.fieldWritten[id] = q;
      this.map.setFeatureState({ source: SRC.fields, id }, { on: q / 100 });
    }
  }

  /**
   * Breathe the live warnings.
   *
   * Every polygon is looked at — a few dozen trig calls — but only the ones
   * whose look changed are written, which while playing is the handful in
   * force and while paused is none.
   */
  private stepWarnings(r: Replayable, at: number): void {
    const m = this.map;
    for (let id = 0; id < r.warnings.length; id += 1) {
      const look = lookAt(at, r.warnings[id]!, performance.now() / 1000);
      const q =
        Math.round(look.fill * WARN_Q) * 1_000_000 +
        Math.round(look.line * WARN_Q) * 1_000 +
        Math.round(look.width * 10);
      if (this.warnWritten[id] === q) continue;
      this.warnWritten[id] = q;
      m.setFeatureState(
        { source: SRC.warns, id },
        { fill: look.fill, line: look.line, width: look.width },
      );
    }
  }
}

/** Frame everything worth seeing. */
export function fitTo(
  map: MapLibreMap,
  bounds: [number, number, number, number],
): void {
  map.fitBounds(bounds as LngLatBoundsLike, {
    padding: 64,
    duration: 700,
    maxZoom: 11,
  });
}
