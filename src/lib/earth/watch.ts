import "server-only";

/**
 * Earth Watch (post-launch A2, B10): what is happening on the whole planet right now, from
 * free global feeds: GDACS (the UN and EU's disaster alert system: cyclones, floods, wildfires,
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
  track?: [number, number][];
};
export type Earth = {
  at: string;
  events: EarthEvent[];
  biggest: string | null;
  counts: Record<Kind, number>;
};

async function get<T>(url: string, revalidate = 900): Promise<T | null> {
  const r = await fetch(url, {
    headers: UA,
    next: { revalidate },
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!r?.ok) return null;
  return (url.endsWith(".csv") ? r.text() : r.json()).catch(
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
  const [gd, eo, us, ice] = await Promise.all([
    get<Gdacs>(
      "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC,FL,VO,WF,DR,EQ&alertlevel=green;orange;red&pagesize=300",
    ),
    get<Eonet>("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=21"),
    get<Usgs>(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
    ),
    seaIce().catch(() => []),
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
  for (const f of gd?.features ?? []) add(gdacsEvent(f));
  for (const e of eo?.events ?? []) add(eonetEvent(e));
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
  };
}
