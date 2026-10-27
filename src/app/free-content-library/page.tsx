import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import Link from "next/link";
import { Library, Search } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { FrontDoorCta } from "@/features/account/FrontDoorCta";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteDefaults } from "@/lib/settings";
import { SOURCE, search, shelves } from "@/lib/library/data";
import s from "./FreeLibrary.module.css";

export const metadata: Metadata = pageMeta(
  "/free-content-library",
  "Free Content Library",
  "A whole weather school, every word readable here: no paywall, and no trip to someone else's website to finish the paragraph.",
);

/**
 * The reading room: NOAA JetStream's whole weather school, readable here. Search is a GET
 * form and the results are a server render, so the page needs no JavaScript at all.
 */
export default async function FreeContentLibrary({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { disabled } = await getSiteDefaults();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const all = shelves();
  const count = all.reduce((n, x) => n + x.articles.length, 0);
  const hits = q ? search(q) : [];
  const shelfName = new Map(all.map((x) => [x.slug, x.title]));
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Library aria-hidden />}
        eyebrow={["Learn", `${count} articles`, `${all.length} shelves`]}
        title="Free Content Library"
        subtitle="A whole weather school, every word readable here: no paywall, and no trip to someone else's website to finish the paragraph."
      />
      <FrontDoorCta what="the Free Content Library" />
      {disabled.includes("library") ? (
        <ModuleOff label="Free Content Library" />
      ) : (
        <div className="grid gap-4">
          <form
            action="/free-content-library"
            className={s.search}
            role="search"
          >
            <Search aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={`Search ${count} articles`}
              aria-label="Search the library"
            />
            <button type="submit">Search</button>
          </form>
          {q ? (
            <section className={s.results}>
              <p className={s.muted}>
                {hits.length
                  ? `${hits.length} article${hits.length === 1 ? "" : "s"} for “${q}”`
                  : `Nothing in the library matches “${q}”. Try a broader word.`}{" "}
                <Link href="/free-content-library">Clear</Link>
              </p>
              <ul>
                {hits.map((h) => (
                  <li key={h.slug}>
                    <Link href={`/free-content-library/${h.slug}`}>
                      <small>{shelfName.get(h.section)}</small>
                      <b>{h.title}</b>
                      <span>{h.snippet}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <>
              <nav className={s.catalogue} aria-label="Shelves">
                {all.map((x) => (
                  <a key={x.slug} href={`#${x.slug}`}>
                    {x.title}
                    <small>{x.articles.length}</small>
                  </a>
                ))}
              </nav>
              {all.map((x) => (
                <section key={x.slug} id={x.slug} className={s.shelf}>
                  <header>
                    <h2>{x.title}</h2>
                    <p>{x.blurb}</p>
                  </header>
                  <ul>
                    {x.articles.map((a) => (
                      <li key={a.slug}>
                        <Link href={`/free-content-library/${a.slug}`}>
                          <b>{a.title}</b>
                          <span>{a.summary}</span>
                          <small>{a.reading_minutes} min read</small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
          <p className={s.foot}>
            Converted from{" "}
            <a href={SOURCE.home} target="_blank" rel="noreferrer">
              {SOURCE.name}
            </a>
            . {SOURCE.licence}. StormSync Media is not affiliated with NOAA;
            every article links its original.
          </p>
        </div>
      )}
    </main>
  );
}
