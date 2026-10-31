"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "@/components/IntentLink";
import { ChevronDown, Search, Smartphone } from "lucide-react";
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

/** Words that mean someone is looking for the install guides. */
const INSTALL_WORDS =
  /install|iphone|ipad|android|apk|home ?screen|download|app file|play store|app store/;

/**
 * Tabs across the top, each with its categories; a search looks through every tab. `guide`
 * is the built-in install guide (Fix list 2026-10-30 #4): its own tab after the owner's
 * first, opened by /faq?tab=install.
 */
export function FaqView({
  faq,
  initial,
  guide,
}: {
  faq: Faq;
  initial?: string;
  guide?: ReactNode;
}) {
  const tabs = useMemo(() => {
    const own = faq.tabs.map((t) => ({ id: t.id, title: t.title }));
    if (!guide) return own;
    return [
      ...own.slice(0, 1),
      { id: "install", title: "Install the app" },
      ...own.slice(1),
    ];
  }, [faq, guide]);
  const [tab, setTab] = useState(
    tabs.find((t) => t.id === initial)?.id ?? tabs[0]?.id,
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
  const showGuide = Boolean(guide) && tab === "install";

  if (!tabs.length)
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
          {guide && INSTALL_WORDS.test(needle) && (
            <button
              type="button"
              className={s.item}
              onClick={() => {
                setQ("");
                setTab("install");
              }}
            >
              <span className={s.guideHit}>
                <Smartphone aria-hidden /> Step-by-step install guides for
                iPhone, Android and the Android app file
              </span>
            </button>
          )}
          {hits.map(({ it, where }) => (
            <div key={it.id}>
              <small className={s.where}>{where}</small>
              <Item it={it} />
            </div>
          ))}
          {!hits.length && !(guide && INSTALL_WORDS.test(needle)) && (
            <p className={s.empty}>
              Nothing matches. Try another word, or{" "}
              <Link href="/contact">ask us</Link>.
            </p>
          )}
        </section>
      ) : (
        <>
          <div className={s.tabs} role="tablist" aria-label="FAQ topics">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === (showGuide ? "install" : current?.id)}
                onClick={() => setTab(t.id)}
              >
                {t.title}
              </button>
            ))}
          </div>
          <div role="tabpanel" className={s.panel}>
            {showGuide && guide}
            {!showGuide &&
              current?.sections.map((sec) => (
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
