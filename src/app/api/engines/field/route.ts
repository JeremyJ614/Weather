import { after } from "next/server";
import type { FieldId } from "@/lib/engines/colors";
import { storedField } from "@/lib/engines/stored";
import { engineStats } from "@/lib/engines/verify";
import { reportSummary } from "@/lib/engines/reports";
import { isLive } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";
import { LIMITS, limited } from "@/lib/ratelimit";

export const maxDuration = 60;

const IDS: FieldId[] = [
  "llj",
  "nst",
  "pyro",
  "tctor",
  "stp",
  "scp",
  "dcp",
  "ltg",
  "rwrap",
  "blizz",
  "first",
  "sunset",
  "bound",
];
// Engines that flag places and show their own hit rate.
const CHECKED = new Set<FieldId>([
  "blizz",
  "first",
  "bound",
  "stp",
  "scp",
  "dcp",
  "nst",
  "tctor",
]);

/**
 * GET ?e=<engine id>: one model-driven engine's map and list,
 * served from storage (lib/engines/stored.ts) and held at the edge for 5 minutes. `v` (a
 * refresh key press) skips the server's own copy and reads the stored map.
 */
export async function GET(req: Request) {
  const slow = limited(req, "engines/field", LIMITS.heavy);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const e = q.get("e") as FieldId;
  if (!IDS.includes(e)) return new Response("Bad request", { status: 400 });
  // Switched off or hidden in admin → Extras: nothing is computed for it.
  if (!isLive((await getSiteDefaults()).extras, e))
    return new Response("Not found", { status: 404 });
  try {
    const [{ map, later }, stats, reports] = await Promise.all([
      storedField(e, q.has("v")),
      CHECKED.has(e) ? engineStats(e).catch(() => null) : null,
      e === "sunset" ? reportSummary(e).catch(() => null) : null,
    ]);
    if (later) after(later);
    return Response.json(
      { ...map, stats, reports },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 502 },
    );
  }
}
