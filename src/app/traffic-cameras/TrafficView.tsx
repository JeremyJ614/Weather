"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { Map as MapIcon, MapPin, RefreshCw, Siren, Video } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { HomeTabs } from "@/features/news/HomeTabs";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import { COLOR as WARN } from "@/lib/warnings/style";
import { CAM_KINDS, CAM_SOURCES, type CamKind } from "@/lib/cams/style";
import s from "./Traffic.module.css";

type Cam = {
  id: string;
  src: string;
  kind: CamKind;
  name: string;
  area: string;
  lat: number;
  lon: number;
  img: string;
  video?: string;
  miles?: number;
};
const now = () => Date.now();
/** Hosts that allow reading pixels, so a "camera unavailable" card can be spotted. */
const CORS = /^https:\/\/cwwp2\.dot\.ca\.gov\//;

/** True for an agency's blank "Temporarily Unavailable" frame: mostly flat white. */
function placeholder(img: HTMLImageElement) {
  if (!CORS.test(img.src)) return false;
  try {
    const cv = document.createElement("canvas");
    cv.width = 32;
    cv.height = 18;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 32, 18);
    const d = ctx.getImageData(0, 0, 32, 18).data;
    let white = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) white++;
    return white / (d.length / 4) > 0.6;
  } catch {
    return false;
  }
}

function useJson<T>(url: string | null) {
  const [res, setRes] = useState<{ url: string; d: T | "error" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: T) => live && setRes({ url, d }))
      .catch(() => live && setRes({ url, d: "error" }));
    return () => {
      live = false;
    };
  }, [url]);
  return url && res?.url === url ? res.d : null;
}

/** Traffic Cameras: nearest cams, cams inside warnings, and every cam on a map. */
export function TrafficView({ colors }: { colors: Colors }) {
  const c = (k: string) =>
    pick(
      colors,
      `cam:${k}`,
      CAM_KINDS.find((x) => x.key === k)?.color ?? "#ffffff",
    );
  const [kind, setKind] = useState<CamKind | "">("");
  return (
    <div className="grid gap-4">
      <p className={s.owner}>
        Owner preview: only you can see this page until you approve it for
        members.
      </p>
      <div className={s.pills} role="group" aria-label="Camera type">
        {[{ key: "", label: "All" }, ...CAM_KINDS].map((k) => (
          <button
            key={k.key}
            type="button"
            aria-pressed={k.key === kind}
            onClick={() => setKind(k.key as CamKind | "")}
            style={k.key ? { ["--c" as string]: c(k.key) } : undefined}
          >
            {k.key && <i />}
            {k.label}
          </button>
        ))}
      </div>
      <HomeTabs
        label="Cameras"
        tabs={[
          {
            id: "c-near",
            label: "Near You",
            icon: <MapPin aria-hidden />,
            panel: <Near kind={kind} c={c} />,
          },
          {
            id: "c-warn",
            label: "In Warnings",
            icon: <Siren aria-hidden />,
            panel: <Warned kind={kind} c={c} colors={colors} />,
          },
          {
            id: "c-map",
            label: "Map",
            icon: <MapIcon aria-hidden />,
            panel: <CamMap kind={kind} c={c} />,
          },
        ]}
      />
      <p className={s.foot}>
        Sources: {Object.values(CAM_SOURCES).join(", ")}. Stills refresh every
        minute while a camera is open. Images belong to their agencies.
      </p>
    </div>
  );
}

/** One camera still. Tap to open it large; open cameras refresh every minute. */
function CamCard({
  cam,
  c,
  big = false,
  onDown,
}: {
  cam: Cam;
  c: (k: string) => string;
  big?: boolean;
  onDown?: (id: string) => void;
}) {
  const [open, setOpen] = useState(big);
  const [t, setT] = useState(0);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    if (!open) return;
    const i = setInterval(() => setT(Math.floor(now() / 60000)), 60000);
    return () => clearInterval(i);
  }, [open]);
  const src = t
    ? `${cam.img}${cam.img.includes("?") ? "&" : "?"}t=${t}`
    : cam.img;
  return (
    <article
      className={s.cam}
      data-open={open}
      style={{ ["--c" as string]: c(cam.kind) }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${cam.name}, ${open ? "close" : "open"}`}
      >
        {bad ? (
          <span className={s.noimg}>
            This camera isn&apos;t sending a picture right now.
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- live third-party stills, not optimizable
          <img
            src={src}
            alt={`${cam.name} camera`}
            loading="lazy"
            decoding="async"
            crossOrigin={CORS.test(cam.img) ? "anonymous" : undefined}
            onLoad={(e) => {
              if (placeholder(e.currentTarget)) {
                setBad(true);
                onDown?.(cam.id);
              }
            }}
            onError={() => (setBad(true), onDown?.(cam.id))}
          />
        )}
      </button>
      <div className={s.meta}>
        <b>{cam.name}</b>
        <small>
          <i />
          {[
            cam.area,
            CAM_SOURCES[cam.src],
            cam.miles != null && cam.miles > 0 ? `${cam.miles} mi` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </small>
        {open && (
          <span className={s.actions}>
            <button
              type="button"
              onClick={() => (setBad(false), setT(Math.floor(now() / 1000)))}
            >
              <RefreshCw className="size-3.5" aria-hidden /> Refresh
            </button>
            {cam.video && (
              <a href={cam.video} target="_blank" rel="noreferrer">
                <Video className="size-3.5" aria-hidden /> Live video
              </a>
            )}
          </span>
        )}
      </div>
    </article>
  );
}

function Near({ kind, c }: { kind: string; c: (k: string) => string }) {
  const { active } = usePlaces();
  const [down, setDown] = useState<Set<string>>(new Set());
  const d = useJson<{ cams: Cam[] }>(
    active
      ? `/api/cams/near?lat=${active.lat.toFixed(2)}&lon=${active.lon.toFixed(2)}&limit=30${kind ? `&kind=${kind}` : ""}`
      : null,
  );
  if (!active)
    return (
      <p className={s.muted}>
        Set your location on the Homepage to see the cameras nearest you.
      </p>
    );
  if (!d)
    return <p className={s.muted}>Finding cameras near {active.label}…</p>;
  if (d === "error")
    return (
      <p className={s.muted}>The camera list isn&apos;t answering right now.</p>
    );
  const up = d.cams.filter((x) => !down.has(x.id));
  if (!up.length)
    return (
      <p className={s.card}>
        {d.cams.length
          ? `The ${d.cams.length} cameras near ${active.label} are offline right now.`
          : `No camera feed we carry is within 100 miles of ${active.label} yet. Coverage today: California, New York City, Iowa, Kentucky and Indiana, and wildfire cameras across the West.`}
      </p>
    );
  const off = d.cams.length - up.length;
  return (
    <div className="grid gap-2">
      <div className={s.grid}>
        {up.slice(0, 12).map((x) => (
          <CamCard
            key={x.id}
            cam={x}
            c={c}
            onDown={(id) => setDown((p) => new Set(p).add(id))}
          />
        ))}
      </div>
      {off > 0 && (
        <p className={s.muted}>
          {off} nearby {off === 1 ? "camera is" : "cameras are"} offline right
          now and hidden.
        </p>
      )}
    </div>
  );
}

function Warned({
  kind,
  c,
  colors,
}: {
  kind: string;
  c: (k: string) => string;
  colors: Colors;
}) {
  const [down, setDown] = useState<Set<string>>(new Set());
  const d = useJson<{ groups: { event: string; cams: Cam[] }[] }>(
    "/api/cams/hazard",
  );
  if (!d)
    return (
      <p className={s.muted}>
        Checking which cameras sit inside active warnings…
      </p>
    );
  if (d === "error")
    return <p className={s.muted}>Warnings aren&apos;t loading right now.</p>;
  const groups = d.groups
    .map((g) => ({
      ...g,
      cams: g.cams.filter((x) => !kind || x.kind === kind),
    }))
    .filter((g) => g.cams.length);
  if (!groups.length)
    return (
      <p className={s.card}>
        No camera we carry is inside an active NWS warning right now.
      </p>
    );
  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <section key={g.event} className="grid gap-2">
          <h3
            className={s.warn}
            style={{
              ["--c" as string]: pick(
                colors,
                `warn:${g.event}`,
                WARN[g.event] ?? "#9aa3b2",
              ),
            }}
          >
            {g.event} <small>{g.cams.length} cameras</small>
          </h3>
          <div className={s.grid}>
            {g.cams
              .filter((x) => !down.has(x.id))
              .slice(0, 12)
              .map((x) => (
                <CamCard
                  key={x.id}
                  cam={x}
                  c={c}
                  onDown={(id) => setDown((p) => new Set(p).add(id))}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CamMap({ kind, c }: { kind: string; c: (k: string) => string }) {
  const { active } = usePlaces();
  const d = useJson<{
    cams: [number, number, number, string][];
    down: string[];
  }>("/api/cams/map");
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const one = useJson<{ cams: Cam[] }>(
    sel ? `/api/cams/near?id=${encodeURIComponent(sel)}` : null,
  );
  const cols = CAM_KINDS.map((k) => c(k.key));
  const colKey = cols.join();
  const data = useMemo(
    () =>
      d && d !== "error"
        ? {
            type: "FeatureCollection" as const,
            features: d.cams
              .filter((x) => !kind || CAM_KINDS[x[2]]?.key === kind)
              .map((x) => ({
                type: "Feature" as const,
                properties: { id: x[3], k: x[2] },
                geometry: { type: "Point" as const, coordinates: [x[1], x[0]] },
              })),
          }
        : null,
    [d, kind],
  );
  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    m.addSource("cams", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    m.addLayer({
      id: "cams",
      type: "circle",
      source: "cams",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          2.2,
          8,
          5,
          12,
          7,
        ],
        "circle-color": "#ffffff",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#0b0c14",
      },
    });
    m.on("click", "cams", (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) setSel(String(id));
    });
    m.on("mouseenter", "cams", () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", "cams", () => (m.getCanvas().style.cursor = ""));
    map.current = m;
    setReady(true);
  };
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !data) return;
    (m.getSource("cams") as GeoJSONSource | undefined)?.setData(data);
  }, [ready, data]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    m.setPaintProperty("cams", "circle-color", [
      "match",
      ["get", "k"],
      0,
      cols[0],
      1,
      cols[1],
      2,
      cols[2],
      "#ffffff",
    ]);
  }, [ready, colKey]); // eslint-disable-line react-hooks/exhaustive-deps -- colKey is the colors
  useEffect(() => {
    if (active && ready)
      map.current?.flyTo({
        center: [active.lon, active.lat],
        zoom: 7,
        duration: 900,
      });
  }, [active, ready]);
  const cam = one && one !== "error" ? one.cams[0] : null;
  return (
    <div className="grid gap-3">
      <WeatherMap
        center={[-97, 38]}
        zoom={3.2}
        label="Camera map"
        className="h-[55dvh] min-h-80"
        onReady={onReady}
      />
      <div className={s.legend}>
        {CAM_KINDS.map((k) => (
          <span key={k.key}>
            <i style={{ background: c(k.key) }} />
            {k.label}
          </span>
        ))}
        {d && d !== "error" && (
          <span>{data?.features.length.toLocaleString("en-US")} cameras</span>
        )}
      </div>
      {d && d !== "error" && d.down.length > 0 && (
        <p className={s.muted}>
          Not answering right now:{" "}
          {d.down.map((k) => CAM_SOURCES[k]).join(", ")}.
        </p>
      )}
      {d === "error" && (
        <p className={s.muted}>
          The camera list isn&apos;t answering right now.
        </p>
      )}
      {sel && !cam && (
        <p className={s.muted}>
          {one === "error" ? "That camera is gone." : "Opening the camera…"}
        </p>
      )}
      {cam && <CamCard key={cam.id} cam={cam} c={c} big />}
      {!sel && <p className={s.muted}>Tap a dot to open its camera.</p>}
    </div>
  );
}
