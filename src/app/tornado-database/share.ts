/**
 * Tornado Database county card (owner's Weather list #42, item 2): the county outline lit in
 * the accent with every tornado path in its rating color, the record in three tiles, and the
 * source. Drawn on the phone when someone taps Share.
 */
import { tokens } from "@/features/share/card";
import {
  backdrop,
  canvas,
  foot,
  masthead,
  panel,
  place,
  png,
  stat,
  SW,
} from "@/features/share/studio";

export type CountyCard = {
  name: string;
  st: string;
  stateName: string;
  n: number;
  top: { r: string; m: number; day: string } | null;
  last: { r: string; m: number; day: string } | null;
  outline: number[][];
  box: number[];
  /** [start lon, start lat, end lon, end lat, rating] */
  tracks: [number, number, number, number, number][];
  /** Rating (-1 to 5) to color, from the admin's color settings. */
  colors: Record<string, string>;
  through: string;
};

export async function makeCountyCard(d: CountyCard): Promise<Blob> {
  const t = await tokens();
  const { c, g } = canvas();
  backdrop(g, t);
  masthead(g, t, "Tornado Database");
  place(g, t, `${d.name}, ${d.st}`, 48, 122, 26);
  g.font = `800 64px ${t.disp}`;
  g.fillStyle = t.text;
  g.fillText(
    `${d.n.toLocaleString("en-US")} tornado${d.n === 1 ? "" : "es"}`,
    48,
    206,
    SW - 96,
  );
  g.font = `600 22px ${t.sans}`;
  g.fillStyle = t.muted;
  g.fillText(`since 1950 in ${d.name}, ${d.stateName}`, 48, 244, SW - 96);

  // The map: county framed with room around it, true to scale at its latitude.
  const X = 48,
    Y = 280,
    W = SW - 96,
    H = 690;
  panel(g, t, X, Y, W, H, 30, 0.45);
  const [x0, y0, x1, y1] = d.box;
  const pw = (x1 - x0) * 0.2,
    ph = (y1 - y0) * 0.2;
  const bx = [x0 - pw, y0 - ph, x1 + pw, y1 + ph];
  const k = Math.cos((((bx[1] + bx[3]) / 2) * Math.PI) / 180);
  const sc = Math.min(
    (W - 60) / ((bx[2] - bx[0]) * k),
    (H - 60) / (bx[3] - bx[1]),
  );
  const at = (lon: number, lat: number): [number, number] => [
    X + W / 2 + (lon - (bx[0] + bx[2]) / 2) * k * sc,
    Y + H / 2 - (lat - (bx[1] + bx[3]) / 2) * sc,
  ];
  g.save();
  g.beginPath();
  g.roundRect(X, Y, W, H, 30);
  g.clip();
  const ring = () => {
    g.beginPath();
    for (const r of d.outline)
      for (let i = 0; i < r.length; i += 2) {
        const [px, py] = at(r[i], r[i + 1]);
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
    g.closePath();
  };
  ring();
  g.fillStyle = "rgba(255,255,255,0.045)";
  g.fill("evenodd");
  for (const [a, b, e, f, m] of [...d.tracks].sort((p, q) => p[4] - q[4])) {
    const col = d.colors[String(m)] ?? "#9aa0b8";
    const w = 3 + Math.max(0, m) * 1.6;
    const [ax, ay] = at(a, b);
    const [ex, ey] = at(e, f);
    g.strokeStyle = col;
    g.lineCap = "round";
    g.shadowColor = col;
    g.shadowBlur = 14;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(ex === ax && ey === ay ? ex + 0.1 : ex, ey);
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = col;
    g.beginPath();
    g.arc(ax, ay, w * 0.8, 0, Math.PI * 2);
    g.fill();
  }
  ring();
  g.strokeStyle = t.accent;
  g.lineWidth = 3;
  g.shadowColor = t.accent;
  g.shadowBlur = 18;
  g.stroke();
  g.restore();

  // The record.
  const tiles = [
    ["On record", d.n.toLocaleString("en-US"), "since 1950", undefined],
    [
      "Strongest",
      d.top?.r ?? "None",
      d.top?.day ?? "",
      d.top ? d.colors[String(d.top.m)] : undefined,
    ],
    [
      "Most recent",
      d.last ? d.last.day.slice(-4) : "Never",
      d.last ? `${d.last.r}, ${d.last.day.replace(/, \d{4}$/, "")}` : "",
      undefined,
    ],
  ] as const;
  const tw = (SW - 96 - 24) / 3;
  tiles.forEach(([k2, v, sub, color], i) => {
    const x = 48 + i * (tw + 12);
    panel(g, t, x, 1000, tw, 200, 24, 0.3);
    stat(g, t, k2, v, x + 24, 1044, { color, size: 54, max: tw - 48, sub });
  });
  foot(
    g,
    t,
    `NOAA Storm Prediction Center tornado record, 1950 to ${d.through} · weather.sswx.space/tornado-database`,
  );
  return png(c);
}
