import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pick } from "@/lib/colors/pick";
import { getColors } from "@/lib/colors/server";
import { activeAlerts } from "@/lib/nws/active";
import {
  BANDS,
  bandFor,
  computeScore,
  describe,
  type Alert,
  type SpcRisk,
} from "./score";

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const ORDER = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];

/** Every active alert, reduced to what the score reads. */
async function alerts(): Promise<Alert[]> {
  return (await activeAlerts()).map(({ properties: p }) => {
    const one = (k: string) => p.parameters?.[k]?.[0];
    return {
      event: p.event,
      params: {
        tornadoDetection: one("tornadoDetection"),
        tornadoDamageThreat: one("tornadoDamageThreat"),
        thunderstormDamageThreat: one("thunderstormDamageThreat"),
        flashFloodDamageThreat: one("flashFloodDamageThreat"),
      },
      pds: /PARTICULARLY DANGEROUS SITUATION/i.test(p.description ?? ""),
    };
  });
}

/** The highest category on SPC's current Day 1 outlook. */
async function spcMax(): Promise<SpcRisk> {
  const r = await fetch(
    "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
    {
      headers: UA,
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw new Error(`SPC ${r.status}`);
  const d = (await r.json()) as {
    features: { properties: { LABEL?: string } }[];
  };
  const best = d.features
    .map((f) => ORDER.indexOf(String(f.properties.LABEL)))
    .reduce((a, b) => Math.max(a, b), -1);
  return (best >= 0 ? ORDER[best] : null) as SpcRisk;
}

/** The national score right now, with what drives it. */
export async function nationalScore() {
  let spcOk = true;
  const [list, spc] = await Promise.all([
    alerts(),
    spcMax().catch(() => {
      spcOk = false;
      return null;
    }),
  ]);
  const r = computeScore(list, spc);
  const colors = await getColors();
  const bands = BANDS.map((b, i) => ({
    ...b,
    color: pick(colors, `sswx:band:${i}`, b.color),
  }));
  const components = r.components.map((c) => ({
    ...c,
    color: pick(colors, `sswx:part:${c.key}`, c.color),
  }));
  return {
    at: new Date().toISOString(),
    total: r.total,
    band: bands[BANDS.indexOf(bandFor(r.total))],
    bands,
    drivers: describe(r.components, r.total),
    components,
    alertCount: list.length,
    spc,
    spcOk,
  };
}

export type National = Awaited<ReturnType<typeof nationalScore>>;

/** The last 48 hourly snapshots, oldest first. */
export async function recentSnaps(
  sb: SupabaseClient,
): Promise<{ at: string; total: number }[]> {
  const since = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const { data } = await sb
    .from("sswxcon_snapshots")
    .select("at, total")
    .gte("at", since)
    .order("at");
  return data ?? [];
}
