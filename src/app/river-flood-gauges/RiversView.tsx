"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  ExternalLink,
  MapPin,
  Map as MapIcon,
  Trophy,
} from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { usePlaces } from "@/features/location/usePlaces";
import { project } from "@/lib/map/usAlbers";
import { pick, type Colors } from "@/lib/colors/pick";
import type { Gauge, Hydro } from "@/lib/rivers/data";
import { GAUGE_LEVELS } from "@/lib/rivers/style";
import s from "./Rivers.module.css";

type Ahead = Gauge & { when: string | null };
const label = (lvl: string) =>
  GAUGE_LEVELS.find((l) => l.key === lvl)?.label ?? lvl;
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "short",
        hour: "numeric",
      }) + " CT"
    : "";

/** River & Flood Gauges: the worst five, the map, forecast floods and your gauges. */
export function RiversView({
  now,
  ahead,
  colors,
}: {
  now: Gauge[];
  ahead: Ahead[] | null;
  colors: Colors;
}) {
  const c = (lvl: string) =>
    pick(
      colors,
      `gauge:${lvl}`,
      GAUGE_LEVELS.find((l) => l.key === lvl)?.color ?? "#888888",
    );
  const count = (lvl: string) => now.filter((g) => g.level === lvl).length;
  return (
    <div className="grid gap-4">
      <div className={s.band}>
        {["major", "moderate", "minor", "action"].map((l) => (
          <div key={l} style={{ ["--c" as string]: c(l) }}>
            <b>{count(l)}</b>
            <span>
              {label(l).replace(" flooding", "").replace(" stage", "")}
            </span>
          </div>
        ))}
      </div>
      <HomeTabs
        label="Rivers"
        tabs={[
          {
            id: "rv-top",
            label: "Worst 5",
            icon: <Trophy aria-hidden />,
            panel: now.length ? (
              <ol className="grid gap-2">
                {now.slice(0, 5).map((g, i) => (
                  <li key={g.id}>
                    <GaugeCard g={g} rank={i + 1} c={c} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className={s.card}>
                No river in the country is at action stage or higher right now.
              </p>
            ),
          },
          {
            id: "rv-map",
            label: "Map",
            icon: <MapIcon aria-hidden />,
            panel: (
              <UsMap
                title="River gauges at action stage or higher"
                legend={GAUGE_LEVELS.filter((l) => l.key !== "normal").map(
                  (l) => ({ label: l.label, color: c(l.key) }),
                )}
                status={now.length ? "ready" : "empty"}
                file="sswx-river-gauges"
                overlay={
                  <g>
                    {[...now].reverse().map((g) => {
                      const p = project(g.lon, g.lat);
                      return (
                        <circle
                          key={g.id}
                          cx={p.x}
                          cy={p.y}
                          r={g.level === "action" ? 3 : 4.5}
                          fill={c(g.level)}
                          stroke="#0b0c14"
                          strokeWidth={0.8}
                        />
                      );
                    })}
                  </g>
                }
              />
            ),
          },
          {
            id: "rv-ahead",
            label: "Forecast to Flood",
            icon: <CalendarClock aria-hidden />,
            panel: !ahead ? (
              <p className={s.muted}>
                River forecasts aren&apos;t answering right now.
              </p>
            ) : ahead.length ? (
              <ul className="grid gap-2">
                {ahead.slice(0, 25).map((g) => (
                  <li
                    key={g.id}
                    className={s.row}
                    style={{ ["--c" as string]: c(g.level) }}
                  >
                    <i />
                    <span>
                      <b>
                        {g.river ? `${g.river} at ${g.name}` : g.name},{" "}
                        {g.state}
                      </b>
                      <small>
                        {label(g.level)} forecast
                        {g.when ? ` around ${when(g.when)}` : ""} · {g.stage}{" "}
                        {g.units} (flood stage {g.flood ?? "–"})
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.card}>
                No river is forecast to reach flood stage in the next five days.
              </p>
            ),
          },
          {
            id: "rv-near",
            label: "Near You",
            icon: <MapPin aria-hidden />,
            panel: <Near c={c} />,
          },
        ]}
      />
      <p className={s.foot}>
        Source: NOAA National Water Prediction Service river gauges and
        forecasts, updated about every 15 minutes. Tap a gauge for its last
        three days and official forecast.
      </p>
    </div>
  );
}

function GaugeCard({
  g,
  rank,
  c,
}: {
  g: Gauge;
  rank?: number;
  c: (l: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const marks = [
    ["Action", g.action],
    ["Flood", g.flood],
    ["Moderate", g.moderate],
    ["Major", g.major],
  ].filter((m): m is [string, number] => m[1] != null);
  const top = Math.max(g.stage ?? 0, ...marks.map((m) => m[1])) * 1.08 || 1;
  const low = Math.min(...marks.map((m) => m[1]), g.stage ?? 0);
  const bottom = low - Math.max(1, (top - low) * 0.25);
  const pos = (v: number) =>
    Math.max(0, Math.min(100, ((v - bottom) / (top - bottom)) * 100));
  return (
    <div className={s.gauge} style={{ ["--c" as string]: c(g.level) }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
        <header>
          {rank && <i className={s.rank}>{rank}</i>}
          <span>
            <b>{g.river || g.name}</b>
            <small>
              {g.name}, {g.state}
            </small>
          </span>
          <em>{label(g.level)}</em>
        </header>
        <div className={s.stage}>
          <b>
            {g.stage ?? "–"} <small>{g.units}</small>
          </b>
          {g.flood != null && g.stage != null && (
            <span>
              {g.stage >= g.flood
                ? `${Math.round((g.stage - g.flood) * 10) / 10} ${g.units} over flood stage`
                : `${Math.round((g.flood - g.stage) * 10) / 10} ${g.units} below flood stage`}
            </span>
          )}
        </div>
        {marks.length > 0 && (
          <>
            <div className={s.bar}>
              <i
                style={{ transform: `scaleX(${pos(g.stage ?? bottom) / 100})` }}
              />
              {marks.map(([k, v]) => (
                <u
                  key={k}
                  style={{ left: `${pos(v)}%` }}
                  title={`${k} ${v} ${g.units}`}
                />
              ))}
            </div>
            <small className={s.marks}>
              {marks.map(([k, v]) => `${k} ${v}`).join(" · ")}
            </small>
          </>
        )}
      </button>
      {open && <Hydrograph g={g} />}
    </div>
  );
}

function Hydrograph({ g }: { g: Gauge }) {
  const [d, setD] = useState<
    { observed: Hydro; forecast: Hydro; units: string } | "error" | null
  >(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/rivers/gauge?id=${g.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x) => live && setD(x))
      .catch(() => live && setD("error"));
    return () => {
      live = false;
    };
  }, [g.id]);
  if (!d) return <p className={s.muted}>Loading the hydrograph…</p>;
  if (d === "error" || (!d.observed.length && !d.forecast.length))
    return (
      <p className={s.muted}>
        This gauge&apos;s history isn&apos;t available right now.
      </p>
    );
  const all = [...d.observed, ...d.forecast];
  const t0 = Date.parse(all[0].t);
  const t1 = Date.parse(all.at(-1)!.t);
  const lines = [g.flood, g.moderate, g.major].filter(
    (v): v is number => v != null,
  );
  const lo = Math.min(...all.map((p) => p.v), ...lines) - 0.5;
  const hi = Math.max(...all.map((p) => p.v), ...lines) + 0.5;
  const x = (t: string) =>
    4 + ((Date.parse(t) - t0) / Math.max(1, t1 - t0)) * 352;
  const y = (v: number) => 8 + ((hi - v) / (hi - lo)) * 104;
  const pts = (h: Hydro) =>
    h.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <figure className={s.hydro}>
      <svg
        viewBox="0 0 360 120"
        className="w-full"
        role="img"
        aria-label={`${g.name} stage, past 3 days and forecast`}
      >
        {lines.map((v, i) => (
          <line
            key={v}
            x1="0"
            x2="360"
            y1={y(v)}
            y2={y(v)}
            stroke={["#f97316", "#ef4444", "#d946ef"][i]}
            strokeDasharray="3 3"
            strokeOpacity="0.7"
          />
        ))}
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.8"
          points={pts(d.observed)}
        />
        {d.forecast.length > 0 && (
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
            strokeDasharray="4 3"
            points={pts(d.forecast)}
          />
        )}
      </svg>
      <figcaption className={s.muted}>
        Solid: observed. Dashed: NWS forecast. Lines: flood, moderate and major
        stage.{" "}
        <a
          href={`https://water.noaa.gov/gauges/${g.id.toLowerCase()}`}
          target="_blank"
          rel="noreferrer"
          className="text-accent"
        >
          NWPS page <ExternalLink className="inline size-3" aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
}

function Near({ c }: { c: (l: string) => string }) {
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : "";
  const [res, setRes] = useState<{
    key: string;
    d: (Gauge & { miles: number })[] | "error";
  } | null>(null);
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch(`/api/rivers/near?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((x) => live && setRes({ key, d: x.gauges }))
      .catch(() => live && setRes({ key, d: "error" }));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key is the place
  if (!active)
    return (
      <p className={s.muted}>
        Set your location on the Homepage to see your nearest river gauges.
      </p>
    );
  const d = res?.key === key ? res.d : null;
  if (!d) return <p className={s.muted}>Finding gauges near {active.label}…</p>;
  if (d === "error")
    return (
      <p className={s.muted}>
        The river gauge service isn&apos;t answering right now.
      </p>
    );
  if (!d.length)
    return (
      <p className={s.card}>
        No river gauge within 75 miles of {active.label}.
      </p>
    );
  return (
    <ol className="grid gap-2">
      {d.map((g) => (
        <li key={g.id} className="grid gap-1">
          <small className={s.muted}>{g.miles} mi away</small>
          <GaugeCard g={g} c={c} />
        </li>
      ))}
    </ol>
  );
}
