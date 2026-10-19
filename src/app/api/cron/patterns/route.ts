import { PERIODS, buildPeriod, store, syncLedger } from "@/lib/patterns/data";
import { buildSeason } from "@/lib/patterns/season";
import { cronAuthorized } from "@/lib/ops/cron-auth";

export const maxDuration = 60;

/**
 * Twice a day after SPC finalizes its reports (pg_cron jobs "patterns-ledger" and
 * "patterns-recaps"): `part=ledger` refreshes the daily report ledger, then each period and
 * the season are built in their own call and stored, so the page opens already loaded.
 */
export async function GET(request: Request) {
  if (!(await cronAuthorized(request)))
    return new Response("Unauthorized", { status: 401 });
  const part = new URL(request.url).searchParams.get("part") ?? "";
  try {
    if (part === "ledger") return Response.json(await syncLedger());
    if (part === "season") {
      const s = await buildSeason();
      await store("season", s);
      return Response.json({ season: s.tiles.length });
    }
    const p = PERIODS.find((x) => x.id === part);
    if (!p) return Response.json({ error: "Unknown part" }, { status: 400 });
    const v = await buildPeriod(p.id);
    await store(p.id, v);
    return Response.json({ [p.id]: v.days, summary: !!v.summary });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
