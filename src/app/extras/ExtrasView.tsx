"use client";

import dynamic from "next/dynamic";
import { Cpu, Shapes } from "lucide-react";
import { HomeTabs } from "@/features/news/HomeTabs";
import type { Colors } from "@/lib/colors/pick";

const loading = () => <p className="text-sm text-muted">Loading…</p>;
const EnginesTab = dynamic(
  () => import("@/features/engines/EnginesTab").then((m) => m.EnginesTab),
  { ssr: false, loading },
);
const Randoms = dynamic(
  () => import("@/features/randoms/Randoms").then((m) => m.Randoms),
  { ssr: false, loading },
);

/** Extras: Weather Engines and Randoms, each loaded only when opened. */
export function ExtrasView({ colors }: { colors: Colors }) {
  return (
    <HomeTabs
      label="Extras"
      variant="segment"
      tabs={[
        {
          id: "engines",
          label: "Weather Engines",
          icon: <Cpu className="size-4" aria-hidden />,
          panel: <EnginesTab colors={colors} />,
        },
        {
          id: "randoms",
          label: "Randoms",
          icon: <Shapes className="size-4" aria-hidden />,
          panel: <Randoms />,
        },
      ]}
    />
  );
}
