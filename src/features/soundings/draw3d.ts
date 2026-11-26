import type { Analysis, Parcel } from "@/lib/soundings/thermo";
import { SND_BANDS } from "@/lib/soundings/style";

export const TOP = 12000;

export type Scene3D = {
  a: Analysis;
  parcel: Parcel;
  c: (k: string) => string;
};

/**
 * Draws the 3D sounding into a w×h box (CSS px; the caller sets any scale): floor rings and
 * compass, the hodograph's shadow, the height axis with the cap (CIN, blue) and CAPE (red)
 * layers, cloud base, storm motion, the wind arrows and the hodograph through their tips.
 * Shared by the page (it turns) and the share cards (a fixed view). `fs` scales the labels,
 * `lw` the line widths; `glow` lights the traces for the share cards.
 */
export function draw3d(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: Scene3D,
  view: { yaw: number; tilt: number },
  o: {
    fs?: number;
    lw?: number;
    glow?: boolean;
    zoom?: number;
    /** A fixed ring size (kt), so a played run keeps one scale. */
    ring?: number;
  } = {},
) {
  const fs = o.fs ?? 1;
  const lw = o.lw ?? 1;
  const glow = !!o.glow;

  const { a, parcel, c } = scene;
  const wind = a.wind.filter((p) => p.z <= TOP);
  const ring =
    o.ring ??
    Math.max(
      40,
      Math.ceil(Math.max(0, ...wind.map((p) => Math.hypot(p.u, p.v))) / 20) *
        20,
    );
  const { yaw, tilt } = view;
  const s = Math.min(w * 0.4, h * 0.3) * (o.zoom ?? 1);
  const cx = w / 2;
  const colH = 1.8 * s * Math.cos(tilt);
  const cy = h * 0.5 + (colH - s * Math.sin(tilt)) / 2;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  // u east, v north, z up → screen. Orthographic, camera tilted down by `tilt`.
  const P = (u: number, v: number, z: number): [number, number] => {
    const x = (u / ring) * cosY - (v / ring) * sinY;
    const d = (u / ring) * sinY + (v / ring) * cosY;
    return [cx + x * s, cy - (z / TOP) * colH - d * s * Math.sin(tilt)];
  };
  const band = (z: number) =>
    SND_BANDS.find((b) => z <= b.top) ?? SND_BANDS[SND_BANDS.length - 1];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.font = `600 ${10 * fs}px system-ui, sans-serif`;

  // Floor rings and compass.
  ctx.strokeStyle = "rgba(148,163,184,0.25)";
  ctx.lineWidth = 1;
  for (let r = 20; r <= ring; r += 20) {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      const [x, y] = P(Math.cos(t) * r, Math.sin(t) * r, 0);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(148,163,184,0.75)";
  ctx.textAlign = "center";
  for (const [l, u, v] of [
    ["N", 0, 1],
    ["E", 1, 0],
    ["S", 0, -1],
    ["W", -1, 0],
  ] as const) {
    const [x, y] = P(u * ring * 1.12, v * ring * 1.12, 0);
    ctx.fillText(l, x, y + 3);
  }

  // Hodograph shadow on the floor.
  ctx.strokeStyle = "rgba(148,163,184,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  wind.forEach((p, i) => {
    const [x, y] = P(p.u, p.v, 0);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.stroke();

  // Height axis with km ticks.
  const [ax0, ay0] = P(0, 0, 0);
  const [ax1, ay1] = P(0, 0, TOP);
  ctx.strokeStyle = "rgba(226,232,240,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax0, ay0);
  ctx.lineTo(ax1, ay1);
  ctx.stroke();
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(226,232,240,0.7)";
  for (let z = 0; z <= TOP; z += 3000) {
    const [x, y] = P(0, 0, z);
    ctx.fillRect(x - 3, y - 0.5, 6, 1);
    ctx.fillText(`${z / 1000} km`, x - 6, y + 3);
  }

  // The cap (surface → LFC) as a blue bar, the CAPE layer (LFC → EL) red, both glowing on
  // the axis; cloud base as a ring.
  if (parcel.cin < -5 && parcel.lfcM != null) {
    const [x0, y0] = P(0, 0, 0);
    const [x1, y1] = P(0, 0, Math.min(TOP, parcel.lfcM));
    ctx.strokeStyle = c("cin");
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 7 * lw;
    if (glow) {
      ctx.shadowColor = c("cin");
      ctx.shadowBlur = 12 * lw;
    }
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = c("cin");
    ctx.textAlign = "left";
    ctx.fillText(`CIN ${parcel.cin}`, x1 + 8 * lw, (y0 + y1) / 2 + 3);
  }
  if (parcel.cape > 10 && parcel.lfcM != null && parcel.elM != null) {
    const [x0, y0] = P(0, 0, Math.min(TOP, parcel.lfcM));
    const [x1, y1] = P(0, 0, Math.min(TOP, parcel.elM));
    ctx.strokeStyle = c("cape");
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 7 * lw;
    if (glow) {
      ctx.shadowColor = c("cape");
      ctx.shadowBlur = 14 * lw;
    }
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = c("cape");
    ctx.textAlign = "left";
    ctx.fillText(`CAPE ${parcel.cape}`, x1 + 8, y1 + 3);
  }
  if (parcel.lclM < TOP) {
    ctx.strokeStyle = c("parcel");
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const [x, y] = P(
        Math.cos(t) * ring * 0.18,
        Math.sin(t) * ring * 0.18,
        parcel.lclM,
      );
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const [x, y] = P(-ring * 0.2, 0, parcel.lclM);
    ctx.fillStyle = c("parcel");
    ctx.textAlign = "right";
    ctx.fillText("cloud base", x - 4, y - 4);
  }

  // Storm motion: a post from the floor.
  if (a.rm) {
    const [x0, y0] = P(a.rm.u, a.rm.v, 0);
    const [x1, y1] = P(a.rm.u, a.rm.v, 2500);
    ctx.strokeStyle = c("storm");
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x0, y0, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = c("storm");
    ctx.textAlign = "left";
    ctx.fillText("storm", x1 + 4, y1);
  }

  // Wind arrows every 500 m, back to front, then the hodograph through their tips.
  const arrows = wind.filter((p) => p.z % 500 === 0);
  for (const p of arrows) {
    const [x0, y0] = P(0, 0, p.z);
    const [x1, y1] = P(p.u, p.v, p.z);
    ctx.strokeStyle = c(band(p.z).key);
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3 * lw;
  if (glow) ctx.shadowBlur = 10 * lw;
  for (let i = 1; i < wind.length; i++) {
    const [x0, y0] = P(wind[i - 1].u, wind[i - 1].v, wind[i - 1].z);
    const [x1, y1] = P(wind[i].u, wind[i].v, wind[i].z);
    ctx.strokeStyle = c(band(wind[i].z).key);
    if (glow) ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}
