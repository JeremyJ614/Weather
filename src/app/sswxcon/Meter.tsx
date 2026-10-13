"use client";

import { CountUp } from "@/features/dashboard/widgets/CountUp";
import { GAUGE_MAX, type Band } from "@/lib/sswxcon/score";
import s from "./Con.module.css";

const C = 120;
const R = 96;
const ang = (v: number) => 135 + 270 * Math.min(1, Math.max(0, v / GAUGE_MAX));
const pt = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
};
const arc = (from: number, to: number, r = R) =>
  `M ${pt(from, r)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(to, r)}`;

/**
 * The con-meter: a 270° ring of VIP's bands. Bands up to the score light in
 * sequence, a comet swings to the score, the number counts up. Transform and
 * opacity only.
 */
export function Meter({ total, bands }: { total: number; bands: Band[] }) {
  const band = [...bands].reverse().find((b) => total >= b.min) ?? bands[0];
  const segs = bands
    .filter((b) => b.min < GAUGE_MAX)
    .map((b, i, all) => ({
      ...b,
      to: all[i + 1]?.min ?? GAUGE_MAX,
    }));
  return (
    <div className={s.meter} style={{ ["--band" as string]: band.color }}>
      <span className={s.sweep} aria-hidden />
      <svg viewBox="0 0 240 240" aria-hidden className={s.ring}>
        <path d={arc(135, 405)} className={s.track} />
        {segs.map((b, i) => (
          <path
            key={b.label}
            d={arc(ang(b.min) + 1.2, ang(b.to) - 1.2)}
            stroke={b.color}
            className={total >= b.min ? s.segOn : s.segOff}
            style={{ ["--i" as string]: i }}
          />
        ))}
        {Array.from({ length: 26 }, (_, i) => {
          const d = 135 + (270 * i) / 25;
          return (
            <path
              key={i}
              d={`M ${pt(d, 78)} L ${pt(d, i % 5 ? 82 : 85)}`}
              className={s.tick}
            />
          );
        })}
        <g
          className={s.comet}
          style={{ ["--deg" as string]: `${ang(total)}deg` }}
        >
          <circle cx={C + R} cy={C} r="11" className={s.cometGlow} />
          <circle cx={C + R} cy={C} r="6.5" className={s.cometDot} />
        </g>
      </svg>
      <div className={s.readout}>
        <span className={s.live}>
          <i aria-hidden /> Live
        </span>
        <b className={s.num}>
          <CountUp value={total} ms={1300} decimals={1} />
        </b>
        <span className={s.of}>of {GAUGE_MAX}</span>
        <span className={s.band}>{band.label}</span>
      </div>
    </div>
  );
}
