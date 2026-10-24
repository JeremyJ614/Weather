import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  SPECIES,
  deerScore,
  fishScore,
  fitWeights,
  glowFactors,
  glowScore,
  type DeerHour,
  type FishHour,
  type GlowInputs,
} from "./outdoor";

/**
 * Daily (from the engine-verify job): refits how much each part of the outdoor engines counts
 * from members' reports with their inputs filled in. Sunset stars 1–5, deer seen (8 or more
 * counts as the most) and fish caught (6 or more), each against the engine's score there.
 */
const MODELS = {
  sunset: {
    keys: ["canvas", "under", "horizon", "smoke", "haze", "rain"],
    y: (n: number) => (2 * n - 1) / 10,
    score: (x: Record<string, unknown>, w: Record<string, number>) =>
      glowScore(glowFactors(x as unknown as GlowInputs), w),
  },
  deer: {
    keys: ["light", "cold", "front", "wind", "rain"],
    y: (n: number) => Math.min(1, n / 8),
    score: (x: Record<string, unknown>, w: Record<string, number>) =>
      deerScore(x as unknown as DeerHour, Number(x.rut) || 1, w),
  },
  fish: {
    keys: ["light", "moon", "pressure", "wind", "sky", "water"],
    y: (n: number) => Math.min(1, n / 6),
    score: (x: Record<string, unknown>, w: Record<string, number>) =>
      fishScore(
        x as unknown as FishHour,
        SPECIES.find((s) => s.id === x.species) ?? SPECIES[0],
        w,
      ),
  },
} as const;

export async function tuneWeights() {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 365 * 86400_000).toISOString();
  const out: Record<string, Record<string, number>> = {};
  for (const [kind, m] of Object.entries(MODELS)) {
    const { data } = await db
      .from("outdoor_reports")
      .select("rating, inputs")
      .eq("kind", kind)
      .not("inputs", "is", null)
      .not("rating", "is", null)
      .gt("at", since)
      .limit(5000);
    const rows = (data ?? []).map((r) => ({
      f: r.inputs as Record<string, number>,
      y: m.y(r.rating as number),
    }));
    if (rows.length >= 10) out[kind] = fitWeights(rows, m.score, [...m.keys]);
  }
  if (Object.keys(out).length) {
    const { data } = await db
      .from("app_config")
      .select("value")
      .eq("key", "engine_weights")
      .maybeSingle();
    await db
      .from("app_config")
      .update({
        value: { ...((data?.value as object) ?? {}), ...out },
        updated_at: new Date().toISOString(),
      })
      .eq("key", "engine_weights");
  }
  return out;
}
