"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CloudRain,
  Leaf,
  MapPin,
  Moon,
  Sunrise,
  Sunset,
  Wind,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { useWeather } from "@/features/weather/useWeather";
import { WeatherIcon } from "@/features/weather/WeatherIcon";
import { Gauge } from "@/features/dashboard/widgets/Gauge";
import { Scene } from "@/features/dashboard/widgets/Scene";
import { timeIn, type Brief } from "@/lib/brief/compose";
import { dayParts24, type PartName } from "@/lib/brief/parts";
import { moonPhase, sunTimes } from "@/lib/weather/astro";
import { SPC_NAMES } from "@/lib/weather/conditions-math";
import { aqiBand, windMph } from "@/lib/air/scales";
import s from "./BriefView.module.css";

const SKY: Record<PartName, string> = {
  Morning: "linear-gradient(160deg, #ff9a5a33, #ffd16620 45%, transparent)",
  Afternoon: "linear-gradient(160deg, #4dabf733, #74c0fc1f 45%, transparent)",
  Evening: "linear-gradient(160deg, #b04bdb33, #ff6b6b1f 45%, transparent)",
  Overnight: "linear-gradient(160deg, #4c6ef533, #1c2a5a33 45%, transparent)",
};
const SPC_LEVELS = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];

/** Today's brief for the active place, laid out as a morning front page. */
export function BriefView({
  onTimeZone,
}: {
  onTimeZone?: (tz: string) => void;
}) {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const [res, setRes] = useState<{
    key: string;
    brief?: Brief;
    error?: string;
  } | null>(null);
  const key = active?.id ?? "";
  const { data: w } = useWeather(active);

  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    fetch(`/api/brief?lat=${active.lat}&lon=${active.lon}`, {
      signal: ctl.signal,
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "The brief is unavailable");
        setRes({ key, brief: b });
        onTimeZone?.(b.timeZone);
      })
      .catch(
        (e: Error) =>
          e.name !== "AbortError" && setRes({ key, error: e.message }),
      );
    return () => ctl.abort();
  }, [active, key, onTimeZone]);

  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );
  if (!active) {
    return (
      <Card className="grid gap-3">
        <p className="text-sm text-muted">Set a place to see its brief.</p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }
  const cur = res?.key === key ? res : null;
  const b = cur?.brief;
  const tz = b?.timeZone ?? w?.place.timeZone ?? "America/New_York";
  const parts = w ? dayParts24(w.hourly, tz) : [];
  const hours = w?.hourly.slice(0, 24) ?? [];
  const now = new Date();
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(
    now,
  );
  const sun = sunTimes(
    active.lat,
    active.lon,
    new Date(`${localDate}T12:00:00Z`),
  );
  const moon = moonPhase(now);
  const gust = Math.max(0, ...hours.map((h) => windMph(h.wind)));
  const long = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  const diff =
    b?.today?.high != null && b.tomorrow?.high != null
      ? b.tomorrow.high - b.today.high
      : null;

  return (
    <div className="grid gap-4">
      <button onClick={() => setSheet(true)} className={s.place}>
        <MapPin aria-hidden /> {active.label}
        <span>{long}</span>
      </button>

      {cur?.error && <Card className="text-sm text-muted">{cur.error}</Card>}
      {!cur && <div className={s.skeleton} aria-label="Loading brief" />}

      {b && (
        <>
          {b.alerts.length > 0 && (
            <section className={s.alerts} role="alert">
              {b.alerts.map((a) => (
                <p key={a.event + a.ends}>
                  <AlertTriangle aria-hidden />
                  <span>
                    <b>{a.event}</b>
                    {a.ends && <em> until {timeIn(a.ends, b.timeZone)}</em>}
                  </span>
                </p>
              ))}
            </section>
          )}

          {b.today && (
            <section className={s.front}>
              <Scene short={b.today.short} isDay />
              <p className={s.kicker}>
                <Sunrise aria-hidden /> {b.today.name}
              </p>
              <h2 className={s.headline}>{b.today.short}</h2>
              <p className={s.hilo}>
                <span>
                  <ArrowUp aria-hidden />
                  {b.today.high ?? "–"}°
                </span>
                <span>
                  <ArrowDown aria-hidden />
                  {b.today.low ?? "–"}°
                </span>
              </p>
              <p className={s.detail}>{b.today.detail}</p>
            </section>
          )}

          {parts.length > 0 && (
            <section className={s.parts} aria-label="Your day">
              {parts.map((p, i) => (
                <article
                  key={p.name}
                  style={{ background: SKY[p.name], ["--d" as string]: i }}
                >
                  <p className={s.pName}>{p.name}</p>
                  <WeatherIcon
                    short={p.short}
                    isDay={p.isDay}
                    className={s.pIcon}
                  />
                  <p className={s.pTemp}>
                    {p.hi}°<small> / {p.lo}°</small>
                  </p>
                  <p className={s.pShort}>{p.short}</p>
                  <p className={s.pPop}>
                    <CloudRain aria-hidden /> {p.pop}%
                  </p>
                </article>
              ))}
            </section>
          )}

          <section className={s.card}>
            <h3 className={s.h3}>
              <CloudRain aria-hidden /> Rain, next 24 hours
            </h3>
            <p className={s.lead}>
              {b.rain.startsAt
                ? `Rain likely from about ${timeIn(b.rain.startsAt, b.timeZone)}, up to ${b.rain.peakPop}%.`
                : b.rain.peakPop
                  ? `Mostly dry. Chances stay low (up to ${b.rain.peakPop}%).`
                  : "Dry. No rain expected."}
            </p>
            <div className={s.rain} aria-hidden>
              {hours.map((h, i) => (
                <i
                  key={h.start}
                  style={{
                    transform: `scaleY(${Math.max(0.04, (h.pop ?? 0) / 100)})`,
                    animationDelay: `${i * 25}ms`,
                    opacity: (h.pop ?? 0) >= 40 ? 1 : 0.55,
                  }}
                />
              ))}
            </div>
            {hours.length > 0 && (
              <div className={s.rainAxis}>
                <span>Now</span>
                <span>{timeIn(hours[12].start, tz)}</span>
                <span>{timeIn(hours[hours.length - 1].start, tz)}</span>
              </div>
            )}
          </section>

          <div className={s.duo}>
            <section className={s.card}>
              <h3 className={s.h3}>
                <Zap aria-hidden /> Severe risk
              </h3>
              <Gauge
                value={b.spc ? SPC_LEVELS.indexOf(b.spc) + 1 : 0}
                min={0}
                max={6}
                stops={[
                  "#3a3f55",
                  "#c1e9c1",
                  "#66a366",
                  "#ffe066",
                  "#ffa366",
                  "#e06666",
                  "#ee99ee",
                ]}
                center={<p className={s.gValue}>{b.spc ?? "None"}</p>}
                caption={b.spc ? SPC_NAMES[b.spc] : "No risk from SPC today"}
              />
            </section>
            <section className={s.card}>
              <h3 className={s.h3}>
                <Leaf aria-hidden /> Air quality
              </h3>
              {b.aqi != null ? (
                <Gauge
                  value={b.aqi}
                  min={0}
                  max={300}
                  stops={[
                    "#00e400",
                    "#ffff00",
                    "#ff7e00",
                    "#ff0000",
                    "#8f3f97",
                    "#7e0023",
                  ]}
                  center={
                    <p
                      className={s.gValue}
                      style={{ color: aqiBand(b.aqi).color }}
                    >
                      {b.aqi}
                    </p>
                  }
                  caption={aqiBand(b.aqi).label}
                />
              ) : (
                <p className="text-sm text-muted">No reading here.</p>
              )}
            </section>
          </div>

          <section className={s.chips}>
            <div>
              <Sunrise aria-hidden />
              <b>{sun.rise ? timeIn(sun.rise.toISOString(), tz) : "–"}</b>
              <span>Sunrise</span>
            </div>
            <div>
              <Sunset aria-hidden />
              <b>{sun.set ? timeIn(sun.set.toISOString(), tz) : "–"}</b>
              <span>Sunset</span>
            </div>
            <div>
              <Wind aria-hidden />
              <b>{gust} mph</b>
              <span>Top wind</span>
            </div>
            <div>
              <Moon aria-hidden />
              <b>{Math.round(moon.illumination * 100)}%</b>
              <span>{moon.name}</span>
            </div>
          </section>

          {b.tomorrow && (
            <section className={s.tomorrow}>
              <WeatherIcon short={b.tomorrow.short} isDay className={s.tIcon} />
              <div>
                <p className={s.kicker}>Tomorrow</p>
                <p className={s.tShort}>{b.tomorrow.short}</p>
                <p className={s.tTemps}>
                  <b>{b.tomorrow.high ?? "–"}°</b> / {b.tomorrow.low ?? "–"}°
                  {diff != null && diff !== 0 && (
                    <em className={diff > 0 ? s.warm : s.cool}>
                      {Math.abs(diff)}° {diff > 0 ? "warmer" : "cooler"}
                    </em>
                  )}
                </p>
              </div>
            </section>
          )}
        </>
      )}
      {sheetEl}
    </div>
  );
}
