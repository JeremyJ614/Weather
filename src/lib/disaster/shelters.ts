import "server-only";

/**
 * Storm shelters for the Disaster Response map: FEMA's ESF#6 Shelter System (the national
 * shelter registry the Red Cross and states keep), read straight from FEMA's public map
 * service. Layer 0 is every shelter open right now; layer 1 is every registered facility
 * that is not open. Nothing is stored here: each area is fetched on demand and cached.
 */
const NSS =
  "https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/FeatureServer";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const FIELDS = [
  "shelter_id",
  "shelter_name",
  "address_1",
  "city",
  "state",
  "zip",
  "facility_usage_code",
  "evacuation_capacity",
  "post_impact_capacity",
  "ada_compliant",
  "wheelchair_accessible",
  "pet_accommodations_code",
  "generator_onsite",
  "in_100_yr_floodplain",
  "in_surge_slosh_area",
  "org_organization_name",
  "total_population",
].join(",");

/** One shelter, with short keys: the map loads a few hundred at a time. */
export type Shelter = {
  id: string;
  name: string;
  addr: string;
  lat: number;
  lon: number;
  /** Open right now (FEMA's open-shelter layer). */
  open: boolean;
  /** "EVAC" (before a storm), "POST" (after), "BOTH". */
  use: string;
  evac: number;
  post: number;
  /** People staying there now, for an open shelter. */
  now: number | null;
  ada: boolean;
  pets: boolean;
  power: boolean;
  /** In the 100-year flood plain or a storm-surge zone. */
  flood: boolean;
  org: string;
};

type Row = {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number };
};

const yes = (v: unknown) => /^(y|yes|true|1)$/i.test(String(v ?? "").trim());
const text = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
const n = (v: unknown) =>
  Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
/** FEMA's names come in every case; "NORTH PARK CHURCH" reads better as title case. */
const tidy = (s: string) =>
  s === s.toUpperCase()
    ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : s;

function shape(r: Row, open: boolean): Shelter | null {
  const a = r.attributes;
  const lat = r.geometry?.y;
  const lon = r.geometry?.x;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const city = tidy(text(a.city));
  return {
    id: text(a.shelter_id) || `${lat},${lon}`,
    name: tidy(text(a.shelter_name)) || "Shelter",
    addr: [
      tidy(text(a.address_1)),
      [city, text(a.state)].filter(Boolean).join(", "),
      text(a.zip),
    ]
      .filter(Boolean)
      .join(" · "),
    lat: Math.round(lat! * 1e5) / 1e5,
    lon: Math.round(lon! * 1e5) / 1e5,
    open,
    use: text(a.facility_usage_code).toUpperCase() || "BOTH",
    evac: n(a.evacuation_capacity),
    post: n(a.post_impact_capacity),
    now: open ? n(a.total_population) : null,
    ada: yes(a.ada_compliant) || yes(a.wheelchair_accessible),
    pets: yes(a.pet_accommodations_code),
    power: yes(a.generator_onsite),
    flood: yes(a.in_100_yr_floodplain) || yes(a.in_surge_slosh_area),
    org: tidy(text(a.org_organization_name)),
  };
}

async function query(
  layer: 0 | 1,
  where: string,
  bbox: number[] | null,
  revalidate: number,
) {
  const q = new URLSearchParams({
    where,
    outFields: FIELDS,
    outSR: "4326",
    returnGeometry: "true",
    resultRecordCount: "2000",
    f: "json",
  });
  if (bbox) {
    q.set("geometry", bbox.join(","));
    q.set("geometryType", "esriGeometryEnvelope");
    q.set("inSR", "4326");
    q.set("spatialRel", "esriSpatialRelIntersects");
  }
  const r = await fetch(`${NSS}/${layer}/query?${q}`, {
    headers: UA,
    next: { revalidate },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`FEMA ${r.status}`);
  const j = (await r.json()) as { features?: Row[]; error?: unknown };
  if (j.error) throw new Error("FEMA query refused");
  return j.features ?? [];
}

/** Every shelter open right now, nationwide (a handful most days, hundreds after a disaster). */
export async function openShelters(): Promise<Shelter[]> {
  const rows = await query(0, "1=1", null, 600);
  return rows.flatMap((r) => shape(r, true) ?? []);
}

/** Registered shelters inside a box [west, south, east, north], at most 2,000. */
export async function sheltersIn(bbox: number[]): Promise<Shelter[]> {
  const rows = await query(1, "1=1", bbox, 86400);
  return rows.flatMap((r) => shape(r, false) ?? []);
}

/** A box the map may ask for: on whole degrees, no wider than 8° × 5°, inside the US. */
export function cleanBox(raw: string | null): number[] | null {
  const v = (raw ?? "").split(",").map(Number);
  if (v.length !== 4 || v.some((x) => !Number.isFinite(x))) return null;
  const [w, s, e, nn] = [
    Math.floor(v[0]),
    Math.floor(v[1]),
    Math.ceil(v[2]),
    Math.ceil(v[3]),
  ];
  if (e <= w || nn <= s || e - w > 8 || nn - s > 5) return null;
  if (w < -180 || e > -60 || s < 15 || nn > 72) return null;
  return [w, s, e, nn];
}
