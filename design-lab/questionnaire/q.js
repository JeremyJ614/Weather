/* Questionnaire: render, answer, save to the artifact database for Claude to read. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const state = { answers: {}, notes: {}, introChoice: null };
  let db = null, timer = 0, n = 0;
  const total = SECTIONS.reduce((a, s) => a + s.qs.length, 0) + 1;

  $("#qs").innerHTML = SECTIONS.map(sec => `<section id="s-${sec.id}"><h2>${esc(sec.title)} <small>${sec.qs.length} QUESTIONS</small></h2>${sec.qs.map(q => { n++; return `
    <div class="q ${q.type}" data-id="${q.id}">
      <h3><span class="n">${String(n).padStart(2, "0")}</span><span>${esc(q.q)}</span></h3>
      ${q.help ? `<p class="help">${esc(q.help)}</p>` : ""}
      ${q.type === "text" ? `<textarea class="main" id="a-${q.id}" placeholder="Type your answer"></textarea>` : `<div class="opts">${q.opts.map(o => `<button class="opt" data-v="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join("")}</div>
      <button class="notebtn" data-note="${q.id}">+ Add a note</button><textarea id="n-${q.id}" hidden placeholder="Your note"></textarea>`}
    </div>`; }).join("")}</section>`).join("");
  $("#chips").innerHTML = `<a class="sc" href="#s-intro" data-sec="intro">Intro <span></span></a>` + SECTIONS.map(s => `<a class="sc" href="#s-${s.id}" data-sec="${s.id}">${esc(s.title)} <span></span></a>`).join("");
  $$(".sc").forEach(a => a.style.textDecoration = "none");

  document.addEventListener("click", e => {
    const o = e.target.closest(".opt");
    if (o) { const card = o.closest(".q"), id = card.dataset.id, v = o.dataset.v;
      if (card.classList.contains("many")) { const arr = Array.isArray(state.answers[id]) ? state.answers[id] : []; const k = arr.indexOf(v); k >= 0 ? arr.splice(k, 1) : arr.push(v); state.answers[id] = arr; }
      else state.answers[id] = state.answers[id] === v ? null : v;
      save(); return; }
    const nb = e.target.closest(".notebtn");
    if (nb) { const t = $("#n-" + nb.dataset.note); t.hidden = false; nb.hidden = true; t.focus(); return; }
    const pk = e.target.closest("[data-pick]");
    if (pk) { state.introChoice = state.introChoice === pk.dataset.pick ? null : pk.dataset.pick; save(); if (state.introChoice) toast(state.introChoice === "storm" ? "Storm edit chosen" : "Original chosen"); }
  });
  document.addEventListener("input", e => {
    const t = e.target; if (t.tagName !== "TEXTAREA") return;
    if (t.id === "note-intro") state.notes.intro = t.value;
    else if (t.id.startsWith("a-")) state.answers[t.id.slice(2)] = t.value;
    else if (t.id.startsWith("n-")) state.notes[t.id.slice(2)] = t.value;
    save();
  });

  function answered(q) { const v = state.answers[q.id]; return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()); }
  function sync() {
    $$(".q").forEach(card => { const id = card.dataset.id, v = state.answers[id];
      $$(".opt", card).forEach(b => b.setAttribute("aria-pressed", Array.isArray(v) ? v.includes(b.dataset.v) : v === b.dataset.v));
      const ta = $("#a-" + id); if (ta && document.activeElement !== ta) ta.value = v || "";
      const nt = $("#n-" + id); if (nt) { if (document.activeElement !== nt) nt.value = state.notes[id] || ""; if (state.notes[id]) { nt.hidden = false; const b = card.querySelector(".notebtn"); if (b) b.hidden = true; } }
      card.classList.toggle("answered", answered({ id })); });
    $$("[data-pick]").forEach(b => b.setAttribute("aria-pressed", state.introChoice === b.dataset.pick));
    const ni = $("#note-intro"); if (document.activeElement !== ni) ni.value = state.notes.intro || "";
    let done = state.introChoice ? 1 : 0;
    SECTIONS.forEach(s => { const c = s.qs.filter(answered).length; done += c; const chip = $(`.sc[data-sec="${s.id}"]`); chip.querySelector("span").textContent = `${c}/${s.qs.length}`; chip.classList.toggle("done", c === s.qs.length); });
    const ic = $(`.sc[data-sec="intro"]`); ic.querySelector("span").textContent = state.introChoice ? "1/1" : "0/1"; ic.classList.toggle("done", !!state.introChoice);
    $("#prog").style.transform = `scaleX(${done / total})`;
    $("#count").textContent = `${done} of ${total} answered`;
  }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1600); }
  function setSave(h) { $("#save").innerHTML = h; }
  function save() {
    sync();
    if (!db) { setSave("Answers are kept on this screen only"); return; }
    clearTimeout(timer); setSave("Saving&hellip;");
    timer = setTimeout(async () => { try { await db.doc("answers/owner").set({ ...JSON.parse(JSON.stringify(state)), updatedAt: new Date().toISOString() }); setSave("<b>Saved</b>"); } catch (e) { setSave("Could not save: " + (e?.message || e?.code || "unknown error")); } }, 600);
  }

  sync(); setSave("Connecting&hellip;");
  (async () => {
    try { db = window.claude && await window.claude.use("db"); } catch (e) { db = null; }
    if (!db) { setSave("Answers are kept on this screen only"); return; }
    try { const snap = await db.doc("answers/owner").get(); const d = snap.data && snap.data();
      if (d) for (const k of Object.keys(state)) if (d[k] !== undefined && d[k] !== null) state[k] = JSON.parse(JSON.stringify(d[k]));
      sync(); setSave("<b>Connected</b> &middot; answers save automatically");
    } catch (e) { setSave("Could not load saved answers: " + (e?.message || e?.code || "unknown error")); }
  })();
})();
