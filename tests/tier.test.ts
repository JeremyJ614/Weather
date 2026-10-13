import { describe, expect, it } from "vitest";
import { demote, tierFromHints } from "@/lib/device/tier";

describe("device tier", () => {
  it("reads static hints", () => {
    expect(tierFromHints({ memoryGb: 8, cores: 8 })).toBe("high");
    expect(tierFromHints({ memoryGb: 4, cores: 8 })).toBe("mid");
    expect(tierFromHints({ memoryGb: 2, cores: 8 })).toBe("low");
    expect(tierFromHints({})).toBe("mid");
  });

  it("drops to low for reduced motion or data saver", () => {
    expect(tierFromHints({ memoryGb: 8, cores: 8, reducedMotion: true })).toBe(
      "low",
    );
    expect(tierFromHints({ memoryGb: 8, cores: 8, saveData: true })).toBe(
      "low",
    );
  });

  it("only ever demotes", () => {
    expect(demote("high", 24)).toBe("low");
    expect(demote("high", 40)).toBe("mid");
    expect(demote("mid", 60)).toBe("mid");
    expect(demote("low", 60)).toBe("low");
  });
});
