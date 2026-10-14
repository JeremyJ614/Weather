"use client";

import { useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { BASINS, type BasinId } from "@/lib/tropical/style";
import type { Outlook } from "@/lib/tropical/nhc";

type Geo = Outlook["geo"];
type Hit = { title: string; lines: string[] };

const isLine = ["==", ["geometry-type"], "LineString"];
const isPoint = ["==", ["geometry-type"], "Point"];

/** NHC's picture of a basin: outlook areas, cones, tracks, forecast points and watches. */
export function TropicalMap({ geo, start }: { geo: Geo; start: BasinId }) {
  const map = useRef<MaplibreMap | null>(null);
  const [basin, setBasin] = useState<BasinId>(start);
  const [hit, setHit] = useState<Hit | null>(null);
  const b0 = BASINS.find((b) => b.id === start)!;

  const ready = ({ map: any }: ReadyMap) => {
    // Mapbox and MapLibre share these calls; MapLibre's types describe both.
    const m = any as unknown as MaplibreMap;
    map.current = m;
    const add = (id: string, data: Geo[keyof Geo]) =>
      m.addSource(id, {
        type: "geojson",
        data: data as GeoJSON.FeatureCollection,
      });
    (Object.keys(geo) as (keyof Geo)[]).forEach((k) => add(k, geo[k]));
    m.addLayer({
      id: "areas-fill",
      type: "fill",
      source: "areas",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.22 },
    });
    m.addLayer({
      id: "areas-line",
      type: "line",
      source: "areas",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 2,
        "line-dasharray": [2, 1.5],
      },
    });
    m.addLayer({
      id: "motion",
      type: "line",
      source: "motion",
      paint: { "line-color": ["get", "color"], "line-width": 2.5 },
    });
    m.addLayer({
      id: "spots",
      type: "circle",
      source: "spots",
      paint: {
        "circle-radius": 6,
        "circle-color": "#0b0c14",
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 3,
      },
    });
    m.addLayer({
      id: "cones-fill",
      type: "fill",
      source: "cones",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.12 },
    });
    m.addLayer({
      id: "cones-line",
      type: "line",
      source: "cones",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.2,
        "line-opacity": 0.7,
      },
    });
    m.addLayer({
      id: "warnings",
      type: "line",
      source: "warnings",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 5,
        "line-opacity": 0.9,
      },
      layout: { "line-cap": "round" },
    });
    m.addLayer({
      id: "past-line",
      type: "line",
      source: "past",
      filter: isLine as never,
      paint: {
        "line-color": "#c9cbd6",
        "line-width": 1.5,
        "line-opacity": 0.55,
      },
    });
    m.addLayer({
      id: "past-dots",
      type: "circle",
      source: "past",
      filter: isPoint as never,
      paint: { "circle-radius": 2.5, "circle-color": ["get", "color"] },
    });
    m.addLayer({
      id: "tracks",
      type: "line",
      source: "tracks",
      paint: {
        "line-color": "#e8e9f0",
        "line-width": 1.6,
        "line-dasharray": [2, 2],
      },
    });
    m.addLayer({
      id: "points",
      type: "circle",
      source: "points",
      paint: {
        "circle-radius": ["case", ["==", ["get", "tau"], 0], 8, 5.5],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#0b0c14",
        "circle-stroke-width": 1.5,
      },
    });

    const show = (
      e: { features?: { properties: Record<string, unknown> }[] },
      kind: string,
    ) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      if (kind === "points")
        setHit({
          title: String(p.stormname ?? "Forecast"),
          lines: [
            `${p.datelbl ?? ""}${Number(p.tau) ? ` · in ${p.tau} h` : " · now"}`,
            `${Math.round(Number(p.maxwind) * 1.15078)} mph winds, gusts ${Math.round(Number(p.gust) * 1.15078)} mph`,
            String(p.tcdvlp ?? ""),
          ],
        });
      else
        setHit({
          title: "Development chance",
          lines: [
            `Next 48 hours: ${p.prob2day ?? "–"}`,
            `Next 7 days: ${p.prob7day ?? "–"}`,
          ],
        });
    };
    for (const id of ["points", "areas-fill", "spots"]) {
      m.on("click", id, (e) => show(e as never, id));
      m.on("mouseenter", id, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", id, () => (m.getCanvas().style.cursor = ""));
    }
  };

  const go = (id: BasinId) => {
    setBasin(id);
    setHit(null);
    const b = BASINS.find((x) => x.id === id)!;
    map.current?.flyTo({ center: b.center, zoom: b.zoom, duration: 900 });
  };

  return (
    <div className="grid gap-2">
      <div className="flex gap-1.5" role="group" aria-label="Basin">
        {BASINS.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={basin === b.id}
            onClick={() => go(b.id)}
            className="min-h-9 rounded-full border border-line px-3 text-xs font-semibold aria-pressed:border-[var(--lit-line)] aria-pressed:bg-[var(--lit)] aria-pressed:text-accent"
          >
            {b.name}
          </button>
        ))}
      </div>
      <div className="relative">
        <WeatherMap
          center={b0.center}
          zoom={b0.zoom}
          label="Tropical outlook map"
          className="h-[60dvh] min-h-80"
          onReady={ready}
        />
        {hit && (
          <button
            type="button"
            onClick={() => setHit(null)}
            className="absolute right-2 bottom-2 left-2 grid gap-0.5 rounded-xl border border-[var(--lit-line)] bg-[var(--bg)]/90 p-3 text-left text-sm"
          >
            <b>{hit.title}</b>
            {hit.lines.filter(Boolean).map((l) => (
              <span key={l} className="text-muted">
                {l}
              </span>
            ))}
          </button>
        )}
      </div>
    </div>
  );
}
