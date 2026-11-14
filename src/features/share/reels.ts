import type { Product } from "@/lib/radar/products";
import type { Reel } from "./motion";

/**
 * The radar and model loops, described for motion.ts: how to put each frame on the map,
 * what to call it, and how to put the map back. Loaded only when someone shares.
 */
type AnyMap = Reel["map"] & {
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  setPaintProperty: (id: string, k: string, v: unknown) => void;
  setLayoutProperty: (id: string, k: string, v: unknown) => void;
};
const clock = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function radarReel(d: {
  map: unknown;
  prod: Product;
  frames: string[];
  at: number;
  opacity: number;
  /** A frame's age in minutes. */
  age: (f: string) => number;
  pause: () => void;
  restore: (k: number) => void;
}): Reel {
  const m = d.map as AnyMap;
  const ids = d.frames.map((_, i) => `radar-${i}`);
  const fade = (ms: number) =>
    ids.forEach(
      (id) =>
        m.getLayer(id) &&
        m.setPaintProperty(id, "raster-opacity-transition", {
          duration: ms,
          delay: 0,
        }),
    );
  d.pause();
  const now = Date.now();
  return {
    title: d.prod.group === "Satellite" ? "Live Satellite" : "Live Radar",
    sub: `${d.prod.label} · ${d.prod.group}`,
    badge: "LIVE",
    legend: d.prod.legend.length
      ? { swatches: d.prod.legend.map((l) => [l.label, l.color]) }
      : null,
    foot:
      d.prod.source === "iem"
        ? "NEXRAD mosaic from the Iowa Environmental Mesonet."
        : "From SSEC RealEarth, University of Wisconsin–Madison.",
    count: d.frames.length,
    at: Math.min(d.at, d.frames.length - 1),
    delay: 450,
    map: m,
    show: async (k) => {
      fade(0);
      ids.forEach(
        (id, j) =>
          m.getLayer(id) &&
          m.setPaintProperty(id, "raster-opacity", j === k ? d.opacity : 0),
      );
      return true;
    },
    label: (k) => {
      const age = d.age(d.frames[k]);
      return [
        clock(new Date(now - age * 60_000)),
        age ? `${age} MIN AGO` : "LATEST",
      ];
    },
    restore: () => {
      fade(350);
      d.restore(d.at);
    },
  };
}

export function modelReel(d: {
  map: unknown;
  model: string;
  param: {
    label: string;
    unit: string;
    colors: string[];
    levels: (number | string)[];
  };
  region: string;
  run: string;
  count: number;
  at: number;
  /** The frame's picture once drawn; `want` asks for it first in line. */
  blob: (k: number) => string | undefined;
  want: (k: number) => void;
  cities: (k: number) => unknown;
  coords: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  label: (k: number) => [string, string];
  pause: () => void;
}): Reel {
  const m = d.map as AnyMap;
  d.pause();
  const detail = (v: "none" | "visible") =>
    m.getLayer("model-detail") &&
    m.setLayoutProperty("model-detail", "visibility", v);
  const show = async (k: number) => {
    let url = d.blob(k);
    if (!url) {
      d.want(k);
      for (let t = 0; t < 300 && !url; t++) {
        await new Promise((ok) => setTimeout(ok, 100));
        url = d.blob(k);
      }
    }
    const src = m.getSource("model") as
      { updateImage: (o: unknown) => void } | undefined;
    if (!url || !src) return false;
    detail("none");
    src.updateImage({ url, coordinates: d.coords });
    (
      m.getSource("model-cities") as
        { setData: (x: unknown) => void } | undefined
    )?.setData(d.cities(k));
    return true;
  };
  return {
    title: `${d.model} Forecast`,
    sub: `${d.param.label} · ${d.region} · ${d.run} run`,
    badge: "FORECAST",
    legend: {
      scale: d.param.colors,
      ticks: d.param.levels,
      name: `${d.param.label}${d.param.unit ? ` (${d.param.unit})` : ""}`,
    },
    foot: `NOAA ${d.model} model data, drawn by SSWX. A forecast, not an observation.`,
    count: d.count,
    at: d.at,
    delay: 500,
    map: m,
    show,
    label: d.label,
    restore: () => {
      d.want(d.at);
      void show(d.at).then(() => detail("visible"));
    },
  };
}
