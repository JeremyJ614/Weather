import { NAKED_EYE_PLANETS } from "./planets";

/** Astronomy line and planet colors; editable in admin → Map & data colors (`astro:*`). */
export const ASTRO_LINES = [
  { key: "sun", label: "Sun", color: "#fbbf24" },
  { key: "moon", label: "Moon", color: "#cbd5e1" },
  ...NAKED_EYE_PLANETS.map((p) => ({
    key: p.name.toLowerCase(),
    label: p.name,
    color: p.color,
  })),
];
