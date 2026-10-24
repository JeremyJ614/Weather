/** Weatherdle's tile colors (editable in admin → Map & data colors, group "weatherdle"). */
export const WORDLE_COLORS = [
  { key: "hit", label: "Right letter, right spot", color: "#3fae5a" },
  { key: "near", label: "In the word, wrong spot", color: "#d4a72c" },
  { key: "miss", label: "Not in the word", color: "#3a3d4d" },
] as const;
export type MarkKey = (typeof WORDLE_COLORS)[number]["key"];
/** The database's marks (g, y, x) as color keys. */
export const MARK: Record<string, MarkKey> = { g: "hit", y: "near", x: "miss" };
