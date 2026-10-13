import type { Metadata } from "next";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { getSiteDefaults } from "@/lib/settings";

export const metadata: Metadata = { title: "Dashboard · StormSync Media" };

export default async function DashboardPage() {
  const { disabled } = await getSiteDefaults();
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-28">
      <h1 className="display mb-4 text-4xl text-accent">Dashboard</h1>
      {disabled.includes("dashboard") ? (
        <ModuleOff label="The dashboard" />
      ) : (
        <Dashboard />
      )}
    </main>
  );
}
