/** Preference storage keys and shape; tiny, so the root layout's sync can import it. */
import type { Places } from "@/features/location/store";
import type { IntroPref } from "@/features/intro/schedule";

export type Prefs = {
  menus?: { main: string; second: string };
  theme?: { palette: string; font: string };
  intro?: IntroPref;
  places?: Places;
  /** The member has seen the new-member tour. */
  toured?: boolean;
};

export const KEYS = {
  menus: "sswx-menus",
  theme: "sswx-theme",
  intro: "sswx-intro",
  tour: "sswx-tour",
} as const;
