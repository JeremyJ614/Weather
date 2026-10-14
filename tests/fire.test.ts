import { describe, expect, it } from "vitest";
import { containKey, miles } from "@/lib/fire/style";

describe("fire", () => {
  it("buckets containment", () => {
    expect(containKey(null)).toBe("unknown");
    expect(containKey(10)).toBe("low");
    expect(containKey(50)).toBe("mid");
    expect(containKey(95)).toBe("high");
  });
  it("measures miles", () => {
    expect(
      Math.round(
        miles({ lat: 34.05, lon: -118.24 }, { lat: 37.77, lon: -122.42 }),
      ),
    ).toBe(347);
  });
});
