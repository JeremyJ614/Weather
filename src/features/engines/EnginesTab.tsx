"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  ImageSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CloudHail,
  Flame,
  FlaskConical,
  Radar,
  RotateCw,
  Snowflake,
  Tornado,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import {
  BLIND_BANDS,
  FIELD_BANDS,
  HAIL_BANDS,
  PYRO_BINS,
  ROT_BANDS,
  TOR_BINS,
  pyroBin,
  rotBin,
  torBin,
  type FieldId,
} from "@/lib/engines/colors";
import type { EngineStorm } from "@/lib/engines/probsevere";
import radars from "@/lib/engines/radars.json";
import s from "./Engines.module.css";

type Engine = "tor" | "hail" | "blind" | "rot" | FieldId;
const FIELDS: FieldId[] = ["llj", "nst", "snsq", "pyro", "tctor"];
const isField = (e: Engine): e is FieldId => FIELDS.includes(e as FieldId);
type Spot = {
  lat: number;
  lon: number;
  value: number;
  place: string;
  water?: boolean;
};
type Fire = {
  name: string;
  state: string;
  acres: number;
  contained: number | null;
  lat: number;
  lon: number;
  hdwi: number;
  lapse: number;
  chance: number;
  blowup: string;
};
type FieldData = {
  cycle: string;
  fh: number;
  valid: string;
  bounds: number[];
  image: string;
  spots: Spot[];
  fires?: Fire[];
  storms?: { name: string; lat: number; lon: number; mph: number }[];
  note: string | null;
};
const WINDOWS = [
  { w: 60, label: "1 h", long: "last hour" },
  { w: 120, label: "2 h", long: "last 2 hours" },
  { w: 240, label: "4 h", long: "last 4 hours" },
  { w: 360, label: "6 h", long: "last 6 hours" },
  { w: 1440, label: "24 h", long: "last 24 hours" },
] as const;
type RotData = {
  at: string;
  cells: { lat: number; lon: number; v: number }[];
  tracks: {
    place: string;
    lat: number;
    lon: number;
    peak: number;
    km: number;
  }[];
};
type Data = {
  at: string;
  total: number;
  storms: EngineStorm[];
  tor: GeoJSON.FeatureCollection;
  hail: GeoJSON.FeatureCollection;
};
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const ENGINES: {
  id: Engine;
  name: string;
  sub: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "tor",
    name: "ProbTor",
    sub: "Tornado chance, next hour",
    icon: <Tornado aria-hidden />,
  },
  {
    id: "hail",
    name: "ProbHail",
    sub: "Hail swaths, next 30 min",
    icon: <CloudHail aria-hidden />,
  },
  {
    id: "rot",
    name: "Rotation Tracks",
    sub: "Storms that kept rotating",
    icon: <RotateCw aria-hidden />,
  },
  {
    id: "llj",
    name: "Nocturnal LLJ",
    sub: "Low-level jet ramp-up tonight",
    icon: <Wind aria-hidden />,
  },
  {
    id: "nst",
    name: "Landspouts & Waterspouts",
    sub: "Non-supercell tornadoes",
    icon: <Waves aria-hidden />,
  },
  {
    id: "snsq",
    name: "Snow Squalls",
    sub: "Whiteout squalls, next hours",
    icon: <Snowflake aria-hidden />,
  },
  {
    id: "pyro",
    name: "Wildfire & PyroCb",
    sub: "Blowups and fire storms",
    icon: <Flame aria-hidden />,
  },
  {
    id: "tctor",
    name: "Hurricane Tornadoes",
    sub: "Landfalling storm risk",
    icon: <Tornado aria-hidden />,
  },
  {
    id: "blind",
    name: "Radar Blind Spot",
    sub: "How low the radar sees",
    icon: <Radar aria-hidden />,
  },
];

const HOW: Record<Engine, { lead: string; body: string[] }> = {
  tor: {
    lead: "Good for the next 20 minutes, weak beyond 30.",
    body: [
      "Every storm comes from NOAA and the University of Wisconsin's ProbSevere v3, which blends radar, satellite, lightning and the HRRR model into a tornado chance for each storm, updated every two minutes.",
      "ProbTor carries that chance 20 minutes forward and nudges it by what the storm is doing right now: whether its low-level rotation (radar azimuthal shear) has grown or weakened over the last 10 minutes, and whether its lightning has suddenly jumped, which often comes 10 to 20 minutes before severe weather.",
      "Each storm is projected along its own motion as cones for 0–20, 20–40 and 40–60 minutes. The cones widen with time for track error, and the later chances only fade: past half an hour nobody can say much more.",
      "This is an experimental guide, never a warning. Act on National Weather Service warnings.",
    ],
  },
  hail: {
    lead: "Good for the next 30 minutes.",
    body: [
      "Each storm's hail core is swept along its motion for 30 minutes. Its size comes from MESH, the radar's estimate of the largest hailstones, and the chance of severe hail from ProbSevere.",
      'Bands are 1" (quarter), 1.75" (golf ball) and 2.5" (tennis ball) and up. They show where hail of that size is possible, never that it will hit a given spot. MESH runs high in some storms.',
    ],
  },
  blind: {
    lead: "Precise: it is geometry.",
    body: [
      "Radar beams travel in a straight line while the Earth curves away underneath, so the farther a spot is from a radar, the higher the lowest beam passes over it.",
      "This shows the center of the lowest (0.5°) beam from the nearest of the 159 NWS radars, using the standard 4/3-Earth model, measured above the radar. Terrain is not included, so in the West mountains block more than this shows.",
      "Where the beam is thousands of feet up, a tornado's rotation near the ground can hide under it. Tap anywhere to see the beam height there.",
    ],
  },
  rot: {
    lead: "Observed, not a forecast: up to the last 24 hours.",
    body: [
      "NOAA's MRMS system merges every radar's low-level rotation (0–2 km azimuthal shear) and keeps the strongest value each spot saw over the window you pick: 1, 2, 4, 6 or 24 hours. Drawn as glowing trails, a long, bright track is a storm that kept rotating.",
      "The list ranks tracks by length and strength. Strong straight-line wind shear, ground clutter and wind farms can leave short marks too, so short or stationary blobs are left out. Over 1 and 2 hours a track must also sit with a storm NOAA's ProbSevere is following; over longer windows, where those storms may have died, it must have travelled at least 15 km. Always check the radar and National Weather Service warnings.",
    ],
  },
  llj: {
    lead: "Good for tonight's pattern; placement within about 100 miles.",
    body: [
      "After sunset the ground cools, friction drops away and the wind a few thousand feet up speeds into a nocturnal low-level jet, which feeds overnight storms and can turn them severe after dark.",
      "From the latest HRRR run, this compares the 850 and 925 mb wind at about 1 a.m. Central with six hours earlier, then weighs in 0–1 km storm-relative helicity and most-unstable CAPE. 0–100: the higher, the stronger and faster the ramp-up where storms could use it.",
      "Mountains are left blank where those pressure levels are underground, and the open ocean is skipped.",
    ],
  },
  nst: {
    lead: "Fair: these tornadoes are hard to forecast.",
    body: [
      "Landspouts and waterspouts don't come from rotating supercells. They form when a growing storm stretches spin that already sits along a wind boundary at the ground.",
      "This is the Storm Prediction Center's Non-Supercell Tornado parameter from the HRRR for the next hour: steep low-level lapse rates, CAPE in the lowest 3 km, little inhibition, weak deep-layer shear and spin in the 10 m wind. 1 and up is favorable.",
      "Over water it is a waterspout index, counted only within about 40 miles of land. A storm still has to form on the boundary for anything to happen.",
    ],
  },
  snsq: {
    lead: "Good for the next few hours.",
    body: [
      "A snow squall is a short, intense burst of snow with strong wind that drops visibility to near zero in seconds, the cause of many highway pileups.",
      "This is the Storm Prediction Center's Snow Squall Parameter from the HRRR for the next hour, built from the surface, 850 and 700 mb levels: moist air in the lowest 2 km, an unstable low-level lapse rate, and strong mean wind, only where the 2 m wet-bulb temperature is at or below 1 °C so the snow reaches the ground. 1 and up means squalls are possible.",
    ],
  },
  pyro: {
    lead: "Fair, and experimental.",
    body: [
      "The map is the Hot-Dry-Windy Index at the afternoon peak (about 4 p.m. Central) from the HRRR: how dry the air is (vapor pressure deficit) times the 80 m wind. Around 100 and up, fires can blow up.",
      "Each large active fire (100 acres and up, from the national incident feed) gets a pyrocumulonimbus chance: the HDWI there, a steep 700–500 mb lapse rate, enough mid-level moisture for the smoke plume to build into its own thunderstorm, the fire's size, and how much of it is still uncontained.",
    ],
  },
  tctor: {
    lead: "Good for the broad zone; band tornadoes are brief.",
    body: [
      "Landfalling tropical storms and hurricanes spawn quick tornadoes in their outer rain bands, mostly on the right side of the track and 50 to 400 miles from the center.",
      "This multiplies 0–1 km storm-relative helicity by 0–3 km CAPE from the HRRR a few hours ahead, only in that right-side zone around each active storm near the U.S. When no storm is close, the map stays empty.",
    ],
  },
};

/** Height (ft) of the lowest radar beam over a point, and which radar, or null if none reaches. */
function beamAt(lat: number, lon: number) {
  const Re = (4 / 3) * 6371;
  const sinT = Math.sin((0.5 * Math.PI) / 180);
  let best: { ft: number; id: string; mi: number } | null = null;
  for (const r of radars.radars) {
    const dlat = ((r.lat - lat) * Math.PI) / 180;
    const dlon = ((r.lon - lon) * Math.PI) / 180;
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((r.lat * Math.PI) / 180) *
        Math.sin(dlon / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(a));
    if (km > radars.maxKm) continue;
    const ft =
      (Math.sqrt(km * km + Re * Re + 2 * km * Re * sinT) - Re) * 3280.84;
    if (!best || ft < best.ft) best = { ft, id: r.id, mi: km * 0.621 };
  }
  return best;
}

/** Decodes the blind-spot grid and paints it in the (editable) band colors. */
async function blindImage(colors: Colors) {
  const buf = new Uint8Array(
    await (await fetch("/extras/blindspot.bin")).arrayBuffer(),
  );
  const { width, height } = radars;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  const rgb = BLIND_BANDS.map((b, i) => {
    const hex = pick(colors, `engine:blind:${i}`, b.color).replace("#", "");
    const n = parseInt(hex.length === 3 ? hex.replace(/./g, "$&$&") : hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, i === 0 ? 90 : 150];
  });
  for (let i = 0, k = 0; i < buf.length; i += 2) {
    const col = rgb[buf[i]] ?? rgb[0];
    for (let n = 0; n < buf[i + 1]; n++, k++) img.data.set(col, k * 4);
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

export function EnginesTab({ colors }: { colors: Colors }) {
  const [engine, setEngine] = useState<Engine>("tor");
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [beam, setBeam] = useState<ReturnType<typeof beamAt> | "none" | null>(
    null,
  );
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [fields, setFields] = useState<
    Partial<Record<FieldId, FieldData | "error">>
  >({});
  const [rot, setRot] = useState<RotData | "error" | null>(null);
  const [win, setWin] = useState<(typeof WINDOWS)[number]["w"]>(1440);
  const engineRef = useRef(engine);
  useEffect(() => {
    engineRef.current = engine;
  });

  const torColor = (i: number) =>
    pick(colors, `engine:tor:${i}`, TOR_BINS[i].color);
  const hailColor = (i: number) =>
    pick(colors, `engine:hail:${i}`, HAIL_BANDS[i].color);
  const blindColor = (i: number) =>
    pick(colors, `engine:blind:${i}`, BLIND_BANDS[i].color);
  const fieldColor = (id: FieldId, i: number) =>
    pick(colors, `engine:${id}:${i}`, FIELD_BANDS[id].colors[i]);
  const rotColor = (i: number) =>
    pick(colors, `engine:rot:${i}`, ROT_BANDS[i].color);
  const pyroColor = (i: number) =>
    pick(colors, `engine:pyrocb:${i}`, PYRO_BINS[i].color);

  // A model engine's map is read once per visit (the server keeps it 30 minutes).
  const want = isField(engine) && !fields[engine] ? engine : null;
  useEffect(() => {
    if (!want) return;
    let live = true;
    fetch(`/api/engines/field?e=${want}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: FieldData) => live && setFields((f) => ({ ...f, [want]: d })))
      .catch(() => live && setFields((f) => ({ ...f, [want]: "error" })));
    return () => {
      live = false;
    };
  }, [want]);

  // Rotation tracks every four minutes while that engine is open and the page is visible.
  useEffect(() => {
    if (engine !== "rot") return;
    let live = true;
    const load = () =>
      document.visibilityState === "visible" &&
      fetch(`/api/engines/rotation?w=${win}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: RotData) => live && setRot(d))
        .catch(() => live && setRot((x) => x ?? "error"));
    load();
    const t = setInterval(load, 240_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine, win]);

  // ProbSevere every two minutes while a storm engine is open and the page is visible.
  useEffect(() => {
    if (engine !== "tor" && engine !== "hail") return;
    let live = true;
    const load = () =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/probsevere")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: Data) => {
          if (!live) return;
          setData(d);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    load();
    const t = setInterval(load, 120_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine]);

  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    m.addSource("tor", { type: "geojson", data: EMPTY });
    m.addSource("hail", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "tor-fill",
      type: "fill",
      source: "tor",
      paint: {
        "fill-color": [
          "step",
          ["get", "p"],
          torColor(0),
          10,
          torColor(1),
          30,
          torColor(2),
          60,
          torColor(3),
        ],
        "fill-opacity": ["match", ["get", "step"], 0, 0.5, 1, 0.3, 0.16],
      },
    });
    m.addLayer({
      id: "tor-line",
      type: "line",
      source: "tor",
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.35,
        "line-width": 0.8,
      },
    });
    m.addLayer({
      id: "hail-fill",
      type: "fill",
      source: "hail",
      paint: {
        "fill-color": [
          "match",
          ["get", "band"],
          1,
          hailColor(1),
          2,
          hailColor(2),
          3,
          hailColor(3),
          hailColor(0),
        ],
        "fill-opacity": 0.5,
      },
    });
    m.addLayer({
      id: "hail-line",
      type: "line",
      source: "hail",
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.4,
        "line-width": 0.8,
      },
    });
    m.addSource("rot", { type: "geojson", data: EMPTY });
    const rotStep = (): unknown[] =>
      ROT_BANDS.flatMap((b, i) => (i ? [b.min, rotColor(i)] : [rotColor(0)]));
    m.addLayer({
      id: "rot-glow",
      type: "circle",
      source: "rot",
      paint: {
        "circle-color": ["step", ["get", "v"], ...rotStep()] as never,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 9, 9],
        "circle-blur": 1,
        "circle-opacity": 0.55,
      },
    });
    m.addLayer({
      id: "rot-core",
      type: "circle",
      source: "rot",
      paint: {
        "circle-color": ["step", ["get", "v"], ...rotStep()] as never,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1, 9, 3],
      },
    });
    m.addSource("fires", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "fires",
      type: "circle",
      source: "fires",
      paint: {
        "circle-color": [
          "step",
          ["get", "chance"],
          pyroColor(0),
          PYRO_BINS[1].min,
          pyroColor(1),
          PYRO_BINS[2].min,
          pyroColor(2),
          PYRO_BINS[3].min,
          pyroColor(3),
        ],
        "circle-radius": 6,
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 1.2,
      },
    });
    m.addSource("radars", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: radars.radars.map((r) => ({
          type: "Feature",
          properties: { id: r.id },
          geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        })),
      },
    });
    m.addLayer({
      id: "radars",
      type: "circle",
      source: "radars",
      paint: {
        "circle-radius": 3,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 1,
      },
    });
    blindImage(colors).then((url) => {
      const [W, S, E, N] = radars.bounds;
      m.addSource("blind", {
        type: "image",
        url,
        coordinates: [
          [W, N],
          [E, N],
          [E, S],
          [W, S],
        ],
      });
      m.addLayer({ id: "blind", type: "raster", source: "blind" }, "radars");
      show(m, engineRef.current);
    });
    m.on("click", (e: MapMouseEvent) => {
      if (engineRef.current === "blind") {
        setBeam(beamAt(e.lngLat.lat, e.lngLat.lng) ?? "none");
        return;
      }
    });
    show(m, engineRef.current);
    setMap(m);
  };

  const show = (m: MaplibreMap, e: Engine) => {
    const vis = (id: string, on: boolean) =>
      m.getLayer(id) &&
      m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    vis("tor-fill", e === "tor");
    vis("tor-line", e === "tor");
    vis("hail-fill", e === "hail");
    vis("hail-line", e === "hail");
    vis("blind", e === "blind");
    vis("radars", e === "blind");
    vis("rot-glow", e === "rot");
    vis("rot-core", e === "rot");
    vis("fires", e === "pyro");
    vis("field", isField(e));
  };

  useEffect(() => {
    if (!map) return;
    const f = isField(engine) ? fields[engine] : undefined;
    if (f && f !== "error") {
      const [W, S, E, N] = f.bounds;
      const coordinates: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
      ] = [
        [W, N],
        [E, N],
        [E, S],
        [W, S],
      ];
      const src = map.getSource("field") as ImageSource | undefined;
      if (src) src.updateImage({ url: f.image, coordinates });
      else {
        map.addSource("field", { type: "image", url: f.image, coordinates });
        map.addLayer(
          {
            id: "field",
            type: "raster",
            source: "field",
            paint: { "raster-opacity": 0.72, "raster-fade-duration": 0 },
          },
          "tor-fill",
        );
      }
      (map.getSource("fires") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: (f.fires ?? []).map((x) => ({
          type: "Feature",
          properties: { chance: x.chance },
          geometry: { type: "Point", coordinates: [x.lon, x.lat] },
        })),
      });
    }
    if (rot && rot !== "error")
      (map.getSource("rot") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: rot.cells.map((c) => ({
          type: "Feature",
          properties: { v: c.v },
          geometry: { type: "Point", coordinates: [c.lon, c.lat] },
        })),
      });
    show(map, engine);
    if (data) {
      (map.getSource("tor") as GeoJSONSource | undefined)?.setData(data.tor);
      (map.getSource("hail") as GeoJSONSource | undefined)?.setData(data.hail);
    }
  }, [map, engine, data, fields, rot]);

  const storms =
    data?.storms.filter((x) =>
      engine === "tor" ? x.p20 >= 3 : x.band > 0 || x.hail >= 15,
    ) ?? [];
  const how = HOW[engine];
  const legend: [string, string][] =
    engine === "tor"
      ? TOR_BINS.map((b, i) => [b.label, torColor(i)])
      : engine === "hail"
        ? HAIL_BANDS.map((b, i) => [b.label, hailColor(i)])
        : engine === "blind"
          ? BLIND_BANDS.map((b, i) => [b.label, blindColor(i)])
          : engine === "rot"
            ? ROT_BANDS.map((b, i) => [`${b.label} ${b.min}+`, rotColor(i)])
            : FIELD_BANDS[engine].labels.map((l, i) => [
                l,
                fieldColor(engine, i),
              ]);
  const field = isField(engine) ? fields[engine] : undefined;
  const valid = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  const focus = (x: EngineStorm) =>
    map?.flyTo({ center: [x.lon, x.lat], zoom: 8, duration: 1200 });

  return (
    <div className="grid gap-3">
      <div className={s.picker} role="tablist" aria-label="Weather engines">
        {ENGINES.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            aria-selected={engine === e.id}
            onClick={() => {
              setEngine(e.id);
              setBeam(null);
            }}
          >
            {e.icon}
            <b>{e.name}</b>
            <small>{e.sub}</small>
          </button>
        ))}
      </div>
      <div className={s.mapBox}>
        <WeatherMap
          center={[-96, 38.5]}
          zoom={3.2}
          label="Weather engines map"
          className={s.map}
          onReady={onReady}
        />
        <span className={s.badge}>
          <FlaskConical aria-hidden /> Experimental
        </span>
      </div>
      <div className={s.legend}>
        {legend.map(([label, color]) => (
          <span key={label}>
            <i style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      {engine === "tor" && (
        <p className={s.small}>
          Brightest cone: next 20 minutes. Fainter: 20–40 and 40–60 minutes.
        </p>
      )}

      {(engine === "tor" || engine === "hail") && (
        <section className={s.card}>
          <header>
            <h3>
              {engine === "tor"
                ? "Storms with tornado potential"
                : "Hail-producing storms"}
            </h3>
            {data && <small>ProbSevere scan {time(data.at)}</small>}
          </header>
          {failed && !data && (
            <p className={s.small}>
              ProbSevere isn&apos;t answering right now. Trying again in two
              minutes.
            </p>
          )}
          {!data && !failed && (
            <p className={s.small}>Reading the latest scan…</p>
          )}
          {data && storms.length === 0 && (
            <p className={s.small}>
              {engine === "tor"
                ? `No storm is showing tornado potential right now. ProbSevere is tracking ${data.total} storm${data.total === 1 ? "" : "s"} across the country.`
                : `No storm is showing severe hail right now. ProbSevere is tracking ${data.total} storm${data.total === 1 ? "" : "s"}.`}
            </p>
          )}
          <ul className={s.storms}>
            {storms.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => focus(x)}>
                  <span className={s.where}>
                    <b>{x.place}</b>
                    <small>
                      <ArrowRight aria-hidden /> {x.toward} at {x.mph} mph
                    </small>
                  </span>
                  {engine === "tor" ? (
                    <span className={s.odds}>
                      {(
                        [
                          ["Now", x.tor],
                          ["20 min", x.p20],
                          ["40", x.p40],
                          ["60", x.p60],
                        ] as const
                      ).map(([k, v]) => (
                        <span key={k}>
                          <i
                            style={{
                              background: torColor(torBin(v)),
                              transform: `scaleY(${Math.max(0.06, v / 100)})`,
                            }}
                          />
                          <b>{v}%</b>
                          <small>{k}</small>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className={s.hail}>
                      <i style={{ background: hailColor(x.band) }} />
                      <b>{x.band ? `${x.meshIn.toFixed(2)}″` : "<1″"}</b>
                      <small>{x.hail}% severe hail</small>
                    </span>
                  )}
                </button>
                {engine === "tor" && (
                  <p className={s.flags}>
                    {x.trend === "rising" && (
                      <span data-k="up">
                        <ArrowUpRight aria-hidden /> Rotation tightening
                      </span>
                    )}
                    {x.trend === "falling" && (
                      <span>
                        <ArrowDownRight aria-hidden /> Rotation weakening
                      </span>
                    )}
                    {x.jump && (
                      <span data-k="up">
                        <Zap aria-hidden /> Lightning jump
                      </span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {engine === "rot" && (
        <section className={s.card}>
          <header>
            <h3>
              Longest rotation tracks, {WINDOWS.find((x) => x.w === win)?.long}
            </h3>
            {rot && rot !== "error" && <small>MRMS {time(rot.at)}</small>}
          </header>
          <div className={s.windows} role="group" aria-label="Track window">
            {WINDOWS.map((x) => (
              <button
                key={x.w}
                type="button"
                aria-pressed={x.w === win}
                onClick={() => {
                  if (x.w === win) return;
                  setWin(x.w);
                  setRot(null);
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
          {rot === null && <p className={s.small}>Reading MRMS…</p>}
          {rot === "error" && (
            <p className={s.small}>
              MRMS isn&apos;t answering right now. Trying again in a few
              minutes.
            </p>
          )}
          {rot && rot !== "error" && rot.tracks.length === 0 && (
            <p className={s.small}>
              No storm has held rotation over the{" "}
              {WINDOWS.find((x) => x.w === win)?.long}.
            </p>
          )}
          {rot && rot !== "error" && (
            <ul className={s.storms}>
              {rot.tracks.map((t) => (
                <li key={`${t.lat},${t.lon}`}>
                  <button
                    type="button"
                    onClick={() =>
                      map?.flyTo({
                        center: [t.lon, t.lat],
                        zoom: 8,
                        duration: 1200,
                      })
                    }
                  >
                    <span className={s.where}>
                      <b>{t.place}</b>
                      <small>{t.km} km track</small>
                    </span>
                    <span className={s.hail}>
                      <i style={{ background: rotColor(rotBin(t.peak)) }} />
                      <b>{t.peak}</b>
                      <small>peak ×10⁻³/s</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isField(engine) && (
        <section className={s.card}>
          <header>
            <h3>
              {engine === "pyro"
                ? "Large fires, blowup and PyroCb"
                : engine === "tctor" &&
                    field &&
                    field !== "error" &&
                    field.storms?.length
                  ? "Highest risk near the storm"
                  : "Strongest spots"}
            </h3>
            {field && field !== "error" && (
              <small>
                HRRR {field.cycle.slice(8)}Z run, valid {valid(field.valid)}
              </small>
            )}
          </header>
          {!field && <p className={s.small}>Running the engine…</p>}
          {field === "error" && (
            <p className={s.small}>
              The model data isn&apos;t answering right now. Try again in a few
              minutes.
            </p>
          )}
          {field && field !== "error" && field.note && (
            <p className={s.small}>{field.note}</p>
          )}
          {field &&
            field !== "error" &&
            engine !== "pyro" &&
            !field.note &&
            field.spots.length === 0 && (
              <p className={s.small}>
                Nothing reaches the first band anywhere in the lower 48 right
                now.
              </p>
            )}
          {field && field !== "error" && engine !== "pyro" && (
            <ul className={s.storms}>
              {field.spots.map((x) => (
                <li key={`${x.lat},${x.lon}`}>
                  <button
                    type="button"
                    onClick={() =>
                      map?.flyTo({
                        center: [x.lon, x.lat],
                        zoom: 6.5,
                        duration: 1200,
                      })
                    }
                  >
                    <span className={s.where}>
                      <b>{x.place}</b>
                      {engine === "nst" && (
                        <small>{x.water ? "Waterspout" : "Landspout"}</small>
                      )}
                    </span>
                    <span className={s.hail}>
                      <i
                        style={{
                          background: fieldColor(
                            engine,
                            Math.max(
                              0,
                              FIELD_BANDS[engine].levels.findLastIndex(
                                (l) => x.value >= l,
                              ),
                            ),
                          ),
                        }}
                      />
                      <b>{x.value}</b>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {field && field !== "error" && engine === "pyro" && (
            <>
              {!field.fires?.length && (
                <p className={s.small}>
                  No large uncontained fire is burning right now.
                </p>
              )}
              <ul className={s.storms}>
                {(field.fires ?? []).map((f) => (
                  <li key={`${f.name}${f.lat}`}>
                    <button
                      type="button"
                      onClick={() =>
                        map?.flyTo({
                          center: [f.lon, f.lat],
                          zoom: 8,
                          duration: 1200,
                        })
                      }
                    >
                      <span className={s.where}>
                        <b>
                          {f.name}, {f.state}
                        </b>
                        <small>
                          {f.acres.toLocaleString("en-US")} acres
                          {f.contained !== null
                            ? ` · ${f.contained}% contained`
                            : ""}{" "}
                          · blowup {f.blowup.toLowerCase()} (HDWI {f.hdwi})
                        </small>
                      </span>
                      <span className={s.hail}>
                        <i
                          style={{ background: pyroColor(pyroBin(f.chance)) }}
                        />
                        <b>{f.chance}%</b>
                        <small>PyroCb</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {engine === "blind" && (
        <section className={s.card}>
          <header>
            <h3>Beam height where you tap</h3>
          </header>
          {beam === null && <p className={s.small}>Tap anywhere on the map.</p>}
          {beam === "none" && (
            <p className={s.small}>
              No NWS radar reaches this spot at the lowest tilt.
            </p>
          )}
          {beam && beam !== "none" && (
            <p className={s.readout}>
              <b>
                {Math.round(beam.ft / 100) * 100 >= 1000
                  ? `${(Math.round(beam.ft / 100) * 100).toLocaleString("en-US")} ft`
                  : `${Math.round(beam.ft)} ft`}
              </b>
              <span>
                above the {beam.id} radar, {Math.round(beam.mi)} miles away
              </span>
            </p>
          )}
        </section>
      )}

      <details className={s.how}>
        <summary>How this works</summary>
        <p>
          <b>{how.lead}</b>
        </p>
        {how.body.map((p) => (
          <p key={p.slice(0, 20)}>{p}</p>
        ))}
      </details>
    </div>
  );
}
