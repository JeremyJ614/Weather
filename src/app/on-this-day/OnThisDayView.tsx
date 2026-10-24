"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CloudHail,
  CloudLightning,
  Flame,
  Orbit,
  Snowflake,
  ThermometerSun,
  Tornado,
  Waves,
  Wind,
} from "lucide-react";
import { UsMap } from "@/features/maps/UsMap";
import { EF_COLORS } from "@/lib/colors/ef";
import { pick, type Colors } from "@/lib/colors/pick";
import type { OtdData } from "@/lib/history/onthisday";
import type { Kind, OtdEvent, OtdStory } from "@/lib/history/story";
import s from "./OnThisDay.module.css";

const ICON: Record<Kind, React.ComponentType<{ "aria-hidden"?: boolean }>> = {
  tornado: Tornado,
  hurricane: Orbit,
  flood: Waves,
  winter: Snowflake,
  heat: ThermometerSun,
  cold: Snowflake,
  wind: Wind,
  hail: CloudHail,
  fire: Flame,
  other: CloudLightning,
};
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const name = (md: string) =>
  `${MONTHS[Number(md.slice(0, 2)) - 1]} ${Number(md.slice(3))}`;
/** The day before or after, in a leap year so February 29 has neighbors. */
const step = (md: string, by: number) =>
  new Date(Date.parse(`2024-${md}T12:00:00Z`) + by * 86400_000)
    .toISOString()
    .slice(5, 10);

/** Without stories yet, the records themselves make the timeline. */
function fromRecords(d: OtdData): OtdEvent[] {
  return [
    ...d.tornadoes.top.slice(0, 6).map((t): OtdEvent => ({
      year: t.year,
      kind: "tornado",
      title: `${t.rating} tornado${t.near ? `, ${t.near}` : ` in ${t.st}`}`,
      text: `On the ground ${t.miles.toFixed(1)} miles, up to ${t.yards.toLocaleString()} yards wide${t.deaths ? `; ${t.deaths} killed` : ""}${t.hurt ? `, ${t.hurt.toLocaleString()} injured` : ""}.`,
      from: "records",
    })),
    ...d.landfalls.slice(0, 3).map((l): OtdEvent => ({
      year: l.year,
      kind: "hurricane",
      title: `${l.name} comes ashore`,
      text: `${l.name} made landfall ${l.near} as a ${l.strength.toLowerCase()} with ${l.mph} mph winds.`,
      from: "records",
    })),
  ].sort((a, b) => b.year - a.year);
}

/** On This Day: the date's story, its timeline, its tornado map and its numbers. */
export function OnThisDayView({
  md,
  today,
  data,
  story,
  paths,
  colors,
}: {
  md: string;
  today: string;
  data: OtdData | null;
  story: OtdStory | null;
  paths: { d: string; mag: number }[];
  colors: Colors;
}) {
  const router = useRouter();
  const ef = (mag: number) => {
    const k = mag < 0 ? "EFU" : `EF${mag}`;
    return pick(colors, `ef:${k}`, EF_COLORS[k]);
  };
  const go = (to: string) =>
    router.push(to === today ? "/on-this-day" : `/on-this-day?d=${to}`, {
      scroll: false,
    });

  const nav = (
    <nav className={s.nav} aria-label="Pick a date">
      <Link
        href={`/on-this-day?d=${step(md, -1)}`}
        scroll={false}
        aria-label={`Back to ${name(step(md, -1))}`}
      >
        <ChevronLeft aria-hidden />
      </Link>
      <label className={s.pick}>
        <span className="sr-only">Date</span>
        <input
          type="date"
          min="2024-01-01"
          max="2024-12-31"
          value={`2024-${md}`}
          onChange={(e) => e.target.value && go(e.target.value.slice(5))}
        />
        <b>{name(md)}</b>
      </label>
      <Link
        href={`/on-this-day?d=${step(md, 1)}`}
        scroll={false}
        aria-label={`On to ${name(step(md, 1))}`}
      >
        <ChevronRight aria-hidden />
      </Link>
      {md !== today && (
        <Link href="/on-this-day" scroll={false} className={s.today}>
          Today
        </Link>
      )}
    </nav>
  );

  if (!data)
    return (
      <div className="grid gap-4">
        {nav}
        <p className={s.empty}>
          NOAA&apos;s record files aren&apos;t answering right now, so this date
          can&apos;t be looked up. Try again in a few minutes.
        </p>
      </div>
    );

  const t = data.tornadoes;
  const events = story?.events ?? fromRecords(data);
  const strongest = [5, 4, 3, 2, 1, 0].find((m) => t.byMag[m]) ?? -1;
  const peak = Math.max(1, ...t.perYear.map((y) => y.n));
  const busiest = t.perYear.reduce((a, b) => (b.n > a.n ? b : a), t.perYear[0]);
  const W = 600;
  const H = 120;
  const bw = W / t.perYear.length;

  return (
    <div className="grid gap-5">
      {nav}

      <section className={s.story}>
        <p className="eyebrow">{name(md)} in weather history</p>
        <h2>
          {story?.headline ??
            (t.total
              ? `${t.total} tornadoes have touched down on ${name(md)} since 1950.`
              : `A quiet date in the record books.`)}
        </h2>
        {story?.intro && <p>{story.intro}</p>}
      </section>

      {events.length > 0 && (
        <ol className={s.timeline}>
          {events.map((e, i) => {
            const Icon = ICON[e.kind] ?? CloudLightning;
            return (
              <li key={`${e.year}-${i}`} className={s.event}>
                <span className={s.year}>{e.year}</span>
                <span className={s.icon}>
                  <Icon aria-hidden />
                </span>
                <div>
                  <b>{e.title}</b>
                  <p>{e.text}</p>
                  <small>
                    {e.from === "records"
                      ? "NOAA records"
                      : "From the record books"}
                  </small>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <dl className={s.tiles}>
        <div>
          <dt>Tornadoes on this date</dt>
          <dd>{t.total.toLocaleString()}</dd>
          <small>since 1950</small>
        </div>
        <div>
          <dt>Years with one</dt>
          <dd>{t.years}</dd>
          <small>of {t.perYear.length}</small>
        </div>
        <div>
          <dt>Strongest</dt>
          <dd style={{ color: strongest >= 0 ? ef(strongest) : undefined }}>
            {strongest >= 0 ? `(E)F${strongest}` : "—"}
          </dd>
          <small>
            {strongest >= 0 ? `${t.byMag[strongest]} on record` : "none rated"}
          </small>
        </div>
        <div>
          <dt>Lives lost</dt>
          <dd>{t.deaths.toLocaleString()}</dd>
          <small>to tornadoes</small>
        </div>
      </dl>

      <UsMap
        title={`${paths.length} (E)F2+ tornadoes on ${name(md)}, 1950–${data.through}`}
        sub={null}
        legend={[2, 3, 4, 5].map((m) => ({
          label: `(E)F${m}`,
          color: ef(m),
        }))}
        status={paths.length ? "ready" : "empty"}
        file={`sswx-on-this-day-${md}`}
      >
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={ef(p.mag)}
            strokeWidth={p.mag >= 4 ? 2.6 : 1.8}
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
          />
        ))}
      </UsMap>

      <section className={s.panel}>
        <p className="eyebrow">Tornadoes on {name(md)}, year by year</p>
        <svg
          viewBox={`0 0 ${W} ${H + 18}`}
          className={s.bars}
          role="img"
          aria-label={`Most in one year: ${busiest.n} in ${busiest.year}`}
        >
          {t.perYear.map((y, i) =>
            y.n ? (
              <rect
                key={y.year}
                x={i * bw + 0.5}
                width={Math.max(1, bw - 1)}
                y={H - (y.n / peak) * H}
                height={(y.n / peak) * H}
                rx={1}
                fill={ef(y.top)}
              >
                <title>{`${y.year}: ${y.n}`}</title>
              </rect>
            ) : null,
          )}
          {[1950, 1975, 2000, data.through].map((y) => (
            <text
              key={y}
              x={(y - 1950) * bw + bw / 2}
              y={H + 14}
              textAnchor={
                y === 1950 ? "start" : y === data.through ? "end" : "middle"
              }
              className={s.axis}
            >
              {y}
            </text>
          ))}
        </svg>
        <p className={s.note}>
          Most in one year: <b>{busiest.n}</b> in {busiest.year}. Each bar is
          colored by that year&apos;s strongest rating.
        </p>
      </section>

      {data.landfalls.length > 0 && (
        <section className={s.panel}>
          <p className="eyebrow">Landfalls on {name(md)}</p>
          <ul className={s.list}>
            {data.landfalls.slice(0, 8).map((l, i) => (
              <li key={`${l.year}-${l.name}-${i}`}>
                <span className={s.year}>{l.year}</span>
                <span>
                  <b>{l.name}</b>, {l.strength.toLowerCase()} · {l.mph} mph ·{" "}
                  {l.near}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={s.fine}>
        Tornadoes from the Storm Prediction Center&apos;s database (1950–
        {data.through}; the Fujita scale before 2007, Enhanced Fujita since).
        Landfalls from the National Hurricane Center&apos;s HURDAT2 best tracks.
        {story
          ? " The story and timeline are written by AI from these records; entries marked “From the record books” come from its wider knowledge of the date."
          : ""}
      </p>
    </div>
  );
}
