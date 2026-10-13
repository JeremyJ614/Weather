import type { Metadata } from "next";
import { MENU_NAMES, OFFERED } from "@/features/menus/catalog";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getSiteDefaults } from "@/lib/settings";
import { FONT_SETS, PALETTES } from "@/lib/theme/registry";
import { DefaultsForm } from "./DefaultsForm";

export const metadata: Metadata = {
  title: "Menu & theme defaults · StormSync Media",
};

export default async function MenusAdmin() {
  await requireAdmin("menus");
  const current = await getSiteDefaults();
  const style = (id: string) => ({ id, name: MENU_NAMES[id] });
  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 pt-6 pb-24">
      <div>
        <h1 className="display text-3xl text-accent">
          Menu &amp; theme defaults
        </h1>
        <p className="mt-1 text-sm text-muted">
          What everyone sees until they choose their own in Account Settings.
        </p>
      </div>
      <DefaultsForm
        current={current}
        main={OFFERED.main.map(style)}
        second={OFFERED.second.map(style)}
        palettes={PALETTES.map(({ id, name }) => ({ id, name }))}
        fonts={FONT_SETS.map(({ id, name }) => ({ id, name }))}
      />
    </main>
  );
}
