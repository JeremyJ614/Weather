"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { Sparkles } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { ROSTER, type Run, type Score } from "@/lib/tropical/atcf";
import s from "./ModelBattle.module.css";

type Data = {
  runs: Run[];
  ofcl: Run | null;
  gap: { tau: number; nm: number; ai: number; nhc: number }[];
  place: number;
  of: number;
  ai: Score | null;
  nhc: Score | null;
  best: { lat: number; lon: number }[];
};
type StormPick = { id: string; title: string; lat: number; lon: number };
const MI = 1.15078;
const def = (t: string) => ROSTER.find((m) => m.tech === t)!.color;
const run = (dtg: string) =>
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
const line = (coords: number[][], props: Record<string, unknown>) => ({
  type: "Feature" as const,
  properties: props,
  geometry: { type: "LineString" as const, coordinates: coords },
});

/** Google DeepMind's cyclone model beside NHC's forecast: its runs, the gap, its record. */
export function GoogleAi({
  storms,
  colors,
}: {
  storms: StormPick[];
  colors: Colors;
}) {
  const [id, setId] = useState(storms[0]?.id);
  const [data, setData] = useState<Data | "error" | null>(null);
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const aiC = pick(colors, "model:GDMN", def("GDMN"));
  const nhcC = pick(colors, "model:OFCL", def("OFCL"));

  useEffect(() => {
    if (!id) return;
    let live = true;
    queueMicrotask(() => live && setData(null));
    fetch(`/api/tropical/ai?storm=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Data) => live && setData(d))
      .catch(() => live && setData("error"));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !data || data === "error") return;
    const n = data.runs.length;
    const features = [
      ...data.runs.map((r, i) =>
        line(
          r.points.map((p) => [p.lon, p.lat]),
          {
            color: aiC,
            w: i === n - 1 ? 4 : 1.5,
            o: i === n - 1 ? 1 : 0.25 + (0.45 * i) / Math.max(1, n - 1),
          },
        ),
      ),
      ...(data.ofcl
        ? [
            line(
              data.ofcl.points.map((p) => [p.lon, p.lat]),
              { color: nhcC, w: 3, o: 0.9 },
            ),
          ]
        : []),
    ];
    (m.getSource("ai") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features,
    });
    (m.getSource("ai-best") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features:
        data.best.length > 1
          ? [
              line(
                data.best.map((p) => [p.lon, p.lat]),
                {},
              ),
            ]
          : [],
    });
    const all = features.flatMap((f) => f.geometry.coordinates);
    if (all.length)
      m.fitBounds(
        [
          [
            Math.min(...all.map((c) => c[0])),
            Math.min(...all.map((c) => c[1])),
          ],
          [
            Math.max(...all.map((c) => c[0])),
            Math.max(...all.map((c) => c[1])),
          ],
        ],
        { padding: 36, duration: 700, maxZoom: 6 },
      );
    // The colors never change on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready]);

  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    const empty = { type: "FeatureCollection" as const, features: [] };
    m.addSource("ai", { type: "geojson", data: empty });
    m.addSource("ai-best", { type: "geojson", data: empty });
    m.addLayer({
      id: "ai-best",
      type: "line",
      source: "ai-best",
      paint: {
        "line-color": "#c9cbd6",
        "line-width": 3,
        "line-dasharray": [1, 1.5],
        "line-opacity": 0.8,
      },
    });
    m.addLayer({
      id: "ai",
      type: "line",
      source: "ai",
      layout: { "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["get", "w"],
        "line-opacity": ["get", "o"],
      },
    });
    map.current = m;
    setReady(true);
  };

  if (!storms.length)
    return (
      <p className={s.empty}>
        Google DeepMind&apos;s forecasts show here while a storm is active. No
        storms right now.
      </p>
    );
  const d = data && data !== "error" ? data : null;
  const s0 = storms.find((x) => x.id === id)!;
  const err = (x: Score | null, h: 24 | 48 | 72) =>
    x?.track[h] ? Math.round(x.track[h]!.err * MI) : null;
  const far = d?.gap.at(-1);
  const peak = d ? Math.max(1, ...d.gap.flatMap((g) => [g.ai, g.nhc])) : 1;

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
        label="Google DeepMind and NHC tracks"
        className="h-[48dvh] min-h-72"
        onReady={onReady}
      />
      <div className={s.chips}>
        <span
          className={s.bestKey}
          style={{
            ["--c" as string]: aiC,
            borderStyle: "solid",
            color: "var(--text)",
          }}
        >
          <i style={{ background: aiC }} /> Google DeepMind (newest bright,
          older runs faded)
        </span>
        <span
          className={s.bestKey}
          style={{ borderStyle: "solid", color: "var(--text)" }}
        >
          <i style={{ background: nhcC }} /> NHC official
        </span>
        <span className={s.bestKey}>
          <i /> Where it went
        </span>
      </div>
      {data === "error" && (
        <p className={s.empty}>
          NHC&apos;s model data isn&apos;t answering right now. Try again soon.
        </p>
      )}
      {!data && <p className={s.empty}>Loading Google DeepMind&apos;s runs…</p>}
      {d && !d.runs.length && (
        <p className={s.empty}>
          Google DeepMind hasn&apos;t run on this storm yet.
        </p>
      )}
      {d && d.runs.length > 0 && (
        <section className={s.board}>
          <header>
            <h3 className="flex items-center gap-2">
              <Sparkles className="size-5" style={{ color: aiC }} aria-hidden />{" "}
              Google DeepMind
            </h3>
            <small>
              Newest run {run(d.runs.at(-1)!.dtg)} · {d.runs.length} recent runs
              shown
            </small>
          </header>
          <ol
            className={s.podium}
            style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            <li style={{ ["--c" as string]: aiC }}>
              <b>{d.place ? `#${d.place}` : "–"}</b>
              <span>of {d.of} models</span>
            </li>
            <li style={{ ["--c" as string]: aiC }}>
              <b>{err(d.ai, 48) ?? err(d.ai, 24) ?? "–"} mi</b>
              <span>
                avg miss at {err(d.ai, 48) != null ? 48 : 24} h · NHC{" "}
                {err(d.nhc, 48) ?? err(d.nhc, 24) ?? "–"}
              </span>
            </li>
            <li style={{ ["--c" as string]: aiC }}>
              <b>{far ? Math.round(far.nm * MI) : "–"} mi</b>
              <span>apart from NHC at {far ? `${far.tau} h` : "–"}</span>
            </li>
          </ol>
          {d.gap.length > 1 && (
            <figure className="grid gap-1">
              <figcaption className="text-xs text-muted">
                Peak winds forecast (mph), same valid times
              </figcaption>
              <svg
                viewBox="0 0 300 110"
                className="w-full"
                role="img"
                aria-label="Wind forecasts, Google DeepMind and NHC"
              >
                {(["nhc", "ai"] as const).map((k) => (
                  <polyline
                    key={k}
                    fill="none"
                    stroke={k === "ai" ? aiC : nhcC}
                    strokeWidth={k === "ai" ? 2.5 : 1.8}
                    strokeLinejoin="round"
                    points={d.gap
                      .map(
                        (g, i) =>
                          `${10 + (i * 280) / (d.gap.length - 1)},${100 - (g[k] / peak) * 88}`,
                      )
                      .join(" ")}
                  />
                ))}
                {d.gap.map((g, i) => (
                  <text
                    key={g.tau}
                    x={10 + (i * 280) / (d.gap.length - 1)}
                    y={109}
                    fontSize="7"
                    textAnchor="middle"
                    fill="var(--muted)"
                  >
                    {g.tau}h
                  </text>
                ))}
              </svg>
              <p className="flex justify-between text-xs text-muted">
                <span style={{ color: aiC }}>
                  DeepMind peak{" "}
                  {Math.round(Math.max(...d.gap.map((g) => g.ai)) * MI)} mph
                </span>
                <span>
                  NHC peak{" "}
                  {Math.round(Math.max(...d.gap.map((g) => g.nhc)) * MI)} mph
                </span>
              </p>
            </figure>
          )}
          <p className={s.note}>
            Google DeepMind&apos;s cyclone model is an AI model trained on
            decades of storms. NHC has run it beside its physics models since
            2025 and publishes its average track (GDMN), shown here. The full
            50-member spread lives on Google Weather Lab, which needs a Google
            sign-in.
          </p>
        </section>
      )}
    </div>
  );
}
