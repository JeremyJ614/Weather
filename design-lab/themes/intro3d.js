/* StormSync Media 3D intro.
   Adapted from Julian Garnier's "Anime.js 3D logo animation (three.js adapter)" CodePen:
   same scene, floor, cube and timeline, with the StormSync Media lockup, theme colors,
   no looping outro, and framing that fits portrait phones. */
import {
  Scene, WebGLRenderer, PerspectiveCamera, Color, Group, Box3, Vector3,
  Mesh, ExtrudeGeometry, MeshStandardMaterial, InstancedMesh, BoxGeometry, Object3D,
  AmbientLight, DirectionalLight, ShaderMaterial, SphereGeometry, BackSide,
} from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { animate, createTimeline, createTimer, stagger, utils, cubicBezier, linear } from 'animejs';
import { getInstances } from 'animejs/adapters/three';

const mix = (a, b, t) => '#' + new Color(a).lerp(new Color(b), t).getHexString();

export function playIntro(host, theme, { onEnd } = {}) {
  const L1 = INTRO_IDS.L1, L2 = INTRO_IDS.L2;
  const DEPTH = 0.2565, ITALIC_SKEW = 8;
  const BG = theme.bg, METAL = theme.metal, ACCENT = theme.accent;

  /* Parse the outlined lockup into centered, extruded geometries. */
  const tmp = document.createElement('div'); tmp.innerHTML = INTRO_SVG;
  const data = new SVGLoader().parse(tmp.firstElementChild.outerHTML);
  const parsed = {};
  const flipY = (shape) => { const f = (p) => p.curves.forEach((c) => { for (const k of ['v0', 'v1', 'v2', 'v3']) if (c[k]) c[k].y = -c[k].y; }); f(shape); shape.holes.forEach(f); };
  for (const path of data.paths) {
    const id = path.userData?.node?.id; if (!id) continue;
    const shapes = SVGLoader.createShapes(path); shapes.forEach(flipY);
    const geom = new ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false });
    const box = new Box3().setFromBufferAttribute(geom.attributes.position);
    const center = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
    geom.translate(-center.x, -center.y, -center.z);
    parsed[id] = { geom, center, size };
  }

  const meshes = {}, logoGroup = new Group();
  for (const id of [...L1, ...L2]) {
    const { geom, center, size } = parsed[id];
    const mesh = new Mesh(geom, new MeshStandardMaterial({ color: new Color(L2.includes(id) ? ACCENT : METAL), roughness: 0.38, metalness: 0.25 }));
    mesh.position.copy(center); mesh.userData.halfHeight = size.y / 2;
    meshes[id] = mesh; logoGroup.add(mesh);
  }

  const FLOOR_COLS = 31, FLOOR_ROWS = 31, tileSize = 1;
  const scale = tileSize / parsed.dot.size.x;
  logoGroup.scale.setScalar(scale);

  /* Horizontal framing worked out from the lockup instead of hand-tuned offsets. */
  const left = (ids) => Math.min(...ids.map(i => parsed[i].center.x - parsed[i].size.x / 2));
  const right = (ids) => Math.max(...ids.map(i => parsed[i].center.x + parsed[i].size.x / 2));
  const X_POP = -((left(L1) + right(L1)) / 2) * scale;
  const X_FINAL = -((left(L1) + right(L2)) / 2) * scale;
  const CUBE_FINAL_X = X_FINAL + parsed.dot.center.x * scale;
  const FULL_W = (right(L2) - left(L1)) * scale;

  const wrapper = new Group(); wrapper.add(logoGroup); wrapper.position.y = -5;

  const scene = new Scene(); scene.background = new Color(BG);
  const skyMaterial = new ShaderMaterial({
    uniforms: { topColor: { value: new Color(METAL) }, bottomColor: { value: new Color(METAL) }, offset: { value: 32 }, exponent: { value: 0.6 } },
    side: BackSide, fog: false,
    vertexShader: `varying vec3 vWorldPosition; void main(){ vWorldPosition=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition;
      void main(){ float h=normalize(vWorldPosition+vec3(0.0,offset,0.0)).y; gl_FragColor=vec4(mix(bottomColor,topColor,pow(max(h,0.0),exponent)),1.0);
      #include <colorspace_fragment>
      }`,
  });
  scene.add(new Mesh(new SphereGeometry(600, 32, 15), skyMaterial));
  scene.add(wrapper);

  const floorGroup = new Group();
  const floor = new InstancedMesh(new BoxGeometry(tileSize, tileSize, tileSize), new MeshStandardMaterial({ color: new Color(METAL), roughness: 0.7, metalness: 0.05 }), FLOOR_COLS * FLOOR_ROWS);
  const dummy = new Object3D();
  for (let r = 0; r < FLOOR_ROWS; r++) for (let c = 0; c < FLOOR_COLS; c++) { dummy.position.set(c - (FLOOR_COLS - 1) / 2, 0, r - (FLOOR_ROWS - 1) / 2); dummy.updateMatrix(); floor.setMatrixAt(r * FLOOR_COLS + c, dummy.matrix); }
  floorGroup.add(floor);
  const tiles = getInstances(floor);
  const FLOOR_HALF_X = FLOOR_COLS * tileSize / 2, FLOOR_HALF_Z = FLOOR_ROWS * tileSize / 2, SKIRT_EXT = 5, skirts = [];
  const addSkirt = (w, d, x, z) => { const s = new Mesh(new BoxGeometry(w, tileSize, d), floor.material); s.position.set(x, 0, z); floorGroup.add(s); skirts.push(s); };
  addSkirt(SKIRT_EXT, 2 * FLOOR_HALF_Z, FLOOR_HALF_X + SKIRT_EXT / 2, 0);
  addSkirt(SKIRT_EXT, 2 * FLOOR_HALF_Z, -FLOOR_HALF_X - SKIRT_EXT / 2, 0);
  addSkirt(2 * FLOOR_HALF_X + 2 * SKIRT_EXT, SKIRT_EXT, 0, FLOOR_HALF_Z + SKIRT_EXT / 2);
  addSkirt(2 * FLOOR_HALF_X + 2 * SKIRT_EXT, SKIRT_EXT, 0, -FLOOR_HALF_Z - SKIRT_EXT / 2);
  scene.add(floorGroup);

  const cube = new Mesh(new BoxGeometry(tileSize, tileSize, tileSize), new MeshStandardMaterial({ color: ACCENT, roughness: 0.35, metalness: 0.2, emissive: new Color(ACCENT), emissiveIntensity: 0.15 }));
  scene.add(cube);

  const ambient = new AmbientLight(0xffffff, 0.6); scene.add(ambient);
  const keyLight = new DirectionalLight(0xffffff, 1.6); scene.add(keyLight);
  const rimLight = new DirectionalLight(new Color(ACCENT), 0.6); scene.add(rimLight);

  const W = () => host.clientWidth || 1, H = () => host.clientHeight || 1;
  const camera = new PerspectiveCamera(35, W() / H(), 0.01, 100);
  const cameraRig = new Group(); cameraRig.add(camera); scene.add(cameraRig);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(W(), H());
  host.appendChild(renderer.domElement); renderer.domElement.style.opacity = '0';
  const ro = new ResizeObserver(() => { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()); });
  ro.observe(host);

  /* Initial poses */
  const letters = L1.map(id => meshes[id]);
  const jsLetters = L2.map(id => meshes[id]);
  const refY = meshes.t1.position.y; // flat-bottomed letter sets the baseline
  const yOff = (m) => m.position.y - refY;
  const bottomOrigin = (m) => `0 ${-m.userData.halfHeight} 0`;
  letters.forEach(m => utils.set(m, { skewX: -ITALIC_SKEW, transformOrigin: bottomOrigin(m) }));
  jsLetters.forEach(m => utils.set(m, { y: 1.9 + yOff(m), z: 6.5, rotateX: 20, transformOrigin: bottomOrigin(m) }));

  utils.set(camera, { x: 0, y: 5.64, z: 20.66, rotateX: -14.73, fov: 60, zoom: 1, near: 1, far: 50000 });
  const DEG2RAD = Math.PI / 180, FLATTEN_BASE_FOV = camera.fov;
  const FLATTEN_DIST_NUM = camera.position.z * Math.tan(FLATTEN_BASE_FOV * 0.5 * DEG2RAD);
  const flattenDezoom = { value: 1 };
  // The original frames a ~25-unit lockup on a wide screen; widen the pull-back for a longer lockup or a tall screen.
  const fitDezoom = () => 1.5 * Math.max(1, (FULL_W / 25) * (16 / 9) / (W() / H()) * 0.62);

  const timer = createTimer({ priority: 0, onUpdate: () => { camera.position.z = FLATTEN_DIST_NUM * flattenDezoom.value / Math.tan(camera.fov * 0.5 * DEG2RAD); renderer.render(scene, camera); } });

  utils.set(skyMaterial, { topColor: mix(METAL, BG, 0.55), bottomColor: mix(METAL, BG, 0.2), offset: -38, exponent: 1.15 });
  utils.set(keyLight, { intensity: 1.6, color: '#ffffff', x: 0, y: 30, z: 0 });
  utils.set(rimLight, { intensity: 0.8, x: -200, y: -50, z: 150 });
  utils.set(tiles, { x: stagger(1, { grid: true, from: 'center', axis: 'x' }), z: stagger(1, { grid: true, from: 'center', axis: 'z' }), y: 0 });
  utils.set(cube, { x: 0, y: 0, z: 0, transformOriginY: -0.5 });
  utils.set(logoGroup, { x: X_POP, y: -0.31, z: -0.5 });

  const centerTile = tiles[Math.floor(FLOOR_ROWS / 2) * FLOOR_COLS + Math.floor(FLOOR_COLS / 2)];
  const EXPLODE_RADIUS = 10;
  const ringD = (i) => Math.hypot((i % FLOOR_COLS) - Math.floor(FLOOR_COLS / 2), Math.floor(i / FLOOR_COLS) - Math.floor(FLOOR_ROWS / 2));
  const getCenterTiles = (r) => tiles.filter((t, i) => ringD(i) <= r);
  const getOuterTiles = (r) => tiles.filter((t, i) => ringD(i) > r);
  const rnd = (s, a, b) => utils.createSeededRandom(s, a, b);
  const explodeDurX = rnd(4, 800, 1279), explodeDurZ = rnd(0, 800, 1279), explodeDurY = rnd(7, 800, 1279);
  const explodeRotX = rnd(7, -1080, 1080), explodeRotY = rnd(13, -1080, 1080), explodeRotZ = rnd(21, -1080, 1080), explodeScaleDur = rnd(0, 500, 1200);
  const shake = (amp, cycles, { decay = 1, sweep = 0, settle = 0, dir = 1, center = 0 } = {}) => t => center + dir * (settle + (amp - settle) * (1 - t) ** decay) * Math.sin(cycles * (t + sweep * t * t) * 2 * Math.PI);
  const lateShake = (amp, cycles, start, opts = {}) => { const inner = shake(amp, cycles, opts); return t => t < start ? 0 : inner((t - start) / (1 - start)); };
  const cb = cubicBezier;

  const tl = createTimeline({ autoplay: false })
  .add(renderer.domElement, { opacity: [0, 1], duration: 1300, ease: 'inOut(2)' }, 0)
  .add(camera, {
    rotateX: [{ to: 38, duration: 700, ease: 'inOut(2)' }, { to: 41, duration: 500, ease: 'inOutSine' }, { to: 40.5, duration: 200, ease: 'inOutSine' }, { to: 36, duration: 180, ease: 'in(2)' }, { to: 24, duration: 80, ease: 'in(2)' }, { to: -10, duration: 40, ease: 'in(1.5)' }, { to: -16.5, duration: 90, delay: 20, ease: 'out(2)' }, { to: -14.73, duration: 190, ease: 'inOutSine' }],
    y: [{ to: 6.3, duration: 900, ease: 'inOut(2)' }, { to: 6.4, duration: 500, ease: 'inOutSine' }, { to: 6.15, duration: 180, ease: 'in(2)' }, { to: 5.04, duration: 120, ease: 'in(2)' }],
  }, 300)
  .add(cube, {
    y: [{ from: 24, to: 1, duration: 300, delay: 1700, ease: 'in(5.0825)' }, { from: 0, to: 0.138, duration: 60, ease: cb(0, 1.1575, 0.5712, 0.9605) }, { to: -0.75, duration: 1040, ease: cb(0, 1.1575, 0.5712, 0.9605) }, { from: -1.75, to: -2.5, duration: 146, ease: 'out(9.8523)' }],
    scaleX: [{ from: 0, to: 1, duration: 2000 }, { from: 1.3, to: 1, duration: 100, ease: 'out(2)' }],
    scaleY: [{ from: 5, to: 2, duration: 2000 }, { to: 1.25, duration: 200, ease: cb(0.1, 0.7, 0.5763, 0.7728) }, { to: 1, duration: 900, ease: cb(0.1, 0.7, 0.5763, 0.7728) }],
    scaleZ: [{ from: 0, to: 1, duration: 2000 }, { from: 1.3, to: 1, duration: 100, ease: 'out(2)' }],
    ease: 'in(2.4146)',
    skewX: { from: 0, to: 1, duration: 1143, delay: 2000, ease: 'linear', modifier: shake(8, 18, { decay: 2 }) },
    skewZ: { from: 0, to: 1, duration: 1143, delay: 2000, ease: 'linear', modifier: shake(8, 18, { decay: 2 }) },
  }, 0)
  .set(centerTile, { scale: 0 }, 2000)
  .add(tiles, {
    y: [
      { from: 0, to: stagger([0.15, 0], { from: 'center', ease: linear('0', '0.185 70.69%', '0.4644 84.63%', '0.7852 95.62%', '1'), grid: true }), duration: 50, delay: stagger([0, 451], { from: 'center', ease: 'in(2.5507)', grid: true }), ease: cb(0.5621, 0.9568, 0.5, 1) },
      { to: stagger([-1.5, 0], { from: 'center', ease: linear('0', '0.2812 12.72%', '0.5478 20.84%', '1 41.29%', '1'), grid: true, jitter: [0.102, 0], seed: 0 }), duration: 1050, ease: cb(0, 0.8, 0, 1.0128) },
      { to: stagger([-3, 0], { from: 'center', ease: linear('0', '0 14.17%', '0.5317 25.26%', '0.8904 47.35%', '1 47.8%', '1'), grid: true, jitter: [0.3, 0], seed: 0 }), duration: stagger([0, 656], { from: 'center', ease: linear('0', '0.0368 14.54%', '0.3042 62.23%', '1 62.24%', '1'), grid: true, jitter: [50, 0], seed: 0 }), ease: cb(0, 1.0807, 0.3512, 1.2537) },
    ],
    rotateX: { to: stagger([0, 0], { from: 'center', ease: linear('0', '0 13.93%', '0.2419 40.77%', '1 55.03%', '1'), grid: true, jitter: [20, 0], seed: 6 }), duration: 1200 },
    rotateY: { to: stagger([0, 0], { from: 'center', ease: linear('0', '0 13.93%', '0.2419 40.77%', '1 55.03%', '1'), grid: true, jitter: [20, 0], seed: 12 }), duration: 1260 },
    rotateZ: { to: stagger([0, 0], { from: 'center', ease: linear('0', '0 13.93%', '0.2419 40.77%', '1 55.03%', '1'), grid: true, jitter: [20, 0], seed: 3 }), duration: 1200, delay: 50 },
  }, 2000)
  .add(camera, {
    y: { from: 0, to: 1, duration: 1412, ease: 'linear', modifier: t => shake(0.12, 15, { decay: 2, center: 5.64 })(t) + lateShake(0.97, 2, 0.78, { decay: 1.6 })(t) },
    rotateZ: { from: 0, to: 1, duration: 1437, ease: 'linear', modifier: t => shake(0.42, 10, { decay: 1.8 })(t) + lateShake(0.42, 2, 0.79, { decay: 1.4 })(t) },
    ease: 'inOutSine',
  }, 2000)
  .add(cube, {
    skewX: [-9, 7, -5, 3.5, -2, 1, -0.5, 0].map((to, i) => ({ to, duration: [58, 63, 71, 77, 82, 90, 96, 83][i], ease: cb(0.3815, 0.0684, 0.5, 1) })),
    scaleY: [[0.8, 77, 'out(3)'], [1.12, 102], [0.94, 109], [1.05, 115], [0.98, 109], [0.97, 108]].map(([to, duration, ease = 'inOutSine']) => ({ to, duration, ease })),
    scaleX: [[1.15, 77, 'out(3)'], [0.93, 102], [1.04, 109], [0.97, 115], [1.01, 109], [1.02, 108]].map(([to, duration, ease = 'inOutSine']) => ({ to, duration, ease })),
    scaleZ: [[1.15, 77, 'out(3)'], [0.93, 102], [1.04, 109], [0.97, 115], [1.01, 109], [1.02, 108]].map(([to, duration, ease = 'inOutSine']) => ({ to, duration, ease })),
    y: [[-2.56, 77, 'out(3)'], [-2.47, 128], [-2.52, 140], [-2.53, 275]].map(([to, duration, ease = 'inOutSine']) => ({ to, duration, ease })),
  }, 3230)
  .add(cube, {
    scaleY: { to: 4, duration: 4150, delay: 800, ease: cb(0.2423, -0.0053, 0.3107, 0.5533) },
    scaleX: { to: 0.8, duration: 4150, delay: 800, ease: cb(0.2423, -0.0053, 0.3107, 0.5533) },
    scaleZ: { to: 0.8, duration: 4150, delay: 800, ease: cb(0.2423, -0.0053, 0.3107, 0.5533) },
    y: { to: 0.75, duration: 4150, delay: 800, ease: cb(0.2423, -0.0053, 0.3107, 0.5533) },
    skewX: { from: 0, to: 1, duration: 4150, delay: 800, ease: 'linear', modifier: shake(9.5, 21, { decay: 1.5, sweep: 1.2, settle: 3.1 }) },
    skewZ: { from: 0, to: 1, duration: 4150, delay: 800, ease: 'linear', modifier: shake(4.3, 18, { decay: 0.7, sweep: 1.4, dir: -1 }) },
  }, 3050)
  .add(getCenterTiles(8), {
    y: [
      { to: stagger([-3.5, -0.82], { from: 'center', ease: linear('0', '0.0878 0.01%', '0.3904 50.14%', '0.7766 68.95%', '1'), grid: true, jitter: [0.3, 0], seed: 0 }), duration: 260, ease: 'out(3)' },
      { to: stagger([1.4, -0.72], { from: 'center', ease: linear('0', '0 28.61%', '0.27 28.62%', '0.7766 68.95%', '1'), grid: true, jitter: [0.3, 0], seed: 0 }), duration: 4100, delay: 440, ease: cb(0.2423, -0.0053, 0.367, 0.5896) },
    ],
  }, 3200)
  .label('POP', 8000).label('slowmo start', 'POP-=0').label('slowmo end', 'POP+=500')
  .add(camera, { zoom: { to: 2, duration: 5500, ease: cb(0.6985, 0.1061, 0.5527, 0.7364) } }, 2500)
  .add(cameraRig, {
    rotateY: [{ from: -270, to: -180, duration: 3600 }, { to: 0, duration: 700, delay: 1000, ease: cb(0.375, -0.0148, 0, 1.0101) }],
    rotateX: { to: 0, duration: 1900, delay: 2700 },
    y: [{ to: 0, duration: 1900, delay: 2700 }, { to: 0, duration: 300, ease: 'out(2)' }],
    ease: 'inOut(2)',
  }, 3400)
  .add(getCenterTiles(EXPLODE_RADIUS), {
    x: { to: stagger([1, 40], { from: 'center', grid: true, axis: 'x', jitter: 5, seed: 0 }), duration: () => explodeDurX(), delay: stagger([0, 137], { from: 'center', grid: true }), ease: 'out(5.3605)' },
    z: { to: stagger([1, 40], { from: 'center', grid: true, axis: 'z' }), duration: () => explodeDurZ(), delay: stagger([0, 137], { from: 'center', grid: true, jitter: 5, seed: 0 }), ease: 'out(5.3605)' },
    y: { to: stagger([40, 1], { from: 'center', ease: cb(0.3326, 0.0289, 0.9886, 0.4057), grid: true, jitter: 5, seed: 0 }), duration: () => explodeDurY(), delay: stagger([0, 137], { from: 'center', grid: true }), ease: 'out(5.3605)' },
    rotateX: { to: () => explodeRotX(), duration: 815, delay: stagger([0, 314], { from: 'center', grid: true }), ease: 'out(2)' },
    rotateY: { to: () => explodeRotY(), duration: 815, delay: stagger([0, 314], { from: 'center', grid: true }), ease: 'out(2)' },
    rotateZ: { to: () => explodeRotZ(), duration: 815, delay: stagger([0, 314], { from: 'center', grid: true }), ease: 'out(2)' },
    scale: { to: 0, duration: () => explodeScaleDur(), delay: stagger([0, 314], { from: 'center', grid: true }), ease: 'out(2.8731)' },
    duration: 113, delay: stagger([0, 210], { from: 'center', grid: true, seed: 0 }), ease: 'linear',
  }, 'POP-=15')
  .add([...getOuterTiles(EXPLODE_RADIUS), ...skirts], { y: { to: -50, duration: 604, delay: 146, ease: cb(0.8109, 0.0308, 0.9152, 0.5479) } }, 'POP-=150')
  .add(letters, {
    y: [
      { from: (m) => -0.39 + yOff(m), to: (m) => 3.23 + yOff(m), duration: 240, ease: cb(0.225, 1, 0.915, 0.98) },
      { to: (m) => 1.9 + yOff(m), duration: 120, delay: 20, ease: 'inQuad' },
      { to: (m) => 1.9 + yOff(m), duration: 120, ease: 'outQuad' },
    ],
    scaleX: [{ to: [0.25, 0.85], duration: 240, ease: 'outQuad' }, { to: 1.08, duration: 120, delay: 85, ease: 'inOutSine' }, { to: 1, duration: 260, delay: 25, ease: 'outQuad' }],
    scaleY: [{ to: [0.4, 1.5], duration: 120, ease: 'outSine' }, { to: 0.6, duration: 120, delay: 180, ease: 'inOutSine' }, { to: 1.2, duration: 180, delay: 25, ease: 'outQuad' }, { to: 1, duration: 190, delay: 15, ease: 'outQuad' }],
    duration: 400, ease: 'outSine', delay: stagger(60, { from: 'center' }),
  }, 'POP')
  .add(cube, {
    y: [{ from: 0.75, to: 16.9, duration: 240, ease: cb(0.225, 1, 0.915, 0.98) }, { to: 7.58, duration: 180, delay: 120, ease: 'inQuad' }, { to: 11.7, duration: 250, ease: cb(0.225, 1, 0.915, 0.98) }, { to: 9.11, duration: 170, delay: 20, ease: 'inQuad' }, { to: 9.5, duration: 120, ease: 'outQuad' }],
    scaleX: { to: [0.8, 1], duration: 260, ease: 'outQuad' }, scaleY: { from: 4, to: 1, duration: 120, ease: 'outQuad' }, scaleZ: { to: [0.8, 1], duration: 260, ease: 'outQuad' },
    transformOriginY: { to: 0, duration: 150, ease: 'out(2)' },
    rotateZ: [{ to: -540, duration: 480, delay: 20, ease: cb(0.7865, 0.9809, 0.8395, 0.9559) }, { to: -720, duration: 540, delay: 160, ease: 'outSine' }],
    skewX: { to: 0, duration: 180, ease: 'out(2)' }, skewZ: { to: 0, duration: 180, ease: 'out(2)' },
    ease: 'outSine',
  }, 'POP')
  .add(wrapper, { scale: { from: 1.25, to: 1, duration: 600 }, y: { from: -5.28, to: 0, duration: 600 }, duration: 900, ease: 'outExpo' }, 'POP')
  .add(meshes.m1, {
    scaleY: [{ to: 0.25, duration: 150, ease: 'outExpo' }, { to: 1, duration: 700, ease: 'outElastic(2.11, 0.61)' }],
    scaleX: [{ to: 1.5, duration: 50, ease: 'outSine' }, { to: 1, duration: 900, ease: 'outElastic(2.11, 0.61)' }],
  }, 'POP+=380')
  .add(camera, { y: { to: 7, duration: 1100, ease: 'out(4.9225)' }, rotateX: [{ to: 9.1, duration: 260, ease: 'out(3.2713)' }, { to: 0, duration: 700, ease: 'out(3)', delay: 140 }], zoom: { to: 1, duration: 400, ease: 'out(3)' } }, 'POP')
  .add(letters, { skewX: 0, duration: 1350, ease: 'outElastic(1.1, .9)' }, 'POP+=1050')
  .add(cube, { x: { to: CUBE_FINAL_X, duration: 1350 }, duration: 1450, ease: 'outElastic(1.1,1.7)' }, 'POP+=1050')
  .add(jsLetters, { z: { from: -2, to: 0.12825, duration: 1295 }, rotateX: { from: -120, to: 0, duration: 1295 }, delay: stagger(50), ease: 'outElastic(1.1, .9)', scale: { from: 0, to: 1, duration: 549 } }, 'POP+=1055')
  .add(logoGroup, { x: { to: X_FINAL, duration: 1350, ease: 'outElastic(1.1, .9)' }, duration: 1250, ease: 'inOutQuint' }, 'POP+=1050')
  .add(camera, { fov: { to: 2, duration: 700, ease: 'out(2)' } }, 'POP+=1450')
  .add(flattenDezoom, { value: { to: () => fitDezoom(), duration: 1125 }, duration: 1150, ease: 'out(2)' }, 'POP+=1050')
  .add(skyMaterial, { topColor: BG, bottomColor: BG, duration: 465, ease: 'inOut(4.348)' }, 'POP+=1500')
  .add(ambient, { intensity: [{ to: 3, duration: 300 }, { to: 1.7, duration: 700, delay: 1050 }], duration: 240, ease: 'inOut(1.8042)' }, 'POP+=1650')
  // Our finish: STORMSYNC shades from metal to the accent, left to right, like the logo's gray-to-violet.
  .add(letters, { color: (m, i) => mix(METAL, ACCENT, Math.pow(i / (letters.length - 1), 1.4)), duration: 900, delay: stagger(70), ease: 'inOutSine' }, 'POP+=1900')
  .init();

  const end = tl.duration;
  const player = animate(tl, {
    currentTime: [
      { to: () => tl.labels['slowmo start'], duration: () => tl.labels['slowmo start'], ease: cb(1, 0.7, 1, 0.85) },
      { to: () => tl.labels['slowmo end'], duration: 2000, ease: cb(0.0314, 0.3616, 0.8994, -0.2122) },
      { to: () => end, duration: () => end - tl.labels['slowmo end'] },
    ],
    ease: 'linear',
    onComplete: () => { setTimeout(() => timer.pause(), 300); onEnd && onEnd(); },
  });

  return function dispose() {
    try { player.cancel(); tl.cancel(); timer.cancel(); } catch (e) {}
    ro.disconnect();
    scene.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    renderer.dispose(); renderer.domElement.remove();
  };
}
