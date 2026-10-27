import {
  analogAreas,
  analogScore,
  dayReports,
  type Analog,
} from "@/lib/analogs/analogs";
import { ANALOG_BANDS } from "@/lib/engines/colors";
import { isLive } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * GET ?d=1|2: today's or tomorrow's matched days, their chances and the analogs' outlook map.
 * GET ?a=YYYY-MM-DD: one matched day's storm reports.
 */
export async function GET(req: Request) {
  if (!isLive((await getSiteDefaults()).extras, "analog"))
    return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const one = q.get("a");
  if (one) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(one) ||
      one >= new Date().toISOString().slice(0, 10)
    )
      return new Response("Bad request", { status: 400 });
    const r = await dayReports(one);
    if (!r) return new Response("Not found", { status: 404 });
    return Response.json(
      { day: one, reports: r.slice(0, 3000) },
      { headers: { "Cache-Control": "public, s-maxage=2592000, immutable" } },
    );
  }
  const today = Math.floor(Date.now() / 86400_000) * 86400_000;
  const day = new Date(today + (q.get("d") === "2" ? 86400_000 : 0))
    .toISOString()
    .slice(0, 10);
  try {
    const [{ data }, score] = await Promise.all([
      supabaseAdmin()
        .from("analog_days")
        .select("day, made_at, cycle, p10, p25, p50, torn, analogs")
        .eq("day", day)
        .maybeSingle(),
      analogScore().catch(() => null),
    ]);
    if (!data)
      return Response.json(
        { day, ready: false, score },
        { headers: { "Cache-Control": "public, s-maxage=300" } },
      );
    const map = await analogAreas(
      data.analogs as Analog[],
      ANALOG_BANDS.map((b) => b.min),
    );
    return Response.json(
      { ...data, ready: true, areas: map.areas, used: map.used, score },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 502 },
    );
  }
}
