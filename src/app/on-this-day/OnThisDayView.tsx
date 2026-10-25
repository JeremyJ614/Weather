"use client";

import { UsMap } from "@/features/maps/UsMap";
import { EF_COLORS } from "@/lib/colors/ef";
import { pick, type Colors } from "@/lib/colors/pick";
import type { OtdFeature } from "@/lib/history/onthisday";
import type { OtdStory } from "@/lib/history/story";
import { INTENSITY, tierOf } from "@/lib/tropical/style";
import { KIND } from "@/lib/warnings/reports";
import s from "./OnThisDay.module.css";

export type Drawn = {
  tracks: { d: string; mag: number }[];
  reports: { k: "torn" | "wind" | "hail"; x: number; y: number }[];
  storm: {
    segs: { d: string; kt: number }[];
    land: readonly [number, number];
  } | null;
};

const MONTHS =
  "January February March April May June July August September October November December".split(
    " ",
  );
const REPORT = { torn: "tornado", wind: "wind", hail: "hail" } as const;

/** On This Day: one featured event from today's date in history, its story and its map. */
export function OnThisDayView({
  md,
  feature: f,
  story,
  drawn,
  colors,
}: {
  md: string;
  feature: OtdFeature | null;
  story: OtdStory | null;
  drawn: Drawn | null;
  colors: Colors;
}) {
  const date = `${MONTHS[Number(md.slice(0, 2)) - 1]} ${Number(md.slice(3))}`;
  if (!f || !drawn)
    return (
      <p className={s.empty}>
        Today&apos;s story is being put together from NOAA&apos;s records. Check
        back in a minute.
      </p>
    );
  const ef = (mag: number) => {
    const k = mag < 0 ? "EFU" : `EF${mag}`;
    return pick(colors, `ef:${k}`, EF_COLORS[k]);
  };
  const rep = (k: keyof typeof REPORT) =>
    pick(colors, `report:${REPORT[k]}`, KIND[REPORT[k]].color);
  const trop = (kt: number) => {
    const t = tierOf(kt);
    return pick(colors, `trop:${t.key}`, t.color);
  };
  const legend = f.storm
    ? INTENSITY.filter((t) =>
        drawn.storm!.segs.some((g) => tierOf(g.kt).key === t.key),
      ).map((t) => ({ label: t.label, color: trop(t.min) }))
    : [
        ...[0, 1, 2, 3, 4, 5]
          .filter((m) => f.tracks.some((t) => t.mag === m))
          .map((m) => ({
            label: `${f.year >= 2007 ? "EF" : "F"}${m}`,
            color: ef(m),
          })),
        ...(["wind", "hail"] as const)
          .filter((k) => f.reports.some((r) => r.k === k))
          .map((k) => ({ label: `${KIND[k].label} reports`, color: rep(k) })),
      ];

  return (
    <article className="grid gap-5">
      <header className={s.story}>
        <p className="eyebrow">
          {date}, {f.year}
        </p>
        <h2>{story?.title ?? f.label}</h2>
        <p className={s.lead}>{story?.headline ?? f.facts[0]}</p>
      </header>

      {story && story.photos.length > 0 && (
        <div className={s.photos}>
          {story.photos.map((p) => (
            <figure key={p.src}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia Commons, credited below */}
              <img
                src={p.src}
                width={p.w}
                height={p.h}
                alt={p.caption || `${story.title}, ${f.year}`}
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                {p.caption && <span>{p.caption}</span>}
                <a href={p.page} target="_blank" rel="noreferrer">
                  {p.credit}
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <section className={s.body}>
        {(story?.story ?? f.facts).map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
        {!story && (
          <p className={s.fine}>
            The full story is still being written; these are NOAA&apos;s records
            for the day.
          </p>
        )}
      </section>

      <dl className={s.tiles}>
        {f.stats.map((x) => (
          <div key={x.k}>
            <dt>{x.k}</dt>
            <dd>{x.v}</dd>
          </div>
        ))}
      </dl>

      <UsMap
        title={
          f.storm
            ? `${story?.title ?? f.label}: its track`
            : `${date}, ${f.year}: ${f.tracks.length ? "tornado tracks" : ""}${f.tracks.length && f.reports.length ? " and " : ""}${f.reports.length ? "storm reports" : ""}`
        }
        sub={null}
        legend={legend}
        status="ready"
        file={`sswx-on-this-day-${f.year}-${md}`}
      >
        {drawn.reports.map((r, i) => (
          <circle
            key={`r${i}`}
            cx={r.x}
            cy={r.y}
            r={1.6}
            fill={rep(r.k)}
            opacity={0.8}
          />
        ))}
        {drawn.tracks.map((t, i) => (
          <path
            key={`t${i}`}
            d={t.d}
            stroke={ef(t.mag)}
            strokeWidth={t.mag >= 4 ? 2.8 : t.mag >= 2 ? 2 : 1.4}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {drawn.storm?.segs.map((g, i) => (
          <path
            key={`s${i}`}
            d={g.d}
            stroke={trop(g.kt)}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {drawn.storm && (
          <circle
            cx={drawn.storm.land[0]}
            cy={drawn.storm.land[1]}
            r={5}
            fill="none"
            stroke={trop(130)}
            strokeWidth={2}
          >
            <title>Landfall</title>
          </circle>
        )}
      </UsMap>

      <p className={s.fine}>
        {f.storm
          ? "Track and landfall from the National Hurricane Center's HURDAT2 best tracks."
          : "Tracks and reports from the Storm Prediction Center's severe weather database (the Fujita scale before 2007, Enhanced Fujita since)."}{" "}
        {story
          ? `The story is written by AI from NOAA's records${story.source ? " and Wikipedia's article" : ""}, and nothing else.`
          : ""}{" "}
        {story?.source && (
          <a href={story.source.url} target="_blank" rel="noreferrer">
            Read more: {story.source.title}
          </a>
        )}
      </p>
    </article>
  );
}
