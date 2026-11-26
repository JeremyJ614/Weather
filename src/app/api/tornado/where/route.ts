import { countyAt, counties } from "@/lib/tornado/db";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/tornado/where?lat=&lon= → the county there, and its state's busiest counties. */
export async function GET(req: Request) {
  const slow = limited(req, "tornado/where", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return Response.json(
      { error: "lat and lon are required" },
      { status: 400 },
    );
  const c = await countyAt(lat, lon);
  if (!c) return Response.json({ county: null });
  const { list } = await counties();
  const busiest = list
    .filter((x) => x.st === c.st && x.fips !== c.fips)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map(({ slug, name, st, n, top }) => ({
      slug,
      label: `${name}, ${st}`,
      n,
      top,
    }));
  return Response.json(
    {
      county: {
        slug: c.slug,
        label: `${c.name}, ${c.st}`,
        st: c.st,
        n: c.n,
        top: c.top,
      },
      busiest,
    },
    { headers: { "Cache-Control": "public, s-maxage=2592000, max-age=86400" } },
  );
}
