import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));
import { linePath, warnTag, warnTier } from "@/lib/history/data";
import { stateAt } from "@/lib/history/states";
import { project } from "@/lib/map/usAlbers";

describe("severe weather history", () => {
  it("ranks warning severity from IEM's impact tags", () => {
    expect(warnTier({})).toBe(0);
    expect(warnTier({ tornadotag: "OBSERVED" })).toBe(1);
    expect(warnTier({ damagetag: "CONSIDERABLE" })).toBe(1);
    expect(warnTier({ max_damagetag: "DESTRUCTIVE" })).toBe(2);
    expect(warnTier({ is_pds: true })).toBe(2);
    expect(warnTier({ is_emergency: true })).toBe(3);
  });
  it("projects a track onto the national canvas", () => {
    const d = linePath({
      type: "LineString",
      coordinates: [
        [-97.5, 35.3],
        [-97.2, 35.4],
      ],
    });
    expect(d).toMatch(/^M[\d.]+ [\d.]+L[\d.]+ [\d.]+$/);
    expect(linePath({ type: "LineString", coordinates: [[-97.5, 35.3]] })).toBe(
      "",
    );
  });
  it("names the strongest tag a warning carries", () => {
    expect(warnTag({})).toBeUndefined();
    expect(warnTag({ tornadotag: "OBSERVED" })).toBe("observed");
    expect(warnTag({ damagetag: "CONSIDERABLE" })).toBe("considerable");
    expect(warnTag({ max_floodtag_damage: "CATASTROPHIC" })).toBe(
      "destructive",
    );
    expect(warnTag({ is_pds: true, damagetag: "CONSIDERABLE" })).toBe("pds");
    expect(warnTag({ is_emergency: true, is_pds: true })).toBe("emergency");
  });
  it("finds the state a track starts in", () => {
    const at = (lon: number, lat: number) => {
      const { x, y } = project(lon, lat);
      return stateAt(x, y);
    };
    expect(at(-97.49, 35.34)).toBe("OK"); // Moore
    expect(at(-94.51, 37.08)).toBe("MO"); // Joplin
    expect(at(-87.57, 33.21)).toBe("AL"); // Tuscaloosa
    expect(at(-88.64, 36.74)).toBe("KY"); // Mayfield
    expect(at(-90.0, 25.0)).toBe(""); // the Gulf
  });
  it("keeps track detail when asked", () => {
    const g = {
      type: "LineString",
      coordinates: [
        [-97.5, 35.3],
        [-97.49, 35.302],
        [-97.2, 35.4],
      ],
    };
    expect(linePath(g, 0.03, 2).split("L").length).toBe(3);
    expect(linePath(g).split("L").length).toBe(2);
  });
});
