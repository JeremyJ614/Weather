"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { Flame, Map as MapIcon, Pause, Play, Radar } from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { HomeTabs } from "@/features/news/HomeTabs";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import { LT_BANDS, LT_CLASSES, ltBand } from "@/lib/lightning/style";
import s from "./Lightning.module.css";

type NearFrame = {
  t: string;
  in10: number;
  in30: number;
  in60: number;
  nearest: { miles: number; bearing: number } | null;
  peak: number;
};
type Near = {
  cellSqMi: number;
  frames: NearFrame[];
  points: [number, number, number][];
};
type Hotspot = {
  lat: number;
  lon: number;
  peak: number;
  score: number;
  place: string;
};
type National = {
  times: string[];
  national: {
    t: string;
    lit: number | null;
    litBefore: number | null;
    hotspots: Hotspot[];
  } | null;
};
const WMS = "https://nowcoast.noaa.gov/geoserver/ows";
const LAYER = "lightning_detection:ldn_lightning_strike_density";
const tm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
const dir = (deg: number) =>
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];

function useJson<T>(url: string | null, every = 0) {
  const [res, setRes] = useState<{ url: string; d: T | "error" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    const load = () =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: T) => live && setRes({ url, d }))
        .catch(
          () =>
            live &&
            setRes((p) =>
              p?.url === url && p.d !== "error" ? p : { url, d: "error" },
            ),
        );
    load();
    const t = every ? setInterval(load, every) : 0;
    return () => {
      live = false;
      if (t) clearInterval(t);
    };
  }, [url, every]);
  return url && res?.url === url ? res.d : null;
}

/** Lightning Monitoring: lightning around you, the live national loop, and hotspots. */
export function LightningView({ colors }: { colors: Colors }) {
  const c = (k: string) =>
    pick(
      colors,
      `lt:${k}`,
      LT_BANDS.find((b) => b.key === k)?.color ?? "#ffffff",
    );
  const nat = useJson<National>("/api/lightning/national", 5 * 60_000);
  return (
    <div className="grid gap-4">
      <NearYou c={c} />
      <HomeTabs
        label="Lightning"
        tabs={[
          {
            id: "lt-map",
            label: "Live Map",
            icon: <MapIcon aria-hidden />,
            panel: (
              <LoopMap times={nat && nat !== "error" ? nat.times : null} />
            ),
          },
          {
            id: "lt-hot",
            label: "Hotspots",
            icon: <Flame aria-hidden />,
            panel: <Hotspots nat={nat} c={c} />,
          },
          {
            id: "lt-safe",
            label: "Safety",
            icon: <Radar aria-hidden />,
            panel: <Safety />,
          },
        ]}
      />
      <p className={s.foot}>
        Source: NOAA nowCOAST lightning strike density from the U.S. National
        Lightning Detection Network and GLD360 (15-minute frames, 8 km), a
        derived product NOAA clears for public distribution. Distances are
        measured from those frames, so treat them as within a few miles.
      </p>
    </div>
  );
}

function NearYou({ c }: { c: (k: string) => string }) {
  const { active } = usePlaces();
  const d = useJson<Near>(
    active
      ? `/api/lightning/near?lat=${active.lat.toFixed(2)}&lon=${active.lon.toFixed(2)}`
      : null,
    5 * 60_000,
  );
  if (!active)
    return (
      <p className={s.card}>
        Set your location on the Homepage to see lightning around you.
      </p>
    );
  if (!d)
    return (
      <p className={s.muted}>Checking for lightning around {active.label}…</p>
    );
  if (d === "error" || !d.frames.length)
    return (
      <p className={s.card}>
        NOAA&apos;s lightning frames aren&apos;t answering right now.
      </p>
    );
  const now = d.frames[d.frames.length - 1];
  const first = d.frames[0];
  const ring = (r: number) => (Math.PI * r * r) / d.cellSqMi;
  const pct = (n: number, r: number) =>
    Math.min(100, Math.round((n / ring(r)) * 100));
  const level =
    !now.nearest || now.nearest.miles > 120
      ? "none"
      : now.nearest.miles <= 10
        ? "danger"
        : now.nearest.miles <= 30
          ? "near"
          : "far";
  const trend =
    now.in60 > first.in60 * 1.25 + 5
      ? "growing"
      : now.in60 < first.in60 * 0.75 - 5
        ? "fading"
        : "steady";
  return (
    <section className={s.near} data-level={level}>
      <div className={s.head}>
        <p className={s.eyebrow}>Lightning · {active.label}</p>
        <h2>
          {level === "none"
            ? "No lightning within 120 miles"
            : `Nearest ${now.nearest!.miles <= 2 ? "overhead" : `${now.nearest!.miles} mi ${dir(now.nearest!.bearing)}`}`}
        </h2>
        <p className={s.read}>
          {level === "danger"
            ? "Within 10 miles: close enough to strike you. Get indoors or into a hard-topped car and stay 30 minutes after the last thunder."
            : level === "near"
              ? "Within 30 miles and able to reach you quickly. Plan to be inside if it moves closer."
              : level === "far"
                ? `Storms are active ${now.nearest!.miles} miles away and ${trend} over the last hour.`
                : "Nothing on the ground networks around you right now."}
        </p>
        <p className={s.muted}>
          As of {tm(now.t)} · 15-minute frames · lightning activity {trend} over
          the last hour.
        </p>
      </div>
      <Scope points={d.points} c={c} />
      <div className={s.stats}>
        {[
          [10, now.in10],
          [30, now.in30],
          [60, now.in60],
        ].map(([r, n]) => (
          <div key={r}>
            <b>{pct(n, r)}%</b>
            <span>of the area within {r} mi</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** A scope centered on you: rings at 10, 30, 60 and 120 miles, north up. */
function Scope({
  points,
  c,
}: {
  points: [number, number, number][];
  c: (k: string) => string;
}) {
  const S = 300;
  const C = S / 2;
  const k = (C - 12) / 120;
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className="mx-auto w-full max-w-sm"
      role="img"
      aria-label="Lightning around you, 120-mile scope"
    >
      <circle cx={C} cy={C} r={C - 10} fill="var(--bg)" opacity={0.6} />
      {[10, 30, 60, 120].map((r) => (
        <g key={r}>
          <circle
            cx={C}
            cy={C}
            r={r * k}
            fill="none"
            stroke={r === 10 ? c("heavy") : "var(--line)"}
            strokeOpacity={r === 10 ? 0.6 : 1}
          />
          <text x={C + 3} y={C - r * k + 10} fontSize={8} fill="var(--muted)">
            {r} mi
          </text>
        </g>
      ))}
      <text x={C} y={9} fontSize={9} textAnchor="middle" fill="var(--muted)">
        N
      </text>
      {points.map(([dx, dy, cls], i) => (
        <circle
          key={i}
          cx={C + dx * k}
          cy={C - dy * k}
          r={1.6 + cls * 0.12}
          fill={c(ltBand(cls).key)}
          opacity={0.85}
        />
      ))}
      <circle
        cx={C}
        cy={C}
        r={4}
        fill="#fff"
        stroke="#0b0c14"
        strokeWidth={1.5}
      />
    </svg>
  );
}

/** The last two hours of NOAA frames as a loop; every frame is its own layer, cross-faded. */
function LoopMap({ times }: { times: string[] | null }) {
  const { active } = usePlaces();
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const frames = (times ?? []).slice(-8);
  const [i, setI] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const key = frames.join();
  const idx = i < 0 || i >= frames.length ? frames.length - 1 : i;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !frames.length) return;
    for (let k = 0; k < 8; k++) {
      if (m.getLayer(`lt-${k}`)) m.removeLayer(`lt-${k}`);
      if (m.getSource(`lt-${k}`)) m.removeSource(`lt-${k}`);
    }
    frames.forEach((t, k) => {
      m.addSource(`lt-${k}`, {
        type: "raster",
        tileSize: 256,
        tiles: [
          `${WMS}?service=WMS&version=1.3.0&request=GetMap&layers=${LAYER}&styles=&format=image/png&transparent=true&crs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256&time=${t}`,
        ],
      });
      m.addLayer({
        id: `lt-${k}`,
        type: "raster",
        source: `lt-${k}`,
        paint: {
          "raster-opacity": k === frames.length - 1 ? 0.9 : 0,
          "raster-fade-duration": 0,
          "raster-opacity-transition": { duration: 300 },
        },
      });
    });
  }, [ready, key]); // eslint-disable-line react-hooks/exhaustive-deps -- key is the frame list
  const show = (n: number) => {
    const m = map.current;
    if (!m) return;
    frames.forEach(
      (_, k) =>
        m.getLayer(`lt-${k}`) &&
        m.setPaintProperty(`lt-${k}`, "raster-opacity", k === n ? 0.9 : 0),
    );
    setI(n);
  };
  useEffect(() => {
    if (
      !ready ||
      !playing ||
      frames.length < 2 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let n = idx;
    const t = setInterval(() => {
      n = (n + 1) % frames.length;
      const m = map.current;
      if (!m) return;
      frames.forEach(
        (_, k) =>
          m.getLayer(`lt-${k}`) &&
          m.setPaintProperty(`lt-${k}`, "raster-opacity", k === n ? 0.9 : 0),
      );
      setI(n);
    }, 800);
    return () => clearInterval(t);
  }, [ready, playing, key]); // eslint-disable-line react-hooks/exhaustive-deps -- idx only seeds the loop
  useEffect(() => {
    if (active && ready)
      map.current?.flyTo({
        center: [active.lon, active.lat],
        zoom: 5.5,
        duration: 900,
      });
  }, [active, ready]);
  const onReady = ({ map: any }: ReadyMap) => {
    map.current = any as unknown as MaplibreMap;
    setReady(true);
  };
  if (times && !times.length)
    return (
      <p className={s.muted}>No lightning frames are available right now.</p>
    );
  return (
    <div className="grid gap-3">
      <div className="relative">
        <WeatherMap
          center={[-96, 37]}
          zoom={3.3}
          label="Lightning map"
          className="h-[55dvh] min-h-80"
          onReady={onReady}
        />
        {frames[idx] && <span className={s.stamp}>{tm(frames[idx])}</span>}
      </div>
      {frames.length > 1 && (
        <div className={s.scrub}>
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
            max={frames.length - 1}
            value={idx}
            onChange={(e) => (setPlaying(false), show(+e.target.value))}
            aria-label="Frame"
          />
        </div>
      )}
      <div className={s.ramp} aria-label="NOAA strike density scale">
        {LT_CLASSES.map((k) => (
          <i
            key={k.v}
            style={{ background: `rgb(${k.rgb.join(",")})` }}
            title={`${k.v}`}
          />
        ))}
      </div>
      <p className={s.muted}>
        NOAA&apos;s scale, strikes per km² per minute ×1,000: {LT_CLASSES[0].v}{" "}
        (pale yellow) to {LT_CLASSES[LT_CLASSES.length - 1].v}+ (green). Last
        two hours, 15-minute frames.
      </p>
    </div>
  );
}

function Hotspots({
  nat,
  c,
}: {
  nat: National | "error" | null;
  c: (k: string) => string;
}) {
  if (!nat) return <p className={s.muted}>Scanning the country…</p>;
  if (nat === "error" || !nat.national)
    return (
      <p className={s.muted}>
        The national lightning picture isn&apos;t answering right now.
      </p>
    );
  const n = nat.national;
  const change =
    n.lit != null && n.litBefore
      ? Math.round(((n.lit - n.litBefore) / n.litBefore) * 100)
      : null;
  return (
    <div className="grid gap-3">
      <section className={s.card}>
        <h3>The busiest storms right now</h3>
        <p className={s.muted}>
          As of {tm(n.t)}.{" "}
          {change != null &&
            `Lightning area across the Lower 48 is ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% from an hour ago.`}
        </p>
        {n.hotspots.length ? (
          <ol className="grid gap-2">
            {n.hotspots.map((h, i) => {
              const b = ltBand(h.peak);
              return (
                <li
                  key={`${h.lat}${h.lon}`}
                  className={s.spot}
                  style={{ ["--c" as string]: c(b.key) }}
                >
                  <span className={s.rank}>{i + 1}</span>
                  <span className="grid">
                    <b>{h.place}</b>
                    <small>
                      Peak density {LT_CLASSES[h.peak]?.v ?? "–"} · {b.label}
                    </small>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={s.read}>No lightning across the Lower 48 right now.</p>
        )}
      </section>
    </div>
  );
}

function Safety() {
  return (
    <section className={s.card}>
      <h3>When thunder roars, go indoors</h3>
      <ul className={s.tips}>
        <li>
          If you can hear thunder, you are close enough to be struck. Lightning
          reaches 10 miles from its storm.
        </li>
        <li>
          Go inside a building with plumbing and wiring, or a hard-topped car
          with the windows up. Picnic shelters, tents and dugouts are not safe.
        </li>
        <li>Wait 30 minutes after the last thunder before going back out.</li>
        <li>
          Indoors, stay off corded phones, away from windows and out of the
          shower during the storm.
        </li>
        <li>
          If someone is struck, call 911; they carry no charge and can be helped
          right away with CPR.
        </li>
      </ul>
      <p className={s.muted}>
        From the National Weather Service lightning safety program.
      </p>
    </section>
  );
}
