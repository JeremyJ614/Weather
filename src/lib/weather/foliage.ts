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
];
export type FallReport = {
  season: string;
  current: boolean;
  start: string;
  end: string;
  species: string[];
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
};

export function toReport(
  rows: Row[],
  season: ReturnType<typeof fallSeason>,
): FallReport {
  const species: string[] = [];
  const index = new Map<string, number>();
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
    sites.push([
      Math.round(r.longitude * 1000) / 1000,
      Math.round(r.latitude * 1000) / 1000,
      Date.UTC(year, 0, doy),
      index.get(name)!,
      Number(r.phenophase_id) === 499 ? 1 : 0,
    ]);
  }
  sites.sort((a, b) => a[2] - b[2]);
  return {
    season: season.label,
    current: season.current,
    start: season.start,
    end: season.end,
    species,
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
