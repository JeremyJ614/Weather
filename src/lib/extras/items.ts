/**
 * Everything on the Extras page the owner can switch (admin → Extras): each Weather Engine
 * and each Random. "on" shows and works in its Extras tab; "off" stays listed but can't be
 * opened (and its data route answers 404); "hidden" is gone from the page entirely; "page"
 * moves it out of Extras onto a page of its own at `/<slug>`, in the menus and sellable on
 * the plans like any other page (choosing "on" moves it back).
 */
export type ItemState = "on" | "off" | "hidden" | "page";
export const ITEM_STATES: ItemState[] = ["on", "off", "hidden", "page"];

type Item = {
  id: string;
  group: "engines" | "randoms";
  name: string;
  /** Its own page's address, when it has one. */
  slug: string;
  /** A NavIcon name, for the menus. */
  icon: string;
  /** One line for its page and the menus' search. */
  blurb: string;
};
const e = <I extends string>(
  id: I,
  name: string,
  slug: string,
  icon: string,
  blurb: string,
) => ({ id, group: "engines", name, slug, icon, blurb }) satisfies Item;
const r = <I extends string>(
  id: I,
  name: string,
  slug: string,
  icon: string,
  blurb: string,
) => ({ id, group: "randoms", name, slug, icon, blurb }) satisfies Item;

export const EXTRAS_ITEMS = [
  e(
    "tor",
    "ProbTor",
    "probtor",
    "Tornado",
    "Each storm's tornado chance for the next hour, from NOAA's ProbSevere.",
  ),
  e(
    "surge",
    "Lightning Surge Detector",
    "lightning-surge",
    "Activity",
    "Storms whose lightning is jumping right now, a sign they're strengthening.",
  ),
  e(
    "first",
    "First Storms",
    "first-storms",
    "CloudLightning",
    "Where the first thunderstorms will start in the next six hours, and when.",
  ),
  e(
    "bound",
    "Boundary Collisions",
    "boundary-collisions",
    "Network",
    "Where outflow boundaries, fronts and drylines will meet in the next three hours.",
  ),
  e(
    "stp",
    "Significant Tornado",
    "significant-tornado",
    "Tornado",
    "The Significant Tornado Parameter for this evening, from the HRRR.",
  ),
  e(
    "scp",
    "Supercell Composite",
    "supercell-composite",
    "CloudLightning",
    "Where supercells are possible this evening, from the HRRR.",
  ),
  e(
    "dcp",
    "Derecho Composite",
    "derecho-composite",
    "Wind",
    "Where long-lived wind storms could organize.",
  ),
  e(
    "ltg",
    "Lightning Threat",
    "lightning-threat",
    "Zap",
    "How much lightning to expect in the next three hours.",
  ),
  e(
    "rwrap",
    "Rain-Wrap Index",
    "rain-wrap-index",
    "Droplets",
    "Whether a storm's tornado would be visible or hidden in rain.",
  ),
  e(
    "blizz",
    "Blizzard Composite",
    "blizzard-composite",
    "Snowflake",
    "Hours of blizzard whiteout over the next two days.",
  ),
  e(
    "sunset",
    "Sunset & Sunrise",
    "sunset-sunrise",
    "Sunrise",
    "How colorful tonight's sunset and tomorrow's sunrise will be.",
  ),
  e(
    "rainbow",
    "Rainbow Chance",
    "rainbow-chance",
    "Rainbow",
    "Where a rainbow could show now and in the next hour, and which way to look.",
  ),
  e(
    "deer",
    "Deer Activity",
    "deer-activity",
    "Compass",
    "A Day 1–3 outlook of deer movement across the lower 48, drawn like SPC's.",
  ),
  e(
    "fish",
    "Fishing Bite",
    "fishing-bite",
    "Waves",
    "A Day 1–3 outlook of the bite across the lower 48 for five kinds of fish.",
  ),
  e(
    "llj",
    "Nocturnal LLJ",
    "nocturnal-llj",
    "Wind",
    "The low-level jet's ramp-up tonight, which feeds night storms.",
  ),
  e(
    "nst",
    "Landspouts & Waterspouts",
    "landspouts-waterspouts",
    "Waves",
    "Where non-supercell tornadoes and waterspouts could form.",
  ),
  e(
    "pyro",
    "Wildfire & PyroCb",
    "wildfire-pyrocb",
    "Flame",
    "Fire weather, and which wildfires could blow up into their own storms.",
  ),
  e(
    "tctor",
    "Hurricane Tornadoes",
    "hurricane-tornadoes",
    "Tornado",
    "Tornado risk in a landfalling storm's outer rain bands.",
  ),
  e(
    "blind",
    "Radar Blind Spot",
    "radar-blind-spot",
    "Radar",
    "How low the nearest radar sees over any spot in the country.",
  ),
  r(
    "storm",
    "Storm Visualizer",
    "storm-visualizer",
    "Tornado",
    "A supercell, a tornado and a hurricane built from up to 135,000 particles.",
  ),
  r(
    "slider",
    "The Weather Slider",
    "weather-slider",
    "Camera",
    "Real storm photos pouring into each other.",
  ),
  r(
    "orb",
    "Liquid Orb",
    "liquid-orb",
    "Droplets",
    "A glass orb of swirling liquid, with every control.",
  ),
  r(
    "horizon",
    "Event Horizon",
    "event-horizon",
    "Orbit",
    "Light bending around a black hole.",
  ),
  r(
    "field",
    "Pressure Field",
    "pressure-field",
    "Waves",
    "Glowing lines lifted by moving noise.",
  ),
  r(
    "aura",
    "Modern Visual",
    "modern-visual",
    "Sparkles",
    "A glass crystal in rings of light.",
  ),
  r(
    "morph",
    "Particle Morph",
    "particle-morph",
    "Sparkles",
    "Particles that reshape themselves.",
  ),
  r(
    "ink",
    "Ink Flow",
    "ink-flow",
    "Palette",
    "A real fluid you stir with your finger.",
  ),
  r(
    "flock",
    "Murmuration",
    "murmuration",
    "Wind",
    "Thousands of starlings wheeling at dusk.",
  ),
  r(
    "sand",
    "Falling Sand",
    "falling-sand",
    "Timer",
    "Pour sand, water, fire and seeds.",
  ),
  r(
    "galaxy",
    "Galaxy Forge",
    "galaxy-forge",
    "Telescope",
    "A spiral galaxy, then two colliding.",
  ),
  r(
    "ocean",
    "Ocean Day Cycle",
    "ocean-day-cycle",
    "Waves",
    "A shader ocean from dawn through a lightning storm to moonlit night.",
  ),
  r(
    "spacetime",
    "Curved Spacetime",
    "curved-spacetime",
    "Orbit",
    "Stars, planets and black holes bending a glowing grid you can throw them across.",
  ),
  r(
    "aurora",
    "Aurora Painter",
    "aurora-painter",
    "Sparkles",
    "Paint rippling northern lights across a starry sky above the mountains.",
  ),
] as const;

/**
 * Built and waiting on the owner's approval (Fix list 2026-10-30 #5): hidden until switched on
 * in admin → Extras; admins see it in its tab marked as a preview.
 */
const AWAITING: ReadonlySet<string> = new Set(["spacetime"]);
/** Still waiting on the owner: an admin sees it in its tab, marked as a preview. */
export const awaiting = (s: ExtrasStates, id: string) =>
  AWAITING.has(id) && !(id in s);
/** What an item is when the owner hasn't set it. */
export const defaultState = (id: string): ItemState =>
  AWAITING.has(id) ? "hidden" : "on";

export type ExtrasItemId = (typeof EXTRAS_ITEMS)[number]["id"];
export type ExtrasStates = Partial<Record<ExtrasItemId, ItemState>>;

const IDS = new Set<string>(EXTRAS_ITEMS.map((i) => i.id));

/** Only known items with a known state; anything missing is its default (`defaultState`). */
export function cleanItems(raw: unknown): ExtrasStates {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ExtrasStates = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>))
    if (
      IDS.has(k) &&
      ITEM_STATES.includes(v as ItemState) &&
      v !== defaultState(k)
    )
      out[k as ExtrasItemId] = v as ItemState;
  return out;
}

export const stateOf = (s: ExtrasStates, id: string): ItemState =>
  s[id as ExtrasItemId] ?? defaultState(id);

/** Whether it works (its data is made, its routes answer): in its tab or on its own page. */
export const isLive = (s: ExtrasStates, id: string) => {
  const st = stateOf(s, id);
  return st === "on" || st === "page";
};

/** The switches as the Extras tabs see them: an item on its own page is gone from the tabs. */
export const forTabs = (s: ExtrasStates): ExtrasStates =>
  Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, v === "page" ? "hidden" : v]),
  );

/** Items moved onto pages of their own. */
export const onPages = (s: ExtrasStates) =>
  EXTRAS_ITEMS.filter((i) => s[i.id] === "page");
