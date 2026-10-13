import type { Metadata } from "next";
import { Map as MapIcon, Percent } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { HomeTabs } from "@/features/news/HomeTabs";
import { pick } from "@/lib/colors/registry";
import { getColors } from "@/lib/colors/server";
import { PROB_STEPS, dayTabs } from "@/lib/colors/spc";
import { getSiteDefaults } from "@/lib/settings";
import { gameDate } from "@/lib/game/score";
import { OutlookView, PlaceStrip, ProbabilityView } from "./SpcViews";

export const metadata: Metadata = {
  title: "SPC & Probability · StormSync Media",
};
// Day labels ("Today", "Tomorrow") must not go stale past midnight.
export const revalidate = 600;

export default async function SpcProbability() {
  const [{ disabled }, colors] = await Promise.all([
    getSiteDefaults(),
    getColors(),
  ]);
  const steps = PROB_STEPS.map((st) => ({
    ...st,
    color: pick(colors, `prob:${st.level}`, st.color),
  }));
  const days = dayTabs(Date.parse(`${gameDate()}T12:00:00Z`));
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<MapIcon aria-hidden />}
        eyebrow={["SPC", "NOAA"]}
        title="SPC & Probability"
        subtitle="Where the Storm Prediction Center expects severe weather, nationwide, for the next eight days — and how likely it is where you are."
      />
      {disabled.includes("spc") ? (
        <ModuleOff label="SPC & Probability" />
      ) : (
        <div className="grid gap-5">
          <PlaceStrip steps={steps} days={days} />
          <HomeTabs
            variant="segment"
            label="SPC"
            tabs={[
              {
                id: "spc-outlook",
                label: "SPC Outlook",
                icon: <MapIcon aria-hidden />,
                panel: <OutlookView days={days} />,
              },
              {
                id: "spc-prob",
                label: "Probability",
                icon: <Percent aria-hidden />,
                panel: <ProbabilityView days={days} steps={steps} />,
              },
            ]}
          />
        </div>
      )}
    </main>
  );
}
