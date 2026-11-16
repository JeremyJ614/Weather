"use client";

import type { Band } from "@/lib/sswxcon/score";

const bandIn = (bands: Band[], v: number) =>
  [...bands].reverse().find((b) => v >= b.min) ?? bands[0];
import s from "./Con.module.css";
import { InfoScrub } from "@/components/charts/InfoScrub";

export type Snap = { at: string; total: number };

const W = 340;
const H = 150;

/** The last 48 hourly snapshots, with the band thresholds behind the line. */
export function Trend({
  snaps,
  now,
  bands,
}: {
  snaps: Snap[];
  now: number;
  bands: Band[];
}) {
  const bandFor = (v: number) => bandIn(bands, v);
  if (snaps.length < 2)
    return (
      <p className={s.empty}>
        The trend fills in hourly from the moment SSWXCon v2 went live. Check
        back in a few hours.
      </p>
    );
  const t0 = Date.parse(snaps[0].at);
  const t1 = Date.parse(snaps[snaps.length - 1].at);
  const peak = Math.max(...snaps.map((p) => p.total), now);
  const top = Math.max(30, Math.ceil((peak * 1.25) / 10) * 10);
  const x = (t: number) => 8 + ((t - t0) / Math.max(1, t1 - t0)) * (W - 16);
  const y = (v: number) => H - 18 - (v / top) * (H - 30);
  const line = snaps
    .map(
      (p, i) =>
        `${i ? "L" : "M"} ${x(Date.parse(p.at)).toFixed(1)} ${y(p.total).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L ${x(t1).toFixed(1)} ${H - 18} L ${x(t0).toFixed(1)} ${H - 18} Z`;
  const last = snaps[snaps.length - 1];
  const hi = snaps.reduce((a, b) => (b.total > a.total ? b : a));
  const stamp = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      hour: "numeric",
    });
  return (
    <figure className={s.trend}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="SSWXCon over the last 48 hours"
      >
        <defs>
          <linearGradient id="con-area" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0"
              stopColor={bandFor(peak).color}
              stopOpacity="0.45"
            />
            <stop offset="1" stopColor={bandFor(peak).color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {bands
          .filter((b) => b.min > 0 && b.min < top)
          .map((b) => (
            <g key={b.label}>
              <line
                x1="8"
                x2={W - 8}
                y1={y(b.min)}
                y2={y(b.min)}
                stroke={b.color}
                className={s.th}
              />
              <text
                x={W - 10}
                y={y(b.min) - 3}
                className={s.thLabel}
                fill={b.color}
              >
                {b.label}
              </text>
            </g>
          ))}
        <path d={area} fill="url(#con-area)" className={s.trendArea} />
        <path d={line} className={s.trendLine} stroke={bandFor(peak).color} />
        <circle
          cx={x(Date.parse(last.at))}
          cy={y(last.total)}
          r="4"
          className={s.trendDot}
          fill={bandFor(last.total).color}
        />
        <text x="8" y={H - 4} className={s.axis}>
          {stamp(snaps[0].at)}
        </text>
        <text x={W - 8} y={H - 4} className={s.axis} textAnchor="end">
          {stamp(last.at)}
        </text>
        <InfoScrub
          label="SSWXCon over the last 48 hours"
          xs={snaps.map((p) => x(Date.parse(p.at)))}
          top={12}
          bottom={H - 18}
          width={W}
          height={H}
          start={snaps.length - 1}
          title={(i) => stamp(snaps[i].at)}
          series={[
            {
              key: "con",
              label: "Score",
              color: bandFor(peak).color,
              y: snaps.map((p) => y(p.total)),
              text: snaps.map((p) => String(p.total)),
            },
          ]}
          rows={(i) => [
            {
              label: "Level",
              text: bandFor(snaps[i].total).label,
              color: bandFor(snaps[i].total).color,
            },
          ]}
        />
      </svg>
      <figcaption>
        48-hour high: <b>{hi.total}</b> ({bandFor(hi.total).label}) ·{" "}
        {stamp(hi.at)}
      </figcaption>
    </figure>
  );
}

/** VIP's band ladder with the current score marked. */
export function Ladder({ total, bands }: { total: number; bands: Band[] }) {
  const cur = bandIn(bands, total);
  return (
    <ol className={s.ladder}>
      {[...bands].reverse().map((b) => (
        <li
          key={b.label}
          className={b === cur ? s.here : undefined}
          style={{ ["--c" as string]: b.color }}
        >
          <i />
          <span>{b.label}</span>
          <b>{b.min}+</b>
        </li>
      ))}
    </ol>
  );
}
