"use client";

import { useEffect, useState } from "react";
import {
  CloudHail,
  ExternalLink,
  Layers,
  MapPin,
  Tornado,
  Wind,
} from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { usePlaces } from "@/features/location/usePlaces";
import { Picker } from "@/features/maps/Section";
import { UsMap, type Swatch } from "@/features/maps/UsMap";
import type { Hazard } from "@/lib/colors/spc";
import s from "./Spc.module.css";

export type Step = {
  level: number;
  label: string;
  note: string;
  color: string;
  opacity: number;
};

// VIP's seven outlook types, laid out as Overview over a hazard × (likelihood, intensity) grid.
const TYPES: { hazard: Hazard; intensity: boolean; label: string }[] = [
  { hazard: "cat", intensity: false, label: "Overview" },
  { hazard: "torn", intensity: false, label: "Tornado Likelihood" },
  { hazard: "hail", intensity: false, label: "Hail Likelihood" },
  { hazard: "wind", intensity: false, label: "Wind Likelihood" },
  { hazard: "torn", intensity: true, label: "Tornado Intensity" },
  { hazard: "hail", intensity: true, label: "Hail Intensity" },
  { hazard: "wind", intensity: true, label: "Wind Intensity" },
];
const HAZ_ICON = {
  cat: Layers,
  torn: Tornado,
  hail: CloudHail,
  wind: Wind,
} as const;

type Outlook = {
  title: string;
  valid: string | null;
  polys: { c: string; d: string; sig: boolean }[];
  legend: Swatch[];
  top: string | null;
};

function useJson<T>(url: string) {
  const [res, setRes] = useState<{ url: string; data: T | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setRes({ url, data: d }))
      .catch(() => live && setRes({ url, data: null }));
    return () => {
      live = false;
    };
  }, [url]);
  return res?.url === url
    ? { data: res.data, loading: false }
    : { data: null, loading: true };
}

const Hatch = () => (
  <defs>
    <pattern
      id="spc-hatch"
      width="7"
      height="7"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line
        x1="0"
        y1="0"
        x2="0"
        y2="7"
        stroke="#000"
        strokeOpacity="0.55"
        strokeWidth="2.4"
      />
    </pattern>
  </defs>
);

/** Your place, Days 1–8, on VIP's probability scale. */
export function PlaceStrip({
  steps,
  days,
}: {
  steps: Step[];
  days: { d: number; label: string }[];
}) {
  const { active } = usePlaces();
  const url = active
    ? `/api/spc/point?lat=${active.lat}&lon=${active.lon}`
    : "";
  const { data } = useJson<{ days: { day: number; step: number | null }[] }>(
    url || "/api/spc/point",
  );
  if (!active) return null;
  return (
    <section className={s.strip}>
      <p className="eyebrow">
        <MapPin className="mr-1 inline size-3.5" aria-hidden /> {active.label} ·
        next 8 days
      </p>
      <ol>
        {days.map(({ d, label }, i) => {
          const st = data?.days.find((x) => x.day === d)?.step;
          const step = st ? steps[st - 1] : null;
          return (
            <li
              key={d}
              style={{
                ["--c" as string]: step?.color ?? "transparent",
                ["--i" as string]: i,
              }}
            >
              <span>{label === "Tomorrow" ? "Tmrw" : label}</span>
              <i className={step ? s.sw : s.swNone} aria-hidden />
              <b>
                {st === undefined
                  ? "…"
                  : st === null
                    ? "—"
                    : step
                      ? step.level
                      : "0"}
              </b>
            </li>
          );
        })}
      </ol>
      <p className={s.muted}>
        {data
          ? (() => {
              const worst = Math.max(0, ...data.days.map((x) => x.step ?? 0));
              return worst
                ? `Highest this week: ${steps[worst - 1].label} (${steps[worst - 1].note}).`
                : "No severe risk drawn over your place this week.";
            })()
          : "Reading the outlooks…"}
      </p>
    </section>
  );
}

/** SPC Outlook: VIP's seven types for Days 1–2, categorical Day 3, probabilistic Days 4–8. */
export function OutlookView({
  days,
}: {
  days: { d: number; label: string }[];
}) {
  const [day, setDay] = useState(1);
  const [ti, setTi] = useState(0);
  const typesOk = day <= 2;
  const t = typesOk ? TYPES[ti] : TYPES[0];
  const url = `/api/spc/outlook?day=${day}&hazard=${t.hazard}&intensity=${t.intensity ? 1 : 0}`;
  const { data, loading } = useJson<Outlook>(url);
  const href =
    day >= 4
      ? "https://www.spc.noaa.gov/products/exper/day4-8/"
      : `https://www.spc.noaa.gov/products/outlook/day${day}otlk.html`;
  return (
    <div className="grid gap-4">
      <Picker>
        {days.map((x) => (
          <Chip key={x.d} pressed={day === x.d} onClick={() => setDay(x.d)}>
            {x.label}
          </Chip>
        ))}
      </Picker>
      {typesOk ? (
        <div className={s.types} role="group" aria-label="Outlook type">
          {TYPES.map((x, i) => {
            const Icon = HAZ_ICON[x.hazard];
            const [name, kind] =
              x.hazard === "cat"
                ? ["Overview", "All hazards"]
                : x.label.split(" ");
            return (
              <button
                key={x.label}
                type="button"
                aria-pressed={ti === i}
                onClick={() => setTi(i)}
                className={
                  x.hazard === "cat" ? `${s.type} ${s.typeWide}` : s.type
                }
              >
                <Icon aria-hidden />
                <b>{name}</b>
                <small>{kind}</small>
              </button>
            );
          })}
        </div>
      ) : (
        <p className={s.muted}>
          {day === 3
            ? "Day 3 issues a single categorical outlook (no hazard breakdown)."
            : "Days 4-8 show the combined probability of any severe weather (SPC issues one outlook — no hazard breakdown)."}
        </p>
      )}
      <UsMap
        title={data?.title ?? `Day ${day} — ${t.label}`}
        sub={data?.valid}
        legend={data?.legend ?? []}
        status={
          loading
            ? "loading"
            : !data
              ? "error"
              : data.polys.length
                ? "ready"
                : "empty"
        }
        file={`sswx-spc-day${day}-${t.hazard}${t.intensity ? "-intensity" : ""}`}
        zoomable
      >
        <Hatch />
        {data?.polys.map((p, i) => (
          <g key={i}>
            <path
              d={p.d}
              fill={p.c}
              fillOpacity={p.sig ? 0.86 : 0.62}
              stroke={p.c}
              strokeWidth={1.4}
            />
            {p.sig && <path d={p.d} fill="url(#spc-hatch)" />}
          </g>
        ))}
      </UsMap>
      <div className={s.row}>
        {data?.top && (
          <span className={s.top}>
            Highest on the map: <b>{data.top}</b>
          </span>
        )}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={s.link}
        >
          <ExternalLink aria-hidden /> SPC
        </a>
      </div>
      {t.intensity && (
        <p className={s.muted}>
          Intensity shows SPC&apos;s Conditional Intensity Groups: if a tornado,
          hail or damaging wind happens inside a hatched area, SPC expects it to
          be stronger than usual. It is about how strong, not how likely.
        </p>
      )}
    </div>
  );
}

type Prob = {
  valid: string | null;
  polys: { c: string; d: string; o: number }[];
  steps: Step[];
  top: number;
};

/** Probability: VIP's five-step severe probability map and scale, Days 1–8. */
export function ProbabilityView({
  days,
  steps,
}: {
  days: { d: number; label: string }[];
  steps: Step[];
}) {
  const [day, setDay] = useState(1);
  const { data, loading } = useJson<Prob>(`/api/spc/probability?day=${day}`);
  return (
    <div className="grid gap-4">
      <Picker>
        {days.map((x) => (
          <Chip key={x.d} pressed={day === x.d} onClick={() => setDay(x.d)}>
            {x.label}
          </Chip>
        ))}
      </Picker>
      <UsMap
        title={`Severe Weather Probability · Day ${day}`}
        sub={data?.valid}
        legend={steps.map((st) => ({
          label: `${st.level} · ${st.label}`,
          color: st.color,
        }))}
        status={
          loading
            ? "loading"
            : !data
              ? "error"
              : data.polys.length
                ? "ready"
                : "empty"
        }
        file={`sswx-severe-probability-day${day}`}
        zoomable
      >
        {data?.polys.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={p.c}
            fillOpacity={p.o}
            stroke={p.c}
            strokeWidth={1.4}
          />
        ))}
      </UsMap>
      <section className={s.scale}>
        <p className="eyebrow">Likelihood Scale</p>
        <ol>
          {[...steps].reverse().map((st, i) => (
            <li
              key={st.level}
              className={data?.top === st.level ? s.now : undefined}
              style={{ ["--c" as string]: st.color, ["--i" as string]: i }}
            >
              <span
                className={s.num}
                style={{ color: st.level >= 4 ? "#fff" : "#101018" }}
              >
                {st.level}
              </span>
              <span>
                <b>{st.label}</b>
                <small>{st.note}</small>
              </span>
            </li>
          ))}
        </ol>
        <p className={s.muted}>
          This is the probability of <strong>any</strong> severe weather
          (tornado, damaging wind, or large hail) within about 25 miles of a
          point — not the categorical risk level. Days 1–3 come from the SPC
          categorical outlook, folded onto this five-level scale: General
          Thunder is 1, Marginal 2, Slight 3, Enhanced 4, and Moderate and High
          both reach 5. Days 4–8 use the SPC probabilistic any-severe outlook,
          cut at the same percentages the SPC uses to draw those categories, so
          a 15% day on Day 6 reads the same as a Slight risk on Day 1.
        </p>
      </section>
    </div>
  );
}
