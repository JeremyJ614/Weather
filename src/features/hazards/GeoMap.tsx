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
  /** Zoom to what was drawn (for products that cover a small area). */
  fit?: boolean;
};

/** An interactive US map of one colored GeoJSON layer, loaded after the map is ready. */
export function GeoMap({
  url,
  label,
  filter,
  onPick,
  className = "h-[56dvh] min-h-80",
  fit = false,
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Government map services are often slow; try a few times before giving up.
    const load = (tries: number) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((g: GeoJSON.FeatureCollection) => {
          if (!live) return;
          (m.getSource("geo") as GeoJSONSource | undefined)?.setData(g);
          setState("ok");
          // Small areas (one state's worth of risk) are easy to miss at a national zoom.
          const pts = g.features.flatMap((f) =>
            f.geometry.type === "Polygon"
              ? f.geometry.coordinates.flat()
              : f.geometry.type === "MultiPolygon"
                ? f.geometry.coordinates.flat(2)
                : [],
          );
          if (fit && pts.length) {
            const xs = pts.map((p) => p[0]);
            const ys = pts.map((p) => p[1]);
            m.fitBounds(
              [
                [Math.min(...xs), Math.min(...ys)],
                [Math.max(...xs), Math.max(...ys)],
              ],
              { padding: 40, maxZoom: 5.5, duration: 800 },
            );
          }
        })
        .catch(() => {
          if (!live) return;
          if (tries > 0) timer = setTimeout(() => load(tries - 1), 4000);
          else setState("error");
        });
    setState("loading");
    load(3);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [url, ready, fit]);

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
