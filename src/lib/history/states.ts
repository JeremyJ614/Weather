import "server-only";
import states from "@/lib/map/data/usStatesAlbers.json";
import { STATE_ABBR } from "@/lib/map/usAlbersLabels";

type Shape = { abbr: string; box: number[]; rings: number[][] };
let shapes: Shape[] | null = null;

/** The shipped state outlines (canvas coordinates) as rings of x,y pairs with a bounding box. */
function load(): Shape[] {
  return (shapes ??= (
    states as { states: { name: string; d: string }[] }
  ).states.map((st) => {
    const rings = st.d
      .split("M")
      .filter(Boolean)
      .map((part) =>
        part
          .replace(/Z/g, "")
          .split(/[L\s]+/)
          .filter(Boolean)
          .map(Number),
      );
    const xs = rings.flatMap((r) => r.filter((_, i) => i % 2 === 0));
    const ys = rings.flatMap((r) => r.filter((_, i) => i % 2 === 1));
    return {
      abbr: STATE_ABBR[st.name] ?? st.name,
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      rings,
    };
  }));
}

/** Even-odd ray casting over every ring, so islands and holes both count right. */
function inside(rings: number[][], x: number, y: number) {
  let hit = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const [xi, yi, xj, yj] = [r[i], r[i + 1], r[j], r[j + 1]];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        hit = !hit;
    }
  return hit;
}

/**
 * The state (two-letter code) under a point on the national canvas, or "" offshore. A point a
 * hair outside every outline (a track starting on the coast) takes the state with the nearest
 * outline point, within about 18 km.
 */
export function stateAt(x: number, y: number): string {
  const all = load();
  for (const s of all)
    if (
      x >= s.box[0] &&
      x <= s.box[2] &&
      y >= s.box[1] &&
      y <= s.box[3] &&
      inside(s.rings, x, y)
    )
      return s.abbr;
  let best = "";
  let gap = 4;
  for (const s of all) {
    if (
      x < s.box[0] - gap ||
      x > s.box[2] + gap ||
      y < s.box[1] - gap ||
      y > s.box[3] + gap
    )
      continue;
    for (const r of s.rings)
      for (let i = 0; i < r.length; i += 2) {
        const d = Math.hypot(r[i] - x, r[i + 1] - y);
        if (d < gap) {
          gap = d;
          best = s.abbr;
        }
      }
  }
  return best;
}

/** Each state's box on the national canvas: [x0, y0, x1, y1]. */
export function stateBoxes(): Record<string, number[]> {
  return Object.fromEntries(load().map((s) => [s.abbr, s.box]));
}
