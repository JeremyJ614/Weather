"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { EF_COLORS } from "@/lib/colors/ef";
import { pick, type Colors } from "@/lib/colors/pick";
import type { ReplayEntry } from "@/features/replay/entries";
import { DEFAULTS as REPLAY } from "@/features/replay/palette";
import { KIND, type ReportKind } from "@/lib/warnings/reports";
import s from "./ChaseLog.module.css";

const loading = () => <p className={s.small}>Loading…</p>;
const ChaseImport = dynamic(
  () => import("./ChaseImport").then((m) => m.ChaseImport),
  { ssr: false, loading },
);
const ChaseReplay = dynamic(
  () => import("@/features/replay/hosts/ChaseReplay"),
  {
    ssr: false,
    loading: () => <div className={s.cover}>Loading the replay…</div>,
  },
);

export type ChaseRow = {
  id: string;
  title: string;
  day: string;
  miles: number;
  tornadoes: number;
  strongest: string | null;
};

export const LIMIT = 30;

export function ChaseLogView({
  chases: initial,
  signedIn,
  colors,
}: {
  chases: ChaseRow[];
  signedIn: boolean;
  colors: Colors;
}) {
  const router = useRouter();
  const path = usePathname();
  const open = useSearchParams().get("c");
  const [chases, setChases] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const ef = (k: string) =>
    pick(colors, `ef:${k}`, EF_COLORS[k] ?? EF_COLORS.EFU);

  const entries = useMemo<ReplayEntry[]>(
    () =>
      chases.map((c) => ({
        id: c.id,
        kind: "chase" as const,
        title: c.title,
        subtitle: `${Math.round(c.miles)} mi`,
        count: c.tornadoes,
        strongest: c.strongest ?? undefined,
        date: c.day,
      })),
    [chases],
  );

  if (!signedIn)
    return (
      <section className={s.panel}>
        <h2>Your chases, replayed</h2>
        <p className={s.small}>
          Sign in to keep your chase log. Your chases are saved to your account
          and only you can see them.
        </p>
        <Link href="/login?next=/chasing-log" className={s.primary}>
          Sign in
        </Link>
      </section>
    );

  const go = (id: string) =>
    router.push(`${path}?c=${encodeURIComponent(id)}`, { scroll: false });

  const remove = async (id: string) => {
    // Loaded on demand: the Supabase client would otherwise ride on every visit.
    const { supabaseBrowser } = await import("@/lib/supabase/browser");
    const { error } = await supabaseBrowser()
      .from("chases")
      .delete()
      .eq("id", id);
    if (!error) setChases((list) => list.filter((c) => c.id !== id));
    setConfirm(null);
  };

  return (
    <div className={s.wrap}>
      {adding ? (
        <ChaseImport
          ef={ef}
          report={(k) =>
            pick(colors, `report:${k}`, KIND[k as ReportKind]?.color ?? "#888")
          }
          route={pick(colors, "replay:track:done", REPLAY.track.done)}
          onCancel={() => setAdding(false)}
          onSaved={(row) => {
            setAdding(false);
            setChases((list) =>
              [row, ...list].sort((a, b) => b.day.localeCompare(a.day)),
            );
            go(row.id);
          }}
        />
      ) : (
        <button
          type="button"
          className={s.add}
          disabled={chases.length >= LIMIT}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-5" aria-hidden />
          {chases.length >= LIMIT
            ? `Your log is full (${LIMIT} chases)`
            : "Add a chase"}
        </button>
      )}

      {chases.length === 0 && !adding && (
        <p className={s.small}>
          No chases yet. Add the GPS track from a chase day and it replays on
          the map with every tornado the NWS surveyed near your route, your
          closest approach, the warnings you drove through, and a 3D chase
          camera.
        </p>
      )}

      <ul className={s.list}>
        {chases.map((c) => (
          <li key={c.id} className={s.item}>
            <button type="button" className={s.row} onClick={() => go(c.id)}>
              <span
                className={s.rating}
                style={
                  c.strongest
                    ? { borderColor: ef(c.strongest), color: ef(c.strongest) }
                    : undefined
                }
              >
                {c.strongest ?? "—"}
              </span>
              <span className={s.rowMain}>
                <b>{c.title}</b>
                <small>
                  {new Date(`${c.day}T12:00:00Z`).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}{" "}
                  · {Math.round(c.miles)} mi · {c.tornadoes}{" "}
                  {c.tornadoes === 1 ? "tornado" : "tornadoes"}
                </small>
              </span>
            </button>
            {confirm === c.id ? (
              <span className={s.confirm}>
                <button type="button" onClick={() => void remove(c.id)}>
                  Delete
                </button>
                <button type="button" onClick={() => setConfirm(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={s.del}
                aria-label={`Delete ${c.title}`}
                onClick={() => setConfirm(c.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      {chases.length > 0 && (
        <p className={s.small}>
          {chases.length} of {LIMIT} chases. Tracks are thinned to their key
          points when saved, so a full log stays small.
        </p>
      )}

      {open && entries.some((e) => e.id === open) && (
        <ChaseReplay
          id={open}
          entries={entries}
          colors={colors}
          onPick={(e) =>
            router.replace(`${path}?c=${encodeURIComponent(e.id)}`, {
              scroll: false,
            })
          }
          onBack={() => router.replace(path, { scroll: false })}
        />
      )}
    </div>
  );
}
