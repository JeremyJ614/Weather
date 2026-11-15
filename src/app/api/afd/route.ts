import { getLatestAfd } from "@/lib/afd/fetch";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/afd?office=OUN → the latest Area Forecast Discussion: verbatim text plus sections. */
export async function GET(request: Request) {
  const slow = limited(request, "afd", LIMITS.normal);
  if (slow) return slow;
  const office = (
    new URL(request.url).searchParams.get("office") ?? ""
  ).toUpperCase();
  if (!/^[A-Z]{3}$/.test(office))
    return Response.json({ error: "office is required" }, { status: 400 });
  const afd = await getLatestAfd(office);
  if (!afd)
    return Response.json(
      {
        error:
          "No forecast discussion is available from this office right now.",
      },
      { status: 502 },
    );
  return Response.json(afd, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
    },
  });
}
