import { PERIODS, period, type Period } from "@/lib/patterns/data";

export const maxDuration = 60;

/** GET /api/patterns/recap?period=yesterday|week|month|year → SPC report counts and the AI recap. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("period") as Period["id"];
  if (!PERIODS.some((p) => p.id === id))
    return Response.json({ error: "Pick a period." }, { status: 400 });
  try {
    return Response.json(await period(id), {
      headers: {
        "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=21600",
      },
    });
  } catch {
    return Response.json(
      { error: "SPC's storm reports aren't answering right now." },
      { status: 502 },
    );
  }
}
