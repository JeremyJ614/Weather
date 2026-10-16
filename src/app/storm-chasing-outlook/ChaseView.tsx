"use client";

import { useState } from "react";
import {
  CalendarRange,
  Compass,
  Crosshair,
  Gauge,
  ShieldAlert,
  Tornado,
} from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { project } from "@/lib/map/usAlbers";
import { pick, type Colors } from "@/lib/colors/pick";
import type { ChaseDay, Target } from "@/lib/chase/engine";
import {
  BANDS,
  CAT_NAMES,
  bandIndex,
  lclFt,
  percentile,
} from "@/lib/chase/score";
import s from "./Chase.module.css";

export type Ledger = {
  day: string;
  top_score: number;
  spc_cat: string | null;
  tornado_pct: number;
  place: string | null;
}[];
const ct = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      }) + " CT"
    : "–";
const COMPASS = "N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW".split(
  " ",
);
const toward = (deg: number) => COMPASS[Math.round(deg / 22.5) % 16];

/** Storm Chasing Outlook: the score, two targets on the map, five subtabs. */
export function ChaseView({
  day,
  ledger,
  colors,
}: {
  day: ChaseDay;
  ledger: Ledger;
  colors: Colors;
}) {
  const band = (score: number) =>
    pick(
      colors,
      `chase:band:${bandIndex(score)}`,
      BANDS[bandIndex(score)].color,
    );
  const [t1, t2] = day.targets;
  const [sel, setSel] = useState(0);
  if (!t1)
    return (
      <p className={s.card}>
        No candidate scored today. Check back after SPC&apos;s next outlook.
      </p>
    );
  const t = day.targets[sel] ?? t1;
  return (
    <div className="grid gap-4">
      <section className={s.hero} style={{ ["--c" as string]: band(t1.score) }}>
        <div className={s.dial}>
          <b>{t1.score}</b>
          <span>/ 100</span>
        </div>
        <div>
          <p className={s.band}>{BANDS[bandIndex(t1.score)].label}</p>
          <h2>{t1.place}</h2>
          <p className={s.muted}>
            {day.quiet
              ? "Quiet day: no SPC marginal risk or higher, so these are the best of the usual chase country."
              : `Highest SPC risk today: ${CAT_NAMES[day.spcTop]}. ${day.candidates} spots inside the risk areas were scored.`}
          </p>
        </div>
      </section>
      <UsMap
        title="Today's chase targets"
        sub={new Date(`${day.day}T12:00:00Z`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })}
        legend={[]}
        status="ready"
        file="sswx-chase-targets"
        overlay={
          <g>
            {day.targets.map((x, i) => {
              const p = project(x.lon, x.lat);
              return (
                <g
                  key={x.rank}
                  transform={`translate(${p.x} ${p.y})`}
                  onClick={() => setSel(i)}
                  style={{ cursor: "pointer" }}
                >
                  <circle r={34} fill={band(x.score)} opacity={0.2} />
                  <circle
                    r={9}
                    fill={band(x.score)}
                    stroke="#0b0c14"
                    strokeWidth={2}
                  />
                  <text
                    y={4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={800}
                    fill="#0b0c14"
                  >
                    {x.rank}
                  </text>
                  <text
                    y={-16}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill="#fff"
                    stroke="#0b0c14"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {x.score}
                  </text>
                </g>
              );
            })}
          </g>
        }
      />
      {t2 && (
        <div className={s.switch} role="group" aria-label="Target">
          {day.targets.map((x, i) => (
            <button
              key={x.rank}
              type="button"
              aria-pressed={i === sel}
              onClick={() => setSel(i)}
              style={{ ["--c" as string]: band(x.score) }}
            >
              <i>{x.rank}</i>
              <span>
                <b>{x.place}</b>
                <small>score {x.score}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <HomeTabs
        label="Chase"
        variant="pills"
        tabs={[
          {
            id: "c-over",
            label: "Overview",
            icon: <Crosshair aria-hidden />,
            panel: <Overview t={t} band={band} />,
          },
          {
            id: "c-params",
            label: "Parameters",
            icon: <Gauge aria-hidden />,
            panel: <Params a={t1} b={t2} />,
          },
          {
            id: "c-mode",
            label: "Storm Mode",
            icon: <Tornado aria-hidden />,
            panel: <ModeTab t={t} />,
          },
          {
            id: "c-bust",
            label: "Bust Odds",
            icon: <ShieldAlert aria-hidden />,
            panel: <BustTab t={t} />,
          },
          {
            id: "c-year",
            label: "Yearly",
            icon: <CalendarRange aria-hidden />,
            panel: <Yearly ledger={ledger} today={day.day} band={band} />,
          },
        ]}
      />
      <p className={s.foot}>
        Scored from SPC&apos;s Day 1 outlook and Open-Meteo forecasts of
        instability, shear, helicity, moisture, the cap and cloud bases, with
        time before sunset. A guide for planning, not a safety call: watch NWS
        warnings in the field.
      </p>
    </div>
  );
}

function Overview({ t, band }: { t: Target; band: (n: number) => string }) {
  return (
    <section className={s.card} style={{ ["--c" as string]: band(t.score) }}>
      <h3>
        <Compass aria-hidden /> Target {t.rank} · {t.place}
      </h3>
      <ul className={s.why}>
        {t.why.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <div className={s.facts}>
        <span>
          Peak <b>{ct(t.peak)}</b>
        </span>
        <span>
          Sunset <b>{ct(t.sunset)}</b>
        </span>
        <span>
          SPC <b>{CAT_NAMES[t.spc.cat]}</b>
        </span>
        <span>
          Tornado <b>{t.spc.torn}%</b> · Hail <b>{t.spc.hail}%</b> · Wind{" "}
          <b>{t.spc.wind}%</b>
        </span>
      </div>
    </section>
  );
}

const ROWS: {
  k: keyof Target["hour"] | "lcl";
  label: string;
  unit: string;
  better: 1 | -1;
  hint: string;
}[] = [
  {
    k: "cape",
    label: "Instability (CAPE)",
    unit: "J/kg",
    better: 1,
    hint: "Fuel for updrafts",
  },
  {
    k: "shear",
    label: "Deep shear",
    unit: "kt",
    better: 1,
    hint: "Organizes storms into supercells",
  },
  {
    k: "srh",
    label: "Helicity (0–3 km)",
    unit: "m²/s²",
    better: 1,
    hint: "Spin available to storms",
  },
  {
    k: "stp",
    label: "Sig. tornado param.",
    unit: "",
    better: 1,
    hint: "Above 1 favors strong tornadoes",
  },
  {
    k: "dew",
    label: "Dew point",
    unit: "°F",
    better: 1,
    hint: "Low-level moisture",
  },
  {
    k: "cin",
    label: "Cap (CIN)",
    unit: "J/kg",
    better: 1,
    hint: "Closer to 0 means storms fire",
  },
  {
    k: "lcl",
    label: "Cloud base (LCL)",
    unit: "ft",
    better: -1,
    hint: "Lower favors tornadoes",
  },
  {
    k: "li",
    label: "Lifted index",
    unit: "",
    better: -1,
    hint: "More negative is more unstable",
  },
  {
    k: "swti",
    label: "Threat index (SWTI)",
    unit: "/100",
    better: 1,
    hint: "VIP's severe threat index",
  },
  {
    k: "lowCloud",
    label: "Low clouds",
    unit: "%",
    better: -1,
    hint: "Less lets the ground heat",
  },
];

function Params({ a, b }: { a: Target; b?: Target }) {
  const val = (t: Target, k: (typeof ROWS)[number]["k"]) =>
    k === "lcl" ? lclFt(t.hour.temp, t.hour.dew) : Number(t.hour[k]);
  return (
    <div className="overflow-x-auto">
      <table className={s.table}>
        <thead>
          <tr>
            <th>At peak hour</th>
            <th>Target 1</th>
            {b && <th>Target 2</th>}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const x = val(a, r.k);
            const y = b ? val(b, r.k) : null;
            const win =
              y == null
                ? 0
                : (x - y) * r.better > 0
                  ? 1
                  : (x - y) * r.better < 0
                    ? 2
                    : 0;
            return (
              <tr key={r.k}>
                <td>
                  {r.label}
                  <small>{r.hint}</small>
                </td>
                <td data-win={win === 1 || undefined}>
                  {x.toLocaleString("en-US")} {r.unit}
                </td>
                {b && (
                  <td data-win={win === 2 || undefined}>
                    {y!.toLocaleString("en-US")} {r.unit}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModeTab({ t }: { t: Target }) {
  return (
    <section className={s.card}>
      <h3>
        <Tornado aria-hidden /> {t.mode.mode}
      </h3>
      <div className={s.stats}>
        <div>
          <b>{t.mode.flavor}</b>
          <span>storm type</span>
        </div>
        <div>
          <b>{t.hour.motionMph} mph</b>
          <span>toward {toward(t.hour.motionTo)}</span>
        </div>
        <div>
          <b>{t.mode.hailIn ? `${t.mode.hailIn}″` : "–"}</b>
          <span>rough hail size</span>
        </div>
      </div>
      {t.mode.notes.map((n) => (
        <p key={n} className={s.muted}>
          {n}
        </p>
      ))}
      <p className={s.small}>
        Hail size is a rough estimate from instability, shear and the freezing
        level ({t.hour.freezingFt.toLocaleString("en-US")} ft).
      </p>
    </section>
  );
}

function BustTab({ t }: { t: Target }) {
  const c =
    t.bust.pct >= 60 ? "#ef4444" : t.bust.pct >= 35 ? "#fb923c" : "#4ade80";
  return (
    <section className={s.card} style={{ ["--c" as string]: c }}>
      <div className={s.bust}>
        <b>{t.bust.pct}%</b>
        <span>chance the day busts</span>
        <i>
          <em style={{ transform: `scaleX(${t.bust.pct / 100})` }} />
        </i>
      </div>
      {t.bust.reasons.length ? (
        <ul className={s.why}>
          {t.bust.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>
          Nothing obvious stands in the way: the cap is weak, shear and moisture
          are there.
        </p>
      )}
    </section>
  );
}

function Yearly({
  ledger,
  today,
  band,
}: {
  ledger: Ledger;
  today: string;
  band: (n: number) => string;
}) {
  const scores = ledger.map((l) => l.top_score);
  const mine = ledger.find((l) => l.day === today)?.top_score ?? 0;
  const best = [...ledger].sort((a, b) => b.top_score - a.top_score)[0];
  const chaseDays = ledger.filter((l) => l.top_score >= 70).length;
  let streak = 0;
  for (let i = ledger.length - 1; i >= 0 && ledger[i].top_score >= 50; i--)
    streak++;
  const avg = scores.length
    ? Math.round(scores.reduce((a, x) => a + x, 0) / scores.length)
    : 0;
  const recent = ledger.slice(-60);
  return (
    <div className="grid gap-3">
      <div className={s.stats}>
        <div>
          <b>{percentile(mine, scores)}%</b>
          <span>of days this year scored at or below today</span>
        </div>
        <div>
          <b>{chaseDays}</b>
          <span>chase days (70+) this year</span>
        </div>
        <div>
          <b>{avg}</b>
          <span>average score over {ledger.length} days</span>
        </div>
      </div>
      {best && (
        <p className={s.card}>
          Best day so far: <b>{best.top_score}</b> on{" "}
          {new Date(`${best.day}T12:00:00Z`).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}{" "}
          {best.place}.
          {streak > 1 ? ` ${streak} days in a row at 50 or better.` : ""}
        </p>
      )}
      <svg
        viewBox="0 0 300 80"
        className="w-full"
        role="img"
        aria-label="Daily chase scores"
      >
        {recent.map((l, i) => (
          <rect
            key={l.day}
            x={(i * 300) / Math.max(60, recent.length)}
            width={300 / Math.max(60, recent.length) - 1}
            y={78 - (l.top_score / 100) * 74}
            height={(l.top_score / 100) * 74}
            fill={band(l.top_score)}
            opacity={l.day === today ? 1 : 0.7}
          />
        ))}
      </svg>
      <p className={s.small}>
        Each bar is a day&apos;s best score (last {recent.length} days). The
        record starts the day this page went live and grows every day.
      </p>
    </div>
  );
}
