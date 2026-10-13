import type { Metadata } from "next";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { getSiteDefaults } from "@/lib/settings";
import { Discussion } from "./Discussion";

export const metadata: Metadata = {
  title: "Forecast Discussion · StormSync Media",
};

export default async function ForecastDiscussion() {
  const { disabled } = await getSiteDefaults();
  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-28">
      <h1 className="display mb-4 text-4xl text-accent">Forecast Discussion</h1>
      {disabled.includes("discussion") ? (
        <ModuleOff label="Forecast Discussion" />
      ) : (
        <Discussion />
      )}
    </main>
  );
}
