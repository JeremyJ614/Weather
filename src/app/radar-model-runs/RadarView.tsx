"use client";

import { useEffect, useState } from "react";
import { BarChart3, Clapperboard, Radar } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { RadarMap } from "@/features/radar/RadarMap";
import { SatLoop } from "@/features/tropical/SatLoop";
import { usePlaces } from "@/features/location/usePlaces";
import { pick, type Colors } from "@/lib/colors/pick";
import { COMPARE, MODEL_MAPS, type ModelId } from "@/lib/radar/products";
import s from "./RadarView.module.css";

/** Radar & Model Runs: live radar, model map loops and the model comparison. */
export function RadarView({ colors }: { colors: Colors }) {
  return (
    <div className="grid gap-4">
      <HomeTabs
        label="Radar"
        tabs={[
          {
            id: "r-radar",
            label: "Radar",
            icon: <Radar aria-hidden />,
            panel: <RadarMap />,
          },
          {
            id: "r-runs",
            label: "Model Runs",
            icon: <Clapperboard aria-hidden />,
            panel: <ModelRuns />,
          },
          {
            id: "r-compare",
            label: "Model Compare",
            icon: <BarChart3 aria-hidden />,
            panel: <Compare colors={colors} />,
          },
        ]}
      />
      <p className={s.foot}>
        Sources: NEXRAD mosaic tiles (Iowa Environmental Mesonet), MRMS and GOES
        (SSEC RealEarth), model maps from NOAA NCEP Model Analyses &amp;
        Guidance, and model forecasts from Open-Meteo.
      </p>
    </div>
  );
}

function ModelRuns() {
  const [model, setModel] = useState<ModelId>("gfs");
  const fields = Object.entries(MODEL_MAPS[model].fields);
  const [field, setField] = useState(fields[0][0]);
  const f = field in MODEL_MAPS[model].fields ? field : fields[0][0];
  return (
    <div className="grid gap-3">
      <div className={s.pills} role="group" aria-label="Model">
        {(Object.keys(MODEL_MAPS) as ModelId[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === model}
            onClick={() => setModel(m)}
          >
            {MODEL_MAPS[m].label}
          </button>
        ))}
      </div>
      <div className={s.pills} role="group" aria-label="Map">
        {fields.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === f}
            onClick={() => setField(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <SatLoop
        key={`${model}-${f}`}
        src={`${model}-${f}`}
        url={`/api/models/frames?model=${model}&field=${f}`}
        ratio="4 / 3"
      />
      <p className={s.muted}>
        {model === "gfs"
          ? "GFS: the global model, out 10 days every 6 hours."
          : "NAM: the North American model, out 3½ days every 3 hours."}{" "}
        Frames are NOAA&apos;s own maps for the newest complete run.
      </p>
    </div>
  );
}

type Cmp = {
  time: string[];
  models: {
    key: string;
    label: string;
    temp: (number | null)[];
    rain: number;
  }[];
};

function Compare({ colors }: { colors: Colors }) {
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : "";
  const [res, setRes] = useState<{ key: string; d: Cmp | "error" } | null>(
    null,
  );
  useEffect(() => {
    if (!active) return;
    let live = true;
    fetch(`/api/models/compare?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Cmp) => live && setRes({ key, d }))
      .catch(() => live && setRes({ key, d: "error" }));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key is the place
  if (!active)
    return (
      <p className={s.muted}>
        Set your location on the Homepage to compare every model for your spot.
      </p>
    );
  const d = res?.key === key ? res.d : null;
  if (!d)
    return <p className={s.muted}>Asking every model about {active.label}…</p>;
  if (d === "error" || !d.models.length)
    return (
      <p className={s.muted}>The model feed isn&apos;t answering right now.</p>
    );
  const c = (k: string) =>
    pick(
      colors,
      `runs:${k}`,
      COMPARE.find((m) => m.key === k)?.color ?? "#888888",
    );
  const all = d.models.flatMap((m) =>
    m.temp.filter((x): x is number => x != null),
  );
  const lo = Math.min(...all) - 2;
  const hi = Math.max(...all) + 2;
  const n = d.time.length;
  const x = (i: number) => 24 + (i * 330) / Math.max(1, n - 1);
  const y = (t: number) => 10 + ((hi - t) / (hi - lo)) * 110;
  const maxRain = Math.max(0.05, ...d.models.map((m) => m.rain));
  const highs = d.models.map((m) =>
    Math.max(...m.temp.slice(0, 24).filter((v): v is number => v != null)),
  );
  const spread = Math.max(...highs) - Math.min(...highs);
  return (
    <div className="grid gap-3">
      <p className={s.lead}>
        {active.label}: the models{" "}
        {spread <= 3 ? "agree" : spread <= 7 ? "mostly agree" : "disagree"} on
        the next 24 hours — highs range {Math.min(...highs)}° to{" "}
        {Math.max(...highs)}°.
      </p>
      <svg
        viewBox="0 0 360 140"
        className="w-full"
        role="img"
        aria-label="Temperature by model, next 48 hours"
      >
        {[0, 12, 24, 36].map((h) => (
          <g key={h}>
            <line x1={x(h)} x2={x(h)} y1="8" y2="122" stroke="var(--line)" />
            <text x={x(h) + 2} y="134" fontSize="7" fill="var(--muted)">
              {new Date(d.time[h] ?? d.time[0]).toLocaleString("en-US", {
                weekday: "short",
                hour: "numeric",
              })}
            </text>
          </g>
        ))}
        {[lo + 2, (lo + hi) / 2, hi - 2].map((t) => (
          <text key={t} x="2" y={y(t) + 2} fontSize="7" fill="var(--muted)">
            {Math.round(t)}°
          </text>
        ))}
        {d.models.map((m) => (
          <polyline
            key={m.key}
            fill="none"
            stroke={c(m.key)}
            strokeWidth="1.7"
            strokeLinejoin="round"
            points={m.temp
              .flatMap((t, i) => (t == null ? [] : [`${x(i)},${y(t)}`]))
              .join(" ")}
          />
        ))}
      </svg>
      <ul className={s.models}>
        {d.models.map((m) => (
          <li key={m.key} style={{ ["--c" as string]: c(m.key) }}>
            <i />
            <b>{m.label}</b>
            <span>
              high{" "}
              {Math.max(
                ...m.temp.slice(0, 24).filter((v): v is number => v != null),
              )}
              °
            </span>
            <em>
              <u style={{ transform: `scaleX(${m.rain / maxRain})` }} />
            </em>
            <span>{m.rain.toFixed(2)}″ rain</span>
          </li>
        ))}
      </ul>
      <p className={s.muted}>
        Lines: temperature for the next 48 hours. Bars: rain each model expects
        over the same time.
      </p>
    </div>
  );
}
