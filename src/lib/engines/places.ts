import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { nearestPlace, parsePlaces } from "@/lib/geo/search";
import {
  compassPoint,
  moonPosition,
  moonTimes,
  sunTimes,
} from "@/lib/sky/astro";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { latticeAreas, soften, type Areas } from "./areas";
import { OUTDOOR_BANDS } from "./colors";
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

/**
 * Deer Activity and Fishing Bite (Extras engines), from Open-Meteo's hourly forecast with the
 * past week for comparison: a regional map (Ohio and its neighbors) of each place's best hour
 * in the next day, and a 3-day readout for any one place.
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
/** The region the maps cover: Ohio and the states around it. */
export const REGION = { W: -86, E: -79, S: 37.5, N: 42.5, step: 0.5 };
let places: ReturnType<typeof parsePlaces> | null = null;

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
  const { data } = await supabaseAdmin()
    .from("app_config")
    .select("value")
    .eq("key", "deer_seasons")
    .maybeSingle();
  const v = (data?.value ?? {}) as Partial<DeerConfig>;
  return {
    state: v.state ?? "Ohio",
    seasons: Array.isArray(v.seasons) ? v.seasons : [],
    rut: { ...RUT, ...(v.rut ?? {}) },
  };
}

/** Moon overhead and underfoot (major periods) and rise and set (minor) around a time. */
function solunar(lat: number, lon: number, day: Date) {
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
export async function placeMap(kind: "deer" | "fish", sp: SpeciesId = "bass") {
  const { W, E, S, N, step } = REGION;
  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = N; lat >= S - 1e-9; lat -= step)
    for (let lon = W; lon <= E + 1e-9; lon += step) {
      lats.push(lat);
      lons.push(lon);
    }
  const [data, w, cfg] = await Promise.all([
    hourly(lats, lons, 3600),
    tuned(kind),
    kind === "deer" ? deerConfig() : null,
  ]);
  const cw = Math.round((E - W) / step) + 1;
  const ch = Math.round((N - S) / step) + 1;
  const best = new Float32Array(cw * ch);
  const when = new Float64Array(cw * ch);
  const species = speciesOf(sp);
  data.forEach((h, k) => {
    for (const r of rows(h, lats[k], lons[k], 24)) {
      const v =
        kind === "deer"
          ? deerScore(r.deer, rutBoost(new Date(r.t), cfg!.rut), w)
          : fishScore(r.fish, species, w);
      if (v > best[k]) {
        best[k] = v;
        when[k] = r.t;
      }
    }
  });
  // Up to a 0.1° lattice for smooth areas.
  const fine = 0.1;
  const fw = Math.round((E - W) / fine) + 1;
  const fh = Math.round((N - S) / fine) + 1;
  const v = new Float32Array(fw * fh);
  for (let j = 0; j < fh; j++)
    for (let i = 0; i < fw; i++) {
      const y = (j * fine) / step;
      const x = (i * fine) / step;
      const y0 = Math.min(ch - 2, Math.floor(y));
      const x0 = Math.min(cw - 2, Math.floor(x));
      const ty = y - y0;
      const tx = x - x0;
      const at = (a: number, b: number) => best[b * cw + a];
      v[j * fw + i] =
        at(x0, y0) * (1 - tx) * (1 - ty) +
        at(x0 + 1, y0) * tx * (1 - ty) +
        at(x0, y0 + 1) * (1 - tx) * ty +
        at(x0 + 1, y0 + 1) * tx * ty;
    }
  const bands = OUTDOOR_BANDS[kind];
  places ??= parsePlaces(PLACES);
  const rowsP = places;
  const order = [...best.keys()].sort((a, b) => best[b] - best[a]);
  const spots: {
    lat: number;
    lon: number;
    value: number;
    place: string;
    note: string;
    at: number;
  }[] = [];
  for (const k of order) {
    if (best[k] < bands.levels[1] || spots.length >= 6) break;
    if (spots.some((p) => Math.hypot(p.lat - lats[k], p.lon - lons[k]) < 1.2))
      continue;
    const near = nearestPlace(rowsP, lats[k], lons[k], 300);
    if (!near || near.miles > 30) continue;
    spots.push({
      lat: lats[k],
      lon: lons[k],
      value: Math.round(best[k]),
      place: `${near.miles < 5 ? "" : `${Math.round(near.miles)} mi from `}${near.hit.name}, ${near.hit.st}`,
      note: "",
      at: when[k],
    });
  }
  return {
    at: new Date().toISOString(),
    bounds: [W, S, E, N],
    areas: latticeAreas(
      soften(v, fw, fh, 1),
      fw,
      fh,
      W,
      N,
      fine,
      bands.levels,
    ) as Areas,
    spots,
  };
}

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
  const [[h], w, cfg, water] = await Promise.all([
    hourly([lat], [lon], 1800),
    tuned(kind),
    kind === "deer" ? deerConfig() : null,
    kind === "fish" ? gaugeWater(lat, lon) : null,
  ]);
  const species = speciesOf(sp);
  const list = rows(h, lat, lon, 72).map((r) => {
    if (water) r.fish.water = water.f;
    return {
      r,
      v:
        kind === "deer"
          ? deerScore(r.deer, rutBoost(new Date(r.t), cfg!.rut), w)
          : fishScore(r.fish, species, w),
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
    extra.rut = rutBoost(new Date(), cfg!.rut);
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
          from: `${water.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} (${water.miles} mi)`,
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
    const rut = rutBoost(new Date(at), cfg!.rut);
    return { inputs: { ...r.deer, rut }, score: deerScore(r.deer, rut, w) };
  }
  const sp =
    SPECIES.find((s) => s.name === detail || s.id === detail) ?? SPECIES[0];
  return {
    inputs: { ...r.fish, species: sp.id },
    score: fishScore(r.fish, sp, w),
  };
}
