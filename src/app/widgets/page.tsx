import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { pageMeta } from "@/lib/seo/site";
import { WidgetMaker } from "./WidgetMaker";

export const metadata: Metadata = pageMeta(
  "/widgets",
  "Free weather widgets",
  "Put the live SSWXCon Score, today's SPC severe outlook or your town's conditions and warnings on your own site, free.",
);

/** Free embeddable widgets (post-launch A9, B7): pick one, preview it, copy the code. */
export default function Widgets() {
  return (
    <main className="grid gap-4 pb-10">
      <PageHero
        eyebrow={["Free", "For any website"]}
        title="Free weather widgets"
        subtitle="Live StormSync weather on your site, blog, school or club page. Copy one line of code; it updates by itself."
      />
      <WidgetMaker />
    </main>
  );
}
