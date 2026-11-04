import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Route, ShieldCheck, Users } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { requireSswx } from "@/lib/sswx/page";
import s from "@/features/sswx/Sswx.module.css";

export const metadata: Metadata = {
  title: "SSWX Section · StormSync Media",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const TILES = [
  {
    href: "/sswx/roster",
    icon: Users,
    title: "Active Roster",
    text: "Every department, position and member of the SSWX team.",
  },
  {
    href: "/sswx/applications",
    icon: ClipboardList,
    title: "Application Center",
    text: "Open applications, and where yours stand.",
  },
  {
    href: "/sswx/onboarding",
    icon: Route,
    title: "Onboarding Process",
    text: "Your path from Recruit to Member.",
  },
];

export default async function SswxHome() {
  const v = await requireSswx();
  return (
    <main className={s.stage}>
      <PageHero
        icon={<ShieldCheck aria-hidden />}
        eyebrow={[
          "StormSync Media",
          v.roles.includes("recruit") ? "Recruit" : "Members only",
        ]}
        title="SSWX Section"
        subtitle="The team's own corner of StormSync Weather. Only SSWX Members and Recruits can see it."
      />
      <div className={s.tiles}>
        {TILES.map(({ href, icon: I, title, text }) => (
          <Link key={href} href={href} className={`${s.glow} ${s.tile}`}>
            <I aria-hidden />
            <b>{title}</b>
            <span>{text}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
