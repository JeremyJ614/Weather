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
import radars from "@/lib/engines/radars.json";
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
    const buf = new Uint8Array(
      await (
        await fetch(new URL("/extras/blindspot.bin", req.url))
      ).arrayBuffer(),
    );
    const { width, height, bounds } = radars;
    const grid = new Uint8Array(width * height);
    for (let i = 0, k = 0; i < buf.length; i += 2)
      grid.fill(buf[i], k, (k += buf[i + 1]));
    const [W, S, E, N] = bounds;
    const merc = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const dots = [];
    for (let lat = S + 0.25; lat < N; lat += 0.5)
      for (let lon = W + 0.25; lon < E; lon += 0.5) {
        const x = Math.floor(((lon - W) / (E - W)) * width);
        const y = Math.floor(
          ((merc(N) - merc(lat)) / (merc(N) - merc(S))) * height,
        );
        dots.push({ lat, lon, key: `engine:blind:${grid[y * width + x]}` });
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
