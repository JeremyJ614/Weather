/*
  Aurora Painter (post-launch A8): drag across a starry sky above the mountains to paint
  northern lights. Each stroke becomes a curtain of thin rays, green below and violet on
  top, that ripples sideways like a real arc folding and fades over about nine seconds.
  Left alone, a new arc drifts in on its own. Written for StormSync.
*/
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";
import { addCanvas, pointer } from "./gl";

type Stroke = { pts: [number, number, number][]; age: number; ph: number };

export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Scene> {
  const cv = addCanvas(el);
  const g = cv.getContext("2d");
  if (!g) {
    cv.remove();
    throw new Error("Canvas is off");
  }
  const s = dprFor(tier);
  const LIFE = 9;
  const step = tier === "low" ? 9 : 5;
  const maxStrokes = tier === "low" ? 4 : 9;
  let W = 0;
  let H = 0;
  let T = 0;
  let auto = 0.5;
  let strokes: Stroke[] = [];
  let cur: Stroke | null = null;
  let stars: { x: number; y: number; p: number }[] = [];
  let ridge: number[] = [];
  const unwatch = watchSize(el, (w, h) => {
    W = Math.round(w * s);
    H = Math.round(h * s);
    cv.width = W;
    cv.height = H;
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    stars = Array.from(
      { length: Math.round((W * H) / (s * s) / 1600) },
      () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.72,
        p: Math.random() * 7,
      }),
    );
    ridge = [];
    for (let x = 0; x <= W + 8 * s; x += 8 * s)
      ridge.push(
        H -
          30 * s -
          Math.abs(Math.sin((x * 0.011) / s) * 38 * s) -
          Math.sin((x * 0.037) / s) * 10 * s,
      );
  });
  const ptr = pointer(el, cv);
  const arc = (): Stroke => {
    const y = H * (0.32 + Math.random() * 0.2);
    const st: Stroke = { pts: [], age: 0, ph: Math.random() * 6 };
    for (let x = -10 * s; x < W + 10 * s; x += step * s)
      st.pts.push([
        x,
        y + Math.sin((x * 0.012) / s) * 26 * s,
        T + x / (600 * s),
      ]);
    return st;
  };
  const run = loop((_t, dt) => {
    T += dt * (reduced ? 0.4 : 1);
    // Painting: the pointer lays down a stroke while pressed.
    if (ptr.down) {
      if (!cur) {
        cur = { pts: [], age: 0, ph: Math.random() * 6 };
        strokes.push(cur);
        if (strokes.length > maxStrokes) strokes.shift();
      }
      const l = cur.pts[cur.pts.length - 1];
      if (!l || Math.hypot(l[0] - ptr.x, l[1] - ptr.y) > step * s)
        cur.pts.push([ptr.x, ptr.y, T]);
      cur.age = 0;
      auto = 6;
    } else cur = null;
    auto -= dt;
    if (auto < 0 && !cur) {
      auto = 5.5;
      strokes.push(arc());
      if (strokes.length > maxStrokes) strokes.shift();
    }
    g.globalCompositeOperation = "source-over";
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#03040a");
    sky.addColorStop(1, "#0a0d1c");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    for (const st of stars) {
      g.globalAlpha = 0.3 + 0.3 * Math.sin(T * 1.4 + st.p);
      g.fillStyle = "#e8eaff";
      g.fillRect(st.x, st.y, 1.3 * s, 1.3 * s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "lighter";
    const ray = 6 * s;
    for (const st of strokes) {
      st.age += dt;
      const fade = Math.max(0, 1 - st.age / LIFE);
      if (!fade) continue;
      for (let i = 0; i < st.pts.length; i++) {
        const [x0, y0, born] = st.pts[i];
        const wob =
          Math.sin(T * 1.6 + i * 0.25 + st.ph) * 6 * s +
          Math.sin(T * 0.7 + i * 0.09) * 9 * s;
        const x = x0 + wob;
        const top = y0 - 70 * s - Math.sin(T + i * 0.3) * 14 * s;
        const bottom = y0 + 12 * s;
        const a = fade * Math.min(1, (T - born) * 2) * 0.16;
        const gr = g.createLinearGradient(0, top, 0, bottom);
        gr.addColorStop(0, "rgba(190,90,220,0)");
        gr.addColorStop(0.25, `rgba(190,90,220,${a * 0.8})`);
        gr.addColorStop(0.7, `rgba(90,240,160,${a * 1.6})`);
        gr.addColorStop(1, "rgba(120,255,190,0)");
        g.fillStyle = gr;
        g.fillRect(x - ray / 2, top, ray, bottom - top);
      }
    }
    strokes = strokes.filter((st) => st.age < LIFE || st === cur);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#020306";
    g.beginPath();
    g.moveTo(0, H);
    ridge.forEach((y, i) => g.lineTo(i * 8 * s, y));
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  });
  return {
    pause: run.pause,
    dispose() {
      run.stop();
      unwatch();
      ptr.off();
      cv.remove();
    },
  };
}
