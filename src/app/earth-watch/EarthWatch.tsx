"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  Flame,
  Globe2,
  Moon,
  Pause,
  Play,
  Radar,
  RotateCw,
  Snowflake,
  Wind,
} from "lucide-react";
import {
  WeatherMap,
  type AnyMap,
  type ReadyMap,
} from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { EARTH_KINDS, EARTH_LEVELS } from "@/lib/earth/colors";
import type { Earth, EarthEvent, Kind } from "@/lib/earth/watch";
import s from "./Earth.module.css";

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const SATS = [
  "GOES-East_ABI_Band13_Clean_Infrared",
  "GOES-West_ABI_Band13_Clean_Infrared",
  "Himawari_AHI_Band13_Clean_Infrared",
];
const FRAMES = 4;
/**
 * Each satellite's frame times (ms, oldest first): the newest four NASA has published (the
 * server asks GIBS), or, if that answer is missing, a guess two hours back.
 */
function satFrames(d: Earth | null): Record<string, number[]> {
  const guess = Math.floor(Date.now() / 600_000) * 600_000 - 12 * 600_000;
  return Object.fromEntries(
    SATS.map((l) => {
      const got = (d?.sat?.[l] ?? []).map((t) => Date.parse(t));
      const newest = got.at(-1) ?? guess;
      return [
        l,
        got.length >= FRAMES
          ? got.slice(-FRAMES)
          : Array.from(
              { length: FRAMES },
              (_, i) =>
                got[i - (FRAMES - got.length)] ??
                newest - (FRAMES - 1 - i) * 600_000,
            ),
      ];
    }),
  );
}
const tileOf = (sat: string, t: number) =>
  `${GIBS}/${sat}/default/${new Date(t).toISOString().slice(0, 19)}Z/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
/** "12 min ago", "3 h ago", or the date for anything older than two days. */
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return when(iso);
};
const STEP = 10 * 60_000;
const SPEEDS = [1, 2, 4];
type Layer = "clouds" | "radar" | "dust" | "ice" | "night";
const LAYERS: { id: Layer; label: string; icon: React.ReactNode }[] = [
  { id: "clouds", label: "Clouds", icon: <Cloud aria-hidden /> },
  { id: "radar", label: "U.S. radar", icon: <Radar aria-hidden /> },
  { id: "dust", label: "Dust", icon: <Wind aria-hidden /> },
  { id: "ice", label: "Sea ice", icon: <Snowflake aria-hidden /> },
  { id: "night", label: "Night lights", icon: <Moon aria-hidden /> },
];
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

/**
 * The calls Earth Watch makes are shared by Mapbox and MapLibre, but their own types don't form
 * a callable union, so the globe is driven through one loose type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
type LooseMap = Record<string, (...args: any[]) => any>;

/**
 * A round marker for each kind, drawn on a canvas: a dark disc, a colored ring, a glyph. A
 * storm's glyph can be turned (it spins on the globe) and mirrored for the Southern
 * Hemisphere, where cyclones turn the other way.
 */
function icon(
  kind: Kind,
  color: string,
  rot = 0,
  mirror = false,
  c = document.createElement("canvas"),
) {
  const n = 64;
  c.width = c.height = n;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, n, n);
  g.fillStyle = "rgba(8,10,18,0.92)";
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.stroke();
  g.lineWidth = 3.2;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.translate(32, 32);
  g.rotate(rot);
  if (mirror) g.scale(-1, 1);
  g.translate(-32, -32);
  g.beginPath();
  switch (kind) {
    case "cyclone":
      for (const a of [0, Math.PI]) {
        g.moveTo(32 + 4 * Math.cos(a), 32 + 4 * Math.sin(a));
        for (let t = 0; t <= 1.6; t += 0.1)
          g.lineTo(
            32 + (4 + t * 9) * Math.cos(a + t * 2.4),
            32 + (4 + t * 9) * Math.sin(a + t * 2.4),
          );
      }
      break;
    case "fire":
      g.moveTo(32, 16);
      g.bezierCurveTo(44, 28, 44, 44, 32, 48);
      g.bezierCurveTo(20, 44, 20, 32, 28, 26);
      g.bezierCurveTo(28, 32, 32, 34, 32, 16);
      break;
    case "flood":
      for (const y of [26, 34, 42]) {
        g.moveTo(18, y);
        g.bezierCurveTo(23, y - 5, 27, y + 5, 32, y);
        g.bezierCurveTo(37, y - 5, 41, y + 5, 46, y);
      }
      break;
    case "volcano":
      g.moveTo(16, 46);
      g.lineTo(27, 26);
      g.lineTo(37, 26);
      g.lineTo(48, 46);
      g.moveTo(30, 22);
      g.lineTo(28, 15);
      g.moveTo(34, 22);
      g.lineTo(37, 14);
      break;
    case "dust":
      for (const [y, w] of [
        [24, 24],
        [32, 30],
        [40, 20],
      ] as const) {
        g.moveTo(32 - w / 2, y);
        g.lineTo(32 + w / 2, y);
      }
      break;
    case "ice":
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        g.moveTo(32 - 14 * Math.cos(a), 32 - 14 * Math.sin(a));
        g.lineTo(32 + 14 * Math.cos(a), 32 + 14 * Math.sin(a));
      }
      break;
    case "quake":
      g.moveTo(14, 32);
      g.lineTo(22, 32);
      g.lineTo(26, 20);
      g.lineTo(32, 44);
      g.lineTo(38, 24);
      g.lineTo(42, 32);
      g.lineTo(50, 32);
      break;
    case "drought":
      g.arc(32, 32, 7, 0, Math.PI * 2);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        g.moveTo(32 + 11 * Math.cos(a), 32 + 11 * Math.sin(a));
        g.lineTo(32 + 16 * Math.cos(a), 32 + 16 * Math.sin(a));
      }
      break;
  }
  g.strokeStyle = color;
  g.stroke();
  g.setTransform(1, 0, 0, 1, 0, 0);
  return g.getImageData(0, 0, n, n);
}

/** Recolors the base map our way: deep navy oceans, near-black land, gold borders, bright labels. */
function stylize(map: AnyMap) {
  // Both libraries share these calls; one loose type spares a union of their signatures.
  const m = map as unknown as {
    getStyle: () => { layers?: { id: string; type: string }[] } | undefined;
    setPaintProperty: (id: string, k: string, v: unknown) => void;
  };
  for (const l of m.getStyle()?.layers ?? []) {
    const id = l.id;
    try {
      if (l.type === "background")
        m.setPaintProperty(id, "background-color", "#05070d");
      else if (l.type === "fill" && /water|ocean|sea/.test(id))
        m.setPaintProperty(id, "fill-color", "#0b1730");
      else if (l.type === "fill" && /land|park|landuse|landcover/.test(id))
        m.setPaintProperty(id, "fill-color", "#0a0d16");
      else if (l.type === "line" && /admin|boundary|border/.test(id))
        m.setPaintProperty(id, "line-color", "rgba(217,183,111,0.38)");
      else if (l.type === "symbol") {
        m.setPaintProperty(id, "text-color", "#e6e9f2");
        m.setPaintProperty(id, "text-halo-color", "rgba(5,7,13,0.85)");
      }
    } catch {
      /* a layer without that property */
    }
  }
}

export function EarthWatch({
  initial,
  colors,
}: {
  initial: Earth | null;
  colors: Colors | undefined;
}) {
  const [data, setData] = useState<Earth | null>(initial);
  const [ready, setReady] = useState<ReadyMap | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<Kind>>(() => new Set());
  const [layers, setLayers] = useState<Set<Layer>>(
    () => new Set(["clouds", "radar"]),
  );
  const [frame, setFrame] = useState(FRAMES - 1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);
  const lowRef = useRef(false);
  const [low, setLow] = useState(false);
  /** Opens an event's card (and stops the spin so the globe holds still on it). */
  const box = useRef<HTMLDivElement>(null);
  const choose = (id: string | null) => {
    setSelected(id);
    if (!id) return;
    setSpin(false);
    // From the list or the banner, bring the globe into view to watch the flight.
    const r = box.current?.getBoundingClientRect();
    if (r && (r.bottom < 80 || r.top > innerHeight * 0.4))
      box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const kindColor = useCallback(
    (k: string) =>
      pick(
        colors,
        `earth:kind:${k}`,
        EARTH_KINDS.find((x) => x.id === k)?.color ?? "#d9b76f",
      ),
    [colors],
  );
  const levelColor = useCallback(
    (l: number) =>
      pick(colors, `earth:level:${l}`, EARTH_LEVELS[l - 1]?.color ?? "#d9b76f"),
    [colors],
  );

  // Satellite frames: the newest NASA has for each satellite. Radar: the last 30 minutes.
  const [sat, setSat] = useState(() => satFrames(initial));
  const satRef = useRef(sat);
  const [radarAt] = useState(() => {
    const latest = Math.floor(Date.now() / 300_000) * 300_000;
    return Array.from(
      { length: FRAMES },
      (_, i) => latest - (FRAMES - 1 - i) * STEP,
    );
  });

  // Fresh data every 5 minutes while the page is on screen, and right away when it comes
  // back into view; nothing is fetched while it sits in a background tab.
  useEffect(() => {
    let last = Date.now();
    const pull = () => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - last < 4.5 * 60_000
      )
        return;
      last = Date.now();
      fetch("/api/earth-watch")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Earth | null) => {
          if (!d?.events) return;
          setData(d);
          const next = satFrames(d);
          if (JSON.stringify(next) !== JSON.stringify(satRef.current))
            setSat(next);
        })
        .catch(() => {});
    };
    const t = setInterval(pull, 60_000);
    document.addEventListener("visibilitychange", pull);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", pull);
    };
  }, []);

  const events = useMemo(
    () => (data?.events ?? []).filter((e) => !hidden.has(e.kind)),
    [data, hidden],
  );
  const sel = data?.events.find((e) => e.id === selected) ?? null;
  const biggest = data?.events.find((e) => e.id === data.biggest) ?? null;

  const onReady = useCallback(
    (r: ReadyMap) => {
      const m = r.map as unknown as LooseMap;
      lowRef.current = document.documentElement.dataset.tier === "low";
      setLow(lowRef.current);
      // The globe (switched on here so the shared map component stays as small as it was).
      if (r.provider === "mapbox") m.setProjection({ name: "globe" });
      else m.setProjection({ type: "globe" });
      stylize(r.map);
      // Space around the globe: a soft atmosphere and stars (Mapbox) or sky (MapLibre).
      try {
        if (r.provider === "mapbox")
          (m as unknown as { setFog: (f: object) => void }).setFog({
            color: "rgb(14,20,38)",
            "high-color": "rgb(32,44,92)",
            "horizon-blend": 0.05,
            "space-color": "rgb(3,4,10)",
            "star-intensity": lowRef.current ? 0 : 0.4,
          });
        else
          (m as unknown as { setSky: (f: object) => void }).setSky({
            "sky-color": "#0e1426",
            "horizon-color": "#20305c",
            "atmosphere-blend": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              1,
              5,
              1,
              7,
              0,
            ],
          });
      } catch {}
      const add = (
        id: string,
        tiles: string,
        maxzoom: number,
        opacity = 0.75,
        minzoom = 0,
      ) => {
        m.addSource(id, {
          type: "raster",
          tiles: [tiles],
          tileSize: 256,
          maxzoom,
        } as never);
        m.addLayer({
          id,
          type: "raster",
          source: id,
          minzoom,
          layout: { visibility: "none" },
          paint: { "raster-opacity": opacity, "raster-fade-duration": 0 },
        } as never);
      };
      add(
        "night",
        `${GIBS}/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
        8,
        0.9,
      );
      add(
        "ice",
        `${GIBS}/GHRSST_L4_MUR_Sea_Ice_Concentration/default/${ymd(Date.now() - 2 * 86400_000)}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
        7,
        0.7,
      );
      add(
        "dust",
        `${GIBS}/AIRS_L2_Dust_Score_Day/default/${ymd(Date.now() - 86400_000)}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        6,
        0.8,
      );
      const frames = lowRef.current
        ? [FRAMES - 1]
        : Array.from({ length: FRAMES }, (_, i) => i);
      for (const i of frames)
        for (const l of SATS)
          add(`ir-${l}-${i}`, tileOf(l, satRef.current[l][i]), 6, 0.55);
      for (const i of frames) {
        const back = (FRAMES - 1 - i) * 10;
        add(
          `radar-${i}`,
          `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913${back ? `-m${String(back).padStart(2, "0")}m` : ""}/{z}/{x}/{y}.png`,
          10,
          0.85,
          2.5,
        );
      }
      // Events: glow, pulse (serious and up), the marker and a ring around the selected one.
      m.addSource("tracks", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "tracks",
        type: "line",
        source: "tracks",
        paint: {
          "line-color": ["get", "c"],
          "line-width": 2,
          "line-opacity": 0.75,
          "line-dasharray": [2, 1.5],
        },
      } as never);
      // A storm's official forecast track: a solid line with a dot at each forecast time.
      m.addSource("fcst", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "fcst",
        type: "line",
        source: "fcst",
        filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "c"],
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.6, 5, 3],
          "line-opacity": 0.95,
        },
      } as never);
      m.addLayer({
        id: "fcst-pts",
        type: "circle",
        source: "fcst",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": ["get", "c"],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            1.8,
            5,
            3.6,
          ],
          "circle-pitch-alignment": "map",
        },
      } as never);
      m.addSource("ev", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "ev-glow",
        type: "circle",
        source: "ev",
        paint: {
          "circle-color": ["get", "c"],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            ["*", 4, ["get", "level"]],
            5,
            ["*", 9, ["get", "level"]],
          ],
          "circle-blur": 1,
          "circle-opacity": 0.45,
          "circle-pitch-alignment": "map",
        },
      } as never);
      m.addLayer({
        id: "ev-pulse",
        type: "circle",
        source: "ev",
        filter: [
          "any",
          [">=", ["get", "level"], 3],
          ["==", ["get", "kind"], "cyclone"],
        ],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": ["get", "lc"],
          "circle-stroke-width": 1.6,
          "circle-radius": 10,
          "circle-stroke-opacity": 0.8,
        },
      } as never);
      for (const k of EARTH_KINDS)
        m.addImage(`ew-${k.id}`, icon(k.id, kindColor(k.id)), {
          pixelRatio: 2,
        });
      m.addImage(
        "ew-cyclone-s",
        icon("cyclone", kindColor("cyclone"), 0, true),
        { pixelRatio: 2 },
      );
      // Storms get their own, larger marker (it spins); everything else shares one layer.
      for (const [id, tc] of [
        ["ev-icon", false],
        ["ev-tc", true],
      ] as const)
        m.addLayer({
          id,
          type: "symbol",
          source: "ev",
          filter: [tc ? "==" : "!=", ["get", "kind"], "cyclone"],
          layout: {
            "icon-image": ["concat", "ew-", ["get", "img"]],
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              tc ? 0.8 : 0.55,
              4,
              tc ? 1.15 : 0.8,
              8,
              tc ? 1.35 : 1,
            ],
            "icon-allow-overlap": true,
            "symbol-sort-key": ["-", 10, ["get", "level"]],
          },
        } as never);
      m.addLayer({
        id: "ev-sel",
        type: "circle",
        source: "ev",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": "#d9b76f",
          "circle-stroke-width": 2.5,
          "circle-radius": 22,
        },
      } as never);
      for (const layer of ["ev-icon", "ev-tc"]) {
        m.on(
          "click",
          layer,
          (e: { features?: { properties?: { id?: string } }[] }) => {
            const id = e.features?.[0]?.properties?.id;
            if (id) {
              setSelected(id);
              setSpin(false);
            }
          },
        );
        m.on(
          "mouseenter",
          layer,
          () => (m.getCanvas().style.cursor = "pointer"),
        );
        m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
      }
      setReady(r);
    },
    [kindColor],
  );

  // Newer satellite frames from a refresh: point the existing cloud layers at them.
  useEffect(() => {
    const m = ready?.map as unknown as LooseMap | undefined;
    if (!m || satRef.current === sat) return;
    for (const l of SATS)
      for (let i = 0; i < FRAMES; i++)
        (
          m.getSource(`ir-${l}-${i}`) as unknown as
            { setTiles?: (t: string[]) => void } | undefined
        )?.setTiles?.([tileOf(l, sat[l][i])]);
    satRef.current = sat;
  }, [ready, sat]);

  // Event data onto the globe.
  useEffect(() => {
    const m = ready?.map as unknown as LooseMap | undefined;
    if (!m) return;
    const src = (id: string) =>
      m.getSource(id) as unknown as
        { setData: (d: object) => void } | undefined;
    src("ev")?.setData({
      type: "FeatureCollection",
      features: events.map((e) => ({
        type: "Feature",
        properties: {
          id: e.id,
          kind: e.kind,
          img: e.kind === "cyclone" && e.lat < 0 ? "cyclone-s" : e.kind,
          level: e.level,
          c: kindColor(e.kind),
          lc: levelColor(e.level),
        },
        geometry: { type: "Point", coordinates: [e.lon, e.lat] },
      })),
    });
    src("tracks")?.setData({
      type: "FeatureCollection",
      features: events
        .filter((e) => e.track)
        .map((e) => ({
          type: "Feature",
          properties: { c: kindColor(e.kind) },
          geometry: { type: "LineString", coordinates: e.track },
        })),
    });
    src("fcst")?.setData({
      type: "FeatureCollection",
      features: events.flatMap((e) =>
        e.forecast
          ? [
              {
                type: "Feature",
                properties: { c: kindColor(e.kind) },
                geometry: { type: "LineString", coordinates: e.forecast },
              },
              ...e.forecast.slice(1).map((p) => ({
                type: "Feature",
                properties: { c: kindColor(e.kind) },
                geometry: { type: "Point", coordinates: p },
              })),
            ]
          : [],
      ),
    });
  }, [ready, events, kindColor, levelColor]);

  // The selected event's ring, and a flight to it.
  useEffect(() => {
    const m = ready?.map as unknown as LooseMap | undefined;
    if (!m) return;
    m.setFilter("ev-sel", ["==", ["get", "id"], selected ?? ""] as never);
    if (sel) {
      m.flyTo({
        center: [
          sel.lon,
          sel.kind === "ice" ? Math.sign(sel.lat) * 68 : sel.lat,
        ],
        zoom: sel.kind === "ice" ? 1.7 : Math.max(m.getZoom(), 3.4),
        duration: 1800,
        essential: true,
      } as never);
    }
  }, [ready, selected]); // eslint-disable-line react-hooks/exhaustive-deps -- sel follows selected

  // Overlay switches and the frame on show.
  useEffect(() => {
    const m = ready?.map as unknown as LooseMap | undefined;
    if (!m) return;
    const vis = (id: string, on: boolean) =>
      m.getLayer(id) &&
      m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    for (const l of ["night", "ice", "dust"] as const) vis(l, layers.has(l));
    const shown = lowRef.current ? FRAMES - 1 : frame;
    radarAt.forEach((_, i) => {
      for (const sat of SATS)
        vis(`ir-${sat}-${i}`, layers.has("clouds") && i === shown);
      vis(`radar-${i}`, layers.has("radar") && i === shown);
    });
  }, [ready, layers, frame, radarAt]);

  // The timeline: frames advance while playing (all frames are already loaded, so no flicker).
  useEffect(() => {
    if (!playing || lowRef.current) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % FRAMES), 900 / speed);
    return () => clearInterval(t);
  }, [playing, speed]);

  // Pulse rings on serious events (WebGL paint only), and a slow spin until someone touches it.
  useEffect(() => {
    const m = ready?.map as unknown as LooseMap | undefined;
    if (
      !m ||
      lowRef.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let raf = 0;
    let last = 0;
    // Storm markers turn the way their storms do: counterclockwise north of the equator,
    // clockwise south of it. Only the small marker image is redrawn, never the map's layers.
    const north = document.createElement("canvas");
    const south = document.createElement("canvas");
    const color = kindColor("cyclone");
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 50) return;
      last = now;
      const p = (now % 1800) / 1800;
      m.setPaintProperty("ev-pulse", "circle-radius", 10 + p * 22);
      m.setPaintProperty("ev-pulse", "circle-stroke-opacity", 0.85 * (1 - p));
      const a = (now / 1000) * 1.4;
      m.updateImage?.("ew-cyclone", icon("cyclone", color, -a, false, north));
      m.updateImage?.("ew-cyclone-s", icon("cyclone", color, a, true, south));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, kindColor]);

  useEffect(() => {
    const m = ready?.map as unknown as LooseMap | undefined;
    if (
      !m ||
      !spin ||
      lowRef.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let stop = false;
    const step = () => {
      if (stop || m.getZoom() > 3.2) return;
      const c = m.getCenter();
      m.easeTo({
        center: [c.lng - 6, c.lat],
        duration: 1000,
        easing: (n: number) => n,
      } as never);
    };
    const halt = () => setSpin(false);
    m.on("moveend", step);
    m.on("mousedown", halt);
    m.on("touchstart", halt);
    step();
    return () => {
      stop = true;
      m.off("moveend", step);
      m.off("mousedown", halt);
      m.off("touchstart", halt);
    };
  }, [ready, spin]);

  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };
  // The slider's clock: the cloud frame on show (the newest across satellites), or the
  // radar's when clouds are off, so the time always says how fresh the picture is.
  const shownFrame = low ? FRAMES - 1 : frame;
  const clouds = layers.has("clouds");
  const t = new Date(
    clouds
      ? Math.max(...SATS.map((l) => sat[l][shownFrame]))
      : radarAt[shownFrame],
  );

  return (
    <main className={s.page}>
      <header className={s.head}>
        <p className={s.eyebrow}>
          <Globe2 aria-hidden /> Live · the whole planet
        </p>
        <h1 data-decode>Earth Watch</h1>
      </header>

      {biggest && (
        <button
          type="button"
          className={s.banner}
          onClick={() => choose(biggest.id)}
          style={{ ["--lc" as string]: levelColor(biggest.level) }}
        >
          <span className={s.bannerTag}>Biggest event today</span>
          <b>{biggest.title}</b>
          <small>
            {EARTH_LEVELS[biggest.level - 1]?.label}
            {biggest.place ? ` · ${biggest.place}` : ""}
          </small>
        </button>
      )}

      <div className={s.globeBox} ref={box}>
        <WeatherMap
          center={
            biggest
              ? [biggest.lon, Math.max(-40, Math.min(40, biggest.lat))]
              : [-40, 20]
          }
          zoom={1.35}
          actions={false}
          label="Earth Watch globe"
          className={s.globe}
          onReady={onReady}
          file="sswx-earth-watch"
        />
        <div className={s.tools} role="group" aria-label="Layers">
          {LAYERS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={layers.has(l.id)}
              aria-label={l.label}
              title={l.label}
              onClick={() => setLayers((x) => toggle(x, l.id))}
            >
              {l.icon}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={spin}
            aria-label="Spin the globe"
            title="Spin"
            onClick={() => setSpin((x) => !x)}
          >
            <RotateCw aria-hidden />
          </button>
        </div>
        {(layers.has("clouds") || layers.has("radar")) && (
          <div className={s.timeline}>
            <input
              type="range"
              min={0}
              max={FRAMES - 1}
              value={low ? FRAMES - 1 : frame}
              onChange={(e) => {
                setPlaying(false);
                setFrame(Number(e.target.value));
              }}
              aria-label="Satellite and radar time"
            />
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            </button>
            <button
              type="button"
              className={s.speed}
              onClick={() =>
                setSpeed((x) => SPEEDS[(SPEEDS.indexOf(x) + 1) % SPEEDS.length])
              }
            >
              {speed}×
            </button>
            <small suppressHydrationWarning>
              {clouds ? "Clouds " : "Radar "}
              {t.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </small>
          </div>
        )}
      </div>

      <div className={s.chips} role="group" aria-label="Show">
        {EARTH_KINDS.filter((k) => (data?.counts[k.id] ?? 0) > 0).map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={!hidden.has(k.id)}
            onClick={() => setHidden((h) => toggle(h, k.id))}
            style={{ ["--kc" as string]: kindColor(k.id) }}
          >
            <i />
            {k.label} <b>{data?.counts[k.id]}</b>
          </button>
        ))}
      </div>

      {sel && (
        <EventCard
          e={sel}
          kc={kindColor(sel.kind)}
          lc={levelColor(sel.level)}
          onClose={() => choose(null)}
        />
      )}

      {!data && (
        <p className={s.note}>
          The global feeds aren&apos;t answering right now. Trying again in a
          few minutes.
        </p>
      )}

      <ol className={s.list}>
        {events.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => choose(e.id)}
              style={{
                ["--kc" as string]: kindColor(e.kind),
                ["--lc" as string]: levelColor(e.level),
              }}
            >
              <span className={s.kindDot} />
              <span className={s.where}>
                <b>{e.title}</b>
                <small suppressHydrationWarning>
                  {[e.place, when(e.updated)].filter(Boolean).join(" · ")}
                </small>
              </span>
              <span className={s.level}>
                {EARTH_LEVELS[e.level - 1]?.label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <p className={s.note} suppressHydrationWarning>
        From GDACS (the UN and European Commission&apos;s disaster alert
        system), NASA EONET, USGS and NSIDC, refreshed every 15 minutes; clouds
        from NASA GIBS geostationary satellites, U.S. radar from NOAA via Iowa
        State. Global data is less detailed than our U.S. pages; levels are our
        own reading of each source&apos;s alert and size.
        {data ? ` Updated ${when(data.at)}.` : ""}
      </p>
    </main>
  );
}

function EventCard({
  e,
  kc,
  lc,
  onClose,
}: {
  e: EarthEvent;
  kc: string;
  lc: string;
  onClose: () => void;
}) {
  const kind = EARTH_KINDS.find((k) => k.id === e.kind);
  return (
    <section
      className={s.card}
      style={{ ["--kc" as string]: kc, ["--lc" as string]: lc }}
      aria-live="polite"
    >
      <header>
        <span className={s.cardKind}>
          {e.kind === "fire" ? <Flame aria-hidden /> : <Globe2 aria-hidden />}{" "}
          {kind?.label}
        </span>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <h2>{e.title}</h2>
      {e.place && <p className={s.place}>{e.place}</p>}
      <div
        className={s.meter}
        aria-label={`Level ${e.level} of 5, ${EARTH_LEVELS[e.level - 1]?.label}`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} data-on={n <= e.level || undefined} />
        ))}
        <b>{EARTH_LEVELS[e.level - 1]?.label}</b>
      </div>
      <p>{e.story}</p>
      {!!e.stats.length && (
        <dl className={s.stats}>
          {e.stats.map((x) => (
            <div key={x.label}>
              <dt>{x.label}</dt>
              <dd>{x.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className={s.src} suppressHydrationWarning>
        {e.updated ? `Updated ${ago(e.updated)} · ` : ""}
        <a href={e.source.url} target="_blank" rel="noopener noreferrer">
          {e.source.name}
        </a>
      </p>
    </section>
  );
}
