/*
  Adapted from Russell Henderson's "Modern Visual" CodePen (MIT License):
  https://codepen.io/russell-henderson/pen/jEVVqBe
*/
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";
import { teardown } from "./util";

export type Aura = Scene & { spin(on: boolean): void };

/** A glass icosahedron in rings of light and dust, under bloom. Drag to turn it. */
export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Aura> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050b1a);
  scene.fog = new THREE.FogExp2(0x050b1a, 0.008);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(3, 2, 5);
  const renderer = new THREE.WebGLRenderer({ antialias: tier !== "low" });
  renderer.setPixelRatio(dprFor(tier));
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.2;
  el.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.5, 0.1);
  if (tier !== "low") composer.addPass(bloom);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 1.2;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 12;

  scene.add(new THREE.AmbientLight(0x222222));
  const main = new THREE.DirectionalLight(0xffffff, 1.2);
  main.position.set(2, 3, 4);
  const back = new THREE.PointLight(0x4466cc, 0.6);
  back.position.set(-2, 1, -3);
  const fill = new THREE.PointLight(0xffaa66, 0.5);
  fill.position.set(1.5, 1, 2);
  const color = new THREE.PointLight(0xff44aa, 0.8);
  color.position.set(1, 1, 2);
  scene.add(main, back, fill, color);

  const points = (
    n: number,
    at: (i: number, p: Float32Array, c?: Float32Array) => void,
    mat: THREE.PointsMaterial,
    colors = false,
  ) => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const c = colors ? new Float32Array(n * 3) : undefined;
    for (let i = 0; i < n; i++) at(i, p, c);
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    if (c) g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    const o = new THREE.Points(g, mat);
    scene.add(o);
    return o;
  };
  const stars = points(
    800,
    (i, p) => {
      p[3 * i] = 200 * (Math.random() - 0.5);
      p[3 * i + 1] = 100 * (Math.random() - 0.5);
      p[3 * i + 2] = 80 * (Math.random() - 0.5) - 40;
    },
    new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.08,
      transparent: true,
      opacity: 0.6,
    }),
  );
  const geo = new THREE.IcosahedronGeometry(1.1, 0);
  const core = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x4a7a9c,
      emissive: 0x112233,
      roughness: 0.28,
      metalness: 0.75,
      transparent: true,
      opacity: 0.92,
    }),
  );
  const wire = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0x66ccff,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    }),
  );
  wire.scale.setScalar(1.08);
  scene.add(core, wire);
  const ring = points(
    1200,
    (i, p, c) => {
      const t = (i / 1200) * Math.PI * 2;
      p[3 * i] = Math.cos(t) * 1.55;
      p[3 * i + 1] = 0.35 * Math.sin(3 * t);
      p[3 * i + 2] = Math.sin(t) * 1.55;
      c![3 * i] = 0.4 + 0.6 * Math.sin(t);
      c![3 * i + 1] = 0.3 + 0.7 * Math.cos(1.7 * t);
      c![3 * i + 2] = 0.8 + 0.2 * Math.sin(2.3 * t);
    },
    new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
    }),
    true,
  );
  const torusMat = new THREE.MeshStandardMaterial({
    color: 0x88ffff,
    emissive: 0x2266aa,
    roughness: 0.3,
    metalness: 0.9,
  });
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.045, 32, tier === "low" ? 160 : 400),
    torusMat,
  );
  const torus2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.68, 0.03, 32, tier === "low" ? 160 : 400),
    new THREE.MeshStandardMaterial({
      color: 0xffaa88,
      emissive: 0x442200,
      roughness: 0.5,
      metalness: 0.7,
    }),
  );
  scene.add(torus, torus2);
  const dust = points(
    800,
    (i, p) => {
      p[3 * i] = 5 * (Math.random() - 0.5);
      p[3 * i + 1] = 3 * (Math.random() - 0.5);
      p[3 * i + 2] = 4 * (Math.random() - 0.5) - 1;
    },
    new THREE.PointsMaterial({
      color: 0x77aaff,
      size: 0.025,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    }),
  );
  const grid = new THREE.GridHelper(12, 24, 0x88ffff, 0x335588);
  grid.position.y = -1.8;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.2;
  scene.add(grid);

  const unwatch = watchSize(el, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  });
  const speed = reduced ? 0.25 : 1;
  const l = loop((_, dt) => {
    const time = (core.userData.t = (core.userData.t ?? 0) + dt * 0.72 * speed);
    core.rotation.set(
      0.2 * Math.sin(0.37 * time),
      0.25 * time,
      0.15 * Math.cos(0.23 * time),
    );
    wire.rotation.copy(core.rotation);
    ring.rotation.set(0.2 * Math.sin(0.28 * time), 0.35 * time, 0);
    torus.rotation.set(Math.PI / 2, 0, 0.5 * time);
    torus2.rotation.set(Math.PI / 2 + 0.3, 0, 0.65 * time);
    color.color.setHSL(
      0.55 + 0.1 * Math.sin((0.2 * time) % (2 * Math.PI)),
      1,
      0.6,
    );
    stars.rotation.y += 5e-4 * speed;
    stars.rotation.x += 3e-4 * speed;
    dust.rotation.set(0.1 * Math.sin(0.1 * time), 0.05 * time, 0);
    controls.update();
    composer.render();
  });
  return {
    pause: l.pause,
    spin(on) {
      controls.autoRotate = on;
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
