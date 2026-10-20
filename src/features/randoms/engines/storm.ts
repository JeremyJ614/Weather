/*
  Built on Techartist's "Cosmic Anomaly Visualizer" CodePen (MIT License):
  https://codepen.io/VoXelo/pen/KwNXwxY
  The same morphing-particle engine (GPU-placed points, bloom, orbit), with the cosmic
  objects replaced by storms drawn from their real structure.
*/
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";
import { teardown } from "./util";

export const STORMS = [
  {
    name: "Supercell",
    copy: "A thunderstorm with a deep, persistently rotating updraft called a mesocyclone. Supercells make most of the strongest tornadoes and the biggest hail, and can last for hours.",
    structure:
      'A broad, striated, rotating base (the "mothership") under a towering updraft of billowing cloud, an anvil spreading far downstream with an overshooting top, a flanking line of towers stepping down behind, a lowered wall cloud with its tail cloud, the forward-flank rain and hail core, and rain wrapping round the back on the rear-flank downdraft.',
    signs:
      "Mammatus hanging under the anvil, a wall cloud under the updraft, and lightning packed into the core.",
    motion:
      "Air spirals as it rises. The whole storm usually drifts to the right of the winds steering it.",
  },
  {
    name: "Tornado",
    copy: "A violently rotating column of air in contact with the ground, hanging from a storm's wall cloud. Winds run from about 65 mph (EF0) to over 200 mph (EF5).",
    structure:
      "A condensation funnel that widens with height, a debris cloud at the ground, the rotating wall cloud and mesocyclone above, and the rear-flank downdraft wrapping around it.",
    signs:
      "Debris lofted at the base: the sure sign the circulation is on the ground, even when the funnel isn't.",
    motion:
      "Fastest near the ground. The funnel bends and ropes out as cool outflow undercuts it.",
  },
  {
    name: "Hurricane",
    copy: "A warm-core tropical cyclone with sustained winds of 74 mph or more, running on heat from warm ocean water.",
    structure:
      "A calm eye ringed by the eyewall's tallest storms, spiral rain bands reaching out hundreds of miles, and a cirrus canopy fanning out on top.",
    signs:
      "The eyewall leans outward with height (the stadium effect), and the bands curl in toward the center.",
    motion:
      "Air spirals in counter-clockwise near the surface (Northern Hemisphere) and fans out clockwise aloft; the strongest winds are in the eyewall.",
  },
] as const;

const VERT = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform int uFrom;
uniform int uTo;
uniform float uFlash;
uniform vec3 uFlashAt;
uniform float uSize;
uniform float uGain;
attribute float aId;
attribute vec3 aRandom;
varying vec3 vColor;
varying float vAlpha;
varying float vDepth;
#define PI 3.14159265359
#define TAU 6.28318530718
const float GROUND = -22.0;

vec3 oCol;
float oA;

float ease(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
mat3 rotY(float a) { float s = sin(a), c = cos(a); return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c); }
vec3 ring(float rad, float ang, float y) { return vec3(rad * cos(ang), y, rad * sin(ang)); }

// Light comes from the upper left of the scene, so a cloud has a sunlit side and a shadowed one.
float shade(float ang) { return 0.55 + 0.45 * max(cos(ang - 2.4), 0.0); }

float hash(float n) { return fract(sin(n) * 43758.5453); }
// A point on (or just inside) a sphere: the shell gives each puff a bright rim, which is what
// makes particles read as billowing cumulus.
vec3 shell(vec3 r) {
  float th = r.y * TAU;
  float cz = r.z * 2.0 - 1.0;
  float s = sqrt(max(1.0 - cz * cz, 0.0));
  return vec3(s * cos(th), cz, s * sin(th));
}
// Sunlight from the upper left and a little in front: lit tops are near white, the
// undersides storm grey.
const vec3 SUN = vec3(-0.55, 0.7, 0.45);
vec3 cloud(vec3 n, float h, vec3 dark, vec3 lit) {
  float l = max(dot(n, normalize(SUN)), 0.0);
  return mix(dark, lit, clamp(l * 0.85 + h * 0.25, 0.0, 1.0));
}

// The supercell, side on: its forward side (+x) is downstream. Units are roughly kilometres
// (height stretched a little), scaled to fit at the end. Like the real thing it is far wider
// than it is tall: a low, broad, striated base, a massive tower and an anvil that dwarfs both.
const float BASE = -16.0;
vec3 supercell(float id, vec3 r) {
  float t = uTime;
  vec3 dark = vec3(0.07, 0.08, 0.12);
  vec3 lit = vec3(0.93, 0.94, 0.99);
  vec3 p;
  float light = 1.0;
  if (r.x < 0.28) {
    // the tower: cumulus billows on the surface of a broad, rotating, leaning updraft, so its
    // outline is lumpy like cauliflower
    float k = floor(r.x / 0.28 * 72.0);
    float h = hash(k * 1.7);
    float y = mix(-8.0, 22.0, h);
    float R = mix(14.0, 12.5, h) + 3.5 * sin(h * PI);
    float a = hash(k * 5.3) * TAU + t * 0.1;
    float off = R * mix(0.6, 0.82, hash(k * 3.1));
    vec3 c = vec3(cos(a) * off + h * 7.0, y, sin(a) * off);
    float pr = R * 0.5 * (0.8 + 0.4 * hash(k * 7.9));
    vec3 n = shell(r);
    p = c + n * pr * (0.88 + 0.12 * fract(id * 7.0));
    light = max(dot(n, normalize(SUN)), 0.0);
    oCol = cloud(n, h, dark, lit);
    oA = 0.17;
  } else if (r.x < 0.4) {
    // the "mothership": stacked, striated plates turning together, widest at the bottom,
    // with a dark flat underside
    float k = (r.x - 0.28) / 0.12;
    float plate = floor(r.y * 6.0);
    float f = fract(r.y * 6.0);
    float ang = r.z * TAU + t * 0.3;
    float rad = 26.0 - plate * 2.3;
    float under = step(0.78, k) * step(plate, 0.5);
    float rr = mix(rad - 2.6 * f * f, rad * sqrt(f), under);
    float y = BASE + plate * 1.7 + mix(f * 1.5, 0.0, under);
    p = ring(rr, ang, y) + vec3(plate * 0.8, 0.0, 0.0);
    light = 0.35 + 0.65 * max(cos(ang - 2.4), 0.0);
    oCol = mix(mix(vec3(0.2, 0.21, 0.28), vec3(0.62, 0.64, 0.72), plate / 6.0) * shade(ang), vec3(0.07, 0.08, 0.11), under);
    oA = mix(0.2, 0.14, under);
  } else if (r.x < 0.58) {
    // the anvil: flattened billows spreading far downstream from the top of the tower, flat
    // at the tropopause, thick over the updraft and thinning with distance
    float k = floor((r.x - 0.4) / 0.18 * 90.0);
    float u = pow(hash(k * 2.3), 0.9);
    float x = mix(-16.0, 88.0, u);
    float w = 17.0 + 0.32 * (x + 16.0);
    float z = (hash(k * 4.1) * 2.0 - 1.0) * w * 0.85;
    float y = mix(24.0, 28.5, u);
    vec3 n = shell(r);
    vec3 rr = vec3(mix(12.0, 8.0, u), mix(6.0, 1.8, u), mix(12.0, 8.0, u));
    p = vec3(x, y, z) + n * rr * (0.86 + 0.14 * fract(id * 3.0));
    p.y = min(p.y, 31.0 - u * 1.2);
    light = max(dot(n, normalize(SUN)), 0.0);
    oCol = cloud(n, 0.8, vec3(0.16, 0.17, 0.24), vec3(0.86, 0.87, 0.94)) * mix(1.0, 0.7, u);
    oA = 0.12 * (1.0 - smoothstep(0.82, 1.0, u));
  } else if (r.x < 0.61) {
    // the overshooting top: the updraft punching through the anvil, catching the sun
    float k = floor((r.x - 0.58) / 0.03 * 9.0);
    vec3 c = vec3(8.0 + (hash(k) - 0.5) * 9.0, 30.0 + hash(k * 2.0) * 3.0, (hash(k * 3.0) - 0.5) * 9.0);
    vec3 n = shell(r);
    p = c + n * (6.0 - hash(k * 5.0) * 2.0) * (0.88 + 0.12 * fract(id * 5.0));
    p.y = max(p.y, 29.0);
    light = max(dot(n, normalize(SUN)), 0.0);
    oCol = cloud(n, 1.0, vec3(0.3, 0.32, 0.4), vec3(0.95, 0.95, 1.0));
    oA = 0.07;
  } else if (r.x < 0.66) {
    // mammatus: pouches hanging under the downstream anvil
    float gx = floor(r.y * 16.0);
    float gz = floor(r.z * 7.0);
    float x = 14.0 + gx * 4.0 + hash(gx + gz * 7.0) * 1.5;
    float z = (gz / 6.0 * 2.0 - 1.0) * (16.0 + 0.25 * x);
    vec3 n = shell(vec3(0.0, fract(id * 31.0), fract(id * 17.0) * 0.5));
    p = vec3(x, 22.5 + 0.06 * x, z) + vec3(n.x, -abs(n.y), n.z) * 2.0;
    oCol = vec3(0.55, 0.46, 0.5) * (0.6 + 0.4 * abs(n.y));
    oA = 0.09;
  } else if (r.x < 0.75) {
    // the flanking line: towering cumulus stepping down behind the updraft
    float j = floor(r.y * 5.0);
    float hTop = 24.0 * pow(0.66, j);
    float k = floor(fract(r.y * 5.0) * 12.0);
    float hh = pow(hash(k * 3.7 + j * 11.0), 0.8);
    float spread = mix(11.0, 3.0, hh) * (1.0 - j * 0.12);
    vec3 c = vec3(-24.0 - j * 11.0 + (hash(k + j) - 0.5) * spread, BASE + 2.0 + hh * hTop, -8.0 - j * 5.0 + (hash(k * 2.0 + j) - 0.5) * spread);
    vec3 n = shell(vec3(0.0, fract(id * 23.0), fract(id * 41.0)));
    float pr = mix(6.5, 3.4, hh) * (1.0 - j * 0.1) * (0.8 + 0.4 * hash(k * 9.1 + j));
    p = c + n * pr * (0.86 + 0.14 * r.z);
    light = max(dot(n, normalize(SUN)), 0.0);
    oCol = cloud(n, hh * 0.6, dark, lit);
    oA = 0.15;
  } else if (r.x < 0.81) {
    // the wall cloud: a lowered, rotating block under the updraft's rear side, nearly
    // touching the ground, with a tail cloud running into it from the rain
    float k = (r.x - 0.75) / 0.06;
    if (k < 0.75) {
      float ang = r.y * TAU + t * 0.9;
      float d = pow(r.z, 0.7);
      float rad = mix(9.0, 5.5, d);
      p = ring(rad * (0.85 + 0.15 * fract(id * 13.0)), ang, BASE - d * 3.6) + vec3(-6.0, 0.0, -4.0);
      light = 0.3 + 0.7 * max(cos(ang - 2.4), 0.0);
      oCol = vec3(0.12, 0.13, 0.18) * shade(ang);
      oA = 0.2;
    } else {
      float s = r.y;
      p = vec3(mix(-2.0, 22.0, s), BASE - 1.6 + (r.z - 0.5) * 1.6 + s * 1.0, mix(-3.0, 4.0, s) + (fract(id * 19.0) - 0.5) * 3.0);
      oCol = vec3(0.26, 0.28, 0.35);
      oA = 0.04 * (1.0 - s);
    }
  } else if (r.x < 0.95) {
    // the forward-flank rain and hail core: curtains falling out downstream under the anvil,
    // and rain wrapping round behind the wall cloud on the rear-flank downdraft (the hook)
    float shaft = floor(fract(id * 97.0) * 520.0);
    float wrap = step(440.0, shaft);
    float sa = hash(shaft * 1.3) * TAU;
    float sr = pow(hash(shaft * 2.9), 0.55) * 18.0;
    float fall = fract(r.y + t * 0.55 + hash(shaft));
    float y = BASE - fall * (BASE - GROUND);
    vec2 jit = (vec2(fract(id * 53.0), fract(id * 71.0)) - 0.5) * 2.0;
    float ha = PI * (0.35 + 1.15 * hash(shaft * 4.7));
    vec2 core = vec2(34.0 + cos(sa) * sr * 1.3, 6.0 + sin(sa) * sr);
    vec2 hook = vec2(-6.0, -4.0) + vec2(cos(ha), sin(ha)) * (11.0 + hash(shaft) * 3.0);
    vec2 at = mix(core, hook, wrap) + jit;
    p = vec3(at.x + fall * 3.0, y, at.y);
    float hail = step(0.94, fract(id * 13.3)) * (1.0 - wrap);
    oCol = mix(vec3(0.16, 0.22, 0.36), vec3(0.62, 0.66, 0.76), hail);
    oA = 0.13 * (1.0 - smoothstep(0.85, 1.0, fall)) * smoothstep(0.0, 0.1, fall) * (1.0 - 0.6 * sr / 18.0 * (1.0 - wrap));
  } else {
    // the inflow band (beaver tail): a flat band reaching out from the rain core along the
    // storm's right front
    float s = r.y;
    float x = mix(46.0, 10.0, s);
    float z = mix(36.0, 13.0, s) + (fract(id * 29.0) - 0.5) * mix(9.0, 4.0, s);
    p = vec3(x + (r.z - 0.5) * 4.0, BASE + 0.8 + (fract(id * 61.0) - 0.5) * 3.0, z);
    oCol = vec3(0.5, 0.5, 0.56);
    oA = 0.018 * smoothstep(0.0, 0.2, s) * (1.0 - smoothstep(0.85, 1.0, s));
  }
  // The shadowed side recedes: fewer, dimmer particles there give the cloud its form.
  oA *= 0.35 + 0.65 * light;
  return vec3(p.x * 0.5 - 8.0, (p.y - GROUND) * 0.78 + GROUND, p.z * 0.5);
}

vec3 tornado(float id, vec3 r) {
  float t = uTime;
  if (r.x < 0.42) {
    // condensation funnel: narrow at the ground, widening into the cloud base
    float h = pow(r.y, 0.85);
    float y = GROUND + h * 36.0;
    float rad = (1.0 + 7.5 * pow(h, 2.2)) * (0.8 + 0.2 * sqrt(r.z));
    float ang = r.z * TAU * 13.0 + t * (9.0 - 5.0 * h);
    float sway = sin(h * 3.0 + t * 0.7) * 2.2 * (1.0 - h);
    oCol = mix(vec3(0.42, 0.42, 0.46), vec3(0.66, 0.68, 0.74), h);
    oA = 0.55;
    return ring(rad, ang, y) + vec3(sway, 0.0, 0.0);
  }
  if (r.x < 0.62) {
    // debris cloud whirling at the ground
    float k = (r.x - 0.42) / 0.2;
    float rad = 2.5 + pow(r.z, 0.6) * 9.0;
    float y = GROUND + pow(k, 1.8) * 7.5 * (1.0 - rad / 14.0) + 0.4;
    oCol = mix(vec3(0.62, 0.42, 0.25), vec3(0.42, 0.32, 0.24), r.z);
    oA = 0.55 * (1.0 - smoothstep(9.0, 11.5, rad));
    return ring(rad, r.y * TAU + t * 7.0, y);
  }
  if (r.x < 0.88) {
    // wall cloud and the rotating storm base above it
    float rad = 6.0 + sqrt(r.z) * 24.0;
    float y = 14.0 + 3.0 * smoothstep(6.0, 30.0, rad) + (fract(id * 51.0) - 0.5) * 2.0 + 0.8 * sin(rad * 0.9 - t);
    oCol = mix(vec3(0.2, 0.23, 0.32), vec3(0.4, 0.45, 0.58), smoothstep(6.0, 30.0, rad));
    oA = 0.45;
    return ring(rad, r.y * TAU + t * 0.9, y);
  }
  // rear-flank downdraft and rain wrapping around the funnel
  float s = r.y;
  float fall = fract(r.z + t * 0.4);
  oCol = vec3(0.4, 0.55, 0.85);
  oA = 0.3 * (1.0 - smoothstep(0.85, 1.0, fall));
  return ring(8.0 + s * 14.0, PI * 0.2 + s * PI * 1.3 + t * 0.35, mix(13.0, GROUND, fall));
}

vec3 hurricane(float id, vec3 r) {
  float t = uTime;
  if (r.x < 0.14) {
    // eyewall leaning outward with height
    float h = r.z;
    float ang = r.y * TAU + t * 1.6;
    float rad = 7.0 + h * 5.5 + 0.6 * sin(ang * 6.0 + t * 2.0);
    oCol = vec3(0.78, 0.8, 0.88) * shade(ang);
    oA = 0.4;
    return ring(rad, ang, -5.0 + h * 14.0);
  }
  if (r.x < 0.72) {
    // spiral rain bands, spinning faster toward the center
    float b = floor(fract(r.x * 37.0) * 4.0);
    float u = r.y * 3.2;
    float rad = 10.0 * exp(0.42 * u);
    float ang = u + b * TAU / 4.0 + t * (6.0 / sqrt(rad));
    rad += (r.z - 0.5) * (1.0 + rad * 0.12);
    float y = -4.0 + 4.0 * exp(-rad * 0.05) + (fract(id * 17.0) - 0.5) * 1.5;
    oCol = mix(vec3(0.72, 0.75, 0.84), vec3(0.24, 0.5, 0.75), smoothstep(10.0, 38.0, rad));
    oA = 0.3 * (1.0 - smoothstep(30.0, 42.0, rad)) + 0.05;
    return ring(rad, ang, y);
  }
  if (r.x < 0.92) {
    // cirrus outflow fanning out clockwise on top
    float rad = 8.0 + pow(r.z, 0.7) * 42.0;
    float ang = r.y * TAU - t * 0.12 + sin(rad * 0.15) * 0.3;
    oCol = vec3(0.5, 0.54, 0.72);
    oA = 0.1;
    return ring(rad, ang, 10.0 + 1.5 * sin(rad * 0.3 + ang * 3.0) - rad * 0.04);
  }
  // low clouds on the floor of the eye
  oCol = vec3(0.4, 0.48, 0.64);
  oA = 0.14;
  return ring(sqrt(r.z) * 6.0, r.y * TAU + t * 0.6, -6.0 + (fract(id * 7.0) - 0.5) * 0.6);
}

vec3 place(int s, float id, vec3 r) {
  if (s == 0) return supercell(id, r);
  if (s == 1) return tornado(id, r);
  return hurricane(id, r);
}

void main() {
  vec3 p1 = place(uFrom, aId, aRandom);
  vec3 c1 = oCol; float a1 = oA;
  vec3 p2 = place(uTo, aId, aRandom);
  vec3 c2 = oCol; float a2 = oA;
  float m = ease(uMorph);
  float breathe = sin(uMorph * PI);
  vec3 p = mix(p1, p2, m);
  p = rotY(breathe * (PI * 2.0 + 20.0 / (length(p) + 1.0))) * p;
  p += normalize(p + vec3(sin(aId * PI), cos(aId * TAU), sin(aId * 4.7)) + 1e-4) * breathe * (12.0 + aRandom.y * 16.0);
  vColor = mix(c1, c2, m);
  vAlpha = mix(a1, a2, m) * (0.78 + 0.22 * sin(uTime * 6.0 + aId * TAU * 100.0)) * (1.0 - breathe * 0.5);
  // lightning: a flash lights the cloud around the stroke
  float lit = uFlash * exp(-distance(p, uFlashAt) / 9.0);
  vColor = mix(vColor, vec3(0.92, 0.88, 1.0), clamp(lit, 0.0, 1.0)) * (1.0 + lit * 2.5);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
  vAlpha *= uGain;
  // A point right in front of the camera would cover the screen, and thousands of them
  // added together blow out to white: they fade as they come near and stop growing.
  vAlpha *= smoothstep(4.0, 22.0, vDepth);
  gl_PointSize = min(uSize * (3.0 + aRandom.x * 5.0) * (65.0 / max(vDepth, 0.1)), 40.0);
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vDepth;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float core = exp(-d * 14.0);
  float halo = exp(-d * 4.0);
  vec3 col = mix(vColor, vColor * 1.6 + 0.08, core * 0.45);
  gl_FragColor = vec4(col, vAlpha * (halo * 0.5 + core) * smoothstep(260.0, 15.0, vDepth));
}
`;

export type Storm = Scene & {
  go(dir: number): number;
  spin(on: boolean): void;
  lightning(on: boolean): void;
};

export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Storm> {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02030a, 0.0025);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(dprFor(tier));
  renderer.setClearColor(0x02030a);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  el.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.enablePan = false;
  controls.minDistance = 25;
  controls.maxDistance = 260;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.5;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.42);
  if (tier !== "low") composer.addPass(bloom);

  const count = tier === "high" ? 135000 : tier === "mid" ? 70000 : 32000;
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
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 120);
  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uFrom: { value: 0 },
    uTo: { value: 0 },
    uFlash: { value: 0 },
    uFlashAt: { value: new THREE.Vector3() },
    // Fewer particles on slower phones draw a little larger, and brighter without bloom.
    uSize: { value: Math.min(1.8, Math.sqrt(135000 / count)) },
    uGain: { value: 1 },
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
  const ground = new THREE.GridHelper(140, 28, 0x232c44, 0x111626);
  ground.position.y = -22.2;
  const gm = ground.material as THREE.Material;
  gm.transparent = true;
  gm.opacity = 0.35;
  scene.add(ground);

  // Fewer particles on slower phones draw brighter without bloom.
  const gain = tier === "low" ? 1.5 : 1;
  // Each storm's best angle, as height over distance: a supercell is known side on from near
  // the ground, a tornado from a little above, a hurricane from overhead. The camera glides
  // there while one storm becomes the next; dragging moves it anywhere after.
  const ELEV = [0.1, 0.28, 0.85];
  let from = 0;
  let to = 0;
  const sph = new THREE.Spherical();
  const off = new THREE.Vector3();
  let fit = 100;
  const unwatch = watchSize(el, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Fit the storm (about 34 units either side, 36 up and down) whichever way is tighter.
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const z = Math.max(36 / tan, 34 / (tan * camera.aspect)) * 1.15;
    fit = z * 1.06;
    camera.position.set(0, z * ELEV[from], z);
    controls.target.set(0, 2, 0);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  });

  let morph = 0;
  let moving = false;
  let bolts = !reduced;
  let nextBolt = 2;
  let flash = 0;
  const l = loop((t, dt) => {
    if (moving) {
      off.copy(camera.position).sub(controls.target);
      sph.setFromVector3(off);
      sph.phi +=
        (Math.PI / 2 - Math.atan(ELEV[to]) - sph.phi) * Math.min(1, dt * 2.2);
      camera.position.copy(controls.target).add(off.setFromSpherical(sph));
      morph += dt * 0.45;
      if (morph >= 1) {
        morph = 0;
        from = to;
        moving = false;
      }
    }
    // Lightning in the supercell's core and the tornado's parent storm: a stroke, then a re-strike.
    if (bolts && to < 2 && !moving && t > nextBolt) {
      uniforms.uFlashAt.value.set(
        (to === 0 ? 2 : -4) + Math.random() * 10,
        (to === 0 ? -6 : 10) + Math.random() * (to === 0 ? 30 : 8),
        -6 + Math.random() * 12,
      );
      flash = 1;
      nextBolt = t + 2 + Math.random() * 5;
    }
    flash = Math.max(0, flash - dt * 4);
    uniforms.uFlash.value =
      flash > 0.55 ? flash : flash > 0.35 ? 0.1 : flash * 1.6;
    uniforms.uTime.value = t;
    uniforms.uMorph.value = morph;
    uniforms.uFrom.value = from;
    uniforms.uTo.value = to;
    controls.update();
    // Zoomed in, every line of sight runs through the storm's dense heart and the glow adds
    // up to white; dimming with distance keeps the brightness of the full view.
    const near = camera.position.distanceTo(controls.target) / fit;
    uniforms.uGain.value = gain * Math.min(1, Math.max(0.15, near ** 1.4));
    composer.render();
  });
  return {
    pause: l.pause,
    go(dir) {
      if (!moving) {
        to = (from + dir + STORMS.length) % STORMS.length;
        moving = true;
        morph = 0;
      }
      return to;
    },
    spin(on) {
      controls.autoRotate = on;
    },
    lightning(on) {
      bolts = on;
    },
    dispose() {
      l.stop();
      unwatch();
      controls.dispose();
      composer.dispose();
      teardown(scene, renderer);
    },
  };
}
