"use client";

import { useEffect, useState } from "react";
import s from "./Engines.module.css";

const LEVELS = [950, 925, 900, 850, 800, 750] as const;
type Hourly = {
  time: string[];
  surface_pressure: number[];
  wind_speed_700hPa: number[];
  wind_direction_850hPa: number[];
  dew_point_850hPa: number[];
} & Record<`wind_speed_${(typeof LEVELS)[number]}hPa`, (number | null)[]>;

type Hour = {
  t: string;
  kt: number;
  lev: number | null;
  cls: number;
  wet: boolean;
  dir: number;
};
const CLASS = ["No true jet", "Low-level jet", "Strong jet", "Intense jet"];
const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Bonner (1968) class from the core speed and its drop to 700 mb (both in knots). */
function bonner(kt: number, fall: number) {
  const ms = kt / 1.943844;
  const f = fall / 1.943844;
  return ms >= 20 && f >= 10
    ? 3
    : ms >= 16 && f >= 8
      ? 2
      : ms >= 12 && f >= 6
        ? 1
        : 0;
}

/**
 * Nocturnal LLJ "Through the night" (post-launch A6): hour by hour from 6 p.m. to 9 a.m. at a
 * place, the fastest wind below 700 mb on any level above the ground (the jet's core), its
 * Bonner class and whether it is carrying moisture (850 mb dew point 12 °C and up). From the
 * HRRR (then GFS) through Open-Meteo, read in the browser.
 */
export function LljNight({
  lat,
  lon,
  label,
  color,
}: {
  lat: number;
  lon: number;
  label: string;
  /** Band color for a Bonner class (0–3), from the map's palette. */
  color: (cls: number) => string;
}) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const [got, setGot] = useState<{ k: string; hours: Hour[] | "error" } | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    const vars = [
      ...LEVELS.map((l) => `wind_speed_${l}hPa`),
      "wind_speed_700hPa",
      "wind_direction_850hPa",
      "dew_point_850hPa",
      "surface_pressure",
    ].join(",");
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=${vars}&models=gfs_seamless&wind_speed_unit=kn&forecast_hours=36&timezone=auto`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { hourly: Hourly }) => {
        const h = j.hourly;
        const out: Hour[] = [];
        let started = false;
        h.time.forEach((t, i) => {
          const hr = Number(t.slice(11, 13));
          // Tonight: from the first 6 p.m. ahead through 9 a.m. (local time).
          if (!started && hr !== 18) return;
          started = true;
          if (out.length >= 16) return;
          const p = h.surface_pressure[i];
          let kt = 0;
          let lev: number | null = null;
          for (const l of LEVELS) {
            const v = h[`wind_speed_${l}hPa`][i];
            if (v !== null && p >= l + 25 && v > kt) {
              kt = v;
              lev = l;
            }
          }
          out.push({
            t,
            kt,
            lev,
            cls: bonner(kt, kt - (h.wind_speed_700hPa[i] ?? kt)),
            wet: (h.dew_point_850hPa[i] ?? -99) >= 12,
            dir: h.wind_direction_850hPa[i] ?? 0,
          });
        });
        if (live) setGot({ k: key, hours: out.length ? out : "error" });
      })
      .catch(() => live && setGot({ k: key, hours: "error" }));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key is the place

  const hours = got?.k === key ? got.hours : null;
  const hh = (t: string) => {
    const h = Number(t.slice(11, 13));
    return `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
  };
  const peak =
    hours && hours !== "error"
      ? hours.reduce((a, b) => (b.kt > a.kt ? b : a))
      : null;
  const top = Math.max(
    40,
    ...(hours && hours !== "error" ? hours.map((x) => x.kt) : [0]),
  );
  return (
    <section className={s.card}>
      <header>
        <h3>Through the night at {label}</h3>
        <small>HRRR, then GFS · core below 10,000 ft</small>
      </header>
      {hours === "error" && (
        <p className={s.small}>
          The hourly winds aren&apos;t answering right now.
        </p>
      )}
      {!hours && <p className={s.small}>Reading tonight&apos;s winds…</p>}
      {peak && hours && hours !== "error" && (
        <>
          <p className={s.small}>
            {peak.cls
              ? `${CLASS[peak.cls]} peaks near ${hh(peak.t)}m at ${Math.round(peak.kt)} kt from the ${POINTS[Math.round(peak.dir / 45) % 8]}${peak.lev ? `, core at ${peak.lev} mb` : ""}${peak.wet ? ", carrying deep moisture" : ""}.`
              : `No true low-level jet tonight; the strongest low wind is ${Math.round(peak.kt)} kt near ${hh(peak.t)}m.`}
          </p>
          <ol className={s.night} aria-label="Low-level jet by hour">
            {hours.map((x) => (
              <li
                key={x.t}
                title={`${hh(x.t)}m: ${Math.round(x.kt)} kt, ${CLASS[x.cls]}`}
              >
                <span className={s.nightKt}>{Math.round(x.kt)}</span>
                <span className={s.nightTrack}>
                  <i
                    style={{
                      transform: `scaleY(${Math.max(0.04, x.kt / top)})`,
                      background: color(x.cls),
                    }}
                  />
                </span>
                <span
                  className={s.nightWet}
                  aria-label={x.wet ? "moist" : undefined}
                >
                  {x.wet ? "•" : ""}
                </span>
                <small>{hh(x.t)}</small>
              </li>
            ))}
          </ol>
          <p className={s.small}>
            Bars: the fastest wind below 700 mb, in knots, colored by Bonner
            class. A dot marks hours the jet carries deep moisture (850 mb dew
            point 54°F and up), the kind that keeps night storms going.
          </p>
        </>
      )}
    </section>
  );
}
