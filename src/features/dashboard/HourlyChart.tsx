import type { Hour } from "@/lib/weather/types";

/** 24-hour temperature line with rain-chance bars. Plain SVG; nothing animates but opacity. */
export function HourlyChart({
  hours,
  timeZone,
}: {
  hours: Hour[];
  timeZone: string;
}) {
  const h = hours.slice(0, 24);
  if (h.length < 2) return null;
  const W = 340;
  const H = 120;
  const top = 18;
  const bottom = 22;
  const temps = h.map((x) => x.temp);
  const lo = Math.min(...temps) - 2;
  const hi = Math.max(...temps) + 2;
  const x = (i: number) => (i / (h.length - 1)) * W;
  const y = (t: number) =>
    top + (1 - (t - lo) / (hi - lo)) * (H - top - bottom);
  const line = h
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.temp).toFixed(1)}`)
    .join("");
  const label = (iso: string) =>
    new Date(iso)
      .toLocaleTimeString("en-US", { hour: "numeric", timeZone })
      .replace(" ", "")
      .toLowerCase();
  const peak = temps.indexOf(Math.max(...temps));
  const low = temps.indexOf(Math.min(...temps));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Temperatures from ${temps[0]}° to a high of ${temps[peak]}° over the next 24 hours`}
    >
      {h.map((p, i) =>
        p.pop ? (
          <rect
            key={i}
            x={x(i) - 4}
            y={H - bottom - (p.pop / 100) * 40}
            width={8}
            height={(p.pop / 100) * 40}
            rx={2}
            fill="var(--accent2)"
            opacity={0.35}
          />
        ) : null,
      )}
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {[peak, low].map((i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(temps[i])} r={3.5} fill="var(--accent)" />
          <text
            x={Math.min(Math.max(x(i), 12), W - 12)}
            y={y(temps[i]) - 7}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text)"
            fontWeight={700}
          >
            {temps[i]}°
          </text>
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((i) =>
        h[i] ? (
          <text
            key={i}
            x={Math.min(Math.max(x(i), 14), W - 14)}
            y={H - 4}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted)"
          >
            {label(h[i].start)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
