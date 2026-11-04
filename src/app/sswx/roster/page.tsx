import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { requireSswx } from "@/lib/sswx/page";
import { getRoster } from "@/lib/sswx/store";
import { RosterView } from "@/features/sswx/RosterView";
import s from "@/features/sswx/Sswx.module.css";

export const metadata: Metadata = {
  title: "Active Roster · SSWX",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function RosterPage() {
  await requireSswx();
  const roster = await getRoster();
  return (
    <main className={s.stage}>
      <PageHero
        icon={<Users aria-hidden />}
        eyebrow={["SSWX", `${roster.members.length} active`]}
        title="Active Roster"
        subtitle="StormSync Media's team, department by department. Swipe through each one."
      />
      <RosterView roster={roster} />
    </main>
  );
}
