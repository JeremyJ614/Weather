/*
  Adapted from Techartist's "Three.js + GLSL Particle Animation" CodePen (MIT License):
  https://codepen.io/VoXelo/pen/NPbGqrx
  Particles that form a tornado, a lightning strike, Saturn, a butterfly, an astrolabe and a
  DNA helix, morphing from one to the next. The astrolabe and the helix are the pen's; the
  rest are ours. Each lightning strike is a new bolt, grown in JavaScript the way real
  lightning branches (see growBolt).
*/
import * as THREE from "three";
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";
import { teardown } from "./util";

export const SHAPES = [
  "Tornado",
  "Lightning strike",
  "Saturn",
  "Butterfly",
  "Astrolabe",
  "DNA helix",
];
export type Morph = Scene & { next(): number };

const VERT = /* glsl */ `
      uniform float uTime;
      uniform float uMorphProgress;
      uniform int uCurrentShape;
      uniform int uTargetShape;
      uniform vec2 uMouse;
      uniform float uSize;

      attribute float aId;
      attribute vec3 aRandom;
      // Where this particle sits in the current lightning bolt, and how bright that part is.
      attribute vec3 aBolt;
      attribute float aBoltB;

      varying vec3 vColor;
      varying float vAlpha;

      #define PI 3.14159265359

      vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
          return a + b*cos( 6.28318*(c*t+d) );
      }

      vec3 getAstrolabe(float id, vec3 rnd) {
          vec3 pos;
          
          if (rnd.x > 0.3) {
              float t = id * PI * 2.0;
              float u = t * 13.0;
              float v = t * 8.0;
              
              float r = 12.0 + 3.0 * cos(v);
              pos = vec3(r * cos(u), r * sin(u), 4.0 * sin(v));
              
              float noiseAngle = rnd.y * PI * 2.0;
              float noiseRadius = rnd.z * 1.5;
              pos += vec3(cos(noiseAngle), sin(noiseAngle), cos(noiseAngle)) * noiseRadius;
          } else {
              float ringIdx = floor(rnd.y * 3.0);
              float angle = id * PI * 2.0 * 1000.0 + uTime * 0.2 * (ringIdx > 1.0 ? -1.0 : 1.0);
              float r = 24.0 + ringIdx * 4.0 + (rnd.z * 0.5);
              
              pos = vec3(r * cos(angle), (rnd.x - 0.15) * 2.0, r * sin(angle));
              
              float tilt = 0.5 + ringIdx * 0.8;
              float rotX = cos(tilt); float rotY = sin(tilt);
              pos.yz = mat2(rotX, -rotY, rotY, rotX) * pos.yz;
              pos.xy = mat2(rotX, -rotY, rotY, rotX) * pos.xy;
          }
          return pos * 0.85;
      }

      vec3 getDNA(float id, vec3 rnd) {
          float h = (id - 0.5) * 75.0;
          float angle = h * 0.5 + uTime * 0.5;
          float radius = 16.0;
          
          float strand = step(0.5, rnd.x);
          angle += strand * PI;
          
          vec3 pos = vec3(cos(angle) * radius, h, sin(angle) * radius);
          
          float rungZone = fract(h * 0.5);
          if (rungZone < 0.15 && rnd.y > 0.4) {
              float span = (rnd.z * 2.0 - 1.0); 
              pos = vec3(span * cos(angle - strand*PI) * radius, h, span * sin(angle - strand*PI) * radius);
          } else {
              pos += (rnd - 0.5) * 1.0;
          }
          
          return pos;
      }

      float tri(float x) { return abs(fract(x) - 0.5) * 4.0 - 1.0; }

      // A funnel under a rotating wall cloud, with a debris cloud where it meets the ground.
      // It spins faster toward the ground and its rope sways.
      vec3 getTornado(float id, vec3 rnd) {
          vec3 pos;
          if (rnd.x < 0.62) {
              float t = rnd.y;
              float y = -30.0 + t * 54.0;
              float r = 1.3 + pow(t, 2.3) * 15.0;
              r *= 0.75 + 0.5 * fract(id * 977.0);
              float a = rnd.z * PI * 2.0 + uTime * (4.5 - 3.0 * t);
              float sway = sin(t * 3.0 + uTime * 0.6) * 4.0 * (1.0 - t);
              pos = vec3(cos(a) * r + sway, y, sin(a) * r);
          } else if (rnd.x < 0.86) {
              float r = sqrt(rnd.y) * 38.0;
              float a = rnd.z * PI * 2.0 + uTime * (0.6 - r * 0.01);
              float y = 25.0 + (fract(id * 331.0) - 0.5) * 4.0 - (1.0 - r / 38.0) * 3.5;
              pos = vec3(cos(a) * r, y, sin(a) * r);
          } else {
              float k = rnd.y;
              float a = rnd.z * PI * 2.0 + uTime * 5.0;
              float r = 2.0 + k * 10.0 + sin(id * 500.0) * 1.2;
              pos = vec3(cos(a) * r + sin(uTime * 0.6) * 4.0, -30.0 + k * k * 11.0, sin(a) * r);
          }
          return pos;
      }

      // Saturn: a banded, slightly squashed planet and its rings (the bright B ring, the
      // Cassini Division gap, the A ring), tilted as we usually see it.
      vec3 getSaturn(float id, vec3 rnd) {
          vec3 pos;
          if (rnd.x < 0.42) {
              float th = rnd.y * PI * 2.0 + uTime * 0.12;
              float cz = rnd.z * 2.0 - 1.0;
              float s = sqrt(max(1.0 - cz * cz, 0.0));
              pos = vec3(s * cos(th), cz * 0.9, s * sin(th)) * 13.0;
          } else {
              float u = rnd.y;
              float r = 17.0 + u * 14.0;
              // nothing in the Cassini Division: those particles move to its edges
              if (r > 25.2 && r < 26.4) r = r < 25.8 ? 25.2 : 26.4;
              float a = rnd.z * PI * 2.0 + uTime * 0.35 / sqrt(r / 17.0);
              pos = vec3(cos(a) * r, (fract(id * 913.0) - 0.5) * 0.3, sin(a) * r);
          }
          float tilt = 0.42;
          pos.yz = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * pos.yz;
          pos.xy = mat2(cos(0.18), -sin(0.18), sin(0.18), cos(0.18)) * pos.xy;
          return pos * 0.82;
      }

      // Temple Fay's butterfly curve, filled in to make the wings, flapping on its body.
      float fay(float t) {
          return exp(cos(t)) - 2.0 * cos(4.0 * t) - pow(sin(t / 12.0), 5.0);
      }
      vec3 getButterfly(float id, vec3 rnd) {
          float flap = 0.25 + 0.6 * (0.5 + 0.5 * sin(uTime * 2.6));
          if (rnd.x < 0.9) {
              float t = rnd.y * 12.0 * PI;
              float fill = pow(rnd.z, 0.45);
              vec2 p = vec2(sin(t), cos(t)) * fay(t) * fill * 7.0;
              float side = p.x < 0.0 ? -1.0 : 1.0;
              float x = abs(p.x);
              return vec3(side * x * cos(flap), p.y - 6.0, x * sin(flap));
          }
          if (rnd.x < 0.95) {
              // the body: head, thorax and a long abdomen
              float k = (rnd.x - 0.9) / 0.05;
              float y = mix(-15.0, 9.0, k);
              float r = (0.6 + 1.1 * sin(k * PI)) * (k > 0.88 ? 1.5 : 1.0);
              float a = rnd.z * PI * 2.0;
              return vec3(cos(a) * r, y, sin(a) * r);
          }
          // antennae, clubbed at the tips
          float side = rnd.y < 0.5 ? -1.0 : 1.0;
          float k = fract(rnd.y * 2.0);
          vec3 tip = vec3(side * (k * 6.0 + k * k * 2.0), 9.5 + k * 11.0, k * 2.0);
          return tip + (fract(vec3(id * 37.0, id * 59.0, id * 83.0)) - 0.5) * (k > 0.9 ? 1.6 : 0.35);
      }

      vec3 getShapePosition(int shape, float id, vec3 rnd) {
          if (shape == 0) return getTornado(id, rnd);
          if (shape == 1) return aBolt;
          if (shape == 2) return getSaturn(id, rnd);
          if (shape == 3) return getButterfly(id, rnd);
          if (shape == 4) return getAstrolabe(id, rnd);
          if (shape == 5) return getDNA(id, rnd);
          return vec3(0.0);
      }

      vec3 getShapeColor(int shape, float id, vec3 rnd) {
          if (shape == 0) {
              if (rnd.x < 0.62) return mix(vec3(0.55, 0.6, 0.68), vec3(0.75, 0.8, 0.88), rnd.y);
              if (rnd.x < 0.86) return vec3(0.28, 0.32, 0.42) + 0.1 * fract(id * 331.0);
              return vec3(0.6, 0.45, 0.32);
          }
          if (shape == 1) {
              // Strikes, then a restrike, then the channel glows down until the next bolt.
              float f = fract(uTime * 0.3);
              float flash = 0.25 + 0.75 * max(max(step(f, 0.04), step(abs(f - 0.09), 0.02)), exp(-f * 9.0));
              // the hot white core of each channel, violet at its glowing edge, dimmer down
              // the branches; the cloud base lit from inside
              vec3 core = mix(vec3(0.5, 0.42, 1.0), vec3(1.0, 0.98, 1.0), smoothstep(0.35, 0.9, aBoltB));
              if (aBoltB > 0.0) return core * (0.35 + aBoltB) * flash;
              return vec3(0.22, 0.2, 0.36) * (0.5 + 1.4 * flash);
          }
          if (shape == 2) {
              // Saturn's pale gold bands, lit from one side; its rings cream and grey
              if (rnd.x < 0.42) {
                  float cz = rnd.z * 2.0 - 1.0;
                  float band = 0.5 + 0.5 * sin(cz * 19.0 + 0.6 * sin(cz * 7.0));
                  vec3 c = mix(vec3(0.62, 0.46, 0.3), vec3(0.96, 0.86, 0.62), band);
                  c = mix(c, vec3(0.75, 0.68, 0.55), smoothstep(0.85, 1.0, abs(cz)));
                  float th = rnd.y * PI * 2.0 + uTime * 0.12;
                  float s = sqrt(max(1.0 - cz * cz, 0.0));
                  float lit = max(dot(vec3(s * cos(th), cz, s * sin(th)), normalize(vec3(-0.8, 0.35, 0.6))), 0.0);
                  return c * (0.22 + 0.9 * lit);
              }
              float u = rnd.y;
              float rings = mix(0.45, 1.0, smoothstep(0.15, 0.3, u)) * mix(1.0, 0.62, step(0.62, u));
              float fine = 0.8 + 0.2 * sin(u * 140.0);
              return mix(vec3(0.55, 0.5, 0.45), vec3(0.95, 0.88, 0.72), rings) * rings * fine;
          }
          if (shape == 3) {
              // iridescent wings: teal to violet, a bright rim, dark veins and two eyespots
              if (rnd.x < 0.9) {
                  float t = rnd.y * 12.0 * PI;
                  float fill = pow(rnd.z, 0.45);
                  vec2 p = vec2(sin(t), cos(t)) * fay(t) * fill * 7.0;
                  vec3 c = palette(fill * 0.7 + p.y * 0.012 + uTime * 0.04, vec3(0.45, 0.5, 0.7), vec3(0.35, 0.35, 0.3), vec3(1.0, 1.0, 1.0), vec3(0.55, 0.65, 0.8));
                  c *= 0.75 + 0.25 * step(0.08, abs(fract(t * 1.6) - 0.5));
                  c = mix(c, vec3(0.95, 0.98, 1.0), smoothstep(0.93, 1.0, fill));
                  float eye = length(vec2(abs(p.x), p.y) - vec2(11.0, 9.0));
                  c = mix(c, vec3(1.0, 0.55, 0.15), 1.0 - smoothstep(1.8, 2.6, eye));
                  c = mix(c, vec3(0.05, 0.03, 0.08), 1.0 - smoothstep(0.9, 1.4, eye));
                  return c;
              }
              return vec3(0.24, 0.2, 0.3);
          }
          if (shape == 4) return palette(id + uTime*0.05, vec3(0.5, 0.5, 0.6), vec3(0.3, 0.3, 0.4), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.33, 0.67));
          if (shape == 5) {
              float h = (id - 0.5) * 60.0; 
              float rungZone = fract(h * 0.5);
              if(rungZone < 0.15 && rnd.y > 0.4) return vec3(0.0, 0.9, 0.4);
              return palette(id * 0.1, vec3(0.2, 0.6, 0.8), vec3(0.1, 0.3, 0.4), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.2, 0.4));
          }
          return vec3(1.0);
      }

      float cubicInOut(float t) {
          return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
      }

      void main() {
          vec3 p1 = getShapePosition(uCurrentShape, aId, aRandom);
          vec3 p2 = getShapePosition(uTargetShape, aId, aRandom);
          
          vec3 c1 = getShapeColor(uCurrentShape, aId, aRandom);
          vec3 c2 = getShapeColor(uTargetShape, aId, aRandom);

          float easedMorph = cubicInOut(uMorphProgress);
          
          vec3 finalPos = mix(p1, p2, easedMorph);
          
          float breatheMask = sin(uMorphProgress * PI);
          finalPos += normalize(finalPos) * breatheMask * 8.0;

          float rotY = uTime * 0.1 + uMouse.x * 0.5;
          float rotX = uMouse.y * 0.5;
          
          mat3 rotMatY = mat3(
              cos(rotY), 0.0, sin(rotY),
              0.0, 1.0, 0.0,
              -sin(rotY), 0.0, cos(rotY)
          );
          
          mat3 rotMatX = mat3(
              1.0, 0.0, 0.0,
              0.0, cos(rotX), -sin(rotX),
              0.0, sin(rotX), cos(rotX)
          );
          
          finalPos = rotMatY * rotMatX * finalPos;

          vColor = mix(c1, c2, easedMorph);
          
          vAlpha = 0.3 + 0.7 * sin(uTime * 5.0 + aId * PI * 20.0);

          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          gl_PointSize = uSize * (2.0 + aRandom.x * 2.5) * (40.0 / -mvPosition.z);
      }
    `;
const FRAG = /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
          vec2 uv = gl_PointCoord.xy - vec2(0.5);
          float dist = length(uv);
          
          if (dist > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.1, dist);

          gl_FragColor = vec4(vColor, alpha * vAlpha);
      }
    `;

type V3 = [number, number, number];
export type Seg = { a: V3; b: V3; w: number };
const GROUND = -30;

/**
 * One cloud-to-ground bolt, grown the way a stepped leader is: a tortuous channel stepping
 * down from the cloud base, kinking at every step, with branches forking off it (and off
 * them), each fainter than its parent; plus crawlers spreading through the cloud base. `w`
 * is each segment's brightness: 1 for the main channel.
 */
export function growBolt(rand: () => number = Math.random): Seg[] {
  const segs: Seg[] = [];
  const walk = (
    start: V3,
    drift: number,
    len: number,
    w: number,
    depth: number,
  ) => {
    let p = start;
    let vx = drift;
    let vz = (rand() - 0.5) * 1.2;
    let gone = 0;
    while (gone < len && p[1] > GROUND) {
      const dy = 0.7 + rand() * 1.9;
      vx = vx * 0.55 + drift * 0.25 - p[0] * 0.035 + (rand() - 0.5) * 2.8;
      vz = vz * 0.55 + (rand() - 0.5) * 2.2;
      const q: V3 = [p[0] + vx, Math.max(GROUND, p[1] - dy), p[2] + vz];
      segs.push({ a: p, b: q, w });
      gone += Math.hypot(vx, dy, vz);
      if (depth < 2 && q[1] > GROUND + 8 && rand() < (depth ? 0.08 : 0.15)) {
        const side = rand() < 0.5 ? -1 : 1;
        walk(
          q,
          side * (0.9 + rand() * 1.3),
          (depth ? 6 : 10) + rand() * (depth ? 8 : 20),
          w * (depth ? 0.42 : 0.5),
          depth + 1,
        );
      }
      p = q;
    }
  };
  const top: V3 = [(rand() - 0.5) * 10, 26, (rand() - 0.5) * 4];
  walk(top, (rand() - 0.5) * 0.8, Infinity, 1, 0);
  // crawlers: faint channels running out through the cloud base from the top of the bolt
  for (let c = 0; c < 4; c++) {
    let p = top;
    const dir = rand() * Math.PI * 2;
    for (let k = 0; k < 9 + rand() * 9; k++) {
      const q: V3 = [
        p[0] + Math.cos(dir) * 2.4 + (rand() - 0.5) * 2.2,
        26 + (rand() - 0.5) * 2,
        p[2] + Math.sin(dir) * 2.4 + (rand() - 0.5) * 2.2,
      ];
      segs.push({ a: p, b: q, w: 0.22 });
      p = q;
    }
  }
  return segs;
}

/** Lays the particles on a bolt: most on its channels (a tight core and a soft glow), some in the cloud base it lights, the rest in the flash where it lands. */
function fillBolt(
  segs: Seg[],
  rnd: Float32Array,
  pos: Float32Array,
  glow: Float32Array,
) {
  const cum: number[] = [];
  let total = 0;
  for (const s of segs) {
    total +=
      Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]) *
      (0.25 + s.w);
    cum.push(total);
  }
  const main = segs.filter((s) => s.w === 1);
  const land = main[main.length - 1]?.b ?? [0, GROUND, 0];
  const top = segs[0]?.a ?? [0, 26, 0];
  const n = glow.length;
  for (let i = 0; i < n; i++) {
    const x = rnd[3 * i];
    let p: V3;
    let b = 0;
    if (x < 0.6) {
      const u = Math.random() * total;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (cum[m] < u) lo = m + 1;
        else hi = m;
      }
      const s = segs[lo];
      const f = Math.random();
      const halo = Math.random() < 0.22;
      const j = halo ? 0.5 + Math.random() * 1.1 : 0.1;
      p = [
        s.a[0] + (s.b[0] - s.a[0]) * f + (Math.random() - 0.5) * j,
        s.a[1] + (s.b[1] - s.a[1]) * f + (Math.random() - 0.5) * j,
        s.a[2] + (s.b[2] - s.a[2]) * f + (Math.random() - 0.5) * j,
      ];
      b = s.w * (halo ? 0.45 : 1);
    } else if (x < 0.93) {
      const r = Math.sqrt(Math.random()) * 40;
      const a = Math.random() * Math.PI * 2;
      p = [
        top[0] * 0.5 + Math.cos(a) * r,
        28 + (Math.random() - 0.5) * 4 * (1 - r / 44),
        top[2] * 0.5 + Math.sin(a) * r,
      ];
    } else {
      const r = Math.random() * 7;
      const a = Math.random() * Math.PI * 2;
      p = [
        land[0] + Math.cos(a) * r,
        GROUND + Math.random() * (1 - r / 7) * 2,
        land[2] + Math.sin(a) * r,
      ];
      b = 0.6 * (1 - r / 7) + 0.05;
    }
    pos[3 * i] = p[0];
    pos[3 * i + 1] = p[1];
    pos[3 * i + 2] = p[2];
    glow[i] = b;
  }
}

export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Morph> {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({
    antialias: tier !== "low",
    alpha: true,
  });
  renderer.setPixelRatio(dprFor(tier));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  el.appendChild(renderer.domElement);
  const count = tier === "high" ? 100000 : tier === "mid" ? 60000 : 30000;
  const g = new THREE.BufferGeometry();
  const ids = new Float32Array(count);
  const rnd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    ids[i] = i / count;
    rnd[3 * i] = Math.random();
    rnd[3 * i + 1] = Math.random();
    rnd[3 * i + 2] = Math.random();
  }
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  g.setAttribute("aId", new THREE.BufferAttribute(ids, 1));
  g.setAttribute("aRandom", new THREE.BufferAttribute(rnd, 3));
  const boltPos = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  const boltGlow = new THREE.BufferAttribute(new Float32Array(count), 1);
  boltPos.setUsage(THREE.DynamicDrawUsage);
  boltGlow.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute("aBolt", boltPos);
  g.setAttribute("aBoltB", boltGlow);
  const strike = () => {
    fillBolt(
      growBolt(),
      rnd,
      boltPos.array as Float32Array,
      boltGlow.array as Float32Array,
    );
    boltPos.needsUpdate = true;
    boltGlow.needsUpdate = true;
  };
  strike();
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80);
  const uniforms = {
    uTime: { value: 0 },
    uMorphProgress: { value: 0 },
    uCurrentShape: { value: 0 },
    uTargetShape: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
    uSize: { value: Math.min(1.8, Math.sqrt(100000 / count)) },
  };
  scene.add(
    new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  const unwatch = watchSize(el, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.z =
      30 / Math.tan((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect);
    renderer.setSize(w, h);
  });
  // Tilt toward the finger or pointer, eased.
  const target = new THREE.Vector2();
  const mouse = new THREE.Vector2();
  const point = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    target.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  };
  el.addEventListener("pointermove", point);
  let from = 0;
  let to = 0;
  let morph = 0;
  let moving = false;
  const speed = reduced ? 0.3 : 1;
  let bolt = 0;
  const l = loop((t, dt) => {
    // A new bolt for every strike (the shader flashes once per 1 / 0.3 s of its clock).
    const n = Math.floor(t * speed * 0.3);
    if (n !== bolt) {
      bolt = n;
      if (from === 1 || to === 1) strike();
    }
    mouse.x += (target.x - mouse.x) * dt * 2;
    mouse.y += (target.y - mouse.y) * dt * 2;
    if (moving) {
      morph += dt * 0.8;
      if (morph >= 1) {
        morph = 0;
        from = to;
        moving = false;
      }
    }
    uniforms.uTime.value = t * speed;
    uniforms.uMorphProgress.value = morph;
    uniforms.uCurrentShape.value = from;
    uniforms.uTargetShape.value = to;
    uniforms.uMouse.value.copy(mouse);
    renderer.render(scene, camera);
  });
  return {
    pause: l.pause,
    next() {
      if (!moving) {
        to = (from + 1) % SHAPES.length;
        moving = true;
        morph = 0;
      }
      return to;
    },
    dispose() {
      l.stop();
      unwatch();
      el.removeEventListener("pointermove", point);
      teardown(scene, renderer);
    },
  };
}
