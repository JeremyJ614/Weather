"use client";

import { ArrowUp, Clock, CloudHail, Tornado, Trophy, Wind } from "lucide-react";
import type { Target } from "@/lib/chase/engine";
import {
  BUST_STEPS,
  YEARLY_MEANING,
  bustStep,
  derive,
  hailName,
  modeBlurb,
  percentile,
  type DeskNote,
} from "@/lib/chase/score";
import { PARAM_GROUPS, betterOf, fillFor, valueOf } from "@/lib/chase/params";
import {
  Desk,
  Head,
  ct,
  fmt,
  shortDate,
  ten,
  toward,
  tv,
  type Ledger,
  type Tone,
} from "./ChaseParts";
import s from "./Chase.module.css";
import { InfoScrub } from "@/components/charts/InfoScrub";

/** The four tabs after Overview, loaded when first opened. */
export function ParamsPanel({
  targets,
  tone,
}: {
  targets: Target[];
  tone: Tone;
}) {
  const [a, b] = targets;
  const da = derive(a.hour);
  const db = b ? derive(b.hour) : null;
  return (
    <div className={s.panel}>
      <p className={s.compare}>
        At the peak hour ·
        <span className={s.tag} style={tv(tone(a))}>
          <i /> {a.place}
        </span>
        {b && (
          <>
            vs
            <span className={s.tag} style={tv(tone(b))}>
              <i /> {b.place}
            </span>
          </>
        )}
      </p>
      {PARAM_GROUPS.map((g) => {
        const rows = g.rows
          .map((r) => ({
            r,
            va: valueOf(r, a.hour, da),
            vb: b && db ? valueOf(r, b.hour, db) : null,
          }))
          .filter((x) => x.va != null || x.vb != null);
        if (!rows.length) return null;
        return (
          <section key={g.title} className={s.group}>
            <header>
              <h3>{g.title}</h3>
              <p>{g.blurb}</p>
            </header>
            {rows.map(({ r, va, vb }, i) => {
              const win = va != null && vb != null ? betterOf(r, va, vb) : -1;
              return (
                <div key={r.id} className={s.row}>
                  <div className={s.rowTop}>
                    <span>
                      {r.label}
                      {r.unit && <small>{r.unit}</small>}
                    </span>
                    <span className={s.reads}>
                      {[va, vb].map((v, k) =>
                        k === 1 && !b ? null : (
                          <span
                            key={k}
                            data-win={win === k || undefined}
                            style={tv(tone(k ? b! : a))}
                          >
                            <b>{v == null ? "–" : fmt(v)}</b>
                            {v != null && r.read(v) && (
                              <small>{r.read(v)}</small>
                            )}
                          </span>
                        ),
                      )}
                    </span>
                  </div>
                  <div className={s.bars}>
                    {[va, vb].map((v, k) =>
                      v == null || (k === 1 && !b) ? null : (
                        <span
                          key={k}
                          className={s.bar}
                          style={tv(tone(k ? b! : a))}
                        >
                          <i
                            style={{
                              transform: `scaleX(${fillFor(r, v)})`,
                              ["--d" as string]: `${i * 40 + k * 80}ms`,
                            }}
                          />
                        </span>
                      ),
                    )}
                  </div>
                  {va != null && r.effect(va) && (
                    <p className={s.effect}>{r.effect(va)}</p>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      <p className={s.small}>
        Lapse rates, mixing ratio, the supercell, hail and energy-helicity
        composites and the wet-bulb zero are worked out from the model&apos;s
        levels (surface, 850, 700 and 500 mb), the same way SPC&apos;s formulas
        define them.
      </p>
    </div>
  );
}

export function ModePanel({
  targets,
  notes,
  tone,
}: {
  targets: Target[];
  notes: DeskNote[];
  tone: Tone;
}) {
  return (
    <div className={s.panel}>
      {targets.map((t, i) => {
        const c = tone(t);
        const h = t.hour;
        const d = derive(h);
        return (
          <article key={t.rank} className={s.card} style={tv(c)}>
            <Head t={t} c={c}>
              {t.mode.flavor !== "n/a" && (
                <span className={s.flavor}>{t.mode.flavor}</span>
              )}
            </Head>
            <div>
              <p className={s.modeName}>{t.mode.mode}</p>
              <p className={s.small}>{modeBlurb(t.mode)}</p>
            </div>
            <div className={s.modeStats}>
              <div>
                <span
                  className={s.compass}
                  style={{ ["--deg" as string]: `${h.motionTo}deg` }}
                >
                  <ArrowUp aria-hidden />
                </span>
                <small>Motion</small>
                <b>{h.motionMph}</b>
                <span>mph toward {toward(h.motionTo)}</span>
              </div>
              <div>
                <CloudHail aria-hidden />
                <small>Hail</small>
                <b>{t.mode.hailIn ? `${t.mode.hailIn}″` : "–"}</b>
                <span>
                  {t.mode.hailIn ? hailName(t.mode.hailIn) : "little"}
                </span>
              </div>
              <div>
                <Clock aria-hidden />
                <small>Peak</small>
                <b>{ct(t.peak).replace(":00", "").replace(" CT", "")}</b>
                <span>
                  {t.hoursToSunset > 0
                    ? `${t.hoursToSunset} h light`
                    : "after dark"}
                </span>
              </div>
            </div>
            <Desk text={notes[i].desk} />
            {(
              [
                ["tornado", Tornado, notes[i].tornado],
                ["hail", CloudHail, notes[i].hail],
                ["wind", Wind, notes[i].wind],
              ] as const
            ).map(([k, Icon, text]) => (
              <div key={k} className={s.threat} data-k={k}>
                <Icon aria-hidden />
                <div>
                  <small>{k}</small>
                  <p>{text}</p>
                </div>
              </div>
            ))}
            {t.mode.notes.length > 0 && (
              <ul className={s.why}>
                {t.mode.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <div className={s.chips}>
              <span>
                Freezing level <b>{h.freezingFt.toLocaleString("en-US")}</b> ft
              </span>
              {d.wbzFt != null && (
                <span>
                  Wet-bulb zero <b>{d.wbzFt.toLocaleString("en-US")}</b> ft
                </span>
              )}
              {h.rh700 != null && (
                <span>
                  700 mb RH <b>{h.rh700}%</b>
                </span>
              )}
              {d.ship != null && (
                <span>
                  SHIP <b>{d.ship.toFixed(2)}</b>
                </span>
              )}
              <span>
                Cloud base <b>{d.lcl.toLocaleString("en-US")}</b> ft
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function BustPanel({
  targets,
  notes,
}: {
  targets: Target[];
  notes: DeskNote[];
}) {
  return (
    <div className={s.panel}>
      <p className={s.small}>
        Bust risk is the chance you drive all that way and nothing worth seeing
        happens. It comes from the three ways a chase day actually dies: the cap
        never breaks, nothing lifts the air, or the storms are junk when they
        finally go. A high number is not a reason to hide it.
      </p>
      {targets.map((t, i) => {
        const h = t.hour;
        const step = bustStep(t.bust.pct);
        const cin = Math.abs(h.cin);
        return (
          <article
            key={t.rank}
            className={`${s.card} ${s.bustCard}`}
            data-tone={["ok", "ok", "mid", "hi", "bad"][step]}
            style={tv("var(--b)")}
          >
            <Head t={t} c="var(--b)">
              <span />
            </Head>
            <div className={s.bustHead}>
              <div>
                <b>
                  {t.bust.pct}
                  <span>%</span>
                </b>
                <small>chance of a bust</small>
              </div>
              <em>
                {BUST_STEPS[step][0].toUpperCase() + BUST_STEPS[step].slice(1)}
              </em>
            </div>
            <div className="grid gap-1">
              <div className={s.meter}>
                <i style={{ transform: `scaleX(${t.bust.pct / 100})` }} />
                {[15, 30, 50, 70].map((m) => (
                  <u key={m} style={{ left: `${m}%` }} />
                ))}
              </div>
              <div className={s.steps}>
                {BUST_STEPS.map((x, k) => (
                  <span key={x} data-on={k === step || undefined}>
                    {x}
                  </span>
                ))}
              </div>
            </div>
            <Desk text={notes[i].bust} />
            <div className={s.drivers}>
              <div data-bad={cin >= 150 || undefined}>
                <small>Cap strength</small>
                <b>{cin} J/kg</b>
                <span>
                  {cin >= 250
                    ? "Hard cap"
                    : cin >= 150
                      ? "Strong"
                      : cin >= 50
                        ? "In place"
                        : "Weak"}
                </span>
              </div>
              <div data-bad={(h.w700 ?? 0) < 0.02 || undefined}>
                <small>Large-scale lift</small>
                <b>{h.w700 != null ? `${h.w700} m/s` : "–"}</b>
                <span>
                  {h.w700 == null
                    ? "not in this run"
                    : h.w700 > 0.15
                      ? "Strong"
                      : h.w700 > 0.02
                        ? "Rising air"
                        : h.w700 < -0.02
                          ? "Sinking air"
                          : "Weak"}
                </span>
              </div>
              <div data-bad={h.pop < 30 || undefined}>
                <small>Precip chance</small>
                <b>{h.pop}%</b>
                <span>
                  {h.pop >= 60
                    ? "Good"
                    : h.pop >= 30
                      ? "Scattered"
                      : h.pop >= 20
                        ? "Low"
                        : "Very low"}
                </span>
              </div>
              <div data-bad={t.hoursToSunset < 1.5 || undefined}>
                <small>Daylight after peak</small>
                <b>{t.hoursToSunset > 0 ? `${t.hoursToSunset} h` : "none"}</b>
                <span>
                  {t.hoursToSunset >= 3
                    ? "Comfortable"
                    : t.hoursToSunset >= 1.5
                      ? "Tight"
                      : t.hoursToSunset > 0
                        ? "Racing dark"
                        : "Night chase"}
                </span>
              </div>
            </div>
            {t.bust.reasons.length > 0 ? (
              <ul className={s.why}>
                {t.bust.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className={s.small}>
                No flagged failure modes in the numbers.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function YearlyPanel({
  ledger,
  today,
  score,
  rank,
  band,
}: {
  ledger: Ledger;
  today: string;
  score: number;
  rank: number;
  band: (n: number) => string;
}) {
  const others = ledger.filter((l) => l.day !== today);
  const scores = others.map((l) => l.top_score);
  const sorted = [...scores].sort((x, y) => x - y);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const best = [...ledger].sort((x, y) => y.top_score - x.top_score);
  const beats = scores.length
    ? Math.round((scores.filter((x) => x < score).length / scores.length) * 100)
    : null;
  const rebuilt = ledger.filter(
    (l) => l.generated_at && l.generated_at.slice(0, 10) > l.day,
  ).length;
  const meaning = YEARLY_MEANING[rank];
  // The season strip: one bar per day from January 1 to today.
  const year = today.slice(0, 4);
  const start = Date.parse(`${year}-01-01T12:00:00Z`);
  const span =
    Math.round((Date.parse(`${today}T12:00:00Z`) - start) / 864e5) + 1;
  const W = 360;
  const bw = W / Math.max(span, 1);
  const byDay = new Map(ledger.map((l) => [l.day, l]));
  return (
    <div className={s.panel}>
      <section className={s.card}>
        <p className={s.kicker} style={{ textAlign: "center" }}>
          Against the rest of the year
        </p>
        <div className={s.trophies}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              data-on={n <= rank || undefined}
              style={{ ["--i" as string]: n }}
            >
              <Trophy aria-hidden />
            </span>
          ))}
        </div>
        <div className={s.rankText}>
          <b>{rank} of 5</b>
          <strong>{meaning.title}</strong>
          <p>{meaning.body}</p>
        </div>
      </section>
      <div className={s.ledger}>
        <div>
          <small>Days recorded</small>
          <b>{ledger.length}</b>
          <span>
            {ledger[0] ? `since ${shortDate(ledger[0].day)}` : "starting today"}
          </span>
        </div>
        <div>
          <small>Best so far</small>
          <b>{best[0] ? ten(best[0].top_score) : "–"}</b>
          <span>{best[0] ? shortDate(best[0].day) : ""}</span>
        </div>
        <div>
          <small>Typical day</small>
          <b>{median != null ? ten(median) : "–"}</b>
          <span>the year&apos;s median</span>
        </div>
        <div>
          <small>Today beats</small>
          <b>{beats != null ? `${beats}%` : "–"}</b>
          <span>of this year&apos;s days</span>
        </div>
      </div>
      <section className={`${s.card} ${s.strip}`}>
        <h4 className={s.h4}>
          <Trophy aria-hidden /> The {year} season, day by day
        </h4>
        <svg
          viewBox={`0 0 ${W} 112`}
          role="group"
          aria-label={`Daily chase scores in ${year}`}
        >
          <g className={s.bars2}>
            {Array.from({ length: span }, (_, i) => {
              const iso = new Date(start + i * 864e5)
                .toISOString()
                .slice(0, 10);
              const l = byDay.get(iso);
              if (!l) return null;
              const hgt = Math.max(1.5, (l.top_score / 100) * 92);
              return (
                <rect
                  key={iso}
                  x={i * bw}
                  y={96 - hgt}
                  width={Math.max(0.8, bw - 0.6)}
                  height={hgt}
                  fill={band(l.top_score)}
                  opacity={iso === today ? 1 : 0.75}
                >
                  <title>{`${shortDate(iso)}: ${ten(l.top_score)}${l.place ? ` · ${l.place}` : ""}`}</title>
                </rect>
              );
            })}
          </g>
          <line
            x1={(span - 0.5) * bw}
            x2={(span - 0.5) * bw}
            y1={0}
            y2={96}
            stroke="var(--text)"
            strokeDasharray="2 3"
            strokeOpacity={0.6}
          />
          {Array.from({ length: 12 }, (_, m) => {
            const d = Date.parse(
              `${year}-${String(m + 1).padStart(2, "0")}-01T12:00:00Z`,
            );
            const i = Math.round((d - start) / 864e5);
            return i < span ? (
              <text key={m} x={i * bw + 1} y={109} className={s.months}>
                {new Date(d).toLocaleDateString("en-US", {
                  month: "short",
                  timeZone: "UTC",
                })}
              </text>
            ) : null;
          })}
          {(() => {
            const days = Array.from({ length: span }, (_, i) => {
              const iso = new Date(start + i * 864e5)
                .toISOString()
                .slice(0, 10);
              return { iso, l: byDay.get(iso) };
            });
            return (
              <InfoScrub
                label={`Daily chase scores in ${year}`}
                x0={bw / 2}
                x1={(span - 0.5) * bw}
                top={4}
                bottom={96}
                width={W}
                height={112}
                lit={false}
                start={span - 1}
                title={(i) => shortDate(days[i].iso)}
                series={[
                  {
                    key: "score",
                    label: "Score",
                    color: "var(--accent)",
                    y: days.map(({ l }) =>
                      l ? 96 - Math.max(1.5, (l.top_score / 100) * 92) : null,
                    ),
                    text: days.map(({ l }) =>
                      l ? `${ten(l.top_score)} / 10` : null,
                    ),
                  },
                ]}
                rows={(i) =>
                  days[i].l?.place
                    ? [{ label: "Target", text: days[i].l!.place! }]
                    : []
                }
              />
            );
          })()}
        </svg>
        <p className={s.small}>
          Each bar is that day&apos;s best score out of 10; the dashed line is
          today. Drag across the bars to read each day.
        </p>
      </section>
      {best.length > 0 && (
        <section className={s.card}>
          <h4 className={s.h4}>
            <Trophy aria-hidden /> Top days this year
          </h4>
          <ol className={s.top5}>
            {best.slice(0, 5).map((l, i) => (
              <li key={l.day} data-today={l.day === today || undefined}>
                <i>{i + 1}</i>
                <span>
                  {shortDate(l.day)} <small>{l.place ?? ""}</small>
                </span>
                <b style={{ color: band(l.top_score) }}>{ten(l.top_score)}</b>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className={s.card}>
        <h4 className={s.h4}>What the five levels mean</h4>
        <ol className={s.levels}>
          {[5, 4, 3, 2, 1].map((n) => (
            <li key={n} data-on={n === rank || undefined}>
              <i>{n}</i>
              <span>
                <b>{YEARLY_MEANING[n].title}.</b> {YEARLY_MEANING[n].body}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <p className={s.small}>
        Read straight from every day the engine has scored this year
        {rebuilt
          ? `; ${rebuilt} earlier days were rebuilt from SPC's archived outlooks and archived model runs, on fewer points than the live scan`
          : ""}
        . Today ranks at the {percentile(score, scores)}th percentile.
      </p>
    </div>
  );
}
