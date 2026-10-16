import "server-only";
import type { FeatureCollection, Geometry } from "geojson";
import { pick, type Colors } from "@/lib/colors/pick";
import { ERO_COLORS } from "@/lib/map/products";
import { ERO_LEVELS } from "./levels";

/**
 * Flooding Outlook: WPC's five-day Excessive Rainfall Outlook (the flood counterpart of
 * SPC's severe outlook), and NWS flood alerts, tested at one place.
 */
const V = "https://mapservices.weather.noaa.gov/vector/rest/services";
const ERO = (day: number) =>
  `${V}/hazards/wpc_precip_hazards/MapServer/${day - 1}`;
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

export type EroDay = {
  day: number;
  valid: string | null;
  issued: string | null;
  top: number;
};

/** "01Z 10/14/26 - 12Z 10/14/26" → a readable span in Central time. */
export function eroSpan(start: unknown, end: unknown): string | null {
  const t = (v: unknown) =>
    typeof v === "string" ? new Date(`${v.replace(" ", "T")}Z`) : null;
  const a = t(start);
  const b = t(end);
  if (!a || !b || Number.isNaN(+a) || Number.isNaN(+b)) return null;
  // Built from parts: ICU versions disagree on the comma in "Sat, 7 AM" (CI vs. local).
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "numeric",
  });
  const f = (d: Date) => {
    const p = Object.fromEntries(
      fmt.formatToParts(d).map((x) => [x.type, x.value]),
    );
    return `${p.weekday} ${p.hour} ${p.dayPeriod}`;
  };
  return `${f(a)} – ${f(b)} CT`;
}

const geoQ =
  "where=1%3D1&outFields=dn,outlook,start_time,end_time,issue_time&returnGeometry=true&maxAllowableOffset=0.03&geometryPrecision=3&outSR=4326&f=geojson";

/** One ERO day as colored GeoJSON (for the interactive map). */
export async function eroMap(day: number, colors: Colors = {}): Promise<FC> {
  const fc = await get<FC>(`${ERO(day)}/query?${geoQ}`, 1800);
  return {
    type: "FeatureCollection",
    features: (fc?.features ?? [])
      .filter((f) => Number(f.properties?.dn) >= 1)
      .sort((a, b) => Number(a.properties?.dn) - Number(b.properties?.dn))
      .map((f) => {
        const dn = Number(f.properties?.dn);
        return {
          ...f,
          properties: {
            dn,
            label: ERO_LEVELS[dn - 1]?.label ?? "Risk",
            odds: ERO_LEVELS[dn - 1]?.odds ?? "",
            color: pick(
              colors,
              `ero:${dn - 1}`,
              ERO_COLORS[dn - 1]?.color ?? "#888888",
            ),
          },
        };
      }),
  };
}

/** The five days at a glance: valid window, issue time and the highest level anywhere. */
export async function eroDays(): Promise<EroDay[]> {
  return Promise.all(
    [1, 2, 3, 4, 5].map(async (day) => {
      const j = await get<{
        features?: { attributes: Record<string, unknown> }[];
      }>(
        `${ERO(day)}/query?where=1%3D1&outFields=dn,start_time,end_time,issue_time&returnGeometry=false&f=json`,
        1800,
      );
      const a = j?.features ?? [];
      return {
        day,
        valid: eroSpan(a[0]?.attributes.start_time, a[0]?.attributes.end_time),
        issued:
          typeof a[0]?.attributes.issue_time === "string"
            ? `${a[0].attributes.issue_time}`
            : null,
        top: Math.max(0, ...a.map((f) => Number(f.attributes.dn) || 0)),
      };
    }),
  );
}

export type FloodHere = {
  /** ERO level at the place, days 1–5 (0 = none). */
  ero: number[];
  alerts: {
    event: string;
    headline: string;
    ends: string | null;
    severity: string;
  }[];
};


export async function floodHere(lat: number, lon: number): Promise<FloodHere> {
  const pt = `geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=false&f=json`;
  type Attrs = { features?: { attributes: Record<string, unknown> }[] };
  const [ero, alerts] = await Promise.all([
    Promise.all(
      [1, 2, 3, 4, 5].map((d) =>
        get<Attrs>(`${ERO(d)}/query?${pt}&outFields=dn`, 1800),
      ),
    ),
    get<{ features?: { properties: Record<string, unknown> }[] }>(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      300,
    ),
  ]);
  return {
    ero: ero.map((j) =>
      Math.max(
        0,
        ...(j?.features ?? []).map((f) => Number(f.attributes.dn) || 0),
      ),
    ),
    alerts: (alerts?.features ?? [])
      .map((f) => f.properties)
      .filter((p) => /flood/i.test(String(p.event ?? "")))
      .map((p) => ({
        event: String(p.event),
        headline: String(p.headline ?? ""),
        ends: (p.ends ?? p.expires ?? null) as string | null,
        severity: String(p.severity ?? ""),
      })),
  };
}
