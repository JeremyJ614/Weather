"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { History, Radar, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HomeTabs } from "@/features/news/HomeTabs";
import type { ArchiveIndexEntry } from "@/features/replay/archive/types";
import { ratingLabel } from "@/features/replay/archive/types";
import type { ReplayEntry } from "@/features/replay/entries";
import type { SurveyedEntry } from "@/lib/archive/list";
import { EF_COLORS } from "@/lib/colors/ef";
import { pick, type Colors } from "@/lib/colors/pick";
import { STATES } from "@/lib/geo/search";
import type { ContactTab } from "@/lib/help/forms";
import s from "./Archive.module.css";

const ContactForm = dynamic(() =>
  import("@/features/contact/ContactForm").then((m) => m.ContactForm),
);

const ArchiveReplay = dynamic(
  () => import("@/features/replay/hosts/ArchiveReplay"),
  {
    ssr: false,
    loading: () => <div className={s.cover}>Loading the replay…</div>,
  },
);

const RATINGS = ["EF5", "EF4", "EF3", "EF2", "EF1", "EF0", "EFU"];
const MONTHS =
  "January February March April May June July August September October November December".split(
    " ",
  );

const pretty = (day: string, month = "long") =>
  new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: month as "long",
    year: "numeric",
  });

/** The NWS Surveyed list, fetched once per visit: it's large, so it stays off the page's HTML. */
let pending: Promise<SurveyedEntry[]> | null = null;
const loadSurveyed = () =>
  (pending ??= fetch("/api/archive/list")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .catch((e) => {
      pending = null;
      throw e;
    }));

export function ArchiveView({
  famous,
  request,
  colors,
}: {
  famous: ArchiveIndexEntry[];
  /** The owner's Tornado Archive Request form (admin → Contact forms), when it's switched on. */
  request: ContactTab | null;
  colors: Colors;
}) {
  const router = useRouter();
  const path = usePathname();
  const open = useSearchParams().get("e");
  const [surveyed, setSurveyed] = useState<SurveyedEntry[] | "error" | null>(
    null,
  );
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    let live = true;
    loadSurveyed().then(
      (l) => live && setSurveyed(l),
      () => live && setSurveyed("error"),
    );
    return () => {
      live = false;
    };
  }, []);
  const ef = (k: string) =>
    pick(colors, `ef:${k}`, EF_COLORS[k] ?? EF_COLORS.EFU);
  const list = useMemo(
    () => (Array.isArray(surveyed) ? surveyed : []),
    [surveyed],
  );

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
      ...list.map((e) => ({
        id: e.id,
        kind: "archive" as const,
        title: e.name,
        subtitle: e.region,
        count: e.count,
        strongest: e.strongest,
        fatalities: e.fatalities,
        date: e.day,
        auto: e.auto,
      })),
    ],
    [famous, list],
  );

  const go = (id: string) =>
    router.push(`${path}?e=${encodeURIComponent(id)}`, { scroll: false });
  const close = () => router.replace(path, { scroll: false });

  return (
    <>
      {request && (
        <div className={s.request}>
          <p>Know a tornado that belongs here?</p>
          <Button variant="secondary" onClick={() => setAsking(true)}>
            <SendHorizontal className="size-4" aria-hidden />
            Request an event
          </Button>
        </div>
      )}
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
            panel: <Surveyed list={surveyed} ef={ef} onOpen={go} />,
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
      {asking && request && (
        <RequestForm tab={request} onClose={() => setAsking(false)} />
      )}
    </>
  );
}

/** The Tornado Archive Request form, right on the archive page. */
function RequestForm({
  tab,
  onClose,
}: {
  tab: ContactTab;
  onClose: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", key);
      document.body.style.overflow = was;
    };
  }, [onClose]);
  return (
    <div
      className={s.sheetBack}
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className={s.sheet}>
        <header>
          <h2 id="request-title">{tab.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
        </header>
        {tab.intro && <p className={s.sheetIntro}>{tab.intro}</p>}
        <ContactForm tab={tab} />
      </section>
    </div>
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
        {list.length} hand-picked events, each one the tornado it is named after
        and what was happening around it, replayed on the clock they happened on
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
  list: SurveyedEntry[] | "error" | null;
  ef: (k: string) => string;
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [rating, setRating] = useState("");
  const [shown, setShown] = useState(60);
  const rows = useMemo(() => (Array.isArray(list) ? list : []), [list]);
  const states = useMemo(
    () =>
      [...new Set(rows.flatMap((e) => e.states))]
        .map((c) => ({ c, n: STATES[c] ?? c }))
        .sort((a, b) => a.n.localeCompare(b.n)),
    [rows],
  );
  const years = useMemo(
    () => [...new Set(rows.map((e) => e.day.slice(0, 4)))].sort().reverse(),
    [rows],
  );
  if (list === null)
    return <p className={s.lede}>Loading the surveyed days…</p>;
  if (list === "error")
    return (
      <p className={s.lede}>
        The surveyed days couldn&rsquo;t load. Check the connection and open
        this tab again.
      </p>
    );
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const keep = rows.filter(
    (e) =>
      (!st || e.states.includes(st)) &&
      (!year || e.day.startsWith(year)) &&
      (!month || e.day.slice(5, 7) === month) &&
      (!rating || e.strongest === rating) &&
      words.every((w) =>
        `${e.name} ${e.region} ${e.day}`.toLowerCase().includes(w),
      ),
  );
  const filtered = !!(q || st || year || month || rating);
  const months = new Map<string, SurveyedEntry[]>();
  for (const e of keep.slice(0, shown)) {
    const m = e.day.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), e]);
  }
  const pickOne =
    (set: (v: string) => void) => (e: { target: { value: string } }) => {
      set(e.target.value);
      setShown(60);
    };
  return (
    <div className={s.wrap}>
      <p className={s.lede}>
        Every tornado the National Weather Service has surveyed since January
        2023, added automatically as surveys are published and revised; before
        that, every F4 and F5 since 1950 and the violent and significant
        tornadoes of 2000 to 2022 (EF3s that ran 20 miles or killed, deadly
        EF2s), from NOAA&rsquo;s Storm Prediction Center database.
      </p>
      <div className={s.tools}>
        <input
          className={s.search}
          type="search"
          placeholder="Search a town, state or date"
          value={q}
          onChange={pickOne(setQ)}
          aria-label="Search surveyed days"
        />
        <div className={s.filters}>
          <select value={st} onChange={pickOne(setSt)} aria-label="State">
            <option value="">All states</option>
            {states.map(({ c, n }) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
          </select>
          <select value={year} onChange={pickOne(setYear)} aria-label="Year">
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select value={month} onChange={pickOne(setMonth)} aria-label="Month">
            <option value="">All months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={rating}
            onChange={pickOne(setRating)}
            aria-label="Strongest rating"
          >
            <option value="">Any rating</option>
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r === "EFU" ? "Unrated" : `${r.replace("EF", "F")} / ${r}`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className={s.count}>
        {keep.length.toLocaleString("en-US")} days
        {filtered && (
          <button
            type="button"
            className={s.clear}
            onClick={() => {
              setQ("");
              setSt("");
              setYear("");
              setMonth("");
              setRating("");
              setShown(60);
            }}
          >
            Clear filters
          </button>
        )}
      </p>
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
                  <Rating
                    ef={e.strongest}
                    scale={e.scale}
                    color={ef(e.strongest)}
                  />
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
