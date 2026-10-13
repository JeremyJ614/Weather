import { describe, expect, it } from "vitest";
import {
  FRESH,
  MAX_FAILURES,
  afterFailure,
  lockedUntil,
} from "@/lib/auth/lockout";
import { age, checkSignup, type SignupInput } from "@/lib/auth/signup";

const now = Date.parse("2026-10-13T12:00:00Z");

describe("PIN lockout", () => {
  it("locks after five failures for 15 minutes, then doubles", () => {
    let a = FRESH;
    for (let i = 0; i < MAX_FAILURES - 1; i++) a = afterFailure(a, now);
    expect(lockedUntil(a, now)).toBeNull();
    a = afterFailure(a, now);
    expect(lockedUntil(a, now)).toBe(now + 15 * 60_000);
    for (let i = 0; i < MAX_FAILURES; i++) a = afterFailure(a, now);
    expect(lockedUntil(a, now)).toBe(now + 30 * 60_000);
  });
  it("caps at 24 hours and expires", () => {
    const a = afterFailure({ failures: 4, locks: 20, locked_until: null }, now);
    expect(lockedUntil(a, now)).toBe(now + 24 * 3_600_000);
    expect(lockedUntil(a, now + 25 * 3_600_000)).toBeNull();
  });
});

describe("signup form", () => {
  const ok: SignupInput = {
    firstName: "Jay",
    lastName: "Myers",
    nickname: "",
    useNickname: false,
    phone: "",
    city: "Norman",
    state: "OK",
    birthday: "1990-05-01",
    foundUs: "",
    referral: "",
    pin: "1234",
    pin2: "1234",
  };
  const today = new Date("2026-10-13T00:00:00Z");
  it("accepts a valid form", () => expect(checkSignup(ok, today)).toBeNull());
  it("requires 18+", () => {
    expect(age("2008-10-14", today)).toBe(17);
    expect(checkSignup({ ...ok, birthday: "2008-10-14" }, today)).toMatch(/18/);
    expect(checkSignup({ ...ok, birthday: "2008-10-13" }, today)).toBeNull();
  });
  it("catches bad fields", () => {
    expect(checkSignup({ ...ok, pin2: "4321" }, today)).toMatch(/match/);
    expect(checkSignup({ ...ok, state: "XX" }, today)).toMatch(/state/);
    expect(checkSignup({ ...ok, referral: "12" }, today)).toMatch(/6 digits/);
    expect(checkSignup({ ...ok, phone: "(405) 555-0100" }, today)).toBeNull();
    expect(checkSignup({ ...ok, useNickname: true }, today)).toMatch(
      /nickname/,
    );
  });
});
