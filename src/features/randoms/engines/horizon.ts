/*
  Adapted from Daniel Muñoz's "Event Horizon (Three.js + GLSL)" CodePen (MIT License):
  https://codepen.io/daniel-mu-oz/pen/BypKLLE
  Null geodesics bent around a Schwarzschild black hole, a volumetric accretion disk with
  Doppler beaming, HDR bloom and a film finish, in four passes.
*/
import * as THREE from "three";
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";

export type Quality = "low" | "medium" | "high";
export type Horizon = Scene & {
  set(k: "exposure" | "glow" | "speed" | "temperature", v: number): void;
  toggle(k: "doppler" | "nebula" | "orbit", on: boolean): void;
  text(s: string): void;
  quality(q: Quality): void;
  onQuality(cb: (q: Quality) => void): void;
};

const QUALITY: Record<Quality, { dpr: number; steps: number; blur: number }> = {
  low: { dpr: 0.55, steps: 150, blur: 1 },
  medium: { dpr: 0.8, steps: 230, blur: 2 },
  high: { dpr: 1, steps: 320, blur: 2 },
};
const COMMON = `
  vec3 decodificar(vec3 e){
    e = min(e, vec3(0.996));
    return e / (1.0 - e);
  }
  vec3 codificar(vec3 c){
    return c / (1.0 + c);
  }
`;
const VERT = "void main(){ gl_Position = vec4(position, 1.0); }";
const VERT_UV =
  "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }";
const FRAG_SIM =
  COMMON +
  `
uniform float uTime, uCamDist, uYaw, uPitch;
uniform float uVel, uTemp, uDoppler, uFondo, uPasos;
uniform float uTextoOn;
uniform sampler2D tTexto;
uniform vec2  uRes;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash31(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float noise2(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.55;
  for(int i = 0; i < 4; i++){
    v += a * noise2(p);
    p = p * 2.13 + vec2(13.7, 7.1);
    a *= 0.5;
  }
  return v;
}


vec3 cielo(vec3 rd){
  vec3 col = vec3(0.0);

  
  for(int capa = 0; capa < 4; capa++){
    float fc = float(capa);
    float esc = 140.0 + fc * 200.0;
    vec3 q = rd * esc;
    vec3 id = floor(q);
    float h = hash31(id);
    if(h > 0.990 - fc * 0.0025){
      vec3 c = fract(q) - 0.5;
      float d = length(c);
      float b = 1.0 - smoothstep(0.0, 0.5, d);
      b = pow(b, 12.0) * (0.5 + 1.6 * fract(h * 91.7));
      vec3 tinte = mix(vec3(0.65, 0.78, 1.0), vec3(1.0, 0.83, 0.62), fract(h * 53.1));
      
      if(fract(h * 17.3) > 0.90) b *= 6.0;
      col += b * tinte * 2.0;
    }
  }

  
  float n1 = fbm(rd.xy * 2.0 + rd.z * 1.3);
  float n2 = fbm(rd.zy * 3.1 - rd.x * 1.7 + 5.0);
  vec3 gas = vec3(0.020, 0.045, 0.110) * pow(n1, 2.6) * 0.50
           + vec3(0.090, 0.040, 0.022) * pow(n2, 3.2) * 0.40;

  
  float banda = exp(-pow((rd.y + 0.16) * 2.6, 2.0));
  float polvo = fbm(rd.xz * 5.0 + 2.3) * 0.7 + fbm(rd.xz * 11.0) * 0.5;
  gas += (vec3(0.05, 0.06, 0.10) + vec3(0.06, 0.04, 0.02) * polvo) * banda * polvo * 0.30;

  
  float oscuro = smoothstep(0.45, 0.75, fbm(rd.xz * 7.0 + 9.1));
  gas *= mix(1.0, 0.25, oscuro * banda);

  col += gas * uFondo;
  return col;
}


vec3 colorGas(float r, float rIn, float rOut){
  float t = clamp((r - rIn) / (rOut - rIn), 0.0, 1.0);
  vec3 nucleo = mix(vec3(1.00, 0.98, 0.94), vec3(0.80, 0.90, 1.00), uTemp);
  vec3 medio  = vec3(1.00, 0.60, 0.20);
  vec3 borde  = vec3(0.50, 0.14, 0.03);
  vec3 c = mix(nucleo, medio, smoothstep(0.0, 0.40, t));
  return mix(c, borde, smoothstep(0.40, 1.0, t));
}


vec4 disco(vec3 p, vec3 rd, float rIn, float rOut){
  float r = length(p.xz);
  if(r < rIn - 0.4 || r > rOut) return vec4(0.0);

  
  float H = 0.085 + 0.34 * pow(clamp((r - 2.0) / 11.0, 0.0, 1.0), 1.7);
  float y = p.y / H;
  if(abs(y) > 3.5) return vec4(0.0);
  
  float vertical = exp(-y * y * 2.1);
  float bruma = exp(-y * y * 0.45) * 0.16;

  
  float ang = atan(p.z, p.x);
  float omega = uVel * 0.9 / pow(r, 1.5);
  float a1 = ang + uTime * omega * 9.0;

  
  float brazos = fbm(vec2(r * 2.2, a1 * 2.4));
  float hebras = fbm(vec2(r * 14.0 - uTime * 0.05, a1 * 1.3) + 7.3);
  float hilos  = noise2(vec2(r * 46.0, a1 * 4.0));
  
  float espiral = fbm(vec2(r * 5.0, a1 * 3.5 + r * 2.2));
  float grumos  = pow(noise2(vec2(r * 3.5, a1 * 6.0)), 3.0);
  float dens = brazos * 0.42 + hebras * 0.38 + hilos * 0.14
             + espiral * 0.30 + grumos * 0.55;
  dens = smoothstep(0.12, 1.05, dens);
  dens = dens * dens * (1.2 + 0.5 * hebras);
  dens = dens * vertical + bruma * (0.4 + 0.6 * brazos);
  dens *= smoothstep(rIn - 0.4, rIn + 0.45, r);
  dens *= 1.0 - smoothstep(rOut - 2.6, rOut, r);

  if(dens < 0.003) return vec4(0.0);

  
  float perfil = pow(3.0 / r, 1.9);

  
  float beta = clamp(sqrt(0.5 / max(r - 1.0, 0.4)), 0.0, 0.85) * min(uVel, 1.6);
  vec3 velDir = normalize(vec3(-p.z, 0.0, p.x));
  float coseno = dot(rd, velDir);
  float dop = 1.0 / max(1.0 - beta * coseno, 0.15);
  float beaming = mix(1.0, pow(dop, 3.0), uDoppler);
  float shift = uDoppler * clamp(beta * coseno, -1.0, 1.0);

  
  float zGrav = sqrt(max(1.0 - 1.0 / r, 0.05));
  beaming *= mix(1.0, zGrav * zGrav, uDoppler * 0.7);

  vec3 col = colorGas(r, rIn, rOut);
  
  col = mix(col, vec3(1.0, 0.99, 0.95), clamp(perfil * 0.45, 0.0, 0.9));
  col = mix(col, vec3(0.72, 0.84, 1.00), max(shift, 0.0) * 0.55);
  col = mix(col, vec3(0.85, 0.25, 0.07), max(-shift, 0.0) * 0.6);

  return vec4(col * perfil * beaming * dens, dens);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  
  float cy = cos(uYaw); float sy = sin(uYaw);
  float cp = cos(uPitch); float sp = sin(uPitch);
  vec3 ro = uCamDist * vec3(cy * cp, sp, sy * cp);
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw * 1.5 + uv.x * rt + uv.y * up);

  
  vec3 p = ro;
  vec3 v = rd;
  vec3 hVec = cross(p, v);
  float h2 = dot(hVec, hVec);

  float rIn = 3.0; float rOut = 13.0;

  vec3 col = vec3(0.0);
  float transmit = 1.0;
  float capturado = 0.0;
  float minR = 100000.0;

  
  vec3 aDir = vec3(cy, 0.0, sy);
  vec3 tDir = vec3(-sy, 0.0, cy);
  float sPrev = dot(p, aDir) + 20.0;

  for(int i = 0; i < 480; i++){
    if(float(i) >= uPasos) break;

    float r2 = dot(p, p);
    float r  = sqrt(r2);
    minR = min(minR, r);

    
    float dt = clamp(r * 0.065, 0.018, 0.42);
    float grosor = 0.085 + 0.34 * pow(clamp((r - 2.0) / 11.0, 0.0, 1.0), 1.7);
    if(abs(p.y) < grosor * 3.5 && r > rIn - 1.0 && r < rOut + 0.5) dt *= 0.45;

    vec3 a = -1.5 * h2 * p / (r2 * r2 * r);
    v += a * dt;
    p += v * dt;

    if(dot(p, p) < 1.0){ capturado = 1.0; break; }

    
    if(transmit > 0.012){
      vec4 d = disco(p, normalize(v), rIn, rOut);
      if(d.a > 0.0){
        col += d.rgb * transmit * dt * 4.6;
        transmit *= exp(-d.a * dt * 2.8);
      }
    }

    
    if(uTextoOn > 0.5 && transmit > 0.012){
      float sNow = dot(p, aDir) + 20.0;
      if(sPrev * sNow < 0.0){
        float f = sPrev / (sPrev - sNow);
        vec3 q = mix(p - v * dt, p, f);
        vec2 uvT = vec2(fract(0.5 - dot(q, tDir) / 38.0 - uTime * 0.045),
                        0.5 + q.y / 19.0);
        if(uvT.y > 0.001 && uvT.y < 0.999){
          vec4 tx = texture2D(tTexto, uvT);
          col += tx.rgb * tx.a * transmit * 1.7;
          transmit *= (1.0 - tx.a * 0.92);
        }
      }
      sPrev = sNow;
    }

    if(dot(p, p) > 1400.0) break;
  }

  
  if(capturado < 0.5 && transmit > 0.012){
    col += cielo(normalize(v)) * transmit;
  }

  
  float halo = exp(-abs(minR - 1.5) * 3.0);
  col += vec3(1.0, 0.80, 0.52) * halo * 0.45 * mix(1.0, 0.35, capturado);

  
  col += vec3(1.0, 0.62, 0.32) * exp(-minR * 0.34) * 0.10;

  gl_FragColor = vec4(codificar(col), 1.0);
}
`;
const FRAG_BRIGHT =
  COMMON +
  `
uniform sampler2D tSrc;
uniform float uUmbral;
varying vec2 vUv;
void main(){
  vec3 c = decodificar(texture2D(tSrc, vUv).rgb);
  c = max(c - uUmbral, vec3(0.0));
  gl_FragColor = vec4(codificar(c), 1.0);
}
`;
const FRAG_BLUR =
  COMMON +
  `
uniform sampler2D tSrc;
uniform vec2 uDir, uRes;
varying vec2 vUv;
void main(){
  vec2 px = uDir / uRes;
  vec3 suma = decodificar(texture2D(tSrc, vUv).rgb) * 0.227;
  float pesos[4];
  pesos[0] = 0.194; pesos[1] = 0.121; pesos[2] = 0.054; pesos[3] = 0.016;
  for(int i = 1; i <= 4; i++){
    float o = float(i) * 1.6;
    suma += decodificar(texture2D(tSrc, vUv + px * o).rgb) * pesos[i-1];
    suma += decodificar(texture2D(tSrc, vUv - px * o).rgb) * pesos[i-1];
  }
  gl_FragColor = vec4(codificar(suma), 1.0);
}
`;
const FRAG_COMP =
  COMMON +
  `
uniform sampler2D tEscena, tBloom;
uniform float uFuerza, uExpo, uTime, uAspecto;
varying vec2 vUv;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec3 aces(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main(){
  vec2 centro = vUv - 0.5;
  centro.x *= uAspecto;
  float radial = length(centro);

  
  vec2 dir = (vUv - 0.5) * radial * 0.012;
  float r = decodificar(texture2D(tEscena, vUv + dir).rgb).r;
  float g = decodificar(texture2D(tEscena, vUv).rgb).g;
  float b = decodificar(texture2D(tEscena, vUv - dir).rgb).b;
  vec3 col = vec3(r, g, b);

  col += decodificar(texture2D(tBloom, vUv).rgb) * uFuerza;

  
  col += decodificar(texture2D(tBloom, vec2(1.0) - vUv).rgb)
         * vec3(0.55, 0.70, 1.00) * 0.06;

  col *= uExpo;

  
  col *= vec3(1.06, 0.99, 0.88);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 0.92);

  col = aces(col);
  col = pow(col, vec3(1.0 / 1.10));  

  
  col *= 1.0 - smoothstep(0.45, 1.05, radial) * 0.55;

  
  col += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.022;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** The marquee text card the lens bends (drawn once per change on a 2D canvas). */
function drawText(ctx: CanvasRenderingContext2D, raw: string) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const str = raw.trim().toUpperCase();
  if (!str) return false;
  const tracking = 0.42;
  let size = 250;
  const font = (t: number) =>
    `700 ${t}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  ctx.font = font(size);
  const width = (s: string) => {
    let w = 0;
    for (let i = 0; i < s.length; i++)
      w +=
        ctx.measureText(s[i]).width + (i < s.length - 1 ? tracking * size : 0);
    return w;
  };
  const margin = 130;
  let w = width(str);
  if (w > W - margin * 2) {
    size = Math.max(64, (size * (W - margin * 2)) / w);
    ctx.font = font(size);
    w = width(str);
  }
  let x = (W - w) / 2;
  const y = H * 0.5;
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,180,94,0.85)";
  ctx.shadowBlur = 48;
  ctx.fillStyle = "#fff3df";
  for (const ch of str) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + tracking * size;
  }
  ctx.shadowBlur = 0;
  const lw = Math.min(w * 1.04, W - margin * 2);
  const lx = (W - lw) / 2;
  ctx.fillStyle = "rgba(255,243,223,0.7)";
  ctx.fillRect(lx, y - size * 0.74, lw, 4);
  ctx.fillRect(lx, y + size * 0.66, lw, 4);
  ctx.font = '400 42px "Courier New", monospace';
  const sub = "S P A C E T I M E   C U R V A T U R E";
  const sw = ctx.measureText(sub).width;
  if (sw < lw) {
    ctx.fillStyle = "rgba(255,200,140,0.9)";
    ctx.fillText(sub, (W - sw) / 2, y + size * 0.66 + 66);
  }
  ctx.save();
  ctx.translate(48, H * 0.5);
  ctx.rotate(Math.PI / 4);
  ctx.shadowColor = "rgba(255,180,94,0.8)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "rgba(255,200,140,0.95)";
  ctx.fillRect(-15, -15, 30, 30);
  ctx.restore();
  return true;
}

/** A black hole you can orbit (drag), zoom (pinch or wheel) and reset (double tap). */
export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Horizon> {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  el.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  const base = dprFor(tier);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  const uSim = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCamDist: { value: 27 },
    uYaw: { value: 0 },
    uPitch: { value: 0.12 },
    uVel: { value: 1 },
    uTemp: { value: 0.45 },
    uDoppler: { value: 1 },
    uFondo: { value: 1 },
    uPasos: { value: 230 },
    tTexto: { value: null as THREE.Texture | null },
    uTextoOn: { value: 1 },
  };
  const uBright = {
    tSrc: { value: null as THREE.Texture | null },
    uUmbral: { value: 0.85 },
  };
  const uBlur = {
    tSrc: { value: null as THREE.Texture | null },
    uDir: { value: new THREE.Vector2(1, 0) },
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const uComp = {
    tEscena: { value: null as THREE.Texture | null },
    tBloom: { value: null as THREE.Texture | null },
    uFuerza: { value: 0.9 },
    uExpo: { value: 1 },
    uTime: { value: 0 },
    uAspecto: { value: 1 },
  };
  const matSim = new THREE.ShaderMaterial({
    uniforms: uSim,
    vertexShader: VERT,
    fragmentShader: FRAG_SIM,
  });
  const matBright = new THREE.ShaderMaterial({
    uniforms: uBright,
    vertexShader: VERT_UV,
    fragmentShader: FRAG_BRIGHT,
  });
  const matBlur = new THREE.ShaderMaterial({
    uniforms: uBlur,
    vertexShader: VERT_UV,
    fragmentShader: FRAG_BLUR,
  });
  const matComp = new THREE.ShaderMaterial({
    uniforms: uComp,
    vertexShader: VERT_UV,
    fragmentShader: FRAG_COMP,
  });

  const textCanvas = document.createElement("canvas");
  textCanvas.width = 2048;
  textCanvas.height = 1024;
  const tctx = textCanvas.getContext("2d")!;
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.minFilter = textTex.magFilter = THREE.LinearFilter;
  textTex.generateMipmaps = false;
  uSim.tTexto.value = textTex;
  const setText = (s: string) => {
    uSim.uTextoOn.value = drawText(tctx, s) ? 1 : 0;
    textTex.needsUpdate = true;
  };
  setText("STORMSYNC");

  let rtScene: THREE.WebGLRenderTarget | null = null;
  let rtA: THREE.WebGLRenderTarget | null = null;
  let rtB: THREE.WebGLRenderTarget | null = null;
  const rt = (w: number, h: number) =>
    new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
  let size = { w: 1, h: 1 };
  let q: Quality = tier === "high" ? "high" : tier === "mid" ? "medium" : "low";
  let onQ: (q: Quality) => void = () => {};
  const apply = (next: Quality) => {
    q = next;
    renderer.setPixelRatio(base * QUALITY[q].dpr);
    renderer.setSize(size.w, size.h);
    const pr = renderer.getPixelRatio();
    uSim.uPasos.value = QUALITY[q].steps;
    uSim.uRes.value.set(size.w * pr, size.h * pr);
    uComp.uAspecto.value = size.w / size.h;
    rtScene?.dispose();
    rtA?.dispose();
    rtB?.dispose();
    rtScene = rt(size.w * pr, size.h * pr);
    rtA = rt(size.w * pr * 0.5, size.h * pr * 0.5);
    rtB = rt(size.w * pr * 0.5, size.h * pr * 0.5);
    onQ(q);
  };
  const unwatch = watchSize(el, (w, h) => {
    size = { w, h };
    apply(q);
  });

  let yaw = 0;
  let pitch = 0.12;
  let dist = 27;
  let orbit = !reduced;
  let dragging = false;
  let px = 0;
  let py = 0;
  let pinch = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  const down = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragging = pointers.size === 1;
    px = e.clientX;
    py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) dist = Math.max(6, Math.min(34, dist * (pinch / d)));
      pinch = d;
      dragging = false;
      return;
    }
    if (!dragging) return;
    yaw += (e.clientX - px) * 0.005;
    pitch = Math.max(-1.35, Math.min(1.35, pitch + (e.clientY - py) * 0.004));
    px = e.clientX;
    py = e.clientY;
  };
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = 0;
    dragging = false;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    dist = Math.max(6, Math.min(34, dist * (1 + Math.sign(e.deltaY) * 0.08)));
  };
  const reset = () => {
    yaw = 0;
    pitch = 0.12;
    dist = 27;
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("dblclick", reset);

  // Steps down a quality level once if the first ~90 frames run under 28 fps.
  let samples = 0;
  let acc = 0;
  let degraded = false;
  const l = loop((t, dt) => {
    if (!degraded && samples < 90) {
      samples++;
      acc += dt;
      if (samples === 90 && acc / 90 > 1 / 28) {
        degraded = true;
        if (q !== "low") apply(q === "high" ? "medium" : "low");
      }
    }
    if (orbit && !dragging) yaw += dt * 0.04;
    uSim.uTime.value = t;
    uSim.uYaw.value = yaw;
    uSim.uPitch.value = pitch;
    uSim.uCamDist.value = dist;
    uComp.uTime.value = t;
    quad.material = matSim;
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    quad.material = matBright;
    uBright.tSrc.value = rtScene!.texture;
    renderer.setRenderTarget(rtA);
    renderer.render(scene, camera);
    quad.material = matBlur;
    for (let k = 0; k < QUALITY[q].blur; k++) {
      uBlur.uRes.value.set(rtA!.width, rtA!.height);
      uBlur.uDir.value.set(1 + k, 0);
      uBlur.tSrc.value = rtA!.texture;
      renderer.setRenderTarget(rtB);
      renderer.render(scene, camera);
      uBlur.uDir.value.set(0, 1 + k);
      uBlur.tSrc.value = rtB!.texture;
      renderer.setRenderTarget(rtA);
      renderer.render(scene, camera);
    }
    quad.material = matComp;
    uComp.tEscena.value = rtScene!.texture;
    uComp.tBloom.value = rtA!.texture;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  });

  return {
    pause: l.pause,
    set(k, v) {
      if (k === "exposure") uComp.uExpo.value = v;
      if (k === "glow") uComp.uFuerza.value = v;
      if (k === "speed") uSim.uVel.value = v;
      if (k === "temperature") uSim.uTemp.value = v;
    },
    toggle(k, on) {
      if (k === "doppler") uSim.uDoppler.value = on ? 1 : 0;
      if (k === "nebula") uSim.uFondo.value = on ? 1 : 0;
      if (k === "orbit") orbit = on;
    },
    text: setText,
    quality: apply,
    onQuality(cb) {
      onQ = cb;
      cb(q);
    },
    dispose() {
      l.stop();
      unwatch();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("dblclick", reset);
      rtScene?.dispose();
      rtA?.dispose();
      rtB?.dispose();
      textTex.dispose();
      [matSim, matBright, matBlur, matComp].forEach((m) => m.dispose());
      quad.geometry.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
