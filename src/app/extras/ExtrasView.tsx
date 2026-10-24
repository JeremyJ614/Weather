"use client";

import dynamic from "next/dynamic";
import { Cpu, Shapes } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import type { Colors } from "@/lib/colors/pick";
import { EXTRAS_ITEMS, stateOf, type ExtrasStates } from "@/lib/extras/items";

const loading = () => <p className="text-sm text-muted">Loading…</p>;
const EnginesTab = dynamic(
  () => import("@/features/engines/EnginesTab").then((m) => m.EnginesTab),
  { ssr: false, loading },
);
const Randoms = dynamic(
  () => import("@/features/randoms/Randoms").then((m) => m.Randoms),
  { ssr: false, loading },
);

/** A tab whose every item is hidden (admin → Extras) leaves the page. */
const anyShown = (items: ExtrasStates, group: string) =>
  EXTRAS_ITEMS.some(
    (i) => i.group === group && stateOf(items, i.id) !== "hidden",
  );

/** Extras: Weather Engines and Randoms, each loaded only when opened. */
export function ExtrasView({
  colors,
  items,
}: {
  colors: Colors;
  items: ExtrasStates;
}) {
  const tabs = [
    anyShown(items, "engines") && {
      id: "engines",
      label: "Weather Engines",
      icon: <Cpu className="size-4" aria-hidden />,
      panel: <EnginesTab colors={colors} items={items} />,
    },
    anyShown(items, "randoms") && {
      id: "randoms",
      label: "Randoms",
      icon: <Shapes className="size-4" aria-hidden />,
      panel: <Randoms items={items} />,
    },
  ].filter((t) => !!t);
  if (!tabs.length)
    return (
      <p className="text-sm text-muted">
        Nothing is showing in Extras right now. Check back soon.
      </p>
    );
  return <HomeTabs label="Extras" variant="segment" tabs={tabs} />;
}
