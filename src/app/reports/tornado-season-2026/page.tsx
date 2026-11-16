import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { pageMeta, SITE } from "@/lib/seo/site";
import { ledgerSince, type DayReports } from "@/lib/patterns/data";
import { surveyTiles, type Tile } from "@/lib/patterns/season";
import { tornadoSummary } from "@/lib/climo/server";
import s from "../Report.module.css";

export const revalidate = 86400;
export const metadata: Metadata = pageMeta(
  "/reports/tornado-season-2026",
  "The 2026 tornado season in numbers",
  "Every tornado report of 2026 by month and state, the busiest days, and how the year compares with 75 years of records.",
);

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
const n = (x: number) => Math.round(x).toLocaleString("en-US");
const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

/** Data report (post-launch A9 "data-reports", B8): the year's tornadoes, for press and bloggers to cite. */
export default async function TornadoSeason() {
  let rows: DayReports[] = [];
  let tiles: Tile[] = [];
  try {
    [rows, tiles] = await Promise.all([
      ledgerSince("2026-01-01"),
      surveyTiles(2026).catch(() => []),
    ]);
  } catch {}
  const climo = tornadoSummary();
  const years = climo.last - climo.first + 1;
  const avg = climo.months.map((m) => m / years);
  const byMonth = MONTHS.map(() => 0);
  const states: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byMonth[Number(r.day.slice(5, 7)) - 1] += r.torn;
    total += r.torn;
    for (const [st, c] of Object.entries(r.tornStates))
      states[st] = (states[st] ?? 0) + c;
  }
  const busiest = [...rows].sort((a, b) => b.torn - a.torn).slice(0, 5);
  const topStates = Object.entries(states)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const through = rows.at(-1)?.day;
  const avgYear = avg.reduce((a, b) => a + b, 0);
  const max = Math.max(...byMonth, ...avg, 1);
  const stMax = topStates[0]?.[1] ?? 1;
  const cite = `${SITE.publisher}, "The 2026 tornado season in numbers," ${SITE.url}/reports/tornado-season-2026${through ? ` (data through ${day(through)}, 2026)` : ""}.`;

  return (
    <main className="grid gap-4 pb-10">
      <PageHero
        eyebrow={["Data report", through ? `Through ${day(through)}` : "2026"]}
        title="The 2026 tornado season in numbers"
        subtitle="Every tornado report of the year so far, where and when they hit, and how 2026 stacks up against 75 years of records."
      />
      {!rows.length ? (
        <p className={s.note}>
          The year&apos;s figures are being gathered. Check back shortly.
        </p>
      ) : (
        <>
          <section className={s.stats}>
            <div>
              <b>{n(total)}</b>
              <span>tornado reports (preliminary)</span>
            </div>
            <div>
              <b>{n(avgYear)}</b>
              <span>tornadoes in an average year, 1950–2025</span>
            </div>
            {busiest[0] && (
              <div>
                <b>{n(busiest[0].torn)}</b>
                <span>reports on {day(busiest[0].day)}, the busiest day</span>
              </div>
            )}
            {topStates[0] && (
              <div>
                <b>{topStates[0][0]}</b>
                <span>most reports ({n(topStates[0][1])})</span>
              </div>
            )}
            {tiles.slice(0, 4).map((t) => (
              <div key={t.id}>
                <b>{t.value}</b>
                <span>
                  {t.label}
                  {t.sub ? ` · ${t.sub}` : ""}
                </span>
              </div>
            ))}
          </section>

          <section className={s.card}>
            <h2>By month: 2026 reports against the average year</h2>
            <svg
              viewBox="0 0 360 200"
              className={s.chart}
              role="img"
              aria-label="Tornado reports by month in 2026 compared with the 1950 to 2025 average"
            >
              {MONTHS.map((m, i) => {
                const x = 14 + i * 28.5;
                const h1 = (byMonth[i] / max) * 150;
                const h2 = (avg[i] / max) * 150;
                return (
                  <g key={m}>
                    <rect
                      x={x}
                      y={170 - h2}
                      width={11}
                      height={h2}
                      className={s.avg}
                    />
                    <rect
                      x={x + 12}
                      y={170 - h1}
                      width={11}
                      height={h1}
                      className={s.now}
                    />
                    <text x={x + 11} y={186} className={s.tick}>
                      {m[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className={s.legend}>
              <i className={s.avg} /> Average tornadoes, 1950–2025{" "}
              <i className={s.now} /> 2026 preliminary reports
            </p>
          </section>

          <section className={s.card}>
            <h2>Top states</h2>
            <ol className={s.bars}>
              {topStates.map(([st, c]) => (
                <li key={st}>
                  <span>{st}</span>
                  <i style={{ transform: `scaleX(${c / stMax})` }} />
                  <b>{n(c)}</b>
                </li>
              ))}
            </ol>
          </section>

          <section className={s.card}>
            <h2>The busiest days</h2>
            <ol className={s.days}>
              {busiest.map((r) => (
                <li key={r.day}>
                  <b>{day(r.day)}</b>
                  <span>
                    {n(r.torn)} tornado reports
                    {r.strongest
                      ? `, strongest surveyed ${r.strongest.ef} (${r.strongest.where})`
                      : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <section className={s.card}>
        <h2>How this was made</h2>
        <p className={s.note}>
          2026 counts are the Storm Prediction Center&apos;s preliminary storm
          reports, tallied each day by StormSync Weather; one tornado can be
          reported more than once, so they run higher than the final count.
          Survey figures come from the National Weather Service Damage
          Assessment Toolkit. The average year comes from SPC&apos;s final
          tornado database, 1950 to 2025. Updated daily.
        </p>
      </section>
      <section className={s.card}>
        <h2>Cite or share</h2>
        <p className={s.note}>Free to use with credit and a link.</p>
        <p className={s.cite}>{cite}</p>
      </section>
    </main>
  );
}
