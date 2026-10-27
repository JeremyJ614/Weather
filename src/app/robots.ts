import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/site";

/**
 * Everyone may crawl the public pages, AI answer engines included (they cite the site);
 * the admin panel, the API and members' own pages are off limits.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/auth/",
        "/profile",
        "/settings",
        "/notifications",
        "/closed",
        "/welcome",
        "/offline",
        "/*?join=",
      ],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
