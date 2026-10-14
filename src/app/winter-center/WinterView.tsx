"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Building2,
  Clock,
  Map as MapIcon,
  MapPin,
  Percent,
  Siren,
} from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { GeoMap } from "@/features/hazards/GeoMap";
import { OverlayMap } from "@/features/winter/OverlayMap";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import type { WinterAlert, WinterHere } from "@/lib/winter/data";
import { PROB, PROB_KINDS, type ProbKind } from "@/lib/winter/style";
import s from "./Winter.module.css";

type Overlay = {
  id: string;
  label: string;
  note: string;
  bounds: [number, number, number, number];
};
type City = { city: string; total: number; days: number[] };
const weekday = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
const hour = (t: string) =>
  new Date(t).toLocaleTimeString("en-US", { hour: "numeric" });
const inch = (x: number) => (x >= 0.1 ? `${x.toFixed(1)}″` : "0″");

/** Winter Center: storm map, snow & ice odds, alerts, your timeline and city snowfall. */
export function WinterView({
  overlays,
  odds,
  alerts,
  cities,
  colors,
}: {
  overlays: Overlay[];
  odds: Record<string, number>;
  alerts: WinterAlert[] | null;
  cities: City[] | null;
  colors: Colors;
}) {
  return (
    <div className="grid gap-4">
      <YourWinter />
      <HomeTabs
        label="Winter"
        variant="pills"
        tabs={[
          {
            id: "w-map",
            label: "Storm Map",
            icon: <MapIcon aria-hidden />,
            panel: <StormMap overlays={overlays} />,
          },
          {
            id: "w-odds",
            label: "Snow & Ice Odds",
            icon: <Percent aria-hidden />,
            panel: <Odds odds={odds} colors={colors} />,
          },
          {
            id: "w-alerts",
            label: "Alerts",
            icon: <BellRing aria-hidden />,
            panel: <Alerts alerts={alerts} />,
          },
          {
            id: "w-time",
            label: "Your Timeline",
            icon: <Clock aria-hidden />,
            panel: <Timeline />,
          },
          {
            id: "w-cities",
            label: "City Snowfall",
            icon: <Building2 aria-hidden />,
            panel: <Cities cities={cities} />,
          },
        ]}
      />
      <p className={s.foot}>
        Sources: NWS Winter Storm Severity Index and probabilistic winter
        forecasts (Weather Prediction Center), NOHRSC National Snow Analysis,
        NWS alerts, and Open-Meteo hourly and city forecasts.
      </p>
    </div>
  );
}

/** Shared fetch of the active place's winter data. */
function useWinterHere() {
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : "";
  const [res, setRes] = useState<{
    key: string;
    d: WinterHere | "error";
  } | null>(null);
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch(`/api/winter/here?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: WinterHere) => live && setRes({ key, d }))
      .catch(() => live && setRes({ key, d: "error" }));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key is the place
  return { active, d: res?.key === key ? res.d : null };
}

function YourWinter() {
  const { active, d } = useWinterHere();
  if (!active)
    return (
      <p className={s.card}>
        Set your location on the Homepage to see snow and winter alerts where
        you live.
      </p>
    );
  if (d === "error")
    return (
      <p className={s.card}>
        Your winter forecast isn&apos;t available right now.
      </p>
    );
  const total = d ? d.days.reduce((a, x) => a + x.snow, 0) : 0;
  const first = d?.hours.find((h) => h.snow >= 0.05);
  return (
    <section className={s.card}>
      <p className={s.place}>
        <MapPin aria-hidden /> {active.label}
      </p>
      {!d ? (
        <p className={s.muted}>Checking your winter forecast…</p>
      ) : (
        <>
          <h2 className={s.big}>
            {total >= 0.1
              ? `${total.toFixed(1)}″ of snow this week`
              : d.alerts.length
                ? "Little or no snow at your spot"
                : "No snow in the 7-day forecast"}
          </h2>
          {total < 0.1 && d.alerts.length > 0 && (
            <p className={s.muted}>
              The alert below likely covers higher terrain or nearby areas; your
              exact spot&apos;s forecast stays mostly rain or dry.
            </p>
          )}

          {first && (
            <p className={s.muted}>
              First flakes around{" "}
              {new Date(first.t).toLocaleString("en-US", {
                weekday: "short",
                hour: "numeric",
              })}
              .
            </p>
          )}
          {d.alerts.map((a) => (
            <p key={a.headline} className={s.alert}>
              <Siren aria-hidden />
              <b>{a.event}</b>
              {a.ends && (
                <small>
                  until{" "}
                  {new Date(a.ends).toLocaleString("en-US", {
                    weekday: "short",
                    hour: "numeric",
                  })}
                </small>
              )}
            </p>
          ))}
          <div className={s.week}>
            {d.days.map((x) => (
              <div key={x.d} data-snow={x.snow >= 0.1 || undefined}>
                <span>{weekday(x.d)}</span>
                <b>{inch(x.snow)}</b>
                <small>
                  {x.high}° / {x.low}°
                </small>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function StormMap({ overlays }: { overlays: Overlay[] }) {
  const [id, setId] = useState(overlays[0].id);
  const o = overlays.find((x) => x.id === id)!;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map">
        {overlays.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === id}
            onClick={() => setId(x.id)}
            className={s.pill}
          >
            {x.label}
          </button>
        ))}
      </div>
      <OverlayMap
        url={`/api/winter/img?id=${id}`}
        bounds={o.bounds}
        label={o.label}
      />
      <p className={s.muted}>
        {o.note}{" "}
        {id.startsWith("wssi") &&
          "Out of season this map is empty: no winter impact expected anywhere."}
      </p>
    </div>
  );
}

function Odds({
  odds,
  colors,
}: {
  odds: Record<string, number>;
  colors: Colors;
}) {
  const [day, setDay] = useState(1);
  const [kind, setKind] = useState<ProbKind>("snow4");
  const url = useMemo(
    () => `/api/winter/odds?day=${day}&kind=${kind}`,
    [day, kind],
  );
  const top = odds[`${day}:${kind}`] ?? 0;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day">
        {[1, 2, 3].map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === day}
            onClick={() => setDay(d)}
            className={s.pill}
          >
            {d === 1 ? "Today" : d === 2 ? "Tomorrow" : "Day 3"}
          </button>
        ))}
      </div>
      <div className={s.kinds} role="group" aria-label="Amount">
        {(Object.keys(PROB_KINDS) as ProbKind[]).map((k) => {
          const t = odds[`${day}:${k}`] ?? 0;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={k === kind}
              onClick={() => setKind(k)}
              style={{
                ["--c" as string]: t
                  ? pick(colors, `winter:prob:${t}`, PROB[t - 1].color)
                  : "var(--line)",
              }}
            >
              <i />
              {PROB_KINDS[k].label}
            </button>
          );
        })}
      </div>
      <GeoMap url={url} label={`Odds of ${PROB_KINDS[kind].label}`} />
      <p className={s.muted}>
        {top
          ? `Highest odds anywhere: ${PROB[top - 1].label}.`
          : `Under 10% everywhere for ${PROB_KINDS[kind].label} on this day.`}
      </p>
      <div className={s.legend}>
        {PROB.map((p, i) => (
          <span key={p.label}>
            <i
              style={{
                background: pick(colors, `winter:prob:${i + 1}`, p.color),
              }}
            />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Alerts({ alerts }: { alerts: WinterAlert[] | null }) {
  if (!alerts)
    return (
      <p className={s.muted}>
        The Weather Service&apos;s alert feed isn&apos;t answering right now.
      </p>
    );
  if (!alerts.length)
    return (
      <p className={s.card}>
        No winter alerts in effect anywhere in the country right now.
      </p>
    );
  return (
    <ul className={s.alerts}>
      {alerts.map((a) => (
        <li key={a.event}>
          <b>{a.event}</b>
          <span>
            {a.count} {a.count === 1 ? "alert" : "alerts"} ·{" "}
            {a.states.join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Timeline() {
  const { active, d } = useWinterHere();
  if (!active)
    return (
      <p className={s.card}>
        Set your location on the Homepage to see hour by hour.
      </p>
    );
  if (!d) return <p className={s.muted}>Loading…</p>;
  if (d === "error" || !d.hours.length)
    return (
      <p className={s.muted}>
        The hourly forecast isn&apos;t available right now.
      </p>
    );
  const max = Math.max(0.3, ...d.hours.map((h) => h.snow));
  const temps = d.hours.map((h) => h.temp);
  const lo = Math.min(...temps, 20);
  const hi = Math.max(...temps, 40);
  const y = (t: number) => 96 - ((t - lo) / (hi - lo)) * 80;
  const freeze = y(32);
  return (
    <div className="grid gap-2">
      <svg
        viewBox="0 0 360 120"
        className="w-full"
        role="img"
        aria-label="Snowfall and temperature, next 72 hours"
      >
        <line
          x1="0"
          x2="360"
          y1={freeze}
          y2={freeze}
          stroke="#7dd3fc"
          strokeDasharray="3 4"
          strokeOpacity="0.6"
        />
        <text
          x="356"
          y={freeze - 3}
          fontSize="7"
          textAnchor="end"
          fill="#7dd3fc"
        >
          32°
        </text>
        {d.hours.map((h, i) => (
          <rect
            key={h.t}
            x={i * 5}
            width="4"
            y={100 - (h.snow / max) * 60}
            height={(h.snow / max) * 60}
            fill="#e0f2fe"
            opacity={h.snow ? 0.9 : 0}
          />
        ))}
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          points={d.hours.map((h, i) => `${i * 5 + 2},${y(h.temp)}`).join(" ")}
        />
        {d.hours
          .filter((_, i) => i % 12 === 0)
          .map((h, i) => (
            <text
              key={h.t}
              x={i * 60 + 2}
              y="117"
              fontSize="7"
              fill="var(--muted)"
            >
              {new Date(h.t).toLocaleString("en-US", {
                weekday: "short",
                hour: "numeric",
              })}
            </text>
          ))}
      </svg>
      <p className={s.muted}>
        Bars: snowfall per hour (peak {inch(max === 0.3 ? 0 : max)}). Line:
        temperature. Dashed: freezing.
      </p>
      <div className={s.hours}>
        {d.hours
          .filter((h) => h.snow >= 0.05)
          .slice(0, 24)
          .map((h) => (
            <span key={h.t}>
              {hour(h.t)} <b>{inch(h.snow)}</b> {h.temp}°
            </span>
          ))}
      </div>
    </div>
  );
}

function Cities({ cities }: { cities: City[] | null }) {
  if (!cities)
    return (
      <p className={s.muted}>City forecasts aren&apos;t available right now.</p>
    );
  const snowy = cities.filter((c) => c.total >= 0.1);
  if (!snowy.length)
    return (
      <p className={s.card}>
        None of our 30 snow-belt and mountain cities has snow in the next 5
        days.
      </p>
    );
  const max = Math.max(...snowy.map((c) => c.total));
  return (
    <ol className={s.cities}>
      {snowy.map((c) => (
        <li key={c.city}>
          <span>{c.city}</span>
          <i>
            <em style={{ transform: `scaleX(${c.total / max})` }} />
          </i>
          <b>{c.total.toFixed(1)}″</b>
        </li>
      ))}
    </ol>
  );
}
