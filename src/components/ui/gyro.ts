/**
 * Phone tilt for the badge plates (post-launch A5 "holo"), loaded only on touch screens that
 * allow motion: follows the phone's orientation while the plate is on screen.
 */
export function listenTilt(
  node: Element,
  set: (t: { x: number; y: number } | null) => void,
) {
  let base: number | null = null;
  let raf = 0;
  let seen = false;
  const on = (e: DeviceOrientationEvent) => {
    if (!seen || e.gamma == null || e.beta == null) return;
    base ??= e.beta;
    const g = e.gamma;
    const b = e.beta - base;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() =>
      set({
        x: Math.max(-1, Math.min(1, g / 30)),
        y: Math.max(-1, Math.min(1, b / 30)),
      }),
    );
  };
  const io = new IntersectionObserver(([x]) => {
    seen = x.isIntersecting;
    if (!seen) set(null);
  });
  io.observe(node);
  addEventListener("deviceorientation", on);
  return () => {
    io.disconnect();
    removeEventListener("deviceorientation", on);
    cancelAnimationFrame(raf);
  };
}

let asked = false;
/** iPhone asks once for motion access, on the first tap of a badge. */
export async function askTilt() {
  if (asked) return;
  asked = true;
  const D = (
    globalThis as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
    }
  ).DeviceOrientationEvent;
  try {
    await D?.requestPermission?.();
  } catch {}
}
