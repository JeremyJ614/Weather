import "server-only";
import { getOutlook, type Storm } from "@/lib/tropical/nhc";
import { BASINS, compass } from "@/lib/tropical/style";
import { WORLD_BASINS, type WorldStorm } from "@/lib/tropical/jtwc";
import { worldStorms } from "@/lib/tropical/world";

/**
 * Earth Watch (post-launch A2, B10): what is happening on the whole planet right now, from
 * free global feeds: tropical cyclones from NHC and the Joint Typhoon Warning Center (the same
 * storms as the Tropical Outlook page, with their forecast tracks), GDACS (the UN and EU's disaster alert system: cyclones, floods, wildfires,
 * volcanoes, droughts, earthquakes, with alert levels), NASA EONET (storm tracks, wildfires, dust,
 * icebergs, volcanoes), USGS (strong earthquakes) and NSIDC (sea ice extent against 1981–2010).
 * Merged into one list, each event with a 1–5 level, a short story and its source.
 */
const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };

export type Kind =
  | "cyclone"
  | "flood"
  | "fire"
  | "volcano"
  | "dust"
  | "ice"
  | "quake"
  | "drought";
export const KINDS: Kind[] = [
  "cyclone",
  "flood",
  "fire",
  "volcano",
  "dust",
  "ice",
  "quake",
  "drought",
];
export const LEVELS = ["", "Minor", "Moderate", "Serious", "Severe", "Extreme"];

export type EarthEvent = {
  id: string;
  kind: Kind;
  title: string;
  place: string;
  lat: number;
  lon: number;
  level: number;
  story: string;
  stats: { label: string; value: string }[];
  started: string | null;
  updated: string | null;
  source: { name: string; url: string };
  /** Where a storm has been, oldest first ([lon, lat]). */
  track?: [number, number][];
  /** A storm's official forecast track from now on ([lon, lat]). */
  forecast?: [number, number][];
};
export type Earth = {
  at: string;
  events: EarthEvent[];
  biggest: string | null;
  counts: Record<Kind, number>;
  /** The newest satellite frames NASA has published, per satellite (ISO, oldest first). */
  sat: Record<string, string[]>;
};

/**
 * The geostationary layers the globe animates, with each one's sharpest GIBS level: GeoColor
 * (true color by day, infrared with city lights by night) for the Americas, and infrared for
 * all three satellites (Himawari has no GeoColor in GIBS).
 */
export const SAT_LAYERS = {
  "GOES-East_ABI_GeoColor": 7,
  "GOES-West_ABI_GeoColor": 7,
  "GOES-East_ABI_Band13_Clean_Infrared": 6,
  "GOES-West_ABI_Band13_Clean_Infrared": 6,
  Himawari_AHI_Band13_Clean_Infrared: 6,
} as const;

/**
 * NASA publishes geostationary imagery on its own schedule (often 1 to 2 hours behind), so
 * instead of guessing, ask GIBS which frames exist and take the newest four of each.
 */
async function newestFrames(): Promise<Record<string, string[]>> {
  // A stable window (the six hours up to the next whole hour) so the answer caches.
  const end = Math.ceil(Date.now() / 3600_000) * 3600_000;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19) + "Z";
  const out: Record<string, string[]> = {};
  await Promise.all(
    Object.entries(SAT_LAYERS).map(async ([l, level]) => {
      const xml = await get<string>(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/${l}/default/GoogleMapsCompatible_Level${level}/all/${iso(end - 6 * 3600_000)}--${iso(end)}.xml`,
        600,
      );
      // "start/end/PT10M" periods (or single times), comma separated.
      const parts =
        /<Domain>([^<]+)<\/Domain>/.exec(xml ?? "")?.[1].split(",") ?? [];
      const times: number[] = [];
      for (const part of parts.reverse()) {
        const [a, b, step] = part.trim().split("/");
        const from = Date.parse(a);
        const to = b ? Date.parse(b) : from;
        const dt = step === "PT10M" ? 600_000 : to - from || 600_000;
        for (let t = to; t >= from && times.length < 4; t -= dt) times.push(t);
        if (times.length >= 4) break;
      }
      if (times.length) out[l] = times.reverse().map(iso);
    }),
  );
  return out;
}

async function get<T>(url: string, revalidate = 900): Promise<T | null> {
  const r = await fetch(url, {
    headers: UA,
    next: { revalidate },
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!r?.ok) return null;
  return (/\.(csv|xml)$/.test(url) ? r.text() : r.json()).catch(
    () => null,
  ) as Promise<T | null>;
}

const mph = (kmh: number) => Math.round(kmh * 0.621371);
const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : null;
const clampLevel = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
/** "Tropical Cyclone XAVIER-26" → "Tropical Cyclone Xavier". */
const tidy = (s: string) =>
  s
    .replace(/-\d{2}$/, "")
    .replace(
      /\b([A-Z])([A-Z]{2,})\b/g,
      (_, a: string, b: string) => a + b.toLowerCase(),
    );

/* ── Tropical cyclones (NHC and JTWC) ──────────────────────────────────── */
const tcLevel = (kt: number) =>
  kt >= 113 ? 5 : kt >= 96 ? 4 : kt >= 64 ? 3 : kt >= 34 ? 2 : 1;
const toMph = (kt: number) => Math.round(kt * 1.15078);
/** "in about 2 days", "within a day". */
const inTime = (tau: number) =>
  tau <= 24
    ? "within a day"
    : `in about ${Math.round(tau / 24)} ${Math.round(tau / 24) === 1 ? "day" : "days"}`;
/** Where a storm outside NHC's basins is, in words a reader knows. */
function region(w: WorldStorm) {
  if (w.basin === "wp") return "West Pacific";
  if (w.basin === "io") return w.lon < 80 ? "Arabian Sea" : "Bay of Bengal";
  if (w.lon > 160 || w.lon < -100) return "South Pacific";
  if (w.lon >= 90) return "off Australia";
  return "South Indian Ocean";
}
function tcEvent(t: {
  id: string;
  title: string;
  place: string;
  kt: number;
  lat: number;
  lon: number;
  dir: number | null;
  speedMph: number | null;
  pressure: number | null;
  valid: string | null;
  forecast: { tau: number; lat: number; lon: number; kt: number }[];
  past: [number, number][];
  agency: string;
  source: { name: string; url: string };
}): EarthEvent {
  const ahead = t.forecast.filter((p) => p.tau > 0);
  const peak = ahead.reduce<(typeof ahead)[number] | null>(
    (a, p) => (!a || p.kt > a.kt ? p : a),
    null,
  );
  const stats: EarthEvent["stats"] = [
    { label: "Winds now", value: `${toMph(t.kt)} mph` },
  ];
  let outlook = "";
  if (peak && peak.kt >= t.kt + 10) {
    stats.push({ label: "Forecast peak", value: `${toMph(peak.kt)} mph` });
    outlook = ` ${t.agency} expects it to strengthen to about ${toMph(peak.kt)} mph ${inTime(peak.tau)}.`;
  } else if (ahead.length && ahead.at(-1)!.kt <= t.kt - 10)
    outlook = ` ${t.agency} expects it to weaken over the next few days.`;
  else if (ahead.length)
    outlook = ` ${t.agency} expects it to hold near this strength.`;
  if (t.dir != null && t.speedMph)
    stats.push({
      label: "Moving",
      value: `${compass(t.dir)} ${t.speedMph} mph`,
    });
  if (t.pressure) stats.push({ label: "Pressure", value: `${t.pressure} mb` });
  const move =
    t.dir != null && t.speedMph
      ? `, moving ${compass(t.dir)} at ${t.speedMph} mph`
      : t.speedMph === 0
        ? ", nearly stationary"
        : "";
  return {
    id: `tc-${t.id}`,
    kind: "cyclone",
    title: t.title,
    place: t.place,
    lat: t.lat,
    lon: t.lon,
    level: Math.max(tcLevel(t.kt), peak ? tcLevel(peak.kt) - 1 : 1),
    story: `${t.title} has winds near ${toMph(t.kt)} mph${move}.${outlook}${ahead.length ? " The solid line is its forecast track" : ""}${ahead.length && t.past.length > 1 ? ", the dashed line where it has been." : ahead.length ? "." : ""}`,
    stats,
    started: null,
    updated: t.valid,
    source: t.source,
    track: t.past.length > 1 ? [...t.past, [t.lon, t.lat]] : undefined,
    forecast: ahead.length
      ? [
          [t.lon, t.lat],
          ...ahead.map((p) => [p.lon, p.lat] as [number, number]),
        ]
      : undefined,
  };
}
const fromNhc = (x: Storm) =>
  tcEvent({
    id: x.id,
    title: x.title,
    place: BASINS.find((b) => b.id === x.basin)?.name ?? "",
    kt: x.kt,
    lat: x.lat,
    lon: x.lon,
    dir: x.dir,
    speedMph: x.speedMph,
    pressure: x.pressure,
    valid: x.updated,
    forecast: x.points,
    past: [],
    agency: "The National Hurricane Center",
    source: {
      name: "NHC",
      url: x.links.graphics ?? x.links.advisory ?? "https://www.nhc.noaa.gov",
    },
  });
const fromJtwc = (w: WorldStorm) =>
  tcEvent({
    id: w.code,
    title: w.title,
    place: region(w),
    kt: w.kt,
    lat: w.lat,
    lon: w.lon,
    dir: w.dir,
    speedMph: w.speedMph,
    pressure: w.pressure,
    valid: w.valid,
    forecast: w.forecast,
    past: w.past.map((p) => [p.lon, p.lat] as [number, number]),
    agency: "The Joint Typhoon Warning Center",
    source: {
      name: `JTWC · ${WORLD_BASINS[w.basin]}`,
      url: w.links.text,
    },
  });

/* ── GDACS ─────────────────────────────────────────────────────────────── */
type Gdacs = {
  features: {
    geometry: { coordinates: [number, number] };
    properties: {
      eventtype: string;
      eventid: number;
      name: string;
      eventname?: string;
      alertlevel: string;
      alertscore?: number;
      country?: string;
      fromdate?: string;
      todate?: string;
      datemodified?: string;
      iscurrent?: string;
      severitydata?: {
        severity?: number;
        severitytext?: string;
        severityunit?: string;
      };
      url?: { report?: string };
    };
  }[];
};
const GKIND: Record<string, Kind> = {
  TC: "cyclone",
  FL: "flood",
  WF: "fire",
  VO: "volcano",
  DR: "drought",
  EQ: "quake",
};
const ALERT: Record<string, number> = { Green: 1, Orange: 3, Red: 5 };

function gdacsEvent(f: Gdacs["features"][number]): EarthEvent | null {
  const p = f.properties;
  const kind = GKIND[p.eventtype];
  if (!kind || p.iscurrent === "false") return null;
  const [lon, lat] = f.geometry.coordinates;
  const sev = p.severitydata?.severity ?? 0;
  const text = p.severitydata?.severitytext?.trim() ?? "";
  let level = ALERT[p.alertlevel] ?? 1;
  const stats: EarthEvent["stats"] = [];
  let story = "";
  const where = p.country || "open water";
  p.name = tidy(p.name);
  if (kind === "cyclone") {
    const kmh = Number(text.match(/(\d+)\s*km\/h/)?.[1] ?? 0);
    if (kmh) stats.push({ label: "Peak winds", value: `${mph(kmh)} mph` });
    if (kmh >= 178) level = Math.max(level, 4);
    else if (kmh >= 119) level = Math.max(level, 3);
    else if (kmh >= 63) level = Math.max(level, 2);
    story = `${p.name} is ${kmh >= 119 ? "a hurricane-strength storm" : "a tropical storm"}${where !== "open water" ? ` near ${where}` : " over open water"}${kmh ? `, with winds forecast to peak near ${mph(kmh)} mph` : ""}. GDACS rates its overall threat ${p.alertlevel.toLowerCase()}${p.alertlevel === "Red" ? ", its highest" : ""}.`;
  } else if (kind === "quake") {
    const m = sev || Number(text.match(/([\d.]+)/)?.[1] ?? 0);
    if (m) stats.push({ label: "Magnitude", value: m.toFixed(1) });
    if (m >= 7.5) level = Math.max(level, 4);
    else if (m >= 6.5) level = Math.max(level, 3);
    story = `A magnitude ${m.toFixed(1)} earthquake struck ${where}. GDACS rates the expected impact ${p.alertlevel.toLowerCase()}, from how strong it was and how many people live near it.`;
  } else if (kind === "fire") {
    if (sev)
      stats.push({
        label: "Burned",
        value: `${Math.round(sev).toLocaleString("en-US")} ${p.severitydata?.severityunit || "ha"}`,
      });
    if (sev > 50000) level = Math.max(level, 3);
    else if (sev > 10000) level = Math.max(level, 2);
    story = `A wildfire is burning in ${where}${sev ? `, about ${Math.round(sev).toLocaleString("en-US")} ${p.severitydata?.severityunit || "hectares"} so far` : ""}. Satellites track its spread.`;
  } else if (kind === "flood") {
    story = `Flooding is affecting ${where}${p.fromdate ? ` since ${day(p.fromdate)}` : ""}. GDACS rates it ${p.alertlevel.toLowerCase()} from rainfall and river models and reports from the ground.`;
  } else if (kind === "volcano") {
    story = `${p.name} is erupting or restless. GDACS rates the risk to people ${p.alertlevel.toLowerCase()}.`;
  } else if (kind === "drought") {
    story = `A drought is affecting ${where}${p.fromdate ? ` since ${day(p.fromdate)}` : ""}, rated ${p.alertlevel.toLowerCase()} by GDACS.`;
  }
  if (p.alertscore) level = Math.max(level, clampLevel(p.alertscore + 0.5));
  return {
    id: `gdacs-${p.eventtype}-${p.eventid}`,
    kind,
    title: p.name,
    place: where,
    lat,
    lon,
    level: clampLevel(level),
    story,
    stats,
    started: p.fromdate ? `${p.fromdate}Z` : null,
    updated: p.datemodified ? `${p.datemodified}Z` : null,
    source: { name: "GDACS", url: p.url?.report ?? "https://www.gdacs.org" },
  };
}

/* ── NASA EONET ────────────────────────────────────────────────────────── */
type Eonet = {
  events: {
    id: string;
    title: string;
    categories: { id: string }[];
    sources: { id: string; url: string }[];
    geometry: {
      date: string;
      type: string;
      coordinates: number[] | number[][][];
      magnitudeValue?: number;
      magnitudeUnit?: string;
    }[];
  }[];
};
/** How old (hours) EONET's latest report on an event may be, by how often each kind is updated. */
const EONET_FRESH: Record<Kind, number> = {
  cyclone: 36,
  fire: 72,
  dust: 48,
  flood: 168,
  volcano: 240,
  ice: 240,
  quake: 48,
  drought: 720,
};
const EKIND: Record<string, Kind> = {
  severeStorms: "cyclone",
  wildfires: "fire",
  volcanoes: "volcano",
  dustHaze: "dust",
  seaLakeIce: "ice",
  floods: "flood",
};

function eonetEvent(e: Eonet["events"][number]): EarthEvent | null {
  const kind = EKIND[e.categories[0]?.id];
  if (!kind) return null;
  const pts = e.geometry.filter((g) => g.type === "Point") as {
    date: string;
    coordinates: number[];
    magnitudeValue?: number;
    magnitudeUnit?: string;
  }[];
  const last = pts.at(-1);
  if (!last) return null;
  // EONET closes events days or weeks late, so anything without a recent report is left
  // off rather than shown as if it were still happening.
  if (Date.now() - Date.parse(last.date) > EONET_FRESH[kind] * 3600_000)
    return null;
  const [lon, lat] = last.coordinates;
  const stats: EarthEvent["stats"] = [];
  let level = 1;
  let story = "";
  if (kind === "cyclone") {
    const kt = last.magnitudeUnit === "kts" ? (last.magnitudeValue ?? 0) : 0;
    if (kt)
      stats.push({
        label: "Winds now",
        value: `${Math.round(kt * 1.15078)} mph`,
      });
    level = kt >= 113 ? 5 : kt >= 96 ? 4 : kt >= 64 ? 3 : kt >= 34 ? 2 : 1;
    story = `${e.title} has winds near ${Math.round(kt * 1.15078)} mph. The line shows where it has been since ${day(pts[0].date)}.`;
  } else if (kind === "fire") {
    const acres =
      last.magnitudeUnit === "acres" ? (last.magnitudeValue ?? 0) : 0;
    if (acres)
      stats.push({
        label: "Size",
        value: `${Math.round(acres).toLocaleString("en-US")} acres`,
      });
    level = acres > 100000 ? 4 : acres > 20000 ? 3 : acres > 2000 ? 2 : 1;
    story = `${e.title}${acres ? ` has burned about ${Math.round(acres).toLocaleString("en-US")} acres` : " is active"}, tracked by NASA from satellite and incident reports.`;
  } else if (kind === "ice") {
    const nm2 = last.magnitudeUnit === "NM^2" ? (last.magnitudeValue ?? 0) : 0;
    if (nm2)
      stats.push({
        label: "Size",
        value: `${Math.round(nm2 * 3.43).toLocaleString("en-US")} sq km`,
      });
    story = `${e.title}: a large iceberg adrift${nm2 ? `, about ${Math.round(nm2 * 3.43).toLocaleString("en-US")} square kilometers` : ""}, followed by the U.S. National Ice Center.`;
  } else if (kind === "dust") {
    level = 2;
    story = `${e.title}: a dust or haze outbreak seen from space, which can cut visibility and air quality far downwind.`;
  } else if (kind === "volcano") {
    level = 2;
    story = `${e.title} is active, from the Smithsonian's Global Volcanism Program and satellite reports.`;
  } else {
    story = e.title;
  }
  return {
    id: `eonet-${e.id}`,
    kind,
    title: e.title,
    place: "",
    lat,
    lon,
    level,
    story,
    stats,
    started: pts[0]?.date ?? null,
    updated: last.date,
    source: {
      name: e.sources[0]?.id ? `NASA EONET · ${e.sources[0].id}` : "NASA EONET",
      url: e.sources[0]?.url ?? "https://eonet.gsfc.nasa.gov",
    },
    track:
      kind === "cyclone" && pts.length > 1
        ? pts.map(
            (p) => [p.coordinates[0], p.coordinates[1]] as [number, number],
          )
        : undefined,
  };
}

/* ── USGS strong earthquakes ───────────────────────────────────────────── */
type Usgs = {
  features: {
    id: string;
    properties: {
      mag: number;
      place: string;
      time: number;
      url: string;
      tsunami: number;
      alert: string | null;
    };
    geometry: { coordinates: number[] };
  }[];
};
function usgsEvent(f: Usgs["features"][number]): EarthEvent | null {
  const p = f.properties;
  if (!(p.mag >= 5.5)) return null;
  // The last two days, or the past week for a magnitude 7 or stronger.
  if (Date.now() - p.time > (p.mag >= 7 ? 168 : 48) * 3600_000) return null;
  const [lon, lat, depth] = f.geometry.coordinates;
  const pager: Record<string, number> = {
    green: 1,
    yellow: 3,
    orange: 4,
    red: 5,
  };
  const level = Math.max(
    p.mag >= 7.5 ? 4 : p.mag >= 6.5 ? 3 : 2,
    pager[p.alert ?? ""] ?? 0,
  );
  return {
    id: `usgs-${f.id}`,
    kind: "quake",
    title: `M${p.mag.toFixed(1)} earthquake`,
    place: p.place,
    lat,
    lon,
    level: clampLevel(level),
    story: `A magnitude ${p.mag.toFixed(1)} earthquake struck ${p.place}, ${Math.round(depth)} km deep.${p.tsunami ? " A tsunami message was issued; follow local officials." : ""}`,
    stats: [
      { label: "Magnitude", value: p.mag.toFixed(1) },
      { label: "Depth", value: `${Math.round(depth)} km` },
    ],
    started: new Date(p.time).toISOString(),
    updated: new Date(p.time).toISOString(),
    source: { name: "USGS", url: p.url },
  };
}

/* ── NSIDC sea ice ─────────────────────────────────────────────────────── */
async function seaIce(): Promise<EarthEvent[]> {
  const base = "https://noaadata.apps.nsidc.org/NOAA/G02135";
  const out: EarthEvent[] = [];
  for (const [hem, H, lat, name] of [
    ["north", "N", 84, "Arctic"],
    ["south", "S", -72, "Antarctic"],
  ] as const) {
    const [daily, clim] = await Promise.all([
      get<string>(
        `${base}/${hem}/daily/data/${H}_seaice_extent_daily_v4.0.csv`,
        21600,
      ),
      get<string>(
        `${base}/${hem}/daily/data/${H}_seaice_extent_climatology_1981-2010_v4.0.csv`,
        604800,
      ),
    ]);
    const last = daily?.trim().split("\n").at(-1)?.split(",");
    if (!last || !clim) continue;
    const [y, m, d, ext] = last.map((x) => Number.parseFloat(x));
    const doy = Math.floor(
      (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400_000,
    );
    const row = clim
      .split("\n")
      .find((l) => Number.parseInt(l, 10) === doy)
      ?.split(",");
    const median = row ? Number.parseFloat(row[5]) : NaN;
    if (!Number.isFinite(ext) || !Number.isFinite(median)) continue;
    const diff = ext - median;
    const pct = (diff / median) * 100;
    const date = new Date(Date.UTC(y, m - 1, d)).toISOString();
    out.push({
      id: `ice-${hem}`,
      kind: "ice",
      title: `${name} sea ice`,
      place: name,
      lat,
      lon: 0,
      level: clampLevel(
        Math.abs(pct) >= 15
          ? 4
          : Math.abs(pct) >= 8
            ? 3
            : Math.abs(pct) >= 3
              ? 2
              : 1,
      ),
      story: `${name} sea ice covers ${ext.toFixed(2)} million square kilometers, ${Math.abs(diff).toFixed(2)} million (${Math.abs(pct).toFixed(0)}%) ${diff < 0 ? "below" : "above"} the 1981–2010 median for ${day(date)}.`,
      stats: [
        { label: "Extent", value: `${ext.toFixed(2)}M km²` },
        {
          label: "Vs 1981–2010",
          value: `${diff < 0 ? "−" : "+"}${Math.abs(pct).toFixed(0)}%`,
        },
      ],
      started: null,
      updated: date,
      source: {
        name: "NSIDC Sea Ice Index",
        url: "https://nsidc.org/data/seaice_index",
      },
    });
  }
  return out;
}

/** The same event from two feeds: same kind and close by (storms move, so they get more room). */
const near = (a: EarthEvent, b: EarthEvent) => {
  const r = a.kind === "cyclone" ? 6 : 2;
  return (
    a.kind === b.kind &&
    Math.abs(a.lat - b.lat) < r &&
    Math.abs(((a.lon - b.lon + 540) % 360) - 180) < r
  );
};
const PRIORITY: Record<Kind, number> = {
  cyclone: 8,
  volcano: 6,
  flood: 7,
  quake: 5,
  fire: 4,
  dust: 3,
  drought: 2,
  ice: 1,
};

export async function earthNow(): Promise<Earth> {
  const [nhc, world, gd, eo, us, ice, sat] = await Promise.all([
    getOutlook()
      .then((o) => o.storms)
      .catch(() => null),
    worldStorms().catch(() => null),
    get<Gdacs>(
      "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC,FL,VO,WF,DR,EQ&alertlevel=green;orange;red&pagesize=300",
      300,
    ),
    get<Eonet>("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=10"),
    get<Usgs>(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
      300,
    ),
    seaIce().catch(() => []),
    newestFrames().catch(() => ({})),
  ]);
  const list: EarthEvent[] = [];
  const add = (e: EarthEvent | null) => {
    if (!e || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) return;
    const dup = list.find((x) => near(x, e));
    if (dup) {
      // Keep the higher level and the richer details (EONET's track, USGS's place).
      dup.level = Math.max(dup.level, e.level);
      dup.track ??= e.track;
      if (!dup.place && e.place) dup.place = e.place;
      for (const s of e.stats)
        if (!dup.stats.some((x) => x.label === s.label)) dup.stats.push(s);
      return;
    }
    list.push(e);
  };
  // Storms first, from the forecast centers; GDACS then adds the country it threatens and
  // raises the level only on its orange or red impact alerts.
  const tcs = [
    ...(nhc ?? []).map(fromNhc),
    ...(world ?? []).map(fromJtwc),
  ].filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon));
  list.push(...tcs);
  // While both centers answer, their storms are the whole list (as on the Tropical Outlook
  // page); the other feeds only fill in. If either is down, GDACS and EONET stand in.
  const ours = nhc !== null && world !== null;
  for (const f of gd?.features ?? []) {
    const e = gdacsEvent(f);
    if (e?.kind !== "cyclone" || !tcs.length) {
      if (e?.kind !== "cyclone" || !ours) add(e);
      continue;
    }
    const dup = tcs.find((x) => near(x, e));
    if (!dup) {
      if (!ours) add(e);
      continue;
    }
    if (e.place && e.place !== "open water") dup.place = e.place;
    dup.level = Math.max(dup.level, ALERT[f.properties.alertlevel] ?? 1);
  }
  for (const x of eo?.events ?? []) {
    const e = eonetEvent(x);
    if (e?.kind === "cyclone" && ours) {
      const dup = tcs.find((t) => near(t, e));
      if (dup) dup.track ??= e.track;
      continue;
    }
    add(e);
  }
  for (const f of us?.features ?? []) add(usgsEvent(f));
  for (const e of ice) add(e);
  list.sort(
    (a, b) =>
      b.level - a.level ||
      PRIORITY[b.kind] - PRIORITY[a.kind] ||
      (b.updated ?? "").localeCompare(a.updated ?? ""),
  );
  const counts = Object.fromEntries(
    KINDS.map((k) => [k, list.filter((e) => e.kind === k).length]),
  ) as Record<Kind, number>;
  const biggest = list.find((e) => e.kind !== "ice") ?? list[0];
  return {
    at: new Date().toISOString(),
    events: list,
    biggest: biggest?.id ?? null,
    counts,
    sat,
  };
}
