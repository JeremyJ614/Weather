/*
  Galaxy Forge: a spiral galaxy of tens of thousands of stars (a warm bulge, an exponential
  disk, two log-spiral arms with pink star-forming knots) orbiting a softened core, and a
  second galaxy to throw at it. Stars feel only the cores (the classic Toomre & Toomre 1972
  experiment), so tidal tails and bridges form as the pair falls together and merges.
  Written for StormSync.
*/
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";
import { addCanvas, loseContext, program } from "./gl";

export type Galaxy = Scene & {
  collide(): void;
  single(): void;
};

type Core = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  m: number;
  on: boolean;
};
type Palette = Record<"bulge" | "in" | "out" | "knot", number[]>;

const GOLD: Palette = {
  bulge: [1, 0.82, 0.55],
  in: [1, 0.93, 0.8],
  out: [0.62, 0.74, 1],
  knot: [1, 0.45, 0.72],
};
const LILAC: Palette = {
  bulge: [1, 0.78, 0.7],
  in: [0.92, 0.82, 1],
  out: [0.55, 0.85, 0.95],
  knot: [1, 0.5, 0.8],
};
/** Softening, so stars passing through a core don't fling off. */
const EPS2 = 0.09;
const vcirc = (r: number, m: number) =>
  Math.sqrt((m * r * r) / Math.pow(r * r + EPS2, 1.5));
const gauss = () =>
  Math.sqrt(-2 * Math.log(1 - Math.random())) *
  Math.cos(2 * Math.PI * Math.random());
const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

const VS = `attribute vec3 aPosition;attribute vec4 aCol;uniform mat3 uRot;uniform float uDist,uScale,uSize,uAspect;varying vec4 vC;
void main(){vec3 p=uRot*aPosition;float z=uDist-p.z;gl_Position=vec4(p.x*uScale/(z*uAspect),p.y*uScale/z,0.,1.);gl_PointSize=clamp(uSize/z,1.4,7.);vC=aCol;vC.a*=clamp(3.2/z,.3,1.);}`;
const FS = `precision mediump float;varying vec4 vC;void main(){vec2 d=gl_PointCoord-.5;float a=smoothstep(.5,.0,length(d));gl_FragColor=vec4(vC.rgb*a*vC.a*.5,1.);}`;

export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Galaxy> {
  const cv = addCanvas(el);
  const gl = (cv.getContext("webgl", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  }) ?? null) as WebGLRenderingContext | null;
  if (!gl) {
    cv.remove();
    throw new Error("WebGL is off");
  }
  const N = tier === "low" ? 12000 : tier === "mid" ? 26000 : 40000;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const col = new Float32Array(N * 4);
  const cores: Core[] = [
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 1, on: true },
    { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 0.7, on: false },
  ];

  function disk(
    from: number,
    to: number,
    core: Core,
    tilt: number,
    pal: Palette,
    sense: number,
  ) {
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    for (let i = from; i < to; i++) {
      const bulge = Math.random() < 0.16;
      let r: number;
      let a: number;
      let lz: number;
      let c: number[];
      let al: number;
      if (bulge) {
        r = Math.min(0.35, Math.abs(gauss()) * 0.11 + 0.01);
        a = Math.random() * Math.PI * 2;
        lz = gauss() * 0.06 * (1 - r * 2);
        c = pal.bulge;
        al = 0.45 + Math.random() * 0.4;
      } else {
        r = Math.min(1.25, 0.06 - 0.3 * Math.log(1 - Math.random() * 0.985));
        const arm = Math.random() < 0.5 ? 0 : Math.PI;
        a =
          Math.random() < 0.72
            ? arm + Math.log(r) * 2.6 + gauss() * (0.22 + 0.1 * r)
            : Math.random() * Math.PI * 2;
        lz = gauss() * 0.018;
        const t = Math.min(1, r / 1.1);
        c =
          Math.random() < 0.06 && r > 0.25
            ? pal.knot
            : pal.in.map((v, k) => v + (pal.out[k] - v) * t);
        al = 0.3 + Math.random() * 0.45;
      }
      const lx = Math.cos(a) * r;
      const ly = Math.sin(a) * r;
      const v = vcirc(r, core.m) * sense * (bulge ? 0.55 : 1);
      const disp = bulge ? 0.12 : 0.02;
      const lvx = -Math.sin(a) * v + gauss() * disp;
      const lvy = Math.cos(a) * v + gauss() * disp;
      const lvz = gauss() * disp * 0.5;
      pos[i * 3] = core.x + lx;
      pos[i * 3 + 1] = core.y + ly * ct - lz * st;
      pos[i * 3 + 2] = core.z + ly * st + lz * ct;
      vel[i * 3] = core.vx + lvx;
      vel[i * 3 + 1] = core.vy + lvy * ct - lvz * st;
      vel[i * 3 + 2] = core.vz + lvy * st + lvz * ct;
      col.set([c[0], c[1], c[2], al], i * 4);
    }
  }
  let colorDirty = true;
  function reset(collide: boolean) {
    Object.assign(cores[0], { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
    cores[1].on = collide;
    colorDirty = true;
    if (!collide) return disk(0, N, cores[0], 0, GOLD, 1);
    const nA = Math.round(N * 0.6);
    Object.assign(cores[1], { x: 2.2, y: 1.5, z: 0.5 });
    // Just under escape speed, so the pair is bound and merges after a pass or two.
    const d = Math.hypot(2.2, 1.5, 0.5);
    const v = Math.sqrt((2 * (cores[0].m + cores[1].m)) / d) * 0.92;
    Object.assign(cores[1], { vx: -v * 0.62, vy: -v * 0.78, vz: -v * 0.1 });
    const k = cores[1].m / cores[0].m;
    Object.assign(cores[0], {
      vx: -cores[1].vx * k,
      vy: -cores[1].vy * k,
      vz: -cores[1].vz * k,
    });
    disk(0, nA, cores[0], 0.25, GOLD, 1);
    disk(nA, N, cores[1], 1.05, LILAC, -1);
  }
  reset(false);

  const pr = program(gl, VS, FS);
  pr.bind();
  const pb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  const cb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cb);
  gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);

  const dpr = dprFor(tier);
  const unwatch = watchSize(el, (w, h) => {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  });

  // Drag to turn (it keeps the spin you give it, then eases back to a slow drift); wheel to zoom.
  const drift = reduced ? 0 : 0.05;
  let yaw = 0.4;
  let pitch = 0.72;
  let zoom = 1;
  let dist = 3.8;
  let vyaw = drift;
  let vpitch = 0;
  let hold: { id: number; x: number; y: number; t: number } | null = null;
  const down = (e: PointerEvent) => {
    if (hold) return;
    hold = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
  };
  const move = (e: PointerEvent) => {
    if (!hold || e.pointerId !== hold.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - hold.t) / 1000;
    vyaw = ((e.clientX - hold.x) / dt) * 0.004;
    vpitch = ((e.clientY - hold.y) / dt) * 0.004;
    hold = { id: hold.id, x: e.clientX, y: e.clientY, t: now };
  };
  const up = (e: PointerEvent) => {
    if (hold && e.pointerId === hold.id) hold = null;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    zoom = clamp(zoom * Math.exp(-e.deltaY * 0.001), 0.5, 2.5);
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("wheel", wheel, { passive: false });

  let speed = reduced ? 0.2 : 0.35;
  function integrate(dt: number) {
    const [a, b] = cores;
    if (b.on) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const r2 = dx * dx + dy * dy + dz * dz + EPS2;
      const inv = 1 / (r2 * Math.sqrt(r2));
      a.vx += dx * inv * b.m * dt;
      a.vy += dy * inv * b.m * dt;
      a.vz += dz * inv * b.m * dt;
      b.vx -= dx * inv * a.m * dt;
      b.vy -= dy * inv * a.m * dt;
      b.vz -= dz * inv * a.m * dt;
      // Dynamical friction when the cores are close (the dark halos stand in for it).
      const sep = Math.sqrt(r2);
      const drag = sep < 1.4 ? 0.5 * (1.4 - sep) * dt : 0;
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const rvz = b.vz - a.vz;
      const fa = b.m / (a.m + b.m);
      const fb = a.m / (a.m + b.m);
      a.vx += rvx * drag * fa;
      a.vy += rvy * drag * fa;
      a.vz += rvz * drag * fa;
      b.vx -= rvx * drag * fb;
      b.vy -= rvy * drag * fb;
      b.vz -= rvz * drag * fb;
      for (const c of cores) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z += c.vz * dt;
      }
    }
    for (let j = 0; j < N * 3; j += 3) {
      const x = pos[j];
      const y = pos[j + 1];
      const z = pos[j + 2];
      let dx = a.x - x;
      let dy = a.y - y;
      let dz = a.z - z;
      let r2 = dx * dx + dy * dy + dz * dz + EPS2;
      let k = a.m / (r2 * Math.sqrt(r2));
      let ax = dx * k;
      let ay = dy * k;
      let az = dz * k;
      if (b.on) {
        dx = b.x - x;
        dy = b.y - y;
        dz = b.z - z;
        r2 = dx * dx + dy * dy + dz * dz + EPS2;
        k = b.m / (r2 * Math.sqrt(r2));
        ax += dx * k;
        ay += dy * k;
        az += dz * k;
      }
      vel[j] += ax * dt;
      vel[j + 1] += ay * dt;
      vel[j + 2] += az * dt;
      pos[j] = x + vel[j] * dt;
      pos[j + 1] = y + vel[j + 1] * dt;
      pos[j + 2] = z + vel[j + 2] * dt;
    }
  }

  const rot = new Float32Array(9);
  const run = loop((_, dt) => {
    const steps = tier === "low" ? 2 : 3;
    for (let s = 0; s < steps; s++) integrate((dt * speed) / steps);
    if (!hold) {
      vyaw += (drift - vyaw) * Math.min(1, dt * 0.8);
      vpitch *= Math.pow(0.1, dt);
    }
    yaw += vyaw * dt;
    pitch = clamp(pitch + vpitch * dt, 0.15, 1.45);
    // Keep the pair's center of mass in the middle of the view.
    const [a, b] = cores;
    const m = b.on ? a.m + b.m : a.m;
    const cx = (a.x * a.m + (b.on ? b.x * b.m : 0)) / m;
    const cy = (a.y * a.m + (b.on ? b.y * b.m : 0)) / m;
    const cz = (a.z * a.m + (b.on ? b.z * b.m : 0)) / m;
    for (let j = 0; j < N * 3; j += 3) {
      pos[j] -= cx;
      pos[j + 1] -= cy;
      pos[j + 2] -= cz;
    }
    for (const c of cores) {
      c.x -= cx;
      c.y -= cy;
      c.z -= cz;
    }
    const sy = Math.sin(yaw);
    const cyw = Math.cos(yaw);
    const sp = Math.sin(pitch);
    const cp = Math.cos(pitch);
    rot.set([cyw, sy, 0, -sy * cp, cyw * cp, sp, sy * sp, -cyw * sp, cp]);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0.012, 0.013, 0.03, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix3fv(pr.u.uRot, false, rot);
    const aspect = cv.width / cv.height;
    // Pull back while the galaxies are far apart so both stay in frame.
    const sep = b.on ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) : 0;
    dist += (Math.max(3.8, 2.6 + sep * 1.25) - dist) * Math.min(1, dt * 1.5);
    gl.uniform1f(pr.u.uDist, dist / zoom);
    gl.uniform1f(pr.u.uScale, aspect < 1 ? 3.3 * aspect : 3);
    gl.uniform1f(pr.u.uAspect, aspect);
    gl.uniform1f(pr.u.uSize, (tier === "high" ? 9 : 8) * dpr);
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    if (colorDirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, cb);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, col);
      colorDirty = false;
    }
    gl.drawArrays(gl.POINTS, 0, N);
  });

  return {
    collide() {
      reset(true);
      speed = reduced ? 0.3 : 0.55;
    },
    single() {
      reset(false);
      speed = reduced ? 0.2 : 0.35;
    },
    pause: run.pause,
    dispose() {
      run.stop();
      unwatch();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      loseContext(gl);
      cv.remove();
    },
  };
}
