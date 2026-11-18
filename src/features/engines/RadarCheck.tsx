"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radar, ScanEye, Tornado } from "lucide-react";
import type { EngineStorm, WrapStorm } from "@/lib/engines/probsevere";
import type { RadarRead } from "@/lib/engines/project";
import { useTier } from "@/features/motion/useTier";
import { isStaleChunk, reloadForUpdate } from "@/lib/app/stale";

export type ReadState = RadarRead | "busy" | "none" | "error";

/** A storm is read again only once its radar has likely written a newer volume. */
const AGAIN_MS = 5 * 60_000;

type Mod = typeof import("./radarRead");

/**
 * Radar reads in the browser for a list (storms or collisions): the leading items are read
 * automatically (except on low-power phones, where every item waits for a tap) and the rest on
 * a tap. The decoder is its own chunk, loaded the first time it is needed, and an item is read
 * again only once its radar has likely written a newer volume.
 */
function useReads<T, R>(
  lead: T[],
  keyOf: (x: T) => string,
  read: (m: Mod, x: T) => Promise<R | null>,
  stamp = "",
) {
  const [reads, setReads] = useState<
    Record<string, R | "busy" | "none" | "error">
  >({});
  const last = useRef(new Map<string, number>());
  const tier = useTier();
  const reader = useRef(read);
  useEffect(() => {
    reader.current = read;
  });
  const run = useCallback(
    (x: T) => {
      const key = keyOf(x);
      last.current.set(key, Date.now());
      void Promise.resolve()
        .then(() => setReads((r) => ({ ...r, [key]: "busy" })))
        .then(() => import("./radarRead"))
        .then((m) => reader.current(m, x))
        .then(
          (r) => setReads((p) => ({ ...p, [key]: r ?? "none" })),
          (err) => {
            // The radar reader is a chunk from before the latest deploy: reload once to get the new one.
            if (isStaleChunk(err) && reloadForUpdate()) return;
            setReads((p) => ({ ...p, [key]: "error" }));
          },
        );
    },
    [keyOf],
  );
  const keys = lead.map(keyOf).join(";");
  const items = useRef(lead);
  useEffect(() => {
    items.current = lead;
  });
  useEffect(() => {
    if (tier === "low" || !keys) return;
    for (const x of items.current)
      if (Date.now() - (last.current.get(keyOf(x)) ?? 0) >= AGAIN_MS) run(x);
  }, [keys, stamp, tier, run, keyOf]);
  return { reads, run };
}

const byId = (x: { id: string }) => x.id;
const byPlace = (p: { lat: number; lon: number }) => `${p.lat},${p.lon}`;

/** ProbTor: rotation and debris for the two leading storms (20-minute chance 10%+). */
export function useRadarReads(storms: EngineStorm[], at: string | undefined) {
  return useReads(
    at ? storms.slice(0, 2).filter((x) => x.p20 >= 10) : [],
    byId,
    (m, x) => m.readStorm({ ...x, at: Date.parse(at!) }),
    at,
  );
}

/** Rain-Wrap: the rain around the rotation for the two leading rotating storms. */
export function useWrapReads(storms: WrapStorm[], at: string | undefined) {
  return useReads(
    at ? storms.slice(0, 2) : [],
    byId,
    (m, x) => m.readWrap({ ...x, at: Date.parse(at!) }),
    at,
  );
}

/** The radar chips under one storm. */
export function RadarFlags({
  x,
  read,
  run,
}: {
  x: EngineStorm;
  read: ReadState | undefined;
  run: (x: EngineStorm) => void;
}) {
  if (read === undefined || read === "error")
    return (
      <button type="button" onClick={() => run(x)}>
        <Radar aria-hidden />
        {read === "error" ? "Radar check failed. Try again" : "Check radar"}
      </button>
    );
  if (read === "busy")
    return (
      <span>
        <Radar aria-hidden /> Reading the nearest radar…
      </span>
    );
  if (read === "none")
    return (
      <span>
        <Radar aria-hidden /> No radar scan in reach
      </span>
    );
  if (read.beamFt > 10_000 || read.miles > 90)
    return (
      <span>
        <Radar aria-hidden /> {read.site}&apos;s beam is{" "}
        {read.beamFt.toLocaleString()} ft up here, too high to see rotation
      </span>
    );
  return (
    <>
      <span data-k={read.vrot >= 30 ? "up" : undefined}>
        <ScanEye aria-hidden />
        {read.vrot >= 20
          ? `Rotation ${read.vrot} kt`
          : "No strong rotation"} on {read.site} ({read.age} min ago,{" "}
        {read.miles} mi out)
      </span>
      {read.debris && read.vrot >= 30 && (
        <span data-k="up">
          <Tornado aria-hidden /> Debris detected: tornado likely on the ground
        </span>
      )}
    </>
  );
}

type FineRead = NonNullable<Awaited<ReturnType<Mod["readFineLines"]>>>;
export type FineState = FineRead | "busy" | "none" | "error";
export type WrapState =
  NonNullable<Awaited<ReturnType<Mod["readWrap"]>>> | "busy" | "none" | "error";

/**
 * Boundary Collisions' radar check: fine lines near the two leading collisions (storm chance
 * 30%+), from the nearest radar within 110 km.
 */
export function useFineLines(
  points: { lat: number; lon: number; chance?: number }[],
) {
  return useReads(
    points.slice(0, 2).filter((p) => (p.chance ?? 0) >= 30),
    byPlace,
    (m, p) => m.readFineLines(p.lat, p.lon),
  );
}

/** The radar line under one collision. */
export function FineLineFact({
  p,
  read,
  run,
  className,
}: {
  p: { lat: number; lon: number };
  read: FineState | undefined;
  run: (p: { lat: number; lon: number }) => void;
  className?: string;
}) {
  if (read === undefined || read === "error")
    return (
      <li className={className}>
        <button type="button" onClick={() => run(p)}>
          <Radar aria-hidden />
          {read === "error"
            ? "Radar check failed. Try again"
            : "Look for fine lines on radar"}
        </button>
      </li>
    );
  if (read === "busy")
    return <li className={className}>Reading the nearest radar…</li>;
  if (read === "none")
    return (
      <li className={className}>
        No radar within 70 miles to see fine lines here
      </li>
    );
  const l = read.lines[0];
  return (
    <li className={className}>
      {l
        ? `${read.site} radar (${read.age} min ago) shows a fine line ${l.km < 3 ? "right here" : `${Math.round(l.km / 1.609)} mi away`}, ${Math.round(l.long / 1.609)} mi long, running ${l.axis}${read.lines.length > 1 ? `, and ${read.lines.length - 1} more nearby` : ""}`
        : `No fine line on ${read.site} radar within 25 miles (${read.age} min ago)`}
    </li>
  );
}

/** The radar line under one rotating storm on Rain-Wrap. */
export function WrapFlags({
  x,
  read,
  run,
}: {
  x: WrapStorm;
  read: WrapState | undefined;
  run: (x: WrapStorm) => void;
}) {
  if (read === undefined || read === "error")
    return (
      <button type="button" onClick={() => run(x)}>
        <Radar aria-hidden />
        {read === "error"
          ? "Radar check failed. Try again"
          : "See the rain around it on radar"}
      </button>
    );
  if (read === "busy")
    return (
      <span>
        <Radar aria-hidden /> Reading the nearest radar…
      </span>
    );
  if (read === "none")
    return (
      <span>
        <Radar aria-hidden /> No radar scan in reach
      </span>
    );
  return (
    <span data-k={read.sides >= 12 ? "up" : undefined}>
      <ScanEye aria-hidden /> {read.site} ({read.age} min ago): heavy rain on{" "}
      {read.sides} of 16 sides of the {read.vrot >= 15 ? "rotation" : "storm"}
      {read.sides >= 12
        ? ", rain-wrapped"
        : read.sides <= 6
          ? ", open on the inflow side"
          : ""}
    </span>
  );
}

/** What the list shows: the forecast index, moved 60% toward what radar sees once it is read. */
export const wrapShown = (env: number, read: WrapState | undefined) =>
  typeof read === "object" ? Math.round(0.4 * env + 0.6 * read.seen) : env;
