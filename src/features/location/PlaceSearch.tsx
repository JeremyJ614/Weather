"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Hash, MapPin, Search } from "lucide-react";
import { STATES, type PlaceHit } from "@/lib/geo/search";
import s from "./PlaceSearch.module.css";

export type Picked = { label: string; lat: number; lon: number; zip: boolean };

const isZip = (q: string) => /^\d{5}$/.test(q.trim());

/**
 * Type-ahead US place search: a city, "city, ST", a state, or a 5-digit ZIP.
 * Suggestions come from our own Census-based index (no third-party key).
 */
export function PlaceSearch({
  onPick,
  placeholder = "City, state or ZIP",
  disabled,
  autoFocus,
}: {
  onPick: (p: Picked) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || /^\d+$/.test(term)) return;
    const t = setTimeout(async () => {
      ctl.current?.abort();
      ctl.current = new AbortController();
      try {
        const r = await fetch(`/api/geo/search?q=${encodeURIComponent(term)}`, {
          signal: ctl.current.signal,
        });
        const body = (await r.json()) as { places: PlaceHit[] };
        setHits(body.places);
        setAt(0);
      } catch {
        /* superseded or offline: keep the last list */
      }
    }, 120);
    return () => clearTimeout(t);
  }, [q]);

  const zip = isZip(q);
  const shown = q.trim().length < 2 || /^\d+$/.test(q.trim()) ? [] : hits;
  const count = zip ? 1 : shown.length;

  const choose = async (k: number) => {
    setErr(null);
    if (zip) {
      try {
        const r = await fetch(`/api/geo/zip?zip=${q.trim()}`);
        const z = await r.json();
        if (!r.ok) throw new Error(z.error ?? "ZIP lookup failed");
        await onPick({ label: z.label, lat: z.lat, lon: z.lon, zip: true });
      } catch (e) {
        setErr((e as Error).message);
        return;
      }
    } else {
      const h = shown[k];
      if (!h) return;
      await onPick({
        label: `${h.name}, ${h.st}`,
        lat: h.lat,
        lon: h.lon,
        zip: false,
      });
    }
    setQ("");
    setHits([]);
    setOpen(false);
  };

  return (
    <div className={s.wrap}>
      <div className={s.field}>
        <Search className={s.icon} aria-hidden />
        <input
          role="combobox"
          aria-expanded={open && count > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && count ? `${id}-opt-${at}` : undefined}
          aria-autocomplete="list"
          aria-label={placeholder}
          placeholder={placeholder}
          value={q}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setErr(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAt((a) => Math.min(count - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAt((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && count) {
              e.preventDefault();
              choose(at);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>
      {open && count > 0 && (
        <ul id={`${id}-list`} role="listbox" className={s.list}>
          {zip ? (
            <li
              id={`${id}-opt-0`}
              role="option"
              aria-selected
              className={s.opt}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(0)}
            >
              <Hash aria-hidden />
              <span>
                <b>ZIP {q.trim()}</b>
              </span>
            </li>
          ) : (
            shown.map((h, k) => (
              <li
                key={`${h.name}-${h.st}-${k}`}
                id={`${id}-opt-${k}`}
                role="option"
                aria-selected={k === at}
                className={s.opt}
                style={{ ["--i" as string]: k }}
                onPointerDown={(e) => e.preventDefault()}
                onPointerEnter={() => setAt(k)}
                onClick={() => choose(k)}
              >
                <MapPin aria-hidden />
                <span>
                  <i>
                    <b>{h.name}</b>, {h.st}
                  </i>
                  <small>
                    {STATES[h.st]}
                    {h.pop > 0 && ` · ${h.pop.toLocaleString()} people`}
                  </small>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
      {err && (
        <p className={s.err} role="status">
          {err}
        </p>
      )}
    </div>
  );
}
