import { unproject } from "@/lib/map/usAlbers";

/**
 * Paints a lat/lon lattice of scores (0–100) onto the national canvas (975×610, Albers):
 * every third pixel is unprojected, sampled bilinearly from the lattice, and colored on a
 * continuous ramp, so the map reads as a smooth field rather than blocks. Returns a PNG
 * data URL for an <image> under the map's land clip.
 */
const W = 975;
const H = 610;
const STEP = 3;

const hex = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function rasterize(
  lats: number[],
  lons: number[],
  value: (iLat: number, iLon: number) => number | null,
  stops: { at: number; color: string }[],
): string | null {
  if (typeof document === "undefined") return null;
  const w = Math.ceil(W / STEP);
  const h = Math.ceil(H / STEP);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const ramp = stops.map((s) => ({ at: s.at, rgb: hex(s.color) }));
  const color = (v: number) => {
    let i = 1;
    while (i < ramp.length - 1 && v > ramp[i].at) i++;
    const a = ramp[i - 1];
    const b = ramp[i];
    const f = Math.max(0, Math.min(1, (v - a.at) / (b.at - a.at || 1)));
    return a.rgb.map((x, k) => Math.round(x + (b.rgb[k] - x) * f));
  };
  const lat0 = lats[0];
  const dLat = lats[1] - lats[0];
  const lon0 = lons[0];
  const dLon = lons[1] - lons[0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { lat, lon } = unproject(x * STEP + STEP / 2, y * STEP + STEP / 2);
      const fy = (lat - lat0) / dLat;
      const fx = (lon - lon0) / dLon;
      if (fy < 0 || fx < 0 || fy > lats.length - 1 || fx > lons.length - 1)
        continue;
      const i = Math.min(lats.length - 2, Math.floor(fy));
      const j = Math.min(lons.length - 2, Math.floor(fx));
      const ty = fy - i;
      const tx = fx - j;
      const q = [
        value(i, j),
        value(i, j + 1),
        value(i + 1, j),
        value(i + 1, j + 1),
      ];
      const wts = [(1 - ty) * (1 - tx), (1 - ty) * tx, ty * (1 - tx), ty * tx];
      let sum = 0;
      let wsum = 0;
      q.forEach((v, k) => {
        if (v != null) {
          sum += v * wts[k];
          wsum += wts[k];
        }
      });
      if (wsum < 0.25) continue;
      const [r, g, b] = color(sum / wsum);
      const o = (y * w + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 190;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}
