import { probSevere } from "@/lib/engines/probsevere";
import { pyroBin, rotBin, torBin, type FieldId } from "@/lib/engines/colors";
import { fieldDots } from "@/lib/engines/fields";
import { rotationTracks } from "@/lib/engines/rotation";

export const maxDuration = 60;
import radars from "@/lib/engines/radars.json";

/** Dots for admin → Map & data colors: today's engine storms, or the blind-spot grid sampled. */
export async function GET(req: Request) {
  const e = new URL(req.url).searchParams.get("e");
  if (e === "rot") {
    const r = await rotationTracks(1440).catch(() => null);
    return Response.json({
      dots: (r?.cells ?? []).map((c) => ({
        lat: c.lat,
        lon: c.lon,
        key: `engine:rot:${rotBin(c.v)}`,
      })),
    });
  }
  if (e === "pyrocb") {
    const r = await fieldDots("pyro").catch(() => null);
    return Response.json({
      dots: (r?.fires ?? []).map((f) => ({
        lat: f.lat,
        lon: f.lon,
        key: `engine:pyrocb:${pyroBin(f.chance)}`,
      })),
    });
  }
  if (e && ["llj", "snsq", "nst", "pyro", "tctor"].includes(e))
    return Response.json(
      await fieldDots(e as FieldId).catch(() => ({ dots: [] })),
    );
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
    const dots = d.storms
      .filter((s) => (e === "tor" ? s.p20 >= 3 : s.band > 0 || s.hail >= 15))
      .map((s) => ({
        lat: s.lat,
        lon: s.lon,
        key:
          e === "tor" ? `engine:tor:${torBin(s.p20)}` : `engine:hail:${s.band}`,
      }));
    return Response.json({ dots });
  } catch {
    return Response.json({ dots: [] });
  }
}
