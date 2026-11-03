/* Shared pieces for the lab's menus and Randoms: DOM, entries, drag with velocity, spring loops. */
const K = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  const one = (g) => (g.pages.length === 1 ? g.pages[0] : null);

  /** Sections (one-page sections open straight away), or one section's pages. Same rule as the app. */
  function entries(groups, sel) {
    if (sel) return sel.pages.map((p) => ({ key: p.label, label: p.label, icon: p.icon, page: p, group: sel.label }));
    return groups.map((g) => {
      const o = one(g);
      return { key: g.id, label: o ? o.label : g.label, icon: o ? o.icon : g.icon, page: o, sec: o ? null : g, count: g.pages.length };
    });
  }

  /** Every page as one flat list of shortcuts (Quick Menus): each pin or chasing page, then any section's pages. */
  const flat = (groups) => groups.flatMap((g) => g.pages.map((p) => ({ key: g.id + "/" + p.label, label: p.label, icon: p.icon, page: p, group: g.label })));

  /** Pointer drag with capture: reports start, move (dx, dy, vx, vy in px/s) and end; `moved` tells a tap from a drag. */
  function drag(el, { down, move, up }, { threshold = 6 } = {}) {
    let id = null, x0 = 0, y0 = 0, lx = 0, ly = 0, lt = 0, vx = 0, vy = 0, moved = false;
    const onDown = (e) => {
      if (id !== null || (e.button !== undefined && e.button > 0)) return;
      id = e.pointerId; x0 = lx = e.clientX; y0 = ly = e.clientY; lt = performance.now(); vx = vy = 0; moved = false;
      down && down({ x: x0, y: y0, e });
    };
    const onMove = (e) => {
      if (e.pointerId !== id) return;
      const t = performance.now(), dt = Math.max(1, t - lt);
      const nvx = ((e.clientX - lx) / dt) * 1000, nvy = ((e.clientY - ly) / dt) * 1000;
      vx = vx * 0.6 + nvx * 0.4; vy = vy * 0.6 + nvy * 0.4;
      lx = e.clientX; ly = e.clientY; lt = t;
      if (!moved && Math.hypot(lx - x0, ly - y0) > threshold) {
        moved = true;
        // Capture only once it's a drag, so a plain tap still clicks the button under the finger.
        try { el.setPointerCapture(id); } catch (err) {}
      }
      move && move({ x: lx, y: ly, dx: lx - x0, dy: ly - y0, vx, vy, moved, e });
    };
    const onUp = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      if (performance.now() - lt > 90) { vx = 0; vy = 0; }
      up && up({ x: lx, y: ly, dx: lx - x0, dy: ly - y0, vx, vy, moved, e });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }

  /** A requestAnimationFrame loop; the callback gets seconds since the last frame and returns false to stop. */
  function loop(fn) {
    let id = 0, last = performance.now(), run = true;
    const f = (t) => {
      if (!run) return;
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      if (fn(dt, t) === false) { run = false; return; }
      id = requestAnimationFrame(f);
    };
    id = requestAnimationFrame(f);
    return () => { run = false; cancelAnimationFrame(id); };
  }

  /** A damped spring toward `target`: call step(dt) each frame; `rest` says it has settled. */
  function spring(value, { k = 170, c = 18 } = {}) {
    const s = { value, target: value, v: 0, k, c,
      step(dt) {
        const n = Math.max(1, Math.ceil(dt / 0.008)), d = dt / n;
        for (let i = 0; i < n; i++) { const a = -s.k * (s.value - s.target) - s.c * s.v; s.v += a * d; s.value += s.v * d; }
        return s.value;
      },
      get rest() { return Math.abs(s.v) < 0.01 && Math.abs(s.value - s.target) < 0.01; },
    };
    return s;
  }

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 30) : ms));

  /** Every listener and timer a menu adds, so destroy() can remove them all. */
  function bag() {
    const offs = [];
    return {
      on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); offs.push(() => el.removeEventListener(ev, fn, opt)); },
      add(off) { offs.push(off); return off; },
      timer(fn, ms) { const t = setTimeout(fn, ms); offs.push(() => clearTimeout(t)); return t; },
      clear() { while (offs.length) try { offs.pop()(); } catch (e) {} },
    };
  }

  return { reduce, h, one, entries, flat, drag, loop, spring, clamp, wait, bag };
})();

/* Each menu registers here; the lab mounts one at a time on the phone stage. */
const MENUS = { main: [], quick: [] };
