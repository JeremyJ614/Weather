import "server-only";
import { decodePng } from "@/lib/lightning/png";

/**
 * Lightning climatology from NASA's LIS (TRMM, 1998–2013, 0.1°) as served by GIBS: we fetch
 * the zoom-6 tile over a place and read the pixel back to flashes/km²/year with GIBS's
 * published colormap. Monthly values come from the monthly climatology layer.
 */
const GIBS = "https://gibs.earthdata.nasa.gov";
export const LIS_FULL =
  "LIS_Very_High_Resolution_Lightning_Full_Climatology_LIS_Mean_Flash_Rate";
export const LIS_MONTH =
  "LIS_Very_High_Resolution_Lightning_Monthly_Climatology_LIS_Mean_Flash_Rate";
const Z = 6;

const maps = new Map<string, Promise<Map<string, number>>>();
function colormap(layer: string) {
  if (!maps.has(layer))
    maps.set(
      layer,
      fetch(`${GIBS}/colormaps/v1.3/${layer}.xml`, {
        next: { revalidate: 2592000 },
        signal: AbortSignal.timeout(20000),
      })
        .then((r) => r.text())
        .then((x) => {
          const m = new Map<string, number>();
          for (const e of x.matchAll(
            /<ColorMapEntry rgb="([\d,]+)"[^>]*?value="\[([\d.]+),([\d.]+)\)"/g,
          ))
            m.set(e[1], (Number(e[2]) + Number(e[3])) / 2);
          for (const e of x.matchAll(
            /<ColorMapEntry rgb="([\d,]+)"[^>]*?value="\[([\d.]+),\+?INF\)?"?/gi,
          ))
            if (!m.has(e[1])) m.set(e[1], Number(e[2]));
          return m;
        }),
    );
  return maps.get(layer)!;
}

/** Exact colormap hit, else the nearest entry (tiles can be resampled); 0 for no data. */
function valueOf(cm: Map<string, number>, r: number, g: number, b: number) {
  const hit = cm.get(`${r},${g},${b}`);
  if (hit != null) return hit;
  if (r + g + b === 0) return 0;
  let best = 0;
  let bd = 900;
  for (const [k, v] of cm) {
    const [cr, cg, cb] = k.split(",").map(Number);
    const d = (cr - r) ** 2 + (cg - g) ** 2 + (cb - b) ** 2;
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

async function sample(layer: string, time: string, lat: number, lon: number) {
  const n = 2 ** Z;
  const xf = ((lon + 180) / 360) * n;
  const yf =
    ((1 -
      Math.log(
        Math.tan(lat * (Math.PI / 180)) + 1 / Math.cos(lat * (Math.PI / 180)),
      ) /
        Math.PI) /
      2) *
    n;
  const tx = Math.floor(xf);
  const ty = Math.floor(yf);
  const r = await fetch(
    `${GIBS}/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level6/${Z}/${ty}/${tx}.png`,
    { next: { revalidate: 2592000 }, signal: AbortSignal.timeout(20000) },
  );
  if (!r.ok) throw new Error(`GIBS ${r.status}`);
  const [cm, png] = await Promise.all([colormap(layer), r.arrayBuffer()]);
  const { w, rgba } = decodePng(Buffer.from(png));
  const px = Math.min(255, Math.floor((xf - tx) * 256));
  const py = Math.min(255, Math.floor((yf - ty) * 256));
  // Average the 3×3 around the point so one odd pixel can't decide it.
  const vals: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = Math.max(0, Math.min(255, px + dx));
      const y = Math.max(0, Math.min(255, py + dy));
      const i = (y * w + x) * 4;
      vals.push(valueOf(cm, rgba[i], rgba[i + 1], rgba[i + 2]));
    }
  return (
    Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000
  );
}

/** Flashes per km² per year at a place, and each calendar month's rate (per km² per day). */
export async function lightningAt(lat: number, lon: number) {
  const months = Array.from(
    { length: 12 },
    (_, i) => `2013-${String(i + 1).padStart(2, "0")}-01`,
  );
  const [annual, ...monthly] = await Promise.all([
    sample(LIS_FULL, "1998-01-01", lat, lon),
    ...months.map((t) => sample(LIS_MONTH, t, lat, lon).catch(() => null)),
  ]);
  return { annual, monthly };
}
