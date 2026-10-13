import { expect, it } from "vitest";
import { DEFAULT_FORM, cleanForm } from "@/lib/auth/signup-form";

it("cleans the stored signup form", () => {
  expect(cleanForm(null)).toEqual(DEFAULT_FORM);
  const f = cleanForm({
    show: { phone: false, x: 1 },
    foundUsOptions: [" TikTok ", "TikTok", 3, ""],
    intro: 5,
  });
  expect(f.show).toEqual({
    nickname: true,
    phone: false,
    foundUs: true,
    referral: true,
  });
  expect(f.foundUsOptions).toEqual(["TikTok"]);
  expect(f.intro).toBe("");
});
