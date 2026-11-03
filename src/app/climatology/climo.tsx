"use client";

import { useEffect, useState } from "react";

export type Grid = {
  lat0: number;
  lon0: number;
  step: number;
  w: number;
  h: number;
};
export type TSummary = {
  first: number;
  last: number;
  byYear: [number, number][];
  months: number[];
  monthsSig: number[];
  hours: number[];
  ef: number[];
  states: Record<string, [number, number, number]>;
  grid: Grid & { all: number[]; sig: number[] };
  deaths: number[];
  deadliest: [string, string, number, number][];
  regionMonth: Record<string, number[]>;
  lenBins: number[];
  widBins: number[];
};
export type Twister = {
  s: [number, number];
  e: [number, number];
  ef: number;
  date: string;
  dead: number;
  hurt: number;
  st: string;
};
export type TNear = {
  miles: number;
  years: number;
  count: number;
  sig: number;
  violent: number;
  dead: number;
  hurt: number;
  months: number[];
  recent: Twister | null;
  strongest: Twister[];
};
export type HSummary = {
  first: number;
  last: number;
  grid: Grid & { hu: number[]; ts: number[] };
  season: { AL: number[]; EP: number[] };
  ace: {
    AL: [number, number, number, number, number][];
    EP: [number, number, number, number, number][];
  };
};
export type Pass = {
  name: string;
  year: number;
  basin: string;
  kt: number;
  md: string;
};
export type HNear = {
  miles: number;
  years: number;
  count: number;
  hurricanes: number;
  majors: number;
  months: number[];
  recent: Pass | null;
  strongest: Pass[];
};

export const MONTHS = "J F M A M J J A S O N D".split(" ");
export const MONTH_NAMES =
  "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
export const efName = (m: number) => (m < 0 ? "EFU" : `EF${m}`);
export const day = (ymd: string) =>
  new Date(
    `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T12:00:00Z`,
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
export const every = (n: number, years: number) => {
  if (!n) return "none on record";
  const y = years / n;
  return y < 1
    ? `about ${Math.round(n / years)} a year`
    : y < 1.5
      ? "about once a year"
      : `about once every ${Math.round(y)} years`;
};

export function useJson<T>(url: string | null) {
  const [res, setRes] = useState<{ url: string; d: T | "error" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: T) => live && setRes({ url, d }))
      .catch(() => live && setRes({ url, d: "error" }));
    return () => {
      live = false;
    };
  }, [url]);
  return url && res?.url === url ? res.d : null;
}

/** Simple bar chart: one series, optional highlight series drawn over it. */
export function Bars({
  values,
  over,
  labels,
  color,
  overColor,
  h = 110,
  every: step = 1,
}: {
  values: number[];
  over?: number[];
  labels?: string[];
  color: string;
  overColor?: string;
  h?: number;
  every?: number;
}) {
  const W = 360;
  const max = Math.max(1, ...values);
  const bw = W / values.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${h + (labels ? 14 : 0)}`}
      className="w-full"
      role="img"
      aria-label="Chart"
    >
      {values.map((v, i) => (
        <g key={i}>
          <rect
            x={i * bw + bw * 0.12}
            y={h - (v / max) * h}
            width={bw * 0.76}
            height={(v / max) * h}
            rx={1}
            fill={color}
            opacity={over ? 0.35 : 0.9}
          />
          {over && (
            <rect
              x={i * bw + bw * 0.12}
              y={h - (over[i] / max) * h}
              width={bw * 0.76}
              height={(over[i] / max) * h}
              rx={1}
              fill={overColor}
            />
          )}
          {labels && i % step === 0 && (
            <text
              x={i * bw + bw / 2}
              y={h + 11}
              fontSize={8.5}
              textAnchor="middle"
              fill="var(--muted)"
            >
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Climatology: tornadoes, lightning and hurricanes, near you and nationally. */
