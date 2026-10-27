"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Share this page: the phone's share sheet where there is one, otherwise the link is copied.
 * Every share is free marketing, and the page's share image does the rest.
 */
export function ShareButton({
  title,
  text,
  className = "",
}: {
  title: string;
  text?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = location.href.split("#")[0];
    try {
      if (navigator.share) return await navigator.share({ title, text, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold text-text ${className}`}
    >
      {copied ? (
        <Check className="size-4 text-accent" aria-hidden />
      ) : (
        <Share2 className="size-4 text-accent" aria-hidden />
      )}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
