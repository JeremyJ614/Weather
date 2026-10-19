"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageSource, Map as MaplibreMap } from "maplibre-gl";
import { CloudLightning, Tornado, Wind } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { usePlaces } from "@/features/location/usePlaces";
import { rasterize } from "@/features/sky/raster";
import { pick, type Colors } from "@/lib/colors/pick";
import { EF_COLORS } from "@/lib/colors/ef";
import { INTENSITY, tierOf, mph } from "@/lib/tropical/style";
import { CLIMO_LIGHT, CLIMO_LINES, CLIMO_RAMP } from "@/lib/climo/style";
import s from "./Climo.module.css";

type Grid = { lat0: number; lon0: number; step: number; w: number; h: number };
type TSummary = {
  first: number;
  last: number;
  byYear: [number, number][];
  months: number[];
  monthsSig: number[];
  hours: number[];
  ef: number[];
  states: Record<string, [number, number, number]>;
  grid: Grid & { all: number[]; sig: number[] };
  deaths: number[];
  deadliest: [string, string, number, number][];
  regionMonth: Record<string, number[]>;
  lenBins: number[];
  widBins: number[];
};
type Twister = {
  s: [number, number];
  e: [number, number];
  ef: number;
  date: string;
  dead: number;
  hurt: number;
  st: string;
};
type TNear = {
  miles: number;
  years: number;
  count: number;
  sig: number;
  violent: number;
  dead: number;
  hurt: number;
  months: number[];
  recent: Twister | null;
  strongest: Twister[];
};
type HSummary = {
  first: number;
  last: number;
  grid: Grid & { hu: number[]; ts: number[] };
  season: { AL: number[]; EP: number[] };
  ace: {
    AL: [number, number, number, number, number][];
    EP: [number, number, number, number, number][];
  };
};
type Pass = {
  name: string;
  year: number;
  basin: string;
  kt: number;
  md: string;
};
type HNear = {
  miles: number;
  years: number;
  count: number;
  hurricanes: number;
  majors: number;
  months: number[];
  recent: Pass | null;
  strongest: Pass[];
};

const MONTHS = "J F M A M J J A S O N D".split(" ");
const MONTH_NAMES = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(
  " ",
);
const efName = (m: number) => (m < 0 ? "EFU" : `EF${m}`);
const day = (ymd: string) =>
  new Date(
    `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T12:00:00Z`,
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const every = (n: number, years: number) => {
  if (!n) return "none on record";
  const y = years / n;
  return y < 1
    ? `about ${Math.round(n / years)} a year`
    : y < 1.5
      ? "about once a year"
      : `about once every ${Math.round(y)} years`;
};

function useJson<T>(url: string | null) {
  const [res, setRes] = useState<{ url: string; d: T | "error" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: T) => live && setRes({ url, d }))
      .catch(() => live && setRes({ url, d: "error" }));
    return () => {
      live = false;
    };
  }, [url]);
  return url && res?.url === url ? res.d : null;
}

/** Simple bar chart: one series, optional highlight series drawn over it. */
function Bars({
  values,
  over,
  labels,
  color,
  overColor,
  h = 110,
  every: step = 1,
}: {
  values: number[];
  over?: number[];
  labels?: string[];
  color: string;
  overColor?: string;
  h?: number;
  every?: number;
}) {
  const W = 360;
  const max = Math.max(1, ...values);
  const bw = W / values.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${h + (labels ? 14 : 0)}`}
      className="w-full"
      role="img"
      aria-label="Chart"
    >
      {values.map((v, i) => (
        <g key={i}>
          <rect
            x={i * bw + bw * 0.12}
            y={h - (v / max) * h}
            width={bw * 0.76}
            height={(v / max) * h}
            rx={1}
            fill={color}
            opacity={over ? 0.35 : 0.9}
          />
          {over && (
            <rect
              x={i * bw + bw * 0.12}
              y={h - (over[i] / max) * h}
              width={bw * 0.76}
              height={(over[i] / max) * h}
              rx={1}
              fill={overColor}
            />
          )}
          {labels && i % step === 0 && (
            <text
              x={i * bw + bw / 2}
              y={h + 11}
              fontSize={8.5}
              textAnchor="middle"
              fill="var(--muted)"
            >
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Climatology: tornadoes, lightning and hurricanes, near you and nationally. */
export function ClimoView({ colors }: { colors: Colors }) {
  const c = (k: string) =>
    pick(
      colors,
      `climo:${k}`,
      [...CLIMO_RAMP, ...CLIMO_LIGHT, ...CLIMO_LINES].find((x) => x.key === k)
        ?.color ?? "#ffffff",
    );
  return (
    <div className="grid gap-4">
      <HomeTabs
        label="Climatology"
        tabs={[
          {
            id: "cl-tor",
            label: "Tornadoes",
            icon: <Tornado aria-hidden />,
            panel: <Tornadoes c={c} colors={colors} />,
          },
          {
            id: "cl-lt",
            label: "Lightning",
            icon: <CloudLightning aria-hidden />,
            panel: <Lightning c={c} />,
          },
          {
            id: "cl-hu",
            label: "Hurricanes",
            icon: <Wind aria-hidden />,
            panel: <Hurricanes c={c} colors={colors} />,
          },
        ]}
      />
      <p className={s.foot}>
        Sources: NOAA Storm Prediction Center tornado database (1950 on), NHC
        HURDAT2 best tracks for the Atlantic and Eastern Pacific (1950 on), and
        NASA&apos;s LIS/OTD lightning climatology (1995–2014, monthly detail
        from TRMM LIS where it flew) through NASA GIBS.
      </p>
    </div>
  );
}

function Tornadoes({
  c,
  colors,
}: {
  c: (k: string) => string;
  colors: Colors;
}) {
  const { active } = usePlaces();
  const sum = useJson<TSummary>("/api/climo/tornado");
  const near = useJson<TNear>(
    active
      ? `/api/climo/tornado?lat=${active.lat.toFixed(2)}&lon=${active.lon.toFixed(2)}`
      : null,
  );
  const [part, setPart] = useState<"when" | "where" | "record" | "anatomy">(
    "when",
  );
  const [layer, setLayer] = useState<"all" | "sig" | "tracks">("all");
  const sig = layer === "sig";
  const [minEf, setMinEf] = useState(3);
  const [since, setSince] = useState(1950);
  const tracks = useJson<[number, number, number, number, number][]>(
    part === "where" && layer === "tracks"
      ? `/api/climo/tornado?tracks&min=${minEf}&since=${since}`
      : null,
  );
  const efc = (m: number) =>
    pick(colors, `ef:${efName(m)}`, EF_COLORS[efName(m)]);
  const t = sum && sum !== "error" ? sum : null;
  const stops = CLIMO_RAMP.map((r, i) => ({ at: i * 25, color: c(r.key) }));
  const stopKey = stops.map((x) => x.color).join();
  const nYears = t ? t.last - t.first + 1 : 1;
  const thisMonth = new Date().getMonth();
  const avgYear = t
    ? Math.round(t.months.reduce((a, b) => a + b, 0) / nYears)
    : 0;
  const ytd = t
    ? Math.round(
        t.months.slice(0, thisMonth + 1).reduce((a, b) => a + b, 0) / nYears,
      )
    : 0;
  const busiest = t
    ? t.byYear.reduce<[number, number]>(
        (m, y, i) => (y[0] > m[1] ? [t.first + i, y[0]] : m),
        [t.first, 0],
      )
    : [0, 0];
  // A cached answer from before deaths were added has none; it must not crash the page.
  const totalDead = (t?.deaths ?? []).reduce((a, b) => a + b, 0);
  const seasonRows = t
    ? [["United States", t.months] as const, ...Object.entries(t.regionMonth)]
        .map(([name, v]) => {
          const vals = v.map((x) => x / nYears);
          const max = Math.max(...vals);
          return { name, vals, max, peak: vals.indexOf(max) };
        })
        .sort((a, b) =>
          a.name === "United States"
            ? -1
            : b.name === "United States"
              ? 1
              : a.peak - b.peak,
        )
    : [];
  const img = useMemo(() => {
    if (!t) return null;
    const g = t.grid;
    const vals = sig ? g.sig : g.all;
    const years = t.last - t.first + 1;
    // Tornadoes per 1,000 sq mi per decade, scaled so the busiest cells reach the top.
    const per = (i: number, j: number) => {
      const lat = g.lat0 + (i + 0.5) * g.step;
      const area = (g.step * 69.1) ** 2 * Math.cos((lat * Math.PI) / 180);
      return (vals[i * g.w + j] / area) * 1000 * (10 / years);
    };
    let max = 0;
    for (let i = 0; i < g.h; i++)
      for (let j = 0; j < g.w; j++) max = Math.max(max, per(i, j));
    const lats = Array.from(
      { length: g.h },
      (_, i) => g.lat0 + (i + 0.5) * g.step,
    );
    const lons = Array.from(
      { length: g.w },
      (_, j) => g.lon0 + (j + 0.5) * g.step,
    );
    return {
      url:
        typeof document === "undefined"
          ? null
          : rasterize(
              lats,
              lons,
              (i, j) => Math.min(100, (Math.sqrt(per(i, j) / max) || 0) * 110),
              stops,
            ),
      max: Math.round(max * 10) / 10,
    };
  }, [t, sig, stopKey]); // eslint-disable-line react-hooks/exhaustive-deps -- stopKey is the colors
  if (sum === "error")
    return (
      <p className={s.muted}>
        The tornado record isn&apos;t loading right now.
      </p>
    );
  return (
    <div className="grid gap-3">
      {active && near && near !== "error" && (
        <section className={s.card}>
          <p className={s.eyebrow}>
            Within {near.miles} miles of {active.label} since 1950
          </p>
          <div className={s.keys}>
            <div>
              <b>{near.count}</b>
              <span>tornadoes</span>
            </div>
            <div>
              <b>{near.sig}</b>
              <span>EF2 or stronger</span>
            </div>
            <div>
              <b>{near.violent}</b>
              <span>EF4–EF5</span>
            </div>
            <div>
              <b>{near.dead}</b>
              <span>deaths</span>
            </div>
          </div>
          <p className={s.read}>
            A tornado touches down within {near.miles} miles{" "}
            {every(near.count, near.years)}; a significant (EF2+) one{" "}
            {every(near.sig, near.years)}.
            {near.recent
              ? ` The most recent was an ${efName(near.recent.ef)} on ${day(near.recent.date)}.`
              : ""}
          </p>
          <Bars values={near.months} labels={MONTHS} color={c("sig")} h={70} />
          {near.strongest.length > 0 && (
            <ol className={s.list}>
              {near.strongest.map((x) => (
                <li key={`${x.date}${x.s.join()}`}>
                  <b style={{ color: efc(x.ef) }}>{efName(x.ef)}</b>
                  <span>
                    {day(x.date)}, {x.st}
                    {x.dead ? ` · ${x.dead} killed` : ""}
                    {x.hurt ? ` · ${x.hurt} hurt` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {!active && (
        <p className={s.muted}>
          Set your location on the Homepage for your own tornado history.
        </p>
      )}
      {t && (
        <div className={s.keys}>
          <div>
            <b>{avgYear.toLocaleString("en-US")}</b>
            <span>tornadoes in an average year</span>
          </div>
          <div>
            <b>{ytd.toLocaleString("en-US")}</b>
            <span>by the end of {MONTH_NAMES[thisMonth]}, on average</span>
          </div>
          <div>
            <b>{busiest[0]}</b>
            <span>busiest year ({busiest[1].toLocaleString("en-US")})</span>
          </div>
          <div>
            <b>{totalDead.toLocaleString("en-US")}</b>
            <span>
              deaths, {t.first}–{t.last}
            </span>
          </div>
        </div>
      )}
      <div className={s.pills} role="group" aria-label="Section">
        {(
          [
            ["when", "When"],
            ["where", "Where"],
            ["record", "The record"],
            ["anatomy", "Anatomy"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === part}
            onClick={() => setPart(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {t && part === "when" && (
        <>
          <section className={s.card}>
            <h3>The season, region by region</h3>
            <p className={s.muted}>
              Tornadoes per month in an average year. The regions are ordered by
              the month each one peaks, so reading down is watching the season
              travel north and east.
            </p>
            {seasonRows.map((r) => (
              <div key={r.name} className={s.ridge}>
                <span>
                  <b>{r.name}</b>
                  <small>
                    peak {MONTH_NAMES[r.peak]} · {r.max.toFixed(1)}/mo
                  </small>
                </span>
                <Bars
                  values={r.vals}
                  color={r.name === "United States" ? c("c4") : c("c2")}
                  h={34}
                />
              </div>
            ))}
            <div className={s.ridge}>
              <span />
              <Bars
                values={new Array(12).fill(0)}
                labels={MONTHS}
                color={c("c2")}
                h={0}
              />
            </div>
          </section>
          <section className={s.card}>
            <h3>Where an average year stands today</h3>
            <p className={s.read}>
              By the end of {MONTH_NAMES[thisMonth]}, an average year has
              produced {ytd.toLocaleString("en-US")} of its roughly{" "}
              {avgYear.toLocaleString("en-US")} tornadoes:{" "}
              {Math.round((ytd / avgYear) * 100)}% of the year&apos;s total.
            </p>
            <div className={s.progress}>
              <i
                style={{
                  background: c("sig"),
                  transform: `scaleX(${ytd / avgYear})`,
                }}
              />
            </div>
          </section>
          <section className={s.card}>
            <h3>By month and hour</h3>
            <Bars
              values={t.months}
              over={t.monthsSig}
              labels={MONTHS}
              color={c("c2")}
              overColor={c("sig")}
              h={80}
            />
            <Bars
              values={t.hours}
              labels={t.hours.map((_, i) =>
                i % 6 === 0 ? `${i % 12 || 12}${i < 12 ? "a" : "p"}` : "",
              )}
              color={c("c3")}
              h={70}
            />
            <p className={s.muted}>
              Faded: all tornadoes. Bright: EF2+. Hours are Central Standard
              Time; late afternoon and evening dominate.
            </p>
          </section>
        </>
      )}
      {part === "where" && (
        <>
          <div className={s.pills} role="group" aria-label="Map">
            {(
              [
                ["all", "All tornadoes"],
                ["sig", "EF2 and stronger"],
                ["tracks", "Tracks"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === layer}
                onClick={() => setLayer(v)}
              >
                {l}
              </button>
            ))}
          </div>
          {layer === "tracks" && (
            <div className={s.pills} role="group" aria-label="Track filter">
              {[2, 3, 4, 5].map((ef) => (
                <button
                  key={ef}
                  type="button"
                  aria-pressed={ef === minEf}
                  onClick={() => setMinEf(ef)}
                >
                  EF{ef}
                  {ef < 5 ? "+" : ""}
                </button>
              ))}
              <select
                value={since}
                onChange={(e) => setSince(+e.target.value)}
                aria-label="Since"
              >
                {[1950, 1980, 2000, 2010, 2020].map((y) => (
                  <option key={y} value={y}>
                    since {y}
                  </option>
                ))}
              </select>
            </div>
          )}
          <UsMap
            title={
              layer === "tracks"
                ? `EF${minEf}${minEf < 5 ? "+" : ""} tornado tracks · ${since}–${t?.last ?? ""}`
                : `Where tornadoes touch down · ${t ? `${t.first}–${t.last}` : ""}`
            }
            legend={
              layer === "tracks"
                ? [2, 3, 4, 5]
                    .filter((ef) => ef >= minEf)
                    .map((ef) => ({ label: efName(ef), color: efc(ef) }))
                : CLIMO_RAMP.map((r, i) => ({
                    label:
                      i === 0
                        ? "Fewer"
                        : i === 4
                          ? `Most (${img?.max ?? "–"} per 1,000 sq mi per decade)`
                          : "",
                    color: c(r.key),
                  })).filter((x) => x.label)
            }
            status={
              layer === "tracks"
                ? !tracks
                  ? "loading"
                  : "ready"
                : !t
                  ? "loading"
                  : "ready"
            }
            file={`sswx-tornado-${layer === "tracks" ? `tracks-ef${minEf}-${since}` : `climatology${sig ? "-ef2" : ""}`}`}
          >
            {layer !== "tracks" && img?.url && (
              <image
                href={img.url}
                x={0}
                y={0}
                width={975}
                height={610}
                preserveAspectRatio="none"
              />
            )}
            {layer === "tracks" &&
              tracks &&
              tracks !== "error" &&
              tracks.map(([x1, y1, x2, y2, ef], i) =>
                x1 === x2 && y1 === y2 ? (
                  <circle key={i} cx={x1} cy={y1} r={1} fill={efc(ef)} />
                ) : (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={efc(ef)}
                    strokeWidth={ef >= 4 ? 1.6 : 1}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                ),
              )}
          </UsMap>
          <p className={s.muted}>
            {layer === "tracks"
              ? "Every path in the database at this rating, start to end. Violent tornadoes draw last so they are not buried."
              : layer === "sig"
                ? "Strong and violent tornadoes only: where the ones that level buildings concentrate."
                : "Touchdowns per 1,000 square miles per decade, smoothed into a continuous field. Tornado Alley and Dixie Alley separate cleanly."}
          </p>
          {t && (
            <section className={s.card}>
              <h3>By state</h3>
              <ol className={s.list}>
                {Object.entries(t.states)
                  .sort((a, b) => b[1][0] - a[1][0])
                  .slice(0, 20)
                  .map(([st, v]) => (
                    <li key={st}>
                      <b>{st}</b>
                      <span>
                        {v[0].toLocaleString("en-US")} ·{" "}
                        {v[1].toLocaleString("en-US")} EF2+ · {v[2]} deaths
                      </span>
                    </li>
                  ))}
              </ol>
            </section>
          )}
        </>
      )}
      {t && part === "record" && (
        <>
          <section className={s.card}>
            <h3>{t.last - t.first + 1} years, twice</h3>
            <Bars
              values={t.byYear.map((y) => y[0])}
              over={t.byYear.map((y) => y[1])}
              labels={t.byYear.map((_, i) => String(t.first + i))}
              every={15}
              color={c("c2")}
              overColor={c("sig")}
            />
            <p className={s.muted}>Tornadoes reported (bright: EF2+)</p>
            <Bars
              values={t.deaths ?? []}
              labels={t.byYear.map((_, i) => String(t.first + i))}
              every={15}
              color={c("c5")}
              h={70}
            />
            <p className={s.muted}>Deaths</p>
            <p className={s.read}>
              Reports climb and deaths fall, and not because tornadoes got
              gentler. Doppler radar, spotter networks and a national warning
              system arrived over the same decades, and that is also when weak
              tornadoes started being found at all. The EF2+ count, which was
              always recorded because it always left evidence, is close to flat.
            </p>
          </section>
          <section className={s.card}>
            <h3>Deadliest single tornadoes</h3>
            <ol className={s.list}>
              {t.deadliest.map(([date, st, dead, mag]) => (
                <li key={date + st}>
                  <b style={{ color: efc(mag) }}>
                    {+date.slice(0, 4) < 2007 ? "F" : "EF"}
                    {mag < 0 ? "?" : mag}
                  </b>
                  <span>
                    {day(date.replace(/-/g, ""))}, {st} · {dead} deaths
                  </span>
                </li>
              ))}
            </ol>
            <p className={s.muted}>
              Ratings use the scale in force at the time: Fujita before February
              2007, Enhanced Fujita after.
            </p>
          </section>
          <section className={s.card}>
            <h3>The days everybody remembers</h3>
            <ol className={s.list}>
              {NOTABLE.map((o) => (
                <li key={o.date}>
                  <b>{o.name}</b>
                  <span>
                    {o.date} · {o.tornadoes} tornadoes · {o.deaths} deaths.{" "}
                    {o.note}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      {t && part === "anatomy" && (
        <>
          <section className={s.card}>
            <h3>How big is a tornado, actually</h3>
            <Bars
              values={t.lenBins}
              labels={[
                "<1",
                "1–2",
                "2–5",
                "5–10",
                "10–25",
                "25–50",
                "50–100",
                "100+",
              ]}
              color={c("c4")}
              h={80}
            />
            <p className={s.muted}>Path length, miles</p>
            <Bars
              values={t.widBins}
              labels={[
                "<50",
                "50–100",
                "100–200",
                "200–400",
                "400–800",
                "800–1.6k",
                "1.6k+",
              ]}
              color={c("c3")}
              h={80}
            />
            <p className={s.muted}>Path width, yards</p>
            <p className={s.read}>
              Almost all of them are small, and almost all of the damage is done
              by the ones that are not.
            </p>
          </section>
          <section className={s.card}>
            <h3>The Enhanced Fujita scale</h3>
            <div className={s.ef}>
              {t.ef.map((n, i) => (
                <div key={i}>
                  <i
                    style={{
                      background: efc(i - 1),
                      transform: `scaleY(${Math.max(0.03, Math.sqrt(n / Math.max(...t.ef)))})`,
                    }}
                  />
                  <b>{n.toLocaleString("en-US")}</b>
                  <span>{efName(i - 1)}</span>
                </div>
              ))}
            </div>
            <ol className={s.list}>
              {EF_SCALE.map((e, i) => (
                <li key={e.winds}>
                  <b style={{ color: efc(i) }}>EF{i}</b>
                  <span>
                    {e.winds} · {e.desc} ·{" "}
                    {(
                      (t.ef[i + 1] / t.ef.reduce((a, b) => a + b, 0)) *
                      100
                    ).toFixed(1)}
                    % of all
                  </span>
                </li>
              ))}
            </ol>
            <p className={s.muted}>
              A damage scale, not a wind scale: the rating comes after the fact
              from what was destroyed. In force since February 2007.
            </p>
          </section>
          <section className={s.card}>
            <h3>Go deeper</h3>
            <ol className={s.list}>
              {DEEPER.map((d) => (
                <li key={d.url}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    <b>{d.label}</b>
                  </a>
                  <span>{d.desc}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

const EF_SCALE = [
  { winds: "65–85 mph", desc: "shingles, gutters, branches" },
  { winds: "86–110 mph", desc: "roofs stripped, mobile homes overturned" },
  { winds: "111–135 mph", desc: "roofs off houses, big trees snapped" },
  { winds: "136–165 mph", desc: "storeys destroyed, trains overturned" },
  { winds: "166–200 mph", desc: "well-built houses leveled" },
  { winds: "over 200 mph", desc: "houses swept from foundations" },
];
const NOTABLE = [
  {
    date: "Apr 25–28, 2011",
    name: "2011 Super Outbreak",
    tornadoes: 360,
    deaths: 324,
    note: "The largest outbreak in U.S. history; Tuscaloosa and Hackleburg the same afternoon.",
  },
  {
    date: "Apr 3–4, 1974",
    name: "1974 Super Outbreak",
    tornadoes: 148,
    deaths: 335,
    note: "Seven F5s in eighteen hours.",
  },
  {
    date: "May 22, 2011",
    name: "Joplin, Missouri",
    tornadoes: 1,
    deaths: 158,
    note: "The deadliest single U.S. tornado since 1947.",
  },
  {
    date: "May 3, 1999",
    name: "Bridge Creek–Moore",
    tornadoes: 74,
    deaths: 50,
    note: "About 300 mph measured by mobile Doppler, the highest wind ever recorded on Earth.",
  },
  {
    date: "Dec 10–11, 2021",
    name: "Quad-State Outbreak",
    tornadoes: 71,
    deaths: 89,
    note: "In December; the Mayfield track ran 165 miles.",
  },
];
const DEEPER = [
  {
    label: "SPC Data Viewer",
    url: "https://www.spc.noaa.gov/climo/dataviewer/",
    desc: "Every U.S. tornado, hail and wind report since 1950.",
  },
  {
    label: "SPC Outbreaks",
    url: "https://www.spc.noaa.gov/exper/outbreaks/",
    desc: "Every tornado day ranked by severity.",
  },
  {
    label: "SPC Environment Browser",
    url: "https://www.spc.noaa.gov/exper/envbrowser/",
    desc: "CAPE, shear and STP for historical tornadoes.",
  },
  {
    label: "SPC climatology maps",
    url: "https://www.spc.noaa.gov/wcm/",
    desc: "SPC's own state averages and annual trend graphics.",
  },
];

type LGrid = Grid & { first: number; last: number; x10: number[] };
const LIGHT_YEARS = { first: 1995, last: 2014 };

/** Annual flashes/km² at a point from the LIS/OTD grid (null off the Lower 48). */
function flashesAt(g: LGrid, lat: number, lon: number) {
  const i = Math.floor((lat - g.lat0) / g.step);
  const j = Math.floor((lon - g.lon0) / g.step);
  if (i < 0 || j < 0 || i >= g.h || j >= g.w) return null;
  return g.x10[i * g.w + j] / 10;
}

function Lightning({ c }: { c: (k: string) => string }) {
  const { active } = usePlaces();
  // TRMM's LIS (monthly detail) only saw up to 38°; the annual figure covers everywhere.
  const south = active ? Math.abs(active.lat) <= 37.5 : false;
  const d = useJson<{ annual: number; monthly: (number | null)[] }>(
    active && south
      ? `/api/climo/lightning?lat=${active.lat.toFixed(2)}&lon=${active.lon.toFixed(2)}`
      : null,
  );
  const gj = useJson<LGrid>("/api/climo/lightning?grid");
  const g = gj && gj !== "error" ? gj : null;
  const annual = g && active ? flashesAt(g, active.lat, active.lon) : null;
  const stops = CLIMO_LIGHT.map((r, i) => ({ at: i * 25, color: c(r.key) }));
  const stopKey = stops.map((x) => x.color).join();
  const max = g ? Math.max(...g.x10) / 10 : 0;
  const url = useMemo(
    () =>
      g &&
      rasterize(
        Array.from({ length: g.h }, (_, i) => g.lat0 + (i + 0.5) * g.step),
        Array.from({ length: g.w }, (_, j) => g.lon0 + (j + 0.5) * g.step),
        (i, j) => Math.min(100, Math.sqrt(g.x10[i * g.w + j] / 10 / max) * 100),
        stops,
      ),
    [g, stopKey], // eslint-disable-line react-hooks/exhaustive-deps -- stopKey is the colors
  );
  const a = d && d !== "error" ? d : null;
  const word =
    annual == null
      ? ""
      : annual < 1
        ? "Rare"
        : annual < 5
          ? "Occasional"
          : annual < 15
            ? "Frequent"
            : annual < 30
              ? "Very frequent"
              : "Among the most in the country";
  return (
    <div className="grid gap-3">
      {active && (
        <section className={s.card}>
          <p className={s.eyebrow}>Lightning at {active.label}</p>
          {!g ? (
            <p className={s.muted}>
              {gj === "error"
                ? "The lightning record isn't loading right now."
                : "Reading NASA's climatology…"}
            </p>
          ) : annual == null ? (
            <p className={s.read}>
              The lightning record here covers the Lower 48. Use the live
              Lightning Monitoring page for lightning near you.
            </p>
          ) : (
            <>
              <p className={s.big}>
                {annual} <small>flashes per km² per year · {word}</small>
              </p>
              {a ? (
                <>
                  <Bars
                    values={a.monthly.map(
                      (v, i) => (v ?? 0) * new Date(2013, i + 1, 0).getDate(),
                    )}
                    labels={MONTHS}
                    color={c("l4")}
                    h={80}
                  />
                  <p className={s.muted}>
                    Flashes per km² in each month (TRMM LIS, 1998–2013). Peak:{" "}
                    {
                      MONTH_NAMES[
                        a.monthly.reduce<number>(
                          (b, v, i, arr) => ((v ?? 0) > (arr[b] ?? 0) ? i : b),
                          0,
                        )
                      ]
                    }
                    .
                  </p>
                </>
              ) : (
                <p className={s.muted}>
                  Cloud and ground lightning together, {LIGHT_YEARS.first}–
                  {LIGHT_YEARS.last}.{" "}
                  {annual >= 1
                    ? `About ${Math.round(annual * 2.59)} flashes per square mile each year.`
                    : ""}
                </p>
              )}
            </>
          )}
        </section>
      )}
      <UsMap
        title={`Where lightning strikes · ${LIGHT_YEARS.first}–${LIGHT_YEARS.last}`}
        legend={CLIMO_LIGHT.map((r, i) => ({
          label:
            i === 0
              ? "Rare"
              : i === 4
                ? `Most (${max || "–"} flashes per km² per year)`
                : "",
          color: c(r.key),
        })).filter((x) => x.label)}
        status={!gj ? "loading" : gj === "error" ? "error" : "ready"}
        file="sswx-lightning-climatology"
      >
        {url && (
          <image
            href={url}
            x={0}
            y={0}
            width={975}
            height={610}
            preserveAspectRatio="none"
          />
        )}
      </UsMap>
      <p className={s.muted}>
        NASA&apos;s combined LIS/OTD lightning climatology ({LIGHT_YEARS.first}–
        {LIGHT_YEARS.last}): every flash, cloud and ground, per km² per year,
        from two satellites that together saw the whole country.
      </p>
    </div>
  );
}

function Hurricanes({
  c,
  colors,
}: {
  c: (k: string) => string;
  colors: Colors;
}) {
  const { active } = usePlaces();
  const sum = useJson<HSummary>("/api/climo/hurricane");
  const near = useJson<HNear>(
    active
      ? `/api/climo/hurricane?lat=${active.lat.toFixed(2)}&lon=${active.lon.toFixed(2)}`
      : null,
  );
  const [mode, setMode] = useState<"hu" | "ts" | "major">("hu");
  const ts = mode === "ts";
  const h = sum && sum !== "error" ? sum : null;
  const cat = (kt: number) => {
    const tier = tierOf(kt);
    return { tier, color: pick(colors, `trop:${tier.key}`, tier.color) };
  };
  const tierKey = INTENSITY.map((t) => cat(t.min).color).join();
  const map = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const rampKey = CLIMO_RAMP.map((r) => c(r.key)).join();
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !h) return;
    const g = h.grid;
    const vals = ts ? g.ts : g.hu;
    const max = Math.max(1, ...vals);
    const W = g.w * 6;
    const H = 360;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    const merc = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const top = merc(g.lat0 + g.h * g.step);
    const bot = merc(g.lat0);
    const ramp = CLIMO_RAMP.map((r) => {
      const n = parseInt(c(r.key).slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    });
    const at = (i: number, j: number) =>
      vals[
        Math.max(0, Math.min(g.h - 1, i)) * g.w +
          Math.max(0, Math.min(g.w - 1, j))
      ];
    for (let py = 0; py < H; py++) {
      const lat =
        (Math.atan(Math.sinh(top + ((py + 0.5) / H) * (bot - top))) * 180) /
        Math.PI;
      const fy = (lat - g.lat0) / g.step - 0.5;
      const i0 = Math.floor(fy);
      const ty = fy - i0;
      for (let px = 0; px < W; px++) {
        const fx = ((px + 0.5) / W) * g.w - 0.5;
        const j0 = Math.floor(fx);
        const tx = fx - j0;
        const v =
          at(i0, j0) * (1 - ty) * (1 - tx) +
          at(i0, j0 + 1) * (1 - ty) * tx +
          at(i0 + 1, j0) * ty * (1 - tx) +
          at(i0 + 1, j0 + 1) * ty * tx;
        if (v < 0.5) continue;
        const f = Math.sqrt(v / max) * (ramp.length - 1);
        const k = Math.min(ramp.length - 2, Math.floor(f));
        const u = f - k;
        const o = (py * W + px) * 4;
        for (let ch = 0; ch < 3; ch++)
          img.data[o + ch] = Math.round(
            ramp[k][ch] + (ramp[k + 1][ch] - ramp[k][ch]) * u,
          );
        img.data[o + 3] = Math.round(
          Math.min(210, 60 + Math.sqrt(v / max) * 160),
        );
      }
    }
    ctx.putImageData(img, 0, 0);
    const url = cv.toDataURL("image/png");
    const coords: [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ] = [
      [g.lon0, g.lat0 + g.h * g.step],
      [g.lon0 + g.w * g.step, g.lat0 + g.h * g.step],
      [g.lon0 + g.w * g.step, g.lat0],
      [g.lon0, g.lat0],
    ];
    const src = m.getSource("hu") as ImageSource | undefined;
    if (src) src.updateImage({ url, coordinates: coords });
    else {
      m.addSource("hu", { type: "image", url, coordinates: coords });
      m.addLayer({
        id: "hu",
        type: "raster",
        source: "hu",
        paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 },
      });
    }
  }, [ready, h, ts, rampKey]); // eslint-disable-line react-hooks/exhaustive-deps -- rampKey is the colors
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const major = mode === "major";
    if (m.getLayer("hu"))
      m.setLayoutProperty("hu", "visibility", major ? "none" : "visible");
    if (!major) {
      if (m.getLayer("tracks"))
        m.setLayoutProperty("tracks", "visibility", "none");
      return;
    }
    const color = [
      "match",
      ["get", "tier"],
      ...INTENSITY.flatMap((t) => [t.key, cat(t.min).color]),
      "#888",
    ] as unknown as string;
    if (m.getLayer("tracks")) {
      m.setLayoutProperty("tracks", "visibility", "visible");
      m.setPaintProperty("tracks", "line-color", color);
      return;
    }
    m.addSource("tracks", {
      type: "geojson",
      data: "/api/climo/hurricane?tracks=major",
    });
    m.addLayer({
      id: "tracks",
      type: "line",
      source: "tracks",
      layout: {
        "line-cap": "round",
        "line-join": "round",
        "line-sort-key": ["get", "t"],
      },
      paint: {
        "line-color": color,
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 6, 2],
        "line-opacity": 0.6,
      },
    });
  }, [ready, mode, tierKey]); // eslint-disable-line react-hooks/exhaustive-deps -- tierKey is the colors
  const onReady = ({ map: any }: ReadyMap) => {
    map.current = any as unknown as MaplibreMap;
    setReady(true);
  };
  if (sum === "error")
    return (
      <p className={s.muted}>
        The hurricane record isn&apos;t loading right now.
      </p>
    );
  const years = h ? h.last - h.first + 1 : 1;
  const atlAce = h?.ace.AL ?? [];
  const norm = atlAce.filter((x) => x[0] >= 1991 && x[0] <= 2020);
  const normAce = norm.length
    ? Math.round(norm.reduce((a, x) => a + x[1], 0) / norm.length)
    : 0;
  const curve = (b: "AL" | "EP") =>
    h ? h.season[b].map((n) => n / years) : [];
  const peak = h ? h.season.AL.indexOf(Math.max(...h.season.AL)) : 0;
  const peakDate = new Date(Date.UTC(2025, 0, 1 + peak)).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", timeZone: "UTC" },
  );
  return (
    <div className="grid gap-3">
      {active && near && near !== "error" && (
        <section className={s.card}>
          <p className={s.eyebrow}>
            Within {near.miles} miles of {active.label} since 1950
          </p>
          <div className={s.keys}>
            <div>
              <b>{near.count}</b>
              <span>tropical storms+</span>
            </div>
            <div>
              <b>{near.hurricanes}</b>
              <span>hurricanes</span>
            </div>
            <div>
              <b>{near.majors}</b>
              <span>major (Cat 3+)</span>
            </div>
          </div>
          <p className={s.read}>
            {near.count
              ? `A hurricane passes within ${near.miles} miles ${every(near.hurricanes, near.years)}.${near.recent ? ` The latest storm was ${near.recent.name} (${near.recent.year}).` : ""}`
              : `No tropical storm has passed within ${near.miles} miles since 1950.`}
          </p>
          {near.count > 0 && (
            <Bars
              values={near.months}
              labels={MONTHS}
              color={c("atl")}
              h={60}
            />
          )}
          {near.strongest.length > 0 && (
            <ol className={s.list}>
              {near.strongest.map((p) => {
                const k = cat(p.kt);
                return (
                  <li key={`${p.name}${p.year}`}>
                    <b style={{ color: k.color }}>{k.tier.short}</b>
                    <span>
                      {p.name} ({p.year}) · {mph(p.kt)} mph nearby
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
      <div className={s.pills} role="group" aria-label="Strength">
        {(
          [
            ["hu", "Hurricanes"],
            ["ts", "Tropical storms and stronger"],
            ["major", "Major hurricane tracks"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === mode}
            onClick={() => setMode(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <WeatherMap
        center={[-85, 25]}
        zoom={2.4}
        label="Hurricane track density map"
        className="h-[50dvh] min-h-72"
        onReady={onReady}
      />
      {mode === "major" ? (
        <div className={s.legend}>
          {INTENSITY.slice(1).map((t) => (
            <span key={t.key}>
              <i style={{ background: cat(t.min).color }} />
              {t.short}
            </span>
          ))}
          <span>
            Every Cat 3+ hurricane since 1950, colored by its strength along the
            way
          </span>
        </div>
      ) : (
        <div className={s.legend}>
          {CLIMO_RAMP.map((r, i) => (
            <span key={r.key}>
              <i style={{ background: c(r.key) }} />
              {i === 0 ? "Few passages" : i === 4 ? "Most" : ""}
            </span>
          ))}
          <span>
            {h
              ? `${h.first}–${h.last}, every storm counted once per 1° square`
              : ""}
          </span>
        </div>
      )}
      {h && (
        <>
          <section className={s.card}>
            <h3>The season</h3>
            <svg
              viewBox="0 0 360 110"
              className="w-full"
              role="img"
              aria-label="Storms active by day of year"
            >
              {(["AL", "EP"] as const).map((b) => {
                const v = curve(b);
                const max = Math.max(...curve("AL"), ...curve("EP"));
                const pts = v
                  .map(
                    (n, i) =>
                      `${((i / 365) * 360).toFixed(1)},${(100 - (n / max) * 92).toFixed(1)}`,
                  )
                  .join(" ");
                return (
                  <polyline
                    key={b}
                    points={pts}
                    fill="none"
                    stroke={c(b === "AL" ? "atl" : "epac")}
                    strokeWidth={2}
                  />
                );
              })}
              {MONTHS.map((m, i) => (
                <text
                  key={i}
                  x={(i / 12) * 360 + 15}
                  y={109}
                  fontSize={8}
                  textAnchor="middle"
                  fill="var(--muted)"
                >
                  {m}
                </text>
              ))}
            </svg>
            <div className={s.legend}>
              <span>
                <i style={{ background: c("atl") }} />
                Atlantic
              </span>
              <span>
                <i style={{ background: c("epac") }} />
                Eastern Pacific
              </span>
            </div>
            <p className={s.muted}>
              Storms active on each day of the year, averaged since 1950. The
              Atlantic peaks around {peakDate}.
            </p>
          </section>
          <section className={s.card}>
            <h3>Atlantic seasons by ACE</h3>
            <Bars
              values={atlAce.map((x) => x[1])}
              labels={atlAce.map((x) => String(x[0]))}
              every={15}
              color={c("atl")}
            />
            <p className={s.muted}>
              Accumulated Cyclone Energy adds up every storm&apos;s strength and
              lifespan. 1991–2020 average: {normAce}.
            </p>
            <ol className={s.list}>
              {[...atlAce]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map((x) => (
                  <li key={x[0]}>
                    <b>{x[0]}</b>
                    <span>
                      ACE {Math.round(x[1])} · {x[2]} named · {x[3]} hurricanes
                      · {x[4]} major
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        </>
      )}
      <div className={s.legend}>
        {INTENSITY.slice(1).map((t) => (
          <span key={t.key}>
            <i style={{ background: pick(colors, `trop:${t.key}`, t.color) }} />
            {t.short}
          </span>
        ))}
      </div>
    </div>
  );
}
