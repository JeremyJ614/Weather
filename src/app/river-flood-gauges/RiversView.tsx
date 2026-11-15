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
import { InfoScrub } from "@/components/charts/InfoScrub";

const now = () => Date.now();
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
      {open && <Hydrograph g={g} c={c} />}
    </div>
  );
}

function Hydrograph({ g, c }: { g: Gauge; c: (l: string) => string }) {
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
  return <HydroChart g={g} d={d} c={c} />;
}

/** VIP's hydrograph, redrawn: flood bands, observed trace with fill, forecast, crest and now. */
function HydroChart({
  g,
  d,
  c,
}: {
  g: Gauge;
  d: { observed: Hydro; forecast: Hydro; units: string };
  c: (l: string) => string;
}) {
  const W = 720;
  const H = 280;
  const P = { l: 44, r: 12, t: 16, b: 30 };
  const all = [...d.observed, ...d.forecast];
  const ts = all.map((p) => Date.parse(p.t));
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const span = Math.max(1, t1 - t0);
  const stages = all.map((p) => p.v);
  const marks = (
    [
      ["action", g.action],
      ["minor", g.flood],
      ["moderate", g.moderate],
      ["major", g.major],
    ] as [string, number | null][]
  ).filter((m): m is [string, number] => m[1] != null);
  const peak = Math.max(...stages);
  const low = Math.min(...stages);
  const near = marks
    .filter((m) => m[1] <= peak + (peak - low || 1) * 1.4)
    .map((m) => m[1]);
  const lo = Math.min(low, ...near);
  const hi = Math.max(peak, ...near);
  const pad = (hi - lo || 1) * 0.16;
  const yLo = lo - pad;
  const yHi = hi + pad;
  const X = (t: string | number) =>
    P.l +
    (((typeof t === "string" ? Date.parse(t) : t) - t0) / span) *
      (W - P.l - P.r);
  const Y = (v: number) =>
    P.t + (1 - (v - yLo) / (yHi - yLo || 1)) * (H - P.t - P.b);
  const line = (h: Hydro) =>
    h
      .map(
        (p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`,
      )
      .join("");
  const bands = marks.filter((m) => m[1] >= yLo && m[1] <= yHi);
  const crest = d.forecast.length
    ? d.forecast.reduce((m, p) => (p.v > m.v ? p : m))
    : null;
  const last = d.observed.at(-1);
  const hours = span / 3600_000;
  const step = hours > 120 ? 24 : hours > 48 ? 12 : 6;
  const ticks: number[] = [];
  const start = new Date(t0);
  start.setMinutes(0, 0, 0);
  for (let t = start.getTime(); t <= t1; t += step * 3600_000)
    if (t >= t0) ticks.push(t);
  const nowX = X(Math.min(Math.max(now(), t0), t1));
  const accent = c(g.level === "normal" ? "normal" : g.level);
  const seq = [...d.observed, ...d.forecast];
  return (
    <figure className={s.hydro}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${g.name} hydrograph`}
      >
        <defs>
          <linearGradient id={`hg-${g.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[...bands].reverse().map(([k, v]) => (
          <g key={k}>
            <rect
              x={P.l}
              y={P.t}
              width={W - P.l - P.r}
              height={Math.max(0, Y(v) - P.t)}
              fill={c(k)}
              opacity={0.07}
            />
            <line
              x1={P.l}
              x2={W - P.r}
              y1={Y(v)}
              y2={Y(v)}
              stroke={c(k)}
              strokeDasharray="5 4"
              opacity={0.8}
            />
            <text
              x={W - P.r - 2}
              y={Y(v) - 4}
              textAnchor="end"
              fontSize={10}
              fill={c(k)}
              fontFamily="var(--font-mono)"
            >
              {k.toUpperCase()} {v}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = yLo + (yHi - yLo) * f;
          return (
            <g key={f}>
              <line
                x1={P.l}
                x2={W - P.r}
                y1={Y(v)}
                y2={Y(v)}
                stroke="var(--line)"
              />
              <text
                x={P.l - 6}
                y={Y(v) + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--muted)"
                fontFamily="var(--font-mono)"
              >
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}
        {ticks.map((t) => (
          <text
            key={t}
            x={X(t)}
            y={H - 10}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted)"
            fontFamily="var(--font-mono)"
          >
            {step >= 24
              ? new Date(t).toLocaleDateString("en-US", {
                  month: "numeric",
                  day: "numeric",
                })
              : new Date(t)
                  .toLocaleTimeString("en-US", { hour: "numeric" })
                  .replace(" ", "")}
          </text>
        ))}
        <line
          x1={nowX}
          x2={nowX}
          y1={P.t}
          y2={H - P.b}
          stroke="var(--accent)"
          strokeDasharray="2 3"
          opacity={0.6}
        />
        {d.observed.length > 1 && (
          <path
            d={`${line(d.observed)}L${X(d.observed.at(-1)!.t).toFixed(1)},${H - P.b}L${X(d.observed[0].t).toFixed(1)},${H - P.b}Z`}
            fill={`url(#hg-${g.id})`}
          />
        )}
        <path
          d={line(d.observed)}
          fill="none"
          stroke={accent}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        {d.forecast.length > 0 && (
          <path
            d={line(d.forecast)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="7 5"
          />
        )}
        {last && (
          <circle
            cx={X(last.t)}
            cy={Y(last.v)}
            r={4.5}
            fill={accent}
            stroke="#0b0c14"
            strokeWidth={1.5}
          />
        )}
        {crest && (
          <g>
            <circle
              cx={X(crest.t)}
              cy={Y(crest.v)}
              r={4}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.6}
            />
            <text
              x={X(crest.t)}
              y={Y(crest.v) - 9}
              textAnchor="middle"
              fontSize={10.5}
              fontWeight={700}
              fill="var(--accent)"
            >
              Crest {crest.v} {d.units}
            </text>
          </g>
        )}
        <InfoScrub
          label={`${g.name} river stage`}
          xs={seq.map((p) => X(p.t))}
          top={P.t}
          bottom={H - P.b}
          width={W}
          height={H}
          font={16}
          start={Math.max(0, d.observed.length - 1)}
          title={(i) =>
            new Date(seq[i].t).toLocaleString("en-US", {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })
          }
          series={[
            {
              key: "stage",
              label: "Stage",
              color: accent,
              y: seq.map((p) => Y(p.v)),
              text: seq.map((p) => `${p.v} ${d.units}`),
            },
          ]}
          rows={(i) => {
            const v = seq[i].v;
            const band = [...marks].reverse().find((m) => v >= m[1]);
            return [
              {
                label: i < d.observed.length ? "Observed" : "Forecast",
                text: band
                  ? band[0][0].toUpperCase() + band[0].slice(1)
                  : "Below action",
                color: band ? c(band[0]) : undefined,
              },
            ];
          }}
        />
      </svg>
      <figcaption className={s.muted}>
        Solid: observed{last ? ` (now ${last.v} ${d.units})` : ""}. Dashed: NWS
        forecast
        {crest
          ? `, cresting ${new Date(crest.t).toLocaleString("en-US", { weekday: "short", hour: "numeric" })}`
          : ""}
        .{" "}
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
