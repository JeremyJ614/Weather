/* Lab shell: tabs, the live phone stage, theme swapping, the A2 intro and saved picks. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- picks: stored in the artifact database so Claude can read them ---------- */
  const picks = { mainMenu: null, secondMenu: null, favMenus: [], offerMain: [], offerSecond: [], theme: null, favThemes: [], admin: [], pricing: null, favPricing: [], b1: {}, engines: {}, newEngines: {}, notes: {} };
  let db = null, saveTimer = 0;
  const saveLabel = $("#save");
  function setSaveText(t) { saveLabel.innerHTML = t; }
  function save() {
    renderSummary();
    if (!db) { setSaveText("Picks are kept on this screen only"); return; }
    clearTimeout(saveTimer); setSaveText("Saving\u2026");
    saveTimer = setTimeout(async () => {
      try { await db.doc("picks/selection").set({ ...picks, updatedAt: new Date().toISOString() }); setSaveText("<b>Saved</b> \u00b7 Claude can read your picks"); }
      catch (e) { setSaveText("Could not save: " + (e?.message || e?.code || "unknown error")); }
    }, 500);
  }
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1800); }

  /* ---------- themes are only token swaps ---------- */
  function lum(hex) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  let currentTheme = "royal";
  function applyTheme(id) {
    const th = THEMES.find(t => t.id === id) || THEMES[0]; currentTheme = th.id;
    const r = document.documentElement.style;
    for (const [k, v] of Object.entries(th.t)) r.setProperty("--" + (k === "surface2" ? "surface2" : k), v);
    r.setProperty("--on-accent", lum(th.t.accent) > .35 ? "#0b0a12" : "#ffffff");
    $$(".theme").forEach(b => b.querySelector(".use").classList.toggle("on", b.dataset.id === th.id));
    drawRadar();
  }

  /* ---------- section tabs ---------- */
  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.setAttribute("aria-selected", x === t));
    $$("section.panel").forEach(p => p.hidden = p.id !== t.dataset.p);
    try { localStorage.setItem("lab-tab", t.dataset.p); } catch (e) {}
    if (t.dataset.p === "a2") playIntro();
  });

  /* ---------- A1: the stage ---------- */
  const stage = $("#stage"), screen = $("#screen"), layer = $("#layer");
  const style = document.createElement("style"); style.textContent = MENUS.map(m => m.css).join("\n"); document.head.appendChild(style);
  let dataset = "main", current = null, idx = 0, openTimer = 0;
  const titleEl = $("#scr-title");
  function nav(label) { titleEl.classList.add("swap"); setTimeout(() => { titleEl.textContent = label; titleEl.classList.remove("swap"); }, 180); }

  function mount(i) {
    idx = (i + MENUS.length) % MENUS.length; const m = MENUS[idx];
    clearTimeout(openTimer);
    if (current) { try { current.destroy && current.destroy(); } catch (e) {} }
    layer.innerHTML = ""; layer.className = "layer"; screen.className = "screen"; stage.style.background = "";
    titleEl.textContent = dataset === "main" ? "Homepage" : "Tornado Archive";
    current = m.build({ layer, screen, stage, data: dataset === "main" ? MAIN_MENU : SECOND_MENU, nav }) || {};
    $("#m-name").textContent = m.name; $("#m-cat").textContent = m.cat + " \u00b7 " + (idx + 1) + " of " + MENUS.length; $("#m-desc").textContent = m.desc;
    $$(".chip").forEach(c => c.setAttribute("aria-current", c.dataset.id === m.id));
    syncPickButtons();
    openTimer = setTimeout(() => { try { current.open && current.open(); } catch (e) {} }, 650);
  }
  const groupsEl = $("#groups"), cats = [...new Set(MENUS.map(m => m.cat))];
  groupsEl.innerHTML = cats.map(c => `<div class="group"><h3>${c} <span>(${MENUS.filter(m => m.cat === c).length})</span></h3><div class="chips">${MENUS.map((m, i) => m.cat === c ? `<button class="chip" data-i="${i}" data-id="${m.id}"><span class="n">${String(i + 1).padStart(2, "0")}</span>${m.name}<span class="tag" data-k="main">MAIN</span><span class="tag alt" data-k="second">2ND</span><span class="tag" data-k="fav">DEFAULT</span></button>` : "").join("")}</div></div>`).join("");
  $$(".chip").forEach(c => c.onclick = () => { mount(+c.dataset.i); if (matchMedia("(max-width: 880px)").matches) $(".stage-col").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); });
  $("#prev").onclick = () => mount(idx - 1);
  $("#next").onclick = () => mount(idx + 1);
  $("#replay").onclick = () => mount(idx);

  const sw = $("#dataset"), knob = $(".knob", sw);
  function placeKnob() { const b = $$("button", sw).find(x => x.getAttribute("aria-pressed") === "true"); knob.style.width = b.offsetWidth + "px"; knob.style.transform = `translateX(${b.offsetLeft}px)`; }
  $$("button", sw).forEach(b => b.onclick = () => { $$("button", sw).forEach(x => x.setAttribute("aria-pressed", x === b)); dataset = b.dataset.set; placeKnob(); mount(idx); });

  function syncPickButtons() {
    const id = MENUS[idx].id;
    $("#pick-main").setAttribute("aria-pressed", picks.mainMenu === id);
    $("#pick-second").setAttribute("aria-pressed", picks.secondMenu === id);
    $("#offer-main").setAttribute("aria-pressed", picks.offerMain.includes(id));
    $("#offer-second").setAttribute("aria-pressed", picks.offerSecond.includes(id));
    $$(".chip").forEach(c => { const cid = c.dataset.id; c.querySelector('[data-k="main"]').classList.toggle("on", picks.offerMain.includes(cid)); c.querySelector('[data-k="second"]').classList.toggle("on", picks.offerSecond.includes(cid)); c.querySelector('[data-k="fav"]').classList.toggle("on", picks.mainMenu === cid || picks.secondMenu === cid); });
  }
  const tog = (arr, id) => { const k = arr.indexOf(id); k >= 0 ? arr.splice(k, 1) : arr.push(id); };
  const nm = () => MENUS[idx].name;
  $("#offer-main").onclick = () => { const id = MENUS[idx].id; tog(picks.offerMain, id); if (!picks.offerMain.includes(id) && picks.mainMenu === id) picks.mainMenu = null; syncPickButtons(); save(); };
  $("#offer-second").onclick = () => { const id = MENUS[idx].id; tog(picks.offerSecond, id); if (!picks.offerSecond.includes(id) && picks.secondMenu === id) picks.secondMenu = null; syncPickButtons(); save(); };
  $("#pick-main").onclick = () => { const id = MENUS[idx].id; if (picks.mainMenu === id) { picks.mainMenu = null; } else { if (picks.secondMenu === id) { toast(nm() + " is already the default second menu"); return; } picks.mainMenu = id; if (!picks.offerMain.includes(id)) picks.offerMain.push(id); toast(nm() + " is the default main menu"); } syncPickButtons(); save(); };
  $("#pick-second").onclick = () => { const id = MENUS[idx].id; if (picks.secondMenu === id) { picks.secondMenu = null; } else { if (picks.mainMenu === id) { toast(nm() + " is already the default main menu"); return; } picks.secondMenu = id; if (!picks.offerSecond.includes(id)) picks.offerSecond.push(id); toast(nm() + " is the default second menu"); } syncPickButtons(); save(); };

  /* Decorative radar backdrop for the mock screen, drawn once per theme. */
  const rc = $("#radar");
  function drawRadar() {
    if (!rc || !rc.clientWidth) return;
    const d = Math.min(2, devicePixelRatio || 1), w = rc.clientWidth, h = rc.clientHeight; rc.width = w * d; rc.height = h * d;
    const c = rc.getContext("2d"); c.scale(d, d);
    const cs = getComputedStyle(document.documentElement), line = cs.getPropertyValue("--line").trim();
    c.fillStyle = cs.getPropertyValue("--surface").trim(); c.fillRect(0, 0, w, h);
    c.strokeStyle = line; c.lineWidth = 1; c.globalAlpha = .7;
    for (let x = 0; x < w; x += 28) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 18, h); c.stroke(); }
    c.globalAlpha = 1;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const band = [["#2fbf71", 26], ["#f4d03f", 15], ["#f39c12", 9], ["#e74c3c", 5]];
    for (let k = 0; k < 4; k++) { const cx = w * (.2 + rnd() * .6), cy = h * (.2 + rnd() * .6); for (const [col, r] of band) { c.fillStyle = col; c.globalAlpha = .5; for (let j = 0; j < 7; j++) { c.beginPath(); c.ellipse(cx + (rnd() - .5) * r * 2.4, cy + (rnd() - .5) * r * 1.6, r * (0.7 + rnd()), r * (0.5 + rnd() * .6), rnd() * 3, 0, 6.283); c.fill(); } } }
    c.globalAlpha = 1;
  }
  addEventListener("resize", () => { clearTimeout(drawRadar._t); drawRadar._t = setTimeout(drawRadar, 150); placeKnob(); });

  /* ---------- A2: StormSync Media intro ---------- */
  const word = $("#word");
  function buildWord() {
    const l1 = "STORMSYNC".split("").map(ch => `<span class="L"><span class="g">${ch}</span><span class="p" aria-hidden="true">${ch}</span></span>`).join("");
    const l2 = "MEDIA".split("").map(ch => `<span class="L m2"><span class="g">${ch}</span><span class="p" aria-hidden="true">${ch}</span></span>`).join("");
    word.innerHTML = `<div class="line1" aria-label="StormSync Media">${l1}</div><div class="line2"><span class="dash"></span>${l2}<span class="dash"></span></div>`;
  }
  let introAnims = [], rate = 1;
  function playIntro() {
    introAnims.forEach(a => a.cancel()); introAnims = []; buildWord();
    const L1 = $$(".line1 .L", word), L2 = $$(".m2", word), dashes = $$(".dash", word), flash = $("#flash");
    const mid = (L1.length - 1) / 2;
    const add = a => { a.playbackRate = rate; introAnims.push(a); return a; };
    if (reduce) { L1.concat(L2).forEach(l => l.querySelector(".p").style.opacity = 1); return; }
    // 1. Gray letters gust in from scattered positions, from the center outward.
    L1.forEach((l, i) => { const d = Math.abs(i - mid); const sx = (i - mid) * 40 + (Math.random() - .5) * 120, sy = (Math.random() < .5 ? -1 : 1) * (90 + Math.random() * 90), rot = (Math.random() - .5) * 220;
      add(l.animate([{ transform: `translate(${sx}px,${sy}px) rotate(${rot}deg) scale(.3)`, opacity: 0 }, { transform: "translate(0,0) rotate(0) scale(1.08)", opacity: 1, offset: .75 }, { transform: "none", opacity: 1 }], { duration: 1100, delay: 120 + d * 90, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" })); });
    // 2. A flash, then a periwinkle wave rolls left to right; each letter hops as it changes color.
    add(flash.animate([{ opacity: 0 }, { opacity: .55, offset: .15 }, { opacity: .1, offset: .3 }, { opacity: .4, offset: .45 }, { opacity: 0 }], { duration: 700, delay: 1700, fill: "both" }));
    L1.forEach((l, i) => {
      add(l.animate([{ transform: "none" }, { transform: "translateY(-22%) scale(1.06)", offset: .4 }, { transform: "translateY(4%)", offset: .7 }, { transform: "none" }], { duration: 650, delay: 1850 + i * 70, easing: "ease-out" }));
      add(l.querySelector(".p").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 1900 + i * 70, fill: "both" }));
    });
    // 3. MEDIA rises in, framed by two dashes that draw outward.
    dashes.forEach(d => add(d.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 600, delay: 2600, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" })));
    L2.forEach((l, i) => {
      add(l.animate([{ transform: "translateY(120%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 600, delay: 2650 + i * 80, easing: "cubic-bezier(.34,1.56,.64,1)", fill: "backwards" }));
      add(l.querySelector(".p").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 2900 + i * 80, fill: "both" }));
    });
    // 4. A slow sheen keeps it alive.
    L1.forEach((l, i) => add(l.animate([{ transform: "none" }, { transform: "translateY(-5%)" }, { transform: "none" }], { duration: 2400, delay: 3800 + i * 110, iterations: Infinity, easing: "ease-in-out" })));
  }
  $("#intro-replay").onclick = playIntro;
  $("#intro-slow").onclick = e => { rate = rate === 1 ? .35 : 1; e.currentTarget.setAttribute("aria-pressed", rate !== 1); playIntro(); };

  /* ---------- A3 ---------- */
  $("#extras").innerHTML = ADMIN_EXTRAS.map(([t, d], i) => `<button class="extra" data-i="${i}" aria-pressed="false"><span class="box">${ic("check")}</span><b><span class="num">${String(i + 1).padStart(2, "0")}</span>${t}</b><span>${d}</span></button>`).join("");
  $$(".extra").forEach(b => b.onclick = () => { const i = +b.dataset.i; const k = picks.admin.indexOf(i); k >= 0 ? picks.admin.splice(k, 1) : picks.admin.push(i); syncLists(); save(); });
  $("#extras-all").onclick = () => { picks.admin = picks.admin.length === ADMIN_EXTRAS.length ? [] : ADMIN_EXTRAS.map((_, i) => i); syncLists(); save(); };

  /* ---------- A4 ---------- */
  $("#themes").innerHTML = THEMES.map(th => { const t = th.t; const on = lum(t.accent) > .35 ? "#0b0a12" : "#fff"; return `<div class="theme" data-id="${th.id}" aria-pressed="false">
    <div class="tprev" style="background:${t.bg};color:${t.text}">
      <div class="bar"><i style="background:${t.metal};opacity:.85"></i><div class="dots"><i style="background:${t.accent}"></i><i style="background:${t.accent2}"></i><i style="background:${t.metal}"></i></div></div>
      <div class="card" style="background:${t.surface};border:1px solid ${t.line}"><span style="font:600 10px var(--f-mono);letter-spacing:.14em;color:${t.accent}">SSWXCON \u00b7 LEVEL 3</span><div class="big" style="color:${t.text}">74\u00b0</div><div class="row"><i style="background:${t.accent}"></i><i style="background:${t.accent2}"></i><i style="background:${t.line}"></i></div><span style="font-size:11px;color:${t.muted}">Scattered storms after 4 PM</span></div>
      <div class="cta"><i style="background:${t.accent};color:${on}">Open radar</i><i style="background:${t.surface2};color:${t.text};border:1px solid ${t.line}">Brief</i></div>
    </div>
    <div class="tmeta"><b>${th.name}</b><span>${th.note}</span><div class="acts"><button class="mini use">Preview on lab</button><button class="mini pickt">Choose</button><button class="mini favt" aria-label="Shortlist">\u2605</button></div></div></div>`; }).join("");
  $$(".theme").forEach(card => { const id = card.dataset.id;
    card.querySelector(".use").onclick = () => { applyTheme(id); toast(THEMES.find(t => t.id === id).name + " applied to the whole lab"); };
    card.querySelector(".pickt").onclick = () => { picks.theme = picks.theme === id ? null : id; applyTheme(picks.theme || id); syncLists(); save(); };
    card.querySelector(".favt").onclick = () => { const k = picks.favThemes.indexOf(id); k >= 0 ? picks.favThemes.splice(k, 1) : picks.favThemes.push(id); syncLists(); save(); };
  });

  /* ---------- A5 ---------- */
  $("#prices").innerHTML = PRICING.map((p, n) => `<div class="price" data-id="${p.id}" aria-pressed="false"><h4>${p.name}<span>${String(n + 1).padStart(2, "0")}</span></h4><p>${p.line}</p><div class="tiers">${p.tiers.map(([a, b, c]) => `<div class="tier"><b>${a}</b><em>${b}</em><span>${c}</span></div>`).join("")}</div><div class="pros"><div class="y">${ic("check")}<span>${p.good}</span></div><div class="w">${ic("eye")}<span>${p.watch}</span></div></div><div class="acts" style="display:flex;gap:6px"><button class="mini pickp">Choose</button><button class="mini favp">\u2605 Shortlist</button></div></div>`).join("");
  $$(".price").forEach(card => { const id = card.dataset.id;
    card.querySelector(".pickp").onclick = () => { picks.pricing = picks.pricing === id ? null : id; syncLists(); save(); };
    card.querySelector(".favp").onclick = () => { const k = picks.favPricing.indexOf(id); k >= 0 ? picks.favPricing.splice(k, 1) : picks.favPricing.push(id); syncLists(); save(); };
  });

  function syncLists() {
    $$(".extra").forEach(b => b.setAttribute("aria-pressed", picks.admin.includes(+b.dataset.i)));
    $("#extras-count").textContent = picks.admin.length + " of " + ADMIN_EXTRAS.length + " selected";
    $$(".theme").forEach(c => { const id = c.dataset.id; c.setAttribute("aria-pressed", picks.theme === id); c.querySelector(".pickt").classList.toggle("on", picks.theme === id); c.querySelector(".pickt").textContent = picks.theme === id ? "Chosen" : "Choose"; c.querySelector(".favt").classList.toggle("on", picks.favThemes.includes(id)); });
    $$(".price").forEach(c => { const id = c.dataset.id; c.setAttribute("aria-pressed", picks.pricing === id); const b = c.querySelector(".pickp"); b.classList.toggle("on", picks.pricing === id); b.textContent = picks.pricing === id ? "Chosen" : "Choose"; c.querySelector(".favp").classList.toggle("on", picks.favPricing.includes(id)); });
    renderSummary();
  }
  function renderSummary() {
    const mn = id => MENUS.find(m => m.id === id)?.name, tn = id => THEMES.find(t => t.id === id)?.name, pn = id => PRICING.find(p => p.id === id)?.name;
    const none = "<span style='color:var(--muted)'>Not chosen yet</span>";
    const cnt = o => { const v = Object.values(o || {}); return v.length ? `${v.filter(x => x === "launch").length} at launch, ${v.filter(x => x === "later").length} later, ${v.filter(x => x === "skip").length} skipped` : none; };
    $("#summary-dl").innerHTML = `<dt>Default main menu</dt><dd>${mn(picks.mainMenu) || none}</dd><dt>Default second menu</dt><dd>${mn(picks.secondMenu) || none}</dd><dt>Main menu choices</dt><dd>${picks.offerMain.map(mn).join(", ") || none}</dd><dt>Second menu choices</dt><dd>${picks.offerSecond.map(mn).join(", ") || none}</dd><dt>Theme</dt><dd>${tn(picks.theme) || none}</dd><dt>Theme shortlist</dt><dd>${picks.favThemes.map(tn).join(", ") || none}</dd><dt>Admin extras</dt><dd>${picks.admin.length ? picks.admin.length + " selected" : none}</dd><dt>Pricing</dt><dd>${pn(picks.pricing) || none}</dd><dt>Pricing shortlist</dt><dd>${picks.favPricing.map(pn).join(", ") || none}</dd><dt>B1 decisions</dt><dd>${Object.keys(picks.b1 || {}).length} of ${B1_DECISIONS.length} answered</dd><dt>Your engines</dt><dd>${cnt(picks.engines)}</dd><dt>New engines</dt><dd>${cnt(picks.newEngines)}</dd>`;
  }


  /* ---------- Section B ---------- */
  $("#b1-table").innerHTML = B1_FREE.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("");
  const seg = (key, id, opts) => `<div class="seg" data-key="${key}" data-id="${id}">${opts.map(([v, l]) => `<button data-val="${v}" aria-pressed="false">${l}</button>`).join("")}</div>`;
  const ENG_OPTS = [["launch", "At launch"], ["later", "Post-launch"], ["skip", "Skip"]];
  $("#b1-decs").innerHTML = B1_DECISIONS.map(d => `<div class="dec"><b>${d.q}</b><p>${d.why}</p>${seg("b1", d.id, d.opts)}</div>`).join("");
  $("#b2-list").innerHTML = B2_ENGINES.map(([id, n, v, a, d]) => `<div class="eng"><b>${n}</b><div class="meta"><span class="pill ${v === "Hard" ? "hard" : ""}">${v}</span><span class="pill">Accuracy: ${a}</span></div><p>${d}</p>${seg("engines", id, ENG_OPTS)}</div>`).join("");
  $("#b3-list").innerHTML = B3_ENGINES.map(([id, n, d]) => `<div class="eng"><b>${n}</b><p>${d}</p>${seg("newEngines", id, ENG_OPTS)}</div>`).join("");
  $("#b4-list").innerHTML = B4_PHASES.map(([g, list], gi) => `<div class="phase"><h4>${g}</h4><ol>${list.map((t, i) => `<li class="${gi === 0 && i < 2 ? "done" : ""}">${t}</li>`).join("")}</ol></div>`).join("");
  document.addEventListener("click", e => { const b = e.target.closest(".seg button"); if (!b) return; const w = b.parentElement, key = w.dataset.key, id = w.dataset.id; picks[key][id] = picks[key][id] === b.dataset.val ? undefined : b.dataset.val; if (picks[key][id] === undefined) delete picks[key][id]; syncSegs(); save(); });
  function syncSegs() { $$(".seg").forEach(w => { const v = picks[w.dataset.key][w.dataset.id]; $$("button", w).forEach(b => b.setAttribute("aria-pressed", b.dataset.val === v)); }); }
  const NOTE_LABEL = { a1: "Notes on the menus", a2: "Notes on the intro", a3: "Notes on the admin panel", a4: "Notes on themes", a5: "Notes on pricing", b1: "Notes on cost and installing", b2: "Notes on your engines", b3: "Notes on new engines", b4: "Changes to the phase order" };
  $$("section.panel").forEach(p => { const n = el(`<div class="notes"><label for="note-${p.id}">${NOTE_LABEL[p.id]}</label><textarea id="note-${p.id}" placeholder="Anything to add, change or ask"></textarea></div>`); p.appendChild(n); const ta = n.querySelector("textarea"); ta.oninput = () => { picks.notes[p.id] = ta.value; save(); }; });
  function syncNotes() { $$(".notes textarea").forEach(t => { const id = t.id.slice(5); if (document.activeElement !== t) t.value = picks.notes[id] || ""; }); }

  /* ---------- boot ---------- */
  function boot() {
    applyTheme("royal");
    placeKnob(); mount(MENUS.findIndex(m => m.id === "vortex"));
    syncLists(); syncSegs();
    let tab = "a1"; try { tab = localStorage.getItem("lab-tab") || "a1"; } catch (e) {}
    const want = location.hash.replace("#", ""); if (/^(a[1-5]|b[1-4])$/.test(want)) tab = want;
    $(`.tab[data-p="${tab}"]`)?.click();
    setSaveText("Connecting to save picks\u2026");
    (async () => {
      try { db = window.claude && await window.claude.use("db"); } catch (e) { db = null; }
      if (!db) { setSaveText("Picks are kept on this screen only"); return; }
      try {
        const snap = await db.doc("picks/selection").get(); const d = snap.data && snap.data();
        if (d) { for (const k of Object.keys(picks)) if (d[k] !== undefined) picks[k] = JSON.parse(JSON.stringify(d[k])); if (picks.theme) applyTheme(picks.theme); syncLists(); syncPickButtons(); syncSegs(); syncNotes(); }
        setSaveText("<b>Connected</b> \u00b7 your picks save automatically");
      } catch (e) { setSaveText("Could not load saved picks: " + (e?.message || e?.code || "unknown error")); }
    })();
  }
  boot();
})();
