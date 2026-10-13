/* Theme Lab: swap palette tokens and font tokens independently, save choices for Claude to read. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const state = { offerPalettes: ["silver", "stormcell", "frost", "nebula", "sapphire", "amethyst", "royal", "vip"], offerFonts: [], defaultPalette: "silver", defaultFont: null, combos: [], notes: "" };
  let pi = 0, fi = 0, db = null, timer = 0;
  const pal = () => PALETTES[pi], font = () => FONTS[fi];

  /* Fonts load on demand, one stylesheet per family, so one bad family never blocks the rest. */
  const loaded = new Set();
  function loadFamily(fam) { if (loaded.has(fam) || !FAMILY_Q[fam]) return; loaded.add(fam); const l = document.createElement("link"); l.rel = "stylesheet"; l.href = `https://fonts.googleapis.com/css2?family=${FAMILY_Q[fam]}&display=swap`; document.head.appendChild(l); }
  const stack = (fam, kind) => `"${fam}", ${kind === "mono" ? "ui-monospace, Menlo, monospace" : "system-ui, -apple-system, sans-serif"}`;

  function lum(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0); }

  function apply() {
    const r = document.documentElement.style, p = pal(), f = font();
    for (const [k, v] of Object.entries(p.t)) r.setProperty("--" + k, v);
    r.setProperty("--on-accent", lum(p.t.accent) > .35 ? "#0b0a12" : "#ffffff");
    [f.display, f.body, f.mono].forEach(loadFamily);
    r.setProperty("--f-display", stack(f.display)); r.setProperty("--f-body", stack(f.body)); r.setProperty("--f-mono", stack(f.mono, "mono"));
    r.setProperty("--d-weight", f.dW); r.setProperty("--d-case", f.upper ? "uppercase" : "none");
    $("#p-name").textContent = p.name; $("#f-name").textContent = f.name;
    $("#now-name").innerHTML = `${p.name} <span>+</span> ${f.name}`;
    $$(".pal").forEach(b => b.setAttribute("aria-current", b.dataset.id === p.id));
    $$(".font").forEach(b => b.setAttribute("aria-current", b.dataset.id === f.id));
    try { localStorage.setItem("tl-now", p.id + "|" + f.id); } catch (e) {}
    sync();
  }

  /* Static preview bits */
  $("#ic-bell").innerHTML = ic("bell"); $("#ic-bell2").innerHTML = ic("bell");
  const days = [["TUE", "cloudsun", 81, 62], ["WED", "bolt", 78, 60], ["THU", "rain", 70, 55], ["FRI", "sun", 74, 52], ["SAT", "sun", 79, 58], ["SUN", "cloudy", 77, 61], ["MON", "bolt", 83, 65]];
  $("#week").innerHTML = days.map(([d, i, h, l]) => `<div><b>${d}</b>${ic(i)}<em>${h}&deg;</em><small>${l}&deg;</small></div>`).join("");
  const bar = on => ["house", "radar", "bolt", "grid", "cuser"].map((n, i) => `<span class="${i === on ? "on" : ""}">${ic(n)}</span>`).join("");
  $("#tabbar").innerHTML = bar(0); $("#tabbar2").innerHTML = bar(2);
  $("#w1").innerHTML = `${ic("siren")}<div><b>Tornado Warning</b><small>Cleveland County until 7:45 PM</small></div><span class="chip">Radar</span>`;
  $("#w2").innerHTML = `${ic("hail")}<div><b>Severe Thunderstorm Watch 112</b><small>Hail to 2 in, wind to 70 mph</small></div><span class="chip">Map</span>`;
  $("#w3").innerHTML = `${ic("scaneye")}<div><b>Mesoscale Discussion 0418</b><small>Watch likely within the hour</small></div><span class="chip">Read</span>`;
  $("#p-prev").innerHTML = $("#f-prev").innerHTML = ic("left"); $("#p-next").innerHTML = $("#f-next").innerHTML = ic("right");

  /* Palette cards, grouped */
  const groups = [...new Set(PALETTES.map(p => p.group))];
  const sw = t => `<span class="sw"><i style="background:${t.bg}"></i><i style="background:${t.surface2}"></i><i style="background:${t.metal}"></i><i style="background:${t.accent}"></i><i style="background:${t.accent2}"></i></span>`;
  $("#pals").innerHTML = groups.map(g => `<div class="grp">${g}</div><div class="pals">${PALETTES.map((p, i) => p.group !== g ? "" : `<div class="pal" data-id="${p.id}" data-i="${i}" role="button" tabindex="0">${sw(p.t)}<b>${p.name}</b><span class="tags"><button class="offer" data-kind="p" data-id="${p.id}" aria-pressed="false">Offer</button><span class="tag" data-def="p">Default</span></span></div>`).join("")}</div>`).join("");
  $("#fonts").innerHTML = FONTS.map((f, i) => { [f.display].forEach(loadFamily); return `<div class="font" data-id="${f.id}" data-i="${i}" role="button" tabindex="0"><span class="smp" style="font-family:${stack(f.display).replace(/"/g, "'")};font-weight:${f.dW};text-transform:${f.upper ? "uppercase" : "none"}">StormSync</span><span class="tags"><button class="offer" data-kind="f" data-id="${f.id}" aria-pressed="false">Offer</button><span class="tag" data-def="f">Default</span></span><span class="meta"><b>${f.name}</b> &middot; ${f.display} / ${f.body}. ${f.note}</span></div>`; }).join("");

  document.addEventListener("click", e => {
    const o = e.target.closest(".offer");
    if (o) { const arr = o.dataset.kind === "p" ? state.offerPalettes : state.offerFonts; const k = arr.indexOf(o.dataset.id); k >= 0 ? arr.splice(k, 1) : arr.push(o.dataset.id); save(); return; }
    const p = e.target.closest(".pal"); if (p) { pi = +p.dataset.i; apply(); return; }
    const f = e.target.closest(".font"); if (f) { fi = +f.dataset.i; apply(); return; }
    const c = e.target.closest("[data-combo]"); if (c) { const [a, b] = c.dataset.combo.split("|"); if (c.dataset.act === "del") { state.combos = state.combos.filter(x => x !== c.dataset.combo); save(); } else { pi = PALETTES.findIndex(x => x.id === a); fi = FONTS.findIndex(x => x.id === b); apply(); } }
  });
  document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".pal,.font")) { e.preventDefault(); e.target.click(); } });
  $("#p-prev").onclick = () => { pi = (pi - 1 + PALETTES.length) % PALETTES.length; apply(); };
  $("#p-next").onclick = () => { pi = (pi + 1) % PALETTES.length; apply(); };
  $("#f-prev").onclick = () => { fi = (fi - 1 + FONTS.length) % FONTS.length; apply(); };
  $("#f-next").onclick = () => { fi = (fi + 1) % FONTS.length; apply(); };
  $("#save-combo").onclick = () => { const k = pal().id + "|" + font().id; if (!state.combos.includes(k)) { state.combos.push(k); save(); toast("Combo saved"); } else toast("Already saved"); };
  $("#make-default").onclick = () => { state.defaultPalette = pal().id; state.defaultFont = font().id; if (!state.offerPalettes.includes(pal().id)) state.offerPalettes.push(pal().id); if (!state.offerFonts.includes(font().id)) state.offerFonts.push(font().id); save(); toast(pal().name + " + " + font().name + " is the default"); };
  $("#notes").oninput = e => { state.notes = e.target.value; save(); };

  function sync() {
    $$(".offer").forEach(b => b.setAttribute("aria-pressed", (b.dataset.kind === "p" ? state.offerPalettes : state.offerFonts).includes(b.dataset.id)));
    $$(".pal").forEach(c => c.querySelector('[data-def="p"]').classList.toggle("on", state.defaultPalette === c.dataset.id));
    $$(".font").forEach(c => c.querySelector('[data-def="f"]').classList.toggle("on", state.defaultFont === c.dataset.id));
    const pn = id => PALETTES.find(p => p.id === id)?.name || "not set", fn = id => FONTS.find(f => f.id === id)?.name || "not set";
    $("#default-line").textContent = `Default: ${pn(state.defaultPalette)} + ${fn(state.defaultFont)} · ${state.offerPalettes.length} palettes and ${state.offerFonts.length} font sets offered`;
    $("#combos").innerHTML = state.combos.length ? state.combos.map(k => { const [a, b] = k.split("|"); const p = PALETTES.find(x => x.id === a), f = FONTS.find(x => x.id === b); if (!p || !f) return ""; return `<div class="combo">${sw(p.t)}<span>${p.name} + ${f.name}</span><button data-combo="${k}">Show</button><button data-combo="${k}" data-act="del" aria-label="Remove">Remove</button></div>`; }).join("") : `<div class="empty">No combos yet. Tap “Save this combo” on one you like.</div>`;
    if (document.activeElement !== $("#notes")) $("#notes").value = state.notes || "";
  }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1700); }
  function setSave(t) { $("#save").innerHTML = t; }
  function save() {
    sync();
    if (!db) { setSave("Choices are kept on this screen only"); return; }
    clearTimeout(timer); setSave("Saving&hellip;");
    timer = setTimeout(async () => { try { await db.doc("themes/selection").set({ ...JSON.parse(JSON.stringify(state)), updatedAt: new Date().toISOString() }); setSave("<b>Saved</b> &middot; Claude can read your choices"); } catch (e) { setSave("Could not save: " + (e?.message || e?.code || "unknown error")); } }, 600);
  }

  /* Boot: last viewed combo, else the default. */
  try { const [a, b] = (localStorage.getItem("tl-now") || "").split("|"); const x = PALETTES.findIndex(p => p.id === a), y = FONTS.findIndex(f => f.id === b); if (x >= 0) pi = x; if (y >= 0) fi = y; } catch (e) {}
  apply();
  setSave("Connecting&hellip;");
  (async () => {
    try { db = window.claude && await window.claude.use("db"); } catch (e) { db = null; }
    if (!db) { setSave("Choices are kept on this screen only"); return; }
    try {
      const snap = await db.doc("themes/selection").get(); const d = snap.data && snap.data();
      if (d) for (const k of Object.keys(state)) if (d[k] !== undefined) state[k] = JSON.parse(JSON.stringify(d[k]));
      sync(); setSave("<b>Connected</b> &middot; choices save automatically");
    } catch (e) { setSave("Could not load saved choices: " + (e?.message || e?.code || "unknown error")); }
  })();
})();
