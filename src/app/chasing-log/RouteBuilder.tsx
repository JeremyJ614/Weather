"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { CalendarDays, Undo2, X } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { zoneAt } from "@/features/replay/core/timezone";
import {
  routeLeg,
  straightLeg,
  type RouteLeg,
} from "@/features/replay/import/routing";
import {
  drawnTrack,
  MAX_STOPS,
  timeRoute,
  type RouteStop,
} from "@/features/replay/import/route";
import type { ParsedTrack } from "@/features/replay/import/types";
import { dayStorms, type DayStorms } from "@/features/replay/import/sources";
import s from "./ChaseLog.module.css";

const keyOf = (a: RouteStop, b: RouteStop) =>
  `${a.lon.toFixed(5)},${a.lat.toFixed(5)};${b.lon.toFixed(5)},${b.lat.toFixed(5)}`;
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const today = () => new Date().toLocaleDateString("en-CA");
const EFS = ["EFU", "EF0", "EF1", "EF2", "EF3", "EF4", "EF5"];
const KINDS = ["wind", "hail", "funnel", "tornado"] as const;
const longDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Draw a chase by hand (owner #18): tap the route on the map stop by stop, give the first
 * and last stops the times the chase began and ended (and any stop between a time you
 * remember), and the drive is timed and laid on the roads. The finished route goes through
 * the same survey lookup as a recorded track. Whatever date is set, that day's surveyed
 * tornado tracks and storm reports are drawn under the route (Fix-It #16): with `dateFirst`
 * the day is picked before the map opens, so the route is drawn among that day's storms.
 */
export function RouteBuilder({
  color,
  ef,
  report,
  dateFirst = false,
  onDone,
}: {
  /** The chaser's track color on the replay. */
  color: string;
  /** Tornado track colors by rating, and storm report colors by kind. */
  ef: (k: string) => string;
  report: (k: string) => string;
  dateFirst?: boolean;
  onDone: (track: ParsedTrack) => void;
}) {
  const [date, setDate] = useState(dateFirst ? "" : today());
  const [day, setDay] = useState<{
    date: string;
    v: DayStorms | "error";
  } | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [roads, setRoads] = useState(true);
  const [roadLegs, setRoadLegs] = useState<Record<string, RouteLeg>>({});
  const asked = useRef(new Set<string>());
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);

  const pairs = useMemo(
    () => stops.slice(1).map((b, i) => [stops[i], b] as const),
    [stops],
  );
  // Each leg follows the roads once a router answers; until then it is drawn straight.
  useEffect(() => {
    if (!roads) return;
    for (const [a, b] of pairs) {
      const k = keyOf(a, b);
      if (asked.current.has(k)) continue;
      asked.current.add(k);
      void routeLeg(a, b).then((l) => setRoadLegs((r) => ({ ...r, [k]: l })));
    }
  }, [pairs, roads]);
  const legs = pairs.map(([a, b]) =>
    roads ? (roadLegs[keyOf(a, b)] ?? null) : straightLeg(a, b),
  );
  const pending = legs.some((l) => l === null);
  const drawn = legs.map((l, i) => l ?? straightLeg(pairs[i][0], pairs[i][1]));
  const zone =
    (stops[0] && zoneAt(stops[0].lat, stops[0].lon)) || "America/Chicago";
  const route = useMemo(
    () => timeRoute(stops, drawn, date, zone),
    // `drawn` is rebuilt every render; the legs it comes from are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stops, roadLegs, roads, date, zone],
  );

  // The chosen day's storms, nationwide, once per date.
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today();
  useEffect(() => {
    if (!valid) return;
    const ac = new AbortController();
    dayStorms(date, { signal: ac.signal })
      .then((v) => setDay({ date, v }))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setDay({ date, v: "error" });
      });
    return () => ac.abort();
  }, [date, valid]);
  const storms = day?.date === date && day.v !== "error" ? day.v : null;

  // Draw the day's storms under the route, and frame them while no route is drawn yet.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const tracks = storms?.tracks ?? [];
    const reports = storms?.reports ?? [];
    (m.getSource("day-tracks") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: tracks.map((t) => ({
        type: "Feature",
        properties: { ef: t.ef },
        geometry: { type: "LineString", coordinates: t.coords },
      })),
    });
    (m.getSource("day-reports") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: [...reports]
        .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))
        .map((r) => ({
          type: "Feature",
          properties: { kind: r.kind },
          geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        })),
    });
    if (stops.length || !storms) return;
    // Tornadoes first: they're where the chase was. Reports otherwise.
    const pts = tracks.length
      ? tracks.flatMap((t) => t.coords)
      : reports.map((r) => [r.lon, r.lat] as [number, number]);
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    m.fitBounds(
      [
        [Math.min(...xs) - 0.3, Math.min(...ys) - 0.3],
        [Math.max(...xs) + 0.3, Math.max(...ys) + 0.3],
      ],
      { padding: 36, maxZoom: 8, duration: 900 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reframe only when the day changes
  }, [ready, storms]);

  // The map draws the route and its numbered stops.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("rt-line") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: drawn.map((l, i) => ({
        type: "Feature",
        properties: { pending: legs[i] === null ? 1 : 0 },
        geometry: { type: "LineString", coordinates: l.geometry },
      })),
    });
    (m.getSource("rt-stops") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: stops.map((p, i) => ({
        type: "Feature",
        properties: { n: String(i + 1), timed: p.clock ? 1 : 0 },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stops, roadLegs, roads]);

  const onReady = ({ map: any, provider }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    m.addSource("day-tracks", { type: "geojson", data: EMPTY });
    m.addSource("day-reports", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "day-reports",
      type: "circle",
      source: "day-reports",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 9, 5],
        "circle-color": [
          "match",
          ["get", "kind"],
          ...KINDS.flatMap((k) => [k, report(k)]),
          report("wind"),
        ] as never,
        "circle-opacity": 0.85,
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 0.5,
      },
    });
    m.addLayer({
      id: "day-tracks",
      type: "line",
      source: "day-tracks",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": [
          "match",
          ["get", "ef"],
          ...EFS.flatMap((k) => [k, ef(k)]),
          ef("EFU"),
        ] as never,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2, 10, 5],
      },
    });
    m.addSource("rt-line", { type: "geojson", data: EMPTY });
    m.addSource("rt-stops", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "rt-line",
      type: "line",
      source: "rt-line",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-width": 4,
        "line-opacity": ["case", ["==", ["get", "pending"], 1], 0.45, 0.95],
      },
    });
    m.addLayer({
      id: "rt-stops",
      type: "circle",
      source: "rt-stops",
      paint: {
        "circle-radius": 11,
        "circle-color": "#0b0c14",
        "circle-stroke-color": color,
        "circle-stroke-width": ["case", ["==", ["get", "timed"], 1], 3, 1.5],
      },
    });
    m.addLayer({
      id: "rt-num",
      type: "symbol",
      source: "rt-stops",
      layout: {
        "text-field": ["get", "n"],
        "text-font":
          provider === "mapbox"
            ? ["DIN Pro Medium", "Arial Unicode MS Regular"]
            : ["Noto Sans Regular"],
        "text-size": 11,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": color },
    });
    m.on("click", (e) =>
      setStops((p) =>
        p.length >= MAX_STOPS
          ? p
          : [
              ...p,
              {
                lat: Math.round(e.lngLat.lat * 1e5) / 1e5,
                lon: Math.round(e.lngLat.lng * 1e5) / 1e5,
                clock: "",
              },
            ],
      ),
    );
    map.current = m;
    setReady(true);
  };

  const setClock = (i: number, clock: string) =>
    setStops((p) => p.map((x, j) => (j === i ? { ...x, clock } : x)));
  const time = (t: number | null) =>
    t === null
      ? ""
      : new Date(t * 1000).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: zone,
        });
  const first = route.times[0];
  const last = route.times[route.times.length - 1];

  const status = !valid
    ? null
    : day?.date !== date
      ? "Loading that day's storms…"
      : day.v === "error"
        ? "That day's storms couldn't be loaded; you can still draw the route."
        : `${longDay(date)}: ${day.v.tracks.length} surveyed ${day.v.tracks.length === 1 ? "tornado" : "tornadoes"}, ${day.v.reports.length} storm ${day.v.reports.length === 1 ? "report" : "reports"}.`;

  if (dateFirst && !valid)
    return (
      <div className={s.builder}>
        <label className={s.dayPick}>
          <CalendarDays className="size-6" aria-hidden />
          <span>
            <b>Pick the day you chased</b>
            <small>
              That day&apos;s tornado tracks and storm reports load on the map,
              then you draw your route among them.
            </small>
          </span>
          <input
            type="date"
            value={date}
            max={today()}
            min="2011-01-01"
            onChange={(e) => setDate(e.target.value)}
            aria-label="Chase date"
          />
        </label>
      </div>
    );

  return (
    <div className={s.builder}>
      <p className={s.small}>
        Tap the map where you drove, in order. Give the first stop the time you
        set off and the last the time you finished; add a time at any other stop
        you remember one for. The rest are timed for you. The day&apos;s
        surveyed tornado tracks and storm reports are drawn underneath.
      </p>
      <div className={s.builderRow}>
        <label className={s.field}>
          <span>Date</span>
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {status && (
          <p className={s.small} aria-live="polite">
            {status}
          </p>
        )}
        <label className={s.check}>
          <input
            type="checkbox"
            checked={roads}
            onChange={(e) => setRoads(e.target.checked)}
          />
          Follow the roads
        </label>
      </div>
      <div className={s.mapBox}>
        <WeatherMap
          center={[-97.5, 37.5]}
          zoom={3.6}
          label="Tap to add the next stop on your route"
          className="h-[52dvh] min-h-80"
          onReady={onReady}
        />
        {stops.length > 0 && (
          <div className={s.mapTools}>
            <button
              type="button"
              onClick={() => setStops((p) => p.slice(0, -1))}
              aria-label="Remove the last stop"
            >
              <Undo2 className="size-4" aria-hidden /> Undo
            </button>
          </div>
        )}
      </div>

      {stops.length > 0 && (
        <ol className={s.stops}>
          {stops.map((p, i) => (
            <li key={`${i}-${p.lat}-${p.lon}`} className={s.stop}>
              <span
                className={s.stopNum}
                data-timed={p.clock ? true : undefined}
              >
                {i + 1}
              </span>
              <span className={s.stopText}>
                <b>
                  {i === 0
                    ? "Set off"
                    : i === stops.length - 1 && stops.length > 1
                      ? "Finished"
                      : `Stop ${i + 1}`}
                </b>
                <small>
                  {!p.clock && route.times[i] !== null
                    ? `About ${time(route.times[i])} · `
                    : ""}
                  {p.lat.toFixed(3)}, {p.lon.toFixed(3)}
                </small>
              </span>
              <input
                type="time"
                className={s.stopTime}
                value={p.clock}
                aria-label={`Time at stop ${i + 1}`}
                onChange={(e) => setClock(i, e.target.value)}
              />
              <button
                type="button"
                className={s.stopDel}
                aria-label={`Remove stop ${i + 1}`}
                onClick={() => setStops((q) => q.filter((_, j) => j !== i))}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}

      {stops.length > 1 && (
        <dl className={s.facts}>
          <div>
            <dt>Stops</dt>
            <dd>{stops.length}</dd>
          </div>
          <div>
            <dt>Drive</dt>
            <dd>{route.miles.toFixed(0)} mi</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{time(first) || "–"}</dd>
          </div>
          <div>
            <dt>To</dt>
            <dd>{time(last) || "–"}</dd>
          </div>
        </dl>
      )}
      {stops.length > 0 && route.problems.length > 0 && (
        <ul className={s.warns}>
          {route.problems.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <div className={s.actions}>
        <button
          type="button"
          className={s.primary}
          disabled={pending || route.problems.length > 0 || !route.fixes.length}
          onClick={() => onDone(drawnTrack(route, drawn))}
        >
          {pending ? "Finding the roads…" : "Find the storms on this route"}
        </button>
      </div>
    </div>
  );
}
