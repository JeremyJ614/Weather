/* New Quick Menus, part 1: Split-Flap, Joystick, Hanging Tags, Warp Tunnel, Keycaps. */

/* ───────────── Split-Flap ───────────── */
MENUS.quick.push({
  id: "q-flap", name: "Split-Flap", kind: "Departures board", fits: "quick",
  desc: "An old airport departures board. Your Quick Menu pages clatter into place letter by letter on mechanical flaps, each with its status. Tap one and its status flips to DEPARTED as you go.",
  how: "Tap the GO board at the bottom right. Tap a row to depart.",
  css: `
.sf-bg{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 70%,transparent);opacity:0;transition:opacity .3s;pointer-events:none}
.sf.on .sf-bg{opacity:1;pointer-events:auto}
.sf-board{position:absolute;left:8px;right:8px;bottom:84px;border-radius:16px;padding:12px 10px 10px;background:linear-gradient(180deg,#141520,#0b0c12);border:1px solid #2a2c3c;box-shadow:0 20px 40px -14px #000,inset 0 1px 0 #ffffff10;transform:translateY(30px) scale(.96);opacity:0;transition:transform .45s var(--ease),opacity .3s;pointer-events:none}
.sf.on .sf-board{transform:none;opacity:1;pointer-events:auto}
.sf-top{display:flex;justify-content:space-between;align-items:center;margin:0 4px 8px;font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:var(--accent)}
.sf-top b{color:var(--text);font-weight:600}
.sf-row{display:grid;grid-template-columns:22px 1fr;align-items:center;gap:6px;width:100%;padding:6px 4px;border-top:1px solid #ffffff0d;text-align:left}
.sf-row>.ic{color:var(--accent);font-size:16px}
.sf-cells{display:flex;flex-wrap:nowrap;gap:1.5px;overflow:hidden}
.sf-c{position:relative;flex:none;width:calc((var(--bw) - 46px) / 24 - 1.5px);height:22px;border-radius:2.5px;background:linear-gradient(180deg,#22232f 0 49%,#191a24 51% 100%);display:grid;place-items:center;font-family:var(--font-mono);font-weight:600;font-size:12px;color:#f3f1e6;box-shadow:inset 0 -1px 0 #0008}
.sf-c::after{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:#05060a}
.sf-c.f{animation:sf-f .09s linear}
@keyframes sf-f{50%{transform:scaleY(.15);filter:brightness(.6)}}
.sf-st{display:flex;gap:1.5px;margin-top:3px}
.sf-st .sf-c{height:15px;font-size:9px;color:var(--accent);width:calc((var(--bw) - 46px) / 24 - 1.5px)}
.sf-row.dep .sf-st .sf-c{color:var(--good)}
.sf-fab{position:absolute;right:12px;bottom:18px;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:10px;background:#11121a;border:1px solid var(--lit-line);box-shadow:var(--glow);color:var(--accent)}
.sf-fab .sf-c{width:16px;height:22px}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth;
    const items = K.flat(groups);
    const bag = K.bag();
    const root = K.h("div", "sf");
    const BW = W - 16 - 20;
    root.style.setProperty("--bw", BW + "px");
    const N = 24, NS = 9;
    const STAT = ["BOARDING", "ON TIME", "NOW OPEN", "ON TIME", "BOARDING", "ON TIME", "ON TIME", "BOARDING"];
    root.innerHTML = `<div class="sf-bg"></div><div class="sf-board"><div class="sf-top"><span>QUICK DEPARTURES</span><b class="clk"></b></div>${items.map((it, i) => `<button class="sf-row" data-i="${i}">${icon(it.icon)}<span><span class="sf-cells">${"<span class='sf-c'></span>".repeat(N)}</span><span class="sf-st">${"<span class='sf-c'></span>".repeat(NS)}</span></span></button>`).join("")}</div><button class="sf-fab" aria-label="Open menu">${icon("Plane")}<span class="sf-c">G</span><span class="sf-c">O</span></button>`;
    layer.append(root);
    const clk = root.querySelector(".clk");
    const tick = () => (clk.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const clkT = setInterval(tick, 10000);
    bag.add(() => clearInterval(clkT));
    const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ&·0123456789";
    function flipTo(cell, ch, delay, steps) {
      let n = K.reduce ? 0 : steps;
      const step = () => {
        cell.classList.remove("f"); void cell.offsetWidth; cell.classList.add("f");
        bag.timer(() => (cell.textContent = n > 0 ? CH[(Math.random() * CH.length) | 0] : ch), 45);
        if (n-- > 0) bag.timer(step, 90);
      };
      bag.timer(step, delay);
    }
    const rows = [...root.querySelectorAll(".sf-row")];
    function spell(row, text, stat, d0) {
      const cells = row.querySelectorAll(".sf-cells .sf-c"), st = row.querySelectorAll(".sf-st .sf-c");
      const t = text.toUpperCase().padEnd(N).slice(0, N);
      cells.forEach((c, k) => { if (c.textContent !== t[k]) flipTo(c, t[k] === " " ? "" : t[k], d0 + k * 22, t[k] === " " ? 1 : 3 + ((k * 7) % 5)); });
      const s = stat.padEnd(NS).slice(0, NS);
      st.forEach((c, k) => flipTo(c, s[k] === " " ? "" : s[k], d0 + 200 + k * 30, 2 + (k % 3)));
    }
    let open = false;
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      bag.clear();
      if (v) rows.forEach((r, i) => { r.classList.remove("dep"); spell(r, items[i].label, STAT[i % STAT.length], 150 + i * 110); });
      else rows.forEach((r) => r.querySelectorAll(".sf-c").forEach((c) => (c.textContent = "")));
    }
    rows.forEach((r, i) => (r.onclick = () => {
      r.classList.add("dep");
      spell(r, items[i].label, "DEPARTED", 0);
      setTimeout(() => { setOpen(false); go(items[i].page); }, 700);
    }));
    root.querySelector(".sf-fab").onclick = () => setOpen(!open);
    root.querySelector(".sf-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { bag.clear(); clearInterval(clkT); root.remove(); } };
  },
});

/* ───────────── Joystick ───────────── */
MENUS.quick.push({
  id: "q-stick", name: "Joystick", kind: "Gesture flick menu", fits: "quick",
  desc: "A one-thumb gesture menu. Press the stick and push it toward a shortcut: the one you're aiming at lights up and a beam reaches for it; let go to open it. Muscle memory makes it the fastest menu here.",
  how: "Press and hold the stick button, flick toward a page and let go. Or tap the button, then tap a page or push the stick in the middle.",
  css: `
.js-bg{position:absolute;inset:0;background:radial-gradient(60% 45% at 50% 50%,color-mix(in srgb,var(--accent) 9%,var(--bg)),color-mix(in srgb,var(--bg) 92%,transparent));opacity:0;transition:opacity .3s;pointer-events:none}
.js.on .js-bg{opacity:1;pointer-events:auto}
.js-ring{position:absolute;left:50%;top:48%;width:0;height:0;pointer-events:none}
.js-it{position:absolute;left:0;top:0;width:96px;margin:-30px 0 0 -48px;min-height:60px;display:grid;justify-items:center;gap:4px;padding:8px 6px;border-radius:16px;border:1px solid var(--line);background:var(--surface);font-weight:800;font-size:11px;line-height:1.15;text-align:center;color:var(--text);opacity:0;transform:translate(0,0) scale(.3);transition:transform .5s cubic-bezier(.3,1.4,.5,1) var(--d),opacity .25s var(--d),border-color .15s,box-shadow .15s}
.js-it .ic{color:var(--accent);font-size:18px}
.js.on .js-it{opacity:1;transform:translate(var(--x),var(--y));pointer-events:auto}
.js-it.hot{border-color:var(--accent);box-shadow:0 0 22px -4px var(--accent);transform:translate(var(--x),var(--y)) scale(1.14)!important;transition-delay:0s!important}
.js-base{position:absolute;left:-62px;top:-62px;width:124px;height:124px;border-radius:50%;border:1px solid var(--lit-line);background:radial-gradient(circle,var(--surface2),var(--bg) 70%);box-shadow:inset 0 0 20px #000,0 0 30px -12px var(--accent);opacity:0;transform:scale(.4);transition:transform .45s var(--spring),opacity .25s;touch-action:none}
.js.on .js-base{opacity:1;transform:none;pointer-events:auto}
.js-base::before{content:"";position:absolute;inset:16px;border-radius:50%;border:1px dashed color-mix(in srgb,var(--accent) 35%,transparent)}
.js-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 35%,var(--surface2)),var(--surface) 70%);border:1.5px solid var(--accent);box-shadow:0 8px 16px -6px #000,0 0 16px -4px var(--accent);transition:transform .35s var(--spring)}
.js-knob.held{transition:none}
.js-beam{position:absolute;left:0;top:0;width:var(--len,0px);height:2px;margin-top:-1px;transform-origin:0 50%;background:linear-gradient(90deg,var(--accent),transparent);opacity:0;transition:opacity .15s;filter:drop-shadow(0 0 4px var(--accent))}
.js-beam.on{opacity:1}
.js-fab{position:absolute;right:16px;bottom:18px;width:58px;height:58px;border-radius:50%;border:1.5px solid var(--accent);background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 22%,var(--surface2)),var(--bg) 75%);box-shadow:var(--glow),inset 0 0 12px #000;display:grid;place-items:center;color:var(--accent);font-size:22px;touch-action:none;z-index:3}
.js-fab::after{content:"";position:absolute;inset:-7px;border-radius:50%;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent)}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const items = K.flat(groups);
    const root = K.h("div", "js");
    const RR = Math.min(W * 0.36, 140);
    root.innerHTML = `<div class="js-bg"></div><div class="js-ring"><span class="js-beam"></span>${items.map((it, i) => {
      const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
      return `<button class="js-it" data-i="${i}" style="--x:${(Math.cos(a) * RR).toFixed(1)}px;--y:${(Math.sin(a) * RR * 1.08).toFixed(1)}px;--d:${i * 0.04}s">${icon(it.icon)}<span>${it.label}</span></button>`;
    }).join("")}<div class="js-base"><i class="js-knob"></i></div></div><button class="js-fab" aria-label="Open menu">${icon("Gamepad2")}</button>`;
    layer.append(root);
    const its = [...root.querySelectorAll(".js-it")], knob = root.querySelector(".js-knob"), beam = root.querySelector(".js-beam"), base = root.querySelector(".js-base");
    let open = false, hot = -1;
    function aim(dx, dy) {
      const d = Math.hypot(dx, dy), m = 44, k = d > m ? m / d : 1;
      knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
      let best = -1;
      if (d > 18) {
        const a = Math.atan2(dy, dx);
        let bd = 9;
        items.forEach((_, i) => {
          const ia = (i / items.length) * Math.PI * 2 - Math.PI / 2;
          const diff = Math.abs(Math.atan2(Math.sin(a - ia), Math.cos(a - ia)));
          if (diff < bd) { bd = diff; best = i; }
        });
      }
      if (best !== hot) {
        hot = best;
        its.forEach((b, i) => b.classList.toggle("hot", i === hot));
        if (hot >= 0) {
          const ia = (hot / items.length) * Math.PI * 2 - Math.PI / 2;
          beam.style.setProperty("--len", RR - 20 + "px");
          beam.style.transform = `rotate(${(Math.atan2(Math.sin(ia) * 1.08, Math.cos(ia)) * 180) / Math.PI}deg)`;
        }
        beam.classList.toggle("on", hot >= 0);
        if (hot >= 0 && navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
      }
    }
    function release() {
      knob.classList.remove("held");
      knob.style.transform = "";
      const h = hot;
      aim(0, 0);
      if (h >= 0) pick(items[h].page);
    }
    function setOpen(v) { open = v; root.classList.toggle("on", v); if (!v) { hot = -1; its.forEach((b) => b.classList.remove("hot")); beam.classList.remove("on"); } }
    function pick(p) { setOpen(false); setTimeout(() => go(p), 220); }
    const offs = [];
    offs.push(K.drag(root.querySelector(".js-fab"), {
      down: () => { if (!open) setOpen(true); knob.classList.add("held"); },
      move: ({ dx, dy, moved }) => moved && aim(dx * 1.3, dy * 1.3),
      up: ({ moved }) => { if (moved) { if (hot >= 0) release(); else { knob.classList.remove("held"); aim(0, 0); setOpen(false); } } else { knob.classList.remove("held"); } },
    }, { threshold: 4 }));
    offs.push(K.drag(base, {
      down: () => knob.classList.add("held"),
      move: ({ dx, dy }) => aim(dx, dy),
      up: () => release(),
    }, { threshold: 2 }));
    its.forEach((b, i) => (b.onclick = () => pick(items[i].page)));
    root.querySelector(".js-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { offs.forEach((o) => o()); root.remove(); } };
  },
});

/* ───────────── Hanging Tags ───────────── */
MENUS.quick.push({
  id: "q-tags", name: "Hanging Tags", kind: "Pendulum physics", fits: "quick",
  desc: "Pull the cord and your shortcuts drop from a brass rail on strings, swinging and settling like real tags. Bat one with a finger and it swings; tap one and it's yanked up as the page opens.",
  how: "Pull the gold bead down (or tap it). Swipe across the tags to swing them; tap one to open it.",
  css: `
.ht-bg{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--bg) 96%,transparent),color-mix(in srgb,var(--bg) 85%,transparent));opacity:0;transition:opacity .35s;pointer-events:none}
.ht.on .ht-bg{opacity:1;pointer-events:auto}
.ht-rail{position:absolute;left:14px;right:14px;top:60px;height:4px;border-radius:3px;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 80%,#fff),color-mix(in srgb,var(--accent) 60%,#000));box-shadow:0 2px 6px #000;transform:scaleX(0);transition:transform .45s var(--ease)}
.ht.on .ht-rail{transform:none}
.ht-rail::before,.ht-rail::after{content:"";position:absolute;top:-4px;width:12px;height:12px;border-radius:50%;background:var(--accent)}
.ht-rail::before{left:-6px}.ht-rail::after{right:-6px}
.ht-w{position:absolute;top:62px;left:0;width:0;height:0;transform-origin:0 0;pointer-events:none}
.ht-drop{transform:translateY(-110vh);transition:transform .9s cubic-bezier(.25,1.3,.5,1) var(--d)}
.ht.on .ht-drop{transform:none}
.ht-drop.yank{transform:translateY(-110vh)!important;transition:transform .45s cubic-bezier(.6,0,.9,.4)!important}
.ht-str{position:absolute;left:-1px;top:0;width:2px;height:var(--L);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 70%,#fff),color-mix(in srgb,var(--accent) 40%,transparent))}
.ht-tag{position:absolute;left:-56px;top:var(--L);width:112px;min-height:66px;padding:16px 8px 8px;border-radius:12px 12px 14px 14px;background:linear-gradient(170deg,var(--surface2),var(--surface));border:1px solid color-mix(in srgb,var(--accent) 50%,var(--line));box-shadow:0 14px 20px -10px #000;display:grid;justify-items:center;gap:3px;font-weight:800;font-size:11.5px;line-height:1.15;text-align:center;color:var(--text);pointer-events:auto;touch-action:none}
.ht-tag::before{content:"";position:absolute;top:6px;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:50%;border:1.5px solid var(--accent);background:var(--bg)}
.ht-tag .ic{color:var(--accent);font-size:17px}
.ht-cord{position:absolute;right:30px;top:0;width:24px;height:140px;touch-action:none;z-index:4}
.ht-cord i{position:absolute;left:11px;top:0;width:2px;height:96px;background:color-mix(in srgb,var(--accent) 70%,#fff);transform-origin:top;transform:scaleY(var(--s,1))}
.ht-cord b{position:absolute;left:1px;top:92px;width:22px;height:30px;border-radius:11px 11px 12px 12px;background:radial-gradient(circle at 35% 30%,#fff6,transparent 45%),linear-gradient(180deg,color-mix(in srgb,var(--accent) 90%,#fff),color-mix(in srgb,var(--accent) 55%,#000));box-shadow:0 0 14px -2px var(--accent);transform:translateY(var(--p,0px))}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth;
    const items = K.flat(groups);
    const root = K.h("div", "ht");
    const per = Math.ceil(items.length / 2);
    const tags = items.map((it, i) => {
      const row = i < per ? 0 : 1, col = row ? i - per : i, n = row ? items.length - per : per;
      return { it, x: 14 + ((W - 28) * (col + 0.5)) / n, L: row ? 190 : 62, th: 0, w: 0, held: false };
    });
    root.innerHTML = `<div class="ht-bg"></div><div class="ht-rail"></div>${tags.map((t, i) => `<div class="ht-drop" style="--d:${0.08 + i * 0.07}s"><div class="ht-w" style="left:${t.x}px;--L:${t.L}px"><i class="ht-str"></i><button class="ht-tag" data-i="${i}">${icon(t.it.icon)}<span>${t.it.label}</span></button></div></div>`).join("")}<div class="ht-cord" role="button" aria-label="Open menu" tabindex="0"><i></i><b></b></div>`;
    layer.append(root);
    const wraps = [...root.querySelectorAll(".ht-w")], drops = [...root.querySelectorAll(".ht-drop")], cord = root.querySelector(".ht-cord");
    let stop = null, open = false;
    const run = () => {
      if (stop) return;
      stop = K.loop((dt) => {
        let moving = false;
        tags.forEach((t, i) => {
          if (!t.held) {
            const n = Math.max(1, Math.ceil(dt / 0.004)), d = dt / n;
            for (let k = 0; k < n; k++) { const a = -(2600 / (t.L + 40)) * Math.sin(t.th) - 1.1 * t.w; t.w += a * d; t.th += t.w * d; }
          }
          if (Math.abs(t.th) > 0.002 || Math.abs(t.w) > 0.01 || t.held) moving = true;
          wraps[i].style.transform = `rotate(${t.th.toFixed(4)}rad)`;
        });
        if (!moving) { stop = null; return false; }
      });
    };
    const offs = [];
    root.querySelectorAll(".ht-tag").forEach((b) => {
      const t = tags[+b.dataset.i];
      offs.push(K.drag(b, {
        down: () => { t.w = 0; },
        move: ({ dx, moved }) => { if (moved) { t.held = true; t.th = Math.atan2(dx, t.L + 50); run(); } },
        up: ({ moved, vx }) => {
          if (!moved) { drops[+b.dataset.i].classList.add("yank"); setTimeout(() => { setOpen(false); go(t.it.page); }, 380); return; }
          t.held = false; t.w = vx / (t.L + 60); run();
        },
      }));
    });
    let pull = 0;
    offs.push(K.drag(cord, {
      move: ({ dy }) => { pull = K.clamp(dy, 0, 80); cord.style.setProperty("--p", pull + "px"); cord.style.setProperty("--s", (96 + pull) / 96); },
      up: ({ moved }) => {
        const was = pull; pull = 0;
        cord.style.transition = "none";
        const sp = K.spring(was, { k: 300, c: 10 }); sp.target = 0;
        const st = K.loop((dt) => { const v = sp.step(dt); cord.style.setProperty("--p", v + "px"); cord.style.setProperty("--s", (96 + v) / 96); if (sp.rest) return false; });
        offs.push(st);
        if (!moved || was > 35) setOpen(!open);
      },
    }, { threshold: 3 }));
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      drops.forEach((d) => d.classList.remove("yank"));
      if (v) { tags.forEach((t, i) => { t.th = (i % 2 ? 1 : -1) * Math.min(0.35, Math.asin((26 + Math.random() * 18) / (t.L + 40))); t.w = 0; }); setTimeout(run, 300); }
    }
    root.querySelector(".ht-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { if (stop) stop(); offs.forEach((o) => o && o()); root.remove(); } };
  },
});

/* ───────────── Warp Tunnel ───────────── */
MENUS.quick.push({
  id: "q-warp", name: "Warp Tunnel", kind: "3D depth flight", fits: "quick",
  desc: "Your shortcuts wait at different depths down a tunnel of light. Open it and you jump to warp as stars streak past; swipe to fly forward and back through them. The one closest ahead glows; tap it to warp there.",
  how: "Tap the button. Swipe up to fly forward, down to back up; tap the glowing card.",
  css: `
.wt{position:absolute;inset:0;pointer-events:none}
.wt-view{position:absolute;inset:0;background:#030409;opacity:0;transition:opacity .35s;pointer-events:none;touch-action:none;overflow:hidden}
.wt.on .wt-view{opacity:1;pointer-events:auto}
.wt-view canvas{position:absolute;inset:0;width:100%;height:100%}
.wt-3d{position:absolute;inset:0;perspective:420px;perspective-origin:50% 46%}
.wt-it{position:absolute;left:50%;top:46%;width:150px;margin:-34px 0 0 -75px;min-height:68px;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:16px;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);background:color-mix(in srgb,var(--surface) 85%,transparent);color:var(--text);font-weight:800;font-size:13px;line-height:1.15;text-align:left;will-change:transform,opacity;backface-visibility:hidden}
.wt-it .ic{color:var(--accent);font-size:22px}
.wt-it.focus{border-color:var(--accent);box-shadow:0 0 30px -6px var(--accent);background:color-mix(in srgb,var(--surface2) 92%,transparent)}
.wt-hud{position:absolute;left:0;right:0;bottom:22px;display:flex;justify-content:center;gap:8px;font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:var(--muted)}
.wt-hud button{height:40px;padding:0 14px;border-radius:12px;border:1px solid var(--lit-line);color:var(--accent);background:#0008;display:flex;align-items:center;gap:6px;font-family:var(--font-body);font-weight:800;letter-spacing:0;font-size:13px}
.wt-fab{position:absolute;right:14px;bottom:18px;width:56px;height:56px;border-radius:50%;border:1px solid var(--lit-line);background:radial-gradient(circle,var(--lit) 0 40%,transparent 41% 54%,var(--lit) 55%);color:var(--accent);display:grid;place-items:center;font-size:20px;box-shadow:var(--glow);pointer-events:auto;z-index:3}
.wt.on .wt-fab{opacity:0;pointer-events:none}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const W = layer.clientWidth, H = layer.clientHeight;
    const items = K.flat(groups);
    const root = K.h("div", "wt");
    root.innerHTML = `<div class="wt-view"><canvas></canvas><div class="wt-3d">${items.map((it, i) => `<button class="wt-it" data-i="${i}">${icon(it.icon)}<span>${it.label}</span></button>`).join("")}</div><div class="wt-hud"><button data-a="back">${icon("ChevronDown")} Back</button><button data-a="x">${icon("X")} Close</button></div></div><button class="wt-fab" aria-label="Open menu">${icon("Rocket")}</button>`;
    layer.append(root);
    const view = root.querySelector(".wt-view"), cv = root.querySelector("canvas"), els = [...root.querySelectorAll(".wt-it")];
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    const D = 260, RR = Math.min(W, H) * 0.2;
    const cam = K.spring(0, { k: 90, c: 17 });
    const stars = Array.from({ length: 260 }, () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random() }));
    const accent = getComputedStyle(root).getPropertyValue("--accent").trim() || "#d9b76f";
    let speed = 0.08, burst = 0, stop = null, open = false, lastCam = 0;
    const place = () => {
      const c = cam.value;
      let best = -1, bz = -1e9;
      els.forEach((el, i) => {
        const z = -i * D - 90 + c;
        const a = (i / items.length) * Math.PI * 2 * 1.5 + 0.6;
        const x = Math.cos(a) * RR, y = Math.sin(a) * RR * 1.2;
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px)`;
        el.style.opacity = z > 300 ? "0" : String(K.clamp(1 - (-z - 600) / 900, 0.08, 1) * K.clamp((300 - z) / 120, 0, 1));
        el.style.pointerEvents = z > 250 ? "none" : "auto";
        if (z < 120 && z > bz) { bz = z; best = i; }
      });
      els.forEach((el, i) => el.classList.toggle("focus", i === best));
    };
    const frame = (dt) => {
      cam.step(dt);
      const v = Math.abs(cam.value - lastCam) / Math.max(dt, 0.001); lastCam = cam.value;
      speed += (0.06 + v * 0.0022 + burst - speed) * Math.min(1, dt * 6);
      burst *= Math.pow(0.02, dt);
      g.fillStyle = "rgba(3,4,9,.35)"; g.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.46, f = Math.min(W, H) * 0.6;
      g.lineCap = "round";
      for (const s of stars) {
        const z0 = s.z;
        s.z -= speed * dt;
        if (s.z <= 0.02) { s.x = (Math.random() - 0.5) * 2; s.y = (Math.random() - 0.5) * 2; s.z = 1; continue; }
        const x0 = cx + (s.x / z0) * f * 0.5, y0 = cy + (s.y / z0) * f * 0.5, x1 = cx + (s.x / s.z) * f * 0.5, y1 = cy + (s.y / s.z) * f * 0.5;
        const a = K.clamp(1.2 - s.z, 0, 1);
        g.strokeStyle = s.z < 0.3 ? accent : `rgba(236,238,245,${a.toFixed(2)})`;
        g.globalAlpha = a;
        g.lineWidth = Math.max(0.6, (1 - s.z) * 2.4);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      g.globalAlpha = 1;
      place();
    };
    const start = () => { if (!stop) stop = K.loop((dt) => { frame(dt); if (!open && burst < 0.01) { stop = null; return false; } }); };
    let c0 = 0;
    const max = (items.length - 1) * D + 20;
    const off = K.drag(view, {
      down: () => { c0 = cam.target; },
      move: ({ dy, moved }) => { if (moved) cam.target = K.clamp(c0 - dy * 2.2, 0, max); },
      up: ({ moved, vy, e }) => {
        if (!moved) { const b = e.target.closest(".wt-it"); if (b) { const p = items[+b.dataset.i].page; burst = 2.4; setTimeout(() => { setOpen(false); go(p); }, 380); } return; }
        cam.target = K.clamp(cam.target - vy * 0.5, 0, max);
      },
    }, { threshold: 8 });
    const onWheel = (e) => { e.preventDefault(); cam.target = K.clamp(cam.target + e.deltaY * 1.4, 0, max); };
    view.addEventListener("wheel", onWheel, { passive: false });
    root.querySelector('[data-a="back"]').onclick = () => (cam.target = Math.max(0, cam.target - D));
    root.querySelector('[data-a="x"]').onclick = () => setOpen(false);
    function setOpen(v) {
      open = v;
      root.classList.toggle("on", v);
      if (v) { cam.value = -1600; cam.target = 0; cam.v = 0; burst = 1.6; g.fillStyle = "#030409"; g.fillRect(0, 0, W, H); start(); }
    }
    place();
    root.querySelector(".wt-fab").onclick = () => setOpen(true);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { if (stop) stop(); off(); root.remove(); } };
  },
});

/* ───────────── Keycaps ───────────── */
MENUS.quick.push({
  id: "q-keys", name: "Keycaps", kind: "Mechanical keyboard", fits: "quick",
  desc: "Your shortcuts as chunky mechanical keycaps on a tilted metal plate, with a light sweeping under them. Each key presses down with real travel; on a keyboard, the number keys work too.",
  how: "Tap the key button. Press a keycap (or 1–6 on a keyboard).",
  css: `
.kc-bg{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 78%,transparent);opacity:0;transition:opacity .3s;pointer-events:none}
.kc.on .kc-bg{opacity:1;pointer-events:auto}
.kc-wrap{position:absolute;left:12px;right:12px;bottom:92px;perspective:900px;pointer-events:none}
.kc-plate{position:relative;padding:28px 14px 16px;border-radius:22px;background:linear-gradient(180deg,#24263a,#14151f);border:1px solid #34364a;box-shadow:0 30px 50px -18px #000,inset 0 1px 0 #ffffff14;transform-origin:50% 100%;transform:rotateX(64deg) translateY(120px);opacity:0;transition:transform .65s cubic-bezier(.25,1.2,.45,1),opacity .3s}
.kc.on .kc-plate{transform:rotateX(22deg);opacity:1;pointer-events:auto}
.kc-plate::before{content:"";position:absolute;left:18px;right:18px;top:11px;height:4px;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent2),var(--accent));background-size:200% 100%;animation:kc-led 3s linear infinite;box-shadow:0 0 10px var(--accent)}
@keyframes kc-led{to{background-position:200% 0}}
.kc-plate i.sc{position:absolute;width:7px;height:7px;border-radius:50%;background:#3a3c50;box-shadow:inset 0 1px 1px #000}
.kc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.kc-key{position:relative;height:84px;border-radius:12px;background:#0d0e14;transform:translateY(-30px);opacity:0;transition:transform .5s cubic-bezier(.3,1.5,.5,1) var(--d),opacity .3s var(--d)}
.kc.on .kc-key{transform:none;opacity:1}
.kc-key::after{content:"";position:absolute;inset:6px -2px -6px;border-radius:14px;background:var(--glowc,var(--accent));filter:blur(10px);opacity:.0;animation:kc-under 3.2s ease-in-out infinite;animation-delay:calc(var(--i)*.22s);z-index:-1}
.kc.on .kc-key::after{opacity:.35}
@keyframes kc-under{0%,100%{opacity:.08}40%{opacity:.5}}
.kc-cap{position:absolute;inset:0 0 7px;border-radius:12px;background:linear-gradient(180deg,#2f3146,#202232);box-shadow:0 7px 0 #0b0c12,0 9px 12px -2px #000,inset 0 1px 0 #ffffff1c;display:grid;justify-items:center;align-content:center;gap:4px;padding:6px;color:var(--text);font-weight:800;font-size:11px;line-height:1.1;text-align:center;transition:transform .07s,box-shadow .07s}
.kc-cap::before{content:"";position:absolute;inset:7px 8px 10px;border-radius:9px;background:linear-gradient(180deg,#ffffff0c,transparent);pointer-events:none}
.kc-cap .ic{color:var(--accent);font-size:20px}
.kc-cap em{position:absolute;left:8px;top:6px;font-style:normal;font-family:var(--font-mono);font-size:9px;color:var(--muted)}
.kc-key:active .kc-cap,.kc-key.down .kc-cap{transform:translateY(6px);box-shadow:0 1px 0 #0b0c12,0 2px 4px -1px #000,inset 0 1px 0 #ffffff12}
.kc-fab{position:absolute;right:14px;bottom:18px;width:58px;height:58px;border-radius:12px;background:#0d0e14;z-index:3}
.kc-fab span{position:absolute;inset:0 0 6px;border-radius:12px;background:linear-gradient(180deg,#2f3146,#202232);box-shadow:0 6px 0 #0b0c12,0 0 16px -4px var(--accent),inset 0 1px 0 #ffffff1c;display:grid;place-items:center;color:var(--accent);font-size:22px;transition:transform .07s,box-shadow .07s}
.kc-fab:active span{transform:translateY(5px);box-shadow:0 1px 0 #0b0c12}
`,
  build(ctx) {
    const { layer, groups, go } = ctx;
    const items = K.flat(groups).slice(0, 9);
    const root = K.h("div", "kc");
    root.innerHTML = `<div class="kc-bg"></div><div class="kc-wrap"><div class="kc-plate"><i class="sc" style="left:9px;top:9px"></i><i class="sc" style="right:9px;top:9px"></i><i class="sc" style="left:9px;bottom:9px"></i><i class="sc" style="right:9px;bottom:9px"></i><div class="kc-grid">${items.map((it, i) => `<button class="kc-key" data-i="${i}" style="--i:${i};--d:${0.12 + i * 0.05}s;--glowc:${i % 2 ? "var(--accent2)" : "var(--accent)"}"><span class="kc-cap"><em>${i + 1}</em>${icon(it.icon)}<span>${it.label}</span></span></button>`).join("")}</div></div></div><button class="kc-fab" aria-label="Open menu"><span>${icon("Command")}</span></button>`;
    layer.append(root);
    const keys = [...root.querySelectorAll(".kc-key")];
    let open = false;
    function setOpen(v) { open = v; root.classList.toggle("on", v); }
    function pick(i) {
      const k = keys[i];
      k.classList.add("down");
      setTimeout(() => k.classList.remove("down"), 140);
      setTimeout(() => { setOpen(false); go(items[i].page); }, 200);
    }
    keys.forEach((k, i) => (k.onclick = () => pick(i)));
    const onKey = (e) => { if (!open) return; const n = +e.key; if (n >= 1 && n <= items.length) pick(n - 1); if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    root.querySelector(".kc-fab").onclick = () => setOpen(!open);
    root.querySelector(".kc-bg").onclick = () => setOpen(false);
    return { open: () => setOpen(true), close: () => setOpen(false), destroy: () => { removeEventListener("keydown", onKey); root.remove(); } };
  },
});
