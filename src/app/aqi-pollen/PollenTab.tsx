/* eslint-disable @next/next/no-img-element -- plant photos come from Google's pollen service */
import {
  CalendarRange,
  CloudRain,
  Flower2,
  Leaf,
  ShieldCheck,
  Sprout,
  Sun,
  TreeDeciduous,
  Wind,
  Zap,
} from "lucide-react";
import type { AirReport } from "@/lib/air/air";
import { POLLEN_SEASONS } from "@/lib/air/scales";
import s from "./Air.module.css";

const LEVEL = [
  "#3a3f55",
  "#5fd36b",
  "#a3e635",
  "#f2e05a",
  "#f59b3d",
  "#e8463b",
];
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const ICON: Record<string, typeof Leaf> = {
  TREE: TreeDeciduous,
  GRASS: Sprout,
  WEED: Flower2,
};
const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
const hour = (iso: string, timeZone: string) =>
  new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", timeZone })
    .replace(" ", "")
    .toLowerCase();

/** Five-step pollen meter (Google's Universal Pollen Index, 0–5). */
function Meter({ index }: { index: number }) {
  return (
    <span className={s.meter} aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          style={{
            background: n <= index ? LEVEL[index] : undefined,
            boxShadow: n <= index ? `0 0 8px ${LEVEL[index]}` : undefined,
          }}
        />
      ))}
    </span>
  );
}

export function PollenTab({
  pollen,
  month,
}: {
  pollen: AirReport["pollen"];
  month: number;
}) {
  return (
    <div className="grid gap-4">
      {pollen?.kind === "counts" && <Counts pollen={pollen} />}
      {pollen?.kind === "dispersal" && <Dispersal pollen={pollen} />}
      {!pollen && (
        <p className="panel rounded-2xl p-4 text-sm text-muted">
          Pollen isn&apos;t available for this place right now.
        </p>
      )}

      <section className={s.card}>
        <h3 className={s.h3}>
          <CalendarRange aria-hidden /> Typically in season
        </h3>
        <div className={s.seasons}>
          {POLLEN_SEASONS.map((p) => {
            const on = (p.months as readonly number[]).includes(month);
            return (
              <article key={p.label} className={on ? s.seasonOn : undefined}>
                <p className={s.seasonName}>
                  {p.label}
                  {on && <span>In season</span>}
                </p>
                <div className={s.months} aria-hidden>
                  {MONTHS.map((m, i) => (
                    <i
                      key={i}
                      className={`${(p.months as readonly number[]).includes(i + 1) ? s.mOn : ""} ${i + 1 === month ? s.mNow : ""}`}
                    >
                      {m}
                    </i>
                  ))}
                </div>
                <p className={s.seasonNote}>{p.note}</p>
              </article>
            );
          })}
        </div>
        <p className={s.src}>Broad US climatology, not a measurement.</p>
      </section>

      <section className={s.card}>
        <h3 className={s.h3}>
          <Wind aria-hidden /> How weather moves pollen
        </h3>
        <ul className={s.facts}>
          <li>
            <Sun aria-hidden />
            <span>
              <b>Warm, dry mornings</b> release the most. Grass and ragweed peak
              from late morning to midday.
            </span>
          </li>
          <li>
            <Wind aria-hidden />
            <span>
              <b>Wind</b> carries it for miles; breezy days after dry spells are
              the worst.
            </span>
          </li>
          <li>
            <CloudRain aria-hidden />
            <span>
              <b>Steady rain</b> washes it out of the air, so counts drop during
              and right after.
            </span>
          </li>
          <li>
            <Zap aria-hidden />
            <span>
              <b>Thunderstorms</b> can burst grains into tiny fragments that
              trigger &ldquo;thunderstorm asthma.&rdquo;
            </span>
          </li>
        </ul>
      </section>

      <details className={s.learn}>
        <summary>
          <ShieldCheck aria-hidden /> Ways to cut your exposure
        </summary>
        <ul className={s.tips}>
          <li>Keep windows shut on high days and run the AC on recirculate.</li>
          <li>Plan outdoor time for late afternoon or after rain.</li>
          <li>Shower and change clothes after time outside.</li>
          <li>Wear sunglasses; dry laundry indoors.</li>
          <li>Start allergy medicine before your season, not after it hits.</li>
        </ul>
      </details>
    </div>
  );
}

function Counts({
  pollen,
}: {
  pollen: Extract<NonNullable<AirReport["pollen"]>, { kind: "counts" }>;
}) {
  const today = pollen.days[0];
  const top = today?.types.reduce(
    (a, b) => (b.index > a.index ? b : a),
    today.types[0],
  );
  const advice = [...new Set(today?.types.flatMap((t) => t.advice) ?? [])];
  return (
    <>
      {top && (
        <section
          className={s.hero}
          style={{ ["--band" as string]: LEVEL[top.index] }}
        >
          <div className={s.heroTop}>
            <p className={s.live}>
              <i aria-hidden /> Pollen today
            </p>
            <span className={s.dominant}>Highest: {top.label}</span>
          </div>
          <p className={s.pollenBig}>{top.category}</p>
          <Meter index={top.index} />
          <div className={s.types}>
            {today.types.map((t, i) => {
              const Icon = ICON[t.code] ?? Leaf;
              return (
                <article
                  key={t.code}
                  style={{
                    ["--band" as string]: LEVEL[t.index],
                    ["--d" as string]: i,
                  }}
                >
                  <Icon aria-hidden />
                  <p>{t.label}</p>
                  <b>{t.category}</b>
                  <Meter index={t.index} />
                  {t.inSeason === false && <em>out of season</em>}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className={s.card}>
        <h3 className={s.h3}>
          <CalendarRange aria-hidden /> 5-day outlook
        </h3>
        <table className={s.matrix}>
          <thead>
            <tr>
              <th />
              {pollen.days.map((d, i) => (
                <th key={d.date}>{i === 0 ? "Today" : day(d.date)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(today?.types ?? []).map((t) => (
              <tr key={t.code}>
                <th>{t.label}</th>
                {pollen.days.map((d) => {
                  const x = d.types.find((y) => y.code === t.code);
                  const n = x?.index ?? 0;
                  return (
                    <td key={d.date}>
                      <span
                        style={{
                          background: LEVEL[n],
                          boxShadow: n ? `0 0 10px ${LEVEL[n]}66` : undefined,
                        }}
                      >
                        {n}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {pollen.plants.some((p) => p.index) && (
        <section className={s.card}>
          <h3 className={s.h3}>
            <Leaf aria-hidden /> Plants in the air
          </h3>
          <div className={s.plants}>
            {pollen.plants
              .filter((p) => p.inSeason !== false)
              .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))
              .map((p, i) => (
                <article key={p.code} style={{ ["--d" as string]: i }}>
                  {p.picture && (
                    <img
                      src={p.picture}
                      alt=""
                      loading="lazy"
                      className={s.plantImg}
                    />
                  )}
                  <div className={s.plantBody}>
                    <p className={s.plantName}>{p.label}</p>
                    <p className={s.plantMeta}>
                      {[p.type?.toLowerCase(), p.family]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {p.index != null && (
                      <span
                        className={s.chip}
                        style={{ ["--band" as string]: LEVEL[p.index] }}
                      >
                        {p.category}
                      </span>
                    )}
                    {p.season && (
                      <p className={s.plantNote}>Season: {p.season}</p>
                    )}
                    {p.crossReaction && (
                      <p className={s.plantNote}>
                        Cross-reacts with {p.crossReaction}
                      </p>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </section>
      )}

      {advice.length > 0 && (
        <section className={s.card}>
          <h3 className={s.h3}>
            <ShieldCheck aria-hidden /> Advice for today
          </h3>
          <ul className={s.tips}>
            {advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}
      <p className={s.src}>Source: Google Pollen.</p>
    </>
  );
}

function Dispersal({
  pollen,
}: {
  pollen: Extract<NonNullable<AirReport["pollen"]>, { kind: "dispersal" }>;
}) {
  const peak = pollen.peak;
  return (
    <section className={s.card}>
      <h3 className={s.h3}>
        <Wind aria-hidden /> Pollen dispersal, next 24 hours
      </h3>
      {peak && (
        <p className={s.lead}>
          Worst around {hour(peak.at, pollen.timeZone)}: <b>{peak.band}</b>
        </p>
      )}
      <div className={s.bars} aria-hidden>
        {pollen.hours.map((h, i) => (
          <i
            key={h.at}
            style={{
              background: LEVEL[Math.min(5, Math.ceil(h.score / 20))],
              transform: `scaleY(${Math.max(0.05, h.score / 100)})`,
              animationDelay: `${i * 20}ms`,
            }}
          />
        ))}
      </div>
      <div className={s.axis}>
        <span>Now</span>
        <span>
          {hour(pollen.hours[12]?.at ?? pollen.hours[0].at, pollen.timeZone)}
        </span>
        <span>{hour(pollen.hours.at(-1)!.at, pollen.timeZone)}</span>
      </div>
      <p className={s.src}>
        How well today&apos;s warmth, wind, humidity and rain spread whatever
        pollen is out. It is a weather reading, not a pollen count.
      </p>
    </section>
  );
}
