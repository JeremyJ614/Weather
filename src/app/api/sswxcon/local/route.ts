import { localPoints, shear06, srh } from "@/lib/sswxcon/kinematics";
import { LIMITS, limited } from "@/lib/ratelimit";
import { meteoFetch } from "@/lib/meteo/fetch";

const LEVELS = ["10m", "925hPa", "850hPa", "700hPa", "500hPa"] as const;

/** GET /api/sswxcon/local?lat=&lon= → this hour's CAPE, SRH, shear and LI for one place. */
export async function GET(request: Request) {
  const slow = limited(request, "sswxcon/local", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90)
    return Response.json(
      { error: "lat and lon are required" },
      { status: 400 },
    );
  const vars = [
    "cape",
    "lifted_index",
    ...LEVELS.flatMap((l) => [`wind_speed_${l}`, `wind_direction_${l}`]),
  ];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&hourly=${vars.join(",")}&wind_speed_unit=ms&forecast_hours=3&timezone=UTC`;
  try {
    const r = await meteoFetch(url, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(String(r.status));
    const h = (await r.json()).hourly as Record<string, (number | null)[]>;
    const v = (k: string) => Number(h[k]?.[0] ?? 0) || 0;
    const w = (l: string): [number, number] => [
      v(`wind_speed_${l}`),
      v(`wind_direction_${l}`),
    ];
    const profile = {
      w10: w("10m"),
      w925: w("925hPa"),
      w850: w("850hPa"),
      w700: w("700hPa"),
      w500: w("500hPa"),
    };
    const cape = v("cape");
    const li = v("lifted_index");
    const s = srh(profile);
    const sh = shear06(profile);
    return Response.json(
      {
        cape: Math.round(cape),
        srh: Math.round(s),
        shear: Math.round(sh),
        li: Math.round(li * 10) / 10,
        points: localPoints(cape, s, sh, li),
      },
      { headers: { "Cache-Control": "public, s-maxage=900" } },
    );
  } catch {
    return Response.json(
      { error: "The model feed isn't answering right now." },
      { status: 502 },
    );
  }
}
