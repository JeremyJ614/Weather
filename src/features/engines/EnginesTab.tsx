"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CloudLightning,
  Flame,
  FlaskConical,
  Radar,
  Tornado,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { stateOf, type ExtrasStates } from "@/lib/extras/items";
import {
  BLIND_BANDS,
  FIELD_BANDS,
  PYRO_BINS,
  TOR_BINS,
  pyroBin,
  torBin,
  type FieldId,
} from "@/lib/engines/colors";
import type { EngineStorm } from "@/lib/engines/probsevere";
import type { Areas } from "@/lib/engines/areas";
import radars from "@/lib/engines/radars.json";
import s from "./Engines.module.css";

type Engine = "tor" | "blind" | FieldId;
const FIELDS: FieldId[] = [
  "llj",
  "nst",
  "pyro",
  "tctor",
  "stp",
  "scp",
  "dcp",
  "ltg",
];
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
  areas: Areas;
  spots: Spot[];
  fires?: Fire[];
  storms?: { name: string; lat: number; lon: number; mph: number }[];
  note: string | null;
};
type Data = {
  at: string;
  total: number;
  storms: EngineStorm[];
  tor: GeoJSON.FeatureCollection;
  torAreas: Areas;
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
    id: "stp",
    name: "Significant Tornado",
    sub: "STP, this evening",
    icon: <Tornado aria-hidden />,
  },
  {
    id: "scp",
    name: "Supercell Composite",
    sub: "SCP, this evening",
    icon: <CloudLightning aria-hidden />,
  },
  {
    id: "dcp",
    name: "Derecho Composite",
    sub: "Long-lived wind storms",
    icon: <Wind aria-hidden />,
  },
  {
    id: "ltg",
    name: "Lightning Threat",
    sub: "Next 3 hours",
    icon: <Zap aria-hidden />,
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
      "Each storm is projected along its own motion for 0–20, 20–40 and 40–60 minutes, and the map draws the chances the way SPC draws an outlook: nested, outlined areas around each path that fade with distance, merging where storms run together. Zoom in to see each storm's own 20-minute cones. The later chances only fade: past half an hour nobody can say much more.",
      "This is an experimental guide, never a warning. Act on National Weather Service warnings.",
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
  pyro: {
    lead: "Fair, and experimental.",
    body: [
      "The map is the Hot-Dry-Windy Index at the afternoon peak (about 4 p.m. Central) from the HRRR: how dry the air is (vapor pressure deficit) times the 80 m wind. Around 100 and up, fires can blow up.",
      "Each large active fire (100 acres and up, from the national incident feed) gets a pyrocumulonimbus chance: the HDWI there, a steep 700–500 mb lapse rate, enough mid-level moisture for the smoke plume to build into its own thunderstorm, the fire's size, and how much of it is still uncontained.",
    ],
  },
  stp: {
    lead: "Good for where the setup is; storms still have to form.",
    body: [
      "The Significant Tornado Parameter is the Storm Prediction Center's go-to ingredient blend for tornadoes rated EF2 and up. This is the fixed-layer version from the HRRR at this evening's peak (7 p.m. Central), or as far ahead as the latest run reaches: surface-based CAPE, how low the cloud base (LCL) is, 0–1 km storm-relative helicity, 0–6 km shear and how much the cap is holding storms back.",
      "1 and up marks the environments most significant tornadoes form in; values over 4 are rare and come with the big days. A high number with no storms means nothing happens, so pair it with SPC's outlook.",
    ],
  },
  scp: {
    lead: "Good for where supercells could thrive.",
    body: [
      "The Supercell Composite Parameter weighs whether a storm would rotate as a supercell: most-unstable CAPE, 0–3 km storm-relative helicity and 0–6 km shear, cut down where the cap is strong. From the HRRR at this evening's peak (or as far ahead as the latest run reaches).",
      "1 and up favors supercells, which bring most large hail and strong tornadoes; above 8 is a classic supercell day. Left-moving storms are left off.",
    ],
  },
  dcp: {
    lead: "Fair: derechos need storms to organize first.",
    body: [
      "The Derecho Composite Parameter (Evans and Doswell) looks for long-lived, damaging wind storms: downdraft CAPE (how hard cold air can crash down out of a storm), most-unstable CAPE, 0–6 km shear and a fast 0–6 km mean wind to carry the line along. From the HRRR at this evening's peak (or as far ahead as the latest run reaches).",
      "The HRRR doesn't carry downdraft CAPE, so it is worked out here: a parcel let down from the drier of 700 and 500 mb at its wet-bulb temperature to the ground. 2 and up favors derecho-producing systems once a line of storms gets going.",
    ],
  },
  ltg: {
    lead: "Good for the next few hours.",
    body: [
      "The HRRR forecasts lightning itself: flashes per square kilometer every five minutes, from the ice and graupel moving up and down inside its storms. This is the most each spot gets over the next three hours.",
      "Isolated means the odd strike; frequent and up means lightning every few seconds nearby. Any thunder you hear means you are close enough to be struck, so head indoors.",
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

export function EnginesTab({
  colors,
  items = {},
}: {
  colors: Colors;
  /** The owner's switches (admin → Extras): hidden engines are left out, off ones greyed. */
  items?: ExtrasStates;
}) {
  const shown = ENGINES.filter((e) => stateOf(items, e.id) !== "hidden");
  const usable = shown.filter((e) => stateOf(items, e.id) === "on");
  const [engine, setEngine] = useState<Engine>(usable[0]?.id ?? "tor");
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [beam, setBeam] = useState<ReturnType<typeof beamAt> | "none" | null>(
    null,
  );
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [fields, setFields] = useState<
    Partial<Record<FieldId, FieldData | "error">>
  >({});
  const engineRef = useRef(engine);
  useEffect(() => {
    engineRef.current = engine;
  });

  const torColor = (i: number) =>
    pick(colors, `engine:tor:${i}`, TOR_BINS[i].color);
  const blindColor = (i: number) =>
    pick(colors, `engine:blind:${i}`, BLIND_BANDS[i].color);
  const fieldColor = (id: FieldId, i: number) =>
    pick(colors, `engine:${id}:${i}`, FIELD_BANDS[id].colors[i]);
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

  // ProbSevere every two minutes while ProbTor is open and the page is visible.
  useEffect(() => {
    if (engine !== "tor") return;
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
    // SPC-style areas: nested, filled and outlined per band.
    const byBand = (color: (i: number) => string, n: number) =>
      [
        "match",
        ["get", "band"],
        ...Array.from({ length: n }, (_, i) => [i, color(i)]).flat(),
        color(0),
      ] as never;
    for (const [id, color, n] of [
      ["torA", torColor, TOR_BINS.length],
      ["fieldA", (i: number) => fieldColor("llj", i), 5],
    ] as const) {
      m.addSource(id, { type: "geojson", data: EMPTY });
      m.addLayer({
        id: `${id}-fill`,
        type: "fill",
        source: id,
        paint: { "fill-color": byBand(color, n), "fill-opacity": 0.45 },
      });
      m.addLayer({
        id: `${id}-line`,
        type: "line",
        source: id,
        paint: {
          "line-color": byBand(color, n),
          "line-width": 1.6,
          "line-opacity": 0.95,
        },
      });
    }
    m.addSource("tor", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "tor-fill",
      minzoom: 6.5,
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
      minzoom: 6.5,
      type: "line",
      source: "tor",
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.35,
        "line-width": 0.8,
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
    vis("torA-fill", e === "tor");
    vis("torA-line", e === "tor");
    vis("fieldA-fill", isField(e));
    vis("fieldA-line", isField(e));
    vis("tor-fill", e === "tor");
    vis("tor-line", e === "tor");
    vis("blind", e === "blind");
    vis("radars", e === "blind");
    vis("fires", e === "pyro");
  };

  useEffect(() => {
    if (!map) return;
    const f = isField(engine) ? fields[engine] : undefined;
    if (f && f !== "error" && isField(engine)) {
      (map.getSource("fieldA") as GeoJSONSource | undefined)?.setData(f.areas);
      const n = FIELD_BANDS[engine].levels.length;
      const expr = [
        "match",
        ["get", "band"],
        ...Array.from({ length: n }, (_, i) => [
          i,
          fieldColor(engine, i),
        ]).flat(),
        fieldColor(engine, 0),
      ] as never;
      map.setPaintProperty("fieldA-fill", "fill-color", expr);
      map.setPaintProperty("fieldA-line", "line-color", expr);
      (map.getSource("fires") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: (f.fires ?? []).map((x) => ({
          type: "Feature",
          properties: { chance: x.chance },
          geometry: { type: "Point", coordinates: [x.lon, x.lat] },
        })),
      });
    }
    show(map, engine);
    if (data) {
      (map.getSource("tor") as GeoJSONSource | undefined)?.setData(data.tor);
      (map.getSource("torA") as GeoJSONSource | undefined)?.setData(
        data.torAreas,
      );
    }
  }, [map, engine, data, fields, colors]); // eslint-disable-line react-hooks/exhaustive-deps -- the color helpers derive from colors

  const storms = data?.storms ?? [];
  const how = HOW[engine];
  const legend: [string, string][] =
    engine === "tor"
      ? TOR_BINS.map((b, i) => [b.label, torColor(i)])
      : engine === "blind"
        ? BLIND_BANDS.map((b, i) => [b.label, blindColor(i)])
        : FIELD_BANDS[engine].labels.map((l, i) => [l, fieldColor(engine, i)]);
  const field = isField(engine) ? fields[engine] : undefined;
  const valid = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  const focus = (x: EngineStorm) =>
    map?.flyTo({ center: [x.lon, x.lat], zoom: 8, duration: 1200 });

  if (!usable.length)
    return (
      <p className="text-sm text-muted">
        The Weather Engines are switched off for now. Check back soon.
      </p>
    );

  return (
    <div className="grid gap-3">
      <div className={s.picker} role="tablist" aria-label="Weather engines">
        {shown.map((e) => {
          const off = stateOf(items, e.id) === "off";
          return (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={engine === e.id}
              disabled={off}
              onClick={() => {
                setEngine(e.id);
                setBeam(null);
              }}
            >
              {e.icon}
              <b>{e.name}</b>
              <small>{off ? "Off for now" : e.sub}</small>
            </button>
          );
        })}
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
          Areas: the chance within about 25 miles over the next hour. Zoomed in,
          each storm&apos;s cones show its next 20, 40 and 60 minutes.
        </p>
      )}

      {engine === "tor" && (
        <section className={s.card}>
          <header>
            <h3>Storms with tornado potential</h3>
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
              No storm is showing tornado potential right now. ProbSevere is
              tracking {data.total} storm{data.total === 1 ? "" : "s"} across
              the country.
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
                </button>
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
              </li>
            ))}
          </ul>
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
