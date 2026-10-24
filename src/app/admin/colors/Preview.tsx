"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { UsMap } from "@/features/maps/UsMap";
import { project } from "@/lib/map/usAlbers";
import type { Group } from "@/lib/colors/registry";
import { sampleFor, type Sample, type Shape } from "./samples";

/** A live shape: drawn in a saved color `c`, or carrying its color key `k`. */
type Poly = { c?: string; k?: string; d: string };
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
    case "shelters":
      return {
        url: "/api/disaster/shelters?preview=1",
        title:
          "Shelters open now, and registered shelters in Oklahoma and Kansas",
      };
    case "gauges":
      return {
        url: "/api/rivers/preview",
        title: "River gauges at action stage or higher",
      };
    case "engine-tor":
      return { url: "/api/engines/preview?e=tor", title: "ProbTor areas now" };
    case "engine-rainbow":
      return {
        url: "/api/engines/preview?e=rainbow",
        title: "Rainbow chances now, from radar and satellite",
      };
    case "engine-deer":
    case "engine-fish":
      return {
        url: `/api/engines/preview?e=${id.slice(7)}`,
        title: "Today's best hour around Ohio, from Open-Meteo",
      };
    case "engine-firstT":
      return {
        url: "/api/engines/preview?e=firstT",
        title: "When the first storms start, from the latest HRRR runs",
      };
    case "engine-surge":
      return {
        url: "/api/engines/preview?e=surge",
        title: "Storms with rising or jumping lightning now",
      };
    case "engine-blind":
      return {
        url: "/api/engines/preview?e=blind",
        title: "Lowest radar beam, sampled every half degree",
      };
    case "engine-pyrocb":
      return {
        url: "/api/engines/preview?e=pyrocb",
        title: "Large fires' PyroCb chance today",
      };
    case "engine-llj":
    case "engine-nst":
    case "engine-pyro":
    case "engine-tctor":
    case "engine-stp":
    case "engine-scp":
    case "engine-dcp":
    case "engine-ltg":
    case "engine-rwrap":
    case "engine-blizz":
    case "engine-first":
    case "engine-sunset":
      return {
        url: `/api/engines/preview?e=${id.slice(7)}`,
        title: "The engine's areas from the latest HRRR run",
      };
    case "replay":
      return {
        url: "/api/archive/preview",
        title:
          "Greenfield, 21 May 2024: warnings and hail (chase colors show on a chase)",
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

/** Groups previewed by the real page components (Widgets.tsx), loaded when opened. */
const WIDGET_IDS = new Set([
  "ingredients",
  "timing",
  "sswxcon",
  "chase",
  "runs",
  "soundings",
  "aurora",
  "kp",
  "badges",
  "weatherdle",
  "extremes",
  "replay-radar",
  "replay-velocity",
  "replay-cc",
]);
const WidgetPreview = dynamic(() =>
  import("./Widgets").then((m) => m.WidgetPreview),
);

/** Whether a group has any preview under its colors. */
export const hasPreview = (id: string) =>
  WIDGET_IDS.has(id) || previewSource(id) !== null || sampleFor(id) !== null;

type Props = {
  group: Group;
  vals: Record<string, string>;
  saved: Record<string, string>;
};

const chip =
  "min-h-8 rounded-full border border-line px-3 text-xs font-semibold aria-pressed:border-[var(--lit-line)] aria-pressed:bg-[var(--lit)] aria-pressed:text-accent";

/**
 * The preview under a color group: a fixed example day that shows every color in the group
 * when there is one, today's live map otherwise, or either when both exist.
 */
export function Preview(props: Props) {
  const [today, setToday] = useState(false);
  if (WIDGET_IDS.has(props.group.id)) {
    // Every key in the group, as edited (a half-typed hex falls back to saved, then default).
    const colors = Object.fromEntries(
      props.group.entries.map((e) => {
        const v = props.vals[e.key];
        return [
          e.key,
          /^#[0-9a-f]{6}$/i.test(v ?? "") ? v : (props.saved[e.key] ?? e.def),
        ];
      }),
    );
    return <WidgetPreview id={props.group.id} colors={colors} />;
  }
  const sample = sampleFor(props.group.id);
  const live = previewSource(props.group.id) !== null;
  if (!sample) return <LivePreview {...props} />;
  return (
    <div className="grid gap-2">
      {live && (
        <div className="flex gap-2">
          {[false, true].map((t) => (
            <button
              key={String(t)}
              type="button"
              aria-pressed={today === t}
              onClick={() => setToday(t)}
              className={chip}
            >
              {t ? "Today" : "Example day"}
            </button>
          ))}
        </div>
      )}
      {today ? (
        <LivePreview {...props} />
      ) : (
        <SampleMap key={props.group.id} load={sample} {...props} />
      )}
    </div>
  );
}

/** An example map whose shapes carry their color keys, so every edit shows at once. */
function SampleMap({
  load,
  group,
  vals,
  saved,
}: Props & { load: () => Promise<Sample> }) {
  const [s, setS] = useState<Sample | "error" | null>(null);
  useEffect(() => {
    let on = true;
    load()
      .then((x) => on && setS(x))
      .catch(() => on && setS("error"));
    return () => {
      on = false;
    };
  }, [load]);
  const def = new Map(group.entries.map((e) => [e.key, e.def]));
  const col = (k: string) =>
    /^#[0-9a-f]{6}$/i.test(vals[k] ?? "")
      ? vals[k]
      : (saved[k] ?? def.get(k) ?? "#888888");
  const draw = (list: Shape[]) =>
    list.map((p, i) =>
      p.w ? (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={col(p.k)}
          strokeWidth={p.w}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <path key={i} d={p.d} fill={col(p.k)} fillOpacity={p.o ?? 1} />
      ),
    );
  const ok = s && s !== "error" ? s : null;
  return (
    <UsMap
      title={ok ? `Preview · ${ok.title}` : "Preview"}
      legend={[]}
      status={!s ? "loading" : s === "error" ? "error" : "ready"}
      file="sswx-color-preview"
      actions={false}
      zoomable={Boolean(ok?.view)}
      view={ok?.view}
      key={ok ? "ready" : "wait"}
      overlay={
        ok ? (
          <g>
            {draw(ok.over)}
            {ok.dots.map((d, i) => (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={d.r}
                fill={col(d.k)}
                stroke="#000"
                strokeWidth={0.5}
              />
            ))}
          </g>
        ) : null
      }
    >
      {ok ? draw(ok.under) : null}
    </UsMap>
  );
}

/**
 * A group's colors on today's real map, recolored as you edit. The map arrives in
 * the saved colors; each saved color is traced back to its key and swapped for the
 * value being edited, so nothing is saved until you press Save.
 */
function LivePreview({ group, vals, saved }: Props) {
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
              className={chip}
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
          cur && cur !== "error" ? (
            <g>
              {/* Engine areas carry keys and may lie offshore (waterspouts): unclipped, outlined. */}
              {cur.polys
                .filter((p) => p.k)
                .map((p, i) => (
                  <path
                    key={`k${i}`}
                    d={p.d}
                    fill={vals[p.k!] ?? "#888"}
                    fillOpacity={0.5}
                    stroke={vals[p.k!] ?? "#888"}
                    strokeWidth={1.2}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
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
          ? cur.polys
              .filter((p) => !p.k)
              .map((p, i) => (
                <path key={i} d={p.d} fill={paint(p.c ?? "#888")} />
              ))
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
