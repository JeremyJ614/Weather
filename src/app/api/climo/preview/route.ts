import { tornadoSummary } from "@/lib/climo/server";
import { CLIMO_RAMP } from "@/lib/climo/style";

/** GET /api/climo/preview → the tornado density grid as ramp-colored dots for admin colors. */
export function GET() {
  const g = tornadoSummary().grid;
  const max = Math.max(1, ...g.all);
  const dots: { lat: number; lon: number; key: string }[] = [];
  for (let i = 0; i < g.h; i += 2)
    for (let j = 0; j < g.w; j += 2) {
      const v = g.all[i * g.w + j];
      if (!v) continue;
      const k = Math.min(4, Math.floor(Math.sqrt(v / max) * 5));
      dots.push({
        lat: g.lat0 + (i + 0.5) * g.step,
        lon: g.lon0 + (j + 0.5) * g.step,
        key: `climo:${CLIMO_RAMP[k].key}`,
      });
    }
  return Response.json(
    { dots },
    { headers: { "Cache-Control": "public, s-maxage=86400" } },
  );
}
