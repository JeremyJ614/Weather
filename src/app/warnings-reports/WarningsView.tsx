"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CloudLightning,
  Flame,
  Siren,
  Snowflake,
  Sun,
  Tornado,
  Waves,
  Wind,
} from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { CountUp } from "@/features/dashboard/widgets/CountUp";
import { usePlaces } from "@/features/location/usePlaces";
import { UsMap, type Swatch } from "@/features/maps/UsMap";
import { Polys } from "@/features/maps/useLayer";
import type { Warning } from "@/lib/warnings/feed";
import s from "./Warn.module.css";

type MapData = { polys: { c: string; d: string }[]; legend: Swatch[] };

const TYPES: {
  id: string;
  label: string;
  icon: React.ReactNode;
  re: RegExp;
}[] = [
  {
    id: "tornado",
    label: "Tornado",
    icon: <Tornado aria-hidden />,
    re: /tornado/i,
  },
  {
    id: "severe",
    label: "Severe",
    icon: <CloudLightning aria-hidden />,
    re: /severe thunderstorm/i,
  },
  {
    id: "flood",
    label: "Flood",
    icon: <Waves aria-hidden />,
    re: /flood|hydrologic/i,
  },
  {
    id: "winter",
    label: "Winter",
    icon: <Snowflake aria-hidden />,
    re: /winter|blizzard|ice storm|snow|freez|frost|cold|chill/i,
  },
  {
    id: "tropical",
    label: "Tropical",
    icon: <Wind aria-hidden />,
    re: /hurricane|tropical|storm surge|typhoon/i,
  },
  { id: "wind", label: "Wind", icon: <Wind aria-hidden />, re: /wind|dust/i },
  {
    id: "fire",
    label: "Fire",
    icon: <Flame aria-hidden />,
    re: /fire|red flag|smoke/i,
  },
  { id: "heat", label: "Heat", icon: <Sun aria-hidden />, re: /heat/i },
];

const until = (iso: string) =>
  iso
    ? `until ${new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" })} CT`
    : "";

function Card({ w, i, big }: { w: Warning; i: number; big?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<
    { description: string; instruction: string } | null | "err"
  >(null);
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && text === null) {
      try {
        const r = await fetch(
          `/api/warnings/detail?id=${encodeURIComponent(w.id)}`,
        );
        setText(r.ok ? await r.json() : "err");
      } catch {
        setText("err");
      }
    }
  };
  return (
    <article
      className={`${s.card} ${big ? s.big : ""} ${w.tags.some((t) => t.level === 3) ? s.critical : ""}`}
      style={{ ["--c" as string]: w.color, ["--i" as string]: Math.min(i, 12) }}
    >
      <button className={s.cardHead} onClick={toggle} aria-expanded={open}>
        <span className={s.stripe} aria-hidden />
        <span className={s.cardMain}>
          <b className={s.event}>
            {w.event}
            {w.pds && <em className={s.tag3}>PDS</em>}
          </b>
          {w.tags.length > 0 && (
            <span className={s.tags}>
              {w.tags.map((t) => (
                <em key={t.label} className={t.level === 3 ? s.tag3 : s.tag2}>
                  {t.label}
                </em>
              ))}
            </span>
          )}
          <span className={s.area}>{w.area}</span>
          <span className={s.meta}>
            {w.sender} · {until(w.expires)}
          </span>
        </span>
        <ChevronDown className={open ? s.chevOpen : s.chev} aria-hidden />
      </button>
      {open && (
        <div className={s.text}>
          {text === null ? (
            <p className={s.muted}>Loading the full text…</p>
          ) : text === "err" ? (
            <p>
              {w.event} for {w.area}. Issued by {w.sender}, {until(w.expires)}.{" "}
              <span className={s.muted}>
                The National Weather Service didn&apos;t send the full text just
                now; open this again in a minute.
              </span>
            </p>
          ) : (
            <>
              <pre>{text.description}</pre>
              {text.instruction && (
                <>
                  <p className="eyebrow">What to do</p>
                  <pre>{text.instruction}</pre>
                </>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Active Warnings: counters, the national map, the most serious now, and every alert. */
export function WarningsView({ initial }: { initial: Warning[] }) {
  const [items, setItems] = useState(initial);
  const [map, setMap] = useState<MapData | null | "err">(null);
  const [state, setState] = useState("");
  const [type, setType] = useState("");
  const [here, setHere] = useState<string[]>([]);
  const { active } = usePlaces();

  useEffect(() => {
    const load = () =>
      fetch("/api/warnings")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setItems(d.items));
    const loadMap = () =>
      fetch("/api/warnings/map")
        .then((r) => (r.ok ? r.json() : "err"))
        .then(setMap)
        .catch(() => setMap("err"));
    loadMap();
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      load();
      loadMap();
    }, 120_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!active) return;
    fetch(`/api/warnings/here?lat=${active.lat}&lon=${active.lon}`)
      .then((r) => r.json())
      .then((d) => setHere(d.ids ?? []))
      .catch(() => setHere([]));
  }, [active, items]);

  const mine = items.filter((w) => here.includes(w.id));
  const calm = mine.some((w) => /Warning/.test(w.event));
  const states = useMemo(
    () => [...new Set(items.flatMap((w) => w.states))].sort(),
    [items],
  );
  const shown = items.filter(
    (w) =>
      (!state || w.states.includes(state)) &&
      (!type || TYPES.find((t) => t.id === type)!.re.test(w.event)),
  );
  const count = (re: RegExp) => items.filter((w) => re.test(w.event)).length;
  const top = items.filter((w) => w.rank <= 9).slice(0, 5);

  return (
    <div className={s.wrap} data-calm={calm || undefined}>
      {mine.length > 0 && (
        <section className={s.mine}>
          <Siren aria-hidden />
          <div>
            <b>
              In effect for {active?.label}:{" "}
              {mine.map((w) => w.event).join(", ")}
            </b>
            {calm && (
              <span>Animations are paused on this page while it lasts.</span>
            )}
          </div>
        </section>
      )}

      <section className={s.stats}>
        {[
          ["Tornado", count(/^Tornado Warning$/), "#ff0000"],
          ["Severe T-storm", count(/^Severe Thunderstorm Warning$/), "#ffa500"],
          ["Flash flood", count(/^Flash Flood Warning$/), "#ff4d4d"],
          ["All warnings", count(/Warning$/), "var(--accent)"],
        ].map(([label, n, c], i) => (
          <div
            key={label as string}
            className={`${s.stat} ${(n as number) > 0 && i < 3 ? s.statHot : ""}`}
            style={{ ["--c" as string]: c as string, ["--i" as string]: i }}
          >
            <b>
              <CountUp value={n as number} />
            </b>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <UsMap
        title="Active watches, warnings & advisories"
        sub={null}
        legend={map && map !== "err" ? map.legend : []}
        status={
          map === null
            ? "loading"
            : map === "err"
              ? "error"
              : map.polys.length
                ? "ready"
                : "empty"
        }
        file="sswx-warnings"
        zoomable
      >
        {map && map !== "err" && <Polys polys={map.polys} />}
      </UsMap>

      {top.length > 0 && (
        <section className="grid gap-2">
          <p className="eyebrow">Most serious right now</p>
          {top.map((w, i) => (
            <Card key={w.id} w={w} i={i} big />
          ))}
        </section>
      )}

      <section className="grid gap-3">
        <div className={s.filters}>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            aria-label="State"
          >
            <option value="">All states</option>
            {states.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
          <div className={s.chips}>
            {TYPES.map((t) => (
              <Chip
                key={t.id}
                pressed={type === t.id}
                onClick={() => setType(type === t.id ? "" : t.id)}
              >
                {t.label}
              </Chip>
            ))}
          </div>
        </div>
        <p className="eyebrow">
          {shown.length} active {shown.length === 1 ? "alert" : "alerts"}
          {state && ` in ${state}`}
        </p>
        {shown.length === 0 ? (
          <p className={s.empty}>Nothing active for this filter.</p>
        ) : (
          shown.slice(0, 150).map((w, i) => <Card key={w.id} w={w} i={i} />)
        )}
        {shown.length > 150 && (
          <p className={s.muted}>
            Showing the 150 most serious. Narrow by state or type to see the
            rest.
          </p>
        )}
        <p className={s.muted}>Marine alerts are left out.</p>
      </section>
    </div>
  );
}
