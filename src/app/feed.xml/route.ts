import { excerpt, getPublishedPosts } from "@/lib/news/posts";
import { SITE } from "@/lib/seo/site";

export const revalidate = 1800;

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** SSWX News as RSS, for feed readers, news apps and anyone who auto-posts our stories. */
export async function GET() {
  const posts = await getPublishedPosts(50);
  const items = posts
    .map((p) => {
      const url = `${SITE.url}/news/${p.id}`;
      return `<item><title>${esc(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(p.publish_at).toUTCString()}</pubDate><description>${esc(excerpt(p.body, 300, Boolean(p.rich)))}</description></item>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>SSWX News · ${esc(SITE.name)}</title><link>${SITE.url}</link><atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml"/><description>${esc(SITE.description)}</description><language>en-us</language>${posts[0] ? `<lastBuildDate>${new Date(posts[0].publish_at).toUTCString()}</lastBuildDate>` : ""}${items}</channel></rss>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
