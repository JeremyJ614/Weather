/** A place as the map draws it: name and canvas position, biggest places first. */
export type City = [name: string, x: number, y: number];
export type View = { x: number; y: number; w: number; h: number };

/**
 * Which city names to draw for a zoomed view: more the further in (none at the whole
 * country), only those on screen, biggest first, never overlapping. `fs` is the label
 * font size in canvas units at the current zoom.
 */
export function pickCities(
  cities: City[],
  v: View,
  full: number,
  fs = 10 * (v.w / full),
): City[] {
  const k = full / v.w;
  if (k < 1.4) return [];
  // A few anchor cities at moderate zoom; more only when zoomed far in (Fix-It #6.8), and
  // town names on maps that zoom past 10× (Fix list 2026-10-30 #7), still never crowded.
  const want =
    k < 2.5 ? 5 : k < 5 ? 8 : k < 10 ? 14 : k < 20 ? 22 : k < 40 ? 30 : 38;
  const gap = fs * 1.6;
  const boxes: [number, number, number, number][] = [];
  const out: City[] = [];
  for (const c of cities) {
    if (out.length >= want) break;
    const [name, x, y] = c;
    if (x < v.x || x > v.x + v.w || y < v.y || y > v.y + v.h) continue;
    const w = name.length * fs * 0.56 + fs * 0.6;
    const b: [number, number, number, number] = [
      x - fs * 0.3,
      y - fs * 0.9,
      x + w,
      y + fs * 0.4,
    ];
    if (
      boxes.some(
        (o) =>
          b[0] < o[2] + gap &&
          b[2] + gap > o[0] &&
          b[1] < o[3] + gap &&
          b[3] + gap > o[1],
      )
    )
      continue;
    boxes.push(b);
    out.push(c);
  }
  return out;
}
