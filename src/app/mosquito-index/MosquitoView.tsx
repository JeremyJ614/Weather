"use client";

import { useState } from "react";
import {
  ChevronDown,
  CloudRain,
  Droplets,
  ExternalLink,
  Fan,
  Flame,
  House,
  Info,
  MapPin,
  Shirt,
  SprayCan,
  Thermometer,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { useWeather } from "@/features/weather/useWeather";
import {
  MOSQUITO_BANDS,
  mosquitoBand,
  mosquitoHours,
  type MosquitoHour,
} from "@/lib/air/mosquito";
import s from "./Mosquito.module.css";

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
const TIPS = [
  {
    Icon: SprayCan,
    tip: "EPA-registered repellent: DEET 20–30%, picaridin or IR3535.",
  },
  {
    Icon: Shirt,
    tip: "Long sleeves and long pants, above all at dawn and dusk.",
  },
  {
    Icon: Droplets,
    tip: "Empty standing water: flowerpots, bird baths, blocked gutters.",
  },
  {
    Icon: Fan,
    tip: "An outdoor fan works. They are weak fliers above about 1 mph.",
  },
  { Icon: Flame, tip: "Citronella helps a little, and only in still air." },
  { Icon: House, tip: "Keep window and door screens in good repair." },
];

/** 270° ring in the band colors with a glowing marker at the score. */
function Ring({ score }: { score: number }) {
  const b = mosquitoBand(score);
  const R = 88;
  const C = 2 * Math.PI * R;
  const span = 0.75;
  const deg = -135 + 270 * (score / 100);
  const bands = [...MOSQUITO_BANDS].reverse();
  return (
    <div className={s.ring} style={{ ["--band" as string]: b.color }}>
      <svg viewBox="0 0 220 220" aria-hidden>
        <g transform="rotate(135 110 110)">
          <circle
            cx="110"
            cy="110"
            r={R}
            className={s.rTrack}
            strokeDasharray={`${C * span} ${C}`}
          />
          {bands.map((x, i) => {
            const from = x.min / 100;
            const to = (bands[i + 1]?.min ?? 100) / 100;
            return (
              <circle
                key={x.label}
                cx="110"
                cy="110"
                r={R}
                stroke={x.color}
                className={s.rArc}
                strokeDasharray={`${C * span * (to - from) - (i < 4 ? 2 : 0)} ${C}`}
                strokeDashoffset={-C * span * from}
              />
            );
          })}
        </g>
        <g className={s.knob} style={{ ["--deg" as string]: `${deg}deg` }}>
          <circle cx="110" cy={110 - R} r="11" />
          <circle cx="110" cy={110 - R} r="4" className={s.knobDot} />
        </g>
      </svg>
      <div className={s.center}>
        <b>{score}</b>
        <span>Activity index</span>
      </div>
    </div>
  );
}

/** The next 24 hours at their clock angles; each spoke is as long as that hour scores. */
function Dial({ hours }: { hours: MosquitoHour[] }) {
  const peak = hours.reduce((a, b) => (b.score > a.score ? b : a), hours[0]);
  return (
    <div className={s.dial}>
      <svg viewBox="0 0 240 240" aria-hidden>
        <circle cx="120" cy="120" r="100" className={s.dRing} />
        <circle cx="120" cy="120" r="34" className={s.dCore} />
        {[0, 6, 12, 18].map((h) => {
          const a = ((h * 15 - 90) * Math.PI) / 180;
          return (
            <text
              key={h}
              x={120 + Math.cos(a) * 113}
              y={124 + Math.sin(a) * 113}
              className={s.dLabel}
            >
              {h === 0 ? "12a" : h === 12 ? "12p" : hourLabel(h)}
            </text>
          );
        })}
        {hours.map((h, i) => {
          const len = 8 + (h.score / 100) * 56;
          return (
            <g key={h.at} transform={`rotate(${h.hour * 15} 120 120)`}>
              <rect
                x="116.5"
                y={120 - 38 - len}
                width="7"
                height={len}
                rx="3.5"
                fill={mosquitoBand(h.score).color}
                className={`${s.spoke} ${i === 0 ? s.now : ""}`}
                style={{ ["--i" as string]: i }}
              />
            </g>
          );
        })}
      </svg>
      <div className={s.dCenter}>
        <span>Peak</span>
        <b>{hourLabel(peak.hour)}</b>
        <em style={{ color: mosquitoBand(peak.score).color }}>{peak.score}</em>
      </div>
    </div>
  );
}

export function MosquitoView() {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const { data: w, error, loading } = useWeather(active);
  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );
  if (!active) {
    return (
      <Card className="grid gap-3">
        <p className="text-sm text-muted">
          Set a place to see its mosquito forecast.
        </p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }
  const hours = w ? mosquitoHours(w.hourly.slice(0, 48), w.place.timeZone) : [];
  const now = hours[0];
  const band = now ? mosquitoBand(now.score) : null;
  const drivers = now
    ? [
        {
          key: "temp",
          label: "Warmth",
          value: now.parts.temp,
          max: 40,
          reading: `${now.tempF}°F`,
          Icon: Thermometer,
        },
        {
          key: "humidity",
          label: "Humidity",
          value: now.parts.humidity,
          max: 30,
          reading: `${now.rh}%`,
          Icon: Droplets,
        },
        {
          key: "water",
          label: "Rain & water",
          value: now.parts.water,
          max: 20,
          reading: `${w!.hourly[0].pop ?? 0}% rain chance`,
          Icon: CloudRain,
        },
        {
          key: "wind",
          label: "Calm air",
          value: now.parts.wind,
          max: 10,
          reading: `${now.wind} mph`,
          Icon: Wind,
        },
      ]
    : [];
  const limiting = drivers.length
    ? drivers.reduce((a, b) => (b.value / b.max < a.value / a.max ? b : a))
    : null;

  return (
    <div className="grid gap-4">
      <button onClick={() => setSheet(true)} className={s.place}>
        <MapPin aria-hidden /> {active.label}
        <ChevronDown aria-hidden />
      </button>
      <p className={s.note}>
        <Info aria-hidden /> Calculated from the forecast weather. It is not an
        official public-health product; check your local health department for
        disease activity.
      </p>
      {error && <Card className="text-sm text-muted">{error}</Card>}
      {loading && <div className={s.skeleton} aria-label="Loading" />}

      {now && band && (
        <>
          <section
            className={s.hero}
            style={{ ["--band" as string]: band.color }}
          >
            <Ring score={now.score} />
            <p className={s.band}>{band.label}</p>
            <p className={s.advice}>{band.advice}</p>
            <dl className={s.stats}>
              <div>
                <dt>Index</dt>
                <dd style={{ color: band.color }}>{now.score}</dd>
              </div>
              <div>
                <dt>Temp</dt>
                <dd>{now.tempF}°F</dd>
              </div>
              <div>
                <dt>Humidity</dt>
                <dd>{now.rh}%</dd>
              </div>
              <div>
                <dt>Wind</dt>
                <dd>{now.wind} mph</dd>
              </div>
            </dl>
          </section>

          <section className={s.card}>
            <h3 className={s.h3}>When they bite · next 24 hours</h3>
            <Dial hours={hours.slice(0, 24)} />
            <p className={s.caption}>
              Mosquitoes feed most at dawn and dusk; each spoke is one hour,
              placed where it falls on the clock.
            </p>
          </section>

          <section className={s.card}>
            <h3 className={s.h3}>What is driving it right now</h3>
            <div className={s.drivers}>
              {drivers.map((d, i) => {
                const neg = d.value < 0;
                return (
                  <div
                    key={d.key}
                    className={s.driver}
                    style={{ ["--d" as string]: i }}
                  >
                    <d.Icon aria-hidden />
                    <div>
                      <p className={s.dTop}>
                        <b>{d.label}</b>
                        <span>{d.reading}</span>
                      </p>
                      <span className={s.track}>
                        <i
                          className={neg ? s.neg : undefined}
                          style={{
                            transform: `scaleX(${Math.min(1, Math.abs(d.value) / d.max)})`,
                          }}
                        />
                      </span>
                      <p className={s.dFoot}>
                        {neg ? "−" : "+"}
                        {Math.abs(Math.round(d.value))} of {d.max}
                        {limiting?.key === d.key && <em>holding it down</em>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={s.card}>
            <h3 className={s.h3}>48-hour activity</h3>
            <div className={s.bars} aria-hidden>
              {hours.map((h, i) => (
                <i
                  key={h.at}
                  style={{
                    background: mosquitoBand(h.score).color,
                    transform: `scaleY(${Math.max(0.04, h.score / 100)})`,
                    animationDelay: `${i * 15}ms`,
                  }}
                />
              ))}
            </div>
            <div className={s.axis}>
              <span>Now</span>
              <span>{hours[24] ? hourLabel(hours[24].hour) : ""}</span>
              <span>{hourLabel(hours.at(-1)!.hour)}</span>
            </div>
          </section>

          <section className={s.scale}>
            {[...MOSQUITO_BANDS].reverse().map((b, i, a) => (
              <div
                key={b.label}
                className={b.label === band.label ? s.on : undefined}
                style={{ ["--band" as string]: b.color }}
              >
                <b>
                  {b.min}–{a[i + 1]?.min ?? 100}
                </b>
                <span>{b.label}</span>
              </div>
            ))}
          </section>

          <section className={s.card}>
            <h3 className={s.h3}>Protect yourself</h3>
            <ul className={s.tips}>
              {TIPS.map(({ Icon, tip }) => (
                <li key={tip}>
                  <Icon aria-hidden />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
            <div className={s.links}>
              <a
                href="https://www.epa.gov/insect-repellents/find-repellent-right-you"
                target="_blank"
                rel="noreferrer"
              >
                EPA repellent finder <ExternalLink aria-hidden />
              </a>
              <a
                href="https://www.cdc.gov/mosquitoes/"
                target="_blank"
                rel="noreferrer"
              >
                CDC mosquito guide <ExternalLink aria-hidden />
              </a>
              <a
                href="https://www.cdc.gov/west-nile-virus/"
                target="_blank"
                rel="noreferrer"
              >
                West Nile virus <ExternalLink aria-hidden />
              </a>
            </div>
          </section>
        </>
      )}
      {sheetEl}
    </div>
  );
}
