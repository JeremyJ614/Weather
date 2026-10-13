"use client";

import { useEffect, useState } from "react";
import type { WeatherBundle } from "@/lib/weather/types";

type Result = { key: string; data?: WeatherBundle; error?: string };
const inflight = new Map<string, Promise<WeatherBundle>>();

function load(lat: number, lon: number, retry: number) {
  const k = `${lat},${lon}#${retry}`;
  let p = inflight.get(k);
  if (!p) {
    p = fetch(`/api/weather?lat=${lat}&lon=${lon}`).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Weather data is unavailable");
      return body as WeatherBundle;
    });
    p.catch(() => inflight.delete(k));
    inflight.set(k, p);
    // Fresh enough for a page view; a later visit refetches.
    setTimeout(() => inflight.delete(k), 5 * 60_000);
  }
  return p;
}

/** The forecast bundle for a place, shared by every card on the page (one request). */
export function useWeather(
  place: { lat: number; lon: number } | null,
  retry = 0,
) {
  const key = place ? `${place.lat},${place.lon}#${retry}` : "";
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!place) return;
    let live = true;
    load(place.lat, place.lon, retry)
      .then((data) => live && setResult({ key, data }))
      .catch((e: Error) => live && setResult({ key, error: e.message }));
    return () => {
      live = false;
    };
  }, [place, key, retry]);
  const current = result?.key === key ? result : null;
  return { data: current?.data, error: current?.error, loading: !current };
}
