"use client";

import dynamic from "next/dynamic";
import type { Colors } from "@/lib/colors/pick";
import type { ExtrasStates } from "@/lib/extras/items";
import type { Confidence } from "@/lib/engines/confidence";

const loading = () => <p className="text-sm text-muted">Loading…</p>;
const EnginesTab = dynamic(
  () => import("@/features/engines/EnginesTab").then((m) => m.EnginesTab),
  { ssr: false, loading },
);
const Randoms = dynamic(
  () => import("@/features/randoms/Randoms").then((m) => m.Randoms),
  { ssr: false, loading },
);

/** One Extras item on a page of its own (admin → Extras → Own page). */
export function ExtraView({
  id,
  group,
  colors,
  items,
  confidence,
}: {
  id: string;
  group: "engines" | "randoms";
  colors: Colors;
  items: ExtrasStates;
  confidence: Confidence;
}) {
  return group === "engines" ? (
    <EnginesTab
      colors={colors}
      items={items}
      only={id}
      confidence={confidence}
    />
  ) : (
    <Randoms items={items} only={id} />
  );
}
