import { probSevere } from "@/lib/engines/probsevere";
import { pyroBin, rotBin, type FieldId } from "@/lib/engines/colors";
import { fieldPreview } from "@/lib/engines/fields";
import { rotationTracks } from "@/lib/engines/rotation";
import type { Areas } from "@/lib/engines/areas";
import { geoPath } from "@/lib/map/geo";
import { project } from "@/lib/map/usAlbers";

export const maxDuration = 60;
import radars from "@/lib/engines/radars.json";

/** An engine's band areas as key-carrying paths for the color editor's live preview. */
const polys = (a: Areas | null | undefined, id: string) =>
  (a?.features ?? [])
    .map((f) => ({
      k: `engine:${id}:${f.properties.band}`,
      d: geoPath(f.geometry, 0.6),
    }))
    .filter((p) => p.d);

/** Previews for admin → Map & data colors: today's engine areas, tracks, fires or grid. */
export async function GET(req: Request) {
  const e = new URL(req.url).searchParams.get("e");
  if (e === "rot") {
    const r = await rotationTracks(360).catch(() => null);
    // Each ~2 km cell as a small square, one path per band: MRMS's rotation-track look.
    const band = new Map<number, string[]>();
    for (const c of r?.cells ?? []) {
      const a = project(c.lon - 0.01, c.lat + 0.01);
      const b = project(c.lon + 0.01, c.lat - 0.01);
      const k = rotBin(c.v);
      band.set(k, [
        ...(band.get(k) ?? []),
        `M${a.x.toFixed(2)} ${a.y.toFixed(2)}H${b.x.toFixed(2)}V${b.y.toFixed(2)}H${a.x.toFixed(2)}Z`,
      ]);
    }
    return Response.json({
      polys: [...band.entries()]
        .sort((x, y) => x[0] - y[0])
        .map(([k, d]) => ({ k: `engine:rot:${k}`, d: d.join("") })),
    });
  }
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
  if (e && ["llj", "snsq", "nst", "pyro", "tctor"].includes(e)) {
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
  try {
    const d = await probSevere();
    return Response.json({
      polys:
        e === "tor" ? polys(d.torAreas, "tor") : polys(d.hailAreas, "hail"),
    });
  } catch {
    return Response.json({ polys: [] });
  }
}
