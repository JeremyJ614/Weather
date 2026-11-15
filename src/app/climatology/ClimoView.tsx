"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CloudLightning, Tornado, Wind } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { usePlaces } from "@/features/location/usePlaces";
import { rasterize } from "@/features/sky/raster";
import { pick, type Colors } from "@/lib/colors/pick";
import { EF_COLORS } from "@/lib/colors/ef";
import { CLIMO_LIGHT, CLIMO_LINES, CLIMO_RAMP } from "@/lib/climo/style";
import s from "./Climo.module.css";
import {
  type TSummary,
  type TNear,
  MONTHS,
  MONTH_NAMES,
  efName,
  day,
  every,
  useJson,
  Bars,
} from "./climo";

// The Lightning and Hurricanes tabs load when first opened.
const tabLoading = () => <p className={s.foot}>Loading…</p>;
const Lightning = dynamic(
  () => import("./Lightning").then((m) => m.Lightning),
  { ssr: false, loading: tabLoading },
);
const Hurricanes = dynamic(
  () => import("./Hurricanes").then((m) => m.Hurricanes),
  { ssr: false, loading: tabLoading },
);

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
              titles={t.hours.map(
                (_, i) => `${i % 12 || 12} ${i < 12 ? "am" : "pm"}`,
              )}
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
