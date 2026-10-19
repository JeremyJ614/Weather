"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { BASINS, type BasinId } from "@/lib/tropical/style";
import type { Outlook, Storm } from "@/lib/tropical/nhc";
import s from "./TropicalMap.module.css";

type Geo = Outlook["geo"];
export type ReconDot = {
  key: string;
  lat: number;
  lon: number;
  label: string;
  active: boolean;
};

/** NASA GIBS MUR sea-surface temperature; the analysis lags about three days. */
const SST = (date: string) =>
  "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=GHRSST_L4_MUR_Sea_Surface_Temperature&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=TRUE&CRS=EPSG%3A3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}&TIME=" +
  date;
/** GIBS's own MUR palette, read off its legend (°C), for the key under the map. */
export const SST_KEY = [
  { c: 20, color: "#1d2f8f" },
  { c: 22, color: "#2563c9" },
  { c: 24, color: "#22b8d8" },
  { c: 26, color: "#2fbf71" },
  { c: 28, color: "#e6d93a" },
  { c: 30, color: "#ef8a2c" },
  { c: 32, color: "#c9342b" },
];
const sstDate = () =>
  new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
const centroid = (g: GeoJSON.Geometry): [number, number] | null => {
  const ring =
    g.type === "Polygon"
      ? g.coordinates[0]
      : g.type === "MultiPolygon"
        ? g.coordinates[0][0]
        : null;
  if (!ring?.length) return null;
  const x = ring.reduce((a, p) => a + p[0], 0) / ring.length;
  const y = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  return [x, y];
};
type Label = {
  kind: "storm" | "odds" | "recon";
  key: string;
  x: number;
  y: number;
  text: string;
  color?: string;
  active?: boolean;
};
type Toggles = { sst: boolean; odds: boolean; recon: boolean; labels: boolean };
type Hit = { title: string; lines: string[] };

const isLine = ["==", ["geometry-type"], "LineString"];
const isPoint = ["==", ["geometry-type"], "Point"];
/** The U.S. with the East Pacific, Gulf, Caribbean and western Atlantic around it. */
const US_BOX: [[number, number], [number, number]] = [
  [-130, 8],
  [-58, 50],
];

/** NHC's picture of a basin: outlook areas, cones, tracks, forecast points and watches. */
export function TropicalMap({
  geo,
  start,
  storms = [],
  recon = [],
  focus,
  wide,
}: {
  geo: Geo;
  start: BasinId;
  storms?: Storm[];
  recon?: ReconDot[];
  /** Open on one storm instead of a basin. */
  focus?: { lat: number; lon: number };
  /** Open on the U.S. and its oceans (the page's headline map). */
  wide?: boolean;
}) {
  const map = useRef<MaplibreMap | null>(null);
  const [basin, setBasin] = useState<string>(
    focus ? "focus" : wide ? "us" : storms.length ? "active" : start,
  );
  const [hit, setHit] = useState<Hit | null>(null);
  const [t, setT] = useState<Toggles>({
    sst: true,
    odds: true,
    recon: true,
    labels: true,
  });
  const [labels, setLabels] = useState<Label[]>([]);
  const src = useRef({ storms, recon, geo });
  const b0 = BASINS.find((b) => b.id === start)!;
  const activeBox = () => {
    if (!storms.length) return null;
    const xs = storms.map((x) => x.lon);
    const ys = storms.map((x) => x.lat);
    return [
      [Math.min(...xs) - 12, Math.min(...ys) - 8],
      [Math.max(...xs) + 12, Math.max(...ys) + 8],
    ] as [[number, number], [number, number]];
  };

  function relayout() {
    const m = map.current;
    if (!m) return;
    const c = m.getContainer();
    const at = (lon: number, lat: number) => {
      const p = m.project([lon, lat]);
      return p.x < -40 ||
        p.y < -20 ||
        p.x > c.clientWidth + 40 ||
        p.y > c.clientHeight + 20
        ? null
        : { x: p.x, y: p.y };
    };
    const { storms: st, recon: rc, geo: g } = src.current;
    const out: Label[] = [];
    for (const x of st) {
      const p = at(x.lon, x.lat);
      if (p)
        out.push({
          kind: "storm",
          key: x.id,
          ...p,
          text: `${x.name.toUpperCase()} ${x.mph}`,
          color: x.color,
        });
    }
    (g.areas.features ?? []).forEach((f, i) => {
      const pr = (f.properties ?? {}) as Record<string, unknown>;
      const ctr = pr.prob7day ? centroid(f.geometry) : null;
      const p = ctr && at(ctr[0], ctr[1]);
      if (p)
        out.push({
          kind: "odds",
          key: `a${i}`,
          ...p,
          text: String(pr.prob7day),
          color: String(pr.color ?? ""),
        });
    });
    for (const r of rc) {
      const p = at(r.lon, r.lat);
      if (p)
        out.push({
          kind: "recon",
          key: r.key,
          ...p,
          text: `✈ ${r.label}`,
          active: r.active,
        });
    }
    setLabels(out);
  }

  useEffect(() => {
    src.current = { storms, recon, geo };
    relayout();
  }, [storms, recon, geo]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const vis = (id: string, on: boolean) =>
      m.getLayer(id) &&
      m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    vis("sst", t.sst);
    vis("areas-fill", t.odds);
    vis("areas-line", t.odds);
  }, [t]);

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
    m.addSource("sst", {
      type: "raster",
      tiles: [SST(sstDate())],
      tileSize: 256,
      maxzoom: 7,
    });
    m.addLayer({
      id: "sst",
      type: "raster",
      source: "sst",
      paint: { "raster-opacity": 0.72 },
    });
    // Labels follow the map: re-project on every move frame.
    let raf = 0;
    m.on("move", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(relayout);
    });
    const box = focus
      ? null
      : wide
        ? US_BOX
        : storms.length
          ? activeBox()
          : null;
    if (focus) m.jumpTo({ center: [focus.lon, focus.lat], zoom: 4.6 });
    else if (box) m.fitBounds(box, { padding: 20, duration: 0, maxZoom: 5 });
    relayout();
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

  const go = (id: string) => {
    setBasin(id);
    setHit(null);
    const m = map.current;
    if (!m) return;
    if (id === "focus" && focus)
      m.flyTo({ center: [focus.lon, focus.lat], zoom: 4.6, duration: 900 });
    else if (id === "us")
      m.fitBounds(US_BOX, { padding: 10, duration: 900, maxZoom: 5 });
    else if (id === "active") {
      const box = activeBox();
      if (box) m.fitBounds(box, { padding: 20, duration: 900, maxZoom: 5 });
    } else if (id === "world")
      m.flyTo({ center: [-100, 15], zoom: 1, duration: 900 });
    else {
      const b = BASINS.find((x) => x.id === id)!;
      m.flyTo({ center: b.center, zoom: b.zoom, duration: 900 });
    }
  };
  const views = [
    ...(focus ? [{ id: "focus", name: "This storm" }] : []),
    ...(wide ? [{ id: "us", name: "U.S. & oceans" }] : []),
    ...(storms.length ? [{ id: "active", name: "Active zone" }] : []),
    ...BASINS.map((b) => ({ id: b.id as string, name: b.name })),
    { id: "world", name: "Worldwide" },
  ];

  return (
    <div className="grid gap-2">
      <div className={s.views} role="group" aria-label="View">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={basin === v.id}
            onClick={() => go(v.id)}
          >
            {v.name}
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
        <div className={s.overlay} aria-hidden>
          {labels
            .filter((l) =>
              l.kind === "storm"
                ? t.labels
                : l.kind === "odds"
                  ? t.labels && t.odds
                  : t.recon,
            )
            .map((l) => (
              <span
                key={l.key}
                className={s[l.kind]}
                data-active={l.active || undefined}
                style={{
                  transform: `translate(${l.x}px, ${l.y}px)`,
                  ["--c" as string]: l.color,
                }}
              >
                {l.kind === "storm" && <i />}
                {l.kind === "storm" ? <b>{l.text}</b> : l.text}
              </span>
            ))}
        </div>
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
      <div className={s.toggles} role="group" aria-label="Layers">
        {(
          [
            ["sst", "Sea surface temp"],
            ["odds", "7-day formation odds"],
            ["recon", "Recon"],
            ["labels", "Labels"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={t[k]}
            onClick={() => setT({ ...t, [k]: !t[k] })}
          >
            <i />
            {l}
          </button>
        ))}
      </div>
      {t.sst && (
        <div className={s.sst}>
          <small>Sea surface temperature · {sstDate()}</small>
          <div>
            {SST_KEY.map((k) => (
              <i key={k.c} style={{ background: k.color }} />
            ))}
          </div>
          <p>
            {SST_KEY.map((k) => (
              <span key={k.c}>{k.c}</span>
            ))}
            <span>°C</span>
          </p>
          <small>Above 26°C sustains development.</small>
        </div>
      )}
    </div>
  );
}
