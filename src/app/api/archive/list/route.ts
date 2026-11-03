import { surveyedCatalog } from "@/lib/archive/list";

/** The Tornado Archive's NWS Surveyed list, loaded when the page opens (kept off the page's HTML). */
export async function GET() {
  return Response.json(await surveyedCatalog(), {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
