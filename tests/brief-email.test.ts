import { describe, expect, it } from "vitest";
import { emailHtml, emailText, skyEmoji } from "@/lib/brief/email";
import type { Brief } from "@/lib/brief/compose";

const b: Brief = {
  place: "Tulsa, OK <home>",
  timeZone: "America/Chicago",
  date: "2026-10-19",
  today: {
    name: "Today",
    short: "Chance Showers And Thunderstorms",
    detail: "A 60 percent chance of showers & storms after 1pm.",
    high: 78,
    low: 61,
  },
  tomorrow: { short: "Sunny", high: 72, low: 50 },
  rain: { startsAt: "2026-10-19T18:00:00Z", peakPop: 60 },
  spc: "SLGT",
  aqi: 42,
  alerts: [
    {
      event: "Severe Thunderstorm Watch",
      headline: "",
      ends: "2026-10-20T02:00:00Z",
    },
  ],
  extra: {
    parts: [
      {
        name: "Morning",
        hi: 66,
        lo: 61,
        pop: 10,
        short: "Cloudy",
        isDay: true,
      },
      {
        name: "Afternoon",
        hi: 78,
        lo: 70,
        pop: 60,
        short: "T-storms",
        isDay: true,
      },
    ],
    pops: Array.from({ length: 24 }, (_, i) => (i > 5 && i < 12 ? 60 : 10)),
    mid: "2026-10-20T03:00:00Z",
    end: "2026-10-20T14:00:00Z",
    sunrise: "2026-10-19T12:35:00Z",
    sunset: "2026-10-19T23:40:00Z",
    gust: 24,
    moon: { name: "Waxing Crescent", pct: 22 },
  },
};
const national = {
  score: { total: 64, label: "Elevated", color: "#f97316" },
  headlines: [
    { title: "Storms & hail", url: "https://x.test/a", source: "NWS" },
  ],
};
const o = {
  site: "https://weather.sswx.space",
  unsub: "https://u.test/x",
  national,
};

describe("Daily Brief email", () => {
  it("draws every section the page has, escaped", () => {
    const h = emailHtml(b, { ...o, colors: {} });
    for (const part of [
      "Tulsa, OK &lt;home&gt;",
      "Severe Thunderstorm Watch",
      "Your day",
      "Rain, next 24 hours",
      "Slight · 2 of 5",
      "Air quality",
      "Sunrise",
      "Tomorrow",
      "6° cooler",
      "SSWXCon national score",
      "Storms &amp; hail",
      "Open your full brief",
      "https://u.test/x",
    ])
      expect(h).toContain(part);
    expect(h).not.toContain("<svg");
    expect(h).not.toContain("<home>");
  });

  it("writes a preview when asked", async () => {
    if (!process.env.BRIEF_PREVIEW) return;
    const fs = await import("node:fs");
    fs.writeFileSync(
      process.env.BRIEF_PREVIEW,
      emailHtml(b, { ...o, colors: {} }),
    );
  });

  it("has a plain-text twin with the unsubscribe link", () => {
    const t = emailText(b, o);
    expect(t).toContain("Afternoon: T-storms, 78°/70°, rain 60%");
    expect(t).toContain("Unsubscribe: https://u.test/x");
  });

  it("picks an emoji for the sky", () => {
    expect(skyEmoji("Chance Showers And Thunderstorms")).toBe("⛈️");
    expect(skyEmoji("Mostly Clear", false)).toBe("🌙");
    expect(skyEmoji("Partly Cloudy")).toBe("⛅");
    expect(skyEmoji("Sunny")).toBe("☀️");
    expect(skyEmoji("Clear", false)).toBe("🌙");
  });
});
