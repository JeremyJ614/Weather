import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { eventKey, inside } from "@/lib/notify/deliver";
import { TOPICS, isQuiet, isTopic } from "@/lib/notify/topics";
import type { NwsFeature } from "@/lib/nws/active";

const at = (iso: string) => new Date(iso);
const q = (from: number | null, to: number | null) => ({
  quiet_from: from,
  quiet_to: to,
  time_zone: "America/New_York",
});

describe("quiet hours", () => {
  it("wraps past midnight in the member's time zone", () => {
    // 23:00 and 03:00 Eastern are quiet for 22–7; noon is not.
    expect(isQuiet(q(22, 7), at("2026-10-17T03:00:00Z"))).toBe(true);
    expect(isQuiet(q(22, 7), at("2026-10-17T07:00:00Z"))).toBe(true);
    expect(isQuiet(q(22, 7), at("2026-10-17T16:00:00Z"))).toBe(false);
  });
  it("handles a same-day window and no window", () => {
    expect(isQuiet(q(9, 17), at("2026-10-17T14:00:00Z"))).toBe(true);
    expect(isQuiet(q(9, 17), at("2026-10-17T22:00:00Z"))).toBe(false);
    expect(isQuiet(q(null, null), at("2026-10-17T03:00:00Z"))).toBe(false);
  });
});

describe("topics", () => {
  it("only warnings and watches break quiet hours", () => {
    expect(TOPICS.filter((t) => t.urgent).map((t) => t.id)).toEqual([
      "warnings",
      "watches",
    ]);
    expect(isTopic("spc")).toBe(true);
    expect(isTopic("sms")).toBe(false);
  });
});

describe("risk areas", () => {
  const square = {
    type: "Polygon" as const,
    coordinates: [
      [
        [-90, 30],
        [-80, 30],
        [-80, 40],
        [-90, 40],
        [-90, 30],
      ],
      [
        [-86, 34],
        [-84, 34],
        [-84, 36],
        [-86, 36],
        [-86, 34],
      ],
    ],
  };
  it("finds a point inside, outside and in a hole", () => {
    expect(inside(square, -82, 32)).toBe(true);
    expect(inside(square, -95, 32)).toBe(false);
    expect(inside(square, -85, 35)).toBe(false);
  });
});

describe("warning identity", () => {
  const f = (vtec?: string, id = "urn:oid:2.49.0.1.840.0.abc") =>
    ({
      id,
      geometry: null,
      properties: {
        id,
        event: "Tornado Warning",
        parameters: vtec ? { VTEC: [vtec] } : {},
      },
    }) as NwsFeature;
  it("keeps one key across a warning's updates", () => {
    const a = eventKey(f("/O.NEW.KILN.TO.W.0012.261017T1900Z-261017T1945Z/"));
    const b = eventKey(f("/O.CON.KILN.TO.W.0012.261017T1900Z-261017T1945Z/"));
    expect(a.key).toBe("KILN.TO.W.0012");
    expect(b.key).toBe(a.key);
    expect(b.action).toBe("CON");
  });
  it("falls back to the alert id without VTEC", () => {
    expect(eventKey(f()).key).toBe("urn:oid:2.49.0.1.840.0.abc");
  });
});
