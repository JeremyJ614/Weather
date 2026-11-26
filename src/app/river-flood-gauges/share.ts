/**
 * River gauge share picture (owner's list #41): the expanded hydrograph as a card. The gauge's
 * place on top, the river big, its flood category lit in its color with the stage now and how
 * far over or under flood stage it is, the hydrograph (flood bands, observed trace glowing
 * over a gradient, the NWS forecast dashed to its crest, now marked), tiles for now, the
 * 6-hour trend, the crest and flood stage, and the gauge's flood-stage ladder. Drawn on the
 * phone when someone taps Share.
 */
import { tokens } from "@/features/share/card";
import {
  backdrop,
  canvas,
  foot,
  masthead,
  mono,
  panel,
  place,
  png,
  stat,
  SW,
} from "@/features/share/studio";
import type { Gauge, Hydro } from "@/lib/rivers/data";
import { GAUGE_LEVELS } from "@/lib/rivers/style";

const label = (lvl: string) =>
  GAUGE_LEVELS.find((l) => l.key === lvl)?.label ?? lvl;
const fmt = (iso: string) =>
  new Date(iso)
    .toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      timeZoneName: "short",
    })
    .toUpperCase();

export async function makeGauge(
  g: Gauge,
  d: { observed: Hydro; forecast: Hydro; units: string },
  c: (lvl: string) => string,
): Promise<Blob> {
  const accent = c(g.level === "normal" ? "normal" : g.level);
  const t = await tokens();
  const mf = mono();
  const { c: cv, g: x } = canvas();
  const u = d.units || g.units;
  backdrop(x, t, accent);
  masthead(x, t, "River & Flood Gauges");
  place(x, t, `${g.name}, ${g.state}`, 48, 124, 24, SW - 96);
  // The river, big and lit.
  x.font = `800 72px ${t.disp}`;
  x.shadowColor = t.accent;
  x.shadowBlur = 24;
  x.fillStyle = t.accent;
  x.fillText((g.river || g.name).toUpperCase(), 48, 210, SW - 96);
  x.shadowBlur = 0;
  // Category chip and the stage now.
  const last = d.observed.at(-1);
  const stage = last?.v ?? g.stage;
  const chip = label(g.level).toUpperCase();
  x.font = `800 20px ${t.sans}`;
  x.letterSpacing = "3px";
  const cw = x.measureText(chip).width + 44;
  x.beginPath();
  x.roundRect(48, 238, cw, 46, 23);
  x.fillStyle = "rgba(255,255,255,0.04)";
  x.fill();
  x.strokeStyle = accent;
  x.lineWidth = 2;
  x.shadowColor = accent;
  x.shadowBlur = 16;
  x.stroke();
  x.shadowBlur = 0;
  x.fillStyle = accent;
  x.fillText(chip, 70, 269);
  x.letterSpacing = "0px";
  if (stage != null && g.flood != null) {
    const diff = Math.round((stage - g.flood) * 10) / 10;
    x.font = `700 21px ${t.sans}`;
    x.fillStyle = t.text;
    x.fillText(
      diff >= 0
        ? `${diff} ${u} over flood stage`
        : `${-diff} ${u} below flood stage`,
      48 + cw + 18,
      269,
      SW - 96 - cw - 18,
    );
  }

  // The hydrograph.
  const PX = 30;
  const PY = 306;
  const PW = SW - 60;
  const PH = 640;
  panel(x, t, PX, PY, PW, PH, 30, 0.35);
  const P = { l: PX + 86, r: PX + PW - 28, t: PY + 40, b: PY + PH - 76 };
  const all = [...d.observed, ...d.forecast];
  const ts = all.map((p) => Date.parse(p.t));
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const span = Math.max(1, t1 - t0);
  const stages = all.map((p) => p.v);
  const marks = (
    [
      ["action", g.action],
      ["minor", g.flood],
      ["moderate", g.moderate],
      ["major", g.major],
    ] as [string, number | null][]
  ).filter((m): m is [string, number] => m[1] != null);
  const peak = Math.max(...stages);
  const low = Math.min(...stages);
  const near = marks
    .filter((m) => m[1] <= peak + (peak - low || 1) * 1.4)
    .map((m) => m[1]);
  const lo = Math.min(low, ...near);
  const hi = Math.max(peak, ...near);
  const pad = (hi - lo || 1) * 0.16;
  const yLo = lo - pad;
  const yHi = hi + pad;
  const X = (tt: string | number) =>
    P.l +
    (((typeof tt === "string" ? Date.parse(tt) : tt) - t0) / span) *
      (P.r - P.l);
  const Y = (v: number) =>
    P.t + (1 - (v - yLo) / (yHi - yLo || 1)) * (P.b - P.t);
  // Flood bands.
  for (const [k, v] of [...marks].reverse()) {
    if (v < yLo || v > yHi) continue;
    x.fillStyle = c(k);
    x.globalAlpha = 0.07;
    x.fillRect(P.l, P.t, P.r - P.l, Math.max(0, Y(v) - P.t));
    x.globalAlpha = 0.85;
    x.strokeStyle = c(k);
    x.lineWidth = 1.6;
    x.setLineDash([10, 8]);
    x.beginPath();
    x.moveTo(P.l, Y(v));
    x.lineTo(P.r, Y(v));
    x.stroke();
    x.setLineDash([]);
    x.globalAlpha = 1;
    x.font = `700 15px ${mf}`;
    x.fillStyle = c(k);
    x.textAlign = "right";
    x.fillText(
      `${k === "minor" ? "FLOOD" : k.toUpperCase()} ${v}`,
      P.r - 4,
      Y(v) - 8,
    );
    x.textAlign = "left";
  }
  // Grid and axes.
  x.font = `600 15px ${mf}`;
  for (const f of [0, 0.25, 0.5, 0.75, 1]) {
    const v = yLo + (yHi - yLo) * f;
    x.strokeStyle = "rgba(255,255,255,0.07)";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(P.l, Y(v));
    x.lineTo(P.r, Y(v));
    x.stroke();
    x.fillStyle = t.muted;
    x.textAlign = "right";
    x.fillText(v.toFixed(1), P.l - 12, Y(v) + 5);
  }
  x.textAlign = "left";
  x.save();
  x.translate(PX + 22, (P.t + P.b) / 2);
  x.rotate(-Math.PI / 2);
  x.textAlign = "center";
  x.font = `700 13px ${t.sans}`;
  x.letterSpacing = "3px";
  x.fillStyle = t.muted;
  x.fillText(`STAGE (${u.toUpperCase()})`, 0, 0);
  x.letterSpacing = "0px";
  x.restore();
  const hours = span / 3600_000;
  const step = hours > 120 ? 24 : hours > 48 ? 12 : 6;
  const start = new Date(t0);
  start.setMinutes(0, 0, 0);
  x.font = `600 14px ${mf}`;
  x.fillStyle = t.muted;
  x.textAlign = "center";
  for (let tt = start.getTime(); tt <= t1; tt += step * 3600_000) {
    if (tt < t0) continue;
    const lab =
      step >= 24
        ? new Date(tt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : new Date(tt).toLocaleString("en-US", {
            weekday: "short",
            hour: "numeric",
          });
    x.fillText(lab.toUpperCase(), X(tt), P.b + 30);
  }
  x.textAlign = "left";
  // Now.
  const nowX = X(Math.min(Math.max(Date.now(), t0), t1));
  x.strokeStyle = t.accent;
  x.globalAlpha = 0.7;
  x.setLineDash([3, 5]);
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(nowX, P.t);
  x.lineTo(nowX, P.b);
  x.stroke();
  x.setLineDash([]);
  x.globalAlpha = 1;
  x.font = `800 13px ${t.sans}`;
  x.letterSpacing = "3px";
  x.fillStyle = t.accent;
  x.textAlign = "center";
  x.fillText("NOW", nowX, P.t - 12);
  x.textAlign = "left";
  x.letterSpacing = "0px";
  // Observed: gradient fill, then a glowing trace.
  const trace = (h: Hydro) => {
    const p = new Path2D();
    h.forEach((q, i) =>
      i ? p.lineTo(X(q.t), Y(q.v)) : p.moveTo(X(q.t), Y(q.v)),
    );
    return p;
  };
  if (d.observed.length > 1) {
    const fill = trace(d.observed);
    fill.lineTo(X(d.observed.at(-1)!.t), P.b);
    fill.lineTo(X(d.observed[0].t), P.b);
    fill.closePath();
    const gr = x.createLinearGradient(0, P.t, 0, P.b);
    gr.addColorStop(0, accent);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr;
    x.globalAlpha = 0.34;
    x.fill(fill);
    x.globalAlpha = 1;
  }
  x.lineJoin = "round";
  x.lineCap = "round";
  x.strokeStyle = accent;
  x.lineWidth = 5;
  x.shadowColor = accent;
  x.shadowBlur = 18;
  x.stroke(trace(d.observed));
  x.shadowBlur = 0;
  if (d.forecast.length) {
    const fc = d.observed.length
      ? [d.observed.at(-1)!, ...d.forecast]
      : d.forecast;
    x.strokeStyle = t.accent;
    x.lineWidth = 4;
    x.setLineDash([14, 10]);
    x.shadowColor = t.accent;
    x.shadowBlur = 12;
    x.stroke(trace(fc));
    x.setLineDash([]);
    x.shadowBlur = 0;
  }
  if (last) {
    x.fillStyle = accent;
    x.shadowColor = accent;
    x.shadowBlur = 20;
    x.beginPath();
    x.arc(X(last.t), Y(last.v), 10, 0, Math.PI * 2);
    x.fill();
    x.shadowBlur = 0;
    x.strokeStyle = "#0b0c14";
    x.lineWidth = 3;
    x.stroke();
  }
  const crest = d.forecast.length
    ? d.forecast.reduce((m, p) => (p.v > m.v ? p : m))
    : null;
  if (crest) {
    const cx = X(crest.t);
    const cy = Y(crest.v);
    x.strokeStyle = t.accent;
    x.lineWidth = 3;
    x.beginPath();
    x.arc(cx, cy, 10, 0, Math.PI * 2);
    x.stroke();
    const txt = `CREST ${crest.v} ${u.toUpperCase()}`;
    x.font = `800 18px ${t.sans}`;
    const tw = x.measureText(txt).width + 24;
    const bx = Math.min(P.r - tw, Math.max(P.l, cx - tw / 2));
    const by = Math.max(P.t + 2, cy - 54);
    x.beginPath();
    x.roundRect(bx, by, tw, 32, 16);
    x.fillStyle = "rgba(10,12,20,0.85)";
    x.fill();
    x.strokeStyle = t.accent;
    x.lineWidth = 1.5;
    x.stroke();
    x.fillStyle = t.accent;
    x.fillText(txt, bx + 12, by + 23);
  }
  // Legend line in the panel's foot.
  x.font = `600 14px ${t.sans}`;
  x.fillStyle = t.muted;
  x.fillText("SOLID: OBSERVED  ·  DASHED: NWS FORECAST", P.l, PY + PH - 18);

  // Tiles.
  const ty = PY + PH + 30;
  const tw = (SW - 96) / 4;
  const six = d.observed.length
    ? d.observed.filter(
        (p) =>
          Date.parse(d.observed.at(-1)!.t) - Date.parse(p.t) <= 6 * 3600_000,
      )[0]
    : null;
  const trend = last && six ? Math.round((last.v - six.v) * 10) / 10 : null;
  stat(x, t, "Stage now", stage == null ? "–" : `${stage} ${u}`, 48, ty, {
    color: accent,
    size: 36,
    max: tw - 16,
    sub: last ? fmt(last.t) : undefined,
  });
  stat(
    x,
    t,
    "6-hour trend",
    trend == null
      ? "–"
      : `${trend > 0 ? "+" : trend < 0 ? "−" : ""}${Math.abs(trend)} ${u}`,
    48 + tw,
    ty,
    {
      size: 36,
      max: tw - 16,
      sub:
        trend == null
          ? undefined
          : trend > 0.05
            ? "Rising"
            : trend < -0.05
              ? "Falling"
              : "Steady",
    },
  );
  stat(
    x,
    t,
    "Forecast crest",
    crest ? `${crest.v} ${u}` : "None",
    48 + tw * 2,
    ty,
    {
      color: crest ? t.accent : undefined,
      size: 36,
      max: tw - 16,
      sub: crest ? fmt(crest.t) : "no NWS forecast",
    },
  );
  stat(
    x,
    t,
    "Flood stage",
    g.flood == null ? "–" : `${g.flood} ${u}`,
    48 + tw * 3,
    ty,
    {
      size: 36,
      max: tw - 16,
    },
  );
  // The ladder.
  const ly = ty + 140;
  let lx = 48;
  x.font = `700 15px ${t.sans}`;
  for (const [k, v] of marks) {
    const name = k === "minor" ? "Flood" : k[0].toUpperCase() + k.slice(1);
    const txt = `${name} ${v}`;
    x.fillStyle = c(k);
    x.shadowColor = c(k);
    x.shadowBlur = 8;
    x.beginPath();
    x.roundRect(lx, ly - 12, 22, 10, 5);
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = t.text;
    x.fillText(txt, lx + 30, ly - 2);
    lx += x.measureText(txt).width + 64;
  }
  // In words: where it stands, which way it's going and what the forecast says.
  const cat = (v: number) => {
    const m = [...marks].reverse().find((q) => v >= q[1]);
    return m ? (m[0] === "minor" ? "minor" : m[0]) : null;
  };
  const words: string[] = [];
  const river = g.river || g.name;
  if (stage != null) {
    const now = cat(stage);
    words.push(
      `The ${river} at ${g.name} is at ${stage} ${u}${now ? (now === "action" ? ", at action stage" : `, in ${now} flood`) : ", below flood stage"}${trend == null ? "" : trend > 0.05 ? " and rising" : trend < -0.05 ? " and falling" : " and holding steady"}.`,
    );
  }
  if (d.forecast.length && g.flood != null) {
    const end = d.forecast.at(-1)!;
    const below = d.forecast.find(
      (p) => stage != null && stage >= g.flood! && p.v < g.flood!,
    );
    const above = d.forecast.find(
      (p) => stage != null && stage < g.flood! && p.v >= g.flood!,
    );
    const day = (iso: string) =>
      new Date(iso).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    if (below)
      words.push(
        `The NWS forecast has it back below flood stage by ${day(below.t)}.`,
      );
    else if (above)
      words.push(
        `The NWS forecast has it reaching flood stage by ${day(above.t)}.`,
      );
    else if (stage != null && stage >= g.flood)
      words.push(
        `The NWS forecast keeps it above flood stage through ${day(end.t)}, ending near ${end.v} ${u}.`,
      );
    else
      words.push(
        `The NWS forecast keeps it below flood stage through ${day(end.t)}.`,
      );
  }
  x.font = `500 23px ${t.sans}`;
  x.fillStyle = t.text;
  const lines: string[] = [];
  let line = "";
  for (const w of words.join(" ").split(" ")) {
    const tt = line ? `${line} ${w}` : w;
    if (x.measureText(tt).width > SW - 96 && line) {
      lines.push(line);
      line = w;
    } else line = tt;
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((l, i) => x.fillText(l, 48, ly + 58 + i * 34));
  foot(
    x,
    t,
    `NWS National Water Prediction Service · gauge ${g.id} · weather.sswx.space/river-flood-gauges`,
  );
  return png(cv);
}
