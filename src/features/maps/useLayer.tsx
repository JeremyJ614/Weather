"use client";

import { useEffect, useState } from "react";
import type { Swatch } from "./UsMap";

export type Layer = {
  title: string;
  valid: string | null;
  polys: { c: string; d: string }[];
  legend: Swatch[];
};
const cache = new Map<string, Promise<Layer>>();

/** A projected national product from /api/maps/layer, cached per page view. */
export function useLayer(id: string) {
  const [state, setState] = useState<{
    id: string;
    layer?: Layer;
    error?: boolean;
  }>({ id: "" });
  useEffect(() => {
    let live = true;
    let p = cache.get(id);
    if (!p) {
      p = fetch(`/api/maps/layer?p=${id}`).then(async (r) => {
        if (!r.ok) throw new Error("map");
        return (await r.json()) as Layer;
      });
      p.catch(() => cache.delete(id));
      cache.set(id, p);
    }
    p.then((layer) => live && setState({ id, layer })).catch(
      () => live && setState({ id, error: true }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  const cur = state.id === id ? state : null;
  const status: "loading" | "ready" | "error" | "empty" = !cur
    ? "loading"
    : cur.error
      ? "error"
      : cur.layer!.polys.length
        ? "ready"
        : "empty";
  return { layer: cur?.layer, status };
}

/** Draws a layer's polygons (for UsMap children). */
export function Polys({ polys }: { polys: Layer["polys"] }) {
  return polys.map((p, i) => <path key={i} d={p.d} fill={p.c} />);
}
