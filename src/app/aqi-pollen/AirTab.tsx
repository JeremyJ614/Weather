import dynamic from "next/dynamic";
import { HeartPulse, Info, Wind } from "lucide-react";
import type { AirReport } from "@/lib/air/air";
import { AQI_BANDS, aqiBand } from "@/lib/air/scales";
import s from "./Air.module.css";

const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const hour = (iso: string) => {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
};
/** "Thu 3 PM" from a local "YYYY-MM-DDTHH:MM" hour. */
const hourLong = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(
    "en-US",
    { weekday: "short", timeZone: "UTC" },
  );
  const h = Number(iso.slice(11, 13));
  return `${d} ${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
};

const ABOUT: Record<string, string> = {
  "PM2.5":
    "Particles 30 times thinner than a hair, from smoke, exhaust and industry. They reach deep into the lungs and the bloodstream.",
  PM10: "Dust, pollen and mold fragments. They irritate the nose, throat and airways.",
  O3: "Ground-level ozone forms when sunlight cooks exhaust fumes, so it peaks on hot, sunny afternoons.",
  NO2: "Mostly from traffic and power plants. It inflames the airways and helps make ozone.",
  SO2: "From burning coal and oil, and volcanoes. It tightens the airways, especially in people with asthma.",
  CO: "An odorless gas from incomplete burning. Outdoors it rarely reaches harmful levels.",
};

/** Orbital AQI gauge: a 270° ring in the EPA colors with a glowing marker at the reading. */
function Orbit({ value }: { value: number }) {
  const b = aqiBand(value);
  const R = 88;
  const C = 2 * Math.PI * R;
  const span = 0.75;
  const f = Math.min(1, value / 300);
  const deg = -135 + 270 * f;
  return (
    <div className={s.orbit} style={{ ["--band" as string]: b.color }}>
      <svg viewBox="0 0 220 220" aria-hidden>
        <g transform="rotate(135 110 110)">
          <circle
            cx="110"
            cy="110"
            r={R}
            className={s.oTrack}
            strokeDasharray={`${C * span} ${C}`}
          />
          {AQI_BANDS.map((band, i) => {
            const from = i ? Math.min(1, AQI_BANDS[i - 1].max / 300) : 0;
            const to = Math.min(1, band.max / 300);
            if (to <= from) return null;
            return (
              <circle
                key={band.label}
                cx="110"
                cy="110"
                r={R}
                stroke={band.color}
                className={s.oArc}
                strokeDasharray={`${C * span * (to - from) - (i < 5 ? 2 : 0)} ${C}`}
                strokeDashoffset={-C * span * from}
              />
            );
          })}
        </g>
        {Array.from({ length: 28 }, (_, i) => (
          <line
            key={i}
            x1="110"
            y1="30"
            x2="110"
            y2={i % 3 ? 35 : 38}
            className={s.oTick}
            transform={`rotate(${-135 + (270 / 27) * i} 110 110)`}
          />
        ))}
        <g className={s.oKnob} style={{ ["--deg" as string]: `${deg}deg` }}>
          <circle cx="110" cy={110 - R} r="11" />
          <circle cx="110" cy={110 - R} r="4" className={s.oKnobDot} />
        </g>
      </svg>
      <div className={s.oCenter}>
        <b>{value}</b>
        <span>US AQI</span>
        <em>{Math.round(f * 100)}% of scale</em>
      </div>
    </div>
  );
}

const Terrain3D = dynamic(
  () => import("@/components/charts/Terrain3D").then((m) => m.Terrain3D),
  { ssr: false, loading: () => <div className="h-[260px]" /> },
);

export function AirTab({ aqi }: { aqi: NonNullable<AirReport["aqi"]> }) {
  const now = aqi.now ?? 0;
  const b = aqiBand(now);
  const hiHour = Math.max(1, ...aqi.hours.map((h) => h.aqi));
  return (
    <div className="grid gap-4">
      <section className={s.hero} style={{ ["--band" as string]: b.color }}>
        <div className={s.heroTop}>
          <p className={s.live}>
            <i aria-hidden /> Live air quality
          </p>
          {aqi.pollutant && (
            <span className={s.dominant}>Dominant: {aqi.pollutant}</span>
          )}
        </div>
        <Orbit value={now} />
        <p className={s.band}>{b.label}</p>
        <p className={s.advice}>{b.advice}</p>
        <div className={s.scale} aria-hidden>
          {AQI_BANDS.map((x, i) => (
            <span
              key={x.label}
              style={{
                background: x.color,
                flex: i === 4 ? 2 : i === 5 ? 1.2 : 1,
              }}
            />
          ))}
          <i
            style={{
              transform: `translateX(${Math.min(100, (now / 300) * 100)}%)`,
            }}
          >
            <b />
          </i>
        </div>
        <div className={s.scaleLabels} aria-hidden>
          <span>0</span>
          <span>Good</span>
          <span>Moderate</span>
          <span>USG</span>
          <span>Unhealthy</span>
          <span>300+</span>
        </div>
      </section>

      {aqi.pollutants.length > 0 && (
        <section className={s.grid2}>
          {aqi.pollutants.map((p, i) => {
            const pb = p.aqi != null ? aqiBand(p.aqi) : null;
            return (
              <article
                key={p.id}
                className={s.pol}
                style={{
                  ["--band" as string]: pb?.color ?? "var(--line)",
                  ["--d" as string]: i,
                }}
              >
                <p className={s.polId}>{p.id}</p>
                <p className={s.polName}>{p.label}</p>
                <p className={s.polVal}>
                  {p.value ?? p.aqi ?? "–"}
                  <small>{p.value != null ? ` ${p.unit}` : " AQI"}</small>
                </p>
                <span className={s.polBar}>
                  <i
                    style={{
                      transform: `scaleX(${Math.min(1, (p.aqi ?? 0) / 200)})`,
                    }}
                  />
                </span>
                <p className={s.polBand}>
                  {pb ? `${pb.label} · AQI ${p.aqi}` : "No index"}
                </p>
              </article>
            );
          })}
        </section>
      )}

      {aqi.hours.length > 0 && (
        <section className={s.card}>
          <h3 className={s.h3}>
            <Wind aria-hidden /> Next 48 hours
          </h3>
          <Terrain3D
            label="Air quality index by hour, next 48 hours"
            height={250}
            rows={
              aqi.parts?.length
                ? aqi.parts.map((p) => ({ label: p.id, color: "#9aa8c8" }))
                : [{ label: "AQI", color: "#9aa8c8" }]
            }
            cols={aqi.hours.map((h, i) => ({
              label: hourLong(h.at),
              tick: i % 6 === 0 ? (i === 0 ? "Now" : hour(h.at)) : undefined,
            }))}
            values={
              aqi.parts?.length
                ? aqi.parts.map((p) => p.aqi)
                : [aqi.hours.map((h) => h.aqi)]
            }
            max={Math.max(50, hiHour)}
            cellColor={(_r, _c, v) => aqiBand(v).color}
            readout={(c) => [
              {
                label: "AQI",
                text: `${aqi.hours[c].aqi} · ${aqiBand(aqi.hours[c].aqi).label}`,
                color: aqiBand(aqi.hours[c].aqi).color,
              },
              ...(aqi.parts ?? []).map((p) => ({
                label: p.id,
                text: p.aqi[c] == null ? "–" : String(p.aqi[c]),
                color: aqiBand(p.aqi[c] ?? 0).color,
              })),
            ]}
          />
        </section>
      )}

      {aqi.days.length > 0 && (
        <section className={s.days}>
          {aqi.days.slice(0, 4).map((d, i) => {
            const db = aqiBand(d.aqi);
            return (
              <article
                key={d.date}
                style={{ ["--band" as string]: db.color, ["--d" as string]: i }}
              >
                <p>{i === 0 ? "Today" : day(d.date)}</p>
                <b>{d.aqi}</b>
                <span>{db.label}</span>
              </article>
            );
          })}
        </section>
      )}

      <section className={s.card}>
        <h3 className={s.h3}>
          <Info aria-hidden /> What the numbers mean
        </h3>
        <ol className={s.legend}>
          {AQI_BANDS.map((x, i) => (
            <li key={x.label} style={{ ["--band" as string]: x.color }}>
              <span className={s.range}>
                {i ? AQI_BANDS[i - 1].max + 1 : 0}
                {x.max === Infinity ? "+" : `–${x.max}`}
              </span>
              <span>
                <b>{x.label}</b>
                <em>{x.advice}</em>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <details className={s.learn}>
        <summary>
          <HeartPulse aria-hidden /> Who is sensitive, and what is in the air
        </summary>
        <p>
          Children, adults over 65, people who are pregnant, outdoor workers and
          anyone with asthma, COPD or heart disease feel bad air first. The
          index is the worst of several pollutants, each scored on the same
          0–500 scale.
        </p>
        <dl>
          {Object.entries(ABOUT).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className={s.src}>
        {aqi.source === "AirNow"
          ? "Source: EPA AirNow."
          : "Source: Open-Meteo (CAMS) with EPA breakpoints."}
      </p>
    </div>
  );
}
