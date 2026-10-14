import { battle, latestTracks, rank } from "@/lib/tropical/atcf";
import { loadDecks } from "@/lib/tropical/decks";

/**
 * GET /api/tropical/models?storm=ep202026 → each roster model's newest track, the best
 * track so far and the leaderboard. The a-deck is a few MB, so the result (small) is what
 * gets cached, at the CDN, for 30 minutes.
 */
export async function GET(req: Request) {
  const id = String(
    new URL(req.url).searchParams.get("storm") ?? "",
  ).toLowerCase();
  if (!/^(al|ep|cp)\d{6}$/.test(id))
    return Response.json({ error: "Pick a storm." }, { status: 400 });
  try {
    const { rows, best } = await loadDecks(id);
    const sorted = [...best.values()].sort((x, y) =>
      x.dtg.localeCompare(y.dtg),
    );
    return Response.json(
      {
        storm: id,
        tracks: latestTracks(rows),
        best: sorted.map(({ lat, lon, kt, dtg }) => ({ lat, lon, kt, dtg })),
        board: rank(battle(rows, best)),
        cycles: new Set(rows.filter((r) => r.tech === "OFCL").map((r) => r.dtg))
          .size,
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
