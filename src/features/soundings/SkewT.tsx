"use client";

import { useMemo } from "react";
import {
  parcelPath,
  pAtZ,
  type Analysis,
  type Parcel,
} from "@/lib/soundings/thermo";

const W = 340;
const H = 420;
const P0 = 1050;
const P1 = 100;
const TMIN = -40;
const TSPAN = 90;
const y = (p: number) => H * (1 - Math.log(P0 / p) / Math.log(P0 / P1));
/** Isotherms lean right going up (0.75 px per px), so the troposphere stands near upright. */
const x = (t: number, p: number) =>
  ((t - TMIN) / TSPAN) * W + (H - y(p)) * 0.75;
const KAPPA = 0.2857;
const PRESS = [1000, 850, 700, 500, 400, 300, 250, 200, 150, 100];
const line = (pts: [number, number][]) =>
  pts
    .map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`)
    .join("");

/** Static background: isotherms, dry and moist adiabats, isobars. Built once. */
function useGrid() {
  return useMemo(() => {
    const ps = Array.from({ length: 39 }, (_, i) => P0 - i * 25);
    const iso = Array.from({ length: 16 }, (_, i) => -100 + i * 10).map(
      (t) => ({
        t,
        d: line([
          [x(t, P0), y(P0)],
          [x(t, P1), y(P1)],
        ]),
      }),
    );
    const dry = Array.from({ length: 18 }, (_, i) => 250 + i * 10).map((th) =>
      line(ps.map((p) => [x(th * (p / 1000) ** KAPPA - 273.15, p), y(p)])),
    );
    const moist = [-10, -5, 0, 5, 10, 15, 20, 25, 30, 35].map((t) => {
      const up = ps.filter((p) => p <= 1000 && p >= 200);
      return line(
        parcelPath(t, t, 1000, up).map((q, i) => [x(q.t, up[i]), y(up[i])]),
      );
    });
    return { iso, dry, moist };
  }, []);
}

/** One wind barb (knots) drawn from (bx, by), staff pointing into the wind. */
function Barb({
  bx,
  by,
  dir,
  kt,
  color,
}: {
  bx: number;
  by: number;
  dir: number;
  kt: number;
  color: string;
}) {
  if (kt < 2.5)
    return (
      <circle
        cx={bx}
        cy={by}
        r={3}
        fill="none"
        stroke={color}
        strokeWidth={1}
      />
    );
  let k = Math.round(kt / 5) * 5;
  const parts: string[] = [];
  let pos = 22;
  while (k >= 50) {
    parts.push(`M0 ${-pos}L9 ${-pos + 3}L0 ${-pos + 6}Z`);
    pos -= 7;
    k -= 50;
  }
  while (k >= 10) {
    parts.push(`M0 ${-pos}L10 ${-pos - 4}`);
    pos -= 4;
    k -= 10;
  }
  if (k >= 5)
    parts.push(
      `M0 ${-pos + (pos === 22 ? 4 : 0)}L5 ${-pos - 2 + (pos === 22 ? 4 : 0)}`,
    );
  return (
    <g
      transform={`translate(${bx} ${by}) rotate(${dir})`}
      stroke={color}
      fill={color}
      strokeWidth={1.1}
    >
      <path d={`M0 0L0 -22${parts.join("")}`} />
    </g>
  );
}

/** Skew-T log-P diagram with the chosen parcel, CAPE shading and wind barbs. */
export function SkewT({
  a,
  parcel,
  c,
}: {
  a: Analysis;
  parcel: Parcel;
  c: (k: string) => string;
}) {
  const g = useGrid();
  const L = a.levels;
  const temp = line(L.map((l) => [x(l[2], l[0]), y(l[0])]));
  const dew = line(
    L.filter((l) => l[3] != null && l[0] >= 200).map((l) => [
      x(l[3] as number, l[0]),
      y(l[0]),
    ]),
  );
  const pi = L.map((l, i) => [l[0], parcel.path[i]] as const).filter(
    ([p]) => p <= parcel.p0,
  );
  const par = line(pi.map(([p, t]) => [x(t, p), y(p)]));
  // CAPE: between the parcel and the environment from the LFC to the EL.
  let shade = "";
  if (parcel.cape > 10 && parcel.lfcM != null && parcel.elM != null) {
    const lfc = pAtZ(L, parcel.lfcM);
    const el = pAtZ(L, parcel.elM);
    const band = L.map((l, i) => ({
      p: l[0],
      t: l[2],
      tp: parcel.path[i],
    })).filter((q) => q.p <= lfc && q.p >= el);
    if (band.length > 1)
      shade =
        line(band.map((q) => [x(Math.max(q.tp, q.t), q.p), y(q.p)])) +
        line([...band].reverse().map((q) => [x(q.t, q.p), y(q.p)])).replace(
          /^M/,
          "L",
        ) +
        "Z";
  }
  const marks = (
    [
      ["LCL", parcel.lclM],
      ["LFC", parcel.lfcM],
      ["EL", parcel.elM],
    ] as [string, number | null][]
  ).filter((m): m is [string, number] => m[1] != null);
  const barbs = [
    1000, 950, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300,
    250, 200, 150, 100,
  ]
    .map((p) =>
      L.reduce(
        (b, l) => (Math.abs(l[0] - p) < Math.abs(b[0] - p) ? l : b),
        L[0],
      ),
    )
    .filter(
      (l, i, arr) =>
        l[4] != null && l[5] != null && arr.indexOf(l) === i && l[0] >= P1,
    );
  const bt = c("storm");
  return (
    <svg
      viewBox={`-30 -6 ${W + 70} ${H + 22}`}
      className="w-full"
      role="img"
      aria-label="Skew-T log-P diagram"
    >
      <defs>
        <clipPath id="skewt-clip">
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--line)" />
      <g clipPath="url(#skewt-clip)" fill="none">
        {g.dry.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="#a16207"
            strokeOpacity={0.28}
            strokeWidth={0.7}
          />
        ))}
        {g.moist.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="#0e7490"
            strokeOpacity={0.4}
            strokeWidth={0.7}
            strokeDasharray="3 3"
          />
        ))}
        {g.iso.map((l) => (
          <path
            key={l.t}
            d={l.d}
            stroke={l.t === 0 ? "#60a5fa" : "var(--line)"}
            strokeOpacity={l.t === 0 ? 0.6 : 0.7}
            strokeWidth={l.t === 0 ? 1 : 0.6}
          />
        ))}
        {PRESS.map((p) => (
          <line
            key={p}
            x1={0}
            x2={W}
            y1={y(p)}
            y2={y(p)}
            stroke="var(--line)"
            strokeWidth={0.7}
          />
        ))}
        {shade && (
          <path d={shade} fill={c("cape")} fillOpacity={0.22} stroke="none" />
        )}
        <path
          d={par}
          stroke={c("parcel")}
          strokeWidth={1.4}
          strokeDasharray="5 3"
        />
        <path
          d={dew}
          stroke={c("dew")}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path
          d={temp}
          stroke={c("temp")}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      </g>
      {PRESS.map((p) => (
        <text
          key={p}
          x={-4}
          y={y(p) + 3}
          textAnchor="end"
          fontSize={9}
          fill="var(--muted)"
        >
          {p}
        </text>
      ))}
      {[-30, -20, -10, 0, 10, 20, 30, 40].map((t) => (
        <text
          key={t}
          x={x(t, P0)}
          y={H + 12}
          textAnchor="middle"
          fontSize={9}
          fill="var(--muted)"
        >
          {t}°
        </text>
      ))}
      {marks.map(([k, m]) => {
        const yy = y(pAtZ(L, m));
        return (
          <g key={k}>
            <line
              x1={W - 34}
              x2={W - 4}
              y1={yy}
              y2={yy}
              stroke={c("parcel")}
              strokeWidth={1}
            />
            <text
              x={W - 36}
              y={yy + 3}
              textAnchor="end"
              fontSize={9}
              fontWeight={700}
              fill={c("parcel")}
            >
              {k}
            </text>
          </g>
        );
      })}
      <line x1={W + 22} x2={W + 22} y1={0} y2={H} stroke="var(--line)" />
      {barbs.map((l) => (
        <Barb
          key={l[0]}
          bx={W + 22}
          by={y(l[0])}
          dir={l[4] as number}
          kt={l[5] as number}
          color={bt}
        />
      ))}
    </svg>
  );
}
