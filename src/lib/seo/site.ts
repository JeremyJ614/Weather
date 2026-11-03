import type { Metadata } from "next";

/** Who and where the site is, for metadata, structured data, the sitemap and feeds. */
export const SITE = {
  url: "https://weather.sswx.space",
  name: "StormSync Weather",
  publisher: "StormSync Media",
  description:
    "Severe weather, live radar, SPC outlooks, forecasts and storm chasing tools from StormSync Media. Free to start, built for phones.",
  logo: "/icons/icon-512.png",
  /** The owner's other public profiles (Organization `sameAs`). */
  sameAs: ["https://sswx.space"],
} as const;

/**
 * One page's title, description, canonical address, Open Graph and Twitter card. The root
 * layout's title template adds " · StormSync Weather"; `noindex` keeps private pages
 * (settings, sign-in flows) out of search results.
 */
export function pageMeta(
  path: string,
  title: string,
  description: string,
  opts: { noindex?: boolean; type?: "website" | "article" } = {},
): Metadata {
  const full = `${title} · ${SITE.name}`;
  // The brand card (app/opengraph-image); pages with their own image file override it.
  const images = [
    { url: "/opengraph-image", width: 1200, height: 630, alt: SITE.name },
  ];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: full,
      description,
      url: path,
      siteName: SITE.name,
      type: opts.type ?? "website",
      locale: "en_US",
      images,
    },
    twitter: { card: "summary_large_image", title: full, description, images },
    ...(opts.noindex && { robots: { index: false, follow: true } }),
  };
}
