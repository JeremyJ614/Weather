/* A8 live Randoms. Each mounts into a box and returns a cleanup. Paused off screen. */
(() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  function stage(host, draw) {
    const c = el("canvas", "dm-canvas");
    host.appendChild(c);
    const g = c.getContext("2d");
    let w = 0, h = 0, d = 1, raf = 0, vis = true, last = performance.now();
    const api = { g, c, get w() { return w; }, get h() { return h; }, get d() { return d; }, onresize: null };
    const fit = () => { const r = host.getBoundingClientRect(); d = Math.min(2, devicePixelRatio || 1); w = r.width; h = r.height; c.width = w * d; c.height = h * d; g.setTransform(d, 0, 0, d, 0, 0); api.onresize && api.onresize(); };
    const ro = new ResizeObserver(fit); ro.observe(host); fit();
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) { last = performance.now(); tick(); } }); io.observe(host);
    function tick() { raf = 0; if (!vis) return; const now = performance.now(); draw(api, Math.min(0.05, (now - last) / 1000)); last = now; raf = requestAnimationFrame(tick); }
    tick();
    const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    return { api, pos, stop() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); c.remove(); } };
  }
  const R = {};

  /* Lightning Sculptor: stepped leader toward the touch, return stroke, afterglow */
  R.bolt = (host) => {
    let bolts = [], flash = 0, auto = 0;
    function make(tx, ty, w) {
      // stepped leader: random walk biased toward the target, with branches
      const segs = [], tips = [{ x: tx + rnd(-w * 0.25, w * 0.25), y: -5, main: true, life: 999 }];
      let guard = 0, done = false;
      while (!done && guard++ < 900) {
        for (const t of tips.slice()) {
          if (t.dead) continue;
          const dx = tx - t.x, dy = ty - t.y, dist = Math.hypot(dx, dy);
          const a = Math.atan2(dy, dx) + rnd(-1, 1) * (t.main ? 0.9 : 1.3);
          const L = rnd(6, 13);
          const n = { x: t.x + Math.cos(a) * L, y: t.y + Math.sin(a) * L };
          segs.push({ x1: t.x, y1: t.y, x2: n.x, y2: n.y, main: t.main, k: segs.length });
          t.x = n.x; t.y = n.y;
          if (!t.main && --t.life <= 0) t.dead = true;
          if (t.main && Math.random() < 0.07 && tips.length < 14) tips.push({ x: t.x, y: t.y, main: false, life: (rnd(6, 22)) | 0 });
          if (t.main && dist < 12) done = true;
        }
      }
      return { segs, shown: 0, phase: "lead", glow: 1 };
    }
    const s = stage(host, ({ g, w, h }, dt) => {
      g.fillStyle = "#07080f"; g.fillRect(0, 0, w, h);
      // cloud base
      const cg = g.createLinearGradient(0, 0, 0, h * 0.25); cg.addColorStop(0, "#1c1e2c"); cg.addColorStop(1, "rgba(19,20,31,0)");
      g.fillStyle = cg; g.fillRect(0, 0, w, h * 0.25);
      g.fillStyle = "#0e0f18"; g.fillRect(0, h - 18, w, 18);
      if (flash > 0) { g.fillStyle = `rgba(220,220,255,${flash * 0.35})`; g.fillRect(0, 0, w, h); flash -= dt * 3; }
      for (const b of bolts) {
        if (b.phase === "lead") { b.shown += RM ? 9999 : dt * 700; if (b.shown >= b.segs.length) { b.phase = "stroke"; flash = RM ? 0.3 : 1; } }
        else b.glow -= dt * (b.phase === "stroke" ? 1.1 : 0.6);
        const n = Math.min(b.segs.length, b.shown | 0);
        for (const pass of [[9, "rgba(169,176,214,", 0.12], [4, "rgba(217,183,111,", 0.35], [1.4, "rgba(255,255,255,", 1]]) {
          g.lineWidth = pass[0]; g.lineCap = "round";
          for (let i = 0; i < n; i++) {
            const sg = b.segs[i];
            const a = b.phase === "lead" ? 0.45 : Math.max(0, b.glow) * (sg.main ? 1 : 0.5);
            g.strokeStyle = pass[1] + a * pass[2] + ")";
            g.beginPath(); g.moveTo(sg.x1, sg.y1); g.lineTo(sg.x2, sg.y2); g.stroke();
          }
        }
      }
      bolts = bolts.filter((b) => b.glow > 0);
      auto -= dt; if (auto < 0 && !bolts.length) { auto = rnd(1.4, 2.6); bolts.push(make(rnd(w * 0.2, w * 0.8), h - 18, w)); }
    });
    s.api.c.onpointerdown = (e) => { const [x, y] = s.pos(e); bolts.push(make(x, y, s.api.w)); auto = 3; };
    host.appendChild(el("div", "dm-tag", "Tap to strike"));
    return () => s.stop();
  };

  /* Snowflake Forge: 6-fold symmetric branching, shape from temperature and humidity */
  R.flake = (host) => {
    let T = -15, H = 0.8, t = 0, seed = Math.random() * 1e4, branches = [];
    const rand = (k) => { const x = Math.sin(seed + k * 12.9898) * 43758.5453; return x - Math.floor(x); };
    function plan() {
      // Nakaya: −2 °C plates, −5 needles/columns, −15 dendrites (with high humidity), −25 plates again
      const dend = Math.exp(-((T + 15) ** 2) / 18) * H, needle = Math.exp(-((T + 5.5) ** 2) / 3), plate = 1 - Math.max(dend, needle);
      branches = [];
      const n = 5 + ((rand(1) * 4) | 0);
      for (let i = 0; i < n; i++) {
        const at = (i + 1) / (n + 1), len = (0.15 + rand(i + 3) * 0.35) * dend * (1 - at * 0.6);
        branches.push({ at, len, ang: 0.95 + rand(i + 9) * 0.2, sub: dend > 0.55 && rand(i + 20) > 0.4 });
      }
      return { dend, needle, plate };
    }
    let mix = plan();
    const s = stage(host, ({ g, w, h }, dt) => {
      t = Math.min(1, t + dt * (RM ? 9 : 0.28));
      g.fillStyle = "#08090f"; g.fillRect(0, 0, w, h);
      const R0 = Math.min(w, h) * 0.38, cx = w / 2, cy = h / 2 - 12;
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, R0 * 1.3); glow.addColorStop(0, "rgba(169,176,214,.10)"); glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow; g.fillRect(0, 0, w, h);
      g.save(); g.translate(cx, cy);
      const arm = R0 * t * (mix.needle > 0.6 ? 1.05 : 1);
      g.lineCap = "round";
      for (let k = 0; k < 6; k++) {
        g.save(); g.rotate((k * Math.PI) / 3);
        for (const mir of [1, -1]) {
          g.save(); g.scale(1, mir);
          // plate body
          if (mix.plate > 0.3) {
            g.fillStyle = `rgba(200,215,245,${0.05 + mix.plate * 0.12})`;
            g.beginPath(); g.moveTo(0, 0); g.lineTo(arm * mix.plate * 0.75, 0); g.lineTo(arm * mix.plate * 0.375, arm * mix.plate * 0.65); g.closePath(); g.fill();
          }
          g.strokeStyle = "rgba(236,240,250,.9)"; g.lineWidth = mix.needle > 0.6 ? 3.2 : 1.8;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(arm, 0); g.stroke();
          for (const b of branches) {
            const p = b.at * arm, L = b.len * R0 * Math.max(0, (t - b.at * 0.5) / (1 - b.at * 0.5));
            if (L <= 0) continue;
            g.lineWidth = 1.3; g.strokeStyle = "rgba(220,230,250,.85)";
            const ex = p + Math.cos(b.ang) * L, ey = Math.sin(b.ang) * L;
            g.beginPath(); g.moveTo(p, 0); g.lineTo(ex, ey); g.stroke();
            if (b.sub) for (let j = 1; j < 3; j++) { const q = j / 3; g.beginPath(); g.moveTo(p + (ex - p) * q, ey * q); g.lineTo(p + (ex - p) * q + L * 0.22, ey * q); g.stroke(); }
          }
          g.restore();
        }
        g.restore();
      }
      g.fillStyle = "rgba(217,183,111,.85)"; g.beginPath(); g.arc(0, 0, 2.2, 0, 7); g.fill();
      g.restore();
    });
    const ui = el("div", "rf-ui", `<label>Temperature <b>−15 °C</b><input type="range" min="-30" max="-1" value="-15"></label><label>Humidity <b>80%</b><input type="range" min="10" max="100" value="80"></label><button class="dm-btn">New flake</button>`);
    host.appendChild(ui);
    const [ti, hi] = ui.querySelectorAll("input"), [tb, hb] = ui.querySelectorAll("b");
    const regrow = () => { T = +ti.value; H = +hi.value / 100; tb.textContent = `${T} °C`; hb.textContent = `${hi.value}%`; mix = plan(); t = 0.15; };
    ti.oninput = hi.oninput = regrow;
    ui.querySelector("button").onclick = () => { seed = Math.random() * 1e4; regrow(); t = 0; };
    return () => s.stop();
  };

  /* Rain on Glass: bokeh lights, drops that bead, merge, slide and refract */
  R.glass = (host) => {
    const bg = document.createElement("canvas"), bgg = bg.getContext("2d");
    let drops = [], pour = 0;
    const paintBg = (w, h, d) => {
      bg.width = w * d; bg.height = h * d; bgg.setTransform(d, 0, 0, d, 0, 0);
      const sky = bgg.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#0a0c16"); sky.addColorStop(1, "#151320"); bgg.fillStyle = sky; bgg.fillRect(0, 0, w, h);
      const cols = ["#d9b76f", "#f0a35e", "#a9b0d6", "#ef7a7a", "#6fd39a", "#ffffff"];
      for (let i = 0; i < 46; i++) {
        const x = rnd(0, w), y = rnd(h * 0.35, h), r = rnd(6, 26), c = cols[(Math.random() * cols.length) | 0];
        const gr = bgg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c + "cc"); gr.addColorStop(0.6, c + "33"); gr.addColorStop(1, c + "00");
        bgg.fillStyle = gr; bgg.beginPath(); bgg.arc(x, y, r, 0, 7); bgg.fill();
      }
    };
    const s = stage(host, ({ g, w, h, d }, dt) => {
      g.drawImage(bg, 0, 0, w, h);
      g.fillStyle = "rgba(8,9,15,.35)"; g.fillRect(0, 0, w, h);
      const spawn = (pour > 0 ? 9 : 1.6) * dt * 10;
      pour -= dt;
      for (let i = 0; i < spawn; i++) if (drops.length < (RM ? 60 : 240)) drops.push({ x: rnd(0, w), y: rnd(0, h), r: rnd(1, 3.2), vy: 0, trail: 0 });
      for (const p of drops) {
        if (p.r > 3.6) { p.vy = Math.min(p.vy + dt * 60 * (p.r / 4), 160); p.x += Math.sin(p.y * 0.05) * 0.15; }
        p.y += p.vy * dt;
        if (p.vy > 20 && Math.random() < 0.15) { drops.push({ x: p.x + rnd(-1, 1), y: p.y - p.r, r: rnd(0.8, 1.6), vy: 0, trail: 1 }); p.r *= 0.995; }
      }
      // merge (grid hash)
      const cell = 12, map = new Map();
      for (const p of drops) { if (p.dead) continue; const k = ((p.x / cell) | 0) + "," + ((p.y / cell) | 0); const q = map.get(k); if (q && Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r) { const a = q.r * q.r + p.r * p.r; q.r = Math.sqrt(a) * 1.02; q.vy = Math.max(q.vy, p.vy); p.dead = true; } else map.set(k, p); }
      drops = drops.filter((p) => !p.dead && p.y < h + 10);
      for (const p of drops) {
        if (p.r < 1.1) { g.fillStyle = "rgba(200,210,230,.25)"; g.fillRect(p.x, p.y, 1, 1); continue; }
        g.save(); g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 1.12, 0, 0, 7); g.clip();
        // refraction: a flipped, magnified patch of the background
        const m = 3.2;
        g.translate(p.x, p.y); g.scale(1, -1);
        g.drawImage(bg, (p.x - p.r * m) * d, (p.y - p.r * m) * d, p.r * m * 2 * d, p.r * m * 2 * d, -p.r, -p.r, p.r * 2, p.r * 2);
        g.restore();
        g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 0.8; g.beginPath(); g.ellipse(p.x, p.y + 0.4, p.r, p.r * 1.12, 0, 0, 7); g.stroke();
        g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(p.x - p.r * 0.35, p.y - p.r * 0.45, Math.max(0.5, p.r * 0.18), 0, 7); g.fill();
      }
    });
    s.api.onresize = () => paintBg(s.api.w, s.api.h, s.api.d);
    paintBg(s.api.w, s.api.h, s.api.d);
    s.api.c.onpointerdown = () => (pour = 1.4);
    host.appendChild(el("div", "dm-tag", "Tap to pour"));
    return () => s.stop();
  };

  /* Aurora Painter: drag to paint rippling curtains */
  R.aurora = (host) => {
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.7, p: Math.random() * 7 }));
    let strokes = [], cur = null, T = 0, auto = 0;
    const s = stage(host, ({ g, w, h }, dt) => {
      T += dt;
      g.fillStyle = "#04050b"; g.fillRect(0, 0, w, h);
      for (const st of stars) { g.globalAlpha = 0.3 + 0.3 * Math.sin(T * 1.4 + st.p); g.fillStyle = "#e8eaff"; g.fillRect(st.x * w, st.y * h, 1.3, 1.3); }
      g.globalAlpha = 1; g.globalCompositeOperation = "lighter";
      for (const sk of strokes) {
        sk.age += dt;
        const fade = Math.max(0, 1 - sk.age / 9);
        for (let i = 0; i < sk.pts.length; i += 1) {
          const [x0, y0, born] = sk.pts[i];
          const wob = Math.sin(T * 1.6 + i * 0.25 + sk.ph) * 6 + Math.sin(T * 0.7 + i * 0.09) * 9;
          const x = x0 + wob, top = y0 - 70 - Math.sin(T + i * 0.3) * 14, bottom = y0 + 12;
          const a = fade * Math.min(1, (T - born) * 2) * 0.16;
          const gr = g.createLinearGradient(0, top, 0, bottom);
          gr.addColorStop(0, `rgba(190,90,220,0)`); gr.addColorStop(0.25, `rgba(190,90,220,${a * 0.8})`); gr.addColorStop(0.7, `rgba(90,240,160,${a * 1.6})`); gr.addColorStop(1, `rgba(120,255,190,0)`);
          g.fillStyle = gr; g.fillRect(x - 3, top, 6, bottom - top);
        }
      }
      g.globalCompositeOperation = "source-over";
      strokes = strokes.filter((sk) => sk.age < 9);
      // mountains
      g.fillStyle = "#020306"; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, h - 30 - Math.abs(Math.sin(x * 0.011) * 38) - Math.sin(x * 0.037) * 10);
      g.lineTo(w, h); g.closePath(); g.fill();
      auto -= dt;
      if (auto < 0 && !cur) {
        auto = 5; const sk = { pts: [], age: 0, ph: Math.random() * 6 }; const y = rnd(h * 0.35, h * 0.55);
        for (let x = -10; x < w + 10; x += 5) sk.pts.push([x, y + Math.sin(x * 0.012) * 26, T + x / 600]);
        strokes.push(sk);
      }
    });
    const c = s.api.c;
    c.onpointerdown = (e) => { cur = { pts: [], age: 0, ph: Math.random() * 6 }; strokes.push(cur); c.setPointerCapture(e.pointerId); auto = 6; };
    c.onpointermove = (e) => { if (!cur) return; const [x, y] = s.pos(e); const l = cur.pts[cur.pts.length - 1]; if (!l || Math.hypot(l[0] - x, l[1] - y) > 4) cur.pts.push([x, y, T]); cur.age = 0; };
    c.onpointerup = () => (cur = null);
    host.appendChild(el("div", "dm-tag", "Drag across the sky"));
    return () => s.stop();
  };

  /* Doppler Playground: waves bunch ahead of a moving storm; a radar reads toward/away */
  R.doppler = (host) => {
    let src = { x: 80, y: 110, vx: 0, vy: 0 }, target = null, waves = [], emit = 0, t = 0;
    const s = stage(host, ({ g, w, h }, dt) => {
      t += dt;
      const radar = { x: w - 34, y: h / 2 };
      if (target) { src.vx = (target[0] - src.x) * 6; src.vy = (target[1] - src.y) * 6; }
      else { src.vx += (w * 0.42 + Math.cos(t * 0.7) * w * 0.3 - src.x) * dt * 2 - src.vx * dt * 1.5; src.vy += (h / 2 + Math.sin(t * 1.1) * h * 0.28 - src.y) * dt * 2 - src.vy * dt * 1.5; }
      src.x += src.vx * dt; src.y += src.vy * dt;
      emit -= dt; if (emit < 0) { emit = 0.16; waves.push({ x: src.x, y: src.y, r: 0 }); }
      g.fillStyle = "#0b0c14"; g.fillRect(0, 0, w, h);
      for (const wv of waves) { wv.r += dt * 120; const a = Math.max(0, 1 - wv.r / (w * 0.9)); g.strokeStyle = `rgba(217,183,111,${a * 0.6})`; g.lineWidth = 1.2; g.beginPath(); g.arc(wv.x, wv.y, wv.r, 0, 7); g.stroke(); }
      waves = waves.filter((wv) => wv.r < w);
      // radial velocity toward the radar
      const dx = radar.x - src.x, dy = radar.y - src.y, dist = Math.hypot(dx, dy) || 1, vr = (src.vx * dx + src.vy * dy) / dist;
      const toward = vr > 0, mag = Math.min(1, Math.abs(vr) / 220), col = toward ? `rgba(111,211,154,${0.4 + mag * 0.6})` : `rgba(239,122,122,${0.4 + mag * 0.6})`;
      g.strokeStyle = col; g.setLineDash([3, 5]); g.beginPath(); g.moveTo(radar.x, radar.y); g.lineTo(src.x, src.y); g.stroke(); g.setLineDash([]);
      const sg = g.createRadialGradient(src.x, src.y, 0, src.x, src.y, 22); sg.addColorStop(0, col); sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg; g.beginPath(); g.arc(src.x, src.y, 22, 0, 7); g.fill();
      g.fillStyle = "#eceef5"; g.beginPath(); g.arc(src.x, src.y, 5, 0, 7); g.fill();
      g.fillStyle = "#13141f"; g.strokeStyle = "#d9b76f"; g.lineWidth = 1.5; g.beginPath(); g.arc(radar.x, radar.y, 12, 0, 7); g.fill(); g.stroke();
      g.save(); g.translate(radar.x, radar.y); g.rotate(t * 3); g.strokeStyle = "rgba(217,183,111,.8)"; g.beginPath(); g.moveTo(0, 0); g.lineTo(11, 0); g.stroke(); g.restore();
      g.fillStyle = col; g.font = "600 12px Nunito Sans, sans-serif"; g.textAlign = "right";
      g.fillText(`${toward ? "Toward" : "Away from"} radar · ${Math.round(Math.abs(vr) * 0.3)} mph`, w - 10, 20);
      g.textAlign = "left";
    });
    const c = s.api.c;
    c.onpointerdown = (e) => { target = s.pos(e); c.setPointerCapture(e.pointerId); };
    c.onpointermove = (e) => { if (target) target = s.pos(e); };
    c.onpointerup = () => (target = null);
    host.appendChild(el("div", "dm-tag dm-tag-l", "Drag the storm"));
    return () => s.stop();
  };

  window.PLDEMO = Object.assign(window.PLDEMO || {}, R);
})();
