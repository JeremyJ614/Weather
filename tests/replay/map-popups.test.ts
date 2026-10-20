import { describe, expect, it } from "vitest";
import { describe as label, pick } from "@/features/replay/map/popups";

const f = (
  id: string,
  properties: Record<string, unknown>,
  state?: Record<string, unknown>,
) => ({ layer: { id }, properties, state });

describe("tapping a mark on the replay map", () => {
  it("names a damage point by rating, what was hit and the wind", () => {
    expect(
      label(
        f(
          "damage-point",
          { ef: "EF3", what: "One- or two-family home", degree: 6, wind: 152 },
          { age: 1 },
        ),
      ),
    ).toEqual({
      title: "Damage survey point · EF3",
      line: "One- or two-family home · degree of damage 6 · about 152 mph",
    });
  });
  it("names a hail report by size and place", () => {
    expect(
      label(
        f(
          "hail-point",
          {
            name: "Golf ball",
            in: 1.75,
            place: "2 N Moore",
            source: "Trained spotter",
          },
          { age: 0.5 },
        ),
      ),
    ).toEqual({
      title: "Hail report · Golf ball (1.75″)",
      line: "2 N Moore · Trained spotter",
    });
  });
  it("ignores marks the replay has not reached yet", () => {
    expect(label(f("damage-point", { ef: "EF1" }, { age: 0 }))).toBeNull();
    expect(label(f("warn-fill", { label: "Tornado Warning" }, {}))).toBeNull();
  });
  it("prefers the tornado on the ground over what lies under it", () => {
    expect(
      pick([
        f("path-line", { name: "Moore", ef: "EF5" }),
        f("tornado-now", { name: "Moore", ef: "EF5" }),
      ])?.line,
    ).toBe("EF5 tornado on the ground now");
  });
});
