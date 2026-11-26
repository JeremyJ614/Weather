import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PLACES } from "@/lib/geo/places.data";
import { norm, parsePlaces, searchPlaces, STATES } from "@/lib/geo/search";
import { lookupZip } from "@/lib/weather/nws";
import { parseZip } from "@/lib/weather/geo";
import { project } from "@/lib/map/usAlbers";
import { stateAt } from "@/lib/history/states";

/**
 * Tornado Database (owner's Weather list #42, item 2): NOAA SPC's record of every tornado since
 * 1950, built into src/data/tornado by scripts/tornado_db.py (once a year), read here on the
 * server: counties by name, place, ZIP or point, and each county's tracks.
 */
const DIR = path.join(process.cwd(), "src", "data", "tornado");

export type County = {
  fips: string;
  name: string;
  st: string;
  n: number;
  /** Strongest rating (0-5), -1 unrated, -2 none. */
  top: number;
  last: string;
  lat: number;
  lon: number;
  nb: string[];
  slug: string;
};
/** One tornado as it touched a county. */
export type Tor = {
  when: string;
  zone: string;
  mag: number;
  ef: boolean;
  miles: number;
  yards: number;
  hurt: number;
  deaths: number;
  a: [number, number];
  b: [number, number];
  /** Miles inside each county it crossed (-1 when the line misses but the record names it). */
  inc: Record<string, number>;
  /** The NWS damage survey's path (flat lon,lat parts), when one was matched (lib/tornado/dat). */
  path?: number[][];
  /** From an NWS survey after NOAA's yearly record ends: preliminary. */
  prelim?: boolean;
};
type StateFile = {
  st: string;
  counties: Record<string, { n: string; b: number[]; o: number[][] }>;
  tracks: [
    string,
    string,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    (string | number)[],
  ][];
};

export const slugOf = (name: string, st: string) =>
  `${name} ${st}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

let index: Promise<{
  through: string;
  list: County[];
  bySlug: Map<string, County>;
  byFips: Map<string, County>;
}> | null = null;
export function counties() {
  return (index ??= readFile(path.join(DIR, "index.json"), "utf8").then(
    (raw) => {
      const j = JSON.parse(raw) as {
        through: string;
        counties: [
          string,
          string,
          string,
          number,
          number,
          string,
          number,
          number,
          string[],
        ][];
      };
      const list = j.counties.map(
        ([fips, name, st, n, top, last, lat, lon, nb]) => ({
          fips,
          name,
          st,
          n,
          top,
          last,
          lat,
          lon,
          nb,
          slug: slugOf(name, st),
        }),
      );
      return {
        through: j.through,
        list,
        bySlug: new Map(list.map((c) => [c.slug, c])),
        byFips: new Map(list.map((c) => [c.fips, c])),
      };
    },
  ));
}

const files = new Map<string, Promise<StateFile>>();
function stateFile(st: string) {
  if (!/^[A-Z]{2}$/.test(st)) return Promise.reject(new Error("bad state"));
  let f = files.get(st);
  if (!f) {
    f = readFile(path.join(DIR, "st", `${st}.json`), "utf8").then(
      (r) => JSON.parse(r) as StateFile,
    );
    files.set(st, f);
    // A few states stay warm; the rest are read again when next asked.
    if (files.size > 12) files.delete(files.keys().next().value!);
  }
  return f;
}

export function inside(rings: number[][], x: number, y: number) {
  let hit = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const [xi, yi, xj, yj] = [r[i], r[i + 1], r[j], r[j + 1]];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        hit = !hit;
    }
  return hit;
}

/** The county under a point, or the nearest one within about 15 miles (a coast or a border). */
export async function countyAt(
  lat: number,
  lon: number,
): Promise<County | null> {
  const { byFips, list } = await counties();
  const at = project(lon, lat);
  const st = at ? stateAt(at.x, at.y) : "";
  if (st) {
    const f = await stateFile(st).catch(() => null);
    if (f)
      for (const [fips, c] of Object.entries(f.counties))
        if (
          lon >= c.b[0] &&
          lon <= c.b[2] &&
          lat >= c.b[1] &&
          lat <= c.b[3] &&
          inside(c.o, lon, lat)
        )
          return byFips.get(fips) ?? null;
  }
  const k = Math.cos((lat * Math.PI) / 180);
  let best: County | null = null,
    bd = (15 / 69) ** 2;
  for (const c of list) {
    const d = (c.lat - lat) ** 2 + ((c.lon - lon) * k) ** 2;
    if (d < bd) [bd, best] = [d, c];
  }
  return best;
}

export type Hit = {
  slug: string;
  label: string;
  sub: string;
  n: number;
  top: number;
};
const hit = (c: County, sub = ""): Hit => ({
  slug: c.slug,
  label: `${c.name}, ${c.st}`,
  sub,
  n: c.n,
  top: c.top,
});
let places: ReturnType<typeof parsePlaces> | null = null;

/** Search by ZIP, county name ("Pike County", "Pike KY") or town ("Joplin MO"). */
export async function find(q: string): Promise<Hit[]> {
  const raw = q.trim().slice(0, 80);
  if (!raw) return [];
  const zip = parseZip(raw);
  if (zip) {
    const z = await lookupZip(zip);
    const c = await countyAt(z.lat, z.lon);
    return c ? [hit(c, `${zip} · ${z.label}`)] : [];
  }
  const { list } = await counties();
  const n = norm(raw);
  const m = n.match(
    /^(.*?)(?:\s+(county|parish|borough|census area|municipality|city))?(?:\s+([a-z]{2}))?$/,
  );
  const base = (m?.[1] ?? n).trim();
  const stq = m?.[3] && STATES[m[3].toUpperCase()] ? m[3].toUpperCase() : null;
  const out: Hit[] = [];
  const seen = new Set<string>();
  const push = (c: County, sub: string) => {
    if (!seen.has(c.slug)) {
      seen.add(c.slug);
      out.push(hit(c, sub));
    }
  };
  // Counties whose own name matches, busiest first.
  if (base.length >= 2)
    list
      .filter(
        (c) =>
          (!stq || c.st === stq) &&
          norm(
            c.name.replace(
              / (County|Parish|Borough|Census Area|Municipality|city|City and Borough)$/i,
              "",
            ),
          ).startsWith(base),
      )
      .sort((a, b) => b.n - a.n)
      .slice(0, 5)
      .forEach((c) => push(c, `${STATES[c.st] ?? c.st} · county`));
  // Towns, mapped to the county they sit in.
  places ??= parsePlaces(PLACES);
  for (const p of searchPlaces(places, raw, 6)) {
    if (out.length >= 8) break;
    const c = await countyAt(p.lat, p.lon);
    if (c) push(c, `${p.name}, ${p.st}`);
  }
  return out.slice(0, 8);
}

export type CountyData = {
  county: County;
  outline: number[][];
  box: number[];
  tors: Tor[];
  neighbours: County[];
  towns: { name: string; lat: number; lon: number; pop: number }[];
  through: string;
  /** Whether the NWS damage surveys answered for this page (read daily). */
  surveys?: { live: boolean };
};

/** Everything a county page shows. */
export async function countyData(slug: string): Promise<CountyData | null> {
  const { bySlug, byFips, through } = await counties();
  const county = bySlug.get(slug);
  if (!county) return null;
  const f = await stateFile(county.st);
  const shape = f.counties[county.fips];
  const tors: Tor[] = [];
  for (const t of f.tracks) {
    const c = t[12];
    const idx = c.indexOf(county.fips);
    if (idx < 0 || idx % 2) continue;
    const inc: Record<string, number> = {};
    for (let i = 0; i < c.length; i += 2)
      inc[c[i] as string] = c[i + 1] as number;
    tors.push({
      when: t[0],
      zone: t[1],
      mag: t[2],
      ef: t[3] === 1,
      miles: t[4],
      yards: t[5],
      hurt: t[6],
      deaths: t[7],
      a: [t[8], t[9]],
      b: [t[10], t[11]],
      inc,
    });
  }
  places ??= parsePlaces(PLACES);
  const [x0, y0, x1, y1] = shape.b;
  const towns = places
    .filter(
      (p) =>
        p.lon >= x0 &&
        p.lon <= x1 &&
        p.lat >= y0 &&
        p.lat <= y1 &&
        inside(shape.o, p.lon, p.lat),
    )
    .slice(0, 14)
    .map(({ name, lat, lon, pop }) => ({ name, lat, lon, pop }));
  return {
    county,
    outline: shape.o,
    box: shape.b,
    tors,
    neighbours: county.nb
      .map((x) => byFips.get(x))
      .filter((x): x is County => !!x)
      .sort((a, b) => b.n - a.n),
    towns,
    through,
  };
}

/** Rating as written: EF after February 2007, F before; U when never rated. */
export const rating = (t: Pick<Tor, "mag" | "ef">) =>
  t.mag < 0 ? (t.ef ? "EFU" : "FU") : `${t.ef ? "EF" : "F"}${t.mag}`;
/** The EF color key for a rating (F ratings share the EF colors). */
export const efKey = (mag: number) => (mag < 0 ? "EFU" : `EF${mag}`);
