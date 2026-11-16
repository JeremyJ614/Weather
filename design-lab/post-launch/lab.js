/* Post-Launch Lab shell: tabs, item cards, live demos, picks saved to the artifact database (doc postlaunch/picks). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const LS = "sswx-postlaunch-picks";
  const DOC = "postlaunch/picks";
  const PL = window.PL || {};
  const KEYS = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"];
  const SHORT = { a1: "Upgrades", a2: "New pages", a3: "Admin", a4: "Promotions", a5: "Visuals", a6: "Engines", a7: "New engines", a8: "Randoms", a9: "Reach", a10: "Subscribers" };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const PLUS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>';
  const TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

  /* ---------- picks ---------- */
  const picks = { ups: {}, notes: {}, approved: null };
  KEYS.forEach((k) => (picks[k] = []));
  let db = null, timer = 0, loaded = false;
  const status = (s, t) => { $("#save").dataset.s = s; $("#save-text").textContent = t; };
  function save() {
    render();
    try { localStorage.setItem(LS, JSON.stringify(picks)); } catch (e) {}
    if (!loaded) return;
    if (!db) { status("local", "Saved on this device only"); return; }
    clearTimeout(timer);
    status("busy", "Saving…");
    timer = setTimeout(async () => {
      try {
        await db.doc(DOC).set(JSON.parse(JSON.stringify({ ...picks, updatedAt: new Date().toISOString() })));
        status("ok", "Saved · Claude can read your picks");
      } catch (e) {
        status("local", "Not saved online (" + ((e && (e.message || e.code)) || "unknown error") + "). Saved on this device.");
      }
    }, 450);
  }
  function merge(d) {
    if (!d || typeof d !== "object") return;
    for (const k of KEYS) if (Array.isArray(d[k])) picks[k] = d[k].filter((x) => typeof x === "string");
    if (d.ups && typeof d.ups === "object") for (const [k, v] of Object.entries(d.ups)) if (Array.isArray(v)) picks.ups[k] = v.filter((x) => Number.isInteger(x));
    if (d.notes && typeof d.notes === "object") for (const [k, v] of Object.entries(d.notes)) if (typeof v === "string") picks.notes[k] = v;
    picks.approved = typeof d.approved === "string" ? d.approved : null;
  }
  const has = (k, id) => picks[k].includes(id);
  function toggle(k, id, on) {
    const i = picks[k].indexOf(id);
    if (on === undefined) on = i < 0;
    if (on && i < 0) picks[k].push(id);
    if (!on && i >= 0) picks[k].splice(i, 1);
    if (k === "a6" && !on) delete picks.ups[id];
    save();
  }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1700); }

  /* ---------- cards ---------- */
  const dots = (n) => `<span class="dots" aria-label="${n} of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "f" : ""}"></i>`).join("")}</span>`;
  const list = (title, cls, arr) => (arr && arr.length ? `<div class="${cls}"><h4>${title}</h4><ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "");
  function card(k, it, i) {
    const demo = (k === "a5" || k === "a8") && window.PLDEMO && window.PLDEMO[it.id];
    let body = `<p class="what">${esc(it.what)}</p>`;
    if (it.how) body += `<p class="how"><b>How:</b> ${esc(it.how)}</p>`;
    if (demo) body += `<div class="demo${k === "a8" ? " tall" : ""}" data-demo="${esc(it.id)}" aria-label="Live demo: ${esc(it.title)}"></div>`;
    if (it.score !== undefined) body += `<div class="score"><div class="track"><div class="fill" style="width:${it.score * 10}%"></div></div><b>${it.score}<small>/10</small></b></div>`;
    body += `<div class="pc">${list("Pros", "p", it.pros)}${list("Cons", "c", it.cons)}</div>`;
    if (it.needs || it.eligible) body += `<div class="kv">${it.needs ? `<div><span>Requirements</span>${esc(it.needs)}</div>` : ""}${it.eligible ? `<div class="ok"><span>Are we eligible?</span>${esc(it.eligible)}</div>` : ""}</div>`;
    if (it.upgrades) {
      body += `<div class="ups"><h4>Upgrades (tick the ones you want)</h4>${it.upgrades
        .map((u, j) => `<button class="up" data-up="${esc(it.id)}" data-j="${j}" aria-pressed="false"><span class="box">${TICK}</span><span><b>${esc(u.title)}</b><small>${esc(u.what)}</small></span><span class="gain ${esc(u.gain)}">${esc(u.gain)}</span></button>`)
        .join("")}</div>`;
    }
    const meta = [];
    if (it.data) meta.push(`<span>Data: <b>${esc(it.data)}</b></span>`);
    if (it.effort) meta.push(`<span>Effort: <b>${esc(it.effort)}</b></span>`);
    if (it.impact !== undefined) meta.push(`<span>Impact ${dots(it.impact)}</span>`);
    if (meta.length) body += `<div class="meta">${meta.join("")}</div>`;
    const label = k === "a6" ? "Upgrade" : "Add";
    return `<article class="card" data-k="${k}" data-id="${esc(it.id)}">
      <div class="card-head"><div><span class="num">${k.toUpperCase()}.${i + 1}</span><h3>${esc(it.title)}</h3>${it.tag ? `<span class="chip">${esc(it.tag)}</span>` : ""}</div>
      <button class="add" data-add aria-pressed="false" aria-label="${label} ${esc(it.title)}">${PLUS}<span>${label}</span></button></div>
      ${body}</article>`;
  }

  /* ---------- tabs and panels ---------- */
  function build() {
    $("#tabs").innerHTML =
      KEYS.map((k) => `<button class="tab" role="tab" data-p="${k}" aria-selected="false"><b>${k.toUpperCase()}</b>${SHORT[k]}<i data-c="${k}"></i></button>`).join("") +
      `<button class="tab" role="tab" data-p="picks" aria-selected="false"><b>✓</b>Your picks<i data-c="all"></i></button>`;
    $("#panels").innerHTML =
      KEYS.map((k) => {
        const s = PL[k];
        if (!s) return "";
        const n = s.items.length;
        return `<section class="panel" id="${k}" role="tabpanel" hidden>
          <h2><small>${k.toUpperCase()} · ${n} ${k === "a6" ? "engines" : "ideas"}</small>${esc(s.title)}</h2>
          <p class="sub">${esc(s.intro)}</p>
          <div class="bar"><button class="btn small" data-all="${k}">${k === "a6" ? "Upgrade all" : "Add all " + n}</button><button class="btn small" data-none="${k}">Clear</button><span class="count" data-count="${k}"></span></div>
          <div class="grid${k === "a6" || k === "a5" || k === "a8" ? " wide" : ""}">${s.items.map((it, i) => card(k, it, i)).join("")}</div>
          <div class="notes"><label for="n-${k}">Notes on ${SHORT[k].toLowerCase()}</label><textarea id="n-${k}" data-note="${k}" placeholder="Anything to change, combine or add? I read this too."></textarea></div>
        </section>`;
      }).join("") +
      `<section class="panel" id="picks" role="tabpanel" hidden>
        <h2><small>Summary</small>Your picks</h2>
        <p class="sub">Everything you've added, list by list, with your notes. Change anything on its tab; this updates as you go.</p>
        <div class="sum" id="sum"></div>
        <div class="approve" id="approve"></div>
      </section>`;
  }

  let mountedDemos = [];
  function unmountDemos() { mountedDemos.forEach((f) => { try { f(); } catch (e) {} }); mountedDemos = []; $$(".demo").forEach((d) => (d.innerHTML = "")); }
  function mountDemos(panel) {
    $$(".demo", panel).forEach((box) => {
      const fn = window.PLDEMO && window.PLDEMO[box.dataset.demo];
      if (!fn) return;
      try { const stop = fn(box); if (typeof stop === "function") mountedDemos.push(stop); } catch (e) { box.innerHTML = `<p class="how" style="padding:14px">This demo couldn't start in this browser.</p>`; }
    });
  }
  let tab = "a1";
  function show(p, scroll) {
    if (!$("#" + p)) p = "a1";
    tab = p;
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.p === p)));
    $$("section.panel").forEach((s) => (s.hidden = s.id !== p));
    unmountDemos();
    mountDemos($("#" + p));
    if (p === "picks") renderSum();
    try { localStorage.setItem("sswx-postlaunch-tab", p); } catch (e) {}
    if (location.hash !== "#" + p) history.replaceState(null, "", "#" + p);
    const t = $(`.tab[data-p="${p}"]`);
    if (t) t.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    if (scroll) window.scrollTo({ top: $(".tabs-wrap").offsetTop - 4, behavior: "smooth" });
  }

  /* ---------- render state ---------- */
  function render() {
    let total = 0;
    for (const k of KEYS) {
      const n = picks[k].length;
      total += n;
      const c = $(`[data-c="${k}"]`);
      if (c) { c.textContent = n ? String(n) : ""; c.parentElement.classList.toggle("has", n > 0); }
      const cnt = $(`[data-count="${k}"]`);
      if (cnt) cnt.textContent = `${n} of ${PL[k].items.length} picked`;
    }
    const ca = $('[data-c="all"]');
    ca.textContent = total ? String(total) : ""; ca.parentElement.classList.toggle("has", total > 0);
    $$(".card").forEach((el) => {
      const on = has(el.dataset.k, el.dataset.id);
      el.classList.toggle("on", on);
      const b = $("[data-add]", el);
      b.setAttribute("aria-pressed", String(on));
      $("span", b).textContent = on ? (el.dataset.k === "a6" ? "Upgrading" : "Added") : el.dataset.k === "a6" ? "Upgrade" : "Add";
    });
    $$(".up").forEach((b) => b.setAttribute("aria-pressed", String((picks.ups[b.dataset.up] || []).includes(+b.dataset.j))));
    const notes = Object.values(picks.notes).filter((v) => v && v.trim()).length;
    $("#counter").innerHTML = `<span><b>${total}</b> picked across 10 lists</span><span><b>${notes}</b> notes</span>${picks.approved ? `<span><b>Sent to build</b> ${new Date(picks.approved).toLocaleDateString()}</span>` : ""}`;
    if (tab === "picks") renderSum();
  }
  function renderSum() {
    $("#sum").innerHTML = KEYS.map((k) => {
      const s = PL[k], chosen = s.items.filter((it) => has(k, it.id)), note = (picks.notes[k] || "").trim();
      const items = chosen.map((it) => {
        const ups = k === "a6" && it.upgrades ? (picks.ups[it.id] || []).map((j) => it.upgrades[j] && it.upgrades[j].title).filter(Boolean) : [];
        return `<li>${esc(it.title)}${ups.length ? ` <span style="color:var(--accent)">· ${ups.map(esc).join(", ")}</span>` : k === "a6" ? " · all upgrades" : ""}</li>`;
      }).join("");
      return `<section><h3>${k.toUpperCase()} · ${esc(s.title)}<span>${chosen.length}/${s.items.length}</span></h3>${chosen.length ? `<ul>${items}</ul>` : `<p class="none">Nothing picked yet.</p>`}${note ? `<blockquote>${esc(note)}</blockquote>` : ""}</section>`;
    }).join("");
    const total = KEYS.reduce((a, k) => a + picks[k].length, 0);
    $("#approve").innerHTML = picks.approved
      ? `<p class="done">Sent to build on ${new Date(picks.approved).toLocaleString()}.</p><p>Tell me in the chat when you want me to start, or keep adjusting; I'll build from what's saved here.</p><div><button class="btn small" id="unapprove">I'm still picking</button></div>`
      : `<p>When you've picked everything you want from all ten lists, press the button. Then tell me in the chat and I'll build them in order.</p><div><button class="btn primary" id="approve-btn" ${total ? "" : "disabled"}>Build my picks (${total})</button></div>`;
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.classList.contains("tab")) return show(t.dataset.p, true);
    if (t.hasAttribute("data-add")) { const c = t.closest(".card"); const on = !has(c.dataset.k, c.dataset.id); toggle(c.dataset.k, c.dataset.id, on); toast(on ? "Added" : "Removed"); return; }
    if (t.dataset.up) {
      const id = t.dataset.up, j = +t.dataset.j, arr = picks.ups[id] || (picks.ups[id] = []), i = arr.indexOf(j);
      if (i < 0) arr.push(j); else arr.splice(i, 1);
      if (arr.length && !has("a6", id)) picks.a6.push(id);
      save();
      return;
    }
    if (t.dataset.all) { const k = t.dataset.all; PL[k].items.forEach((it) => toggle(k, it.id, true)); toast("All added"); return; }
    if (t.dataset.none) { const k = t.dataset.none; picks[k] = []; if (k === "a6") picks.ups = {}; save(); toast("Cleared"); return; }
    if (t.id === "approve-btn") { picks.approved = new Date().toISOString(); save(); toast("Sent. Tell me in the chat to start."); return; }
    if (t.id === "unapprove") { picks.approved = null; save(); return; }
  });
  document.addEventListener("input", (e) => {
    const k = e.target.dataset && e.target.dataset.note;
    if (!k) return;
    picks.notes[k] = e.target.value;
    save();
  });
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && h !== tab) show(h); });

  /* ---------- boot ---------- */
  try { merge(JSON.parse(localStorage.getItem(LS) || "null")); } catch (e) {}
  build();
  const fillNotes = () => $$("[data-note]").forEach((t) => (t.value = picks.notes[t.dataset.note] || ""));
  fillNotes();
  render();
  let start = location.hash.slice(1);
  if (!start) try { start = localStorage.getItem("sswx-postlaunch-tab") || "a1"; } catch (e) { start = "a1"; }
  show(start);
  (async () => {
    try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch (e) { db = null; }
    if (db) {
      try {
        const snap = await db.doc(DOC).get();
        const d = snap && snap.exists !== false && snap.data && snap.data();
        if (d) { merge(JSON.parse(JSON.stringify(d))); fillNotes(); }
        status("ok", "Saved · Claude can read your picks");
      } catch (e) { status("local", "Can't reach saved picks; saving on this device"); }
    } else status("local", "Saved on this device only");
    loaded = true;
    render();
  })();
})();
