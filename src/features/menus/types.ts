import type { NavGroup } from "@/lib/nav/registry";
import type { Placement } from "@/lib/nav/spots";

export interface MenuProps {
  groups: NavGroup[];
  placement: Placement;
  role: "main" | "second";
  /** Every page the viewer can open (the main menu's groups), for menus that search. */
  all?: NavGroup[];
}

export interface MenuStyle {
  id: string;
  name: string;
  placements: Placement[];
  Component: React.ComponentType<MenuProps>;
}
