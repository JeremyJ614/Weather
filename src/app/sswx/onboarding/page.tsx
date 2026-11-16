import type { Metadata } from "next";
import { Route } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { requireSswx } from "@/lib/sswx/page";
import s from "@/features/sswx/Sswx.module.css";

export const metadata: Metadata = {
  title: "Onboarding Process · SSWX",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function Onboarding() {
  await requireSswx();
  return (
    <main className={s.stage}>
      <PageHero
        icon={<Route aria-hidden />}
        eyebrow={["SSWX", "Next phase"]}
        title="Onboarding Process"
        subtitle="Being built next, after the Active Roster and Application Center."
      />
    </main>
  );
}
