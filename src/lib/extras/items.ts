/**
 * Everything on the Extras page the owner can switch (admin → Extras): each Weather Engine
 * and each Random. "on" shows and works; "off" stays listed but can't be opened (and its
 * data route answers 404); "hidden" is gone from the page entirely.
 */
export type ItemState = "on" | "off" | "hidden";
export const ITEM_STATES: ItemState[] = ["on", "off", "hidden"];

export const EXTRAS_ITEMS = [
  { id: "tor", group: "engines", name: "ProbTor" },
  { id: "hail", group: "engines", name: "ProbHail" },
  { id: "rot", group: "engines", name: "Rotation Tracks" },
  { id: "stp", group: "engines", name: "Significant Tornado" },
  { id: "scp", group: "engines", name: "Supercell Composite" },
  { id: "dcp", group: "engines", name: "Derecho Composite" },
  { id: "ltg", group: "engines", name: "Lightning Threat" },
  { id: "llj", group: "engines", name: "Nocturnal LLJ" },
  { id: "nst", group: "engines", name: "Landspouts & Waterspouts" },
  { id: "snsq", group: "engines", name: "Snow Squalls" },
  { id: "pyro", group: "engines", name: "Wildfire & PyroCb" },
  { id: "tctor", group: "engines", name: "Hurricane Tornadoes" },
  { id: "blind", group: "engines", name: "Radar Blind Spot" },
  { id: "storm", group: "randoms", name: "Storm Visualizer" },
  { id: "slider", group: "randoms", name: "The Weather Slider" },
  { id: "orb", group: "randoms", name: "Liquid Orb" },
  { id: "horizon", group: "randoms", name: "Event Horizon" },
  { id: "field", group: "randoms", name: "Pressure Field" },
  { id: "aura", group: "randoms", name: "Modern Visual" },
  { id: "morph", group: "randoms", name: "Particle Morph" },
] as const;

export type ExtrasItemId = (typeof EXTRAS_ITEMS)[number]["id"];
export type ExtrasStates = Partial<Record<ExtrasItemId, ItemState>>;

const IDS = new Set<string>(EXTRAS_ITEMS.map((i) => i.id));

/** Only known items with a known state; anything missing is "on". */
export function cleanItems(raw: unknown): ExtrasStates {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ExtrasStates = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>))
    if (IDS.has(k) && ITEM_STATES.includes(v as ItemState) && v !== "on")
      out[k as ExtrasItemId] = v as ItemState;
  return out;
}

export const stateOf = (s: ExtrasStates, id: string): ItemState =>
  s[id as ExtrasItemId] ?? "on";
