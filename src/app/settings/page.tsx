import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getViewer } from "@/lib/auth/viewer";
import { getSiteDefaults } from "@/lib/settings";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = {
  title: "Account Settings · StormSync Media",
};
export const dynamic = "force-dynamic";

/** Account Settings: menus, theme and the launch intro, kept on the device and the account. */
export default async function Settings() {
  const [viewer, defaults] = await Promise.all([
    getViewer(),
    getSiteDefaults(),
  ]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<Settings2 aria-hidden />}
        eyebrow={["Account"]}
        title="Account Settings"
        subtitle="Pick your menus, your theme and when the intro plays."
      />
      <SettingsView
        signedIn={viewer.signedIn}
        defaults={{ menus: defaults.menus, theme: defaults.theme }}
      />
    </main>
  );
}
