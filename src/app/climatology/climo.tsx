"use client";

import { useEffect, useState } from "react";
import { InfoScrub } from "@/components/charts/InfoScrub";

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
  name = "Chart",
  overName = "Near you",
  fmt = (v) => (Math.round(v * 10) / 10).toLocaleString(),
  titles,
}: {
  values: number[];
  over?: number[];
  labels?: string[];
  color: string;
  overColor?: string;
  h?: number;
  every?: number;
  /** What the bars count, for the readout and screen readers. */
  name?: string;
  overName?: string;
  fmt?: (v: number) => string;
  /** Readout heading for each bar, when the axis labels skip some. */
  titles?: string[];
}) {
  const W = 360;
  const max = Math.max(1, ...values);
  const bw = W / values.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${h + (labels ? 14 : 0)}`}
      className="w-full"
      role="group"
      aria-label={name}
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
      {h >= 50 && values.some((v) => v > 0) && (
        <InfoScrub
          label={name}
          xs={values.map((_, i) => i * bw + bw / 2)}
          top={0}
          bottom={h}
          width={W}
          height={h + (labels ? 14 : 0)}
          lit={false}
          title={(i) => titles?.[i] || labels?.[i] || String(i + 1)}
          series={[
            {
              key: "v",
              label: over ? "All" : name,
              color,
              y: values.map((v) => h - (v / max) * h),
              text: values.map(fmt),
            },
          ]}
          rows={(i) =>
            over
              ? [{ label: overName, text: fmt(over[i]), color: overColor }]
              : []
          }
        />
      )}
    </svg>
  );
}

/** Climatology: tornadoes, lightning and hurricanes, near you and nationally. */
