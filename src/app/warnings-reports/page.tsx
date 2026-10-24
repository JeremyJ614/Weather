import type { Metadata } from "next";
import { Radio, Siren } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { HomeTabs } from "@/features/news/HomeTabs";
import { getSiteDefaults } from "@/lib/settings";
import { pick } from "@/lib/colors/pick";
import { getColors } from "@/lib/colors/server";
import { warningsList } from "@/lib/warnings/feed";
import { KIND, type ReportKind } from "@/lib/warnings/reports";
import { ReportsView } from "./ReportsView";
import { WarningsView } from "./WarningsView";
import s from "./Warn.module.css";

export const metadata: Metadata = {
  title: "Warnings & Reports · StormSync Media",
};

// Performance #5: served from the edge and rebuilt at most once a minute; the page catches up
// on load when the copy it was served is older than that (WarningsView).
export const dynamic = "force-static";
export const revalidate = 60;

export default async function WarningsReports() {
  const { disabled } = await getSiteDefaults();
  const [list, colors] = await Promise.all([
    disabled.includes("warnings") ? null : warningsList().catch(() => null),
    getColors(),
  ]);
  const kinds = Object.fromEntries(
    Object.entries(KIND).map(([k, v]) => [
      k,
      pick(colors, `report:${k}`, v.color),
    ]),
  ) as Record<ReportKind, string>;
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Siren aria-hidden />}
        eyebrow={["NWS alerts", "Local Storm Reports"]}
        title="Warnings & Reports"
        subtitle="What the Weather Service has warned, and what people on the ground have actually reported."
      />
      {disabled.includes("warnings") ? (
        <ModuleOff label="Warnings & Reports" />
      ) : (
        <HomeTabs
          variant="arcade"
          label="Warnings and reports"
          tabs={[
            {
              id: "wr-warnings",
              label: "Active Warnings",
              sub: "Every alert, most serious first",
              icon: <Siren aria-hidden />,
              panel: list ? (
                <WarningsView initial={list.items} at={list.at} />
              ) : (
                <p className={s.empty}>
                  The National Weather Service alert feed isn&apos;t answering
                  right now. Try again in a minute.
                </p>
              ),
            },
            {
              id: "wr-reports",
              label: "Storm Reports",
              sub: "What people saw on the ground",
              icon: <Radio aria-hidden />,
              panel: <ReportsView colors={kinds} />,
            },
          ]}
        />
      )}
    </main>
  );
}
