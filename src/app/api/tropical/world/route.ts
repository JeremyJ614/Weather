import { JTWC, parseTcw, warningCodes } from "@/lib/tropical/jtwc";

/**
 * GET /api/tropical/world → every JTWC warning in force outside NHC's basins (West
 * Pacific, North Indian Ocean, Southern Hemisphere). Cached for 15 minutes.
 */
export async function GET() {
  try {
    const rss = await fetch(`${JTWC}/rss/jtwc.rss`, {
      next: { revalidate: 900 },
    });
    if (!rss.ok) throw new Error(String(rss.status));
    const codes = warningCodes(await rss.text());
    const storms = (
      await Promise.all(
        codes.map(async (code) => {
          const r = await fetch(`${JTWC}/products/${code}.tcw`, {
            next: { revalidate: 900 },
          }).catch(() => null);
          return r?.ok ? parseTcw(await r.text(), code) : null;
        }),
      )
    ).filter((s) => s !== null);
    return Response.json(
      { storms, updated: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "The Joint Typhoon Warning Center isn't answering right now." },
      { status: 502 },
    );
  }
}
