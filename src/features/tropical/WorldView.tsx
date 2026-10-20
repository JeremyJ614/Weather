/* eslint-disable @next/next/no-img-element -- JTWC's own warning graphic, shown as published */
"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { pick, type Colors } from "@/lib/colors/pick";
import type { Storm } from "@/lib/tropical/nhc";
import { WORLD_BASINS, type WorldStorm } from "@/lib/tropical/jtwc";
import { BASINS, compass, tierOf } from "@/lib/tropical/style";
import { TrackMap, type MapTrack } from "./TrackMap";
import t from "@/app/tropical-outlook/Tropical.module.css";
import s from "./Products.module.css";

type Entry = {
  id: string;
  name: string;
  title: string;
  where: string;
  agency: "NHC" | "JTWC";
  kt: number;
  lat: number;
  lon: number;
  world?: WorldStorm;
};

const at = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon < 0 ? "W" : "E"}`;
const valid = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }) + " UTC"
    : "";

/** Every tropical cyclone on Earth now: NHC's storms plus JTWC's warnings everywhere else. */
export function WorldView({ nhc, colors }: { nhc: Storm[]; colors: Colors }) {
  const [world, setWorld] = useState<WorldStorm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [tab, setTab] = useState<"Forecast" | "Graphic" | "Warning">(
    "Forecast",
  );
  useEffect(() => {
    let live = true;
    fetch("/api/tropical/world")
      .then((r) => r.json())
      .then((d: { storms?: WorldStorm[]; error?: string }) => {
        if (!live) return;
        setWorld(d.storms ?? []);
        if (d.error) setError(d.error);
      })
      .catch(() => {
        if (!live) return;
        setWorld([]);
        setError("The Joint Typhoon Warning Center isn't answering right now.");
      });
    return () => {
      live = false;
    };
  }, []);

  const entries = useMemo<Entry[]>(
    () => [
      ...nhc.map((x) => ({
        id: x.id,
        name: x.name,
        title: x.title,
        where: BASINS.find((b) => b.id === x.basin)?.name ?? x.basin,
        agency: "NHC" as const,
        kt: x.kt,
        lat: x.lat,
        lon: x.lon,
      })),
      ...(world ?? []).map((w) => ({
        id: w.code,
        name: w.name,
        title: w.title,
        where: WORLD_BASINS[w.basin],
        agency: "JTWC" as const,
        kt: w.kt,
        lat: w.lat,
        lon: w.lon,
        world: w,
      })),
    ],
    [nhc, world],
  );
  const tracks = useMemo<MapTrack[]>(
    () => [
      ...nhc.map((x) => ({
        id: x.id,
        points: [[x.lat, x.lon, x.kt]] as [number, number, number][],
        forecast: x.points
          .slice(1)
          .map((p) => [p.lat, p.lon, p.kt] as [number, number, number]),
      })),
      ...(world ?? []).map((w) => ({
        id: w.code,
        points: [
          ...w.past.map(
            (p) => [p.lat, p.lon, p.kt] as [number, number, number],
          ),
          [w.lat, w.lon, w.kt] as [number, number, number],
        ],
        forecast: w.forecast
          .slice(1)
          .map((p) => [p.lat, p.lon, p.kt] as [number, number, number]),
      })),
    ],
    [nhc, world],
  );
  const dots = useMemo(
    () =>
      entries.map((e) => ({
        id: e.id,
        lat: e.lat,
        lon: e.lon,
        kt: e.kt,
        label: e.name,
      })),
    [entries],
  );
  const pickedEntry = entries.find((e) => e.id === id) ?? null;
  const w = pickedEntry?.world;
  const tone = (kt: number) => {
    const k = tierOf(kt);
    return pick(colors, `trop:${k.key}`, k.color);
  };

  return (
    <div className="grid gap-3">
      <section className={t.panel}>
        <header>
          <small>Every basin</small>
          <h4>Tropical cyclones worldwide</h4>
          <em>{world === null ? "Loading…" : `${entries.length} active`}</em>
        </header>
        <TrackMap
          tracks={tracks}
          dots={dots}
          selected={id}
          onPick={(x) => {
            setId(x);
            setTab("Forecast");
          }}
          colors={colors}
          center={[150, 10]}
          zoom={0.6}
          label="Map of tropical cyclones worldwide"
        />
        {error && <p className={s.blurb}>{error}</p>}
        {world !== null && !entries.length ? (
          <p className={t.empty}>
            No tropical cyclones anywhere right now. The National Hurricane
            Center covers the Atlantic and the Eastern and Central Pacific; the
            Joint Typhoon Warning Center covers the West Pacific, the Indian
            Ocean and the Southern Hemisphere.
          </p>
        ) : (
          <div className={s.list}>
            {entries.map((e) => (
              <button
                key={e.id}
                type="button"
                className={s.row}
                aria-pressed={e.id === id}
                onClick={() => {
                  setId(e.id === id ? null : e.id);
                  setTab("Forecast");
                }}
                style={{ ["--c" as string]: tone(e.kt) }}
              >
                <i aria-hidden />
                <span>
                  <b>{e.title}</b>
                  <small>
                    {e.where} · {e.agency}
                  </small>
                </span>
                <em>
                  {Math.round(e.kt * 1.15078)} mph
                  <br />
                  {tierOf(e.kt).short}
                </em>
              </button>
            ))}
          </div>
        )}
      </section>

      {pickedEntry && !w && (
        <p className={t.empty}>
          {pickedEntry.name} is tracked by the National Hurricane Center: its
          forecast, graphics and advisories are on the Storms tab.
        </p>
      )}
      {w && (
        <section className={t.panel}>
          <header>
            <small>
              {WORLD_BASINS[w.basin]} · {w.num}
            </small>
            <h4>{w.title}</h4>
            <em>Warning #{w.warning ?? "–"}</em>
          </header>
          <div className={t.subtabs} role="tablist" aria-label="Storm detail">
            {(["Forecast", "Graphic", "Warning"] as const).map((x) => (
              <button
                key={x}
                type="button"
                role="tab"
                aria-selected={x === tab}
                onClick={() => setTab(x)}
              >
                {x}
              </button>
            ))}
          </div>
          {tab === "Forecast" && (
            <>
              <p className={s.blurb}>
                Valid {valid(w.valid)} · {at(w.lat, w.lon)}
              </p>
              <div className={s.stats}>
                <div>
                  <small>Sustained</small>
                  <b>{w.mph} mph</b>
                  <span>{w.kt} kt (1-minute)</span>
                </div>
                <div>
                  <small>Gusts</small>
                  <b>
                    {w.gustKt ? `${Math.round(w.gustKt * 1.15078)} mph` : "–"}
                  </b>
                  <span>{w.gustKt ? `${w.gustKt} kt` : ""}</span>
                </div>
                <div>
                  <small>Pressure</small>
                  <b>{w.pressure ? `${w.pressure} mb` : "–"}</b>
                  <span>minimum central</span>
                </div>
                <div>
                  <small>Moving</small>
                  <b>{w.dir != null ? compass(w.dir) : "–"}</b>
                  <span>
                    {w.speedMph != null ? `at ${w.speedMph} mph` : ""}
                  </span>
                </div>
              </div>
              {w.forecast.length > 1 && (
                <table className={t.table}>
                  <thead>
                    <tr>
                      <th>Forecast</th>
                      <th>Winds</th>
                      <th>Strength</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.forecast.map((p) => (
                      <tr key={p.tau}>
                        <td>{p.tau ? `+${p.tau} h` : "Now"}</td>
                        <td>{Math.round(p.kt * 1.15078)} mph</td>
                        <td>{tierOf(p.kt).short}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {w.remarks && <p className={s.blurb}>{w.remarks}</p>}
            </>
          )}
          {tab === "Graphic" && (
            <>
              <img
                src={w.links.graphic}
                alt={`JTWC warning graphic for ${w.title}`}
                loading="lazy"
                className={s.graphic}
              />
              <a
                href={w.links.graphic}
                target="_blank"
                rel="noreferrer"
                className={s.small}
              >
                <ExternalLink aria-hidden /> Full size
              </a>
            </>
          )}
          {tab === "Warning" && (
            <>
              <pre className={s.pre}>{w.text}</pre>
              <a
                href={w.links.text}
                target="_blank"
                rel="noreferrer"
                className={s.small}
              >
                <ExternalLink aria-hidden /> Open on JTWC
              </a>
            </>
          )}
          <p className={s.source}>
            Joint Typhoon Warning Center. Winds are 1-minute averages; strength
            labels use the Saffir-Simpson scale. Follow your national weather
            service for local warnings.
          </p>
        </section>
      )}
    </div>
  );
}
