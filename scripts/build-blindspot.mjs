/**
 * Radar Blind Spot (Extras engine): how high the lowest radar beam is over every spot in
 * the lower 48. For each WSR-88D (NWS API), the 0.5° beam's centre height uses the 4/3-earth
 * model: h = sqrt(r² + R² + 2rR·sin θ) − R, R = 4/3 × 6371 km, measured above the radar.
 * Writes the band of the lowest height at each pixel (Web Mercator rows, so it lays flat on
 * the map), run-length encoded, to public/extras/blindspot.bin, plus the radar list (the page
 * works out the exact height wherever it is tapped).
 *   node scripts/build-blindspot.mjs
 */
import { writeFileSync } from "node:fs";

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const r = await fetch(
  "https://api.weather.gov/radar/stations?stationType=WSR-88D",
  { headers: UA },
);
const radars = (await r.json()).features
  .map((f) => ({
    id: f.properties.id,
    lon: +f.geometry.coordinates[0].toFixed(4),
    lat: +f.geometry.coordinates[1].toFixed(4),
    elev: Math.round(f.properties.elevation?.value ?? 0),
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const W = -125,
  E = -66,
  S = 24,
  N = 50;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unmerc = (y) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;
const width = 1180;
const yTop = merc(N),
  yBot = merc(S);
const height = Math.round(
  (width * (yTop - yBot)) / (((E - W) * Math.PI) / 180),
);
const Re = (4 / 3) * 6371;
const sinT = Math.sin((0.5 * Math.PI) / 180);
const MAX_KM = 460;
/** Band edges (ft above the radar): 1 = under 2,000 … 5 = over 10,000; 0 = out of range. */
const BANDS_FT = [2000, 4000, 6000, 10000];

const out = new Uint8Array(width * height);
const rad = (d) => (d * Math.PI) / 180;
for (let j = 0; j < height; j++) {
  const lat = unmerc(yTop - ((j + 0.5) / height) * (yTop - yBot));
  const near = radars.filter((s) => Math.abs(s.lat - lat) < 4.3);
  for (let i = 0; i < width; i++) {
    const lon = W + ((i + 0.5) / width) * (E - W);
    let best = Infinity;
    for (const s of near) {
      const dlat = rad(s.lat - lat),
        dlon = rad(s.lon - lon);
      const a =
        Math.sin(dlat / 2) ** 2 +
        Math.cos(rad(lat)) * Math.cos(rad(s.lat)) * Math.sin(dlon / 2) ** 2;
      const km = 12742 * Math.asin(Math.sqrt(a));
      if (km > MAX_KM) continue;
      const h = Math.sqrt(km * km + Re * Re + 2 * km * Re * sinT) - Re;
      if (h < best) best = h;
    }
    const ft = best * 3280.84;
    out[j * width + i] =
      best === Infinity ? 0 : 1 + BANDS_FT.filter((b) => ft >= b).length;
  }
}
// Run-length encode: [value, count] byte pairs.
const runs = [];
for (let k = 0; k < out.length;) {
  let n = 1;
  while (k + n < out.length && out[k + n] === out[k] && n < 255) n++;
  runs.push(out[k], n);
  k += n;
}
writeFileSync("public/extras/blindspot.bin", Uint8Array.from(runs));
writeFileSync(
  "src/lib/engines/radars.json",
  JSON.stringify({
    bounds: [W, S, E, N],
    width,
    height,
    bandsFt: BANDS_FT,
    maxKm: MAX_KM,
    radars,
  }) + "\n",
);
console.log(
  `${radars.length} radars, ${width}×${height}, ${runs.length} bytes`,
);
