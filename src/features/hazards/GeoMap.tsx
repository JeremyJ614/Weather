"use client";

import { useEffect, useRef, useState } from "react";
import type {
  FilterSpecification,
  GeoJSONSource,
  Map as MaplibreMap,
} from "maplibre-gl";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";

type Props = {
  /** A GeoJSON URL whose features carry a `color` property. */
  url: string;
  label: string;
  filter?: FilterSpecification;
  /** Called with the tapped feature's properties (or null on empty map). */
  onPick?: (p: Record<string, unknown> | null) => void;
  className?: string;
};

/** An interactive US map of one colored GeoJSON layer, loaded after the map is ready. */
export function GeoMap({
  url,
  label,
  filter,
  onPick,
  className = "h-[56dvh] min-h-80",
}: Props) {
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((g) => {
        if (!live) return;
        (m.getSource("geo") as GeoJSONSource | undefined)?.setData(g);
        setState("ok");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [url, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.setFilter("geo-fill", filter ?? null);
    m.setFilter("geo-line", filter ?? null);
  }, [filter, ready]);

  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    m.addSource("geo", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "geo-fill",
      type: "fill",
      source: "geo",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.45 },
    });
    m.addLayer({
      id: "geo-line",
      type: "line",
      source: "geo",
      paint: { "line-color": ["get", "color"], "line-width": 1.2 },
    });
    m.on("click", (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ["geo-fill"] });
      pickRef.current?.(
        f.length
          ? (f[f.length - 1].properties as Record<string, unknown>)
          : null,
      );
    });
    map.current = m;
    setReady(true);
  };

  return (
    <div className="relative">
      <WeatherMap
        center={[-97, 38.5]}
        zoom={2.9}
        label={label}
        className={className}
        onReady={onReady}
      />
      {state !== "ok" && (
        <p className="pointer-events-none absolute inset-x-3 top-3 rounded-xl bg-[var(--bg)]/85 p-2 text-center text-xs text-muted">
          {state === "loading"
            ? "Loading the map…"
            : "This map isn't available right now. Try again soon."}
        </p>
      )}
    </div>
  );
}
