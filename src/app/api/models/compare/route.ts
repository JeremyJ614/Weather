import { COMPARE } from "@/lib/radar/products";
import { LIMITS, limited } from "@/lib/ratelimit";
import { meteoFetch } from "@/lib/meteo/fetch";

/** GET /api/models/compare?lat=&lon= → each model's next 48 hours of temperature and rain. */
export async function GET(req: Request) {
  const slow = limited(req, "models/compare", LIMITS.normal);
  if (slow) return slow;
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!(lat > 15 && lat < 72 && lon > -180 && lon < -60))
    return Response.json({ error: "Pick a US place." }, { status: 400 });
  try {
    const r = await meteoFetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&hourly=temperature_2m,precipitation&models=${COMPARE.map((m) => m.id).join(",")}&forecast_hours=48&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as {
      hourly: Record<string, (number | null)[]> & { time: string[] };
    };
    const models = COMPARE.map((m) => {
      const temp = j.hourly[`temperature_2m_${m.id}`] ?? [];
      const rain = j.hourly[`precipitation_${m.id}`] ?? [];
      const ok = temp.filter((x) => x != null).length;
      return {
        key: m.key,
        label: m.label,
        temp: temp.map((x) => (x == null ? null : Math.round(x))),
        rain:
          Math.round(rain.reduce<number>((a, x) => a + (x ?? 0), 0) * 100) /
          100,
        hours: ok,
      };
    }).filter((m) => m.hours > 6);
    return Response.json(
      { time: j.hourly.time, models },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "The model feed isn't answering right now." },
      { status: 502 },
    );
  }
}
