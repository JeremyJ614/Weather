import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { requireSswx } from "@/lib/sswx/page";
import { getCenter, getRoster, getSubmissions } from "@/lib/sswx/store";
import { AppCenterView } from "@/features/sswx/AppCenterView";
import s from "@/features/sswx/Sswx.module.css";

export const metadata: Metadata = {
  title: "Application Center · SSWX",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function Applications() {
  const v = await requireSswx();
  const [center, roster, subs] = await Promise.all([
    getCenter(),
    getRoster(),
    getSubmissions(),
  ]);
  const dept = new Map(roster.departments.map((d) => [d.id, d.color]));
  return (
    <main className={s.stage}>
      <PageHero
        icon={<ClipboardList aria-hidden />}
        eyebrow={["SSWX", "Applications"]}
        title="Application Center"
        subtitle="Apply for a spot on the team, and follow every application you've sent."
      />
      <AppCenterView
        apps={center.applications.filter((a) => a.open)}
        statuses={center.statuses}
        mine={subs
          .filter((x) => x.user === v.id)
          .map(({ id, appTitle, at, status }) => ({
            id,
            appTitle,
            at,
            status,
          }))}
        ctx={{
          team: center.team,
          socials: center.socials,
          positions: roster.positions.map((p) => ({
            ...p,
            color: dept.get(p.dept) ?? "#888",
          })),
        }}
      />
    </main>
  );
}
