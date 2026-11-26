"use client";

import type { Analysis } from "@/lib/soundings/thermo";
import { hodoGeom } from "./geom";

const S = 300;

/** Hodograph (knots) colored by height, with Bunkers movers and 0–1 km SRH shaded. */
export function Hodograph({ a, c }: { a: Analysis; c: (k: string) => string }) {
  const h = hodoGeom(a, S);
  if (!h.enough)
    return (
      <p className="text-sm text-muted">
        Not enough wind data for a hodograph.
      </p>
    );
  const { C, k } = h;
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className="mx-auto w-full max-w-md"
      role="img"
      aria-label="Hodograph"
    >
      {h.rings.map((r) => (
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
      ))}
      <line x1={C} x2={C} y1={6} y2={S - 6} stroke="var(--line)" />
      <line y1={C} y2={C} x1={6} x2={S - 6} stroke="var(--line)" />
      {h.srh && (
        <path d={h.srh} fill={c("0-1")} fillOpacity={0.18} stroke="none" />
      )}
      {h.bands.map((b) => (
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
      {h.ticks.map((p) => (
        <g key={p.label}>
          <circle
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#0b0c14"
            stroke="#fff"
            strokeWidth={1}
          />
          <text
            x={p.x + 5}
            y={p.y - 4}
            fontSize={9}
            fontWeight={700}
            fill="#fff"
          >
            {p.label}
          </text>
        </g>
      ))}
      {h.rm && (
        <>
          <circle
            cx={h.rm.x}
            cy={h.rm.y}
            r={4.5}
            fill="none"
            stroke={c("storm")}
            strokeWidth={1.6}
          />
          <text
            x={h.rm.x + 7}
            y={h.rm.y + 3}
            fontSize={9}
            fontWeight={700}
            fill={c("storm")}
          >
            RM
          </text>
        </>
      )}
      {h.lm && (
        <>
          <circle
            cx={h.lm.x}
            cy={h.lm.y}
            r={4}
            fill="none"
            stroke={c("storm")}
            strokeOpacity={0.6}
            strokeWidth={1.2}
          />
          <text
            x={h.lm.x + 7}
            y={h.lm.y + 3}
            fontSize={9}
            fill={c("storm")}
            fillOpacity={0.7}
          >
            LM
          </text>
        </>
      )}
      {h.mean && (
        <rect
          x={h.mean.x - 3}
          y={h.mean.y - 3}
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
