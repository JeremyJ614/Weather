"use client";

import { useEffect, useState } from "react";
import type { ArchiveEvent } from "@/features/replay/archive/types";
import { fromArchive, type Replayable } from "@/features/replay/map/replayable";
import type { ReplayEntry } from "@/features/replay/entries";
import { Replay } from "@/features/replay/Replay";
import { useImmersive } from "@/lib/immersive";
import type { Colors } from "@/lib/colors/pick";

type Loaded = { id: string; replay?: Replayable; error?: string };

/** One archive event on the replay screen: a famous event's file, or an NWS day built live. */
export default function ArchiveReplay({
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
  const [got, setGot] = useState<Loaded | null>(null);
  const auto = entries.find((e) => e.id === id)?.auto ?? false;

  useEffect(() => {
    const ctl = new AbortController();
    fetch(auto ? `/api/archive/auto/${id}` : `/archive/${id}.json`, {
      signal: ctl.signal,
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 404
              ? "That day is not in the archive."
              : "The survey archive did not answer. Try again in a minute.",
          );
        const e = (await r.json()) as ArchiveEvent;
        setGot({ id, replay: fromArchive(e) });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setGot({ id, error: e.message });
      });
    return () => ctl.abort();
  }, [id, auto]);

  const ready = got?.id === id;
  return (
    <Replay
      replay={ready ? (got.replay ?? null) : null}
      loading={!ready}
      progress={null}
      error={ready ? (got.error ?? null) : null}
      note={
        auto
          ? "Added automatically from the NWS survey; it updates when the survey does."
          : null
      }
      entries={entries}
      onPick={onPick}
      onBack={onBack}
      backLabel="Archive"
      colors={colors}
    />
  );
}
