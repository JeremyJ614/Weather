"use client";

import dynamic from "next/dynamic";
import Link from "@/components/IntentLink";
import { Cpu, Shapes } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { HomeTabs } from "@/features/news/HomeTabs";
import type { Colors } from "@/lib/colors/pick";
import {
  EXTRAS_ITEMS,
  forTabs,
  onPages,
  stateOf,
  type ExtrasStates,
} from "@/lib/extras/items";
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

/** A tab whose every item is hidden (admin → Extras) leaves the page. */
const anyShown = (items: ExtrasStates, group: string) =>
  EXTRAS_ITEMS.some(
    (i) => i.group === group && stateOf(items, i.id) !== "hidden",
  );

/** Extras: Weather Engines and Randoms, each loaded only when opened. */
export function ExtrasView({
  colors,
  items: all,
  confidence,
}: {
  colors: Colors;
  items: ExtrasStates;
  confidence: Confidence;
}) {
  // Items moved onto pages of their own leave the tabs; a row of links points to them.
  const items = forTabs(all);
  const moved = onPages(all);
  const own = moved.length > 0 && (
    <nav aria-label="Extras with their own pages" className="grid gap-2">
      <p className="eyebrow">On their own pages</p>
      <ul className="flex flex-wrap gap-2">
        {moved.map((i) => (
          <li key={i.id}>
            <Link
              href={`/${i.slug}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-3 text-sm font-bold text-text"
            >
              <NavIcon name={i.icon} className="size-4 text-accent" />
              {i.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
  const tabs = [
    anyShown(items, "engines") && {
      id: "engines",
      label: "Weather Engines",
      icon: <Cpu className="size-4" aria-hidden />,
      panel: (
        <EnginesTab colors={colors} items={items} confidence={confidence} />
      ),
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
      own || (
        <p className="text-sm text-muted">
          Nothing is showing in Extras right now. Check back soon.
        </p>
      )
    );
  return (
    <div className="grid gap-4">
      {own}
      <HomeTabs label="Extras" variant="segment" tabs={tabs} />
    </div>
  );
}
