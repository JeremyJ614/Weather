"use client";

import dynamic from "next/dynamic";

// Outlook tabs load their code the first time they open, keeping the dashboard's startup light.
const loading = () => (
  <div className="panel h-72 animate-pulse rounded-2xl" aria-label="Loading" />
);
export const WpcPanel = dynamic(
  () => import("./WpcPanel").then((m) => m.WpcPanel),
  { ssr: false, loading },
);
export const CpcPanel = dynamic(
  () => import("./CpcPanel").then((m) => m.CpcPanel),
  { ssr: false, loading },
);
export const FallPanel = dynamic(
  () => import("./FallPanel").then((m) => m.FallPanel),
  { ssr: false, loading },
);
