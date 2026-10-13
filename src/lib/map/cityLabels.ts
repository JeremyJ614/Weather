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
  const want = Math.round(14 * k ** 1.7);
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
        (o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1],
      )
    )
      continue;
    boxes.push(b);
    out.push(c);
  }
  return out;
}
