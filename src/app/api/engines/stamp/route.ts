import type { FieldId } from "@/lib/engines/colors";
import { FIELD_BANDS } from "@/lib/engines/colors";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET ?e=<engine id>: which model run a field engine's stored map is from, so an open page can
 * light its refresh key when a newer one is stored (Fix list 2026-10-30 #1). One tiny row,
 * held at the edge for a minute.
 */
export async function GET(req: Request) {
  const e = new URL(req.url).searchParams.get("e") as FieldId;
  if (!(e in FIELD_BANDS)) return new Response("Bad request", { status: 400 });
  const { data } = await supabaseAdmin()
    .from("engine_maps")
    .select("cycle")
    .eq("id", e)
    .maybeSingle();
  return Response.json(
    { cycle: (data as { cycle?: string } | null)?.cycle ?? null },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
