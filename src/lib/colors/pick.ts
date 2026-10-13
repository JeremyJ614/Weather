/** Admin color overrides by key (see registry.ts for the keys and defaults). */
export type Colors = Record<string, string>;

/** The override for `key`, or the default. */
export const pick = (colors: Colors | undefined, key: string, def: string) =>
  colors?.[key] ?? def;
