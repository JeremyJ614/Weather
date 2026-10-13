import { expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

it("allows only same-site paths after sign-in", () => {
  expect(safeNext("/profile")).toBe("/profile");
  expect(safeNext("//evil.com")).toBe("/");
  expect(safeNext("https://evil.com")).toBe("/");
  expect(safeNext(null)).toBe("/");
});
