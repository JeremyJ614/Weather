import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/site";
import { Car } from "lucide-react";
import { ModuleOff } from "@/components/ops/ModuleOff";
import { PageHero } from "@/components/ui/PageHero";
import { getColors } from "@/lib/colors/server";
import { getSiteDefaults } from "@/lib/settings";
import {
  chaseDay,
  runChase,
  saveChase,
  type ChaseDay,
} from "@/lib/chase/engine";
import { supabaseServer } from "@/lib/supabase/server";
import { ChaseView, type Ledger } from "./ChaseView";

export const metadata: Metadata = pageMeta(
  "/storm-chasing-outlook",
  "Storm Chasing Outlook",
  "Today's two best places to chase, why, what kind of storms, how the day could bust, and how it ranks against the year.",
);
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function StormChasingOutlook() {
  const { disabled } = await getSiteDefaults();
  if (disabled.includes("chase"))
    return (
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        <ModuleOff label="Storm Chasing Outlook" />
      </main>
    );
  const sb = await supabaseServer();
  const today = chaseDay();
  const [{ data: row }, { data: year }, colors] = await Promise.all([
    sb.from("chase_days").select("data").eq("day", today).maybeSingle(),
    sb
      .from("chase_days")
      .select("day, top_score, spc_cat, tornado_pct, place, generated_at")
      .gte("day", `${today.slice(0, 4)}-01-01`)
      .order("day"),
    getColors(),
  ]);
  // The daily scan runs after SPC's midday outlook; before it has, the first visit runs it.
  let day = (row?.data as ChaseDay | undefined) ?? null;
  let ledger = (year ?? []) as Ledger;
  if (!day) {
    // If it can't be saved (no service key, database busy), still show a fresh scan.
    day = await saveChase().catch(() => runChase().catch(() => null));
    if (day && !ledger.some((l) => l.day === day!.day))
      ledger = [
        ...ledger,
        {
          day: day.day,
          top_score: day.targets[0]?.score ?? 0,
          spc_cat: null,
          tornado_pct: day.targets[0]?.spc.torn ?? 0,
          place: day.targets[0]?.place ?? null,
        },
      ];
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Car aria-hidden />}
        eyebrow={["SPC", "Chase targets"]}
        title="Storm Chasing Outlook"
        subtitle="Today's two best places to chase, why, what kind of storms, how the day could bust, and how it ranks against the year."
      />
      {day ? (
        <ChaseView day={day} ledger={ledger} colors={colors} />
      ) : (
        <p className="text-muted">
          Today&apos;s chase scan couldn&apos;t run right now. Try again in a
          few minutes.
        </p>
      )}
    </main>
  );
}
