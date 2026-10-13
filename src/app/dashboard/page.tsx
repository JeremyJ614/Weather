import type { Metadata } from "next";
import { CloudSun, Leaf, LayoutGrid, Map, Thermometer } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { HomeTabs } from "@/features/news/HomeTabs";
import { CpcPanel, FallPanel, WpcPanel } from "@/features/outlooks/lazy";
import { getFallReport } from "@/lib/weather/foliage";
import { getSiteDefaults } from "@/lib/settings";
import { heatRiskDays } from "@/lib/weather/wpc";

export const metadata: Metadata = { title: "Dashboard · StormSync Media" };

async function heatExtent(): Promise<[number, number] | null> {
  try {
    const r = await fetch(
      "https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer?f=json",
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) },
    );
    const j = r.ok ? await r.json() : null;
    return Array.isArray(j?.timeInfo?.timeExtent)
      ? j.timeInfo.timeExtent
      : null;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const [{ disabled }, extent, fall] = await Promise.all([
    getSiteDefaults(),
    heatExtent(),
    getFallReport(),
  ]);
  return (
    <main className="mx-auto max-w-3xl px-4 pt-4 pb-28">
      <PageHero
        icon={<LayoutGrid aria-hidden />}
        eyebrow={["NWS", "WPC", "CPC", "USA-NPN"]}
        title="Your Dashboard"
        subtitle="Live conditions for your place, the national outlooks, and the color of the season."
      />
      {disabled.includes("dashboard") ? (
        <ModuleOff label="The dashboard" />
      ) : (
        <HomeTabs
          variant="segment"
          label="Dashboard"
          tabs={[
            {
              id: "mine",
              label: "Mine",
              icon: <CloudSun aria-hidden />,
              panel: <Dashboard />,
            },
            {
              id: "wpc",
              label: "WPC",
              icon: <Map aria-hidden />,
              panel: <WpcPanel heatDays={heatRiskDays(extent)} />,
            },
            {
              id: "cpc",
              label: "CPC",
              icon: <Thermometer aria-hidden />,
              panel: <CpcPanel />,
            },
            {
              id: "fall",
              label: "Fall",
              icon: <Leaf aria-hidden />,
              panel: <FallPanel report={fall} />,
            },
          ]}
        />
      )}
    </main>
  );
}
