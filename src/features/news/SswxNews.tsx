"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { orderPosts, readSet, serverReadSet, subscribeRead } from "./readState";
import s from "./SswxNews.module.css";

export type NewsCard = {
  id: string;
  title: string;
  cover: string | null;
  publish_at: string;
  excerpt: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function Card({ p, unread }: { p: NewsCard; unread: boolean }) {
  return (
    <li>
      <Link
        href={`/news/${p.id}`}
        className={`${s.card} ${unread ? s.unread : ""}`}
      >
        {p.cover && (
          // eslint-disable-next-line @next/next/no-img-element -- resized WebP from our bucket
          <img
            src={p.cover}
            alt=""
            loading="lazy"
            className="aspect-[16/9] w-full rounded-xl object-cover"
          />
        )}
        <span className="flex items-center gap-2 text-xs text-muted">
          {unread && <b className="text-accent">New</b>}
          {fmt(p.publish_at)}
        </span>
        <span className="font-bold">{p.title}</span>
        {p.excerpt && <span className="text-sm text-muted">{p.excerpt}</span>}
      </Link>
    </li>
  );
}

/** SSWX News: the owner's posts. Unread ones glow and come first. */
export function SswxNews({ posts }: { posts: NewsCard[] }) {
  const read = useSyncExternalStore(subscribeRead, readSet, serverReadSet);
  if (!posts.length) {
    return (
      <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
        No SSWX News posts yet.
      </p>
    );
  }
  const { unread, rest } = orderPosts(posts, read);
  return (
    <ol className="grid gap-3">
      {unread.map((p) => (
        <Card key={p.id} p={p} unread />
      ))}
      {rest.map((p) => (
        <Card key={p.id} p={p} unread={false} />
      ))}
    </ol>
  );
}
