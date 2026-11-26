import Link from "next/link";
import type { Colors } from "@/lib/colors/pick";
import { pick } from "@/lib/colors/pick";
import { EF_COLORS } from "@/lib/colors/ef";
import { STATES } from "@/lib/geo/search";
import type { CountyData } from "@/lib/tornado/db";
import {
  MONTHS,
  clock,
  day,
  decades,
  efKey,
  frame,
  line,
  miles,
  rate,
  ringsPath,
  season,
  strongest,
  summary,
  topYears,
  type T,
} from "@/lib/tornado/view";
import { ShareCounty } from "./ShareCounty";
import { Search } from "./Search";
import s from "./Tornado.module.css";

const ORDER = [-1, 0, 1, 2, 3, 4, 5];
const label = (m: number, ef = true) =>
  m < 0 ? "Unrated" : `${ef ? "EF" : "F"}${m}`;

/** A whole county page (server rendered): maps, badge, story, charts and every tornado. */
export function CountyPage({
  d,
  colors,
}: {
  d: CountyData;
  colors: Colors | undefined;
}) {
  const c = (m: number) => pick(colors, `ef:${efKey(m)}`, EF_COLORS[efKey(m)]);
  const { county, tors } = d;
  const short = county.name.replace(
    / (County|Parish|Borough|Census Area|Municipality)$/,
    "",
  );
  const stateName = STATES[county.st] ?? county.st;
  const top = strongest(tors);
  const last = tors[0] ?? null;
  const ss = season(tors);
  const years = topYears(tors);
  const decs = decades(tors);
  const counts = ORDER.map((m) => ({
    m,
    n: tors.filter((t) => t.mag === m).length,
  })).filter((x) => x.n);
  const share = {
    name: county.name,
    st: county.st,
    stateName,
    n: tors.length,
    top: top ? { r: rate(top), m: top.mag, day: day(top.when) } : null,
    last: last ? { r: rate(last), m: last.mag, day: day(last.when) } : null,
    outline: d.outline,
    box: d.box,
    tracks: tors.map(
      (t) =>
        [t.a[1], t.a[0], t.b[1], t.b[0], t.mag] as [
          number,
          number,
          number,
          number,
          number,
        ],
    ),
    colors: Object.fromEntries(ORDER.map((m) => [m, c(m)])),
    through: d.through,
  };
  return (
    <div className={s.page}>
      <CountyMap d={d} c={c} />
      <section
        className={s.badge}
        aria-label={`${county.name}, ${stateName} at a glance`}
      >
        <div className={s.bTop}>
          <h1>{county.name}</h1>
          <span>{stateName}</span>
          <em>
            Since <b>1950</b>
          </em>
        </div>
        <div className={s.bStats}>
          <div>
            <b>{tors.length.toLocaleString("en-US")}</b>
            <small>Tornadoes on record</small>
          </div>
          <div style={{ ["--c" as string]: top ? c(top.mag) : undefined }}>
            <b className={s.tint}>{top ? rate(top) : "None"}</b>
            <small>{top ? `Strongest, ${day(top.when)}` : "Strongest"}</small>
          </div>
          <div>
            <b>{last ? last.when.slice(0, 4) : "Never"}</b>
            <small>
              {last ? `Most recent, ${day(last.when)}` : "Most recent"}
            </small>
          </div>
        </div>
      </section>
      <div className={s.actions}>
        <Link href="/tornado-database" className={s.back}>
          ← Search another town or county
        </Link>
        <ShareCounty data={share} />
      </div>
      <p className={s.story}>
        {summary(tors, county.name, stateName, d.through)}
      </p>
      {top && <Strongest t={top} d={d} c={c} />}
      {tors.length > 0 && (
        <>
          <section className={s.card}>
            <p className={s.eye}>Peak season</p>
            <h2>When tornadoes hit {short}</h2>
            <p className={s.lead}>
              {MONTHS_LONG[ss.peak]} is the peak month ({ss.months[ss.peak].n}{" "}
              of {tors.length}, {pct(ss.months[ss.peak].n, tors.length)}).{" "}
              {MONTHS_LONG[ss.runAt]} through {MONTHS_LONG[(ss.runAt + 2) % 12]}{" "}
              bring {pct(ss.run, tors.length)} of them.
              {ss.timed
                ? ` ${pct(ss.night, ss.timed)} touched down overnight, between 10 PM and 6 AM.`
                : ""}
            </p>
            <div className={s.tiles}>
              <div>
                <small>Peak month</small>
                <b>{MONTHS_LONG[ss.peak]}</b>
                <span>
                  {ss.months[ss.peak].n} of {tors.length}
                </span>
              </div>
              <div>
                <small>Busiest 3 months</small>
                <b>
                  {MONTHS[ss.runAt]}–{MONTHS[(ss.runAt + 2) % 12]}
                </b>
                <span>{pct(ss.run, tors.length)} of all</span>
              </div>
              <div>
                <small>Busiest hour</small>
                <b>{hourLabel(ss.busiestHour)}</b>
                <span>{ss.hours[ss.busiestHour]} touched down then</span>
              </div>
              <div>
                <small>Overnight</small>
                <b>{ss.timed ? pct(ss.night, ss.timed) : "—"}</b>
                <span>10 PM to 6 AM</span>
              </div>
            </div>
            <Months months={ss.months} c={c} peak={ss.peak} />
            <p className={s.note}>
              Each bar is colored by the strongest tornado in that month.
            </p>
            <h3 className={s.sub}>By time of day</h3>
            <Hours hours={ss.hours} />
            <p className={s.note}>
              Local time, by the hour each tornado touched down.
            </p>
          </section>
          <section className={s.card}>
            <p className={s.eye}>Record years</p>
            <h2>The busiest years</h2>
            <Years years={years} c={c} max={years[0]?.n ?? 1} />
          </section>
          <section className={s.card}>
            <p className={s.eye}>Since 1950</p>
            <h2>Every tornado in {short}</h2>
            <Decades decs={decs} c={c} />
          </section>
          {decs.map((g) => (
            <section
              key={g.decade}
              className={s.decade}
              style={{ ["--c" as string]: c(g.top) }}
            >
              <h3>
                The {g.decade}s{" "}
                <span>
                  · {g.list.length} tornado{g.list.length === 1 ? "" : "es"}
                </span>
              </h3>
              <ol>
                {g.list.map((t, i) => (
                  <li key={i}>
                    <span
                      className={s.chip}
                      style={{ ["--c" as string]: c(t.mag) }}
                    >
                      {rate(t)}
                    </span>
                    <p>
                      <b>
                        {day(t.when)}
                        {clock(t.when, t.zone)
                          ? `, ${clock(t.when, t.zone)}`
                          : ""}
                        :
                      </b>{" "}
                      {line(t, county.fips, county.name)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
      {counts.length > 0 && (
        <p className={s.legend}>
          {counts.map(({ m, n }) => (
            <span key={m} style={{ ["--c" as string]: c(m) }}>
              <i /> {label(m)} {n}
            </span>
          ))}
          <small>Ratings: F scale before February 2007, EF since.</small>
        </p>
      )}
      {d.towns.length > 0 && (
        <section className={s.card}>
          <h2>Towns in {county.name}</h2>
          <ul className={s.towns}>
            {d.towns.map((t) => (
              <li key={t.name}>{t.name}</li>
            ))}
          </ul>
        </section>
      )}
      {d.neighbours.length > 0 && (
        <section className={s.card}>
          <h2>Counties around it</h2>
          <ul className={s.near}>
            {d.neighbours.map((n) => (
              <li key={n.fips}>
                <Link href={`/tornado-database/${n.slug}`}>
                  {n.name}, {n.st}
                </Link>
                <span>{n.n ? `${n.n} since 1950` : "None since 1950"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className={s.card}>
        <h2>Look up another place</h2>
        <Search compact colors={colors} />
      </section>
      <p className={s.source}>
        Source: NOAA Storm Prediction Center tornado database, 1950 to{" "}
        {d.through}, with each tornado placed in every county its record names.
        Paths are drawn from touchdown to lift-off in a straight line; surveyed
        shapes can curve.
      </p>
    </div>
  );
}

const MONTHS_LONG = [
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
const pct = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

function CountyMap({ d, c }: { d: CountyData; c: (m: number) => string }) {
  // 640 wide, so labels and lines read on a phone and stay crisp on a computer.
  const W = 640,
    H = 460;
  const [x0, y0, x1, y1] = d.box;
  const pw = x1 - x0,
    ph = y1 - y0;
  // Frame the county with a little room around it, so paths can be seen arriving and leaving.
  const box = [x0 - pw * 0.14, y0 - ph * 0.14, x1 + pw * 0.14, y1 + ph * 0.14];
  const { at } = frame(box, W, H, 18);
  const outline = ringsPath(d.outline, at);
  const sorted = [...d.tors].sort((a, b) => a.mag - b.mag || a.miles - b.miles);
  const towns = d.towns.slice(0, 9);
  return (
    <figure className={s.map}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Map of ${d.county.name} with ${d.tors.length} tornado paths since 1950`}
      >
        <defs>
          <pattern
            id="tdb-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path d="M40 0H0V40" className={s.grid} />
          </pattern>
          <clipPath id="tdb-frame">
            <rect width={W} height={H} rx="22" />
          </clipPath>
        </defs>
        <g clipPath="url(#tdb-frame)">
          <rect width={W} height={H} className={s.sea} />
          <rect width={W} height={H} fill="url(#tdb-grid)" />
          <path d={outline} className={s.land} />
          <g className={s.paths}>
            {sorted.map((t, i) => (
              <Path
                key={i}
                t={t}
                at={at}
                c={c(t.mag)}
                i={i}
                n={sorted.length}
              />
            ))}
          </g>
          <path d={outline} className={s.edge} />
          {towns.map((t) => {
            const [x, y] = at(t.lon, t.lat);
            return (
              <g
                key={t.name}
                className={s.town}
                transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
              >
                <circle r="3" />
                <text x="7" y="4">
                  {t.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption className={s.mapKey}>
        <b>Tornado paths</b>
        <span>1950 to {d.through}</span>
        <span className={s.keyRow}>
          {ORDER.filter((m) => d.tors.some((t) => t.mag === m)).map((m) => (
            <i key={m} style={{ ["--c" as string]: c(m) }}>
              {m < 0 ? "U" : m}
            </i>
          ))}
        </span>
      </figcaption>
    </figure>
  );
}

function Path({
  t,
  at,
  c,
  i,
  n,
}: {
  t: T;
  at: (lon: number, lat: number) => [number, number];
  c: string;
  i: number;
  n: number;
}) {
  const [ax, ay] = at(t.a[1], t.a[0]);
  const [bx, by] = at(t.b[1], t.b[0]);
  const w = 1.8 + Math.max(0, t.mag) * 0.9;
  const point = Math.hypot(bx - ax, by - ay) < 3;
  const style = {
    ["--c" as string]: c,
    ["--w" as string]: w,
    ["--i" as string]: Math.min(1, i / Math.max(1, n)),
  };
  return (
    <g style={style}>
      <title>{`${rate(t)}, ${day(t.when)}, ${miles(t.miles)}`}</title>
      {point ? (
        <>
          <circle cx={ax} cy={ay} r={w * 1.6} className={s.halo} />
          <circle cx={ax} cy={ay} r={w * 0.9} className={s.dot} />
        </>
      ) : (
        <>
          <path
            d={`M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`}
            className={s.halo}
          />
          <path
            d={`M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`}
            className={s.line}
          />
          <circle cx={ax} cy={ay} r={w * 0.75} className={s.dot} />
        </>
      )}
    </g>
  );
}

function Strongest({
  t,
  d,
  c,
}: {
  t: T;
  d: CountyData;
  c: (m: number) => string;
}) {
  const W = 1000,
    H = 520;
  const lons = [t.a[1], t.b[1]],
    lats = [t.a[0], t.b[0]];
  const span = Math.max(
    Math.abs(lons[0] - lons[1]),
    Math.abs(lats[0] - lats[1]),
    0.05,
  );
  const box = [
    Math.min(...lons) - span * 0.35,
    Math.min(...lats) - span * 0.35,
    Math.max(...lons) + span * 0.35,
    Math.max(...lats) + span * 0.35,
  ];
  const { at } = frame(box, W, H, 40);
  const [ax, ay] = at(t.a[1], t.a[0]);
  const [bx, by] = at(t.b[1], t.b[0]);
  const col = c(t.mag);
  const inn = t.inc[d.county.fips];
  return (
    <section className={s.card} style={{ ["--c" as string]: col }}>
      <figure className={s.pathMap}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`The path of the ${rate(t)} tornado of ${day(t.when)}`}
        >
          <defs>
            <clipPath id="tdb-sframe">
              <rect width={W} height={H} rx="20" />
            </clipPath>
          </defs>
          <g clipPath="url(#tdb-sframe)">
            <rect width={W} height={H} className={s.sea} />
            <rect width={W} height={H} fill="url(#tdb-grid)" />
            <path d={ringsPath(d.outline, at)} className={s.landDash} />
            <path d={`M${ax} ${ay}L${bx} ${by}`} className={s.bigHalo} />
            <path d={`M${ax} ${ay}L${bx} ${by}`} className={s.bigLine} />
            <circle cx={ax} cy={ay} r="11" className={s.start} />
            <circle cx={bx} cy={by} r="6" className={s.end} />
          </g>
        </svg>
        <figcaption>
          Touchdown (ringed) to lift-off, in a straight line. Dashed: the county
          line.
        </figcaption>
      </figure>
      <p className={s.eye}>The strongest</p>
      <p className={s.huge}>{rate(t)}</p>
      <p className={s.when}>{day(t.when)}</p>
      {clock(t.when, t.zone) && (
        <p className={s.muted}>Touched down at {clock(t.when, t.zone)}</p>
      )}
      <dl className={s.facts}>
        <div>
          <dt>Path length</dt>
          <dd>
            {+t.miles.toFixed(2)} <small>mi</small>
          </dd>
        </div>
        {t.yards > 0 && (
          <div>
            <dt>Widest</dt>
            <dd>
              {t.yards.toLocaleString("en-US")} <small>yd</small>
            </dd>
          </div>
        )}
        {Object.keys(t.inc).length > 1 && inn > 0 && (
          <div>
            <dt>In {d.county.name}</dt>
            <dd>
              {+inn.toFixed(1)} <small>mi</small>
            </dd>
          </div>
        )}
        <div>
          <dt>Deaths</dt>
          <dd>{t.deaths}</dd>
        </div>
        <div>
          <dt>Injuries</dt>
          <dd>{t.hurt}</dd>
        </div>
      </dl>
    </section>
  );
}

function Months({
  months,
  c,
  peak,
}: {
  months: { n: number; top: number }[];
  c: (m: number) => string;
  peak: number;
}) {
  const max = Math.max(1, ...months.map((m) => m.n));
  return (
    <div
      className={s.months}
      role="img"
      aria-label={`Tornadoes by month: ${months.map((m, i) => `${MONTHS[i]} ${m.n}`).join(", ")}`}
    >
      {months.map((m, i) => (
        <div key={i} className={i === peak ? s.peak : undefined}>
          <b>{m.n || ""}</b>
          <i
            style={{
              ["--h" as string]: m.n / max,
              ["--c" as string]: m.n ? c(m.top) : undefined,
              ["--d" as string]: i,
            }}
          />
          <span>{MONTHS[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Hours({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <div
      className={s.hours}
      role="img"
      aria-label={`Tornadoes by hour: ${hours.map((n, h) => `${hourLabel(h)} ${n}`).join(", ")}`}
    >
      {hours.map((n, h) => (
        <div key={h} className={h >= 22 || h < 6 ? s.night : undefined}>
          <i
            style={{ ["--h" as string]: n / max, ["--d" as string]: h }}
            title={`${hourLabel(h)}: ${n}`}
          />
          {h % 6 === 0 && <span>{hourLabel(h).replace(" ", "")}</span>}
        </div>
      ))}
    </div>
  );
}

function Years({
  years,
  c,
  max,
}: {
  years: { year: number; n: number; top: number }[];
  c: (m: number) => string;
  max: number;
}) {
  return (
    <ol className={s.years}>
      {years.map((y, i) => (
        <li
          key={y.year}
          style={{
            ["--c" as string]: c(y.top),
            ["--w" as string]: y.n / max,
            ["--d" as string]: i,
          }}
        >
          <em>{i + 1}</em>
          <b>{y.year}</b>
          <span className={s.bar}>
            <i />
          </span>
          <strong>{y.n}</strong>
          <small>{label(y.top)} strongest</small>
        </li>
      ))}
    </ol>
  );
}

function Decades({
  decs,
  c,
}: {
  decs: { decade: number; list: T[]; top: number }[];
  c: (m: number) => string;
}) {
  const all = [...decs].sort((a, b) => a.decade - b.decade);
  const max = Math.max(1, ...all.map((g) => g.list.length));
  return (
    <div
      className={s.decs}
      role="img"
      aria-label={`Tornadoes by decade: ${all.map((g) => `${g.decade}s ${g.list.length}`).join(", ")}`}
    >
      {all.map((g, i) => (
        <div key={g.decade}>
          <b>{g.list.length}</b>
          <i
            style={{
              ["--h" as string]: g.list.length / max,
              ["--c" as string]: c(g.top),
              ["--d" as string]: i,
            }}
          />
          <span>{g.decade}s</span>
        </div>
      ))}
    </div>
  );
}
