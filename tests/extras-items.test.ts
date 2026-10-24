import { describe, expect, it } from "vitest";
import { cleanItems, stateOf } from "@/lib/extras/items";
import { cleanDefaults } from "@/lib/settings";

describe("Extras switches", () => {
  it("keeps known items and states, drops the rest", () => {
    expect(
      cleanItems({
        stp: "off",
        morph: "hidden",
        tor: "on",
        bogus: "off",
        scp: "maybe",
      }),
    ).toEqual({ stp: "off", morph: "hidden" });
    expect(cleanItems(null)).toEqual({});
    expect(cleanItems(["stp"])).toEqual({});
  });

  it("treats anything unset as on", () => {
    expect(stateOf({ stp: "off" }, "stp")).toBe("off");
    expect(stateOf({}, "rot")).toBe("on");
  });

  it("reads the switches with the site defaults", () => {
    const d = cleanDefaults([
      { key: "extras_items", value: { ltg: "hidden" } },
    ]);
    expect(d.extras).toEqual({ ltg: "hidden" });
    expect(cleanDefaults([]).extras).toEqual({});
  });
});
