import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { postState } from "@/lib/news/publish";
import { Editor } from "./Editor";

export const metadata: Metadata = {
  title: "Edit post · Admin · StormSync Media",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function EditNews({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireAdmin("news");
  const { data: post } = await supabase
    .from("news_posts")
    .select("title, body, doc, cover_path, status, publish_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/news/`;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-28">
      <h1 className="display mb-4 text-3xl text-accent">
        {post ? "Edit post" : "New post"}
      </h1>
      <Editor
        id={id}
        post={post}
        imageBase={base}
        initialMode={
          !post
            ? "draft"
            : (
                {
                  Draft: "draft",
                  Scheduled: "schedule",
                  Published: "now",
                } as const
              )[postState(post)]
        }
      />
    </main>
  );
}
