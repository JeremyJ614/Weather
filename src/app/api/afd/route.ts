import { getLatestAfd } from "@/lib/afd/fetch";

/** GET /api/afd?office=OUN → the latest Area Forecast Discussion, in sections. */
export async function GET(request: Request) {
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
  const { text: _text, ...rest } = afd;
  void _text;
  return Response.json(rest, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
    },
  });
}
