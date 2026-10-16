"use client";

import { useEffect, useState } from "react";
import { UsMap } from "@/features/maps/UsMap";
import { project } from "@/lib/map/usAlbers";
import type { Group } from "@/lib/colors/registry";

type Poly = { c: string; d: string };
type Dot = { x: number; y: number; key: string };
type Data = { polys: Poly[]; dots: Dot[] } | "error";

const SPC: Record<string, string> = {
  cat: "hazard=cat&intensity=0",
  tornadoLikelihood: "hazard=torn&intensity=0",
  tornadoIntensity: "hazard=torn&intensity=1",
  hailLikelihood: "hazard=hail&intensity=0",
  hailIntensity: "hazard=hail&intensity=1",
  windLikelihood: "hazard=wind&intensity=0",
  windIntensity: "hazard=wind&intensity=1",
};

/** Which live map shows a group's colors; null when no map uses them yet. */
export function previewSource(
  id: string,
  alt = false,
): { url: string; title: string } | null {
  if (id.startsWith("spc-")) {
    const q = SPC[id.slice(4)];
    return q
      ? { url: `/api/spc/outlook?day=1&${q}`, title: "Today's SPC outlook" }
      : null;
  }
  switch (id) {
    case "qpf":
      return {
        url: "/api/maps/layer?p=t3",
        title: "WPC rainfall, next 3 days",
      };
    case "ero":
      return {
        url: "/api/maps/layer?p=ero1",
        title: "Excessive rainfall risk, today",
      };
    case "cpc":
      return alt
        ? { url: "/api/maps/layer?p=610p", title: "CPC 6–10 day precipitation" }
        : { url: "/api/maps/layer?p=610t", title: "CPC 6–10 day temperature" };
    case "drought":
      return {
        url: "/api/maps/layer?p=dm",
        title: "CPC monthly drought outlook",
      };
    case "warnings":
      return { url: "/api/warnings/map", title: "Active warnings now" };
    case "tropical":
      return {
        url: "/api/tropical/preview",
        title: "Active storms and outlook areas",
      };
    case "climo":
      return {
        url: "/api/climo/preview",
        title: "Tornado touchdowns since 1950",
      };
    case "lightning":
      return { url: "/api/lightning/preview", title: "Lightning hotspots now" };
    case "aurora":
      return { url: "/api/aurora/preview", title: "The aurora oval now" };
    case "sky":
      return { url: "/api/sky/preview", title: "Stargazing tonight" };
    case "cams":
      return { url: "/api/cams/preview", title: "Every camera feed" };
    case "gauges":
      return {
        url: "/api/rivers/preview",
        title: "River gauges at action stage or higher",
      };
    case "reports":
      return {
        url: "/api/reports?hours=48",
        title: "Storm reports, last 48 hours",
      };
    default:
      return null;
  }
}

/**
 * A group's colors on today's real map, recolored as you edit. The map arrives in
 * the saved colors; each saved color is traced back to its key and swapped for the
 * value being edited, so nothing is saved until you press Save.
 */
export function Preview({
  group,
  vals,
  saved,
}: {
  group: Group;
  vals: Record<string, string>;
  saved: Record<string, string>;
}) {
  const [alt, setAlt] = useState(false);
  const src = previewSource(group.id, alt);
  const [data, setData] = useState<{ url: string; d: Data } | null>(null);

  useEffect(() => {
    if (!src) return;
    let live = true;
    fetch(src.url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        const d: Data = Array.isArray(j.reports)
          ? {
              polys: [],
              dots: (
                j.reports as { lat: number; lon: number; kind: string }[]
              ).map((r) => ({
                ...project(r.lon, r.lat),
                key: `report:${r.kind}`,
              })),
            }
          : {
              polys: (j.polys ?? []) as Poly[],
              dots: (
                (j.dots ?? []) as { lat: number; lon: number; key: string }[]
              ).map((r) => ({ ...project(r.lon, r.lat), key: r.key })),
            };
        if (live) setData({ url: src.url, d });
      })
      .catch(() => live && setData({ url: src.url, d: "error" }));
    return () => {
      live = false;
    };
  }, [src?.url]); // eslint-disable-line react-hooks/exhaustive-deps -- the url is the whole input

  if (!src) return null;
  const cur = data?.url === src.url ? data.d : null;
  // Saved color → key, so a polygon drawn in the saved color takes the edited one.
  const back = new Map(
    group.entries.map((e) => [(saved[e.key] ?? e.def).toLowerCase(), e.key]),
  );
  const paint = (c: string) => {
    const k = back.get(c.toLowerCase());
    return k && /^#[0-9a-f]{6}$/i.test(vals[k]) ? vals[k] : c;
  };
  const status = !cur
    ? "loading"
    : cur === "error"
      ? "error"
      : cur.polys.length || cur.dots.length
        ? "ready"
        : "empty";
  return (
    <div className="grid gap-2">
      {group.id === "cpc" && (
        <div className="flex gap-2">
          {[false, true].map((a) => (
            <button
              key={String(a)}
              type="button"
              aria-pressed={alt === a}
              onClick={() => setAlt(a)}
              className="min-h-8 rounded-full border border-line px-3 text-xs font-semibold aria-pressed:border-[var(--lit-line)] aria-pressed:bg-[var(--lit)] aria-pressed:text-accent"
            >
              {a ? "Precipitation" : "Temperature"}
            </button>
          ))}
        </div>
      )}
      <UsMap
        title={`Live preview · ${src.title}`}
        legend={[]}
        status={status}
        file="sswx-color-preview"
        actions={false}
        zoomable={false}
        overlay={
          cur && cur !== "error" && cur.dots.length ? (
            <g>
              {cur.dots.map((d, i) => (
                <circle
                  key={i}
                  cx={d.x}
                  cy={d.y}
                  r={3.2}
                  fill={vals[d.key] ?? "#888"}
                  stroke="#000"
                  strokeWidth={0.6}
                />
              ))}
            </g>
          ) : null
        }
      >
        {cur && cur !== "error"
          ? cur.polys.map((p, i) => <path key={i} d={p.d} fill={paint(p.c)} />)
          : null}
      </UsMap>
      {status === "empty" && (
        <p className="text-xs text-muted">
          Nothing on today&apos;s map uses these colors right now; the strip
          above shows every one of them.
        </p>
      )}
    </div>
  );
}
