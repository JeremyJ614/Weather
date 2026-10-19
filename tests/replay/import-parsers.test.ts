// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  guessColumns,
  parseCsv,
  parseGeoJson,
  parseGoogleTimeline,
  parseGpx,
  parseKml,
  parseTcx,
  parseTrack,
  splitCsvLine,
} from "@/features/replay/import/parsers";
import { ImportError } from "@/features/replay/import/types";

/**
 * ImportError keeps the hint separate from the message so the UI can render it
 * as secondary text. `toThrow` only sees the message, so assert on both.
 */
function catchImport(fn: () => unknown): ImportError {
  try {
    fn();
  } catch (e) {
    return e as ImportError;
  }
  throw new Error("Expected that to throw an ImportError");
}

const gpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Indian Lake chase</name></metadata>
  <trk><name>Indian Lake chase</name><trkseg>
    <trkpt lat="40.4000" lon="-83.9000"><time>2024-03-14T22:26:55Z</time></trkpt>
    <trkpt lat="40.4100" lon="-83.9100"><time>2024-03-14T22:27:55Z</time></trkpt>
    <trkpt lat="40.4200" lon="-83.9200"><time>2024-03-14T22:28:55Z</time></trkpt>
    <trkpt lat="40.4300" lon="-83.9300"></trkpt>
  </trkseg></trk>
</gpx>`;

describe("GPX", () => {
  it("reads points with timestamps and keeps the name", () => {
    const r = parseGpx(gpx);
    expect(r.fixes).toHaveLength(3);
    expect(r.name).toBe("Indian Lake chase");
    expect(r.format).toBe("GPX");
  });

  it("says how many points it had to skip rather than dropping them quietly", () => {
    expect(parseGpx(gpx).notes.join(" ")).toMatch(/1 points had no timestamp/);
  });

  it("converts times to epoch seconds", () => {
    expect(parseGpx(gpx).fixes[0]![0]).toBe(
      Math.round(Date.parse("2024-03-14T22:26:55Z") / 1000),
    );
  });

  it("refuses a file with no usable fixes, and says why", () => {
    const empty = '<?xml version="1.0"?><gpx><trk><trkseg/></trk></gpx>';
    const err = catchImport(() => parseGpx(empty));
    expect(err).toBeInstanceOf(ImportError);
    expect(err.message).toMatch(/no GPS fixes with timestamps/);
    expect(err.hint).toMatch(/with timestamps/);
  });

  it("rejects malformed XML with a readable message", () => {
    expect(() => parseGpx("<gpx><trk>")).toThrow(/not valid XML|no GPS fixes/);
  });
});

describe("KML", () => {
  const track = `<?xml version="1.0"?>
  <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
    <Document><name>March 10</name><Placemark><gx:Track>
      <when>2026-03-10T20:00:00Z</when><gx:coord>-88.0 41.0 200</gx:coord>
      <when>2026-03-10T20:01:00Z</when><gx:coord>-88.1 41.1 210</gx:coord>
    </gx:Track></Placemark></Document>
  </kml>`;

  it("reads a gx:Track", () => {
    const r = parseKml(track);
    expect(r.fixes).toHaveLength(2);
    expect(r.fixes[0]).toEqual([
      Math.round(Date.parse("2026-03-10T20:00:00Z") / 1000),
      41.0,
      -88.0,
    ]);
  });

  it("explains what to do when a KML has a path but no times", () => {
    const line = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Placemark>
      <LineString><coordinates>-88,41,0 -88.1,41.1,0</coordinates></LineString></Placemark></kml>`;
    expect(() => parseKml(line)).toThrow(/no timestamps/);
  });
});

describe("TCX", () => {
  it("reads Garmin trackpoints", () => {
    const tcx = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity><Lap><Track>
      <Trackpoint><Time>2024-03-14T22:26:55Z</Time>
        <Position><LatitudeDegrees>40.4</LatitudeDegrees><LongitudeDegrees>-83.9</LongitudeDegrees></Position>
      </Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    expect(parseTcx(tcx).fixes).toHaveLength(1);
  });
});

describe("Google Timeline", () => {
  it("reads the Records.json shape", () => {
    const json = JSON.stringify({
      locations: [
        {
          latitudeE7: 404000000,
          longitudeE7: -839000000,
          timestampMs: "1710455215000",
        },
        {
          latitudeE7: 404100000,
          longitudeE7: -839100000,
          timestamp: "2024-03-14T22:27:55Z",
        },
      ],
    });
    const r = parseGoogleTimeline(json);
    expect(r.fixes).toHaveLength(2);
    expect(r.fixes[0]![1]).toBeCloseTo(40.4, 5);
    expect(r.notes.join(" ")).toMatch(/sparser/);
  });

  it("points at the right Takeout file when given the wrong one", () => {
    expect(() => parseGoogleTimeline('{"somethingElse":[]}')).toThrow(
      /Google Timeline export/,
    );
  });
});

describe("GeoJSON", () => {
  it("reads a LineString with coordTimes", () => {
    const gj = JSON.stringify({
      type: "Feature",
      properties: {
        coordTimes: ["2024-03-14T22:26:55Z", "2024-03-14T22:27:55Z"],
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [-83.9, 40.4],
          [-83.91, 40.41],
        ],
      },
    });
    expect(parseGeoJson(gj).fixes).toHaveLength(2);
  });
});

describe("CSV", () => {
  it("guesses ordinary column names", () => {
    expect(guessColumns(["Time", "Latitude", "Longitude"])).toEqual({
      time: "Time",
      lat: "Latitude",
      lon: "Longitude",
    });
    expect(guessColumns(["utc_timestamp", "lat", "lng"])).toEqual({
      time: "utc_timestamp",
      lat: "lat",
      lon: "lng",
    });
  });

  it("reads ISO times, epoch seconds and epoch milliseconds alike", () => {
    const iso = parseCsv(
      "time,lat,lon\n2024-03-14T22:26:55Z,40.4,-83.9\n2024-03-14T22:27:55Z,40.41,-83.91",
    );
    const secs = parseCsv(
      "time,lat,lon\n1710455215,40.4,-83.9\n1710455275,40.41,-83.91",
    );
    const ms = parseCsv(
      "time,lat,lon\n1710455215000,40.4,-83.9\n1710455275000,40.41,-83.91",
    );
    expect(iso.fixes[0]![0]).toBe(secs.fixes[0]![0]);
    expect(ms.fixes[0]![0]).toBe(secs.fixes[0]![0]);
  });

  it("honours a column map the user supplied", () => {
    const csv =
      "a,b,c\n2024-03-14T22:26:55Z,40.4,-83.9\n2024-03-14T22:27:55Z,40.5,-83.8";
    const r = parseCsv(csv, { time: "a", lat: "b", lon: "c" });
    expect(r.fixes).toHaveLength(2);
  });

  it("lists the columns it found when it cannot guess", () => {
    const err = catchImport(() => parseCsv("alpha,beta\n1,2"));
    expect(err.message).toMatch(/Could not tell which columns/);
    expect(err.hint).toMatch(/alpha, beta/);
  });

  it("handles quoted cells containing commas", () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
    expect(splitCsvLine('"say ""hi""",2')).toEqual(['say "hi"', "2"]);
  });
});

describe("shared behaviour", () => {
  it("sorts fixes by time no matter what order the file had them in", () => {
    const csv = "time,lat,lon\n1710455275,40.41,-83.91\n1710455215,40.4,-83.9";
    const r = parseCsv(csv);
    expect(r.fixes[0]![0]).toBeLessThan(r.fixes[1]![0]);
  });

  it("drops duplicate timestamps and says so", () => {
    const csv =
      "time,lat,lon\n1710455215,40.4,-83.9\n1710455215,40.5,-83.8\n1710455275,40.41,-83.91";
    const r = parseCsv(csv);
    expect(r.fixes).toHaveLength(2);
    expect(r.notes.join(" ")).toMatch(/1 duplicate/);
  });

  it("throws out null island, which is always a logger artefact", () => {
    const csv = "time,lat,lon\n1710455215,0,0\n1710455275,40.41,-83.91";
    expect(parseCsv(csv).fixes).toHaveLength(1);
  });

  it("throws out impossible coordinates", () => {
    const csv = "time,lat,lon\n1710455215,999,-83.9\n1710455275,40.41,-83.91";
    expect(parseCsv(csv).fixes).toHaveLength(1);
  });
});

describe("format detection", () => {
  it("picks the parser from the extension", () => {
    expect(parseTrack("chase.gpx", gpx).format).toBe("GPX");
    expect(
      parseTrack(
        "t.csv",
        "time,lat,lon\n1710455215,40.4,-83.9\n1710455275,40.5,-83.8",
      ).format,
    ).toBe("CSV");
  });

  it("picks it from the contents when the extension lies", () => {
    expect(parseTrack("mystery.dat", gpx).format).toBe("GPX");
  });

  it("names the formats it does read when handed one it does not", () => {
    const err = catchImport(() => parseTrack("track.fit", "binary junk"));
    expect(err.message).toMatch(/does not read \.fit files/);
    expect(err.hint).toMatch(/GPX, KML, TCX/);
  });
});
