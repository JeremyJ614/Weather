"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { cleanDoc, plainText, type Doc } from "@/lib/news/doc";
import { publishFields, type Mode } from "@/lib/news/publish";
import { pingIndexNow } from "@/lib/seo/indexnow";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export type NewsState = { error?: string; saved?: boolean } | null;

export async function saveNews(_: NewsState, fd: FormData): Promise<NewsState> {
  const { supabase, viewer } = await requireAdmin("news");
  const id = String(fd.get("id") ?? "");
  const title = String(fd.get("title") ?? "").trim();
  let doc: Doc | null = null;
  try {
    const raw = String(fd.get("doc") ?? "");
    doc = raw
      ? cleanDoc(JSON.parse(raw), (src) =>
          src.startsWith(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/news/${id}/`,
          ),
        )
      : null;
  } catch {
    return { error: "The post couldn't be read. Reload and try again." };
  }
  const body = doc ? plainText(doc).slice(0, 20000) : "";
  const cover = String(fd.get("cover") ?? "") || null;
  const mode = String(fd.get("mode") ?? "draft") as Mode;
  if (!UUID.test(id))
    return { error: "This post's ID is invalid. Reload the page." };
  if (!title || title.length > 140)
    return { error: "Add a title (up to 140 characters)." };
  if (cover && !cover.startsWith(`${id}/`))
    return { error: "That cover image belongs to another post." };
  if (!["draft", "now", "schedule"].includes(mode))
    return { error: "Pick how to publish." };

  const { data: existing } = await supabase
    .from("news_posts")
    .select("status, publish_at")
    .eq("id", id)
    .maybeSingle();
  const when = publishFields(mode, String(fd.get("publishAt") ?? ""), existing);
  if ("error" in when) return when;

  const row = {
    id,
    title,
    body,
    doc,
    cover_path: cover,
    ...when,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabase.from("news_posts").update(row).eq("id", id)
    : await supabase.from("news_posts").insert({
        ...row,
        author: (await supabase.auth.getUser()).data.user?.id,
      });
  if (error) return { error: "The post couldn't be saved. Try again." };
  await supabase.rpc("log_admin", {
    p_action: existing ? "edit_news" : "create_news",
    p_target: title,
    p_detail: { state: when.status, at: when.publish_at, by: viewer.name },
  });
  updateTag("news");
  // Published now: tell search engines about the story and the refreshed feed.
  if (
    when.status === "published" &&
    when.publish_at &&
    Date.parse(when.publish_at) <= Date.now()
  )
    after(() => pingIndexNow([`/news/${id}`, "/feed.xml", "/"]));
  return { saved: true };
}

export async function deleteNews(fd: FormData) {
  const { supabase } = await requireAdmin("news");
  const id = String(fd.get("id") ?? "");
  if (!UUID.test(id)) return;
  const { data: post } = await supabase
    .from("news_posts")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  // Images first, so none are left behind (storage safety rule 6).
  const { data: files } = await supabase.storage
    .from("news")
    .list(id, { limit: 100 });
  if (files?.length)
    await supabase.storage
      .from("news")
      .remove(files.map((f) => `${id}/${f.name}`));
  await supabase.from("news_posts").delete().eq("id", id);
  if (post)
    await supabase.rpc("log_admin", {
      p_action: "delete_news",
      p_target: post.title,
    });
  updateTag("news");
  redirect("/admin/news");
}
