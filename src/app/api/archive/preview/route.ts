import type { ArchiveEvent } from "@/features/replay/archive/types";

/** Dots for admin → Map & data colors: one archive day's warnings and hail. */
export async function GET(req: Request) {
  const e = (await (
    await fetch(new URL("/archive/2024-05-21-greenfield.json", req.url))
  ).json()) as ArchiveEvent;
  const dots = [
    ...(e.warns ?? []).map((w) => ({
      lat: w.ring.reduce((a, p) => a + p[1], 0) / w.ring.length,
      lon: w.ring.reduce((a, p) => a + p[0], 0) / w.ring.length,
      key: `replay:warn:${w.kind}`,
    })),
    ...(e.hail ?? []).map((h) => ({
      lat: h[1],
      lon: h[2],
      key: `replay:hail:${h[3] >= 3 ? "big" : h[3] >= 1.5 ? "mid" : "small"}`,
    })),
  ];
  return Response.json(
    { dots },
    { headers: { "Cache-Control": "public, s-maxage=86400" } },
  );
}
