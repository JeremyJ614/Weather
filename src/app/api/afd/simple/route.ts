import { getSimplified } from "@/lib/afd/fetch";

/** GET /api/afd/simple?office=OUN → plain-language version (AI), cached per issuance. */
export async function GET(request: Request) {
  const office = (
    new URL(request.url).searchParams.get("office") ?? ""
  ).toUpperCase();
  if (!/^[A-Z]{3}$/.test(office))
    return Response.json({ error: "office is required" }, { status: 400 });
  try {
    const s = await getSimplified(office);
    if (!s)
      return Response.json(
        {
          error:
            "No forecast discussion is available from this office right now.",
        },
        { status: 502 },
      );
    return Response.json(s, {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "The simplified version isn't available right now. The Standard tab has the full discussion.",
      },
      { status: 503 },
    );
  }
}
