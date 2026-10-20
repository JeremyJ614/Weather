"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Colors } from "@/lib/colors/pick";
import type { ChaseDay } from "@/lib/chase/engine";
import type { Ledger } from "@/app/storm-chasing-outlook/ChaseParts";
import { ChaseView } from "@/app/storm-chasing-outlook/ChaseView";
import { IngredientsView } from "@/app/atmospheric-ingredients/IngredientsView";
import { TimingView } from "@/app/storm-timing-index/TimingView";
import { ConView } from "@/app/sswxcon/ConView";
import { Ladder } from "@/app/sswxcon/Trend";
import { Compare } from "@/app/radar-model-runs/RadarView";
import { HodoPanel, SkewPanel } from "@/app/3d-soundings/SoundingsView";
import { KpPanel, OvalMap, type Now } from "@/app/aurora-center/AuroraView";
import { BadgePlate } from "@/components/BadgeIcon";
import { usePlaces } from "@/features/location/usePlaces";
import { PASTEL, type Pastel } from "@/lib/ingredients/calc";
import { HAZ, HAZARDS, RISK, type Haz } from "@/lib/timing/calc";
import type { National } from "@/lib/sswxcon/live";
import { analyze, type Sounding } from "@/lib/soundings/thermo";
import { SND_BANDS, SND_LINES } from "@/lib/soundings/style";
import { AURORA_LINES, AURORA_RAMP, KP_SCALE } from "@/lib/aurora/style";
import { RARITIES } from "@/lib/badges";
import {
  CC_STOPS,
  FOLD,
  RADAR_STOPS,
  VEL_STOPS,
} from "@/features/replay/palette";
import { chasePreview } from "./actions";

/**
 * Previews that are pages rather than maps (Fix-It List #17): the real components, fed the
 * colors being edited, so a change shows exactly as members will see it.
 */
type W = (p: { colors: Colors }) => ReactNode;

function useFetch<T>(url: string | null) {
  const [d, setD] = useState<{ url: string; v: T | "error" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let on = true;
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject()))
      .then((v) => on && setD({ url, v }))
      .catch(() => on && setD({ url, v: "error" }));
    return () => {
      on = false;
    };
  }, [url]);
  return d?.url === url ? d.v : null;
}

const now = () => Date.now();

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-muted">{children}</p>
);
const Wait = ({ v, what }: { v: unknown; what: string }) =>
  v === "error" ? (
    <Note>{what} isn&apos;t answering right now.</Note>
  ) : (
    <Note>Loading {what}…</Note>
  );

const Ingredients: W = ({ colors }) => {
  const tones = Object.fromEntries(
    Object.entries(PASTEL).map(([k, v]) => [k, colors[`ing:${k}`] ?? v]),
  ) as Record<Pastel, string>;
  return <IngredientsView tones={tones} />;
};

const Timing: W = ({ colors }) => (
  <TimingView
    colors={{
      haz: Object.fromEntries(
        HAZARDS.map((k) => [k, colors[`timing:${k}`] ?? HAZ[k].color]),
      ) as Record<Haz, string>,
      risk: RISK.map((r, i) => colors[`timing:risk:${i}`] ?? r.color),
    }}
  />
);

const SswxCon: W = ({ colors }) => {
  const n = useFetch<National>("/api/sswxcon");
  if (!n || n === "error") return <Wait v={n} what="the national score" />;
  const live: National = {
    ...n,
    bands: n.bands.map((b, i) => ({
      ...b,
      color: colors[`sswx:band:${i}`] ?? b.color,
    })),
    components: n.components.map((c) => ({
      ...c,
      color: colors[`sswx:part:${c.key}`] ?? c.color,
    })),
  };
  return (
    <div className="grid gap-4">
      <ConView key={JSON.stringify(colors)} initial={live} />
      <Ladder total={live.total} bands={live.bands} />
    </div>
  );
};

const Chase: W = ({ colors }) => {
  const [d, setD] = useState<
    { day: ChaseDay | null; ledger: Ledger } | "error" | null
  >(null);
  useEffect(() => {
    chasePreview()
      .then(setD)
      .catch(() => setD("error"));
  }, []);
  if (!d || d === "error") return <Wait v={d} what="today's outlook" />;
  if (!d.day) return <Note>No chase day has been saved yet.</Note>;
  return <ChaseView day={d.day} ledger={d.ledger} colors={colors} />;
};

const Runs: W = ({ colors }) => <Compare colors={colors} />;

const Soundings: W = ({ colors }) => {
  const { active } = usePlaces();
  const p = active ?? { lat: 35.18, lon: -97.44 };
  const d = useFetch<{ hours: Sounding[] }>(
    `/api/soundings/model?m=HRRR&lat=${p.lat.toFixed(1)}&lon=${p.lon.toFixed(1)}`,
  );
  const a = useMemo(() => {
    if (!d || d === "error" || !d.hours.length) return null;
    const t = now();
    const h = d.hours.reduce((b, x) =>
      Math.abs(Date.parse(x.valid) - t) < Math.abs(Date.parse(b.valid) - t)
        ? x
        : b,
    );
    return analyze(h.levels);
  }, [d]);
  if (!a) return <Wait v={d} what="the HRRR sounding" />;
  const c = (k: string) =>
    colors[`snd:${k}`] ??
    [...SND_LINES, ...SND_BANDS].find((x) => x.key === k)?.color ??
    "#ffffff";
  return (
    <div className="grid gap-3">
      <Note>
        The HRRR sounding nearest now for {active?.label ?? "Norman, OK"}.
      </Note>
      <SkewPanel a={a} parcel={a.ml} c={c} />
      <HodoPanel a={a} c={c} />
    </div>
  );
};

const Aurora: W = ({ colors }) => {
  const d = useFetch<Now>("/api/aurora/now");
  if (!d || d === "error") return <Wait v={d} what="the aurora feed" />;
  const a = (k: string) =>
    colors[`aurora:${k}`] ??
    [...AURORA_RAMP, ...AURORA_LINES].find((x) => x.key === k)?.color ??
    "#ffffff";
  const kc = (k: string) =>
    colors[`kp:${k}`] ?? KP_SCALE.find((x) => x.key === k)?.color ?? "#ffffff";
  return (
    <div className="grid gap-3">
      <OvalMap o={d.ovation} a={a} />
      <KpPanel k={d.kp} kc={kc} />
    </div>
  );
};

const ICONS = ["Award", "Zap", "Tornado", "Crown"];
const Badges: W = ({ colors }) => (
  <div className="grid grid-cols-2 gap-3">
    {RARITIES.map((r, i) => (
      <BadgePlate
        key={r}
        colors={colors}
        badge={{
          icon: ICONS[i],
          rarity: r,
          name: `${r[0].toUpperCase()}${r.slice(1)} badge`,
        }}
      />
    ))}
  </div>
);

/** One real radar scan, decoded once: rows of gates per moment, as the replay reads them. */
type Moment = {
  az0: number;
  step: number;
  rows: number;
  first: number;
  spacing: number;
  gates: number;
  scale: number;
  offset: number;
  data: string;
};
type Scan = { source: string; REF: Moment; VEL: Moment; RHO: Moment };
type Stop = [number, string, number];

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
function ramp(stops: Stop[], v: number): number[] {
  if (v <= stops[0][0]) return [...rgb(stops[0][1]), stops[0][2]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [v0, c0, a0] = stops[i];
    const [v1, c1, a1] = stops[i + 1];
    if (v < v1) {
      const t = (v - v0) / (v1 - v0);
      const x = rgb(c0);
      const y = rgb(c1);
      return [...x.map((q, j) => q + (y[j] - q) * t), a0 + (a1 - a0) * t];
    }
  }
  const l = stops[stops.length - 1];
  return [...rgb(l[1]), l[2]];
}

const bytesOf = (m: Moment) =>
  Uint8Array.from(atob(m.data), (ch) => ch.charCodeAt(0));

/**
 * Where the tornado is: the middle of the gates with storm-strength reflectivity (45 dBZ+)
 * but correlation under 0.8, the lofted-debris signature. Km east and north of the radar.
 */
function debris(s: Scan) {
  const ref = bytesOf(s.REF);
  const rho = bytesOf(s.RHO);
  const R = s.REF;
  const C = s.RHO;
  let x = 0;
  let y = 0;
  let n = 0;
  for (let row = 0; row < C.rows; row++)
    for (let g = 0; g < C.gates; g++) {
      const c = rho[row * C.gates + g];
      if (c < 2 || (c - C.offset) / C.scale >= 0.8) continue;
      const r = C.first + g * C.spacing;
      const rg = Math.round((r - R.first) / R.spacing);
      const rr = Math.round((C.az0 + row * C.step - R.az0) / R.step);
      const z = ref[rr * R.gates + rg];
      if (rg < 0 || rg >= R.gates || rr < 0 || rr >= R.rows || z < 2) continue;
      if ((z - R.offset) / R.scale < 45) continue;
      const az = ((C.az0 + (row + 0.5) * C.step) * Math.PI) / 180;
      x += Math.sin(az) * r;
      y += Math.cos(az) * r;
      n++;
    }
  return n ? { x: x / n, y: y / n } : null;
}

function RadarScan({
  m,
  stops,
  fold,
  at,
}: {
  m: Moment;
  stops: Stop[];
  fold?: string;
  /** Center on this spot (km from the radar), 25 km each way; else the whole sector. */
  at: { x: number; y: number } | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bytes = useMemo(() => bytesOf(m), [m]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const S = 420;
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(S, S);
    // The sector's box, km east (x) and north (y) of the radar.
    const far = m.first + m.gates * m.spacing;
    const mid = ((m.az0 + (m.rows * m.step) / 2) * Math.PI) / 180;
    const cx = at?.x ?? (Math.sin(mid) * (m.first + far)) / 2;
    const cy = at?.y ?? (Math.cos(mid) * (m.first + far)) / 2;
    const half = at ? 25000 : (far - m.first) * 0.62;
    for (let py = 0; py < S; py++)
      for (let px = 0; px < S; px++) {
        const x = cx + ((px / S) * 2 - 1) * half;
        const y = cy - ((py / S) * 2 - 1) * half;
        const r = Math.hypot(x, y);
        const az = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
        const row = Math.floor((az - m.az0) / m.step);
        const g = Math.floor((r - m.first) / m.spacing + 0.5);
        if (row < 0 || row >= m.rows || g < 0 || g >= m.gates) continue;
        const code = bytes[row * m.gates + g];
        if (code === 0) continue;
        const c =
          code === 1
            ? fold
              ? [...rgb(fold), FOLD.alpha]
              : null
            : ramp(stops, (code - m.offset) / m.scale);
        if (!c) continue;
        const k = (py * S + px) * 4;
        img.data[k] = c[0];
        img.data[k + 1] = c[1];
        img.data[k + 2] = c[2];
        img.data[k + 3] = Math.round(c[3] * 255);
      }
    ctx.putImageData(img, 0, 0);
  }, [m, bytes, stops, fold, at]);
  return (
    <canvas
      ref={ref}
      className="aspect-square w-full rounded-2xl border border-line bg-[#06070c]"
    />
  );
}

function radar(kind: "REF" | "VEL" | "RHO"): W {
  return function RadarPreview({ colors }) {
    const d = useFetch<Scan>("/samples/radar-kdmx-20240521.json");
    const at = useMemo(() => (d && d !== "error" ? debris(d) : null), [d]);
    if (!d || d === "error") return <Wait v={d} what="the sample scan" />;
    const [list, key] =
      kind === "REF"
        ? [RADAR_STOPS, "radar"]
        : kind === "VEL"
          ? [VEL_STOPS, "vel"]
          : [CC_STOPS, "cc"];
    const stops = list.map(
      ([v, c, a]) => [v, colors[`replay:${key}:${v}`] ?? c, a] as Stop,
    );
    return (
      <div className="grid gap-2">
        <RadarScan
          m={d[kind]}
          stops={stops}
          fold={
            kind === "VEL" ? (colors["replay:folded"] ?? FOLD.color) : undefined
          }
          at={at}
        />
        <Note>
          KDMX&apos;s lowest scan at 3:31 PM CDT, 21 May 2024, as the
          Greenfield, Iowa tornado neared town (NOAA Level II).
        </Note>
      </div>
    );
  };
}

/** The page previews, by color group. */
export const WIDGETS: Record<string, W> = {
  ingredients: Ingredients,
  timing: Timing,
  sswxcon: SswxCon,
  chase: Chase,
  runs: Runs,
  soundings: Soundings,
  aurora: Aurora,
  kp: Aurora,
  badges: Badges,
  "replay-radar": radar("REF"),
  "replay-velocity": radar("VEL"),
  "replay-cc": radar("RHO"),
};

export function WidgetPreview({ id, colors }: { id: string; colors: Colors }) {
  const Widget = WIDGETS[id];
  return Widget ? <Widget colors={colors} /> : null;
}
