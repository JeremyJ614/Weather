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
  CalendarDays,
  ChevronDown,
  Clock,
  CloudSun,
  Droplets,
  Eye,
  EyeOff,
  Flower2,
  Gauge as GaugeIcon,
  Leaf,
  MapPin,
  Moon,
  Settings2,
  SunMedium,
  Sunrise,
  Thermometer,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LocationSheet } from "@/features/location/LocationSheet";
import { usePlaces } from "@/features/location/usePlaces";
import { moonPhase, sunTimes } from "@/lib/weather/astro";
import { SPC_NAMES, uvLabel } from "@/lib/weather/conditions-math";
import type { Conditions } from "@/lib/weather/conditions";
import type { WeatherBundle } from "@/lib/weather/types";
import type { AirReport } from "@/lib/air/air";
import { aqiBand } from "@/lib/air/scales";
import { HourlyChart } from "./HourlyChart";
import { CountUp } from "./widgets/CountUp";
import { Gauge } from "./widgets/Gauge";
import { Scene } from "./widgets/Scene";
import {
  Comfort,
  Compass,
  MoonDisc,
  SunArc,
  Thermo,
  WeekRanges,
} from "./widgets/Visuals";
import s from "./Dashboard.module.css";
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
  air?: AirReport;
  error?: string;
};
const dash = "–";
const SPC_LEVELS = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];

/** Each widget's icon and the light it glows with. */
const LOOK: Record<WidgetId, { icon: LucideIcon; tint: string }> = {
  now: { icon: CloudSun, tint: "var(--accent)" },
  hourly: { icon: Clock, tint: "var(--accent)" },
  week: { icon: CalendarDays, tint: "#5ac8fa" },
  spc: { icon: Zap, tint: "#ffcc00" },
  uv: { icon: SunMedium, tint: "#af52de" },
  sun: { icon: Sunrise, tint: "#ff9f43" },
  moon: { icon: Moon, tint: "#b9c6ff" },
  wind: { icon: Wind, tint: "#5ac8fa" },
  pressure: { icon: GaugeIcon, tint: "#8b9cff" },
  feels: { icon: Thermometer, tint: "#ff7a45" },
  dew: { icon: Droplets, tint: "#3ea6ff" },
  aqi: { icon: Leaf, tint: "#4cd964" },
  pollen: { icon: Flower2, tint: "#e879f9" },
};
const WIDE: WidgetId[] = ["now", "hourly", "week"];

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
    Promise.all([
      json(`/api/weather?${q}`),
      json(`/api/conditions?${q}`),
      json(`/api/air?${q}`).catch(() => undefined),
    ])
      .then(([weather, cond, air]) => setData({ key, weather, cond, air }))
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
        <p className="eyebrow">Your dashboard</p>
        <p className="text-sm text-muted">
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
  const h0 = w?.hourly[0];
  const temp = c?.tempF ?? h0?.temp ?? null;
  const hi = w?.daily.find((p) => p.isDay)?.temp;
  const lo = w?.daily.find((p) => !p.isDay)?.temp;
  const aqi = cur?.air?.aqi?.now ?? null;
  const pollen = cur?.air?.pollen;
  const topPollen =
    pollen?.kind === "counts"
      ? pollen.days[0]?.types.reduce((a, b) => (b.index > a.index ? b : a), {
          label: "None",
          index: 0,
          category: "None",
        })
      : null;

  const body: Record<WidgetId, ReactNode> = {
    now: w && h0 && (
      <div className={s.now}>
        <Scene short={h0.short} isDay={h0.isDay} />
        <div className={s.nowMain}>
          <p className={s.nowTemp}>
            {temp != null ? <CountUp value={temp} /> : dash}
            <sup>°F</sup>
          </p>
          <p className={s.nowShort}>{h0.short}</p>
          <p className={s.nowHiLo}>
            <ArrowUp aria-hidden /> {hi ?? dash}°
            <ArrowDown aria-hidden /> {lo ?? dash}°
          </p>
        </div>
        <dl className={s.nowGrid}>
          <div>
            <dt>Feels like</dt>
            <dd>{c?.feelsF ?? dash}°</dd>
          </div>
          <div>
            <dt>Humidity</dt>
            <dd>{c?.rh ?? h0.rh ?? dash}%</dd>
          </div>
          <div>
            <dt>Wind</dt>
            <dd>{c?.windMph != null ? `${c.windMph} mph` : h0.wind}</dd>
          </div>
          <div>
            <dt>Pressure</dt>
            <dd>{c?.pressureMb ? `${Math.round(c.pressureMb)} mb` : dash}</dd>
          </div>
        </dl>
      </div>
    ),
    hourly: w && <HourlyChart hours={w.hourly} timeZone={tz} />,
    week: w && <WeekRanges daily={w.daily} />,
    spc: cur && (
      <Gauge
        value={c?.spc ? SPC_LEVELS.indexOf(c.spc) + 1 : 0}
        min={0}
        max={6}
        stops={[
          "#3a3f55",
          "#c1e9c1",
          "#66a366",
          "#ffe066",
          "#ffa366",
          "#e06666",
          "#ee99ee",
        ]}
        center={<p className={s.gValue}>{c?.spc ?? "None"}</p>}
        caption={
          c?.spc ? SPC_NAMES[c.spc] : "No severe or thunderstorm risk today"
        }
      />
    ),
    uv:
      cur &&
      (c?.uv ? (
        <Gauge
          value={c.uv.now}
          min={0}
          max={12}
          stops={["#4cd964", "#ffcc00", "#ff9500", "#ff3b30", "#af52de"]}
          marks={[{ value: c.uv.max, label: `Today's peak ${c.uv.max}` }]}
          center={
            <p className={s.gValue}>
              <CountUp value={c.uv.now} />
            </p>
          }
          caption={`${uvLabel(c.uv.now)} · peak ${c.uv.max} today`}
        />
      ) : (
        <p className={s.none}>No EPA UV forecast for this place.</p>
      )),
    sun: (
      <div>
        <SunArc rise={sun.rise} set={sun.set} now={now} label={time} />
        <p className={s.caption}>
          {Math.floor(sun.dayMinutes / 60)} h {Math.round(sun.dayMinutes % 60)}{" "}
          min of daylight
        </p>
      </div>
    ),
    moon: (
      <div className={s.moonRow}>
        <MoonDisc phase={moon.phase} />
        <div>
          <p className={s.mid}>{moon.name}</p>
          <p className={s.caption}>
            {Math.round(moon.illumination * 100)}% lit · full in{" "}
            {Math.round(moon.daysToFull)} days
          </p>
        </div>
      </div>
    ),
    wind: cur && (
      <Compass
        from={c?.windDir ?? null}
        mph={c?.windMph ?? null}
        gust={c?.gustMph ?? null}
      />
    ),
    pressure: cur && (
      <Gauge
        value={c?.pressureMb ?? null}
        min={980}
        max={1045}
        stops={["#5856d6", "#5ac8fa", "#4cd964", "#ffcc00", "#ff9500"]}
        center={
          <p className={s.gValue}>
            {c?.pressureMb ? Math.round(c.pressureMb) : dash}
            <small> mb</small>
          </p>
        }
        caption={
          c?.trend
            ? `${c.trend.trend[0].toUpperCase()}${c.trend.trend.slice(1)} · ${c.trend.change > 0 ? "+" : ""}${c.trend.change} mb in 3 h`
            : "Trend unavailable"
        }
      />
    ),
    feels: cur && (
      <Thermo feels={c?.feelsF ?? null} actual={c?.tempF ?? null} />
    ),
    dew: cur && <Comfort dew={c?.dewF ?? null} rh={c?.rh ?? null} />,
    aqi:
      cur &&
      (aqi != null ? (
        <Gauge
          value={aqi}
          min={0}
          max={300}
          stops={[
            "#00e400",
            "#ffff00",
            "#ff7e00",
            "#ff0000",
            "#8f3f97",
            "#7e0023",
          ]}
          center={
            <p className={s.gValue} style={{ color: aqiBand(aqi).color }}>
              <CountUp value={aqi} />
            </p>
          }
          caption={aqiBand(aqi).label}
        />
      ) : (
        <p className={s.none}>No air-quality reading here.</p>
      )),
    pollen:
      cur &&
      (pollen?.kind === "dispersal" && pollen.peak ? (
        <Gauge
          value={pollen.peak.score}
          min={0}
          max={100}
          stops={["#4cd964", "#a3e635", "#ffcc00", "#ff9500", "#ff3b30"]}
          center={<p className={s.gMid}>{pollen.peak.band}</p>}
          caption="Worst dispersal in the next 24 h (not a count)"
        />
      ) : topPollen ? (
        <Gauge
          value={topPollen.index}
          min={0}
          max={5}
          stops={["#4cd964", "#a3e635", "#ffcc00", "#ff9500", "#ff3b30"]}
          center={<p className={s.gMid}>{topPollen.category}</p>}
          caption={`Highest today: ${topPollen.label}`}
        />
      ) : (
        <p className={s.none}>Pollen isn&apos;t available here.</p>
      )),
  };

  const visible = layout.order.filter((id) => !layout.hidden.includes(id));
  const title = (id: WidgetId) => WIDGETS.find((x) => x.id === id)!.title;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setSheet(true)}
          className="flex items-center gap-1.5 text-[13px] font-semibold"
          aria-label={`Location: ${active.label}. Change`}
        >
          <MapPin className="size-4 text-accent" aria-hidden /> {active.label}
          <ChevronDown className="size-3.5 text-muted" aria-hidden />
        </button>
        <Button
          variant={editing ? "primary" : "secondary"}
          onClick={() => setEditing(!editing)}
        >
          <Settings2 className="size-4" aria-hidden />
          {editing ? "Done" : "Arrange"}
        </Button>
      </div>
      {cur?.error && (
        <Card className="grid gap-2">
          <p className="text-sm text-muted">{cur.error}</p>
          <Button onClick={() => setRetry((n) => n + 1)}>Try again</Button>
        </Card>
      )}
      <ul className={s.wall}>
        {visible.map((id, i) => {
          const { icon: Icon, tint } = LOOK[id];
          return (
            <li
              key={id}
              className={`${s.tile} ${WIDE.includes(id) ? s.wide : ""} ${editing ? s.editing : ""}`}
              style={{ ["--tint" as string]: tint, ["--d" as string]: i }}
            >
              <div className={s.head}>
                <h2>
                  <Icon aria-hidden />
                  {title(id)}
                </h2>
                {editing && (
                  <span className={s.tools}>
                    <button
                      aria-label={`Move ${title(id)} up`}
                      disabled={i === 0}
                      onClick={() => writeLayout(move(layout, id, -1))}
                    >
                      <ArrowUp aria-hidden />
                    </button>
                    <button
                      aria-label={`Move ${title(id)} down`}
                      disabled={i === visible.length - 1}
                      onClick={() => writeLayout(move(layout, id, 1))}
                    >
                      <ArrowDown aria-hidden />
                    </button>
                    <button
                      aria-label={`Hide ${title(id)}`}
                      onClick={() => writeLayout(toggle(layout, id))}
                    >
                      <EyeOff aria-hidden />
                    </button>
                  </span>
                )}
              </div>
              {body[id] ?? <div className={s.skeleton} aria-label="Loading" />}
            </li>
          );
        })}
      </ul>
      {editing && layout.hidden.length > 0 && (
        <Card className="grid gap-2">
          <p className="label">Hidden widgets</p>
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
        <p className="mono text-[10px] text-muted">
          NWS {w.place.office}
          {c?.station ? ` · station ${c.station}` : ""} · SPC Day 1 · EPA UV
          {cur?.air?.aqi ? ` · ${cur.air.aqi.source}` : ""}
        </p>
      )}
      {sheetEl}
    </div>
  );
}
