import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
} from "maplibre-gl";
// @types/geojson declares a module rather than a global namespace, so the
// types are imported rather than assumed to be ambient.
import type { Feature, FeatureCollection } from "geojson";
import type { PreparedTornado } from "@/features/replay/core/chase";
import { hailName, tornadoPositionAt } from "@/features/replay/core/chase";
import { PAL, rgba } from "@/features/replay/palette";
import { EF_ORDER } from "@/features/replay/core/chase";
import { haversine } from "@/features/replay/core/geo";
import { proximityOf } from "./funnels/lifecycle";
import { lookAt } from "./warnings";
import type { Replayable } from "./replayable";

/**
 * The data layers over the basemap.
 *
 * Every source is GeoJSON updated in place rather than removed and re-added:
 * swapping a source makes MapLibre tear down and rebuild the layers that use
 * it, which flickers and loses the paint state. `setData` on an existing
 * source is what keeps a sixty-frame replay smooth.
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
} as const;

const empty = () => ({ type: "FeatureCollection" as const, features: [] });

/** Metres of one degree of longitude at a latitude — for drawing width to scale. */
const metresPerDegreeLon = (lat: number) =>
  111_320 * Math.cos((lat * Math.PI) / 180);
const METRES_PER_YARD = 0.9144;

/**
 * The damage swath as a polygon, to scale.
 *
 * A tornado's width is survey data and belongs on the map at its real size —
 * a 1,760-yard wedge and a 50-yard rope are not the same object, and drawing
 * both as a line says they are. The polygon is the centreline offset either
 * side by half the surveyed width.
 */
function swathFor(t: PreparedTornado): Feature | null {
  if (t.coords.length < 2 || t.widthYd <= 0) return null;
  const halfM = (t.widthYd * METRES_PER_YARD) / 2;

  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let i = 0; i < t.coords.length; i += 1) {
    const [lon, lat] = t.coords[i]!;
    // Perpendicular to the local heading, which is what a swath follows.
    const prev = t.coords[Math.max(0, i - 1)]!;
    const next = t.coords[Math.min(t.coords.length - 1, i + 1)]!;
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

  return {
    type: "Feature",
    properties: {
      ef: t.ef,
      name: t.name,
      colour: PAL.ef[t.ef] ?? PAL.ef.EFU,
    },
    geometry: {
      type: "Polygon",
      coordinates: [[...left, ...right.reverse(), left[0]!]],
    },
  };
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
      .map(swathFor)
      .filter((f): f is Feature => f !== null),
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
 * The survey's damage points, revealed as the tornado reaches them.
 *
 * A point appears when the tornado that caused it has passed its position, so
 * the damage accumulates behind the funnel rather than being laid out in
 * advance. Watching the ratings climb as it crosses a town is the whole reason
 * to draw them on a clock at all.
 */
export function damageGeoJson(r: Replayable, at: number): FeatureCollection {
  if (r.damage.length === 0) return empty();
  const features: Feature[] = [];

  for (const [lat, lon, ef, wind, what, degree, ti] of r.damage) {
    const t = r.tornadoes[ti];
    // With no tornado to tie it to, show it once the chase reaches its time.
    if (!t) continue;
    if (at < t.start) continue;

    /*
     * When did the tornado reach this point?
     *
     * Interpolating along the surveyed centreline by nearest vertex is
     * accurate enough: these tracks carry a vertex every half mile or so, and
     * the alternative — revealing every point the moment the tornado starts —
     * throws away the thing that makes this worth animating.
     */
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < t.coords.length; i += 1) {
      const c = t.coords[i]!;
      const d = (c[0] - lon) ** 2 + (c[1] - lat) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const f = t.coords.length > 1 ? best / (t.coords.length - 1) : 0;
    const reached = t.start + f * Math.max(1, t.end - t.start);
    if (at < reached) continue;

    features.push({
      type: "Feature",
      properties: {
        ef,
        wind,
        what,
        degree,
        colour: PAL.ef[ef] ?? PAL.ef.EFU,
        // Fades up over a minute so a town does not arrive as a wall of dots.
        age: Math.min(1, (at - reached) / 60),
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }
  return { type: "FeatureCollection", features };
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
 */
export function hailGeoJson(r: Replayable, at: number): FeatureCollection {
  if (r.hail.length === 0) return empty();
  const features: Feature[] = [];

  for (const [t, lat, lon, inches, place, source, remark] of r.hail) {
    if (at < t) continue;
    features.push({
      type: "Feature",
      properties: {
        in: inches,
        name: hailName(inches),
        place,
        source,
        remark,
        at: t,
        // Fades up over three quarters of a minute, so a squall line's worth
        // of reports arrives as weather rather than as a popping sound.
        age: Math.min(1, (at - t) / 45),
      },
      geometry: { type: "Point", coordinates: [lon, lat] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Photo pins, where the reader has asked for them.
 *
 * A pin appears once the clock has reached the moment it was taken, like the
 * damage points, so the pictures accumulate along the route behind you rather
 * than being laid out in advance. An untimed photo has no moment to wait for
 * and is shown from the start.
 */
export function photosGeoJson(
  pins: readonly {
    id: string;
    at: number | null;
    lat: number | null;
    lon: number | null;
  }[],
  at: number,
): FeatureCollection {
  const features: Feature[] = [];
  for (const p of pins) {
    if (p.lat === null || p.lon === null) continue;
    if (p.at !== null && at < p.at) continue;
    features.push({
      type: "Feature",
      properties: {
        id: p.id,
        age: p.at === null ? 1 : Math.min(1, (at - p.at) / 20),
      },
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    });
  }
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
        // Radius in metres, so the mark can be drawn to scale.
        radiusM: Math.max(60, (t.widthYd * METRES_PER_YARD) / 2),
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
export function proximityGeoJson(r: Replayable, at: number): FeatureCollection {
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
  const pulse = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(at * rate));

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
 * The warning polygons, dressed for this instant (Z3 #16).
 *
 * Every property the paint expressions read is computed here rather than in
 * the style, because the pulse depends on the replay clock and a style
 * expression has no access to it. `setData` on one source per frame is the
 * cheap way to animate a fill in MapLibre; the alternative — `setPaintProperty`
 * per polygon per frame — is a style recompile seventy times a second.
 *
 * Polygons that have not been issued yet are left out of the collection
 * entirely rather than drawn at zero opacity, so the map never pays for them.
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

/** The chaser's track, split into driven and not-yet-driven. */
export function trackGeoJson(
  r: Replayable,
  at: number,
  zoom: number,
): {
  done: FeatureCollection;
  rest: FeatureCollection;
  here: FeatureCollection;
} {
  if (!r.track || r.track.n === 0) {
    return { done: empty(), rest: empty(), here: empty() };
  }
  const track = r.track;
  // Simplified for the current zoom: the full track is never thinned, this
  // only decides how much of it is worth drawing.
  const keep = track.forZoom(
    zoom,
    track.lat[0] ?? 0,
    Math.min(2, devicePixelRatio || 1),
  );
  const cut = track.indexAt(at);

  const doneCoords: [number, number][] = [];
  const restCoords: [number, number][] = [];
  for (let k = 0; k < keep.length; k += 1) {
    const i = keep[k]!;
    const pair: [number, number] = [track.lon[i]!, track.lat[i]!];
    if (i <= cut) doneCoords.push(pair);
    else restCoords.push(pair);
  }
  // Join the two halves so there is no gap at the playhead.
  const at_ = track.positionAt(at);
  doneCoords.push([at_.lon, at_.lat]);
  restCoords.unshift([at_.lon, at_.lat]);

  const line = (coords: [number, number][]): FeatureCollection => ({
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
  });

  return {
    done: line(doneCoords),
    rest: line(restCoords),
    here: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { heading: 0 },
          geometry: { type: "Point", coordinates: [at_.lon, at_.lat] },
        },
      ],
    },
  };
}

/**
 * Add every source and layer.
 *
 * Order matters and is deliberate: swaths under paths under the track under
 * the live marks, so a tornado currently on the ground is never hidden behind
 * the ground it has already covered.
 */
export function addLayers(map: MapLibreMap, r: Replayable): void {
  /**
   * Create the source, or refresh it if it is already there.
   *
   * The refresh is the important half and it was missing. These sources hold
   * the parts of a replay that do not change with the clock — the tornado
   * paths, the swaths, the surveyed contours — so they were set once at
   * creation and never again. Opening a different chase therefore left the
   * previous chase's tornado paths drawn over the new one, indefinitely.
   *
   * `setData` on an existing source is cheap and does not tear down the layers
   * that use it, so doing it on every call costs nothing and removes the whole
   * class of bug.
   */
  const add = (id: string, data: FeatureCollection) => {
    const existing = map.getSource(id) as GeoJSONSource | undefined;
    if (existing) existing.setData(data);
    else map.addSource(id, { type: "geojson", data });
  };

  // Warnings go in first so they land at the bottom of the stack. They are
  // the context the storm happened in, never the subject.
  add(SRC.warns, empty());
  add(SRC.swaths, swathsGeoJson(r));
  add(SRC.contours, contoursGeoJson(r));
  add(SRC.paths, pathsGeoJson(r));
  add(SRC.trackDone, empty());
  add(SRC.track, empty());
  add(SRC.live, empty());
  add(SRC.chaser, empty());
  add(SRC.proximity, empty());
  add(SRC.damage, empty());
  add(SRC.hail, empty());
  add(SRC.photos, empty());
  // `lineMetrics` is what makes `line-gradient` possible at all: without it
  // MapLibre has no line-progress to interpolate along, and the gradient is
  // silently ignored.
  if (!map.getSource(SRC.trail)) {
    map.addSource(SRC.trail, {
      type: "geojson",
      data: empty(),
      lineMetrics: true,
    });
  }

  /**
   * Warning polygons that breathe (Z3 #16).
   *
   * Both the fill and the outline read their opacity from the feature, which
   * `updateLayers` recomputes each frame from the replay clock — so a warning
   * in force pulses, and an expired one settles into a still outline that says
   * the danger was here and has passed.
   */
  if (!map.getLayer("warn-fill")) {
    map.addLayer({
      id: "warn-fill",
      type: "fill",
      source: SRC.warns,
      paint: {
        "fill-color": ["get", "colour"],
        "fill-opacity": ["get", "fill"],
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
        "line-opacity": ["get", "line"],
        "line-width": ["get", "width"],
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
        "circle-opacity": ["*", 0.85, ["get", "age"]],
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
        "circle-stroke-opacity": ["*", 0.9, ["get", "age"]],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          1.6,
          11,
          3,
          15,
          6,
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
        "circle-opacity": ["*", 0.9, ["get", "age"]],
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
        "circle-stroke-opacity": ["get", "age"],
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
      paint: { "icon-opacity": ["get", "age"] },
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

/** Push the moment's data into the existing sources. */
export function updateLayers(
  map: MapLibreMap,
  r: Replayable,
  at: number,
  /** Photo pins, when the reader has turned them on. Empty otherwise. */
  photoPins: readonly {
    id: string;
    at: number | null;
    lat: number | null;
    lon: number | null;
  }[] = [],
): void {
  const zoom = map.getZoom();
  const { done, rest, here } = trackGeoJson(r, at, zoom);
  (map.getSource(SRC.trackDone) as GeoJSONSource | undefined)?.setData(done);
  (map.getSource(SRC.track) as GeoJSONSource | undefined)?.setData(rest);
  (map.getSource(SRC.chaser) as GeoJSONSource | undefined)?.setData(here);
  (map.getSource(SRC.live) as GeoJSONSource | undefined)?.setData(
    liveGeoJson(r, at),
  );
  (map.getSource(SRC.proximity) as GeoJSONSource | undefined)?.setData(
    proximityGeoJson(r, at),
  );
  (map.getSource(SRC.trail) as GeoJSONSource | undefined)?.setData(
    trailGeoJson(r, at),
  );
  if (r.damage.length) {
    (map.getSource(SRC.damage) as GeoJSONSource | undefined)?.setData(
      damageGeoJson(r, at),
    );
  }
  // Skipped entirely when the replay carries no polygons, which is every
  // archive day — an empty setData still costs a source update per frame.
  if (photoPins.length) {
    (map.getSource(SRC.photos) as GeoJSONSource | undefined)?.setData(
      photosGeoJson(photoPins, at),
    );
  }
  if (r.hail.length) {
    (map.getSource(SRC.hail) as GeoJSONSource | undefined)?.setData(
      hailGeoJson(r, at),
    );
  }
  if (r.warnings.length) {
    (map.getSource(SRC.warns) as GeoJSONSource | undefined)?.setData(
      warningsGeoJson(r, at),
    );
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
