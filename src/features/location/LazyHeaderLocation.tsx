"use client";

import dynamic from "next/dynamic";

/**
 * The header's place, loaded after the page (it reads this device's saved places, so there is
 * nothing to draw on the server), keeping every page's first load inside its speed budget.
 */
export const HeaderLocation = dynamic(
  () => import("./HeaderLocation").then((m) => m.HeaderLocation),
  { ssr: false },
);
