import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleOf } from "@/lib/seo/schema";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { NewsBody } from "@/lib/news/markdown";
import { RichBody } from "@/lib/news/RichBody";
import { coverUrl, excerpt, getPost } from "@/lib/news/posts";
import { getSiteDefaults } from "@/lib/settings";
import { MarkRead } from "./MarkRead";
import { ShareButton } from "@/components/ShareButton";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).id);
  if (!post) return { title: "SSWX News" };
  const m = pageMeta(
    `/news/${post.id}`,
    `${post.title} · SSWX News`,
    excerpt(post.body, 160, Boolean(post.rich)),
    { type: "article" },
  );
  // The story's own cover when it has one.
  const cover = coverUrl(post.cover_path);
  return cover
    ? {
        ...m,
        openGraph: { ...m.openGraph, images: [cover] },
        twitter: { ...m.twitter, images: [cover] },
      }
    : m;
}

export default async function NewsPost({ params }: Props) {
  const { id } = await params;
  const [post, { disabled }] = await Promise.all([
    getPost(id),
    getSiteDefaults(),
  ]);
  if (disabled.includes("news")) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-6">
        <ModuleOff label="SSWX News" />
      </main>
    );
  }
  if (!post) notFound();
  const cover = coverUrl(post.cover_path);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-24">
      <MarkRead id={post.id} />
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted"
      >
        <ArrowLeft className="size-4" aria-hidden /> Home
      </Link>
      <JsonLd
        data={articleOf({
          kind: "NewsArticle",
          path: `/news/${post.id}`,
          title: post.title,
          description: excerpt(post.body, 160, Boolean(post.rich)),
          published: post.publish_at,
          image: cover,
        })}
      />
      <article className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- resized WebP from our bucket
          <img
            src={cover}
            alt=""
            className="aspect-[16/9] w-full rounded-2xl border border-line object-cover"
          />
        )}
        <p className="mono text-xs text-muted">
          SSWX News ·{" "}
          {new Date(post.publish_at).toLocaleDateString("en-US", {
            dateStyle: "long",
          })}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[26px] leading-tight font-extrabold">
          {post.title}
        </h1>
        <ShareButton title={post.title} className="justify-self-start" />
        {post.doc ? (
          <RichBody doc={post.doc} />
        ) : (
          <NewsBody source={post.body} />
        )}
      </article>
    </main>
  );
}
