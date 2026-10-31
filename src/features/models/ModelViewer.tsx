"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageSource, Map as MaplibreMap } from "maplibre-gl";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import s from "./Models.module.css";

type P = {
  key: string;
  label: string;
  group: string;
  unit: string;
  levels: number[];
  full: boolean;
  colors: string[];
};
type Run = {
  label: string;
  res: string;
  cycles: string[];
  hours: number[];
  regions: { id: string; label: string; b: number[] }[];
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
const corners = (b: number[]) =>
  [
    [b[0], b[3]],
    [b[2], b[3]],
    [b[2], b[1]],
    [b[0], b[1]],
  ] as [[number, number], [number, number], [number, number], [number, number]];

/**
 * VIP's Model Runs, on our own map: pick a model, a run, a field and a region; the frames
 * are rendered from NOAA's GRIB2 on demand (/api/models/map) and play as a loop. Frames
 * preload ahead of the playhead, and playback waits for a frame rather than skipping it.
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

  // Preload every frame, a few at a time, so the loop never waits long.
  useEffect(() => {
    if (!urls.length) return;
    let live = true;
    let next = 0;
    const one = () => {
      const u = urls[next++];
      if (!u || !live) return;
      const img = new Image();
      img.onload = () => {
        if (live) setLoaded((m) => ({ ...m, [u]: "ok" }));
        one();
      };
      img.onerror = () => {
        if (live) setLoaded((m) => ({ ...m, [u]: "err" }));
        one();
      };
      img.src = u;
    };
    for (let k = 0; k < 3; k++) one();
    return () => {
      live = false;
    };
  }, [urls]);

  const cur = urls[Math.min(i, urls.length - 1)];
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !cur || !reg || loaded[cur] !== "ok") return;
    const src = m.getSource("model") as ImageSource | undefined;
    if (src) src.updateImage({ url: cur, coordinates: corners(reg.b) });
    else {
      m.addSource("model", {
        type: "image",
        url: cur,
        coordinates: corners(reg.b),
      });
      const label = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
      m.addLayer(
        {
          id: "model",
          type: "raster",
          source: "model",
          paint: { "raster-opacity": 0.82, "raster-fade-duration": 0 },
        },
        label,
      );
    }
  }, [cur, ready, reg, loaded]);

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
  const detail =
    !playing && view && cur ? `${cur}&bbox=${view.join(",")}` : null;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const src = m.getSource("model-detail") as ImageSource | undefined;
    if (!detail || !view) {
      if (m.getLayer("model-detail"))
        m.setLayoutProperty("model-detail", "visibility", "none");
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (src) src.updateImage({ url: detail, coordinates: corners(view) });
      else {
        m.addSource("model-detail", {
          type: "image",
          url: detail,
          coordinates: corners(view),
        });
        const label = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
        m.addLayer(
          {
            id: "model-detail",
            type: "raster",
            source: "model-detail",
            paint: { "raster-opacity": 0.82, "raster-fade-duration": 0 },
          },
          label,
        );
      }
      m.setLayoutProperty("model-detail", "visibility", "visible");
    };
    img.src = detail;
    return () => {
      img.onload = null;
    };
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

  const onReady = ({ map: any }: ReadyMap) => {
    map.current = any as unknown as MaplibreMap;
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
        <div className={s.bar}>
          {p.colors.map((c, k) => (
            <i key={k} style={{ background: c }} />
          ))}
        </div>
        <div className={s.ticks}>
          {(p.full ? ["<", ...p.levels] : p.levels).map((v, k) => (
            <span key={k}>{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
