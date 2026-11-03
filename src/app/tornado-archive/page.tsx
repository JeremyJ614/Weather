import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Suspense } from "react";
import { Tornado } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { historicEvents } from "@/lib/archive/list";
import { getContactForms } from "@/lib/help/forms";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { ArchiveView } from "./ArchiveView";

export const metadata: Metadata = pageMeta(
  "/tornado-archive",
  "Official Tornado Archive",
  "Watch history's tornadoes happen again: every path, damage point, survey, hail report and warning, on the clock they happened on.",
);
export const revalidate = 1800;

export default async function TornadoArchive() {
  const [{ disabled }, colors, famous, forms] = await Promise.all([
    getSiteDefaults(),
    getColors(),
    historicEvents(),
    getContactForms(),
  ]);
  const request =
    forms.tabs.find(
      (t) =>
        t.on &&
        (t.id === "tornado-archive-request" ||
          /tornado archive/i.test(t.title)),
    ) ?? null;
  return (
    <main className="mx-auto max-w-3xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Tornado aria-hidden />}
        eyebrow={["SPC", "NWS DAT", "IEM"]}
        title="Official Tornado Archive"
        subtitle="Watch history's tornadoes happen again: every path, damage point, survey, hail report and warning, on the clock they happened on."
      />
      {disabled.includes("archive") ? (
        <ModuleOff label="Tornado Archive" />
      ) : (
        <Suspense>
          <ArchiveView famous={famous} request={request} colors={colors} />
        </Suspense>
      )}
    </main>
  );
}
