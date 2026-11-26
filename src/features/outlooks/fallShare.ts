/**
 * Fall color share (owner's list #41): a 1080×1350 card headlined "FALL COLOR" and the season,
 * the lower 48 with every first-color report glowing in its leaf color (fresh ones bigger, with
 * a halo), the date and a lit progress line, the season's weekly histogram, three stat tiles
 * and the key. The picture is the date on the scrubber; the GIF and video replay the season up
 * to it, the color sweeping south while maple leaves drift through the card. Drawn on the phone.
 */
import { tokens } from "@/features/share/card";
import type { Format } from "@/features/share/motion";
import {
  backdrop,
  canvas,
  ease,
  encode,
  headline,
  masthead,
  mono,
  panel,
  stat,
  foot,
  SW,
} from "@/features/share/studio";
import { project } from "@/lib/map/usAlbers";
import {
  leafColor,
  seasonStats,
  timeline,
  type FallReport,
} from "@/lib/weather/foliage";

const DAY = 86_400_000;
const MAP_Y = 300;
const MAP_H = 650;
const CW = 975;
const CH = 610;

let base: Promise<{ nation: string; states: { d: string }[] }> | null = null;
const loadBase = () =>
  (base ??= fetch("/api/maps/base").then((r) => {
    if (!r.ok) throw new Error("base map");
    return r.json();
  }));

const fmt = (t: number) =>
  new Date(t)
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();

/** A five-lobed maple leaf of radius ~1 around the origin, stem down, and its veins. */
function mapleLeaf(): [Path2D, Path2D] {
  const m = new DOMMatrix().scale(1 / 48).translate(-50, -52);
  const leaf = new Path2D();
  leaf.addPath(
    new Path2D(
      "M50 2 L57 21 L68 13 L66 34 L84 23 L80 40 L97 42 L82 54 L88 61 L64 64 L66 75 L53 67 L52 98 L48 98 L47 67 L34 75 L36 64 L12 61 L18 54 L3 42 L20 40 L16 23 L34 34 L32 13 L43 21 Z",
    ),
    m,
  );
  const veins = new Path2D();
  veins.addPath(
    new Path2D(
      "M50 92 L50 10 M50 62 L22 46 M50 62 L78 46 M50 62 L30 70 M50 62 L70 70",
    ),
    m,
  );
  return [leaf, veins];
}

/** Deterministic drifting leaves: where leaf `k` is at time u (0..1 of the clip). */
function leafAt(k: number, u: number) {
  const r = (n: number) => {
    const x = Math.sin(k * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const speed = 0.7 + r(1) * 0.6;
  const y = ((r(2) + u * speed) % 1) * 1500 - 80;
  const sway = Math.sin(u * Math.PI * 2 * (1 + r(3)) + r(4) * 6) * 60;
  return {
    x: r(5) * SW + sway,
    y,
    rot: u * Math.PI * 2 * (r(6) - 0.5) * 2 + r(7) * 6,
    size: 16 + r(8) * 20,
    hue: r(9),
    tilt: 0.45 + 0.55 * Math.abs(Math.cos(u * Math.PI * 4 * (0.5 + r(10)))),
  };
}

export async function makeFall(
  report: FallReport,
  asOf: number,
  f: Format,
  progress: (done: number, total: number) => void,
): Promise<Blob> {
  const t = await tokens();
  const b = await loadBase();
  const nation = new Path2D(b.nation);
  const states = new Path2D(b.states.map((x: { d: string }) => x.d).join(""));
  const css = getComputedStyle(document.documentElement);
  const land = css.getPropertyValue("--surface2").trim() || "#151826";
  const mf = mono();
  const [leaf, veins] = mapleLeaf();
  const pts = report.sites.map((s) => ({ ...project(s[0], s[1]), t: s[2] }));
  const stops = timeline(report.start, report.end).filter((x) => x <= asOf);
  if (stops.at(-1) !== asOf) stops.push(asOf);
  const t0 = stops[0];
  const k = SW / CW;
  const ox = 0;
  const oy = MAP_Y + (MAP_H - CH * k) / 2;
  const final = seasonStats(report, asOf);
  const weekMax = Math.max(1, ...final.weeks.map((w) => w.n));
  const amber = leafColor(14);
  const red = leafColor(42);
  const { c, g } = canvas();

  const draw = (now: number, u: number, moving: boolean) => {
    backdrop(g, t, red);
    // Map.
    g.save();
    g.setTransform(k, 0, 0, k, ox, oy);
    g.fillStyle = land;
    g.fill(nation);
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fill(nation);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(255,255,255,0.16)";
    g.lineWidth = 1.1 / k;
    g.stroke(states);
    g.strokeStyle = amber;
    g.globalAlpha = 0.2;
    g.lineWidth = 10 / k;
    g.stroke(nation);
    g.globalAlpha = 0.7;
    g.lineWidth = 1.8 / k;
    g.stroke(nation);
    g.globalAlpha = 1;
    g.restore();
    // Reports: old ones small, fresh ones big with a halo (drawn last, on top).
    const fresh: { x: number; y: number; age: number }[] = [];
    for (const p of pts) {
      if (p.t > now) continue;
      const age = (now - p.t) / DAY;
      const x = ox + p.x * k;
      const y = oy + p.y * k;
      // Sites outside the lower 48's frame (Canada, far offshore) stay off the card.
      if (y < MAP_Y || y > MAP_Y + MAP_H || x < 4 || x > SW - 4) continue;
      if (age < 5) {
        fresh.push({ x, y, age });
        continue;
      }
      g.fillStyle = leafColor(age);
      g.beginPath();
      g.arc(x, y, 5.2, 0, Math.PI * 2);
      g.fill();
    }
    for (const p of fresh) {
      const pop = moving ? Math.min(1, p.age / 1.2) : 1;
      const col = leafColor(p.age);
      g.globalAlpha = 0.22 * (1 - p.age / 5);
      g.fillStyle = col;
      g.beginPath();
      g.arc(p.x, p.y, 7 + 11 * pop, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      g.shadowColor = col;
      g.shadowBlur = 14;
      g.beginPath();
      g.arc(p.x, p.y, 4.5 + 3 * ease(pop), 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }

    // Header.
    masthead(g, t, "Fall Color");
    headline(g, t, "FALL COLOR", report.season, 150, 84);
    g.font = `700 26px ${t.sans}`;
    g.fillStyle = t.text;
    g.fillText(
      report.current
        ? "THE FIRST COLORED LEAVES, COAST TO COAST"
        : "LAST SEASON'S FIRST COLORED LEAVES",
      48,
      196,
      SW - 96,
    );
    // The date and a lit progress line.
    const shown = pts.filter((p) => p.t <= now).length;
    g.font = `700 18px ${mf}`;
    g.letterSpacing = "2px";
    g.fillStyle = t.muted;
    g.fillText(
      `AS OF ${fmt(now)} · ${shown.toLocaleString()} REPORTS`,
      48,
      244,
      SW - 96,
    );
    g.letterSpacing = "0px";
    const frac = asOf > t0 ? (now - t0) / (asOf - t0) : 1;
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(48, 260, SW - 96, 4);
    const bar = g.createLinearGradient(48, 0, SW - 48, 0);
    bar.addColorStop(0, leafColor(0));
    bar.addColorStop(0.5, amber);
    bar.addColorStop(1, red);
    g.fillStyle = bar;
    g.shadowColor = amber;
    g.shadowBlur = 10;
    g.fillRect(48, 260, Math.max(6, (SW - 96) * frac), 4);
    g.shadowBlur = 0;

    // The season's weekly histogram, lit up to now.
    const hy = MAP_Y + MAP_H + 18;
    const hh = 86;
    panel(g, t, 36, hy - 8, SW - 72, hh + 46, 22, 0.25);
    const n = final.weeks.length;
    const bw = (SW - 120) / Math.max(1, n);
    g.font = `700 12px ${t.sans}`;
    g.letterSpacing = "3px";
    g.fillStyle = t.muted;
    g.fillText("REPORTS EACH WEEK", 60, hy + 16);
    g.letterSpacing = "0px";
    final.weeks.forEach((w, i) => {
      const h = Math.max(3, (w.n / weekMax) * (hh - 26));
      const on = w.t <= now;
      g.fillStyle = on ? leafColor(((now - w.t) / DAY) * 0.8) : "#ffffff1a";
      g.beginPath();
      g.roundRect(60 + i * bw + 1.5, hy + hh + 10 - h, bw - 3, h, 3);
      g.fill();
      if (final.peak && w.t === final.peak.t && on) {
        g.font = `800 14px ${mf}`;
        g.fillStyle = t.text;
        g.textAlign = "center";
        g.fillText(
          `PEAK ${w.n}`,
          Math.min(SW - 100, Math.max(100, 60 + i * bw + bw / 2)),
          hy + hh + 10 - h - 8,
        );
        g.textAlign = "left";
      }
    });

    // Tiles.
    const ty = hy + hh + 66;
    const tw = (SW - 96) / 3;
    const recent = pts.filter(
      (p) => p.t <= now && now - p.t <= 14 * DAY,
    ).length;
    const tally = new Map<number, number>();
    for (const x of report.sites)
      if (x[2] <= now) tally.set(x[3], (tally.get(x[3]) ?? 0) + 1);
    const best = [...tally.entries()].sort((p, q) => q[1] - p[1])[0];
    const top = best
      ? { name: report.species[best[0]] ?? "unidentified", n: best[1] }
      : null;
    stat(g, t, "Reports", shown.toLocaleString(), 48, ty, {
      color: amber,
      size: 42,
      max: tw - 20,
    });
    stat(g, t, "Turned in 2 weeks", recent.toLocaleString(), 48 + tw, ty, {
      color: leafColor(2),
      size: 42,
      max: tw - 20,
    });
    stat(
      g,
      t,
      "Most reported",
      top
        ? top.name.replace(
            /(^|[\s-])(\S)/g,
            (_, a: string, b: string) => a + b.toUpperCase(),
          )
        : "—",
      48 + tw * 2,
      ty,
      { size: 26, max: tw - 10, sub: top ? `${top.n} plants` : undefined },
    );

    // Key.
    const ky = ty + 108;
    const keys: [string, string][] = [
      ["JUST TURNED", leafColor(0)],
      ["3 WEEKS", leafColor(21)],
      ["6+ WEEKS", leafColor(42)],
    ];
    let kx = 48;
    g.font = `700 13px ${t.sans}`;
    g.letterSpacing = "2px";
    for (const [label, col] of keys) {
      g.fillStyle = col;
      g.shadowColor = col;
      g.shadowBlur = 8;
      g.beginPath();
      g.arc(kx + 7, ky - 5, 7, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = t.muted;
      g.fillText(label, kx + 22, ky);
      kx += g.measureText(label).width + 56;
    }
    g.letterSpacing = "0px";
    // The color front so far: the middle latitude of the first and latest busy weeks.
    const fw = final.weeks.filter(
      (w) => w.t <= now && w.n >= 3 && Number.isFinite(w.lat),
    );
    if (fw.length >= 2) {
      const a = fw[0];
      const z = fw.at(-1)!;
      const miles = Math.round((a.lat - z.lat) * 69);
      g.font = `700 17px ${mf}`;
      g.letterSpacing = "2px";
      g.fillStyle = t.text;
      g.fillText(
        miles > 30
          ? `THE COLOR FRONT HAS SLID ${miles.toLocaleString()} MILES SOUTH · ${a.lat.toFixed(1)}°N → ${z.lat.toFixed(1)}°N`
          : `THE COLOR FRONT NEAR ${z.lat.toFixed(1)}°N`,
        48,
        ky + 52,
        SW - 96,
      );
      g.letterSpacing = "0px";
    }
    foot(
      g,
      t,
      "Volunteer reports from the USA National Phenology Network · each dot is one plant's first color",
    );

    // Leaves drifting through (the picture keeps a still few).
    // The still picture keeps four leaves in the right margin, clear of words and data.
    const still = [
      { x: 1000, y: 150, size: 34, rot: 0.5, hue: 0.2, tilt: 1 },
      { x: 1046, y: 226, size: 20, rot: 2.2, hue: 0.9, tilt: 0.8 },
      { x: 968, y: 1222, size: 30, rot: 3.8, hue: 0.55, tilt: 0.9 },
      { x: 1036, y: 1170, size: 19, rot: 1.1, hue: 0.05, tilt: 1 },
    ];
    const count = moving ? 16 : still.length;
    for (let i = 0; i < count; i++) {
      const L = moving ? leafAt(i, u) : still[i];
      g.save();
      g.translate(L.x, L.y);
      g.rotate(L.rot);
      g.scale(L.size * L.tilt, L.size);
      const col = leafColor(10 + L.hue * 32);
      g.globalAlpha = moving ? 0.55 : 0.5;
      g.fillStyle = col;
      g.shadowColor = col;
      g.shadowBlur = 10;
      g.fill(leaf);
      g.shadowBlur = 0;
      g.globalAlpha = moving ? 0.5 : 0.55;
      g.strokeStyle = "rgba(255,240,210,0.55)";
      g.lineWidth = 0.05;
      g.lineCap = "round";
      g.stroke(veins);
      g.restore();
    }
    g.globalAlpha = 1;
    return c;
  };

  return encode(
    f,
    async (i, total) => {
      if (f === "image") return draw(asOf, 0, false);
      // Ease through the season; the last fifth holds on the date.
      const u = i / Math.max(1, total - 1);
      const p = Math.min(1, u / 0.82);
      const now = t0 + (asOf - t0) * ease(p);
      return draw(now, u, true);
    },
    progress,
    { gifFrames: 120, gifMs: 50, fps: 30, secs: 9, holdMs: 1800 },
  );
}
