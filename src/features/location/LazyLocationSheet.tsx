"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const Sheet = dynamic(
  () => import("./LocationSheet").then((m) => m.LocationSheet),
  { ssr: false },
);

/**
 * The location sheet, loaded the first time it opens (review round, speed): eight pages show
 * a button for it, and most visits never press it.
 */
export function LocationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [used, setUsed] = useState(open);
  if (open && !used) setUsed(true);
  return used ? <Sheet open={open} onClose={onClose} /> : null;
}
