/**
 * 3D Soundings shares (owner's list #41). Two looks, both with the place on top:
 *  - Share: the 3D sounding big (held still at the viewer's angle), the key numbers, the plain
 *    reading and the key (1080×1350).
 *  - Social share: the 3D sounding first, then the Skew-T and hodograph side by side under it,
 *    with the numbers (1080×1920).
 * Balloons share a picture. Models share a picture, GIF or video that plays the run: between
 * forecast hours the profile is blended level by level and re-analyzed, so the soundings morph
 * smoothly instead of jumping. The 3D view never turns in a share. Drawn on the phone.
 */
import { tokens } from "@/features/share/card";
import type { Format } from "@/features/share/motion";
import {
  backdrop,
  canvas,
  encode,
  foot,
  masthead,
  mono,
  panel,
  place,
  type Ctx,
} from "@/features/share/studio";
import { draw3d } from "@/features/soundings/draw3d";
import {
  drawHodo,
  drawSkew,
  SKEW_BOX,
  skewGridLayer,
} from "@/features/soundings/canvasArt";
import { explain } from "@/lib/soundings/explain";
import { SND_BANDS } from "@/lib/soundings/style";
import { analyze, type Analysis, type Level } from "@/lib/soundings/thermo";

export type SndFrame = { levels: Level[]; when: string; tag: string };
export type SndClip = {
  kind: "balloon" | "model";
  /** The place on top ("Norman, OK"). */
  place: string;
  /** Source and site ("HRRR model · KOUN", "Weather balloon · OUN"). */
  source: string;
  frames: SndFrame[];
  /** The frame on screen (the picture). */
  at: number;
  parcel: "ml" | "sb" | "mu";
  view: { yaw: number; tilt: number };
  c: (k: string) => string;
};

const PARCEL = { ml: "MIXED-LAYER", sb: "SURFACE", mu: "MOST UNSTABLE" };

/** Wind components from a level (or null). */
const uv = (l: Level) => {
  if (l[4] == null || l[5] == null) return null;
  const r = (l[4] * Math.PI) / 180;
  return { u: -l[5] * Math.sin(r), v: -l[5] * Math.cos(r) };
};

/** B's fields at pressure p (log-p interpolation; null outside its range). */
function sample(B: Level[], p: number) {
  if (p > B[0][0]) return null;
  const j = B.findIndex((l) => l[0] <= p);
  if (j < 0) return null;
  if (j === 0) return B[0];
  const a = B[j - 1];
  const b = B[j];
  const f =
    (Math.log(a[0]) - Math.log(p)) / (Math.log(a[0]) - Math.log(b[0]) || 1);
  const lerp = (x: number | null, y: number | null) =>
    x == null || y == null ? null : x + (y - x) * f;
  const wa = uv(a);
  const wb = uv(b);
  const w =
    wa && wb
      ? { u: wa.u + (wb.u - wa.u) * f, v: wa.v + (wb.v - wa.v) * f }
      : null;
  return [
    p,
    lerp(a[1], b[1]) ?? a[1],
    lerp(a[2], b[2]) ?? a[2],
    lerp(a[3], b[3]),
    w ? (Math.atan2(-w.u, -w.v) * 180) / Math.PI + 360 : null,
    w ? Math.hypot(w.u, w.v) : null,
  ] as Level;
}

/** A profile `f` of the way from A to B, on A's pressure levels. */
export function blend(A: Level[], B: Level[], f: number): Level[] {
  if (f <= 0) return A;
  if (f >= 1) return B;
  const out: Level[] = [];
  const sfcP = A[0][0] + (B[0][0] - A[0][0]) * f;
  for (const l of A) {
    const p = l === A[0] ? sfcP : l[0];
    if (l !== A[0] && p >= sfcP) continue;
    const b = l === A[0] ? B[0] : sample(B, p);
    if (!b) {
      out.push(l);
      continue;
    }
    const mix = (x: number | null, y: number | null) =>
      x == null ? y : y == null ? x : x + (y - x) * f;
    const wa = uv(l);
    const wb = uv(b);
    const w =
      wa && wb
        ? { u: wa.u + (wb.u - wa.u) * f, v: wa.v + (wb.v - wa.v) * f }
        : null;
    out.push([
      p,
      mix(l[1], b[1]) as number,
      mix(l[2], b[2]) as number,
      mix(l[3], b[3]),
      w ? ((Math.atan2(-w.u, -w.v) * 180) / Math.PI + 360) % 360 : l[4],
      w ? Math.hypot(w.u, w.v) : l[5],
    ]);
  }
  return out;
}

async function placeName(lat: number, lon: number) {
  try {
    const r = await fetch(`/api/geo/near?lat=${lat}&lon=${lon}`);
    const j = (await r.json()) as { label: string | null };
    return j.label;
  } catch {
    return null;
  }
}
export { placeName };

/** The numbers row: label, value, color. */
function numbers(a: Analysis, p: Analysis["ml"], c: (k: string) => string) {
  return [
    ["CAPE", `${p.cape}`, p.cape > 1000 ? c("cape") : undefined],
    ["CIN", `${p.cin}`, p.cin < -25 ? c("cin") : undefined],
    ["0–6 KM SHEAR", a.shear6 == null ? "–" : `${a.shear6} kt`, undefined],
    ["0–1 KM SRH", a.srh1 == null ? "–" : `${a.srh1}`, undefined],
    [
      "STP",
      a.stp == null ? "–" : `${a.stp}`,
      (a.stp ?? 0) >= 1 ? c("temp") : undefined,
    ],
    ["SCP", a.scp == null ? "–" : `${a.scp}`, undefined],
  ] as [string, string, string | undefined][];
}

function tiles(
  g: Ctx,
  t: Awaited<ReturnType<typeof tokens>>,
  rows: [string, string, string | undefined][],
  x: number,
  y: number,
  w: number,
  cols: number,
  h = 92,
) {
  const tw = (w - (cols - 1) * 12) / cols;
  rows.forEach(([k, v, col], i) => {
    const tx = x + (i % cols) * (tw + 12);
    const ty = y + Math.floor(i / cols) * (h + 12);
    panel(g, t, tx, ty, tw, h, 18, 0.22);
    g.textAlign = "left";
    g.font = `700 12px ${t.sans}`;
    g.letterSpacing = "2.5px";
    g.fillStyle = t.muted;
    g.fillText(k, tx + 16, ty + 30, tw - 24);
    g.letterSpacing = "0px";
    g.font = `800 34px ${t.disp}`;
    g.fillStyle = col ?? t.text;
    if (col) {
      g.shadowColor = col;
      g.shadowBlur = 14;
    }
    g.fillText(v, tx + 16, ty + 72, tw - 24);
    g.shadowBlur = 0;
  });
}

function wrap(g: Ctx, text: string, w: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const tt = line ? `${line} ${word}` : word;
    if (g.measureText(tt).width > w && line) {
      out.push(line);
      line = word;
    } else line = tt;
  }
  if (line) out.push(line);
  return out;
}

export async function makeSounding(
  clip: SndClip,
  look: "card" | "social",
  f: Format,
  progress: (done: number, total: number) => void,
): Promise<Blob> {
  const t = await tokens();
  const mf = mono();
  const css = getComputedStyle(document.documentElement);
  const ink = {
    line: css.getPropertyValue("--line").trim() || "#2a2a36",
    muted: t.muted,
    font: t.sans,
  };
  const W = 1080;
  const H = look === "social" ? 1920 : 1350;
  const { c: full, g } = canvas(W, H);
  const c = clip.c;
  // GIFs of the tall card are made at two thirds size (a phone-friendly file).
  const small = f === "gif" && look === "social" ? canvas(720, 1280) : null;

  // Frames to play: models from the hour on screen to the end (at most 36 hours); a run with
  // fewer than 6 hours left plays from its start.
  const n = clip.frames.length;
  let first = clip.at;
  if (n - first < 6) first = 0;
  const list = clip.frames.slice(first, first + 36);
  const cache = new Map<number, Analysis | null>();
  const analysisAt = (s: number) => {
    const i = Math.min(list.length - 1, Math.floor(s));
    const fr = s - i;
    const key = Math.round(s * 1000);
    if (!cache.has(key)) {
      const lv =
        fr > 0.001 && i + 1 < list.length
          ? blend(list[i].levels, list[i + 1].levels, fr)
          : list[i].levels;
      cache.set(key, analyze(lv));
      if (cache.size > 8) cache.delete(cache.keys().next().value!);
    }
    return { a: cache.get(key) ?? null, i };
  };

  // One scale for the whole clip: the strongest wind (and storm motion) in any hour.
  let vmax = 40;
  const playing = f !== "image" && clip.kind === "model" && list.length > 1;
  for (const fr of playing ? list : [clip.frames[clip.at]]) {
    const a = analyze(fr.levels);
    if (!a) continue;
    for (const w of a.wind)
      if (w.z <= 12000) vmax = Math.max(vmax, Math.hypot(w.u, w.v));
    if (a.rm) vmax = Math.max(vmax, Math.hypot(a.rm.u, a.rm.v));
  }
  const ring3 = Math.ceil(vmax / 20) * 20;
  const ringH = Math.ceil(vmax / 10) * 10;
  const scale = look === "social" ? 1.18 : 1;
  const grid = look === "social" ? skewGridLayer(scale, ink) : null;

  const draw = (a: Analysis, fr: SndFrame, s: number) => {
    const p = a[clip.parcel];
    backdrop(g, t, c("cin"), W, H);
    masthead(g, t, "3D Soundings", W);
    place(g, t, clip.place, 48, 124, 30, W - 96);
    g.font = `700 22px ${t.sans}`;
    g.fillStyle = t.text;
    g.fillText(clip.source.toUpperCase(), 48, 166, W - 96);
    g.font = `700 17px ${mf}`;
    g.letterSpacing = "2px";
    g.fillStyle = t.muted;
    g.fillText(
      `${fr.tag} · ${fr.when.toUpperCase()} · ${PARCEL[clip.parcel]} PARCEL`,
      48,
      200,
      W - 96,
    );
    g.letterSpacing = "0px";
    // The run's progress, for model clips.
    if (clip.kind === "model" && list.length > 1) {
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.fillRect(48, 216, W - 96, 4);
      g.fillStyle = t.accent;
      g.shadowColor = t.accent;
      g.shadowBlur = 10;
      g.fillRect(48, 216, Math.max(6, ((W - 96) * s) / (list.length - 1)), 4);
      g.shadowBlur = 0;
    }

    // The 3D sounding, still, lit.
    const top3 = 236;
    const h3 = look === "social" ? 860 : 740;
    panel(g, t, 30, top3, W - 60, h3, 30, 0.3);
    g.save();
    g.beginPath();
    g.roundRect(30, top3, W - 60, h3, 30);
    g.clip();
    const k3 = 2;
    g.translate(30, top3);
    g.scale(k3, k3);
    draw3d(g, (W - 60) / k3, h3 / k3, { a, parcel: p, c }, clip.view, {
      fs: 1.05,
      lw: 1,
      // GIFs keep only changed pixels; soft glows would leave faint trails there.
      glow: f !== "gif",
      zoom: 1.15,
      ring: ring3,
    });
    g.restore();
    // Height-band key inside the 3D panel's foot.
    g.font = `700 13px ${t.sans}`;
    let kx = 56;
    for (const b of SND_BANDS) {
      g.fillStyle = c(b.key);
      g.beginPath();
      g.roundRect(kx, top3 + h3 - 34, 18, 6, 3);
      g.fill();
      g.fillStyle = t.muted;
      g.fillText(b.label, kx + 24, top3 + h3 - 26);
      kx += g.measureText(b.label).width + 52;
    }

    if (look === "card") {
      tiles(g, t, numbers(a, p, c), 48, top3 + h3 + 22, W - 96, 3);
      g.font = `500 21px ${t.sans}`;
      g.fillStyle = t.text;
      const lines = wrap(g, explain(a), W - 96).slice(0, 3);
      lines.forEach((l, i) => g.fillText(l, 48, top3 + h3 + 252 + i * 30));
    } else {
      // Skew-T and hodograph side by side.
      const ty = top3 + h3 + 20;
      const sw = SKEW_BOX.w * scale;
      const sh = SKEW_BOX.h * scale;
      panel(g, t, 30, ty, sw + 24, sh + 54, 26, 0.25);
      g.font = `700 13px ${t.sans}`;
      g.letterSpacing = "3px";
      g.fillStyle = t.accent;
      g.fillText("SKEW-T", 50, ty + 30);
      g.letterSpacing = "0px";
      drawSkew(g, 42, ty + 42, scale, grid!, a, p, c, ink);
      const hx = 30 + sw + 24 + 14;
      const hw = W - 30 - hx;
      panel(g, t, hx, ty, hw, sh + 54, 26, 0.25);
      g.font = `700 13px ${t.sans}`;
      g.letterSpacing = "3px";
      g.fillStyle = t.accent;
      g.fillText("HODOGRAPH", hx + 20, ty + 30);
      g.letterSpacing = "0px";
      const hs = Math.min(hw - 28, 380);
      drawHodo(g, hx + (hw - hs) / 2, ty + 40, hs, a, c, ink, ringH);
      // The numbers under the hodograph, two columns.
      const rows = numbers(a, p, c);
      const ny = ty + 40 + hs + 4;
      const cw2 = (hw - 40) / 2;
      rows.forEach(([kk, v, col], i) => {
        const cx2 = hx + 20 + (i % 2) * (cw2 + 0);
        const yy = ny + Math.floor(i / 2) * 44;
        g.font = `700 11px ${t.sans}`;
        g.letterSpacing = "2px";
        g.fillStyle = t.muted;
        g.textAlign = "left";
        g.fillText(kk, cx2, yy + 14, cw2 - 8);
        g.letterSpacing = "0px";
        g.font = `800 24px ${t.disp}`;
        g.fillStyle = col ?? t.text;
        g.fillText(v, cx2, yy + 40, cw2 - 8);
      });
      // Key under the Skew-T.
      const ky = ty + sh + 82;
      g.font = `700 14px ${t.sans}`;
      let kx2 = 48;
      for (const [label, col] of [
        ["Temperature", c("temp")],
        ["Dew point", c("dew")],
        ["Parcel", c("parcel")],
        ["CAPE", c("cape")],
        ["CIN (cap)", c("cin")],
      ]) {
        g.fillStyle = col;
        g.beginPath();
        g.roundRect(kx2, ky - 9, 18, 6, 3);
        g.fill();
        g.fillStyle = t.muted;
        g.fillText(label, kx2 + 24, ky);
        kx2 += g.measureText(label).width + 50;
      }
      g.font = `500 20px ${t.sans}`;
      g.fillStyle = t.text;
      wrap(g, explain(a), W - 96)
        .slice(0, 2)
        .forEach((l, i) => g.fillText(l, 48, ky + 40 + i * 28));
    }
    foot(
      g,
      t,
      clip.kind === "balloon"
        ? "NWS weather balloon via the Iowa Environmental Mesonet · computed by SSWX"
        : "NCEP model sounding (BUFKIT) via the Iowa Environmental Mesonet · computed by SSWX",
      W,
      H,
    );
    if (small) {
      small.g.setTransform(1, 0, 0, 1, 0, 0);
      small.g.imageSmoothingQuality = "high";
      small.g.drawImage(full, 0, 0, 720, 1280);
      return small.c;
    }
    return full;
  };

  const still = () => {
    const fr = clip.frames[clip.at];
    const a = analyze(fr.levels);
    if (!a) throw new Error("no analysis");
    return draw(a, fr, Math.max(0, clip.at - first));
  };
  if (f === "image" || clip.kind === "balloon" || list.length < 2)
    return encode("image", async () => still(), progress);

  let last: Analysis | null = null;
  return encode(
    f,
    async (i, total) => {
      // The last sixth holds on the final hour.
      const u = Math.min(1, i / Math.max(1, (total - 1) * 0.86));
      const s = u * (list.length - 1);
      const { a, i: k } = analysisAt(s);
      const use = a ?? last;
      if (!use) throw new Error("no analysis");
      last = use;
      return draw(use, list[k], s);
    },
    progress,
    {
      w: small ? 720 : W,
      h: small ? 1280 : H,
      gifFrames: 120,
      gifMs: 50,
      fps: 30,
      secs: Math.min(14, Math.max(8, list.length * 0.4)),
      holdMs: 1500,
    },
  );
}
