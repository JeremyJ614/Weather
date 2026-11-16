import { probSevere } from "@/lib/engines/probsevere";
import { surges } from "@/lib/engines/surge";
import { rainbowNow } from "@/lib/engines/rainbow";
import { storedOutdoor } from "@/lib/engines/outmap";
import { unpackAreas } from "@/lib/engines/pack";
import {
  BOUND_POINTS,
  FIELD_BANDS,
  pyroBin,
  type FieldId,
} from "@/lib/engines/colors";
import { fieldPreview } from "@/lib/engines/fields";
import type { Areas } from "@/lib/engines/areas";
import { geoPath } from "@/lib/map/geo";

export const maxDuration = 60;
import { bandOf, loadBlind, pixelAt } from "@/lib/engines/blindspot";
import { LIMITS, limited } from "@/lib/ratelimit";

/** An engine's band areas as key-carrying paths for the color editor's live preview. */
const polys = (a: Areas | null | undefined, id: string) =>
  (a?.features ?? [])
    .map((f) => ({
      k: `engine:${id}:${f.properties.band}`,
      d: geoPath(f.geometry, 0.6),
    }))
    .filter((p) => p.d);

/** Previews for admin → Map & data colors: today's engine areas, fires or grid. */
export async function GET(req: Request) {
  const slow = limited(req, "engines/preview", LIMITS.heavy);
  if (slow) return slow;
  const e = new URL(req.url).searchParams.get("e");
  if (e === "pyrocb") {
    const r = await fieldPreview("pyro").catch(() => null);
    return Response.json({
      dots: (r?.fires ?? []).map((f) => ({
        lat: f.lat,
        lon: f.lon,
        key: `engine:pyrocb:${pyroBin(f.chance)}`,
      })),
    });
  }
  if (e === "prob") {
    const r = await fieldPreview("stp").catch(() => null);
    return Response.json({ polys: polys(r?.alt, "prob") });
  }
  if (e === "rainbow") {
    const d = await rainbowNow().catch(() => null);
    return Response.json({ polys: polys(d?.maps[0], "rainbow") });
  }
  if (e === "outmap") {
    const d = await storedOutdoor("deer").catch(() => null);
    return Response.json({
      polys: polys(unpackAreas(d?.map.days[0]?.areas), "outmap"),
    });
  }
  if (e === "boundpt") {
    const r = await fieldPreview("bound").catch(() => null);
    return Response.json({
      dots: (r?.points ?? []).map((p) => ({
        lat: p.lat,
        lon: p.lon,
        key: `engine:boundpt:${Math.max(
          0,
          BOUND_POINTS.findLastIndex((b) => p.score >= b.min),
        )}`,
      })),
    });
  }
  if (e === "firstT") {
    const r = await fieldPreview("first").catch(() => null);
    return Response.json({ polys: polys(r?.alt, "firstT") });
  }
  if (e && e in FIELD_BANDS) {
    const r = await fieldPreview(e as FieldId).catch(() => null);
    return Response.json({ polys: polys(r?.areas, e) });
  }
  if (e === "blind") {
    const grid = await loadBlind(new URL(req.url).origin);
    const dots = [];
    for (let lat = grid.bounds[1] + 0.25; lat < grid.bounds[3]; lat += 0.5)
      for (let lon = grid.bounds[0] + 0.25; lon < grid.bounds[2]; lon += 0.5) {
        const k = pixelAt(grid, lat, lon);
        dots.push({
          lat,
          lon,
          key: `engine:blind:${k < 0 ? 0 : bandOf(grid, grid.h1[k])}`,
        });
      }
    return Response.json({ dots });
  }
  if (e === "surge") {
    const d = await surges().catch(() => null);
    return Response.json({
      polys: (d?.polys.features ?? []).map((f) => ({
        k: `engine:surge:${f.properties?.band}`,
        d: geoPath(f.geometry as never, 0.6),
      })),
    });
  }
  try {
    const d = await probSevere();
    return Response.json({
      polys: e === "tor" ? polys(d.torAreas, "tor") : [],
    });
  } catch {
    return Response.json({ polys: [] });
  }
}
