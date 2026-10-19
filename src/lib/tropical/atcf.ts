/**
 * NHC ATCF decks for Model Tracks: every model's newest forecast track (a-deck)
 * and how far each model's past forecasts landed from where the storm actually went
 * (b-deck best track). Pure functions; fetching lives in the API route.
 */
export type Model = { tech: string; name: string; color: string; note: string };

/** The roster: NHC's official forecast, the big global and hurricane models, Google's AI. */
export const ROSTER: Model[] = [
  {
    tech: "OFCL",
    name: "NHC Official",
    color: "#ffffff",
    note: "The NHC forecast itself",
  },
  {
    tech: "GDMN",
    name: "Google DeepMind",
    color: "#4cc9f0",
    note: "AI ensemble mean (Weather Lab)",
  },
  { tech: "AVNO", name: "GFS", color: "#f97316", note: "NOAA global model" },
  {
    tech: "HFSA",
    name: "HAFS-A",
    color: "#e5484d",
    note: "NOAA hurricane model",
  },
  {
    tech: "HFSB",
    name: "HAFS-B",
    color: "#f472b6",
    note: "NOAA hurricane model",
  },
  {
    tech: "HMON",
    name: "HMON",
    color: "#c084fc",
    note: "NOAA hurricane model",
  },
  {
    tech: "CTCX",
    name: "COAMPS-TC",
    color: "#a3e635",
    note: "Navy hurricane model",
  },
  {
    tech: "UKX",
    name: "UKMET",
    color: "#22d3ee",
    note: "UK Met Office global",
  },
  {
    tech: "CMC",
    name: "Canadian",
    color: "#fb7185",
    note: "Environment Canada global",
  },
  { tech: "NVGM", name: "NAVGEM", color: "#94a3b8", note: "Navy global model" },
  {
    tech: "AEMN",
    name: "GEFS mean",
    color: "#fbbf24",
    note: "GFS ensemble average",
  },
  {
    tech: "TVCN",
    name: "Consensus",
    color: "#6ee7a8",
    note: "Average of top models",
  },
  {
    tech: "TABM",
    name: "Beta & Advection",
    color: "#a8a29e",
    note: "Simple steering model",
  },
  {
    tech: "CLP5",
    name: "CLIPER",
    color: "#78716c",
    note: "Climatology baseline: the bar to beat",
  },
];
const TECHS = new Set(ROSTER.map((m) => m.tech));
export const LEADS = [24, 48, 72, 120] as const;

export type Row = {
  tech: string;
  dtg: string;
  tau: number;
  lat: number;
  lon: number;
  kt: number;
};
export type Best = { dtg: string; lat: number; lon: number; kt: number };

/** "121N" → 12.1, "960W" → -96.0. */
export function coord(s: string): number | null {
  const m = /^(\d+)([NSEW])$/.exec(s.trim());
  if (!m) return null;
  const v = Number(m[1]) / 10;
  return m[2] === "S" || m[2] === "W" ? -v : v;
}

/** Roster rows from an a-deck (one per model, cycle and forecast hour; wind-radii repeats dropped). */
export function parseA(text: string): Row[] {
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const line of text.split("\n")) {
    const c = line.split(",").map((x) => x.trim());
    if (c.length < 9 || !TECHS.has(c[4])) continue;
    const key = `${c[4]}|${c[2]}|${c[5]}`;
    if (seen.has(key)) continue;
    const lat = coord(c[6]);
    const lon = coord(c[7]);
    if (lat == null || lon == null) continue;
    seen.add(key);
    out.push({
      tech: c[4],
      dtg: c[2],
      tau: Number(c[5]),
      lat,
      lon,
      kt: Number(c[8]) || 0,
    });
  }
  return out;
}

export function parseB(text: string): Map<string, Best> {
  const out = new Map<string, Best>();
  for (const line of text.split("\n")) {
    const c = line.split(",").map((x) => x.trim());
    if (c.length < 9 || c[4] !== "BEST" || out.has(c[2])) continue;
    const lat = coord(c[6]);
    const lon = coord(c[7]);
    if (lat != null && lon != null)
      out.set(c[2], { dtg: c[2], lat, lon, kt: Number(c[8]) || 0 });
  }
  return out;
}

/** Great-circle distance in nautical miles. */
export function nm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "2026101400" plus hours → "2026101500". */
export function addHours(dtg: string, h: number): string {
  const d = new Date(
    Date.UTC(
      +dtg.slice(0, 4),
      +dtg.slice(4, 6) - 1,
      +dtg.slice(6, 8),
      +dtg.slice(8, 10) + h,
    ),
  );
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}`;
}

export type Score = {
  tech: string;
  /** Mean track error (nm) by lead time, with sample counts. */
  track: Record<number, { err: number; n: number } | null>;
  /** Mean absolute wind error (kt) at 48 h. */
  wind48: number | null;
  /** Cycles where this model had the smallest 48-hour error of the roster. */
  wins: number;
};

/** Scores every roster model's verified forecasts against the best track. */
export function battle(rows: Row[], best: Map<string, Best>): Score[] {
  const by = new Map<string, Row>();
  for (const r of rows) by.set(`${r.tech}|${r.dtg}|${r.tau}`, r);
  const err = (r: Row) => {
    const b = best.get(addHours(r.dtg, r.tau));
    return b ? { d: nm(r, b), w: Math.abs(r.kt - b.kt) } : null;
  };
  const scores: Score[] = ROSTER.map((m) => {
    const track: Score["track"] = {};
    for (const lead of LEADS) {
      const e = rows
        .filter((r) => r.tech === m.tech && r.tau === lead)
        .map(err)
        .filter((x) => x != null);
      track[lead] = e.length
        ? { err: e.reduce((a, x) => a + x.d, 0) / e.length, n: e.length }
        : null;
    }
    const w = rows
      .filter((r) => r.tech === m.tech && r.tau === 48 && r.kt > 0)
      .map(err)
      .filter((x) => x != null);
    return {
      tech: m.tech,
      track,
      wind48: w.length ? w.reduce((a, x) => a + x.w, 0) / w.length : null,
      wins: 0,
    };
  });
  // Head to head: each cycle's 48-hour forecasts that can be verified.
  const cycles = new Set(rows.filter((r) => r.tau === 48).map((r) => r.dtg));
  for (const dtg of cycles) {
    let top: { tech: string; d: number } | null = null;
    for (const m of ROSTER) {
      const r = by.get(`${m.tech}|${dtg}|48`);
      const e = r && err(r);
      if (e && (!top || e.d < top.d)) top = { tech: m.tech, d: e.d };
    }
    if (top) scores.find((s) => s.tech === top.tech)!.wins++;
  }
  return scores;
}

/** Ranked by 48-hour error (then 24-hour) among models with at least 2 verified forecasts. */
export function rank(scores: Score[]): Score[] {
  const key = (s: Score) => {
    const t =
      s.track[48] && s.track[48].n >= 2
        ? s.track[48]
        : s.track[24] && s.track[24].n >= 2
          ? s.track[24]
          : null;
    return t ? (t === s.track[48] ? t.err : 1e4 + t.err) : Infinity;
  };
  return [...scores].sort((a, b) => key(a) - key(b));
}

/** Each roster model's newest forecast track. */
export function latestTracks(rows: Row[]): {
  tech: string;
  dtg: string;
  points: { tau: number; lat: number; lon: number; kt: number }[];
}[] {
  return ROSTER.flatMap((m) => {
    const mine = rows.filter((r) => r.tech === m.tech);
    if (!mine.length) return [];
    const dtg = mine.reduce((a, r) => (r.dtg > a ? r.dtg : a), "");
    const points = mine
      .filter((r) => r.dtg === dtg)
      .sort((a, b) => a.tau - b.tau);
    return points.length > 1
      ? [
          {
            tech: m.tech,
            dtg,
            points: points.map(({ tau, lat, lon, kt }) => ({
              tau,
              lat,
              lon,
              kt,
            })),
          },
        ]
      : [];
  });
}

export type Run = {
  dtg: string;
  points: { tau: number; lat: number; lon: number; kt: number }[];
};

/** Google DeepMind next to NHC: its last runs, both newest forecasts and how far apart they are. */
export function aiView(rows: Row[], best: Map<string, Best>, ai = "GDMN") {
  const runsOf = (tech: string) => {
    const by = new Map<string, Run["points"]>();
    for (const r of rows.filter((x) => x.tech === tech))
      by.set(r.dtg, [
        ...(by.get(r.dtg) ?? []),
        { tau: r.tau, lat: r.lat, lon: r.lon, kt: r.kt },
      ]);
    return [...by]
      .map(([dtg, points]) => ({
        dtg,
        points: points.sort((a, b) => a.tau - b.tau),
      }))
      .filter((r) => r.points.length > 1)
      .sort((a, b) => a.dtg.localeCompare(b.dtg));
  };
  const runs = runsOf(ai).slice(-4);
  const ofcl = runsOf("OFCL").at(-1) ?? null;
  const latest = runs.at(-1) ?? null;
  const gap =
    latest && ofcl
      ? latest.points.flatMap((p) => {
          // Compare at the same valid time (runs may start at different cycles).
          const valid = addHours(latest.dtg, p.tau);
          const o = ofcl.points.find(
            (q) => addHours(ofcl.dtg, q.tau) === valid,
          );
          return o ? [{ tau: p.tau, nm: nm(p, o), ai: p.kt, nhc: o.kt }] : [];
        })
      : [];
  const ranked = rank(battle(rows, best));
  return {
    runs,
    ofcl,
    gap,
    place: ranked.findIndex((s) => s.tech === ai) + 1,
    of: ranked.filter((s) => s.track[24] || s.track[48]).length,
    ai: ranked.find((s) => s.tech === ai) ?? null,
    nhc: ranked.find((s) => s.tech === "OFCL") ?? null,
  };
}
