import type { Metadata } from "next";
import { ICON_NAMES } from "@/components/NavIcon";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { layoutFrom } from "@/lib/nav/layout";
import { MAIN_NAV, SECOND_NAV } from "@/lib/nav/registry";
import { EVERY_PAGE, extrasGroup, isExtrasPage } from "@/lib/nav/extras";
import { getSiteDefaults } from "@/lib/settings";
import { MenuEditor } from "./MenuEditor";

export const metadata: Metadata = {
  title: "Menu editor · Admin · StormSync Media",
};

export default async function Navigation() {
  await requireAdmin("menus");
  const { layout, extras } = await getSiteDefaults();
  // Extras items count as pages only while they have pages of their own (admin → Extras).
  const extra = extrasGroup(extras);
  const mains = extra.pages.length ? [...MAIN_NAV, extra] : MAIN_NAV;
  const listed = new Set(extra.pages.map((x) => x.slug));
  return (
    <main className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4 px-4 pt-6 pb-32">
      <div>
        <h1 className="display text-3xl text-accent">Menu editor</h1>
        <p className="mt-1 text-sm text-muted">
          Arrange both menus for everyone: add sections, reorder, rename, change
          icons, move pages between menus or hide them. Pages built later appear
          in their own section until you place them.
        </p>
      </div>
      <MenuEditor
        initial={layout ?? layoutFrom(mains, SECOND_NAV)}
        builtIn={layoutFrom(mains, SECOND_NAV)}
        pages={EVERY_PAGE.filter(
          (x) => !isExtrasPage(x.slug) || listed.has(x.slug),
        ).map(({ slug, label, icon, adminOnly }) => ({
          slug,
          label,
          icon,
          adminOnly: Boolean(adminOnly),
        }))}
        icons={ICON_NAMES}
        custom={Boolean(layout)}
      />
    </main>
  );
}
