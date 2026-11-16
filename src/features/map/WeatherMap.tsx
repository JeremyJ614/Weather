"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Map as MaplibreMap } from "maplibre-gl";
import {
  MAPBOX_STYLE,
  MAPLIBRE_STYLE,
  claimMapbox,
  mapboxToken,
  type MapProvider,
} from "./provider";

export type AnyMap = MapboxMap | MaplibreMap;
export type ReadyMap = { map: AnyMap; provider: MapProvider };

type Props = {
  /** [longitude, latitude] */
  center: [number, number];
  zoom: number;
  /** Accessible name for the map region. */
  label: string;
  className?: string;
  /** Runs once the style has loaded; add sources and layers here. */
  onReady?: (ready: ReadyMap) => void;
  /** Download/Share buttons (on unless a page turns them off); `file` names the PNG. */
  actions?: boolean;
  file?: string;
  /** Any other page's own share card, drawn around the map's picture. */
  card?: (shot: HTMLCanvasElement) => Promise<Blob>;
};

/**
 * The one map every page uses. Picks Mapbox or MapLibre (see provider.ts), loads the chosen
 * library on demand, and switches to MapLibre if Mapbox fails before its style loads
 * (for example on a preview URL the token does not allow).
 */
export function WeatherMap({
  center,
  zoom,
  label,
  className = "",
  onReady,
  actions = true,
  file,
  card,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [provider, setProvider] = useState<MapProvider | null>(null);
  const [failed, setFailed] = useState(false);
  const live = useRef<AnyMap | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (share: boolean) => {
    if (!live.current || busy) return;
    setBusy(true);
    try {
      const { mapPng, grab, saveOrShare } = await import("./snapshot");
      const blob = card
        ? await card(await grab(live.current))
        : await mapPng(live.current, label);
      const name =
        file ??
        `sswx-${label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 40)}`;
      await saveOrShare(blob, name, label, share);
    } catch {
      /* closed the share sheet, or the map wasn't drawn yet */
    } finally {
      setBusy(false);
    }
  };
  // The first values are used to create the map; later changes are the page's to apply.
  const init = useRef({ center, zoom, onReady });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let map: AnyMap | null = null;
    let disposed = false;
    const { center, zoom, onReady } = init.current;
    const low = document.documentElement.dataset.tier === "low";

    const ready = (m: AnyMap, p: MapProvider) => {
      if (disposed) return;
      live.current = m;
      setProvider(p);
      onReady?.({ map: m, provider: p });
    };

    const startMaplibre = async () => {
      const [ml] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      if (disposed) return;
      ml.setWorkerUrl(
        `/vendor/maplibre/${ml.getVersion()}/maplibre-gl-worker.mjs`,
      );
      const m = new ml.Map({
        container: el,
        style: MAPLIBRE_STYLE,
        center,
        zoom,
        fadeDuration: low ? 0 : 300,
        attributionControl: { compact: true },
      });
      map = m;
      let up = false;
      m.once("load", () => {
        up = true;
        ready(m, "maplibre");
      });
      // Only a style that never loads is a failed map; a missing tile later is not (bug 152).
      m.on("error", () => {
        if (!up) setFailed(true);
      });
    };

    const startMapbox = async (token: string) => {
      const [{ default: mb }] = await Promise.all([
        import("mapbox-gl"),
        import("mapbox-gl/dist/mapbox-gl.css"),
      ]);
      if (disposed) return;
      const m = new mb.Map({
        container: el,
        accessToken: token,
        style: MAPBOX_STYLE,
        center,
        zoom,
        projection: "mercator",
        antialias: !low,
        fadeDuration: low ? 0 : 300,
        attributionControl: true,
      });
      map = m;
      let loaded = false;
      m.once("load", () => {
        loaded = true;
        ready(m, "mapbox");
      });
      m.on("error", () => {
        if (loaded || disposed) return;
        loaded = true; // fall back once
        m.remove();
        map = null;
        void startMaplibre();
      });
    };

    (async () => {
      const token = mapboxToken();
      const useMapbox = await claimMapbox(
        token,
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );
      if (disposed) return;
      if (useMapbox && token) await startMapbox(token);
      else await startMaplibre();
    })().catch(() => !disposed && setFailed(true));

    return () => {
      disposed = true;
      map?.remove();
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface ${className}`}
      role="region"
      aria-label={label}
      data-map
      data-provider={provider ?? undefined}
    >
      {/* Not absolutely positioned: the map libraries set position: relative on this element. */}
      <div ref={box} className="h-full w-full" />
      {actions && provider && (
        <div className="absolute bottom-9 left-2 z-10 flex gap-1.5">
          {([false, true] as const).map((share) => (
            <button
              key={String(share)}
              type="button"
              disabled={busy}
              onClick={() => save(share)}
              aria-label={share ? "Share this map" : "Download this map"}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line bg-bg/80 px-2.5 text-xs font-bold text-text backdrop-blur"
            >
              {share ? (
                <Share2 className="size-4 text-accent" aria-hidden />
              ) : (
                <Download className="size-4 text-accent" aria-hidden />
              )}
              {share ? "Share" : "Download"}
            </button>
          ))}
        </div>
      )}
      {failed && (
        <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted">
          The map could not load. Check your connection and reopen this page.
        </p>
      )}
    </div>
  );
}
