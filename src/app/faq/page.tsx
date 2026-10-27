import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { CircleHelp } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getFaq } from "@/lib/help/faq";
import { FaqView } from "./FaqView";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqPage } from "@/lib/seo/schema";

export const metadata: Metadata = pageMeta(
  "/faq",
  "FAQ",
  "Plans, alerts, your account, the data and how the app works.",
);

/** Frequently asked questions, written and arranged by the owner in admin → FAQ. */
export default async function Faq({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab }, faq] = await Promise.all([searchParams, getFaq()]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<CircleHelp aria-hidden />}
        eyebrow={["Help"]}
        title="FAQ"
        subtitle="Plans, alerts, your account, the data and how the app works."
      />
      <FaqView faq={faq} initial={tab} />
      <JsonLd
        data={faqPage(
          faq.tabs.flatMap((t) => t.sections.flatMap((x) => x.items)),
        )}
      />
    </main>
  );
}
