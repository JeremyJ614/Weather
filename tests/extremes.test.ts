import { describe, expect, it } from "vitest";
import { dedupe, parseRer, typeOf } from "@/lib/extremes/records";

const SENTENCE = `RECORD EVENT REPORT
NATIONAL WEATHER SERVICE BISMARCK, ND
0738 PM CDT FRI OCT 23 2026

...RECORD HIGH TEMPERATURE SET AT BISMARCK ND...

A RECORD HIGH TEMPERATURE OF 78 DEGREES WAS SET AT BISMARCK ND TODAY.
THIS BREAKS THE OLD RECORD OF 77 DEGREES SET IN 2014.
`;
const TABLE = `RECORD EVENT REPORT...PRELIMINARY
NATIONAL WEATHER SERVICE SAN DIEGO CA
555 PM PDT FRI OCT 23 2026

...LOWEST MAXIMUM TEMPERATURE RECORDS BROKEN OR TIED ON OCT 23 2026 ...

LOCATION             NEW RECORD         OLD RECORD        PERIOD OF RECORD

SAN JACINTO              68    TIED     68 IN 2010              1948
RAMONA                   65             67 IN 2022              1974
`;
const PROSE = `RECORD EVENT REPORT
NATIONAL WEATHER SERVICE HANFORD
200 AM PDT FRI OCT 23 2026

ON THURSDAY, OCTOBER 22ND, 2026, THE AUTOMATED SURFACE OBSERVATION
STATION (AS0S) AT MERCED REGIONAL AIRPORT (KMCE) RECORDED
PRECIPITATION OF 1.40 INCHES WHICH BREAKS THE PREVIOUS RECORD HIGH
DAILY PRECIPITATION OF 0.37 INCH THAT WAS LAST SET FOR THE DATE IN
1973.
`;

describe("NWS record reports", () => {
  it("reads the sentence form on the office's own date", () => {
    // Issued 00:38 UTC on the 24th, which is still the 23rd in Bismarck.
    expect(parseRer(SENTENCE, "2026-10-24T00:38:00Z")).toEqual([
      {
        type: "high",
        place: "Bismarck",
        st: "ND",
        value: "78",
        unit: "°F",
        old: "77",
        oldYear: "2014",
        tied: false,
        day: "2026-10-23",
        office: "Bismarck",
      },
    ]);
  });

  it("reads table rows, ties included", () => {
    const r = parseRer(TABLE, "2026-10-24T00:55:00Z");
    expect(
      r.map((x) => [x.type, x.place, x.st, x.value, x.tied, x.day]),
    ).toEqual([
      ["coldHigh", "San Jacinto", "CA", "68", true, "2026-10-23"],
      ["coldHigh", "Ramona", "CA", "65", false, "2026-10-23"],
    ]);
  });

  it("reads the prose form, with the office's state when the text has none", () => {
    const [r] = parseRer(PROSE, "2026-10-23T09:00:00Z", "CA");
    expect(r).toMatchObject({
      type: "rain",
      place: "Merced Regional Airport",
      st: "CA",
      value: "1.40",
      old: "0.37",
      oldYear: "1973",
      day: "2026-10-22",
    });
  });

  it("names each kind of record", () => {
    expect(typeOf("LOWEST MAXIMUM TEMPERATURE")).toBe("coldHigh");
    expect(typeOf("HIGH MINIMUM TEMPERATURE")).toBe("warmLow");
    expect(typeOf("DAILY MAXIMUM RAINFALL")).toBe("rain");
    expect(typeOf("LOW TEMPERATURE")).toBe("low");
  });

  it("keeps the latest report of a corrected record", () => {
    const a = parseRer(SENTENCE, "2026-10-24T00:38:00Z");
    const b = parseRer(
      SENTENCE.replace("78 DEGREES", "79 DEGREES"),
      "2026-10-24T01:38:00Z",
    );
    expect(dedupe([...a, ...b]).map((x) => x.value)).toEqual(["79"]);
  });
});
