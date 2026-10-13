import { describe, expect, it } from "vitest";
import { cleanDraft, parseReply } from "@/lib/trivia/shape";

const good = {
  question:
    "Which radar product shows rotation toward and away from the radar?",
  choices: ["Reflectivity", "Velocity", "Echo tops", "VIL"],
  answer_index: 1,
  explanation: "Velocity shows motion along the beam.",
};

describe("trivia drafts", () => {
  it("accepts a fair question and reads fenced JSON", () => {
    expect(cleanDraft(good)).toEqual(good);
    expect(
      cleanDraft(parseReply("```json\n" + JSON.stringify(good) + "\n```")),
    ).toEqual(good);
    expect(cleanDraft(parseReply("Sure! " + JSON.stringify(good)))).toEqual(
      good,
    );
  });

  it("rejects questions that can't be graded fairly", () => {
    expect(cleanDraft({ ...good, answer_index: 4 })).toBeNull();
    expect(cleanDraft({ ...good, answer_index: 1.5 })).toBeNull();
    expect(cleanDraft({ ...good, choices: ["A", "a", "B"] })).toBeNull();
    expect(cleanDraft({ ...good, choices: ["Only one"] })).toBeNull();
    expect(cleanDraft({ ...good, question: "Why?" })).toBeNull();
    expect(cleanDraft(parseReply("no json here"))).toBeNull();
  });
});
