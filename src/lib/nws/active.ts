import "server-only";
import type { Geometry } from "@/lib/map/geo";

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };

export type NwsFeature = {
  id: string;
  geometry: Geometry | null;
  properties: {
    id: string;
    event: string;
    headline?: string | null;
    areaDesc?: string;
    severity?: string;
    urgency?: string;
    messageType?: string;
    sent?: string;
    expires?: string;
    ends?: string | null;
    senderName?: string;
    description?: string | null;
    parameters?: Record<string, string[] | undefined>;
    geocode?: { UGC?: string[] };
  };
};

let memo: { at: number; p: Promise<NwsFeature[]> } | null = null;

/**
 * Every active, actual NWS alert in the country (no page cap), shared for a
 * minute across SSWXCon and Warnings so one request serves both.
 */
export function activeAlerts(): Promise<NwsFeature[]> {
  if (memo && Date.now() - memo.at < 60_000) return memo.p;
  const p = fetch(
    "https://api.weather.gov/alerts/active?status=actual&message_type=alert,update",
    {
      headers: { ...UA, Accept: "application/geo+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    },
  ).then(async (r) => {
    if (!r.ok) throw new Error(`NWS alerts ${r.status}`);
    const { features } = (await r.json()) as { features: NwsFeature[] };
    // The feed can carry one alert twice (an update beside its original).
    const seen = new Set<string>();
    return features.filter((f) => {
      const id = f.properties.id;
      if (!id || seen.has(id) || f.properties.messageType === "Cancel")
        return false;
      seen.add(id);
      return true;
    });
  });
  memo = { at: Date.now(), p };
  p.catch(() => (memo = null));
  return p;
}

/** Alerts in effect at one point (for "near you" and calm mode). */
export async function alertsAt(lat: number, lon: number): Promise<string[]> {
  const r = await fetch(
    `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}&status=actual`,
    {
      headers: { ...UA, Accept: "application/geo+json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!r.ok) throw new Error(`NWS point alerts ${r.status}`);
  const { features } = (await r.json()) as { features: NwsFeature[] };
  return features.map((f) => f.properties.id);
}
