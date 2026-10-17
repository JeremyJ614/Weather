"use client";

import { useEffect, useState } from "react";
import { BarChart3, Brain, CalendarRange, Globe2, History } from "lucide-react";
import { pick, type Colors } from "@/lib/colors/pick";
import { SPC_PALETTES } from "@/lib/colors/spc";
import { ERO_LEVELS } from "@/lib/flood/levels";
import type { OutlookDay, Period } from "@/lib/patterns/data";
import { INDEX_LABELS, PAT_COLORS, indexBand } from "@/lib/patterns/style";
import s from "./Patterns.module.css";

const REGIONS = [
  ["nw", "Northwest"],
  ["sw", "Southwest"],
  ["np", "Northern Plains"],
  ["sp", "Southern Plains"],
  ["mw", "Midwest"],
  ["se", "Southeast"],
  ["ne", "Northeast"],
] as const;
const CATS = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];
const CAT_NAMES = [
  "Thunder",
  "Marginal",
  "Slight",
  "Enhanced",
  "Moderate",
  "High",
];
const PERIODS = [
  ["yesterday", "Yesterday"],
  ["week", "Past week"],
  ["month", "Past month"],
  ["year", "Past year"],
] as const;
const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function usePeriod(id: Period["id"]) {
  const [res, setRes] = useState<Record<string, Period | "error">>({});
  useEffect(() => {
    if (res[id]) return;
    let live = true;
    fetch(`/api/patterns/recap?period=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Period) => live && setRes((m) => ({ ...m, [id]: d })))
      .catch(() => live && setRes((m) => ({ ...m, [id]: "error" })));
    return () => {
      live = false;
    };
  }, [id, res]);
  return res[id] ?? null;
}

/** Weather Patterns: today's national picture, the week ahead by region, and the recap. */
export function PatternsView({
  outlook,
  index,
  eroTop,
  eroDay,
  hazards,
  colors,
}: {
  outlook: OutlookDay[] | null;
  index: {
    score: number;
    category: string | null;
    torn: number;
    wind: number;
    hail: number;
  } | null;
  eroTop: number | null;
  eroDay: number | null;
  hazards: string[] | null;
  colors: Colors;
}) {
  const c = (k: string) =>
    pick(
      colors,
      `pat:${k}`,
      PAT_COLORS.find((x) => x.key === k)?.color ?? "#ffffff",
    );
  const cat = (code: string) => {
    const i = CATS.indexOf(code);
    return pick(
      colors,
      `spc:cat:${i}`,
      SPC_PALETTES.cat[i]?.color ?? "#888888",
    );
  };
  const band = index ? indexBand(index.score) : 0;
  const [pid, setPid] = useState<Period["id"]>("week");
  const p = usePeriod(pid);
  const year = usePeriod("year");
  const y = year && year !== "error" ? year : null;
  const jan1 = `${new Date().getFullYear()}-01-01`;
  const ytd = y?.series.filter((d) => d.day >= jan1) ?? [];
  const lit = (regions: string[]) => regions.length;
  const d1 = outlook?.[0];
  const d1Regions = d1
    ? REGIONS.filter(([id]) => d1.cells[id]).map(([, l]) => l)
    : [];
  return (
    <div className="grid gap-4">
      <section className={s.card}>
        <header>
          <Globe2 aria-hidden />
          <h3>Today across the country</h3>
        </header>
        <ul className={s.national}>
          <li>
            <b>Severe storms</b>
            <span>
              {index?.category
                ? `SPC ${CAT_NAMES[CATS.indexOf(index.category)]} risk${d1Regions.length ? ` over the ${d1Regions.join(", ")}` : ""}. Peak odds: tornado ${index.torn}%, wind ${index.wind}%, hail ${index.hail}%.`
                : "No thunderstorm areas in SPC's Day 1 outlook."}
            </span>
          </li>
          <li>
            <b>Flash flooding</b>
            <span>
              {eroTop == null
                ? "WPC's outlook isn't answering."
                : eroTop
                  ? `WPC ${ERO_LEVELS[eroTop - 1].label} risk of excessive rain${eroDay && eroDay > 1 ? ` on day ${eroDay}` : " today"}.`
                  : "No excessive-rainfall risk in the next five days."}
            </span>
          </li>
          <li>
            <b>Days 3–14</b>
            <span>
              {hazards == null
                ? "CPC's hazards outlook isn't answering."
                : hazards.length
                  ? `CPC is watching: ${hazards.slice(0, 5).join("; ")}.`
                  : "CPC outlooks no hazards."}
            </span>
          </li>
        </ul>
      </section>

      <section className={s.card}>
        <header>
          <History aria-hidden />
          <h3>What has already happened</h3>
          <small>SPC storm reports</small>
        </header>
        <div className={s.rail} role="tablist" aria-label="Period">
          {PERIODS.map(([id, l]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === pid}
              onClick={() => setPid(id)}
            >
              {l}
            </button>
          ))}
        </div>
        {p === "error" ? (
          <p className={s.muted}>
            SPC&apos;s storm reports aren&apos;t answering right now.
          </p>
        ) : !p ? (
          <p className={s.muted}>
            Reading {pid === "year" ? "a year of" : "the"} storm reports…
          </p>
        ) : (
          <>
            {p.summary && (
              <div className={s.desk}>
                <small>
                  <Brain aria-hidden /> SSWX Forecast Desk
                </small>
                <p>{p.summary}</p>
              </div>
            )}
            <div className={s.figures}>
              {(["torn", "hail", "wind"] as const).map((k) => (
                <div key={k} style={{ ["--c" as string]: c(k) }}>
                  <small>
                    {k === "torn" ? "Tornado" : k === "hail" ? "Hail" : "Wind"}
                  </small>
                  <b>{p[k].toLocaleString("en-US")}</b>
                </div>
              ))}
            </div>
            {p.series.length > 1 && <Series series={p.series} c={c} />}
            <ul className={s.facts}>
              {p.busiest && (
                <li>
                  Busiest day <b>{day(p.busiest.day)}</b> · {p.busiest.total}{" "}
                  reports
                </li>
              )}
              {p.bigHail && (
                <li>
                  Largest hail <b>{p.bigHail.in}″</b> · {p.bigHail.where},{" "}
                  {day(p.bigHail.day)}
                </li>
              )}
              {p.bigGust && (
                <li>
                  Strongest gust <b>{p.bigGust.mph} mph</b> · {p.bigGust.where},{" "}
                  {day(p.bigGust.day)}
                </li>
              )}
              {p.topStates.length > 0 && (
                <li>
                  Most reports{" "}
                  <b>
                    {p.topStates.map(([st, n]) => `${st} ${n}`).join(" · ")}
                  </b>
                </li>
              )}
              {p.id !== "yesterday" && (
                <li>
                  Tornado reports on <b>{p.tornadoDays}</b> of {p.days} days
                </li>
              )}
            </ul>
            {!p.torn && !p.hail && !p.wind && (
              <p className={s.muted}>No severe reports in this period.</p>
            )}
            <p className={s.small}>
              Preliminary SPC reports: one storm can make several, and counts
              change as offices review them.
            </p>
          </>
        )}
      </section>

      {index && (
        <section
          className={s.gauge}
          style={{ ["--c" as string]: c(`g${band}`) }}
        >
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="48" className={s.track} />
            <circle
              cx="60"
              cy="60"
              r="48"
              className={s.arc}
              strokeDasharray={`${(index.score / 100) * 301.6} 301.6`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div>
            <b>{index.score}</b>
            <span>/ 100</span>
          </div>
          <p>{INDEX_LABELS[band]} activity</p>
          <small>
            Pattern index from SPC&apos;s Day 1 category and peak odds
          </small>
        </section>
      )}

      <section className={s.card}>
        <header>
          <CalendarRange aria-hidden />
          <h3>7-day outlook by region</h3>
        </header>
        {!outlook ? (
          <p className={s.muted}>
            SPC&apos;s outlooks aren&apos;t answering right now.
          </p>
        ) : (
          <>
            <div className={s.gridWrap}>
              <table className={s.grid}>
                <thead>
                  <tr>
                    <th>Region</th>
                    {outlook.map((d) => (
                      <th key={d.day}>
                        Day {d.day}
                        <small>{day(d.date)}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {REGIONS.map(([id, label]) => (
                    <tr key={id}>
                      <td>{label}</td>
                      {outlook.map((d) => {
                        const v = d.cells[id];
                        const col =
                          v == null
                            ? null
                            : d.kind === "cat"
                              ? cat(String(v))
                              : Number(v) >= 30
                                ? c("p30")
                                : c("p15");
                        return (
                          <td key={d.day}>
                            <span
                              data-on={col ? true : undefined}
                              style={
                                col ? { ["--c" as string]: col } : undefined
                              }
                            >
                              {v == null
                                ? d.low
                                  ? "—"
                                  : "·"
                                : d.kind === "cat"
                                  ? String(v)
                                  : `${v}%`}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!outlook.some((d) =>
              lit(Object.values(d.cells).filter(Boolean) as string[]),
            ) && (
              <p className={s.muted}>
                No SPC risk areas over any region in the next 7 days: a
                genuinely quiet week nationally.
              </p>
            )}
            <p className={s.small}>
              Days 1–3 are SPC&apos;s categorical outlooks; days 4–7 are its Day
              4–8 probabilities (SPC issues no categories past day 3), so the
              units change halfway across on purpose. A region lights up when a
              risk area overlaps it. &ldquo;—&rdquo; means SPC said
              predictability is too low.
            </p>
          </>
        )}
      </section>

      <section className={s.card}>
        <header>
          <BarChart3 aria-hidden />
          <h3>Season so far</h3>
          <small>Since Jan 1</small>
        </header>
        {!y ? (
          <p className={s.muted}>
            {year === "error"
              ? "SPC's storm reports aren't answering right now."
              : "Counting this year's reports…"}
          </p>
        ) : (
          <div className={s.tiles}>
            {(["torn", "hail", "wind"] as const).map((k) => (
              <div key={k}>
                <small>
                  {k === "torn"
                    ? "Tornado reports"
                    : k === "hail"
                      ? "Hail reports"
                      : "Wind reports"}
                </small>
                <b style={{ color: c(k) }}>
                  {ytd.reduce((a, d) => a + d[k], 0).toLocaleString("en-US")}
                </b>
              </div>
            ))}
            <div>
              <small>Tornado days</small>
              <b>{ytd.filter((d) => d.torn > 0).length}</b>
            </div>
            <div>
              <small>Busiest day</small>
              <b>
                {(() => {
                  const top = [...ytd].sort(
                    (a, b) =>
                      b.torn + b.hail + b.wind - (a.torn + a.hail + a.wind),
                  )[0];
                  return top ? day(top.day) : "–";
                })()}
              </b>
            </div>
            <div>
              <small>Days tracked</small>
              <b>{ytd.length}</b>
            </div>
          </div>
        )}
      </section>
      <p className={s.foot}>
        Sources: SPC convective outlooks and daily storm reports, WPC
        excessive-rainfall outlook, CPC hazards outlook. The forecast desk
        writes the recap from the counts above and never supplies a number.
      </p>
    </div>
  );
}

function Series({
  series,
  c,
}: {
  series: Period["series"];
  c: (k: string) => string;
}) {
  // Weekly bins for long periods so the bars stay readable.
  const bin = series.length > 60 ? 7 : 1;
  const bars: { torn: number; hail: number; wind: number }[] = [];
  for (let i = 0; i < series.length; i += bin) {
    const x = series.slice(i, i + bin);
    bars.push({
      torn: x.reduce((a, d) => a + d.torn, 0),
      hail: x.reduce((a, d) => a + d.hail, 0),
      wind: x.reduce((a, d) => a + d.wind, 0),
    });
  }
  const max = Math.max(1, ...bars.map((b) => b.torn + b.hail + b.wind));
  const w = 300 / bars.length;
  return (
    <svg
      viewBox="0 0 300 80"
      className="w-full"
      role="img"
      aria-label="Reports over the period"
    >
      {bars.map((b, i) => {
        let y = 80;
        return (
          <g key={i}>
            {(["wind", "hail", "torn"] as const).map((k) => {
              const h = (b[k] / max) * 76;
              y -= h;
              return (
                <rect
                  key={k}
                  x={i * w + w * 0.1}
                  y={y}
                  width={w * 0.8}
                  height={h}
                  fill={c(k)}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
