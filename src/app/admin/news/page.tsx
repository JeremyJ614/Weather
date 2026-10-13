import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { postState } from "@/lib/news/publish";

export const metadata: Metadata = { title: "News · Admin · StormSync Media" };

export default async function NewsAdmin() {
  const { supabase } = await requireAdmin("news");
  const { data: posts } = await supabase
    .from("news_posts")
    .select("id, title, status, publish_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-3xl text-accent">News</h1>
        <Link
          href={`/admin/news/${randomUUID()}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-accent bg-lit px-4 text-sm font-bold text-accent"
        >
          <Plus className="size-4" aria-hidden /> New post
        </Link>
      </div>
      {!posts?.length ? (
        <p className="text-muted">No posts yet.</p>
      ) : (
        <ul className="grid gap-2">
          {posts.map((p) => {
            const state = postState(p);
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/news/${p.id}`}
                  className="grid gap-1 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <span className="font-bold">{p.title}</span>
                  <span className="text-xs text-muted">
                    <b className={state === "Published" ? "text-accent" : ""}>
                      {state}
                    </b>
                    {p.publish_at &&
                      ` · ${new Date(p.publish_at).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
