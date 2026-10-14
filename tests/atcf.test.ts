import { describe, expect, it } from "vitest";
import {
  addHours,
  battle,
  coord,
  latestTracks,
  nm,
  parseA,
  parseB,
  rank,
} from "@/lib/tropical/atcf";

const A = [
  "EP, 20, 2026101000, 03, OFCL,   0, 150N, 1000W,  50, 1000, XX,  34",
  "EP, 20, 2026101000, 03, OFCL,   0, 150N, 1000W,  50, 1000, XX,  50",
  "EP, 20, 2026101000, 03, OFCL,  48, 160N, 1020W,  70,  990, XX,  34",
  "EP, 20, 2026101000, 03, AVNO,   0, 150N, 1000W,  45, 1002, XX,  34",
  "EP, 20, 2026101000, 03, AVNO,  48, 170N, 1040W,  60,  995, XX,  34",
  "EP, 20, 2026101012, 03, OFCL,   0, 155N, 1010W,  55,  998, XX,  34",
  "EP, 20, 2026101012, 03, OFCL,  48, 165N, 1030W,  75,  985, XX,  34",
  "EP, 20, 2026101012, 03, AVNO,  48, 160N, 1030W,  70,  990, XX,  34",
  "EP, 20, 2026101012, 03, AP01,  48, 160N, 1030W,  70,  990, XX,  34",
].join("\n");
const B = [
  "EP, 20, 2026101200, , BEST,   0, 160N, 1020W,  65,  992, HU",
  "EP, 20, 2026101212, , BEST,   0, 162N, 1032W,  72,  988, HU",
].join("\n");

describe("ATCF battle", () => {
  it("reads coordinates and adds hours", () => {
    expect(coord("960W")).toBe(-96);
    expect(coord("121N")).toBeCloseTo(12.1);
    expect(addHours("2026103118", 48)).toBe("2026110218");
  });
  it("keeps roster rows once per model, cycle and hour", () => {
    const rows = parseA(A);
    expect(rows).toHaveLength(7);
    expect(rows.some((r) => r.tech === "AP01")).toBe(false);
  });
  it("scores against the best track and ranks", () => {
    const rows = parseA(A);
    const s = battle(rows, parseB(B));
    const ofcl = s.find((x) => x.tech === "OFCL")!;
    expect(ofcl.track[48]?.n).toBe(2);
    expect(ofcl.track[48]?.err).toBeCloseTo(
      (0 + nm({ lat: 16.5, lon: -103 }, { lat: 16.2, lon: -103.2 })) / 2,
      3,
    );
    expect(ofcl.wins + s.find((x) => x.tech === "AVNO")!.wins).toBe(2);
    expect(rank(s)[0].tech).toBe("OFCL");
    expect(latestTracks(rows).find((t) => t.tech === "OFCL")?.dtg).toBe(
      "2026101012",
    );
  });
});
