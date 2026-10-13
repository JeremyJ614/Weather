import { WeatherIcon } from "@/features/weather/WeatherIcon";
import type { Period } from "@/lib/weather/types";
import s from "./widgets.module.css";

/** Seven days as temperature-range bars on one shared scale (cool → warm gradient). */
export function WeekRanges({ daily }: { daily: Period[] }) {
  const days = daily
    .filter((p) => p.isDay)
    .slice(0, 7)
    .map((d) => ({
      d,
      night: daily.find(
        (n) => !n.isDay && Date.parse(n.start) > Date.parse(d.start),
      ),
    }));
  const all = days.flatMap(({ d, night }) => [d.temp, night?.temp ?? d.temp]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pos = (t: number) => (hi === lo ? 0.5 : (t - lo) / (hi - lo));
  return (
    <ol className={s.week}>
      {days.map(({ d, night }, i) => {
        const a = pos(night?.temp ?? d.temp);
        const b = pos(d.temp);
        return (
          <li key={d.start} style={{ ["--i" as string]: i }}>
            <span className={s.wName}>
              {i === 0 ? "Today" : d.name.slice(0, 3)}
            </span>
            <WeatherIcon short={d.short} isDay className={s.wIcon} />
            <span className={s.wPop}>{d.pop ? `${d.pop}%` : ""}</span>
            <span className={s.wLo}>{night?.temp ?? "–"}°</span>
            <span className={s.wTrack}>
              <i
                style={{
                  left: `${a * 100}%`,
                  width: `${Math.max(4, (b - a) * 100)}%`,
                  background: `linear-gradient(90deg, hsl(${200 - a * 170} 90% 60%), hsl(${200 - b * 170} 90% 58%))`,
                }}
              />
            </span>
            <span className={s.wHi}>{d.temp}°</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Sunrise-to-sunset arc with the sun riding it at the current time. */
export function SunArc({
  rise,
  set,
  now,
  label,
}: {
  rise: Date | null;
  set: Date | null;
  now: Date;
  label: (d: Date | null) => string;
}) {
  const t =
    rise && set
      ? (now.getTime() - rise.getTime()) / (set.getTime() - rise.getTime())
      : -1;
  const up = t >= 0 && t <= 1;
  const deg = -90 + 180 * Math.min(1, Math.max(0, t));
  return (
    <div className={s.sun}>
      <svg viewBox="0 0 200 110" aria-hidden>
        <defs>
          <linearGradient id="sun-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ffb547" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M20 96 A80 80 0 0 1 180 96 Z"
          fill="url(#sun-sky)"
          className={s.fadeIn}
        />
        <path d="M20 96 A80 80 0 0 1 180 96" className={s.sunPath} />
        <line x1="8" y1="96" x2="192" y2="96" className={s.horizon} />
        <g className={s.sunRide} style={{ ["--deg" as string]: `${deg}deg` }}>
          <circle
            cx="100"
            cy="16"
            r="9"
            className={up ? s.sunDot : s.sunDotDown}
          />
        </g>
      </svg>
      <div className={s.sunTimes}>
        <span>
          <b>{label(rise)}</b> Sunrise
        </span>
        <span>
          <b>{label(set)}</b> Sunset
        </span>
      </div>
    </div>
  );
}

/** The moon drawn at its real phase: lit limb plus a terminator ellipse. */
export function MoonDisc({ phase }: { phase: number }) {
  const waxing = phase < 0.5;
  const k = Math.cos(2 * Math.PI * phase); // 1 new → -1 full
  const rx = Math.abs(k) * 40;
  const lit = "#f1f0e6";
  const dark = "#1a1c2b";
  // Half disc on the lit side, then an ellipse that is dark (crescent) or lit (gibbous).
  const half = waxing
    ? "M50 10 A40 40 0 0 1 50 90 Z"
    : "M50 10 A40 40 0 0 0 50 90 Z";
  return (
    <svg viewBox="0 0 100 100" className={s.moon} aria-hidden>
      <defs>
        <radialGradient id="moon-glow">
          <stop offset="0.55" stopColor="#dfe4ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#dfe4ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="50"
        fill="url(#moon-glow)"
        className={s.breathe}
      />
      <circle cx="50" cy="50" r="40" fill={dark} />
      <path d={half} fill={lit} />
      <ellipse cx="50" cy="50" rx={rx} ry="40" fill={k > 0 ? dark : lit} />
      <g fill="#000" opacity="0.08">
        <circle cx="38" cy="40" r="6" />
        <circle cx="60" cy="62" r="8" />
        <circle cx="62" cy="34" r="4" />
      </g>
    </svg>
  );
}

const DIRS = ["N", "E", "S", "W"];
/** Compass rose; the arrow points where the wind is blowing toward. */
export function Compass({
  from,
  mph,
  gust,
}: {
  from: number | null;
  mph: number | null;
  gust: number | null;
}) {
  return (
    <div className={s.compass}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r="54" className={s.cRing} />
        <g className={s.cTicks}>
          {Array.from({ length: 36 }, (_, i) => (
            <line
              key={i}
              x1="60"
              y1="8"
              x2="60"
              y2={i % 9 ? 12 : 16}
              transform={`rotate(${i * 10} 60 60)`}
            />
          ))}
        </g>
        {DIRS.map((d, i) => {
          const a = (i * Math.PI) / 2;
          return (
            <text
              key={d}
              x={60 + Math.sin(a) * 40}
              y={64 - Math.cos(a) * 40}
              className={d === "N" ? s.cNorth : s.cDir}
            >
              {d}
            </text>
          );
        })}
        {from != null && (
          <g
            className={s.cArrow}
            style={{ ["--deg" as string]: `${(from + 180) % 360}deg` }}
          >
            <path d="M60 14 L67 34 L60 30 L53 34 Z" />
            <line x1="60" y1="30" x2="60" y2="38" />
            <line x1="60" y1="84" x2="60" y2="98" />
          </g>
        )}
      </svg>
      <div className={s.cCenter}>
        <b>{mph ?? "–"}</b>
        <span>mph</span>
        {gust ? <em>G {gust}</em> : null}
      </div>
    </div>
  );
}

/** Feels-like thermometer: the column fills to the feels-like temperature. */
export function Thermo({
  feels,
  actual,
}: {
  feels: number | null;
  actual: number | null;
}) {
  const f = Math.min(1, Math.max(0.05, ((feels ?? 0) + 10) / 120));
  const hot = (feels ?? 60) >= 80;
  const cold = (feels ?? 60) <= 40;
  return (
    <div className={s.thermo}>
      <span className={s.tTube}>
        <i
          style={{
            transform: `scaleY(${f})`,
            background: `linear-gradient(0deg, #4cc3ff, ${cold ? "#7c9cff" : hot ? "#ff5a3c" : "#ffb03b"})`,
          }}
        />
      </span>
      <span
        className={s.tBulb}
        style={{ background: cold ? "#4cc3ff" : hot ? "#ff5a3c" : "#ff9f3b" }}
      />
      <div>
        <p className={s.big}>{feels ?? "–"}°</p>
        <p className={s.sub}>
          Actual {actual ?? "–"}°
          {feels != null && actual != null && feels !== actual
            ? ` · feels ${Math.abs(feels - actual)}° ${feels > actual ? "warmer" : "cooler"}`
            : ""}
        </p>
      </div>
    </div>
  );
}

const COMFORT = [
  { max: 50, label: "Dry", color: "#5ac8fa" },
  { max: 55, label: "Comfortable", color: "#4cd964" },
  { max: 60, label: "Pleasant", color: "#a3e635" },
  { max: 65, label: "Sticky", color: "#ffcc00" },
  { max: 70, label: "Muggy", color: "#ff9500" },
  { max: 200, label: "Oppressive", color: "#ff3b30" },
];
/** Dew point on a comfort scale, with humidity as a filling drop. */
export function Comfort({
  dew,
  rh,
}: {
  dew: number | null;
  rh: number | null;
}) {
  const band = COMFORT.find((b) => (dew ?? 0) < b.max) ?? COMFORT[0];
  const at = Math.min(1, Math.max(0, ((dew ?? 40) - 30) / 50));
  return (
    <div className={s.comfort}>
      <div className={s.cfTop}>
        <div>
          <p className={s.big}>{dew ?? "–"}°</p>
          <p className={s.sub} style={{ color: band.color }}>
            {band.label}
          </p>
        </div>
        <div className={s.drop2}>
          <svg viewBox="0 0 40 52" aria-hidden>
            <defs>
              <clipPath id="drop-clip">
                <path d="M20 2 C20 2 4 22 4 33 a16 16 0 0 0 32 0 C36 22 20 2 20 2z" />
              </clipPath>
            </defs>
            <path
              d="M20 2 C20 2 4 22 4 33 a16 16 0 0 0 32 0 C36 22 20 2 20 2z"
              className={s.dropShell}
            />
            <g clipPath="url(#drop-clip)">
              <rect
                x="0"
                y="0"
                width="40"
                height="52"
                className={s.dropFill}
                style={{
                  transform: `translateY(${52 - ((rh ?? 0) / 100) * 50}px)`,
                }}
              />
            </g>
          </svg>
          <span>{rh ?? "–"}%</span>
        </div>
      </div>
      <span className={s.cfBar}>
        <i style={{ left: `${at * 100}%` }} />
      </span>
      <span className={s.cfLabels}>
        <span>Dry</span>
        <span>Comfortable</span>
        <span>Muggy</span>
      </span>
    </div>
  );
}
