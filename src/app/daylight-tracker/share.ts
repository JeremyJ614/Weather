/**
 * Daylight share picture (owner's list #41): today and the days ahead for one place. The
 * place on top, today's daylight big and glowing with the change since yesterday, the whole
 * 24 hours as twilight bands under the sun's arc (the sun where it is now), six key times,
 * a "days ahead" table (tomorrow, a week, a month, the next solstice or equinox) and the year's
 * daylight curve. Drawn on the phone when someone taps Share.
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
  SW,
  SH,
} from "@/features/share/studio";
import {
  addDays,
  hms,
  keyDays,
  localMinutes,
  sunDay,
  yearDays,
} from "@/lib/weather/daylight";

const SUN = "#ffd66b";
const NIGHT = "#4b5fa8";
const BANDS = [
  "#05060f",
  "#101a3a",
  "#22356b",
  "#4b5fa8",
  "#f2a84a",
  "#7cc4ff",
];

const fmtT = (t: Date | null, tz: string) =>
  t
    ? t.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      })
    : "—";
const fmtD = (ymd: string, long = false) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: long ? "long" : undefined,
    month: long ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  });
const len = (min: number) => {
  const p = hms(min);
  return `${p.h}h ${String(p.m).padStart(2, "0")}m`;
};
const diff = (min: number) => {
  const p = hms(min);
  const sign = min < 0 ? "−" : "+";
  return p.h ? `${sign}${p.h}h ${p.m}m` : `${sign}${p.m}m ${p.s}s`;
};

export async function makeDaylight(o: {
  lat: number;
  lon: number;
  label: string;
  tz: string;
  today: string;
  now: number;
}): Promise<Blob> {
  const t = await tokens(SUN);
  const mf = mono();
  const { c, g } = canvas();
  const { lat, lon, tz, today } = o;
  const d = sunDay(lat, lon, today);
  const y = sunDay(lat, lon, addDays(today, -1));
  const delta = d.dayMinutes - y.dayMinutes;
  const yr = Number(today.slice(0, 4));
  const year = yearDays(lat, lon, yr, tz);
  const k = keyDays(year);
  const marks = [
    { ymd: `${yr}-03-20`, label: "Spring equinox" },
    { ymd: `${yr}-06-21`, label: "Summer solstice" },
    { ymd: `${yr}-09-22`, label: "Fall equinox" },
    { ymd: `${yr}-12-21`, label: "Winter solstice" },
    { ymd: `${yr + 1}-03-20`, label: "Spring equinox" },
  ];
  const next = marks.find((m) => m.ymd > today)!;
  const daysTo = Math.round(
    (Date.parse(next.ymd) - Date.parse(today)) / 86_400_000,
  );

  backdrop(g, t, NIGHT);
  masthead(g, t, "Daylight Tracker");
  place(g, t, o.label, 48, 122, 24, SW - 96);
  g.font = `600 20px ${t.sans}`;
  g.fillStyle = t.muted;
  g.fillText(fmtD(today, true).toUpperCase(), 48, 156);

  // Today's daylight, big.
  const p = hms(d.dayMinutes);
  g.font = `800 130px ${t.disp}`;
  g.shadowColor = SUN;
  g.shadowBlur = 34;
  g.fillStyle = SUN;
  let x = 44;
  const part = (n: number, unit: string) => {
    g.font = `800 130px ${t.disp}`;
    g.fillStyle = SUN;
    g.shadowBlur = 34;
    g.fillText(String(n), x, 300);
    x += g.measureText(String(n)).width + 6;
    g.shadowBlur = 0;
    g.font = `800 44px ${t.disp}`;
    g.fillStyle = t.text;
    g.fillText(unit, x, 300);
    x += g.measureText(unit).width + 22;
  };
  part(p.h, "h");
  part(p.m, "m");
  part(p.s, "s");
  g.shadowBlur = 0;
  g.font = `700 15px ${t.sans}`;
  g.letterSpacing = "5px";
  g.fillStyle = t.muted;
  g.fillText("OF DAYLIGHT TODAY", 48, 340);
  g.letterSpacing = "0px";
  // The change since yesterday, in a lit chip.
  const gain = delta >= 0;
  const chip = `${gain ? "▲" : "▼"} ${diff(delta).replace(/^[+−]/, "")} ${gain ? "MORE" : "LESS"} THAN YESTERDAY`;
  g.font = `800 20px ${mf}`;
  const cw = g.measureText(chip).width + 40;
  const cx = SW - 48 - cw;
  const col = gain ? "#7ee2a8" : "#ff9a7a";
  g.beginPath();
  g.roundRect(cx, 312, cw, 44, 22);
  g.fillStyle = "rgba(255,255,255,0.04)";
  g.fill();
  g.strokeStyle = col;
  g.lineWidth = 1.5;
  g.shadowColor = col;
  g.shadowBlur = 14;
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = col;
  g.fillText(chip, cx + 20, 341);

  // The 24 hours: bands, the sun's arc and where it is now.
  const AX = 48;
  const AW = SW - 96;
  const BY = 560;
  const ax = (dt: Date | null, fb: number) =>
    AX + ((dt ? localMinutes(dt, tz) : fb) / 1440) * AW;
  const segs: [number, number, string][] = [
    [AX, ax(d.astroDawn, 0), BANDS[0]],
    [ax(d.astroDawn, 0), ax(d.nauticalDawn, 0), BANDS[1]],
    [ax(d.nauticalDawn, 0), ax(d.civilDawn, 0), BANDS[2]],
    [ax(d.civilDawn, 0), ax(d.rise, 0), BANDS[3]],
    [ax(d.rise, 0), ax(d.goldenEnd, 0), BANDS[4]],
    [ax(d.goldenEnd, 0), ax(d.goldenStart, 1440), BANDS[5]],
    [ax(d.goldenStart, 1440), ax(d.set, 1440), BANDS[4]],
    [ax(d.set, 1440), ax(d.civilDusk, 1440), BANDS[3]],
    [ax(d.civilDusk, 1440), ax(d.nauticalDusk, 1440), BANDS[2]],
    [ax(d.nauticalDusk, 1440), ax(d.astroDusk, 1440), BANDS[1]],
    [ax(d.astroDusk, 1440), AX + AW, BANDS[0]],
  ];
  panel(g, t, 30, 380, SW - 60, 260, 28, 0.3);
  g.save();
  g.beginPath();
  g.roundRect(AX, BY, AW, 26, 13);
  g.clip();
  for (const [a, b, cc] of segs)
    if (b > a) {
      g.fillStyle = cc;
      g.fillRect(a, BY, b - a + 1, 26);
    }
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.18)";
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(AX, BY, AW, 26, 13);
  g.stroke();
  const r0 = ax(d.rise, 0);
  const s0 = ax(d.set, 1440);
  const mid = (r0 + s0) / 2;
  const top = 400;
  const base = BY - 6;
  const sky = g.createLinearGradient(0, top, 0, base);
  sky.addColorStop(0, "rgba(255,214,107,0.32)");
  sky.addColorStop(1, "rgba(255,214,107,0)");
  g.beginPath();
  g.moveTo(r0, base);
  g.quadraticCurveTo(mid, top - (base - top) * 0.55, s0, base);
  g.closePath();
  g.fillStyle = sky;
  g.fill();
  g.beginPath();
  g.moveTo(r0, base);
  g.quadraticCurveTo(mid, top - (base - top) * 0.55, s0, base);
  g.strokeStyle = SUN;
  g.lineWidth = 3;
  g.shadowColor = SUN;
  g.shadowBlur = 16;
  g.setLineDash([2, 10]);
  g.lineCap = "round";
  g.stroke();
  g.setLineDash([]);
  g.shadowBlur = 0;
  // Now: a line through the bands, and the sun on its arc while it's up.
  const nowMin = localMinutes(new Date(o.now), tz);
  const nx = AX + (nowMin / 1440) * AW;
  g.strokeStyle = "#fff";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(nx, BY - 10);
  g.lineTo(nx, BY + 36);
  g.stroke();
  if (nx > r0 && nx < s0) {
    const u = (nx - r0) / (s0 - r0);
    const cyTop = top - (base - top) * 0.55;
    const sx = (1 - u) ** 2 * r0 + 2 * (1 - u) * u * mid + u ** 2 * s0;
    const sy = (1 - u) ** 2 * base + 2 * (1 - u) * u * cyTop + u ** 2 * base;
    const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 60);
    halo.addColorStop(0, "rgba(255,230,150,0.9)");
    halo.addColorStop(0.3, "rgba(255,200,90,0.35)");
    halo.addColorStop(1, "rgba(255,200,90,0)");
    g.fillStyle = halo;
    g.fillRect(sx - 60, sy - 60, 120, 120);
    g.fillStyle = "#fff6d8";
    g.beginPath();
    g.arc(sx, sy, 13, 0, Math.PI * 2);
    g.fill();
  }
  g.font = `700 15px ${mf}`;
  g.fillStyle = t.muted;
  ["12A", "6A", "NOON", "6P", "12A"].forEach((l, i) => {
    g.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
    g.fillText(l, AX + (i * AW) / 4, BY + 52);
  });
  g.textAlign = "left";
  // Sunrise and sunset under the arc's feet.
  g.font = `800 30px ${t.disp}`;
  g.fillStyle = t.text;
  g.fillText(fmtT(d.rise, tz), 56, 440);
  g.textAlign = "right";
  g.fillText(fmtT(d.set, tz), SW - 56, 440);
  g.font = `700 13px ${t.sans}`;
  g.letterSpacing = "3px";
  g.fillStyle = SUN;
  g.fillText("SUNSET", SW - 56, 464);
  g.textAlign = "left";
  g.fillText("SUNRISE", 56, 464);
  g.letterSpacing = "0px";

  // Six key times.
  const times: [string, Date | null][] = [
    ["FIRST LIGHT", d.civilDawn],
    ["GOLDEN HOUR ENDS", d.goldenEnd],
    ["SOLAR NOON", d.noon],
    ["GOLDEN HOUR", d.goldenStart],
    ["LAST LIGHT", d.civilDusk],
    ["FULL DARK", d.astroDusk],
  ];
  const TW = (SW - 96 - 24) / 3;
  times.forEach(([k2, v], i) => {
    const tx = 48 + (i % 3) * (TW + 12);
    const ty = 664 + Math.floor(i / 3) * 104;
    panel(g, t, tx, ty, TW, 92, 20, 0.2);
    g.font = `700 12px ${t.sans}`;
    g.letterSpacing = "2.5px";
    g.fillStyle = t.muted;
    g.fillText(k2, tx + 18, ty + 32, TW - 30);
    g.letterSpacing = "0px";
    g.font = `800 32px ${t.disp}`;
    g.fillStyle = i === 2 ? SUN : t.text;
    g.fillText(fmtT(v, tz), tx + 18, ty + 72, TW - 30);
  });

  // The days ahead.
  const ahead: [string, string][] = [
    ["TOMORROW", addDays(today, 1)],
    ["IN A WEEK", addDays(today, 7)],
    ["IN A MONTH", addDays(today, 30)],
    [next.label.toUpperCase(), next.ymd],
  ];
  // In date order (the solstice can come before "in a month").
  ahead.sort((a, b) => a[1].localeCompare(b[1]));
  const TY = 890;
  panel(g, t, 30, TY, SW - 60, 268, 28, 0.3);
  g.font = `700 13px ${t.sans}`;
  g.letterSpacing = "4px";
  g.fillStyle = SUN;
  g.fillText("THE DAYS AHEAD", 56, TY + 38);
  g.fillStyle = t.muted;
  g.textAlign = "right";
  g.fillText("DAYLIGHT · SUNSET · VS TODAY", SW - 56, TY + 38);
  g.textAlign = "left";
  g.letterSpacing = "0px";
  ahead.forEach(([name, ymd], i) => {
    const rd = sunDay(lat, lon, ymd);
    const ry = TY + 86 + i * 50;
    g.fillStyle = "rgba(255,255,255,0.06)";
    if (i) g.fillRect(56, ry - 34, SW - 112, 1);
    g.font = `800 19px ${t.sans}`;
    g.fillStyle = t.text;
    g.fillText(name, 56, ry, 300);
    const nw = Math.min(300, g.measureText(name).width);
    g.font = `600 16px ${t.sans}`;
    g.fillStyle = t.muted;
    g.fillText(fmtD(ymd).toUpperCase(), 56 + nw + 14, ry);
    g.font = `800 24px ${t.disp}`;
    g.fillStyle = t.text;
    g.textAlign = "right";
    g.fillText(len(rd.dayMinutes), 760, ry);
    g.font = `700 18px ${mf}`;
    g.fillStyle = t.muted;
    g.fillText(fmtT(rd.set, tz), 900, ry);
    const ch = rd.dayMinutes - d.dayMinutes;
    g.fillStyle = ch >= 0 ? "#7ee2a8" : "#ff9a7a";
    g.fillText(diff(ch), SW - 56, ry);
    g.textAlign = "left";
  });

  // The year's daylight curve, today lit.
  const YY = 1178;
  const YH = 110;
  const lo = Math.min(...year.map((v) => v.dayMinutes));
  const hi = Math.max(...year.map((v) => v.dayMinutes));
  const yx = (i: number) => 48 + (i / (year.length - 1)) * (SW - 96 - 300);
  const yy = (m: number) =>
    YY + 8 + (1 - (m - lo) / Math.max(1, hi - lo)) * (YH - 16);
  const curve = new Path2D();
  year.forEach((v, i) =>
    i
      ? curve.lineTo(yx(i), yy(v.dayMinutes))
      : curve.moveTo(yx(i), yy(v.dayMinutes)),
  );
  const fill = new Path2D(curve);
  fill.lineTo(yx(year.length - 1), YY + YH);
  fill.lineTo(48, YY + YH);
  fill.closePath();
  const fg = g.createLinearGradient(0, YY, 0, YY + YH);
  fg.addColorStop(0, "rgba(255,214,107,0.28)");
  fg.addColorStop(1, "rgba(255,214,107,0)");
  g.fillStyle = fg;
  g.fill(fill);
  const lg = g.createLinearGradient(48, 0, SW - 348, 0);
  lg.addColorStop(0, NIGHT);
  lg.addColorStop(0.47, SUN);
  lg.addColorStop(1, NIGHT);
  g.strokeStyle = lg;
  g.lineWidth = 4;
  g.lineJoin = "round";
  g.stroke(curve);
  const ti = Math.max(
    0,
    year.findIndex((v) => v.ymd === today),
  );
  g.fillStyle = "#fff";
  g.shadowColor = SUN;
  g.shadowBlur = 18;
  g.beginPath();
  g.arc(yx(ti), yy(year[ti].dayMinutes), 8, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  // Beside it: shortest, longest and the countdown.
  const KX = SW - 280;
  const side: [string, string][] = [
    [
      "SHORTEST",
      k.shortest
        ? `${fmtD(k.shortest.ymd)} · ${len(k.shortest.dayMinutes)}`
        : "—",
    ],
    [
      "LONGEST",
      k.longest ? `${fmtD(k.longest.ymd)} · ${len(k.longest.dayMinutes)}` : "—",
    ],
    [next.label.toUpperCase(), `IN ${daysTo} DAYS`],
  ];
  side.forEach(([k2, v], i) => {
    g.font = `700 11px ${t.sans}`;
    g.letterSpacing = "2.5px";
    g.fillStyle = t.muted;
    g.fillText(k2, KX, YY + 14 + i * 40, 240);
    g.letterSpacing = "0px";
    g.font = `800 18px ${t.sans}`;
    g.fillStyle = i === 2 ? SUN : t.text;
    g.fillText(v, KX, YY + 34 + i * 40, 240);
  });

  foot(
    g,
    t,
    "Sun times from NOAA's solar equations for this place · weather.sswx.space/daylight-tracker",
    SW,
    SH,
  );
  return png(c);
}
