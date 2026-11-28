// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const load = async (search: string) => {
  window.history.replaceState(null, "", `/dashboard${search}`);
  vi.resetModules();
  return import("@/features/location/store");
};

describe("place from the URL (embeds)", () => {
  beforeEach(() => localStorage.clear());

  it("shows ?place=lat,lon,Label as the active place without saving it", async () => {
    const s = await load("?embed=1&place=40.5,-83.92,Lakeview%2C%20OH");
    const p = s.read();
    expect(p.list).toHaveLength(1);
    expect(p.list[0].label).toBe("Lakeview, OH");
    expect(p.active).toBe(p.list[0].id);
    expect(localStorage.getItem("sswx-places")).toBeNull();
  });

  it("ignores a malformed or out-of-range place", async () => {
    expect((await load("?place=999,10")).read()).toEqual({ list: [], active: null });
    expect((await load("?place=abc")).read()).toEqual({ list: [], active: null });
  });

  it("steps aside once a place is picked on the page", async () => {
    const s = await load("?place=40.5,-83.92,Lakeview");
    const next = s.addPlace(s.EMPTY, { label: "Columbus", lat: 39.96, lon: -83, source: "search" })!;
    s.write(next);
    expect(s.read().list[0].label).toBe("Columbus");
  });
});
