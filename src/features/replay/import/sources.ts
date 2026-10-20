/**
 * Finding a chase's tornadoes, from the browser, at the moment you upload it.
 *
 * Until now this app could only replay two chases, because the data behind
 * them was assembled by Python scripts that a person ran on a laptop. That
 * makes a demo, not a product: there was no way for anyone to add a chase.
 *
 * Everything those scripts do can be done from the page, because all three
 * sources send CORS headers — NOAA's Damage Assessment Toolkit echoes the
 * origin back, and the Iowa Environmental Mesonet allows any. So an upload can
 * go and get its own tornadoes, damage, hail and warnings, with no server of
 * ours in between and no key to leak.
 *
 * What the survey does not give you is names. `event_id` on the Damage Lines
 * layer is blank on most tornadoes and an internal code like
 * `20240314_darke_miami` on some of the rest, and `path_guid` — which looks
 * like it should tie damage points to their tornado — is null on every point
 * I have queried. So names come from the Weather Service's own local storm
 * reports, matched by place and time, and damage is attributed by which track
 * it is nearest to.
 */
import type {
  DamageContour,
  DamagePoint,
  HailReport,
  TornadoInput,
  WarningPolygonInput,
} from "@/features/replay/core/chase";
import { hailName } from "@/features/replay/core/chase";
import {
  haversine,
  pointToSegment,
  projector,
} from "@/features/replay/core/geo";
import type { Fix } from "./types";
import { ImportError } from "./types";

const DAT =
  "https://services.dat.noaa.gov/arcgis/rest/services" +
  "/nws_damageassessmenttoolkit/DamageViewer/MapServer";
const LSR = "https://mesonet.agron.iastate.edu/geojson/lsr.geojson";
const SBW = "https://mesonet.agron.iastate.edu/api/1/vtec/sbw_interval.geojson";

/** The ArcGIS layers, by the numbers the service gives them. */
const LAYER = { points: 0, lines: 1, polygons: 2 } as const;

/** What the service will return in one go. Paging is supported and needed. */
const PAGE = 2000;

/** Under this, a hail report is graupel with ambitions. Matches build_hail.py. */
const MIN_HAIL_INCHES = 0.75;

/**
 * How near a damage point has to be to a track to be that tornado's.
 *
 * A survey walks the damage along the path, so its points sit within a few
 * hundred metres of the centreline — the width of the swath, essentially. Five
 * kilometres is generous enough for a wedge and a coarse track together, and
 * tight enough that a point belonging to a different storm is dropped rather
 * than hung on whichever tornado was least far away. At twenty kilometres it
 * picked up sixty-three points the hand-built payload does not have.
 */
const ATTRIBUTION_METRES = 5_000;

/** How near an LSR has to be, in metres and seconds, to name a tornado. */
const NAME_RADIUS_M = 25_000;
const NAME_WINDOW_S = 45 * 60;

export type Bbox = { west: number; south: number; east: number; north: number };

export interface DiscoveryBundle {
  tornadoes: TornadoInput[];
  contours: DamageContour[];
  damage: DamagePoint[];
  hail: HailReport[];
  warnings: WarningPolygonInput[];
  /** Anything the reader should know about what was and was not found. */
  notes: string[];
}

export interface DiscoverOptions {
  /** Called as each source completes, for the progress bar. */
  onProgress?: (fraction: number, what: string) => void;
  /** Swappable for tests. */
  fetchImpl?: typeof fetch;
  /** Degrees of padding around the route's own box. */
  padDeg?: number;
  /** Hours either side of the route's own window. */
  padHours?: number;
  signal?: AbortSignal;
}

// --- the wire ---------------------------------------------------------------

async function getJson(
  url: string,
  f: typeof fetch,
  signal?: AbortSignal,
): Promise<unknown> {
  let res: Response;
  try {
    res = await f(url, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ImportError(
      "Could not reach the survey archive.",
      "It may be offline, or this device may have no connection. The chase will " +
        "still import — it just will not have tornadoes attached yet.",
    );
  }
  if (!res.ok) {
    throw new ImportError(
      `The survey archive answered ${res.status}.`,
      "That is the National Weather Service’s server, not this app. Trying again " +
        "in a few minutes usually works.",
    );
  }
  return res.json();
}

/** An ArcGIS date literal. The service will not take an epoch here. */
const stamp = (d: Date) =>
  `timestamp '${d.toISOString().slice(0, 19).replace("T", " ")}'`;

/**
 * One ArcGIS layer, filtered by box and date, paged until it runs out.
 *
 * The date filter is deliberately wider than the chase: `stormdate` is the
 * *storm's* date, and a storm that crosses UTC midnight — which any evening
 * chase in North America does — lands on either side of it depending on the
 * office. Querying a day either way and filtering on the real timestamps
 * afterwards is the only way to get all of them. Doing it the obvious way
 * returned five of the Indian Lake day's nine tornadoes.
 */
async function queryLayer(
  layer: number,
  bbox: Bbox,
  from: Date,
  to: Date,
  outFields: string,
  geometry: boolean,
  f: typeof fetch,
  signal?: AbortSignal,
): Promise<
  { attributes: Record<string, unknown>; geometry?: Record<string, unknown> }[]
> {
  const day = 86_400_000;
  const where =
    `stormdate >= ${stamp(new Date(from.getTime() - day))}` +
    ` AND stormdate < ${stamp(new Date(to.getTime() + day))}`;

  const out: {
    attributes: Record<string, unknown>;
    geometry?: Record<string, unknown>;
  }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const qs = new URLSearchParams({
      where,
      geometry: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      outSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields,
      returnGeometry: String(geometry),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: "json",
    });
    const data = (await getJson(`${DAT}/${layer}/query?${qs}`, f, signal)) as {
      error?: { message?: string };
      features?: {
        attributes: Record<string, unknown>;
        geometry?: Record<string, unknown>;
      }[];
      exceededTransferLimit?: boolean;
    };
    if (data.error) {
      throw new ImportError(
        data.error.message ?? "The survey archive refused the query.",
        "This usually means the area or the date range came out malformed.",
      );
    }
    const page = data.features ?? [];
    out.push(...page);
    // Stop on a short page. `exceededTransferLimit` is not always sent, so the
    // page length is the reliable signal.
    if (page.length < PAGE) break;
    // A runaway query would hammer somebody else's server. Twenty pages is
    // forty thousand records, far past any real chase.
    if (offset / PAGE > 20) break;
  }
  return out;
}

// --- shaping ----------------------------------------------------------------

const EF = (raw: unknown): string => {
  const s = String(raw ?? "")
    .toUpperCase()
    .trim();
  if (/^EF[0-5]$/.test(s)) return s;
  if (/^[0-5]$/.test(s)) return `EF${s}`;
  return "EFU";
};

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Is this `event_id` a name a person would recognise?
 *
 * The field holds three kinds of thing: a real name ("Winchester Tornado"), an
 * internal code ("20240314_darke_miami"), and nothing at all. Only the first
 * is worth showing, and the other two are better replaced by a place from the
 * storm reports.
 */
export function usableName(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d{8}[_-]/.test(s)) return null; // 20240314_darke_miami
  if (/^[a-z0-9_]+$/.test(s)) return null; // all lowercase with underscores
  return s.replace(/\s+tornado$/i, "").trim() || null;
}

/** One local storm report, reduced to what naming needs. */
interface Lsr {
  lat: number;
  lon: number;
  at: number;
  city: string;
  county: string;
  st: string;
}

/**
 * Name a tornado after the nearest place the Weather Service logged it at.
 *
 * Which place, though, is the whole question. Naming it after where it touched
 * down gives the Indian Lake EF3 — the one every chaser on that day was there
 * for — the name "Botkins", because that is the open ground it started in.
 * Naming it after its worst damage gives "Lakeview", which is what it is
 * called, because that is the town it took apart.
 *
 * So the anchor is the worst damage point attributed to it, and the touchdown
 * is only the fallback for a tornado with no surveyed damage at all. The
 * report has to be near in time as well as in space, or a long day would give
 * several tornadoes the same town.
 */
export function nameFor(
  track: {
    coords: [number, number][];
    start: number;
    ef: string;
    eventId?: unknown;
  },
  reports: readonly Lsr[],
  tz: string,
  anchor?: { lat: number; lon: number },
): string {
  const fromField = usableName(track.eventId);
  if (fromField) return fromField;

  const [tdLon, tdLat] = track.coords[0] ?? [0, 0];

  /*
   * Try the worst damage first, then the touchdown.
   *
   * Both, because they fail in different places: the touchdown names the
   * Indian Lake EF3 after the empty field it started in, and the worst damage
   * of a rural EF2 can be miles from anywhere anybody filed a report from.
   * Either anchor alone leaves a tornado unnamed that the other would have
   * named.
   */
  const anchors = anchor
    ? [anchor, { lat: tdLat, lon: tdLon }]
    : [{ lat: tdLat, lon: tdLon }];

  let best: Lsr | null = null;
  for (const { lat, lon } of anchors) {
    let bestD = Infinity;
    for (const r of reports) {
      if (Math.abs(r.at - track.start) > NAME_WINDOW_S) continue;
      const d = haversine(lat, lon, r.lat, r.lon);
      if (d < bestD && d <= NAME_RADIUS_M) {
        bestD = d;
        best = r;
      }
    }
    if (best) break;
  }
  if (best) {
    // "3 SSW Union City" is where the report was taken, not the tornado's
    // name. The bearing-and-distance prefix comes off.
    const place = best.city.replace(/^\d+\s+[NSEW]{1,3}\s+/i, "").trim();
    return place || `${best.county} County`;
  }

  const clock = new Date(track.start * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  return `${track.ef === "EFU" ? "Unrated" : track.ef} tornado, ${clock}`;
}

// --- the sources ------------------------------------------------------------

async function fetchLsr(
  from: Date,
  to: Date,
  f: typeof fetch,
  signal?: AbortSignal,
): Promise<
  {
    type: string;
    lat: number;
    lon: number;
    at: number;
    mag: number;
    city: string;
    county: string;
    st: string;
    source: string;
    remark: string;
  }[]
> {
  const qs = new URLSearchParams({
    sts: from.toISOString().slice(0, 16) + "Z",
    ets: to.toISOString().slice(0, 16) + "Z",
  });
  const data = (await getJson(`${LSR}?${qs}`, f, signal)) as {
    features?: { properties: Record<string, unknown> }[];
  };
  return (data.features ?? [])
    .map(({ properties: p }) => ({
      type: String(p.type ?? ""),
      lat: num(p.lat, NaN),
      lon: num(p.lon, NaN),
      at: Date.parse(String(p.valid ?? "")) / 1000,
      mag: num(p.magf, NaN),
      city: String(p.city ?? ""),
      county: String(p.county ?? ""),
      st: String(p.st ?? p.state ?? ""),
      source: String(p.source ?? ""),
      remark: String(p.remark ?? "").slice(0, 220),
    }))
    .filter(
      (r) =>
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lon) &&
        Number.isFinite(r.at),
    );
}

/** Everything a chase needs, gathered in one pass. */
export async function discoverForRoute(
  fixes: readonly Fix[],
  tz: string,
  opts: DiscoverOptions = {},
): Promise<DiscoveryBundle> {
  if (fixes.length < 2) {
    throw new ImportError(
      "That track has too few points to place anything against.",
      "A chase needs at least two fixes with timestamps.",
    );
  }

  const f = opts.fetchImpl ?? fetch;
  const padDeg = opts.padDeg ?? 0.75;
  const padHours = opts.padHours ?? 2;
  const say = opts.onProgress ?? (() => {});

  const T0 = fixes[0]![0];
  const lats = fixes.map((x) => x[1]);
  const lons = fixes.map((x) => x[2]);
  const bbox: Bbox = {
    west: Math.min(...lons) - padDeg,
    south: Math.min(...lats) - padDeg,
    east: Math.max(...lons) + padDeg,
    north: Math.max(...lats) + padDeg,
  };
  const from = new Date((fixes[0]![0] - padHours * 3600) * 1000);
  const to = new Date((fixes[fixes.length - 1]![0] + padHours * 3600) * 1000);
  const notes: string[] = [];

  // --- tornado tracks ---
  say(0.05, "Looking for surveyed tornadoes");
  const lineRows = await queryLayer(
    LAYER.lines,
    bbox,
    from,
    to,
    "objectid,globalid,event_id,wfo,efscale,starttime,endtime,length,width,maxwind," +
      "injuries,fatalities,comments",
    true,
    f,
    opts.signal,
  );

  say(0.3, "Reading the storm reports");
  const reports = await fetchLsr(from, to, f, opts.signal);
  const tornadoReports = reports.filter((r) => r.type === "T");

  type Raw = {
    coords: [number, number][];
    start: number;
    end: number;
    ef: string;
    attrs: Record<string, unknown>;
  };
  const raws: Raw[] = [];
  for (const row of lineRows) {
    const paths = (row.geometry?.paths ?? []) as [number, number][][];
    const coords = paths
      .flat()
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (coords.length < 2) continue;

    // The service hands these back in epoch milliseconds.
    const start = num(row.attributes.starttime, NaN) / 1000;
    const end = num(row.attributes.endtime, NaN) / 1000;
    if (!Number.isFinite(start)) continue;
    // Filter on the real timestamps, now that the wide `stormdate` net has
    // caught everything on both sides of UTC midnight.
    if (start < from.getTime() / 1000 || start > to.getTime() / 1000) continue;

    raws.push({
      coords,
      start,
      end: Number.isFinite(end) && end > start ? end : start + 60,
      ef: EF(row.attributes.efscale),
      attrs: row.attributes,
    });
  }
  raws.sort((a, b) => a.start - b.start);

  /*
   * Everything downstream is clipped to the ground the chase *covered*, not
   * the ground it drove over.
   *
   * The two are very different: on the Indian Lake day the tornadoes run from
   * Randolph County, Indiana to Licking County, Ohio, while the chaser stayed
   * inside half a degree of Lakeview. Clipping to the route alone threw away
   * 30 of that day's 48 hail reports and 10 of its 48 warning polygons — all
   * of them belonging to storms that were part of the chase, just not part of
   * the drive.
   */
  const wide: Bbox = { ...bbox };
  for (const r of raws) {
    for (const [lon, lat] of r.coords) {
      if (lon - padDeg < wide.west) wide.west = lon - padDeg;
      if (lon + padDeg > wide.east) wide.east = lon + padDeg;
      if (lat - padDeg < wide.south) wide.south = lat - padDeg;
      if (lat + padDeg > wide.north) wide.north = lat + padDeg;
    }
  }

  // Provisional, so damage can be attributed before anything is named — the
  // name depends on where the worst damage was.
  const provisional = raws.map((r) => ({ coords: r.coords }));

  // --- damage points, attributed by proximity ---
  say(0.45, "Fetching the damage survey");
  const pointRows = raws.length
    ? await queryLayer(
        LAYER.points,
        wide,
        from,
        to,
        "objectid,efscale,damage_txt,dod_txt,windspeed,lat,lon",
        false,
        f,
        opts.signal,
      )
    : [];

  const damage: DamagePoint[] = [];
  /** The worst damage attributed to each tornado, for naming it. */
  const worst: ({ lat: number; lon: number; wind: number } | null)[] = raws.map(
    () => null,
  );

  for (const row of pointRows) {
    const lat = num(row.attributes.lat, NaN);
    const lon = num(row.attributes.lon, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ti = nearestTrack(lat, lon, provisional);
    if (ti < 0) continue;
    const wind = num(row.attributes.windspeed);
    damage.push([
      Math.round(lat * 1e5) / 1e5,
      Math.round(lon * 1e5) / 1e5,
      // Straight-line wind damage is logged alongside the tornado's own and
      // is kept as the survey wrote it, not folded into EF0.
      String(row.attributes.efscale ?? "").trim() || "EFU",
      wind,
      String(row.attributes.damage_txt ?? ""),
      String(row.attributes.dod_txt ?? ""),
      ti,
    ]);
    const held = worst[ti];
    if (!held || wind > held.wind) worst[ti] = { lat, lon, wind };
  }

  const tornadoes: TornadoInput[] = raws.map((r, i) => ({
    name: nameFor(
      { coords: r.coords, start: r.start, ef: r.ef, eventId: r.attrs.event_id },
      tornadoReports,
      tz,
      worst[i] ?? undefined,
    ),
    ef: r.ef,
    start: Math.round(r.start - T0),
    end: Math.round(r.end - T0),
    coords: r.coords.map(
      ([lon, lat]) =>
        [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] as [
          number,
          number,
        ],
    ),
    lengthMi: num(r.attrs.length) || undefined,
    widthYd: num(r.attrs.width) || undefined,
    maxwind: num(r.attrs.maxwind) || undefined,
    inj: num(r.attrs.injuries),
    fat: num(r.attrs.fatalities),
    ...(String(r.attrs.comments ?? "").trim()
      ? { comments: String(r.attrs.comments).trim() }
      : {}),
    ...(String(r.attrs.wfo ?? "").trim()
      ? { wfo: String(r.attrs.wfo).trim() }
      : {}),
  }));

  if (tornadoes.length === 0) {
    notes.push(
      "No surveyed tornadoes were found near this route on this date.",
    );
  }

  // --- the surveyed contours: the real swath shape ---
  say(0.65, "Fetching the damage contours");
  const polyRows = raws.length
    ? await queryLayer(
        LAYER.polygons,
        wide,
        from,
        to,
        "objectid,efscale",
        true,
        f,
        opts.signal,
      )
    : [];

  const contours: DamageContour[] = [];
  for (const row of polyRows) {
    const rings = (row.geometry?.rings ?? []) as [number, number][][];
    for (const ring of rings) {
      if (ring.length < 4) continue;
      const mid = ring[Math.floor(ring.length / 2)]!;
      const ti = nearestTrack(mid[1], mid[0], provisional);
      if (ti < 0) continue;
      contours.push({
        t: ti,
        ef: EF(row.attributes.efscale),
        ring: ring.map(
          ([lon, lat]) =>
            [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] as [
              number,
              number,
            ],
        ),
      });
    }
  }

  // --- hail, from the reports already in hand ---
  say(0.8, "Sorting the hail reports");
  const hail: HailReport[] = [];
  const seen = new Set<string>();
  for (const r of reports) {
    if (r.type !== "H" || !Number.isFinite(r.mag) || r.mag < MIN_HAIL_INCHES)
      continue;
    if (
      r.lon < wide.west ||
      r.lon > wide.east ||
      r.lat < wide.south ||
      r.lat > wide.north
    )
      continue;
    const t = Math.round((r.at - T0) * 10) / 10;
    // One stone gets called in by a spotter, a deputy and three people on
    // mPING. Collapse anything at the same place, size and five-minute bucket.
    const key = `${r.lat.toFixed(2)},${r.lon.toFixed(2)},${r.mag.toFixed(2)},${Math.floor(t / 300)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const place =
      r.city && r.st ? `${r.city}, ${r.st}` : r.city || r.st || "Unknown";
    hail.push([t, r.lat, r.lon, r.mag, place, r.source, r.remark]);
  }
  hail.sort((a, b) => a[0] - b[0]);

  // --- warnings ---
  /*
   * Warnings intersect the ground the chase actually covered, unpadded.
   *
   * A warning polygon is itself the better part of a degree across, so padding
   * the box generously before intersecting it counts warnings that never came
   * near anything — the 0.75-degree box returned 74 for a day with 48. A
   * quarter of a degree, about fifteen miles, keeps the warning on the storm
   * you were about to drive into and drops the one two states away.
   */
  const WARN_PAD = 0.25;
  const covered: Bbox = {
    west: Math.min(...lons) - WARN_PAD,
    south: Math.min(...lats) - WARN_PAD,
    east: Math.max(...lons) + WARN_PAD,
    north: Math.max(...lats) + WARN_PAD,
  };
  for (const r of raws) {
    for (const [lon, lat] of r.coords) {
      if (lon - WARN_PAD < covered.west) covered.west = lon - WARN_PAD;
      if (lon + WARN_PAD > covered.east) covered.east = lon + WARN_PAD;
      if (lat - WARN_PAD < covered.south) covered.south = lat - WARN_PAD;
      if (lat + WARN_PAD > covered.north) covered.north = lat + WARN_PAD;
    }
  }

  say(0.9, "Fetching the warning polygons");
  let warnings: WarningPolygonInput[] = [];
  try {
    warnings = await fetchWarnings(covered, from, to, T0, f, opts.signal);
  } catch {
    // A chase without its warning polygons is still a chase. The lane under
    // the scrub bar will simply be empty, and it says so itself.
    notes.push(
      "The warning archive could not be reached, so the warning lane is empty.",
    );
  }

  say(1, "Done");

  if (tornadoes.length) {
    const named = tornadoes.filter((t) => !/tornado, /.test(t.name)).length;
    notes.push(
      `${tornadoes.length} surveyed ${tornadoes.length === 1 ? "tornado" : "tornadoes"}, ` +
        `${damage.length.toLocaleString()} damage points, ${contours.length} contours, ` +
        `${hail.length} hail reports, ${warnings.length} warning polygons.`,
    );
    if (named < tornadoes.length) {
      notes.push(
        `${tornadoes.length - named} could not be matched to a place and are named by ` +
          "rating and time.",
      );
    }
  }

  return { tornadoes, contours, damage, hail, warnings, notes };
}

/**
 * Which tornado a damage point belongs to.
 *
 * By proximity, because the field that should answer this — `path_guid` on the
 * points layer — is null on every point I have queried. Returns -1 when
 * nothing is near enough, which drops the point rather than hanging it on
 * whichever tornado happened to be least far away.
 *
 * Distance to the *segments*, not to the vertices. Several tornadoes in this
 * data are two points several miles apart, and measuring to vertices would
 * drop every damage point along the middle of one — the exact points that
 * make up the bulk of the survey.
 */
export function nearestTrack(
  lat: number,
  lon: number,
  tornadoes: readonly { coords: [number, number][] }[],
  maxMetres = ATTRIBUTION_METRES,
): number {
  const proj = projector(lat);
  const px = proj.x(lon);
  const py = proj.y(lat);

  let best = -1;
  let bestD = maxMetres;

  for (let i = 0; i < tornadoes.length; i += 1) {
    const coords = tornadoes[i]!.coords;
    if (coords.length === 1) {
      const d = Math.hypot(
        px - proj.x(coords[0]![0]),
        py - proj.y(coords[0]![1]),
      );
      if (d < bestD) {
        bestD = d;
        best = i;
      }
      continue;
    }
    for (let k = 0; k < coords.length - 1; k += 1) {
      const a = coords[k]!;
      const b = coords[k + 1]!;
      // Cheap reject before the real one: if both ends of this segment are
      // further away in latitude alone than the best so far, the segment
      // cannot beat it.
      const dyA = Math.abs(a[1] - lat) * 110_574;
      const dyB = Math.abs(b[1] - lat) * 110_574;
      if (dyA > bestD && dyB > bestD) continue;

      const d = pointToSegment(
        px,
        py,
        proj.x(a[0]),
        proj.y(a[1]),
        proj.x(b[0]),
        proj.y(b[1]),
      );
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}

async function fetchWarnings(
  bbox: Bbox,
  from: Date,
  to: Date,
  T0: number,
  f: typeof fetch,
  signal?: AbortSignal,
): Promise<WarningPolygonInput[]> {
  const qs = new URLSearchParams();
  qs.set("begints", from.toISOString().slice(0, 19) + "Z");
  qs.set("endts", to.toISOString().slice(0, 19) + "Z");
  qs.append("ph", "TO");
  qs.append("ph", "SV");
  qs.set("only_new", "true");

  const data = (await getJson(`${SBW}?${qs}`, f, signal)) as {
    features?: {
      properties: Record<string, unknown>;
      geometry: Record<string, unknown>;
    }[];
  };

  const out: WarningPolygonInput[] = [];
  for (const feat of data.features ?? []) {
    const p = feat.properties;
    const g = feat.geometry as { type: string; coordinates: unknown };
    const rings: [number, number][][] =
      g.type === "Polygon"
        ? [(g.coordinates as [number, number][][])[0]!]
        : g.type === "MultiPolygon"
          ? (g.coordinates as [number, number][][][]).map((poly) => poly[0]!)
          : [];

    for (const ring of rings) {
      const rlons = ring.map((c) => c[0]);
      const rlats = ring.map((c) => c[1]);
      if (Math.max(...rlons) < bbox.west || Math.min(...rlons) > bbox.east)
        continue;
      if (Math.max(...rlats) < bbox.south || Math.min(...rlats) > bbox.north)
        continue;

      const begin =
        Date.parse(String(p.utc_polygon_begin ?? p.utc_issue ?? "")) / 1000;
      const end =
        Date.parse(String(p.utc_polygon_end ?? p.utc_expire ?? "")) / 1000;
      if (!Number.isFinite(begin) || !Number.isFinite(end)) continue;

      out.push({
        kind:
          p.phenomena !== "TO"
            ? "severe"
            : p.is_emergency || p.tornadodamagetag === "CATASTROPHIC"
              ? "emergency"
              : "tornado",
        from: Math.round((begin - T0) * 10) / 10,
        to: Math.round((end - T0) * 10) / 10,
        label: String(p.event_label ?? "Warning"),
        wfo: String(p.wfo ?? ""),
        id: String(p.product_id ?? ""),
        where: String(p.locations ?? ""),
        ring: ring.map(
          ([lon, lat]) =>
            [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] as [
              number,
              number,
            ],
        ),
      });
    }
  }
  return out;
}

/** What a chaser would call a stone this big — re-exported so the UI has one import. */
export { hailName };

/** What a chaser sees before drawing a route on a chosen day. */
export interface DayStorms {
  tracks: { ef: string; coords: [number, number][] }[];
  reports: {
    kind: "tornado" | "funnel" | "hail" | "wind";
    lat: number;
    lon: number;
  }[];
}

/** LSR type codes a chase map shows, by what they are. */
const DAY_KIND: Record<string, DayStorms["reports"][number]["kind"]> = {
  T: "tornado",
  C: "funnel",
  H: "hail",
  G: "wind",
  D: "wind",
};

/**
 * Every surveyed tornado track and storm report of one convective day (12 UTC to 12 UTC,
 * the day SPC and chasers count), across the lower 48: the map a route is drawn over when
 * the chaser picks the date first.
 */
export async function dayStorms(
  day: string,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<DayStorms> {
  const f = opts.fetchImpl ?? fetch;
  const from = new Date(`${day}T12:00:00Z`);
  const to = new Date(from.getTime() + 86_400_000);
  const us: Bbox = { west: -125, south: 24, east: -66, north: 50 };
  const [lines, lsr] = await Promise.all([
    queryLayer(
      LAYER.lines,
      us,
      from,
      to,
      "efscale,starttime",
      true,
      f,
      opts.signal,
    ),
    fetchLsr(from, to, f, opts.signal),
  ]);
  const t0 = from.getTime();
  const t1 = to.getTime();
  const tracks: DayStorms["tracks"] = [];
  for (const row of lines) {
    const start = num(row.attributes.starttime, NaN);
    // The survey query pads a day either side; keep this day's tornadoes.
    if (Number.isFinite(start) && (start < t0 || start >= t1)) continue;
    const coords = ((row.geometry?.paths ?? []) as [number, number][][])
      .flat()
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (coords.length >= 2)
      tracks.push({ ef: EF(row.attributes.efscale), coords });
  }
  const reports = lsr.flatMap((r) => {
    const kind = DAY_KIND[r.type];
    return kind ? [{ kind, lat: r.lat, lon: r.lon }] : [];
  });
  return { tracks, reports: reports.slice(0, 4000) };
}
