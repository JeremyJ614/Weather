import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { ShareButton } from "@/components/ShareButton";
import { articleOf } from "@/lib/seo/schema";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, ExternalLink } from "lucide-react";
import { Blocks } from "@/features/library/Blocks";
import { article, sectionOf, shelves, slugs } from "@/lib/library/data";
import s from "../FreeLibrary.module.css";
import { Morph } from "@/components/ui/Morph";

export const dynamicParams = false;
export function generateStaticParams() {
  return slugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const slug = (await params).slug;
  const a = article(slug);
  return a
    ? pageMeta(
        `/free-content-library/${slug}`,
        `${a.title} · Free Content Library`,
        a.summary,
        { type: "article" },
      )
    : {};
}

/** One library article, whole, with its source named and linked. */
export default async function LibraryArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const a = article((await params).slug);
  if (!a) notFound();
  const shelf = sectionOf(a.section);
  const list = shelves().find((x) => x.slug === a.section)?.articles ?? [];
  const at = list.findIndex((x) => x.slug === a.slug);
  const prev = list[at - 1];
  const next = list[at + 1];
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <article className={s.article}>
        <Link href={`/free-content-library#${a.section}`} className={s.back}>
          <ArrowLeft aria-hidden /> {shelf?.title ?? "Library"}
        </Link>
        <Morph name={`lib-${a.slug}`}>
          <h1>{a.title}</h1>
        </Morph>
        <p className={s.lede}>{a.summary}</p>
        <JsonLd
          data={articleOf({
            path: `/free-content-library/${a.slug}`,
            title: a.title,
            description: a.summary,
          })}
        />
        <p className={s.meta}>
          <Clock aria-hidden /> {a.reading_minutes} min read ·{" "}
          <a href={a.source_url} target="_blank" rel="noreferrer">
            {a.source_name} <ExternalLink aria-hidden />
          </a>
        </p>
        <ShareButton
          title={a.title}
          text={a.summary}
          className="justify-self-start"
        />
        <Blocks blocks={a.body} />
        <p className={s.licence}>
          From{" "}
          <a href={a.source_url} target="_blank" rel="noreferrer">
            {a.source_name}
          </a>
          . {a.licence}.
        </p>
        <nav className={s.pager} aria-label="More on this shelf">
          {prev ? (
            <Link href={`/free-content-library/${prev.slug}`}>
              <small>
                <ArrowLeft aria-hidden /> Previous
              </small>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/free-content-library/${next.slug}`} data-next>
              <small>
                Next <ArrowRight aria-hidden />
              </small>
              {next.title}
            </Link>
          )}
        </nav>
      </article>
    </main>
  );
}
