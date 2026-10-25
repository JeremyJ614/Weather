import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import { firstFile } from "./unzip";

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
const SPC_ZIP = (kind: "wind" | "hail", y: number) =>
  `https://www.spc.noaa.gov/wcm/data/1955-${y}_${kind}.csv.zip`;

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
  /** HURDAT2's storm number, e.g. AL092021. */
  id: string;
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

type Pt = [number, number];

/**
 * The day's one featured event: the most significant tornado outbreak, hurricane landfall,
 * or damaging-wind or hail day on this date in the records, with only that day's tracks and
 * reports for the map.
 */
export type OtdFeature = {
  kind: "tornado" | "hurricane" | "wind" | "hail";
  year: number;
  /** A plain label before Gemini names it: "Hurricane Katrina", "Tornadoes across AL, MS". */
  label: string;
  /** NOAA's facts, one per line, for the write-up. */
  facts: string[];
  /** The fact strip under the story. */
  stats: { k: string; v: string }[];
  tracks: { a: Pt; b: Pt | null; mag: number }[];
  reports: { k: "torn" | "wind" | "hail"; p: Pt }[];
  storm: { name: string; pts: [number, number, number][]; land: Pt } | null;
  /** Wikipedia searches, best first, and the words an article title must contain. */
  query: string[];
  accept: string[];
  /** States it touched, by name: a Wikipedia article must mention one (the U.S. event). */
  places: string[];
  /** How significant NOAA's records make it (deaths, ratings, category, reports). */
  score: number;
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
  feature?: OtdFeature | null;
  /** The strongest few candidates; Wikipedia's coverage picks among them (lib/history/days). */
  candidates?: OtdFeature[];
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
    all,
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
  let id = "";
  for (const line of text.split(/\r?\n/)) {
    const c = line.split(",").map((x) => x.trim());
    if (/^(AL|EP|CP)\d{6}$/.test(c[0])) {
      name = c[1];
      id = c[0];
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
      id,
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

/** A storm's whole track from a HURDAT2 file: [lon, lat, knots]. Exported for the tests. */
export function trackOf(text: string, id: string) {
  const pts: [number, number, number][] = [];
  let on = false;
  for (const line of text.split(/\r?\n/)) {
    const c = line.split(",").map((x) => x.trim());
    if (/^(AL|EP|CP)\d{6}$/.test(c[0])) {
      if (on) break;
      on = c[0] === id;
      continue;
    }
    if (on && c.length > 6) pts.push([coord(c[5]), coord(c[4]), Number(c[6])]);
  }
  return pts;
}

type Report = {
  k: "wind" | "hail";
  year: number;
  p: Pt;
  mag: number;
  fat: number;
  st: string;
};

/** Wind or hail reports on `md` from SPC's database CSV. Exported for the tests. */
export function reportsOn(csv: string, md: string, k: "wind" | "hail") {
  const [mo, dy] = md.split("-").map(Number);
  const lines = csv.split(/\r?\n/);
  const head = lines[0].split(",");
  const at = (n: string) => head.indexOf(n);
  const [Y, M, D, S, MAG, FAT, LA, LO] = [
    "yr",
    "mo",
    "dy",
    "st",
    "mag",
    "fat",
    "slat",
    "slon",
  ].map(at);
  const out: Report[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (Number(c[M]) !== mo || Number(c[D]) !== dy) continue;
    const lat = Number(c[LA]);
    const lon = Number(c[LO]);
    if (!lat || !lon) continue;
    out.push({
      k,
      year: Number(c[Y]),
      p: [lon, lat],
      mag: Number(c[MAG]) || 0,
      fat: Math.max(0, Number(c[FAT]) || 0),
      st: c[S],
    });
  }
  return out;
}

const MONTHS =
  "January February March April May June July August September October November December".split(
    " ",
  );
const r2 = (p: Pt): Pt => [
  Math.round(p[0] * 100) / 100,
  Math.round(p[1] * 100) / 100,
];
const listStates = (sts: string[]) => {
  const n = new Map<string, number>();
  for (const s of sts) n.set(s, (n.get(s) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1]).map(([s]) => s);
};
const join = (a: string[]) =>
  a.length < 3
    ? a.join(" and ")
    : `${a.slice(0, -1).join(", ")} and ${a.at(-1)}`;
const SS_WEIGHT: Record<string, number> = {
  "Category 5 hurricane": 90,
  "Category 4 hurricane": 70,
  "Category 3 hurricane": 50,
  "Category 2 hurricane": 30,
  "Category 1 hurricane": 18,
  "Tropical storm": 6,
};
const STATE_NAMES: Record<string, string> = Object.fromEntries(
  "AL Alabama,AK Alaska,AZ Arizona,AR Arkansas,CA California,CO Colorado,CT Connecticut,DE Delaware,DC Washington,FL Florida,GA Georgia,HI Hawaii,ID Idaho,IL Illinois,IN Indiana,IA Iowa,KS Kansas,KY Kentucky,LA Louisiana,ME Maine,MD Maryland,MA Massachusetts,MI Michigan,MN Minnesota,MS Mississippi,MO Missouri,MT Montana,NE Nebraska,NV Nevada,NH New Hampshire,NJ New Jersey,NM New Mexico,NY New York,NC North Carolina,ND North Dakota,OH Ohio,OK Oklahoma,OR Oregon,PA Pennsylvania,RI Rhode Island,SC South Carolina,SD South Dakota,TN Tennessee,TX Texas,UT Utah,VT Vermont,VA Virginia,WA Washington,WV West Virginia,WI Wisconsin,WY Wyoming,PR Puerto Rico"
    .split(",")
    .map((x) => [x.slice(0, 2), x.slice(3)]),
);
const stateNames = (sts: string[]) =>
  sts.map((s) => STATE_NAMES[s]).filter(Boolean);
const people = (n: number) => `${n} ${n === 1 ? "person was" : "people were"}`;

/**
 * The date's featured event: every tornado day, landfall and big wind or hail day on this
 * date is scored (deaths and violent tornadoes count most; a landfall by its category; a
 * wind or hail day by its reports), and the highest wins, the most recent on a tie.
 * Exported for the tests.
 */
export function pickFeatures(
  md: string,
  tornadoes: OtdTornado[],
  landfalls: OtdLandfall[],
  reports: Report[],
  tracks: Record<string, [number, number, number][]>,
  n = 3,
): OtdFeature[] {
  const [mo, dy] = md.split("-").map(Number);
  const date = (y: number) => `${MONTHS[mo - 1]} ${dy}, ${y}`;
  // Tornadoes, winds and hail in the same year are one weather day ("day:"); a storm's
  // landfalls are one storm ("storm:").
  const cands: {
    key: string;
    score: number;
    year: number;
    make: () => OtdFeature;
  }[] = [];
  const years = [...new Set(tornadoes.map((t) => t.year))];
  const dayReports = (y: number) =>
    reports
      .filter((r) => r.year === y)
      .slice(0, 2500)
      .map((r) => ({ k: r.k, p: r2(r.p) }));
  for (const y of years) {
    const ts = tornadoes.filter((t) => t.year === y);
    const deaths = ts.reduce((a, t) => a + t.deaths, 0);
    const hurt = ts.reduce((a, t) => a + t.hurt, 0);
    const n = (m: number) => ts.filter((t) => t.mag === m).length;
    const score =
      deaths * 2 + n(5) * 25 + n(4) * 12 + n(3) * 4 + ts.length * 0.5;
    cands.push({
      key: `day:${y}`,
      score,
      year: y,
      make: () => {
        const top = [...ts].sort(
          (p, q) => q.mag - p.mag || q.deaths - p.deaths || q.miles - p.miles,
        );
        const big = { ...top[0], near: trackName(top[0].a, top[0].b) };
        const deadly = top
          .filter((t) => t.deaths > 0)
          .sort((p, q) => q.deaths - p.deaths)
          .slice(0, 3)
          .map((t) => ({ ...t, near: trackName(t.a, t.b) }));
        const sts = listStates(ts.map((t) => t.st));
        const rep = reports.filter((r) => r.year === y);
        const wind = rep.filter((r) => r.k === "wind").length;
        const hail = rep.filter((r) => r.k === "hail");
        const bigHail = Math.max(0, ...hail.map((r) => r.mag));
        return {
          kind: "tornado",
          year: y,
          label: `Tornadoes across ${join(sts.slice(0, 4))}`,
          facts: [
            `${ts.length} tornado${ts.length === 1 ? "" : "es"} touched down on ${date(y)}, across ${join(sts.slice(0, 6))} (SPC's tornado database).`,
            ...(deaths || hurt
              ? [
                  `${people(deaths)} killed and ${hurt} injured by tornadoes that day.`,
                ]
              : ["No one was killed by tornadoes that day."]),
            `The strongest was rated ${big.rating}${big.near ? `, through or near ${big.near}` : ` in ${big.st}`}: on the ground ${big.miles.toFixed(1)} miles, up to ${big.yards.toLocaleString("en-US")} yards wide${big.deaths ? `, ${big.deaths} killed` : ""}.`,
            ...deadly
              .filter((t) => t !== deadly[0] || t.near !== big.near)
              .map(
                (t) =>
                  `A ${t.rating} tornado ${t.near ? `through or near ${t.near}` : `in ${t.st}`} killed ${t.deaths}.`,
              ),
            ...(wind || hail.length
              ? [
                  `The same day had ${wind} damaging-wind reports and ${hail.length} hail reports${bigHail >= 2 ? `, the largest ${bigHail}" hail` : ""}.`,
                ]
              : []),
          ],
          stats: [
            { k: "Tornadoes", v: String(ts.length) },
            { k: "Strongest", v: big.rating },
            { k: "Killed", v: String(deaths) },
            { k: "Injured", v: hurt.toLocaleString("en-US") },
          ],
          tracks: ts.map((t) => ({
            a: r2(t.a),
            b: t.b ? r2(t.b) : null,
            mag: t.mag,
          })),
          reports: dayReports(y),
          storm: null,
          query: [
            `${y} tornado outbreak ${MONTHS[mo - 1]} ${dy}`,
            `${(big.near || big.st).split(",")[0]} tornado ${y}`,
            `${MONTHS[mo - 1]} ${y} tornado outbreak`,
          ],
          accept: [String(y)],
          places: stateNames(sts),
          score,
        };
      },
    });
  }
  for (const l of landfalls) {
    const pts = tracks[l.id] ?? [];
    const lscore = (SS_WEIGHT[l.strength] ?? 2) + (l.year >= 1950 ? 1 : 0);
    const st = l.near.split(", ").at(-1) ?? "";
    cands.push({
      key: `storm:${l.id}`,
      score: lscore,
      year: l.year,
      make: () => {
        const peak = Math.max(0, ...pts.map((p) => p[2]));
        const named = l.name !== "An unnamed storm";
        return {
          kind: "hurricane",
          year: l.year,
          label: named
            ? `${l.strength.startsWith("Category") ? "Hurricane" : "Tropical Storm"} ${l.name}`
            : `A ${l.strength.toLowerCase()}`,
          facts: [
            `${named ? l.name : "An unnamed storm"} made landfall ${l.near} on ${date(l.year)} as a ${l.strength.toLowerCase()} with ${l.mph} mph winds (NHC best track).`,
            ...(peak
              ? [
                  `At its peak it had ${Math.round((peak * 1.15078) / 5) * 5} mph winds.`,
                ]
              : []),
          ],
          stats: [
            { k: "Landfall", v: l.near.replace(/^near /, "") },
            { k: "Strength", v: l.strength.replace(" hurricane", "") },
            { k: "Winds", v: `${l.mph} mph` },
            ...(peak
              ? [
                  {
                    k: "Peak",
                    v: `${Math.round((peak * 1.15078) / 5) * 5} mph`,
                  },
                ]
              : []),
          ],
          tracks: [],
          reports: [],
          storm: {
            name: named ? l.name : "Unnamed",
            pts: pts.map(([x, y, k]) => [
              Math.round(x * 10) / 10,
              Math.round(y * 10) / 10,
              k,
            ]),
            land: [l.lon, l.lat],
          },
          query: named
            ? [
                `Hurricane ${l.name} (${l.year})`,
                `Hurricane ${l.name} ${l.year}`,
                `Tropical Storm ${l.name} ${l.year}`,
              ]
            : [
                `${l.year} ${STATE_NAMES[st] ?? ""} hurricane`,
                `${l.year} hurricane ${l.near.replace(/^near /, "").split(",")[0]}`,
                `${MONTHS[mo - 1]} ${l.year} hurricane`,
              ],
          accept: named ? [l.name] : [String(l.year)],
          places: stateNames([st]),
          score: lscore,
        };
      },
    });
  }
  for (const k of ["wind", "hail"] as const) {
    const byYear = new Map<number, Report[]>();
    for (const r of reports)
      if (r.k === k) byYear.set(r.year, [...(byYear.get(r.year) ?? []), r]);
    for (const [y, rs] of byYear) {
      const deaths = rs.reduce((a, r) => a + r.fat, 0);
      const top = Math.max(0, ...rs.map((r) => r.mag));
      const score =
        k === "wind"
          ? rs.length / 12 + deaths * 2
          : rs.length / 10 + (top >= 4 ? 10 : 0);
      const torn = tornadoes.filter((t) => t.year === y).length;
      cands.push({
        key: `day:${y}`,
        score,
        year: y,
        make: () => {
          const sts = listStates(rs.map((r) => r.st));
          return {
            kind: k,
            year: y,
            label:
              k === "wind"
                ? `Damaging winds across ${join(sts.slice(0, 4))}`
                : `Hail across ${join(sts.slice(0, 4))}`,
            facts: [
              `${rs.length} ${k === "wind" ? "damaging-wind" : "hail"} reports on ${date(y)}, across ${join(sts.slice(0, 8))} (SPC's database).`,
              ...(k === "wind"
                ? [
                    ...(top
                      ? [
                          `The strongest measured gust was ${Math.round(top * 1.15078)} mph.`,
                        ]
                      : []),
                    ...(deaths
                      ? [`${people(deaths)} killed by the winds.`]
                      : []),
                  ]
                : [`The largest hailstone reported was ${top}".`]),
              ...(torn
                ? [`The same day had ${torn} tornado${torn === 1 ? "" : "es"}.`]
                : []),
            ],
            stats:
              k === "wind"
                ? [
                    { k: "Wind reports", v: String(rs.length) },
                    ...(top
                      ? [
                          {
                            k: "Top gust",
                            v: `${Math.round(top * 1.15078)} mph`,
                          },
                        ]
                      : []),
                    { k: "Killed", v: String(deaths) },
                  ]
                : [
                    { k: "Hail reports", v: String(rs.length) },
                    { k: "Largest", v: `${top}"` },
                  ],
            tracks: tornadoes
              .filter((t) => t.year === y)
              .map((t) => ({
                a: r2(t.a),
                b: t.b ? r2(t.b) : null,
                mag: t.mag,
              })),
            reports: dayReports(y),
            storm: null,
            query:
              k === "wind"
                ? [
                    `${y} derecho ${MONTHS[mo - 1]}`,
                    `${MONTHS[mo - 1]} ${y} derecho`,
                    `${y} ${MONTHS[mo - 1]} windstorm`,
                    `${MONTHS[mo - 1]} ${y} storm`,
                  ]
                : [`${y} hailstorm ${MONTHS[mo - 1]}`],
            accept: [String(y)],
            places: stateNames(sts),
            score,
          };
        },
      });
    }
  }
  cands.sort((a, b) => b.score - a.score || b.year - a.year);
  // The strongest kind leads its day; the day's other kinds add their weight and searches.
  const leads = new Map<string, { c: (typeof cands)[0]; more: typeof cands }>();
  for (const c of cands) {
    const lead = leads.get(c.key);
    if (!lead) leads.set(c.key, { c: { ...c }, more: [] });
    else if (c.key.startsWith("day:")) {
      lead.c.score += c.score;
      lead.more.push(c);
    }
  }
  return [...leads.values()]
    .sort((a, b) => b.c.score - a.c.score || b.c.year - a.c.year)
    .slice(0, n)
    .map(({ c, more }) => {
      const f = c.make();
      const rest = more.map((m) => m.make());
      return {
        ...f,
        score: c.score,
        query: [...new Set([...f.query, ...rest.flatMap((m) => m.query)])],
        places: [...new Set([...f.places, ...rest.flatMap((m) => m.places)])],
      };
    });
}

/** Everything NOAA's records hold for one calendar date, and its featured event. */
export async function buildDay(md: string): Promise<OtdData> {
  const y = new Date().getUTCFullYear();
  let csv: string | null = null;
  let last = y - 1;
  for (const year of [y - 1, y - 2]) {
    csv = await text(SPC(year)).catch(() => null);
    last = year;
    if (csv) break;
  }
  if (!csv) throw new Error("SPC's tornado database isn't answering");
  const zip = (k: "wind" | "hail") =>
    fetch(SPC_ZIP(k, last), {
      headers: UA,
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    })
      .then(async (r) =>
        r.ok
          ? reportsOn(
              firstFile(Buffer.from(await r.arrayBuffer())).toString("latin1"),
              md,
              k,
            )
          : [],
      )
      .catch(() => [] as Report[]);
  const files = await hurdatFiles().catch(() => ({ atl: null, epac: null }));
  const [atl, epac, wind, hail] = await Promise.all([
    files.atl ? text(NHC + files.atl).catch(() => "") : "",
    files.epac ? text(NHC + files.epac).catch(() => "") : "",
    zip("wind"),
    zip("hail"),
  ]);
  const t = tornadoesOn(csv, md);
  const landfalls = [
    ...landfallsOn(atl, md, "Atlantic"),
    ...landfallsOn(epac, md, "East Pacific"),
  ].sort((a, b) => b.mph - a.mph || b.year - a.year);
  const tracks: Record<string, [number, number, number][]> = {};
  for (const l of landfalls)
    tracks[l.id] ??= trackOf(l.id.startsWith("AL") ? atl : epac, l.id);
  return {
    md,
    through: t.through,
    tornadoes: t.tornadoes,
    landfalls,
    candidates: pickFeatures(md, t.all, landfalls, [...wind, ...hail], tracks),
  };
}
