/**
 * Radar Blind Spot (Extras engine): how high the lowest radar beam that gets through is over
 * every spot in the lower 48, above the ground there. Post-launch A6 upgrades:
 *  - Terrain blocking: every radar's beams are traced outward over elevation data (AWS
 *    Terrain Tiles, from USGS NED/SRTM, ~2 km) with the 4/3-earth model; where the ground rises
 *    above a tilt's centre line, that tilt is blocked from there on and the next tilt up is used.
 *  - More radars: the 159 WSR-88Ds, the 45 FAA TDWRs (airport radars, Doppler to 90 km) and the
 *    Canadian S-band network (ECCC's site list).
 *  - Lowest real tilt: each U.S. site's newest lowest-tilt product (NOAA Level III on AWS)
 *    gives the angle it really scans at; Canadian sites use 0.4° (ECCC's lowest PPI).
 * Writes public/extras/blindspot.bin (gzip of four layers: best height in 250 ft steps above
 * ground (255 = none; each stored as the difference from the pixel before), its radar, the runner-up height and radar, so the page can show what is
 * lost when a radar is down) and public/extras/blindspot.json (grid and radar list).
 *   node scripts/build-blindspot.mjs
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import sharp from "sharp";

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const json = async (u) => (await fetch(u, { headers: UA })).json();

/* ── Radars ─────────────────────────────────────────────────────────────── */
const nws = async (type, kind, maxKm, tower) =>
  (await json(`https://api.weather.gov/radar/stations?stationType=${type}`)).features
    .filter((f) => f.geometry)
    .map((f) => ({
      id: f.properties.id,
      kind,
      lon: +f.geometry.coordinates[0].toFixed(4),
      lat: +f.geometry.coordinates[1].toFixed(4),
      elev: Math.round((f.properties.elevation?.value ?? 0) + tower),
      maxKm,
    }));
// ECCC, "Every radar has a story" (site list, 2026); the CARE test radar is left out.
const CANADA = [
  ["CASRA", 52.52048, -107.44269, 532], ["CASBV", 45.70628, -73.85892, 71],
  ["CASFW", 50.548748, -101.08563, 553], ["CASRF", 49.28126, -81.79385, 245],
  ["CASSR", 55.694942, -119.230432, 1016], ["CASET", 43.372425, -81.380698, 304],
  ["CASBE", 50.571232, -105.182848, 587], ["CASMB", 45.949718, -60.205246, 103],
  ["CASCM", 46.222378, -65.699294, 101], ["CASLA", 48.551355, -77.808086, 394],
  ["CASMR", 47.247807, -84.596686, 527], ["CASSM", 51.20613, -113.399366, 970],
  ["CASSU", 50.312503, -110.195362, 864], ["CASDR", 49.858047, -92.797566, 411],
  ["CASHR", 47.326604, -53.12667, 293], ["CASSF", 46.449476, -71.913832, 106],
  ["CASWL", 50.153001, -97.780482, 274], ["CASVD", 48.480468, -67.601036, 714],
  ["CASKR", 43.96366, -79.572884, 359], ["CASFT", 45.041147, -76.116384, 146],
  ["CASGO", 45.098183, -63.704942, 214], ["CASBI", 45.793091, -80.534137, 190],
  ["CASAG", 49.016441, -122.487357, 93], ["CASCL", 54.378884, -110.061378, 634],
  ["CASCV", 53.560612, -114.144469, 783], ["CASMM", 48.930228, -57.834579, 542],
  ["CASSS", 50.369109, -119.064196, 1885], ["CASMA", 47.977908, -71.430833, 887],
  ["CASFM", 56.375628, -111.21515, 756], ["CASPG", 53.61539, -122.95469, 1114],
  ["CASSN", 48.596001, -89.100038, 506], ["CASHP", 49.527035, -123.853712, 572],
].map(([id, lat, lon, elev]) => ({ id, kind: "CA", lat, lon, elev, maxKm: 460, low: 0.4 }));

const radars = [
  ...(await nws("WSR-88D", "NEXRAD", 460, 20)),
  ...(await nws("TDWR", "TDWR", 90, 15)),
  ...CANADA,
].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));

/** The angle of a site's newest lowest-tilt Level III product (halfword 30, tenths of a degree). */
async function lowestTilt(r) {
  const site = r.id.slice(1);
  const prod = r.kind === "TDWR" ? "TZ0" : "N0B";
  for (let back = 0; back < 3; back++) {
    const d = new Date(Date.now() - back * 3600_000);
    const p = `${site}_${prod}_${d.toISOString().slice(0, 13).replace(/[-T]/g, "_")}`;
    const list = await (
      await fetch(`https://unidata-nexrad-level3.s3.amazonaws.com/?list-type=2&prefix=${p}`)
    ).text();
    const keys = [...list.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
    if (!keys.length) continue;
    const buf = Buffer.from(
      await (
        await fetch(`https://unidata-nexrad-level3.s3.amazonaws.com/${keys.at(-1)}`)
      ).arrayBuffer(),
    );
    // The message starts after the WMO heading and the AWIPS ID line (two CR CR LF).
    let at = buf.indexOf("\r\r\n");
    at = buf.indexOf("\r\r\n", at + 3) + 3;
    if (buf.readInt16BE(at + 18) !== -1) return null;
    const tenths = buf.readInt16BE(at + 58);
    return tenths > -10 && tenths < 20 ? tenths / 10 : null;
  }
  return null;
}
for (let k = 0; k < radars.length; k += 12)
  await Promise.all(
    radars.slice(k, k + 12).map(async (r) => {
      if (r.kind === "CA") return;
      r.low = (await lowestTilt(r).catch(() => null)) ?? 0.5;
    }),
  );

/* ── Terrain (AWS Terrain Tiles, terrarium encoding, zoom 6) ───────────── */
const Z = 6;
const tiles = new Map();
const tx = (lon) => ((lon + 180) / 360) * 2 ** Z;
const ty = (lat) =>
  ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
  2 ** Z;
for (let x = Math.floor(tx(-131)); x <= Math.floor(tx(-59)); x++)
  for (let y = Math.floor(ty(58)); y <= Math.floor(ty(19)); y++) {
    const png = Buffer.from(
      await (
        await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`)
      ).arrayBuffer(),
    );
    tiles.set(`${x},${y}`, (await sharp(png).raw().toBuffer({ resolveWithObject: true })).data);
  }
/** Ground height (m above sea level; water reads as 0). */
function ground(lat, lon) {
  const fx = tx(lon);
  const fy = ty(lat);
  const t = tiles.get(`${Math.floor(fx)},${Math.floor(fy)}`);
  if (!t) return 0;
  const px = Math.min(255, Math.floor((fx % 1) * 256));
  const py = Math.min(255, Math.floor((fy % 1) * 256));
  const ch = t.length / 65536;
  const i = (py * 256 + px) * ch;
  return Math.max(0, t[i] * 256 + t[i + 1] + t[i + 2] / 256 - 32768);
}

/* ── Beams ──────────────────────────────────────────────────────────────── */
const Re = (4 / 3) * 6371000;
const rad = (d) => (d * Math.PI) / 180;
/** Beam-centre height above sea level at range r (m) for tilt t (degrees). */
const beamMsl = (r, t, h0) =>
  Math.sqrt(r * r + Re * Re + 2 * r * Re * Math.sin(rad(t))) - Re + h0;
const TILTS = { NEXRAD: [0.9, 1.3, 1.8, 2.4, 3.1, 4.0], TDWR: [1.0, 1.6, 2.5, 3.5], CA: [0.8, 1.5, 2.4, 3.5] };
const AZ = 1440;
const STEP = 1000;

/** For one radar: the index of the lowest clear tilt along each ray at each km (255 = none). */
function rays(r) {
  const tilts = [r.low, ...TILTS[r.kind].filter((t) => t > r.low + 0.2)];
  const n = Math.round((r.maxKm * 1000) / STEP);
  const out = new Uint8Array(AZ * n).fill(255);
  const cosLat = Math.cos(rad(r.lat));
  for (let a = 0; a < AZ; a++) {
    const az = rad((a * 360) / AZ);
    const dy = Math.cos(az) / 111320;
    const dx = Math.sin(az) / (111320 * cosLat);
    let block = -90;
    for (let k = 1; k <= n; k++) {
      const d = k * STEP;
      const g = ground(r.lat + dy * d, r.lon + dx * d);
      // The terrain's elevation angle from the antenna on the 4/3 earth.
      const ang = (Math.atan((g - r.elev) / d - d / (2 * Re)) * 180) / Math.PI;
      if (ang > block) block = ang;
      let t = 0;
      while (t < tilts.length && tilts[t] <= block) t++;
      out[a * n + k - 1] = t < tilts.length ? t : 255;
    }
  }
  return { tilts, n, out };
}

/* ── Grid (Web Mercator rows, so it lays flat on the map) ──────────────── */
const W = -125, E = -66, S = 24, N = 50;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unmerc = (y) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;
const width = 1180;
const yTop = merc(N), yBot = merc(S);
const height = Math.round((width * (yTop - yBot)) / (((E - W) * Math.PI) / 180));
const latOf = (j) => unmerc(yTop - ((j + 0.5) / height) * (yTop - yBot));
const lonOf = (i) => W + ((i + 0.5) / width) * (E - W);
const gnd = new Float32Array(width * height);
for (let j = 0; j < height; j++)
  for (let i = 0; i < width; i++) gnd[j * width + i] = ground(latOf(j), lonOf(i));

const NONE = 255;
const h1 = new Float32Array(width * height).fill(Infinity);
const h2 = new Float32Array(width * height).fill(Infinity);
const r1 = new Uint8Array(width * height).fill(NONE);
const r2 = new Uint8Array(width * height).fill(NONE);
radars.forEach((r, ri) => {
  const { tilts, n, out } = rays(r);
  const span = r.maxKm / 111;
  for (let j = 0; j < height; j++) {
    const lat = latOf(j);
    if (Math.abs(lat - r.lat) > span) continue;
    const cl = Math.cos(rad(lat));
    for (let i = 0; i < width; i++) {
      const lon = lonOf(i);
      const dyM = (lat - r.lat) * 111320;
      const dxM = (lon - r.lon) * 111320 * cl;
      const d = Math.hypot(dxM, dyM);
      if (d > r.maxKm * 1000 || d < STEP) continue;
      const a = Math.round(((Math.atan2(dxM, dyM) * 180) / Math.PI + 360) % 360 * (AZ / 360)) % AZ;
      const t = out[a * n + Math.min(n, Math.round(d / STEP)) - 1];
      if (t === 255) continue;
      const k = j * width + i;
      const agl = Math.max(0, beamMsl(d, tilts[t], r.elev) - gnd[k]) * 3.28084;
      if (agl < h1[k]) {
        h2[k] = h1[k];
        r2[k] = r1[k];
        h1[k] = agl;
        r1[k] = ri;
      } else if (agl < h2[k]) {
        h2[k] = agl;
        r2[k] = ri;
      }
    }
  }
});
const q = (h) => (h === Infinity ? NONE : Math.min(254, Math.round(h / 250)));
/** Heights are stored as byte differences from the pixel before (they change smoothly). */
const layer = (f) => {
  const out = new Uint8Array(f.length);
  let prev = 0;
  f.forEach((h, k) => {
    const v = q(h);
    out[k] = (v - prev) & 255;
    prev = v;
  });
  return out;
};
const body = gzipSync(
  Buffer.concat([layer(h1), r1, layer(h2), r2].map((b) => Buffer.from(b))),
  { level: 9 },
);
writeFileSync("public/extras/blindspot.bin", body);
writeFileSync(
  "public/extras/blindspot.json",
  JSON.stringify({
    bounds: [W, S, E, N],
    width,
    height,
    stepFt: 250,
    bandsFt: [2000, 4000, 6000, 10000],
    radars: radars.map(({ id, kind, lat, lon, elev, low, maxKm }) => ({
      id, kind, lat, lon, elev, low, maxKm,
    })),
  }) + "\n",
);
const lows = radars.filter((r) => r.kind !== "CA" && r.low < 0.5).map((r) => `${r.id} ${r.low}°`);
console.log(`${radars.length} radars (${lows.length} below 0.5°: ${lows.join(", ")}), ${width}×${height}, ${body.length} bytes`);
