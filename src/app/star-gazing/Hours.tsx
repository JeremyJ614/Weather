"use client";

import { InfoScrub } from "@/components/charts/InfoScrub";
import { lit } from "@/lib/colors/lit";
import { bandOf, type skyScore, type SkyHour } from "@/lib/sky/score";
import s from "./Stars.module.css";

const hr = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric" });
const day = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short" });

/** Hour by Hour: the next 36 hours' scores as bars, dark hours shaded, then the list. */
export function Hours({
  hours,
  c,
}: {
  hours: (SkyHour & { f: ReturnType<typeof skyScore> })[];
  c: (k: string) => string;
}) {
  if (!hours.length)
    return <p className={s.muted}>Pick a place to see its next 36 hours.</p>;
  const W = 360;
  const H = 150;
  const bw = W / hours.length;
  return (
    <div className={s.card}>
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        className="w-full"
        role="group"
        aria-label="Stargazing score by hour"
      >
        {[20, 40, 60, 80].map((v) => (
          <line
            key={v}
            x1={0}
            x2={W}
            y1={H - (v / 100) * H}
            y2={H - (v / 100) * H}
            stroke="var(--line)"
            strokeWidth={0.6}
          />
        ))}
        {hours.map((h, i) => (
          <g key={h.at.toISOString()}>
            {h.f.factors[0].value > 0 && (
              <rect
                x={i * bw}
                y={0}
                width={bw}
                height={H}
                fill="#0b1030"
                opacity={0.5 * h.f.factors[0].value}
              />
            )}
            {(() => {
              // The owner's band color fills the bar; a lighter twin outlines and caps it,
              // so the darkest bands still show on the night background.
              const col = c(bandOf(h.score).key);
              const edge = lit(col);
              const bh = Math.max(2.5, (h.score / 100) * H);
              return (
                <>
                  <rect
                    x={i * bw + 1}
                    y={H - bh}
                    width={Math.max(1, bw - 2)}
                    height={bh}
                    rx={1.5}
                    fill={col}
                    stroke={edge}
                    strokeOpacity={0.75}
                    strokeWidth={0.6}
                  />
                  <rect
                    x={i * bw + 1}
                    y={H - bh}
                    width={Math.max(1, bw - 2)}
                    height={1.6}
                    rx={0.8}
                    fill={edge}
                    className={s.cap}
                  />
                </>
              );
            })()}
            {i % 3 === 0 && (
              <text
                x={i * bw + bw / 2}
                y={H + 13}
                fontSize={8.5}
                textAnchor="middle"
                fill="var(--muted)"
              >
                {hr(h.at).replace(" ", "")}
              </text>
            )}
          </g>
        ))}
        <InfoScrub
          label="Stargazing score by hour"
          xs={hours.map((_, i) => i * bw + bw / 2)}
          top={0}
          bottom={H}
          width={W}
          height={H + 18}
          lit={false}
          title={(i) => `${day(hours[i].at)} ${hr(hours[i].at)}`}
          series={[
            {
              key: "sky",
              label: "Score",
              color: "var(--accent)",
              y: hours.map((h) => H - (h.score / 100) * H),
              text: hours.map((h) => `${h.score}/100`),
            },
          ]}
          rows={(i) => [
            {
              label: bandOf(hours[i].score).label,
              text: hours[i].f.limiting?.label ?? "Clear and dark",
              color: c(bandOf(hours[i].score).key),
            },
          ]}
        />
      </svg>
      <p className={s.muted}>
        Shaded columns are dark hours. Each bar is that hour&apos;s score out of
        100.
      </p>
      <ul className={s.list}>
        {hours
          .filter((h) => h.f.factors[0].value > 0)
          .map((h, i, list) => (
            <li key={h.at.toISOString()}>
              <b>
                {!i || h.at.getTime() - list[i - 1].at.getTime() > 3600_000
                  ? `${day(h.at)} ${hr(h.at)}`
                  : hr(h.at)}
              </b>
              <span>
                <i
                  style={{
                    background: c(bandOf(h.score).key),
                    boxShadow: `0 0 0 1px ${lit(c(bandOf(h.score).key))}`,
                  }}
                />
                {h.score}
              </span>
              <small>
                {h.f.limiting
                  ? `${h.f.limiting.label}: ${h.f.limiting.detail}`
                  : "clear and dark"}
              </small>
            </li>
          ))}
      </ul>
    </div>
  );
}
