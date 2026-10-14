"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Droplets,
  Map as MapIcon,
  MapPin,
  Sun,
} from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { GeoMap } from "@/features/hazards/GeoMap";
import { Outlook } from "@/features/outlooks/CpcPanel";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import type { Hazard, Here } from "@/lib/hazards/data";
import { HAZ_KINDS, USDM } from "@/lib/hazards/style";
import s from "./Hazards.module.css";

type Trend = {
  week: string;
  d0: number;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
}[];
const day = (d: string | null) =>
  d
    ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";
const span = (h: Pick<Hazard, "start" | "end">) =>
  h.start && h.end && h.start !== h.end
    ? `${day(h.start)} – ${day(h.end)}`
    : day(h.start);
const week = (w: string | null) =>
  w
    ? new Date(
        `${w.slice(0, 4)}-${w.slice(4, 6)}-${w.slice(6, 8)}T12:00:00Z`,
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";

/** Hazards & Droughts: your area, the CPC hazards map, the Drought Monitor and its outlook. */
export function HazardsView({
  hazards,
  national,
  trend,
  colors,
}: {
  hazards: Hazard[] | null;
  national: { week: string | null; pct: number[] } | null;
  trend: Trend;
  colors: Colors;
}) {
  const hc = (k: string) =>
    pick(colors, `haz:${k}`, HAZ_KINDS[k]?.color ?? HAZ_KINDS.other.color);
  const dc = (i: number) => pick(colors, `usdm:${i}`, USDM[i].color);
  return (
    <div className="grid gap-4">
      <YourArea hc={hc} dc={dc} />
      <HomeTabs
        label="Hazards"
        tabs={[
          {
            id: "haz-map",
            label: "Hazards Map",
            icon: <MapIcon aria-hidden />,
            panel: <HazardMap list={hazards} hc={hc} />,
          },
          {
            id: "haz-drought",
            label: "Drought Monitor",
            icon: <Sun aria-hidden />,
            panel: <DroughtMonitor national={national} trend={trend} dc={dc} />,
          },
          {
            id: "haz-outlook",
            label: "Drought Outlook",
            icon: <CalendarRange aria-hidden />,
            panel: <Outlook ids={["dm", "ds"]} />,
          },
        ]}
      />
      <p className={s.foot}>
        Sources: NOAA Climate Prediction Center hazards outlooks (updated
        weekdays), the U.S. Drought Monitor (National Drought Mitigation Center,
        USDA and NOAA; updated Thursdays for the week ending Tuesday) and CPC
        drought outlooks.
      </p>
    </div>
  );
}

function YourArea({
  hc,
  dc,
}: {
  hc: (k: string) => string;
  dc: (i: number) => string;
}) {
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : "";
  const [res, setRes] = useState<{ key: string; d: Here | "error" } | null>(
    null,
  );
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch(`/api/hazards/here?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Here) => live && setRes({ key, d }))
      .catch(() => live && setRes({ key, d: "error" }));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key is the place

  if (!active)
    return (
      <p className={s.card}>
        Set your location on the Homepage to see the hazards and drought where
        you live.
      </p>
    );
  const d = res?.key === key ? res.d : null;
  if (d === "error")
    return (
      <p className={s.card}>
        Your area&apos;s hazards aren&apos;t available right now.
      </p>
    );
  const latest = d && d !== null ? d.stateWeeks[0] : undefined;
  const old = d ? d.stateWeeks.at(-1) : undefined;
  const dry = (w?: { d: number[] }) =>
    w ? w.d.slice(1).reduce((a, x) => a + x, 0) : 0;
  return (
    <section className={s.card}>
      <p className={s.place}>
        <MapPin aria-hidden /> {active.label}
      </p>
      {!d ? (
        <p className={s.muted}>Checking your area…</p>
      ) : (
        <>
          <div
            className={s.status}
            style={{
              ["--c" as string]: d.dm == null ? "var(--line)" : dc(d.dm),
            }}
          >
            <b>{d.dm == null ? "No drought" : USDM[d.dm].label}</b>
            <span>
              {d.dm == null
                ? "Not dry on this week's Drought Monitor"
                : `${USDM[d.dm].code} on this week's Drought Monitor`}
            </span>
          </div>
          {d.hazards.length ? (
            <ul className={s.list}>
              {d.hazards.map((h) => (
                <li key={h.id} style={{ ["--c" as string]: hc(h.kind) }}>
                  <i />
                  <span>
                    <b>{h.label}</b>
                    <small>
                      {span(h)} ·{" "}
                      {h.period === "3-7"
                        ? "3–7 day outlook"
                        : "8–14 day outlook"}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted}>
              No CPC hazards over your area in the next two weeks.
            </p>
          )}
          {latest && d.state && (
            <div className="grid gap-1.5">
              <p className={s.small}>
                {d.state}: {Math.round(dry(latest))}% in drought (D1 or worse)
                {old && old !== latest
                  ? `, ${dry(latest) > dry(old) + 0.5 ? "up" : dry(latest) < dry(old) - 0.5 ? "down" : "about even"} from ${Math.round(dry(old))}% on ${week(old.week)}`
                  : ""}
              </p>
              <div
                className={s.stack}
                role="img"
                aria-label={`${d.state} drought by category`}
              >
                {latest.d.map((v, i) => (
                  <i
                    key={i}
                    style={{ flexGrow: v, background: dc(i) }}
                    title={`${USDM[i].code} ${v}%`}
                  />
                ))}
                <i style={{ flexGrow: latest.none, background: "var(--bg)" }} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function HazardMap({
  list,
  hc,
}: {
  list: Hazard[] | null;
  hc: (k: string) => string;
}) {
  const [period, setPeriod] = useState<"3-7" | "8-14">("3-7");
  const [picked, setPicked] = useState<Record<string, unknown> | null>(null);
  const filter = useMemo(
    () => ["==", ["get", "period"], period] as never,
    [period],
  );
  // One row per hazard type: the earliest start to the latest end across its areas.
  const shown = Object.values(
    (list ?? [])
      .filter((h) => h.period === period)
      .reduce<Record<string, Hazard & { areas: number }>>((acc, h) => {
        const a = acc[h.label];
        acc[h.label] = a
          ? {
              ...a,
              start: [a.start, h.start].filter(Boolean).sort()[0] ?? null,
              end: [a.end, h.end].filter(Boolean).sort().at(-1) ?? null,
              areas: a.areas + 1,
            }
          : { ...h, areas: 1 };
        return acc;
      }, {}),
  ).sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  return (
    <div className="grid gap-3">
      <div className="flex gap-1.5" role="group" aria-label="Outlook period">
        {(["3-7", "8-14"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => (setPeriod(p), setPicked(null))}
            className={s.pill}
          >
            {p === "3-7" ? "Days 3–7" : "Days 8–14"}
          </button>
        ))}
      </div>
      <div className="relative">
        <GeoMap
          url="/api/hazards/map?layer=cpc"
          label="CPC hazards outlook map"
          filter={filter}
          onPick={setPicked}
        />
        {picked && (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className={s.pop}
          >
            <b>{String(picked.label)}</b>
            <span>
              {span({
                start: (picked.start as string) ?? null,
                end: (picked.end as string) ?? null,
              })}
            </span>
          </button>
        )}
      </div>
      {list === null ? (
        <p className={s.muted}>
          CPC&apos;s hazards outlook isn&apos;t answering right now.
        </p>
      ) : shown.length ? (
        <ul className={s.list}>
          {shown.map((h) => (
            <li key={h.id} style={{ ["--c" as string]: hc(h.kind) }}>
              <i />
              <span>
                <b>{h.label}</b>
                <small>
                  {span(h)}
                  {h.areas > 1 ? ` · ${h.areas} areas` : ""}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>
          No hazards outlooked for days {period === "3-7" ? "3–7" : "8–14"}.
        </p>
      )}
    </div>
  );
}

function DroughtMonitor({
  national,
  trend,
  dc,
}: {
  national: { week: string | null; pct: number[] } | null;
  trend: Trend;
  dc: (i: number) => string;
}) {
  const max = Math.max(1, ...trend.map((t) => t.d0));
  const first = trend[0];
  const last = trend.at(-1);
  return (
    <div className="grid gap-3">
      <GeoMap
        url="/api/hazards/map?layer=usdm"
        label="US Drought Monitor map"
      />
      <div className={s.legend}>
        {USDM.map((d, i) => (
          <span key={d.code}>
            <i style={{ background: dc(i) }} />
            {d.code} {d.label}
          </span>
        ))}
      </div>
      {national && (
        <section className={s.card}>
          <h3>
            <Droplets aria-hidden /> The country this week
            {national.week ? ` · ${week(national.week)}` : ""}
          </h3>
          {USDM.map((d, i) => (
            <div
              key={d.code}
              className={s.bar}
              style={{ ["--c" as string]: dc(i) }}
            >
              <span>{i === 4 ? d.code : `${d.code}+`}</span>
              <i>
                <em style={{ transform: `scaleX(${national.pct[i] / 100})` }} />
              </i>
              <b>{national.pct[i].toFixed(1)}%</b>
            </div>
          ))}
          <p className={s.small}>
            Share of the lower 48 in each category or worse.
          </p>
        </section>
      )}
      {trend.length > 2 && first && last && (
        <section className={s.card}>
          <h3>Last {trend.length} weeks</h3>
          <svg
            viewBox="0 0 300 100"
            className="w-full"
            role="img"
            aria-label="Drought trend"
          >
            {(["d0", "d1", "d2", "d3", "d4"] as const).map((k, i) => (
              <polygon
                key={k}
                fill={dc(i)}
                fillOpacity={0.85}
                points={[
                  "0,100",
                  ...trend.map(
                    (t, j) =>
                      `${(j * 300) / (trend.length - 1)},${100 - (t[k] / max) * 92}`,
                  ),
                  "300,100",
                ].join(" ")}
              />
            ))}
          </svg>
          <p className={s.small}>
            In drought (D1+): {last.d1.toFixed(1)}%,{" "}
            {last.d1 > first.d1 + 0.5
              ? "up"
              : last.d1 < first.d1 - 0.5
                ? "down"
                : "about even"}{" "}
            from {first.d1.toFixed(1)}% on {week(first.week)}.
          </p>
        </section>
      )}
    </div>
  );
}
