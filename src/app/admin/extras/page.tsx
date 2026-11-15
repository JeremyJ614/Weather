import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { cleanItems } from "@/lib/extras/items";
import { ExtrasSwitches } from "./ExtrasSwitches";
import { DeerSeasons } from "./DeerSeasons";
import type { DeerSeasons as Seasons } from "./actions";
import { ReportCards } from "./ReportCards";

export const metadata: Metadata = {
  title: "Extras · Admin · StormSync Media",
};

/** Final List #8: switch each Extras item on, off or hidden; Deer Activity's seasons. */
export default async function ExtrasAdminPage() {
  const { supabase } = await requireAdmin("extras");
  const [{ data }, { data: deer }] = await Promise.all([
    supabase
      .from("app_config")
      .select("value")
      .eq("key", "extras_items")
      .maybeSingle(),
    supabase
      .from("app_config")
      .select("value")
      .eq("key", "deer_seasons")
      .maybeSingle(),
  ]);
  const d = (deer?.value ?? {}) as Partial<Seasons>;
  return (
    <main className="mx-auto grid max-w-2xl gap-4 px-4 pt-6 pb-24">
      <h1 className="display text-3xl text-accent">Extras</h1>
      <p className="text-sm text-muted">
        Every Weather Engine and Random on the Extras page. <b>On</b> shows and
        works. <b>Off</b> stays listed, greyed out as &ldquo;Off for now&rdquo;,
        and its data stops being made. <b>Hidden</b> takes it off the page; when
        everything in a tab is hidden the tab goes too. <b>Own page</b> moves it
        out of Extras onto a page of its own: it joins an &ldquo;Extras&rdquo;
        section at the end of the main menu (move it anywhere in the Menu
        editor), and it is listed in Pricing to put on plans, starting on the
        same plans as the Extras page. <b>On</b> moves it back into its Extras
        tab. Changes show within a few seconds.
      </p>
      <ExtrasSwitches initial={cleanItems(data?.value)} />
      <ReportCards />
      <DeerSeasons
        initial={{
          state: d.state ?? "Ohio",
          seasons: d.seasons ?? [],
          rut: {
            pre: "10-25",
            peak: "11-05",
            post: "11-21",
            end: "12-10",
            ...(d.rut ?? {}),
          },
        }}
      />
    </main>
  );
}
