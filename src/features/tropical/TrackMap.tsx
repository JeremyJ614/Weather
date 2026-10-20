"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MaplibreMap,
} from "maplibre-gl";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { unwrap } from "@/lib/tropical/jtwc";
import { INTENSITY } from "@/lib/tropical/style";

export type MapTrack = {
  id: string;
  /** [lat, lon, kt], oldest first. */
  points: [number, number, number][];
  /** Forecast positions after the last point, drawn dashed. */
  forecast?: [number, number, number][];
};
export type MapDot = {
  id: string;
  lat: number;
  lon: number;
  kt: number;
  label: string;
};

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** A step expression giving each wind speed its Saffir-Simpson color. */
function byWind(colors: Colors): ExpressionSpecification {
  const c = INTENSITY.map((t) => pick(colors, `trop:${t.key}`, t.color));
  return [
    "step",
    ["get", "kt"],
    c[0],
    ...INTENSITY.slice(1).flatMap((t, i) => [t.min, c[i + 1]]),
  ] as unknown as ExpressionSpecification;
}

function features(tracks: MapTrack[], selected: string | null) {
  const lines: GeoJSON.Feature[] = [];
  for (const t of tracks) {
    const all = [...t.points, ...(t.forecast ?? [])];
    const lons = unwrap(all.map((p) => p[1]));
    all.forEach((p, i) => {
      if (!i) return;
      lines.push({
        type: "Feature",
        properties: {
          id: t.id,
          kt: all[i - 1][2],
          on: t.id === selected ? 1 : selected ? 0 : 0.5,
          fc: i >= t.points.length ? 1 : 0,
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [lons[i - 1], all[i - 1][0]],
            [lons[i], p[0]],
          ],
        },
      });
    });
  }
  return lines;
}

/**
 * Storm tracks colored by strength (the editable Saffir-Simpson colors), forecasts dashed,
 * current positions as dots. Tapping a track or dot picks that storm; the map frames the
 * picked one.
 */
export function TrackMap({
  tracks,
  dots = [],
  selected,
  onPick,
  colors,
  center,
  zoom,
  label,
}: {
  tracks: MapTrack[];
  dots?: MapDot[];
  selected: string | null;
  onPick?: (id: string) => void;
  colors: Colors;
  center: [number, number];
  zoom: number;
  label: string;
}) {
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("trk") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: features(tracks, selected),
    });
    (m.getSource("dot") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: dots.map((d) => ({
        type: "Feature",
        properties: { id: d.id, kt: d.kt, label: d.label },
        geometry: { type: "Point", coordinates: [d.lon, d.lat] },
      })),
    });
  }, [ready, tracks, dots, selected]);

  // Frames the picked storm once, when it is picked, so panning afterwards sticks.
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const t = tracksRef.current.find((x) => x.id === selected);
    if (t) {
      const all = [...t.points, ...(t.forecast ?? [])];
      const lons = unwrap(all.map((p) => p[1]));
      const lats = all.map((p) => p[0]);
      m.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ] as LngLatBoundsLike,
        { padding: 40, maxZoom: 5.5, duration: 700 },
      );
    }
  }, [ready, selected]);

  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    const wind = byWind(colors);
    m.addSource("trk", { type: "geojson", data: EMPTY });
    m.addSource("dot", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "trk",
      type: "line",
      source: "trk",
      filter: ["==", ["get", "fc"], 0],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": wind,
        "line-width": ["case", ["==", ["get", "on"], 1], 4, 2],
        "line-opacity": ["case", ["==", ["get", "on"], 0], 0.35, 0.95],
      },
    });
    m.addLayer({
      id: "trk-fc",
      type: "line",
      source: "trk",
      filter: ["==", ["get", "fc"], 1],
      paint: {
        "line-color": wind,
        "line-width": 2.5,
        "line-dasharray": [1.5, 1.5],
        "line-opacity": ["case", ["==", ["get", "on"], 0], 0.35, 0.9],
      },
    });
    m.addLayer({
      id: "dot",
      type: "circle",
      source: "dot",
      paint: {
        "circle-radius": 7,
        "circle-color": wind,
        "circle-stroke-color": "#0b0c14",
        "circle-stroke-width": 2,
      },
    });
    for (const layer of ["trk", "dot"]) {
      m.on("click", layer, (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") pickRef.current?.(id);
      });
      m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
    }
    map.current = m;
    setReady(true);
  };

  return (
    <WeatherMap
      center={center}
      zoom={zoom}
      label={label}
      className="h-[46dvh] min-h-72"
      onReady={onReady}
    />
  );
}
