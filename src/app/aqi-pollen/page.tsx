import type { Metadata } from "next";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { getSiteDefaults } from "@/lib/settings";
import { AirView } from "./AirView";

export const metadata: Metadata = { title: "AQI & Pollen · StormSync Media" };

export default async function AqiPollen() {
  const { disabled } = await getSiteDefaults();
  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-28">
      <h1 className="display mb-4 text-4xl text-accent">AQI &amp; Pollen</h1>
      {disabled.includes("air") ? (
        <ModuleOff label="AQI & Pollen" />
      ) : (
        <AirView />
      )}
    </main>
  );
}
