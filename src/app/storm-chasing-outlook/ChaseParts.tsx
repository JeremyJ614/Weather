"use client";

import {
  Brain,
  ChevronRight,
  Clock,
  Navigation,
  Sun,
  TriangleAlert,
} from "lucide-react";
import type { ChaseDay, Target } from "@/lib/chase/engine";
import { CAT_NAMES } from "@/lib/chase/score";
import s from "./Chase.module.css";

export type Ledger = {
  day: string;
  top_score: number;
  spc_cat: string | null;
  tornado_pct: number;
  place: string | null;
  generated_at?: string;
}[];

export type Tone = (t: Target) => string;
export const ct = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      }) + " CT"
    : "–";
export const COMPASS =
  "N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW".split(" ");
export const toward = (deg: number) => COMPASS[Math.round(deg / 22.5) % 16];
export const ten = (n: number) => (n / 10).toFixed(1);
export const fmt = (v: number) =>
  Math.abs(v) >= 1000
    ? Math.round(v).toLocaleString("en-US")
    : String(Math.round(v * 100) / 100);
export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export const tv = (c: string) => ({ ["--t" as string]: c });

export function Desk({
  text,
  label = "SSWX Forecast Desk",
}: {
  text: string;
  label?: string;
}) {
  return (
    <section className={s.desk}>
      <small>
        <Brain aria-hidden /> {label}
      </small>
      <p>{text}</p>
    </section>
  );
}

export function Head({
  t,
  c,
  children,
}: {
  t: Target;
  c: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={s.cardHead}>
      <span className={s.rank}>{t.rank}</span>
      <div>
        <small>Target {t.rank}</small>
        <h3>{t.place}</h3>
      </div>
      {children ?? (
        <div className={s.score} style={tv(c)}>
          <b>{ten(t.score)}</b>
          <span>score</span>
        </div>
      )}
    </header>
  );
}

export function OverviewPanel({ day, tone }: { day: ChaseDay; tone: Tone }) {
  return (
    <div className={s.panel}>
      {day.targets.map((t) => {
        const c = tone(t);
        return (
          <article key={t.rank} className={s.card} style={tv(c)}>
            <Head t={t} c={c} />
            <div className={s.meta}>
              <span>SPC {CAT_NAMES[t.spc.cat]}</span>
              <span>
                <Clock aria-hidden /> peak {ct(t.peak)}
              </span>
              <span>
                <Sun aria-hidden />
                {t.hoursToSunset > 0
                  ? `${t.hoursToSunset} h of light after`
                  : "after dark"}
              </span>
            </div>
            <ul className={s.why}>
              {t.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className={s.chips}>
              <span>
                CAPE <b>{t.hour.cape.toLocaleString("en-US")}</b> J/kg
              </span>
              <span>
                Shear <b>{t.hour.shear}</b> kt
              </span>
              <span>
                Helicity <b>{t.hour.srh}</b> m²/s²
              </span>
              <span>
                STP <b>{t.hour.stp}</b>
              </span>
              <span>
                Tornado <b>{t.spc.torn}%</b>
              </span>
            </div>
            <a
              className={s.go}
              href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lon}`}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation aria-hidden /> Directions to the target
            </a>
          </article>
        );
      })}
      {!!day.desk?.tips?.length && (
        <section className={s.card}>
          <h4 className={s.h4}>
            <ChevronRight aria-hidden /> If you&apos;re going
          </h4>
          <ul className={s.tips}>
            {day.desk.tips.map((x) => (
              <li key={x}>
                <ChevronRight aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </section>
      )}
      {day.desk?.safety && (
        <p className={s.safety}>
          <TriangleAlert aria-hidden />
          <span>
            <b>Safety</b>
            {day.desk.safety}
          </span>
        </p>
      )}
      <p className={s.how}>
        <b>How these were found.</b>{" "}
        {day.quiet
          ? "SPC has no marginal risk or higher out, so the scan ran over the towns chasers usually watch."
          : "Points every degree of latitude and longitude inside SPC's risk areas were scanned."}{" "}
        {day.candidates} returned a usable afternoon at{" "}
        {day.backfill ? "archived model runs" : "the latest model run"}, and
        every afternoon hour at each was scored on instability, shear, spin,
        SPC&apos;s own odds, the cap, cloud bases and daylight.{" "}
        {day.desk
          ? "The forecast desk wrote the notes from those numbers; it chose among the computed targets and never placed them itself."
          : "These notes are written straight from the numbers."}
      </p>
    </div>
  );
}
