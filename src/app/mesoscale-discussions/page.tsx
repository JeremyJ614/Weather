import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { ScanEye } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getSiteDefaults } from "@/lib/settings";
import { mesoscale } from "@/lib/spc/md";
import { MdView } from "./MdView";
import s from "./Md.module.css";

export const metadata: Metadata = pageMeta(
  "/mesoscale-discussions",
  "Mesoscale Discussions",
  "What SPC forecasters are watching develop in the next few hours, and how likely a watch is.",
);
export const revalidate = 120;

export default async function MesoscaleDiscussions() {
  const { disabled } = await getSiteDefaults();
  const data = disabled.includes("md")
    ? null
    : await mesoscale().catch(() => null);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<ScanEye aria-hidden />}
        eyebrow={["SPC", "Short-fuse"]}
        title="Mesoscale Discussions"
        subtitle="What SPC forecasters are watching develop in the next few hours, and how likely a watch is."
      />
      {disabled.includes("md") ? (
        <ModuleOff label="Mesoscale Discussions" />
      ) : data ? (
        <MdView initial={data} />
      ) : (
        <p className={s.muted}>
          The SPC mesoscale feed isn&apos;t answering right now. Try again in a
          minute.
        </p>
      )}
    </main>
  );
}
