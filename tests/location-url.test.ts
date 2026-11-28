// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { embedBootScript } from "@/features/embed/boot";

/** Loads a page URL, runs the inline boot script like the layout does, then reads the store. */
const load = async (search: string) => {
  window.history.replaceState(null, "", `/dashboard${search}`);
  delete (globalThis as { sswxPlace?: unknown }).sswxPlace;
  delete document.documentElement.dataset.embed;
  new Function(embedBootScript)();
  vi.resetModules();
  return import("@/features/location/store");
};

describe("embed boot script", () => {
  beforeEach(() => localStorage.clear());

  it("shows ?place=lat,lon,Label as the active place without saving it", async () => {
    const s = await load("?embed=1&place=40.5,-83.92,Lakeview%2C%20OH");
    const p = s.read();
    expect(p.list).toHaveLength(1);
    expect(p.list[0]).toMatchObject({
      label: "Lakeview, OH",
      lat: 40.5,
      lon: -83.92,
    });
    expect(p.active).toBe(s.placeId(40.5, -83.92));
    expect(localStorage.getItem("sswx-places")).toBeNull();
    expect(document.documentElement.dataset.embed).toBe("1");
  });

  it("marks part mode and ignores a malformed or out-of-range place", async () => {
    expect((await load("?embed=part&place=999,10")).read()).toEqual({
      list: [],
      active: null,
    });
    expect(document.documentElement.dataset.embed).toBe("part");
    expect((await load("?place=abc")).read()).toEqual({
      list: [],
      active: null,
    });
  });

  it("steps aside once a place is picked on the page", async () => {
    const s = await load("?place=40.5,-83.92,Lakeview");
    const next = s.addPlace(s.EMPTY, {
      label: "Columbus",
      lat: 39.96,
      lon: -83,
      source: "search",
    })!;
    s.write(next);
    expect(s.read().list[0].label).toBe("Columbus");
  });
});
