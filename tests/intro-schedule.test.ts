import { describe, expect, it } from "vitest";
import {
  dayKey,
  introBootScript,
  parsePref,
  shouldPlay,
} from "@/features/intro/schedule";

const day = new Date(2026, 9, 13, 8, 0);
const today = dayKey(day);

describe("intro schedule", () => {
  it("defaults unknown values to once a day", () => {
    expect(parsePref(null)).toBe("daily");
    expect(parsePref("nonsense")).toBe("daily");
    expect(parsePref("off")).toBe("off");
  });

  it("plays once per local day", () => {
    expect(shouldPlay("daily", null, day)).toBe(true);
    expect(shouldPlay("daily", today, day)).toBe(false);
    expect(shouldPlay("daily", "2026-10-12", day)).toBe(true);
  });

  it("respects always, first launch only and off", () => {
    expect(shouldPlay("always", today, day)).toBe(true);
    expect(shouldPlay("first", null, day)).toBe(true);
    expect(shouldPlay("first", "2026-01-01", day)).toBe(false);
    expect(shouldPlay("off", null, day)).toBe(false);
  });

  it("formats the day key with padding", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("intro boot script", () => {
  const run = (pref: string | null, last: string | null) => {
    const store: Record<string, string> = {};
    if (pref) store["sswx-intro"] = pref;
    if (last) store["sswx-intro-last"] = last;
    const ls = { getItem: (k: string) => store[k] ?? null };
    const root = { dataset: {} as Record<string, string> };
    new Function("localStorage", "document", introBootScript)(ls, {
      documentElement: root,
    });
    return root.dataset.intro === "play";
  };
  it("agrees with shouldPlay", () => {
    const now = new Date();
    const k = dayKey(now);
    for (const pref of ["daily", "always", "first", "off", null]) {
      for (const last of [null, k, "2000-01-01"]) {
        expect(run(pref, last), `${pref}/${last}`).toBe(
          shouldPlay(parsePref(pref), last, now),
        );
      }
    }
  });
});
