import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { cleanItems } from "@/lib/extras/items";
import { ExtrasSwitches } from "./ExtrasSwitches";

export const metadata: Metadata = {
  title: "Extras · Admin · StormSync Media",
};

/** Final List #8: switch each Extras item on, off or hidden. */
export default async function ExtrasAdminPage() {
  const { supabase } = await requireAdmin("extras");
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "extras_items")
    .maybeSingle();
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Extras</h1>
      <p className="text-sm text-muted">
        Every Weather Engine and Random on the Extras page. <b>On</b> shows and
        works. <b>Off</b> stays listed, greyed out as &ldquo;Off for now&rdquo;,
        and its data stops being made. <b>Hidden</b> takes it off the page; when
        everything in a tab is hidden the tab goes too. Changes show on the page
        within a few seconds.
      </p>
      <ExtrasSwitches initial={cleanItems(data?.value)} />
    </main>
  );
}
