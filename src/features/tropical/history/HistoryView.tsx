"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Compass,
  MapPin,
  MapPinned,
  Pause,
  Play,
  RotateCcw,
  ScanEye,
  Search,
  SkipBack,
  SkipForward,
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
  loadPlaces,
  loadRadii,
  loadTracks,
  stormAt,
  stormFacts,
  stormsNear,
  summary,
  tierIndex,
  type Tracks,
} from "./data";
import type { Label, Mode, Palette, TrackGlobe } from "./globe";
import type { Clip } from "./share";
import s from "./History.module.css";

// The share sheet Radar and Model Runs use, loaded when the tab is.
const MotionShare = dynamic(() => import("@/features/share/MotionShare"), {
  ssr: false,
});

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

/** A storm's date from epoch hours. */
const fmtDate = (h: number) =>
  new Date(h * 3600_000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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
    border: pick(colors, "trop:globe:border", "#9fb1d9"),
    stateLine: pick(colors, "trop:globe:state-line", "#6f7fa6"),
    placeCountry: pick(colors, "trop:globe:place-country", "#d7e0f5"),
    placeState: pick(colors, "trop:globe:place-state", "#9eabcb"),
    placeTown: pick(colors, "trop:globe:place-town", "#f4f6ff"),
    wind: pick(colors, "trop:globe:wind", "#7fd8ff"),
    impact: pick(colors, "trop:globe:impact", "#4fe0ff"),
  };
}

/** Storm View's pace at 1×: a few seconds a storm, longer for long-lived ones. */
const SV_INTRO = 1.1;
const SV_OUTRO = 1.4;
const svRun = (days: number) => Math.min(9, Math.max(3.5, 2.6 + days * 0.42));

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
  const overlay = useRef<HTMLCanvasElement>(null);
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
  const [places, setPlaces] = useState(false);
  const [placesErr, setPlacesErr] = useState(false);
  /** Storm View: the storms it plays (in order) and which one is on. */
  const [sv, setSv] = useState<{ list: number[]; at: number } | null>(null);
  const [svPlaying, setSvPlaying] = useState(false);
  const [svNone, setSvNone] = useState(false);

  // A tap on the globe: in Storm View, jump to that storm when it's on the list.
  const pickRef = useRef<(i: number | null) => void>(() => {});
  useEffect(() => {
    pickRef.current = (i) => {
      if (sv) {
        if (i === null) return;
        const at = sv.list.indexOf(i);
        if (at >= 0) setSv({ ...sv, at });
        return;
      }
      setSel(i);
    };
  });

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
      if (!on || !canvas.current || !labels.current || !overlay.current) return;
      try {
        g = new TrackGlobe({
          canvas: canvas.current,
          overlay: overlay.current,
          labels: labels.current,
          tracks: t,
          palette: palette(colors),
          tier: document.documentElement.dataset.tier ?? "high",
          reduced,
          onPick: (i) => pickRef.current(i),
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
    globe.current?.setAutoRotate(spin && !playing && sel === null && !sv);
  }, [spin, playing, sel, sv, ready]);
  const svOn = sv !== null;
  useEffect(() => {
    if (!svOn) globe.current?.select(sel);
  }, [sel, svOn, ready]);

  // Places: borders and names, loaded the first time they're asked for.
  useEffect(() => {
    let on = true;
    if (!places) {
      globe.current?.setPlaces(null);
      return;
    }
    loadPlaces().then(
      (p) => on && (setPlacesErr(false), globe.current?.setPlaces(p)),
      () => on && (setPlacesErr(true), setPlaces(false)),
    );
    return () => {
      on = false;
    };
  }, [places, ready]);

  // Labels: the famous storms in view (named as they arrive during playback) and the pick.
  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    // Storm View draws its own label over the storm it follows.
    if (svOn) return g.setLabels([]);
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
  }, [famous, kept, playing, sum.storms, sel, t, S.t0, S.t1, svOn, ready]);

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
    if (playing || svOn) return;
    globe.current?.setClock(Infinity);
    show(Infinity);
  }, [kept, playing, show, svOn, ready]);

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

  // Storm View ------------------------------------------------------------------------
  /** The storms Storm View plays: named storms (or stronger, by the filter), oldest first. */
  const svList = useMemo(() => {
    const out: number[] = [];
    const floor = Math.max(1, minTier);
    for (let i = 0; i < t.count; i++)
      if (kept[i] && tierIndex(S.w[i]) >= floor) out.push(i);
    return out.sort((a, b) => S.t0[a] - S.t0[b]);
  }, [t, kept, minTier, S.w, S.t0]);
  const radii = useRef<Awaited<ReturnType<typeof loadRadii>> | null>(null);
  /** Seconds into the current storm's show (intro, its run, outro), at 1×. */
  const svClock = useRef(0);
  const svCur = sv ? sv.list[sv.at] : null;

  const svRunFor = useCallback(
    (i: number) => svRun((S.t1[i] - S.t0[i]) / 24),
    [S.t0, S.t1],
  );
  /** Hours into the storm at a point in its show. */
  const svHours = useCallback(
    (i: number, c: number) => {
      const last = t.hour[S.o[i] + S.n[i] - 1];
      const run = svRunFor(i);
      if (c <= SV_INTRO) return 0;
      if (c >= SV_INTRO + run) return last;
      return ((c - SV_INTRO) / run) * last;
    },
    [t, S.o, S.n, svRunFor],
  );
  const svShow = useCallback(
    (i: number, h: number, at: number, of: number) => {
      if (yearEl.current) yearEl.current.textContent = fmtDate(S.t0[i] + h);
      if (countEl.current)
        countEl.current.textContent = `Storm ${(at + 1).toLocaleString("en-US")} of ${of.toLocaleString("en-US")}`;
      if (scrub.current) {
        const last = t.hour[S.o[i] + S.n[i] - 1] || 1;
        scrub.current.value = String(Math.min(1, h / last));
      }
    },
    [S.t0, S.o, S.n, t],
  );

  const startStormView = () => {
    setPlaying(false);
    if (!svList.length) return setSvNone(true);
    setSvNone(false);
    const from = sel !== null ? svList.indexOf(sel) : -1;
    setSv({ list: svList, at: Math.max(0, from) });
    setSvPlaying(true);
    loadRadii(t).then(
      (r) => {
        radii.current = r;
        globe.current?.setRadii(r);
      },
      () => {},
    );
  };
  const exitStormView = () => {
    setSvPlaying(false);
    setSv(null);
    globe.current?.stormStop();
  };
  const svJump = (d: number) =>
    setSv((v) =>
      v ? { ...v, at: Math.min(v.list.length - 1, Math.max(0, v.at + d)) } : v,
    );

  // A new storm: start it on the globe from the top of its show.
  useEffect(() => {
    const g = globe.current;
    if (svCur === null || !g || !sv) return;
    svClock.current = 0;
    g.stormStart(svCur, radii.current);
    g.stormFade(1);
    g.stormStep(0, 0, false);
    svShow(svCur, 0, sv.at, sv.list.length);
    // Each storm starts once, when it comes up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svCur, sv?.at, ready]);

  // Storm View's clock: the storm runs along its path, holds a moment, then the next begins.
  useEffect(() => {
    if (!sv || !svPlaying || svCur === null) return;
    const g = globe.current;
    if (!g) return;
    const i = svCur;
    const run = svRunFor(i);
    const total = SV_INTRO + run + SV_OUTRO;
    let last = performance.now();
    let raf = 0;
    const step = (ts: number) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      svClock.current += dt * speed;
      const c = svClock.current;
      if (c >= total) {
        if (sv.at + 1 < sv.list.length) svJump(1);
        else setSvPlaying(false);
        return;
      }
      const h = svHours(i, c);
      g.stormStep(h, dt);
      // The land glow holds through the outro, then dims as the next storm comes up.
      const out = c - SV_INTRO - run;
      g.stormFade(
        out > SV_OUTRO * 0.55
          ? Math.max(0.25, 1 - (out - SV_OUTRO * 0.55) / (SV_OUTRO * 0.45))
          : 1,
      );
      svShow(i, h, sv.at, sv.list.length);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sv, svPlaying, svCur, speed, svHours, svRunFor, svShow]);

  const scrubTo = (v: number) => {
    if (sv && svCur !== null) {
      // Storm View: move along this storm's path.
      setSvPlaying(false);
      const run = svRunFor(svCur);
      svClock.current = SV_INTRO + Math.min(1, Math.max(0, v)) * run;
      const h = svHours(svCur, svClock.current);
      globe.current?.stormStep(h, 1);
      globe.current?.stormFade(1);
      svShow(svCur, h, sv.at, sv.list.length);
      return;
    }
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
    if (sv) {
      const at = sv.list.indexOf(i);
      if (at >= 0) return setSv({ ...sv, at });
      exitStormView();
    }
    setSel(i);
  };

  /** The storm whose numbers show: Storm View's current storm, else the picked one. */
  const shown = svCur ?? sel;
  const facts = shown !== null ? stormFacts(t, shown) : null;

  /** What the share files show: the picked storm along its track, or this view's years. */
  const clip = (g: TrackGlobe): Clip => {
    const foot =
      "Tracks: NOAA NCEI IBTrACS · Land: Natural Earth and NASA Blue Marble";
    const oceanName = OCEANS.find((o) => o.id === ocean)!.label;
    if (svCur !== null) {
      // Storm View: the camera rides with the storm, its winds and the land they touched.
      const i = svCur;
      const f = stormFacts(t, i);
      const o = S.o[i];
      const n = S.n[i];
      return {
        globe: g,
        title: `${f.name} ${f.season}`,
        sub: `Storm View · peak ${INTENSITY[f.tier].label}${f.kt ? ` · ${mph(f.kt)} mph` : ""} · ${BASIN_NAME[f.basin]}`,
        from: S.t0[i],
        to: S.t0[i] + t.hour[o + n - 1],
        fresh: 30,
        turn: 0,
        counter: (h) => {
          // The same strength the label over the storm shows at that moment.
          const at = stormAt(t, i, h - S.t0[i]);
          return [
            fmtDate(h),
            at.known && at.kt
              ? `${INTENSITY[tierIndex(at.kt)].short.toUpperCase()} · ${mph(at.kt)} MPH`
              : "TRACK",
          ];
        },
        foot: `${foot} · Glow: land under its tropical-storm-force winds`,
      };
    }
    if (sel !== null) {
      const f = stormFacts(t, sel);
      const o = S.o[sel];
      const n = S.n[sel];
      const day = (h: number) =>
        new Date(h * 3600_000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });
      return {
        globe: g,
        title: `${f.name} ${f.season}`,
        sub: `${INTENSITY[f.tier].label} · ${BASIN_NAME[f.basin]} · ${f.kt ? `${mph(f.kt)} mph peak` : "winds not recorded"}${f.hpa ? ` · ${f.hpa} mb` : ""}`,
        from: S.t0[sel],
        to: S.t1[sel],
        fresh: 36,
        turn: 0,
        counter: (h) => {
          // The storm's strength at that moment along its track.
          let p = o;
          while (p < o + n - 1 && S.t0[sel] + t.hour[p + 1] <= h) p++;
          const kt = t.wind[p] === 255 ? 0 : t.wind[p];
          return [
            day(h),
            kt ? `${INTENSITY[tierIndex(kt)].short} · ${mph(kt)} MPH` : "TRACK",
          ];
        },
        label: {
          lat: f.peak.lat,
          lon: f.peak.lon,
          text: f.name,
          sub: String(f.season),
        },
        foot,
      };
    }
    const range = from === to ? `The ${from} season` : `${from} to ${to}`;
    return {
      globe: g,
      title: from === to ? range : "Every tropical cyclone on record",
      sub: `${from === to ? "" : `${range} · `}${oceanName}${minTier ? ` · ${STRENGTH.find((x) => x.tier === minTier)!.label}` : ""}${near ? ` · within ${NEAR_MI} mi of ${near.label}` : ""}`,
      from: span!.lo,
      to: span!.hi,
      fresh: Math.max(24 * 20, (span!.hi - span!.lo) / 30),
      turn: 28,
      counter: (h) => {
        let n = 0;
        let hi = starts.length;
        while (n < hi) {
          const mid = (n + hi) >> 1;
          if (starts[mid] <= h) n = mid + 1;
          else hi = mid;
        }
        return [
          String(new Date(h * 3600_000).getUTCFullYear()),
          `${n.toLocaleString("en-US")} STORMS`,
        ];
      },
      foot,
    };
  };
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
        <canvas ref={overlay} className={s.overlay} aria-hidden />
        <div ref={labels} className={s.labels} aria-hidden />
        <div className={s.counter} aria-live="off">
          <b ref={yearEl}>{from === to ? from : `${from}–${to}`}</b>
          <small ref={countEl}>
            {sum.storms.toLocaleString("en-US")} storms
          </small>
        </div>
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
        </div>
      </div>

      <div className={s.player}>
        {sv && (
          <button
            type="button"
            className={s.skip}
            onClick={() => svJump(-1)}
            disabled={sv.at === 0}
            aria-label="Previous storm"
          >
            <SkipBack aria-hidden />
          </button>
        )}
        <button
          type="button"
          className={s.play}
          onClick={() => {
            if (sv) {
              // At the end of the last storm, play starts it again.
              if (
                !svPlaying &&
                svClock.current >=
                  SV_INTRO + svRunFor(sv.list[sv.at]) + SV_OUTRO
              ) {
                svClock.current = 0;
                globe.current?.stormStart(sv.list[sv.at], radii.current);
              }
              return setSvPlaying((p) => !p);
            }
            setSel(null);
            setPlaying((p) => !p);
          }}
          disabled={!ready || !span}
          aria-label={
            sv
              ? svPlaying
                ? "Pause Storm View"
                : "Play Storm View"
              : playing
                ? "Pause"
                : "Play the years"
          }
        >
          {(sv ? svPlaying : playing) ? (
            <Pause aria-hidden />
          ) : (
            <Play aria-hidden />
          )}
        </button>
        {sv && (
          <button
            type="button"
            className={s.skip}
            onClick={() => svJump(1)}
            disabled={sv.at >= sv.list.length - 1}
            aria-label="Next storm"
          >
            <SkipForward aria-hidden />
          </button>
        )}
        <input
          ref={scrub}
          type="range"
          min={0}
          max={1}
          step={0.0005}
          defaultValue={1}
          onChange={(e) => scrubTo(Number(e.target.value))}
          aria-label={sv ? "Move along this storm's path" : "Move through time"}
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

      <div className={s.modes}>
        <button
          type="button"
          className={s.mode}
          aria-pressed={!!sv}
          onClick={() => (sv ? exitStormView() : startStormView())}
          disabled={!ready}
        >
          {sv ? <X aria-hidden /> : <ScanEye aria-hidden />}
          {sv ? "Exit Storm View" : "Storm View"}
        </button>
        <button
          type="button"
          className={s.mode}
          aria-pressed={places}
          onClick={() => setPlaces((v) => !v)}
          disabled={!ready}
        >
          <MapPinned aria-hidden /> Places
        </button>
      </div>
      {(svNone || placesErr) && (
        <p className={s.note}>
          {svNone
            ? "No named storms match these filters. Widen the years or the ocean, then try Storm View again."
            : "The place names didn't load. Check your connection and try again."}
        </p>
      )}
      {sv && (
        <p className={s.note}>
          Storm View plays each named storm in your filters one at a time,
          oldest first, the camera riding with it. Land its tropical-storm-force
          winds touched lights up as it passes. Tap a track to jump to that
          storm.
        </p>
      )}

      {ready && span && (
        <MotionShare
          file={
            shown !== null
              ? `sswx-${(S.name[shown] || "storm").toLowerCase()}-${S.y[shown]}${svCur !== null ? "-storm-view" : ""}`
              : `sswx-hurricanes-${from}-${to}`
          }
          frames={48}
          heading={
            svCur !== null
              ? `Share ${S.name[svCur] || "this storm"}'s Storm View as`
              : sel !== null
                ? `Share ${S.name[sel] || "this storm"} as`
                : "Share this globe as"
          }
          hints={{
            image: "This view",
            gif: "48 frames · 1080p",
            video: "MP4 · 8 s · 1080p",
          }}
          build={async (f, progress) => {
            const g = globe.current;
            if (!g) throw new Error("no globe");
            setPlaying(false);
            setSvPlaying(false);
            const { makeGlobe } = await import("./share");
            return makeGlobe(clip(g), f, progress);
          }}
        />
      )}

      {facts && shown !== null && (
        <section className={s.card} aria-live="polite">
          <header>
            <h3>
              {facts.name} <small>{facts.season}</small>
            </h3>
            <button
              type="button"
              onClick={() => (sv ? exitStormView() : setSel(null))}
              aria-label={sv ? "Exit Storm View" : "Close"}
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
          {!sv && (
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
          )}
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
        Tracks: NOAA NCEI&apos;s IBTrACS (every agency&apos;s best tracks, every
        recorded fix), updated {t.storms.built}. Land: Natural Earth coastlines
        shaded with NASA&apos;s Blue Marble relief; places from Natural Earth.
        Storm View&apos;s wind fields are the agencies&apos; measured 34 knot
        radii where they exist (most basins since about 2004) and estimated from
        strength before that. The archive is rebuilt every morning, so a storm
        NOAA logs shows up the next day. Records before the satellite era (1966)
        miss storms that never met a ship or a coast, and early winds are
        estimates. Tap a track for its numbers; drag to turn the globe, pinch or
        scroll to zoom.
      </p>
    </div>
  );
}
