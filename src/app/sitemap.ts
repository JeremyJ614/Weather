import type { MetadataRoute } from "next";
import { slugs as librarySlugs } from "@/lib/library/data";
import { getPublishedPosts } from "@/lib/news/posts";
import { FRONT_DOOR } from "@/lib/nav/registry";
import { SITE } from "@/lib/seo/site";

/** Rebuilt hourly so new SSWX News stories are listed soon after they go out. */
export const revalidate = 3600;

const abs = (path: string) => `${SITE.url}${path}`;

/**
 * Every page a guest (and so a search engine) can open: the homepage, the public front door,
 * help and plans, each Free Content Library article and each SSWX News story. Members-only
 * pages are left out: crawlers would only be sent to the sign-up gate.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPosts(500);
  const now = new Date();
  const page = (
    path: string,
    changeFrequency: "hourly" | "daily" | "weekly" | "monthly" | "yearly",
    priority: number,
  ) => ({ url: abs(path), lastModified: now, changeFrequency, priority });
  return [
    page("/", "hourly", 1),
    ...FRONT_DOOR.map((s) =>
      page(
        `/${s}`,
        s === "weather-glossary" || s === "free-content-library"
          ? "monthly"
          : s === "on-this-day"
            ? "daily"
            : "hourly",
        0.9,
      ),
    ),
    page("/join", "monthly", 0.8),
    page("/faq", "monthly", 0.6),
    page("/disaster-response", "weekly", 0.6),
    page("/donate", "monthly", 0.4),
    page("/contact", "yearly", 0.3),
    page("/privacy", "yearly", 0.2),
    ...librarySlugs().map((s) =>
      page(`/free-content-library/${s}`, "monthly", 0.7),
    ),
    ...posts.map((p) => ({
      url: abs(`/news/${p.id}`),
      lastModified: new Date(p.publish_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
