"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudHail, MapPin, Moon, Sunset, Tornado, Wind } from "lucide-react";
import { usePlaces } from "@/features/location/usePlaces";
import {
  HAZ,
  HAZARDS,
  RISK,
  days,
  isNight,
  leader,
  riskIndex,
  worstWindow,
  type Haz,
} from "@/lib/timing/calc";
import s from "./Timing.module.css";
import { InfoScrub } from "@/components/charts/InfoScrub";

type Hour = {
  time: string;
  cape: number;
  srh: number;
  shear: number;
  li: number;
  swti: number;
  /** SWTI held back by the instability available (see lib/timing). */
  threat: number;
  prob: Record<Haz, number>;
};
type Data = {
  hours: Hour[];
  sun: { date: string; rise: string; set: string }[];
};
export type TimingColors = { haz: Record<Haz, string>; risk: string[] };

const ICON = { tornado: Tornado, wind: Wind, hail: CloudHail } as const;
const at = (t: string) => new Date(`${t}:00`);
const hr = (t: string) =>
  at(t).toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", "");
const dayName = (t: string, i: number) =>
  i === 0
    ? "Today"
    : at(t.length > 10 ? t : `${t}T12:00`).toLocaleDateString("en-US", {
        weekday: "long",
      });
const full = (t: string) =>
  at(t).toLocaleString("en-US", { weekday: "short", hour: "numeric" });

/** A hazard's shape across the window, card size. */
function Spark({ vals, color }: { vals: number[]; color: string }) {
  const hi = Math.max(1, ...vals);
  const pts = vals
    .map(
      (v, i) =>
        `${((i / (vals.length - 1)) * 100).toFixed(1)},${(28 - (v / hi) * 24).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={s.spark}
      aria-hidden
    >
      <polyline
        points={`0,30 ${pts} 100,30`}
        fill={color}
        fillOpacity={0.14}
        stroke="none"
      />
      <polyline points={pts} fill="none" stroke={color} />
    </svg>
  );
}

/** Storm Timing Index for the active place: when the atmosphere is at its worst, and for how long. */
export function TimingView({ colors }: { colors: TimingColors }) {
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : "";
  const [res, setRes] = useState<{ key: string; data: Data | null } | null>(
    null,
  );
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    let live = true;
    const k = `${active.lat},${active.lon}`;
    fetch(`/api/ingredients?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d) => live && setRes({ key: k, data: d?.hours?.length ? d : null }),
      )
      .catch(() => live && setRes({ key: k, data: null }));
    return () => {
      live = false;
    };
  }, [active]);
  const data = res?.key === key ? res.data : undefined;
  const hours = useMemo(() => data?.hours ?? [], [data]);
  const night = useMemo(
    () => hours.map((h) => isNight(h.time, data?.sun ?? [])),
    [hours, data],
  );

  if (!active)
    return <p className={s.empty}>Save a place to see its storm timing.</p>;
  if (data === undefined)
    return <div className={s.skeleton} aria-label="Loading" />;
  if (!data)
    return (
      <p className={s.empty}>
        The model feed isn&apos;t answering right now, so there&apos;s no timing
        to show. Try again in a few minutes.
      </p>
    );

  const win = worstWindow(hours.map((x) => ({ swti: x.threat })));
  const top = Math.max(...hours.map((h) => h.threat));
  const ri = riskIndex(top);
  const tone = colors.risk[ri];
  const i = sel ?? 0;
  const h = hours[i];
  const lead = (x: Hour) => leader(x.prob);
  const max = Math.max(20, top);
  const peakOf = (k: Haz) =>
    hours.reduce((b, x, j) => (x.prob[k] > hours[b].prob[k] ? j : b), 0);
  const perDay = days(hours.map((x) => ({ ...x, swti: x.threat }))).slice(0, 3);
  const firstSet = data.sun.find((x) => x.set > hours[0].time)?.set;

  // Probability chart geometry.
  const W = 340;
  const H = 130;
  const pmax = Math.max(
    10,
    ...hours.flatMap((x) => HAZARDS.map((k) => x.prob[k])),
  );
  const X = (j: number) => 8 + (j / Math.max(1, hours.length - 1)) * (W - 16);
  const Y = (v: number) => H - 14 - (v / pmax) * (H - 26);
  const nightRuns: [number, number][] = [];
  night.forEach((n, j) => {
    if (n && (j === 0 || !night[j - 1])) nightRuns.push([j, j]);
    if (n) nightRuns[nightRuns.length - 1][1] = j;
  });

  return (
    <div className={s.wrap}>
      <p className={s.place}>
        <MapPin aria-hidden /> {active.label} · next {hours.length} hours
      </p>

      <section className={s.answer} style={{ ["--tone" as string]: tone }}>
        <span className={s.badge}>{RISK[ri].label}</span>
        {win ? (
          <>
            <p className={s.eyebrow}>Worst window</p>
            <h2 className={s.window}>
              {full(hours[win.start].time)} <span>→</span>{" "}
              {hr(hours[win.end].time)}
            </h2>
            <p className={s.peak}>
              Peaks {full(hours[win.peak].time)} at {hours[win.peak].threat} ·{" "}
              {HAZ[lead(hours[win.peak])].label} leads
            </p>
            {night[win.peak] && (
              <p className={s.night}>
                <Moon aria-hidden /> The peak falls after dark. Night storms are
                the ones people sleep through; have a way to be woken.
              </p>
            )}
          </>
        ) : (
          <>
            <p className={s.eyebrow}>All clear</p>
            <h2 className={s.window}>Nothing organized</h2>
            <p className={s.peak}>
              No stretch in the next {hours.length} hours reaches Marginal.
            </p>
          </>
        )}
      </section>

      <section className={s.card}>
        <div className={s.head}>
          <h3>Hour by hour</h3>
          {firstSet && (
            <span>
              <Sunset aria-hidden /> Sunset {hr(firstSet)}
            </span>
          )}
        </div>
        <div className={s.ribbon} role="listbox" aria-label="Hours">
          {hours.map((x, j) => {
            const k = lead(x);
            const lit = x.threat >= 8;
            return (
              <button
                key={x.time}
                role="option"
                aria-selected={j === i}
                aria-label={`${full(x.time)}: ${x.threat}, ${HAZ[k].label} leads`}
                onClick={() => setSel(j)}
                className={`${s.cell} ${night[j] ? s.dark : ""} ${x.time.endsWith("T00:00") ? s.midnight : ""}`}
                style={{ ["--d" as string]: `${j * 8}ms` }}
              >
                <i
                  style={{
                    transform: `scaleY(${Math.max(0.05, x.threat / max)})`,
                    background: lit ? colors.haz[k] : undefined,
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className={s.ticks} aria-hidden>
          {hours.map((x, j) =>
            j % 12 === 0 ? (
              <span
                key={x.time}
                style={{ left: `${((j + 0.5) / hours.length) * 100}%` }}
              >
                {j === 0 ? "Now" : hr(x.time)}
              </span>
            ) : null,
          )}
        </div>
        <div className={s.detail} aria-live="polite">
          <b>
            {sel === null ? "Now" : full(h.time)}
            {night[i] && <Moon aria-hidden />}
          </b>
          <span style={{ color: colors.risk[riskIndex(h.threat)] }}>
            {h.threat} · {RISK[riskIndex(h.threat)].label}
          </span>
          <span className={s.probs}>
            {HAZARDS.map((k) => (
              <em key={k} style={{ color: colors.haz[k] }}>
                {HAZ[k].label} {h.prob[k].toFixed(0)}%
              </em>
            ))}
          </span>
          <small>
            CAPE {h.cape} · SRH {h.srh} · shear {h.shear} kt · LI {h.li}
          </small>
        </div>
      </section>

      <ol className={s.days}>
        {perDay.map((d, j) => {
          const w = d.window;
          const di = riskIndex(d.peak);
          return (
            <li
              key={d.date}
              className={s.day}
              style={{
                ["--tone" as string]: colors.risk[di],
                ["--i" as string]: j,
              }}
            >
              <b>{dayName(d.date, j)}</b>
              <span className={s.dayRisk}>{RISK[di].label}</span>
              <small>
                {w
                  ? `${w.start === w.end ? hr(d.hours[w.start].time) : `${hr(d.hours[w.start].time)}–${hr(d.hours[w.end].time)}`}, peak ${d.peak}`
                  : "Quiet"}
              </small>
            </li>
          );
        })}
      </ol>

      <div className={s.hazards}>
        {HAZARDS.map((k) => {
          const pk = peakOf(k);
          const v = hours[pk].prob[k];
          const live = v >= HAZ[k].trigger;
          const Icon = ICON[k];
          return (
            <section
              key={k}
              className={s.haz}
              style={{ ["--c" as string]: colors.haz[k] }}
              data-live={live || undefined}
            >
              <div className={s.hazTop}>
                <Icon aria-hidden />
                <span>{HAZ[k].label}</span>
                <b>{v.toFixed(1)}%</b>
              </div>
              <Spark vals={hours.map((x) => x.prob[k])} color={colors.haz[k]} />
              <small>
                {live
                  ? `peaks ${full(hours[pk].time)}`
                  : "stays below its threshold"}
              </small>
            </section>
          );
        })}
      </div>

      <section className={s.card}>
        <div className={s.head}>
          <h3>Chances by hour</h3>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={s.chart}
          role="group"
          aria-label="Chances by hour"
        >
          {nightRuns.map(([a, b]) => (
            <rect
              key={a}
              x={X(a)}
              y={4}
              width={Math.max(2, X(b) - X(a))}
              height={H - 16}
              className={s.nightBand}
            />
          ))}
          <line
            x1={8}
            x2={W - 8}
            y1={Y(HAZ.tornado.trigger)}
            y2={Y(HAZ.tornado.trigger)}
            stroke={colors.haz.tornado}
            className={s.trigger}
          />
          {HAZARDS.map((k) => (
            <path
              key={k}
              d={hours
                .map(
                  (x, j) =>
                    `${j ? "L" : "M"}${X(j).toFixed(1)} ${Y(x.prob[k]).toFixed(1)}`,
                )
                .join(" ")}
              stroke={colors.haz[k]}
              className={s.line}
            />
          ))}
          {sel !== null && (
            <line x1={X(i)} x2={X(i)} y1={4} y2={H - 12} className={s.cursor} />
          )}
          <InfoScrub
            label="Chances by hour"
            x0={X(0)}
            x1={X(hours.length - 1)}
            top={4}
            bottom={H - 14}
            width={W}
            height={H}
            start={i}
            onIndex={setSel}
            title={(j) => full(hours[j].time)}
            series={HAZARDS.map((k) => ({
              key: k,
              label: HAZ[k].label,
              color: colors.haz[k],
              y: hours.map((x) => Y(x.prob[k])),
              text: hours.map((x) => `${Math.round(x.prob[k])}%`),
            }))}
            rows={(j) =>
              night[j] ? [{ label: "After dark", text: "Night" }] : []
            }
          />
        </svg>
        <div className={s.legend}>
          {HAZARDS.map((k) => (
            <span key={k}>
              <i style={{ background: colors.haz[k] }} /> {HAZ[k].label}
            </span>
          ))}
          <span>
            <i className={s.nightKey} /> Night
          </span>
        </div>
      </section>

      <section className={s.card}>
        <div className={s.head}>
          <h3>Next 24 hours</h3>
        </div>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Time</th>
              {HAZARDS.map((k) => (
                <th key={k}>{HAZ[k].label}</th>
              ))}
              <th>CAPE</th>
              <th>SRH</th>
              <th>Shear</th>
            </tr>
          </thead>
          <tbody>
            {hours.slice(0, 24).map((x, j) => (
              <tr key={x.time} aria-current={j === i ? "true" : undefined}>
                <td>
                  {night[j] && <Moon aria-hidden />}
                  {hr(x.time)}
                </td>
                {HAZARDS.map((k) => (
                  <td
                    key={k}
                    style={
                      x.prob[k] >= HAZ[k].trigger
                        ? { color: colors.haz[k], fontWeight: 700 }
                        : undefined
                    }
                  >
                    {x.prob[k].toFixed(0)}%
                  </td>
                ))}
                <td>{x.cape}</td>
                <td>{x.srh}</td>
                <td>{x.shear}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className={s.foot}>
        Chances are computed by StormSync from Open-Meteo model output (CAPE,
        storm-relative helicity, 0–6 km shear and lifted index), not quoted from
        the SPC. They describe what the atmosphere could support at this point,
        not a forecast that storms will form. Follow NWS warnings.
      </p>
    </div>
  );
}
