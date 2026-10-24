import { after } from "next/server";
import type { FieldId } from "@/lib/engines/colors";
import { storedField } from "@/lib/engines/stored";
import { stateOf } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";

export const maxDuration = 60;

const IDS: FieldId[] = [
  "llj",
  "snsq",
  "nst",
  "pyro",
  "tctor",
  "stp",
  "scp",
  "dcp",
  "ltg",
];

/**
 * GET ?e=llj|snsq|nst|pyro|tctor|stp|scp|dcp|ltg: one model-driven engine's map and list,
 * served from storage (lib/engines/stored.ts) and held at the edge for 5 minutes.
 */
export async function GET(req: Request) {
  const e = new URL(req.url).searchParams.get("e") as FieldId;
  if (!IDS.includes(e)) return new Response("Bad request", { status: 400 });
  // Switched off or hidden in admin → Extras: nothing is computed for it.
  if (stateOf((await getSiteDefaults()).extras, e) !== "on")
    return new Response("Not found", { status: 404 });
  try {
    const { map, later } = await storedField(e);
    if (later) after(later);
    return Response.json(map, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 502 },
    );
  }
}
