import { recon } from "@/lib/tropical/recon";

/** GET /api/tropical/recon → Hurricane Hunter missions from the last 30 hours. */
export async function GET() {
  try {
    return Response.json(
      { missions: await recon(), at: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=900",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "NHC's recon feed isn't answering right now." },
      { status: 502 },
    );
  }
}
