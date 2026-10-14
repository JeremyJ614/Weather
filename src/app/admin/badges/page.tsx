import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getColors } from "@/lib/colors/server";
import type { Badge } from "@/lib/badges";
import { BadgeEditor } from "./BadgeEditor";

export const metadata: Metadata = { title: "Badges · Admin · StormSync Media" };

/** The badge library (VIP #23). Award them per member under Members. */
export default async function Badges() {
  const { supabase } = await requireAdmin("badges");
  const [{ data }, { data: awards }, colors] = await Promise.all([
    supabase
      .from("badges")
      .select("id, name, description, icon, rarity, grp")
      .order("grp")
      .order("name"),
    supabase.from("member_badges").select("badge_id"),
    getColors(),
  ]);
  const list = (data ?? []) as Badge[];
  const groups = [...new Set(list.map((b) => b.grp))];
  const held = new Map<string, number>();
  for (const a of awards ?? [])
    held.set(a.badge_id, (held.get(a.badge_id) ?? 0) + 1);
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">Badges</h1>
        <p className="mt-1 text-sm text-muted">
          Make badges here; give them to members from each member&apos;s page.
          Rarity colors are editable in Map &amp; data colors.
        </p>
      </div>
      <BadgeEditor colors={colors} groups={groups} />
      {groups.map((g) => (
        <section key={g} className="grid gap-2">
          <h2 className="font-bold">{g}</h2>
          {list
            .filter((b) => b.grp === g)
            .map((b) => (
              <div key={b.id} className="grid gap-1">
                <span className="text-xs text-muted">
                  Held by {held.get(b.id) ?? 0}
                </span>
                <BadgeEditor badge={b} colors={colors} groups={groups} />
              </div>
            ))}
        </section>
      ))}
    </main>
  );
}
