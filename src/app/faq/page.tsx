import type { Metadata } from "next";
import { CircleHelp } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getFaq } from "@/lib/help/faq";
import { FaqView } from "./FaqView";

export const metadata: Metadata = { title: "FAQ · StormSync Weather" };

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
    </main>
  );
}
