/* A1 menus, part 2: FAB, Off-canvas, Stacked, Exclusive rail, Floating glass,
   Radial, Pill, the signature Vortex, and the four ports of the supplied pens. */

function drill(root, ctx, holder, g, after) { holder.innerHTML = `<h5>${esc(g.label)}</h5>${itemsHTML(g)}`; onItemOnce(holder, ctx, after); }
function onItemOnce(node, ctx, after) { if (node._wired) return; node._wired = true; onItem(node, ctx, after); }

/* ---------- FAB ---------- */
addMenu({ id: "dial", cat: "FAB", name: "Speed Dial", desc: "A floating button that unstacks labelled mini buttons. Pick a section and its pages replace the stack.",
  css: `
.m-dial .scrim{position:absolute;inset:0;background:radial-gradient(circle at 85% 90%,color-mix(in srgb,var(--bg) 60%,transparent),color-mix(in srgb,var(--bg) 92%,transparent));opacity:0;pointer-events:none;transition:opacity .35s}
.m-dial.on .scrim{opacity:1;pointer-events:auto}
.m-dial .fab{position:absolute;right:18px;bottom:20px;width:60px;height:60px;border-radius:20px;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);box-shadow:0 12px 30px -8px var(--accent);pointer-events:auto;z-index:2;transition:transform .45s var(--spring),border-radius .3s}
.m-dial .fab .ic{width:28px;height:28px;transition:transform .45s var(--spring)}
.m-dial.on .fab{border-radius:30px}
.m-dial.on .fab .ic{transform:rotate(135deg)}
.m-dial .stack{position:absolute;right:22px;bottom:92px;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:8px;pointer-events:none;max-height:calc(100% - 140px);overflow:auto;padding:4px;scrollbar-width:none}
.m-dial.on .stack{pointer-events:auto}
.m-dial .db{display:flex;align-items:center;gap:10px;font-weight:700;font-size:13px;opacity:0;transform:translateY(24px) scale(.5);transform-origin:right center;transition:opacity .25s,transform .45s var(--spring)}
.m-dial.on .db{opacity:1;transform:none;transition-delay:calc(var(--i)*35ms)}
.m-dial .db span{padding:6px 10px;border-radius:8px;background:var(--surface2);border:1px solid var(--line);white-space:nowrap}
.m-dial .db i{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--surface);border:1px solid var(--line);color:var(--accent);flex:none}
.m-dial .db.backb i{color:var(--muted)}`,
  build(ctx) {
    const root = el(`<div class="mx m-dial"><div class="scrim"></div><div class="stack"></div><button class="fab" aria-label="Menu">${ic("plus")}</button></div>`);
    ctx.layer.appendChild(root);
    const stack = root.querySelector(".stack");
    const cats = () => { stack.innerHTML = ctx.data.map((g, s) => `<button class="db" style="--i:${s}" data-g="${s}"><span>${esc(g.label)}</span><i>${ic(g.icon)}</i></button>`).join(""); };
    const items = g => { stack.innerHTML = `<button class="db backb" style="--i:0" data-back="1"><span>Back</span><i>${ic("back")}</i></button>` + g.items.map((it, i) => `<button class="db" style="--i:${i + 1}" data-label="${esc(it.label)}"><span>${esc(it.label)}</span><i>${ic(it.icon)}</i></button>`).join(""); };
    const set = v => { root.classList.toggle("on", v); if (v) cats(); };
    const reflow = fn => { root.classList.remove("on"); setTimeout(() => { fn(); root.classList.add("on"); }, 180); };
    root.querySelector(".fab").onclick = () => set(!root.classList.contains("on"));
    root.querySelector(".scrim").onclick = () => set(false);
    stack.addEventListener("click", e => { const b = e.target.closest(".db"); if (!b) return; if (b.dataset.back) return reflow(cats); if (b.dataset.label) { ctx.nav(b.dataset.label); set(false); return; } const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } reflow(() => items(g)); });
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "arc", cat: "FAB", name: "Arc Launcher", desc: "Sections fan out from the corner along two arcs, like a launcher wheel.",
  css: `
.m-arc .glow{position:absolute;right:-180px;bottom:-180px;width:460px;height:460px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 30%,transparent),transparent 65%);transform:scale(.2);opacity:0;transition:transform .6s var(--ease),opacity .4s;pointer-events:none}
.m-arc.on .glow{transform:none;opacity:1}
.m-arc .fab{position:absolute;right:16px;bottom:16px;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(from 200deg,var(--accent),var(--accent2),var(--accent));color:var(--on-accent);pointer-events:auto;z-index:3;box-shadow:0 10px 30px -6px var(--accent)}
.m-arc .fab .ic{width:28px;height:28px;transition:transform .5s var(--spring)}
.m-arc.on .fab .ic{transform:rotate(225deg)}
.m-arc .ab{position:absolute;right:23px;bottom:23px;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--surface2);border:1px solid var(--line);color:var(--accent);pointer-events:none;transform:none;opacity:0;transition:transform .5s var(--spring),opacity .25s}
.m-arc.on .ab{pointer-events:auto;opacity:1;transform:rotate(var(--a)) translateX(calc(var(--r)*-1)) rotate(calc(var(--a)*-1));transition-delay:calc(var(--i)*30ms)}
.m-arc .ab.sel{background:var(--accent);color:var(--on-accent)}
.m-arc .card{position:absolute;left:12px;top:64px;width:62%;max-height:46%;overflow:auto;padding:12px;border-radius:18px;background:var(--surface);border:1px solid var(--line);transform:translateY(-10px) scale(.9);opacity:0;pointer-events:none;transition:transform .4s var(--spring),opacity .25s;transform-origin:top left}
.m-arc .card.on{transform:none;opacity:1;pointer-events:auto}
.m-arc .card h5{margin:0 0 6px;font-family:var(--f-display);font-size:22px;text-transform:uppercase}
.m-arc .mi{display:flex;gap:8px;align-items:center;width:100%;padding:8px 4px;text-align:left;font-size:13px;font-weight:600}
.m-arc .mi .ic{color:var(--accent);width:15px;height:15px}`,
  build(ctx) {
    const n = ctx.data.length, inner = Math.min(n, 5);
    const pos = s => { const ring = s < inner ? 0 : 1, cnt = ring ? n - inner : inner, k = ring ? s - inner : s; const a = cnt > 1 ? -(k * (90 / (cnt - 1))) : -45; return { a: a + "deg", r: ring ? "205px" : "120px" }; };
    const root = el(`<div class="mx m-arc"><div class="glow"></div><div class="card"></div>${ctx.data.map((g, s) => { const p = pos(s); return `<button class="ab" style="--a:${p.a};--r:${p.r};--i:${s}" data-g="${s}" aria-label="${esc(g.label)}">${ic(g.icon)}</button>`; }).join("")}<button class="fab" aria-label="Menu">${ic("plus")}</button></div>`);
    ctx.layer.appendChild(root);
    const card = root.querySelector(".card");
    const set = v => { root.classList.toggle("on", v); if (!v) { card.classList.remove("on"); root.querySelectorAll(".ab").forEach(x => x.classList.remove("sel")); } };
    root.querySelector(".fab").onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".ab").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } root.querySelectorAll(".ab").forEach(x => x.classList.toggle("sel", x === b)); card.classList.remove("on"); setTimeout(() => { drill(root, ctx, card, g, () => set(false)); card.classList.add("on"); }, 120); });
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "morph", cat: "FAB", name: "Morph FAB", desc: "The button swells into a full-screen menu in one continuous motion, then shrinks back.",
  css: `
.m-morph .blob{position:absolute;right:18px;bottom:18px;width:60px;height:60px;border-radius:50%;background:var(--accent);transform:scale(1);transition:transform .65s var(--ease);pointer-events:none}
.m-morph.on .blob{transform:scale(28)}
.m-morph .fab{position:absolute;right:18px;bottom:18px;width:60px;height:60px;border-radius:50%;display:grid;place-items:center;color:var(--on-accent);pointer-events:auto;z-index:2}
.m-morph .fab .ic{width:28px;height:28px;transition:transform .5s var(--spring)}
.m-morph.on .fab .ic{transform:rotate(45deg)}
.m-morph .in{position:absolute;inset:0;padding:60px 18px 90px;overflow:auto;color:var(--on-accent);opacity:0;pointer-events:none;transition:opacity .3s}
.m-morph.on .in{opacity:1;pointer-events:auto;transition-delay:.3s}
.m-morph .in h4{margin:0 0 12px;font-family:var(--f-display);font-size:40px;line-height:.9;text-transform:uppercase}
.m-morph .sec{margin-bottom:14px;opacity:0;transform:translateY(16px);transition:opacity .35s,transform .45s var(--ease)}
.m-morph.on .sec{opacity:1;transform:none;transition-delay:calc(var(--i)*45ms + .35s)}
.m-morph .sec h6{display:flex;gap:6px;align-items:center;margin:0 0 4px;font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.75}
.m-morph .sec h6 .ic{width:13px;height:13px}
.m-morph .row{display:flex;flex-wrap:wrap;gap:6px}
.m-morph .mi{padding:7px 11px;border-radius:999px;background:color-mix(in srgb,var(--on-accent) 12%,transparent);font-size:13px;font-weight:700;color:var(--on-accent)}
.m-morph .mi .ic{display:none}`,
  build(ctx) {
    const root = el(`<div class="mx m-morph"><div class="blob"></div><div class="in"><h4>Where to?</h4>${ctx.data.map((g, s) => `<div class="sec" style="--i:${s}"><h6>${ic(g.icon)}${esc(g.label)}</h6><div class="row">${itemsHTML(g)}</div></div>`).join("")}</div><button class="fab" aria-label="Menu">${ic("plus")}</button></div>`);
    ctx.layer.appendChild(root);
    const set = v => root.classList.toggle("on", v);
    root.querySelector(".fab").onclick = () => set(!root.classList.contains("on"));
    onItem(root, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

/* ---------- OFF-CANVAS ---------- */
addMenu({ id: "curtain", cat: "Off-canvas", name: "Curtain Reveal", desc: "The page swings open like a door to reveal a big typographic menu behind it.",
  css: `
.m-curtain .back{position:absolute;top:0;bottom:0;left:0;width:64%;padding:70px 10px 20px 18px;overflow:auto;opacity:0;pointer-events:none;transition:opacity .3s}
.m-curtain.on .back{opacity:1;pointer-events:auto}
.m-curtain .g{display:block;width:100%;text-align:left;font-family:var(--f-display);font-weight:800;font-size:27px;line-height:1.05;text-transform:uppercase;color:var(--muted);padding:3px 0;opacity:0;transform:translateX(-30px);transition:opacity .35s,transform .5s var(--ease),color .2s}
.m-curtain.on .g{opacity:1;transform:none;transition-delay:calc(var(--i)*35ms + .2s)}
.m-curtain .g:hover,.m-curtain .g.sel{color:var(--text)}
.m-curtain .g.sel{color:var(--accent)}
.m-curtain .subs{display:none;padding:4px 0 10px}
.m-curtain .subs.on{display:block}
.m-curtain .mi{display:flex;gap:8px;align-items:center;width:100%;padding:6px 2px;text-align:left;font-size:14px;color:var(--text);animation:cur-in .35s var(--ease) both;animation-delay:calc(var(--i)*30ms)}
.m-curtain .mi .ic{color:var(--accent);width:15px;height:15px}
@keyframes cur-in{from{opacity:0;transform:translateY(-6px)}}
.scr-curtain{transform:perspective(1000px) translateX(64%) rotateY(-38deg) scale(.9)!important;transform-origin:right center!important;box-shadow:-40px 0 80px rgba(0,0,0,.6);border-radius:24px;pointer-events:none}`,
  build(ctx) {
    const root = el(`<div class="mx m-curtain"><nav class="back">${ctx.data.map((g, s) => `<button class="g" style="--i:${s}" data-g="${s}">${esc(g.label)}</button><div class="subs">${itemsHTML(g)}</div>`).join("")}</nav>${burger("left")}</div>`);
    ctx.layer.appendChild(root);
    ctx.stage.style.background = "linear-gradient(160deg,var(--surface2),var(--bg))";
    const trig = root.querySelector(".trig");
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); ctx.screen.classList.toggle("scr-curtain", v); };
    trig.onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".g").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } const on = b.classList.contains("sel"); root.querySelectorAll(".g").forEach(x => { x.classList.remove("sel"); x.nextElementSibling.classList.remove("on"); }); if (!on) { b.classList.add("sel"); b.nextElementSibling.classList.add("on"); } });
    onItem(root, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

/* ---------- STACKED ---------- */
addMenu({ id: "deck", cat: "Stacked", name: "Card Deck", desc: "Sections stacked like cards in a wallet. Tap one and it lifts out while the rest tuck away.",
  css: `
.m-deck .wrap2{position:absolute;inset:0;padding:66px 12px 12px;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);overflow:auto;opacity:0;pointer-events:none;transition:opacity .3s}
.m-deck.on .wrap2{opacity:1;pointer-events:auto}
.m-deck .pile{position:relative;height:calc(var(--n)*46px + 150px)}
.m-deck .c{position:absolute;left:0;right:0;top:0;height:300px;border-radius:20px;padding:14px;text-align:left;color:#fff;background:linear-gradient(135deg,hsl(var(--h) 55% 42%),hsl(calc(var(--h) + 40) 60% 28%));box-shadow:0 -6px 20px rgba(0,0,0,.35);transform:translateY(calc(var(--i)*46px));transition:transform .55s var(--spring);display:flex;flex-direction:column}
.m-deck .c header{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px}
.m-deck .c header em{margin-left:auto;font-style:normal;font-family:var(--f-mono);font-size:10px;opacity:.8}
.m-deck .c .its{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;opacity:0;transition:opacity .3s;overflow:auto}
.m-deck .pile.lift .c{transform:translateY(calc(var(--i)*8px + 330px)) scale(.94)}
.m-deck .pile.lift .c.up{transform:translateY(0);z-index:50}
.m-deck .c.up .its{opacity:1;transition-delay:.25s}
.m-deck .mi{display:flex;gap:6px;align-items:center;padding:9px 8px;border-radius:10px;background:rgba(255,255,255,.14);font-size:12px;font-weight:700;color:#fff;text-align:left;line-height:1.15}
.m-deck .mi .ic{width:14px;height:14px}`,
  build(ctx) {
    const root = el(`<div class="mx m-deck">${burger()}<div class="wrap2"><div class="pile" style="--n:${ctx.data.length}">${ctx.data.map((g, s) => `<div class="c" style="--i:${s};--h:${222 + s * 9};z-index:${s}" data-g="${s}" role="button" tabindex="0"><header>${ic(g.icon)}${esc(g.label)}<em>${g.items.length}</em></header><div class="its">${itemsHTML(g)}</div></div>`).join("")}</div></div></div>`);
    ctx.layer.appendChild(root);
    const trig = root.querySelector(".trig"), pile = root.querySelector(".pile");
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); if (!v) { pile.classList.remove("lift"); pile.querySelectorAll(".up").forEach(x => x.classList.remove("up")); } };
    trig.onclick = () => set(!root.classList.contains("on"));
    pile.addEventListener("click", e => { if (e.target.closest("[data-label]")) return; const c = e.target.closest(".c"); if (!c) return; const g = ctx.data[c.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } if (c.classList.contains("up")) { c.classList.remove("up"); pile.classList.remove("lift"); return; } pile.querySelectorAll(".up").forEach(x => x.classList.remove("up")); c.classList.add("up"); pile.classList.add("lift"); root.querySelector(".wrap2").scrollTo({ top: 0, behavior: "smooth" }); });
    onItem(pile, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "layers", cat: "Stacked", name: "Drill Layers", desc: "Each level slides in as a new layer over the last, the way native phone apps move deeper.",
  css: `
.m-layers .host{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.m-layers.on .host{pointer-events:auto}
.m-layers .ly{position:absolute;inset:0;padding:66px 12px 16px;overflow:auto;background:var(--surface);transform:translateX(100%);transition:transform .5s var(--ease),filter .5s}
.m-layers .ly.in{transform:none}
.m-layers .ly.under{transform:translateX(-28%);filter:brightness(.55)}
.m-layers .ly h5{margin:0 0 10px;display:flex;align-items:center;gap:10px;font-family:var(--f-display);font-size:28px;text-transform:uppercase}
.m-layers .ly h5 .bk{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface2)}
.m-layers .row,.m-layers .mi{display:flex;align-items:center;gap:12px;width:100%;padding:13px 10px;border-radius:14px;text-align:left;font-weight:700}
.m-layers .row:hover,.m-layers .mi:hover{background:var(--surface2)}
.m-layers .row .ic:first-child,.m-layers .mi .ic{color:var(--accent)}
.m-layers .row .chev{margin-left:auto;color:var(--muted)}
.m-layers .row em{font-style:normal;font-family:var(--f-mono);font-size:11px;color:var(--muted);margin-left:auto}`,
  build(ctx) {
    const root = el(`<div class="mx m-layers"><div class="host"></div>${burger()}</div>`);
    ctx.layer.appendChild(root);
    const host = root.querySelector(".host"), trig = root.querySelector(".trig");
    const push = html => { const ly = el(`<div class="ly">${html}</div>`); const prev = host.lastElementChild; host.appendChild(ly); requestAnimationFrame(() => requestAnimationFrame(() => { ly.classList.add("in"); prev?.classList.add("under"); })); return ly; };
    const pop = () => { const ly = host.lastElementChild; if (!ly) return; ly.classList.remove("in"); ly.previousElementSibling?.classList.remove("under"); setTimeout(() => ly.remove(), 500); };
    const top = () => { const ly = push(`<h5>Menu</h5>${ctx.data.map((g, s) => `<button class="row" data-g="${s}">${ic(g.icon)}<span>${esc(g.label)}</span><em>${g.items.length}</em>${ic("right", "chev")}</button>`).join("")}`); ly.querySelectorAll(".row").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } const l2 = push(`<h5><button class="bk" aria-label="Back">${ic("back")}</button>${esc(g.label)}</h5>${itemsHTML(g)}`); l2.querySelector(".bk").onclick = pop; onItem(l2, ctx, () => set(false)); }); };
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); if (v) { host.innerHTML = ""; top(); } else { [...host.children].forEach(l => { l.classList.remove("in", "under"); }); setTimeout(() => { if (!root.classList.contains("on")) host.innerHTML = ""; }, 500); } };
    trig.onclick = () => set(!root.classList.contains("on"));
    return { open() { set(true); setTimeout(() => host.querySelector(".row[data-g='3'], .row")?.click(), 700); }, close() { set(false); } };
  } });

/* ---------- EXCLUSIVE WITH RAIL ---------- */
addMenu({ id: "railpanel", cat: "Exclusive with rail", name: "Rail + Panel", desc: "A permanent icon rail where only one section can be open. Its panel slides out beside the rail.",
  css: `
.m-railpanel .rl{position:absolute;top:0;bottom:0;left:0;width:62px;padding:62px 8px 10px;display:flex;flex-direction:column;gap:6px;background:var(--surface);border-right:1px solid var(--line);pointer-events:auto;overflow:auto;scrollbar-width:none;z-index:2}
.m-railpanel .rb{position:relative;width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;color:var(--muted);transition:color .3s}
.m-railpanel .rb.sel{color:var(--on-accent)}
.m-railpanel .ind{position:absolute;left:8px;top:0;width:46px;height:46px;border-radius:14px;background:var(--accent);transition:transform .45s var(--spring),opacity .2s;opacity:0}
.m-railpanel .pn{position:absolute;top:0;bottom:0;left:62px;width:70%;padding:66px 12px 12px;overflow:auto;background:color-mix(in srgb,var(--surface2) 96%,transparent);border-right:1px solid var(--line);transform:translateX(-105%);transition:transform .45s var(--ease);pointer-events:auto;z-index:1}
.m-railpanel .pn.on{transform:none;box-shadow:20px 0 40px rgba(0,0,0,.35)}
.m-railpanel .pn h5{margin:0 0 8px;font-family:var(--f-display);font-size:24px;text-transform:uppercase}
.m-railpanel .mi{display:flex;gap:10px;align-items:center;width:100%;padding:10px 6px;border-radius:10px;text-align:left;font-weight:600;font-size:14px;animation:rp-in .4s var(--ease) both;animation-delay:calc(var(--i)*30ms)}
.m-railpanel .mi .ic{color:var(--accent);width:16px;height:16px}
@keyframes rp-in{from{opacity:0;transform:translateX(-10px)}}
.scr-railpanel{transform:translateX(62px)}`,
  build(ctx) {
    const root = el(`<div class="mx m-railpanel"><div class="pn"></div><nav class="rl"><span class="ind"></span>${ctx.data.map((g, s) => `<button class="rb" data-g="${s}" aria-label="${esc(g.label)}">${ic(g.icon)}</button>`).join("")}</nav></div>`);
    ctx.layer.appendChild(root);
    ctx.screen.classList.add("scr-railpanel");
    const pn = root.querySelector(".pn"), ind = root.querySelector(".ind"), rbs = [...root.querySelectorAll(".rb")];
    const close = () => { pn.classList.remove("on"); rbs.forEach(x => x.classList.remove("sel")); ind.style.opacity = 0; };
    rbs.forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; ind.style.opacity = 1; ind.style.transform = `translateY(${b.offsetTop}px)`; const solo = soloLabel(g); if (solo) { ctx.nav(solo); close(); return; } if (b.classList.contains("sel")) { close(); return; } rbs.forEach(x => x.classList.toggle("sel", x === b)); pn.innerHTML = `<h5>${esc(g.label)}</h5>${itemsHTML(g)}`; pn.classList.add("on"); });
    onItem(pn, ctx, close);
    return { open() { (rbs[3] || rbs[0]).click(); }, close, destroy() { ctx.screen.classList.remove("scr-railpanel"); } };
  } });

addMenu({ id: "railpop", cat: "Exclusive with rail", name: "Bottom Rail Pop", desc: "A thumb-height rail of sections along the bottom. Only one panel opens at a time, popping up from its icon.",
  css: `
.m-railpop .rl{position:absolute;left:0;right:0;bottom:0;display:flex;gap:4px;overflow-x:auto;padding:8px 8px 14px;background:var(--surface);border-top:1px solid var(--line);pointer-events:auto;scrollbar-width:none;z-index:2}
.m-railpop .rb{flex:none;width:58px;display:grid;justify-items:center;gap:4px;padding:6px 0;border-radius:14px;font-size:9.5px;font-weight:700;color:var(--muted);transition:background .3s,color .3s}
.m-railpop .rb .ic{width:22px;height:22px}
.m-railpop .rb.sel{background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)}
.m-railpop .pop{position:absolute;left:10px;right:10px;bottom:84px;max-height:60%;overflow:auto;padding:12px;border-radius:20px;background:color-mix(in srgb,var(--surface2) 80%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--line);transform:translateY(20px) scale(.92);opacity:0;pointer-events:none;transition:transform .45s var(--spring),opacity .25s}
.m-railpop .pop.on{transform:none;opacity:1;pointer-events:auto}
.m-railpop .pop h5{margin:0 0 8px;font-family:var(--f-display);font-size:22px;text-transform:uppercase}
.m-railpop .gr{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.m-railpop .mi{display:flex;gap:8px;align-items:center;padding:10px 8px;border-radius:12px;background:var(--surface);font-size:12.5px;font-weight:700;text-align:left;line-height:1.15}
.m-railpop .mi .ic{color:var(--accent);width:15px;height:15px}`,
  build(ctx) {
    const root = el(`<div class="mx m-railpop"><div class="pop"></div><nav class="rl">${ctx.data.map((g, s) => `<button class="rb" data-g="${s}">${ic(g.icon)}<span>${esc(g.label.split(" ")[0])}</span></button>`).join("")}</nav></div>`);
    ctx.layer.appendChild(root);
    const pop = root.querySelector(".pop"), rbs = [...root.querySelectorAll(".rb")];
    const close = () => { pop.classList.remove("on"); rbs.forEach(x => x.classList.remove("sel")); };
    rbs.forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); close(); return; } if (b.classList.contains("sel")) return close(); rbs.forEach(x => x.classList.toggle("sel", x === b)); pop.classList.remove("on"); setTimeout(() => { pop.innerHTML = `<h5>${esc(g.label)}</h5><div class="gr">${itemsHTML(g)}</div>`; pop.classList.add("on"); }, 110); });
    onItem(pop, ctx, close);
    return { open() { (rbs[3] || rbs[0]).click(); }, close };
  } });

/* ---------- FLOATING GLASS ---------- */
addMenu({ id: "dock", cat: "Floating glass", name: "Glass Dock", desc: "A frosted floating dock. Icons swell under your finger and a glass popover rises from the one you pick.",
  css: `
.m-dock .dk{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:flex-end;gap:4px;padding:8px 10px;border-radius:24px;background:color-mix(in srgb,var(--surface) 45%,transparent);backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);border:1px solid color-mix(in srgb,var(--metal) 25%,transparent);box-shadow:0 20px 40px -10px rgba(0,0,0,.6),inset 0 1px 0 color-mix(in srgb,#fff 15%,transparent);pointer-events:auto;max-width:calc(100% - 20px);overflow-x:auto;scrollbar-width:none}
.m-dock .d{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 55%,var(--surface2)),var(--surface2));color:var(--text);transform-origin:bottom center;transition:transform .3s var(--spring)}
.m-dock .d .ic{width:18px;height:18px}
.m-dock .d.sel{box-shadow:0 0 0 2px var(--accent)}
.m-dock .pv{position:absolute;left:12px;right:12px;bottom:82px;max-height:58%;overflow:auto;padding:12px;border-radius:22px;background:color-mix(in srgb,var(--surface) 50%,transparent);backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);border:1px solid color-mix(in srgb,var(--metal) 22%,transparent);transform-origin:var(--ox) 100%;transform:scale(.3);opacity:0;pointer-events:none;transition:transform .45s var(--spring),opacity .25s}
.m-dock .pv.on{transform:none;opacity:1;pointer-events:auto}
.m-dock .pv h5{margin:0 0 6px;font-family:var(--f-display);font-size:22px;text-transform:uppercase}
.m-dock .mi{display:flex;gap:10px;align-items:center;width:100%;padding:9px 6px;border-radius:10px;text-align:left;font-weight:600;font-size:14px}
.m-dock .mi:hover{background:color-mix(in srgb,var(--text) 8%,transparent)}
.m-dock .mi .ic{color:var(--accent);width:16px;height:16px}`,
  build(ctx) {
    const root = el(`<div class="mx m-dock"><div class="pv"></div><nav class="dk">${ctx.data.map((g, s) => `<button class="d" data-g="${s}" aria-label="${esc(g.label)}">${ic(g.icon)}</button>`).join("")}</nav></div>`);
    ctx.layer.appendChild(root);
    const dk = root.querySelector(".dk"), pv = root.querySelector(".pv"), ds = [...root.querySelectorAll(".d")];
    const mag = x => ds.forEach(d => { const r = d.getBoundingClientRect(); const dist = Math.abs(x - (r.left + r.width / 2)); const s = 1 + Math.max(0, 1 - dist / 80) * .55; d.style.transform = `scale(${s.toFixed(3)})`; });
    const reset = () => ds.forEach(d => d.style.transform = "");
    dk.addEventListener("pointermove", e => mag(e.clientX)); dk.addEventListener("pointerleave", reset); dk.addEventListener("pointerup", reset);
    const close = () => { pv.classList.remove("on"); ds.forEach(x => x.classList.remove("sel")); };
    ds.forEach(d => d.onclick = () => { const g = ctx.data[d.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); close(); return; } if (d.classList.contains("sel")) return close(); ds.forEach(x => x.classList.toggle("sel", x === d)); const L = root.getBoundingClientRect(), r = d.getBoundingClientRect(); pv.style.setProperty("--ox", (r.left - L.left + r.width / 2 - 12) + "px"); pv.innerHTML = `<h5>${esc(g.label)}</h5>${itemsHTML(g)}`; pv.classList.remove("on"); requestAnimationFrame(() => pv.classList.add("on")); });
    onItem(pv, ctx, close);
    return { open() { (ds[3] || ds[0]).click(); }, close };
  } });

addMenu({ id: "island", cat: "Floating glass", name: "Glass Island", desc: "A small glass pill at the top, like a phone's island, that stretches open into the full menu.",
  css: `
.m-island .isl{position:absolute;top:30px;left:50%;width:150px;height:40px;margin-left:-75px;border-radius:22px;background:color-mix(in srgb,#05050a 70%,transparent);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid color-mix(in srgb,var(--metal) 20%,transparent);transform-origin:top center;transition:transform .6s var(--spring),border-radius .5s;pointer-events:none}
.m-island.on .isl{transform:scale(2.24,13.4);border-radius:9.8px/1.64px}
.m-island .pill{position:absolute;top:30px;left:50%;width:150px;height:40px;margin-left:-75px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:13px;color:#fff;pointer-events:auto;z-index:2;transition:opacity .2s}
.m-island .pill .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent);animation:isl-p 1.6s infinite}
.m-island.on .pill{opacity:0;pointer-events:none}
.m-island .cnt{position:absolute;top:36px;left:12px;right:12px;height:520px;max-height:calc(100% - 48px);padding:10px;overflow:auto;color:#fff;opacity:0;pointer-events:none;transition:opacity .25s}
.m-island.on .cnt{opacity:1;pointer-events:auto;transition-delay:.3s}
.m-island .cnt header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.m-island .cnt header b{font-family:var(--f-display);font-size:22px;text-transform:uppercase}
.m-island .cg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.m-island .cb{display:grid;justify-items:center;gap:5px;padding:10px 4px;border-radius:14px;background:rgba(255,255,255,.07);font-size:11px;font-weight:700;line-height:1.15;text-align:center;color:#fff}
.m-island .cb .ic{color:var(--accent);width:20px;height:20px}
.m-island .cb.sel{background:var(--accent);color:var(--on-accent)}
.m-island .cb.sel .ic{color:var(--on-accent)}
.m-island .its{margin-top:10px}
.m-island .mi{display:flex;gap:10px;align-items:center;width:100%;padding:9px 6px;border-radius:10px;color:#fff;font-weight:600;font-size:14px;text-align:left;animation:isl-in .35s var(--ease) both;animation-delay:calc(var(--i)*30ms)}
.m-island .mi .ic{color:var(--accent);width:16px;height:16px}
@keyframes isl-p{50%{opacity:.35}}
@keyframes isl-in{from{opacity:0;transform:translateY(6px)}}`,
  build(ctx) {
    const root = el(`<div class="mx m-island"><div class="isl"></div><button class="pill"><span class="dot"></span>Menu</button><div class="cnt"><header><b>Navigate</b><button class="x" aria-label="Close">${ic("x")}</button></header><div class="cg">${ctx.data.map((g, s) => `<button class="cb" data-g="${s}">${ic(g.icon)}<span>${esc(g.label)}</span></button>`).join("")}</div><div class="its"></div></div></div>`);
    ctx.layer.appendChild(root);
    const its = root.querySelector(".its");
    const set = v => { root.classList.toggle("on", v); if (!v) { its.innerHTML = ""; root.querySelectorAll(".cb").forEach(x => x.classList.remove("sel")); } };
    root.querySelector(".pill").onclick = () => set(true);
    root.querySelector(".x").onclick = () => set(false);
    root.querySelectorAll(".cb").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } root.querySelectorAll(".cb").forEach(x => x.classList.toggle("sel", x === b)); its.innerHTML = itemsHTML(g); });
    onItem(its, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

/* ---------- RADIAL ---------- */
addMenu({ id: "orbit", cat: "Radial", name: "Orbit", desc: "Sections orbit a central button like satellites. Pick one and its pages spin into an inner ring.",
  css: `
.m-orbit .sky{position:absolute;inset:0;background:radial-gradient(circle at 50% 55%,color-mix(in srgb,var(--accent) 18%,var(--bg)),color-mix(in srgb,var(--bg) 96%,transparent) 70%);opacity:0;pointer-events:none;transition:opacity .4s}
.m-orbit.on .sky{opacity:1;pointer-events:auto}
.m-orbit .ctr{position:absolute;left:50%;top:55%;width:0;height:0}
.m-orbit .core{position:absolute;left:-34px;top:-34px;width:68px;height:68px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 30%,var(--accent),var(--accent2));color:var(--on-accent);pointer-events:auto;z-index:3;box-shadow:0 0 40px -4px var(--accent)}
.m-orbit .core .ic{width:28px;height:28px;transition:transform .5s var(--spring)}
.m-orbit.on .core .ic{transform:rotate(90deg)}
.m-orbit .ring{position:absolute;left:0;top:0;width:0;height:0;animation:orb 40s linear infinite}
.m-orbit .ring.paused{animation-play-state:paused}
.m-orbit .ob{position:absolute;left:-24px;top:-24px;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--surface2);border:1px solid var(--line);color:var(--accent);pointer-events:none;opacity:0;transform:rotate(var(--a)) translateY(0) rotate(calc(var(--a)*-1));transition:transform .6s var(--spring),opacity .3s,background .3s}
.m-orbit.on .ob{pointer-events:auto;opacity:1;transform:rotate(var(--a)) translateY(-128px) rotate(calc(var(--a)*-1));transition-delay:calc(var(--i)*30ms)}
.m-orbit .ob .ic{animation:orb 40s linear infinite reverse}
.m-orbit .ring.paused .ob .ic{animation-play-state:paused}
.m-orbit .ob.sel{background:var(--accent);color:var(--on-accent)}
.m-orbit .lbl{position:absolute;left:50%;top:13%;transform:translateX(-50%);text-align:center;font-family:var(--f-display);font-size:26px;text-transform:uppercase;white-space:nowrap;opacity:0;transition:opacity .3s}
.m-orbit.on .lbl{opacity:1}
.m-orbit .its{position:absolute;left:12px;right:12px;bottom:12px;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;pointer-events:auto}
.m-orbit .mi{display:flex;gap:6px;align-items:center;padding:8px 11px;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-size:12px;font-weight:700;animation:orb-in .45s var(--spring) both;animation-delay:calc(var(--i)*35ms)}
.m-orbit .mi .ic{color:var(--accent);width:14px;height:14px}
@keyframes orb{to{transform:rotate(360deg)}}
@keyframes orb-in{from{opacity:0;transform:scale(.4) translateY(-30px)}}`,
  build(ctx) {
    const n = ctx.data.length;
    const root = el(`<div class="mx m-orbit"><div class="sky"></div><div class="lbl">Tap a satellite</div><div class="ctr"><div class="ring">${ctx.data.map((g, s) => `<button class="ob" style="--a:${(360 / n) * s}deg;--i:${s}" data-g="${s}" aria-label="${esc(g.label)}">${ic(g.icon)}</button>`).join("")}</div><button class="core" aria-label="Menu">${ic("orbit")}</button></div><div class="its"></div></div>`);
    ctx.layer.appendChild(root);
    const its = root.querySelector(".its"), lbl = root.querySelector(".lbl"), ring = root.querySelector(".ring");
    const set = v => { root.classList.toggle("on", v); if (!v) { its.innerHTML = ""; ring.classList.remove("paused"); lbl.textContent = "Tap a satellite"; root.querySelectorAll(".ob").forEach(x => x.classList.remove("sel")); } };
    root.querySelector(".core").onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".ob").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } root.querySelectorAll(".ob").forEach(x => x.classList.toggle("sel", x === b)); ring.classList.add("paused"); lbl.textContent = g.label; its.innerHTML = itemsHTML(g); });
    onItem(its, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

/* ---------- PILL ---------- */
addMenu({ id: "pill", cat: "Pill", name: "Pill Nav", desc: "A floating pill. The highlight slides and stretches to fit the chosen section's name, and its pages scroll above as smaller pills.",
  css: `
.m-pill .wrap2{position:absolute;left:10px;right:10px;bottom:14px;display:grid;gap:8px;pointer-events:auto}
.m-pill .subs{display:flex;gap:6px;overflow:auto;scrollbar-width:none;padding:2px}
.m-pill .mi{flex:none;display:flex;gap:6px;align-items:center;padding:8px 12px;border-radius:999px;background:color-mix(in srgb,var(--surface2) 85%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--line);font-size:12.5px;font-weight:700;animation:pl-in .4s var(--spring) both;animation-delay:calc(var(--i)*30ms)}
.m-pill .mi .ic{color:var(--accent);width:14px;height:14px}
.m-pill .bar{position:relative;display:flex;gap:2px;padding:6px;border-radius:999px;background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
.m-pill .hl{position:absolute;top:6px;left:0;height:42px;width:100px;border-radius:999px;background:var(--accent);transform-origin:0 0;transition:transform .5s var(--spring)}
.m-pill .pb{position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:7px;height:42px;padding:0 12px;border-radius:999px;color:var(--muted);font-weight:800;font-size:13px;transition:color .3s}
.m-pill .pb span{display:none;white-space:nowrap}
.m-pill .pb.sel{color:var(--on-accent)}
.m-pill .pb.sel span{display:inline;animation:pl-txt .4s var(--ease)}
@keyframes pl-in{from{opacity:0;transform:translateY(14px) scale(.85)}}
@keyframes pl-txt{from{opacity:0}}`,
  build(ctx) {
    const root = el(`<div class="mx m-pill"><div class="wrap2"><div class="subs"></div><nav class="bar"><span class="hl"></span>${ctx.data.map((g, s) => `<button class="pb" data-g="${s}" aria-label="${esc(g.label)}">${ic(g.icon)}<span>${esc(g.label.split(" ")[0])}</span></button>`).join("")}</nav></div></div>`);
    ctx.layer.appendChild(root);
    const subs = root.querySelector(".subs"), hl = root.querySelector(".hl"), pbs = [...root.querySelectorAll(".pb")], bar = root.querySelector(".bar");
    const sel = i => { pbs.forEach((x, k) => x.classList.toggle("sel", k == i)); const b = pbs[i]; requestAnimationFrame(() => { hl.style.transform = `translateX(${b.offsetLeft}px) scaleX(${b.offsetWidth / 100})`; bar.scrollTo({ left: b.offsetLeft - 60, behavior: "smooth" }); }); const g = ctx.data[i]; const solo = soloLabel(g); if (solo) { subs.innerHTML = ""; ctx.nav(solo); return; } subs.innerHTML = itemsHTML(g); };
    pbs.forEach((b, i) => b.onclick = () => sel(i));
    onItem(subs, ctx);
    requestAnimationFrame(() => sel(0));
    return { open() { sel(Math.min(3, pbs.length - 1)); }, close() {} };
  } });

/* ---------- THE SIGNATURE ---------- */
addMenu({ id: "vortex", cat: "Signature", name: "StormSync Vortex", desc: "Our showpiece. A tornado of particles spins up from the button and flings each section out along a spiral; picking one pulls the rest back into the funnel.",
  css: `
.m-vortex canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .5s;pointer-events:none}
.m-vortex.on canvas{opacity:1}
.m-vortex .veil{position:absolute;inset:0;background:radial-gradient(circle at 50% 92%,color-mix(in srgb,var(--accent) 20%,transparent),color-mix(in srgb,var(--bg) 94%,transparent) 62%);opacity:0;transition:opacity .5s;pointer-events:none}
.m-vortex.on .veil{opacity:1;pointer-events:auto}
.m-vortex .core{position:absolute;left:50%;bottom:22px;width:70px;height:70px;margin-left:-35px;border-radius:50%;display:grid;place-items:center;pointer-events:auto;z-index:3;background:radial-gradient(circle at 35% 30%,#fff 0,var(--metal) 18%,#4a4d5a 60%,#1b1c22);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 60%,transparent),0 0 36px -2px var(--accent)}
.m-vortex .core .ic{width:32px;height:32px;color:var(--accent);filter:drop-shadow(0 0 6px var(--accent));transition:transform .8s var(--spring)}
.m-vortex.on .core .ic{transform:rotate(-360deg) scale(1.1)}
.m-vortex .core::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid transparent;border-top-color:var(--accent);border-right-color:var(--accent2);animation:vx-spin 1.2s linear infinite;opacity:.8}
.m-vortex .list{position:absolute;left:0;right:0;top:60px;bottom:104px;overflow:auto;padding:4px 16px;display:flex;flex-direction:column;gap:6px;scrollbar-width:none}
.m-vortex .list h5{margin:4px 0 6px;font-family:var(--f-display);font-size:28px;line-height:1;text-transform:uppercase;display:flex;align-items:center;gap:10px}
.m-vortex .list h5 .bk{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--surface2)}
.m-vortex .vb{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border-radius:16px;text-align:left;font-weight:800;font-size:15px;background:color-mix(in srgb,var(--surface) 75%,transparent);border:1px solid color-mix(in srgb,var(--accent) 22%,var(--line));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:auto;will-change:transform,opacity}
.m-vortex .vb .ic{color:var(--accent)}
.m-vortex .vb em{margin-left:auto;font-style:normal;font-family:var(--f-mono);font-size:11px;color:var(--muted)}
@keyframes vx-spin{to{transform:rotate(360deg)}}`,
  build(ctx) {
    const root = el(`<div class="mx m-vortex"><div class="veil"></div><canvas></canvas><div class="list"></div><button class="core" aria-label="Menu">${ic("tornado")}</button></div>`);
    ctx.layer.appendChild(root);
    const cv = root.querySelector("canvas"), list = root.querySelector(".list"), c2 = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(ctx.stage); const A = css.getPropertyValue("--accent").trim() || "#8e9bff", B = css.getPropertyValue("--accent2").trim() || "#b07bff";
    let W, H, dpr, raf = 0, parts = [], energy = 0, target = 0, running = false;
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; c2.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const N = reduce ? 0 : 260;
    const spawn = p => { p.y = Math.random(); p.a = Math.random() * Math.PI * 2; p.s = .6 + Math.random() * 1.4; p.v = .002 + Math.random() * .004; p.c = Math.random() < .5 ? A : B; return p; };
    for (let i = 0; i < N; i++) parts.push(spawn({}));
    const frame = () => {
      energy += (target - energy) * .06;
      c2.clearRect(0, 0, W, H);
      const bx = W / 2, by = H - 57;
      c2.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.y += p.v * (0.5 + energy); p.a += (0.05 + 0.12 * (1 - p.y)) * (0.4 + energy);
        if (p.y > 1) spawn(p), p.y = 0;
        const h = p.y * (H * .78), r = (14 + Math.pow(p.y, 1.6) * W * .48) * (0.25 + .75 * energy);
        const x = bx + Math.cos(p.a) * r, y = by - h + Math.sin(p.a) * r * .18;
        c2.globalAlpha = (1 - p.y) * .55 * energy; c2.fillStyle = p.c;
        c2.beginPath(); c2.arc(x, y, p.s * (1 + p.y), 0, 6.283); c2.fill();
      }
      c2.globalCompositeOperation = "source-over"; c2.globalAlpha = 1;
      if (energy > .01 || target > 0) raf = requestAnimationFrame(frame); else { running = false; c2.clearRect(0, 0, W, H); }
    };
    const spin = v => { target = v; if (!running && N) { running = true; size(); raf = requestAnimationFrame(frame); } };
    const fling = (nodes) => nodes.forEach((n, i) => { if (reduce) return; const k = (i % 2 ? 1 : -1); n.animate([{ transform: `translate(${k * 60}px, ${list.clientHeight - n.offsetTop}px) rotate(${k * -140}deg) scale(.2)`, opacity: 0 }, { transform: `translate(${k * -24}px, 0) rotate(${k * 12}deg) scale(1.04)`, opacity: 1, offset: .7 }, { transform: "none", opacity: 1 }], { duration: 760, delay: i * 55, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }); });
    const suck = (nodes, done) => { if (reduce || !nodes.length) return done(); let left = nodes.length; nodes.forEach((n, i) => { const k = (i % 2 ? 1 : -1); const a = n.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${k * 40}px, ${list.clientHeight - n.offsetTop + 40}px) rotate(${k * 200}deg) scale(.1)`, opacity: 0 }], { duration: 420, delay: i * 25, easing: "cubic-bezier(.6,0,.8,.4)", fill: "forwards" }); a.onfinish = () => { if (--left === 0) done(); }; }); };
    const showCats = () => { list.innerHTML = ctx.data.map((g, s) => `<button class="vb" data-g="${s}">${ic(g.icon)}<span>${esc(g.label)}</span><em>${g.items.length}</em></button>`).join(""); fling([...list.children]); };
    const showItems = g => { list.innerHTML = `<h5><button class="bk" aria-label="Back">${ic("back")}</button>${esc(g.label)}</h5>` + g.items.map((it, i) => `<button class="vb" data-label="${esc(it.label)}">${ic(it.icon)}<span>${esc(it.label)}</span></button>`).join(""); fling([...list.querySelectorAll(".vb")]); };
    let open = false;
    const set = v => { open = v; root.classList.toggle("on", v); spin(v ? 1 : 0); if (v) showCats(); else suck([...list.querySelectorAll(".vb")], () => { if (!open) list.innerHTML = ""; }); };
    root.querySelector(".core").onclick = () => set(!open);
    list.addEventListener("click", e => {
      if (e.target.closest(".bk")) { spin(1.6); setTimeout(() => spin(1), 500); suck([...list.querySelectorAll(".vb")], showCats); return; }
      const lab = e.target.closest("[data-label]"); if (lab) { ctx.nav(lab.dataset.label); set(false); return; }
      const b = e.target.closest(".vb[data-g]"); if (!b) return; const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; }
      spin(1.8); setTimeout(() => spin(1), 600); suck([...list.querySelectorAll(".vb")].filter(x => x !== b), () => { b.animate([{ transform: "none" }, { transform: "scale(1.06)", opacity: .2 }], { duration: 200, fill: "forwards" }).onfinish = () => showItems(g); });
    });
    return { open() { set(true); }, close() { set(false); }, destroy() { cancelAnimationFrame(raf); } };
  } });

/* ---------- PORTS OF THE SUPPLIED PENS ---------- */
addMenu({ id: "notch", cat: "From your files", name: "Notch Bar", desc: "Port of \u201cNavigation bar with circle flexible highlight\u201d. The bar carves a round notch that glides under the active icon, which lifts into a glowing bubble. Rebuilt with transforms only so it stays smooth.",
  css: `
.m-notch .bar{position:absolute;left:10px;right:10px;bottom:14px;height:66px;pointer-events:auto}
.m-notch svg.bg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 8px 18px rgba(0,0,0,.45))}
.m-notch svg.bg rect{fill:var(--surface2)}
.m-notch .hole{transition:transform .6s var(--spring)}
.m-notch .bub{position:absolute;top:-26px;left:0;width:56px;height:56px;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 70%,#fff),var(--accent));box-shadow:0 8px 24px -4px var(--accent);transition:transform .6s var(--spring)}
.m-notch .nb{position:absolute;top:0;height:66px;display:grid;place-items:center;color:var(--muted);transition:transform .45s var(--spring),color .3s}
.m-notch .nb.sel{color:var(--on-accent);transform:translateY(-27px)}
.m-notch .nb .ic{width:24px;height:24px}
.m-notch .sheet{position:absolute;left:12px;right:12px;bottom:100px;max-height:58%;overflow:auto;padding:12px;border-radius:20px;background:var(--surface);border:1px solid var(--line);transform:translateY(16px) scale(.94);opacity:0;pointer-events:none;transition:transform .45s var(--spring),opacity .25s}
.m-notch .sheet.on{transform:none;opacity:1;pointer-events:auto}
.m-notch .sheet h5{margin:0 0 6px;font-family:var(--f-display);font-size:22px;text-transform:uppercase}
.m-notch .mi{display:flex;gap:10px;align-items:center;width:100%;padding:9px 6px;border-radius:10px;font-weight:600;font-size:14px;text-align:left}
.m-notch .mi .ic{color:var(--accent);width:16px;height:16px}`,
  build(ctx) {
    const many = ctx.data.length > 5;
    const tabs = many ? [ctx.data[0], ctx.data[1], ctx.data[3], ctx.data[4], { id: "more", label: "More", icon: "grid", groups: ctx.data.filter((_, i) => ![0, 1, 3, 4].includes(i)) }] : ctx.data;
    const root = el(`<div class="mx m-notch"><div class="sheet"></div><div class="bar"><svg class="bg" aria-hidden="true"><defs><mask id="notch-m"><rect x="0" y="0" width="100%" height="100%" rx="20" fill="#fff"/><circle class="hole" cx="0" cy="0" r="36" fill="#000"/></mask></defs><rect x="0" y="0" width="100%" height="100%" rx="20" mask="url(#notch-m)"/></svg><span class="bub"></span>${tabs.map((t, i) => `<button class="nb" data-t="${i}" aria-label="${esc(t.label)}">${ic(t.icon)}</button>`).join("")}</div></div>`);
    ctx.layer.appendChild(root);
    const bar = root.querySelector(".bar"), hole = root.querySelector(".hole"), bub = root.querySelector(".bub"), nbs = [...root.querySelectorAll(".nb")], sheet = root.querySelector(".sheet");
    const lay = () => { const w = bar.clientWidth / tabs.length; nbs.forEach((b, i) => { b.style.left = (i * w) + "px"; b.style.width = w + "px"; }); return w; };
    const sel = i => { const w = lay(), cx = i * w + w / 2; hole.style.transform = `translate(${cx}px,2px)`; bub.style.transform = `translateX(${cx - 28}px)`; nbs.forEach((b, k) => b.classList.toggle("sel", k == i)); const t = tabs[i]; const gs = t.groups || [t]; if (gs.length === 1 && soloLabel(gs[0])) { sheet.classList.remove("on"); ctx.nav(soloLabel(gs[0])); return; } sheet.innerHTML = gs.map(g => `<h5>${esc(g.label)}</h5>${itemsHTML(g)}`).join(""); sheet.classList.remove("on"); requestAnimationFrame(() => sheet.classList.add("on")); };
    nbs.forEach((b, i) => b.onclick = () => (b.classList.contains("sel") && sheet.classList.contains("on")) ? sheet.classList.remove("on") : sel(i));
    onItem(sheet, ctx, () => sheet.classList.remove("on"));
    requestAnimationFrame(() => { const w = lay(); hole.style.transition = bub.style.transition = "none"; hole.style.transform = `translate(${w / 2}px,2px)`; bub.style.transform = `translateX(${w / 2 - 28}px)`; nbs[0].classList.add("sel"); requestAnimationFrame(() => { hole.style.transition = bub.style.transition = ""; }); });
    return { open() { sel(Math.min(2, tabs.length - 1)); }, close() { sheet.classList.remove("on"); } };
  } });

addMenu({ id: "sweep", cat: "From your files", name: "Corner Sweep", desc: "Port of \u201cOverlay menu\u201d. Two curved layers sweep in from the corner, then huge headings slide in. The three-line icon morphs as it opens.",
  css: `
.m-sweep .mt{position:absolute;top:28px;right:14px;width:44px;height:44px;display:grid;align-content:center;gap:6px;padding:0 9px;pointer-events:auto;z-index:4}
.m-sweep .mt i{display:block;height:2px;background:var(--text);border-radius:2px;transition:transform .3s var(--ease),width .3s}
.m-sweep .mt i:nth-child(1){width:55%}
.m-sweep .mt i:nth-child(3){width:55%;justify-self:end}
.m-sweep .mt:hover i{width:100%}
.m-sweep.on .mt i:nth-child(1){width:100%;transform:translateY(8px) rotate(45deg)}
.m-sweep.on .mt i:nth-child(2){transform:scaleX(0)}
.m-sweep.on .mt i:nth-child(3){width:100%;transform:translateY(-8px) rotate(-45deg)}
.m-sweep .lay{position:absolute;right:-850px;top:-850px;width:1700px;height:1700px;border-radius:50%;transform:scale(0);transform-origin:center;transition:transform .7s cubic-bezier(.77,0,.175,1);pointer-events:none}
.m-sweep .l1{background:color-mix(in srgb,var(--accent) 35%,var(--bg));transition-delay:.12s}
.m-sweep .l2{background:color-mix(in srgb,var(--bg) 96%,#000)}
.m-sweep.on .l1{transform:scale(1);transition-delay:0s}
.m-sweep.on .l2{transform:scale(1);transition-delay:.15s}
.m-sweep .list{position:absolute;inset:0;padding:80px 16px 20px;overflow:auto;display:flex;flex-direction:column;justify-content:center;text-align:center;visibility:hidden}
.m-sweep.on .list{visibility:visible;pointer-events:auto}
.m-sweep .g{font-family:var(--f-display);font-weight:800;font-size:27px;line-height:1.15;letter-spacing:.04em;text-transform:uppercase;color:color-mix(in srgb,var(--text) 60%,transparent);opacity:0;transform:translateX(60px);transition:opacity .2s,transform .3s var(--ease),color .2s;position:relative}
.m-sweep.on .g{opacity:1;transform:none;transition:opacity .4s,transform .5s var(--ease),color .2s;transition-delay:calc(var(--i)*50ms + .55s)}
.m-sweep .g::after{content:"";position:absolute;left:10%;right:10%;top:52%;height:4px;background:var(--accent);transform:scaleX(0);transition:transform .3s var(--ease)}
.m-sweep .g:hover,.m-sweep .g.sel{color:var(--text)}
.m-sweep .g:hover::after{transform:scaleX(1)}
.m-sweep .mi{display:inline-flex;gap:6px;align-items:center;margin:3px;padding:7px 11px;border-radius:999px;border:1px solid var(--line);font-size:12.5px;font-weight:700;animation:sw-in .35s var(--ease) both;animation-delay:calc(var(--i)*30ms)}
.m-sweep .mi .ic{color:var(--accent);width:14px;height:14px}
.m-sweep .subs{display:none;padding:6px 0 10px}
.m-sweep .subs.on{display:block}
@keyframes sw-in{from{opacity:0;transform:translateY(8px)}}`,
  build(ctx) {
    const root = el(`<div class="mx m-sweep"><div class="lay l1"></div><div class="lay l2"></div><nav class="list">${ctx.data.map((g, s) => `<button class="g" style="--i:${s}" data-g="${s}">${esc(g.label)}</button><div class="subs">${itemsHTML(g)}</div>`).join("")}</nav><button class="mt" aria-label="Menu"><i></i><i></i><i></i></button></div>`);
    ctx.layer.appendChild(root);
    const set = v => { root.classList.toggle("on", v); if (!v) root.querySelectorAll(".subs.on,.g.sel").forEach(x => x.classList.remove("on", "sel")); };
    root.querySelector(".mt").onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".g").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } const on = b.classList.contains("sel"); root.querySelectorAll(".g").forEach(x => { x.classList.remove("sel"); x.nextElementSibling.classList.remove("on"); }); if (!on) { b.classList.add("sel"); b.nextElementSibling.classList.add("on"); } });
    onItem(root.querySelector(".list"), ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "colorbar", cat: "From your files", name: "Color Morph Bar", desc: "Port of \u201cColorful Mobile Navigation Bar\u201d. Each tab tints the whole screen its own color, and the search button stretches into a live search across every page.",
  css: `
.m-colorbar .tint{position:absolute;inset:0;background:var(--tint,transparent);opacity:.22;transition:background .5s;pointer-events:none}
.m-colorbar .wrap2{position:absolute;left:10px;right:10px;bottom:14px;border-radius:20px;overflow:hidden;background:var(--tint);transition:background .5s;pointer-events:auto;box-shadow:0 14px 34px -10px rgba(0,0,0,.6)}
.m-colorbar .res{max-height:0;overflow:auto;transition:max-height .4s var(--ease)}
.m-colorbar.searching .res{max-height:260px}
.m-colorbar .res .mi{display:flex;gap:8px;align-items:center;width:100%;padding:9px 14px;text-align:left;font-weight:700;font-size:13.5px;color:#111}
.m-colorbar .res .mi .ic{width:15px;height:15px}
.m-colorbar .res .none{padding:10px 14px;font-size:13px;color:#333}
.m-colorbar .nav{display:flex;align-items:center;height:64px;padding:0 8px;background:var(--surface)}
.m-colorbar .ni{position:relative;flex:none;width:56px;height:64px;display:grid;place-items:center;color:var(--muted);transition:color .3s}
.m-colorbar .ni.sel{color:var(--text)}
.m-colorbar .ni .ic{width:22px;height:22px}
.m-colorbar .ni .ind{position:absolute;left:50%;bottom:8px;width:34px;height:4px;margin-left:-17px;border-radius:4px;background:var(--tint);transform:scaleX(0);transition:transform .35s var(--spring)}
.m-colorbar .ni.sel .ind{transform:none}
.m-colorbar.searching .ni{width:44px}
.m-colorbar .srch{position:relative;flex:1;height:64px;display:flex;align-items:center;justify-content:flex-end}
.m-colorbar .srch input{position:absolute;left:4px;right:4px;top:12px;height:40px;border-radius:20px;border:0;outline:0;padding:0 46px 0 14px;background:var(--tint);color:#111;font:700 14px var(--f-body);opacity:0;transform:scaleX(.2);transform-origin:right center;transition:transform .4s var(--spring),opacity .25s}
.m-colorbar.searching .srch input{opacity:1;transform:none}
.m-colorbar .srch button{position:relative;width:48px;height:48px;display:grid;place-items:center;color:var(--muted)}
.m-colorbar.searching .srch button{color:#111}`,
  build(ctx) {
    const pal = ["#c9d6ff", "#ffe9a8", "#e6cfff", "#ffc9d4", "#bff2e0", "#cfe8ff", "#ffd9bd", "#d9f5b5", "#f2d0ff"];
    const tabs = ctx.data.length > 4 ? [0, 1, 3, 8].map(i => ctx.data[i]).filter(Boolean) : ctx.data;
    const root = el(`<div class="mx m-colorbar"><div class="tint"></div><div class="wrap2"><div class="res"></div><div class="nav">${tabs.slice(0, 2).map((g, i) => `<button class="ni" data-t="${i}" aria-label="${esc(g.label)}"><span class="ind"></span>${ic(g.icon)}</button>`).join("")}<div class="srch"><input id="cbq" placeholder="Search pages" autocomplete="off"><button aria-label="Search">${ic("search")}</button></div>${tabs.slice(2).map((g, i) => `<button class="ni" data-t="${i + 2}" aria-label="${esc(g.label)}"><span class="ind"></span>${ic(g.icon)}</button>`).join("")}</div></div></div>`);
    ctx.layer.appendChild(root);
    const nis = [...root.querySelectorAll(".ni")], input = root.querySelector("input"), res = root.querySelector(".res");
    const all = ctx.data.flatMap(g => g.items);
    const tint = i => root.style.setProperty("--tint", pal[i % pal.length]);
    const render = () => { const q = input.value.trim().toLowerCase(); const hits = (q ? all.filter(i => i.label.toLowerCase().includes(q)) : all).slice(0, 30); res.innerHTML = hits.length ? hits.map(it => `<button class="mi" data-label="${esc(it.label)}">${ic(it.icon)}${esc(it.label)}</button>`).join("") : `<div class="none">Nothing matches that.</div>`; };
    const sel = i => { root.classList.remove("searching"); nis.forEach(n => n.classList.toggle("sel", +n.dataset.t === i)); tint(i); const g = tabs[i]; res.innerHTML = itemsHTML(g); root.classList.add("searching"); };
    nis.forEach(n => n.onclick = () => sel(+n.dataset.t));
    root.querySelector(".srch button").onclick = () => { const on = root.classList.toggle("searching"); nis.forEach(n => n.classList.remove("sel")); tint(4); render(); if (on) setTimeout(() => input.focus({ preventScroll: true }), 250); };
    input.oninput = render;
    onItem(res, ctx, () => root.classList.remove("searching"));
    tint(0); nis[0].classList.add("sel");
    return { open() { root.querySelector(".srch button").click(); }, close() { root.classList.remove("searching"); } };
  } });

addMenu({ id: "plates", cat: "From your files", name: "Radial Plates", desc: "Port of \u201cRadial Menu, Pure CSS\u201d. Round plates burst out from the center button with a staggered delay; pick one and its pages fan out beneath.",
  css: `
.m-plates .bg{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .4s}
.m-plates.on .bg{opacity:1;pointer-events:auto}
.m-plates .ctr{position:absolute;left:50%;top:42%;width:0;height:0}
.m-plates .main{position:absolute;left:-40px;top:-40px;width:80px;height:80px;border-radius:50%;display:grid;place-items:center;background:var(--accent2);color:#fff;pointer-events:auto;z-index:3;box-shadow:1px 3px 10px rgba(0,0,0,.45);transition:transform .2s}
.m-plates .main:active{transform:scale(.94)}
.m-plates .main .ic{width:32px;height:32px;transition:transform .4s var(--spring)}
.m-plates.on .main .ic{transform:rotate(90deg)}
.m-plates .pl{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:var(--c);color:#14121f;opacity:0;pointer-events:none;box-shadow:1px 2px 6px rgba(0,0,0,.35);transition:transform .4s ease-in,opacity .4s ease-in;transition-delay:calc(var(--i)*.06s)}
.m-plates.on .pl{opacity:1;pointer-events:auto;transform:rotate(var(--a)) translateY(-112px) rotate(calc(var(--a)*-1))}
.m-plates .pl.sel{box-shadow:0 0 0 3px var(--text)}
.m-plates .pl .ic{width:22px;height:22px}
.m-plates .its{position:absolute;left:12px;right:12px;top:calc(42% + 150px);bottom:12px;overflow:auto;display:flex;flex-wrap:wrap;align-content:flex-start;justify-content:center;gap:6px;pointer-events:auto}
.m-plates .cap{width:100%;text-align:center;font-family:var(--f-display);font-size:22px;text-transform:uppercase}
.m-plates .mi{display:flex;gap:6px;align-items:center;padding:8px 11px;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-size:12px;font-weight:700;animation:pt-in .4s var(--spring) both;animation-delay:calc(var(--i)*35ms)}
.m-plates .mi .ic{width:14px;height:14px;color:var(--accent)}
@keyframes pt-in{from{opacity:0;transform:scale(.3)}}`,
  build(ctx) {
    const n = ctx.data.length, cols = ["#c9d0ff", "#e2c8ff", "#ffd1e8", "#c4f1e6", "#fff0b8", "#ffd6c2", "#cfe9ff", "#d8f7c2", "#f0d4ff"];
    const root = el(`<div class="mx m-plates"><div class="bg"></div><div class="ctr">${ctx.data.map((g, s) => `<button class="pl" style="--a:${(360 / n) * s}deg;--i:${s};--c:${cols[s % cols.length]}" data-g="${s}" aria-label="${esc(g.label)}">${ic(g.icon)}</button>`).join("")}<button class="main" aria-label="Menu">${ic("menu")}</button></div><div class="its"></div></div>`);
    ctx.layer.appendChild(root);
    const its = root.querySelector(".its");
    const set = v => { root.classList.toggle("on", v); if (!v) { its.innerHTML = ""; root.querySelectorAll(".pl").forEach(x => x.classList.remove("sel")); } };
    root.querySelector(".main").onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".pl").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } root.querySelectorAll(".pl").forEach(x => x.classList.toggle("sel", x === b)); its.innerHTML = `<div class="cap">${esc(g.label)}</div>${itemsHTML(g)}`; });
    onItem(its, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });
