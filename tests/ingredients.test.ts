import { describe, expect, it } from "vitest";
import {
  capeLevel,
  liLevel,
  stp,
  swti,
  threatLevel,
} from "@/lib/ingredients/calc";

describe("storm ingredients (VIP)", () => {
  it("scores a classic tornado day high and a quiet day benign", () => {
    const big = swti({ cape: 3500, srh: 420, shear: 55, li: -7, dew: 21 });
    expect(big.score).toBe(24 + 25 + 16 + 10 + 6);
    expect(big.tornado).toBe("high");
    expect(big.hail).toBe("large");
    expect(big.wind).toBe("significant");
    expect(threatLevel(big.score).level).toBe("Violent");
    const calm = swti({ cape: 100, srh: 20, shear: 8, li: 4, dew: 5 });
    expect(calm.score).toBe(0);
    expect(threatLevel(0).level).toBe("Benign");
  });

  it("keeps VIP's STP and labels", () => {
    expect(stp(1500, 150, 20, -4)).toBe(1);
    expect(stp(3000, 300, 40, -6)).toBe(6);
    expect(stp(3000, 300, 10, -6)).toBe(0);
    expect(capeLevel(2600).label).toBe("Very high");
    expect(liLevel(-5).label).toBe("Unstable");
  });
});
