import "server-only";
import type { FeatureCollection, Geometry } from "geojson";
import { pick, type Colors } from "@/lib/colors/pick";
import { FIRE_RISK, containColor, containKey } from "./style";

/**
 * Fire Weather: active wildfires and their burn perimeters (NIFC WFIGS, the interagency
 * record every agency reports into), SPC's fire weather outlooks and NWS Red Flag alerts.
 */
const WFIGS =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
type FC = FeatureCollection<Geometry, Record<string, unknown>>;

async function get<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: UA,
      next: { revalidate },
      signal: AbortSignal.timeout(20000),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export type Fire = {
  id: string;
  name: string;
  acres: number;
  contained: number | null;
  state: string;
  county: string;
  started: string | null;
  updated: string | null;
  cause: string | null;
  personnel: number | null;
  behavior: string | null;
  about: string | null;
  lat: number;
  lon: number;
};

const ACTIVE =
  "IncidentTypeCategory='WF' AND (PercentContained<100 OR PercentContained IS NULL) AND IncidentSize>=10";
const FIELDS =
  "UniqueFireIdentifier,IncidentName,IncidentSize,PercentContained,POOState,POOCounty,FireDiscoveryDateTime,ModifiedOnDateTime_dt,FireCause,TotalIncidentPersonnel,FireBehaviorGeneral,IncidentShortDescription";
const ms = (v: unknown) =>
  typeof v === "number" ? new Date(v).toISOString() : null;
const title = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Active wildfires of 10 acres or more, largest first. */
export async function activeFires(): Promise<Fire[]> {
  const j = await get<{
    features?: {
      attributes: Record<string, unknown>;
      geometry?: { x: number; y: number };
    }[];
  }>(
    `${WFIGS}/WFIGS_Incident_Locations_Current/FeatureServer/0/query?where=${encodeURIComponent(ACTIVE)}&outFields=${FIELDS}&returnGeometry=true&outSR=4326&orderByFields=IncidentSize%20DESC&resultRecordCount=400&f=json`,
    900,
  );
  return (j?.features ?? [])
    .filter((f) => f.geometry)
    .map(({ attributes: a, geometry: g }) => ({
      id: String(a.UniqueFireIdentifier ?? a.IncidentName),
      name: title(String(a.IncidentName ?? "Unnamed fire").trim()),
      acres: Math.round(Number(a.IncidentSize) || 0),
      contained: a.PercentContained == null ? null : Number(a.PercentContained),
      state: String(a.POOState ?? "").replace(/^US-/, ""),
      county: String(a.POOCounty ?? ""),
      started: ms(a.FireDiscoveryDateTime),
      updated: ms(a.ModifiedOnDateTime_dt),
      cause: (a.FireCause as string) || null,
      personnel:
        a.TotalIncidentPersonnel == null
          ? null
          : Number(a.TotalIncidentPersonnel),
      behavior: (a.FireBehaviorGeneral as string) || null,
      about: (a.IncidentShortDescription as string) || null,
      lat: g!.y,
      lon: g!.x,
    }));
}

/** Points for the map, colored by containment and sized by acres. */
export function firePoints(fires: Fire[], colors: Colors = {}): FC {
  return {
    type: "FeatureCollection",
    features: fires.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      properties: {
        id: f.id,
        name: f.name,
        acres: f.acres,
        r: Math.min(16, 4 + Math.log10(Math.max(10, f.acres)) * 2.4),
        color: containColor(f.contained, colors),
        contain: containKey(f.contained),
      },
    })),
  };
}

/** Burn perimeters of active fires of 100 acres or more. */
export async function perimeters(): Promise<FC> {
  const where =
    "attr_IncidentTypeCategory='WF' AND (attr_PercentContained<100 OR attr_PercentContained IS NULL) AND poly_GISAcres>=100";
  const fc = await get<FC>(
    `${WFIGS}/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=poly_IncidentName,poly_GISAcres,attr_PercentContained&returnGeometry=true&maxAllowableOffset=0.002&geometryPrecision=4&outSR=4326&f=geojson`,
    900,
  );
  return fc ?? { type: "FeatureCollection", features: [] };
}

/** SPC fire weather outlook for day 1 or 2: wind/humidity and dry thunderstorms together. */
export async function fireOutlook(
  day: 1 | 2,
  colors: Colors = {},
): Promise<{ geo: FC; valid: string | null; areas: string[] }> {
  const [wind, dry] = await Promise.all(
    ["windrh", "dryt"].map((k) =>
      get<FC>(
        `https://www.spc.noaa.gov/products/fire_wx/day${day}fw_${k}.nolyr.geojson`,
        1800,
      ),
    ),
  );
  const features = [...(wind?.features ?? []), ...(dry?.features ?? [])].filter(
    (f) => FIRE_RISK[String(f.properties?.LABEL)],
  );
  const p = (wind ?? dry)?.features[0]?.properties ?? {};
  const t = (v: unknown) =>
    typeof v === "string"
      ? new Date(v).toLocaleString("en-US", {
          timeZone: "America/Chicago",
          weekday: "short",
          hour: "numeric",
        })
      : null;
  return {
    geo: {
      type: "FeatureCollection",
      features: features.map((f) => {
        const k = String(f.properties?.LABEL);
        return {
          ...f,
          properties: {
            label: FIRE_RISK[k].label,
            key: k,
            color: pick(colors, `fire:${k}`, FIRE_RISK[k].color),
          },
        };
      }),
    },
    valid: p.VALID_ISO ? `${t(p.VALID_ISO)} – ${t(p.EXPIRE_ISO)} CT` : null,
    areas: [
      ...new Set(
        features.map((f) => FIRE_RISK[String(f.properties?.LABEL)].label),
      ),
    ],
  };
}

/** Red Flag Warnings and Fire Weather Watches at a place. */
export async function fireAlertsAt(lat: number, lon: number) {
  const j = await get<{ features?: { properties: Record<string, unknown> }[] }>(
    `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
    300,
  );
  return (j?.features ?? [])
    .map((f) => f.properties)
    .filter((p) =>
      /red flag|fire weather|fire warning|extreme fire/i.test(
        String(p.event ?? ""),
      ),
    )
    .map((p) => ({
      event: String(p.event),
      ends: (p.ends ?? p.expires ?? null) as string | null,
    }));
}
