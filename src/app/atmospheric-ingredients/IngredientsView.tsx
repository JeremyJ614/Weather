"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { CountUp } from "@/features/dashboard/widgets/CountUp";
import { usePlaces } from "@/features/location/usePlaces";
import {
  capeLevel,
  dewLevel,
  liLevel,
  shearLevel,
  srhLevel,
  stpLevel,
  swti,
  threatLevel,
  type Pastel,
} from "@/lib/ingredients/calc";
import s from "./Ing.module.css";

export type Hour = {
  time: string;
  cape: number;
  li: number;
  dew: number;
  srh: number;
  shear: number;
  stp: number;
  swti: number;
  pop: number;
  tornado: string;
  hail: string;
  wind: string;
};
type Data = {
  tz: string;
  hours: Hour[];
  models: { name: string; cape: number }[];
};

const when = (t: string) =>
  new Date(`${t}:00`).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
  });

function Spark({ vals, color }: { vals: number[]; color: string }) {
  if (vals.length < 2) return null;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pts = vals
    .map(
      (v, i) =>
        `${(i / (vals.length - 1)) * 100},${28 - ((v - lo) / Math.max(1e-6, hi - lo)) * 24}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={s.spark}
      aria-hidden
    >
      <polyline points={pts} stroke={color} />
    </svg>
  );
}

function Chart({
  hours,
  a,
  b,
  sel,
}: {
  hours: Hour[];
  a: { key: keyof Hour; label: string; color: string };
  b: { key: keyof Hour; label: string; color: string };
  sel: number;
}) {
  const W = 340;
  const H = 120;
  const line = (k: keyof Hour) => {
    const v = hours.map((h) => Number(h[k]));
    const hi = Math.max(1, ...v);
    return v
      .map(
        (x, i) =>
          `${i ? "L" : "M"} ${(8 + (i / (v.length - 1)) * (W - 16)).toFixed(1)} ${(H - 14 - (x / hi) * (H - 26)).toFixed(1)}`,
      )
      .join(" ");
  };
  const x = 8 + (sel / Math.max(1, hours.length - 1)) * (W - 16);
  return (
    <figure className={s.chart}>
      <figcaption>
        <span style={{ color: a.color }}>{a.label}</span> ·{" "}
        <span style={{ color: b.color }}>{b.label}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <line x1={x} x2={x} y1="6" y2={H - 12} className={s.cursor} />
        <path d={line(a.key)} stroke={a.color} className={s.chartLine} />
        <path
          d={line(b.key)}
          stroke={b.color}
          className={s.chartLine}
          strokeDasharray="5 4"
        />
      </svg>
    </figure>
  );
}

/** Atmospheric Ingredients for the active place: VIP's module, redesigned. */
export function IngredientsView({ tones }: { tones: Record<Pastel, string> }) {
  const { active } = usePlaces();
  const key = active ? `${active.lat},${active.lon}` : "";
  const [res, setRes] = useState<{ key: string; data: Data | null } | null>(
    null,
  );
  const [sel, setSel] = useState(0);
  useEffect(() => {
    if (!active) return;
    let live = true;
    const k = `${active.lat},${active.lon}`;
    fetch(`/api/ingredients?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setRes({ key: k, data: d }))
      .catch(() => live && setRes({ key: k, data: null }));
    return () => {
      live = false;
    };
  }, [active]);
  const data = res?.key === key ? res.data : undefined;
  const hours = useMemo(() => data?.hours ?? [], [data]);

  if (!active)
    return (
      <p className={s.empty}>Save a place to see its storm ingredients.</p>
    );
  if (data === undefined)
    return <div className={s.skeleton} aria-label="Loading" />;
  if (!data || !hours.length)
    return (
      <p className={s.empty}>
        The model feed isn&apos;t answering right now. Try again in a minute.
      </p>
    );

  const i = Math.min(sel, hours.length - 1);
  const h = hours[i];
  const t = swti({
    cape: h.cape,
    srh: h.srh,
    shear: h.shear,
    li: h.li,
    dew: h.dew,
  });
  const lvl = threatLevel(h.swti);
  const ring = 2 * Math.PI * 52;
  const peak = hours.reduce((a, b, j) => (b.swti > hours[a].swti ? j : a), 0);
  const next = (k: keyof Hour) =>
    hours.slice(i, i + 24).map((x) => Number(x[k]));
  const cards: {
    label: string;
    v: string;
    unit: string;
    lv: { label: string; tone: Pastel };
    k: keyof Hour;
  }[] = [
    {
      label: "CAPE",
      v: h.cape.toLocaleString(),
      unit: "J/kg",
      lv: capeLevel(h.cape),
      k: "cape",
    },
    {
      label: "0–6 km shear",
      v: String(h.shear),
      unit: "kt",
      lv: shearLevel(h.shear),
      k: "shear",
    },
    {
      label: "0–3 km SRH",
      v: String(h.srh),
      unit: "m²/s²",
      lv: srhLevel(h.srh),
      k: "srh",
    },
    {
      label: "Lifted index",
      v: String(h.li),
      unit: "°C",
      lv: liLevel(h.li),
      k: "li",
    },
    {
      label: "Dew point",
      v: String(h.dew),
      unit: "°C",
      lv: dewLevel(h.dew),
      k: "dew",
    },
    {
      label: "STP",
      v: h.stp.toFixed(1),
      unit: "",
      lv: stpLevel(h.stp),
      k: "stp",
    },
  ];
  const agree = (() => {
    const v = data.models.map((m) => m.cape);
    if (v.length < 2) return null;
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const spread = (Math.max(...v) - Math.min(...v)) / Math.max(mean, 1);
    return spread < 0.35
      ? { label: "High", tone: "mint" as Pastel }
      : spread < 0.7
        ? { label: "Moderate", tone: "yellow" as Pastel }
        : { label: "Low", tone: "coral" as Pastel };
  })();
  const mMax = Math.max(500, ...data.models.map((m) => m.cape));

  const pickAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const j = Math.round(((e.clientX - r.left) / r.width) * (hours.length - 1));
    setSel(Math.max(0, Math.min(hours.length - 1, j)));
  };

  return (
    <div className={s.wrap} style={{ ["--tone" as string]: tones[lvl.tone] }}>
      <section className={s.hero}>
        <p className="eyebrow">
          <MapPin className="mr-1 inline size-3.5" aria-hidden /> {active.label}{" "}
          · {when(h.time)}
        </p>
        <div className={s.gauge}>
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="52" className={s.track} />
            <circle
              key={i}
              cx="60"
              cy="60"
              r="52"
              className={s.arc}
              strokeDasharray={`${(ring * h.swti) / 100} ${ring}`}
            />
          </svg>
          <div className={s.read}>
            <b>
              <CountUp key={i} value={h.swti} ms={700} />
            </b>
            <span className={s.unit}>SWTI</span>
          </div>
        </div>
        <p className={s.level}>{lvl.level}</p>
        <p className={s.desc}>{lvl.desc}</p>
        <div className={s.risks}>
          {[
            ["Tornado", t.tornado],
            ["Hail", t.hail],
            ["Wind", t.wind],
          ].map(([k, v]) => (
            <span key={k} data-none={v === "none" || undefined}>
              {k}: <b>{v}</b>
            </span>
          ))}
        </div>
      </section>

      <section className={s.strip}>
        <div className={s.stripHead}>
          <p className="eyebrow">Next 72 hours</p>
          <button onClick={() => setSel(peak)} className={s.peakBtn}>
            Peak {hours[peak].swti} · {when(hours[peak].time)}
          </button>
        </div>
        <svg
          viewBox={`0 0 ${hours.length * 5} 64`}
          preserveAspectRatio="none"
          className={s.bars}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pickAt(e);
          }}
          onPointerMove={(e) => e.buttons && pickAt(e)}
          role="slider"
          aria-label="Hour"
          aria-valuemin={0}
          aria-valuemax={hours.length - 1}
          aria-valuenow={i}
          aria-valuetext={when(h.time)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight")
              setSel(Math.min(hours.length - 1, i + 1));
            if (e.key === "ArrowLeft") setSel(Math.max(0, i - 1));
          }}
        >
          {hours.map((x, j) => (
            <rect
              key={j}
              x={j * 5 + 0.6}
              y={62 - Math.max(2, (x.swti / 100) * 60)}
              width="3.8"
              height={Math.max(2, (x.swti / 100) * 60)}
              fill={tones[threatLevel(x.swti).tone]}
              opacity={j === i ? 1 : 0.55}
              rx="1"
            />
          ))}
          <rect x={i * 5} y="0" width="5" height="64" className={s.selBar} />
        </svg>
        <div className={s.ticks}>
          {hours
            .map((x, j) => ({ x, j }))
            .filter(({ x }) => x.time.endsWith("T00:00"))
            .map(({ x, j }) => (
              <span key={j} style={{ left: `${(j / hours.length) * 100}%` }}>
                {new Date(`${x.time}:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                })}
              </span>
            ))}
        </div>
      </section>

      <section className={s.cards}>
        {cards.map((c, j) => (
          <article
            key={c.label}
            className={s.card}
            style={{
              ["--c" as string]: tones[c.lv.tone],
              ["--i" as string]: j,
            }}
          >
            <span className={s.cardLabel}>{c.label}</span>
            <b>
              {c.v} <small>{c.unit}</small>
            </b>
            <em>{c.lv.label}</em>
            <Spark vals={next(c.k)} color={tones[c.lv.tone]} />
          </article>
        ))}
      </section>

      <section className={s.parts}>
        <p className="eyebrow">What makes up the SWTI</p>
        {t.parts.map((p, j) => (
          <div key={p.key} className={s.part} style={{ ["--i" as string]: j }}>
            <span>{p.label}</span>
            <span className={s.partBar}>
              <i style={{ transform: `scaleX(${p.score / p.max})` }} />
            </span>
            <b>
              {p.score}/{p.max}
            </b>
          </div>
        ))}
      </section>

      <Chart
        hours={hours}
        sel={i}
        a={{ key: "cape", label: "CAPE", color: tones.peach }}
        b={{ key: "shear", label: "Shear", color: tones.sky }}
      />
      <Chart
        hours={hours}
        sel={i}
        a={{ key: "srh", label: "SRH", color: tones.rose }}
        b={{ key: "stp", label: "STP", color: tones.lavender }}
      />

      {data.models.length > 0 && (
        <section className={s.models}>
          <div className={s.stripHead}>
            <p className="eyebrow">Model CAPE this hour</p>
            {agree && (
              <span style={{ color: tones[agree.tone] }}>
                {agree.label} agreement
              </span>
            )}
          </div>
          {data.models.map((m, j) => (
            <div
              key={m.name}
              className={s.part}
              style={{ ["--i" as string]: j }}
            >
              <span>{m.name}</span>
              <span className={s.partBar}>
                <i style={{ transform: `scaleX(${m.cape / mMax})` }} />
              </span>
              <b>{Math.round(m.cape).toLocaleString()}</b>
            </div>
          ))}
        </section>
      )}
      <p className={s.muted}>
        Model data from NOAA, ECMWF, DWD and Environment Canada via Open-Meteo.
        SWTI and STP are simplified indices from the VIP dashboard, calculated
        from a handful of pressure levels — a guide, not an SPC product.
      </p>
    </div>
  );
}
