/** Tornado Database: the numbers and words a county page shows, from its tornadoes. */
export type T = {
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
  inc: Record<string, number>;
  path?: number[][];
  prelim?: boolean;
};

/** Where the Tornado Database lives: the third tab of Severe Weather History (owner, 2026-11-26). */
export const TDB = "/severe-weather-history/tornado-database";
export const TDB_TAB = "/severe-weather-history#tornado-database";

/** A tornado's path in a frame: the surveyed shape when there is one, else touchdown to lift-off. */
export function trackD(
  t: T,
  at: (lon: number, lat: number) => [number, number],
) {
  const parts = t.path?.length ? t.path : [[t.a[1], t.a[0], t.b[1], t.b[0]]];
  let d = "";
  for (const p of parts)
    for (let i = 0; i + 1 < p.length; i += 2) {
      const [x, y] = at(p[i], p[i + 1]);
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  return d;
}
/** First and last points of a path (lon, lat). */
export function ends(t: T): [[number, number], [number, number]] {
  if (!t.path?.length)
    return [
      [t.a[1], t.a[0]],
      [t.b[1], t.b[0]],
    ];
  const f = t.path[0],
    l = t.path[t.path.length - 1];
  return [
    [f[0], f[1]],
    [l[l.length - 2], l[l.length - 1]],
  ];
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const rate = (t: Pick<T, "mag" | "ef">) =>
  t.mag < 0 ? (t.ef ? "EFU" : "FU") : `${t.ef ? "EF" : "F"}${t.mag}`;
export const efKey = (mag: number) => (mag < 0 ? "EFU" : `EF${mag}`);
export const day = (when: string) => {
  const [y, m, d] = when.slice(0, 10).split("-").map(Number);
  return `${LONG[m - 1]} ${d}, ${y}`;
};
export const clock = (when: string, zone: string) => {
  const hm = when.slice(11, 16);
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}${zone ? " " + zone : ""}`;
};
const mi = (n: number) =>
  n >= 10 ? n.toFixed(1).replace(/\.0$/, "") : String(+n.toFixed(2));
export const miles = (n: number) => `${mi(n)} mile${n === 1 ? "" : "s"}`;

/** The strongest tornado: highest rating, then the longest path, then the most recent. */
export function strongest(ts: T[]) {
  return (
    [...ts].sort(
      (x, y) =>
        y.mag - x.mag || y.miles - x.miles || (x.when < y.when ? 1 : -1),
    )[0] ?? null
  );
}

/** When tornadoes come: by month (with the strongest rating each month) and by local hour. */
export function season(ts: T[]) {
  const months = MONTHS.map(() => ({ n: 0, top: -2 }));
  const hours = Array.from({ length: 24 }, () => 0);
  let timed = 0,
    night = 0;
  for (const t of ts) {
    const m = Number(t.when.slice(5, 7)) - 1;
    months[m].n++;
    months[m].top = Math.max(months[m].top, t.mag);
    const h = t.when.length > 10 ? Number(t.when.slice(11, 13)) : NaN;
    if (Number.isFinite(h)) {
      timed++;
      hours[h]++;
      if (h >= 22 || h < 6) night++;
    }
  }
  const peak = months.reduce((b, x, i) => (x.n > months[b].n ? i : b), 0);
  // The three months in a row (wrapping round the year) with the most tornadoes.
  let run = 0,
    runAt = 0;
  for (let i = 0; i < 12; i++) {
    const s = months[i].n + months[(i + 1) % 12].n + months[(i + 2) % 12].n;
    if (s > run) [run, runAt] = [s, i];
  }
  const busiestHour = hours.reduce((b, x, i) => (x > hours[b] ? i : b), 0);
  return { months, hours, peak, run, runAt, timed, night, busiestHour };
}

/** The five years with the most tornadoes (ties: the more recent year first). */
export function topYears(ts: T[]) {
  const m = new Map<number, { n: number; top: number }>();
  for (const t of ts) {
    const y = Number(t.when.slice(0, 4));
    const v = m.get(y) ?? { n: 0, top: -2 };
    v.n++;
    v.top = Math.max(v.top, t.mag);
    m.set(y, v);
  }
  return [...m.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[0] - a[0])
    .slice(0, 5)
    .map(([year, v]) => ({ year, ...v }));
}

/** Tornadoes grouped by decade, newest decade first. */
export function decades(ts: T[]) {
  const m = new Map<number, T[]>();
  for (const t of ts) {
    const d = Math.floor(Number(t.when.slice(0, 4)) / 10) * 10;
    m.set(d, [...(m.get(d) ?? []), t]);
  }
  return [...m.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decade, list]) => ({
      decade,
      list,
      top: Math.max(...list.map((t) => t.mag)),
    }));
}

/** One tornado as a sentence. */
export function line(t: T, fips: string, county: string) {
  const parts = [`${miles(t.miles)} long`];
  if (t.yards) parts.push(`${t.yards.toLocaleString("en-US")} yards wide`);
  const inn = t.inc[fips];
  const crossed = Object.keys(t.inc).length > 1;
  let s = `an ${rate(t)} tornado, ${parts.join(" and ")}`;
  if (crossed && inn > 0 && inn < t.miles - 0.05)
    s += ` (${mi(inn)} miles of it in ${county})`;
  const harm = [
    t.deaths ? `${t.deaths} ${t.deaths === 1 ? "death" : "deaths"}` : "",
    t.hurt ? `${t.hurt} ${t.hurt === 1 ? "injury" : "injuries"}` : "",
  ].filter(Boolean);
  return (
    s +
    (harm.length ? `; ${harm.join(" and ")}` : "") +
    "." +
    (t.prelim ? " Preliminary NWS survey." : "")
  );
}

/** The plain-language summary at the top of a county page. */
export function summary(
  ts: T[],
  place: string,
  stateName: string,
  through: string,
) {
  if (!ts.length)
    return `No tornado has been recorded in ${place}, ${stateName} since NOAA's record began in 1950 (through ${through}). That is rarer than it sounds: most of the country has seen at least one.`;
  const top = strongest(ts)!;
  const last = ts[0];
  const harm = [
    top.deaths ? `killed ${top.deaths}` : "",
    top.hurt ? `injured ${top.hurt}` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const big = ts.filter((t) => t.mag >= 3).length;
  return [
    `${ts.length} tornado${ts.length === 1 ? " has" : "es have"} touched ${place}, ${stateName} since 1950 (NOAA's record through ${through}${ts.some((t) => t.prelim) ? ", then the National Weather Service's damage surveys since" : ""}).`,
    `The strongest was an ${rate(top)} on ${day(top.when)}${top.miles ? `, on a path ${miles(top.miles)} long` : ""}${harm ? `, and it ${harm}` : ""}.`,
    big > 1
      ? `${big} of them were rated ${top.ef ? "EF" : "F"}3 or stronger.`
      : "",
    last !== top
      ? `The most recent was an ${rate(last)} on ${day(last.when)}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** A frame for local maps: lon/lat to x/y in a w×h box with padding, true to scale at that latitude. */
export function frame(box: number[], w: number, h: number, pad: number) {
  const [x0, y0, x1, y1] = box;
  const lat0 = (y0 + y1) / 2,
    k = Math.cos((lat0 * Math.PI) / 180);
  const s = Math.min(
    (w - 2 * pad) / Math.max(1e-6, (x1 - x0) * k),
    (h - 2 * pad) / Math.max(1e-6, y1 - y0),
  );
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  const at = (lon: number, lat: number): [number, number] => [
    w / 2 + (lon - cx) * k * s,
    h / 2 - (lat - cy) * s,
  ];
  return { at, s, milesPx: s / 69 };
}

/** County outline rings (flat lon,lat pairs) as an SVG path in a frame. */
export function ringsPath(
  rings: number[][],
  at: (lon: number, lat: number) => [number, number],
) {
  let d = "";
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) {
      const [x, y] = at(r[i], r[i + 1]);
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += "Z";
  }
  return d;
}
