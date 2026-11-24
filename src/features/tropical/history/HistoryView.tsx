"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Compass,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { pick, type Colors } from "@/lib/colors/pick";
import { INTENSITY, mph } from "@/lib/tropical/style";
import { read as readPlaces } from "@/features/location/store";
import {
  BASINS,
  BASIN_NAME,
  famousIn,
  keptBy,
  loadTracks,
  stormFacts,
  stormsNear,
  summary,
  type Tracks,
} from "./data";
import type { Label, Mode, Palette, TrackGlobe } from "./globe";
import s from "./History.module.css";

const OCEANS = [
  { id: "all", label: "All oceans", b: [] as number[] },
  { id: "atl", label: "Atlantic", b: [0, 6] },
  { id: "ep", label: "East Pacific", b: [1] },
  { id: "wp", label: "West Pacific", b: [2] },
  { id: "ni", label: "North Indian", b: [3] },
  { id: "si", label: "South Indian", b: [4] },
  { id: "sp", label: "South Pacific", b: [5] },
];
const STRENGTH = [
  { label: "Everything", tier: 0 },
  { label: "Storms", tier: 1 },
  { label: "Hurricanes", tier: 2 },
  { label: "Majors", tier: 4 },
  { label: "Cat 5", tier: 6 },
];
const SPEEDS = [0.5, 1, 2, 4];
/** Storms within this many miles of your place count as "near you". */
const NEAR_MI = 100;

const fmtDay = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function palette(colors: Colors): Palette {
  return {
    tiers: INTENSITY.map((t) => pick(colors, `trop:${t.key}`, t.color)),
    north: pick(colors, "trop:globe:north", "#ff9a5a"),
    south: pick(colors, "trop:globe:south", "#6cb6ff"),
    pick: pick(colors, "trop:globe:pick", "#ffe08a"),
    land: pick(colors, "trop:globe:land", "#1d2230"),
    ocean: pick(colors, "trop:globe:ocean", "#090c14"),
    coast: pick(colors, "trop:globe:coast", "#4a5370"),
    glow: pick(colors, "trop:globe:glow", "#3d6bd6"),
    equator: pick(colors, "trop:globe:equator", "#8fb3ff"),
  };
}

/**
 * Tropical Outlook → History: every tropical cyclone on record (NOAA's IBTrACS, 1842 to last
 * week) on a 3D globe you can turn and zoom, played back year by year, filtered by years,
 * ocean, strength or your own place, with any storm's numbers a tap away.
 */
export function HistoryView({ colors }: { colors: Colors }) {
  const [t, setT] = useState<Tracks | "error" | null>(null);
  useEffect(() => {
    let on = true;
    loadTracks().then(
      (d) => on && setT(d),
      () => on && setT("error"),
    );
    return () => {
      on = false;
    };
  }, []);
  if (t === "error")
    return (
      <p className={s.note}>
        The storm archive didn&apos;t load. Check your connection and open this
        tab again.
      </p>
    );
  if (!t)
    return (
      <div className={s.stage} aria-busy>
        <p className={s.loading}>Loading 13,000 storms…</p>
      </div>
    );
  return <Explorer t={t} colors={colors} />;
}

function Explorer({ t, colors }: { t: Tracks; colors: Colors }) {
  const S = t.storms;
  const first = 1851;
  const last = useMemo(() => Math.max(...S.y), [S.y]);
  // The Northern Hemisphere's season; the Southern's runs July to June and carries next
  // year's number.
  const thisYear = Math.min(last, new Date().getUTCFullYear());
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const globe = useRef<TrackGlobe | null>(null);
  const yearEl = useRef<HTMLElement>(null);
  const countEl = useRef<HTMLElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(last);
  const [ocean, setOcean] = useState("all");
  const [minTier, setMinTier] = useState(0);
  const [mode, setMode] = useState<Mode>("spin");
  const [near, setNear] = useState<{ label: string; set: Set<number> } | null>(
    null,
  );
  const [noPlace, setNoPlace] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [spin, setSpin] = useState(true);

  const basins = OCEANS.find((o) => o.id === ocean)!.b;
  const kept = useMemo(
    () =>
      keptBy(t, {
        from,
        to,
        basins,
        minTier,
        only: near?.set ?? null,
        query,
      }),
    [t, from, to, basins, minTier, near, query],
  );
  const sum = useMemo(() => summary(t, kept), [t, kept]);
  const famous = useMemo(() => famousIn(t), [t]);
  /** Shown storms' start times, sorted: the playback counter's lookup. */
  const starts = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < t.count; i++) if (kept[i]) out.push(S.t0[i]);
    return out.sort((a, b) => a - b);
  }, [t, kept, S.t0]);
  const span = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < t.count; i++)
      if (kept[i]) {
        lo = Math.min(lo, S.t0[i]);
        hi = Math.max(hi, S.t1[i]);
      }
    return lo < hi ? { lo, hi } : null;
  }, [t, kept, S.t0, S.t1]);

  // The globe: three.js loads with it, after the archive.
  useEffect(() => {
    let on = true;
    let g: TrackGlobe | null = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./globe").then(({ TrackGlobe }) => {
      if (!on || !canvas.current || !labels.current) return;
      try {
        g = new TrackGlobe({
          canvas: canvas.current,
          labels: labels.current,
          tracks: t,
          palette: palette(colors),
          tier: document.documentElement.dataset.tier ?? "high",
          reduced,
          onPick: (i) => setSel(i),
        });
        globe.current = g;
        setReady(true);
      } catch {
        setReady(false);
      }
    });
    return () => {
      on = false;
      g?.dispose();
      globe.current = null;
    };
    // Built once per archive; colors and filters are applied below.
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    globe.current?.setPalette(palette(colors));
  }, [colors, ready]);
  useEffect(() => {
    globe.current?.setKept(kept);
  }, [kept, ready]);
  useEffect(() => {
    globe.current?.setMode(mode);
  }, [mode, ready]);
  useEffect(() => {
    globe.current?.setAutoRotate(spin && !playing && sel === null);
  }, [spin, playing, sel, ready]);
  useEffect(() => {
    globe.current?.select(sel);
  }, [sel, ready]);

  // Labels: the famous storms in view (named as they arrive during playback) and the pick.
  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    const shown = famous.filter((f) => kept[f.i]);
    const list: Label[] =
      playing || sum.storms <= 600
        ? shown.map(({ i, label }) => {
            const f = stormFacts(t, i);
            return {
              key: `f${i}`,
              lat: f.peak.lat,
              lon: f.peak.lon,
              text: label,
              sub: String(f.season),
              from: S.t0[i],
              until: S.t1[i] + 24 * 365 * 3,
            };
          })
        : [];
    if (sel !== null && !list.some((l) => l.key === `f${sel}`)) {
      const f = stormFacts(t, sel);
      list.push({
        key: `f${sel}`,
        lat: f.peak.lat,
        lon: f.peak.lon,
        text: f.name,
        sub: String(f.season),
      });
    }
    g.setLabels(list);
  }, [famous, kept, playing, sum.storms, sel, t, S.t0, S.t1, ready]);

  // Counter and scrubber, written straight to the page each frame (no React render).
  const show = useCallback(
    (now: number) => {
      const year = Number.isFinite(now)
        ? new Date(now * 3600_000).getUTCFullYear()
        : null;
      let n = starts.length;
      if (Number.isFinite(now)) {
        let lo = 0;
        while (lo < n) {
          const mid = (lo + n) >> 1;
          if (starts[mid] <= now) lo = mid + 1;
          else n = mid;
        }
      }
      if (yearEl.current)
        yearEl.current.textContent = year
          ? String(year)
          : from === to
            ? String(from)
            : `${from}–${to}`;
      if (countEl.current)
        countEl.current.textContent = `${n.toLocaleString("en-US")} storm${n === 1 ? "" : "s"}`;
      if (scrub.current && span)
        scrub.current.value = String(
          Number.isFinite(now) ? (now - span.lo) / (span.hi - span.lo) : 1,
        );
    },
    [starts, from, to, span],
  );

  // A new filter shows everything at once again.
  useEffect(() => {
    if (playing) return;
    globe.current?.setClock(Infinity);
    show(Infinity);
  }, [kept, playing, show, ready]);

  // Playback: the whole range in 12 to 60 seconds at 1×, faster or slower by the speed.
  const clock = useRef(Infinity);
  useEffect(() => {
    if (!playing || !span) return;
    const g = globe.current;
    if (!g) return;
    const years = (span.hi - span.lo) / 8766;
    const secs = Math.min(60, Math.max(12, years * 0.34)) / speed;
    const rate = (span.hi - span.lo) / secs; // hours per second
    if (!Number.isFinite(clock.current) || clock.current >= span.hi)
      clock.current = span.lo;
    let last = performance.now();
    let raf = 0;
    const step = (ts: number) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      clock.current = Math.min(span.hi, clock.current + rate * dt);
      g.setClock(clock.current, Math.max(24 * 12, rate * 1.6));
      show(clock.current);
      if (clock.current >= span.hi) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, span, show]);

  const scrubTo = (v: number) => {
    if (!span) return;
    setPlaying(false);
    clock.current = span.lo + v * (span.hi - span.lo);
    globe.current?.setClock(clock.current, 24 * 30);
    show(clock.current);
  };

  const toggleNear = () => {
    if (near) return setNear(null);
    const p = readPlaces();
    const here = p.list.find((x) => x.id === p.active) ?? p.list[0];
    if (!here) return setNoPlace(true);
    setNoPlace(false);
    setNear({
      label: here.label,
      set: stormsNear(t, here.lat, here.lon, NEAR_MI * 1.609),
    });
    globe.current?.flyToLatLon(here.lat, here.lon, 3);
  };

  const pickStorm = (i: number) => {
    setPlaying(false);
    setSel(i);
  };

  const save = () => {
    const url = globe.current?.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `stormsync-hurricanes-${from}-${to}.png`;
    a.click();
  };

  const facts = sel !== null ? stormFacts(t, sel) : null;
  const years = useMemo(
    () => Array.from({ length: last - 1842 + 1 }, (_, k) => 1842 + k),
    [last],
  );
  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const out: number[] = [];
    for (let i = t.count - 1; i >= 0 && out.length < 8; i--)
      if (kept[i]) out.push(i);
    return out;
  }, [query, kept, t.count]);
  const records: [string, number][] = (
    [
      ["Lowest pressure", sum.best.hpa],
      ["Strongest winds", sum.best.kt],
      ["Longest lived", sum.best.days],
      ["Farthest traveled", sum.best.km],
      ["Most energy (ACE)", sum.best.ace],
      ["Most landfalls", sum.best.falls],
    ] as [string, number][]
  ).filter(([, i]) => i >= 0);

  return (
    <div className={s.wrap}>
      <div className={s.stage}>
        <canvas
          ref={canvas}
          className={s.canvas}
          aria-label="Globe of every tropical cyclone track on record. Drag to turn, pinch or scroll to zoom, tap a track for its story."
        />
        <div ref={labels} className={s.labels} aria-hidden />
        <div className={s.counter} aria-live="off">
          <b ref={yearEl}>{from === to ? from : `${from}–${to}`}</b>
          <small ref={countEl}>
            {sum.storms.toLocaleString("en-US")} storms
          </small>
        </div>
        {mode === "spin" && (
          <p className={s.fact}>
            Not one has ever crossed the equator: storms take their spin from
            Earth&apos;s rotation, and on the equator there&apos;s none to give.
          </p>
        )}
        {!ready && <p className={s.loading}>Drawing the globe…</p>}
        <div className={s.tools}>
          <button
            type="button"
            onClick={() => setSpin((v) => !v)}
            aria-pressed={spin}
            title="Turn on its own"
          >
            <RotateCcw aria-hidden />
          </button>
          <button type="button" onClick={save} title="Save as an image">
            <Camera aria-hidden />
          </button>
        </div>
      </div>

      <div className={s.player}>
        <button
          type="button"
          className={s.play}
          onClick={() => {
            setSel(null);
            setPlaying((p) => !p);
          }}
          disabled={!ready || !span}
          aria-label={playing ? "Pause" : "Play the years"}
        >
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </button>
        <input
          ref={scrub}
          type="range"
          min={0}
          max={1}
          step={0.0005}
          defaultValue={1}
          onChange={(e) => scrubTo(Number(e.target.value))}
          aria-label="Move through time"
          className={s.scrub}
        />
        <div className={s.speeds} role="group" aria-label="Speed">
          {SPEEDS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={speed === v}
              onClick={() => setSpeed(v)}
            >
              {v}×
            </button>
          ))}
        </div>
      </div>

      {facts && sel !== null && (
        <section className={s.card} aria-live="polite">
          <header>
            <h3>
              {facts.name} <small>{facts.season}</small>
            </h3>
            <button
              type="button"
              onClick={() => setSel(null)}
              aria-label="Close"
            >
              <X aria-hidden />
            </button>
          </header>
          <p className={s.sub}>
            <i
              style={{
                borderColor: palette(colors).tiers[facts.tier],
                boxShadow: `0 0 8px ${palette(colors).tiers[facts.tier]}`,
              }}
            />
            {INTENSITY[facts.tier].label} · {BASIN_NAME[facts.basin]} ·{" "}
            {fmtDay(facts.start)} to {fmtDay(facts.end)}
          </p>
          <dl className={s.facts}>
            <div>
              <dt>Peak winds</dt>
              <dd>
                {facts.kt ? `${mph(facts.kt)} mph` : "Not recorded"}
                {facts.kt ? <small>{facts.kt} kt</small> : null}
              </dd>
            </div>
            <div>
              <dt>Lowest pressure</dt>
              <dd>
                {facts.hpa ? `${facts.hpa} mb` : "Not recorded"}
                {facts.hpa ? (
                  <small>{(facts.hpa * 0.02953).toFixed(2)} inHg</small>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Lifetime</dt>
              <dd>
                {facts.days} days
                <small>{facts.miles.toLocaleString("en-US")} miles</small>
              </dd>
            </div>
            <div>
              <dt>Energy (ACE)</dt>
              <dd>
                {facts.ace}
                <small>
                  {facts.landfalls
                    ? `${facts.landfalls} landfall${facts.landfalls > 1 ? "s" : ""}`
                    : "No landfall"}
                </small>
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className={s.link}
            onClick={() => {
              setQuery("");
              setFrom(facts.season);
              setTo(facts.season);
              setOcean(
                OCEANS.find((o) => o.b.includes(BASINS.indexOf(facts.basin)))
                  ?.id ?? "all",
              );
            }}
          >
            Show its whole season
          </button>
        </section>
      )}

      <section className={s.card}>
        <header>
          <h3>Filters</h3>
          <button
            type="button"
            className={s.link}
            onClick={() => {
              setFrom(first);
              setTo(last);
              setOcean("all");
              setMinTier(0);
              setNear(null);
              setQuery("");
            }}
          >
            Reset
          </button>
        </header>
        <div className={s.row}>
          <label>
            <span>From</span>
            <select
              value={from}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFrom(v);
                if (v > to) setTo(v);
              }}
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label>
            <span>To</span>
            <select
              value={to}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTo(v);
                if (v < from) setFrom(v);
              }}
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
        <div className={s.chips} role="group" aria-label="Quick years">
          {[
            ["All years", first, last],
            ["Satellite era", 1966, last],
            ["Last 10 years", last - 9, last],
            [`${thisYear} season`, thisYear, thisYear],
          ].map(([l, a, b]) => (
            <button
              key={l as string}
              type="button"
              aria-pressed={from === a && to === b}
              onClick={() => {
                setFrom(a as number);
                setTo(b as number);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div className={s.chips} role="group" aria-label="Ocean">
          {OCEANS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={ocean === o.id}
              onClick={() => setOcean(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className={s.chips} role="group" aria-label="Strength">
          {STRENGTH.map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={minTier === o.tier}
              onClick={() => setMinTier(o.tier)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className={s.chips} role="group" aria-label="Colors">
          <button
            type="button"
            aria-pressed={mode === "strength"}
            onClick={() => setMode("strength")}
          >
            Color by strength
          </button>
          <button
            type="button"
            aria-pressed={mode === "spin"}
            onClick={() => {
              setMode("spin");
              globe.current?.flyToLatLon(0, 120, 4.2);
            }}
          >
            <Compass aria-hidden /> Glow by hemisphere
          </button>
          <button type="button" aria-pressed={!!near} onClick={toggleNear}>
            <MapPin aria-hidden /> Near me
          </button>
        </div>
        {near && (
          <p className={s.note}>
            {near.set.size.toLocaleString("en-US")} storms have passed within{" "}
            {NEAR_MI} miles of {near.label} since records began
            {kept.length
              ? `; ${sum.storms.toLocaleString("en-US")} match the other filters`
              : ""}
            .
          </p>
        )}
        {noPlace && (
          <p className={s.note}>
            Save a place (the location button at the top) to see the storms that
            came near it.
          </p>
        )}
        <label className={s.search}>
          <Search aria-hidden />
          <input
            type="search"
            placeholder="Find a storm by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {results.length > 0 && (
          <ul className={s.results}>
            {results.map((i) => (
              <li key={i}>
                <button type="button" onClick={() => pickStorm(i)}>
                  <b>{S.name[i]}</b> {S.y[i]} · {BASIN_NAME[BASINS[S.b[i]]]} ·{" "}
                  {S.w[i] ? `${mph(S.w[i])} mph` : "winds not recorded"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={s.card}>
        <header>
          <h3>
            {from === to ? `The ${from} season` : `${from} to ${to}`}
            {ocean !== "all" &&
              ` · ${OCEANS.find((o) => o.id === ocean)!.label}`}
          </h3>
        </header>
        <dl className={s.facts}>
          <div>
            <dt>Storms</dt>
            <dd>{sum.storms.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Hurricanes & typhoons</dt>
            <dd>{sum.hurricanes.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Major (Cat 3+)</dt>
            <dd>{sum.majors.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Total energy (ACE)</dt>
            <dd>{sum.ace.toLocaleString("en-US")}</dd>
          </div>
        </dl>
        <p className={s.subhead}>Records in this view</p>
        <div className={s.records}>
          {records.map(([label, i]) => (
            <button key={label} type="button" onClick={() => pickStorm(i)}>
              <small>{label}</small>
              <b>
                {S.name[i] || "Unnamed"} {S.y[i]}
              </b>
            </button>
          ))}
        </div>
      </section>

      <p className={s.foot}>
        Tracks: NOAA NCEI&apos;s IBTrACS (every agency&apos;s best tracks,
        6-hourly), updated {t.storms.built}. Records before the satellite era
        (1966) miss storms that never met a ship or a coast, and early winds are
        estimates. Tap a track for its numbers; drag to turn the globe, pinch or
        scroll to zoom.
      </p>
    </div>
  );
}
