/*
  Adapted from Ash Thornton's "WebGL Distortion Slider" CodePen (MIT License):
  https://codepen.io/ashthornton/pen/KRQbMO
  Each photo pours into the next through a displacement driven by the photos themselves.
*/
import * as THREE from "three";
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Cover-fit each photo to the frame, then displace one into the other.
const FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D current;
uniform sampler2D next;
uniform vec2 aspectA;
uniform vec2 aspectB;
uniform float progress;
uniform float intensity;
vec2 cover(vec2 uv, vec2 s) { return (uv - 0.5) * s + 0.5; }
void main() {
  vec2 a = cover(vUv, aspectA);
  vec2 b = cover(vUv, aspectB);
  vec4 o1 = texture2D(current, a);
  vec4 o2 = texture2D(next, b);
  vec4 c1 = texture2D(current, vec2(a.x, a.y + progress * (o2.r * intensity)));
  vec4 c2 = texture2D(next, vec2(b.x, b.y + (1.0 - progress) * (o1.r * intensity)));
  gl_FragColor = mix(c1, c2, progress);
}
`;

export type Slider = Scene & {
  show(i: number): void;
};

const ease = (t: number) =>
  t < 0.5
    ? 0.5 * Math.pow(2, 20 * t - 10)
    : 1 - 0.5 * Math.pow(2, -20 * t + 10);

export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
  urls: string[],
): Promise<Slider> {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(dprFor(tier));
  el.appendChild(renderer.domElement);
  // Photos load as they're needed (the current one and its neighbours), so a phone never
  // holds every texture at once; the far ones are freed again.
  const loader = new THREE.TextureLoader();
  const cache = new Map<number, Promise<THREE.Texture>>();
  const get = (i: number) => {
    const k = (i + urls.length) % urls.length;
    if (!cache.has(k))
      cache.set(
        k,
        new Promise<THREE.Texture>((ok, fail) =>
          loader.load(
            urls[k],
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              t.minFilter = t.magFilter = THREE.LinearFilter;
              ok(t);
            },
            undefined,
            fail,
          ),
        ),
      );
    return cache.get(k)!;
  };
  const trim = (at: number) => {
    for (const [k, p] of cache) {
      const d = Math.min(Math.abs(k - at), urls.length - Math.abs(k - at));
      if (d > 1) {
        cache.delete(k);
        p.then((t) => t.dispose());
      }
    }
  };
  const first = await get(0);
  get(1);
  get(-1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  const uniforms = {
    current: { value: first },
    next: { value: first },
    aspectA: { value: new THREE.Vector2(1, 1) },
    aspectB: { value: new THREE.Vector2(1, 1) },
    progress: { value: 0 },
    // Full strength, always: each photo pours all the way through the next.
    intensity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  scene.add(quad);
  let box = { w: 1, h: 1 };
  // Scale factors that make a photo cover the frame without stretching.
  const fit = (t: THREE.Texture, v: THREE.Vector2) => {
    const img = t.image as { width: number; height: number };
    const ri = img.width / img.height;
    const rb = box.w / box.h;
    v.set(rb < ri ? rb / ri : 1, rb < ri ? 1 : ri / rb);
  };
  const unwatch = watchSize(el, (w, h) => {
    box = { w, h };
    renderer.setSize(w, h);
    fit(uniforms.current.value, uniforms.aspectA.value);
    fit(uniforms.next.value, uniforms.aspectB.value);
  });
  let at = 0;
  let anim: { from: number; to: number; start: number } | null = null;
  const duration = reduced ? 0.6 : 1.2;
  let clock = 0;
  const l = loop((t) => {
    clock = t;
    if (anim) {
      const k = Math.min(1, (t - anim.start) / duration);
      uniforms.progress.value = reduced ? k : ease(k);
      if (k >= 1) {
        uniforms.current.value = uniforms.next.value;
        fit(uniforms.current.value, uniforms.aspectA.value);
        uniforms.progress.value = 0;
        at = anim.to;
        trim(at);
        anim = null;
      }
    }
    renderer.render(scene, camera);
  });
  return {
    pause: l.pause,
    show(i) {
      if (anim || i === at) return;
      const from = at;
      get(i).then((t) => {
        if (anim || at !== from) return;
        uniforms.next.value = t;
        fit(t, uniforms.aspectB.value);
        anim = { from, to: i, start: clock };
        get(i + 1);
        get(i - 1);
      });
    },
    dispose() {
      l.stop();
      unwatch();
      for (const p of cache.values()) p.then((t) => t.dispose());
      mat.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
