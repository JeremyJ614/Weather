"use client";

import { useRef, useState } from "react";
import { WeatherMap, type AnyMap } from "@/features/map/WeatherMap";
import { usePlaces } from "@/features/location/usePlaces";
import { eddiTiles, heatRiskTiles, setRaster } from "@/lib/map/raster";
import { HEATRISK_LEVELS, WPC_QPF } from "@/lib/weather/wpc";
import { Chips } from "./Chips";

const day = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** WPC subtab: rain totals, HeatRisk and rapid-onset drought. */
export function WpcPanel({ heatDays }: { heatDays: number[] }) {
  const { active } = usePlaces();
  const center: [number, number] = active
    ? [active.lon, active.lat]
    : [-97.5, 38.5];
  const [qpf, setQpf] = useState<string>("d1");
  const [heatDay, setHeatDay] = useState(heatDays[0] ?? 0);
  const heatMap = useRef<AnyMap | null>(null);
  const img = WPC_QPF.find((q) => q.id === qpf)!;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h2 className="display text-2xl text-accent">Rainfall forecast</h2>
        <Chips
          items={WPC_QPF.map((q) => ({ id: q.id as string, label: q.label }))}
          value={qpf}
          onPick={setQpf}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- official WPC graphic, loaded directly */}
        <img
          key={img.src}
          src={img.src}
          alt={`WPC rainfall forecast, ${img.label}`}
          className="w-full rounded-2xl border border-line bg-white"
        />
        <p className="text-xs text-muted">
          Weather Prediction Center quantitative precipitation forecast. Updated
          by WPC several times a day.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="display text-2xl text-accent">HeatRisk</h2>
        {heatDays.length > 0 ? (
          <>
            <Chips
              items={heatDays.map((t) => ({ id: t, label: day(t) }))}
              value={heatDay}
              onPick={(t) => {
                setHeatDay(t);
                if (heatMap.current)
                  setRaster(
                    heatMap.current,
                    "heatrisk",
                    heatRiskTiles(t),
                    0.75,
                  );
              }}
            />
            <WeatherMap
              center={center}
              zoom={active ? 5 : 3}
              label="NWS HeatRisk map"
              className="h-80"
              onReady={({ map }) => {
                heatMap.current = map;
                setRaster(map, "heatrisk", heatRiskTiles(heatDay), 0.75);
              }}
            />
            <ul className="flex flex-wrap gap-3 text-xs text-muted">
              {HEATRISK_LEVELS.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span
                    className="size-3 rounded-sm"
                    style={{ background: l.color }}
                    aria-hidden
                  />
                  {l.label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">
            The NWS HeatRisk service isn&apos;t answering right now.
          </p>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="display text-2xl text-accent">Rapid drought onset</h2>
        <p className="text-sm text-muted">
          Evaporative Demand Drought Index, 2-week: warm colors show the air
          drying the land faster than normal, an early warning of flash drought.
          Blues show wetter than normal.
        </p>
        <WeatherMap
          center={center}
          zoom={active ? 5 : 3}
          label="Evaporative Demand Drought Index map"
          className="h-80"
          onReady={({ map }) => setRaster(map, "eddi", eddiTiles(11), 0.75)}
        />
      </section>
    </div>
  );
}
