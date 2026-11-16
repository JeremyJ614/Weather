import { getPublishedPosts } from "@/lib/news/posts";
import { SITE } from "@/lib/seo/site";

/**
 * Google News sitemap (B7): SSWX News stories from the last two days, the window Google News
 * reads. Listed in robots.txt next to the main sitemap.
 */
export const revalidate = 1800;

const esc = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET() {
  const since = Date.now() - 2 * 86400_000;
  const posts = (await getPublishedPosts(60)).filter(
    (p) =>
      Date.parse(p.publish_at) >= since &&
      Date.parse(p.publish_at) <= Date.now(),
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${posts
  .map(
    (p) =>
      `<url><loc>${SITE.url}/news/${p.id}</loc><news:news><news:publication><news:name>${esc(SITE.name)}</news:name><news:language>en</news:language></news:publication><news:publication_date>${new Date(p.publish_at).toISOString()}</news:publication_date><news:title>${esc(p.title)}</news:title></news:news></url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
