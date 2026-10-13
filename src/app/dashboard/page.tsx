import type { Metadata } from "next";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { HomeTabs } from "@/features/news/HomeTabs";
import { WpcPanel } from "@/features/outlooks/WpcPanel";
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
  const [{ disabled }, extent] = await Promise.all([
    getSiteDefaults(),
    heatExtent(),
  ]);
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-28">
      <h1 className="display mb-4 text-4xl text-accent">Dashboard</h1>
      {disabled.includes("dashboard") ? (
        <ModuleOff label="The dashboard" />
      ) : (
        <HomeTabs
          tabs={[
            { id: "mine", label: "My Weather", panel: <Dashboard /> },
            {
              id: "wpc",
              label: "WPC",
              panel: <WpcPanel heatDays={heatRiskDays(extent)} />,
            },
          ]}
        />
      )}
    </main>
  );
}
