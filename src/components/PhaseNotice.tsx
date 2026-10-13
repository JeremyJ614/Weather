import { Construction } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { PageHero } from "@/components/ui/PageHero";

/**
 * The one allowed stand-in: a page listed in navigation before its phase is
 * built says so plainly instead of showing a fake screen.
 */
export function PhaseNotice({
  page,
  phase,
  icon,
}: {
  page: string;
  phase: string;
  icon?: string;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={icon ? <NavIcon name={icon} /> : <Construction aria-hidden />}
        eyebrow={["In the build queue"]}
        title={page}
        subtitle="This page is coming. It appears here the moment it works with real data, never before."
      />
      <section className="panel grid gap-3 rounded-2xl p-5">
        <p className="eyebrow">Build phase {phase}</p>
        <p className="text-sm text-muted">
          StormSync Weather is built one tested phase at a time. Everything that
          is live works on real NWS, NOAA and partner data; nothing here is a
          mock-up.
        </p>
      </section>
    </main>
  );
}
