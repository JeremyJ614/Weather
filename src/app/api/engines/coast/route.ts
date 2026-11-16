import { coastalExample, coastalNow } from "@/lib/tropical/coastal";

export const maxDuration = 60;

/** Coastal Impact (Extras engine): surge odds and wind arrival for storms threatening the U.S. */
export async function GET(req: Request) {
  const example = new URL(req.url).searchParams.get("example") === "1";
  try {
    const data = example ? await coastalExample() : await coastalNow();
    return Response.json(data, {
      headers: {
        "Cache-Control": example
          ? "public, s-maxage=604800, stale-while-revalidate=86400"
          : "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return Response.json(
      { error: "NHC isn't answering right now." },
      { status: 502 },
    );
  }
}
