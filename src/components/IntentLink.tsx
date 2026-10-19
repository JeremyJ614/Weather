"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * A Link that fetches its page when someone reaches for it (pointer over it, finger down,
 * keyboard focus) instead of as soon as it scrolls into view. Menus show dozens of links at
 * once; prefetching them all on open crowded out the page actually tapped on a phone.
 */
export default function IntentLink({
  onPointerEnter,
  onTouchStart,
  onFocus,
  ...props
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const warm = () => {
    if (typeof props.href === "string") router.prefetch(props.href);
  };
  return (
    <Link
      {...props}
      prefetch={false}
      onPointerEnter={(e) => {
        warm();
        onPointerEnter?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
    />
  );
}
