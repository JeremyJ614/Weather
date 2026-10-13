import s from "./widgets.module.css";

type Kind = "clear" | "partly" | "cloudy" | "rain" | "storm" | "snow" | "fog";

export function sceneKind(short: string): Kind {
  const t = short.toLowerCase();
  if (t.includes("thunder")) return "storm";
  if (/snow|sleet|flurr|ice|freezing/.test(t)) return "snow";
  if (/rain|shower|drizzle/.test(t)) return "rain";
  if (/fog|haze|smoke|dust/.test(t)) return "fog";
  if (/partly|mostly sunny|mostly clear/.test(t)) return "partly";
  if (t.includes("cloud") || t.includes("overcast")) return "cloudy";
  return "clear";
}

function Cloud({
  className,
  x,
  y,
  k,
}: {
  className: string;
  x: number;
  y: number;
  k: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <g className={className}>
        <path d="M20 46h58a18 18 0 0 0 0-36 26 26 0 0 0-49-4A20 20 0 0 0 20 46z" />
      </g>
    </g>
  );
}

/**
 * The live sky behind "Right now": sun or moon, drifting clouds, rain, snow,
 * lightning or fog, chosen from the NWS wording. Every motion is a transform
 * or opacity loop; slow phones get the still picture.
 */
export function Scene({ short, isDay }: { short: string; isDay: boolean }) {
  const k = sceneKind(short);
  const cloudy = k !== "clear";
  const wet = k === "rain" || k === "storm";
  return (
    <svg className={s.scene} viewBox="0 0 220 150" aria-hidden>
      <defs>
        <radialGradient id="sc-sun">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.45" stopColor="#ffd66b" />
          <stop offset="1" stopColor="#ffb13b" />
        </radialGradient>
        <radialGradient id="sc-glow">
          <stop
            offset="0"
            stopColor={isDay ? "#ffcf5a" : "#b9c6ff"}
            stopOpacity="0.55"
          />
          <stop
            offset="1"
            stopColor={isDay ? "#ffcf5a" : "#b9c6ff"}
            stopOpacity="0"
          />
        </radialGradient>
      </defs>
      {(k === "clear" || k === "partly") && (
        <g transform="translate(150 48)">
          <circle r="58" fill="url(#sc-glow)" className={s.breathe} />
          {isDay ? (
            <>
              <g className={s.rays}>
                {Array.from({ length: 12 }, (_, i) => (
                  <rect
                    key={i}
                    x="-1.6"
                    y="-44"
                    width="3.2"
                    height="12"
                    rx="1.6"
                    transform={`rotate(${i * 30})`}
                  />
                ))}
              </g>
              <circle r="24" fill="url(#sc-sun)" />
            </>
          ) : (
            <>
              <circle r="22" fill="#e8ecff" />
              <circle r="22" cx="10" cy="-6" fill="var(--surface)" />
            </>
          )}
        </g>
      )}
      {!isDay &&
        [
          [20, 20],
          [60, 12],
          [96, 30],
          [190, 18],
          [205, 70],
          [40, 60],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={1.2}
            className={s.star}
            style={{ ["--i" as string]: i }}
          />
        ))}
      {cloudy && (
        <>
          <Cloud
            className={`${s.cloud} ${s.c1}`}
            x={k === "partly" ? 70 : 100}
            y={k === "partly" ? 34 : 30}
            k={k === "partly" ? 0.6 : 1.05}
          />
          {k !== "partly" && (
            <Cloud className={`${s.cloud} ${s.c2}`} x={24} y={22} k={0.85} />
          )}
          <Cloud
            className={`${s.cloudFront} ${s.c3}`}
            x={k === "partly" ? 104 : 60}
            y={k === "partly" ? 50 : 52}
            k={k === "partly" ? 0.85 : 0.95}
          />
        </>
      )}
      {wet &&
        Array.from({ length: 14 }, (_, i) => (
          <line
            key={i}
            x1={60 + i * 10}
            y1={104}
            x2={56 + i * 10}
            y2={116}
            className={s.drop}
            style={{ ["--i" as string]: i % 7 }}
          />
        ))}
      {k === "snow" &&
        Array.from({ length: 12 }, (_, i) => (
          <circle
            key={i}
            cx={64 + i * 11}
            cy={104}
            r={2}
            className={s.flake}
            style={{ ["--i" as string]: i % 6 }}
          />
        ))}
      {k === "storm" && (
        <path
          d="M138 88 l-12 22 h10 l-8 20 22-28 h-11 l8-14z"
          className={s.bolt}
        />
      )}
      {k === "fog" &&
        [96, 108, 120].map((y, i) => (
          <rect
            key={y}
            x={30 + i * 8}
            y={y}
            width={150}
            height={4}
            rx={2}
            className={s.fog}
            style={{ ["--i" as string]: i }}
          />
        ))}
    </svg>
  );
}
