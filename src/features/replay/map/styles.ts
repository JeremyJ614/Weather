import type { StyleSpecification } from "maplibre-gl";

/**
 * Base map styles.
 *
 * OpenFreeMap is the default because it needs no API key: there is no token to
 * leak from a client-side bundle, no quota to exhaust mid-chase, and nothing to
 * rotate when this repository's secrets are recycled. The trade is that it is a
 * volunteer service with no uptime promise, which is why `FALLBACK` exists and
 * is a real style rather than a blank screen.
 */
export type BaseStyleId = "dark" | "terrain" | "satellite" | "plain";

const OPENFREEMAP = "https://tiles.openfreemap.org/styles";

export const BASE_STYLES: Record<BaseStyleId, string | StyleSpecification> = {
  dark: `${OPENFREEMAP}/dark`,
  terrain: `${OPENFREEMAP}/liberty`,
  satellite: `${OPENFREEMAP}/bright`,
  plain: buildFallback(),
};

export const STYLE_LABELS: Record<BaseStyleId, string> = {
  dark: "Dark",
  terrain: "Terrain",
  satellite: "Bright",
  plain: "Plain",
};

/**
 * A style with no network dependency at all.
 *
 * Used when tiles cannot be reached — which on a chase is the normal condition,
 * not the exception. A tornado path over a flat ground is still a readable map:
 * the paths, the track and the clock are the data, and the basemap is context.
 * Falling back to this is much better than a grey void with a console error.
 */
function buildFallback(): StyleSpecification {
  return {
    version: 8,
    name: "Plain",
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#0d1116" },
      },
    ],
    // Deliberately no glyphs or sprite: this style exists to work with no
    // network, and a remote reference here would defeat the point of it.
  };
}

/** The style a theme opens on. */
export function styleForTheme(theme: string): BaseStyleId {
  return theme === "iceage" ? "terrain" : "dark";
}
