import { warningText } from "@/lib/warnings/feed";
import { isAlertId } from "@/lib/warnings/style";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/warnings/detail?id=urn:oid:… → the alert's full text. */
export async function GET(request: Request) {
  const slow = limited(request, "warnings/detail", LIMITS.normal);
  if (slow) return slow;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isAlertId(id))
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
