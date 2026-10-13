"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { WeatherMap, type AnyMap } from "@/features/map/WeatherMap";
import { leafColor, timeline, type FallReport } from "@/lib/weather/foliage";

const DAY = 86_400_000;
const fmt = (t: number) =>
  new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

type GeoSource = { setData(d: object): void };

function collection(report: FallReport, asOf: number) {
  return {
    type: "FeatureCollection",
    features: report.sites
      .filter((s) => s[2] <= asOf)
      .map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s[0], s[1]] },
        properties: { c: leafColor((asOf - s[2]) / DAY) },
      })),
  };
}

/** Fall Forecast subtab: replay the season's first-color reports across the country. */
export function FallPanel({ report }: { report: FallReport | null }) {
  const stops = useMemo(
    () => (report ? timeline(report.start, report.end) : []),
    [report],
  );
  const [i, setI] = useState(Math.max(0, stops.length - 1));
  const [playing, setPlaying] = useState(false);
  const map = useRef<AnyMap | null>(null);
  const asOf = stops[i] ?? 0;

  useEffect(() => {
    const src =
      map.current &&
      (
        map.current as unknown as {
          getSource(id: string): GeoSource | undefined;
        }
      ).getSource("fall");
    if (src && report) src.setData(collection(report, asOf));
  }, [asOf, report]);

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
    }, 350);
    return () => clearInterval(t);
  }, [playing, stops.length]);

  if (!report) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        The phenology network isn&apos;t answering right now.
      </p>
    );
  }
  const shown = report.sites.filter((s) => s[2] <= asOf);
  const recent = shown.filter((s) => asOf - s[2] <= 14 * DAY).length;
  const counts = new Map<number, number>();
  shown.forEach((s) => counts.set(s[3], (counts.get(s[3]) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <section className="grid gap-3">
      <h2 className="display text-2xl text-accent">
        Fall color {report.season}
      </h2>
      <p className="text-sm text-muted">
        {report.current
          ? "This season so far"
          : "Last season (the next one starts in August)"}
        : every place a volunteer recorded the first colored leaves or needles,
        from the USA National Phenology Network. Each dot is one plant on one
        date; it reddens as the turn ages.
      </p>
      <WeatherMap
        center={[-92, 40]}
        zoom={3}
        label="Fall color reports map"
        className="h-96"
        onReady={({ map: m }) => {
          map.current = m;
          const mm = m as unknown as {
            addSource(id: string, s: object): void;
            addLayer(l: object): void;
          };
          mm.addSource("fall", {
            type: "geojson",
            data: collection(report, asOf),
          });
          mm.addLayer({
            id: "fall",
            type: "circle",
            source: "fall",
            paint: {
              "circle-radius": 4,
              "circle-color": ["get", "c"],
              "circle-stroke-width": 0.6,
              "circle-stroke-color": "rgba(0,0,0,.55)",
            },
          });
        }}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (i >= stops.length - 1) setI(0);
            setPlaying(!playing);
          }}
          aria-label={playing ? "Pause" : "Play the season"}
          className="grid size-11 flex-none place-items-center rounded-full border border-accent bg-lit text-accent"
        >
          {playing ? (
            <Pause className="size-5" aria-hidden />
          ) : (
            <Play className="size-5" aria-hidden />
          )}
        </button>
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
          className="flex-1 accent-[var(--accent)]"
        />
        <span className="mono w-16 text-right text-sm">{fmt(asOf)}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-line bg-surface p-3">
          <dt className="text-muted">Reports by {fmt(asOf)}</dt>
          <dd className="text-lg font-bold">{shown.length.toLocaleString()}</dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <dt className="text-muted">In the last 2 weeks</dt>
          <dd className="text-lg font-bold">{recent.toLocaleString()}</dd>
        </div>
      </dl>
      {top.length > 0 && (
        <p className="text-sm text-muted">
          Most reported:{" "}
          {top.map(([sp, n], k) => (
            <span key={sp}>
              {k ? ", " : ""}
              {report.species[sp]} ({n})
            </span>
          ))}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-muted">
        <span>Just turned</span>
        <span
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${leafColor(0)}, ${leafColor(21)}, ${leafColor(42)})`,
          }}
          aria-hidden
        />
        <span>6+ weeks ago</span>
      </div>
    </section>
  );
}
