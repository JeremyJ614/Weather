/** The model viewer's field categories, in the picker's order (shared by server and browser). */
export const CATEGORIES = [
  "Radar & Storms",
  "Instability",
  "Wind & Shear",
  "Tornado & Hail Indices",
  "Temperature & Moisture",
  "Rain & Flooding",
  "Winter",
  "Upper Air",
  "Clouds & Sky",
] as const;
export type Category = (typeof CATEGORIES)[number];
