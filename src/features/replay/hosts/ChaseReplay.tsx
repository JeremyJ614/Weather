"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useImmersive } from "@/lib/immersive";
import type { Colors } from "@/lib/colors/pick";
import { importChase } from "@/features/replay/core/importChase";
import { discoverForRoute } from "@/features/replay/import/sources";
import {
  fromChase,
  trackFromPayload,
  type Replayable,
} from "@/features/replay/map/replayable";
import type { ReplayEntry } from "@/features/replay/entries";
import { Replay } from "@/features/replay/Replay";
import { unpackChase, type StoredChase } from "../chaselog/codec";
import { mergeDiscovery } from "../chaselog/merge";

type State = {
  id: string;
  replay?: Replayable;
  progress: number;
  error?: string;
  note?: string | null;
};

/**
 * One of the member's chases on the replay screen. The stored track and tornadoes play at once;
 * the survey's damage, hail and warnings arrive from NOAA and IEM a moment later.
 */
export default function ChaseReplay({
  id,
  entries,
  colors,
  onPick,
  onBack,
}: {
  id: string;
  entries: ReplayEntry[];
  colors: Colors;
  onPick: (e: ReplayEntry) => void;
  onBack: () => void;
}) {
  useImmersive(true);
  const [st, setSt] = useState<State | null>(null);

  useEffect(() => {
    let live = true;
    const ctl = new AbortController();
    const set = (s: Omit<State, "id">) => live && setSt({ id, ...s });
    (async () => {
      const { data, error } = await supabaseBrowser()
        .from("chases")
        .select("payload")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) throw new Error("That chase could not be found.");
      const payload = unpackChase(data.payload as StoredChase);
      const prepared = await importChase(payload, (p) =>
        set({ progress: p.fraction }),
      );
      const track = trackFromPayload(payload);
      const base = fromChase(id, prepared, track);
      set({
        replay: base,
        progress: 1,
        note: "Reading the survey's damage, hail and warnings…",
      });
      try {
        const fixes = payload.track.map(
          ([t, lat, lon]) =>
            [payload.T0 + t, lat, lon] as [number, number, number],
        );
        const bundle = await discoverForRoute(fixes, payload.tz, {
          signal: ctl.signal,
        });
        set({ replay: mergeDiscovery(base, bundle), progress: 1, note: null });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        set({
          replay: base,
          progress: 1,
          note: "The survey archive did not answer, so damage and warnings are missing for now.",
        });
      }
    })().catch((e: Error) => set({ progress: 1, error: e.message }));
    return () => {
      live = false;
      ctl.abort();
    };
  }, [id]);

  const ready = st?.id === id;
  return (
    <Replay
      replay={ready ? (st.replay ?? null) : null}
      loading={!ready || (!st.replay && !st.error)}
      progress={ready ? st.progress : 0}
      error={ready ? (st.error ?? null) : null}
      note={ready ? st.note : null}
      entries={entries}
      onPick={onPick}
      onBack={onBack}
      backLabel="Chase Log"
      colors={colors}
    />
  );
}
