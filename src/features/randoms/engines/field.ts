/*
  Adapted from Paul's (prisoner849) "Line2NodeMaterial [r184] [TSL]" CodePen (MIT License):
  https://codepen.io/prisoner849/pen/ogBXRvN
  Fat lines over a disc, lifted by moving noise on the GPU (TSL compute), with sparks rising
  off the surface. Reads like a pressure field rolling under a storm.
*/
import * as THREE from "three/webgpu";
import * as tsl from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";

export type Field = Scene & {
  set(k: "height" | "speed", v: number): void;
  color(hex: string): void;
};

export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Field> {
  const height = tsl.uniform(4);
  const speed = tsl.uniform(reduced ? 0.08 : 0.25);
  const tint = tsl.uniform(new THREE.Color("aquamarine"));
  const clock = tsl.uniform(0);

  const size = 15;
  const segs = { x: tier === "low" ? 60 : 100, y: tier === "low" ? 90 : 150 };
  const start: number[] = [];
  const end: number[] = [];
  for (let i = 0; i <= segs.y; i++) {
    const y = (i / segs.y - 0.5) * size;
    for (let j = 0; j < segs.x; j++) {
      const x1 = (j / segs.x - 0.5) * size;
      const x2 = ((j + 1) / segs.x - 0.5) * size;
      if (Math.hypot(x1, y) < size / 2 && Math.hypot(x2, y) < size / 2) {
        start.push(x1, 0, -y);
        end.push(x2, 0, -y);
      }
    }
  }
  const amount = start.length / 3;
  const g = new LineSegmentsGeometry();
  g.instanceCount = amount;
  const startData = new Float32Array(start);
  const endData = new Float32Array(end);
  const attrStart = new THREE.StorageInstancedBufferAttribute(startData, 3);
  const attrEnd = new THREE.StorageInstancedBufferAttribute(endData, 3);
  const storeStart = tsl.storage(attrStart, "vec3", amount).setPBO(true);
  const storeEnd = tsl.storage(attrEnd, "vec3", amount).setPBO(true);
  g.setAttribute("instanceStart", attrStart);
  g.setAttribute("instanceEnd", attrEnd);
  const initStart = tsl.instancedArray(startData.slice(), "vec3");
  const initEnd = tsl.instancedArray(endData.slice(), "vec3");

  const t = clock.mul(speed);
  // Inlined into each compute pass: height of the moving noise at a point's x/z.
  const noise = (p: { xz: THREE.Node<"vec2"> }) =>
    tsl
      .mx_noise_float(tsl.vec3(p.xz, t).mul(tsl.vec3(0.125, 0.125, 1)))
      .mul(height);
  const waves = tsl
    .Fn(() => {
      const a = initStart.element(tsl.instanceIndex).toVar();
      const b = initEnd.element(tsl.instanceIndex).toVar();
      a.y.addAssign(noise(a));
      b.y.addAssign(noise(b));
      storeStart.element(tsl.instanceIndex).assign(a);
      storeEnd.element(tsl.instanceIndex).assign(b);
    })()
    .compute(amount);

  const lines = new LineSegments2(
    g,
    new THREE.Line2NodeMaterial({
      lineColorNode: tint,
      linewidth: 0.075,
      worldUnits: true,
      alphaToCoverage: true,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const count = tier === "low" ? 8000 : tier === "mid" ? 16000 : 25000;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const ratio = size / 2 / Math.sqrt(count);
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = golden * i;
    const r = Math.sqrt(i) * ratio;
    pts[3 * i] = Math.cos(a) * r;
    pts[3 * i + 2] = Math.sin(a) * r;
  }
  const gPoints = tsl.instancedArray(pts, "vec3");
  const gPhases = tsl.instancedArray(
    Float32Array.from({ length: count }, () => Math.random()),
    "float",
  );
  const rise = 2;
  const sparks = tsl
    .Fn(() => {
      const phase = gPhases.element(tsl.instanceIndex);
      const point = gPoints.element(tsl.instanceIndex);
      const cur = phase.toVar();
      const dt = tsl.deltaTime.mul(speed).toVar();
      cur.addAssign(dt);
      const p = point.toVar();
      const n = noise(p).toVar();
      tsl.If(cur.greaterThan(1), () => {
        cur.assign(tsl.fract(cur));
        p.y.assign(n.add(cur.mul(rise)));
      });
      phase.assign(cur);
      p.y.addAssign(dt.mul(rise));
      p.y.assign(tsl.max(p.y, n));
      point.assign(p);
    })()
    .compute(count);
  const phaseFade = (lo: number, hi: number) => {
    const ph = gPhases.element(tsl.instanceIndex).toVar();
    return tsl.smoothstep(0, 0.1, ph).sub(tsl.smoothstep(lo, hi, ph));
  };
  const sprite = new THREE.Sprite(
    new THREE.PointsNodeMaterial({
      positionNode: gPoints.element(tsl.instanceIndex),
      sizeNode: phaseFade(0.5, 1).mul(0.15),
      colorNode: tint,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacityNode: tsl
        .smoothstep(0, 0.5, tsl.length(tsl.uv().sub(0.5)))
        .oneMinus()
        .mul(phaseFade(0.9, 1)),
    }),
  );
  sprite.count = count;
  lines.add(sprite);

  const scene = new THREE.Scene();
  scene.backgroundNode = tsl.mix(
    tint.mul(0.1),
    tsl.color(0, 0, 0),
    tsl.smoothstep(0, 0.75, tsl.screenUV.sub(0.5).length()),
  );
  scene.add(lines);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(1, 0.25, 1).setLength(10);
  const renderer = new THREE.WebGPURenderer({
    antialias: tier !== "low",
    forceWebGL: true,
  });
  renderer.setPixelRatio(dprFor(tier));
  el.appendChild(renderer.domElement);
  await renderer.init();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 40;

  const unwatch = watchSize(el, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  const l = loop((time) => {
    clock.value = time;
    controls.update();
    renderer.compute(waves);
    renderer.compute(sparks);
    renderer.render(scene, camera);
  });
  return {
    pause: l.pause,
    set(k, v) {
      if (k === "height") height.value = v;
      if (k === "speed") speed.value = v;
    },
    color(hex) {
      tint.value.set(hex);
    },
    dispose() {
      l.stop();
      unwatch();
      controls.dispose();
      g.dispose();
      lines.material.dispose();
      sprite.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
