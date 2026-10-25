/* The 5 new Randoms, each mounted into the lab's stage: impl(stage, hud, hint) → { destroy }. */
const RANDOM_IMPL = (() => {
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  function canvas(stage, scale = 1) {
    const cv = document.createElement("canvas");
    stage.insertBefore(cv, stage.firstChild);
    const fit = () => {
      const r = stage.getBoundingClientRect();
      cv.width = Math.max(2, Math.round(r.width * DPR() * scale));
      cv.height = Math.max(2, Math.round(r.height * DPR() * scale));
    };
    fit();
    return { cv, fit };
  }
  function button(hud, label, ic, on) {
    const b = K.h("button", "btn small", `${ic ? icon(ic) : ""}${label}`);
    b.type = "button";
    b.onclick = on;
    hud.append(b);
    return b;
  }
  /** Pointer position in canvas pixels (and CSS pixels), with press state. */
  function pointer(el, cv) {
    const p = { x: 0, y: 0, px: 0, py: 0, down: false, moved: false, over: false, id: null };
    const pos = (e) => { const r = el.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
    const d = (e) => { if (p.id !== null) return; p.id = e.pointerId; [p.x, p.y] = pos(e); p.px = p.x; p.py = p.y; p.down = true; p.moved = true; try { el.setPointerCapture(e.pointerId); } catch (er) {} };
    const m = (e) => { if (p.id !== null && e.pointerId !== p.id) return; p.over = true; const [x, y] = pos(e); p.px = p.x; p.py = p.y; p.x = x; p.y = y; p.moved = true; };
    const u = (e) => { if (e.pointerId !== p.id) return; p.id = null; p.down = false; };
    const l = () => (p.over = false);
    el.addEventListener("pointerdown", d); el.addEventListener("pointermove", m); el.addEventListener("pointerup", u); el.addEventListener("pointercancel", u); el.addEventListener("pointerleave", l);
    p.off = () => { el.removeEventListener("pointerdown", d); el.removeEventListener("pointermove", m); el.removeEventListener("pointerup", u); el.removeEventListener("pointercancel", u); el.removeEventListener("pointerleave", l); };
    return p;
  }
  function program(gl, vs, fs) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "aPosition");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ""); u[name] = gl.getUniformLocation(p, name); }
    return { p, u, bind() { gl.useProgram(p); } };
  }

  /* ─────────────── Ink Flow: GPU fluid (stable fluids) ─────────────── */
  function ink(stage, hud, hint) {
    hint("Drag through the ink");
    const { cv, fit } = canvas(stage);
    const opt = { alpha: false, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    let gl = cv.getContext("webgl2", opt);
    const gl2 = !!gl;
    if (!gl) gl = cv.getContext("webgl", opt) || cv.getContext("experimental-webgl", opt);
    if (!gl) throw new Error("WebGL is off");
    let halfType, linear;
    if (gl2) { gl.getExtension("EXT_color_buffer_float"); linear = gl.getExtension("OES_texture_float_linear"); halfType = gl.HALF_FLOAT; }
    else { const hf = gl.getExtension("OES_texture_half_float"); linear = gl.getExtension("OES_texture_half_float_linear"); halfType = hf && hf.HALF_FLOAT_OES; }
    if (!halfType) throw new Error("No float textures");
    const canRender = (ifmt, fmt) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, 4, 4, 0, fmt, halfType, null);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.deleteTexture(t); gl.deleteFramebuffer(f);
      return ok;
    };
    const pickFmt = (ifmt, fmt) => {
      if (!gl2) return { i: gl.RGBA, f: gl.RGBA };
      const chain = [[ifmt, fmt], [gl.RG16F, gl.RG], [gl.RGBA16F, gl.RGBA]];
      for (const [a, b] of chain.slice(ifmt === gl.R16F ? 0 : ifmt === gl.RG16F ? 1 : 2)) if (canRender(a, b)) return { i: a, f: b };
      throw new Error("No renderable float format");
    };
    const RGBA = pickFmt(gl2 ? gl.RGBA16F : gl.RGBA, gl.RGBA), RG = pickFmt(gl2 ? gl.RG16F : gl.RGBA, gl2 ? gl.RG : gl.RGBA), R = pickFmt(gl2 ? gl.R16F : gl.RGBA, gl2 ? gl.RED : gl.RGBA);
    const filt = linear ? gl.LINEAR : gl.NEAREST;

    const VS = `precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;
void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}`;
    const P = (fs) => program(gl, VS, "precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;" + fs);
    const clearP = P(`uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}`);
    const splatP = P(`uniform sampler2D uTarget;uniform float aspectRatio,radius;uniform vec3 color;uniform vec2 point;
void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 s=exp(-dot(p,p)/radius)*color;gl_FragColor=vec4(texture2D(uTarget,vUv).xyz+s,1.);}`);
    const advP = P(`uniform sampler2D uVelocity,uSource;uniform vec2 texelSize,dyeTexelSize;uniform float dt,dissipation;uniform bool manual;
vec4 bilerp(sampler2D s,vec2 uv,vec2 ts){vec2 st=uv/ts-.5;vec2 i=floor(st);vec2 f=fract(st);
vec4 a=texture2D(s,(i+vec2(.5,.5))*ts),b=texture2D(s,(i+vec2(1.5,.5))*ts),c=texture2D(s,(i+vec2(.5,1.5))*ts),d=texture2D(s,(i+vec2(1.5,1.5))*ts);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
void main(){vec2 coord=vUv-dt*(manual?bilerp(uVelocity,vUv,texelSize).xy:texture2D(uVelocity,vUv).xy)*texelSize;
vec4 r=manual?bilerp(uSource,coord,dyeTexelSize):texture2D(uSource,coord);gl_FragColor=r/(1.+dissipation*dt);}`);
    const divP = P(`uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;
if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}`);
    const curlP = P(`uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}`);
    const vortP = P(`uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;
vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;vec2 v=texture2D(uVelocity,vUv).xy+f*dt;v=clamp(v,-1000.,1000.);gl_FragColor=vec4(v,0.,1.);}`);
    const presP = P(`uniform sampler2D uPressure,uDivergence;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x,d=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-d)*.25,0.,0.,1.);}`);
    const gradP = P(`uniform sampler2D uPressure,uVelocity;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;vec2 v=texture2D(uVelocity,vUv).xy-vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}`);
    const dispP = P(`uniform sampler2D uTexture;uniform vec2 texelSize;void main(){vec3 c=texture2D(uTexture,vUv).rgb;
vec3 lc=texture2D(uTexture,vL).rgb,rc=texture2D(uTexture,vR).rgb,tc=texture2D(uTexture,vT).rgb,bc=texture2D(uTexture,vB).rgb;
float dx=length(rc)-length(lc),dy=length(tc)-length(bc);vec3 n=normalize(vec3(dx,dy,length(texelSize)));float diff=clamp(dot(n,vec3(0.,0.,1.))+.7,.7,1.);
c*=diff;c=pow(c,vec3(.85));float a=max(c.r,max(c.g,c.b));gl_FragColor=vec4(mix(vec3(.035,.04,.07),c,clamp(a*1.6,0.,1.))+c*.15,1.);}`);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    const blit = (t) => {
      if (t) { gl.viewport(0, 0, t.w, t.h); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); }
      else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
    const fbo = (w, h, f, param) => {
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, f.i, w, h, 0, f.f, halfType, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fbo: fb, w, h, tx: 1 / w, ty: 1 / h, attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
    };
    const dfbo = (w, h, f, param) => {
      let a = fbo(w, h, f, param), b = fbo(w, h, f, param);
      return { w, h, tx: 1 / w, ty: 1 / h, get read() { return a; }, get write() { return b; }, swap() { const t = a; a = b; b = t; } };
    };
    const res = (n) => { let a = gl.drawingBufferWidth / gl.drawingBufferHeight; if (a < 1) a = 1 / a; const mn = Math.round(n), mx = Math.round(n * a); return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: mx, h: mn } : { w: mn, h: mx }; };
    const small = Math.min(cv.width, cv.height) < 900;
    let sim, dye, vel, div, curlT, pres;
    const init = () => {
      sim = res(small ? 112 : 128); dye = res(small ? 512 : 768);
      dyeF = dfbo(dye.w, dye.h, RGBA, filt); vel = dfbo(sim.w, sim.h, RG, filt);
      div = fbo(sim.w, sim.h, R, gl.NEAREST); curlT = fbo(sim.w, sim.h, R, gl.NEAREST); pres = dfbo(sim.w, sim.h, R, gl.NEAREST);
    };
    let dyeF;
    init();
    const splat = (x, y, dx, dy, c) => {
      splatP.bind();
      gl.uniform1i(splatP.u.uTarget, vel.read.attach(0));
      gl.uniform1f(splatP.u.aspectRatio, cv.width / cv.height);
      gl.uniform2f(splatP.u.point, x, y);
      gl.uniform3f(splatP.u.color, dx, dy, 0);
      gl.uniform1f(splatP.u.radius, (0.22 / 100) * (cv.width > cv.height ? 1 : cv.width / cv.height + 0.4));
      blit(vel.write); vel.swap();
      gl.uniform1i(splatP.u.uTarget, dyeF.read.attach(0));
      gl.uniform3f(splatP.u.color, c[0], c[1], c[2]);
      blit(dyeF.write); dyeF.swap();
    };
    const HUES = [0.115, 0.64, 0.5, 0.88, 0.08, 0.72];
    const color = () => {
      const h = HUES[(Math.random() * HUES.length) | 0] + (Math.random() - 0.5) * 0.05, s = 0.75 + Math.random() * 0.25, v = 1;
      const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
      const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
      return [r * 0.16, g * 0.16, b * 0.16];
    };
    const burst = (n) => { for (let i = 0; i < n; i++) { const c = color(); c[0] *= 8; c[1] *= 8; c[2] *= 8; splat(Math.random(), Math.random(), 1000 * (Math.random() - 0.5), 1000 * (Math.random() - 0.5), c); } };
    burst(7);
    const ptr = pointer(stage, cv);
    let col = color(), lastInput = performance.now(), lastAuto = 0, frameN = 0;
    const step = (dt) => {
      gl.disable(gl.BLEND);
      curlP.bind(); gl.uniform2f(curlP.u.texelSize, vel.tx, vel.ty); gl.uniform1i(curlP.u.uVelocity, vel.read.attach(0)); blit(curlT);
      vortP.bind(); gl.uniform2f(vortP.u.texelSize, vel.tx, vel.ty); gl.uniform1i(vortP.u.uVelocity, vel.read.attach(0)); gl.uniform1i(vortP.u.uCurl, curlT.attach(1)); gl.uniform1f(vortP.u.curl, 28); gl.uniform1f(vortP.u.dt, dt); blit(vel.write); vel.swap();
      divP.bind(); gl.uniform2f(divP.u.texelSize, vel.tx, vel.ty); gl.uniform1i(divP.u.uVelocity, vel.read.attach(0)); blit(div);
      clearP.bind(); gl.uniform1i(clearP.u.uTexture, pres.read.attach(0)); gl.uniform1f(clearP.u.value, 0.8); blit(pres.write); pres.swap();
      presP.bind(); gl.uniform2f(presP.u.texelSize, vel.tx, vel.ty); gl.uniform1i(presP.u.uDivergence, div.attach(0));
      for (let i = 0; i < 20; i++) { gl.uniform1i(presP.u.uPressure, pres.read.attach(1)); blit(pres.write); pres.swap(); }
      gradP.bind(); gl.uniform2f(gradP.u.texelSize, vel.tx, vel.ty); gl.uniform1i(gradP.u.uPressure, pres.read.attach(0)); gl.uniform1i(gradP.u.uVelocity, vel.read.attach(1)); blit(vel.write); vel.swap();
      advP.bind(); gl.uniform2f(advP.u.texelSize, vel.tx, vel.ty); gl.uniform1i(advP.u.manual, linear ? 0 : 1);
      if (!linear) gl.uniform2f(advP.u.dyeTexelSize, vel.tx, vel.ty);
      const vid = vel.read.attach(0); gl.uniform1i(advP.u.uVelocity, vid); gl.uniform1i(advP.u.uSource, vid); gl.uniform1f(advP.u.dt, dt); gl.uniform1f(advP.u.dissipation, 0.2); blit(vel.write); vel.swap();
      if (!linear) gl.uniform2f(advP.u.dyeTexelSize, dyeF.tx, dyeF.ty);
      gl.uniform1i(advP.u.uVelocity, vel.read.attach(0)); gl.uniform1i(advP.u.uSource, dyeF.read.attach(1)); gl.uniform1f(advP.u.dissipation, 0.55); blit(dyeF.write); dyeF.swap();
    };
    const stop = K.loop((dt, t) => {
      if (ptr.moved && (ptr.down || ptr.over)) {
        ptr.moved = false;
        const dx = (ptr.x - ptr.px) / cv.width, dy = (ptr.py - ptr.y) / cv.height;
        if (Math.abs(dx) + Math.abs(dy) > 0) { splat(ptr.x / cv.width, 1 - ptr.y / cv.height, dx * 6000, dy * 6000, col); lastInput = t; }
      }
      if (++frameN % 40 === 0) col = color();
      if (t - lastInput > 3500 && t - lastAuto > 1700) { lastAuto = t; const c = color(); c[0] *= 6; c[1] *= 6; c[2] *= 6; const a = Math.random() * 6.28; splat(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, Math.cos(a) * 700, Math.sin(a) * 700, c); }
      step(Math.min(dt, 0.016667));
      dispP.bind(); gl.uniform2f(dispP.u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight); gl.uniform1i(dispP.u.uTexture, dyeF.read.attach(0)); blit(null);
    });
    button(hud, "Splash", "Droplet", () => burst(5));
    const onR = () => { fit(); init(); burst(5); };
    addEventListener("resize", onR);
    return { destroy() { stop(); ptr.off(); removeEventListener("resize", onR); const lose = gl.getExtension("WEBGL_lose_context"); lose && lose.loseContext(); } };
  }

  /* ─────────────── Murmuration: flocking ─────────────── */
  function flock(stage, hud, hint) {
    hint("Touch the sky to scatter them");
    const { cv, fit } = canvas(stage);
    const g = cv.getContext("2d");
    let W = cv.width, H = cv.height, s = DPR();
    const N = Math.min(2200, Math.round((W * H) / (s * s) / 110));
    const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = Math.random() * 120 * s; px[i] = W / 2 + Math.cos(a) * r; py[i] = H * 0.42 + Math.sin(a) * r * 0.5; const b = Math.random() * 6.28; vx[i] = Math.cos(b) * 90 * s; vy[i] = Math.sin(b) * 90 * s; }
    const CELL = 30 * s;
    let cols, rows, head, next;
    const grid = () => { cols = Math.ceil(W / CELL) + 1; rows = Math.ceil(H / CELL) + 1; head = new Int32Array(cols * rows); next = new Int32Array(N); };
    grid();
    let sky;
    const paint = () => {
      sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0b0c1d"); sky.addColorStop(0.45, "#2a1f3d"); sky.addColorStop(0.75, "#7a4a4a"); sky.addColorStop(0.92, "#d9a066"); sky.addColorStop(1, "#f0c27a");
    };
    paint();
    const ptr = pointer(stage, cv);
    let T = 0;
    const stop = K.loop((dt) => {
      T += dt;
      head.fill(-1);
      for (let i = 0; i < N; i++) { const c = Math.min(cols - 1, Math.max(0, (px[i] / CELL) | 0)) + Math.min(rows - 1, Math.max(0, (py[i] / CELL) | 0)) * cols; next[i] = head[c]; head[c] = i; }
      const ax = W / 2 + Math.cos(T * 0.31) * W * 0.28 + Math.sin(T * 0.73) * W * 0.08, ay = H * 0.4 + Math.sin(T * 0.47) * H * 0.18;
      const R2 = CELL * CELL, SEP = (5.5 * s) ** 2, max = 160 * s, min = 80 * s;
      const prey = ptr.down || ptr.over;
      for (let i = 0; i < N; i++) {
        const cx = (px[i] / CELL) | 0, cy = (py[i] / CELL) | 0;
        let n = 0, avx = 0, avy = 0, cmx = 0, cmy = 0, sx = 0, sy = 0;
        for (let oy = -1; oy <= 1; oy++) {
          const yy = cy + oy; if (yy < 0 || yy >= rows) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = cx + ox; if (xx < 0 || xx >= cols) continue;
            for (let j = head[xx + yy * cols]; j !== -1; j = next[j]) {
              if (j === i) continue;
              const dx = px[j] - px[i], dy = py[j] - py[i], d2 = dx * dx + dy * dy;
              if (d2 > R2) continue;
              n++; avx += vx[j]; avy += vy[j]; cmx += dx; cmy += dy;
              if (d2 < SEP) { sx -= dx / (d2 + 1); sy -= dy / (d2 + 1); }
            }
          }
        }
        let fx = 0, fy = 0;
        if (n) { fx += (avx / n - vx[i]) * 2.4 + (cmx / n) * 2.6; fy += (avy / n - vy[i]) * 2.4 + (cmy / n) * 2.6; }
        fx += sx * 2600 * s; fy += sy * 2600 * s;
        fx += (ax - px[i]) * 0.55; fy += (ay - py[i]) * 0.55;
        if (prey) {
          const dx = px[i] - ptr.x, dy = py[i] - ptr.y, d2 = dx * dx + dy * dy, rr = (120 * s) ** 2;
          if (d2 < rr) { const k = (1 - d2 / rr) * 2600 * s / Math.sqrt(d2 + 1); fx += dx * k; fy += dy * k; }
        }
        vx[i] += fx * dt; vy[i] += fy * dt;
        const sp = Math.hypot(vx[i], vy[i]) || 1;
        if (sp > max) { vx[i] *= max / sp; vy[i] *= max / sp; } else if (sp < min) { vx[i] *= min / sp; vy[i] *= min / sp; }
      }
      for (let i = 0; i < N; i++) {
        px[i] += vx[i] * dt; py[i] += vy[i] * dt;
        if (px[i] < -20) px[i] = W + 20; else if (px[i] > W + 20) px[i] = -20;
        if (py[i] < H * 0.06) vy[i] += 600 * s * dt; else if (py[i] > H * 0.86) vy[i] -= 600 * s * dt;
      }
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255,226,170,.16)";
      g.beginPath(); g.arc(W * 0.7, H * 0.93, 46 * s, 0, 6.28); g.fill();
      g.strokeStyle = "#07070d"; g.lineWidth = 1.5 * s; g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i < N; i++) { const sp = Math.hypot(vx[i], vy[i]) || 1, k = (2.2 * s) / sp; g.moveTo(px[i] - vx[i] * k, py[i] - vy[i] * k); g.lineTo(px[i] + vx[i] * k * 0.5, py[i] + vy[i] * k * 0.5); }
      g.stroke();
      g.fillStyle = "#06060b";
      g.fillRect(0, H * 0.965, W, H * 0.04);
    });
    const onR = () => { fit(); W = cv.width; H = cv.height; s = DPR(); grid(); paint(); };
    addEventListener("resize", onR);
    return { destroy() { stop(); ptr.off(); removeEventListener("resize", onR); } };
  }

  /* ─────────────── Plasma Globe: shader ─────────────── */
  function plasma(stage, hud, hint) {
    hint("Touch the glass");
    const { cv, fit } = canvas(stage, 0.7);
    const gl = cv.getContext("webgl", { antialias: false, alpha: false }) || cv.getContext("experimental-webgl");
    if (!gl) throw new Error("WebGL is off");
    const FS = `precision highp float;uniform vec2 uRes;uniform float uTime,uTS,uTA,uTR;
float h(float n){return fract(sin(n)*43758.5453);}
float nz(vec2 x){vec2 p=floor(x),f=fract(x);f=f*f*(3.-2.*f);float n=p.x+p.y*57.;return mix(mix(h(n),h(n+1.),f.x),mix(h(n+57.),h(n+58.),f.x),f.y);}
float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*nz(p);p*=2.07;a*=.5;}return f;}
float ad(float a,float b){return abs(atan(sin(a-b),cos(a-b)));}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);uv.y-=.07;
 float R=.37,r=length(uv),th=atan(uv.y,uv.x);vec3 col=vec3(.012,.012,.03);
 col+=vec3(.06,.03,.11)*exp(-r*3.);
 if(r<R){
  float t=r/R;float glow=0.,hot=0.;
  for(int k=0;k<8;k++){float fk=float(k);
   float base=fk*.7854+uTime*.11*(mod(fk,2.)*2.-1.)+.9*sin(uTime*.17+fk*2.3);
   float pull=(k<2)?uTS:0.;base=mix(base,uTA+(fk-.5)*.12,pull);
   float wob=(fbm(vec2(t*3.2-uTime*1.4,fk*3.7+uTime*.2))-.5)*2.2*t*(1.15-t);
   float ang=base+wob;float d=ad(th,ang)*r;
   float br=.55+.45*sin(uTime*9.+fk*2.1+t*6.);br*=1.+pull*1.4;
   float w=mix(.006,.0022,t);
   glow+=br*(w/(d+w*.6))*.55*smoothstep(0.,.08,t);
   hot+=br*exp(-d/(w*.55));
   float tipd=length(uv-R*.985*vec2(cos(ang),sin(ang)));glow+=br*.012/(tipd+.006);
   float b2=ang+.35*sin(fk*5.+uTime*.7)*smoothstep(.55,1.,t);float d2=ad(th,b2)*r;glow+=br*.3*(w*.6/(d2+w*.5))*smoothstep(.55,.8,t);
  }
  col+=glow*vec3(.42,.16,.85)*.55+hot*vec3(.95,.75,1.)*.35;
  float c=exp(-r*26.);col+=vec3(1.,.82,1.)*c*1.6+vec3(.6,.3,1.)*exp(-r*9.)*.6;
  float rim=smoothstep(R*.8,R,r);col+=rim*rim*vec3(.2,.16,.32);
  vec2 hl=uv-vec2(-.13,.15);col+=vec3(.9,.9,1.)*.22*exp(-dot(hl,hl)*90.)*(1.-t*.3);
  col+=vec3(1.,.85,1.)*uTS*.06/(length(uv-uTR*vec2(cos(uTA),sin(uTA)))+.02)*step(.0,uTS);
 }else{col+=vec3(.36,.2,.62)*exp(-(r-R)*38.)*.6;}
 vec2 b=uv-vec2(0.,-R-.09);float stand=max(abs(b.x)-(.16-b.y*.55),abs(b.y)-.08);
 if(stand<0.){col=mix(vec3(.05,.05,.08),vec3(.11,.1,.15),smoothstep(.08,-.08,b.y));col+=vec3(.85,.7,.4)*.6*smoothstep(.006,0.,abs(stand+.004));}
 col+=vec3(.85,.7,.4)*.35*smoothstep(.01,0.,abs(length(uv)-R-.004))*step(uv.y,-R*.6);
 gl_FragColor=vec4(pow(col,vec3(.9)),1.);}`;
    const pr = program(gl, "attribute vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}", FS);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
    pr.bind();
    const ptr = pointer(stage, cv);
    let ts = 0, ta = 0, tr = 0.37;
    const stop = K.loop((dt, t) => {
      const m = Math.min(cv.width, cv.height), ux = (ptr.x - cv.width / 2) / m, uy = (cv.height / 2 - ptr.y) / m - 0.07;
      const near = (ptr.down || ptr.over) && Math.hypot(ux, uy) < 0.5;
      if (near) { const a = Math.atan2(uy, ux); ta = ta + Math.atan2(Math.sin(a - ta), Math.cos(a - ta)) * Math.min(1, dt * 12); tr = Math.min(0.37, Math.hypot(ux, uy)); }
      ts += ((near ? 1 : 0) - ts) * Math.min(1, dt * 6);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(pr.u.uRes, cv.width, cv.height); gl.uniform1f(pr.u.uTime, t / 1000); gl.uniform1f(pr.u.uTS, ts); gl.uniform1f(pr.u.uTA, ta); gl.uniform1f(pr.u.uTR, tr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    addEventListener("resize", fit);
    return { destroy() { stop(); ptr.off(); removeEventListener("resize", fit); const l = gl.getExtension("WEBGL_lose_context"); l && l.loseContext(); } };
  }

  /* ─────────────── Falling Sand ─────────────── */
  function sand(stage, hud, hint) {
    hint("Drag to pour");
    const cv = document.createElement("canvas");
    cv.style.imageRendering = "pixelated";
    stage.insertBefore(cv, stage.firstChild);
    const r = stage.getBoundingClientRect();
    const C = 150, Rr = Math.round((C * r.height) / r.width);
    cv.width = C; cv.height = Rr;
    const g = cv.getContext("2d");
    const img = g.createImageData(C, Rr), px32 = new Uint32Array(img.data.buffer);
    const E = 0, SAND = 1, WATER = 2, WALL = 3, FIRE = 4, PLANT = 5, SMOKE = 6, SEED = 7;
    const type = new Uint8Array(C * Rr), life = new Uint8Array(C * Rr), shade = new Uint8Array(C * Rr), stamp = new Uint8Array(C * Rr);
    for (let i = 0; i < shade.length; i++) shade[i] = (Math.random() * 255) | 0;
    const abgr = (r, g2, b) => (255 << 24) | (b << 16) | (g2 << 8) | r;
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const PAL = {
      [SAND]: [[214, 180, 110], [236, 204, 132]], [WATER]: [[48, 104, 196], [72, 140, 220]], [WALL]: [[70, 72, 92], [92, 94, 116]],
      [FIRE]: [[255, 120, 30], [255, 220, 90]], [PLANT]: [[46, 140, 70], [90, 190, 90]], [SMOKE]: [[60, 58, 70], [96, 94, 106]], [SEED]: [[150, 110, 60], [190, 150, 90]],
    };
    const LUT = {};
    for (const k in PAL) { LUT[k] = new Uint32Array(16); for (let i = 0; i < 16; i++) LUT[k][i] = abgr(...mix(PAL[k][0], PAL[k][1], i / 15)); }
    const BG = abgr(10, 11, 20);
    const at = (x, y) => (x < 0 || x >= C || y < 0 || y >= Rr ? -1 : x + y * C);
    const set = (i, t, l = 0) => { type[i] = t; life[i] = l; };
    const swap = (a, b) => { const t = type[a], l = life[a]; type[a] = type[b]; life[a] = life[b]; type[b] = t; life[b] = l; };
    // A floor above the buttons, then a starting scene: a walled bowl, a dune, a pool and a few sprouts.
    const F = Math.round(Rr * 0.72);
    for (let x = 0; x < C; x++) { set(at(x, F), WALL); set(at(x, F + 1), WALL); }
    for (let x = 18; x < C - 18; x++) { const y = F - 4 - Math.round(10 * Math.sin(((x - 18) / (C - 36)) * Math.PI)); set(at(x, y), WALL); }
    for (let y = F - 30; y < F; y++) { set(at(18, y), WALL); set(at(C - 19, y), WALL); }
    for (let x = 24; x < 70; x++) for (let y = F - 24 + Math.round(Math.abs(x - 47) * 0.5); y < F - 4; y++) { const i = at(x, y); if (i >= 0 && !type[i]) set(i, SAND); }
    for (let x = 80; x < C - 22; x++) for (let y = F - 20; y < F - 4; y++) { const i = at(x, y); if (i >= 0 && !type[i]) set(i, WATER); }
    for (const x of [40, 52, 60]) for (let y = F - 34; y < F - 24 + Math.round(Math.abs(x - 47) * 0.5); y++) { const i = at(x, y); if (i >= 0 && !type[i]) set(i, PLANT); }
    let frame = 0, mat = SAND;
    const near = (x, y, t) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = at(x + dx, y + dy); if (j >= 0 && type[j] === t) return j; } return -1; };
    const tick = () => {
      frame++;
      const f = frame & 255 || 1, rev = frame & 1;
      for (let y = Rr - 1; y >= 0; y--) {
        for (let k = 0; k < C; k++) {
          const x = rev ? C - 1 - k : k, i = x + y * C, t = type[i];
          if (!t || t === WALL || stamp[i] === f) continue;
          const dir = Math.random() < 0.5 ? -1 : 1;
          if (t === SAND || t === SEED) {
            const b = at(x, y + 1);
            if (b >= 0 && (type[b] === E || type[b] === WATER || type[b] === SMOKE)) { swap(i, b); stamp[b] = f; continue; }
            const d1 = at(x + dir, y + 1), d2 = at(x - dir, y + 1);
            if (d1 >= 0 && (type[d1] === E || type[d1] === WATER)) { swap(i, d1); stamp[d1] = f; continue; }
            if (d2 >= 0 && (type[d2] === E || type[d2] === WATER)) { swap(i, d2); stamp[d2] = f; continue; }
            if (t === SEED && near(x, y, WATER) >= 0) set(i, PLANT);
          } else if (t === WATER) {
            const b = at(x, y + 1);
            if (b >= 0 && (type[b] === E || type[b] === SMOKE)) { swap(i, b); stamp[b] = f; continue; }
            const d1 = at(x + dir, y + 1);
            if (d1 >= 0 && type[d1] === E) { swap(i, d1); stamp[d1] = f; continue; }
            for (const dx of [dir, -dir, dir * 2, -dir * 2]) { const s = at(x + dx, y); if (s >= 0 && type[s] === E && (Math.abs(dx) === 1 || type[at(x + Math.sign(dx), y)] === E)) { swap(i, s); stamp[s] = f; break; } }
          } else if (t === FIRE) {
            if (life[i] <= 1) { set(i, Math.random() < 0.5 ? SMOKE : E, 40 + ((Math.random() * 30) | 0)); continue; }
            life[i]--;
            const w = near(x, y, WATER);
            if (w >= 0) { set(i, SMOKE, 50); set(w, SMOKE, 40); continue; }
            for (const tt of [PLANT, SEED]) { const p = near(x, y, tt); if (p >= 0 && Math.random() < 0.35) set(p, FIRE, 25 + ((Math.random() * 25) | 0)); }
            const u = at(x + ((Math.random() * 3) | 0) - 1, y - 1);
            if (u >= 0 && type[u] === E && Math.random() < 0.7) { swap(i, u); stamp[u] = f; }
          } else if (t === SMOKE) {
            if (life[i] <= 1) { set(i, E); continue; }
            life[i]--;
            const u = at(x + ((Math.random() * 3) | 0) - 1, y - 1);
            if (u >= 0 && type[u] === E) { swap(i, u); stamp[u] = f; }
          } else if (t === PLANT) {
            if (Math.random() < 0.025) { const w = near(x, y, WATER); if (w >= 0) { set(w, PLANT); stamp[w] = f; } }
          }
        }
      }
    };
    const draw = () => {
      for (let i = 0; i < type.length; i++) { const t = type[i]; px32[i] = t ? LUT[t][t === FIRE ? (life[i] * 3 + (frame & 3)) & 15 : shade[i] & 15] : BG; }
      g.putImageData(img, 0, 0);
    };
    const ptr = pointer(stage, cv);
    const pour = () => {
      const cx = Math.round(ptr.x), cy = Math.round(ptr.y), rad = mat === WALL ? 2 : 3;
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const i = at(cx + dx, cy + dy);
        if (i < 0) continue;
        if (mat === E) { set(i, E); continue; }
        if (type[i] !== E) continue;
        if (mat !== WALL && Math.random() > 0.45) continue;
        set(i, mat, mat === FIRE ? 30 + ((Math.random() * 40) | 0) : 0);
      }
    };
    const stop = K.loop(() => { if (ptr.down) pour(); tick(); draw(); });
    const mats = [["Sand", SAND, "Grip"], ["Water", WATER, "Droplet"], ["Fire", FIRE, "Flame"], ["Seeds", SEED, "Sprout"], ["Wall", WALL, "Square"], ["Erase", E, "Minus"]];
    const btns = mats.map(([n, m, ic]) => { const b = button(hud, n, ic, () => { mat = m; btns.forEach((x) => x.classList.toggle("lit", x === b)); }); return b; });
    btns[0].classList.add("lit");
    button(hud, "Clear", "RotateCcw", () => { for (let i = 0; i < type.length; i++) if (i < F * C) { type[i] = 0; life[i] = 0; } });
    return { destroy() { stop(); ptr.off(); } };
  }

  /* ─────────────── Galaxy Forge: galaxy collision ─────────────── */
  function galaxy(stage, hud, hint) {
    hint("Drag to turn · tap Collide");
    const { cv, fit } = canvas(stage);
    const gl = cv.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false }) || cv.getContext("experimental-webgl");
    if (!gl) throw new Error("WebGL is off");
    const small = Math.min(cv.width, cv.height) < 1000;
    const N = small ? 26000 : 40000;
    const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), colr = new Float32Array(N * 4), who = new Uint8Array(N);
    const cores = [{ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 1 }, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, m: 0.7, on: false }];
    const EPS2 = 0.09;
    const vcirc = (r, m) => Math.sqrt((m * r * r) / Math.pow(r * r + EPS2, 1.5));
    const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(6.2832 * Math.random());
    /** A spiral galaxy around `core`: a warm bulge, an exponential disk and two log-spiral arms with pink star-forming knots. */
    function disk(from, to, core, tilt, pal, sense) {
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      for (let i = from; i < to; i++) {
        const kind = Math.random();
        let r, a, lz, c, al;
        if (kind < 0.16) {
          r = Math.min(0.35, Math.abs(gauss()) * 0.11 + 0.01); a = Math.random() * 6.2832; lz = gauss() * 0.06 * (1 - r * 2);
          c = pal.bulge; al = 0.45 + Math.random() * 0.4;
        } else {
          r = Math.min(1.25, 0.06 - 0.3 * Math.log(1 - Math.random() * 0.985));
          const arm = Math.random() < 0.5 ? 0 : Math.PI;
          a = Math.random() < 0.72 ? arm + Math.log(r) * 2.6 + gauss() * (0.22 + 0.1 * r) : Math.random() * 6.2832;
          lz = gauss() * 0.018;
          const t = Math.min(1, r / 1.1);
          c = Math.random() < 0.06 && r > 0.25 ? pal.knot : [pal.in[0] + (pal.out[0] - pal.in[0]) * t, pal.in[1] + (pal.out[1] - pal.in[1]) * t, pal.in[2] + (pal.out[2] - pal.in[2]) * t];
          al = 0.3 + Math.random() * 0.45;
        }
        const lx = Math.cos(a) * r, ly = Math.sin(a) * r;
        const v = vcirc(r, core.m) * sense * (kind < 0.16 ? 0.55 : 1), disp = kind < 0.16 ? 0.12 : 0.02;
        const lvx = -Math.sin(a) * v + gauss() * disp, lvy = Math.cos(a) * v + gauss() * disp, lvz = gauss() * disp * 0.5;
        pos[i * 3] = core.x + lx; pos[i * 3 + 1] = core.y + ly * ct - lz * st; pos[i * 3 + 2] = core.z + ly * st + lz * ct;
        vel[i * 3] = core.vx + lvx; vel[i * 3 + 1] = core.vy + lvy * ct - lvz * st; vel[i * 3 + 2] = core.vz + lvy * st + lvz * ct;
        colr[i * 4] = c[0]; colr[i * 4 + 1] = c[1]; colr[i * 4 + 2] = c[2]; colr[i * 4 + 3] = al;
      }
    }
    const gold = { bulge: [1, 0.82, 0.55], in: [1, 0.93, 0.8], out: [0.62, 0.74, 1], knot: [1, 0.45, 0.72] };
    const lilac = { bulge: [1, 0.78, 0.7], in: [0.92, 0.82, 1], out: [0.55, 0.85, 0.95], knot: [1, 0.5, 0.8] };
    function reset(collide) {
      Object.assign(cores[0], { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
      cores[1].on = !!collide;
      if (!collide) { disk(0, N, cores[0], 0, gold, 1); who.fill(0); return; }
      const nA = Math.round(N * 0.6);
      Object.assign(cores[1], { x: 2.2, y: 1.5, z: 0.5 });
      const d = Math.hypot(2.2, 1.5, 0.5), vesc = Math.sqrt((2 * (cores[0].m + cores[1].m)) / d) * 0.92;
      cores[1].vx = -vesc * 0.62; cores[1].vy = -vesc * 0.78; cores[1].vz = -vesc * 0.1;
      const mA = cores[0].m, mB = cores[1].m;
      cores[0].vx = (-cores[1].vx * mB) / mA; cores[0].vy = (-cores[1].vy * mB) / mA; cores[0].vz = (-cores[1].vz * mB) / mA;
      disk(0, nA, cores[0], 0.25, gold, 1);
      disk(nA, N, cores[1], 1.05, lilac, -1);
      who.fill(0, 0, nA); who.fill(1, nA);
    }
    reset(false);
    const VS = `attribute vec3 aPos;attribute vec4 aCol;uniform mat3 uRot;uniform float uDist,uScale,uSize,uAspect;varying vec4 vC;
void main(){vec3 p=uRot*aPos;float z=uDist-p.z;gl_Position=vec4(p.x*uScale/(z*uAspect),p.y*uScale/z,0.,1.);gl_PointSize=clamp(uSize/z,1.4,7.);vC=aCol;vC.a*=clamp(3.2/z,.3,1.);}`;
    const FS = `precision mediump float;varying vec4 vC;void main(){vec2 d=gl_PointCoord-.5;float a=smoothstep(.5,.0,length(d));gl_FragColor=vec4(vC.rgb*a*vC.a*.5,1.);}`;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(pr, 0, "aPos"); gl.bindAttribLocation(pr, 1, "aCol");
    gl.linkProgram(pr); gl.useProgram(pr);
    const U = (n) => gl.getUniformLocation(pr, n);
    const uRot = U("uRot"), uDist = U("uDist"), uScale = U("uScale"), uSize = U("uSize"), uAspect = U("uAspect");
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, colr, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    let yaw = 0.4, pitch = 0.72, zoom = 1, dist = 3.8, vyaw = 0.06, vpitch = 0, hold = false;
    const off = K.drag(stage, {
      down: () => { hold = true; },
      move: ({ vx, vy }) => { vyaw = vx * 0.004; vpitch = vy * 0.004; },
      up: () => { hold = false; },
    }, { threshold: 2 });
    const onWheel = (e) => { e.preventDefault(); zoom = K.clamp(zoom * Math.exp(-e.deltaY * 0.001), 0.5, 2.5); };
    stage.addEventListener("wheel", onWheel, { passive: false });
    let speed = 0.35, colorDirty = true;
    function integrate(dt) {
      const act = cores[1].on ? 2 : 1;
      if (act === 2) {
        const a = cores[0], b = cores[1], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, r2 = dx * dx + dy * dy + dz * dz + EPS2, inv = 1 / (r2 * Math.sqrt(r2));
        a.vx += dx * inv * b.m * dt; a.vy += dy * inv * b.m * dt; a.vz += dz * inv * b.m * dt;
        b.vx -= dx * inv * a.m * dt; b.vy -= dy * inv * a.m * dt; b.vz -= dz * inv * a.m * dt;
        // A touch of dynamical friction when the cores are close, so the pair merges instead of flying apart.
        const sep = Math.sqrt(r2), drag = sep < 1.4 ? 0.5 * (1.4 - sep) * dt : 0, rvx = b.vx - a.vx, rvy = b.vy - a.vy, rvz = b.vz - a.vz, fa = b.m / (a.m + b.m), fb = a.m / (a.m + b.m);
        a.vx += rvx * drag * fa; a.vy += rvy * drag * fa; a.vz += rvz * drag * fa; b.vx -= rvx * drag * fb; b.vy -= rvy * drag * fb; b.vz -= rvz * drag * fb;
        a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      }
      const c0 = cores[0], c1 = cores[1];
      for (let i = 0, j = 0; i < N; i++, j += 3) {
        let x = pos[j], y = pos[j + 1], z = pos[j + 2];
        let dx = c0.x - x, dy = c0.y - y, dz = c0.z - z, r2 = dx * dx + dy * dy + dz * dz + EPS2, k = c0.m / (r2 * Math.sqrt(r2));
        let ax = dx * k, ay = dy * k, az = dz * k;
        if (act === 2) { dx = c1.x - x; dy = c1.y - y; dz = c1.z - z; r2 = dx * dx + dy * dy + dz * dz + EPS2; k = c1.m / (r2 * Math.sqrt(r2)); ax += dx * k; ay += dy * k; az += dz * k; }
        vel[j] += ax * dt; vel[j + 1] += ay * dt; vel[j + 2] += az * dt;
        pos[j] = x + vel[j] * dt; pos[j + 1] = y + vel[j + 1] * dt; pos[j + 2] = z + vel[j + 2] * dt;
      }
    }
    const stop = K.loop((dt) => {
      const steps = 3, h = (dt * speed) / steps;
      for (let s = 0; s < steps; s++) integrate(h);
      if (!hold) { vyaw += (0.05 - vyaw) * Math.min(1, dt * 0.8); vpitch *= Math.pow(0.1, dt); }
      yaw += vyaw * dt; pitch = K.clamp(pitch + vpitch * dt, 0.15, 1.45);
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const m = [cy, -sy * cp, sy * sp, sy, cy * cp, -cy * sp, 0, sp, cp];
      const cx = cores[1].on ? (cores[0].x * cores[0].m + cores[1].x * cores[1].m) / (cores[0].m + cores[1].m) : cores[0].x;
      const cyy = cores[1].on ? (cores[0].y * cores[0].m + cores[1].y * cores[1].m) / (cores[0].m + cores[1].m) : cores[0].y;
      const czz = cores[1].on ? (cores[0].z * cores[0].m + cores[1].z * cores[1].m) / (cores[0].m + cores[1].m) : cores[0].z;
      for (let j = 0; j < N * 3; j += 3) { pos[j] -= cx; pos[j + 1] -= cyy; pos[j + 2] -= czz; }
      for (const c of cores) { c.x -= cx; c.y -= cyy; c.z -= czz; }
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0.012, 0.013, 0.03, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix3fv(uRot, false, new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]));
      const aspect = cv.width / cv.height;
      const sep = cores[1].on ? Math.hypot(cores[1].x - cores[0].x, cores[1].y - cores[0].y, cores[1].z - cores[0].z) : 0;
      dist += (Math.max(3.8, 2.6 + sep * 1.25) - dist) * Math.min(1, dt * 1.5);
      gl.uniform1f(uDist, dist / zoom);
      gl.uniform1f(uScale, aspect < 1 ? 3.3 * aspect : 3.0);
      gl.uniform1f(uAspect, aspect);
      gl.uniform1f(uSize, (small ? 8 : 9) * DPR());
      gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      if (colorDirty) { gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, colr); colorDirty = false; }
      gl.drawArrays(gl.POINTS, 0, N);
    });
    button(hud, "Collide", "Sparkles", () => { reset(true); colorDirty = true; speed = 0.55; });
    button(hud, "One galaxy", "RotateCcw", () => { reset(false); colorDirty = true; speed = 0.35; });
    addEventListener("resize", fit);
    return { destroy() { stop(); off(); stage.removeEventListener("wheel", onWheel); removeEventListener("resize", fit); const l = gl.getExtension("WEBGL_lose_context"); l && l.loseContext(); } };
  }

  return { ink, flock, plasma, sand, galaxy };
})();
