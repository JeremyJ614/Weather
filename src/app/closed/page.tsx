import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ALL_PAGES } from "@/lib/nav/registry";

export const metadata: Metadata = { title: "Page closed · StormSync Media" };

/** Where the proxy sends a member from a page an admin closed to them. */
export default async function Closed({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const label = ALL_PAGES.find((p) => p.slug === page)?.label ?? "This page";
  return (
    <main className="mx-auto max-w-md px-4 pt-10 pb-24">
      <Card className="grid gap-3 text-center">
        <Lock className="mx-auto size-8 text-accent" aria-hidden />
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          {label} is closed on your account
        </h1>
        <p className="text-sm text-muted">
          The StormSync team turned it off for you. If that looks wrong, send us
          a message.
        </p>
        <Link
          href={`/contact?about=${encodeURIComponent(`${label} is closed on my account`)}`}
          className="text-accent underline"
        >
          Contact us
        </Link>
      </Card>
    </main>
  );
}
