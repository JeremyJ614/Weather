"use client";

import { useMemo } from "react";
import { UsMap } from "@/features/maps/UsMap";
import { usePlaces } from "@/features/location/usePlaces";
import { rasterize } from "@/features/sky/raster";
import { CLIMO_LIGHT } from "@/lib/climo/style";
import s from "./Climo.module.css";
import { type Grid, MONTHS, MONTH_NAMES, useJson, Bars } from "./climo";

type LGrid = Grid & { first: number; last: number; x10: number[] };
const LIGHT_YEARS = { first: 1995, last: 2014 };

/** Annual flashes/km² at a point from the LIS/OTD grid (null off the Lower 48). */
function flashesAt(g: LGrid, lat: number, lon: number) {
  const i = Math.floor((lat - g.lat0) / g.step);
  const j = Math.floor((lon - g.lon0) / g.step);
  if (i < 0 || j < 0 || i >= g.h || j >= g.w) return null;
  return g.x10[i * g.w + j] / 10;
}

export function Lightning({ c }: { c: (k: string) => string }) {
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
