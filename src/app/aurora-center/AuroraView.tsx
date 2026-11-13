"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GeoJSONSource,
  ImageSource,
  Map as MaplibreMap,
} from "maplibre-gl";
import {
  Activity,
  BarChart3,
  Download,
  Image as ImageIcon,
  Map as MapIcon,
} from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { HomeTabs } from "@/features/news/HomeTabs";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import { sunPosition } from "@/lib/sky/astro";
import {
  AURORA_LINES,
  AURORA_RAMP,
  KP_SCALE,
  kpBand,
  kpNeeded,
} from "@/lib/aurora/style";
import s from "./Aurora.module.css";

type Ovation = {
  observed: string;
  forecast: string;
  w: number;
  h: number;
  grid: number[];
  edge: [number, number][];
  view: [number, number][];
};
type Bar = {
  at: string;
  kp: number;
  kind: "observed" | "estimated" | "predicted";
};
type Wind = {
  t: string;
  bz: number | null;
  bt: number | null;
  v: number | null;
  n: number | null;
}[];
export type Now = {
  ovation: Ovation | null;
  kp: {
    now: { at: string; kp: number; minute: number | null } | null;
    bars: Bar[];
  } | null;
  wind: Wind | null;
};
const SECTOR = { lat0: 30, lat1: 85, lon0: -170, lon1: -50 };
const now = () => Date.now();
const hr = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

/** Aurora Center: your chance tonight, the live oval two ways, Kp and the solar wind. */
export function AuroraView({ colors }: { colors: Colors }) {
  const a = (k: string) =>
    pick(
      colors,
      `aurora:${k}`,
      [...AURORA_RAMP, ...AURORA_LINES].find((x) => x.key === k)?.color ??
        "#ffffff",
    );
  const kc = (k: string) =>
    pick(
      colors,
      `kp:${k}`,
      KP_SCALE.find((x) => x.key === k)?.color ?? "#ffffff",
    );
  const [d, setD] = useState<Now | "error" | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/aurora/now")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((x: Now) => live && setD(x))
        .catch(() => live && setD((p) => (p && p !== "error" ? p : "error")));
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  if (!d) return <p className={s.muted}>Reading the space weather…</p>;
  if (d === "error")
    return (
      <p className={s.card}>
        NOAA&apos;s Space Weather Prediction Center isn&apos;t answering right
        now. Try again in a few minutes.
      </p>
    );
  return (
    <div className="grid gap-4">
      <Verdict d={d} kc={kc} />
      <HomeTabs
        label="Aurora"
        tabs={[
          {
            id: "au-map",
            label: "Interactive",
            icon: <MapIcon aria-hidden />,
            panel: <OvalMap o={d.ovation} a={a} kp={d.kp} kc={kc} />,
          },
          {
            id: "au-img",
            label: "Image",
            icon: <ImageIcon aria-hidden />,
            panel: <OvalImage />,
          },
          {
            id: "au-kp",
            label: "Kp",
            icon: <BarChart3 aria-hidden />,
            panel: <KpPanel k={d.kp} kc={kc} />,
          },
          {
            id: "au-wind",
            label: "Solar Wind",
            icon: <Activity aria-hidden />,
            panel: <WindPanel w={d.wind} a={a} />,
          },
        ]}
      />
      <p className={s.foot}>
        Source: NOAA Space Weather Prediction Center (OVATION Prime 30-minute
        forecast, planetary Kp and its 3-day forecast, real-time solar wind at
        L1). The view line is drawn 6° south of the 10% oval edge, where an
        aurora 100–250 km up clears the northern horizon.
      </p>
    </div>
  );
}

function Verdict({ d, kc }: { d: Now; kc: (k: string) => string }) {
  const { active } = usePlaces();
  const k = d.kp?.now?.kp ?? null;
  const band = k != null ? kpBand(k) : null;
  const ahead = (d.kp?.bars ?? []).filter(
    (b) => b.kind === "predicted" && Date.parse(b.at) < now() + 15 * 3600_000,
  );
  const peak = ahead.reduce((m, b) => Math.max(m, b.kp), 0);
  const place = active;
  const local = useMemo(() => {
    if (!place || !d.ovation) return null;
    const o = d.ovation;
    const lon = Math.round(place.lon);
    const x = lon - SECTOR.lon0;
    const y = Math.round(place.lat) - SECTOR.lat0;
    const chance =
      x >= 0 && x < o.w && y >= 0 && y < o.h ? o.grid[y * o.w + x] : 0;
    const edge = o.edge.find((e) => e[0] === lon)?.[1] ?? null;
    const view = o.view.find((e) => e[0] === lon)?.[1] ?? null;
    const dark =
      sunPosition(new Date(now()), place.lat, place.lon).altitude < -12;
    return { chance, edge, view, dark };
  }, [place, d.ovation]);
  const need = place ? kpNeeded(place.lat) : null;
  const verdict = !place
    ? null
    : local && local.edge != null && place.lat >= local.edge
      ? {
          tone: "go",
          text: `Under the oval: ${local.chance}% chance of aurora overhead right now.`,
        }
      : local && local.view != null && place.lat >= local.view
        ? {
            tone: "maybe",
            text: "Possible low on the northern horizon. Find a dark spot with a clear view north.",
          }
        : {
            tone: "no",
            text:
              need == null
                ? "Too far south for all but the greatest storms."
                : `Not from here right now: your latitude needs about Kp ${need}${peak ? ` (forecast peak in the next 15 hours: Kp ${peak.toFixed(1)})` : ""}.`,
          };
  return (
    <section className={s.verdict} data-tone={verdict?.tone ?? "none"}>
      <div
        className={s.kp}
        style={{ ["--c" as string]: band ? kc(band.key) : "var(--muted)" }}
      >
        <b>{k != null ? k.toFixed(1) : "–"}</b>
        <span>Kp (3-hour)</span>
        {band && (
          <small>
            {band.g === "G0" ? band.label : `${band.g} ${band.label}`}
          </small>
        )}
      </div>
      <div className="grid gap-1">
        <p className={s.eyebrow}>
          {place ? `Aurora · ${place.label}` : "Aurora"}
        </p>
        <p className={s.read}>
          {verdict
            ? verdict.text
            : "Set your location on the Homepage for your own chance."}
        </p>
        {local && !local.dark && (
          <p className={s.muted}>
            It isn&apos;t dark there yet; the oval only shows after twilight.
          </p>
        )}
        {d.ovation && (
          <p className={s.muted}>Oval forecast for {hr(d.ovation.forecast)}.</p>
        )}
      </div>
    </section>
  );
}

/** OVATION as a raster on the interactive map, painted row by row in Web Mercator. */
function ovalImage(o: Ovation, a: (k: string) => string) {
  const W = o.w * 4;
  const H = 420;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  const merc = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const top = merc(SECTOR.lat1);
  const bot = merc(SECTOR.lat0);
  const ramp = AURORA_RAMP.map((r) => {
    const n = parseInt(a(r.key).slice(1), 16);
    return { at: r.at, rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255] };
  });
  const at = (gy: number, gx: number) =>
    o.grid[
      Math.max(0, Math.min(o.h - 1, gy)) * o.w +
        Math.max(0, Math.min(o.w - 1, gx))
    ];
  for (let py = 0; py < H; py++) {
    const lat =
      (Math.atan(Math.sinh(top + ((py + 0.5) / H) * (bot - top))) * 180) /
      Math.PI;
    const fy = lat - SECTOR.lat0;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    for (let px = 0; px < W; px++) {
      const fx = ((px + 0.5) / W) * (o.w - 1);
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const v =
        at(y0, x0) * (1 - ty) * (1 - tx) +
        at(y0, x0 + 1) * (1 - ty) * tx +
        at(y0 + 1, x0) * ty * (1 - tx) +
        at(y0 + 1, x0 + 1) * ty * tx;
      if (v < 2) continue;
      // Continuous ramp between the stops; faint chances fade out instead of stepping.
      let i = 0;
      while (i < ramp.length - 2 && v >= ramp[i + 1].at) i++;
      const f = Math.max(
        0,
        Math.min(1, (v - ramp[i].at) / (ramp[i + 1].at - ramp[i].at)),
      );
      const o4 = (py * W + px) * 4;
      for (let ch = 0; ch < 3; ch++)
        img.data[o4 + ch] = Math.round(
          ramp[i].rgb[ch] + (ramp[i + 1].rgb[ch] - ramp[i].rgb[ch]) * f,
        );
      img.data[o4 + 3] = Math.round(Math.min(225, v * 9));
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

/** Splits a line at missing longitudes so gaps never draw as straight jumps. */
const runs = (pts: [number, number][]) =>
  pts
    .reduce<[number, number][][]>((acc, p, i) => {
      if (i && p[0] - pts[i - 1][0] === 1) acc[acc.length - 1].push(p);
      else acc.push([p]);
      return acc;
    }, [])
    .filter((r) => r.length > 1);

export function OvalMap({
  o,
  a,
  kp,
  kc,
}: {
  o: Ovation | null;
  a: (k: string) => string;
  kp?: Now["kp"];
  kc?: (k: string) => string;
}) {
  const { active } = usePlaces();
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const colorKey = [...AURORA_RAMP, ...AURORA_LINES]
    .map((x) => a(x.key))
    .join();
  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    const empty = { type: "FeatureCollection" as const, features: [] };
    m.addSource("oval-lines", { type: "geojson", data: empty });
    m.addSource("you", { type: "geojson", data: empty });
    map.current = m;
    setReady(true);
  };
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !o) return;
    const url = ovalImage(o, a);
    if (!url) return;
    const coords: [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ] = [
      [SECTOR.lon0, SECTOR.lat1],
      [SECTOR.lon1, SECTOR.lat1],
      [SECTOR.lon1, SECTOR.lat0],
      [SECTOR.lon0, SECTOR.lat0],
    ];
    const src = m.getSource("oval") as ImageSource | undefined;
    if (src) src.updateImage({ url, coordinates: coords });
    else {
      m.addSource("oval", { type: "image", url, coordinates: coords });
      m.addLayer({
        id: "oval",
        type: "raster",
        source: "oval",
        paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 },
      });
      m.addLayer({
        id: "oval-lines",
        type: "line",
        source: "oval-lines",
        paint: {
          "line-color": ["get", "c"],
          "line-width": ["case", ["==", ["get", "k"], "view"], 2.5, 1.5],
        },
      });
      m.addLayer({
        id: "you",
        type: "circle",
        source: "you",
        paint: {
          "circle-radius": 6,
          "circle-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0b0c14",
        },
      });
    }
    (m.getSource("oval-lines") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (["edge", "view"] as const).map((k) => ({
        type: "Feature" as const,
        properties: { k, c: a(k) },
        geometry: {
          type: "MultiLineString" as const,
          coordinates: runs(k === "edge" ? o.edge : o.view),
        },
      })),
    });
  }, [ready, o, colorKey]); // eslint-disable-line react-hooks/exhaustive-deps -- colorKey is the colors
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("you") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: active
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Point",
                coordinates: [active.lon, active.lat],
              },
            },
          ]
        : [],
    });
  }, [ready, active]);
  if (!o)
    return (
      <p className={s.muted}>
        The OVATION forecast isn&apos;t answering right now.
      </p>
    );
  return (
    <div className="grid gap-3">
      <WeatherMap
        center={[-100, 52]}
        zoom={2.4}
        label="Aurora oval map"
        className="h-[55dvh] min-h-80"
        onReady={onReady}
        file="sswx-aurora-forecast"
        card={async (shot) => {
          const k = kp?.now?.kp ?? null;
          const band = k != null ? kpBand(k) : null;
          const peak = (kp?.bars ?? [])
            .filter(
              (b) =>
                b.kind === "predicted" &&
                Date.parse(b.at) < now() + 15 * 3600_000,
            )
            .reduce((m, b) => Math.max(m, b.kp), 0);
          const { auroraCard } = await import("./share");
          return auroraCard({
            shot,
            accent: a("p20"),
            kp: k,
            band,
            kpColor: band && kc ? kc(band.key) : a("p20"),
            peak,
            forecast: o ? hr(o.forecast) : null,
            legend: [...AURORA_RAMP, ...AURORA_LINES].map(
              (r) => [r.label, a(r.key)] as [string, string],
            ),
          });
        }}
      />
      <div className={s.legend}>
        {AURORA_RAMP.map((r) => (
          <span key={r.key}>
            <i style={{ background: a(r.key) }} />
            {r.label}
          </span>
        ))}
        {AURORA_LINES.map((l) => (
          <span key={l.key}>
            <i style={{ background: a(l.key) }} />
            {l.label}
          </span>
        ))}
      </div>
      <p className={s.muted}>
        Color is OVATION&apos;s chance of aurora directly overhead. North of the
        view line, a strong display can be seen low on the northern horizon.
      </p>
    </div>
  );
}

function OvalImage() {
  const [pole, setPole] = useState<"north" | "south">("north");
  const [t] = useState(() => Math.floor(now() / 300_000));
  return (
    <div className="grid gap-3">
      <div className={s.pills} role="group" aria-label="Hemisphere">
        {(["north", "south"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === pole}
            onClick={() => setPole(p)}
          >
            {p === "north" ? "Northern" : "Southern"} hemisphere
          </button>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- SWPC's live product image */}
      <img
        src={`https://services.swpc.noaa.gov/images/animations/ovation/${pole}/latest.jpg?t=${t}`}
        alt={`NOAA OVATION aurora forecast, ${pole}ern hemisphere`}
        width={800}
        height={800}
        decoding="async"
        className="h-auto w-full rounded-2xl"
      />
      <a
        className={s.download}
        href={`/api/aurora/image?pole=${pole}`}
        download
      >
        <Download className="size-4" aria-hidden /> Download image
      </a>
    </div>
  );
}

export function KpPanel({
  k,
  kc,
}: {
  k: Now["kp"];
  kc: (k: string) => string;
}) {
  if (!k?.bars.length)
    return (
      <p className={s.muted}>The Kp forecast isn&apos;t answering right now.</p>
    );
  const W = 360;
  const H = 130;
  const bw = W / k.bars.length;
  const nowIdx = k.bars.findIndex((b) => Date.parse(b.at) > now());
  return (
    <div className="grid gap-3">
      <section className={s.card}>
        <h3>Kp, the last day and the next three</h3>
        <svg
          viewBox={`0 0 ${W} ${H + 16}`}
          className="w-full"
          role="img"
          aria-label="Kp index, observed and forecast"
        >
          {[3, 5, 7, 9].map((v) => (
            <g key={v}>
              <line
                x1={0}
                x2={W}
                y1={H - (v / 9) * H}
                y2={H - (v / 9) * H}
                stroke="var(--line)"
                strokeWidth={0.6}
              />
              <text
                x={2}
                y={H - (v / 9) * H - 2}
                fontSize={8}
                fill="var(--muted)"
              >
                {v}
              </text>
            </g>
          ))}
          {k.bars.map((b, i) => (
            <rect
              key={b.at}
              x={i * bw + 0.8}
              y={H - (Math.max(0.15, b.kp) / 9) * H}
              width={Math.max(1, bw - 1.6)}
              height={(Math.max(0.15, b.kp) / 9) * H}
              rx={1.2}
              fill={kc(kpBand(b.kp).key)}
              opacity={b.kind === "predicted" ? 0.55 : 1}
            />
          ))}
          {nowIdx > 0 && (
            <line
              x1={nowIdx * bw}
              x2={nowIdx * bw}
              y1={0}
              y2={H}
              stroke="#fff"
              strokeDasharray="2 3"
            />
          )}
          {k.bars.map((b, i) =>
            new Date(b.at).getUTCHours() === 0 && i * bw < W - 24 ? (
              <text
                key={`l${b.at}`}
                x={i * bw + 2}
                y={H + 12}
                fontSize={8.5}
                fill="var(--muted)"
              >
                {new Date(b.at).toLocaleDateString("en-US", {
                  weekday: "short",
                })}
              </text>
            ) : null,
          )}
        </svg>
        <p className={s.muted}>
          Solid bars are observed, faded bars forecast; the dashed line is now.
          Each bar is 3 hours.
        </p>
      </section>
      <section className={s.card}>
        <h3>The Kp scale, and what each step means</h3>
        <ul className="grid gap-2">
          {KP_SCALE.map((b) => (
            <li key={b.key} className={s.scale}>
              <b style={{ color: kc(b.key) }}>
                Kp {b.min}+ {b.g !== "G0" ? b.g : ""}
              </b>
              <span>
                {b.label}. <small>{b.desc}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function WindPanel({ w, a }: { w: Wind | null; a: (k: string) => string }) {
  if (!w?.length)
    return (
      <p className={s.muted}>
        Real-time solar wind isn&apos;t answering right now.
      </p>
    );
  const last = [...w].reverse();
  const cur = {
    bz: last.find((x) => x.bz != null)?.bz,
    v: last.find((x) => x.v != null)?.v,
    n: last.find((x) => x.n != null)?.n,
  };
  const W = 360;
  const H = 110;
  const lim = Math.max(10, ...w.map((x) => Math.abs(x.bz ?? 0)));
  const x = (i: number) => (i / Math.max(1, w.length - 1)) * W;
  const y = (v: number) => H / 2 - (v / lim) * (H / 2 - 4);
  const bz = w
    .map((p, i) =>
      p.bz == null ? "" : `${x(i).toFixed(1)},${y(p.bz).toFixed(1)}`,
    )
    .filter(Boolean)
    .join(" ");
  const south = (cur.bz ?? 0) < -2;
  return (
    <div className="grid gap-3">
      <section className={s.card}>
        <h3>Bz, the switch that opens the door</h3>
        <div className={s.winds}>
          <div data-on={south}>
            <b>{cur.bz != null ? `${cur.bz > 0 ? "+" : ""}${cur.bz}` : "–"}</b>
            <span>Bz nT</span>
          </div>
          <div>
            <b>{cur.v ?? "–"}</b>
            <span>speed km/s</span>
          </div>
          <div>
            <b>{cur.n ?? "–"}</b>
            <span>density p/cm³</span>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Bz over the last three hours"
        >
          <rect
            x={0}
            y={H / 2}
            width={W}
            height={H / 2}
            fill={a("view")}
            opacity={0.12}
          />
          <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--line)" />
          <polyline
            points={bz}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.8}
          />
          <text x={4} y={H - 6} fontSize={8.5} fill="var(--muted)">
            southward (aurora-friendly)
          </text>
          <text x={4} y={12} fontSize={8.5} fill="var(--muted)">
            northward
          </text>
        </svg>
        <p className={s.read}>
          {south
            ? "Bz is pointing south: the solar wind's field links up with Earth's and pours energy in. If it holds for an hour or more, the oval brightens and spreads south."
            : "Bz is north or near zero: the door is mostly closed, so even a fast wind does little until it turns south."}
        </p>
        <p className={s.muted}>
          Last 3 hours at L1, about 30–60 minutes upstream of Earth, in 5-minute
          means.
        </p>
      </section>
    </div>
  );
}
