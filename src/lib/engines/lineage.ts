/**
 * Following storms between ProbSevere files by overlap (post-launch A6, Lightning Surge
 * Detector). ProbSevere's storm IDs can change hands when storms merge or split, which makes a
 * flash rate look like it jumped. Here an older storm belongs to a current one when its center,
 * carried forward on the current storm's motion, lands inside the current outline (or it keeps
 * the same ID within 25 km). A merger adds its parts' flash rates; a split shares the parent's
 * by outline area. Pure: shared by the server and the tests.
 */
import type { Cell } from "./project";

export type Then = { id: string; fr: number; lat: number; lon: number };
export type Line = {
  /** Flash rate this storm had back then, counting every part it came from. */
  fr: number;
  /** The older storm it mostly came from. */
  main: string;
  merged: boolean;
  split: boolean;
};

function inside(ring: [number, number][], lon: number, lat: number) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      hit = !hit;
  }
  return hit;
}

const km = (a: number, b: number, c: number, d: number) =>
  Math.hypot(
    (b - d) * 111.32 * Math.cos((a * Math.PI) / 180),
    (a - c) * 111.32,
  );

/** For each current storm, where it was `dtMs` earlier. */
export function lineage(now: Cell[], then: Then[], dtMs: number) {
  const s = dtMs / 1000;
  const claims = new Map<string, Cell[]>();
  const preds = new Map<string, Then[]>();
  for (const c of now) {
    const cos = Math.cos((c.lat * Math.PI) / 180);
    const mine: Then[] = [];
    for (const o of then) {
      // The older storm carried forward to now on this storm's motion.
      const lat = o.lat + (c.north * s) / 111_320;
      const lon = o.lon + (c.east * s) / (111_320 * cos);
      const same = o.id === c.id && km(lat, lon, c.lat, c.lon) <= 25;
      if (same || (c.ring.length > 2 && inside(c.ring, lon, lat))) {
        mine.push(o);
        claims.set(o.id, [...(claims.get(o.id) ?? []), c]);
      }
    }
    preds.set(c.id, mine);
  }
  const out = new Map<string, Line>();
  for (const c of now) {
    const mine = preds.get(c.id)!;
    if (!mine.length) continue;
    let fr = 0;
    let main = mine[0];
    let best = -1;
    let split = false;
    for (const o of mine) {
      const who = claims.get(o.id)!;
      if (who.length > 1) split = true;
      const total = who.reduce((a, x) => a + (x.size || 1), 0);
      const part = o.fr * ((c.size || 1) / total);
      fr += part;
      const score = part + (o.id === c.id ? 1e6 : 0);
      if (score > best) {
        best = score;
        main = o;
      }
    }
    out.set(c.id, { fr, main: main.id, merged: mine.length > 1, split });
  }
  return out;
}
