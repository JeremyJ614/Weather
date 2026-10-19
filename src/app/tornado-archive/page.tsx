import type { Metadata } from "next";
import { Suspense } from "react";
import { Tornado } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { archiveCatalog } from "@/lib/archive/list";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { ArchiveView } from "./ArchiveView";

export const metadata: Metadata = {
  title: "Official Tornado Archive · StormSync Media",
};
export const revalidate = 1800;

export default async function TornadoArchive() {
  const [{ disabled }, colors, { famous, auto }] = await Promise.all([
    getSiteDefaults(),
    getColors(),
    archiveCatalog(),
  ]);
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
          <ArchiveView famous={famous} auto={auto} colors={colors} />
        </Suspense>
      )}
    </main>
  );
}
