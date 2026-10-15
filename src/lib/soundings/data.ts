import "server-only";
import type { Level, Sounding } from "./thermo";
import { MODELS, type ModelId } from "./models";

/**
 * Soundings: weather balloons (the latest 00Z/12Z launches, Iowa Environmental Mesonet's
 * RAOB archive) and model soundings (HRRR, RAP, NAM 3 km, NAM 12 km, GFS) at the BUFKIT
 * site nearest a point, every forecast hour of the newest run.
 */
const IEM = "https://mesonet.agron.iastate.edu";
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };

export { MODELS, type ModelId };

const r1 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;

export type Station = { id: string; name: string; lat: number; lon: number };

/** Latest synoptic time (00/12Z) that has most launches in, as YYYYMMDDHH00. */
function synoptic(now: number, back: number) {
  const d = new Date(now - 90 * 60000); // launches post about 1.5 h after the hour
  d.setUTCHours(d.getUTCHours() >= 12 ? 12 : 0, 0, 0, 0);
  d.setTime(d.getTime() - back * 12 * 3600000);
  return d.toISOString().slice(0, 13).replace(/[-T]/g, "") + "00";
}

type Raw = {
  station: string;
  valid: string;
  profile: Record<string, number | null>[];
};

async function launches(ts: string): Promise<Raw[]> {
  const r = await fetch(`${IEM}/json/raob.py?ts=${ts}`, {
    headers: UA,
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`raob ${r.status}`);
  return ((await r.json()) as { profiles?: Raw[] }).profiles ?? [];
}

async function sites(): Promise<Map<string, Station>> {
  const r = await fetch(`${IEM}/geojson/network/RAOB.geojson`, {
    headers: UA,
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`raob sites ${r.status}`);
  const j = (await r.json()) as {
    features: {
      id: string;
      properties: { sname: string; state?: string };
      geometry: { coordinates: [number, number] };
    }[];
  };
  return new Map(
    j.features.map((f) => [
      f.id,
      {
        id: f.id,
        name: `${f.properties.sname.split(" -- ")[0]}${f.properties.state ? `, ${f.properties.state}` : ""}`,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      },
    ]),
  );
}

/** The newest launch time with at least 20 stations in, and those stations. */
export async function balloons(now = Date.now()) {
  const where = await sites();
  for (let back = 0; back < 3; back++) {
    const ts = synoptic(now, back);
    const list = await launches(ts).catch(() => []);
    if (list.length < 20) continue;
    return {
      ts,
      valid: list[0].valid,
      stations: list
        .map((p) => where.get(p.station))
        .filter((s): s is Station => !!s && s.lat > 10),
    };
  }
  return null;
}

/** One balloon sounding at a launch time. */
export async function balloon(id: string, ts: string) {
  const [list, where] = await Promise.all([launches(ts), sites()]);
  const p = list.find((x) => x.station === id);
  if (!p) return null;
  const levels: Level[] = p.profile
    .filter((l) => l.pres != null && l.hght != null && l.tmpc != null)
    .map((l) => [
      r1(l.pres)!,
      Math.round(l.hght!),
      r1(l.tmpc)!,
      r1(l.dwpc),
      l.drct == null ? null : Math.round(l.drct),
      r1(l.sknt),
    ]);
  return { station: where.get(id) ?? null, valid: p.valid, levels };
}

/** Every forecast hour of the newest run at the BUFKIT site nearest a point. */
export async function modelSoundings(model: ModelId, lat: number, lon: number) {
  const r = await fetch(
    `${IEM}/api/1/nws/bufkit.json?model=${model}&lat=${lat}&lon=${lon}&fall=1`,
    {
      headers: UA,
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (r.status === 404 || r.status === 422) return null;
  if (!r.ok) throw new Error(`bufkit ${r.status}`);
  const j = (await r.json()) as {
    lat: number;
    lon: number;
    source: { station: string; run_time: string };
    profiles: {
      forecast_hour: number;
      time: string;
      levels: Record<string, number | null>[];
    }[];
  };
  const hours: Sounding[] = j.profiles.map((p) => ({
    fh: p.forecast_hour,
    valid: p.time,
    levels: p.levels
      .filter(
        (l) =>
          l.PRES != null && l.PRES >= 100 && l.TMPC != null && l.HGHT != null,
      )
      .map((l) => [
        r1(l.PRES)!,
        Math.round(l.HGHT!),
        r1(l.TMPC)!,
        r1(l.DWPC),
        l.DRCT == null ? null : Math.round(l.DRCT),
        r1(l.SKNT),
      ]),
  }));
  return {
    model,
    station: j.source.station,
    lat: j.lat,
    lon: j.lon,
    run: j.source.run_time,
    hours,
  };
}
