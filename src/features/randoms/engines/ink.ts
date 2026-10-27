/*
  Ink Flow: a GPU fluid you stir with a finger (Jos Stam's "stable fluids": advect, add
  vorticity, solve pressure, subtract its gradient), with colored dye carried along. Written
  for StormSync from the published method; the shading follows Pavel Dobryakov's well-known
  WebGL Fluid Simulation (MIT).
*/
import { dprFor, loop, watchSize, type Ctx, type Scene } from "../stage";
import { addCanvas, loseContext, pointer, program } from "./gl";

export type Ink = Scene & { splash(): void };

type Fmt = { i: number; f: number };
type Fbo = {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
  attach(id: number): number;
};
type Double = {
  w: number;
  h: number;
  tx: number;
  ty: number;
  read: Fbo;
  write: Fbo;
  swap(): void;
};

const VS = `precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;
void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}`;
const HEAD =
  "precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;";
const CLEAR = `uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}`;
const SPLAT = `uniform sampler2D uTarget;uniform float aspectRatio,radius;uniform vec3 color;uniform vec2 point;
void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 s=exp(-dot(p,p)/radius)*color;gl_FragColor=vec4(texture2D(uTarget,vUv).xyz+s,1.);}`;
const ADVECT = `uniform sampler2D uVelocity,uSource;uniform vec2 texelSize,dyeTexelSize;uniform float dt,dissipation;uniform bool manual;
vec4 bilerp(sampler2D s,vec2 uv,vec2 ts){vec2 st=uv/ts-.5;vec2 i=floor(st);vec2 f=fract(st);
vec4 a=texture2D(s,(i+vec2(.5,.5))*ts),b=texture2D(s,(i+vec2(1.5,.5))*ts),c=texture2D(s,(i+vec2(.5,1.5))*ts),d=texture2D(s,(i+vec2(1.5,1.5))*ts);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
void main(){vec2 coord=vUv-dt*(manual?bilerp(uVelocity,vUv,texelSize).xy:texture2D(uVelocity,vUv).xy)*texelSize;
vec4 r=manual?bilerp(uSource,coord,dyeTexelSize):texture2D(uSource,coord);gl_FragColor=r/(1.+dissipation*dt);}`;
const DIVERGENCE = `uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;
if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}`;
const CURL = `uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}`;
const VORTICITY = `uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;
vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;vec2 v=texture2D(uVelocity,vUv).xy+f*dt;v=clamp(v,-1000.,1000.);gl_FragColor=vec4(v,0.,1.);}`;
const PRESSURE = `uniform sampler2D uPressure,uDivergence;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x,d=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-d)*.25,0.,0.,1.);}`;
const GRADIENT = `uniform sampler2D uPressure,uVelocity;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;vec2 v=texture2D(uVelocity,vUv).xy-vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}`;
// Ink on a near-black page, lit from above so thick ink reads as raised.
const DISPLAY = `uniform sampler2D uTexture;uniform vec2 texelSize;void main(){vec3 c=texture2D(uTexture,vUv).rgb;
vec3 lc=texture2D(uTexture,vL).rgb,rc=texture2D(uTexture,vR).rgb,tc=texture2D(uTexture,vT).rgb,bc=texture2D(uTexture,vB).rgb;
float dx=length(rc)-length(lc),dy=length(tc)-length(bc);vec3 n=normalize(vec3(dx,dy,length(texelSize)));float diff=clamp(dot(n,vec3(0.,0.,1.))+.7,.7,1.);
c*=diff;c=pow(c,vec3(.85));float a=max(c.r,max(c.g,c.b));gl_FragColor=vec4(mix(vec3(.035,.04,.07),c,clamp(a*1.6,0.,1.))+c*.15,1.);}`;

/** Gold, blue, teal, rose, amber and violet, a little varied. */
const HUES = [0.115, 0.64, 0.5, 0.88, 0.08, 0.72];
function inkColor(): [number, number, number] {
  const h =
    HUES[(Math.random() * HUES.length) | 0] + (Math.random() - 0.5) * 0.05;
  const s = 0.75 + Math.random() * 0.25;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = 1 - s;
  const q = 1 - f * s;
  const t = 1 - (1 - f) * s;
  const [r, g, b] = [
    [1, t, p],
    [q, 1, p],
    [p, 1, t],
    [p, q, 1],
    [t, p, 1],
    [1, p, q],
  ][((i % 6) + 6) % 6];
  return [r * 0.16, g * 0.16, b * 0.16];
}

export async function mount(
  el: HTMLElement,
  { tier, reduced }: Ctx,
): Promise<Ink> {
  const cv = addCanvas(el);
  const opt = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
  };
  const gl2 = cv.getContext("webgl2", opt) as WebGL2RenderingContext | null;
  const gl = (gl2 ?? cv.getContext("webgl", opt)) as WebGLRenderingContext;
  if (!gl) {
    cv.remove();
    throw new Error("WebGL is off");
  }
  // Half floats: core in WebGL 2, an extension in WebGL 1.
  let half: number | undefined;
  let linear: unknown;
  if (gl2) {
    gl2.getExtension("EXT_color_buffer_float");
    linear = gl2.getExtension("OES_texture_float_linear");
    half = gl2.HALF_FLOAT;
  } else {
    linear = gl.getExtension("OES_texture_half_float_linear");
    half = gl.getExtension("OES_texture_half_float")?.HALF_FLOAT_OES;
  }
  if (!half) {
    loseContext(gl);
    cv.remove();
    throw new Error("No float textures");
  }
  const halfType = half;
  const canRender = (ifmt: number, fmt: number) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, 4, 4, 0, fmt, halfType, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      t,
      0,
    );
    const ok =
      gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.deleteTexture(t);
    gl.deleteFramebuffer(f);
    return ok;
  };
  /** The narrowest renderable format with at least `channels` channels. */
  const fmt = (channels: 1 | 2 | 4): Fmt => {
    if (!gl2) return { i: gl.RGBA, f: gl.RGBA };
    const chain: [number, number][] = [
      [gl2.R16F, gl2.RED],
      [gl2.RG16F, gl2.RG],
      [gl2.RGBA16F, gl2.RGBA],
    ].slice(channels === 1 ? 0 : channels === 2 ? 1 : 2) as [number, number][];
    for (const [i, f] of chain) if (canRender(i, f)) return { i, f };
    throw new Error("No renderable float format");
  };
  const RGBA = fmt(4);
  const RG = fmt(2);
  const R = fmt(1);
  const filt = linear ? gl.LINEAR : gl.NEAREST;

  const P = (fs: string) => program(gl, VS, HEAD + fs);
  const clearP = P(CLEAR);
  const splatP = P(SPLAT);
  const advP = P(ADVECT);
  const divP = P(DIVERGENCE);
  const curlP = P(CURL);
  const vortP = P(VORTICITY);
  const presP = P(PRESSURE);
  const gradP = P(GRADIENT);
  const dispP = P(DISPLAY);

  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
    gl.STATIC_DRAW,
  );
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([0, 1, 2, 0, 2, 3]),
    gl.STATIC_DRAW,
  );
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  const blit = (t: Fbo | null) => {
    if (t) {
      gl.viewport(0, 0, t.w, t.h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
  const made: Fbo[] = [];
  const fbo = (w: number, h: number, f: Fmt, param: number): Fbo => {
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, f.i, w, h, 0, f.f, halfType, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const o = {
      tex,
      fbo: fb,
      w,
      h,
      attach(id: number) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        return id;
      },
    };
    made.push(o);
    return o;
  };
  const double = (w: number, h: number, f: Fmt, param: number): Double => {
    let a = fbo(w, h, f, param);
    let b = fbo(w, h, f, param);
    return {
      w,
      h,
      tx: 1 / w,
      ty: 1 / h,
      get read() {
        return a;
      },
      get write() {
        return b;
      },
      swap() {
        [a, b] = [b, a];
      },
    };
  };
  const res = (n: number) => {
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const a = Math.max(W / H, H / W);
    const lo = Math.round(n);
    const hi = Math.round(n * a);
    return W > H ? { w: hi, h: lo } : { w: lo, h: hi };
  };
  // Slow phones: a coarser grid, thinner dye and fewer pressure passes.
  const SIM = tier === "low" ? 80 : tier === "mid" ? 112 : 128;
  const DYE = tier === "low" ? 384 : tier === "mid" ? 512 : 768;
  const PASSES = tier === "low" ? 12 : 20;
  let dye!: Double;
  let vel!: Double;
  let pres!: Double;
  let div!: Fbo;
  let curl!: Fbo;
  const build = () => {
    for (const o of made.splice(0)) {
      gl.deleteTexture(o.tex);
      gl.deleteFramebuffer(o.fbo);
    }
    const s = res(SIM);
    const d = res(DYE);
    dye = double(d.w, d.h, RGBA, filt);
    vel = double(s.w, s.h, RG, filt);
    div = fbo(s.w, s.h, R, gl.NEAREST);
    curl = fbo(s.w, s.h, R, gl.NEAREST);
    pres = double(s.w, s.h, R, gl.NEAREST);
  };

  const splat = (
    x: number,
    y: number,
    dx: number,
    dy: number,
    c: [number, number, number],
  ) => {
    splatP.bind();
    gl.uniform1i(splatP.u.uTarget, vel.read.attach(0));
    gl.uniform1f(splatP.u.aspectRatio, cv.width / cv.height);
    gl.uniform2f(splatP.u.point, x, y);
    gl.uniform3f(splatP.u.color, dx, dy, 0);
    gl.uniform1f(
      splatP.u.radius,
      (0.22 / 100) * (cv.width > cv.height ? 1 : cv.width / cv.height + 0.4),
    );
    blit(vel.write);
    vel.swap();
    gl.uniform1i(splatP.u.uTarget, dye.read.attach(0));
    gl.uniform3f(splatP.u.color, c[0], c[1], c[2]);
    blit(dye.write);
    dye.swap();
  };
  const burst = (n: number) => {
    for (let i = 0; i < n; i++) {
      const c = inkColor().map((v) => v * 8) as [number, number, number];
      splat(
        Math.random(),
        Math.random(),
        1000 * (Math.random() - 0.5),
        1000 * (Math.random() - 0.5),
        c,
      );
    }
  };

  const dpr = dprFor(tier);
  const unwatch = watchSize(el, (w, h) => {
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (W === cv.width && H === cv.height && dye) return;
    cv.width = W;
    cv.height = H;
    build();
    burst(reduced ? 3 : 6);
  });

  const step = (dt: number) => {
    gl.disable(gl.BLEND);
    curlP.bind();
    gl.uniform2f(curlP.u.texelSize, vel.tx, vel.ty);
    gl.uniform1i(curlP.u.uVelocity, vel.read.attach(0));
    blit(curl);
    vortP.bind();
    gl.uniform2f(vortP.u.texelSize, vel.tx, vel.ty);
    gl.uniform1i(vortP.u.uVelocity, vel.read.attach(0));
    gl.uniform1i(vortP.u.uCurl, curl.attach(1));
    gl.uniform1f(vortP.u.curl, 28);
    gl.uniform1f(vortP.u.dt, dt);
    blit(vel.write);
    vel.swap();
    divP.bind();
    gl.uniform2f(divP.u.texelSize, vel.tx, vel.ty);
    gl.uniform1i(divP.u.uVelocity, vel.read.attach(0));
    blit(div);
    clearP.bind();
    gl.uniform1i(clearP.u.uTexture, pres.read.attach(0));
    gl.uniform1f(clearP.u.value, 0.8);
    blit(pres.write);
    pres.swap();
    presP.bind();
    gl.uniform2f(presP.u.texelSize, vel.tx, vel.ty);
    gl.uniform1i(presP.u.uDivergence, div.attach(0));
    for (let i = 0; i < PASSES; i++) {
      gl.uniform1i(presP.u.uPressure, pres.read.attach(1));
      blit(pres.write);
      pres.swap();
    }
    gradP.bind();
    gl.uniform2f(gradP.u.texelSize, vel.tx, vel.ty);
    gl.uniform1i(gradP.u.uPressure, pres.read.attach(0));
    gl.uniform1i(gradP.u.uVelocity, vel.read.attach(1));
    blit(vel.write);
    vel.swap();
    advP.bind();
    gl.uniform2f(advP.u.texelSize, vel.tx, vel.ty);
    gl.uniform1i(advP.u.manual, linear ? 0 : 1);
    if (!linear) gl.uniform2f(advP.u.dyeTexelSize, vel.tx, vel.ty);
    const v = vel.read.attach(0);
    gl.uniform1i(advP.u.uVelocity, v);
    gl.uniform1i(advP.u.uSource, v);
    gl.uniform1f(advP.u.dt, dt);
    gl.uniform1f(advP.u.dissipation, 0.2);
    blit(vel.write);
    vel.swap();
    if (!linear) gl.uniform2f(advP.u.dyeTexelSize, dye.tx, dye.ty);
    gl.uniform1i(advP.u.uVelocity, vel.read.attach(0));
    gl.uniform1i(advP.u.uSource, dye.read.attach(1));
    gl.uniform1f(advP.u.dissipation, 0.55);
    blit(dye.write);
    dye.swap();
  };

  const ptr = pointer(el, cv);
  let col = inkColor();
  let lastInput = 0;
  let lastAuto = 0;
  let frame = 0;
  const run = loop((t, dt) => {
    if (ptr.moved && (ptr.down || ptr.over)) {
      ptr.moved = false;
      const dx = (ptr.x - ptr.px) / cv.width;
      const dy = (ptr.py - ptr.y) / cv.height;
      if (dx || dy) {
        splat(
          ptr.x / cv.width,
          1 - ptr.y / cv.height,
          dx * 6000,
          dy * 6000,
          col,
        );
        lastInput = t;
      }
    }
    if (++frame % 40 === 0) col = inkColor();
    // Left alone, it stirs itself now and then (not with reduced motion).
    if (!reduced && t - lastInput > 3.5 && t - lastAuto > 1.7) {
      lastAuto = t;
      const c = inkColor().map((v) => v * 6) as [number, number, number];
      const a = Math.random() * Math.PI * 2;
      splat(
        0.2 + Math.random() * 0.6,
        0.2 + Math.random() * 0.6,
        Math.cos(a) * 700,
        Math.sin(a) * 700,
        c,
      );
    }
    step(Math.min(dt, 1 / 60));
    dispP.bind();
    gl.uniform2f(
      dispP.u.texelSize,
      1 / gl.drawingBufferWidth,
      1 / gl.drawingBufferHeight,
    );
    gl.uniform1i(dispP.u.uTexture, dye.read.attach(0));
    blit(null);
  });

  return {
    splash: () => burst(5),
    pause: run.pause,
    dispose() {
      run.stop();
      unwatch();
      ptr.off();
      loseContext(gl);
      cv.remove();
    },
  };
}
