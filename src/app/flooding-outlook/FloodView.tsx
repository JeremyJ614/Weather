"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudRain, MapPin, Siren, Waves } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { GeoMap } from "@/features/hazards/GeoMap";
import { UsMap } from "@/features/maps/UsMap";
import { Polys, useLayer } from "@/features/maps/useLayer";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import { ERO_COLORS, QPF } from "@/lib/map/products";
import type { EroDay, FloodHere } from "@/lib/flood/data";
import { ERO_LEVELS as LEVELS } from "@/lib/flood/levels";
import s from "./Flood.module.css";

const dayName = (d: number) =>
  d === 1
    ? "Today"
    : d === 2
      ? "Tomorrow"
      : new Date(Date.now() + (d - 1) * 86400000).toLocaleDateString("en-US", {
          weekday: "long",
        });
const ends = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }) + " CT"
    : "";

/** Flooding Outlook: your answer, the five-day strip, the risk map, rainfall totals. */
export function FloodView({
  days,
  colors,
}: {
  days: EroDay[];
  colors: Colors;
}) {
  const color = (lvl: number) =>
    lvl > 0
      ? pick(colors, `ero:${lvl - 1}`, ERO_COLORS[lvl - 1].color)
      : "var(--line)";
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : "";
  const [res, setRes] = useState<{
    key: string;
    d: FloodHere | "error";
  } | null>(null);
  const [day, setDay] = useState(1);
  const [picked, setPicked] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch(`/api/flood/here?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: FloodHere) => live && setRes({ key, d }))
      .catch(() => live && setRes({ key, d: "error" }));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key is the place

  const here = res?.key === key && res.d !== "error" ? res.d : null;
  const worst = here ? Math.max(...here.ero) : 0;
  const worstDay = here ? here.ero.indexOf(worst) + 1 : 0;
  const url = useMemo(() => `/api/flood/map?day=${day}`, [day]);
  const d = days.find((x) => x.day === day);

  return (
    <div className="grid gap-4">
      <section className={s.answer} style={{ ["--c" as string]: color(worst) }}>
        {!active ? (
          <p className={s.muted}>
            Set your location on the Homepage to see your own flood risk first.
          </p>
        ) : res?.d === "error" ? (
          <p className={s.muted}>
            Your flood risk isn&apos;t available right now.
          </p>
        ) : !here ? (
          <p className={s.muted}>Checking {active.label}…</p>
        ) : (
          <>
            <p className={s.place}>
              <MapPin aria-hidden /> {active.label}
            </p>
            <h2>
              {worst
                ? `${LEVELS[worst - 1].label} risk`
                : "No excessive-rain risk"}
            </h2>
            <p className={s.lead}>
              {worst
                ? `${dayName(worstDay)} is your worst day: a ${LEVELS[worst - 1].label.toLowerCase()} risk (${LEVELS[worst - 1].odds} chance of flash flooding nearby). ${LEVELS[worst - 1].meaning}`
                : "WPC doesn't expect rain heavy enough to cause flash flooding at your location in the next five days."}
            </p>
            <div className={s.rain}>
              {here.rain.map((r) => (
                <div key={r.label}>
                  <b>{r.inches ? `${r.inches}″+` : "0″"}</b>
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
            {here.alerts.map((a) => (
              <p key={a.headline} className={s.alert}>
                <Siren aria-hidden />
                <span>
                  <b>{a.event}</b>
                  {a.ends && <small> until {ends(a.ends)}</small>}
                </span>
              </p>
            ))}
          </>
        )}
      </section>

      <HomeTabs
        label="Flooding"
        tabs={[
          {
            id: "fl-ero",
            label: "Excessive Rain",
            icon: <Waves aria-hidden />,
            panel: (
              <div className="grid gap-3">
                <div className={s.strip} role="group" aria-label="Day">
                  {days.map((x, i) => (
                    <button
                      key={x.day}
                      type="button"
                      aria-pressed={x.day === day}
                      onClick={() => (setDay(x.day), setPicked(null))}
                      style={{ ["--c" as string]: color(x.top) }}
                    >
                      <span>{dayName(x.day)}</span>
                      <i />
                      <b>{x.top ? LEVELS[x.top - 1].label : "None"}</b>
                      {here && (
                        <small
                          style={{
                            color: here.ero[i] ? color(here.ero[i]) : undefined,
                          }}
                        >
                          you:{" "}
                          {here.ero[i] ? LEVELS[here.ero[i] - 1].label : "none"}
                        </small>
                      )}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <GeoMap
                    url={url}
                    label={`Excessive rainfall outlook, ${dayName(day)}`}
                    onPick={setPicked}
                  />
                  {picked && (
                    <button
                      type="button"
                      onClick={() => setPicked(null)}
                      className={s.pop}
                    >
                      <b>
                        {String(picked.label)} risk · {String(picked.odds)}
                      </b>
                      <span>{LEVELS[Number(picked.dn) - 1]?.meaning}</span>
                    </button>
                  )}
                </div>
                <p className={s.muted}>
                  {d?.valid ? `Valid ${d.valid}. ` : ""}
                  {d && !d.top
                    ? "No excessive-rainfall area anywhere in the country this day."
                    : ""}
                </p>
                <ul className={s.levels}>
                  {LEVELS.map((l, i) => (
                    <li
                      key={l.label}
                      style={{ ["--c" as string]: color(i + 1) }}
                    >
                      <i />
                      <span>
                        <b>
                          {l.label} <small>{l.odds}</small>
                        </b>
                        <small>{l.meaning}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
          {
            id: "fl-rain",
            label: "Rainfall Totals",
            icon: <CloudRain aria-hidden />,
            panel: <Rainfall />,
          },
        ]}
      />
      <p className={s.foot}>
        Source: NOAA Weather Prediction Center Excessive Rainfall Outlook and
        rainfall forecasts; flood alerts from the National Weather Service.
        Percentages are the chance of flash flooding within 25 miles of a point.
      </p>
    </div>
  );
}

function Rainfall() {
  const [id, setId] = useState("t3");
  const { layer, status } = useLayer(id);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period">
        {QPF.map((q) => (
          <button
            key={q.id}
            type="button"
            aria-pressed={q.id === id}
            onClick={() => setId(q.id)}
            className="min-h-9 rounded-full border border-line px-3 text-xs font-semibold aria-pressed:border-[var(--lit-line)] aria-pressed:bg-[var(--lit)] aria-pressed:text-accent"
          >
            {q.label}
          </button>
        ))}
      </div>
      <UsMap
        title={layer?.title ?? "Rainfall forecast"}
        sub={layer?.valid}
        legend={layer?.legend ?? []}
        status={status}
        file={`sswx-qpf-${id}`}
      >
        {layer && <Polys polys={layer.polys} />}
      </UsMap>
    </div>
  );
}
