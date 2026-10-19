"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { Medal, Pause, Play, RotateCcw } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { ROSTER, type Score } from "@/lib/tropical/atcf";
import { mph, tierOf } from "@/lib/tropical/style";
import s from "./ModelBattle.module.css";

type Track = {
  tech: string;
  dtg: string;
  points: { tau: number; lat: number; lon: number; kt: number }[];
};
type Data = {
  tracks: Track[];
  best: { lat: number; lon: number; kt: number; dtg: string }[];
  board: Score[];
  cycles: number;
};
type StormPick = { id: string; title: string; lat: number; lon: number };

const MI = 1.15078;
const name = new Map(ROSTER.map((m) => [m.tech, m]));
const cycleTime = (dtg: string) =>
  new Date(
    Date.UTC(
      +dtg.slice(0, 4),
      +dtg.slice(4, 6) - 1,
      +dtg.slice(6, 8),
      +dtg.slice(8, 10),
    ),
  ).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "numeric",
  }) + " CT";
const EMPTY = { type: "FeatureCollection" as const, features: [] };
const dtgMs = (dtg: string) =>
  Date.UTC(
    +dtg.slice(0, 4),
    +dtg.slice(4, 6) - 1,
    +dtg.slice(6, 8),
    +dtg.slice(8, 10),
  );
const SPEEDS = { Slow: 900, Normal: 550, Fast: 280 } as const;
const STEP = 3;

/** Where a track is `h` hours after the race starts (its own clock is offset by `off`). */
function at(t: Track, h: number, off: number) {
  const tau = h - off;
  const p = t.points;
  if (!p.length || tau < p[0].tau) return null;
  if (tau >= p[p.length - 1].tau) return { ...p[p.length - 1], done: true };
  let k = 0;
  while (p[k + 1].tau < tau) k++;
  const a = p[k];
  const b = p[k + 1];
  const f = (tau - a.tau) / (b.tau - a.tau || 1);
  return {
    tau,
    lat: a.lat + (b.lat - a.lat) * f,
    lon: a.lon + (b.lon - a.lon) * f,
    kt: a.kt && b.kt ? a.kt + (b.kt - a.kt) * f : a.kt || b.kt,
    done: false,
  };
}

/** Model Tracks: every model's newest track, and who has been closest so far. */
export function ModelBattle({
  storms,
  colors,
}: {
  storms: StormPick[];
  colors: Colors;
}) {
  const [id, setId] = useState(storms[0]?.id);
  const [data, setData] = useState<Data | "error" | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [h, setH] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>("Fast");
  // Follow the storm by default; "every track" fits the whole spread of models.
  const [cam, setCam] = useState<"follow" | "all">("follow");
  const col = (tech: string) =>
    pick(colors, `model:${tech}`, name.get(tech)?.color ?? "#888888");

  useEffect(() => {
    if (!id) return;
    let live = true;
    queueMicrotask(() => live && setData(null));
    fetch(`/api/tropical/models?storm=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Data) => {
        if (!live) return;
        setData(d);
        setH(0);
        setPlaying(!matchMedia("(prefers-reduced-motion: reduce)").matches);
      })
      .catch(() => live && setData("error"));
    return () => {
      live = false;
    };
  }, [id]);

  // The race clock runs from the newest cycle; older cycles' tracks are offset to match.
  const dd = data && data !== "error" ? data : null;
  const start = dd?.tracks.length
    ? Math.max(...dd.tracks.map((t) => dtgMs(t.dtg)))
    : 0;
  const offOf = (t: Track) => (dtgMs(t.dtg) - start) / 3600_000;
  const end = dd
    ? Math.max(
        0,
        ...dd.tracks.map((t) => (t.points.at(-1)?.tau ?? 0) + offOf(t)),
      )
    : 0;
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setH((x) => {
        if (x + STEP > end) {
          setPlaying(false);
          return end;
        }
        return x + STEP;
      });
    }, SPEEDS[speed]);
    return () => clearInterval(t);
  }, [playing, speed, end]);

  // Draw (or redraw) the tracks whenever the data, the hidden models or the map change.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const d = data && data !== "error" ? data : null;
    const lines = d
      ? d.tracks
          .filter((t) => !hidden.has(t.tech))
          .map((t) => {
            const off = offOf(t);
            const head = at(t, h, off);
            const pts = t.points
              .filter((p) => p.tau + off <= h)
              .map((p) => [p.lon, p.lat]);
            if (head && !head.done) pts.push([head.lon, head.lat]);
            return {
              type: "Feature" as const,
              properties: {
                tech: t.tech,
                color: col(t.tech),
                official: t.tech === "OFCL" ? 1 : 0,
              },
              geometry: {
                type: "LineString" as const,
                coordinates: pts.length > 1 ? pts : [],
              },
            };
          })
          .filter((f) => f.geometry.coordinates.length)
      : [];
    const heads = d
      ? d.tracks
          .filter((t) => !hidden.has(t.tech))
          .flatMap((t) => {
            const p = at(t, h, offOf(t));
            return p
              ? [
                  {
                    type: "Feature" as const,
                    properties: { color: col(t.tech), done: p.done ? 1 : 0 },
                    geometry: {
                      type: "Point" as const,
                      coordinates: [p.lon, p.lat],
                    },
                  },
                ]
              : [];
          })
      : [];
    (m.getSource("heads") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: heads,
    });
    const best = d?.best.length
      ? [
          {
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: d.best.map((p) => [p.lon, p.lat]),
            },
          },
        ]
      : [];
    (m.getSource("models") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: lines,
    });
    (m.getSource("best") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: best,
    });
    // col depends only on colors, which never change on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hidden, ready, h]);

  // The camera: on the storm, moving with the models' middle position as the race plays.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const d = data && data !== "error" ? data : null;
    const shown = (d?.tracks ?? []).filter((t) => !hidden.has(t.tech));
    if (cam === "all") {
      const pts = shown.flatMap((t) => t.points.map((p) => [p.lon, p.lat]));
      if (!pts.length) return;
      const xs = pts.map((c) => c[0]);
      const ys = pts.map((c) => c[1]);
      m.fitBounds(
        [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        { padding: 36, duration: 700, maxZoom: 6 },
      );
      return;
    }
    const heads = shown
      .map((t) => at(t, h, (dtgMs(t.dtg) - start) / 3600_000))
      .filter((x): x is NonNullable<typeof x> => !!x && !x.done);
    const mid = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1];
    const here = storms.find((x) => x.id === id);
    const center: [number, number] = heads.length
      ? [mid(heads.map((x) => x.lon)), mid(heads.map((x) => x.lat))]
      : here
        ? [here.lon, here.lat]
        : [-75, 25];
    m.easeTo({
      center,
      zoom: 5.2,
      duration: playing ? Math.min(SPEEDS[speed], 700) : 700,
    });
    // start/speed/playing only tune the glide; h and the data drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, cam, data, hidden, ready, id]);

  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    m.addSource("models", { type: "geojson", data: EMPTY });
    m.addSource("best", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "best",
      type: "line",
      source: "best",
      paint: {
        "line-color": "#c9cbd6",
        "line-width": 3,
        "line-dasharray": [1, 1.5],
        "line-opacity": 0.8,
      },
    });
    m.addLayer({
      id: "models",
      type: "line",
      source: "models",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["case", ["==", ["get", "official"], 1], 4, 2],
        "line-opacity": 0.9,
      },
    });
    m.addSource("heads", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "heads",
      type: "circle",
      source: "heads",
      paint: {
        "circle-radius": ["case", ["==", ["get", "done"], 1], 3, 5],
        "circle-color": ["get", "color"],
        "circle-stroke-color":
          getComputedStyle(document.documentElement)
            .getPropertyValue("--bg")
            .trim() || "#0b0c14",
        "circle-stroke-width": 1.5,
        "circle-opacity": ["case", ["==", ["get", "done"], 1], 0.6, 1],
      },
    });
    map.current = m;
    setReady(true);
  };

  if (!storms.length)
    return (
      <p className={s.empty}>
        The battle starts when a storm is active: no storms in the Atlantic or
        Pacific right now.
      </p>
    );
  const d = data && data !== "error" ? data : null;
  const board = d?.board.filter((x) => x.track[24] || x.track[48]) ?? [];
  const scored = board.filter(
    (x) => (x.track[48]?.n ?? 0) >= 2 || (x.track[24]?.n ?? 0) >= 2,
  );
  const cliper = board.find((x) => x.tech === "CLP5");
  // Compare with the baseline at the same lead time: 48 hours once it can be scored.
  const lead = (cliper?.track[48]?.n ?? 0) >= 2 ? 48 : 24;
  const bar = cliper?.track[lead]?.err;
  const s0 = storms.find((x) => x.id === id)!;

  return (
    <div className="grid gap-3">
      {storms.length > 1 && <small className={s.label}>Storm</small>}
      {storms.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Storm">
          {storms.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === id}
              onClick={() => setId(x.id)}
              className="min-h-9 rounded-full border border-line px-3 text-xs font-semibold aria-pressed:border-[var(--lit-line)] aria-pressed:bg-[var(--lit)] aria-pressed:text-accent"
            >
              {x.title}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <WeatherMap
          center={[s0.lon, s0.lat]}
          zoom={4}
          label="Model tracks"
          className="h-[52dvh] min-h-72"
          onReady={onReady}
        />
        {d && start > 0 && (
          <div className={s.clock} aria-live="off">
            <b>
              {new Date(start + h * 3600_000)
                .toLocaleString("en-US", {
                  weekday: "short",
                  hour: "numeric",
                  timeZoneName: "short",
                })
                .toUpperCase()}
            </b>
            <small>Forecast hour +{h}</small>
          </div>
        )}
      </div>
      {d && (
        <div className={s.player}>
          <button
            type="button"
            className={s.play}
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              if (!playing && h >= end) setH(0);
              setPlaying(!playing);
            }}
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </button>
          <button
            type="button"
            aria-label="Restart"
            onClick={() => (setH(0), setPlaying(true))}
          >
            <RotateCcw className="size-4" />
          </button>
          <input
            type="range"
            min={0}
            max={end}
            step={STEP}
            value={h}
            onChange={(e) => (setPlaying(false), setH(+e.target.value))}
            aria-label="Forecast hour"
          />
          <div className={s.speed} role="group" aria-label="Camera">
            {(
              [
                ["follow", "Follow storm"],
                ["all", "Every track"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={cam === k}
                onClick={() => setCam(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={s.speed} role="group" aria-label="Speed">
            {(Object.keys(SPEEDS) as (keyof typeof SPEEDS)[]).map((k) => (
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
        </div>
      )}
      {d && (
        <Intensity
          d={d}
          h={h}
          hidden={hidden}
          col={col}
          colors={colors}
          offOf={offOf}
        />
      )}
      <small className={s.label}>Models · tap one to hide or show it</small>
      <div className={s.chips} role="group" aria-label="Show models">
        {(d?.tracks ?? []).map((t) => (
          <button
            key={t.tech}
            type="button"
            aria-pressed={!hidden.has(t.tech)}
            onClick={() => {
              const n = new Set(hidden);
              if (n.has(t.tech)) n.delete(t.tech);
              else n.add(t.tech);
              setHidden(n);
            }}
            style={{ ["--c" as string]: col(t.tech) }}
          >
            <i />
            {name.get(t.tech)?.name ?? t.tech}
          </button>
        ))}
        {d && d.best.length > 0 && (
          <span className={s.bestKey}>
            <i /> Where it went
          </span>
        )}
      </div>
      {data === "error" && (
        <p className={s.empty}>
          NHC&apos;s model data isn&apos;t answering right now. Try again soon.
        </p>
      )}
      {!data && <p className={s.empty}>Loading every model&apos;s forecast…</p>}
      {d && (
        <section className={s.board}>
          <header>
            <h3>Leaderboard</h3>
            <small>
              Average miles off, scored on {d.cycles} NHC forecast cycles ·
              newest NHC forecast{" "}
              {d.tracks[0] ? cycleTime(d.tracks[0].dtg) : "–"}
            </small>
          </header>
          {scored.length < 3 ? (
            <p className={s.empty}>
              Too early to score: a model&apos;s forecast can only be checked
              once the storm reaches that time, so the battle needs about two
              days of history. The tracks above are live now.
            </p>
          ) : (
            <>
              <ol className={s.podium}>
                {scored.slice(0, 3).map((x, i) => (
                  <li
                    key={x.tech}
                    style={{ ["--c" as string]: col(x.tech) }}
                    data-place={i + 1}
                  >
                    <Medal aria-hidden />
                    <b>{name.get(x.tech)?.name}</b>
                    <span>
                      {Math.round((x.track[48] ?? x.track[24])!.err * MI)} mi at{" "}
                      {x.track[48] && x.track[48].n >= 2 ? 48 : 24} h
                    </span>
                  </li>
                ))}
              </ol>
              <div className="overflow-x-auto">
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Model</th>
                      <th>24 h</th>
                      <th>48 h</th>
                      <th>72 h</th>
                      <th>Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.map((x, i) => {
                      const e48 = x.track[lead]?.err;
                      const worse =
                        bar != null &&
                        e48 != null &&
                        x.tech !== "CLP5" &&
                        e48 > bar;
                      return (
                        <tr
                          key={x.tech}
                          data-base={x.tech === "CLP5" || undefined}
                        >
                          <td>{i + 1}</td>
                          <td>
                            <span
                              className={s.model}
                              style={{ ["--c" as string]: col(x.tech) }}
                            >
                              <i />
                              {name.get(x.tech)?.name}
                            </span>
                            <small>
                              {x.tech === "CLP5"
                                ? "the bar to beat"
                                : worse
                                  ? "behind the baseline"
                                  : name.get(x.tech)?.note}
                            </small>
                          </td>
                          {([24, 48, 72] as const).map((h) => (
                            <td key={h}>
                              {x.track[h]
                                ? `${Math.round(x.track[h]!.err * MI)}`
                                : "–"}
                            </td>
                          ))}
                          <td>{x.wins}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className={s.note}>
                Miles between each model&apos;s forecast position and the
                storm&apos;s real position at that time (NHC best track),
                averaged over every forecast that can be checked so far. Wins:
                forecast cycles where the model had the closest 48-hour
                position. Google DeepMind is the AI model NHC now runs beside
                the physics models.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** Live intensity leaderboard: every model's sustained wind at the race clock. */
function Intensity({
  d,
  h,
  hidden,
  col,
  colors,
  offOf,
}: {
  d: Data;
  h: number;
  hidden: Set<string>;
  col: (tech: string) => string;
  colors: Colors;
  offOf: (t: Track) => number;
}) {
  const rows = d.tracks
    .filter((t) => !hidden.has(t.tech))
    .map((t) => ({ t, p: at(t, h, offOf(t)) }))
    .filter((r) => r.p && r.p.kt > 0)
    .map((r) => ({ tech: r.t.tech, kt: r.p!.kt, done: r.p!.done }))
    .sort((a, b) => b.kt - a.kt);
  if (!rows.length) return null;
  const top = Math.max(...rows.map((r) => r.kt));
  return (
    <section className={s.intensity}>
      <header>
        <h3>Intensity leaderboard</h3>
        <small>Sustained wind by forecast model at hour +{h}</small>
      </header>
      <ol>
        {rows.map((r, i) => {
          const tier = tierOf(r.kt);
          const tc = pick(colors, `trop:${tier.key}`, tier.color);
          return (
            <li key={r.tech} data-done={r.done || undefined}>
              <span className={s.rank}>{i + 1}</span>
              <span
                className={s.model}
                style={{ ["--c" as string]: col(r.tech) }}
              >
                <i />
                {name.get(r.tech)?.name ?? r.tech}
              </span>
              <span className={s.windBar}>
                <u
                  style={{
                    background: tc,
                    transform: `scaleX(${r.kt / top})`,
                  }}
                />
              </span>
              <b>{mph(r.kt)}</b>
              <em style={{ color: tc, borderColor: tc }}>{tier.short}</em>
            </li>
          );
        })}
      </ol>
      <p className={s.note}>
        Wind in mph. A dimmed row is a model whose forecast has ended. Guidance
        only, not an official NHC forecast.
      </p>
    </section>
  );
}
