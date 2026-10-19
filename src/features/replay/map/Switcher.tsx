import { useEffect, useMemo, useRef, useState } from "react";
import { PAL } from "@/features/replay/palette";
import type { ReplayEntry } from "@/features/replay/entries";

/** Turn '2024-05-21-greenfield' into 'May 2024'. */
function when(entry: ReplayEntry): string {
  if (!entry.date) return "";
  const [y, m] = entry.date.split("-");
  const month = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][Number(m) - 1];
  return month ? `${month} ${y}` : (y ?? "");
}

/** Ratings on the day's own scale — an F5 and an EF5 are not the same measurement. */
const ratingFor = (entry: ReplayEntry) => {
  const raw = entry.strongest ?? "";
  if (!raw) return null;
  const year = Number(entry.date?.slice(0, 4) ?? "9999");
  return year < 2007 ? raw.replace("EF", "F") : raw;
};

const matches = (e: ReplayEntry, q: string) => {
  if (!q) return true;
  const hay =
    `${e.title} ${e.subtitle ?? ""} ${e.date ?? ""} ${e.strongest ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word));
};

/**
 * Choosing what to replay.
 *
 * The version this replaces was a flat scrolling list of buttons carrying a
 * title and a count, which was tolerable at three entries and stopped working
 * at twenty-five: no way to search it, no way to tell a legendary day from
 * your own chase at a glance, and no indication of what was in any of them
 * beyond a number.
 *
 * This one is searchable, sorted by when it happened, and every row says the
 * thing you actually choose on — how strong it got, how many there were, and
 * whether anyone was killed. Typing filters; up and down move; Enter opens;
 * Escape closes.
 */
export function Switcher({
  entries,
  currentId,
  onPick,
  onClose,
}: {
  entries: ReplayEntry[];
  currentId: string | null;
  onPick: (e: ReplayEntry) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [rawCursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { chases, archive, flat } = useMemo(() => {
    const keep = entries.filter((e) => matches(e, query));
    // Newest first in both groups: the chase you are most likely to want is
    // the one you just did, and the archive reads as a timeline backwards.
    const byDate = (a: ReplayEntry, b: ReplayEntry) =>
      (b.date ?? "").localeCompare(a.date ?? "");
    const c = keep.filter((e) => e.kind === "chase").sort(byDate);
    const a = keep.filter((e) => e.kind === "archive").sort(byDate);
    return { chases: c, archive: a, flat: [...c, ...a] };
  }, [entries, query]);
  // Keep the highlight inside the results as they narrow under typing.
  const cursor = Math.min(rawCursor, Math.max(0, flat.length - 1));

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-cursor="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = flat[cursor];
      if (picked) onPick(picked);
    }
  };

  const Row = ({ e }: { e: ReplayEntry }) => {
    const i = flat.indexOf(e);
    const rating = ratingFor(e);
    const colour = PAL.ef[e.strongest ?? ""] ?? PAL.ef.EFU;
    return (
      <button
        type="button"
        role="option"
        aria-selected={e.id === currentId}
        className="sw-row"
        data-on={e.id === currentId || undefined}
        data-cursor={i === cursor}
        onMouseEnter={() => setCursor(i)}
        onClick={() => onPick(e)}
      >
        {/* The rating is a chip with text in it, never a bare colour. */}
        {rating ? (
          <span className="sw-ef" style={{ background: colour }}>
            {rating}
          </span>
        ) : (
          <span className="sw-ef sw-ef-none" aria-hidden="true">
            —
          </span>
        )}
        <span className="sw-text">
          <span className="sw-title">{e.title}</span>
          <span className="sw-sub">
            {when(e)}
            {e.subtitle && when(e) ? " · " : ""}
            {e.subtitle}
          </span>
        </span>
        <span className="sw-facts">
          {e.count !== undefined && (
            <span className="sw-count">
              {e.count}
              <small>{e.count === 1 ? "tornado" : "tornadoes"}</small>
            </span>
          )}
          {!!e.fatalities && (
            <span className="sw-fat">
              {e.fatalities}
              <small>killed</small>
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="switcher" onKeyDown={onKey}>
      <div className="sw-search">
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search chases and the archive"
          aria-label="Search chases and the archive"
          onChange={(ev) => {
            setQuery(ev.target.value);
            setCursor(0);
          }}
        />
        {query && (
          <button
            type="button"
            className="sw-clear"
            onClick={() => setQuery("")}
            aria-label="Clear the search"
          >
            Clear
          </button>
        )}
      </div>

      <div
        className="sw-list"
        ref={listRef}
        role="listbox"
        aria-label="Chases and archive events"
      >
        {flat.length === 0 && (
          <p className="sw-empty">
            Nothing matches &ldquo;{query}&rdquo;. Try a place, a year, or a
            rating.
          </p>
        )}

        {chases.length > 0 && (
          <>
            <p className="sw-head">Your chases</p>
            {chases.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </>
        )}

        {archive.length > 0 && (
          <>
            <p className="sw-head">
              Historical archive
              <span className="sw-head-n">{archive.length}</span>
            </p>
            {archive.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </>
        )}
      </div>

      <a className="sw-add" href="#/import">
        <span className="sw-add-plus" aria-hidden="true">
          +
        </span>
        <span>
          <strong>Add a chase</strong>
          <em>Drop in a GPS track and this finds the day</em>
        </span>
      </a>
    </div>
  );
}
