import type { Ctx, Scene } from "../stage";

export type SpacetimeScene = "orbit" | "binary" | "merger" | "solar";
export type SpacetimeTheme = "classic" | "gold" | "royal";
export type Spacetime = Scene & {
  scene(name: SpacetimeScene): void;
  /** False when the sheet is full (8 bodies) or no free spot was found. */
  add(kind: "planet" | "star" | "hole"): boolean;
  clear(): void;
  theme(name: SpacetimeTheme): void;
};
export const THEMES: Record<SpacetimeTheme, number[]>;
export function mount(el: HTMLElement, ctx: Ctx): Spacetime;
