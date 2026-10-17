"use client";

import {
  Brain,
  CalendarRange,
  Clock,
  CloudHail,
  Crosshair,
  ExternalLink,
  Gauge,
  ShieldAlert,
  Tornado,
  Wind,
} from "lucide-react";
import { UsMap } from "@/features/maps/UsMap";
import { Polys, useLayer } from "@/features/maps/useLayer";
import { project } from "@/lib/map/usAlbers";
import { pick, type Colors } from "@/lib/colors/pick";
import type { ChaseDay, Target } from "@/lib/chase/engine";
import {
  BANDS,
  BUST_STEPS,
  CAT_NAMES,
  bandIndex,
  bustStep,
  hailName,
  lclFt,
  modeBlurb,
  percentile,
  plainNote,
  type DeskNote,
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

/** Storm Chasing Outlook in VIP's order: the day's score, the targets map, each target, bust odds. */
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
  const spc = useLayer("spc1");
  const [t1, t2] = day.targets;
  if (!t1)
    return (
      <p className={s.card}>
        No candidate scored today. Check back after SPC&apos;s next outlook.
      </p>
    );
  const notes = day.targets.map((t, i) => day.desk?.targets[i] ?? plainNote(t));
  const ten = (t1.score / 10).toFixed(1);
  return (
    <div className="grid gap-4">
      <p className={s.date}>
        <CalendarRange aria-hidden />
        {new Date(`${day.day}T12:00:00Z`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        })}
      </p>
      <section
        className={s.gauge}
        style={{ ["--c" as string]: band(t1.score) }}
      >
        <svg viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="78" className={s.track} />
          <circle
            cx="100"
            cy="100"
            r="78"
            className={s.arc}
            strokeDasharray={`${(t1.score / 100) * 490} 490`}
            transform="rotate(-90 100 100)"
          />
          {Array.from({ length: 10 }, (_, i) => (
            <line
              key={i}
              x1="100"
              y1="34"
              x2="100"
              y2="40"
              className={s.tick}
              transform={`rotate(${i * 36} 100 100)`}
            />
          ))}
        </svg>
        <div className={s.gaugeNum}>
          <b>{ten}</b>
          <span>out of 10</span>
        </div>
        <small>Today&apos;s chase potential</small>
        <h2>{BANDS[bandIndex(t1.score)].label}</h2>
        <p>
          {day.desk?.summary ??
            (day.quiet
              ? `A quiet day: no SPC marginal risk or higher. The best of the usual chase country is ${t1.place}.`
              : `${t1.mode.mode}: ${t1.place.replace(/^near /, "around ")}${t2 ? `, with a second option ${t2.place.replace(/^near /, "around ")}` : ""}.`)}
        </p>
      </section>
      <section className={s.mapCard}>
        <header>
          <h3>
            <Crosshair aria-hidden /> Today&apos;s targets
          </h3>
          <span>
            <i style={{ background: spc.layer?.legend.at(-1)?.color }} />
            SPC {CAT_NAMES[day.spcTop]} · {day.candidates} points scored
          </span>
        </header>
        <UsMap
          title="Today's chase targets"
          sub={null}
          legend={day.targets.map((x) => ({
            label: x.rank === 1 ? "Best target" : "Alternative",
            color: x.rank === 1 ? band(x.score) : band(0),
          }))}
          status={spc.status === "loading" ? "loading" : "ready"}
          file="sswx-chase-targets"
          actions={false}
          overlay={
            <g>
              {day.targets.map((x) => {
                const p = project(x.lon, x.lat);
                const c = x.rank === 1 ? band(x.score) : band(0);
                return (
                  <g key={x.rank} transform={`translate(${p.x} ${p.y})`}>
                    <circle r={22} fill={c} opacity={0.22} />
                    <circle r={8} fill="none" stroke={c} strokeWidth={2.5} />
                    <path
                      d="M-5 -5 L5 5 M5 -5 L-5 5"
                      stroke={c}
                      strokeWidth={2.5}
                    />
                    <g transform="translate(0 20)">
                      <rect
                        x={-x.place.length * 3.4 - 6}
                        y={-9}
                        width={x.place.length * 6.8 + 12}
                        height={18}
                        rx={4}
                        fill="var(--bg)"
                        stroke={c}
                        strokeWidth={1}
                      />
                      <text
                        y={4}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={700}
                        fill="var(--text)"
                      >
                        {x.place}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          }
        >
          {spc.layer && <Polys polys={spc.layer.polys} />}
        </UsMap>
        <p className={s.small}>
          Held at least 250 km apart, so they are two chases, not one.
        </p>
      </section>
      {day.targets.map((t, i) => (
        <TargetCard
          key={t.rank}
          t={t}
          note={notes[i]}
          c={t.rank === 1 ? band(t.score) : band(0)}
          ai={!!day.desk}
        />
      ))}
      <section className={s.bustIntro}>
        <h3>
          <ShieldAlert aria-hidden /> Bust risk
        </h3>
        <p>
          Bust risk is the chance you drive all that way and nothing worth
          seeing happens. It comes from the three ways a chase day actually
          dies: the cap never breaks, nothing lifts the air, or the storms are
          junk when they finally go. A high number is not a reason to hide it.
        </p>
      </section>
      {day.targets.map((t, i) => (
        <BustCard key={t.rank} t={t} note={notes[i]} ai={!!day.desk} />
      ))}
      <details className={s.more}>
        <summary>
          <Gauge aria-hidden /> Every parameter, side by side
        </summary>
        <Params a={t1} b={t2} />
      </details>
      <details className={s.more}>
        <summary>
          <CalendarRange aria-hidden /> How today ranks this year
        </summary>
        <Yearly ledger={ledger} today={day.day} band={band} />
      </details>
      <details className={s.more}>
        <summary>
          <ExternalLink aria-hidden /> Chaser resources
        </summary>
        <ul className={s.resources}>
          {RESOURCES.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.label}
              </a>
              <span>{r.desc}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className={s.foot}>
        This is decision support, not a substitute for official SPC outlooks,
        watches and warnings. Targets are computed from model data and can be
        wrong; the bust probability on every target exists because sometimes
        they are. Chase safe, chase with a partner, and never let a forecast
        talk you into a road you can&apos;t see the end of.
      </p>
    </div>
  );
}

const RESOURCES = [
  {
    label: "SPC Mesoanalysis",
    url: "https://www.spc.noaa.gov/exper/mesoanalysis/",
    desc: "Live CAPE, shear and composite parameters, hour by hour.",
  },
  {
    label: "SPC Day 1 Outlook",
    url: "https://www.spc.noaa.gov/products/outlook/day1otlk.html",
    desc: "The official risk areas and discussion.",
  },
  {
    label: "Pivotal Weather",
    url: "https://www.pivotalweather.com/model.php",
    desc: "Model soundings and convection-allowing models.",
  },
  {
    label: "NWS Radar",
    url: "https://radar.weather.gov/",
    desc: "Single-site radar for the storm in front of you.",
  },
  {
    label: "Spotter Network",
    url: "https://www.spotternetwork.org/",
    desc: "Report what you see; position reports for chasers.",
  },
];

function Tile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={s.tile}>
      {icon}
      <small>{label}</small>
      <b>{value}</b>
      <span>{sub}</span>
    </div>
  );
}

function TargetCard({
  t,
  note,
  c,
  ai,
}: {
  t: Target;
  note: DeskNote;
  c: string;
  ai: boolean;
}) {
  const h = t.hour;
  const lcl = lclFt(h.temp, h.dew);
  return (
    <article className={s.target} style={{ ["--c" as string]: c }}>
      <header>
        <small>Target {t.rank}</small>
        <h3>{t.place}</h3>
        {t.mode.flavor !== "n/a" && <em>{t.mode.flavor}</em>}
      </header>
      <div className={s.body}>
        <h4>{t.mode.mode}</h4>
        <p className={s.muted}>{modeBlurb(t.mode)}</p>
        <div className={s.tiles}>
          <Tile
            icon={<Wind aria-hidden />}
            label="Motion"
            value={`${h.motionMph}`}
            sub={`mph toward ${toward(h.motionTo)}`}
          />
          <Tile
            icon={<CloudHail aria-hidden />}
            label="Hail"
            value={t.mode.hailIn ? `${t.mode.hailIn}″` : "–"}
            sub={t.mode.hailIn ? hailName(t.mode.hailIn) : "little"}
          />
          <Tile
            icon={<Clock aria-hidden />}
            label="Peak"
            value={ct(t.peak).replace(":00", "").replace(" CT", "")}
            sub={`${t.hoursToSunset}h light`}
          />
        </div>
        <section className={s.desk}>
          <small>
            <Brain aria-hidden /> SSWX Forecast Desk
          </small>
          <p>{note.desk}</p>
        </section>
        <div className={s.threat} data-k="tornado">
          <small>
            <Tornado aria-hidden /> Tornado
          </small>
          <p>{note.tornado}</p>
        </div>
        <div className={s.threat} data-k="hail">
          <small>
            <CloudHail aria-hidden /> Hail
          </small>
          <p>{note.hail}</p>
        </div>
        <div className={s.threat} data-k="wind">
          <small>
            <Wind aria-hidden /> Wind
          </small>
          <p>{note.wind}</p>
        </div>
        <ul className={s.why}>
          {[...t.why, ...t.mode.notes].map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <div className={s.chips}>
          <span>
            Freezing level <b>{h.freezingFt.toLocaleString("en-US")} ft</b>
          </span>
          <span>
            Cloud base <b>{lcl.toLocaleString("en-US")} ft</b>
          </span>
          {h.rh700 != null && (
            <span>
              700mb RH <b>{h.rh700} %</b>
            </span>
          )}
          <span>
            STP <b>{h.stp}</b>
          </span>
          <span>
            SPC <b>{CAT_NAMES[t.spc.cat]}</b>
          </span>
        </div>
        {!ai && (
          <p className={s.small}>
            Written from the numbers above; the forecast desk&apos;s notes
            arrive with the next daily run.
          </p>
        )}
      </div>
    </article>
  );
}

function BustCard({ t, note, ai }: { t: Target; note: DeskNote; ai: boolean }) {
  const h = t.hour;
  const step = bustStep(t.bust.pct);
  const cin = Math.abs(h.cin);
  const tone = ["ok", "ok", "mid", "bad", "bad"][step];
  return (
    <article className={s.bustCard} data-tone={tone}>
      <header>
        <small>Target {t.rank}</small>
        <h3>{t.place}</h3>
      </header>
      <div className={s.body}>
        <div className={s.bustHead}>
          <b>
            {t.bust.pct}
            <span>%</span>
          </b>
          <em>
            {BUST_STEPS[step][0].toUpperCase() + BUST_STEPS[step].slice(1)}
          </em>
          <small>Chance of a bust</small>
        </div>
        <div className={s.steps}>
          {BUST_STEPS.map((x, i) => (
            <span key={x} data-on={i <= step || undefined}>
              <i />
              {x}
            </span>
          ))}
        </div>
        <section className={s.desk}>
          <small>
            <Brain aria-hidden /> SSWX Forecast Desk
          </small>
          <p>{note.bust}</p>
        </section>
        <div className={s.bustTiles}>
          <div data-tone={cin < 50 ? "ok" : cin < 150 ? "mid" : "bad"}>
            <small>Cap strength</small>
            <b>{cin} J/kg</b>
            <span>{cin < 50 ? "Weak" : cin < 150 ? "Moderate" : "Strong"}</span>
          </div>
          <div
            data-tone={
              h.w700 == null
                ? ""
                : h.w700 > 0.02
                  ? "ok"
                  : h.w700 < -0.02
                    ? "bad"
                    : "mid"
            }
          >
            <small>Large-scale ascent</small>
            <b>{h.w700 != null ? `${h.w700} m/s` : "–"}</b>
            <span>
              {h.w700 == null
                ? "not in this run"
                : h.w700 > 0.02
                  ? "Rising air"
                  : h.w700 < -0.02
                    ? "Sinking air"
                    : "Weak"}
            </span>
          </div>
          <div data-tone={h.pop >= 40 ? "ok" : h.pop >= 20 ? "mid" : "bad"}>
            <small>Precip chance</small>
            <b>{h.pop}%</b>
            <span>
              {h.pop >= 60
                ? "Widespread"
                : h.pop >= 40
                  ? "Likely"
                  : h.pop >= 20
                    ? "Scattered"
                    : "Very low"}
            </span>
          </div>
          <div
            data-tone={
              t.hoursToSunset >= 3
                ? "ok"
                : t.hoursToSunset >= 1.5
                  ? "mid"
                  : "bad"
            }
          >
            <small>Daylight after peak</small>
            <b>{t.hoursToSunset} h</b>
            <span>
              {t.hoursToSunset >= 3
                ? "Plenty"
                : t.hoursToSunset >= 1.5
                  ? "Tight"
                  : "Racing dark"}
            </span>
          </div>
        </div>
        {!ai && t.bust.reasons.length === 0 && (
          <p className={s.small}>No flagged failure modes in the numbers.</p>
        )}
      </div>
    </article>
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
