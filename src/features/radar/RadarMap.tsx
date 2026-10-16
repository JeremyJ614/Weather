"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { Pause, Play, RefreshCw } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { usePlaces } from "@/features/location/usePlaces";
import { LOOP, PRODUCTS, tileUrl, type Product } from "@/lib/radar/products";
import s from "./Radar.module.css";

const OPACITY = 0.85;
const minutesAgo = (suffix: string) =>
  suffix ? Number(suffix.slice(2, 4)) : 0;

/**
 * Live radar, MRMS and satellite on the interactive map. Base reflectivity loops its last
 * 50 minutes: every frame is its own layer, loaded up front, and frames fade from one to
 * the next (raster opacity), so playback never waits on a tile. Refreshes every 4 minutes.
 */
export function RadarMap() {
  const { active } = usePlaces();
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [prod, setProd] = useState<Product>(PRODUCTS[0]);
  const [bust, setBust] = useState(() => Math.floor(Date.now() / 240000));
  const [frame, setFrame] = useState(LOOP.length - 1);
  const [playing, setPlaying] = useState(true);
  const loops = prod.source === "iem";
  const ids = loops ? LOOP.map((_, i) => `radar-${i}`) : ["radar-0"];

  // Rebuild the product's layers whenever it (or the refresh tick) changes.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    for (let i = 0; i < LOOP.length; i++) {
      if (m.getLayer(`radar-${i}`)) m.removeLayer(`radar-${i}`);
      if (m.getSource(`radar-${i}`)) m.removeSource(`radar-${i}`);
    }
    const frames = loops ? LOOP : [""];
    frames.forEach((suffix, i) => {
      m.addSource(`radar-${i}`, {
        type: "raster",
        tiles: [tileUrl(prod, bust, suffix)],
        tileSize: 256,
        maxzoom: loops ? 10 : 8,
      });
      m.addLayer({
        id: `radar-${i}`,
        type: "raster",
        source: `radar-${i}`,
        paint: {
          "raster-opacity": i === frames.length - 1 ? OPACITY : 0,
          "raster-fade-duration": 0,
          "raster-opacity-transition": { duration: 350 },
        },
      });
    });
  }, [prod, bust, ready, loops]);

  // Play the loop: one frame visible at a time, the newest held a little longer.
  useEffect(() => {
    const m = map.current;
    if (
      !m ||
      !ready ||
      !loops ||
      !playing ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let i = frame;
    const t = setInterval(() => {
      const next = (i + 1) % LOOP.length;
      m.setPaintProperty(`radar-${i}`, "raster-opacity", 0);
      m.setPaintProperty(`radar-${next}`, "raster-opacity", OPACITY);
      i = next;
      setFrame(next);
    }, 650);
    return () => clearInterval(t);
    // The frame only seeds where playback resumes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loops, playing, prod, bust]);

  useEffect(() => {
    const t = setInterval(
      () => setBust(Math.floor(Date.now() / 240000)),
      60000,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (active && map.current)
      map.current.flyTo({
        center: [active.lon, active.lat],
        zoom: 6,
        duration: 900,
      });
  }, [active, ready]);

  const show = (i: number) => {
    const m = map.current;
    if (!m) return;
    setPlaying(false);
    ids.forEach(
      (id, k) =>
        m.getLayer(id) &&
        m.setPaintProperty(id, "raster-opacity", k === i ? OPACITY : 0),
    );
    setFrame(i);
  };

  const onReady = ({ map: any }: ReadyMap) => {
    map.current = any as unknown as MaplibreMap;
    setReady(true);
  };

  const groups = [...new Set(PRODUCTS.map((p) => p.group))];
  return (
    <div className="grid gap-3">
      {groups.map((g) => (
        <div key={g} className={s.row} role="group" aria-label={g}>
          <span>{g}</span>
          {PRODUCTS.filter((p) => p.group === g).map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === prod.id}
              onClick={() => {
                setProd(p);
                setFrame(LOOP.length - 1);
                setPlaying(true);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      ))}
      <div className="relative">
        <WeatherMap
          center={[-96, 38]}
          zoom={3.4}
          label={`${prod.label} map`}
          className="h-[60dvh] min-h-80"
          onReady={onReady}
        />
        {loops && (
          <span className={s.stamp}>
            {minutesAgo(LOOP[frame])
              ? `${minutesAgo(LOOP[frame])} min ago`
              : "Now"}
          </span>
        )}
      </div>
      <div className={s.controls}>
        {loops && (
          <>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
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
              max={LOOP.length - 1}
              value={frame}
              onChange={(e) => show(+e.target.value)}
              aria-label="Loop frame"
            />
          </>
        )}
        <button
          type="button"
          aria-label="Refresh"
          onClick={() => setBust(Math.floor(Date.now() / 1000))}
        >
          <RefreshCw className="size-4" />
        </button>
      </div>
      <p className={s.desc}>{prod.desc}</p>
      {prod.legend.length > 0 && (
        <div className={s.legend}>
          {prod.legend.map((l) => (
            <span key={l.label}>
              <i style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
