"use client";

import { useMemo, type CSSProperties } from "react";
import {
  CalendarClock,
  Leaf,
  MapPin,
  Mountain,
  Timer,
  Trees,
} from "lucide-react";
import { usePlaces } from "@/features/location/usePlaces";
import { leafColor, seasonStats, type FallReport } from "@/lib/weather/foliage";
import s from "./FallSeason.module.css";

const DAY = 86_400_000;
const fmt = (t: number) =>
  Number.isFinite(t)
    ? new Date(t).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "—";
const title = (x: string) =>
  x.replace(/(^|[\s-])(\S)/g, (_, a: string, b: string) => a + b.toUpperCase());
const miles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) *
      Math.cos(lat2 * r) *
      Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 7918 * Math.asin(Math.sqrt(a));
};
const v = (n: number) => ({ "--i": n }) as CSSProperties;

/**
 * Season Stats (owner's list #41: "as much detail as you can find", visually impressive): the
 * season's pulse ring, the color front sliding south, north/middle/south bands, the earliest
 * states, the species with how long each kept its color, mountains against lowlands and the
 * reports nearest the viewer. Everything from the same NPN reports as the map, as of its date.
 */
export function FallSeason({
  report,
  asOf,
}: {
  report: FallReport;
  asOf: number;
}) {
  const st = useMemo(() => seasonStats(report, asOf), [report, asOf]);
  const { active } = usePlaces();
  const near = useMemo(() => {
    if (!active) return [];
    return report.sites
      .filter((x) => x[2] <= asOf)
      .map((x) => ({
        x,
        d: miles(active.lat, active.lon, x[1], x[0]),
      }))
      .filter((o) => o.d <= 200)
      .sort((a, b) => b.x[2] - a.x[2] || a.d - b.d)
      .slice(0, 5);
  }, [report, asOf, active]);

  const weeks = st.weeks;
  const days = st.first
    ? Math.max(0, Math.round((asOf - st.first.t) / DAY))
    : 0;

  // The pulse ring: one spoke every 3 days, clockwise.
  const steps = useMemo(() => {
    const out: { t: number; n: number }[] = [];
    const a = Date.parse(`${report.start}T00:00:00Z`);
    for (let t = a; t <= asOf; t += 3 * DAY) out.push({ t, n: 0 });
    for (const x of report.sites) {
      if (x[2] > asOf || x[2] < a) continue;
      const k = Math.min(out.length - 1, Math.floor((x[2] - a) / (3 * DAY)));
      if (k >= 0) out[k].n++;
    }
    return out;
  }, [report, asOf]);
  const smax = Math.max(1, ...steps.map((w) => w.n));
  const busiest = steps.reduce((b, w) => (w.n > b.n ? w : b), steps[0]);
  const R0 = 66;
  const RL = 44;
  const spokes = steps.map((w, i) => {
    // A 300° arc open at the bottom, oldest week bottom left.
    const a =
      (120 + (i / Math.max(1, steps.length - 1)) * 300) * (Math.PI / 180);
    const len = 3 + (w.n / smax) * RL;
    return {
      x1: 120 + Math.cos(a) * R0,
      y1: 120 + Math.sin(a) * R0,
      x2: 120 + Math.cos(a) * (R0 + len),
      y2: 120 + Math.sin(a) * (R0 + len),
      color: leafColor(((asOf - w.t) / DAY) * 0.8),
      peak: w === busiest && w.n > 0,
    };
  });

  // The color front: every report by latitude and date, and the weekly median line.
  const FW = 340;
  const FH = 190;
  const tA = weeks[0]?.t ?? asOf;
  const span = Math.max(DAY, asOf - tA);
  const lat0 = 25;
  const lat1 = 50;
  const fx = (t: number) => 28 + ((t - tA) / span) * (FW - 40);
  const fy = (lat: number) =>
    10 +
    ((lat1 - Math.max(lat0, Math.min(lat1, lat))) / (lat1 - lat0)) * (FH - 36);
  const front = weeks.filter((w) => w.n >= 3 && Number.isFinite(w.lat));
  const line = front
    .map(
      (w, i) =>
        `${i ? "L" : "M"}${fx(w.t + 3.5 * DAY).toFixed(1)},${fy(w.lat).toFixed(1)}`,
    )
    .join("");
  const dots = useMemo(
    () =>
      report.sites
        .filter((x) => x[2] <= asOf && x[2] >= tA)
        .map((x, i) => (
          <circle
            key={i}
            cx={fx(x[2]).toFixed(1)}
            cy={fy(x[1]).toFixed(1)}
            r={1.7}
            fill={leafColor((asOf - x[2]) / DAY)}
          />
        )),
    // fx and fy depend only on tA, span and the constants above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, asOf, tA],
  );
  const fStart = front[0];
  const fNow = front.at(-1);

  const early = [...st.states]
    .filter((g) => g.n >= 5)
    .sort((a, b) => a.onset - b.onset)
    .slice(0, 8);
  const busiestStates = [...st.states].sort((a, b) => b.n - a.n).slice(0, 6);
  const sp = st.species.slice(0, 8);
  const spMax = sp[0]?.n ?? 1;
  const bandMax = Math.max(1, ...st.bands.map((b) => b.n));
  const gap =
    st.high && st.low ? Math.round((st.low.onset - st.high.onset) / DAY) : null;

  if (!st.total)
    return (
      <p className="panel rounded-2xl p-4 text-sm text-muted">
        No first-color reports yet this season. They start in August.
      </p>
    );

  return (
    <div className={s.wrap}>
      {/* Pulse */}
      <section className={`${s.card} ${s.pulse}`} style={v(0)}>
        <svg viewBox="0 0 240 240" className={s.ring} aria-hidden>
          <defs>
            <radialGradient id="fall-core">
              <stop offset="0" stopColor={leafColor(14)} stopOpacity="0.35" />
              <stop offset="1" stopColor={leafColor(14)} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="120" cy="120" r="58" fill="url(#fall-core)" />
          <circle
            cx="120"
            cy="120"
            r={R0 - 4}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.15"
          />
          <g className={s.spokes}>
            {spokes.map(({ color, peak, ...p }, i) => (
              <line
                key={i}
                {...p}
                stroke={color}
                strokeWidth={peak ? 4.5 : 3.2}
                strokeLinecap="round"
                className={peak ? s.peak : undefined}
                style={v(i)}
              />
            ))}
          </g>
        </svg>
        <div className={s.core}>
          <b className={s.big}>{st.total.toLocaleString()}</b>
          <span>reports by {fmt(asOf)}</span>
        </div>
        <ul className={s.kpis}>
          <li style={v(1)}>
            <small>Turned in 2 weeks</small>
            <b style={{ color: leafColor(2) }}>{st.recent.toLocaleString()}</b>
          </li>
          <li style={v(2)}>
            <small>Busiest week</small>
            <b>{st.peak ? `${fmt(st.peak.t)}` : "—"}</b>
            {st.peak && <em>{st.peak.n} reports</em>}
          </li>
          <li style={v(3)}>
            <small>Season so far</small>
            <b>{days} days</b>
            {st.first && (
              <em>
                first: {st.first.species}, {st.first.state || "?"} on{" "}
                {fmt(st.first.t)}
              </em>
            )}
          </li>
          <li style={v(4)}>
            <small>Newest report</small>
            <b>{st.newest ? fmt(st.newest.t) : "—"}</b>
            {st.newest && (
              <em>
                {st.newest.species}
                {st.newest.state ? `, ${st.newest.state}` : ""}
              </em>
            )}
          </li>
        </ul>
      </section>

      {/* Color front */}
      {front.length >= 2 && (
        <section className={s.card} style={v(1)}>
          <header className={s.head}>
            <Leaf aria-hidden />
            <div>
              <p>The color front</p>
              <h3>
                {fStart && fNow
                  ? fNow.lat < fStart.lat - 0.5
                    ? `Slid ${Math.round((fStart.lat - fNow.lat) * 69)} miles south`
                    : `Holding near ${fNow.lat.toFixed(1)}°N`
                  : "Moving south"}
              </h3>
            </div>
          </header>
          <svg
            viewBox={`0 0 ${FW} ${FH}`}
            className={s.front}
            role="img"
            aria-label="Report latitude by date, with the weekly middle line"
          >
            {[30, 35, 40, 45].map((l) => (
              <g key={l}>
                <line
                  x1={28}
                  x2={FW - 8}
                  y1={fy(l)}
                  y2={fy(l)}
                  className={s.grid}
                />
                <text x={2} y={fy(l) + 3} className={s.axis}>
                  {l}°
                </text>
              </g>
            ))}
            <g className={s.cloud}>{dots}</g>
            <path d={line} className={s.glow} />
            <path d={line} className={s.line} pathLength={1} />
            {fNow && (
              <circle
                cx={fx(fNow.t + 3.5 * DAY)}
                cy={fy(fNow.lat)}
                r={5}
                className={s.head2}
              />
            )}
            <text x={28} y={FH - 4} className={s.axis}>
              {fmt(tA)}
            </text>
            <text x={FW - 8} y={FH - 4} className={s.axis} textAnchor="end">
              {fmt(asOf)}
            </text>
          </svg>
          <p className={s.note}>
            Each dot is a plant&apos;s first color by its latitude. The lit line
            is the middle of each week&apos;s new reports
            {fStart && fNow
              ? `: ${fStart.lat.toFixed(1)}°N the week of ${fmt(fStart.t)}, ${fNow.lat.toFixed(1)}°N the week of ${fmt(fNow.t)}.`
              : "."}
          </p>
        </section>
      )}

      {/* Bands */}
      <section className={s.bands} style={v(2)}>
        {st.bands.map((b, i) => (
          <div key={b.name} className={s.band} style={v(i)}>
            <small>
              {b.name} ·{" "}
              {b.to >= 90
                ? `${b.from}°N up`
                : b.from
                  ? `${b.from}–${b.to}°N`
                  : `below ${b.to}°N`}
            </small>
            <b>{Number.isFinite(b.onset) ? fmt(b.onset) : "—"}</b>
            <em>middle onset · {b.n.toLocaleString()} reports</em>
            <i className={s.meter}>
              <span
                style={{
                  transform: `scaleX(${b.n / bandMax})`,
                  background: `linear-gradient(90deg, ${leafColor(0)}, ${leafColor(20 + i * 10)})`,
                }}
              />
            </i>
          </div>
        ))}
      </section>

      {/* Facts */}
      <section className={s.facts} style={v(3)}>
        <div>
          <Timer aria-hidden />
          <b>
            {Number.isFinite(st.lasts) ? `${Math.round(st.lasts)} days` : "—"}
          </b>
          <span>how long a plant kept its color (middle)</span>
        </div>
        <div>
          <Mountain aria-hidden />
          <b>
            {gap === null
              ? "—"
              : gap > 0
                ? `${gap} days sooner`
                : gap < 0
                  ? `${-gap} days later`
                  : "Same time"}
          </b>
          <span>mountains (1,000 m+) against lowlands</span>
        </div>
        <div>
          <Trees aria-hidden />
          <b>
            {(st.total - st.needles).toLocaleString()} ·{" "}
            {st.needles.toLocaleString()}
          </b>
          <span>leaves · needles (larch, cypress)</span>
        </div>
      </section>

      {/* States */}
      {early.length > 0 && (
        <section className={s.card} style={v(4)}>
          <header className={s.head}>
            <CalendarClock aria-hidden />
            <div>
              <p>Earliest to turn</p>
              <h3>States by their middle first-color date</h3>
            </div>
          </header>
          <ol className={s.rank}>
            {early.map((g, i) => (
              <li key={g.name} style={v(i)}>
                <span className={s.pos}>{i + 1}</span>
                <b className={s.code}>{g.name}</b>
                <span className={s.when}>{fmt(g.onset)}</span>
                <span className={s.n}>{g.n} reports</span>
              </li>
            ))}
          </ol>
          <div className={s.chips}>
            <small>Most reports:</small>
            {busiestStates.map((g) => (
              <span key={g.name}>
                {g.name} <b>{g.n}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Species */}
      {sp.length > 0 && (
        <section className={s.card} style={v(5)}>
          <header className={s.head}>
            <Trees aria-hidden />
            <div>
              <p>Most reported</p>
              <h3>Species, when they turned and how long it lasted</h3>
            </div>
          </header>
          <ol className={s.species}>
            {sp.map((g, i) => (
              <li key={g.name} style={v(i)}>
                <span className={s.spName}>{title(g.name)}</span>
                <span className={s.spBar}>
                  <i
                    style={{
                      transform: `scaleX(${g.n / spMax})`,
                      background: `linear-gradient(90deg, ${leafColor(i * 5)}, ${leafColor(12 + i * 5)})`,
                    }}
                  />
                </span>
                <span className={s.spMeta}>
                  <b>{g.n}</b> · {fmt(g.onset)}
                  {Number.isFinite(g.days) ? ` · ${Math.round(g.days)} d` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Near you */}
      <section className={s.card} style={v(6)}>
        <header className={s.head}>
          <MapPin aria-hidden />
          <div>
            <p>Near {active?.label ?? "you"}</p>
            <h3>
              {near.length
                ? "Newest reports within 200 miles"
                : active
                  ? "No reports within 200 miles yet"
                  : "Pick a place to see reports near you"}
            </h3>
          </div>
        </header>
        {near.length > 0 && (
          <ul className={s.near}>
            {near.map(({ x, d }, i) => (
              <li key={i} style={v(i)}>
                <i style={{ background: leafColor((asOf - x[2]) / DAY) }} />
                <b>{title(report.species[x[3]] ?? "Unidentified")}</b>
                <span>
                  {fmt(x[2])} · {Math.round(d)} mi
                  {report.states?.[x[5] ?? -1]
                    ? ` · ${report.states[x[5]!]}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
