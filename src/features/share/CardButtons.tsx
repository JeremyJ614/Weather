"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";

/**
 * Download and Share for a drawn share card. `make` builds the picture (load the card code
 * inside it, so a page carries none of it until someone taps).
 */
export function CardButtons({
  make,
  file,
  title,
  className = "",
}: {
  make: () => Promise<Blob>;
  file: string;
  title: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const go = async (share: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const [blob, { saveOrShare }] = await Promise.all([
        make(),
        import("@/features/map/snapshot"),
      ]);
      await saveOrShare(blob, file, title, share);
    } catch {
      /* the share sheet was closed */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {([false, true] as const).map((share) => (
        <button
          key={String(share)}
          type="button"
          onClick={() => go(share)}
          disabled={busy}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold text-text disabled:opacity-60"
        >
          {share ? (
            <Share2 className="size-4 text-accent" aria-hidden />
          ) : (
            <Download className="size-4 text-accent" aria-hidden />
          )}
          {busy ? "Making it…" : share ? "Share" : "Download"}
        </button>
      ))}
    </div>
  );
}
