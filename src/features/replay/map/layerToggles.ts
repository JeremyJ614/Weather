/**
 * What the reader can turn on and off on the map.
 *
 * This exists because the floating tool menu did not. It rendered five items,
 * called `setTool` on a piece of state nothing read, and three of the five
 * duplicated buttons already sitting in the top-right panel — so pressing any
 * of them did nothing at all, twice over.
 *
 * The replacement only carries things that are genuinely a layer: something
 * drawn on the map that a reader might want out of the way. Camera modes and
 * basemaps are not layers and stay where they were.
 */

export type LayerId =
  | "funnels"
  | "contours"
  | "damage"
  | "hail"
  | "paths"
  | "warnings"
  | "track"
  | "proximity";

export interface LayerToggle {
  id: LayerId;
  label: string;
  /** What it is, in the terms a chaser would use. */
  blurb: string;
  /** The MapLibre layer ids it controls. Empty where the layer is custom. */
  layers: string[];
  on: boolean;
}

export const LAYER_TOGGLES: readonly LayerToggle[] = [
  {
    id: "funnels",
    label: "Tornadoes",
    on: true,
    layers: ["funnels", "tornado-now"],
    blurb: "The funnels themselves, and the mark at the ground contact.",
  },
  {
    id: "contours",
    label: "Damage swath",
    on: true,
    layers: [
      "contour-fill",
      "contour-line",
      "swath-fill",
      "field-fill",
      "field-line",
    ],
    blurb: "The surveyed damage contours, nested by rating.",
  },
  {
    id: "damage",
    label: "Damage points",
    on: true,
    layers: ["damage-point"],
    blurb:
      "Every surveyed point: what was hit, how hard. Over a thousand on a good survey.",
  },
  {
    id: "hail",
    label: "Hail reports",
    on: true,
    layers: ["hail-point"],
    blurb:
      "Every stone called in, drawn at the size it was measured, appearing as it was reported.",
  },
  {
    id: "paths",
    label: "Tornado paths",
    on: true,
    layers: ["path-line"],
    blurb:
      "The surveyed centrelines, whole, including the parts not reached yet.",
  },
  {
    id: "warnings",
    label: "Warning polygons",
    on: true,
    layers: ["warn-fill", "warn-line"],
    blurb:
      "The NWS polygons in force, breathing while live and fading once expired.",
  },
  {
    id: "track",
    label: "Your track",
    on: true,
    layers: ["track-done", "track-rest", "track-trail", "chaser-dot"],
    blurb: "Where you drove, and the condensation trail showing which way.",
  },
  {
    id: "proximity",
    label: "Proximity ring",
    on: true,
    layers: ["proximity-ring"],
    blurb:
      "A ring at the real distance to the nearest tornado, pulsing faster as it closes.",
  },
];

/** The default state: everything on. */
export function defaultLayers(): Record<LayerId, boolean> {
  const out = {} as Record<LayerId, boolean>;
  for (const t of LAYER_TOGGLES) out[t.id] = t.on;
  return out;
}

/**
 * Which MapLibre layers a given toggle controls.
 *
 * `funnels` is the custom WebGL layer and is handled separately by the canvas,
 * because setting `visibility` on a custom layer does not stop its render
 * method being called — it still costs a draw call and still allocates.
 */
export function mapLayersFor(id: LayerId): string[] {
  return LAYER_TOGGLES.find((t) => t.id === id)?.layers ?? [];
}
