/**
 * Turning a prepared chase into the things a scrub bar can catch on.
 *
 * The bar is only as useful as the moments it knows about, and those come from
 * three places: the tornadoes themselves, how close the chaser got, and where
 * their track crossed a centreline. Nothing here reads the DOM, so what the
 * bar offers can be tested without rendering it.
 */
import type { PreparedChase } from "@/features/replay/core/chase";
import type { Moment, TornadoSpan } from "./snap";

/**
 * Every moment worth stopping on.
 *
 * A closest approach is only worth a detent when it was actually close — on a
 * bust day the nearest the chaser got may be sixty miles, and a detent there
 * is noise pretending to be a moment.
 */
export function momentsOf(
  chase: PreparedChase,
  closestWithinMetres = 32_186,
): Moment[] {
  const out: Moment[] = [];

  out.push({ at: chase.window[0], kind: "start", label: "Chase begins" });

  chase.tornadoes.forEach((t, i) => {
    out.push({
      at: t.start,
      kind: "touchdown",
      ef: t.ef,
      tornadoIndex: i,
      label: `${t.name} touches down`,
    });
    // A tornado that touched down and lifted inside the same few seconds does
    // not need two detents on top of each other.
    if (t.end - t.start > 30) {
      out.push({
        at: t.end,
        kind: "lift",
        ef: t.ef,
        tornadoIndex: i,
        label: `${t.name} lifts`,
      });
    }
  });

  for (const a of chase.approaches) {
    if (a.metres > closestWithinMetres) continue;
    const t = chase.tornadoes[a.tornadoIndex];
    out.push({
      at: a.at,
      kind: "closest",
      ef: t?.ef,
      tornadoIndex: a.tornadoIndex,
      label: `Closest to ${t?.name ?? "the tornado"} — ${miles(a.metres)}`,
    });
  }

  for (const c of chase.crossings) {
    const t = chase.tornadoes[c.tornadoIndex];
    out.push({
      at: c.at,
      kind: "crossing",
      ef: t?.ef,
      tornadoIndex: c.tornadoIndex,
      label: `Crossed the path of ${t?.name ?? "a tornado"} — ${gap(c.gapSeconds)}`,
    });
  }

  out.push({ at: chase.window[1], kind: "end", label: "Chase ends" });

  // Sorted, because the bar steps through them and the caller should not have
  // to know that.
  return out.sort((a, b) => a.at - b.at);
}

/** The spans the strip chart weighs. */
export function spansOf(chase: PreparedChase): TornadoSpan[] {
  return chase.tornadoes.map((t) => ({ start: t.start, end: t.end, ef: t.ef }));
}

function miles(metres: number): string {
  const mi = metres / 1609.344;
  return mi < 0.5 ? `${Math.round(metres * 1.0936)} yd` : `${mi.toFixed(1)} mi`;
}

/**
 * How near a miss was, in the words a chaser would use.
 *
 * Positive means the chaser was there after the tornado, which is the safe
 * side; negative means they got there first, which is not.
 */
function gap(seconds: number): string {
  const mins = Math.abs(seconds) / 60;
  const when =
    mins < 1
      ? `${Math.round(Math.abs(seconds))}s`
      : `${mins.toFixed(mins < 10 ? 1 : 0)} min`;
  return seconds >= 0 ? `${when} behind it` : `${when} ahead of it`;
}
