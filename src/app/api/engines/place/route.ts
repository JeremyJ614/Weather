import { after } from "next/server";
import {
  computeOutdoorMaps,
  storedOutdoor,
  type OutMap,
} from "@/lib/engines/outmap";
import { placeDetail } from "@/lib/engines/places";
import { SPECIES, type SpeciesId } from "@/lib/engines/outdoor";
import { reportSummary } from "@/lib/engines/reports";
import { isLive } from "@/lib/extras/items";
import { getSiteDefaults } from "@/lib/settings";

export const maxDuration = 60;

/**
 * GET ?e=deer|fish[&sp=<species>]: the lower 48's Day 1–3 outlook (SPC-style areas and the
 * best spots each day). Add &lat=&lon= (and &tz=) for one place's next three days.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const e = q.get("e");
  if (e !== "deer" && e !== "fish")
    return new Response("Bad request", { status: 400 });
  if (!isLive((await getSiteDefaults()).extras, e))
    return new Response("Not found", { status: 404 });
  const sp = (SPECIES.find((s) => s.id === q.get("sp"))?.id ??
    "bass") as SpeciesId;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const tz = q.get("tz") ?? "America/New_York";
  try {
    if (q.has("lat")) {
      if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180))
        return new Response("Bad request", { status: 400 });
      let zone = "America/New_York";
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        zone = tz;
      } catch {}
      return Response.json(await placeDetail(e, lat, lon, sp, zone), {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        },
      });
    }
    const [{ map, later }, reports] = await Promise.all([
      storedOutdoor(e, sp).catch(async () => {
        // Without the table (a fresh deployment's first minutes), compute it outright.
        const maps = await computeOutdoorMaps();
        return {
          map: maps.find(
            (m) => m.kind === e && (e === "deer" || m.species === sp),
          ) as OutMap,
          later: null,
        };
      }),
      reportSummary(e).catch(() => null),
    ]);
    if (later) after(later);
    return Response.json(
      { ...map, reports },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch (err) {
    console.error("engines/place", err);
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "The forecast is unavailable",
      },
      { status: 502 },
    );
  }
}
