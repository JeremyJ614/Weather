import type { Metadata } from "next";
import { Suspense } from "react";
import { Route } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getViewer } from "@/lib/auth/viewer";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseServer } from "@/lib/supabase/server";
import { ChaseLogView, type ChaseRow } from "./ChaseLogView";

export const metadata: Metadata = {
  title: "Storm Chasing Log · StormSync Media",
};

export default async function ChasingLog() {
  const [viewer, { disabled }, colors] = await Promise.all([
    getViewer(),
    getSiteDefaults(),
    getColors(),
  ]);
  let chases: ChaseRow[] = [];
  if (viewer.signedIn) {
    const { data } = await (
      await supabaseServer()
    )
      .from("chases")
      .select("id,title,day,miles,tornadoes,strongest")
      .eq("user_id", viewer.id!)
      .order("day", { ascending: false });
    chases = (data ?? []) as ChaseRow[];
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Route aria-hidden />}
        eyebrow={["Your GPS", "NWS DAT", "IEM"]}
        title="Storm Chasing Log"
        subtitle="Add your chase tracks and replay each day against every tornado the NWS surveyed near you, in 2D or a 3D chase camera."
      />
      {disabled.includes("chaselog") ? (
        <ModuleOff label="Storm Chasing Log" />
      ) : (
        <Suspense>
          <ChaseLogView
            chases={chases}
            signedIn={viewer.signedIn}
            colors={colors}
          />
        </Suspense>
      )}
    </main>
  );
}
