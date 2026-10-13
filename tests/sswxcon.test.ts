import { describe, expect, it } from "vitest";
import {
  bandFor,
  computeScore,
  describe as drivers,
  type Alert,
} from "@/lib/sswxcon/score";

const many = (n: number, a: Alert) => Array.from({ length: n }, () => a);
const score = (
  alerts: Alert[],
  spc: Parameters<typeof computeScore>[1] = null,
) => computeScore(alerts, spc);
const part = (r: ReturnType<typeof computeScore>, key: string) =>
  r.components.find((c) => c.key === key)!.score;

describe("SSWXCon v2", () => {
  it("is quiet with nothing active", () => {
    const r = score([]);
    expect(r.total).toBe(0);
    expect(bandFor(r.total).label).toBe("Quiet / Low");
    expect(drivers(r.components, r.total)).toMatch(/No warning-level/);
  });

  it("keeps VIP's weights and caps for plain warnings", () => {
    expect(part(score(many(5, { event: "Tornado Warning" })), "tornado")).toBe(
      20,
    );
    expect(part(score(many(40, { event: "Tornado Warning" })), "tornado")).toBe(
      120,
    );
    expect(
      part(score(many(10, { event: "Severe Thunderstorm Warning" })), "severe"),
    ).toBe(10);
    expect(part(score(many(4, { event: "Flood Warning" })), "flood")).toBe(1);
    expect(
      part(score(many(2, { event: "Hurricane Warning" })), "tropical"),
    ).toBe(12);
  });

  it("weighs emergencies, PDS and observed tornadoes more", () => {
    const tw = (params: Alert["params"]) => ({
      event: "Tornado Warning",
      params,
    });
    expect(part(score([tw({ tornadoDetection: "OBSERVED" })]), "tornado")).toBe(
      8,
    );
    expect(
      part(score([tw({ tornadoDamageThreat: "CONSIDERABLE" })]), "tornado"),
    ).toBe(12);
    expect(
      part(score([tw({ tornadoDamageThreat: "CATASTROPHIC" })]), "tornado"),
    ).toBe(40);
    expect(
      part(
        score([
          {
            event: "Severe Thunderstorm Warning",
            params: { thunderstormDamageThreat: "DESTRUCTIVE" },
          },
        ]),
        "severe",
      ),
    ).toBe(3);
    expect(
      part(
        score([
          {
            event: "Flash Flood Warning",
            params: { flashFloodDamageThreat: "CATASTROPHIC" },
          },
        ]),
        "flood",
      ),
    ).toBe(5);
  });

  it("no longer counts look-alikes or watches as warnings", () => {
    const r = score([
      { event: "Hurricane Force Wind Warning" },
      { event: "Coastal Flood Warning" },
      { event: "Lakeshore Flood Warning" },
      { event: "Winter Storm Watch" },
      { event: "Blizzard Watch" },
      { event: "Red Flag Warning" },
    ]);
    expect(part(r, "tropical")).toBe(0);
    expect(part(r, "flood")).toBe(0);
    expect(part(r, "winter")).toBe(0);
    expect(r.total).toBe(0.5);
  });

  it("lifts the score before storms fire (setup, capped at 30)", () => {
    expect(score([], "HIGH").total).toBe(30);
    expect(score([], "TSTM").total).toBe(0);
    expect(score([{ event: "Tornado Watch", pds: true }], "SLGT").total).toBe(
      10,
    );
    expect(
      score(many(10, { event: "Tornado Watch", pds: true }), "HIGH").total,
    ).toBe(30);
  });

  it("names what drives the score", () => {
    const r = score(
      [
        ...many(10, { event: "Tornado Warning" }),
        ...many(10, { event: "Severe Thunderstorm Warning" }),
      ],
      "MDT",
    );
    expect(r.total).toBe(68);
    expect(drivers(r.components, r.total)).toMatch(
      /^tornado warnings carries 59%/,
    );
    expect(bandFor(r.total).label).toBe("Elevated");
  });
});
