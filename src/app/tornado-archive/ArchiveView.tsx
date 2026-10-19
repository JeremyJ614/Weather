"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History, Radar } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import type { ArchiveIndexEntry } from "@/features/replay/archive/types";
import { ratingLabel } from "@/features/replay/archive/types";
import type { ReplayEntry } from "@/features/replay/entries";
import type { AutoEntry } from "@/lib/archive/list";
import { EF_COLORS } from "@/lib/colors/ef";
import { pick, type Colors } from "@/lib/colors/pick";
import s from "./Archive.module.css";

const ArchiveReplay = dynamic(
  () => import("@/features/replay/hosts/ArchiveReplay"),
  {
    ssr: false,
    loading: () => <div className={s.cover}>Loading the replay…</div>,
  },
);

const FLOORS = [
  { id: -1, label: "All" },
  { id: 1, label: "EF1+" },
  { id: 2, label: "EF2+" },
  { id: 3, label: "EF3+" },
];
const RANK: Record<string, number> = {
  EFU: -1,
  EF0: 0,
  EF1: 1,
  EF2: 2,
  EF3: 3,
  EF4: 4,
  EF5: 5,
};

const pretty = (day: string, month = "long") =>
  new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: month as "long",
    year: "numeric",
  });

export function ArchiveView({
  famous,
  auto,
  colors,
}: {
  famous: ArchiveIndexEntry[];
  auto: AutoEntry[];
  colors: Colors;
}) {
  const router = useRouter();
  const path = usePathname();
  const open = useSearchParams().get("e");
  const ef = (k: string) =>
    pick(colors, `ef:${k}`, EF_COLORS[k] ?? EF_COLORS.EFU);

  const entries = useMemo<ReplayEntry[]>(
    () => [
      ...famous.map((e) => ({
        id: e.id,
        kind: "archive" as const,
        title: e.name,
        subtitle: e.region,
        count: e.count,
        strongest: e.strongest,
        fatalities: e.fatalities,
        date: e.id.slice(0, 10),
      })),
      ...auto.map((e) => ({
        id: e.id,
        kind: "archive" as const,
        title: e.name,
        subtitle: e.region,
        count: e.count,
        strongest: e.strongest,
        fatalities: e.fatalities,
        date: e.day,
        auto: true,
      })),
    ],
    [famous, auto],
  );

  const go = (id: string) =>
    router.push(`${path}?e=${encodeURIComponent(id)}`, { scroll: false });
  const close = () => router.replace(path, { scroll: false });

  return (
    <>
      <HomeTabs
        label="Tornado Archive"
        variant="segment"
        tabs={[
          {
            id: "famous",
            label: "Historic events",
            icon: <History className="size-4" aria-hidden />,
            panel: <Famous list={famous} ef={ef} onOpen={go} />,
          },
          {
            id: "auto",
            label: "NWS surveyed",
            icon: <Radar className="size-4" aria-hidden />,
            panel: <Surveyed list={auto} ef={ef} onOpen={go} />,
          },
        ]}
      />
      {open && entries.some((e) => e.id === open) && (
        <ArchiveReplay
          id={open}
          entries={entries}
          colors={colors}
          onPick={(e) =>
            router.replace(`${path}?e=${encodeURIComponent(e.id)}`, {
              scroll: false,
            })
          }
          onBack={close}
        />
      )}
    </>
  );
}

function Rating({
  ef,
  scale,
  color,
}: {
  ef: string;
  scale: "F" | "EF";
  color: string;
}) {
  return (
    <span className={s.rating} style={{ borderColor: color, color }}>
      {ratingLabel(ef, scale)}
    </span>
  );
}

function Famous({
  list,
  ef,
  onOpen,
}: {
  list: ArchiveIndexEntry[];
  ef: (k: string) => string;
  onOpen: (id: string) => void;
}) {
  const sorted = [...list].sort((a, b) => b.id.localeCompare(a.id));
  return (
    <div className={s.wrap}>
      <p className={s.lede}>
        {list.length} named events, each one the tornado it is named after and
        what was happening around it, replayed on the clock they happened on
        with every damage point, survey, hail report and warning the archives
        hold.
      </p>
      <ul className={s.grid}>
        {sorted.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className={s.card}
              onClick={() => onOpen(e.id)}
            >
              <span className={s.date}>{pretty(e.id)}</span>
              <span className={s.name}>{e.name}</span>
              <span className={s.region}>{e.region}</span>
              <span className={s.blurb}>{e.blurb}</span>
              <span className={s.figs}>
                <Rating
                  ef={e.strongest}
                  scale={e.scale}
                  color={ef(e.strongest)}
                />
                <span>
                  <b>{e.count}</b> {e.count === 1 ? "tornado" : "tornadoes"}
                </span>
                {e.fatalities > 0 && (
                  <span>
                    <b>{e.fatalities.toLocaleString("en-US")}</b> killed
                  </span>
                )}
                {e.source === "reconstructed" && (
                  <span className={s.badge}>Reconstruction</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className={s.note}>
        Tracks come from NOAA&rsquo;s Storm Prediction Center database and,
        where it has them, the NWS Damage Assessment Toolkit&rsquo;s surveyed
        paths. Days before 2007 are shown on the Fujita scale they were rated
        on.
      </p>
    </div>
  );
}

function Surveyed({
  list,
  ef,
  onOpen,
}: {
  list: AutoEntry[];
  ef: (k: string) => string;
  onOpen: (id: string) => void;
}) {
  const [floor, setFloor] = useState(1);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(60);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const keep = list.filter(
    (e) =>
      (RANK[e.strongest] ?? -1) >= floor &&
      words.every((w) =>
        `${e.name} ${e.region} ${e.day}`.toLowerCase().includes(w),
      ),
  );
  const months = new Map<string, AutoEntry[]>();
  for (const e of keep.slice(0, shown)) {
    const m = e.day.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), e]);
  }
  if (!list.length)
    return (
      <p className={s.lede}>
        No surveyed days have been added yet. The archive checks the National
        Weather Service&rsquo;s damage surveys every six hours and adds each new
        tornado day here.
      </p>
    );
  return (
    <div className={s.wrap}>
      <p className={s.lede}>
        Every tornado the National Weather Service surveys, grouped by storm,
        added automatically and refreshed every six hours as surveys are
        published and revised.
      </p>
      <div className={s.tools}>
        <input
          className={s.search}
          type="search"
          placeholder="Search a town, state or date"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search surveyed days"
        />
        <div className={s.floors} role="group" aria-label="Strongest rating">
          {FLOORS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={floor === f.id}
              onClick={() => setFloor(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className={s.count}>{keep.length.toLocaleString("en-US")} days</p>
      {[...months].map(([m, days]) => (
        <section key={m} className={s.month}>
          <h3>
            {new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </h3>
          <ul className={s.rows}>
            {days.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={s.row}
                  onClick={() => onOpen(e.id)}
                >
                  <Rating ef={e.strongest} scale="EF" color={ef(e.strongest)} />
                  <span className={s.rowMain}>
                    <b>{e.name}</b>
                    <small>
                      {pretty(e.day, "short")} · {e.region}
                    </small>
                  </span>
                  <span className={s.rowFigs}>
                    {e.count} {e.count === 1 ? "tornado" : "tornadoes"}
                    {e.fatalities > 0 && <em>{e.fatalities} killed</em>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {keep.length > shown && (
        <button
          type="button"
          className={s.more}
          onClick={() => setShown((n) => n + 60)}
        >
          Show more
        </button>
      )}
    </div>
  );
}
