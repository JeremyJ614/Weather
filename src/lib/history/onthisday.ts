import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";

/**
 * On This Day in Weather History: what NOAA's own records hold for one calendar date. Every
 * tornado SPC has on file since 1950 and every Atlantic and East Pacific hurricane or
 * tropical storm landfall in NHC's best tracks, reduced to a small summary that is stored
 * per date (`history_days`), so the big source files are read once a year per date.
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const SPC = (y: number) =>
  `https://www.spc.noaa.gov/wcm/data/1950-${y}_actual_tornadoes.csv`;
const NHC = "https://www.nhc.noaa.gov/data/hurdat/";

export type OtdTornado = {
  year: number;
  /** "EF4", "F5" (the Fujita scale before 2007), or "EFU". */
  rating: string;
  /** 0–5, or -1 unrated. */
  mag: number;
  st: string;
  deaths: number;
  hurt: number;
  miles: number;
  yards: number;
  /** Start and end, [lon, lat]. */
  a: [number, number];
  b: [number, number] | null;
  near: string;
};

export type OtdLandfall = {
  year: number;
  name: string;
  basin: "Atlantic" | "East Pacific";
  /** "Category 3 hurricane", "Tropical storm". */
  strength: string;
  mph: number;
  near: string;
  lat: number;
  lon: number;
};

export type OtdData = {
  md: string;
  /** Tornado records cover 1950 through this year. */
  through: number;
  tornadoes: {
    total: number;
    years: number;
    deaths: number;
    /** Count by rating, 0–5 and unrated (-1). */
    byMag: Record<string, number>;
    /** Tornadoes per year on this date, 1950 onward, with that year's strongest rating. */
    perYear: { year: number; n: number; top: number }[];
    /** The most significant (by rating, then deaths, then length), at most 12. */
    top: OtdTornado[];
    /** Every tornado rated 2 or higher, for the map (at most 400). */
    paths: { a: [number, number]; b: [number, number] | null; mag: number }[];
  };
  landfalls: OtdLandfall[];
};

let places: ReturnType<typeof parsePlaces> | null = null;
function nearName(lat: number, lon: number, maxMiles = 60) {
  places ??= parsePlaces(PLACES);
  const n = nearestPlace(places, lat, lon, 1000);
  if (!n || n.miles > maxMiles) return "";
  return `${n.miles < 4 ? "" : "near "}${n.hit.name}, ${n.hit.st}`;
}

/**
 * The biggest town a track passed within 5 miles of ("Tuscaloosa", not the field it began
 * in); the town nearest its start when it crossed open country.
 */
function trackName(a: [number, number], b: [number, number] | null) {
  places ??= parsePlaces(PLACES);
  const [ax, ay] = a;
  const [bx, by] = b ?? a;
  const k = Math.cos((ay * Math.PI) / 180);
  const dx = (bx - ax) * k;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  for (const r of places) {
    if (r.pop < 2000) break; // most populous first
    const px = (r.lon - ax) * k;
    const py = r.lat - ay;
    const t = len ? Math.max(0, Math.min(1, (px * dx + py * dy) / len)) : 0;
    const miles = Math.hypot(px - t * dx, py - t * dy) * 69.1;
    if (miles <= 5) return `${r.name}, ${r.st}`;
  }
  return nearName(ay, ax);
}

const ratingOf = (mag: number, year: number) =>
  mag < 0
    ? year >= 2007
      ? "EFU"
      : "unrated"
    : `${year >= 2007 ? "EF" : "F"}${mag}`;

/** Tornadoes on `md` (MM-DD) from SPC's database CSV text. Exported for the tests. */
export function tornadoesOn(csv: string, md: string) {
  const [mo, dy] = md.split("-").map(Number);
  const lines = csv.split(/\r?\n/);
  const head = lines[0].split(",");
  const col = (k: string) => head.indexOf(k);
  const C = {
    yr: col("yr"),
    mo: col("mo"),
    dy: col("dy"),
    st: col("st"),
    mag: col("mag"),
    inj: col("inj"),
    fat: col("fat"),
    slat: col("slat"),
    slon: col("slon"),
    elat: col("elat"),
    elon: col("elon"),
    len: col("len"),
    wid: col("wid"),
    om: col("om"),
  };
  const all: OtdTornado[] = [];
  const seen = new Set<string>();
  let through = 1950;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < 20) continue;
    const year = Number(c[C.yr]);
    if (year > through) through = year;
    if (Number(c[C.mo]) !== mo || Number(c[C.dy]) !== dy) continue;
    // One row per tornado in this file; a multi-state one is a single full-track row (sn 0).
    const key = `${year}:${c[C.om]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mag = Number(c[C.mag]);
    const slat = Number(c[C.slat]);
    const slon = Number(c[C.slon]);
    const elat = Number(c[C.elat]);
    const elon = Number(c[C.elon]);
    if (!slat || !slon) continue;
    all.push({
      year,
      rating: ratingOf(mag, year),
      mag: Number.isFinite(mag) && mag >= 0 ? mag : -1,
      st: c[C.st],
      deaths: Math.max(0, Number(c[C.fat]) || 0),
      hurt: Math.max(0, Number(c[C.inj]) || 0),
      miles: Math.max(0, Number(c[C.len]) || 0),
      yards: Math.max(0, Number(c[C.wid]) || 0),
      a: [slon, slat],
      b: elat && elon ? [elon, elat] : null,
      near: "",
    });
  }
  const byMag: Record<string, number> = {};
  const years = new Map<number, { n: number; top: number }>();
  for (const t of all) {
    byMag[t.mag] = (byMag[t.mag] ?? 0) + 1;
    const y = years.get(t.year) ?? { n: 0, top: -1 };
    y.n++;
    y.top = Math.max(y.top, t.mag);
    years.set(t.year, y);
  }
  const perYear: { year: number; n: number; top: number }[] = [];
  for (let y = 1950; y <= through; y++)
    perYear.push({
      year: y,
      n: years.get(y)?.n ?? 0,
      top: years.get(y)?.top ?? -1,
    });
  const top = [...all]
    .sort(
      (p, q) =>
        q.mag - p.mag ||
        q.deaths - p.deaths ||
        q.miles - p.miles ||
        p.year - q.year,
    )
    .slice(0, 12)
    .map((t) => ({ ...t, near: trackName(t.a, t.b) }));
  return {
    through,
    tornadoes: {
      total: all.length,
      years: years.size,
      deaths: all.reduce((s, t) => s + t.deaths, 0),
      byMag,
      perYear,
      top,
      paths: all
        .filter((t) => t.mag >= 2)
        .sort((p, q) => q.mag - p.mag)
        .slice(0, 400)
        .map((t) => ({ a: t.a, b: t.b, mag: t.mag })),
    },
  };
}

const coord = (s: string) => {
  const v = parseFloat(s);
  return /[SW]/.test(s) ? -v : v;
};
const SS = [
  [137, "Category 5 hurricane"],
  [113, "Category 4 hurricane"],
  [96, "Category 3 hurricane"],
  [83, "Category 2 hurricane"],
  [64, "Category 1 hurricane"],
  [34, "Tropical storm"],
  [0, "Tropical depression"],
] as const;

/** U.S. landfalls on `md` from a HURDAT2 text file. Exported for the tests. */
export function landfallsOn(
  text: string,
  md: string,
  basin: OtdLandfall["basin"],
): OtdLandfall[] {
  const mmdd = md.replace("-", "");
  const out: OtdLandfall[] = [];
  let name = "";
  for (const line of text.split(/\r?\n/)) {
    const c = line.split(",").map((x) => x.trim());
    if (/^(AL|EP|CP)\d{6}$/.test(c[0])) {
      name = c[1];
      continue;
    }
    if (c[2] !== "L" || c[0].slice(4, 8) !== mmdd) continue;
    const lat = coord(c[4]);
    const lon = coord(c[5]);
    const kt = Number(c[6]);
    const near = nearName(lat, lon, 90);
    // Only landfalls on U.S. soil (within reach of a U.S. town).
    if (!near) continue;
    const mph = Math.round((kt * 1.15078) / 5) * 5;
    const strength =
      c[3] === "HU"
        ? SS.find(([k]) => kt >= k)![1]
        : c[3] === "TS"
          ? "Tropical storm"
          : c[3] === "TD"
            ? "Tropical depression"
            : "Post-tropical storm";
    out.push({
      year: Number(c[0].slice(0, 4)),
      name:
        name === "UNNAMED"
          ? "An unnamed storm"
          : name[0] + name.slice(1).toLowerCase(),
      basin,
      strength,
      mph,
      near,
      lat,
      lon,
    });
  }
  return out;
}

async function text(url: string) {
  const r = await fetch(url, {
    headers: UA,
    cache: "no-store",
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

/** The newest best-track files NHC lists (the names change with every yearly update). */
async function hurdatFiles() {
  const page = await text(NHC);
  const pick = (re: RegExp) =>
    [...page.matchAll(re)]
      .map((m) => m[0])
      .sort()
      .at(-1) ?? null;
  return {
    atl: pick(/hurdat2-1851-\d{4}-\d+\.txt/g),
    epac: pick(/hurdat2-nepac-1949-\d{4}-\d+\.txt/g),
  };
}

/** Everything NOAA's records hold for one calendar date. */
export async function buildDay(md: string): Promise<OtdData> {
  const y = new Date().getUTCFullYear();
  let csv: string | null = null;
  for (const year of [y - 1, y - 2]) {
    csv = await text(SPC(year)).catch(() => null);
    if (csv) break;
  }
  if (!csv) throw new Error("SPC's tornado database isn't answering");
  const files = await hurdatFiles().catch(() => ({ atl: null, epac: null }));
  const [atl, epac] = await Promise.all([
    files.atl ? text(NHC + files.atl).catch(() => "") : "",
    files.epac ? text(NHC + files.epac).catch(() => "") : "",
  ]);
  const t = tornadoesOn(csv, md);
  const landfalls = [
    ...landfallsOn(atl, md, "Atlantic"),
    ...landfallsOn(epac, md, "East Pacific"),
  ].sort((a, b) => b.mph - a.mph || b.year - a.year);
  return { md, through: t.through, tornadoes: t.tornadoes, landfalls };
}
