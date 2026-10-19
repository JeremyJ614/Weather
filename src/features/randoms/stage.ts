/** Shared plumbing for the Randoms: one canvas per scene, paused off screen, sized to its box. */
export type Tier = "low" | "mid" | "high";
export type Ctx = { tier: Tier; reduced: boolean };
export type Scene = { dispose(): void; pause(paused: boolean): void };

export const dprFor = (tier: Tier) =>
  Math.min(
    globalThis.devicePixelRatio || 1,
    tier === "high" ? 2 : tier === "mid" ? 1.5 : 1,
  );

/** A frame loop that can pause; `frame` gets elapsed seconds and the step since last frame. */
export function loop(frame: (t: number, dt: number) => void) {
  let raf = 0;
  let paused = false;
  let last = performance.now();
  let t = 0;
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    frame(t, dt);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return {
    pause(p: boolean) {
      if (p === paused) return;
      paused = p;
      if (p) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    },
    stop() {
      paused = true;
      cancelAnimationFrame(raf);
    },
  };
}

/** Calls `cb(width, height)` now and whenever the box changes size. */
export function watchSize(el: HTMLElement, cb: (w: number, h: number) => void) {
  const fire = () =>
    cb(Math.max(1, el.clientWidth), Math.max(1, el.clientHeight));
  fire();
  const ro = new ResizeObserver(fire);
  ro.observe(el);
  return () => ro.disconnect();
}
