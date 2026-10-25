/* New main menus, part 2: Picker Drum, Page Flip, Tabletop, Switcher, Jelly Drawer. */

/* ───────────── Picker Drum ───────────── */
MENUS.main.push({
  id: "n-drum", name: "Picker Drum", kind: "Twin 3D picker wheels", fits: "main",
  desc: "Two 3D drums side by side, like a precision watch picker: spin the left one through the sections and the right one instantly fills with that section's pages. Both glide with momentum and click into place on the gold line.",
  how: "Tap Browse. Flick either drum or tap a row to center it; tap the centered page (or Open) to go.",
  css: `
.pd-bg{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 70%,transparent);opacity:0;transition:opacity .35s;pointer-events:none}
.pd.on .pd-bg{opacity:1;pointer-events:auto}
.pd-sheet{position:absolute;left:10px;right:10px;bottom:10px;border-radius:26px;border:1px solid var(--lit-line);background:linear-gradient(180deg,var(--surface2),var(--surface));box-shadow:0 -10px 40px -12px #000,var(--glow);padding:14px 14px 14px;transform:translateY(calc(100% + 20px));transition:transform .55s var(--ease)}
.pd.on .pd-sheet{transform:none;transition:transform .6s cubic-bezier(.2,1.2,.4,1)}
.pd-head{display:flex;justify-content:space-between;align-items:center;margin:0 4px 6px}
.pd-head small{font-family:var(--font-mono);font-size:10px;letter-spacing:.22em;color:var(--accent);text-transform:uppercase}
.pd-head button{width:34px;height:34px;border-radius:11px;border:1px solid var(--line);display:grid;place-items:center;color:var(--muted)}
.pd-wheels{position:relative;display:grid;grid-template-columns:1fr 1.25fr;gap:6px;height:220px}
.pd-band{position:absolute;left:0;right:0;top:50%;height:40px;margin-top:-20px;border-top:1px solid var(--accent);border-bottom:1px solid var(--accent);background:color-mix(in srgb,var(--accent) 7%,transparent);box-shadow:0 0 18px -8px var(--accent);pointer-events:none;border-radius:6px}
.pd-band.tick{animation:pd-tick .18s}
@keyframes pd-tick{50%{box-shadow:0 0 26px -4px var(--accent)}}
.pd-drum{position:relative;overflow:hidden;perspective:520px;touch-action:none;cursor:grab;-webkit-mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent);mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent)}
.pd-drum button{position:absolute;left:0;right:0;top:50%;height:40px;margin-top:-20px;display:flex;align-items:center;gap:8px;padding:0 10px;font-weight:800;font-size:13.5px;white-space:nowrap;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;color:var(--text)}
.pd-drum button .ic{color:var(--accent);flex:none}
.pd-drum button span{overflow:hidden;text-overflow:ellipsis}
.pd-drum.pages button{font-weight:700}
.pd-go{margin-top:12px;width:100%;min-height:48px;border-radius:14px;border:1px solid var(--lit-line);background:var(--lit);color:var(--accent);font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:var(--glow)}
.pd-fab{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);height:46px;padding:0 20px;border-radius:999px;border:1px solid var(--lit-line);background:var(--lit);color:var(--accent);font-weight:800;display:flex;align-items:center;gap:8px;box-shadow:var(--glow);transition:opacity .25s,transform .35s var(--spring)}
.pd.on .pd-fab{opacity:0;transform:translateX(-50%) scale(.8);pointer-events:none}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const root = K.h("div", "pd");
    root.innerHTML = `<div class="pd-bg"></div><div class="pd-sheet"><div class="pd-head"><small>Section · Page</small><button aria-label="Close menu">${icon("X")}</button></div><div class="pd-wheels"><div class="pd-drum secs"></div><div class="pd-drum pages"></div><span class="pd-band"></span></div><button class="pd-go"></button></div><button class="pd-fab">${icon("SlidersHorizontal")} Browse</button>`;
    layer.append(root);
    const band = root.querySelector(".pd-band"), goBtn = root.querySelector(".pd-go");
    const IH = 40, STEP = 21, R = IH / 2 / Math.tan((STEP * Math.PI) / 360);
    const stops = [];
    function drum(el, onChange, onCenterTap) {
      let items = [], r = 0, sp = K.spring(0, { k: 120, c: 16 }), stop = null, last = -1;
      const render = () => {
        items.forEach((b, i) => {
          const a = (i - r) * STEP;
          if (Math.abs(a) > 100) { b.style.opacity = "0"; b.style.visibility = "hidden"; return; }
          b.style.visibility = "";
          b.style.opacity = (0.2 + 0.8 * Math.cos((a * Math.PI) / 180) ** 2).toFixed(2);
          b.style.transform = `rotateX(${-a}deg) translateZ(${R}px)`;
        });
        const idx = Math.round(r);
        if (idx !== last && items.length) { last = idx; band.classList.remove("tick"); void band.offsetWidth; band.classList.add("tick"); onChange(K.clamp(idx, 0, items.length - 1)); }
      };
      const settle = (target) => {
        sp.value = r; sp.target = K.clamp(Math.round(target), 0, items.length - 1);
        if (stop) stop();
        stop = K.loop((dt) => { r = sp.step(dt); render(); if (sp.rest) { r = sp.target; render(); stop = null; return false; } });
      };
      let r0 = 0;
      stops.push(K.drag(el, {
        down: () => { if (stop) { stop(); stop = null; } sp.v = 0; r0 = r; },
        move: ({ dy }) => { r = K.clamp(r0 - dy / IH, -0.6, items.length - 0.4); render(); },
        up: ({ moved, vy, e }) => {
          if (!moved) {
            const b = e.target.closest("button");
            const i = items.indexOf(b);
            if (i >= 0 && Math.round(r) === i) return onCenterTap(i);
            if (i >= 0) return settle(i);
            return settle(r);
          }
          sp.v = 0;
          settle(r - (vy / IH) * 0.28);
        },
      }));
      return {
        set(list) {
          el.innerHTML = list.map((it) => `<button>${icon(it.icon)}<span>${it.label}</span></button>`).join("");
          items = [...el.querySelectorAll("button")];
          r = 0; last = -1; render();
        },
        get index() { return K.clamp(Math.round(r), 0, items.length - 1); },
      };
    }
    let secI = 0;
    const pagesDrum = drum(root.querySelector(".pd-drum.pages"), (i) => { const p = groups[secI].pages[i]; goBtn.innerHTML = `Open ${p.label} ${icon("ArrowRight")}`; }, (i) => pick(groups[secI].pages[i]));
    const secDrum = drum(root.querySelector(".pd-drum.secs"), (i) => { secI = i; pagesDrum.set(groups[i].pages); }, () => {});
    secDrum.set(groups.map((g) => ({ label: g.pages.length === 1 ? g.pages[0].label : g.label, icon: g.icon })));
    goBtn.onclick = () => pick(groups[secI].pages[pagesDrum.index]);
    let open = false;
    const setOpen = (v) => { open = v; root.classList.toggle("on", v); };
    function pick(p) { setOpen(false); setTimeout(() => go(p), 200); }
    root.querySelector(".pd-fab").onclick = () => setOpen(true);
    root.querySelector(".pd-head button").onclick = () => setOpen(false);
    root.querySelector(".pd-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { stops.forEach((s) => s()); root.remove(); } };
  },
});

/* ───────────── Page Flip ───────────── */
MENUS.main.push({
  id: "n-book", name: "Page Flip", kind: "3D book", fits: "main",
  desc: "The app as a pocket book. It opens to a table of contents; each section is a chapter on its own page, and pages turn in 3D with a shadow sweeping across the paper. Tapping a chapter in the contents riffles straight to it.",
  how: "Tap the book. Swipe or tap the page edges to turn; tap a chapter in the contents to jump.",
  css: `
.bk-bg{position:absolute;inset:0;background:radial-gradient(90% 60% at 50% 45%,color-mix(in srgb,var(--accent) 7%,var(--bg)),color-mix(in srgb,var(--bg) 96%,transparent));opacity:0;transition:opacity .35s;pointer-events:none}
.bk.on .bk-bg{opacity:1;pointer-events:auto}
.bk-book{position:absolute;left:18px;right:14px;top:110px;bottom:86px;perspective:1600px;transform-origin:0 0;transform:scale(.12) rotate(-8deg);opacity:0;transition:transform .55s var(--ease),opacity .3s;pointer-events:none;touch-action:pan-y}
.bk.on .bk-book{transform:none;opacity:1;pointer-events:auto;transition:transform .65s cubic-bezier(.2,1.15,.4,1),opacity .25s}
.bk-book::before{content:"";position:absolute;left:-8px;top:6px;bottom:-6px;right:-4px;border-radius:6px 16px 16px 6px;background:repeating-linear-gradient(0deg,var(--surface) 0 2px,var(--bg) 2px 3px);border:1px solid var(--line)}
.bk-leaf{position:absolute;inset:0;transform-origin:0 50%;transition:transform .8s cubic-bezier(.45,.05,.25,1);transform-style:preserve-3d}
.bk-leaf.flip{transform:rotateY(-178deg)}
.bk-page{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:4px 16px 16px 4px;background:linear-gradient(90deg,color-mix(in srgb,#000 30%,var(--surface2)) 0,var(--surface2) 9%,var(--surface) 100%);border:1px solid color-mix(in srgb,var(--accent) 30%,var(--line));padding:20px 18px 16px 24px;display:flex;flex-direction:column;overflow:hidden}
.bk-page::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.55),transparent 70%);opacity:0;pointer-events:none}
.bk-leaf.moving .bk-page::after{animation:bk-shade .8s}
@keyframes bk-shade{40%{opacity:1}}
.bk-back{transform:rotateY(180deg);background:linear-gradient(270deg,var(--surface2),var(--surface))}
.bk-page small{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.24em;color:var(--accent);text-transform:uppercase}
.bk-page h4{margin:6px 0 12px;font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:23px;line-height:1.04;border-bottom:1px solid color-mix(in srgb,var(--accent) 30%,transparent);padding-bottom:10px}
.bk-page ul{list-style:none;margin:0;padding:0;display:grid;gap:2px;overflow-y:auto;scrollbar-width:none}
.bk-page li button{display:flex;align-items:baseline;gap:8px;width:100%;padding:8px 0;font-weight:700;font-size:14px;text-align:left}
.bk-page li .ic{color:var(--accent);align-self:center}
.bk-page li .dots{flex:1;border-bottom:1.5px dotted color-mix(in srgb,var(--muted) 55%,transparent);transform:translateY(-4px)}
.bk-page li em{font-style:normal;font-family:var(--font-mono);font-size:11px;color:var(--muted)}
.bk-foot{margin-top:auto;padding-top:10px;display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10px;color:var(--muted)}
.bk-curl{position:absolute;right:0;bottom:0;width:34px;height:34px;background:linear-gradient(135deg,transparent 50%,color-mix(in srgb,var(--accent) 35%,var(--surface2)) 50%,var(--surface) 100%);border-radius:0 0 16px 0;box-shadow:-3px -3px 8px -4px #000}
.bk-fab{position:absolute;top:56px;left:12px;width:44px;height:44px;border-radius:12px 12px 12px 4px;border:1px solid var(--lit-line);background:var(--lit);color:var(--accent);display:grid;place-items:center;font-size:20px;box-shadow:var(--glow);z-index:3}
.bk-nav{position:absolute;left:0;right:0;bottom:24px;display:flex;justify-content:center;gap:10px;opacity:0;transition:opacity .3s;pointer-events:none}
.bk.on .bk-nav{opacity:1;pointer-events:auto}
.bk-nav button{height:40px;min-width:44px;padding:0 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--accent);display:flex;align-items:center;gap:6px;font-weight:800;font-size:13px}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const root = K.h("div", "bk");
    const chapters = groups.filter((g) => g.pages.length > 1);
    const singles = groups.filter((g) => g.pages.length === 1);
    root.innerHTML = `<div class="bk-bg"></div><div class="bk-book"></div><div class="bk-nav"><button data-a="prev" aria-label="Previous page">${icon("ChevronLeft")}</button><button data-a="toc">${icon("ListChecks")} Contents</button><button data-a="next" aria-label="Next page">${icon("ChevronRight")}</button><button data-a="x" aria-label="Close menu">${icon("X")}</button></div><button class="bk-fab" aria-label="Open menu">${icon("BookA")}</button>`;
    layer.append(root);
    const book = root.querySelector(".bk-book");
    const total = chapters.length + 1;
    const leaves = [];
    const toc = `<small>StormSync Weather</small><h4>Contents</h4><ul>${singles.map((g) => `<li><button data-p="${g.id}">${icon(g.icon)}<span>${g.pages[0].label}</span><span class="dots"></span><em>${icon("ArrowUpRight")}</em></button></li>`).join("")}${chapters.map((g, i) => `<li><button data-c="${i}">${icon(g.icon)}<span>${g.label}</span><span class="dots"></span><em>${i + 2}</em></button></li>`).join("")}</ul><div class="bk-foot"><span>Pocket edition</span><span>1</span></div><span class="bk-curl"></span>`;
    const page = (g, i) => `<small>Chapter ${i + 1}</small><h4>${g.label}</h4><ul>${g.pages.map((p, k) => `<li><button data-g="${i}" data-k="${k}">${icon(p.icon)}<span>${p.label}</span><span class="dots"></span><em>${icon("ChevronRight")}</em></button></li>`).join("")}</ul><div class="bk-foot"><span>${g.pages.length} pages</span><span>${i + 2}</span></div><span class="bk-curl"></span>`;
    for (let i = 0; i < total; i++) {
      const leaf = K.h("div", "bk-leaf", `<div class="bk-page">${i === 0 ? toc : page(chapters[i - 1], i - 1)}</div><div class="bk-page bk-back"><div class="bk-foot" style="margin-top:auto"><span></span><span>StormSync</span></div></div>`);
      leaf.style.zIndex = total - i;
      book.append(leaf);
      leaves.push(leaf);
    }
    let cur = 0, open = false, busy = 0;
    const turn = (i, fwd) => {
      const l = leaves[i];
      l.classList.remove("moving"); void l.offsetWidth; l.classList.add("moving");
      l.classList.toggle("flip", fwd);
      l.style.zIndex = fwd ? total + i : total - i;
      setTimeout(() => { if (!l.classList.contains("flip")) l.style.zIndex = total - i; }, 820);
    };
    const next = () => { if (cur < total - 1) { turn(cur, true); cur++; } };
    const prev = () => { if (cur > 0) { cur--; turn(cur, false); } };
    function goTo(t) {
      clearInterval(busy);
      busy = setInterval(() => { if (cur < t) next(); else if (cur > t) prev(); else clearInterval(busy); }, K.reduce ? 1 : 110);
    }
    book.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.c) goTo(+b.dataset.c + 1);
      else if (b.dataset.p) pick(groups.find((g) => g.id === b.dataset.p).pages[0]);
      else if (b.dataset.g) pick(chapters[+b.dataset.g].pages[+b.dataset.k]);
    });
    const off = K.drag(book, { up: ({ dx, moved, e }) => { if (moved && Math.abs(dx) > 40) (dx < 0 ? next : prev)(); else if (!moved && !e.target.closest("button")) { const r = book.getBoundingClientRect(); (e.clientX - r.left > r.width / 2 ? next : prev)(); } } }, { threshold: 10 });
    root.querySelector('[data-a="prev"]').onclick = prev;
    root.querySelector('[data-a="next"]').onclick = next;
    root.querySelector('[data-a="toc"]').onclick = () => goTo(0);
    root.querySelector('[data-a="x"]').onclick = () => setOpen(false);
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      if (!v) setTimeout(() => { if (!open) { clearInterval(busy); leaves.forEach((l, i) => { l.classList.remove("flip", "moving"); l.style.zIndex = total - i; }); cur = 0; } }, 500);
    }
    function pick(p) { setOpen(false); setTimeout(() => go(p), 250); }
    root.querySelector(".bk-fab").onclick = () => setOpen(!open);
    root.querySelector(".bk-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { clearInterval(busy); off(); root.remove(); } };
  },
});

/* ───────────── Tabletop ───────────── */
MENUS.main.push({
  id: "n-table", name: "Tabletop", kind: "Physics card toss", fits: "main",
  desc: "The sections are thrown onto a felt table as cards that slide, spin and bump each other to a stop. Fling them around with a finger. Tap one and it flies to the middle and flips over to show its pages; Tidy lines them all up.",
  how: "Tap the cards button. Drag and fling cards; tap one to flip it; Tidy or Shuffle the table.",
  css: `
.tt-table{position:absolute;inset:0;background:radial-gradient(90% 70% at 50% 40%,color-mix(in srgb,var(--accent) 8%,var(--surface)),var(--bg) 75%);opacity:0;transition:opacity .35s;pointer-events:none;overflow:hidden;touch-action:none}
.tt-table::before{content:"";position:absolute;inset:0;opacity:.18;background-image:repeating-linear-gradient(45deg,transparent 0 3px,rgba(255,255,255,.035) 3px 4px)}
.tt.on .tt-table{opacity:1;pointer-events:auto}
.tt-card{position:absolute;left:0;top:0;width:104px;height:124px;margin:-62px 0 0 -52px;border-radius:12px;background:linear-gradient(160deg,var(--surface2),var(--surface));border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));box-shadow:0 10px 18px -8px #000,inset 0 0 0 5px var(--surface2),inset 0 0 0 6px color-mix(in srgb,var(--accent) 25%,transparent);display:grid;justify-items:center;align-content:center;gap:6px;padding:10px;text-align:center;font-weight:800;font-size:12.5px;line-height:1.15;color:var(--text);cursor:grab;will-change:transform;touch-action:none}
.tt-card .ic{font-size:30px;color:var(--accent)}
.tt-card small{font-family:var(--font-mono);font-size:9px;color:var(--muted);font-weight:500}
.tt-card.up{z-index:5;box-shadow:0 22px 30px -12px #000,inset 0 0 0 5px var(--surface2),inset 0 0 0 6px var(--accent)}
.tt-focus{position:absolute;left:50%;top:46%;width:min(300px,84%);height:390px;margin:-195px 0 0 calc(min(300px,84%) / -2);perspective:1000px;z-index:20;pointer-events:none}
.tt-flip{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.3,1.1,.4,1)}
.tt-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:20px;border:1px solid var(--accent);background:linear-gradient(160deg,var(--surface2),var(--surface));box-shadow:0 30px 60px -20px #000,0 0 30px -10px var(--accent)}
.tt-front{display:grid;place-items:center;align-content:center;gap:10px;font-weight:800;font-size:22px}
.tt-front .ic{font-size:64px;color:var(--accent)}
.tt-backf{transform:rotateY(180deg);padding:18px;display:flex;flex-direction:column;pointer-events:auto}
.tt-backf h4{margin:0 0 10px;font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:20px;display:flex;gap:10px;align-items:center}
.tt-backf h4 .ic{color:var(--accent)}
.tt-backf ul{list-style:none;margin:0;padding:0;overflow-y:auto;scrollbar-width:none}
.tt-backf li button{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;border-bottom:1px solid var(--line);font-weight:700;text-align:left;font-size:14px}
.tt-backf li .ic{color:var(--accent)}
.tt-ui{position:absolute;right:12px;bottom:16px;display:flex;gap:8px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:25}
.tt.on .tt-ui{opacity:1;pointer-events:auto}
.tt-ui button,.tt-fab{height:44px;padding:0 14px;border-radius:14px;border:1px solid var(--lit-line);background:color-mix(in srgb,var(--bg) 78%,transparent);color:var(--accent);display:flex;align-items:center;gap:6px;font-weight:800;font-size:13px}
.tt-fab{position:absolute;left:14px;bottom:18px;width:50px;justify-content:center;padding:0;font-size:22px;box-shadow:var(--glow);background:var(--lit);z-index:26}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const root = K.h("div", "tt");
    root.innerHTML = `<div class="tt-table"></div><div class="tt-focus"></div><div class="tt-ui"><button data-a="tidy">${icon("LayoutDashboard")}Tidy</button><button data-a="shuf">${icon("Shuffle")}Shuffle</button><button data-a="x" aria-label="Close menu">${icon("X")}</button></div><button class="tt-fab" aria-label="Open menu">${icon("Layers")}</button>`;
    layer.append(root);
    const table = root.querySelector(".tt-table"), focus = root.querySelector(".tt-focus");
    const fx = 40, fy = H - 40;
    const bodies = groups.map((g, i) => {
      const el = K.h("button", "tt-card", `${icon(g.icon)}<span>${g.pages.length === 1 ? g.pages[0].label : g.label}</span><small>${g.pages.length === 1 ? "OPEN" : g.pages.length + " PAGES"}</small>`);
      table.append(el);
      return { el, g, x: fx, y: fy, a: 0, vx: 0, vy: 0, va: 0, held: false };
    });
    let stop = null, z = 6, tweenStop = null;
    const draw = (b) => (b.el.style.transform = `translate(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px) rotate(${b.a.toFixed(1)}deg)`);
    function run() {
      if (stop) return;
      stop = K.loop((dt) => {
        let moving = false;
        for (const b of bodies) {
          if (b.held) { moving = true; continue; }
          b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
          const f = Math.pow(0.12, dt);
          b.vx *= f; b.vy *= f; b.va *= Math.pow(0.08, dt);
          const m = 56;
          if (b.x < m) { b.x = m; b.vx = Math.abs(b.vx) * 0.5; b.va += 40; }
          if (b.x > W - m) { b.x = W - m; b.vx = -Math.abs(b.vx) * 0.5; b.va -= 40; }
          if (b.y < 100) { b.y = 100; b.vy = Math.abs(b.vy) * 0.5; }
          if (b.y > H - 140) { b.y = H - 140; b.vy = -Math.abs(b.vy) * 0.5; }
          if (Math.hypot(b.vx, b.vy) > 4 || Math.abs(b.va) > 4) moving = true;
        }
        for (let i = 0; i < bodies.length; i++)
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i], c = bodies[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, min = 92;
            if (d < min) {
              const push = (min - d) * 0.5, nx = dx / d, ny = dy / d;
              if (!a.held) { a.x -= nx * push * 0.5; a.y -= ny * push * 0.5; a.vx -= nx * 30; a.vy -= ny * 30; }
              if (!c.held) { c.x += nx * push * 0.5; c.y += ny * push * 0.5; c.vx += nx * 30; c.vy += ny * 30; }
              moving = true;
            }
          }
        bodies.forEach(draw);
        if (!moving) { stop = null; return false; }
      });
    }
    function toss() {
      if (tweenStop) { tweenStop(); tweenStop = null; }
      bodies.forEach((b, i) => {
        b.x = fx; b.y = fy; b.a = Math.random() * 40 - 20;
        const tx = 70 + Math.random() * (W - 140), ty = 130 + Math.random() * (H - 300);
        b.vx = (tx - fx) * (2.2 + Math.random() * 0.6) + (i % 2 ? 30 : -30);
        b.vy = (ty - fy) * (2.2 + Math.random() * 0.6);
        b.va = Math.random() * 900 - 450;
      });
      run();
    }
    function tidy() {
      if (stop) { stop(); stop = null; }
      const cols = 3, gx = (W - 40) / cols, gy = Math.min(140, (H - 230) / Math.ceil(bodies.length / cols));
      const from = bodies.map((b) => ({ x: b.x, y: b.y, a: b.a })), t0 = performance.now();
      if (tweenStop) tweenStop();
      tweenStop = K.loop(() => {
        const t = Math.min(1, (performance.now() - t0) / 600), e = 1 - Math.pow(1 - t, 3);
        bodies.forEach((b, i) => {
          const tx = 20 + gx * (i % cols) + gx / 2, ty = 140 + gy * Math.floor(i / cols);
          b.x = from[i].x + (tx - from[i].x) * e; b.y = from[i].y + (ty - from[i].y) * e; b.a = from[i].a * (1 - e);
          b.vx = b.vy = b.va = 0; draw(b);
        });
        if (t >= 1) { tweenStop = null; return false; }
      });
    }
    const offs = bodies.map((b) => {
      let ox = 0, oy = 0;
      return K.drag(b.el, {
        down: ({ x, y }) => { const r = table.getBoundingClientRect(); b.held = true; ox = x - r.left - b.x; oy = y - r.top - b.y; b.el.style.zIndex = ++z; b.el.classList.add("up"); run(); },
        move: ({ x, y }) => { const r = table.getBoundingClientRect(); b.x = x - r.left - ox; b.y = y - r.top - oy; draw(b); },
        up: ({ moved, vx, vy }) => {
          b.held = false; b.el.classList.remove("up");
          if (!moved) return b.g.pages.length === 1 ? pick(b.g.pages[0]) : show(b);
          b.vx = vx; b.vy = vy; b.va = vx * 0.3; run();
        },
      });
    });
    function show(b) {
      const g = b.g;
      focus.innerHTML = `<div class="tt-flip"><div class="tt-face tt-front">${icon(g.icon)}<span>${g.label}</span></div><div class="tt-face tt-backf"><h4>${icon(g.icon)}${g.label}</h4><ul>${g.pages.map((p, k) => `<li><button data-k="${k}">${icon(p.icon)}<span>${p.label}</span></button></li>`).join("")}</ul></div></div>`;
      const flip = focus.querySelector(".tt-flip");
      const fr = focus.getBoundingClientRect(), tr = table.getBoundingClientRect();
      const s = 104 / fr.width;
      const dx = tr.left + b.x - (fr.left + fr.width / 2), dy = tr.top + b.y - (fr.top + fr.height / 2);
      flip.style.transition = "none";
      flip.style.transform = `translate(${dx}px,${dy}px) scale(${s}) rotate(${b.a}deg)`;
      b.el.style.opacity = "0";
      void flip.offsetWidth;
      flip.style.transition = "";
      flip.style.transform = "rotateY(180deg)";
      focus.style.pointerEvents = "auto";
      focus.querySelectorAll("[data-k]").forEach((x) => (x.onclick = () => pick(g.pages[+x.dataset.k])));
      focus.onclick = (e) => { if (!e.target.closest("button")) hide(); };
      focus._b = b;
      const shown = performance.now();
      table.onclick = () => { if (performance.now() - shown > 350) hide(); };
    }
    function hide() {
      const b = focus._b;
      if (!b) return;
      focus._b = null;
      const flip = focus.querySelector(".tt-flip"), fr = focus.getBoundingClientRect(), tr = table.getBoundingClientRect();
      flip.style.transform = `translate(${tr.left + b.x - (fr.left + fr.width / 2)}px,${tr.top + b.y - (fr.top + fr.height / 2)}px) scale(${104 / fr.width}) rotate(${b.a}deg)`;
      focus.style.pointerEvents = "none";
      table.onclick = null;
      setTimeout(() => { b.el.style.opacity = ""; if (!focus._b) focus.innerHTML = ""; }, 650);
    }
    let open = false;
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      if (v) toss(); else { hide(); if (stop) { stop(); stop = null; } }
    }
    function pick(p) { setOpen(false); setTimeout(() => go(p), 200); }
    bodies.forEach(draw);
    root.querySelector('[data-a="tidy"]').onclick = tidy;
    root.querySelector('[data-a="shuf"]').onclick = toss;
    root.querySelector('[data-a="x"]').onclick = () => setOpen(false);
    root.querySelector(".tt-fab").onclick = () => setOpen(!open);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { if (stop) stop(); if (tweenStop) tweenStop(); offs.forEach((o) => o()); root.remove(); } };
  },
});

/* ───────────── Switcher ───────────── */
MENUS.main.push({
  id: "n-switch", name: "Switcher", kind: "App switcher stack", fits: "main",
  desc: "Like a phone's app switcher: swipe up from the bar and the page you're on shrinks into a card at the bottom of a 3D stack of section cards, each showing a preview of its pages. Tap a card and it zooms up to fill the screen.",
  how: "Swipe up on the bar at the bottom (or tap it). Scroll the stack, tap a card, then a page. Tap your page's card to go back.",
  css: `
.sw-bg{position:absolute;inset:0;background:#05060a;opacity:0;transition:opacity .4s;pointer-events:none;z-index:-1}
.sw{position:absolute;inset:0;pointer-events:none}
.sw.on .sw-stack{pointer-events:auto}
.sw-stack{position:absolute;left:0;right:0;top:0;bottom:var(--now);overflow-y:auto;scrollbar-width:none;padding:70px 18px 30px;perspective:900px;opacity:0;transition:opacity .3s;pointer-events:none}
.sw.on .sw-stack{opacity:1;transition:opacity .4s .1s}
.sw-card{position:relative;display:block;width:100%;height:170px;margin-top:-92px;border-radius:22px;border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line));background:linear-gradient(180deg,var(--surface2),var(--surface) 70%);box-shadow:0 -14px 30px -10px #000;transform-origin:50% 0;transform:rotateX(-14deg) translateY(60px);opacity:0;transition:transform .6s cubic-bezier(.2,1.1,.4,1) var(--d),opacity .4s var(--d);text-align:left;padding:14px 16px;overflow:hidden}
.sw-card:first-child{margin-top:0}
.sw.on .sw-card{transform:rotateX(-14deg);opacity:1}
.sw-card header{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px}
.sw-card header .ic{color:var(--accent);font-size:20px}
.sw-card header em{margin-left:auto;font-style:normal;font-family:var(--font-mono);font-size:10px;color:var(--muted)}
.sw-card .pv{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
.sw-card .pv span{font-size:11px;padding:3px 8px;border-radius:7px;border:1px solid var(--line);color:var(--muted);background:var(--bg)}
.sw-now{position:absolute;left:0;right:0;bottom:0;height:var(--now);pointer-events:none}
.sw.on .sw-now{pointer-events:auto}
.sw-now small{position:absolute;left:0;right:0;top:8px;text-align:center;font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:var(--accent);text-transform:uppercase;opacity:0;transition:opacity .3s}
.sw.on .sw-now small{opacity:1;transition:opacity .4s .3s}
.sw-full{position:absolute;inset:0;background:var(--bg);border-radius:22px;padding:64px 18px 18px;display:flex;flex-direction:column;transform-origin:0 0;z-index:5;border:1px solid var(--lit-line)}
.sw-full h4{margin:0 0 12px;display:flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:22px}
.sw-full h4 .ic{color:var(--accent)}
.sw-full ul{list-style:none;margin:0;padding:0;overflow-y:auto;scrollbar-width:none}
.sw-full li{opacity:0;transform:translateY(12px);animation:sw-in .45s var(--ease) forwards;animation-delay:calc(.25s + var(--i)*40ms)}
@keyframes sw-in{to{opacity:1;transform:none}}
.sw-full li button{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;border-bottom:1px solid var(--line);font-weight:700;text-align:left}
.sw-full li .ic{color:var(--accent)}
.sw-full .back{position:absolute;left:16px;top:20px;display:flex;align-items:center;gap:6px;color:var(--accent);font-family:var(--font-mono);font-size:11px;letter-spacing:.14em}
.sw-bar{position:absolute;left:50%;bottom:8px;width:150px;height:34px;margin-left:-75px;display:grid;place-items:center;touch-action:none;z-index:6}
.sw-bar i{width:120px;height:5px;border-radius:5px;background:var(--text);opacity:.85;box-shadow:0 0 12px var(--accent)}
.sw-bar span{position:absolute;bottom:22px;font-family:var(--font-mono);font-size:9px;letter-spacing:.2em;color:var(--muted);animation:sw-hint 2.4s ease-in-out infinite}
@keyframes sw-hint{50%{transform:translateY(-5px);opacity:.5}}
.sw.on .sw-bar{opacity:0;pointer-events:none}
`,
  build(ctx) {
    const { layer, screen, stage, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const NOW = Math.round(H * 0.34);
    const root = K.h("div", "sw");
    root.style.setProperty("--now", NOW + "px");
    root.innerHTML = `<div class="sw-stack">${groups.map((g, i) => `<button class="sw-card" data-i="${i}" style="--d:${(groups.length - i) * 0.035}s"><header>${icon(g.icon)}<span>${g.pages.length === 1 ? g.pages[0].label : g.label}</span><em>${g.pages.length === 1 ? "OPEN" : g.pages.length + " PAGES"}</em></header><div class="pv">${g.pages.slice(0, 5).map((p) => `<span>${p.label}</span>`).join("")}${g.pages.length > 5 ? `<span>+${g.pages.length - 5}</span>` : ""}</div></button>`).join("")}</div><div class="sw-now"><small>Back to your page</small></div><button class="sw-bar" aria-label="Open menu"><span>SWIPE UP</span><i></i></button>`;
    layer.append(root);
    stage.style.background = "#05060a";
    const stack = root.querySelector(".sw-stack");
    const scale = (NOW - 34) / H;
    screen.style.transition = "transform .55s cubic-bezier(.2,1,.3,1), border-radius .55s, box-shadow .55s";
    let open = false, full = null;
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      if (v) {
        screen.style.borderRadius = "30px";
        screen.style.boxShadow = "0 0 0 1px var(--lit-line), 0 20px 40px -10px #000";
        screen.style.transformOrigin = "50% 100%";
        screen.style.transform = `translateY(-10px) scale(${scale})`;
        requestAnimationFrame(() => (stack.scrollTop = stack.scrollHeight));
      } else {
        screen.style.transform = ""; screen.style.borderRadius = ""; screen.style.boxShadow = "";
        if (full) { full.remove(); full = null; }
      }
    }
    stack.querySelectorAll(".sw-card").forEach((c) => (c.onclick = () => {
      const g = groups[+c.dataset.i];
      if (g.pages.length === 1) return pick(g.pages[0]);
      const r = c.getBoundingClientRect(), lr = layer.getBoundingClientRect();
      full = K.h("div", "sw-full", `<button class="back">${icon("ArrowLeft")} ALL</button><h4>${icon(g.icon)}${g.label}</h4><ul>${g.pages.map((p, k) => `<li style="--i:${k}"><button data-k="${k}">${icon(p.icon)}<span>${p.label}</span></button></li>`).join("")}</ul>`);
      full.style.transform = `translate(${r.left - lr.left}px,${r.top - lr.top}px) scale(${r.width / W},${r.height / H})`;
      root.append(full);
      void full.offsetWidth;
      full.style.transition = "transform .5s cubic-bezier(.2,1,.3,1), border-radius .5s";
      full.style.transform = "none";
      full.querySelector(".back").onclick = () => { const f = full; full = null; f.style.transform = `translate(${r.left - lr.left}px,${r.top - lr.top}px) scale(${r.width / W},${r.height / H})`; f.style.opacity = "0"; f.style.transition += ", opacity .3s .2s"; setTimeout(() => f.remove(), 520); };
      full.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => pick(g.pages[+b.dataset.k])));
    }));
    root.querySelector(".sw-now").onclick = () => setOpen(false);
    const bar = root.querySelector(".sw-bar");
    const off = K.drag(bar, {
      move: ({ dy }) => { if (dy < 0 && !open) screen.style.transition = "none", (screen.style.transformOrigin = "50% 100%"), (screen.style.transform = `scale(${Math.max(scale, 1 + dy / (H * 1.4))})`); },
      up: ({ dy, moved }) => { screen.style.transition = "transform .55s cubic-bezier(.2,1,.3,1), border-radius .55s, box-shadow .55s"; if (!moved || dy < -40) setOpen(true); else setOpen(false); },
    });
    function pick(p) { setOpen(false); setTimeout(() => go(p), 300); }
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { off(); root.remove(); stage.style.background = ""; } };
  },
});

/* ───────────── Jelly Drawer ───────────── */
MENUS.main.push({
  id: "n-jelly", name: "Jelly Drawer", kind: "Elastic side drawer", fits: "main",
  desc: "A side drawer with a living edge. Pull it out and its edge bulges toward your finger like a stretched sheet, then wobbles flat when you let go. Sections slide in, and a section slides over to its pages.",
  how: "Drag the tab on the left edge (or tap it). Tap a section, then a page; drag the drawer back to close.",
  css: `
.jd-scrim{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
.jd.on .jd-scrim{pointer-events:auto}
.jd-drawer{position:absolute;top:0;bottom:0;left:0;width:var(--dw);background:linear-gradient(90deg,var(--bg),var(--surface));border-right:1.5px solid var(--accent);box-shadow:0 0 30px -12px var(--accent);will-change:transform;touch-action:none}
.jd-bump{position:absolute;left:100%;top:0;width:60px;height:320px;margin-left:-1px;transform-origin:0 50%;pointer-events:none;overflow:visible}
.jd-bump .f{fill:var(--surface)}
.jd-bump .s{fill:none;stroke:var(--accent);stroke-width:1.5;vector-effect:non-scaling-stroke}
.jd-tab{position:absolute;left:100%;top:50%;width:26px;height:84px;margin-top:-42px;border-radius:0 14px 14px 0;border:1px solid var(--lit-line);border-left:0;background:var(--lit);color:var(--accent);display:grid;place-items:center;box-shadow:var(--glow);touch-action:none}
.jd-tab i{width:3px;height:30px;border-radius:3px;background:currentColor;box-shadow:6px 0 0 currentColor}
.jd-pane{position:absolute;inset:0;overflow:hidden}
.jd-track{position:absolute;inset:0;width:200%;display:flex;transition:transform .45s var(--ease)}
.jd-track.sub{transform:translateX(-50%)}
.jd-col{width:50%;height:100%;overflow-y:auto;scrollbar-width:none;padding:60px 14px 20px 18px}
.jd-col h4{margin:0 0 4px;font-family:var(--font-mono);font-weight:500;font-size:10px;letter-spacing:.24em;color:var(--accent);text-transform:uppercase}
.jd-col h3{margin:0 0 14px;font-family:var(--font-display);font-weight:400;text-transform:uppercase;font-size:22px;line-height:1.05}
.jd-col button.r{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;border-bottom:1px solid color-mix(in srgb,var(--accent) 14%,transparent);font-weight:800;text-align:left;font-size:14.5px;opacity:0;transform:translateX(-24px)}
.jd.on .jd-col button.r{opacity:1;transform:none;transition:transform .5s var(--spring) calc(.12s + var(--i)*35ms),opacity .3s calc(.12s + var(--i)*35ms)}
.jd-col button.r .ic{color:var(--accent);font-size:19px}
.jd-col button.r em{margin-left:auto;font-style:normal;color:var(--muted)}
.jd-col .back{display:flex;align-items:center;gap:6px;color:var(--accent);font-family:var(--font-mono);font-size:11px;letter-spacing:.14em;margin-bottom:12px}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const DW = Math.round(Math.min(300, W * 0.82));
    const root = K.h("div", "jd");
    root.style.setProperty("--dw", DW + "px");
    const pts = [];
    for (let y = 0; y <= 320; y += 8) pts.push([60 * Math.exp(-(((y - 160) / 62) ** 2)), y]);
    const curve = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y}`).join("");
    root.innerHTML = `<div class="jd-scrim"></div><div class="jd-drawer"><svg class="jd-bump" viewBox="0 0 60 320" preserveAspectRatio="none"><path class="f" d="${curve}L0,320L0,0Z"/><path class="s" d="${curve}"/></svg><button class="jd-tab" aria-label="Open menu"><i></i></button><div class="jd-pane"><div class="jd-track"><div class="jd-col main"><h4>StormSync Weather</h4><h3>Menu</h3>${K.entries(groups).map((it, i) => `<button class="r" style="--i:${i}" data-i="${i}">${icon(it.icon)}<span>${it.label}</span><em>${it.page ? icon("ArrowUpRight") : icon("ChevronRight")}</em></button>`).join("")}</div><div class="jd-col sub"></div></div></div></div>`;
    layer.append(root);
    const drawer = root.querySelector(".jd-drawer"), bump = root.querySelector(".jd-bump"), scrim = root.querySelector(".jd-scrim"), track = root.querySelector(".jd-track"), sub = root.querySelector(".jd-col.sub"), tab = root.querySelector(".jd-tab");
    const X = K.spring(0, { k: 220, c: 24 }), B = K.spring(0, { k: 260, c: 9 });
    let by = H / 2, held = false, stop = null, open = false;
    const render = () => {
      drawer.style.transform = `translateX(${(X.value - DW).toFixed(1)}px)`;
      scrim.style.opacity = (0.6 * K.clamp(X.value / DW, 0, 1)).toFixed(3);
      bump.style.transform = `translateY(${(by - 160).toFixed(1)}px) scaleX(${Math.max(0.001, B.value / 60).toFixed(3)})`;
    };
    const run = () => {
      if (stop) return;
      stop = K.loop((dt) => {
        if (!held) X.step(dt);
        B.step(dt);
        render();
        if (!held && X.rest && B.rest) { stop = null; return false; }
      });
    };
    const offs = [];
    const grab = (el) => {
      let x0 = 0;
      offs.push(K.drag(el, {
        down: ({ y }) => { held = true; x0 = X.value; const r = layer.getBoundingClientRect(); by = K.clamp(y - r.top, 140, H - 140); run(); },
        move: ({ dx, y, vx }) => { const r = layer.getBoundingClientRect(); X.value = K.clamp(x0 + dx, 0, DW + 30); by = K.clamp(y - r.top, 140, H - 140); B.target = K.clamp(Math.abs(vx) * 0.04, 0, 58); },
        up: ({ moved, vx }) => {
          held = false; B.target = 0;
          if (!moved && el === tab) return setOpen(!open);
          if (!moved) return;
          setOpen(vx > 300 || (vx > -300 && X.value > DW * 0.45));
        },
      }));
    };
    grab(tab);
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      X.target = v ? DW : 0;
      B.v += v ? 700 : 350;
      tab.setAttribute("aria-label", v ? "Close menu" : "Open menu");
      if (!v) setTimeout(() => !open && track.classList.remove("sub"), 300);
      run();
    }
    root.querySelectorAll(".jd-col.main button.r").forEach((b) => (b.onclick = () => {
      const it = K.entries(groups)[+b.dataset.i];
      if (it.page) return pick(it.page);
      const g = it.sec;
      sub.innerHTML = `<button class="back">${icon("ArrowLeft")} MENU</button><h4>Section</h4><h3>${g.label}</h3>${g.pages.map((p, k) => `<button class="r" style="--i:${k}" data-k="${k}">${icon(p.icon)}<span>${p.label}</span><em>${icon("ChevronRight")}</em></button>`).join("")}`;
      sub.querySelector(".back").onclick = () => track.classList.remove("sub");
      sub.querySelectorAll("[data-k]").forEach((x) => (x.onclick = () => pick(g.pages[+x.dataset.k])));
      track.classList.add("sub");
      B.v += 300; run();
    }));
    let px0 = 0;
    offs.push(K.drag(root.querySelector(".jd-pane"), {
      down: ({ y }) => { px0 = X.value; const r = layer.getBoundingClientRect(); by = K.clamp(y - r.top, 140, H - 140); },
      move: ({ dx, dy, moved }) => { if (moved && dx < -12 && Math.abs(dx) > Math.abs(dy)) { held = true; X.value = K.clamp(px0 + dx, 0, DW); B.target = K.clamp(-dx * 0.08, 0, 30); run(); } },
      up: ({ vx }) => { if (held) { held = false; B.target = 0; setOpen(!(vx < -250 || X.value < DW * 0.6)); } },
    }, { threshold: 10 }));
    scrim.onclick = () => setOpen(false);
    function pick(p) { setOpen(false); setTimeout(() => go(p), 250); }
    render();
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { if (stop) stop(); offs.forEach((o) => o()); root.remove(); } };
  },
});
