import { LIMITS, limited } from "@/lib/ratelimit";
/** GET /api/aurora/image?pole=north|south → SWPC's latest OVATION oval image, as a download. */
export async function GET(req: Request) {
  const slow = limited(req, "aurora/image", LIMITS.frames);
  if (slow) return slow;
  const pole =
    new URL(req.url).searchParams.get("pole") === "south" ? "south" : "north";
  const r = await fetch(
    `https://services.swpc.noaa.gov/images/animations/ovation/${pole}/latest.jpg`,
    {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(20000),
    },
  ).catch(() => null);
  if (!r?.ok) return new Response(null, { status: 502 });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return new Response(r.body, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="sswx-aurora-${pole}-${stamp}.jpg"`,
      "Cache-Control": "public, s-maxage=300",
    },
  });
}
