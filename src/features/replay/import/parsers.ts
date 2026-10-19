import {
  ImportError,
  type ColumnMap,
  type Fix,
  type ParsedTrack,
} from "./types";

/**
 * Track importers.
 *
 * Every format a chaser might already have, because a format we do not read is
 * a person who cannot use the app at all. Each parser returns the same shape and
 * reports what it had to guess or discard rather than silently dropping fixes.
 */

const MIN_LAT = -90,
  MAX_LAT = 90,
  MIN_LON = -180,
  MAX_LON = 180;

function validFix(t: number, lat: number, lon: number): boolean {
  return (
    Number.isFinite(t) &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= MIN_LAT &&
    lat <= MAX_LAT &&
    lon >= MIN_LON &&
    lon <= MAX_LON &&
    // 0,0 is in the Atlantic. It is always a null island artefact, never a chase.
    !(lat === 0 && lon === 0)
  );
}

function finish(
  fixes: Fix[],
  format: string,
  notes: string[],
  name?: string,
): ParsedTrack {
  if (fixes.length === 0) {
    throw new ImportError(
      "That file has no GPS fixes with timestamps in it.",
      'A replay needs times as well as positions. If your app can export "with timestamps", try that.',
    );
  }
  fixes.sort((a, b) => a[0] - b[0]);
  // Drop exact duplicate timestamps; two positions at one instant is not a track.
  const out: Fix[] = [];
  let dupes = 0;
  for (const f of fixes) {
    if (out.length && out[out.length - 1]![0] === f[0]) {
      dupes += 1;
      continue;
    }
    out.push(f);
  }
  if (dupes)
    notes.push(`${dupes.toLocaleString()} duplicate timestamps ignored.`);
  return { fixes: out, format, notes, name };
}

const parseTime = (raw: string): number => {
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? NaN : Math.round(t / 1000);
};

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new ImportError(
      "That file is not valid XML.",
      "It may have been truncated on export.",
    );
  }
  return doc;
}

/** GPX — Geo Tracker, Strava, Garmin, and most phone loggers. */
export function parseGpx(text: string): ParsedTrack {
  const doc = xml(text);
  const notes: string[] = [];
  const fixes: Fix[] = [];
  let missingTime = 0;

  const pts = doc.querySelectorAll("trkpt, rtept, wpt");
  for (const pt of pts) {
    const lat = Number(pt.getAttribute("lat"));
    const lon = Number(pt.getAttribute("lon"));
    const timeEl = pt.querySelector("time");
    if (!timeEl?.textContent) {
      missingTime += 1;
      continue;
    }
    const t = parseTime(timeEl.textContent);
    if (validFix(t, lat, lon)) fixes.push([t, lat, lon]);
  }
  if (missingTime)
    notes.push(
      `${missingTime.toLocaleString()} points had no timestamp and were skipped.`,
    );

  const name = doc
    .querySelector("trk > name, metadata > name")
    ?.textContent?.trim();
  return finish(fixes, "GPX", notes, name || undefined);
}

/** TCX — Garmin Training Center, what some head units still export. */
export function parseTcx(text: string): ParsedTrack {
  const doc = xml(text);
  const fixes: Fix[] = [];
  for (const tp of doc.querySelectorAll("Trackpoint")) {
    const t = parseTime(tp.querySelector("Time")?.textContent ?? "");
    const lat = Number(tp.querySelector("LatitudeDegrees")?.textContent);
    const lon = Number(tp.querySelector("LongitudeDegrees")?.textContent);
    if (validFix(t, lat, lon)) fixes.push([t, lat, lon]);
  }
  return finish(fixes, "TCX", []);
}

/**
 * KML — Google Earth, and what several chase apps export.
 *
 * Handles both shapes: gx:Track, which pairs a `when` with a `gx:coord`, and a
 * plain LineString, which has coordinates but no times at all.
 */
export function parseKml(text: string): ParsedTrack {
  const doc = xml(text);
  const notes: string[] = [];
  const fixes: Fix[] = [];

  const whens = Array.from(doc.getElementsByTagNameNS("*", "when"));
  const coords = Array.from(doc.getElementsByTagNameNS("*", "coord"));
  if (whens.length && whens.length === coords.length) {
    for (let i = 0; i < whens.length; i += 1) {
      const t = parseTime(whens[i]!.textContent ?? "");
      const parts = (coords[i]!.textContent ?? "").trim().split(/\s+/);
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (validFix(t, lat, lon)) fixes.push([t, lat, lon]);
    }
    return finish(
      fixes,
      "KML (gx:Track)",
      notes,
      doc
        .querySelector("Placemark > name, Document > name")
        ?.textContent?.trim() || undefined,
    );
  }

  const line = doc.querySelector("LineString > coordinates");
  if (line?.textContent) {
    throw new ImportError(
      "That KML has a path but no timestamps.",
      "A replay needs to know when you were at each point. Export a gx:Track, or use the GPX from the same app.",
    );
  }

  return finish(fixes, "KML", notes);
}

/** Google Timeline — the JSON from Takeout. */
export function parseGoogleTimeline(text: string): ParsedTrack {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("That file is not valid JSON.");
  }
  const fixes: Fix[] = [];
  const notes: string[] = [];

  // Takeout has used several shapes over the years; handle the common ones.
  const root = data as Record<string, unknown>;
  const raw = (root.locations ?? root.rawSignals ?? root.timelineObjects) as
    unknown[] | undefined;
  if (!Array.isArray(raw)) {
    throw new ImportError(
      "That does not look like a Google Timeline export.",
      "Look for Records.json or a semantic location history file inside your Takeout archive.",
    );
  }

  const pushIfValid = (t: number, latE7: number, lonE7: number) => {
    const lat = latE7 / 1e7;
    const lon = lonE7 / 1e7;
    if (validFix(t, lat, lon)) fixes.push([t, lat, lon]);
  };

  for (const entry of raw) {
    const e = entry as Record<string, unknown>;
    // Records.json
    if (e.latitudeE7 != null && e.longitudeE7 != null) {
      const ms = Number(e.timestampMs ?? Date.parse(String(e.timestamp ?? "")));
      pushIfValid(
        Math.round(ms / 1000),
        Number(e.latitudeE7),
        Number(e.longitudeE7),
      );
      continue;
    }
    // rawSignals
    const pos = (e.position ?? {}) as Record<string, unknown>;
    if (pos.LatLng) {
      const m = String(pos.LatLng).match(/(-?\d+\.\d+)°?,\s*(-?\d+\.\d+)°?/);
      const t = parseTime(String(pos.timestamp ?? ""));
      if (m) {
        const lat = Number(m[1]);
        const lon = Number(m[2]);
        if (validFix(t, lat, lon)) fixes.push([t, lat, lon]);
      }
    }
  }

  if (!fixes.length) {
    throw new ImportError(
      "No location records with timestamps were found in that export.",
      "Takeout splits history by month — pick the file covering your chase date.",
    );
  }
  notes.push(
    "Google Timeline records are sparser than a chase logger, so the track may look angular.",
  );
  return finish(fixes, "Google Timeline", notes);
}

/** GeoJSON — a LineString or a FeatureCollection with timestamps. */
export function parseGeoJson(text: string): ParsedTrack {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ImportError("That file is not valid JSON.");
  }
  const fixes: Fix[] = [];

  const readLine = (coords: unknown, times: unknown) => {
    if (!Array.isArray(coords)) return;
    const stamps = Array.isArray(times) ? times : null;
    coords.forEach((c, i) => {
      if (!Array.isArray(c)) return;
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      // A third ordinate is elevation in GeoJSON, but some exporters put time there.
      const t = stamps ? parseTime(String(stamps[i])) : Number(c[3] ?? c[2]);
      if (validFix(t, lat, lon)) fixes.push([t, lat, lon]);
    });
  };

  const features = (data.features as unknown[]) ?? [data];
  for (const f of features) {
    const feat = f as Record<string, unknown>;
    const geom = (feat.geometry ?? feat) as Record<string, unknown>;
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    if (geom.type === "LineString")
      readLine(geom.coordinates, props.coordTimes ?? props.times);
    if (geom.type === "MultiLineString" && Array.isArray(geom.coordinates)) {
      for (const part of geom.coordinates) readLine(part, null);
    }
  }
  return finish(fixes, "GeoJSON", []);
}

/** Guess which CSV columns hold time, latitude and longitude. */
export function guessColumns(header: string[]): Partial<ColumnMap> {
  const find = (...names: string[]) =>
    header.find((h) => names.some((n) => h.trim().toLowerCase() === n)) ??
    header.find((h) => names.some((n) => h.trim().toLowerCase().includes(n)));
  return {
    time: find("time", "timestamp", "date", "utc", "datetime"),
    lat: find("lat", "latitude", "y"),
    lon: find("lon", "lng", "long", "longitude", "x"),
  };
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** CSV, with columns either guessed or supplied by the user. */
export function parseCsv(text: string, map?: ColumnMap): ParsedTrack {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new ImportError("That CSV has no rows.");

  const header = splitCsvLine(lines[0]!);
  const cols = map ?? guessColumns(header);
  const notes: string[] = [];

  if (!cols.time || !cols.lat || !cols.lon) {
    throw new ImportError(
      "Could not tell which columns hold the time, latitude and longitude.",
      `Columns found: ${header.join(", ")}`,
    );
  }
  if (!map)
    notes.push(
      `Read ${cols.time}, ${cols.lat} and ${cols.lon}. Change them if that is wrong.`,
    );

  const iT = header.indexOf(cols.time);
  const iLa = header.indexOf(cols.lat);
  const iLo = header.indexOf(cols.lon);
  const fixes: Fix[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!);
    const rawT = cells[iT] ?? "";
    // Accept an ISO string, epoch seconds, or epoch milliseconds.
    let t = parseTime(rawT);
    if (Number.isNaN(t)) {
      const n = Number(rawT);
      if (Number.isFinite(n))
        t = n > 1e11 ? Math.round(n / 1000) : Math.round(n);
    }
    const lat = Number(cells[iLa]);
    const lon = Number(cells[iLo]);
    if (validFix(t, lat, lon)) fixes.push([t, lat, lon]);
    else skipped += 1;
  }
  if (skipped)
    notes.push(`${skipped.toLocaleString()} rows were skipped as unreadable.`);
  return finish(fixes, "CSV", notes);
}

/** Pick a parser from the file name and a look at the contents. */
export function parseTrack(
  filename: string,
  text: string,
  map?: ColumnMap,
): ParsedTrack {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const head = text.slice(0, 2000);

  if (ext === "gpx" || head.includes("<gpx")) return parseGpx(text);
  if (ext === "tcx" || head.includes("TrainingCenterDatabase"))
    return parseTcx(text);
  if (ext === "kml" || head.includes("<kml")) return parseKml(text);
  if (ext === "csv" || ext === "tsv" || ext === "txt")
    return parseCsv(text, map);
  if (ext === "json" || ext === "geojson" || head.trimStart().startsWith("{")) {
    if (
      head.includes("latitudeE7") ||
      head.includes("rawSignals") ||
      head.includes("timelineObjects")
    ) {
      return parseGoogleTimeline(text);
    }
    return parseGeoJson(text);
  }
  throw new ImportError(
    `Chase Log does not read .${ext} files yet.`,
    "GPX, KML, TCX, GeoJSON, Google Timeline JSON and CSV all work.",
  );
}

export const SUPPORTED_FORMATS =
  ".gpx,.kml,.kmz,.tcx,.json,.geojson,.csv,.tsv,.txt";
