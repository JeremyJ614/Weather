import { describe, expect, it } from "vitest";
import { checkDonation, dollars, toCents } from "@/lib/billing/donate";

const form = (o: Record<string, string>) => (k: string) => o[k] ?? "";

describe("donations", () => {
  it("reads typed dollar amounts as cents", () => {
    expect(toCents("25")).toBe(2500);
    expect(toCents("$15.50")).toBe(1550);
    expect(toCents("1,000")).toBe(100000);
    expect(toCents("abc")).toBeNull();
    expect(toCents("1.234")).toBeNull();
  });

  it("formats cents as dollars", () => {
    expect(dollars(2500)).toBe("$25");
    expect(dollars(1550)).toBe("$15.50");
    expect(dollars(100000)).toBe("$1,000");
  });

  it("prefers a preset and falls back to the typed amount", () => {
    expect(checkDonation(form({ preset: "5000" }))).toMatchObject({
      cents: 5000,
      monthly: false,
    });
    expect(
      checkDonation(form({ preset: "", amount: "12", monthly: "on" })),
    ).toMatchObject({
      cents: 1200,
      monthly: true,
    });
    // A tampered preset is not trusted as an amount.
    expect(checkDonation(form({ preset: "7" }))).toHaveProperty("error");
  });

  it("enforces the limits and the wall name", () => {
    expect(checkDonation(form({ amount: "0.50" }))).toEqual({
      error: "The smallest gift is $1.",
    });
    expect(checkDonation(form({ amount: "10001" }))).toHaveProperty("error");
    expect(checkDonation(form({ preset: "1000", wall: "on" }))).toHaveProperty(
      "error",
    );
    expect(
      checkDonation(
        form({
          preset: "1000",
          wall: "on",
          name: "  Sam  ",
          message: "Go  storms",
        }),
      ),
    ).toEqual({
      cents: 1000,
      monthly: false,
      name: "Sam",
      message: "Go storms",
      wall: true,
    });
  });
});
