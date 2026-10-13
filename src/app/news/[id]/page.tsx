import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { NewsBody } from "@/lib/news/markdown";
import { coverUrl, excerpt, getPost } from "@/lib/news/posts";
import { getSiteDefaults } from "@/lib/settings";
import { MarkRead } from "./MarkRead";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).id);
  return post
    ? {
        title: `${post.title} · SSWX News`,
        description: excerpt(post.body, 160),
      }
    : { title: "SSWX News" };
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
      <article className="grid gap-4">
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
        <h1 className="display text-4xl text-accent">{post.title}</h1>
        <NewsBody source={post.body} />
      </article>
    </main>
  );
}
