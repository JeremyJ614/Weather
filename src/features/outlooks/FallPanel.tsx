"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Leaf, Pause, Play } from "lucide-react";
import { Beam } from "@/components/ui/Beam";
import { UsMap } from "@/features/maps/UsMap";
import { HomeTabs } from "@/features/news/HomeTabs";
import { Section } from "@/features/maps/Section";
import { project } from "@/lib/map/usAlbers";
import { leafColor, timeline, type FallReport } from "@/lib/weather/foliage";
import { FallSeason } from "./FallSeason";
import s from "./FallPanel.module.css";

const MotionShare = dynamic(() => import("@/features/share/MotionShare"), {
  ssr: false,
});

const DAY = 86_400_000;
const fmt = (t: number) =>
  new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Fall subtab: replay the season's first-color reports across the country. */
export function FallPanel({ report }: { report: FallReport | null }) {
  const stops = useMemo(
    () => (report ? timeline(report.start, report.end) : []),
    [report],
  );
  const [i, setI] = useState(Math.max(0, stops.length - 1));
  const [playing, setPlaying] = useState(false);
  const asOf = stops[i] ?? 0;

  // Every site projected once.
  const pts = useMemo(
    () =>
      (report?.sites ?? []).map((st) => {
        const { x, y } = project(st[0], st[1]);
        return { x, y, t: st[2], sp: st[3] };
      }),
    [report],
  );
  // Reports per scrubber step, for the histogram above the track.
  const hist = useMemo(() => {
    const h = stops.map(() => 0);
    let k = 0;
    for (const p of pts) {
      while (k < stops.length - 1 && p.t > stops[k]) k++;
      h[k]++;
    }
    return h;
  }, [pts, stops]);
  const peak = Math.max(1, ...hist);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setI((n) => {
        if (n >= stops.length - 1) {
          setPlaying(false);
          return n;
        }
        return n + 1;
      });
    }, 260);
    return () => clearInterval(t);
  }, [playing, stops.length]);

  // The dot layer only rebuilds when the date moves, not on other renders.
  const dots = useMemo(
    () => (
      <g className={s.dots}>
        {pts.map((p, k) => {
          if (p.t > asOf) return null;
          const age = (asOf - p.t) / DAY;
          return (
            <circle
              key={k}
              cx={p.x}
              cy={p.y}
              r={age < 4 ? 6 : 4.6}
              fill={leafColor(age)}
              className={age < 4 ? s.fresh : undefined}
            />
          );
        })}
      </g>
    ),
    [pts, asOf],
  );

  if (!report) {
    return (
      <p className="panel rounded-2xl p-4 text-sm text-muted">
        The phenology network isn&apos;t answering right now.
      </p>
    );
  }
  const shown = pts.filter((p) => p.t <= asOf);
  const frac = stops.length > 1 ? i / (stops.length - 1) : 1;
  const months = stops.filter(
    (t, k) => k === 0 || new Date(t).getUTCDate() <= 3,
  );

  const replay = (
    <div className="grid gap-5">
      <Section
        icon={<Leaf aria-hidden />}
        eyebrow="USA National Phenology Network"
        title={`Fall color ${report.season}`}
        note={
          <>
            {report.current
              ? "This season so far"
              : "Last season (the next one starts in August)"}
            : every place a volunteer recorded the first colored leaves or
            needles. Each dot is one plant on one date, glowing yellow-green
            when fresh and deepening to red as the turn ages. Press play to
            watch the color sweep south.
          </>
        }
      >
        <UsMap
          title={`Fall color reports · ${fmt(asOf)}`}
          sub={`${report.season} season`}
          legend={[
            { label: "Just turned", color: leafColor(0) },
            { label: "3 weeks", color: leafColor(21) },
            { label: "6+ weeks", color: leafColor(42) },
          ]}
          status="ready"
          file={`sswx-fall-${new Date(asOf).toISOString().slice(0, 10)}`}
          overlay={dots}
        />
      </Section>

      <div className={s.scrub}>
        <div className={s.row}>
          <Beam className={s.playWrap}>
            <button
              className={s.play}
              onClick={() => {
                if (i >= stops.length - 1) setI(0);
                setPlaying(!playing);
              }}
              aria-label={playing ? "Pause" : "Play the season"}
            >
              {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            </button>
          </Beam>
          <div className={s.date}>
            <b>{fmt(asOf)}</b>
            <span>{shown.length.toLocaleString()} reports</span>
          </div>
        </div>
        <div className={s.track}>
          <div className={s.hist} aria-hidden>
            {hist.map((n, k) => (
              <i
                key={k}
                className={k <= i ? s.on : undefined}
                style={{ transform: `scaleY(${Math.max(0.04, n / peak)})` }}
              />
            ))}
          </div>
          <div className={s.rail} aria-hidden>
            <span className={s.fill} style={{ transform: `scaleX(${frac})` }} />
            <span
              className={s.lane}
              style={{ transform: `translateX(${frac * 100}%)` }}
            >
              <i className={s.thumb} />
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={stops.length - 1}
            value={i}
            onChange={(e) => {
              setPlaying(false);
              setI(Number(e.target.value));
            }}
            aria-label="Season date"
            aria-valuetext={fmt(asOf)}
            className={s.range}
          />
          <div className={s.months} aria-hidden>
            {months.map((t) => (
              <span
                key={t}
                style={{
                  left: `${(stops.indexOf(t) / Math.max(1, stops.length - 1)) * 100}%`,
                }}
              >
                {new Date(t).toLocaleDateString("en-US", {
                  month: "short",
                  timeZone: "UTC",
                })}
              </span>
            ))}
          </div>
        </div>
      </div>
      <MotionShare
        file={`sswx-fall-color-${report.season}`}
        frames={stops.length}
        heading="Share the fall color as"
        hints={{
          image: `The map on ${fmt(asOf)}`,
          gif: "The color sweeping south",
          video: "MP4 · 9 s · 1080p",
        }}
        build={async (f, progress) => {
          setPlaying(false);
          const { makeFall } = await import("./fallShare");
          return makeFall(report, asOf, f, progress);
        }}
      />
    </div>
  );
  const season = <FallSeason report={report} asOf={asOf} />;
  return (
    <HomeTabs
      label="Fall color"
      variant="pills"
      tabs={[
        { id: "fall-map", label: "Color Map", panel: replay },
        { id: "fall-season", label: "Season Stats", panel: season },
      ]}
    />
  );
}
