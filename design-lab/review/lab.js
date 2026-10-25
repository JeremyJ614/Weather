/* Review Lab shell: tabs, item cards, picks saved to the artifact database, the menu stage and manager, Randoms, summary. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const LS = "sswx-review-picks";

  /* ---------- picks ---------- */
  const NEW_MENUS = () => [...MENUS.main.map((m) => ({ ...m, set: "main" })), ...MENUS.quick.map((m) => ({ ...m, set: "quick" }))];
  function baseMenus() {
    const out = {};
    for (const m of CURRENT_MENUS) out[m.id] = { m: m.main && m.remove !== "main", q: m.second && m.remove !== "second" };
    for (const m of NEW_MENUS()) out[m.id] = { m: false, q: false };
    return out;
  }
  const picks = { perf: [], pages: [], engines: [], randoms: [], adds: [], menus: baseMenus(), deerFish: { area: "conus", days: "d3" }, notes: {}, approved: null };
  let db = null, timer = 0, loaded = false;

  function status(s, text) { $("#save").dataset.s = s; $("#save-text").textContent = text; }
  function save() {
    render();
    try { localStorage.setItem(LS, JSON.stringify(picks)); } catch (e) {}
    if (!loaded) return;
    if (!db) { status("local", "Saved on this device only"); return; }
    clearTimeout(timer);
    status("busy", "Saving…");
    timer = setTimeout(async () => {
      try {
        await db.doc("review/picks").set({ ...picks, updatedAt: new Date().toISOString() });
        status("ok", "Saved · Claude can read your picks");
      } catch (e) {
        status("local", "Not saved online: " + (e && (e.message || e.code) || "unknown error") + ". Saved on this device.");
      }
    }, 450);
  }
  function merge(d) {
    if (!d || typeof d !== "object") return;
    for (const k of ["perf", "pages", "engines", "randoms", "adds"]) if (Array.isArray(d[k])) picks[k] = d[k].filter((x) => typeof x === "string");
    if (d.menus && typeof d.menus === "object") for (const [k, v] of Object.entries(d.menus)) if (picks.menus[k] && v) picks.menus[k] = { m: !!v.m, q: !!v.q };
    if (d.deerFish) picks.deerFish = { ...picks.deerFish, ...d.deerFish };
    if (d.notes && typeof d.notes === "object") picks.notes = { ...d.notes };
    picks.approved = d.approved || null;
  }
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1800); }
  const has = (list, id) => picks[list].includes(id);
  function toggle(list, id, on) {
    const i = picks[list].indexOf(id);
    if (on === undefined) on = i < 0;
    if (on && i < 0) picks[list].push(id);
    if (!on && i >= 0) picks[list].splice(i, 1);
    save();
  }

  /* ---------- tabs ---------- */
  let tab = "perf";
  function show(p) {
    tab = p;
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.p === p)));
    $$("section.panel").forEach((s) => (s.hidden = s.id !== p));
    try { localStorage.setItem("sswx-review-tab", p); } catch (e) {}
    if (p === "menus") mountMenu(mIdx); else unmountMenu();
    if (p === "randoms") mountRandom(rId); else unmountRandom();
  }
  $$(".tab").forEach((t) => (t.onclick = () => { show(t.dataset.p); scrollTo({ top: $(".tabs").offsetTop - 4, behavior: "smooth" }); }));

  /* ---------- cards ---------- */
  const stars = (n) => `<span class="stars" aria-label="${n} of 5">${"★".repeat(n)}<s>${"★".repeat(5 - n)}</s></span>`;
  const pcList = (pros, cons) => `<div class="pc"><div class="pro"><h4>Pros</h4><ul>${pros.map((x) => `<li>${icon("Check")}<span>${x}</span></li>`).join("")}</ul></div><div class="con"><h4>Cons</h4><ul>${cons.map((x) => `<li>${icon("Minus")}<span>${x}</span></li>`).join("")}</ul></div></div>`;
  const storeChip = ([tone, text]) => `<span class="chip ${tone}">${icon(tone === "none" ? "ShieldCheck" : tone === "saves" ? "Database" : "HardDrive")}<span><b>Storage:</b> ${text}</span></span>`;
  function pickBtn(list, id) {
    const b = K.h("button", "pick");
    b.type = "button";
    const sync = () => { const on = has(list, id); b.setAttribute("aria-pressed", String(on)); b.innerHTML = on ? `${icon("Check")} Added` : `${icon("Plus")} Add this`; b.closest(".card")?.toggleAttribute("data-on", on); };
    b.onclick = () => { toggle(list, id); sync(); };
    b._sync = sync;
    return b;
  }
  function card(list, it, body) {
    const c = K.h("article", "card");
    c.innerHTML = `<div class="card-head"><span class="badge">${icon(it.icon)}</span><div><h3>${it.title}${it.py ? '<span class="py">PY</span>' : ""}</h3>${it.where ? `<span class="where">${it.where}</span>` : ""}</div></div>${body}`;
    const b = pickBtn(list, it.id);
    c.append(b);
    b._sync();
    return c;
  }
  function renderLists() {
    $("#standing").innerHTML = [
      ["Database", STANDING.db.used, STANDING.db.of, STANDING.db.pct, `Biggest table: ${STANDING.biggest}. Every growing table has a retention rule.`],
      ["File storage", STANDING.files.used, STANDING.files.of, STANDING.files.pct, "No images or model frames are stored in Supabase; that's what broke the VIP app."],
    ].map(([n, u, of, pct, p]) => `<div class="meter"><small>${n}</small><strong>${u} <span>of ${of} free</span></strong><div class="track"><i style="width:${Math.max(pct, 0.6)}%"></i></div><p>${p}</p></div>`).join("") +
      `<div class="meter"><small>Background jobs</small><strong>${STANDING.jobs} <span>scheduled</span></strong><div class="track"><i style="width:40%;background:var(--accent)"></i></div><p>Job history is pruned after 7 days. Items 7 and 14 trim the rest.</p></div>`;
    $("#perf-list").replaceChildren(...PERF.map((it) => card("perf", it,
      `<p>${it.what}</p>${pcList(it.pros, it.cons)}<div class="meta">${storeChip(it.storage)}<span class="chip">Effort <b>${it.effort}</b></span><span class="chip">Gain ${stars(it.impact)}</span></div>`)));
    $("#pages-list").replaceChildren(...PAGES.map((it) => card("pages", it,
      `<p>${it.what}</p><p class="why">${it.why}</p><div class="meta"><span class="chip">${icon("Database")}<span><b>Data:</b> ${it.data}</span></span>${storeChip(it.storage)}<span class="chip">Effort <b>${it.effort}</b></span></div>`)));
    $("#engines-list").replaceChildren(...ENGINES.map((it) => card("engines", it,
      `<p>${it.what}</p><p class="why">${it.how}</p><div class="acc"><span class="bars" aria-label="Accuracy ${it.acc[0]} of 5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= it.acc[0] ? "on" : ""}"></i>`).join("")}</span><p><b>Accuracy:</b> ${it.acc[1]}</p></div>${pcList(it.pros, it.cons)}`)));
    $("#adds-list").replaceChildren(...REVIEW.adds.map((it) => card("adds", it, `<p>${it.text}</p>`)));
    $("#h-looked").innerHTML = `${icon("Eye")} What I went through`;
    $("#h-good").innerHTML = `${icon("ThumbsUp")} What's good`;
    $("#h-bad").innerHTML = `${icon("TriangleAlert")} What needs work`;
    $("#looked").innerHTML = REVIEW.looked.map((x) => `<li>${x}</li>`).join("");
    $("#good").innerHTML = REVIEW.good.map(([b, t]) => `<li><b>${b}</b>${t}</li>`).join("");
    $("#bad").innerHTML = REVIEW.bad.map(([b, t]) => `<li><b>${b}</b>${t}</li>`).join("");
    renderDF();
  }
  $$("[data-all]").forEach((b) => (b.onclick = () => { const l = b.dataset.all; picks[l] = (l === "perf" ? PERF : l === "pages" ? PAGES : ENGINES).map((x) => x.id); save(); syncPicks(); toast("Added all"); }));
  $$("[data-none]").forEach((b) => (b.onclick = () => { picks[b.dataset.none] = []; save(); syncPicks(); toast("Cleared"); }));
  function syncPicks() { $$(".pick").forEach((b) => b._sync && b._sync()); }

  /* ---------- Deer and Fishing ---------- */
  function blob(cx, cy, rx, ry, seed, n = 9) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, w = 1 + 0.18 * Math.sin(seed * 3.1 + i * 1.7) + 0.1 * Math.cos(seed * 1.3 + i * 2.9);
      pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]);
    }
    let d = "";
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      if (!i) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + "Z";
  }
  const CATS = [["Fair", "#c1e9c1"], ["Good", "#66a366"], ["Very Good", "#ffe066"], ["Excellent", "#ffa366"], ["Peak", "#e06666"]];
  function spcSketch() {
    const areas = [
      [blob(640, 260, 260, 150, 1), 0], [blob(250, 250, 120, 90, 4), 0],
      [blob(660, 250, 180, 100, 2), 1], [blob(255, 245, 70, 55, 5), 1],
      [blob(680, 240, 110, 65, 3), 2], [blob(700, 236, 55, 34, 6), 3], [blob(712, 232, 22, 15, 8), 4],
    ];
    const lab = [[520, 360, "FAIR"], [565, 312, "GOOD"], [600, 268, "VERY GOOD"], [682, 222, "EXC"], [255, 245, "GOOD"]];
    return `<svg class="spc" viewBox="0 0 975 610" role="img" aria-label="Sketch of an SPC-style map layout with made-up areas">
      <rect width="975" height="610" fill="#0e1018"/>
      ${areas.map(([d, c]) => `<path d="${d}" fill="${CATS[c][1]}" fill-opacity="0.82" stroke="${["#4c8a4c", "#2f6b2f", "#b39a2a", "#c46a2a", "#9c2f2f"][c]}" stroke-width="2.5"/>`).join("")}
      <path d="${US_STATES_D}" fill="none" stroke="#9aa0bb" stroke-opacity="0.55" stroke-width="1"/>
      ${lab.map(([x, y, t]) => `<text x="${x}" y="${y}" font-family="JetBrains Mono, monospace" font-size="15" font-weight="600" fill="#101218" text-anchor="middle">${t}</text>`).join("")}
      <rect x="18" y="16" width="360" height="62" rx="8" fill="#0b0c14" fill-opacity="0.9" stroke="#d9b76f" stroke-opacity="0.6"/>
      <text x="32" y="42" font-family="Russo One, sans-serif" font-size="20" fill="#eceef5">DEER ACTIVITY · DAY 1</text>
      <text x="32" y="64" font-family="JetBrains Mono, monospace" font-size="12" fill="#d9b76f">LAYOUT SKETCH · MADE-UP AREAS</text>
      <g transform="translate(560 520)"><rect width="400" height="74" rx="8" fill="#0b0c14" fill-opacity="0.92" stroke="#23253a"/>
      ${CATS.map(([n, c], i) => `<rect x="${14 + i * 76}" y="16" width="22" height="16" fill="${c}" stroke="#0006"/><text x="${14 + i * 76}" y="54" font-family="Nunito Sans, sans-serif" font-size="13" fill="#c9cbd6">${n}</text>`).join("")}</g>
    </svg>`;
  }
  function renderDF() {
    const el = $("#df");
    el.innerHTML = `<h3>${icon("Map")} What's wrong and how I'd fix it</h3><p class="why" style="margin:0">${DEER_FISH.why}</p><ol>${DEER_FISH.plan.map((x) => `<li>${x}</li>`).join("")}</ol>${spcSketch()}<p class="why" style="margin:0">Sketch of the layout only. The areas are made up to show the style; the real map draws them from the forecast.</p><div class="opts"></div>`;
    const opts = $(".opts", el);
    for (const [key, label] of [["area", "Area"], ["days", "Days"]]) {
      const row = K.h("div");
      row.innerHTML = `<span>${label}</span>`;
      for (const [v, t] of DEER_FISH.choices[key]) {
        const b = K.h("button", "tog", t);
        b.type = "button";
        b.setAttribute("aria-pressed", String(picks.deerFish[key] === v));
        b.onclick = () => { picks.deerFish[key] = v; $$("button", row).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); save(); };
        row.append(b);
      }
      opts.append(row);
    }
  }

  /* ---------- notes ---------- */
  $$("[data-note]").forEach((t) => (t.oninput = () => { picks.notes[t.dataset.note] = t.value.slice(0, 4000); save(); }));
  const fillNotes = () => $$("[data-note]").forEach((t) => (t.value = picks.notes[t.dataset.note] || ""));

  /* ---------- menu stage ---------- */
  const stage = $("#stage"), screen = $("#screen"), layer = $("#layer"), title = $("#scr-title");
  let mSet = "main", mIdx = 0, current = null, openT = 0, mounted = false;
  function setTitle(p, instant) {
    const html = `<i>${icon(p.icon)}</i><span>${p.label}</span>`;
    if (instant) { title.innerHTML = html; return; }
    title.classList.add("swap");
    setTimeout(() => { title.innerHTML = html; title.classList.remove("swap"); }, 170);
  }
  const list = () => MENUS[mSet];
  function resetScreen() {
    for (const k of ["transform", "transition", "opacity", "filter", "borderRadius", "transformOrigin", "boxShadow", "zIndex", "pointerEvents", "backfaceVisibility", "overflow"]) screen.style[k] = "";
    screen.className = "screen";
    stage.className = "stage";
    stage.style.cssText = "";
  }
  function unmountMenu() {
    clearTimeout(openT);
    if (current) try { current.destroy && current.destroy(); } catch (e) { console.error(e); }
    current = null; mounted = false;
    layer.innerHTML = ""; resetScreen();
  }
  function mountMenu(i) {
    unmountMenu();
    const L = list();
    if (!L.length) { $("#m-info").innerHTML = "<p>Menus are loading.</p>"; return; }
    mIdx = (i + L.length) % L.length;
    const m = L[mIdx];
    setTitle({ label: "Homepage", icon: "House" }, true);
    const ctx = {
      layer, screen, stage, role: mSet,
      groups: mSet === "main" ? MAIN_NAV : QUICK_NAV,
      all: MAIN_NAV,
      go: (p) => setTitle(p),
    };
    try { current = m.build(ctx) || {}; } catch (e) { console.error(e); current = {}; }
    mounted = true;
    renderMenuInfo();
    openT = setTimeout(() => { try { current.open && current.open(); } catch (e) { console.error(e); } }, 650);
  }
  function renderMenuInfo() {
    const L = list(), m = L[mIdx];
    if (!m) return;
    $("#m-chips").replaceChildren(...L.map((x, i) => {
      const b = K.h("button", "mchip", `${picks.menus[x.id]?.m || picks.menus[x.id]?.q ? icon("Check") : ""}${x.name}`);
      b.type = "button";
      b.setAttribute("aria-current", String(i === mIdx));
      if (picks.menus[x.id]?.m || picks.menus[x.id]?.q) b.dataset.added = "";
      b.onclick = () => mountMenu(i);
      return b;
    }));
    const info = $("#m-info");
    info.innerHTML = `<span class="eyebrow">${mSet === "main" ? "Main menu" : "Quick Menu"} · ${mIdx + 1} of ${L.length} · ${m.kind}</span><h3>${m.name}</h3><p>${m.desc}</p><p class="how">${icon("Hand")} ${m.how}</p><div class="addrow"></div>`;
    const row = $(".addrow", info);
    for (const [k, label] of [["m", "Add to Main list"], ["q", "Add to Quick list"]]) {
      const b = K.h("button", "pick");
      b.type = "button";
      const on = picks.menus[m.id][k];
      b.setAttribute("aria-pressed", String(on));
      b.innerHTML = `${icon(on ? "Check" : "Plus")} ${label}`;
      b.onclick = () => { picks.menus[m.id][k] = !picks.menus[m.id][k]; save(); renderMenuInfo(); renderTable(); };
      row.append(b);
    }
    if ((m.fits === "quick" && picks.menus[m.id].m) || (m.fits === "main" && picks.menus[m.id].q))
      row.insertAdjacentHTML("afterend", `<p class="how">${icon("TriangleAlert")} ${m.fits === "quick" ? "Made for a short list; as a Main menu it would show the sections first." : "Made for every page; as a Quick Menu it shows your pins and the chasing pages."}</p>`);
  }
  $("#m-prev").innerHTML = icon("ChevronLeft");
  $("#m-next").innerHTML = icon("ChevronRight");
  $("#m-replay").innerHTML = `${icon("RotateCcw")} Replay`;
  $("#m-prev").onclick = () => mountMenu(mIdx - 1);
  $("#m-next").onclick = () => mountMenu(mIdx + 1);
  $("#m-replay").onclick = () => mountMenu(mIdx);
  $$("#m-set button").forEach((b) => (b.onclick = () => {
    mSet = b.dataset.set;
    $$("#m-set button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    mountMenu(0);
  }));

  /* ---------- menu manager ---------- */
  function result(id, base) {
    const now = picks.menus[id];
    if (!base) return now.m && now.q ? ["added", "New in both lists"] : now.m ? ["added", "New in Main"] : now.q ? ["added", "New in Quick"] : ["kept", "Not added"];
    if (!now.m && !now.q) return ["removed", "Removed from the app"];
    const was = { m: base.main, q: base.second };
    if (now.m === was.m && now.q === was.q) return ["kept", "Kept as is"];
    const parts = [];
    if (now.m && !was.m) parts.push("added to Main");
    if (!now.m && was.m) parts.push("off Main");
    if (now.q && !was.q) parts.push("added to Quick");
    if (!now.q && was.q) parts.push("off Quick");
    return ["moved", parts.join(", ").replace(/^./, (c) => c.toUpperCase())];
  }
  function renderTable() {
    const rows = [];
    const group = (t) => rows.push(`<tr class="grp"><td colspan="3">${t}</td></tr>`);
    const row = (id, name, kind, base, extra = "") => {
      const [cls, text] = result(id, base);
      const now = picks.menus[id];
      rows.push(`<tr><td class="nm">${name}<small>${kind}</small><span class="state ${cls}">${text}</span>${extra}</td><td><button class="tog" data-mid="${id}" data-k="m" aria-pressed="${now.m}">${icon(now.m ? "Check" : "Minus")} Main</button></td><td><button class="tog" data-mid="${id}" data-k="q" aria-pressed="${now.q}">${icon(now.q ? "Check" : "Minus")} Quick</button></td></tr>`);
    };
    group("New main menus");
    MENUS.main.forEach((m) => row(m.id, m.name, m.kind, null));
    group("New Quick Menus");
    MENUS.quick.forEach((m) => row(m.id, m.name, m.kind, null));
    group("On the app now");
    CURRENT_MENUS.forEach((m) => row(m.id, m.name, m.kind, m, m.fix ? `<span class="fixnote">${icon("Wrench")} Fix queued: ${m.fix}</span>` : m.note ? `<span class="fixnote">${m.note}</span>` : ""));
    $("#m-table").innerHTML = rows.join("");
    $$("#m-table [data-mid]").forEach((b) => (b.onclick = () => { const p = picks.menus[b.dataset.mid]; p[b.dataset.k] = !p[b.dataset.k]; save(); renderTable(); if (mounted) renderMenuInfo(); }));
  }
  $("#m-reset").onclick = () => { picks.menus = baseMenus(); save(); renderTable(); if (mounted) renderMenuInfo(); toast("Menus back to where they started"); };

  /* ---------- Randoms ---------- */
  let rId = RANDOMS[0].id, rCur = null;
  const rstage = $("#rstage");
  function unmountRandom() {
    if (rCur) try { rCur.destroy && rCur.destroy(); } catch (e) { console.error(e); }
    rCur = null;
    $$("canvas", rstage).forEach((c) => c.remove());
    $("#r-hud").innerHTML = "";
    $("#r-hint").textContent = "";
  }
  function mountRandom(id) {
    unmountRandom();
    rId = id;
    const it = RANDOMS.find((r) => r.id === id);
    $("#r-chips").replaceChildren(...RANDOMS.map((r) => {
      const b = K.h("button", "mchip", `${has("randoms", r.id) ? icon("Check") : icon(r.icon)}${r.title}`);
      b.type = "button";
      b.setAttribute("aria-current", String(r.id === id));
      if (has("randoms", r.id)) b.dataset.added = "";
      b.onclick = () => mountRandom(r.id);
      return b;
    }));
    const info = $("#r-info");
    info.innerHTML = `<div class="card"><div class="card-head"><span class="badge">${icon(it.icon)}</span><div><h3>${it.title}</h3></div></div><p>${it.what}</p></div>`;
    const c = $(".card", info);
    const b = pickBtn("randoms", id);
    const orig = b.onclick;
    b.onclick = () => { orig(); mountRandomChips(); };
    c.append(b);
    b._sync();
    const impl = typeof RANDOM_IMPL !== "undefined" && RANDOM_IMPL[id];
    if (!impl) { $("#r-hint").textContent = "Loading…"; return; }
    try { rCur = impl(rstage, $("#r-hud"), (t) => ($("#r-hint").textContent = t)) || {}; } catch (e) { console.error(e); $("#r-hint").textContent = "This one needs WebGL, which this browser has turned off."; }
  }
  function mountRandomChips() {
    $$("#r-chips .mchip").forEach((b, i) => {
      const r = RANDOMS[i];
      b.innerHTML = `${has("randoms", r.id) ? icon("Check") : icon(r.icon)}${r.title}`;
      b.toggleAttribute("data-added", has("randoms", r.id));
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { unmountRandom(); unmountMenu(); }
    else { if (tab === "randoms") mountRandom(rId); if (tab === "menus") mountMenu(mIdx); }
  });

  /* ---------- summary and counters ---------- */
  function menuChanges() {
    const adds = [], removes = [], moves = [];
    for (const m of NEW_MENUS()) { const n = picks.menus[m.id]; if (n.m || n.q) adds.push(`${m.name} (${[n.m && "Main", n.q && "Quick"].filter(Boolean).join(" + ")})`); }
    for (const m of CURRENT_MENUS) {
      const [cls, text] = result(m.id, m);
      if (cls === "removed") removes.push(m.name);
      if (cls === "moved") moves.push(`${m.name}: ${text}`);
    }
    return { adds, removes, moves };
  }
  function render() {
    const mc = menuChanges();
    const counts = { perf: picks.perf.length, pages: picks.pages.length, engines: picks.engines.length, randoms: picks.randoms.length, adds: picks.adds.length, menus: mc.adds.length };
    $$(".tab i[data-c]").forEach((i) => (i.textContent = counts[i.dataset.c] ? String(counts[i.dataset.c]) : ""));
    $("#counter").innerHTML = [
      ["Speed", `${counts.perf}/20`], ["New menus", `${mc.adds.length}/20`], ["Menus removed", mc.removes.length], ["Pages", `${counts.pages}/15`], ["Engines", `${counts.engines}/15`], ["Randoms", `${counts.randoms}/5`], ["My adds", `${counts.adds}/3`],
    ].map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join("");
    const sec = (t, items, empty) => `<section><h3>${t}<span>${items.length}</span></h3>${items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>` : `<p class="empty">${empty}</p>`}</section>`;
    const names = (list, src) => picks[list].map((id) => src.find((x) => x.id === id)?.title).filter(Boolean);
    const df = picks.deerFish;
    const area = DEER_FISH.choices.area.find((x) => x[0] === df.area)?.[1];
    const days = DEER_FISH.choices.days.find((x) => x[0] === df.days)?.[1];
    $("#sum").innerHTML = [
      sec("Fixes you asked for", ["Hive: words centered in every hexagon", "Ribbon Fold: button re-centers after closing (Main and Quick)", "Remove Live Bento (Main)", "Remove Card Fan (Quick)", `Deer and Fishing: SPC-style map · ${area} · ${days}`], ""),
      sec("Speed upgrades", names("perf", PERF), "None picked yet."),
      sec("New menus", mc.adds, "None picked yet."),
      sec("Menus removed", mc.removes, "None."),
      sec("Menus moved between lists", mc.moves, "None."),
      sec("New pages", names("pages", PAGES), "None picked yet."),
      sec("New engines", names("engines", ENGINES), "None picked yet."),
      sec("New Randoms", names("randoms", RANDOMS), "None picked yet."),
      sec("From my review", names("adds", REVIEW.adds), "None picked yet."),
    ].join("");
    const ap = $("#approve");
    ap.innerHTML = picks.approved ? `${icon("CircleCheck")} Approved` : `${icon("Send")} Approve these picks`;
    $("#approve-note").textContent = picks.approved ? `Approved ${new Date(picks.approved).toLocaleString()}. Tap again to take it back. Then tell me in chat to start.` : "You can change anything after approving, too.";
  }
  $("#approve").onclick = () => { picks.approved = picks.approved ? null : new Date().toISOString(); save(); toast(picks.approved ? "Approved. Tell me in chat to start." : "Approval taken back"); };

  /* ---------- start ---------- */
  const menuCss = document.createElement("style");
  menuCss.textContent = [...MENUS.main, ...MENUS.quick].map((m) => m.css || "").join("\n");
  document.head.append(menuCss);
  try { merge(JSON.parse(localStorage.getItem(LS) || "null")); } catch (e) {}
  renderLists();
  renderTable();
  fillNotes();
  render();
  let start = "perf";
  try { start = localStorage.getItem("sswx-review-tab") || "perf"; } catch (e) {}
  if (location.hash && $(location.hash.replace(/[^#a-z]/g, "")) ) start = location.hash.slice(1);
  if (!$("#" + start) || !$("#" + start).classList.contains("panel")) start = "perf";
  show(start);
  (async () => {
    try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch (e) { db = null; }
    if (db) {
      try {
        const snap = await db.doc("review/picks").get();
        const d = snap && snap.data && snap.data();
        if (d) { merge(JSON.parse(JSON.stringify(d))); renderLists(); renderTable(); fillNotes(); if (mounted) renderMenuInfo(); syncPicks(); }
        status("ok", "Saved · Claude can read your picks");
      } catch (e) { status("local", "Can't reach saved picks; saving on this device"); }
    } else status("local", "Saved on this device only");
    loaded = true;
    render();
  })();
})();
