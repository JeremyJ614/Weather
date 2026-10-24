// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { bySurveyDay, convDay, efRank } = await import("@/lib/patterns/surveys");
const { withSurvey, parseReports } = await import("@/lib/patterns/data");

const at = (iso: string) => Date.parse(iso);
const row = (ef: string, iso: string, lon: number, lat: number) => ({
  attributes: { efscale: ef, starttime: at(iso) },
  geometry: { paths: [[[lon, lat]]] },
});

describe("NWS surveys in Weather Patterns", () => {
  it("files a tornado under SPC's 12Z-to-12Z day", () => {
    expect(convDay(at("2026-10-20T03:00:00Z"))).toBe("2026-10-19");
    expect(convDay(at("2026-10-20T12:00:00Z"))).toBe("2026-10-20");
  });

  it("ranks ratings, unrated lowest", () => {
    expect(efRank("EF2")).toBeGreaterThan(efRank("EF1"));
    expect(efRank("F3")).toBe(efRank("EF3"));
    expect(efRank(undefined)).toBe(0);
  });

  it("counts a day's surveys and keeps the strongest", () => {
    const m = bySurveyDay(
      [
        row("EF0", "2026-10-19T22:00:00Z", -110.9, 32.2),
        row("EF2", "2026-10-20T01:30:00Z", -111.65, 35.2),
        row("EF1", "2026-10-21T15:00:00Z", -97.5, 35.4),
      ],
      "2026-10-19",
      "2026-10-20",
    );
    const d = m.get("2026-10-19")!;
    expect(d.n).toBe(2);
    expect(d.top).toBe("EF2");
    expect(d.states.AZ).toBe(2);
    expect(d.where).toMatch(/, AZ$/);
    expect(m.has("2026-10-21")).toBe(false);
  });

  it("adds a surveyed tornado SPC's file never had", () => {
    const spc = parseReports(
      "2026-10-19",
      "Time,F_Scale,Location,County,State,Lat,Lon,Comments\nTime,Speed,Location,County,State,Lat,Lon,Comments\n2240,77,3 NNE Rodeo,Hidalgo,NM,31.87,-109.02,x\nTime,Size,Location,County,State,Lat,Lon,Comments\n",
    );
    expect(spc.torn).toBe(0);
    const d = withSurvey(spc, {
      n: 1,
      top: "EF2",
      where: "Flagstaff, AZ",
      states: { AZ: 1 },
    });
    expect(d.torn).toBe(1);
    expect(d.tornStates.AZ).toBe(1);
    expect(d.states).toEqual({ NM: 1, AZ: 1 });
    expect(d.strongest).toEqual({ ef: "EF2", where: "Flagstaff, AZ" });
  });

  it("does not double count a tornado SPC already has", () => {
    const spc = parseReports(
      "2026-05-06",
      "Time,F_Scale,Location,County,State,Lat,Lon,Comments\n2100,UNK,2 N Town,Co,OK,35,-97,x\n2110,UNK,3 N Town,Co,OK,35.1,-97,x\nTime,Speed,Location,County,State,Lat,Lon,Comments\nTime,Size,Location,County,State,Lat,Lon,Comments\n",
    );
    const d = withSurvey(spc, {
      n: 1,
      top: "EF1",
      where: "",
      states: { OK: 1 },
    });
    expect(d.torn).toBe(2);
    expect(d.states.OK).toBe(2);
  });
});
