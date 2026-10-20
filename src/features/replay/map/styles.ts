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
export type BaseStyleId =
  "dark" | "black" | "white" | "topo" | "satellite" | "plain";

const OPENFREEMAP = "https://tiles.openfreemap.org/styles";

/**
 * Real satellite imagery.
 *
 * Esri's World Imagery, with its transportation and place-name reference
 * layers over it so roads and towns can still be read on the photograph —
 * the same imagery most chasers already know from radar apps. It needs no
 * key; the attribution is required and is carried in the style. The glyphs
 * are OpenFreeMap's, for the replay's own labels drawn over it.
 */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
export const IMAGERY_STYLE: StyleSpecification = {
  version: 8,
  name: "Satellite",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    imagery: {
      type: "raster",
      tileSize: 256,
      maxzoom: 19,
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      attribution:
        "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
    roads: {
      type: "raster",
      tileSize: 256,
      maxzoom: 19,
      tiles: [
        `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
      ],
    },
    places: {
      type: "raster",
      tileSize: 256,
      maxzoom: 19,
      tiles: [
        `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
      ],
    },
  },
  layers: [
    { id: "imagery", type: "raster", source: "imagery" },
    {
      id: "imagery-roads",
      type: "raster",
      source: "roads",
      paint: { "raster-opacity": 0.85 },
    },
    { id: "imagery-places", type: "raster", source: "places" },
  ],
};

/**
 * The five basemaps Settings offers, and the offline one.
 *
 * Settings has always listed Dark grey, Black, White, Topographic and
 * Satellite and promised all five in the map's own picker; the picker offered
 * four different ones, one of them a street map labelled as if it were the
 * satellite choice (#1). These are those five, by the names Settings uses.
 */
export const BASE_STYLES: Record<BaseStyleId, string | StyleSpecification> = {
  dark: `${OPENFREEMAP}/dark`,
  black: `${OPENFREEMAP}/dark`,
  white: `${OPENFREEMAP}/positron`,
  topo: `${OPENFREEMAP}/liberty`,
  satellite: IMAGERY_STYLE,
  plain: buildFallback(),
};

export const STYLE_LABELS: Record<BaseStyleId, string> = {
  dark: "Dark grey",
  black: "Black",
  white: "White",
  topo: "Topographic",
  satellite: "Satellite",
  plain: "Plain",
};

/** What the map's basemap picker offers, in the order Settings lists them. */
export const BASEMAP_CHOICES: readonly BaseStyleId[] = [
  "dark",
  "black",
  "white",
  "topo",
  "satellite",
];

/** The Settings value ("Dark grey", "Satellite"…) as a basemap. */
export function styleFromSetting(label: unknown): BaseStyleId | null {
  const id = (Object.keys(STYLE_LABELS) as BaseStyleId[]).find(
    (k) => STYLE_LABELS[k] === label,
  );
  return id && id !== "plain" ? id : null;
}

/**
 * Adjustments applied to a fetched style before it is shown: the Black map is
 * the dark one taken to true black, and the Topographic one is Liberty with
 * the land's relief shaded in from elevation tiles.
 */
export const STYLE_TRANSFORMS: Partial<
  Record<BaseStyleId, (s: StyleSpecification) => StyleSpecification>
> = {
  black: toBlack,
  topo: withRelief,
};

function toBlack(style: StyleSpecification): StyleSpecification {
  const fills: Record<string, string> = {
    background: "#000000",
    water: "#06080b",
    waterway: "#06080b",
    landcover_wood: "#0a0a0a",
    landuse_park: "#0a0a0a",
    landuse_residential: "#050505",
    building: "#070707",
  };
  return {
    ...style,
    name: "Black",
    layers: style.layers.map((l) => {
      const c = fills[l.id];
      if (!c) return l;
      if (l.type === "background")
        return { ...l, paint: { ...l.paint, "background-color": c } };
      if (l.type === "fill")
        return { ...l, paint: { ...l.paint, "fill-color": c } };
      if (l.type === "line")
        return { ...l, paint: { ...l.paint, "line-color": c } };
      return l;
    }),
  };
}

/**
 * Hillshading from the open Terrarium elevation tiles (AWS Terrain Tiles),
 * slipped in under the water and the roads so it shades the land and nothing
 * else. Gentle on purpose: relief is context, and the swaths drawn over it
 * are the subject.
 */
function withRelief(style: StyleSpecification): StyleSpecification {
  const layers = [...style.layers];
  const at = Math.max(
    1,
    layers.findIndex((l) =>
      /^(waterway|water|tunnel_|road|highway)/.test(l.id),
    ),
  );
  layers.splice(at, 0, {
    id: "relief",
    type: "hillshade",
    source: "relief-dem",
    paint: {
      "hillshade-exaggeration": 0.42,
      "hillshade-shadow-color": "#5b4f43",
      "hillshade-highlight-color": "#ffffff",
      "hillshade-accent-color": "#6d6254",
    },
  });
  return {
    ...style,
    name: "Topographic",
    sources: {
      ...style.sources,
      "relief-dem": {
        type: "raster-dem",
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
        tiles: [
          "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png",
        ],
        attribution: "Elevation: Mapzen Terrain Tiles (AWS Open Data)",
      },
    },
    layers,
  };
}

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

/** The style a theme opens on, when Settings has not been given a choice. */
export function styleForTheme(theme: string): BaseStyleId {
  return theme === "iceage" ? "topo" : "dark";
}
