"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { Activity, Box, Compass, Gauge, Pause, Play } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { HomeTabs } from "@/features/news/HomeTabs";
import { usePlaces } from "@/features/location/usePlaces";
import { Sounding3D } from "@/features/soundings/Sounding3D";
import { pick, type Colors } from "@/lib/colors/pick";
import {
  analyze,
  type Analysis,
  type Level,
  type Sounding,
} from "@/lib/soundings/thermo";
import { explain } from "@/lib/soundings/explain";
import { MODELS, type ModelId } from "@/lib/soundings/models";
import { SND_BANDS, SND_LINES } from "@/lib/soundings/style";
import s from "./Soundings.module.css";

const MotionShare = dynamic(() => import("@/features/share/MotionShare"), {
  ssr: false,
});
// The Skew-T (with its tap-for-details readout) and the hodograph load when their tab opens.
const chart = () => <div className="h-[420px] animate-pulse rounded-2xl" />;
const SkewT = dynamic(
  () => import("@/features/soundings/SkewT").then((m) => m.SkewT),
  { loading: chart },
);
const Hodograph = dynamic(
  () => import("@/features/soundings/Hodograph").then((m) => m.Hodograph),
  { loading: chart },
);

type Station = { id: string; name: string; lat: number; lon: number };
type Balloons = { ts: string; valid: string; stations: Station[] };
type Src = "RAOB" | ModelId;
type ModelRes = {
  model: ModelId;
  station: string;
  lat: number;
  lon: number;
  run: string;
  hours: Sounding[];
};
type BalloonRes = { station: Station | null; valid: string; levels: Level[] };
const now = () => Date.now();

/** "Thu 3 PM" in Central time, built from parts so every machine prints the same. */
const when = (iso: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      hour: "numeric",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.weekday} ${p.hour} ${p.dayPeriod} CT`;
};
const z = (iso: string) => `${iso.slice(11, 13)}Z`;
const miles = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
};

function useJson<T>(url: string | null) {
  const [res, setRes] = useState<{ url: string; d: T | "error" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: T) => live && setRes({ url, d }))
      .catch(() => live && setRes({ url, d: "error" }));
    return () => {
      live = false;
    };
  }, [url]);
  return url && res?.url === url ? res.d : null;
}

/** The share's side view: looking north at the sounding, a little above the floor. */
const SIDE = { yaw: 0, tilt: 0.2 };

/** 3D Soundings: pick a balloon site or any point for a model, then read it four ways. */
export function SoundingsView({ colors }: { colors: Colors }) {
  const c = (k: string) =>
    pick(
      colors,
      `snd:${k}`,
      [...SND_LINES, ...SND_BANDS].find((x) => x.key === k)?.color ?? "#ffffff",
    );
  const { active } = usePlaces();
  const [src, setSrc] = useState<Src>("RAOB");
  const [pt, setPt] = useState<{ lat: number; lon: number } | null>(null);
  const point =
    pt ??
    (active
      ? { lat: active.lat, lon: active.lon }
      : { lat: 35.18, lon: -97.44 });
  const balloons = useJson<Balloons>("/api/soundings/balloons");
  const list = useMemo(
    () => (balloons && balloons !== "error" ? balloons.stations : []),
    [balloons],
  );
  const site = list.length
    ? list.reduce((b, x) => (miles(point, x) < miles(point, b) ? x : b))
    : null;
  const url =
    src === "RAOB"
      ? site && balloons && balloons !== "error"
        ? `/api/soundings/balloon?id=${site.id}&ts=${balloons.ts}`
        : null
      : `/api/soundings/model?m=${src}&lat=${point.lat.toFixed(1)}&lon=${point.lon.toFixed(1)}`;
  const data = useJson<ModelRes | BalloonRes>(url);
  const model = data && data !== "error" && "hours" in data ? data : null;
  const bal = data && data !== "error" && "levels" in data ? data : null;

  // Forecast hour: the one nearest now when a run loads, then wherever the slider goes.
  const [hour, setHour] = useState<{ key: string; i: number } | null>(null);
  const runKey = model ? `${model.model}${model.station}${model.run}` : "";
  const nearest = useMemo(() => {
    if (!model) return 0;
    const t = now();
    return model.hours.reduce(
      (b, h, i) =>
        Math.abs(Date.parse(h.valid) - t) <
        Math.abs(Date.parse(model.hours[b].valid) - t)
          ? i
          : b,
      0,
    );
  }, [model]);
  const hi = model
    ? hour?.key === runKey
      ? Math.min(hour.i, model.hours.length - 1)
      : nearest
    : 0;
  const levels = model ? model.hours[hi]?.levels : bal?.levels;
  const a = useMemo(() => (levels ? analyze(levels) : null), [levels]);
  const [pk, setPk] = useState<"ml" | "sb" | "mu">("ml");
  const parcel = a ? a[pk] : null;
  const view3d = useRef<{ yaw: number; tilt: number } | null>(null);
  const [angle, setAngle] = useState<"side" | "mine">("side");

  // Play through the run.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !model) return;
    const t = setInterval(() => {
      setHour((h) => {
        const i = (h?.key === runKey ? h.i : nearest) + 1;
        return { key: runKey, i: i >= model.hours.length ? 0 : i };
      });
    }, 700);
    return () => clearInterval(t);
  }, [playing, model, runKey, nearest]);

  // Map: balloon sites as dots, the chosen point ringed. Tap picks a site or a point.
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const tap = useRef<(lat: number, lon: number) => void>(() => {});
  useEffect(() => {
    tap.current = (lat, lon) => setPt({ lat, lon });
  }, []);
  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    m.addSource("raob", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addSource("pick", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "raob",
      type: "circle",
      source: "raob",
      paint: {
        "circle-radius": 4.5,
        "circle-color": "#0b0c14",
        "circle-stroke-width": 2,
        "circle-stroke-color": ["get", "color"],
      },
    });
    m.addLayer({
      id: "pick",
      type: "circle",
      source: "pick",
      paint: {
        "circle-radius": 9,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 3,
        "circle-stroke-color": ["get", "color"],
      },
    });
    m.on("click", (e) => tap.current(e.lngLat.lat, e.lngLat.lng));
    m.easeTo({ pitch: 45, duration: 0 });
    map.current = m;
    setReady(true);
  };
  const shown =
    src === "RAOB" ? site : model ? { lat: model.lat, lon: model.lon } : point;
  const dot = c("storm");
  const ring = c("temp");
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("raob") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: list.map((x) => ({
        type: "Feature",
        properties: { color: dot },
        geometry: { type: "Point", coordinates: [x.lon, x.lat] },
      })),
    });
    m.setLayoutProperty(
      "raob",
      "visibility",
      src === "RAOB" ? "visible" : "none",
    );
  }, [ready, list, src, dot]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("pick") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: shown
        ? [
            {
              type: "Feature",
              properties: { color: ring },
              geometry: { type: "Point", coordinates: [shown.lon, shown.lat] },
            },
          ]
        : [],
    });
  }, [ready, shown?.lat, shown?.lon, ring]); // eslint-disable-line react-hooks/exhaustive-deps -- the point is the input

  const title =
    src === "RAOB"
      ? site
        ? `${site.name} (${site.id.replace(/^_/, "")})`
        : "Weather balloons"
      : model
        ? `${MODELS.find((m) => m.id === src)?.label} at ${model.station}`
        : (MODELS.find((m) => m.id === src)?.label ?? "");
  const sub =
    src === "RAOB"
      ? bal
        ? `Balloon launched for ${z(bal.valid)} · ${when(bal.valid)}`
        : ""
      : model && model.hours[hi]
        ? `Run ${z(model.run)} · F${String(model.hours[hi].fh).padStart(3, "0")} · valid ${when(model.hours[hi].valid)}${
            miles(point, model) > 3
              ? ` · nearest model site, ${Math.round(miles(point, model))} mi from your pick`
              : ""
          }`
        : "";
  const loading = !!url && !data;
  const failed = data === "error" || (data && !a);

  return (
    <div className="grid gap-4">
      <div className={s.pills} role="group" aria-label="Source">
        {(["RAOB", ...MODELS.map((m) => m.id)] as Src[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === src}
            onClick={() => (setSrc(id), setPlaying(false))}
          >
            {id === "RAOB"
              ? "Balloons"
              : MODELS.find((m) => m.id === id)?.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <WeatherMap
          center={[-97, 38]}
          zoom={3.1}
          label="Sounding picker map"
          className="h-[46dvh] min-h-72"
          onReady={onReady}
        />
        <p className={s.hint}>
          {src === "RAOB"
            ? "Tap near a balloon site"
            : "Tap anywhere for a model sounding"}
        </p>
      </div>
      <section className={s.card} aria-live="polite">
        <h2>{title}</h2>
        <p className={s.muted}>
          {loading
            ? "Loading the sounding…"
            : failed
              ? src === "RAOB"
                ? "This balloon's data isn't available. Try another site."
                : "No model sounding there right now. Try a point in North America."
              : sub}
        </p>
        {src === "RAOB" && balloons === "error" && (
          <p className={s.muted}>
            The balloon archive isn&apos;t answering right now.
          </p>
        )}
        {src !== "RAOB" && (
          <p className={s.muted}>{MODELS.find((m) => m.id === src)?.desc}</p>
        )}
        {model && model.hours.length > 1 && (
          <div className={s.scrub}>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play the run"}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={model.hours.length - 1}
              value={hi}
              onChange={(e) => (
                setPlaying(false),
                setHour({ key: runKey, i: +e.target.value })
              )}
              aria-label="Forecast hour"
            />
            <b>F{String(model.hours[hi]?.fh ?? 0).padStart(3, "0")}</b>
          </div>
        )}
        {a && (
          <>
            <div className={s.keys}>
              <div>
                <b>{a.ml.cape}</b>
                <span>MLCAPE</span>
              </div>
              <div>
                <b>{a.shear6 ?? "–"}</b>
                <span>0–6 km shear kt</span>
              </div>
              <div>
                <b>{a.srh1 ?? "–"}</b>
                <span>0–1 km SRH</span>
              </div>
              <div>
                <b>{a.stp ?? "–"}</b>
                <span>STP</span>
              </div>
            </div>
            <p className={s.read}>{explain(a)}</p>
            <div className={s.shares}>
              {(["card", "social"] as const).map((look) => (
                <MotionShare
                  key={look}
                  file={`sswx-sounding-${look === "social" ? "social-" : ""}${src.toLowerCase()}`}
                  frames={model ? model.hours.length : 1}
                  formats={model ? ["image", "gif", "video"] : ["image"]}
                  label={look === "social" ? "Social share" : "Share"}
                  heading={
                    look === "social"
                      ? "3D, Skew-T and hodograph together, as"
                      : "Share the 3D sounding as"
                  }
                  hints={{
                    image: model ? "This hour" : "This launch",
                    gif: "Camera still; the winds change hour by hour",
                    video: "MP4 · 1080p · camera still",
                  }}
                  controls={
                    <div
                      className={s.angle}
                      role="radiogroup"
                      aria-label="Camera angle for the share"
                    >
                      <span>Camera</span>
                      {(
                        [
                          ["side", "Side view", "Level with the sounding"],
                          ["mine", "My angle", "Exactly as you have it now"],
                        ] as const
                      ).map(([k, l, d]) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={angle === k}
                          onClick={() => setAngle(k)}
                        >
                          {l}
                          <small>{d}</small>
                        </button>
                      ))}
                    </div>
                  }
                  build={async (f, progress) => {
                    setPlaying(false);
                    const { makeSounding, placeName } = await import("./share");
                    const at = src === "RAOB" ? site : model;
                    const near = at ? await placeName(at.lat, at.lon) : null;
                    const label = MODELS.find((m) => m.id === src)?.label;
                    const frames = model
                      ? model.hours.map((h) => ({
                          levels: h.levels,
                          when: when(h.valid),
                          tag: `RUN ${z(model.run)} · F${String(h.fh ?? 0).padStart(3, "0")}`,
                        }))
                      : [
                          {
                            levels: bal!.levels,
                            when: when(bal!.valid),
                            tag: `${z(bal!.valid)} LAUNCH`,
                          },
                        ];
                    return makeSounding(
                      {
                        kind: model ? "model" : "balloon",
                        place:
                          near ??
                          (src === "RAOB" ? (site?.name ?? title) : title),
                        source: model
                          ? `${label} model sounding · ${model.station}`
                          : `Weather balloon · ${site?.id.replace(/^_/, "") ?? ""}`,
                        frames,
                        at: model ? hi : 0,
                        parcel: pk,
                        // The side view, or a copy of the angle right now: the page's 3D
                        // keeps turning while the file is made, and a share never turns
                        // (owner's list #42: no camera movement at all).
                        view:
                          angle === "side"
                            ? SIDE
                            : view3d.current
                              ? {
                                  yaw: view3d.current.yaw,
                                  tilt: view3d.current.tilt,
                                }
                              : { yaw: -0.6, tilt: 0.42 },
                        c,
                      },
                      look,
                      f,
                      progress,
                    );
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>
      {a && parcel && (
        <>
          <div className={s.pills} role="group" aria-label="Parcel">
            {(
              [
                ["ml", "Mixed layer"],
                ["sb", "Surface"],
                ["mu", "Most unstable"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === pk}
                onClick={() => setPk(k)}
              >
                {l} parcel
              </button>
            ))}
          </div>
          <HomeTabs
            label="Sounding views"
            tabs={[
              {
                id: "s-3d",
                label: "3D",
                icon: <Box aria-hidden />,
                panel: <View3D a={a} parcel={parcel} c={c} viewRef={view3d} />,
              },
              {
                id: "s-skewt",
                label: "Skew-T",
                icon: <Activity aria-hidden />,
                panel: <SkewPanel a={a} parcel={parcel} c={c} />,
              },
              {
                id: "s-hodo",
                label: "Hodograph",
                icon: <Compass aria-hidden />,
                panel: <HodoPanel a={a} c={c} />,
              },
              {
                id: "s-num",
                label: "Numbers",
                icon: <Gauge aria-hidden />,
                panel: <Numbers a={a} />,
              },
            ]}
          />
        </>
      )}
      <p className={s.foot}>
        Sources: NWS weather balloons (00Z and 12Z launches) and NCEP model
        soundings (BUFKIT), both through the Iowa Environmental Mesonet.
        Parameters are computed here from the raw profile with standard methods
        (virtual temperature parcels, Bunkers storm motion, fixed-layer STP and
        SCP), so they can differ slightly from SPC&apos;s.
      </p>
    </div>
  );
}

function Legend({
  items,
}: {
  items: { label: string; color: string; dash?: boolean }[];
}) {
  return (
    <div className={s.legend}>
      {items.map((i) => (
        <span key={i.label}>
          <i
            style={{
              background: i.dash
                ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)`
                : i.color,
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function View3D({
  a,
  parcel,
  c,
  viewRef,
}: {
  a: Analysis;
  parcel: Analysis["ml"];
  c: (k: string) => string;
  viewRef: React.RefObject<{ yaw: number; tilt: number } | null>;
}) {
  return (
    <div className={s.card}>
      <Sounding3D a={a} parcel={parcel} c={c} viewRef={viewRef} />
      <Legend
        items={[
          ...SND_BANDS.map((b) => ({ label: b.label, color: c(b.key) })),
          { label: "CAPE layer", color: c("cape") },
          { label: "Cap (CIN)", color: c("cin") },
        ]}
      />
      <p className={s.muted}>
        Each arrow is the wind at that height; the colored line through their
        tips is the hodograph, its shadow on the floor. Drag to turn and tilt;
        pinch, scroll, double-tap or use + and − to zoom in. A curved, long
        trace means the shear that spins storms. On the height axis, red is the
        CAPE layer and blue the cap a storm has to break through.
      </p>
    </div>
  );
}

export function SkewPanel({
  a,
  parcel,
  c,
}: {
  a: Analysis;
  parcel: Analysis["ml"];
  c: (k: string) => string;
}) {
  return (
    <div className={s.card}>
      <SkewT a={a} parcel={parcel} c={c} />
      <Legend
        items={[
          { label: "Temperature", color: c("temp") },
          { label: "Dew point", color: c("dew") },
          { label: "Parcel", color: c("parcel"), dash: true },
          { label: "CAPE", color: c("cape") },
          { label: "CIN (cap)", color: c("cin") },
        ]}
      />
    </div>
  );
}

export function HodoPanel({ a, c }: { a: Analysis; c: (k: string) => string }) {
  const dir = (p: { u: number; v: number }) =>
    Math.round(((Math.atan2(-p.u, -p.v) * 180) / Math.PI + 360) % 360);
  return (
    <div className={s.card}>
      <Hodograph a={a} c={c} />
      <Legend
        items={SND_BANDS.map((b) => ({ label: b.label, color: c(b.key) }))}
      />
      {a.rm && (
        <p className={s.muted}>
          Right-moving supercells would travel from {dir(a.rm)}° at{" "}
          {Math.round(Math.hypot(a.rm.u, a.rm.v))} kt. The shaded wedge is the
          0–1 km storm-relative helicity ({a.srh1} m²/s²). Rings every{" "}
          {Math.max(40, ...a.wind.map((p) => Math.hypot(p.u, p.v))) > 80
            ? 20
            : 10}{" "}
          kt.
        </p>
      )}
    </div>
  );
}

function Numbers({ a }: { a: Analysis }) {
  const m = (v: number | null) =>
    v == null ? "–" : `${v.toLocaleString("en-US")} m`;
  const rows: [string, [string, string | number][]][] = [
    [
      "Instability",
      [
        ["SBCAPE / CIN", `${a.sb.cape} / ${a.sb.cin}`],
        ["MLCAPE / CIN", `${a.ml.cape} / ${a.ml.cin}`],
        [
          "MUCAPE",
          `${a.mu.cape}${a.mu.fromM > 50 ? ` (from ${a.mu.fromM} m)` : ""}`,
        ],
        ["0–3 km MLCAPE", a.ml.cape3],
        ["ML LCL", m(a.ml.lclM)],
        ["ML LFC", m(a.ml.lfcM)],
        ["ML EL", m(a.ml.elM)],
        ["Lifted index", a.sb.li ?? "–"],
      ],
    ],
    [
      "Wind",
      [
        ["0–1 km shear", a.shear1 == null ? "–" : `${a.shear1} kt`],
        ["0–3 km shear", a.shear3 == null ? "–" : `${a.shear3} kt`],
        ["0–6 km shear", a.shear6 == null ? "–" : `${a.shear6} kt`],
        ["0–1 km SRH", a.srh1 ?? "–"],
        ["0–3 km SRH", a.srh3 ?? "–"],
        [
          "Bunkers right",
          a.rm ? `${Math.round(Math.hypot(a.rm.u, a.rm.v))} kt` : "–",
        ],
      ],
    ],
    [
      "Moisture & lapse rates",
      [
        ["Precipitable water", `${a.pwatIn} in`],
        ["0–3 km lapse rate", a.lapse03 == null ? "–" : `${a.lapse03} °C/km`],
        [
          "700–500 mb lapse rate",
          a.lapse75 == null ? "–" : `${a.lapse75} °C/km`,
        ],
        [
          "Freezing level",
          a.frzFt == null ? "–" : `${a.frzFt.toLocaleString("en-US")} ft`,
        ],
      ],
    ],
    [
      "Composites",
      [
        ["Significant tornado (STP)", a.stp ?? "–"],
        ["Supercell (SCP)", a.scp ?? "–"],
      ],
    ],
  ];
  return (
    <div className="grid gap-3">
      {rows.map(([h, r]) => (
        <section key={h} className={s.card}>
          <h3>{h}</h3>
          <dl className={s.nums}>
            {r.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className={s.muted}>
        CAPE and CIN in J/kg, SRH in m²/s², heights above ground.
      </p>
    </div>
  );
}
