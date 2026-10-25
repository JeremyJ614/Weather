/* New main menus, part 1: Liquid Metal, Zoom Canvas, Cube Turn, Kinetic Type, Piano Keys. */

/* ───────────── Liquid Metal ───────────── */
MENUS.main.push({
  id: "n-liquid", name: "Liquid Metal", kind: "Liquid metaballs", fits: "main",
  desc: "The button melts into dark liquid metal with a gold edge. Each section buds off it as a droplet that stretches and snaps free; tap one and the rest pour back into it as it spreads into a pool of its pages.",
  how: "Tap the button. Tap a droplet to open its pages; ← pours them back out.",
  css: `
.lq-scrim{position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 100%,color-mix(in srgb,var(--accent) 10%,var(--bg)),color-mix(in srgb,var(--bg) 95%,transparent) 62%);opacity:0;transition:opacity .45s;pointer-events:none}
.lq.on .lq-scrim{opacity:1;pointer-events:auto}
.lq-goo{position:absolute;inset:0;pointer-events:none}
.lq-b,.lq-pool,.lq-core{position:absolute;left:0;top:0;background:#000;border-radius:50%;will-change:transform}
.lq-b{transition:transform .8s cubic-bezier(.3,1.35,.6,1)}
.lq-pool{border-radius:36px;transform-origin:0 0;transition:transform .65s var(--ease)}
.lq-core{width:64px;height:64px;transition:transform .55s var(--spring)}
.lq-l{position:absolute;left:0;top:0;display:grid;justify-items:center;gap:6px;opacity:0;color:var(--text);font-weight:800;font-size:11.5px;text-align:center;line-height:1.15;pointer-events:none;transition:opacity .2s}
.lq-l .o{width:var(--D);height:var(--D);display:grid;place-items:center;color:var(--accent);font-size:25px;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--accent) 60%,transparent))}
.lq-l span{width:calc(var(--D) + 28px)}
.lq-l.show{opacity:1;pointer-events:auto;transition:opacity .35s var(--d,0s)}
.lq-pages{position:absolute;display:flex;flex-direction:column;opacity:0;pointer-events:none;transition:opacity .2s;padding:16px 16px 8px}
.lq-pages.show{opacity:1;pointer-events:auto;transition:opacity .35s .4s}
.lq-pages header{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.lq-pages header button{width:36px;height:36px;border-radius:12px;border:1px solid var(--lit-line);display:grid;place-items:center;color:var(--accent)}
.lq-pages h4{margin:0;font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:19px;line-height:1.05}
.lq-pages ul{list-style:none;margin:0;padding:0;overflow-y:auto;scrollbar-width:none}
.lq-pages li{opacity:0;transform:translateY(-14px) scaleY(.6);transform-origin:top}
.lq-pages.show li{opacity:1;transform:none;transition:transform .55s var(--spring) calc(.45s + var(--i)*45ms),opacity .3s calc(.45s + var(--i)*45ms)}
.lq-pages li button{display:flex;align-items:center;gap:12px;width:100%;min-height:46px;border-bottom:1px solid color-mix(in srgb,var(--accent) 16%,transparent);font-weight:700;text-align:left}
.lq-pages li .ic{color:var(--accent);font-size:18px}
.lq-pages li em{margin-left:auto;font-style:normal;color:var(--muted)}
.lq-fab{position:absolute;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;color:var(--accent);font-size:24px;z-index:3}
.lq-fab .ic{transition:transform .4s var(--spring),opacity .2s;position:absolute}
.lq-fab .x{opacity:0;transform:rotate(-90deg) scale(.4)}
.lq.on .lq-fab .m{opacity:0;transform:rotate(90deg) scale(.4)}
.lq.on .lq-fab .x{opacity:1;transform:none}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const uid = "lq" + Math.random().toString(36).slice(2, 7);
    const root = K.h("div", "lq");
    const D = Math.round(Math.min(74, W * 0.205));
    root.style.setProperty("--D", D + "px");
    root.innerHTML = `<div class="lq-scrim"></div>
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><filter id="${uid}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>
        <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 24 -11" result="goo"/>
        <feMorphology in="goo" operator="erode" radius="1.7" result="in"/>
        <feComposite in="goo" in2="in" operator="out" result="ring"/>
        <feFlood style="flood-color:var(--accent)" result="gold"/>
        <feComposite in="gold" in2="ring" operator="in" result="ringc"/>
        <feFlood style="flood-color:var(--surface2)" result="dark"/>
        <feComposite in="dark" in2="in" operator="in" result="fill"/>
        <feGaussianBlur in="ringc" stdDeviation="3.5" result="glow"/>
        <feMerge><feMergeNode in="glow"/><feMergeNode in="fill"/><feMergeNode in="ringc"/></feMerge>
      </filter></defs></svg>
      <div class="lq-goo" style="filter:url(#${uid})"></div><div class="lq-lbl"></div><div class="lq-pages"></div>
      <button class="lq-fab" aria-label="Open menu">${icon("Menu", "m")}${icon("X", "x")}</button>`;
    layer.append(root);
    const goo = root.querySelector(".lq-goo"), lbl = root.querySelector(".lq-lbl"), pages = root.querySelector(".lq-pages"), fab = root.querySelector(".lq-fab");
    const fx = W / 2, fy = H - 58;
    fab.style.transform = `translate(${fx - 32}px,${fy - 32}px)`;
    const core = K.h("i", "lq-core");
    core.style.transform = `translate(${fx - 32}px,${fy - 32}px)`;
    const pool = K.h("i", "lq-pool");
    const PW = W - 32, PH = H - 190, PX = 16, PY = 64;
    pool.style.width = PW + "px"; pool.style.height = PH + "px";
    goo.append(pool, core);
    pages.style.cssText = `left:${PX}px;top:${PY}px;width:${PW}px;height:${PH}px`;

    const items = K.entries(groups);
    const cols = 3, gap = (W - cols * D) / (cols + 1);
    const rows = Math.ceil(items.length / cols);
    const rowH = D + 52, top0 = Math.max(70, (fy - 70 - rows * rowH) / 2 + 40);
    const slots = items.map((_, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const n = Math.min(cols, items.length - r * cols);
      const x = (W - (n * D + (n - 1) * gap)) / 2 + c * (D + gap) + D / 2;
      return { x, y: top0 + r * rowH + D / 2 + Math.sin(i * 2.3) * 6 };
    });
    const blobs = items.map(() => { const b = K.h("i", "lq-b"); b.style.width = b.style.height = D + "px"; goo.append(b); return b; });
    const labels = items.map((it, i) => {
      const b = K.h("button", "lq-l", `<span class="o">${icon(it.icon)}</span><span>${it.label}</span>`);
      b.style.transform = `translate(${slots[i].x - D / 2 - 14}px,${slots[i].y - D / 2}px)`;
      b.style.width = D + 28 + "px";
      b.onclick = () => (it.page ? pick(it.page) : openSec(i));
      lbl.append(b);
      return b;
    });
    let open = false, sec = -1;
    const order = slots.map((s, i) => [Math.hypot(s.x - fx, s.y - fy), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const home = (b, d, s = 0.42) => { b.style.transitionDelay = d + "ms"; b.style.transform = `translate(${fx - D / 2}px,${fy - D / 2}px) scale(${s})`; };
    const out = (b, i, d) => { b.style.transitionDelay = d + "ms"; b.style.transform = `translate(${slots[i].x - D / 2}px,${slots[i].y - D / 2}px)`; };
    const poolAt = (i, big) => {
      pool.style.transform = big ? `translate(${PX}px,${PY}px)` : `translate(${slots[i].x - 6}px,${slots[i].y - 6}px) scale(${12 / PW},${12 / PH})`;
    };
    blobs.forEach((b) => home(b, 0, 0.3));
    poolAt(0, false);
    pool.style.opacity = "0";

    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      fab.setAttribute("aria-label", v ? "Close menu" : "Open menu");
      core.style.transform = `translate(${fx - 32}px,${fy - 32}px) scale(${v ? 1.08 : 1})`;
      if (v) {
        order.forEach((i, k) => { out(blobs[i], i, 40 + k * 55); labels[i].style.setProperty("--d", 0.35 + k * 0.055 + "s"); labels[i].classList.add("show"); });
      } else {
        if (sec >= 0) closeSec(true);
        labels.forEach((l) => l.classList.remove("show"));
        [...order].reverse().forEach((i, k) => home(blobs[i], k * 35));
      }
    }
    function openSec(i) {
      sec = i;
      const g = items[i].sec;
      labels.forEach((l) => l.classList.remove("show"));
      pool.style.transition = "none"; pool.style.opacity = "1"; poolAt(i, false);
      void pool.offsetWidth;
      pool.style.transition = "";
      blobs.forEach((b, j) => { if (j !== i) { b.style.transitionDelay = 30 * Math.abs(j - i) + "ms"; b.style.transform = `translate(${slots[i].x - D / 2}px,${slots[i].y - D / 2}px) scale(.55)`; } });
      setTimeout(() => { if (sec === i) poolAt(i, true); }, 260);
      pages.innerHTML = `<header><button aria-label="All sections">${icon("ArrowLeft")}</button><h4>${g.label}</h4></header><ul>${g.pages.map((p, k) => `<li style="--i:${k}"><button data-k="${k}">${icon(p.icon)}<span>${p.label}</span><em>${icon("ChevronRight")}</em></button></li>`).join("")}</ul>`;
      pages.querySelector("header button").onclick = () => closeSec();
      pages.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => pick(g.pages[+b.dataset.k])));
      requestAnimationFrame(() => pages.classList.add("show"));
    }
    function closeSec(quiet) {
      const i = sec; sec = -1;
      pages.classList.remove("show");
      poolAt(i, false);
      setTimeout(() => { if (sec < 0) pool.style.opacity = "0"; }, 600);
      if (!quiet) order.forEach((j, k) => { out(blobs[j], j, 280 + k * 40); labels[j].style.setProperty("--d", 0.6 + k * 0.04 + "s"); labels[j].classList.add("show"); });
    }
    function pick(p) { setOpen(false); setTimeout(() => go(p), 120); }
    fab.onclick = () => setOpen(!open);
    root.querySelector(".lq-scrim").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => root.remove() };
  },
});

/* ───────────── Zoom Canvas ───────────── */
MENUS.main.push({
  id: "n-canvas", name: "Zoom Canvas", kind: "Zoomable map of nodes", fits: "main",
  desc: "The whole app laid out as a map of connected nodes: the app in the middle, its sections around it and every page branching off them. Drag to roam, pinch or scroll to zoom, and tap a section to fly the camera in.",
  how: "Tap the button. Drag and pinch to explore; tap a section to fly to it, a page to open it, and the target to see everything again.",
  css: `
.zc{position:absolute;inset:0;pointer-events:none}
.zc-view{position:absolute;inset:0;overflow:hidden;background:radial-gradient(90% 70% at 50% 45%,color-mix(in srgb,var(--accent) 7%,var(--bg)),var(--bg) 70%);opacity:0;transform:scale(1.06);transition:opacity .4s,transform .5s var(--ease);touch-action:none;pointer-events:none}
.zc-view::before{content:"";position:absolute;inset:-50%;background-image:radial-gradient(color-mix(in srgb,var(--accent) 22%,transparent) 1px,transparent 1.5px);background-size:26px 26px;opacity:.35;transform:translate(var(--gx,0),var(--gy,0))}
.zc.on .zc-view{opacity:1;transform:none;pointer-events:auto}
.zc-world{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;will-change:transform}
.zc-world svg{position:absolute;overflow:visible;left:0;top:0}
.zc-world path{fill:none;stroke:color-mix(in srgb,var(--accent) 55%,transparent);stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-dasharray:var(--len);stroke-dashoffset:var(--len);transition:stroke-dashoffset 1.1s var(--ease) var(--d)}
.zc.on .zc-world path{stroke-dashoffset:0}
.zc-n{position:absolute;left:0;top:0;display:grid;place-items:center;border-radius:50%;opacity:0;transition:opacity .5s var(--d);color:var(--text)}
.zc.on .zc-n{opacity:1}
.zc-hub{width:150px;height:150px;margin:-75px 0 0 -75px;border:2px solid var(--accent);background:var(--lit);box-shadow:0 0 40px -8px var(--accent);font-family:var(--font-display);font-size:22px;letter-spacing:.14em;text-align:center;line-height:1.1}
.zc-hub small{display:block;font-family:var(--font-mono);font-size:9px;letter-spacing:.3em;color:var(--accent)}
.zc-sec{width:140px;height:140px;margin:-70px 0 0 -70px;border:1.5px solid var(--lit-line);background:var(--surface);box-shadow:0 0 24px -10px var(--accent);gap:4px;align-content:center;font-weight:800;font-size:17px;text-align:center;line-height:1.1;padding:10px}
.zc-sec .ic{color:var(--accent);font-size:28px}
.zc-sec .lab{transform:scale(var(--inv,1));transform-origin:50% 0}
.zc-pg{width:auto;margin:0;transform:translate(-50%,-50%);border-radius:14px;padding:8px 12px;border:1px solid var(--line);background:color-mix(in srgb,var(--surface2) 90%,transparent);display:flex;gap:8px;font-weight:700;font-size:13px;white-space:nowrap}
.zc-pg .ic{color:var(--accent)}
.zc-ui{position:absolute;right:12px;bottom:14px;display:grid;gap:8px;opacity:0;transition:opacity .3s;pointer-events:none}
.zc.on .zc-ui{opacity:1;pointer-events:auto}
.zc-ui button,.zc-fab{width:44px;height:44px;border-radius:14px;border:1px solid var(--lit-line);background:color-mix(in srgb,var(--bg) 80%,transparent);color:var(--accent);display:grid;place-items:center;font-size:19px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.zc-fab{position:absolute;top:56px;right:12px;pointer-events:auto;box-shadow:var(--glow)}
.zc-tip{position:absolute;left:0;right:0;bottom:16px;text-align:center;font-family:var(--font-mono);font-size:10px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase;opacity:0;transition:opacity .4s .8s;pointer-events:none}
.zc.on .zc-tip{opacity:1}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const root = K.h("div", "zc");
    root.innerHTML = `<div class="zc-view"><div class="zc-world"><svg></svg></div></div><p class="zc-tip">Drag · pinch · tap</p><div class="zc-ui"><button data-a="in" aria-label="Zoom in">${icon("Plus")}</button><button data-a="out" aria-label="Zoom out">${icon("Minus")}</button><button data-a="fit" aria-label="See everything">${icon("Target")}</button><button data-a="x" aria-label="Close menu">${icon("X")}</button></div><button class="zc-fab" aria-label="Open menu">${icon("Network")}</button>`;
    layer.append(root);
    const view = root.querySelector(".zc-view"), world = root.querySelector(".zc-world"), svg = root.querySelector("svg");
    const R1 = 330, R2 = 190;
    const nodes = [], paths = [];
    const hub = K.h("div", "zc-n zc-hub", `<div>SSWX<small>STORMSYNC</small></div>`);
    hub.style.transform = "translate(0px,0px)"; hub.style.setProperty("--d", "0s");
    world.append(hub);
    const secPos = [];
    groups.forEach((g, i) => {
      const a = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * R1, y = Math.sin(a) * R1;
      secPos.push({ x, y, a });
      const n = K.h("button", "zc-n zc-sec", `${icon(g.icon)}<span class="lab">${g.label}</span>`);
      n.style.transform = `translate(${x}px,${y}px)`;
      n.style.setProperty("--d", 0.25 + i * 0.06 + "s");
      n.dataset.sec = i;
      world.append(n);
      nodes.push(n);
      paths.push([`M0,0 Q${Math.cos(a + 0.35) * R1 * 0.55},${Math.sin(a + 0.35) * R1 * 0.55} ${x},${y}`, 0.1 + i * 0.05]);
      const k = g.pages.length;
      const spread = Math.min(Math.PI * 1.2, 0.38 * k);
      g.pages.forEach((p, j) => {
        const b = k === 1 ? a : a - spread / 2 + (spread * j) / Math.max(1, k - 1);
        const r = R2 + (j % 3) * 52;
        const px = x + Math.cos(b) * r, py = y + Math.sin(b) * r;
        const pn = K.h("button", "zc-n zc-pg", `${icon(p.icon)}<span>${p.label}</span>`);
        pn.style.left = px + "px"; pn.style.top = py + "px";
        pn.style.setProperty("--d", 0.7 + i * 0.06 + j * 0.03 + "s");
        pn.onclick = (e) => { if (!dragged) pick(p); };
        world.append(pn);
        paths.push([`M${x},${y} L${px},${py}`, 0.55 + i * 0.05 + j * 0.02]);
      });
    });
    svg.innerHTML = paths.map(([d, del]) => `<path d="${d}" style="--d:${del}s"/>`).join("");
    svg.querySelectorAll("path").forEach((p) => p.style.setProperty("--len", Math.ceil(p.getTotalLength()) + 1));
    world.insertBefore(svg, world.firstChild);
    nodes.forEach((n) => (n.onclick = () => { if (!dragged) fly(secPos[+n.dataset.sec].x, secPos[+n.dataset.sec].y + 40, 0.95); }));
    hub.onclick = () => { if (!dragged) fit(); };

    const ext = R1 + 120;
    const fitZ = Math.min(W, H) / (2 * ext) * 0.98;
    const cam = { x: 0, y: 0, z: fitZ };
    let tween = null;
    function apply() {
      world.style.transform = `translate(${W / 2 - cam.x * cam.z}px,${H / 2 - cam.y * cam.z}px) scale(${cam.z})`;
      world.style.setProperty("--inv", Math.min(2.4, Math.max(1, 0.6 / cam.z)).toFixed(3));
      view.style.setProperty("--gx", ((-cam.x * cam.z) % 26) + "px");
      view.style.setProperty("--gy", ((-cam.y * cam.z) % 26) + "px");
    }
    function fly(x, y, z) {
      if (tween) tween();
      const s = { ...cam }, t0 = performance.now(), dur = K.reduce ? 1 : 750;
      tween = K.loop(() => {
        const t = Math.min(1, (performance.now() - t0) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const zz = Math.exp(Math.log(s.z) + (Math.log(z) - Math.log(s.z)) * e);
        cam.x = s.x + (x - s.x) * e; cam.y = s.y + (y - s.y) * e; cam.z = zz;
        apply();
        if (t >= 1) { tween = null; return false; }
      });
    }
    const fit = () => fly(0, 0, fitZ);
    const zoomAt = (f, sx = W / 2, sy = H / 2) => {
      const wx = cam.x + (sx - W / 2) / cam.z, wy = cam.y + (sy - H / 2) / cam.z;
      const z = K.clamp(cam.z * f, fitZ * 0.7, 1.6);
      cam.x = wx - (sx - W / 2) / z; cam.y = wy - (sy - H / 2) / z; cam.z = z;
      apply();
    };
    const pts = new Map();
    let dragged = false, last = null, pinch = 0;
    const rect = () => view.getBoundingClientRect();
    let down = null;
    view.addEventListener("pointerdown", (e) => {
      if (tween) { tween(); tween = null; }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { down = last = { x: e.clientX, y: e.clientY }; dragged = false; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); dragged = true; }
    });
    view.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId); p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = rect();
        if (pinch) zoomAt(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = d; return;
      }
      if (!dragged && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
        dragged = true;
        try { view.setPointerCapture(e.pointerId); } catch (er) {}
      }
      if (dragged) { cam.x -= (e.clientX - last.x) / cam.z; cam.y -= (e.clientY - last.y) / cam.z; apply(); }
      last = { x: e.clientX, y: e.clientY };
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
    view.addEventListener("pointerup", up);
    view.addEventListener("pointercancel", up);
    view.addEventListener("wheel", (e) => { e.preventDefault(); const r = rect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    root.querySelector('[data-a="in"]').onclick = () => fly(cam.x, cam.y, Math.min(1.6, cam.z * 1.5));
    root.querySelector('[data-a="out"]').onclick = () => fly(cam.x, cam.y, Math.max(fitZ, cam.z / 1.5));
    root.querySelector('[data-a="fit"]').onclick = fit;
    root.querySelector('[data-a="x"]').onclick = () => setOpen(false);
    let open = false;
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      if (v) { cam.x = 0; cam.y = 0; cam.z = fitZ * 0.45; apply(); fly(0, 0, fitZ); }
    }
    function pick(p) { setOpen(false); setTimeout(() => go(p), 150); }
    apply();
    root.querySelector(".zc-fab").onclick = () => setOpen(!open);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { if (tween) tween(); root.remove(); } };
  },
});

/* ───────────── Cube Turn ───────────── */
MENUS.main.push({
  id: "n-cube", name: "Cube Turn", kind: "3D cube rotation", fits: "main",
  desc: "The whole screen is one face of a cube. Open the menu and the cube turns to its side, where the sections wait; pick one and it turns again to a face of that section's pages. Closing turns you back to the page.",
  how: "Tap the cube button at top left. Tap a section to turn to its pages; ← turns back.",
  css: `
.cb{position:absolute;inset:0;perspective:1200px;pointer-events:none}
.cb-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:var(--bg);display:flex;flex-direction:column;padding:112px 18px 18px;transform-origin:50% 50%;pointer-events:none}
.cb.on .cb-face.front{pointer-events:auto}
.cb-face::after{content:"";position:absolute;inset:0;background:#000;opacity:var(--shade,0);pointer-events:none;transition:opacity .9s var(--ease)}
.cb-face h4{margin:0 0 4px;font-family:var(--font-mono);font-weight:500;font-size:10px;letter-spacing:.24em;color:var(--accent);text-transform:uppercase}
.cb-face h3{margin:0 0 14px;font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:24px;line-height:1.05}
.cb-list{display:grid;gap:8px;overflow-y:auto;scrollbar-width:none;padding-bottom:10px}
.cb-list button{display:flex;align-items:center;gap:12px;min-height:50px;padding:0 14px;border-radius:14px;border:1px solid var(--line);background:linear-gradient(90deg,var(--surface2),var(--surface));font-weight:800;text-align:left}
.cb-list button .ic{color:var(--accent);font-size:20px}
.cb-list button em{margin-left:auto;font-style:normal;font-family:var(--font-mono);font-size:11px;color:var(--muted)}
.cb-back{align-self:flex-start;display:inline-flex;gap:6px;align-items:center;color:var(--accent);font-family:var(--font-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}
.cb-edge{position:absolute;inset:0;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);border-radius:inherit;pointer-events:none}
.cb-fab{position:absolute;top:56px;left:12px;z-index:4;pointer-events:auto;width:44px;height:44px;border-radius:13px;border:1px solid var(--lit-line);background:var(--lit);color:var(--accent);display:grid;place-items:center;font-size:20px;box-shadow:var(--glow);transition:transform .6s var(--spring)}
.cb.on .cb-fab{transform:rotate(90deg)}
`,
  build(ctx) {
    const { layer, screen, stage, groups, go } = ctx;
    const W = layer.clientWidth;
    const root = K.h("div", "cb");
    const right = K.h("div", "cb-face");
    const back = K.h("div", "cb-face");
    const fab = K.h("button", "cb-fab", icon("Box"));
    fab.setAttribute("aria-label", "Open menu");
    root.append(right, back, fab);
    layer.append(root);
    stage.style.background = "#000";
    const T = "transform .95s cubic-bezier(.65,0,.25,1)";
    screen.style.backfaceVisibility = "hidden";
    screen.style.transition = T + ", opacity .9s";
    [right, back].forEach((f) => (f.style.transition = T));
    const faces = [[screen, 0], [right, 90], [back, 180]];
    let angle = 0, sel = null;
    function place() {
      for (const [f, base] of faces) {
        const a = base - angle;
        f.style.transform = `translateZ(${-W / 2}px) rotateY(${a}deg) translateZ(${W / 2}px)`;
        const n = ((a % 360) + 360) % 360;
        const front = n < 45 || n > 315;
        if (f !== screen) { f.classList.toggle("front", front); f.style.setProperty("--shade", front ? 0 : 0.55); }
        else f.style.opacity = front ? "1" : "0.55";
      }
      root.classList.toggle("on", angle !== 0);
    }
    function list(el, items, onPick) {
      el.querySelectorAll(".cb-list button").forEach((b, i) => (b.onclick = () => onPick(items[i])));
    }
    right.innerHTML = `<h4>StormSync Weather</h4><h3>Sections</h3><div class="cb-list">${groups.map((g) => `<button>${icon(g.icon)}<span>${g.pages.length === 1 ? g.pages[0].label : g.label}</span><em>${g.pages.length > 1 ? g.pages.length : icon("ArrowUpRight")}</em></button>`).join("")}</div><span class="cb-edge"></span>`;
    list(right, groups, (g) => {
      if (g.pages.length === 1) return pick(g.pages[0]);
      sel = g;
      back.innerHTML = `<button class="cb-back">${icon("ArrowLeft")} Sections</button><h4>Section</h4><h3>${g.label}</h3><div class="cb-list">${g.pages.map((p) => `<button>${icon(p.icon)}<span>${p.label}</span><em>${icon("ChevronRight")}</em></button>`).join("")}</div><span class="cb-edge"></span>`;
      back.querySelector(".cb-back").onclick = () => { angle = 90; place(); };
      list(back, g.pages, pick);
      angle = 180; place();
    });
    function pick(p) { angle = 0; place(); setTimeout(() => go(p), 450); }
    place();
    fab.onclick = () => { angle = angle ? 0 : 90; place(); fab.setAttribute("aria-label", angle ? "Close menu" : "Open menu"); };
    return {
      open: () => { angle = 90; place(); },
      close: () => { angle = 0; place(); },
      destroy: () => { root.remove(); stage.style.background = ""; },
    };
  },
});

/* ───────────── Kinetic Type ───────────── */
MENUS.main.push({
  id: "n-kinetic", name: "Kinetic Type", kind: "Editorial big type", fits: "main",
  desc: "A full-screen index in huge letters. Each section rises out of its own slot, the lines lean with the speed you scroll, and a giant outlined word drifts behind. Pick a section and the others sweep away while its pages rise underneath.",
  how: "Tap MENU. Scroll fast to see the lines lean; tap a section, then a page.",
  css: `
.kt{position:absolute;inset:0;pointer-events:none}
.kt-panel{position:absolute;inset:0;background:var(--bg);opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s .4s;pointer-events:none;overflow:hidden}
.kt.on .kt-panel{opacity:1;visibility:visible;transition:opacity .3s;pointer-events:auto}
.kt-ghost{position:absolute;top:44%;left:0;white-space:nowrap;font-family:var(--font-display);text-transform:uppercase;font-size:calc(var(--sw)*.42);line-height:1;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--accent) 28%,transparent);animation:kt-drift 26s linear infinite;pointer-events:none}
@keyframes kt-drift{to{transform:translateX(-50%)}}
.kt-scroll{position:absolute;inset:0;overflow-y:auto;scrollbar-width:none;padding:64px 18px 110px}
.kt-list{transform:skewY(var(--skew,0deg));transform-origin:0 50%}
.kt-row{display:block;width:100%;text-align:left;border-bottom:1px solid color-mix(in srgb,var(--accent) 18%,transparent);padding:10px 0 8px;transition:transform .55s var(--ease),opacity .35s}
.kt-mask{display:block;overflow:hidden}
.kt-word{display:block;font-family:var(--font-display);text-transform:uppercase;font-size:calc(var(--sw)*.092);line-height:1.02;transform:translateY(105%);transition:transform .75s cubic-bezier(.2,.9,.2,1) var(--d,0s),color .2s}
.kt.on .kt-word{transform:none}
.kt-meta{display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10px;letter-spacing:.16em;color:var(--muted);margin-bottom:2px;opacity:0;transition:opacity .4s calc(var(--d,0s) + .25s)}
.kt.on .kt-meta{opacity:1}
.kt-row:hover .kt-word,.kt-row:focus-visible .kt-word{color:var(--accent);text-shadow:0 0 24px color-mix(in srgb,var(--accent) 45%,transparent)}
.kt-sel .kt-row{opacity:0;transform:translateX(-110%);pointer-events:none}
.kt-sel .kt-row.pick{opacity:1;transform:translateY(var(--up,0px));pointer-events:auto}
.kt-sel .kt-row.pick .kt-word{color:var(--accent)}
.kt-pages{margin-top:6px}
.kt-pages button{display:flex;align-items:baseline;gap:12px;width:100%;text-align:left;padding:9px 0;border-bottom:1px solid var(--line)}
.kt-pages .m{overflow:hidden;display:block;flex:1}
.kt-pages .w{display:block;font-family:var(--font-display);text-transform:uppercase;font-size:calc(var(--sw)*.06);line-height:1.05;transform:translateY(110%);animation:kt-up .6s cubic-bezier(.2,.9,.2,1) forwards;animation-delay:calc(.35s + var(--i)*55ms)}
.kt-pages em{font-style:normal;font-family:var(--font-mono);font-size:10px;color:var(--accent)}
@keyframes kt-up{to{transform:none}}
.kt-fab{position:absolute;right:14px;bottom:18px;z-index:3;pointer-events:auto;height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--lit-line);background:var(--lit);color:var(--accent);font-family:var(--font-mono);font-size:12px;letter-spacing:.3em;box-shadow:var(--glow);display:flex;align-items:center;gap:8px}
.kt-back{position:absolute;left:18px;top:24px;z-index:3;color:var(--accent);font-family:var(--font-mono);font-size:11px;letter-spacing:.16em;display:none;align-items:center;gap:6px}
.kt-sel ~ .kt-back,.kt-panel.kt-sel .kt-back{display:flex}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth;
    const root = K.h("div", "kt");
    root.style.setProperty("--sw", W + "px");
    const items = K.entries(groups);
    root.innerHTML = `<div class="kt-panel"><div class="kt-ghost"></div><div class="kt-scroll"><div class="kt-list">${items.map((it, i) => `<button class="kt-row" data-i="${i}" style="--d:${0.06 + i * 0.05}s"><span class="kt-meta"><span>${String(i + 1).padStart(2, "0")}</span><span>${it.page ? "OPEN" : it.count + " PAGES"}</span></span><span class="kt-mask"><span class="kt-word">${it.label}</span></span></button>`).join("")}<div class="kt-pages"></div></div></div><button class="kt-back">${icon("ArrowLeft")} ALL</button></div><button class="kt-fab">MENU</button>`;
    layer.append(root);
    const panel = root.querySelector(".kt-panel"), scroller = root.querySelector(".kt-scroll"), list = root.querySelector(".kt-list"), ghost = root.querySelector(".kt-ghost"), pagesEl = root.querySelector(".kt-pages"), fab = root.querySelector(".kt-fab");
    const setGhost = (t) => (ghost.textContent = `${t} · ${t} · ${t} · ${t} · `);
    setGhost("StormSync");
    let lastY = 0, skew = 0, stop = null;
    const kick = () => {
      if (stop) return;
      stop = K.loop(() => {
        const y = scroller.scrollTop, v = y - lastY; lastY = y;
        skew += (K.clamp(v * 0.35, -9, 9) - skew) * 0.18;
        list.style.setProperty("--skew", skew.toFixed(2) + "deg");
        if (Math.abs(skew) < 0.02 && Math.abs(v) < 0.1) { list.style.setProperty("--skew", "0deg"); stop = null; return false; }
      });
    };
    scroller.addEventListener("scroll", kick, { passive: true });
    list.querySelectorAll(".kt-row").forEach((b) => {
      b.onclick = () => {
        const it = items[+b.dataset.i];
        if (it.page) return pick(it.page);
        if (panel.classList.contains("kt-sel")) return;
        setGhost(it.label);
        const top = b.offsetTop;
        b.style.setProperty("--up", -top + "px");
        b.classList.add("pick");
        panel.classList.add("kt-sel");
        scroller.scrollTo({ top: 0, behavior: "smooth" });
        const g = it.sec;
        pagesEl.style.cssText = `position:absolute;left:0;right:0;top:${b.offsetHeight + 6}px`;
        pagesEl.innerHTML = g.pages.map((p, i) => `<button style="--i:${i}" data-k="${i}"><em>${String(i + 1).padStart(2, "0")}</em><span class="m"><span class="w">${p.label}</span></span>${icon("ArrowUpRight")}</button>`).join("");
        pagesEl.querySelectorAll("button").forEach((x) => (x.onclick = () => pick(g.pages[+x.dataset.k])));
      };
    });
    list.style.position = "relative";
    const unsel = () => {
      panel.classList.remove("kt-sel");
      list.querySelectorAll(".kt-row.pick").forEach((r) => r.classList.remove("pick"));
      pagesEl.innerHTML = "";
      setGhost("StormSync");
    };
    root.querySelector(".kt-back").onclick = unsel;
    let open = false;
    function setOpen(v) {
      open = v;
      if (!v) setTimeout(unsel, 350);
      else scroller.scrollTop = 0;
      root.classList.toggle("on", v);
      fab.textContent = v ? "CLOSE" : "MENU";
    }
    function pick(p) { setOpen(false); setTimeout(() => go(p), 200); }
    fab.onclick = () => setOpen(!open);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { if (stop) stop(); root.remove(); } };
  },
});

/* ───────────── Piano Keys ───────────── */
MENUS.main.push({
  id: "n-piano", name: "Piano Keys", kind: "Sideways accordion", fits: "main",
  desc: "The sections rise from the bottom as tall keys across the whole screen. Tap one and it slides open like an accordion: the other keys fold into thin stacks on both sides and its pages fill the middle. Tap a folded key to jump straight to that section.",
  how: "Tap Sections. Tap a key to open it; tap any thin key at the sides to switch.",
  css: `
.pk{position:absolute;inset:0;pointer-events:none}
.pk-bg{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 86%,transparent);opacity:0;transition:opacity .35s;pointer-events:none}
.pk.on .pk-bg{opacity:1;pointer-events:auto}
.pk-keys{position:absolute;left:0;right:0;top:54px;bottom:84px}
.pk-key{position:absolute;top:0;bottom:0;left:0;width:var(--kw);transform:translateX(var(--x)) scaleY(0);transform-origin:50% 100%;transition:transform .7s cubic-bezier(.3,1.25,.5,1) var(--d,0s);display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:12px 0 14px;border-radius:0 0 12px 12px;border:1px solid color-mix(in srgb,var(--accent) 30%,var(--line));border-top:0;background:linear-gradient(180deg,var(--surface) 0%,var(--surface2) 78%,color-mix(in srgb,var(--surface2) 80%,#fff) 100%);box-shadow:inset 0 -6px 0 -2px color-mix(in srgb,var(--bg) 60%,transparent),0 10px 18px -10px #000;color:var(--text);pointer-events:none;z-index:var(--z,1)}
.pk-key:nth-child(even){background:linear-gradient(180deg,var(--bg) 0%,var(--surface) 80%,color-mix(in srgb,var(--surface) 80%,#fff) 100%)}
.pk.on .pk-key{transform:translateX(var(--x)) scaleY(1);pointer-events:auto}
.pk-key:active{filter:brightness(1.15)}
.pk-key .ic{color:var(--accent);font-size:20px;flex:none}
.pk-key b{writing-mode:vertical-rl;transform:rotate(180deg);font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:15px;letter-spacing:.06em;white-space:nowrap;overflow:hidden;max-height:calc(100% - 60px)}
.pk-key i{font-style:normal;font-family:var(--font-mono);font-size:9px;color:var(--muted)}
.pk-key[data-sel]{border-color:var(--accent);box-shadow:0 0 18px -6px var(--accent),inset 0 -6px 0 -2px color-mix(in srgb,var(--bg) 60%,transparent)}
.pk-key[data-sel] b{color:var(--accent)}
.pk-panel{position:absolute;top:54px;bottom:84px;border:1px solid var(--lit-line);border-left:0;border-radius:0 0 16px 0;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 6%,var(--surface)),var(--surface));transform-origin:0 50%;transform:scaleX(0);transition:transform .55s var(--ease);pointer-events:none;overflow:hidden;z-index:30}
.pk-panel.show{transform:none;pointer-events:auto}
.pk-in{position:absolute;inset:0;overflow-y:auto;padding:14px 12px;opacity:0;transition:opacity .25s;scrollbar-width:none}
.pk-panel.show .pk-in{opacity:1;transition:opacity .35s .3s}
.pk-in h4{margin:0 0 10px;font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:18px;line-height:1.05}
.pk-in button{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;border-bottom:1px solid var(--line);font-weight:700;font-size:13.5px;text-align:left;transform:translateX(-12px);opacity:0}
.pk-panel.show .pk-in button{transform:none;opacity:1;transition:transform .45s var(--spring) calc(.35s + var(--i)*40ms),opacity .3s calc(.35s + var(--i)*40ms)}
.pk-in .ic{color:var(--accent)}
.pk-fab{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);z-index:40;pointer-events:auto;height:46px;padding:0 20px;border-radius:999px;border:1px solid var(--lit-line);background:var(--lit);color:var(--accent);font-weight:800;display:flex;align-items:center;gap:8px;box-shadow:var(--glow)}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth;
    const N = groups.length, kw = W / N, gap = 7;
    const root = K.h("div", "pk");
    root.style.setProperty("--kw", kw + "px");
    root.innerHTML = `<div class="pk-bg"></div><div class="pk-keys"></div><div class="pk-panel"><div class="pk-in"></div></div><button class="pk-fab">${icon("Grip")} Sections</button>`;
    layer.append(root);
    const keysEl = root.querySelector(".pk-keys"), panel = root.querySelector(".pk-panel"), inner = root.querySelector(".pk-in"), fab = root.querySelector(".pk-fab");
    const keys = groups.map((g, i) => {
      const k = K.h("button", "pk-key", `${icon(g.icon)}<b>${g.pages.length === 1 ? g.pages[0].label : g.label}</b><i>${g.pages.length}</i>`);
      k.style.setProperty("--d", (Math.abs(i - (N - 1) / 2) * 0.05).toFixed(2) + "s");
      k.onclick = () => (g.pages.length === 1 ? pick(g.pages[0]) : select(sel === i ? -1 : i));
      keysEl.append(k);
      return k;
    });
    let sel = -1, open = false;
    function layout() {
      keys.forEach((k, i) => {
        let x = i * kw, z = 1;
        if (sel >= 0) {
          if (i < sel) { x = i * gap + gap - kw; z = 20 - i; }
          else if (i === sel) { x = sel * gap; z = 25; }
          else { x = W - (N - i) * gap; z = i; }
        }
        k.style.setProperty("--x", x + "px");
        k.style.setProperty("--z", z);
        k.toggleAttribute("data-sel", i === sel);
        k.style.transitionDelay = sel >= 0 || !open ? "0s" : "";
      });
      if (sel >= 0) {
        const left = sel * gap + kw, right = (N - 1 - sel) * gap;
        panel.style.left = left + "px"; panel.style.width = W - left - right + "px";
        const g = groups[sel];
        inner.innerHTML = `<h4>${g.label}</h4>${g.pages.map((p, i) => `<button style="--i:${i}" data-k="${i}">${icon(p.icon)}<span>${p.label}</span></button>`).join("")}`;
        inner.querySelectorAll("button").forEach((b) => (b.onclick = () => pick(g.pages[+b.dataset.k])));
        panel.classList.remove("show"); void panel.offsetWidth; panel.classList.add("show");
      } else panel.classList.remove("show");
    }
    function select(i) { sel = i; layout(); }
    function setOpen(v) {
      open = v;
      if (!v) { sel = -1; panel.classList.remove("show"); }
      layout();
      keys.forEach((k, i) => (k.style.transitionDelay = v ? (Math.abs(i - (N - 1) / 2) * 0.05).toFixed(2) + "s" : (i * 0.02).toFixed(2) + "s"));
      root.classList.toggle("on", v);
      fab.innerHTML = v ? `${icon("X")} Close` : `${icon("Grip")} Sections`;
    }
    function pick(p) { setOpen(false); setTimeout(() => go(p), 250); }
    root.querySelector(".pk-bg").onclick = () => setOpen(false);
    fab.onclick = () => setOpen(!open);
    layout();
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => root.remove() };
  },
});
