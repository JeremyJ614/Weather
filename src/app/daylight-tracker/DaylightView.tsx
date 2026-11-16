"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  MapPin,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LazyLocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { useWeather } from "@/features/weather/useWeather";
import {
  addDays,
  hms,
  keyDays,
  localMinutes,
  sunDay,
  yearDays,
  type SunDay,
} from "@/lib/weather/daylight";
import s from "./Daylight.module.css";
import { InfoScrub } from "@/components/charts/InfoScrub";

const fmtT = (t: Date | null, tz: string) =>
  t
    ? t.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      })
    : "—";
const fmtD = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const clock = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** The whole 24 hours as bands (night → twilights → golden → day) with the sun's arc over the daylight. */
function DayArc({ d, tz, nowMin }: { d: SunDay; tz: string; nowMin: number }) {
  const W = 340;
  const x = (t: Date | null, fb: number) =>
    ((t ? localMinutes(t, tz) : fb) / 1440) * W;
  const seg = [
    { a: 0, b: x(d.astroDawn, 0), c: "#05060f" },
    { a: x(d.astroDawn, 0), b: x(d.nauticalDawn, 0), c: "#101a3a" },
    { a: x(d.nauticalDawn, 0), b: x(d.civilDawn, 0), c: "#22356b" },
    { a: x(d.civilDawn, 0), b: x(d.rise, 0), c: "#4b5fa8" },
    { a: x(d.rise, 0), b: x(d.goldenEnd, 0), c: "#f2a84a" },
    { a: x(d.goldenEnd, 0), b: x(d.goldenStart, W), c: "#7cc4ff" },
    { a: x(d.goldenStart, W), b: x(d.set, W), c: "#f2a84a" },
    { a: x(d.set, W), b: x(d.civilDusk, W), c: "#4b5fa8" },
    { a: x(d.civilDusk, W), b: x(d.nauticalDusk, W), c: "#22356b" },
    { a: x(d.nauticalDusk, W), b: x(d.astroDusk, W), c: "#101a3a" },
    { a: x(d.astroDusk, W), b: W, c: "#05060f" },
  ];
  const r0 = x(d.rise, 0);
  const s0 = x(d.set, W);
  const mid = (r0 + s0) / 2;
  const peak = 30;
  const arc = `M${r0},96 Q${mid},${peak - 30} ${s0},96`;
  // Sun position along the quadratic at the current time.
  const tNow = Math.min(
    1,
    Math.max(0, ((nowMin / 1440) * W - r0) / Math.max(1, s0 - r0)),
  );
  const sx =
    (1 - tNow) ** 2 * r0 + 2 * (1 - tNow) * tNow * mid + tNow ** 2 * s0;
  const sy =
    (1 - tNow) ** 2 * 96 + 2 * (1 - tNow) * tNow * (peak - 30) + tNow ** 2 * 96;
  const up = (nowMin / 1440) * W > r0 && (nowMin / 1440) * W < s0;
  return (
    <svg viewBox={`0 0 ${W} 132`} className={s.arc} aria-hidden>
      <defs>
        <linearGradient id="dl-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd66b" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffd66b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${arc} Z`} fill="url(#dl-sky)" className={s.fade} />
      <path d={arc} className={s.arcPath} />
      {seg.map((g, i) =>
        g.b > g.a ? (
          <rect
            key={i}
            x={g.a}
            y={100}
            width={g.b - g.a + 0.5}
            height={14}
            fill={g.c}
            className={s.band}
            style={{ ["--i" as string]: i }}
          />
        ) : null,
      )}
      <rect
        x="0"
        y="100"
        width={W}
        height="14"
        rx="7"
        className={s.bandFrame}
      />
      <line
        x1={(nowMin / 1440) * W}
        x2={(nowMin / 1440) * W}
        y1="94"
        y2="120"
        className={s.nowLine}
      />
      {up && (
        <g
          className={s.sunDot}
          style={{ ["--x" as string]: `${sx}px`, ["--y" as string]: `${sy}px` }}
        >
          <circle r="10" className={s.sunGlow} />
          <circle r="6" />
        </g>
      )}
      {["12a", "6a", "12p", "6p", "12a"].map((l, i) => (
        <text
          key={i}
          x={(i * W) / 4}
          y="128"
          className={s.tick}
          textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

/** Daylight hours across the year: one curve, solstices and equinoxes marked, today glowing. */
function YearCurve({
  days,
  today,
}: {
  days: { ymd: string; dayMinutes: number }[];
  today: string;
}) {
  const W = 340;
  const H = 120;
  const lo = Math.min(...days.map((d) => d.dayMinutes));
  const hi = Math.max(...days.map((d) => d.dayMinutes));
  const y = (m: number) =>
    12 + (1 - (m - lo) / Math.max(1, hi - lo)) * (H - 34);
  const x = (i: number) => (i / (days.length - 1)) * W;
  const line = days
    .map(
      (d, i) =>
        `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.dayMinutes).toFixed(1)}`,
    )
    .join("");
  const ti = Math.max(
    0,
    days.findIndex((d) => d.ymd === today),
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={s.year}
      role="group"
      aria-label="Day length through the year"
    >
      <defs>
        <linearGradient id="dl-year" x1="0" x2="1">
          <stop offset="0" stopColor="#4b5fa8" />
          <stop offset="0.47" stopColor="#ffd66b" />
          <stop offset="1" stopColor="#4b5fa8" />
        </linearGradient>
        <linearGradient id="dl-yfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd66b" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ffd66b" stopOpacity="0" />
        </linearGradient>
        <clipPath id="dl-reveal">
          <rect className={s.reveal} width={W} height={H} />
        </clipPath>
      </defs>
      {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map(
        (m, i) => (
          <text
            key={i}
            x={(i + 0.5) * (W / 12)}
            y={H - 4}
            className={s.tick}
            textAnchor="middle"
          >
            {m}
          </text>
        ),
      )}
      <g clipPath="url(#dl-reveal)">
        <path d={`${line}L${W},${H - 22}L0,${H - 22}Z`} fill="url(#dl-yfill)" />
        <path d={line} className={s.yLine} stroke="url(#dl-year)" />
      </g>
      <line x1={x(ti)} x2={x(ti)} y1="8" y2={H - 22} className={s.todayLine} />
      <circle
        cx={x(ti)}
        cy={y(days[ti].dayMinutes)}
        r="9"
        className={s.todayGlow}
      />
      <circle
        cx={x(ti)}
        cy={y(days[ti].dayMinutes)}
        r="4.5"
        className={s.todayDot}
      />
      <InfoScrub
        label="Day length through the year"
        x0={0}
        x1={W}
        top={12}
        bottom={H - 22}
        width={W}
        height={H}
        start={ti}
        title={(i) =>
          new Date(`${days[i].ymd}T12:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })
        }
        series={[
          {
            key: "day",
            label: "Daylight",
            color: "var(--accent)",
            y: days.map((d) => y(d.dayMinutes)),
            text: days.map(
              (d) =>
                `${Math.floor(d.dayMinutes / 60)}h ${Math.round(d.dayMinutes % 60)}m`,
            ),
          },
        ]}
        rows={(i) => {
          const diff = Math.round(days[i].dayMinutes - days[ti].dayMinutes);
          if (i === ti) return [{ label: "Today", text: "" }];
          const a = Math.abs(diff);
          return [
            {
              label: "vs today",
              text: `${diff < 0 ? "−" : "+"}${Math.floor(a / 60)}h ${a % 60}m`,
            },
          ];
        }}
      />
    </svg>
  );
}

export function DaylightView() {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const { data: w } = useWeather(active);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0);
    const iv = setInterval(tick, 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(iv);
    };
  }, []);
  const tz = w?.place.timeZone ?? null;
  const today =
    tz && now
      ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now)
      : null;
  const year = useMemo(
    () =>
      active && tz && today
        ? yearDays(active.lat, active.lon, Number(today.slice(0, 4)), tz)
        : [],
    [active, tz, today],
  );
  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );
  if (!active) {
    return (
      <Card className="grid gap-3">
        <p className="text-sm text-muted">Set a place to track its daylight.</p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }
  if (!tz || !today || !now || !year.length)
    return <div className={s.skeleton} aria-label="Loading" />;

  const d = sunDay(active.lat, active.lon, today);
  const y = sunDay(active.lat, active.lon, addDays(today, -1));
  const delta = d.dayMinutes - y.dayMinutes;
  const gaining = delta >= 0;
  const len = hms(d.dayMinutes);
  const dl = hms(delta);
  const k = keyDays(year);
  const nowMin = localMinutes(new Date(now), tz);
  const yr = today.slice(0, 4);
  const marks = [
    { ymd: `${yr}-03-20`, label: "Spring equinox" },
    { ymd: `${yr}-06-21`, label: "Summer solstice" },
    { ymd: `${yr}-09-22`, label: "Fall equinox" },
    { ymd: `${yr}-12-21`, label: "Winter solstice" },
  ];
  const next = marks.find((m) => m.ymd > today) ?? {
    ymd: `${Number(yr) + 1}-03-20`,
    label: "Spring equinox",
  };
  const daysTo = Math.round(
    (Date.parse(next.ymd) - Date.parse(today)) / 86_400_000,
  );

  const times = [
    { Icon: Moon, label: "First light", sub: "civil dawn", t: d.civilDawn },
    { Icon: Sunrise, label: "Sunrise", sub: "", t: d.rise },
    {
      Icon: Sparkles,
      label: "Golden hour ends",
      sub: "morning",
      t: d.goldenEnd,
    },
    { Icon: Sun, label: "Solar noon", sub: "sun highest", t: d.noon },
    {
      Icon: Sparkles,
      label: "Golden hour",
      sub: "evening begins",
      t: d.goldenStart,
    },
    { Icon: Sunset, label: "Sunset", sub: "", t: d.set },
    { Icon: Moon, label: "Last light", sub: "civil dusk", t: d.civilDusk },
    { Icon: Moon, label: "Full dark", sub: "astronomical", t: d.astroDusk },
  ];

  return (
    <div className="grid gap-4">
      <button onClick={() => setSheet(true)} className={s.place}>
        <MapPin aria-hidden /> {active.label}
        <ChevronDown aria-hidden />
      </button>

      <section className={s.hero}>
        <p className="eyebrow">Daylight today</p>
        <p className={s.length}>
          <b>{len.h}</b>
          <small>h</small>
          <b>{len.m}</b>
          <small>m</small>
          <b>{len.s}</b>
          <small>s</small>
        </p>
        <p className={`${s.delta} ${gaining ? s.gain : s.lose}`}>
          {gaining ? (
            <ArrowUpRight aria-hidden />
          ) : (
            <ArrowDownRight aria-hidden />
          )}
          {gaining ? "+" : "−"}
          {dl.m ? `${dl.m} m ` : ""}
          {dl.s} s vs yesterday
        </p>
        <DayArc d={d} tz={tz} nowMin={nowMin} />
        <div className={s.riseSet}>
          <span>
            <Sunrise aria-hidden /> {fmtT(d.rise, tz)}
          </span>
          <span>
            {fmtT(d.set, tz)} <Sunset aria-hidden />
          </span>
        </div>
      </section>

      <section className={s.countdown}>
        <b>{daysTo}</b>
        <span>
          days until the <em>{next.label.toLowerCase()}</em> ({fmtD(next.ymd)})
          {next.label === "Winter solstice"
            ? ". Then the days start growing again."
            : next.label === "Summer solstice"
              ? ". Then the days start shrinking."
              : "."}
        </span>
      </section>

      <section className={s.grid}>
        {times.map(({ Icon, label, sub, t }, i) => (
          <article key={label} style={{ ["--d" as string]: i }}>
            <Icon aria-hidden />
            <p>{label}</p>
            <b>{fmtT(t, tz)}</b>
            {sub && <span>{sub}</span>}
          </article>
        ))}
      </section>

      <section className={s.card}>
        <h3 className={s.h3}>The year in daylight</h3>
        <YearCurve days={year} today={today} />
        <div className={s.keys}>
          {k.shortest && (
            <div>
              <span>Shortest day</span>
              <b>{fmtD(k.shortest.ymd)}</b>
              <em>
                {hms(k.shortest.dayMinutes).h} h {hms(k.shortest.dayMinutes).m}{" "}
                m
              </em>
            </div>
          )}
          {k.longest && (
            <div>
              <span>Longest day</span>
              <b>{fmtD(k.longest.ymd)}</b>
              <em>
                {hms(k.longest.dayMinutes).h} h {hms(k.longest.dayMinutes).m} m
              </em>
            </div>
          )}
          {k.earliestSet?.setMin != null && (
            <div>
              <span>Earliest sunset</span>
              <b>{fmtD(k.earliestSet.ymd)}</b>
              <em>{clock(k.earliestSet.setMin)}</em>
            </div>
          )}
          {k.latestRise?.riseMin != null && (
            <div>
              <span>Latest sunrise</span>
              <b>{fmtD(k.latestRise.ymd)}</b>
              <em>{clock(k.latestRise.riseMin)}</em>
            </div>
          )}
        </div>
      </section>

      <details className={s.learn}>
        <summary>
          Why isn&apos;t the earliest sunset on the shortest day?
        </summary>
        <p>
          Earth&apos;s tilt sets how long the day is, but its oval orbit shifts
          solar noon a little later each day around December. That slide pushes
          both sunrise and sunset later, so the earliest sunset arrives about
          two weeks before the winter solstice and the latest sunrise about two
          weeks after it. Where clocks change, daylight saving time can move the
          latest clock-time sunrise to the days just before clocks fall back.
        </p>
        <p>
          <b>Civil twilight</b> is bright enough to read outdoors.{" "}
          <b>Nautical twilight</b> shows the horizon at sea.{" "}
          <b>Astronomical twilight</b> ends when the sky is fully dark.{" "}
          <b>Golden hour</b> is the soft light while the sun is under 6° high.
        </p>
      </details>
      {sheetEl}
    </div>
  );
}
