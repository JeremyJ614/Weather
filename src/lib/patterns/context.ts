import "server-only";

/**
 * More to say in the Weather Patterns recaps (owner's list #41: "more human and a little more
 * information": whether it was busy, which couple of states had the most severe or wintry
 * weather, the bigger events, temperatures across the U.S., anomalies). Three free sources,
 * each optional (a recap is still written if one doesn't answer):
 *  - NWS local storm reports (Iowa Environmental Mesonet): snow, ice, blizzards, flooding,
 *    non-thunderstorm wind, heavy rain, by state, with the biggest totals.
 *  - Daily highs, lows and departures from normal at ~55 big-city airports (RCC-ACIS).
 *  - For the year: NOAA NCEI's national monthly average temperature and precipitation against
 *    the 1991–2020 average for each month.
 * Everything is boiled down to plain fact lines the forecast desk writes from.
 */

const UA = { "User-Agent": "SSWX Weather Center (weather.sswx.space)" };

type Lsr = {
  typetext: string;
  state: string;
  city: string;
  valid: string;
  magnitude: string | number | null;
  unit?: string;
};

const WINTER =
  /^(SNOW|HEAVY SNOW|BLIZZARD|ICE STORM|FREEZING RAIN|FREEZING DRIZZLE|SLEET|LAKE.?EFFECT SNOW|SNOW SQUALL|EXTREME COLD|WIND CHILL|EXTR WIND CHILL)/;
const FLOOD = /^(FLOOD|FLASH FLOOD|COASTAL FLOOD|LAKESHORE FLOOD)/;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
const top = (m: Map<string, number>, n: number) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const bump = (m: Map<string, number>, k: string) =>
  m.set(k, (m.get(k) ?? 0) + 1);

/** Storm reports between two instants (at most ~31 days: the month's file is ~3 MB). */
export async function stormReports(fromIso: string, toIso: string) {
  const r = await fetch(
    `https://mesonet.agron.iastate.edu/geojson/lsr.geojson?sts=${fromIso}&ets=${toIso}`,
    {
      headers: UA,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(14000),
    },
  ).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => null)) as {
    features?: { properties: Lsr }[];
  } | null;
  return j?.features?.map((f) => f.properties) ?? null;
}

/** Fact lines from storm reports, or [] when there are none. */
export function reportFacts(list: Lsr[]): string[] {
  const winter = new Map<string, number>();
  const flood = new Map<string, number>();
  const kinds = new Map<string, number>();
  const snow: { v: number; where: string; when: string }[] = [];
  const rain: { v: number; where: string; when: string }[] = [];
  let gust: { v: number; where: string; when: string } | null = null;
  let ice = 0;
  let blizzard = 0;
  for (const x of list) {
    const t = (x.typetext ?? "").toUpperCase();
    const st = x.state;
    const mag = Number(x.magnitude);
    const where = `${x.city}, ${st}`;
    if (WINTER.test(t)) {
      bump(winter, st);
      bump(kinds, t);
      if (/ICE STORM|FREEZING/.test(t)) ice++;
      if (/BLIZZARD/.test(t)) blizzard++;
      if (/SNOW/.test(t) && mag > 0 && mag < 120)
        snow.push({ v: mag, where, when: x.valid });
    } else if (FLOOD.test(t)) bump(flood, st);
    else if (t === "RAIN" && mag > 0 && mag < 40)
      rain.push({ v: mag, where, when: x.valid });
    else if (/NON-TSTM WND GST/.test(t) && mag > 0 && mag < 250) {
      if (!gust || mag > gust.v) gust = { v: mag, where, when: x.valid };
    }
  }
  const out: string[] = [];
  const winterN = [...winter.values()].reduce((a, b) => a + b, 0);
  if (winterN) {
    out.push(
      `Winter weather reports (snow, ice, blizzard, cold): ${winterN}; most in ${top(
        winter,
        4,
      )
        .map(([s, n]) => `${s} (${n})`)
        .join(
          ", ",
        )}.${ice ? ` Ice or freezing rain reports: ${ice}.` : ""}${blizzard ? ` Blizzard reports: ${blizzard}.` : ""}`,
    );
    const big = snow.sort((a, b) => b.v - a.v).slice(0, 3);
    if (big.length)
      out.push(
        `Biggest snowfall totals reported: ${big.map((s) => `${s.v}" near ${s.where} (${day(s.when)})`).join("; ")}.`,
      );
  } else out.push("No winter weather reports.");
  const floodN = [...flood.values()].reduce((a, b) => a + b, 0);
  if (floodN)
    out.push(
      `Flood and flash flood reports: ${floodN}; most in ${top(flood, 3)
        .map(([s, n]) => `${s} (${n})`)
        .join(", ")}.`,
    );
  const wet = rain.sort((a, b) => b.v - a.v).slice(0, 2);
  if (wet.length)
    out.push(
      `Heaviest rain totals reported: ${wet.map((s) => `${s.v}" near ${s.where} (${day(s.when)})`).join("; ")}.`,
    );
  if (gust)
    out.push(
      `Strongest non-thunderstorm wind gust: ${gust.v} mph near ${gust.where} (${day(gust.when)}).`,
    );
  return out;
}

/** Big-city airports for temperatures (ACIS station ids), spread across the lower 48. */
export const CITIES: [string, string][] = [
  ["NYC", "New York"],
  ["BOS", "Boston"],
  ["PHL", "Philadelphia"],
  ["DCA", "Washington"],
  ["BUF", "Buffalo"],
  ["PIT", "Pittsburgh"],
  ["BTV", "Burlington, VT"],
  ["PWM", "Portland, ME"],
  ["ATL", "Atlanta"],
  ["MIA", "Miami"],
  ["TPA", "Tampa"],
  ["JAX", "Jacksonville"],
  ["CLT", "Charlotte"],
  ["RDU", "Raleigh"],
  ["CHS", "Charleston, SC"],
  ["BNA", "Nashville"],
  ["MEM", "Memphis"],
  ["BHM", "Birmingham"],
  ["MSY", "New Orleans"],
  ["LIT", "Little Rock"],
  ["IAH", "Houston"],
  ["DFW", "Dallas"],
  ["SAT", "San Antonio"],
  ["ELP", "El Paso"],
  ["OKC", "Oklahoma City"],
  ["ICT", "Wichita"],
  ["MCI", "Kansas City"],
  ["STL", "St. Louis"],
  ["ORD", "Chicago"],
  ["DTW", "Detroit"],
  ["CLE", "Cleveland"],
  ["CMH", "Columbus"],
  ["CVG", "Cincinnati"],
  ["IND", "Indianapolis"],
  ["MSP", "Minneapolis"],
  ["MKE", "Milwaukee"],
  ["DSM", "Des Moines"],
  ["OMA", "Omaha"],
  ["FAR", "Fargo"],
  ["BIS", "Bismarck"],
  ["FSD", "Sioux Falls"],
  ["DEN", "Denver"],
  ["SLC", "Salt Lake City"],
  ["BOI", "Boise"],
  ["BIL", "Billings"],
  ["PHX", "Phoenix"],
  ["TUS", "Tucson"],
  ["ABQ", "Albuquerque"],
  ["LAS", "Las Vegas"],
  ["LAX", "Los Angeles"],
  ["SAN", "San Diego"],
  ["SFO", "San Francisco"],
  ["SAC", "Sacramento"],
  ["PDX", "Portland, OR"],
  ["SEA", "Seattle"],
];

/** Fact lines on temperatures between two dates (YYYY-MM-DD), or [] if ACIS doesn't answer. */
export async function tempFacts(from: string, to: string): Promise<string[]> {
  const r = await fetch("https://data.rcc-acis.org/MultiStnData", {
    method: "POST",
    headers: { ...UA, "Content-Type": "application/json" },
    body: JSON.stringify({
      sids: CITIES.map((c) => c[0]).join(","),
      sdate: from,
      edate: to,
      elems: [
        { name: "avgt", interval: "dly", normal: "departure" },
        { name: "maxt" },
        { name: "mint" },
      ],
    }),
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(14000),
  }).catch(() => null);
  if (!r?.ok) return [];
  const j = (await r.json().catch(() => null)) as {
    data?: { meta: { sids: string[] }; data: string[][] }[];
  } | null;
  if (!j?.data?.length) return [];
  const name = (sids: string[]) => {
    const ids = sids.map((x) => x.split(" ")[0]);
    return CITIES.find((c) => ids.includes(c[0]))?.[1] ?? ids[0];
  };
  const dates: string[] = [];
  for (
    let t = Date.parse(`${from}T12:00:00Z`);
    t <= Date.parse(`${to}T12:00:00Z`);
    t += 864e5
  )
    dates.push(new Date(t).toISOString().slice(0, 10));
  const num = (v: string) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : null);
  const per: { city: string; dep: number }[] = [];
  let hot: { v: number; city: string; d: string } | null = null;
  let cold: { v: number; city: string; d: string } | null = null;
  let all = 0;
  let n = 0;
  for (const s of j.data) {
    const city = name(s.meta.sids);
    const deps: number[] = [];
    s.data.forEach((row, i) => {
      const dep = num(row[0]);
      const hi = num(row[1]);
      const lo = num(row[2]);
      if (dep != null) deps.push(dep);
      if (hi != null && (!hot || hi > hot.v))
        hot = { v: hi, city, d: dates[i] };
      if (lo != null && (!cold || lo < cold.v))
        cold = { v: lo, city, d: dates[i] };
    });
    if (deps.length) {
      const m = deps.reduce((a, b) => a + b, 0) / deps.length;
      per.push({ city, dep: m });
      all += m;
      n++;
    }
  }
  if (!n) return [];
  const avg = all / n;
  const warm = [...per].sort((a, b) => b.dep - a.dep).slice(0, 3);
  const cool = [...per].sort((a, b) => a.dep - b.dep).slice(0, 3);
  const above = per.filter((p) => p.dep > 0.5).length;
  const below = per.filter((p) => p.dep < -0.5).length;
  const f = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°F`;
  const fmt = (d: string) => day(`${d}T18:00:00Z`);
  const out = [
    `Temperatures at ${n} big-city airports averaged ${f(avg)} against normal; ${above} ran warmer than normal and ${below} colder.`,
    `Furthest above normal: ${warm.map((p) => `${p.city} ${f(p.dep)}`).join(", ")}. Furthest below normal: ${cool.map((p) => `${p.city} ${f(p.dep)}`).join(", ")}.`,
  ];
  const h = hot as { v: number; city: string; d: string } | null;
  const c = cold as { v: number; city: string; d: string } | null;
  if (h && c)
    out.push(
      `Hottest reading: ${h.v}°F at ${h.city} (${fmt(h.d)}). Coldest reading: ${c.v}°F at ${c.city} (${fmt(c.d)}).`,
    );
  return out;
}

/** The year so far: NCEI's national monthly temperature and precipitation against 1991–2020. */
export async function nationalYear(year: number): Promise<string[]> {
  const get = async (el: "tavg" | "pcp", span: string) => {
    const r = await fetch(
      `https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/national/time-series/110/${el}/1/0/${span}/data.json`,
      {
        headers: UA,
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(12000),
      },
    ).catch(() => null);
    const j = r?.ok
      ? ((await r.json().catch(() => null)) as {
          data?: Record<string, { value: number }>;
        } | null)
      : null;
    return j?.data ?? null;
  };
  const [t, tn, p, pn] = await Promise.all([
    get("tavg", `${year}-${year}`),
    get("tavg", "1991-2020"),
    get("pcp", `${year}-${year}`),
    get("pcp", "1991-2020"),
  ]);
  if (!t || !tn) return [];
  const normal = (data: Record<string, { value: number }>, m: string) => {
    const v = Object.entries(data)
      .filter(([k]) => k.endsWith(m))
      .map(([, x]) => x.value);
    return v.reduce((a, b) => a + b, 0) / (v.length || 1);
  };
  const MONTHS = [
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
  const rows = Object.entries(t)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      const m = k.slice(4);
      const tAn = v.value - normal(tn, m);
      const pAn =
        p?.[k] && pn ? (p[k].value / (normal(pn, m) || 1)) * 100 : null;
      return { m: MONTHS[Number(m) - 1], tAn, pAn };
    });
  if (!rows.length) return [];
  const ytd = rows.reduce((a, r) => a + r.tAn, 0) / rows.length;
  const warm = [...rows].sort((a, b) => b.tAn - a.tAn)[0];
  const cool = [...rows].sort((a, b) => a.tAn - b.tAn)[0];
  const wet = rows
    .filter((r) => r.pAn != null)
    .sort((a, b) => b.pAn! - a.pAn!)[0];
  const dry = rows
    .filter((r) => r.pAn != null)
    .sort((a, b) => a.pAn! - b.pAn!)[0];
  const f = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°F`;
  return [
    `NOAA's lower-48 average temperature by month (against the 1991–2020 normal): ${rows.map((r) => `${r.m} ${f(r.tAn)}`).join(", ")}. Year to date ${f(ytd)}.`,
    `Warmest month against normal: ${warm.m} (${f(warm.tAn)}); coolest: ${cool.m} (${f(cool.tAn)}).${wet && dry ? ` Wettest month: ${wet.m} (${Math.round(wet.pAn!)}% of normal precipitation); driest: ${dry.m} (${Math.round(dry.pAn!)}%).` : ""}`,
  ];
}
