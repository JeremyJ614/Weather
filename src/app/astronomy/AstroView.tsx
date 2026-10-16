"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Orbit, Sun as SunIcon } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import {
  currentSeason,
  moonIllumination,
  moonPhases,
  moonPosition,
  nextMoonEvent,
  nightWindow,
  seasonEvents,
  sunPosition,
  sunTimes,
} from "@/lib/sky/astro";
import { planetsTonight } from "@/lib/sky/planets";
import { nextShowers } from "@/lib/sky/showers";
import { ASTRO_LINES } from "@/lib/sky/style";
import s from "./Astro.module.css";

const tm = (d: Date | null | undefined) =>
  d
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "–";
const dt = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
/** Phase and season instants are good to about a quarter hour, so they read to the hour. */
const about = (d: Date) =>
  `about ${new Date(Math.round(d.getTime() / 3600_000) * 3600_000).toLocaleTimeString("en-US", { hour: "numeric" })}`;
const dur = (ms: number) =>
  `${Math.floor(ms / 3600_000)}h ${Math.round((ms % 3600_000) / 60_000)}m`;

/** The clock, read after mount so the server and browser never disagree. */
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    queueMicrotask(() => setNow(new Date()));
    const t = setInterval(() => setNow(new Date()), 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Astronomy: the moon, the sun, the planets and the sky calendar, computed here. */
export function AstroView({ colors }: { colors: Colors }) {
  const c = (k: string) =>
    pick(
      colors,
      `astro:${k}`,
      ASTRO_LINES.find((x) => x.key === k)?.color ?? "#ffffff",
    );
  const { active } = usePlaces();
  const now = useNow();
  const place = active
    ? { lat: active.lat, lon: active.lon, label: active.label }
    : { lat: 39.83, lon: -98.58, label: "the middle of the Lower 48" };
  const moon = useMemo(() => {
    if (!now) return null;
    const ill = moonIllumination(now);
    const pos = moonPosition(now, place.lat, place.lon);
    let near = Infinity;
    let far = -Infinity;
    for (let d = -15; d <= 15; d++) {
      const km = moonPosition(
        new Date(now.getTime() + d * 86400_000),
        place.lat,
        place.lon,
      ).distanceKm;
      near = Math.min(near, km);
      far = Math.max(far, km);
    }
    return {
      ill,
      pos,
      rise: nextMoonEvent("rise", place.lat, place.lon, now),
      set: nextMoonEvent("set", place.lat, place.lon, now),
      close: far > near ? 1 - (pos.distanceKm - near) / (far - near) : 0.5,
    };
  }, [now, place.lat, place.lon]);
  if (!now || !moon) return <p className={s.muted}>Working out the sky…</p>;
  return (
    <div className="grid gap-4">
      {!active && (
        <p className={s.muted}>
          Set your location on the Homepage for your own sky; this is{" "}
          {place.label}.
        </p>
      )}
      <section className={s.hero}>
        <MoonDisk illum={moon.ill.fraction} waxing={moon.ill.waxing} />
        <div className="grid gap-1">
          <p className={s.eyebrow}>The moon now · {place.label}</p>
          <h2>{moon.ill.name}</h2>
          <p className={s.big}>
            {Math.round(moon.ill.fraction * 100)}% <small>lit</small>
          </p>
          <p className={s.muted}>
            Day {Math.floor(moon.ill.age)} of the 29.5-day cycle
          </p>
          <p className={s.muted}>
            {moon.pos.altitude > 0
              ? `Up now, ${Math.round(moon.pos.altitude)}° high`
              : "Below the horizon"}{" "}
            · rises {tm(moon.rise)}, sets {tm(moon.set)}
          </p>
          <p className={s.muted}>
            {Math.round(moon.pos.distanceKm).toLocaleString("en-US")} km away,{" "}
            {moon.close > 0.8
              ? "near its closest this month (a bigger, brighter disc)"
              : moon.close < 0.2
                ? "near its farthest this month"
                : "mid-way through its orbit"}
            .
          </p>
        </div>
      </section>
      <HomeTabs
        label="Astronomy"
        tabs={[
          {
            id: "as-night",
            label: "Tonight",
            icon: <Orbit aria-hidden />,
            panel: <Tonight now={now} place={place} c={c} />,
          },
          {
            id: "as-sun",
            label: "Sun & Seasons",
            icon: <SunIcon aria-hidden />,
            panel: <SunPanel now={now} place={place} />,
          },
          {
            id: "as-cal",
            label: "Sky Calendar",
            icon: <CalendarDays aria-hidden />,
            panel: <Calendar now={now} />,
          },
        ]}
      />
      <p className={s.foot}>
        Computed on your device: sun and moon from the U.S. Naval
        Observatory&apos;s algorithms, planets from JPL&apos;s Keplerian
        elements (checked against the USNO almanac), meteor showers from the IMO
        working list.
      </p>
    </div>
  );
}

/** The moon at its real phase: the terminator is a half-ellipse (ported from VIP). */
function MoonDisk({ illum, waxing }: { illum: number; waxing: boolean }) {
  const size = 132;
  const R = size / 2 - 6;
  const cx = size / 2;
  const pts: string[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const y = -R + (2 * R * i) / N;
    const w = Math.sqrt(Math.max(0, R * R - y * y));
    pts.push(`${(cx + (waxing ? -w : w)).toFixed(1)},${(cx + y).toFixed(1)}`);
  }
  for (let i = N; i >= 0; i--) {
    const y = -R + (2 * R * i) / N;
    const w = Math.sqrt(Math.max(0, R * R - y * y));
    pts.push(
      `${(cx + (1 - 2 * illum) * w * (waxing ? 1 : -1)).toFixed(1)},${(cx + y).toFixed(1)}`,
    );
  }
  const maria = [
    [-0.3, -0.34, 0.24, 0.2],
    [0.06, -0.3, 0.16, 0.18],
    [0.2, -0.06, 0.19, 0.19],
    [0.46, 0.06, 0.13, 0.17],
    [-0.12, 0.24, 0.21, 0.15],
    [-0.42, 0.2, 0.11, 0.14],
    [0, 0.46, 0.07, 0.24],
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-none"
      role="img"
      aria-label={`Moon, ${Math.round(illum * 100)}% lit`}
    >
      <defs>
        <radialGradient id="moon-face" cx="40%" cy="36%" r="68%">
          <stop offset="0%" stopColor="#fdfdf6" />
          <stop offset="60%" stopColor="#dcdbd1" />
          <stop offset="100%" stopColor="#a4a399" />
        </radialGradient>
        <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
          <stop
            offset="60%"
            stopColor="#cdd6ff"
            stopOpacity={0.35 * illum + 0.05}
          />
          <stop offset="100%" stopColor="#cdd6ff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="moon-clip">
          <circle cx={cx} cy={cx} r={R} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cx} r={R * 1.12} fill="url(#moon-glow)" />
      <g clipPath="url(#moon-clip)">
        <circle cx={cx} cy={cx} r={R} fill="url(#moon-face)" />
        {maria.map(([x, y, r, o], i) => (
          <circle
            key={i}
            cx={cx + x * R}
            cy={cx + y * R}
            r={r * R}
            fill="#6b6a60"
            opacity={o}
          />
        ))}
        <path d={`M${pts.join("L")}Z`} fill="#05060f" fillOpacity={0.93} />
      </g>
      <circle
        cx={cx}
        cy={cx}
        r={R}
        fill="none"
        stroke="#fff"
        strokeOpacity={0.14}
      />
    </svg>
  );
}

type Place = { lat: number; lon: number; label: string };

function Tonight({
  now,
  place,
  c,
}: {
  now: Date;
  place: Place;
  c: (k: string) => string;
}) {
  const planets = useMemo(() => {
    const n = nightWindow(place.lat, place.lon, now);
    return planetsTonight(place.lat, place.lon, n.start, n.end, now);
  }, [now, place.lat, place.lon]);
  const arc = useMemo(
    () =>
      Array.from({ length: 145 }, (_, k) => {
        const at = new Date(now.getTime() + k * 600_000);
        return {
          at,
          sun: sunPosition(at, place.lat, place.lon).altitude,
          moon: moonPosition(at, place.lat, place.lon).altitude,
        };
      }),
    [now, place.lat, place.lon],
  );
  const W = 360;
  const H = 150;
  const x = (k: number) => (k / 144) * W;
  const y = (alt: number) => H / 2 - (alt / 90) * (H / 2 - 6);
  const line = (k: "sun" | "moon") =>
    arc
      .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`)
      .join("");
  return (
    <div className="grid gap-3">
      <section className={s.card}>
        <h3>Planets tonight</h3>
        <ul className="grid gap-2">
          {planets.map((p) => (
            <li key={p.name} className={s.planet} data-down={!p.upTonight}>
              <span
                className={s.sym}
                style={{ color: c(p.name.toLowerCase()) }}
              >
                {p.symbol}
              </span>
              <span className="grid">
                <b>{p.name}</b>
                <small>
                  {!p.upTonight
                    ? "Stays below the horizon tonight"
                    : p.clipped === "rising-at-dawn"
                      ? `Rising into the dawn: ${Math.round(p.peakAltitude)}° in the ${p.peakCompass} by ${tm(p.peakAt)}`
                      : p.clipped === "past-best-at-dusk"
                        ? `Best at dusk: ${Math.round(p.peakAltitude)}° in the ${p.peakCompass}, then sinking`
                        : `Highest ${Math.round(p.peakAltitude)}° in the ${p.peakCompass} at ${tm(p.peakAt)}`}
                  {p.altitude > 0 ? ` · up now, ${p.compass}` : ""}
                </small>
                <small className={s.note}>{p.note}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className={s.card}>
        <h3>Sun and moon, the next 24 hours</h3>
        <svg
          viewBox={`0 0 ${W} ${H + 16}`}
          className="w-full"
          role="img"
          aria-label="Sun and moon height above the horizon over the next day"
        >
          <rect
            x={0}
            y={H / 2}
            width={W}
            height={H / 2}
            fill="var(--bg)"
            opacity={0.6}
          />
          <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--line)" />
          <path
            d={line("sun")}
            fill="none"
            stroke={c("sun")}
            strokeWidth={2.2}
          />
          <path
            d={line("moon")}
            fill="none"
            stroke={c("moon")}
            strokeWidth={2.2}
            strokeDasharray="5 3"
          />
          {[0, 36, 72, 108, 144].map((k) => (
            <text
              key={k}
              x={Math.min(W - 14, Math.max(14, x(k)))}
              y={H + 12}
              fontSize={9}
              textAnchor="middle"
              fill="var(--muted)"
            >
              {arc[k].at.toLocaleTimeString("en-US", { hour: "numeric" })}
            </text>
          ))}
          <text x={4} y={H / 2 - 4} fontSize={8.5} fill="var(--muted)">
            horizon
          </text>
        </svg>
        <div className={s.legend}>
          <span>
            <i style={{ background: c("sun") }} />
            Sun
          </span>
          <span>
            <i style={{ background: c("moon") }} />
            Moon
          </span>
        </div>
      </section>
    </div>
  );
}

function SunPanel({ now, place }: { now: Date; place: Place }) {
  const t = sunTimes(now, place.lat, place.lon);
  const y = sunTimes(new Date(now.getTime() - 86400_000), place.lat, place.lon);
  const len =
    t.sunrise && t.sunset ? t.sunset.getTime() - t.sunrise.getTime() : null;
  const prev =
    y.sunrise && y.sunset ? y.sunset.getTime() - y.sunrise.getTime() : null;
  const delta =
    len != null && prev != null ? Math.round((len - prev) / 60_000) : null;
  const season = currentSeason(now);
  const events = [
    ...seasonEvents(now.getUTCFullYear()),
    ...seasonEvents(now.getUTCFullYear() + 1),
  ].filter((e) => e.at > new Date(now.getTime() - 200 * 86400_000));
  const rows: [string, Date | null][] = [
    ["Astronomical dawn", t.astronomicalDawn],
    ["Civil dawn", t.civilDawn],
    ["Sunrise", t.sunrise],
    ["Solar noon", t.solarNoon],
    ["Sunset", t.sunset],
    ["Civil dusk", t.civilDusk],
    ["Astronomical dusk", t.astronomicalDusk],
  ];
  const days = Math.ceil(
    (season.next.at.getTime() - now.getTime()) / 86400_000,
  );
  return (
    <div className="grid gap-3">
      <section className={s.card}>
        <h3>The sun today</h3>
        <p className={s.big}>
          {len != null ? dur(len) : "–"} <small>of daylight</small>
        </p>
        {delta != null && (
          <p className={s.muted}>
            {delta === 0
              ? "About the same as yesterday."
              : `${Math.abs(delta)} min ${delta > 0 ? "longer" : "shorter"} than yesterday.`}
          </p>
        )}
        <dl className={s.rows}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{tm(v)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={s.card}>
        <h3>Where the year is</h3>
        <p>
          It is <b>{season.season.toLowerCase()}</b>. The {season.next.name} is
          in {days} day{days === 1 ? "" : "s"}, {dt(season.next.at)},{" "}
          {about(season.next.at)}.
        </p>
        <ol className={s.track}>
          {events.slice(0, 5).map((e) => (
            <li key={e.at.toISOString()} data-past={e.at < now}>
              <b>{e.name}</b>
              <small>
                {dt(e.at)}
                {e.at.getUTCFullYear() !== now.getUTCFullYear()
                  ? `, ${e.at.getUTCFullYear()}`
                  : ""}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Calendar({ now }: { now: Date }) {
  const phases = moonPhases(now, 8);
  const showers = nextShowers(now, 5);
  return (
    <div className="grid gap-3">
      <section className={s.card}>
        <h3>The lunar month from here</h3>
        <ul className={s.phases}>
          {phases.map((p) => (
            <li key={p.at.toISOString()}>
              <span aria-hidden>
                {p.name === "New Moon"
                  ? "🌑"
                  : p.name === "First Quarter"
                    ? "🌓"
                    : p.name === "Full Moon"
                      ? "🌕"
                      : "🌗"}
              </span>
              <b>{p.name}</b>
              <small>
                {dt(p.at)}, {about(p.at)}
              </small>
            </li>
          ))}
        </ul>
      </section>
      <section className={s.card}>
        <h3>Meteor showers ahead</h3>
        <ul className="grid gap-2">
          {showers.map((m) => {
            const lit = moonIllumination(m.at).fraction;
            return (
              <li
                key={`${m.name}${m.at.getUTCFullYear()}`}
                className={s.shower}
              >
                <b>
                  {m.name} <small>around {dt(m.at)}</small>
                </b>
                <small>
                  Up to {m.zhr} per hour under dark skies · radiant in{" "}
                  {m.radiant} · moon {Math.round(lit * 100)}% lit
                  {lit > 0.6
                    ? " (it will wash out the faint ones)"
                    : lit < 0.25
                      ? " (a dark sky)"
                      : ""}
                </small>
                <small className={s.note}>{m.note}</small>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
