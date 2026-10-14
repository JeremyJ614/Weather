"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";

type Layer = "none" | "day1" | "day2";
const empty = { type: "FeatureCollection" as const, features: [] };

/** Wildfires (dots by containment), burn perimeters and an optional SPC fire outlook day. */
export function FireMap({
  outlook,
  focus,
  onPick,
}: {
  outlook: Layer;
  /** Fly here when it changes (a fire picked from the list). */
  focus: { lat: number; lon: number; acres: number } | null;
  onPick: (id: string | null) => void;
}) {
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    let live = true;
    const load = (src: string, url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : empty))
        .then((g) => {
          if (live) (m.getSource(src) as GeoJSONSource | undefined)?.setData(g);
        })
        .catch(() => {});
    load("fires", "/api/fire/map?layer=fires");
    load("perims", "/api/fire/map?layer=perimeters");
    return () => {
      live = false;
    };
  }, [ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource("outlook") as GeoJSONSource | undefined;
    if (outlook === "none") src?.setData(empty);
    else
      fetch(`/api/fire/map?layer=${outlook}`)
        .then((r) => (r.ok ? r.json() : empty))
        .then((g) => src?.setData(g))
        .catch(() => {});
  }, [outlook, ready]);

  useEffect(() => {
    if (focus && map.current)
      map.current.flyTo({
        center: [focus.lon, focus.lat],
        zoom: focus.acres > 20000 ? 8 : 10,
        duration: 1100,
      });
  }, [focus]);

  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    m.addSource("outlook", { type: "geojson", data: empty });
    m.addSource("perims", { type: "geojson", data: empty });
    m.addSource("fires", { type: "geojson", data: empty });
    m.addLayer({
      id: "outlook",
      type: "fill",
      source: "outlook",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.3 },
    });
    m.addLayer({
      id: "outlook-line",
      type: "line",
      source: "outlook",
      paint: { "line-color": ["get", "color"], "line-width": 1.5 },
    });
    m.addLayer({
      id: "perims",
      type: "fill",
      source: "perims",
      paint: { "fill-color": "#ef4444", "fill-opacity": 0.35 },
    });
    m.addLayer({
      id: "perims-line",
      type: "line",
      source: "perims",
      paint: { "line-color": "#fca5a5", "line-width": 1.2 },
    });
    m.addLayer({
      id: "fires",
      type: "circle",
      source: "fires",
      paint: {
        "circle-radius": ["get", "r"],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.85,
        "circle-stroke-color": "#0b0c14",
        "circle-stroke-width": 1.5,
      },
    });
    m.on("click", "fires", (e) =>
      pick.current(
        String(
          (e as unknown as { features: { properties: { id: string } }[] })
            .features[0]?.properties.id ?? "",
        ),
      ),
    );
    m.on("mouseenter", "fires", () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", "fires", () => (m.getCanvas().style.cursor = ""));
    map.current = m;
    setReady(true);
  };

  return (
    <WeatherMap
      center={[-110, 40]}
      zoom={3}
      label="Wildfires and fire weather map"
      className="h-[58dvh] min-h-80"
      onReady={onReady}
    />
  );
}
