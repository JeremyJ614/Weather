"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImageSource, Map as MaplibreMap } from "maplibre-gl";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { MODEL_CITIES } from "@/lib/models/cities";
import type { Recipe } from "@/lib/models/core";
import { fill } from "@/lib/models/tpl";
import { canDraw, drawFrame } from "./frames";
import s from "./Models.module.css";

type P = Recipe & {
  label: string;
  group: string;
  unit: string;
  full: boolean;
  colors: string[];
};
type Run = {
  label: string;
  res: string;
  /** HRRR and GFS: the model file's address, read and drawn on this device. */
  tpl: string | null;
  cycles: string[];
  hours: number[];
  /** b: the view; f: the box frames are painted over (wider for the global GFS). */
  regions: { id: string; label: string; b: number[]; f?: number[] }[];
  params: P[];
};
const GROUPS = ["Severe Weather", "Surface & Precipitation", "Upper Air"];
const SPEED = { Slow: 1100, Normal: 650, Fast: 330 } as const;

const cycleDate = (c: string) =>
  new Date(
    Date.UTC(+c.slice(0, 4), +c.slice(4, 6) - 1, +c.slice(6, 8), +c.slice(8)),
  );
const cycleLabel = (c: string) =>
  `${c.slice(8)}Z ${cycleDate(c).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
const validLabel = (c: string, fh: number) =>
  new Date(cycleDate(c).getTime() + fh * 3600_000).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
/** The outline casing: the model frames are slipped in under it, so the lines stay on top. */
const UNDER = "us-lines-case";
/** A frame's city values, from its map URL. */
const pointsUrl = (u: string) =>
  u
    .replace("/api/models/map?", "/api/models/points?")
    .replace(/&region=[^&]*/, "");
const corners = (b: number[]) =>
  [
    [b[0], b[3]],
    [b[2], b[3]],
    [b[2], b[1]],
    [b[0], b[1]],
  ] as [[number, number], [number, number], [number, number], [number, number]];

/** The city labels for one frame: the value over the name, or the name alone where none. */
const cityLabels = (v: (number | null)[] | null) => ({
  type: "FeatureCollection" as const,
  features: MODEL_CITIES.map(([name, lat, lon, tier], k) => ({
    type: "Feature" as const,
    properties: {
      name,
      tier,
      ...(v && v[k] !== null ? { v: String(v[k]) } : {}),
    },
    geometry: { type: "Point" as const, coordinates: [lon, lat] },
  })),
});

/**
 * VIP's Model Runs, on our own map: pick a model, a run, a field and a region; the frames
 * are rendered from NOAA's GRIB2 on demand (/api/models/map) and play as a loop. Frames
 * preload from the playhead onward, and playback waits for a frame rather than skipping it.
 */
export function ModelViewer({ model }: { model: "hrrr" | "gfs" | "refs" }) {
  const [run, setRun] = useState<Run | "error" | null>(null);
  const [cycle, setCycle] = useState("");
  const [key, setKey] = useState("");
  const [region, setRegion] = useState("conus");
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof SPEED>("Normal");
  const [loaded, setLoaded] = useState<Record<string, "ok" | "err">>({});
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  // City values per frame: they come with the frame; /api/models/points is asked only for a
  // frame that came without them, and a failed ask is tried once more.
  const values = useRef(new Map<string, (number | null)[]>());
  const asked = useRef(new Set<string>());
  const [valuesFor, setValuesFor] = useState("");
  const want = useCallback(function ask(pu: string, again = true) {
    if (values.current.has(pu) || asked.current.has(pu)) return;
    asked.current.add(pu);
    fetch(pu)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { v: (number | null)[] }) => {
        values.current.set(pu, d.v);
        setValuesFor(pu);
      })
      .catch(() => {
        asked.current.delete(pu);
        if (again) setTimeout(() => ask(pu, false), 2000);
      });
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/models/run?model=${model}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Run) => {
        if (!live) return;
        setRun(d);
        setCycle(d.cycles[0]);
        setKey(d.params[0].key);
      })
      .catch(() => live && setRun("error"));
    return () => {
      live = false;
    };
  }, [model]);

  const r = run && run !== "error" ? run : null;
  const p = r?.params.find((x) => x.key === key) ?? r?.params[0];
  const reg = r?.regions.find((x) => x.id === region) ?? r?.regions[0];
  const urls = useMemo(
    () =>
      r && p && cycle
        ? r.hours.map(
            (fh) =>
              `/api/models/map?model=${model}&cycle=${cycle}&fh=${fh}&p=${p.key}&region=${region}`,
          )
        : [],
    [r, p, cycle, region, model],
  );

  // HRRR and GFS frames are drawn on this device from NOAA's own files (frame.worker.ts), so
  // they cost the server nothing (owner, 2026-11-02, after Vercel paused the project for going
  // over its free usage). REFS frames come from the server, which alone can read NOAA's REFS
  // feed: only the hour on screen and the next one, more while the loop plays.
  // Either way a frame is kept as an in-memory copy (keyed by its URL) with its city values.
  // The frame on screen is first in line, then onward from the playhead.
  const direct = !!r?.tpl && canDraw();
  const blobs = useRef(new Map<string, string>());
  const at = useRef(0);
  const looping = useRef(false);
  const kick = useRef(() => {});
  useEffect(() => {
    if (!urls.length || !r || !p || !reg) return;
    let live = true;
    const store = blobs.current;
    const started = new Set<string>();
    const made = new Map<string, string>();
    let busy = 0;
    const box = reg.f ?? reg.b;
    const width = reg.id === "conus" ? 2400 : 2000;
    const fetchFrame = async (u: string) => {
      if (direct) {
        const fh = r.hours[urls.indexOf(u)];
        const d = await drawFrame({
          url: fill(r.tpl!, cycle.slice(0, 8), cycle.slice(8), fh),
          recipe: p,
          colors: p.colors,
          box,
          width,
          cities: true,
        });
        return { blob: d.png, cities: d.cities };
      }
      const res = await fetch(u);
      if (!res.ok) throw new Error(String(res.status));
      const v = res.headers.get("X-City-Values");
      return {
        blob: await res.blob(),
        cities:
          v === null
            ? null
            : v.split(",").map((x) => (x === "" ? null : Number(x))),
      };
    };
    const load = (u: string) => {
      started.add(u);
      busy++;
      fetchFrame(u)
        .then(({ blob, cities }) => {
          if (!live) return;
          const local = URL.createObjectURL(blob);
          made.set(u, local);
          store.set(u, local);
          if (cities) values.current.set(pointsUrl(u), cities);
          setLoaded((m) => ({ ...m, [u]: "ok" }));
        })
        .catch(() => live && setLoaded((m) => ({ ...m, [u]: "err" })))
        .finally(() => {
          busy--;
          if (live) pump();
        });
    };
    const pump = () => {
      const n = urls.length;
      const here = Math.min(at.current, n - 1);
      if (!started.has(urls[here])) load(urls[here]);
      // Server frames: just ahead of the playhead.
      const reach = direct ? n : looping.current ? 4 : 2;
      for (let k = 1; k < reach && busy < 3; k++) {
        const u = urls[(here + k) % n];
        if (!started.has(u)) load(u);
      }
    };
    kick.current = pump;
    pump();
    return () => {
      live = false;
      kick.current = () => {};
      // The map keeps showing the last frame until the next set's first frame replaces it,
      // so the old copies are let go a little later.
      setTimeout(() => {
        for (const [u, local] of made) {
          if (store.get(u) === local) store.delete(u);
          URL.revokeObjectURL(local);
        }
      }, 15000);
    };
    // `urls` stands for the model, run, field and region.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls]);
  useEffect(() => {
    at.current = i;
    looping.current = playing;
    kick.current();
  }, [i, playing]);

  const cur = urls[Math.min(i, urls.length - 1)];
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !cur || !reg || loaded[cur] !== "ok") return;
    const box = corners(reg.f ?? reg.b);
    const url = blobs.current.get(cur) ?? cur;
    const src = m.getSource("model") as ImageSource | undefined;
    if (src) src.updateImage({ url, coordinates: box });
    else {
      m.addSource("model", { type: "image", url, coordinates: box });
      m.addLayer(
        {
          id: "model",
          type: "raster",
          source: "model",
          paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
        },
        UNDER,
      );
    }
  }, [cur, ready, reg, loaded]);

  // The current frame's city values (names alone until they arrive, never another hour's).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !cur) return;
    const src = m.getSource("model-cities") as
      { setData: (d: unknown) => void } | undefined;
    const pu = pointsUrl(cur);
    src?.setData(cityLabels(values.current.get(pu) ?? null));
    if (loaded[cur] === "ok") want(pu);
  }, [cur, ready, valuesFor, loaded, want]);

  // Paused and zoomed in (Fix list 2026-10-30 #8): the frame is redrawn just for the view,
  // snapped to half degrees, and laid over the loop's frame, so fields stay crisp up close.
  const [view, setView] = useState<number[] | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !reg) return;
    const look = () => {
      const b = m.getBounds();
      const w = b.getWest();
      const e = b.getEast();
      const span = (reg.b[2] - reg.b[0]) / (e - w);
      if (span < 1.8) return setView(null);
      const lo = (v: number) => Math.floor(v * 2) / 2;
      const hi = (v: number) => Math.ceil(v * 2) / 2;
      const box = [lo(w), lo(b.getSouth()), hi(e), hi(b.getNorth())];
      setView(box[2] - box[0] <= 25 && box[3] - box[1] <= 20 ? box : null);
    };
    m.on("moveend", look);
    return () => {
      m.off("moveend", look);
    };
  }, [ready, reg]);
  // Drawn on the device only (HRRR, GFS): a zoomed REFS redraw would be another server render.
  const detail = direct && !playing && view && cur ? cur : null;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource("model-detail") as ImageSource | undefined;
    if (!detail || !view || !r?.tpl || !p) {
      if (m.getLayer("model-detail"))
        m.setLayoutProperty("model-detail", "visibility", "none");
      return;
    }
    let live = true;
    let local = "";
    drawFrame({
      url: fill(
        r.tpl,
        cycle.slice(0, 8),
        cycle.slice(8),
        r.hours[urls.indexOf(detail)],
      ),
      recipe: p,
      colors: p.colors,
      box: view,
      width: 1600,
      cities: false,
    })
      .then((d) => {
        if (!live) return;
        local = URL.createObjectURL(d.png);
        const url = local;
        if (src) src.updateImage({ url, coordinates: corners(view) });
        else {
          m.addSource("model-detail", {
            type: "image",
            url,
            coordinates: corners(view),
          });
          m.addLayer(
            {
              id: "model-detail",
              type: "raster",
              source: "model-detail",
              paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
            },
            UNDER,
          );
        }
        m.setLayoutProperty("model-detail", "visibility", "visible");
      })
      .catch(() => {});
    return () => {
      live = false;
      // Let the map finish taking the picture before its copy goes.
      if (local) setTimeout(() => URL.revokeObjectURL(local), 15000);
    };
    // `detail` and `view` stand for the frame and box being redrawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, view, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !reg) return;
    m.fitBounds(
      [
        [reg.b[0], reg.b[1]],
        [reg.b[2], reg.b[3]],
      ],
      { padding: 10, duration: 700 },
    );
  }, [reg, ready]);

  // Play: step when the next frame is in (or failed), so the loop waits rather than skips.
  useEffect(() => {
    if (!playing || !urls.length) return;
    const t = setInterval(() => {
      setI((k) => {
        const n = (k + 1) % urls.length;
        return loaded[urls[n]] ? n : k;
      });
    }, SPEED[speed]);
    return () => clearInterval(t);
  }, [playing, urls, loaded, speed]);

  const onReady = ({ map: any, provider }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    map.current = m;
    // Like Max Velocity's maps: the field solid, the states, coasts and borders drawn bright
    // over it, and our own city values instead of the base map's labels.
    for (const l of m.getStyle().layers)
      if (l.type === "symbol") m.setLayoutProperty(l.id, "visibility", "none");
    m.addSource("us-lines", { type: "geojson", data: "/geo/us-lines.json" });
    const width = (state: number, nation: number) =>
      [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        ["match", ["get", "kind"], "nation", nation, state],
        8,
        ["match", ["get", "kind"], "nation", nation * 2, state * 2],
      ] as unknown as number;
    m.addLayer({
      id: UNDER,
      type: "line",
      source: "us-lines",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#05060a",
        "line-opacity": 0.55,
        "line-width": width(2.6, 3.2),
      },
    });
    m.addLayer({
      id: "us-lines",
      type: "line",
      source: "us-lines",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.92,
        "line-width": width(1.1, 1.5),
      },
    });
    m.addSource("model-cities", {
      type: "geojson",
      data: cityLabels(null),
    });
    m.addLayer({
      id: "model-cities",
      type: "symbol",
      source: "model-cities",
      layout: {
        "text-field": [
          "case",
          ["has", "v"],
          [
            "format",
            ["get", "v"],
            { "font-scale": 1.3 },
            "\n",
            {},
            ["get", "name"],
            { "font-scale": 0.78 },
          ],
          ["format", ["get", "name"], { "font-scale": 0.78 }],
        ] as unknown as string,
        "text-font":
          provider === "mapbox"
            ? ["DIN Pro Bold", "Arial Unicode MS Bold"]
            : ["Noto Sans Bold"],
        "text-size": 13,
        "text-line-height": 1.05,
        "text-padding": 3,
        "symbol-sort-key": ["get", "tier"],
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "rgba(5, 6, 10, 0.85)",
        "text-halo-width": 1.6,
      },
    });
    setReady(true);
  };

  if (run === "error")
    return (
      <p className={s.muted}>
        NOAA&apos;s model data isn&apos;t answering right now. Try again soon.
      </p>
    );
  if (!r || !p || !reg)
    return <p className={s.muted}>Finding the newest run…</p>;
  const fh = r.hours[Math.min(i, r.hours.length - 1)];
  const done = urls.filter((u) => loaded[u]).length;
  return (
    <div className="grid gap-3">
      <div className={s.runCard}>
        <div>
          <small>Model run</small>
          <b>
            <i aria-hidden /> {cycleLabel(cycle)}
            {cycle === r.cycles[0] && <em>Latest</em>}
          </b>
        </div>
        <label>
          <small>Archive</small>
          <select
            value={cycle}
            onChange={(e) => (setCycle(e.target.value), setI(0))}
          >
            {r.cycles.map((c, k) => (
              <option key={c} value={c}>
                {cycleLabel(c)}
                {k === 0 ? " (latest)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div>
          <small>Range</small>
          <b>
            F{String(r.hours[0]).padStart(3, "0")}–F
            {String(r.hours[r.hours.length - 1]).padStart(3, "0")}
          </b>
        </div>
        <div>
          <small>Resolution</small>
          <b>{r.res}</b>
        </div>
      </div>
      {GROUPS.filter((g) => r.params.some((x) => x.group === g)).map((g) => (
        <div key={g} className="grid gap-1.5">
          <small className={s.group}>{g}</small>
          <div className={s.pills} role="group" aria-label={g}>
            {r.params
              .filter((x) => x.group === g)
              .map((x) => (
                <button
                  key={x.key}
                  type="button"
                  aria-pressed={x.key === p.key}
                  onClick={() => setKey(x.key)}
                >
                  {x.label}
                </button>
              ))}
          </div>
        </div>
      ))}
      <div className={s.tabs} role="group" aria-label="Region">
        {r.regions.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === region}
            onClick={() => setRegion(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <WeatherMap
          center={[-96, 38]}
          zoom={3.2}
          label={`${r.label} ${p.label} map`}
          className="h-[58dvh] min-h-80"
          onReady={onReady}
        />
        <span className={s.stamp}>
          {r.label} · {p.label}
        </span>
        {loaded[cur] !== "ok" && (
          <span className={s.wait}>
            {loaded[cur] === "err"
              ? "This hour isn't in the run."
              : "Rendering from NOAA's data…"}
          </span>
        )}
      </div>
      <div className={s.player}>
        <div className={s.buttons}>
          <button
            type="button"
            aria-label="Previous hour"
            onClick={() => (setPlaying(false), setI((k) => Math.max(0, k - 1)))}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className={s.play}
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </button>
          <button
            type="button"
            aria-label="Next hour"
            onClick={() => (
              setPlaying(false),
              setI((k) => Math.min(urls.length - 1, k + 1))
            )}
          >
            <ChevronRight className="size-4" />
          </button>
          <span className={s.hour}>
            <b>{fh ? `Forecast hour ${fh}` : "Analysis (F000)"}</b>
            <small>Valid {validLabel(cycle, fh)}</small>
          </span>
        </div>
        <div className={s.speed} role="group" aria-label="Speed">
          {(Object.keys(SPEED) as (keyof typeof SPEED)[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === speed}
              onClick={() => setSpeed(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={urls.length - 1}
          value={i}
          onChange={(e) => (setPlaying(false), setI(+e.target.value))}
          aria-label="Forecast hour"
        />
        <div className={s.ends}>
          <span>F{String(r.hours[0]).padStart(3, "0")}</span>
          <span>
            {done < urls.length ? `${done}/${urls.length} frames ready` : ""}
          </span>
          <span>F{String(r.hours[r.hours.length - 1]).padStart(3, "0")}</span>
        </div>
      </div>
      <div className={s.legend}>
        <small>
          {p.label}
          {p.unit ? ` (${p.unit})` : ""}
        </small>
        <div
          className={s.bar}
          style={{
            background: `linear-gradient(to right, ${p.colors.join(", ")})`,
          }}
        />
        <div className={s.ticks}>
          {p.levels.map((v, k) => (
            <span key={k}>{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
