"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { Medal } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { ROSTER, type Score } from "@/lib/tropical/atcf";
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

/** Model Battle Royale: every model's newest track, and who has been closest so far. */
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
  const col = (tech: string) =>
    pick(colors, `model:${tech}`, name.get(tech)?.color ?? "#888888");

  useEffect(() => {
    if (!id) return;
    let live = true;
    queueMicrotask(() => live && setData(null));
    fetch(`/api/tropical/models?storm=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Data) => live && setData(d))
      .catch(() => live && setData("error"));
    return () => {
      live = false;
    };
  }, [id]);

  // Draw (or redraw) the tracks whenever the data, the hidden models or the map change.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const d = data && data !== "error" ? data : null;
    const lines = d
      ? d.tracks
          .filter((t) => !hidden.has(t.tech))
          .map((t) => ({
            type: "Feature" as const,
            properties: {
              tech: t.tech,
              color: col(t.tech),
              official: t.tech === "OFCL" ? 1 : 0,
            },
            geometry: {
              type: "LineString" as const,
              coordinates: t.points.map((p) => [p.lon, p.lat]),
            },
          }))
      : [];
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
    const all = [...lines, ...best].flatMap((f) => f.geometry.coordinates);
    if (all.length) {
      const xs = all.map((c) => c[0]);
      const ys = all.map((c) => c[1]);
      m.fitBounds(
        [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        { padding: 36, duration: 700, maxZoom: 6 },
      );
    }
    // col depends only on colors, which never change on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, hidden, ready]);

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
      <WeatherMap
        center={[s0.lon, s0.lat]}
        zoom={4}
        label="Model tracks"
        className="h-[52dvh] min-h-72"
        onReady={onReady}
      />
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
