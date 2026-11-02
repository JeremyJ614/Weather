"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ChevronDown,
  CloudLightning,
  SlidersHorizontal,
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

type MapData = {
  /** k: the polygon's alert type, as its index in `legend`. */
  polys: { c: string; d: string; k?: number }[];
  legend: Swatch[];
};

/**
 * Which alert types the viewer hides (owner, 2026-11-02): kept on this device, so the page
 * opens filtered the way they left it. Hidden types are listed, so an alert type that shows
 * up later appears until they hide it too; "Warnings only" is a switch of its own.
 */
type Hide = { hide: string[]; warningsOnly?: boolean };
const HIDE_KEY = "sswx-warn-hide";
const listeners = new Set<() => void>();
let memory: string | null = null;
const subscribe = (f: () => void) => {
  listeners.add(f);
  addEventListener("storage", f);
  return () => {
    listeners.delete(f);
    removeEventListener("storage", f);
  };
};
const readHide = () => {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(HIDE_KEY) ?? "";
  } catch {
    return "";
  }
};
const writeHide = (v: Hide) => {
  memory = v.hide.length || v.warningsOnly ? JSON.stringify(v) : "";
  try {
    if (memory) localStorage.setItem(HIDE_KEY, memory);
    else localStorage.removeItem(HIDE_KEY);
  } catch {
    /* private browsing: kept for this visit */
  }
  listeners.forEach((f) => f());
};
const parseHide = (raw: string): Hide => {
  try {
    const v = JSON.parse(raw) as Hide;
    return Array.isArray(v.hide) ? v : { hide: [] };
  } catch {
    return { hide: [] };
  }
};

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
export function WarningsView({
  initial,
  at,
}: {
  initial: Warning[];
  /** When the server built the list: an edge copy older than a minute is refreshed at once. */
  at: string;
}) {
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
    if (Date.now() - Date.parse(at) > 60_000) load();
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      load();
      loadMap();
    }, 120_000);
    return () => clearInterval(t);
  }, [at]);

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
  const hideRaw = useSyncExternalStore(subscribe, readHide, () => "");
  const hide = useMemo(() => parseHide(hideRaw), [hideRaw]);
  const [picking, setPicking] = useState(false);
  // Every alert type active now, most serious first, with how many of each.
  const kinds = useMemo(() => {
    const m = new Map<string, { n: number; rank: number }>();
    for (const w of items) {
      const k = m.get(w.event) ?? { n: 0, rank: w.rank };
      m.set(w.event, { n: k.n + 1, rank: Math.min(k.rank, w.rank) });
    }
    return [...m].sort((a, b) => a[1].rank - b[1].rank);
  }, [items]);
  const wanted = (event: string) =>
    !hide.hide.includes(event) &&
    (!hide.warningsOnly || /Warning$/.test(event));
  const hiddenNow = kinds.filter(([e]) => !wanted(e)).length;
  const toggleKind = (event: string) =>
    writeHide({
      ...hide,
      hide: hide.hide.includes(event)
        ? hide.hide.filter((e) => e !== event)
        : [...hide.hide, event],
    });
  const shown = items.filter(
    (w) =>
      wanted(w.event) &&
      (!state || w.states.includes(state)) &&
      (!type || TYPES.find((t) => t.id === type)!.re.test(w.event)),
  );
  const count = (re: RegExp) => items.filter((w) => re.test(w.event)).length;
  const top = items.filter((w) => w.rank <= 9 && wanted(w.event)).slice(0, 5);
  const mapShown =
    map && map !== "err"
      ? {
          polys: map.polys.filter(
            (p) => p.k === undefined || wanted(map.legend[p.k]?.label ?? ""),
          ),
          legend: map.legend.filter((l) => wanted(l.label)),
        }
      : null;

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
        legend={mapShown ? mapShown.legend : []}
        status={
          map === null
            ? "loading"
            : map === "err"
              ? "error"
              : mapShown?.polys.length
                ? "ready"
                : "empty"
        }
        file="sswx-warnings"
        zoomable
      >
        {mapShown && <Polys polys={mapShown.polys} />}
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
          <button
            type="button"
            className={s.typesToggle}
            aria-expanded={picking}
            onClick={() => setPicking(!picking)}
          >
            <SlidersHorizontal aria-hidden />
            <span>
              Alert types
              <small>
                {hiddenNow
                  ? `${hiddenNow} hidden${hide.warningsOnly ? " · warnings only" : ""}`
                  : "Showing every type"}
              </small>
            </span>
            <ChevronDown
              className={picking ? s.chevOpen : s.chev}
              aria-hidden
            />
          </button>
          {picking && (
            <div className={s.types}>
              <p className={s.muted}>
                Tap a type to hide it from the list and the map. Kept on this
                device.
              </p>
              <div className={s.typesQuick}>
                <Chip
                  pressed={!!hide.warningsOnly}
                  onClick={() =>
                    writeHide({ ...hide, warningsOnly: !hide.warningsOnly })
                  }
                >
                  Warnings only
                </Chip>
                <Chip pressed={false} onClick={() => writeHide({ hide: [] })}>
                  Show every type
                </Chip>
              </div>
              <div
                className={s.typesList}
                role="group"
                aria-label="Alert types"
              >
                {kinds.map(([event, k]) => (
                  <button
                    key={event}
                    type="button"
                    aria-pressed={wanted(event)}
                    disabled={!!hide.warningsOnly && !/Warning$/.test(event)}
                    onClick={() => toggleKind(event)}
                  >
                    <span>{event}</span>
                    <b>{k.n}</b>
                  </button>
                ))}
              </div>
            </div>
          )}
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
