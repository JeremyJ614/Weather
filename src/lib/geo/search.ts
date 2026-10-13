/** Place search over the Census place list: city, "city, ST", "city state" or a state alone. */

export type PlaceHit = {
  name: string;
  st: string;
  lat: number;
  lon: number;
  pop: number;
};

export const STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bfort\b/g, "ft")
    .trim();

const BY_NAME = Object.entries(STATES).map(
  ([ab, name]) => [norm(name), ab] as const,
);

type Row = PlaceHit & { key: string };

export function parsePlaces(raw: string): Row[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [name, st, lat, lon, pop] = l.split("|");
      return { name, st, lat: +lat, lon: +lon, pop: +pop, key: norm(name) };
    });
}

/** Splits a trailing state ("dayton oh", "dayton, ohio", "ohio") off the query. */
export function splitState(q: string): { city: string; st: string | null } {
  const comma = q.includes(",");
  const n = norm(q);
  for (const [name, ab] of BY_NAME) {
    if (n === name) return { city: "", st: ab };
    if (n.endsWith(" " + name))
      return { city: n.slice(0, -name.length - 1), st: ab };
  }
  const m = n.match(/^(.+) ([a-z]{2})$/);
  if (m && STATES[m[2].toUpperCase()] && (comma || m[1].length > 1))
    return { city: m[1], st: m[2].toUpperCase() };
  return { city: n, st: null };
}

export function searchPlaces(rows: Row[], q: string, limit = 8): PlaceHit[] {
  const full = norm(q);
  if (full.length < 2 || /^\d+$/.test(full)) return [];
  const { city, st } = splitState(q);
  const hits: { r: Row; score: number }[] = [];
  if (!city && st) {
    // A state alone: its largest places, plus any place literally named that.
    return rows
      .filter((r) => r.st === st || r.key === full)
      .slice(0, limit)
      .map(strip);
  }
  for (const r of rows) {
    if (st && r.st !== st) continue;
    const score =
      r.key === city
        ? 3
        : r.key.startsWith(city)
          ? 2
          : r.key.includes(" " + city)
            ? 1
            : 0;
    if (score) hits.push({ r, score });
  }
  // Still typing the state ("dayton o", "dayton oh"): match its start.
  const part = city.match(/^(.+) ([a-z]+)$/);
  if (!hits.length && !st && part) {
    const sts = new Set(
      BY_NAME.filter(
        ([name, ab]) =>
          name.startsWith(part[2]) || ab.toLowerCase().startsWith(part[2]),
      ).map(([, ab]) => ab),
    );
    for (const r of rows) {
      if (!sts.has(r.st)) continue;
      const score = r.key === part[1] ? 3 : r.key.startsWith(part[1]) ? 2 : 0;
      if (score) hits.push({ r, score });
    }
  }
  // Rows are most populous first; the sort is stable.
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit).map((h) => strip(h.r));
}

const strip = ({ name, st, lat, lon, pop }: Row): PlaceHit => ({
  name,
  st,
  lat,
  lon,
  pop,
});
