import { aiView } from "@/lib/tropical/atcf";
import { loadDecks } from "@/lib/tropical/decks";
import { LIMITS, limited } from "@/lib/ratelimit";

/** GET /api/tropical/ai?storm=ep202026 → Google DeepMind's runs beside NHC's forecast. */
export async function GET(req: Request) {
  const slow = limited(req, "tropical/ai", LIMITS.normal);
  if (slow) return slow;
  const id = String(
    new URL(req.url).searchParams.get("storm") ?? "",
  ).toLowerCase();
  if (!/^(al|ep|cp)\d{6}$/.test(id))
    return Response.json({ error: "Pick a storm." }, { status: 400 });
  try {
    const { rows, best } = await loadDecks(id);
    return Response.json(
      {
        ...aiView(rows, best),
        best: [...best.values()]
          .sort((a, b) => a.dtg.localeCompare(b.dtg))
          .map(({ lat, lon }) => ({ lat, lon })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "NHC's model data isn't answering right now." },
      { status: 502 },
    );
  }
}
