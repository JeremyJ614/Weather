import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = { title: "Not found · StormSync Weather" };

/** Any address with no page behind it (and pages a viewer may not open), in the app's own look. */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
      <PageHero
        icon={<CloudOff aria-hidden />}
        eyebrow={["404"]}
        title="Page not found"
        subtitle="There's nothing at this address. It may have moved, or the link may be mistyped."
      />
      <nav className="flex flex-wrap gap-3 text-sm font-bold">
        <Link
          href="/"
          className="rounded-xl border border-[var(--lit-line)] bg-[var(--lit)] px-4 py-2.5 text-accent"
        >
          Go to the Homepage
        </Link>
        <Link
          href="/faq"
          className="rounded-xl border border-line px-4 py-2.5 text-muted"
        >
          FAQ
        </Link>
        <Link
          href="/contact"
          className="rounded-xl border border-line px-4 py-2.5 text-muted"
        >
          Contact us
        </Link>
      </nav>
    </main>
  );
}
