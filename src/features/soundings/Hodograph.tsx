"use client";

import type { Analysis } from "@/lib/soundings/thermo";
import { SND_BANDS } from "@/lib/soundings/style";

const S = 300;
const C = S / 2;

/** Hodograph (knots) colored by height, with Bunkers movers and 0–1 km SRH shaded. */
export function Hodograph({ a, c }: { a: Analysis; c: (k: string) => string }) {
  const w = a.wind.filter((p) => p.z <= 12000);
  if (w.length < 3)
    return (
      <p className="text-sm text-muted">
        Not enough wind data for a hodograph.
      </p>
    );
  const max = Math.max(
    40,
    ...w.map((p) => Math.hypot(p.u, p.v)),
    ...(a.rm ? [Math.hypot(a.rm.u, a.rm.v)] : []),
  );
  const ring = Math.ceil(max / 10) * 10;
  const k = (C - 14) / ring;
  const X = (u: number) => C + u * k;
  const Y = (v: number) => C - v * k;
  const bands = SND_BANDS.map((b, i) => {
    const lo = i ? SND_BANDS[i - 1].top : 0;
    const pts = w.filter((p) => p.z >= lo && p.z <= b.top);
    return {
      ...b,
      d: pts
        .map(
          (p, j) => `${j ? "L" : "M"}${X(p.u).toFixed(1)} ${Y(p.v).toFixed(1)}`,
        )
        .join(""),
    };
  });
  const srh = a.rm ? w.filter((p) => p.z <= 1000) : [];
  const tick = (z: number) => w.find((p) => p.z === z);
  const step = ring > 80 ? 20 : 10;
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className="mx-auto w-full max-w-md"
      role="img"
      aria-label="Hodograph"
    >
      {Array.from({ length: ring / step }, (_, i) => (i + 1) * step).map(
        (r) => (
          <g key={r}>
            <circle
              cx={C}
              cy={C}
              r={r * k}
              fill="none"
              stroke="var(--line)"
              strokeWidth={0.8}
            />
            <text
              x={C - r * k * 0.707 - 2}
              y={C + r * k * 0.707 + 9}
              textAnchor="end"
              fontSize={8}
              fill="var(--muted)"
            >
              {r}
            </text>
          </g>
        ),
      )}
      <line x1={C} x2={C} y1={6} y2={S - 6} stroke="var(--line)" />
      <line y1={C} y2={C} x1={6} x2={S - 6} stroke="var(--line)" />
      {srh.length > 1 && a.rm && (
        <path
          d={`M${X(a.rm.u)} ${Y(a.rm.v)}${srh.map((p) => `L${X(p.u).toFixed(1)} ${Y(p.v).toFixed(1)}`).join("")}Z`}
          fill={c("0-1")}
          fillOpacity={0.18}
          stroke="none"
        />
      )}
      {bands.map((b) => (
        <path
          key={b.key}
          d={b.d}
          fill="none"
          stroke={c(b.key)}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {[1000, 3000, 6000, 9000].map((z) => {
        const p = tick(z);
        return p ? (
          <g key={z}>
            <circle
              cx={X(p.u)}
              cy={Y(p.v)}
              r={3}
              fill="#0b0c14"
              stroke="#fff"
              strokeWidth={1}
            />
            <text
              x={X(p.u) + 5}
              y={Y(p.v) - 4}
              fontSize={9}
              fontWeight={700}
              fill="#fff"
            >
              {z / 1000}
            </text>
          </g>
        ) : null;
      })}
      {a.rm && (
        <>
          <circle
            cx={X(a.rm.u)}
            cy={Y(a.rm.v)}
            r={4.5}
            fill="none"
            stroke={c("storm")}
            strokeWidth={1.6}
          />
          <text
            x={X(a.rm.u) + 7}
            y={Y(a.rm.v) + 3}
            fontSize={9}
            fontWeight={700}
            fill={c("storm")}
          >
            RM
          </text>
        </>
      )}
      {a.lm && (
        <>
          <circle
            cx={X(a.lm.u)}
            cy={Y(a.lm.v)}
            r={4}
            fill="none"
            stroke={c("storm")}
            strokeOpacity={0.6}
            strokeWidth={1.2}
          />
          <text
            x={X(a.lm.u) + 7}
            y={Y(a.lm.v) + 3}
            fontSize={9}
            fill={c("storm")}
            fillOpacity={0.7}
          >
            LM
          </text>
        </>
      )}
      {a.mean && (
        <rect
          x={X(a.mean.u) - 3}
          y={Y(a.mean.v) - 3}
          width={6}
          height={6}
          fill="none"
          stroke={c("storm")}
          strokeOpacity={0.7}
        />
      )}
    </svg>
  );
}
