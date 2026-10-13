import type { Doc } from "./doc";
export type PostCard = {
  id: string;
  title: string;
  cover_path: string | null;
  publish_at: string;
  body: string;
  /** Set for posts from the rich editor (their `body` is already plain text). */
  rich?: number | null;
  doc?: Doc | null;
};

const cfg = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
// Scheduled posts appear within 5 minutes of their time; saving in the editor refreshes at once.
const cache = { next: { revalidate: 300, tags: ["news"] } };

export const coverUrl = (path: string | null) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/news/${path}`
    : null;

/** Published SSWX News posts, newest first (row security hides drafts and future posts). */
export async function getPublishedPosts(limit = 30): Promise<PostCard[]> {
  const { url, key } = cfg();
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/news_posts?select=id,title,cover_path,publish_at,body,rich:doc->v&order=publish_at.desc&limit=${limit}`,
      { headers: { apikey: key }, ...cache },
    );
    return res.ok ? res.json() : [];
  } catch {
    return [];
  }
}

export async function getPost(id: string): Promise<PostCard | null> {
  const { url, key } = cfg();
  if (!url || !key || !/^[0-9a-f-]{36}$/.test(id)) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/news_posts?select=id,title,cover_path,publish_at,body,doc,rich:doc->v&id=eq.${id}`,
      {
        headers: { apikey: key },
        ...cache,
      },
    );
    const rows = res.ok ? ((await res.json()) as PostCard[]) : [];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Plain-text preview of a post body (Markdown syntax removed). */
export function excerpt(body: string, max = 140, rich = false): string {
  const text = rich
    ? body.replace(/\s+/g, " ").trim()
    : body
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/^[#>\-\d.\s]+/gm, "")
        .replace(/\*+/g, "")
        .replace(/\s+/g, " ")
        .trim();
  return text.length > max
    ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…`
    : text;
}
