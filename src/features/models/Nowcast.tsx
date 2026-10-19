"use client";

import { useEffect, useState } from "react";
import { usePlaces } from "@/features/location/usePlaces";
import s from "./Models.module.css";

type M = {
  time: string[];
  precipitation: number[];
  temperature_2m: number[];
  wind_gusts_10m: number[];
  lightning_potential?: (number | null)[];
  visibility?: number[];
};

/**
 * The next 12 hours in 15-minute steps at your place, from the HRRR-based Open-Meteo
 * nowcast: when rain starts and stops, how hard, gusts, temperature and lightning odds.
 */
export function Nowcast() {
  const { active } = usePlaces();
  const [d, setD] = useState<{ k: string; m: M | "error" } | null>(null);
  const k = active ? `${active.lat.toFixed(3)},${active.lon.toFixed(3)}` : "";
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${active.lat}&longitude=${active.lon}&minutely_15=precipitation,temperature_2m,wind_gusts_10m,lightning_potential,visibility&forecast_minutely_15=48&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&models=best_match`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { minutely_15: M }) => live && setD({ k, m: j.minutely_15 }))
      .catch(() => live && setD({ k, m: "error" }));
    return () => {
      live = false;
    };
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps -- k is the place
  if (!active)
    return (
      <p className={s.muted}>
        Set your location on the Homepage for a 15-minute nowcast there.
      </p>
    );
  const m = d?.k === k ? d.m : null;
  if (m === "error")
    return (
      <p className={s.muted}>The nowcast isn&apos;t answering right now.</p>
    );
  if (!m) return <p className={s.muted}>Building the nowcast…</p>;
  const t = (x: string) =>
    new Date(x).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  const wet = m.precipitation.findIndex((v) => v >= 0.005);
  const dryAfter =
    wet >= 0 ? m.precipitation.findIndex((v, i) => i > wet && v < 0.005) : -1;
  const total = m.precipitation.reduce((a, b) => a + b, 0);
  const maxP = Math.max(0.02, ...m.precipitation);
  const gust = Math.max(...m.wind_gusts_10m);
  const lt = Math.max(0, ...(m.lightning_potential ?? []).map((v) => v ?? 0));
  return (
    <div className="grid gap-3">
      <section className={s.now}>
        <small>Next 12 hours at {active.label}</small>
        <h3>
          {wet < 0
            ? "Dry for the next 12 hours"
            : wet === 0
              ? dryAfter > 0
                ? `Wet now, drying out by ${t(m.time[dryAfter])}`
                : "Wet now and staying that way"
              : `Rain from about ${t(m.time[wet])}`}
        </h3>
        <div className={s.nowKeys}>
          <span>
            <b>{total.toFixed(2)}″</b>total
          </span>
          <span>
            <b>{Math.round(gust)}</b>mph peak gust
          </span>
          <span>
            <b>
              {Math.round(Math.min(...m.temperature_2m))}–
              {Math.round(Math.max(...m.temperature_2m))}°
            </b>
            range
          </span>
          {lt > 0 && (
            <span>
              <b>{Math.round(lt)}</b>J/kg lightning potential
            </span>
          )}
        </div>
      </section>
      <div className={s.steps}>
        {m.time.map((x, i) => (
          <div key={x}>
            <i style={{ transform: `scaleY(${m.precipitation[i] / maxP})` }} />
            <b>{Math.round(m.temperature_2m[i])}°</b>
            <small>{i % 4 === 0 ? t(x) : ""}</small>
          </div>
        ))}
      </div>
      <p className={s.muted}>
        Bars: rain in each 15 minutes (tallest {maxP.toFixed(2)}″). Open-Meteo,
        driven by the HRRR and NOAA&apos;s rapid-update models.
      </p>
    </div>
  );
}
