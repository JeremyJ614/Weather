"use client";

import { useEffect, useMemo, useState } from "react";
import { pick, type Colors } from "@/lib/colors/pick";
import {
  FIRST_SEASON,
  type SeasonStorm,
  type SeasonTotals,
} from "@/lib/tropical/season";
import { BASINS, mph, tierOf, type BasinId } from "@/lib/tropical/style";
import { TrackMap, type MapTrack } from "./TrackMap";
import t from "@/app/tropical-outlook/Tropical.module.css";
import s from "./Products.module.css";

type Season = { storms: SeasonStorm[]; totals: SeasonTotals };
type Got = { key: string; season?: Season; error?: string };

const PEAK: Record<SeasonStorm["peak"], string> = {
  TD: "Depression",
  TS: "Tropical storm",
  HU: "Hurricane",
  MH: "Major hurricane",
};
const day = (dtg: string) =>
  new Date(
    Date.UTC(+dtg.slice(0, 4), +dtg.slice(4, 6) - 1, +dtg.slice(6, 8)),
  ).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });

/** A season's storms from NHC's best tracks: totals, every track, and each storm's facts. */
export function SeasonView({
  colors,
  start,
}: {
  colors: Colors;
  start: BasinId;
}) {
  const now = new Date().getUTCFullYear();
  const [year, setYear] = useState(now);
  const [basin, setBasin] = useState<BasinId>(start);
  const [id, setId] = useState<string | null>(null);
  const key = `${year}-${basin}`;
  const [got, setGot] = useState<Got | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/tropical/season?year=${year}&basin=${basin.toLowerCase()}`)
      .then((r) => r.json())
      .then(
        (d: Season & { error?: string }) =>
          live &&
          setGot(
            d.error ? { key, error: d.error } : { key, season: d as Season },
          ),
      )
      .catch(
        () =>
          live &&
          setGot({ key, error: "The best-track archive couldn't be reached." }),
      );
    return () => {
      live = false;
    };
  }, [key, year, basin]);
  const ready = got?.key === key ? got : null;
  const storms = useMemo(() => ready?.season?.storms ?? [], [ready]);
  const tracks = useMemo<MapTrack[]>(
    () => storms.map((x) => ({ id: x.id, points: x.track })),
    [storms],
  );
  const picked = storms.find((x) => x.id === id) ?? null;
  const b = BASINS.find((x) => x.id === basin)!;
  const tone = (kt: number) => {
    const k = tierOf(kt);
    return pick(colors, `trop:${k.key}`, k.color);
  };
  const years = Array.from(
    { length: now - FIRST_SEASON + 1 },
    (_, i) => now - i,
  );
  const tot = ready?.season?.totals;

  return (
    <section className={t.panel}>
      <header>
        <small>NHC best tracks</small>
        <h4>
          {year} {b.name} season
        </h4>
      </header>
      <div className={s.controls}>
        <select
          value={year}
          aria-label="Season"
          onChange={(e) => {
            setYear(Number(e.target.value));
            setId(null);
          }}
        >
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <div className={s.pills} role="group" aria-label="Basin">
          {BASINS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === basin}
              onClick={() => {
                setBasin(x.id);
                setId(null);
              }}
            >
              {x.name}
            </button>
          ))}
        </div>
      </div>
      {tot && (
        <div className={s.stats}>
          <div>
            <small>Named</small>
            <b>{tot.named}</b>
            <span>storms</span>
          </div>
          <div>
            <small>Hurricanes</small>
            <b>{tot.hurricanes}</b>
            <span>{tot.majors} major</span>
          </div>
          <div>
            <small>Systems</small>
            <b>{tot.storms}</b>
            <span>with depressions</span>
          </div>
          <div>
            <small>ACE</small>
            <b>{tot.ace}</b>
            <span>cyclone energy</span>
          </div>
        </div>
      )}
      <TrackMap
        key={basin}
        tracks={tracks}
        selected={id}
        onPick={setId}
        colors={colors}
        center={b.center}
        zoom={b.zoom}
        label={`Tracks of the ${year} ${b.name} season`}
      />
      {picked && (
        <div className={s.stats} aria-live="polite">
          <div>
            <small>{picked.name}</small>
            <b>{mph(picked.peakKt)} mph</b>
            <span>
              peak ·{" "}
              {picked.peakKt >= 64
                ? tierOf(picked.peakKt).label
                : PEAK[picked.peak]}
            </span>
          </div>
          <div>
            <small>Lowest pressure</small>
            <b>{picked.minMb ? `${picked.minMb} mb` : "–"}</b>
            <span>minimum central</span>
          </div>
          <div>
            <small>Active</small>
            <b>{day(picked.first)}</b>
            <span>to {day(picked.last)}</span>
          </div>
          <div>
            <small>ACE</small>
            <b>{picked.ace}</b>
            <span>
              {tot?.ace
                ? `${Math.round((picked.ace / tot.ace) * 100)}% of the season`
                : ""}
            </span>
          </div>
        </div>
      )}
      {!ready ? (
        <p className={t.empty}>Reading the {year} best tracks…</p>
      ) : ready.error ? (
        <p className={t.empty}>{ready.error}</p>
      ) : !storms.length ? (
        <p className={t.empty}>
          No tropical cyclones in the {b.name} in {year}
          {year === now ? " so far" : ""}.
        </p>
      ) : (
        <div className={s.list}>
          {storms.map((x) => (
            <button
              key={x.id}
              type="button"
              className={s.row}
              aria-pressed={x.id === id}
              onClick={() => setId(x.id === id ? null : x.id)}
              style={{ ["--c" as string]: tone(x.peakKt) }}
            >
              <i aria-hidden />
              <span>
                <b>
                  {x.num}. {x.name}
                </b>
                <small>
                  {day(x.first)} to {day(x.last)} ·{" "}
                  {x.peakKt >= 64 ? tierOf(x.peakKt).label : PEAK[x.peak]}
                </small>
              </span>
              <em>
                {mph(x.peakKt)} mph
                <br />
                {x.minMb ? `${x.minMb} mb` : ""}
              </em>
            </button>
          ))}
        </div>
      )}
      <p className={s.source}>
        National Hurricane Center best tracks (ATCF), 2004 to now. This
        season&apos;s tracks are operational and are finalized after the season.
        ACE adds up the square of each six-hourly wind while a storm is at
        tropical-storm strength or more.
      </p>
    </section>
  );
}
