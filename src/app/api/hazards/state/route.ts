import { stateDrought } from "@/lib/hazards/data";

/** GET /api/hazards/state?st=OH → that state's Drought Monitor categories for 26 weeks, newest first. */
export async function GET(req: Request) {
  const st = (new URL(req.url).searchParams.get("st") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(st))
    return Response.json({ error: "Pick a state." }, { status: 400 });
  return Response.json(
    { state: st, weeks: await stateDrought(st, 26) },
    {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600",
      },
    },
  );
}
