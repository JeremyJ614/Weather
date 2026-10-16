"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageSource, Map as MaplibreMap } from "maplibre-gl";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";

type Bounds = [number, number, number, number];
const corners = ([w, s, e, n]: Bounds): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] => [
  [w, n],
  [e, n],
  [e, s],
  [w, s],
];

/** A US map with one image laid over it (west, south, east, north bounds). */
export function OverlayMap({
  url,
  bounds,
  label,
  opacity = 0.78,
}: {
  url: string;
  bounds: Bounds;
  label: string;
  opacity?: number;
}) {
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    let live = true;
    queueMicrotask(() => live && setState("loading"));
    // Preload so a failed image shows a message instead of a silent empty map.
    const img = new Image();
    img.onload = () => {
      if (!live) return;
      const src = m.getSource("overlay") as ImageSource | undefined;
      if (src) src.updateImage({ url, coordinates: corners(bounds) });
      else {
        m.addSource("overlay", {
          type: "image",
          url,
          coordinates: corners(bounds),
        });
        m.addLayer({
          id: "overlay",
          type: "raster",
          source: "overlay",
          paint: { "raster-opacity": opacity, "raster-fade-duration": 250 },
        });
      }
      setState("ok");
    };
    img.onerror = () => live && setState("error");
    img.src = url;
    return () => {
      live = false;
    };
  }, [url, bounds, ready]); // eslint-disable-line react-hooks/exhaustive-deps -- opacity has its own effect

  useEffect(() => {
    const m = map.current;
    if (m && ready && m.getLayer("overlay"))
      m.setPaintProperty("overlay", "raster-opacity", opacity);
  }, [opacity, ready]);

  const onReady = ({ map: any }: ReadyMap) => {
    map.current = any as unknown as MaplibreMap;
    setReady(true);
  };

  return (
    <div className="relative">
      <WeatherMap
        center={[-97, 39]}
        zoom={2.9}
        label={label}
        className="h-[52dvh] min-h-72"
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
