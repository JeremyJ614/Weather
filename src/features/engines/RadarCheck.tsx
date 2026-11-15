"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radar, ScanEye, Tornado } from "lucide-react";
import type { EngineStorm } from "@/lib/engines/probsevere";
import type { RadarRead } from "@/lib/engines/project";
import { useTier } from "@/features/motion/useTier";

export type ReadState = RadarRead | "busy" | "none" | "error";

/** A storm is read again only once its radar has likely written a newer volume. */
const AGAIN_MS = 5 * 60_000;

/**
 * ProbTor's radar check in the browser. The two leading storms are read automatically (except
 * on low-power phones, where every storm waits for a tap) and the rest on a tap; the decoder
 * is its own chunk, loaded the first time it is needed.
 */
export function useRadarReads(storms: EngineStorm[], at: string | undefined) {
  const [reads, setReads] = useState<Record<string, ReadState>>({});
  const last = useRef(new Map<string, number>());
  const tier = useTier();
  const run = useCallback(
    (x: EngineStorm) => {
      if (!at) return;
      last.current.set(x.id, Date.now());
      void Promise.resolve()
        .then(() => setReads((r) => ({ ...r, [x.id]: "busy" })))
        .then(() => import("./radarRead"))
        .then((m) => m.readStorm({ ...x, at: Date.parse(at) }))
        .then(
          (r) => setReads((p) => ({ ...p, [x.id]: r ?? "none" })),
          () => setReads((p) => ({ ...p, [x.id]: "error" })),
        );
    },
    [at],
  );
  const lead = storms
    .slice(0, 2)
    .filter((x) => x.p20 >= 10)
    .map((x) => x.id)
    .join(",");
  useEffect(() => {
    if (tier === "low" || !lead) return;
    for (const x of storms.filter((s) => lead.split(",").includes(s.id))) {
      const t = last.current.get(x.id) ?? 0;
      if (Date.now() - t >= AGAIN_MS) run(x);
    }
    // `storms` changes every scan; `lead` and `at` say when there is something new to read.
  }, [lead, at, tier, run]); // eslint-disable-line react-hooks/exhaustive-deps
  return { reads, run };
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
