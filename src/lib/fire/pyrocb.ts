import "server-only";

/**
 * Wildfire & PyroCb upgrades (post-launch A6):
 *  - Fire power from satellite: NASA FIRMS active-fire detections (VIIRS on NOAA-20, NOAA-21
 *    and Suomi NPP, and MODIS) for the last 24 hours, each with its fire radiative power (FRP).
 *  - PyroCb Firepower Threshold (Tory and Kepert 2021): how much fire heat the atmosphere over a
 *    fire needs before the smoke plume can reach free convection and build a pyroCb, from a
 *    model sounding (HRRR, then GFS, through Open-Meteo).
 * All free; each part fails soft.
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const FIRMS = "https://firms.modaps.eosdis.nasa.gov/data/active_fire";
const FEEDS = [
  "noaa-20-viirs-c2/csv/J1_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv",
  "noaa-21-viirs-c2/csv/J2_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv",
  "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv",
  "modis-c6.1/csv/MODIS_C6_1_USA_contiguous_and_Hawaii_24h.csv",
];

type Hot = { lat: number; lon: number; frp: number; at: number; sat: string };

async function feed(path: string): Promise<Hot[]> {
  const r = await fetch(`${FIRMS}/${path}`, {
    headers: UA,
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return [];
  const [head, ...rows] = (await r.text()).trim().split("\n");
  const c = head.split(",");
  const [la, lo, fr, d, t, s] = [
    "latitude",
    "longitude",
    "frp",
    "acq_date",
    "acq_time",
    "satellite",
  ].map((k) => c.indexOf(k));
  const out: Hot[] = [];
  for (const row of rows) {
    const v = row.split(",");
    const frp = Number(v[fr]);
    const hhmm = v[t].padStart(4, "0");
    const at = Date.parse(`${v[d]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`);
    if (Number.isFinite(frp) && Number.isFinite(at))
      out.push({ lat: +v[la], lon: +v[lo], frp, at, sat: v[s] });
  }
  return out;
}

/** Every satellite fire detection over the U.S. in the last 24 hours. */
export async function hotspots(): Promise<Hot[]> {
  const got = await Promise.all(FEEDS.map((f) => feed(f).catch(() => [])));
  return got.flat();
}

export type FirePower = {
  /** Total FRP of the newest pass over the fire (MW) and when it was seen. */
  nowMw: number;
  at: number;
  sat: string;
  /** The strongest pass in the last 24 hours (MW). */
  peakMw: number;
};

const km = (a: number, b: number, c: number, d: number) =>
  111.2 * Math.hypot(a - c, (b - d) * Math.cos((a * Math.PI) / 180));

/** The fire radiative power over one fire: detections within its size plus 3 km, by pass. */
export function powerNear(hot: Hot[], lat: number, lon: number, acres: number) {
  const reach = Math.sqrt((acres * 4047) / Math.PI) / 1000 + 3;
  const passes = new Map<string, { mw: number; at: number; sat: string }>();
  for (const h of hot) {
    if (Math.abs(h.lat - lat) > 1 || km(lat, lon, h.lat, h.lon) > reach)
      continue;
    // One overpass: same satellite within 10 minutes.
    const k = `${h.sat}:${Math.round(h.at / 600_000)}`;
    const p = passes.get(k) ?? { mw: 0, at: h.at, sat: h.sat };
    p.mw += h.frp;
    passes.set(k, p);
  }
  if (!passes.size) return null;
  const list = [...passes.values()];
  const now = list.reduce((a, b) => (b.at > a.at ? b : a));
  return {
    nowMw: Math.round(now.mw),
    at: now.at,
    sat: now.sat,
    peakMw: Math.round(Math.max(...list.map((p) => p.mw))),
  } satisfies FirePower;
}

/* ── PyroCb Firepower Threshold ─────────────────────────────────────────── */

const LEVELS = [
  1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400,
  350, 300,
] as const;
const Rd = 287.04;
const cp = 1005.7;
const Lv = 2.501e6;
const es = (tc: number) => 6.112 * Math.exp((17.67 * tc) / (tc + 243.5));
const mix = (e: number, p: number) => (0.622 * e) / Math.max(p - e, 1e-3);

/** Temperature (K) of a saturated parcel lifted from (T, p) to p2 on the moist adiabat. */
function moist(t: number, p: number, p2: number) {
  let tt = t;
  for (let pp = p; pp > p2; pp -= 5) {
    const rs = mix(es(tt - 273.15), pp);
    const dtdp =
      ((Rd * tt) / (cp * pp)) *
      ((1 + (Lv * rs) / (Rd * tt)) /
        (1 + (Lv * Lv * rs * 0.622) / (cp * Rd * tt * tt)));
    tt -= dtdp * Math.min(5, pp - p2);
  }
  return tt;
}

type Sounding = {
  p: number[];
  z: number[];
  t: number[];
  q: number[];
  w: number[];
  ps: number;
  zs: number;
};

/**
 * Tory and Kepert's PFT for one sounding (GW): for each plume temperature excess Δθ the plume
 * (mixed-layer air plus fire heat, and fire moisture at 0.04 g/kg per K) rises dry to its
 * condensation level and must still be buoyant there; z_fc is that height above the ground and
 * U the mean wind below it. PFT ≈ 0.3 · z_fc² · U · Δθ (km, m/s, K), the lowest over Δθ.
 */
export function pft(
  s: Sounding,
): { gw: number; zKm: number; dTheta: number } | null {
  const ok = s.p.map((p) => p <= s.ps - 10);
  const idx = s.p.map((_, i) => i).filter((i) => ok[i]);
  if (idx.length < 6) return null;
  // Mixed layer: the lowest 50 hPa above the ground.
  const ml = idx.filter((i) => s.p[i] >= s.ps - 60);
  const use = ml.length ? ml : [idx[0]];
  const th = (i: number) => s.t[i] * (1000 / s.p[i]) ** 0.2857;
  const thMl = use.reduce((a, i) => a + th(i), 0) / use.length;
  const qMl = use.reduce((a, i) => a + s.q[i], 0) / use.length;
  let best: { gw: number; zKm: number; dTheta: number } | null = null;
  for (let d = 0.25; d <= 15; d += 0.25) {
    const thP = thMl + d;
    const qP = qMl + 0.04e-3 * d;
    let buoyant = true;
    let zKm = NaN;
    let pLcl = NaN;
    for (const i of idx) {
      const tP = thP * (s.p[i] / 1000) ** 0.2857;
      const sat = mix(es(tP - 273.15), s.p[i]) <= qP;
      const tvP = tP * (1 + 0.61 * qP);
      const tvE = s.t[i] * (1 + 0.61 * s.q[i]);
      if (sat) {
        pLcl = s.p[i];
        zKm = (s.z[i] - s.zs) / 1000;
        // Free convection: just above condensation the saturated plume is still warmer.
        const j = idx[idx.indexOf(i) + 1];
        if (j !== undefined) {
          const tUp = moist(tP, s.p[i], s.p[j]);
          const rs = mix(es(tUp - 273.15), s.p[j]);
          if (tUp * (1 + 0.61 * rs) < s.t[j] * (1 + 0.61 * s.q[j]))
            buoyant = false;
        }
        break;
      }
      if (tvP < tvE) {
        buoyant = false;
        break;
      }
    }
    if (!buoyant || !Number.isFinite(pLcl) || !(zKm > 0.2)) continue;
    const below = idx.filter((i) => s.p[i] >= pLcl);
    const u = below.reduce((a, i) => a + s.w[i], 0) / Math.max(1, below.length);
    const gw = 0.3 * zKm * zKm * Math.max(u, 1) * d;
    if (!best || gw < best.gw)
      best = { gw: Math.round(gw), zKm: Math.round(zKm * 10) / 10, dTheta: d };
  }
  return best;
}

/** PFT at many fires at one time (ms), from a single Open-Meteo request. */
export async function pftAt(
  spots: { lat: number; lon: number }[],
  at: number,
): Promise<({ gw: number; zKm: number; dTheta: number } | null)[]> {
  if (!spots.length) return [];
  const vars = LEVELS.flatMap((l) => [
    `temperature_${l}hPa`,
    `dew_point_${l}hPa`,
    `geopotential_height_${l}hPa`,
    `wind_speed_${l}hPa`,
  ]);
  const hour = new Date(at).toISOString().slice(0, 13) + ":00";
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${spots.map((s) => s.lat.toFixed(3)).join(",")}&longitude=${spots.map((s) => s.lon.toFixed(3)).join(",")}&hourly=${[...vars, "surface_pressure"].join(",")}&models=gfs_seamless&wind_speed_unit=ms&timezone=GMT&start_hour=${hour}&end_hour=${hour}`,
    {
      headers: UA,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!r.ok) throw new Error(`open-meteo ${r.status}`);
  const j = await r.json();
  const list: {
    hourly: Record<string, (number | null)[]>;
    elevation: number;
  }[] = Array.isArray(j) ? j : [j];
  return list.map((x) => {
    const h = x.hourly;
    const g = (k: string) => h[k]?.[0];
    const rows = LEVELS.map((l) => ({
      p: l,
      t: g(`temperature_${l}hPa`),
      td: g(`dew_point_${l}hPa`),
      z: g(`geopotential_height_${l}hPa`),
      w: g(`wind_speed_${l}hPa`),
    })).filter(
      (
        v,
      ): v is {
        p: (typeof LEVELS)[number];
        t: number;
        td: number;
        z: number;
        w: number;
      } => v.t != null && v.td != null && v.z != null && v.w != null,
    );
    const ps = g("surface_pressure");
    if (ps == null || rows.length < 6) return null;
    return pft({
      p: rows.map((v) => v.p),
      t: rows.map((v) => v.t + 273.15),
      q: rows.map((v) => mix(es(v.td), v.p)),
      z: rows.map((v) => v.z),
      w: rows.map((v) => v.w),
      ps,
      zs: Number.isFinite(x.elevation) ? x.elevation : 0,
    });
  });
}
