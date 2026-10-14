import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseStateCsv } from "@/lib/hazards/data";
import { hazardKind } from "@/lib/hazards/style";

describe("hazards", () => {
  it("sorts CPC labels into kinds", () => {
    expect(hazardKind("Much Below Normal Temperatures")).toBe("cold");
    expect(hazardKind("Excessive Heat")).toBe("heat");
    expect(hazardKind("Flooding Possible")).toBe("flood");
    expect(hazardKind("Heavy Precipitation")).toBe("rain");
    expect(hazardKind("Rapid Onset Drought")).toBe("drought");
    expect(hazardKind("High Winds")).toBe("wind");
    expect(hazardKind("Heavy Snow")).toBe("snow");
  });
  it("reads USDM state statistics newest first", () => {
    const rows = parseStateCsv(
      "MapDate,StateAbbreviation,None,D0,D1,D2,D3,D4,ValidStart,ValidEnd,StatisticFormatID\n20260929,OH,99.49,0.51,0.00,0.00,0.00,0.00,2026-09-29,2026-10-05,2\n20261006,OH,90,6,4,0,0,0,2026-10-06,2026-10-12,2",
    );
    expect(rows[0]).toEqual({ week: "20261006", none: 90, d: [6, 4, 0, 0, 0] });
  });
});
