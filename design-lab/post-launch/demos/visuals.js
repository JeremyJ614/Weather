/* A5 live demos. Each mounts into a box and returns a cleanup. Paused off screen. */
(() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GOLD = "#d9b76f";
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* canvas filling the host, DPR-aware, with a visibility-gated loop */
  function stage(host, draw) {
    const c = el("canvas", "dm-canvas");
    host.appendChild(c);
    const g = c.getContext("2d");
    let w = 0, h = 0, raf = 0, vis = true, t0 = performance.now();
    const fit = () => {
      const r = host.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      w = r.width; h = r.height; c.width = w * d; c.height = h * d; g.setTransform(d, 0, 0, d, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(host);
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) tick(); }); io.observe(host);
    const api = { g, get w() { return w; }, get h() { return h; } };
    function tick() {
      raf = 0;
      if (!vis) return;
      draw(api, (performance.now() - t0) / 1000);
      if (!RM) raf = requestAnimationFrame(tick);
    }
    tick();
    return { api, stop() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); c.remove(); } };
  }
  const buttons = (host, list, on) => {
    const bar = el("div", "dm-bar");
    list.forEach(([k, label], i) => {
      const b = el("button", "dm-btn", label);
      b.setAttribute("aria-pressed", String(i === 0));
      b.onclick = () => { bar.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); on(k); };
      bar.appendChild(b);
    });
    host.appendChild(bar);
    return bar;
  };

  const D = {};

  /* 1. Live Sky header */
  D["live-sky"] = (host) => {
    let kind = "storm", flash = 0;
    const drops = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), v: rnd(0.6, 1.2), z: Math.random() }));
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.8, p: Math.random() * 6 }));
    const title = el("div", "dm-hero", "<small>Right now · Norman, OK</small><b>Severe Weather</b>");
    const s = stage(host, ({ g, w, h }, t) => {
      g.clearRect(0, 0, w, h);
      const sky = g.createLinearGradient(0, 0, 0, h);
      const top = { storm: "#0d1020", rain: "#101522", snow: "#151a26", night: "#05060d", sunset: "#1a1020" }[kind];
      sky.addColorStop(0, top); sky.addColorStop(1, "#0b0c14");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      if (kind === "sunset") {
        const r = g.createRadialGradient(w * 0.75, h * 1.05, 10, w * 0.75, h * 1.05, h * 1.2);
        r.addColorStop(0, "rgba(240,150,80,.55)"); r.addColorStop(0.4, "rgba(217,120,111,.18)"); r.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = r; g.fillRect(0, 0, w, h);
      }
      if (kind === "night") for (const st of stars) { g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.3 + st.p); g.fillStyle = "#e8e6ff"; g.fillRect(st.x * w, st.y * h, 1.4, 1.4); }
      g.globalAlpha = 1;
      if (kind === "storm" || kind === "rain") {
        g.strokeStyle = "rgba(169,176,214,.38)"; g.lineWidth = 1;
        g.beginPath();
        for (const d of drops) {
          d.y += d.v * 0.025 * (kind === "storm" ? 1.4 : 1); if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); }
          const x = d.x * w, y = d.y * h, L = 8 + d.z * 10;
          g.moveTo(x, y); g.lineTo(x - L * 0.25, y + L);
        }
        g.stroke();
      }
      if (kind === "snow") {
        g.fillStyle = "rgba(236,238,245,.8)";
        for (const d of drops) {
          d.y += d.v * 0.004; d.x += Math.sin(t + d.z * 9) * 0.0008; if (d.y > 1.05) { d.y = -0.05; d.x = Math.random(); }
          g.beginPath(); g.arc(d.x * w, d.y * h, 0.8 + d.z * 1.6, 0, 7); g.fill();
        }
      }
      if (kind === "storm") {
        if (flash <= 0 && Math.random() < 0.008) flash = 1;
        if (flash > 0) { g.fillStyle = `rgba(217,183,111,${flash * 0.22})`; g.fillRect(0, 0, w, h); flash -= 0.06; }
      }
    });
    host.appendChild(title);
    buttons(host, [["storm", "Storm"], ["rain", "Rain"], ["snow", "Snow"], ["night", "Clear night"], ["sunset", "Sunset"]], (k) => (kind = k));
    return () => s.stop();
  };

  /* 2. Wind flow */
  D["wind-flow"] = (host) => {
    const N = 900;
    const P = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * 80 }));
    const field = (x, y, t) => {
      // a low pressure center plus westerlies
      const cx = 0.55 + 0.05 * Math.sin(t * 0.1), cy = 0.5, dx = x - cx, dy = (y - cy) * 1.6, r2 = dx * dx + dy * dy + 0.01;
      return [0.6 - dy / r2 * 0.06, dx / r2 * 0.06 + 0.1 * Math.sin(x * 6 + t * 0.2)];
    };
    const s = stage(host, ({ g, w, h }, t) => {
      g.fillStyle = "rgba(11,12,20,.12)"; g.fillRect(0, 0, w, h);
      g.lineWidth = 1.1;
      for (const p of P) {
        const [u, v] = field(p.x, p.y, t), sp = Math.hypot(u, v);
        const nx = p.x + u * 0.003, ny = p.y + v * 0.003 * (w / h);
        const hue = sp > 0.9 ? "#f0a35e" : sp > 0.55 ? GOLD : "#a9b0d6";
        g.strokeStyle = hue; g.globalAlpha = Math.min(1, p.a / 20) * 0.7;
        g.beginPath(); g.moveTo(p.x * w, p.y * h); g.lineTo(nx * w, ny * h); g.stroke();
        p.x = nx; p.y = ny; p.a++;
        if (p.a > 90 || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) { p.x = Math.random(); p.y = Math.random(); p.a = 0; }
      }
      g.globalAlpha = 1;
    });
    host.appendChild(el("div", "dm-tag", "GFS 10 m wind · demo field"));
    return () => s.stop();
  };

  /* 3. Radar sweep reveal */
  D["radar-sweep"] = (host) => {
    const blobs = Array.from({ length: 26 }, () => ({ x: rnd(0.15, 0.85), y: rnd(0.15, 0.85), r: rnd(8, 30), k: Math.random() }));
    let start = performance.now();
    const color = (k) => (k > 0.85 ? "#ef7a7a" : k > 0.6 ? "#f0a35e" : k > 0.35 ? GOLD : "#6fd39a");
    const s = stage(host, ({ g, w, h }) => {
      const t = (performance.now() - start) / 1000, ang = Math.min(1, t / 1.6) * Math.PI * 2, cx = w / 2, cy = h / 2;
      g.fillStyle = "#0b0c14"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(169,176,214,.12)";
      for (let r = 30; r < Math.max(w, h); r += 34) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
      g.save(); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, w + h, -Math.PI / 2, -Math.PI / 2 + ang); g.closePath(); g.clip();
      for (const b of blobs) {
        const x = b.x * w, y = b.y * h, rg = g.createRadialGradient(x, y, 0, x, y, b.r);
        rg.addColorStop(0, color(b.k)); rg.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.8; g.fillStyle = rg; g.beginPath(); g.arc(x, y, b.r, 0, 7); g.fill();
      }
      g.restore(); g.globalAlpha = 1;
      if (t < 1.9) {
        const a = -Math.PI / 2 + ang;
        const cg = g.createConicGradient ? g.createConicGradient(a - 0.6, cx, cy) : null;
        if (cg) { cg.addColorStop(0, "rgba(217,183,111,0)"); cg.addColorStop(0.095, "rgba(217,183,111,.35)"); cg.addColorStop(0.0955, "rgba(217,183,111,0)"); g.fillStyle = cg; g.fillRect(0, 0, w, h); }
        g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (w + h), cy + Math.sin(a) * (w + h)); g.stroke();
      }
    });
    buttons(host, [["go", "Replay sweep"]], () => (start = performance.now()));
    return () => s.stop();
  };

  /* 4. Odometer */
  D.odometer = (host) => {
    const wrap = el("div", "dm-center");
    const mk = (label, unit) => {
      const box = el("div", "odo"), num = el("div", "odo-num");
      box.append(num, el("small", null, label));
      wrap.appendChild(box);
      let cur = "";
      return (val) => {
        const s = String(val);
        if (s.length !== cur.length) {
          num.innerHTML = "";
          for (let i = 0; i < s.length; i++) {
            const d = el("span", "odo-d"), col = el("span", "odo-col");
            for (let k = 0; k < 10; k++) col.appendChild(el("span", null, String(k)));
            d.appendChild(col); num.appendChild(d);
          }
          if (unit) num.appendChild(el("span", "odo-u", unit));
        }
        [...num.querySelectorAll(".odo-col")].forEach((col, i) => (col.style.transform = `translateY(${-Number(s[i]) * 10}%)`));
        cur = s;
      };
    };
    host.appendChild(wrap);
    const a = mk("Temperature", "°"), b = mk("SSWXCon", ""), c = mk("Points", "");
    let v = [72, 64, 1240];
    const go = () => { v = [Math.round(rnd(40, 99)), Math.round(rnd(10, 99)), Math.round(rnd(1000, 9999))]; a(v[0]); b(v[1]); c(v[2]); };
    a(v[0]); b(v[1]); c(v[2]);
    const id = setInterval(go, 2200);
    buttons(host, [["roll", "Roll now"]], go);
    return () => clearInterval(id);
  };

  /* 5. Severity pulse rings */
  D.pulse = (host) => {
    const wrap = el("div", "dm-center pulses");
    [["TSTM", "#6fd39a", 0], ["MRGL", "#3fae6a", 3.2], ["SLGT", "#e8d35c", 2.6], ["ENH", "#f0a35e", 1.9], ["MDT", "#ef7a7a", 1.3], ["HIGH", "#e25cf0", 0.8]].forEach(([n, c, s]) => {
      const b = el("div", "pl-badge", `<span>${n}</span>`);
      b.style.setProperty("--c", c);
      if (s) for (let i = 0; i < 2; i++) { const r = el("i", "pl-ring"); r.style.animationDuration = s + "s"; r.style.animationDelay = (i * s) / 2 + "s"; b.appendChild(r); }
      wrap.appendChild(b);
    });
    host.appendChild(wrap);
    return () => {};
  };

  /* 6. Card grows into the page (FLIP, transform only) */
  D["card-morph"] = (host) => {
    host.classList.add("cm-host");
    const grid = el("div", "cm-grid");
    const cards = [["SSWXCon", "64", "Elevated"], ["Today", "88°", "Storms after 4 pm"], ["SPC", "ENH", "30% wind"], ["Rivers", "3", "in flood"]];
    cards.forEach(([t, v, s]) => grid.appendChild(el("button", "cm-card", `<small>${t}</small><b>${v}</b><span>${s}</span>`)));
    const page = el("div", "cm-page", "<button class='dm-btn cm-back'>‹ Back</button><small></small><b></b><p>The full page opens from the card you tapped. Every chart, tab and map lives here.</p><div class='cm-lines'><i></i><i></i><i></i></div>");
    host.append(grid, page);
    let from = null;
    const open = (card) => {
      from = card;
      page.querySelector("small").textContent = card.querySelector("small").textContent;
      page.querySelector("b").textContent = card.querySelector("b").textContent;
      const a = card.getBoundingClientRect(), b = host.getBoundingClientRect();
      page.style.transition = "none";
      page.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
      page.style.opacity = "1"; page.style.pointerEvents = "auto";
      requestAnimationFrame(() => requestAnimationFrame(() => { page.style.transition = ""; page.style.transform = "none"; page.classList.add("on"); }));
    };
    grid.onclick = (e) => { const c = e.target.closest(".cm-card"); if (c) open(c); };
    page.querySelector(".cm-back").onclick = () => {
      const a = from.getBoundingClientRect(), b = host.getBoundingClientRect();
      page.classList.remove("on");
      page.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
      setTimeout(() => { page.style.opacity = "0"; page.style.pointerEvents = "none"; }, 380);
    };
    return () => {};
  };

  /* 7. Lightning page change */
  D["flash-nav"] = (host) => {
    const pages = [["Radar & Model Runs", "Tools & Data"], ["SPC & Probability", "Severe Weather"], ["Aurora Center", "Specialty Monitoring"], ["Tornado Archive", "Second menu"]];
    let i = 0;
    const scr = el("div", "fn-screen", "<div class='fn-page'><small></small><b></b><div class='cm-lines'><i></i><i></i><i></i></div></div>");
    const svg = el("div", "fn-bolt", `<svg viewBox="0 0 300 200" preserveAspectRatio="none"><path d="M-5 40 L70 60 L55 90 L150 100 L135 128 L230 140 L215 165 L310 175" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linejoin="bevel"/><path d="M-5 40 L70 60 L55 90 L150 100 L135 128 L230 140 L215 165 L310 175" fill="none" stroke="#fff" stroke-width="1"/></svg>`);
    const flash = el("div", "fn-flash");
    scr.append(svg, flash);
    host.appendChild(scr);
    const pg = scr.querySelector(".fn-page");
    const set = () => { pg.querySelector("small").textContent = pages[i][1]; pg.querySelector("b").textContent = pages[i][0]; };
    set();
    const go = () => {
      svg.classList.remove("go"); flash.classList.remove("go"); pg.classList.remove("in");
      void svg.offsetWidth;
      svg.classList.add("go"); flash.classList.add("go");
      setTimeout(() => { i = (i + 1) % pages.length; set(); pg.classList.add("in"); }, 90);
    };
    buttons(host, [["n", "Next page"]], go);
    const id = setInterval(go, 3000);
    return () => clearInterval(id);
  };

  /* 8. Holographic badge with tilt */
  D.holo = (host) => {
    const wrap = el("div", "dm-center");
    const card = el("div", "holo", "<div class='holo-in'><svg viewBox='0 0 64 64'><path d='M32 4l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 21l16-2z' fill='none' stroke='currentColor' stroke-width='2.2'/></svg><b>Founder</b><small>Member #0042 · Legendary</small></div><i class='holo-foil'></i>");
    wrap.appendChild(card); host.appendChild(wrap);
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, auto = true, t = 0;
    const step = () => {
      t += 0.016;
      if (auto && !RM) { tx = Math.sin(t * 0.9) * 0.6; ty = Math.cos(t * 0.7) * 0.4; }
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      card.style.transform = `perspective(700px) rotateY(${cx * 18}deg) rotateX(${-cy * 18}deg)`;
      card.style.setProperty("--fx", 50 + cx * 50 + "%"); card.style.setProperty("--fy", 50 + cy * 50 + "%");
      raf = requestAnimationFrame(step);
    };
    host.onpointermove = (e) => { const r = card.getBoundingClientRect(); auto = false; tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; };
    host.onpointerleave = () => (auto = true);
    step();
    return () => cancelAnimationFrame(raf);
  };

  /* 9. Tornado pull-to-refresh */
  D["pull-funnel"] = (host) => {
    const scr = el("div", "pf-screen", "<div class='pf-funnel'><svg viewBox='0 0 80 90'><g fill='none' stroke='currentColor' stroke-linecap='round'><path d='M6 8 Q40 2 74 8' stroke-width='3'/><path d='M14 22 Q40 17 66 22' stroke-width='2.6'/><path d='M22 36 Q40 32 58 36' stroke-width='2.3'/><path d='M29 50 Q40 47 51 50' stroke-width='2'/><path d='M34 63 Q40 61 46 63' stroke-width='1.7'/><path d='M37 75 Q40 74 43 76' stroke-width='1.4'/></g></svg></div><div class='pf-page'><small>Pull down</small><b>Warnings & Reports</b><div class='cm-lines'><i></i><i></i><i></i><i></i></div></div>");
    host.appendChild(scr);
    const page = scr.querySelector(".pf-page"), fun = scr.querySelector(".pf-funnel"), label = page.querySelector("small");
    let y0 = null, d = 0;
    const set = (v) => { d = v; page.style.transform = `translateY(${v}px)`; const k = Math.min(1, v / 90); fun.style.opacity = String(k); fun.style.transform = `translateX(-50%) scale(${0.4 + k * 0.6}, ${0.3 + k * 0.7}) rotate(${(k - 1) * 20}deg)`; label.textContent = v > 90 ? "Let go to refresh" : "Pull down"; };
    const refresh = () => {
      fun.classList.add("spin"); label.textContent = "Refreshing…"; page.style.transition = "transform .3s var(--ease)"; set(80);
      setTimeout(() => { fun.classList.remove("spin"); fun.classList.add("lift"); set(0); label.textContent = "Updated just now"; setTimeout(() => { fun.classList.remove("lift"); page.style.transition = ""; }, 500); }, 1300);
    };
    scr.onpointerdown = (e) => { y0 = e.clientY; scr.setPointerCapture(e.pointerId); page.style.transition = ""; };
    scr.onpointermove = (e) => { if (y0 == null) return; set(Math.max(0, Math.min(130, (e.clientY - y0) * 0.6))); };
    scr.onpointerup = () => { if (y0 == null) return; y0 = null; if (d > 90) refresh(); else { page.style.transition = "transform .3s var(--ease)"; set(0); } };
    buttons(host, [["p", "Play it"]], () => { page.style.transition = "transform .5s var(--ease)"; set(110); setTimeout(refresh, 550); });
    return () => {};
  };

  /* 10. Scroll-built sections */
  D["scroll-build"] = (host) => {
    const box = el("div", "sb-box");
    for (let i = 0; i < 6; i++) {
      const pts = Array.from({ length: 9 }, (_, k) => `${k * 25},${40 - Math.sin(k * 0.9 + i) * 14 - k * 1.5}`).join(" ");
      box.appendChild(el("div", "sb-sec", `<small>Section ${i + 1}</small><b>${["Storm ingredients", "72-hour timeline", "Model agreement", "Hazards", "Your area", "History"][i]}</b><svg viewBox="0 0 200 60"><polyline points="${pts}" fill="none" stroke="${GOLD}" stroke-width="2"/></svg>`));
    }
    host.appendChild(box);
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle("in", e.isIntersecting)), { root: box, threshold: 0.35 });
    box.querySelectorAll(".sb-sec").forEach((s) => io.observe(s));
    host.appendChild(el("div", "dm-tag", "Scroll inside the box"));
    return () => io.disconnect();
  };

  /* 11. Data-decode headings */
  D.decode = (host) => {
    const words = ["SEVERE WEATHER", "SSWXCON 64", "TORNADO WATCH 512", "AURORA KP 7"];
    const h = el("div", "dc-title"); const sub = el("small", "dc-sub", "Decoding feed…");
    const wrap = el("div", "dm-center col"); wrap.append(sub, h); host.appendChild(wrap);
    const chars = "▚▞▛▜01#%/\\<>*+=ABCDEFXYZ";
    let i = 0, raf = 0;
    const run = () => {
      const target = words[i % words.length]; i++;
      const t0 = performance.now();
      cancelAnimationFrame(raf);
      const step = () => {
        const p = (performance.now() - t0) / 900;
        h.textContent = [...target].map((ch, k) => (ch === " " ? " " : p * target.length > k ? ch : chars[(Math.random() * chars.length) | 0])).join("");
        sub.textContent = p < 1 ? "Decoding feed…" : "Live";
        if (p < 1.05 && !RM) raf = requestAnimationFrame(step); else h.textContent = target;
      };
      step();
    };
    run();
    const id = setInterval(run, 2600);
    buttons(host, [["r", "Decode again"]], run);
    return () => { clearInterval(id); cancelAnimationFrame(raf); };
  };

  /* 12. Hailstone celebration */
  D["hail-burst"] = (host) => {
    let P = [];
    const badge = el("div", "hb-badge", "<b>Badge unlocked</b><small>Storm Spotter · Rare</small>");
    const s = stage(host, ({ g, w, h }) => {
      g.clearRect(0, 0, w, h);
      for (const p of P) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.spin;
        if (p.y > h - p.s && p.vy > 0) { p.y = h - p.s; p.vy *= -0.45; p.vx *= 0.8; p.b++; }
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        const rg = g.createRadialGradient(-p.s * 0.3, -p.s * 0.3, 0, 0, 0, p.s);
        rg.addColorStop(0, "#ffffff"); rg.addColorStop(0.35, "#dfe6f5"); rg.addColorStop(1, "rgba(150,170,210,.55)");
        g.fillStyle = rg; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.86, 0, 0, 7); g.fill();
        g.strokeStyle = "rgba(217,183,111,.6)"; g.lineWidth = 0.8; g.stroke(); g.restore();
      }
      P = P.filter((p) => p.b < 4 && p.x > -20 && p.x < w + 20);
    });
    host.appendChild(badge);
    const fire = () => {
      const { w, h } = s.api;
      for (let i = 0; i < 70; i++) { const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05); const v = rnd(5, 12); P.push({ x: w / 2, y: h * 0.45, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(2.5, 7), r: 0, spin: rnd(-0.2, 0.2), b: 0 }); }
      badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
      if (RM) s.api.g && 0;
    };
    buttons(host, [["f", "Celebrate"]], fire);
    setTimeout(fire, 300);
    return () => s.stop();
  };

  /* 13. Living isobars */
  D.isobars = (host) => {
    const s = stage(host, ({ g, w, h }, t) => {
      g.fillStyle = "#0b0c14"; g.fillRect(0, 0, w, h);
      const f = (x, y) => Math.sin(x * 0.012 + t * 0.15) * 1.2 + Math.cos(y * 0.016 - t * 0.1) + Math.sin((x + y) * 0.007 + t * 0.07) * 1.4 - 2.2 * Math.exp(-(((x - w * 0.62) ** 2 + (y - h * 0.5) ** 2) / (w * w * 0.04)));
      g.lineWidth = 1;
      for (let lv = -3; lv <= 3; lv += 0.5) {
        g.strokeStyle = lv === 0 ? "rgba(217,183,111,.35)" : "rgba(169,176,214,.13)";
        g.beginPath();
        const step = 10;
        for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
          const a = f(x, y) - lv, b = f(x + step, y) - lv, c = f(x, y + step) - lv;
          if (a * b < 0) { const k = a / (a - b); g.moveTo(x + k * step, y); g.lineTo(x + k * step + 0.1, y + step * 0.6); }
          if (a * c < 0) { const k = a / (a - c); g.moveTo(x, y + k * step); g.lineTo(x + step * 0.6, y + k * step + 0.1); }
        }
        g.stroke();
      }
      g.fillStyle = "rgba(239,122,122,.8)"; g.font = "700 18px Russo One, sans-serif"; g.fillText("L", w * 0.62 - 6, h * 0.5 + 6);
    });
    const glass = el("div", "iso-glass", "<small>Behind every card</small><b>Faint, slow, always moving</b>");
    host.appendChild(glass);
    return () => s.stop();
  };

  /* 14. Follow the sun */
  D["golden-hour"] = (host) => {
    host.classList.add("gh-host");
    const ui = el("div", "gh-ui", "<div class='gh-card'><small>Theme glow</small><b>StormSync Weather</b><button class='gh-chip'>Today</button><button class='gh-chip on'>SPC</button></div><label class='gh-slide'><span>Time of day <em>6:40 pm</em></span><input type='range' min='0' max='24' step='0.1' value='18.6' aria-label='Time of day'></label>");
    host.appendChild(ui);
    const input = ui.querySelector("input"), em = ui.querySelector("em");
    const set = () => {
      const hr = Number(input.value);
      const sunAlt = Math.sin(((hr - 6) / 12) * Math.PI); // -1..1
      const golden = Math.exp(-((sunAlt - 0.05) ** 2) / 0.02);
      const night = Math.max(0, -sunAlt);
      const h = 41 - golden * 16 + night * 180, l = 64 - night * 16 + golden * 4, sat = 52 + golden * 26 - night * 22;
      host.style.setProperty("--g", `hsl(${h} ${sat}% ${l}%)`);
      host.style.setProperty("--gb", `hsl(${h} ${sat}% ${l}% / ${0.08 + golden * 0.08})`);
      const H = Math.floor(hr) % 24, M = Math.round((hr % 1) * 60);
      em.textContent = `${((H + 11) % 12) + 1}:${String(M).padStart(2, "0")} ${H < 12 ? "am" : "pm"}`;
    };
    input.oninput = set; set();
    let id = 0;
    if (!RM) id = setInterval(() => { input.value = String((Number(input.value) + 0.05) % 24); set(); }, 60);
    input.onpointerdown = () => clearInterval(id);
    return () => clearInterval(id);
  };

  /* 15. Warnings that arrive */
  D["alert-arrive"] = (host) => {
    const list = el("div", "aa-list");
    host.appendChild(list);
    const W = [["Tornado Warning", "Cleveland County until 6:45 pm", "#ef7a7a", "tor"], ["Severe Thunderstorm Warning", "Oklahoma County until 7:15 pm", "#f0a35e", ""], ["Flash Flood Warning", "Tulsa County until 9:00 pm", "#6fd39a", ""]];
    let i = 0;
    const add = () => {
      const [t, s, c, k] = W[i++ % W.length];
      const card = el("div", "aa-card " + k, `<i class="aa-ring"></i><b>${t}</b><small>${s}</small>`);
      card.style.setProperty("--c", c);
      list.prepend(card);
      while (list.children.length > 3) list.lastChild.remove();
    };
    add();
    const id = setInterval(add, 3200);
    buttons(host, [["a", "New warning"]], add);
    return () => clearInterval(id);
  };

  window.PLDEMO = Object.assign(window.PLDEMO || {}, D);
})();
