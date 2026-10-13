import { Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * The one allowed stand-in: a page listed in navigation before its phase is
 * built says so plainly instead of showing a fake screen.
 */
export function PhaseNotice({ page, phase }: { page: string; phase: string }) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4">
      <Card className="grid gap-3 text-center">
        <Construction className="mx-auto size-8 text-accent" aria-hidden />
        <h1 className="display text-3xl">{page}</h1>
        <p className="text-muted">
          This page is being built in phase {phase}. It will appear here when it
          works with real data.
        </p>
      </Card>
    </main>
  );
}
