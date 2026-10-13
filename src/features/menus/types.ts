import type { NavGroup } from "@/lib/nav/registry";
import type { Placement } from "@/lib/nav/spots";

export interface MenuProps {
  groups: NavGroup[];
  placement: Placement;
  role: "main" | "second";
}

export interface MenuStyle {
  id: string;
  name: string;
  placements: Placement[];
  Component: (props: MenuProps) => React.ReactNode;
}
