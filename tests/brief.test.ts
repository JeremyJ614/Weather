import { describe, expect, it } from "vitest";
import {
  briefText,
  dayParts,
  isDue,
  rainTiming,
  type Brief,
} from "@/lib/brief/compose";
import type { Hour, Period } from "@/lib/weather/types";

const hour = (i: number, pop: number): Hour => ({
  start: `2026-10-13T${String(12 + i).padStart(2, "0")}:00:00Z`,
  isDay: true,
  temp: 70,
  pop,
  wind: "",
  short: "",
  dewF: null,
  rh: null,
});
const period = (name: string, isDay: boolean, temp: number): Period => ({
  name,
  start: "",
  isDay,
  temp,
  pop: null,
  wind: "",
  short: name,
  detail: "",
});

describe("daily brief", () => {
  it("finds rain timing", () => {
    expect(rainTiming([hour(0, 10), hour(1, 50), hour(2, 70)])).toEqual({
      startsAt: "2026-10-13T13:00:00Z",
      peakPop: 70,
    });
    expect(rainTiming([hour(0, 10)])).toEqual({ startsAt: null, peakPop: 10 });
  });
  it("reads today and tomorrow by local date", () => {
    const P = (
      name: string,
      isDay: boolean,
      temp: number,
      start: string,
    ): Period => ({ ...period(name, isDay, temp), start });
    const morning = dayParts(
      [
        P("Today", true, 88, "2026-10-13T06:00:00-05:00"),
        P("Tonight", false, 70, "2026-10-13T18:00:00-05:00"),
        P("Wednesday", true, 85, "2026-10-14T06:00:00-05:00"),
        P("Wednesday Night", false, 66, "2026-10-14T18:00:00-05:00"),
      ],
      "2026-10-13",
    );
    expect(morning.today).toMatchObject({ name: "Today", high: 88, low: 70 });
    expect(morning.tomorrow).toMatchObject({ high: 85, low: 66 });
    const overnight = dayParts(
      [
        P("Overnight", false, 74, "2026-10-13T02:00:00-05:00"),
        P("Tuesday", true, 88, "2026-10-13T06:00:00-05:00"),
        P("Tuesday Night", false, 74, "2026-10-13T18:00:00-05:00"),
        P("Wednesday", true, 85, "2026-10-14T06:00:00-05:00"),
      ],
      "2026-10-13",
    );
    expect(overnight.today).toMatchObject({
      name: "Tuesday",
      high: 88,
      low: 74,
    });
    expect(overnight.tomorrow).toMatchObject({ high: 85 });
  });
  it("writes the text and push line", () => {
    const b: Brief = {
      place: "Norman, OK",
      timeZone: "America/Chicago",
      date: "2026-10-13",
      today: { name: "Today", short: "Sunny", detail: "", high: 88, low: 70 },
      tomorrow: null,
      rain: { startsAt: null, peakPop: 0 },
      spc: "SLGT",
      alerts: [{ event: "Heat Advisory", headline: "", ends: null }],
    };
    const t = briefText(b);
    expect(t.subject).toBe("⚠ Your StormSync brief for Norman, OK");
    expect(t.lines.join(" ")).toContain("Slight (2 of 5)");
    expect(t.push).toBe("⚠ Heat Advisory · Sunny, 88°");
  });
  it("is due once at the chosen local hour", () => {
    const now = new Date("2026-10-13T11:20:00Z"); // 6:20 AM in Chicago
    expect(
      isDue(
        { send_hour: 6, time_zone: "America/Chicago", last_sent: null },
        now,
      ),
    ).toEqual({ due: true, localDate: "2026-10-13" });
    expect(
      isDue(
        { send_hour: 6, time_zone: "America/Chicago", last_sent: "2026-10-13" },
        now,
      ).due,
    ).toBe(false);
    expect(
      isDue(
        { send_hour: 7, time_zone: "America/Chicago", last_sent: null },
        now,
      ).due,
    ).toBe(false);
  });
});
