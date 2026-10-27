"use client";

import { useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  Droplet,
  Droplets,
  MapPin,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LocationSheet } from "@/features/location/LazyLocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { useWeather } from "./useWeather";
import { WeatherIcon } from "./WeatherIcon";
import s from "./TodayCard.module.css";

/** Today at the active place: now, high/low, rain chance, and the next few periods. */
export function TodayCard() {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const [retry, setRetry] = useState(0);
  const { data: w, error, loading } = useWeather(active, retry);

  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );

  if (!active) {
    return (
      <section className={`${s.card} grid gap-3`}>
        <p className="eyebrow">Your local weather</p>
        <p className="text-sm text-muted">
          Add your location or a ZIP code to see today&apos;s forecast.
        </p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </section>
    );
  }

  const now = w?.hourly[0];
  const high = w?.daily.find((p) => p.isDay)?.temp;
  const low = w?.daily.find((p) => !p.isDay)?.temp;
  const rain = w
    ? Math.max(0, ...w.hourly.slice(0, 12).map((h) => h.pop ?? 0))
    : 0;

  return (
    <section className={s.card} aria-busy={loading}>
      <div className={s.head}>
        <p className={s.live}>
          <span className={s.dot} aria-hidden />
          Live conditions
        </p>
        <button
          className={s.place}
          onClick={() => setSheet(true)}
          aria-label={`Location: ${active.label}. Change`}
        >
          <MapPin className="size-3.5" aria-hidden />
          {active.label}
          <ChevronDown className="size-3.5 text-muted" aria-hidden />
        </button>
      </div>

      {error && (
        <div className="grid gap-3 p-4">
          <p className="text-sm text-muted">{error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>Try again</Button>
        </div>
      )}

      {loading && <div className={s.skeleton} aria-label="Loading forecast" />}

      {w && now && (
        <>
          <div className={s.hero}>
            <span className={s.iconGlow}>
              <WeatherIcon
                short={now.short}
                isDay={now.isDay}
                className="size-14 text-accent"
              />
            </span>
            <div>
              <p className={s.temp}>
                {now.temp}
                <sup>°F</sup>
              </p>
              <p className={s.short}>{now.short}</p>
            </div>
          </div>
          <dl className={s.stats}>
            <div>
              <dt>
                <ArrowUpDown aria-hidden /> High / Low
              </dt>
              <dd>
                {high ?? "–"}° / {low ?? "–"}°
              </dd>
            </div>
            <div>
              <dt>
                <Droplets aria-hidden /> Rain, 12 h
              </dt>
              <dd>{rain}%</dd>
            </div>
            <div>
              <dt>
                <Wind aria-hidden /> Wind
              </dt>
              <dd>{now.wind}</dd>
            </div>
            <div>
              <dt>
                <Droplet aria-hidden /> Dew point
              </dt>
              <dd>{now.dewF != null ? `${now.dewF}°` : "–"}</dd>
            </div>
          </dl>
          <ol className={s.strip} aria-label="Coming up">
            {w.daily.slice(0, 8).map((p, i) => (
              <li
                key={p.start}
                className={p.isDay ? s.day : s.night}
                style={{ ["--d" as string]: i }}
              >
                <span className={s.pname}>{p.name}</span>
                <WeatherIcon
                  short={p.short}
                  isDay={p.isDay}
                  className="size-5 text-accent"
                />
                <span className={s.ptemp}>{p.temp}°</span>
                <span className={s.ppop}>{p.pop ? `${p.pop}%` : " "}</span>
              </li>
            ))}
          </ol>
          <p className={s.foot}>
            NWS {w.place.office} · updated{" "}
            {new Date(w.updated).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: w.place.timeZone,
              timeZoneName: "short",
            })}
          </p>
        </>
      )}
      {sheetEl}
    </section>
  );
}
