/** Badge rarities (with their default colors, editable in Map & data colors) and icons. */
export const RARITY: Record<string, string> = {
  common: "#9aa3b8",
  rare: "#4cc9f0",
  epic: "#a78bfa",
  legendary: "#ffb547",
};
export const RARITIES = Object.keys(RARITY) as (keyof typeof RARITY)[];
export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  grp: string;
};
