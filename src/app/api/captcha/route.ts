import { issueChallenge } from "@/lib/auth/captcha";

/** GET /api/captcha → a fresh signed puzzle for the signup human check. */
export async function GET() {
  try {
    return Response.json(issueChallenge(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "The human check isn't set up on this server." },
      { status: 503 },
    );
  }
}
