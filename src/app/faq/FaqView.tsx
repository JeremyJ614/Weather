"use client";

import { useMemo, useState } from "react";
import Link from "@/components/IntentLink";
import { ChevronDown, Search } from "lucide-react";
import { answerParts, type Faq, type FaqItem } from "@/lib/help/faq";
import s from "./Faq.module.css";

function Answer({ a }: { a: string }) {
  return answerParts(a).map((p, i) => (
    <p key={i}>
      {p.map((x, k) =>
        "href" in x ? (
          x.href.startsWith("/") ? (
            <Link key={k} href={x.href}>
              {x.text}
            </Link>
          ) : (
            <a key={k} href={x.href} target="_blank" rel="noreferrer">
              {x.text}
            </a>
          )
        ) : (
          x.text
        ),
      )}
    </p>
  ));
}

function Item({ it }: { it: FaqItem }) {
  return (
    <details className={s.item}>
      <summary>
        <span>{it.q}</span>
        <ChevronDown aria-hidden />
      </summary>
      <div className={s.answer}>
        <Answer a={it.a} />
      </div>
    </details>
  );
}

/** Tabs across the top, each with its categories; a search looks through every tab. */
export function FaqView({ faq, initial }: { faq: Faq; initial?: string }) {
  const [tab, setTab] = useState(
    faq.tabs.find((t) => t.id === initial)?.id ?? faq.tabs[0]?.id,
  );
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hits = useMemo(
    () =>
      needle
        ? faq.tabs.flatMap((t) =>
            t.sections.flatMap((sec) =>
              sec.items
                .filter((it) =>
                  `${it.q} ${it.a}`.toLowerCase().includes(needle),
                )
                .map((it) => ({ it, where: `${t.title} · ${sec.title}` })),
            ),
          )
        : [],
    [faq, needle],
  );
  const current = faq.tabs.find((t) => t.id === tab) ?? faq.tabs[0];

  if (!faq.tabs.length)
    return <p className={s.empty}>No questions have been added yet.</p>;
  return (
    <div className={s.wrap}>
      {faq.intro && (
        <div className={s.intro}>
          <Answer a={faq.intro} />
        </div>
      )}
      <label className={s.search}>
        <Search aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search every question"
          aria-label="Search every question"
        />
      </label>
      {needle ? (
        <section className={s.section} aria-live="polite">
          <h2>
            {hits.length} {hits.length === 1 ? "answer" : "answers"} for “
            {q.trim()}”
          </h2>
          {hits.map(({ it, where }) => (
            <div key={it.id}>
              <small className={s.where}>{where}</small>
              <Item it={it} />
            </div>
          ))}
          {!hits.length && (
            <p className={s.empty}>
              Nothing matches. Try another word, or{" "}
              <Link href="/contact">ask us</Link>.
            </p>
          )}
        </section>
      ) : (
        <>
          <div className={s.tabs} role="tablist" aria-label="FAQ topics">
            {faq.tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === current?.id}
                onClick={() => setTab(t.id)}
              >
                {t.title}
              </button>
            ))}
          </div>
          <div role="tabpanel" className={s.panel}>
            {current?.sections.map((sec) => (
              <section key={sec.id} className={s.section}>
                <h2>{sec.title}</h2>
                {sec.items.map((it) => (
                  <Item key={it.id} it={it} />
                ))}
              </section>
            ))}
          </div>
        </>
      )}
      <p className={s.more}>
        Still stuck? <Link href="/contact">Contact us</Link> and we&apos;ll
        reply by email.
      </p>
    </div>
  );
}
