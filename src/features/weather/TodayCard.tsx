"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Droplets, MapPin, Wind } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import type { WeatherBundle } from "@/lib/weather/types";
import { WeatherIcon } from "./WeatherIcon";

type Result = { key: string; data?: WeatherBundle; error?: string };

/** Today at the active place: now, high/low, rain chance, and the next few periods. */
export function TodayCard() {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = active ? `${active.id}#${retry}` : "";

  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    fetch(`/api/weather?lat=${active.lat}&lon=${active.lon}`, {
      signal: ctl.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Weather data is unavailable");
        setResult({ key, data: body });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setResult({ key, error: e.message });
      });
    return () => ctl.abort();
  }, [active, key]);

  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );

  if (!active) {
    return (
      <Card className="grid gap-3">
        <h2 className="display text-2xl text-accent">Your local weather</h2>
        <p className="text-muted">
          Add your location or a ZIP code to see today&apos;s forecast.
        </p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }

  const current = result?.key === key ? result : null;
  const w = current?.data;
  const now = w?.hourly[0];
  const high = w?.daily.find((p) => p.isDay)?.temp;
  const low = w?.daily.find((p) => !p.isDay)?.temp;
  const rain = w
    ? Math.max(0, ...w.hourly.slice(0, 12).map((h) => h.pop ?? 0))
    : 0;

  return (
    <Card className="grid gap-4" aria-busy={!current}>
      <button
        className="flex items-center gap-2 justify-self-start font-bold text-accent"
        onClick={() => setSheet(true)}
        aria-label={`Location: ${active.label}. Change`}
      >
        <MapPin className="size-4" aria-hidden />
        {active.label}
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>

      {current?.error && (
        <div className="grid gap-3">
          <p className="text-muted">{current.error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>Try again</Button>
        </div>
      )}

      {!current && (
        <div
          className="h-40 animate-pulse rounded-xl bg-surface2"
          aria-label="Loading forecast"
        />
      )}

      {w && now && (
        <>
          <div className="flex items-center gap-4">
            <WeatherIcon
              short={now.short}
              isDay={now.isDay}
              className="size-14 text-accent"
            />
            <div>
              <p className="display text-6xl leading-none">{now.temp}°</p>
              <p className="mt-1 text-muted">{now.short}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-bg p-2">
              <dt className="text-muted">High / Low</dt>
              <dd className="font-bold">
                {high ?? "–"}° / {low ?? "–"}°
              </dd>
            </div>
            <div className="rounded-xl bg-bg p-2">
              <dt className="flex items-center justify-center gap-1 text-muted">
                <Droplets className="size-3.5" aria-hidden /> Rain, 12 h
              </dt>
              <dd className="font-bold">{rain}%</dd>
            </div>
            <div className="rounded-xl bg-bg p-2">
              <dt className="flex items-center justify-center gap-1 text-muted">
                <Wind className="size-3.5" aria-hidden /> Wind
              </dt>
              <dd className="font-bold">{now.wind}</dd>
            </div>
          </dl>
          <ol
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
            aria-label="Coming up"
          >
            {w.daily.slice(0, 6).map((p) => (
              <li
                key={p.start}
                className="grid w-24 flex-none justify-items-center gap-1 rounded-xl border border-line bg-bg p-2 text-center"
              >
                <span className="text-xs text-muted">{p.name}</span>
                <WeatherIcon
                  short={p.short}
                  isDay={p.isDay}
                  className="size-6 text-accent"
                />
                <span className="font-bold">{p.temp}°</span>
                <span className="text-xs text-muted">
                  {p.pop ? `${p.pop}%` : " "}
                </span>
              </li>
            ))}
          </ol>
          <p className="mono text-xs text-muted">
            National Weather Service {w.place.office} · updated{" "}
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
    </Card>
  );
}
