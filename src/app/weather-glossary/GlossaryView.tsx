"use client";

import { useMemo, useState } from "react";
import { Link2, Search, X } from "lucide-react";
import { CATEGORIES, slug, TERMS } from "@/lib/glossary/terms";
import s from "./Glossary.module.css";

/** Unique anchor per entry; a term filed under two categories gets the category added. */
const IDS = TERMS.map((t, i) =>
  TERMS.findIndex((x) => x.term === t.term) === i
    ? slug(t.term)
    : `${slug(t.term)}-${slug(t.category)}`,
);

/** Weather Glossary: search, filter by topic, jump by letter, link any term. */
export function GlossaryView() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return TERMS.map((t, i) => ({ ...t, id: IDS[i] }))
      .filter(
        (t) =>
          (!cat || t.category === cat) &&
          (!n ||
            [t.term, t.full, t.desc, t.category].some((x) =>
              x.toLowerCase().includes(n),
            )),
      )
      .sort((a, b) =>
        a.term.localeCompare(b.term, "en", { sensitivity: "base" }),
      );
  }, [q, cat]);
  const letters = [...new Set(list.map((t) => t.term[0].toUpperCase()))];
  const share = (id: string) => {
    const url = `${location.origin}${location.pathname}#${id}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(id);
        setTimeout(() => setCopied(null), 1500);
      },
      () => {},
    );
  };
  return (
    <div className="grid gap-4">
      <label className={s.search}>
        <Search className="size-4 flex-none" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${TERMS.length} terms`}
          aria-label="Search the glossary"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </label>
      <div className={s.pills} role="group" aria-label="Topic">
        {[null, ...CATEGORIES].map((c) => (
          <button
            key={c ?? "all"}
            type="button"
            aria-pressed={c === cat}
            onClick={() => setCat(c)}
          >
            {c ?? "All topics"}
          </button>
        ))}
      </div>
      {letters.length > 1 && (
        <nav className={s.az} aria-label="Jump to letter">
          {letters.map((l) => (
            <a key={l} href={`#letter-${l}`}>
              {l}
            </a>
          ))}
        </nav>
      )}
      <p className={s.muted}>
        {list.length} {list.length === 1 ? "term" : "terms"}
        {cat ? ` in ${cat}` : ""}
        {q ? ` matching "${q}"` : ""}
      </p>
      {list.length ? (
        <ul className="grid gap-2">
          {list.map((t, i) => {
            const first =
              i === 0 ||
              list[i - 1].term[0].toUpperCase() !== t.term[0].toUpperCase();
            return (
              <li key={t.id} id={t.id} className={s.term}>
                {first && (
                  <span
                    id={`letter-${t.term[0].toUpperCase()}`}
                    className={s.anchor}
                  />
                )}
                <header>
                  <span>
                    <b>{t.term}</b>
                    {t.full !== t.term && <small>{t.full}</small>}
                  </span>
                  <button
                    type="button"
                    onClick={() => share(t.id)}
                    aria-label={`Copy a link to ${t.term}`}
                  >
                    <Link2 className="size-4" />
                    {copied === t.id && <em>Copied</em>}
                  </button>
                </header>
                <p>{t.desc}</p>
                <footer>
                  <button type="button" onClick={() => setCat(t.category)}>
                    {t.category}
                  </button>
                  {t.unit && t.unit !== "dimensionless" && (
                    <span>Unit: {t.unit}</span>
                  )}
                </footer>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={s.card}>
          No term matches that. Try a shorter word, or clear the topic filter.
        </p>
      )}
    </div>
  );
}
