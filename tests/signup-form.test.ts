import { describe, expect, it } from "vitest";
import {
  checkCustom,
  cleanForm,
  DEFAULT_QUESTIONS,
} from "@/lib/auth/signup-form";

describe("signup form", () => {
  it("upgrades the first version's settings", () => {
    const f = cleanForm({
      show: { phone: false },
      foundUsOptions: ["TikTok", "Friend"],
    });
    expect(f.questions.map((q) => q.id)).toEqual(
      DEFAULT_QUESTIONS.map((q) => q.id),
    );
    expect(f.questions.find((q) => q.id === "phone")!.on).toBe(false);
    expect(f.questions.find((q) => q.id === "foundUs")).toMatchObject({
      kind: "choice",
      options: ["TikTok", "Friend"],
    });
  });
  it("keeps the owner's order and questions; locked ones stay on; PIN stays last", () => {
    const f = cleanForm({
      questions: [
        { id: "pin", builtin: "pin", label: "PIN", on: false },
        {
          id: "fav",
          label: "Favorite storm?",
          kind: "choice",
          options: ["Tornado", "Hail", "Tornado"],
          required: true,
        },
        { id: "name", builtin: "name", label: "Name", required: false },
        { id: "<x>", label: "" },
      ],
    });
    expect(f.questions[0]).toMatchObject({
      id: "fav",
      options: ["Tornado", "Hail"],
      required: true,
    });
    expect(f.questions[1]).toMatchObject({
      id: "name",
      required: true,
      on: true,
    });
    expect(f.questions.at(-1)).toMatchObject({
      id: "pin",
      on: true,
      required: true,
    });
    expect(new Set(f.questions.map((q) => q.id)).size).toBe(f.questions.length);
  });
  it("checks custom answers", () => {
    const f = cleanForm({
      questions: [
        {
          id: "fav",
          label: "Fav",
          kind: "choice",
          options: ["A", "B"],
          required: true,
        },
        { id: "n", label: "N", kind: "number" },
      ],
    });
    expect(checkCustom(f, () => [])).toEqual({ error: "Answer “Fav”." });
    expect(checkCustom(f, (id) => (id === "fav" ? ["C"] : []))).toEqual({
      error: "Pick an answer for “Fav”.",
    });
    expect(checkCustom(f, (id) => (id === "fav" ? ["B"] : ["7"]))).toEqual({
      answers: { fav: "B", n: "7" },
    });
  });
});
