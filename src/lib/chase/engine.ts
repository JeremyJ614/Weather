import "server-only";
import { inside, spcFeatures } from "@/lib/colors/spc-server";
import { stp, swti } from "@/lib/ingredients/calc";
import {
  lowLayer,
  shear06,
  srh,
  stormMotion,
  uv,
  type Profile,
} from "@/lib/sswxcon/kinematics";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deskNotes, type Desk } from "./desk";
import {
  CAT_CODES,
  CAT_NAMES,
  bust,
  chaseScore,
  stormMode,
  type Bust,
  type Hour,
  type Mode,
  type Spc,
} from "./score";

/**
 * The Storm Chasing engine. Once a day it reads SPC's Day 1 outlook, scans a 1° grid of
 * points inside the risk areas (or, on a quiet day, the Plains towns chasers watch),
 * scores every afternoon hour at each from Open-Meteo, picks the two best targets at least
 * 250 km apart, and saves the day in `chase_days`. Everyone reads the same row.
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const QUIET: [number, number][] = [
  [35.47, -97.52],
  [36.15, -95.99],
  [37.69, -97.34],
  [39.05, -95.69],
  [38.84, -99.33],
  [40.81, -96.7],
  [41.26, -95.93],
  [43.55, -96.73],
  [44.37, -100.35],
  [46.81, -100.78],
  [32.78, -96.8],
  [33.58, -101.85],
  [35.22, -101.83],
  [31.76, -106.44],
  [39.74, -104.99],
  [41.14, -104.82],
  [42.87, -97.4],
  [41.59, -93.62],
  [38.63, -90.2],
  [36.17, -86.78],
  [34.73, -92.33],
  [32.3, -90.18],
  [33.52, -86.8],
  [30.45, -91.19],
  [40.12, -88.24],
  [39.77, -86.16],
  [43.07, -89.4],
  [44.98, -93.27],
  [37.22, -93.29],
  [34.6, -98.4],
];

export type Target = {
  rank: number;
  lat: number;
  lon: number;
  place: string;
  score: number;
  spc: Spc;
  peak: string;
  sunset: string | null;
  hoursToSunset: number;
  hour: Hour;
  mode: Mode;
  bust: Bust;
  why: string[];
};
export type ChaseDay = {
  day: string;
  generated: string;
  quiet: boolean;
  spcTop: number;
  candidates: number;
  targets: Target[];
  /** The forecast desk's notes (Gemini), when they could be written. */
  desk?: Desk;
  /** Rebuilt later from SPC's archived outlook and archived model runs. */
  backfill?: boolean;
};

const km = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
export const chaseDay = (d = new Date()) =>
  d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

async function place(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      {
        headers: UA,
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      },
    );
    const p = (await r.json()) as {
      properties?: {
        relativeLocation?: { properties?: { city: string; state: string } };
      };
    };
    const rel = p.properties?.relativeLocation?.properties;
    if (rel) return `near ${rel.city}, ${rel.state}`;
  } catch {}
  return `${lat.toFixed(1)}°N ${Math.abs(lon).toFixed(1)}°W`;
}

function why(t: Omit<Target, "why" | "place" | "rank">): string[] {
  const h = t.hour;
  const out: string[] = [];
  if (t.spc.cat >= 2)
    out.push(
      `Inside SPC's ${CAT_NAMES[t.spc.cat].toLowerCase()} risk${t.spc.torn ? ` with a ${t.spc.torn}% tornado chance` : ""}.`,
    );
  out.push(
    `${h.cape.toLocaleString("en-US")} J/kg of instability with ${h.shear} kt of deep shear${h.srh >= 150 ? ` and ${h.srh} m²/s² of helicity` : ""}.`,
  );
  if (h.stp >= 0.5) out.push(`Significant tornado parameter near ${h.stp}.`);
  out.push(
    `Best around ${new Date(t.peak).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "America/Chicago" })} CT, ${t.hoursToSunset >= 1 ? `${Math.round(t.hoursToSunset)} hours before sunset` : "close to sunset"}.`,
  );
  return out;
}

/** SPC's Day 1 outlook for a past day: the 1630Z issue, or the nearest one archived. */
async function archived(day: string, k: string) {
  const ymd = day.replaceAll("-", "");
  for (const z of ["1630", "1300", "2000"]) {
    const f = await spcFeatures(
      `outlook/archive/${day.slice(0, 4)}/day1otlk_${ymd}_${z}_${k}`,
    ).catch(() => null);
    if (f) return f;
  }
  return [];
}

/**
 * Runs the scan and returns the day (does not save). With `day` it rebuilds a past day
 * from SPC's archive and Open-Meteo's archived model runs, on fewer points and only the
 * fields the score needs (the free API's daily allowance).
 */
export async function runChase(
  now = new Date(),
  past?: string,
): Promise<ChaseDay> {
  const [cat, torn, hail, wind] = await Promise.all(
    ["cat", "torn", "hail", "wind"].map((k) =>
      past
        ? archived(past, k)
        : spcFeatures(`outlook/day1otlk_${k}`).catch(() => []),
    ),
  );
  const at = (
    feats: typeof cat,
    lat: number,
    lon: number,
    value: (label: string) => number,
  ) => {
    let v = 0;
    for (const f of feats) {
      const x = value(String(f.properties.LABEL ?? ""));
      if (x > v && inside(f.geometry, lon, lat)) v = x;
    }
    return v;
  };
  const pct = (l: string) =>
    /^0?\.\d+$/.test(l)
      ? Math.round(Number(l) * 100)
      : /^\d+$/.test(l)
        ? Number(l)
        : 0;
  const spcAt = (lat: number, lon: number): Spc => ({
    cat: at(cat, lat, lon, (l) => Math.max(0, CAT_CODES.indexOf(l))),
    torn: at(torn, lat, lon, pct),
    hail: at(hail, lat, lon, pct),
    wind: at(wind, lat, lon, pct),
  });

  let points: { lat: number; lon: number; spc: Spc }[] = [];
  for (let lat = 25; lat <= 49; lat++)
    for (let lon = -124; lon <= -67; lon++) {
      const s = spcAt(lat, lon);
      if (s.cat >= 2) points.push({ lat, lon, spc: s });
    }
  const quiet = points.length < 4;
  if (quiet)
    points = QUIET.map(([lat, lon]) => ({ lat, lon, spc: spcAt(lat, lon) }));
  points = points
    .sort((a, b) => b.spc.cat - a.spc.cat || b.spc.torn - a.spc.torn)
    .slice(0, past ? 16 : 60);

  const levels = ["10m", "925hPa", "850hPa", "700hPa", "500hPa"];
  const vars = [
    "cape",
    "convective_inhibition",
    "lifted_index",
    "temperature_2m",
    "dew_point_2m",
    "precipitation_probability",
    "cloud_cover_low",
    "freezing_level_height",
    ...levels.flatMap((l) => [`wind_speed_${l}`, `wind_direction_${l}`]),
    ...(past
      ? []
      : [
          "relative_humidity_700hPa",
          "vertical_velocity_700hPa",
          "relative_humidity_850hPa",
          "relative_humidity_500hPa",
          "temperature_850hPa",
          "temperature_700hPa",
          "temperature_500hPa",
          "geopotential_height_850hPa",
          "geopotential_height_700hPa",
          "geopotential_height_500hPa",
          "surface_pressure",
          "boundary_layer_height",
        ]),
  ];
  const today = past ?? chaseDay(now);
  const r = await fetch(
    `https://${past ? "historical-forecast-api" : "api"}.open-meteo.com/v1/forecast?latitude=${points.map((p) => p.lat).join(",")}&longitude=${points.map((p) => p.lon).join(",")}&hourly=${vars.join(",")}&daily=sunset&wind_speed_unit=ms&${past ? `start_date=${past}&end_date=${past}` : "forecast_days=2"}&timezone=auto`,
    { signal: AbortSignal.timeout(30000), cache: "no-store" },
  );
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const raw = (await r.json()) as unknown;
  const list = (Array.isArray(raw) ? raw : [raw]) as {
    hourly: Record<string, (number | null)[]> & { time: string[] };
    daily: { time: string[]; sunset: string[] };
    utc_offset_seconds: number;
    elevation?: number;
  }[];

  const scored = points.flatMap((p, i) => {
    const o = list[i];
    if (!o?.hourly) return [];
    const h = o.hourly;
    const v = (k: string, j: number) => Number(h[k]?.[j] ?? 0) || 0;
    /** A field this run may not carry: undefined rather than a made-up 0. */
    const opt = (k: string, j: number, f = (x: number) => Math.round(x)) =>
      h[k]?.[j] == null ? undefined : f(Number(h[k][j]));
    const elev = o.elevation ?? 0;
    const day = o.daily.time.find((d) => d === today) ?? o.daily.time[0];
    const sunsetLocal = o.daily.sunset[o.daily.time.indexOf(day)];
    const toUtc = (local: string) =>
      new Date(
        Date.parse(`${local}:00Z`) - o.utc_offset_seconds * 1000,
      ).toISOString();
    const best = h.time
      .map((t, j) => ({ t, j, hr: Number(t.slice(11, 13)) }))
      .filter((x) => x.t.startsWith(day) && x.hr >= 13 && x.hr <= 21)
      .map(({ t, j }) => {
        const w = (l: string): [number, number] => [
          v(`wind_speed_${l}`, j),
          v(`wind_direction_${l}`, j),
        ];
        const prof: Profile = {
          w10: w("10m"),
          w925: w("925hPa"),
          w850: w("850hPa"),
          w700: w("700hPa"),
          w500: w("500hPa"),
        };
        const cape = v("cape", j);
        const li = v("lifted_index", j);
        const dewC = v("dew_point_2m", j);
        const s = srh(prof);
        const sh = shear06(prof);
        const low = lowLayer(prof, elev > 600);
        const [mu, mv] = stormMotion([
          uv(...prof.w500),
          uv(...prof.w850),
          uv(...prof.w925),
        ]);
        const hour: Hour = {
          time: toUtc(t),
          cape: Math.round(cape),
          cin: -Math.round(v("convective_inhibition", j)) || 0,
          li: Math.round(li * 10) / 10,
          temp: Math.round(v("temperature_2m", j) * 1.8 + 32),
          dew: Math.round(dewC * 1.8 + 32),
          shear: Math.round(sh),
          srh: Math.round(s),
          stp: stp(cape, s, sh, li),
          swti: swti({ cape, srh: s, shear: sh, li, dew: dewC }).score,
          pop: v("precipitation_probability", j),
          lowCloud: v("cloud_cover_low", j),
          motionMph: Math.round(Math.hypot(mu, mv) * 1.15078),
          motionTo: Math.round(
            ((Math.atan2(mu, mv) * 180) / Math.PI + 360) % 360,
          ),
          freezingFt: Math.round(v("freezing_level_height", j) * 3.281),
          rh700: opt("relative_humidity_700hPa", j),
          w700: opt(
            "vertical_velocity_700hPa",
            j,
            (x) => Math.round(x * 1000) / 1000,
          ),
          ...(past
            ? {}
            : {
                t850: opt(
                  "temperature_850hPa",
                  j,
                  (x) => Math.round(x * 10) / 10,
                ),
                t700: opt(
                  "temperature_700hPa",
                  j,
                  (x) => Math.round(x * 10) / 10,
                ),
                t500: opt(
                  "temperature_500hPa",
                  j,
                  (x) => Math.round(x * 10) / 10,
                ),
                z850: opt("geopotential_height_850hPa", j),
                z700: opt("geopotential_height_700hPa", j),
                z500: opt("geopotential_height_500hPa", j),
                rh850: opt("relative_humidity_850hPa", j),
                rh500: opt("relative_humidity_500hPa", j),
                pres: opt("surface_pressure", j),
                pbl: opt("boundary_layer_height", j),
                elev: Math.round(elev),
                shear01: Math.round(low.shear),
                srh01: Math.round(low.srh),
              }),
        };
        const hoursToSunset = sunsetLocal
          ? (Date.parse(`${sunsetLocal}:00Z`) - Date.parse(`${t}:00Z`)) /
            3600000
          : 0;
        return {
          hour,
          hoursToSunset,
          score: chaseScore(hour, p.spc, hoursToSunset),
          sunset: sunsetLocal ? toUtc(sunsetLocal) : null,
        };
      })
      .sort((a, b) => b.score - a.score)[0];
    return best ? [{ ...p, ...best }] : [];
  });
  scored.sort((a, b) => b.score - a.score);
  const picks = scored.slice(0, 1);
  const second = scored.find((x) => picks[0] && km(x, picks[0]) > 250);
  if (second) picks.push(second);

  const targets = await Promise.all(
    picks.map(async (x, i) => {
      const base = {
        lat: x.lat,
        lon: x.lon,
        score: x.score,
        spc: x.spc,
        peak: x.hour.time,
        sunset: x.sunset,
        hoursToSunset: Math.round(x.hoursToSunset * 10) / 10,
        hour: x.hour,
        mode: stormMode(x.hour),
        bust: bust(x.hour, x.spc),
      };
      return {
        rank: i + 1,
        place: await place(x.lat, x.lon),
        ...base,
        why: why(base),
      };
    }),
  );
  return {
    day: today,
    generated: now.toISOString(),
    ...(past ? { backfill: true } : {}),
    quiet,
    spcTop: Math.max(0, ...points.map((p) => p.spc.cat)),
    candidates: scored.length,
    targets,
  };
}

/** Runs the scan and saves it as today's row (service role). */
export async function saveChase(): Promise<ChaseDay> {
  const d = await runChase();
  d.desk = await deskNotes(d).catch(() => undefined);
  return save(d);
}

/**
 * Fills this year's missing days (newest first), a few per call, so the Yearly tab covers
 * the whole season rather than starting the day the page went live. Stops at the first
 * failure (usually the model archive's daily allowance) and picks up on the next call.
 */
export async function backfillChase(max = 3) {
  const today = chaseDay();
  const { data, error } = await supabaseAdmin()
    .from("chase_days")
    .select("day")
    .gte("day", `${today.slice(0, 4)}-01-01`);
  if (error) throw new Error(error.message);
  const have = new Set((data ?? []).map((r) => r.day as string));
  const missing: string[] = [];
  for (
    const d = new Date(`${today.slice(0, 4)}-01-01T12:00:00Z`);
    d.toISOString().slice(0, 10) < today;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    if (!have.has(d.toISOString().slice(0, 10)))
      missing.push(d.toISOString().slice(0, 10));
  const done: [string, number][] = [];
  for (const day of missing.reverse().slice(0, max)) {
    const d = await save(await runChase(new Date(), day));
    done.push([day, d.targets[0]?.score ?? 0]);
  }
  return { done, left: missing.length - done.length };
}

async function save(d: ChaseDay): Promise<ChaseDay> {
  const top = d.targets[0];
  const { error } = await supabaseAdmin()
    .from("chase_days")
    .upsert({
      day: d.day,
      generated_at: d.generated,
      top_score: top?.score ?? 0,
      spc_cat: CAT_CODES[d.spcTop] || null,
      tornado_pct: top?.spc.torn ?? 0,
      place: top?.place ?? null,
      data: d,
    });
  if (error) throw new Error(error.message);
  return d;
}
