"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { flushSync } from "react-dom";
import {
  CalendarRange,
  Crosshair,
  ExternalLink,
  Gauge,
  LayoutGrid,
  ShieldAlert,
  Tornado,
  Trophy,
} from "lucide-react";
import { UsMap } from "@/features/maps/UsMap";
import { Polys, useLayer } from "@/features/maps/useLayer";
import { slideIn } from "@/features/news/HomeTabs";
import { project } from "@/lib/map/usAlbers";
import { pick, type Colors } from "@/lib/colors/pick";
import type { ChaseDay, Target } from "@/lib/chase/engine";
import {
  BANDS,
  BUST_STEPS,
  CAT_NAMES,
  CHASE_ALT,
  bandIndex,
  bustStep,
  plainNote,
  yearRank,
} from "@/lib/chase/score";
import { OverviewPanel, type Ledger } from "./ChaseParts";
import s from "./Chase.module.css";

export type { Ledger };

const loading = () => <p className={s.small}>Loading…</p>;
const ParamsPanel = dynamic(
  () => import("./ChasePanels").then((m) => m.ParamsPanel),
  { ssr: false, loading },
);
const ModePanel = dynamic(
  () => import("./ChasePanels").then((m) => m.ModePanel),
  { ssr: false, loading },
);
const BustPanel = dynamic(
  () => import("./ChasePanels").then((m) => m.BustPanel),
  { ssr: false, loading },
);
const YearlyPanel = dynamic(
  () => import("./ChasePanels").then((m) => m.YearlyPanel),
  { ssr: false, loading },
);

/** Counts up to `to` once (immediately under reduced motion). */
function CountUp({ to, digits = 1 }: { to: number; digits?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const dur = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 1100;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      setV(to * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v.toFixed(digits)}</>;
}

/** Storm Chasing Outlook in VIP's structure: score, targets map, then five tabs. */
export function ChaseView({
  day,
  ledger,
  colors,
}: {
  day: ChaseDay;
  ledger: Ledger;
  colors: Colors;
}) {
  const band = (score: number) =>
    pick(
      colors,
      `chase:band:${bandIndex(score)}`,
      BANDS[bandIndex(score)].color,
    );
  const alt = pick(colors, "chase:alt", CHASE_ALT);
  const spc = useLayer("spc1");
  const [t1, t2] = day.targets;
  if (!t1)
    return (
      <p className={s.empty}>
        No candidate scored today. Check back after SPC&apos;s next outlook.
      </p>
    );
  const tone = (t: Target) => (t.rank === 1 ? band(t.score) : alt);
  const notes = day.targets.map((t, i) => day.desk?.targets[i] ?? plainNote(t));
  const others = ledger.filter((l) => l.day !== day.day);
  const rank = yearRank(
    t1.score,
    others.map((l) => l.top_score),
  );
  const segs = 60;
  const lit = Math.round((t1.score / 100) * segs);
  const summary =
    day.desk?.summary ??
    (day.quiet
      ? `A quiet day: no SPC marginal risk or higher. The best of the usual chase country is ${t1.place}.`
      : `${t1.mode.mode}: ${t1.place.replace(/^near /, "around ")}${t2 ? `, with a second option ${t2.place.replace(/^near /, "around ")}` : ""}.`);

  return (
    <div className={s.page} style={{ ["--c" as string]: band(t1.score) }}>
      <section className={s.hero} aria-label="Today's chase potential">
        <span className={s.heroGlow} aria-hidden />
        <p className={s.date}>
          <CalendarRange aria-hidden />
          {new Date(`${day.day}T12:00:00Z`).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
          })}
          <i aria-hidden />
          SPC {CAT_NAMES[day.spcTop]}
        </p>
        <div className={s.ring}>
          <svg viewBox="0 0 220 220" aria-hidden>
            {Array.from({ length: segs }, (_, i) => (
              <line
                key={i}
                x1="110"
                y1="8"
                x2="110"
                y2={i % 5 ? "20" : "24"}
                className={s.seg}
                data-on={i < lit || undefined}
                style={{ ["--i" as string]: i }}
                transform={`rotate(${(i * 360) / segs} 110 110)`}
              />
            ))}
          </svg>
          <span className={s.sweep} aria-hidden />
          <div className={s.ringNum}>
            <b>
              <CountUp to={t1.score / 10} />
            </b>
            <span>out of 10</span>
          </div>
        </div>
        <small className={s.kicker}>Today&apos;s chase potential</small>
        <h2 className={s.bandName}>{BANDS[bandIndex(t1.score)].label}</h2>
        <p className={s.summary}>{summary}</p>
        <div className={s.heroStats}>
          {[
            ["Best target", t1.place.replace(/^near /, "")],
            [
              "Bust risk",
              `${t1.bust.pct}% · ${BUST_STEPS[bustStep(t1.bust.pct)]}`,
            ],
            ["This year", `${rank} of 5`],
          ].map(([k, v], i) => (
            <div key={k} style={{ ["--i" as string]: i }}>
              <small>{k}</small>
              <b title={v}>{v}</b>
            </div>
          ))}
        </div>
      </section>

      <section className={s.mapCard}>
        <header className={s.mapHead}>
          <h3>
            <Crosshair aria-hidden /> Today&apos;s targets
          </h3>
          <span>
            <i style={{ background: spc.layer?.legend.at(-1)?.color }} />
            {day.candidates} points scored
          </span>
        </header>
        <UsMap
          title="Today's chase targets"
          sub={null}
          legend={day.targets.map((x) => ({
            label: x.rank === 1 ? "Best target" : "Alternative",
            color: tone(x),
          }))}
          status={spc.status === "loading" ? "loading" : "ready"}
          file="sswx-chase-targets"
          actions={false}
          overlay={
            <g>
              {t2 &&
                (() => {
                  const a = project(t1.lon, t1.lat);
                  const b = project(t2.lon, t2.lat);
                  return (
                    <line
                      className={s.link}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="var(--text)"
                      strokeOpacity={0.45}
                      strokeWidth={1.5}
                      strokeDasharray="4 5"
                    />
                  );
                })()}
              {[...day.targets].reverse().map((x) => {
                const p = project(x.lon, x.lat);
                const c = tone(x);
                const w = x.place.length * 6.8 + 12;
                return (
                  <g
                    key={x.rank}
                    transform={`translate(${p.x} ${p.y}) scale(1.8)`}
                  >
                    <circle
                      r={14}
                      fill="none"
                      stroke={c}
                      strokeWidth={2}
                      className={s.pulse}
                    />
                    <g
                      className={s.pin}
                      style={{
                        ["--d" as string]: x.rank === 1 ? "550ms" : "350ms",
                      }}
                    >
                      <circle r={20} fill={c} opacity={0.18} />
                      <circle
                        r={8}
                        fill="var(--bg)"
                        stroke={c}
                        strokeWidth={3}
                      />
                      <circle r={3} fill={c} />
                      <g transform="translate(0 24)">
                        <rect
                          x={-w / 2}
                          y={-9}
                          width={w}
                          height={18}
                          rx={5}
                          fill="var(--bg)"
                          stroke={c}
                          strokeWidth={1}
                        />
                        <text
                          y={4}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill="var(--text)"
                        >
                          {x.place}
                        </text>
                      </g>
                    </g>
                  </g>
                );
              })}
            </g>
          }
        >
          {spc.layer && <Polys polys={spc.layer.polys} />}
        </UsMap>
        <p className={s.small}>
          Shaded by SPC&apos;s Day 1 outlook. The two targets are held at least
          250 km apart, so they&apos;re two chases, not one.
        </p>
      </section>

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            icon: <LayoutGrid aria-hidden />,
            panel: <OverviewPanel day={day} tone={tone} />,
          },
          {
            id: "params",
            label: "Parameters",
            icon: <Gauge aria-hidden />,
            panel: <ParamsPanel targets={day.targets} tone={tone} />,
          },
          {
            id: "mode",
            label: "Storm Mode",
            icon: <Tornado aria-hidden />,
            panel: (
              <ModePanel targets={day.targets} notes={notes} tone={tone} />
            ),
          },
          {
            id: "bust",
            label: "Bust Probability",
            icon: <ShieldAlert aria-hidden />,
            panel: <BustPanel targets={day.targets} notes={notes} />,
          },
          {
            id: "yearly",
            label: "Yearly",
            icon: <Trophy aria-hidden />,
            panel: (
              <YearlyPanel
                ledger={ledger}
                today={day.day}
                score={t1.score}
                rank={rank}
                band={band}
              />
            ),
          },
        ]}
      />

      <details className={s.more}>
        <summary>
          <ExternalLink aria-hidden /> Chaser resources
        </summary>
        <ul className={s.resources}>
          {RESOURCES.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.label}
              </a>
              <span>{r.desc}</span>
            </li>
          ))}
        </ul>
      </details>
      <p className={s.foot}>
        This is decision support, not a substitute for official SPC outlooks,
        watches and warnings. Targets are computed from model data and can be
        wrong; the bust probability on every target exists because sometimes
        they are. Chase safe, chase with a partner, and never let a forecast
        talk you into a road you can&apos;t see the end of.
      </p>
    </div>
  );
}

/** The five-tab dock: a glowing frame slides to the open tab; each panel slides in. */
function Tabs({
  tabs,
}: {
  tabs: { id: string; label: string; icon: ReactNode; panel: ReactNode }[];
}) {
  const [on, setOn] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const wrap = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const open = (i: number) => {
    if (i === on) return;
    flushSync(() => {
      setOn(i);
      setSeen((x) => new Set(x).add(i));
    });
    slideIn(wrap.current?.children[i], i > on ? 1 : -1);
  };
  const key = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const i = (on + d + tabs.length) % tabs.length;
    open(i);
    bar.current?.querySelectorAll("button")[i]?.focus();
  };
  return (
    <div className="grid gap-3">
      <div
        ref={bar}
        role="tablist"
        aria-label="Storm chasing outlook"
        className={s.dock}
        style={{ ["--n" as string]: tabs.length }}
        onKeyDown={key}
      >
        <span
          className={s.dockGlow}
          style={{ transform: `translateX(${on * 100}%)` }}
          aria-hidden
        />
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            id={`chase-tab-${t.id}`}
            aria-selected={i === on}
            aria-controls={`chase-panel-${t.id}`}
            tabIndex={i === on ? 0 : -1}
            onClick={() => open(i)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div ref={wrap}>
        {tabs.map((t, i) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`chase-panel-${t.id}`}
            aria-labelledby={`chase-tab-${t.id}`}
            hidden={i !== on}
          >
            {seen.has(i) ? t.panel : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const RESOURCES = [
  {
    label: "SPC Mesoanalysis",
    url: "https://www.spc.noaa.gov/exper/mesoanalysis/",
    desc: "Live CAPE, shear and composite parameters, hour by hour.",
  },
  {
    label: "SPC Day 1 Outlook",
    url: "https://www.spc.noaa.gov/products/outlook/day1otlk.html",
    desc: "The official risk areas and discussion.",
  },
  {
    label: "Pivotal Weather",
    url: "https://www.pivotalweather.com/model.php",
    desc: "Model soundings and convection-allowing models.",
  },
  {
    label: "NWS Radar",
    url: "https://radar.weather.gov/",
    desc: "Single-site radar for the storm in front of you.",
  },
  {
    label: "Spotter Network",
    url: "https://www.spotternetwork.org/",
    desc: "Report what you see; position reports for chasers.",
  },
];
