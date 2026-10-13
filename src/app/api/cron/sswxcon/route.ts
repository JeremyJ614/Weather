import { cronAuthorized } from "@/lib/ops/cron-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nationalScore } from "@/lib/sswxcon/live";

/** Hourly (database scheduler): stores the national score for the trend chart. */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  const n = await nationalScore();
  const at = new Date();
  at.setUTCMinutes(0, 0, 0);
  const { error } = await supabaseAdmin()
    .from("sswxcon_snapshots")
    .upsert({
      at: at.toISOString(),
      total: n.total,
      parts: Object.fromEntries(n.components.map((c) => [c.key, c.score])),
    });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ at, total: n.total });
}
