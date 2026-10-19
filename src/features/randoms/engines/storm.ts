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
      "A twisting updraft tower, an anvil blown downstream with an overshooting top, a rain-free base with a lowered wall cloud, the forward-flank rain and hail core, and an inflow band feeding it all.",
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

vec3 supercell(float id, vec3 r) {
  float t = uTime;
  if (r.x < 0.30) {
    // updraft: rising, twisting tower, fading in at the base and out at the top
    float h = fract(r.y + t * 0.04);
    float y = -10.0 + h * 42.0;
    float rad = (3.0 + 3.5 * h) * sqrt(r.z) + 0.7 * sin(y * 0.35 + t);
    oCol = mix(vec3(0.62, 0.7, 0.85), vec3(0.95, 0.97, 1.0), h);
    oA = 0.55 * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.85, 1.0, h));
    return ring(rad, r.x / 0.3 * TAU * 7.0 + y * 0.09 + t * 0.6, y);
  }
  if (r.x < 0.55) {
    // anvil spreading downstream, overshooting top over the updraft
    float k = (r.x - 0.30) / 0.25;
    float u = r.y;
    float x = mix(-12.0, 48.0, pow(u, 0.8));
    float halfW = 9.0 + 15.0 * u;
    float z = (r.z * 2.0 - 1.0) * halfW;
    float thick = 4.5 * (1.0 - u) + 0.8;
    float y = 30.0 + (k - 0.5) * thick + 1.6 * sin(x * 0.09 + z * 0.07 + t * 0.4);
    float d2 = x * x + z * z;
    y += 7.0 * exp(-d2 / 36.0);
    oCol = mix(vec3(1.0, 1.0, 1.0), vec3(0.62, 0.74, 0.95), u);
    oA = 0.42 * (1.0 - 0.6 * u);
    return vec3(x, y, z);
  }
  if (r.x < 0.68) {
    // rain-free base with striations, wall cloud lowering under the updraft
    float rad = 2.0 + sqrt(r.z) * 15.0;
    float y = -10.0 - 4.5 * exp(-rad * rad / 16.0) + 0.6 * sin(rad * 1.6 - t * 0.5) + (fract(id * 37.0) - 0.5) * 0.8;
    oCol = mix(vec3(0.34, 0.4, 0.56), vec3(0.55, 0.62, 0.78), smoothstep(4.0, 15.0, rad));
    oA = 0.5;
    return ring(rad, r.y * TAU + t * 0.25, y);
  }
  if (r.x < 0.85) {
    // forward-flank rain and hail core falling out
    float fall = fract(r.y + t * 0.35);
    float y = -11.0 - fall * 11.0;
    float x = 7.0 + r.z * 15.0 + sin(y * 0.3 + t) * 0.8;
    float z = -7.0 + fract(id * 91.7) * 17.0;
    oCol = mix(vec3(0.3, 0.55, 0.95), vec3(0.75, 0.88, 1.0), step(0.93, fract(id * 13.3)));
    oA = 0.45 * (1.0 - smoothstep(0.8, 1.0, fall));
    return vec3(x, y, z);
  }
  if (r.x < 0.95) {
    // inflow band curling into the base, sunlit
    float s = r.y;
    float rad = mix(40.0, 6.0, s);
    float ang = -PI * 0.5 + s * PI * 0.8 + t * 0.2;
    float y = -9.0 + (r.z - 0.5) * 1.6 + s * 0.8;
    oCol = vec3(1.0, 0.8, 0.6);
    oA = 0.16 * smoothstep(0.0, 0.25, s) * (1.0 - smoothstep(0.85, 1.0, s));
    return ring(rad, ang, y);
  }
  // mammatus pouches under the downstream anvil
  float x = 10.0 + r.y * 34.0;
  float z = (r.z * 2.0 - 1.0) * 16.0;
  float cell = max(sin(x * 0.7) * sin(z * 0.7), 0.0);
  oCol = vec3(1.0, 0.62, 0.55);
  oA = 0.5 * cell;
  return vec3(x, 27.6 - 2.0 * cell - fract(id * 13.0) * 0.5, z);
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
    oCol = mix(vec3(0.62, 0.62, 0.66), vec3(0.88, 0.9, 0.95), h);
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
    oCol = mix(vec3(0.38, 0.44, 0.6), vec3(0.58, 0.65, 0.8), smoothstep(6.0, 30.0, rad));
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
    oCol = vec3(1.0);
    oA = 0.6;
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
    oCol = mix(vec3(1.0), vec3(0.35, 0.75, 1.0), smoothstep(10.0, 38.0, rad));
    oA = 0.5 * (1.0 - smoothstep(30.0, 42.0, rad)) + 0.08;
    return ring(rad, ang, y);
  }
  if (r.x < 0.92) {
    // cirrus outflow fanning out clockwise on top
    float rad = 8.0 + pow(r.z, 0.7) * 42.0;
    float ang = r.y * TAU - t * 0.12 + sin(rad * 0.15) * 0.3;
    oCol = vec3(0.72, 0.76, 1.0);
    oA = 0.12;
    return ring(rad, ang, 10.0 + 1.5 * sin(rad * 0.3 + ang * 3.0) - rad * 0.04);
  }
  // low clouds on the floor of the eye
  oCol = vec3(0.55, 0.65, 0.85);
  oA = 0.35;
  return ring(sqrt(r.z) * 6.0, r.y * TAU + t * 0.6, -6.0 + (fract(id * 7.0) - 0.5) * 0.6);
}

vec3 place(int s, float id, vec3 r) {
  if (s == 0) return supercell(id, r) - vec3(12.0, 0.0, 0.0);
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
  gl_PointSize = uSize * (3.0 + aRandom.x * 5.0) * (65.0 / max(vDepth, 0.1));
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
  vec3 col = mix(vColor * 1.2, vec3(1.0), core * 0.45);
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
  renderer.toneMappingExposure = 1.1;
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.3, 0.6, 0.25);
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
    uGain: { value: tier === "low" ? 1.5 : 1 },
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
  const ground = new THREE.GridHelper(140, 28, 0x3a4a70, 0x1a2238);
  ground.position.y = -22.2;
  const gm = ground.material as THREE.Material;
  gm.transparent = true;
  gm.opacity = 0.35;
  scene.add(ground);

  const unwatch = watchSize(el, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Fit the storm (about 34 units either side, 36 up and down) whichever way is tighter.
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const z = Math.max(36 / tan, 34 / (tan * camera.aspect)) * 1.15;
    camera.position.set(0, z * 0.34, z);
    controls.target.set(0, 2, 0);
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  });

  let from = 0;
  let to = 0;
  let morph = 0;
  let moving = false;
  let bolts = !reduced;
  let nextBolt = 2;
  let flash = 0;
  const l = loop((t, dt) => {
    if (moving) {
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
