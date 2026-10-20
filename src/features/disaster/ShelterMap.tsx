"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import {
  Accessibility,
  BatteryCharging,
  Navigation,
  PawPrint,
  ShieldAlert,
  Users,
  Waves,
} from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { usePlaces } from "@/features/location/usePlaces";
import type { Shelter } from "@/lib/disaster/shelters";
import s from "./Disaster.module.css";

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
/** Below this zoom an area holds too many shelters to load; open ones still show. */
const MIN_ZOOM = 6.5;
const USE: Record<string, string> = {
  EVAC: "Evacuation shelter (before a storm)",
  POST: "After the storm",
  BOTH: "Before and after a storm",
};
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
  return 7917.6 * Math.asin(Math.sqrt(h));
};
const points = (list: Shelter[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: list.map((x) => ({
    type: "Feature",
    properties: { id: x.id },
    geometry: { type: "Point", coordinates: [x.lon, x.lat] },
  })),
});

/**
 * The Storm Shelter map (Disaster Response): every shelter in FEMA's shelter registry for the
 * area on screen, the ones open right now lit up, and the nearest to your place listed.
 */
export function ShelterMap({
  colors,
}: {
  colors: { open: string; registered: string };
}) {
  const { active } = usePlaces();
  const home = useMemo(
    () => (active ? { lat: active.lat, lon: active.lon } : null),
    [active],
  );
  const map = useRef<MaplibreMap | null>(null);
  const cache = useRef(new Map<string, Shelter[]>());
  const [open, setOpen] = useState<Shelter[] | "error" | null>(null);
  const [area, setArea] = useState<Shelter[]>([]);
  const [state, setState] = useState<"far" | "loading" | "ready" | "error">(
    "loading",
  );
  const [center, setCenter] = useState(home ?? { lat: 36.5, lon: -97.5 });
  const [sel, setSel] = useState<Shelter | null>(null);
  // The click handlers outlive renders; they read the open list through a ref.
  const openRef = useRef<Shelter[]>([]);
  useEffect(() => {
    openRef.current = open && open !== "error" ? open : [];
  }, [open]);

  useEffect(() => {
    let live = true;
    fetch("/api/disaster/shelters?open=1")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { shelters: Shelter[] }) => live && setOpen(j.shelters))
      .catch(() => live && setOpen("error"));
    return () => {
      live = false;
    };
  }, []);

  const all = useMemo(() => {
    const byId = new Map(area.map((x) => [x.id, x]));
    for (const x of open && open !== "error" ? open : []) byId.set(x.id, x);
    return [...byId.values()];
  }, [area, open]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    (m.getSource("shelters") as GeoJSONSource | undefined)?.setData(
      points(area),
    );
    (m.getSource("open-shelters") as GeoJSONSource | undefined)?.setData(
      points(open && open !== "error" ? open : []),
    );
  }, [area, open]);

  /** Loads the registered shelters for the area on screen, by whole degrees. */
  const load = (m: MaplibreMap) => {
    const c = m.getCenter();
    setCenter({ lat: c.lat, lon: c.lng });
    if (m.getZoom() < MIN_ZOOM) {
      setState("far");
      return;
    }
    const b = m.getBounds();
    const box = [
      Math.floor(b.getWest()),
      Math.floor(b.getSouth()),
      Math.ceil(b.getEast()),
      Math.ceil(b.getNorth()),
    ];
    if (box[2] - box[0] > 8 || box[3] - box[1] > 5) {
      setState("far");
      return;
    }
    const key = box.join(",");
    const hit = cache.current.get(key);
    if (hit) {
      setArea(hit);
      setState("ready");
      return;
    }
    setState("loading");
    fetch(`/api/disaster/shelters?bbox=${key}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { shelters: Shelter[] }) => {
        cache.current.set(key, j.shelters);
        setArea(j.shelters);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  const onReady = ({ map: any, provider }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    m.addSource("shelters", {
      type: "geojson",
      data: EMPTY,
      cluster: true,
      clusterMaxZoom: 9,
      clusterRadius: 38,
    });
    m.addSource("open-shelters", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "shelter-clusters",
      type: "circle",
      source: "shelters",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": colors.registered,
        "circle-opacity": 0.28,
        "circle-stroke-color": colors.registered,
        "circle-stroke-width": 1.5,
        "circle-radius": ["step", ["get", "point_count"], 13, 20, 17, 80, 22],
      },
    });
    m.addLayer({
      id: "shelter-count",
      type: "symbol",
      source: "shelters",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font":
          provider === "mapbox"
            ? ["DIN Pro Medium", "Arial Unicode MS Regular"]
            : ["Noto Sans Regular"],
        "text-size": 12,
      },
      paint: { "text-color": "#ffffff" },
    });
    m.addLayer({
      id: "shelter-points",
      type: "circle",
      source: "shelters",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": colors.registered,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 13, 7],
        "circle-stroke-color": "#0b0c14",
        "circle-stroke-width": 1,
      },
    });
    m.addLayer({
      id: "open-glow",
      type: "circle",
      source: "open-shelters",
      paint: {
        "circle-color": colors.open,
        "circle-radius": 16,
        "circle-blur": 1,
        "circle-opacity": 0.6,
      },
    });
    m.addLayer({
      id: "open-points",
      type: "circle",
      source: "open-shelters",
      paint: {
        "circle-color": colors.open,
        "circle-radius": 7,
        "circle-stroke-color": "#0b0c14",
        "circle-stroke-width": 1.5,
      },
    });
    const pickAt = (e: { features?: { properties?: { id?: unknown } }[] }) => {
      const id = String(e.features?.[0]?.properties?.id ?? "");
      setSel(
        (cache.current.size ? [...cache.current.values()].flat() : [])
          .concat(openRef.current)
          .find((x) => x.id === id) ?? null,
      );
    };
    m.on("click", "shelter-points", pickAt);
    m.on("click", "open-points", pickAt);
    m.on("click", "shelter-clusters", (e) => {
      m.easeTo({ center: e.lngLat, zoom: m.getZoom() + 2 });
    });
    m.on("moveend", () => load(m));
    map.current = m;
    load(m);
  };

  const near = useMemo(
    () =>
      [...all]
        .map((x) => ({ x, d: miles(home ?? center, x) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5),
    [all, home, center],
  );
  const openCount = open && open !== "error" ? open.length : 0;

  return (
    <section className={s.panel} aria-label="Storm shelters">
      <p className={s.safety}>
        <ShieldAlert aria-hidden />
        <span>
          <b>In a tornado warning, don&apos;t drive to a shelter.</b> Go to the
          lowest floor, in an interior room away from windows, right where you
          are. These are FEMA-registered emergency shelters, used for
          evacuations and after a disaster; a listed shelter isn&apos;t open
          unless it shows as open now.
        </span>
      </p>
      <div className={s.mapBox}>
        <WeatherMap
          center={[home?.lon ?? -97.5, home?.lat ?? 36.5]}
          zoom={home ? 8 : 5.6}
          label="Storm shelters"
          className="h-[52dvh] min-h-80"
          onReady={onReady}
        />
      </div>
      <p className={s.mapNote} aria-live="polite">
        <i style={{ background: colors.open }} /> Open now ({openCount}){" "}
        <i style={{ background: colors.registered }} /> Registered shelter ·{" "}
        {state === "far"
          ? "Zoom in to load every shelter in the area."
          : state === "loading"
            ? "Loading shelters…"
            : state === "error"
              ? "FEMA's shelter system isn't answering right now."
              : `${area.length.toLocaleString()} shelters in view.`}
      </p>

      {sel && (
        <article className={s.shelter}>
          <header>
            <b>{sel.name}</b>
            {sel.open && <span className={s.openTag}>Open now</span>}
          </header>
          <p className={s.addr}>{sel.addr}</p>
          <p className={s.use}>{USE[sel.use] ?? USE.BOTH}</p>
          <ul className={s.facts}>
            {(sel.evac > 0 || sel.post > 0) && (
              <li>
                <Users aria-hidden />
                Room for {Math.max(sel.evac, sel.post).toLocaleString()}
                {sel.now !== null && sel.now > 0
                  ? ` · ${sel.now.toLocaleString()} staying now`
                  : ""}
              </li>
            )}
            {sel.ada && (
              <li>
                <Accessibility aria-hidden /> Accessible
              </li>
            )}
            {sel.pets && (
              <li>
                <PawPrint aria-hidden /> Pets welcome
              </li>
            )}
            {sel.power && (
              <li>
                <BatteryCharging aria-hidden /> Generator
              </li>
            )}
            {sel.flood && (
              <li>
                <Waves aria-hidden /> In a flood or surge zone
              </li>
            )}
          </ul>
          {sel.org && <p className={s.addr}>Run by {sel.org}</p>}
          <div className={s.links}>
            <a
              className={s.lit}
              href={`https://www.google.com/maps/dir/?api=1&destination=${sel.lat},${sel.lon}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation className="size-4" aria-hidden /> Directions
            </a>
            <a
              href={`https://maps.apple.com/?daddr=${sel.lat},${sel.lon}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Apple Maps
            </a>
          </div>
        </article>
      )}

      {near.length > 0 && (
        <div className="grid gap-2">
          <p className="eyebrow">
            Nearest to{" "}
            {home ? (active?.label ?? "your place") : "the map's center"}
          </p>
          <ul className={s.nearList}>
            {near.map(({ x, d }) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSel(x);
                    map.current?.easeTo({
                      center: [x.lon, x.lat],
                      zoom: Math.max(map.current.getZoom(), 11),
                    });
                  }}
                >
                  <span>
                    <b>{x.name}</b>
                    <small>{x.addr}</small>
                  </span>
                  <em>
                    {d < 10 ? d.toFixed(1) : Math.round(d)} mi
                    {x.open ? " · open" : ""}
                  </em>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted">
        From FEMA&apos;s ESF#6 Shelter System, kept by the American Red Cross
        and the states. Call the shelter or 211 before you go.
      </p>
    </section>
  );
}
