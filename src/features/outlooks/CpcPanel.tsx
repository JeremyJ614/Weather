"use client";

import { useRef, useState } from "react";
import { WeatherMap, type AnyMap } from "@/features/map/WeatherMap";
import { usePlaces } from "@/features/location/usePlaces";
import { outlookTiles, setRaster } from "@/lib/map/raster";
import { CPC_LEGEND, CPC_OUTLOOKS } from "@/lib/weather/cpc";
import { Chips } from "./Chips";

/** CPC subtab: 6–10 and 8–14 day, monthly, seasonal and drought outlooks on the map. */
export function CpcPanel() {
  const { active } = usePlaces();
  const [pick, setPick] = useState<string>("610t");
  const map = useRef<AnyMap | null>(null);
  const o = CPC_OUTLOOKS.find((x) => x.id === pick)!;
  const show = (id: string) => {
    setPick(id);
    const next = CPC_OUTLOOKS.find((x) => x.id === id)!;
    if (map.current)
      setRaster(
        map.current,
        "cpc",
        outlookTiles(next.service, next.layer),
        0.8,
      );
  };
  return (
    <section className="grid gap-3">
      <h2 className="display text-2xl text-accent">
        Climate Prediction Center
      </h2>
      <Chips
        items={CPC_OUTLOOKS.map((x) => ({
          id: x.id as string,
          label: x.label,
        }))}
        value={pick}
        onPick={show}
      />
      <WeatherMap
        center={active ? [active.lon, active.lat] : [-97.5, 38.5]}
        zoom={active ? 4.5 : 3}
        label={`CPC ${o.label} outlook map`}
        className="h-96"
        onReady={({ map: m }) => {
          map.current = m;
          setRaster(m, "cpc", outlookTiles(o.service, o.layer), 0.8);
        }}
      />
      <p className="text-sm text-muted">{CPC_LEGEND[o.kind]}</p>
    </section>
  );
}
