import { describe, expect, it } from "vitest";
import { pickMenus } from "@/features/menus/styles";
import { FALLBACK, cleanDefaults } from "@/lib/settings";

describe("site defaults", () => {
  it("uses the admin's defaults when the user has none", () => {
    expect(pickMenus({}, { main: "plates", second: "dial" })).toEqual({
      main: "plates",
      second: "dial",
    });
  });
  it("keeps the user's own picks over the defaults", () => {
    expect(
      pickMenus(
        { main: "ledger", second: "depth" },
        { main: "plates", second: "dial" },
      ),
    ).toEqual({
      main: "ledger",
      second: "depth",
    });
  });
  it("never shows the same style twice", () => {
    const r = pickMenus(
      { main: "plates" },
      { main: "sweep", second: "plates" },
    );
    expect(r.main).toBe("plates");
    expect(r.second).not.toBe("plates");
  });
  it("drops unknown values from the database", () => {
    expect(
      cleanDefaults([
        { key: "menu_defaults", value: { main: "nope", second: "<script>" } },
        { key: "theme_default", value: { palette: "x", font: 3 } },
      ]),
    ).toEqual(FALLBACK);
  });
});

describe("kill switches and banner", () => {
  it("reads valid values and drops junk", () => {
    const d = cleanDefaults([
      { key: "disabled_modules", value: ["weather", 5, "maps"] },
      {
        key: "banner",
        value: { text: "Back at 5", until: "2026-10-14T00:00:00Z" },
      },
    ]);
    expect(d.disabled).toEqual(["weather", "maps"]);
    expect(d.banner).toEqual({
      text: "Back at 5",
      until: "2026-10-14T00:00:00Z",
    });
    expect(
      cleanDefaults([{ key: "banner", value: { text: 1, until: "nope" } }])
        .banner,
    ).toEqual({ text: "", until: null });
  });
});
