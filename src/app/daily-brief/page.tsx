import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getViewer } from "@/lib/auth/viewer";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseServer } from "@/lib/supabase/server";
import { BriefClient } from "./BriefClient";

export const metadata: Metadata = { title: "Daily Brief · StormSync Media" };

export default async function DailyBrief() {
  const [viewer, { disabled }] = await Promise.all([
    getViewer(),
    getSiteDefaults(),
  ]);
  let sub = null;
  let hasPhone = false;
  if (viewer.signedIn) {
    const supabase = await supabaseServer();
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase
        .from("brief_subscriptions")
        .select("label, send_hour, by_email, by_push, by_text")
        .eq("user_id", viewer.id!)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("phone")
        .eq("id", viewer.id!)
        .maybeSingle(),
    ]);
    sub = s;
    hasPhone = Boolean(p?.phone);
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Newspaper aria-hidden />}
        eyebrow={["NWS", "SPC", "Open-Meteo"]}
        title="Daily Brief"
        subtitle="Everything that matters about today, on one page, and in your inbox every morning."
      />
      {disabled.includes("brief") ? (
        <ModuleOff label="The Daily Brief" />
      ) : (
        <BriefClient signedIn={viewer.signedIn} sub={sub} hasPhone={hasPhone} />
      )}
    </main>
  );
}
