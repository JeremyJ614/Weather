/**
 * Fall color from the USA National Phenology Network: every site's first colored leaves or
 * needles this season. There is no public peak-foliage forecast, and state averages mislead
 * (they reflect which species volunteers watch), so each report stays a dot with its date.
 * Ported from the VIP app (src/lib/foliage.ts), which documents both rejected approaches.
 */
const NPN =
  "https://services.usanpn.org/npn_portal/observations/getSiteLevelData.json";
const DAY = 86_400_000;

export type FallSite = [
  lon: number,
  lat: number,
  dateMs: number,
  species: number,
  needles: 0 | 1,
  /** Index into `states` (-1 when the network gave none). */
  state?: number,
  /** The last day the color was still seen (0 when not yet recorded). */
  lastMs?: number,
  /** Meters above sea level (-1 when unknown). */
  elev?: number,
];
export type FallReport = {
  season: string;
  current: boolean;
  start: string;
  end: string;
  species: string[];
  /** Two-letter state or province codes. */
  states?: string[];
  sites: FallSite[];
};

/** Aug–Feb: the season in progress. Mar–Jul: last fall, labeled as such. */
export function fallSeason(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = now.toISOString().slice(0, 10);
  if (m >= 7)
    return { start: `${y}-08-01`, end: today, current: true, label: `${y}` };
  if (m <= 1)
    return {
      start: `${y - 1}-08-01`,
      end: today,
      current: true,
      label: `${y - 1}`,
    };
  return {
    start: `${y - 1}-08-01`,
    end: `${y - 1}-12-31`,
    current: false,
    label: `${y - 1}`,
  };
}

type Row = {
  latitude: number;
  longitude: number;
  common_name: string;
  phenophase_id: number;
  mean_first_yes_year: number;
  mean_first_yes_doy: number;
  state?: string;
  elevation_in_meters?: number;
  mean_last_yes_year?: number;
  mean_last_yes_doy?: number;
};

export function toReport(
  rows: Row[],
  season: ReturnType<typeof fallSeason>,
): FallReport {
  const species: string[] = [];
  const index = new Map<string, number>();
  const states: string[] = [];
  const stIndex = new Map<string, number>();
  const sites: FallSite[] = [];
  for (const r of rows) {
    const doy = Number(r.mean_first_yes_doy);
    const year = Number(r.mean_first_yes_year);
    if (
      !(doy > 0) ||
      !(year > 0) ||
      !Number.isFinite(r.latitude) ||
      !Number.isFinite(r.longitude)
    )
      continue;
    const name = r.common_name || "unidentified";
    if (!index.has(name)) {
      index.set(name, species.length);
      species.push(name);
    }
    const code = /^[A-Z]{2}$/.test(r.state ?? "") ? r.state! : "";
    if (code && !stIndex.has(code)) {
      stIndex.set(code, states.length);
      states.push(code);
    }
    const ly = Number(r.mean_last_yes_year);
    const ld = Number(r.mean_last_yes_doy);
    const first = Date.UTC(year, 0, doy);
    const last = ly > 0 && ld > 0 ? Date.UTC(ly, 0, ld) : 0;
    const el = Number(r.elevation_in_meters);
    sites.push([
      Math.round(r.longitude * 1000) / 1000,
      Math.round(r.latitude * 1000) / 1000,
      first,
      index.get(name)!,
      Number(r.phenophase_id) === 499 ? 1 : 0,
      code ? stIndex.get(code)! : -1,
      last >= first ? last : 0,
      Number.isFinite(el) && el > -500 ? Math.round(el) : -1,
    ]);
  }
  sites.sort((a, b) => a[2] - b[2]);
  return {
    season: season.label,
    current: season.current,
    start: season.start,
    end: season.end,
    species,
    states,
    sites,
  };
}

export async function getFallReport(
  now = new Date(),
): Promise<FallReport | null> {
  const s = fallSeason(now);
  const url = `${NPN}?start_date=${s.start}&end_date=${s.end}&request_src=sswx&phenophase_id%5B0%5D=498&phenophase_id%5B1%5D=499`;
  try {
    const r = await fetch(url, {
      next: { revalidate: 6 * 3600 },
      signal: AbortSignal.timeout(20000),
    });
    return r.ok ? toReport((await r.json()) as Row[], s) : null;
  } catch {
    return null;
  }
}

/** Scrubber stops every 3 days through the season, ending on its last day. */
export function timeline(start: string, end: string): number[] {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  const out: number[] = [];
  for (let t = a; t <= b; t += 3 * DAY) out.push(t);
  if (out.at(-1) !== b) out.push(b);
  return out;
}

/** Onset age to a leaf color: yellow-green when fresh, deep red after six weeks. */
export function leafColor(daysAgo: number): string {
  const t = Math.max(0, Math.min(1, daysAgo / 42));
  // Comma syntax: the map libraries do not parse the space-separated CSS form.
  return `hsl(${(74 - t * 66).toFixed(0)}, ${(62 + t * 26).toFixed(0)}%, ${(58 - t * 16).toFixed(0)}%)`;
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const a = [...xs].sort((p, q) => p - q);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export type Group = { name: string; n: number; onset: number };
export type SeasonStats = {
  total: number;
  recent: number;
  needles: number;
  first: { t: number; species: string; state: string } | null;
  newest: { t: number; species: string; state: string } | null;
  /** Reports per week (week starts), and the busiest one. */
  weeks: { t: number; n: number; lat: number }[];
  peak: { t: number; n: number } | null;
  /** North (42°N and up), middle and south (below 36°N). */
  bands: (Group & { from: number; to: number })[];
  states: Group[];
  species: (Group & { days: number })[];
  /** Median days a plant kept its color, where the network saw it end. */
  lasts: number;
  /** Median onset, mountains (1,000 m and up) and lowlands (under 300 m). */
  high: Group | null;
  low: Group | null;
};

/**
 * The season in numbers as of `asOf`: counts, the busiest week, how the color front (the
 * median latitude of each week's new reports) moved, bands, states, species and how long the
 * color lasted. Groups need 3 reports to count.
 */
export function seasonStats(r: FallReport, asOf: number): SeasonStats {
  const shown = r.sites.filter((x) => x[2] <= asOf);
  const name = (x: FallSite) => r.species[x[3]] ?? "unidentified";
  const st = (x: FallSite) => r.states?.[x[5] ?? -1] ?? "";
  const pick = (x?: FallSite) =>
    x ? { t: x[2], species: name(x), state: st(x) } : null;
  const start = Date.parse(`${r.start}T00:00:00Z`);
  const weeks: SeasonStats["weeks"] = [];
  for (let t = start; t <= asOf; t += 7 * DAY) {
    const inWeek = shown.filter((x) => x[2] >= t && x[2] < t + 7 * DAY);
    weeks.push({
      t,
      n: inWeek.length,
      lat: median(inWeek.map((x) => x[1])),
    });
  }
  const peak = weeks.reduce<SeasonStats["peak"]>(
    (b, w) => (w.n > (b?.n ?? 0) ? { t: w.t, n: w.n } : b),
    null,
  );
  const group = (list: FallSite[], key: (x: FallSite) => string) => {
    const m = new Map<string, FallSite[]>();
    for (const x of list) {
      const k = key(x);
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return [...m.entries()]
      .filter(([, v]) => v.length >= 3)
      .map(([k, v]) => ({
        name: k,
        n: v.length,
        onset: median(v.map((x) => x[2])),
        days: median(
          v.filter((x) => (x[6] ?? 0) > x[2]).map((x) => (x[6]! - x[2]) / DAY),
        ),
      }));
  };
  const bands = (
    [
      ["North", 42, 90],
      ["Middle", 36, 42],
      ["South", 0, 36],
    ] as const
  ).map(([n, from, to]) => {
    const v = shown.filter((x) => x[1] >= from && x[1] < to);
    return {
      name: n,
      n: v.length,
      onset: median(v.map((x) => x[2])),
      from,
      to,
    };
  });
  const durations = shown
    .filter((x) => (x[6] ?? 0) > x[2])
    .map((x) => (x[6]! - x[2]) / DAY);
  const elevGroup = (f: (e: number) => boolean, n: string): Group | null => {
    const v = shown.filter((x) => (x[7] ?? -1) >= 0 && f(x[7]!));
    return v.length >= 3
      ? { name: n, n: v.length, onset: median(v.map((x) => x[2])) }
      : null;
  };
  return {
    total: shown.length,
    recent: shown.filter((x) => asOf - x[2] <= 14 * DAY).length,
    needles: shown.filter((x) => x[4] === 1).length,
    first: pick(shown[0]),
    newest: pick(shown.at(-1)),
    weeks,
    peak,
    bands,
    states: group(shown, st).map(({ name: n, n: c, onset }) => ({
      name: n,
      n: c,
      onset,
    })),
    species: group(shown, name).sort((a, b) => b.n - a.n),
    lasts: median(durations),
    high: elevGroup((e) => e >= 1000, "Mountains"),
    low: elevGroup((e) => e < 300, "Lowlands"),
  };
}
