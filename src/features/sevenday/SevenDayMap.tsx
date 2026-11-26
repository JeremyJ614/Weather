"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CloudRain, MapPin, Pause, Play, Snowflake, X } from "lucide-react";
import { UsMap } from "@/features/maps/UsMap";
import type { Colors } from "@/lib/colors/pick";
import { dataFetch, dataUrls, latest } from "@/lib/data/branch";
import {
  codeValues,
  gradient,
  inches,
  lut,
  markColors,
  stops,
  tickAt,
  TICKS,
  type CodeTable,
  type Kind,
} from "./codes";
import type { Built, BuildJob } from "./build";
import type { WorkerOut } from "./build.worker";
import s from "./SevenDay.module.css";

const MotionShare = dynamic(() => import("@/features/share/MotionShare"), {
  ssr: false,
});

export type Report = {
  x: number;
  y: number;
  /** Hours after the window began. */
  t: number;
  k: string;
  m: number | null;
  at: string;
  r: string;
};
export type Meta = {
  kind: Kind;
  built: string;
  start: string;
  end: string;
  steps: string[];
  scale: number;
  codes: CodeTable;
  max: { in: number; x: number; y: number; near: string };
  /** name, state, x, y (canvas), population, running total at each step. */
  cities: [string, string, number, number, number, number[]][];
  reports: Report[];
  source: string;
  /** The week's total in one file (builds from 2026-11-26 on). */
  total?: string;
};

const W = 975;
const H = 610;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const when = (iso: string, withDay = true) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: withDay ? "short" : undefined,
    month: "short",
    day: "numeric",
    hour: "numeric",
    timeZoneName: "short",
  });

/** Pictures from a worker (build.worker.ts), or on the page where workers can't. */
async function* run(job: BuildJob): AsyncGenerator<Built> {
  const expect = job.kind === "total" ? 1 : job.urls.length;
  if (typeof Worker === "function" && typeof OffscreenCanvas !== "undefined") {
    const w = new Worker(new URL("./build.worker.ts", import.meta.url), {
      type: "module",
    });
    const queue: WorkerOut[] = [];
    let wake: (() => void) | null = null;
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      queue.push(e.data);
      wake?.();
    };
    w.onerror = () => {
      queue.push({ error: "worker failed" });
      wake?.();
    };
    w.postMessage(job);
    try {
      for (let got = 0; got < expect;) {
        if (!queue.length) await new Promise<void>((ok) => (wake = ok));
        wake = null;
        const m = queue.shift()!;
        if ("error" in m) throw new Error(m.error);
        got++;
        yield m;
      }
      return;
    } catch {
      /* fall back to the page below */
    } finally {
      w.terminate();
    }
  }
  const b = await import("./build");
  if (job.kind === "total") yield await b.buildTotal(job);
  else yield* b.buildFrames(job);
}

/**
 * The last 7 days of rain (Flooding Outlook) or snow (Winter Center) on the app's national
 * map: the running total piles up step by step (six hours for rain, a day for snow), with the
 * totals at the places that got the most, the flood or snow reports as they came in, and the
 * biggest total marked. Zoom in for the detail (about 2.4 km a pixel); share it as a picture,
 * GIF or video. Rebuilt every morning by the daily data job.
 */
export function SevenDayMap({
  kind,
  colors,
  preview = false,
}: {
  kind: Kind;
  colors: Colors;
  /** The color editor's live preview: the map alone. */
  preview?: boolean;
}) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "none">(
    "loading",
  );
  const [built, setBuilt] = useState(0);
  const [shownTotal, setShownTotal] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, w: W, cssW: 360 });
  const [picked, setPicked] = useState<
    | { kind: "report"; r: Report }
    | { kind: "point"; v: number; near: string | null }
    | null
  >(null);
  const urls = useRef<string[]>([]);
  /** Full-size steps, made the first time a zoomed-in share needs them. */
  const sharp = useRef<Promise<string[]> | null>(null);
  const sharpMake = useRef<(() => Promise<string[]>) | null>(null);
  const codes = useRef<Uint8Array | null>(null);
  const bottom = useRef<SVGImageElement>(null);
  const top = useRef<SVGImageElement>(null);
  const shown = useRef(-1);

  const ramp = useMemo(() => stops(kind, colors), [kind, colors]);
  const marks = useMemo(() => markColors(colors), [colors]);

  // The newest build's numbers.
  useEffect(() => {
    let on = true;
    (async () => {
      const l = await latest();
      if (!l?.[kind]) return on && setStatus("none");
      const m = (await (
        await dataFetch(l, `${kind}/meta.json`)
      ).json()) as Meta;
      if (!on) return;
      setMeta(m);
      setStatus("ready");
      return l;
    })().catch(() => on && setStatus("error"));
    return () => {
      on = false;
    };
  }, [kind]);

  // The pictures, made on this device in the owner's colors: the week's total first (one file,
  // full size, so the map shows right away), then the steps for playback behind it.
  const lutKey = ramp.map((r) => r.color).join();
  useEffect(() => {
    if (!meta) return;
    let on = true;
    const made: string[] = [];
    (async () => {
      const l = await latest();
      if (!l) throw new Error("no build");
      const table = lut(meta.codes, ramp);
      const w = W * meta.scale;
      const h = H * meta.scale;
      const last = meta.steps.length - 1;
      const keep = (png: Blob) => {
        const u = URL.createObjectURL(png);
        made.push(u);
        return u;
      };
      if (meta.total) {
        for await (const f of run({
          kind: "total",
          urls: dataUrls(l, `${kind}/${meta.total}`),
          lut: table,
          w,
          h,
        })) {
          if (!on) return;
          urls.current[last] = keep(f.png);
          codes.current = f.codes ?? null;
          setShownTotal(true);
          showStep(last, false);
          setStep(last);
        }
      }
      // Playback steps at half size (the total keeps its full-size picture). Builds from
      // before the total file existed draw the steps at full size and show as they come.
      const steps = (scale: number) =>
        run({
          kind: "steps",
          urls: meta.steps.map((_, k) =>
            dataUrls(l, `${kind}/d${String(k).padStart(2, "0")}.webp`),
          ),
          lut: table,
          w,
          h,
          scale,
          // Without a total file, the last step brings the codes taps read.
          codes: !meta.total,
        });
      for await (const f of steps(meta.total ? 0.5 : 1)) {
        if (!on) return;
        if (f.codes) codes.current = f.codes;
        if (!(meta.total && f.k === last)) urls.current[f.k] = keep(f.png);
        setBuilt(f.k + 1);
        if (!meta.total && shown.current === f.k - 1) {
          showStep(f.k, f.k > 0);
          setStep(f.k);
          if (f.k === last) setShownTotal(true);
        }
      }
      // A zoomed-in share wants full-size steps: made then, and kept.
      const full = async () => {
        if (!meta.total) return urls.current.slice();
        const out: string[] = [];
        for await (const f of steps(1))
          out[f.k] = f.k === last ? urls.current[last] : keep(f.png);
        return out;
      };
      sharpMake.current = () => (sharp.current ??= full());
    })().catch(() => on && setStatus("error"));
    return () => {
      on = false;
      for (const u of made) URL.revokeObjectURL(u);
      urls.current = [];
      shown.current = -1;
      sharp.current = null;
      sharpMake.current = null;
      setBuilt(0);
      setShownTotal(false);
    };
    // The ramp is keyed by its colors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, kind, lutKey]);

  const n = meta?.steps.length ?? 0;
  const stepMs = kind === "rain" ? 260 : 760;

  /** Shows step k: a cross-fade from the step before when moving forward one, else at once. */
  function showStep(k: number, fade: boolean) {
    const b = bottom.current;
    const t = top.current;
    const u = urls.current[k];
    if (!b || !t || !u) return;
    const from = shown.current;
    shown.current = k;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fade || reduce || k !== from + 1) {
      b.setAttribute("href", u);
      t.style.transition = "none";
      t.style.opacity = "0";
      return;
    }
    t.setAttribute("href", u);
    t.style.transition = `opacity ${Math.round(stepMs * 0.9)}ms linear`;
    t.style.opacity = "1";
    window.setTimeout(() => {
      if (shown.current !== k) return;
      b.setAttribute("href", u);
      t.style.transition = "none";
      t.style.opacity = "0";
    }, stepMs);
  }

  // Playback: from the first step to the last, then it rests on the 7-day total.
  useEffect(() => {
    if (!playing) return;
    let k = shown.current >= n - 1 ? -1 : shown.current;
    if (k < 0) {
      showStep(0, false);
      setStep(0);
      k = 0;
    }
    const id = window.setInterval(() => {
      k++;
      if (k >= n) {
        window.clearInterval(id);
        setPlaying(false);
        return;
      }
      showStep(k, true);
      setStep(k);
    }, stepMs);
    return () => window.clearInterval(id);
    // showStep reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, n, stepMs]);

  const ready = built === n && n > 0;
  const vals = useMemo(() => (meta ? codeValues(meta.codes) : null), [meta]);
  const hours = meta
    ? (new Date(meta.steps[step]).getTime() - new Date(meta.start).getTime()) /
      3600_000
    : 0;

  // Places to label: the biggest 7-day totals in view, the same set all week (their
  // numbers count up as the steps go), never overlapping.
  const px = view.w / Math.max(1, view.cssW);
  const labels = useMemo(() => {
    if (!meta) return [];
    const zoom = W / view.w;
    const want = preview ? 6 : zoom < 1.4 ? 9 : zoom < 3 ? 14 : 22;
    const least = kind === "rain" ? 0.5 : 2;
    const fs = 12 * px;
    const boxes: [number, number, number, number][] = [];
    const out: Meta["cities"] = [];
    for (const c of meta.cities) {
      if (out.length >= want) break;
      const [name, , x, y, , series] = c;
      if (series[series.length - 1] < least) break;
      const w = Math.max(5, name.length * 0.52) * fs;
      // Whole labels only: keep clear of the map's edges.
      if (x - w / 2 < view.x + 4 * px || x + w / 2 > view.x + view.w - 4 * px)
        continue;
      if (y - fs * 2.2 < view.y || y + fs * 1.6 > view.y + (view.w * H) / W)
        continue;
      const b: [number, number, number, number] = [
        x - w / 2,
        y - fs * 2.2,
        x + w / 2,
        y + fs * 1.4,
      ];
      if (
        boxes.some(
          (o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1],
        )
      )
        continue;
      boxes.push(b);
      out.push(c);
    }
    return out;
  }, [meta, view, px, kind, preview]);

  const tap = (x: number, y: number) => {
    if (!meta || !vals) return;
    const r = 10 * px;
    let best: Report | null = null;
    let bd = r;
    for (const rep of meta.reports) {
      if (rep.t > hours) continue;
      const d = Math.hypot(rep.x - x, rep.y - y);
      if (d < bd) {
        bd = d;
        best = rep;
      }
    }
    if (best) return setPicked({ kind: "report", r: best });
    const c = codes.current;
    const sc = meta.scale;
    const v =
      c && x >= 0 && y >= 0 && x < W && y < H
        ? vals[c[Math.floor(y * sc) * W * sc + Math.floor(x * sc)]]
        : 0;
    let near: string | null = null;
    let nd = 25;
    for (const [name, st, cx, cy] of meta.cities) {
      const d = Math.hypot(cx - x, cy - y);
      if (d < nd) {
        nd = d;
        near = `${name}, ${st}`;
      }
    }
    setPicked({ kind: "point", v, near });
  };

  const noun = kind === "rain" ? "rain" : "snow";
  const top8 = meta?.cities.slice(0, 8) ?? [];
  const tickMax = TICKS[kind][TICKS[kind].length - 1];
  const reportsNow = meta?.reports.filter((r) => r.t <= hours) ?? [];

  if (status === "none")
    return (
      <p className={s.note}>
        The 7-day {noun} map is built every morning; the first one is on its
        way. Check back in a few minutes.
      </p>
    );
  if (status === "error")
    return (
      <p className={s.note}>
        The 7-day {noun} map didn&apos;t load. Check your connection and try
        again.
      </p>
    );

  const Icon = kind === "rain" ? CloudRain : Snowflake;
  return (
    <div className={s.wrap}>
      {!preview && meta && (
        <header className={s.head}>
          <div className={s.big}>
            <b>Last 7 days</b>
            <span>
              of {noun} across the lower 48 · {day(meta.start)} to{" "}
              {day(meta.end)}
            </span>
          </div>
          <p className={s.clock} aria-live="off">
            <Icon aria-hidden />
            {kind === "rain" ? "Rain" : "Snow"} so far ·{" "}
            <b>{when(meta.steps[step])}</b>
          </p>
        </header>
      )}
      <UsMap
        title={`${kind === "rain" ? "Rain" : "Snow"}, last 7 days`}
        legend={[]}
        status={!meta ? "loading" : shownTotal || built ? "ready" : "loading"}
        file={`sswx-7-day-${noun}`}
        actions={false}
        towns
        cityNames={false}
        maxZoom={12}
        onView={setView}
        onTap={preview ? undefined : tap}
        overlay={
          meta && (
            <g className={s.overlay}>
              {reportsNow.map((r, i) => (
                <circle
                  key={i}
                  cx={r.x}
                  cy={r.y}
                  r={(kind === "snow" ? 1.15 : 2.1) * px}
                  className={
                    kind === "rain" && hours - r.t < 12 ? s.fresh : s.rep
                  }
                  style={{
                    ["--c" as string]:
                      kind === "rain" ? marks.flood : marks.snow,
                  }}
                />
              ))}
              {step === n - 1 && meta.max.in > 0 && (
                <g
                  className={s.max}
                  transform={`translate(${meta.max.x} ${meta.max.y}) scale(${px})`}
                  style={{ ["--c" as string]: marks.max }}
                >
                  <circle r={9} />
                  <circle r={3} />
                </g>
              )}
              {labels.map(([name, , x, y, , series]) => (
                <g
                  key={name + x}
                  className={s.label}
                  transform={`translate(${x} ${y}) scale(${px})`}
                  // A place shows once some has fallen there (no ".00″" labels).
                  opacity={
                    (series[step] ?? 0) >= (kind === "rain" ? 0.05 : 0.1)
                      ? 1
                      : 0
                  }
                >
                  <circle r={2.6} />
                  <text y={-7} className={s.val}>
                    {inches(series[step] ?? 0)}
                  </text>
                  <text y={13} className={s.name}>
                    {name.toUpperCase()}
                  </text>
                </g>
              ))}
            </g>
          )
        }
      >
        <image
          ref={bottom}
          x={0}
          y={0}
          width={W}
          height={H}
          preserveAspectRatio="none"
          className={s.frame}
        />
        <image
          ref={top}
          x={0}
          y={0}
          width={W}
          height={H}
          preserveAspectRatio="none"
          className={s.frame}
          style={{ opacity: 0 }}
        />
      </UsMap>

      {picked && (
        <button
          type="button"
          className={s.pop}
          onClick={() => setPicked(null)}
          aria-label="Close"
        >
          {picked.kind === "report" ? (
            <>
              <b>
                {picked.r.k}
                {picked.r.m ? ` · ${inches(picked.r.m)}` : ""} · {picked.r.at}
              </b>
              <small>
                {meta &&
                  when(
                    new Date(
                      new Date(meta.start).getTime() + picked.r.t * 3600_000,
                    ).toISOString(),
                  )}
              </small>
              {picked.r.r && <span>{picked.r.r}</span>}
            </>
          ) : (
            <>
              <b>
                {picked.v > 0 ? inches(picked.v) : "None"} of {noun} here in 7
                days
              </b>
              {picked.near && <small>Near {picked.near}</small>}
            </>
          )}
          <X aria-hidden />
        </button>
      )}

      <div className={s.legend}>
        <span>Total {noun} (inches)</span>
        <i style={{ background: gradient(ramp, tickMax) }} />
        <ol>
          {TICKS[kind].map((v) => (
            <li key={v} style={{ left: `${tickAt(v, tickMax) * 100}%` }}>
              {v}
            </li>
          ))}
        </ol>
      </div>

      {!preview && meta && (
        <>
          <div className={s.player}>
            <button
              type="button"
              className={s.play}
              disabled={!ready}
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play the week"}
            >
              {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, n - 1)}
              step={1}
              value={step}
              disabled={!ready}
              onChange={(e) => {
                const k = Number(e.target.value);
                setPlaying(false);
                showStep(k, false);
                setStep(k);
              }}
              aria-label="Move through the week"
              className={s.scrub}
            />
            <small className={s.count}>
              {ready
                ? `${kind === "rain" ? "6-hour step" : "Day"} ${step + 1} of ${n}`
                : `Getting playback ready… ${built} of ${n}`}
            </small>
          </div>

          <div className={s.tiles}>
            <div>
              <small>Biggest total</small>
              <b>{inches(meta.max.in)}</b>
              <span>
                {/ of /.test(meta.max.near) ? "" : "near "}
                {meta.max.near}
              </span>
            </div>
            <div>
              <small>
                {kind === "rain" ? "Places with 2″+" : "Places with 6″+"}
              </small>
              <b>
                {
                  meta.cities.filter(
                    (c) => c[5][c[5].length - 1] >= (kind === "rain" ? 2 : 6),
                  ).length
                }
              </b>
              <span>of the towns we track</span>
            </div>
            <div>
              <small>
                {kind === "rain" ? "Flood reports" : "Snow reports"}
              </small>
              <b>{meta.reports.length}</b>
              <span>from the National Weather Service</span>
            </div>
          </div>

          {top8.length > 0 && (
            <section className={s.list}>
              <h4>
                <MapPin aria-hidden />{" "}
                {kind === "rain" ? "Wettest places" : "Snowiest places"} this
                week
              </h4>
              <ol>
                {top8.map(([name, st, , , , series]) => {
                  const v = series[series.length - 1];
                  return (
                    <li key={name + st}>
                      <span>
                        {name}, {st}
                      </span>
                      <i
                        style={{
                          width: `${Math.max(4, (v / top8[0][5][top8[0][5].length - 1]) * 100)}%`,
                        }}
                      />
                      <b>{inches(v)}</b>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {ready && (
            <MotionShare
              file={`sswx-7-day-${noun}`}
              frames={48}
              heading={`Share the week's ${noun} as`}
              hints={{
                image: "The 7-day total",
                gif: "The week piling up",
                video: "MP4 · 8 s · 1080p",
              }}
              build={async (f, progress) => {
                setPlaying(false);
                const { makeSevenDay } = await import("./share");
                return makeSevenDay(
                  {
                    meta,
                    urls: urls.current,
                    sharp: () =>
                      sharpMake.current?.() ?? Promise.resolve(urls.current),
                    ramp,
                    marks,
                    view: { x: view.x, y: view.y, w: view.w },
                  },
                  f,
                  progress,
                );
              }}
            />
          )}

          <p className={s.foot}>
            {meta.source}, {when(meta.start, false)} to {when(meta.end, false)}
            {kind === "rain"
              ? ", six hours at a time; flood, flash flood and coastal flood reports"
              : ", a day at a time; snowfall reports"}{" "}
            from the National Weather Service (via the Iowa Environmental
            Mesonet). Tap the map for the total anywhere or a report&apos;s
            details; Zoom &amp; pan to look closer. Rebuilt every morning.
          </p>
        </>
      )}
    </div>
  );
}
