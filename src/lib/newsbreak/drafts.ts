import "server-only";
import { PLACES } from "@/lib/geo/places.data";
import { parsePlaces } from "@/lib/geo/search";
import { SITE } from "@/lib/seo/site";

/**
 * NewsBreak Creator Program (post-launch A10, B9): original local posts drafted from live data
 * for the owner to post as a NewsBreak creator. A storm-day explainer whenever SPC has a Slight
 * risk or higher, naming the biggest towns inside it, and a short forecast for each of those
 * towns from the National Weather Service. Every post ends with a link back to the app.
 */
const UA = {
  "User-Agent": "StormSync Weather (https://weather.sswx.space)",
  Accept: "application/geo+json",
};
type Poly = number[][][];
type Feature = {
  properties: { LABEL?: string; LABEL2?: string };
  geometry: { type: string; coordinates: Poly | Poly[] };
};

export type Draft = {
  kind: "explainer" | "town";
  title: string;
  body: string;
  town?: string;
};

const ORDER = ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];
const NAME: Record<string, string> = {
  SLGT: "Slight Risk (level 2 of 5)",
  ENH: "Enhanced Risk (level 3 of 5)",
  MDT: "Moderate Risk (level 4 of 5)",
  HIGH: "High Risk (level 5 of 5)",
};

function inRing(x: number, y: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
function inFeature(f: Feature, lon: number, lat: number) {
  const polys = (
    f.geometry.type === "Polygon"
      ? [f.geometry.coordinates]
      : f.geometry.coordinates
  ) as Poly[];
  return polys.some(
    (p) =>
      inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h)),
  );
}

async function spc(path: string) {
  const r = await fetch(`https://www.spc.noaa.gov/products/outlook/${path}`, {
    headers: UA,
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  return r?.ok ? ((await r.json()) as { features: Feature[] }) : null;
}

/** The highest probability band (%) of one hazard at a spot, or 0. */
function probAt(d: { features: Feature[] } | null, lon: number, lat: number) {
  let best = 0;
  for (const f of d?.features ?? []) {
    const v = Number.parseFloat(
      String(f.properties.LABEL ?? "").replace("SIGN", ""),
    );
    if (Number.isFinite(v) && v > best && inFeature(f, lon, lat))
      best = v < 1 ? v * 100 : v;
  }
  return best;
}

async function nwsToday(lat: number, lon: number) {
  const p = await fetch(
    `https://api.weather.gov/points/${lat.toFixed(3)},${lon.toFixed(3)}`,
    {
      headers: UA,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(15000),
    },
  ).catch(() => null);
  if (!p?.ok) return null;
  const url = ((await p.json()) as { properties?: { forecast?: string } })
    .properties?.forecast;
  if (!url) return null;
  const f = await fetch(url, {
    headers: UA,
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!f?.ok) return null;
  const periods =
    (
      (await f.json()) as {
        properties?: { periods?: { name: string; detailedForecast: string }[] };
      }
    ).properties?.periods ?? [];
  return periods.slice(0, 2);
}

let rows: ReturnType<typeof parsePlaces> | null = null;

export async function newsbreakDrafts(): Promise<{
  at: string;
  risk: string | null;
  drafts: Draft[];
}> {
  const [cat, torn, wind, hail] = await Promise.all([
    spc("day1otlk_cat.nolyr.geojson"),
    spc("day1otlk_torn.nolyr.geojson"),
    spc("day1otlk_wind.nolyr.geojson"),
    spc("day1otlk_hail.nolyr.geojson"),
  ]);
  const top = (cat?.features ?? []).reduce(
    (a, f) => Math.max(a, ORDER.indexOf(String(f.properties.LABEL))),
    -1,
  );
  const at = new Date().toISOString();
  if (top < 2) return { at, risk: null, drafts: [] };
  const label = ORDER[top];
  rows ??= parsePlaces(PLACES);
  // The biggest towns inside the highest category (then the next one down), most populous first.
  const towns: {
    name: string;
    st: string;
    lat: number;
    lon: number;
    cat: string;
  }[] = [];
  for (let c = top; c >= 2 && towns.length < 5; c--) {
    const feats = (cat?.features ?? []).filter(
      (f) => f.properties.LABEL === ORDER[c],
    );
    for (const r of rows) {
      if (r.pop < 40000 || towns.length >= 5) break;
      if (towns.some((t) => t.name === r.name && t.st === r.st)) continue;
      if (feats.some((f) => inFeature(f, r.lon, r.lat)))
        towns.push({
          name: r.name,
          st: r.st,
          lat: r.lat,
          lon: r.lon,
          cat: ORDER[c],
        });
    }
  }
  const day = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });
  const list = towns.map((t) => `${t.name}, ${t.st}`);
  const threats = towns.length
    ? (() => {
        const t = Math.max(...towns.map((x) => probAt(torn, x.lon, x.lat)));
        const w = Math.max(...towns.map((x) => probAt(wind, x.lon, x.lat)));
        const h = Math.max(...towns.map((x) => probAt(hail, x.lon, x.lat)));
        return [
          w ? `damaging winds (up to a ${w}% chance within 25 miles)` : null,
          h ? `large hail (up to ${h}%)` : null,
          t ? `tornadoes (up to ${t}%)` : null,
        ].filter(Boolean) as string[];
      })()
    : [];
  const drafts: Draft[] = [
    {
      kind: "explainer",
      title: `Severe storms possible ${day}${list.length ? ` in ${list.slice(0, 2).join(" and ")}` : ""}: what to know`,
      body: [
        `The Storm Prediction Center has placed ${list.length ? list.join(", ") : "parts of the country"} under a ${NAME[label]} for severe thunderstorms today.`,
        threats.length ? `The main threats are ${threats.join(", ")}.` : "",
        "Storms like these can build quickly in the afternoon and evening. Know where you'll shelter: the lowest floor, an interior room, away from windows. Keep two ways to get warnings and charge your phone before storms arrive.",
        `Follow the storms live, with radar, warnings and the storm timing for your town, on StormSync Weather: ${SITE.url}/spc-probability`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
  const forecasts = await Promise.all(
    towns.slice(0, 3).map((t) => nwsToday(t.lat, t.lon).catch(() => null)),
  );
  towns.slice(0, 3).forEach((t, i) => {
    const p = forecasts[i];
    if (!p?.length) return;
    drafts.push({
      kind: "town",
      town: `${t.name}, ${t.st}`,
      title: `${t.name} weather: ${p[0].name.toLowerCase()} and tonight`,
      body: [
        `${t.name} sits inside today's ${NAME[t.cat].replace(/ \(.*/, "")} for severe storms.`,
        ...p.map((x) => `${x.name}: ${x.detailedForecast}`),
        `Live radar and warnings for ${t.name}: ${SITE.url}/warnings-reports`,
      ].join("\n\n"),
    });
  });
  return { at, risk: NAME[label], drafts };
}
