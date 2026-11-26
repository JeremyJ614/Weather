"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed, MapPin, Search as SearchIcon, X } from "lucide-react";
import { usePlaces } from "@/features/location/usePlaces";
import type { Colors } from "@/lib/colors/pick";
import { pick } from "@/lib/colors/pick";
import { EF_COLORS } from "@/lib/colors/ef";
import s from "./Tornado.module.css";

type Hit = { slug: string; label: string; sub: string; n: number; top: number };
const rateOf = (m: number) => (m === -2 ? "" : m < 0 ? "U" : `EF${m}`);

/** The county for a point, cached for the visit. */
type Where = { county: (Hit & { st: string }) | null; busiest?: Hit[] };
const near = new Map<string, Promise<Where | null>>();
export function whereIs(lat: number, lon: number) {
  const k = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (!near.has(k))
    near.set(
      k,
      fetch(`/api/tornado/where?lat=${lat}&lon=${lon}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  return near.get(k)!;
}

/**
 * "Search tornado records for your area": a town, ZIP code or county, or the saved place or
 * the phone's location (owner's Weather list #42, item 2).
 */
export function Search({
  compact = false,
  colors,
}: {
  compact?: boolean;
  colors?: Colors;
}) {
  const router = useRouter();
  const id = useId();
  const { active } = usePlaces();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Hit | null>(null);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
    let off = false;
    whereIs(active.lat, active.lon).then((r) => {
      if (!off && r?.county) setMine(r.county);
    });
    return () => {
      off = true;
    };
  }, [active]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return;
    let off = false;
    const timer = setTimeout(() => {
      setBusy(true);
      fetch(`/api/tornado/find?q=${encodeURIComponent(t)}`)
        .then((r) => r.json())
        .then((j: { hits: Hit[]; error?: string }) => {
          if (off) return;
          setHits(j.hits);
          setHi(0);
          setMsg(
            j.error ??
              (j.hits.length
                ? ""
                : "No match yet. Try a ZIP code, a town and state, or a county name."),
          );
        })
        .catch(() => !off && setMsg("Search is unavailable right now."))
        .finally(() => !off && setBusy(false));
    }, 220);
    return () => {
      off = true;
      clearTimeout(timer);
    };
  }, [q]);

  const go = (slug: string) => router.push(`/tornado-database/${slug}`);
  const locate = () => {
    if (mine) return go(mine.slug);
    if (!navigator.geolocation)
      return setMsg(
        "This device can't share its location. Type a town or ZIP code instead.",
      );
    setBusy(true);
    setMsg("Finding you…");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const r = await whereIs(p.coords.latitude, p.coords.longitude);
        setBusy(false);
        if (r?.county) go(r.county.slug);
        else
          setMsg(
            "That spot isn't in a US county. Type a town or ZIP code instead.",
          );
      },
      () => {
        setBusy(false);
        setMsg(
          "Location is off for this site. Type a town or ZIP code instead.",
        );
      },
      { timeout: 12000, maximumAge: 600000 },
    );
  };
  const shown = q.trim().length >= 2 ? hits : null;

  return (
    <div className={compact ? `${s.search} ${s.compact}` : s.search}>
      {!compact && (
        <div className={s.sHead}>
          <div>
            <p className={s.eye}>NOAA tornado record · 1950 to present</p>
            <h2>Search tornado records for your area</h2>
            <p className={s.lead}>
              Type a town, ZIP code or county to see every tornado path that has
              touched it since 1950, when the season peaks, the record years and
              a shareable county card.
            </p>
          </div>
        </div>
      )}
      <div className={s.sRow}>
        <label htmlFor={id} className={s.field}>
          <SearchIcon aria-hidden />
          <input
            ref={box}
            id={id}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value.trim().length < 2) {
                setHits(null);
                setMsg("");
              }
            }}
            onKeyDown={(e) => {
              if (!shown?.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((h) => Math.min(shown.length - 1, h + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((h) => Math.max(0, h - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(shown[hi].slug);
              }
            }}
            placeholder="Town, ZIP code or county (Joplin MO, 73102, Pike County)"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Town, ZIP code or county"
            aria-controls={`${id}-list`}
            aria-expanded={!!shown?.length}
            role="combobox"
          />
          {q && (
            <button
              type="button"
              className={s.clear}
              onClick={() => {
                setQ("");
                setHits(null);
                setMsg("");
                box.current?.focus();
              }}
              aria-label="Clear"
            >
              <X aria-hidden />
            </button>
          )}
        </label>
        <button
          type="button"
          className={s.locate}
          onClick={locate}
          disabled={busy && !mine}
        >
          {mine ? <MapPin aria-hidden /> : <LocateFixed aria-hidden />}
          {mine ? (
            <span>
              Your area: <b>{mine.label}</b> ({mine.n})
            </span>
          ) : (
            <span>Use my location</span>
          )}
        </button>
      </div>
      {shown && shown.length > 0 && (
        <ul
          className={s.hits}
          id={`${id}-list`}
          role="listbox"
          aria-label="Matching counties"
        >
          {shown.map((h, i) => (
            <li key={h.slug} role="option" aria-selected={i === hi}>
              <button
                type="button"
                onClick={() => go(h.slug)}
                onMouseEnter={() => setHi(i)}
              >
                <span>
                  <b>{h.label}</b>
                  <small>{h.sub}</small>
                </span>
                {rateOf(h.top) && (
                  <em
                    className={s.rate}
                    style={{
                      ["--c" as string]: pick(
                        colors,
                        `ef:${h.top < 0 ? "EFU" : `EF${h.top}`}`,
                        EF_COLORS[h.top < 0 ? "EFU" : `EF${h.top}`],
                      ),
                    }}
                  >
                    {rateOf(h.top)}
                  </em>
                )}
                <small className={s.count}>
                  {h.n ? `${h.n} since 1950` : "None since 1950"}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={s.msg} aria-live="polite">
        {busy && !msg ? "Searching…" : msg}
      </p>
    </div>
  );
}
