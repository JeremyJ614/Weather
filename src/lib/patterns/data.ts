import "server-only";
import { inside, spcFeatures } from "@/lib/colors/spc-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { efRank, surveysBetween, type Survey } from "./surveys";

/**
 * Weather Patterns data. Every number is counted from SPC's own daily storm-report files
 * (one small CSV per day; past days never change, so each is cached for a month) or read
 * off SPC's outlook polygons. The AI only phrases the period summaries from those counts.
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };

export type DayReports = {
  day: string;
  torn: number;
  hail: number;
  wind: number;
  /** Largest hail (inches) and strongest measured gust (mph), with where. */
  bigHail: { in: number; where: string } | null;
  bigGust: { mph: number; where: string } | null;
  states: Record<string, number>;
  /** Tornado reports by state (the season's "top tornado state"). */
  tornStates: Record<string, number>;
  /** Tornadoes the NWS has surveyed that day, and the strongest of them. */
  surveyed: number;
  strongest: { ef: string; where: string } | null;
};

/** One SPC filtered report CSV (three sections: tornado, wind, hail) → counts. */
export function parseReports(day: string, csv: string): DayReports {
  const out: DayReports = {
    day,
    torn: 0,
    hail: 0,
    wind: 0,
    bigHail: null,
    bigGust: null,
    states: {},
    tornStates: {},
    surveyed: 0,
    strongest: null,
  };
  let kind: "torn" | "wind" | "hail" | null = null;
  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith("Time,F_Scale")) kind = "torn";
    else if (line.startsWith("Time,Speed")) kind = "wind";
    else if (line.startsWith("Time,Size")) kind = "hail";
    else if (kind) {
      const c = line.split(",");
      if (c.length < 7) continue;
      out[kind]++;
      const st = c[4];
      if (/^[A-Z]{2}$/.test(st)) {
        out.states[st] = (out.states[st] ?? 0) + 1;
        if (kind === "torn") out.tornStates[st] = (out.tornStates[st] ?? 0) + 1;
      }
      const where = `${c[2]}, ${st}`;
      if (kind === "hail") {
        const inch = Number(c[1]) / 100;
        if (inch && inch > (out.bigHail?.in ?? 0))
          out.bigHail = { in: inch, where };
      }
      if (kind === "wind") {
        const mph = Number(c[1]);
        if (mph && mph > (out.bigGust?.mph ?? 0)) out.bigGust = { mph, where };
      }
    }
  }
  return out;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Folds the NWS surveys into SPC's day: a tornado confirmed only by a later survey counts
 * (whichever count is higher, state by state), and the strongest rating is kept.
 */
export function withSurvey(d: DayReports, s: Survey | undefined): DayReports {
  if (!s?.n) return d;
  const tornStates = { ...d.tornStates };
  const states = { ...d.states };
  for (const [st, n] of Object.entries(s.states)) {
    const extra = n - (tornStates[st] ?? 0);
    if (extra <= 0) continue;
    tornStates[st] = n;
    states[st] = (states[st] ?? 0) + extra;
  }
  return {
    ...d,
    torn: Math.max(d.torn, s.n),
    tornStates,
    states,
    surveyed: s.n,
    strongest: { ef: s.top, where: s.where },
  };
}

async function surveyed(list: DayReports[]) {
  if (!list.length) return list;
  const map = await surveysBetween(list[0].day, list.at(-1)!.day);
  return list.map((d) => withSurvey(d, map.get(d.day)));
}
export async function reportsFor(day: string): Promise<DayReports | null> {
  const age = (Date.now() - Date.parse(`${day}T12:00:00Z`)) / 86400_000;
  try {
    const r = await fetch(
      `https://www.spc.noaa.gov/climo/reports/${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}_rpts_filtered.csv`,
      {
        headers: UA,
        next: { revalidate: age > 4 ? 2592000 : 3600 },
        signal: AbortSignal.timeout(12000),
      },
    );
    return r.ok ? parseReports(day, await r.text()) : null;
  } catch {
    return null;
  }
}

/** SPC report days from `from` up to yesterday (UTC convective days), fetched 24 at a time. */
export async function reportDays(n: number): Promise<DayReports[]> {
  const days: string[] = [];
  for (let i = n; i >= 1; i--)
    days.push(ymd(new Date(Date.now() - i * 86400_000)));
  const out: (DayReports | null)[] = new Array(days.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: 24 }, async () => {
      while (next < days.length) {
        const k = next++;
        out[k] = await reportsFor(days[k]);
      }
    }),
  );
  return surveyed(out.filter((d): d is DayReports => !!d));
}

/** The forecast desk's recap of a period, in our own friendly voice. */
export type Recap = {
  headline: string;
  story: string;
  highlights: string[];
};

export type Period = {
  id: "yesterday" | "week" | "month" | "year";
  label: string;
  /** First and last report day covered (UTC convective days). */
  from: string | null;
  to: string | null;
  days: number;
  torn: number;
  hail: number;
  wind: number;
  busiest: { day: string; total: number } | null;
  bigHail: { in: number; where: string; day: string } | null;
  bigGust: { mph: number; where: string; day: string } | null;
  topStates: [string, number][];
  tornadoDays: number;
  /** NWS-surveyed tornadoes in the period and the strongest one. */
  surveyed: number;
  strongest: { ef: string; where: string; day: string } | null;
  series: { day: string; torn: number; hail: number; wind: number }[];
  summary: Recap | null;
};

export const PERIODS = [
  { id: "yesterday", label: "Yesterday", days: 1 },
  { id: "week", label: "Past week", days: 7 },
  { id: "month", label: "Past month", days: 30 },
  // Year to date: from January 1 of the last complete day's year, starting over each January.
  { id: "year", label: "This year", days: 0 },
] as const;

/** How many days a period covers, ending yesterday (UTC); "year" counts from January 1. */
export function spanDays(p: (typeof PERIODS)[number], now = Date.now()) {
  if (p.id !== "year") return p.days;
  const y = new Date(now - 86400_000);
  const jan1 = Date.UTC(y.getUTCFullYear(), 0, 1);
  return (
    Math.round(
      (Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate()) - jan1) /
        86400_000,
    ) + 1
  );
}

export function aggregate(
  p: (typeof PERIODS)[number],
  list: DayReports[],
): Omit<Period, "summary"> {
  const states: Record<string, number> = {};
  let busiest: Period["busiest"] = null;
  let bigHail: Period["bigHail"] = null;
  let bigGust: Period["bigGust"] = null;
  let strongest: Period["strongest"] = null;
  for (const d of list) {
    if (
      d.strongest &&
      (!strongest || efRank(d.strongest.ef) > efRank(strongest.ef))
    )
      strongest = { ...d.strongest, day: d.day };
    const total = d.torn + d.hail + d.wind;
    if (!busiest || total > busiest.total) busiest = { day: d.day, total };
    if (d.bigHail && d.bigHail.in > (bigHail?.in ?? 0))
      bigHail = { ...d.bigHail, day: d.day };
    if (d.bigGust && d.bigGust.mph > (bigGust?.mph ?? 0))
      bigGust = { ...d.bigGust, day: d.day };
    for (const [k, v] of Object.entries(d.states))
      states[k] = (states[k] ?? 0) + v;
  }
  return {
    id: p.id,
    label: p.label,
    from: list[0]?.day ?? null,
    to: list.at(-1)?.day ?? null,
    days: list.length,
    torn: list.reduce((a, d) => a + d.torn, 0),
    hail: list.reduce((a, d) => a + d.hail, 0),
    wind: list.reduce((a, d) => a + d.wind, 0),
    busiest: busiest && busiest.total ? busiest : null,
    bigHail,
    bigGust,
    topStates: Object.entries(states)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    tornadoDays: list.filter((d) => d.torn > 0).length,
    surveyed: list.reduce((a, d) => a + (d.surveyed ?? 0), 0),
    strongest,
    series: list.map(({ day, torn, hail, wind }) => ({
      day,
      torn,
      hail,
      wind,
    })),
  };
}

type LedgerRow = {
  day: string;
  torn: number;
  hail: number;
  wind: number;
  states: Record<string, number>;
  torn_states: Record<string, number>;
  big_hail: DayReports["bigHail"];
  big_gust: DayReports["bigGust"];
  surveyed: number;
  strongest: DayReports["strongest"];
};
const fromRow = (r: LedgerRow): DayReports => ({
  day: r.day,
  torn: r.torn,
  hail: r.hail,
  wind: r.wind,
  states: r.states ?? {},
  tornStates: r.torn_states ?? {},
  bigHail: r.big_hail,
  bigGust: r.big_gust,
  surveyed: r.surveyed ?? 0,
  strongest: r.strongest ?? null,
});

/** Ledger days from `since` through yesterday, oldest first. */
export async function ledgerSince(since: string): Promise<DayReports[]> {
  const { data, error } = await supabaseAdmin()
    .from("report_days")
    .select(
      "day, torn, hail, wind, states, torn_states, big_hail, big_gust, surveyed, strongest",
    )
    .gte("day", since)
    .lt("day", ymd(new Date()))
    .order("day")
    .limit(1200);
  if (error) throw new Error(error.message);
  return (data as LedgerRow[]).map(fromRow);
}

/**
 * Brings the ledger up to date: the last 45 days again (SPC revises recent reports, and NWS
 * surveys keep arriving for weeks) and any day missing from the past 400. A first run fills
 * the whole year in one pass.
 */
export async function syncLedger() {
  const db = supabaseAdmin();
  const start = ymd(new Date(Date.now() - 400 * 86400_000));
  const { data } = await db.from("report_days").select("day").gte("day", start);
  const have = new Set((data ?? []).map((r: { day: string }) => r.day));
  const todo: string[] = [];
  for (let i = 400; i >= 1; i--) {
    const d = ymd(new Date(Date.now() - i * 86400_000));
    if (i <= 45 || !have.has(d)) todo.push(d);
  }
  const days: DayReports[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      while (next < todo.length) {
        const r = await reportsFor(todo[next++]);
        if (r) days.push(r);
      }
    }),
  );
  days.sort((a, b) => a.day.localeCompare(b.day));
  const rows: LedgerRow[] = (await surveyed(days)).map((r) => ({
    day: r.day,
    torn: r.torn,
    hail: r.hail,
    wind: r.wind,
    states: r.states,
    torn_states: r.tornStates,
    big_hail: r.bigHail,
    big_gust: r.bigGust,
    surveyed: r.surveyed,
    strongest: r.strongest,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db
      .from("report_days")
      .upsert(
        rows
          .slice(i, i + 200)
          .map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      );
    if (error) throw new Error(error.message);
  }
  return { checked: todo.length, saved: rows.length };
}

/** A period's numbers from the ledger (or SPC directly while the ledger fills). */
async function periodDays(p: (typeof PERIODS)[number]) {
  const n = spanDays(p);
  const since = ymd(new Date(Date.now() - n * 86400_000));
  const list = await ledgerSince(since).catch(() => []);
  return list.length >= n * 0.9 ? list : reportDays(n);
}

/** A period with the forecast desk's recap: what the daily job stores, and the fallback. */
export async function buildPeriod(id: Period["id"]): Promise<Period> {
  const p = PERIODS.find((x) => x.id === id)!;
  const a = aggregate(p, await periodDays(p));
  return { ...a, summary: await summarize(a) };
}

const memo = new Map<string, { at: number; v: Promise<Period> }>();
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

/** A period as the page shows it: the stored recap when fresh, else built now. */
export function period(id: Period["id"]): Promise<Period> {
  const key = `${id}:${ymd(new Date())}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 3 * 3600_000) return hit.v;
  const v = cached<Period>(id, 30).then((c) => c ?? buildPeriod(id));
  memo.set(key, { at: Date.now(), v });
  v.catch(() => memo.delete(key));
  return v;
}

/**
 * Every stored recap (public data, read with the anon key so it works anywhere), cached for
 * ten minutes. Entries older than `hours` count as missing.
 */
export async function readCache(hours = 30): Promise<Record<string, unknown>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return {};
  const r = await fetch(
    `${url}/rest/v1/pattern_cache?select=key,value,updated_at`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);
  if (!r?.ok) return {};
  const rows = (await r.json()) as {
    key: string;
    value: unknown;
    updated_at: string;
  }[];
  return Object.fromEntries(
    rows
      .filter((x) => Date.now() - Date.parse(x.updated_at) < hours * 3600_000)
      .map((x) => [x.key, x.value]),
  );
}

/** A pattern_cache entry no older than `hours`. */
export async function cached<T>(key: string, hours: number): Promise<T | null> {
  return ((await readCache(hours))[key] as T | undefined) ?? null;
}

export async function store(key: string, value: unknown) {
  const { error } = await supabaseAdmin()
    .from("pattern_cache")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

async function summarize(a: Omit<Period, "summary">): Promise<Recap | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !a.days) return null;
  // Daily lines for a week or less, weekly for a month, monthly for the year.
  const step = a.id === "year" ? 30 : a.id === "month" ? 7 : 1;
  const chunks: string[] = [];
  for (let i = 0; i < a.series.length; i += step) {
    const c = a.series.slice(i, i + step);
    chunks.push(
      `${fmtDay(c[0].day)}${c.length > 1 ? ` to ${fmtDay(c.at(-1)!.day)}` : ""}: ${c.reduce((s, d) => s + d.torn, 0)} tornado, ${c.reduce((s, d) => s + d.hail, 0)} hail, ${c.reduce((s, d) => s + d.wind, 0)} wind reports`,
    );
  }
  const facts = `Period: ${a.label}, ${a.from ? fmtDay(a.from) : ""} to ${a.to ? fmtDay(a.to) : ""} (${a.days} days of SPC preliminary storm reports).
Totals: ${a.torn} tornado reports, ${a.hail} hail reports, ${a.wind} damaging wind reports; tornado reports on ${a.tornadoDays} days.
Tornadoes confirmed by National Weather Service damage surveys: ${a.surveyed}${a.strongest ? `; strongest rated ${a.strongest.ef}${a.strongest.where ? ` near ${a.strongest.where}` : ""} on ${fmtDay(a.strongest.day)}` : ""}.
Busiest day: ${a.busiest ? `${fmtDay(a.busiest.day)} with ${a.busiest.total} reports` : "none"}.
Largest hail: ${a.bigHail ? `${a.bigHail.in} inches near ${a.bigHail.where} on ${fmtDay(a.bigHail.day)}` : "none"}.
Strongest measured gust: ${a.bigGust ? `${a.bigGust.mph} mph near ${a.bigGust.where} on ${fmtDay(a.bigGust.day)}` : "none"}.
Most reports by state: ${a.topStates.map(([s, n]) => `${s} ${n}`).join(", ") || "none"}.
Breakdown:
${chunks.join("\n")}`;
  const prompt = `You are the SSWX Forecast Desk at StormSync Media, writing for weather fans who follow us. Recap severe weather across the U.S. for this period like a friendly meteorologist talking to their audience: warm, plain, a little personal ("we saw", "it was a busy stretch for..."), never dry or technical, no jargon or abbreviations except state names. Use ONLY the facts given: no invented numbers, places or forecasts. Say when it was busiest and where storms concentrated; if it was quiet, say so kindly. These are preliminary reports (one storm can make several), so prefer words like "reports" over exact storm counts.

Answer with JSON only: {"headline": one short sentence that sums up the period, "story": 3 to 4 sentences, "highlights": 2 to 4 short bullet sentences of the standout moments with dates}.

${facts}`;
  const db = supabaseAdmin();
  for (const model of MODELS) {
    let ok = false;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 700,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const out = res.ok ? await res.json() : null;
      const text: string =
        out?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim() ?? "";
      const r = cleanRecap(text);
      if (r) {
        ok = true;
        return r;
      }
    } catch {
      // overloaded or timed out: try the next model
    } finally {
      await db.rpc("count_ai_call", { p_feature: "patterns", p_ok: ok });
    }
  }
  return null;
}

/** The model's JSON, checked and trimmed; anything else is no recap. */
export function cleanRecap(text: string): Recap | null {
  try {
    const j = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()) as {
      headline?: unknown;
      story?: unknown;
      highlights?: unknown;
    };
    const str = (v: unknown, n: number) =>
      typeof v === "string" ? v.trim().slice(0, n) : "";
    const headline = str(j.headline, 200);
    const story = str(j.story, 900);
    if (!headline || !story) return null;
    const highlights = Array.isArray(j.highlights)
      ? j.highlights
          .map((h) => str(h, 220))
          .filter(Boolean)
          .slice(0, 4)
      : [];
    return { headline, story, highlights };
  } catch {
    return null;
  }
}

/** VIP's regions, sampled on a coarse grid so a long thin risk area still lights one up. */
export const REGIONS = [
  { id: "nw", label: "Northwest", lat: [42, 49], lon: [-124, -111] },
  { id: "sw", label: "Southwest", lat: [31, 42], lon: [-124, -108] },
  { id: "np", label: "Northern Plains", lat: [41, 49], lon: [-111, -95] },
  { id: "sp", label: "Southern Plains", lat: [28, 41], lon: [-108, -94] },
  { id: "mw", label: "Midwest", lat: [37, 49], lon: [-95, -82] },
  { id: "se", label: "Southeast", lat: [25, 37], lon: [-94, -75] },
  { id: "ne", label: "Northeast", lat: [37, 47], lon: [-82, -67] },
] as const;
const samples = (r: (typeof REGIONS)[number]) => {
  const out: [number, number][] = [];
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 5; j++)
      out.push([
        r.lon[0] + ((r.lon[1] - r.lon[0]) * (i + 0.5)) / 7,
        r.lat[0] + ((r.lat[1] - r.lat[0]) * (j + 0.5)) / 5,
      ]);
  return out;
};
const CATS = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];

export type OutlookDay = {
  day: number;
  date: string;
  kind: "cat" | "prob";
  /** SPC said predictability is too low to draw areas this day. */
  low: boolean;
  /** SPC's outlook for this day couldn't be read (shown as unknown, never as quiet). */
  failed?: boolean;
  /** Day 1–3: SPC category code; day 4–7: the highest probability (%). */
  cells: Record<string, string | number | null>;
};

/** The next seven days by region: SPC's Day 1–3 categories, then the Day 4–8 probabilities. */
export async function regionalOutlook(): Promise<OutlookDay[]> {
  const days = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7].map(async (d) => {
      let failed = false;
      const feats = await spcFeatures(
        d <= 3 ? `outlook/day${d}otlk_cat` : `exper/day4-8/day${d}prob`,
      ).catch(() => {
        failed = true;
        return [];
      });
      const cells: OutlookDay["cells"] = {};
      for (const r of REGIONS) {
        const pts = samples(r);
        let best: string | number | null = null;
        for (const f of feats) {
          const label = String(f.properties.LABEL ?? "");
          const v =
            d <= 3
              ? CATS.indexOf(label)
              : Math.round(Number(label) * (Number(label) <= 1 ? 100 : 1));
          if (v < 0 || !Number.isFinite(v) || v === 0) continue;
          const cur =
            best == null
              ? -1
              : d <= 3
                ? CATS.indexOf(String(best))
                : Number(best);
          if (v <= cur) continue;
          if (pts.some(([lon, lat]) => inside(f.geometry, lon, lat)))
            best = d <= 3 ? CATS[v] : v;
        }
        cells[r.id] = best;
      }
      return {
        day: d,
        date: ymd(new Date(Date.now() + (d - 1) * 86400_000)),
        kind: d <= 3 ? ("cat" as const) : ("prob" as const),
        low: feats.some((f) =>
          /too low/i.test(String(f.properties.LABEL ?? "")),
        ),
        ...(failed ? { failed } : {}),
        cells,
      };
    }),
  );
  return days;
}

/** VIP's pattern index: the Day 1 category sets the band, the peak hazard odds nudge it. */
export async function patternIndex() {
  const [cat, torn, wind, hail] = await Promise.all(
    ["cat", "torn", "wind", "hail"].map((k) =>
      spcFeatures(`outlook/day1otlk_${k}`).catch(() => []),
    ),
  );
  const top = Math.max(
    -1,
    ...cat.map((f) => CATS.indexOf(String(f.properties.LABEL ?? ""))),
  );
  const pct = (feats: typeof cat) =>
    Math.max(
      0,
      ...feats.map((f) => {
        const l = String(f.properties.LABEL ?? "");
        const n = Number(l);
        return Number.isFinite(n) ? (n <= 1 ? n * 100 : n) : 0;
      }),
    );
  const t = pct(torn);
  const w = pct(wind);
  const h = pct(hail);
  const base = [15, 30, 52, 70, 86, 97][top] ?? 5;
  return {
    score: Math.min(
      100,
      Math.round(base + Math.min(Math.max(t, w, h), 15) * 0.4),
    ),
    category: top >= 0 ? CATS[top] : null,
    torn: Math.round(t),
    wind: Math.round(w),
    hail: Math.round(h),
  };
}
