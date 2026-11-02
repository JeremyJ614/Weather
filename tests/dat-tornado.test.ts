import { describe, expect, it } from "vitest";
import { DAT_TORNADOES, isDatTornado } from "@/lib/dat/tornado";

describe("NWS Damage Assessment Toolkit damage lines", () => {
  it("leaves out straight-line wind and hail paths", () => {
    expect(isDatTornado("TSTM/Wind")).toBe(false);
    expect(isDatTornado(" tstm/wind")).toBe(false);
  });
  it("keeps every tornado, rated or not", () => {
    for (const ef of [
      "EF0",
      "EF3",
      "EF5",
      "EFU",
      "UNKNOWN",
      "N/A",
      "",
      null,
      undefined,
    ])
      expect(isDatTornado(ef)).toBe(true);
  });
  it("asks the service for tornadoes only", () => {
    expect(DAT_TORNADOES).toBe("(efscale IS NULL OR efscale NOT LIKE 'TSTM%')");
  });
});
