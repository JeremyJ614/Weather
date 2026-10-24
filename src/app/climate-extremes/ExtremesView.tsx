"use client";

import { useMemo, useState } from "react";
import {
  Droplets,
  Gauge,
  Snowflake,
  ThermometerSnowflake,
  ThermometerSun,
  Wind,
} from "lucide-react";
import { UsMap } from "@/features/maps/UsMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { EXTREME_COLORS, type ExtremeKey } from "@/lib/extremes/colors";
import type { Metric, Station } from "@/lib/extremes/data";
import {
  RECORD_LABEL,
  type RecordType,
  type WxRecord,
} from "@/lib/extremes/records";
import s from "./Extremes.module.css";

export type PlacedStation = Station & { x: number | null; y: number | null };
export type Placed = Record<"lower48" | "all", Record<Metric, PlacedStation[]>>;

const CARDS: {
  m: Metric;
  label: string;
  unit: string;
  color: ExtremeKey;
  Icon: React.ComponentType<{ "aria-hidden"?: boolean }>;
}[] = [
  {
    m: "hot",
    label: "Hottest now",
    unit: "°F",
    color: "high",
    Icon: ThermometerSun,
  },
  {
    m: "cold",
    label: "Coldest now",
    unit: "°F",
    color: "low",
    Icon: ThermometerSnowflake,
  },
  {
    m: "gust",
    label: "Strongest gust",
    unit: " mph",
    color: "gust",
    Icon: Wind,
  },
  {
    m: "humid",
    label: "Most humid (dew point)",
    unit: "°F",
    color: "rain",
    Icon: Droplets,
  },
  {
    m: "pressure",
    label: "Lowest pressure",
    unit: " mb",
    color: "pressure",
    Icon: Gauge,
  },
];
const TYPES: RecordType[] = [
  "high",
  "warmLow",
  "low",
  "coldHigh",
  "rain",
  "snow",
];
const FILTERS: { id: string; label: string; types: RecordType[] }[] = [
  { id: "all", label: "All", types: TYPES },
  { id: "heat", label: "Heat", types: ["high", "warmLow"] },
  { id: "cold", label: "Cold", types: ["low", "coldHigh"] },
  { id: "wet", label: "Rain & snow", types: ["rain", "snow"] },
];

const dayName = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }) + " CT";

/** A record's line: where, the new value against the old one, and how old the old one was. */
export function RecordList({
  records,
  colors,
}: {
  records: WxRecord[];
  colors: Colors;
}) {
  const c = (t: RecordType) =>
    pick(
      colors,
      `extreme:${t}`,
      EXTREME_COLORS.find((x) => x.key === t)!.color,
    );
  const byDay = new Map<string, WxRecord[]>();
  for (const r of records) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  return (
    <div className="grid gap-4">
      {[...byDay].map(([day, list]) => (
        <section key={day} className="grid gap-2">
          <p className="eyebrow">{dayName(day)}</p>
          <ul className={s.records}>
            {list.map((r) => (
              <li key={`${r.type}${r.place}${r.st}`}>
                <span
                  className={s.badge}
                  style={{ color: c(r.type), borderColor: c(r.type) }}
                >
                  {RECORD_LABEL[r.type]}
                  {r.tied ? " (tied)" : ""}
                </span>
                <span className={s.where}>
                  <b>{r.place}</b>
                  {r.st ? `, ${r.st}` : ""}
                </span>
                <span className={s.value}>
                  <b style={{ color: c(r.type) }}>
                    {r.value === "T"
                      ? "Trace"
                      : `${r.value}${r.unit === "in" ? '"' : "°"}`}
                  </b>
                  {r.old != null && (
                    <small>
                      {r.tied ? "ties" : "old"}{" "}
                      {r.old === "T"
                        ? "trace"
                        : `${r.old}${r.unit === "in" ? '"' : "°"}`}
                      {r.oldYear ? ` (${r.oldYear})` : ""}
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Climate Extremes: the country's extremes now, today's high and low, and this week's records. */
export function ExtremesView({
  live,
  at,
  stations,
  records,
  colors,
}: {
  live: Placed | null;
  at: string | null;
  stations: number;
  records: WxRecord[];
  colors: Colors;
}) {
  const [scope, setScope] = useState<"lower48" | "all">("lower48");
  const [filter, setFilter] = useState("all");
  const [all, setAll] = useState(false);
  const col = (k: ExtremeKey) =>
    pick(
      colors,
      `extreme:${k}`,
      EXTREME_COLORS.find((x) => x.key === k)!.color,
    );
  const m = live?.[scope];

  const counts = useMemo(() => {
    const n = Object.fromEntries(TYPES.map((t) => [t, 0])) as Record<
      RecordType,
      number
    >;
    for (const r of records) n[r.type]++;
    return n;
  }, [records]);
  const warm = counts.high + counts.warmLow;
  const cold = counts.low + counts.coldHigh;
  const shown = records.filter((r) =>
    FILTERS.find((f) => f.id === filter)!.types.includes(r.type),
  );

  return (
    <div className="grid gap-5">
      <div className={s.scope} role="group" aria-label="Area">
        {(
          [
            ["lower48", "Lower 48"],
            ["all", "All states & territories"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={scope === id}
            onClick={() => setScope(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {!m ? (
        <p className={s.empty}>
          The national station feed isn&apos;t answering right now, so there are
          no live extremes to show. They&apos;ll be back within a few minutes.
        </p>
      ) : (
        <>
          <section className={s.today}>
            {(
              [
                ["dayHigh", "Today's high so far", "high"],
                ["dayLow", "Today's low so far", "low"],
              ] as const
            ).map(([k, label, color]) => {
              const top = m[k][0];
              return (
                <div key={k} style={{ borderColor: col(color) }}>
                  <p className="eyebrow">{label}</p>
                  {top ? (
                    <>
                      <b style={{ color: col(color) }}>
                        {Math.round(top.value)}°F
                      </b>
                      <span>
                        {top.name}, {top.st}
                      </span>
                    </>
                  ) : (
                    <span>No reading yet</span>
                  )}
                </div>
              );
            })}
          </section>

          <UsMap
            title="Where the extremes are"
            sub={null}
            legend={CARDS.map((c) => ({ label: c.label, color: col(c.color) }))}
            status="ready"
            file="sswx-climate-extremes"
            overlay={CARDS.map((c) => {
              const top = m[c.m][0];
              return top?.x != null && top.y != null ? (
                <g key={c.m}>
                  <circle
                    cx={top.x}
                    cy={top.y}
                    r={11}
                    fill={col(c.color)}
                    opacity={0.25}
                  />
                  <circle
                    cx={top.x}
                    cy={top.y}
                    r={5.5}
                    fill={col(c.color)}
                    stroke="#0b0c14"
                    strokeWidth={1.5}
                  >
                    <title>{`${c.label}: ${top.value}${c.unit} at ${top.name}, ${top.st}`}</title>
                  </circle>
                </g>
              ) : null;
            })}
          />

          <section className={s.cards}>
            {CARDS.map((c) => {
              const list = m[c.m];
              return (
                <article
                  key={c.m}
                  className={s.card}
                  style={{ borderColor: col(c.color) }}
                >
                  <header>
                    <c.Icon aria-hidden />
                    <span>{c.label}</span>
                  </header>
                  {list[0] ? (
                    <>
                      <p className={s.big} style={{ color: col(c.color) }}>
                        {c.m === "pressure"
                          ? list[0].value.toFixed(1)
                          : Math.round(list[0].value)}
                        {c.unit}
                      </p>
                      <p className={s.at}>
                        {list[0].name}, {list[0].st}
                      </p>
                      <ol className={s.rest}>
                        {list.slice(1).map((x) => (
                          <li key={x.id}>
                            <span>
                              {x.name}, {x.st}
                            </span>
                            <b>
                              {c.m === "pressure"
                                ? x.value.toFixed(1)
                                : Math.round(x.value)}
                              {c.unit}
                            </b>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p className={s.at}>No reading right now.</p>
                  )}
                </article>
              );
            })}
          </section>
          <p className={s.fine}>
            {stations.toLocaleString()} airport weather stations (ASOS), read at{" "}
            {at ? clock(at) : "—"}. A reading far off its neighbors is left out
            as a faulty sensor.
          </p>
        </>
      )}

      <section className={s.panel}>
        <p className="eyebrow">Records this week</p>
        {records.length ? (
          <>
            <div
              className={s.bar}
              role="img"
              aria-label={`${warm} warm records, ${cold} cold records`}
            >
              {TYPES.map((t) =>
                counts[t] ? (
                  <span
                    key={t}
                    style={{
                      flexGrow: counts[t],
                      background: pick(
                        colors,
                        `extreme:${t}`,
                        EXTREME_COLORS.find((x) => x.key === t)!.color,
                      ),
                    }}
                    title={`${RECORD_LABEL[t]}: ${counts[t]}`}
                  />
                ) : null,
              )}
            </div>
            <p className={s.summary}>
              <b>{records.length}</b> records in the last seven days:{" "}
              <b style={{ color: col("high") }}>{warm}</b> warm,{" "}
              <b style={{ color: col("low") }}>{cold}</b> cold,{" "}
              <b style={{ color: col("rain") }}>{counts.rain}</b> rainfall
              {counts.snow ? (
                <>
                  , <b style={{ color: col("snow") }}>{counts.snow}</b> snowfall
                </>
              ) : null}
              .
              {warm + cold > 2 &&
                (warm >= cold * 2
                  ? " Warm records are outpacing cold ones."
                  : cold >= warm * 2
                    ? " Cold records are outpacing warm ones."
                    : "")}
            </p>
            <div className={s.chips} role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.id === "cold" ? <Snowflake aria-hidden /> : null}
                  {f.label}
                </button>
              ))}
            </div>
            {shown.length ? (
              <>
                <RecordList
                  records={all ? shown : shown.slice(0, 12)}
                  colors={colors}
                />
                {!all && shown.length > 12 && (
                  <button
                    type="button"
                    className={s.more}
                    onClick={() => setAll(true)}
                  >
                    Show all {shown.length} records
                  </button>
                )}
              </>
            ) : (
              <p className={s.at}>None of these this week.</p>
            )}
          </>
        ) : (
          <p className={s.at}>
            No records reported in the last seven days, or the Weather
            Service&apos;s report feed isn&apos;t answering.
          </p>
        )}
        <p className={s.fine}>
          From each Weather Service office&apos;s Record Event Reports
          (preliminary; official records come from NCEI).
        </p>
      </section>
    </div>
  );
}
