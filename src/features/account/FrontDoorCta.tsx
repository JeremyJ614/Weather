"use client";

import Link from "@/components/IntentLink";
import { Sparkles } from "lucide-react";
import { useViewer } from "./useViewer";

/**
 * The front door's sign-up card: shown to guests on the public pages (and nobody else), so
 * a shared link or a search result turns into an account.
 */
export function FrontDoorCta({ what }: { what: string }) {
  const v = useViewer();
  if (v.pending || v.signedIn) return null;
  return (
    <aside
      aria-label="Join StormSync Weather"
      className="mb-4 grid gap-3 rounded-2xl border border-[var(--lit-line)] bg-[var(--lit)] p-4"
    >
      <p className="flex items-center gap-2 text-sm font-bold text-accent">
        <Sparkles className="size-4" aria-hidden /> You&apos;re reading {what}{" "}
        free
      </p>
      <p className="text-sm text-muted">
        A free account adds your own forecast, live radar and model runs, alerts
        where you are, WX Games and more. No card needed.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/signup"
          className="inline-flex min-h-10 items-center rounded-xl border border-accent/40 px-4 text-sm font-bold text-accent"
        >
          Create a free account
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm font-bold text-text"
        >
          Log in
        </Link>
      </div>
    </aside>
  );
}
