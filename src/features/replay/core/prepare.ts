import { haversine, cumulative } from "./geo";
import { SpatialIndex } from "./spatialIndex";
import { Track } from "./track";
import {
  strongestOf,
  tornadoPositionAt,
  type Approach,
  type ChasePayload,
  type Crossing,
  type PreparedChase,
  type PreparedTornado,
} from "./chase";

/**
 * Turn raw chase data into everything the replay needs.
 *
 * This is the expensive part of an import: nearest-feature lookups for every
 * damage point, a distance sweep per tornado, and a crossing search across the
 * whole track. The old build ran it synchronously on the main thread and the
 * page simply froze. Here it is a pure function, so it runs in a worker, and it
 * reports progress as it goes.
 */
export function prepareChase(
  payload: ChasePayload,
  onProgress?: (fraction: number, label: string) => void,
): PreparedChase {
  const step = (f: number, label: string) => onProgress?.(f, label);

  step(0.05, "Reading the track");
  const track = Track.fromFixes(payload.track);

  step(0.2, "Measuring the tornadoes");
  const tornadoes: PreparedTornado[] = payload.torn
    .map((t, index) => {
      const coords = t.coords.filter(
        (c) => Number.isFinite(c[0]) && Number.isFinite(c[1]),
      ) as [number, number][];
      if (coords.length === 1)
        coords.push([coords[0]![0] + 0.00002, coords[0]![1]]);

      const cum = cumulative(coords);
      const lengthM = cum[cum.length - 1] || 1;
      const end = t.end > t.start ? t.end : t.start + 60;
      return {
        index,
        name: (t.name || "Tornado").trim(),
        ef: (t.ef || "EFU").toUpperCase(),
        start: t.start,
        end,
        coords,
        cum,
        lengthM,
        widthYd: Number(t.widthYd) || 50,
        maxwind: Math.max(0, Number(t.maxwind) || 0),
        injuries: Number(t.inj) || 0,
        fatalities: Number(t.fat) || 0,
        speedMs: lengthM / Math.max(1, end - t.start),
        /*
         * The survey's own words, and whose survey it was.
         *
         * These were in the payload and in the type and were dropped here, so
         * the narrative could never reach a screen no matter how good the data
         * got — the same shape of mistake as fetching the damage points and
         * never drawing them. Anything added to the payload has to be carried
         * through this function or it does not exist.
         */
        ...(t.comments ? { comments: t.comments } : {}),
        ...(t.wfo ? { wfo: t.wfo } : {}),
      };
    })
    .filter((t) => t.coords.length >= 2)
    .sort((a, b) => a.start - b.start);

  tornadoes.forEach((t, i) => {
    t.index = i;
  });

  step(0.4, "Building the index");
  const refLat = track.n ? track.lat[0]! : (tornadoes[0]?.coords[0]?.[1] ?? 40);
  const index = new SpatialIndex(refLat);
  for (const t of tornadoes) index.addFeature(t.index, t.coords);

  step(0.55, "Finding your closest approach");
  const approaches: Approach[] = [];
  for (const t of tornadoes) {
    // Five-second resolution over the tornado's life is enough to find the
    // minimum to within a few metres at any speed a vehicle travels.
    let best = { metres: Infinity, at: t.start };
    for (let time = t.start; time <= t.end; time += 5) {
      const me = track.positionAt(time);
      const it = tornadoPositionAt(t, time);
      const d = haversine(me.lat, me.lon, it[0], it[1]);
      if (d < best.metres) best = { metres: d, at: time };
    }
    approaches.push({
      tornadoIndex: t.index,
      metres: Math.round(best.metres),
      at: best.at,
    });
  }

  step(0.75, "Looking for path crossings");
  const crossings: Crossing[] = [];
  for (let i = 1; i < track.n; i += 1) {
    const hit = index.nearest(track.lat[i]!, track.lon[i]!, 120);
    if (!hit) continue;
    const t = tornadoes[hit.id];
    if (!t) continue;
    // Ignore repeats: one crossing per tornado per two minutes.
    const last = crossings[crossings.length - 1];
    if (last && last.tornadoIndex === t.index && track.t[i]! - last.at < 120)
      continue;

    const fraction = hit.along / t.lengthM;
    const tornadoAt = t.start + fraction * (t.end - t.start);
    crossings.push({
      tornadoIndex: t.index,
      at: Math.round(track.t[i]!),
      tornadoAt: Math.round(tornadoAt),
      gapSeconds: Math.round(track.t[i]! - tornadoAt),
      lat: track.lat[i]!,
      lon: track.lon[i]!,
    });
  }

  step(0.95, "Finishing up");
  const starts = tornadoes.map((t) => t.start);
  const ends = tornadoes.map((t) => t.end);
  const window: [number, number] = tornadoes.length
    ? [Math.min(...starts), Math.max(...ends)]
    : [track.startTime, track.endTime];

  step(1, "Ready");
  return {
    title: payload.title,
    subtitle: payload.subtitle,
    tz: payload.tz,
    T0: payload.T0,
    tornadoes,
    approaches,
    crossings,
    totalMetres: track.totalMetres,
    trackPoints: track.n,
    window,
    trackWindow: [track.startTime, track.endTime],
    strongest: strongestOf(tornadoes),
    // The leading number is the shape of this object, not the data. Bump it
    // whenever a field is added, or a vault cached under the old shape reads
    // back missing it — the rest of the key only notices data changes.
    signature: `v2:${payload.T0}:${track.n}:${tornadoes.length}`,
  };
}
