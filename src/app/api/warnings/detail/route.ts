import { warningText } from "@/lib/warnings/feed";

/** GET /api/warnings/detail?id=urn:oid:… → the alert's full text. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^urn:oid:[\d.]+$/.test(id))
    return Response.json({ error: "Unknown alert" }, { status: 400 });
  try {
    return Response.json(await warningText(id), {
      headers: { "Cache-Control": "public, s-maxage=300" },
    });
  } catch {
    return Response.json(
      { error: "That alert couldn't be loaded." },
      { status: 502 },
    );
  }
}
