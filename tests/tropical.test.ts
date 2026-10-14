import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { binLayers, parseChance, parseTwo } from "@/lib/tropical/nhc";
import { classLabel, compass, mph, tierOf } from "@/lib/tropical/style";

const TWO = `000
ABNT20 KNHC 141146
TWOAT

Tropical Weather Outlook
NWS National Hurricane Center Miami FL
800 AM EDT Wed Oct 14 2026

For the North Atlantic...Caribbean Sea and the Gulf of America:

1. Southwestern Caribbean Sea (AL98):
A broad area of low pressure is producing disorganized showers.
Gradual development is possible.
* Formation chance through 48 hours...low...20 percent.
* Formation chance through 7 days...medium...50 percent.

2. Central Atlantic:
A tropical wave is producing limited activity.
* Formation chance through 48 hours...low...near 0 percent.
* Formation chance through 7 days...low...10 percent.

$$
Forecaster Smith`;

describe("tropical", () => {
  it("parses the text outlook into systems with chances", () => {
    const t = parseTwo(TWO);
    expect(t.intro).toContain("North Atlantic");
    expect(t.items).toHaveLength(2);
    expect(t.items[0]).toMatchObject({
      title: "Southwestern Caribbean Sea (AL98)",
      two: 20,
      seven: 50,
    });
    expect(t.items[0].body).toContain("Gradual development");
    expect(t.items[1]).toMatchObject({ two: 0, seven: 10 });
  });
  it("maps storm bins to NHC map layers", () => {
    expect(binLayers("AT1")?.cone).toBe(8);
    expect(binLayers("EP1")).toMatchObject({
      points: 136,
      track: 137,
      cone: 138,
      pastTrack: 142,
    });
    expect(binLayers("CP5")?.cone).toBe(264 + 4 * 26 + 4);
    expect(binLayers("WP1")).toBeNull();
  });
  it("buckets winds and names storms", () => {
    expect(parseChance("near 0 percent")).toBe(0);
    expect(tierOf(40).key).toBe("TS");
    expect(tierOf(95).key).toBe("C2");
    expect(classLabel("HU", 95)).toBe("Category 2 Hurricane");
    expect(mph(40)).toBe(46);
    expect(compass(320)).toBe("NW");
  });
});

import { framesFrom } from "@/lib/tropical/sat";
describe("satellite frames", () => {
  it("keeps the newest frames of one size, oldest first", () => {
    const html = ["20262870340", "20262870350", "20262870400"]
      .flatMap((t) => [
        `<a href="${t}_G19-taw-GEOCOLOR-900x540.jpg">`,
        `<a href="${t}_G19-taw-GEOCOLOR-1800x1080.jpg">`,
      ])
      .join("");
    const f = framesFrom(html, "https://x", "900x540", 2, 1);
    expect(f.map((x) => x.at)).toEqual([
      "2026-10-14T03:50:00.000Z",
      "2026-10-14T04:00:00.000Z",
    ]);
    expect(f[1].url).toBe("https://x/20262870400_G19-taw-GEOCOLOR-900x540.jpg");
  });
});
