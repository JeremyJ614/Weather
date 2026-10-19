import "server-only";
import { inside, spcFeatures } from "@/lib/colors/spc-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
      if (/^[A-Z]{2}$/.test(st)) out.states[st] = (out.states[st] ?? 0) + 1;
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
async function reportsFor(day: string): Promise<DayReports | null> {
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
  return out.filter((d): d is DayReports => !!d);
}

export type Period = {
  id: "yesterday" | "week" | "month" | "year";
  label: string;
  days: number;
  torn: number;
  hail: number;
  wind: number;
  busiest: { day: string; total: number } | null;
  bigHail: { in: number; where: string; day: string } | null;
  bigGust: { mph: number; where: string; day: string } | null;
  topStates: [string, number][];
  tornadoDays: number;
  series: { day: string; torn: number; hail: number; wind: number }[];
  summary: string | null;
};

export const PERIODS = [
  { id: "yesterday", label: "Yesterday", days: 1 },
  { id: "week", label: "Past week", days: 7 },
  { id: "month", label: "Past month", days: 30 },
  { id: "year", label: "Past year", days: 365 },
] as const;

export function aggregate(
  p: (typeof PERIODS)[number],
  list: DayReports[],
): Omit<Period, "summary"> {
  const states: Record<string, number> = {};
  let busiest: Period["busiest"] = null;
  let bigHail: Period["bigHail"] = null;
  let bigGust: Period["bigGust"] = null;
  for (const d of list) {
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
    series: list.map(({ day, torn, hail, wind }) => ({
      day,
      torn,
      hail,
      wind,
    })),
  };
}

const memo = new Map<string, { at: number; v: Promise<Period> }>();
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

/** A period's numbers, and (week, month, year) the AI's plain-English summary of them. */
export function period(id: Period["id"]): Promise<Period> {
  const key = `${id}:${ymd(new Date())}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 3 * 3600_000) return hit.v;
  const p = PERIODS.find((x) => x.id === id)!;
  const v = reportDays(p.days).then(async (list) => {
    const a = aggregate(p, list);
    return { ...a, summary: id === "yesterday" ? null : await summarize(a) };
  });
  memo.set(key, { at: Date.now(), v });
  v.catch(() => memo.delete(key));
  return v;
}

async function summarize(a: Omit<Period, "summary">): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !a.days) return null;
  // Monthly totals for the year, weekly for the month, daily for the week.
  const step = a.id === "year" ? 30 : a.id === "month" ? 7 : 1;
  const chunks: string[] = [];
  for (let i = 0; i < a.series.length; i += step) {
    const c = a.series.slice(i, i + step);
    chunks.push(
      `${c[0].day}${c.length > 1 ? `..${c.at(-1)!.day}` : ""}: ${c.reduce((s, d) => s + d.torn, 0)} tornado, ${c.reduce((s, d) => s + d.hail, 0)} hail, ${c.reduce((s, d) => s + d.wind, 0)} wind`,
    );
  }
  const facts = `Period: ${a.label} (${a.days} days of SPC preliminary storm reports).
Totals: ${a.torn} tornado reports, ${a.hail} hail reports, ${a.wind} wind reports; tornado reports on ${a.tornadoDays} days.
Busiest day: ${a.busiest ? `${a.busiest.day} with ${a.busiest.total} reports` : "none"}.
Largest hail: ${a.bigHail ? `${a.bigHail.in} in near ${a.bigHail.where} on ${a.bigHail.day}` : "none"}.
Strongest measured gust: ${a.bigGust ? `${a.bigGust.mph} mph near ${a.bigGust.where} on ${a.bigGust.day}` : "none"}.
Most reports by state: ${a.topStates.map(([s, n]) => `${s} ${n}`).join(", ") || "none"}.
Breakdown:
${chunks.join("\n")}`;
  const prompt = `You are the SSWX Forecast Desk. Write a 3-4 sentence plain-English recap of severe weather across the U.S. for this period, using ONLY these numbers (no invented values, no forecasts). Mention when activity peaked and where it concentrated. Note these are preliminary reports (one storm can make several).\n\n${facts}`;
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
            generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
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
      if (text) {
        ok = true;
        return text.slice(0, 900);
      }
    } catch {
      // overloaded or timed out: try the next model
    } finally {
      await db.rpc("count_ai_call", { p_feature: "patterns", p_ok: ok });
    }
  }
  return null;
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
  /** Day 1–3: SPC category code; day 4–7: the highest probability (%). */
  cells: Record<string, string | number | null>;
};

/** The next seven days by region: SPC's Day 1–3 categories, then the Day 4–8 probabilities. */
export async function regionalOutlook(): Promise<OutlookDay[]> {
  const days = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7].map(async (d) => {
      const feats = await spcFeatures(
        d <= 3 ? `outlook/day${d}otlk_cat` : `exper/day4-8/day${d}prob`,
      ).catch(() => []);
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
