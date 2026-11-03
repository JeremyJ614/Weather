import type { View } from "./useZoom";

/**
 * Eases a map from one view to another over 0.9 s, zooming in log space so it feels even all
 * the way in (Fix list 2026-10-30 #7: a picked tornado). Loaded only when a map glides.
 * Returns a cancel.
 */
export function glide(
  from: View,
  to: View,
  set: (v: View) => void,
  aspect: number,
) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    set(to);
    return () => {};
  }
  let raf = 0;
  const t0 = performance.now();
  const lerp = (a: number, b: number, e: number) => a + (b - a) * e;
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / 900);
    const e = 1 - (1 - t) ** 3;
    const w = Math.exp(lerp(Math.log(from.w), Math.log(to.w), e));
    const cx = lerp(from.x + from.w / 2, to.x + to.w / 2, e);
    const cy = lerp(
      from.y + (from.w * aspect) / 2,
      to.y + (to.w * aspect) / 2,
      e,
    );
    set({ w, x: cx - w / 2, y: cy - (w * aspect) / 2 });
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}
