import type { CSSProperties } from "react";

const TOP = "calc(10px + env(safe-area-inset-top, 0px))";
const BOTTOM = "calc(16px + env(safe-area-inset-bottom, 0px))";
const RAISED = "calc(90px + env(safe-area-inset-bottom, 0px))";

/** Fixed-position style for a menu control at a resolved placement. */
export function placeStyle(id: string, size = 0): CSSProperties {
  const raised = id.endsWith("-raised");
  const base = id.replace(/-raised$/, "");
  const st: CSSProperties = {};
  if (base.startsWith("top")) st.top = TOP;
  if (base.startsWith("bottom")) st.bottom = raised ? RAISED : BOTTOM;
  if (base.endsWith("right")) st.right = 14;
  if (base.endsWith("left")) st.left = 14;
  if (base.endsWith("center")) st.left = `calc(50% - ${size / 2}px)`;
  return st;
}

export const isLeft = (id: string) => id.includes("left");
