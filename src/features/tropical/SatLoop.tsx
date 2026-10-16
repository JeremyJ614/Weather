"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { Frame } from "@/lib/tropical/sat";

type Data = { label: string; frames: Frame[] };
const SPEEDS = [0.5, 1, 2];
// Loops longer than a day (model runs) need the weekday on each frame.
const hhmm = (iso: string, long = false) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    ...(long ? { weekday: "short" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * A GeoColor satellite loop that plays smoothly: every frame is downloaded and decoded
 * before playback starts, frames advance on animation frames rather than timers, and each
 * one dissolves into the next (opacity only). The newest frame holds a beat at the end.
 */
export function SatLoop({
  src,
  url,
  ratio = "5 / 3",
}: {
  src: string;
  /** Any endpoint returning { label, frames }; frames then spanning days show the weekday. */
  url?: string;
  ratio?: string;
}) {
  const [data, setData] = useState<Data | "error" | null>(null);
  const [ready, setReady] = useState(0);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const base = useRef<HTMLImageElement>(null);
  const top = useRef<HTMLImageElement>(null);
  const keep = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    let live = true;
    const big =
      document.documentElement.dataset.tier !== "low" &&
      devicePixelRatio > 1.5 &&
      innerWidth > 700;
    fetch(
      url ??
        `/api/tropical/sat?src=${encodeURIComponent(src)}${big ? "&big=1" : ""}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (d: Data) => {
        if (!live) return;
        setData(d);
        setIdx(d.frames.length - 1);
        // Decode four at a time, oldest first: the order they play in.
        const queue = d.frames.map((f, i) => ({ f, i }));
        const worker = async () => {
          for (let job = queue.shift(); job && live; job = queue.shift()) {
            const img = new Image();
            img.src = job.f.url;
            await img.decode().catch(() => {});
            keep.current[job.i] = img;
            if (live) setReady((n) => n + 1);
          }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
      })
      .catch(() => live && setData("error"));
    return () => {
      live = false;
    };
  }, [src, url]);

  const frames = data && data !== "error" ? data.frames : [];
  const n = frames.length;
  const loaded = n > 0 && ready >= n;

  useEffect(() => {
    if (!loaded || !playing || !base.current || !top.current) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const per = 260 / speed;
    let i = idx < 0 || idx >= n - 1 ? 0 : idx;
    let t0 = performance.now();
    let raf = 0;
    const b = base.current;
    const t = top.current;
    b.src = frames[i].url;
    t.src = frames[(i + 1) % n].url;
    t.style.opacity = "0";
    const tick = (now: number) => {
      const dur = i === n - 1 ? per + 1100 : per;
      const e = now - t0;
      if (!calm && i !== n - 1)
        t.style.opacity = String(
          Math.max(0, Math.min(1, (e - dur * 0.35) / (dur * 0.65))),
        );
      if (e >= dur) {
        i = (i + 1) % n;
        t0 = now;
        b.src = frames[i].url;
        t.style.opacity = "0";
        t.src = frames[(i + 1) % n].url;
        setIdx(i);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // idx is only the starting point; frames come with n.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, playing, speed, n]);

  const show = (i: number) => {
    setPlaying(false);
    const k = (i + n) % n;
    setIdx(k);
    if (base.current) base.current.src = frames[k].url;
    if (top.current) top.current.style.opacity = "0";
  };

  if (data === "error")
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        Satellite frames aren&apos;t available right now. Try again in a few
        minutes.
      </p>
    );
  const cur = frames[Math.max(0, idx)];
  const label = data?.label ?? "Satellite";
  return (
    <figure className="grid gap-2">
      <div
        className="relative overflow-hidden rounded-2xl border border-line bg-black"
        style={{ aspectRatio: ratio }}
      >
        {cur && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- live NOAA frames, decoded ahead */}
            <img
              ref={base}
              src={cur.url}
              alt={`${label} at ${hhmm(cur.at, !!url)}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- the next frame, fading in */}
            <img
              ref={top}
              src={cur.url}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover opacity-0"
            />
          </>
        )}
        {!loaded && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <i
              className="block h-full origin-left bg-accent transition-transform duration-300"
              style={{ transform: `scaleX(${n ? ready / n : 0})` }}
            />
          </div>
        )}
        {cur && (
          <span className="mono absolute top-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-xs text-white">
            {hhmm(cur.at, !!url)} CT
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous frame"
          disabled={!loaded}
          onClick={() => show(idx - 1)}
          className="grid size-10 place-items-center rounded-xl border border-line disabled:opacity-40"
        >
          <SkipBack className="size-4" />
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          disabled={!loaded}
          onClick={() => setPlaying(!playing)}
          className="grid size-10 place-items-center rounded-xl border border-[var(--lit-line)] text-accent disabled:opacity-40"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Next frame"
          disabled={!loaded}
          onClick={() => show(idx + 1)}
          className="grid size-10 place-items-center rounded-xl border border-line disabled:opacity-40"
        >
          <SkipForward className="size-4" />
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, n - 1)}
          value={Math.max(0, idx)}
          disabled={!loaded}
          onChange={(e) => show(+e.target.value)}
          aria-label="Frame"
          className="min-w-0 flex-1 accent-[var(--accent)]"
        />
        <button
          type="button"
          onClick={() =>
            setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])
          }
          className="mono min-h-10 rounded-xl border border-line px-2 text-xs"
          aria-label="Speed"
        >
          {speed}×
        </button>
      </div>
      <figcaption className="text-xs text-muted">
        {loaded
          ? `${label} · ${n} frames, ${frames[0] ? hhmm(frames[0].at, !!url) : ""}–${cur ? hhmm(frames[n - 1].at, !!url) : ""} CT${url ? "" : " · NOAA/NESDIS STAR"}`
          : `Loading frames… ${ready}/${n || "–"}`}
      </figcaption>
    </figure>
  );
}
