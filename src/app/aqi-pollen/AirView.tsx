"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { HomeTabs } from "@/features/news/HomeTabs";
import type { AirReport } from "@/lib/air/air";
import { aqiBand, inSeason } from "@/lib/air/scales";

const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
const hour = (iso: string, timeZone?: string) =>
  new Date(iso)
    .toLocaleTimeString("en-US", { hour: "numeric", timeZone })
    .replace(" ", "")
    .toLowerCase();

/** Half-circle AQI gauge; the needle angle is a transform. */
function Gauge({ value }: { value: number }) {
  const b = aqiBand(value);
  const angle = -90 + (Math.min(value, 300) / 300) * 180;
  return (
    <svg
      viewBox="0 0 200 120"
      className="mx-auto w-56"
      role="img"
      aria-label={`AQI ${value}, ${b.label}`}
    >
      {[50, 100, 150, 200, 300].map((max, i, a) => {
        const from = (i ? a[i - 1] : 0) / 300;
        const to = max / 300;
        const p = (f: number) => [
          100 - 80 * Math.cos(Math.PI * f),
          100 - 80 * Math.sin(Math.PI * f),
        ];
        const [x1, y1] = p(from);
        const [x2, y2] = p(to);
        return (
          <path
            key={max}
            d={`M${x1},${y1} A80,80 0 0,1 ${x2},${y2}`}
            stroke={aqiBand(max).color}
            strokeWidth={14}
            fill="none"
            opacity={0.85}
          />
        );
      })}
      <g
        style={{
          transform: `rotate(${angle}deg)`,
          transformOrigin: "100px 100px",
          transition: "transform .8s var(--spring)",
        }}
      >
        <line
          x1={100}
          y1={100}
          x2={100}
          y2={34}
          stroke="var(--text)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      <circle cx={100} cy={100} r={6} fill="var(--text)" />
      <text
        x={100}
        y={118}
        textAnchor="middle"
        fontSize={11}
        fill="var(--muted)"
      >
        0 · 300+
      </text>
    </svg>
  );
}

function AqiPanel({ a }: { a: AirReport["aqi"] }) {
  if (!a || a.now == null)
    return (
      <Card className="text-muted">
        Air quality isn&apos;t available here right now.
      </Card>
    );
  const b = aqiBand(a.now);
  return (
    <div className="grid gap-3">
      <Card className="grid gap-2 text-center">
        <Gauge value={a.now} />
        <p className="display text-5xl" style={{ color: b.color }}>
          {a.now}
        </p>
        <p className="font-bold">{b.label}</p>
        <p className="text-sm text-muted">{b.advice}</p>
        {a.pollutant && (
          <p className="text-xs text-muted">Main pollutant: {a.pollutant}</p>
        )}
      </Card>
      {a.days.length > 0 && (
        <Card className="grid gap-2">
          <h2 className="text-xs font-bold tracking-wider text-muted uppercase">
            Outlook (daily worst)
          </h2>
          <ul className="grid grid-cols-4 gap-2 text-center">
            {a.days.slice(0, 4).map((d) => (
              <li
                key={d.date}
                className="rounded-xl border border-line bg-bg p-2"
              >
                <p className="text-xs text-muted">{day(d.date)}</p>
                <p
                  className="text-lg font-bold"
                  style={{ color: aqiBand(d.aqi).color }}
                >
                  {d.aqi}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-muted">
        Source:{" "}
        {a.source === "AirNow"
          ? "EPA AirNow"
          : "Open-Meteo (CAMS) air-quality forecast"}{" "}
        · US EPA AQI scale.
      </p>
    </div>
  );
}

function PollenPanel({ p }: { p: AirReport["pollen"] }) {
  const season = inSeason(new Date().getMonth() + 1);
  if (!p)
    return (
      <Card className="text-muted">
        Pollen information isn&apos;t available here right now.
      </Card>
    );
  return (
    <div className="grid gap-3">
      {p.kind === "counts" ? (
        p.days.slice(0, 3).map((d) => (
          <Card key={d.date} className="grid gap-2">
            <h2 className="text-xs font-bold tracking-wider text-muted uppercase">
              {day(d.date)}
            </h2>
            {d.types.map((t) => (
              <div
                key={t.label}
                className="grid grid-cols-[5rem_1fr_auto] items-center gap-2 text-sm"
              >
                <span>{t.label}</span>
                <span className="h-2 rounded-full bg-bg">
                  <span
                    className="block h-2 origin-left rounded-full bg-accent"
                    style={{ transform: `scaleX(${t.index / 5})` }}
                  />
                </span>
                <span className="text-muted">{t.category}</span>
              </div>
            ))}
          </Card>
        ))
      ) : (
        <Card className="grid gap-3">
          <p className="text-xs text-muted">
            Pollen <b className="text-text">dispersal conditions</b>: how
            warmth, dry air and wind spread pollen, and how rain clears it. This
            is not a pollen count.
          </p>
          {p.peak && (
            <p>
              Worst stretch: <b className="text-accent">{p.peak.band}</b> around{" "}
              {hour(p.peak.at, p.timeZone)}
            </p>
          )}
          <div
            className="flex h-24 items-end gap-0.5"
            role="img"
            aria-label="Dispersal for the next 24 hours"
          >
            {p.hours.map((h) => (
              <span
                key={h.at}
                className="flex-1 origin-bottom rounded-t bg-accent"
                style={{
                  height: "100%",
                  transform: `scaleY(${Math.max(h.score, 3) / 100})`,
                  opacity: 0.35 + h.score / 160,
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{p.hours[0] && hour(p.hours[0].at, p.timeZone)}</span>
            <span>
              {p.hours.at(-1) && hour(p.hours.at(-1)!.at, p.timeZone)}
            </span>
          </div>
        </Card>
      )}
      {season.length > 0 && (
        <Card className="grid gap-1.5">
          <h2 className="text-xs font-bold tracking-wider text-muted uppercase">
            Typically in season now
          </h2>
          {season.map((s) => (
            <p key={s.label} className="text-sm">
              <b className="text-accent">{s.label}:</b>{" "}
              <span className="text-muted">{s.note}</span>
            </p>
          ))}
        </Card>
      )}
      <p className="text-xs text-muted">
        {p.kind === "counts"
          ? "Source: Google Pollen API (Universal Pollen Index)."
          : "Computed from the NWS hourly forecast with the VIP dispersal model."}
      </p>
    </div>
  );
}

export function AirView() {
  const { active } = usePlaces();
  const [sheet, setSheet] = useState(false);
  const [res, setRes] = useState<{
    key: string;
    data?: AirReport;
    error?: string;
  } | null>(null);
  const key = active?.id ?? "";
  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    fetch(`/api/air?lat=${active.lat}&lon=${active.lon}`, {
      signal: ctl.signal,
    })
      .then(async (r) =>
        r.ok
          ? setRes({ key, data: await r.json() })
          : setRes({ key, error: "Unavailable right now." }),
      )
      .catch(
        (e: Error) =>
          e.name !== "AbortError" &&
          setRes({ key, error: "Unavailable right now." }),
      );
    return () => ctl.abort();
  }, [active, key]);
  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );
  if (!active) {
    return (
      <Card className="grid gap-3">
        <p className="text-muted">
          Set a place to see its air quality and pollen.
        </p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }
  const cur = res?.key === key ? res : null;
  return (
    <div className="grid gap-4">
      <button
        onClick={() => setSheet(true)}
        className="flex items-center gap-2 justify-self-start font-bold text-accent"
      >
        <MapPin className="size-4" aria-hidden /> {active.label}
      </button>
      {!cur && (
        <div
          className="h-72 animate-pulse rounded-2xl bg-surface"
          aria-label="Loading"
        />
      )}
      {cur?.error && <Card className="text-muted">{cur.error}</Card>}
      {cur?.data && (
        <HomeTabs
          tabs={[
            {
              id: "aqi",
              label: "Air quality",
              panel: <AqiPanel a={cur.data.aqi} />,
            },
            {
              id: "pollen",
              label: "Pollen",
              panel: <PollenPanel p={cur.data.pollen} />,
            },
          ]}
        />
      )}
      {sheetEl}
    </div>
  );
}
