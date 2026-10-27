import { OG_SIZE, OG_TYPE, ogCard } from "@/lib/seo/og";
import { SITE } from "@/lib/seo/site";

export const alt = `${SITE.name}: live radar, SPC outlooks and storm chasing`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** The brand card every page shares unless it has its own. */
export default function Image() {
  return ogCard({
    eyebrow: "Severe weather · Radar · Outlooks",
    title: "Know what the sky is about to do",
    sub: "Live radar, SPC outlooks, warnings, tropical storms and storm chasing tools. Free to start.",
  });
}
