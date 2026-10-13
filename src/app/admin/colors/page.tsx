import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { GROUPS, cleanColors } from "@/lib/colors/registry";
import { GroupForm } from "./GroupForm";

export const metadata: Metadata = {
  title: "Map & data colors · Admin · StormSync Media",
};

/** Every map and data color in the app, editable by hex code. */
export default async function ColorsAdmin() {
  const { supabase } = await requireAdmin("colors");
  const { data } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "color_overrides")
    .maybeSingle();
  const current = cleanColors(data?.value);
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <section className="grid gap-2">
        <h1 className="display text-3xl text-accent">Map &amp; data colors</h1>
        <p className="text-sm text-muted">
          Change any map or data color by hex code. A color set back to its
          default stops being an override, so later design fixes still reach it.
          Theme colors are under Menu &amp; theme defaults.
        </p>
      </section>
      {GROUPS.map((g) => (
        <GroupForm key={g.id} group={g} current={current} />
      ))}
    </main>
  );
}
