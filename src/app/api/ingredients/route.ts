import { shear06, srh } from "@/lib/sswxcon/kinematics";
import { stp, swti } from "@/lib/ingredients/calc";

const LEVELS = ["10m", "925hPa", "850hPa", "700hPa", "500hPa"] as const;
const MODELS = [
  ["gfs_seamless", "GFS"],
  ["ecmwf_ifs025", "ECMWF"],
  ["icon_seamless", "ICON"],
  ["gem_seamless", "GEM"],
] as const;

type Hourly = Record<string, (number | null)[]> & { time: string[] };

/** Open-Meteo times out now and then under load; one retry rides that out. */
async function getJson(
  url: string,
  tries = 2,
): Promise<Record<string, unknown>> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, {
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch (e) {
      if (i + 1 >= tries) throw e;
    }
  }
}

/**
 * GET /api/ingredients?lat=&lon= → the next 72 hours of storm ingredients at
 * one place (CAPE, shear, SRH, LI, dew point, STP, SWTI), plus each major
 * model's CAPE for this hour. Open-Meteo, cached 30 minutes.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90)
    return Response.json(
      { error: "lat and lon are required" },
      { status: 400 },
    );
  const at = `latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}`;
  const vars = [
    "cape",
    "lifted_index",
    "dew_point_2m",
    "precipitation_probability",
    ...LEVELS.flatMap((l) => [`wind_speed_${l}`, `wind_direction_${l}`]),
  ];
  try {
    const [main, models] = await Promise.all([
      getJson(
        `https://api.open-meteo.com/v1/forecast?${at}&hourly=${vars.join(",")}&wind_speed_unit=ms&forecast_hours=72&timezone=auto`,
      ),
      getJson(
        `https://api.open-meteo.com/v1/forecast?${at}&hourly=cape&models=${MODELS.map((m) => m[0]).join(",")}&forecast_hours=1&timezone=auto`,
        1,
      ).catch(() => null),
    ]);
    const h = main.hourly as Hourly;
    const v = (k: string, j: number) => Number(h[k]?.[j] ?? 0) || 0;
    const hours = h.time.map((time, j) => {
      const w = (l: string): [number, number] => [
        v(`wind_speed_${l}`, j),
        v(`wind_direction_${l}`, j),
      ];
      const p = {
        w10: w("10m"),
        w925: w("925hPa"),
        w850: w("850hPa"),
        w700: w("700hPa"),
        w500: w("500hPa"),
      };
      const cape = v("cape", j);
      const li = v("lifted_index", j);
      const dew = v("dew_point_2m", j);
      const s = srh(p);
      const sh = shear06(p);
      const t = swti({ cape, srh: s, shear: sh, li, dew });
      return {
        time,
        cape: Math.round(cape),
        li: Math.round(li * 10) / 10,
        dew: Math.round(dew * 10) / 10,
        srh: Math.round(s),
        shear: Math.round(sh),
        stp: stp(cape, s, sh, li),
        swti: t.score,
        pop: v("precipitation_probability", j),
        tornado: t.tornado,
        hail: t.hail,
        wind: t.wind,
      };
    });
    const mh = (models?.hourly ?? {}) as Record<string, (number | null)[]>;
    const modelCape = MODELS.map(([k, name]) => ({
      name,
      cape: mh[`cape_${k}`]?.[0] ?? null,
    })).filter(
      (m): m is { name: (typeof MODELS)[number][1]; cape: number } =>
        m.cape !== null,
    );
    return Response.json(
      { tz: String(main.timezone ?? ""), hours, models: modelCape },
      { headers: { "Cache-Control": "public, s-maxage=1800" } },
    );
  } catch {
    return Response.json(
      { error: "The model feed isn't answering right now." },
      { status: 502 },
    );
  }
}
