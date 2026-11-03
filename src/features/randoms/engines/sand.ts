/*
  Falling Sand: a cellular sandbox. Sand piles, water levels out, fire climbs and burns plants
  and seeds into smoke, water puts fire out, seeds sprout in water and plants grow into it.
  One byte per cell, drawn as pixels. Written for StormSync.
*/
import { loop, type Ctx, type Scene } from "../stage";
import { addCanvas, pointer } from "./gl";

export const MATERIALS = [
  "Sand",
  "Water",
  "Fire",
  "Seeds",
  "Wall",
  "Erase",
] as const;
export type Material = (typeof MATERIALS)[number];
export type Sand = Scene & {
  use(m: Material): void;
  /** Empties everything above the floor. */
  clear(): void;
  /** Back to the starting scene. */
  reset(): void;
};

const E = 0;
const SAND = 1;
const WATER = 2;
const WALL = 3;
const FIRE = 4;
const PLANT = 5;
const SMOKE = 6;
const SEED = 7;
const OF: Record<Material, number> = {
  Sand: SAND,
  Water: WATER,
  Fire: FIRE,
  Seeds: SEED,
  Wall: WALL,
  Erase: E,
};
/** Each material's darkest and lightest grain. */
const PAL: Record<number, [number[], number[]]> = {
  [SAND]: [
    [214, 180, 110],
    [236, 204, 132],
  ],
  [WATER]: [
    [48, 104, 196],
    [72, 140, 220],
  ],
  [WALL]: [
    [70, 72, 92],
    [92, 94, 116],
  ],
  [FIRE]: [
    [255, 120, 30],
    [255, 220, 90],
  ],
  [PLANT]: [
    [46, 140, 70],
    [90, 190, 90],
  ],
  [SMOKE]: [
    [60, 58, 70],
    [96, 94, 106],
  ],
  [SEED]: [
    [150, 110, 60],
    [190, 150, 90],
  ],
};
const abgr = (r: number, g: number, b: number) =>
  ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;

export async function mount(el: HTMLElement, { tier }: Ctx): Promise<Sand> {
  const cv = addCanvas(el);
  cv.style.imageRendering = "pixelated";
  const g = cv.getContext("2d");
  if (!g) {
    cv.remove();
    throw new Error("Canvas is off");
  }
  // The grid is set once from the box's shape; the canvas stretches with the box after.
  const C = tier === "low" ? 110 : 150;
  const Rr = Math.max(
    40,
    Math.round((C * el.clientHeight) / Math.max(1, el.clientWidth)),
  );
  cv.width = C;
  cv.height = Rr;
  const img = g.createImageData(C, Rr);
  const px32 = new Uint32Array(img.data.buffer);
  const n = C * Rr;
  const type = new Uint8Array(n);
  const life = new Uint8Array(n);
  const shade = new Uint8Array(n);
  const stamp = new Uint8Array(n);
  for (let i = 0; i < n; i++) shade[i] = (Math.random() * 255) | 0;
  const LUT: Record<number, Uint32Array> = {};
  for (const k of Object.keys(PAL).map(Number)) {
    const [a, b] = PAL[k];
    LUT[k] = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      LUT[k][i] = abgr(
        ...(a.map((v, j) => Math.round(v + (b[j] - v) * t)) as [
          number,
          number,
          number,
        ]),
      );
    }
  }
  const BG = abgr(10, 11, 20);
  const at = (x: number, y: number) =>
    x < 0 || x >= C || y < 0 || y >= Rr ? -1 : x + y * C;
  const set = (i: number, t: number, l = 0) => {
    type[i] = t;
    life[i] = l;
  };
  const swap = (a: number, b: number) => {
    const t = type[a];
    const l = life[a];
    type[a] = type[b];
    life[a] = life[b];
    type[b] = t;
    life[b] = l;
  };
  const fill = (x: number, y: number, t: number) => {
    const i = at(x, y);
    if (i >= 0 && !type[i]) set(i, t);
  };

  // A starting scene: a floor, a walled bowl, a dune, a pool and three sprouts.
  const F = Rr - 3;
  const scene = () => {
    type.fill(0);
    life.fill(0);
    for (let x = 0; x < C; x++) {
      set(at(x, F), WALL);
      set(at(x, F + 1), WALL);
    }
    const L = Math.round(C * 0.12);
    for (let x = L; x < C - L; x++)
      set(
        at(
          x,
          F - 4 - Math.round(10 * Math.sin(((x - L) / (C - 2 * L)) * Math.PI)),
        ),
        WALL,
      );
    for (let y = F - 30; y < F; y++) {
      set(at(L, y), WALL);
      set(at(C - L - 1, y), WALL);
    }
    const mid = Math.round(C * 0.31);
    for (let x = L + 6; x < Math.round(C * 0.47); x++)
      for (let y = F - 24 + Math.round(Math.abs(x - mid) * 0.5); y < F - 4; y++)
        fill(x, y, SAND);
    for (let x = Math.round(C * 0.53); x < C - L - 4; x++)
      for (let y = F - 20; y < F - 4; y++) fill(x, y, WATER);
    for (const x of [mid - 7, mid + 5, mid + 13])
      for (
        let y = F - 34;
        y < F - 24 + Math.round(Math.abs(x - mid) * 0.5);
        y++
      )
        fill(x, y, PLANT);
  };
  scene();

  const near = (x: number, y: number, t: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const j = at(x + dx, y + dy);
        if (j >= 0 && type[j] === t) return j;
      }
    return -1;
  };
  let frame = 0;
  const tick = () => {
    frame++;
    const f = frame & 255 || 1;
    const rev = frame & 1;
    for (let y = Rr - 1; y >= 0; y--)
      for (let k = 0; k < C; k++) {
        const x = rev ? C - 1 - k : k;
        const i = x + y * C;
        const t = type[i];
        if (!t || t === WALL || stamp[i] === f) continue;
        const dir = Math.random() < 0.5 ? -1 : 1;
        const move = (j: number) => {
          swap(i, j);
          stamp[j] = f;
        };
        if (t === SAND || t === SEED) {
          const b = at(x, y + 1);
          if (
            b >= 0 &&
            (type[b] === E || type[b] === WATER || type[b] === SMOKE)
          ) {
            move(b);
            continue;
          }
          const d1 = at(x + dir, y + 1);
          const d2 = at(x - dir, y + 1);
          if (d1 >= 0 && (type[d1] === E || type[d1] === WATER)) {
            move(d1);
            continue;
          }
          if (d2 >= 0 && (type[d2] === E || type[d2] === WATER)) {
            move(d2);
            continue;
          }
          if (t === SEED && near(x, y, WATER) >= 0) set(i, PLANT);
        } else if (t === WATER) {
          const b = at(x, y + 1);
          if (b >= 0 && (type[b] === E || type[b] === SMOKE)) {
            move(b);
            continue;
          }
          const d1 = at(x + dir, y + 1);
          if (d1 >= 0 && type[d1] === E) {
            move(d1);
            continue;
          }
          for (const dx of [dir, -dir, dir * 2, -dir * 2]) {
            const sIdx = at(x + dx, y);
            if (
              sIdx >= 0 &&
              type[sIdx] === E &&
              (Math.abs(dx) === 1 || type[at(x + Math.sign(dx), y)] === E)
            ) {
              move(sIdx);
              break;
            }
          }
        } else if (t === FIRE) {
          if (life[i] <= 1) {
            set(
              i,
              Math.random() < 0.5 ? SMOKE : E,
              40 + ((Math.random() * 30) | 0),
            );
            continue;
          }
          life[i]--;
          const w = near(x, y, WATER);
          if (w >= 0) {
            set(i, SMOKE, 50);
            set(w, SMOKE, 40);
            continue;
          }
          for (const tt of [PLANT, SEED]) {
            const p = near(x, y, tt);
            if (p >= 0 && Math.random() < 0.35)
              set(p, FIRE, 25 + ((Math.random() * 25) | 0));
          }
          const u = at(x + ((Math.random() * 3) | 0) - 1, y - 1);
          if (u >= 0 && type[u] === E && Math.random() < 0.7) move(u);
        } else if (t === SMOKE) {
          if (life[i] <= 1) {
            set(i, E);
            continue;
          }
          life[i]--;
          const u = at(x + ((Math.random() * 3) | 0) - 1, y - 1);
          if (u >= 0 && type[u] === E) move(u);
        } else if (t === PLANT && Math.random() < 0.025) {
          const w = near(x, y, WATER);
          if (w >= 0) {
            set(w, PLANT);
            stamp[w] = f;
          }
        }
      }
  };
  const draw = () => {
    for (let i = 0; i < n; i++) {
      const t = type[i];
      px32[i] = t
        ? LUT[t][t === FIRE ? (life[i] * 3 + (frame & 3)) & 15 : shade[i] & 15]
        : BG;
    }
    g.putImageData(img, 0, 0);
  };

  const ptr = pointer(el, cv);
  let mat = SAND;
  const pour = () => {
    const cx = Math.round(ptr.x);
    const cy = Math.round(ptr.y);
    const rad = mat === WALL ? 2 : 3;
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const i = at(cx + dx, cy + dy);
        if (i < 0) continue;
        if (mat === E) {
          // The floor stays, so the sandbox never empties out the bottom.
          if (cy + dy < F) set(i, E);
          continue;
        }
        if (type[i] !== E || (mat !== WALL && Math.random() > 0.45)) continue;
        set(i, mat, mat === FIRE ? 30 + ((Math.random() * 40) | 0) : 0);
      }
  };
  const run = loop(() => {
    if (ptr.down) pour();
    tick();
    draw();
  });

  return {
    use: (m) => (mat = OF[m]),
    clear: () => {
      type.fill(0, 0, F * C);
      life.fill(0, 0, F * C);
    },
    reset: scene,
    pause: run.pause,
    dispose() {
      run.stop();
      ptr.off();
      cv.remove();
    },
  };
}
