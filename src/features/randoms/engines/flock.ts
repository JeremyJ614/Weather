/*
  Murmuration: starlings flocking at dusk (Craig Reynolds' boids: match your neighbors'
  heading, drift to their middle, keep a little room), on a spatial grid so thousands stay
  smooth. A finger or the mouse is a falcon they scatter from. Written for StormSync.
*/
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";
import { addCanvas, pointer } from "./gl";

export type Flock = Scene;

export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Flock> {
  const cv = addCanvas(el);
  const g = cv.getContext("2d");
  if (!g) {
    cv.remove();
    throw new Error("Canvas is off");
  }
  const s = dprFor(tier);
  const cap = tier === "low" ? 900 : tier === "mid" ? 1600 : 2200;
  let W = 0;
  let H = 0;
  let N = 0;
  let px = new Float32Array(0);
  let py = px;
  let vx = px;
  let vy = px;
  const CELL = 30 * s;
  let cols = 0;
  let rows = 0;
  let head = new Int32Array(0);
  let next = new Int32Array(0);
  let sky: CanvasGradient | null = null;
  // Slower birds with reduced motion.
  const pace = reduced ? 0.45 : 1;

  const seed = () => {
    N = Math.min(cap, Math.round((W * H) / (s * s) / 110));
    px = new Float32Array(N);
    py = new Float32Array(N);
    vx = new Float32Array(N);
    vy = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 120 * s;
      px[i] = W / 2 + Math.cos(a) * r;
      py[i] = H * 0.42 + Math.sin(a) * r * 0.5;
      const b = Math.random() * Math.PI * 2;
      vx[i] = Math.cos(b) * 90 * s * pace;
      vy[i] = Math.sin(b) * 90 * s * pace;
    }
    next = new Int32Array(N);
  };
  const unwatch = watchSize(el, (w, h) => {
    const nw = Math.round(w * s);
    const nh = Math.round(h * s);
    if (nw === W && nh === H) return;
    const first = !N;
    W = cv.width = nw;
    H = cv.height = nh;
    cols = Math.ceil(W / CELL) + 1;
    rows = Math.ceil(H / CELL) + 1;
    head = new Int32Array(cols * rows);
    if (first) seed();
    sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b0c1d");
    sky.addColorStop(0.45, "#2a1f3d");
    sky.addColorStop(0.75, "#7a4a4a");
    sky.addColorStop(0.92, "#d9a066");
    sky.addColorStop(1, "#f0c27a");
  });

  const ptr = pointer(el, cv);
  const run = loop((T, dt) => {
    head.fill(-1);
    for (let i = 0; i < N; i++) {
      const c =
        Math.min(cols - 1, Math.max(0, (px[i] / CELL) | 0)) +
        Math.min(rows - 1, Math.max(0, (py[i] / CELL) | 0)) * cols;
      next[i] = head[c];
      head[c] = i;
    }
    // The roost they circle drifts slowly around the sky.
    const t = T * pace;
    const ax =
      W / 2 + Math.cos(t * 0.31) * W * 0.28 + Math.sin(t * 0.73) * W * 0.08;
    const ay = H * 0.4 + Math.sin(t * 0.47) * H * 0.18;
    const R2 = CELL * CELL;
    const SEP = (5.5 * s) ** 2;
    const max = 160 * s * pace;
    const min = 80 * s * pace;
    const hawk = ptr.down || ptr.over;
    const rr = (120 * s) ** 2;
    for (let i = 0; i < N; i++) {
      const cx = (px[i] / CELL) | 0;
      const cy = (py[i] / CELL) | 0;
      let n = 0;
      let avx = 0;
      let avy = 0;
      let cmx = 0;
      let cmy = 0;
      let sx = 0;
      let sy = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= rows) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= cols) continue;
          for (let j = head[xx + yy * cols]; j !== -1; j = next[j]) {
            if (j === i) continue;
            const dx = px[j] - px[i];
            const dy = py[j] - py[i];
            const d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            n++;
            avx += vx[j];
            avy += vy[j];
            cmx += dx;
            cmy += dy;
            if (d2 < SEP) {
              sx -= dx / (d2 + 1);
              sy -= dy / (d2 + 1);
            }
          }
        }
      }
      let fx = 0;
      let fy = 0;
      if (n) {
        fx += (avx / n - vx[i]) * 2.4 + (cmx / n) * 2.6;
        fy += (avy / n - vy[i]) * 2.4 + (cmy / n) * 2.6;
      }
      fx += sx * 2600 * s + (ax - px[i]) * 0.55;
      fy += sy * 2600 * s + (ay - py[i]) * 0.55;
      if (hawk) {
        const dx = px[i] - ptr.x;
        const dy = py[i] - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr) {
          const k = ((1 - d2 / rr) * 2600 * s) / Math.sqrt(d2 + 1);
          fx += dx * k;
          fy += dy * k;
        }
      }
      vx[i] += fx * dt;
      vy[i] += fy * dt;
      const sp = Math.hypot(vx[i], vy[i]) || 1;
      const k = sp > max ? max / sp : sp < min ? min / sp : 1;
      vx[i] *= k;
      vy[i] *= k;
    }
    for (let i = 0; i < N; i++) {
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      if (px[i] < -20) px[i] = W + 20;
      else if (px[i] > W + 20) px[i] = -20;
      if (py[i] < H * 0.06) vy[i] += 600 * s * dt;
      else if (py[i] > H * 0.86) vy[i] -= 600 * s * dt;
    }
    g.fillStyle = sky!;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,226,170,.16)";
    g.beginPath();
    g.arc(W * 0.7, H * 0.93, 46 * s, 0, Math.PI * 2);
    g.fill();
    // Each bird a short dash along its heading, all in one path.
    g.strokeStyle = "#07070d";
    g.lineWidth = 1.5 * s;
    g.lineCap = "round";
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const k = (2.2 * s) / (Math.hypot(vx[i], vy[i]) || 1);
      g.moveTo(px[i] - vx[i] * k, py[i] - vy[i] * k);
      g.lineTo(px[i] + vx[i] * k * 0.5, py[i] + vy[i] * k * 0.5);
    }
    g.stroke();
    g.fillStyle = "#06060b";
    g.fillRect(0, H * 0.965, W, H * 0.04);
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
