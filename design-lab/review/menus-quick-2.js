/* New Quick Menus, part 2: Toast Stack, Ticker, Chat Heads, Card Catalog, Bubble Pop. */

/* ───────────── Toast Stack ───────────── */
MENUS.quick.push({
  id: "q-toast", name: "Toast Stack", kind: "Notification stack", fits: "quick",
  desc: "Your shortcuts arrive as a neat stack of notifications, the newest on top and the rest tucked behind it. A moment later the stack springs open into a list you can tap, the way the best phone notifications behave.",
  how: "Tap the Quick pill. Tap the stack to fan it open (it opens itself after a moment), then tap a shortcut.",
  css: `
.ts-bg{position:absolute;inset:0;background:linear-gradient(0deg,color-mix(in srgb,var(--bg) 92%,transparent),color-mix(in srgb,var(--bg) 40%,transparent));opacity:0;transition:opacity .3s;pointer-events:none}
.ts.on .ts-bg{opacity:1;pointer-events:auto}
.ts-stack{position:absolute;left:12px;right:12px;bottom:84px;height:62px;pointer-events:none}
.ts-t{position:absolute;left:0;right:0;bottom:0;height:62px;display:flex;align-items:center;gap:12px;padding:0 14px;border-radius:18px;border:1px solid var(--line);background:linear-gradient(180deg,var(--surface2),var(--surface));box-shadow:0 10px 24px -12px #000;color:var(--text);text-align:left;transform-origin:50% 100%;opacity:0;transform:translateY(80px) scale(.9);transition:transform .55s cubic-bezier(.22,1.25,.4,1),opacity .3s,border-color .2s;will-change:transform}
.ts-t .o{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;border:1px solid var(--lit-line);background:var(--lit);color:var(--accent);font-size:18px;flex:none}
.ts-t b{display:block;font-size:14px}
.ts-t small{display:block;color:var(--muted);font-size:11.5px}
.ts-t time{margin-left:auto;font-family:var(--font-mono);font-size:10px;color:var(--muted)}
.ts.on .ts-t{pointer-events:auto}
.ts-t:first-child{border-color:var(--lit-line)}
.ts-fab{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);height:44px;padding:0 16px 0 12px;border-radius:999px;border:1px solid var(--lit-line);background:var(--lit);color:var(--accent);font-weight:800;display:flex;align-items:center;gap:8px;box-shadow:var(--glow);z-index:3}
.ts-fab em{font-style:normal;font-family:var(--font-mono);font-size:11px;min-width:20px;height:20px;border-radius:10px;display:grid;place-items:center;background:var(--accent);color:var(--bg)}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const items = K.flat(groups);
    const root = K.h("div", "ts");
    root.innerHTML = `<div class="ts-bg"></div><div class="ts-stack">${items.map((it, i) => `<button class="ts-t" data-i="${i}"><span class="o">${icon(it.icon)}</span><span><b>${it.label}</b><small>${i < 3 ? "Always in your Quick Menu" : "Pinned by you"}</small></span><time>${i < 3 ? "fixed" : "pin"}</time></button>`).join("")}</div><button class="ts-fab" aria-label="Open menu">${icon("Layers")} Quick <em>${items.length}</em></button>`;
    layer.append(root);
    const ts = [...root.querySelectorAll(".ts-t")];
    let state = "closed", t = 0;
    function layout() {
      ts.forEach((el, i) => {
        el.style.zIndex = 100 - i;
        if (state === "closed") { el.style.opacity = "0"; el.style.transform = `translateY(${80 + i * 6}px) scale(.9)`; el.style.transitionDelay = (ts.length - i) * 0.02 + "s"; }
        else if (state === "stack") { el.style.opacity = i < 3 ? String(1 - i * 0.25) : "0"; el.style.transform = `translateY(${-i * 11}px) scale(${1 - i * 0.05})`; el.style.transitionDelay = i * 0.04 + "s"; }
        else { el.style.opacity = "1"; el.style.transform = `translateY(${-i * 70}px)`; el.style.transitionDelay = i * 0.035 + "s"; }
      });
    }
    function set(s) { state = s; root.classList.toggle("on", s !== "closed"); layout(); clearTimeout(t); if (s === "stack") t = setTimeout(() => state === "stack" && set("open"), 700); }
    ts.forEach((el, i) => (el.onclick = () => { if (state === "stack") return set("open"); set("closed"); setTimeout(() => go(items[i].page), 200); }));
    root.querySelector(".ts-fab").onclick = () => set(state === "closed" ? "stack" : "closed");
    root.querySelector(".ts-bg").onclick = () => set("closed");
    layout();
    return { open: () => set("stack"), close: () => set("closed"), destroy: () => { clearTimeout(t); root.remove(); } };
  },
});

/* ───────────── Ticker ───────────── */
MENUS.quick.push({
  id: "q-ticker", name: "Ticker", kind: "Scrolling marquee", fits: "quick",
  desc: "A slim ticker along the bottom of the screen scrolls your shortcuts past like a stock or sports crawl, always there without a button. Drag it to scrub; tap it and each shortcut jumps off the crawl into a grid.",
  how: "Watch the crawl at the bottom. Drag it to scrub, tap it to open the grid, tap a shortcut.",
  css: `
.tk-bg{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 82%,transparent);opacity:0;transition:opacity .3s;pointer-events:none}
.tk.on .tk-bg{opacity:1;pointer-events:auto}
.tk-bar{position:absolute;left:0;right:0;bottom:0;height:48px;border-top:1px solid var(--lit-line);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 7%,var(--surface)),var(--bg));overflow:hidden;touch-action:none;z-index:4;box-shadow:0 -8px 24px -12px var(--accent)}
.tk-bar::before{content:"QUICK";position:absolute;left:0;top:0;bottom:0;z-index:2;display:grid;place-items:center;padding:0 10px 0 12px;font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:var(--bg);background:var(--accent);clip-path:polygon(0 0,100% 0,82% 100%,0 100%)}
.tk-track{position:absolute;left:0;top:0;bottom:0;display:flex;align-items:center;white-space:nowrap;will-change:transform}
.tk-item{display:inline-flex;align-items:center;gap:7px;padding:0 16px;font-weight:800;font-size:13.5px;color:var(--text)}
.tk-item .ic{color:var(--accent)}
.tk-item::after{content:"";width:5px;height:5px;border-radius:50%;background:var(--accent);margin-left:16px;opacity:.6}
.tk-grid{position:absolute;left:12px;right:12px;bottom:62px;display:grid;grid-template-columns:1fr 1fr;gap:8px;pointer-events:none}
.tk-tile{display:flex;align-items:center;gap:10px;min-height:62px;padding:10px 12px;border-radius:16px;border:1px solid var(--lit-line);background:linear-gradient(160deg,var(--surface2),var(--surface));font-weight:800;font-size:13px;line-height:1.15;text-align:left;opacity:0;color:var(--text)}
.tk-tile .ic{color:var(--accent);font-size:20px;flex:none}
.tk.on .tk-tile{pointer-events:auto}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const items = K.flat(groups);
    const root = K.h("div", "tk");
    const strip = items.map((it, i) => `<span class="tk-item" data-i="${i}">${icon(it.icon)}${it.label}</span>`).join("");
    root.innerHTML = `<div class="tk-bg"></div><div class="tk-grid">${items.map((it, i) => `<button class="tk-tile" data-i="${i}">${icon(it.icon)}<span>${it.label}</span></button>`).join("")}</div><div class="tk-bar" role="button" aria-label="Open menu" tabindex="0"><div class="tk-track">${strip}${strip}</div></div>`;
    layer.append(root);
    const track = root.querySelector(".tk-track"), bar = root.querySelector(".tk-bar"), tiles = [...root.querySelectorAll(".tk-tile")];
    let x = 0, half = 0, paused = false, open = false;
    const measure = () => (half = track.scrollWidth / 2);
    measure();
    const stop = K.loop((dt) => {
      if (!paused && !open) x -= 42 * dt;
      if (half) { while (x <= -half) x += half; while (x > 0) x -= half; }
      track.style.transform = `translateX(${(x + 66).toFixed(1)}px)`;
    });
    let x0 = 0;
    const off = K.drag(bar, {
      down: () => { paused = true; x0 = x; },
      move: ({ dx }) => { x = x0 + dx; },
      up: ({ moved }) => { paused = false; if (!moved) setOpen(!open); },
    });
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      const br = bar.getBoundingClientRect();
      const src = [...track.querySelectorAll(".tk-item")];
      tiles.forEach((t, i) => {
        const r = t.getBoundingClientRect();
        const s = src.slice(0, items.length).concat(src.slice(items.length)).filter((el) => +el.dataset.i === i).map((el) => el.getBoundingClientRect()).sort((a, b) => Math.abs(a.left + a.width / 2 - (br.left + br.width / 2)) - Math.abs(b.left + b.width / 2 - (br.left + br.width / 2)))[0];
        const dx = s ? s.left - r.left : 0, dy = s ? s.top - r.top : 60;
        if (v) {
          t.style.transition = "none";
          t.style.transform = `translate(${dx}px,${dy}px) scale(.6)`;
          t.style.opacity = "0";
          void t.offsetWidth;
          t.style.transition = `transform .6s cubic-bezier(.25,1.3,.45,1) ${i * 0.05}s, opacity .3s ${i * 0.05}s`;
          t.style.transform = "none";
          t.style.opacity = "1";
        } else {
          t.style.transition = `transform .35s var(--ease) ${i * 0.02}s, opacity .25s ${i * 0.02}s`;
          t.style.transform = `translate(${dx}px,${dy}px) scale(.6)`;
          t.style.opacity = "0";
        }
      });
    }
    tiles.forEach((t, i) => (t.onclick = () => { setOpen(false); setTimeout(() => go(items[i].page), 250); }));
    root.querySelector(".tk-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { stop(); off(); root.remove(); } };
  },
});

/* ───────────── Chat Heads ───────────── */
MENUS.quick.push({
  id: "q-heads", name: "Chat Heads", kind: "Floating bubble chain", fits: "quick",
  desc: "A floating head you can park anywhere on the screen; drag it and your shortcuts trail behind it on a springy chain, then it snaps to the nearest edge. Tap it and the heads line up with name bubbles. Drop it on the × to tuck it away.",
  how: "Drag the round head around (watch the chain), let go, then tap it. Tap a head to open it.",
  css: `
.ch-bg{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 80%,transparent);opacity:0;transition:opacity .3s;pointer-events:none}
.ch.on .ch-bg{opacity:1;pointer-events:auto}
.ch-h{position:absolute;left:0;top:0;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--lit-line);background:radial-gradient(circle at 35% 30%,var(--surface2),var(--bg));color:var(--accent);font-size:22px;box-shadow:0 8px 18px -6px #000;will-change:transform;pointer-events:none;opacity:0;transition:opacity .2s}
.ch-h.main{width:60px;height:60px;border:1.5px solid var(--accent);box-shadow:0 10px 20px -6px #000,var(--glow);pointer-events:auto;opacity:1;z-index:10;touch-action:none}
.ch-h.main i{position:absolute;right:-2px;top:-2px;min-width:18px;height:18px;border-radius:9px;background:var(--accent);color:var(--bg);font-style:normal;font-family:var(--font-mono);font-size:10px;font-weight:600;display:grid;place-items:center}
.ch.on .ch-h,.ch.drag .ch-h{opacity:1}
.ch.on .ch-h{pointer-events:auto}
.ch-lbl{position:absolute;right:66px;top:50%;transform:translateY(-50%) translateX(8px);white-space:nowrap;padding:7px 12px;border-radius:14px 14px 4px 14px;background:var(--surface2);border:1px solid var(--line);color:var(--text);font-weight:800;font-size:12.5px;opacity:0;transition:opacity .25s,transform .35s var(--spring);pointer-events:none}
.ch.on .ch-lbl{opacity:1;transform:translateY(-50%)}
.ch.left .ch-lbl{right:auto;left:66px;border-radius:14px 14px 14px 4px}
.ch-x{position:absolute;left:50%;bottom:28px;width:56px;height:56px;margin-left:-28px;border-radius:50%;border:1px solid var(--line);background:#0009;color:var(--muted);display:grid;place-items:center;font-size:22px;opacity:0;transform:translateY(30px);transition:opacity .2s,transform .3s var(--spring),border-color .2s,color .2s;pointer-events:none}
.ch.drag .ch-x{opacity:1;transform:none}
.ch-x.hot{border-color:var(--bad);color:var(--bad);transform:scale(1.15)}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const items = K.flat(groups);
    const root = K.h("div", "ch");
    root.innerHTML = `<div class="ch-bg"></div><div class="ch-x">${icon("X")}</div>${items.map((it, i) => `<button class="ch-h" data-i="${i}">${icon(it.icon)}<span class="ch-lbl">${it.label}</span></button>`).join("")}<button class="ch-h main" aria-label="Open menu">${icon("MessageSquareText")}<i>${items.length}</i></button>`;
    layer.append(root);
    const heads = [...root.querySelectorAll(".ch-h:not(.main)")], main = root.querySelector(".ch-h.main"), xT = root.querySelector(".ch-x");
    const P = (x, y) => ({ x: K.spring(x, { k: 240, c: 22 }), y: K.spring(y, { k: 240, c: 22 }) });
    const M = P(W - 74, H * 0.42);
    const hs = heads.map(() => P(W - 71, H * 0.42 + 3));
    let open = false, held = false, stop = null, hidden = false, side = "right";
    const slot = (i) => (side === "right" ? { x: W - 71, y: 120 + (i + 1) * 64 } : { x: 17, y: 120 + (i + 1) * 64 });
    function step(dt) {
      if (!held) { M.x.step(dt); M.y.step(dt); }
      hs.forEach((h, i) => {
        if (open) { const s = slot(i); h.x.target = s.x; h.y.target = s.y; }
        else { const lead = i ? hs[i - 1] : M; h.x.target = lead.x.value + 3; h.y.target = lead.y.value + 3; }
        h.x.k = h.y.k = open ? 200 : 330 - i * 30; h.x.c = h.y.c = open ? 20 : 20;
        h.x.step(dt); h.y.step(dt);
        heads[i].style.transform = `translate(${h.x.value.toFixed(1)}px,${h.y.value.toFixed(1)}px)`;
        heads[i].style.zIndex = 9 - i;
      });
      main.style.transform = `translate(${M.x.value.toFixed(1)}px,${M.y.value.toFixed(1)}px) scale(${hidden ? 0 : 1})`;
    }
    const run = () => { if (!stop) stop = K.loop((dt) => { step(dt); const rest = !held && M.x.rest && M.y.rest && hs.every((h) => h.x.rest && h.y.rest); if (rest) { stop = null; return false; } }); };
    let ox = 0, oy = 0;
    const nearX = () => Math.hypot(M.x.value + 30 - W / 2, M.y.value + 30 - (H - 56)) < 70;
    const off = K.drag(main, {
      down: ({ x, y }) => { const r = layer.getBoundingClientRect(); ox = x - r.left - M.x.value; oy = y - r.top - M.y.value; },
      move: ({ x, y, moved }) => {
        if (!moved) return;
        if (open) setOpen(false);
        held = true; root.classList.add("drag");
        const r = layer.getBoundingClientRect();
        M.x.value = M.x.target = x - r.left - ox; M.y.value = M.y.target = y - r.top - oy;
        xT.classList.toggle("hot", nearX());
        run();
      },
      up: ({ moved, vx, vy }) => {
        root.classList.remove("drag");
        if (!moved) return setOpen(!open);
        held = false;
        if (nearX()) {
          hidden = true; xT.classList.remove("hot"); run();
          setTimeout(() => { hidden = false; M.x.value = W + 40; M.x.target = W - 74; M.y.target = H * 0.42; run(); }, 2200);
          return;
        }
        const tx = M.x.value + vx * 0.15;
        side = tx + 30 < W / 2 ? "left" : "right";
        root.classList.toggle("left", side === "left");
        M.x.target = side === "left" ? 14 : W - 74;
        M.y.target = K.clamp(M.y.value + vy * 0.15, 70, H - 140);
        M.x.v = vx; M.y.v = vy;
        run();
      },
    });
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      if (v) { M.x.target = side === "left" ? 14 : W - 74; M.y.target = 110; }
      run();
    }
    heads.forEach((h, i) => (h.onclick = () => { setOpen(false); setTimeout(() => go(items[i].page), 260); }));
    root.querySelector(".ch-bg").onclick = () => setOpen(false);
    step(0);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { if (stop) stop(); off(); root.remove(); } };
  },
});

/* ───────────── Card Catalog ───────────── */
MENUS.quick.push({
  id: "q-catalog", name: "Card Catalog", kind: "Index-card drawer", fits: "quick",
  desc: "A library card-catalog drawer slides up from the bottom, packed with index cards whose tabs show your shortcuts. Run a finger across the cards and each one tips up as you pass it, like flipping through a real drawer.",
  how: "Pull the brass handle up (or tap it). Slide a finger over the cards to flip through; tap the raised card to open it.",
  css: `
.cc-bg{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 78%,transparent);opacity:0;transition:opacity .3s;pointer-events:none}
.cc.on .cc-bg{opacity:1;pointer-events:auto}
.cc-drawer{position:absolute;left:18px;right:18px;bottom:0;height:var(--dh);transform:translateY(calc(var(--dh) - 70px));transition:transform .6s cubic-bezier(.25,1.15,.45,1)}
.cc.on .cc-drawer{transform:none}
.cc-box{position:absolute;left:0;right:0;top:0;bottom:70px;border-radius:14px 14px 0 0;background:linear-gradient(180deg,#0a0b10,#14151f);border:1px solid #2c2e40;border-bottom:0;box-shadow:inset 0 12px 20px -10px #000;perspective:700px;perspective-origin:50% -20%;overflow:hidden;touch-action:none}
.cc-card{position:absolute;left:14px;right:14px;height:150px;bottom:var(--b);border-radius:10px 10px 4px 4px;background:linear-gradient(180deg,#f1ead8,#ddd3bc);color:#2a2418;transform-origin:50% 100%;transform:rotateX(-24deg);transition:transform .35s cubic-bezier(.3,1.3,.5,1);box-shadow:0 -4px 10px -4px #0008;padding:30px 14px 10px;text-align:left}
.cc-card .tab{position:absolute;top:-1px;left:var(--tx);height:26px;padding:0 10px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#f7f1e2,#ece4cf);display:flex;align-items:center;gap:6px;font-weight:800;font-size:11.5px;transform:translateY(-24px);box-shadow:0 -2px 4px -2px #0006;white-space:nowrap}
.cc-card .tab .ic{color:#8a6a1f}
.cc-card .lines{position:absolute;left:14px;right:14px;top:56px;bottom:12px;background:repeating-linear-gradient(180deg,transparent 0 17px,#b8ad9466 17px 18px)}
.cc-card h5{position:relative;margin:0;font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px}
.cc-card h5 .ic{color:#8a6a1f}
.cc-card p{position:relative;margin:4px 0 0;font-family:var(--font-mono);font-size:10px;color:#6b604a}
.cc-card.up{transform:rotateX(4deg) translateY(-56px)}
.cc-card.out{transform:rotateX(0) translateY(-260px);transition:transform .45s cubic-bezier(.5,0,.8,.5)}
.cc-front{position:absolute;left:-6px;right:-6px;bottom:0;height:70px;border-radius:10px 10px 0 0;background:linear-gradient(180deg,#26283a,#181925);border:1px solid #34364a;box-shadow:0 -10px 24px -10px #000;display:grid;place-items:center;touch-action:none}
.cc-front .lab{position:absolute;top:10px;padding:3px 14px;border:1.5px solid var(--accent);border-radius:4px;font-family:var(--font-mono);font-size:10px;letter-spacing:.22em;color:var(--accent);background:#0006}
.cc-front .hd{position:absolute;bottom:12px;width:86px;height:16px;border-radius:0 0 12px 12px;border:2px solid var(--accent);border-top:0;box-shadow:0 0 12px -3px var(--accent)}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const H = layer.clientHeight;
    const items = K.flat(groups);
    const DH = Math.min(H - 110, 70 + 170 + items.length * 40);
    const root = K.h("div", "cc");
    root.style.setProperty("--dh", DH + "px");
    const tabs = [16, 120, 64, 160, 36, 100, 140, 24];
    root.innerHTML = `<div class="cc-bg"></div><div class="cc-drawer"><div class="cc-box">${items.map((it, i) => `<button class="cc-card" data-i="${i}" style="--b:${(items.length - 1 - i) * 40 - 92}px;--tx:${tabs[i % tabs.length]}px;z-index:${i}"><span class="tab">${icon(it.icon)}${it.label}</span><span class="lines"></span><h5>${icon(it.icon)}${it.label}</h5><p>QUICK · ${String(i + 1).padStart(2, "0")} · TAP TO OPEN</p></button>`).join("")}</div><div class="cc-front" role="button" aria-label="Open menu" tabindex="0"><span class="lab">QUICK</span><span class="hd"></span></div></div>`;
    layer.append(root);
    const box = root.querySelector(".cc-box"), cards = [...root.querySelectorAll(".cc-card")], front = root.querySelector(".cc-front");
    let open = false, up = -1;
    const raise = (i) => { if (i === up) return; up = i; cards.forEach((c, k) => c.classList.toggle("up", k === i)); if (i >= 0 && navigator.vibrate) try { navigator.vibrate(5); } catch (e) {} };
    const cardAt = (y) => {
      const r = box.getBoundingClientRect();
      for (let i = cards.length - 1; i >= 0; i--) { const b = cards[i].getBoundingClientRect(); if (y > b.top + 6 && y < r.bottom) return i; }
      return 0;
    };
    const off = K.drag(box, {
      down: ({ y }) => raise(cardAt(y)),
      move: ({ y }) => raise(cardAt(y)),
      up: ({ moved, e }) => { if (!moved) { const c = e.target.closest(".cc-card"); if (c && +c.dataset.i === up) pick(+c.dataset.i); else if (c) raise(+c.dataset.i); } },
    }, { threshold: 4 });
    function pick(i) { cards[i].classList.add("out"); setTimeout(() => { setOpen(false); go(items[i].page); }, 380); }
    function setOpen(v) { open = v; root.classList.toggle("on", v); if (!v) { raise(-1); cards.forEach((c) => c.classList.remove("out")); } else setTimeout(() => open && raise(cards.length - 1), 500); }
    let y0 = 0;
    const off2 = K.drag(front, { down: () => (y0 = 0), up: ({ dy, moved }) => { if (!moved || dy < -30) setOpen(!open || dy < -30); else if (dy > 30) setOpen(false); } });
    root.querySelector(".cc-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { off(); off2(); root.remove(); } };
  },
});

/* ───────────── Bubble Pop ───────────── */
MENUS.quick.push({
  id: "q-bubbles", name: "Bubble Pop", kind: "Floating soap bubbles", fits: "quick",
  desc: "Wave the wand and your shortcuts float out as shimmering soap bubbles that drift, wobble and nudge each other. Tap one and it pops in a spray of droplets as its page opens.",
  how: "Tap the wand. Watch them drift (you can push them); tap a bubble to pop it.",
  css: `
.bp-bg{position:absolute;inset:0;background:radial-gradient(80% 60% at 50% 40%,color-mix(in srgb,var(--accent2) 8%,var(--bg)),color-mix(in srgb,var(--bg) 94%,transparent));opacity:0;transition:opacity .4s;pointer-events:none}
.bp.on .bp-bg{opacity:1;pointer-events:auto}
.bp-b{position:absolute;left:0;top:0;width:var(--s);height:var(--s);margin:calc(var(--s) / -2) 0 0 calc(var(--s) / -2);border-radius:50%;display:grid;place-items:center;align-content:center;gap:3px;padding:12px;text-align:center;color:#fff;font-weight:800;font-size:11.5px;line-height:1.1;text-shadow:0 1px 4px #000c;will-change:transform;pointer-events:none;opacity:0}
.bp.on .bp-b{pointer-events:auto}
.bp-b::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 50%,transparent 58%,rgba(255,255,255,.08) 70%,rgba(255,255,255,.28) 100%),conic-gradient(from var(--rot,0deg),rgba(217,183,111,.42),rgba(169,176,214,.36),rgba(120,220,200,.26),rgba(232,140,190,.3),rgba(217,183,111,.42));-webkit-mask:radial-gradient(circle,transparent 52%,#000 74%);mask:radial-gradient(circle,transparent 52%,#000 74%);animation:bp-spin 7s linear infinite}
.bp-b::after{content:"";position:absolute;left:20%;top:14%;width:28%;height:18%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.85),transparent 70%);transform:rotate(-30deg)}
@property --rot{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes bp-spin{to{--rot:360deg}}
.bp-b .ic{font-size:20px;color:var(--accent);filter:drop-shadow(0 0 4px #000)}
.bp-b span{position:relative}
.bp-drop{position:absolute;left:0;top:0;width:6px;height:6px;margin:-3px;border-radius:50%;background:rgba(220,230,255,.85);pointer-events:none;animation:bp-drop .5s ease-out forwards}
@keyframes bp-drop{to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.bp-wand{position:absolute;right:16px;bottom:16px;width:56px;height:64px;color:var(--accent);z-index:3;filter:drop-shadow(0 0 8px color-mix(in srgb,var(--accent) 60%,transparent));transition:transform .4s var(--spring)}
.bp.on .bp-wand{transform:rotate(-25deg)}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const items = K.flat(groups);
    const root = K.h("div", "bp");
    root.innerHTML = `<div class="bp-bg"></div>${items.map((it, i) => `<button class="bp-b" data-i="${i}" style="--s:${96 + (i % 3) * 10}px">${icon(it.icon)}<span>${it.label}</span></button>`).join("")}<button class="bp-wand" aria-label="Open menu"><svg viewBox="0 0 56 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="34" cy="20" r="14"/><circle cx="34" cy="20" r="9" stroke-width="1" opacity=".5"/><path d="M24 30 8 58"/></svg></button>`;
    layer.append(root);
    const els = [...root.querySelectorAll(".bp-b")];
    const wx = W - 36, wy = H - 60;
    const bs = els.map((el, i) => ({ el, i, r: (96 + (i % 3) * 10) / 2, x: wx, y: wy, vx: 0, vy: 0, ph: Math.random() * 6.28, s: 0.2, born: 0, popped: false }));
    let stop = null, open = false, tm = 0;
    const draw = (b) => { const w = 1 + Math.sin(tm * 2.2 + b.ph) * 0.035; b.el.style.transform = `translate(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px) scale(${(b.s * w).toFixed(3)},${(b.s / w).toFixed(3)})`; };
    function frame(dt) {
      tm += dt;
      for (const b of bs) {
        if (b.popped) continue;
        b.s += (1 - b.s) * Math.min(1, dt * 3);
        b.el.style.opacity = String(Math.min(1, b.s * 1.4));
        const hx = W * (0.25 + 0.5 * ((b.i % 2) ? 0.85 : 0.15)) + Math.sin(tm * 0.4 + b.ph) * 30, hy = H * (0.22 + 0.12 * b.i) + Math.cos(tm * 0.5 + b.ph) * 20;
        b.vx += ((hx - b.x) * 1.8 + Math.sin(tm * 1.3 + b.ph) * 14) * dt;
        b.vy += ((hy - b.y) * 1.8 - 6) * dt;
        for (const c of bs) {
          if (c === b || c.popped) continue;
          const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy) || 1, m = (b.r + c.r) * 0.95;
          if (d < m) { const f = ((m - d) / m) * 260 * dt; b.vx += (dx / d) * f; b.vy += (dy / d) * f; }
        }
        b.vx *= Math.pow(0.35, dt); b.vy *= Math.pow(0.35, dt);
        b.x = K.clamp(b.x + b.vx * dt, b.r * 0.7, W - b.r * 0.7);
        b.y = K.clamp(b.y + b.vy * dt, 60 + b.r * 0.6, H - 90);
        draw(b);
      }
    }
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      if (v) {
        bs.forEach((b, k) => { b.popped = false; b.x = wx - 20; b.y = wy - 30; b.vx = -160 - k * 30 + Math.random() * 60; b.vy = -260 - Math.random() * 120; b.s = 0.15; b.el.style.opacity = "0"; b.el.style.transition = ""; });
        bs.forEach((b, k) => (b.hold = k * 0.18));
        tm = 0;
        if (!stop) stop = K.loop((dt) => {
          bs.forEach((b) => { if (b.hold > 0) { b.hold -= dt; b.x = wx - 20; b.y = wy - 30; b.s = 0.15; draw(b); b.el.style.opacity = "0"; } });
          frame(dt);
          if (!open) { stop = null; return false; }
        });
      } else bs.forEach((b) => { b.el.style.transition = "opacity .25s"; b.el.style.opacity = "0"; });
    }
    function pop(b) {
      b.popped = true;
      b.el.style.transition = "transform .18s ease-out, opacity .18s";
      b.el.style.transform = `translate(${b.x}px,${b.y}px) scale(1.3)`;
      b.el.style.opacity = "0";
      for (let k = 0; k < 10; k++) {
        const d = K.h("i", "bp-drop"), a = (k / 10) * 6.28;
        d.style.left = b.x + "px"; d.style.top = b.y + "px";
        d.style.setProperty("--dx", Math.cos(a) * (b.r + 24) + "px"); d.style.setProperty("--dy", Math.sin(a) * (b.r + 24) + "px");
        root.append(d); setTimeout(() => d.remove(), 520);
      }
      setTimeout(() => { setOpen(false); go(items[b.i].page); }, 280);
    }
    bs.forEach((b) => (b.el.onclick = () => pop(b)));
    root.querySelector(".bp-wand").onclick = () => setOpen(!open);
    root.querySelector(".bp-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { open = false; if (stop) stop(); root.remove(); } };
  },
});
