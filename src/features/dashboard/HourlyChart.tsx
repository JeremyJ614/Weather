import type { Hour } from "@/lib/weather/types";
import s from "./widgets/widgets.module.css";
import { InfoScrub } from "@/components/charts/InfoScrub";

/**
 * 24-hour temperature curve: smooth line with a glowing gradient fill that
 * sweeps in from the left, rain-chance columns rising beneath, and the high
 * and low marked. Transform and opacity only.
 */
export function HourlyChart({
  hours,
  timeZone,
}: {
  hours: Hour[];
  timeZone: string;
}) {
  const h = hours.slice(0, 24);
  if (h.length < 2) return null;
  const W = 340;
  const H = 150;
  const top = 24;
  const bottom = 24;
  const temps = h.map((x) => x.temp);
  const lo = Math.min(...temps) - 2;
  const hi = Math.max(...temps) + 2;
  const x = (i: number) => (i / (h.length - 1)) * W;
  const y = (t: number) =>
    top + (1 - (t - lo) / (hi - lo)) * (H - top - bottom);
  // Catmull-Rom → cubic Bézier for a smooth curve through every hour.
  const pts = h.map((p, i) => [x(i), y(p.temp)] as const);
  let line = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    line += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${line}L${W},${H - bottom}L0,${H - bottom}Z`;
  const label = (iso: string) =>
    new Date(iso)
      .toLocaleTimeString("en-US", { hour: "numeric", timeZone })
      .replace(" ", "")
      .toLowerCase();
  const peak = temps.indexOf(Math.max(...temps));
  const low = temps.indexOf(Math.min(...temps));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={s.chart}
      role="img"
      aria-label={`Temperatures from ${temps[0]}° to a high of ${temps[peak]}° over the next 24 hours`}
    >
      <defs>
        <linearGradient id="hc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hc-line" x1="0" x2="1">
          <stop offset="0" stopColor="#5ac8fa" />
          <stop offset="0.5" stopColor="var(--accent)" />
          <stop offset="1" stopColor="#ff7a45" />
        </linearGradient>
        <clipPath id="hc-reveal">
          <rect className={s.reveal} x="0" y="0" width={W} height={H} />
        </clipPath>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={W}
          y1={top + f * (H - top - bottom)}
          y2={top + f * (H - top - bottom)}
          className={s.grid}
        />
      ))}
      {h.map((p, i) =>
        p.pop ? (
          <rect
            key={i}
            x={x(i) - 4}
            y={H - bottom - (p.pop / 100) * 46}
            width={8}
            height={(p.pop / 100) * 46}
            rx={2}
            className={s.popBar}
            style={{ ["--i" as string]: i }}
          />
        ) : null,
      )}
      <g clipPath="url(#hc-reveal)">
        <path d={area} fill="url(#hc-fill)" />
        <path d={line} className={s.line} stroke="url(#hc-line)" />
      </g>
      <circle cx={x(0)} cy={y(temps[0])} r={5} className={s.nowPulse} />
      <circle cx={x(0)} cy={y(temps[0])} r={3.5} fill="#fff" />
      {[peak, low].map((i) => (
        <g key={i} className={s.fadeIn}>
          <circle cx={x(i)} cy={y(temps[i])} r={3.5} fill="var(--accent)" />
          <text
            x={Math.min(Math.max(x(i), 12), W - 12)}
            y={y(temps[i]) - 9}
            textAnchor="middle"
            className={s.peak}
          >
            {temps[i]}°
          </text>
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((i) =>
        h[i] ? (
          <text
            key={i}
            x={Math.min(Math.max(x(i), 14), W - 14)}
            y={H - 6}
            textAnchor="middle"
            className={s.axis}
          >
            {i === 0 ? "Now" : label(h[i].start)}
          </text>
        ) : null,
      )}
      <InfoScrub
        label="Temperature, next 24 hours"
        x0={0}
        x1={W}
        top={top}
        bottom={H - bottom}
        width={W}
        height={H}
        title={(i) => (i === 0 ? "Now" : label(h[i].start))}
        series={[
          {
            key: "temp",
            label: "Temp",
            color: "var(--accent)",
            y: pts.map((p) => p[1]),
            text: temps.map((t) => `${Math.round(t)}°`),
          },
        ]}
        rows={(i) =>
          h[i]?.pop ? [{ label: "Rain", text: `${h[i].pop}%` }] : []
        }
      />
    </svg>
  );
}
