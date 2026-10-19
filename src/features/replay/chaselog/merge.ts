import type { DiscoveryBundle } from "../import/sources";
import type { Replayable } from "../map/replayable";

/**
 * Lays what NOAA and IEM returned for a stored chase over it: damage points and contours for
 * the tornadoes the member kept (matched by start time and rating, so a re-rated or newly
 * surveyed tornado is simply left off), plus the hail and warnings near the route.
 */
export function mergeDiscovery(r: Replayable, b: DiscoveryBundle): Replayable {
  const map = new Map<number, number>();
  b.tornadoes.forEach((t, i) => {
    const hit = r.tornadoes.find(
      (k) => Math.abs(k.start - t.start) <= 120 && k.ef === t.ef,
    );
    if (hit) map.set(i, hit.index);
  });
  return {
    ...r,
    damage: b.damage
      .filter((d) => map.has(d[6]))
      .map((d) => [d[0], d[1], d[2], d[3], d[4], d[5], map.get(d[6])!]),
    contours: b.contours
      .filter((c) => map.has(c.t))
      .map((c) => ({ ...c, t: map.get(c.t)! })),
    hail: b.hail,
    warnings: b.warnings,
  };
}
