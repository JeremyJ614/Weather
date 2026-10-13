"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  EyeOff,
  MapPin,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { WeatherIcon } from "@/features/weather/WeatherIcon";
import { moonPhase, sunTimes } from "@/lib/weather/astro";
import { SPC_NAMES, uvLabel } from "@/lib/weather/conditions-math";
import type { Conditions } from "@/lib/weather/conditions";
import type { WeatherBundle } from "@/lib/weather/types";
import { HourlyChart } from "./HourlyChart";
import {
  DEFAULT_LAYOUT,
  WIDGETS,
  move,
  readLayout,
  subscribeLayout,
  toggle,
  writeLayout,
  type WidgetId,
} from "./layout";

type Data = {
  key: string;
  weather?: WeatherBundle;
  cond?: Conditions;
  error?: string;
};
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const dash = "–";

function Big({ value, sub }: { value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <p className="display text-4xl leading-none">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Dashboard() {
  const { active } = usePlaces();
  const layout = useSyncExternalStore(
    subscribeLayout,
    readLayout,
    () => DEFAULT_LAYOUT,
  );
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const key = active ? `${active.id}#${retry}` : "";

  useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    const q = `lat=${active.lat}&lon=${active.lon}`;
    const json = (u: string) =>
      fetch(u, { signal: ctl.signal }).then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? "Weather data is unavailable");
        return b;
      });
    Promise.all([json(`/api/weather?${q}`), json(`/api/conditions?${q}`)])
      .then(([weather, cond]) => setData({ key, weather, cond }))
      .catch(
        (e: Error) =>
          e.name !== "AbortError" && setData({ key, error: e.message }),
      );
    return () => ctl.abort();
  }, [active, key]);

  const sheetEl = (
    <LocationSheet open={sheet} onClose={() => setSheet(false)} />
  );
  if (!active) {
    return (
      <Card className="grid gap-3">
        <h2 className="display text-2xl text-accent">Your dashboard</h2>
        <p className="text-muted">
          Add your location or a ZIP code to fill your dashboard.
        </p>
        <Button variant="primary" onClick={() => setSheet(true)}>
          <MapPin className="size-4" aria-hidden /> Set location
        </Button>
        {sheetEl}
      </Card>
    );
  }

  const cur = data?.key === key ? data : null;
  const w = cur?.weather;
  const c = cur?.cond;
  const tz = w?.place.timeZone ?? "America/Chicago";
  const time = (d: Date | null) =>
    d
      ? d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        })
      : dash;
  const now = new Date();
  // The place's calendar date (US evenings are already tomorrow in UTC).
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(
    now,
  );
  const sun = sunTimes(
    active.lat,
    active.lon,
    new Date(`${localDate}T12:00:00Z`),
  );
  const moon = moonPhase(now);

  const body: Record<WidgetId, ReactNode> = {
    now: w && (
      <div className="flex items-center gap-4">
        <WeatherIcon
          short={w.hourly[0]?.short ?? ""}
          isDay={w.hourly[0]?.isDay ?? true}
          className="size-12 text-accent"
        />
        <Big
          value={`${c?.tempF ?? w.hourly[0]?.temp ?? dash}°`}
          sub={w.hourly[0]?.short}
        />
      </div>
    ),
    hourly: w && <HourlyChart hours={w.hourly} timeZone={tz} />,
    week: w && (
      <ol className="grid gap-1.5">
        {w.daily
          .filter((p) => p.isDay)
          .slice(0, 7)
          .map((d) => {
            const night = w.daily.find(
              (n) => !n.isDay && Date.parse(n.start) > Date.parse(d.start),
            );
            return (
              <li
                key={d.start}
                className="grid grid-cols-[5.5rem_1.5rem_1fr_auto] items-center gap-2 text-sm"
              >
                <span className="font-bold">
                  {d.name.replace(" Night", "").slice(0, 9)}
                </span>
                <WeatherIcon
                  short={d.short}
                  isDay
                  className="size-5 text-accent"
                />
                <span className="truncate text-muted">{d.short}</span>
                <span className="font-bold">
                  {d.temp}°{" "}
                  <span className="font-normal text-muted">
                    / {night?.temp ?? dash}°
                  </span>
                </span>
              </li>
            );
          })}
      </ol>
    ),
    spc: cur && (
      <Big
        value={c?.spc ?? "None"}
        sub={c?.spc ? SPC_NAMES[c.spc] : "No severe or thunderstorm risk today"}
      />
    ),
    uv:
      cur &&
      (c?.uv ? (
        <Big
          value={c.uv.now}
          sub={`${uvLabel(c.uv.now)} · today's peak ${c.uv.max}`}
        />
      ) : (
        <p className="text-sm text-muted">No EPA UV forecast for this place.</p>
      )),
    sun: (
      <Big
        value={
          <span className="text-3xl">
            {time(sun.rise)} – {time(sun.set)}
          </span>
        }
        sub={`${Math.floor(sun.dayMinutes / 60)} h ${Math.round(sun.dayMinutes % 60)} min of daylight`}
      />
    ),
    moon: (
      <Big
        value={<span className="text-3xl">{moon.name}</span>}
        sub={`${Math.round(moon.illumination * 100)}% lit · full in ${Math.round(moon.daysToFull)} days`}
      />
    ),
    wind: cur && (
      <Big
        value={`${c?.windMph ?? dash} mph`}
        sub={
          [
            c?.windDir != null
              ? `from the ${COMPASS[Math.round(c.windDir / 45) % 8]}`
              : null,
            c?.gustMph ? `gusts ${c.gustMph} mph` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Calm"
        }
      />
    ),
    pressure: cur && (
      <Big
        value={c?.pressureMb ? `${c.pressureMb} mb` : dash}
        sub={
          c?.trend
            ? `${c.trend.trend[0].toUpperCase()}${c.trend.trend.slice(1)} (${c.trend.change > 0 ? "+" : ""}${c.trend.change} mb in 3 h)`
            : "Trend unavailable"
        }
      />
    ),
    feels: cur && (
      <Big
        value={`${c?.feelsF ?? dash}°`}
        sub={`Actual ${c?.tempF ?? dash}°`}
      />
    ),
    dew: cur && (
      <Big value={`${c?.dewF ?? dash}°`} sub={`Humidity ${c?.rh ?? dash}%`} />
    ),
  };

  const visible = layout.order.filter((id) => !layout.hidden.includes(id));
  const title = (id: WidgetId) => WIDGETS.find((x) => x.id === id)!.title;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setSheet(true)}
          className="flex items-center gap-2 font-bold text-accent"
          aria-label={`Location: ${active.label}. Change`}
        >
          <MapPin className="size-4" aria-hidden /> {active.label}{" "}
          <ChevronDown className="size-4 text-muted" aria-hidden />
        </button>
        <Button
          variant={editing ? "primary" : "secondary"}
          onClick={() => setEditing(!editing)}
        >
          <Settings2 className="size-4" aria-hidden />{" "}
          {editing ? "Done" : "Arrange"}
        </Button>
      </div>
      {cur?.error && (
        <Card className="grid gap-2">
          <p className="text-muted">{cur.error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>Try again</Button>
        </Card>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((id, i) => (
          <li
            key={id}
            className={id === "hourly" || id === "week" ? "sm:col-span-2" : ""}
          >
            <Card className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold tracking-wider text-muted uppercase">
                  {title(id)}
                </h2>
                {editing && (
                  <span className="flex gap-1">
                    <button
                      aria-label={`Move ${title(id)} up`}
                      disabled={i === 0}
                      onClick={() => writeLayout(move(layout, id, -1))}
                      className="grid size-8 place-items-center rounded-lg border border-line text-accent disabled:opacity-30"
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                    <button
                      aria-label={`Move ${title(id)} down`}
                      disabled={i === visible.length - 1}
                      onClick={() => writeLayout(move(layout, id, 1))}
                      className="grid size-8 place-items-center rounded-lg border border-line text-accent disabled:opacity-30"
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                    <button
                      aria-label={`Hide ${title(id)}`}
                      onClick={() => writeLayout(toggle(layout, id))}
                      className="grid size-8 place-items-center rounded-lg border border-line text-accent"
                    >
                      <EyeOff className="size-4" aria-hidden />
                    </button>
                  </span>
                )}
              </div>
              {body[id] ?? (
                <div
                  className="h-16 animate-pulse rounded-xl bg-surface2"
                  aria-label="Loading"
                />
              )}
            </Card>
          </li>
        ))}
      </ul>
      {editing && layout.hidden.length > 0 && (
        <Card className="grid gap-2">
          <h2 className="text-sm font-bold">Hidden widgets</h2>
          <div className="flex flex-wrap gap-2">
            {layout.hidden.map((id) => (
              <Button key={id} onClick={() => writeLayout(toggle(layout, id))}>
                <Eye className="size-4" aria-hidden /> {title(id)}
              </Button>
            ))}
          </div>
        </Card>
      )}
      {w && (
        <p className="mono text-xs text-muted">
          NWS {w.place.office}
          {c?.station ? ` · station ${c.station}` : ""} · SPC Day 1 · EPA UV
        </p>
      )}
      {sheetEl}
    </div>
  );
}
