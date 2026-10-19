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
  CloudHail,
  FlaskConical,
  Radar,
  Tornado,
  Zap,
} from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import {
  BLIND_BANDS,
  HAIL_BANDS,
  TOR_BINS,
  torBin,
} from "@/lib/engines/colors";
import type { EngineStorm } from "@/lib/engines/probsevere";
import radars from "@/lib/engines/radars.json";
import s from "./Engines.module.css";

type Engine = "tor" | "hail" | "blind";
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

  // ProbSevere every two minutes while a storm engine is open and the page is visible.
  useEffect(() => {
    if (engine === "blind") return;
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
  };

  useEffect(() => {
    if (!map) return;
    show(map, engine);
    if (data) {
      (map.getSource("tor") as GeoJSONSource | undefined)?.setData(data.tor);
      (map.getSource("hail") as GeoJSONSource | undefined)?.setData(data.hail);
    }
  }, [map, engine, data]);

  const storms =
    data?.storms.filter((x) =>
      engine === "tor" ? x.p20 >= 3 : x.band > 0 || x.hail >= 15,
    ) ?? [];
  const how = HOW[engine];
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
        {(engine === "tor"
          ? TOR_BINS
          : engine === "hail"
            ? HAIL_BANDS
            : BLIND_BANDS
        ).map((b, i) => (
          <span key={b.label}>
            <i
              style={{
                background:
                  engine === "tor"
                    ? torColor(i)
                    : engine === "hail"
                      ? hailColor(i)
                      : blindColor(i),
              }}
            />
            {b.label}
          </span>
        ))}
      </div>
      {engine === "tor" && (
        <p className={s.small}>
          Brightest cone: next 20 minutes. Fainter: 20–40 and 40–60 minutes.
        </p>
      )}

      {engine !== "blind" && (
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
