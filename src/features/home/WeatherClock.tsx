"use client";

import { useEffect, useRef, useState } from "react";
import { usePlaces } from "@/features/location/usePlaces";
import { useWeather } from "@/features/weather/useWeather";
import { WeatherIcon } from "@/features/weather/WeatherIcon";
import s from "./WeatherClock.module.css";

/*
 * The Weather Clock: the owner's Circular Calendar Display rebuilt for the app.
 * Three dials (weekday, month, date) turn to today around a live clock; the
 * left ring holds the weather right now, the right ring the week's highs.
 * Transform and opacity only; the clock hands are moved without re-rendering.
 */

const RANGE = 270;
const DAY_NAMES = "MON TUE WED THU FRI SAT SUN";
const MONTHS = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC";
const DAYS = Array.from({ length: 31 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
).join(" ");
const BAR_COLORS = [
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#4CD964",
  "#5AC8FA",
  "#007AFF",
  "#5856D6",
];

type Dial = {
  id: string;
  size: number;
  text: string;
  /** Characters per item and number of items. */
  chars: number;
  items: number;
  color: string;
  preview: string;
  /** Letter count for the text spread (matches the original's lettering). */
  spread: number;
  textR: number;
  delay: number;
};

const DIALS: Dial[] = [
  {
    id: "dayname",
    size: 250,
    text: DAY_NAMES,
    chars: 3,
    items: 7,
    color: "#4CD964",
    preview: "WEEKDAY",
    spread: 28,
    textR: 103,
    delay: 1500,
  },
  {
    id: "month",
    size: 350,
    text: MONTHS,
    chars: 3,
    items: 12,
    color: "#5AC8FA",
    preview: "MONTH",
    spread: 48,
    textR: 153,
    delay: 1000,
  },
  {
    id: "day",
    size: 450,
    text: DAYS,
    chars: 2,
    items: 31,
    color: "#FF2D55",
    preview: "DATE",
    spread: 93,
    textR: 203,
    delay: 500,
  },
];

function turn(d: Dial, n: number) {
  const w = RANGE / d.items;
  return 135 - w / 2 - w * (n - 1);
}

function RingText({
  text,
  spread,
  span,
  r,
  lit,
  color,
  className,
}: {
  text: string;
  spread: number;
  span: number;
  r: number;
  lit?: [number, number];
  color?: string;
  className: string;
}) {
  const step = span / spread;
  return (
    <div className={className} aria-hidden>
      {[...text].map((ch, i) => {
        const on = lit && i >= lit[0] && i < lit[1];
        return (
          <span
            key={i}
            style={{
              transform: `rotate(${-span / 2 + step * (i + 1)}deg) translateY(-${r}px)`,
              color: on ? color : undefined,
              textShadow: on ? `0 0 10px ${color}` : undefined,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

export function WeatherClock() {
  const { active } = usePlaces();
  const { data: w } = useWeather(active);
  const [today, setToday] = useState<{
    dow: number;
    day: number;
    month: number;
  } | null>(null);
  const [phase, setPhase] = useState(0);
  const hands = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const d = new Date();
    const dow = d.getDay() || 7;
    const t0 = setTimeout(
      () => setToday({ dow, day: d.getDate(), month: d.getMonth() + 1 }),
      0,
    );
    const timers = [500, 1000, 1500, 2000].map((ms, i) =>
      setTimeout(() => setPhase(i + 1), ms),
    );
    const tick = () => {
      const n = new Date();
      const sec = n.getSeconds() * 6;
      const min = n.getMinutes() * 6 + n.getSeconds() / 10;
      const hr = (n.getHours() % 12) * 30 + n.getMinutes() / 2;
      [hr, min, sec].forEach((deg, i) => {
        const el = hands.current[i];
        if (el) el.style.transform = `rotate(${deg}deg)`;
      });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => {
      clearTimeout(t0);
      timers.forEach(clearTimeout);
      clearInterval(iv);
    };
  }, []);

  const pick = (d: Dial) =>
    d.id === "day" ? today?.day : d.id === "month" ? today?.month : today?.dow;
  const shown = (d: Dial) =>
    phase >= (d.id === "day" ? 1 : d.id === "month" ? 2 : 3);

  const now = w?.hourly[0];
  const rain = w
    ? Math.max(0, ...w.hourly.slice(0, 12).map((h) => h.pop ?? 0))
    : null;
  const highs = (w?.daily ?? []).filter((p) => p.isDay).slice(0, 7);
  const lows = (w?.daily ?? []).filter((p) => !p.isDay);
  const hi = Math.max(...highs.map((p) => p.temp));
  const lo = Math.min(...highs.map((p) => p.temp));
  const C = 2 * Math.PI * 92;

  return (
    <section className={s.section} aria-label="Today">
      <div className={s.aura} aria-hidden />
      <p className={s.kicker}>
        <span aria-hidden />
        {active ? active.label : "Weather Clock"}
      </p>

      <div className={s.stage}>
        <div className={s.scale}>
          <div className={s.ticks} aria-hidden />
          {DIALS.map((d) => {
            const n = pick(d);
            const lit: [number, number] | undefined = n
              ? [(d.chars + 1) * (n - 1), (d.chars + 1) * (n - 1) + d.chars]
              : undefined;
            return (
              <div
                key={d.id}
                className={s.dial}
                style={{
                  width: d.size,
                  height: d.size,
                  ["--glow" as string]: d.color,
                }}
              >
                <div className={s.back} />
                <div
                  className={s.ring}
                  style={{
                    transform: `rotate(${shown(d) && n ? turn(d, n) : 0}deg)`,
                  }}
                >
                  <RingText
                    className={`${s.preview} ${shown(d) ? s.out : ""}`}
                    text={d.preview}
                    spread={d.preview.length}
                    span={(d.preview.length * 19 * 57.3) / d.textR}
                    r={d.textR}
                  />
                  <RingText
                    className={`${s.text} ${shown(d) ? s.in : ""}`}
                    text={d.text}
                    spread={d.spread}
                    span={RANGE}
                    r={d.textR}
                    lit={lit}
                    color={d.color}
                  />
                </div>
              </div>
            );
          })}

          <div className={s.center}>
            <RingText
              className={`${s.centerText} ${phase >= 4 ? s.out : ""}`}
              text="SSWX"
              spread={4}
              span={84}
              r={52}
            />
            <div className={`${s.face} ${phase >= 4 ? s.in : ""}`}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  ref={(el) => {
                    hands.current[i] = el;
                  }}
                  className={s.handBox}
                >
                  <i className={[s.hour, s.minute, s.second][i]} />
                </div>
              ))}
              <i className={s.pin} />
            </div>
          </div>
        </div>
      </div>

      <div className={s.sides}>
        <div className={`${s.side} ${phase >= 2 ? s.in : s.pre}`}>
          <svg className={s.arc} viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="100" r="92" className={s.arcBack} />
            <circle
              cx="100"
              cy="100"
              r="92"
              className={s.arcRain}
              strokeDasharray={`${(C * (rain ?? 0)) / 100} ${C}`}
            />
          </svg>
          {now ? (
            <div className={s.now}>
              <WeatherIcon
                short={now.short}
                isDay={now.isDay}
                className={s.nowIcon}
              />
              <p className={s.nowTemp}>{now.temp}°</p>
              <p className={s.nowShort}>{now.short}</p>
              <p className={s.nowMeta}>
                <span style={{ color: "#FF9500" }}>
                  H {highs[0]?.temp ?? "–"}°
                </span>{" "}
                <span style={{ color: "#5AC8FA" }}>
                  L {lows[0]?.temp ?? "–"}°
                </span>
              </p>
              <p className={s.nowRain}>Rain {rain ?? 0}%</p>
            </div>
          ) : (
            <p className={s.empty}>{active ? "Loading…" : "Set a place"}</p>
          )}
        </div>

        <div className={`${s.side} ${phase >= 2 ? s.in : s.pre}`}>
          <p className={s.sideLabel}>7-day highs</p>
          <div className={s.bars} role="list" aria-label="Seven-day highs">
            {highs.map((p, i) => {
              const h =
                hi === lo ? 0.6 : 0.2 + (0.8 * (p.temp - lo)) / (hi - lo);
              const day = new Date(p.start).toLocaleDateString("en-US", {
                weekday: "narrow",
              });
              return (
                <div
                  key={p.start}
                  className={s.bar}
                  role="listitem"
                  aria-label={`${p.name}: ${p.temp}°`}
                >
                  <span className={s.barTemp}>{p.temp}</span>
                  <span className={s.track}>
                    <i
                      style={{
                        background: BAR_COLORS[i],
                        boxShadow: `0 0 10px ${BAR_COLORS[i]}`,
                        transform: `scaleY(${phase >= 2 ? h : 0})`,
                        transitionDelay: `${i * 70}ms`,
                      }}
                    />
                  </span>
                  <span className={s.barDay}>{day}</span>
                </div>
              );
            })}
            {highs.length === 0 && (
              <p className={s.empty}>{active ? "Loading…" : "Set a place"}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
