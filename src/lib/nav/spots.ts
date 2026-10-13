/**
 * Where a menu's controls sit. Each menu style lists the placements it can use,
 * best first, and which screen zones each placement covers. When a user runs
 * two menus at once, the main menu takes its first choice and the second menu
 * takes its first choice that covers none of the same zones.
 */
export type Zone =
  | "top-left"
  | "top-center"
  | "top-right"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Placement {
  id: string;
  zones: Zone[];
}

export interface Resolution {
  main: Placement;
  second: Placement;
  /** True when no clean placement existed and the second menu was lifted above the first. */
  stacked: boolean;
}

export const BOTTOM_BAR: Zone[] = [
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export function resolvePlacements(
  main: Placement[],
  second: Placement[],
): Resolution {
  if (!main.length || !second.length)
    throw new Error("A menu must offer at least one placement");
  const m = main[0];
  const taken = new Set(m.zones);
  const free = second.find((pl) => pl.zones.every((z) => !taken.has(z)));
  if (free) return { main: m, second: free, stacked: false };
  return {
    main: m,
    second: { ...second[0], id: `${second[0].id}-raised` },
    stacked: true,
  };
}
