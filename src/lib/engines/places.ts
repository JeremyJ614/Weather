import "server-only";
import {
  compassPoint,
  moonPosition,
  moonTimes,
  sunTimes,
} from "@/lib/sky/astro";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tuned } from "./fields";
import {
  SPECIES,
  deerScore,
  fishScore,
  rutBoost,
  type DeerHour,
  type FishHour,
  type SpeciesId,
} from "./outdoor";
import { rainbowAt } from "./rainbow";
import { riverFlow, waterIndex, waterObs } from "./water";
import { pressureFactor, rutFor } from "./rut";
import { stateAt } from "@/lib/history/states";
import { project } from "@/lib/map/usAlbers";

/** The state a place is in, and its own rut (the owner's state from admin). */
function rutAt(lat: number, lon: number, cfg: DeerConfig) {
  const p = project(lon, lat);
  const st = stateAt(p.x, p.y);
  return { st, rut: rutFor(st, lat, lon, cfg) ?? cfg.rut };
}

/**
 * Deer Activity and Fishing Bite (Extras engines) for one place: a 3-day hour-by-hour readout
 * from Open-Meteo's forecast with the past week for comparison. The national Day 1–3 maps
 * come from the GFS (./outmap).
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const VARS = [
  "temperature_2m",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "precipitation",
  "cloud_cover",
] as const;
type Hourly = Record<(typeof VARS)[number], (number | null)[]> & {
  time: string[];
};

async function hourly(lats: number[], lons: number[], revalidate: number) {
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lats.map((x) => x.toFixed(2)).join(",")}&longitude=${lons.map((x) => x.toFixed(2)).join(",")}&hourly=${VARS.join(",")}&past_days=7&forecast_days=3&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=GMT`,
    { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(30000) },
  );
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const raw = (await r.json()) as unknown;
  return ((Array.isArray(raw) ? raw : [raw]) as { hourly: Hourly }[]).map(
    (x) => x.hourly,
  );
}

type Season = { name: string; start: string; end: string };
type DeerConfig = {
  state: string;
  seasons: Season[];
  rut: { pre: string; peak: string; post: string; end: string };
};
const RUT = { pre: "10-25", peak: "11-05", post: "11-21", end: "12-10" };

export async function deerConfig(): Promise<DeerConfig> {
  // The owner's seasons when they can be read; the usual Ohio rut when they can't.
  let v: Partial<DeerConfig> = {};
  try {
    const { data } = await supabaseAdmin()
      .from("app_config")
      .select("value")
      .eq("key", "deer_seasons")
      .maybeSingle();
    v = (data?.value ?? {}) as Partial<DeerConfig>;
  } catch {}
  return {
    state: v.state ?? "Ohio",
    seasons: Array.isArray(v.seasons) ? v.seasons : [],
    rut: { ...RUT, ...(v.rut ?? {}) },
  };
}

/** Moon overhead and underfoot (major periods) and rise and set (minor) around a time. */
export function solunar(lat: number, lon: number, day: Date) {
  const majors: number[] = [];
  const minors: number[] = [];
  for (const d of [-1, 0, 1, 2, 3]) {
    const base = Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate() + d,
    );
    let hi = { t: base, a: -99 };
    let lo = { t: base, a: 99 };
    for (let m = 0; m < 1440; m += 10) {
      const t = base + m * 60_000;
      const a = moonPosition(new Date(t), lat, lon).altitude;
      if (a > hi.a) hi = { t, a };
      if (a < lo.a) lo = { t, a };
    }
    majors.push(hi.t, lo.t);
    const mt = moonTimes(new Date(base + 12 * 3600_000), lat, lon);
    if (mt.rise) minors.push(mt.rise.getTime());
    if (mt.set) minors.push(mt.set.getTime());
  }
  const near = (list: number[], t: number) =>
    Math.min(...list.map((x) => Math.abs(x - t) / 60_000));
  return { majors, minors, near };
}

type HourRow = {
  t: number;
  deer: DeerHour;
  fish: FishHour;
  windDir: number;
  temp: number;
};

/** Each hour from now for `hours`, with the inputs both engines score. */
function rows(h: Hourly, lat: number, lon: number, hours = 72): HourRow[] {
  const ts = h.time.map((x) => Date.parse(`${x}:00Z`));
  const now = Date.now();
  const first = ts.findIndex((t) => t >= now - 3600_000);
  if (first < 0) return [];
  const past = h.temperature_2m
    .slice(0, first)
    .filter((x): x is number => x != null);
  const week = past.slice(-168);
  const avg = week.length ? week.reduce((a, b) => a + b, 0) / week.length : NaN;
  const moon = solunar(lat, lon, new Date(now));
  const sun = new Map<number, ReturnType<typeof sunTimes>>();
  const out: HourRow[] = [];
  for (let i = first; i < Math.min(ts.length, first + hours); i++) {
    const t = ts[i];
    const day = Math.floor(t / 86400_000);
    if (!sun.has(day))
      sun.set(
        day,
        sunTimes(new Date(day * 86400_000 + 12 * 3600_000), lat, lon),
      );
    const s = sun.get(day)!;
    // Sunrise and sunset nearest this hour (yesterday's or tomorrow's at the edges).
    const rise = s.sunrise?.getTime() ?? t;
    const set = s.sunset?.getTime() ?? t;
    const fromRise = (t - rise) / 3600_000;
    const fromSet = (t - set) / 3600_000;
    const temp = h.temperature_2m[i] ?? NaN;
    const p = h.pressure_msl[i] ?? NaN;
    const p3 = h.pressure_msl[i - 3] ?? p;
    const wind = h.wind_speed_10m[i] ?? 0;
    const rain = h.precipitation[i] ?? 0;
    out.push({
      t,
      temp,
      windDir: h.wind_direction_10m[i] ?? 0,
      deer: {
        fromRise: Math.abs(fromRise) > 12 ? 12 : fromRise,
        fromSet: Math.abs(fromSet) > 12 ? 12 : fromSet,
        colder: Number.isFinite(avg) ? avg - temp : 0,
        dp3: Number.isFinite(p - p3) ? p - p3 : 0,
        windMph: wind,
        rainMm: rain,
      },
      fish: {
        fromRise: Math.abs(fromRise) > 12 ? 12 : fromRise,
        fromSet: Math.abs(fromSet) > 12 ? 12 : fromSet,
        major: moon.near(moon.majors, t),
        minor: moon.near(moon.minors, t),
        dp3: Number.isFinite(p - p3) ? p - p3 : 0,
        windMph: wind,
        cloud: h.cloud_cover[i] ?? 50,
        // Shallow water runs close to the past week's air temperature.
        water: Number.isFinite(avg) ? avg : 60,
      },
    });
  }
  return out;
}

const speciesOf = (id: string) =>
  SPECIES.find((s) => s.id === id) ?? SPECIES[0];

/** The regional map: each place's best hour in the next 24, as SPC-style areas. */
const hhmm = (t: number, tz: string) =>
  new Date(t).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });

/** Water temperature from the nearest USGS gauge that measures it (within ~30 miles), °F. */
async function gaugeWater(lat: number, lon: number) {
  const r = await fetch(
    `https://waterservices.usgs.gov/nwis/iv/?format=json&parameterCd=00010&siteStatus=active&bBox=${(lon - 0.45).toFixed(2)},${(lat - 0.4).toFixed(2)},${(lon + 0.45).toFixed(2)},${(lat + 0.4).toFixed(2)}`,
    {
      headers: UA,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15000),
    },
  ).catch(() => null);
  if (!r?.ok) return null;
  const d = (await r.json()) as {
    value?: {
      timeSeries?: {
        sourceInfo: {
          siteName: string;
          geoLocation: {
            geogLocation: { latitude: number; longitude: number };
          };
        };
        values: { value: { value: string; dateTime: string }[] }[];
      }[];
    };
  };
  let best: { name: string; f: number; d: number } | null = null;
  for (const s of d.value?.timeSeries ?? []) {
    const v = s.values[0]?.value.at(-1);
    const c = Number(v?.value);
    if (!v || !Number.isFinite(c) || c < -5 || c > 40) continue;
    if (Date.now() - Date.parse(v.dateTime) > 6 * 3600_000) continue;
    const g = s.sourceInfo.geoLocation.geogLocation;
    const dd = Math.hypot(
      g.latitude - lat,
      (g.longitude - lon) * Math.cos((lat * Math.PI) / 180),
    );
    if (!best || dd < best.d)
      best = {
        name: s.sourceInfo.siteName,
        f: Math.round(c * 1.8 + 32),
        d: dd,
      };
  }
  return best && { name: best.name, f: best.f, miles: Math.round(best.d * 69) };
}

/** The best two-hour windows in a run of hourly scores (at least 4 hours apart). */
function windows(list: { t: number; v: number }[]) {
  const pairs = list
    .slice(0, -1)
    .map((x, i) => ({ t: x.t, v: (x.v + list[i + 1].v) / 2 }))
    .sort((a, b) => b.v - a.v);
  const out: { t: number; v: number }[] = [];
  for (const p of pairs) {
    if (out.some((o) => Math.abs(o.t - p.t) < 4 * 3600_000)) continue;
    out.push({ t: p.t, v: Math.round(p.v) });
    if (out.length >= 3) break;
  }
  return out.sort((a, b) => a.t - b.t);
}

/** One place's next three days: hourly scores, best windows and what drives them. */
export async function placeDetail(
  kind: "deer" | "fish",
  lat: number,
  lon: number,
  sp: SpeciesId = "bass",
  tz = "America/New_York",
) {
  const fishing = kind === "fish";
  const [[h], w, cfg, gauge, lake, flow] = await Promise.all([
    hourly([lat], [lon], 1800),
    tuned(kind),
    kind === "deer" ? deerConfig() : null,
    fishing ? gaugeWater(lat, lon) : null,
    // Post-launch A6: Great Lakes buoys and the GLSEA satellite analysis where no gauge is near.
    fishing
      ? waterObs()
          .then((o) =>
            waterIndex(o.filter((x) => x.src !== "gauge"))(lat, lon, 25),
          )
          .catch(() => null)
      : null,
    fishing ? riverFlow(lat, lon).catch(() => null) : null,
  ]);
  const water =
    lake && (!gauge || lake.miles < gauge.miles)
      ? {
          f: Math.round(lake.f),
          miles: lake.miles,
          name:
            lake.src === "buoy"
              ? "NOAA Great Lakes buoy"
              : "Great Lakes satellite analysis",
        }
      : gauge;
  const species = speciesOf(sp);
  const here = cfg ? rutAt(lat, lon, cfg) : null;
  const list = rows(h, lat, lon, 72).map((r) => {
    if (water) r.fish.water = water.f;
    return {
      r,
      v:
        kind === "deer"
          ? Math.round(
              deerScore(r.deer, rutBoost(new Date(r.t), here!.rut), w) *
                pressureFactor(here!.st, r.t, cfg!),
            )
          : Math.round(fishScore(r.fish, species, w) * (flow?.factor ?? 1)),
    };
  });
  if (!list.length) throw new Error("No forecast for this place");
  const now = list[0].r;
  const today = sunTimes(new Date(), lat, lon);
  const extra: Record<string, unknown> = {};
  if (kind === "deer") {
    const day = new Date().toISOString().slice(0, 10);
    extra.season =
      cfg!.seasons
        .filter((s) => s.start <= day && day <= s.end)
        .map((s) => s.name) ?? [];
    extra.next =
      cfg!.seasons
        .filter((s) => s.start > day)
        .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
    extra.state = cfg!.state;
    extra.rut = rutBoost(new Date(), here!.rut);
    extra.hunted = pressureFactor(here!.st, Date.now(), cfg!) < 1;
    extra.legal =
      today.sunrise && today.sunset
        ? {
            from: hhmm(today.sunrise.getTime() - 30 * 60_000, tz),
            to: hhmm(today.sunset.getTime() + 30 * 60_000, tz),
          }
        : null;
    // Deer smell you downwind: sit on the downwind side of where they will come from.
    const down = compassPoint((now.windDir + 180) % 360);
    extra.stand = `Wind from the ${compassPoint(now.windDir)} at ${Math.round(now.deer.windMph)} mph: set up on the ${down} (downwind) side of trails and bedding.`;
    extra.colder = Math.round(now.deer.colder);
  } else {
    const p = list.map((x) => x.r.fish.dp3);
    const trend = p[0] <= -0.5 ? "falling" : p[0] >= 0.5 ? "rising" : "steady";
    // A front: the lowest pressure ahead followed by a 2 hPa rise within 6 hours.
    let front: number | null = null;
    for (let i = 3; i < list.length - 6; i++)
      if (list[i].r.fish.dp3 < 0 && list[i + 6].r.fish.dp3 > 0.6) {
        front = list[i].r.t;
        break;
      }
    extra.trend = trend;
    extra.front = front ? hhmm(front, tz) : null;
    extra.frontDay = front
      ? new Date(front).toLocaleDateString("en-US", {
          weekday: "long",
          timeZone: tz,
        })
      : null;
    extra.water = water
      ? {
          f: water.f,
          from: `${water.name
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .replace(/\bNoaa\b/, "NOAA")} (${water.miles} mi)`,
        }
      : {
          f: Math.round(now.fish.water),
          from: "estimated from the past week's air temperatures",
        };
    const moon = solunar(lat, lon, new Date());
    const soon = (list0: number[], half: number) =>
      list0
        .filter((t) => t > Date.now() - half && t < Date.now() + 36 * 3600_000)
        .sort((a, b) => a - b)
        .map((t) => `${hhmm(t - half, tz)}–${hhmm(t + half, tz)}`);
    extra.majors = soon(moon.majors, 60 * 60_000).slice(0, 3);
    extra.minors = soon(moon.minors, 30 * 60_000).slice(0, 3);
    extra.species = species.name;
    extra.flow = flow;
  }
  return {
    at: new Date().toISOString(),
    hours: list.map((x) => ({ t: x.r.t, v: x.v })),
    best: windows(list.map((x) => ({ t: x.r.t, v: x.v }))).map((x) => ({
      day: new Date(x.t).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: tz,
      }),
      from: hhmm(x.t, tz),
      v: x.v,
    })),
    now: list[0].v,
    ...extra,
  };
}

/** A member's report: the engine's inputs and score at that place and time. */
export async function placeInputs(
  kind: string,
  lat: number,
  lon: number,
  at: number,
  detail: string,
): Promise<{ inputs: unknown; score: number } | null> {
  if (kind === "rainbow") {
    const r = await rainbowAt(lat, lon);
    return r ? { inputs: r, score: r.chance } : null;
  }
  if (kind !== "deer" && kind !== "fish") return null;
  const [[h], w, cfg] = await Promise.all([
    hourly([lat], [lon], 1800),
    tuned(kind),
    kind === "deer" ? deerConfig() : null,
  ]);
  const r = rows(h, lat, lon, 4).find((x) => Math.abs(x.t - at) < 3600_000);
  if (!r) return null;
  if (kind === "deer") {
    const here = rutAt(lat, lon, cfg!);
    const rut = rutBoost(new Date(at), here.rut);
    return {
      inputs: { ...r.deer, rut },
      score: Math.round(
        deerScore(r.deer, rut, w) * pressureFactor(here.st, at, cfg!),
      ),
    };
  }
  const sp =
    SPECIES.find((s) => s.name === detail || s.id === detail) ?? SPECIES[0];
  return {
    inputs: { ...r.fish, species: sp.id },
    score: fishScore(r.fish, sp, w),
  };
}
