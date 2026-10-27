import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Clock } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { pick } from "@/lib/colors/pick";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { HAZ, HAZARDS, RISK, type Haz } from "@/lib/timing/calc";
import { TimingView } from "./TimingView";

export const metadata: Metadata = pageMeta(
  "/storm-timing-index",
  "Storm Timing Index",
  "Hour by hour for your place: when the atmosphere is at its most dangerous, for how long, and whether it peaks after dark.",
);

export default async function StormTiming() {
  const [{ disabled }, colors] = await Promise.all([
    getSiteDefaults(),
    getColors(),
  ]);
  const haz = Object.fromEntries(
    HAZARDS.map((k) => [k, pick(colors, `timing:${k}`, HAZ[k].color)]),
  ) as Record<Haz, string>;
  const risk = RISK.map((r, i) => pick(colors, `timing:risk:${i}`, r.color));
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Clock aria-hidden />}
        eyebrow={["When", "How long", "After dark?"]}
        title="Storm Timing Index"
        subtitle="Hour by hour for your place: when the atmosphere is at its most dangerous, for how long, and whether it peaks after dark."
      />
      {disabled.includes("timing") ? (
        <ModuleOff label="Storm Timing Index" />
      ) : (
        <TimingView colors={{ haz, risk }} />
      )}
    </main>
  );
}
