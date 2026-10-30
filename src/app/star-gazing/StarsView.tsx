"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarChart3,
  Map as MapIcon,
  Telescope,
  Pause,
  Play,
} from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { usePlaces } from "@/features/location/usePlaces";
import { rasterize } from "@/features/sky/raster";
import { unproject } from "@/lib/map/usAlbers";
import { pick, type Colors } from "@/lib/colors/pick";
import {
  moonIllumination,
  moonTimes,
  nightWindow,
  sunPosition,
} from "@/lib/sky/astro";
import {
  bandOf,
  bestRun,
  skyScore,
  SKY_APERTURE,
  SKY_BANDS,
  type SkyHour,
} from "@/lib/sky/score";
import s from "./Stars.module.css";

const Targets = dynamic(() => import("./Targets").then((m) => m.Targets), {
  loading: () => <p className={s.muted}>Loading…</p>,
});

type Grid = {
  lats: number[];
  lons: number[];
  t0: string;
  scores: number[][];
  tonight: (number | null)[];
  tomorrow: (number | null)[];
};
type Hourly = Record<string, (number | null)[]> & { time: string[] };
const now = () => Date.now();
const hr = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric" });
const hm = (d: Date | null) =>
  d
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "–";
const day = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short" });

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

/** Star Gazing Forecast: your night, the national map, and what to point at. */
export function StarsView({ colors }: { colors: Colors }) {
  const c = (k: string) =>
    pick(
      colors,
      `sky:${k}`,
      [...SKY_BANDS, ...SKY_APERTURE].find((b) => b.key === k)?.color ??
        "#ffffff",
    );
  const { active } = usePlaces();
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const place = picked
    ? {
        ...picked,
        label: `${picked.lat.toFixed(1)}°, ${picked.lon.toFixed(1)}°`,
      }
    : active
      ? { lat: active.lat, lon: active.lon, label: active.label }
      : null;
  const here = useJson<{ hourly: Hourly }>(
    place
      ? `/api/sky/here?lat=${place.lat.toFixed(2)}&lon=${place.lon.toFixed(2)}`
      : null,
  );
  const hours = useMemo<
    (SkyHour & { f: ReturnType<typeof skyScore> })[]
  >(() => {
    if (!place || !here || here === "error") return [];
    const h = here.hourly;
    const from = Math.floor(now() / 3600_000) * 3600_000;
    return h.time
      .map((t, i) => {
        const at = new Date(`${t}:00Z`);
        const f = skyScore({
          at,
          lat: place.lat,
          lon: place.lon,
          cloud: h.cloud_cover[i] ?? 50,
          low: h.cloud_cover_low[i],
          mid: h.cloud_cover_mid[i],
          high: h.cloud_cover_high[i],
          rh: h.relative_humidity_2m[i] ?? 60,
          precip: h.precipitation[i] ?? 0,
          vis: h.visibility[i],
        });
        return { at, score: f.score, f };
      })
      .filter((x) => x.at.getTime() >= from)
      .slice(0, 36);
  }, [here, place?.lat, place?.lon]); // eslint-disable-line react-hooks/exhaustive-deps -- the point is the input

  return (
    <div className="grid gap-4">
      {place ? (
        <Tonight
          place={place}
          hours={hours}
          state={here}
          c={c}
          picked={!!picked}
          onReset={() => setPicked(null)}
        />
      ) : (
        <p className={s.card}>
          Set your location on the Homepage, or tap the map, to see your night
          hour by hour.
        </p>
      )}
      <HomeTabs
        label="Star gazing"
        tabs={[
          {
            id: "sg-map",
            label: "Map",
            icon: <MapIcon aria-hidden />,
            panel: <SkyMap c={c} onPick={setPicked} />,
          },
          {
            id: "sg-hours",
            label: "Hour by Hour",
            icon: <BarChart3 aria-hidden />,
            panel: <Hours hours={hours} c={c} />,
          },
          {
            id: "sg-targets",
            label: "Targets",
            icon: <Telescope aria-hidden />,
            panel: place ? (
              <Targets lat={place.lat} lon={place.lon} c={c} />
            ) : (
              <p className={s.muted}>Pick a place first.</p>
            ),
          },
        ]}
      />
      <p className={s.foot}>
        Score = darkness × cloud (low, middle and high layers weighed) × moon ×
        air (humidity, haze, rain), from Open-Meteo model forecasts and computed
        sun and moon positions. Star positions from SIMBAD.
      </p>
    </div>
  );
}

function Tonight({
  place,
  hours,
  state,
  c,
  picked,
  onReset,
}: {
  place: { lat: number; lon: number; label: string };
  hours: (SkyHour & { f: ReturnType<typeof skyScore> })[];
  state: unknown;
  c: (k: string) => string;
  picked: boolean;
  onReset: () => void;
}) {
  const sky = useMemo(() => {
    const at = new Date(now());
    const n = nightWindow(place.lat, place.lon, at);
    const ill = moonIllumination(at);
    const mt = [0, 1].map((d) =>
      moonTimes(new Date(at.getTime() + d * 86400_000), place.lat, place.lon),
    );
    const next = (k: "rise" | "set") =>
      mt.map((m) => m[k]).find((t) => t && t > at) ?? null;
    return { n, ill, rise: next("rise"), set: next("set") };
  }, [place.lat, place.lon]);
  const dark = hours.filter(
    (h) => sunPosition(h.at, place.lat, place.lon).altitude < -12,
  );
  const firstNight: typeof hours = [];
  for (const h of dark) {
    if (
      firstNight.length &&
      h.at.getTime() - firstNight[firstNight.length - 1].at.getTime() > 3600_000
    )
      break;
    firstNight.push(h);
  }
  const best = bestRun(firstNight, 60);
  const peak = firstNight.reduce<(typeof hours)[number] | null>(
    (b, h) => (!b || h.score > b.score ? h : b),
    null,
  );
  const band = peak ? bandOf(peak.score) : null;
  return (
    <section className={s.tonight}>
      <div className={s.head}>
        <div>
          <p className={s.eyebrow}>Tonight · {place.label}</p>
          {state === "error" ? (
            <p className={s.muted}>
              The sky forecast isn&apos;t answering right now.
            </p>
          ) : !state ? (
            <p className={s.muted}>Reading the sky…</p>
          ) : peak && band ? (
            <h2>
              Best {peak.score}{" "}
              <span style={{ color: c(band.key) }}>{band.label}</span>
            </h2>
          ) : (
            <h2>No dark hours tonight</h2>
          )}
        </div>
        {picked && (
          <button type="button" className={s.reset} onClick={onReset}>
            Back to my place
          </button>
        )}
      </div>
      {peak && (
        <p className={s.read}>
          {best
            ? `Good skies ${hr(best.start)}–${hr(best.end)} (${best.hours} hours at 60+). `
            : `Peaks around ${hr(peak.at)}. `}
          {peak.f.limiting
            ? `Holding it back: ${peak.f.limiting.label.toLowerCase()}, ${peak.f.limiting.detail}.`
            : "Nothing is holding it back."}
        </p>
      )}
      {peak && (
        <div className={s.factors}>
          {peak.f.factors.map((f) => (
            <div key={f.key}>
              <span>{f.label}</span>
              <i>
                <b style={{ transform: `scaleX(${f.value})` }} />
              </i>
              <small>{f.detail}</small>
            </div>
          ))}
        </div>
      )}
      <dl className={s.times}>
        <div>
          <dt>Dark from</dt>
          <dd>{hm(sky.n.darkStart)}</dd>
        </div>
        <div>
          <dt>Dark until</dt>
          <dd>{hm(sky.n.darkEnd)}</dd>
        </div>
        <div>
          <dt>Moon</dt>
          <dd>
            {sky.ill.emoji} {Math.round(sky.ill.fraction * 100)}%
          </dd>
        </div>
        <div>
          <dt>Moonrise / set</dt>
          <dd>
            {hm(sky.rise)} / {hm(sky.set)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function SkyMap({
  c,
  onPick,
}: {
  c: (k: string) => string;
  onPick: (p: { lat: number; lon: number }) => void;
}) {
  const g = useJson<Grid>("/api/sky/grid");
  const [view, setView] = useState<"tonight" | "tomorrow" | "hour">("tonight");
  const [hi, setHi] = useState(0);
  const [playing, setPlaying] = useState(false);
  const grid = g && g !== "error" ? g : null;
  const steps = grid?.scores[0]?.length ?? 1;
  // Play walks the hours and loops; leaving "By hour" stops it.
  useEffect(() => {
    if (!playing || view !== "hour") return;
    const t = setInterval(() => setHi((h) => (h + 1) % steps), 900);
    return () => clearInterval(t);
  }, [playing, view, steps]);
  const stops: { at: number; color: string }[] = [...SKY_BANDS]
    .reverse()
    .map((b) => ({ at: b.min, color: c(b.key) }));
  stops.push({ at: 100, color: c("pristine") });
  const stopKey = stops.map((x) => x.color).join();
  const [img, setImg] = useState<{ key: string; url: string | null } | null>(
    null,
  );
  const key = grid ? `${grid.t0}${view}${hi}${stopKey}` : "";
  useEffect(() => {
    if (!grid) return;
    const n = grid.lons.length;
    const val = (i: number, j: number) => {
      const k = i * n + j;
      return view === "tonight"
        ? grid.tonight[k]
        : view === "tomorrow"
          ? grid.tomorrow[k]
          : (grid.scores[k]?.[hi] ?? null);
    };
    // Paint after the frame so tab switches stay smooth.
    const id = requestAnimationFrame(() =>
      setImg({ key, url: rasterize(grid.lats, grid.lons, val, stops) }),
    );
    return () => cancelAnimationFrame(id);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key covers grid, view, hour and colors
  const t = grid ? new Date(Date.parse(grid.t0) + hi * 3600_000) : null;
  const title =
    view === "tonight"
      ? "Stargazing tonight · best two dark hours"
      : view === "tomorrow"
        ? "Stargazing tomorrow night · best two dark hours"
        : `Stargazing at ${t ? `${day(t)} ${hr(t)}` : ""}`;
  return (
    <div className="grid gap-3">
      <div className={s.pills} role="group" aria-label="When">
        {(
          [
            ["tonight", "Tonight"],
            ["tomorrow", "Tomorrow night"],
            ["hour", "By hour"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === view}
            onClick={() => {
              setView(k);
              setPlaying(false);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {view === "hour" && grid && (
        <div className={s.scrub}>
          <button
            type="button"
            className={s.play}
            aria-label={playing ? "Pause" : "Play the hours"}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </button>
          <input
            type="range"
            min={0}
            max={(grid.scores[0]?.length ?? 1) - 1}
            value={hi}
            onChange={(e) => {
              setPlaying(false);
              setHi(+e.target.value);
            }}
            aria-label="Hour"
          />
          <b>{t ? `${day(t)} ${hr(t)}` : ""}</b>
        </div>
      )}
      <UsMap
        title={title}
        legend={SKY_BANDS.map((b) => ({
          label: `${b.label} ${b.min}+`,
          color: c(b.key),
        }))}
        status={!g ? "loading" : g === "error" ? "error" : "ready"}
        file={`sswx-stargazing-${view}`}
        onTap={(x, y) => onPick(unproject(x, y))}
      >
        {img?.key === key && img.url && (
          <image
            href={img.url}
            x={0}
            y={0}
            width={975}
            height={610}
            preserveAspectRatio="none"
          />
        )}
      </UsMap>
      <p className={s.muted}>
        Lower 48. Tap anywhere on the map to see that spot&apos;s night above.
      </p>
      {g === "error" && (
        <p className={s.muted}>
          The national sky forecast isn&apos;t answering right now. Try again
          soon.
        </p>
      )}
    </div>
  );
}

function Hours({
  hours,
  c,
}: {
  hours: (SkyHour & { f: ReturnType<typeof skyScore> })[];
  c: (k: string) => string;
}) {
  if (!hours.length)
    return <p className={s.muted}>Pick a place to see its next 36 hours.</p>;
  const W = 360;
  const H = 150;
  const bw = W / hours.length;
  return (
    <div className={s.card}>
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        className="w-full"
        role="img"
        aria-label="Stargazing score by hour"
      >
        {[20, 40, 60, 80].map((v) => (
          <line
            key={v}
            x1={0}
            x2={W}
            y1={H - (v / 100) * H}
            y2={H - (v / 100) * H}
            stroke="var(--line)"
            strokeWidth={0.6}
          />
        ))}
        {hours.map((h, i) => (
          <g key={h.at.toISOString()}>
            {h.f.factors[0].value > 0 && (
              <rect
                x={i * bw}
                y={0}
                width={bw}
                height={H}
                fill="#0b1030"
                opacity={0.5 * h.f.factors[0].value}
              />
            )}
            <rect
              x={i * bw + 1}
              y={H - (h.score / 100) * H}
              width={Math.max(1, bw - 2)}
              height={(h.score / 100) * H}
              rx={1.5}
              fill={c(bandOf(h.score).key)}
            />
            {i % 3 === 0 && (
              <text
                x={i * bw + bw / 2}
                y={H + 13}
                fontSize={8.5}
                textAnchor="middle"
                fill="var(--muted)"
              >
                {hr(h.at).replace(" ", "")}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className={s.muted}>
        Shaded columns are dark hours. Each bar is that hour&apos;s score out of
        100.
      </p>
      <ul className={s.list}>
        {hours
          .filter((h) => h.f.factors[0].value > 0)
          .map((h, i, list) => (
            <li key={h.at.toISOString()}>
              <b>
                {!i || h.at.getTime() - list[i - 1].at.getTime() > 3600_000
                  ? `${day(h.at)} ${hr(h.at)}`
                  : hr(h.at)}
              </b>
              <span>
                <i style={{ background: c(bandOf(h.score).key) }} />
                {h.score}
              </span>
              <small>
                {h.f.limiting
                  ? `${h.f.limiting.label}: ${h.f.limiting.detail}`
                  : "clear and dark"}
              </small>
            </li>
          ))}
      </ul>
    </div>
  );
}
