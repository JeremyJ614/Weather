import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { glowAt, tuned } from "./fields";
import { glowFactors, glowScore } from "./outdoor";

/**
 * Fills a member's report with the engine's inputs and score at that place and time, so it
 * can be checked against the engine and used to tune its weights (lib/engines/tune.ts).
 */
export async function fillReport(
  id: number,
  kind: string,
  lat: number,
  lon: number,
  at: number,
  detail: string,
) {
  let inputs: unknown = null;
  let score: number | null = null;
  try {
    if (kind === "sunset") {
      const x = await glowAt(lat, lon, at);
      if (x) {
        inputs = x;
        score = glowScore(glowFactors(x), await tuned("sunset"));
      }
    } else {
      const m = await import("./places");
      const r = await m.placeInputs(kind, lat, lon, at, detail);
      if (r) ({ inputs, score } = r);
    }
  } catch (e) {
    console.error("report inputs", kind, e);
  }
  if (inputs == null) return;
  await supabaseAdmin()
    .from("outdoor_reports")
    .update({ inputs, score })
    .eq("id", id);
}

/** Members' reports for an engine over `days`, and how the engine scored those places. */
export async function reportSummary(kind: string, days = 60) {
  const { data } = await supabaseAdmin()
    .from("outdoor_reports")
    .select("rating, score")
    .eq("kind", kind)
    .gt("at", new Date(Date.now() - days * 86400_000).toISOString())
    .limit(5000);
  const rows = data ?? [];
  const bands = [0, 20, 40, 60, 80];
  const by = bands.map((lo, i) => {
    const hi = bands[i + 1] ?? 101;
    const r = rows.filter(
      (x) =>
        x.score != null && x.score >= lo && x.score < hi && x.rating != null,
    );
    return {
      from: lo,
      n: r.length,
      avg: r.length
        ? Math.round((r.reduce((a, x) => a + x.rating!, 0) / r.length) * 10) /
          10
        : null,
    };
  });
  return { days, total: rows.length, by };
}
