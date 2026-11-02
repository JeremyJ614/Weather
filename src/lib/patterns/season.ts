import { DAT_TORNADOES } from "@/lib/dat/tornado";
import "server-only";
import { tornadoSummary } from "@/lib/climo/server";
import { ledgerSince, type DayReports } from "./data";

/** One "Season so far" tile: VIP's eighteen, each naming what it counts. */
export type Tile = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: "neutral" | "up" | "down" | "hot";
};
export type Season = {
  year: number;
  since: string | null;
  through: string | null;
  days: number;
  tiles: Tile[];
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
const n = (x: number) => x.toLocaleString("en-US");
const md = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** VIP's report tiles, counted from this year's ledger. */
export function reportTiles(rows: DayReports[], year: number): Tile[] {
  if (!rows.length) return [];
  const sum = (k: "torn" | "hail" | "wind") =>
    rows.reduce((s, r) => s + r[k], 0);
  const torn = sum("torn");
  const hail = sum("hail");
  const wind = sum("wind");
  const total = torn + hail + wind;
  const tot = rows.map((r) => ({ ...r, total: r.torn + r.hail + r.wind }));
  const busiest = [...tot].sort((a, b) => b.total - a.total)[0];
  const active = tot.filter((r) => r.total > 0).length;
  const byMonth = new Map<number, number>();
  for (const r of tot) {
    const m = Number(r.day.slice(5, 7)) - 1;
    byMonth.set(m, (byMonth.get(m) ?? 0) + r.total);
  }
  const peak = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0];
  const last14 = tot.slice(-14);
  const recent = last14.slice(-7).reduce((s, r) => s + r.total, 0);
  const prior = last14
    .slice(0, Math.max(0, last14.length - 7))
    .reduce((s, r) => s + r.total, 0);
  const trend = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : null;
  const torn30 = tot.slice(-30).reduce((s, r) => s + r.torn, 0);
  let quiet = 0;
  for (let i = tot.length - 1; i >= 0 && tot[i].total === 0; i--) quiet++;
  const states = new Map<string, number>();
  for (const r of rows)
    for (const [st, c] of Object.entries(r.tornStates))
      states.set(st, (states.get(st) ?? 0) + c);
  const topState = [...states.entries()].sort((a, b) => b[1] - a[1])[0];
  const bigHail = rows
    .filter((r) => r.bigHail)
    .sort((a, b) => b.bigHail!.in - a.bigHail!.in)[0];
  const bigGust = rows
    .filter((r) => r.bigGust)
    .sort((a, b) => b.bigGust!.mph - a.bigGust!.mph)[0];
  const span = rows[0].day <= `${year}-01-07` ? String(year) : "tracked";
  return [
    {
      id: "torn",
      label: `Tornado reports ${span}`,
      value: n(torn),
      sub: `${total ? ((torn / total) * 100).toFixed(1) : "0"}% of all reports`,
      tone: "hot",
    },
    {
      id: "hail",
      label: `Hail reports ${span}`,
      value: n(hail),
      sub: "1 in+ hail SPC logged",
      tone: "neutral",
    },
    {
      id: "wind",
      label: `Wind reports ${span}`,
      value: n(wind),
      sub: "58 mph+ or damage",
      tone: "neutral",
    },
    {
      id: "total",
      label: "All severe reports",
      value: n(total),
      sub: `across ${n(rows.length)} days since ${md(rows[0].day)}`,
      tone: "neutral",
    },
    {
      id: "busiest",
      label: "Busiest day",
      value: busiest.total ? md(busiest.day) : "—",
      sub: `${n(busiest.total)} reports`,
      tone: "hot",
    },
    {
      id: "active",
      label: "Active days",
      value: n(active),
      sub: `${Math.round((active / rows.length) * 100)}% of days had reports`,
      tone: "neutral",
    },
    {
      id: "peak",
      label: "Peak month",
      value: peak ? MONTHS[peak[0]] : "—",
      sub: peak ? `${n(peak[1])} reports` : "no data",
      tone: "neutral",
    },
    {
      id: "torn30",
      label: "Tornadoes, last 30 days",
      value: n(torn30),
      sub: `${md(tot.slice(-30)[0].day)} – ${md(tot.at(-1)!.day)}`,
      tone: torn30 ? "hot" : "neutral",
    },
    {
      id: "trend",
      label: "7-day trend",
      value: trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`,
      sub: `${n(recent)} vs ${n(prior)} the week before`,
      tone: trend === null ? "neutral" : trend > 0 ? "up" : "down",
    },
    {
      id: "avg",
      label: "Avg per active day",
      value: n(active ? Math.round(total / active) : 0),
      sub: "reports nationwide",
      tone: "neutral",
    },
    {
      id: "quiet",
      label: "Quiet streak",
      value: `${quiet}d`,
      sub: quiet
        ? `no reports since ${md(tot[tot.length - quiet - 1]?.day ?? tot[0].day)}`
        : `reports on ${md(tot.at(-1)!.day)}`,
      tone: quiet > 3 ? "down" : "neutral",
    },
    {
      id: "topstate",
      label: "Top tornado state",
      value: topState ? topState[0] : "—",
      sub: topState ? `${n(topState[1])} tornado reports` : "no data yet",
      tone: "hot",
    },
    {
      id: "bighail",
      label: "Largest hail",
      value: bigHail ? `${bigHail.bigHail!.in}″` : "—",
      sub: bigHail
        ? `${bigHail.bigHail!.where} · ${md(bigHail.day)}`
        : "no data yet",
      tone: "hot",
    },
    {
      id: "biggust",
      label: "Peak wind gust",
      value: bigGust ? `${bigGust.bigGust!.mph} mph` : "—",
      sub: bigGust
        ? `${bigGust.bigGust!.where} · ${md(bigGust.day)}`
        : "no data yet",
      tone: "hot",
    },
  ];
}

const DAT =
  "https://services.dat.noaa.gov/arcgis/rest/services/nws_damageassessmenttoolkit/DamageViewer/FeatureServer/1/query";
async function dat(params: Record<string, string>) {
  const r = await fetch(
    `${DAT}?${new URLSearchParams({ f: "json", ...params })}`,
    {
      headers: {
        "User-Agent": "StormSync Weather (https://weather.sswx.space)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok) throw new Error(`DAT ${r.status}`);
  const j = (await r.json()) as {
    features?: { attributes: Record<string, number | string | null> }[];
    error?: unknown;
  };
  if (j.error) throw new Error("DAT error");
  return (j.features ?? []).map((f) => f.attributes);
}

/** VIP's survey tiles from NWS damage surveys: strongest tornado, EF3+ days, casualties, pace. */
export async function surveyTiles(
  year: number,
  on = new Date(),
): Promise<Tile[]> {
  const where = `stormdate >= DATE '${year}-01-01' AND ${DAT_TORNADOES}`;
  const [stats, ef3] = await Promise.all([
    dat({
      where,
      outStatistics: JSON.stringify([
        {
          statisticType: "count",
          onStatisticField: "objectid",
          outStatisticFieldName: "n",
        },
        {
          statisticType: "sum",
          onStatisticField: "fatalities",
          outStatisticFieldName: "fat",
        },
        {
          statisticType: "sum",
          onStatisticField: "injuries",
          outStatisticFieldName: "inj",
        },
      ]),
    }),
    dat({
      where: `${where} AND efnum >= 3`,
      outFields: "stormdate,efscale,efnum,length,wfo",
      returnGeometry: "false",
    }),
  ]);
  const s = stats[0] ?? {};
  const iso = (ms: unknown) => new Date(Number(ms)).toISOString().slice(0, 10);
  const days = new Set(ef3.map((a) => iso(a.stormdate)));
  const top = [...ef3].sort(
    (a, b) =>
      (Number(b.efnum) || 0) - (Number(a.efnum) || 0) ||
      (Number(b.length) || 0) - (Number(a.length) || 0),
  )[0];
  const tiles: Tile[] = [];
  if (top)
    tiles.push({
      id: "strongest",
      label: `Strongest tornado ${year}`,
      value: String(top.efscale ?? "EF?"),
      sub: [
        md(iso(top.stormdate)),
        top.length != null
          ? `${Math.round(Number(top.length) * 10) / 10} mi path`
          : null,
        top.wfo ? `NWS ${top.wfo}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      tone: "hot",
    });
  tiles.push({
    id: "ef3days",
    label: "Days with EF3+",
    value: n(days.size),
    sub: `${n(ef3.length)} EF3+ tracks surveyed`,
    tone: days.size ? "hot" : "neutral",
  });
  tiles.push({
    id: "fatalities",
    label: `Tornado deaths ${year}`,
    value: n(Number(s.fat) || 0),
    sub: `${n(Number(s.inj) || 0)} injuries · NWS surveys`,
    tone: Number(s.fat) ? "up" : "neutral",
  });
  // Pace against the last 30 full years' average, shaped by month across the record.
  const c = tornadoSummary();
  const recentYears = c.byYear.slice(-30).map((y) => y[0]);
  const perYear = recentYears.reduce((a, b) => a + b, 0) / recentYears.length;
  const shape = c.months.map((m) => m / c.months.reduce((a, b) => a + b, 0));
  const m = on.getUTCMonth();
  const frac =
    (on.getUTCDate() - 1) /
    new Date(Date.UTC(on.getUTCFullYear(), m + 1, 0)).getUTCDate();
  const expected =
    perYear * (shape.slice(0, m).reduce((a, b) => a + b, 0) + shape[m] * frac);
  const surveyed = Number(s.n) || 0;
  if (expected > 0 && surveyed > 0) {
    const pct = Math.round((surveyed / expected) * 100);
    tiles.push({
      id: "vsnormal",
      label: "Vs. average pace",
      value: `${pct}%`,
      sub: `${n(surveyed)} surveyed vs ~${n(Math.round(expected))} normal by ${md(on.toISOString().slice(0, 10))}`,
      tone: pct >= 100 ? "up" : "down",
    });
  }
  return tiles;
}

/** The whole "Season so far": report tiles from the ledger, survey tiles from the NWS. */
export async function buildSeason(on = new Date()): Promise<Season> {
  const year = on.getUTCFullYear();
  const rows = await ledgerSince(`${year}-01-01`);
  const survey = await surveyTiles(year, on).catch(() => []);
  return {
    year,
    since: rows[0]?.day ?? null,
    through: rows.at(-1)?.day ?? null,
    days: rows.length,
    tiles: [...reportTiles(rows, year), ...survey],
  };
}
