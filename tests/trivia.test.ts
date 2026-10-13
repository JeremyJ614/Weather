import { describe, expect, it } from "vitest";
import {
  cleanDraft,
  fingerprintText,
  isDuplicate,
  parseReply,
} from "@/lib/trivia/shape";

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

describe("duplicate guard", () => {
  const past = [
    {
      question:
        "Which radar product shows rotation toward and away from the radar?",
      answer: "Velocity",
    },
  ];
  it("catches rewordings and the same fact asked again", () => {
    expect(
      isDuplicate(
        {
          ...good,
          question:
            "What radar product shows rotation toward or away from a radar?",
        },
        past,
      ),
    ).toBe(true);
    expect(
      isDuplicate(
        {
          question: "Doppler radar spots rotation with which product?",
          choices: ["Velocity", "Reflectivity", "Hail size", "Echo tops"],
          answer_index: 0,
          explanation: "",
        },
        past,
      ),
    ).toBe(true);
    expect(
      isDuplicate(
        {
          question: "Which product on Doppler radar shows rotation?",
          choices: ["Velocity", "Reflectivity", "Hail size", "Echo tops"],
          answer_index: 0,
          explanation: "",
        },
        past,
      ),
    ).toBe(true);
  });

  it("lets a new question through", () => {
    expect(
      isDuplicate(
        {
          question:
            "What is the name for a dome of cold air under a thunderstorm?",
          choices: ["Cold pool", "Dry line", "Cap", "Jet streak"],
          answer_index: 0,
          explanation: "",
        },
        past,
      ),
    ).toBe(false);
  });

  it("fingerprints ignore case, punctuation and word order", () => {
    expect(fingerprintText("What is a Derecho?")).toBe(
      fingerprintText("derecho: what is it"),
    );
  });
});
