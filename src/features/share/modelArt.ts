import { MODEL_CITIES } from "@/lib/models/cities";

/**
 * A model frame drawn for sharing straight from its full-size picture (2,000-2,400 px across),
 * not read back off the screen, so it's sharp on any phone and with either map engine: the
 * field, the state and national lines over it, and the city values, as the live map draws them.
 * Web Mercator, like the frames themselves.
 */
type Lines = {
  features: {
    properties: { kind: "state" | "nation" };
    geometry: { coordinates: [number, number][][] };
  }[];
};
let lines: Promise<Lines> | null = null;
const lineWork = () =>
  (lines ??= fetch("/geo/us-lines.json").then(
    (r) => r.json() as Promise<Lines>,
  ));
const mercY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);

export async function modelMap(o: {
  /** The frame's picture and the box it covers; the view box to draw (w, s, e, n). */
  url: string;
  frame: number[];
  view: number[];
  values: (number | null)[] | null;
  width: number;
}) {
  const [img, geo] = await Promise.all([
    fetch(o.url)
      .then((r) => r.blob())
      .then((b) => createImageBitmap(b)),
    lineWork(),
  ]);
  const [w, s, e, n] = o.view;
  const W = o.width;
  const k = W / (e - w);
  const top = mercY(n);
  const H = Math.round((top - mercY(s)) * k);
  const px = (lon: number) => (lon - w) * k;
  const py = (lat: number) => (top - mercY(lat)) * k;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b0d14";
  g.fillRect(0, 0, W, H);
  g.imageSmoothingQuality = "high";
  const [fw, fs, fe, fn] = o.frame;
  g.drawImage(img, px(fw), py(fn), px(fe) - px(fw), py(fs) - py(fn));
  img.close();

  // State and national lines: a dark casing, then bright white, as on the live map.
  const u = Math.max(1, W / 900);
  g.lineJoin = "round";
  g.lineCap = "round";
  for (const [color, alpha, state, nation] of [
    ["#05060a", 0.55, 2.6, 3.2],
    ["#ffffff", 0.92, 1.1, 1.5],
  ] as const) {
    g.strokeStyle = color;
    g.globalAlpha = alpha;
    for (const f of geo.features) {
      g.lineWidth = (f.properties.kind === "nation" ? nation : state) * u;
      g.beginPath();
      for (const line of f.geometry.coordinates)
        line.forEach(([lon, lat], i) =>
          i ? g.lineTo(px(lon), py(lat)) : g.moveTo(px(lon), py(lat)),
        );
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  // City values over their names, tier 1 first, skipping any that would overlap.
  const font = getComputedStyle(document.body).fontFamily;
  const big = Math.round(16 * u);
  const small = Math.round(10.5 * u);
  const taken: number[][] = [];
  const order = MODEL_CITIES.map((x, i) => ({ x, v: o.values?.[i] ?? null }))
    .filter(({ x: [, lat, lon] }) => lon > w && lon < e && lat > s && lat < n)
    .sort((a, b) => a.x[3] - b.x[3]);
  g.textAlign = "center";
  g.lineJoin = "round";
  g.strokeStyle = "rgba(5, 6, 10, 0.85)";
  g.fillStyle = "#ffffff";
  for (const {
    x: [name, lat, lon],
    v,
  } of order) {
    const x = px(lon);
    const y = py(lat);
    g.font = `700 ${small}px ${font}`;
    const bw = Math.max(g.measureText(name).width, v == null ? 0 : big * 1.6);
    const bh = v == null ? small : big + small + 2;
    const box = [
      x - bw / 2 - 3,
      y - bh / 2 - 3,
      x + bw / 2 + 3,
      y + bh / 2 + 3,
    ];
    if (
      taken.some(
        (t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1],
      )
    )
      continue;
    taken.push(box);
    const lines: [string, number][] =
      v == null
        ? [[name, small]]
        : [
            [String(v), big],
            [name, small],
          ];
    let ty = y - bh / 2;
    for (const [t, size] of lines) {
      g.font = `800 ${size}px ${font}`;
      ty += size;
      g.lineWidth = 3.2 * u;
      g.strokeText(t, x, ty - 2);
      g.fillText(t, x, ty - 2);
      ty += 2;
    }
  }
  return c;
}
