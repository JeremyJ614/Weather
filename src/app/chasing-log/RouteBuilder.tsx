"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { Undo2, X } from "lucide-react";
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
import s from "./ChaseLog.module.css";

const keyOf = (a: RouteStop, b: RouteStop) =>
  `${a.lon.toFixed(5)},${a.lat.toFixed(5)};${b.lon.toFixed(5)},${b.lat.toFixed(5)}`;
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
const today = () => new Date().toLocaleDateString("en-CA");

/**
 * Draw a chase by hand (owner #18): tap the route on the map stop by stop, give the first
 * and last stops the times the chase began and ended (and any stop between a time you
 * remember), and the drive is timed and laid on the roads. The finished route goes through
 * the same survey lookup as a recorded track.
 */
export function RouteBuilder({
  color,
  onDone,
}: {
  /** The chaser's track color on the replay. */
  color: string;
  onDone: (track: ParsedTrack) => void;
}) {
  const [date, setDate] = useState(today);
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

  return (
    <div className={s.builder}>
      <p className={s.small}>
        Tap the map where you drove, in order. Give the first stop the time you
        set off and the last the time you finished; add a time at any other stop
        you remember one for. The rest are timed for you.
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
