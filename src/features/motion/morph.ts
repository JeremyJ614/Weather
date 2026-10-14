/**
 * The morph transition: one shared WebGL overlay that dissolves a region of the
 * subtab panel through organic fbm noise with a glowing primary edge (after
 * the owner's Morph Gallery): cover, swap, reveal. Subtab changes only, never
 * page changes. The canvas only shows while a transition runs. Slow phones and
 * reduced motion skip it.
 */

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `precision mediump float;
uniform vec4 u_rect;uniform float u_p;uniform float u_dir;uniform vec3 u_bg;uniform vec3 u_glow;uniform vec3 u_glow2;uniform float u_seed;
vec3 perm(vec3 x){return mod(((x*34.)+1.)*x,289.);}
float sn(vec2 v){const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);vec3 p=perm(perm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;
m*=1.79284291400159-.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}
float fbm(vec2 v){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*sn(v);v*=2.;a*=.5;}return s;}
void main(){
 vec2 f=gl_FragCoord.xy;
 if(f.x<u_rect.x||f.y<u_rect.y||f.x>u_rect.x+u_rect.z||f.y>u_rect.y+u_rect.w)discard;
 vec2 uv=(f-u_rect.xy)/u_rect.zw;
 float ar=u_rect.z/u_rect.w;
 float n=fbm(vec2(uv.x*ar,uv.y)*2.6+vec2(u_seed,u_p*.6*u_dir))*.5+.5;
 float b=u_dir>0.?uv.x:1.-uv.x;
 float v=mix(n,b,.5);
 float e=.14;
 float t=u_p*(1.+2.*e)-e;
 float cov=1.-smoothstep(t-e*.3,t+e*.3,v);
 float d=v-t;
 float k=1.-abs(u_p*2.-1.)*.35;
 float edge=exp(-abs(d)*24.)*k;
 float fringe=exp(-abs(d+.035)*55.)*k;
 vec3 glow=mix(u_glow,u_glow2,clamp(uv.y+n*.4-.2,0.,1.));
 vec3 ink=u_bg*(.75+.6*n)+glow*.09*n*n;
 vec3 c=ink*cov+glow*edge*1.9+u_glow2*fringe*.7;
 gl_FragColor=vec4(c,clamp(cov+edge*.9,0.,1.));
}`;

type GL = WebGLRenderingContext;
let canvas: HTMLCanvasElement | null = null;
let gl: GL | null = null;
let prog: WebGLProgram | null = null;
const U: Record<string, WebGLUniformLocation | null> = {};
let raf = 0;
let failed = false;

/**
 * Every phone gets the morph unless it asks for reduced motion. Slow phones render it at
 * a lower resolution instead of skipping it: a speed check taken while the page was busy
 * used to mark capable phones "low" and the morph never showed (Fix-It #5).
 */
export function morphEnabled(): boolean {
  if (typeof window === "undefined" || failed) return false;
  return !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function rgb(v: string): [number, number, number] {
  const probe = document.createElement("i");
  probe.style.color = v;
  document.body.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g) ?? ["0", "0", "0"];
  probe.remove();
  return [+m[0] / 255, +m[1] / 255, +m[2] / 255];
}

function setup(): boolean {
  if (gl) return true;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100dvh",
    zIndex: "45",
    pointerEvents: "none",
    display: "none",
  });
  document.body.appendChild(canvas);
  gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    antialias: false,
    alpha: true,
  });
  if (!gl) return !(failed = true);
  const sh = (type: number, src: string) => {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return s;
  };
  prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return !(failed = true);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  for (const k of [
    "u_rect",
    "u_p",
    "u_dir",
    "u_bg",
    "u_glow",
    "u_glow2",
    "u_seed",
  ])
    U[k] = gl.getUniformLocation(prog, k);
  return true;
}

const ease = (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2);

let seed = Math.random() * 50;
let lastRect: DOMRect | null = null;

/** Draws one frame at progress p (0 clear → 1 covered). */
type Colors = { bg: number[]; glow: number[]; glow2: number[] };
function colors(): Colors {
  const css = getComputedStyle(document.documentElement);
  return {
    bg: rgb(css.getPropertyValue("--bg") || "#0b0c14"),
    glow: rgb(css.getPropertyValue("--accent") || "#d9b76f"),
    glow2: rgb(css.getPropertyValue("--accent2") || "#a9b0d6"),
  };
}

function frame(rect: DOMRect, p: number, dir: number, c: Colors) {
  if (!gl || !canvas) return;
  const low = document.documentElement.dataset.tier === "low";
  const scale = Math.min(devicePixelRatio || 1, 1.5) * (low ? 0.4 : 0.75);
  const w = Math.round(innerWidth * scale);
  const h = Math.round(innerHeight * scale);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  gl.uniform4f(
    U.u_rect,
    rect.left * scale,
    (innerHeight - rect.bottom) * scale,
    rect.width * scale,
    rect.height * scale,
  );
  gl.uniform1f(U.u_p, p);
  gl.uniform1f(U.u_dir, dir);
  gl.uniform1f(U.u_seed, seed);
  gl.uniform3fv(U.u_bg, c.bg);
  gl.uniform3fv(U.u_glow, c.glow);
  gl.uniform3fv(U.u_glow2, c.glow2);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function run(
  rect: DOMRect,
  from: number,
  to: number,
  dir: number,
  ms: number,
): Promise<void> {
  if (!morphEnabled() || !setup()) return Promise.resolve();
  cancelAnimationFrame(raf);
  canvas!.style.display = "block";
  lastRect = rect;
  const c = colors();
  return new Promise((done) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      frame(rect, from + (to - from) * ease(t), dir, c);
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        if (to === 0) canvas!.style.display = "none";
        done();
      }
    };
    raf = requestAnimationFrame(step);
  });
}

/** Clips a rect to the visible viewport. */
export function visible(el: Element): DOMRect {
  const r = el.getBoundingClientRect();
  const top = Math.max(0, r.top);
  const bottom = Math.min(innerHeight, r.bottom);
  return new DOMRect(r.left, top, r.width, Math.max(0, bottom - top));
}

export const morphCover = (rect: DOMRect, dir = 1, ms = 340) => {
  seed = Math.random() * 50;
  return run(rect, 0, 1, dir, ms);
};
export const morphReveal = (rect: DOMRect | null, dir = 1, ms = 600) =>
  run(
    rect ?? lastRect ?? new DOMRect(0, 0, innerWidth, innerHeight),
    1,
    0,
    dir,
    ms,
  );
