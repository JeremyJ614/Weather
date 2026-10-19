/*
  Adapted from Techartist's "Three.js + GLSL Particle Animation" CodePen (MIT License):
  https://codepen.io/VoXelo/pen/NPbGqrx
  Particles that form an astrolabe, a DNA helix and a beating heart, morphing between them.
*/
import * as THREE from "three";
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";
import { teardown } from "./util";

export const SHAPES = ["Astrolabe", "DNA helix", "Heart"];
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

      vec3 getHeart(float id, vec3 rnd) {
          float u = rnd.x * PI * 2.0;
          float v = acos(2.0 * rnd.y - 1.0);
          
          float x = 16.0 * pow(sin(u), 3.0);
          float y = 13.0 * cos(u) - 5.0 * cos(2.0 * u) - 2.0 * cos(3.0 * u) - cos(4.0 * u) + 3.0;
          float z = 5.0 * cos(v);
          
          vec3 pos = vec3(x, y, z);
          
          float layer = floor(rnd.z * 3.0); 
          float scale = 1.0 - (layer * 0.35);
          
          float beat = 1.0 + pow(sin(uTime * 3.0 - layer * 0.8), 8.0) * 0.12;
          
          return pos * scale * beat * 1.5;
      }

      vec3 getShapePosition(int shape, float id, vec3 rnd) {
          if (shape == 0) return getAstrolabe(id, rnd);
          if (shape == 1) return getDNA(id, rnd);
          if (shape == 2) return getHeart(id, rnd);
          return vec3(0.0);
      }

      vec3 getShapeColor(int shape, float id, vec3 rnd) {
          if (shape == 0) return palette(id + uTime*0.05, vec3(0.5, 0.5, 0.6), vec3(0.3, 0.3, 0.4), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.33, 0.67));
          if (shape == 1) {
              float h = (id - 0.5) * 60.0; 
              float rungZone = fract(h * 0.5);
              if(rungZone < 0.15 && rnd.y > 0.4) return vec3(0.0, 0.9, 0.4);
              return palette(id * 0.1, vec3(0.2, 0.6, 0.8), vec3(0.1, 0.3, 0.4), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.2, 0.4));
          }
          if (shape == 2) {
              float layer = floor(rnd.z * 3.0); 
              if (layer == 2.0) return vec3(1.0, 0.6, 0.8);
              return palette(id, vec3(0.9, 0.1, 0.2), vec3(0.3, 0.0, 0.1), vec3(1.0, 0.5, 0.5), vec3(0.0, 0.0, 0.0));
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

          float autoRot1 = (uCurrentShape == 2) ? 0.0 : uTime * 0.1;
          float autoRot2 = (uTargetShape == 2) ? 0.0 : uTime * 0.1;
          float rotY = mix(autoRot1, autoRot2, easedMorph) + uMouse.x * 0.5;
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
  const l = loop((t, dt) => {
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
