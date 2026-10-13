/* A1 menus, part 1: shared helpers, Accordion, Side Bar, Mega, Bento, Tabbed.
   Every menu is self-contained: its CSS is scoped to .m-<id> and injected once.
   build(ctx) gets { layer, screen, nav(label) } and returns { open, close, destroy }. */

const MENUS = [];
function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function itemsHTML(g, cls) { return g.items.map((it, i) => `<button class="${cls || "mi"}" style="--i:${i}" data-label="${esc(it.label)}">${ic(it.icon)}<span>${esc(it.label)}</span></button>`).join(""); }
function burger(extra) { return `<button class="trig ${extra || ""}" aria-label="Menu"><span></span><span></span><span></span></button>`; }
function onItem(root, ctx, after) { root.addEventListener("click", e => { const b = e.target.closest("[data-label]"); if (b) { ctx.nav(b.dataset.label); if (after) after(); } }); }
function soloLabel(g) { return g.items.length === 1 ? g.items[0].label : null; }
function addMenu(m) { MENUS.push(m); }

/* ---------- ACCORDION ---------- */
addMenu({ id: "cascade", cat: "Accordion", name: "Cascade", desc: "A full-screen sheet drops in. Every section opens on its own and its pages ripple in.",
  css: `
.m-cascade .sheet{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);transform:translateY(-102%);transition:transform .6s var(--ease);padding:76px 14px 20px;overflow:auto;pointer-events:auto}
.m-cascade.on .sheet{transform:none}
.m-cascade .sec{border-bottom:1px solid var(--line);opacity:0;transform:translateY(-14px);transition:opacity .4s,transform .5s var(--ease);transition-delay:calc(var(--s)*45ms + .15s)}
.m-cascade.on .sec{opacity:1;transform:none}
.m-cascade .sh{display:flex;align-items:center;gap:12px;width:100%;padding:14px 4px;font-weight:700;font-size:16px;text-align:left}
.m-cascade .sh .ic:first-child{color:var(--accent);width:20px;height:20px}
.m-cascade .sh em{margin-left:auto;font-style:normal;font-family:var(--f-mono);font-size:11px;color:var(--muted)}
.m-cascade .sh .chev{transition:transform .4s var(--spring);color:var(--muted)}
.m-cascade .sec.open .chev{transform:rotate(180deg)}
.m-cascade .body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .45s var(--ease)}
.m-cascade .sec.open .body{grid-template-rows:1fr}
.m-cascade .body>div{overflow:hidden}
.m-cascade .mi{display:flex;align-items:center;gap:10px;width:100%;padding:10px 8px 10px 36px;color:var(--muted);font-size:14.5px;text-align:left;opacity:0;transform:translateX(-10px);transition:opacity .3s,transform .4s var(--ease),color .2s}
.m-cascade .sec.open .mi{opacity:1;transform:none;transition-delay:calc(var(--i)*35ms + 80ms)}
.m-cascade .mi:active,.m-cascade .mi:hover{color:var(--text)}`,
  build(ctx) {
    const root = el(`<div class="mx m-cascade">${burger()}<div class="sheet">${ctx.data.map((g, s) => `
      <div class="sec" style="--s:${s}"><button class="sh" data-g="${s}">${ic(g.icon)}<span>${esc(g.label)}</span><em>${g.items.length}</em>${ic("down", "chev")}</button>
      <div class="body"><div>${itemsHTML(g)}</div></div></div>`).join("")}</div></div>`);
    ctx.layer.appendChild(root);
    const trig = root.querySelector(".trig");
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); };
    trig.onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".sh").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } b.parentElement.classList.toggle("open"); });
    onItem(root, ctx, () => set(false));
    return { open() { set(true); setTimeout(() => root.querySelector(".sec")?.classList.add("open"), 500); }, close() { set(false); } };
  } });

addMenu({ id: "ledger", cat: "Accordion", name: "Glass Ledger", desc: "A bottom sheet where only one section is open at a time. Pages pop in as an icon grid.",
  css: `
.m-ledger .scrim{position:absolute;inset:0;background:rgba(0,0,0,.45);opacity:0;transition:opacity .4s;pointer-events:none}
.m-ledger.on .scrim{opacity:1;pointer-events:auto}
.m-ledger .sheet{position:absolute;left:8px;right:8px;bottom:8px;max-height:82%;overflow:auto;border-radius:24px;padding:10px 10px 14px;background:color-mix(in srgb,var(--surface) 78%,transparent);backdrop-filter:blur(22px) saturate(1.4);-webkit-backdrop-filter:blur(22px) saturate(1.4);border:1px solid color-mix(in srgb,var(--metal) 18%,transparent);transform:translateY(110%);transition:transform .55s var(--spring);pointer-events:auto}
.m-ledger.on .sheet{transform:none}
.m-ledger .grab{width:42px;height:5px;border-radius:3px;background:var(--line);margin:2px auto 10px}
.m-ledger .sh{display:flex;align-items:center;gap:12px;width:100%;padding:12px 12px;border-radius:14px;font-weight:700;text-align:left;transition:background .3s,color .3s}
.m-ledger .sec.open .sh{background:var(--accent);color:var(--on-accent)}
.m-ledger .sh .chev{margin-left:auto;transition:transform .35s var(--spring)}
.m-ledger .sec.open .chev{transform:rotate(90deg)}
.m-ledger .body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s var(--ease)}
.m-ledger .sec.open .body{grid-template-rows:1fr}
.m-ledger .body>div{overflow:hidden;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 4px}
.m-ledger .sec.open .body>div{padding:8px 4px 6px}
.m-ledger .mi{display:grid;justify-items:center;gap:6px;padding:10px 4px;border-radius:12px;background:var(--surface2);font-size:11.5px;font-weight:600;line-height:1.2;text-align:center;transform:scale(.6);opacity:0;transition:transform .45s var(--spring),opacity .3s}
.m-ledger .mi .ic{width:20px;height:20px;color:var(--accent)}
.m-ledger .sec.open .mi{transform:none;opacity:1;transition-delay:calc(var(--i)*30ms + 60ms)}
.m-ledger .launch{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;padding:12px 18px;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:800;pointer-events:auto;box-shadow:0 10px 30px -8px var(--accent);transition:transform .4s var(--spring),opacity .3s}
.m-ledger.on .launch{transform:translate(-50%,90px);opacity:0}`,
  build(ctx) {
    const root = el(`<div class="mx m-ledger"><button class="launch">${ic("menu")}Menu</button><div class="scrim"></div><div class="sheet"><div class="grab"></div>${ctx.data.map((g, s) => `
      <div class="sec"><button class="sh" data-g="${s}">${ic(g.icon)}<span>${esc(g.label)}</span>${ic("right", "chev")}</button><div class="body"><div>${itemsHTML(g)}</div></div></div>`).join("")}</div></div>`);
    ctx.layer.appendChild(root);
    const set = v => root.classList.toggle("on", v);
    root.querySelector(".launch").onclick = () => set(true);
    root.querySelector(".scrim").onclick = () => set(false);
    const secs = [...root.querySelectorAll(".sec")];
    root.querySelectorAll(".sh").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } const sec = b.parentElement; const was = sec.classList.contains("open"); secs.forEach(x => x.classList.remove("open")); if (!was) sec.classList.add("open"); });
    onItem(root, ctx, () => set(false));
    return { open() { set(true); setTimeout(() => secs[0]?.querySelector(".sh").click(), 450); }, close() { set(false); } };
  } });

/* ---------- SIDE BAR ---------- */
addMenu({ id: "depth", cat: "Side Bar", name: "Depth Drawer", desc: "The page tilts back in 3D and slides away while the drawer slides in from the left.",
  css: `
.m-depth .drawer{position:absolute;top:0;bottom:0;left:0;width:74%;padding:70px 10px 20px 16px;overflow:auto;transform:translateX(-105%);transition:transform .6s var(--ease);pointer-events:auto}
.m-depth.on .drawer{transform:none}
.m-depth .drawer h4{margin:0 0 10px 6px;font-family:var(--f-mono);font-size:10px;letter-spacing:.16em;color:var(--accent);text-transform:uppercase}
.m-depth .g{display:flex;align-items:center;gap:12px;width:100%;padding:11px 8px;border-radius:12px;font-weight:700;text-align:left;opacity:0;transform:translateX(-24px);transition:opacity .35s,transform .5s var(--ease),background .2s}
.m-depth.on .g{opacity:1;transform:none;transition-delay:calc(var(--i)*40ms + .18s)}
.m-depth .g.sel{background:var(--surface2)}
.m-depth .g .ic:first-child{color:var(--accent)}
.m-depth .subs{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s var(--ease)}
.m-depth .subs.open{grid-template-rows:1fr}
.m-depth .subs>div{overflow:hidden;padding-left:30px;border-left:1px solid var(--line);margin-left:18px}
.m-depth .mi{display:flex;gap:10px;align-items:center;width:100%;padding:8px;font-size:13.5px;color:var(--muted);text-align:left}
.m-depth .mi .ic{width:16px;height:16px}
.scr-depth{transform:perspective(900px) translateX(68%) scale(.84) rotateY(-14deg)!important;border-radius:26px;box-shadow:-30px 0 60px rgba(0,0,0,.5);pointer-events:none}`,
  build(ctx) {
    const root = el(`<div class="mx m-depth">${burger("left")}<nav class="drawer"><h4>StormSync Weather</h4>${ctx.data.map((g, s) => `
      <button class="g" style="--i:${s}" data-g="${s}">${ic(g.icon)}<span>${esc(g.label)}</span></button><div class="subs"><div>${itemsHTML(g)}</div></div>`).join("")}</nav></div>`);
    ctx.layer.appendChild(root);
    ctx.stage.style.background = "radial-gradient(120% 80% at 0% 50%, color-mix(in srgb,var(--accent) 22%,var(--surface)), var(--bg))";
    const trig = root.querySelector(".trig");
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); ctx.screen.classList.toggle("scr-depth", v); };
    trig.onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".g").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } b.classList.toggle("sel"); b.nextElementSibling.classList.toggle("open"); });
    onItem(root, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "rail", cat: "Side Bar", name: "Expanding Rail", desc: "An icon rail that is always there. Tap the top button and it widens to show names; tap an icon and its pages fly out.",
  css: `
.m-rail .rail{position:absolute;top:56px;bottom:12px;left:8px;width:230px;border-radius:20px;background:color-mix(in srgb,var(--surface) 92%,transparent);border:1px solid var(--line);transform:translateX(-174px);transition:transform .5s var(--ease);pointer-events:auto;padding:8px;display:flex;flex-direction:column;gap:2px;overflow:auto;scrollbar-width:none}
.m-rail.wide .rail{transform:none;box-shadow:20px 0 50px rgba(0,0,0,.4)}
.m-rail .rb{display:flex;flex-direction:row-reverse;justify-content:flex-end;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;font-weight:700;font-size:14px;text-align:left;position:relative}
.m-rail .rb span{opacity:0;transform:translateX(-8px);transition:opacity .3s,transform .4s var(--ease);white-space:nowrap}
.m-rail.wide .rb span{opacity:1;transform:none;transition-delay:calc(var(--i)*25ms + .1s)}
.m-rail .rb .ic{margin-left:auto;flex:none}
.m-rail .rb.sel{background:var(--accent);color:var(--on-accent)}
.m-rail .toggle{justify-content:flex-start;color:var(--accent)}
.m-rail .fly{position:absolute;top:56px;left:72px;right:10px;max-height:calc(100% - 70px);overflow:auto;padding:10px;border-radius:18px;background:var(--surface2);border:1px solid var(--line);transform-origin:left top;transform:scale(.85) translateX(-16px);opacity:0;pointer-events:none;transition:transform .45s var(--spring),opacity .25s}
.m-rail .fly.on{transform:none;opacity:1;pointer-events:auto}
.m-rail.wide .fly{left:246px}
.m-rail .fly h5{margin:2px 6px 8px;font-family:var(--f-display);font-size:20px;text-transform:uppercase}
.m-rail .mi{display:flex;gap:10px;align-items:center;width:100%;padding:9px 8px;border-radius:10px;font-size:13.5px;text-align:left}
.m-rail .mi:hover{background:var(--surface)}
.m-rail .mi .ic{color:var(--accent);width:16px;height:16px}
.scr-rail{transform:translateX(58px) scale(.98);}`,
  build(ctx) {
    const root = el(`<div class="mx m-rail"><nav class="rail"><button class="rb toggle" style="--i:0"><span>Collapse</span>${ic("menu")}</button>${ctx.data.map((g, s) => `<button class="rb" style="--i:${s + 1}" data-g="${s}"><span>${esc(g.label)}</span>${ic(g.icon)}</button>`).join("")}</nav><div class="fly"></div></div>`);
    ctx.layer.appendChild(root);
    ctx.screen.classList.add("scr-rail");
    const fly = root.querySelector(".fly");
    const btns = [...root.querySelectorAll(".rb[data-g]")];
    root.querySelector(".toggle").onclick = () => root.classList.toggle("wide");
    btns.forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); return; } const was = b.classList.contains("sel"); btns.forEach(x => x.classList.remove("sel")); fly.classList.remove("on"); if (was) return; b.classList.add("sel"); setTimeout(() => { fly.innerHTML = `<h5>${esc(g.label)}</h5>${itemsHTML(g)}`; fly.classList.add("on"); }, 120); });
    onItem(fly, ctx, () => { fly.classList.remove("on"); btns.forEach(x => x.classList.remove("sel")); root.classList.remove("wide"); });
    return { open() { root.classList.add("wide"); }, close() { root.classList.remove("wide"); fly.classList.remove("on"); }, destroy() { ctx.screen.classList.remove("scr-rail"); } };
  } });

addMenu({ id: "split", cat: "Side Bar", name: "Split Sidebar", desc: "Sections on the left, their pages on the right. Switching sections slides the list.",
  css: `
.m-split .scrim{position:absolute;inset:0;background:rgba(0,0,0,.5);opacity:0;transition:opacity .4s;pointer-events:none}
.m-split.on .scrim{opacity:1;pointer-events:auto}
.m-split .pane{position:absolute;top:0;bottom:0;left:0;width:88%;display:grid;grid-template-columns:64px 1fr;background:var(--surface);transform:translateX(-102%);transition:transform .55s var(--ease);pointer-events:auto;border-radius:0 26px 26px 0;overflow:hidden}
.m-split.on .pane{transform:none}
.m-split .cols{background:var(--bg);padding:60px 8px 10px;display:flex;flex-direction:column;gap:6px;overflow:auto;scrollbar-width:none}
.m-split .cb{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:var(--surface);transition:border-radius .3s,background .3s,color .3s;color:var(--muted)}
.m-split .cb.sel{border-radius:14px;background:var(--accent);color:var(--on-accent)}
.m-split .list{padding:60px 12px 16px;overflow:auto}
.m-split .list h5{margin:0 0 2px;font-family:var(--f-display);font-size:24px;text-transform:uppercase}
.m-split .list p{margin:0 0 10px;font-size:12px;color:var(--muted)}
.m-split .inner{transition:transform .35s var(--ease),opacity .25s}
.m-split .inner.out{transform:translateY(14px);opacity:0}
.m-split .mi{display:flex;gap:10px;align-items:center;width:100%;padding:11px 10px;border-radius:12px;font-size:14px;text-align:left;font-weight:600}
.m-split .mi:hover{background:var(--surface2)}
.m-split .mi .ic{color:var(--accent);width:17px;height:17px}`,
  build(ctx) {
    const root = el(`<div class="mx m-split">${burger("left")}<div class="scrim"></div><nav class="pane"><div class="cols">${ctx.data.map((g, s) => `<button class="cb" data-g="${s}" aria-label="${esc(g.label)}">${ic(g.icon)}</button>`).join("")}</div><div class="list"><div class="inner"></div></div></nav></div>`);
    ctx.layer.appendChild(root);
    const trig = root.querySelector(".trig"), inner = root.querySelector(".inner");
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); };
    const show = s => { const g = ctx.data[s]; root.querySelectorAll(".cb").forEach((b, i) => b.classList.toggle("sel", i == s)); inner.classList.add("out"); setTimeout(() => { inner.innerHTML = `<h5>${esc(g.label)}</h5><p>${g.items.length} page${g.items.length > 1 ? "s" : ""}</p>${itemsHTML(g)}`; inner.classList.remove("out"); }, 160); };
    trig.onclick = () => set(!root.classList.contains("on"));
    root.querySelector(".scrim").onclick = () => set(false);
    root.querySelectorAll(".cb").forEach(b => b.onclick = () => show(b.dataset.g));
    onItem(inner, ctx, () => set(false));
    show(0);
    return { open() { set(true); }, close() { set(false); } };
  } });

/* ---------- MEGA ---------- */
addMenu({ id: "megagrid", cat: "Mega", name: "Mega Grid", desc: "Every page at once. The panel unfolds from the header and each column cascades in.",
  css: `
.m-megagrid .mbtn{position:absolute;top:30px;right:12px;display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:var(--surface2);border:1px solid var(--line);font-weight:700;font-size:13px;pointer-events:auto;z-index:2}
.m-megagrid .mbtn .ic{transition:transform .4s var(--spring)}
.m-megagrid.on .mbtn .ic{transform:rotate(180deg)}
.m-megagrid .panel{position:absolute;top:70px;left:8px;right:8px;bottom:8px;border-radius:22px;background:color-mix(in srgb,var(--surface) 94%,transparent);border:1px solid var(--line);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);overflow:auto;padding:14px;columns:2;column-gap:14px;transform-origin:top center;transform:scaleY(.4) translateY(-30px);opacity:0;pointer-events:none;transition:transform .5s var(--ease),opacity .3s}
.m-megagrid.on .panel{transform:none;opacity:1;pointer-events:auto}
.m-megagrid .col{break-inside:avoid;margin-bottom:14px;opacity:0;transform:translateY(12px);transition:opacity .35s,transform .45s var(--ease)}
.m-megagrid.on .col{opacity:1;transform:none;transition-delay:calc(var(--i)*45ms + .15s)}
.m-megagrid .col h5{display:flex;align-items:center;gap:6px;margin:0 0 4px;font-family:var(--f-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.m-megagrid .col h5 .ic{width:13px;height:13px}
.m-megagrid .mi{display:block;width:100%;padding:5px 0;font-size:13px;text-align:left;color:var(--text);opacity:.86}
.m-megagrid .mi .ic{display:none}
.m-megagrid .mi:hover{color:var(--accent);opacity:1}`,
  build(ctx) {
    const root = el(`<div class="mx m-megagrid"><button class="mbtn">Explore ${ic("down")}</button><div class="panel">${ctx.data.map((g, s) => `<div class="col" style="--i:${s}"><h5>${ic(g.icon)}${esc(g.label)}</h5>${itemsHTML(g)}</div>`).join("")}</div></div>`);
    ctx.layer.appendChild(root);
    const set = v => root.classList.toggle("on", v);
    root.querySelector(".mbtn").onclick = () => set(!root.classList.contains("on"));
    onItem(root, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "spotlight", cat: "Mega", name: "Mega Spotlight", desc: "Pick a section and a feature card glows up for it, with its pages underneath.",
  css: `
.m-spotlight .panel{position:absolute;inset:66px 8px 8px;border-radius:22px;background:var(--surface);border:1px solid var(--line);display:grid;grid-template-rows:auto 1fr;overflow:hidden;transform:translateY(-16px) scale(.96);opacity:0;pointer-events:none;transition:transform .5s var(--spring),opacity .3s}
.m-spotlight.on .panel{transform:none;opacity:1;pointer-events:auto}
.m-spotlight .cats{display:flex;gap:6px;overflow:auto;padding:10px;scrollbar-width:none;border-bottom:1px solid var(--line)}
.m-spotlight .cb{flex:none;display:flex;gap:6px;align-items:center;padding:7px 11px;border-radius:999px;font-size:12.5px;font-weight:700;color:var(--muted);border:1px solid var(--line);transition:background .3s,color .3s}
.m-spotlight .cb.sel{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.m-spotlight .cb .ic{width:14px;height:14px}
.m-spotlight .body{overflow:auto;padding:12px}
.m-spotlight .hero{position:relative;height:118px;border-radius:18px;overflow:hidden;padding:14px;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 70%,var(--bg)),color-mix(in srgb,var(--accent2) 60%,var(--bg)));color:#fff;margin-bottom:10px}
.m-spotlight .hero .big{position:absolute;right:-10px;top:-10px;width:120px;height:120px;opacity:.22;animation:spin 18s linear infinite}
.m-spotlight .hero b{font-family:var(--f-display);font-size:28px;text-transform:uppercase;line-height:1}
.m-spotlight .hero small{font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;opacity:.85}
.m-spotlight .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.m-spotlight .mi{display:flex;gap:8px;align-items:center;padding:10px;border-radius:12px;background:var(--surface2);font-size:12.5px;font-weight:600;text-align:left;line-height:1.2;opacity:0;transform:translateY(8px);animation:pop .4s var(--ease) forwards;animation-delay:calc(var(--i)*30ms)}
.m-spotlight .mi .ic{color:var(--accent);width:16px;height:16px}
.m-spotlight .fade{animation:pop .45s var(--ease)}
@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}`,
  build(ctx) {
    const root = el(`<div class="mx m-spotlight">${burger()}<div class="panel"><div class="cats">${ctx.data.map((g, s) => `<button class="cb" data-g="${s}">${ic(g.icon)}${esc(g.label)}</button>`).join("")}</div><div class="body"></div></div></div>`);
    ctx.layer.appendChild(root);
    const trig = root.querySelector(".trig"), body = root.querySelector(".body");
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); };
    const show = s => { const g = ctx.data[s]; root.querySelectorAll(".cb").forEach((b, i) => b.classList.toggle("sel", i == s)); body.innerHTML = `<div class="hero fade">${ic(g.icon, "big")}<small>${g.items.length} PAGE${g.items.length > 1 ? "S" : ""}</small><b>${esc(g.label)}</b></div><div class="grid">${itemsHTML(g)}</div>`; };
    trig.onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".cb").forEach(b => b.onclick = () => show(b.dataset.g));
    onItem(body, ctx, () => set(false));
    show(0);
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "command", cat: "Mega", name: "Command Mega", desc: "Search first. Type a few letters and every page in the app filters live.",
  css: `
.m-command .sbtn{position:absolute;top:30px;right:12px;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--surface2);border:1px solid var(--line);pointer-events:auto}
.m-command .scrim{position:absolute;inset:0;background:color-mix(in srgb,var(--bg) 60%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .3s}
.m-command.on .scrim{opacity:1;pointer-events:auto}
.m-command .box{position:absolute;top:60px;left:10px;right:10px;bottom:10px;display:flex;flex-direction:column;border-radius:20px;background:var(--surface);border:1px solid var(--line);overflow:hidden;transform:translateY(-10px) scale(.97);opacity:0;pointer-events:none;transition:transform .4s var(--spring),opacity .25s}
.m-command.on .box{transform:none;opacity:1;pointer-events:auto}
.m-command .q{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid var(--line)}
.m-command .q .ic{color:var(--accent)}
.m-command input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--text);font:600 16px var(--f-body)}
.m-command .res{overflow:auto;padding:8px}
.m-command .grp{font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:10px 8px 4px}
.m-command .mi{display:flex;gap:10px;align-items:center;width:100%;padding:10px 8px;border-radius:10px;text-align:left;font-size:14px}
.m-command .mi .ic{color:var(--accent);width:16px;height:16px}
.m-command .mi:hover,.m-command .mi.hl{background:var(--surface2)}
.m-command mark{background:none;color:var(--accent);font-weight:800}
.m-command .none{padding:20px 8px;color:var(--muted);font-size:13px}`,
  build(ctx) {
    const root = el(`<div class="mx m-command"><button class="sbtn" aria-label="Search pages">${ic("search")}</button><div class="scrim"></div><div class="box"><div class="q">${ic("search")}<input id="cmdq" placeholder="Search 45 pages" autocomplete="off"><button class="close" aria-label="Close">${ic("x")}</button></div><div class="res"></div></div></div>`);
    ctx.layer.appendChild(root);
    const input = root.querySelector("input"), res = root.querySelector(".res");
    const set = v => { root.classList.toggle("on", v); if (v) setTimeout(() => input.focus({ preventScroll: true }), 300); };
    const render = q => { q = q.trim().toLowerCase(); let html = ""; ctx.data.forEach(g => { const hits = g.items.filter(i => !q || i.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)); if (!hits.length) return; html += `<div class="grp">${esc(g.label)}</div>` + hits.map(it => { let lab = esc(it.label); if (q) { const k = it.label.toLowerCase().indexOf(q); if (k >= 0) lab = esc(it.label.slice(0, k)) + "<mark>" + esc(it.label.slice(k, k + q.length)) + "</mark>" + esc(it.label.slice(k + q.length)); } return `<button class="mi" data-label="${esc(it.label)}">${ic(it.icon)}<span>${lab}</span></button>`; }).join(""); }); res.innerHTML = html || `<div class="none">No page matches “${esc(q)}”.</div>`; };
    input.oninput = () => render(input.value);
    root.querySelector(".sbtn").onclick = () => set(true);
    root.querySelector(".close").onclick = root.querySelector(".scrim").onclick = () => set(false);
    onItem(res, ctx, () => set(false));
    render("");
    return { open() { set(true); }, close() { set(false); } };
  } });

/* ---------- BENTO ---------- */
const BENTO_SPANS = ["w2", "", "", "w2 h2", "", "", "w2", "", ""];
addMenu({ id: "bentoboard", cat: "Bento", name: "Bento Board", desc: "Sections as tiles of different sizes. Tap one and its pages rise up in a sheet.",
  css: `
.m-bentoboard .board{position:absolute;inset:0;padding:66px 10px 10px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:minmax(78px,1fr);gap:8px;overflow:auto;opacity:0;pointer-events:none;transition:opacity .3s}
.m-bentoboard.on .board{opacity:1;pointer-events:auto}
.m-bentoboard .t{position:relative;border-radius:18px;padding:10px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;background:var(--surface);border:1px solid var(--line);overflow:hidden;transform:scale(.7);opacity:0;transition:transform .5s var(--spring),opacity .3s}
.m-bentoboard.on .t{transform:none;opacity:1;transition-delay:calc(var(--i)*40ms)}
.m-bentoboard .t.w2{grid-column:span 2}
.m-bentoboard .t.h2{grid-row:span 2;background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 45%,var(--surface)),var(--surface))}
.m-bentoboard .t .ic{width:22px;height:22px;color:var(--accent)}
.m-bentoboard .t.h2 .ic{width:34px;height:34px;color:var(--text)}
.m-bentoboard .t b{font-size:13px;line-height:1.15}
.m-bentoboard .t.h2 b{font-family:var(--f-display);font-size:24px;text-transform:uppercase}
.m-bentoboard .t em{position:absolute;top:10px;right:10px;font-style:normal;font-family:var(--f-mono);font-size:10px;color:var(--muted)}
.m-bentoboard .sheet{position:absolute;left:0;right:0;bottom:0;max-height:70%;overflow:auto;padding:14px 12px 16px;border-radius:24px 24px 0 0;background:var(--surface2);transform:translateY(102%);transition:transform .5s var(--spring);pointer-events:auto}
.m-bentoboard .sheet.on{transform:none}
.m-bentoboard .sheet h5{display:flex;justify-content:space-between;align-items:center;margin:0 0 8px;font-family:var(--f-display);font-size:22px;text-transform:uppercase}
.m-bentoboard .mi{display:flex;gap:10px;align-items:center;width:100%;padding:11px 8px;border-radius:12px;text-align:left;font-weight:600;font-size:14px}
.m-bentoboard .mi .ic{color:var(--accent);width:17px;height:17px}`,
  build(ctx) {
    const root = el(`<div class="mx m-bentoboard">${burger()}<div class="board">${ctx.data.map((g, s) => `<button class="t ${BENTO_SPANS[s] || ""}" style="--i:${s}" data-g="${s}">${ic(g.icon)}<em>${g.items.length}</em><b>${esc(g.label)}</b></button>`).join("")}</div><div class="sheet"></div></div>`);
    ctx.layer.appendChild(root);
    const trig = root.querySelector(".trig"), sheet = root.querySelector(".sheet");
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); if (!v) sheet.classList.remove("on"); };
    trig.onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".t").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } sheet.innerHTML = `<h5>${esc(g.label)}<button class="x" aria-label="Back">${ic("x")}</button></h5>${itemsHTML(g)}`; sheet.querySelector(".x").onclick = () => sheet.classList.remove("on"); requestAnimationFrame(() => sheet.classList.add("on")); });
    onItem(sheet, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

const LIVE_FX = { home: "pulse", local: "spin", community: "pulse", severe: "flash", tools: "sweep", specialty: "twinkle", edu: "float", else: "float", account: "pulse", archive: "sweep", chaselog: "float" };
addMenu({ id: "bentolive", cat: "Bento", name: "Live Bento", desc: "Each tile is alive: radar sweeps, lightning flickers, stars twinkle. Tapping a tile zooms it to full screen.",
  css: `
.m-bentolive .board{position:absolute;inset:0;padding:66px 10px 10px;background:var(--bg);display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:92px;gap:8px;overflow:auto;transform:scale(1.06);opacity:0;pointer-events:none;transition:opacity .35s,transform .5s var(--ease)}
.m-bentolive.on .board{opacity:1;transform:none;pointer-events:auto}
.m-bentolive .t{position:relative;overflow:hidden;border-radius:20px;padding:12px;text-align:left;display:flex;flex-direction:column;justify-content:flex-end;background:var(--surface);border:1px solid var(--line)}
.m-bentolive .t:nth-child(3n+1){grid-row:span 2}
.m-bentolive .t b{position:relative;z-index:1;font-size:14px}
.m-bentolive .t small{position:relative;z-index:1;font-family:var(--f-mono);font-size:10px;color:var(--muted)}
.m-bentolive .fx{position:absolute;inset:0;display:grid;place-items:center}
.m-bentolive .fx .ic{width:44px;height:44px;color:var(--accent);opacity:.9}
.m-bentolive .sweep::before{content:"";position:absolute;width:180%;aspect-ratio:1;background:conic-gradient(from 0deg,transparent 0 300deg,color-mix(in srgb,var(--accent) 55%,transparent) 360deg);animation:lv-spin 2.6s linear infinite;border-radius:50%}
.m-bentolive .flash .ic{animation:lv-flash 2.2s infinite}
.m-bentolive .spin .ic{animation:lv-spin 9s linear infinite}
.m-bentolive .pulse .ic{animation:lv-pulse 1.8s var(--ease) infinite}
.m-bentolive .float .ic{animation:lv-float 3s ease-in-out infinite}
.m-bentolive .twinkle::before,.m-bentolive .twinkle::after{content:"✦";position:absolute;color:var(--accent2);font-size:12px;top:20%;left:22%;animation:lv-tw 1.6s infinite}
.m-bentolive .twinkle::after{top:30%;left:70%;font-size:9px;animation-delay:.7s}
.m-bentolive .zoom{position:absolute;z-index:3;border-radius:20px;background:var(--surface2);overflow:hidden;transform-origin:0 0;pointer-events:auto;display:flex;flex-direction:column}
.m-bentolive .zoom .zin{position:absolute;inset:0;padding:64px 14px 14px;overflow:auto;opacity:0;transition:opacity .25s}
.m-bentolive .zoom.full .zin{opacity:1;transition-delay:.25s}
.m-bentolive .zoom h5{margin:0 0 10px;display:flex;align-items:center;gap:10px;font-family:var(--f-display);font-size:26px;text-transform:uppercase}
.m-bentolive .zoom h5 .back{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface)}
.m-bentolive .mi{display:flex;gap:10px;align-items:center;width:100%;padding:12px 8px;border-bottom:1px solid var(--line);text-align:left;font-weight:600}
.m-bentolive .mi .ic{color:var(--accent);width:18px;height:18px}
@keyframes lv-spin{to{transform:rotate(360deg)}}
@keyframes lv-flash{0%,62%,70%,100%{opacity:.35}64%,68%,74%{opacity:1}}
@keyframes lv-pulse{50%{transform:scale(1.18)}}
@keyframes lv-float{50%{transform:translateY(-6px)}}
@keyframes lv-tw{50%{opacity:.1;transform:scale(.6)}}`,
  build(ctx) {
    const root = el(`<div class="mx m-bentolive">${burger()}<div class="board">${ctx.data.map((g, s) => `<button class="t" data-g="${s}"><span class="fx ${LIVE_FX[g.id] || "pulse"}">${ic(g.icon)}</span><small>${g.items.length} PAGE${g.items.length > 1 ? "S" : ""}</small><b>${esc(g.label)}</b></button>`).join("")}</div></div>`);
    ctx.layer.appendChild(root);
    const trig = root.querySelector(".trig");
    let zoom = null;
    const closeZoom = () => { if (!zoom) return; const z = zoom; zoom = null; z.classList.remove("full"); z.style.transform = z.dataset.from; setTimeout(() => z.remove(), 450); };
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); if (!v) closeZoom(); };
    trig.onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".t").forEach(t => t.onclick = () => {
      const g = ctx.data[t.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; }
      const W = ctx.layer.clientWidth, H = ctx.layer.clientHeight, r = t.getBoundingClientRect(), L = ctx.layer.getBoundingClientRect();
      const z = el(`<div class="zoom"><div class="zin"><h5><button class="back" aria-label="Back">${ic("back")}</button>${esc(g.label)}</h5>${itemsHTML(g)}</div></div>`);
      z.style.cssText = `left:0;top:0;width:${W}px;height:${H}px;transition:transform .5s cubic-bezier(.2,.8,.2,1)`;
      const from = `translate(${r.left - L.left}px,${r.top - L.top}px) scale(${r.width / W},${r.height / H})`;
      z.dataset.from = from; z.style.transform = from; root.appendChild(z); zoom = z;
      requestAnimationFrame(() => requestAnimationFrame(() => { z.style.transform = "none"; z.classList.add("full"); }));
      z.querySelector(".back").onclick = closeZoom; onItem(z, ctx, () => set(false));
    });
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "flip", cat: "Bento", name: "Flip Tiles", desc: "Tiles turn over in 3D to show their pages on the back. Tap the back to flip it home.",
  css: `
.m-flip .board{position:absolute;inset:0;padding:66px 10px 10px;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:150px;gap:8px;overflow:auto;opacity:0;pointer-events:none;transition:opacity .3s}
.m-flip.on .board{opacity:1;pointer-events:auto}
.m-flip .t{perspective:700px;opacity:0;transform:translateY(20px);transition:opacity .35s,transform .5s var(--ease)}
.m-flip.on .t{opacity:1;transform:none;transition-delay:calc(var(--i)*35ms)}
.m-flip .t.big{grid-column:span 2;grid-row:span 2}
.m-flip .card{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .7s var(--spring)}
.m-flip .t.flipped .card{transform:rotateY(180deg)}
.m-flip .face{position:absolute;inset:0;border-radius:18px;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:1px solid var(--line);overflow:hidden}
.m-flip .front{display:flex;flex-direction:column;justify-content:space-between;padding:12px;background:radial-gradient(120% 120% at 100% 0%,color-mix(in srgb,var(--accent) 30%,var(--surface)),var(--surface));text-align:left;width:100%}
.m-flip .front .ic{width:28px;height:28px;color:var(--accent)}
.m-flip .front b{font-family:var(--f-display);font-size:20px;text-transform:uppercase;line-height:1}
.m-flip .back{transform:rotateY(180deg);background:var(--surface2);padding:8px;overflow:auto}
.m-flip .mi{display:flex;gap:8px;align-items:center;width:100%;padding:7px 6px;border-radius:8px;font-size:12.5px;font-weight:600;text-align:left}
.m-flip .mi .ic{color:var(--accent);width:14px;height:14px}
.m-flip .t.big .back{display:grid;grid-template-columns:1fr 1fr;align-content:start}`,
  build(ctx) {
    const root = el(`<div class="mx m-flip">${burger()}<div class="board">${ctx.data.map((g, s) => `<div class="t ${g.items.length > 8 ? "big" : ""}" style="--i:${s}"><div class="card"><button class="face front" data-g="${s}">${ic(g.icon)}<b>${esc(g.label)}</b></button><div class="face back">${itemsHTML(g)}</div></div></div>`).join("")}</div></div>`);
    ctx.layer.appendChild(root);
    const trig = root.querySelector(".trig");
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); if (!v) root.querySelectorAll(".flipped").forEach(x => x.classList.remove("flipped")); };
    trig.onclick = () => set(!root.classList.contains("on"));
    root.querySelectorAll(".front").forEach(b => b.onclick = () => { const g = ctx.data[b.dataset.g]; const solo = soloLabel(g); if (solo) { ctx.nav(solo); set(false); return; } root.querySelectorAll(".flipped").forEach(x => x.classList.remove("flipped")); b.closest(".t").classList.add("flipped"); });
    root.querySelectorAll(".back").forEach(b => b.addEventListener("click", e => { if (!e.target.closest("[data-label]")) b.closest(".t").classList.remove("flipped"); }));
    onItem(root, ctx, () => set(false));
    return { open() { set(true); setTimeout(() => root.querySelector(".t.big .front, .front")?.click(), 700); }, close() { set(false); } };
  } });

/* ---------- TABBED ---------- */
addMenu({ id: "tabsheet", cat: "Tabbed", name: "Tab Bar + Sheet", desc: "A classic bottom tab bar. A sliding light marks the tab, and its pages rise in a sheet.",
  css: `
.m-tabsheet .bar{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);padding:8px 6px 14px;background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--line);pointer-events:auto;z-index:2}
.m-tabsheet .tb{position:relative;display:grid;justify-items:center;gap:3px;padding:6px 0;font-size:10.5px;font-weight:700;color:var(--muted);transition:color .3s}
.m-tabsheet .tb.sel{color:var(--text)}
.m-tabsheet .tb .ic{width:22px;height:22px;transition:transform .4s var(--spring)}
.m-tabsheet .tb.sel .ic{transform:translateY(-2px) scale(1.1);color:var(--accent)}
.m-tabsheet .light{position:absolute;top:0;left:6px;height:3px;border-radius:0 0 4px 4px;background:var(--accent);box-shadow:0 0 16px 2px var(--accent);transition:transform .5s var(--spring)}
.m-tabsheet .scrim{position:absolute;inset:0;background:rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .3s}
.m-tabsheet.sheet-on .scrim{opacity:1;pointer-events:auto}
.m-tabsheet .sheet{position:absolute;left:8px;right:8px;bottom:76px;max-height:66%;overflow:auto;border-radius:22px;background:var(--surface2);border:1px solid var(--line);padding:10px;transform:translateY(30px) scale(.95);opacity:0;pointer-events:none;transition:transform .45s var(--spring),opacity .25s}
.m-tabsheet.sheet-on .sheet{transform:none;opacity:1;pointer-events:auto}
.m-tabsheet .sheet h6{margin:4px 6px 8px;font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.m-tabsheet .mi{display:flex;gap:10px;align-items:center;width:100%;padding:10px 8px;border-radius:10px;text-align:left;font-weight:600;font-size:14px}
.m-tabsheet .mi .ic{color:var(--accent);width:17px;height:17px}`,
  build(ctx) {
    const many = ctx.data.length > 5;
    const tabs = many ? ctx.data.slice(0, 4).map((g, i) => ({ g: [g], label: g.label.split(" ")[0], icon: g.icon })).concat([{ g: ctx.data.slice(4), label: "More", icon: "grid" }]) : ctx.data.map(g => ({ g: [g], label: g.label.split(" ")[0], icon: g.icon }));
    const root = el(`<div class="mx m-tabsheet"><div class="scrim"></div><div class="sheet"></div><nav class="bar" style="grid-template-columns:repeat(${tabs.length},1fr)"><span class="light"></span>${tabs.map((t, i) => `<button class="tb" data-t="${i}">${ic(t.icon)}<span>${esc(t.label)}</span></button>`).join("")}</nav></div>`);
    ctx.layer.appendChild(root);
    const sheet = root.querySelector(".sheet"), light = root.querySelector(".light"), tbs = [...root.querySelectorAll(".tb")];
    const place = i => { const b = tbs[i]; light.style.width = (b.offsetWidth - 12) + "px"; light.style.transform = `translateX(${b.offsetLeft}px)`; tbs.forEach((x, k) => x.classList.toggle("sel", k == i)); };
    const closeSheet = () => root.classList.remove("sheet-on");
    tbs.forEach((b, i) => b.onclick = () => { place(i); const t = tabs[i]; if (t.g.length === 1 && soloLabel(t.g[0])) { ctx.nav(soloLabel(t.g[0])); closeSheet(); return; } if (root.classList.contains("sheet-on") && sheet.dataset.t == i) { closeSheet(); return; } sheet.dataset.t = i; sheet.innerHTML = t.g.map(g => `<h6>${esc(g.label)}</h6>${itemsHTML(g)}`).join(""); root.classList.add("sheet-on"); });
    root.querySelector(".scrim").onclick = closeSheet;
    onItem(sheet, ctx, closeSheet);
    requestAnimationFrame(() => place(0));
    return { open() { tbs[Math.min(3, tbs.length - 1)].click(); }, close: closeSheet };
  } });

addMenu({ id: "scrolltabs", cat: "Tabbed", name: "Swipe Tabs", desc: "Sections as a scrolling tab strip with a sliding underline. Swipe the pages sideways and the tabs follow.",
  css: `
.m-scrolltabs .wrap2{position:absolute;inset:0;padding-top:62px;display:flex;flex-direction:column;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:0;pointer-events:none;transition:opacity .3s}
.m-scrolltabs.on .wrap2{opacity:1;pointer-events:auto}
.m-scrolltabs .strip{position:relative;display:flex;gap:2px;overflow:auto;padding:0 10px;scrollbar-width:none;border-bottom:1px solid var(--line);flex:none}
.m-scrolltabs .st{flex:none;padding:12px 10px;font-weight:700;font-size:13.5px;color:var(--muted);transition:color .3s;white-space:nowrap}
.m-scrolltabs .st.sel{color:var(--text)}
.m-scrolltabs .ul{position:absolute;bottom:0;left:0;height:3px;width:100px;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent2));transform-origin:0 0;transition:transform .45s var(--spring)}
.m-scrolltabs .pages{flex:1;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.m-scrolltabs .pg{flex:none;width:100%;scroll-snap-align:start;overflow:auto;padding:14px 12px}
.m-scrolltabs .pg h5{margin:0 0 10px;font-family:var(--f-display);font-size:30px;line-height:1;text-transform:uppercase;color:var(--accent)}
.m-scrolltabs .mi{display:flex;gap:12px;align-items:center;width:100%;padding:12px 10px;margin-bottom:6px;border-radius:14px;background:var(--surface);border:1px solid var(--line);text-align:left;font-weight:600}
.m-scrolltabs .mi .ic{color:var(--accent);width:18px;height:18px}`,
  build(ctx) {
    const root = el(`<div class="mx m-scrolltabs">${burger()}<div class="wrap2"><div class="strip">${ctx.data.map((g, s) => `<button class="st" data-g="${s}">${esc(g.label)}</button>`).join("")}<span class="ul"></span></div><div class="pages">${ctx.data.map(g => `<section class="pg"><h5>${esc(g.label)}</h5>${itemsHTML(g)}</section>`).join("")}</div></div></div>`);
    ctx.layer.appendChild(root);
    const trig = root.querySelector(".trig"), strip = root.querySelector(".strip"), pages = root.querySelector(".pages"), ul = root.querySelector(".ul"), sts = [...root.querySelectorAll(".st")];
    const set = v => { root.classList.toggle("on", v); trig.classList.toggle("open", v); if (v) requestAnimationFrame(() => mark(cur)); };
    let cur = 0;
    const mark = i => { cur = i; const b = sts[i]; ul.style.transform = `translateX(${b.offsetLeft}px) scaleX(${b.offsetWidth / 100})`; sts.forEach((x, k) => x.classList.toggle("sel", k == i)); strip.scrollTo({ left: b.offsetLeft - 40, behavior: "smooth" }); };
    sts.forEach((b, i) => b.onclick = () => { pages.scrollTo({ left: i * pages.clientWidth, behavior: "smooth" }); mark(i); });
    let raf; pages.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = Math.round(pages.scrollLeft / pages.clientWidth); if (i !== cur) mark(i); }); }, { passive: true });
    trig.onclick = () => set(!root.classList.contains("on"));
    onItem(pages, ctx, () => set(false));
    return { open() { set(true); }, close() { set(false); } };
  } });

addMenu({ id: "goo", cat: "Tabbed", name: "Gooey Tabs", desc: "A liquid blob stretches between tabs like mercury, and the section's pages spill out above it.",
  css: `
.m-goo .dock{position:absolute;left:10px;right:10px;bottom:12px;pointer-events:auto}
.m-goo .track{position:relative;height:62px;border-radius:22px;background:var(--surface);border:1px solid var(--line);display:flex;align-items:center;overflow:hidden}
.m-goo .blobs{position:absolute;inset:0;filter:url(#goo-f)}
.m-goo .blob{position:absolute;top:9px;left:0;width:44px;height:44px;border-radius:50%;background:var(--accent);transition:transform .55s var(--spring)}
.m-goo .blob.b2{transition-duration:.8s}
.m-goo .gt{position:relative;z-index:1;flex:1;height:100%;display:grid;place-items:center;color:var(--muted);transition:color .35s}
.m-goo .gt.sel{color:var(--on-accent)}
.m-goo .subs{display:flex;gap:6px;overflow:auto;padding:0 2px 10px;scrollbar-width:none}
.m-goo .mi{flex:none;display:flex;gap:6px;align-items:center;padding:9px 12px;border-radius:999px;background:var(--surface2);border:1px solid var(--line);font-size:12.5px;font-weight:700;opacity:0;transform:translateY(16px) scale(.8);animation:goo-in .45s var(--spring) forwards;animation-delay:calc(var(--i)*40ms)}
.m-goo .mi .ic{color:var(--accent);width:15px;height:15px}
.m-goo .cap{font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 4px 6px}
@keyframes goo-in{to{opacity:1;transform:none}}`,
  build(ctx) {
    const n = ctx.data.length;
    const root = el(`<div class="mx m-goo"><svg width="0" height="0" style="position:absolute"><filter id="goo-f"><feGaussianBlur in="SourceGraphic" stdDeviation="7"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10"/></filter></svg><div class="dock"><div class="cap"></div><div class="subs"></div><div class="track"><div class="blobs"><span class="blob"></span><span class="blob b2"></span></div>${ctx.data.map((g, s) => `<button class="gt" data-g="${s}" aria-label="${esc(g.label)}">${ic(g.icon)}</button>`).join("")}</div></div></div>`);
    ctx.layer.appendChild(root);
    const gts = [...root.querySelectorAll(".gt")], blobs = root.querySelectorAll(".blob"), subs = root.querySelector(".subs"), cap = root.querySelector(".cap");
    const sel = i => { const b = gts[i]; const x = b.offsetLeft + b.offsetWidth / 2 - 22; blobs.forEach(o => o.style.transform = `translateX(${x}px)`); gts.forEach((t, k) => t.classList.toggle("sel", k == i)); const g = ctx.data[i]; cap.textContent = g.label; subs.innerHTML = itemsHTML(g); };
    gts.forEach((b, i) => b.onclick = () => sel(i));
    onItem(subs, ctx);
    requestAnimationFrame(() => sel(0));
    return { open() { sel(Math.min(3, n - 1)); }, close() {} };
  } });
