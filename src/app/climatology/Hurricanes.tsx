"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageSource, Map as MaplibreMap } from "maplibre-gl";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import { INTENSITY, tierOf, mph } from "@/lib/tropical/style";
import { CLIMO_RAMP } from "@/lib/climo/style";
import s from "./Climo.module.css";
import {
  type HSummary,
  type HNear,
  MONTHS,
  every,
  useJson,
  Bars,
} from "./climo";
import { InfoScrub } from "@/components/charts/InfoScrub";

export function Hurricanes({
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
              role="group"
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
              {(() => {
                const max = Math.max(...curve("AL"), ...curve("EP"));
                const n = curve("AL").length;
                return (
                  <InfoScrub
                    label="Storms active by day of year"
                    x0={0}
                    x1={((n - 1) / 365) * 360}
                    top={8}
                    bottom={100}
                    width={360}
                    height={110}
                    start={peak}
                    title={(i) =>
                      new Date(Date.UTC(2025, 0, 1 + i)).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", timeZone: "UTC" },
                      )
                    }
                    series={(["AL", "EP"] as const).map((b) => ({
                      key: b,
                      label: b === "AL" ? "Atlantic" : "E. Pacific",
                      color: c(b === "AL" ? "atl" : "epac"),
                      y: curve(b).map((v) => 100 - (v / max) * 92),
                      text: curve(b).map((v) => `${v.toFixed(1)} storms`),
                    }))}
                  />
                );
              })()}
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
