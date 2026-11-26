"use client";

import { useEffect, useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarRange,
  Crosshair,
  Database,
  MapPinned,
  Siren,
  Tornado,
} from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap, W, H } from "@/features/maps/UsMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { EF_COLORS } from "@/lib/colors/ef";
import {
  COLOR as WARN,
  TAG_COLOR,
  TAG_LABEL,
  WARN_TAGS,
  type WarnTag,
} from "@/lib/warnings/style";
import type { Track, WarnPoly } from "@/lib/history/data";
import type { TornadoHomeData } from "@/lib/tornado/home";
import { RasterPaths } from "./RasterPaths";
// Loaded when its tab opens, so the page's first load stays light.
const TornadoHome = dynamic(
  () => import("./tornado-database/Home").then((m) => m.TornadoHome),
  { ssr: false },
);
import s from "./History.module.css";

const EF_ORDER = ["EFU", "EF0", "EF1", "EF2", "EF3", "EF4", "EF5"];
const KIND = {
  TO: "Tornado Warning",
  SV: "Severe Thunderstorm Warning",
  FF: "Flash Flood Warning",
} as const;
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
/** Short names for the impact chips (the legend keeps the full ones). */
const TAG_CHIP: Record<WarnTag, string> = {
  emergency: "Emergency",
  pds: "PDS",
  destructive: "Destructive",
  considerable: "Considerable",
  observed: "Tornado observed",
};
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Above this many warnings the map draws them as one picture (smooth on phones). */
const RASTER_FROM = 6000;

/** Loads one JSON endpoint per key, remembering what it already fetched this visit. */
function useJson<T>(url: string | null) {
  const [res, setRes] = useState<{ url: string; d: T | "error" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: T) => live && setRes({ url, d }))
      .catch(() => live && setRes({ url, d: "error" }));
    return () => {
      live = false;
    };
  }, [url]);
  return url && res?.url === url ? res.d : null;
}

/** This year on the phone's clock (the page itself may have been built last year). */
function useThisYear(built: number) {
  const [y, setY] = useState(built);
  useEffect(() => {
    queueMicrotask(() => setY(new Date().getFullYear()));
  }, []);
  return y;
}

/** A track's box on the map, padded and widened to the map's shape, to glide to. */
function boxOf(d: string, key: string) {
  const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < n.length; i += 2) {
    x0 = Math.min(x0, n[i]);
    x1 = Math.max(x1, n[i]);
    y0 = Math.min(y0, n[i + 1]);
    y1 = Math.max(y1, n[i + 1]);
  }
  const w = Math.max(10, (x1 - x0) * 1.6, ((y1 - y0) * 1.6 * W) / H);
  return {
    x: (x0 + x1) / 2 - w / 2,
    y: (y0 + y1) / 2 - (w * H) / W / 2,
    w,
    key,
  };
}

/** Pick dates: a from/to pair, checked against the allowed span before it's used. */
function Range({
  min,
  maxDays,
  onPick,
}: {
  min: string;
  maxDays: number;
  onPick: (from: string, to: string) => void;
}) {
  const [today] = useState(() => ymd(new Date()));
  const [from, setFrom] = useState(() =>
    ymd(new Date(Date.parse(today) - 30 * 86400_000)),
  );
  const [to, setTo] = useState(today);
  const span = (Date.parse(to) - Date.parse(from)) / 86400_000;
  const err =
    !from || !to
      ? "Pick both dates."
      : from > to
        ? "The start comes after the end."
        : from < min
          ? `The archive starts ${day(min)}.`
          : span > maxDays
            ? `Up to ${maxDays === 731 ? "two years" : "one year"} at a time.`
            : null;
  return (
    <div className={s.range}>
      <label>
        From
        <input
          type="date"
          value={from}
          min={min}
          max={today}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={to}
          min={min}
          max={today}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={Boolean(err)}
        onClick={() => onPick(from, to)}
      >
        Show
      </button>
      {err && <small role="status">{err}</small>}
    </div>
  );
}

/**
 * The two filters every History map takes (owner's follow-up #3): a date range and a state
 * checklist, side by side so nobody has to hunt for them.
 */
function Filters({
  what,
  dates,
  custom,
  min,
  maxDays,
  onDates,
  counts,
  only,
  setOnly,
}: {
  what: string;
  dates: string;
  custom: boolean;
  min: string;
  maxDays: number;
  onDates: (from: string, to: string) => void;
  counts: [string, number][];
  only: Set<string> | null;
  setOnly: (v: Set<string> | null) => void;
}) {
  const [open, setOpen] = useState<"dates" | "states" | null>(null);
  const toggle = (k: "dates" | "states") =>
    setOpen((o) => (o === k ? null : k));
  const all = counts.map(([x]) => x);
  return (
    <div className="grid gap-2">
      <div className={s.filters}>
        <button
          type="button"
          aria-expanded={open === "dates"}
          data-on={custom || undefined}
          onClick={() => toggle("dates")}
        >
          <CalendarRange aria-hidden />
          <span>
            <small>Dates</small>
            {custom ? dates : "Pick from / to"}
          </span>
        </button>
        <button
          type="button"
          aria-expanded={open === "states"}
          data-on={only ? true : undefined}
          onClick={() => toggle("states")}
        >
          <MapPinned aria-hidden />
          <span>
            <small>States</small>
            {only
              ? only.size
                ? `${[...only].slice(0, 4).join(", ")}${only.size > 4 ? ` +${only.size - 4}` : ""}`
                : "None"
              : "All states"}
          </span>
        </button>
      </div>
      {open === "dates" && (
        <Range
          min={min}
          maxDays={maxDays}
          onPick={(from, to) => {
            onDates(from, to);
            setOpen(null);
          }}
        />
      )}
      {open === "states" && (
        <div className={s.statePanel}>
          <div className={s.stateTools}>
            <button type="button" onClick={() => setOnly(null)}>
              All
            </button>
            <button type="button" onClick={() => setOnly(new Set())}>
              None
            </button>
            <button type="button" onClick={() => setOpen(null)}>
              Done
            </button>
          </div>
          <div className={s.stateGrid} role="group" aria-label="States">
            {counts.map(([st, n]) => (
              <label key={st}>
                <input
                  type="checkbox"
                  checked={!only || only.has(st)}
                  onChange={(e) => {
                    const next = new Set(only ?? all);
                    if (e.target.checked) next.add(st);
                    else next.delete(st);
                    setOnly(next.size === all.length ? null : next);
                  }}
                />
                {st} <small>{n.toLocaleString("en-US")}</small>
              </label>
            ))}
            {!counts.length && (
              <p className={s.muted}>States show once the {what} load.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Severe Weather History: tornado tracks, the warning archive and the Tornado Database. */
export function HistoryView({
  colors,
  year,
  db,
}: {
  colors: Colors;
  year: number;
  /** The Tornado Database tab's data; null when the owner has it switched off. */
  db: TornadoHomeData | null;
}) {
  // An address ending #tornado-database (or #h-warn) opens that tab: a link, a refresh or the old
  // Tornado Database address redirecting here. Choosing a tab keeps the address in step.
  useEffect(() => {
    const open = () =>
      document
        .getElementById(`tab-${decodeURIComponent(location.hash.slice(1))}`)
        ?.click();
    open();
    addEventListener("hashchange", open);
    return () => removeEventListener("hashchange", open);
  }, []);
  return (
    <div
      className="grid gap-4"
      onClickCapture={(e) => {
        const tab = (e.target as Element).closest?.("[role=tab]");
        if (!tab?.id.startsWith("tab-")) return;
        const id = tab.id.slice(4);
        history.replaceState(
          history.state,
          "",
          id === "h-tor" ? location.pathname : `#${id}`,
        );
      }}
    >
      <HomeTabs
        label="History"
        tabs={[
          {
            id: "h-tor",
            label: "Tornado Tracks",
            icon: <Tornado aria-hidden />,
            panel: <Tornadoes colors={colors} year={year} />,
          },
          {
            id: "h-warn",
            label: "Warnings",
            icon: <Siren aria-hidden />,
            panel: <Warnings colors={colors} />,
          },
          ...(db
            ? [
                {
                  id: "tornado-database",
                  label: "Tornado Database",
                  icon: <Database aria-hidden />,
                  panel: (
                    <TornadoHome
                      colors={colors}
                      views={db.views}
                      famous={db.famous}
                      year={year}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
      <p className={s.foot}>
        Sources: NWS Damage Assessment Toolkit (surveyed tracks; recent surveys
        may still be in progress), the Iowa Environmental Mesonet storm-based
        warning archive and NOAA Storm Prediction Center&apos;s tornado record
        since 1950 (Tornado Database). Finished years and months are cached, so
        they open instantly.
      </p>
    </div>
  );
}

function Tornadoes({ colors, year: built }: { colors: Colors; year: number }) {
  const year = useThisYear(built);
  const periods = useMemo(
    () => [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `year=${year - i}`,
        label: String(year - i),
      })),
      { id: "days=30", label: "30 days" },
      { id: "days=90", label: "90 days" },
      { id: "days=365", label: "12 months" },
    ],
    [year],
  );
  // Opens on this year, always (Fix list 2026-10-30 #7).
  const [chosen, setChosen] = useState<string | null>(null);
  const period = chosen ?? `year=${year}`;
  const [hide, setHide] = useState<Set<string>>(new Set());
  const [only, setOnly] = useState<Set<string> | null>(null);
  const [focus, setFocus] = useState<{ t: Track; n: number } | null>(null);
  const mapId = useId();
  const data = useJson<{ tracks: Track[] }>(`/api/history/tornadoes?${period}`);
  const all = useMemo(
    () => (data && data !== "error" ? data.tracks : []),
    [data],
  );
  // The states this period has tracks in, busiest first.
  const stateCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of all) if (t.st) m.set(t.st, (m.get(t.st) ?? 0) + 1);
    return [...m.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    );
  }, [all]);
  // Everything below follows the filters on screen: period, states and ratings.
  const inStates = only ? all.filter((t) => only.has(t.st)) : all;
  const shown = inStates.filter((t) => !hide.has(t.ef));
  const c = (ef: string) => pick(colors, `ef:${ef}`, EF_COLORS[ef]);
  const count = (ef: string) => inStates.filter((t) => t.ef === ef).length;
  const strong = shown.filter((t) =>
    ["EF3", "EF4", "EF5"].includes(t.ef),
  ).length;
  const longest = shown.reduce<Track | null>(
    (a, t) => (!a || t.miles > a.miles ? t : a),
    null,
  );
  const deaths = shown.reduce((a, t) => a + t.deaths, 0);
  const hurt = shown.reduce((a, t) => a + t.hurt, 0);
  const isYear = period.startsWith("year=");
  const months = MONTHS.map(
    (_, i) => shown.filter((t) => Number(t.date.slice(5, 7)) === i + 1).length,
  );
  const peak = Math.max(1, ...months);
  const rank = (t: Track) => EF_ORDER.indexOf(t.ef);
  const strongest = [...shown]
    .sort((a, b) => rank(b) - rank(a) || b.miles - a.miles)
    .slice(0, 5);
  const longestFive = [...shown].sort((a, b) => b.miles - a.miles).slice(0, 5);
  const status = !data
    ? "loading"
    : data === "error"
      ? "error"
      : shown.length
        ? "ready"
        : "empty";
  const label = chosen?.startsWith("from=")
    ? chosen
        .split("&")
        .map((x) => day(x.slice(x.indexOf("=") + 1)))
        .join(" – ")
    : periods.find((p) => p.id === period)?.label;
  const go = (t: Track) => {
    setFocus((f) => ({ t, n: (f?.n ?? 0) + 1 }));
    document
      .getElementById(mapId)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const list = (ts: Track[], title: string) => (
    <section className={s.card}>
      <h3>{title}</h3>
      <ol className={s.top}>
        {ts.map((t, i) => (
          <li key={i} style={{ ["--c" as string]: c(t.ef) }}>
            <button
              type="button"
              onClick={() => go(t)}
              aria-current={focus?.t === t || undefined}
              aria-label={`${t.ef}, ${t.miles} miles, ${day(t.date)}${t.st ? `, ${t.st}` : ""}: show on the map`}
            >
              <b>{t.ef}</b>
              <span>
                {t.miles} mi · {t.yards ? `${t.yards} yd wide · ` : ""}
                {day(t.date)}
                {t.deaths ? ` · ${t.deaths} killed` : ""}
              </span>
              <small>
                {t.st ? `${t.st} · ` : ""}NWS {t.wfo}
              </small>
              <Crosshair aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );

  return (
    <div className="grid gap-3">
      <div className={s.pills} role="group" aria-label="Period">
        {periods.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === period}
            onClick={() => {
              setChosen(p.id);
              setFocus(null);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Filters
        what="tracks"
        dates={label ?? ""}
        custom={Boolean(chosen?.startsWith("from="))}
        min="2000-01-01"
        maxDays={731}
        onDates={(from, to) => {
          setChosen(`from=${from}&to=${to}`);
          setFocus(null);
        }}
        counts={stateCounts}
        only={only}
        setOnly={(v) => {
          setOnly(v);
          setFocus(null);
        }}
      />
      <div className={s.band}>
        <div>
          <b>{data ? shown.length.toLocaleString("en-US") : "–"}</b>
          <span>tornado tracks</span>
        </div>
        <div>
          <b>{data ? strong : "–"}</b>
          <span>EF3 or stronger</span>
        </div>
        <div>
          <b>{longest ? `${longest.miles} mi` : "–"}</b>
          <span>longest track</span>
        </div>
        <div>
          <b>{data ? deaths : "–"}</b>
          <span>deaths · {hurt} hurt</span>
        </div>
      </div>
      {inStates.length > 0 && (
        <div className={s.comp} role="img" aria-label="Tracks by rating">
          {EF_ORDER.map((ef) =>
            count(ef) ? (
              <i
                key={ef}
                style={{ flexGrow: count(ef), background: c(ef) }}
                title={`${ef}: ${count(ef)}`}
              />
            ) : null,
          )}
        </div>
      )}
      <div className={s.chips} role="group" aria-label="Show ratings">
        {EF_ORDER.map((ef) => (
          <button
            key={ef}
            type="button"
            aria-pressed={!hide.has(ef)}
            onClick={() => {
              const n = new Set(hide);
              if (n.has(ef)) n.delete(ef);
              else n.add(ef);
              setHide(n);
            }}
            style={{ ["--c" as string]: c(ef) }}
          >
            <i />
            {ef} <small>{count(ef)}</small>
          </button>
        ))}
      </div>
      <div id={mapId}>
        <UsMap
          title={`Tornado tracks · ${label}`}
          legend={EF_ORDER.map((ef) => ({ label: ef, color: c(ef) }))}
          status={status}
          file={`sswx-tornado-tracks-${period.replace(/[=&]/g, "-")}`}
          maxZoom={60}
          towns
          focus={focus ? boxOf(focus.t.d, `${focus.n}`) : undefined}
          overlay={
            focus && (
              <g className={s.picked} aria-hidden>
                <path d={focus.t.d} className={s.halo} />
                <path d={focus.t.d} stroke={c(focus.t.ef)} />
              </g>
            )
          }
        >
          {/* Weakest first so the strongest paths draw on top. Widths are in screen
              pixels once zoomed in, so a track stays a line, never a blob. */}
          {EF_ORDER.map((ef, k) => (
            <g
              key={ef}
              className={s.tracks}
              stroke={c(ef)}
              style={{
                ["--cw" as string]: 0.9 + k * 0.45,
                ["--sw" as string]: 1.6 + k * 0.35,
              }}
            >
              {shown
                .filter((t) => t.ef === ef)
                .map((t, i) => (
                  <path key={i} d={t.d} />
                ))}
            </g>
          ))}
        </UsMap>
      </div>
      {status === "empty" && (
        <p className={s.muted}>
          {all.length
            ? "No tracks match these filters."
            : "No surveyed tornado tracks in this period yet."}
        </p>
      )}
      {shown.length > 0 && (
        <p className={s.muted}>
          Tap a tornado below to fly to its track. Zoom &amp; pan goes 60× in,
          with town names as you get closer.
        </p>
      )}
      {strongest.length > 0 && list(strongest, "Strongest tornadoes")}
      {longestFive.length > 0 && list(longestFive, "Longest tracks")}
      {isYear && shown.length > 0 && (
        <section className={s.card}>
          <h3>By month</h3>
          <div className={s.months}>
            {months.map((n, i) => (
              <div key={MONTHS[i]}>
                <i style={{ transform: `scaleY(${n / peak})` }} />
                <span>{MONTHS[i][0]}</span>
                <b>{n || ""}</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Month keys (YYYY-MM) a date range touches. */
function monthsOf(from: string, to: string) {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/**
 * Warnings for a window past 30 days, a month at a time (each month cached on the server and
 * at the edge), joined and trimmed to the window as they arrive.
 */
function useMonths(range: { from: string; to: string } | null) {
  const [got, setGot] = useState<{
    key: string;
    polys: WarnPoly[];
    done: number;
    of: number;
    failed: boolean;
  } | null>(null);
  const key = range ? `${range.from}/${range.to}` : null;
  useEffect(() => {
    if (!range || !key) return;
    let live = true;
    const months = monthsOf(range.from, range.to);
    const parts: WarnPoly[][] = [];
    let done = 0;
    let failed = false;
    const rank = { FF: 0, SV: 1, TO: 2 };
    const publish = () =>
      live &&
      setGot({
        key,
        polys: parts
          .flat()
          .filter((p) => p.date >= range.from && p.date <= range.to)
          .sort((a, b) => rank[a.kind] - rank[b.kind] || a.tier - b.tier),
        done,
        of: months.length,
        failed,
      });
    (async () => {
      for (let i = 0; i < months.length && live; i += 3)
        await Promise.all(
          months.slice(i, i + 3).map((m) =>
            fetch(`/api/history/warnings?month=${m}`)
              .then((r) => (r.ok ? r.json() : Promise.reject()))
              .then((d: { polys: WarnPoly[] }) => parts.push(d.polys))
              .catch(() => {
                failed = true;
              })
              .finally(() => {
                done++;
                publish();
              }),
          ),
        );
    })();
    return () => {
      live = false;
    };
    // `key` stands for the range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return got?.key === key ? got : null;
}

function Warnings({ colors }: { colors: Colors }) {
  const [win, setWin] = useState<
    { days: number } | { from: string; to: string }
  >({ days: 3 });
  const [only, setOnly] = useState<Set<string> | null>(null);
  // Which warnings to show (owner, 2026-11-02): by type, and by the impact wording NWS put on
  // them ("none" = a plain warning). Everything shows until a chip is switched off.
  const [hideKind, setHideKind] = useState<Set<string>>(new Set());
  const [hideTag, setHideTag] = useState<Set<string>>(new Set());
  const short = "days" in win && win.days <= 30;
  const range = useMemo(() => {
    if (short) return null;
    if ("from" in win) return win;
    const to = new Date();
    return {
      from: ymd(new Date(to.getTime() - win.days * 86400_000)),
      to: ymd(to),
    };
    // Recomputed only when the choice changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win]);
  const quick = useJson<{ polys: WarnPoly[] }>(
    short && "days" in win ? `/api/history/warnings?days=${win.days}` : null,
  );
  const long = useMonths(range);
  const loaded = useMemo(
    () =>
      short
        ? quick && quick !== "error"
          ? quick.polys
          : []
        : (long?.polys ?? []),
    [short, quick, long],
  );
  const stateCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of loaded) if (p.st) m.set(p.st, (m.get(p.st) ?? 0) + 1);
    return [...m.entries()].sort(
      (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    );
  }, [loaded]);
  const inStates = only ? loaded.filter((p) => only.has(p.st ?? "")) : loaded;
  const tagOf = (p: WarnPoly) => p.tag ?? "none";
  // Each chip counts what it would add, given the other row's choices.
  const kindCount = (k: string) =>
    inStates.filter((p) => p.kind === k && !hideTag.has(tagOf(p))).length;
  const tagCount = (t: string) =>
    inStates.filter((p) => tagOf(p) === t && !hideKind.has(p.kind)).length;
  const polys = inStates.filter(
    (p) => !hideKind.has(p.kind) && !hideTag.has(tagOf(p)),
  );
  const flip = (set: Set<string>, key: string) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  };
  const c = (k: keyof typeof KIND) =>
    pick(colors, `warn:${KIND[k]}`, WARN[KIND[k]]);
  const tagC = (t: WarnTag) => pick(colors, `warntag:${t}`, TAG_COLOR[t]);
  const n = (k: keyof typeof KIND) => polys.filter((p) => p.kind === k).length;
  const tags = WARN_TAGS.map((t) => ({
    t,
    n: polys.filter((p) => p.tag === t).length,
  }));
  const loading = short ? !quick : !long || long.done < long.of;
  const failed = short ? quick === "error" : Boolean(long?.failed);
  const status =
    failed && !polys.length
      ? "error"
      : loading && !polys.length
        ? "loading"
        : polys.length
          ? "ready"
          : loading
            ? "loading"
            : "empty";
  const label =
    "from" in win
      ? `${day(win.from)} – ${day(win.to)}`
      : win.days === 1
        ? "last 24 hours"
        : win.days === 365
          ? "last 12 months"
          : `last ${win.days} days`;
  const raster = polys.length > RASTER_FROM;
  return (
    <div className="grid gap-3">
      <div className={s.pills} role="group" aria-label="Period">
        {[
          [1, "24 hours"],
          [3, "3 days"],
          [7, "7 days"],
          [30, "30 days"],
          [90, "90 days"],
          [365, "12 months"],
        ].map(([d, l]) => (
          <button
            key={d}
            type="button"
            aria-pressed={"days" in win && d === win.days}
            onClick={() => setWin({ days: Number(d) })}
          >
            {l}
          </button>
        ))}
      </div>
      <Filters
        what="warnings"
        dates={label}
        custom={"from" in win}
        min="2008-01-01"
        maxDays={366}
        onDates={(from, to) => setWin({ from, to })}
        counts={stateCounts}
        only={only}
        setOnly={setOnly}
      />
      <div className={s.chipRows}>
        <span>Warning types</span>
        <div className={s.chips} role="group" aria-label="Show warning types">
          {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={!hideKind.has(k)}
              onClick={() => setHideKind(flip(hideKind, k))}
              style={{ ["--c" as string]: c(k) }}
            >
              <i />
              {KIND[k].replace(" Warning", "")}{" "}
              <small>{kindCount(k).toLocaleString("en-US")}</small>
            </button>
          ))}
        </div>
        <span>Impact wording</span>
        <div
          className={s.chips}
          role="group"
          aria-label="Show warnings by impact wording"
        >
          <button
            type="button"
            aria-pressed={!hideTag.has("none")}
            onClick={() => setHideTag(flip(hideTag, "none"))}
            style={{ ["--c" as string]: "var(--muted)" }}
          >
            <i />
            Base warning{" "}
            <small>{tagCount("none").toLocaleString("en-US")}</small>
          </button>
          {WARN_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={!hideTag.has(t)}
              onClick={() => setHideTag(flip(hideTag, t))}
              style={{ ["--c" as string]: tagC(t) }}
              title={TAG_LABEL[t]}
            >
              <i />
              {TAG_CHIP[t]} <small>{tagCount(t).toLocaleString("en-US")}</small>
            </button>
          ))}
        </div>
      </div>
      {!short && long && long.done < long.of && (
        <p className={s.muted} role="status">
          Loading month {long.done + 1} of {long.of}… the map fills in as each
          arrives.
        </p>
      )}
      <div className={s.band}>
        {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => (
          <div key={k} style={{ ["--c" as string]: c(k) }}>
            <b className={s.tinted}>
              {status === "loading" ? "–" : n(k).toLocaleString("en-US")}
            </b>
            <span>{KIND[k].replace(" Warning", "")}</span>
          </div>
        ))}
        <div>
          <b>
            {status === "loading"
              ? "–"
              : polys.filter((p) => p.tier >= 2).length.toLocaleString("en-US")}
          </b>
          <span>
            PDS / destructive
            {tags[0].n ? ` · ${tags[0].n} emergencies` : ""}
          </span>
        </div>
      </div>
      {polys.length > 0 && (
        <div className={s.comp} role="img" aria-label="Warnings by type">
          {(["TO", "SV", "FF"] as const).map((k) =>
            n(k) ? (
              <i key={k} style={{ flexGrow: n(k), background: c(k) }} />
            ) : null,
          )}
        </div>
      )}
      <UsMap
        title={`Severe warnings · ${label}`}
        // Only what is on the map, with counts (owner's follow-up #3).
        legend={[
          ...(Object.keys(KIND) as (keyof typeof KIND)[])
            .filter((k) => n(k))
            .map((k) => ({
              label: `${KIND[k]} · ${n(k).toLocaleString("en-US")}`,
              color: c(k),
            })),
          ...tags
            .filter((x) => x.n)
            .map(({ t, n: k }) => ({
              label: `${TAG_LABEL[t]} · ${k.toLocaleString("en-US")}`,
              color: tagC(t),
              outline: true,
            })),
        ]}
        status={status}
        file={`sswx-warnings-${"days" in win ? `${win.days}d` : `${win.from}-${win.to}`}`}
      >
        {raster ? (
          <RasterPaths
            polys={polys}
            fill={(p) => c(p.kind)}
            line={(p) => (p.tag ? tagC(p.tag) : null)}
          />
        ) : (
          polys.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={c(p.kind)}
              fillOpacity={0.5}
              stroke={p.tag ? tagC(p.tag) : c(p.kind)}
              className={p.tag ? s.tagged : s.plain}
              style={
                p.tag
                  ? {
                      ["--cw" as string]: 0.4 + p.tier * 0.5,
                      ["--sw" as string]: 1.2 + p.tier * 0.5,
                    }
                  : undefined
              }
            />
          ))
        )}
      </UsMap>
    </div>
  );
}
