import s from "./widgets.module.css";

/**
 * Semicircle gauge: a colored arc, tick marks, and a needle that swings in from
 * the left on mount (transform only).
 */
export function Gauge({
  value,
  min,
  max,
  stops,
  center,
  caption,
  marks,
}: {
  value: number | null;
  min: number;
  max: number;
  /** Arc color stops, left to right. */
  stops: string[];
  center: React.ReactNode;
  caption?: React.ReactNode;
  /** Optional secondary marker (e.g. today's peak). */
  marks?: { value: number; label: string }[];
}) {
  const id = `g${stops
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 24)}${min}${max}`;
  const frac = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
  const deg = value == null ? -90 : -90 + 180 * frac(value);
  const R = 80;
  const arc = `M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`;
  return (
    <div className={s.gauge}>
      <svg viewBox="0 0 200 112" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            {stops.map((c, i) => (
              <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <path d={arc} className={s.gTrack} />
        <path d={arc} stroke={`url(#${id})`} className={s.gArc} />
        {Array.from({ length: 21 }, (_, i) => {
          const a = Math.PI - (Math.PI * i) / 20;
          const r1 = i % 5 ? 64 : 60;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * r1}
              y1={100 - Math.sin(a) * r1}
              x2={100 + Math.cos(a) * 68}
              y2={100 - Math.sin(a) * 68}
              className={s.gTick}
            />
          );
        })}
        {marks?.map((m) => {
          const a = Math.PI - Math.PI * frac(m.value);
          return (
            <circle
              key={m.label}
              cx={100 + Math.cos(a) * R}
              cy={100 - Math.sin(a) * R}
              r={4}
              className={s.gMark}
            >
              <title>{m.label}</title>
            </circle>
          );
        })}
        <g className={s.needle} style={{ ["--deg" as string]: `${deg}deg` }}>
          <path d="M100 30 L104 100 L96 100 Z" />
          <circle cx="100" cy="100" r="7" />
        </g>
      </svg>
      <div className={s.gCenter}>{center}</div>
      {caption && <p className={s.gCaption}>{caption}</p>}
    </div>
  );
}
