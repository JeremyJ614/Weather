"use client";

import { useMemo, useState } from "react";
import { Binoculars, Eye, Telescope } from "lucide-react";
import { nightWindow } from "@/lib/sky/astro";
import {
  targetsTonight,
  USABLE_ALTITUDE,
  type Aperture,
} from "@/lib/sky/deep-sky";
import { SKY_APERTURE } from "@/lib/sky/score";
import s from "./Stars.module.css";

/**
 * Star Gazing's Targets tab, loaded when it opens (the deep-sky catalog stays off the page's
 * first load; speed budget).
 */
const now = () => Date.now();
const hm = (d: Date | null) =>
  d
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "–";

/**
 * Where to stand and look: compass direction across, height above the horizon up, each
 * target at its highest tonight. One glance answers "face south-southeast, two-thirds up".
 */
function SkyChart({
  targets,
  c,
}: {
  targets: ReturnType<typeof targetsTonight>;
  c: (k: string) => string;
}) {
  const W = 720;
  const H = 240;
  const L = 28;
  const R = 12;
  const T = 18;
  const B = 26;
  const px = (az: number) => L + (az / 360) * (W - L - R);
  const py = (alt: number) => H - B - (Math.max(0, alt) / 90) * (H - T - B);
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: L + (((i * 97) % 683) / 683) * (W - L - R),
        y: T + (((i * 53) % 191) / 191) * (H - T - B),
        r: i % 7 === 0 ? 1.1 : 0.6,
      })),
    [],
  );
  return (
    <div className={s.chartWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={s.skyChart}
        role="img"
        aria-label="Tonight's targets by compass direction and height above the horizon"
      >
        <defs>
          <linearGradient id="sky-dome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--bg)" />
            <stop offset="1" stopColor="var(--surface)" />
          </linearGradient>
        </defs>
        <rect
          x={L}
          y={T}
          width={W - L - R}
          height={H - T - B}
          rx={8}
          fill="url(#sky-dome)"
        />
        {stars.map((st, i) => (
          <circle
            key={i}
            cx={st.x}
            cy={st.y}
            r={st.r}
            fill="var(--text)"
            opacity={0.35}
          />
        ))}
        {[0, 20, 45, 90].map((alt) => (
          <g key={alt}>
            <line
              x1={L}
              x2={W - R}
              y1={py(alt)}
              y2={py(alt)}
              stroke={alt === USABLE_ALTITUDE ? "var(--accent)" : "var(--line)"}
              strokeDasharray={alt === USABLE_ALTITUDE ? "4 4" : undefined}
              strokeWidth={0.8}
            />
            <text x={4} y={py(alt) + 3} fontSize={9} fill="var(--muted)">
              {alt}°
            </text>
          </g>
        ))}
        {(
          [
            ["N", 0],
            ["NE", 45],
            ["E", 90],
            ["SE", 135],
            ["S", 180],
            ["SW", 225],
            ["W", 270],
            ["NW", 315],
            ["N", 360],
          ] as const
        ).map(([lb, az], i) => (
          <g key={i}>
            <line
              x1={px(az)}
              x2={px(az)}
              y1={T}
              y2={H - B}
              stroke="var(--line)"
              strokeWidth={0.6}
            />
            <text
              x={px(az)}
              y={H - 9}
              fontSize={10}
              textAnchor="middle"
              fill={lb === "S" ? "var(--accent)" : "var(--muted)"}
              fontWeight={lb === "S" ? 700 : 400}
            >
              {lb}
            </text>
          </g>
        ))}
        {targets.map((t, i) => {
          const x = px(t.azimuthAtPeak);
          const y = py(t.peakAltitude);
          const col = c(t.object.aperture);
          return (
            <g
              key={t.object.id}
              className={s.dot}
              style={{ animationDelay: `${Math.min(i * 30, 600)}ms` }}
            >
              <circle cx={x} cy={y} r={8} fill={col} opacity={0.18} />
              <circle cx={x} cy={y} r={3.4} fill={col} />
              <text
                x={x}
                y={y - 11}
                fontSize={9.5}
                textAnchor="middle"
                fill="var(--text)"
                fontWeight={600}
              >
                {t.object.id}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={s.chartKey}>
        {SKY_APERTURE.map((a) => (
          <span key={a.key}>
            <i style={{ background: c(a.key) }} />
            {a.label}
          </span>
        ))}
        <span>Dashed line: 20°, the lowest worth setting up for</span>
      </div>
    </div>
  );
}

const APERTURE: Record<Aperture, { label: string; Icon: typeof Eye }> = {
  eye: { label: "Naked eye", Icon: Eye },
  binoculars: { label: "Binoculars", Icon: Binoculars },
  telescope: { label: "Telescope", Icon: Telescope },
};

export function Targets({
  lat,
  lon,
  c,
}: {
  lat: number;
  lon: number;
  c: (k: string) => string;
}) {
  const [only, setOnly] = useState<Aperture | "all">("all");
  const list = useMemo(() => {
    const n = nightWindow(lat, lon, new Date(now()));
    if (!n.darkStart || !n.darkEnd) return null;
    return { n, t: targetsTonight(lat, lon, n.darkStart, n.darkEnd) };
  }, [lat, lon]);
  if (!list)
    return (
      <p className={s.card}>
        The sun never gets 18° below the horizon here tonight, so there is no
        fully dark window to place targets in.
      </p>
    );
  const up = list.t.filter(
    (t) =>
      t.peakAltitude >= USABLE_ALTITUDE &&
      (only === "all" || t.object.aperture === only),
  );
  return (
    <div className="grid gap-3">
      <div className={s.pills} role="group" aria-label="Aperture">
        {(["all", "eye", "binoculars", "telescope"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === only}
            onClick={() => setOnly(k)}
          >
            {k === "all" ? "All" : APERTURE[k].label}
          </button>
        ))}
      </div>
      <p className={s.muted}>
        {up.length} objects climb past {USABLE_ALTITUDE}° between{" "}
        {hm(list.n.darkStart)} and {hm(list.n.darkEnd)}.
      </p>
      <SkyChart targets={up} c={c} />
      <ul className="grid gap-2">
        {up.map((t) => {
          const A = APERTURE[t.object.aperture];
          return (
            <li key={t.object.id} className={s.target}>
              <A.Icon className="size-4" aria-label={A.label} />
              <span>
                <b>
                  {t.object.name} <small>{t.object.id}</small>
                </b>
                <small>
                  {t.object.kind} · highest {Math.round(t.peakAltitude)}° in the{" "}
                  {t.compass} at {hm(t.peakAt)}
                  {t.altitudeNow > 0 ? ` · up now, ${t.compassNow}` : ""}
                </small>
                <small className={s.note}>{t.object.note}</small>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
