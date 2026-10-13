"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";

/** The admin's maintenance banner; it clears itself at its end time. */
export function SiteBanner({
  text,
  until,
}: {
  text: string;
  until: string | null;
}) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!text) return;
    const end = until ? Date.parse(until) : Infinity;
    const left = end - Date.now();
    if (left <= 0) return;
    queueMicrotask(() => setLive(true));
    if (left < 2 ** 31) {
      const t = setTimeout(() => setLive(false), left);
      return () => clearTimeout(t);
    }
  }, [text, until]);
  if (!live) return null;
  return (
    <div
      role="status"
      className="mx-auto mt-2 flex max-w-2xl items-start gap-2 rounded-xl border border-accent bg-lit px-4 py-2 text-sm text-accent"
    >
      <Megaphone className="mt-0.5 size-4 flex-none" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
